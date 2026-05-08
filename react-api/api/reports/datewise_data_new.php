<?php
/*
 * GET /api/datewise_data_new.php?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 *                               [&campaign=X][&adset=Y][&ad=Z]
 *
 * Server-Sent Events (SSE) endpoint — streams one row per date, then averages, totals, complete.
 *
 * Tables used:
 *   fb_ads_details    (date, campaign, adset, ad, cost) — Meta ad spend
 *   users             (user_id, registered_at)          — registrations
 *   user_campaign     (user_id, campaign, adset, ad)    — attribution
 *   additional_details(user_id, joined_wa_communtity)   — WA join status
 *   cit_results       (user_id, exam_id)                — exam taken
 *   internship_payment(user_id, payment_id)             — purchases
 *   payment_status    (payment_id, amount)              — revenue amount
 *
 * SSE format (matches JS expectations in datewise_data.php):
 *   data: {"2024-01-01": {...row...}}\n\n
 *   data: {"averages": {...}}\n\n
 *   data: {"totals": {...}}\n\n
 *   data: {"complete": true}\n\n
 */

ini_set('display_errors', 0);
error_reporting(0);

ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_end_clean();

// SSE headers — must come before any output
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no'); // Disable nginx buffering
header('Connection: keep-alive');

global $conn;
if (!$conn) {
    echo "data: " . json_encode(['complete' => true]) . "\n\n";
    flush(); exit;
}

// Increase limits for long queries
set_time_limit(300);
$conn->query("SET SESSION tmp_table_size   = 1024 * 1024 * 256");
$conn->query("SET SESSION max_heap_table_size = 1024 * 1024 * 256");

/* ── Parameters ── */
$start    = $conn->real_escape_string($_GET['start_date'] ?? '');
$end      = $conn->real_escape_string($_GET['end_date']   ?? '');
$campaign = $conn->real_escape_string(urldecode($_GET['campaign'] ?? ''));
$adset    = $conn->real_escape_string(urldecode($_GET['adset']    ?? ''));
$ad       = $conn->real_escape_string(urldecode($_GET['ad']       ?? ''));

if (!$start || !$end) {
    echo "data: " . json_encode(['complete' => true]) . "\n\n";
    flush(); exit;
}

/* ─────────────────────────────────────────────────
   BUILD CAMPAIGN FILTER for user_campaign JOIN
   Users are attributed to a campaign by user_campaign
───────────────────────────────────────────────── */
$uc_conditions = [];
if ($campaign) $uc_conditions[] = "uc.campaign = '$campaign'";
if ($adset)    $uc_conditions[] = "uc.adset = '$adset'";
if ($ad)       $uc_conditions[] = "uc.ad = '$ad'";
$uc_filter = $uc_conditions ? 'AND ' . implode(' AND ', $uc_conditions) : '';

/* ─────────────────────────────────────────────────
   BUILD FB ADS FILTER for cost lookup
───────────────────────────────────────────────── */
$fb_conditions = ["date BETWEEN '$start' AND '$end'"];
if ($campaign) $fb_conditions[] = "campaign = '$campaign'";
if ($adset)    $fb_conditions[] = "adset = '$adset'";
if ($ad)       $fb_conditions[] = "ad = '$ad'";
$fb_where = 'WHERE ' . implode(' AND ', $fb_conditions);

/* ─────────────────────────────────────────────────
   PRE-FETCH daily meta spend  (date → cost)
───────────────────────────────────────────────── */
$spend_map = [];
$res = $conn->query("SELECT date, SUM(cost) AS total_cost FROM fb_ads_details $fb_where GROUP BY date");
if ($res) while ($r = $res->fetch_assoc()) {
    $spend_map[$r['date']] = (float)$r['total_cost'];
}

/* ─────────────────────────────────────────────────
   GENERATE date range
───────────────────────────────────────────────── */
$dates = [];
$cur = new DateTime($start);
$fin = new DateTime($end);
while ($cur <= $fin) {
    $dates[] = $cur->format('Y-m-d');
    $cur->modify('+1 day');
}

