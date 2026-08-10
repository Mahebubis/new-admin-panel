import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { WA_INBOX_API, FORM, fmtDt, fmtWindow, initialsOf, avatarColor, n0 } from './waShared';
import { Spinner, CategoryChip } from './WaUi';

/*
 * The right pane: everything we know about the person in the open conversation.
 *
 * The point of this pane is context. A reply reading "yes send me the details" is meaningless on
 * its own; next to "received 'iCAT 174 registration closes tonight' two hours ago, read it,
 * clicked the button" it answers itself. So the campaign history is the centrepiece here, not a
 * footnote — every campaign this number has received, with the per-recipient outcome and a link
 * straight into that campaign's report.
 *
 * All of it comes from ONE request (wa_inbox.php action=profile). Splitting identity, campaigns
 * and stats into separate calls would triple the request count on every thread switch for
 * information that is always shown together.
 */

const STATUS_COLORS = {
  read:      { bg: '#dbeafe', fg: '#1d4ed8' },
  delivered: { bg: '#dcfce7', fg: '#15803d' },
  sent:      { bg: '#f1f5f9', fg: '#475569' },
  failed:    { bg: '#fee2e2', fg: '#dc2626' },
  pending:   { bg: '#fef3c7', fg: '#b45309' },
  processing:{ bg: '#fef3c7', fg: '#b45309' },
  skipped:   { bg: '#f1f5f9', fg: '#94a3b8' },
};

export default function WaContactPanel({ conversationId, onChanged }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState({ details: true, campaigns: true, stats: true, note: false });
  const [note, setNote]       = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [busy, setBusy]       = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(WA_INBOX_API, { params: { action: 'profile', id: conversationId } });
      if (res.data?.success) { setData(res.data.data); setNote(res.data.data.note || ''); }
    } catch { /* the pane simply stays empty; the thread itself still works */ }
    finally { setLoading(false); }
  }, [conversationId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const toggle = k => setOpen(o => ({ ...o, [k]: !o[k] }));

  const post = async (body, okMsg) => {
    setBusy(true);
    try {
      const res = await api.post(WA_INBOX_API, new URLSearchParams({ ...body, id: String(conversationId) }), FORM);
      if (res.data?.success) { toast.success(okMsg); load(); onChanged?.(); }
      else toast.error(res.data?.message || 'Could not update');
    } catch (e) { toast.error(e?.response?.data?.message || 'Could not update'); }
    finally { setBusy(false); }
  };

  const saveNote = async () => {
    setSavingNote(true);
    try {
      const res = await api.post(WA_INBOX_API, new URLSearchParams({ action: 'save_note', id: String(conversationId), note }), FORM);
      if (res.data?.success) toast.success('Note saved');
      else toast.error(res.data?.message || 'Could not save the note');
    } catch (e) { toast.error(e?.response?.data?.message || 'Could not save the note'); }
    finally { setSavingNote(false); }
  };

  if (loading) {
    return <div className="wa-pane wa-profile" style={{ alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>;
  }
  if (!data) {
    return (
      <div className="wa-pane wa-profile" style={{ alignItems: 'center', justifyContent: 'center', padding: 26, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Could not load this contact's details.</div>
      </div>
    );
  }

  const c = data.conversation;
  const s = data.stats;
  const resolved = c.status === 'resolved';

  return (
    <div className="wa-pane wa-profile">
      <div className="wa-pane-head" style={{ padding: '9px 16px', background: '#f0f2f5' }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#111b21' }}>Chat Profile</div>
      </div>

      <div className="wa-scroll">
        {/* identity */}
        <div style={{ padding: '22px 16px 18px', textAlign: 'center', borderBottom: '1px solid #eef2f6' }}>
          <span className="wa-avatar" style={{ background: avatarColor(c.phone), width: 74, height: 74, fontSize: 24, margin: '0 auto 11px' }}>
            {initialsOf(c.name)}
          </span>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{c.name}</div>
          <div style={{ fontSize: 12, color: '#667781', marginTop: 3 }}>+{c.phone}</div>
          {c.email && <div style={{ fontSize: 11.5, color: '#8696a0', marginTop: 2, wordBreak: 'break-all' }}>{c.email}</div>}

          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
            <Pill tone={c.window_open ? 'green' : 'amber'}>
              {c.window_open ? fmtWindow(c.window_seconds_left) : '24h window closed'}
            </Pill>
            <Pill tone={resolved ? 'slate' : 'blue'}>{resolved ? 'Resolved' : 'Open'}</Pill>
            {data.optin && (
              <Pill tone={data.optin.status === 'optout' ? 'red' : 'green'}>
                {data.optin.status === 'optout' ? 'Opted out' : 'Opted in'}
              </Pill>
            )}
          </div>

          <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
            <button className="wa-btn wa-btn-outlined wa-btn-sm" style={{ flex: 1 }} disabled={busy}
              onClick={() => post({ action: 'set_status', status: resolved ? 'open' : 'resolved' },
                resolved ? 'Reopened' : 'Marked resolved')}>
              {resolved ? 'REOPEN' : 'RESOLVE'}
            </button>
            <button className="wa-btn wa-btn-text wa-btn-sm" style={{ flex: 1 }} disabled={busy}
              onClick={() => post({ action: 'archive', archived: c.is_archived ? 0 : 1 },
                c.is_archived ? 'Restored' : 'Archived')}>
              {c.is_archived ? 'RESTORE' : 'ARCHIVE'}
            </button>
          </div>
        </div>

        {/* engagement */}
        <Section title="Engagement" count={null} open={open.stats} onToggle={() => toggle('stats')}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Stat label="Campaigns" value={s.campaigns_received} />
            <Stat label="Delivered" value={s.delivered} tone="#15803d" />
            <Stat label="Read" value={s.read} tone="#1d4ed8" />
            <Stat label="Clicked" value={s.clicks} tone="#7c3aed" />
            <Stat label="Failed" value={s.failed} tone={s.failed ? '#dc2626' : undefined} />
            <Stat label="Replies" value={s.inbound_messages} tone="#0f766e" />
          </div>
        </Section>

        {/* campaigns */}
        <Section title="Campaigns" count={data.campaigns.length} open={open.campaigns} onToggle={() => toggle('campaigns')}>
          {data.campaigns.length === 0 ? (
            <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.6 }}>
              This number has never been in a WhatsApp campaign — the conversation started some
              other way.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.campaigns.map(k => <CampaignCard key={k.recipient_id} k={k} />)}
            </div>
          )}
        </Section>

        {/* details */}
        <Section title="Details" count={null} open={open.details} onToggle={() => toggle('details')}>
          <dl className="wa-kv">
            <dt>Contact ID</dt><dd>#{c.id}</dd>
            {c.user_id ? <><dt>User ID</dt><dd>#{c.user_id}</dd></> : null}
            {c.profile_name ? <><dt>WhatsApp name</dt><dd>{c.profile_name}</dd></> : null}
            <dt>Sending number</dt>
            <dd>{data.sender ? `${data.sender.display_name || 'Number'} · ${data.sender.business_number}` : 'Not resolved'}</dd>
            <dt>Last message</dt><dd>{fmtDt(c.last_message_at)}</dd>
            <dt>Window ends</dt><dd>{c.window_expires_at ? fmtDt(c.window_expires_at) : 'Never opened'}</dd>
            {data.optin ? <><dt>Consent</dt><dd>{data.optin.status} · {fmtDt(data.optin.updated_at)}</dd></> : null}
          </dl>
        </Section>

        {/* internal note */}
        <Section title="Internal note" count={null} open={open.note} onToggle={() => toggle('note')}>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={4}
            placeholder="Only visible in this panel — never sent to the contact."
            style={{
              width: '100%', padding: '9px 11px', border: '1.5px solid #e2e8f0', borderRadius: 8,
              fontSize: 11.5, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              color: '#1e293b', lineHeight: 1.5,
            }} />
          <button className="wa-btn wa-btn-outlined wa-btn-sm" onClick={saveNote} disabled={savingNote}
            style={{ marginTop: 8 }}>
            {savingNote ? 'SAVING…' : 'SAVE NOTE'}
          </button>
        </Section>
      </div>
    </div>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────────────────────── */

function Section({ title, count, open, onToggle, children }) {
  return (
    <div className="wa-profile-sec">
      <button onClick={onToggle}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {title}
          {count !== null && count !== undefined && (
            <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 999 }}>
              {count}
            </span>
          )}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2.4}
          style={{ transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform 250ms cubic-bezier(.4,0,.2,1)', flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #eef2f6', borderRadius: 8, padding: '9px 11px' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: tone || '#0f172a', lineHeight: 1.1 }}>{n0(value)}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginTop: 3, letterSpacing: '.2px' }}>{label}</div>
    </div>
  );
}

