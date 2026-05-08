import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/support/view_ticket.php';
const post = d => fetch(API, { method:'POST', body:new URLSearchParams(d) }).then(r => r.json());

/* ─── helpers ─── */
const fmtDT = d => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-GB', {
      day:'2-digit', month:'short', year:'numeric',
      hour:'2-digit', minute:'2-digit', hour12:true,
    });
  } catch { return d; }
};
const decodeHtml = s => s
  ? s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'")
  : '';

/* ─── status badge ─── */
const StatusBadge = ({ status }) => {
  const cfg = {
    open:    { bg:'#dcfce7', color:'#15803d' },
    closed:  { bg:'#fee2e2', color:'#b91c1c' },
    pending: { bg:'#fef9c3', color:'#854d0e' },
  };
  const c = cfg[status?.toLowerCase()] || { bg:'#f3f4f6', color:'#6b7280' };
  return (
    <span style={{ padding:'4px 12px', borderRadius:99, fontSize:12, fontWeight:700,
      background:c.bg, color:c.color }}>
      {status ? status.charAt(0).toUpperCase()+status.slice(1) : '—'}
    </span>
  );
};

/* ─── attachment card ─── */
const AttachmentCard = ({ file }) => {
  const ext   = file.name.split('.').pop().toLowerCase();
  const isImg = ['jpg','jpeg','png'].includes(ext);
  const icons = { pdf:'📄', doc:'📝', docx:'📝' };
  return (
    <a href={file.url} target="_blank" rel="noreferrer"
      style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 13px',
        background:'#f8f5ff', border:'1.5px solid #ede9fe', borderRadius:9,
        textDecoration:'none', color:'#4f46e5', fontSize:12.5, fontWeight:600,
        transition:'background .15s' }}
      onMouseEnter={e=>e.currentTarget.style.background='#ede9fe'}
      onMouseLeave={e=>e.currentTarget.style.background='#f8f5ff'}>
      <span style={{ fontSize:20 }}>{isImg ? '🖼️' : icons[ext] || '📎'}</span>
      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        maxWidth:140 }}>{file.name}</span>
    </a>
  );
};

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function ViewTicket() {
  const { ticket_id } = useParams();
  const navigate      = useNavigate();
  const tid           = parseInt(ticket_id);

  const [ticket,      setTicket]      = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [agents,      setAgents]      = useState([]);
  const [nav,         setNav]         = useState({ prev:null, next:null });
  const [attachments, setAttachments] = useState({ user:[], admin:[] });
  const [adminUserId, setAdminUserId] = useState(null);

  /* form */
  const [reply,       setReply]       = useState('');
  const [files,       setFiles]       = useState([]);
  const [sending,     setSending]     = useState(false);
  const [closing,     setClosing]     = useState(false);

  const msgEndRef       = useRef(null);
  const attachSecRef    = useRef(null);
  const fileInputRef    = useRef(null);

  /* ── load all data ── */
  const loadAll = useCallback(async () => {
    if (!tid) return;
    try {
      const [tRes, mRes, aRes, nRes] = await Promise.all([
        post({ action:'get_ticket',   ticket_id:tid }),
        post({ action:'get_messages', ticket_id:tid }),
        post({ action:'get_agents' }),
        post({ action:'get_nav',      ticket_id:tid }),
      ]);

      if (!tRes.success) { navigate('/support'); return; }
      setTicket(tRes.ticket);
      setAdminUserId(tRes.admin_user_id);
      setMessages(mRes.messages || []);
      setAgents(aRes.agents   || []);
      setNav({ prev:nRes.prev, next:nRes.next });

      // Pre-fill reply with "Hi {fname},"
      if (tRes.ticket?.fname) setReply(`Hi ${tRes.ticket.fname},\n`);

      // Load attachments after we know user_id
      const attRes = await post({
        action:'get_attachments',
        ticket_id:tid,
        user_id: tRes.ticket.user_id,
      });
      if (attRes.success) setAttachments(attRes.attachments || { user:[], admin:[] });
    } catch(e) { toast.error(e.message); }
  }, [tid, navigate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── auto-scroll message list to bottom ── */
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages]);

  /* ── close ticket ── */
  const handleClose = async () => {
    if (!window.confirm('Close this ticket?')) return;
    setClosing(true);
    const res = await post({ action:'close_ticket', ticket_id:tid });
    setClosing(false);
    if (res.success) {
      toast.success('Ticket closed');
      if (nav.prev)  navigate(`/support/ticket/${nav.prev}`);
      else if (nav.next) navigate(`/support/ticket/${nav.next}`);
      else navigate('/support');
    } else toast.error(res.message);
  };

  /* ── assign agent ── */
  const handleAgentChange = async (agentId) => {
    const res = await post({ action:'update_agent', ticket_id:tid, agent_id:agentId });
    if (res.success) { toast.success('Agent updated'); setTicket(p=>({...p, agent_id:agentId})); }
    else toast.error(res.message);
  };

  /* ── send reply ── */
  const handleSend = async () => {
    const msg = reply.trim();
    if (!msg) { toast.error('Please enter a message'); return; }
    if (msg.length < 20 || msg.length > 1000) {
      toast.error('Message must be between 20 and 1000 characters'); return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('action',    'send_reply');
      fd.append('ticket_id', tid);
      fd.append('message',   msg);
      files.forEach(f => fd.append('attachments[]', f));

      const res = await fetch(API, { method:'POST', body:fd }).then(r=>r.json());
      if (res.success) {
        toast.success('Reply sent!');
        setReply('');
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadAll();
        setTicket(p=>({ ...p, status:'open' }));
      } else toast.error(res.message||'Failed');
    } catch(e) { toast.error(e.message); }
    finally { setSending(false); }
  };

  /* ── loading state ── */
  if (!ticket) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center',
      height:'calc(100vh - 62px)', background:'#f5f3ff', fontFamily:'Plus Jakarta Sans,sans-serif' }}>
      <div style={{ textAlign:'center', color:'#94a3b8' }}>
        <div style={{ width:36,height:36,border:'3px solid #ede9fe',borderTopColor:'#4f46e5',
          borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto 12px' }}/>
        <div style={{ fontSize:13 }}>Loading ticket...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  const isClosed = ticket.status === 'closed';
  const userName = ticket.name || ticket.fname || `User #${ticket.user_id}`;

  return (
    <>
    <Helmet>
        <title>View Ticket | Admin Panel</title>
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .vt-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .vt-msg-user { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; border-radius:16px 16px 4px 16px; }
        .vt-msg-cust { background:#f1f0ff; color:#1e293b; border-radius:16px 16px 16px 4px; }
        .vt-ta:focus { border-color:#4f46e5!important; box-shadow:0 0 0 3px rgba(79,70,229,.1)!important; outline:none; }
        .vt-sel:focus { border-color:#4f46e5!important; outline:none; }
        @keyframes vt_spin { to { transform:rotate(360deg); } }
        .vt-spin { display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:vt_spin .7s linear infinite; }
      `}</style>

      <div className="vt-root" style={{ display:'flex', flexDirection:'column',
        minHeight:'calc(100vh - 62px)', background:'#f5f3ff', overflow:'auto' }}>

        {/* ════ TOP BAR ════ */}
        <div style={{ background:'linear-gradient(135deg,#0d2137,#2d1b69)', color:'#fff',
          padding:'14px 22px', display:'flex', alignItems:'center',
          justifyContent:'space-between', flexWrap:'wrap', gap:10, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <Link to="/support"
              style={{ color:'rgba(255,255,255,.7)', textDecoration:'none', fontSize:12.5,
                fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
              ← Back
            </Link>
            <div style={{ width:1, height:18, background:'rgba(255,255,255,.2)' }}/>
            <div>
              <div style={{ fontSize:14, fontWeight:800 }}>
                Ticket #{tid} — {decodeHtml(ticket.subject)}
              </div>
              <div style={{ fontSize:11.5, opacity:.6, marginTop:2 }}>
                Submitted {fmtDT(ticket.created_at)}
              </div>
            </div>
          </div>

          {/* prev / next navigation */}
          <div style={{ display:'flex', gap:8 }}>
            {nav.next !== null && (
              <button onClick={()=>navigate(`/support/ticket/${nav.next}`)}
                style={{ padding:'6px 14px', border:'1.5px solid rgba(255,255,255,.3)',
                  borderRadius:7, background:'rgba(255,255,255,.1)', color:'#fff',
                  fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                ← Previous
              </button>
            )}
            {nav.prev !== null && (
              <button onClick={()=>navigate(`/support/ticket/${nav.prev}`)}
                style={{ padding:'6px 14px', border:'1.5px solid rgba(255,255,255,.3)',
                  borderRadius:7, background:'rgba(255,255,255,.1)', color:'#fff',
                  fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                Next →
              </button>
            )}
          </div>
        </div>

        {/* ════ BODY ════ */}
        <div style={{ padding:'18px 20px', display:'flex', gap:16,
          alignItems:'flex-start', flex:1, flexWrap:'wrap' }}>

          {/* ── LEFT COLUMN: chat ── */}
          <div style={{ flex:'1 1 560px', minWidth:0, display:'flex', flexDirection:'column', gap:14 }}>

            {/* ── TICKET META CARD ── */}
            <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
              padding:'16px 18px', boxShadow:'0 1px 6px rgba(79,70,229,.07)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                {/* status + date */}
                <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                  <div>
                    <div style={{ fontSize:10.5, fontWeight:700, color:'#94a3b8',
                      textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Status</div>
                    <StatusBadge status={ticket.status}/>
                  </div>
                  <div>
                    <div style={{ fontSize:10.5, fontWeight:700, color:'#94a3b8',
                      textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Submitted On</div>
                    <div style={{ fontSize:12.5, color:'#1e293b', fontWeight:500 }}>
                      {fmtDT(ticket.created_at)}
                    </div>
                  </div>
                </div>

                {/* action buttons */}
                <div style={{ display:'flex', gap:9, flexWrap:'wrap', alignItems:'center' }}>
                  <a href={`/search_result?q=${ticket.user_id}`} target="_blank" rel="noreferrer"
                    style={{ padding:'7px 14px', border:'none', borderRadius:8, fontSize:12.5,
                      fontWeight:700, cursor:'pointer', color:'#fff', textDecoration:'none',
                      background:'linear-gradient(135deg,#0ea5e9,#0284c7)', display:'inline-block' }}>
                    👤 User Details
                  </a>
                  <button onClick={handleClose} disabled={isClosed || closing}
                    style={{ padding:'7px 14px', border:'none', borderRadius:8, fontSize:12.5,
                      fontWeight:700, cursor:isClosed?'not-allowed':'pointer', color:'#fff',
                      fontFamily:'inherit', opacity:(isClosed||closing)?.5:1,
                      background:'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                    {closing ? '⏳ Closing...' : '🔒 Close Ticket'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── MESSAGE THREAD ── */}
            <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
              display:'flex', flexDirection:'column', overflow:'hidden',
              boxShadow:'0 1px 6px rgba(79,70,229,.07)' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1.5px solid #f5f3ff',
                fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase',
                letterSpacing:'.05em' }}>
                💬 Messages ({messages.length})
              </div>

              <div style={{ padding:'14px 16px', overflowY:'auto', maxHeight:400,
                display:'flex', flexDirection:'column', gap:12 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign:'center', color:'#94a3b8', fontSize:13,
                    padding:'30px 0' }}>No messages yet</div>
                )}
                {messages.map(msg => {
                  const isAdmin = parseInt(msg.user_id) === parseInt(adminUserId);
                  return (
                    <div key={msg.message_id}
                      style={{ display:'flex', flexDirection:'column',
                        alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                      {/* sender label */}
                      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', marginBottom:4,
                        paddingLeft:4, paddingRight:4 }}>
                        {isAdmin ? 'You (Admin)' : userName}
                        {' · '}
                        <span style={{ fontWeight:400 }}>{fmtDT(msg.created_at)}</span>
                        {msg.attachment == 1 && (
                          <button onClick={()=>attachSecRef.current?.scrollIntoView({behavior:'smooth'})}
                            style={{ background:'none', border:'none', cursor:'pointer',
                              color:'#4f46e5', fontSize:11, marginLeft:6, padding:0 }}>
                            📎 View Attachment
                          </button>
                        )}
                      </div>
                      {/* bubble */}
                      <div className={isAdmin ? 'vt-msg-user' : 'vt-msg-cust'}
                        style={{ padding:'10px 14px', maxWidth:'78%', fontSize:13,
                          lineHeight:1.6, wordBreak:'break-word' }}>
                        {decodeHtml(msg.message).split('\n').map((l,i)=>
                          <span key={i}>{l}{i < msg.message.split('\n').length-1 && <br/>}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={msgEndRef}/>
              </div>

              {/* ── REPLY FORM ── */}
              <div style={{ padding:'14px 16px', borderTop:'1.5px solid #f5f3ff' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase',
                  letterSpacing:'.05em', marginBottom:8 }}>Reply</div>
                <textarea className="vt-ta" value={reply} onChange={e=>setReply(e.target.value)}
                  rows={5} placeholder="Type your reply..."
                  disabled={isClosed}
                  style={{ width:'100%', padding:'10px 13px', border:'1.5px solid #e2e8f0',
                    borderRadius:9, fontSize:13, fontFamily:'inherit', resize:'vertical',
                    color:'#1e293b', background: isClosed ? '#f8f9fa' : '#fff',
                    cursor: isClosed ? 'not-allowed' : 'auto' }}/>

                {/* file attachment */}
                <div style={{ marginTop:10 }}>
                  <label style={{ fontSize:11.5, fontWeight:600, color:'#64748b',
                    display:'block', marginBottom:5 }}>
                    📎 Attachments
                    <span style={{ fontSize:11, fontWeight:400, color:'#94a3b8', marginLeft:6 }}>
                      (jpg, jpeg, png, pdf, doc, docx — max 1MB each)
                    </span>
                  </label>
                  <input ref={fileInputRef} type="file" multiple
                    accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                    disabled={isClosed}
                    onChange={e=>setFiles(Array.from(e.target.files))}
                    style={{ fontSize:12.5, fontFamily:'inherit', cursor: isClosed?'not-allowed':'pointer' }}/>
                  {files.length > 0 && (
                    <div style={{ fontSize:11.5, color:'#4f46e5', marginTop:4 }}>
                      {files.length} file(s) selected
                    </div>
                  )}
                </div>

                <div style={{ display:'flex', gap:10, marginTop:12, alignItems:'center' }}>
                  <button onClick={handleSend} disabled={isClosed || sending}
                    style={{ padding:'9px 22px', border:'none', borderRadius:8, fontSize:13,
                      fontWeight:700, cursor:(isClosed||sending)?'not-allowed':'pointer',
                      color:'#fff', fontFamily:'inherit',
                      background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                      opacity:(isClosed||sending)?.6:1,
                      display:'flex', alignItems:'center', gap:8 }}>
                    {sending ? <><span className="vt-spin"/> Sending...</> : '📤 Submit Reply'}
                  </button>
                  {isClosed && (
                    <span style={{ fontSize:12, color:'#94a3b8', fontStyle:'italic' }}>
                      This ticket is closed — reopen it to reply
                    </span>
                  )}
                  <span style={{ fontSize:11.5, color: reply.length < 20 || reply.length > 1000 ? '#ef4444' : '#94a3b8',
                    marginLeft:'auto' }}>
                    {reply.length}/1000
                  </span>
                </div>
              </div>
            </div>

            {/* ── ATTACHMENTS ── */}
            <div ref={attachSecRef} style={{ background:'#fff', borderRadius:14,
              border:'1.5px solid #ede9fe', overflow:'hidden',
              boxShadow:'0 1px 6px rgba(79,70,229,.07)' }}>

              {/* User Attachments */}
              <div style={{ padding:'14px 16px', borderBottom:'1.5px solid #f5f3ff' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase',
                  letterSpacing:'.05em', marginBottom:10 }}>📁 User Attachments</div>
                {attachments.user.length === 0
                  ? <p style={{ fontSize:13, color:'#94a3b8', margin:0 }}>No attachments found</p>
                  : <div style={{ display:'flex', flexWrap:'wrap', gap:9 }}>
                      {attachments.user.map((f,i)=><AttachmentCard key={i} file={f}/>)}
                    </div>}
              </div>

              {/* Admin Attachments */}
              <div style={{ padding:'14px 16px' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase',
                  letterSpacing:'.05em', marginBottom:10 }}>🗂️ Admin Attachments</div>
                {attachments.admin.length === 0
                  ? <p style={{ fontSize:13, color:'#94a3b8', margin:0 }}>No attachments found</p>
                  : <div style={{ display:'flex', flexWrap:'wrap', gap:9 }}>
                      {attachments.admin.map((f,i)=><AttachmentCard key={i} file={f}/>)}
                    </div>}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: ticket info + agent ── */}
          <div style={{ width:260, flexShrink:0, display:'flex', flexDirection:'column', gap:12 }}>

            {/* User Info */}
            <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
              padding:'16px', boxShadow:'0 1px 6px rgba(79,70,229,.07)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase',
                letterSpacing:'.05em', marginBottom:12 }}>👤 User Info</div>
              {/* avatar */}
              <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:12 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', flexShrink:0,
                  background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:16, fontWeight:800, color:'#fff' }}>
                  {(ticket.name||ticket.fname||'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:13.5, color:'#1e293b' }}>
                    {ticket.name || ticket.fname || `User #${ticket.user_id}`}
                  </div>
                  <div style={{ fontSize:11.5, color:'#64748b' }}>{ticket.email}</div>
                </div>
              </div>
              <a href={`/search_result?q=${ticket.user_id}`} target="_blank" rel="noreferrer"
                style={{ display:'block', textAlign:'center', padding:'7px 0',
                  border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
                  cursor:'pointer', color:'#fff', textDecoration:'none',
                  background:'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
                👤 View User Details
              </a>
            </div>

            {/* Ticket Details */}
            <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
              padding:'16px', boxShadow:'0 1px 6px rgba(79,70,229,.07)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase',
                letterSpacing:'.05em', marginBottom:12 }}>🎫 Ticket Details</div>
              {[
                { label:'Ticket ID',  val:`#${ticket.ticket_id}` },
                { label:'User ID',    val:ticket.user_id },
                { label:'Status',     val:<StatusBadge status={ticket.status}/> },
                { label:'Created',    val:fmtDT(ticket.created_at) },
              ].map(row=>(
                <div key={row.label} style={{ display:'flex', justifyContent:'space-between',
                  alignItems:'center', padding:'7px 0', borderBottom:'1px solid #f5f3ff' }}>
                  <span style={{ fontSize:11.5, color:'#94a3b8', fontWeight:600 }}>{row.label}</span>
                  <span style={{ fontSize:12, color:'#1e293b', fontWeight:600 }}>{row.val}</span>
                </div>
              ))}
            </div>

            {/* Assign Agent */}
            <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
              padding:'16px', boxShadow:'0 1px 6px rgba(79,70,229,.07)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase',
                letterSpacing:'.05em', marginBottom:10 }}>🧑‍💼 Assigned Agent</div>
              <select className="vt-sel" value={ticket.agent_id || ''}
                onChange={e=>handleAgentChange(e.target.value)}
                style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #e2e8f0',
                  borderRadius:8, fontSize:12.5, fontFamily:'inherit', color:'#1e293b',
                  background:'#fff', cursor:'pointer', appearance:'auto' }}>
                <option value="">Unassigned</option>
                {agents.map(a=>(
                  <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>
                ))}
              </select>
            </div>

            {/* Nav shortcuts */}
            {(nav.prev || nav.next) && (
              <div style={{ background:'#fff', borderRadius:14, border:'1.5px solid #ede9fe',
                padding:'14px 16px', boxShadow:'0 1px 6px rgba(79,70,229,.07)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase',
                  letterSpacing:'.05em', marginBottom:10 }}>📂 Open Tickets</div>
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {nav.next && (
                    <button onClick={()=>navigate(`/support/ticket/${nav.next}`)}
                      style={{ padding:'7px 12px', border:'1.5px solid #ede9fe', borderRadius:8,
                        background:'#f8f5ff', color:'#4f46e5', fontSize:12, fontWeight:700,
                        cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                      ← Previous #{nav.next}
                    </button>
                  )}
                  {nav.prev && (
                    <button onClick={()=>navigate(`/support/ticket/${nav.prev}`)}
                      style={{ padding:'7px 12px', border:'1.5px solid #ede9fe', borderRadius:8,
                        background:'#f8f5ff', color:'#4f46e5', fontSize:12, fontWeight:700,
                        cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                      Next #{nav.prev} →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}