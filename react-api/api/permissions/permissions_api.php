<?php

/*
 * /api/permissions_api.php  (v3)
 *
 * Changes vs v2:
 *  - Removed 'Dashboard' from allSections() — dashboard is open to every
 *    authenticated user and must NOT appear in the permissions matrix.
 *  - Aligned all permission keys with the React sidebar so every sidebar
 *    item has a matching toggle on the Permissions page.
 *  - toggle_admin now EXCLUDES the 'permissions' key when granting all
 *    perms to a regular admin — only Super Admins may access /permissions.
 */

require_once '/home/istudio/public_html/cit3/admin/react-api/config/database.php';
require_once '/home/istudio/public_html/cit3/admin/react-api/middleware/auth.php';

header('Content-Type: application/json');

$jwt    = require_jwt();
$uid_me = (int)$jwt['user_id'];

ini_set('display_errors', 0);
ob_start();
@include_once '/home/istudio/public_html/cit/admin/permission_helper.php';
ob_clean();

$i_am_superadmin = is_superadmin($jwt);
$action          = trim($_POST['action'] ?? '');

/* ════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════ */

function batchGetPermissions(array $userIds): array {
    global $conn;
    if (empty($userIds)) return [];

    $userIds = array_map('intval', $userIds);
    $idsStr  = implode(',', $userIds);

    $out = [];
    foreach ($userIds as $uid) $out[$uid] = [];

    $res = $conn->query(
        "SELECT user_id, permission_key
         FROM admin_permissions
         WHERE granted = 1 AND user_id IN ($idsStr)"
    );
    if ($res) {
        while ($r = $res->fetch_assoc()) {
            $out[(int)$r['user_id']][$r['permission_key']] = true;
        }
    }
    return $out;
}

function targetIsSuperadmin(int $uid): bool {
    global $conn;
    $stmt = $conn->prepare("SELECT 1 FROM admin_users WHERE user_id = ? AND is_superadmin = 1 LIMIT 1");
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $stmt->store_result();
    $found = $stmt->num_rows > 0;
    $stmt->close();
    return $found;
}

/* ────────────────────────────────────────────────────────
   All permission sections displayed on the /permissions page.
   NOTE: 'Dashboard' is intentionally OMITTED — it is open to every
   authenticated user and does not need a permission toggle.
   'Permissions' is a separate superadmin-only gate, shown here for
   visibility but excluded from admin bulk-grant in toggle_admin.
   ──────────────────────────────────────────────────────── */
