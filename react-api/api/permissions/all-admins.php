<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
if (!is_superadmin($jwt)) api_error('Superadmin only', 403);

$res = $conn->query("
    SELECT a.user_id, u.name, u.email, u.photo, a.is_superadmin, a.is_active,
           DATE(a.last_login) AS last_login, DATE(a.created_at) AS added_at
    FROM admin_users a JOIN users u ON u.user_id = a.user_id
    ORDER BY a.is_superadmin DESC, u.name ASC
");
$admins = $res->fetch_all(MYSQLI_ASSOC);

api_success(['admins' => $admins]);
