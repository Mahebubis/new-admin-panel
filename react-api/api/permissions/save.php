<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('POST');
$jwt = require_jwt();
if (!is_superadmin($jwt)) api_error('Superadmin only', 403);

$input = get_json_input();
$uid = intval($input['user_id'] ?? 0);
$permissions = $input['permissions'] ?? [];

if (!$uid) api_error('User ID required');

$check = $conn->query("SELECT is_superadmin FROM admin_users WHERE user_id = $uid")->fetch_assoc();
if ($check && $check['is_superadmin']) api_error('Cannot modify superadmin permissions');

// Clear and re-insert
$conn->query("DELETE FROM admin_permissions WHERE user_id = $uid");

$stmt = $conn->prepare("INSERT INTO admin_permissions (user_id, permission_key, granted) VALUES (?, ?, 1)");
foreach ($permissions as $perm) {
    $key = preg_replace('/[^a-z0-9_]/', '', strtolower($perm));
    if ($key) {
        $stmt->bind_param("is", $uid, $key);
        $stmt->execute();
    }
}

$admin_id = $jwt['user_id'];
$conn->query("INSERT INTO admin_action_log (admin_id, action, target_type, target_id, note, created_at) VALUES ($admin_id, 'permissions_update', 'admin_user', $uid, 'Updated permissions', NOW())");

api_success([], 'Permissions saved');
