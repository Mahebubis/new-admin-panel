<?php
/*
 * /api/community-links.php
 *
 * Handles all WhatsApp community link management.
 *
 * ── CIT versions ──
 * POST action=get_cit_versions
 *
 * ── New table (whatsapp_community_link_new) ──
 * POST action=fetch_new          (cit_id)
 * POST action=add_new            (cit_id)
 * POST action=fetch_new_by_id    (id)
 * POST action=update_new         (id, name, link, status, ranking)
 * POST action=delete_new         (id)
 *
 * ── Current table (whatsapp_community_link) ──
 * POST action=fetch_current
 * POST action=add_current
 * POST action=fetch_current_by_id  (id)
 * POST action=update_current       (id, community_name, community_link, status)
 * POST action=disable_current      (id)
 * POST action=delete_current       (id)
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
   GET CIT VERSIONS
══════════════════════════════════════ */
if ($action === 'get_cit_versions') {
    $res = $conn->query("SELECT id, cit_name FROM cit_version ORDER BY id DESC");
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(['success'=>true,'data'=>$rows]);
    exit;
}

/* ══════════════════════════════════════
   NEW TABLE — fetch by cit_id
══════════════════════════════════════ */
if ($action === 'fetch_new') {
    $cit_id = (int)($_POST['cit_id'] ?? 0);
    $sql = "
        SELECT wcln.*, cv.cit_name
        FROM whatsapp_community_link_new wcln
        LEFT JOIN cit_version cv ON wcln.cit_id = cv.id
    ";
    if ($cit_id > 0) $sql .= " WHERE wcln.cit_id = $cit_id";
    $sql .= " ORDER BY wcln.id DESC";

    $res = $conn->query($sql);
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(['success'=>true,'data'=>$rows]);
    exit;
}

/* ══════════════════════════════════════
   NEW TABLE — add placeholder row
══════════════════════════════════════ */
if ($action === 'add_new') {
    $cit_id = (int)($_POST['cit_id'] ?? 0);
    if (!$cit_id) { echo json_encode(['success'=>false,'message'=>'Select a CIT version first']); exit; }
    $conn->query("INSERT INTO whatsapp_community_link_new (cit_id, name, link, status, ranking) VALUES ($cit_id, 'Placeholder Name', 'http://example.com', 'pending', 0)");
    echo json_encode($conn->affected_rows > 0
        ? ['success'=>true, 'status'=>'success', 'message'=>'New community link added successfully!']
        : ['success'=>false,'status'=>'error',   'message'=>'Failed to add new community link!']);
    exit;
}

/* ══════════════════════════════════════
   NEW TABLE — fetch single by id
══════════════════════════════════════ */
if ($action === 'fetch_new_by_id') {
    $id  = (int)($_POST['id'] ?? 0);
    $res = $conn->query("SELECT * FROM whatsapp_community_link_new WHERE id=$id");
    $row = $res ? $res->fetch_assoc() : null;
    echo $row ? json_encode($row) : json_encode(['error'=>'Not found']);
    exit;
}

/* ══════════════════════════════════════
   NEW TABLE — update
══════════════════════════════════════ */
if ($action === 'update_new') {
    $id      = (int)($_POST['id']      ?? 0);
    $name    = $conn->real_escape_string($_POST['name']    ?? '');
    $link    = $conn->real_escape_string($_POST['link']    ?? '');
    $status  = $conn->real_escape_string($_POST['status']  ?? 'pending');
    $ranking = (int)($_POST['ranking'] ?? 0);

    $conn->query("UPDATE whatsapp_community_link_new SET name='$name', link='$link', status='$status', ranking=$ranking WHERE id=$id");
    echo json_encode($conn->affected_rows >= 0
        ? ['success'=>true, 'status'=>'success', 'message'=>'Link updated successfully']
        : ['success'=>false,'status'=>'error',   'message'=>'Failed to update link']);
    exit;
}

/* ══════════════════════════════════════
   NEW TABLE — delete
══════════════════════════════════════ */
if ($action === 'delete_new') {
    $id = (int)($_POST['id'] ?? 0);
    $conn->query("DELETE FROM whatsapp_community_link_new WHERE id=$id");
    echo json_encode($conn->affected_rows > 0
        ? ['success'=>true, 'status'=>'success', 'message'=>'Link deleted successfully']
        : ['success'=>false,'status'=>'error',   'message'=>'Failed to delete link']);
    exit;
}

