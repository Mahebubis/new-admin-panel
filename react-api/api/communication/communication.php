<?php
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? $_GET['action'] ?? '';

/* ─── get CIT version count ───
   Same as PHP: SELECT COUNT(exam_name) FROM exam_batch_for_reports
*/
if ($action === 'get_cit_version_count') {
    $res = mysqli_query($conn, "SELECT COUNT(exam_name) AS cnt FROM exam_batch_for_reports");
    $row = $res ? mysqli_fetch_assoc($res) : null;
    echo json_encode(['status'=>'success', 'count' => (int)($row['cnt'] ?? 0)]);
    exit;
}

echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;
?>