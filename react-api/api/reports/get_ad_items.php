<?php
/*
 * GET /api/get_ad_items.php?campaign=X&adset=Y&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * Returns distinct ads for a given campaign/adset and date range.
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['ads'=>[]]); exit; }

$campaign = $conn->real_escape_string($_GET['campaign']   ?? '');
$adset    = $conn->real_escape_string($_GET['adset']      ?? '');
$start    = $conn->real_escape_string($_GET['start_date'] ?? '');
$end      = $conn->real_escape_string($_GET['end_date']   ?? '');

$conditions = [];
if ($campaign)       $conditions[] = "campaign = '$campaign'";
if ($adset)          $conditions[] = "adset = '$adset'";
if ($start && $end)  $conditions[] = "date BETWEEN '$start' AND '$end'";
elseif ($start)      $conditions[] = "date >= '$start'";

$where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

$res = $conn->query("SELECT DISTINCT ad FROM fb_ads_details $where ORDER BY ad ASC");
$ads = [];
if ($res) while ($r = $res->fetch_assoc()) {
    if ($r['ad']) $ads[] = $r['ad'];
}

echo json_encode(['ads' => $ads]);
exit;
?>