<?php
/*
 * /api/support-panel.php
 *
 * POST action=get_agents   → all agents (agent_id, agent_name, agent_email)
 * POST action=get_stats    → open/closed/pending counts
 * POST action=get_tickets  → paginated tickets (page, per_page, agent_id?)
 *
 * Tables: support_tickets, support_agent
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
   GET AGENTS
══════════════════════════════════════ */
if ($action === 'get_agents') {
    $res   = $conn->query("SELECT agent_id, agent_name, agent_email FROM support_agent");
    $agents = [];
    if ($res) while ($r = $res->fetch_assoc()) $agents[] = $r;
    echo json_encode(['success'=>true,'agents'=>$agents]);
    exit;
}

/* ══════════════════════════════════════
   GET STATS  (ticket counts by status)
══════════════════════════════════════ */
if ($action === 'get_stats') {
    $res  = $conn->query("SELECT status, COUNT(*) AS count FROM support_tickets GROUP BY status");
    $open = 0; $closed = 0; $pending = 0;
    if ($res) while ($r = $res->fetch_assoc()) {
        if ($r['status'] === 'open')    $open    = (int)$r['count'];
        if ($r['status'] === 'closed')  $closed  = (int)$r['count'];
        if ($r['status'] === 'pending') $pending = (int)$r['count'];
    }
    echo json_encode(['success'=>true,'open'=>$open,'closed'=>$closed,'pending'=>$pending,'total'=>$open+$closed+$pending]);
    exit;
}

/* ══════════════════════════════════════
   GET TICKETS  (paginated + agent filter)
   — ORDER BY FIELD(status,'open','pending','closed'), updated_at DESC
   — exactly mirrors fetchTickets() from PHP page
══════════════════════════════════════ */
if ($action === 'get_tickets') {
    $page     = max(1, (int)($_POST['page']     ?? 1));
    $perPage  = max(1, min(100, (int)($_POST['per_page'] ?? 10)));
    $agentId  = (int)($_POST['agent_id'] ?? 0);
    $offset   = ($page - 1) * $perPage;

    $where    = $agentId > 0 ? "WHERE agent_id = $agentId" : '';

    /* total count */
    $cntRes   = $conn->query("SELECT COUNT(*) AS total FROM support_tickets $where");
    $total    = $cntRes ? (int)$cntRes->fetch_assoc()['total'] : 0;

    /* paginated rows — same ORDER BY as PHP */
    $dataRes  = $conn->query("
        SELECT * FROM support_tickets
        $where
        ORDER BY FIELD(status, 'open', 'pending', 'closed'), updated_at DESC
        LIMIT $perPage OFFSET $offset
    ");
    $tickets  = [];
    if ($dataRes) while ($r = $dataRes->fetch_assoc()) $tickets[] = $r;

    echo json_encode([
        'success'     => true,
        'tickets'     => $tickets,
        'total'       => $total,
        'page'        => $page,
        'per_page'    => $perPage,
        'total_pages' => (int)ceil($total / $perPage),
    ]);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>