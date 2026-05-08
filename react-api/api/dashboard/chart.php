<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cache.php';
require_once __DIR__ . '/../../middleware/auth.php';

require_method('GET');
$jwt = require_jwt();
require_permission('dashboard', $jwt);

$days = max(1, min(90, intval($_GET['days'] ?? 7)));

$cache_key = "dashboard_chart_$days";
$cached = cache_get($cache_key);
if ($cached) { api_success($cached); }

// Single optimized query for both registered and unregistered per day
$stmt = $conn->prepare("
    SELECT DATE(registered_at) AS d,
           SUM(CASE WHEN applyforexam=1 THEN 1 ELSE 0 END) AS reg,
           SUM(CASE WHEN applyforexam=0 OR applyforexam IS NULL THEN 1 ELSE 0 END) AS unreg
    FROM users
    WHERE role=4 AND registered_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY DATE(registered_at)
    ORDER BY d ASC
");
$stmt->bind_param("i", $days);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$map = [];
foreach ($rows as $r) $map[$r['d']] = $r;

$labels = []; $registered = []; $unregistered = []; $total = [];
for ($i = $days - 1; $i >= 0; $i--) {
    $date = date('Y-m-d', strtotime("-$i days"));
    $label = date('d M', strtotime($date));
    $reg = (int)($map[$date]['reg'] ?? 0);
    $unreg = (int)($map[$date]['unreg'] ?? 0);
    $labels[] = $label;
    $registered[] = $reg;
    $unregistered[] = $unreg;
    $total[] = $reg + $unreg;
}

$result = ['labels' => $labels, 'registered' => $registered, 'unregistered' => $unregistered, 'total' => $total];
cache_set($cache_key, $result, 60);
api_success($result);
