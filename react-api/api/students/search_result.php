<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

function logErr($ctx, $msg) {
    $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 1);
    file_put_contents('/home/istudio/logs/search-result.log',
        '[' . date('Y-m-d H:i:s') . '] [' . $ctx . '] line ' . ($trace[0]['line']??'?') . ': ' . $msg . PHP_EOL,
        FILE_APPEND | LOCK_EX);
}

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR])) {
        ob_clean(); header('Content-Type: application/json');
        $msg = 'PHP Fatal: ' . $error['message'] . ' line ' . $error['line'];
        file_put_contents('/home/istudio/logs/search-result.log',
            '[' . date('Y-m-d H:i:s') . '] [FATAL] ' . $msg . PHP_EOL, FILE_APPEND | LOCK_EX);
        echo json_encode(['success' => false, 'message' => $msg]);
    }
});

global $conn;
if (!$conn) { echo json_encode(['success'=>false,'message'=>'DB failed']); exit; }

// Performance session vars — same as search_result.php
mysqli_query($conn, "SET SESSION tmp_table_size = 268435456");
mysqli_query($conn, "SET SESSION max_heap_table_size = 268435456");
mysqli_query($conn, "SET SESSION sort_buffer_size = 67108864");

$action = $_POST['action'] ?? $_GET['action'] ?? '';

/* ════════════════════════════════════════
   SEARCH — exact same query as search_result.php
   Searches: user_id, email (LIKE), phone (LIKE)
   Returns multiple users if > 1 match
════════════════════════════════════════ */
if ($action === 'search') {
    $q = trim($_POST['query'] ?? '');
    if (empty($q)) {
        echo json_encode(['success'=>false,'message'=>'Search query is required']);
        exit;
    }

    $qEsc = mysqli_real_escape_string($conn, $q);

    // Use exact match on all three columns — fully uses indexes, no LIKE
    // Run 3 small exact-match queries and merge (faster than OR on large tables)
    $rows = [];
    $seen = [];

    // 1. Exact user_id
    if (is_numeric($q)) {
        $r1 = mysqli_query($conn, "SELECT user_id, email, phone, name FROM users WHERE user_id = '$qEsc' LIMIT 1");
        if ($r1) while ($r = mysqli_fetch_assoc($r1)) { if (!isset($seen[$r['user_id']])) { $rows[] = $r; $seen[$r['user_id']] = 1; } }
    }

    // 2. Exact email
    if (empty($rows)) {
        $r2 = mysqli_query($conn, "SELECT user_id, email, phone, name FROM users WHERE email = '$qEsc' LIMIT 5");
        if ($r2) while ($r = mysqli_fetch_assoc($r2)) { if (!isset($seen[$r['user_id']])) { $rows[] = $r; $seen[$r['user_id']] = 1; } }
    }

    // 3. Exact phone
    if (empty($rows)) {
        $r3 = mysqli_query($conn, "SELECT user_id, email, phone, name FROM users WHERE phone = '$qEsc' LIMIT 5");
        if ($r3) while ($r = mysqli_fetch_assoc($r3)) { if (!isset($seen[$r['user_id']])) { $rows[] = $r; $seen[$r['user_id']] = 1; } }
    }

    if (count($rows) === 0) {
        echo json_encode(['success'=>false,'message'=>'User not found']);
        exit;
    }

    if (count($rows) > 1) {
        echo json_encode(['success'=>true,'multiple'=>true,'users'=>$rows]);
        exit;
    }

    // Single user — fetch full data
    $user_id = (int)$rows[0]['user_id'];
    $data    = fetchFullUserData($user_id);
    echo json_encode(array_merge(['success'=>true,'multiple'=>false], $data));
    exit;
}

/* ════════════════════════════════════════
   FETCH BY USER ID (direct)
════════════════════════════════════════ */
if ($action === 'fetch_by_id') {
    $user_id = (int)($_POST['user_id'] ?? 0);
    if (!$user_id) {
        echo json_encode(['success'=>false,'message'=>'user_id required']);
        exit;
    }
    $data = fetchFullUserData($user_id);
    echo json_encode(array_merge(['success'=>true], $data));
    exit;
}

