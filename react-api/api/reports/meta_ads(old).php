<?php
/*
 * /api/meta-ads.php  — All AJAX actions for Meta Ads Dashboard
 * Uses PDO directly (same as original) for this file only.
 * Meta Ad Account: act_440296640847969
 *
 * Actions (POST):
 *   get_cit_versions       → list of CIT version names
 *   get_date_range         → from/to dates for a CIT version
 *   update_meta_token      → store new token in settings
 *   fetch_analytics_phase1 → fast: Meta insights + DB stats per campaign
 *   fetch_analytics_phase2 → slow: campaign delivery_status + conversion_event from Meta
 *   fetch_adset_stats      → DB stats grouped by adset (for AdSet tab)
 *   fetch_ad_stats         → DB stats grouped by ad (for Ad tab)
 */

ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
// Auth handled by React admin panel - no session check needed here

// ─── DB ───
$host   = '127.0.0.1:3306';
$dbname = 'istudio_cit';
$dbuser = 'istudio_admin';
$dbpass = 'h;V[ts@#;u{B';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $dbuser, $dbpass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET SESSION tmp_table_size = 1073741824");
    $pdo->exec("SET SESSION max_heap_table_size = 1073741824");
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'DB: ' . $e->getMessage()]); exit;
}

define('AD_ACCOUNT_ID', 'act_440296640847969');

$action = $_POST['action'] ?? '';

/* ═══════════════════════════════════════
   GET CIT VERSIONS
═══════════════════════════════════════ */
if ($action === 'get_cit_versions') {
    $stmt = $pdo->query("SELECT exam_name FROM exam_batch_for_reports GROUP BY exam_name ORDER BY MAX(id) DESC");
    echo json_encode(['success' => true, 'versions' => $stmt->fetchAll(PDO::FETCH_COLUMN)]);
    exit;
}

