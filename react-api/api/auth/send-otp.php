<?php
/**
 * Send OTP - Step 1 of admin login
 * Uses PHPMailer with same SMTP credentials as main CIT3 project
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

// ── Load PHPMailer (same library used by main project) ──
$phpmailer_paths = [
    dirname(__DIR__, 3) . '/PHPMailer/src/',           // relative: cit3/PHPMailer/src/
    '/home/istudio/public_html/cit3/PHPMailer/src/',   // absolute server path
];
$phpmailer_loaded = false;
foreach ($phpmailer_paths as $dir) {
    if (file_exists($dir . 'PHPMailer.php')) {
        require_once $dir . 'Exception.php';
        require_once $dir . 'PHPMailer.php';
        require_once $dir . 'SMTP.php';
        $phpmailer_loaded = true;
        break;
    }
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

require_method('POST');

$input = get_json_input();
$email = trim($input['email'] ?? '');
$password = trim($input['password'] ?? '');

if (!$email) api_error('Email is required');
if (!$password) api_error('Password is required');

// ── Find admin user ──
$user = null;

// Try admin_users JOIN first
$stmt = $conn->prepare("
    SELECT u.user_id, u.name, u.email, u.password, u.photo, u.is_admin,
          a.is_superadmin, a.is_active
    FROM users u
    INNER JOIN admin_users a ON a.user_id = u.user_id
    WHERE u.email = ? LIMIT 1
");
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

// Fallback: users table (role=1 or is_admin=1)
if (!$user) {
    $stmt2 = $conn->prepare("SELECT * FROM users WHERE email = ?");
    $stmt2->bind_param("s", $email);
    $stmt2->execute();
    $row = $stmt2->get_result()->fetch_assoc();
    if ($row && ($row['role'] == '1' || (int)($row['is_admin'] ?? 0) === 1)) {
        $user = $row;
        $user['is_superadmin'] = 1;
        $user['is_active'] = 1;
    }
}

if (!$user) api_error('Invalid email or password', 401);

if (isset($user['is_active']) && !(int)$user['is_active']) {
    api_error('Your admin account has been deactivated', 403);
}

// ── Verify password (bcrypt + MD5 + plain text) ──
$valid = password_verify($password, $user['password'])
      || md5($password) === $user['password']
      || $password === $user['password'];

if (!$valid) api_error('Invalid email or password', 401);

$uid = (int)$user['user_id'];

// ── Generate OTP ──
$otp_code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
$expires  = date('Y-m-d H:i:s', time() + (OTP_EXPIRY_MINUTES * 60));

// Invalidate old OTPs
@$conn->query("UPDATE admin_otp SET used = 1 WHERE user_id = $uid AND used = 0");

// Try new-style table (otp, expires_at, used)
$otp_saved = false;
$stmt_otp = @$conn->prepare("INSERT INTO admin_otp (user_id, otp, expires_at, used) VALUES (?, ?, ?, 0)");
if ($stmt_otp) {
    $stmt_otp->bind_param('iss', $uid, $otp_code, $expires);
    if (@$stmt_otp->execute()) $otp_saved = true;
}
// Fallback old-style (otp_code, otp_expires_at)
if (!$otp_saved) {
    $stmt_otp2 = @$conn->prepare("
        INSERT INTO admin_otp (user_id, otp_code, otp_expires_at)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE otp_code = VALUES(otp_code), otp_expires_at = VALUES(otp_expires_at)
    ");
    if ($stmt_otp2) {
        $stmt_otp2->bind_param("iss", $uid, $otp_code, $expires);
        @$stmt_otp2->execute();
    }
}

// ── Send OTP email via PHPMailer ──
$name    = htmlspecialchars($user['name']);
$subject = "CIT3 Admin Login OTP: $otp_code";
$html    = "
<div style='font-family:Arial,sans-serif;max-width:500px;margin:0 auto'>
  <div style='background:#4f46e5;padding:24px;border-radius:12px 12px 0 0;text-align:center'>
    <h1 style='color:#fff;margin:0;font-size:20px'>CIT3 Admin Panel</h1>
    <p style='color:#c7d2fe;margin:4px 0 0'>InternshipStudio</p>
  </div>
  <div style='background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none'>
    <p style='color:#374151;font-size:15px'>Hi <strong>$name</strong>,</p>
    <p style='color:#6b7280;font-size:14px'>Your one-time password for admin panel login:</p>
    <div style='text-align:center;margin:28px 0'>
      <span style='font-size:42px;font-weight:900;letter-spacing:12px;color:#4f46e5;background:#eef2ff;padding:16px 28px;border-radius:12px'>$otp_code</span>
    </div>
    <p style='color:#6b7280;font-size:13px;text-align:center'>
      This OTP expires in <strong>" . OTP_EXPIRY_MINUTES . " minutes</strong>.<br>
      Do not share this with anyone.
    </p>
    <hr style='border:none;border-top:1px solid #e2e8f0;margin:24px 0'>
    <p style='color:#9ca3af;font-size:12px;text-align:center'>
      If you did not request this, ignore this email.<br>
      InternshipStudio &middot; CIT3 Admin Platform
    </p>
  </div>
</div>";

$email_sent = false;
$mail_error = '';

if ($phpmailer_loaded) {
    try {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host       = 'mailhost.internshipstudio.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'contact@internshipstudio.com';
        $mail->Password   = '5Hbe!j9rhbal~po1';
        
        // $mail->Password   = '=+$s7#k@kkl&yWO{';
        $mail->SMTPSecure = 'tls';
        $mail->Port       = 587;

        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer'       => false,
                'verify_peer_name'  => false,
                'allow_self_signed' => true,
            ]
        ];

        $mail->setFrom('contact@internshipstudio.com', 'Internship Studio');
        $mail->addAddress($user['email']);
        $mail->addReplyTo('contact@internshipstudio.com', 'Internship Studio');

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $html;
        $mail->AltBody = "Your OTP is: $otp_code (expires in " . OTP_EXPIRY_MINUTES . " minutes)";

        $email_sent = $mail->send();
    } catch (\Exception $e) {
        $mail_error = $e->getMessage();
        if (isset($mail)) $mail_error .= ' | ' . $mail->ErrorInfo;
    }
}

// Fallback: PHP mail()
if (!$email_sent) {
    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: Internship Studio <contact@internshipstudio.com>\r\n";
    $result = @mail($user['email'], $subject, $html, $headers);
    if ($result) {
        $email_sent = true;
    } else {
        $mail_error .= ($mail_error ? ' | ' : '') . 'mail() also failed';
    }
}

// Log errors if email failed
if (!$email_sent && $mail_error) {
    $log_dir = dirname(__DIR__, 2) . '/logs';
    if (!is_dir($log_dir)) @mkdir($log_dir, 0755, true);
    @file_put_contents(
        $log_dir . '/mail_error.log',
        date('[Y-m-d H:i:s]') . " TO={$user['email']} ERR=$mail_error\n",
        FILE_APPEND
    );
}

api_success([
    'email'      => $user['email'],
    'otp_sent'   => (bool)$email_sent,
    'expires_in' => OTP_EXPIRY_MINUTES . ' minutes',
    'debug'      => !$email_sent ? $mail_error : null,
], $email_sent
    ? 'OTP sent to your registered email'
    : 'OTP generated but email may be delayed. Check spam folder.'
);





















/**
 * Send OTP - Step 1 of admin login
 * Uses PHPMailer with same SMTP credentials as main CIT3 project
 */
