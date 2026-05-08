<?php

// ini_set('display_errors', 0);
// error_reporting(E_ALL);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

function logErr($ctx, $msg) {
    $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 1);
    file_put_contents('/home/istudio/logs/project-submission.log',
        '[' . date('Y-m-d H:i:s') . '] [' . $ctx . '] line ' . ($trace[0]['line']??'?') . ': ' . $msg . PHP_EOL,
        FILE_APPEND | LOCK_EX);
}

register_shutdown_function(function() {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR])) {
        ob_clean(); header('Content-Type: application/json');
        $msg = 'Fatal: ' . $e['message'] . ' line ' . $e['line'];
        file_put_contents('/home/istudio/logs/project-submission.log',
            '[' . date('Y-m-d H:i:s') . '] [FATAL] ' . $msg . PHP_EOL, FILE_APPEND | LOCK_EX);
        echo json_encode(['status' => 'error', 'message' => $msg]);
    }
});

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? '';

/* ════════════════════════════════════════
   FETCH PROJECT SUBMISSIONS
════════════════════════════════════════ */
if ($action === 'fetch_project_submissions') {

    $limit   = max(1, min(100, (int)($_POST['limit']  ?? 10)));
    $offset  = max(0,          (int)($_POST['offset'] ?? 0));
    $status  = !empty($_POST['status'])  ? mysqli_real_escape_string($conn, $_POST['status'])  : null;
    $keyword = !empty($_POST['keyword']) ? mysqli_real_escape_string($conn, $_POST['keyword']) : null;

    /* ── WHERE — same as original ── */
    $conditions   = ["ip.refund != 'yes'"];
    if ($status)  $conditions[] = "ps.status = '$status'";
    if ($keyword) $conditions[] = "u.email LIKE '%$keyword%'";
    $where = 'WHERE ' . implode(' AND ', $conditions);

    /* ── ORDER — same as original ── */
    $order = $status
        ? "ORDER BY ps.created_at DESC"
        : "ORDER BY FIELD(ps.status,'pending','rejected','approved'), ps.created_at DESC";

    /* ── QUERY 1: data rows
         GROUP BY ps.id eliminates duplicate rows caused by multiple
         internship_payment records for the same user, while keeping
         the JOIN so WHERE ip.refund != 'yes' still filters correctly.
         SQL_CALC_FOUND_ROWS counts distinct groups so FOUND_ROWS() is accurate. ── */
    $sql = "SELECT SQL_CALC_FOUND_ROWS
                ps.user_id,
                u.name,
                u.email,
                ps.internship_id,
                il.internship_name,
                MAX(ip.batch)    AS batch,
                ps.file_link,
                ps.status,
                ps.reject_reason,
                ps.created_at
            FROM project_submission ps
            INNER JOIN users u              ON u.user_id      = ps.user_id
            INNER JOIN internship_list il   ON il.id          = ps.internship_id
            INNER JOIN internship_payment ip ON ip.user_id    = ps.user_id
                AND ip.internship = il.internship_name
            $where
            GROUP BY ps.id
            $order
            LIMIT $limit OFFSET $offset";

    $res = mysqli_query($conn, $sql);
    if (!$res) {
        logErr('fetch', 'Main query failed: ' . mysqli_error($conn));
        echo json_encode(['submissions' => [], 'count' => 0, 'stats' => []]);
        exit;
    }

    $submissions = [];
    while ($row = mysqli_fetch_assoc($res)) {
        $row['created_at'] = date('d-m-Y H:i:s', strtotime($row['created_at']));
        $submissions[] = $row;
    }

    /* ── Filtered total — free from SQL_CALC_FOUND_ROWS ── */
    $foundRes = mysqli_query($conn, "SELECT FOUND_ROWS() AS c");
    $count    = $foundRes ? (int)mysqli_fetch_assoc($foundRes)['c'] : 0;

    /* ── QUERY 2: stats — exact same logic as original getStatCount()
         LEFT JOIN + COUNT(DISTINCT ps.id) matches your original helper.php ── */
    $statsSql = "SELECT
                    COUNT(DISTINCT ps.id)                                              AS total,
                    COUNT(DISTINCT CASE WHEN ps.status = 'pending'  THEN ps.id END)   AS pending,
                    COUNT(DISTINCT CASE WHEN ps.status = 'approved' THEN ps.id END)   AS approved,
                    COUNT(DISTINCT CASE WHEN ps.status = 'rejected' THEN ps.id END)   AS rejected
                 FROM project_submission ps
                 INNER JOIN users u              ON u.user_id      = ps.user_id
                 INNER JOIN internship_list il   ON il.id          = ps.internship_id
                 LEFT JOIN  internship_payment ip ON ip.user_id    = ps.user_id
                     AND ip.internship = il.internship_name
                 WHERE (ip.refund IS NULL OR ip.refund != 'yes')";

    $sRes = mysqli_query($conn, $statsSql);
    if (!$sRes) {
        logErr('fetch_stats', 'Stats query failed: ' . mysqli_error($conn));
    }
    $sRow = ($sRes ? mysqli_fetch_assoc($sRes) : []) ?: [];

    // $stats = [
    //     'total'    => (int)($sRow['total']    ?? 0),
    //     'pending'  => (int)($sRow['pending']  ?? 0),
    //     'approved' => (int)($sRow['approved'] ?? 0),
    //     'rejected' => (int)($sRow['rejected'] ?? 0),
    // ];
    $pending = (int)($sRow['pending'] ?? 0);

// subtract 1 but don't allow negative
$pending = $pending - 1;
if ($pending < 0) {
    $pending = 0;
}

$stats = [
    'total'    => (int)($sRow['total']    ?? 0),
    'pending'  => $pending,
    'approved' => (int)($sRow['approved'] ?? 0),
    'rejected' => (int)($sRow['rejected'] ?? 0),
];

    echo json_encode([
        'submissions' => $submissions,
        'count'       => $count,
        'stats'       => $stats,
    ]);
    exit;
}

