import { WA } from './waShared';

/*
 * A compact message preview for list/grid cards.
 *
 * The full phone mock (WaPhonePreview) stays where a true-to-life rendering earns its space —
 * the template editor and the campaign's content step. In a grid of 24 templates it was the
 * problem: chrome, avatar, "online", and a composer bar repeated 24 times, so the actual
 * message got a fraction of the card and every card looked identical at a glance.
 *
 * This keeps only what distinguishes one template from another: the first line, the body, the
 * footer, and the buttons.
 */

/** WhatsApp's *bold* / _italic_ / ~strike~ markup, rendered rather than shown raw. */
function renderMarkup(text) {
  const src = String(text ?? '');
  const nodes = [];
  const re = /(\*[^*\n]+\*)|(_[^_\n]+_)|(~[^~\n]+~)/g;
  let last = 0, m;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) nodes.push(src.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('*')) nodes.push(<b key={m.index}>{tok.slice(1, -1)}</b>);
    else if (tok.startsWith('_')) nodes.push(<i key={m.index}>{tok.slice(1, -1)}</i>);
    else nodes.push(<s key={m.index}>{tok.slice(1, -1)}</s>);
    last = m.index + tok.length;
  }
  if (last < src.length) nodes.push(src.slice(last));
  return nodes;
}

function fill(text, values = []) {
  return String(text ?? '').replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => {
    const v = values[Number(n) - 1];
    return (v === undefined || v === null || v === '') ? `{{${n}}}` : v;
  });
}

export default function WaMessageCard({
  headerType = 'none', headerText = '', headerValues = [],
  bodyText = '', bodyValues = [], footerText = '', buttons = [], lines = 4,
}) {
  const header = headerType === 'text' ? fill(headerText, headerValues) : '';
  const body = fill(bodyText, bodyValues);

  return (
    <div>
      <div style={{
        background: '#f2fbf5', border: '1px solid #dcf0e3', borderRadius: 10,
        padding: '11px 13px', position: 'relative',
      }}>
        {['image', 'video', 'document'].includes(headerType) && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 7,
            background: '#dcf0e3', color: '#3f6212', borderRadius: 5, padding: '3px 7px',
            fontSize: 9.5, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
            </svg>
            {headerType}
          </div>
        )}

        {header.trim() !== '' && (
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', marginBottom: 4, lineHeight: 1.35 }}>
            {renderMarkup(header)}
          </div>
        )}

        <div className="wa-clamp" style={{ fontSize: 12, color: '#334155', lineHeight: 1.55, whiteSpace: 'pre-wrap', WebkitLineClamp: lines }}>
          {renderMarkup(body)}
        </div>

        {footerText && String(footerText).trim() !== '' && (
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>{footerText}</div>
        )}
      </div>

      {(buttons || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
          {buttons.map((b, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              border: '1px solid #dbeafe', background: '#f8fbff', color: '#1d4ed8',
              borderRadius: 6, padding: '4px 9px', fontSize: 10.5, fontWeight: 600,
              maxWidth: '100%', overflow: 'hidden',
            }}>
              {b.type === 'url' && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6M10 14 21 3" />
                </svg>
              )}
              {b.type === 'phone' && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.text || 'Button'}</span>
              {b.type === 'url' && b.dynamic && (
                <span title="Dynamic URL — takes a per-contact value" style={{ color: WA.greenDark, fontWeight: 800 }}>·</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
