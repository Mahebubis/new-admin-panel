<?php
// require_once __DIR__ . '/../../config/database.php';
// require_once __DIR__ . '/../../middleware/auth.php';
// require_method('GET');
// $jwt = require_jwt();
// require_permission('manage_coupons', $jwt);

// [$page, $per_page, $offset] = get_pagination();
// $search = get_search();

// $where = "WHERE 1=1";
// $params = []; $types = '';
// if ($search) { $like = "%$search%"; $where .= " AND c.code LIKE ?"; $params = [$like]; $types = 's'; }

// $stmt = $conn->prepare("SELECT COUNT(*) AS c FROM istudio_coupons c $where");
// if ($params) $stmt->bind_param($types, ...$params);
// $stmt->execute();
// $total = $stmt->get_result()->fetch_assoc()['c'];

// $sql = "
//     SELECT c.*, COUNT(cu.id) AS usage_count
//     FROM istudio_coupons c
//     LEFT JOIN coupon_usage cu ON cu.coupon_id = c.id AND cu.status = 'used'
//     $where GROUP BY c.id ORDER BY c.id DESC LIMIT ? OFFSET ?
// ";
// $stmt = $conn->prepare($sql);
// $allParams = array_merge($params, [$per_page, $offset]);
// $stmt->bind_param($types . 'ii', ...$allParams);
// $stmt->execute();
// $coupons = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

// api_success(['coupons' => $coupons, 'total' => (int)$total, 'page' => $page]);




ini_set('display_errors', 0);
error_reporting(E_ALL);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

function logErr($ctx, $msg) {
    $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 1);
    file_put_contents('/home/istudio/logs/coupons.log',
        '[' . date('Y-m-d H:i:s') . '] [' . $ctx . '] line ' . ($trace[0]['line']??'?') . ': ' . $msg . PHP_EOL,
        FILE_APPEND | LOCK_EX);
}

register_shutdown_function(function() {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR])) {
        ob_clean(); header('Content-Type: application/json');
        $msg = 'Fatal: ' . $e['message'] . ' line ' . $e['line'];
        file_put_contents('/home/istudio/logs/coupons.log',
            '[' . date('Y-m-d H:i:s') . '] [FATAL] ' . $msg . PHP_EOL, FILE_APPEND | LOCK_EX);
        echo json_encode(['status' => 'error', 'message' => $msg]);
    }
});

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? $_GET['action'] ?? '';

