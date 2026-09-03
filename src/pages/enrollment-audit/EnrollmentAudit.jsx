// ===========================================================================
//  EnrollmentAudit.jsx - cross-check a Learnyst enrollment export against the
//  live database.
//
//  Upload .xlsx / .xls / .csv -> pick the sheet and the two columns (Learner
//  Details = email, Product title) -> Proceed. The file is parsed in the
//  browser, deduped to one entry per email, and sent to the API in packets of
//  10,000 emails. Two answers come back and become two downloadable sheets:
//
//    1. not-in-users.xlsx        emails with no row in `users`
//    2. resume-building-no-store-order.xlsx
//                                emails whose Product title matched the
//                                resume-building term, that DO exist in
//                                `users`, but whose user_id has no
//                                ninety_nine_store_orders row
//
//  SheetJS is pulled from the CDN on demand (same as Purchased Starter Kit)
//  rather than bundled - it is only needed on this page.
// ===========================================================================
import { useState, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import {
  UploadCloud, FileSpreadsheet, Download, RotateCcw, Play, X,
  CheckCircle2, AlertTriangle, Users, ShoppingCart,
} from 'lucide-react';
import api from '../../api/axios';

const API = '/api/enrollment-audit/enrollment_audit.php';

/* One request per 10,000 emails, as asked. The endpoint refuses anything
   above 20,000, so this stays well inside its own guard. */
const PACKET_SIZE = 10000;

/* Product titles are prose typed by whoever set the course up, so the match is
   "contains", case- and spacing-insensitive. Editable on the page because the
   exact wording ("Resume Building", "Resume Building Course") varies. */
const DEFAULT_TERM = 'resume building';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const fmt = n => Number(n || 0).toLocaleString('en-IN');

const stamp = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

/* SheetJS on demand - reads the upload and writes the two result files. */
async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the spreadsheet library'));
    document.head.appendChild(s);
  });
  if (!window.XLSX) throw new Error('Could not load the spreadsheet library');
  return window.XLSX;
}

/* Header names first; if the sheet has none we recognise, fall back to whichever
   column actually holds email addresses. */
function guessEmailCol(headers, body) {
  const byName = headers.findIndex(h => /learner\s*detail|e-?mail/i.test(h));
  if (byName !== -1) return byName;
  const sample = body.slice(0, 200);
  let best = -1, bestHits = 0;
  for (let c = 0; c < headers.length; c++) {
    let hits = 0;
    for (const r of sample) if (EMAIL_RE.test(String(r[c] ?? '').trim())) hits++;
    if (hits > bestHits) { bestHits = hits; best = c; }
  }
  return bestHits ? best : -1;
}

const guessProductCol = headers =>
  headers.findIndex(h => /product\s*title|course\s*name|^product$|^course$/i.test(h));

