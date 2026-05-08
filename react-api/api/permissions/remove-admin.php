<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('DELETE');
$jwt = require_jwt();
if (!is_superadmin($jwt)) api_error('Superadmin only', 403);

$input = get_json_input();
$uid = intval($input['id'] ?? 0);
if (!$uid) api_error('User ID required');
if ($uid === $jwt['user_id']) api_error('Cannot remove yourself');

$check = $conn->query("SELECT is_superadmin FROM admin_users WHERE user_id = $uid")->fetch_assoc();
if ($check && $check['is_superadmin']) api_error('Cannot remove a superadmin');

$conn->query("DELETE FROM admin_users WHERE user_id = $uid");
$conn->query("DELETE FROM admin_permissions WHERE user_id = $uid");

api_success([], 'Admin removed');
