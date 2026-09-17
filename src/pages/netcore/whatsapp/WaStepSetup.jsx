import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import SearchableSelect from './SearchableSelect';
import { ALL_EVENTS } from '../eventsConfig';
import { WA_API, WA_SET_API, FORM, WA, inp, label, card, n0 } from './waShared';
import { Toggle, Notice } from './WaUi';

/* Tag badge colors, remembered per tag in localStorage so a tag always renders the same
   everywhere. Shared key with the email builder's picker — a tag is a tag, regardless of
   which channel first created it. */
const TAG_COLORS = [
  { bg: '#dbeafe', fg: '#1d4ed8' }, { bg: '#dcfce7', fg: '#15803d' }, { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#fce7f3', fg: '#be185d' }, { bg: '#ede9fe', fg: '#6d28d9' }, { bg: '#ffedd5', fg: '#c2410c' },
  { bg: '#e0f2fe', fg: '#0369a1' }, { bg: '#fee2e2', fg: '#dc2626' }, { bg: '#ecfccb', fg: '#4d7c0f' },
  { bg: '#f1f5f9', fg: '#475569' },
];
const TAG_KEY = 'nc_tag_colors_v1';
function tagColor(tag) {
  let idx;
  try {
    const map = JSON.parse(localStorage.getItem(TAG_KEY) || '{}');
    if (map[tag] !== undefined && TAG_COLORS[map[tag]]) idx = map[tag];
  } catch { /* localStorage unavailable — fall through to the hash */ }
  if (idx === undefined) {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
    idx = hash % TAG_COLORS.length;
  }
  return TAG_COLORS[idx];
}

function TagPicker({ selected, onChange, allTags }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const atMax = selected.length >= 5;
  // Defensive String() — a purely numeric tag ("171") can arrive as a JS number.
  const filtered = allTags.filter(t => String(t).toLowerCase().includes(search.toLowerCase()));
  const exact = allTags.some(t => String(t).toLowerCase() === search.trim().toLowerCase());

  const toggle = t => {
    if (selected.includes(t)) onChange(selected.filter(x => x !== t));
    else if (!atMax) onChange([...selected, t]);
  };
  const createNew = () => {
    const t = search.trim();
    if (!t || selected.includes(t) || atMax) return;
    onChange([...selected, t]);
    setSearch('');
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 30); }}
        style={{ minHeight: 42, border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', cursor: 'text', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {selected.length === 0 && <span style={{ color: '#94a3b8', fontSize: 12.5, padding: '4px 2px' }}>Select up to 5 tags</span>}
        {selected.map(t => {
          const c = tagColor(t);
          return (
            <span key={t} style={{ background: c.bg, color: c.fg, fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t}<span onClick={e => { e.stopPropagation(); toggle(t); }} style={{ cursor: 'pointer', opacity: .75, lineHeight: 1 }}>×</span>
            </span>
          );
        })}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 24px rgba(0,0,0,.12)', zIndex: 60, padding: 8 }}>
          <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !exact) createNew(); }}
            placeholder="Search or create a tag…"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12.5, marginBottom: 8, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {filtered.length === 0 && (
              <div style={{ fontSize: 12, color: '#94a3b8', padding: '6px 4px' }}>
                {allTags.length === 0 ? 'No tags yet — type above to create one.' : 'No matching tags.'}
              </div>
            )}
            {filtered.map(t => {
              const c = tagColor(t);
              const isSel = selected.includes(t);
              const disabled = !isSel && atMax;
              return (
                <button key={t} type="button" onClick={() => toggle(t)} disabled={disabled}
                  style={{ background: c.bg, color: c.fg, fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, border: isSel ? `1.5px solid ${c.fg}` : '1.5px solid transparent', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .5 : 1, fontFamily: 'inherit' }}>
                  {isSel ? '✓ ' : ''}{t}
                </button>
              );
            })}
          </div>
          {search.trim() !== '' && !exact && (
            <button type="button" onClick={createNew} disabled={atMax}
              style={{ marginTop: 8, width: '100%', padding: '8px 10px', border: '1px dashed #a5b4fc', background: '#f5f3ff', borderRadius: 6, fontSize: 12.5, color: '#1e3a8a', fontWeight: 700, cursor: atMax ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              + Create "{search.trim()}"
            </button>
          )}
          {atMax && <div style={{ fontSize: 10.5, color: '#c2410c', marginTop: 6 }}>Maximum 5 tags — remove one to add another.</div>}
        </div>
      )}
    </div>
  );
}


