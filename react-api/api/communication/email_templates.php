<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

function logErr($ctx, $msg) {
    file_put_contents('/home/istudio/logs/email-templates.log',
        '[' . date('Y-m-d H:i:s') . '] [' . $ctx . '] ' . $msg . PHP_EOL,
        FILE_APPEND | LOCK_EX);
}

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? $_GET['action'] ?? '';

/* ════════════════════════════════════════
   FETCH ALL TEMPLATES
   SELECT * FROM email_template
   Same as PHP's $sql = "SELECT * FROM email_template"
════════════════════════════════════════ */
if ($action === 'fetch_templates' || $_SERVER['REQUEST_METHOD'] === 'GET') {
    $res = mysqli_query($conn, "SELECT * FROM email_template ORDER BY id ASC");
    if (!$res) {
        logErr('fetch', mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
        exit;
    }
    $templates = [];
    while ($r = mysqli_fetch_assoc($res)) $templates[] = $r;
    echo json_encode(['status'=>'success','templates'=>$templates]);
    exit;
}

/* ════════════════════════════════════════
   CREATE EMAIL TEMPLATE
   Exact same as functions.php create_email_template handler:
   INSERT INTO email_template (title, subject, message)
   Uses prepare()/bind_param() same as PHP
════════════════════════════════════════ */
if ($action === 'create_email_template') {
    $email_title   = trim($_POST['email_title']   ?? '');
    $email_subject = trim($_POST['email_subject'] ?? '');
    $email_body    = trim($_POST['email_body']    ?? '');

    if (!$email_title || !$email_subject || !$email_body) {
        echo json_encode(['status'=>'error','message'=>'All fields are required']);
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO email_template (title, subject, message) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $email_title, $email_subject, $email_body);
    $result = $stmt->execute();
    $stmt->close();

    if ($result) {
        echo json_encode(['status'=>'success','message'=>'Email template created!']);
    } else {
        logErr('create', $conn->error);
        echo json_encode(['status'=>'error','message'=>'Failed to create email template!']);
    }
    exit;
}

/* ════════════════════════════════════════
   UPDATE EMAIL TEMPLATE
   Exact same as functions.php update_email_template handler:
   UPDATE email_template SET title=?, subject=?, message=? WHERE id=?
════════════════════════════════════════ */
if ($action === 'update_email_template') {
    $email_title   = trim($_POST['email_title']   ?? '');
    $email_subject = trim($_POST['email_subject'] ?? '');
    $email_body    = trim($_POST['email_body']    ?? '');
    $id            = (int)($_POST['id']           ?? 0);

    if (!$email_title || !$email_subject || !$email_body) {
        echo json_encode(['status'=>'error','message'=>'All fields are required']);
        exit;
    }
    if (!$id) {
        echo json_encode(['status'=>'error','message'=>'Template ID required']);
        exit;
    }

    $stmt = $conn->prepare("UPDATE email_template SET title = ?, subject = ?, message = ? WHERE id = ?");
    $stmt->bind_param("sssi", $email_title, $email_subject, $email_body, $id);
    $result = $stmt->execute();
    $stmt->close();

    if ($result) {
        echo json_encode(['status'=>'success','message'=>'Email template updated!']);
    } else {
        logErr('update', $conn->error);
        echo json_encode(['status'=>'error','message'=>'Failed to update email template!']);
    }
    exit;
}

/* ════════════════════════════════════════
   SEND TEST EMAIL
   Exact same as functions.php send_test_email handler:
   sendTemplateEmail($id, $email)
════════════════════════════════════════ */
if ($action === 'send_test_email') {
    $id    = (int)trim($_POST['id']    ?? 0);
    $email = trim($_POST['email'] ?? '');

    if (!$id || !$email) {
        echo json_encode(['status'=>'error','message'=>'ID and email are required']);
        exit;
    }

    try {
        if (sendTemplateEmail($id, $email)) {
            echo json_encode(['status'=>'success','message'=>'Test email sent!']);
        } else {
            echo json_encode(['status'=>'error','message'=>'Failed to send test email!']);
        }
    } catch (Throwable $e) {
        logErr('send_test', $e->getMessage());
        echo json_encode(['status'=>'error','message'=>'Failed to send test email!']);
    }
    exit;
}

logErr('fallback', "Unknown action='$action'");
echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;
?>