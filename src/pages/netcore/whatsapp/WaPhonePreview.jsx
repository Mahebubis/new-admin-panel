import { WA } from './waShared';

/*
 * A true-to-life WhatsApp message preview.
 *
 * This is not decoration: a template's real appearance (bold *markup*, where the footer sits,
 * how buttons stack under the bubble) is the only way an admin can tell whether the copy they
 * approved with Meta reads correctly before it goes to thousands of people. It renders from
 * exactly the same fields the send path uses, with {{n}} placeholders filled by the same
 * ordered values, so what is shown here is what will be sent.
 */

/** WhatsApp's lightweight formatting: *bold*, _italic_, ~strike~, ```mono```. */
function renderWhatsAppMarkup(text) {
  const src = String(text ?? '');
  const nodes = [];
  // One pass over the whole string, emitting plain runs and formatted runs in order — a
  // sequence of independent replaces would nest incorrectly and mangle overlapping markers.
  const re = /(\*[^*\n]+\*)|(_[^_\n]+_)|(~[^~\n]+~)|(```[^`]+```)/g;
  let last = 0, m;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) nodes.push(src.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('```')) nodes.push(<code key={m.index} style={{ fontFamily: 'monospace', fontSize: '.92em' }}>{tok.slice(3, -3)}</code>);
    else if (tok.startsWith('*')) nodes.push(<b key={m.index}>{tok.slice(1, -1)}</b>);
    else if (tok.startsWith('_')) nodes.push(<i key={m.index}>{tok.slice(1, -1)}</i>);
    else nodes.push(<s key={m.index}>{tok.slice(1, -1)}</s>);
    last = m.index + tok.length;
  }
  if (last < src.length) nodes.push(src.slice(last));
  return nodes;
}

/** Substitutes {{1}}, {{2}} … — mirrors wa_fill_placeholders() in WhatsAppTransport.php. */
function fillPlaceholders(text, values = []) {
  return String(text ?? '').replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => {
    const v = values[Number(n) - 1];
    // An unfilled variable stays visible as its own placeholder rather than collapsing to an
    // empty gap — a preview that hides a missing value is worse than one that shows it.
    return (v === undefined || v === null || v === '') ? `{{${n}}}` : v;
  });
}

const BtnIcon = ({ type }) => {
  if (type === 'url') return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6M10 14 21 3" /></svg>;
  if (type === 'phone') return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M9 17l-5-5 5-5" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>;
};

/**
 * @param businessName  the WABA display name shown in the chat header
 * @param headerType    none | text | image | video | document
 * @param headerText    may contain {{n}}
 * @param headerValues  ordered values for the header's placeholders
 * @param bodyText      may contain {{n}}
 * @param bodyValues    ordered values for the body's placeholders
 * @param buttons       [{ type, text, url, dynamic }]
 * @param plainText     when set, renders as a free-text message instead of a template
 */
export default function WaPhonePreview({
  businessName = 'Internship Studio',
  headerType = 'none',
  headerText = '',
  headerValues = [],
  bodyText = '',
  bodyValues = [],
  footerText = '',
  buttons = [],
  plainText = null,
  height = 480,
  emptyHint = 'Select a template to preview it here',
}) {
  const body = plainText !== null ? plainText : fillPlaceholders(bodyText, bodyValues);
  const header = headerType === 'text' ? fillPlaceholders(headerText, headerValues) : '';
  const isEmpty = !String(body || '').trim();
  const now = new Date();
  const clock = `${String(now.getHours() % 12 || 12).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div style={{
      border: '10px solid #1e293b', borderRadius: 30, overflow: 'hidden', height,
      display: 'flex', flexDirection: 'column', background: WA.chat, boxShadow: '0 10px 30px rgba(15,23,42,.18)',
    }}>
      {/* chat header */}
      <div style={{ background: WA.greenInk, color: '#fff', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="m15 18-6-6 6-6" /></svg>
        <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
          {(businessName || 'IS').slice(0, 2).toUpperCase()}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{businessName}</div>
          <div style={{ fontSize: 9.5, opacity: .8 }}>online</div>
        </div>
      </div>

      {/* chat body — the doodle background is a data URI so the preview stays self-contained */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: 14,
        backgroundColor: WA.chat,
        backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(0,0,0,.025) 2px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(0,0,0,.025) 2px, transparent 2px)',
        backgroundSize: '46px 46px',
      }}>
        {isEmpty ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11.5, textAlign: 'center', padding: 20 }}>
            {emptyHint}
          </div>
        ) : (
          <div style={{ maxWidth: '92%' }}>
            <div style={{ background: WA.bubble, borderRadius: '8px 8px 8px 2px', padding: '8px 9px 6px', boxShadow: '0 1px 1px rgba(0,0,0,.12)', position: 'relative' }}>
              {headerType === 'text' && header.trim() !== '' && (
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', marginBottom: 5, lineHeight: 1.35, whiteSpace: 'pre-wrap' }}>
                  {renderWhatsAppMarkup(header)}
                </div>
              )}
              {['image', 'video', 'document'].includes(headerType) && (
                <div style={{ background: '#cfe9c8', borderRadius: 6, height: 92, marginBottom: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#3f6212' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                  </svg>
                  <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px' }}>{headerType} header</span>
                </div>
              )}

              <div style={{ fontSize: 12.5, color: '#111b21', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {renderWhatsAppMarkup(body)}
              </div>

              {footerText && String(footerText).trim() !== '' && (
                <div style={{ fontSize: 10.5, color: '#667781', marginTop: 6, whiteSpace: 'pre-wrap' }}>{footerText}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 3 }}>
                <span style={{ fontSize: 9.5, color: '#667781' }}>{clock}</span>
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="#53bdeb" strokeWidth={1.8}><path d="M2 9.5 5 12.5 11 5.5" /><path d="M7 9.5 10 12.5 16 5.5" /></svg>
              </div>
            </div>

            {(buttons || []).length > 0 && (
              <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {buttons.map((b, i) => (
                  <div key={i} style={{
                    background: '#fff', borderRadius: 6, padding: '8px 6px', textAlign: 'center',
                    color: '#00a5f4', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 6, boxShadow: '0 1px 1px rgba(0,0,0,.12)',
                  }}>
                    <BtnIcon type={b.type} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.text || 'Button'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* composer — purely visual, keeps the mock recognizable as WhatsApp */}
      <div style={{ background: '#f0f0f0', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ flex: 1, background: '#fff', borderRadius: 999, padding: '7px 12px', fontSize: 11, color: '#94a3b8' }}>Message</div>
        <span style={{ width: 28, height: 28, borderRadius: '50%', background: WA.greenDark, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="m3 3 18 9-18 9 4-9-4-9z" /></svg>
        </span>
      </div>
    </div>
  );
}
