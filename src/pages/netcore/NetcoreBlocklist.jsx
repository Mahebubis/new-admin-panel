import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import NetcoreListContacts from './NetcoreListContacts';
import ContactLogs from './ContactLogs';
import ImportContactsWizard from './ImportContactsWizard';
import WaBlocklist from './WaBlocklist';

const API = '/api/lists/lists.php';
const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

/*
 * Blocklist reuses every piece of the Lists feature (contact table, CSV
 * import wizard, contact logs) unchanged — it's just another row in
 * campaign_lists (kind='blocklist'), pinned via idOverride/listIdOverride
 * instead of a route :id param, since there's only ever one blocklist
 * (see lists_get_or_create_blocklist_id() in lists/lib/schema.php).
 */
function useBlocklistId() {
  const [id, setId] = useState(null);
  // Guards against React StrictMode's dev-only double-mount (which would otherwise fire this
  // twice on every page load in development) — harmless in production either way, but this
  // keeps dev network logs honest and avoids the redundant round-trip.
  const fetched = useRef(false);
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    (async () => {
      const res = await api.post(API, new URLSearchParams({ action: 'get_or_create_blocklist' }), FORM);
      if (res.data.success) setId(res.data.data.id);
    })();
  }, []);
  return id;
}

function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
    <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', border: '3px solid #c4b5fd', borderTopColor: '#4f46e5', animation: 'nc_spin 0.85s linear infinite' }} />
  </div>;
}

/*
 * Two channels, one screen.
 *
 * A blocklist is answering one question — "who must we never contact again?" — and the answer
 * used to live in two unrelated places: email suppression here, and WhatsApp opt-outs buried in
 * the consent table on the Settings page, where nobody looked. They are different stores for
 * good reason (one keys on an address, the other on a number, and neither identifies the same
 * person reliably), but they belong behind the same door.
 *
 * The tab is in the URL (?channel=whatsapp) so it survives a reload and can be linked to.
 */
const TAB_CSS = `
.nbl-tabs { display: flex; gap: 2px; border-bottom: 1px solid #e4e7ec; margin-bottom: 18px; }
.nbl-tab {
  position: relative; display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 16px; border: 0; background: none; cursor: pointer;
  font-family: inherit; font-size: 13.5px; font-weight: 650; color: #667085;
  border-radius: 8px 8px 0 0;
  transition: color 160ms cubic-bezier(.4,0,.2,1), background 160ms cubic-bezier(.4,0,.2,1);
}
.nbl-tab:hover { color: #344054; background: #f9fafb; }
.nbl-tab:focus-visible { outline: 2px solid #4f46e5; outline-offset: -2px; }
.nbl-tab[aria-selected="true"] { color: #101828; }
/* The underline is a separate element so it can slide/grow rather than snap on. */
.nbl-tab::after {
  content: ''; position: absolute; left: 10px; right: 10px; bottom: -1px; height: 2px;
  border-radius: 2px 2px 0 0; background: currentColor; transform: scaleX(0); transform-origin: center;
  transition: transform 200ms cubic-bezier(.4,0,.2,1);
}
.nbl-tab[aria-selected="true"]::after { transform: scaleX(1); }
.nbl-tab[data-ch="email"][aria-selected="true"]    { color: #4f46e5; }
.nbl-tab[data-ch="whatsapp"][aria-selected="true"] { color: #128C7E; }
.nbl-panel { animation: nbl-fade 200ms cubic-bezier(.4,0,.2,1); }
@keyframes nbl-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
`;

const MailGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.8" y="5" width="18.4" height="14" rx="2.2" /><path d="m3.4 7 8.6 6 8.6-6" />
  </svg>
);
const WaGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.02a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.79 9.79 0 0 1-1.5-5.22c0-5.41 4.4-9.81 9.82-9.81a9.75 9.75 0 0 1 6.94 2.88 9.74 9.74 0 0 1 2.87 6.94c0 5.41-4.4 9.81-9.81 9.81M20.52 3.45A11.66 11.66 0 0 0 12.05 0C5.6 0 .35 5.25.35 11.7c0 2.06.54 4.08 1.56 5.85L.25 24l6.59-1.73a11.66 11.66 0 0 0 5.2 1.24h.01c6.45 0 11.7-5.25 11.7-11.7 0-3.13-1.22-6.07-3.43-8.28" />
  </svg>
);

export function NetcoreBlocklist() {
  const [params, setParams] = useSearchParams();
  const channel = params.get('channel') === 'whatsapp' ? 'whatsapp' : 'email';
  const setChannel = ch => setParams(ch === 'email' ? {} : { channel: ch }, { replace: true });

  return (
    /* height:100% + a flex column because the email panel (NetcoreListContacts) is itself a
       full-height flex layout with its own internal scroll — without this it collapses to nothing. */
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{TAB_CSS}</style>

      <div style={{ padding: '20px 24px 0', flex: 'none' }}>
        <h1 style={{ fontSize: 20, fontWeight: 750, color: '#101828', margin: '0 0 4px' }}>Blocklist</h1>
        <p style={{ fontSize: 13, color: '#667085', margin: '0 0 14px', maxWidth: 640, lineHeight: 1.55 }}>
          People who must never be contacted again. Both lists are enforced at send time — on campaigns
          and on journeys — so a blocked contact is skipped no matter which segment or list they sit in.
        </p>

        <div className="nbl-tabs" style={{ marginBottom: 0 }} role="tablist" aria-label="Blocklist channel">
          <button role="tab" data-ch="email" aria-selected={channel === 'email'}
                  className="nbl-tab" onClick={() => setChannel('email')}>
            <MailGlyph /> Email
          </button>
          <button role="tab" data-ch="whatsapp" aria-selected={channel === 'whatsapp'}
                  className="nbl-tab" onClick={() => setChannel('whatsapp')}>
            <WaGlyph /> WhatsApp
          </button>
        </div>
      </div>

      {/* keyed on channel so the panel remounts and replays its enter animation */}
      <div className="nbl-panel" role="tabpanel" key={channel}
           style={{ flex: 1, minHeight: 0, overflow: channel === 'email' ? 'hidden' : 'auto' }}>
        {channel === 'email'
          ? <EmailBlocklist />
          : <div style={{ padding: '20px 24px 32px' }}><WaBlocklist /></div>}
      </div>
    </div>
  );
}

function EmailBlocklist() {
  const id = useBlocklistId();
  if (!id) return <Spinner />;
  return (
    <NetcoreListContacts
      idOverride={id}
      basePath="/netcore/blocklist"
      importPath="/netcore/blocklist/import"
      /* The page header above already says "Blocklist"; this one carries the count and the
         channel, so the two read as heading and sub-heading rather than as a repeat. */
      titleOverride="Blocked email addresses"
      isBlocklist
    />
  );
}

export function BlocklistLogs() {
  const id = useBlocklistId();
  if (!id) return <Spinner />;
  return <ContactLogs basePath="/netcore/blocklist" listId={id} />;
}

export function BlocklistImport() {
  const id = useBlocklistId();
  if (!id) return <Spinner />;
  return <ImportContactsWizard basePath="/netcore/blocklist" listIdOverride={id} />;
}