/* ═══════════════════════════════════════
   GET DATE RANGE FOR CIT VERSION
═══════════════════════════════════════ */
if ($action === 'get_date_range') {
    $cit = $_POST['cit_version'] ?? '';
    $stmt = $pdo->prepare("SELECT from_date, to_date FROM exam_batch_for_reports WHERE exam_name = ? LIMIT 1");
    $stmt->execute([$cit]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        echo json_encode([
            'success'   => true,
            'from_date' => date('Y-m-d', strtotime($row['from_date'] . ' +1 day')),
            'to_date'   => $row['to_date'],
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Not found']);
    }
    exit;
}

/* ═══════════════════════════════════════
   UPDATE META TOKEN
═══════════════════════════════════════ */
if ($action === 'update_meta_token') {
    $token = trim($_POST['token'] ?? '');
    if (!$token) { echo json_encode(['success' => false, 'message' => 'Empty token']); exit; }
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

/* ─── Meta API helpers ─── */
function metaGet($url) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 30,
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    return json_decode($resp, true);
}

function fetchAllMeta($url) {
    $all = [];
    while ($url) {
        $d = metaGet($url);
        if (isset($d['error'])) break;
        $all = array_merge($all, $d['data'] ?? []);
        $url = $d['paging']['next'] ?? null;
    }
    return $all;
}

function getToken($pdo) {
    $s = $pdo->prepare("SELECT settings_value FROM settings WHERE settings_key='meta_access_token' LIMIT 1");
    $s->execute();
    return $s->fetchColumn() ?: null;
}

function isTokenError($msg) {
    $kw = ['invalid oauth access token','error validating access token','session has expired',
           'access token could not be decrypted','invalid access token'];
    foreach ($kw as $k) if (stripos($msg, $k) !== false) return true;
    return false;
}

/* ═══════════════════════════════════════
   FETCH ANALYTICS PHASE 1
   (Meta insights + DB queries — fast render)
═══════════════════════════════════════ */
if ($action === 'fetch_analytics_phase1') {
    $token = getToken($pdo);
    if (!$token) { echo json_encode(['success'=>false,'token_expired'=>true,'message'=>'Token missing']); exit; }

    $fromDate        = $_POST['from_date']         ?? '';
    $toDate          = $_POST['to_date']           ?? '';
    $perPage         = max(50, (int)($_POST['per_page'] ?? 100));
    $compareFrom     = $_POST['compare_from_date'] ?? '';
    $compareTo       = $_POST['compare_to_date']   ?? '';
    $isCompare       = $compareFrom && $compareTo;

    try {
        // ── Meta insights (current period) ──
        $fields = 'ad_id,campaign_id,campaign_name,adset_name,ad_name,spend,impressions,clicks,reach,ctr,cpc,frequency';
        $url = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID
             . '/insights?level=ad'
             . '&fields=' . $fields
             . '&time_range={"since":"' . $fromDate . '","until":"' . $toDate . '"}'
             . '&limit=' . $perPage
             . '&access_token=' . $token;

        $meta = metaGet($url);
        if (isset($meta['error'])) {
            $msg = $meta['error']['message'] ?? 'Unknown';
            if (isTokenError($msg)) { echo json_encode(['success'=>false,'token_expired'=>true,'message'=>'Token expired']); exit; }
            throw new Exception('Meta error: ' . $msg);
        }
        $metaRaw = $meta['data'] ?? [];

        // ── Meta insights (compare period) ──
        $metaRawCmp = [];
        if ($isCompare) {
            $urlC = str_replace(
                '"since":"' . $fromDate . '","until":"' . $toDate . '"',
                '"since":"' . $compareFrom . '","until":"' . $compareTo . '"',
                $url
            );
            $metaCmp    = metaGet($urlC);
            $metaRawCmp = $metaCmp['data'] ?? [];
        }

        // ── Aggregate Meta by campaign ──
        $aggr = function($raw) {
            $g = [];
            foreach ($raw as $r) {
                $c = trim($r['campaign_name'] ?? '');
                if (!$c) continue;
                if (!isset($g[$c])) $g[$c] = ['campaign_id'=>$r['campaign_id']??'','spend'=>0,'impressions'=>0,'clicks'=>0,'reach'=>0,'date_start'=>$r['date_start']??'','date_stop'=>$r['date_stop']??''];
                $g[$c]['spend']       += (float)($r['spend']       ?? 0);
                $g[$c]['impressions'] += (int)  ($r['impressions'] ?? 0);
                $g[$c]['clicks']      += (int)  ($r['clicks']      ?? 0);
                $g[$c]['reach']       += (int)  ($r['reach']       ?? 0);
            }
            return $g;
        };
        $cGrp    = $aggr($metaRaw);
        $cGrpCmp = $isCompare ? $aggr($metaRawCmp) : [];

        // ── DB: get user IDs in range ──
        $getIds = function($from, $to) use ($pdo) {
            $s = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
            $s->execute([$from . ' 00:00:00', $to . ' 23:59:59']);
            return $s->fetchAll(PDO::FETCH_COLUMN);
        };
        $uids    = $getIds($fromDate, $toDate);
        $uidsCmp = $isCompare ? $getIds($compareFrom, $compareTo) : [];

        if (empty($uids)) {
            echo json_encode(['success'=>true,'data'=>[],'meta_raw'=>$metaRaw,'is_comparison'=>$isCompare]);
            exit;
        }

        // ── DB funnel helpers ──
        $dbFunnel = function($ids) use ($pdo) {
            $ph = implode(',', array_fill(0, count($ids), '?'));

            // registrations per campaign
            $s = $pdo->prepare("SELECT user_id, COALESCE(NULLIF(TRIM(campaign),''),'Direct/Unknown') as camp FROM user_campaign WHERE user_id IN ($ph)");
            $s->execute($ids);
            $uMap = []; $regMap = [];
            foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $uMap[$r['camp']][] = $r['user_id'];
                $regMap[$r['camp']] = count(array_unique($uMap[$r['camp']]));
            }

            // exams
            $s = $pdo->prepare("SELECT DISTINCT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as camp, cr.user_id FROM cit_results cr LEFT JOIN user_campaign uc ON uc.user_id=cr.user_id WHERE cr.user_id IN ($ph)");
            $s->execute($ids);
            $eMap = []; $eUMap = [];
            foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $eUMap[$r['camp']][] = $r['user_id'];
                $eMap[$r['camp']] = count(array_unique($eUMap[$r['camp']]));
            }

            // internships + revenue
            $s = $pdo->prepare("SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as camp, COUNT(DISTINCT ps.user_id) AS intern, COALESCE(SUM(ps.amount),0) AS rev FROM payment_status ps LEFT JOIN user_campaign uc ON uc.user_id=ps.user_id WHERE ps.status='success' AND ps.user_id IN ($ph) GROUP BY camp");
            $s->execute($ids);
            $iMap = []; $rMap = [];
            foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $iMap[$r['camp']] = (int)$r['intern'];
                $rMap[$r['camp']] = (float)$r['rev'];
            }

            // 2nd internship
            $s = $pdo->prepare("SELECT COALESCE(NULLIF(TRIM(uc.campaign),''),'Direct/Unknown') as camp, COUNT(DISTINCT sub.user_id) AS sec FROM (SELECT user_id FROM payment_status WHERE status='success' AND user_id IN ($ph) GROUP BY user_id HAVING COUNT(*)>=2) sub LEFT JOIN user_campaign uc ON uc.user_id=sub.user_id GROUP BY camp");
            $s->execute($ids);
            $sMap = [];
            foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $r) $sMap[$r['camp']] = (int)$r['sec'];

            return ['reg'=>$regMap,'exam'=>$eMap,'intern'=>$iMap,'rev'=>$rMap,'sec'=>$sMap,'umap'=>$uMap];
        };

        $f    = $dbFunnel($uids);
        $fCmp = $isCompare && !empty($uidsCmp) ? $dbFunnel($uidsCmp) : null;

        // ── Build rows ──
        $makeRow = function($camp, $mData, $f) use ($fromDate, $toDate) {
            $spend = $mData['spend'] ?? 0;
            $reg   = $f['reg'][$camp]    ?? 0;
            $exam  = $f['exam'][$camp]   ?? 0;
            $inter = $f['intern'][$camp] ?? 0;
            $rev   = $f['rev'][$camp]    ?? 0;
            $sec   = $f['sec'][$camp]    ?? 0;
            $uids  = isset($f['umap'][$camp]) ? implode(',', array_unique($f['umap'][$camp])) : '';
            return [
                'campaign_name'          => $camp,
                'campaign_id'            => $mData['campaign_id'] ?? '',
                'delivery_status'        => 'LOADING',
                'conversion_event'       => 'LOADING',
                'user_ids'               => $uids,
                'date_start'             => $mData['date_start'] ?? $fromDate,
                'date_stop'              => $mData['date_stop']  ?? $toDate,
                'spend'                  => round($spend, 2),
                'impressions'            => $mData['impressions'] ?? 0,
                'clicks'                 => $mData['clicks']      ?? 0,
                'reach'                  => $mData['reach']       ?? 0,
                'registrations'          => $reg,
                'cost_per_registration'  => $reg   > 0 ? round($spend/$reg, 2)   : 0,
                'exam_count'             => $exam,
                'cost_per_exam'          => $exam  > 0 ? round($spend/$exam, 2)  : 0,
                'internship_count'       => $inter,
                'second_internship'      => $sec,
                'cost_per_internship'    => $inter > 0 ? round($spend/$inter, 2) : 0,
                'revenue'                => round($rev, 2),
                'roi'                    => $spend > 0 ? round($rev/$spend, 2)   : 0,
                'rpu'                    => $reg   > 0 ? round($rev/$reg, 2)     : 0,
                'cac_all'                => $reg   > 0 ? round($spend/$reg, 2)   : 0,
                'cac_paid'               => $inter > 0 ? round($spend/$inter, 2) : 0,
                'roas'                   => $spend > 0 ? round($rev/$spend, 2)   : 0,
                'has_meta_data'          => true,
            ];
        };

        $rows = [];
        foreach ($cGrp as $camp => $mData) {
            $row = $makeRow($camp, $mData, $f);
            if ($isCompare && $fCmp) {
                $cm   = $cGrpCmp[$camp] ?? ['spend'=>0,'impressions'=>0,'clicks'=>0,'reach'=>0];
                $cs   = $cm['spend'] ?? 0;
                $cr   = $fCmp['reg'][$camp]    ?? 0;
                $ce   = $fCmp['exam'][$camp]   ?? 0;
                $ci   = $fCmp['intern'][$camp] ?? 0;
                $cv   = $fCmp['rev'][$camp]    ?? 0;
                $csc  = $fCmp['sec'][$camp]    ?? 0;
                $row = array_merge($row, [
                    'compare_spend'               => round($cs, 2),
                    'compare_impressions'          => $cm['impressions'] ?? 0,
                    'compare_clicks'               => $cm['clicks']      ?? 0,
                    'compare_reach'                => $cm['reach']       ?? 0,
                    'compare_registrations'        => $cr,
                    'compare_cost_per_registration'=> $cr > 0 ? round($cs/$cr,2) : 0,
                    'compare_exam_count'           => $ce,
                    'compare_cost_per_exam'        => $ce > 0 ? round($cs/$ce,2) : 0,
                    'compare_internship_count'     => $ci,
                    'compare_second_internship'    => $csc,
                    'compare_cost_per_internship'  => $ci > 0 ? round($cs/$ci,2) : 0,
                    'compare_revenue'              => round($cv,2),
                    'compare_roi'                  => $cs > 0 ? round($cv/$cs,2) : 0,
                    'compare_rpu'                  => $cr > 0 ? round($cv/$cr,2) : 0,
                    'compare_cac_all'              => $cr > 0 ? round($cs/$cr,2) : 0,
                    'compare_cac_paid'             => $ci > 0 ? round($cs/$ci,2) : 0,
                    'compare_roas'                 => $cs > 0 ? round($cv/$cs,2) : 0,
                ]);
            }
            $rows[] = $row;
        }

        // campaigns with no Meta spend
        foreach ($f['reg'] as $camp => $regCount) {
            if (isset($cGrp[$camp])) continue;
            $rows[] = $makeRow($camp, ['spend'=>0,'impressions'=>0,'clicks'=>0,'reach'=>0,'campaign_id'=>'','date_start'=>$fromDate,'date_stop'=>$toDate], $f) + ['has_meta_data'=>false,'delivery_status'=>'UNKNOWN','conversion_event'=>'UNKNOWN'];
        }

        usort($rows, fn($a,$b) => $a['campaign_name']==='Direct/Unknown' ? -1 : ($b['campaign_name']==='Direct/Unknown' ? 1 : 0));

        echo json_encode(['success'=>true,'data'=>$rows,'meta_raw'=>$metaRaw,'is_comparison'=>$isCompare]);

    } catch (Exception $e) {
        echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
    }
    exit;
}

