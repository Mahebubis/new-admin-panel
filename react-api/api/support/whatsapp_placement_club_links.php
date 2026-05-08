<?php
/*
 * /api/placement-club-links.php
 *
 * POST action=fetch_all       → all rows, ORDER BY id DESC
 * POST action=add             → insert placeholder row
 * POST action=fetch_by_id     → single row (id)
 * POST action=update          → update name/link/status + timestamps
 * POST action=disable         → set closed + closed_at, promote next pending
 * POST action=delete          → delete, promote next pending if was active
 *
 * Table: whatsapp_placement_club_link
 *   id, community_name, community_link, status, activated_at, closed_at
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate'); // Real-time: no caching

global $conn;
if (!$conn) { echo json_encode(['success'=>false,'message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? '';

/* ══════════════════════════════════════
   FETCH ALL
══════════════════════════════════════ */
if ($action === 'fetch_all') {
    $res  = $conn->query("SELECT * FROM whatsapp_placement_club_link ORDER BY id DESC");
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
    $conn->query("INSERT INTO whatsapp_placement_club_link (community_name, community_link) VALUES ('$name', 'Placeholder Link')");
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
    $res = $conn->query("SELECT * FROM whatsapp_placement_club_link WHERE id=$id");
    $row = $res ? $res->fetch_assoc() : null;
    echo $row ? json_encode($row) : json_encode(['error'=>'Not found']);
    exit;
}

/* ══════════════════════════════════════
   UPDATE  (matches update_placement_club_link exactly)
   — sets activated_at = NOW() when status → active
   — sets closed_at   = NOW() when status → closed
   — updates settings keys when active & matches current CIT initials
══════════════════════════════════════ */
if ($action === 'update') {
    $id   = (int)($_POST['id'] ?? 0);
    $name = $conn->real_escape_string($_POST['community_name'] ?? '');
    $link = $conn->real_escape_string($_POST['community_link'] ?? '');
    $stat = $conn->real_escape_string($_POST['status']         ?? 'pending');

    // Determine initials (chars before first digit)
    $initials = $conn->real_escape_string(preg_replace('/[0-9].*$/', '', $name));

    // Timestamp suffix
    $ts = '';
    if ($stat === 'active')  $ts = ', activated_at = NOW(), closed_at = NULL';
    if ($stat === 'closed')  $ts = ', closed_at = NOW()';

    // Update settings if active and matches current CIT
    if ($stat === 'active' && function_exists('fetch_last_two_exam_date_value')) {
        $exam = fetch_last_two_exam_date_value('wa_community_initials');
        if (($exam['currentCITValue'] ?? '') === $initials) {
            foreach (['whatsapp_link','whatsapp_ca','wa_cit_placement_club'] as $key) {
                $conn->query("UPDATE settings SET settings_value='$link' WHERE settings_key='$key'");
            }
        }
    }

    $conn->query("UPDATE whatsapp_placement_club_link
                  SET community_name='$name', community_link='$link', status='$stat' $ts
                  WHERE id=$id");

    echo json_encode($conn->affected_rows >= 0
        ? ['success'=>true, 'status'=>'success', 'message'=>'Community link updated successfully']
        : ['success'=>false,'status'=>'error',   'message'=>'Failed to update community link']);
    exit;
}

/* ══════════════════════════════════════
   DISABLE  (matches disable_placement_club_link exactly)
   — sets status=closed, closed_at=NOW()
   — if was active: promotes next pending → active + activated_at=NOW()
   — updates settings if CIT matches
══════════════════════════════════════ */
if ($action === 'disable') {
    $id = (int)($_POST['id'] ?? 0);

    $chk = $conn->query("SELECT status, community_name FROM whatsapp_placement_club_link WHERE id=$id");
    if (!$chk || !$chk->num_rows) { echo json_encode(['success'=>false,'message'=>'Not found']); exit; }
    $row       = $chk->fetch_assoc();
    $wasActive = $row['status'] === 'active';
    $initials  = $conn->real_escape_string(preg_replace('/[0-9].*$/', '', $row['community_name']));

    $conn->query("UPDATE whatsapp_placement_club_link SET status='closed', closed_at=NOW() WHERE id=$id");

    if ($wasActive) {
        // Count pending with same initials
        $pRes = $conn->query("SELECT COUNT(*) AS c FROM whatsapp_placement_club_link WHERE status='pending' AND community_name LIKE '$initials%'");
        $pCnt = (int)$pRes->fetch_assoc()['c'];

        if ($pCnt > 0) {
            $conn->query("UPDATE whatsapp_placement_club_link SET status='active', activated_at=NOW() WHERE status='pending' AND community_name LIKE '$initials%' ORDER BY id LIMIT 1");
            $newLinkRes = $conn->query("SELECT community_link FROM whatsapp_placement_club_link WHERE status='active' AND community_name LIKE '$initials%' LIMIT 1");
            if ($newLinkRes && $newLinkRes->num_rows) {
                $newLink = $conn->real_escape_string($newLinkRes->fetch_assoc()['community_link']);
                if (function_exists('fetch_last_two_exam_date_value')) {
                    $exam = fetch_last_two_exam_date_value('wa_community_initials');
                    if (($exam['currentCITValue'] ?? '') === $initials) {
                        foreach (['whatsapp_link','whatsapp_ca','wa_cit_placement_club'] as $k) {
                            $conn->query("UPDATE settings SET settings_value='$newLink' WHERE settings_key='$k'");
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
   DELETE  (matches delete_placement_club_link)
   — if was active: promotes next pending
══════════════════════════════════════ */
if ($action === 'delete') {
    $id = (int)($_POST['id'] ?? 0);

    $chk = $conn->query("SELECT status, community_name FROM whatsapp_placement_club_link WHERE id=$id");
    if (!$chk || !$chk->num_rows) { echo json_encode(['success'=>false,'message'=>'Not found']); exit; }
    $row       = $chk->fetch_assoc();
    $wasActive = $row['status'] === 'active';
    $initials  = $conn->real_escape_string(preg_replace('/[0-9].*$/', '', $row['community_name']));

    $conn->query("DELETE FROM whatsapp_placement_club_link WHERE id=$id");

    if ($wasActive) {
        $conn->query("UPDATE whatsapp_placement_club_link SET status='active', activated_at=NOW() WHERE status='pending' AND community_name LIKE '$initials%' ORDER BY id LIMIT 1");
        $newLinkRes = $conn->query("SELECT community_link FROM whatsapp_placement_club_link WHERE status='active' AND community_name LIKE '$initials%' LIMIT 1");
        if ($newLinkRes && $newLinkRes->num_rows) {
            $newLink = $conn->real_escape_string($newLinkRes->fetch_assoc()['community_link']);
            if (function_exists('fetch_last_two_exam_date_value')) {
                $exam = fetch_last_two_exam_date_value('wa_community_initials');
                if (($exam['currentCITValue'] ?? '') === $initials) {
                    foreach (['whatsapp_link','whatsapp_ca','wa_cit_placement_club'] as $k) {
                        $conn->query("UPDATE settings SET settings_value='$newLink' WHERE settings_key='$k'");
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