<?php
/**
 * feedback.php — the learner's review of a course.
 * ---------------------------------------------------------------------------
 *   ?action=get   GET  &course_id=
 *                 → { feedback: {rating, review, answers, updated_at} | null,
 *                     questions: [{key, text}], labels: {1..5} }
 *   ?action=save  POST { course_id, rating?, review?, answers?, lesson_id?, progress? }
 *                 Upsert — one row per learner per course. The two steps of
 *                 the form (stars + why, then the six quick questions) save
 *                 independently, so a learner who stops after the stars still
 *                 leaves a rating. A field left out keeps what was stored.
 *
 * Read by the admin panel: react-api/api/lms/lms_api.php, resource=reports,
 * action=course_feedback. Table DDL: learn_insight_install() in _bootstrap.
 */

require_once __DIR__ . '/_bootstrap.php';

$uid    = learn_require_user();
$action = $_GET['action'] ?? '';
$in     = learn_input();

learn_insight_install($conn);

/* Kept in step with LEARN_FEEDBACK_QUESTIONS in the admin API, so a report
   can print the question next to its answers. */
const LEARN_FEEDBACK_QUESTIONS = [
    ['key' => 'valuable',      'text' => 'Are you learning valuable information?'],
    ['key' => 'clear',         'text' => 'Are the explanations of concepts clear?'],
    ['key' => 'engaging',      'text' => "Is the instructor's delivery engaging?"],
    ['key' => 'practice',      'text' => 'Are there enough opportunities to apply what you are learning?'],
    ['key' => 'expectations',  'text' => 'Is the course delivering on your expectations?'],
    ['key' => 'knowledgeable', 'text' => 'Is the instructor knowledgeable about the topic?'],
];
const LEARN_FEEDBACK_LABELS = [
    1 => 'Awful, not what I expected at all',
    2 => 'Poor, pretty disappointed',
    3 => 'Average, could be better',
    4 => 'Good, what I expected',
    5 => 'Amazing, above expectations!',
];

function learn_feedback_enrolled($conn, $uid, $cid) {
    if (!$cid) return false;
    $r = $conn->query("SELECT 1 FROM lms_enrollments
                       WHERE user_id = " . (int)$uid . " AND course_id = " . (int)$cid . "
                         AND status <> 'revoked' LIMIT 1");
    return $r && $r->num_rows > 0;
}

function learn_feedback_row($conn, $uid, $cid) {
    $r = $conn->query("SELECT rating, review, answers, created_at, updated_at FROM lms_course_feedback
                       WHERE user_id = " . (int)$uid . " AND course_id = " . (int)$cid . " LIMIT 1");
    $row = $r ? $r->fetch_assoc() : null;
    if (!$row) return null;
    $answers = json_decode((string)$row['answers'], true);
    return [
        'rating'     => (int)$row['rating'],
        'review'     => (string)$row['review'],
        'answers'    => is_array($answers) ? $answers : new stdClass(),
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
    ];
}

try {
    $cid = (int)($_GET['course_id'] ?? $in['course_id'] ?? 0);
    if (!learn_feedback_enrolled($conn, $uid, $cid)) learn_error('You are not enrolled in that course', 403);

    if ($action === 'get') {
        learn_ok([
            'feedback'  => learn_feedback_row($conn, $uid, $cid),
            'questions' => LEARN_FEEDBACK_QUESTIONS,
            'labels'    => LEARN_FEEDBACK_LABELS,
        ]);
    }

    if ($action === 'save') {
        $set = [];

        if (array_key_exists('rating', $in)) {
            $rating = (int)$in['rating'];
            if ($rating < 1 || $rating > 5) learn_error('Please choose between 1 and 5 stars');
            $set['rating'] = (string)$rating;
        }
        if (array_key_exists('review', $in)) {
            $review = trim((string)$in['review']);
            if (mb_strlen($review) > 3000) $review = mb_substr($review, 0, 3000);
            $set['review'] = "'" . learn_esc($conn, $review) . "'";
        }
        if (array_key_exists('answers', $in) && is_array($in['answers'])) {
            /* Only the known questions, only the three known answers. */
            $keys  = array_column(LEARN_FEEDBACK_QUESTIONS, 'key');
            $clean = [];
            foreach ($in['answers'] as $k => $v) {
                if (in_array($k, $keys, true) && in_array($v, ['yes', 'no', 'not_sure'], true)) $clean[$k] = $v;
            }
            $set['answers'] = "'" . learn_esc($conn, json_encode($clean)) . "'";
        }
        if (!$set) learn_error('Nothing to save');

        $progress = max(0, min(100, (int)($in['progress'] ?? 0)));
        $lid      = max(0, (int)($in['lesson_id'] ?? 0));

        $cols = ['user_id', 'course_id', 'progress', 'lesson_id', 'updated_at'];
        $vals = [(int)$uid, $cid, $progress, $lid, "'" . date('Y-m-d H:i:s') . "'"];
        $upd  = ['progress = VALUES(progress)', 'lesson_id = VALUES(lesson_id)', 'updated_at = VALUES(updated_at)'];
        foreach ($set as $c => $v) {
            $cols[] = $c;
            $vals[] = $v;
            $upd[]  = "$c = VALUES($c)";
        }
        $ok = $conn->query('INSERT INTO lms_course_feedback (' . implode(', ', $cols) . ')
                            VALUES (' . implode(', ', $vals) . ')
                            ON DUPLICATE KEY UPDATE ' . implode(', ', $upd));
        if (!$ok) learn_error('We could not save your feedback. Please try again.', 500);

        learn_ok(['feedback' => learn_feedback_row($conn, $uid, $cid)], 'Thanks for your feedback');
    }

    learn_error('Unknown feedback action: ' . $action, 404);
} catch (Throwable $t) {
    learn_log('FEEDBACK', $t->getMessage());
    learn_error('We could not save your feedback. Please try again.', 500);
}