const WINDOW_OPTIONS = [
  { value: 6, label: '6 hours' }, { value: 12, label: '12 hours' }, { value: 24, label: '24 hours (1 day)' },
  { value: 48, label: '48 hours (2 days)' }, { value: 72, label: '72 hours (3 days)' },
  { value: 168, label: '168 hours (1 week)' }, { value: 336, label: '336 hours (2 weeks)' },
  { value: 720, label: '720 hours (30 days)' },
];

const SCOPE_OPTIONS = [
  { value: 'all_campaigns', label: 'Any WhatsApp campaign', sublabel: 'strictest' },
  { value: 'same_template', label: 'Only this same template', sublabel: 'for recurring reminders' },
];

const canCarry = (s, route) => (route === 'netcore' ? !!s.has_api_key : !!s.phone_number_id);

/*
  The route a brand-new campaign starts on.

  Meta Cloud API, not "whatever the default number happens to be set to". The number flagged
  default is the one this business sends the most from, which is a different question from which
  API a new campaign should go out through — and because that number holds a Netcore key, taking
  the route from it opened every new campaign on Netcore. Netcore is the fallback route here, the
  one to reach for when Meta rejects a send with #200; it should be chosen, not arrived at.

  Only used when no route is set at all, so an existing campaign always keeps its own.
*/
const DEFAULT_ROUTE = 'meta';

/*
  THE NUMBER THIS BUSINESS ACTUALLY USES FOR A ROUTE, which is not the same as the first one
  that could carry it.

  Several numbers may be capable — most hold a Meta phone number id — but in practice one
  account is the Meta one and another is the Netcore one, and picking by list order or by the
  single "default" flag lands on the wrong one for whichever route the flag does not describe.

  A completed send is the evidence, and it is evidence that maintains itself: last_sent_meta and
  last_sent_netcore come from campaigns that really went out on that route (see wa_settings.php),
  so adding a number and sending through it makes it the default for that route with nothing to
  configure. Failed sends are not counted, so a number tried once on the wrong route and rejected
  never becomes the suggestion.

  The flagged default and then any usable number are the fallbacks, for a fresh install where
  nothing has been sent yet.
*/
const preferredFrom = (list, route) => {
  const capable = list.filter(s => canCarry(s, route));
  const usable = capable.filter(s => s.ready && s.is_active === 1);
  const pool = usable.length ? usable : capable;
  const stamp = (s) => (route === 'netcore' ? s.last_sent_netcore : s.last_sent_meta) || '';
  const used = pool.filter(s => stamp(s));
  if (used.length) {
    return used.slice().sort((a, b) => String(stamp(b)).localeCompare(String(stamp(a))))[0];
  }
  return pool.find(s => s.is_default === 1) || pool[0] || null;
};


