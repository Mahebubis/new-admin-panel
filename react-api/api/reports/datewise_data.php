<?php
/*
 * GET /api/datewise_data.php
 *   ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 *   [&campaign=X][&adset=Y][&ad=Z]
 *   [&expand=ads]          — include adset+ad breakdown
 *
 * Returns:
 *   { data: [{date, campaign, adset, ad, cost, revenue, leads, cpl, roi},...], counts: {campaign: {adset_count, ad_count}} }
 *
 * Tables:
 *   fb_ads_details    (date, campaign, adset, ad, cost)
 *   users             (user_id, registered_at)
 *   user_campaign     (user_id, campaign, adset, ad)
 *   internship_payment(user_id, payment_id)
 *   payment_status    (payment_id, amount)
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['error'=>'DB failed']); exit; }

$conn->query("SET SESSION tmp_table_size   = 1024*1024*256");
$conn->query("SET SESSION max_heap_table_size = 1024*1024*256");

$start    = $conn->real_escape_string($_GET['start_date'] ?? '');
$end      = $conn->real_escape_string($_GET['end_date']   ?? '');
$campaign = $conn->real_escape_string(urldecode($_GET['campaign'] ?? ''));
$adset    = $conn->real_escape_string(urldecode($_GET['adset']    ?? ''));
$ad       = $conn->real_escape_string(urldecode($_GET['ad']       ?? ''));
$expand   = $_GET['expand'] ?? '';

if (!$start || !$end) { echo json_encode(['error'=>'start_date and end_date required']); exit; }

/* ─── Build WHERE conditions ─── */
$fb_conds  = ["f.date BETWEEN '$start' AND '$end'"];
$uc_conds  = ["DATE(u.registered_at) BETWEEN '$start' AND '$end'"];

if ($campaign) { $fb_conds[] = "f.campaign='$campaign'"; $uc_conds[] = "uc.campaign='$campaign'"; }
if ($adset)    { $fb_conds[] = "f.adset='$adset'";       $uc_conds[] = "uc.adset='$adset'"; }
if ($ad)       { $fb_conds[] = "f.ad='$ad'";             $uc_conds[] = "uc.ad='$ad'"; }

$fb_where  = 'WHERE ' . implode(' AND ', $fb_conds);
$uc_where  = 'WHERE ' . implode(' AND ', $uc_conds);

/* ─── Grouping depends on expand param ─── */
if ($expand === 'ads') {
    $fb_group   = "f.date, f.campaign, f.adset, f.ad";
    $uc_group   = "DATE(u.registered_at), uc.campaign, uc.adset, uc.ad";
    $sel_extra  = ", f.adset, f.ad";
    $uc_extra   = ", uc.adset, uc.ad";
} else {
    $fb_group   = "f.date, f.campaign";
    $uc_group   = "DATE(u.registered_at), uc.campaign";
    $sel_extra  = ", '' AS adset, '' AS ad";
    $uc_extra   = ", '' AS adset, '' AS ad";
}

/* ─── 1. Meta Spend per date/campaign ─── */
$spend_sql = "
    SELECT f.date, f.campaign $sel_extra, SUM(f.cost) AS cost
    FROM fb_ads_details f
    $fb_where
    GROUP BY $fb_group
";
$spend_res = $conn->query($spend_sql);
$spend_map = [];
if ($spend_res) while ($r = $spend_res->fetch_assoc()) {
    $key = $r['date'] . '|' . ($r['campaign']??'') . '|' . ($r['adset']??'') . '|' . ($r['ad']??'');
    $spend_map[$key] = (float)$r['cost'];
}

/* ─── 2. Leads (registrations) + Revenue per date/campaign ─── */
$leads_sql = "
    SELECT
        DATE(u.registered_at) AS date,
        uc.campaign $uc_extra,
        COUNT(DISTINCT u.user_id) AS leads,
        COALESCE(SUM(ps.amount), 0) AS revenue
    FROM users u
    LEFT JOIN user_campaign uc ON uc.user_id = u.user_id
    LEFT JOIN internship_payment ip ON ip.user_id = u.user_id
    LEFT JOIN payment_status ps ON ps.payment_id = ip.payment_id
    $uc_where
    GROUP BY $uc_group
";
$leads_res = $conn->query($leads_sql);
$leads_map = [];
if ($leads_res) while ($r = $leads_res->fetch_assoc()) {
    $key = $r['date'] . '|' . ($r['campaign']??'') . '|' . ($r['adset']??'') . '|' . ($r['ad']??'');
    $leads_map[$key] = ['leads'=>(int)$r['leads'], 'revenue'=>(float)$r['revenue']];
}

/* ─── 3. Merge into unified rows ─── */
$all_keys = array_unique(array_merge(array_keys($spend_map), array_keys($leads_map)));
$rows = [];
foreach ($all_keys as $key) {
    [$date, $camp, $ads, $adv] = explode('|', $key, 4);
    $cost    = $spend_map[$key] ?? 0;
    $leads   = $leads_map[$key]['leads']   ?? 0;
    $revenue = $leads_map[$key]['revenue'] ?? 0;
    $roi     = $cost > 0 ? round($revenue / $cost, 4) : 0;
    $cpl     = $leads > 0 ? round($cost / $leads, 2) : 0;
    $rows[] = [
        'date'     => $date,
        'campaign' => $camp,
        'adset'    => $ads,
        'ad'       => $adv,
        'cost'     => round($cost, 2),
        'revenue'  => round($revenue, 2),
        'leads'    => $leads,
        'cpl'      => $cpl,
        'roi'      => $roi,
    ];
}

// Sort by date ASC, then campaign
usort($rows, fn($a,$b) => $a['date'] <=> $b['date'] ?: strcmp($a['campaign'],$b['campaign']));

/* ─── 4. Counts (adset_count, ad_count per campaign) ─── */
$counts = [];
$cnt_res = $conn->query("
    SELECT campaign,
           COUNT(DISTINCT adset) AS adset_count,
           COUNT(DISTINCT ad)    AS ad_count
    FROM fb_ads_details
    WHERE date BETWEEN '$start' AND '$end'
    " . ($campaign ? "AND campaign='$campaign'" : "") . "
    GROUP BY campaign
");
if ($cnt_res) while ($r = $cnt_res->fetch_assoc()) {
    $counts[$r['campaign']] = [
        'adset_count' => (int)$r['adset_count'],
        'ad_count'    => (int)$r['ad_count'],
    ];
}

echo json_encode(['data' => $rows, 'counts' => $counts]);
exit;
?>