/* ─────────────────────────────────────────────────
   ACCUMULATORS for averages / totals
───────────────────────────────────────────────── */
$totals   = ['cost'=>0,'registration_count'=>0,'wa_count'=>0,'exam_taken_count'=>0,
             'internship_purchase_once_count'=>0,'internship_purchase_twice_count'=>0,'revenue'=>0];
$row_count = 0;

/* ─────────────────────────────────────────────────
   PER-DATE QUERY
───────────────────────────────────────────────── */
foreach ($dates as $date) {
    $cost = $spend_map[$date] ?? 0;

    /* ── Registrations on this date (filtered by campaign) ── */
    $reg_sql = "
        SELECT COUNT(DISTINCT u.user_id) AS cnt
        FROM users u
        LEFT JOIN user_campaign uc ON uc.user_id = u.user_id
        WHERE DATE(u.registered_at) = '$date'
        $uc_filter
    ";
    $registration_count = (int)($conn->query($reg_sql)->fetch_assoc()['cnt'] ?? 0);

    if ($registration_count === 0 && $cost === 0) {
        // Skip empty days
        continue;
    }

    /* ── Base subquery: users registered on this date ── */
    $base_users = "
        SELECT DISTINCT u.user_id
        FROM users u
        LEFT JOIN user_campaign uc ON uc.user_id = u.user_id
        WHERE DATE(u.registered_at) = '$date'
        $uc_filter
    ";

    /* ── WhatsApp joined (joined_wa_communtity IS NOT NULL and != '') ── */
    $wa_sql = "
        SELECT COUNT(DISTINCT u.user_id) AS cnt
        FROM users u
        INNER JOIN additional_details ad ON ad.user_id = u.user_id
        LEFT JOIN user_campaign uc ON uc.user_id = u.user_id
        WHERE DATE(u.registered_at) = '$date'
          AND ad.joined_wa_communtity IS NOT NULL
          AND ad.joined_wa_communtity != ''
        $uc_filter
    ";
    $wa_count = (int)($conn->query($wa_sql)->fetch_assoc()['cnt'] ?? 0);

    /* ── Exam taken (user has a cit_results row) ── */
    $exam_sql = "
        SELECT COUNT(DISTINCT u.user_id) AS cnt
        FROM users u
        INNER JOIN cit_results cr ON cr.user_id = u.user_id
        LEFT JOIN user_campaign uc ON uc.user_id = u.user_id
        WHERE DATE(u.registered_at) = '$date'
        $uc_filter
    ";
    $exam_taken_count = (int)($conn->query($exam_sql)->fetch_assoc()['cnt'] ?? 0);

    /* ── Internship purchases: once (exactly 1) vs twice (2+) ── */
    $purch_sql = "
        SELECT
            SUM(CASE WHEN ip_cnt = 1 THEN 1 ELSE 0 END) AS once_count,
            SUM(CASE WHEN ip_cnt >= 2 THEN 1 ELSE 0 END) AS twice_count,
            SUM(revenue) AS total_revenue
        FROM (
            SELECT ip.user_id,
                   COUNT(ip.id) AS ip_cnt,
                   COALESCE(SUM(ps.amount), 0) AS revenue
            FROM internship_payment ip
            INNER JOIN users u ON u.user_id = ip.user_id
            LEFT JOIN user_campaign uc ON uc.user_id = u.user_id
            LEFT JOIN payment_status ps ON ps.payment_id = ip.payment_id
            WHERE DATE(u.registered_at) = '$date'
            $uc_filter
            GROUP BY ip.user_id
        ) sub
    ";
    $purch_res = $conn->query($purch_sql);
    $purch_row = $purch_res ? $purch_res->fetch_assoc() : [];
    $internship_purchase_once_count  = (int)($purch_row['once_count']    ?? 0);
    $internship_purchase_twice_count = (int)($purch_row['twice_count']   ?? 0);
    $revenue                         = (float)($purch_row['total_revenue'] ?? 0);

    /* ── Percentages (of registration_count) ── */
    $safe_reg = max($registration_count, 1);
    $wa_pct           = round($wa_count / $safe_reg * 100, 2);
    $exam_pct         = round($exam_taken_count / $safe_reg * 100, 2);
    $once_pct         = round($internship_purchase_once_count / $safe_reg * 100, 2);
    $twice_pct        = round($internship_purchase_twice_count / $safe_reg * 100, 2);

    /* ── Cost per action ── */
    $safe_cost = max($cost, 0.01);
    $registration_cost                = $registration_count  > 0 ? round($cost / $registration_count, 2)  : 0;
    $whatsapp_joined_cost             = $wa_count            > 0 ? round($cost / $wa_count, 2)            : 0;
    $exam_taken_cost                  = $exam_taken_count    > 0 ? round($cost / $exam_taken_count, 2)    : 0;
    $internship_purchase_once_cost    = $internship_purchase_once_count  > 0 ? round($cost / $internship_purchase_once_count, 2)  : 0;
    $internship_purchase_twice_cost   = $internship_purchase_twice_count > 0 ? round($cost / $internship_purchase_twice_count, 2) : 0;

    /* ── ROI ── */
    $roi = $cost > 0 ? round(($revenue / $cost) * 100, 2) : 0;

    /* ── Accumulate ── */
    $totals['cost']                              += $cost;
    $totals['registration_count']                += $registration_count;
    $totals['wa_count']                          += $wa_count;
    $totals['exam_taken_count']                  += $exam_taken_count;
    $totals['internship_purchase_once_count']    += $internship_purchase_once_count;
    $totals['internship_purchase_twice_count']   += $internship_purchase_twice_count;
    $totals['revenue']                           += $revenue;
    $row_count++;

    /* ── Stream row ── */
    $row = [
        'cost'                              => round($cost, 2),
        'registration_count'                => $registration_count,
        'registration_cost'                 => $registration_cost,
        'wa_count'                          => $wa_count,
        'whatsapp_joined_percentage'        => $wa_pct,
        'whatsapp_joined_cost'              => $whatsapp_joined_cost,
        'exam_taken_count'                  => $exam_taken_count,
        'exam_taken_percentage'             => $exam_pct,
        'exam_taken_cost'                   => $exam_taken_cost,
        'internship_purchase_once_count'    => $internship_purchase_once_count,
        'internship_purchase_once_percentage'=> $once_pct,
        'internship_purchase_once_cost'     => $internship_purchase_once_cost,
        'internship_purchase_twice_count'   => $internship_purchase_twice_count,
        'internship_purchase_twice_percentage'=> $twice_pct,
        'internship_purchase_twice_cost'    => $internship_purchase_twice_cost,
        'revenue'                           => round($revenue, 2),
        'roi'                               => $roi,
    ];

    echo "data: " . json_encode([$date => $row]) . "\n\n";
    flush();
    ob_flush();
}

