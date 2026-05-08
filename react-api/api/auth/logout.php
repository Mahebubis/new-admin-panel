<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

require_method('POST');
$jwt = require_jwt();

$uid = $jwt['user_id'];
$ip = get_client_ip();

$conn->query("UPDATE admin_otp SET used = 1 WHERE user_id = $uid AND used = 0");
$conn->query("INSERT INTO admin_login_attempts (user_id, ip, attempted_at, success) VALUES ($uid, '$ip', NOW(), -1)");

api_success([], 'Logged out successfully');
