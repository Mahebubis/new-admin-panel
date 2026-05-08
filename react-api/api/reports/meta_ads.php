<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

/* ============================================================================
   META ADS DASHBOARD - API ENDPOINT (React backend)
   File: meta_ads_api.php
   ----------------------------------------------------------------------------
   Pure JSON, action-based. Same pattern as the original real_time_reports2.php
   but with:
     - No HTML / no redirects (auth errors return JSON)
     - CORS headers for a separate React origin (optional, see top config)
     - All 7 actions preserved with IDENTICAL business logic
   ============================================================================ */

// Session is used ONLY for the Version Analysis cache (per-user 5-min TTL)
// if (session_status() === PHP_SESSION_NONE) {
//     @session_start();
// }

// /* --------------------------------------------------------------------------
//   CORS CONFIG
//   If your React app runs on the same origin as PHP, leave ALLOW_ORIGIN = null.
//   If it runs on a different origin (e.g. http://localhost:3000 during dev),
//   set ALLOW_ORIGIN to that exact origin. Wildcard '*' will NOT work with
//   credentials, so list the exact origin(s) you need.
//   -------------------------------------------------------------------------- */
// $ALLOW_ORIGIN = null; // e.g. 'http://localhost:3000' or 'https://app.example.com'

// if ($ALLOW_ORIGIN) {
//     header("Access-Control-Allow-Origin: $ALLOW_ORIGIN");
//     header("Access-Control-Allow-Credentials: true");
//     header("Access-Control-Allow-Methods: POST, OPTIONS");
//     header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");

//     // Preflight
//     if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
//         http_response_code(204);
//         exit;
//     }
// }

// header('Content-Type: application/json; charset=utf-8');

// /* --------------------------------------------------------------------------
//   Helper: JSON out + die
//   -------------------------------------------------------------------------- */
// function jsonOut($payload, $code = 200) {
//     http_response_code($code);
//     echo json_encode($payload);
//     exit;
// }

// /* --------------------------------------------------------------------------
//   Only POST allowed
//   -------------------------------------------------------------------------- */
// if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
//     jsonOut(['success' => false, 'message' => 'POST required'], 405);
// }

// $action = $_POST['action'] ?? '';
// if ($action === '') {
//     jsonOut(['success' => false, 'message' => 'Missing action']);
// }

// /* --------------------------------------------------------------------------
//   DB CONNECTION
//   -------------------------------------------------------------------------- */
// $host     = '127.0.0.1:3306';
// $dbname   = 'istudio_cit';
// $username = 'istudio_admin';
// $password = 'h;V[ts@#;u{B';

// try {
//     $pdo = new PDO(
//         "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
//         $username,
//         $password,
//         [
//             PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
//             PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
//         ]
//     );
// } catch (PDOException $e) {
//     jsonOut(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()], 500);
// }

// /* --------------------------------------------------------------------------
//   META API CONFIG
//   -------------------------------------------------------------------------- */
// define('AD_ACCOUNT_ID', 'act_440296640847969');

// /* ==========================================================================
//   HELPERS
//   ========================================================================== */

// /**
//  * Fetch all ads (paginated) with statuses from Meta Graph API
//  */
// function fetchAdsFromMeta() {
//     global $ACCESS_TOKEN;
//     $allAds = [];
//     $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
//           '/ads?fields=id,name,effective_status,configured_status&limit=2000&access_token=' . $ACCESS_TOKEN;

//     while ($url) {
//         $ch = curl_init();
//         curl_setopt($ch, CURLOPT_URL, $url);
//         curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//         curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
//         $response = curl_exec($ch);
//         curl_close($ch);

//         $data = json_decode($response, true);
//         if (isset($data['error'])) break;

//         $allAds = array_merge($allAds, $data['data'] ?? []);
//         $url = $data['paging']['next'] ?? null;
//     }
//     return $allAds;
// }

// /**
//  * Fetch all adsets (paginated)
//  */
// function fetchAdsetsFromMeta() {
//     global $ACCESS_TOKEN;
//     $allAdsets = [];
//     $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
//           '/adsets?fields=id,name,campaign_id,optimization_goal,billing_event,promoted_object,status,effective_status&limit=2000&access_token=' . $ACCESS_TOKEN;

//     while ($url) {
//         $ch = curl_init();
//         curl_setopt($ch, CURLOPT_URL, $url);
//         curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//         curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
//         $response = curl_exec($ch);
//         curl_close($ch);

//         $data = json_decode($response, true);
//         if (isset($data['error'])) break;

//         $allAdsets = array_merge($allAdsets, $data['data'] ?? []);
//         $url = $data['paging']['next'] ?? null;
//     }
//     return $allAdsets;
// }

// /**
//  * Build campaign_name -> effective_status map
//  * (takes ad -> status, then insights rows to link ad_id -> campaign_name)
//  */
// function buildCampaignStatusMap($adsData, $insightsRaw) {
//     $adIdToStatus = [];
//     foreach ($adsData as $ad) {
//         $adIdToStatus[$ad['id']] = $ad['effective_status'] ?? 'UNKNOWN';
//     }

//     $campaignStatusMap = [];
//     foreach ($insightsRaw as $row) {
//         $campaignName = trim($row['campaign_name'] ?? '');
//         $adId         = trim($row['ad_id'] ?? '');
//         if ($campaignName === '' || $adId === '') continue;
//         $campaignStatusMap[$campaignName] = $adIdToStatus[$adId] ?? 'UNKNOWN';
//     }
//     return $campaignStatusMap;
// }

// /**
//  * Build campaign_id -> custom_event_type map from adsets
//  */
// function buildCampaignEventMap($adsetsData) {
//     $campaignEventMap = [];
//     foreach ($adsetsData as $adset) {
//         $campaignId = $adset['campaign_id'] ?? '';
//         $event      = $adset['promoted_object']['custom_event_type'] ?? 'UNKNOWN';
//         if ($campaignId && !isset($campaignEventMap[$campaignId])) {
//             $campaignEventMap[$campaignId] = $event;
//         }
//     }
//     return $campaignEventMap;
// }

// /**
//  * Detect Meta token-expired errors
//  */
// function isTokenExpiredError($errMsg) {
//     return (
//         stripos($errMsg, 'invalid oauth access token')           !== false ||
//         stripos($errMsg, 'error validating access token')        !== false ||
//         stripos($errMsg, 'session has expired')                  !== false ||
//         stripos($errMsg, 'access token could not be decrypted')  !== false ||
//         stripos($errMsg, 'invalid access token')                 !== false
//     );
// }

// /**
//  * Fetch the stored Meta access token
//  */
// function getMetaToken($pdo) {
//     $stmt = $pdo->prepare("SELECT settings_value FROM settings WHERE settings_key='meta_access_token' LIMIT 1");
//     $stmt->execute();
//     return $stmt->fetchColumn();
// }

// /* ==========================================================================
//   ACTION: get_cit_versions
//   ========================================================================== */
// if ($action === 'get_cit_versions') {
//     try {
//         $stmt = $pdo->query("
//             SELECT exam_name
//             FROM exam_batch_for_reports
//             GROUP BY exam_name
//             ORDER BY MAX(id) DESC
//         ");
//         $versions = $stmt->fetchAll(PDO::FETCH_COLUMN);
//         jsonOut(['success' => true, 'versions' => $versions]);
//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ==========================================================================
//   ACTION: get_date_range
//   ========================================================================== */
// if ($action === 'get_date_range') {
//     $citVersion = $_POST['cit_version'] ?? '';
//     try {
//         $stmt = $pdo->prepare("
//             SELECT from_date, to_date
//             FROM exam_batch_for_reports
//             WHERE exam_name = ?
//             LIMIT 1
//         ");
//         $stmt->execute([$citVersion]);
//         $dates = $stmt->fetch(PDO::FETCH_ASSOC);

//         if ($dates) {
//             $fromDate = date('Y-m-d', strtotime($dates['from_date'] . ' +1 day'));
//             $toDate   = $dates['to_date'];
//             jsonOut([
//                 'success'   => true,
//                 'from_date' => $fromDate,
//                 'to_date'   => $toDate,
//             ]);
//         } else {
//             jsonOut(['success' => false, 'message' => 'Date range not found']);
//         }
//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ==========================================================================
//   ACTION: update_meta_token
//   ========================================================================== */
// if ($action === 'update_meta_token') {
//     $newToken = trim($_POST['token'] ?? '');
//     if ($newToken === '') {
//         jsonOut(['success' => false, 'message' => 'Token empty']);
//     }

//     try {
//         $checkStmt = $pdo->prepare("SELECT id FROM settings WHERE settings_key='meta_access_token' LIMIT 1");
//         $checkStmt->execute();
//         $rowId = $checkStmt->fetchColumn();

//         if ($rowId) {
//             $stmt = $pdo->prepare("
//                 UPDATE settings
//                 SET settings_value = ?
//                 WHERE settings_key = 'meta_access_token'
//             ");
//             $stmt->execute([$newToken]);
//         } else {
//             $stmt = $pdo->prepare("
//                 INSERT INTO settings (settings_key, settings_value)
//                 VALUES ('meta_access_token', ?)
//             ");
//             $stmt->execute([$newToken]);
//         }

//         jsonOut(['success' => true]);
//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ==========================================================================
//   ACTION: fetch_ad_stats
//   Per-ad aggregated stats from DB, filtered by registration date range
//   ========================================================================== */
// if ($action === 'fetch_ad_stats') {
//     $fromDate = $_POST['from_date'] ?? '';
//     $toDate   = $_POST['to_date']   ?? '';
//     $ads      = json_decode($_POST['ads'] ?? '[]', true);

//     if (empty($ads) || empty($fromDate) || empty($toDate)) {
//         jsonOut(['success' => false, 'message' => 'Missing params']);
//     }

//     try {
//         $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
//         $stmt->execute([$fromDate . ' 00:00:00', $toDate . ' 23:59:59']);
//         $allUserIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

//         if (empty($allUserIds)) {
//             jsonOut(['success' => true, 'data' => []]);
//         }

//         $ph    = implode(',', array_fill(0, count($allUserIds), '?'));
//         $adsPh = implode(',', array_fill(0, count($ads), '?'));

//         // Registrations per ad
//         $stmt = $pdo->prepare("
//             SELECT COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown') as ad_name,
//                   COUNT(DISTINCT uc.user_id) as registrations
//             FROM user_campaign uc
//             WHERE uc.user_id IN ($ph)
//               AND TRIM(uc.ad) IN ($adsPh)
//             GROUP BY COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown')
//         ");
//         $stmt->execute(array_merge($allUserIds, $ads));
//         $regMap = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $regMap[$r['ad_name']] = (int)$r['registrations'];
//         }

//         // Exams per ad
//         $stmt = $pdo->prepare("
//             SELECT COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown') as ad_name,
//                   COUNT(DISTINCT cr.user_id) as exam_count
//             FROM cit_results cr
//             JOIN user_campaign uc ON uc.user_id = cr.user_id
//             WHERE cr.user_id IN ($ph)
//               AND TRIM(uc.ad) IN ($adsPh)
//             GROUP BY COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown')
//         ");
//         $stmt->execute(array_merge($allUserIds, $ads));
//         $examMap = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $examMap[$r['ad_name']] = (int)$r['exam_count'];
//         }

//         // Internships + Revenue per ad
//         $stmt = $pdo->prepare("
//             SELECT COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown') as ad_name,
//                   COUNT(DISTINCT ps.user_id) as internship_count,
//                   COALESCE(SUM(ps.amount), 0) as revenue
//             FROM payment_status ps
//             JOIN user_campaign uc ON uc.user_id = ps.user_id
//             WHERE ps.status = 'success'
//               AND ps.user_id IN ($ph)
//               AND TRIM(uc.ad) IN ($adsPh)
//             GROUP BY COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown')
//         ");
//         $stmt->execute(array_merge($allUserIds, $ads));
//         $internMap  = [];
//         $revenueMap = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $internMap[$r['ad_name']]  = (int)$r['internship_count'];
//             $revenueMap[$r['ad_name']] = (float)$r['revenue'];
//         }

//         // 2nd internship per ad (users with >= 2 successful payments)
//         $stmt = $pdo->prepare("
//             SELECT COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown') as ad_name,
//                   COUNT(DISTINCT sub.user_id) as second_internship
//             FROM (
//                 SELECT user_id FROM payment_status
//                 WHERE status = 'success' AND user_id IN ($ph)
//                 GROUP BY user_id HAVING COUNT(*) >= 2
//             ) sub
//             JOIN user_campaign uc ON uc.user_id = sub.user_id
//             WHERE TRIM(uc.ad) IN ($adsPh)
//             GROUP BY COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown')
//         ");
//         $stmt->execute(array_merge($allUserIds, $ads));
//         $secondMap = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $secondMap[$r['ad_name']] = (int)$r['second_internship'];
//         }

//         $result = [];
//         foreach ($ads as $ad) {
//             $result[$ad] = [
//                 'registrations'     => $regMap[$ad]     ?? 0,
//                 'exam_count'        => $examMap[$ad]    ?? 0,
//                 'internship_count'  => $internMap[$ad]  ?? 0,
//                 'second_internship' => $secondMap[$ad]  ?? 0,
//                 'revenue'           => $revenueMap[$ad] ?? 0,
//             ];
//         }

//         jsonOut(['success' => true, 'data' => $result]);
//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ==========================================================================
//   ACTION: fetch_adset_stats
//   Per-adset aggregated stats from DB, filtered by registration date range
//   ========================================================================== */
// if ($action === 'fetch_adset_stats') {
//     $fromDate = $_POST['from_date'] ?? '';
//     $toDate   = $_POST['to_date']   ?? '';
//     $adsets   = json_decode($_POST['adsets'] ?? '[]', true);

//     if (empty($adsets) || empty($fromDate) || empty($toDate)) {
//         jsonOut(['success' => false, 'message' => 'Missing params']);
//     }

//     try {
//         $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
//         $stmt->execute([$fromDate . ' 00:00:00', $toDate . ' 23:59:59']);
//         $allUserIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

//         if (empty($allUserIds)) {
//             jsonOut(['success' => true, 'data' => []]);
//         }

//         $ph      = implode(',', array_fill(0, count($allUserIds), '?'));
//         $adsetPh = implode(',', array_fill(0, count($adsets), '?'));

//         // Registrations per adset
//         $stmt = $pdo->prepare("
//             SELECT COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown') as adset_name,
//                   COUNT(DISTINCT uc.user_id) as registrations
//             FROM user_campaign uc
//             WHERE uc.user_id IN ($ph)
//               AND TRIM(uc.adset) IN ($adsetPh)
//             GROUP BY COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown')
//         ");
//         $stmt->execute(array_merge($allUserIds, $adsets));
//         $regMap = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $regMap[$r['adset_name']] = (int)$r['registrations'];
//         }

//         // Exams per adset
//         $stmt = $pdo->prepare("
//             SELECT COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown') as adset_name,
//                   COUNT(DISTINCT cr.user_id) as exam_count
//             FROM cit_results cr
//             JOIN user_campaign uc ON uc.user_id = cr.user_id
//             WHERE cr.user_id IN ($ph)
//               AND TRIM(uc.adset) IN ($adsetPh)
//             GROUP BY COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown')
//         ");
//         $stmt->execute(array_merge($allUserIds, $adsets));
//         $examMap = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $examMap[$r['adset_name']] = (int)$r['exam_count'];
//         }

//         // Internships + Revenue per adset
//         $stmt = $pdo->prepare("
//             SELECT COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown') as adset_name,
//                   COUNT(DISTINCT ps.user_id) as internship_count,
//                   COALESCE(SUM(ps.amount), 0) as revenue
//             FROM payment_status ps
//             JOIN user_campaign uc ON uc.user_id = ps.user_id
//             WHERE ps.status = 'success'
//               AND ps.user_id IN ($ph)
//               AND TRIM(uc.adset) IN ($adsetPh)
//             GROUP BY COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown')
//         ");
//         $stmt->execute(array_merge($allUserIds, $adsets));
//         $internMap  = [];
//         $revenueMap = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $internMap[$r['adset_name']]  = (int)$r['internship_count'];
//             $revenueMap[$r['adset_name']] = (float)$r['revenue'];
//         }

//         // 2nd internship per adset
//         $stmt = $pdo->prepare("
//             SELECT COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown') as adset_name,
//                   COUNT(DISTINCT sub.user_id) as second_internship
//             FROM (
//                 SELECT user_id FROM payment_status
//                 WHERE status = 'success' AND user_id IN ($ph)
//                 GROUP BY user_id HAVING COUNT(*) >= 2
//             ) sub
//             JOIN user_campaign uc ON uc.user_id = sub.user_id
//             WHERE TRIM(uc.adset) IN ($adsetPh)
//             GROUP BY COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown')
//         ");
//         $stmt->execute(array_merge($allUserIds, $adsets));
//         $secondMap = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $secondMap[$r['adset_name']] = (int)$r['second_internship'];
//         }

//         $result = [];
//         foreach ($adsets as $adset) {
//             $result[$adset] = [
//                 'registrations'     => $regMap[$adset]     ?? 0,
//                 'exam_count'        => $examMap[$adset]    ?? 0,
//                 'internship_count'  => $internMap[$adset]  ?? 0,
//                 'second_internship' => $secondMap[$adset]  ?? 0,
//                 'revenue'           => $revenueMap[$adset] ?? 0,
//             ];
//         }

//         jsonOut(['success' => true, 'data' => $result]);
//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ==========================================================================
//   ACTION: fetch_analytics_phase1
//   Fast phase - Meta insights + DB aggregation. Delivery/event filled later.
//   ========================================================================== */
// if ($action === 'fetch_analytics_phase1') {

//     $ACCESS_TOKEN = getMetaToken($pdo);
//     $GLOBALS['ACCESS_TOKEN'] = $ACCESS_TOKEN;

//     if (!$ACCESS_TOKEN) {
//         jsonOut(['success' => false, 'token_expired' => true, 'message' => 'Meta Access Token Missing']);
//     }

//     $citVersion      = $_POST['cit_version']       ?? '';
//     $fromDate        = $_POST['from_date']         ?? '';
//     $toDate          = $_POST['to_date']           ?? '';
//     $perPage         = intval($_POST['per_page']   ?? 100);
//     $compareFromDate = $_POST['compare_from_date'] ?? '';
//     $compareToDate   = $_POST['compare_to_date']   ?? '';
//     $isComparison    = !empty($compareFromDate) && !empty($compareToDate);

//     try {
//         $fields = [
//             'ad_id','campaign_id','campaign_name','adset_name','ad_name',
//             'spend','impressions','clicks','reach','ctr','cpc','frequency',
//         ];

//         // Current period insights
//         $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
//               '/insights?level=ad' .
//               '&fields=' . implode(',', $fields) .
//               '&time_range={"since":"' . $fromDate . '","until":"' . $toDate . '"}' .
//               '&limit=' . $perPage .
//               '&access_token=' . $ACCESS_TOKEN;

//         $ch = curl_init();
//         curl_setopt($ch, CURLOPT_URL, $url);
//         curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//         curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
//         $response = curl_exec($ch);
//         if (curl_errno($ch)) throw new Exception('Meta API Error: ' . curl_error($ch));
//         curl_close($ch);

//         $metaData = json_decode($response, true);

//         if (isset($metaData['error'])) {
//             $errMsg = $metaData['error']['message'] ?? 'Unknown Meta Error';
//             if (isTokenExpiredError($errMsg)) {
//                 jsonOut(['success' => false, 'token_expired' => true, 'message' => 'Meta Access Token Expired']);
//             }
//             throw new Exception('Meta API Error: ' . $errMsg);
//         }

//         $allMetaRaw = $metaData['data'] ?? [];

//         // Comparison period insights (optional)
//         $allMetaRawCompare = [];
//         if ($isComparison) {
//             $urlCompare = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
//                 '/insights?level=ad' .
//                 '&fields=' . implode(',', $fields) .
//                 '&time_range={"since":"' . $compareFromDate . '","until":"' . $compareToDate . '"}' .
//                 '&limit=' . $perPage .
//                 '&access_token=' . $ACCESS_TOKEN;

//             $ch = curl_init();
//             curl_setopt($ch, CURLOPT_URL, $urlCompare);
//             curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//             curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
//             $responseCompare = curl_exec($ch);
//             curl_close($ch);
//             $metaDataCompare   = json_decode($responseCompare, true);
//             $allMetaRawCompare = $metaDataCompare['data'] ?? [];
//         }

//         // Aggregate current period by campaign
//         $campaignGroups = [];
//         foreach ($allMetaRaw as $row) {
//             $campaign = trim($row['campaign_name'] ?? '');
//             if ($campaign === '') continue;
//             if (!isset($campaignGroups[$campaign])) {
//                 $campaignGroups[$campaign] = [
//                     'campaign_id' => $row['campaign_id'] ?? '',
//                     'spend' => 0, 'impressions' => 0,
//                     'clicks' => 0, 'reach' => 0,
//                     'date_start' => $row['date_start'] ?? '',
//                     'date_stop'  => $row['date_stop']  ?? '',
//                 ];
//             }
//             $campaignGroups[$campaign]['spend']       += (float)($row['spend']       ?? 0);
//             $campaignGroups[$campaign]['impressions'] += (int)  ($row['impressions'] ?? 0);
//             $campaignGroups[$campaign]['clicks']      += (int)  ($row['clicks']      ?? 0);
//             $campaignGroups[$campaign]['reach']       += (int)  ($row['reach']       ?? 0);
//         }

