<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

require_method('POST');

$input = get_json_input();
// $email = trim($input['email'] ?? '');
$email = 'maheboob.istudio@gmail.com';

if (!$email) {
    api_error('Email is required');
}

// ── Get user ──
$stmt = $conn->prepare("SELECT user_id, name, email FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user) {
    api_error('Account not found', 404);
}

$uid = (int)$user['user_id'];

// ── Cooldown check: 60 seconds ──
$cooldown = $conn->prepare("SELECT otp_expires_at FROM admin_otp WHERE user_id = ?");
$cooldown->bind_param("i", $uid);
$cooldown->execute();
$cd_row = $cooldown->get_result()->fetch_assoc();

if ($cd_row && $cd_row['otp_expires_at']) {
    $issued_at = strtotime($cd_row['otp_expires_at']) - 600;
    if (time() - $issued_at < 60) {
        api_error('Please wait 60 seconds before requesting a new OTP');
    }
}

// ── Generate new OTP ──
$otp_code   = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
$expires_at = date('Y-m-d H:i:s', time() + 600);

$upsert = $conn->prepare("
    INSERT INTO admin_otp (user_id, otp_code, otp_expires_at)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE otp_code = VALUES(otp_code), otp_expires_at = VALUES(otp_expires_at)
");
$upsert->bind_param("iss", $uid, $otp_code, $expires_at);
$upsert->execute();

// ── Send email ──
$name    = htmlspecialchars($user['name']);
$subject = 'Admin Panel - Your OTP Verification Code';
$body    = "
<div style='font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8fafc;border-radius:12px;'>
    <h2 style='color:#0f172a;margin-bottom:8px;'>OTP Verification</h2>
    <p style='color:#64748b;margin-bottom:24px;'>Hi {$name}, use the code below to verify your admin login. Valid for 10 minutes.</p>
    <div style='background:#4f46e5;color:#fff;font-size:32px;font-weight:700;letter-spacing:12px;text-align:center;padding:20px;border-radius:10px;'>{$otp_code}</div>
    <p style='color:#94a3b8;font-size:12px;margin-top:20px;'>If you did not attempt to log in, please secure your account immediately.</p>
</div>";

$helper_path = dirname(__DIR__, 3) . '/common/helper.php';
if (file_exists($helper_path)) {
    $prev = getcwd();
    chdir(dirname($helper_path));
    require_once $helper_path;
    chdir($prev);
    if (function_exists('sendEmail')) {
        sendEmail($user['email'], $subject, $body);
    }
} else {
    $headers = "From: contact@internshipstudio.com\r\nContent-Type: text/html; charset=UTF-8";
    @mail($user['email'], $subject, $body, $headers);
}

api_success(['email' => $email, 'otp_sent' => true, 'expires_in' => '10 minutes'], 'New OTP sent');
