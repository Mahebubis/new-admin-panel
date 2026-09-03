<?php
/**
 * progress.php — the learner writing back what they have done.
 * ---------------------------------------------------------------------------
 *   ?action=position   POST {lesson_id, seconds, duration, watched}
 *                            the playback heartbeat
 *   ?action=complete   POST {lesson_id, done}      the "Mark as complete" button
 *
 * Both write to lms_progress, the same table the admin panel's reports read,
 * so a learner ticking a lesson here moves the admin course-progress report.
 * Every write re-checks the enrolment: a revoked or expired course can no
 * longer record progress even if the tab was left open.
 *
 * What a heartbeat carries, and why it is three numbers rather than one
 *   seconds   where the playhead is right now. Stored as last_position_secs,
 *             and it is what "Resume" seeks to — the furthest point is the
 *             wrong answer for someone who deliberately scrubbed back.
 *   duration  the length the PLAYER reports. lms_lessons.duration_secs is
 *             typed in by hand and is very often left at 0, which used to make
 *             every percentage on the learner's side a divide by zero.
 *   watched   seconds genuinely played since the last heartbeat, summed by the
 *             player from the gaps between timeupdate ticks. Scrubbing adds
 *             nothing to it, so watch_time_secs is real viewing time and can
 *             be trusted against the duration.
 *
 * A lesson also auto-completes here, at 95% of its duration, because the
 * `ended` event never arrives for a learner who closes the tab on the outro.
 *
 * ── why the writes are built column by column ────────────────────────────
 * lms_progress started life with four columns; the watch-time columns were
 * added later by whichever side reached the database first (see
 * learn_watch_columns in _bootstrap.php). That migration is best-effort: on a
 * database whose user cannot ALTER, some of those columns are simply not
 * there.
 *
 * This file used to write ONE statement naming all of them, guarded by
 * `if ($cols)` — which is true as soon as the TABLE exists, not once the
 * COLUMNS do. On a half-migrated database every heartbeat and every "Mark as
 * complete" therefore failed inside MySQL, the return value was never checked,
 * and the endpoint answered `success` regardless. That is the bug behind the
 * support tickets: the tick appeared, the ring moved, and the next page load
 * showed none of it, because nothing had ever been written. Quizzes kept
 * working because quiz.php only ever wrote the four original columns.
 *
 * So: the statement is now assembled from the columns that genuinely exist,
 * every query is checked, and a write that fails answers with an error instead
 * of a cheerful lie. The response also reports the row as it now stands in the
 * database rather than what we hoped to put there.
 *
 * ── and why it is UPDATE-then-INSERT ─────────────────────────────────────
 * The old statement was a single INSERT … ON DUPLICATE KEY UPDATE, which
 * silently degrades into "insert another duplicate row" if the table was
 * created without its UNIQUE (user_id, lesson_id) key. Looking the row up
 * first works with the key and without it, and the counting queries below
 * count DISTINCT lesson ids so a table that already collected duplicates
 * still reports an honest percentage.
 */

require_once __DIR__ . '/_bootstrap.php';

$uid    = learn_require_user();
$action = $_GET['action'] ?? '';
$in     = learn_input();