/* ─── shared styles ─── */
const card = {
  background: '#fff', border: '1px solid #ede9fe', borderRadius: 12,
  padding: 20, marginBottom: 18, boxShadow: '0 1px 2px rgba(16,24,40,.04)',
};
const cardTitle = {
  display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700,
  color: '#1e1b4b', marginBottom: 4,
};
const hint = { fontSize: 12, color: '#64748b', marginBottom: 14 };
const label = { display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.3px' };
const input = {
  width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 13, color: '#334155', background: '#fff', outline: 'none',
};
const btn = (bg, fg = '#fff') => ({
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px',
  background: bg, color: fg, border: bg === '#fff' ? '1px solid #e2e8f0' : 'none',
  borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
});
const thS = {
  color: '#fff', fontSize: 11, fontWeight: 600, padding: '10px 12px', textAlign: 'left',
  textTransform: 'uppercase', letterSpacing: '.3px', borderRight: '1px solid rgba(255,255,255,.15)',
  whiteSpace: 'nowrap',
};
const tdS = { padding: '8px 12px', borderBottom: '1px solid #f5f3ff', color: '#334155', fontSize: 12 };

function Stat({ icon, label: text, value, tone = '#4c1d95' }) {
  return (
    <div style={{
      flex: '1 1 150px', minWidth: 150, background: '#faf9ff', border: '1px solid #ede9fe',
      borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px' }}>
        {icon}{text}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone, marginTop: 4 }}>{fmt(value)}</div>
    </div>
  );
}

export default function EnrollmentAudit() {
  const [fileName, setFileName] = useState('');
  const [sheetNames, setSheetNames] = useState([]);
  const [sheet, setSheet] = useState('');
  const [headers, setHeaders] = useState([]);
  const [body, setBody] = useState([]);
  const [emailCol, setEmailCol] = useState(-1);
  const [productCol, setProductCol] = useState(-1);
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [matchEmailOrders, setMatchEmailOrders] = useState(false);
  const [onlySuccess, setOnlySuccess] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const wbRef = useRef(null);      // parsed workbook, so switching sheets is instant
  const snapRef = useRef(null);    // the email map as it was when Proceed was pressed
  const fileRef = useRef(null);

  /* One entry per email; the resume flag is OR-ed across that email's rows, so a
     learner enrolled in several courses still counts once and still counts as
     resume-building if any one of those rows is. */
  const built = useMemo(() => {
    const map = new Map();
    let invalid = 0, blank = 0;
    if (emailCol < 0) return { map, invalid, blank, resume: 0 };
    const needle = norm(term);
    for (const r of body) {
      const email = String(r[emailCol] ?? '').trim().toLowerCase();
      if (!email) { blank++; continue; }
      if (!EMAIL_RE.test(email)) { invalid++; continue; }
      const product = productCol >= 0 ? String(r[productCol] ?? '').trim() : '';
      const isResume = needle !== '' && norm(product).includes(needle);
      const cur = map.get(email);
      if (cur) {
        if (product) cur.products.add(product);
        cur.resume = cur.resume || isResume;
      } else {
        map.set(email, { products: new Set(product ? [product] : []), resume: isResume });
      }
    }
    let resume = 0;
    for (const v of map.values()) if (v.resume) resume++;
    return { map, invalid, blank, resume };
  }, [body, emailCol, productCol, term]);

  const packetCount = Math.max(1, Math.ceil(built.map.size / PACKET_SIZE));

  /* ─── file handling ─── */
  const applySheet = (wb, name) => {
    const XLSX = window.XLSX;
    const ws = wb.Sheets[name];
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
    const head = (grid[0] || []).map(h => String(h ?? '').trim());
    const rows = grid.slice(1);
    setHeaders(head);
    setBody(rows);
    setEmailCol(guessEmailCol(head, rows));
    setProductCol(guessProductCol(head));
    setSheet(name);
  };

  const readFile = async (file) => {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      return toast.error('Upload a .xlsx, .xls or .csv file');
    }
    setParsing(true);
    setResult(null);
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      if (!wb.SheetNames.length) throw new Error('The file has no sheets');
      wbRef.current = wb;
      setFileName(file.name);
      setSheetNames(wb.SheetNames);
      /* Prefer the first sheet that actually has rows - these exports often
         carry an empty Sheet2 alongside the data. Read from the declared range
         rather than converting every sheet, which on a 200k-row export would
         mean parsing the whole thing twice. */
      const firstWithRows = wb.SheetNames.find(n => {
        const ref = wb.Sheets[n]?.['!ref'];
        return ref && XLSX.utils.decode_range(ref).e.r > 0;
      }) || wb.SheetNames[0];
      applySheet(wb, firstWithRows);
    } catch (e) {
      toast.error(e.message || 'Could not read that file');
    } finally {
      setParsing(false);
    }
  };

  const reset = () => {
    wbRef.current = null; snapRef.current = null;
    setFileName(''); setSheetNames([]); setSheet(''); setHeaders([]); setBody([]);
    setEmailCol(-1); setProductCol(-1); setResult(null);
    setProgress({ done: 0, total: 0 });
  };

  /* ─── the run ─── */
  const proceed = async () => {
    if (emailCol < 0) return toast.error('Pick the column that holds the email address');
    if (!built.map.size) return toast.error('No valid email addresses found in this sheet');

    snapRef.current = new Map(built.map);
    const packets = chunk([...built.map.entries()], PACKET_SIZE);

    const acc = {
      checked: 0, skipped: 0, inUsers: 0, notInUsers: [],
      resumeTotal: 0, resumeInUsers: 0, resumeNotRegistered: [], resumeNoOrder: [],
      partial: false, packets: packets.length,
    };

    setRunning(true);
    setResult(null);
    setProgress({ done: 0, total: packets.length });

    try {
      for (let i = 0; i < packets.length; i++) {
        const rows = packets[i].map(([e, v]) => ({ e, r: v.resume ? 1 : 0 }));
        let res;
        try {
          res = await api.post(API, {
            action: 'audit_batch',
            rows,
            match_email_orders: matchEmailOrders ? 1 : 0,
            only_success: onlySuccess ? 1 : 0,
          }, { timeout: 180000 });
        } catch (err) {
          throw new Error(err.response?.data?.message || err.message || 'Request failed');
        }
        if (!res.data?.success) throw new Error(res.data?.message || 'The server rejected a packet');

        const d = res.data.data || {};
        acc.checked += d.checked || 0;
        acc.skipped += d.skipped || 0;
        acc.inUsers += d.in_users || 0;
        acc.resumeTotal += d.resume_total || 0;
        acc.resumeInUsers += d.resume_in_users || 0;
        acc.notInUsers.push(...(d.not_in_users || []));
        acc.resumeNotRegistered.push(...(d.resume_not_registered || []));
        acc.resumeNoOrder.push(...(d.resume_no_order || []));

        setProgress({ done: i + 1, total: packets.length });
      }
      setResult({ ...acc });
      toast.success(`Checked ${fmt(acc.checked)} email(s) in ${packets.length} packet(s)`);
    } catch (e) {
      /* Whatever completed is still worth keeping - the packets are independent,
         so a partial result is a real answer for the emails already checked. */
      acc.partial = true;
      setResult({ ...acc });
      toast.error(e.message || 'The audit stopped early');
    } finally {
      setRunning(false);
    }
  };

  /* ─── downloads ─── */
  const productsFor = email => {
    const v = snapRef.current?.get(email);
    return v ? [...v.products].join(' | ') : '';
  };

  const saveSheet = async (rows, sheetName, fileBase) => {
    if (!rows.length) return toast.error('Nothing to download for this list');
    try {
      const XLSX = await loadXLSX();
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
      XLSX.writeFile(wb, `${fileBase}_${stamp()}.xlsx`);
      toast.success(`Downloaded ${fmt(rows.length)} row(s)`);
    } catch {
      toast.error('Excel export failed');
    }
  };

  const downloadNotInUsers = () => saveSheet(
    result.notInUsers.map(e => ({
      'Email': e,
      'Product Title(s)': productsFor(e),
      'In Users Table': 'No',
    })),
    'Not In Users', 'not_in_users',
  );

  const downloadResumeNoOrder = () => saveSheet(
    result.resumeNoOrder.map(r => ({
      'Email': r.email,
      'User ID': r.user_id,
      'Product Title(s)': productsFor(r.email),
      'Store Order': 'Not found',
    })),
    'No Store Order', 'resume_building_no_store_order',
  );

  const downloadResumeUnregistered = () => saveSheet(
    result.resumeNotRegistered.map(e => ({
      'Email': e,
      'Product Title(s)': productsFor(e),
      'In Users Table': 'No',
    })),
    'Resume - Not Registered', 'resume_building_not_registered',
  );

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div style={{ padding: 22, maxWidth: 1180, margin: '0 auto' }}>
      <Helmet><title>Enrollment Audit | CIT Admin</title></Helmet>

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e1b4b', margin: 0 }}>Enrollment Audit</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '5px 0 0' }}>
          Upload a Learnyst enrollment export and check every learner against the database.
          Emails are sent {fmt(PACKET_SIZE)} at a time.
        </p>
      </div>

      {/* ── 1. upload ───────────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardTitle}><UploadCloud size={16} /> 1 &nbsp;Upload the file</div>
        <div style={hint}>Excel (.xlsx / .xls) or CSV. The file is read in your browser - only the email addresses are sent to the server.</div>

        {!fileName ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#7c3aed' : '#ddd6fe'}`, borderRadius: 12,
              padding: '34px 20px', textAlign: 'center', cursor: 'pointer',
              background: dragOver ? '#faf5ff' : '#fcfcff',
            }}
          >
            <FileSpreadsheet size={30} color="#7c3aed" />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#3730a3', marginTop: 10 }}>
              {parsing ? 'Reading the file…' : 'Drop the sheet here, or click to browse'}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>.xlsx, .xls or .csv</div>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10,
          }}>
            <FileSpreadsheet size={18} color="#7c3aed" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#3730a3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {fmt(body.length)} row(s) · {fmt(built.map.size)} unique email(s)
                {built.invalid ? ` · ${fmt(built.invalid)} unreadable` : ''}
              </div>
            </div>
            <button onClick={reset} disabled={running} style={{ ...btn('#fff', '#475569'), padding: '7px 12px' }}>
              <X size={14} /> Remove
            </button>
          </div>
        )}
        <input
          ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; readFile(f); }}
        />
      </div>

      {/* ── 2. map + options ────────────────────────────────────────── */}
      {!!headers.length && (
        <div style={card}>
          <div style={cardTitle}><CheckCircle2 size={16} /> 2 &nbsp;Confirm the columns</div>
          <div style={hint}>Guessed from the header row - change them if the guess is wrong.</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 14 }}>
            {sheetNames.length > 1 && (
              <div style={{ flex: '1 1 180px' }}>
                <label style={label}>Sheet</label>
                <select style={input} value={sheet} disabled={running}
                  onChange={e => applySheet(wbRef.current, e.target.value)}>
                  {sheetNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
            <div style={{ flex: '1 1 220px' }}>
              <label style={label}>Email column</label>
              <select style={input} value={emailCol} disabled={running}
                onChange={e => setEmailCol(Number(e.target.value))}>
                <option value={-1}>— select —</option>
                {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label style={label}>Product title column</label>
              <select style={input} value={productCol} disabled={running}
                onChange={e => setProductCol(Number(e.target.value))}>
                <option value={-1}>— none —</option>
                {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label style={label}>Resume-building title contains</label>
              <input style={input} value={term} disabled={running}
                onChange={e => setTerm(e.target.value)} placeholder={DEFAULT_TERM} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
              <input type="checkbox" checked={matchEmailOrders} disabled={running}
                onChange={e => setMatchEmailOrders(e.target.checked)} />
              Also count a store order matched by email
              <span style={{ color: '#94a3b8' }}>(guest checkouts have no user_id)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
              <input type="checkbox" checked={onlySuccess} disabled={running}
                onChange={e => setOnlySuccess(e.target.checked)} />
              Only count orders with status = success
            </label>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <Stat icon={<Users size={13} />} label="Unique emails" value={built.map.size} />
            <Stat icon={<FileSpreadsheet size={13} />} label={`"${term || '—'}" rows`} value={built.resume} tone="#b45309" />
            <Stat icon={<AlertTriangle size={13} />} label="Unreadable emails" value={built.invalid} tone="#be123c" />
            <Stat icon={<Play size={13} />} label="Packets to send" value={packetCount} tone="#0f766e" />
          </div>

          {/* first few rows, so a wrong column mapping is obvious before sending */}
          {emailCol >= 0 && !!body.length && (
            <div style={{ overflowX: 'auto', border: '1px solid #ede9fe', borderRadius: 10, marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#6d28d9' }}>
                  <th style={thS}>Email</th><th style={thS}>Product title</th><th style={thS}>Resume-building</th>
                </tr></thead>
                <tbody>
                  {body.slice(0, 5).map((r, i) => {
                    const p = productCol >= 0 ? String(r[productCol] ?? '') : '';
                    const isR = norm(term) !== '' && norm(p).includes(norm(term));
                    return (
                      <tr key={i}>
                        <td style={tdS}>{String(r[emailCol] ?? '')}</td>
                        <td style={tdS}>{p}</td>
                        <td style={{ ...tdS, color: isR ? '#15803d' : '#94a3b8', fontWeight: 600 }}>{isR ? 'Yes' : 'No'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <button onClick={proceed} disabled={running || parsing || emailCol < 0}
            style={{ ...btn('#7c3aed'), opacity: running || emailCol < 0 ? .6 : 1 }}>
            <Play size={15} /> {running ? `Checking… packet ${progress.done + 1} of ${progress.total}` : 'Proceed'}
          </button>

          {running && (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 8, background: '#ede9fe', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: '#7c3aed', transition: 'width .25s' }} />
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                {progress.done} of {progress.total} packet(s) done · {pct}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3. results ──────────────────────────────────────────────── */}
      {result && (
        <div style={card}>
          <div style={cardTitle}><Download size={16} /> 3 &nbsp;Results</div>
          {result.partial && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', marginBottom: 12,
              background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 12, color: '#9a3412',
            }}>
              <AlertTriangle size={15} />
              The run stopped early - these numbers cover only the {fmt(result.checked)} email(s) that were checked.
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <Stat icon={<Users size={13} />} label="Checked" value={result.checked} />
            <Stat icon={<CheckCircle2 size={13} />} label="Found in users" value={result.inUsers} tone="#15803d" />
            <Stat icon={<AlertTriangle size={13} />} label="Not in users" value={result.notInUsers.length} tone="#be123c" />
            <Stat icon={<FileSpreadsheet size={13} />} label="Resume-building" value={result.resumeTotal} tone="#b45309" />
            <Stat icon={<ShoppingCart size={13} />} label="Resume, no store order" value={result.resumeNoOrder.length} tone="#be123c" />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <button onClick={downloadNotInUsers} disabled={!result.notInUsers.length}
              style={{ ...btn('#0f766e'), opacity: result.notInUsers.length ? 1 : .5 }}>
              <Download size={15} /> Not in users ({fmt(result.notInUsers.length)})
            </button>
            <button onClick={downloadResumeNoOrder} disabled={!result.resumeNoOrder.length}
              style={{ ...btn('#b45309'), opacity: result.resumeNoOrder.length ? 1 : .5 }}>
              <Download size={15} /> Resume-building without a store order ({fmt(result.resumeNoOrder.length)})
            </button>
            {!!result.resumeNotRegistered.length && (
              <button onClick={downloadResumeUnregistered} style={btn('#fff', '#475569')}>
                <Download size={15} /> Resume-building, not registered ({fmt(result.resumeNotRegistered.length)})
              </button>
            )}
            <button onClick={reset} style={btn('#fff', '#475569')}>
              <RotateCcw size={15} /> Start over
            </button>
          </div>

          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
            Of the {fmt(result.resumeTotal)} resume-building email(s), {fmt(result.resumeInUsers)} exist in <code>users</code>;
            {' '}{fmt(result.resumeNoOrder.length)} of those have no <code>ninety_nine_store_orders</code> row.
            {result.resumeNotRegistered.length
              ? ` The other ${fmt(result.resumeNotRegistered.length)} are not registered at all, so they appear in the "not in users" file.`
              : ''}
            {result.skipped ? ` ${fmt(result.skipped)} address(es) were skipped by the server as invalid.` : ''}
          </div>

          {/* previews - first 100 of each list */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <PreviewTable
              title={`Not in users (first 100 of ${fmt(result.notInUsers.length)})`}
              cols={['Email', 'Product title']}
              rows={result.notInUsers.slice(0, 100).map(e => [e, productsFor(e)])}
            />
            <PreviewTable
              title={`Resume-building, no store order (first 100 of ${fmt(result.resumeNoOrder.length)})`}
              cols={['Email', 'User ID']}
              rows={result.resumeNoOrder.slice(0, 100).map(r => [r.email, r.user_id])}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewTable({ title, cols, rows }) {
  return (
    <div style={{ flex: '1 1 420px', minWidth: 320 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{title}</div>
      <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #ede9fe', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#6d28d9', position: 'sticky', top: 0 }}>
            {cols.map(c => <th key={c} style={thS}>{c}</th>)}
          </tr></thead>
          <tbody>
            {rows.length ? rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} style={tdS}>{String(c ?? '')}</td>)}</tr>
            )) : (
              <tr><td style={{ ...tdS, color: '#94a3b8' }} colSpan={cols.length}>Nothing here — everyone matched.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
