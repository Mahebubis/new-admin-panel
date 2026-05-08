<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

function logErr($ctx, $msg) {
    file_put_contents('/home/istudio/logs/push-notification.log',
        '[' . date('Y-m-d H:i:s') . '] [' . $ctx . '] ' . $msg . PHP_EOL,
        FILE_APPEND | LOCK_EX);
}

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? $_GET['action'] ?? '';

/* ════════════════════════════════════════
   GET STATS (allowed / denied users)
   Same as PHP's page-load count query
════════════════════════════════════════ */
if ($action === 'get_stats' || $_SERVER['REQUEST_METHOD'] === 'GET') {
    $allowed = 0; $denied = 0;
    $res = mysqli_query($conn, "SELECT endpoint FROM user_push_notification");
    if ($res) while ($r = mysqli_fetch_assoc($res)) {
        if ($r['endpoint'] === 'denied') $denied++; else $allowed++;
    }
    // internship list for specific_internship_users dropdown
    $internships = [];
    $iRes = mysqli_query($conn, "SELECT id, internship_name FROM internship_list ORDER BY internship_name ASC");
    if ($iRes) while ($r = mysqli_fetch_assoc($iRes)) $internships[] = $r;

    echo json_encode(['status'=>'success','allowed'=>$allowed,'denied'=>$denied,'internships'=>$internships]);
    exit;
}

/* ════════════════════════════════════════
   GET USER REPORT (Check Data)
   Same as functions.php get_user_report handler — returns user list for preview/CSV
   Exact same 7 SQL queries as PHP
════════════════════════════════════════ */
if ($action === 'get_user_report') {
    $send_to        = mysqli_real_escape_string($conn, $_POST['send_to']         ?? 'all_users');
    $start_date     = mysqli_real_escape_string($conn, $_POST['start_date']      ?? '');
    $end_date       = mysqli_real_escape_string($conn, $_POST['end_date']        ?? '');
    $user_internship= mysqli_real_escape_string($conn, $_POST['user_internship'] ?? '');

    $base = "SELECT u.user_id, u.name, u.email, u.phone, u.registered_at, upn.endpoint
             FROM user_push_notification upn
             INNER JOIN users u ON u.user_id = upn.user_id";

    if ($send_to === 'all_users') {
        $sql = "$base WHERE upn.endpoint != 'denied'";
    } else if ($send_to === 'exam_given') {
        $sql = "$base INNER JOIN result r ON r.user_id = upn.user_id WHERE upn.endpoint != 'denied' AND u.registered_at BETWEEN '$start_date' AND '$end_date'";
    } else if ($send_to === 'exam_not_given') {
        $sql = "$base LEFT JOIN result r ON r.user_id = upn.user_id WHERE upn.endpoint != 'denied' AND u.registered_at BETWEEN '$start_date' AND '$end_date' AND r.user_id IS NULL";
    } else if ($send_to === 'internship_purchased') {
        $sql = "$base INNER JOIN internship_payment ip ON ip.user_id = upn.user_id WHERE upn.endpoint != 'denied' AND u.registered_at BETWEEN '$start_date' AND '$end_date'";
    } else if ($send_to === 'whatsapp_community_not_joined') {
        $sql = "$base INNER JOIN user_steps us ON us.user_id = upn.user_id WHERE upn.endpoint != 'denied' AND u.registered_at BETWEEN '$start_date' AND '$end_date' AND us.cit_whatsapp_community = 0";
    } else if ($send_to === 'specific_internship_users') {
        $sql = "$base INNER JOIN internship_payment ip ON ip.user_id = upn.user_id WHERE upn.endpoint != 'denied' AND u.registered_at BETWEEN '$start_date' AND '$end_date' AND ip.internship = '$user_internship'";
    } else if ($send_to === 'internship_not_purchased') {
        $sql = "$base INNER JOIN result r ON r.user_id = upn.user_id LEFT JOIN internship_payment ip ON ip.user_id = upn.user_id WHERE upn.endpoint != 'denied' AND u.registered_at BETWEEN '$start_date' AND '$end_date' AND r.user_id IS NOT NULL AND ip.user_id IS NULL";
    } else {
        echo json_encode(['status'=>'error','message'=>'Invalid send_to value']);
        exit;
    }

    $result = mysqli_query($conn, $sql);
    if (!$result) {
        logErr('get_user_report', mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
        exit;
    }

    $data = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $data[] = [
            'user_id'           => $row['user_id'],
            'user_name'         => $row['name'],
            'user_email'        => $row['email'],
            'user_phone'        => $row['phone'],
            'user_registered_at'=> $row['registered_at'],
            'endpoint'          => $row['endpoint'],
        ];
    }
    echo json_encode(['status'=>'success','message'=>'Data retrieved!','data'=>$data,'count'=>count($data)]);
    exit;
}

