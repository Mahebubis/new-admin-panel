import { useEffect, useMemo, useRef, useState } from 'react';
import { insertTokenAtCursor } from '../campaignMergeTags';
import { label as labelStyle } from './waShared';

/*
 * WhatsApp's own formatting markers. There is no rich text here and there cannot be: the body
 * that reaches Meta is plain text, and WhatsApp renders *bold*, _italic_ and ~strike~ on the
 * handset. So the toolbar wraps the selection in those characters rather than styling anything,
 * which is exactly what the markers are for and keeps what you type identical to what is sent.
 */
const FORMATS = [
  { key: 'b', mark: '*', title: 'Bold',          render: <b>B</b> },
  { key: 'i', mark: '_', title: 'Italic',        render: <i>I</i> },
  { key: 's', mark: '~', title: 'Strikethrough', render: <span style={{ textDecoration: 'line-through' }}>S</span> },
];

/* A short, deliberately boring set. A full emoji keyboard is a component in its own right, and
 * the ones people actually reach for in a campaign are a handful of faces, hands and marks. */
const EMOJI = [
  '😀','😃','😄','😁','😊','🙂','😉','😍','🤩','😎','🤔','🙌','👍','👏','🙏','💪',
  '🎉','🎊','✨','🔥','⭐','🌟','💡','📌','📢','📣','✅','❌','⚠️','❗','❓','⏰',
  '📅','📈','🎯','🏆','🎓','📚','💼','💰','🔔','🚀','❤️','💚','💙','🧡','👉','👇',
];

/** Wraps whatever is selected in the field with `mark` on both sides, or drops an empty pair at
 *  the cursor when nothing is selected and puts the caret between them. */
function wrapSelection(el, mark, value, onChange) {
  if (!el) return;
  const v = value || '';
  const start = el.selectionStart ?? v.length;
  const end = el.selectionEnd ?? start;
  const next = v.slice(0, start) + mark + v.slice(start, end) + mark + v.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const caret = end > start ? end + mark.length * 2 : start + mark.length;
    el.setSelectionRange(caret, caret);
  });
}

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

const POP_ANIM = {
  animation: 'waPop 150ms cubic-bezier(.16,1,.3,1)',
  transformOrigin: 'top right',
};

/* Injected with the popover rather than kept in a stylesheet: it is three lines used by one
   control, and a separate CSS file would be a second place to keep in step for no gain. */
const POP_KEYFRAMES = '@keyframes waPop { from { opacity: 0; transform: translateY(-4px) scale(.97); } '
  + 'to { opacity: 1; transform: none; } }';

