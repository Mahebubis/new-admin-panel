<?php
/*
 * /api/clarity-report.php
 *
 * GET ?action=search&query=X&search_type=user_id|clarity_user_id
 *
 * Returns rows from user_clarity JOIN users (for email),
 * ordered by timestamp DESC.
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['success'=>false,'message'=>'DB failed']); exit; }

$action      = $_GET['action'] ?? $_POST['action'] ?? '';
$query       = trim($_GET['query']       ?? $_POST['query']       ?? '');
$search_type = trim($_GET['search_type'] ?? $_POST['search_type'] ?? 'user_id');

/* ── whitelist the field name ── */
$allowed_types = ['user_id', 'clarity_user_id'];
if (!in_array($search_type, $allowed_types, true)) {
    echo json_encode(['success'=>false,'message'=>'Invalid search type']); exit;
}

if ($action === 'search') {
    if ($query === '') {
        echo json_encode(['success'=>false,'message'=>'Search query is required']); exit;
    }

    $field = $search_type === 'user_id' ? 'uc.user_id' : 'uc.clarity_user_id';

    $stmt = $conn->prepare("
        SELECT uc.user_id, uc.clarity_user_id, uc.timestamp, u.email
        FROM user_clarity uc
        LEFT JOIN users u ON u.user_id = uc.user_id
        WHERE $field = ?
        ORDER BY uc.timestamp DESC
    ");
    $stmt->bind_param('s', $query);
    $stmt->execute();
    $res = $stmt->get_result();

    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;

    echo json_encode(['success'=>true,'results'=>$rows,'count'=>count($rows)]);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>