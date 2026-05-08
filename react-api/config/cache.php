<?php
/**
 * Simple file-based cache for expensive queries
 */
define('CACHE_DIR', __DIR__ . '/../cache/');
define('CACHE_DEFAULT_TTL', 60);

function cache_get($key) {
    $file = CACHE_DIR . md5($key) . '.cache';
    if (!file_exists($file)) return null;
    $data = @unserialize(file_get_contents($file));
    if (!$data || $data['expires'] < time()) { @unlink($file); return null; }
    return $data['value'];
}

function cache_set($key, $value, $ttl = CACHE_DEFAULT_TTL) {
    if (!is_dir(CACHE_DIR)) @mkdir(CACHE_DIR, 0755, true);
    $file = CACHE_DIR . md5($key) . '.cache';
    @file_put_contents($file, serialize(['expires' => time() + $ttl, 'value' => $value]));
}

function cache_clear() {
    if (!is_dir(CACHE_DIR)) return;
    foreach (glob(CACHE_DIR . '*.cache') as $file) @unlink($file);
}
