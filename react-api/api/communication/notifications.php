<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

function logErr($ctx, $msg) {
    file_put_contents('/home/istudio/logs/notifications.log',
        '[' . date('Y-m-d H:i:s') . '] [' . $ctx . '] ' . $msg . PHP_EOL,
        FILE_APPEND | LOCK_EX);
}

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

/* ════════════════════════════════════════
   GET: fetch all from single_notification
   Same as fetch_single_notification.php?fetch=1
   Returns all rows ORDER BY id DESC
════════════════════════════════════════ */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $res = mysqli_query($conn, "SELECT * FROM single_notification ORDER BY id DESC");
    if (!$res) {
        logErr('fetch', mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
        exit;
    }
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
    echo json_encode(['status'=>'success','notifications'=>$rows]);
    exit;
}

/* ════════════════════════════════════════
   POST: delete by notification_ids
   Same as fetch_single_notification.php POST { notification_ids: [...] }
════════════════════════════════════════ */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $ids   = $input['notification_ids'] ?? [];

    if (empty($ids) || !is_array($ids)) {
        echo json_encode(['status'=>'error','message'=>'No notification_ids provided']);
        exit;
    }

    $id_list = implode(',', array_map('intval', $ids));
    if (mysqli_query($conn, "DELETE FROM single_notification WHERE id IN ($id_list)")) {
        echo json_encode(['status'=>'success','message'=>count($ids) . ' notification(s) deleted']);
    } else {
        logErr('delete', mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
    }
    exit;
}

echo json_encode(['status'=>'error','message'=>'Invalid request method']);
exit;