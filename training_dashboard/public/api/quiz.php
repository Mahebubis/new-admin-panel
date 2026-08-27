<?php
/**
 * quiz.php — the learner half of the quiz system.
 * ---------------------------------------------------------------------------
 *   ?action=get&lesson_id=      GET   the quiz behind a lesson, ready to take
 *   ?action=submit              POST  grade an attempt and store it
 *   ?action=attempts&quiz_id=   GET   this learner's past attempts
 *
 * The admin panel has been able to build quizzes for a while; nothing could
 * take one. lms_quiz_attempts was read by the analytics screen and written by
 * nobody, which is why every learner saw "0 attempts".
 *
 * Two rules shape everything here:
 *
 *   1. Correct answers never leave the server before they are earned.
 *      `get` strips lms_quiz_questions.correct entirely. Grading happens in
 *      submit(), against the database, never against anything the client sent
 *      back. A quiz whose answers ship with the questions is a quiz that is
 *      already solved by anyone who opens devtools.
 *
 *   2. Access is the same rule as everywhere else in the portal — an active
 *      lms_enrollments row for the course the lesson belongs to.
 */

require_once __DIR__ . '/_bootstrap.php';

$uid    = learn_require_user();
$action = $_GET['action'] ?? '';
$in     = learn_input();

/**
 * The quiz behind a lesson, plus the guard that the learner may open it.
 * Returns [quiz, lesson_id, course_id] or ends the request.
 */
