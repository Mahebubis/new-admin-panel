<?php
/*
 * /api/wa-link-log.php
 *
 * POST action=fetch_all  → all rows ORDER BY change_timestamp DESC
 *
 * Table: whatsapp_link_log
 *   id, old_link_name, new_link_name, change_timestamp
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

global $conn;
if (!$conn) { echo json_encode(['success'=>false,'message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? '';

if ($action === 'fetch_all') {
    $res  = $conn->query("SELECT id, old_link_name, new_link_name, change_timestamp FROM whatsapp_link_log ORDER BY change_timestamp DESC");
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(['success'=>true,'data'=>$rows,'count'=>count($rows)]);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>