//         // Aggregate comparison period by campaign
//         $campaignGroupsCompare = [];
//         if ($isComparison) {
//             foreach ($allMetaRawCompare as $row) {
//                 $campaign = trim($row['campaign_name'] ?? '');
//                 if ($campaign === '') continue;
//                 if (!isset($campaignGroupsCompare[$campaign])) {
//                     $campaignGroupsCompare[$campaign] = ['spend'=>0,'impressions'=>0,'clicks'=>0,'reach'=>0];
//                 }
//                 $campaignGroupsCompare[$campaign]['spend']       += (float)($row['spend']       ?? 0);
//                 $campaignGroupsCompare[$campaign]['impressions'] += (int)  ($row['impressions'] ?? 0);
//                 $campaignGroupsCompare[$campaign]['clicks']      += (int)  ($row['clicks']      ?? 0);
//                 $campaignGroupsCompare[$campaign]['reach']       += (int)  ($row['reach']       ?? 0);
//             }
//         }

//         // DB: user_ids registered in current period
//         $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
//         $stmt->execute([$fromDate . ' 00:00:00', $toDate . ' 23:59:59']);
//         $allUserIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

//         // DB: user_ids registered in comparison period
//         $allUserIdsCompare = [];
//         if ($isComparison) {
//             $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
//             $stmt->execute([$compareFromDate . ' 00:00:00', $compareToDate . ' 23:59:59']);
//             $allUserIdsCompare = $stmt->fetchAll(PDO::FETCH_COLUMN);
//         }

//         if (empty($allUserIds)) {
//             jsonOut([
//                 'success'       => true,
//                 'data'          => [],
//                 'meta_raw'      => [],
//                 'is_comparison' => $isComparison,
//             ]);
//         }

//         $ph = implode(',', array_fill(0, count($allUserIds), '?'));

//         // Registrations per campaign (current)
//         $stmt = $pdo->prepare("
//             SELECT user_id, COALESCE(NULLIF(TRIM(campaign),''),'Direct/Unknown') as campaign
//             FROM user_campaign WHERE user_id IN ($ph)
//         ");
//         $stmt->execute($allUserIds);
//         $registrationsMap = [];
//         $userIdsMap       = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $userIdsMap[$r['campaign']][] = $r['user_id'];
//             $registrationsMap[$r['campaign']] = count(array_unique($userIdsMap[$r['campaign']]));
//         }

//         // Exams per campaign (current)
//         $stmt = $pdo->prepare("
//             SELECT DISTINCT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign, cr.user_id
//             FROM cit_results cr
//             LEFT JOIN user_campaign uc ON uc.user_id=cr.user_id
//             WHERE cr.user_id IN ($ph)
//         ");
//         $stmt->execute($allUserIds);
//         $examMap        = [];
//         $examUserIdsMap = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $examUserIdsMap[$r['campaign']][] = $r['user_id'];
//             $examMap[$r['campaign']] = count(array_unique($examUserIdsMap[$r['campaign']]));
//         }

//         // Payments per campaign (current)
//         $stmt = $pdo->prepare("
//             SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
//                   COUNT(DISTINCT ps.user_id) AS internships,
//                   COALESCE(SUM(ps.amount),0) AS revenue
//             FROM payment_status ps
//             LEFT JOIN user_campaign uc ON uc.user_id=ps.user_id
//             WHERE ps.status='success' AND ps.user_id IN ($ph)
//             GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
//         ");
//         $stmt->execute($allUserIds);
//         $internshipMap = [];
//         $revenueMap    = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $internshipMap[$r['campaign']] = (int)$r['internships'];
//             $revenueMap[$r['campaign']]    = (float)$r['revenue'];
//         }

//         // 2nd internship per campaign (current)
//         $stmt = $pdo->prepare("
//             SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
//                   COUNT(DISTINCT sub.user_id) AS second_internships
//             FROM (
//                 SELECT user_id FROM payment_status
//                 WHERE status='success' AND user_id IN ($ph)
//                 GROUP BY user_id HAVING COUNT(*)>=2
//             ) sub
//             LEFT JOIN user_campaign uc ON uc.user_id=sub.user_id
//             GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
//         ");
//         $stmt->execute($allUserIds);
//         $secondInternshipMap = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $secondInternshipMap[$r['campaign']] = (int)$r['second_internships'];
//         }

//         // Comparison period DB queries
//         $registrationsMapCompare   = [];
//         $examMapCompare            = [];
//         $internshipMapCompare      = [];
//         $revenueMapCompare         = [];
//         $secondInternshipMapCompare = [];

//         if ($isComparison && !empty($allUserIdsCompare)) {
//             $phC = implode(',', array_fill(0, count($allUserIdsCompare), '?'));

//             $stmt = $pdo->prepare("
//                 SELECT user_id, COALESCE(NULLIF(TRIM(campaign),''),'Direct/Unknown') as campaign
//                 FROM user_campaign WHERE user_id IN ($phC)
//             ");
//             $stmt->execute($allUserIdsCompare);
//             $uMapC = [];
//             foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//                 $uMapC[$r['campaign']][] = $r['user_id'];
//                 $registrationsMapCompare[$r['campaign']] = count(array_unique($uMapC[$r['campaign']]));
//             }

//             $stmt = $pdo->prepare("
//                 SELECT DISTINCT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign, cr.user_id
//                 FROM cit_results cr
//                 LEFT JOIN user_campaign uc ON uc.user_id=cr.user_id
//                 WHERE cr.user_id IN ($phC)
//             ");
//             $stmt->execute($allUserIdsCompare);
//             $eMapC = [];
//             foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//                 $eMapC[$r['campaign']][] = $r['user_id'];
//                 $examMapCompare[$r['campaign']] = count(array_unique($eMapC[$r['campaign']]));
//             }

//             $stmt = $pdo->prepare("
//                 SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
//                       COUNT(DISTINCT ps.user_id) AS internships,
//                       COALESCE(SUM(ps.amount),0) AS revenue
//                 FROM payment_status ps
//                 LEFT JOIN user_campaign uc ON uc.user_id=ps.user_id
//                 WHERE ps.status='success' AND ps.user_id IN ($phC)
//                 GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
//             ");
//             $stmt->execute($allUserIdsCompare);
//             foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//                 $internshipMapCompare[$r['campaign']] = (int)$r['internships'];
//                 $revenueMapCompare[$r['campaign']]    = (float)$r['revenue'];
//             }

//             $stmt = $pdo->prepare("
//                 SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
//                       COUNT(DISTINCT sub.user_id) AS second_internships
//                 FROM (
//                     SELECT user_id FROM payment_status
//                     WHERE status='success' AND user_id IN ($phC)
//                     GROUP BY user_id HAVING COUNT(*)>=2
//                 ) sub
//                 LEFT JOIN user_campaign uc ON uc.user_id=sub.user_id
//                 GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
//             ");
//             $stmt->execute($allUserIdsCompare);
//             foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//                 $secondInternshipMapCompare[$r['campaign']] = (int)$r['second_internships'];
//             }
//         }

//         // Build processed rows - delivery_status and conversion_event = 'LOADING'
//         // (phase2 will replace these with real values)
//         $processedData = [];
//         foreach ($campaignGroups as $campaign => $data) {
//             $spend            = $data['spend'];
//             $registrations    = $registrationsMap[$campaign]     ?? 0;
//             $examCount        = $examMap[$campaign]              ?? 0;
//             $internshipCount  = $internshipMap[$campaign]        ?? 0;
//             $revenue          = $revenueMap[$campaign]           ?? 0;
//             $secondInternship = $secondInternshipMap[$campaign]  ?? 0;

//             $costPerReg        = $registrations  > 0 ? $spend / $registrations  : 0;
//             $costPerExam       = $examCount      > 0 ? $spend / $examCount      : 0;
//             $costPerInternship = $internshipCount> 0 ? $spend / $internshipCount: 0;
//             $roi               = $spend > 0 ? ($revenue / $spend) : 0;
//             $rpu               = $registrations > 0 ? $revenue / $registrations : 0;

//             $userIds = isset($userIdsMap[$campaign])
//                 ? implode(',', array_unique($userIdsMap[$campaign])) : '';

//             $rowData = [
//                 'campaign_name'         => $campaign,
//                 'campaign_id'           => $data['campaign_id'],
//                 'delivery_status'       => 'LOADING',
//                 'conversion_event'      => 'LOADING',
//                 'user_ids'              => $userIds,
//                 'date_start'            => $data['date_start'],
//                 'date_stop'             => $data['date_stop'],
//                 'spend'                 => $spend,
//                 'impressions'           => $data['impressions'],
//                 'clicks'                => $data['clicks'],
//                 'reach'                 => $data['reach'],
//                 'registrations'         => $registrations,
//                 'cost_per_registration' => round($costPerReg, 2),
//                 'exam_count'            => $examCount,
//                 'cost_per_exam'         => round($costPerExam, 2),
//                 'internship_count'      => $internshipCount,
//                 'second_internship'     => $secondInternship,
//                 'cost_per_internship'   => round($costPerInternship, 2),
//                 'revenue'               => round($revenue, 2),
//                 'roi'                   => round($roi, 2),
//                 'has_meta_data'         => true,
//                 'rpu'                   => round($rpu, 2),
//                 'cac_all'               => round($costPerReg, 2),
//                 'cac_paid'              => round($costPerInternship, 2),
//                 'roas'                  => round($roi, 2),
//             ];

//             if ($isComparison) {
//                 $cData   = $campaignGroupsCompare[$campaign] ?? null;
//                 $cSpend  = $cData ? $cData['spend'] : 0;
//                 $cReg    = $registrationsMapCompare[$campaign]   ?? 0;
//                 $cExam   = $examMapCompare[$campaign]             ?? 0;
//                 $cIntern = $internshipMapCompare[$campaign]       ?? 0;
//                 $cRev    = $revenueMapCompare[$campaign]          ?? 0;
//                 $cSecond = $secondInternshipMapCompare[$campaign] ?? 0;

//                 $rowData['compare_spend']                 = $cSpend;
//                 $rowData['compare_impressions']           = $cData ? $cData['impressions'] : 0;
//                 $rowData['compare_clicks']                = $cData ? $cData['clicks']      : 0;
//                 $rowData['compare_reach']                 = $cData ? $cData['reach']       : 0;
//                 $rowData['compare_registrations']         = $cReg;
//                 $rowData['compare_cost_per_registration'] = $cReg    > 0 ? round($cSpend/$cReg,2)    : 0;
//                 $rowData['compare_exam_count']            = $cExam;
//                 $rowData['compare_cost_per_exam']         = $cExam   > 0 ? round($cSpend/$cExam,2)   : 0;
//                 $rowData['compare_internship_count']      = $cIntern;
//                 $rowData['compare_second_internship']     = $cSecond;
//                 $rowData['compare_cost_per_internship']   = $cIntern > 0 ? round($cSpend/$cIntern,2) : 0;
//                 $rowData['compare_revenue']               = round($cRev, 2);
//                 $rowData['compare_roi']                   = $cSpend  > 0 ? round($cRev/$cSpend,2)    : 0;
//                 $rowData['compare_rpu']                   = $cReg    > 0 ? round($cRev/$cReg,2)      : 0;
//                 $rowData['compare_cac_all']               = $cReg    > 0 ? round($cSpend/$cReg,2)    : 0;
//                 $rowData['compare_cac_paid']              = $cIntern > 0 ? round($cSpend/$cIntern,2) : 0;
//                 $rowData['compare_roas']                  = $cSpend  > 0 ? round($cRev/$cSpend,2)    : 0;
//             }

//             $processedData[] = $rowData;
//         }

//         // Campaigns with NO Meta spend but with DB registrations
//         foreach ($registrationsMap as $campaign => $regCount) {
//             if (isset($campaignGroups[$campaign])) continue;

//             $examCount        = $examMap[$campaign]             ?? 0;
//             $internshipCount  = $internshipMap[$campaign]       ?? 0;
//             $revenue          = $revenueMap[$campaign]          ?? 0;
//             $secondInternship = $secondInternshipMap[$campaign] ?? 0;
//             $userIds = isset($userIdsMap[$campaign])
//                 ? implode(',', array_unique($userIdsMap[$campaign])) : '';

//             $processedData[] = [
//                 'campaign_name'         => $campaign,
//                 'campaign_id'           => '',
//                 'delivery_status'       => 'UNKNOWN',
//                 'conversion_event'      => 'UNKNOWN',
//                 'user_ids'              => $userIds,
//                 'date_start'            => $fromDate,
//                 'date_stop'             => $toDate,
//                 'spend'                 => 0,
//                 'impressions'           => 0,
//                 'clicks'                => 0,
//                 'reach'                 => 0,
//                 'registrations'         => $regCount,
//                 'cost_per_registration' => 0,
//                 'exam_count'            => $examCount,
//                 'cost_per_exam'         => 0,
//                 'internship_count'      => $internshipCount,
//                 'second_internship'     => $secondInternship,
//                 'cost_per_internship'   => 0,
//                 'revenue'               => round($revenue, 2),
//                 'roi'                   => 0,
//                 'has_meta_data'         => false,
//                 'rpu'                   => 0,
//                 'cac_all'               => 0,
//                 'cac_paid'              => 0,
//                 'roas'                  => 0,
//             ];
//         }

//         // Direct/Unknown first
//         usort($processedData, function($a, $b) {
//             if ($a['campaign_name'] === 'Direct/Unknown') return -1;
//             if ($b['campaign_name'] === 'Direct/Unknown') return 1;
//             return 0;
//         });

//         jsonOut([
//             'success'       => true,
//             'data'          => $processedData,
//             'meta_raw'      => $allMetaRaw,
//             'is_comparison' => $isComparison,
//         ]);

//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ==========================================================================
//   ACTION: fetch_analytics_phase2
//   Background - pulls ads + adsets from Meta and builds status/event maps.
//   ========================================================================== */
// if ($action === 'fetch_analytics_phase2') {

//     $ACCESS_TOKEN = getMetaToken($pdo);
//     $GLOBALS['ACCESS_TOKEN'] = $ACCESS_TOKEN;

//     if (!$ACCESS_TOKEN) {
//         jsonOut(['success' => false, 'token_expired' => true]);
//     }

//     try {
//         $fromDate = $_POST['from_date'] ?? '';
//         $toDate   = $_POST['to_date']   ?? '';

//         // Slow calls - fetched here, after initial render
//         $adsFromMeta    = fetchAdsFromMeta();
//         $adsetsFromMeta = fetchAdsetsFromMeta();

//         // Minimal insights just to map ad_id -> campaign_name
//         $fields = ['ad_id','campaign_id','campaign_name','adset_name','ad_name'];
//         $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
//               '/insights?level=ad' .
//               '&fields=' . implode(',', $fields) .
//               '&time_range={"since":"' . $fromDate . '","until":"' . $toDate . '"}' .
//               '&limit=500' .
//               '&access_token=' . $ACCESS_TOKEN;

//         $ch = curl_init();
//         curl_setopt($ch, CURLOPT_URL, $url);
//         curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//         curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
//         $response = curl_exec($ch);
//         curl_close($ch);

//         $metaData    = json_decode($response, true);
//         $insightsRaw = $metaData['data'] ?? [];

//         $cStatusMap = buildCampaignStatusMap($adsFromMeta, $insightsRaw);
//         $cEventMap  = buildCampaignEventMap($adsetsFromMeta);

//         jsonOut([
//             'success'             => true,
//             'campaign_status_map' => $cStatusMap,
//             'campaign_event_map'  => $cEventMap,
//             'meta_raw'            => $insightsRaw,
//             'ads_data'            => $adsFromMeta,
//             'adsets_data'         => $adsetsFromMeta,
//         ]);

//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ==========================================================================
//   ACTION: fetch_analytics (LEGACY, single-phase)
//   Kept for backward compatibility. Does everything at once (slower).
//   ========================================================================== */
// if ($action === 'fetch_analytics') {

//     $ACCESS_TOKEN = getMetaToken($pdo);
//     $GLOBALS['ACCESS_TOKEN'] = $ACCESS_TOKEN;

//     if (!$ACCESS_TOKEN) {
//         jsonOut(['success' => false, 'token_expired' => true, 'message' => 'Meta Access Token Missing']);
//     }

//     $citVersion      = $_POST['cit_version']       ?? '';
//     $fromDate        = $_POST['from_date']         ?? '';
//     $toDate          = $_POST['to_date']           ?? '';
//     $perPage         = intval($_POST['per_page']   ?? 100);
//     $compareFromDate = $_POST['compare_from_date'] ?? '';
//     $compareToDate   = $_POST['compare_to_date']   ?? '';
//     $isComparison    = !empty($compareFromDate) && !empty($compareToDate);

//     try {
//         $fields = [
//             'ad_id','campaign_id','campaign_name','adset_name','ad_name',
//             'spend','impressions','clicks','reach','ctr','cpc','frequency',
//         ];

//         $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
//               '/insights?level=ad' .
//               '&fields=' . implode(',', $fields) .
//               '&time_range={"since":"' . $fromDate . '","until":"' . $toDate . '"}' .
//               '&limit=' . $perPage .
//               '&access_token=' . $ACCESS_TOKEN;

//         $ch = curl_init();
//         curl_setopt($ch, CURLOPT_URL, $url);
//         curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//         curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
//         $response = curl_exec($ch);
//         if (curl_errno($ch)) throw new Exception('Meta API Error: ' . curl_error($ch));
//         curl_close($ch);

//         $metaData = json_decode($response, true);
//         if (isset($metaData['error'])) {
//             $errMsg = $metaData['error']['message'] ?? 'Unknown Meta Error';
//             if (isTokenExpiredError($errMsg)) {
//                 jsonOut(['success' => false, 'token_expired' => true, 'message' => 'Meta Access Token Expired']);
//             }
//             throw new Exception('Meta API Error: ' . $errMsg);
//         }

//         $allMetaRaw = $metaData['data'] ?? [];

//         // Comparison insights
//         $allMetaRawCompare = [];
//         if ($isComparison) {
//             $urlCompare = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
//                 '/insights?level=ad' .
//                 '&fields=' . implode(',', $fields) .
//                 '&time_range={"since":"' . $compareFromDate . '","until":"' . $compareToDate . '"}' .
//                 '&limit=' . $perPage .
//                 '&access_token=' . $ACCESS_TOKEN;

//             $ch = curl_init();
//             curl_setopt($ch, CURLOPT_URL, $urlCompare);
//             curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//             curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
//             $responseCompare = curl_exec($ch);
//             curl_close($ch);

//             $metaDataCompare   = json_decode($responseCompare, true);
//             $allMetaRawCompare = $metaDataCompare['data'] ?? [];
//         }

//         // Status + event maps
//         $adsFromMeta       = fetchAdsFromMeta();
//         $adsetsFromMeta    = fetchAdsetsFromMeta();
//         $campaignStatusMap = buildCampaignStatusMap($adsFromMeta, $allMetaRaw);
//         $campaignEventMap  = buildCampaignEventMap($adsetsFromMeta);

//         // Aggregate campaigns (same logic as phase1) - inlined for parity
//         $campaignGroups = [];
//         foreach ($allMetaRaw as $row) {
//             $campaign = trim($row['campaign_name'] ?? '');
//             if ($campaign === '') continue;
//             if (!isset($campaignGroups[$campaign])) {
//                 $campaignGroups[$campaign] = [
//                     'campaign_id' => $row['campaign_id'] ?? '',
//                     'spend' => 0, 'impressions' => 0,
//                     'clicks' => 0, 'reach' => 0,
//                     'date_start' => $row['date_start'] ?? '',
//                     'date_stop'  => $row['date_stop']  ?? '',
//                 ];
//             }
//             $campaignGroups[$campaign]['spend']       += (float)($row['spend']       ?? 0);
//             $campaignGroups[$campaign]['impressions'] += (int)  ($row['impressions'] ?? 0);
//             $campaignGroups[$campaign]['clicks']      += (int)  ($row['clicks']      ?? 0);
//             $campaignGroups[$campaign]['reach']       += (int)  ($row['reach']       ?? 0);
//         }

//         $campaignGroupsCompare = [];
//         if ($isComparison) {
//             foreach ($allMetaRawCompare as $row) {
//                 $campaign = trim($row['campaign_name'] ?? '');
//                 if ($campaign === '') continue;
//                 if (!isset($campaignGroupsCompare[$campaign])) {
//                     $campaignGroupsCompare[$campaign] = ['spend'=>0,'impressions'=>0,'clicks'=>0,'reach'=>0];
//                 }
//                 $campaignGroupsCompare[$campaign]['spend']       += (float)($row['spend']       ?? 0);
//                 $campaignGroupsCompare[$campaign]['impressions'] += (int)  ($row['impressions'] ?? 0);
//                 $campaignGroupsCompare[$campaign]['clicks']      += (int)  ($row['clicks']      ?? 0);
//                 $campaignGroupsCompare[$campaign]['reach']       += (int)  ($row['reach']       ?? 0);
//             }
//         }

//         // Users registered in range
//         $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
//         $stmt->execute([$fromDate . ' 00:00:00', $toDate . ' 23:59:59']);
//         $allUserIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

