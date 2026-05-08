<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('POST');
$jwt = require_jwt();
require_permission('all_students', $jwt);

$input   = get_json_input();
$user_id = intval($input['user_id'] ?? 0);
if (!$user_id) api_error('User ID required');

/* ════════════════════════════════════════
   1. UPDATE users table
   Same fields as edit_by_admin.php PHP form
════════════════════════════════════════ */
$user_fields = [
    'fname','lname','name','email','phone','city','state','pincode','gender',
    'college_name','program','year','branch','other_branch',
    'role','applyforexam','active','is_test_account',
    'payment_id','payment_status','payment_amount',
    'used_ref_id','ca_ref_id','cc_ref_id','used_ref_id_by_ca','certificate',
    'current_exam_date','whatsapp',
];

$sets   = [];
$params = [];
$types  = '';

foreach ($user_fields as $field) {
    if (array_key_exists($field, $input)) {
        $sets[]   = "`$field` = ?";
        $params[] = $input[$field];
        $types   .= 's';
    }
}

// Password — hash it (same as PHP edit_by_admin.php)
if (!empty($input['password'])) {
    $sets[]   = "`password` = ?";
    $params[] = password_hash($input['password'], PASSWORD_BCRYPT);
    $types   .= 's';
}

if (!empty($sets)) {
    $params[] = $user_id;
    $types   .= 'i';
    $sql      = "UPDATE users SET " . implode(', ', $sets) . " WHERE user_id = ?";
    $stmt     = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    if (!$stmt->execute()) {
        api_error('Failed to update user: ' . $stmt->error);
    }
    $stmt->close();
}

/* ════════════════════════════════════════
   2. UPDATE user_steps table
   Same fields as PHP checkboxes
════════════════════════════════════════ */
$steps_fields = [
    'cit_registration','cit_whatsapp_community','cit_exam_details','cit_exam_result',
    'cit_internship_selection','istudio_training_portal','istudio_project_submission',
    'istudio_certificates','user_profile','hiring_portal',
];

$step_sets   = [];
$step_params = [];
$step_types  = '';

foreach ($steps_fields as $field) {
    if (array_key_exists($field, $input)) {
        $step_sets[]   = "`$field` = ?";
        $step_params[] = $input[$field];
        $step_types   .= 's';
    }
}

if (!empty($step_sets)) {
    // Check if user_steps row exists — same as PHP which does SELECT first
    $check = $conn->query("SELECT user_id FROM user_steps WHERE user_id = $user_id LIMIT 1");
    if ($check && $check->num_rows > 0) {
        $step_params[] = $user_id;
        $step_types   .= 'i';
        $sql           = "UPDATE user_steps SET " . implode(', ', $step_sets) . " WHERE user_id = ?";
        $stmt          = $conn->prepare($sql);
        $stmt->bind_param($step_types, ...$step_params);
        $stmt->execute();
        $stmt->close();
    } else {
        // Insert if not exists — matches original PHP behaviour
        $step_params[] = $user_id;
        $step_types   .= 'i';
        // Build INSERT with defaults for missing fields
        $all_defaults = array_fill_keys($steps_fields, '0');
        foreach ($steps_fields as $i => $field) {
            if (array_key_exists($field, $input)) $all_defaults[$field] = $input[$field];
        }
        $cols = implode(', ', array_map(fn($f) => "`$f`", array_keys($all_defaults)));
        $vals = implode(', ', array_fill(0, count($all_defaults), '?'));
        $ins_params = array_values($all_defaults);
        $ins_params[] = $user_id;
        $ins_types = str_repeat('s', count($all_defaults)) . 'i';
        $sql = "INSERT INTO user_steps ($cols, user_id) VALUES ($vals, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($ins_types, ...$ins_params);
        $stmt->execute();
        $stmt->close();
    }
}

/* ════════════════════════════════════════
   3. UPDATE exam panel email on $conn2
   PHP edit_user.php uses $conn2 (separate exam DB)
   to update user_email in the exam panel's users table
════════════════════════════════════════ */
if (!empty($input['exam_email']) && isset($conn2) && $conn2) {
    $exam_email = $conn2->real_escape_string($input['exam_email']);

    // First check if user exists in exam panel by current email
    $cur = $conn->query("SELECT email FROM users WHERE user_id = $user_id LIMIT 1");
    if ($cur && $cur->num_rows > 0) {
        $cur_email = $conn2->real_escape_string($cur->fetch_assoc()['email'] ?? '');
        // Update exam panel users table
        $conn2->query("UPDATE users SET user_email = '$exam_email' WHERE user_email = '$cur_email'");
    }
}

api_success([], 'Student updated successfully');