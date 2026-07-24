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

/* Right-side collapsible recap panel, shown alongside every wizard step. */
export default function CampaignSummaryPanel({ draft, segmentNames, listNames }) {
  return (
    <div style={{ width: 300, flexShrink: 0, padding: '4px 16px 16px', overflowY: 'auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '10px 0 4px' }}>Summary</div>

      <Section title="Setup">
        <Row label="Campaign name" value={draft.name} />
        <Row label="Tags" value={draft.tags?.length ? draft.tags.join(', ') : 'No tags'} />
        <Row label="GA Tracking" value={draft.ga_enabled ? 'On' : 'Off'} />
        <Row label="Conversion goal" value={draft.goal_enabled ? (draft.goal_event_name || 'On') : 'Off'} />
      </Section>

      <Section title="Audience">
        <Row label="Target audience" value={draft.audience_type === 'all_contacts' ? 'All contacts' : `${draft.segment_ids.length} segment(s), ${(draft.list_ids || []).length} list(s)`} />
        {draft.audience_type !== 'all_contacts' && draft.segment_ids.length > 0 && (
          <Row label="Segments" value={draft.segment_ids.map(id => segmentNames?.[id] || `ID ${id}`).join(', ')} />
        )}
        {draft.audience_type !== 'all_contacts' && (draft.list_ids || []).length > 0 && (
          <Row label="Lists" value={draft.list_ids.map(id => listNames?.[id] || `ID ${id}`).join(', ')} />
        )}
        <Row label="Reachable contacts" value={Number(draft.reachable_count || 0).toLocaleString()} />
        {draft.exclude_enabled && draft.exclude_segment_ids.length > 0 && (
          <Row label="Excluded" value={draft.exclude_segment_ids.map(id => segmentNames?.[id] || `ID ${id}`).join(', ')} />
        )}
      </Section>

      <Section title="Content">
        <Row label="Sender" value={draft.sender_name ? `${draft.sender_name} <${draft.sender_email}>` : draft.sender_email} />
        <Row label="Subject" value={draft.subject} />
        <Row label="Template" value={draft.template_name} />
      </Section>

      <Section title="Schedule">
        <Row label="When to send" value={draft.schedule_type === 'now' ? 'Send now' : (draft.scheduled_at || 'Send later')} />
      </Section>
    </div>
  );
}
