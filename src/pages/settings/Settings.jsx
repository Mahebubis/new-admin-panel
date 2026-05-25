import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Helmet } from "react-helmet-async";

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/settings/admin_settings.php';
const post = d => fetch(API, { method: 'POST', body: new URLSearchParams(d) }).then(r => r.json());

/* ══════════════════════════════════════
   CONFIG — mirrors PHP $dropdowns array
══════════════════════════════════════ */
const DROPDOWNS = {
  payment_method: ['razorpay', 'cashfree', 'instamojo', 'phonepe', 'hdfc_smartgateway'],
  exam_status: ['on', 'off'],
  disable_current_exam_date: { '0': 'No', '1': 'Yes' },
  enable_netcore: { '0': 'No', '1': 'Yes' },
  enable_intercom: { '0': 'No', '1': 'Yes' },
  instant_exam: ['on', 'off'],
  instant_result: ['on', 'off'],
  enable_autofill: { on: 'On', off: 'Off' },
};
const PROTECTED_FIELDS = ['instant_exam', 'instant_result'];
const PROTECTED_PASSWORD = 'PASSWORD'; // matches PHP const

/* keys exclusive to the Pricing tab */
const PRICING_KEYS = ['price', 'result_page_price'];

/* keys that belong inside the Payment-Paused accordion (hidden from main grid) */
const PAUSED_POPUP_KEYS = [
  'payment_paused_title',
  'payment_paused_subtitle',
  'payment_paused_content',
];
const PAUSED_DEFAULTS = {
  payment_paused_title: 'Payments Temporarily Paused',
  payment_paused_subtitle: "We're working on it",
  payment_paused_content:
    '<p><strong>Due to high demand, internship allocations are currently on hold.</strong></p>'
    + '<p>New refund batches will be released soon.</p>'
    + '<p>We will keep you updated.</p>',
};

/* convert legacy plain-text content into HTML on the fly */
const toHtml = (raw) => {
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw; // already HTML
  return raw
    .split(/\n\s*\n/)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
};

const humanLabel = k =>
  k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/* ─── determine field type ─── */
const getFieldType = (key, value) => {
  if (Object.prototype.hasOwnProperty.call(DROPDOWNS, key)) return 'select';
  if (key.includes('date')) return 'date';
  if (key === 'meta_access_token') return 'password';
  // if (key === 'refund_program') return 'toggle';
  if (['refund_program', 'show_payment_paused_popup'].includes(key))
    return 'toggle';
  if ((value || '').length > 80) return 'textarea';
  if (!isNaN(value) && value !== '') return 'number';
  return 'text';
};

/* ─── shared input style ─── */
const inpS = (focus) => ({
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
  fontFamily: 'inherit', outline: 'none', color: '#1e293b', background: '#fafafe',
  border: `1.5px solid ${focus ? '#4f46e5' : '#e2e8f0'}`,
  transition: 'border .15s, box-shadow .15s',
  boxShadow: focus ? '0 0 0 3px rgba(79,70,229,.08)' : 'none',
});

/* ─── FocusedInput wrapper ─── */
function FocusInput({ type = 'text', value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} style={inpS(focused)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
  );
}

