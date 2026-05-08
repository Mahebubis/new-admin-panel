<?php
/*
 * /api/aws-instance.php
 *
 * POST action=get_data        → current instance type (Lambda) + latest DB state + uptime + cost
 * POST action=upgrade_instance → instanceType : record to DB + call Lambda upgrade endpoint
 *
 * Table: aws_instance_state (id, instance_type, timestamp)
 * Lambda GET:  https://r8loqpyw0i.execute-api.ap-south-1.amazonaws.com/staging/instance
 * Lambda POST: https://r8loqpyw0i.execute-api.ap-south-1.amazonaws.com/staging/upgrade
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['success'=>false,'message'=>'DB failed']); exit; }

define('INSTANCE_ID', 'i-01b582d1fcf4dae87');
define('REGION',      'ap-south-1');
define('LAMBDA_BASE', 'https://r8loqpyw0i.execute-api.ap-south-1.amazonaws.com/staging');
define('USD_INR',     84.07);

$INSTANCE_TYPES = [
    ['type'=>'t3.2xlarge',  'cpu'=>8,  'memory'=>32,  'price_usd'=>0.3328, 'tier'=>'Starter',    'icon'=>'🌱', 'color'=>'#E53E3E', 'bg'=>'#FFF5F5', 'shadow'=>'#FC8181'],
    ['type'=>'m5.4xlarge',  'cpu'=>16, 'memory'=>64,  'price_usd'=>0.768,  'tier'=>'Growth',     'icon'=>'🚀', 'color'=>'#0891B2', 'bg'=>'#ECFEFF', 'shadow'=>'#22D3EE'],
    ['type'=>'m5.8xlarge',  'cpu'=>32, 'memory'=>128, 'price_usd'=>1.536,  'tier'=>'Scale',      'icon'=>'⚡', 'color'=>'#7C3AED', 'bg'=>'#F5F3FF', 'shadow'=>'#A78BFA'],
    ['type'=>'m5.16xlarge', 'cpu'=>64, 'memory'=>256, 'price_usd'=>3.072,  'tier'=>'Enterprise', 'icon'=>'👑', 'color'=>'#D97706', 'bg'=>'#FFFBEB', 'shadow'=>'#FBBF24'],
];

/* ── helper: curl GET ── */
function curlGet($url) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_errno($ch) ? curl_error($ch) : null;
    curl_close($ch);
    if ($err)       return ['error'=>$err];
    if ($code!==200) return ['error'=>"HTTP $code"];
    $d = json_decode($resp, true);
    return json_last_error()!==JSON_ERROR_NONE ? ['error'=>'JSON error'] : $d;
}

/* ── helper: curl POST ── */
function curlPost($url) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    return $resp;
}

$action = $_POST['action'] ?? '';

/* ══════════════════════════════════════
   GET DATA  — mirrors PHP page's init logic exactly
══════════════════════════════════════ */
if ($action === 'get_data') {
    // 1. Fetch live instance type from Lambda
    $lambdaUrl = LAMBDA_BASE . '/instance?' . http_build_query([
        'instanceId'     => INSTANCE_ID,
        'instanceRegion' => REGION,
    ]);
    $resp = curlGet($lambdaUrl);

    // Parse instance type (same double-decode as PHP)
    if (isset($resp['InstanceType'])) {
        $currentType = $resp['InstanceType'];
    } elseif (isset($resp['body'])) {
        $b = json_decode($resp['body'], true);
        $currentType = $b['InstanceType'] ?? 'Error';
    } else {
        $currentType = 'Error';
    }

    // 2. Latest DB record
    $res = $conn->query("SELECT instance_type, timestamp FROM aws_instance_state ORDER BY id DESC LIMIT 1");
    $latestType = null; $latestTs = null;
    if ($res && $res->num_rows) {
        $row = $res->fetch_assoc();
        $latestType = $row['instance_type'];
        $latestTs   = $row['timestamp'];
    }

    // 3. Uptime calculation (same as PHP DateTime diff)
    $uptimeSec = 0; $uptimeFmt = '00:00:00';
    if ($latestTs) {
        $diff = (new DateTime($latestTs))->diff(new DateTime());
        $dh   = $diff->d > 0 ? ($diff->d * 24 + $diff->h) : $diff->h;
        $uptimeSec = $dh * 3600 + $diff->i * 60 + $diff->s;
        $uptimeFmt = sprintf('%02d:%02d:%02d', $dh, $diff->i, $diff->s);
        $hoursRunning = round($dh + $diff->i / 60 + $diff->s / 3600, 6);
    } else {
        $hoursRunning = 0;
    }

    // 4. Estimated cost for current type
    global $INSTANCE_TYPES;
    $totalCost = 0;
    foreach ($INSTANCE_TYPES as $t) {
        if ($t['type'] === $currentType) {
            $totalCost = round($t['price_usd'] * USD_INR * $hoursRunning, 2);
            break;
        }
    }

    // 5. Formatted timestamp
    $latestTsAlt = $latestTs ? date('d M Y, h:i A', strtotime($latestTs)) : null;
    $isChanging  = $currentType !== $latestType && $latestType !== null;

    echo json_encode([
        'success'         => true,
        'current_type'    => $currentType,
        'latest_type'     => $latestType,
        'latest_ts'       => $latestTs,
        'latest_ts_alt'   => $latestTsAlt,
        'uptime_fmt'      => $uptimeFmt,
        'uptime_sec'      => $uptimeSec,
        'hours_running'   => $hoursRunning,
        'total_cost_inr'  => $totalCost,
        'is_changing'     => $isChanging,
        'instance_id'     => INSTANCE_ID,
        'region'          => REGION,
    ]);
    exit;
}

/* ══════════════════════════════════════
   UPGRADE INSTANCE
   1. Save new instance_type to aws_instance_state
   2. Call Lambda upgrade endpoint
══════════════════════════════════════ */
if ($action === 'upgrade_instance') {
    $instanceType = $conn->real_escape_string(trim($_POST['instanceType'] ?? ''));
    if (!$instanceType) { echo json_encode(['success'=>false,'error'=>'Missing instanceType']); exit; }

    // Insert record (same as upgrade_instance.php would do)
    $conn->query("INSERT INTO aws_instance_state (instance_type, timestamp) VALUES ('$instanceType', NOW())");

    if ($conn->affected_rows < 1) {
        echo json_encode(['success'=>false,'error'=>'DB insert failed']);
        exit;
    }

    // Call Lambda upgrade (fire-and-forget, same as PHP)
    $lambdaUrl = LAMBDA_BASE . '/upgrade?'
        . 'instanceRegion=' . urlencode(REGION)
        . '&instanceId='    . urlencode(INSTANCE_ID)
        . '&instanceType='  . urlencode($instanceType);
    curlPost($lambdaUrl);

    echo json_encode(['success'=>true,'message'=>'Instance change initiated','instance_type'=>$instanceType]);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>