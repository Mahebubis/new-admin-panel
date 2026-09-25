/*
 * Kumo — right-side collapsible recap panel, shown alongside every wizard step.
 *
 * Same panel as the Netcore campaign builder's summary rail, retitled for the
 * fields a Kumo campaign actually carries: tracking instead of GA/goals, and a
 * "Sending IPs" line, because on our own MTA that is the one thing nobody can
 * read off the rest of the screen.
 */
import { useState } from 'react';

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #e2e8f0' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 2px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{title}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2.4} style={{ transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && <div style={{ paddingBottom: 16 }}>{children}</div>}
    </div>
  );
}

const Row = ({ label, value }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 12.5, color: '#334155', fontWeight: 600 }}>{value || '—'}</div>
  </div>
);

export default function KumoCampaignSummary({ draft, segmentNames, listNames, ipLabels }) {
  const lists = draft.list_ids || [];
  const segments = draft.segment_ids || [];
  const excluded = draft.exclude_list_ids || [];

  const target = draft.audience_type === 'all_contacts'
    ? 'All contacts'
    : draft.audience_type === 'segment'
      ? `${segments.length} segment(s)`
      : `${lists.length} list(s)`;

  const ips = draft.ip_mode === 'fixed'
    ? ((draft.ip_ids || []).map(id => ipLabels?.[id] || `IP ${id}`).join(', ') || 'None picked yet')
    : 'Rotate across healthy IPs';

  return (
    <div style={{ width: 300, flexShrink: 0, padding: '4px 16px 140px', overflowY: 'auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '10px 0 4px' }}>Summary</div>

      <Section title="Setup">
        <Row label="Campaign name" value={draft.name} />
      </Section>

      <Section title="Audience">
        <Row label="Target audience" value={target} />
        {draft.audience_type === 'segment' && segments.length > 0 && (
          <Row label="Segments" value={segments.map(id => segmentNames?.[id] || `ID ${id}`).join(', ')} />
        )}
        {draft.audience_type === 'list' && lists.length > 0 && (
          <Row label="Lists" value={lists.map(id => listNames?.[id] || `ID ${id}`).join(', ')} />
        )}
        <Row label="Reachable contacts" value={Number(draft.reachable_count || 0).toLocaleString()} />
        {draft.exclude_enabled && excluded.length > 0 && (
          <Row label="Excluded" value={excluded.map(id => listNames?.[id] || `ID ${id}`).join(', ')} />
        )}
      </Section>

      <Section title="Content">
        <Row label="Sender" value={draft.from_name ? `${draft.from_name} <${draft.from_email}>` : draft.from_email} />
        <Row label="Subject" value={draft.subject} />
        <Row label="Template" value={draft.template_name} />
      </Section>

      <Section title="Schedule">
        <Row label="When to send" value={draft.schedule_type === 'now' ? 'Send now' : (draft.scheduled_at || 'Send later')} />
        <Row label="Sending IPs" value={ips} />
        <Row label="Throttle" value={draft.throttle_per_hour ? `${Number(draft.throttle_per_hour).toLocaleString()} / hour` : 'No limit'} />
      </Section>
    </div>
  );
}
