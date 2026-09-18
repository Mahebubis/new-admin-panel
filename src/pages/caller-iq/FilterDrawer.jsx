import { useState } from 'react';
import { ripple } from '../netcore/analytics/maShared';
import { Drawer, Ic, MAIN_TYPES, TYPE, OUTCOMES, WEEKDAYS, outcomeColor, typeIcon, Avatar, StatusDot } from './ciqShared';
import { EMPTY_FILTERS, activeCount, normalize } from './ciqFilters';

/*
 * Every filter in one place. Edits land on a draft; nothing refetches until Apply, so building a
 * five-condition filter costs one request instead of five.
 */

const toggle = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

function Seg({ value, options, onChange }) {
  return (
    <div className="ma-seg" style={{ background: '#f1f5f9' }}>
      {options.map(([k, l]) => (
        <button key={k} type="button" onPointerDown={ripple} data-on={value === k ? '1' : undefined} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

function Section({ title, onClear, children }) {
  return (
    <section className="ciq-fsec">
      <h4>{title}{onClear && <button type="button" onClick={onClear}>Clear</button>}</h4>
      {children}
    </section>
  );
}

const DUR_QUICK = [
  ['Any', '', ''], ['Under 30s', '', 30], ['30s+', 30, ''], ['1 min+', 60, ''], ['3 min+', 180, ''], ['5 min+', 300, ''], ['10 min+', 600, ''],
];
const HOUR_QUICK = [
  ['Morning 9–12', 9, 11], ['Afternoon 12–5', 12, 16], ['Evening 5–9', 17, 20], ['After hours', 20, 8],
];
const hourLabel = h => `${(h % 12) || 12}:00 ${h < 12 ? 'am' : 'pm'}`;

export default function FilterDrawer({ filters, devices, outcomeOptions, teams, onApply, onClose, onSaveView }) {
  const [d, setD] = useState(() => normalize(filters));
  const [viewName, setViewName] = useState('');
  const set = patch => setD(x => ({ ...x, ...patch }));
  const outcomes = [...OUTCOMES.map(o => o.key), ...(outcomeOptions || []).filter(o => !OUTCOMES.some(x => x.key === o))];
  const n = activeCount(d);

  return (
    <Drawer
      onClose={onClose}
      width={560}
      header={
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{Ic.filter} Filters</h2>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>Applies to every tab, tile and chart on the page.</p>
        </div>
      }
      footer={close => (
        <>
          <button className="ma-btn ma-rip" style={{ marginRight: 'auto' }} onPointerDown={ripple} onClick={() => setD({ ...EMPTY_FILTERS })} disabled={!n}>Reset all</button>
          <button className="ma-btn ma-rip" onPointerDown={ripple} onClick={close}>Cancel</button>
          <button className="ma-btn primary ma-rip" onPointerDown={ripple} onClick={() => { onApply(d); close(); }}>
            Apply{n ? ` (${n})` : ''}
          </button>
        </>
      )}
    >
      <Section title="Call type" onClear={d.types.length ? () => set({ types: [] }) : null}>
        <div className="ciq-opts">
          {[...MAIN_TYPES, TYPE.BLOCKED, TYPE.UNKNOWN].map(t => (
            <button key={t.key} type="button" className="ma-chip ma-rip" onPointerDown={ripple} style={{ '--c': t.color }}
                    data-on={d.types.includes(t.key) ? '1' : undefined} onClick={() => set({ types: toggle(d.types, t.key) })}>
              <span style={{ color: t.fg, display: 'inline-flex' }}>{typeIcon(t.key, 13)}</span>{t.label}
            </button>
          ))}
        </div>
      </Section>

      <div className="ciq-row2">
        <Section title="Connection">
          <Seg value={d.connected} onChange={v => set({ connected: v })} options={[['', 'Any'], ['yes', 'Connected'], ['no', 'Not connected']]} />
        </Section>
        <Section title="Callers">
          <Seg value={d.repeat} onChange={v => set({ repeat: v })} options={[['', 'Any'], ['repeat', 'Repeat'], ['first', 'One-time']]} />
        </Section>
      </div>

      <Section title="Missed-call follow-up">
        <Seg value={d.callback} onChange={v => set({ callback: v })} options={[['', 'Any call'], ['pending', 'Missed · not called back'], ['returned', 'Missed · called back']]} />
      </Section>

      <Section title="Agent / phone" onClear={d.devices.length || d.team ? () => set({ devices: [], team: '' }) : null}>
        <div className="ciq-opts" style={{ marginBottom: teams?.length ? 10 : 0 }}>
          {(devices || []).map(dev => {
            const id = dev.device_id === '' ? '__none__' : dev.device_id;
            return (
              <button key={id} type="button" className="ma-chip ma-rip" onPointerDown={ripple} data-on={d.devices.includes(id) ? '1' : undefined}
                      onClick={() => set({ devices: toggle(d.devices, id) })} style={{ paddingLeft: 4, height: 32 }}>
                <Avatar name={dev.label} size={22} />{dev.label}
                {dev.team && <span className="cnt">{dev.team}</span>}
                <StatusDot status={dev.status} />
              </button>
            );
          })}
          {!devices?.length && <span style={{ fontSize: 12, color: '#94a3b8' }}>No phones have synced yet.</span>}
        </div>
        {teams?.length > 0 && (
          <label className="ciq-field" style={{ margin: 0 }}>
            <span>Team</span>
            <select className="ciq-input" value={d.team} onChange={e => set({ team: e.target.value })}>
              <option value="">All teams</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}
      </Section>

      <Section title="Outcome tag" onClear={d.outcomes.length ? () => set({ outcomes: [] }) : null}>
        <div className="ciq-opts">
          {[...outcomes, '__none__'].map(o => (
            <button key={o} type="button" className="ma-chip ma-rip" onPointerDown={ripple} style={{ '--c': outcomeColor(o === '__none__' ? '' : o) }}
                    data-on={d.outcomes.includes(o) ? '1' : undefined} onClick={() => set({ outcomes: toggle(d.outcomes, o) })}>
              <i />{o === '__none__' ? 'Untagged' : o}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Call duration" onClear={d.min_dur !== '' || d.max_dur !== '' ? () => set({ min_dur: '', max_dur: '' }) : null}>
        <div className="ciq-opts" style={{ marginBottom: 10 }}>
          {DUR_QUICK.map(([l, mn, mx]) => (
            <button key={l} type="button" className="ma-chip ma-rip" onPointerDown={ripple}
                    data-on={String(d.min_dur) === String(mn) && String(d.max_dur) === String(mx) ? '1' : undefined}
                    onClick={() => set({ min_dur: mn, max_dur: mx })}>{l}</button>
          ))}
        </div>
        <div className="ciq-row2">
          <label className="ciq-field" style={{ margin: 0 }}><span>At least (seconds)</span>
            <input className="ciq-input" type="number" min="0" placeholder="0" value={d.min_dur} onChange={e => set({ min_dur: e.target.value })} /></label>
          <label className="ciq-field" style={{ margin: 0 }}><span>At most (seconds)</span>
            <input className="ciq-input" type="number" min="0" placeholder="No limit" value={d.max_dur} onChange={e => set({ max_dur: e.target.value })} /></label>
        </div>
      </Section>

      <Section title="Time of day" onClear={d.hour_from !== '' || d.hour_to !== '' ? () => set({ hour_from: '', hour_to: '' }) : null}>
        <div className="ciq-opts" style={{ marginBottom: 10 }}>
          {HOUR_QUICK.map(([l, a, b]) => (
            <button key={l} type="button" className="ma-chip ma-rip" onPointerDown={ripple}
                    data-on={String(d.hour_from) === String(a) && String(d.hour_to) === String(b) ? '1' : undefined}
                    onClick={() => set({ hour_from: a, hour_to: b })}>{l}</button>
          ))}
        </div>
        <div className="ciq-row2">
          {[['hour_from', 'From'], ['hour_to', 'Until the end of']].map(([k, l]) => (
            <label key={k} className="ciq-field" style={{ margin: 0 }}><span>{l}</span>
              <select className="ciq-input" value={d[k]} onChange={e => set({ [k]: e.target.value === '' ? '' : Number(e.target.value) })}>
                <option value="">{k === 'hour_from' ? 'Start of day' : 'End of day'}</option>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </label>
          ))}
        </div>
        {d.hour_from !== '' && d.hour_to !== '' && Number(d.hour_from) > Number(d.hour_to) && (
          <p style={{ margin: '8px 0 0', fontSize: 11.5, color: '#64748b' }}>Wraps past midnight: {hourLabel(Number(d.hour_from))} → {hourLabel(Number(d.hour_to))} next morning.</p>
        )}
      </Section>

      <Section title="Day of week" onClear={d.weekdays.length ? () => set({ weekdays: [] }) : null}>
        <div className="ciq-opts">
          {WEEKDAYS.map((w, i) => (
            <button key={w} type="button" className="ma-chip ma-rip" onPointerDown={ripple} style={{ minWidth: 48, justifyContent: 'center' }}
                    data-on={d.weekdays.includes(i) ? '1' : undefined} onClick={() => set({ weekdays: toggle(d.weekdays, i) })}>{w}</button>
          ))}
          <button type="button" className="ma-chip ma-rip" onPointerDown={ripple} style={{ borderStyle: 'dashed' }} onClick={() => set({ weekdays: [0, 1, 2, 3, 4] })}>Weekdays</button>
          <button type="button" className="ma-chip ma-rip" onPointerDown={ripple} style={{ borderStyle: 'dashed' }} onClick={() => set({ weekdays: [5, 6] })}>Weekend</button>
        </div>
      </Section>

      <div className="ciq-row2">
        <Section title="SIM slot" onClear={d.sims.length ? () => set({ sims: [] }) : null}>
          <div className="ciq-opts">
            {[[1, 'SIM 1'], [2, 'SIM 2'], [0, 'Unknown']].map(([k, l]) => (
              <button key={k} type="button" className="ma-chip ma-rip" onPointerDown={ripple}
                      data-on={d.sims.includes(k) ? '1' : undefined} onClick={() => set({ sims: toggle(d.sims, k) })}>{l}</button>
            ))}
          </div>
        </Section>
        <Section title="Keyword">
          <input className="ciq-input" value={d.q} onChange={e => set({ q: e.target.value })} placeholder="Number, agent, team, outcome or note" />
        </Section>
      </div>

      <Section title="Save as a view">
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="ciq-input" value={viewName} onChange={e => setViewName(e.target.value)} placeholder="e.g. Admissions team · missed today" />
          <button className="ma-btn ma-rip" onPointerDown={ripple} style={{ height: 38, flex: 'none' }} disabled={!viewName.trim() || !n}
                  onClick={() => { onSaveView(viewName.trim(), d); setViewName(''); }}>
            {Ic.bookmark} Save
          </button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>Saved in this browser. Open it later from the Views menu.</p>
      </Section>
    </Drawer>
  );
}
