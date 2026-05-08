<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('POST');
$jwt = require_jwt();
require_permission('manage_referrals', $jwt);

$input = get_json_input();
$user_id = intval($input['user_id'] ?? 0);
$status = $input['status'] ?? '';

if (!$user_id || !in_array($status, ['approved', 'rejected'])) {
    api_error('Invalid params: user_id and status (approved/rejected) are required');
}

// The original PHP calls dashboard.internshipstudio.com to update status
$url = 'https://dashboard.internshipstudio.com/api/change_referral_request_status.php';

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['user_id' => $user_id, 'status' => $status]),
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    api_error("Failed to update: $error", 502);
}

$data = json_decode($response, true);

if ($data && ($data['status'] ?? '') === 'success') {
    api_success([], ucfirst($status) . " user #$user_id successfully");
} else {
    api_error($data['message'] ?? 'Failed to update referral status', $httpCode >= 400 ? $httpCode : 400);
}
