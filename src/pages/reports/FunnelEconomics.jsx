/* ============================================================================
   FUNNEL ECONOMICS — STANDALONE REACT COMPONENT
   File: FunnelEconomicsApp.jsx
   ----------------------------------------------------------------------------
   Self-contained. Zero imports beyond React. Drop in anywhere and use it as:

       import FunnelEconomicsApp from './FunnelEconomicsApp';
       <FunnelEconomicsApp apiUrl="/path/to/funnel_economics_api.php" />

   What it does:
     1. On mount, calls action=get_cit_versions to populate the version picker
     2. User picks CIT version(s) or a free date range, clicks Load
     3. Calls action=fetch_funnel_economics, fills the 8 sliders with live data
     4. Renders the HQ Funnel Economics dashboard (funnel viz, metrics,
        marginal lever analysis, one-line diagnosis, raw source counts)
     5. Sliders are editable for what-if; overridden ones show an amber badge

   Styling: all CSS is inline / scoped under .fe-wrap. Loads Bebas Neue +
   DM Mono + Inter from Google Fonts on first render. FontAwesome icons are
   used in the control bar — if your host page doesn't already include
   FontAwesome 6, add this once in your HTML <head>:

     <link rel="stylesheet"
           href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
   ============================================================================ */

import React, { useState, useEffect, useMemo, useCallback } from 'react';

/* ---------- Default backend endpoint ------------------------------------- */
const DEFAULT_API_URL =
    'https://cit3.internshipstudio.com/admin/react-api/api/reports/funnel_economics_api.php';

/* ---------- Built-in API dispatcher (no external dep) -------------------- */
async function apiAction(apiUrl, action, params = {}) {
    const fd = new FormData();
    fd.append('action', action);
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        fd.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
    });
    const res = await fetch(apiUrl, { method: 'POST', body: fd });
    return res.json();
}

/* ---------- Helpers ------------------------------------------------------- */
const fmt = (n, d = 0) => {
    if (!isFinite(n) || isNaN(n)) return '—';
    return n.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
};
const fmtINR = (n) => {
    if (!isFinite(n) || isNaN(n)) return '—';
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
    if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`;
    if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n.toFixed(0)}`;
};

/* ---------- 5-stage funnel math ------------------------------------------ */
function compute({ spend, cpm, ctr, lpCvr, examRate, checkoutCvr, aov, repeat }) {
    const imp   = cpm > 0 ? (spend / cpm) * 1000 : 0;
    const clk   = imp * ctr / 100;
    const reg   = clk * lpCvr / 100;
    const exam  = reg * examRate / 100;
    const purch = exam * checkoutCvr / 100;
    const rev   = purch * aov;
    const roas  = spend > 0 ? rev / spend : 0;
    const cac   = purch > 0 ? spend / purch : 0;
    const costPerReg  = reg  > 0 ? spend / reg  : 0;
    const costPerExam = exam > 0 ? spend / exam : 0;
    const ltv   = repeat < 100 ? aov * (1 / (1 - repeat / 100)) : 0;
    const ltvCac = cac > 0 ? ltv / cac : 0;
    return { imp, clk, reg, exam, purch, rev, roas, cac, costPerReg, costPerExam, ltv, ltvCac };
}

const roasHealth = (r) =>
    r >= 2 ? { label: 'HEALTHY', color: '#00ce48' }
  : r >= 1 ? { label: 'WARNING', color: '#f5a623' }
           : { label: 'DYING',   color: '#ff4d4d' };

const ltvHealth = (r) =>
    r >= 3   ? { label: 'HEALTHY', color: '#00ce48' }
  : r >= 1.5 ? { label: 'WARNING', color: '#f5a623' }
             : { label: 'DYING',   color: '#ff4d4d' };

/* ---------- Brand tokens for the HQ widget ------------------------------- */
const NAVY    = '#03112c';
const NAVY_2  = '#0a1e42';
const GREEN   = '#00ce48';
const AMBER   = '#f5a623';
const RED     = '#ff4d4d';

/* ---------- CSS (all scoped under .fe-wrap) ------------------------------ */
const FE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=Inter:wght@400;500;600&display=swap');

