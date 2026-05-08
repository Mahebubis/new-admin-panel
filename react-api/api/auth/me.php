<?php

/**
 * /api/auth/me.php  (v2)
 *
 * Changes:
 *  - require_jwt() already rejects deactivated users globally, but we
 *    also double-check here so the frontend gets a clean logout signal.
 *  - REMOVED the dangerous fallback that auto-promoted any user with
 *    no admin_users row to __superadmin__. That was a security hole.
 *    Now: no admin_users row = plain user with only 'dashboard'.
 */

// require_once __DIR__ . '/../../config/database.php';
// require_once __DIR__ . '/../../middleware/auth.php';

// require_method('GET');

// $jwt = require_jwt();
// $uid = (int)$jwt['user_id'];

// $stmt = $conn->prepare("SELECT user_id, name, email, photo, is_admin, role FROM users WHERE user_id = ?");
// $stmt->bind_param("i", $uid);
// $stmt->execute();
// $user = $stmt->get_result()->fetch_assoc();
// $stmt->close();

// if (!$user) {
//     api_error('User not found', 404);
// }

// // Hard safety net: if somehow require_jwt didn't catch it, enforce here too.
// if (function_exists('is_user_deactivated') && is_user_deactivated($uid)) {
//     api_error('Your account has been deactivated. Please contact a Super Admin.', 401);
// }

// // Default: plain user — only dashboard
// $permissions   = ['dashboard'];
// $is_superadmin = 0;
// $is_admin_flag = 0;

// $admin_stmt = $conn->prepare(
//     "SELECT is_superadmin, is_active FROM admin_users WHERE user_id = ? LIMIT 1"
// );
// $admin_stmt->bind_param("i", $uid);
// $admin_stmt->execute();
// $admin_row = $admin_stmt->get_result()->fetch_assoc();
// $admin_stmt->close();

// if ($admin_row) {
//     // Row exists — enforce is_active
//     if ((int)$admin_row['is_active'] === 0) {
//         api_error('Your account has been deactivated. Please contact a Super Admin.', 401);
//     }

//     if ((int)$admin_row['is_superadmin'] === 1) {
//         $is_superadmin = 1;
//         $is_admin_flag = 1;
//         $permissions   = ['__superadmin__'];
//     } else {
//         $is_admin_flag = 1;
//         $perm_res = $conn->prepare("SELECT permission_key FROM admin_permissions WHERE user_id = ? AND granted = 1");
//         $perm_res->bind_param("i", $uid);
//         $perm_res->execute();
//         $res = $perm_res->get_result();
//         while ($p = $res->fetch_assoc()) {
//             $permissions[] = $p['permission_key'];
//         }
//         $perm_res->close();
//         $permissions = array_values(array_unique($permissions));
//     }
// }
// // else: no admin_users row → plain user, keeps default ['dashboard']

// api_success([
//     'user' => [
//         'user_id'       => (int)$user['user_id'],
//         'name'          => $user['name'],
//         'email'         => $user['email'],
//         'photo'         => $user['photo'] ?? '',
//         'is_admin'      => $is_admin_flag,
//         'is_superadmin' => $is_superadmin,
//         'permissions'   => $permissions,
//     ]
// ]);


















/**
 * /api/auth/me.php  (v3)
 *
 * Fix: is_admin now reflects the users.is_admin column (managed by the
 * "Admin Access" toggle), NOT just the presence of an admin_users row.
 * Granting a single permission inserts an admin_users row with is_active=1
 * so the user can authenticate, but that alone must NOT promote them to admin.
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

require_method('GET');

$jwt = require_jwt();
$uid = (int)$jwt['user_id'];

$stmt = $conn->prepare("SELECT user_id, name, email, photo, is_admin, role FROM users WHERE user_id = ?");
$stmt->bind_param("i", $uid);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$user) {
    api_error('User not found', 404);
}

if (function_exists('is_user_deactivated') && is_user_deactivated($uid)) {
    api_error('Your account has been deactivated. Please contact a Super Admin.', 401);
}

// Default: plain user — only dashboard, no admin
$permissions   = ['dashboard'];
$is_superadmin = 0;
$is_admin_flag = 0;

$admin_stmt = $conn->prepare(
    "SELECT is_superadmin, is_active FROM admin_users WHERE user_id = ? LIMIT 1"
);
$admin_stmt->bind_param("i", $uid);
$admin_stmt->execute();
$admin_row = $admin_stmt->get_result()->fetch_assoc();
$admin_stmt->close();

if ($admin_row) {
    if ((int)$admin_row['is_active'] === 0) {
        api_error('Your account has been deactivated. Please contact a Super Admin.', 401);
    }

    if ((int)$admin_row['is_superadmin'] === 1) {
        $is_superadmin = 1;
        $is_admin_flag = 1;
        $permissions   = ['__superadmin__'];
    } else {
        // ── KEY FIX ──
        // Trust users.is_admin (set ONLY by the Admin Access toggle).
        // Granting individual permissions creates the admin_users row but
        // must not flip is_admin on its own.
        $is_admin_flag = (int)$user['is_admin'];

        // Always load granted perms so the user can access what was given
        $perm_res = $conn->prepare(
            "SELECT permission_key FROM admin_permissions WHERE user_id = ? AND granted = 1"
        );
        $perm_res->bind_param("i", $uid);
        $perm_res->execute();
        $res = $perm_res->get_result();
        while ($p = $res->fetch_assoc()) {
            $permissions[] = $p['permission_key'];
        }
        $perm_res->close();
        $permissions = array_values(array_unique($permissions));
    }
}

api_success([
    'user' => [
        'user_id'       => (int)$user['user_id'],
        'name'          => $user['name'],
        'email'         => $user['email'],
        'photo'         => $user['photo'] ?? '',
        'is_admin'      => $is_admin_flag,
        'is_superadmin' => $is_superadmin,
        'permissions'   => $permissions,
    ]
]);
