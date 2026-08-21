<?php
/**
 * progress.php — the learner writing back what they have done.
 * ---------------------------------------------------------------------------
 *   ?action=position   POST {lesson_id, seconds, duration, watched}
 *                            the playback heartbeat
 *   ?action=complete   POST {lesson_id, done}      the "Mark as complete" item
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
 */

require_once __DIR__ . '/_bootstrap.php';

$uid    = learn_require_user();
$action = $_GET['action'] ?? '';
$in     = learn_input();

/** Resolves a lesson the learner may actually write against, or stops. */
function learn_writable_lesson($conn, $uid, $lessonId) {
    $lid = (int)$lessonId;
    if (!$lid) learn_error('A lesson id is required');

    $res = $conn->query("SELECT l.id, l.course_id, l.duration_secs, e.expiry_date, e.status
                         FROM lms_lessons l
                         JOIN lms_enrollments e ON e.course_id = l.course_id AND e.user_id = " . (int)$uid . "
                         WHERE l.id = $lid AND l.is_hidden = 0 AND l.status = 'published' LIMIT 1");
    $l = $res ? $res->fetch_assoc() : null;
    if (!$l) learn_error('That lesson is not on your account', 403);
    if ($l['status'] !== 'active') learn_error('Your enrolment in this course is not active', 403);
    if ($l['expiry_date'] && $l['expiry_date'] < date('Y-m-d')) learn_error('Your access to this course has ended', 403);
    return $l;
}

/** The course-wide ring, handed back so the syllabus can move without a refetch. */
function learn_course_progress($conn, $uid, $cid) {
    $r = $conn->query("SELECT
            (SELECT COUNT(*) FROM lms_lessons
              WHERE course_id = $cid AND is_hidden = 0 AND status = 'published') total,
            (SELECT COUNT(*) FROM lms_progress
              WHERE course_id = $cid AND user_id = " . (int)$uid . " AND status = 'completed') done");
    $c = $r ? $r->fetch_assoc() : ['total' => 0, 'done' => 0];
    $total = (int)$c['total'];
    $done  = (int)$c['done'];
    return [
        'total'     => $total,
        'completed' => $done,
        'percent'   => $total > 0 ? (int)round($done * 100 / $total) : 0,
    ];
}

/* ── the playback heartbeat ───────────────────────────────────────────────
   Sent every ten seconds of playing, and again immediately on pause, on a
   lesson change and on the page going away, so nothing is lost when a learner
   simply closes the tab. */
if ($action === 'position') {
    $l    = learn_writable_lesson($conn, $uid, $in['lesson_id'] ?? 0);
    $cols = learn_watch_columns($conn);

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

    if ($cols) {
        /* A lesson already ticked off stays ticked off — a learner rewatching
           the first minute must not undo their own completion. */
        $keepStatus = $finished ? "'completed'" : "IF(status = 'completed', 'completed', 'started')";

        $conn->query("INSERT INTO lms_progress
                (user_id, course_id, lesson_id, status, watched_secs, last_position_secs,
                 duration_secs, watch_time_secs, play_count, first_played_at, last_played_at, completed_at)
              VALUES (" . (int)$uid . ", $cid, $lid, '$status',
                      $secs, $secs, $duration, $watched, 1, NOW(), NOW(), " . ($finished ? 'NOW()' : 'NULL') . ")
              ON DUPLICATE KEY UPDATE
                  watched_secs       = GREATEST(watched_secs, VALUES(watched_secs)),
                  last_position_secs = VALUES(last_position_secs),
                  duration_secs      = GREATEST(duration_secs, VALUES(duration_secs)),
                  watch_time_secs    = watch_time_secs + $watched,
                  last_played_at     = NOW(),
                  first_played_at    = IFNULL(first_played_at, NOW()),
                  completed_at       = IF($keepStatus = 'completed', IFNULL(completed_at, NOW()), completed_at),
                  status             = $keepStatus");
    } else {
        /* Neither the admin API nor this endpoint could add the columns — keep
           the original single-column behaviour rather than lose the position. */
        $conn->query("INSERT INTO lms_progress (user_id, course_id, lesson_id, status, watched_secs)
                      VALUES (" . (int)$uid . ", $cid, $lid, '$status', $secs)
                      ON DUPLICATE KEY UPDATE
                          watched_secs = GREATEST(watched_secs, VALUES(watched_secs)),
                          status       = IF(status = 'completed', 'completed', '$status')");
    }

    /* Read back rather than echo the input: watched_secs is a GREATEST() and
       watch_time_secs a running sum, so only the row knows the real totals. */
    $row = null;
    if ($cols) {
        $rr = $conn->query("SELECT status, watched_secs, last_position_secs, duration_secs, watch_time_secs
                            FROM lms_progress WHERE user_id = " . (int)$uid . " AND lesson_id = $lid LIMIT 1");
        $row = $rr ? $rr->fetch_assoc() : null;
    }

    learn_ok([
        'lesson_id'          => $lid,
        'status'             => $row['status'] ?? $status,
        'watched_secs'       => (int)($row['watched_secs'] ?? $secs),
        'last_position_secs' => (int)($row['last_position_secs'] ?? $secs),
        'duration_secs'      => (int)($row['duration_secs'] ?? $duration),
        'watch_time_secs'    => (int)($row['watch_time_secs'] ?? 0),
        /* Only when it just changed — the client repaints the ring off this. */
        'progress'           => $finished ? learn_course_progress($conn, $uid, $cid) : null,
    ]);
}

/* ── mark complete / undo ─────────────────────────────────────────────── */
if ($action === 'complete') {
    $l    = learn_writable_lesson($conn, $uid, $in['lesson_id'] ?? 0);
    $cols = learn_watch_columns($conn);
    $done = array_key_exists('done', $in) ? (bool)$in['done'] : true;

    $cid    = (int)$l['course_id'];
    $lid    = (int)$l['id'];
    $status = $done ? 'completed' : 'started';
    $secs   = (int)$l['duration_secs'] * ($done ? 1 : 0);

    if ($cols) {
        $conn->query("INSERT INTO lms_progress
                (user_id, course_id, lesson_id, status, watched_secs, completed_at, last_played_at)
              VALUES (" . (int)$uid . ", $cid, $lid, '$status', $secs,
                      " . ($done ? 'NOW()' : 'NULL') . ", NOW())
              ON DUPLICATE KEY UPDATE
                  status         = VALUES(status),
                  watched_secs   = GREATEST(watched_secs, VALUES(watched_secs)),
                  completed_at   = " . ($done ? 'IFNULL(completed_at, NOW())' : 'NULL') . ",
                  last_played_at = NOW()");
    } else {
        $conn->query("INSERT INTO lms_progress (user_id, course_id, lesson_id, status, watched_secs)
                      VALUES (" . (int)$uid . ", $cid, $lid, '$status', $secs)
                      ON DUPLICATE KEY UPDATE
                          status       = VALUES(status),
                          watched_secs = GREATEST(watched_secs, VALUES(watched_secs))");
    }

    learn_ok([
        'lesson_id' => $lid,
        'status'    => $status,
        'progress'  => learn_course_progress($conn, $uid, $cid),
    ], $done ? 'Lesson marked complete' : 'Marked as not complete');
}

learn_error('Unknown progress action: ' . $action, 404);
