<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
require_permission('netcore_filter', $jwt);

$event = $_GET['event'] ?? 'register';
$payload_key = $_GET['payload_key'] ?? '';

if (!$payload_key) api_error('Payload key required');

$results = [];

// Map payload keys to actual database columns
$columnMap = [
    'register' => ['country' => 'country', 'state' => 'state', 'email' => 'email', 'mobile' => 'phone', 'referral' => 'referral_code'],
    'course_purchase' => ['internship_name' => 'internship_name', 'amount' => 'amount'],
    'payment_success' => ['paid_amount' => 'amount', 'paid_internship_name' => 'internship_name'],
];

if ($event === 'register' && isset($columnMap['register'][$payload_key])) {
    $col = $columnMap['register'][$payload_key];
    $res = $conn->query("SELECT COALESCE($col,'(empty)') AS value, COUNT(*) AS count FROM users WHERE role=4 GROUP BY $col ORDER BY count DESC LIMIT 20");
    $totalCount = $conn->query("SELECT COUNT(*) AS c FROM users WHERE role=4")->fetch_assoc()['c'];
    while ($r = $res->fetch_assoc()) {
        $r['percentage'] = $totalCount > 0 ? round(($r['count'] / $totalCount) * 100, 1) : 0;
        $results[] = $r;
    }
} elseif ($event === 'payment_success' && isset($columnMap['payment_success'][$payload_key])) {
    $col = $columnMap['payment_success'][$payload_key];
    $res = $conn->query("SELECT COALESCE($col,'(empty)') AS value, COUNT(*) AS count FROM payment_status WHERE status='captured' GROUP BY $col ORDER BY count DESC LIMIT 20");
    $totalCount = $conn->query("SELECT COUNT(*) AS c FROM payment_status WHERE status='captured'")->fetch_assoc()['c'];
    while ($r = $res->fetch_assoc()) {
        $r['percentage'] = $totalCount > 0 ? round(($r['count'] / $totalCount) * 100, 1) : 0;
        $results[] = $r;
    }
}

api_success(['results' => $results]);