/* ═══════════════════════════════════════
   FETCH ANALYTICS PHASE 2
   (Ad delivery status + conversion event — slow)
═══════════════════════════════════════ */
if ($action === 'fetch_analytics_phase2') {
    $token = getToken($pdo);
    if (!$token) { echo json_encode(['success'=>false,'token_expired'=>true]); exit; }

    $fromDate = $_POST['from_date'] ?? '';
    $toDate   = $_POST['to_date']   ?? '';

    try {
        // All ads with status
        $adsUrl = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID
            . '/ads?fields=id,name,effective_status,configured_status&limit=2000&access_token=' . $token;
        $adsData = fetchAllMeta($adsUrl);

        // All adsets for event
        $asUrl = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID
            . '/adsets?fields=id,name,campaign_id,promoted_object&limit=2000&access_token=' . $token;
        $adsetsData = fetchAllMeta($asUrl);

        // Insights (just id+campaign for mapping)
        $insUrl = 'https://graph.facebook.com/v19.0/' . AD_ACCOUNT_ID
            . '/insights?level=ad&fields=ad_id,campaign_name&time_range={"since":"' . $fromDate . '","until":"' . $toDate . '"}&limit=1000&access_token=' . $token;
        $insData = metaGet($insUrl);
        $insRaw  = $insData['data'] ?? [];

        // Build ad_id → status map
        $adStatusMap = [];
        foreach ($adsData as $ad) $adStatusMap[$ad['id']] = $ad['effective_status'] ?? 'UNKNOWN';

        // Build campaign_name → status
        $campStatus = [];
        foreach ($insRaw as $r) {
            $c = trim($r['campaign_name'] ?? '');
            $adId = trim($r['ad_id'] ?? '');
            if ($c && $adId) $campStatus[$c] = $adStatusMap[$adId] ?? 'UNKNOWN';
        }

        // Build campaign_id → event
        $campEvent = [];
        foreach ($adsetsData as $as) {
            $cid   = $as['campaign_id'] ?? '';
            $event = $as['promoted_object']['custom_event_type'] ?? 'UNKNOWN';
            if ($cid && !isset($campEvent[$cid])) $campEvent[$cid] = $event;
        }

        echo json_encode([
            'success'             => true,
            'campaign_status_map' => $campStatus,
            'campaign_event_map'  => $campEvent,
        ]);
    } catch (Exception $e) {
        echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
    }
    exit;
}

