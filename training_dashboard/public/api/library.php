<?php
/**
 * library.php — the learner's own annotations: lesson notes (the Bookmarks
 * tab) and favourited courses.
 * ---------------------------------------------------------------------------
 *   ?action=notes        GET  &course_id= [&lesson_id=]
 *   ?action=note_add     POST {course_id, lesson_id, note}
 *   ?action=note_delete  POST {id}
 *   ?action=favourites   GET
 *   ?action=fav_toggle   POST {course_id}
 *
 * These are per-learner and worthless to anyone else, but they still live in
 * the database rather than localStorage: a learner who studies on a phone and
 * a laptop expects one set of notes, and losing them to a cleared browser is
 * exactly the kind of small betrayal that stops people taking notes at all.
 */

require_once __DIR__ . '/_bootstrap.php';

$uid    = learn_require_user();
$action = $_GET['action'] ?? '';
$in     = learn_input();

/* Both tables are portal-owned, so they are created here rather than in the
   admin API — same idempotent pattern as _bootstrap.php. */
$conn->query("CREATE TABLE IF NOT EXISTS lms_learner_notes (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT  NOT NULL,
    course_id  INT  NOT NULL,
    lesson_id  INT       DEFAULT 0,
    note       TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_course (user_id, course_id),
    INDEX idx_user_lesson (user_id, lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$conn->query("CREATE TABLE IF NOT EXISTS lms_learner_favourites (
    user_id    INT NOT NULL,
    course_id  INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

/** A learner may only annotate a course they are actually enrolled in. */
function learn_owns_course($conn, $uid, $courseId) {
    $cid = (int)$courseId;
    if (!$cid) return false;
    $r = $conn->query("SELECT 1 FROM lms_enrollments
                       WHERE user_id = " . (int)$uid . " AND course_id = $cid AND status <> 'revoked' LIMIT 1");
    return $r && $r->num_rows > 0;
}

/* ─────────────────────────────── notes ────────────────────────────────── */
if ($action === 'notes') {
    $cid = (int)($_GET['course_id'] ?? 0);
    $lid = (int)($_GET['lesson_id'] ?? 0);
    if (!learn_owns_course($conn, $uid, $cid)) learn_error('You are not enrolled in that course', 403);

    $extra = $lid ? " AND n.lesson_id = $lid" : '';
    $res = $conn->query("SELECT n.id, n.lesson_id, n.note, n.created_at, l.title lesson_title
                         FROM lms_learner_notes n
                         LEFT JOIN lms_lessons l ON l.id = n.lesson_id
                         WHERE n.user_id = " . (int)$uid . " AND n.course_id = $cid $extra
                         ORDER BY n.created_at DESC");
    $rows = [];
    while ($res && ($r = $res->fetch_assoc())) {
        $rows[] = [
            'id'           => (int)$r['id'],
            'lesson_id'    => (int)$r['lesson_id'],
            'lesson_title' => $r['lesson_title'],
            'note'         => $r['note'],
            'created_at'   => $r['created_at'],
        ];
    }
    learn_ok(['notes' => $rows]);
}

if ($action === 'note_add') {
    $cid  = (int)($in['course_id'] ?? 0);
    $lid  = (int)($in['lesson_id'] ?? 0);
    $note = trim((string)($in['note'] ?? ''));

    if (!learn_owns_course($conn, $uid, $cid)) learn_error('You are not enrolled in that course', 403);
    if ($note === '') learn_error('Write something before adding the note');
    if (mb_strlen($note) > 4000) learn_error('That note is too long — keep it under 4000 characters');

    $stmt = $conn->prepare("INSERT INTO lms_learner_notes (user_id, course_id, lesson_id, note) VALUES (?, ?, ?, ?)");
    if (!$stmt) learn_error('Could not save the note', 500);
    $stmt->bind_param('iiis', $uid, $cid, $lid, $note);
    if (!$stmt->execute()) { $stmt->close(); learn_error('Could not save the note', 500); }
    $id = (int)$stmt->insert_id;
    $stmt->close();

    learn_ok(['id' => $id, 'note' => $note, 'lesson_id' => $lid, 'created_at' => date('Y-m-d H:i:s')], 'Note added');
}

if ($action === 'note_delete') {
    $id = (int)($in['id'] ?? 0);
    if (!$id) learn_error('A note id is required');
    /* Scoped by user_id, so one learner can never delete another's note. */
    $conn->query("DELETE FROM lms_learner_notes WHERE id = $id AND user_id = " . (int)$uid);
    learn_ok([], 'Note removed');
}

/* ──────────────────────────── favourites ──────────────────────────────── */
if ($action === 'favourites') {
    $res = $conn->query("SELECT c.id course_id, c.title, c.slug, c.thumbnail_url,
                                (SELECT COUNT(*) FROM lms_lessons l
                                   WHERE l.course_id = c.id AND l.is_hidden = 0 AND l.status = 'published') lesson_count
                         FROM lms_learner_favourites f
                         JOIN lms_courses c ON c.id = f.course_id
                         WHERE f.user_id = " . (int)$uid . "
                         ORDER BY f.created_at DESC");
    $rows = [];
    while ($res && ($r = $res->fetch_assoc())) {
        $rows[] = [
            'course_id' => (int)$r['course_id'], 'title' => $r['title'], 'slug' => $r['slug'],
            'thumbnail_url' => $r['thumbnail_url'], 'lesson_count' => (int)$r['lesson_count'],
        ];
    }
    learn_ok(['favourites' => $rows]);
}

if ($action === 'fav_toggle') {
    $cid = (int)($in['course_id'] ?? 0);
    if (!learn_owns_course($conn, $uid, $cid)) learn_error('You are not enrolled in that course', 403);

    $r = $conn->query("SELECT 1 FROM lms_learner_favourites
                       WHERE user_id = " . (int)$uid . " AND course_id = $cid LIMIT 1");
    if ($r && $r->num_rows) {
        $conn->query("DELETE FROM lms_learner_favourites WHERE user_id = " . (int)$uid . " AND course_id = $cid");
        learn_ok(['favourite' => false], 'Removed from favourites');
    }
    $conn->query("INSERT IGNORE INTO lms_learner_favourites (user_id, course_id) VALUES (" . (int)$uid . ", $cid)");
    learn_ok(['favourite' => true], 'Added to favourites');
}

learn_error('Unknown library action: ' . $action, 404);