//         $allUserIdsCompare = [];
//         if ($isComparison) {
//             $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
//             $stmt->execute([$compareFromDate . ' 00:00:00', $compareToDate . ' 23:59:59']);
//             $allUserIdsCompare = $stmt->fetchAll(PDO::FETCH_COLUMN);
//         }

//         if (empty($allUserIds)) {
//             jsonOut(['success' => true, 'data' => [], 'meta_raw' => []]);
//         }

//         $ph = implode(',', array_fill(0, count($allUserIds), '?'));

//         // Registrations (current)
//         $stmt = $pdo->prepare("
//             SELECT user_id, COALESCE(NULLIF(TRIM(campaign),''),'Direct/Unknown') as campaign
//             FROM user_campaign WHERE user_id IN ($ph)
//         ");
//         $stmt->execute($allUserIds);
//         $registrationsMap = [];
//         $userIdsMap       = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $userIdsMap[$r['campaign']][] = $r['user_id'];
//             $registrationsMap[$r['campaign']] = count(array_unique($userIdsMap[$r['campaign']]));
//         }

//         // Exams (current)
//         $stmt = $pdo->prepare("
//             SELECT DISTINCT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign, cr.user_id
//             FROM cit_results cr
//             LEFT JOIN user_campaign uc ON uc.user_id=cr.user_id
//             WHERE cr.user_id IN ($ph)
//         ");
//         $stmt->execute($allUserIds);
//         $examMap        = [];
//         $examUserIdsMap = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $examUserIdsMap[$r['campaign']][] = $r['user_id'];
//             $examMap[$r['campaign']] = count(array_unique($examUserIdsMap[$r['campaign']]));
//         }

//         // Payments + revenue (current)
//         $stmt = $pdo->prepare("
//             SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
//                   COUNT(DISTINCT ps.user_id) AS internships,
//                   COALESCE(SUM(ps.amount),0) AS revenue
//             FROM payment_status ps
//             LEFT JOIN user_campaign uc ON uc.user_id=ps.user_id
//             WHERE ps.status='success' AND ps.user_id IN ($ph)
//             GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
//         ");
//         $stmt->execute($allUserIds);
//         $internshipMap = [];
//         $revenueMap    = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $internshipMap[$r['campaign']] = (int)$r['internships'];
//             $revenueMap[$r['campaign']]    = (float)$r['revenue'];
//         }

//         // 2nd internship (current)
//         $stmt = $pdo->prepare("
//             SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
//                   COUNT(DISTINCT sub.user_id) AS second_internships
//             FROM (
//                 SELECT user_id FROM payment_status
//                 WHERE status='success' AND user_id IN ($ph)
//                 GROUP BY user_id HAVING COUNT(*)>=2
//             ) sub
//             LEFT JOIN user_campaign uc ON uc.user_id=sub.user_id
//             GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
//         ");
//         $stmt->execute($allUserIds);
//         $secondInternshipMap = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $secondInternshipMap[$r['campaign']] = (int)$r['second_internships'];
//         }

//         // Comparison DB queries
//         $registrationsMapCompare    = [];
//         $examMapCompare             = [];
//         $internshipMapCompare       = [];
//         $revenueMapCompare          = [];
//         $secondInternshipMapCompare = [];
//         if ($isComparison && !empty($allUserIdsCompare)) {
//             $phC = implode(',', array_fill(0, count($allUserIdsCompare), '?'));

//             $stmt = $pdo->prepare("
//                 SELECT user_id, COALESCE(NULLIF(TRIM(campaign),''),'Direct/Unknown') as campaign
//                 FROM user_campaign WHERE user_id IN ($phC)
//             ");
//             $stmt->execute($allUserIdsCompare);
//             $uMapC = [];
//             foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//                 $uMapC[$r['campaign']][] = $r['user_id'];
//                 $registrationsMapCompare[$r['campaign']] = count(array_unique($uMapC[$r['campaign']]));
//             }

//             $stmt = $pdo->prepare("
//                 SELECT DISTINCT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign, cr.user_id
//                 FROM cit_results cr
//                 LEFT JOIN user_campaign uc ON uc.user_id=cr.user_id
//                 WHERE cr.user_id IN ($phC)
//             ");
//             $stmt->execute($allUserIdsCompare);
//             $eMapC = [];
//             foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//                 $eMapC[$r['campaign']][] = $r['user_id'];
//                 $examMapCompare[$r['campaign']] = count(array_unique($eMapC[$r['campaign']]));
//             }

//             $stmt = $pdo->prepare("
//                 SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
//                       COUNT(DISTINCT ps.user_id) AS internships,
//                       COALESCE(SUM(ps.amount),0) AS revenue
//                 FROM payment_status ps
//                 LEFT JOIN user_campaign uc ON uc.user_id=ps.user_id
//                 WHERE ps.status='success' AND ps.user_id IN ($phC)
//                 GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
//             ");
//             $stmt->execute($allUserIdsCompare);
//             foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//                 $internshipMapCompare[$r['campaign']] = (int)$r['internships'];
//                 $revenueMapCompare[$r['campaign']]    = (float)$r['revenue'];
//             }

//             $stmt = $pdo->prepare("
//                 SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
//                       COUNT(DISTINCT sub.user_id) AS second_internships
//                 FROM (
//                     SELECT user_id FROM payment_status
//                     WHERE status='success' AND user_id IN ($phC)
//                     GROUP BY user_id HAVING COUNT(*)>=2
//                 ) sub
//                 LEFT JOIN user_campaign uc ON uc.user_id=sub.user_id
//                 GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
//             ");
//             $stmt->execute($allUserIdsCompare);
//             foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//                 $secondInternshipMapCompare[$r['campaign']] = (int)$r['second_internships'];
//             }
//         }

//         // Build processed data WITH real delivery / event
//         $processedData = [];
//         foreach ($campaignGroups as $campaign => $data) {
//             $spend            = $data['spend'];
//             $registrations    = $registrationsMap[$campaign]     ?? 0;
//             $examCount        = $examMap[$campaign]              ?? 0;
//             $internshipCount  = $internshipMap[$campaign]        ?? 0;
//             $revenue          = $revenueMap[$campaign]           ?? 0;
//             $secondInternship = $secondInternshipMap[$campaign]  ?? 0;

//             $costPerReg        = $registrations   > 0 ? $spend / $registrations   : 0;
//             $costPerExam       = $examCount       > 0 ? $spend / $examCount       : 0;
//             $costPerInternship = $internshipCount > 0 ? $spend / $internshipCount : 0;
//             $roi               = $spend > 0 ? ($revenue / $spend) : 0;
//             $rpu               = $registrations > 0 ? $revenue / $registrations : 0;

//             $userIds = isset($userIdsMap[$campaign])
//                 ? implode(',', array_unique($userIdsMap[$campaign])) : '';

//             $rowData = [
//                 'campaign_name'         => $campaign,
//                 'delivery_status'       => $campaignStatusMap[$campaign] ?? 'UNKNOWN',
//                 'conversion_event'      => $campaignEventMap[$data['campaign_id'] ?? ''] ?? 'UNKNOWN',
//                 'user_ids'              => $userIds,
//                 'date_start'            => $data['date_start'],
//                 'date_stop'             => $data['date_stop'],
//                 'spend'                 => $spend,
//                 'impressions'           => $data['impressions'],
//                 'clicks'                => $data['clicks'],
//                 'reach'                 => $data['reach'],
//                 'registrations'         => $registrations,
//                 'cost_per_registration' => round($costPerReg, 2),
//                 'exam_count'            => $examCount,
//                 'cost_per_exam'         => round($costPerExam, 2),
//                 'internship_count'      => $internshipCount,
//                 'second_internship'     => $secondInternship,
//                 'cost_per_internship'   => round($costPerInternship, 2),
//                 'revenue'               => round($revenue, 2),
//                 'roi'                   => round($roi, 2),
//                 'has_meta_data'         => true,
//                 'rpu'                   => round($rpu, 2),
//                 'cac_all'               => round($costPerReg, 2),
//                 'cac_paid'              => round($costPerInternship, 2),
//                 'roas'                  => round($roi, 2),
//             ];

//             if ($isComparison) {
//                 $cData   = $campaignGroupsCompare[$campaign] ?? null;
//                 $cSpend  = $cData ? $cData['spend'] : 0;
//                 $cReg    = $registrationsMapCompare[$campaign]    ?? 0;
//                 $cExam   = $examMapCompare[$campaign]              ?? 0;
//                 $cIntern = $internshipMapCompare[$campaign]        ?? 0;
//                 $cRev    = $revenueMapCompare[$campaign]           ?? 0;
//                 $cSecond = $secondInternshipMapCompare[$campaign]  ?? 0;

//                 $rowData['compare_spend']                 = $cSpend;
//                 $rowData['compare_impressions']           = $cData ? $cData['impressions'] : 0;
//                 $rowData['compare_clicks']                = $cData ? $cData['clicks']      : 0;
//                 $rowData['compare_reach']                 = $cData ? $cData['reach']       : 0;
//                 $rowData['compare_registrations']         = $cReg;
//                 $rowData['compare_cost_per_registration'] = $cReg    > 0 ? round($cSpend/$cReg,2)    : 0;
//                 $rowData['compare_exam_count']            = $cExam;
//                 $rowData['compare_cost_per_exam']         = $cExam   > 0 ? round($cSpend/$cExam,2)   : 0;
//                 $rowData['compare_internship_count']      = $cIntern;
//                 $rowData['compare_second_internship']     = $cSecond;
//                 $rowData['compare_cost_per_internship']   = $cIntern > 0 ? round($cSpend/$cIntern,2) : 0;
//                 $rowData['compare_revenue']               = round($cRev, 2);
//                 $rowData['compare_roi']                   = $cSpend  > 0 ? round($cRev/$cSpend,2)    : 0;
//                 $rowData['compare_rpu']                   = $cReg    > 0 ? round($cRev/$cReg,2)      : 0;
//                 $rowData['compare_cac_all']               = $cReg    > 0 ? round($cSpend/$cReg,2)    : 0;
//                 $rowData['compare_cac_paid']              = $cIntern > 0 ? round($cSpend/$cIntern,2) : 0;
//                 $rowData['compare_roas']                  = $cSpend  > 0 ? round($cRev/$cSpend,2)    : 0;
//             }

//             $processedData[] = $rowData;
//         }

//         // Campaigns without Meta spend
//         foreach ($registrationsMap as $campaign => $regCount) {
//             if (isset($campaignGroups[$campaign])) continue;
//             $examCount        = $examMap[$campaign]             ?? 0;
//             $internshipCount  = $internshipMap[$campaign]       ?? 0;
//             $revenue          = $revenueMap[$campaign]          ?? 0;
//             $secondInternship = $secondInternshipMap[$campaign] ?? 0;
//             $userIds = isset($userIdsMap[$campaign])
//                 ? implode(',', array_unique($userIdsMap[$campaign])) : '';

//             $processedData[] = [
//                 'campaign_name'         => $campaign,
//                 'delivery_status'       => 'UNKNOWN',
//                 'conversion_event'      => 'UNKNOWN',
//                 'user_ids'              => $userIds,
//                 'date_start'            => $fromDate,
//                 'date_stop'             => $toDate,
//                 'spend'                 => 0,
//                 'impressions'           => 0,
//                 'clicks'                => 0,
//                 'reach'                 => 0,
//                 'registrations'         => $regCount,
//                 'cost_per_registration' => 0,
//                 'exam_count'            => $examCount,
//                 'cost_per_exam'         => 0,
//                 'internship_count'      => $internshipCount,
//                 'second_internship'     => $secondInternship,
//                 'cost_per_internship'   => 0,
//                 'revenue'               => round($revenue, 2),
//                 'roi'                   => 0,
//                 'has_meta_data'         => false,
//                 'rpu'                   => 0,
//                 'cac_all'               => 0,
//                 'cac_paid'              => 0,
//                 'roas'                  => 0,
//             ];
//         }

//         usort($processedData, function($a, $b) {
//             if ($a['campaign_name'] === 'Direct/Unknown') return -1;
//             if ($b['campaign_name'] === 'Direct/Unknown') return 1;
//             return 0;
//         });

//         jsonOut([
//             'success'       => true,
//             'data'          => $processedData,
//             'meta_raw'      => $allMetaRaw,
//             'is_comparison' => $isComparison,
//         ]);

//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ==========================================================================
//   VERSION-WISE ANALYSIS HELPERS (per PDF spec)
//   ========================================================================== */

// /**
//  * In-memory request-scoped cache for version metrics (per request lifetime).
//  * Also uses $_SESSION for cross-request cache.
//  */
// function vaCacheKey($versionName, $level, $filters) {
//     return md5($versionName . '|' . $level . '|' . json_encode($filters));
// }
// function vaCacheGet($key) {
//     // request-scoped first
//     if (isset($GLOBALS['__VA_CACHE'][$key])) return $GLOBALS['__VA_CACHE'][$key];
//     // session cache (~5 min TTL)
//     if (isset($_SESSION['__VA_CACHE'][$key])) {
//         $entry = $_SESSION['__VA_CACHE'][$key];
//         if ((time() - $entry['t']) < 300) {
//             $GLOBALS['__VA_CACHE'][$key] = $entry['v'];
//             return $entry['v'];
//         }
//     }
//     return null;
// }
// function vaCacheSet($key, $value) {
//     $GLOBALS['__VA_CACHE'][$key] = $value;
//     if (!isset($_SESSION['__VA_CACHE'])) $_SESSION['__VA_CACHE'] = [];
//     $_SESSION['__VA_CACHE'][$key] = ['t' => time(), 'v' => $value];
//     // cap session cache size
//     if (count($_SESSION['__VA_CACHE']) > 300) {
//         // drop oldest half
//         uasort($_SESSION['__VA_CACHE'], function($a, $b) { return $a['t'] - $b['t']; });
//         $_SESSION['__VA_CACHE'] = array_slice($_SESSION['__VA_CACHE'], -150, null, true);
//     }
// }

// /**
//  * Get the date range for a CIT version from exam_batch_for_reports.
//  * Matches the existing +1 day logic from get_date_range.
//  */
// function getVersionDateRange($pdo, $versionName) {
//     static $cache = [];
//     if (isset($cache[$versionName])) return $cache[$versionName];

//     $stmt = $pdo->prepare("SELECT from_date, to_date FROM exam_batch_for_reports WHERE exam_name = ? LIMIT 1");
//     $stmt->execute([$versionName]);
//     $dates = $stmt->fetch(PDO::FETCH_ASSOC);
//     if (!$dates) { $cache[$versionName] = null; return null; }
//     $r = [
//         'from' => date('Y-m-d', strtotime($dates['from_date'] . ' +1 day')),
//         'to'   => $dates['to_date'],
//     ];
//     $cache[$versionName] = $r;
//     return $r;
// }

// /**
//  * Fetch Meta Ads insights (ad level) for a date range, with pagination.
//  */
// function fetchMetaInsightsForRange($from, $to) {
//     global $ACCESS_TOKEN;
//     static $memo = [];
//     $memoKey = $from . '|' . $to;
//     if (isset($memo[$memoKey])) return $memo[$memoKey];

//     $fields = ['ad_id','campaign_id','campaign_name','adset_name','ad_name',
//               'spend','impressions','clicks','reach'];
//     $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
//           '/insights?level=ad&fields=' . implode(',', $fields) .
//           '&time_range={"since":"' . $from . '","until":"' . $to . '"}' .
//           '&limit=500&access_token=' . $ACCESS_TOKEN;

//     $allRows = [];
//     $safety  = 0;
//     while ($url && $safety < 50) {
//         $ch = curl_init($url);
//         curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//         curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
//         $resp = curl_exec($ch);
//         curl_close($ch);

//         $data = json_decode($resp, true);
//         if (isset($data['error'])) { $memo[$memoKey] = ['error' => $data['error']['message'] ?? 'Meta error']; return $memo[$memoKey]; }

//         $allRows = array_merge($allRows, $data['data'] ?? []);
//         $url     = $data['paging']['next'] ?? null;
//         $safety++;
//     }
//     $memo[$memoKey] = $allRows;
//     return $allRows;
// }

// /**
//  * PARALLEL fetch Meta insights for multiple date ranges at once using curl_multi.
//  * Returns [ "from|to" => rowsArray, ... ]
//  * Falls back gracefully on error (returns empty array for that range).
//  */
// function fetchMetaInsightsParallel($ranges) {
//     global $ACCESS_TOKEN;

//     // Check memoization first
//     $result = [];
//     $todo = [];
//     foreach ($ranges as $r) {
//         $k = $r['from'] . '|' . $r['to'];
//         if (isset($GLOBALS['__VA_INSIGHTS_MEMO'][$k])) {
//             $result[$k] = $GLOBALS['__VA_INSIGHTS_MEMO'][$k];
//         } else {
//             $todo[] = $r;
//         }
//     }
//     if (empty($todo)) return $result;

//     $fields = 'ad_id,campaign_id,campaign_name,adset_name,ad_name,spend,impressions,clicks,reach';
//     $mh = curl_multi_init();
//     $handles = [];

//     foreach ($todo as $r) {
//         $k = $r['from'] . '|' . $r['to'];
//         $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
//               '/insights?level=ad&fields=' . $fields .
//               '&time_range={"since":"' . $r['from'] . '","until":"' . $r['to'] . '"}' .
//               '&limit=500&access_token=' . $ACCESS_TOKEN;

//         $ch = curl_init($url);
//         curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//         curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
//         curl_setopt($ch, CURLOPT_TIMEOUT, 45);
//         curl_multi_add_handle($mh, $ch);
//         $handles[$k] = $ch;
//     }

//     // Execute all in parallel
//     $running = null;
//     do {
//         curl_multi_exec($mh, $running);
//         curl_multi_select($mh);
//     } while ($running > 0);

//     // Collect page 1 results + any paging URLs
//     $pagingUrls = [];
//     foreach ($handles as $k => $ch) {
//         $resp = curl_multi_getcontent($ch);
//         curl_multi_remove_handle($mh, $ch);
//         curl_close($ch);
//         $data = json_decode($resp, true);
//         $rows = ($data && isset($data['data'])) ? $data['data'] : [];
//         $result[$k] = $rows;
//         $next = $data['paging']['next'] ?? null;
//         if ($next) $pagingUrls[$k] = $next;
//     }

//     // Chase paging (also in parallel, one round at a time)
//     $safety = 0;
//     while (!empty($pagingUrls) && $safety < 20) {
//         $handles = [];
//         foreach ($pagingUrls as $k => $url) {
//             $ch = curl_init($url);
//             curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
//             curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
//             curl_setopt($ch, CURLOPT_TIMEOUT, 45);
//             curl_multi_add_handle($mh, $ch);
//             $handles[$k] = $ch;
//         }
//         $running = null;
//         do {
//             curl_multi_exec($mh, $running);
//             curl_multi_select($mh);
//         } while ($running > 0);

//         $newPagingUrls = [];
//         foreach ($handles as $k => $ch) {
//             $resp = curl_multi_getcontent($ch);
//             curl_multi_remove_handle($mh, $ch);
//             curl_close($ch);
//             $data = json_decode($resp, true);
//             if ($data && isset($data['data'])) {
//                 $result[$k] = array_merge($result[$k], $data['data']);
//             }
//             $next = $data['paging']['next'] ?? null;
//             if ($next) $newPagingUrls[$k] = $next;
//         }
//         $pagingUrls = $newPagingUrls;
//         $safety++;
//     }

//     curl_multi_close($mh);

//     // Memoize for the rest of this request
//     foreach ($result as $k => $rows) {
//         $GLOBALS['__VA_INSIGHTS_MEMO'][$k] = $rows;
//     }
//     return $result;
// }

// /**
//  * For a given CIT version and level (campaign/adset/ad), compute all 6 metrics.
//  * Returns a map: { entity_name => metrics_array }
//  *
//  * Metrics (per PDF):
//  *   CPM           = (Spend / Impressions) * 1000
//  *   CPC           = Spend / Clicks
//  *   CTR           = (Clicks / Impressions) * 100
//  *   CPL           = Spend / Registrations
//  *   Cost Per Exam = Spend / Exams
//  *   ROI           = Revenue / Spend
//  */
// function computeVersionMetrics($pdo, $versionName, $level, $filters = []) {
//     // Cache check
//     $ckey = vaCacheKey($versionName, $level, $filters);
//     $cached = vaCacheGet($ckey);
//     if ($cached !== null) return $cached;

//     $range = getVersionDateRange($pdo, $versionName);
//     if (!$range) { vaCacheSet($ckey, []); return []; }

//     $from = $range['from'];
//     $to   = $range['to'];

//     $insights = fetchMetaInsightsForRange($from, $to);
//     if (isset($insights['error'])) { vaCacheSet($ckey, []); return []; }

//     // Filter insights by campaign/adset if specified
//     if (isset($filters['campaign']) && $filters['campaign'] !== '') {
//         $fc = $filters['campaign'];
//         $insights = array_values(array_filter($insights, function($r) use ($fc) {
//             return trim($r['campaign_name'] ?? '') === $fc;
//         }));
//     }
//     if (isset($filters['adset']) && $filters['adset'] !== '') {
//         $fa = $filters['adset'];
//         $insights = array_values(array_filter($insights, function($r) use ($fa) {
//             return trim($r['adset_name'] ?? '') === $fa;
//         }));
//     }

