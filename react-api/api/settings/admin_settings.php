<?php
/*
 * /api/admin-settings.php
 *
 * POST action=get_settings    → all rows from settings table as key-value map
 * POST action=update_settings → bulk upsert; body: settings JSON object {key: value}
 *                               Protected keys (instant_exam, instant_result) require
 *                               password_token verification done on the React side.
 *
 * Table: settings (id, settings_key, settings_value)
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['success'=>false,'message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? '';

/* ══════════════════════════════════════
   GET SETTINGS  — same query as PHP page
══════════════════════════════════════ */
if ($action === 'get_settings') {
    $res  = $conn->query("SELECT * FROM settings ORDER BY id ASC");
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) {
        $rows[$r['settings_key']] = $r['settings_value'];
    }
    echo json_encode(['success'=>true,'settings'=>$rows]);
    exit;
}

/* ══════════════════════════════════════
   UPDATE SETTINGS  — upsert each key
   Accepts: settings_json = JSON string of {key: value}
   Mirrors PHP page's foreach $_POST loop exactly.
══════════════════════════════════════ */
if ($action === 'update_settings') {
    $raw = $_POST['settings_json'] ?? '{}';
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        echo json_encode(['success'=>false,'message'=>'Invalid settings data']);
        exit;
    }

    $updated = 0;
    foreach ($data as $key => $value) {
        $k = $conn->real_escape_string(trim($key));
        $v = $conn->real_escape_string(trim($value));
        if (!$k) continue;

        $check = $conn->query("SELECT id FROM settings WHERE settings_key='$k'");
        if ($check && $check->num_rows > 0) {
            $conn->query("UPDATE settings SET settings_value='$v' WHERE settings_key='$k'");
        } else {
            $conn->query("INSERT INTO settings (settings_key, settings_value) VALUES ('$k', '$v')");
        }
        $updated++;
    }

    echo json_encode(['success'=>true,'message'=>"$updated setting(s) updated successfully",'updated'=>$updated]);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>