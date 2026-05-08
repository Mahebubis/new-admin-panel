<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
require_permission('settings', $jwt);

// PHP settings.php uses "settings" table with settings_key / settings_value columns
$settings = [];
$res = $conn->query("SELECT * FROM settings ORDER BY id ASC");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $key = $row['settings_key'];
        $val = $row['settings_value'];
        // Mask sensitive values
        if (preg_match('/(password|secret|token|api_key)/i', $key) && $val) {
            $val = str_repeat('*', 12);
        }
        $settings[] = ['id' => $row['id'], 'setting_key' => $key, 'setting_value' => $val];
    }
}

// Dropdown definitions (same as PHP)
$dropdowns = [
    'payment_method' => ['razorpay','cashfree','instamojo','phonepe','hdfc_smartgateway'],
    'exam_status' => ['on','off'],
    'disable_current_exam_date' => ['0' => 'No', '1' => 'Yes'],
    'enable_netcore' => ['0' => 'No', '1' => 'Yes'],
    'enable_intercom' => ['0' => 'No', '1' => 'Yes'],
    'instant_exam' => ['on','off'],
    'instant_result' => ['on','off'],
    'enable_autofill' => ['on' => 'On', 'off' => 'Off'],
];

api_success(['settings' => $settings, 'dropdowns' => $dropdowns]);
