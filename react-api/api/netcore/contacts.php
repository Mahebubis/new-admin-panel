<?php
/*
 * /api/netcore/contacts.php
 *
 * GET / POST actions:
 *   action=list      → paginated user list with derived columns
 *     params: page (int, default 1), per_page (int, default 25), search (string)
 *   action=count     → total identified user count
 *
 * Returns the columns the Netcore contacts page needs:
 *   email, mobile, first_name, last_name, state, country,
 *   profile_completion, wa_join, register_date, link, exam_start_date, pc_link
 */
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
ini_set('display_errors', 0);
ob_start();

chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB connection missing']); exit; }

$action = $_REQUEST['action'] ?? 'list';

if ($action === 'count') {
    $r = mysqli_query($conn, "SELECT COUNT(*) AS c FROM users");
    $total = (int)mysqli_fetch_assoc($r)['c'];
    echo json_encode(['status'=>'success','total'=>$total]);
    exit;
}

if ($action === 'list') {
    $page    = max(1, (int)($_REQUEST['page']     ?? 1));
    $perPage = max(1, min(200, (int)($_REQUEST['per_page'] ?? 25)));
    $search  = trim($_REQUEST['search'] ?? '');
    $offset  = ($page - 1) * $perPage;

    /* ── search type detection: pick the indexed lookup that matches the input ──
       Avoids `LIKE '%xxx%'` (full table scan, 18s on 4M rows). */
    $where      = "WHERE 1=1";
    $isExact    = false;          // exact-match search → skip COUNT(*)
    $skipFullCt = false;          // for unfiltered total
    if ($search !== '') {
        $s = mysqli_real_escape_string($conn, $search);

        if (strpos($search, '@') !== false) {
            /* email — exact match using PRIMARY/UNIQUE index */
            $where  .= " AND u.email = '$s'";
            $isExact = true;
        } elseif (preg_match('/^\d+$/', $search)) {
            /* all digits: 10+ → phone, otherwise user_id */
            if (strlen($search) >= 10) $where .= " AND u.phone = '$s'";
            else                       $where .= " AND u.user_id = '$s'";
            $isExact = true;
        } else {
            /* name search — prefix only ('xxx%') so MySQL can use the index */
            $where .= " AND (u.fname LIKE '$s%' OR u.lname LIKE '$s%')";
        }
    } else {
        /* no search → unfiltered count is the slow case on 4M rows. Use information_schema for an instant approximate count. */
        $skipFullCt = true;
    }

    /* total — fast path for exact match and unfiltered */
    if ($isExact) {
        $total = -1; /* compute from result count below */
    } elseif ($skipFullCt) {
        /* approximate row count via information_schema (microseconds, no scan) */
        $r = mysqli_query($conn, "SELECT TABLE_ROWS AS c FROM information_schema.TABLES
                                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='users'");
        $total = $r ? (int)mysqli_fetch_assoc($r)['c'] : 0;
    } else {
        /* prefix LIKE on indexed column — fine */
        $totalRes = mysqli_query($conn, "SELECT COUNT(*) AS c FROM users u $where");
        $total    = (int)mysqli_fetch_assoc($totalRes)['c'];
    }

    /* main page query — keep it lean: only the user fields, then enrich per-row from indexed lookups */
    $sql = "SELECT u.user_id, u.email, u.phone, u.fname, u.lname, u.state, u.country, u.registered_at
            FROM users u
            $where
            ORDER BY u.registered_at DESC
            LIMIT $perPage OFFSET $offset";

    $res  = mysqli_query($conn, $sql);
    $rows = [];
    $userIds = [];
    while ($r = mysqli_fetch_assoc($res)) {
        $rows[] = $r;
        $userIds[] = (int)$r['user_id'];
    }

    /* batch lookups so we don't issue N queries per page */
    $waJoin    = []; // user_id => assigned_at
    $linkMap   = []; // user_id => community_link
    $examStart = []; // user_id => first cit_results.timestamp
    $pcLinkMap = []; // user_id => refund community_link

    if (!empty($userIds)) {
        $idsCsv = implode(',', $userIds);

        /* WhatsApp join + link from assigned_links → whatsapp_placement_club_link */
        $q = "SELECT al.user_id, MIN(al.assigned_at) AS joined_at,
                     SUBSTRING_INDEX(GROUP_CONCAT(wp.community_link ORDER BY al.assigned_at DESC), ',', 1) AS link
              FROM assigned_links al
              LEFT JOIN whatsapp_placement_club_link wp ON wp.id = al.assigned_id
              WHERE al.user_id IN ($idsCsv)
              GROUP BY al.user_id";
        $r = mysqli_query($conn, $q);
        if ($r) while ($row = mysqli_fetch_assoc($r)) {
            $uid = (int)$row['user_id'];
            $waJoin[$uid]  = $row['joined_at'];
            $linkMap[$uid] = $row['link'];
        }

        /* PC link from refund table */
        $q = "SELECT alr.user_id,
                     SUBSTRING_INDEX(GROUP_CONCAT(wpr.community_link ORDER BY alr.assigned_at DESC), ',', 1) AS pc_link
              FROM assigned_links_for_refund alr
              LEFT JOIN whatsapp_placement_club_link_for_refund wpr ON wpr.id = alr.assigned_id
              WHERE alr.user_id IN ($idsCsv)
              GROUP BY alr.user_id";
        $r = mysqli_query($conn, $q);
        if ($r) while ($row = mysqli_fetch_assoc($r)) {
            $pcLinkMap[(int)$row['user_id']] = $row['pc_link'];
        }

        /* exam start: earliest cit_results.timestamp per user */
        $q = "SELECT user_id, MIN(`timestamp`) AS started
              FROM cit_results
              WHERE user_id IN ($idsCsv)
              GROUP BY user_id";
        $r = mysqli_query($conn, $q);
        if ($r) while ($row = mysqli_fetch_assoc($r)) {
            $examStart[(int)$row['user_id']] = $row['started'];
        }
    }

    /* build response rows with derived columns */
    $out = [];
    foreach ($rows as $r) {
        $uid = (int)$r['user_id'];

        /* profile completion: % of [fname, lname, phone, state, country] filled */
        $fields = [$r['fname'], $r['lname'], $r['phone'], $r['state'], $r['country']];
        $filled = count(array_filter($fields, fn($v) => $v !== null && $v !== ''));
        $pc     = (int)round(($filled / count($fields)) * 100);

        $out[] = [
            'user_id'            => $uid,
            'email'              => $r['email']        ?: 'NA',
            'mobile'             => $r['phone']        ?: 'NA',
            'first_name'         => $r['fname']        ?: 'NA',
            'last_name'          => $r['lname']        ?: 'NA',
            'state'              => $r['state']        ?: 'NA',
            'country'            => $r['country']      ?: 'NA',
            'profile_completion' => $pc . '%',
            'wa_join'            => $waJoin[$uid]      ?? 'NA',
            'register_date'      => $r['registered_at'] ? substr($r['registered_at'], 0, 10) : 'NA',
            'link'               => $linkMap[$uid]     ?: 'NA',
            'exam_start_date'    => isset($examStart[$uid]) ? substr($examStart[$uid], 0, 10) : 'NA',
            'pc_link'            => $pcLinkMap[$uid]   ?: 'NA',
        ];
    }

    /* exact-match search: total = result row count (no extra COUNT() query needed) */
    if ($total === -1) $total = count($out);

    echo json_encode([
        'status'    => 'success',
        'total'     => $total,
        'page'      => $page,
        'per_page'  => $perPage,
        'pages'     => $total > 0 ? (int)ceil($total / $perPage) : 1,
        'contacts'  => $out,
    ]);
    exit;
}

echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;
?>
