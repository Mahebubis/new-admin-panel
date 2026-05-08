<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$jwt = require_jwt();
require_permission('manage_refund', $jwt);

/* ─── duration helper ─── */
function rn_duration($days) {
    if (!$days) return '—';
    if ($days <= 35)  return '1 month';
    if ($days <= 65)  return '2 months';
    if ($days <= 95)  return '3 months';
    if ($days <= 125) return '4 months';
    if ($days <= 155) return '5 months';
    return '6 months';
}

/* ─── batch-optimised attendance — ONE query per batch, not one per user ─── */
function rn_batch_attendance($conn, array $rows): array {
    if (empty($rows)) return $rows;
    $batchMap = [];
    foreach ($rows as $row) {
        $b = $row['batch'] ?? ''; if (!$b) continue;
        $batchMap[$b][] = $row['user_id'];
    }
    $attMap = [];
    foreach ($batchMap as $batchStr => $userIds) {
        $clean = preg_replace('/(\d+)(st|nd|rd|th)/i', '$1', $batchStr);
        try { $start = new DateTime($clean); } catch (Exception $e) { continue; }
        $end = clone $start; $end->modify('+29 days');
        $ids = implode(',', array_map('intval', $userIds));
        $sql = "SELECT user_id, COUNT(DISTINCT DATE(login_date)) AS d
                FROM user_login_activity
                WHERE user_id IN ($ids)
                  AND DATE(login_date) BETWEEN '{$start->format('Y-m-d')}' AND LEAST('{$end->format('Y-m-d')}', CURDATE())
                  AND activity_level >= 1
                GROUP BY user_id";
        $res = $conn->query($sql);
        if ($res) while ($r = $res->fetch_assoc()) $attMap[(int)$r['user_id']] = round(($r['d']/30)*100, 1);
    }
    foreach ($rows as &$row) $row['attendance'] = $attMap[(int)$row['user_id']] ?? 0;
    unset($row);
    return $rows;
}

/* ─── stats — individual COUNT queries (exact port of refund_list_new_stats) ─── */
function rn_stats($conn, $from, $base_where) {
    $q = fn($w) => (int)(($r=$conn->query("SELECT COUNT(*) AS c $from $w")) ? $r->fetch_assoc()['c'] : 0);

    $total             = $q($base_where);
    $under_review      = $q($base_where . " AND rc.status='under_review' ");
    $refunded          = $q($base_where . " AND rc.status='refunded' ");
    $rejected          = $q($base_where . " AND rc.status='rejected' ");
    $project_submitted = $q($base_where . " AND ps.status='pending' ");
    $project_approved  = $q($base_where . " AND ps.status='approved' ");
    $project_rejected  = $q($base_where . " AND ps.status='rejected' ");
    $active            = $q($base_where . " AND rc.id IS NULL ");

    /* completed = project approved + attendance >= 100 */
    $comp_res  = $conn->query("SELECT u.user_id, ip.batch $from {$base_where} AND ps.status='approved'");
    $comp_rows = [];
    if ($comp_res) while ($cr = $comp_res->fetch_assoc()) $comp_rows[] = $cr;
    $comp_rows = rn_batch_attendance($conn, $comp_rows);
    $completed = 0;
    foreach ($comp_rows as $cr) { if ($cr['attendance'] >= 100) $completed++; }

    return compact('total','under_review','refunded','rejected','completed','active',
                   'project_submitted','project_approved','project_rejected');
}

