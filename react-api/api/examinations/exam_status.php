<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? '';

/* ════════════════════════════════════════
   FETCH EXAM NOT GIVEN
   Calls fetch_exam_not_given() + fetch_exam_not_given__count()
   Both at global scope in helper.php (lines 4659, 4729)
   Date: HTML sends YYYY-MM-DD, helper expects DD/MM/YYYY
════════════════════════════════════════ */
if ($action === 'fetch_exam_not_given') {
    $limit   = (int)($_POST['limit']  ?? 10);
    $offset  = (int)($_POST['offset'] ?? 0);
    $keyword = !empty($_POST['keyword']) ? $_POST['keyword'] : null;

    // Convert YYYY-MM-DD → DD/MM/YYYY for helper.php
    $start_date = null;
    $end_date   = null;
    if (!empty($_POST['start_date'])) {
        $d = DateTime::createFromFormat('Y-m-d', $_POST['start_date']);
        if ($d) $start_date = $d->format('d/m/Y');
    }
    if (!empty($_POST['end_date'])) {
        $d = DateTime::createFromFormat('Y-m-d', $_POST['end_date']);
        if ($d) $end_date = $d->format('d/m/Y');
    }

    $data  = fetch_exam_not_given($limit, $offset, $start_date, $end_date, $keyword);
    $count = fetch_exam_not_given__count($start_date, $end_date, $keyword);

    if ($data  === false) $data  = ['limited' => [], 'all' => []];
    if ($count === false) $count = 0;

    echo json_encode(['status'=>'success','data'=>$data,'count'=>(int)$count]);
    exit;
}

echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;
?>