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

/* ── GET: fetch both tables ── */
if ($_SERVER['REQUEST_METHOD'] === 'GET' || $action === 'fetch') {
    $new = []; $old = [];
    $r = mysqli_query($conn, "SELECT id, cit_name, `start`, `end`, exam_start, exam_end, `result`, certificate, Initial FROM cit_version ORDER BY id DESC");
    if ($r) while ($row = mysqli_fetch_assoc($r)) $new[] = $row;
    $r = mysqli_query($conn, "SELECT * FROM exam_batch_for_reports ORDER BY id DESC");
    if ($r) while ($row = mysqli_fetch_assoc($r)) $old[] = $row;
    echo json_encode(['status'=>'success','new'=>$new,'old'=>$old]);
    exit;
}

/* ════ NEW TABLE (cit_version) ════ */

if ($action === 'add_cit_version2') {
    $cit_name    = mysqli_real_escape_string($conn, $_POST['cit_name']    ?? '');
    $start       = mysqli_real_escape_string($conn, $_POST['start']       ?? '');
    $end         = mysqli_real_escape_string($conn, $_POST['end']         ?? '');
    $exam_start  = mysqli_real_escape_string($conn, $_POST['exam_start']  ?? '');
    $exam_end    = mysqli_real_escape_string($conn, $_POST['exam_end']    ?? '');
    $result      = mysqli_real_escape_string($conn, $_POST['result']      ?? '');
    $certificate = mysqli_real_escape_string($conn, $_POST['certificate'] ?? '');
    $Initial     = mysqli_real_escape_string($conn, $_POST['Initial']     ?? '');

    $sql = "INSERT INTO cit_version (cit_name, `start`, `end`, exam_start, exam_end, `result`, certificate, Initial)
            VALUES ('$cit_name','$start','$end','$exam_start','$exam_end','$result','$certificate','$Initial')";
    echo json_encode(mysqli_query($conn, $sql) ? ['status'=>'success','message'=>'CIT version added successfully'] : ['status'=>'error','message'=>'Failed to add CIT version']);
    exit;
}

if ($action === 'update_cit_version2') {
    $id          = (int)($_POST['id'] ?? 0);
    $cit_name    = mysqli_real_escape_string($conn, $_POST['cit_name']    ?? '');
    $start       = mysqli_real_escape_string($conn, $_POST['start']       ?? '');
    $end         = mysqli_real_escape_string($conn, $_POST['end']         ?? '');
    $exam_start  = mysqli_real_escape_string($conn, $_POST['exam_start']  ?? '');
    $exam_end    = mysqli_real_escape_string($conn, $_POST['exam_end']    ?? '');
    $result      = mysqli_real_escape_string($conn, $_POST['result']      ?? '');
    $certificate = mysqli_real_escape_string($conn, $_POST['certificate'] ?? '');
    $Initial     = mysqli_real_escape_string($conn, $_POST['Initial']     ?? '');

    $sql = "UPDATE cit_version SET cit_name='$cit_name', `start`='$start', `end`='$end',
            exam_start='$exam_start', exam_end='$exam_end', `result`='$result',
            certificate='$certificate', Initial='$Initial' WHERE id=$id";
    echo json_encode(mysqli_query($conn, $sql) ? ['status'=>'success','message'=>'CIT version updated successfully'] : ['status'=>'error','message'=>'Failed to update CIT version']);
    exit;
}

if ($action === 'delete_cit_version2') {
    $id = (int)($_POST['id'] ?? 0);
    echo json_encode(mysqli_query($conn, "DELETE FROM cit_version WHERE id=$id") ? ['status'=>'success','message'=>'CIT version deleted successfully'] : ['status'=>'error','message'=>'Failed to delete CIT version']);
    exit;
}

/* ════ OLD TABLE (exam_batch_for_reports) ════ */

if ($action === 'add_cit_version') {
    $exam_name             = $_POST['exam_name']             ?? '';
    $from_date             = $_POST['from_date']             ?? '';
    $to_date               = $_POST['to_date']               ?? '';
    $result_date           = $_POST['result_date']           ?? '';
    $certificate_date      = $_POST['certificate_date']      ?? '';
    $exam_start_date       = $_POST['exam_start_date']       ?? '';
    $exam_end_date         = $_POST['exam_end_date']         ?? '';
    $wa_community_initials = $_POST['wa_community_initials'] ?? '';

    // Check duplicate — same as PHP
    $chk = mysqli_query($conn, "SELECT id FROM exam_batch_for_reports WHERE exam_name='$exam_name'");
    if ($chk && mysqli_num_rows($chk) > 0) {
        echo json_encode(['status'=>'error','message'=>'CIT Version already exists']);
        exit;
    }

    $sql = "INSERT INTO exam_batch_for_reports
            (exam_name,from_date,to_date,result_date,certificate_date,exam_start_date,exam_end_date,wa_community_initials,special,normal)
            VALUES ('$exam_name','$from_date','$to_date','$result_date','$certificate_date','$exam_start_date','$exam_end_date','$wa_community_initials',0,1)";
    echo json_encode(mysqli_query($conn, $sql) ? ['status'=>'success','message'=>'CIT Version Added Successfully'] : ['status'=>'error','message'=>'Something went wrong']);
    exit;
}

if ($action === 'update_cit_version') {
    $id                    = $_POST['id']                    ?? '';
    $exam_name             = $_POST['exam_name']             ?? '';
    $from_date             = $_POST['from_date']             ?? '';
    $to_date               = $_POST['to_date']               ?? '';
    $result_date           = $_POST['result_date']           ?? '';
    $certificate_date      = $_POST['certificate_date']      ?? '';
    $exam_start_date       = $_POST['exam_start_date']       ?? '';
    $exam_end_date         = $_POST['exam_end_date']         ?? '';
    $wa_community_initials = $_POST['wa_community_initials'] ?? '';

    // Check duplicate (excluding self) — same as PHP
    $chk = mysqli_query($conn, "SELECT id FROM exam_batch_for_reports WHERE exam_name='$exam_name' AND id!='$id'");
    if ($chk && mysqli_num_rows($chk) > 0) {
        echo json_encode(['status'=>'error','message'=>'CIT Version already exists']);
        exit;
    }

    $sql = "UPDATE exam_batch_for_reports SET
            exam_name='$exam_name', from_date='$from_date', to_date='$to_date',
            result_date='$result_date', certificate_date='$certificate_date',
            exam_start_date='$exam_start_date', exam_end_date='$exam_end_date',
            wa_community_initials='$wa_community_initials'
            WHERE id='$id'";
    echo json_encode(mysqli_query($conn, $sql) ? ['status'=>'success','message'=>'CIT Version Updated Successfully'] : ['status'=>'error','message'=>'Something went wrong']);
    exit;
}

if ($action === 'delete_cit_version') {
    $id = $_POST['id'] ?? '';
    echo json_encode(mysqli_query($conn, "DELETE FROM exam_batch_for_reports WHERE id='$id'") ? ['status'=>'success','message'=>'CIT Version Deleted Successfully'] : ['status'=>'error','message'=>'Something went wrong']);
    exit;
}

echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;
?>