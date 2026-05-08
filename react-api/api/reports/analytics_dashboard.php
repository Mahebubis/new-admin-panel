<?php
/**
 * /api/analytics-dashboard.php
 *
 * Standalone API for the Analytics Dashboard (AnalyticsDashboard.jsx).
 * Mirrors testnew.php logic exactly — single combined fetch_analytics call
 * (no phase splitting), with goal classification done server-side.
 *
 * Actions (POST):
 *   get_cit_versions   → list CIT version names
 *   get_date_range     → from/to dates for a CIT version
 *   update_meta_token  → upsert token in settings table
 *   fetch_analytics    → complete Meta + DB analytics with goal classification
 */

ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

/* ─── DB ─── */
$host   = '127.0.0.1:3306';
$dbname = 'istudio_cit';
$dbuser = 'istudio_admin';
$dbpass = 'h;V[ts@#;u{B';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $dbuser, $dbpass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET SESSION tmp_table_size     = 1073741824");
    $pdo->exec("SET SESSION max_heap_table_size = 1073741824");
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'DB: ' . $e->getMessage()]);
    exit;
}

define('AD_ACCOUNT_ID', 'act_440296640847969');

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
function getToken() {
    global $pdo;
    $s = $pdo->prepare("SELECT settings_value FROM settings WHERE settings_key='meta_access_token' LIMIT 1");
    $s->execute();
    return $s->fetchColumn() ?: null;
}

function isTokenError($msg) {
    $kw = [
        'invalid oauth access token',
        'error validating access token',
        'session has expired',
        'access token could not be decrypted',
        'invalid access token',
    ];
    foreach ($kw as $k) {
        if (stripos($msg, $k) !== false) return true;
    }
    return false;
}

/** cURL GET, returns decoded array */
function metaGet($url) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 30,
    ]);
    $resp = curl_exec($ch);
    if (curl_errno($ch)) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new Exception('cURL error: ' . $err);
    }
    curl_close($ch);
    return json_decode($resp, true);
}

/** Paginate through Meta API and return all records */
function metaGetAll($url) {
    $all = [];
    while ($url) {
        $d = metaGet($url);
        if (isset($d['error'])) break;
        $all = array_merge($all, $d['data'] ?? []);
        $url = $d['paging']['next'] ?? null;
    }
    return $all;
}

/** Determine campaign goal from name — matches testnew.php exactly */
function campaignGoal($name) {
    if (stripos($name, 'Adv') !== false || stripos($name, '_A') !== false) {
        return 'register';
    }
    if (stripos($name, '_P') !== false || stripos($name, '_C') !== false ||
        stripos($name, '_B') !== false || stripos($name, '_D') !== false ||
        stripos($name, '_E') !== false) {
        return 'purchase';
    }
    return 'unknown';
}

$action = $_POST['action'] ?? '';

