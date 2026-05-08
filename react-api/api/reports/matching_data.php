<?php
/*
 * /api/matching-data.php
 *
 * GET  ?action=get_data          → returns campaign/adset/ad comparison
 * POST action=rename             → renames value in BOTH fb_ads_details AND user_campaign
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['success'=>false,'message'=>'DB failed']); exit; }

$action = $_GET['action'] ?? $_POST['action'] ?? '';

/* ══════════════════════════════════════
   GET DATA — compare fb_ads_details vs user_campaign
══════════════════════════════════════ */
if ($action === 'get_data') {

    // Fetch distinct campaign/adset/ad from fb_ads_details
    $fb_res = $conn->query("
        SELECT DISTINCT campaign, adset, ad
        FROM fb_ads_details
        WHERE campaign IS NOT NULL AND adset IS NOT NULL AND ad IS NOT NULL
    ");
    $fb_data = [];
    if ($fb_res) while ($r = $fb_res->fetch_assoc()) $fb_data[] = array_map('trim', $r);

    // Fetch distinct campaign/adset/ad from user_campaign
    $uc_res = $conn->query("
        SELECT DISTINCT campaign, adset, ad
        FROM user_campaign
        WHERE campaign IS NOT NULL AND adset IS NOT NULL AND ad IS NOT NULL
    ");
    $uc_data = [];
    if ($uc_res) while ($r = $uc_res->fetch_assoc()) $uc_data[] = array_map('trim', $r);

    function compareField($fb, $uc, $field) {
        $fb_vals = array_filter(array_unique(array_column($fb, $field)), 'strlen');
        $uc_vals = array_filter(array_unique(array_column($uc, $field)), 'strlen');
        sort($fb_vals); sort($uc_vals);
        return [
            'matching'      => array_values(array_unique(array_intersect($fb_vals, $uc_vals))),
            'only_in_fb'    => array_values(array_unique(array_diff($fb_vals, $uc_vals))),
            'only_in_user'  => array_values(array_unique(array_diff($uc_vals, $fb_vals))),
        ];
    }

    echo json_encode([
        'success'  => true,
        'campaign' => compareField($fb_data, $uc_data, 'campaign'),
        'adset'    => compareField($fb_data, $uc_data, 'adset'),
        'ad'       => compareField($fb_data, $uc_data, 'ad'),
    ]);
    exit;
}

/* ══════════════════════════════════════
   RENAME — update BOTH tables
══════════════════════════════════════ */
if ($action === 'rename') {
    $old   = $conn->real_escape_string(trim($_POST['old_value'] ?? ''));
    $new   = $conn->real_escape_string(trim($_POST['new_value'] ?? ''));
    $field = $_POST['field'] ?? '';

    // Whitelist field names — never interpolate user input directly
    $allowed = ['campaign', 'adset', 'ad'];
    if (!in_array($field, $allowed, true)) {
        echo json_encode(['success'=>false,'message'=>'Invalid field']);
        exit;
    }
    if (!$old || !$new) {
        echo json_encode(['success'=>false,'message'=>'Old and new values required']);
        exit;
    }

    $stmt1 = $conn->prepare("UPDATE fb_ads_details SET `$field` = ? WHERE `$field` = ?");
    $stmt1->bind_param('ss', $new, $old);
    $ok1 = $stmt1->execute();
    $affected1 = $stmt1->affected_rows;

    $stmt2 = $conn->prepare("UPDATE user_campaign SET `$field` = ? WHERE `$field` = ?");
    $stmt2->bind_param('ss', $new, $old);
    $ok2 = $stmt2->execute();
    $affected2 = $stmt2->affected_rows;

    if ($ok1 && $ok2) {
        echo json_encode([
            'success'  => true,
            'message'  => "Renamed successfully — fb_ads_details: {$affected1} rows, user_campaign: {$affected2} rows updated",
            'fb_rows'  => $affected1,
            'uc_rows'  => $affected2,
        ]);
    } else {
        echo json_encode(['success'=>false,'message'=>'Rename failed: '.$conn->error]);
    }
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>