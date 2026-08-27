import { useEffect, useMemo, useRef, useState } from 'react';
import { insertTokenAtCursor, IDENTITY_MERGE_TAGS, EXAM_MERGE_TAGS } from '../campaignMergeTags';
import { label as labelStyle } from './waShared';

/*
 * A text field with a personalization-attribute picker — the control behind every template
 * variable, the free-text message body, and the dynamic button suffix.
 *
 * Mirrors Netcore's own "User attribute" affordance from the WhatsApp campaign builder: a
 * chip inside the field opens a searchable, grouped list, and choosing an entry splices its
 * token in at the cursor rather than replacing what's already typed — so a variable can be
 * "Hi XX_USER_FNAME_XX, your [BATCH] starts soon" rather than a single attribute.
 *
 * Server-side substitution for every token offered here already exists and is shared with the
 * email builder: campaigns/lib/MergeTags.php (XX_..._XX) and AttributeResolver.php ([NAME]).
 */
/*
 * The tracked link — the ONLY token that makes a WhatsApp click identifiable.
 *
 * ── Why this is not just another attribute ──────────────────────────────────
 * A WhatsApp template's BUTTON url is frozen at approval and is byte-identical in every copy
 * of the message ever sent, because Meta refuses to approve a button whose URL carries a
 * variable. So a button tap physically cannot say who tapped it: the landing page sees a
 * stranger, and the click is recorded as an anonymous visitor.
 *
 * Meta itself never reports URL-button clicks either — the Cloud API sends sent / delivered /
 * read / failed and nothing else. There is no webhook to turn on. Identifying a click can
 * therefore only happen on OUR landing page, which means the identity has to be IN the link.
 *
 * A body variable can carry it. Body text is free-form, WhatsApp auto-links whatever arrives,
 * and the server expands this token into the recipient's own URL:
 *
 *     https://dashboard.internshipstudio.com/login?campaign_id=…&medium=whatsapp
 *         &phone=919…&goal=…&attr_window=2&wa_rid=<this message's id>
 *
 * phone and wa_rid are the identity. The landing page reads them with no session at all, which
 * is exactly the "identified click without login" case — see wa_render_for_recipient().
 */
const TRACKED_LINK_TAGS = [
  {
    title: 'Tracked link (identifies the click)',
    value: 'https://dashboard.internshipstudio.com/login?XX_WA_ATTR_XX',
    hint: 'Put this in a body variable. Each recipient gets their own link carrying their phone '
        + 'and this message id, so a tap is credited to them even if they never sign in.',
  },
  {
    title: 'Tracked link — attribution only',
    value: 'XX_WA_ATTR_XX',
    hint: 'Just the query string, for appending to a URL you have typed yourself.',
  },
];

export default function WaAttributeField({
  label,
  value,
  onChange,
  placeholder,
  required,
  hint,
  customTags = [],
  showExamTags = false,
  showTrackedLink = false,
  multiline = false,
  rows = 4,
  maxLength,
  error,
}) {
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = t => !q || t.title.toLowerCase().includes(q) || t.value.toLowerCase().includes(q);
    const out = [];
    const identity = IDENTITY_MERGE_TAGS.filter(match);
    if (identity.length) out.push({ title: 'USER ATTRIBUTES', tags: identity });
    if (showExamTags) {
      const exam = EXAM_MERGE_TAGS.filter(match);
      if (exam.length) out.push({ title: 'EXAM ATTRIBUTES', tags: exam });
    }
    const custom = customTags.filter(match);
    if (custom.length) out.push({ title: `YOUR ATTRIBUTES (${customTags.length})`, tags: custom });
    /* Last, and only where a link is useful. It is the longest entry in the list and belongs
       under the attributes somebody is actually looking for — but it is also the only way to
       identify a WhatsApp click, so it must be findable rather than folklore. */
    if (showTrackedLink) {
      const tracked = TRACKED_LINK_TAGS.filter(match);
      if (tracked.length) out.push({ title: 'TRACKED LINK', tags: tracked });
    }
    return out;
  }, [search, customTags, showExamTags, showTrackedLink]);

  const insert = token => insertTokenAtCursor(inputRef.current, token, value || '', onChange);
  const Field = multiline ? 'textarea' : 'input';

  const fieldStyle = {
    width: '100%', padding: '10px 12px', paddingRight: 108,
    border: `1.5px solid ${error ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 8,
    fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
    ...(multiline ? { paddingRight: 12, resize: 'vertical', lineHeight: 1.5 } : {}),
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {label && <label style={labelStyle}>{label}{required && <span style={{ color: '#dc2626' }}> *</span>}</label>}

      <div style={{ position: 'relative' }}>
        <Field
          ref={inputRef}
          value={value || ''}
          rows={multiline ? rows : undefined}
          maxLength={maxLength}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={fieldStyle}
        />
        {/* The chip sits inside single-line fields and just below multiline ones, so it never
            covers the text an admin is typing. */}
        <button type="button" onClick={() => setOpen(o => !o)} onMouseDown={e => e.preventDefault()}
          style={{
            position: multiline ? 'static' : 'absolute', right: 8, top: '50%',
            transform: multiline ? 'none' : 'translateY(-50%)',
            marginTop: multiline ? 6 : 0,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 9px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid ${open ? '#1e3a8a' : '#e2e8f0'}`, background: open ? '#eef2ff' : '#f8fafc',
            color: open ? '#1e3a8a' : '#64748b', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
          }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          Attribute
        </button>
      </div>

      {hint && !error && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{error}</div>}
      {maxLength && (
        <div style={{ textAlign: 'right', fontSize: 10, color: (value || '').length > maxLength * 0.9 ? '#c2410c' : '#cbd5e1', marginTop: 2 }}>
          {(value || '').length}/{maxLength}
        </div>
      )}

      {open && (
        <div style={{
          position: 'absolute', top: multiline ? 'auto' : 'calc(100% + 4px)', right: 0, width: 260, zIndex: 90,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 12px 28px rgba(15,23,42,.16)', padding: 8,
        }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search attributes…"
            style={{ width: '100%', padding: '7px 9px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, marginBottom: 6, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />

          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {groups.length === 0 && (
              <div style={{ padding: '10px 4px', fontSize: 11.5, color: '#94a3b8', textAlign: 'center' }}>No matching attributes</div>
            )}
            {groups.map(g => (
              <div key={g.title}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#1e3a8a', letterSpacing: '.5px', padding: '6px 4px 4px' }}>{g.title}</div>
                {g.tags.map(t => (
                  <button key={t.value} type="button" onMouseDown={e => e.preventDefault()} onClick={() => insert(t.value)}
                    style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 9px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#334155', borderRadius: 6, fontFamily: 'inherit', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    <span style={{ fontSize: 9.5, color: '#94a3b8', flexShrink: 0 }}>+ Insert</span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 4, paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>Resolved per contact at send time</span>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setOpen(false); setSearch(''); }}
              style={{ border: 'none', background: 'none', color: '#1e3a8a', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', padding: '4px 6px' }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
