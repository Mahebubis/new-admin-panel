// ===========================================================================
//  LmsImportLearners.jsx — bulk learner import (Learnyst "Import Learners").
//
//  Three steps, same shape as the Netcore contact importer:
//    1. Upload   — drop a CSV, the server parses headers + guesses a mapping
//    2. Map      — confirm which column feeds Email / Name / Phone / …, and
//                  optionally pick a course to enrol every row into
//    3. Status   — created vs already-registered vs enrolled vs failed
//
//  Rows whose email isn't registered yet are registered as brand-new `users`
//  (role 4) exactly like the single "Add learner" form does.
// ===========================================================================
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, X, Download,
} from 'lucide-react';
import { LMS } from './lmsApi';
import { Modal, Loader } from './LmsStyles';
import LmsCombobox from './LmsCombobox';

const STEPS = [
  { key: 'upload', label: 'Upload file' },
  { key: 'map', label: 'Map columns' },
  { key: 'status', label: 'Status' },
];

/* what a CSV column can be mapped to */
const TARGETS = [
  { key: 'skip', label: "Don't import" },
  { key: 'email', label: 'Email (required)' },
  { key: 'name', label: 'Full name' },
  { key: 'phone', label: 'Phone' },
  { key: 'amount', label: 'Amount paid' },
  { key: 'expiry_date', label: 'Access expiry (YYYY-MM-DD)' },
  { key: 'state', label: 'State' },
  { key: 'course_name', label: 'Course name' },
  { key: 'batch', label: 'Batch' },
];

/* The downloadable starter file. Columns are exactly the TARGETS above, in the
   order the header-guesser recognises, so a template download imports with zero
   manual mapping. Excel opens a .csv natively — keeping it CSV avoids shipping a
   spreadsheet writer just for three sample rows. */
const SAMPLE_CSV = [
  'email,name,phone,amount,expiry_date,state,course_name,batch',
  'asha@example.com,Asha Rao,9876543210,99,2027-03-31,Maharashtra,Prompt Engineering Course (2026),01 September',
  'rohan@example.com,Rohan Sarade,9322740410,99,2027-03-31,Maharashtra,Cloud AI Master,17 August',
  'meera@example.com,Meera Iyer,9812345678,,,Kerala,LinkedIn Optimisation,',
].join('\r\n');

