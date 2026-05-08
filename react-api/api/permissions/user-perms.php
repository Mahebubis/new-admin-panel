<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
if (!is_superadmin($jwt)) api_error('Superadmin only', 403);

$uid = intval($_GET['uid'] ?? 0);
if (!$uid) api_error('User ID required');

$permissions = get_admin_permissions($uid, $conn);

api_success(['permissions' => $permissions, 'user_id' => $uid]);
