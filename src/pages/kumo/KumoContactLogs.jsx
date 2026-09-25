/*
 * Kumo — Contact logs.
 *
 * Laid out like the Netcore contact-upload log (src/pages/netcore/ContactLogs.jsx)
 * but reading KUMO'S OWN history: kapi('import_logs') over kumo_imports, written by
 * kumo.php at the end of every CSV run. Netcore's campaign_contact_uploads rows are
 * deliberately NOT shown here — a CSV imported into a Netcore list never went into
 * kumo_contacts, so listing it would claim contacts this platform does not have.
 *
 * Kumo imports are synchronous: a row only ever appears already finished, so there
 * is no progress percentage and no 5-second poll. Counts are the breakdown the
 * importer returns — imported / invalid / suppressed.
 *
 * Reached from the Lists toolbar ("Contact logs") at /kumo/lists/logs.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  KumoStyles, Btn, Card, Pill, Empty, Pagination, SearchInput, Spinner, Skel, nf, fmtDt, kapi,
} from './kumoShared';

const CSS = `
.kmb, .kmb *, .kmb *::before, .kmb *::after { box-sizing: border-box; }
.kmb { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; }

.kmb-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.kmb-back { display: inline-flex; align-items: center; gap: 11px; }
.kmb-title { margin: 0; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -.3px; }
.kmb-title span { font-weight: 600; color: #64748b; }
.kmb-sub { font-size: 12.5px; color: #64748b; margin-top: 4px; max-width: 680px; line-height: 1.6; }
.kmb-tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

.kmb-panel { position: relative; background: #fff; border-radius: 10px; border: 1px solid #e6e8f2;
  box-shadow: 0 1px 3px rgba(15,23,42,.06); overflow: hidden; }
.kmb-veil { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.85); }
.kmb-scroll { overflow: auto; max-height: 62vh; }
.kmb-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
.kmb-scroll::-webkit-scrollbar-thumb { background: rgba(15,23,42,.18); border-radius: 8px; border: 2px solid transparent; background-clip: content-box; }
.kmb-scroll::-webkit-scrollbar-track { background: transparent; }

.kmb-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.kmb-table thead th { position: sticky; top: 0; z-index: 2; background: #f8fafc; text-align: left;
  padding: 12px 16px; font-size: 11.5px; font-weight: 700; color: #475569;
  border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
.kmb-table tbody td { padding: 11px 16px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
.kmb-table tbody tr { transition: background .16s; }
.kmb-table tbody tr:hover td { background: #f5f3ff; }
.kmb-table tbody tr:last-child td { border-bottom: 0; }
.kmb-file { color: #1e3a8a; font-weight: 600; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kmb-file a { color: inherit; text-decoration: none; }
.kmb-file a:hover { text-decoration: underline; }
.kmb-dim { color: #94a3b8; white-space: nowrap; }
.kmb-mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11.5px; color: #64748b; }

.kmb-fail { border: 0; background: none; cursor: pointer; color: #dc2626; font: 800 12px/1 'Plus Jakarta Sans', sans-serif;
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 2px; border-radius: 8px; transition: opacity .16s; }
.kmb-fail:hover { opacity: .75; }

.kmb-panel-fade { animation: kmb-fade 220ms cubic-bezier(.22,1,.36,1) both; }
@keyframes kmb-fade { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }

@media (max-width: 720px) {
  .kmb-title { font-size: 19px; }
  .kmb-tools { justify-content: flex-start; }
}
`;

const IconBack = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const IconRefresh = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5M3 21v-5h5" />
  </svg>
);
const IconUpload = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 9l5-5 5 5" /><path d="M12 4v12" />
  </svg>
);
const IconAlert = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
  </svg>
);

function StatusPill({ status }) {
  if (status === 'processed') return <Pill tone="green">Processed</Pill>;
  if (status === 'failed') return <Pill tone="red">Failed</Pill>;
  return <Pill tone="slate">{String(status || 'unknown')}</Pill>;
}

export default function KumoContactLogs() {
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [dq, setDq] = useState('');

  /* typing shouldn't fire a request per keystroke */
  useEffect(() => {
    const t = setTimeout(() => setDq(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const d = await kapi('import_logs', { page, per_page: perPage, search: dq });
      setRows(Array.isArray(d.logs) ? d.logs : []);
      setTotal(Number(d.total || 0));
    } catch (e) {
      setError(e.message || 'Could not load the import log');
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, dq]);

  useEffect(() => { load(); }, [load]);

  const onSearch = (v) => { setSearch(v); setPage(1); };

  return (
    <div className="km km-page kmb">
      <KumoStyles />
      <style>{CSS}</style>

      <div className="kmb-head">
        <div className="kmb-back">
          <Btn variant="ghost" size="sm" onClick={() => nav('/kumo/lists')} aria-label="Back to lists" icon={<IconBack />} />
          <div>
            <h1 className="kmb-title">Contact logs <span>({nf(total)})</span></h1>
            <div className="kmb-sub">
              Every CSV imported into Kumo, with the row breakdown the importer reported.
              Imports made in Netcore are not listed here — they never entered Kumo's contact store.
            </div>
          </div>
        </div>
        <div className="kmb-tools">
          <SearchInput value={search} onChange={onSearch} placeholder="Search a file name…" width={230} />
          <Btn variant="ghost" size="sm" loading={loading} onClick={load} icon={<IconRefresh />}>Refresh</Btn>
        </div>
      </div>

      {error && (
        <Card style={{ marginBottom: 12, borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#b91c1c', fontWeight: 600, fontSize: 13 }}>
            <IconAlert /> {error}
          </div>
        </Card>
      )}

      <div className="kmb-panel kmb-panel-fade">
        {loading && rows.length > 0 && <div className="kmb-veil"><Spinner size={28} /></div>}

        {loading && rows.length === 0 ? (
          <div style={{ display: 'grid', gap: 8, padding: 14 }}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <Skel key={i} h={38} r={10} />)}
          </div>
        ) : rows.length === 0 ? (
          <Empty
            icon={<IconUpload />}
            title={dq ? 'Nothing matched' : 'No imports yet'}
            sub={dq
              ? 'No import job has a file name like that. Try a shorter search.'
              : 'Import a CSV into a Kumo list and the run shows up here with its row breakdown.'}
            action={dq
              ? <Btn variant="ghost" onClick={() => { setSearch(''); setDq(''); setPage(1); }}>Clear search</Btn>
              : <Btn onClick={() => nav('/kumo/lists')}>Go to lists</Btn>}
          />
        ) : (
          <div className="kmb-scroll">
            <table className="kmb-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>File name</th>
                  <th>Status</th>
                  <th>Imported on</th>
                  <th>List</th>
                  <th>Rows</th>
                  <th>Added</th>
                  <th>Skipped</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="kmb-mono">{r.id}</td>
                    <td className="kmb-file" title={r.file_name || ''}>{r.file_name || '—'}</td>
                    <td><StatusPill status={r.status} /></td>
                    <td className="kmb-dim">{r.created_at ? fmtDt(r.created_at) : '—'}</td>
                    <td>{r.list_name || (Number(r.as_blocklist) === 1 ? 'Blocklist' : '—')}</td>
                    <td className="kmb-mono">{nf(r.total_rows)}</td>
                    <td className="kmb-mono" style={{ color: '#15803d', fontWeight: 700 }}>{nf(r.imported)}</td>
                    <td>
                      {/* invalid = not an email address; suppressed = already blocked */}
                      {Number(r.invalid) + Number(r.suppressed) > 0 ? (
                        <span title={`${nf(r.invalid)} invalid, ${nf(r.suppressed)} already suppressed`}
                          style={{ color: '#b45309', fontWeight: 700 }}>
                          {nf(Number(r.invalid) + Number(r.suppressed))}
                        </span>
                      ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td className="kmb-dim">{r.created_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        onPage={setPage}
        onPerPage={(n) => { setPerPage(n); setPage(1); }}
        sizes={[10, 25, 50, 100]}
      />

      <div style={{ height: 20 }} />
    </div>
  );
}
