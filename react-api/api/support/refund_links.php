<?php
/*
 * /api/refund-links.php
 *
 * Exact same logic as placement-club-links.php but targets
 * the `whatsapp_placement_club_link_for_refund` table.
 *
 * POST action=fetch_all
 * POST action=add
 * POST action=fetch_by_id  (id)
 * POST action=update       (id, community_name, community_link, status)
 * POST action=disable      (id)
 * POST action=delete       (id)
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

global $conn;
if (!$conn) { echo json_encode(['success'=>false,'message'=>'DB failed']); exit; }

define('REFUND_TABLE', 'whatsapp_placement_club_link_for_refund');
define('REFUND_SETTINGS_KEY', 'wa_cit_refund_club');
define('REFUND_PROTECTED', 'https://whatsapp.com/channel/0029VbALkpa6rsQxzwHG1Q1k');

$action = $_POST['action'] ?? '';

/* helper: get initials (chars before first digit) */
$getInitials = fn($name) => preg_replace('/[0-9].*$/', '', $name);

/* ══════════════════════════════════════
   FETCH ALL
══════════════════════════════════════ */
if ($action === 'fetch_all') {
    $res  = $conn->query("SELECT * FROM " . REFUND_TABLE . " ORDER BY id DESC");
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(['success'=>true,'data'=>$rows]);
    exit;
}

/* ══════════════════════════════════════
   ADD PLACEHOLDER
══════════════════════════════════════ */
if ($action === 'add') {
    $name = '';
    if (function_exists('fetch_last_two_exam_date_value')) {
        $v    = fetch_last_two_exam_date_value('wa_community_initials');
        $name = $conn->real_escape_string($v['currentCITValue'] ?? '');
    }
    $conn->query("INSERT INTO " . REFUND_TABLE . " (community_name, community_link) VALUES ('$name', 'Placeholder Link')");
    echo json_encode($conn->affected_rows > 0
        ? ['success'=>true, 'status'=>'success', 'message'=>'Community link added successfully']
        : ['success'=>false,'status'=>'error',   'message'=>'Failed to add community link']);
    exit;
}

/* ══════════════════════════════════════
   FETCH BY ID
══════════════════════════════════════ */
if ($action === 'fetch_by_id') {
    $id  = (int)($_POST['id'] ?? 0);
    $res = $conn->query("SELECT * FROM " . REFUND_TABLE . " WHERE id=$id");
    $row = $res ? $res->fetch_assoc() : null;
    echo $row ? json_encode($row) : json_encode(['error'=>'Not found']);
    exit;
}