/* ─── batches — from users with is_from_refund='yes' (exact port of fetch_refund_batches) ─── */
function rn_batches($conn): array {
    $res = $conn->query("
        SELECT DISTINCT ip.batch
        FROM users u
        LEFT JOIN internship_payment ip ON ip.user_id = u.user_id
        WHERE u.is_from_refund = 'yes' AND ip.batch IS NOT NULL AND ip.batch != ''
        ORDER BY STR_TO_DATE(REGEXP_REPLACE(ip.batch,'(st|nd|rd|th)',''),'%d %M, %Y') ASC
    ");
    $out = [];
    if ($res) while ($r = $res->fetch_assoc()) { if ($r['batch']) $out[] = $r['batch']; }
    return $out;
}

/* ═══════════════════════════════════════════════════════════
   POST ACTIONS
═══════════════════════════════════════════════════════════ */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input  = isset($_POST['action']) ? $_POST : (json_decode(file_get_contents('php://input'), true) ?? []);
    $action = $input['action'] ?? '';

    /* ── fetch_funnel ── */
    if (in_array($action, ['fetch_funnel','fetch_refund_funnel_v2'])) {
        $df = $conn->real_escape_string($input['date_from'] ?? '');
        $dt = $conn->real_escape_string($input['date_to']   ?? '');
        $sr = $conn->real_escape_string($input['search']    ?? '');

        $bw = "WHERE u.is_from_refund='yes'";
        if ($sr) $bw .= " AND (u.email LIKE '%$sr%' OR u.user_id LIKE '%$sr%' OR u.phone LIKE '%$sr%')";
        if ($df && $dt) $bw .= " AND DATE(u.registered_at) BETWEEN '$df' AND '$dt'";

        $q = fn($sql) => (int)(($r=$conn->query($sql)) ? $r->fetch_assoc()['cnt'] : 0);
        api_success(['funnel'=>[
            'registrations'  => $q("SELECT COUNT(*) AS cnt FROM users u $bw"),
            'exam_given'     => $q("SELECT COUNT(DISTINCT u.user_id) AS cnt FROM users u INNER JOIN cit_results cr ON cr.user_id=u.user_id $bw"),
            'intent_yes'     => $q("SELECT COUNT(DISTINCT u.user_id) AS cnt FROM users u INNER JOIN user_refund_intent uri ON uri.user_id=u.user_id AND uri.intent='yes' $bw"),
            'intent_no'      => $q("SELECT COUNT(DISTINCT u.user_id) AS cnt FROM users u INNER JOIN user_refund_intent uri ON uri.user_id=u.user_id AND uri.intent='no' $bw"),
            'result_viewed'  => $q("SELECT COUNT(*) AS cnt FROM users u $bw AND u.score_viewed=1"),
            'purchased'      => $q("SELECT COUNT(DISTINCT u.user_id) AS cnt FROM users u INNER JOIN internship_payment ip ON ip.user_id=u.user_id $bw"),
            'refund_claimed' => $q("SELECT COUNT(DISTINCT u.user_id) AS cnt FROM users u INNER JOIN internship_payment ip ON ip.user_id=u.user_id INNER JOIN internship_list il ON il.internship_name=ip.internship INNER JOIN refund_claims rc ON rc.user_id=u.user_id AND rc.internship_id=il.id $bw"),
        ]]);
    }

    /* ── update_refund_claim ── */
    if (in_array($action, ['update_refund_claim','update_refund_claim_new'])) {
        $uid  = (int)($input['user_id']??0); $iid = (int)($input['internship_id']??0);
        $st   = trim($input['status']??'');  $note = $input['admin_notes']??null;
        $purl = trim($input['proof_url']??'');
        if (!$uid||!$iid||!in_array($st,['under_review','refunded','rejected'])) api_error('Invalid data',400);
        $ex=$conn->prepare("SELECT id FROM refund_claims WHERE user_id=? AND internship_id=?");
        $ex->bind_param("ii",$uid,$iid);$ex->execute();$row=$ex->get_result()->fetch_assoc();
        if ($row) {
            if ($purl) { $s=$conn->prepare("UPDATE refund_claims SET status=?,admin_notes=?,proof_url=?,processed_at=IF(? IN('refunded','rejected'),NOW(),processed_at),updated_at=NOW() WHERE user_id=? AND internship_id=?");$s->bind_param("ssssii",$st,$note,$purl,$st,$uid,$iid); }
            else       { $s=$conn->prepare("UPDATE refund_claims SET status=?,admin_notes=?,processed_at=IF(? IN('refunded','rejected'),NOW(),processed_at),updated_at=NOW() WHERE user_id=? AND internship_id=?");$s->bind_param("sssii",$st,$note,$st,$uid,$iid); }
        } else {
            $s=$conn->prepare("INSERT INTO refund_claims (user_id,internship_id,status,admin_notes,proof_url,processed_at) VALUES (?,?,?,?,?,IF(? IN('refunded','rejected'),NOW(),NULL))");
            $s->bind_param("iissss",$uid,$iid,$st,$note,$purl,$st);
        }
        $s->execute();
        api_success(['message'=>ucfirst(str_replace('_',' ',$st)).' successfully']);
    }

    /* ── approve_project ── */
    if (in_array($action,['approve_project','approve_project_submissions'])) {
        $uid=(int)($input['user_id']??0);$iid=(int)($input['internship_id']??0);
        if(!$uid||!$iid)api_error('Invalid data',400);
        $s=$conn->prepare("UPDATE project_submission SET status='approved',updated_at=NOW() WHERE user_id=? AND internship_id=?");
        $s->bind_param("ii",$uid,$iid);$s->execute();
        if($s->affected_rows===0)api_error('No matching project',404);
        api_success(['message'=>'Project approved successfully']);
    }

    /* ── decline_project ── */
    if (in_array($action,['decline_project','decline_project_submission_with_email'])) {
        $uid=(int)($input['user_id']??0);$iid=(int)($input['internship_id']??0);$reason=trim($input['reason']??'');
        if(!$uid||!$iid)api_error('Invalid data',400);
        $s=$conn->prepare("UPDATE project_submission SET status='rejected',reject_reason=?,updated_at=NOW() WHERE user_id=? AND internship_id=?");
        $s->bind_param("sii",$reason,$uid,$iid);$s->execute();
        if($s->affected_rows===0)api_error('No matching project',404);
        api_success(['message'=>'Project declined successfully']);
    }

    /* ── upload_proof ── */
    if (in_array($action,['upload_proof','upload_refund_proof'])) {
        if(!isset($_FILES['proof'])||$_FILES['proof']['error']!==UPLOAD_ERR_OK)api_error('No file',400);
        $file=$_FILES['proof'];
        if(!in_array($file['type'],['image/jpeg','image/png','image/gif','image/webp','application/pdf']))api_error('Invalid type',400);
        if($file['size']>10*1024*1024)api_error('File too large',400);
        try {
            require_once '/home/istudio/public_html/istudio_dashboard/api/vendor/autoload.php';
            require_once __DIR__ . '/../../config/aws.php';
            $s3=new Aws\S3\S3Client(['version'=>'latest','region'=>AWS_REGION,'credentials'=>['key'=>AWS_ACCESS_KEY_ID,'secret'=>AWS_SECRET_ACCESS_KEY]]);
            $ext=pathinfo($file['name'],PATHINFO_EXTENSION);$key='refund_proofs/'.uniqid('proof_',true).($ext?'.'.$ext:'');
            $s3->putObject(['Bucket'=>AWS_S3_BUCKET,'Key'=>$key,'SourceFile'=>$file['tmp_name'],'ContentType'=>$file['type']]);
            api_success(['url'=>'https://'.AWS_S3_BUCKET.'.s3.'.AWS_REGION.'.amazonaws.com/'.$key]);
        } catch(Exception $e){
            $dir=__DIR__.'/../../uploads/proofs/';if(!is_dir($dir))mkdir($dir,0755,true);
            $fname='proof_'.time().'_'.bin2hex(random_bytes(6)).'.'.pathinfo($file['name'],PATHINFO_EXTENSION);
            if(!move_uploaded_file($file['tmp_name'],$dir.$fname))api_error('Upload failed',500);
            api_success(['url'=>'https://cit3.internshipstudio.com/admin/react-api/uploads/proofs/'.$fname]);
        }
    }

    /* ── send_email ── */
    if (in_array($action,['send_email','send_custom_email'])) {
        $to=trim($input['to']??'');$subject=trim($input['subject']??'');$html=$input['html']??'';
        if(!$to||!filter_var($to,FILTER_VALIDATE_EMAIL))api_error('Invalid email',400);
        if(!$subject)api_error('Subject required',400);
        $body="<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body style='margin:0;padding:0;background:#f5f3ff;font-family:Plus Jakarta Sans,sans-serif;'><div style='max-width:600px;margin:28px auto;background:#fff;border-radius:14px;overflow:hidden;'><div style='background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 32px;text-align:center;'><h2 style='color:#fff;font-size:18px;margin:0;font-weight:800;'>Internship Studio</h2></div><div style='padding:28px 32px;font-size:13px;color:#1e293b;line-height:1.75;'>$html</div><div style='background:#f5f3ff;border-top:1px solid #ede9fe;padding:14px 32px;text-align:center;font-size:11px;color:#94a3b8;'>&copy;".date('Y')." Internship Studio &middot; Automated</div></div></body></html>";
        $headers="MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: Internship Studio <no-reply@internshipstudio.com>\r\n";
        mail($to,$subject,$body,$headers)?api_success(['message'=>'Email sent']):api_error('Send failed',500);
    }

    api_error('Unknown action',400);
}

