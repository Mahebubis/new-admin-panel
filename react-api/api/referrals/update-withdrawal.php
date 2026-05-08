<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('POST');
$jwt = require_jwt();
require_permission('manage_withdrawal', $jwt);

$input = get_json_input();
$id = intval($input['id'] ?? 0);
$payment_status = $input['payment_status'] ?? $input['status'] ?? '';

if (!$id || !$payment_status) {
    api_error('ID and status are required');
}

// Proxy to dashboard API
$url = 'https://dashboard.internshipstudio.com/api/change_withdrawal_request_status.php';

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['id' => $id, 'payment_status' => $payment_status]),
]);
$response = curl_exec($ch);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    api_error("Failed: $error", 502);
}

$data = json_decode($response, true);
if ($data && ($data['status'] ?? '') === 'success') {
    api_success([], "Withdrawal status updated to $payment_status");
} else {
    api_error($data['message'] ?? 'Failed to update', 400);
}