/* ─── password modal ─── */
function PasswordModal({ field, onConfirm, onCancel }) {
  const [pwd, setPwd] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);

  const handleConfirm = () => {
    if (pwd.trim() !== PROTECTED_PASSWORD) { setError(true); return; }
    setError(false);
    onConfirm();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{
        background: '#fff', borderRadius: 16, width: 420, maxWidth: '92vw',
        boxShadow: '0 24px 70px rgba(0,0,0,.2)', overflow: 'hidden'
      }}>
        <div style={{
          background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>🔐 Security Verification</div>
          <button onClick={onCancel} style={{
            background: 'rgba(255,255,255,.2)', border: 'none',
            borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>×</button>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 16 }}>
            You are modifying a protected setting
            (<strong style={{ color: '#1e293b' }}>{humanLabel(field)}</strong>).
            Please authenticate to continue.
          </p>
          <div style={{ position: 'relative' }}>
            <input type={show ? 'text' : 'password'} value={pwd}
              onChange={e => { setPwd(e.target.value); setError(false); }}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              autoFocus placeholder="Enter security password"
              style={{
                ...inpS(false), paddingRight: 40,
                border: `1.5px solid ${error ? '#ef4444' : '#e2e8f0'}`
              }} />
            <button onClick={() => setShow(p => !p)}
              style={{
                position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94a3b8'
              }}>
              {show ? '🙈' : '👁'}
            </button>
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 5 }}>
            Incorrect password. Try again.</div>}
        </div>
        <div style={{ padding: '0 22px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel}
            style={{
              padding: '8px 18px', border: '1.5px solid #e2e8f0', borderRadius: 8,
              background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit'
            }}>Cancel</button>
          <button onClick={handleConfirm}
            style={{
              padding: '8px 22px', border: 'none', borderRadius: 8, fontSize: 12.5,
              fontWeight: 700, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)'
            }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

/* ─── refund toggle confirmation modal ─── */
function RefundModal({ turningOn, onConfirm, onCancel }) {
  const grad = turningOn
    ? 'linear-gradient(135deg,#0d6efd,#198754)'
    : 'linear-gradient(135deg,#f59e0b,#ef4444)';
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{
        background: '#fff', borderRadius: 16, width: 430, maxWidth: '92vw',
        boxShadow: '0 24px 70px rgba(0,0,0,.2)', overflow: 'hidden'
      }}>
        <div style={{
          background: grad, padding: '16px 22px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: 'rgba(255,255,255,.2)', borderRadius: '50%', width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
            }}>
              {turningOn ? '✅' : '🚫'}
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Confirm Change</div>
              <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12 }}>Refund Program Setting</div>
            </div>
          </div>
          <button onClick={onCancel} style={{
            background: 'rgba(255,255,255,.2)', border: 'none',
            borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>×</button>
        </div>
        <div style={{ padding: '22px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 8px' }}>You are about to</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>
            {turningOn ? 'ENABLE the Refund Program' : 'DISABLE the Refund Program'}
          </p>
          <div style={{
            background: '#fff8e1', borderLeft: '4px solid #f59e0b', borderRadius: 8,
            padding: '10px 14px', textAlign: 'left', fontSize: 12.5, color: '#92400e'
          }}>
            {turningOn
              ? 'Enabling this will allow users to apply for refunds.'
              : 'Disabling this will stop users from applying for refunds.'}
          </div>
        </div>
        <div style={{ padding: '0 22px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel}
            style={{
              padding: '8px 18px', border: '1.5px solid #e2e8f0', borderRadius: 8,
              background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit'
            }}>Cancel</button>
          <button onClick={onConfirm}
            style={{
              padding: '8px 22px', border: 'none', borderRadius: 8, fontSize: 12.5,
              fontWeight: 700, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
              background: grad
            }}>Yes, Update</button>
        </div>
      </div>
    </div>
  );
}

/* ─── individual setting field ─── */
function SettingField({ fieldKey, value, onChange, onProtectedChange }) {
  const type = getFieldType(fieldKey, value);
  const [focused, setFocused] = useState(false);

  const selectStyle = {
    width: '100%', padding: '9px 12px', border: `1.5px solid ${focused ? '#4f46e5' : '#e2e8f0'}`,
    borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#1e293b',
    background: '#fafafe', cursor: 'pointer', appearance: 'auto',
    boxShadow: focused ? '0 0 0 3px rgba(79,70,229,.08)' : 'none', transition: 'border .15s',
  };

  if (type === 'select') {
    const opts = DROPDOWNS[fieldKey];
    const isProtected = PROTECTED_FIELDS.includes(fieldKey);
    const entries = Array.isArray(opts)
      ? opts.map(v => ({ v, l: v.charAt(0).toUpperCase() + v.slice(1) }))
      : Object.entries(opts).map(([v, l]) => ({ v, l }));

    return (
      <select value={value}
        onChange={e => isProtected ? onProtectedChange(fieldKey, e.target.value) : onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={selectStyle}>
        {entries.map(({ v, l }) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    );
  }

  if (type === 'date') return (
    <input type="date" value={value ? (() => { try { return new Date(value).toISOString().split('T')[0]; } catch { return value; } })() : ''}
      onChange={e => onChange(e.target.value)} style={inpS(focused)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
  );

  if (type === 'password') return (
    <FocusInput type="password" value={value} onChange={onChange} placeholder="Enter value" />
  );

  if (type === 'toggle') {
    const isOn = value === 'on';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <div onClick={() => onChange('__toggle__')}
          style={{ position: 'relative', width: 54, height: 28, cursor: 'pointer' }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: 14,
            background: isOn ? '#16a34a' : '#d1d5db', transition: 'background .3s'
          }} />
          <div style={{
            position: 'absolute', top: 4, left: isOn ? 30 : 4, width: 20, height: 20,
            borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            transition: 'left .3s'
          }} />
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: isOn ? '#15803d' : '#6b7280'
        }}>{isOn ? 'On' : 'Off'}</span>
      </div>
    );
  }

  if (type === 'textarea') return (
    <textarea value={value} rows={3} onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...inpS(focused), resize: 'vertical', minHeight: 80 }} />
  );

  if (type === 'number') return (
    <FocusInput type="number" value={value} onChange={onChange} />
  );

  return <FocusInput type="text" value={value} onChange={onChange} />;
}