/* ─────────────────────────────────────────────────
   AVERAGES
───────────────────────────────────────────────── */
if ($row_count > 0) {
    $safe_r  = max($row_count, 1);
    $safe_rg = max($totals['registration_count'], 1);
    $tot_rev = $totals['revenue'];
    $tot_cost = max($totals['cost'], 0.01);

    $averages = [
        'cost'                               => round($totals['cost'] / $safe_r, 2),
        'registration_count'                 => round($totals['registration_count'] / $safe_r, 2),
        'registration_cost'                  => round($totals['cost'] / $safe_rg, 2),
        'wa_count'                           => round($totals['wa_count'] / $safe_r, 2),
        'whatsapp_joined_percentage'         => round($totals['wa_count'] / $safe_rg * 100, 2),
        'whatsapp_joined_cost'               => $totals['wa_count'] > 0 ? round($totals['cost'] / $totals['wa_count'], 2) : 0,
        'exam_taken_count'                   => round($totals['exam_taken_count'] / $safe_r, 2),
        'exam_taken_percentage'              => round($totals['exam_taken_count'] / $safe_rg * 100, 2),
        'exam_taken_cost'                    => $totals['exam_taken_count'] > 0 ? round($totals['cost'] / $totals['exam_taken_count'], 2) : 0,
        'internship_purchase_once_count'     => round($totals['internship_purchase_once_count'] / $safe_r, 2),
        'internship_purchase_once_percentage'=> round($totals['internship_purchase_once_count'] / $safe_rg * 100, 2),
        'internship_purchase_once_cost'      => $totals['internship_purchase_once_count'] > 0 ? round($totals['cost'] / $totals['internship_purchase_once_count'], 2) : 0,
        'internship_purchase_twice_count'    => round($totals['internship_purchase_twice_count'] / $safe_r, 2),
        'internship_purchase_twice_percentage'=> round($totals['internship_purchase_twice_count'] / $safe_rg * 100, 2),
        'internship_purchase_twice_cost'     => $totals['internship_purchase_twice_count'] > 0 ? round($totals['cost'] / $totals['internship_purchase_twice_count'], 2) : 0,
        'revenue'                            => round($tot_rev / $safe_r, 2),
        'roi'                                => round(($tot_rev / $tot_cost) * 100, 2),
    ];
    echo "data: " . json_encode(['averages' => $averages]) . "\n\n";
    flush(); ob_flush();
}