function allSections(): array {
    if (function_exists('get_all_permission_sections')) {
        return get_all_permission_sections();
    }
    return [
        'Student Management' => [
            'all_students'            => 'All Students',
            'all_iit_students'        => 'All IIT Students',
            'unregistered_students'   => 'Unregistered Students',
            'registration_checker'    => 'Registration Checker',
            'download_student_data'   => 'Download Student Data',
            'students_with_ip'        => 'Students With IP',
        ],
        'Referral Management' => [
            'manage_referrals'  => 'Manage Referrals',
            'manage_withdrawal' => 'Manage Withdrawal',
        ],
        'Refund Management' => [
            'manage_refund' => 'Manage Refund',
        ],
        'Domain Management' => [
            'manage_domains' => 'Manage Domains',
        ],
        'Netcore' => [
            'netcore_behaviour' => 'Netcore Behaviour',
            'netcore_filter'    => 'Netcore Filter',
        ],
        'Homepage' => [
            'homepage' => 'Homepage',
        ],
        'Internships' => [
            'internship_list'       => 'Internship List',
            'purchased_internships' => 'Purchased Internships',
            'allocate_internships'  => 'Allocate Internships',
            'project_submission'    => 'Project Submission',
            'check_payments'        => 'Check Payments',
            'manage_coupons'        => 'Manage Coupons',
        ],
        'Blogs' => [
            'add_blogs'    => 'Add Blogs',
            'manage_blogs' => 'Manage Blogs',
        ],
        'FAQs' => [
            'manage_faqs' => 'Manage FAQs',
        ],
        'Total Assessments' => [
            'total_assessments' => 'Total Assessments',
        ],
        'Communication' => [
            'send_notification'   => 'Send Notification',
            'delete_notification' => 'Manage Notification',
            'whatsapp_community'  => 'WhatsApp Community',
            'email_templates'     => 'Email Templates',
            'campaign_emails'     => 'Small Campaign Emails',
            'push_notification'   => 'Push Notification',
        ],
        'Examinations' => [
            'exam_result'                 => 'Exam Result',
            'exam_not_given'              => 'Exam Not Given',
            'cit_versions'                => 'CIT Versions',
            'free_internship_applicants'  => 'Free Internship Applicants',
            'exam_panel_admin'            => 'Exam Panel Admin',
            'exam_results_new'            => 'Exam Results For New Panel',
            'auto_submitted_exams'        => 'Auto Submitted Exams',
        ],
        'Reporting & Analysis' => [
            'batch_dates'      => 'Batch Dates',
            'reports'          => 'Reports',
            'agency_reports_1' => 'Agency Reports 1',
            'agency_reports_2' => 'Agency Reports 2',
            'meta_reports_old' => 'Meta Reports (Old)',
            'meta_reports_new' => 'Meta Reports (New)',
            'matching_data'    => 'Matching Data',
            'clarity_data'     => 'Clarity Data',
            'user_availability'=> 'User Availability',
        ],
        'Company Management' => [
            'all_companies'     => 'All Companies',
            'all_iit_companies' => 'All IIT Companies',
            'tpo_hod_details'   => 'TPO & HOD Details',
        ],
        'Support' => [
            'whatsapp_community_links'                 => 'WhatsApp Community Links',
            'whatsapp_placement_club_links'            => 'Whatsapp Placement Club Links',
            'whatsapp_placement_club_links_for_refund' => 'Whatsapp For Refund',
            'support_tickets'                          => 'Support Tickets',
            'support_agents'                           => 'Support Agents',
            'instant_exam_wa_link'                     => 'Instant Exam WA Link',
            'custom_placement_date'                    => 'Custom Placement Date',
            'placement_link_log'                       => 'Placement Link Log',
        ],
        'Settings' => [
            'settings'                 => 'Settings',
            'change_aws_instance'      => 'Change AWS Instance',
            'seed_exam_users'          => 'Seed Exam Users',
            'delete_excess_exam_users' => 'Delete Excess Exam Users',
        ],
        'Admin Panel' => [
            'career_roadmaps'      => 'Career Roadmaps',
            'add_data_result_page' => 'Add Data For Result Page',
            'internships'          => 'Internships',
            'skills'               => 'Skills',
            'submitted_assignments'=> 'Submitted Assignments',
        ],
    ];
}

/* ════════════════════════════════════════════════════
   GET SECTIONS
════════════════════════════════════════════════════ */
if ($action === 'get_sections') {
    $sections = allSections();
    $total    = array_sum(array_map('count', $sections));
    api_success(['sections' => $sections, 'total_perms' => $total]);
}

/* ════════════════════════════════════════════════════
   GET ADMIN USERS  (FAST: no scan of users table)
════════════════════════════════════════════════════ */
if ($action === 'get_admin_users') {
    $total = array_sum(array_map('count', allSections()));

    $idSet = [];

    if ($r = $conn->query("SELECT user_id FROM admin_users WHERE is_active = 1")) {
        while ($row = $r->fetch_assoc()) $idSet[(int)$row['user_id']] = true;
    }

    if ($r = $conn->query("SELECT DISTINCT user_id FROM admin_permissions WHERE granted = 1")) {
        while ($row = $r->fetch_assoc()) $idSet[(int)$row['user_id']] = true;
    }

    if ($r = $conn->query("SELECT user_id FROM users WHERE is_admin = 1")) {
        while ($row = $r->fetch_assoc()) $idSet[(int)$row['user_id']] = true;
    }

    $userIds = array_keys($idSet);

    if (empty($userIds)) {
        api_success(['users' => [], 'total_perms' => $total]);
    }

    $idsStr = implode(',', array_map('intval', $userIds));

    $res = $conn->query("
        SELECT
            u.user_id, u.fname, u.lname, u.name, u.username, u.email,
            u.is_admin,
            COALESCE(au.is_superadmin, 0) AS is_superadmin,
            COALESCE(au.is_active,    0) AS is_active
        FROM users u
        LEFT JOIN admin_users au ON au.user_id = u.user_id
        WHERE u.user_id IN ($idsStr)
          AND COALESCE(au.is_superadmin, 0) = 0
        ORDER BY u.fname ASC
    ");

    $users = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $uid = (int)$row['user_id'];
            $row['permissions'] = [];
            $users[$uid] = $row;
        }
    }

    $permsByUser = batchGetPermissions(array_keys($users));
    foreach ($permsByUser as $uid => $permMap) {
        if (isset($users[$uid])) $users[$uid]['permissions'] = $permMap;
    }

    api_success(['users' => array_values($users), 'total_perms' => $total]);
}

