<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('DELETE');
$jwt = require_jwt();

$input = get_json_input();
$id = intval($input['id'] ?? $_GET['id'] ?? 0);
if (!$id) api_error('Blog ID required');

// Proxy DELETE to dashboard.internshipstudio.com
$url = "https://dashboard.internshipstudio.com/api/post_blogs.php?id=$id";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => 'DELETE',
    CURLOPT_TIMEOUT => 15,
    CURLOPT_SSL_VERIFYPEER => false,
]);
$response = curl_exec($ch);
$error = curl_error($ch);
curl_close($ch);

if ($error) api_error("Failed: $error", 502);

$data = json_decode($response, true);
if ($data && ($data['status'] ?? '') === 'success') {
    api_success([], 'Blog deleted');
} else {
    api_error($data['message'] ?? 'Failed to delete', 400);
}