// require_once __DIR__ . '/../../config/database.php';
// require_once __DIR__ . '/../../middleware/auth.php';

// // ── Load PHPMailer (same library used by main project) ──
// $phpmailer_paths = [
//     dirname(__DIR__, 3) . '/PHPMailer/src/',           // relative: cit3/PHPMailer/src/
//     '/home/istudio/public_html/cit3/PHPMailer/src/',   // absolute server path
// ];
// $phpmailer_loaded = false;
// foreach ($phpmailer_paths as $dir) {
//     if (file_exists($dir . 'PHPMailer.php')) {
//         require_once $dir . 'Exception.php';
//         require_once $dir . 'PHPMailer.php';
//         require_once $dir . 'SMTP.php';
//         $phpmailer_loaded = true;
//         break;
//     }
// }

// use PHPMailer\PHPMailer\PHPMailer;
// use PHPMailer\PHPMailer\Exception as MailException;

// require_method('POST');

// $input = get_json_input();
// $email = trim($input['email'] ?? '');
// $password = trim($input['password'] ?? '');

// if (!$email) api_error('Email is required');
// if (!$password) api_error('Password is required');

// // ── Find admin user ──
// $user = null;

// // Try admin_users JOIN first
// $stmt = $conn->prepare("
//     SELECT u.user_id, u.name, u.email, u.password, u.photo, u.is_admin,
//           a.is_superadmin, a.is_active
//     FROM users u
//     INNER JOIN admin_users a ON a.user_id = u.user_id
//     WHERE u.email = ? LIMIT 1
// ");
// $stmt->bind_param('s', $email);
// $stmt->execute();
// $user = $stmt->get_result()->fetch_assoc();