/* ════════════════════════════════════════
   HELPER: fetch all data for a user
   Exact same queries as search_result.php
════════════════════════════════════════ */
function fetchFullUserData($user_id) {
    global $conn;

    /* ── 1. USER DATA — no DATE() function, all index-friendly ── */
    $sql = "
        SELECT u.*, ad.*,
            us.cit_whatsapp_community AS wa_community_added,
            ec.password AS exam_password,
            r.rank, r.rightans, r.wrongans, r.total,
            ucm.medium, ucm.campaign, ucm.adset, ucm.ad
        FROM users u
        LEFT JOIN additional_details ad  ON u.user_id = ad.user_id
        LEFT JOIN user_steps us          ON u.user_id = us.user_id
        LEFT JOIN exam_credentials ec    ON u.user_id = ec.user_id
        LEFT JOIN result r               ON u.user_id = r.user_id
        LEFT JOIN user_campaign ucm      ON u.user_id = ucm.user_id
        WHERE u.user_id = $user_id
        LIMIT 1
    ";
    $res  = mysqli_query($conn, $sql);
    $user = $res ? mysqli_fetch_assoc($res) : [];
    if ($user) unset($user['password']);

    // CIT version — separate query, cast registered_at to DATE so index on from_date/to_date is used
    if (!empty($user['registered_at'])) {
        $regDate = mysqli_real_escape_string($conn, substr($user['registered_at'], 0, 10));
        $vRes = mysqli_query($conn, "SELECT REPLACE(exam_name, 'CIT ', '') AS cit_version_name
                                     FROM exam_batch_for_reports
                                     WHERE '$regDate' BETWEEN from_date AND to_date LIMIT 1");
        $user['cit_version_name'] = ($vRes && mysqli_num_rows($vRes) > 0)
            ? mysqli_fetch_assoc($vRes)['cit_version_name'] : '-';
    }

    /* ── 2. INTERNSHIPS — single JOIN query, no per-row loops ── */
    $internships = [];
    $sql = "
        SELECT ip.*,
            ps_sub.status        AS project_status,
            ps_sub.reject_reason AS project_reject_reason,
            ps_sub.created_at    AS project_submission_date,
            il.internship_name   AS internship_title,
            COALESCE(pst.amount, 0) AS charge_amount
        FROM internship_payment ip
        LEFT JOIN internship_list il
            ON ip.internship COLLATE utf8mb4_unicode_ci = il.internship_name COLLATE utf8mb4_unicode_ci
        LEFT JOIN project_submission ps_sub
            ON (ip.user_id = ps_sub.user_id AND il.id = ps_sub.internship_id)
        LEFT JOIN payment_status pst
            ON pst.payment_id COLLATE utf8mb4_unicode_ci = ip.payment_id COLLATE utf8mb4_unicode_ci
        WHERE ip.user_id = $user_id
        ORDER BY ip.paid_at DESC
    ";
    // $res = mysqli_query($conn, $sql);
    // if ($res) while ($row = mysqli_fetch_assoc($res)) $internships[] = $row;
    $has_refund = false;
$res = mysqli_query($conn, $sql);
if ($res) while ($row = mysqli_fetch_assoc($res)) {
    if (!empty($row['refund']) && ($row['refund'] === 'yes' || $row['refund'] == 1)) {
        $has_refund = true;
    }
    $internships[] = $row;
}

    /* ── 3. EXAM — try cit_results first, fallback to result ── */
    $exam = null;
    $sql  = "
        SELECT u.user_id, u.name, u.email,
            cr.correct_answers AS rightans,
            cr.wrong_answers   AS wrongans,
            cr.timestamp       AS exam_taken_date,
            r.rank, u.phone, 'new' AS source
        FROM cit_results cr
        INNER JOIN users u ON u.user_id = cr.user_id
        LEFT JOIN result r ON r.user_id = u.user_id
        WHERE cr.user_id = $user_id AND cr.exam_id = 1
        LIMIT 1
    ";
    $res = mysqli_query($conn, $sql);
    if ($res && mysqli_num_rows($res) > 0) {
        $exam = mysqli_fetch_assoc($res);
    }

    if (!$exam) {
        $sql = "
            SELECT u.user_id, u.name, u.email,
                r.rightans, r.wrongans, r.total, r.rank,
                u.phone, 'old' AS source
            FROM result r
            INNER JOIN users u ON u.user_id = r.user_id
            WHERE r.user_id = $user_id
            LIMIT 1
        ";
        $res  = mysqli_query($conn, $sql);
        $exam = ($res && mysqli_num_rows($res) > 0) ? mysqli_fetch_assoc($res) : null;
    }

    /* ── 4. SUPPORT TICKETS ── */
    $tickets = [];
    $sql = "SELECT ticket_id, subject, status, created_at
            FROM support_tickets
            WHERE user_id = $user_id
            ORDER BY created_at DESC
            LIMIT 10";
    $res = mysqli_query($conn, $sql);
    if ($res) while ($r = mysqli_fetch_assoc($res)) $tickets[] = $r;

    /* ── 5. PAYMENT HISTORY ── same as search_result.php ── */
    $payments = [];
    $email    = mysqli_real_escape_string($conn, $user['email'] ?? '');
    $sql = "
        SELECT ip.payment_id, ip.internship, ip.batch,
            ip.total_duration, ip.internship_level, ip.paid_at
        FROM internship_payment ip
        INNER JOIN users u ON ip.user_id = u.user_id
        WHERE u.email = '$email'
        ORDER BY ip.paid_at DESC
    ";
    $res = mysqli_query($conn, $sql);
    if ($res) {
        while ($row = mysqli_fetch_assoc($res)) {
            $pid       = mysqli_real_escape_string($conn, $row['payment_id']);
            $sr        = mysqli_query($conn, "SELECT amount, status, remark FROM payment_status WHERE payment_id = '$pid' LIMIT 1");
            $row['amount'] = '0'; $row['status'] = 'pending'; $row['remark'] = '-';
            if ($sr && mysqli_num_rows($sr) > 0) {
                $srow = mysqli_fetch_assoc($sr);
                $row['amount'] = $srow['amount'] ?? '0';
                $row['status'] = $srow['status'] ?? 'pending';
                $row['remark'] = $srow['remark'] ?? '-';
            }
            $payments[] = $row;
        }
    }

    return [
        'user'        => $user,
        'internships' => $internships,
        'exam'        => $exam,
        'tickets'     => $tickets,
        'payments'    => $payments,
        'has_refund'  => $has_refund,
    ];
}

/* ── fallback ── */
logErr('fallback', "Unknown action='$action'");
echo json_encode(['success'=>false,'message'=>'Invalid action: '.$action]);
exit;
?>