/* ══════════════════════════════════════
   GET CIT VERSIONS
══════════════════════════════════════ */
if ($action === 'get_cit_versions') {
    $stmt = $pdo->query("
        SELECT exam_name
        FROM exam_batch_for_reports
        GROUP BY exam_name
        ORDER BY MAX(id) DESC
    ");
    $versions = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo json_encode(['success' => true, 'versions' => $versions]);
    exit;
}

/* ══════════════════════════════════════
   GET DATE RANGE FOR CIT VERSION
══════════════════════════════════════ */
if ($action === 'get_date_range') {
    $cit = $_POST['cit_version'] ?? '';
    $stmt = $pdo->prepare("
        SELECT from_date, to_date
        FROM exam_batch_for_reports
        WHERE exam_name = ?
        LIMIT 1
    ");
    $stmt->execute([$cit]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        echo json_encode([
            'success'   => true,
            'from_date' => date('Y-m-d', strtotime($row['from_date'] . ' +1 day')),
            'to_date'   => $row['to_date'],
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Date range not found']);
    }
    exit;
}

/* ══════════════════════════════════════
   UPDATE META TOKEN
══════════════════════════════════════ */
if ($action === 'update_meta_token') {
    $token = trim($_POST['token'] ?? '');
    if (!$token) {
        echo json_encode(['success' => false, 'message' => 'Token empty']);
        exit;
    }
    $chk = $pdo->prepare("SELECT id FROM settings WHERE settings_key='meta_access_token' LIMIT 1");
    $chk->execute();
    if ($chk->fetchColumn()) {
        $s = $pdo->prepare("UPDATE settings SET settings_value=? WHERE settings_key='meta_access_token'");
    } else {
        $s = $pdo->prepare("INSERT INTO settings (settings_key,settings_value) VALUES ('meta_access_token',?)");
    }
    $s->execute([$token]);
    echo json_encode(['success' => true]);
    exit;
}

/* ══════════════════════════════════════
   FETCH ANALYTICS  (single combined call)
   — exact port of testnew.php fetch_analytics —
══════════════════════════════════════ */
if ($action === 'fetch_analytics') {

    $token = getToken();
    if (!$token) {
        echo json_encode(['success' => false, 'token_expired' => true, 'message' => 'Meta Access Token Missing']);
        exit;
    }

    $fromDate   = $pdo->quote($_POST['from_date']   ?? '');
    $toDate     = $pdo->quote($_POST['to_date']     ?? '');
    $goalFilter = $_POST['goal_filter'] ?? 'all';
    $perPage    = max(50, (int)($_POST['per_page'] ?? 2000));

    // un-quote for use in curl
    $fromDate = trim($fromDate, "'");
    $toDate   = trim($toDate,   "'");

    if (!$fromDate || !$toDate) {
        echo json_encode(['success' => false, 'message' => 'from_date and to_date required']);
        exit;
    }

    try {
        /* ─────────────────────────────
           STEP 1: Meta Insights (ad-level)
        ───────────────────────────── */
        $fields = 'ad_id,campaign_id,campaign_name,adset_name,ad_name,spend,impressions,clicks,reach,ctr,cpc,frequency';
        $metaUrl = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID
            . '/insights?level=ad'
            . '&fields=' . $fields
            . '&time_range={"since":"' . $fromDate . '","until":"' . $toDate . '"}'
            . '&limit=' . $perPage
            . '&access_token=' . $token;

        $metaResp = metaGet($metaUrl);

        if (isset($metaResp['error'])) {
            $errMsg = $metaResp['error']['message'] ?? 'Unknown Meta Error';
            if (isTokenError($errMsg)) {
                echo json_encode(['success' => false, 'token_expired' => true, 'message' => 'Meta Access Token Expired']);
                exit;
            }
            throw new Exception('Meta API Error: ' . $errMsg);
        }

        // Paginate through all pages
        $metaInsights = $metaResp['data'] ?? [];
        $nextUrl = $metaResp['paging']['next'] ?? null;
        while ($nextUrl) {
            $page        = metaGet($nextUrl);
            $metaInsights = array_merge($metaInsights, $page['data'] ?? []);
            $nextUrl     = $page['paging']['next'] ?? null;
        }

        /* ─────────────────────────────
           STEP 2: All Ads → delivery status map
        ───────────────────────────── */
        $adsUrl = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID
            . '/ads?fields=id,name,effective_status,configured_status&limit=2000&access_token=' . $token;
        $adsData = metaGetAll($adsUrl);

        $adIdToStatus = [];
        foreach ($adsData as $ad) {
            $adIdToStatus[$ad['id']] = $ad['effective_status'] ?? 'UNKNOWN';
        }

        /* ─────────────────────────────
           STEP 3: All Adsets → conversion event map
        ───────────────────────────── */
        $asUrl = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID
            . '/adsets?fields=id,name,campaign_id,optimization_goal,billing_event,promoted_object,status,effective_status'
            . '&limit=2000&access_token=' . $token;
        $adsetsData = metaGetAll($asUrl);

        // campaign_id → custom_event_type
        $campaignEventMap = [];
        foreach ($adsetsData as $as) {
            $cid   = $as['campaign_id'] ?? '';
            $event = $as['promoted_object']['custom_event_type'] ?? 'UNKNOWN';
            if ($cid && !isset($campaignEventMap[$cid])) {
                $campaignEventMap[$cid] = $event;
            }
        }

        /* ─────────────────────────────
           STEP 4: Aggregate Meta insights by campaign
        ───────────────────────────── */
        $campaignGroups = [];
        foreach ($metaInsights as $row) {
            $camp = trim($row['campaign_name'] ?? '');
            if ($camp === '') continue;

            if (!isset($campaignGroups[$camp])) {
                $campaignGroups[$camp] = [
                    'campaign_id' => $row['campaign_id'] ?? '',
                    'spend'       => 0,
                    'impressions' => 0,
                    'clicks'      => 0,
                    'reach'       => 0,
                    'date_start'  => $row['date_start'] ?? '',
                    'date_stop'   => $row['date_stop']  ?? '',
                ];
            }
            $campaignGroups[$camp]['spend']       += (float)($row['spend']       ?? 0);
            $campaignGroups[$camp]['impressions'] += (int)  ($row['impressions'] ?? 0);
            $campaignGroups[$camp]['clicks']      += (int)  ($row['clicks']      ?? 0);
            $campaignGroups[$camp]['reach']       += (int)  ($row['reach']       ?? 0);
        }

        /* Build campaign_name → delivery_status map */
        $campaignStatusMap = [];
        foreach ($metaInsights as $row) {
            $camp = trim($row['campaign_name'] ?? '');
            $adId = trim($row['ad_id']         ?? '');
            if ($camp === '' || $adId === '') continue;
            $campaignStatusMap[$camp] = $adIdToStatus[$adId] ?? 'UNKNOWN';
        }

        /* ─────────────────────────────
           STEP 5: DB — user IDs in date range
        ───────────────────────────── */
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
        $stmt->execute([$fromDate . ' 00:00:00', $toDate . ' 23:59:59']);
        $allUserIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($allUserIds)) {
            echo json_encode(['success' => true, 'data' => [], 'meta_raw' => $metaInsights]);
            exit;
        }

        $ph = implode(',', array_fill(0, count($allUserIds), '?'));

        /* ─────────────────────────────
           STEP 6: Registrations per campaign
        ───────────────────────────── */
        $stmt = $pdo->prepare("
            SELECT user_id,
                   COALESCE(NULLIF(TRIM(campaign),''), 'Direct/Unknown') AS campaign
            FROM user_campaign
            WHERE user_id IN ($ph)
        ");
        $stmt->execute($allUserIds);

        $registrationsMap = [];
        $userIdsMap       = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $c = $r['campaign'];
            $u = $r['user_id'];
            $userIdsMap[$c][] = $u;
            $registrationsMap[$c] = count(array_unique($userIdsMap[$c]));
        }

        /* ─────────────────────────────
           STEP 7: Exams per campaign
        ───────────────────────────── */
        $stmt = $pdo->prepare("
            SELECT DISTINCT
                COALESCE(NULLIF(TRIM(uc.campaign),''), 'Direct/Unknown') AS campaign,
                cr.user_id
            FROM cit_results cr
            LEFT JOIN user_campaign uc ON uc.user_id = cr.user_id
            WHERE cr.user_id IN ($ph)
        ");
        $stmt->execute($allUserIds);

        $examMap     = [];
        $examUserMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $c = $r['campaign'];
            $u = $r['user_id'];
            $examUserMap[$c][] = $u;
            $examMap[$c] = count(array_unique($examUserMap[$c]));
        }

        /* ─────────────────────────────
           STEP 8: Purchases + Revenue per campaign
        ───────────────────────────── */
        $stmt = $pdo->prepare("
            SELECT
                COALESCE(NULLIF(TRIM(uc.campaign),''), 'Direct/Unknown') AS campaign,
                COUNT(DISTINCT ps.user_id) AS internships,
                COALESCE(SUM(ps.amount), 0) AS revenue
            FROM payment_status ps
            LEFT JOIN user_campaign uc ON uc.user_id = ps.user_id
            WHERE ps.status = 'success'
              AND ps.user_id IN ($ph)
            GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''), 'Direct/Unknown')
        ");
        $stmt->execute($allUserIds);

        $internshipMap = [];
        $revenueMap    = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $internshipMap[$r['campaign']] = (int)  $r['internships'];
            $revenueMap[$r['campaign']]    = (float)$r['revenue'];
        }

        /* ─────────────────────────────
           STEP 9: 2nd Internship per campaign
        ───────────────────────────── */
        $stmt = $pdo->prepare("
            SELECT
                COALESCE(NULLIF(TRIM(uc.campaign),''), 'Direct/Unknown') AS campaign,
                COUNT(DISTINCT sub.user_id) AS second_internships
            FROM (
                SELECT user_id
                FROM payment_status
                WHERE status = 'success'
                  AND user_id IN ($ph)
                GROUP BY user_id
                HAVING COUNT(*) >= 2
            ) sub
            LEFT JOIN user_campaign uc ON uc.user_id = sub.user_id
            GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''), 'Direct/Unknown')
        ");
        $stmt->execute($allUserIds);

        $secondInternshipMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $secondInternshipMap[$r['campaign']] = (int)$r['second_internships'];
        }

        /* ─────────────────────────────
           STEP 10: Build processed data
        ───────────────────────────── */
        $processedData = [];

        foreach ($campaignGroups as $campaign => $mData) {
            $spend            = $mData['spend'];
            $registrations    = $registrationsMap[$campaign]    ?? 0;
            $examCount        = $examMap[$campaign]              ?? 0;
            $internshipCount  = $internshipMap[$campaign]        ?? 0;
            $revenue          = $revenueMap[$campaign]           ?? 0;
            $secondInternship = $secondInternshipMap[$campaign]  ?? 0;

            // Goal classification — exact match to testnew.php
            $goal = campaignGoal($campaign);

            // Apply goal filter
            if ($goalFilter !== 'all' && $goal !== $goalFilter) continue;

            // Metrics
            $costPerReg        = $registrations   > 0 ? $spend / $registrations   : 0;
            $costPerExam       = $examCount        > 0 ? $spend / $examCount       : 0;
            $costPerInternship = $internshipCount  > 0 ? $spend / $internshipCount : 0;
            $roi               = $spend > 0 ? ($revenue / $spend) : 0;
            // RPU = revenue per internship (matches testnew.php, not phase1 which uses per-registration)
            $rpu               = $internshipCount  > 0 ? $revenue / $internshipCount : 0;
            $roas              = $spend > 0 ? $revenue / $spend : 0;

            $processedData[] = [
                'campaign_name'          => $campaign,
                'campaign_id'            => $mData['campaign_id'],
                'goal'                   => $goal,
                'delivery_status'        => $campaignStatusMap[$campaign]              ?? 'UNKNOWN',
                'conversion_event'       => $campaignEventMap[$mData['campaign_id']]  ?? 'UNKNOWN',
                'date_start'             => $mData['date_start'],
                'date_stop'              => $mData['date_stop'],
                'spend'                  => round($spend, 2),
                'impressions'            => $mData['impressions'],
                'clicks'                 => $mData['clicks'],
                'reach'                  => $mData['reach'],
                'registrations'          => $registrations,
                'cost_per_registration'  => round($costPerReg, 2),
                'exam_count'             => $examCount,
                'cost_per_exam'          => round($costPerExam, 2),
                'internship_count'       => $internshipCount,
                'second_internship'      => $secondInternship,
                'cost_per_internship'    => round($costPerInternship, 2),
                'revenue'                => round($revenue, 2),
                'roi'                    => round($roi, 2),
                'rpu'                    => round($rpu, 2),
                'roas'                   => round($roas, 2),
                'has_meta_data'          => true,
            ];
        }

        /* ─────────────────────────────
           Campaigns with DB data but no Meta spend
        ───────────────────────────── */
        foreach ($registrationsMap as $campaign => $regCount) {
            if (isset($campaignGroups[$campaign])) continue;

            $goal = campaignGoal($campaign);
            if ($goalFilter !== 'all' && $goal !== $goalFilter) continue;

            $examCount        = $examMap[$campaign]             ?? 0;
            $internshipCount  = $internshipMap[$campaign]       ?? 0;
            $revenue          = $revenueMap[$campaign]          ?? 0;
            $secondInternship = $secondInternshipMap[$campaign] ?? 0;
            $rpu              = $internshipCount > 0 ? round($revenue / $internshipCount, 2) : 0;

            $processedData[] = [
                'campaign_name'          => $campaign,
                'campaign_id'            => '',
                'goal'                   => $goal,
                'delivery_status'        => 'UNKNOWN',
                'conversion_event'       => 'UNKNOWN',
                'date_start'             => $fromDate,
                'date_stop'              => $toDate,
                'spend'                  => 0,
                'impressions'            => 0,
                'clicks'                 => 0,
                'reach'                  => 0,
                'registrations'          => $regCount,
                'cost_per_registration'  => 0,
                'exam_count'             => $examCount,
                'cost_per_exam'          => 0,
                'internship_count'       => $internshipCount,
                'second_internship'      => $secondInternship,
                'cost_per_internship'    => 0,
                'revenue'                => round($revenue, 2),
                'roi'                    => 0,
                'rpu'                    => $rpu,
                'roas'                   => 0,
                'has_meta_data'          => false,
            ];
        }

        /* Sort: Direct/Unknown first, then descending by spend */
        usort($processedData, function ($a, $b) {
            if ($a['campaign_name'] === 'Direct/Unknown') return -1;
            if ($b['campaign_name'] === 'Direct/Unknown') return  1;
            return $b['spend'] <=> $a['spend'];
        });

        echo json_encode([
            'success'  => true,
            'data'     => $processedData,
            'meta_raw' => $metaInsights,
        ]);

    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action']);
exit;
?>