/* ─────────────────────────────────────────────────
   TOTALS
───────────────────────────────────────────────── */
if ($row_count > 0) {
    $safe_rg  = max($totals['registration_count'], 1);
    $tot_cost = max($totals['cost'], 0.01);
    $tot_rev  = $totals['revenue'];

    $totals_out = [
        'cost'                               => round($totals['cost'], 2),
        'registration_count'                 => $totals['registration_count'],
        'registration_cost'                  => round($totals['cost'] / $safe_rg, 2),
        'wa_count'                           => $totals['wa_count'],
        'whatsapp_joined_percentage'         => round($totals['wa_count'] / $safe_rg * 100, 2),
        'whatsapp_joined_cost'               => $totals['wa_count'] > 0 ? round($totals['cost'] / $totals['wa_count'], 2) : 0,
        'exam_taken_count'                   => $totals['exam_taken_count'],
        'exam_taken_percentage'              => round($totals['exam_taken_count'] / $safe_rg * 100, 2),
        'exam_taken_cost'                    => $totals['exam_taken_count'] > 0 ? round($totals['cost'] / $totals['exam_taken_count'], 2) : 0,
        'internship_purchase_once_count'     => $totals['internship_purchase_once_count'],
        'internship_purchase_once_percentage'=> round($totals['internship_purchase_once_count'] / $safe_rg * 100, 2),
        'internship_purchase_once_cost'      => $totals['internship_purchase_once_count'] > 0 ? round($totals['cost'] / $totals['internship_purchase_once_count'], 2) : 0,
        'internship_purchase_twice_count'    => $totals['internship_purchase_twice_count'],
        'internship_purchase_twice_percentage'=> round($totals['internship_purchase_twice_count'] / $safe_rg * 100, 2),
        'internship_purchase_twice_cost'     => $totals['internship_purchase_twice_count'] > 0 ? round($totals['cost'] / $totals['internship_purchase_twice_count'], 2) : 0,
        'revenue'                            => round($tot_rev, 2),
        'roi'                                => round(($tot_rev / $tot_cost) * 100, 2),
    ];
    echo "data: " . json_encode(['totals' => $totals_out]) . "\n\n";
    flush(); ob_flush();
}

/* ── Done ── */
echo "data: " . json_encode(['complete' => true]) . "\n\n";
flush(); ob_flush();
exit;
?>