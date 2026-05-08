<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

require_method('POST');

$input = get_json_input();
$email = trim($input['email'] ?? '');
$otp   = trim($input['otp'] ?? '');

if (!$email) api_error('Email is required');
if (!$otp)   api_error('OTP is required');
if (!preg_match('/^\d{6}$/', $otp)) api_error('OTP must be 6 digits');

// ── Get user ──
$stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
if (!$user) api_error('User not found', 404);

$uid = (int)$user['user_id'];

// ── Validate OTP ──
// Try new-style columns first (otp, expires_at, used)
$otp_valid = false;
$otp_id = null;

$stmt2 = $conn->prepare("
    SELECT id FROM admin_otp
    WHERE user_id = ? AND otp = ? AND used = 0 AND expires_at > NOW()
    ORDER BY id DESC LIMIT 1
");
if ($stmt2) {
    $stmt2->bind_param('is', $uid, $otp);
    $stmt2->execute();
    $otpRow = $stmt2->get_result()->fetch_assoc();
    if ($otpRow) {
        $otp_valid = true;
        $otp_id = (int)$otpRow['id'];
    }
}

// Fallback: old-style columns (otp_code, otp_expires_at)
if (!$otp_valid) {
    $stmt3 = $conn->prepare("SELECT otp_code, otp_expires_at FROM admin_otp WHERE user_id = ?");
    if ($stmt3) {
        $stmt3->bind_param("i", $uid);
        $stmt3->execute();
        $otp_row = $stmt3->get_result()->fetch_assoc();
        if ($otp_row && $otp_row['otp_code'] === $otp && strtotime($otp_row['otp_expires_at']) > time()) {
            $otp_valid = true;
        }
    }
}

if (!$otp_valid) {
    api_error('Invalid or expired OTP. Please request a new one.', 401);
}

// ── Mark OTP as used ──
if ($otp_id) {
    $conn->query("UPDATE admin_otp SET used = 1 WHERE id = $otp_id");
} else {
    // Old style: clear the otp_code
    $now = date('Y-m-d H:i:s');
    $upd = $conn->prepare("UPDATE admin_otp SET last_verified_at = ?, otp_code = NULL, otp_expires_at = NULL WHERE user_id = ?");
    if ($upd) {
        $upd->bind_param("si", $now, $uid);
        $upd->execute();
    }
}

// ── Get permissions ──
$permissions = ['dashboard'];
$is_superadmin = 0;

// Check admin_users table
$admin_check = $conn->query("SELECT is_superadmin FROM admin_users WHERE user_id = $uid AND is_active = 1");
if ($admin_check && $admin_row = $admin_check->fetch_assoc()) {
    if ($admin_row['is_superadmin']) {
        $is_superadmin = 1;
        $permissions = ['__superadmin__'];
    } else {
        $perm_res = $conn->query("SELECT permission_key FROM admin_permissions WHERE user_id = $uid AND granted = 1");
        if ($perm_res) {
            while ($p = $perm_res->fetch_assoc()) {
                $permissions[] = $p['permission_key'];
            }
        }
        $permissions = array_unique($permissions);
    }
} else {
    // User is admin via role/is_admin flag but not in admin_users
    $is_admin_panel = ($user['role'] == '1' || (int)($user['is_admin'] ?? 0) === 1);
    if ($is_admin_panel) {
        $permissions = ['__superadmin__'];
        $is_superadmin = 1;
    }
}

// ── Log login ──
$ip = get_client_ip();
$conn->query("INSERT INTO admin_login_attempts (user_id, ip, attempted_at, success) VALUES ($uid, '$ip', NOW(), 1)");

// Try updating admin_users last_login
$conn->query("UPDATE admin_users SET last_login = NOW() WHERE user_id = $uid");

// ── Issue JWT ──
$now_ts = time();
$payload = [
    'iss'          => 'cit3.internshipstudio.com',
    'sub'          => $uid,
    'iat'          => $now_ts,
    'exp'          => $now_ts + (SESSION_DAYS * 86400),
    'user_id'      => $uid,
    'name'         => $user['name'],
    'email'        => $user['email'],
    'photo'        => $user['photo'] ?? '',
    'is_admin'     => (int)($user['is_admin'] ?? 0),
    'is_superadmin'=> $is_superadmin,
    'permissions'  => $permissions,
];

$token = jwt_encode($payload);

api_success([
    'token'      => $token,
    'expires_at' => date('c', $payload['exp']),
    'user'       => [
        'user_id'      => $uid,
        'name'         => $user['name'],
        'email'        => $user['email'],
        'photo'        => $user['photo'] ?? '',
        'is_admin'     => (int)($user['is_admin'] ?? 0),
        'is_superadmin'=> $is_superadmin,
        'permissions'  => $permissions,
    ],
], 'Login successful');