//     // Group by the requested level
//     $groups = [];
//     foreach ($insights as $r) {
//         $key = '';
//         if ($level === 'campaign') $key = trim($r['campaign_name'] ?? '');
//         elseif ($level === 'adset') $key = trim($r['adset_name'] ?? '');
//         elseif ($level === 'ad')    $key = trim($r['ad_name'] ?? '');
//         if ($key === '') continue;

//         if (!isset($groups[$key])) {
//             $groups[$key] = [
//                 'campaign_name' => $r['campaign_name'] ?? '',
//                 'campaign_id'   => $r['campaign_id']   ?? '',
//                 'adset_name'    => $r['adset_name']    ?? '',
//                 'ad_name'       => $r['ad_name']       ?? '',
//                 'spend'         => 0,
//                 'impressions'   => 0,
//                 'clicks'        => 0,
//                 'reach'         => 0,
//             ];
//         }
//         $groups[$key]['spend']       += (float)($r['spend']       ?? 0);
//         $groups[$key]['impressions'] += (int)  ($r['impressions'] ?? 0);
//         $groups[$key]['clicks']      += (int)  ($r['clicks']      ?? 0);
//         $groups[$key]['reach']       += (int)  ($r['reach']       ?? 0);
//     }

//     // Pull DB registrations / exams / revenue for users registered in this version's date range
//     // Memoize the user-id list (per version) so multiple level calls share it
//     static $userCache = [];
//     $ucKey = $from . '|' . $to;
//     if (!isset($userCache[$ucKey])) {
//         $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
//         $stmt->execute([$from . ' 00:00:00', $to . ' 23:59:59']);
//         $userCache[$ucKey] = $stmt->fetchAll(PDO::FETCH_COLUMN);
//     }
//     $userIds = $userCache[$ucKey];

//     $regMap = [];
//     $examMap = [];
//     $revenueMap = [];

//     if (!empty($userIds)) {
//         $ph = implode(',', array_fill(0, count($userIds), '?'));

//         $groupField = $level === 'campaign' ? 'uc.campaign'
//                     : ($level === 'adset'    ? 'uc.adset'
//                                              : 'uc.ad');

//         // Registrations
//         $sql = "SELECT COALESCE(NULLIF(TRIM($groupField),''),'Direct/Unknown') as name,
//                       COUNT(DISTINCT uc.user_id) as c
//                 FROM user_campaign uc
//                 WHERE uc.user_id IN ($ph)
//                 GROUP BY COALESCE(NULLIF(TRIM($groupField),''),'Direct/Unknown')";
//         $stmt = $pdo->prepare($sql);
//         $stmt->execute($userIds);
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $regMap[$r['name']] = (int)$r['c'];
//         }

//         // Exams
//         $sql = "SELECT COALESCE(NULLIF(TRIM($groupField),''),'Direct/Unknown') as name,
//                       COUNT(DISTINCT cr.user_id) as c
//                 FROM cit_results cr
//                 LEFT JOIN user_campaign uc ON uc.user_id = cr.user_id
//                 WHERE cr.user_id IN ($ph)
//                 GROUP BY COALESCE(NULLIF(TRIM($groupField),''),'Direct/Unknown')";
//         $stmt = $pdo->prepare($sql);
//         $stmt->execute($userIds);
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $examMap[$r['name']] = (int)$r['c'];
//         }

//         // Revenue
//         $sql = "SELECT COALESCE(NULLIF(TRIM($groupField),''),'Direct/Unknown') as name,
//                       COALESCE(SUM(ps.amount),0) as rev
//                 FROM payment_status ps
//                 LEFT JOIN user_campaign uc ON uc.user_id = ps.user_id
//                 WHERE ps.status='success' AND ps.user_id IN ($ph)
//                 GROUP BY COALESCE(NULLIF(TRIM($groupField),''),'Direct/Unknown')";
//         $stmt = $pdo->prepare($sql);
//         $stmt->execute($userIds);
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
//             $revenueMap[$r['name']] = (float)$r['rev'];
//         }
//     }

//     // Build metrics per entity
//     $result = [];
//     foreach ($groups as $key => $g) {
//         $spend  = $g['spend'];
//         $imp    = $g['impressions'];
//         $clicks = $g['clicks'];
//         $reg    = $regMap[$key]     ?? 0;
//         $exam   = $examMap[$key]    ?? 0;
//         $rev    = $revenueMap[$key] ?? 0;

//         $result[$key] = [
//             'spend'         => round($spend, 2),
//             'impressions'   => $imp,
//             'clicks'        => $clicks,
//             'reach'         => $g['reach'],
//             'registrations' => $reg,
//             'exams'         => $exam,
//             'revenue'       => round($rev, 2),

//             'cpm'           => $imp    > 0 ? round(($spend / $imp) * 1000, 2) : 0,
//             'cpc'           => $clicks > 0 ? round($spend / $clicks, 2)       : 0,
//             'ctr'           => $imp    > 0 ? round(($clicks / $imp) * 100, 2) : 0,
//             'cpl'           => $reg    > 0 ? round($spend / $reg, 2)          : 0,
//             'cost_per_exam' => $exam   > 0 ? round($spend / $exam, 2)         : 0,
//             'roi'           => $spend  > 0 ? round($rev / $spend, 4)          : 0,

//             'campaign_name' => $g['campaign_name'],
//             'campaign_id'   => $g['campaign_id'],
//             'adset_name'    => $g['adset_name'],
//             'ad_name'       => $g['ad_name'],
//             'from_date'     => $from,
//             'to_date'       => $to,
//         ];
//     }

//     vaCacheSet($ckey, $result);
//     return $result;
// }

// /* ==========================================================================
//   ACTION: fetch_version_analysis  (campaign-level, all selected versions)
//   Input:  versions (JSON array of CIT version names)
//   Output: { campaigns: [ { campaign_name, delivery_status, conversion_event,
//                             versions: [ { version, cpm, cpc, ctr, cpl,
//                                           cost_per_exam, roi, ... } ] } ] }
//   ========================================================================== */
// if ($action === 'fetch_version_analysis') {

//     $versions = json_decode($_POST['versions'] ?? '[]', true);
//     if (!is_array($versions) || empty($versions)) {
//         jsonOut(['success' => false, 'message' => 'No versions provided']);
//     }

//     $ACCESS_TOKEN = getMetaToken($pdo);
//     $GLOBALS['ACCESS_TOKEN'] = $ACCESS_TOKEN;
//     if (!$ACCESS_TOKEN) {
//         jsonOut(['success' => false, 'token_expired' => true, 'message' => 'Meta Access Token Missing']);
//     }

//     try {
//         // ===== PARALLEL PREFETCH =====
//         // Fire off all per-version Meta insight calls in parallel so subsequent
//         // computeVersionMetrics() calls hit the memo instead of serial HTTP.
//         $rangesToFetch = [];
//         foreach ($versions as $v) {
//             $r = getVersionDateRange($pdo, $v);
//             if ($r) $rangesToFetch[] = $r;
//         }
//         if (!empty($rangesToFetch)) {
//             fetchMetaInsightsParallel($rangesToFetch);
//         }

//         // Status + event maps (fetched once, current snapshot)
//         $adsFromMeta    = fetchAdsFromMeta();
//         $adsetsFromMeta = fetchAdsetsFromMeta();
//         $eventMap       = buildCampaignEventMap($adsetsFromMeta);

//         // Per-version campaign metrics (now fast - insights are in memo)
//         $versionMetrics = [];
//         foreach ($versions as $v) {
//             $versionMetrics[$v] = computeVersionMetrics($pdo, $v, 'campaign');
//         }

//         // Build delivery-status map using the first selected version's insights
//         $statusMap = [];
//         if (!empty($versions)) {
//             $firstRange = getVersionDateRange($pdo, $versions[0]);
//             if ($firstRange) {
//                 $firstInsights = fetchMetaInsightsForRange($firstRange['from'], $firstRange['to']);
//                 if (!isset($firstInsights['error'])) {
//                     $statusMap = buildCampaignStatusMap($adsFromMeta, $firstInsights);
//                 }
//             }
//         }

//         // Collect all unique campaigns across versions
//         $allCampaigns = [];
//         foreach ($versionMetrics as $v => $metrics) {
//             foreach ($metrics as $cname => $m) {
//                 if (!isset($allCampaigns[$cname])) {
//                     $allCampaigns[$cname] = [
//                         'campaign_name' => $cname,
//                         'campaign_id'   => $m['campaign_id'] ?? '',
//                     ];
//                 }
//             }
//         }

//         // Build response: campaigns -> versions array
//         $campaigns = [];
//         foreach ($allCampaigns as $cname => $info) {
//             $versionsData = [];
//             foreach ($versions as $v) {
//                 if (isset($versionMetrics[$v][$cname])) {
//                     $m = $versionMetrics[$v][$cname];
//                     $versionsData[] = [
//                         'version'       => $v,
//                         'no_data'       => false,
//                         'cpm'           => $m['cpm'],
//                         'cpc'           => $m['cpc'],
//                         'ctr'           => $m['ctr'],
//                         'cpl'           => $m['cpl'],
//                         'cost_per_exam' => $m['cost_per_exam'],
//                         'roi'           => $m['roi'],
//                         'spend'         => $m['spend'],
//                         'impressions'   => $m['impressions'],
//                         'clicks'        => $m['clicks'],
//                         'registrations' => $m['registrations'],
//                         'exams'         => $m['exams'],
//                         'revenue'       => $m['revenue'],
//                         'from_date'     => $m['from_date'],
//                         'to_date'       => $m['to_date'],
//                     ];
//                 } else {
//                     $versionsData[] = ['version' => $v, 'no_data' => true];
//                 }
//             }

//             $campaigns[] = [
//                 'campaign_name'    => $cname,
//                 'campaign_id'      => $info['campaign_id'],
//                 'delivery_status'  => $statusMap[$cname] ?? 'UNKNOWN',
//                 'conversion_event' => $eventMap[$info['campaign_id']] ?? 'UNKNOWN',
//                 'versions'         => $versionsData,
//             ];
//         }

//         // Direct/Unknown first, then alphabetical
//         usort($campaigns, function($a, $b) {
//             if ($a['campaign_name'] === 'Direct/Unknown') return -1;
//             if ($b['campaign_name'] === 'Direct/Unknown') return 1;
//             return strcmp($a['campaign_name'], $b['campaign_name']);
//         });

//         jsonOut([
//             'success'   => true,
//             'versions'  => $versions,
//             'campaigns' => $campaigns,
//         ]);

//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ==========================================================================
//   ACTION: fetch_version_analysis_adsets  (lazy, per campaign)
//   Input:  versions (JSON array), campaign_name
//   Output: { adsets: [ { adset_name, versions: [...] } ] }
//   ========================================================================== */
// if ($action === 'fetch_version_analysis_adsets') {

//     $versions     = json_decode($_POST['versions'] ?? '[]', true);
//     $campaignName = $_POST['campaign_name'] ?? '';

//     if (!is_array($versions) || empty($versions) || $campaignName === '') {
//         jsonOut(['success' => false, 'message' => 'Missing params']);
//     }

//     $ACCESS_TOKEN = getMetaToken($pdo);
//     $GLOBALS['ACCESS_TOKEN'] = $ACCESS_TOKEN;
//     if (!$ACCESS_TOKEN) {
//         jsonOut(['success' => false, 'token_expired' => true]);
//     }

//     try {
//         // Parallel prefetch
//         $rangesToFetch = [];
//         foreach ($versions as $v) {
//             $r = getVersionDateRange($pdo, $v);
//             if ($r) $rangesToFetch[] = $r;
//         }
//         if (!empty($rangesToFetch)) {
//             fetchMetaInsightsParallel($rangesToFetch);
//         }

//         $versionMetrics = [];
//         foreach ($versions as $v) {
//             $versionMetrics[$v] = computeVersionMetrics(
//                 $pdo, $v, 'adset', ['campaign' => $campaignName]
//             );
//         }

//         $allAdsets = [];
//         foreach ($versionMetrics as $v => $metrics) {
//             foreach ($metrics as $aname => $m) {
//                 if (!isset($allAdsets[$aname])) $allAdsets[$aname] = true;
//             }
//         }

//         $adsets = [];
//         foreach ($allAdsets as $aname => $_) {
//             $versionsData = [];
//             foreach ($versions as $v) {
//                 if (isset($versionMetrics[$v][$aname])) {
//                     $m = $versionMetrics[$v][$aname];
//                     $versionsData[] = [
//                         'version'       => $v,
//                         'no_data'       => false,
//                         'cpm'           => $m['cpm'],
//                         'cpc'           => $m['cpc'],
//                         'ctr'           => $m['ctr'],
//                         'cpl'           => $m['cpl'],
//                         'cost_per_exam' => $m['cost_per_exam'],
//                         'roi'           => $m['roi'],
//                         'spend'         => $m['spend'],
//                         'impressions'   => $m['impressions'],
//                         'clicks'        => $m['clicks'],
//                         'registrations' => $m['registrations'],
//                         'exams'         => $m['exams'],
//                         'revenue'       => $m['revenue'],
//                     ];
//                 } else {
//                     $versionsData[] = ['version' => $v, 'no_data' => true];
//                 }
//             }
//             $adsets[] = [
//                 'adset_name'    => $aname,
//                 'campaign_name' => $campaignName,
//                 'versions'      => $versionsData,
//             ];
//         }

//         usort($adsets, function($a, $b) {
//             return strcmp($a['adset_name'], $b['adset_name']);
//         });

//         jsonOut(['success' => true, 'adsets' => $adsets]);

//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ==========================================================================
//   ACTION: fetch_version_analysis_ads  (lazy, per adset)
//   Input:  versions (JSON array), campaign_name, adset_name
//   Output: { ads: [ { ad_name, versions: [...] } ] }
//   ========================================================================== */
// if ($action === 'fetch_version_analysis_ads') {

//     $versions     = json_decode($_POST['versions'] ?? '[]', true);
//     $campaignName = $_POST['campaign_name'] ?? '';
//     $adsetName    = $_POST['adset_name']    ?? '';

//     if (!is_array($versions) || empty($versions) || $campaignName === '' || $adsetName === '') {
//         jsonOut(['success' => false, 'message' => 'Missing params']);
//     }

//     $ACCESS_TOKEN = getMetaToken($pdo);
//     $GLOBALS['ACCESS_TOKEN'] = $ACCESS_TOKEN;
//     if (!$ACCESS_TOKEN) {
//         jsonOut(['success' => false, 'token_expired' => true]);
//     }

//     try {
//         // Parallel prefetch
//         $rangesToFetch = [];
//         foreach ($versions as $v) {
//             $r = getVersionDateRange($pdo, $v);
//             if ($r) $rangesToFetch[] = $r;
//         }
//         if (!empty($rangesToFetch)) {
//             fetchMetaInsightsParallel($rangesToFetch);
//         }

//         $versionMetrics = [];
//         foreach ($versions as $v) {
//             $versionMetrics[$v] = computeVersionMetrics(
//                 $pdo, $v, 'ad',
//                 ['campaign' => $campaignName, 'adset' => $adsetName]
//             );
//         }

//         $allAds = [];
//         foreach ($versionMetrics as $v => $metrics) {
//             foreach ($metrics as $adname => $m) {
//                 if (!isset($allAds[$adname])) $allAds[$adname] = true;
//             }
//         }

//         $ads = [];
//         foreach ($allAds as $adname => $_) {
//             $versionsData = [];
//             foreach ($versions as $v) {
//                 if (isset($versionMetrics[$v][$adname])) {
//                     $m = $versionMetrics[$v][$adname];
//                     $versionsData[] = [
//                         'version'       => $v,
//                         'no_data'       => false,
//                         'cpm'           => $m['cpm'],
//                         'cpc'           => $m['cpc'],
//                         'ctr'           => $m['ctr'],
//                         'cpl'           => $m['cpl'],
//                         'cost_per_exam' => $m['cost_per_exam'],
//                         'roi'           => $m['roi'],
//                         'spend'         => $m['spend'],
//                         'impressions'   => $m['impressions'],
//                         'clicks'        => $m['clicks'],
//                         'registrations' => $m['registrations'],
//                         'exams'         => $m['exams'],
//                         'revenue'       => $m['revenue'],
//                     ];
//                 } else {
//                     $versionsData[] = ['version' => $v, 'no_data' => true];
//                 }
//             }
//             $ads[] = [
//                 'ad_name'       => $adname,
//                 'adset_name'    => $adsetName,
//                 'campaign_name' => $campaignName,
//                 'versions'      => $versionsData,
//             ];
//         }

//         usort($ads, function($a, $b) {
//             return strcmp($a['ad_name'], $b['ad_name']);
//         });

//         jsonOut(['success' => true, 'ads' => $ads]);

//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ==========================================================================
//   NOTES FEATURE (Version Analysis Remark column)
//   Tables required:
//      - meta_version_notes
//      - meta_version_notes_history
//   See meta_version_notes_schema.sql for CREATE TABLE statements.
//   ========================================================================== */

// /* ----- fetch_notes: bulk fetch notes for a list of entities ----- */
// if ($action === 'fetch_notes') {
//     $entitiesRaw = $_POST['entities'] ?? '[]';
//     $entities = json_decode($entitiesRaw, true);
//     if (!is_array($entities) || empty($entities)) {
//         jsonOut(['success' => true, 'notes' => new stdClass()]);
//     }

//     // Build OR'd (type = ? AND name = ?) conditions
//     $conds  = [];
//     $params = [];
//     foreach ($entities as $e) {
//         $t = $e['type'] ?? '';
//         $n = $e['name'] ?? '';
//         if (!in_array($t, ['campaign','adset','ad']) || $n === '') continue;
//         $conds[] = '(entity_type = ? AND entity_name = ?)';
//         $params[] = $t;
//         $params[] = $n;
//     }
//     if (empty($conds)) {
//         jsonOut(['success' => true, 'notes' => new stdClass()]);
//     }

//     try {
//         $sql = "SELECT id, entity_type, entity_name, user_id, user_name, note,
//                       created_at, updated_at
//                 FROM meta_version_notes
//                 WHERE " . implode(' OR ', $conds) . "
//                 ORDER BY updated_at DESC";
//         $stmt = $pdo->prepare($sql);
//         $stmt->execute($params);

//         // Group by entity key so React can look up easily
//         $grouped = [];
//         foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
//             $key = $row['entity_type'] . '|||' . $row['entity_name'];
//             if (!isset($grouped[$key])) $grouped[$key] = [];
//             $grouped[$key][] = [
//                 'id'         => (int)$row['id'],
//                 'user_id'    => (int)$row['user_id'],
//                 'user_name'  => $row['user_name'],
//                 'note'       => $row['note'],
//                 'created_at' => $row['created_at'],
//                 'updated_at' => $row['updated_at'],
//             ];
//         }
//         // empty-object fallback so JSON encodes as {} not []
//         jsonOut(['success' => true, 'notes' => empty($grouped) ? new stdClass() : $grouped]);
//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ----- save_note: create or update the current user's note on an entity ----- */
// if ($action === 'save_note') {
//     $entityType     = $_POST['entity_type']     ?? '';
//     $entityName     = trim($_POST['entity_name'] ?? '');
//     $parentCampaign = trim($_POST['parent_campaign'] ?? '');
//     $parentAdset    = trim($_POST['parent_adset']    ?? '');
//     $userId         = intval($_POST['user_id']  ?? 0);
//     $userName       = trim($_POST['user_name']  ?? '');
//     $note           = trim($_POST['note']       ?? '');

//     if (!in_array($entityType, ['campaign','adset','ad'])) {
//         jsonOut(['success' => false, 'message' => 'Invalid entity_type']);
//     }
//     if ($entityName === '') jsonOut(['success' => false, 'message' => 'entity_name required']);
//     if ($userId === 0)       jsonOut(['success' => false, 'message' => 'user_id required']);
//     if ($userName === '')    $userName = 'User #' . $userId;

//     try {
//         // Is there an existing note by this user on this entity?
//         $s = $pdo->prepare(
//             "SELECT id, note FROM meta_version_notes
//              WHERE entity_type = ? AND entity_name = ? AND user_id = ? LIMIT 1"
//         );
//         $s->execute([$entityType, $entityName, $userId]);
//         $existing = $s->fetch(PDO::FETCH_ASSOC);

//         if ($existing) {
//             $existingId  = (int)$existing['id'];
//             $oldNote     = $existing['note'];

//             if ($note === '') {
//                 // Delete the note
//                 $pdo->prepare("DELETE FROM meta_version_notes WHERE id = ?")->execute([$existingId]);
//                 $h = $pdo->prepare(
//                     "INSERT INTO meta_version_notes_history
//                      (note_id, entity_type, entity_name, user_id, user_name, action, old_note, new_note)
//                      VALUES (?,?,?,?,?,?,?,?)"
//                 );
//                 $h->execute([$existingId, $entityType, $entityName, $userId, $userName, 'delete', $oldNote, null]);
//                 jsonOut([
//                     'success' => true, 'deleted' => true, 'note_id' => $existingId,
//                     'entity_type' => $entityType, 'entity_name' => $entityName,
//                 ]);
//             }

//             // Update
//             $upd = $pdo->prepare("UPDATE meta_version_notes SET note = ?, user_name = ? WHERE id = ?");
//             $upd->execute([$note, $userName, $existingId]);

//             $h = $pdo->prepare(
//                 "INSERT INTO meta_version_notes_history
//                  (note_id, entity_type, entity_name, user_id, user_name, action, old_note, new_note)
//                  VALUES (?,?,?,?,?,?,?,?)"
//             );
//             $h->execute([$existingId, $entityType, $entityName, $userId, $userName, 'update', $oldNote, $note]);