/* ════════════════════════════════════════════════════
   SEARCH USER
════════════════════════════════════════════════════ */
if ($action === 'search_user') {
    $rawQ = trim($_POST['query'] ?? '');
    if ($rawQ === '') api_success(['users' => []]);

    $qExact = $conn->real_escape_string($rawQ);
    $qLike  = '%' . $qExact . '%';

    $looksLikeEmail = filter_var($rawQ, FILTER_VALIDATE_EMAIL);

    if ($looksLikeEmail) {
        $where = "u.email = '$qExact'";
    } else {
        $where = "u.username LIKE '$qLike' OR u.fname LIKE '$qLike' OR u.lname LIKE '$qLike'";
    }

    // $res = $conn->query("
    //     SELECT
    //         u.user_id, u.username, u.fname, u.lname, u.email,
    //         COALESCE(au.is_superadmin, 0) AS is_superadmin,
    //         COALESCE(au.is_active,    0) AS is_admin
    //     FROM users u
    //     LEFT JOIN admin_users au ON au.user_id = u.user_id
    //     WHERE $where
    // ");
    
    $res = $conn->query("
        SELECT
            u.user_id, u.username, u.fname, u.lname, u.email,
            COALESCE(au.is_superadmin, 0) AS is_superadmin,
            COALESCE(au.is_active,    0) AS is_admin
        FROM users u
        LEFT JOIN admin_users au ON au.user_id = u.user_id
        WHERE ($where)
          AND COALESCE(au.is_superadmin, 0) = 0
    ");

    $users   = [];
    $userIds = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $uid = (int)$row['user_id'];
            $row['is_superadmin'] = (int)$row['is_superadmin'] === 1;
            $row['is_admin']      = (int)$row['is_admin']      === 1;
            $row['permissions']   = [];
            $users[$uid] = $row;
            $userIds[]   = $uid;
        }
    }

    $permsByUser = batchGetPermissions($userIds);
    foreach ($permsByUser as $uid => $permMap) {
        if (isset($users[$uid])) $users[$uid]['permissions'] = $permMap;
    }

    api_success(['users' => array_values($users)]);
}

/* ── write actions require superadmin ── */
if (!$i_am_superadmin) {
    api_error('Superadmin only.', 403);
}

/* ════════════════════════════════════════════════════
   TOGGLE SINGLE PERMISSION
════════════════════════════════════════════════════ */
if ($action === 'toggle_permission') {
    $uid = (int)($_POST['user_id']       ?? 0);
    $key = trim($_POST['permission_key'] ?? '');
    $g   = (int)($_POST['granted']       ?? 0);

    // Never allow granting 'permissions' or 'dashboard' via this endpoint
    if ($key === 'permissions' || $key === 'dashboard') {
        api_error('This permission cannot be toggled here.', 400);
    }

    if (targetIsSuperadmin($uid)) api_error('Cannot edit a superadmin.', 403);

    $stmt = $conn->prepare(
        "INSERT INTO admin_permissions (user_id, permission_key, granted)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE granted = ?"
    );
    $stmt->bind_param('isii', $uid, $key, $g, $g);
    $stmt->execute();
    $stmt->close();

    if ($g === 1) {
        $s1 = $conn->prepare("UPDATE users SET role = 1 WHERE user_id = ? AND role != 1");
        $s1->bind_param('i', $uid); $s1->execute(); $s1->close();

        $s2 = $conn->prepare(
            "INSERT INTO admin_users (user_id, is_superadmin, is_active)
             VALUES (?, 0, 1)
             ON DUPLICATE KEY UPDATE is_active = 1"
        );
        $s2->bind_param('i', $uid); $s2->execute(); $s2->close();
    }

    api_success();
}

