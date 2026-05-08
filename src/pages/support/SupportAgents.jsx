import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/support/support_agents.php';
const post = d => fetch(API, { method:'POST', body:new URLSearchParams(d) }).then(r => r.json());

/* ─── inline input ─── */
const InlineInput = ({ type='text', value, onChange, placeholder }) => (
  <input type={type} value={value} onChange={e=>onChange(e.target.value)}
    placeholder={placeholder}
    style={{ padding:'6px 10px', border:'1.5px solid #c4b5fd', borderRadius:7,
      fontSize:12.5, fontFamily:'inherit', outline:'none', background:'#fff',
      width:'100%', minWidth:160, transition:'border .15s' }}/>
);

/* ─── action button ─── */
const Btn = ({ label, onClick, grad, outline, disabled }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ padding:'5px 13px', border: outline ? `1.5px solid #e2e8f0` : 'none',
      borderRadius:7, fontSize:11.5, fontWeight:700, cursor:disabled?'not-allowed':'pointer',
      fontFamily:'inherit', whiteSpace:'nowrap', transition:'opacity .15s',
      background: outline ? '#fff' : grad,
      color: outline ? '#64748b' : '#fff',
      opacity: disabled ? .6 : 1 }}>
    {label}
  </button>
);

/* ─── confirm delete modal ─── */
function DeleteModal({ agent, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:1000 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff', borderRadius:14, padding:'24px 26px', width:380,
        maxWidth:'90vw', boxShadow:'0 20px 60px rgba(0,0,0,.2)', textAlign:'center' }}>
        <div style={{ fontSize:38, marginBottom:12 }}>⚠️</div>
        <div style={{ fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:6 }}>Are you sure?</div>
        <div style={{ fontSize:12.5, color:'#64748b', marginBottom:6 }}>
          Delete agent <strong style={{ color:'#1e293b' }}>{agent.agent_name}</strong>?
        </div>
        <div style={{ fontSize:12, color:'#94a3b8', marginBottom:20 }}>
          All tickets assigned to this agent will be reassigned to the Default Agent.
        </div>
        <div style={{ display:'flex', justifyContent:'center', gap:10 }}>
          <button onClick={onClose}
            style={{ padding:'8px 18px', border:'1.5px solid #e2e8f0', borderRadius:8,
              background:'#fff', color:'#475569', fontSize:12.5, fontWeight:600,
              cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
          <button onClick={async()=>{
              setLoading(true);
              await onConfirm(agent.agent_id);
              setLoading(false); onClose();
            }} disabled={loading}
            style={{ padding:'8px 20px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
              cursor:loading?'not-allowed':'pointer', color:'#fff', fontFamily:'inherit',
              background:'linear-gradient(135deg,#dc2626,#b91c1c)', opacity:loading?.7:1 }}>
            {loading ? '⏳ Deleting...' : 'Yes, delete it!'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function SupportAgents() {
  const [agents,     setAgents]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  /* edit state: null | { agent_id, agent_name, agent_email } */
  const [editId,     setEditId]     = useState(null);
  const [editForm,   setEditForm]   = useState({ agent_name:'', agent_email:'' });
  /* add state */
  const [adding,     setAdding]     = useState(false);
  const [addForm,    setAddForm]    = useState({ agent_name:'', agent_email:'' });
  const [saveLoading,setSaveLoading]= useState(false);
  /* delete */
  const [deleteTarget,setDeleteTarget] = useState(null);

  /* ── load ── */
  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await post({ action:'get_agents' });
      if (res.success) setAgents(res.agents || []);
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  /* ── add ── */
  const startAdd = () => {
    setAdding(true);
    setEditId(null);
    setAddForm({ agent_name:'', agent_email:'' });
  };
  const cancelAdd = () => { setAdding(false); setAddForm({ agent_name:'', agent_email:'' }); };
  const handleAdd = async () => {
    if (addForm.agent_name.length < 3 || addForm.agent_email.length < 3) {
      toast.error('Name and email must be at least 3 characters long'); return;
    }
    setSaveLoading(true);
    const res = await post({ action:'add_agent', ...addForm });
    setSaveLoading(false);
    if (res.status==='success') { toast.success(res.message); setAdding(false); setAddForm({ agent_name:'', agent_email:'' }); loadAgents(); }
    else toast.error(res.message||'Failed');
  };

  /* ── edit ── */
  const startEdit = (agent) => {
    setEditId(agent.agent_id);
    setEditForm({ agent_name:agent.agent_name, agent_email:agent.agent_email });
    setAdding(false);
  };
  const cancelEdit = () => { setEditId(null); setEditForm({ agent_name:'', agent_email:'' }); };
  const handleEdit = async (id) => {
    if (editForm.agent_name.length < 3 || editForm.agent_email.length < 3) {
      toast.error('Name and email must be at least 3 characters long'); return;
    }
    setSaveLoading(true);
    const res = await post({ action:'edit_agent', agent_id:id, ...editForm });
    setSaveLoading(false);
    if (res.status==='success') { toast.success(res.message); setEditId(null); loadAgents(); }
    else toast.error(res.message||'Failed');
  };

  /* ── delete ── */
  const handleDelete = async (id) => {
    const res = await post({ action:'delete_agent', agent_id:id });
    if (res.status==='success') { toast.success(res.message); loadAgents(); }
    else toast.error(res.message||'Failed');
  };

  const thS = {
    padding:'11px 16px', fontSize:11, fontWeight:700, color:'#fff', textAlign:'left',
    textTransform:'uppercase', letterSpacing:'.5px', whiteSpace:'nowrap',
    background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
    borderRight:'1px solid rgba(255,255,255,.15)', position:'sticky', top:0, zIndex:2,
  };
  const tdS = {
    padding:'11px 16px', fontSize:12.5, color:'#1e293b',
    borderBottom:'1px solid #f5f3ff', verticalAlign:'middle',
  };

  return (
    <>
    <Helmet>
        <title>Support Agents | Admin Panel</title>
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .sa-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .sa-tr:hover td { background:#faf9ff!important; }
        .sa-inp:focus { border-color:#4f46e5!important; box-shadow:0 0 0 3px rgba(79,70,229,.1)!important; }
        @keyframes sa_spin { to { transform:rotate(360deg); } }
        .sa-spin { display:inline-block;width:18px;height:18px;border:2.5px solid #ede9fe;border-top-color:#4f46e5;border-radius:50%;animation:sa_spin .7s linear infinite; }
      `}</style>

      <div className="sa-root" style={{ display:'flex', flexDirection:'column',
        height:'calc(100vh - 62px)', padding:20, gap:14, overflow:'hidden', background:'#f5f3ff' }}>

        {/* ── HEADER ── */}
        <div style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>🧑‍💼 Support Agents</div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
              Manage customer support team members
            </div>
          </div>
          <button onClick={startAdd} disabled={adding}
            style={{ padding:'8px 18px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:700,
              cursor:adding?'not-allowed':'pointer', color:'#fff', fontFamily:'inherit',
              background:'linear-gradient(135deg,#16a34a,#15803d)', opacity:adding?.6:1,
              display:'flex', alignItems:'center', gap:7 }}>
            ➕ Add New Agent
          </button>
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:14,
          border:'1.5px solid #ede9fe', display:'flex', flexDirection:'column',
          overflow:'hidden', boxShadow:'0 1px 8px rgba(79,70,229,.07)' }}>

          {/* counter bar */}
          <div style={{ padding:'9px 16px', borderBottom:'1.5px solid #f5f3ff', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:12.5, color:'#64748b' }}>
              {loading
                ? <span className="sa-spin"/>
                : <><strong style={{ color:'#1e293b' }}>{agents.length}</strong> agents registered</>}
            </div>
            {adding && (
              <div style={{ fontSize:11.5, color:'#4f46e5', fontWeight:600 }}>
                📝 Fill in the row below to add a new agent
              </div>
            )}
          </div>

          <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
            <table style={{ borderCollapse:'collapse', width:'100%', minWidth:600 }}>
              <thead>
                <tr>
                  {['Agent ID','Agent Name','Agent Email','Action'].map(h=>(
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* ── existing rows ── */}
                {loading ? (
                  <tr><td colSpan={4} style={{ textAlign:'center', padding:50, color:'#94a3b8' }}>
                    <div className="sa-spin" style={{ width:26,height:26,margin:'0 auto 10px' }}/>
                    <div style={{ fontSize:13 }}>Loading agents...</div>
                  </td></tr>
                ) : agents.map(agent => {
                  const isDefault = agent.agent_id == 1;
                  const isEditing = editId === agent.agent_id;
                  return (
                    <tr key={agent.agent_id} className="sa-tr">
                      {/* ID */}
                      <td style={{ ...tdS, fontFamily:'monospace', color:'#6b7280', fontSize:12 }}>
                        {agent.agent_id}
                      </td>

                      {/* Name */}
                      <td style={tdS}>
                        {isEditing
                          ? <InlineInput className="sa-inp" value={editForm.agent_name}
                              onChange={v=>setEditForm(p=>({...p,agent_name:v}))}
                              placeholder="Agent Name"/>
                          : <span style={{ fontWeight:600 }}>{agent.agent_name}</span>}
                      </td>

                      {/* Email */}
                      <td style={tdS}>
                        {isEditing
                          ? <InlineInput className="sa-inp" type="email" value={editForm.agent_email}
                              onChange={v=>setEditForm(p=>({...p,agent_email:v}))}
                              placeholder="Agent Email"/>
                          : <span style={{ color:'#64748b' }}>{agent.agent_email}</span>}
                      </td>

                      {/* Action */}
                      <td style={tdS}>
                        {isDefault ? (
                          /* agent_id = 1 → Default Agent badge, no edit/delete */
                          <span style={{ padding:'4px 12px', borderRadius:99, fontSize:11,
                            fontWeight:700, background:'#ede9fe', color:'#4f46e5' }}>
                            ⭐ Default Agent
                          </span>
                        ) : isEditing ? (
                          <div style={{ display:'flex', gap:7 }}>
                            <Btn label="💾 Save" onClick={()=>handleEdit(agent.agent_id)}
                              grad="linear-gradient(135deg,#16a34a,#15803d)" disabled={saveLoading}/>
                            <Btn label="✕ Cancel" onClick={cancelEdit} outline/>
                          </div>
                        ) : (
                          <div style={{ display:'flex', gap:7 }}>
                            <Btn label="✏️ Edit"
                              onClick={()=>startEdit(agent)}
                              grad="linear-gradient(135deg,#4f46e5,#7c3aed)"/>
                            <Btn label="🗑️ Delete"
                              onClick={()=>setDeleteTarget(agent)}
                              grad="linear-gradient(135deg,#dc2626,#b91c1c)"/>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* ── ADD NEW ROW ── (appended at bottom same as PHP) */}
                {adding && (
                  <tr style={{ background:'#f5f3ff' }}>
                    <td style={{ ...tdS, fontStyle:'italic', color:'#94a3b8', fontSize:12 }}>
                      Auto-generated
                    </td>
                    <td style={tdS}>
                      <InlineInput className="sa-inp" value={addForm.agent_name}
                        onChange={v=>setAddForm(p=>({...p,agent_name:v}))}
                        placeholder="Enter Name"/>
                    </td>
                    <td style={tdS}>
                      <InlineInput className="sa-inp" type="email" value={addForm.agent_email}
                        onChange={v=>setAddForm(p=>({...p,agent_email:v}))}
                        placeholder="Enter Email"/>
                    </td>
                    <td style={tdS}>
                      <div style={{ display:'flex', gap:7 }}>
                        <Btn label="💾 Save" onClick={handleAdd}
                          grad="linear-gradient(135deg,#16a34a,#15803d)" disabled={saveLoading}/>
                        <Btn label="✕ Cancel" onClick={cancelAdd} outline/>
                      </div>
                    </td>
                  </tr>
                )}

                {/* empty state */}
                {!loading && !agents.length && !adding && (
                  <tr><td colSpan={4} style={{ textAlign:'center', padding:50, color:'#94a3b8' }}>
                    <div style={{ fontSize:38, marginBottom:10 }}>🧑‍💼</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#64748b' }}>No agents found</div>
                    <div style={{ fontSize:12, marginTop:4 }}>Click "Add New Agent" to create one</div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* footer */}
          <div style={{ padding:'8px 16px', borderTop:'1.5px solid #f5f3ff', flexShrink:0,
            fontSize:11.5, color:'#94a3b8' }}>
            💡 Agent ID 1 is the default agent — tickets are automatically reassigned to this agent when another agent is deleted
          </div>
        </div>
      </div>

      {/* ── DELETE MODAL ── */}
      {deleteTarget && (
        <DeleteModal
          agent={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}