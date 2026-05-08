<?php
/*
 * /api/iit-companies.php
 *
 * IIT E-Summit companies only (special_event = 1 on hiring_employer).
 *
 * POST action=get_stats           → total/active/inactive/blocked counts (all with special_event=1)
 * POST action=get_companies       → paginated, always filters special_event=1
 * POST action=activate_company    → set status='active', gen password, send activation email
 * POST action=iit_block_company   → set special_event=0 (removes from IIT event), send removal email
 *
 * Table: hiring_employer, job_list
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['success'=>false,'message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? '';

/* ══════════════════════════════════════
   GET STATS  (all with special_event = 1)
══════════════════════════════════════ */
if ($action === 'get_stats') {
    $counts = [];
    // total = all special_event=1
    $r = $conn->query("SELECT COUNT(*) AS c FROM hiring_employer WHERE special_event = 1");
    $counts['total'] = $r ? (int)$r->fetch_assoc()['c'] : 0;

    foreach (['active','inactive','blocked'] as $s) {
        $r = $conn->query("SELECT COUNT(*) AS c FROM hiring_employer WHERE special_event=1 AND status='$s'");
        $counts[$s] = $r ? (int)$r->fetch_assoc()['c'] : 0;
    }

    echo json_encode(['success'=>true] + $counts);
    exit;
}

/* ══════════════════════════════════════
   GET COMPANIES (special_event=1 always)
══════════════════════════════════════ */
if ($action === 'get_companies') {
    $keyword = $conn->real_escape_string(trim($_POST['keyword'] ?? ''));
    $status  = $conn->real_escape_string(trim($_POST['status']  ?? ''));
    $limit   = max(1, min(100, (int)($_POST['limit']  ?? 10)));
    $offset  = max(0,           (int)($_POST['offset'] ?? 0));

    // Always filter by special_event = 1
    $where = ["he.special_event = 1"];
    if ($status && $status !== 'none') $where[] = "he.status = '$status'";
    if ($keyword) $where[] = "(he.employer_email LIKE '%$keyword%' OR he.employer_name LIKE '%$keyword%' OR he.employer_phone LIKE '%$keyword%')";
    $whereClause = 'WHERE ' . implode(' AND ', $where);

    // Total count
    $countRes = $conn->query("SELECT COUNT(*) AS c FROM hiring_employer he $whereClause");
    $total    = $countRes ? (int)$countRes->fetch_assoc()['c'] : 0;

    // Order: inactive first, then blocked, then active when no status filter
    $order = ($status && $status !== 'none')
        ? "ORDER BY he.registered_at DESC"
        : "ORDER BY FIELD(he.status,'inactive','blocked','active'), he.registered_at DESC";

    $dataSql = "
        SELECT
            he.employer_id,
            he.employer_name,
            he.employer_email,
            he.employer_phone,
            he.employer_location,
            he.employer_website,
            he.employer_social,
            he.email_verified,
            he.special_event,
            he.doc_ext,
            he.status,
            he.block_reason,
            he.registered_at,
            (SELECT COUNT(*) FROM job_list hj WHERE hj.employer_id = he.employer_id)                        AS total_posting_count,
            (SELECT COUNT(*) FROM job_list hj WHERE hj.employer_id = he.employer_id AND hj.status='Active') AS open_posting_count
        FROM hiring_employer he
        $whereClause
        $order
        LIMIT $limit OFFSET $offset
    ";

    $dataRes = $conn->query($dataSql);
    $data = [];
    if ($dataRes) while ($row = $dataRes->fetch_assoc()) {
        $row['registered_at']       = date('d-m-Y H:i', strtotime($row['registered_at']));
        $row['email_verified']      = (int)$row['email_verified'];
        $row['special_event']       = (int)$row['special_event'];
        $row['total_posting_count'] = (int)$row['total_posting_count'];
        $row['open_posting_count']  = (int)$row['open_posting_count'];
        $data[] = $row;
    }

    echo json_encode(['success'=>true,'data'=>$data,'total'=>$total]);
    exit;
}