/* ─── Payment Paused popup card (toggle + accordion editor + live preview) ─── */
function PausedPopupCard({ draft, changed, onChange }) {
  const isOn = draft.show_payment_paused_popup === 'on';
  const toggleChanged = changed.has('show_payment_paused_popup');
  const fieldChanged = PAUSED_POPUP_KEYS.some(k => changed.has(k));
  const cardChanged = toggleChanged || (isOn && fieldChanged);

  const title = draft.payment_paused_title ?? '';
  const subtitle = draft.payment_paused_subtitle ?? '';
  const content = draft.payment_paused_content ?? '';

  const [contentFocused, setContentFocused] = useState(false);

  /* ── contentEditable WYSIWYG plumbing ── */
  const editorRef = useRef(null);
  const lastSetRef = useRef(null);

  // Sync external content → editor DOM, but only when not actively typing,
  // so the cursor doesn't jump on every keystroke.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const isFocused = document.activeElement === el;
    const normalized = toHtml(content);
    if (!isFocused && normalized !== lastSetRef.current) {
      el.innerHTML = normalized;
      lastSetRef.current = normalized;
    }
  }, [content, isOn]);

  const exec = (cmd, value = null) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    try { document.execCommand('styleWithCSS', false, true); } catch { /* noop */ }
    document.execCommand(cmd, false, value);
    const html = el.innerHTML;
    lastSetRef.current = html;
    onChange('payment_paused_content', html);
  };

  const handleEditorInput = () => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    lastSetRef.current = html;
    onChange('payment_paused_content', html);
  };

  return (
    <div className={`as-card${cardChanged ? ' changed' : ''}`}
      style={{ gridColumn: '1 / -1' }}>
      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', flex: 1 }}>
          Show Payment Paused Popup
        </label>
        <div style={{ display: 'flex', gap: 5 }}>
          <span style={{
            background: '#ede9fe', color: '#4f46e5', padding: '1px 7px',
            borderRadius: 5, fontSize: 10, fontWeight: 700
          }}>Toggle + Editor</span>
          {cardChanged && (
            <span style={{
              background: '#fef9c3', color: '#854d0e', padding: '1px 7px',
              borderRadius: 5, fontSize: 10, fontWeight: 700
            }}>● Unsaved</span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10, fontFamily: 'monospace' }}>
        show_payment_paused_popup
      </div>

      {/* toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <div onClick={() => onChange('show_payment_paused_popup', '__toggle__')}
          style={{ position: 'relative', width: 54, height: 28, cursor: 'pointer' }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: 14,
            background: isOn ? '#16a34a' : '#d1d5db', transition: 'background .3s'
          }} />
          <div style={{
            position: 'absolute', top: 4, left: isOn ? 30 : 4, width: 20, height: 20,
            borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            transition: 'left .3s'
          }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: isOn ? '#15803d' : '#6b7280' }}>
          {isOn ? 'On — popup is showing to users' : 'Off — popup is hidden'}
        </span>
      </div>

      {/* accordion: only shown when ON */}
      <div style={{
        maxHeight: isOn ? 2000 : 0,
        overflow: 'hidden',
        transition: 'max-height .35s ease',
        marginTop: isOn ? 18 : 0,
      }}>
        <div style={{
          borderTop: '1.5px dashed #ede9fe', paddingTop: 16,
          display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18
        }}>
          {/* ─── left: editor ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569',
                display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
                Title
              </label>
              <FocusInput value={title}
                onChange={v => onChange('payment_paused_title', v)}
                placeholder="Payments Temporarily Paused" />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569',
                display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
                Subtitle
              </label>
              <FocusInput value={subtitle}
                onChange={v => onChange('payment_paused_subtitle', v)}
                placeholder="We're working on it" />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569',
                display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
                Content
              </label>
              <div style={{
                border: `1.5px solid ${contentFocused ? '#4f46e5' : '#e2e8f0'}`,
                borderRadius: 10, background: '#fafafe', overflow: 'hidden',
                boxShadow: contentFocused ? '0 0 0 3px rgba(79,70,229,.08)' : 'none',
                transition: 'border .15s, box-shadow .15s',
              }}>
                <div style={{
                  display: 'flex', gap: 4, padding: '6px 8px',
                  borderBottom: '1px solid #ede9fe', background: '#fff',
                  flexWrap: 'wrap', alignItems: 'center'
                }}>
                  {[
                    { label: 'B', cmd: 'bold', title: 'Bold',
                      btnStyle: { fontWeight: 800 } },
                    { label: 'I', cmd: 'italic', title: 'Italic',
                      btnStyle: { fontStyle: 'italic', fontWeight: 600 } },
                    { label: 'U', cmd: 'underline', title: 'Underline',
                      btnStyle: { textDecoration: 'underline', fontWeight: 600 } },
                  ].map(btn => (
                    <button key={btn.label} type="button" title={btn.title}
                      onMouseDown={e => { e.preventDefault(); exec(btn.cmd); }}
                      style={{
                        width: 30, height: 28, border: '1px solid #e2e8f0',
                        background: '#fff', borderRadius: 6, cursor: 'pointer',
                        fontSize: 12.5, color: '#1e293b', fontFamily: 'inherit',
                        ...btn.btnStyle
                      }}>{btn.label}</button>
                  ))}

                  {/* highlight colour swatches */}
                  <div style={{
                    display: 'flex', gap: 3, alignItems: 'center',
                    marginLeft: 4, paddingLeft: 8, borderLeft: '1px solid #ede9fe'
                  }}>
                    <span style={{ fontSize: 10, color: '#94a3b8', marginRight: 2 }}>
                      Highlight
                    </span>
                    {[
                      { c: '#fef08a', n: 'Yellow' },
                      { c: '#bbf7d0', n: 'Green' },
                      { c: '#fecaca', n: 'Red' },
                      { c: '#bfdbfe', n: 'Blue' },
                      { c: 'transparent', n: 'Clear', border: true },
                    ].map(s => (
                      <button key={s.n} type="button" title={`Highlight: ${s.n}`}
                        onMouseDown={e => {
                          e.preventDefault();
                          // hiliteColor works in most browsers; some fall back to backColor
                          try {
                            document.execCommand('styleWithCSS', false, true);
                          } catch { /* noop */ }
                          editorRef.current?.focus();
                          const ok = document.execCommand('hiliteColor', false, s.c);
                          if (!ok) document.execCommand('backColor', false, s.c);
                          handleEditorInput();
                        }}
                        style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: s.c === 'transparent' ? '#fff' : s.c,
                          border: s.border ? '1.5px dashed #cbd5e1' : '1px solid #e2e8f0',
                          cursor: 'pointer', padding: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, color: '#64748b'
                        }}>{s.border ? '×' : ''}</button>
                    ))}
                  </div>

                  {/* clear formatting */}
                  <button type="button" title="Clear formatting"
                    onMouseDown={e => { e.preventDefault(); exec('removeFormat'); }}
                    style={{
                      marginLeft: 4, height: 28, padding: '0 8px',
                      border: '1px solid #e2e8f0', background: '#fff',
                      borderRadius: 6, cursor: 'pointer', fontSize: 11,
                      color: '#64748b', fontFamily: 'inherit', fontWeight: 600
                    }}>Clear</button>

                  <div style={{ marginLeft: 'auto', alignSelf: 'center',
                    fontSize: 10, color: '#94a3b8' }}>
                    {(editorRef.current?.innerText || '').length} chars
                  </div>
                </div>

                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleEditorInput}
                  onFocus={() => setContentFocused(true)}
                  onBlur={() => setContentFocused(false)}
                  style={{
                    minHeight: 160, padding: '12px 14px', outline: 'none',
                    fontSize: 13.5, lineHeight: 1.6, color: '#1e293b',
                    fontFamily: 'inherit', background: 'transparent'
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                Select text, then click <strong>B</strong> / <em>I</em> / U or a highlight swatch.
              </div>
            </div>
          </div>

          {/* ─── right: live preview ─── */}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569',
              marginBottom: 8, textTransform: 'uppercase', letterSpacing: .4 }}>
              Live Preview
            </div>
            <div style={{
              borderRadius: 14, overflow: 'hidden',
              boxShadow: '0 18px 50px rgba(0,0,0,.12)',
              border: '1px solid #ede9fe', background: '#fff'
            }}>
              {/* orange gradient header */}
              <div style={{
                background: 'linear-gradient(135deg,#f59e0b,#ea580c)',
                padding: '18px 20px', position: 'relative', color: '#fff'
              }}>
                <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>
                  {title || 'Payments Temporarily Paused'}
                </div>
                <div style={{ fontSize: 12, marginTop: 4, opacity: .95 }}>
                  {subtitle || "We're working on it"}
                </div>
                <div style={{
                  position: 'absolute', top: 12, right: 14,
                  width: 22, height: 22, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#fff', fontSize: 18, opacity: .85
                }}>×</div>
              </div>
              {/* body */}
              <div style={{ padding: '18px 20px', color: '#1e293b' }}>
                <div className="paused-preview-body"
                  style={{ fontSize: 13.5, lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{
                    __html: toHtml(content || PAUSED_DEFAULTS.payment_paused_content)
                  }} />
                <button type="button" disabled
                  style={{
                    marginTop: 6, width: '100%', padding: '12px 16px',
                    background: '#0d2137', color: '#fff', border: 'none',
                    borderRadius: 10, fontSize: 14, fontWeight: 700,
                    fontFamily: 'inherit', cursor: 'default'
                  }}>
                  Okay, got it
                </button>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>
              This is how the popup will appear to users.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(new Set());
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('settings');

  /* password modal state */
  const [pwdModal, setPwdModal] = useState(null); // { field, pendingValue }

  /* refund modal state */
  const [refundModal, setRefundModal] = useState(null); // { turningOn }

  /* ── load ── */
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await post({ action: 'get_settings' });
      if (res.success) {
        const merged = { ...res.settings };
        // ensure pricing keys exist in draft so the field always renders
        PRICING_KEYS.forEach(k => { if (merged[k] === undefined) merged[k] = ''; });
        // ensure toggle exists by default
        if (merged.show_payment_paused_popup === undefined) {
          merged.show_payment_paused_popup = 'off';
        }
        // seed paused-popup editable defaults if missing
        PAUSED_POPUP_KEYS.forEach(k => {
          if (merged[k] === undefined || merged[k] === '') {
            merged[k] = PAUSED_DEFAULTS[k];
          }
        });
        setSettings(merged);
        setDraft({ ...merged });
        setChanged(new Set());
      }
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  /* ── field change ── */
  const handleChange = (key, rawValue) => {
    const fieldType = getFieldType(key, draft[key]);

    // Toggle: open refund confirmation
    // if (fieldType === 'toggle' && rawValue === '__toggle__') {
    //   const turningOn = draft[key] !== 'on';
    //   setRefundModal({ turningOn });
    //   return;
    // }


    if (fieldType === 'toggle' && rawValue === '__toggle__') {
      const turningOn = draft[key] !== 'on';

      // Only refund_program needs confirmation modal
      if (key === 'refund_program') {
        setRefundModal({ turningOn });
        return;
      }

      // Other toggles switch instantly
      const newVal = turningOn ? 'on' : 'off';

      setDraft(p => ({ ...p, [key]: newVal }));
      setChanged(p => {
        const s = new Set(p);
        s.add(key);
        return s;
      });

      return;
    }

    setDraft(p => ({ ...p, [key]: rawValue }));
    setChanged(p => { const s = new Set(p); s.add(key); return s; });
  };

  /* ── protected field change: open password modal ── */
  const handleProtectedChange = (field, newValue) => {
    setPwdModal({ field, pendingValue: newValue });
  };

  /* ── password confirmed ── */
  const onPwdConfirm = () => {
    if (!pwdModal) return;
    handleChange(pwdModal.field, pwdModal.pendingValue);
    setPwdModal(null);
  };

  /* ── refund confirmed ── */
  const onRefundConfirm = () => {
    if (!refundModal) return;
    const newVal = refundModal.turningOn ? 'on' : 'off';
    setDraft(p => ({ ...p, refund_program: newVal }));
    setChanged(p => { const s = new Set(p); s.add('refund_program'); return s; });
    setRefundModal(null);
  };

  /* ── save all ── */
  const handleSave = async () => {
    if (changed.size === 0) return;
    setSaving(true);
    try {
      // send ONLY the keys the user actually edited
      const payload = {};
      changed.forEach(k => { payload[k] = draft[k]; });

      const res = await post({
        action: 'update_settings',
        settings_json: JSON.stringify(payload),
      });
      if (res.success) {
        toast.success(res.message);
        setSettings(p => ({ ...p, ...payload }));
        setChanged(new Set());
      } else toast.error(res.message || 'Failed to save');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  /* ── reset ── */
  const handleReset = () => {
    setDraft({ ...settings });
    setChanged(new Set());
    toast('Changes reset', { icon: '↩️' });
  };

  /* ── filtered keys (per active tab + search) ── */
  // const keys = Object.keys(draft)
  //   .filter(k => activeTab === 'pricing' ? PRICING_KEYS.includes(k) : !PRICING_KEYS.includes(k))
  //   .filter(k =>
  //     !search.trim() || k.toLowerCase().includes(search.toLowerCase()) ||
  //     humanLabel(k).toLowerCase().includes(search.toLowerCase())
  //   );

  let keys = Object.keys(draft)
    .filter(k => activeTab === 'pricing'
      ? PRICING_KEYS.includes(k)
      : !PRICING_KEYS.includes(k))
    // hide paused-popup sub-fields: they are edited inside the toggle's accordion
    .filter(k => !PAUSED_POPUP_KEYS.includes(k))
    .filter(k =>
      !search.trim() ||
      k.toLowerCase().includes(search.toLowerCase()) ||
      humanLabel(k).toLowerCase().includes(search.toLowerCase())
    );

  // place new toggle after refund_program
  const refundIndex = keys.indexOf('refund_program');

  if (
    refundIndex !== -1 &&
    keys.includes('show_payment_paused_popup')
  ) {
    keys = keys.filter(k => k !== 'show_payment_paused_popup');

    keys.splice(
      refundIndex + 1,
      0,
      'show_payment_paused_popup'
    );
  }

  if (loading) return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: 'calc(100vh - 62px)', background: '#f5f3ff',
      fontFamily: 'Plus Jakarta Sans,sans-serif'
    }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <div style={{
          width: 36, height: 36, border: '3px solid #ede9fe', borderTopColor: '#4f46e5',
          borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px'
        }} />
        <div style={{ fontSize: 13 }}>Loading settings...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>Settings | Admin Panel</title>
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .as-root * { box-sizing:border-box; font-family:'Plus Jakarta Sans',sans-serif; }
        .as-card { background:#fff; border-radius:12px; border:1.5px solid #ede9fe;
          padding:16px 18px; box-shadow:0 1px 5px rgba(79,70,229,.06); transition:border .2s; }
        .as-card:hover { border-color:#c4b5fd; }
        .as-card.changed { border-color:#f59e0b; background:#fffbeb; }
        .as-inp:focus { border-color:#4f46e5!important; box-shadow:0 0 0 3px rgba(79,70,229,.1)!important; }
        @keyframes as_spin { to { transform:rotate(360deg); } }
        .as-spin { display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:as_spin .7s linear infinite; }
        /* paused-popup editor + preview content */
        .as-root [contenteditable] p, .paused-preview-body p { margin: 0 0 8px; }
        .as-root [contenteditable] p:last-child, .paused-preview-body p:last-child { margin-bottom: 0; }
        .as-root [contenteditable] strong, .paused-preview-body strong { font-weight: 700; }
        .as-root [contenteditable] em, .paused-preview-body em { font-style: italic; }
        .as-root [contenteditable] span[style*="background"],
        .paused-preview-body span[style*="background"] {
          padding: 1px 4px; border-radius: 4px;
        }
        .as-root [contenteditable]:empty:before {
          content: 'Type the popup content here…';
          color: #94a3b8;
        }
      `}</style>

      <div className="as-root" style={{
        display: 'flex', flexDirection: 'column',
        minHeight: 'calc(100vh - 62px)', background: '#f5f3ff', overflowY: 'auto'
      }}>

        {/* ── HEADER ── */}
        <div style={{
          background: 'linear-gradient(135deg,#0d2137,#2d1b69)', color: '#fff',
          padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12, flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>⚙️ Admin Settings</div>
            <div style={{ fontSize: 12, opacity: .65, marginTop: 2 }}>
              {keys.length} settings · {changed.size > 0
                ? <span style={{ color: '#fbbf24', fontWeight: 600 }}>{changed.size} unsaved change{changed.size > 1 ? 's' : ''}</span>
                : 'All saved'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* search */}
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,.5)', fontSize: 14
              }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search settings..."
                style={{
                  padding: '7px 12px 7px 32px', border: '1.5px solid rgba(255,255,255,.2)',
                  borderRadius: 8, background: 'rgba(255,255,255,.1)', color: '#fff',
                  fontSize: 12.5, fontFamily: 'inherit', outline: 'none', width: 200
                }} />
            </div>
            {changed.size > 0 && (
              <button onClick={handleReset}
                style={{
                  padding: '8px 16px', border: '1.5px solid rgba(255,255,255,.3)',
                  borderRadius: 8, background: 'rgba(255,255,255,.1)', color: '#fff',
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                }}>
                ↩️ Reset
              </button>
            )}
            <button onClick={handleSave} disabled={saving || changed.size === 0}
              style={{
                padding: '9px 22px', border: 'none', borderRadius: 8, fontSize: 13,
                fontWeight: 700, cursor: (saving || changed.size === 0) ? 'not-allowed' : 'pointer',
                color: '#fff', fontFamily: 'inherit',
                background: 'linear-gradient(135deg,#16a34a,#15803d)',
                opacity: (saving || changed.size === 0) ? .6 : 1,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
              {saving ? <><span className="as-spin" /> Saving...</> : '💾 Update Settings'}
            </button>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{
          background: '#fff', borderBottom: '1.5px solid #ede9fe',
          padding: '0 24px', display: 'flex', gap: 4, flexShrink: 0
        }}>
          {[
            { id: 'settings', label: 'Settings', icon: '⚙️' },
            { id: 'pricing', label: 'Pricing', icon: '💰' },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            const tabChanges = Object.keys(draft).filter(k => {
              const inPricing = PRICING_KEYS.includes(k);
              return tab.id === 'pricing' ? inPricing && changed.has(k) : !inPricing && changed.has(k);
            }).length;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 20px', border: 'none', background: 'none',
                  borderBottom: `3px solid ${isActive ? '#4f46e5' : 'transparent'}`,
                  color: isActive ? '#4f46e5' : '#64748b',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 7, transition: 'color .15s, border .15s'
                }}>
                <span>{tab.icon}</span>{tab.label}
                {tabChanges > 0 && (
                  <span style={{
                    background: '#fef9c3', color: '#854d0e', padding: '1px 7px',
                    borderRadius: 10, fontSize: 10, fontWeight: 700
                  }}>{tabChanges}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── CHANGED BANNER ── */}
        {changed.size > 0 && (
          <div style={{
            background: '#fef9c3', borderBottom: '1.5px solid #fde68a',
            padding: '9px 24px', fontSize: 12.5, color: '#854d0e', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0
          }}>
            ⚠️ You have {changed.size} unsaved change{changed.size > 1 ? 's' : ''}. Click "Update Settings" to save.
          </div>
        )}

        {/* ── SETTINGS GRID ── */}
        <div style={{ padding: '20px 24px', flex: 1 }}>
          {keys.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>No settings match "{search}"</div>
            </div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(400px,1fr))',
              gap: 14
            }}>
              {keys.map(key => {
                // special-case: paused popup gets its own card with accordion editor
                if (key === 'show_payment_paused_popup') {
                  return (
                    <PausedPopupCard
                      key={key}
                      draft={draft}
                      changed={changed}
                      onChange={handleChange}
                    />
                  );
                }
                const isChanged = changed.has(key);
                const isProtected = PROTECTED_FIELDS.includes(key);
                const type = getFieldType(key, draft[key]);
                return (
                  <div key={key} className={`as-card${isChanged ? ' changed' : ''}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                      {/* field label */}
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', flex: 1 }}>
                        {humanLabel(key)}
                      </label>
                      {/* badges */}
                      <div style={{ display: 'flex', gap: 5 }}>
                        {isProtected && (
                          <span style={{
                            background: '#fef3c7', color: '#92400e', padding: '1px 7px',
                            borderRadius: 5, fontSize: 10, fontWeight: 700
                          }}>🔒 Protected</span>
                        )}
                        {type === 'toggle' && (
                          <span style={{
                            background: '#ede9fe', color: '#4f46e5', padding: '1px 7px',
                            borderRadius: 5, fontSize: 10, fontWeight: 700
                          }}>Toggle</span>
                        )}
                        {isChanged && (
                          <span style={{
                            background: '#fef9c3', color: '#854d0e', padding: '1px 7px',
                            borderRadius: 5, fontSize: 10, fontWeight: 700
                          }}>● Unsaved</span>
                        )}
                      </div>
                    </div>
                    {/* key name hint */}
                    <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, fontFamily: 'monospace' }}>
                      {key}
                    </div>
                    {/* field */}
                    <SettingField
                      fieldKey={key}
                      value={draft[key] ?? ''}
                      onChange={v => handleChange(key, v)}
                      onProtectedChange={handleProtectedChange}
                    />
                    {/* show original value if changed */}
                    {isChanged && settings[key] !== undefined && (
                      <div style={{
                        fontSize: 11, color: '#94a3b8', marginTop: 5,
                        display: 'flex', alignItems: 'center', gap: 5
                      }}>
                        <span>was:</span>
                        <code style={{
                          background: '#f5f3ff', padding: '1px 6px', borderRadius: 4,
                          color: '#6b7280', maxWidth: 200, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block'
                        }}>
                          {settings[key]}
                        </code>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* save button at bottom */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            {changed.size > 0 && (
              <button onClick={handleReset}
                style={{
                  padding: '10px 22px', border: '1.5px solid #e2e8f0', borderRadius: 9,
                  background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit'
                }}>↩️ Reset Changes</button>
            )}
            <button onClick={handleSave} disabled={saving || changed.size === 0}
              style={{
                padding: '10px 32px', border: 'none', borderRadius: 9, fontSize: 13,
                fontWeight: 700, cursor: (saving || changed.size === 0) ? 'not-allowed' : 'pointer',
                color: '#fff', fontFamily: 'inherit',
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                opacity: (saving || changed.size === 0) ? .6 : 1,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
              {saving ? <><span className="as-spin" style={{ borderTopColor: '#fff' }} /> Saving...</> : '💾 Update Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {pwdModal && (
        <PasswordModal
          field={pwdModal.field}
          onConfirm={onPwdConfirm}
          onCancel={() => {
            // revert draft to previous value (same as PHP restoring select.value)
            setDraft(p => ({ ...p, [pwdModal.field]: settings[pwdModal.field] }));
            setPwdModal(null);
          }} />
      )}
      {refundModal && (
        <RefundModal
          turningOn={refundModal.turningOn}
          onConfirm={onRefundConfirm}
          onCancel={() => setRefundModal(null)} />
      )}
    </>
  );
}