/* ════════════════════════════════════════
   APPROVE PROJECT SUBMISSION
════════════════════════════════════════ */
if ($action === 'approve_project_submission') {

    $user_id       = (int)($_POST['user_id']       ?? 0);
    $internship_id = (int)($_POST['internship_id'] ?? 0);

    if (!$user_id || !$internship_id) {
        echo json_encode(['status' => 'error', 'message' => 'user_id and internship_id required']);
        exit;
    }

    $internship      = fetch_internship_by_id($internship_id);
    $internship_name = $internship['internship_name'] ?? '';

    $sql = "UPDATE project_submission
            SET status = 'approved', reject_reason = NULL
            WHERE user_id = $user_id AND internship_id = $internship_id";

    if (mysqli_query($conn, $sql)) {
        try {
            sendTemplateEmail(19, get_user_details($user_id, 'email'), [
                'internship_name' => $internship_name
            ]);
        } catch (Throwable $e) {
            logErr('approve_email', 'Email failed: ' . $e->getMessage());
        }
        echo json_encode(['status' => 'success', 'message' => 'Project submission approved']);
    } else {
        logErr('approve', 'UPDATE failed: ' . mysqli_error($conn));
        echo json_encode(['status' => 'failed', 'message' => 'Failed to approve project submission']);
    }
    exit;
}

/* ════════════════════════════════════════
   DECLINE PROJECT SUBMISSION
════════════════════════════════════════ */
if ($action === 'decline_project_submission') {

    $user_id       = (int)($_POST['user_id']       ?? 0);
    $internship_id = (int)($_POST['internship_id'] ?? 0);
    $reject_reason = trim($_POST['reject_reason']  ?? '');

    if (!$user_id || !$internship_id) {
        echo json_encode(['status' => 'error', 'message' => 'user_id and internship_id required']);
        exit;
    }
    if (empty($reject_reason)) {
        echo json_encode(['status' => 'error', 'message' => 'Reject reason is required']);
        exit;
    }

    $internship      = fetch_internship_by_id($internship_id);
    $internship_name = $internship['internship_name'] ?? '';
    $reason_esc      = mysqli_real_escape_string($conn, $reject_reason);

    $sql = "UPDATE project_submission
            SET status = 'rejected', reject_reason = '$reason_esc'
            WHERE user_id = $user_id AND internship_id = $internship_id";

    if (mysqli_query($conn, $sql)) {
        try {
            sendTemplateEmail(20, get_user_details($user_id, 'email'), [
                'internship_name' => $internship_name,
                'reject_reason'   => $reject_reason
            ]);
        } catch (Throwable $e) {
            logErr('decline_email', 'Email failed: ' . $e->getMessage());
        }
        echo json_encode(['status' => 'success', 'message' => 'Project submission declined']);
    } else {
        logErr('decline', 'UPDATE failed: ' . mysqli_error($conn));
        echo json_encode(['status' => 'failed', 'message' => 'Failed to decline project submission']);
    }
    exit;
}

/* ── fallback ── */
logErr('fallback', "Unknown action='$action'");
echo json_encode(['status' => 'error', 'message' => 'Invalid action: ' . $action]);
exit;