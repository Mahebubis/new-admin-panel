<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('POST');
$jwt = require_jwt();
require_permission('manage_refund', $jwt);

$input = get_json_input();
$refund_id = intval($input['refund_id'] ?? 0);
$status = $input['status'] ?? '';
$note = $input['note'] ?? '';

if (!$refund_id || !in_array($status, ['approved', 'rejected', 'processed'])) api_error('Invalid params');

$check = $conn->prepare("SELECT refund_id, status FROM refunds WHERE refund_id = ?");
$check->bind_param("i", $refund_id);
$check->execute();
$row = $check->get_result()->fetch_assoc();
if (!$row) api_error('Refund not found', 404);
if ($row['status'] === 'processed') api_error('Refund already processed');

$admin_id = $jwt['user_id'];
$stmt = $conn->prepare("UPDATE refunds SET status=?, admin_note=?, processed_by=?, processed_at=NOW() WHERE refund_id=?");
$stmt->bind_param("ssii", $status, $note, $admin_id, $refund_id);
$stmt->execute();

$conn->query("INSERT INTO admin_action_log (admin_id, action, target_type, target_id, note, created_at) VALUES ($admin_id, 'refund_$status', 'refund', $refund_id, '" . $conn->real_escape_string($note) . "', NOW())");

api_success([], "Refund $status successfully");
