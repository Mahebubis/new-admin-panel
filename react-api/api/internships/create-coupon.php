<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('POST');
$jwt = require_jwt();
require_permission('manage_coupons', $jwt);

$input = get_json_input();
$code = strtoupper(preg_replace('/[^A-Z0-9]/', '', $input['code'] ?? ''));
$type = $input['type'] ?? 'percentage';
$value = floatval($input['value'] ?? 0);
$max_uses = intval($input['max_uses'] ?? 100);
$expires_at = $input['expires_at'] ?? '';

if (!$code || !$value) api_error('Code and value are required');
if ($type === 'percentage' && $value > 100) api_error('Percentage cannot exceed 100');

$check = $conn->prepare("SELECT id FROM istudio_coupons WHERE code = ?");
$check->bind_param("s", $code);
$check->execute();
if ($check->get_result()->num_rows > 0) api_error('Coupon code already exists');

$stmt = $conn->prepare("INSERT INTO istudio_coupons (code, discount_value, discount_type, expiry_date, usage_limit) VALUES (?, ?, ?, ?, ?)");
$stmt->bind_param("sdssi", $code, $value, $type, $expires_at, $max_uses);
$stmt->execute();

api_success(['coupon_id' => $conn->insert_id, 'code' => $code], 'Coupon created');
