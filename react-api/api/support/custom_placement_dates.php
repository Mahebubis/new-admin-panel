<?php
/*
 * /api/custom-placement-dates.php
 *
 * POST action=fetch_all  → all rows ORDER BY id DESC
 * POST action=add        → dates (JSON string), status
 * POST action=update     → id, dates (JSON string), status
 * POST action=delete     → id
 *
 * Table: set_custom_date_for_placement_link
 *   id, dates (JSON), status (active|close), created_at, updated_at
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

/* ══════════════════════════════════════
   FETCH ALL  (exact match to functions.php)
══════════════════════════════════════ */
if ($action === 'fetch_all') {
    $res  = $conn->query("SELECT * FROM set_custom_date_for_placement_link ORDER BY id DESC");
    $rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
    echo json_encode(['success'=>true,'data'=>$rows]);
    exit;
}

/* ══════════════════════════════════════
   ADD  — dates is a JSON string, same as PHP
══════════════════════════════════════ */
if ($action === 'add') {
    $dates  = $_POST['dates']  ?? '[]';
    $status = $_POST['status'] ?? 'active';

    $stmt = $conn->prepare("INSERT INTO set_custom_date_for_placement_link (dates, status) VALUES (?, ?)");
    $stmt->bind_param('ss', $dates, $status);
    $ok = $stmt->execute();
    echo json_encode($ok
        ? ['success'=>true, 'message'=>'Dates added successfully']
        : ['success'=>false,'message'=>'Failed to add']);
    exit;
}

/* ══════════════════════════════════════
   UPDATE
══════════════════════════════════════ */
if ($action === 'update') {
    $id     = (int)($_POST['id']     ?? 0);
    $dates  = $_POST['dates']  ?? '[]';
    $status = $_POST['status'] ?? 'active';

    $stmt = $conn->prepare("UPDATE set_custom_date_for_placement_link SET dates=?, status=? WHERE id=?");
    $stmt->bind_param('ssi', $dates, $status, $id);
    $ok = $stmt->execute();
    echo json_encode($ok
        ? ['success'=>true, 'message'=>'Dates updated successfully']
        : ['success'=>false,'message'=>'Failed to update']);
    exit;
}

/* ══════════════════════════════════════
   DELETE
══════════════════════════════════════ */
if ($action === 'delete') {
    $id   = (int)($_POST['id'] ?? 0);
    $stmt = $conn->prepare("DELETE FROM set_custom_date_for_placement_link WHERE id=?");
    $stmt->bind_param('i', $id);
    $ok   = $stmt->execute();
    echo json_encode($ok
        ? ['success'=>true, 'message'=>'Dates deleted successfully']
        : ['success'=>false,'message'=>'Failed to delete']);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>