<?php
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);
/*
 * /api/domain-management.php
 *
 * GET  action=get_all              → domains + subdomains + skills + simulations + jobs
 * POST action=bulk_save_domains    → items (JSON array, each: domain_name, description, icon, status)
 * POST action=update_domain        → id, domain_name, description, icon, status
 * POST action=bulk_delete          → type (domain|subdomain|skill|simulation|job), ids (JSON array)
 *
 * Tables: domains, subdomains, skills, internship_simulations, hiring_opportunities
 */

require_once '/home/istudio/public_html/cit3/admin/react-api/config/database.php';
require_once '/home/istudio/public_html/cit3/admin/react-api/middleware/auth.php';

require_method($_SERVER['REQUEST_METHOD'] === 'GET' ? 'GET' : 'POST');
$jwt    = require_jwt();
$action = $_GET['action'] ?? $_POST['action'] ?? '';

/* ════════════════════════════════════
   GET ALL  — mirrors PHP get_all exactly
════════════════════════════════════ */
if ($action === 'get_all') {
    $data = [];

    $r = $conn->query("SELECT * FROM domains ORDER BY id DESC");
    $data['domains'] = $r ? $r->fetch_all(MYSQLI_ASSOC) : [];

    $r = $conn->query("SELECT s.*, d.domain_name FROM subdomains s LEFT JOIN domains d ON s.domain_id = d.id ORDER BY s.id DESC");
    $data['subdomains'] = $r ? $r->fetch_all(MYSQLI_ASSOC) : [];

    $r = $conn->query("SELECT sk.*, s.subdomain_name FROM skills sk LEFT JOIN subdomains s ON sk.subdomain_id = s.id ORDER BY sk.id DESC");
    $data['skills'] = $r ? $r->fetch_all(MYSQLI_ASSOC) : [];

    $r = $conn->query("SELECT sim.*, s.subdomain_name, d.domain_name FROM internship_simulations sim LEFT JOIN subdomains s ON sim.subdomain_id = s.id LEFT JOIN domains d ON s.domain_id = d.id ORDER BY sim.id DESC");
    $data['simulations'] = $r ? $r->fetch_all(MYSQLI_ASSOC) : [];

    $r = $conn->query("SELECT j.*, s.subdomain_name, d.domain_name FROM hiring_opportunities j LEFT JOIN subdomains s ON j.subdomain_id = s.id LEFT JOIN domains d ON s.domain_id = d.id ORDER BY j.id DESC");
    $data['jobs'] = $r ? $r->fetch_all(MYSQLI_ASSOC) : [];

    api_success($data);
}

/* ════════════════════════════════════
   BULK SAVE DOMAINS
   Supports both INSERT (no id) and UPDATE (has id)
════════════════════════════════════ */
if ($action === 'bulk_save_domains') {
    $items = json_decode($_POST['items'] ?? '[]', true);
    if (!is_array($items) || empty($items)) api_error('No items provided');

    $saved = 0;
    foreach ($items as $item) {
        $name   = $conn->real_escape_string($item['domain_name'] ?? '');
        $desc   = $conn->real_escape_string($item['description'] ?? '');
        $icon   = $conn->real_escape_string($item['icon'] ?? '');
        $status = in_array($item['status'] ?? '', ['active','inactive']) ? $item['status'] : 'active';

        if (!empty($item['id'])) {
            $id  = (int)$item['id'];
            $sql = "UPDATE domains SET domain_name='$name', description='$desc', icon='$icon', status='$status' WHERE id=$id";
        } else {
            $sql = "INSERT INTO domains (domain_name, description, icon, status) VALUES ('$name', '$desc', '$icon', '$status')";
        }
        if ($conn->query($sql)) $saved++;
    }

    api_success(['saved' => $saved], "$saved domain(s) saved successfully");
}

/* ════════════════════════════════════
   UPDATE SINGLE DOMAIN
════════════════════════════════════ */
if ($action === 'update_domain') {
    $id     = (int)($_POST['id'] ?? 0);
    $name   = $conn->real_escape_string(trim($_POST['domain_name'] ?? ''));
    $desc   = $conn->real_escape_string(trim($_POST['description'] ?? ''));
    $icon   = $conn->real_escape_string(trim($_POST['icon'] ?? ''));
    $status = in_array($_POST['status'] ?? '', ['active','inactive']) ? $_POST['status'] : 'active';

    if (!$id)   api_error('ID required');
    if (!$name) api_error('Domain name required');

    $conn->query("UPDATE domains SET domain_name='$name', description='$desc', icon='$icon', status='$status' WHERE id=$id");
    api_success([], 'Domain updated successfully');
}

/* ════════════════════════════════════
   BULK DELETE
   type: domain | subdomain | skill | simulation | job
════════════════════════════════════ */
if ($action === 'bulk_delete') {
    $type = $_POST['type'] ?? '';
    $ids  = json_decode($_POST['ids'] ?? '[]', true);

    $tables = [
        'domain'     => 'domains',
        'subdomain'  => 'subdomains',
        'skill'      => 'skills',
        'simulation' => 'internship_simulations',
        'job'        => 'hiring_opportunities',
    ];

    if (!isset($tables[$type])) api_error('Invalid type');
    if (!is_array($ids) || empty($ids)) api_error('No IDs provided');

    $idList = implode(',', array_map('intval', $ids));
    $conn->query("DELETE FROM {$tables[$type]} WHERE id IN ($idList)");

    $count = count($ids);
    api_success(['deleted' => $count], "$count item(s) deleted successfully");
}

api_error('Unknown action');
?>