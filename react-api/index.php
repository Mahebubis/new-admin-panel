<?php
/**
 * CIT3 Admin React API Router
 * Upload this folder to: public_html/cit3/react-api/
 */
require_once __DIR__ . '/config/cors.php';

// Get request URI relative to this folder
$uri = $_SERVER['REQUEST_URI'];
$base = '/admin/react-api';
$path = parse_url($uri, PHP_URL_PATH);

// Strip base path
if (strpos($path, $base) === 0) {
    $path = substr($path, strlen($base));
}

// Remove trailing slash
$path = rtrim($path, '/');
if (empty($path)) $path = '/';

// Route to the correct file
$file = __DIR__ . $path;

if ($path === '/' || $path === '') {
    echo json_encode(['success' => true, 'message' => 'CIT3 Admin API is running', 'version' => '1.0']);
    exit();
}

// Check if the file exists (with .php extension handling)
if (is_file($file)) {
    require $file;
    exit();
}

if (is_file($file . '.php')) {
    require $file . '.php';
    exit();
}

// 404
http_response_code(404);
echo json_encode(['success' => false, 'message' => 'Endpoint not found: ' . $path]);