//             jsonOut([
//                 'success'     => true,
//                 'note_id'     => $existingId,
//                 'entity_type' => $entityType,
//                 'entity_name' => $entityName,
//                 'user_id'     => $userId,
//                 'user_name'   => $userName,
//                 'note'        => $note,
//             ]);
//         }

//         // Create new
//         if ($note === '') {
//             jsonOut(['success' => true, 'noop' => true]);
//         }

//         $ins = $pdo->prepare(
//             "INSERT INTO meta_version_notes
//              (entity_type, entity_name, parent_campaign, parent_adset, user_id, user_name, note)
//              VALUES (?,?,?,?,?,?,?)"
//         );
//         $ins->execute([
//             $entityType, $entityName,
//             $parentCampaign !== '' ? $parentCampaign : null,
//             $parentAdset    !== '' ? $parentAdset    : null,
//             $userId, $userName, $note,
//         ]);
//         $newId = (int)$pdo->lastInsertId();

//         $h = $pdo->prepare(
//             "INSERT INTO meta_version_notes_history
//              (note_id, entity_type, entity_name, user_id, user_name, action, old_note, new_note)
//              VALUES (?,?,?,?,?,?,?,?)"
//         );
//         $h->execute([$newId, $entityType, $entityName, $userId, $userName, 'create', null, $note]);

//         jsonOut([
//             'success'     => true,
//             'note_id'     => $newId,
//             'entity_type' => $entityType,
//             'entity_name' => $entityName,
//             'user_id'     => $userId,
//             'user_name'   => $userName,
//             'note'        => $note,
//             'created'     => true,
//         ]);
//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ----- fetch_note_history: full audit log for one entity ----- */
// if ($action === 'fetch_note_history') {
//     $entityType = $_POST['entity_type']  ?? '';
//     $entityName = trim($_POST['entity_name'] ?? '');
//     if (!in_array($entityType, ['campaign','adset','ad']) || $entityName === '') {
//         jsonOut(['success' => false, 'message' => 'Invalid entity']);
//     }
//     try {
//         $s = $pdo->prepare(
//             "SELECT id, note_id, user_id, user_name, action, old_note, new_note, created_at
//              FROM meta_version_notes_history
//              WHERE entity_type = ? AND entity_name = ?
//              ORDER BY created_at DESC
//              LIMIT 200"
//         );
//         $s->execute([$entityType, $entityName]);
//         jsonOut(['success' => true, 'history' => $s->fetchAll(PDO::FETCH_ASSOC)]);
//     } catch (Exception $e) {
//         jsonOut(['success' => false, 'message' => $e->getMessage()]);
//     }
// }

// /* ==========================================================================
//   Unknown action
//   ========================================================================== */
// jsonOut(['success' => false, 'message' => 'Unknown action: ' . $action]);








































/* ============================================================================
   META ADS DASHBOARD - API ENDPOINT (React backend)
   File: meta_ads_api.php
   ----------------------------------------------------------------------------
   Pure JSON, action-based. Same pattern as the original real_time_reports2.php
   but with:
     - No HTML / no redirects (auth errors return JSON)
     - CORS headers for a separate React origin (optional, see top config)
     - All 7 actions preserved with IDENTICAL business logic
   ============================================================================ */

// Session is used ONLY for the Version Analysis cache (per-user 5-min TTL)
if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

/* --------------------------------------------------------------------------
   CORS CONFIG
   If your React app runs on the same origin as PHP, leave ALLOW_ORIGIN = null.
   If it runs on a different origin (e.g. http://localhost:3000 during dev),
   set ALLOW_ORIGIN to that exact origin. Wildcard '*' will NOT work with
   credentials, so list the exact origin(s) you need.
   -------------------------------------------------------------------------- */
$ALLOW_ORIGIN = null; // e.g. 'http://localhost:3000' or 'https://app.example.com'

if ($ALLOW_ORIGIN) {
    header("Access-Control-Allow-Origin: $ALLOW_ORIGIN");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");

    // Preflight
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

header('Content-Type: application/json; charset=utf-8');

/* --------------------------------------------------------------------------
   Helper: JSON out + die
   -------------------------------------------------------------------------- */
function jsonOut($payload, $code = 200) {
    http_response_code($code);
    echo json_encode($payload);
    exit;
}

/* --------------------------------------------------------------------------
   Only POST allowed
   -------------------------------------------------------------------------- */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonOut(['success' => false, 'message' => 'POST required'], 405);
}

$action = $_POST['action'] ?? '';
if ($action === '') {
    jsonOut(['success' => false, 'message' => 'Missing action']);
}

/* --------------------------------------------------------------------------
   DB CONNECTION
   -------------------------------------------------------------------------- */
$host     = '127.0.0.1:3306';
$dbname   = 'istudio_cit';
$username = 'istudio_admin';
$password = 'h;V[ts@#;u{B';

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    jsonOut(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()], 500);
}

/* --------------------------------------------------------------------------
   META API CONFIG
   -------------------------------------------------------------------------- */
define('AD_ACCOUNT_ID', 'act_440296640847969');

/* ==========================================================================
   HELPERS
   ========================================================================== */

/**
 * Fetch all ads (paginated) with statuses from Meta Graph API
 */
function fetchAdsFromMeta() {
    global $ACCESS_TOKEN;
    $allAds = [];
    $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
           '/ads?fields=id,name,effective_status,configured_status&limit=2000&access_token=' . $ACCESS_TOKEN;

    while ($url) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        $response = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($response, true);
        if (isset($data['error'])) break;

        $allAds = array_merge($allAds, $data['data'] ?? []);
        $url = $data['paging']['next'] ?? null;
    }
    return $allAds;
}

/**
 * Fetch all adsets (paginated)
 */
function fetchAdsetsFromMeta() {
    global $ACCESS_TOKEN;
    $allAdsets = [];
    $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
           '/adsets?fields=id,name,campaign_id,optimization_goal,billing_event,promoted_object,status,effective_status&limit=2000&access_token=' . $ACCESS_TOKEN;

    while ($url) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        $response = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($response, true);
        if (isset($data['error'])) break;

        $allAdsets = array_merge($allAdsets, $data['data'] ?? []);
        $url = $data['paging']['next'] ?? null;
    }
    return $allAdsets;
}

/**
 * Build campaign_name -> effective_status map
 * (takes ad -> status, then insights rows to link ad_id -> campaign_name)
 */
function buildCampaignStatusMap($adsData, $insightsRaw) {
    $adIdToStatus = [];
    foreach ($adsData as $ad) {
        $adIdToStatus[$ad['id']] = $ad['effective_status'] ?? 'UNKNOWN';
    }

    $campaignStatusMap = [];
    foreach ($insightsRaw as $row) {
        $campaignName = trim($row['campaign_name'] ?? '');
        $adId         = trim($row['ad_id'] ?? '');
        if ($campaignName === '' || $adId === '') continue;
        $campaignStatusMap[$campaignName] = $adIdToStatus[$adId] ?? 'UNKNOWN';
    }
    return $campaignStatusMap;
}

/**
 * Build campaign_id -> custom_event_type map from adsets
 */
function buildCampaignEventMap($adsetsData) {
    $campaignEventMap = [];
    foreach ($adsetsData as $adset) {
        $campaignId = $adset['campaign_id'] ?? '';
        $event      = $adset['promoted_object']['custom_event_type'] ?? 'UNKNOWN';
        if ($campaignId && !isset($campaignEventMap[$campaignId])) {
            $campaignEventMap[$campaignId] = $event;
        }
    }
    return $campaignEventMap;
}

/**
 * Detect Meta token-expired errors
 */
function isTokenExpiredError($errMsg) {
    return (
        stripos($errMsg, 'invalid oauth access token')           !== false ||
        stripos($errMsg, 'error validating access token')        !== false ||
        stripos($errMsg, 'session has expired')                  !== false ||
        stripos($errMsg, 'access token could not be decrypted')  !== false ||
        stripos($errMsg, 'invalid access token')                 !== false
    );
}

/**
 * Fetch the stored Meta access token
 */
function getMetaToken($pdo) {
    $stmt = $pdo->prepare("SELECT settings_value FROM settings WHERE settings_key='meta_access_token' LIMIT 1");
    $stmt->execute();
    return $stmt->fetchColumn();
}

/* ==========================================================================
   ACTION: get_cit_versions
   ========================================================================== */
