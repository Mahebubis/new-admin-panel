<?php
/**
 * Database Configuration
 * Uses the same credentials as the main CIT3 project
 */
require_once __DIR__ . '/cors.php';
date_default_timezone_set('Asia/Kolkata');

define('DB_HOST', 'localhost');
define('DB_USER', 'istudio_admin');
define('DB_PASS', 'h;V[ts@#;u{B');
define('DB_NAME', 'istudio_cit');

// JWT Configuration
define('JWT_SECRET_KEY', 'a3f8c2e91b4d7f6a0e5c8d2b1f9e4a7c3b6d8e2f1a4c7d9b2e5f8a1c4d7e9b3f6');
define('OTP_EXPIRY_MINUTES', 10);
define('SESSION_DAYS', 7);
define('MAX_LOGIN_ATTEMPTS', 5);

// Fix Apache stripping Authorization header
if (empty($_SERVER['HTTP_AUTHORIZATION'])) {
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        $h = apache_request_headers();
        if (!empty($h['Authorization'])) {
            $_SERVER['HTTP_AUTHORIZATION'] = $h['Authorization'];
        } elseif (!empty($h['authorization'])) {
            $_SERVER['HTTP_AUTHORIZATION'] = $h['authorization'];
        }
    }
}

// Create database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}
$conn->set_charset('utf8mb4');

// Secondary DB connections (for cross-database queries)
$conn2 = new mysqli(DB_HOST, DB_USER, DB_PASS, 'istudio_exam');
$conn3 = new mysqli(DB_HOST, DB_USER, DB_PASS, 'istudio_main');