/* ═══════════════════════════════════════
   FETCH ADSET STATS (AdSet tab)
═══════════════════════════════════════ */
if ($action === 'fetch_adset_stats') {
    $fromDate = $_POST['from_date'] ?? '';
    $toDate   = $_POST['to_date']   ?? '';
    $adsets   = json_decode($_POST['adsets'] ?? '[]', true);
    if (empty($adsets) || !$fromDate || !$toDate) { echo json_encode(['success'=>false,'message'=>'Missing params']); exit; }

    try {
        $s = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
        $s->execute([$fromDate.' 00:00:00', $toDate.' 23:59:59']);
        $uids = $s->fetchAll(PDO::FETCH_COLUMN);
        if (empty($uids)) { echo json_encode(['success'=>true,'data'=>[]]); exit; }

        $ph = implode(',', array_fill(0,count($uids),'?'));
        $ap = implode(',', array_fill(0,count($adsets),'?'));

        $queries = [
            'reg'  => ["SELECT COALESCE(NULLIF(TRIM(uc.adset),''),'Unknown') as k, COUNT(DISTINCT uc.user_id) as n FROM user_campaign uc WHERE uc.user_id IN ($ph) AND TRIM(uc.adset) IN ($ap) GROUP BY k", array_merge($uids,$adsets)],
            'exam' => ["SELECT COALESCE(NULLIF(TRIM(uc.adset),''),'Unknown') as k, COUNT(DISTINCT cr.user_id) as n FROM cit_results cr JOIN user_campaign uc ON uc.user_id=cr.user_id WHERE cr.user_id IN ($ph) AND TRIM(uc.adset) IN ($ap) GROUP BY k", array_merge($uids,$adsets)],
            'pay'  => ["SELECT COALESCE(NULLIF(TRIM(uc.adset),''),'Unknown') as k, COUNT(DISTINCT ps.user_id) as n, COALESCE(SUM(ps.amount),0) as rev FROM payment_status ps JOIN user_campaign uc ON uc.user_id=ps.user_id WHERE ps.status='success' AND ps.user_id IN ($ph) AND TRIM(uc.adset) IN ($ap) GROUP BY k", array_merge($uids,$adsets)],
            'sec'  => ["SELECT COALESCE(NULLIF(TRIM(uc.adset),''),'Unknown') as k, COUNT(DISTINCT sub.user_id) as n FROM (SELECT user_id FROM payment_status WHERE status='success' AND user_id IN ($ph) GROUP BY user_id HAVING COUNT(*)>=2) sub JOIN user_campaign uc ON uc.user_id=sub.user_id WHERE TRIM(uc.adset) IN ($ap) GROUP BY k", array_merge($uids,$adsets)],
        ];

        $maps = [];
        foreach ($queries as $qk => [$sql, $params]) {
            $s = $pdo->prepare($sql); $s->execute($params);
            $maps[$qk] = [];
            foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $maps[$qk][$r['k']] = isset($r['rev']) ? ['n'=>(int)$r['n'],'rev'=>(float)$r['rev']] : (int)$r['n'];
            }
        }

        $result = [];
        foreach ($adsets as $as) {
            $pr = $maps['pay'][$as] ?? ['n'=>0,'rev'=>0];
            $result[$as] = [
                'registrations'    => $maps['reg'][$as]  ?? 0,
                'exam_count'       => $maps['exam'][$as] ?? 0,
                'internship_count' => $pr['n'],
                'second_internship'=> $maps['sec'][$as]  ?? 0,
                'revenue'          => $pr['rev'],
            ];
        }
        echo json_encode(['success'=>true,'data'=>$result]);
    } catch (Exception $e) {
        echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
    }
    exit;
}