/** Resolves a lesson the learner may actually write against, or stops. */
function learn_writable_lesson($conn, $uid, $lessonId) {
    $lid = (int)$lessonId;
    if (!$lid) learn_error('A lesson id is required');

    $res = $conn->query("SELECT l.id, l.course_id, l.duration_secs,
                                e.expiry_date, e.status enrollment_status
                         FROM lms_lessons l
                         JOIN lms_enrollments e ON e.course_id = l.course_id AND e.user_id = " . (int)$uid . "
                         WHERE l.id = $lid AND l.is_hidden = 0 AND l.status = 'published' LIMIT 1");
    $l = $res ? $res->fetch_assoc() : null;
    if (!$l) learn_error('That lesson is not on your account', 403);

    /* The same two tests catalog.php applies when it decides whether to open
       the course at all. They used to disagree: this endpoint additionally
       demanded status === 'active', so a course sitting on the 'expired'
       status with a valid expiry date opened, played, and then refused every
       single write — silently, because a dropped heartbeat says nothing. If a
       learner can watch it, they can record having watched it. */
    if ($l['enrollment_status'] === 'revoked') learn_error('Your enrolment in this course has been revoked', 403);
    if ($l['expiry_date'] && $l['expiry_date'] < date('Y-m-d')) learn_error('Your access to this course has ended', 403);
    return $l;
}

/** The course-wide ring, handed back so the syllabus can move without a refetch. */
function learn_course_progress($conn, $uid, $cid) {
    /* COUNT(DISTINCT lesson_id): a table that lost its UNIQUE key can hold the
       same lesson twice, and a percentage over 100 is worse than a slow one. */
    $r = $conn->query("SELECT
            (SELECT COUNT(*) FROM lms_lessons
              WHERE course_id = $cid AND is_hidden = 0 AND status = 'published') total,
            (SELECT COUNT(DISTINCT lesson_id) FROM lms_progress
              WHERE course_id = $cid AND user_id = " . (int)$uid . " AND status = 'completed') done");
    $c = $r ? $r->fetch_assoc() : ['total' => 0, 'done' => 0];
    $total = (int)$c['total'];
    $done  = min((int)$c['done'], $total);
    return [
        'total'     => $total,
        'completed' => $done,
        'percent'   => $total > 0 ? (int)round($done * 100 / $total) : 0,
    ];
}

/** Runs one write, logging — and reporting — a failure instead of hiding it. */
function learn_progress_run($conn, $sql, $what) {
    if ($conn->query($sql)) return true;
    learn_log('PROGRESS', "$what failed: " . $conn->error . ' | ' . $sql);
    return false;
}

/** Does this learner already have a row for this lesson? */
function learn_progress_has_row($conn, $uid, $lid) {
    $r = $conn->query("SELECT id FROM lms_progress
                       WHERE user_id = " . (int)$uid . " AND lesson_id = " . (int)$lid . " LIMIT 1");
    return (bool)($r && $r->fetch_assoc());
}

/** The row as it actually stands, read back through whichever columns exist. */
function learn_progress_row($conn, $uid, $lid, $cols) {
    $sel = ['status', 'watched_secs'];
    foreach (['last_position_secs', 'duration_secs', 'watch_time_secs'] as $c) {
        if (isset($cols[$c])) $sel[] = $c;
    }
    $r = $conn->query('SELECT ' . implode(', ', $sel) . " FROM lms_progress
                       WHERE user_id = " . (int)$uid . " AND lesson_id = " . (int)$lid . " LIMIT 1");
    return ($r ? $r->fetch_assoc() : null) ?: null;
}

/* ── the playback heartbeat ───────────────────────────────────────────────
   Sent every ten seconds of playing, and again immediately on pause, on a
   lesson change and on the page going away, so nothing is lost when a learner
   simply closes the tab. */
if ($action === 'position') {
    $l    = learn_writable_lesson($conn, $uid, $in['lesson_id'] ?? 0);
    $cols = learn_watch_columns($conn);
    if (!$cols) learn_error('Progress cannot be recorded right now', 500);
    $has = fn($c) => isset($cols[$c]);

    $lessonDur = (int)$l['duration_secs'];
    /* The player's own figure wins over the hand-typed one when they disagree,
       but a wild number (a still-loading HLS manifest reports Infinity) is
       refused rather than stored: 24 hours is far past any lesson. */
    $reported = (int)($in['duration'] ?? 0);
    if ($reported < 0 || $reported > 86400) $reported = 0;
    $duration = max($lessonDur, $reported);

    $secs = max(0, (int)($in['seconds'] ?? 0));
    if ($duration > 0) $secs = min($secs, $duration);

    /* One heartbeat covers at most a few seconds of real watching. 600 leaves
       room for a late flush after a tab was backgrounded mid-video while still
       refusing a payload that claims hours. */
    $watched = min(600, max(0, (int)($in['watched'] ?? 0)));

    $cid = (int)$l['course_id'];
    $lid = (int)$l['id'];

    /* Auto-complete at 95%: `ended` never fires for someone who closes the tab
       during the outro, and a lesson stuck at "started" after they watched all
       of it is the single most confusing thing the syllabus can show. */
    $finished = $duration > 0 && $secs >= (int)floor($duration * 0.95);
    $status   = $finished ? 'completed' : 'started';
    /* A lesson already ticked off stays ticked off — a learner rewatching the
       first minute must not undo their own completion. */
    $keep     = $finished ? "'completed'" : "IF(status = 'completed', 'completed', 'started')";

    if (learn_progress_has_row($conn, $uid, $lid)) {
        $set = ["status = $keep", "watched_secs = GREATEST(watched_secs, $secs)"];
        if ($has('last_position_secs')) $set[] = "last_position_secs = $secs";
        if ($has('duration_secs'))      $set[] = "duration_secs = GREATEST(duration_secs, $duration)";
        if ($has('watch_time_secs'))    $set[] = "watch_time_secs = watch_time_secs + $watched";
        if ($has('first_played_at'))    $set[] = 'first_played_at = IFNULL(first_played_at, NOW())';
        if ($has('last_played_at'))     $set[] = 'last_played_at = NOW()';
        if ($has('completed_at'))       $set[] = "completed_at = IF($keep = 'completed', IFNULL(completed_at, NOW()), completed_at)";
        /* Explicit, because MySQL only touches an ON UPDATE timestamp when a
           value really changed — and catalog.php picks what "Resume" opens off
           the newest updated_at. */
        if ($has('updated_at'))         $set[] = 'updated_at = NOW()';

        $ok = learn_progress_run(
            $conn,
            'UPDATE lms_progress SET ' . implode(', ', $set)
                . " WHERE user_id = " . (int)$uid . " AND lesson_id = $lid",
            'position update'
        );
    } else {
        $col = ['user_id', 'course_id', 'lesson_id', 'status', 'watched_secs'];
        $val = [(int)$uid, $cid, $lid, "'$status'", $secs];
        $add = function ($name, $value) use (&$col, &$val, $has) {
            if ($has($name)) { $col[] = $name; $val[] = $value; }
        };
        $add('last_position_secs', $secs);
        $add('duration_secs', $duration);
        $add('watch_time_secs', $watched);
        $add('play_count', 1);
        $add('first_played_at', 'NOW()');
        $add('last_played_at', 'NOW()');
        $add('completed_at', $finished ? 'NOW()' : 'NULL');

        /* ON DUPLICATE KEY UPDATE only for the race where two heartbeats
           arrive at once — the row was absent a moment ago. */
        $ok = learn_progress_run(
            $conn,
            'INSERT INTO lms_progress (' . implode(', ', $col) . ') VALUES (' . implode(', ', $val) . ')'
                . " ON DUPLICATE KEY UPDATE status = $keep,"
                . " watched_secs = GREATEST(watched_secs, VALUES(watched_secs))",
            'position insert'
        );
    }

    if (!$ok) learn_error('We could not save your progress just now', 500);

    /* Read back rather than echo the input: watched_secs is a GREATEST() and
       watch_time_secs a running sum, so only the row knows the real totals —
       and only the row can prove the write landed. */
    $row = learn_progress_row($conn, $uid, $lid, $cols);

    learn_ok([
        'lesson_id'          => $lid,
        'status'             => $row['status'] ?? $status,
        'watched_secs'       => (int)($row['watched_secs'] ?? $secs),
        'last_position_secs' => (int)($row['last_position_secs'] ?? $secs),
        'duration_secs'      => (int)($row['duration_secs'] ?? $duration),
        'watch_time_secs'    => (int)($row['watch_time_secs'] ?? 0),
        /* Only when it just changed — the client repaints the ring off this. */
        'progress'           => ($row['status'] ?? $status) === 'completed'
            ? learn_course_progress($conn, $uid, $cid)
            : null,
    ]);
}

/* ── mark complete / undo ─────────────────────────────────────────────── */
if ($action === 'complete') {
    $l    = learn_writable_lesson($conn, $uid, $in['lesson_id'] ?? 0);
    $cols = learn_watch_columns($conn);
    if (!$cols) learn_error('Progress cannot be recorded right now', 500);
    $has  = fn($c) => isset($cols[$c]);
    $done = array_key_exists('done', $in) ? (bool)$in['done'] : true;

    $cid    = (int)$l['course_id'];
    $lid    = (int)$l['id'];
    $status = $done ? 'completed' : 'started';
    $secs   = (int)$l['duration_secs'] * ($done ? 1 : 0);

    if (learn_progress_has_row($conn, $uid, $lid)) {
        $set = ["status = '$status'", "watched_secs = GREATEST(watched_secs, $secs)"];
        if ($has('completed_at'))   $set[] = 'completed_at = ' . ($done ? 'IFNULL(completed_at, NOW())' : 'NULL');
        if ($has('last_played_at')) $set[] = 'last_played_at = NOW()';
        if ($has('updated_at'))     $set[] = 'updated_at = NOW()';

        $ok = learn_progress_run(
            $conn,
            'UPDATE lms_progress SET ' . implode(', ', $set)
                . " WHERE user_id = " . (int)$uid . " AND lesson_id = $lid",
            'complete update'
        );
    } else {
        $col = ['user_id', 'course_id', 'lesson_id', 'status', 'watched_secs'];
        $val = [(int)$uid, $cid, $lid, "'$status'", $secs];
        if ($has('completed_at'))   { $col[] = 'completed_at';   $val[] = $done ? 'NOW()' : 'NULL'; }
        if ($has('last_played_at')) { $col[] = 'last_played_at'; $val[] = 'NOW()'; }

        $ok = learn_progress_run(
            $conn,
            'INSERT INTO lms_progress (' . implode(', ', $col) . ') VALUES (' . implode(', ', $val) . ')'
                . " ON DUPLICATE KEY UPDATE status = '$status',"
                . ' watched_secs = GREATEST(watched_secs, VALUES(watched_secs))',
            'complete insert'
        );
    }

    if (!$ok) learn_error('We could not save that just now. Please try again.', 500);

    /* The stored status, not the requested one: the tick on screen must never
       claim something the database did not accept. */
    $row = learn_progress_row($conn, $uid, $lid, $cols);
    $saved = $row['status'] ?? $status;

    learn_ok([
        'lesson_id' => $lid,
        'status'    => $saved,
        'progress'  => learn_course_progress($conn, $uid, $cid),
    ], $saved === 'completed' ? 'Lesson marked complete' : 'Marked as not complete');
}

learn_error('Unknown progress action: ' . $action, 404);