.fe-wrap { padding: 16px; font-family: 'Inter', -apple-system, sans-serif; background: #f0f2f5; min-height: 100vh; }
.fe-wrap * { box-sizing: border-box; }

/* Sticky control bar */
.fe-wrap .fe-controls-sticky {
    position: sticky; top: 0; z-index: 60;
    background: #f0f2f5; padding: 8px 0 14px; margin: 0 -4px 18px;
}
.fe-wrap .fe-controls {
    border: 1px solid #dddfe2; background: #fff;
    border-radius: 10px; padding: 16px 18px;
    display: flex; flex-direction: column; gap: 14px;
    box-shadow: 0 1px 2px rgba(0,0,0,.04);
}
.fe-wrap .fe-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.fe-wrap .fe-divider { height: 1px; background: #dddfe2; border: 0; margin: 2px 0; }
.fe-wrap .fe-section-label {
    font-size: 11px; font-weight: 700; color: #65676b;
    letter-spacing: .05em; text-transform: uppercase; margin-right: 4px;
}
.fe-wrap .fe-segmented {
    display: inline-flex; background: #eef2f7; padding: 3px;
    border-radius: 8px; border: 1px solid #dddfe2;
}
.fe-wrap .fe-segmented button {
    appearance: none; border: 0; background: transparent;
    padding: 6px 14px; font-size: 12.5px; font-weight: 600;
    color: #65676b; cursor: pointer; border-radius: 6px;
    font-family: inherit; display: inline-flex; align-items: center; gap: 6px;
    transition: all .15s;
}
.fe-wrap .fe-segmented button.is-on {
    background: #fff; color: #1877f2; box-shadow: 0 1px 3px rgba(0,0,0,.08);
}
.fe-wrap .fe-pill {
    padding: 6px 14px; border-radius: 20px; border: 1.5px solid #dddfe2;
    background: #fff; font-size: 12.5px; font-weight: 500;
    color: #050505; cursor: pointer; font-family: inherit;
    transition: all .15s; user-select: none;
}
.fe-wrap .fe-pill:hover { border-color: #1877f2; }
.fe-wrap .fe-pill.is-on { background: #1877f2; border-color: #1877f2; color: #fff; font-weight: 600; }
.fe-wrap .fe-show-more {
    padding: 6px 14px; border-radius: 20px; border: 1.5px dashed #1877f2;
    background: #fff; font-size: 12.5px; font-weight: 600;
    color: #1877f2; cursor: pointer; font-family: inherit;
}
.fe-wrap .fe-pills-wrap {
    display: flex; flex-wrap: wrap; gap: 6px;
    max-height: 44px; overflow: hidden; transition: max-height .25s ease;
    flex: 1; min-width: 0;
}
.fe-wrap .fe-pills-wrap.fe-pills-expanded { max-height: 600px; }
.fe-wrap .fe-date-range { display: flex; gap: 14px; align-items: flex-end; }
.fe-wrap .fe-date-range label {
    display: flex; flex-direction: column; gap: 5px;
    font-size: 11px; font-weight: 700; color: #65676b;
    text-transform: uppercase; letter-spacing: .04em;
}
.fe-wrap .fe-date-range input {
    padding: 8px 12px; border: 1px solid #dddfe2; border-radius: 6px;
    font-family: inherit; font-size: 13px; background: #fff;
    color: #050505; height: 36px;
}
.fe-wrap .fe-load-btn {
    padding: 9px 22px; border-radius: 8px; background: #1877f2;
    color: #fff; border: none; cursor: pointer; font-weight: 600;
    font-size: 13px; font-family: inherit;
    display: inline-flex; align-items: center; gap: 8px; height: 38px;
}
.fe-wrap .fe-load-btn:hover { background: #166fe5; }
.fe-wrap .fe-load-btn:disabled { opacity: .55; cursor: not-allowed; }
.fe-wrap .fe-ghost-btn {
    padding: 7px 14px; border-radius: 8px; border: 1px solid #dddfe2;
    background: #fff; font-size: 12.5px; font-weight: 600;
    cursor: pointer; color: #050505; font-family: inherit;
    display: inline-flex; align-items: center; gap: 6px;
}

/* Source bar */
.fe-wrap .fe-source-bar {
    display: flex; justify-content: space-between; align-items: center;
    margin: 4px 2px 14px; font-size: 12px; color: #65676b;
    flex-wrap: wrap; gap: 10px;
}
.fe-wrap .fe-chip {
    background: #e7f3ff; color: #1877f2; padding: 4px 10px;
    border-radius: 12px; font-weight: 600; font-size: 11.5px;
}
.fe-wrap .fe-override-pill {
    background: #fef9e7; color: #b7860e; border: 1px solid #f5d273;
    padding: 3px 10px; border-radius: 12px; font-weight: 600; font-size: 11px;
}

/* Alert */
.fe-wrap .fe-alert {
    padding: 12px 16px; background: #fee; border: 1px solid #fcc;
    color: #c00; border-radius: 6px; margin-bottom: 16px; font-size: 13px;
    display: flex; align-items: center; gap: 10px;
}

/* HQ widget */
.fe-wrap .fe-hq {
    background: ${NAVY}; border-radius: 14px; padding: 24px;
    color: #fff; font-family: 'Inter', sans-serif;
}
.fe-wrap .fe-hq-header {
    display: flex; justify-content: space-between; align-items: flex-end;
    margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 14px;
}
.fe-wrap .fe-hq-title {
    font-family: 'Bebas Neue', sans-serif; font-size: 38px;
    line-height: 1; letter-spacing: 0.02em;
}
.fe-wrap .fe-hq-subtitle {
    font-family: 'DM Mono', monospace; font-size: 10px;
    color: rgba(255,255,255,0.4); text-transform: uppercase;
    letter-spacing: 0.25em; margin-top: 6px;
}

.fe-wrap .fe-grid {
    display: grid; grid-template-columns: minmax(280px, 1fr) 2fr; gap: 18px;
}
@media (max-width: 1100px) { .fe-wrap .fe-grid { grid-template-columns: 1fr; } }

.fe-wrap .fe-panel {
    background: ${NAVY_2}; border: 1px solid rgba(255,255,255,0.05);
    border-radius: 14px; padding: 18px;
}
.fe-wrap .fe-panel-label {
    font-family: 'DM Mono', monospace; font-size: 10px;
    color: rgba(255,255,255,0.4); text-transform: uppercase;
    letter-spacing: 0.25em; margin-bottom: 14px;
}

/* Sliders */
.fe-wrap .fe-slider { margin-bottom: 14px; }
.fe-wrap .fe-slider-head {
    display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;
}
.fe-wrap .fe-slider-label {
    font-family: 'DM Mono', monospace; font-size: 10px;
    color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.15em;
    display: flex; align-items: center; gap: 6px;
}
.fe-wrap .fe-slider-value {
    font-family: 'Bebas Neue', sans-serif; color: ${GREEN};
    font-size: 22px; line-height: 1; font-variant-numeric: tabular-nums;
}
.fe-wrap .fe-slider-badge {
    font-size: 8px; padding: 2px 6px; border-radius: 4px;
    text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;
}
.fe-wrap .fe-slider-badge.auto    { background: rgba(0,206,72,0.15); color: ${GREEN}; }
.fe-wrap .fe-slider-badge.override{ background: rgba(245,166,35,0.15); color: ${AMBER}; }
.fe-wrap .fe-slider input[type=range] {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 14px; background: transparent; cursor: pointer;
}
.fe-wrap .fe-slider input[type=range]:focus { outline: none; }
.fe-wrap .fe-slider input[type=range]::-webkit-slider-runnable-track {
    height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px;
}
.fe-wrap .fe-slider input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 14px; height: 14px; background: ${GREEN};
    border-radius: 50%; margin-top: -5px; cursor: pointer;
    box-shadow: 0 0 0 4px rgba(0,206,72,0.18);
}
.fe-wrap .fe-slider input[type=range]::-moz-range-track {
    height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px;
}
.fe-wrap .fe-slider input[type=range]::-moz-range-thumb {
    width: 14px; height: 14px; background: ${GREEN}; border-radius: 50%;
    border: none; cursor: pointer; box-shadow: 0 0 0 4px rgba(0,206,72,0.18);
}

/* Metric cards */
.fe-wrap .fe-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
@media (max-width: 700px) { .fe-wrap .fe-metrics { grid-template-columns: repeat(2, 1fr); } }
.fe-wrap .fe-metric {
    background: ${NAVY_2}; border: 1px solid rgba(255,255,255,0.05);
    border-radius: 12px; padding: 16px;
}
.fe-wrap .fe-metric-label {
    font-family: 'DM Mono', monospace; font-size: 9.5px;
    color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.2em;
}
.fe-wrap .fe-metric-value {
    font-family: 'Bebas Neue', sans-serif; font-size: 38px; line-height: 1;
    margin-top: 8px; font-variant-numeric: tabular-nums;
}
.fe-wrap .fe-metric-health {
    font-family: 'DM Mono', monospace; font-size: 9px; padding: 2px 6px;
    border-radius: 4px; text-transform: uppercase; letter-spacing: 0.1em;
    float: right; font-weight: 700;
}

/* Funnel viz */
.fe-wrap .fe-funnel-stage { margin-bottom: 16px; }
.fe-wrap .fe-funnel-head {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 6px; gap: 12px;
}
.fe-wrap .fe-funnel-stage-label {
    font-family: 'DM Mono', monospace; font-size: 10px;
    color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.15em;
}
.fe-wrap .fe-funnel-rate {
    font-family: 'DM Mono', monospace; font-size: 10px;
    color: rgba(255,255,255,0.3); text-transform: uppercase;
    letter-spacing: 0.15em; margin-left: 10px;
}
.fe-wrap .fe-funnel-count {
    font-family: 'Bebas Neue', sans-serif; font-size: 26px;
    line-height: 1; font-variant-numeric: tabular-nums;
}
.fe-wrap .fe-funnel-pct {
    font-family: 'DM Mono', monospace; font-size: 10px;
    color: rgba(255,255,255,0.4); margin-left: 8px; font-variant-numeric: tabular-nums;
}
.fe-wrap .fe-funnel-bar {
    width: 100%; height: 8px; background: rgba(255,255,255,0.05);
    border-radius: 4px; overflow: hidden;
}
.fe-wrap .fe-funnel-fill {
    height: 100%; border-radius: 4px;
    background: linear-gradient(90deg, ${GREEN} 0%, ${GREEN}99 100%);
    transition: width 0.3s ease;
}

/* Lever ranking */
.fe-wrap .fe-top-lever {
    margin-bottom: 18px; padding: 18px; border-radius: 12px;
    background: linear-gradient(135deg, rgba(0,206,72,0.12), rgba(0,206,72,0.03));
    border: 1px solid rgba(0,206,72,0.25);
}
.fe-wrap .fe-top-lever-label {
    font-family: 'DM Mono', monospace; font-size: 10px;
    color: ${GREEN}; text-transform: uppercase; letter-spacing: 0.15em;
}
.fe-wrap .fe-top-lever-text {
    font-family: 'Bebas Neue', sans-serif; font-size: 32px;
    line-height: 1.2; margin-top: 8px;
}
.fe-wrap .fe-top-lever-detail { color: rgba(255,255,255,0.7); font-size: 13px; margin-top: 8px; }
.fe-wrap .fe-lever-row {
    display: grid; grid-template-columns: 30px 1fr 1fr 90px 70px;
    align-items: center; padding: 10px 12px; border-radius: 8px;
    transition: background 0.15s; font-family: 'DM Mono', monospace;
    font-size: 11px; margin-bottom: 2px;
}
.fe-wrap .fe-lever-row.is-top {
    background: rgba(0,206,72,0.08); border: 1px solid rgba(0,206,72,0.18);
}
.fe-wrap .fe-lever-rank {
    font-family: 'Bebas Neue', sans-serif; font-size: 20px; font-variant-numeric: tabular-nums;
}
.fe-wrap .fe-lever-roas {
    font-family: 'Bebas Neue', sans-serif; font-size: 18px;
    text-align: right; font-variant-numeric: tabular-nums;
}
.fe-wrap .fe-lever-gain {
    text-align: right; color: ${GREEN}; font-variant-numeric: tabular-nums;
}

/* Diagnosis */
.fe-wrap .fe-diagnosis {
    margin-top: 18px; padding: 18px; border-radius: 12px;
    background: linear-gradient(135deg, ${NAVY_2}, ${NAVY});
    border: 1px solid rgba(255,255,255,0.1);
}
.fe-wrap .fe-diagnosis-label {
    font-family: 'DM Mono', monospace; font-size: 10px;
    color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.25em;
}
.fe-wrap .fe-diagnosis-text {
    font-family: 'Bebas Neue', sans-serif; font-size: 24px;
    line-height: 1.3; margin-top: 8px;
}

/* Raw counts */
.fe-wrap .fe-raw {
    margin-top: 18px; padding: 16px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
    border-radius: 10px;
}
.fe-wrap .fe-raw-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px; margin-top: 10px;
}
.fe-wrap .fe-raw-item {
    font-family: 'DM Mono', monospace; font-size: 11px; color: rgba(255,255,255,0.6);
}
.fe-wrap .fe-raw-item strong {
    display: block; color: #fff; font-size: 14px; font-family: 'Bebas Neue', sans-serif;
    font-variant-numeric: tabular-nums; margin-top: 2px;
}

/* Empty / loading */
.fe-wrap .fe-empty {
    background: #fff; border: 1px solid #dddfe2; border-radius: 10px;
    padding: 64px 20px; text-align: center;
    box-shadow: 0 1px 2px rgba(0,0,0,.04);
}
.fe-wrap .fe-empty-icon {
    width: 64px; height: 64px; margin: 0 auto 14px;
    border-radius: 50%; background: #e7f3ff; color: #1877f2;
    display: flex; align-items: center; justify-content: center; font-size: 28px;
}
.fe-wrap .fe-spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,.3); border-radius: 50%;
    border-top-color: #fff; animation: fe-spin .6s linear infinite;
}
.fe-wrap .fe-spinner-blue {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid rgba(0,0,0,.15); border-radius: 50%;
    border-top-color: #1877f2; animation: fe-spin .6s linear infinite;
}
@keyframes fe-spin { to { transform: rotate(360deg); } }
`;

/* ============================================================================
   MAIN COMPONENT
   ============================================================================ */
export default function FunnelEconomicsApp({ apiUrl = DEFAULT_API_URL }) {

    /* ---------- Versions list (fetched on mount) ---------- */
    const [citVersions, setCitVersions] = useState([]);
    const [versionsLoading, setVersionsLoading] = useState(true);

    /* ---------- Data-source controls ---------- */
    const [inputMode, setInputMode] = useState('versions');
    const [selectedVersions, setSelectedVersions] = useState([]);
    const [fromDate, setFromDate] = useState('');
    const [toDate,   setToDate]   = useState('');
    const [pillsExpanded, setPillsExpanded] = useState(false);

    /* ---------- Fetched funnel state ---------- */
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);
    const [sourceInputs, setSourceInputs] = useState(null);
    const [rawCounts,    setRawCounts]    = useState(null);
    const [sourceLabel,  setSourceLabel]  = useState('');
    const [fetchedAt,    setFetchedAt]    = useState(null);

    /* ---------- Slider overrides (for what-if) ---------- */
    const [overrides, setOverrides] = useState({});

    /* ---------- Fetch versions on mount ---------- */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setVersionsLoading(true);
            try {
                const data = await apiAction(apiUrl, 'get_cit_versions');
                if (cancelled) return;
                if (data.success && Array.isArray(data.versions)) {
                    setCitVersions(data.versions);
                    if (data.versions.length > 0) {
                        setSelectedVersions([data.versions[0]]);
                    }
                } else {
                    setError(data.message || 'Failed to load CIT versions');
                }
            } catch (e) {
                if (!cancelled) setError('Network error loading versions: ' + e.message);
            } finally {
                if (!cancelled) setVersionsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [apiUrl]);

    const toggleVersion = (v) => {
        setSelectedVersions(prev =>
            prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
        );
    };

    const fetchFunnel = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = { mode: inputMode };
            if (inputMode === 'versions') {
                if (selectedVersions.length === 0) {
                    setError('Pick at least one CIT version');
                    setLoading(false);
                    return;
                }
                params.versions = selectedVersions;
            } else {
                if (!fromDate || !toDate) {
                    setError('Pick a from and to date');
                    setLoading(false);
                    return;
                }
                params.from_date = fromDate;
                params.to_date   = toDate;
            }
            const data = await apiAction(apiUrl, 'fetch_funnel_economics', params);
            if (data.token_expired) {
                setError('Meta Access Token Expired. Update it in your settings.');
                return;
            }
            if (!data.success) {
                setError(data.message || 'Failed to load funnel economics');
                return;
            }
            setSourceInputs(data.inputs);
            setRawCounts(data.raw);
            setSourceLabel(data.source?.label || '');
            setFetchedAt(data.fetched_at || new Date().toISOString());
            setOverrides({});
        } catch (e) {
            setError('Network error: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, [apiUrl, inputMode, selectedVersions, fromDate, toDate]);

    /* ---------- Effective inputs = source + overrides ---------- */
    const effective = useMemo(() => {
        if (!sourceInputs) return null;
        return { ...sourceInputs, ...overrides };
    }, [sourceInputs, overrides]);

    const isOverridden  = (key) => Object.prototype.hasOwnProperty.call(overrides, key);
    const setOverride   = (key, val) => setOverrides(o => ({ ...o, [key]: val }));
    const resetOverride = (key) => setOverrides(o => { const n = { ...o }; delete n[key]; return n; });
    const resetAllOverrides = () => setOverrides({});

    const base = useMemo(() => effective ? compute(effective) : null, [effective]);

    const levers = useMemo(() => {
        if (!effective || !base) return [];
        const variants = [
            { key: 'cpm',         label: 'CPM',          change: '−10%',
              detail: `₹${effective.cpm.toFixed(2)} → ₹${(effective.cpm * 0.9).toFixed(2)}`,
              mod: (i) => ({ ...i, cpm: i.cpm * 0.9 }) },
            { key: 'ctr',         label: 'CTR',          change: '+10%',
              detail: `${effective.ctr.toFixed(2)}% → ${(effective.ctr * 1.1).toFixed(2)}%`,
              mod: (i) => ({ ...i, ctr: i.ctr * 1.1 }) },
            { key: 'lpCvr',       label: 'LP CVR',       change: '+10%',
              detail: `${effective.lpCvr.toFixed(2)}% → ${(effective.lpCvr * 1.1).toFixed(2)}%`,
              mod: (i) => ({ ...i, lpCvr: i.lpCvr * 1.1 }) },
            { key: 'examRate',    label: 'EXAM RATE',    change: '+10%',
              detail: `${effective.examRate.toFixed(2)}% → ${(effective.examRate * 1.1).toFixed(2)}%`,
              mod: (i) => ({ ...i, examRate: i.examRate * 1.1 }) },
            { key: 'checkoutCvr', label: 'CHECKOUT CVR', change: '+10%',
              detail: `${effective.checkoutCvr.toFixed(2)}% → ${(effective.checkoutCvr * 1.1).toFixed(2)}%`,
              mod: (i) => ({ ...i, checkoutCvr: i.checkoutCvr * 1.1 }) },
            { key: 'aov',         label: 'AOV',          change: '+10%',
              detail: `₹${effective.aov.toFixed(0)} → ₹${(effective.aov * 1.1).toFixed(0)}`,
              mod: (i) => ({ ...i, aov: i.aov * 1.1 }) },
        ];
        return variants.map(v => {
            const newRoas = compute(v.mod(effective)).roas;
            return { ...v, newRoas, gain: newRoas - base.roas };
        }).sort((a, b) => b.gain - a.gain);
    }, [effective, base]);

    const PILL_VISIBLE = 12;
    const visiblePills = pillsExpanded ? citVersions : citVersions.slice(0, PILL_VISIBLE);
    const hasMorePills = citVersions.length > PILL_VISIBLE;

    const rh = base ? roasHealth(base.roas)  : null;
    const lh = base ? ltvHealth(base.ltvCac) : null;

    const stages = base && effective ? [
        { label: 'IMPRESSIONS',   value: base.imp,   rate: 'BASELINE' },
        { label: 'CLICKS',        value: base.clk,   rate: `CTR ${effective.ctr.toFixed(2)}%` },
        { label: 'REGISTRATIONS', value: base.reg,   rate: `LP CVR ${effective.lpCvr.toFixed(2)}%` },
        { label: 'EXAMS',         value: base.exam,  rate: `EXAM RATE ${effective.examRate.toFixed(2)}%` },
        { label: 'PURCHASES',     value: base.purch, rate: `CHECKOUT CVR ${effective.checkoutCvr.toFixed(2)}%` },
    ] : [];

    return (
        <div className="fe-wrap">
            <style>{FE_CSS}</style>

            {/* ====== Sticky control bar ====== */}
            <div className="fe-controls-sticky">
                <div className="fe-controls">
                    <div className="fe-row" style={{ justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 600, color: '#050505' }}>Funnel Economics</div>
                            <div style={{ fontSize: 12, color: '#65676b', marginTop: 2 }}>
                                Live data from Meta Ads + Internship Studio backend
                            </div>
                        </div>
                        <div className="fe-segmented" role="tablist">
                            <button
                                className={inputMode === 'versions' ? 'is-on' : ''}
                                onClick={() => setInputMode('versions')}
                            >
                                <i className="fas fa-tags"></i> CIT Versions
                            </button>
                            <button
                                className={inputMode === 'daterange' ? 'is-on' : ''}
                                onClick={() => setInputMode('daterange')}
                            >
                                <i className="fas fa-calendar-week"></i> Date Range
                            </button>
                        </div>
                    </div>

                    <hr className="fe-divider" />

                    {inputMode === 'versions' ? (
                        <div className="fe-row">
                            <div className="fe-section-label">Select CIT Versions</div>
                            <div className={`fe-pills-wrap ${pillsExpanded ? 'fe-pills-expanded' : ''}`}>
                                {versionsLoading && (
                                    <span style={{ color: '#65676b', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                        <span className="fe-spinner-blue"></span> Loading versions...
                                    </span>
                                )}
                                {!versionsLoading && visiblePills.map(v => (
                                    <button
                                        key={v}
                                        className={`fe-pill ${selectedVersions.includes(v) ? 'is-on' : ''}`}
                                        onClick={() => toggleVersion(v)}
                                    >
                                        {v}
                                    </button>
                                ))}
                                {hasMorePills && (
                                    <button
                                        className="fe-show-more"
                                        onClick={() => setPillsExpanded(e => !e)}
                                    >
                                        {pillsExpanded
                                            ? 'Show less'
                                            : `Show more (${citVersions.length - PILL_VISIBLE})`}
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="fe-row">
                            <div className="fe-section-label">Select Date Range</div>
                            <div className="fe-date-range">
                                <label>From
                                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                                </label>
                                <label>To
                                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                                </label>
                            </div>
                        </div>
                    )}

                    <hr className="fe-divider" />

                    <div className="fe-row" style={{ justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 12, color: '#65676b' }}>
                            <i className="fas fa-info-circle" style={{ marginRight: 6, color: '#1877f2' }} />
                            Numbers are pulled live. Drag any slider after to run what-if scenarios.
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            {Object.keys(overrides).length > 0 && (
                                <button className="fe-ghost-btn" onClick={resetAllOverrides}>
                                    <i className="fas fa-undo"></i> Reset overrides
                                </button>
                            )}
                            <button className="fe-load-btn" onClick={fetchFunnel} disabled={loading}>
                                {loading
                                    ? <><span className="fe-spinner"></span> Loading...</>
                                    : <><i className="fas fa-chart-line"></i> {sourceInputs ? 'Refresh' : 'Load Funnel'}</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ====== Source bar ====== */}
            {sourceInputs && (
                <div className="fe-source-bar">
                    <span>
                        Source: <span className="fe-chip">{sourceLabel}</span>
                        {fetchedAt && <> &middot; fetched {String(fetchedAt).replace('T', ' ').slice(0, 19)}</>}
                    </span>
                    {Object.keys(overrides).length > 0 && (
                        <span className="fe-override-pill">
                            <i className="fas fa-edit" style={{ marginRight: 4 }} />
                            {Object.keys(overrides).length} manual override(s) active
                        </span>
                    )}
                </div>
            )}

            {/* ====== Error ====== */}
            {error && (
                <div className="fe-alert">
                    <i className="fas fa-exclamation-circle"></i>
                    <span>{error}</span>
                </div>
            )}

            {/* ====== Empty state ====== */}
            {!sourceInputs && !loading && !error && (
                <div className="fe-empty">
                    <div className="fe-empty-icon"><i className="fas fa-funnel-dollar"></i></div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>Ready to run Funnel Economics</div>
                    <div style={{ fontSize: 13, color: '#65676b', marginTop: 4 }}>
                        Pick CIT versions or a date range above, then click Load Funnel.
                    </div>
                </div>
            )}

            {/* ====== HQ Funnel Economics widget ====== */}
            {effective && base && (
                <div className="fe-hq">
                    <div className="fe-hq-header">
                        <div>
                            <div className="fe-hq-title">
                                FUNNEL <span style={{ color: GREEN }}>ECONOMICS</span>
                            </div>
                            <div className="fe-hq-subtitle">
                                LIVE · 5-STAGE FUNNEL · INTERNSHIP STUDIO
                            </div>
                        </div>
                    </div>

                    <div className="fe-grid">
                        {/* LEFT: SLIDERS */}
                        <div className="fe-panel">
                            <div className="fe-panel-label">// THE 8 INPUTS</div>

                            <FeSlider label="AD SPEND" value={effective.spend}
                                min={10000} max={Math.max(effective.spend * 3, 5000000)} step={1000}
                                display={fmtINR(effective.spend)}
                                isOverridden={isOverridden('spend')}
                                onChange={(v) => setOverride('spend', v)}
                                onReset={() => resetOverride('spend')} />

                            <FeSlider label="CPM" value={effective.cpm}
                                min={1} max={Math.max(effective.cpm * 3, 100)} step={0.01}
                                display={`₹${effective.cpm.toFixed(2)}`}
                                isOverridden={isOverridden('cpm')}
                                onChange={(v) => setOverride('cpm', v)}
                                onReset={() => resetOverride('cpm')} />

                            <FeSlider label="CTR · Imp → Click" value={effective.ctr}
                                min={0.05} max={Math.max(effective.ctr * 3, 5)} step={0.01}
                                display={`${effective.ctr.toFixed(2)}%`}
                                isOverridden={isOverridden('ctr')}
                                onChange={(v) => setOverride('ctr', v)}
                                onReset={() => resetOverride('ctr')} />

                            <FeSlider label="LP CVR · Click → Reg" value={effective.lpCvr}
                                min={0.5} max={Math.max(effective.lpCvr * 3, 50)} step={0.01}
                                display={`${effective.lpCvr.toFixed(2)}%`}
                                isOverridden={isOverridden('lpCvr')}
                                onChange={(v) => setOverride('lpCvr', v)}
                                onReset={() => resetOverride('lpCvr')} />

                            <FeSlider label="EXAM RATE · Reg → Exam" value={effective.examRate}
                                min={5} max={100} step={0.1}
                                display={`${effective.examRate.toFixed(2)}%`}
                                isOverridden={isOverridden('examRate')}
                                onChange={(v) => setOverride('examRate', v)}
                                onReset={() => resetOverride('examRate')} />

                            <FeSlider label="CHECKOUT CVR · Exam → INT" value={effective.checkoutCvr}
                                min={0.5} max={Math.max(effective.checkoutCvr * 3, 50)} step={0.01}
                                display={`${effective.checkoutCvr.toFixed(2)}%`}
                                isOverridden={isOverridden('checkoutCvr')}
                                onChange={(v) => setOverride('checkoutCvr', v)}
                                onReset={() => resetOverride('checkoutCvr')} />

                            <FeSlider label="AOV" value={effective.aov}
                                min={50} max={Math.max(effective.aov * 5, 10000)} step={1}
                                display={`₹${fmt(effective.aov, 0)}`}
                                isOverridden={isOverridden('aov')}
                                onChange={(v) => setOverride('aov', v)}
                                onReset={() => resetOverride('aov')} />

                            <FeSlider label="REPEAT RATE" value={effective.repeat}
                                min={0} max={80} step={0.1}
                                display={`${effective.repeat.toFixed(2)}%`}
                                isOverridden={isOverridden('repeat')}
                                onChange={(v) => setOverride('repeat', v)}
                                onReset={() => resetOverride('repeat')} />
                        </div>

                        {/* RIGHT: METRICS + FUNNEL + LEVERS */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                            <div className="fe-metrics">
                                <Metric label="ROAS"        value={`${base.roas.toFixed(2)}x`}    health={rh} />
                                <Metric label="LTV : CAC"   value={`${base.ltvCac.toFixed(2)}x`}  health={lh} />
                                <Metric label="MONTHLY REV" value={fmtINR(base.rev)} />
                                <Metric label="CAC"         value={fmtINR(base.cac)} />
                                <Metric label="COST / EXAM" value={fmtINR(base.costPerExam)} />
                                <Metric label="COST / REG"  value={fmtINR(base.costPerReg)} />
                                <Metric label="LTV"         value={fmtINR(base.ltv)} />
                                <Metric label="PURCHASES"   value={fmt(base.purch)} />
                            </div>

                            <div className="fe-panel">
                                <div className="fe-panel-label">// THE FUNNEL · 5 STAGES</div>
                                {stages.map((s, i) => {
                                    const pct = base.imp > 0 ? (s.value / base.imp) * 100 : 0;
                                    const width = Math.max(pct, 0.4);
                                    return (
                                        <div key={i} className="fe-funnel-stage">
                                            <div className="fe-funnel-head">
                                                <div>
                                                    <span className="fe-funnel-stage-label">{s.label}</span>
                                                    <span className="fe-funnel-rate">{s.rate}</span>
                                                </div>
                                                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    <span className="fe-funnel-count">{fmt(s.value)}</span>
                                                    <span className="fe-funnel-pct">{pct < 0.1 ? pct.toFixed(4) : pct.toFixed(2)}%</span>
                                                </div>
                                            </div>
                                            <div className="fe-funnel-bar">
                                                <div className="fe-funnel-fill" style={{ width: `${width}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="fe-panel">
                                <div className="fe-panel-label">// MARGINAL LEVER ANALYSIS</div>

                                <div className="fe-top-lever">
                                    <div className="fe-top-lever-label">► TOP LEVER THIS WEEK</div>
                                    <div className="fe-top-lever-text">
                                        Focus on <span style={{ color: GREEN }}>{levers[0]?.label}</span>.
                                    </div>
                                    <div className="fe-top-lever-detail">
                                        A 10% improvement moves ROAS from <span style={{ color: '#fff' }}>{base.roas.toFixed(2)}x</span> to{' '}
                                        <span style={{ color: GREEN }}>{levers[0]?.newRoas.toFixed(2)}x</span>.
                                    </div>
                                </div>

                                <div className="fe-panel-label" style={{ marginBottom: 6 }}>FULL RANKING</div>
                                {levers.map((l, i) => (
                                    <div key={l.key} className={`fe-lever-row ${i === 0 ? 'is-top' : ''}`}>
                                        <div className="fe-lever-rank" style={{ color: i === 0 ? GREEN : 'rgba(255,255,255,0.4)' }}>{i + 1}</div>
                                        <div style={{ fontWeight: 600, color: '#fff' }}>{l.label} {l.change}</div>
                                        <div style={{ color: 'rgba(255,255,255,0.5)' }}>{l.detail}</div>
                                        <div className="fe-lever-roas">{l.newRoas.toFixed(2)}x</div>
                                        <div className="fe-lever-gain">+{l.gain.toFixed(3)}</div>
                                    </div>
                                ))}
                                <div style={{
                                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                                    color: 'rgba(255,255,255,0.3)', marginTop: 12,
                                    lineHeight: 1.6, textTransform: 'uppercase', letterSpacing: '0.15em',
                                }}>
                                    AD SPEND EXCLUDED · scaling does not change ROAS holding rates constant<br />
                                    REPEAT RATE EXCLUDED · it only affects LTV, not ROAS
                                </div>
                            </div>

                            <div className="fe-diagnosis">
                                <div className="fe-diagnosis-label">// ONE-LINE DIAGNOSIS</div>
                                <div className="fe-diagnosis-text">
                                    {base.roas >= 2 && base.ltvCac >= 3 && (
                                        <>Funnel is <span style={{ color: GREEN }}>healthy</span>. Lift {levers[0]?.label.toLowerCase()} to scale, watch repeat rate to compound LTV.</>
                                    )}
                                    {base.roas >= 2 && base.ltvCac < 3 && (
                                        <>ROAS is fine but <span style={{ color: AMBER }}>LTV:CAC is thin</span>. Push repeat rate or AOV before scaling spend.</>
                                    )}
                                    {base.roas >= 1 && base.roas < 2 && (
                                        <>Funnel is in the <span style={{ color: AMBER }}>warning zone</span>. Top lever this week is {levers[0]?.label.toLowerCase()}.</>
                                    )}
                                    {base.roas < 1 && (
                                        <>Funnel is <span style={{ color: RED }}>dying</span>. Every rupee in returns less than a rupee. Fix {levers[0]?.label.toLowerCase()} before adding budget.</>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Raw counts */}
                    {rawCounts && (
                        <div className="fe-raw">
                            <div className="fe-panel-label">// SOURCE DATA · the actual counts behind the inputs</div>
                            <div className="fe-raw-grid">
                                <div className="fe-raw-item">Spend <strong>{fmtINR(rawCounts.spend)}</strong></div>
                                <div className="fe-raw-item">Impressions <strong>{fmt(rawCounts.impressions)}</strong></div>
                                <div className="fe-raw-item">Link Clicks <strong>{fmt(rawCounts.link_clicks_used)}</strong></div>
                                <div className="fe-raw-item">Registrations <strong>{fmt(rawCounts.registrations)}</strong></div>
                                <div className="fe-raw-item">Exams <strong>{fmt(rawCounts.exam_count)}</strong></div>
                                <div className="fe-raw-item">Internships <strong>{fmt(rawCounts.internship_count)}</strong></div>
                                <div className="fe-raw-item">2nd Internships <strong>{fmt(rawCounts.second_internship)}</strong></div>
                                <div className="fe-raw-item">Revenue <strong>{fmtINR(rawCounts.revenue)}</strong></div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ---------- Sub-components ----------------------------------------------- */
function FeSlider({ label, value, onChange, onReset, min, max, step, display, isOverridden }) {
    return (
        <div className="fe-slider">
            <div className="fe-slider-head">
                <span className="fe-slider-label">
                    {label}
                    <span className={`fe-slider-badge ${isOverridden ? 'override' : 'auto'}`}>
                        {isOverridden ? 'OVERRIDE' : 'AUTO'}
                    </span>
                    {isOverridden && (
                        <button
                            onClick={onReset}
                            title="Reset to source value"
                            style={{
                                background: 'transparent', border: 'none',
                                color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                                fontSize: 10, padding: 0, marginLeft: 2,
                            }}
                        >
                            <i className="fas fa-undo-alt"></i>
                        </button>
                    )}
                </span>
                <span className="fe-slider-value">{display}</span>
            </div>
            <input
                type="range"
                min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
            />
        </div>
    );
}

function Metric({ label, value, health }) {
    return (
        <div className="fe-metric">
            {health && (
                <span className="fe-metric-health" style={{
                    background: `${health.color}1a`, color: health.color,
                }}>{health.label}</span>
            )}
            <div className="fe-metric-label">{label}</div>
            <div className="fe-metric-value">{value}</div>
        </div>
    );
}