export default function WaStepSetup({ draft, setField, onValidChange }) {
  const nav = useNavigate();
  const [allTags, setAllTags] = useState([]);
  const [settings, setSettings] = useState(null);
  const [senders, setSenders] = useState([]);

  // A campaign is only valid once it has a name AND a number it can actually send from. The
  // second half is checked here rather than only at send time so the wizard can't walk you
  // through four steps and then refuse.
  const chosenSender = senders.find(s => Number(s.id) === Number(draft.sender_id)) || null;
  /*
    The route is part of what makes the Setup step valid, because a campaign with no explicit
    route used to fall back to the number's current provider at send time — which is how one
    built on Netcore went out through Meta after somebody changed the number in settings.
  */
  const valid = !!draft.name?.trim() && !!chosenSender && chosenSender.ready
    && chosenSender.is_active === 1 && !!draft.send_provider;
  useEffect(() => { onValidChange(valid); }, [valid]); // eslint-disable-line

  /*
    Seed the route from the chosen number, then leave it alone. This is a starting value, not a
    live link: once it is on the draft it belongs to the campaign, and re-pointing the number in
    settings cannot change it. It is re-seeded only when the current choice is impossible for the
    number now selected — picking a Meta-only number while the draft says Netcore would otherwise
    leave a campaign pinned to a route that cannot send.
  */
  useEffect(() => {
    if (!chosenSender) return;
    const canMeta = !!chosenSender.phone_number_id;
    const canNetcore = !!chosenSender.has_api_key;
    const current = String(draft.send_provider || '');
    const stillValid = (current === 'meta' && canMeta) || (current === 'netcore' && canNetcore);
    if (stillValid) return;
    const seed = (chosenSender.provider === 'netcore' && canNetcore) ? 'netcore'
      : canMeta ? 'meta' : (canNetcore ? 'netcore' : '');
    if (seed && seed !== current) setField('send_provider', seed);
  }, [chosenSender?.id]); // eslint-disable-line

  useEffect(() => {
    (async () => {
      try {
        const [tagRes, setRes] = await Promise.all([
          api.post(WA_API, new URLSearchParams({ action: 'tags' }), FORM),
          api.post(WA_SET_API, new URLSearchParams({ action: 'get' }), FORM),
        ]);
        if (tagRes.data.success) setAllTags(tagRes.data.data.tags || []);
        if (setRes.data.success) {
          setSettings(setRes.data.data.settings);
          const list = setRes.data.data.senders || [];
          setSenders(list);
          // Preselect the default number on a brand-new campaign so the common single-number
          // case needs no interaction at all. On an existing campaign, re-derive the display
          // label from the saved sender_id (labels aren't stored on the campaign).
          const existing = list.find(s => Number(s.id) === Number(draft.sender_id));

          /*
            A campaign nobody has touched yet opens on the default route and on the number that
            route is really sent from — the same pairing the Send through dropdown applies, so the
            two never start out disagreeing. An existing campaign keeps everything it was saved
            with; `existing` being found is what tells the two apart.
          */
          let pick = existing;
          if (!existing && !draft.sender_id) {
            const route = (list.some(s => canCarry(s, DEFAULT_ROUTE)) ? DEFAULT_ROUTE
              : (list.some(s => canCarry(s, 'netcore')) ? 'netcore' : ''));
            if (route && !draft.send_provider) setField('send_provider', route);
            pick = (route ? preferredFrom(list, route) : null)
              || list.find(s => s.is_default === 1 && s.is_active === 1)
              || list.find(s => s.is_active === 1);
          }
          if (pick) {
            setField('sender_id', pick.id);
            setField('waba_id', pick.waba_id);
            setField('sender_label', pick.business_number);
            setField('sender_display_name', pick.display_name || 'Internship Studio');
          }
        }
      } catch { /* non-critical — tags and the sender picker just render empty */ }
    })();
  }, []); // eslint-disable-line

  // The WABA dropdown lists each distinct account once; the number dropdown is filtered to it,
  // exactly like the Netcore panel's own two-step pick.
  /*
    Everything below the route is filtered BY the route.

    A number carries credentials per route — a Netcore API key, a Meta phone number id — and only
    some numbers have both. Listing every account and number regardless meant choosing a WABA, then
    a number, and only then discovering the route you needed was not available on it, two steps
    back. Choosing the route first and narrowing what follows means every option on screen can
    actually send.
  */
  const routeCapable = (s) => canCarry(s, draft.send_provider === 'netcore' ? 'netcore' : 'meta');
  const routeSenders = senders.filter(routeCapable);

  const preferredFor = (route) => preferredFrom(senders, route);

  /*
    Accounts are still listed by route — an account with nothing that can carry it has nothing to
    offer — but the COUNT is of every number it owns, because that is what the admin is checking
    the line against. Counting only the route-capable ones made an account with two numbers read
    "1 number(s)" and looked like half of it had gone missing.
  */
  const wabaOptions = Object.values(routeSenders.reduce((acc, s) => {
    if (!acc[s.waba_id]) {
      acc[s.waba_id] = { value: s.waba_id, label: `${s.waba_name || 'WABA'} - ${s.waba_id}`, onRoute: 0 };
    }
    acc[s.waba_id].onRoute++;
    return acc;
  }, {})).map(w => {
    const total = senders.filter(s => String(s.waba_id) === String(w.value)).length;
    return {
      ...w,
      sublabel: total === w.onRoute
        ? `${total} number${total === 1 ? '' : 's'}`
        : `${total} numbers · ${w.onRoute} on this route`,
    };
  });

  const activeWaba = draft.waba_id || chosenSender?.waba_id || wabaOptions[0]?.value || '';

  /*
    EVERY number on the chosen account, including the ones this route cannot carry.

    They used to be filtered out, on the reasoning that every option on screen should be able to
    send. That reasoning is right about what happens on SEND and wrong about what the admin is
    doing here: an account with two numbers showed one, with nothing saying the other existed, and
    the only reading available was that a number had been deleted or the panel was broken.

    So they are all listed, each saying which routes it can carry, and picking one that needs the
    other route moves the route with it — the same two-way link the account dropdown has. Nothing
    unsendable can be selected: a number with no credentials at all, or a deactivated one, is
    still disabled and still says why.
  */
  const otherRoute = draft.send_provider === 'netcore' ? 'meta' : 'netcore';
  const numberOptions = senders
    .filter(s => String(s.waba_id) === String(activeWaba))
    .map(s => {
      const onRoute = routeCapable(s);
      const onOther = canCarry(s, otherRoute);
      return {
        value: s.id,
        label: `${s.display_name || 'Business number'} (${s.business_number})`,
        sublabel: !s.ready ? 'no credentials saved'
          : s.is_active !== 1 ? 'deactivated'
          : onRoute ? (s.is_default === 1 ? 'default' : '')
          : `switches this campaign to ${otherRoute === 'netcore' ? 'Netcore' : 'Meta'}`,
        // Unusable only when it genuinely cannot send at all. Needing the other route is not a
        // reason to grey a number out, because choosing it fixes the route rather than failing.
        disabled: (!onRoute && !onOther) || !s.ready || s.is_active !== 1,
        offRoute: !onRoute && onOther,
        meta: s,
      };
    });

  /*
    Changing the route re-picks the account and the number underneath it.

    Those lists narrow to what the new route can carry, so a selection made under the old one may
    no longer be on screen — and an invisible selection is worse than none. Preference goes to the
    default number when it can carry the route, so the common single-number case needs no further
    clicks, then to any usable one.
  */
  const applySender = (pick) => {
    if (!pick) return;
    setField('sender_id', pick.id);
    setField('waba_id', pick.waba_id);
    setField('sender_label', pick.business_number);
    setField('sender_display_name', pick.display_name || 'Internship Studio');
  };

  /*
    Changing the route moves the account and the number under it to the ones this route is
    actually sent on — not merely to something capable.

    It re-picks even when the current number COULD carry the new route, which is the whole point
    of the request behind this: the number that holds the Netcore key can also send through Meta,
    so "leave it alone if it still works" left every Meta campaign on the Netcore account. The
    admin's own explicit pick afterwards is never overruled, because this only runs on a route
    change.
  */
  const onRouteChange = (route) => {
    setField('send_provider', route);
    applySender(preferredFor(route));
  };

  /*
    Picking an account can change the route, because the link runs both ways.

    The accounts are listed per route, so choosing one that cannot carry the current route is only
    possible when the route is wrong for it — a Meta-only account selected while the draft says
    Netcore. Silently keeping the route there produces a campaign that fails every recipient with
    nothing on screen to explain why, so the route follows the account instead. When the account
    can carry the current route, the route is left exactly as it is: the admin chose it.
  */
  const onWabaChange = (wabaId) => {
    setField('waba_id', wabaId);

    const onThisWaba = senders.filter(s => String(s.waba_id) === String(wabaId));
    const current = draft.send_provider === 'netcore' ? 'netcore' : 'meta';
    const other = current === 'netcore' ? 'meta' : 'netcore';
    const sentOn = (r) => onThisWaba.some(x => (r === 'netcore' ? x.last_sent_netcore : x.last_sent_meta));

    let route = current;
    // Cannot carry it at all, or has only ever been sent on the other one. The second clause is
    // what makes the two dropdowns agree: an account this business sends through Netcore should
    // say Netcore the moment it is chosen, even though its number could technically do Meta too.
    if (!onThisWaba.some(s => canCarry(s, current))
        || (!sentOn(current) && sentOn(other) && onThisWaba.some(s => canCarry(s, other)))) {
      if (onThisWaba.some(s => canCarry(s, other))) { route = other; setField('send_provider', other); }
    }

    // Numbers are per-WABA, so a stale selection from the previous account must not survive —
    // jump to that account's number for the route now in force.
    const pool = onThisWaba.filter(s => canCarry(s, route));
    const first = pool.find(s => s.ready && s.is_active === 1) || pool[0] || null;
    setField('sender_id', first ? first.id : null);
    if (first) {
      setField('sender_label', first.business_number);
      setField('sender_display_name', first.display_name || 'Internship Studio');
    }
  };

  const onNumberChange = (id, opt) => {
    setField('sender_id', id);
    if (!opt?.meta) return;
    setField('waba_id', opt.meta.waba_id);
    setField('sender_label', opt.meta.business_number);
    setField('sender_display_name', opt.meta.display_name || 'Internship Studio');
    /*
      A number that cannot carry the current route takes the route with it. The alternative is a
      campaign pinned to a route its own number has no credentials for, which fails every single
      recipient at send time with nothing on this screen having warned about it.
    */
    if (!routeCapable(opt.meta) && canCarry(opt.meta, otherRoute)) {
      setField('send_provider', otherRoute);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Campaign details</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>Provide basic details about your campaign</div>

        <div style={{ marginBottom: 16 }}>
          <label style={label}>Campaign name <span style={{ color: '#dc2626' }}>*</span></label>
          <input style={inp} value={draft.name} maxLength={100} onChange={e => setField('name', e.target.value)}
            placeholder="e.g. iCAT 174 exam reminder" />
          <div style={{ textAlign: 'right', fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>{(draft.name || '').length}/100</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={label}>Add tags <span style={{ fontWeight: 500, color: '#94a3b8' }}>(up to 5)</span></label>
          <TagPicker selected={draft.tags || []} onChange={v => setField('tags', v.slice(0, 5))} allTags={allTags} />
        </div>

        {/* Which number this goes out from. Two dropdowns rather than one, mirroring the Netcore
            panel: the WABA is the account, and the business numbers under it are what you
            actually choose between. */}
        {!settings ? (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading sending numbers…</div>
        ) : senders.length === 0 ? (
          <Notice tone="danger" title="No sending numbers configured">
            A WhatsApp campaign needs a business number with its own API key before it can send.
            <div style={{ marginTop: 6 }}>
              <button type="button" onClick={() => nav('/netcore/whatsapp/settings')}
                style={{ border: 'none', background: 'none', color: '#1e3a8a', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>
                Add one in WhatsApp settings →
              </button>
            </div>
          </Notice>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/*
              Which API carries this campaign — ALWAYS an explicit choice, never "whatever the
              number is set to".

              The old blank "Number default" option stored NULL, and the sender then read the
              number's CURRENT provider at send time. That is why a campaign built on Netcore went
              out through Meta: changing the number in WhatsApp settings silently re-routed every
              campaign that had been left on the default, including ones already scheduled. A
              campaign now carries its own route from the moment it is created, and nothing in
              settings can move it afterwards.

              Only the routes the chosen number can actually use are offered. A number with no
              Netcore API key cannot send through Netcore, and offering it is how you get a
              campaign that fails every recipient with nothing on screen to explain why.
            */}
            {senders.length > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Send through <span style={{ color: '#dc2626' }}>*</span></label>
                {/*
                  The same searchable control as the two fields below it, rather than a pair of
                  pills. Three controls that choose one thing each should look and behave alike,
                  and the sublabel is where each route can say which account it will land on —
                  which is the question the pills left the admin to answer by clicking and looking.
                */}
                <SearchableSelect
                  value={String(draft.send_provider || '')}
                  onChange={onRouteChange}
                  options={[
                    // Offered when ANY number can carry it, since the route is chosen before the
                    // number now and the lists below narrow to match.
                    { value: 'meta', label: 'Meta Cloud API', ok: senders.some(x => x.phone_number_id) },
                    { value: 'netcore', label: 'Netcore API', ok: senders.some(x => x.has_api_key) },
                  ]
                    .filter(o => o.ok || String(draft.send_provider || '') === o.value)
                    .map(o => {
                      const pick = preferredFor(o.value);
                      return {
                        value: o.value,
                        label: o.label,
                        sublabel: pick
                          ? `${pick.waba_name || 'WABA'} · ${pick.business_number}`
                          : 'no number set up for this route',
                        disabled: !o.ok,
                      };
                    })}
                  placeholder="Select how this campaign is sent"
                  searchPlaceholder="Search"
                />
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 6, lineHeight: 1.5 }}>
                  Fixed for this campaign — changing the number's provider in WhatsApp settings later
                  will not move it. Delivery route only: approved templates are always read from Meta,
                  since Netcore's API has no template endpoint. Choose <b>Netcore</b> if Meta rejects
                  sends with <b>#200</b> (your Meta app is not connected to this WhatsApp Business
                  Account).
                </div>
              </div>
            )}
            <div>
              <label style={label}>WABA ID <span style={{ color: '#dc2626' }}>*</span></label>
              <SearchableSelect
                value={activeWaba}
                onChange={onWabaChange}
                options={wabaOptions}
                placeholder="Select a WhatsApp Business Account"
                searchPlaceholder="Search"
              />
            </div>
            <div>
              <label style={label}>Business number <span style={{ color: '#dc2626' }}>*</span></label>
              <SearchableSelect
                value={draft.sender_id}
                onChange={onNumberChange}
                options={numberOptions}
                placeholder="Select"
                searchPlaceholder="Search"
                emptyText="No numbers on this account"
                renderRow={(o, isSel) => (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span>
                      <span style={{ display: 'block', fontWeight: isSel ? 700 : 600, color: o.disabled ? '#94a3b8' : '#0f172a', fontSize: 12.5 }}>
                        {o.meta.display_name || 'Business number'}
                      </span>
                      <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{o.meta.business_number}</span>
                      {/* Only for a number the current route cannot carry — it is about to change
                          the field above, and that must not happen silently. */}
                      {o.offRoute && (
                        <span style={{ display: 'block', fontSize: 10, color: '#b45309', marginTop: 2 }}>
                          {o.sublabel}
                        </span>
                      )}
                    </span>
                    {/*
                      Which routes this number can actually carry, shown on the row itself. The
                      provider is not a property of the WABA, it is a property of each number: one
                      account can hold a number with a Netcore key and another with only a Meta
                      phone number ID. Reading that off the row is what stops you picking a number
                      and then finding the route you wanted is not offered.
                    */}
                    <span style={{ flexShrink: 0, display: 'flex', gap: 4, alignItems: 'center' }}>
                      {!!o.meta.has_api_key && (
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 999, letterSpacing: '.3px', background: '#ede9fe', color: '#6d28d9' }}>NETCORE</span>
                      )}
                      {!!o.meta.phone_number_id && (
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 999, letterSpacing: '.3px', background: '#dbeafe', color: '#1d4ed8' }}>META</span>
                      )}
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, letterSpacing: '.3px',
                        background: o.meta.ready ? '#dcfce7' : '#fee2e2', color: o.meta.ready ? '#15803d' : '#dc2626' }}>
                        {o.meta.ready ? (o.meta.is_default === 1 ? 'DEFAULT' : 'READY') : 'NOT READY'}
                      </span>
                    </span>
                  </div>
                )}
              />
            </div>


            {chosenSender && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', border: `1.5px solid ${chosenSender.ready ? '#bbf7d0' : '#fecaca'}`, background: chosenSender.ready ? '#f0fdf4' : '#fef2f2', borderRadius: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      Sending as {chosenSender.display_name || 'this business'} ({chosenSender.business_number})
                      {' via '}
                      <span style={{ color: '#1e3a8a' }}>
                        {(draft.send_provider || chosenSender.provider || 'meta') === 'netcore' ? 'Netcore' : 'Meta'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: chosenSender.ready ? '#15803d' : '#dc2626', marginTop: 2 }}>
                      {chosenSender.ready
                        ? `Credentials set${chosenSender.quality_rating ? ` · quality ${chosenSender.quality_rating}` : ''}${chosenSender.messaging_limit ? ` · ${chosenSender.messaging_limit}` : ''}`
                        : ((chosenSender.provider === 'netcore')
                            ? 'This number has no Netcore API key — campaigns cannot send from it'
                            : 'This number has no phone number ID — campaigns cannot send from it')}
                    </div>
                  </div>
                  <button type="button" onClick={() => nav('/netcore/whatsapp/settings')}
                    style={{ padding: '7px 14px', border: '1.5px solid #e2e8f0', background: '#fff', borderRadius: 7, fontSize: 11.5, fontWeight: 700, color: '#1e3a8a', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                    Manage
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Deduplication ──────────────────────────────────────────────────────────────── */}
      <div style={{ ...card, borderColor: draft.dedup_enabled ? '#bbf7d0' : '#e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Deduplication</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2, lineHeight: 1.5 }}>
              Avoid duplicate communication to contacts. Skip anyone who has already received a WhatsApp
              message inside the window you choose.
            </div>
          </div>
          <Toggle on={draft.dedup_enabled} onClick={() => setField('dedup_enabled', !draft.dedup_enabled)} />
        </div>

        {/* Stated unconditionally, because it is: the same number selected through three
            different segments is one row in the recipient table, enforced by a unique key. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={WA.greenDark} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.55 }}>
            <b>Always on:</b> within a single campaign a contact can only ever be messaged once, even if
            they appear in several of the segments and lists you select. The setting above is the extra
            rule that looks <i>across</i> your past campaigns.
          </div>
        </div>

        {draft.dedup_enabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
            <div>
              <label style={label}>Don't message again within</label>
              <SearchableSelect
                value={draft.dedup_window_hours}
                onChange={v => setField('dedup_window_hours', v)}
                options={WINDOW_OPTIONS}
                searchPlaceholder="Search windows…"
                placeholder="Choose a window"
              />
            </div>
            <div>
              <label style={label}>Compare against</label>
              <SearchableSelect
                value={draft.dedup_scope}
                onChange={v => setField('dedup_scope', v)}
                options={SCOPE_OPTIONS}
                searchPlaceholder="Search…"
                placeholder="Choose a scope"
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Notice tone="success">
                Contacts skipped by this rule are counted and reported — the Audience step shows the
                live number before you send, and the campaign list shows it afterwards under <b>Deduped</b>.
                {Number(draft.audience_stats?.dedup_skipped) > 0 && (
                  <> Right now this would skip <b>{n0(draft.audience_stats.dedup_skipped)}</b> contact(s).</>
                )}
              </Notice>
            </div>
          </div>
        )}
      </div>

      {/* ── Conversion goal ────────────────────────────────────────────────────────────── */}
      <div style={{ ...card, borderColor: draft.goal_enabled ? '#bbf7d0' : '#e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Conversion goal</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
              Count how many people did something after receiving this campaign.
            </div>
          </div>
          <Toggle on={draft.goal_enabled} onClick={() => setField('goal_enabled', !draft.goal_enabled)} />
        </div>

        {draft.goal_enabled && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 200px', gap: 14, alignItems: 'start' }}>
              <div>
                <label style={label}>Goal event</label>
                {/* Same ALL_EVENTS list the segment builder and the email wizard use, so
                    "signin" means one thing across the whole panel. */}
                <SearchableSelect
                  value={draft.goal_event_name}
                  onChange={v => setField('goal_event_name', v)}
                  options={ALL_EVENTS.map(e => ({ value: e.key, label: e.label, sublabel: e.key }))}
                  placeholder="Select the event that counts as a conversion"
                  searchPlaceholder="Search events…"
                />
              </div>
              <div>
                <label style={label}>Window (days)</label>
                <input type="number" min={1} max={90} style={inp} value={draft.goal_window_days}
                  onChange={e => setField('goal_window_days', e.target.value)} />
              </div>
            </div>

            {/*
              No attribution-mode choice here, deliberately — email does not ask it either, and a
              conversion should mean one thing across both channels. A recipient counts when they
              tapped the button in the message and then completed the goal; the window runs from
              the tap, so closing the browser and returning days later still counts.

              The destination is a property of the TEMPLATE (its button already has a link), so it
              is set once on the template rather than re-asked on every campaign.
            */}
            <Notice tone="info" style={{ marginTop: 14 }}>
              Attributed exactly like email: the button tap is recorded, the visitor arrives carrying
              this campaign, and the goal is credited when they complete it — even days later, in a
              new session. Requires the template button to use a tracked URL; set that on the
              template itself.
            </Notice>
          </div>
        )}
      </div>

      {/* ── UTM tracking ───────────────────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Google Analytics tracking</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
              URL parameters recorded against this campaign for reporting.
            </div>
          </div>
          <Toggle on={draft.ga_enabled} onClick={() => setField('ga_enabled', !draft.ga_enabled)} />
        </div>
        {draft.ga_enabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
            <div><label style={label}>Source (utm_source)</label><input style={inp} value={draft.ga_source} onChange={e => setField('ga_source', e.target.value)} /></div>
            <div><label style={label}>Medium (utm_medium)</label><input style={inp} value={draft.ga_medium} onChange={e => setField('ga_medium', e.target.value)} /></div>
            <div><label style={label}>Campaign (utm_campaign)</label><input style={inp} value={draft.ga_campaign || draft.name} onChange={e => setField('ga_campaign', e.target.value)} /></div>
            <div><label style={label}>Content (utm_content)</label><input style={inp} value={draft.ga_content} onChange={e => setField('ga_content', e.target.value)} placeholder="Ex: Sale" /></div>
            <div><label style={label}>Term (utm_term)</label><input style={inp} value={draft.ga_term} onChange={e => setField('ga_term', e.target.value)} /></div>
          </div>
        )}
        <div style={{ fontSize: 10.5, color: '#c2410c', background: '#fff7ed', borderRadius: 6, padding: '6px 10px', marginTop: 14 }}>
          Stored against the campaign for reference — these values are not appended to template button links automatically.
        </div>
      </div>
    </div>
  );
}
