import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/communication/email_templates.php';
const FH = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const mk = obj => new URLSearchParams(obj);
const TINYMCE_KEY = 'tu5ku73xv371s5rnnw4erypaxn3nj9evagsamldjp6z41w3b'; // same key as PHP

/* ── merge tags — exact same list as PHP ── */
const MERGE_TAGS = [
  { value: 'XX_USER_FNAME_XX', title: 'First Name' },
  { value: 'XX_USER_LNAME_XX', title: 'Last Name' },
  { value: 'XX_USER_NAME_XX', title: 'Full Name' },
  { value: 'XX_USER_EMAIL_XX', title: 'Email' },
  { value: 'XX_USER_PHONE_XX', title: 'Phone' },
  { value: 'XX_SETTINGS_TITLE_XX', title: 'Website Title' },
  { value: 'XX_SETTINGS_EMAIL_XX', title: 'Website Email' },
  { value: 'XX_SETTINGS_EXAM_DATE_XX', title: 'Exam Date' },
  { value: 'XX_SETTINGS_RESULT_DATE_XX', title: 'Result Date' },
  { value: 'XX_SETTINGS_WA_CIT_COMMUNITY_XX', title: 'WhatsApp CIT Community' },
  { value: 'XX_SETTINGS_RESULT_CERTIFICATE_DATE_XX', title: 'Result Certificate Date' },
  { value: 'XX_ADMIN_MESSAGE_RESPONSE_XX', title: 'Admin Response' },
  { value: 'XX_TICKET_ID_XX', title: 'Ticket ID' },
  { value: 'XX_TICKET_SUBJECT_XX', title: 'Ticket Subject' },
  { value: 'XX_INTERNSHIP_NAME_XX', title: 'Internship Name' },
  { value: 'XX_INTERNSHIP_BATCH_XX', title: 'Internship Batch' },
  { value: 'XX_SUBMISSION_REJECTION_REASON_XX', title: 'Submission Rejection Reason' },
  { value: 'XX_USER_REG_EXAM_DATE_XX', title: 'Registration Exam Dates Format' },
  { value: 'XX_USER_REG_RESULT_DATE_XX', title: 'Registration Result Date Format' },
];

/* ── TinyMCE init — same config as PHP ── */
function initTinyMCE(selector, initialContent, onInit) {
  if (!window.tinymce) return;
  // Remove existing instance
  if (window.tinymce.get(selector.replace('#', ''))) {
    window.tinymce.get(selector.replace('#', '')).remove();
  }
  window.tinymce.init({
    selector,
    plugins: 'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount mergetags',
    toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table mergetags | align lineheight | numlist bullist indent outdent | emoticons charmap | removeformat',
    mergetags_list: MERGE_TAGS,
    height: 400,
    branding: false,
    setup: (editor) => {
      editor.on('init', () => {
        if (initialContent) editor.setContent(initialContent);
        onInit(editor);
      });
    },
  });
}

/* ── shared input style ── */
const inp = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
};
const thS = {
  color: '#fff', fontSize: 11, fontWeight: 600, padding: '11px 12px',
  textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px',
  borderRight: '1px solid rgba(255,255,255,.15)', whiteSpace: 'nowrap',
};
const tdS = { padding: '9px 12px', borderBottom: '1px solid #f5f3ff', color: '#334155', fontSize: 12, verticalAlign: 'middle' };

/* ── Modal ── */
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 860,
        maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)'
      }}>
        <div style={{
          padding: '14px 20px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 5
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.2)', border: 'none',
            borderRadius: 6, width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 18
          }}>×</button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <label style={{
    display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5
  }}>{children}</label>;
}

/* ── Test Email Modal ── */
function TestEmailModal({ onSend, onClose }) {
  const [email, setEmail] = useState('');
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden'
      }}>
        <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg,#0891b2,#0e7490)' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>📧 Send Test Email</span>
        </div>
        <div style={{ padding: 22 }}>
          <Label>Email Address</Label>
          <input style={inp} type="email" value={email} autoFocus
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && email && onSend(email)}
            placeholder="Enter email to send test to" />
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16,
            borderTop: '1.5px solid #f1f5f9', paddingTop: 14
          }}>
            <button onClick={onClose}
              style={{
                padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#f8fafc',
                color: '#475569', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
              }}>Cancel</button>
            <button onClick={() => email && onSend(email)}
              style={{
                padding: '9px 22px', border: 'none', borderRadius: 8, fontSize: 12.5,
                fontWeight: 700, cursor: 'pointer', color: '#fff',
                background: 'linear-gradient(135deg,#0891b2,#0e7490)'
              }}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