/* ════════════════════════════════════════════════════
   TOGGLE ALL IN SECTION
════════════════════════════════════════════════════ */
if ($action === 'toggle_all_section') {
    $uid  = (int)($_POST['user_id'] ?? 0);
    $g    = (int)($_POST['granted'] ?? 0);
    $keys = json_decode($_POST['keys'] ?? '[]', true);

    if (!is_array($keys) || empty($keys)) api_error('Invalid keys payload.');
    if (targetIsSuperadmin($uid))         api_error('Cannot edit a superadmin.', 403);

    $rows = [];
    foreach ($keys as $k) {
        $k = trim($k);
        if ($k === '' || $k === 'permissions' || $k === 'dashboard') continue;
        $k = $conn->real_escape_string($k);
        $rows[] = "($uid, '$k', $g)";
    }
    if (!empty($rows)) {
        $sql = "INSERT INTO admin_permissions (user_id, permission_key, granted)
                VALUES " . implode(',', $rows) . "
                ON DUPLICATE KEY UPDATE granted = VALUES(granted)";
        $conn->query($sql);
    }

    if ($g === 1) {
        $conn->query("UPDATE users SET role = 1 WHERE user_id = $uid AND role != 1");
        $conn->query("INSERT INTO admin_users (user_id, is_superadmin, is_active)
                      VALUES ($uid, 0, 1)
                      ON DUPLICATE KEY UPDATE is_active = 1");
    }

    api_success();
}

/* ════════════════════════════════════════════════════
   TOGGLE ADMIN ACCESS
   Grants every perm in allSections() EXCEPT 'permissions',
   which is reserved for superadmins only.
════════════════════════════════════════════════════ */
if ($action === 'toggle_admin') {
    $uid     = (int)($_POST['user_id']  ?? 0);
    $isAdmin = (int)($_POST['is_admin'] ?? 0);

    if ($isAdmin) {
        $rows = [];
        foreach (allSections() as $items) {
            foreach (array_keys($items) as $k) {
                // Hard-exclude: 'permissions' is superadmin-only; 'dashboard' is open to all
                if ($k === 'permissions' || $k === 'dashboard') continue;
                $k = $conn->real_escape_string($k);
                $rows[] = "($uid, '$k', 1)";
            }
        }
        if (!empty($rows)) {
            $sql = "INSERT INTO admin_permissions (user_id, permission_key, granted)
                    VALUES " . implode(',', $rows) . "
                    ON DUPLICATE KEY UPDATE granted = 1";
            $conn->query($sql);
        }
        // Ensure any stray 'permissions' grant is removed for non-superadmin
        $conn->query("DELETE FROM admin_permissions
                      WHERE user_id = $uid AND permission_key = 'permissions'");

        $conn->query("UPDATE users SET is_admin = 1, role = 1 WHERE user_id = $uid");
        $conn->query("INSERT INTO admin_users (user_id, is_superadmin, is_active)
                      VALUES ($uid, 0, 1)
                      ON DUPLICATE KEY UPDATE is_active = 1");
    } else {
        $conn->query("DELETE FROM admin_permissions WHERE user_id = $uid");
        $conn->query("UPDATE users SET is_admin = 0 WHERE user_id = $uid");
        $conn->query("UPDATE admin_users SET is_active = 0
                      WHERE user_id = $uid AND is_superadmin = 0");
    }

    api_success();
}

api_error('Unknown action.', 400);
?>