/* ══════════════════════════════════════
   CURRENT TABLE — fetch all
   (matches fetch_last_two_exam_date_value logic from functions.php)
══════════════════════════════════════ */
if ($action === 'fetch_current') {
    // Use the same logic as functions.php: fetch current + next CIT community links
    $exam_date_value = function_exists('fetch_last_two_exam_date_value')
        ? fetch_last_two_exam_date_value('wa_community_initials')
        : ['currentCITValue'=>'', 'nextCITValue'=>''];

    $cur  = $conn->real_escape_string($exam_date_value['currentCITValue'] ?? '');
    $next = $conn->real_escape_string($exam_date_value['nextCITValue']    ?? '');

    if ($cur || $next) {
        $sql = "(SELECT * FROM whatsapp_community_link WHERE community_name LIKE '%$cur%' ORDER BY id DESC)
                UNION
                (SELECT * FROM whatsapp_community_link WHERE community_name LIKE '%$next%' ORDER BY id DESC)
                ORDER BY id DESC";
    } else {
        $sql = "SELECT * FROM whatsapp_community_link ORDER BY id DESC LIMIT 100";
    }

    $res = $conn->query($sql);
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(['success'=>true,'data'=>$rows]);
    exit;
}

/* ══════════════════════════════════════
   CURRENT TABLE — add placeholder
══════════════════════════════════════ */
if ($action === 'add_current') {
    $current_name = '';
    if (function_exists('fetch_last_two_exam_date_value')) {
        $v = fetch_last_two_exam_date_value('wa_community_initials');
        $current_name = $v['currentCITValue'] ?? '';
    }
    $current_name = $conn->real_escape_string($current_name);
    $conn->query("INSERT INTO whatsapp_community_link (community_name, community_link) VALUES ('$current_name', 'Placeholder Link')");
    echo json_encode($conn->affected_rows > 0
        ? ['success'=>true, 'status'=>'success', 'message'=>'Community link added successfully']
        : ['success'=>false,'status'=>'error',   'message'=>'Failed to add community link']);
    exit;
}

/* ══════════════════════════════════════
   CURRENT TABLE — fetch single by id
══════════════════════════════════════ */
if ($action === 'fetch_current_by_id') {
    $id  = (int)($_POST['id'] ?? 0);
    $res = $conn->query("SELECT * FROM whatsapp_community_link WHERE id=$id");
    $row = $res ? $res->fetch_assoc() : null;
    echo $row ? json_encode($row) : json_encode(['error'=>'Not found']);
    exit;
}

/* ══════════════════════════════════════
   CURRENT TABLE — update
   (also updates settings if status → active, matching functions.php)
══════════════════════════════════════ */
if ($action === 'update_current') {
    $id    = (int)($_POST['id'] ?? 0);
    $name  = $conn->real_escape_string($_POST['community_name'] ?? '');
    $link  = $conn->real_escape_string($_POST['community_link'] ?? '');
    $status= $conn->real_escape_string($_POST['status']         ?? 'pending');

    if ($status === 'active') {
        // Determine community initials (chars before first digit)
        $initials = preg_replace('/[0-9].*$/', '', $name);
        $initials = $conn->real_escape_string($initials);

        // Update settings for current CIT if name matches
        if (function_exists('fetch_last_two_exam_date_value')) {
            $exam = fetch_last_two_exam_date_value('wa_community_initials');
            if (($exam['currentCITValue'] ?? '') === $initials) {
                foreach (['whatsapp_link','whatsapp_ca','wa_cit_community'] as $key) {
                    $conn->query("UPDATE settings SET settings_value='$link' WHERE settings_key='$key'");
                }
            }
        }
    }

    $conn->query("UPDATE whatsapp_community_link SET community_name='$name', community_link='$link', status='$status' WHERE id=$id");
    echo json_encode($conn->affected_rows >= 0
        ? ['success'=>true, 'status'=>'success', 'message'=>'Community link updated successfully']
        : ['success'=>false,'status'=>'error',   'message'=>'Failed to update community link']);
    exit;
}