/* ═══════════════════════════════════════
   FETCH AD STATS (Ad tab)
═══════════════════════════════════════ */
if ($action === 'fetch_ad_stats') {
    $fromDate = $_POST['from_date'] ?? '';
    $toDate   = $_POST['to_date']   ?? '';
    $ads      = json_decode($_POST['ads'] ?? '[]', true);
    if (empty($ads) || !$fromDate || !$toDate) { echo json_encode(['success'=>false,'message'=>'Missing params']); exit; }

    try {
        $s = $pdo->prepare("SELECT user_id FROM users WHERE registered_at BETWEEN ? AND ?");
        $s->execute([$fromDate.' 00:00:00', $toDate.' 23:59:59']);
        $uids = $s->fetchAll(PDO::FETCH_COLUMN);
        if (empty($uids)) { echo json_encode(['success'=>true,'data'=>[]]); exit; }

        $ph = implode(',', array_fill(0,count($uids),'?'));
        $ap = implode(',', array_fill(0,count($ads),'?'));

        $queries = [
            'reg'  => ["SELECT COALESCE(NULLIF(TRIM(uc.ad),''),'Unknown') as k, COUNT(DISTINCT uc.user_id) as n FROM user_campaign uc WHERE uc.user_id IN ($ph) AND TRIM(uc.ad) IN ($ap) GROUP BY k", array_merge($uids,$ads)],
            'exam' => ["SELECT COALESCE(NULLIF(TRIM(uc.ad),''),'Unknown') as k, COUNT(DISTINCT cr.user_id) as n FROM cit_results cr JOIN user_campaign uc ON uc.user_id=cr.user_id WHERE cr.user_id IN ($ph) AND TRIM(uc.ad) IN ($ap) GROUP BY k", array_merge($uids,$ads)],
            'pay'  => ["SELECT COALESCE(NULLIF(TRIM(uc.ad),''),'Unknown') as k, COUNT(DISTINCT ps.user_id) as n, COALESCE(SUM(ps.amount),0) as rev FROM payment_status ps JOIN user_campaign uc ON uc.user_id=ps.user_id WHERE ps.status='success' AND ps.user_id IN ($ph) AND TRIM(uc.ad) IN ($ap) GROUP BY k", array_merge($uids,$ads)],
            'sec'  => ["SELECT COALESCE(NULLIF(TRIM(uc.ad),''),'Unknown') as k, COUNT(DISTINCT sub.user_id) as n FROM (SELECT user_id FROM payment_status WHERE status='success' AND user_id IN ($ph) GROUP BY user_id HAVING COUNT(*)>=2) sub JOIN user_campaign uc ON uc.user_id=sub.user_id WHERE TRIM(uc.ad) IN ($ap) GROUP BY k", array_merge($uids,$ads)],
        ];

        $maps = [];
        foreach ($queries as $qk => [$sql, $params]) {
            $s = $pdo->prepare($sql); $s->execute($params);
            $maps[$qk] = [];
            foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $maps[$qk][$r['k']] = isset($r['rev']) ? ['n'=>(int)$r['n'],'rev'=>(float)$r['rev']] : (int)$r['n'];
            }
        }

        $result = [];
        foreach ($ads as $ad) {
            $pr = $maps['pay'][$ad] ?? ['n'=>0,'rev'=>0];
            $result[$ad] = [
                'registrations'    => $maps['reg'][$ad]  ?? 0,
                'exam_count'       => $maps['exam'][$ad] ?? 0,
                'internship_count' => $pr['n'],
                'second_internship'=> $maps['sec'][$ad]  ?? 0,
                'revenue'          => $pr['rev'],
            ];
        }
        echo json_encode(['success'=>true,'data'=>$result]);
    } catch (Exception $e) {
        echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
    }
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>