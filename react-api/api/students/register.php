<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

require_method('POST');
$jwt = require_jwt();
require_permission('unregistered_students', $jwt);

$input = get_json_input();
$user_id = intval($input['user_id'] ?? 0);
if (!$user_id) api_error('User ID is required');

$conn->query("UPDATE users SET applyforexam=1 WHERE user_id=$user_id");
api_success([], 'Student registered successfully');
