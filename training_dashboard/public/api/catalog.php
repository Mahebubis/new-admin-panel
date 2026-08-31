<?php
/**
 * catalog.php — what the signed-in learner is allowed to see and play.
 * ---------------------------------------------------------------------------
 *   ?action=home           GET   "Continue Learning" + counts for /learn
 *   ?action=enrollments    GET   the My Enrollments list
 *   ?action=course&slug=   GET   one course: sections, lessons, attachments,
 *                                the learner's progress, and the resolved
 *                                video source for each lesson
 *   ?action=lesson&id=     GET   one lesson (used when deep-linking a lesson)
 *   ?action=analytics&course_id=  GET  the course-analytics screen
 *
 * Access rule: a learner sees a course only through an active row in
 * lms_enrollments. Expired rows still list (Learnyst shows them greyed with an
 * EXPIRED chip) but their lessons are not served.
 */

require_once __DIR__ . '/_bootstrap.php';

$uid    = learn_require_user();
$action = $_GET['action'] ?? '';

/**
 * Turn an internship purchase into real LMS access.
 *
 * Buying an internship writes to internship_payment; seeing a course requires
 * a row in lms_enrollments. Nothing used to bridge the two, so a learner who
 * had paid for "Software Testing Internship" still landed on an empty
 * "Nothing to continue yet" — the course existed, was published, had lessons,
 * and was simply not granted to them.
 *
 * The bridge is lms_courses.internship_name: whatever an admin picked in the
 * course's "Internship / course this belongs to" field. A course with that
 * field empty is never auto-granted — it has to be enrolled by hand, which is
 * what standalone and ₹99 courses want.
 *
 * Deliberately INSERT IGNORE, not INSERT ... ON DUPLICATE KEY UPDATE. The
 * unique key is (course_id, user_id), so an enrolment that already exists is
 * skipped untouched — including one an admin has revoked. Re-granting access
 * that was deliberately taken away, on the learner's very next page load,
 * would make revoke useless.
 *
 * CONVERT/COLLATE on both sides of the name match because internship_payment
 * and lms_courses were created years apart and do not share a collation;
 * comparing them raw raises "Illegal mix of collations".
 */
/**
 * Every ₹99-store course this learner has paid for, one row per COURSE.
 *
 * The table carries a course two ways and they do not always agree:
 *
 *   course_name   a single scalar — the order's headline course
 *   courses       a JSON array — [{name, slug, price}, …] — the real cart
 *
 * A basket of three courses writes all three into 'courses' and only one of
 * them into course_name, so reading the column alone quietly dropped the rest.
 * Both are read here and merged.
 *
 * The JSON is expanded in PHP rather than with JSON_TABLE because these rows
 * also need collation-safe name matching against lms_courses, and doing the
 * whole thing in SQL turns into a JSON join with three CONVERT()s hanging off
 * it. The per-learner row count is small; clarity wins.
 *
 * Returns [ ['name' => string, 'batch' => string|null, 'amount' => float], … ].
 */