// // Fallback: users table (role=1 or is_admin=1)
// if (!$user) {
//     $stmt2 = $conn->prepare("SELECT * FROM users WHERE email = ?");
//     $stmt2->bind_param("s", $email);
//     $stmt2->execute();
//     $row = $stmt2->get_result()->fetch_assoc();
//     if ($row && ($row['role'] == '1' || (int)($row['is_admin'] ?? 0) === 1)) {
//         $user = $row;
//         $user['is_superadmin'] = 1;
//         $user['is_active'] = 1;
//     }
// }

// if (!$user) api_error('Invalid email or password', 401);

// if (isset($user['is_active']) && !(int)$user['is_active']) {
//     api_error('Your admin account has been deactivated', 403);
// }

// // ── Verify password (bcrypt + MD5 + plain text) ──
// $valid = password_verify($password, $user['password'])
//       || md5($password) === $user['password']
//       || $password === $user['password'];

// if (!$valid) api_error('Invalid email or password', 401);

// // ── TEMP BYPASS: skip OTP for specific email ──
// // TO REVERT: delete this entire block (between the two markers).
// if (strtolower(trim($user['email'])) === 'khansaifurrhaman@gmail.com') {
//     $uid = (int)$user['user_id'];

//     // Permissions (same logic as verify_otp.php)
//     $permissions   = ['dashboard'];
//     $is_superadmin = 0;
//     $admin_check = $conn->query("SELECT is_superadmin FROM admin_users WHERE user_id = $uid AND is_active = 1");
//     if ($admin_check && $admin_row = $admin_check->fetch_assoc()) {
//         if ($admin_row['is_superadmin']) {
//             $is_superadmin = 1;
//             $permissions   = ['__superadmin__'];
//         } else {
//             $perm_res = $conn->query("SELECT permission_key FROM admin_permissions WHERE user_id = $uid AND granted = 1");
//             if ($perm_res) {
//                 while ($p = $perm_res->fetch_assoc()) $permissions[] = $p['permission_key'];
//             }
//             $permissions = array_values(array_unique($permissions));
//         }
//     } else {
//         if (($user['role'] ?? '') == '1' || (int)($user['is_admin'] ?? 0) === 1) {
//             $permissions   = ['__superadmin__'];
//             $is_superadmin = 1;
//         }
//     }

//     // Log login
//     $ip = get_client_ip();
//     $conn->query("INSERT INTO admin_login_attempts (user_id, ip, attempted_at, success) VALUES ($uid, '$ip', NOW(), 1)");
//     $conn->query("UPDATE admin_users SET last_login = NOW() WHERE user_id = $uid");

//     // Issue JWT
//     $now_ts  = time();
//     $payload = [
//         'iss'           => 'cit3.internshipstudio.com',
//         'sub'           => $uid,
//         'iat'           => $now_ts,
//         'exp'           => $now_ts + (SESSION_DAYS * 86400),
//         'user_id'       => $uid,
//         'name'          => $user['name'],
//         'email'         => $user['email'],
//         'photo'         => $user['photo'] ?? '',
//         'is_admin'      => (int)($user['is_admin'] ?? 0),
//         'is_superadmin' => $is_superadmin,
//         'permissions'   => $permissions,
//     ];
//     $token = jwt_encode($payload);

//     api_success([
//         'bypass_otp' => true,
//         'token'      => $token,
//         'expires_at' => date('c', $payload['exp']),
//         'user'       => [
//             'user_id'       => $uid,
//             'name'          => $user['name'],
//             'email'         => $user['email'],
//             'photo'         => $user['photo'] ?? '',
//             'is_admin'      => (int)($user['is_admin'] ?? 0),
//             'is_superadmin' => $is_superadmin,
//             'permissions'   => $permissions,
//         ],
//     ], 'Login successful');
// }
// // ── END TEMP BYPASS ──

// $uid = (int)$user['user_id'];

// // ── Generate OTP ──
// $otp_code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
// $expires  = date('Y-m-d H:i:s', time() + (OTP_EXPIRY_MINUTES * 60));

// // Invalidate old OTPs
// @$conn->query("UPDATE admin_otp SET used = 1 WHERE user_id = $uid AND used = 0");

// // Try new-style table (otp, expires_at, used)
// $otp_saved = false;
// $stmt_otp = @$conn->prepare("INSERT INTO admin_otp (user_id, otp, expires_at, used) VALUES (?, ?, ?, 0)");
// if ($stmt_otp) {
//     $stmt_otp->bind_param('iss', $uid, $otp_code, $expires);
//     if (@$stmt_otp->execute()) $otp_saved = true;
// }
// // Fallback old-style (otp_code, otp_expires_at)
// if (!$otp_saved) {
//     $stmt_otp2 = @$conn->prepare("
//         INSERT INTO admin_otp (user_id, otp_code, otp_expires_at)
//         VALUES (?, ?, ?)
//         ON DUPLICATE KEY UPDATE otp_code = VALUES(otp_code), otp_expires_at = VALUES(otp_expires_at)
//     ");
//     if ($stmt_otp2) {
//         $stmt_otp2->bind_param("iss", $uid, $otp_code, $expires);
//         @$stmt_otp2->execute();
//     }
// }

