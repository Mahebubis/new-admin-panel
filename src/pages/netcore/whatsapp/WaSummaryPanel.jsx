import { useState } from 'react';
import { n0 } from './waShared';

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #e2e8f0' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 2px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{title}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2.4}
          style={{ transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && <div style={{ paddingBottom: 16 }}>{children}</div>}
    </div>
  );
}

const Row = ({ label, value }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 12.5, color: '#334155', fontWeight: 600, wordBreak: 'break-word' }}>{value || '—'}</div>
  </div>
);

/* Right-side collapsible recap, shown alongside the Setup and Audience steps (Content and
   Schedule carry their own live preview/review panels instead). */
export default function WaSummaryPanel({ draft, segmentNames, listNames }) {
  const stats = draft.audience_stats || {};
  return (
    <div style={{ width: 300, flexShrink: 0, padding: '4px 16px 140px', overflowY: 'auto' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '10px 0 4px' }}>Summary</div>

      <Section title="Setup">
        <Row label="Campaign name" value={draft.name} />
        <Row label="Sending from"
          value={draft.sender_label ? `${draft.sender_display_name || ''} ${draft.sender_label}`.trim() : 'Not selected'} />
        <Row label="WABA ID" value={draft.waba_id} />
        <Row label="Tags" value={draft.tags?.length ? draft.tags.join(', ') : 'No tags'} />
        <Row label="Deduplication"
          value={draft.dedup_enabled ? `On · ${draft.dedup_window_hours}h · ${draft.dedup_scope === 'same_template' ? 'same template' : 'any campaign'}` : 'Off (within-campaign only)'} />
        <Row label="GA tracking" value={draft.ga_enabled ? 'On' : 'Off'} />
      </Section>

      <Section title="Audience">
        <Row label="Target audience"
          value={draft.audience_type === 'all_contacts'
            ? 'All contacts'
            : `${(draft.segment_ids || []).length} segment(s), ${(draft.list_ids || []).length} list(s)`} />
        {draft.audience_type !== 'all_contacts' && (draft.segment_ids || []).length > 0 && (
          <Row label="Segments" value={draft.segment_ids.map(id => segmentNames?.[id] || `ID ${id}`).join(', ')} />
        )}
        {draft.audience_type !== 'all_contacts' && (draft.list_ids || []).length > 0 && (
          <Row label="Lists" value={draft.list_ids.map(id => listNames?.[id] || `ID ${id}`).join(', ')} />
        )}
        <Row label="Reachable numbers" value={n0(draft.reachable_count)} />
        {Number(stats.unreachable) > 0 && <Row label="No phone number" value={`${n0(stats.unreachable)} skipped`} />}
        {draft.exclude_enabled && (draft.exclude_segment_ids || []).length > 0 && (
          <Row label="Excluded" value={draft.exclude_segment_ids.map(id => segmentNames?.[id] || `ID ${id}`).join(', ')} />
        )}
      </Section>

      <Section title="Content">
        <Row label="Message type" value={draft.message_type === 'template' ? 'Approved template' : 'Free text'} />
        <Row label="Template" value={draft.template_name} />
        <Row label="Language" value={draft.template_language} />
      </Section>

      <Section title="Schedule">
        <Row label="When to send" value={draft.schedule_type === 'now' ? 'Send now' : (draft.scheduled_at || 'Send later')} />
        <Row label="Contact limit" value={draft.contact_limit_enabled ? n0(draft.contact_limit) : 'Off'} />
      </Section>
    </div>
  );
}
