import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const API  = 'https://cit3.internshipstudio.com/admin/react-api/api/settings/sync-exam-users.php';
const post = d => fetch(API, { method:'POST', body:new URLSearchParams(d) }).then(r => r.json());

/* ─── user row ─── */
const UserRow = ({ user, idx, variant }) => {
  const isNew = variant === 'new';
  return (
    <tr>
      <td style={{ padding:'10px 14px', fontSize:12, color:'#94a3b8',
        borderBottom:'1px solid #f5f3ff' }}>{idx+1}</td>
      <td style={{ padding:'10px 14px', borderBottom:'1px solid #f5f3ff' }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:30, height:30, borderRadius:'50%', flexShrink:0,
            background: isNew
              ? 'linear-gradient(135deg,#ede9fe,#c4b5fd)'
              : 'linear-gradient(135deg,#dcfce7,#86efac)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:12, fontWeight:700,
            color: isNew ? '#4f46e5' : '#15803d' }}>
            {(user.name||'?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize:12.5, fontWeight:600, color:'#1e293b' }}>{user.name||'—'}</div>
            {user.phone && <div style={{ fontSize:11, color:'#94a3b8' }}>{user.phone}</div>}
          </div>
        </div>
      </td>
      <td style={{ padding:'10px 14px', fontSize:12.5, color:'#64748b',
        borderBottom:'1px solid #f5f3ff' }}>{user.email||'—'}</td>
      <td style={{ padding:'10px 14px', borderBottom:'1px solid #f5f3ff' }}>
        {isNew
          ? <span style={{ background:'#ede9fe', color:'#4f46e5', padding:'2px 9px',
              borderRadius:99, fontSize:11, fontWeight:700 }}>🔄 Needs Sync</span>
          : <span style={{ background:'#dcfce7', color:'#15803d', padding:'2px 9px',
              borderRadius:99, fontSize:11, fontWeight:700 }}>✅ Synced</span>}
      </td>
    </tr>
  );
};

/* ─── stat chip ─── */
const Chip = ({ value, label, bg, color, border }) => (
  <div style={{ background:bg, border:`1.5px solid ${border}`, borderRadius:12,
    padding:'13px 18px', display:'flex', alignItems:'center', gap:10, flex:1, minWidth:130 }}>
    <div style={{ fontSize:26, fontWeight:800, color }}>{value}</div>
    <div style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase',
      letterSpacing:'.04em', lineHeight:1.4 }}>{label}</div>
  </div>
);

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function SyncExamUsers() {
  const [preview,  setPreview]  = useState(null);   // null → not loaded
  const [result,   setResult]   = useState(null);   // post-sync result
  const [loading,  setLoading]  = useState(false);
  const [running,  setRunning]  = useState(false);
  const [tab,      setTab]      = useState('new');   // 'new' | 'synced'
  const [confirm,  setConfirm]  = useState(false);
  const [search,   setSearch]   = useState('');

  /* ── preview ── */
  const loadPreview = useCallback(async () => {
    setLoading(true); setResult(null);
    try {
      const res = await post({ action:'preview' });
      if (res.success) { setPreview(res); setTab('new'); }
      else toast.error(res.message||'Failed');
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  /* ── run sync ── */
  const runSync = async () => {
    setConfirm(false); setRunning(true);
    try {
      const res = await post({ action:'run_sync' });
      if (res.success) {
        setResult(res);
        setPreview(null);
        toast.success(`Done! ${res.added} users added.`);
        if (res.errors?.length) res.errors.forEach(e=>toast.error(e, {duration:8000}));
      } else toast.error(res.message||'Sync failed');
    } catch(e) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  /* ── filtered list ── */
  const currentList = preview
    ? (tab === 'new' ? preview.need_sync : preview.already_synced)
    : [];
  const filtered = search.trim()
    ? currentList.filter(u =>
        (u.name||'').toLowerCase().includes(search.toLowerCase()) ||
        (u.email||'').toLowerCase().includes(search.toLowerCase()))
    : currentList;

  const thS = {
    padding:'10px 14px', fontSize:10.5, fontWeight:700, color:'#fff',
    textAlign:'left', textTransform:'uppercase', letterSpacing:'.5px',
    background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
    borderRight:'1px solid rgba(255,255,255,.15)', position:'sticky', top:0, zIndex:2,
  };

  return (
    <>
    <Helmet>
        <title>Seed Exam | Admin Panel</title>
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .seu-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .seu-tr:hover td { background:#faf9ff!important; }
        @keyframes seu_spin { to { transform:rotate(360deg); } }
        .seu-spin { display:inline-block;width:18px;height:18px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:seu_spin .7s linear infinite; }
      `}</style>

      <div className="seu-root" style={{ display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)', padding:20, gap:14, overflow:'hidden', background:'#f5f3ff' }}>

        {/* ── HEADER ── */}
        <div style={{ flexShrink:0, display:'flex', alignItems:'center',
          justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>
              🔄 Sync Exam Users
            </div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
              Add users with <code style={{ background:'#ede9fe', color:'#4f46e5',
                padding:'1px 5px', borderRadius:4, fontSize:11 }}>applyforexam = 1</code> to the exam database
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {preview && !result && (
              <button onClick={loadPreview} disabled={loading}
                style={{ padding:'8px 14px', border:'1.5px solid #e2e8f0', borderRadius:8,
                  background:'#fff', color:'#64748b', fontSize:12.5, fontWeight:600,
                  cursor:'pointer', fontFamily:'inherit' }}>🔄 Refresh</button>
            )}
            {!preview && !result && (
              <button onClick={loadPreview} disabled={loading}
                style={{ padding:'9px 22px', border:'none', borderRadius:9, fontSize:13,
                  fontWeight:700, cursor:loading?'not-allowed':'pointer', color:'#fff',
                  fontFamily:'inherit', opacity:loading?.6:1,
                  background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  display:'flex', alignItems:'center', gap:8 }}>
                {loading ? <><span className="seu-spin"/> Loading...</> : '🔍 Preview Users'}
              </button>
            )}
          </div>
        </div>

        {/* ══════════ INITIAL STATE ══════════ */}
        {!preview && !result && !loading && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid #ede9fe',
              padding:'40px 50px', textAlign:'center', maxWidth:480,
              boxShadow:'0 1px 8px rgba(79,70,229,.07)' }}>
              <div style={{ fontSize:52, marginBottom:14 }}>🔄</div>
              <div style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:8 }}>
                Exam User Sync
              </div>
              <div style={{ fontSize:13, color:'#64748b', lineHeight:1.7, marginBottom:24 }}>
                This tool finds all users with <strong>applyforexam = 1</strong> who don't yet have
                exam credentials, then generates passwords and syncs them to the exam database.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8,
                background:'#f8f5ff', border:'1.5px solid #ede9fe', borderRadius:10,
                padding:'12px 16px', marginBottom:24, textAlign:'left' }}>
                {[
                  { icon:'📋', text:'Fetches all users where applyforexam = 1 (except user_id = 1)' },
                  { icon:'🔍', text:'Checks exam_credentials for existing entries' },
                  { icon:'🔑', text:'Generates 16-char secure password for new users' },
                  { icon:'💾', text:'Inserts into exam DB users + exam_credentials + updates user_steps' },
                ].map((s,i)=>(
                  <div key={i} style={{ display:'flex', gap:9, fontSize:12.5, color:'#475569' }}>
                    <span style={{ flexShrink:0 }}>{s.icon}</span>{s.text}
                  </div>
                ))}
              </div>
              <button onClick={loadPreview}
                style={{ padding:'11px 32px', border:'none', borderRadius:9, fontSize:13,
                  fontWeight:700, cursor:'pointer', color:'#fff', fontFamily:'inherit',
                  background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  boxShadow:'0 4px 14px rgba(79,70,229,.3)' }}>
                🔍 Preview Users
              </button>
            </div>
          </div>
        )}

        {/* ══════════ LOADING ══════════ */}
        {loading && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ textAlign:'center', color:'#94a3b8' }}>
              <span className="seu-spin" style={{ width:32, height:32, borderWidth:3,
                display:'block', margin:'0 auto 12px' }}/>
              <div style={{ fontSize:13 }}>Scanning users...</div>
            </div>
          </div>
        )}

        {/* ══════════ RESULT STATE (after sync) ══════════ */}
        {result && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:14, overflowY:'auto' }}>
            {/* success banner */}
            <div style={{ background:'#dcfce7', border:'1.5px solid #86efac', borderRadius:12,
              padding:'18px 22px', display:'flex', alignItems:'center', gap:16, flexShrink:0 }}>
              <span style={{ fontSize:40, flexShrink:0 }}>✅</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, color:'#15803d', fontSize:15 }}>Sync Complete!</div>
                <div style={{ fontSize:13, color:'#166534', marginTop:3 }}>{result.message}</div>
              </div>
              <button onClick={()=>{ setResult(null); setPreview(null); }}
                style={{ padding:'8px 16px', border:'1.5px solid #86efac', borderRadius:8,
                  background:'#fff', color:'#15803d', fontSize:12.5, fontWeight:700,
                  cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
                Run Again
              </button>
            </div>
            {/* result chips */}
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', flexShrink:0 }}>
              <Chip value={result.total}   label="Total Users"   bg="#ede9fe" color="#4f46e5" border="#c4b5fd"/>
              <Chip value={result.added}   label="Added to Exam" bg="#dcfce7" color="#15803d" border="#86efac"/>
              <Chip value={result.skipped} label="Already Had"   bg="#dbeafe" color="#1d4ed8" border="#bfdbfe"/>
              {result.errors?.length > 0 && (
                <Chip value={result.errors.length} label="Errors" bg="#fee2e2" color="#b91c1c" border="#fca5a5"/>
              )}
            </div>
            {/* errors list */}
            {result.errors?.length > 0 && (
              <div style={{ background:'#fef2f2', border:'1.5px solid #fca5a5', borderRadius:10,
                padding:'14px 16px', flexShrink:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#dc2626', marginBottom:8 }}>
                  ⚠️ Errors ({result.errors.length})
                </div>
                {result.errors.map((e,i)=>(
                  <div key={i} style={{ fontSize:12, color:'#991b1b', padding:'3px 0',
                    borderBottom:'1px solid #fecaca' }}>{e}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════ PREVIEW STATE ══════════ */}
        {preview && !result && (
          <>
            {/* stat chips */}
            <div style={{ display:'flex', gap:12, flexShrink:0, flexWrap:'wrap' }}>
              <Chip value={preview.total}        label="Total Users"    bg="#ede9fe" color="#4f46e5" border="#c4b5fd"/>
              <Chip value={preview.need_count}   label="Needs Sync"     bg={preview.need_count>0?'#fff7ed':'#dcfce7'} color={preview.need_count>0?'#c2410c':'#15803d'} border={preview.need_count>0?'#fed7aa':'#86efac'}/>
              <Chip value={preview.synced_count} label="Already Synced" bg="#dbeafe" color="#1d4ed8" border="#bfdbfe"/>
              {/* run button */}
              {preview.need_count > 0 && (
                <div style={{ display:'flex', alignItems:'center', marginLeft:'auto' }}>
                  <button onClick={()=>setConfirm(true)} disabled={running}
                    style={{ padding:'12px 26px', border:'none', borderRadius:10, fontSize:13.5,
                      fontWeight:800, cursor:running?'not-allowed':'pointer', color:'#fff',
                      fontFamily:'inherit', opacity:running?.7:1,
                      background:'linear-gradient(135deg,#16a34a,#15803d)',
                      boxShadow:'0 4px 14px rgba(22,163,74,.3)',
                      display:'flex', alignItems:'center', gap:9 }}>
                    {running
                      ? <><span className="seu-spin"/> Syncing...</>
                      : `▶ Run Sync (${preview.need_count} users)`}
                  </button>
                </div>
              )}
            </div>

            {/* tab bar + table */}
            <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:14,
              border:'1.5px solid #ede9fe', display:'flex', flexDirection:'column',
              overflow:'hidden', boxShadow:'0 1px 8px rgba(79,70,229,.07)' }}>

              {/* tabs + search */}
              <div style={{ padding:'0 16px', borderBottom:'1.5px solid #f5f3ff',
                display:'flex', alignItems:'center', gap:12, flexShrink:0, flexWrap:'wrap' }}>
                {[
                  { key:'new',    label:`🔄 Needs Sync (${preview.need_count})`,   color:'#4f46e5' },
                  { key:'synced', label:`✅ Already Synced (${preview.synced_count})`, color:'#15803d' },
                ].map(t=>(
                  <button key={t.key} onClick={()=>{setTab(t.key);setSearch('');}}
                    style={{ padding:'11px 4px', border:'none', background:'none', cursor:'pointer',
                      fontSize:12.5, fontWeight:700, fontFamily:'inherit',
                      color: tab===t.key ? t.color : '#94a3b8',
                      borderBottom: tab===t.key ? `2px solid ${t.color}` : '2px solid transparent',
                      marginBottom:-1, transition:'color .15s' }}>
                    {t.label}
                  </button>
                ))}
                {/* search */}
                <div style={{ marginLeft:'auto', position:'relative' }}>
                  <span style={{ position:'absolute', left:9, top:'50%',
                    transform:'translateY(-50%)', color:'#94a3b8', fontSize:13 }}>🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Search..."
                    style={{ padding:'6px 10px 6px 29px', border:'1.5px solid #e2e8f0',
                      borderRadius:7, fontSize:12.5, fontFamily:'inherit', outline:'none',
                      color:'#1e293b', background:'#fafafe', width:190,
                      transition:'border .15s' }}
                    onFocus={e=>e.target.style.borderColor='#4f46e5'}
                    onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
                  {search && (
                    <button onClick={()=>setSearch('')}
                      style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                        background:'none', border:'none', cursor:'pointer',
                        color:'#94a3b8', fontSize:15 }}>×</button>
                  )}
                </div>
              </div>

              <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
                <table style={{ borderCollapse:'collapse', width:'100%', minWidth:500 }}>
                  <thead>
                    <tr>
                      {['#','User','Email','Status'].map(h=>(
                        <th key={h} style={thS}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!filtered.length ? (
                      <tr><td colSpan={4} style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>
                        <div style={{ fontSize:36, marginBottom:8 }}>
                          {tab==='new' ? '🎉' : '🔍'}
                        </div>
                        <div style={{ fontSize:13, fontWeight:600, color:'#64748b' }}>
                          {tab==='new' && !search ? 'All users are already synced!' : `No results${search?` for "${search}"`:''}`}
                        </div>
                      </td></tr>
                    ) : filtered.map((u,i)=>(
                      <UserRow key={u.id||i} user={u} idx={i} variant={tab==='new'?'new':'synced'}/>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* footer */}
              <div style={{ padding:'8px 16px', borderTop:'1.5px solid #f5f3ff', flexShrink:0,
                fontSize:12, color:'#94a3b8', display:'flex', justifyContent:'space-between' }}>
                <span>Showing {filtered.length} of {currentList.length}</span>
                {tab==='new' && preview.need_count===0 && (
                  <span style={{ color:'#15803d', fontWeight:600 }}>✅ All users are synced</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── CONFIRM MODAL ── */}
      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={e=>e.target===e.currentTarget&&setConfirm(false)}>
          <div style={{ background:'#fff', borderRadius:16, padding:'28px 30px', width:420,
            maxWidth:'92vw', boxShadow:'0 24px 70px rgba(0,0,0,.2)', textAlign:'center' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>▶</div>
            <div style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:8 }}>
              Run Sync Now?
            </div>
            <div style={{ fontSize:13, color:'#64748b', lineHeight:1.7, marginBottom:16 }}>
              This will add <strong style={{ color:'#4f46e5', fontSize:15 }}>{preview?.need_count}</strong> user{preview?.need_count!==1?'s':''} to the exam database
              with generated credentials.
            </div>
            <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:9,
              padding:'10px 14px', marginBottom:22, fontSize:12, color:'#92400e', textAlign:'left' }}>
              🔑 Each user will get a unique 16-character password stored in <code style={{ background:'#ffedd5', padding:'1px 5px', borderRadius:4 }}>exam_credentials</code>.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setConfirm(false)}
                style={{ flex:1, padding:11, border:'1.5px solid #e2e8f0', borderRadius:9,
                  background:'#fff', color:'#475569', fontSize:13, fontWeight:600,
                  cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={runSync}
                style={{ flex:1, padding:11, border:'none', borderRadius:9, fontSize:13,
                  fontWeight:700, cursor:'pointer', color:'#fff', fontFamily:'inherit',
                  background:'linear-gradient(135deg,#16a34a,#15803d)',
                  boxShadow:'0 4px 14px rgba(22,163,74,.25)' }}>
                ▶ Yes, Run Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}