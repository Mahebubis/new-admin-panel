import { useEffect, useMemo, useState } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { WA, WA_INBOX_API, FORM, inp, label } from './waShared';
import { Spinner, ApprovalBadge, CategoryChip, Notice } from './WaUi';
import SearchableSelect from './SearchableSelect';

/*
 * Sending an approved template from inside a conversation.
 *
 * This is the ONLY way to reach a contact once their 24-hour window has closed, so it is not a
 * secondary path — for a contact who replied yesterday it is the only path. It mirrors the
 * campaign wizard's content step in miniature: pick a template, fill its {{n}} variables, see
 * the rendered result, send.
 *
 * Only Meta-approved templates are offered. An unapproved one is accepted by the API and then
 * silently dropped, which is the single most confusing failure on this channel.
 */
export default function WaTemplateSendModal({ conversationId, contact, onClose, onSent }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [vars, setVars]   = useState([]);
  const [suffix, setSuffix] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(WA_INBOX_API, { params: { action: 'templates' } });
        if (res.data?.success) setTemplates(res.data.data.templates || []);
        else toast.error(res.data?.message || 'Could not load templates');
      } catch (e) {
        toast.error(e?.response?.data?.message || 'Could not load templates');
      } finally { setLoading(false); }
    })();
  }, []);

  const tpl = useMemo(() => templates.find(t => t.id === selectedId) || null, [templates, selectedId]);
  const varCount = (tpl?.header_vars || 0) + (tpl?.body_vars || 0);

  /* Variable boxes are rebuilt when the template changes — carrying values across templates
     would silently put the wrong text in the wrong slot. */
  useEffect(() => { setVars(Array(varCount).fill('')); setSuffix(''); }, [selectedId, varCount]);

  const dynamicButton = (tpl?.buttons || []).some(b => b.type === 'url' && b.dynamic);

  const fill = (text, values) =>
    String(text || '').replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => values[Number(n) - 1] || `{{${n}}}`);

  const headerPreview = tpl ? fill(tpl.header_text, vars.slice(0, tpl.header_vars)) : '';
  const bodyPreview   = tpl ? fill(tpl.body_text,   vars.slice(tpl.header_vars)) : '';

  const send = async () => {
    if (!tpl || sending) return;
    const missing = vars.findIndex(v => !String(v).trim());
    if (missing >= 0) return toast.error(`Fill variable {{${missing + 1}}} — WhatsApp rejects a template with a blank parameter`);
    setSending(true);
    try {
      const body = new URLSearchParams({
        action: 'send_template', id: String(conversationId), template_id: String(tpl.id),
        button_url_suffix: suffix,
      });
      vars.forEach(v => body.append('vars[]', v));
      const res = await api.post(WA_INBOX_API, body, FORM);
      if (res.data?.success) { toast.success('Template sent'); onSent?.(res.data.data.message); }
      else toast.error(res.data?.message || 'Could not send');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not send');
    } finally { setSending(false); }
  };

  // sublabel carries the raw template name and body so the search box matches on message text,
  // not just the display name — with fifty templates that is the difference between finding one
  // and scrolling for it.
  const options = templates.map(t => ({
    value: t.id,
    label: t.display_name || t.name,
    sublabel: `${t.category} · ${t.language}`,
    body: t.body_text,
  }));

  return (
    <div className="wa-backdrop" onClick={() => !sending && onClose()}>
      <div className="wa-dialog" style={{ width: 720, maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #eef2f6' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Send an approved template</div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3 }}>
            To <b style={{ color: '#475569' }}>{contact?.name}</b> · +{contact?.phone}
          </div>
        </div>

        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : templates.length === 0 ? (
            <Notice tone="warn" title="No approved templates yet">
              Only templates Meta has approved can be sent. Create one under Content → WhatsApp
              templates, submit it to Meta, and it appears here once approved.
            </Notice>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Template</label>
                <SearchableSelect
                  options={options} value={selectedId} onChange={setSelectedId}
                  placeholder="Search approved templates…" />
              </div>

              {tpl && (
                <>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 14 }}>
                    <CategoryChip category={tpl.category} />
                    <ApprovalBadge status="approved" />
                    <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>{tpl.name} · {tpl.language}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 20, alignItems: 'start' }}>
                    <div>
                      {varCount === 0 && !dynamicButton && (
                        <Notice tone="info">This template has no variables — it goes out exactly as approved.</Notice>
                      )}
                      {Array.from({ length: varCount }).map((_, i) => (
                        <div key={i} style={{ marginBottom: 11 }}>
                          <label style={label}>
                            {`{{${i + 1}}}`}
                            <span style={{ fontWeight: 500, color: '#94a3b8' }}>
                              {i < tpl.header_vars ? ' — header' : ' — body'}
                            </span>
                          </label>
                          <input style={inp} value={vars[i] || ''}
                            onChange={e => setVars(v => v.map((x, j) => (j === i ? e.target.value : x)))}
                            placeholder={i === 0 ? contact?.first_name || 'Value' : 'Value'} />
                        </div>
                      ))}
                      {dynamicButton && (
                        <div style={{ marginBottom: 11 }}>
                          <label style={label}>Button URL suffix</label>
                          <input style={inp} value={suffix} onChange={e => setSuffix(e.target.value)}
                            placeholder="e.g. offers/icat-174" />
                          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
                            Appended to the approved base URL of the dynamic button.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Live preview — the same bubble styling as the thread, so what you approve
                        here is literally what appears there. */}
                    <div className="wa-chat-bg" style={{ borderRadius: 10, padding: 14, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: '#8696a0', letterSpacing: '.4px', marginBottom: 8 }}>PREVIEW</div>
                      <div className="wa-bubble out" style={{ maxWidth: '100%', display: 'block' }}>
                        {tpl.header_type === 'text' && headerPreview && (
                          <div style={{ fontWeight: 800, marginBottom: 4 }}>{headerPreview}</div>
                        )}
                        {tpl.header_type !== 'none' && tpl.header_type !== 'text' && (
                          <div style={{ background: 'rgba(15,23,42,.07)', borderRadius: 5, padding: '18px 0', textAlign: 'center', fontSize: 10.5, color: '#667781', marginBottom: 5, textTransform: 'uppercase', fontWeight: 700 }}>
                            {tpl.header_type}
                          </div>
                        )}
                        <div style={{ whiteSpace: 'pre-wrap' }}>{bodyPreview}</div>
                        {tpl.footer_text && (
                          <div style={{ fontSize: 11, color: '#8696a0', marginTop: 5 }}>{tpl.footer_text}</div>
                        )}
                        {(tpl.buttons || []).length > 0 && (
                          <div style={{ borderTop: '1px solid rgba(15,23,42,.1)', marginTop: 7, paddingTop: 5 }}>
                            {tpl.buttons.map((b, i) => (
                              <div key={i} style={{ color: '#00a5f4', fontSize: 12.5, fontWeight: 600, textAlign: 'center', padding: '4px 0' }}>
                                {b.text || b.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '13px 22px', borderTop: '1px solid #eef2f6', display: 'flex', gap: 9, justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ marginRight: 'auto', fontSize: 10.5, color: '#94a3b8' }}>
            Sending a template restarts nothing — the 24-hour window reopens only when they reply.
          </span>
          <button className="wa-btn wa-btn-text" onClick={onClose} disabled={sending}>CANCEL</button>
          <button className="wa-btn wa-btn-contained" onClick={send} disabled={sending || !tpl}
            style={{ background: sending ? '#94a3b8' : WA.green }}>
            {sending ? 'SENDING…' : 'SEND TEMPLATE'}
          </button>
        </div>
      </div>
    </div>
  );
}