export default function WaAttributeField({
  label,
  value,
  onChange,
  placeholder,
  required,
  hint,
  customTags = [],
  showTrackedLink = false,
  multiline = false,
  rows = 4,
  maxLength,
  error,
  /* Shows the *bold* / _italic_ / ~strike~ / emoji toolbar. On by default for a multiline field,
     since that is the message body; a one-line field is a URL or a single variable, where
     formatting markers would be sent to the handset as literal characters. */
  format,
  /* Hands the caller the underlying input/textarea, for a parent that needs to write at the
     cursor itself — the template editor's "Add variable {{n}}" button does exactly that. */
  fieldRef,
  /*
   * Off in the TEMPLATE editor, on everywhere a campaign supplies a value.
   *
   * A template's body and button URL are approved by Meta and then frozen: the send call carries
   * only the template name plus the {{n}} parameters, and Meta renders the stored body itself. So
   * an attribute token typed into a template body is approved as literal text and delivered as
   * literal text — it never resolves. Personalization in WhatsApp has to travel through {{n}},
   * whose values the campaign chooses, which is where this picker belongs.
   */
  showAttributes = true,
  /*
   * Lets the parent decide what "insert this attribute" means.
   *
   * Everywhere a CAMPAIGN supplies a value, the token goes straight into the text and the
   * resolver expands it at send time — that is the default and needs no handler. In the TEMPLATE
   * editor it cannot: Meta approves the body and then renders it itself, so a token there would
   * be delivered as literal text. The editor passes a handler that turns the same click into a
   * {{n}} placeholder plus a recorded default, which is the only shape WhatsApp will personalise.
   */
  onPickAttribute,
}) {
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const showFormat = format === undefined ? multiline : format;

  /*
   * One handler for BOTH popovers, and it listens for Escape as well as an outside click.
   *
   * They were separate before, which is how the emoji panel ended up staying open: each effect
   * only ran while its own flag was true, so the one that was open was not always the one
   * listening. Closing on Escape matters for the same reason a click outside does — the panel
   * covers the field you are typing in.
   */
  useEffect(() => {
    if (!open && !emojiOpen) return;
    const close = () => { setOpen(false); setEmojiOpen(false); setSearch(''); };
    const onDown = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) close(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, emojiOpen]);

  /*
   * ONLY the attributes you created in Audience → Attributes.
   *
   * This used to open with two built-in groups, USER ATTRIBUTES and EXAM ATTRIBUTES, holding the
   * fixed XX_..._XX merge tags. They are gone. Those names duplicated attributes you had already
   * created — FIRST_NAME existed twice, once as XX_USER_FNAME_XX and once as your own mapped
   * attribute — and the two resolve through completely different code, so picking the wrong one
   * silently produced a different value. One list, one source, one resolver.
   */
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = t => !q || t.title.toLowerCase().includes(q) || t.value.toLowerCase().includes(q);
    const out = [];
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
  }, [search, customTags, showTrackedLink]);

  const insert = token => {
    if (onPickAttribute) { onPickAttribute(token, inputRef.current); return; }
    insertTokenAtCursor(inputRef.current, token, value || '', onChange);
  };
  const Field = multiline ? 'textarea' : 'input';

  const fieldStyle = {
    width: '100%', padding: '10px 12px', paddingRight: 108,
    border: `1.5px solid ${error ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 8,
    fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
    ...(multiline ? { paddingRight: 12, resize: 'vertical', lineHeight: 1.5 } : {}),
  };

  /*
   * The WRAPPER is what has to rise, not the popover.
   *
   * Every one of these fields is positioned, so each makes its own stacking context, and within a
   * context a child's z-index counts for nothing against a LATER sibling — the next field's chip
   * painted straight over an open list, which is why options further down could not be clicked.
   * Lifting the whole field while its panel is open puts that field above its neighbours; it
   * drops back afterwards so nothing else has to know about it.
   */
  return (
    <div ref={wrapRef} style={{ position: 'relative', zIndex: (open || emojiOpen) ? 200 : 'auto' }}>
      {label && <label style={labelStyle}>{label}{required && <span style={{ color: '#dc2626' }}> *</span>}</label>}

      <div style={{ position: 'relative' }}>
        <Field
          ref={el => { inputRef.current = el; if (fieldRef) fieldRef.current = el; }}
          value={value || ''}
          rows={multiline ? rows : undefined}
          maxLength={maxLength}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={fieldStyle}
        />
        {/* The chip sits inside single-line fields and just below multiline ones, so it never
            covers the text an admin is typing. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          /*
            The toolbar is the anchor for both popovers, which is why it is positioned even when
            it sits statically under a multiline field. Anchoring them to the FIELD instead opened
            them against the right edge of a full-width textarea, yards from the button that was
            clicked — the panel has to appear under the thing you pressed.
          */
          position: multiline ? 'relative' : 'absolute', right: multiline ? 'auto' : 8, top: multiline ? 'auto' : '50%',
          transform: multiline ? 'none' : 'translateY(-50%)',
          marginTop: multiline ? 6 : 0,
          width: multiline ? 'fit-content' : 'auto',
        }}>
          {showFormat && FORMATS.map(f => (
            <button key={f.key} type="button" title={f.title} onMouseDown={e => e.preventDefault()}
              onClick={() => wrapSelection(inputRef.current, f.mark, value, onChange)}
              style={{
                width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155',
                borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, padding: 0,
              }}>
              {f.render}
            </button>
          ))}
          {showFormat && (
            <button type="button" title="Emoji" onMouseDown={e => e.preventDefault()}
              onClick={() => { setEmojiOpen(o => !o); setOpen(false); }}
              style={{
                width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${emojiOpen ? '#1e3a8a' : '#e2e8f0'}`, background: emojiOpen ? '#eef2ff' : '#f8fafc',
                borderRadius: 6, cursor: 'pointer', fontSize: 13, padding: 0,
              }}>
              🙂
            </button>
          )}
          {showAttributes && <button type="button" onClick={() => { setOpen(o => !o); setEmojiOpen(false); }} onMouseDown={e => e.preventDefault()}
            title="Insert an attribute"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 9px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${open ? '#1e3a8a' : '#e2e8f0'}`, background: open ? '#eef2ff' : '#f8fafc',
              color: open ? '#1e3a8a' : '#64748b', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
            }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            Attribute
          </button>}
          {emojiOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', right: 0, width: 268, zIndex: 91,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
              boxShadow: '0 12px 28px rgba(15,23,42,.16)', padding: 8,
              display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2, ...POP_ANIM,
            }}>
              <style>{POP_KEYFRAMES}</style>
              {EMOJI.map(e => (
                <button key={e} type="button" onMouseDown={ev => ev.preventDefault()}
                  onClick={() => insertTokenAtCursor(inputRef.current, e, value || '', onChange)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: 4, borderRadius: 6 }}
                  onMouseEnter={ev => ev.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                  {e}
                </button>
              ))}
            </div>
          )}
          {open && (
            <div style={{
              position: 'absolute', top: multiline ? 'auto' : 'calc(100% + 4px)', right: 0, width: 260, zIndex: 90,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 12px 28px rgba(15,23,42,.16)', padding: 8, ...POP_ANIM,
            }}>
              <style>{POP_KEYFRAMES}</style>
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
      </div>

      {hint && !error && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{error}</div>}
      {maxLength && (
        <div style={{ textAlign: 'right', fontSize: 10, color: (value || '').length > maxLength * 0.9 ? '#c2410c' : '#cbd5e1', marginTop: 2 }}>
          {(value || '').length}/{maxLength}
        </div>
      )}
    </div>
  );
}
