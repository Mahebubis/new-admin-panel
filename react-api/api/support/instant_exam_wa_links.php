<?php
/*
 * /api/instant-exam-wa-links.php
 *
 * POST action=fetch_all   → all rows ORDER BY id DESC
 * POST action=add         → whatsapp_link, status, cit_version
 * POST action=update      → id, whatsapp_link, status, cit_version
 * POST action=delete      → id
 *
 * Table: instant_exam_whatsapp_link
 *   id, whatsapp_link, status (active|close|inactive), cit_version, created_at, updated_at
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
   FETCH ALL  (mirrors helper.php exactly)
══════════════════════════════════════ */
if ($action === 'fetch_all') {
    $res  = $conn->query("SELECT * FROM instant_exam_whatsapp_link ORDER BY id DESC");
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(['success'=>true,'data'=>$rows]);
    exit;
}

/* ══════════════════════════════════════
   ADD
══════════════════════════════════════ */
if ($action === 'add') {
    $link    = $conn->real_escape_string($_POST['whatsapp_link'] ?? '');
    $status  = $conn->real_escape_string($_POST['status']        ?? 'active');
    $citv    = $conn->real_escape_string($_POST['cit_version']   ?? '');

    $conn->query("INSERT INTO instant_exam_whatsapp_link
        (whatsapp_link, status, cit_version, created_at, updated_at)
        VALUES ('$link', '$status', '$citv', NOW(), NOW())");

    echo json_encode($conn->affected_rows > 0
        ? ['success'=>true, 'message'=>'Link added successfully']
        : ['success'=>false,'message'=>'Failed to add link']);
    exit;
}

/* ══════════════════════════════════════
   UPDATE
══════════════════════════════════════ */
if ($action === 'update') {
    $id     = (int)($_POST['id'] ?? 0);
    $link   = $conn->real_escape_string($_POST['whatsapp_link'] ?? '');
    $status = $conn->real_escape_string($_POST['status']        ?? 'active');
    $citv   = $conn->real_escape_string($_POST['cit_version']   ?? '');

    $conn->query("UPDATE instant_exam_whatsapp_link
        SET whatsapp_link='$link', status='$status', cit_version='$citv', updated_at=NOW()
        WHERE id=$id");

    echo json_encode($conn->affected_rows >= 0
        ? ['success'=>true, 'message'=>'Link updated successfully']
        : ['success'=>false,'message'=>'Failed to update link']);
    exit;
}

/* ══════════════════════════════════════
   DELETE
══════════════════════════════════════ */
if ($action === 'delete') {
    $id = (int)($_POST['id'] ?? 0);
    $conn->query("DELETE FROM instant_exam_whatsapp_link WHERE id=$id");
    echo json_encode($conn->affected_rows > 0
        ? ['success'=>true, 'message'=>'Link deleted successfully']
        : ['success'=>false,'message'=>'Failed to delete link']);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>