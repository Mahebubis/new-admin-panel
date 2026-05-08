<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

function logErr($ctx, $msg) {
    file_put_contents('/home/istudio/logs/exam-results.log',
        '[' . date('Y-m-d H:i:s') . '] [' . $ctx . '] ' . $msg . PHP_EOL,
        FILE_APPEND | LOCK_EX);
}

global $conn, $conn2;
if (!$conn)  { echo json_encode(['status'=>'error','message'=>'DB failed']);  exit; }
if (!$conn2) { echo json_encode(['status'=>'error','message'=>'DB2 failed']); exit; }

$action = $_POST['action'] ?? '';

/* ════════════════════════════════════════
   FETCH EXAM RESULTS
   Calls fetch_exam_results() from helper.php (global scope, line 4458)
   Uses conn2 (exam panel DB) for results, conn for rank+phone lookup
   Date format: HTML sends YYYY-MM-DD, helper expects DD/MM/YYYY
════════════════════════════════════════ */
if ($action === 'fetch_exam_results') {
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

    $data = fetch_exam_results($limit, $offset, $start_date, $end_date, $keyword);

    echo json_encode(['status'=>'success','data'=>$data]);
    exit;
}

/* ════════════════════════════════════════
   DELETE STUDENT RESULT
   Exact same as functions.php delete_student_result (line 850):
   DELETE from conn2 result table first, then conn result table
════════════════════════════════════════ */
if ($action === 'delete_student_result') {
    $user_id  = mysqli_real_escape_string($conn, $_POST['user_id']  ?? '');
    $rightans = mysqli_real_escape_string($conn, $_POST['rightans'] ?? '');

    if (!$user_id) {
        echo json_encode(['status'=>'error','message'=>'user_id required']);
        exit;
    }

    // Delete from conn2 (exam panel DB) — same as PHP
    $sql2 = "DELETE FROM result WHERE user_id = '$user_id' AND rightans = '$rightans'";
    if (!mysqli_query($conn2, $sql2)) {
        logErr('delete_conn2', mysqli_error($conn2));
        echo json_encode(['status'=>'error','message'=>'Invalid Result!']);
        exit;
    }

    // Check and delete from conn (main DB) — same as PHP
    $check = mysqli_query($conn, "SELECT * FROM result WHERE user_id = '$user_id' AND rightans = '$rightans'");
    if ($check && mysqli_num_rows($check) > 0) {
        $sql = "DELETE FROM result WHERE user_id = '$user_id' AND rightans = '$rightans'";
        if (!mysqli_query($conn, $sql)) {
            logErr('delete_conn', mysqli_error($conn));
            echo json_encode(['status'=>'error','message'=>'Something went wrong!']);
            exit;
        }
    }

    echo json_encode(['status'=>'success','message'=>'Result deleted successfully!']);
    exit;
}

/* ════════════════════════════════════════
   ADD STUDENT RESULT
   Exact same as functions.php add_student_result (line 949):
   Looks up exam batch → finds matching result row → copies rank/percentile
════════════════════════════════════════ */
if ($action === 'add_student_result') {
    $user_id        = mysqli_real_escape_string($conn, $_POST['user_id']        ?? '');
    $rightans       = mysqli_real_escape_string($conn, $_POST['rightans']       ?? '');
    $wrongans       = mysqli_real_escape_string($conn, $_POST['wrongans']       ?? '');
    $total          = mysqli_real_escape_string($conn, $_POST['total']          ?? '');
    $exam_taken_date= mysqli_real_escape_string($conn, $_POST['exam_taken_date']?? '');

    if (!$user_id) {
        echo json_encode(['status'=>'error','message'=>'user_id required']);
        exit;
    }

    // Get exam batch number — same as PHP
    $check_sql = "SELECT SUBSTRING(exam_name, LOCATE('CIT ', exam_name) + 4) AS exam_number
                  FROM exam_batch_for_reports
                  WHERE STR_TO_DATE('$exam_taken_date', '%d-%m-%Y') BETWEEN exam_start_date AND certificate_date LIMIT 1";
    $result    = mysqli_query($conn, $check_sql);
    $row       = $result ? mysqli_fetch_assoc($result) : null;
    $exam_name = $row['exam_name'] ?? null;

    // Get batch_id — same as PHP
    $batch_id = null;
    if ($exam_name) {
        $bRes = mysqli_query($conn, "SELECT batch_id FROM exam_batches WHERE cit_no = '$exam_name' LIMIT 1");
        $bRow = $bRes ? mysqli_fetch_assoc($bRes) : null;
        $batch_id = $bRow['batch_id'] ?? null;
    }

    // Find matching result row for rank/percentile — same as PHP
    $sql    = "SELECT * FROM result WHERE phase = '$batch_id' AND total = '$total' OR rightans = '$rightans' LIMIT 1";
    $result = mysqli_query($conn, $sql);

    if ($result && mysqli_num_rows($result) > 0) {
        $row        = mysqli_fetch_assoc($result);
        $rank       = $row['rank'];
        $percentile = $row['percentile'];
        $round      = $row['round'];
        $phase      = $row['phase'];

        $insert_sql = "INSERT INTO result (user_id, rightans, wrongans, total, `rank`, percentile, `round`, `phase`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = mysqli_prepare($conn, $insert_sql);
        mysqli_stmt_bind_param($stmt, "ssssssss", $user_id, $rightans, $wrongans, $total, $rank, $percentile, $round, $phase);
        mysqli_stmt_execute($stmt);

        echo json_encode(['status'=>'success','message'=>'Result added successfully!']);
    } else {
        echo json_encode(['status'=>'error','message'=>'Invalid Result!']);
    }
    exit;
}

logErr('fallback', "Unknown action='$action'");
echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;
?>