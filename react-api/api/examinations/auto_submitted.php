<?php
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? '';

/* ════════════════════════════════════════
   FETCH AUTO-SUBMITTED EXAMS
   Calls fetch_auto_submitted_exams() from helper.php (global scope, line 4796)
   Date: HTML sends YYYY-MM-DD, helper expects DD/MM/YYYY
════════════════════════════════════════ */
if ($action === 'fetch_auto_submitted_exams') {
    $limit   = (int)($_POST['limit']  ?? 10);
    $offset  = (int)($_POST['offset'] ?? 0);
    $keyword = !empty($_POST['keyword']) ? $_POST['keyword'] : null;

    // Convert YYYY-MM-DD → DD/MM/YYYY for helper
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

    $data = fetch_auto_submitted_exams($limit, $offset, $start_date, $end_date, $keyword);
    if (!is_array($data)) $data = ['limited'=>[],'all'=>[],'total_count'=>0];

    echo json_encode(['status'=>'success','data'=>$data]);
    exit;
}

/* ════════════════════════════════════════
   DELETE (RESET) SINGLE USER'S AUTO-SUBMITTED EXAM
   JS calls action='delete_auto_submitted_exam'
   Reset = delete from cit_exam_login + cit_exam_data for exam_id = 1
   Same pattern as delete_student_exam_result_new (line 883):
   DELETE FROM cit_exam_login WHERE user_id AND exam_id
   DELETE FROM cit_exam_data WHERE user_id AND exam_id
════════════════════════════════════════ */
if ($action === 'delete_auto_submitted_exam') {
    $user_id = mysqli_real_escape_string($conn, $_POST['user_id'] ?? '');
    if (!$user_id) { echo json_encode(['status'=>'error','message'=>'user_id required']); exit; }

    // exam_id = 1 (CIT exam) — same as functions.php pattern
    $exam_id = 1;

    mysqli_query($conn, "DELETE FROM cit_exam_login WHERE user_id = '$user_id' AND exam_id = $exam_id");
    mysqli_query($conn, "DELETE FROM cit_exam_data  WHERE user_id = '$user_id' AND exam_id = $exam_id");

    echo json_encode(['status'=>'success','message'=>'Exam reset successfully. User can now retake the exam.']);
    exit;
}

/* ════════════════════════════════════════
   BULK DELETE (RESET) MULTIPLE USERS
   JS calls action='bulk_delete_auto_submitted_exams'
   Same logic as single but for multiple user_ids
════════════════════════════════════════ */
if ($action === 'bulk_delete_auto_submitted_exams') {
    $user_ids = json_decode($_POST['user_ids'] ?? '[]', true);
    if (empty($user_ids) || !is_array($user_ids)) {
        echo json_encode(['status'=>'error','message'=>'No user_ids provided']);
        exit;
    }

    $exam_id  = 1;
    $id_list  = implode(',', array_map('intval', $user_ids));

    mysqli_query($conn, "DELETE FROM cit_exam_login WHERE user_id IN ($id_list) AND exam_id = $exam_id");
    mysqli_query($conn, "DELETE FROM cit_exam_data  WHERE user_id IN ($id_list) AND exam_id = $exam_id");

    echo json_encode(['status'=>'success','message'=>count($user_ids) . ' user(s) reset successfully.']);
    exit;
}

echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;
?>