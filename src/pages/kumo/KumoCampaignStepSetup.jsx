/*
 * Kumo campaign wizard — step 1, Setup.
 *
 * Same chrome as the Netcore Setup step: one "campaign details" card with the
 * name and its counter.
 *
 * Open and click tracking used to be two toggle cards here. They are not a
 * per-campaign decision any more — every Kumo campaign sends with both on (the
 * wizard seeds them true and kumo.php forces them to 1 on save), so a switch
 * nobody ever moves was only a step to click past.
 */
import { useEffect } from 'react';

const inp = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: '#1e293b', outline: 'none', boxSizing: 'border-box' };
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 };
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 18 };


export default function KumoCampaignStepSetup({ draft, setField, onValidChange }) {
  const valid = !!draft.name?.trim();
  useEffect(() => { onValidChange(valid); }, [valid]); // eslint-disable-line

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Campaign details</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>Provide basic details about your campaign</div>

        <div style={{ marginBottom: 16 }}>
          <label style={label}>Campaign name <span style={{ color: '#dc2626' }}>*</span></label>
          <input style={inp} value={draft.name} maxLength={100} onChange={e => setField('name', e.target.value)} placeholder="e.g. iCAT 171 exam reminder" />
          <div style={{ textAlign: 'right', fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>{(draft.name || '').length}/100</div>
        </div>

        <div>
          <label style={label}>Internal note <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span></label>
          <input style={inp} value={draft.preheader || ''} onChange={e => setField('preheader', e.target.value)}
            placeholder="Pre-header text — shown next to the subject in most inboxes" />
          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 5 }}>
            This is the campaign&apos;s pre-header. You can also edit it later in the Content step.
          </div>
        </div>
      </div>

    </div>
  );
}