/* ══════════════════════════════════════
   UPDATE  — same logic as placement club
   activated_at / closed_at timestamps
   settings update when active + CIT matches
══════════════════════════════════════ */
if ($action === 'update') {
    $id   = (int)($_POST['id'] ?? 0);
    $name = $conn->real_escape_string($_POST['community_name'] ?? '');
    $link = $conn->real_escape_string($_POST['community_link'] ?? '');
    $stat = $conn->real_escape_string($_POST['status']         ?? 'pending');
    $init = $conn->real_escape_string($getInitials($name));

    $ts = '';
    if ($stat === 'active') $ts = ', activated_at = NOW(), closed_at = NULL';
    if ($stat === 'closed') $ts = ', closed_at = NOW()';

    if ($stat === 'active' && function_exists('fetch_last_two_exam_date_value')) {
        $exam = fetch_last_two_exam_date_value('wa_community_initials');
        if (($exam['currentCITValue'] ?? '') === $init) {
            foreach (['whatsapp_link','whatsapp_ca', REFUND_SETTINGS_KEY] as $k) {
                $conn->query("UPDATE settings SET settings_value='$link' WHERE settings_key='$k'");
            }
        }
    }

    $conn->query("UPDATE " . REFUND_TABLE . "
                  SET community_name='$name', community_link='$link', status='$stat' $ts
                  WHERE id=$id");
    echo json_encode($conn->affected_rows >= 0
        ? ['success'=>true, 'status'=>'success', 'message'=>'Community link updated successfully']
        : ['success'=>false,'status'=>'error',   'message'=>'Failed to update community link']);
    exit;
}

/* ══════════════════════════════════════
   DISABLE  — set closed + closed_at, promote next pending
══════════════════════════════════════ */
if ($action === 'disable') {
    $id = (int)($_POST['id'] ?? 0);

    $chk = $conn->query("SELECT status, community_name FROM " . REFUND_TABLE . " WHERE id=$id");
    if (!$chk || !$chk->num_rows) { echo json_encode(['success'=>false,'message'=>'Not found']); exit; }
    $row       = $chk->fetch_assoc();
    $wasActive = $row['status'] === 'active';
    $init      = $conn->real_escape_string($getInitials($row['community_name']));

    $conn->query("UPDATE " . REFUND_TABLE . " SET status='closed', closed_at=NOW() WHERE id=$id");

    if ($wasActive) {
        $pRes = $conn->query("SELECT COUNT(*) AS c FROM " . REFUND_TABLE . " WHERE status='pending' AND community_name LIKE '$init%'");
        $pCnt = (int)$pRes->fetch_assoc()['c'];

        if ($pCnt > 0) {
            $conn->query("UPDATE " . REFUND_TABLE . " SET status='active', activated_at=NOW() WHERE status='pending' AND community_name LIKE '$init%' ORDER BY id LIMIT 1");
            $nlRes = $conn->query("SELECT community_link FROM " . REFUND_TABLE . " WHERE status='active' AND community_name LIKE '$init%' LIMIT 1");
            if ($nlRes && $nlRes->num_rows) {
                $nl = $conn->real_escape_string($nlRes->fetch_assoc()['community_link']);
                if (function_exists('fetch_last_two_exam_date_value')) {
                    $exam = fetch_last_two_exam_date_value('wa_community_initials');
                    if (($exam['currentCITValue'] ?? '') === $init) {
                        foreach (['whatsapp_link','whatsapp_ca', REFUND_SETTINGS_KEY] as $k) {
                            $conn->query("UPDATE settings SET settings_value='$nl' WHERE settings_key='$k'");
                        }
                    }
                }
            }
            echo json_encode(['success'=>true,'status'=>'success','message'=>'Community link disabled and next pending link activated']);
        } else {
            echo json_encode(['success'=>true,'status'=>'success','message'=>'Community link closed successfully']);
        }
    } else {
        echo json_encode(['success'=>true,'status'=>'success','message'=>'Community link closed successfully']);
    }
    exit;
}

/* ══════════════════════════════════════
   DELETE  — promote next pending if was active
══════════════════════════════════════ */
if ($action === 'delete') {
    $id = (int)($_POST['id'] ?? 0);

    $chk = $conn->query("SELECT status, community_name FROM " . REFUND_TABLE . " WHERE id=$id");
    if (!$chk || !$chk->num_rows) { echo json_encode(['success'=>false,'message'=>'Not found']); exit; }
    $row       = $chk->fetch_assoc();
    $wasActive = $row['status'] === 'active';
    $init      = $conn->real_escape_string($getInitials($row['community_name']));

    $conn->query("DELETE FROM " . REFUND_TABLE . " WHERE id=$id");

    if ($wasActive) {
        $conn->query("UPDATE " . REFUND_TABLE . " SET status='active', activated_at=NOW() WHERE status='pending' AND community_name LIKE '$init%' ORDER BY id LIMIT 1");
        $nlRes = $conn->query("SELECT community_link FROM " . REFUND_TABLE . " WHERE status='active' AND community_name LIKE '$init%' LIMIT 1");
        if ($nlRes && $nlRes->num_rows) {
            $nl = $conn->real_escape_string($nlRes->fetch_assoc()['community_link']);
            if (function_exists('fetch_last_two_exam_date_value')) {
                $exam = fetch_last_two_exam_date_value('wa_community_initials');
                if (($exam['currentCITValue'] ?? '') === $init) {
                    foreach (['whatsapp_link','whatsapp_ca', REFUND_SETTINGS_KEY] as $k) {
                        $conn->query("UPDATE settings SET settings_value='$nl' WHERE settings_key='$k'");
                    }
                }
            }
        }
    }

    echo json_encode($conn->affected_rows >= 0
        ? ['success'=>true,'status'=>'success','message'=>'Community link deleted successfully']
        : ['success'=>false,'status'=>'error',  'message'=>'Failed to delete community link']);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>