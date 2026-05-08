<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('POST');
$jwt = require_jwt();
if (!is_superadmin($jwt)) api_error('Superadmin only', 403);

$input = get_json_input();
$email = trim($input['email'] ?? '');
if (!$email) api_error('Email required');

$stmt = $conn->prepare("SELECT user_id, name, email FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param("s", $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
if (!$user) api_error('User not found with that email', 404);

$uid = $user['user_id'];
$check = $conn->query("SELECT id FROM admin_users WHERE user_id = $uid");
if ($check->num_rows > 0) api_error('User is already an admin');

$conn->query("INSERT INTO admin_users (user_id, is_superadmin, is_active, created_at) VALUES ($uid, 0, 1, NOW())");
$conn->query("INSERT IGNORE INTO admin_permissions (user_id, permission_key, granted) VALUES ($uid, 'dashboard', 1)");

api_success(['user_id' => $uid, 'name' => $user['name']], 'Admin added');
