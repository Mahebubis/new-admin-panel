<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

require_method('POST');
$jwt = require_jwt();
require_permission('all_students', $jwt);

$input = get_json_input();
$action  = $input['action'] ?? '';
$user_id = intval($input['user_id'] ?? 0);

// ✅ Validate input
$allowed_actions = ['activate', 'deactivate', 'delete', 'change_password'];

if (!$user_id || !in_array($action, $allowed_actions)) {
    api_error('Invalid action or user ID');
}

try {

    switch ($action) {

        // ✅ ACTIVATE USER
        case 'activate':
            $stmt = $conn->prepare("UPDATE users SET active = 1 WHERE user_id = ?");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();

            api_success([], 'Student activated');
            break;

        // ✅ DEACTIVATE USER
        case 'deactivate':
            $stmt = $conn->prepare("UPDATE users SET active = 0 WHERE user_id = ?");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();

            api_success([], 'Student deactivated');
            break;

        // ✅ DELETE USER
        case 'delete':

    $conn->begin_transaction();

    try {

        // ✅ सभी child tables यहाँ add करो
        $tables = [
            "signin_log",
            "payment_status",
            "additional_details",
            "user_steps"
        ];

        // ✅ पहले child data delete करो
        foreach ($tables as $table) {
            $stmt = $conn->prepare("DELETE FROM $table WHERE user_id = ?");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
        }

        // ✅ फिर main user delete करो
        $stmt = $conn->prepare("DELETE FROM users WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();

        $conn->commit();

        api_success([], 'Student and related data deleted');

    } catch (Exception $e) {

        $conn->rollback();
        api_error('Delete failed: ' . $e->getMessage());
    }

    break;

            api_success([], 'Student deleted');
            break;

        // ✅ CHANGE PASSWORD
        case 'change_password':

    // 🔐 Fixed password
    $plain_password = '12345678';

    // 🔐 Hash it (IMPORTANT — never store plain password)
    $hashed_password = password_hash($plain_password, PASSWORD_DEFAULT);

    // 🔐 Update DB
    $stmt = $conn->prepare("UPDATE users SET password = ? WHERE user_id = ?");
    $stmt->bind_param("si", $hashed_password, $user_id);
    $stmt->execute();

    api_success([], 'Password reset to 12345678');
    break;

        default:
            api_error('Invalid action');
    }

} catch (Exception $e) {
    api_error('Server error: ' . $e->getMessage());
}