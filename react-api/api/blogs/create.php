<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('POST');
$jwt = require_jwt();

$input = get_json_input();

// Proxy to dashboard.internshipstudio.com (same as add_blogs.php)
$url = "https://dashboard.internshipstudio.com/api/post_blogs.php";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($input),
]);
$response = curl_exec($ch);
$error = curl_error($ch);
curl_close($ch);

if ($error) api_error("Failed: $error", 502);

$data = json_decode($response, true);
if ($data && ($data['status'] ?? '') === 'success') {
    api_success(['blog_id' => $data['id'] ?? null], 'Blog created');
} else {
    api_error($data['message'] ?? 'Failed to create blog', 400);
}