/* ════════════════════════════════════════
   FETCH ALL COUPONS + INTERNSHIPS
   Same as admin_coupons.php main SELECT with usage count
════════════════════════════════════════ */
if ($action === 'fetch_coupons') {
    // Coupons with usage count — same as PHP
    $sql = "
        SELECT c.*, COUNT(cu.id) AS usage_count
        FROM istudio_coupons c
        LEFT JOIN coupon_usage cu ON cu.coupon_id = c.id AND cu.status = 'used'
        GROUP BY c.id
        ORDER BY c.id DESC
    ";
    $res = mysqli_query($conn, $sql);
    if (!$res) {
        logErr('fetch_coupons', 'Query failed: ' . mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
        exit;
    }
    $coupons = [];
    while ($r = mysqli_fetch_assoc($res)) $coupons[] = $r;

    // Internships for dropdown — same as PHP
    $iRes = mysqli_query($conn, "SELECT id, internship_name FROM internship_list ORDER BY internship_name ASC");
    $internships = [];
    if ($iRes) while ($r = mysqli_fetch_assoc($iRes)) $internships[] = $r;

    echo json_encode(['status'=>'success','coupons'=>$coupons,'internships'=>$internships]);
    exit;
}

/* ════════════════════════════════════════
   ADD COUPON
   Same as PHP: $action == 'add' handler
   Table: istudio_coupons
   Fields: code, discount_value, discount_type, course_id, expiry_date, usage_limit, per_user_limit
════════════════════════════════════════ */
if ($action === 'add_coupon') {
    $code           = strtoupper(trim(mysqli_real_escape_string($conn, $_POST['code']       ?? '')));
    $discount_value = floatval($_POST['discount_value'] ?? 0);
    $discount_type  = mysqli_real_escape_string($conn, $_POST['discount_type'] ?? 'percentage');
    $course_id      = !empty($_POST['course_id'])      ? (int)$_POST['course_id']      : null;
    $expiry_date    = !empty($_POST['expiry_date'])     ? mysqli_real_escape_string($conn, $_POST['expiry_date']) : null;
    $usage_limit    = isset($_POST['usage_limit'])    && $_POST['usage_limit']    !== '' ? (int)$_POST['usage_limit']    : null;
    $per_user_limit = isset($_POST['per_user_limit']) && $_POST['per_user_limit'] !== '' ? (int)$_POST['per_user_limit'] : null;

    if (empty($code)) {
        echo json_encode(['status'=>'error','message'=>'Coupon code is required']);
        exit;
    }

    $course_val   = $course_id      !== null ? "'$course_id'"      : 'NULL';
    $expiry_val   = $expiry_date    !== null ? "'$expiry_date'"    : 'NULL';
    $usage_val    = $usage_limit    !== null ? $usage_limit        : 'NULL';
    $per_user_val = $per_user_limit !== null ? $per_user_limit     : 'NULL';

    $sql = "INSERT INTO istudio_coupons
            (code, discount_value, discount_type, course_id, expiry_date, usage_limit, per_user_limit)
            VALUES ('$code', '$discount_value', '$discount_type', $course_val, $expiry_val, $usage_val, $per_user_val)";

    if (mysqli_query($conn, $sql)) {
        echo json_encode(['status'=>'success','message'=>'Coupon added successfully!']);
    } else {
        logErr('add_coupon', 'INSERT failed: ' . mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
    }
    exit;
}

/* ════════════════════════════════════════
   EDIT COUPON
   Same as PHP: $action == 'edit' handler
   UPDATE istudio_coupons WHERE id = coupon_id
════════════════════════════════════════ */
if ($action === 'edit_coupon') {
    $coupon_id      = (int)($_POST['coupon_id']     ?? 0);
    $code           = strtoupper(trim(mysqli_real_escape_string($conn, $_POST['code']       ?? '')));
    $discount_value = floatval($_POST['discount_value'] ?? 0);
    $discount_type  = mysqli_real_escape_string($conn, $_POST['discount_type'] ?? 'percentage');
    $course_id      = !empty($_POST['course_id'])      ? (int)$_POST['course_id']      : null;
    $expiry_date    = !empty($_POST['expiry_date'])     ? mysqli_real_escape_string($conn, $_POST['expiry_date']) : null;
    $usage_limit    = isset($_POST['usage_limit'])    && $_POST['usage_limit']    !== '' ? (int)$_POST['usage_limit']    : null;
    $per_user_limit = isset($_POST['per_user_limit']) && $_POST['per_user_limit'] !== '' ? (int)$_POST['per_user_limit'] : null;

    if (!$coupon_id) {
        echo json_encode(['status'=>'error','message'=>'coupon_id is required']);
        exit;
    }
    if (empty($code)) {
        echo json_encode(['status'=>'error','message'=>'Coupon code is required']);
        exit;
    }

    $course_val   = $course_id      !== null ? "'$course_id'"      : 'NULL';
    $expiry_val   = $expiry_date    !== null ? "'$expiry_date'"    : 'NULL';
    $usage_val    = $usage_limit    !== null ? $usage_limit        : 'NULL';
    $per_user_val = $per_user_limit !== null ? $per_user_limit     : 'NULL';

    $sql = "UPDATE istudio_coupons SET
            code           = '$code',
            discount_value = '$discount_value',
            discount_type  = '$discount_type',
            course_id      = $course_val,
            expiry_date    = $expiry_val,
            usage_limit    = $usage_val,
            per_user_limit = $per_user_val
            WHERE id = $coupon_id";

    if (mysqli_query($conn, $sql)) {
        echo json_encode(['status'=>'success','message'=>'Coupon updated successfully!']);
    } else {
        logErr('edit_coupon', 'UPDATE failed: ' . mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
    }
    exit;
}

/* ════════════════════════════════════════
   DELETE COUPON
   Same as PHP: GET delete handler
   DELETE FROM istudio_coupons WHERE id = coupon_id
════════════════════════════════════════ */
if ($action === 'delete_coupon') {
    $coupon_id = (int)($_POST['coupon_id'] ?? 0);

    if (!$coupon_id) {
        echo json_encode(['status'=>'error','message'=>'coupon_id is required']);
        exit;
    }

    if (mysqli_query($conn, "DELETE FROM istudio_coupons WHERE id = $coupon_id")) {
        echo json_encode(['status'=>'success','message'=>'Coupon deleted successfully!']);
    } else {
        logErr('delete_coupon', 'DELETE failed: ' . mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
    }
    exit;
}

/* ════════════════════════════════════════
   VIEW USERS WHO USED A COUPON
   Same as PHP: GET view_users handler
   SELECT from coupon_usage JOIN users WHERE coupon_id = ? AND status = 'used'
════════════════════════════════════════ */
if ($action === 'view_users') {
    $coupon_id = (int)($_POST['coupon_id'] ?? 0);

    if (!$coupon_id) {
        echo json_encode(['status'=>'error','message'=>'coupon_id is required']);
        exit;
    }

    // Verify coupon exists — same as PHP check
    $chk = mysqli_query($conn, "SELECT id FROM istudio_coupons WHERE id = $coupon_id LIMIT 1");
    if (!$chk || mysqli_num_rows($chk) === 0) {
        echo json_encode(['status'=>'error','message'=>'Coupon not found']);
        exit;
    }

    // Fetch users — exact same query as PHP
    $sql = "
        SELECT cu.*, u.username, u.email
        FROM coupon_usage cu
        INNER JOIN users u ON cu.user_id = u.user_id
        WHERE cu.coupon_id = $coupon_id AND cu.status = 'used'
        ORDER BY cu.usage_date DESC
    ";
    $res = mysqli_query($conn, $sql);
    if (!$res) {
        logErr('view_users', 'Query failed: ' . mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
        exit;
    }

    $users = [];
    while ($r = mysqli_fetch_assoc($res)) $users[] = $r;

    echo json_encode(['status'=>'success','users'=>$users]);
    exit;
}

/* ── fallback ── */
logErr('fallback', "Unknown action='$action'");
echo json_encode(['status'=>'error','message'=>'Invalid action: '.$action]);
exit;
?>