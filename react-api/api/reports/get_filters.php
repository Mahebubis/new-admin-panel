<?php
/*
 * GET /api/get_filters.php?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * Returns distinct campaigns from fb_ads_details for the given date range.
 * Same logic as the JS populateFilters() call in datewise_data.php
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['campaigns'=>[]]); exit; }

$start = $conn->real_escape_string($_GET['start_date'] ?? '');
$end   = $conn->real_escape_string($_GET['end_date']   ?? '');

$where = '';
if ($start && $end) {
    $where = "WHERE date BETWEEN '$start' AND '$end'";
} elseif ($start) {
    $where = "WHERE date >= '$start'";
}

$res = $conn->query("SELECT DISTINCT campaign FROM fb_ads_details $where ORDER BY campaign ASC");
$campaigns = [];
if ($res) while ($r = $res->fetch_assoc()) {
    if ($r['campaign']) $campaigns[] = $r['campaign'];
}

echo json_encode(['campaigns' => $campaigns]);
exit;
?>