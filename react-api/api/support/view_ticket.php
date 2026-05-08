<?php
/*
 * /api/view-ticket.php
 *
 * POST action=get_ticket      (ticket_id)              → ticket + user info + admin_user_id
 * POST action=get_messages    (ticket_id)              → all messages
 * POST action=get_agents                               → all agents
 * POST action=get_nav         (ticket_id)              → prev/next open ticket IDs
 * POST action=close_ticket    (ticket_id)              → set status='closed'
 * POST action=update_agent    (ticket_id, agent_id)    → assign agent
 * POST action=send_reply      (ticket_id, message)     → insert message, reopen, send email
 *                              [+ file upload: attachments[]]
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

// Admin user_id from session (same as PHP's $user_id = $_SESSION['user_id'])
$admin_user_id = $_SESSION['user_id'] ?? 0;

/* ══════════════════════════════════════
   GET TICKET + USER INFO
══════════════════════════════════════ */
if ($action === 'get_ticket') {
    $tid = (int)($_POST['ticket_id'] ?? 0);
    if (!$tid) { echo json_encode(['success'=>false,'message'=>'Missing ticket_id']); exit; }

    $res = $conn->query("
        SELECT st.*, u.fname, u.name, u.email
        FROM support_tickets st
        INNER JOIN users u ON u.user_id = st.user_id
        WHERE st.ticket_id = $tid
    ");
    $ticket = $res ? $res->fetch_assoc() : null;
    if (!$ticket) { echo json_encode(['success'=>false,'message'=>'Ticket not found']); exit; }

    echo json_encode([
        'success'       => true,
        'ticket'        => $ticket,
        'admin_user_id' => $admin_user_id,
    ]);
    exit;
}

/* ══════════════════════════════════════
   GET MESSAGES
══════════════════════════════════════ */
if ($action === 'get_messages') {
    $tid = (int)($_POST['ticket_id'] ?? 0);
    $res = $conn->query("SELECT * FROM support_messages WHERE ticket_id=$tid ORDER BY created_at ASC");
    $msgs = [];
    if ($res) while ($r = $res->fetch_assoc()) $msgs[] = $r;
    echo json_encode(['success'=>true,'messages'=>$msgs]);
    exit;
}

/* ══════════════════════════════════════
   GET AGENTS
══════════════════════════════════════ */
if ($action === 'get_agents') {
    $res    = $conn->query("SELECT agent_id, agent_name, agent_email FROM support_agent");
    $agents = [];
    if ($res) while ($r = $res->fetch_assoc()) $agents[] = $r;
    echo json_encode(['success'=>true,'agents'=>$agents]);
    exit;
}

/* ══════════════════════════════════════
   GET NAVIGATION (prev/next open tickets)
══════════════════════════════════════ */
if ($action === 'get_nav') {
    $tid  = (int)($_POST['ticket_id'] ?? 0);

    $next = null;
    $prev = null;

    $r = $conn->query("SELECT ticket_id FROM support_tickets WHERE ticket_id > $tid AND status='open' ORDER BY ticket_id ASC LIMIT 1");
    if ($r && $row = $r->fetch_assoc()) $next = (int)$row['ticket_id'];

    $r = $conn->query("SELECT ticket_id FROM support_tickets WHERE ticket_id < $tid AND status='open' ORDER BY ticket_id DESC LIMIT 1");
    if ($r && $row = $r->fetch_assoc()) $prev = (int)$row['ticket_id'];

    echo json_encode(['success'=>true,'next'=>$next,'prev'=>$prev]);
    exit;
}

/* ══════════════════════════════════════
   CLOSE TICKET
══════════════════════════════════════ */
if ($action === 'close_ticket') {
    $tid = (int)($_POST['ticket_id'] ?? 0);
    $conn->query("UPDATE support_tickets SET status='closed' WHERE ticket_id=$tid");
    echo json_encode($conn->affected_rows >= 0
        ? ['success'=>true, 'message'=>'Ticket closed']
        : ['success'=>false,'message'=>'Failed to close']);
    exit;
}

/* ══════════════════════════════════════
   UPDATE AGENT
══════════════════════════════════════ */
if ($action === 'update_agent') {
    $tid      = (int)($_POST['ticket_id'] ?? 0);
    $agent_id = (int)($_POST['agent_id']  ?? 0);
    $conn->query("UPDATE support_tickets SET agent_id=$agent_id WHERE ticket_id=$tid");
    echo json_encode($conn->affected_rows >= 0
        ? ['success'=>true, 'message'=>'Agent updated']
        : ['success'=>false,'message'=>'Failed']);
    exit;
}

/* ══════════════════════════════════════
   SEND REPLY  — insert message, reopen ticket, send email, handle attachments
   Matches PHP's addMessage() + file upload logic exactly.
══════════════════════════════════════ */
if ($action === 'send_reply') {
    header('Content-Type: application/json'); // already set but re-assert after multipart
    $tid     = (int)($_POST['ticket_id'] ?? 0);
    $message = trim($_POST['message']    ?? '');

    if (!$tid || $message === '') {
        echo json_encode(['success'=>false,'message'=>'Missing fields']); exit;
    }
    if (strlen($message) < 20 || strlen($message) > 1000) {
        echo json_encode(['success'=>false,'message'=>'Message must be between 20 and 1000 characters']); exit;
    }

    // Fetch ticket for email sending
    $ticketRes = $conn->query("SELECT st.*, u.email, u.fname FROM support_tickets st INNER JOIN users u ON u.user_id=st.user_id WHERE st.ticket_id=$tid");
    $ticket    = $ticketRes ? $ticketRes->fetch_assoc() : null;
    if (!$ticket) { echo json_encode(['success'=>false,'message'=>'Ticket not found']); exit; }

    // Insert message
    $stmt = $conn->prepare("INSERT INTO support_messages (ticket_id, user_id, message) VALUES (?, ?, ?)");
    $stmt->bind_param('iis', $tid, $admin_user_id, $message);
    $ok = $stmt->execute();

    if (!$ok) { echo json_encode(['success'=>false,'message'=>'Failed to save message']); exit; }

    // Reopen ticket
    $conn->query("UPDATE support_tickets SET status='open' WHERE ticket_id=$tid");

    // Send template email (template 16)
    if (function_exists('sendTemplateEmail')) {
        $shortMsg = strlen($message) > 50 ? substr($message, 0, 50) . '...' : $message;
        sendTemplateEmail(16, $ticket['email'], [
            'ticket_subject'        => $ticket['subject'],
            'admin_message_response'=> $shortMsg,
            'ticket_id'             => $tid,
        ]);
    }

    // Handle file attachments
    $hasAttachment = false;
    if (isset($_FILES['attachments']) && !empty($_FILES['attachments']['name'][0])) {
        $allowed = ['jpg','jpeg','png','pdf','doc','docx'];
        foreach ($_FILES['attachments']['name'] as $k => $fname) {
            if ($_FILES['attachments']['error'][$k] !== 0) continue;
            if ($_FILES['attachments']['size'][$k] > 1000000) continue;

            $ext = strtolower(pathinfo($fname, PATHINFO_EXTENSION));
            if (!in_array($ext, $allowed)) continue;

            $newName  = uniqid('', true) . '.' . $ext;
            $dir      = "../../cit2/assets/support/attachments/{$admin_user_id}/{$tid}";
            if (!file_exists($dir)) mkdir($dir, 0777, true);
            move_uploaded_file($_FILES['attachments']['tmp_name'][$k], "$dir/$newName");
            $hasAttachment = true;
        }
        if ($hasAttachment) {
            $conn->query("UPDATE support_messages SET attachment=1 WHERE ticket_id=$tid ORDER BY message_id DESC LIMIT 1");
        }
    }

    echo json_encode(['success'=>true,'message'=>'Reply sent successfully','has_attachment'=>$hasAttachment]);
    exit;
}

/* ══════════════════════════════════════
   GET ATTACHMENTS  (list files from filesystem)
══════════════════════════════════════ */
if ($action === 'get_attachments') {
    $tid     = (int)($_POST['ticket_id'] ?? 0);
    $user_id = (int)($_POST['user_id']   ?? 0);

    $result = ['user'=>[], 'admin'=>[]];
    $base   = 'https://cit2.internshipstudio.com/assets/support/attachments';

    // User attachments
    $userDir = "../../cit2/assets/support/attachments/{$user_id}/{$tid}";
    if (file_exists($userDir)) {
        foreach (scandir($userDir) as $f) {
            if ($f === '.' || $f === '..') continue;
            $result['user'][] = ['name'=>$f, 'url'=>"$base/{$user_id}/{$tid}/{$f}"];
        }
    }

    // Admin attachments
    $adminDir = "../../cit2/assets/support/attachments/{$admin_user_id}/{$tid}";
    if (file_exists($adminDir)) {
        foreach (scandir($adminDir) as $f) {
            if ($f === '.' || $f === '..') continue;
            $result['admin'][] = ['name'=>$f, 'url'=>"$base/{$admin_user_id}/{$tid}/{$f}"];
        }
    }

    echo json_encode(['success'=>true,'attachments'=>$result]);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>