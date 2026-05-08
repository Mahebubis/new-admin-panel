<?php
/*
 * /api/companies.php
 *
 * POST action=get_stats          → total/active/inactive/blocked counts
 * POST action=get_companies      → paginated list (keyword, status, limit, offset)
 * POST action=activate_company   → set status=active, gen password if empty, send email
 * POST action=block_company      → set status=blocked, close all jobs, send email
 * POST action=delete_company     → hard-delete from hiring_employer
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

// Performance tuning (mirrors PHP page)
$conn->query("SET SESSION tmp_table_size     = " . (256 * 1024 * 1024));
$conn->query("SET SESSION max_heap_table_size = " . (256 * 1024 * 1024));
$conn->query("SET SESSION sort_buffer_size    = " . ( 64 * 1024 * 1024));

$action = $_POST['action'] ?? '';

/* ══════════════════════════════════════
   GET STATS
══════════════════════════════════════ */
if ($action === 'get_stats') {
    $counts = [];
    foreach (['total', 'active', 'inactive', 'blocked'] as $s) {
        $sql = $s === 'total'
            ? "SELECT COUNT(*) AS c FROM hiring_employer"
            : "SELECT COUNT(*) AS c FROM hiring_employer WHERE status = '$s'";
        $r = $conn->query($sql);
        $counts[$s] = $r ? (int)$r->fetch_assoc()['c'] : 0;
    }
    echo json_encode(['success'=>true] + $counts);
    exit;
}

/* ══════════════════════════════════════
   GET COMPANIES (paginated)
══════════════════════════════════════ */
if ($action === 'get_companies') {
    $keyword = $conn->real_escape_string(trim($_POST['keyword'] ?? ''));
    $status  = $conn->real_escape_string(trim($_POST['status']  ?? ''));
    $limit   = max(1, min(100, (int)($_POST['limit']  ?? 10)));
    $offset  = max(0,           (int)($_POST['offset'] ?? 0));

    $where = [];
    if ($status) $where[] = "he.status = '$status'";
    if ($keyword) $where[] = "(he.employer_email LIKE '%$keyword%' OR he.employer_name LIKE '%$keyword%' OR he.employer_phone LIKE '%$keyword%')";
    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    // Total count for pagination
    $countSql = "SELECT COUNT(*) AS c FROM hiring_employer he $whereClause";
    $countRes = $conn->query($countSql);
    $total    = $countRes ? (int)$countRes->fetch_assoc()['c'] : 0;

    // Order: if status filter, by date; else inactive first, then blocked, then active
    $order = $status
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
    $data    = [];
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
   ACTIVATE COMPANY
══════════════════════════════════════ */
if ($action === 'activate_company') {
    $employer_id = (int)($_POST['employer_id'] ?? 0);
    if (!$employer_id) { echo json_encode(['success'=>false,'message'=>'Invalid employer ID']); exit; }

    // Check if password exists
    $res = $conn->query("SELECT employer_password, employer_email, employer_name FROM hiring_employer WHERE employer_id = $employer_id");
    if (!$res || !$res->num_rows) { echo json_encode(['success'=>false,'message'=>'Company not found']); exit; }
    $row = $res->fetch_assoc();

    $password = '';
    if (empty($row['employer_password'])) {
        // Generate random 12-char password
        $chars    = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $password = substr(str_shuffle(str_repeat($chars, 3)), 0, 12);
        $hash     = password_hash($password, PASSWORD_BCRYPT);
        $conn->query("UPDATE hiring_employer SET employer_password='$hash', status='active', block_reason=NULL WHERE employer_id=$employer_id");
    } else {
        $conn->query("UPDATE hiring_employer SET status='active', block_reason=NULL WHERE employer_id=$employer_id");
    }

    if ($conn->affected_rows >= 0) {
        // Send activation email if password was generated
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
   BLOCK COMPANY
══════════════════════════════════════ */
if ($action === 'block_company') {
    $employer_id  = (int)($_POST['employer_id'] ?? 0);
    $block_reason = $conn->real_escape_string(trim($_POST['block_reason'] ?? ''));

    if (!$employer_id) { echo json_encode(['success'=>false,'message'=>'Invalid employer ID']); exit; }

    $conn->query("UPDATE hiring_employer SET status='blocked', block_reason='$block_reason' WHERE employer_id=$employer_id");

    if ($conn->affected_rows >= 0) {
        // Close all active job listings
        $conn->query("UPDATE job_list SET status='Close' WHERE employer_id=$employer_id");

        // Send block email
        $res = $conn->query("SELECT employer_email, employer_name FROM hiring_employer WHERE employer_id=$employer_id");
        if ($res && $res->num_rows && function_exists('sendEmail')) {
            $row = $res->fetch_assoc();
            $subject = '[Internship Studio] Your company account has been blocked.';
            $msg = $row['employer_name'] . ',<br><br>Unfortunately, your account has been blocked due to the following reason:<br><br>'
                 . '<b>Reason:</b> ' . $block_reason . '<br><br>'
                 . 'If you believe this is a mistake, please contact us at contact@internshipstudio.com<br><br>'
                 . 'Best Regards,<br>Internship Studio';
            sendEmail($row['employer_email'], $subject, $msg);
        }
        echo json_encode(['success'=>true,'status'=>'success','message'=>'Company blocked successfully']);
    } else {
        echo json_encode(['success'=>false,'status'=>'failed','message'=>'Failed to block company']);
    }
    exit;
}

/* ══════════════════════════════════════
   DELETE COMPANY
══════════════════════════════════════ */
if ($action === 'delete_company') {
    $employer_id = (int)($_POST['employer_id'] ?? 0);
    if (!$employer_id) { echo json_encode(['success'=>false,'message'=>'Invalid employer ID']); exit; }

    $conn->begin_transaction();
    try {
        $conn->query("DELETE FROM hiring_employer WHERE employer_id=$employer_id");
        $conn->commit();
        echo json_encode(['success'=>true,'status'=>'success','message'=>'Company deleted successfully']);
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(['success'=>false,'status'=>'failed','message'=>'Failed to delete: '.$e->getMessage()]);
    }
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>