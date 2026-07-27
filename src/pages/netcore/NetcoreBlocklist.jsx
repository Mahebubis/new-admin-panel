import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import NetcoreListContacts from './NetcoreListContacts';
import ContactLogs from './ContactLogs';
import ImportContactsWizard from './ImportContactsWizard';

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

export function NetcoreBlocklist() {
  const id = useBlocklistId();
  if (!id) return <Spinner />;
  return (
    <NetcoreListContacts
      idOverride={id}
      basePath="/netcore/blocklist"
      importPath="/netcore/blocklist/import"
      titleOverride="Blocklist"
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