/* ══════════════════════════════════════
   CURRENT TABLE — disable (close) + auto-promote next pending
══════════════════════════════════════ */
if ($action === 'disable_current') {
    $id = (int)($_POST['id'] ?? 0);

    $check = $conn->query("SELECT status, community_name FROM whatsapp_community_link WHERE id=$id");
    if (!$check || !$check->num_rows) { echo json_encode(['success'=>false,'message'=>'Not found']); exit; }
    $row       = $check->fetch_assoc();
    $wasActive = $row['status'] === 'active';
    $initials  = $conn->real_escape_string(preg_replace('/[0-9].*$/', '', $row['community_name']));

    $conn->query("UPDATE whatsapp_community_link SET status='closed' WHERE id=$id");

    if ($wasActive) {
        // Count pending links with same initials
        $pending = $conn->query("SELECT COUNT(*) AS c FROM whatsapp_community_link WHERE status='pending' AND community_name LIKE '$initials%'");
        $pCount  = (int)$pending->fetch_assoc()['c'];

        if ($pCount > 0) {
            // Promote next pending → active
            $conn->query("UPDATE whatsapp_community_link SET status='active' WHERE status='pending' AND community_name LIKE '$initials%' ORDER BY id LIMIT 1");

            // Get the new active link
            $newActive = $conn->query("SELECT community_link FROM whatsapp_community_link WHERE status='active' AND community_name LIKE '$initials%' LIMIT 1");
            if ($newActive && $newActive->num_rows) {
                $newLink = $conn->real_escape_string($newActive->fetch_assoc()['community_link']);
                // Update settings
                if (function_exists('fetch_last_two_exam_date_value')) {
                    $exam = fetch_last_two_exam_date_value('wa_community_initials');
                    if (($exam['currentCITValue'] ?? '') === $initials) {
                        foreach (['whatsapp_link','whatsapp_ca','wa_cit_community'] as $k) {
                            $conn->query("UPDATE settings SET settings_value='$newLink' WHERE settings_key='$k'");
                        }
                    }
                }
            }
            echo json_encode(['success'=>true,'status'=>'success','message'=>'Community link disabled successfully']);
        } else {
            echo json_encode(['success'=>false,'status'=>'error','message'=>'No pending community link available to promote']);
        }
    } else {
        echo json_encode(['success'=>true,'status'=>'success','message'=>'Community link disabled successfully']);
    }
    exit;
}

/* ══════════════════════════════════════
   CURRENT TABLE — delete + auto-promote
══════════════════════════════════════ */
if ($action === 'delete_current') {
    $id = (int)($_POST['id'] ?? 0);

    $check = $conn->query("SELECT status, community_name FROM whatsapp_community_link WHERE id=$id");
    if (!$check || !$check->num_rows) { echo json_encode(['success'=>false,'message'=>'Not found']); exit; }
    $row       = $check->fetch_assoc();
    $wasActive = $row['status'] === 'active';
    $initials  = $conn->real_escape_string(preg_replace('/[0-9].*$/', '', $row['community_name']));

    $conn->query("DELETE FROM whatsapp_community_link WHERE id=$id");

    if ($wasActive) {
        // Promote next pending
        $conn->query("UPDATE whatsapp_community_link SET status='active' WHERE status='pending' AND community_name LIKE '$initials%' ORDER BY id LIMIT 1");
        $newActive = $conn->query("SELECT community_link FROM whatsapp_community_link WHERE status='active' AND community_name LIKE '$initials%' LIMIT 1");
        if ($newActive && $newActive->num_rows) {
            $newLink = $conn->real_escape_string($newActive->fetch_assoc()['community_link']);
            if (function_exists('fetch_last_two_exam_date_value')) {
                $exam = fetch_last_two_exam_date_value('wa_community_initials');
                if (($exam['currentCITValue'] ?? '') === $initials) {
                    foreach (['whatsapp_link','whatsapp_ca','wa_cit_community'] as $k) {
                        $conn->query("UPDATE settings SET settings_value='$newLink' WHERE settings_key='$k'");
                    }
                }
            }
        }
    }

    echo json_encode($conn->affected_rows >= 0
        ? ['success'=>true, 'status'=>'success', 'message'=>'Community link deleted successfully']
        : ['success'=>false,'status'=>'error',   'message'=>'Failed to delete community link']);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>