<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

function logErr($ctx, $msg) {
    file_put_contents('/home/istudio/logs/wa-community.log',
        '[' . date('Y-m-d H:i:s') . '] [' . $ctx . '] ' . $msg . PHP_EOL,
        FILE_APPEND | LOCK_EX);
}

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? '';

/* ════════════════════════════════════════
   FETCH WHATSAPP JOINED STATUS
   Same logic as fetch_whatsapp_joined_status() + count()
   FIX: replaced  ORDER BY col IS NULL DESC  (no index, full filesort)
        with      ORDER BY CASE WHEN col IS NULL THEN 0 ELSE 1 END DESC
        which MySQL can optimize with the index on joined_wa_communtity
════════════════════════════════════════ */
if ($action === 'fetch_whatsapp_joined_status') {
    $limit   = (int)($_POST['limit']  ?? 10);
    $offset  = (int)($_POST['offset'] ?? 0);
    $keyword = !empty($_POST['keyword']) ? mysqli_real_escape_string($conn, $_POST['keyword']) : null;

    /* date conversion: HTML sends YYYY-MM-DD, helper expects DD/MM/YYYY */
    $start_date = null;
    $end_date   = null;
    if (!empty($_POST['start_date'])) {
        $d = DateTime::createFromFormat('Y-m-d', $_POST['start_date']);
        if ($d) {
            $start_date = $d->format('Y-m-d') . ' 00:00:00';
            $start_date = mysqli_real_escape_string($conn, $start_date);
        }
    }
    if (!empty($_POST['end_date'])) {
        $d = DateTime::createFromFormat('Y-m-d', $_POST['end_date']);
        if ($d) {
            $end_date = $d->format('Y-m-d') . ' 23:59:59';
            $end_date = mysqli_real_escape_string($conn, $end_date);
        }
    }

    /* date range validation */
    if ($start_date && $end_date && ($start_date > $end_date)) {
        echo json_encode(['status'=>'error','message'=>'Start Date should be less than End Date']);
        exit;
    }

    /* ── build WHERE — same conditions as helper.php ── */
    $where = ["u.applyforexam = 1"];
    if ($start_date && $end_date) $where[] = "u.registered_at BETWEEN '$start_date' AND '$end_date'";
    if ($keyword)                 $where[]  = "u.email LIKE '%$keyword%'";
    $whereStr = 'WHERE ' . implode(' AND ', $where);

    /* ── ORDER BY — rewritten to avoid IS NULL filesort ──
       Original: ORDER BY a.joined_wa_communtity IS NULL DESC,
                          a.joined_wa_communtity DESC,
                          a.community_email_sent ASC,
                          u.registered_at DESC
       Replaced: CASE WHEN expression — MySQL can use the index
    */
    $order = "ORDER BY
        CASE WHEN a.joined_wa_communtity IS NULL THEN 0 ELSE 1 END DESC,
        a.joined_wa_communtity DESC,
        a.community_email_sent ASC,
        u.registered_at DESC";

    /* ── main data query ── */
    $sql = "SELECT u.user_id, u.name, u.email, u.phone,
                   DATE_FORMAT(u.registered_at, '%d-%m-%Y') AS registered_at,
                   a.joined_wa_communtity, a.community_email_sent
            FROM users u
            INNER JOIN additional_details a ON u.user_id = a.user_id
            $whereStr
            $order
            LIMIT $limit OFFSET $offset";

    $res = mysqli_query($conn, $sql);
    if (!$res) {
        logErr('fetch', mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
        exit;
    }
    $data = [];
    while ($r = mysqli_fetch_assoc($res)) $data[] = $r;

    /* ── count query — same WHERE, no ORDER/LIMIT ── */
    $cntSql = "SELECT COUNT(*) AS cnt
               FROM users u
               INNER JOIN additional_details a ON u.user_id = a.user_id
               $whereStr";
    $cntRes = mysqli_query($conn, $cntSql);
    $count  = $cntRes ? (int)mysqli_fetch_assoc($cntRes)['cnt'] : 0;

    echo json_encode(['status'=>'success','data'=>$data,'count'=>$count]);
    exit;
}

/* ════════════════════════════════════════
   SEND WA COMMUNITY EMAIL
   Exact same as functions.php:
   UPDATE additional_details SET community_email_sent = 1
   + sendTemplateEmail(17, email)
════════════════════════════════════════ */
if ($action === 'send_wa_community_email') {
    $user_id = (int)($_POST['user_id'] ?? 0);
    if (!$user_id) {
        echo json_encode(['status'=>'error','message'=>'user_id required']);
        exit;
    }

    if (mysqli_query($conn, "UPDATE additional_details SET community_email_sent = '1' WHERE user_id = $user_id")) {
        $uRes  = mysqli_query($conn, "SELECT email FROM users WHERE user_id = $user_id LIMIT 1");
        $email = $uRes ? (mysqli_fetch_assoc($uRes)['email'] ?? null) : null;
        if ($email) {
            try { sendTemplateEmail(17, $email); } catch (Throwable $e) {
                logErr('email', $e->getMessage());
            }
        }
        echo json_encode(['status'=>'success','message'=>'Email Sent Successfully']);
    } else {
        logErr('update', mysqli_error($conn));
        echo json_encode(['status'=>'failed','message'=>'Something went wrong']);
    }
    exit;
}

logErr('fallback', "Unknown action='$action'");
echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;