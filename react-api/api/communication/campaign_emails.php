<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

function logErr($ctx, $msg) {
    file_put_contents('/home/istudio/logs/campaign-emails.log',
        '[' . date('Y-m-d H:i:s') . '] [' . $ctx . '] ' . $msg . PHP_EOL,
        FILE_APPEND | LOCK_EX);
}

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? $_GET['action'] ?? '';

/* ════════════════════════════════════════
   GET INTERNSHIPS + BATCHES (for dropdowns)
   Same as PHP's $internships = fetch_internship_list()
   and $batches = fetch_exam_dates() on page load
════════════════════════════════════════ */
if ($action === 'get_filters' || $_SERVER['REQUEST_METHOD'] === 'GET') {
    // fetch_internship_list() — SELECT * FROM internship_list
    $internships = [];
    $iRes = mysqli_query($conn, "SELECT id, internship_name, short_name FROM internship_list ORDER BY internship_name ASC");
    if ($iRes) while ($r = mysqli_fetch_assoc($iRes)) $internships[] = $r;

    // fetch_exam_dates() — same two queries (normal + refund batches)
    $batches = [];
    $bRes = mysqli_query($conn, "SELECT DISTINCT id, date FROM exam_dates ORDER BY id DESC");
    if ($bRes) while ($r = mysqli_fetch_assoc($bRes)) $batches[] = ['id'=>$r['id'],'date'=>$r['date'],'refund'=>'no'];
    $rRes = mysqli_query($conn, "SELECT DISTINCT batch FROM internship_payment WHERE refund = 'yes'");
    if ($rRes) while ($r = mysqli_fetch_assoc($rRes)) $batches[] = ['id'=>null,'date'=>$r['batch'],'refund'=>'yes'];

    echo json_encode(['status'=>'success','internships'=>$internships,'batches'=>$batches]);
    exit;
}

/* ════════════════════════════════════════
   FETCH USERS WITH DETAILS
   Exact same as functions.php fetch_users_with_details handler (line 3605)
   type: all_users | specific_internship_users
   Date: HTML sends YYYY-MM-DD, PHP helper uses direct comparison
════════════════════════════════════════ */
if ($action === 'fetch_users_with_details') {
    $limit      = (int)($_POST['limit']  ?? 10);
    $offset     = (int)($_POST['offset'] ?? 0);
    $type       = $_POST['type']       ?? 'all_users';
    $internship = !empty($_POST['internship']) ? mysqli_real_escape_string($conn, $_POST['internship']) : null;
    $batch_id   = !empty($_POST['batch'])      ? $_POST['batch'] : null;

    // Convert dates — HTML input sends YYYY-MM-DD, PHP used DD/MM/YYYY conversion to YYYY-MM-DD
    $start_date = null;
    $end_date   = null;
    if (!empty($_POST['start_date'])) {
        $d = DateTime::createFromFormat('Y-m-d', $_POST['start_date']);
        if ($d) $start_date = $d->format('Y-m-d');
    }
    if (!empty($_POST['end_date'])) {
        $d = DateTime::createFromFormat('Y-m-d', $_POST['end_date']);
        if ($d) $end_date = $d->format('Y-m-d');
    }

    // date validation
    if ($start_date && $end_date && $start_date > $end_date) {
        echo json_encode(['status'=>'error','message'=>'Start Date should be less than End Date']);
        exit;
    }

    // resolve batch_id → batch date string — same as PHP
    $batch = null;
    if ($batch_id) {
        $bRes = $conn->query("SELECT date FROM exam_dates WHERE id = '$batch_id' LIMIT 1");
        $bRow = $bRes ? mysqli_fetch_assoc($bRes) : null;
        $batch = $bRow ? mysqli_real_escape_string($conn, $bRow['date']) : null;
    }

    $data  = [];
    $count = 0;

    /* ── all_users ── */
    if ($type === 'all_users') {
        $where = '';
        if ($start_date && $end_date) $where = " WHERE registered_at BETWEEN '$start_date' AND '$end_date'";

        $sql = "SELECT user_id, name, email, phone, registered_at, internship_reminder_email
                FROM users $where ORDER BY registered_at DESC LIMIT $limit OFFSET $offset";
        $res = mysqli_query($conn, $sql);
        if ($res) while ($r = mysqli_fetch_assoc($res)) $data[] = $r;

        $cntSql = "SELECT COUNT(*) AS count FROM users $where";
        $cntRes = mysqli_query($conn, $cntSql);
        if ($cntRes) $count = (int)mysqli_fetch_assoc($cntRes)['count'];

    /* ── specific_internship_users ── */
    } else if ($type === 'specific_internship_users') {
        $conditions = [];
        if ($internship) $conditions[] = "ip.internship = '$internship'";
        if ($batch)      $conditions[] = "ip.batch = '$batch'";
        if ($start_date && $end_date) $conditions[] = "ip.paid_at BETWEEN '$start_date' AND '$end_date'";
        $where = count($conditions) ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $sql = "SELECT u.user_id, u.name, u.email, u.phone, u.registered_at, u.internship_reminder_email
                FROM users u INNER JOIN internship_payment ip ON u.user_id = ip.user_id
                $where ORDER BY ip.paid_at DESC LIMIT $limit OFFSET $offset";
        $res = mysqli_query($conn, $sql);
        if ($res) while ($r = mysqli_fetch_assoc($res)) $data[] = $r;

        $cntSql = "SELECT COUNT(*) AS count FROM users u
                   INNER JOIN internship_payment ip ON u.user_id = ip.user_id $where";
        $cntRes = mysqli_query($conn, $cntSql);
        if ($cntRes) $count = (int)mysqli_fetch_assoc($cntRes)['count'];
    }

    echo json_encode(['status'=>'success','data'=>$data,'count'=>$count]);
    exit;
}

/* ════════════════════════════════════════
   SEND INTERNSHIP REMINDER EMAIL
   Exact same as functions.php send_internship_reminder_email handler (line 2442):
   sendTemplateEmail(15, email)
   UPDATE users SET internship_reminder_email = N
════════════════════════════════════════ */
if ($action === 'send_internship_reminder_email') {
    $user_id = (int)($_POST['user_id'] ?? 0);
    if (!$user_id) {
        echo json_encode(['status'=>'error','message'=>'user_id required']);
        exit;
    }

    $sql    = "SELECT email, internship_reminder_email FROM users WHERE user_id = $user_id LIMIT 1";
    $result = $conn->query($sql);
    $row    = $result ? mysqli_fetch_assoc($result) : null;

    if (!$row) {
        echo json_encode(['status'=>'error','message'=>'User not found']);
        exit;
    }

    if (sendTemplateEmail(15, $row['email'])) {
        // Increment counter — same as PHP logic
        $new_count = ($row['internship_reminder_email'] == 0) ? 1 : (int)$row['internship_reminder_email'] + 1;
        mysqli_query($conn, "UPDATE users SET internship_reminder_email = $new_count WHERE user_id = $user_id");
        echo json_encode(['status'=>'success','message'=>'Email sent successfully!']);
    } else {
        logErr('send_email', "Template 15 failed for user $user_id");
        echo json_encode(['status'=>'error','message'=>'Error sending email!']);
    }
    exit;
}

logErr('fallback', "Unknown action='$action'");
echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;
?>