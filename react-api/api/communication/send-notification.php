<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('POST');
$jwt = require_jwt();
require_permission('send_notification', $jwt);

$input = get_json_input();
$title = trim($input['title'] ?? '');
$body = trim($input['body'] ?? '');
$audience = $input['audience'] ?? 'all';
$type = $input['type'] ?? 'info';
$link = $input['link'] ?? '';
$image_url = $input['image_url'] ?? '';

if (!$title || !$body) api_error('Title and body required');

// Get target users based on audience
$audienceMap = [
    'all' => "SELECT user_id FROM users",
    'active' => "SELECT user_id FROM users WHERE active=1",
    'iit' => "SELECT user_id FROM users WHERE college_name LIKE '%IIT%' OR college_name LIKE '%Indian Institute of Technology%'",
    'no_exam' => "SELECT u.user_id FROM users u LEFT JOIN cit_results cr ON cr.user_id=u.user_id WHERE cr.user_id IS NULL AND u.applyforexam=1",
];

$sql = $audienceMap[$audience] ?? $audienceMap['all'];
$res = $conn->query($sql);
$count = $res->num_rows;

$admin_id = $jwt['user_id'];

// Insert master notification
$stmt = $conn->prepare("INSERT INTO notifications (title, body, type, link, image_url, audience, sent_by, sent_count) VALUES (?,?,?,?,?,?,?,?)");
$stmt->bind_param("ssssssii", $title, $body, $type, $link, $image_url, $audience, $admin_id, $count);
$stmt->execute();
$notif_id = $conn->insert_id;

// Batch insert user notifications
$batch = [];
while ($row = $res->fetch_assoc()) {
    $batch[] = "($notif_id, {$row['user_id']}, NOW())";
    if (count($batch) >= 500) {
        $conn->query("INSERT INTO user_notifications (notification_id, user_id, created_at) VALUES " . implode(',', $batch));
        $batch = [];
    }
}
if ($batch) {
    $conn->query("INSERT INTO user_notifications (notification_id, user_id, created_at) VALUES " . implode(',', $batch));
}

api_success(['sent_count' => $count, 'notification_id' => $notif_id], "Notification sent to $count users");
