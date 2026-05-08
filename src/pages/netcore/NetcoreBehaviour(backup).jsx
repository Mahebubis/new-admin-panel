import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const API = '/api/netcore/behaviour.php';
const FORM_HEADERS = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

/* fixed conversion cards (always shown) */
const EVENT_LIST = [
  { key: 'register', label: 'Register' },
  { key: 'signin', label: 'Signin' },
  { key: 'exam_success', label: 'Exam Success' },
  { key: 'course_purchase', label: 'Course Purchase' },
  { key: 'payment_success', label: 'Payment Success' },
];

/* "Other events" — picked one at a time via the edit-icon dropdown */
const OTHER_EVENT_LIST = [
  { key: 'preferred_domain', label: 'Preferred Domain' },
  { key: 'result_view', label: 'Result View' },
  { key: 'visited_iap', label: 'Visited IAP' },
  { key: 'placement_community_link', label: 'Placement Community Link' },
  { key: 'instantexam_reminder', label: 'Instantexam Reminder' },
  { key: 'course_edit', label: 'Course Edit' },
  { key: 'register_company', label: 'Register Company' },
  { key: 'company_signin', label: 'Company Signin' },
  { key: 'company_vacancy_post', label: 'Company Vacancy Post' },
];

const PAYLOAD_OPTIONS = {
  register: ['select parameter', 'country', 'mobile', 'last_name', 'state', 'first_name', 'email', 'method', 'source', 'referral', 'express', 'instantexam', 'instantresult', 'setreminder', 'campaign', 'adset', 'ad', 'medium', 'is_from_refund', 'register_type', 'device'],
  signin: ['select parameter', 'email'],
  exam_success: ['select parameter', 'status', 'result_score'],
  course_purchase: ['select parameter', 'amount', 'internship_name', 'batch_date', 'coupon_applied', 'initiated_at'],
  payment_success: ['select parameter', 'paid_amount', 'coupon_applied_success', 'order_id', 'paid_internship_name', 'paid_batch_date', 'paid_at'],
  preferred_domain: ['select parameter', 'preferred_domain'],
  visited_iap: ['select parameter', 'visited', 'visited_time'],
  result_view: ['select parameter', 'score'],
  placement_community_link: ['select parameter', 'assigned_links', 'refund_non_refund'],
  instantexam_reminder: ['select parameter', 'date_time', 'time_slot'],
  course_edit: ['select parameter', 'edit_internship_name', 'edit_page_url', 'edit_batch_date', 'edit_type'],
  register_company: ['select parameter', 'company_logo', 'company_mobile', 'company_name', 'company_email'],
  company_signin: ['select parameter', 'company_signin_email', 'company_signin_status', 'company_signin_ip', 'company_signin_user_agent'],
  company_vacancy_post: ['select parameter', 'vp_email', 'vp_job_type', 'vp_job_title', 'vp_mode', 'vp_openings', 'vp_start_date', 'vp_duration', 'vp_salary', 'vp_comp_amount', 'vp_comp_min', 'vp_comp_max', 'vp_comp_type', 'vp_comp_period', 'vp_experience', 'vp_method', 'vp_source'],
};

const CARD_COLORS = ['#4f46e5', '#7c3aed', '#0369a1', '#059669', '#dc2626', '#d97706'];
const OTHER_CARD_COLOR = '#d97706';
const LINE_COLORS = [
  { border: '#4f46e5', fill: 'rgba(79,70,229,0.18)' },
  { border: '#10b981', fill: 'rgba(16,185,129,0.18)' },
  { border: '#f43f5e', fill: 'rgba(244,63,94,0.18)' },
];

/* ── CDN loader (runs once) ── */
let _cjsReady = false;
let _cjsPromise = null;
function loadChartJs() {
  if (_cjsReady && window.Chart) return Promise.resolve();
  if (_cjsPromise) return _cjsPromise;
  _cjsPromise = new Promise(resolve => {
    const s1 = document.createElement('script');
    s1.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    s1.onload = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2';
      s2.onload = () => { _cjsReady = true; resolve(); };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  });
  return _cjsPromise;
}

function DotsLoader({ color = '#4f46e5', size = 9 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: 'inline-block', width: size, height: size, borderRadius: '50%',
          background: color, animation: 'nc_pulse 1.2s infinite ease-in-out',
          animationDelay: `${i * 0.2}s`
        }} />
      ))}
    </span>
  );
}

/* ── Fixed-height chart wrapper — reserves space ALWAYS to prevent scroll jump ── */
function ChartBox({ height = 480, loading, noData, noDataMsg, children, loaderColor }) {
  return (
    <div style={{ position: 'relative', height, width: '100%' }}>
      {/* loader overlay */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'rgba(255,255,255,0.82)',
          borderRadius: 8, zIndex: 5
        }}>
          <DotsLoader color={loaderColor || '#4f46e5'} />
        </div>
      )}
      {/* no-data message */}
      {noData && !loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#94a3b8', fontSize: 13
        }}>
          {noDataMsg || 'No data available'}
        </div>
      )}
      {/* canvas always mounted — never toggled — prevents scroll jump */}
      <div style={{ visibility: noData || loading ? 'hidden' : 'visible', height: '100%' }}>
        {children}
      </div>
    </div>
  );
}

