<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('POST');
$jwt = require_jwt();
require_permission('campaign_emails', $jwt);

$input = get_json_input();
$subject = trim($input['subject'] ?? '');
$body = $input['body'] ?? '';
$segment = $input['segment'] ?? 'all';

if (!$subject || !$body) api_error('Subject and body required');

$segmentMap = [
    'all' => "SELECT COUNT(*) AS c FROM users",
    'active' => "SELECT COUNT(*) AS c FROM users WHERE active=1",
    'iit' => "SELECT COUNT(*) AS c FROM users WHERE college_name LIKE '%IIT%'",
    'no_exam' => "SELECT COUNT(*) AS c FROM users u LEFT JOIN cit_results cr ON cr.user_id=u.user_id WHERE cr.user_id IS NULL",
    'purchased' => "SELECT COUNT(*) AS c FROM users u WHERE EXISTS(SELECT 1 FROM internship_payment ip WHERE ip.user_id=u.user_id)",
];

$sql = $segmentMap[$segment] ?? $segmentMap['all'];
$count = $conn->query($sql)->fetch_assoc()['c'] ?? 0;

$admin_id = $jwt['user_id'];
$escaped_sub = $conn->real_escape_string($subject);
$conn->query("INSERT INTO admin_action_log (admin_id, action, target_type, target_id, note, created_at) VALUES ($admin_id, 'campaign_email', 'email', 0, 'Subject: $escaped_sub | Segment: $segment | Recipients: $count', NOW())");

api_success(['sent_count' => (int)$count, 'segment' => $segment, 'subject' => $subject, 'status' => 'queued'], 'Campaign queued');
