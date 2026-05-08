<?php
/*
 * GET /api/get_adset_items.php?campaign=X&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * Returns distinct adsets for a given campaign and date range.
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['adsets'=>[]]); exit; }

$campaign = $conn->real_escape_string($_GET['campaign']   ?? '');
$start    = $conn->real_escape_string($_GET['start_date'] ?? '');
$end      = $conn->real_escape_string($_GET['end_date']   ?? '');

$conditions = [];
if ($campaign)       $conditions[] = "campaign = '$campaign'";
if ($start && $end)  $conditions[] = "date BETWEEN '$start' AND '$end'";
elseif ($start)      $conditions[] = "date >= '$start'";

$where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

$res = $conn->query("SELECT DISTINCT adset FROM fb_ads_details $where ORDER BY adset ASC");
$adsets = [];
if ($res) while ($r = $res->fetch_assoc()) {
    if ($r['adset']) $adsets[] = $r['adset'];
}

echo json_encode(['adsets' => $adsets]);
exit;
?>