export default function NetcoreBehaviour() {
  const [counts, setCounts] = useState({});
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterLabel, setFilterLabel] = useState('Today');
  const [activePreset, setActivePreset] = useState('today');
  const [dropOpen, setDropOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState('register');
  const [otherEvent, setOtherEvent] = useState('preferred_domain');
  const [otherDropOpen, setOtherDropOpen] = useState(false);
  const [otherSearch, setOtherSearch] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [payloadParam, setPayloadParam] = useState('select parameter');
  const [payloadDropOpen, setPayloadDropOpen] = useState(false);
  const [payloadSearch, setPayloadSearch] = useState('');
  const [overviewSubtitle, setOverviewSubtitle] = useState('');

  const [ldCards, setLdCards] = useState(false);
  const [ldUsers, setLdUsers] = useState(false);
  const [ldOverview, setLdOverview] = useState(false);
  const [ldPayload, setLdPayload] = useState(false);
  const [ldHourly, setLdHourly] = useState(false);
  const [ldFreq, setLdFreq] = useState(false);
  const [noPayload, setNoPayload] = useState(true);
  const [noHourly, setNoHourly] = useState(false);
  const [noFreq, setNoFreq] = useState(false);
  const [payloadNoDataMsg, setPayloadNoDataMsg] = useState('');

  const overviewRef = useRef(null);
  const payloadRef = useRef(null);
  const hourlyRef = useRef(null);
  const freqRef = useRef(null);

  const oCI = useRef(null);
  const pCI = useRef(null);
  const hCI = useRef(null);
  const fCI = useRef(null);

  const dropRef = useRef(null);
  const otherDropRef = useRef(null);
  const payloadDropRef = useRef(null);
  const overviewLoaded = useRef(false);
  const blinkTimer = useRef(null);

  /* live refs so stale closures never cause wrong values in async fns */
  const filterRef = useRef('today');
  const fromRef = useRef('');
  const toRef = useRef('');
  const eventRef = useRef('register');
  filterRef.current = filter;
  fromRef.current = fromDate;
  toRef.current = toDate;
  eventRef.current = activeEvent;

  /* ── close dropdowns on outside click ── */
  useEffect(() => {
    const h = e => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
      if (otherDropRef.current && !otherDropRef.current.contains(e.target)) setOtherDropOpen(false);
      if (payloadDropRef.current && !payloadDropRef.current.contains(e.target)) setPayloadDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── initial load: ALL calls in parallel — no sequential await, no setTimeout ── */
  useEffect(() => {
    loadChartJs().then(() => {
      doFetchCounts('today', '', '', 'register');
      doFetchUsers('register', 'today', '', '');
      doFetchHourly('today', '', '', 'register');
      doFetchFreq('today', '', '', 'register');
    });
  }, []); // eslint-disable-line

  /* ══════════ BODY BUILDER ══════════ */
  function mkBody(extra = {}, f, fd, td, ev) {
    return new URLSearchParams({
      filter: f ?? filterRef.current,
      from: fd ?? fromRef.current,
      to: td ?? toRef.current,
      event: ev ?? eventRef.current,
      ...extra,
    });
  }

  /* ══════════ FETCHERS ══════════ */

  async function doFetchCounts(f, fd, td) {
    setLdCards(true);
    try {
      const res = await api.post(API, mkBody({ action: 'fetch_counts_only' }, f, fd, td), FORM_HEADERS);
      if (res.data.status === 'success') setCounts(res.data.counts || {});
    } catch (e) { } finally { setLdCards(false); }
  }

  async function doFetchUsers(ev, f, fd, td) {
    setLdUsers(true);
    try {
      const res = await api.post(API, mkBody({ action: 'recent_users' }, f, fd, td, ev), FORM_HEADERS);
      if (res.data.status === 'success') setUsers(res.data.users || []);
    } catch (e) { } finally { setLdUsers(false); }
  }

  async function doFetchOverview(f, fd, td, ev) {
    if (!window.Chart) return;
    setLdOverview(true);
    try {
      const res = await api.post(API, mkBody({ action: 'fetch_behavior_data' }, f, fd, td, ev), FORM_HEADERS);
      if (res.data.status === 'success') {
        const xTitle = (f === 'today' || f === 'yesterday') ? 'Time (Hourly)' : 'Date Range';
        renderOverview(res.data.labels, res.data.datasets, ev, xTitle, 'User Count', f, fd, td);
        overviewLoaded.current = true;
      }
    } catch (e) { } finally { setLdOverview(false); }
  }

  async function doFetchPayload(param, f, fd, td, ev) {
    if (!param || param === 'select parameter') return;
    setLdPayload(true); setNoPayload(false);
    if (pCI.current) { pCI.current.destroy(); pCI.current = null; }
    try {
      const res = await api.post(API, mkBody({ action: 'fetch_payload_data', parameter: param }, f, fd, td, ev), FORM_HEADERS);
      if (res.data.status === 'success' && res.data.labels?.length) {
        setNoPayload(false);
        renderPayload(res.data.labels, res.data.counts, param);
      } else {
        setNoPayload(true);
        setPayloadNoDataMsg(`No data available for ${param} on this date`);
      }
    } catch (e) { setNoPayload(true); } finally { setLdPayload(false); }
  }

  async function doFetchHourly(f, fd, td, ev) {
    if (!window.Chart) return;
    setLdHourly(true); setNoHourly(false);
    if (hCI.current) { hCI.current.destroy(); hCI.current = null; }
    try {
      const res = await api.post(API, mkBody({ action: 'fetch_event_hourly_data' }, f, fd, td, ev), FORM_HEADERS);
      if (res.data.status === 'success' && res.data.labels?.length) {
        setNoHourly(false);
        renderHourly(res.data.labels, res.data.counts, res.data.xTitle || 'Time', res.data.yTitle || 'Event Count', res.data.total || 0);
      } else { setNoHourly(true); }
    } catch (e) { setNoHourly(true); } finally { setLdHourly(false); }
  }

  async function doFetchFreq(f, fd, td, ev) {
    if (!window.Chart) return;
    setLdFreq(true); setNoFreq(false);
    if (fCI.current) { fCI.current.destroy(); fCI.current = null; }
    try {
      const res = await api.post(API, mkBody({ action: 'fetch_user_event_frequency' }, f, fd, td, ev), FORM_HEADERS);
      if (res.data.status === 'success' && res.data.labels?.length) {
        setNoFreq(false);
        renderFreq(res.data.labels, res.data.counts);
      } else { setNoFreq(true); }
    } catch (e) { setNoFreq(true); } finally { setLdFreq(false); }
  }

  /* ── full refresh: all calls fire at once ── */
  function doFullRefresh(f, fd, td, ev) {
    overviewLoaded.current = false;
    setPayloadParam('select parameter');
    setNoPayload(true);
    if (pCI.current) { pCI.current.destroy(); pCI.current = null; }

    /* fire all in parallel — no await */
    doFetchCounts(f, fd, td);
    doFetchUsers(ev, f, fd, td);
    doFetchHourly(f, fd, td, ev);
    doFetchFreq(f, fd, td, ev);

    /* if overview tab is open, refresh it too; else lazy-load when tab is clicked */
    if (activeTab === 'overview') {
      doFetchOverview(f, fd, td, ev);
    }
  }

  /* ══════════ FILTER ACTIONS ══════════ */
  const applyPreset = (f, label) => {
    setFilter(f); setFilterLabel(label); setFromDate(''); setToDate('');
    setActivePreset(f); setDropOpen(false); setActiveTab('users');
    doFullRefresh(f, '', '', activeEvent);
  };

  const applyCustom = () => {
    if (!fromDate || !toDate) { toast.error('Please select both dates'); return; }
    setFilter(''); setFilterLabel(`${fromDate} → ${toDate}`);
    setActivePreset(''); setDropOpen(false); setActiveTab('users');
    doFullRefresh('', fromDate, toDate, activeEvent);
  };

  /* ══════════ TAB SWITCH ══════════ */
  const switchTab = tab => {
    setActiveTab(tab);
    if (tab === 'overview' && !overviewLoaded.current) {
      doFetchOverview(filter, fromDate, toDate, activeEvent);
    }
    if (tab === 'users') doFetchUsers(activeEvent, filter, fromDate, toDate);
  };

  /* ══════════ EVENT CARD CLICK ══════════ */
  const handleEventClick = ev => {
    setActiveEvent(ev);
    overviewLoaded.current = false;
    setPayloadParam('select parameter');
    setNoPayload(true);
    if (pCI.current) { pCI.current.destroy(); pCI.current = null; }

    const f = filterRef.current, fd = fromRef.current, td = toRef.current;
    doFetchCounts(f, fd, td);
    doFetchUsers(ev, f, fd, td);
    doFetchHourly(f, fd, td, ev);
    doFetchFreq(f, fd, td, ev);
    if (activeTab === 'overview') doFetchOverview(f, fd, td, ev);
  };

  /* ══════════ OTHER EVENT SELECT ══════════ */
  const handleOtherEventSelect = key => {
    setOtherEvent(key);
    setOtherDropOpen(false);
    setOtherSearch('');
    /* selecting an other-event makes it the active event so all charts/tables refresh */
    handleEventClick(key);
  };

  /* ══════════ PAYLOAD CHANGE ══════════ */
  const handlePayloadChange = p => {
    setPayloadParam(p);
    setPayloadDropOpen(false);
    setPayloadSearch('');
    if (p && p !== 'select parameter') {
      doFetchPayload(p, filter, fromDate, toDate, activeEvent);
    } else {
      setNoPayload(true);
      if (pCI.current) { pCI.current.destroy(); pCI.current = null; }
    }
  };

  /* ══════════════════════════════════
     CHART RENDERERS
  ══════════════════════════════════ */

  function renderOverview(labels, datasets, ev, xTitle, yTitle, f, fd, td) {
    const ctx = overviewRef.current?.getContext('2d'); if (!ctx) return;
    if (oCI.current) oCI.current.destroy();
    if (blinkTimer.current) clearInterval(blinkTimer.current);
    const Chart = window.Chart;

    datasets.forEach((ds, i) => {
      const g = ctx.createLinearGradient(0, 0, 0, 400);
      g.addColorStop(0, LINE_COLORS[i % 3].fill);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ds.borderColor = LINE_COLORS[i % 3].border;
      ds.backgroundColor = g;
      ds.pointRadius = 3; ds.pointHoverRadius = 6;
      ds.tension = 0.35; ds.fill = true; ds.borderWidth = 2.5;
    });

    /* subtitle */
    const t0 = datasets[0]?.data?.reduce((a, b) => a + b, 0) || 0;
    const t1 = datasets[1]?.data?.reduce((a, b) => a + b, 0) || 0;
    const t2 = datasets[2]?.data?.reduce((a, b) => a + b, 0) || 0;
    let sub = '';
    if (fd && td) {
      sub = `Custom Range (${fd} → ${td}): ${t0.toLocaleString()}`;
    } else {
      switch (f) {
        case 'today': sub = `Today: ${t0.toLocaleString()}  |  Yesterday: ${t1.toLocaleString()}  |  Last Week: ${t2.toLocaleString()}`; break;
        case 'yesterday': sub = `Yesterday: ${t0.toLocaleString()}  |  Previous Day: ${t1.toLocaleString()}  |  Last Week: ${t2.toLocaleString()}`; break;
        case '7days': sub = `Last 7 Days: ${t0.toLocaleString()}`; break;
        case '30days': sub = `Last 30 Days: ${t0.toLocaleString()}`; break;
        default: sub = `Total Count: ${t0.toLocaleString()}`;
      }
    }
    setOverviewSubtitle(sub);

    /* blink plugin */
    const todayIdx = datasets.findIndex(ds => ds.label?.toLowerCase() === 'today');
    const blinkPlugin = {
      id: 'ncBlink',
      afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(todayIdx);
        if (todayIdx < 0 || !meta) return;
        const nh = (new Date().getHours() + 1) % 24;
        const pi = labels.findIndex(l => l.startsWith(nh.toString().padStart(2, '0')));
        if (pi < 0 || !meta.data[pi]) return;
        const pt = meta.data[pi].getProps(['x', 'y'], true);
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 250);
        const c2 = chart.ctx;
        c2.save(); c2.beginPath();
        c2.arc(pt.x, pt.y, 6 + 3 * pulse, 0, 2 * Math.PI);
        c2.fillStyle = `rgba(99,102,241,${pulse})`;
        c2.fill(); c2.restore();
      }
    };

    oCI.current = new Chart(ctx, {
      type: 'line', data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 1600, easing: 'easeInOutQuart', delay: c => c.dataIndex * 15 },
        layout: { padding: { top: 40, bottom: 20, left: 10, right: 10 } },
        plugins: {
          legend: {
            display: true, position: 'top',
            labels: { usePointStyle: true, pointStyle: 'circle', color: '#1e293b', font: { size: 13, weight: '600' } },
            onClick(e, li, legend) {
              const ci = legend.chart;
              const meta = ci.getDatasetMeta(li.datasetIndex);
              meta.hidden = meta.hidden === null ? !ci.data.datasets[li.datasetIndex].hidden : null;
              ci.update();
            }
          },
          tooltip: { enabled: true, mode: 'nearest', intersect: false, backgroundColor: 'rgba(255,255,255,0.97)', titleColor: '#1e293b', bodyColor: '#334155', borderColor: '#e2e8f0', borderWidth: 1, padding: 14, cornerRadius: 8, titleFont: { size: 13, weight: 'bold' }, bodyFont: { size: 12 }, callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y}` } },
          datalabels: { display: false, pointerEvents: false },
        },
        scales: {
          y: { beginAtZero: true, grace: '35%', grid: { color: 'rgba(0,0,0,0.05)' }, title: { display: true, text: yTitle, color: '#475569', font: { size: 13, weight: '600' } } },
          x: { grid: { display: false }, ticks: { autoSkip: true, maxRotation: 30, color: '#64748b', font: { size: 11 } }, title: { display: true, text: xTitle, color: '#475569', font: { size: 13, weight: '600' } } },
        }
      },
      plugins: [window.ChartDataLabels, ...(todayIdx >= 0 && !fd && !td && f === 'today' ? [blinkPlugin] : [])],
    });

    if (todayIdx >= 0 && !fd && !td && f === 'today') {
      blinkTimer.current = setInterval(() => { if (oCI.current) oCI.current.update('none'); }, 120);
    }
  }

  function renderPayload(labels, counts, param) {
    const ctx = payloadRef.current?.getContext('2d'); if (!ctx) return;
    if (pCI.current) pCI.current.destroy();
    const Chart = window.Chart;
    const xMap = { result_score: 'Score Range', status: 'Status', country: 'Country', state: 'State', express: 'Organic / Express', instantexam: 'Exam Type', referral: 'Referral Source', first_name: 'First Names', last_name: 'Last Names', mobile: 'Mobile Numbers', amount: 'Amount', paid_amount: 'Amount', internship_name: 'Internship', batch_date: 'Batch Date', coupon_applied: 'Coupon', coupon_applied_success: 'Coupon', order_id: 'Order ID', paid_internship_name: 'Internship', paid_batch_date: 'Batch Date', initiated_at: 'Time', paid_at: 'Time', preferred_domain: 'Domain', visited: 'Visited', visited_time: 'Time', score: 'Score', assigned_links: 'Community Link', refund_non_refund: 'User Type', date_time: 'Reminder Date', time_slot: 'Time Slot', edit_internship_name: 'Internship', edit_page_url: 'Page URL', edit_batch_date: 'New Batch', edit_type: 'Action Type', company_logo: 'Logo', company_mobile: 'Mobile', company_name: 'Company Name', company_email: 'Email', company_signin_email: 'Email', company_signin_status: 'Status', company_signin_ip: 'IP Address', company_signin_user_agent: 'User Agent', vp_email: 'Email', vp_job_type: 'Job Type', vp_job_title: 'Job Title', vp_mode: 'Mode', vp_openings: 'Openings', vp_start_date: 'Start Date', vp_duration: 'Duration', vp_salary: 'Salary Range', vp_comp_amount: 'Compensation Amount', vp_comp_min: 'Min Compensation', vp_comp_max: 'Max Compensation', vp_comp_type: 'Compensation Type', vp_comp_period: 'Compensation Period', vp_experience: 'Min Experience', vp_method: 'Job Nature', vp_source: 'Source', method: 'Signup Method', source: 'Source', instantresult: 'Instant Result', setreminder: 'Set Reminder', campaign: 'Campaign', adset: 'Ad Set', ad: 'Ad', medium: 'Medium', is_from_refund: 'From Refund', full_url: 'Registration URL', register_type: 'Register Type', device: 'Device' };
    pCI.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: `${param} (Top ${labels.length})`, data: counts, backgroundColor: 'rgba(99,102,241,0.75)', borderRadius: 5, barThickness: 25 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 1800, easing: 'easeOutElastic', delay: c => c.dataIndex * 60 },
        layout: { padding: { top: 70 } },
        plugins: {
          subtitle: { display: true, text: `Total Count: ${counts.reduce((a, b) => a + b, 0).toLocaleString()}`, align: 'start', color: '#1e293b', font: { size: 14, weight: '600' }, padding: { top: 8, bottom: 8 } },
          legend: { display: false },
          tooltip: { backgroundColor: 'rgba(255,255,255,0.97)', titleColor: '#1e293b', bodyColor: '#475569', borderColor: '#e2e8f0', borderWidth: 1, titleFont: { size: 13, weight: 'bold' }, bodyFont: { size: 12 }, padding: 12, cornerRadius: 8, callbacks: { label: c => `${c.label}: ${c.parsed.y.toLocaleString()}` } },
          datalabels: { anchor: 'end', align: 'top', offset: 8, clamp: true, clip: false, color: '#1e293b', font: { weight: '600', size: 12 }, formatter: v => v.toLocaleString() },
        },
        scales: {
          y: { beginAtZero: true, grace: '25%', grid: { color: 'rgba(0,0,0,0.05)' }, title: { display: true, text: 'Count', color: '#475569', font: { size: 12, weight: '600' } } },
          x: { grid: { display: false }, ticks: { autoSkip: true, maxRotation: 30, color: '#64748b' }, title: { display: true, text: xMap[param] || 'Category', color: '#475569', font: { size: 12, weight: '600' } } },
        }
      },
      plugins: [window.ChartDataLabels],
    });
  }

  function renderHourly(labels, counts, xTitle, yTitle, total) {
    const ctx = hourlyRef.current?.getContext('2d'); if (!ctx) return;
    if (hCI.current) hCI.current.destroy();
    const Chart = window.Chart;
    hCI.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Event Frequency', data: counts, backgroundColor: 'rgba(245,158,11,0.75)', borderRadius: 8, barThickness: 26 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: false, /* disabled for speed — avoids any scroll interference */
        layout: { padding: { top: 55 } },
        plugins: {
          legend: { display: false },
          subtitle: { display: true, text: `Total Events: ${(total || counts.reduce((a, b) => a + b, 0)).toLocaleString()}`, align: 'start', color: '#1e293b', font: { size: 14, weight: '600' }, padding: { top: 8, bottom: 8 } },
          tooltip: { backgroundColor: 'rgba(255,255,255,0.97)', titleColor: '#1e293b', bodyColor: '#475569', borderColor: '#e2e8f0', borderWidth: 1, titleFont: { size: 13, weight: 'bold' }, bodyFont: { size: 12 }, padding: 12, cornerRadius: 6 },
          datalabels: { anchor: 'end', align: 'end', offset: 8, clamp: false, clip: false, color: '#1e293b', font: { weight: '700', size: 12 }, formatter: v => v.toLocaleString() },
        },
        scales: {
          y: { beginAtZero: true, grace: '10%', title: { display: true, text: yTitle, color: '#475569', font: { size: 12, weight: '600' } } },
          x: { grid: { display: false }, ticks: { autoSkip: true, maxRotation: 30, color: '#64748b' }, title: { display: true, text: xTitle, color: '#475569', font: { size: 12, weight: '600' } } },
        }
      },
      plugins: [window.ChartDataLabels],
    });
  }

  function renderFreq(labels, counts) {
    const ctx = freqRef.current?.getContext('2d'); if (!ctx) return;
    if (fCI.current) fCI.current.destroy();
    const Chart = window.Chart;
    const g = ctx.createLinearGradient(0, 0, 600, 0);
    g.addColorStop(0, 'rgba(99,102,241,0.95)');
    g.addColorStop(0.5, 'rgba(139,92,246,0.9)');
    g.addColorStop(1, 'rgba(196,181,253,0.8)');

    const customYTitle = {
      id: 'customYAxisTitle',
      afterDraw(chart) {
        const { ctx: c2, chartArea } = chart;
        c2.save();
        c2.fillStyle = '#4f46e5'; c2.font = '700 13px "Plus Jakarta Sans",sans-serif';
        c2.textAlign = 'center'; c2.textBaseline = 'middle';
        const xPos = chartArea.left - 60;
        const yPos = (chartArea.top + chartArea.bottom) / 2;
        c2.translate(xPos, yPos); c2.rotate(-Math.PI / 2);
        c2.fillText('Number of Times Event Performed', 0, 0);
        c2.restore();
      }
    };

    fCI.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Users', data: counts, backgroundColor: g, borderRadius: 10, barThickness: 28 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        animation: false, /* disabled for speed */
        layout: { padding: { left: 80, right: 30, top: 10, bottom: 10 } },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: '#4f46e5', font: { weight: 600, size: 12 } } },
          tooltip: { backgroundColor: 'rgba(255,255,255,0.98)', titleColor: '#4f46e5', bodyColor: '#1e293b', borderColor: '#c4b5fd', borderWidth: 1.5, cornerRadius: 10, padding: 16, displayColors: false, titleFont: { size: 14, weight: '700' }, bodyFont: { size: 14, weight: '600' }, callbacks: { title: c => `Frequency: ${c[0].label}`, label: c => `Users: ${c.parsed.x.toLocaleString()}` } },
          datalabels: { anchor: 'end', align: 'right', color: '#4f46e5', font: { weight: '600', size: 12 }, formatter: v => v.toLocaleString() },
        },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(99,102,241,0.05)' }, title: { display: true, text: 'Number of Users', color: '#4f46e5', font: { size: 13, weight: '700' } }, ticks: { color: '#4f46e5', font: { size: 12, weight: 600 } } },
          y: { grid: { display: false }, title: { display: false }, ticks: { color: '#4f46e5', font: { size: 12, weight: 600 }, padding: 8 } },
        }
      },
      plugins: [window.ChartDataLabels, customYTitle],
    });
  }

  /* ══════════════════════════════════
     RENDER
  ══════════════════════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .nc-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        @keyframes nc_pulse{0%,80%,100%{opacity:.2;transform:scale(.8);}40%{opacity:1;transform:scale(1);}}
        @keyframes nc_dropin{from{opacity:0;transform:translateY(-14px);}to{opacity:1;transform:translateY(0);}}
        .nc-dropin{animation:nc_dropin .25s cubic-bezier(.68,-.55,.27,1.55);}
        .nc-filter-shine::before{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent);transition:left .5s;}
        .nc-filter-shine:hover::before{left:100%;}
        .nc-fopt:hover{border-color:#c4b5fd!important;background:#f5f3ff!important;transform:translateX(4px);}
        .nc-ecard:hover{transform:translateY(-4px);box-shadow:0 6px 20px rgba(0,0,0,.1)!important;}
        .nc-tr:hover td{background:#f5f3ff!important;}
        .nc-tab:hover{color:#4f46e5;}
      `}</style>

      <div className="nc-root" style={{ background: '#f1f0ff', minHeight: '100vh', padding: 20 }}>

        {/* title */}
        <h4 style={{ fontWeight: 700, color: '#1e293b', textAlign: 'center', marginBottom: 22, fontSize: 18 }}>
          Behavior Analytics Dashboard
        </h4>

        {/* ══ FILTER BAR ══ */}
        <div style={{ position: 'relative', marginBottom: 22 }} ref={dropRef}>
          <button className="nc-filter-shine"
            onClick={() => setDropOpen(o => !o)}
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, boxShadow: '0 4px 12px rgba(79,70,229,.3)', transition: 'all .3s', position: 'relative', overflow: 'hidden', minWidth: 250, fontFamily: 'inherit' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ flex: 1, textAlign: 'left' }}>{filterLabel}</span>
            {/* <i className="fa fa-chevron-down" style={{ fontSize: 11, transition: 'transform .3s', transform: dropOpen ? 'rotate(180deg)' : 'rotate(0)' }} /> */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'transform .3s', transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {dropOpen && (
            <div className="nc-dropin" style={{ position: 'absolute', left: 0, top: 'calc(100% + 10px)', background: '#fff', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,.15)', zIndex: 1000, minWidth: 550, border: '1.5px solid #ede9fe' }}>
              {/* header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '2px solid #f5f3ff' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Select Date Range</span>
                <button onClick={() => setDropOpen(false)} style={{ background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
              </div>
              {/* body */}
              <div style={{ display: 'flex', padding: 22, gap: 22 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Quick Select</div>
                  {[['today', 'Today'], ['yesterday', 'Yesterday'], ['7days', 'Last 7 Days'], ['30days', 'Last 30 Days']].map(([f, label, icon]) => (
                    <button key={f} className="nc-fopt"
                      onClick={() => applyPreset(f, label)}
                      style={{ width: '100%', padding: '11px 14px', border: `2px solid ${activePreset === f ? '#4f46e5' : '#e2e8f0'}`, background: activePreset === f ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: activePreset === f ? '#fff' : '#475569', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7, transition: 'all .18s', fontFamily: 'inherit', boxShadow: activePreset === f ? '0 4px 12px rgba(79,70,229,.28)' : 'none' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={activePreset === f ? '#fff' : '#94a3b8'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ width: 2, background: 'linear-gradient(to bottom,transparent,#e2e8f0,transparent)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Custom Range</div>
                  {[['Start Date', fromDate, setFromDate], ['End Date', toDate, setToDate]].map(([lbl, val, fn]) => (
                    <div key={lbl} style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 5 }}>{lbl}</label>
                      <input type="date" value={val} onChange={e => fn(e.target.value)}
                        onFocus={e => { e.target.style.borderColor = '#4f46e5'; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,.1)'; }}
                        onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                        style={{ width: '100%', padding: '10px 12px', border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#1e293b', outline: 'none', transition: 'all .2s' }} />
                    </div>
                  ))}
                </div>
              </div>
              {/* footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: '2px solid #f5f3ff' }}>
                <button onClick={() => setDropOpen(false)} style={{ padding: '9px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#f1f5f9', color: '#475569', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={applyCustom} style={{ padding: '9px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', boxShadow: '0 4px 12px rgba(79,70,229,.3)', fontFamily: 'inherit' }}>Apply Filter</button>
              </div>
            </div>
          )}
        </div>

        {/* ══ EVENT CARDS ══ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15, flexWrap: 'wrap', marginBottom: 24 }}>
          {EVENT_LIST.map((ev, i) => (
            <div key={ev.key} className="nc-ecard"
              onClick={() => handleEventClick(ev.key)}
              style={{ position: 'relative', flex: 1, minWidth: 140, background: '#fff', border: `${activeEvent === ev.key ? '2px' : '1px'} solid ${activeEvent === ev.key ? CARD_COLORS[i] : '#e0e0e0'}`, borderRadius: 10, textAlign: 'center', padding: '15px 10px', cursor: 'pointer', transition: 'all .25s', boxShadow: activeEvent === ev.key ? `0 4px 16px ${CARD_COLORS[i]}30` : undefined }}>
              {ldCards && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.82)', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: 10, zIndex: 2 }}>
                  <DotsLoader color={CARD_COLORS[i]} />
                </div>
              )}
              <h4 style={{ color: CARD_COLORS[i], fontSize: 13, fontWeight: 600, margin: '0 0 6px' }}>{ev.label}</h4>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>{(counts[ev.key] || 0).toLocaleString()}</p>
            </div>
          ))}

          {/* "Other events" card — same size as conversion cards, with edit icon */}
          <div ref={otherDropRef} className="nc-ecard"
            onClick={() => handleEventClick(otherEvent)}
            style={{ position: 'relative', flex: 1, minWidth: 140, background: '#fff', border: `${activeEvent === otherEvent ? '2px' : '1px'} solid ${activeEvent === otherEvent ? OTHER_CARD_COLOR : '#e0e0e0'}`, borderRadius: 10, textAlign: 'center', padding: '15px 10px', cursor: 'pointer', transition: 'all .25s', boxShadow: activeEvent === otherEvent ? `0 4px 16px ${OTHER_CARD_COLOR}30` : undefined, zIndex: otherDropOpen ? 9999 : 'auto' }}>
            {ldCards && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.82)', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: 10, zIndex: 2 }}>
                <DotsLoader color={OTHER_CARD_COLOR} />
              </div>
            )}

            {/* "Other events" label + edit icon at top-right */}
            <div style={{ position: 'absolute', top: 8, right: 10, display: 'inline-flex', alignItems: 'center', gap: 6, zIndex: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Other events</span>
              <button title="Change other event"
                onClick={e => { e.stopPropagation(); setOtherDropOpen(o => !o); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'inline-flex', alignItems: 'center', color: '#64748b', borderRadius: 4 }}>
                {otherDropOpen ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                )}
              </button>
            </div>

            <h4 style={{ color: OTHER_CARD_COLOR, fontSize: 13, fontWeight: 600, margin: '24px 0 6px' }}>
              {(OTHER_EVENT_LIST.find(o => o.key === otherEvent) || {}).label || otherEvent}
            </h4>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>{(counts[otherEvent] || 0).toLocaleString()}</p>

            {otherDropOpen && (
              <div className="nc-dropin"
                onClick={e => e.stopPropagation()}
                style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 240, background: '#fff', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.15)', border: '1.5px solid #ede9fe', zIndex: 9999, padding: 10, textAlign: 'left', cursor: 'default' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Select events</div>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input autoFocus type="text" placeholder="Search"
                    value={otherSearch}
                    onChange={e => setOtherSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 30px 8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                    style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {OTHER_EVENT_LIST.filter(o => o.label.toLowerCase().includes(otherSearch.toLowerCase())).length === 0
                    ? <div style={{ padding: 10, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>No matches</div>
                    : OTHER_EVENT_LIST.filter(o => o.label.toLowerCase().includes(otherSearch.toLowerCase())).map(o => (
                      <div key={o.key}
                        onClick={() => handleOtherEventSelect(o.key)}
                        style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: otherEvent === o.key ? '#4f46e5' : '#1e293b', background: otherEvent === o.key ? '#eef2ff' : 'transparent', fontWeight: otherEvent === o.key ? 600 : 500, marginBottom: 2 }}
                        onMouseEnter={e => { if (otherEvent !== o.key) e.currentTarget.style.background = '#f5f3ff'; }}
                        onMouseLeave={e => { if (otherEvent !== o.key) e.currentTarget.style.background = 'transparent'; }}>
                        {o.label}
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ TABS ══ */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0', marginBottom: 20 }}>
          {[['overview', 'Overview'], ['users', 'Users']].map(([t, l]) => (
            <div key={t} className="nc-tab"
              onClick={() => switchTab(t)}
              style={{ padding: '10px 22px', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: activeTab === t ? '#4f46e5' : '#334155', borderBottom: `3px solid ${activeTab === t ? '#4f46e5' : 'transparent'}`, marginBottom: -2, transition: 'all .18s' }}>
              {l}
            </div>
          ))}
        </div>

        {/* ══ OVERVIEW TAB ══ */}
        <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
          {overviewSubtitle && (
            <p style={{ textAlign: 'left', fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 8 }}>
              {overviewSubtitle.split('  |  ').map((part, i, arr) => (
                <span key={i}>
                  <span style={{ color: i === 0 ? '#4f46e5' : i === 1 ? '#10b981' : '#f43f5e' }}>{part}</span>
                  {i < arr.length - 1 && <span style={{ color: '#94a3b8' }}> &nbsp;|&nbsp; </span>}
                </span>
              ))}
            </p>
          )}
          {/* fixed-height wrapper — always reserves 460px, no layout shift */}
          <ChartBox height={460} loading={ldOverview}>
            <canvas ref={overviewRef} style={{ width: '100%', height: '100%' }} />
          </ChartBox>
        </div>

        {/* ══ USERS TAB ══ */}
        <div style={{ display: activeTab === 'users' ? 'block' : 'none', position: 'relative' }}>
          {ldUsers && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, minHeight: 80 }}>
              <DotsLoader />
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Email', 'Date'].map(h => (
                    <th key={h} style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, borderRight: '1px solid rgba(255,255,255,.18)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length === 0
                  ? <tr><td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13 }}>No users found</td></tr>
                  : users.map((u, i) => (
                    <tr key={i} className="nc-tr">
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8', fontWeight: 600, fontSize: 12 }}>{i + 1}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#4f46e5', fontSize: 13 }}>{u.email}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: 12 }}>{u.created_at}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* ══ PAYLOAD SECTION ══ */}
        <div style={{ marginTop: 50, background: '#FFFFE9', padding: 15, borderRadius: 8 }}>
          <h5 style={{ fontWeight: 600, color: '#1e293b', marginBottom: 10, fontSize: 14 }}>Top payloads for selected parameter</h5>
          <label style={{ display: 'block', fontSize: 13, color: '#475569', fontWeight: 500, marginBottom: 6 }}>Payload parameter</label>
          <div ref={payloadDropRef} style={{ position: 'relative', width: '30%', marginBottom: 16, zIndex: payloadDropOpen ? 9999 : 'auto' }}>
            <button type="button"
              onClick={() => setPayloadDropOpen(o => !o)}
              style={{ width: '100%', padding: '8px 30px 8px 10px', border: '1.5px solid #c4b5fd', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', color: payloadParam === 'select parameter' ? '#94a3b8' : '#1e293b', outline: 'none', background: '#fff', cursor: 'pointer', textAlign: 'left', position: 'relative' }}>
              {payloadParam}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', right: 10, top: '50%', transform: `translateY(-50%) rotate(${payloadDropOpen ? 180 : 0}deg)`, transition: 'transform .2s' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {payloadDropOpen && (
              <div className="nc-dropin"
                style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,.15)', border: '1.5px solid #ede9fe', zIndex: 9999, padding: 10 }}>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input autoFocus type="text" placeholder="Search"
                    value={payloadSearch}
                    onChange={e => setPayloadSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 30px 8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                    style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {(PAYLOAD_OPTIONS[activeEvent] || []).filter(p => p.toLowerCase().includes(payloadSearch.toLowerCase())).length === 0
                    ? <div style={{ padding: 10, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>No matches</div>
                    : (PAYLOAD_OPTIONS[activeEvent] || []).filter(p => p.toLowerCase().includes(payloadSearch.toLowerCase())).map(p => (
                      <div key={p}
                        onClick={() => handlePayloadChange(p)}
                        style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: payloadParam === p ? '#4f46e5' : '#1e293b', background: payloadParam === p ? '#eef2ff' : 'transparent', fontWeight: payloadParam === p ? 600 : 500, marginBottom: 2 }}
                        onMouseEnter={e => { if (payloadParam !== p) e.currentTarget.style.background = '#f5f3ff'; }}
                        onMouseLeave={e => { if (payloadParam !== p) e.currentTarget.style.background = 'transparent'; }}>
                        {p}
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
          {/* fixed-height box — space always reserved, no jump */}
          <ChartBox height={500} loading={ldPayload} noData={noPayload} noDataMsg={payloadParam !== 'select parameter' ? payloadNoDataMsg : 'Select a parameter to see chart'}>
            <canvas ref={payloadRef} style={{ width: '100%', height: '100%' }} />
          </ChartBox>
        </div>

        {/* ══ EVENT HOURLY SECTION ══ */}
        <div style={{ marginTop: 50, background: '#FFFFE9', padding: 15, borderRadius: 8 }}>
          <h5 style={{ fontWeight: 600, color: '#1e293b', marginBottom: 10, fontSize: 14 }}>Event performance throughout the day</h5>
          {/* fixed-height box */}
          <ChartBox height={500} loading={ldHourly} noData={noHourly} loaderColor="#f59e0b">
            <canvas ref={hourlyRef} style={{ width: '100%', height: '100%' }} />
          </ChartBox>
        </div>

        {/* ══ USER EVENT FREQUENCY SECTION ══ */}
        <div style={{ marginTop: 50, background: '#FFFFEC', padding: 15, borderRadius: 8 }}>
          <h5 style={{ fontWeight: 600, color: '#1e293b', marginBottom: 10, fontSize: 14 }}>Number of events performed by users</h5>
          {/* fixed-height box */}
          <ChartBox height={500} loading={ldFreq} noData={noFreq} loaderColor="#7c3aed">
            <canvas ref={freqRef} style={{ width: '100%', height: '100%' }} />
          </ChartBox>
        </div>

      </div>
    </>
  );
}