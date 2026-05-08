<?php
/*
 * manage_batches.php — CRUD for CIT version date ranges
 * Table: agency_batches (id, batch_no, start_date YYYY-MM-DD, end_date YYYY-MM-DD)
 *
 * GET  ?action=get            → returns all batches
 * POST action=add             → adds new batch (batch_no, start_date, end_date)
 * POST action=delete          → deletes batch (batch_id)
 *
 * Table creation (run once):
 * CREATE TABLE IF NOT EXISTS agency_batches (
 *   id         INT AUTO_INCREMENT PRIMARY KEY,
 *   batch_no   VARCHAR(50) NOT NULL,
 *   start_date DATE NOT NULL,
 *   end_date   DATE NOT NULL,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['success'=>false,'message'=>'DB failed']); exit; }

// Auto-create table if not exists
$conn->query("CREATE TABLE IF NOT EXISTS agency_batches (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    batch_no   VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date   DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

$action = $_GET['action'] ?? $_POST['action'] ?? '';

/* ── GET: fetch all batches ── */
if ($action === 'get') {
    $res     = $conn->query("SELECT id, batch_no, start_date, end_date FROM agency_batches ORDER BY id DESC");
    $batches = [];
    if ($res) while ($r = $res->fetch_assoc()) $batches[] = $r;
    echo json_encode(['success'=>true,'data'=>$batches]);
    exit;
}

/* ── POST: add batch ── */
if ($action === 'add') {
    $batch_no   = $conn->real_escape_string($_POST['batch_no']   ?? '');
    $start_date = $conn->real_escape_string($_POST['start_date'] ?? '');
    $end_date   = $conn->real_escape_string($_POST['end_date']   ?? '');

    if (!$batch_no || !$start_date || !$end_date) {
        echo json_encode(['success'=>false,'message'=>'All fields are required']);
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO agency_batches (batch_no, start_date, end_date) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $batch_no, $start_date, $end_date);
    echo json_encode($stmt->execute()
        ? ['success'=>true,  'message'=>'Batch added successfully']
        : ['success'=>false, 'message'=>'Failed to add batch']);
    exit;
}

/* ── POST: delete batch ── */
if ($action === 'delete') {
    $id = (int)($_POST['batch_id'] ?? 0);
    $stmt = $conn->prepare("DELETE FROM agency_batches WHERE id = ?");
    $stmt->bind_param("i", $id);
    echo json_encode($stmt->execute()
        ? ['success'=>true,  'message'=>'Batch deleted']
        : ['success'=>false, 'message'=>'Failed to delete']);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>