function learn_store_purchases($conn, $uid) {
    $uid = (int)$uid;
    $out = [];

    $exists = $conn->query("SELECT 1 FROM information_schema.TABLES
                             WHERE TABLE_SCHEMA = DATABASE()
                               AND TABLE_NAME = 'ninety_nine_store_orders' LIMIT 1");
    if (!$exists || !$exists->num_rows) return $out;

    /* Store checkout does not require an account, so older rows carry an email
       and no user_id at all. Matching on either is what lets someone who
       bought first and registered later still get their course. */
    $res = $conn->query("SELECT course_name, courses, batch, amount
                           FROM ninety_nine_store_orders
                          WHERE status = 'success'
                            AND (user_id = $uid
                                 OR CONVERT(LOWER(email) USING utf8mb4) COLLATE utf8mb4_unicode_ci
                                  = (SELECT CONVERT(LOWER(u2.email) USING utf8mb4) COLLATE utf8mb4_unicode_ci
                                       FROM users u2 WHERE u2.user_id = $uid))");

    while ($res && ($r = $res->fetch_assoc())) {
        $names = [];

        $single = trim((string)($r['course_name'] ?? ''));
        if ($single !== '') $names[] = $single;

        $cart = json_decode((string)($r['courses'] ?? ''), true);
        if (is_array($cart)) {
            foreach ($cart as $item) {
                $nm = is_array($item) ? trim((string)($item['name'] ?? '')) : trim((string)$item);
                if ($nm !== '') $names[] = $nm;
            }
        }

        foreach (array_unique($names) as $nm) {
            $out[] = [
                'name'   => $nm,
                'batch'  => $r['batch'],
                'amount' => (float)$r['amount'],
            ];
        }
    }
    return $out;
}

/** A batch written as prose -> "YYYY-MM-DD", or "" when it cannot be read. */
function learn_batch_iso($batch) {
    $b = trim((string)$batch);
    if ($b === '') return '';
    $ts = strtotime(preg_replace('/(\d+)(st|nd|rd|th)/i', '$1', $b));
    return $ts === false ? '' : date('Y-m-d', $ts);
}

/** Has a batch written as prose ("24th August, 2026") already begun? */
function learn_batch_started($batch) {
    $b = trim((string)$batch);
    /* Empty or unreadable fails OPEN — see the note in learn_sync_entitlements. */
    if ($b === '') return true;
    $ts = strtotime(preg_replace('/(\d+)(st|nd|rd|th)/i', '$1', $b));
    if ($ts === false) return true;
    return $ts <= strtotime(date('Y-m-d'));
}

function learn_sync_entitlements($conn, $uid) {
    $uid = (int)$uid;
    if (!$uid) return;

    /* Everything below is opportunistic: it grants access the learner has
       already paid for, and the page renders correctly without it (the admin
       can still enrol by hand). So a failure here must never surface.
       mysqli runs in exception mode on this connection, which means an '@'
       prefix does NOT suppress a bad query — the exception escapes and 500s
       the whole endpoint. It has to be caught. */
    try {
        learn_grant_purchased($conn, $uid);
    } catch (Throwable $e) {
        learn_log('SYNC-ENTITLEMENTS', $e->getMessage());
    }
}

function learn_grant_purchased($conn, $uid) {

    /* The three places a purchase can land, all matched against the same
       lms_courses.internship_name. The admin picks that name from one merged
       list (internships + ₹99 courses), so one field bridges all three:

         internship_payment        a fulfilled internship
         payment_status            an internship checkout marked success
         ninety_nine_store_orders  a ₹99-store course marked success

       payment_status is included as well as internship_payment because the
       two do not always agree — an older purchase can sit in one and not the
       other, and a learner who paid should not lose access to that. */
    $expiry = "CASE WHEN c.validity_days > 0
                    THEN DATE_ADD(CURDATE(), INTERVAL c.validity_days DAY)
                    ELSE NULL END";

    /* A course must not appear before its batch begins.
       The batch is stored as prose — "19th August, 2026" — not a DATE, so it
       has to be parsed. %D is MySQL's ordinal day, which is what handles the
       "19th"/"1st"/"22nd" suffixes; %M is the full month name.

       Rows whose batch is empty or does not parse FAIL OPEN and are granted.
       Blocking on text we could not read would hide a course somebody paid
       for, which is a worse mistake than showing one a day early — and the
       ₹99 store writes batches with no year at all ("24 August"), so
       unparseable is a normal case, not a corrupt one. */
    $started = fn($col) => "(TRIM(COALESCE($col, '')) = ''
                             OR STR_TO_DATE($col, '%D %M, %Y') IS NULL
                             OR STR_TO_DATE($col, '%D %M, %Y') <= CURDATE())";
    $match  = "CONVERT(c.internship_name USING utf8mb4) COLLATE utf8mb4_unicode_ci";
    /* is_enabled is not tested here. A switched-off course is still enrolled
       into — the learner sees it as coming soon, and the row has to exist for
       that card to appear at all. Only c.status gates enrolment. */
    $live   = "c.status = 'published'
               AND c.internship_name IS NOT NULL AND c.internship_name <> ''";

    /* 1 — internships that were fulfilled */
    $conn->query("INSERT IGNORE INTO lms_enrollments
            (course_id, user_id, access_type, amount, source, expiry_date, status)
        SELECT DISTINCT c.id, $uid, 'paid', 0, 'internship', $expiry, 'active'
          FROM lms_courses c
          JOIN internship_payment ip
            ON ip.user_id = $uid
           AND CONVERT(ip.internship USING utf8mb4) COLLATE utf8mb4_unicode_ci = $match
           AND " . $started('ip.batch') . "
         WHERE $live");

    /* 2 — internship checkouts that succeeded */
    $conn->query("INSERT IGNORE INTO lms_enrollments
            (course_id, user_id, access_type, amount, source, expiry_date, status)
        SELECT DISTINCT c.id, $uid, 'paid', 0, 'internship', $expiry, 'active'
          FROM lms_courses c
          JOIN payment_status ps
            ON ps.user_id = $uid AND ps.status = 'success'
           AND CONVERT(ps.internship_name USING utf8mb4) COLLATE utf8mb4_unicode_ci = $match
           AND " . $started('ps.batch_date') . "
         WHERE $live");

    /* 3 — ₹99-store courses.
       Matched in PHP because one order can name several courses inside its
       'courses' JSON; see learn_store_purchases(). Started batches only. */
    $wanted = [];
    foreach (learn_store_purchases($conn, $uid) as $buy) {
        if (!learn_batch_started($buy['batch'])) continue;
        $wanted[mb_strtolower($buy['name'])] = $buy['amount'];
    }
    if ($wanted) {
        $names = implode(',', array_map(
            fn($k) => "'" . learn_esc($conn, $k) . "'", array_keys($wanted)
        ));
        $cr = $conn->query("SELECT id, internship_name FROM lms_courses
                             WHERE status = 'published'
                               AND LOWER(internship_name) IN ($names)");
        while ($cr && ($c = $cr->fetch_assoc())) {
            $amount = $wanted[mb_strtolower($c['internship_name'])] ?? 0;
            $conn->query("INSERT IGNORE INTO lms_enrollments
                    (course_id, user_id, access_type, amount, source, expiry_date, status)
                SELECT c.id, $uid, 'paid', " . (float)$amount . ", 'store', $expiry, 'active'
                  FROM lms_courses c WHERE c.id = " . (int)$c['id']);
        }
    }
}

/* Runs before any catalog read, so a learner who bought an internship five
   minutes ago sees the course on this request rather than after an admin
   remembers to bulk-enrol. Idempotent and indexed, so repeating it per
   request costs one cheap statement. */
learn_sync_entitlements($conn, $uid);

/* ── how a stored video_url turns into something the player can show ───────
   Admins paste whatever their source gives them, so the shape is sniffed here
   once rather than in three different places in React. */
function learn_video_source($url, $provider) {
    $url = trim((string)$url);
    if ($url === '') return ['kind' => 'none', 'src' => '', 'embed' => ''];

    /* Vimeo — either a plain link or an already-built player URL. */
    if (preg_match('#(?:player\.)?vimeo\.com/(?:video/)?(\d+)#i', $url, $m)) {
        $q = 'title=0&byline=0&portrait=0&dnt=1';
        /* Unlisted Vimeo links carry a hash after the id: vimeo.com/ID/HASH */
        if (preg_match('#vimeo\.com/(?:video/)?\d+/([0-9a-z]+)#i', $url, $h)) $q .= '&h=' . $h[1];
        return ['kind' => 'vimeo', 'src' => $url, 'embed' => "https://player.vimeo.com/video/{$m[1]}?$q"];
    }

    /* Bunny Stream — the embed iframe, or a direct HLS playlist off the CDN. */
    if (preg_match('#iframe\.mediadelivery\.net/(?:embed|play)/(\d+)/([0-9a-f\-]+)#i', $url, $m)) {
        return [
            'kind'  => 'bunny',
            'src'   => $url,
            'embed' => "https://iframe.mediadelivery.net/embed/{$m[1]}/{$m[2]}?autoplay=false&preload=true",
        ];
    }
    if (preg_match('#\.b-cdn\.net/.+\.m3u8#i', $url)) {
        return ['kind' => 'hls', 'src' => $url, 'embed' => ''];
    }

    if (preg_match('#(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([A-Za-z0-9_\-]{6,})#i', $url, $m)) {
        return ['kind' => 'youtube', 'src' => $url, 'embed' => "https://www.youtube-nocookie.com/embed/{$m[1]}?rel=0&modestbranding=1"];
    }

    if (preg_match('#\.m3u8(\?|$)#i', $url))                 return ['kind' => 'hls',  'src' => $url, 'embed' => ''];
    if (preg_match('#\.(mp4|webm|ogg|mov|m4v)(\?|$)#i', $url)) return ['kind' => 'file', 'src' => $url, 'embed' => ''];

    /* An S3 object without a recognisable extension is still a direct file. */
    if ($provider === 's3' || preg_match('#amazonaws\.com/#i', $url)) {
        return ['kind' => 'file', 'src' => $url, 'embed' => ''];
    }

    /* Last resort: let an iframe try. Better than a blank frame with no clue. */
    return ['kind' => 'iframe', 'src' => $url, 'embed' => $url];
}

/** The learner's enrolments, newest first, with progress folded in. */
function learn_enrollment_rows($conn, $uid) {
    /* ── switched off reads as coming soon ─────────────────────────────────
       lms_courses.is_enabled is the admin's "close this course" switch. It
       does NOT hide the course from a learner who is enrolled: it puts the
       same Coming-soon face on it that is_coming_soon does. Taking a paid-for
       course off someone's list without explanation is the one outcome worse
       than making them wait.

       Two switches, one visible result, and that is deliberate — is_enabled is
       also read by user_dashboard for routing, where it means something
       different, so it stays a separate column rather than being folded into
       is_coming_soon.

       What DOES hide a course is c.status <> 'published'. That has always been
       true and is unchanged: an unpublished course reaches nobody.

       learn_soon_columns() has already guaranteed the columns exist; COALESCE
       covers a row written before the default applied. */
    learn_soon_columns($conn);

    $sql = "SELECT e.id enrollment_id, e.access_type, e.amount, e.expiry_date, e.status enrollment_status,
                   e.enrolled_at, e.source,
                   c.id course_id, c.title, c.slug, c.subtitle, c.description, c.category,
                   c.thumbnail_url, c.instructor, c.validity_days,
                   GREATEST(COALESCE(c.is_coming_soon, 0),
                            1 - COALESCE(c.is_enabled, 1)) course_soon,
                   COALESCE(c.coming_soon_note, '') course_note,
                   /* Lessons a learner can actually OPEN — a coming-soon lesson
                      in the denominator means the bar can never reach 100%.
                      The three levels cascade, so the course's own flag is
                      folded in here rather than checked separately. */
                   (SELECT COUNT(*) FROM lms_lessons l
                      LEFT JOIN lms_sections s2 ON s2.id = l.section_id
                     WHERE l.course_id = c.id AND l.is_hidden = 0 AND l.status = 'published'
                       AND GREATEST(COALESCE(l.is_coming_soon, 0),
                                    COALESCE(s2.is_coming_soon, 0),
                                    COALESCE(c.is_coming_soon, 0),
                                    1 - COALESCE(c.is_enabled, 1)) = 0) open_count,
                   (SELECT COUNT(*) FROM lms_lessons l
                      WHERE l.course_id = c.id AND l.is_hidden = 0 AND l.status = 'published') lesson_count,
                   (SELECT COUNT(*) FROM lms_lessons l
                      WHERE l.course_id = c.id AND l.is_hidden = 0 AND l.status = 'published'
                        AND l.lesson_type = 'quiz') quiz_count,
                   (SELECT COALESCE(SUM(l.duration_secs),0) FROM lms_lessons l
                      WHERE l.course_id = c.id AND l.is_hidden = 0 AND l.status = 'published') total_secs,
                   (SELECT COUNT(*) FROM lms_progress p
                      WHERE p.user_id = e.user_id AND p.course_id = c.id AND p.status = 'completed') done_count,
                   (SELECT MAX(p.updated_at) FROM lms_progress p
                      WHERE p.user_id = e.user_id AND p.course_id = c.id) last_activity
            FROM lms_enrollments e
            JOIN lms_courses c ON c.id = e.course_id
            WHERE e.user_id = " . (int)$uid . "
              AND e.status <> 'revoked'
              AND c.status = 'published'
            ORDER BY (e.expiry_date IS NOT NULL AND e.expiry_date < CURDATE()) ASC,
                     COALESCE((SELECT MAX(p.updated_at) FROM lms_progress p
                               WHERE p.user_id = e.user_id AND p.course_id = c.id), e.enrolled_at) DESC";
    $res  = $conn->query($sql);
    $rows = [];
    while ($res && ($r = $res->fetch_assoc())) {
        /* Published AND coming soon is a real combination: it is how a course
           is announced before it is recorded. The card says so instead of
           showing lesson counts and a progress bar for content nobody can
           open yet. A course with lessons that are ALL coming soon reads the
           same way, even without the course-level flag. */
        $open    = (int)$r['open_count'];
        $lessons = $open;
        $soon    = (int)$r['course_soon'] === 1
                   || ($open === 0 && (int)$r['lesson_count'] > 0);
        $done    = min((int)$r['done_count'], $lessons);
        $expired = $r['expiry_date'] && $r['expiry_date'] < date('Y-m-d');

        $rows[] = [
            'enrollment_id' => (int)$r['enrollment_id'],
            'course_id'     => (int)$r['course_id'],
            'title'         => $r['title'],
            'slug'          => $r['slug'],
            'subtitle'      => $r['subtitle'],
            'description'   => $r['description'],
            'category'      => $r['category'],
            'thumbnail_url' => $r['thumbnail_url'],
            'instructor'    => $r['instructor'],
            'lesson_count'  => $lessons,
            'coming_soon'      => $soon,
            'coming_soon_note' => trim((string)$r['course_note']),
            'quiz_count'    => (int)$r['quiz_count'],
            'total_secs'    => (int)$r['total_secs'],
            'completed'     => $done,
            'progress'      => $lessons > 0 ? (int)round($done * 100 / $lessons) : 0,
            'access_type'   => $r['access_type'],
            'amount'        => (float)$r['amount'],
            'source'        => $r['source'],
            'expiry_date'   => $r['expiry_date'],
            'expired'       => $expired,
            'state'         => $expired ? 'expired' : (($r['access_type'] === 'free') ? 'free' : 'purchased'),
            'enrolled_at'   => $r['enrolled_at'],
            'last_activity' => $r['last_activity'],
        ];
    }
    return $rows;
}

/**
 * Everything they have bought whose batch has NOT started yet.
 *
 * learn_sync_entitlements() deliberately withholds access until the batch
 * begins, which left those purchases invisible: a learner who had paid for
 * six internships saw an empty portal and no explanation. This is the other
 * half of that rule — the same purchases, listed with the date they open.
 *
 * The batch is prose ("24th August, 2026"), so STR_TO_DATE with %D does the
 * parsing here exactly as it does there. A row whose batch cannot be read is
 * NOT listed: it is already being granted access by the sync (which fails
 * open), so announcing it as "upcoming" would contradict the course sitting
 * right above it.
 */
function learn_upcoming_batches($conn, $uid) {
    $uid = (int)$uid;

    /* ── 1. everything they have paid for, whatever the source ────────── */
    $bought = [];   // lowercased name => ['name' =>, 'batch' =>]
    $add = function ($name, $batch) use (&$bought) {
        $name = trim((string)$name);
        if ($name === '') return;
        $key = mb_strtolower($name);
        /* Same product recorded twice: keep the EARLIEST batch, because that
           is the one they are actually waiting for. */
        if (isset($bought[$key])) {
            $old = strtotime(learn_batch_iso($bought[$key]['batch']) ?: '2999-01-01');
            $new = strtotime(learn_batch_iso($batch) ?: '2999-01-01');
            if ($old <= $new) return;
        }
        $bought[$key] = ['name' => $name, 'batch' => $batch];
    };

    $r = $conn->query("SELECT DISTINCT internship, batch FROM internship_payment WHERE user_id = $uid");
    while ($r && ($row = $r->fetch_assoc())) $add($row['internship'], $row['batch']);

    $r = $conn->query("SELECT DISTINCT internship_name, batch_date FROM payment_status
                        WHERE user_id = $uid AND status = 'success'");
    while ($r && ($row = $r->fetch_assoc())) $add($row['internship_name'], $row['batch_date']);

    foreach (learn_store_purchases($conn, $uid) as $buy) $add($buy['name'], $buy['batch']);

    if (!$bought) return [];

    /* ── 2. which of them have a published course behind them ─────────── */
    $names = implode(',', array_map(
        fn($k) => "'" . learn_esc($conn, $k) . "'", array_keys($bought)
    ));
    $art = [];
    $cr = $conn->query("SELECT internship_name, title, thumbnail_url, status
                          FROM lms_courses WHERE LOWER(internship_name) IN ($names)");
    while ($cr && ($c = $cr->fetch_assoc())) $art[mb_strtolower($c['internship_name'])] = $c;

    /* ── 3. anything they cannot open yet, and WHY ────────────────────── */
    $out = [];
    foreach ($bought as $key => $b) {
        $course  = $art[$key] ?? null;
        $live    = $course && $course['status'] === 'published';
        $started = learn_batch_started($b['batch']);

        /* Published course + started batch = already enrolled by the sync, so
           it is a real course on the page above and does not belong here. */
        if ($live && $started) continue;

        /* Two different waits, and conflating them is what made this
           confusing: one is "your batch has not begun", the other is "we have
           not built it yet". A learner told the wrong one goes looking for a
           button that will not appear. */
        $reason = !$started ? 'batch' : 'course';
        $iso    = learn_batch_iso($b['batch']);

        $out[] = [
            'name'          => $b['name'],
            'batch'         => $b['batch'],
            'reason'        => $reason,
            'starts_on'     => $iso,
            'days_to_go'    => $iso
                ? max(0, (int)ceil((strtotime($iso) - strtotime(date('Y-m-d'))) / 86400))
                : null,
            'thumbnail_url' => $course['thumbnail_url'] ?? '',
            'has_course'    => (bool)$course,
        ];
    }

    /* Dated items first, soonest at the top; the undated "being prepared"
       ones sit after them. */
    usort($out, function ($a, $b) {
        if ($a['reason'] !== $b['reason']) return $a['reason'] === 'batch' ? -1 : 1;
        return strcmp((string)$a['starts_on'], (string)$b['starts_on']);
    });
    return $out;
}

/* ───────────────────────────── /learn home ────────────────────────────── */
if ($action === 'home') {
    $rows = learn_enrollment_rows($conn, $uid);

    /* "Continue Learning" = whatever they touched last, else the newest
       non-expired enrolment, else simply the newest thing they own. */
    $continue = null;
    foreach ($rows as $r) { if (!$r['expired']) { $continue = $r; break; } }
    if (!$continue && $rows) $continue = $rows[0];

    learn_ok([
        'continue'    => $continue,
        'total'       => count($rows),
        'active'      => count(array_filter($rows, fn($r) => !$r['expired'])),
        'enrollments' => array_slice($rows, 0, 6),
        'upcoming'    => learn_upcoming_batches($conn, $uid),
    ]);
}

/* ─────────────────────────── my enrollments ───────────────────────────── */
if ($action === 'enrollments') {
    learn_ok([
        'enrollments' => learn_enrollment_rows($conn, $uid),
        'upcoming'    => learn_upcoming_batches($conn, $uid),
    ]);
}

/* ───────────────────────── one course, in full ────────────────────────── */
if ($action === 'course') {
    $slug = trim((string)($_GET['slug'] ?? ''));
    $cid  = (int)($_GET['course_id'] ?? 0);
    if (!$slug && !$cid) learn_error('A course slug or id is required');

    learn_soon_columns($conn);

    $where = $cid ? "c.id = $cid" : "c.slug = '" . learn_esc($conn, $slug) . "'";
    /* is_enabled is NOT filtered here. A switched-off course still opens for
       someone enrolled in it — every lesson inside simply reads as coming
       soon, which is what $courseSoon below folds it into. */
    $res = $conn->query("SELECT c.*, e.id enrollment_id, e.access_type, e.expiry_date, e.status enrollment_status
                         FROM lms_courses c
                         JOIN lms_enrollments e ON e.course_id = c.id AND e.user_id = " . (int)$uid . "
                         WHERE $where AND c.status = 'published' LIMIT 1");
    $c = $res ? $res->fetch_assoc() : null;
    if (!$c) learn_error('You are not enrolled in that course', 403);

    $expired = $c['expiry_date'] && $c['expiry_date'] < date('Y-m-d');
    if ($expired || $c['enrollment_status'] === 'revoked') {
        learn_ok([
            'course'  => [
                'id' => (int)$c['id'], 'title' => $c['title'], 'slug' => $c['slug'],
                'thumbnail_url' => $c['thumbnail_url'], 'expiry_date' => $c['expiry_date'],
            ],
            'expired' => true,
            'sections' => [],
        ], 'Your access to this course has ended.');
    }

    $cidReal = (int)$c['id'];

    /* progress first, so each lesson can be stamped without an N+1.

       The extra watch columns only exist once either this portal or the admin
       API has migrated lms_progress (see learn_watch_columns), so they are
       selected only when they are really there — an unconditional SELECT of a
       missing column takes the whole course payload down with it. */
    $cols = learn_watch_columns($conn);
    $extra = '';
    if (isset($cols['last_position_secs'])) $extra .= ', last_position_secs';
    if (isset($cols['duration_secs']))      $extra .= ', duration_secs prog_duration';
    if (isset($cols['watch_time_secs']))    $extra .= ', watch_time_secs';

    $prog = [];
    $lastLesson = 0;                       // most recently touched → what resume opens
    $pr = $conn->query("SELECT lesson_id, status, watched_secs, updated_at$extra
                        FROM lms_progress
                        WHERE user_id = " . (int)$uid . " AND course_id = $cidReal
                        ORDER BY updated_at ASC");
    while ($pr && ($p = $pr->fetch_assoc())) {
        $lid = (int)$p['lesson_id'];
        $prog[$lid] = [
            'status'        => $p['status'],
            'watched_secs'  => (int)$p['watched_secs'],
            /* Where the playhead was, which is not the same as the furthest
               point reached — see progress.php. Older rows have neither, so
               the furthest point is the fallback. */
            'resume_secs'   => (int)($p['last_position_secs'] ?? 0) ?: (int)$p['watched_secs'],
            'duration_secs' => (int)($p['prog_duration'] ?? 0),
            'watch_secs'    => (int)($p['watch_time_secs'] ?? 0),
            'last_seen'     => $p['updated_at'],
        ];
        /* Ordered oldest-first above, so the last row to be seen is the
           newest — including rows for lessons that have since been hidden,
           which are dropped when the flat list is built below. */
        $lastLesson = $lid;
    }

    /* attachments, likewise batched */
    $atts = [];
    $ar = $conn->query("SELECT a.lesson_id, a.id, a.title, a.file_url, a.file_name, a.file_type, a.file_size, a.kind
                        FROM lms_lesson_attachments a
                        JOIN lms_lessons l ON l.id = a.lesson_id
                        WHERE l.course_id = $cidReal AND a.status = 'active'
                        ORDER BY a.sort_order, a.id");
    while ($ar && ($a = $ar->fetch_assoc())) {
        $atts[(int)$a['lesson_id']][] = [
            'id' => (int)$a['id'], 'title' => $a['title'], 'url' => $a['file_url'],
            'file_name' => $a['file_name'], 'file_type' => $a['file_type'],
            'file_size' => (int)$a['file_size'], 'kind' => $a['kind'],
        ];
    }

    /* ── coming soon ───────────────────────────────────────────────────────
       A course, a module or a lesson can be marked "coming soon" in the admin
       panel, and the three cascade downwards: a coming-soon course makes every
       module and lesson in it coming soon, and clearing a lesson's own flag
       cannot escape either.

       It is NOT the same as hiding: the row stays in the syllabus on purpose —
       the point is to show a learner what is being built — but it does not
       open, does not count towards their progress, and is never what "resume"
       lands on.

       lms_courses.is_enabled is folded in above as a fourth source of the same
       state: switching a course off puts the identical Coming-soon face on it,
       so the two admin switches never disagree on screen.

       The columns themselves are guaranteed by learn_soon_columns() just
       above: SELECTing a column that does not exist is a fatal error, not a
       NULL, so COALESCE alone could not have covered an LMS database that
       predates them. The COALESCE that remains is for the note, which is
       genuinely nullable. */
    learn_soon_columns($conn);

    /* The course's own flag, which cascades over every module and lesson in
       it. Three levels now carry the same pair — course, module, lesson — and
       a reader has to take the strongest of the three, because clearing a
       lesson's own flag must not let it escape a coming-soon course. */
    /* Switched off counts as coming soon, so the two admin switches produce
       one consistent face for the learner. */
    $courseSoon = (int)($c['is_coming_soon'] ?? 0) === 1
                  || (int)($c['is_enabled'] ?? 1) !== 1;
    $courseNote = trim((string)($c['coming_soon_note'] ?? ''));

    $sectionSoon = [];
    $sections = [];
    $sr = $conn->query("SELECT id, title, description, sort_order,
                               COALESCE(is_coming_soon, 0) is_coming_soon,
                               COALESCE(coming_soon_note, '') coming_soon_note
                        FROM lms_sections
                        WHERE course_id = $cidReal AND status = 'active'
                        ORDER BY sort_order, id");
    while ($sr && ($s = $sr->fetch_assoc())) {
        $sid  = (int)$s['id'];
        $soon = $courseSoon || (int)$s['is_coming_soon'] === 1;
        /* The most specific note wins — a module can say something a whole
           course cannot, and an empty module note falls through to the
           course's rather than blanking the line. */
        $sNote = trim((string)$s['coming_soon_note']) !== '' ? trim((string)$s['coming_soon_note']) : $courseNote;
        $sectionSoon[$sid] = ['soon' => $soon, 'note' => $sNote];
        $sections[$sid] = [
            'id' => $sid, 'title' => $s['title'], 'description' => $s['description'],
            'coming_soon'      => $soon,
            'coming_soon_note' => $sNote,
            'lessons' => [], 'lesson_count' => 0, 'quiz_count' => 0, 'attachment_count' => 0,
            'coming_soon_count' => 0,
        ];
    }

    $lr = $conn->query("SELECT id, section_id, title, lesson_type, video_provider, video_url,
                               duration_secs, content, quiz_id, is_free_preview, sort_order,
                               COALESCE(is_coming_soon, 0) is_coming_soon,
                               COALESCE(coming_soon_note, '') coming_soon_note
                        FROM lms_lessons
                        WHERE course_id = $cidReal AND is_hidden = 0 AND status = 'published'
                        ORDER BY sort_order, id");
    $flat = [];
    while ($lr && ($l = $lr->fetch_assoc())) {
        $lid   = (int)$l['id'];
        $video = learn_video_source($l['video_url'], $l['video_provider']);
        /* The module's flag wins: marking a module coming soon has to lock
           everything in it without touching eighteen lesson rows one at a
           time. The lesson's own note is preferred when it has one, so a
           lesson can say something more specific than its module. */
        $secSoon  = $sectionSoon[(int)$l['section_id']] ?? ['soon' => $courseSoon, 'note' => $courseNote];
        $soon     = $courseSoon || $secSoon['soon'] || (int)$l['is_coming_soon'] === 1;
        $soonNote = (string)$l['coming_soon_note'] !== '' ? (string)$l['coming_soon_note'] : $secSoon['note'];
        $item  = [
            'id'           => $lid,
            'section_id'   => (int)$l['section_id'],
            'title'        => $l['title'],
            'type'         => $l['lesson_type'],
            'duration'     => (int)$l['duration_secs'],
            'quiz_id'      => (int)$l['quiz_id'],
            'free_preview' => (int)$l['is_free_preview'] === 1,
            'coming_soon'      => $soon,
            'coming_soon_note' => $soonNote,
            'video'        => $video,
            /* Article/PDF bodies are small; sending them with the syllabus lets
               the player switch lessons without a second round trip. */
            'content'      => in_array($l['lesson_type'], ['article', 'pdf'], true) ? $l['content'] : null,
            'attachments'  => $atts[$lid] ?? [],
            'status'       => $prog[$lid]['status'] ?? null,
            'watched_secs' => $prog[$lid]['watched_secs'] ?? 0,
            /* What the player seeks to, how long the video really is (the
               player's own figure when the admin left duration at 0) and how
               much of it has genuinely been watched. */
            'resume_secs'  => $prog[$lid]['resume_secs'] ?? 0,
            'watch_secs'   => $prog[$lid]['watch_secs'] ?? 0,
            'last_seen'    => $prog[$lid]['last_seen'] ?? null,
        ];
        /* The hand-typed duration is often 0; the player's measured one is
           not, and every "12:30 / 41:02" on the learner's side depends on it. */
        if (!$item['duration'] && !empty($prog[$lid]['duration_secs'])) {
            $item['duration'] = (int)$prog[$lid]['duration_secs'];
        }
        $flat[] = $item;

        $sid = (int)$l['section_id'];
        if (isset($sections[$sid])) {
            $sections[$sid]['lessons'][]      = $item;
            $sections[$sid]['lesson_count']  += 1;
            $sections[$sid]['quiz_count']    += ($l['lesson_type'] === 'quiz' ? 1 : 0);
            $sections[$sid]['attachment_count'] += count($item['attachments']);
            $sections[$sid]['coming_soon_count'] += ($soon ? 1 : 0);
        }
    }

    /* Everything below counts against the lessons a learner can actually
       open. A coming-soon lesson is in $flat — the syllabus has to render it
       — but it is not something they have failed to finish, and letting it
       into the denominator means a course can never reach 100%. */
    $open      = array_values(array_filter($flat, fn($l) => !$l['coming_soon']));
    $doneCount = count(array_filter($open, fn($l) => $l['status'] === 'completed'));

    /* Where to open. The lesson they were last on wins outright — a learner
       coming back wants the video they stopped, not lesson one of section one
       every single time. Only if they have never played anything does this
       fall back to the first unfinished lesson, and then to the first lesson.

       A hidden or unpublished lesson can still hold the newest progress row,
       so the pick is validated against the list actually being sent. */
    $ids      = array_column($open, 'id');
    $resumeId = in_array($lastLesson, $ids, true) ? $lastLesson : 0;

    /* One exception: if they FINISHED that lesson, they are not in the middle
       of it — they are at the start of the next one. Someone who watched a
       video to the end and came back tomorrow wants what follows, not the
       credits they already sat through. */
    if ($resumeId) {
        $at = array_search($resumeId, $ids, true);
        if ($at !== false && $open[$at]['status'] === 'completed') {
            for ($i = $at + 1; $i < count($open); $i++) {
                if ($open[$i]['status'] !== 'completed') { $resumeId = $open[$i]['id']; break; }
            }
        }
    }

    if (!$resumeId) {
        foreach ($open as $l) { if ($l['status'] !== 'completed') { $resumeId = $l['id']; break; } }
    }
    /* Last resort is the first OPEN lesson, never lesson one when lesson one
       is locked — that would drop the learner on a wall on their first visit. */
    if (!$resumeId && $open) $resumeId = $open[0]['id'];

    learn_ok([
        'course' => [
            'id'            => $cidReal,
            'title'         => $c['title'],
            'slug'          => $c['slug'],
            'subtitle'      => $c['subtitle'],
            'description'   => $c['description'],
            'thumbnail_url' => $c['thumbnail_url'],
            'instructor'    => $c['instructor'],
            'expiry_date'   => $c['expiry_date'],
            'access_type'   => $c['access_type'],
        ],
        'expired'   => false,
        'sections'  => array_values($sections),
        'lessons'   => $flat,
        'resume'    => [
            'lesson_id' => $resumeId,
            'seconds'   => $resumeId && isset($prog[$resumeId]) ? (int)$prog[$resumeId]['resume_secs'] : 0,
            /* False on a course that has never been opened, so the player can
               tell "carry on" apart from "start here". */
            'started'   => $lastLesson > 0,
        ],
        'progress'  => [
            'total'      => count($open),
            'completed'  => $doneCount,
            'percent'    => count($open) ? (int)round($doneCount * 100 / count($open)) : 0,
            /* Reported separately so the rail can say "3 coming soon" rather
               than quietly leaving them out of every count. */
            'coming_soon' => count($flat) - count($open),
            /* Real viewing time across the whole course, and the length of it,
               for the "1h 12m of 4h 30m watched" line. */
            'watch_secs' => array_sum(array_column($open, 'watch_secs')),
            'total_secs' => array_sum(array_column($open, 'duration')),
        ],
    ]);
}

/* ──────────────────────────── a single lesson ─────────────────────────── */
if ($action === 'lesson') {
    $lid = (int)($_GET['id'] ?? 0);
    if (!$lid) learn_error('A lesson id is required');
    learn_soon_columns($conn);

    $res = $conn->query("SELECT l.*, c.title course_title, c.slug course_slug, e.expiry_date,
                                GREATEST(COALESCE(l.is_coming_soon, 0),
                                         COALESCE(s.is_coming_soon, 0),
                                         COALESCE(c.is_coming_soon, 0),
                                         1 - COALESCE(c.is_enabled, 1)) coming_soon,
                                COALESCE(NULLIF(l.coming_soon_note, ''),
                                         NULLIF(s.coming_soon_note, ''),
                                         COALESCE(c.coming_soon_note, '')) coming_soon_note
                         FROM lms_lessons l
                         LEFT JOIN lms_sections s ON s.id = l.section_id
                         JOIN lms_courses c     ON c.id = l.course_id
                         JOIN lms_enrollments e ON e.course_id = l.course_id AND e.user_id = " . (int)$uid . "
                         WHERE l.id = $lid AND l.is_hidden = 0 AND l.status = 'published'
                           AND e.status = 'active' LIMIT 1");
    $l = $res ? $res->fetch_assoc() : null;
    if (!$l) learn_error('That lesson is not available on your account', 403);
    if ($l['expiry_date'] && $l['expiry_date'] < date('Y-m-d')) learn_error('Your access to this course has ended', 403);

    learn_ok(['lesson' => [
        'id'       => (int)$l['id'],
        'title'    => $l['title'],
        'type'     => $l['lesson_type'],
        'duration' => (int)$l['duration_secs'],
        'content'  => $l['content'],
        'quiz_id'  => (int)$l['quiz_id'],
        'coming_soon'      => (int)$l['coming_soon'] === 1,
        'coming_soon_note' => (string)$l['coming_soon_note'],
        'video'    => learn_video_source($l['video_url'], $l['video_provider']),
        'course'   => ['id' => (int)$l['course_id'], 'title' => $l['course_title'], 'slug' => $l['course_slug']],
    ]]);
}

/* ─────────────────────── the course-analytics screen ──────────────────── */
if ($action === 'analytics') {
    $cid = (int)($_GET['course_id'] ?? 0);
    if (!$cid) learn_error('A course id is required');

    $chk = $conn->query("SELECT c.id, c.title, c.slug FROM lms_courses c
                         JOIN lms_enrollments e ON e.course_id = c.id AND e.user_id = " . (int)$uid . "
                         WHERE c.id = $cid LIMIT 1");
    $c = $chk ? $chk->fetch_assoc() : null;
    if (!$c) learn_error('You are not enrolled in that course', 403);

    $row = fn($sql) => (($r = $conn->query($sql)) ? $r->fetch_assoc() : []) ?: [];

    $lessons = $row("SELECT
        SUM(lesson_type = 'video') videos,
        SUM(lesson_type = 'quiz')  quizzes,
        SUM(lesson_type = 'form')  assignments
        FROM lms_lessons WHERE course_id = $cid AND is_hidden = 0 AND status = 'published'");

    $done = $row("SELECT
        SUM(l.lesson_type = 'video') videos,
        SUM(l.lesson_type = 'quiz')  quizzes,
        SUM(l.lesson_type = 'form')  assignments
        FROM lms_progress p JOIN lms_lessons l ON l.id = p.lesson_id
        WHERE p.user_id = " . (int)$uid . " AND p.course_id = $cid AND p.status = 'completed'");

    $quiz = $row("SELECT COUNT(*) attempts, AVG(a.percentage) avg_pct,
                         SUM(a.score) score, SUM(a.total_marks) total
                  FROM lms_quiz_attempts a
                  JOIN lms_quizzes q ON q.id = a.quiz_id
                  WHERE a.user_id = " . (int)$uid . " AND q.course_id = $cid");

    /* Time on this course, from the portal's own page-view tracking. */
    $time = $row("SELECT COALESCE(SUM(seconds),0) secs FROM lms_learner_page_views
                  WHERE user_id = " . (int)$uid . " AND course_id = $cid");

    $pct = fn($d, $t) => $t > 0 ? (int)round($d * 100 / $t) : null;

    learn_ok([
        'course'  => ['id' => (int)$c['id'], 'title' => $c['title'], 'slug' => $c['slug']],
        'lessons' => [
            'total' => (int)($lessons['videos'] ?? 0), 'done' => (int)($done['videos'] ?? 0),
            'percent' => $pct((int)($done['videos'] ?? 0), (int)($lessons['videos'] ?? 0)),
        ],
        'assignments' => [
            'total' => (int)($lessons['assignments'] ?? 0), 'done' => (int)($done['assignments'] ?? 0),
            'percent' => $pct((int)($done['assignments'] ?? 0), (int)($lessons['assignments'] ?? 0)),
        ],
        'quizzes' => [
            'total' => (int)($lessons['quizzes'] ?? 0), 'done' => (int)($done['quizzes'] ?? 0),
            'percent' => $pct((int)($done['quizzes'] ?? 0), (int)($lessons['quizzes'] ?? 0)),
            'attempts' => (int)($quiz['attempts'] ?? 0),
            'score' => $quiz['score'] === null ? null : (float)$quiz['score'],
            'total_marks' => $quiz['total'] === null ? null : (float)$quiz['total'],
            'accuracy' => $quiz['avg_pct'] === null ? null : round((float)$quiz['avg_pct'], 1),
        ],
        'time_spent_secs' => (int)($time['secs'] ?? 0),
    ]);
}

learn_error('Unknown catalog action: ' . $action, 404);