/* ════════════════════════════════════════
   SEND PUSH NOTIFICATION
   Same as functions.php send_push_notification handler:
   Queries same user_push_notification rows, sends via webPush library
   Requires minishlink/web-push to be installed on server
════════════════════════════════════════ */
if ($action === 'send_push_notification') {
    $title          = $_POST['title']          ?? '';
    $icon           = $_POST['icon']           ?? '';
    $body           = $_POST['body']           ?? '';
    $url            = $_POST['url']            ?? '';
    $send_to        = mysqli_real_escape_string($conn, $_POST['send_to']         ?? 'all_users');
    $start_date     = mysqli_real_escape_string($conn, $_POST['start_date']      ?? '');
    $end_date       = mysqli_real_escape_string($conn, $_POST['end_date']        ?? '');
    $user_internship= mysqli_real_escape_string($conn, $_POST['user_internship'] ?? '');

    if (!$title || !$body) {
        echo json_encode(['status'=>'error','message'=>'Title and body are required']);
        exit;
    }

    /* same query selection logic as PHP */
    $base = "SELECT upn.* FROM user_push_notification upn INNER JOIN users u ON u.user_id = upn.user_id";
    if ($send_to === 'all_users') {
        $sql = "SELECT * FROM user_push_notification WHERE endpoint != 'denied'";
    } else if ($send_to === 'exam_given') {
        $sql = "$base INNER JOIN result r ON r.user_id = upn.user_id WHERE upn.endpoint != 'denied' AND u.registered_at BETWEEN '$start_date' AND '$end_date'";
    } else if ($send_to === 'exam_not_given') {
        $sql = "$base LEFT JOIN result r ON r.user_id = upn.user_id WHERE upn.endpoint != 'denied' AND u.registered_at BETWEEN '$start_date' AND '$end_date' AND r.user_id IS NULL";
    } else if ($send_to === 'internship_purchased') {
        $sql = "$base INNER JOIN internship_payment ip ON ip.user_id = upn.user_id WHERE upn.endpoint != 'denied' AND u.registered_at BETWEEN '$start_date' AND '$end_date'";
    } else if ($send_to === 'whatsapp_community_not_joined') {
        $sql = "$base INNER JOIN user_steps us ON us.user_id = upn.user_id WHERE upn.endpoint != 'denied' AND u.registered_at BETWEEN '$start_date' AND '$end_date' AND us.cit_whatsapp_community = 0";
    } else if ($send_to === 'specific_internship_users') {
        $sql = "$base INNER JOIN internship_payment ip ON ip.user_id = upn.user_id WHERE upn.endpoint != 'denied' AND u.registered_at BETWEEN '$start_date' AND '$end_date' AND ip.internship = '$user_internship'";
    } else if ($send_to === 'internship_not_purchased') {
        $sql = "$base INNER JOIN result r ON r.user_id = upn.user_id LEFT JOIN internship_payment ip ON ip.user_id = upn.user_id WHERE upn.endpoint != 'denied' AND u.registered_at BETWEEN '$start_date' AND '$end_date' AND r.user_id IS NOT NULL AND ip.user_id IS NULL";
    } else {
        echo json_encode(['status'=>'error','message'=>'Invalid send_to value']);
        exit;
    }

    $payload = json_encode(['title'=>$title,'icon'=>$icon,'body'=>$body,'url'=>$url]);

    try {
        // webPush library — same as PHP
        $result = mysqli_query($conn, $sql);
        if (!$result) {
            logErr('send', mysqli_error($conn));
            echo json_encode(['status'=>'failed','message'=>'DB error: ' . mysqli_error($conn)]);
            exit;
        }

        while ($row = mysqli_fetch_assoc($result)) {
            $subscription = \Minishlink\WebPush\Subscription::create(json_decode($row['subscription'], true));
            $webPush->queueNotification($subscription, $payload);
        }

        $data = [];
        foreach ($webPush->flush() as $report) {
            $endpoint = $report->getEndpoint();
            $data[] = [
                'endpoint' => $endpoint,
                'success'  => $report->isSuccess(),
                'message'  => $report->isSuccess() ? 'Notification sent successfully!' : 'Failed to send notification!',
            ];
        }

        echo json_encode(['status'=>'success','message'=>'Notifications sent!','data'=>$data]);
    } catch (Throwable $e) {
        logErr('send', $e->getMessage());
        echo json_encode(['status'=>'error','message'=>'Push failed: ' . $e->getMessage()]);
    }
    exit;
}

logErr('fallback', "Unknown action='$action'");
echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;
?>