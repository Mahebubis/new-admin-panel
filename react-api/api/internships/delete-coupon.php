<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('DELETE');
$jwt = require_jwt();
require_permission('manage_coupons', $jwt);

$input = get_json_input();
$id = intval($input['id'] ?? 0);
if (!$id) api_error('Coupon ID required');

$conn->prepare("DELETE FROM istudio_coupons WHERE id = ?")->bind_param("i", $id);
$conn->query("DELETE FROM istudio_coupons WHERE id = $id");

api_success([], 'Coupon deleted');
