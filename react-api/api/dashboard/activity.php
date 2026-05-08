<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cache.php';
require_once __DIR__ . '/../../middleware/auth.php';

require_method('GET');
$jwt = require_jwt();
require_permission('dashboard', $jwt);

$cache_key = 'dashboard_activity';
$cached = cache_get($cache_key);
if ($cached) { api_success($cached); }

$items = [];

$res = $conn->query("SELECT name, registered_at FROM users WHERE role=4 ORDER BY user_id DESC LIMIT 4");
if ($res) while ($r = $res->fetch_assoc()) {
    $diff = time() - strtotime($r['registered_at']);
    $time = $diff < 60 ? 'just now' : ($diff < 3600 ? floor($diff/60).'m ago' : ($diff < 86400 ? floor($diff/3600).'h ago' : floor($diff/86400).'d ago'));
    $items[] = ['type' => 'registration', 'message' => $r['name'] . ' signed up', 'status' => 'new', 'time' => $time];
}

$res = $conn->query("SELECT amount, timestamp, internship_name FROM payment_status WHERE status='captured' ORDER BY id DESC LIMIT 3");
if ($res) while ($r = $res->fetch_assoc()) {
    $diff = time() - strtotime($r['timestamp']);
    $time = $diff < 3600 ? floor($diff/60).'m ago' : ($diff < 86400 ? floor($diff/3600).'h ago' : floor($diff/86400).'d ago');
    $items[] = ['type' => 'payment', 'message' => '₹' . $r['amount'] . ' for ' . $r['internship_name'], 'status' => 'captured', 'time' => $time];
}

$result = ['items' => $items];
cache_set($cache_key, $result, 30);
api_success($result);
