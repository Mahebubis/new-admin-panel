<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
require_permission('reports', $jwt);

$year = intval($_GET['year'] ?? date('Y'));

// Monthly registrations
$res = $conn->query("SELECT MONTH(registered_at) AS month, COUNT(*) AS value FROM users WHERE YEAR(registered_at)=$year GROUP BY MONTH(registered_at)");
$registrations = [];
while ($r = $res->fetch_assoc()) $registrations[] = ['month' => (int)$r['month'], 'value' => (int)$r['value']];

// Monthly revenue
$res = $conn->query("SELECT MONTH(timestamp) AS month, COALESCE(SUM(CAST(amount AS DECIMAL(10,2))),0) AS value FROM payment_status WHERE YEAR(timestamp)=$year AND status='captured' GROUP BY MONTH(timestamp)");
$revenue = [];
while ($r = $res->fetch_assoc()) $revenue[] = ['month' => (int)$r['month'], 'value' => (float)$r['value']];

// Monthly internship enrollments
$res = $conn->query("SELECT MONTH(paid_at) AS month, COUNT(*) AS value FROM internship_payment WHERE YEAR(paid_at)=$year GROUP BY MONTH(paid_at)");
$internships = [];
while ($r = $res->fetch_assoc()) $internships[] = ['month' => (int)$r['month'], 'value' => (int)$r['value']];

// Top 10 internships
$res = $conn->query("SELECT COALESCE(internship_name,'Other') AS domain, COUNT(*) AS enrollments, COALESCE(SUM(CAST(amount AS DECIMAL(10,2))),0) AS revenue FROM payment_status WHERE status='captured' GROUP BY internship_name ORDER BY enrollments DESC LIMIT 10");
$domain_breakdown = [];
while ($r = $res->fetch_assoc()) $domain_breakdown[] = $r;

api_success(['year' => $year, 'registrations' => $registrations, 'revenue' => $revenue, 'internships' => $internships, 'domain_breakdown' => $domain_breakdown]);
