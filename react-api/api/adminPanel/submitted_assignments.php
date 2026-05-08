<?php
/*
 * /api/submitted-assignments.php
 *
 * Uses middleware/auth.php JWT pattern (same as all other APIs)
 *
 * POST action=get_domains          → internship_list with nested paths + courses
 * POST action=fetch_submissions    → keyword, start_date, end_date,
 *                                    domain_id, path_id, course_id,
 *                                    limit, offset
 * POST action=edit_submission      → submission_id, subtask_id
 * POST action=delete_submission    → submission_id
 *
 * KEY FIX: If axios sends Content-Type: application/json (common default),
 * PHP's $_POST is empty. We also try parse_str(php://input) as fallback.
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

/* ── Fix: populate $_POST from raw body if empty (handles JSON Content-Type) ── */
if (empty($_POST)) {
    $rawBody = file_get_contents('php://input');
    if ($rawBody) {
        /* Try URL-encoded body first (URLSearchParams) */
        parse_str($rawBody, $parsed);
        if (!empty($parsed)) {
            $_POST = $parsed;
        } else {
            /* Try JSON body */
            $json = json_decode($rawBody, true);
            if (is_array($json)) {
                $_POST = $json;
            }
        }
    }
}

/* ── Validate JWT (works for both GET and POST requests) ── */
$jwt = require_jwt();

/* ── Read action from GET params (get_domains via GET) OR POST body ── */
$action = $_GET['action'] ?? $_POST['action'] ?? '';

/* ── Detect profile image column (same logic as original PHP) ── */
$imageColumn = 'profile_image';
$colCheck    = $conn->query("SHOW COLUMNS FROM users");
if ($colCheck) {
    while ($c = $colCheck->fetch_assoc()) {
        if (in_array($c['Field'], ['profile_image', 'photo', 'image'])) {
            $imageColumn = $c['Field'];
            break;
        }
    }
}

/* ════════════════════════════════════════════════
   ACTION: get_domains
   Returns internship_list → paths → courses (nested)
   Used to populate the 3 cascading dropdowns.
   JS in original calls /api/get_domains.php — we merge it here.
════════════════════════════════════════════════ */
if ($action === 'get_domains') {

    /* All domains */
    $domRes  = $conn->query("
        SELECT id AS domain_id, internship_name AS domain_name
        FROM internship_list
        ORDER BY internship_name
    ");
    $domains = $domRes ? $domRes->fetch_all(MYSQLI_ASSOC) : [];

    /* For each domain → paths */
    foreach ($domains as &$dom) {
        $did     = (int)$dom['domain_id'];
        $pathRes = $conn->query("
            SELECT id AS path_id, title
            FROM internship_paths
            WHERE internship_id = $did
            ORDER BY title
        ");
        $paths = $pathRes ? $pathRes->fetch_all(MYSQLI_ASSOC) : [];

        /* For each path → courses */
        foreach ($paths as &$path) {
            $pid      = (int)$path['path_id'];
            $courseRes = $conn->query("
                SELECT course_id, course_title
                FROM assignment_courses
                WHERE internship_path_id = $pid
                ORDER BY course_title
            ");
            $path['courses'] = $courseRes ? $courseRes->fetch_all(MYSQLI_ASSOC) : [];
        }
        unset($path);
        $dom['paths'] = $paths;
    }
    unset($dom);

    api_success(['domains' => $domains]);
}

/* ════════════════════════════════════════════════
   ACTION: fetch_submissions
   Exact port of the PHP page's fetch_submissions block.
   NOTE: Original PHP had a bug — domain/path/course filters were
   applied to $where BEFORE $where = "WHERE 1" (so they were lost).
   Fixed here: $where = "WHERE 1" is set first.
════════════════════════════════════════════════ */
if ($action === 'fetch_submissions') {

    $limit    = max(1, min(100, (int)($_POST['limit']   ?? 10)));
    $offset   = max(0,          (int)($_POST['offset']  ?? 0));
    $email    = trim($_POST['keyword']    ?? '');
    $from     = trim($_POST['start_date'] ?? '');
    $to       = trim($_POST['end_date']   ?? '');
    $domainId = (int)($_POST['domain_id'] ?? 0);
    $pathId   = (int)($_POST['path_id']   ?? 0);
    $courseId = (int)($_POST['course_id'] ?? 0);

    /* Build WHERE — same logic as PHP, bug fixed */
    $where = 'WHERE 1';

    if ($email !== '') {
        $safe   = $conn->real_escape_string($email);
        $where .= " AND u.email LIKE '%$safe%'";
    }

    if ($from !== '' && $to === '') {
        $to     = date('Y-m-d');
        $where .= " AND DATE(s.submitted_at) BETWEEN '$from' AND '$to'";
    } elseif ($from !== '' && $to !== '') {
        $where .= " AND DATE(s.submitted_at) BETWEEN '$from' AND '$to'";
    }

    if ($domainId > 0) $where .= " AND d.id = $domainId";
    if ($pathId   > 0) $where .= " AND p.id = $pathId";
    if ($courseId > 0) $where .= " AND c.course_id = $courseId";

    /* Exact JOIN from PHP page */
    $joins = "
        FROM assignment_submissions s
        INNER JOIN users u ON u.user_id = s.user_id
        LEFT JOIN assignment_subtasks st ON st.subtask_id = s.subtask_id
        LEFT JOIN assignment_tasks    t  ON t.task_id     = st.task_id
        LEFT JOIN assignment_courses  c  ON c.course_id   = t.course_id
        LEFT JOIN internship_paths    p  ON p.id           = c.internship_path_id
        LEFT JOIN internship_list     d  ON d.id           = p.internship_id
    ";

    /* Main SELECT — exact columns from PHP page */
    $rows = [];
    $res  = $conn->query("
        SELECT
            s.submission_id,
            s.user_id,
            s.subtask_id,
            s.file_url,
            s.submitted_at,
            u.fname,
            u.lname,
            u.email,
            u.$imageColumn AS profile_image,
            d.id              AS domain_id,
            d.internship_name AS domain_name,
            p.id              AS path_id,
            p.title           AS path_title,
            c.course_id,
            c.course_title
        $joins
        $where
        ORDER BY s.submission_id DESC
        LIMIT $limit OFFSET $offset
    ");
    if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;

    /* Count */
    $total = 0;
    $cnt   = $conn->query("SELECT COUNT(*) AS total $joins $where");
    if ($cnt) $total = (int)$cnt->fetch_assoc()['total'];

    api_success(['data' => $rows, 'total' => $total]);
}

/* ════════════════════════════════════════════════
   ACTION: edit_submission
   Exact: UPDATE assignment_submissions SET subtask_id=... WHERE submission_id=...
════════════════════════════════════════════════ */
if ($action === 'edit_submission') {
    $id      = (int)($_POST['submission_id'] ?? 0);
    $subtask = $conn->real_escape_string(trim($_POST['subtask_id'] ?? ''));
    if (!$id) api_error('submission_id required');

    $conn->query("UPDATE assignment_submissions SET subtask_id='$subtask' WHERE submission_id=$id");
    api_success([], 'Submission updated successfully');
}

/* ════════════════════════════════════════════════
   ACTION: delete_submission
   Exact: DELETE FROM assignment_submissions WHERE submission_id=...
════════════════════════════════════════════════ */
if ($action === 'delete_submission') {
    $id = (int)($_POST['submission_id'] ?? 0);
    if (!$id) api_error('submission_id required');

    $conn->query("DELETE FROM assignment_submissions WHERE submission_id=$id");
    api_success([], 'Submission deleted successfully');
}

api_error('Unknown action');
?>