/* ══════════════════════════════════════
   ACTIVATE COMPANY  (same as general companies)
══════════════════════════════════════ */
if ($action === 'activate_company') {
    $employer_id = (int)($_POST['employer_id'] ?? 0);
    if (!$employer_id) { echo json_encode(['success'=>false,'message'=>'Invalid employer ID']); exit; }

    $res = $conn->query("SELECT employer_password, employer_email, employer_name FROM hiring_employer WHERE employer_id=$employer_id");
    if (!$res || !$res->num_rows) { echo json_encode(['success'=>false,'message'=>'Company not found']); exit; }
    $row = $res->fetch_assoc();

    $password = '';
    if (empty($row['employer_password'])) {
        $chars    = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $password = substr(str_shuffle(str_repeat($chars, 3)), 0, 12);
        $hash     = password_hash($password, PASSWORD_BCRYPT);
        $conn->query("UPDATE hiring_employer SET employer_password='$hash', status='active', block_reason=NULL WHERE employer_id=$employer_id");
    } else {
        $conn->query("UPDATE hiring_employer SET status='active', block_reason=NULL WHERE employer_id=$employer_id");
    }

    if ($conn->affected_rows >= 0) {
        if ($password && function_exists('sendEmail')) {
            $subject = '[Internship Studio] Your company account has been activated.';
            $msg = $row['employer_name'] . ',<br><br>We are pleased to inform you that your account has been successfully activated.<br><br>'
                 . 'Your registration details are:<br><b>Dashboard Link:</b> https://hire.internshipstudio.com<br>'
                 . '<b>Registered Email:</b> ' . $row['employer_email'] . '<br>'
                 . '<b>Temporary Password:</b> ' . $password . '<br><br>'
                 . 'Best Regards,<br>Team Internship Studio';
            sendEmail($row['employer_email'], $subject, $msg);
        }
        echo json_encode(['success'=>true,'status'=>'success','message'=>'Company approved successfully']);
    } else {
        echo json_encode(['success'=>false,'status'=>'failed','message'=>'Failed to approve company']);
    }
    exit;
}

/* ══════════════════════════════════════
   IIT BLOCK COMPANY
   Sets special_event = 0 (does NOT change status).
   Sends removal-from-event email.
══════════════════════════════════════ */
if ($action === 'iit_block_company') {
    $employer_id  = (int)($_POST['employer_id'] ?? 0);
    $block_reason = $conn->real_escape_string(trim($_POST['block_reason'] ?? ''));

    if (!$employer_id) { echo json_encode(['success'=>false,'message'=>'Invalid employer ID']); exit; }

    $conn->query("UPDATE hiring_employer SET special_event = 0 WHERE employer_id = $employer_id");

    if ($conn->affected_rows >= 0) {
        // Send IIT E-Summit removal email
        $res = $conn->query("SELECT employer_email, employer_name FROM hiring_employer WHERE employer_id=$employer_id");
        if ($res && $res->num_rows && function_exists('sendEmail')) {
            $row = $res->fetch_assoc();
            $subject = '[Internship Studio] Your Company\'s IIT E-Summit Priority Access has been Removed';
            $msg = $row['employer_name'] . ',<br><br>'
                 . 'We\'re writing to inform you that your company\'s priority access status for the IIT E-Summit partnership event has been removed. This action was taken by IIT E-Summit due to following reason:<br><br>'
                 . '<b>Reason:</b> ' . htmlspecialchars($block_reason) . '<br><br>'
                 . 'Please note:<br>'
                 . '1. Your company account on Internship Studio remains active.<br>'
                 . '2. You can continue to use our platform for hiring purposes.<br>'
                 . '3. However, you will no longer receive the prioritized visibility and benefits associated with the IIT E-Summit event.<br><br>'
                 . 'We appreciate your understanding.<br><br>'
                 . 'Best Regards,<br>Internship Studio';
            sendEmail($row['employer_email'], $subject, $msg);
        }
        echo json_encode(['success'=>true,'status'=>'success','message'=>'Company removed from IIT E-Summit successfully']);
    } else {
        echo json_encode(['success'=>false,'status'=>'failed','message'=>'Failed to remove company from event']);
    }
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>