export default function EmailTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [testModal, setTestModal] = useState(null); // template id
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ email_title: '', email_subject: '', email_body: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const editorRef = useRef(null);

  /* ── fetch all templates ── */
  const fetchAll = () => {
    setLoading(true);
    api.get(API)
      .then(res => { if (res.data.status === 'success') setTemplates(res.data.templates || []); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  /* ── load TinyMCE script ── */
  const loadTinyMCE = (selector, content) => {
    const doInit = () => initTinyMCE(selector, content, e => { editorRef.current = e; });

    if (window.tinymce) { setTimeout(doInit, 80); return; }

    if (!document.getElementById('tinymce-script')) {
      const s = document.createElement('script');
      s.id = 'tinymce-script';
      s.src = `https://cdn.tiny.cloud/1/${TINYMCE_KEY}/tinymce/6/tinymce.min.js`;
      s.referrerPolicy = 'origin';
      s.onload = () => setTimeout(doInit, 80);
      document.head.appendChild(s);
    } else {
      const wait = setInterval(() => { if (window.tinymce) { clearInterval(wait); setTimeout(doInit, 80); } }, 100);
    }
  };

  /* ── open add ── */
  const openAdd = () => {
    editorRef.current = null;
    setEditItem(null);
    setForm({ email_title: '', email_subject: '', email_body: '' });
    setModal('add');
    setTimeout(() => loadTinyMCE('#et-editor', ''), 100);
  };

  /* ── open edit ── */
  const openEdit = (t) => {
    editorRef.current = null;
    setEditItem(t);
    setForm({ email_title: t.title || '', email_subject: t.subject || '', email_body: t.message || '' });
    setModal('edit');
    // sanitize same as PHP's sanitizeMessage()
    const body = (t.message || '').replace(/\\r\\n/g, '').replace(/\\/g, '');
    setTimeout(() => loadTinyMCE('#et-editor', body), 100);
  };

  /* ── save (create or update) — same as PHP handlers ── */
  const handleSave = async () => {
    const email_body = editorRef.current?.getContent() || '';
    if (!form.email_title.trim() || !form.email_subject.trim() || !email_body.trim()) {
      toast.error('Please fill all the fields'); return;
    }
    setSaving(true);
    try {
      const action = modal === 'edit' ? 'update_email_template' : 'create_email_template';
      const payload = { action, email_title: form.email_title, email_subject: form.email_subject, email_body };
      if (modal === 'edit') payload.id = editItem.id;

      const res = await api.post(API, mk(payload), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message); setModal(null); fetchAll();
      } else { toast.error(res.data.message || 'Failed'); }
    } catch { toast.error('Server error'); }
    finally { setSaving(false); }
  };

  /* ── send test email — same as PHP sendTemplateEmail($id, $email) ── */
  const handleSendTest = async (email) => {
    setTesting(true);
    try {
      const res = await api.post(API, mk({ action: 'send_test_email', id: testModal, email }), FH);
      if (res.data.status === 'success') {
        toast.success(res.data.message); setTestModal(null);
      } else { toast.error(res.data.message || 'Failed'); }
    } catch { toast.error('Error'); }
    finally { setTesting(false); }
  };

  /* ── strip HTML for preview — same as PHP's substr(htmlentities($row['message']), 0, 100) ── */
  const previewBody = (html) => {
    const d = document.createElement('div'); d.innerHTML = html;
    const text = (d.textContent || d.innerText || '').trim();
    return text.slice(0, 100) + (text.length > 100 ? '…' : '');
  };

  /* ════════ RENDER ════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .et-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .et-tr:hover td{background:#faf9ff!important;}
        .et-inp:focus{border-color:#4f46e5!important;box-shadow:0 0 0 3px rgba(79,70,229,.08)!important;}
        @keyframes et_spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="et-root" style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 62px)',
        padding: 20, gap: 14, overflow: 'hidden', background: '#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>📧 Admin Email Templates</div>
          <button onClick={openAdd}
            style={{
              padding: '9px 20px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer'
            }}>
            + Add New Template
          </button>
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{
          flex: 1, minHeight: 0, background: '#fff', borderRadius: 12,
          border: '1.5px solid #ede9fe', boxShadow: '0 1px 8px rgba(79,70,229,.05)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {['Template Title', 'Template Subject', 'Template Body', 'Action'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{
                      display: 'inline-block', width: 28, height: 28, border: '3px solid #ede9fe',
                      borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'et_spin .7s linear infinite'
                    }} />
                  </td></tr>
                ) : templates.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>
                    No templates found
                  </td></tr>
                ) : templates.map(t => (
                  <tr key={t.id} className="et-tr">
                    <td style={{ ...tdS, fontWeight: 600, color: '#1e293b', minWidth: 180 }}>{t.title}</td>
                    <td style={{
                      ...tdS, minWidth: 200, maxWidth: 280, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>{t.subject}</td>
                    {/* body preview — same as PHP's substr(htmlentities($row['message']),0,100) */}
                    <td style={{
                      ...tdS, color: '#64748b', maxWidth: 320,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {previewBody(t.message)}
                    </td>
                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                      {/* Edit — same as PHP's handleEditEmail */}
                      <button onClick={() => openEdit(t)}
                        style={{
                          padding: '5px 12px', background: '#fef9c3', color: '#b45309',
                          border: '1.5px solid #fde68a', borderRadius: 6, fontSize: 11,
                          fontWeight: 600, cursor: 'pointer', marginRight: 6
                        }}>✏️ Edit</button>
                      {/* Test Email — same as PHP's sendTestEmail */}
                      <button onClick={() => setTestModal(t.id)}
                        style={{
                          padding: '5px 12px', background: '#e0f2fe', color: '#0369a1',
                          border: '1.5px solid #bae6fd', borderRadius: 6, fontSize: 11,
                          fontWeight: 600, cursor: 'pointer'
                        }}>📤 Test Email</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* footer */}
          {!loading && templates.length > 0 && (
            <div style={{
              flexShrink: 0, padding: '7px 16px', borderTop: '1px solid #f5f3ff',
              background: '#fafafa', fontSize: 11.5, color: '#64748b', fontWeight: 600
            }}>
              Total: <strong style={{ color: '#4f46e5' }}>{templates.length}</strong> templates
            </div>
          )}
        </div>
      </div>

      {/* ══════ ADD / EDIT MODAL ══════ */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'edit' ? `✏️ Edit Template — ${editItem?.title}` : '➕ Add New Template'}
          onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
              <div>
                <Label>Email Title *</Label>
                <input className="et-inp" style={inp} value={form.email_title}
                  onChange={e => setForm(p => ({ ...p, email_title: e.target.value }))}
                  placeholder="e.g. Welcome Email" />
              </div>
              <div>
                <Label>Email Subject *</Label>
                <input className="et-inp" style={inp} value={form.email_subject}
                  onChange={e => setForm(p => ({ ...p, email_subject: e.target.value }))}
                  placeholder="e.g. Welcome to Internship Studio!" />
              </div>
            </div>

            <div>
              <Label>Email Body *
                <span style={{ textTransform: 'none', fontSize: 10, color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>
                  (Use merge tags for dynamic content)
                </span>
              </Label>
              {/* TinyMCE textarea — same editor config as PHP */}
              <textarea id="et-editor"
                style={{ width: '100%', height: 0, visibility: 'hidden', margin: 0, padding: 0 }} />
            </div>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            marginTop: 18, borderTop: '1.5px solid #f1f5f9', paddingTop: 14, position: 'sticky', bottom: 0, background: '#fff'
          }}>
            <button onClick={() => setModal(null)}
              style={{
                padding: '9px 18px', border: '1.5px solid #e2e8f0', background: '#f8fafc',
                color: '#475569', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
              }}>Close</button>
            <button onClick={handleSave} disabled={saving}
              style={{
                padding: '9px 24px', border: 'none', borderRadius: 8, fontSize: 12.5,
                fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1,
                color: '#fff', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)'
              }}>
              {saving ? 'Saving...' : modal === 'edit' ? '💾 Update' : '💾 Create'}
            </button>
          </div>
        </Modal>
      )}

      {/* ══════ TEST EMAIL MODAL ══════ */}
      {testModal && (
        <TestEmailModal
          onSend={handleSendTest}
          onCancel={() => setTestModal(null)}
          onClose={() => setTestModal(null)}
        />
      )}
    </>
  );
}