if ($action === 'get_cit_versions') {
    try {
        $stmt = $pdo->query("
            SELECT exam_name
            FROM exam_batch_for_reports
            GROUP BY exam_name
            ORDER BY MAX(id) DESC
        ");
        $versions = $stmt->fetchAll(PDO::FETCH_COLUMN);
        jsonOut(['success' => true, 'versions' => $versions]);
    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ==========================================================================
   ACTION: get_date_range
   ========================================================================== */
if ($action === 'get_date_range') {
    $citVersion = $_POST['cit_version'] ?? '';
    try {
        $stmt = $pdo->prepare("
            SELECT from_date, to_date
            FROM exam_batch_for_reports
            WHERE exam_name = ?
            LIMIT 1
        ");
        $stmt->execute([$citVersion]);
        $dates = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($dates) {
            $fromDate = date('Y-m-d', strtotime($dates['from_date'] . ' +1 day'));
            $toDate   = $dates['to_date'];
            jsonOut([
                'success'   => true,
                'from_date' => $fromDate,
                'to_date'   => $toDate,
            ]);
        } else {
            jsonOut(['success' => false, 'message' => 'Date range not found']);
        }
    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ==========================================================================
   ACTION: update_meta_token
   ========================================================================== */
if ($action === 'update_meta_token') {
    $newToken = trim($_POST['token'] ?? '');
    if ($newToken === '') {
        jsonOut(['success' => false, 'message' => 'Token empty']);
    }

    try {
        $checkStmt = $pdo->prepare("SELECT id FROM settings WHERE settings_key='meta_access_token' LIMIT 1");
        $checkStmt->execute();
        $rowId = $checkStmt->fetchColumn();

        if ($rowId) {
            $stmt = $pdo->prepare("
                UPDATE settings
                SET settings_value = ?
                WHERE settings_key = 'meta_access_token'
            ");
            $stmt->execute([$newToken]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO settings (settings_key, settings_value)
                VALUES ('meta_access_token', ?)
            ");
            $stmt->execute([$newToken]);
        }

        jsonOut(['success' => true]);
    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ==========================================================================
   ACTION: fetch_ad_stats
   Per-ad aggregated stats from DB, filtered by registration date range
   ========================================================================== */
if ($action === 'fetch_ad_stats') {
    $fromDate = $_POST['from_date'] ?? '';
    $toDate   = $_POST['to_date']   ?? '';
    $ads      = json_decode($_POST['ads'] ?? '[]', true);

    if (empty($ads) || empty($fromDate) || empty($toDate)) {
        jsonOut(['success' => false, 'message' => 'Missing params']);
    }

    try {
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
        $stmt->execute([$fromDate . ' 00:00:00', $toDate . ' 23:59:59']);
        $allUserIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($allUserIds)) {
            jsonOut(['success' => true, 'data' => []]);
        }

        $ph    = implode(',', array_fill(0, count($allUserIds), '?'));
        $adsPh = implode(',', array_fill(0, count($ads), '?'));

        // Registrations per ad
        $stmt = $pdo->prepare("
            SELECT COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown') as ad_name,
                   COUNT(DISTINCT uc.user_id) as registrations
            FROM user_campaign uc
            WHERE uc.user_id IN ($ph)
              AND TRIM(uc.ad) IN ($adsPh)
            GROUP BY COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown')
        ");
        $stmt->execute(array_merge($allUserIds, $ads));
        $regMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $regMap[$r['ad_name']] = (int)$r['registrations'];
        }

        // Exams per ad
        $stmt = $pdo->prepare("
            SELECT COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown') as ad_name,
                   COUNT(DISTINCT cr.user_id) as exam_count
            FROM cit_results cr
            JOIN user_campaign uc ON uc.user_id = cr.user_id
            WHERE cr.user_id IN ($ph)
              AND TRIM(uc.ad) IN ($adsPh)
            GROUP BY COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown')
        ");
        $stmt->execute(array_merge($allUserIds, $ads));
        $examMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $examMap[$r['ad_name']] = (int)$r['exam_count'];
        }

        // Internships + Revenue per ad
        $stmt = $pdo->prepare("
            SELECT COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown') as ad_name,
                   COUNT(DISTINCT ps.user_id) as internship_count,
                   COALESCE(SUM(ps.amount), 0) as revenue
            FROM payment_status ps
            JOIN user_campaign uc ON uc.user_id = ps.user_id
            WHERE ps.status = 'success'
              AND ps.user_id IN ($ph)
              AND TRIM(uc.ad) IN ($adsPh)
            GROUP BY COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown')
        ");
        $stmt->execute(array_merge($allUserIds, $ads));
        $internMap  = [];
        $revenueMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $internMap[$r['ad_name']]  = (int)$r['internship_count'];
            $revenueMap[$r['ad_name']] = (float)$r['revenue'];
        }

        // 2nd internship per ad (users with >= 2 successful payments)
        $stmt = $pdo->prepare("
            SELECT COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown') as ad_name,
                   COUNT(DISTINCT sub.user_id) as second_internship
            FROM (
                SELECT user_id FROM payment_status
                WHERE status = 'success' AND user_id IN ($ph)
                GROUP BY user_id HAVING COUNT(*) >= 2
            ) sub
            JOIN user_campaign uc ON uc.user_id = sub.user_id
            WHERE TRIM(uc.ad) IN ($adsPh)
            GROUP BY COALESCE(NULLIF(TRIM(uc.ad),''), 'Unknown')
        ");
        $stmt->execute(array_merge($allUserIds, $ads));
        $secondMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $secondMap[$r['ad_name']] = (int)$r['second_internship'];
        }

        $result = [];
        foreach ($ads as $ad) {
            $result[$ad] = [
                'registrations'     => $regMap[$ad]     ?? 0,
                'exam_count'        => $examMap[$ad]    ?? 0,
                'internship_count'  => $internMap[$ad]  ?? 0,
                'second_internship' => $secondMap[$ad]  ?? 0,
                'revenue'           => $revenueMap[$ad] ?? 0,
            ];
        }

        jsonOut(['success' => true, 'data' => $result]);
    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ==========================================================================
   ACTION: fetch_adset_stats
   Per-adset aggregated stats from DB, filtered by registration date range
   ========================================================================== */
if ($action === 'fetch_adset_stats') {
    $fromDate = $_POST['from_date'] ?? '';
    $toDate   = $_POST['to_date']   ?? '';
    $adsets   = json_decode($_POST['adsets'] ?? '[]', true);

    if (empty($adsets) || empty($fromDate) || empty($toDate)) {
        jsonOut(['success' => false, 'message' => 'Missing params']);
    }

    try {
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
        $stmt->execute([$fromDate . ' 00:00:00', $toDate . ' 23:59:59']);
        $allUserIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($allUserIds)) {
            jsonOut(['success' => true, 'data' => []]);
        }

        $ph      = implode(',', array_fill(0, count($allUserIds), '?'));
        $adsetPh = implode(',', array_fill(0, count($adsets), '?'));

        // Registrations per adset
        $stmt = $pdo->prepare("
            SELECT COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown') as adset_name,
                   COUNT(DISTINCT uc.user_id) as registrations
            FROM user_campaign uc
            WHERE uc.user_id IN ($ph)
              AND TRIM(uc.adset) IN ($adsetPh)
            GROUP BY COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown')
        ");
        $stmt->execute(array_merge($allUserIds, $adsets));
        $regMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $regMap[$r['adset_name']] = (int)$r['registrations'];
        }

        // Exams per adset
        $stmt = $pdo->prepare("
            SELECT COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown') as adset_name,
                   COUNT(DISTINCT cr.user_id) as exam_count
            FROM cit_results cr
            JOIN user_campaign uc ON uc.user_id = cr.user_id
            WHERE cr.user_id IN ($ph)
              AND TRIM(uc.adset) IN ($adsetPh)
            GROUP BY COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown')
        ");
        $stmt->execute(array_merge($allUserIds, $adsets));
        $examMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $examMap[$r['adset_name']] = (int)$r['exam_count'];
        }

        // Internships + Revenue per adset
        $stmt = $pdo->prepare("
            SELECT COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown') as adset_name,
                   COUNT(DISTINCT ps.user_id) as internship_count,
                   COALESCE(SUM(ps.amount), 0) as revenue
            FROM payment_status ps
            JOIN user_campaign uc ON uc.user_id = ps.user_id
            WHERE ps.status = 'success'
              AND ps.user_id IN ($ph)
              AND TRIM(uc.adset) IN ($adsetPh)
            GROUP BY COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown')
        ");
        $stmt->execute(array_merge($allUserIds, $adsets));
        $internMap  = [];
        $revenueMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $internMap[$r['adset_name']]  = (int)$r['internship_count'];
            $revenueMap[$r['adset_name']] = (float)$r['revenue'];
        }

        // 2nd internship per adset
        $stmt = $pdo->prepare("
            SELECT COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown') as adset_name,
                   COUNT(DISTINCT sub.user_id) as second_internship
            FROM (
                SELECT user_id FROM payment_status
                WHERE status = 'success' AND user_id IN ($ph)
                GROUP BY user_id HAVING COUNT(*) >= 2
            ) sub
            JOIN user_campaign uc ON uc.user_id = sub.user_id
            WHERE TRIM(uc.adset) IN ($adsetPh)
            GROUP BY COALESCE(NULLIF(TRIM(uc.adset),''), 'Unknown')
        ");
        $stmt->execute(array_merge($allUserIds, $adsets));
        $secondMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $secondMap[$r['adset_name']] = (int)$r['second_internship'];
        }

        $result = [];
        foreach ($adsets as $adset) {
            $result[$adset] = [
                'registrations'     => $regMap[$adset]     ?? 0,
                'exam_count'        => $examMap[$adset]    ?? 0,
                'internship_count'  => $internMap[$adset]  ?? 0,
                'second_internship' => $secondMap[$adset]  ?? 0,
                'revenue'           => $revenueMap[$adset] ?? 0,
            ];
        }

        jsonOut(['success' => true, 'data' => $result]);
    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ==========================================================================
   ACTION: fetch_analytics_phase1
   Fast phase - Meta insights + DB aggregation. Delivery/event filled later.
   ========================================================================== */
if ($action === 'fetch_analytics_phase1') {

    $ACCESS_TOKEN = getMetaToken($pdo);
    $GLOBALS['ACCESS_TOKEN'] = $ACCESS_TOKEN;

    if (!$ACCESS_TOKEN) {
        jsonOut(['success' => false, 'token_expired' => true, 'message' => 'Meta Access Token Missing']);
    }

    $citVersion      = $_POST['cit_version']       ?? '';
    $fromDate        = $_POST['from_date']         ?? '';
    $toDate          = $_POST['to_date']           ?? '';
    $perPage         = intval($_POST['per_page']   ?? 100);
    $compareFromDate = $_POST['compare_from_date'] ?? '';
    $compareToDate   = $_POST['compare_to_date']   ?? '';
    $isComparison    = !empty($compareFromDate) && !empty($compareToDate);

    try {
        $fields = [
            'ad_id','campaign_id','campaign_name','adset_name','ad_name',
            'spend','impressions','clicks','reach','ctr','cpc','frequency',
        ];

        // Current period insights
        $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
               '/insights?level=ad' .
               '&fields=' . implode(',', $fields) .
               '&time_range={"since":"' . $fromDate . '","until":"' . $toDate . '"}' .
               '&limit=' . $perPage .
               '&access_token=' . $ACCESS_TOKEN;

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        $response = curl_exec($ch);
        if (curl_errno($ch)) throw new Exception('Meta API Error: ' . curl_error($ch));
        curl_close($ch);

        $metaData = json_decode($response, true);

        if (isset($metaData['error'])) {
            $errMsg = $metaData['error']['message'] ?? 'Unknown Meta Error';
            if (isTokenExpiredError($errMsg)) {
                jsonOut(['success' => false, 'token_expired' => true, 'message' => 'Meta Access Token Expired']);
            }
            throw new Exception('Meta API Error: ' . $errMsg);
        }

        $allMetaRaw = $metaData['data'] ?? [];

        // Comparison period insights (optional)
        $allMetaRawCompare = [];
        if ($isComparison) {
            $urlCompare = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
                '/insights?level=ad' .
                '&fields=' . implode(',', $fields) .
                '&time_range={"since":"' . $compareFromDate . '","until":"' . $compareToDate . '"}' .
                '&limit=' . $perPage .
                '&access_token=' . $ACCESS_TOKEN;

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $urlCompare);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $responseCompare = curl_exec($ch);
            curl_close($ch);
            $metaDataCompare   = json_decode($responseCompare, true);
            $allMetaRawCompare = $metaDataCompare['data'] ?? [];
        }

        // Aggregate current period by campaign
        $campaignGroups = [];
        foreach ($allMetaRaw as $row) {
            $campaign = trim($row['campaign_name'] ?? '');
            if ($campaign === '') continue;
            if (!isset($campaignGroups[$campaign])) {
                $campaignGroups[$campaign] = [
                    'campaign_id' => $row['campaign_id'] ?? '',
                    'spend' => 0, 'impressions' => 0,
                    'clicks' => 0, 'reach' => 0,
                    'date_start' => $row['date_start'] ?? '',
                    'date_stop'  => $row['date_stop']  ?? '',
                ];
            }
            $campaignGroups[$campaign]['spend']       += (float)($row['spend']       ?? 0);
            $campaignGroups[$campaign]['impressions'] += (int)  ($row['impressions'] ?? 0);
            $campaignGroups[$campaign]['clicks']      += (int)  ($row['clicks']      ?? 0);
            $campaignGroups[$campaign]['reach']       += (int)  ($row['reach']       ?? 0);
        }

        // Aggregate comparison period by campaign
        $campaignGroupsCompare = [];
        if ($isComparison) {
            foreach ($allMetaRawCompare as $row) {
                $campaign = trim($row['campaign_name'] ?? '');
                if ($campaign === '') continue;
                if (!isset($campaignGroupsCompare[$campaign])) {
                    $campaignGroupsCompare[$campaign] = ['spend'=>0,'impressions'=>0,'clicks'=>0,'reach'=>0];
                }
                $campaignGroupsCompare[$campaign]['spend']       += (float)($row['spend']       ?? 0);
                $campaignGroupsCompare[$campaign]['impressions'] += (int)  ($row['impressions'] ?? 0);
                $campaignGroupsCompare[$campaign]['clicks']      += (int)  ($row['clicks']      ?? 0);
                $campaignGroupsCompare[$campaign]['reach']       += (int)  ($row['reach']       ?? 0);
            }
        }

        // DB: user_ids registered in current period
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
        $stmt->execute([$fromDate . ' 00:00:00', $toDate . ' 23:59:59']);
        $allUserIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        // DB: user_ids registered in comparison period
        $allUserIdsCompare = [];
        if ($isComparison) {
            $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
            $stmt->execute([$compareFromDate . ' 00:00:00', $compareToDate . ' 23:59:59']);
            $allUserIdsCompare = $stmt->fetchAll(PDO::FETCH_COLUMN);
        }

        if (empty($allUserIds)) {
            jsonOut([
                'success'       => true,
                'data'          => [],
                'meta_raw'      => [],
                'is_comparison' => $isComparison,
            ]);
        }

        $ph = implode(',', array_fill(0, count($allUserIds), '?'));

        // Registrations per campaign (current)
        $stmt = $pdo->prepare("
            SELECT user_id, COALESCE(NULLIF(TRIM(campaign),''),'Direct/Unknown') as campaign
            FROM user_campaign WHERE user_id IN ($ph)
        ");
        $stmt->execute($allUserIds);
        $registrationsMap = [];
        $userIdsMap       = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $userIdsMap[$r['campaign']][] = $r['user_id'];
            $registrationsMap[$r['campaign']] = count(array_unique($userIdsMap[$r['campaign']]));
        }

        // Exams per campaign (current)
        $stmt = $pdo->prepare("
            SELECT DISTINCT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign, cr.user_id
            FROM cit_results cr
            LEFT JOIN user_campaign uc ON uc.user_id=cr.user_id
            WHERE cr.user_id IN ($ph)
        ");
        $stmt->execute($allUserIds);
        $examMap        = [];
        $examUserIdsMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $examUserIdsMap[$r['campaign']][] = $r['user_id'];
            $examMap[$r['campaign']] = count(array_unique($examUserIdsMap[$r['campaign']]));
        }

        // Payments per campaign (current)
        $stmt = $pdo->prepare("
            SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
                   COUNT(DISTINCT ps.user_id) AS internships,
                   COALESCE(SUM(ps.amount),0) AS revenue
            FROM payment_status ps
            LEFT JOIN user_campaign uc ON uc.user_id=ps.user_id
            WHERE ps.status='success' AND ps.user_id IN ($ph)
            GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
        ");
        $stmt->execute($allUserIds);
        $internshipMap = [];
        $revenueMap    = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $internshipMap[$r['campaign']] = (int)$r['internships'];
            $revenueMap[$r['campaign']]    = (float)$r['revenue'];
        }

        // 2nd internship per campaign (current)
        $stmt = $pdo->prepare("
            SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
                   COUNT(DISTINCT sub.user_id) AS second_internships
            FROM (
                SELECT user_id FROM payment_status
                WHERE status='success' AND user_id IN ($ph)
                GROUP BY user_id HAVING COUNT(*)>=2
            ) sub
            LEFT JOIN user_campaign uc ON uc.user_id=sub.user_id
            GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
        ");
        $stmt->execute($allUserIds);
        $secondInternshipMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $secondInternshipMap[$r['campaign']] = (int)$r['second_internships'];
        }

        // Comparison period DB queries
        $registrationsMapCompare   = [];
        $examMapCompare            = [];
        $internshipMapCompare      = [];
        $revenueMapCompare         = [];
        $secondInternshipMapCompare = [];

        if ($isComparison && !empty($allUserIdsCompare)) {
            $phC = implode(',', array_fill(0, count($allUserIdsCompare), '?'));

            $stmt = $pdo->prepare("
                SELECT user_id, COALESCE(NULLIF(TRIM(campaign),''),'Direct/Unknown') as campaign
                FROM user_campaign WHERE user_id IN ($phC)
            ");
            $stmt->execute($allUserIdsCompare);
            $uMapC = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $uMapC[$r['campaign']][] = $r['user_id'];
                $registrationsMapCompare[$r['campaign']] = count(array_unique($uMapC[$r['campaign']]));
            }

            $stmt = $pdo->prepare("
                SELECT DISTINCT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign, cr.user_id
                FROM cit_results cr
                LEFT JOIN user_campaign uc ON uc.user_id=cr.user_id
                WHERE cr.user_id IN ($phC)
            ");
            $stmt->execute($allUserIdsCompare);
            $eMapC = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $eMapC[$r['campaign']][] = $r['user_id'];
                $examMapCompare[$r['campaign']] = count(array_unique($eMapC[$r['campaign']]));
            }

            $stmt = $pdo->prepare("
                SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
                       COUNT(DISTINCT ps.user_id) AS internships,
                       COALESCE(SUM(ps.amount),0) AS revenue
                FROM payment_status ps
                LEFT JOIN user_campaign uc ON uc.user_id=ps.user_id
                WHERE ps.status='success' AND ps.user_id IN ($phC)
                GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
            ");
            $stmt->execute($allUserIdsCompare);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $internshipMapCompare[$r['campaign']] = (int)$r['internships'];
                $revenueMapCompare[$r['campaign']]    = (float)$r['revenue'];
            }

            $stmt = $pdo->prepare("
                SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
                       COUNT(DISTINCT sub.user_id) AS second_internships
                FROM (
                    SELECT user_id FROM payment_status
                    WHERE status='success' AND user_id IN ($phC)
                    GROUP BY user_id HAVING COUNT(*)>=2
                ) sub
                LEFT JOIN user_campaign uc ON uc.user_id=sub.user_id
                GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
            ");
            $stmt->execute($allUserIdsCompare);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $secondInternshipMapCompare[$r['campaign']] = (int)$r['second_internships'];
            }
        }

        // Build processed rows - delivery_status and conversion_event = 'LOADING'
        // (phase2 will replace these with real values)
        $processedData = [];
        foreach ($campaignGroups as $campaign => $data) {
            $spend            = $data['spend'];
            $registrations    = $registrationsMap[$campaign]     ?? 0;
            $examCount        = $examMap[$campaign]              ?? 0;
            $internshipCount  = $internshipMap[$campaign]        ?? 0;
            $revenue          = $revenueMap[$campaign]           ?? 0;
            $secondInternship = $secondInternshipMap[$campaign]  ?? 0;

            $costPerReg        = $registrations  > 0 ? $spend / $registrations  : 0;
            $costPerExam       = $examCount      > 0 ? $spend / $examCount      : 0;
            $costPerInternship = $internshipCount> 0 ? $spend / $internshipCount: 0;
            $roi               = $spend > 0 ? ($revenue / $spend) : 0;
            $rpu               = $registrations > 0 ? $revenue / $registrations : 0;

            $userIds = isset($userIdsMap[$campaign])
                ? implode(',', array_unique($userIdsMap[$campaign])) : '';

            $rowData = [
                'campaign_name'         => $campaign,
                'campaign_id'           => $data['campaign_id'],
                'delivery_status'       => 'LOADING',
                'conversion_event'      => 'LOADING',
                'user_ids'              => $userIds,
                'date_start'            => $data['date_start'],
                'date_stop'             => $data['date_stop'],
                'spend'                 => $spend,
                'impressions'           => $data['impressions'],
                'clicks'                => $data['clicks'],
                'reach'                 => $data['reach'],
                'registrations'         => $registrations,
                'cost_per_registration' => round($costPerReg, 2),
                'exam_count'            => $examCount,
                'cost_per_exam'         => round($costPerExam, 2),
                'internship_count'      => $internshipCount,
                'second_internship'     => $secondInternship,
                'cost_per_internship'   => round($costPerInternship, 2),
                'revenue'               => round($revenue, 2),
                'roi'                   => round($roi, 2),
                'has_meta_data'         => true,
                'rpu'                   => round($rpu, 2),
                'cac_all'               => round($costPerReg, 2),
                'cac_paid'              => round($costPerInternship, 2),
                'roas'                  => round($roi, 2),
            ];

            if ($isComparison) {
                $cData   = $campaignGroupsCompare[$campaign] ?? null;
                $cSpend  = $cData ? $cData['spend'] : 0;
                $cReg    = $registrationsMapCompare[$campaign]   ?? 0;
                $cExam   = $examMapCompare[$campaign]             ?? 0;
                $cIntern = $internshipMapCompare[$campaign]       ?? 0;
                $cRev    = $revenueMapCompare[$campaign]          ?? 0;
                $cSecond = $secondInternshipMapCompare[$campaign] ?? 0;

                $rowData['compare_spend']                 = $cSpend;
                $rowData['compare_impressions']           = $cData ? $cData['impressions'] : 0;
                $rowData['compare_clicks']                = $cData ? $cData['clicks']      : 0;
                $rowData['compare_reach']                 = $cData ? $cData['reach']       : 0;
                $rowData['compare_registrations']         = $cReg;
                $rowData['compare_cost_per_registration'] = $cReg    > 0 ? round($cSpend/$cReg,2)    : 0;
                $rowData['compare_exam_count']            = $cExam;
                $rowData['compare_cost_per_exam']         = $cExam   > 0 ? round($cSpend/$cExam,2)   : 0;
                $rowData['compare_internship_count']      = $cIntern;
                $rowData['compare_second_internship']     = $cSecond;
                $rowData['compare_cost_per_internship']   = $cIntern > 0 ? round($cSpend/$cIntern,2) : 0;
                $rowData['compare_revenue']               = round($cRev, 2);
                $rowData['compare_roi']                   = $cSpend  > 0 ? round($cRev/$cSpend,2)    : 0;
                $rowData['compare_rpu']                   = $cReg    > 0 ? round($cRev/$cReg,2)      : 0;
                $rowData['compare_cac_all']               = $cReg    > 0 ? round($cSpend/$cReg,2)    : 0;
                $rowData['compare_cac_paid']              = $cIntern > 0 ? round($cSpend/$cIntern,2) : 0;
                $rowData['compare_roas']                  = $cSpend  > 0 ? round($cRev/$cSpend,2)    : 0;
            }

            $processedData[] = $rowData;
        }

        // Campaigns with NO Meta spend but with DB registrations
        foreach ($registrationsMap as $campaign => $regCount) {
            if (isset($campaignGroups[$campaign])) continue;

            $examCount        = $examMap[$campaign]             ?? 0;
            $internshipCount  = $internshipMap[$campaign]       ?? 0;
            $revenue          = $revenueMap[$campaign]          ?? 0;
            $secondInternship = $secondInternshipMap[$campaign] ?? 0;
            $userIds = isset($userIdsMap[$campaign])
                ? implode(',', array_unique($userIdsMap[$campaign])) : '';

            $processedData[] = [
                'campaign_name'         => $campaign,
                'campaign_id'           => '',
                'delivery_status'       => 'UNKNOWN',
                'conversion_event'      => 'UNKNOWN',
                'user_ids'              => $userIds,
                'date_start'            => $fromDate,
                'date_stop'             => $toDate,
                'spend'                 => 0,
                'impressions'           => 0,
                'clicks'                => 0,
                'reach'                 => 0,
                'registrations'         => $regCount,
                'cost_per_registration' => 0,
                'exam_count'            => $examCount,
                'cost_per_exam'         => 0,
                'internship_count'      => $internshipCount,
                'second_internship'     => $secondInternship,
                'cost_per_internship'   => 0,
                'revenue'               => round($revenue, 2),
                'roi'                   => 0,
                'has_meta_data'         => false,
                'rpu'                   => 0,
                'cac_all'               => 0,
                'cac_paid'              => 0,
                'roas'                  => 0,
            ];
        }

        // Direct/Unknown first
        usort($processedData, function($a, $b) {
            if ($a['campaign_name'] === 'Direct/Unknown') return -1;
            if ($b['campaign_name'] === 'Direct/Unknown') return 1;
            return 0;
        });

        jsonOut([
            'success'       => true,
            'data'          => $processedData,
            'meta_raw'      => $allMetaRaw,
            'is_comparison' => $isComparison,
        ]);

    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ==========================================================================
   ACTION: fetch_analytics_phase2
   Background - pulls ads + adsets from Meta and builds status/event maps.
   ========================================================================== */
if ($action === 'fetch_analytics_phase2') {

    $ACCESS_TOKEN = getMetaToken($pdo);
    $GLOBALS['ACCESS_TOKEN'] = $ACCESS_TOKEN;

    if (!$ACCESS_TOKEN) {
        jsonOut(['success' => false, 'token_expired' => true]);
    }

    try {
        $fromDate = $_POST['from_date'] ?? '';
        $toDate   = $_POST['to_date']   ?? '';

        // Slow calls - fetched here, after initial render
        $adsFromMeta    = fetchAdsFromMeta();
        $adsetsFromMeta = fetchAdsetsFromMeta();

        // Minimal insights just to map ad_id -> campaign_name
        $fields = ['ad_id','campaign_id','campaign_name','adset_name','ad_name'];
        $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
               '/insights?level=ad' .
               '&fields=' . implode(',', $fields) .
               '&time_range={"since":"' . $fromDate . '","until":"' . $toDate . '"}' .
               '&limit=500' .
               '&access_token=' . $ACCESS_TOKEN;

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        $response = curl_exec($ch);
        curl_close($ch);

        $metaData    = json_decode($response, true);
        $insightsRaw = $metaData['data'] ?? [];

        $cStatusMap = buildCampaignStatusMap($adsFromMeta, $insightsRaw);
        $cEventMap  = buildCampaignEventMap($adsetsFromMeta);

        jsonOut([
            'success'             => true,
            'campaign_status_map' => $cStatusMap,
            'campaign_event_map'  => $cEventMap,
            'meta_raw'            => $insightsRaw,
            'ads_data'            => $adsFromMeta,
            'adsets_data'         => $adsetsFromMeta,
        ]);

    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ==========================================================================
   ACTION: fetch_analytics (LEGACY, single-phase)
   Kept for backward compatibility. Does everything at once (slower).
   ========================================================================== */
if ($action === 'fetch_analytics') {

    $ACCESS_TOKEN = getMetaToken($pdo);
    $GLOBALS['ACCESS_TOKEN'] = $ACCESS_TOKEN;

    if (!$ACCESS_TOKEN) {
        jsonOut(['success' => false, 'token_expired' => true, 'message' => 'Meta Access Token Missing']);
    }

    $citVersion      = $_POST['cit_version']       ?? '';
    $fromDate        = $_POST['from_date']         ?? '';
    $toDate          = $_POST['to_date']           ?? '';
    $perPage         = intval($_POST['per_page']   ?? 100);
    $compareFromDate = $_POST['compare_from_date'] ?? '';
    $compareToDate   = $_POST['compare_to_date']   ?? '';
    $isComparison    = !empty($compareFromDate) && !empty($compareToDate);

    try {
        $fields = [
            'ad_id','campaign_id','campaign_name','adset_name','ad_name',
            'spend','impressions','clicks','reach','ctr','cpc','frequency',
        ];

        $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
               '/insights?level=ad' .
               '&fields=' . implode(',', $fields) .
               '&time_range={"since":"' . $fromDate . '","until":"' . $toDate . '"}' .
               '&limit=' . $perPage .
               '&access_token=' . $ACCESS_TOKEN;

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        $response = curl_exec($ch);
        if (curl_errno($ch)) throw new Exception('Meta API Error: ' . curl_error($ch));
        curl_close($ch);

        $metaData = json_decode($response, true);
        if (isset($metaData['error'])) {
            $errMsg = $metaData['error']['message'] ?? 'Unknown Meta Error';
            if (isTokenExpiredError($errMsg)) {
                jsonOut(['success' => false, 'token_expired' => true, 'message' => 'Meta Access Token Expired']);
            }
            throw new Exception('Meta API Error: ' . $errMsg);
        }

        $allMetaRaw = $metaData['data'] ?? [];

        // Comparison insights
        $allMetaRawCompare = [];
        if ($isComparison) {
            $urlCompare = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
                '/insights?level=ad' .
                '&fields=' . implode(',', $fields) .
                '&time_range={"since":"' . $compareFromDate . '","until":"' . $compareToDate . '"}' .
                '&limit=' . $perPage .
                '&access_token=' . $ACCESS_TOKEN;

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $urlCompare);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $responseCompare = curl_exec($ch);
            curl_close($ch);

            $metaDataCompare   = json_decode($responseCompare, true);
            $allMetaRawCompare = $metaDataCompare['data'] ?? [];
        }

        // Status + event maps
        $adsFromMeta       = fetchAdsFromMeta();
        $adsetsFromMeta    = fetchAdsetsFromMeta();
        $campaignStatusMap = buildCampaignStatusMap($adsFromMeta, $allMetaRaw);
        $campaignEventMap  = buildCampaignEventMap($adsetsFromMeta);

        // Aggregate campaigns (same logic as phase1) - inlined for parity
        $campaignGroups = [];
        foreach ($allMetaRaw as $row) {
            $campaign = trim($row['campaign_name'] ?? '');
            if ($campaign === '') continue;
            if (!isset($campaignGroups[$campaign])) {
                $campaignGroups[$campaign] = [
                    'campaign_id' => $row['campaign_id'] ?? '',
                    'spend' => 0, 'impressions' => 0,
                    'clicks' => 0, 'reach' => 0,
                    'date_start' => $row['date_start'] ?? '',
                    'date_stop'  => $row['date_stop']  ?? '',
                ];
            }
            $campaignGroups[$campaign]['spend']       += (float)($row['spend']       ?? 0);
            $campaignGroups[$campaign]['impressions'] += (int)  ($row['impressions'] ?? 0);
            $campaignGroups[$campaign]['clicks']      += (int)  ($row['clicks']      ?? 0);
            $campaignGroups[$campaign]['reach']       += (int)  ($row['reach']       ?? 0);
        }

        $campaignGroupsCompare = [];
        if ($isComparison) {
            foreach ($allMetaRawCompare as $row) {
                $campaign = trim($row['campaign_name'] ?? '');
                if ($campaign === '') continue;
                if (!isset($campaignGroupsCompare[$campaign])) {
                    $campaignGroupsCompare[$campaign] = ['spend'=>0,'impressions'=>0,'clicks'=>0,'reach'=>0];
                }
                $campaignGroupsCompare[$campaign]['spend']       += (float)($row['spend']       ?? 0);
                $campaignGroupsCompare[$campaign]['impressions'] += (int)  ($row['impressions'] ?? 0);
                $campaignGroupsCompare[$campaign]['clicks']      += (int)  ($row['clicks']      ?? 0);
                $campaignGroupsCompare[$campaign]['reach']       += (int)  ($row['reach']       ?? 0);
            }
        }

        // Users registered in range
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
        $stmt->execute([$fromDate . ' 00:00:00', $toDate . ' 23:59:59']);
        $allUserIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $allUserIdsCompare = [];
        if ($isComparison) {
            $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
            $stmt->execute([$compareFromDate . ' 00:00:00', $compareToDate . ' 23:59:59']);
            $allUserIdsCompare = $stmt->fetchAll(PDO::FETCH_COLUMN);
        }

        if (empty($allUserIds)) {
            jsonOut(['success' => true, 'data' => [], 'meta_raw' => []]);
        }

        $ph = implode(',', array_fill(0, count($allUserIds), '?'));

        // Registrations (current)
        $stmt = $pdo->prepare("
            SELECT user_id, COALESCE(NULLIF(TRIM(campaign),''),'Direct/Unknown') as campaign
            FROM user_campaign WHERE user_id IN ($ph)
        ");
        $stmt->execute($allUserIds);
        $registrationsMap = [];
        $userIdsMap       = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $userIdsMap[$r['campaign']][] = $r['user_id'];
            $registrationsMap[$r['campaign']] = count(array_unique($userIdsMap[$r['campaign']]));
        }

        // Exams (current)
        $stmt = $pdo->prepare("
            SELECT DISTINCT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign, cr.user_id
            FROM cit_results cr
            LEFT JOIN user_campaign uc ON uc.user_id=cr.user_id
            WHERE cr.user_id IN ($ph)
        ");
        $stmt->execute($allUserIds);
        $examMap        = [];
        $examUserIdsMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $examUserIdsMap[$r['campaign']][] = $r['user_id'];
            $examMap[$r['campaign']] = count(array_unique($examUserIdsMap[$r['campaign']]));
        }

        // Payments + revenue (current)
        $stmt = $pdo->prepare("
            SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
                   COUNT(DISTINCT ps.user_id) AS internships,
                   COALESCE(SUM(ps.amount),0) AS revenue
            FROM payment_status ps
            LEFT JOIN user_campaign uc ON uc.user_id=ps.user_id
            WHERE ps.status='success' AND ps.user_id IN ($ph)
            GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
        ");
        $stmt->execute($allUserIds);
        $internshipMap = [];
        $revenueMap    = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $internshipMap[$r['campaign']] = (int)$r['internships'];
            $revenueMap[$r['campaign']]    = (float)$r['revenue'];
        }

        // 2nd internship (current)
        $stmt = $pdo->prepare("
            SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
                   COUNT(DISTINCT sub.user_id) AS second_internships
            FROM (
                SELECT user_id FROM payment_status
                WHERE status='success' AND user_id IN ($ph)
                GROUP BY user_id HAVING COUNT(*)>=2
            ) sub
            LEFT JOIN user_campaign uc ON uc.user_id=sub.user_id
            GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
        ");
        $stmt->execute($allUserIds);
        $secondInternshipMap = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $secondInternshipMap[$r['campaign']] = (int)$r['second_internships'];
        }

        // Comparison DB queries
        $registrationsMapCompare    = [];
        $examMapCompare             = [];
        $internshipMapCompare       = [];
        $revenueMapCompare          = [];
        $secondInternshipMapCompare = [];
        if ($isComparison && !empty($allUserIdsCompare)) {
            $phC = implode(',', array_fill(0, count($allUserIdsCompare), '?'));

            $stmt = $pdo->prepare("
                SELECT user_id, COALESCE(NULLIF(TRIM(campaign),''),'Direct/Unknown') as campaign
                FROM user_campaign WHERE user_id IN ($phC)
            ");
            $stmt->execute($allUserIdsCompare);
            $uMapC = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $uMapC[$r['campaign']][] = $r['user_id'];
                $registrationsMapCompare[$r['campaign']] = count(array_unique($uMapC[$r['campaign']]));
            }

            $stmt = $pdo->prepare("
                SELECT DISTINCT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign, cr.user_id
                FROM cit_results cr
                LEFT JOIN user_campaign uc ON uc.user_id=cr.user_id
                WHERE cr.user_id IN ($phC)
            ");
            $stmt->execute($allUserIdsCompare);
            $eMapC = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $eMapC[$r['campaign']][] = $r['user_id'];
                $examMapCompare[$r['campaign']] = count(array_unique($eMapC[$r['campaign']]));
            }

            $stmt = $pdo->prepare("
                SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
                       COUNT(DISTINCT ps.user_id) AS internships,
                       COALESCE(SUM(ps.amount),0) AS revenue
                FROM payment_status ps
                LEFT JOIN user_campaign uc ON uc.user_id=ps.user_id
                WHERE ps.status='success' AND ps.user_id IN ($phC)
                GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
            ");
            $stmt->execute($allUserIdsCompare);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $internshipMapCompare[$r['campaign']] = (int)$r['internships'];
                $revenueMapCompare[$r['campaign']]    = (float)$r['revenue'];
            }

            $stmt = $pdo->prepare("
                SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as campaign,
                       COUNT(DISTINCT sub.user_id) AS second_internships
                FROM (
                    SELECT user_id FROM payment_status
                    WHERE status='success' AND user_id IN ($phC)
                    GROUP BY user_id HAVING COUNT(*)>=2
                ) sub
                LEFT JOIN user_campaign uc ON uc.user_id=sub.user_id
                GROUP BY COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown')
            ");
            $stmt->execute($allUserIdsCompare);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $secondInternshipMapCompare[$r['campaign']] = (int)$r['second_internships'];
            }
        }

        // Build processed data WITH real delivery / event
        $processedData = [];
        foreach ($campaignGroups as $campaign => $data) {
            $spend            = $data['spend'];
            $registrations    = $registrationsMap[$campaign]     ?? 0;
            $examCount        = $examMap[$campaign]              ?? 0;
            $internshipCount  = $internshipMap[$campaign]        ?? 0;
            $revenue          = $revenueMap[$campaign]           ?? 0;
            $secondInternship = $secondInternshipMap[$campaign]  ?? 0;

            $costPerReg        = $registrations   > 0 ? $spend / $registrations   : 0;
            $costPerExam       = $examCount       > 0 ? $spend / $examCount       : 0;
            $costPerInternship = $internshipCount > 0 ? $spend / $internshipCount : 0;
            $roi               = $spend > 0 ? ($revenue / $spend) : 0;
            $rpu               = $registrations > 0 ? $revenue / $registrations : 0;

            $userIds = isset($userIdsMap[$campaign])
                ? implode(',', array_unique($userIdsMap[$campaign])) : '';

            $rowData = [
                'campaign_name'         => $campaign,
                'delivery_status'       => $campaignStatusMap[$campaign] ?? 'UNKNOWN',
                'conversion_event'      => $campaignEventMap[$data['campaign_id'] ?? ''] ?? 'UNKNOWN',
                'user_ids'              => $userIds,
                'date_start'            => $data['date_start'],
                'date_stop'             => $data['date_stop'],
                'spend'                 => $spend,
                'impressions'           => $data['impressions'],
                'clicks'                => $data['clicks'],
                'reach'                 => $data['reach'],
                'registrations'         => $registrations,
                'cost_per_registration' => round($costPerReg, 2),
                'exam_count'            => $examCount,
                'cost_per_exam'         => round($costPerExam, 2),
                'internship_count'      => $internshipCount,
                'second_internship'     => $secondInternship,
                'cost_per_internship'   => round($costPerInternship, 2),
                'revenue'               => round($revenue, 2),
                'roi'                   => round($roi, 2),
                'has_meta_data'         => true,
                'rpu'                   => round($rpu, 2),
                'cac_all'               => round($costPerReg, 2),
                'cac_paid'              => round($costPerInternship, 2),
                'roas'                  => round($roi, 2),
            ];

            if ($isComparison) {
                $cData   = $campaignGroupsCompare[$campaign] ?? null;
                $cSpend  = $cData ? $cData['spend'] : 0;
                $cReg    = $registrationsMapCompare[$campaign]    ?? 0;
                $cExam   = $examMapCompare[$campaign]              ?? 0;
                $cIntern = $internshipMapCompare[$campaign]        ?? 0;
                $cRev    = $revenueMapCompare[$campaign]           ?? 0;
                $cSecond = $secondInternshipMapCompare[$campaign]  ?? 0;

                $rowData['compare_spend']                 = $cSpend;
                $rowData['compare_impressions']           = $cData ? $cData['impressions'] : 0;
                $rowData['compare_clicks']                = $cData ? $cData['clicks']      : 0;
                $rowData['compare_reach']                 = $cData ? $cData['reach']       : 0;
                $rowData['compare_registrations']         = $cReg;
                $rowData['compare_cost_per_registration'] = $cReg    > 0 ? round($cSpend/$cReg,2)    : 0;
                $rowData['compare_exam_count']            = $cExam;
                $rowData['compare_cost_per_exam']         = $cExam   > 0 ? round($cSpend/$cExam,2)   : 0;
                $rowData['compare_internship_count']      = $cIntern;
                $rowData['compare_second_internship']     = $cSecond;
                $rowData['compare_cost_per_internship']   = $cIntern > 0 ? round($cSpend/$cIntern,2) : 0;
                $rowData['compare_revenue']               = round($cRev, 2);
                $rowData['compare_roi']                   = $cSpend  > 0 ? round($cRev/$cSpend,2)    : 0;
                $rowData['compare_rpu']                   = $cReg    > 0 ? round($cRev/$cReg,2)      : 0;
                $rowData['compare_cac_all']               = $cReg    > 0 ? round($cSpend/$cReg,2)    : 0;
                $rowData['compare_cac_paid']              = $cIntern > 0 ? round($cSpend/$cIntern,2) : 0;
                $rowData['compare_roas']                  = $cSpend  > 0 ? round($cRev/$cSpend,2)    : 0;
            }

            $processedData[] = $rowData;
        }

        // Campaigns without Meta spend
        foreach ($registrationsMap as $campaign => $regCount) {
            if (isset($campaignGroups[$campaign])) continue;
            $examCount        = $examMap[$campaign]             ?? 0;
            $internshipCount  = $internshipMap[$campaign]       ?? 0;
            $revenue          = $revenueMap[$campaign]          ?? 0;
            $secondInternship = $secondInternshipMap[$campaign] ?? 0;
            $userIds = isset($userIdsMap[$campaign])
                ? implode(',', array_unique($userIdsMap[$campaign])) : '';

            $processedData[] = [
                'campaign_name'         => $campaign,
                'delivery_status'       => 'UNKNOWN',
                'conversion_event'      => 'UNKNOWN',
                'user_ids'              => $userIds,
                'date_start'            => $fromDate,
                'date_stop'             => $toDate,
                'spend'                 => 0,
                'impressions'           => 0,
                'clicks'                => 0,
                'reach'                 => 0,
                'registrations'         => $regCount,
                'cost_per_registration' => 0,
                'exam_count'            => $examCount,
                'cost_per_exam'         => 0,
                'internship_count'      => $internshipCount,
                'second_internship'     => $secondInternship,
                'cost_per_internship'   => 0,
                'revenue'               => round($revenue, 2),
                'roi'                   => 0,
                'has_meta_data'         => false,
                'rpu'                   => 0,
                'cac_all'               => 0,
                'cac_paid'              => 0,
                'roas'                  => 0,
            ];
        }

        usort($processedData, function($a, $b) {
            if ($a['campaign_name'] === 'Direct/Unknown') return -1;
            if ($b['campaign_name'] === 'Direct/Unknown') return 1;
            return 0;
        });

        jsonOut([
            'success'       => true,
            'data'          => $processedData,
            'meta_raw'      => $allMetaRaw,
            'is_comparison' => $isComparison,
        ]);

    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ==========================================================================
   VERSION-WISE ANALYSIS HELPERS (per PDF spec)
   ========================================================================== */

/**
 * In-memory request-scoped cache for version metrics (per request lifetime).
 * Also uses $_SESSION for cross-request cache.
 */
function vaCacheKey($versionName, $level, $filters) {
    return md5($versionName . '|' . $level . '|' . json_encode($filters));
}
function vaCacheGet($key) {
    // request-scoped first
    if (isset($GLOBALS['__VA_CACHE'][$key])) return $GLOBALS['__VA_CACHE'][$key];
    // session cache (~5 min TTL)
    if (isset($_SESSION['__VA_CACHE'][$key])) {
        $entry = $_SESSION['__VA_CACHE'][$key];
        if ((time() - $entry['t']) < 300) {
            $GLOBALS['__VA_CACHE'][$key] = $entry['v'];
            return $entry['v'];
        }
    }
    return null;
}
function vaCacheSet($key, $value) {
    $GLOBALS['__VA_CACHE'][$key] = $value;
    if (!isset($_SESSION['__VA_CACHE'])) $_SESSION['__VA_CACHE'] = [];
    $_SESSION['__VA_CACHE'][$key] = ['t' => time(), 'v' => $value];
    // cap session cache size
    if (count($_SESSION['__VA_CACHE']) > 300) {
        // drop oldest half
        uasort($_SESSION['__VA_CACHE'], function($a, $b) { return $a['t'] - $b['t']; });
        $_SESSION['__VA_CACHE'] = array_slice($_SESSION['__VA_CACHE'], -150, null, true);
    }
}

/**
 * Get the date range for a CIT version from exam_batch_for_reports.
 * Matches the existing +1 day logic from get_date_range.
 */
function getVersionDateRange($pdo, $versionName) {
    static $cache = [];
    if (isset($cache[$versionName])) return $cache[$versionName];

    $stmt = $pdo->prepare("SELECT from_date, to_date FROM exam_batch_for_reports WHERE exam_name = ? LIMIT 1");
    $stmt->execute([$versionName]);
    $dates = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$dates) { $cache[$versionName] = null; return null; }
    $r = [
        'from' => date('Y-m-d', strtotime($dates['from_date'] . ' +1 day')),
        'to'   => $dates['to_date'],
    ];
    $cache[$versionName] = $r;
    return $r;
}

/**
 * Fetch Meta Ads insights (ad level) for a date range, with pagination.
 */
function fetchMetaInsightsForRange($from, $to) {
    global $ACCESS_TOKEN;
    static $memo = [];
    $memoKey = $from . '|' . $to;
    if (isset($memo[$memoKey])) return $memo[$memoKey];

    $fields = ['ad_id','campaign_id','campaign_name','adset_name','ad_name',
               'spend','impressions','clicks','reach'];
    $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
           '/insights?level=ad&fields=' . implode(',', $fields) .
           '&time_range={"since":"' . $from . '","until":"' . $to . '"}' .
           '&limit=500&access_token=' . $ACCESS_TOKEN;

    $allRows = [];
    $safety  = 0;
    while ($url && $safety < 50) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        $resp = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($resp, true);
        if (isset($data['error'])) { $memo[$memoKey] = ['error' => $data['error']['message'] ?? 'Meta error']; return $memo[$memoKey]; }

        $allRows = array_merge($allRows, $data['data'] ?? []);
        $url     = $data['paging']['next'] ?? null;
        $safety++;
    }
    $memo[$memoKey] = $allRows;
    return $allRows;
}

/**
 * PARALLEL fetch Meta insights for multiple date ranges at once using curl_multi.
 * Returns [ "from|to" => rowsArray, ... ]
 * Falls back gracefully on error (returns empty array for that range).
 */
function fetchMetaInsightsParallel($ranges) {
    global $ACCESS_TOKEN;

    // Check memoization first
    $result = [];
    $todo = [];
    foreach ($ranges as $r) {
        $k = $r['from'] . '|' . $r['to'];
        if (isset($GLOBALS['__VA_INSIGHTS_MEMO'][$k])) {
            $result[$k] = $GLOBALS['__VA_INSIGHTS_MEMO'][$k];
        } else {
            $todo[] = $r;
        }
    }
    if (empty($todo)) return $result;

    $fields = 'ad_id,campaign_id,campaign_name,adset_name,ad_name,spend,impressions,clicks,reach';
    $mh = curl_multi_init();
    $handles = [];

    foreach ($todo as $r) {
        $k = $r['from'] . '|' . $r['to'];
        $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID .
               '/insights?level=ad&fields=' . $fields .
               '&time_range={"since":"' . $r['from'] . '","until":"' . $r['to'] . '"}' .
               '&limit=500&access_token=' . $ACCESS_TOKEN;

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 45);
        curl_multi_add_handle($mh, $ch);
        $handles[$k] = $ch;
    }

    // Execute all in parallel
    $running = null;
    do {
        curl_multi_exec($mh, $running);
        curl_multi_select($mh);
    } while ($running > 0);

    // Collect page 1 results + any paging URLs
    $pagingUrls = [];
    foreach ($handles as $k => $ch) {
        $resp = curl_multi_getcontent($ch);
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
        $data = json_decode($resp, true);
        $rows = ($data && isset($data['data'])) ? $data['data'] : [];
        $result[$k] = $rows;
        $next = $data['paging']['next'] ?? null;
        if ($next) $pagingUrls[$k] = $next;
    }

    // Chase paging (also in parallel, one round at a time)
    $safety = 0;
    while (!empty($pagingUrls) && $safety < 20) {
        $handles = [];
        foreach ($pagingUrls as $k => $url) {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 45);
            curl_multi_add_handle($mh, $ch);
            $handles[$k] = $ch;
        }
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh);
        } while ($running > 0);

        $newPagingUrls = [];
        foreach ($handles as $k => $ch) {
            $resp = curl_multi_getcontent($ch);
            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
            $data = json_decode($resp, true);
            if ($data && isset($data['data'])) {
                $result[$k] = array_merge($result[$k], $data['data']);
            }
            $next = $data['paging']['next'] ?? null;
            if ($next) $newPagingUrls[$k] = $next;
        }
        $pagingUrls = $newPagingUrls;
        $safety++;
    }

    curl_multi_close($mh);

    // Memoize for the rest of this request
    foreach ($result as $k => $rows) {
        $GLOBALS['__VA_INSIGHTS_MEMO'][$k] = $rows;
    }
    return $result;
}

/**
 * For a given CIT version and level (campaign/adset/ad), compute all 6 metrics.
 * Returns a map: { entity_name => metrics_array }
 *
 * Metrics (per PDF):
 *   CPM           = (Spend / Impressions) * 1000
 *   CPC           = Spend / Clicks
 *   CTR           = (Clicks / Impressions) * 100
 *   CPL           = Spend / Registrations
 *   Cost Per Exam = Spend / Exams
 *   ROI           = Revenue / Spend
 */
function computeVersionMetrics($pdo, $versionName, $level, $filters = []) {
    // Cache check
    $ckey = vaCacheKey($versionName, $level, $filters);
    $cached = vaCacheGet($ckey);
    if ($cached !== null) return $cached;

    $range = getVersionDateRange($pdo, $versionName);
    if (!$range) { vaCacheSet($ckey, []); return []; }

    $from = $range['from'];
    $to   = $range['to'];

    $insights = fetchMetaInsightsForRange($from, $to);
    if (isset($insights['error'])) { vaCacheSet($ckey, []); return []; }

    // Filter insights by campaign/adset if specified
    if (isset($filters['campaign']) && $filters['campaign'] !== '') {
        $fc = $filters['campaign'];
        $insights = array_values(array_filter($insights, function($r) use ($fc) {
            return trim($r['campaign_name'] ?? '') === $fc;
        }));
    }
    if (isset($filters['adset']) && $filters['adset'] !== '') {
        $fa = $filters['adset'];
        $insights = array_values(array_filter($insights, function($r) use ($fa) {
            return trim($r['adset_name'] ?? '') === $fa;
        }));
    }

    // Group by the requested level
    $groups = [];
    foreach ($insights as $r) {
        $key = '';
        if ($level === 'campaign') $key = trim($r['campaign_name'] ?? '');
        elseif ($level === 'adset') $key = trim($r['adset_name'] ?? '');
        elseif ($level === 'ad')    $key = trim($r['ad_name'] ?? '');
        if ($key === '') continue;

        if (!isset($groups[$key])) {
            $groups[$key] = [
                'campaign_name' => $r['campaign_name'] ?? '',
                'campaign_id'   => $r['campaign_id']   ?? '',
                'adset_name'    => $r['adset_name']    ?? '',
                'ad_name'       => $r['ad_name']       ?? '',
                'spend'         => 0,
                'impressions'   => 0,
                'clicks'        => 0,
                'reach'         => 0,
            ];
        }
        $groups[$key]['spend']       += (float)($r['spend']       ?? 0);
        $groups[$key]['impressions'] += (int)  ($r['impressions'] ?? 0);
        $groups[$key]['clicks']      += (int)  ($r['clicks']      ?? 0);
        $groups[$key]['reach']       += (int)  ($r['reach']       ?? 0);
    }

    // Pull DB registrations / exams / revenue for users registered in this version's date range
    // Memoize the user-id list (per version) so multiple level calls share it
    static $userCache = [];
    $ucKey = $from . '|' . $to;
    if (!isset($userCache[$ucKey])) {
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
        $stmt->execute([$from . ' 00:00:00', $to . ' 23:59:59']);
        $userCache[$ucKey] = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
    $userIds = $userCache[$ucKey];

    $regMap = [];
    $examMap = [];
    $revenueMap = [];

    if (!empty($userIds)) {
        $ph = implode(',', array_fill(0, count($userIds), '?'));

        $groupField = $level === 'campaign' ? 'uc.campaign'
                    : ($level === 'adset'    ? 'uc.adset'
                                             : 'uc.ad');

        // Registrations
        $sql = "SELECT COALESCE(NULLIF(TRIM($groupField),''),'Direct/Unknown') as name,
                       COUNT(DISTINCT uc.user_id) as c
                FROM user_campaign uc
                WHERE uc.user_id IN ($ph)
                GROUP BY COALESCE(NULLIF(TRIM($groupField),''),'Direct/Unknown')";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($userIds);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $regMap[$r['name']] = (int)$r['c'];
        }

        // Exams
        $sql = "SELECT COALESCE(NULLIF(TRIM($groupField),''),'Direct/Unknown') as name,
                       COUNT(DISTINCT cr.user_id) as c
                FROM cit_results cr
                LEFT JOIN user_campaign uc ON uc.user_id = cr.user_id
                WHERE cr.user_id IN ($ph)
                GROUP BY COALESCE(NULLIF(TRIM($groupField),''),'Direct/Unknown')";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($userIds);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $examMap[$r['name']] = (int)$r['c'];
        }

        // Revenue
        $sql = "SELECT COALESCE(NULLIF(TRIM($groupField),''),'Direct/Unknown') as name,
                       COALESCE(SUM(ps.amount),0) as rev
                FROM payment_status ps
                LEFT JOIN user_campaign uc ON uc.user_id = ps.user_id
                WHERE ps.status='success' AND ps.user_id IN ($ph)
                GROUP BY COALESCE(NULLIF(TRIM($groupField),''),'Direct/Unknown')";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($userIds);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $revenueMap[$r['name']] = (float)$r['rev'];
        }
    }

    // Build metrics per entity
    $result = [];
    foreach ($groups as $key => $g) {
        $spend  = $g['spend'];
        $imp    = $g['impressions'];
        $clicks = $g['clicks'];
        $reg    = $regMap[$key]     ?? 0;
        $exam   = $examMap[$key]    ?? 0;
        $rev    = $revenueMap[$key] ?? 0;

        $result[$key] = [
            'spend'         => round($spend, 2),
            'impressions'   => $imp,
            'clicks'        => $clicks,
            'reach'         => $g['reach'],
            'registrations' => $reg,
            'exams'         => $exam,
            'revenue'       => round($rev, 2),

            'cpm'           => $imp    > 0 ? round(($spend / $imp) * 1000, 2) : 0,
            'cpc'           => $clicks > 0 ? round($spend / $clicks, 2)       : 0,
            'ctr'           => $imp    > 0 ? round(($clicks / $imp) * 100, 2) : 0,
            'cpl'           => $reg    > 0 ? round($spend / $reg, 2)          : 0,
            'cost_per_exam' => $exam   > 0 ? round($spend / $exam, 2)         : 0,
            'roi'           => $spend  > 0 ? round($rev / $spend, 4)          : 0,

            'campaign_name' => $g['campaign_name'],
            'campaign_id'   => $g['campaign_id'],
            'adset_name'    => $g['adset_name'],
            'ad_name'       => $g['ad_name'],
            'from_date'     => $from,
            'to_date'       => $to,
        ];
    }

    vaCacheSet($ckey, $result);
    return $result;
}

/* ==========================================================================
   ACTION: fetch_version_analysis  (campaign-level, all selected versions)
   Input:  versions (JSON array of CIT version names)
   Output: { campaigns: [ { campaign_name, delivery_status, conversion_event,
                            versions: [ { version, cpm, cpc, ctr, cpl,
                                          cost_per_exam, roi, ... } ] } ] }
   ========================================================================== */
if ($action === 'fetch_version_analysis') {

    $versions = json_decode($_POST['versions'] ?? '[]', true);
    if (!is_array($versions) || empty($versions)) {
        jsonOut(['success' => false, 'message' => 'No versions provided']);
    }

    $ACCESS_TOKEN = getMetaToken($pdo);
    $GLOBALS['ACCESS_TOKEN'] = $ACCESS_TOKEN;
    if (!$ACCESS_TOKEN) {
        jsonOut(['success' => false, 'token_expired' => true, 'message' => 'Meta Access Token Missing']);
    }

    try {
        // ===== PARALLEL PREFETCH =====
        // Fire off all per-version Meta insight calls in parallel so subsequent
        // computeVersionMetrics() calls hit the memo instead of serial HTTP.
        $rangesToFetch = [];
        foreach ($versions as $v) {
            $r = getVersionDateRange($pdo, $v);
            if ($r) $rangesToFetch[] = $r;
        }
        if (!empty($rangesToFetch)) {
            fetchMetaInsightsParallel($rangesToFetch);
        }

        // Status + event maps (fetched once, current snapshot)
        $adsFromMeta    = fetchAdsFromMeta();
        $adsetsFromMeta = fetchAdsetsFromMeta();
        $eventMap       = buildCampaignEventMap($adsetsFromMeta);

        // Per-version campaign metrics (now fast - insights are in memo)
        $versionMetrics = [];
        foreach ($versions as $v) {
            $versionMetrics[$v] = computeVersionMetrics($pdo, $v, 'campaign');
        }

        // Build delivery-status map using the first selected version's insights
        $statusMap = [];
        if (!empty($versions)) {
            $firstRange = getVersionDateRange($pdo, $versions[0]);
            if ($firstRange) {
                $firstInsights = fetchMetaInsightsForRange($firstRange['from'], $firstRange['to']);
                if (!isset($firstInsights['error'])) {
                    $statusMap = buildCampaignStatusMap($adsFromMeta, $firstInsights);
                }
            }
        }

        // Collect all unique campaigns across versions
        $allCampaigns = [];
        foreach ($versionMetrics as $v => $metrics) {
            foreach ($metrics as $cname => $m) {
                if (!isset($allCampaigns[$cname])) {
                    $allCampaigns[$cname] = [
                        'campaign_name' => $cname,
                        'campaign_id'   => $m['campaign_id'] ?? '',
                    ];
                }
            }
        }

        // Build response: campaigns -> versions array
        $campaigns = [];
        foreach ($allCampaigns as $cname => $info) {
            $versionsData = [];
            foreach ($versions as $v) {
                if (isset($versionMetrics[$v][$cname])) {
                    $m = $versionMetrics[$v][$cname];
                    $versionsData[] = [
                        'version'       => $v,
                        'no_data'       => false,
                        'cpm'           => $m['cpm'],
                        'cpc'           => $m['cpc'],
                        'ctr'           => $m['ctr'],
                        'cpl'           => $m['cpl'],
                        'cost_per_exam' => $m['cost_per_exam'],
                        'roi'           => $m['roi'],
                        'spend'         => $m['spend'],
                        'impressions'   => $m['impressions'],
                        'clicks'        => $m['clicks'],
                        'registrations' => $m['registrations'],
                        'exams'         => $m['exams'],
                        'revenue'       => $m['revenue'],
                        'from_date'     => $m['from_date'],
                        'to_date'       => $m['to_date'],
                    ];
                } else {
                    $versionsData[] = ['version' => $v, 'no_data' => true];
                }
            }

            $campaigns[] = [
                'campaign_name'    => $cname,
                'campaign_id'      => $info['campaign_id'],
                'delivery_status'  => $statusMap[$cname] ?? 'UNKNOWN',
                'conversion_event' => $eventMap[$info['campaign_id']] ?? 'UNKNOWN',
                'versions'         => $versionsData,
            ];
        }

        // Direct/Unknown first, then alphabetical
        usort($campaigns, function($a, $b) {
            if ($a['campaign_name'] === 'Direct/Unknown') return -1;
            if ($b['campaign_name'] === 'Direct/Unknown') return 1;
            return strcmp($a['campaign_name'], $b['campaign_name']);
        });

        jsonOut([
            'success'   => true,
            'versions'  => $versions,
            'campaigns' => $campaigns,
        ]);

    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ==========================================================================
   ACTION: fetch_version_analysis_adsets  (lazy, per campaign)
   Input:  versions (JSON array), campaign_name
   Output: { adsets: [ { adset_name, versions: [...] } ] }
   ========================================================================== */
if ($action === 'fetch_version_analysis_adsets') {

    $versions     = json_decode($_POST['versions'] ?? '[]', true);
    $campaignName = $_POST['campaign_name'] ?? '';

    if (!is_array($versions) || empty($versions) || $campaignName === '') {
        jsonOut(['success' => false, 'message' => 'Missing params']);
    }

    $ACCESS_TOKEN = getMetaToken($pdo);
    $GLOBALS['ACCESS_TOKEN'] = $ACCESS_TOKEN;
    if (!$ACCESS_TOKEN) {
        jsonOut(['success' => false, 'token_expired' => true]);
    }

    try {
        // Parallel prefetch
        $rangesToFetch = [];
        foreach ($versions as $v) {
            $r = getVersionDateRange($pdo, $v);
            if ($r) $rangesToFetch[] = $r;
        }
        if (!empty($rangesToFetch)) {
            fetchMetaInsightsParallel($rangesToFetch);
        }

        $versionMetrics = [];
        foreach ($versions as $v) {
            $versionMetrics[$v] = computeVersionMetrics(
                $pdo, $v, 'adset', ['campaign' => $campaignName]
            );
        }

        $allAdsets = [];
        foreach ($versionMetrics as $v => $metrics) {
            foreach ($metrics as $aname => $m) {
                if (!isset($allAdsets[$aname])) $allAdsets[$aname] = true;
            }
        }

        $adsets = [];
        foreach ($allAdsets as $aname => $_) {
            $versionsData = [];
            foreach ($versions as $v) {
                if (isset($versionMetrics[$v][$aname])) {
                    $m = $versionMetrics[$v][$aname];
                    $versionsData[] = [
                        'version'       => $v,
                        'no_data'       => false,
                        'cpm'           => $m['cpm'],
                        'cpc'           => $m['cpc'],
                        'ctr'           => $m['ctr'],
                        'cpl'           => $m['cpl'],
                        'cost_per_exam' => $m['cost_per_exam'],
                        'roi'           => $m['roi'],
                        'spend'         => $m['spend'],
                        'impressions'   => $m['impressions'],
                        'clicks'        => $m['clicks'],
                        'registrations' => $m['registrations'],
                        'exams'         => $m['exams'],
                        'revenue'       => $m['revenue'],
                    ];
                } else {
                    $versionsData[] = ['version' => $v, 'no_data' => true];
                }
            }
            $adsets[] = [
                'adset_name'    => $aname,
                'campaign_name' => $campaignName,
                'versions'      => $versionsData,
            ];
        }

        usort($adsets, function($a, $b) {
            return strcmp($a['adset_name'], $b['adset_name']);
        });

        jsonOut(['success' => true, 'adsets' => $adsets]);

    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ==========================================================================
   ACTION: fetch_version_analysis_ads  (lazy, per adset)
   Input:  versions (JSON array), campaign_name, adset_name
   Output: { ads: [ { ad_name, versions: [...] } ] }
   ========================================================================== */
if ($action === 'fetch_version_analysis_ads') {

    $versions     = json_decode($_POST['versions'] ?? '[]', true);
    $campaignName = $_POST['campaign_name'] ?? '';
    $adsetName    = $_POST['adset_name']    ?? '';

    if (!is_array($versions) || empty($versions) || $campaignName === '' || $adsetName === '') {
        jsonOut(['success' => false, 'message' => 'Missing params']);
    }

    $ACCESS_TOKEN = getMetaToken($pdo);
    $GLOBALS['ACCESS_TOKEN'] = $ACCESS_TOKEN;
    if (!$ACCESS_TOKEN) {
        jsonOut(['success' => false, 'token_expired' => true]);
    }

    try {
        // Parallel prefetch
        $rangesToFetch = [];
        foreach ($versions as $v) {
            $r = getVersionDateRange($pdo, $v);
            if ($r) $rangesToFetch[] = $r;
        }
        if (!empty($rangesToFetch)) {
            fetchMetaInsightsParallel($rangesToFetch);
        }

        $versionMetrics = [];
        foreach ($versions as $v) {
            $versionMetrics[$v] = computeVersionMetrics(
                $pdo, $v, 'ad',
                ['campaign' => $campaignName, 'adset' => $adsetName]
            );
        }

        $allAds = [];
        foreach ($versionMetrics as $v => $metrics) {
            foreach ($metrics as $adname => $m) {
                if (!isset($allAds[$adname])) $allAds[$adname] = true;
            }
        }

        $ads = [];
        foreach ($allAds as $adname => $_) {
            $versionsData = [];
            foreach ($versions as $v) {
                if (isset($versionMetrics[$v][$adname])) {
                    $m = $versionMetrics[$v][$adname];
                    $versionsData[] = [
                        'version'       => $v,
                        'no_data'       => false,
                        'cpm'           => $m['cpm'],
                        'cpc'           => $m['cpc'],
                        'ctr'           => $m['ctr'],
                        'cpl'           => $m['cpl'],
                        'cost_per_exam' => $m['cost_per_exam'],
                        'roi'           => $m['roi'],
                        'spend'         => $m['spend'],
                        'impressions'   => $m['impressions'],
                        'clicks'        => $m['clicks'],
                        'registrations' => $m['registrations'],
                        'exams'         => $m['exams'],
                        'revenue'       => $m['revenue'],
                    ];
                } else {
                    $versionsData[] = ['version' => $v, 'no_data' => true];
                }
            }
            $ads[] = [
                'ad_name'       => $adname,
                'adset_name'    => $adsetName,
                'campaign_name' => $campaignName,
                'versions'      => $versionsData,
            ];
        }

        usort($ads, function($a, $b) {
            return strcmp($a['ad_name'], $b['ad_name']);
        });

        jsonOut(['success' => true, 'ads' => $ads]);

    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ==========================================================================
   NOTES FEATURE (Version Analysis Remark column)
   Tables required:
     - meta_version_notes
     - meta_version_notes_history
   See meta_version_notes_schema.sql for CREATE TABLE statements.
   ========================================================================== */

/* ----- fetch_notes: bulk fetch notes for a list of entities ------------
   Input entities can be either:
     - {type, name}                     (legacy, fetches all versions/types)
     - {type, name, version, note_type} (scoped, recommended)
   Returns grouped map keyed by "type|||name|||version|||note_type"
   -------------------------------------------------------------------- */
if ($action === 'fetch_notes') {
    $entitiesRaw = $_POST['entities'] ?? '[]';
    $entities = json_decode($entitiesRaw, true);
    if (!is_array($entities) || empty($entities)) {
        jsonOut(['success' => true, 'notes' => new stdClass()]);
    }

    // Build condition blocks
    $conds  = [];
    $params = [];
    foreach ($entities as $e) {
        $t = $e['type'] ?? '';
        $n = $e['name'] ?? '';
        if (!in_array($t, ['campaign','adset','ad']) || $n === '') continue;

        $hasVersion = isset($e['version']) && $e['version'] !== '';
        $hasType    = isset($e['note_type']) && in_array($e['note_type'], ['remark1','remark2']);

        if ($hasVersion && $hasType) {
            $conds[]  = '(entity_type = ? AND entity_name = ? AND version_name = ? AND note_type = ?)';
            $params[] = $t; $params[] = $n;
            $params[] = $e['version']; $params[] = $e['note_type'];
        } elseif ($hasVersion) {
            $conds[]  = '(entity_type = ? AND entity_name = ? AND version_name = ?)';
            $params[] = $t; $params[] = $n; $params[] = $e['version'];
        } else {
            $conds[]  = '(entity_type = ? AND entity_name = ?)';
            $params[] = $t; $params[] = $n;
        }
    }
    if (empty($conds)) {
        jsonOut(['success' => true, 'notes' => new stdClass()]);
    }

    try {
        $sql = "SELECT id, entity_type, entity_name, version_name, note_type,
                       user_id, user_name, note, created_at, updated_at
                FROM meta_version_notes
                WHERE " . implode(' OR ', $conds) . "
                ORDER BY updated_at DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        // Group by 4-part key: type|||name|||version|||note_type
        $grouped = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $key = $row['entity_type'] . '|||' . $row['entity_name']
                 . '|||' . $row['version_name'] . '|||' . $row['note_type'];
            if (!isset($grouped[$key])) $grouped[$key] = [];
            $grouped[$key][] = [
                'id'           => (int)$row['id'],
                'user_id'      => (int)$row['user_id'],
                'user_name'    => $row['user_name'],
                'note'         => $row['note'],
                'version_name' => $row['version_name'],
                'note_type'    => $row['note_type'],
                'created_at'   => $row['created_at'],
                'updated_at'   => $row['updated_at'],
            ];
        }
        jsonOut(['success' => true, 'notes' => empty($grouped) ? new stdClass() : $grouped]);
    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ----- save_note: create or update the current user's note on an entity ----- */
if ($action === 'save_note') {
    $entityType     = $_POST['entity_type']     ?? '';
    $entityName     = trim($_POST['entity_name'] ?? '');
    $versionName    = trim($_POST['version_name'] ?? '');
    $noteType       = $_POST['note_type']       ?? 'remark1';
    $parentCampaign = trim($_POST['parent_campaign'] ?? '');
    $parentAdset    = trim($_POST['parent_adset']    ?? '');
    $userId         = intval($_POST['user_id']  ?? 0);
    $userName       = trim($_POST['user_name']  ?? '');
    $note           = trim($_POST['note']       ?? '');

    if (!in_array($entityType, ['campaign','adset','ad'])) {
        jsonOut(['success' => false, 'message' => 'Invalid entity_type']);
    }
    if (!in_array($noteType, ['remark1','remark2'])) {
        jsonOut(['success' => false, 'message' => 'Invalid note_type']);
    }
    if ($entityName === '')  jsonOut(['success' => false, 'message' => 'entity_name required']);
    if ($versionName === '') jsonOut(['success' => false, 'message' => 'version_name required']);
    if ($userId === 0)       jsonOut(['success' => false, 'message' => 'user_id required']);
    if ($userName === '')    $userName = 'User #' . $userId;

    try {
        // Is there an existing note by this user on this entity+version+type?
        $s = $pdo->prepare(
            "SELECT id, note FROM meta_version_notes
             WHERE entity_type = ? AND entity_name = ?
               AND version_name = ? AND note_type = ? AND user_id = ?
             LIMIT 1"
        );
        $s->execute([$entityType, $entityName, $versionName, $noteType, $userId]);
        $existing = $s->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $existingId = (int)$existing['id'];
            $oldNote    = $existing['note'];

            if ($note === '') {
                // Delete
                $pdo->prepare("DELETE FROM meta_version_notes WHERE id = ?")
                    ->execute([$existingId]);
                $h = $pdo->prepare(
                    "INSERT INTO meta_version_notes_history
                     (note_id, entity_type, entity_name, version_name, note_type,
                      user_id, user_name, action, old_note, new_note)
                     VALUES (?,?,?,?,?,?,?,?,?,?)"
                );
                $h->execute([
                    $existingId, $entityType, $entityName, $versionName, $noteType,
                    $userId, $userName, 'delete', $oldNote, null
                ]);
                jsonOut([
                    'success' => true, 'deleted' => true,
                    'note_id' => $existingId,
                    'entity_type' => $entityType, 'entity_name' => $entityName,
                    'version_name' => $versionName, 'note_type' => $noteType,
                ]);
            }

            // Update
            $upd = $pdo->prepare("UPDATE meta_version_notes SET note = ?, user_name = ? WHERE id = ?");
            $upd->execute([$note, $userName, $existingId]);

            $h = $pdo->prepare(
                "INSERT INTO meta_version_notes_history
                 (note_id, entity_type, entity_name, version_name, note_type,
                  user_id, user_name, action, old_note, new_note)
                 VALUES (?,?,?,?,?,?,?,?,?,?)"
            );
            $h->execute([
                $existingId, $entityType, $entityName, $versionName, $noteType,
                $userId, $userName, 'update', $oldNote, $note
            ]);

            jsonOut([
                'success'      => true,
                'note_id'      => $existingId,
                'entity_type'  => $entityType,
                'entity_name'  => $entityName,
                'version_name' => $versionName,
                'note_type'    => $noteType,
                'user_id'      => $userId,
                'user_name'    => $userName,
                'note'         => $note,
            ]);
        }

        // Create new
        if ($note === '') {
            jsonOut(['success' => true, 'noop' => true]);
        }

        $ins = $pdo->prepare(
            "INSERT INTO meta_version_notes
             (entity_type, entity_name, version_name, note_type,
              parent_campaign, parent_adset, user_id, user_name, note)
             VALUES (?,?,?,?,?,?,?,?,?)"
        );
        $ins->execute([
            $entityType, $entityName, $versionName, $noteType,
            $parentCampaign !== '' ? $parentCampaign : null,
            $parentAdset    !== '' ? $parentAdset    : null,
            $userId, $userName, $note,
        ]);
        $newId = (int)$pdo->lastInsertId();

        $h = $pdo->prepare(
            "INSERT INTO meta_version_notes_history
             (note_id, entity_type, entity_name, version_name, note_type,
              user_id, user_name, action, old_note, new_note)
             VALUES (?,?,?,?,?,?,?,?,?,?)"
        );
        $h->execute([
            $newId, $entityType, $entityName, $versionName, $noteType,
            $userId, $userName, 'create', null, $note
        ]);

        jsonOut([
            'success'      => true,
            'note_id'      => $newId,
            'entity_type'  => $entityType,
            'entity_name'  => $entityName,
            'version_name' => $versionName,
            'note_type'    => $noteType,
            'user_id'      => $userId,
            'user_name'    => $userName,
            'note'         => $note,
            'created'      => true,
        ]);
    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ----- fetch_note_history: full audit log for one entity+version+type ----- */
if ($action === 'fetch_note_history') {
    $entityType  = $_POST['entity_type']  ?? '';
    $entityName  = trim($_POST['entity_name'] ?? '');
    $versionName = trim($_POST['version_name'] ?? '');
    $noteType    = $_POST['note_type']    ?? '';

    if (!in_array($entityType, ['campaign','adset','ad']) || $entityName === '') {
        jsonOut(['success' => false, 'message' => 'Invalid entity']);
    }
    try {
        $sql = "SELECT id, note_id, version_name, note_type,
                       user_id, user_name, action, old_note, new_note, created_at
                FROM meta_version_notes_history
                WHERE entity_type = ? AND entity_name = ?";
        $params = [$entityType, $entityName];

        if ($versionName !== '') { $sql .= " AND version_name = ?"; $params[] = $versionName; }
        if (in_array($noteType, ['remark1','remark2'])) { $sql .= " AND note_type = ?"; $params[] = $noteType; }

        $sql .= " ORDER BY created_at DESC LIMIT 200";

        $s = $pdo->prepare($sql);
        $s->execute($params);
        jsonOut(['success' => true, 'history' => $s->fetchAll(PDO::FETCH_ASSOC)]);
    } catch (Exception $e) {
        jsonOut(['success' => false, 'message' => $e->getMessage()]);
    }
}

/* ==========================================================================
   Unknown action
   ========================================================================== */
jsonOut(['success' => false, 'message' => 'Unknown action: ' . $action]);