// // ── Send OTP email via PHPMailer ──
// $name    = htmlspecialchars($user['name']);
// $subject = "CIT3 Admin Login OTP: $otp_code";
// $html    = "
// <div style='font-family:Arial,sans-serif;max-width:500px;margin:0 auto'>
//   <div style='background:#4f46e5;padding:24px;border-radius:12px 12px 0 0;text-align:center'>
//     <h1 style='color:#fff;margin:0;font-size:20px'>CIT3 Admin Panel</h1>
//     <p style='color:#c7d2fe;margin:4px 0 0'>InternshipStudio</p>
//   </div>
//   <div style='background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none'>
//     <p style='color:#374151;font-size:15px'>Hi <strong>$name</strong>,</p>
//     <p style='color:#6b7280;font-size:14px'>Your one-time password for admin panel login:</p>
//     <div style='text-align:center;margin:28px 0'>
//       <span style='font-size:42px;font-weight:900;letter-spacing:12px;color:#4f46e5;background:#eef2ff;padding:16px 28px;border-radius:12px'>$otp_code</span>
//     </div>
//     <p style='color:#6b7280;font-size:13px;text-align:center'>
//       This OTP expires in <strong>" . OTP_EXPIRY_MINUTES . " minutes</strong>.<br>
//       Do not share this with anyone.
//     </p>
//     <hr style='border:none;border-top:1px solid #e2e8f0;margin:24px 0'>
//     <p style='color:#9ca3af;font-size:12px;text-align:center'>
//       If you did not request this, ignore this email.<br>
//       InternshipStudio &middot; CIT3 Admin Platform
//     </p>
//   </div>
// </div>";

// $email_sent = false;
// $mail_error = '';

// if ($phpmailer_loaded) {
//     try {
//         $mail = new PHPMailer(true);
//         $mail->isSMTP();
//         $mail->Host       = 'mailhost.internshipstudio.com';
//         $mail->SMTPAuth   = true;
//         $mail->Username   = 'contact@internshipstudio.com';
//         $mail->Password   = '5Hbe!j9rhbal~po1';
        
//         // $mail->Password   = '=+$s7#k@kkl&yWO{';
//         $mail->SMTPSecure = 'tls';
//         $mail->Port       = 587;

//         $mail->SMTPOptions = [
//             'ssl' => [
//                 'verify_peer'       => false,
//                 'verify_peer_name'  => false,
//                 'allow_self_signed' => true,
//             ]
//         ];

//         $mail->setFrom('contact@internshipstudio.com', 'Internship Studio');
//         $mail->addAddress($user['email']);
//         $mail->addReplyTo('contact@internshipstudio.com', 'Internship Studio');

//         $mail->isHTML(true);
//         $mail->Subject = $subject;
//         $mail->Body    = $html;
//         $mail->AltBody = "Your OTP is: $otp_code (expires in " . OTP_EXPIRY_MINUTES . " minutes)";

//         $email_sent = $mail->send();
//     } catch (\Exception $e) {
//         $mail_error = $e->getMessage();
//         if (isset($mail)) $mail_error .= ' | ' . $mail->ErrorInfo;
//     }
// }

// // Fallback: PHP mail()
// if (!$email_sent) {
//     $headers  = "MIME-Version: 1.0\r\n";
//     $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
//     $headers .= "From: Internship Studio <contact@internshipstudio.com>\r\n";
//     $result = @mail($user['email'], $subject, $html, $headers);
//     if ($result) {
//         $email_sent = true;
//     } else {
//         $mail_error .= ($mail_error ? ' | ' : '') . 'mail() also failed';
//     }
// }

// // Log errors if email failed
// if (!$email_sent && $mail_error) {
//     $log_dir = dirname(__DIR__, 2) . '/logs';
//     if (!is_dir($log_dir)) @mkdir($log_dir, 0755, true);
//     @file_put_contents(
//         $log_dir . '/mail_error.log',
//         date('[Y-m-d H:i:s]') . " TO={$user['email']} ERR=$mail_error\n",
//         FILE_APPEND
//     );
// }

// api_success([
//     'email'      => $user['email'],
//     'otp_sent'   => (bool)$email_sent,
//     'expires_in' => OTP_EXPIRY_MINUTES . ' minutes',
//     'debug'      => !$email_sent ? $mail_error : null,
// ], $email_sent
//     ? 'OTP sent to your registered email'
//     : 'OTP generated but email may be delayed. Check spam folder.'
// );
