<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('POST');
$jwt = require_jwt();
require_permission('settings', $jwt);

$input = get_json_input();
$settings = $input['settings'] ?? [];

$count = 0;
foreach ($settings as $key => $value) {
    if (strpos($value, '***') === 0) continue; // Skip masked values
    $key = $conn->real_escape_string($key);
    $value = $conn->real_escape_string(trim($value));
    $exists = $conn->query("SELECT * FROM settings WHERE settings_key='$key'");
    if ($exists && $exists->num_rows > 0) {
        $conn->query("UPDATE settings SET settings_value='$value' WHERE settings_key='$key'");
    } else {
        $conn->query("INSERT INTO settings (settings_key, settings_value) VALUES ('$key', '$value')");
    }
    $count++;
}

api_success([], "$count settings saved");
