<?php
/*
 * /api/support-agents.php
 *
 * POST action=get_agents   → list all agents
 * POST action=add_agent    → agent_name, agent_email
 * POST action=edit_agent   → agent_id, agent_name, agent_email
 * POST action=delete_agent → agent_id (reassigns tickets to agent 1 first)
 *
 * Table: support_agent (agent_id, agent_name, agent_email)
 * Note: agent_id = 1 is the Default Agent and cannot be deleted.
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
   GET ALL AGENTS
══════════════════════════════════════ */
if ($action === 'get_agents') {
    $res    = $conn->query("SELECT agent_id, agent_name, agent_email FROM support_agent ORDER BY agent_id ASC");
    $agents = [];
    if ($res) while ($r = $res->fetch_assoc()) $agents[] = $r;
    echo json_encode(['success'=>true,'agents'=>$agents]);
    exit;
}

/* ══════════════════════════════════════
   ADD AGENT  — mirrors add_support_agent exactly
══════════════════════════════════════ */
if ($action === 'add_agent') {
    $name  = trim($_POST['agent_name']  ?? '');
    $email = trim($_POST['agent_email'] ?? '');

    // Same validation as PHP
    if (strlen($name) < 3 || strlen($email) < 3) {
        echo json_encode(['success'=>false,'status'=>'error','message'=>'Name and email must be at least 3 characters long']);
        exit;
    }

    // Check email uniqueness
    $esc   = $conn->real_escape_string($email);
    $check = $conn->query("SELECT agent_id FROM support_agent WHERE agent_email = '$esc'");
    if ($check && $check->num_rows > 0) {
        echo json_encode(['success'=>false,'status'=>'error','message'=>'Email already exists']);
        exit;
    }

    $nm  = $conn->real_escape_string($name);
    $conn->query("INSERT INTO support_agent (agent_name, agent_email) VALUES ('$nm', '$esc')");
    echo json_encode($conn->affected_rows > 0
        ? ['success'=>true,  'status'=>'success','message'=>'Agent added successfully']
        : ['success'=>false, 'status'=>'error',  'message'=>'Something went wrong']);
    exit;
}

/* ══════════════════════════════════════
   EDIT AGENT  — mirrors edit_support_agent exactly
══════════════════════════════════════ */
if ($action === 'edit_agent') {
    $id    = (int)($_POST['agent_id']    ?? 0);
    $name  = trim($_POST['agent_name']   ?? '');
    $email = trim($_POST['agent_email']  ?? '');

    if (strlen($name) < 3 || strlen($email) < 3) {
        echo json_encode(['success'=>false,'status'=>'error','message'=>'Name and email must be at least 3 characters long']);
        exit;
    }

    // Check email uniqueness excluding current agent
    $esc   = $conn->real_escape_string($email);
    $check = $conn->query("SELECT agent_id FROM support_agent WHERE agent_email = '$esc' AND agent_id != $id");
    if ($check && $check->num_rows > 0) {
        echo json_encode(['success'=>false,'status'=>'error','message'=>'Email already exists']);
        exit;
    }

    $nm  = $conn->real_escape_string($name);
    $conn->query("UPDATE support_agent SET agent_name='$nm', agent_email='$esc' WHERE agent_id=$id");
    echo json_encode($conn->affected_rows >= 0
        ? ['success'=>true,  'status'=>'success','message'=>'Agent updated successfully']
        : ['success'=>false, 'status'=>'error',  'message'=>'Something went wrong']);
    exit;
}

/* ══════════════════════════════════════
   DELETE AGENT  — reassigns tickets first (same as PHP)
══════════════════════════════════════ */
if ($action === 'delete_agent') {
    $id = (int)($_POST['agent_id'] ?? 0);

    if ($id === 1) {
        echo json_encode(['success'=>false,'status'=>'error','message'=>'Cannot delete the default agent']);
        exit;
    }

    // Reassign all tickets to default agent (agent_id = 1) — matches PHP
    $conn->query("UPDATE tickets SET agent_id = 1 WHERE agent_id = $id");
    $conn->query("UPDATE support_tickets SET agent_id = 1 WHERE agent_id = $id");

    $conn->query("DELETE FROM support_agent WHERE agent_id = $id");
    echo json_encode($conn->affected_rows > 0
        ? ['success'=>true,  'status'=>'success','message'=>'Agent deleted successfully']
        : ['success'=>false, 'status'=>'error',  'message'=>'Something went wrong']);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>