/* ═══════════════════════════════════════════════════════════
   GET — main refund list
   Base: FROM users WHERE u.is_from_refund = 'yes'
   (exact port of fetch_refund_list_new from helper.php)
═══════════════════════════════════════════════════════════ */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $page     = max(1,(int)($_GET['page']??1));
    $per_page = max(1,min(100000,(int)($_GET['per_page']??10)));
    $search   = trim($_GET['search']??'');
    $gs       = trim($_GET['global_search']??'');
    $status_f = trim($_GET['status']??'');
    $batch_f  = trim($_GET['batch']??'');
    $fs       = trim($_GET['funnel_step']??'');
    $df       = trim($_GET['date_from']??'');
    $dt       = trim($_GET['date_to']??'');
    $offset   = ($page-1)*$per_page;

    /* FROM — purchased step allows multiple rows per user, others use latest payment subquery */
    if ($fs === 'purchased') {
        $from = "FROM users u
            LEFT JOIN internship_payment ip ON ip.user_id=u.user_id
            LEFT JOIN internship_list il ON il.internship_name=ip.internship
            LEFT JOIN refund_claims rc ON rc.user_id=u.user_id AND rc.internship_id=il.id
            LEFT JOIN project_submission ps ON ps.user_id=u.user_id AND ps.internship_id=il.id
            LEFT JOIN user_refund_intent uri ON uri.user_id=u.user_id";
    } else {
        $from = "FROM users u
            LEFT JOIN internship_payment ip ON ip.id=(SELECT id FROM internship_payment ip2 WHERE ip2.user_id=u.user_id ORDER BY ip2.paid_at DESC LIMIT 1)
            LEFT JOIN internship_list il ON il.internship_name=ip.internship
            LEFT JOIN refund_claims rc ON rc.user_id=u.user_id AND rc.internship_id=il.id
            LEFT JOIN project_submission ps ON ps.user_id=u.user_id AND ps.internship_id=il.id
            LEFT JOIN user_refund_intent uri ON uri.user_id=u.user_id";
    }

    $where = " WHERE u.is_from_refund='yes' ";

    if ($search!=='') { $s=$conn->real_escape_string($search); $where.=" AND (u.name LIKE '%$s%' OR u.email LIKE '%$s%' OR u.phone LIKE '%$s%' OR ip.internship LIKE '%$s%' OR ip.payment_id LIKE '%$s%' OR u.user_id LIKE '%$s%') "; }
    if ($gs!==''&&$search==='') { $g=$conn->real_escape_string($gs); $where.=" AND (u.name LIKE '%$g%' OR u.email LIKE '%$g%' OR u.phone LIKE '%$g%' OR u.user_id LIKE '%$g%') "; }
    if ($gs===''&&$search===''&&$df&&$dt) { $dfe=$conn->real_escape_string($df);$dte=$conn->real_escape_string($dt); $where.=" AND DATE(u.registered_at) BETWEEN '$dfe' AND '$dte' "; }

    switch ($fs) {
        case 'exam_given':     $where.=" AND EXISTS(SELECT 1 FROM cit_results cr WHERE cr.user_id=u.user_id LIMIT 1) ";break;
        case 'intent_yes':     $where.=" AND EXISTS(SELECT 1 FROM user_refund_intent uri WHERE uri.user_id=u.user_id AND uri.intent='yes' LIMIT 1) ";break;
        case 'intent_no':      $where.=" AND EXISTS(SELECT 1 FROM user_refund_intent uri WHERE uri.user_id=u.user_id AND uri.intent='no' LIMIT 1) ";break;
        case 'result_viewed':  $where.=" AND u.score_viewed=1 ";break;
        case 'purchased':      $where.=" AND EXISTS(SELECT 1 FROM internship_payment ip WHERE ip.user_id=u.user_id LIMIT 1) ";break;
        case 'refund_claimed': $where.=" AND EXISTS(SELECT 1 FROM internship_payment ip2 INNER JOIN internship_list il2 ON il2.internship_name=ip2.internship INNER JOIN refund_claims rc2 ON rc2.user_id=u.user_id AND rc2.internship_id=il2.id WHERE ip2.user_id=u.user_id LIMIT 1) ";break;
    }

    if ($batch_f!=='') { $be=$conn->real_escape_string($batch_f);$where.=" AND ip.batch='$be' "; }

    $sw='';$pf='';
    switch ($status_f) {
        case 'under_review':      $sw=" AND rc.status='under_review' ";break;
        case 'refunded':          $sw=" AND rc.status='refunded' ";break;
        case 'rejected':          $sw=" AND rc.status='rejected' ";break;
        case 'project_submitted': $sw=" AND ps.status='pending' ";break;
        case 'project_approved':  $sw=" AND ps.status='approved' ";break;
        case 'project_rejected':  $sw=" AND ps.status='rejected' ";break;
        case 'completed':         $sw=" AND ps.status='approved' ";$pf='completed';break;
        case 'active':            $sw=" AND rc.id IS NULL AND ps.id IS NULL ";$pf='active';break;
    }
    $full=$where.$sw;
    $order=" ORDER BY CASE WHEN rc.status='under_review' THEN 0 ELSE 1 END ASC, u.registered_at DESC ";

    $sel="SELECT u.user_id,u.name,u.email,u.phone AS contact,u.registered_at,
        ip.internship AS internship_name,il.id AS internship_id,ip.batch,ip.total_duration,
        ip.paid_at,ip.payment_id,uri.intent,
        EXISTS(SELECT 1 FROM assigned_links al WHERE al.user_id=u.user_id LIMIT 1) AS group_joined,
        EXISTS(SELECT 1 FROM cit_results cr WHERE cr.user_id=u.user_id LIMIT 1) AS exam_given,
        ps.id AS ps_id,ps.status AS project_status,ps.file_link,
        ps.created_at AS project_submitted_date,
        CASE WHEN ps.status='approved' THEN ps.updated_at END AS project_approved_date,
        rc.id AS claim_id,rc.status AS refund_claim_status,rc.admin_notes,rc.processed_at,rc.proof_url";

    if ($pf) {
        $res=$conn->query("$sel $from $full $order");
        $all=[];if($res)while($r=$res->fetch_assoc())$all[]=$r;
        $all=rn_batch_attendance($conn,$all);
        $fil=[];
        foreach($all as $row){
            $att=$row['attendance'];$isc=($row['project_status']==='approved'&&$att>=100);
            if($pf==='completed'&&!$isc)continue;
            if($pf==='active'){if($isc)continue;if($row['ps_id']!==null)continue;}
            $fil[]=$row;
        }
        $total_rows=count($fil);$total_pages=max(1,(int)ceil($total_rows/$per_page));
        $paged=array_slice($fil,$offset,$per_page);
    } else {
        $total_rows=(int)($conn->query("SELECT COUNT(*) AS total $from $full")->fetch_assoc()['total']??0);
        $total_pages=max(1,(int)ceil($total_rows/$per_page));
        $res=$conn->query("$sel $from $full $order LIMIT $per_page OFFSET $offset");
        $paged=[];if($res)while($r=$res->fetch_assoc())$paged[]=$r;
        $paged=rn_batch_attendance($conn,$paged);
    }

    $out=[];
    foreach($paged as $r){
        $out[]=['user_id'=>(int)$r['user_id'],'name'=>$r['name'],'email'=>$r['email'],'contact'=>$r['contact'],
            'registered_at'=>$r['registered_at'],'internship_name'=>$r['internship_name'],
            'internship_id'=>$r['internship_id']?(int)$r['internship_id']:null,'batch'=>$r['batch'],
            'duration'=>rn_duration($r['total_duration']??0),'paid_at'=>$r['paid_at'],'payment_id'=>$r['payment_id'],
            'intent'=>$r['intent'],'group_joined'=>(bool)$r['group_joined'],'exam_given'=>(bool)$r['exam_given'],
            'attendance'=>(float)($r['attendance']??0),'project_status'=>$r['project_status'],
            'file_link'=>$r['file_link'],'project_submitted_date'=>$r['project_submitted_date'],
            'project_approved_date'=>$r['project_approved_date'],'refund_claim_status'=>$r['refund_claim_status'],
            'admin_notes'=>$r['admin_notes'],'proof_url'=>$r['proof_url']];
    }

    api_success(['refunds'=>$out,'total'=>$total_rows,'total_pages'=>$total_pages,'page'=>$page,
        'batches'=>rn_batches($conn),'stats'=>rn_stats($conn,$from,$where)]);
}

api_error('Method not allowed',405);