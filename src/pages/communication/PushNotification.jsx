import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/communication/push_notification.php';
const FH  = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk  = obj => new URLSearchParams(obj);

const TODAY = new Date().toISOString().split('T')[0];

/* same options as PHP — same values used in SQL queries */
const SEND_OPTIONS = [
  { value:'all_users',                   label:'All Users' },
  { value:'exam_given',                  label:'Exam Given Users',                     needsDates: true },
  { value:'exam_not_given',              label:'Exam Not Given Users',                 needsDates: true },
  { value:'internship_not_purchased',    label:'Exam Given But Not Purchased Internship', needsDates: true },
  { value:'whatsapp_community_not_joined',label:'WhatsApp Community Not Joined Users', needsDates: true },
  { value:'internship_purchased',        label:'All Internship Purchased Users',       needsDates: true },
  { value:'specific_internship_users',   label:'Specific Internship Users',            needsDates: true, needsInternship: true },
];

const inp = {
  width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8,
  fontSize:12.5, fontFamily:'inherit', color:'#1e293b', outline:'none', boxSizing:'border-box',
};

function Label({ children }) {
  return <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:'#64748b',
    textTransform:'uppercase', letterSpacing:'.4px', marginBottom:5 }}>{children}</label>;
}

function Field({ label, children }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default function PushNotification() {
  const [stats,       setStats]       = useState({ allowed:0, denied:0 });
  const [internships, setInternships] = useState([]);
  const [form, setForm] = useState({
    title:           '',
    icon:            'https://cit.internshipstudio.com/assets/img/favicon.png',
    body:            '',
    url:             `https://cit2.internshipstudio.com/register/?medium=push&campaign=${TODAY}`,
    send_to:         'all_users',
    start_date:      '',
    end_date:        '',
    user_internship: '',
  });
  const [sending,    setSending]    = useState(false);
  const [checking,   setChecking]   = useState(false);
  const [showPreview,setShowPreview]= useState(false);

  /* ── load stats + internships on mount ── */
  useEffect(() => {
    api.get(API)
      .then(res => {
        if (res.data.status === 'success') {
          setStats({ allowed: res.data.allowed || 0, denied: res.data.denied || 0 });
          setInternships(res.data.internships || []);
        }
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  /* ── option change — reset date/internship if switching to all_users ── */
  const handleOptionChange = (val) => {
    set('send_to', val);
    if (val === 'all_users') {
      setForm(p => ({ ...p, send_to: val, start_date:'', end_date:'', user_internship:'' }));
    } else {
      set('send_to', val);
    }
  };

  const selectedOption  = SEND_OPTIONS.find(o => o.value === form.send_to);
  const needsDates      = selectedOption?.needsDates;
  const needsInternship = selectedOption?.needsInternship;

  /* ── validate same as PHP ── */
  const validate = (isSend = true) => {
    if (isSend && (!form.title || !form.icon || !form.body || !form.url)) {
      toast.error('Please enter title, icon, body and url!'); return false;
    }
    if (form.send_to !== 'all_users' && (!form.start_date || !form.end_date)) {
      toast.error('Please select start date and end date!'); return false;
    }
    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      toast.error('Start date cannot be greater than end date!'); return false;
    }
    if (needsInternship && !form.user_internship) {
      toast.error('Please select internship!'); return false;
    }
    return true;
  };

  /* ── Check Data (get_user_report) — same as PHP's download_user_report ── */
  const checkData = async () => {
    if (!validate(false)) return;
    setChecking(true);
    try {
      const res = await api.post(API, mk({ action:'get_user_report', ...form }), FH);
      if (res.data.status === 'success') {
        toast.success(`${res.data.count} users found`);
        // Download CSV — same as PHP's CSV generation for get_user_report
        const headers = 'User ID,Name,Email,Phone,Registered At,Endpoint\n';
        const lines   = (res.data.data || []).map(r =>
          [r.user_id, r.user_name, r.user_email, r.user_phone, r.user_registered_at, r.endpoint].join(',')
        );
        const csv = headers + lines.join('\n');
        const a   = document.createElement('a');
        a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = 'push_notification_users.csv';
        a.click();
      } else {
        toast.error(res.data.message || 'Failed');
      }
    } catch { toast.error('Error'); }
    finally { setChecking(false); }
  };

  /* ── Send push notification — same as PHP's sendNotification() ── */
  const handleSend = async () => {
    if (!validate(true)) return;
    const confirmMsg = form.send_to !== 'all_users'
      ? `Once sent, users will receive notification between ${form.start_date} and ${form.end_date}${needsInternship ? ` for ${form.user_internship} internship` : ''}!`
      : 'Once sent, users will receive notification!';
    if (!window.confirm(`Are you sure?\n\n${confirmMsg}`)) return;

    setSending(true);
    try {
      const res = await api.post(API, mk({ action:'send_push_notification', ...form }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message || 'Notifications sent!');
        // Download results CSV — same as PHP
        const headers = 'Endpoint,Success,Message\n';
        const lines   = (res.data.data || []).map(r => `${r.endpoint},${r.success},${r.message}`);
        const csv     = headers + lines.join('\n');
        const a       = document.createElement('a');
        a.href        = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download    = 'push_notification.csv';
        a.click();
      } else {
        toast.error(res.data.message || 'Failed to send');
      }
    } catch { toast.error('Something went wrong!'); }
    finally { setSending(false); }
  };

  /* ── preview data — same as PHP's preview button ── */
  const previewData = { title: form.title, icon: form.icon, body: form.body, url: form.url };

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .pn-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .pn-inp:focus{border-color:#4f46e5!important;box-shadow:0 0 0 3px rgba(79,70,229,.08)!important;}
        .pn-radio{accent-color:#4f46e5;width:14px;height:14px;}
      `}</style>

      <div className="pn-root" style={{
        display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)',
        padding:20, gap:14, overflow:'hidden', background:'#f5f3ff',
      }}>

        {/* ── HEADER + STATS ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>🔔 Send Push Notification</div>
          <div style={{ display:'flex', gap:16 }}>
            <div style={{ padding:'6px 16px', background:'#dcfce7', borderRadius:8, fontSize:12.5, fontWeight:700, color:'#16a34a' }}>
              ✓ Allowed: {stats.allowed}
            </div>
            <div style={{ padding:'6px 16px', background:'#fee2e2', borderRadius:8, fontSize:12.5, fontWeight:700, color:'#dc2626' }}>
              ✗ Denied: {stats.denied}
            </div>
          </div>
        </div>

        {/* ── SCROLLABLE FORM AREA ── */}
        <div style={{ flex:1, minHeight:0, overflowY:'auto', display:'grid',
          gridTemplateColumns:'1fr 1fr', gap:14, alignContent:'start' }}>

          {/* ── LEFT: message fields ── */}
          <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
            boxShadow:'0 1px 8px rgba(79,70,229,.05)', padding:20,
            display:'flex', flexDirection:'column', gap:14 }}>

            <div style={{ fontSize:13, fontWeight:800, color:'#1e293b' }}>Notification Content</div>

            <Field label="Title *">
              <input className="pn-inp" style={inp} value={form.title}
                onChange={e => set('title', e.target.value)} placeholder="Enter notification title"/>
            </Field>

            <Field label="Icon URL">
              <input className="pn-inp" style={inp} value={form.icon}
                onChange={e => set('icon', e.target.value)} placeholder="Icon URL"/>
            </Field>

            <Field label="Body *">
              <textarea className="pn-inp" style={{ ...inp, resize:'vertical', minHeight:90 }}
                value={form.body} onChange={e => set('body', e.target.value)}
                placeholder="Enter notification body text"/>
            </Field>

            <Field label="URL">
              <input className="pn-inp" style={inp} value={form.url}
                onChange={e => set('url', e.target.value)} placeholder="Redirect URL"/>
            </Field>

            {/* preview card */}
            {form.title && (
              <div style={{ background:'#f5f3ff', borderRadius:8, border:'1.5px solid #ede9fe', padding:'10px 14px' }}>
                <div style={{ fontSize:10.5, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:6 }}>Preview</div>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  {form.icon && <img src={form.icon} alt="" style={{ width:32, height:32, borderRadius:6, objectFit:'cover' }} onError={e=>e.target.style.display='none'}/>}
                  <div>
                    <div style={{ fontSize:12.5, fontWeight:700, color:'#1e293b' }}>{form.title || '—'}</div>
                    <div style={{ fontSize:11.5, color:'#64748b', marginTop:2 }}>{form.body || '—'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: audience selection ── */}
          <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
            boxShadow:'0 1px 8px rgba(79,70,229,.05)', padding:20,
            display:'flex', flexDirection:'column', gap:14 }}>

            <div style={{ fontSize:13, fontWeight:800, color:'#1e293b' }}>Send To</div>

            {/* radio options — same 7 as PHP ── */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {SEND_OPTIONS.map(opt => (
                <label key={opt.value}
                  style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer',
                    padding:'9px 12px', borderRadius:8, fontSize:12.5, fontWeight:600,
                    border:`1.5px solid ${form.send_to===opt.value ? '#c4b5fd' : '#e2e8f0'}`,
                    background: form.send_to===opt.value ? '#f5f3ff' : '#f8fafc',
                    color: form.send_to===opt.value ? '#4f46e5' : '#64748b',
                    transition:'all .15s', userSelect:'none' }}>
                  <input type="radio" className="pn-radio" name="send_to" value={opt.value}
                    checked={form.send_to === opt.value} onChange={() => handleOptionChange(opt.value)}/>
                  {opt.label}
                </label>
              ))}
            </div>

            {/* date range — only shown when needed ── */}
            {needsDates && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:4 }}>
                <div>
                  <Label>Start Date *</Label>
                  <input type="date" className="pn-inp" style={{ ...inp, cursor:'pointer' }}
                    value={form.start_date} onChange={e => set('start_date', e.target.value)}/>
                </div>
                <div>
                  <Label>End Date *</Label>
                  <input type="date" className="pn-inp" style={{ ...inp, cursor:'pointer' }}
                    value={form.end_date} onChange={e => set('end_date', e.target.value)}/>
                </div>
              </div>
            )}

            {/* internship dropdown — only for specific_internship_users ── */}
            {needsInternship && (
              <div>
                <Label>Internship *</Label>
                <select className="pn-inp" style={{ ...inp, cursor:'pointer' }}
                  value={form.user_internship} onChange={e => set('user_internship', e.target.value)}>
                  <option value="">Select Internship</option>
                  {internships.map(i => (
                    <option key={i.id} value={i.internship_name}>{i.internship_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* action buttons — same 3 as PHP ── */}
            <div style={{ display:'flex', gap:10, marginTop:'auto', paddingTop:12,
              borderTop:'1.5px solid #f1f5f9', flexWrap:'wrap' }}>
              {/* Preview */}
              <button onClick={() => setShowPreview(p => !p)}
                style={{ padding:'9px 18px', border:'1.5px solid #c4b5fd', background:'#f5f3ff',
                  color:'#4f46e5', borderRadius:8, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
                👁 Preview
              </button>
              {/* Check Data */}
              <button onClick={checkData} disabled={checking}
                style={{ padding:'9px 18px', border:'none', background:'linear-gradient(135deg,#0891b2,#0e7490)',
                  color:'#fff', borderRadius:8, fontSize:12.5, fontWeight:700,
                  cursor: checking?'not-allowed':'pointer', opacity: checking?.7:1 }}>
                {checking ? 'Loading...' : '📊 Check Data'}
              </button>
              {/* Send */}
              <button onClick={handleSend} disabled={sending}
                style={{ padding:'9px 20px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
                  cursor: sending?'not-allowed':'pointer', opacity: sending?.7:1, color:'#fff',
                  background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  boxShadow:'0 4px 14px rgba(79,70,229,.3)' }}>
                {sending ? 'Sending...' : '📤 Send'}
              </button>
            </div>

            {/* JSON preview — same as PHP's jsonPreview div ── */}
            {showPreview && (
              <div style={{ background:'#f5f3ff', borderRadius:8, border:'1.5px solid #ede9fe',
                padding:12, fontSize:11.5, color:'#4f46e5', fontFamily:'monospace',
                overflowX:'auto', whiteSpace:'pre-wrap', lineHeight:1.6 }}>
                {JSON.stringify(previewData, null, 2)}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}