function CampaignCard({ k }) {
  const sc = STATUS_COLORS[k.status] || STATUS_COLORS.sent;
  return (
    <div className="wa-mini-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link to={`/netcore/whatsapp/${k.campaign_id}/report`}
            style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={k.campaign_name}>
            {k.campaign_name}
          </Link>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
            ID #{k.campaign_id}{k.is_test ? ' · TEST' : ''}
          </div>
        </div>
        <span style={{ background: sc.bg, color: sc.fg, fontSize: 9, fontWeight: 800, padding: '3px 7px', borderRadius: 999, letterSpacing: '.3px', textTransform: 'uppercase', flexShrink: 0 }}>
          {k.status}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
        {k.category && <CategoryChip category={k.category} />}
        {k.template_name && (
          <span style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
            {k.template_name}
          </span>
        )}
        {k.clicks > 0 && (
          <span style={{ fontSize: 9.5, color: '#7c3aed', fontWeight: 800, background: '#ede9fe', padding: '2px 6px', borderRadius: 4 }}>
            {k.clicks} CLICK{k.clicks > 1 ? 'S' : ''}
          </span>
        )}
      </div>

      {/* The delivery trail, so "did they actually see it" is answerable without opening the
          campaign report. */}
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 7, lineHeight: 1.7 }}>
        {k.sent_at      && <div>Sent · {fmtDt(k.sent_at)}</div>}
        {k.delivered_at && <div style={{ color: '#15803d' }}>Delivered · {fmtDt(k.delivered_at)}</div>}
        {k.read_at      && <div style={{ color: '#1d4ed8' }}>Read · {fmtDt(k.read_at)}</div>}
        {k.failed_at    && <div style={{ color: '#dc2626' }}>Failed · {k.error || 'no reason reported'}</div>}
      </div>
    </div>
  );
}

function Pill({ tone, children }) {
  const tones = {
    green: { bg: '#dcfce7', fg: '#15803d' },
    amber: { bg: '#fef3c7', fg: '#b45309' },
    blue:  { bg: '#dbeafe', fg: '#1d4ed8' },
    red:   { bg: '#fee2e2', fg: '#dc2626' },
    slate: { bg: '#f1f5f9', fg: '#64748b' },
  };
  const t = tones[tone] || tones.slate;
  return (
    <span style={{ background: t.bg, color: t.fg, fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, letterSpacing: '.2px', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}
