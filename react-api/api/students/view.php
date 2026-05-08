<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
require_permission('all_students', $jwt);

$id = intval($_GET['id'] ?? 0);
if (!$id) api_error('User ID required');

// Get all user fields (same as PHP edit_user.php get_user_by_id)
$stmt = $conn->prepare("SELECT * FROM users WHERE user_id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user) api_error('Student not found', 404);

// Get user steps
$steps = [];
$stmt2 = $conn->prepare("SELECT * FROM user_steps WHERE user_id = ?");
if ($stmt2) {
    $stmt2->bind_param("i", $id);
    $stmt2->execute();
    $steps = $stmt2->get_result()->fetch_assoc() ?: [];
}

// Merge steps into user data
$student = array_merge($user, $steps);

// Remove password hash from response
unset($student['password']);

api_success(['student' => $student]);