function downloadTemplate() {
  /* \uFEFF = BOM, so Excel reads the file as UTF-8 instead of the system codepage. */
  const url = URL.createObjectURL(new Blob(['\uFEFF' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lms-learners-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function LmsImportLearners({ open, onClose, courses = [], onDone }) {
  const [step, setStep] = useState('upload');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);   // { token, headers, sample_row, total_rows, mapping, file_name }
  const [mapping, setMapping] = useState({});
  const [courseId, setCourseId] = useState('');
  const [accessType, setAccessType] = useState('paid');
  /* Same choices the single "Add learner" form offers, applied to every row. */
  const [createAccount, setCreateAccount] = useState(true);
  const [writeOrders, setWriteOrders] = useState(true);
  const [password, setPassword] = useState('123@istudio');
  const [courseName, setCourseName] = useState('');
  /* The internship + ₹99 catalogue, same list the Users page picker uses. */
  const [catalogue, setCatalogue] = useState([]);

  useEffect(() => {
    if (!open) return;
    LMS.learnerFilters().then(d => setCatalogue(d.catalogue || [])).catch(() => {});
  }, [open]);
  const [result, setResult] = useState(null);
  const fileInput = useRef(null);

  const reset = () => {
    setStep('upload'); setPreview(null); setMapping({});
    setResult(null); setCourseId(''); setAccessType('paid'); setBusy(false);
  };

  const close = () => { reset(); onClose(); };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return toast.error('Please upload a .csv file');

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const d = await LMS.importPreview(fd);
      setPreview(d);
      setMapping(d.mapping || {});
      setStep('map');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!Object.values(mapping).includes('email')) {
      return toast.error('Map one column to Email before importing');
    }
    setBusy(true);
    try {
      const d = await LMS.importRun({
        token: preview.token,
        mapping,
        course_id: courseId ? Number(courseId) : 0,
        access_type: accessType,
        create_account: createAccount ? '1' : '0',
        write_orders: writeOrders ? '1' : '0',
        password,
        course_name: courseName,
        file_name: preview.file_name,
      });
      setResult(d);
      setStep('status');
      onDone?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const stepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <Modal
      open={open}
      title="Import Learners"
      onClose={close}
      width={640}
      footer={
        step === 'upload' ? (
          <button className="lms-btn lms-btn-ghost" onClick={close}>Cancel</button>
        ) : step === 'map' ? (
          <>
            <button className="lms-btn lms-btn-ghost" onClick={() => { setStep('upload'); setPreview(null); }} disabled={busy}>
              <ArrowLeft size={15} /> Back
            </button>
            <button className="lms-btn lms-btn-dark" onClick={run} disabled={busy}>
              {busy ? 'Importing…' : <>Import {preview?.total_rows ?? 0} rows <ArrowRight size={15} /></>}
            </button>
          </>
        ) : (
          <>
            <button className="lms-btn lms-btn-ghost" onClick={reset}>Import another file</button>
            <button className="lms-btn lms-btn-dark" onClick={close}>Done</button>
          </>
        )
      }
    >
      {/* stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 24, height: 24, borderRadius: 999, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, fontWeight: 600,
                background: i <= stepIndex ? 'var(--lms-green)' : 'var(--lms-bg-soft)',
                color: i <= stepIndex ? '#fff' : 'var(--lms-text-3)',
              }}>
                {i < stepIndex ? <CheckCircle2 size={14} /> : i + 1}
              </span>
              <span style={{
                fontSize: 12.5, fontWeight: i === stepIndex ? 600 : 400,
                color: i === stepIndex ? 'var(--lms-text)' : 'var(--lms-text-3)',
              }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: 'var(--lms-border)' }} />}
          </React.Fragment>
        ))}
      </div>

      {busy && step === 'upload' && <Loader inline title="Reading file…" sub="Parsing your CSV" />}

      {/* ── step 1: upload ── */}
      {step === 'upload' && !busy && (
        <>
          <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={handleFile} />
          <button className="lms-dropzone" onClick={() => fileInput.current?.click()} style={{ width: '100%' }}>
            <UploadCloud size={30} color="var(--lms-text-3)" />
            <div className="t">Click to choose a CSV file</div>
            <div className="s">One row per learner — an Email column is required</div>
          </button>

          <button
            className="lms-btn lms-btn-ghost lms-btn-sm"
            onClick={downloadTemplate}
            style={{ marginTop: 12 }}
          >
            <Download size={14} /> Download sample CSV
          </button>

          <div style={{
            marginTop: 18, padding: 14, background: 'var(--lms-bg-page)',
            borderRadius: 8, fontSize: 12.5, color: 'var(--lms-text-2)', lineHeight: 1.7,
          }}>
            <strong style={{ color: 'var(--lms-text)' }}>Expected format</strong>
            <pre style={{
              margin: '8px 0 0', fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace',
              overflowX: 'auto', color: 'var(--lms-text)',
            }}>
{`email,name,phone
asha@example.com,Asha Rao,9876543210
rohan@example.com,Rohan Sarade,9322740410`}
            </pre>
            <div style={{ marginTop: 10 }}>
              Emails already in the system are matched to the existing learner — nobody gets duplicated.
              Everyone else is registered as a new user.
            </div>
          </div>
        </>
      )}

      {/* ── step 2: map ── */}
      {step === 'map' && preview && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 12, marginBottom: 20,
            background: 'var(--lms-green-soft)', borderRadius: 8, fontSize: 13,
          }}>
            <FileSpreadsheet size={17} color="var(--lms-green-dark)" />
            <span><strong>{preview.file_name}</strong> — {preview.total_rows} row{preview.total_rows === 1 ? '' : 's'} detected</span>
          </div>

          <div className="lms-table-wrap" style={{ marginBottom: 20 }}>
            <div className="lms-table-scroll">
              <table className="lms-table" style={{ minWidth: 520 }}>
                <thead>
                  <tr><th>CSV column</th><th>First row</th><th style={{ width: 210 }}>Import as</th></tr>
                </thead>
                <tbody>
                  {preview.headers.map((h, i) => (
                    <tr key={h + i}>
                      <td style={{ fontWeight: 500 }}>{h}</td>
                      <td style={{ color: 'var(--lms-text-2)', fontSize: 12.5 }}>
                        {String(preview.sample_row?.[i] ?? '').slice(0, 40) || '—'}
                      </td>
                      <td>
                        <select
                          className="lms-select"
                          value={mapping[h] ?? 'skip'}
                          onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                        >
                          {TARGETS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lms-field">
            <label className="lms-check">
              <input type="checkbox" checked={createAccount}
                onChange={e => setCreateAccount(e.target.checked)} />
              Create a login account for anyone not registered yet
            </label>
            <p className="lms-help">
              Emails that already exist are always reused — this only decides what happens to the rest.
              Untick it and their purchase is still recorded, just with no account and no user id.
            </p>
          </div>

          {createAccount && (
            <div className="lms-field">
              <label className="lms-label">Password for new accounts</label>
              <input className="lms-input" value={password} onChange={e => setPassword(e.target.value)} />
              <p className="lms-help">Clear it to give every new learner a different random password.</p>
            </div>
          )}

          <div className="lms-field">
            <label className="lms-check">
              <input type="checkbox" checked={writeOrders}
                onChange={e => setWriteOrders(e.target.checked)} />
              Record a purchase for every row
            </label>
            <p className="lms-help">
              Writes one ₹99-store order per row, with a <b>training_…</b> reference and the gateway that
              is live in settings.
            </p>
          </div>

          {writeOrders && (
            <div className="lms-field">
              <label className="lms-label">Course name for every row</label>
              <LmsCombobox
                options={catalogue}
                value={courseName}
                onChange={setCourseName}
                placeholder="Used when the CSV has no course_name column"
                searchPlaceholder="Search internships and courses…"
                allowCustom
              />
            </div>
          )}

          <div className="lms-divider" />

          <div className="lms-row-2">
            <div className="lms-field">
              <label className="lms-label">Enroll everyone into (optional)</label>
              <select className="lms-select" value={courseId} onChange={e => setCourseId(e.target.value)}
                disabled={!createAccount}>
                <option value="">Import users only — no enrollment</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              {!createAccount && (
                <p className="lms-help">Enrollment needs an account — tick the box above.</p>
              )}
            </div>
            <div className="lms-field">
              <label className="lms-label">Access type</label>
              <select className="lms-select" value={accessType} onChange={e => setAccessType(e.target.value)} disabled={!courseId}>
                <option value="paid">Paid</option>
                <option value="free">Free</option>
                <option value="trial">Trial</option>
              </select>
            </div>
          </div>
        </>
      )}

      {/* ── step 3: status ── */}
      {step === 'status' && result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Rows processed', value: result.total, tone: 'grey' },
              { label: 'Purchases recorded', value: result.ordered ?? 0, tone: 'green' },
              { label: 'No account made', value: result.no_account ?? 0, tone: 'amber' },
              { label: 'New users registered', value: result.created, tone: 'green' },
              { label: 'Already registered', value: result.existing, tone: 'blue' },
              { label: 'Enrolled into course', value: result.enrolled, tone: 'green' },
            ].map(s => (
              <div key={s.label} className="lms-counter">
                <div>
                  <div className="lms-counter-label">{s.label}</div>
                  <div className="lms-counter-value">{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {result.failed > 0 ? (
            <div style={{
              padding: 14, background: 'var(--lms-red-soft)', borderRadius: 8,
              color: 'var(--lms-red-dark)', fontSize: 13,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 8 }}>
                <AlertTriangle size={16} /> {result.failed} row{result.failed === 1 ? '' : 's'} failed
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                {(result.errors || []).slice(0, 12).map((err, i) => <li key={i}>{err}</li>)}
              </ul>
              {(result.errors || []).length > 12 && (
                <div style={{ marginTop: 8 }}>…and {result.errors.length - 12} more.</div>
              )}
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: 14,
              background: 'var(--lms-green-soft)', borderRadius: 8,
              color: 'var(--lms-green-dark)', fontSize: 13, fontWeight: 500,
            }}>
              <CheckCircle2 size={17} /> Every row imported cleanly.
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