function quiz_load($conn, $uid, $lessonId) {
    $lessonId = (int)$lessonId;
    if (!$lessonId) learn_error('A lesson id is required');
    learn_soon_columns($conn);

    /* One query does the lookup AND the entitlement check, so there is no way
       to reach a quiz through a lesson the learner does not own. */
    /* GREATEST over both flags: a lesson is locked either by its own switch
       or by the module above it. learn_soon_columns() has already guaranteed
       the columns exist; the COALESCEs cover the LEFT JOIN missing. */
    $res = $conn->query("SELECT l.id lesson_id, l.course_id, l.quiz_id, l.title lesson_title,
                                e.expiry_date,
                                GREATEST(COALESCE(l.is_coming_soon, 0),
                                         COALESCE(s.is_coming_soon, 0)) coming_soon
                           FROM lms_lessons l
                           LEFT JOIN lms_sections s ON s.id = l.section_id
                           JOIN lms_enrollments e
                             ON e.course_id = l.course_id
                            AND e.user_id = " . (int)$uid . "
                            AND e.status = 'active'
                          WHERE l.id = $lessonId
                            AND l.is_hidden = 0
                            AND l.status = 'published'
                          LIMIT 1");
    $l = $res ? $res->fetch_assoc() : null;
    if (!$l) learn_error('That quiz is not available on your account', 403);
    if ($l['expiry_date'] && $l['expiry_date'] < date('Y-m-d')) {
        learn_error('Your access to this course has ended', 403);
    }
    /* The rail greys a coming-soon row out, but the URL is still typeable and
       an old bookmark still points here — the lock has to live server-side. */
    if ((int)$l['coming_soon'] === 1) learn_error('This quiz is not open yet', 403);

    $qid = (int)$l['quiz_id'];
    if (!$qid) learn_error('No quiz has been attached to this lesson yet', 404);

    $qr = $conn->query("SELECT * FROM lms_quizzes WHERE id = $qid AND status = 'published' LIMIT 1");
    $quiz = $qr ? $qr->fetch_assoc() : null;
    if (!$quiz) learn_error('This quiz has not been published yet', 404);

    return [$quiz, (int)$l['lesson_id'], (int)$l['course_id'], $l['lesson_title']];
}

/** How many attempts this learner has already spent on a quiz. */
function quiz_attempt_count($conn, $uid, $quizId) {
    $r = $conn->query("SELECT COUNT(*) c FROM lms_quiz_attempts
                        WHERE user_id = " . (int)$uid . " AND quiz_id = " . (int)$quizId);
    return $r ? (int)$r->fetch_assoc()['c'] : 0;
}

/* ─────────────────────────── take the quiz ─────────────────────────────── */
if ($action === 'get') {
    [$quiz, $lessonId, $courseId, $lessonTitle] = quiz_load($conn, $uid, $_GET['lesson_id'] ?? 0);

    $quizId   = (int)$quiz['id'];
    $spent    = quiz_attempt_count($conn, $uid, $quizId);
    $maxTries = (int)$quiz['max_attempts'];            // 0 = unlimited

    $questions = [];
    $qr = $conn->query("SELECT id, question_type, question, image_url, options, marks
                          FROM lms_quiz_questions
                         WHERE quiz_id = $quizId AND status = 'active'
                         ORDER BY sort_order ASC, id ASC");
    while ($qr && ($q = $qr->fetch_assoc())) {
        $opts = json_decode((string)$q['options'], true);
        if (!is_array($opts)) $opts = [];
        /* NOTE: `correct` is deliberately not selected above. */

        /* An option is { value, label, image? } — the image key is optional
           and only present when an admin attached one. Normalised here so the
           client never has to guess whether it is a string or an object. */
        $options = [];
        foreach (array_values($opts) as $i => $o) {
            if (is_array($o)) {
                $options[] = [
                    'value' => (string)($o['value'] ?? $o['label'] ?? $i),
                    'label' => (string)($o['label'] ?? $o['value'] ?? ''),
                    'image' => (string)($o['image'] ?? ''),
                ];
            } else {
                $options[] = ['value' => (string)$o, 'label' => (string)$o, 'image' => ''];
            }
        }

        $questions[] = [
            'id'       => (int)$q['id'],
            'type'     => $q['question_type'],
            'question' => $q['question'],
            'image'    => $q['image_url'],
            'options'  => $options,
            'marks'    => (float)$q['marks'],
        ];
    }

    /* Shuffling is per-request, so a re-take genuinely re-orders. */
    if (!empty($quiz['shuffle_questions'])) shuffle($questions);
    if (!empty($quiz['shuffle_options'])) {
        foreach ($questions as &$q) { if (count($q['options']) > 1) shuffle($q['options']); }
        unset($q);
    }

    learn_ok([
        'quiz' => [
            'id'              => $quizId,
            'title'           => $quiz['title'],
            'description'     => $quiz['description'],
            'instructions'    => $quiz['instructions'],
            'duration_mins'   => (int)$quiz['duration_mins'],
            'pass_percentage' => (int)$quiz['pass_percentage'],
            'max_attempts'    => $maxTries,
            'attempts_used'   => $spent,
            'attempts_left'   => $maxTries > 0 ? max(0, $maxTries - $spent) : null,
            'can_attempt'     => $maxTries === 0 || $spent < $maxTries,
            'show_answers'    => $quiz['show_answers'],
            'show_result'     => (int)$quiz['show_result'],
            'negative'        => (int)$quiz['negative_marking'],
            'total_marks'     => array_sum(array_column($questions, 'marks')),
        ],
        'lesson_id'    => $lessonId,
        'lesson_title' => $lessonTitle,
        'questions'    => $questions,
    ]);
}

/* ──────────────────────────── grade it ─────────────────────────────────── */
if ($action === 'submit') {
    [$quiz, $lessonId, $courseId] = quiz_load($conn, $uid, $in['lesson_id'] ?? 0);
    $quizId = (int)$quiz['id'];

    $maxTries = (int)$quiz['max_attempts'];
    $spent    = quiz_attempt_count($conn, $uid, $quizId);
    if ($maxTries > 0 && $spent >= $maxTries) {
        learn_error('You have used all ' . $maxTries . ' attempts for this quiz', 403);
    }

    $given = $in['answers'] ?? [];
    if (!is_array($given)) $given = [];

    /* Re-read the questions WITH their answers. The client's copy is only
       consulted for what the learner picked, never for what is right. */
    $rows = [];
    $qr = $conn->query("SELECT id, question_type, correct, marks
                          FROM lms_quiz_questions
                         WHERE quiz_id = $quizId AND status = 'active'");
    while ($qr && ($q = $qr->fetch_assoc())) $rows[(int)$q['id']] = $q;

    $negative   = !empty($quiz['negative_marking']);
    $score      = 0.0;
    $totalMarks = 0.0;
    $breakdown  = [];

    foreach ($rows as $qidKey => $q) {
        $marks       = (float)$q['marks'];
        $totalMarks += $marks;

        $correct = json_decode((string)$q['correct'], true);
        if (!is_array($correct)) $correct = $correct === null ? [] : [$correct];

        $answer = $given[$qidKey] ?? ($given[(string)$qidKey] ?? null);
        $picked = is_array($answer) ? $answer : ($answer === null || $answer === '' ? [] : [$answer]);

        /* Compare as trimmed, case-insensitive strings: a fill-in-the-blank
           answer typed with different capitalisation is still correct, and
           choice answers are stored as the option text itself. */
        $norm = fn($v) => mb_strtolower(trim((string)$v));
        $c = array_map($norm, $correct);
        $p = array_map($norm, $picked);
        sort($c); sort($p);

        $isRight = $c === $p && $c !== [];
        $answered = $p !== [];

        if ($isRight)                       $score += $marks;
        elseif ($negative && $answered)     $score -= $marks / 4;   // the usual 1/4 penalty

        $breakdown[] = [
            'question_id' => $qidKey,
            'correct'     => $isRight,
            'answered'    => $answered,
            'marks'       => $isRight ? $marks : ($negative && $answered ? -$marks / 4 : 0),
        ];
    }

    if ($score < 0) $score = 0;   // a negative total helps nobody
    $pct    = $totalMarks > 0 ? round($score * 100 / $totalMarks, 2) : 0;
    $passed = $pct >= (float)$quiz['pass_percentage'] ? 1 : 0;

    /* lms_quiz_attempts has no lesson_id column — the table is owned by the
       admin API and keyed on (quiz_id, user_id). The lesson is recoverable
       through lms_lessons.quiz_id, so nothing is lost by leaving it out. */
    $conn->query("INSERT INTO lms_quiz_attempts
            (quiz_id, course_id, user_id, answers, score, total_marks,
             percentage, passed, submitted_at)
        VALUES ($quizId, $courseId, " . (int)$uid . ",
                '" . learn_esc($conn, json_encode($given)) . "',
                $score, $totalMarks, $pct, $passed, NOW())");
    $attemptId = (int)$conn->insert_id;

    /* Passing a quiz completes its lesson, the same way finishing a video
       does — otherwise course progress would stall on every quiz. */
    if ($passed) {
        $conn->query("INSERT INTO lms_progress (user_id, course_id, lesson_id, status)
                      VALUES (" . (int)$uid . ", $courseId, $lessonId, 'completed')
                      ON DUPLICATE KEY UPDATE status = 'completed'");
    }

    $show = $quiz['show_answers'];
    $reveal = $show === 'after_submit' || ($show === 'after_pass' && $passed);

    learn_ok([
        'attempt_id'  => $attemptId,
        'score'       => (float)$score,
        'total_marks' => (float)$totalMarks,
        'percentage'  => (float)$pct,
        'passed'      => (bool)$passed,
        'pass_mark'   => (int)$quiz['pass_percentage'],
        'show_result' => (int)$quiz['show_result'],
        /* The right answers only travel back once the quiz's own rule allows
           it — and only after an attempt has been recorded. */
        'breakdown'   => $reveal ? $breakdown : [],
        'answers'     => $reveal ? array_map(function ($q) {
            $c = json_decode((string)$q['correct'], true);
            return is_array($c) ? $c : [$c];
        }, $rows) : [],
    ], $passed ? 'Passed' : 'Submitted');
}

/* ───────────────────────── past attempts ───────────────────────────────── */
if ($action === 'attempts') {
    $quizId = (int)($_GET['quiz_id'] ?? 0);
    if (!$quizId) learn_error('A quiz id is required');

    $rows = [];
    $r = $conn->query("SELECT id, score, total_marks, percentage, passed, submitted_at
                         FROM lms_quiz_attempts
                        WHERE user_id = " . (int)$uid . " AND quiz_id = $quizId
                        ORDER BY submitted_at DESC LIMIT 25");
    while ($r && ($a = $r->fetch_assoc())) {
        $rows[] = [
            'id'           => (int)$a['id'],
            'score'        => (float)$a['score'],
            'total_marks'  => (float)$a['total_marks'],
            'percentage'   => (float)$a['percentage'],
            'passed'       => (bool)$a['passed'],
            'submitted_at' => $a['submitted_at'],
        ];
    }
    learn_ok(['attempts' => $rows]);
}

learn_error('Unknown quiz action: ' . $action, 404);
