// /* ==========================================================================
//    META ADS ROI ANALYTICS DASHBOARD - React Single File (1:1 with PHP version)
//    - All backend calls go through ONE endpoint as action-based POST (same as PHP)
//    - All state / selection / sort / filter / comparison logic preserved
//    - All CSS embedded - drop-in component
//    - Requires FontAwesome 6 + Inter font in the host page (CDN links below)
//    ==========================================================================

//    HOST PAGE HEAD (add once):
//    <link rel="preconnect" href="https://fonts.googleapis.com">
//    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
//    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

//    USAGE:
//    import MetaAdsDashboard from './MetaAdsDashboard';
//    <MetaAdsDashboard apiUrl="/admin/real_time_reports2.php" />
//    ========================================================================== */

// import React, { useState, useEffect, useRef, useCallback } from 'react';

// /* =========================================================================
//    1. API DISPATCHER - action based, same pattern as the PHP file
//    ========================================================================= */
// async function apiAction(apiUrl, action, params = {}) {
//     const fd = new FormData();
//     fd.append('action', action);
//     Object.entries(params).forEach(([k, v]) => {
//         if (v === undefined || v === null) return;
//         fd.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
//     });
//     const res = await fetch(apiUrl, {
//         method: 'POST',
//         body: fd,
//     });
//     return res.json();
// }

// /* =========================================================================
//    2. HELPERS
//    ========================================================================= */
// const formatCurrency = (v) =>
//     new Intl.NumberFormat('en-IN', {
//         style: 'currency',
//         currency: 'INR',
//         minimumFractionDigits: 0,
//         maximumFractionDigits: 0,
//     }).format(v || 0);

// const formatNumber = (v) => new Intl.NumberFormat('en-IN').format(v || 0);

// const toYMD = (d) => {
//     const y = d.getFullYear();
//     const m = String(d.getMonth() + 1).padStart(2, '0');
//     const dd = String(d.getDate()).padStart(2, '0');
//     return `${y}-${m}-${dd}`;
// };

// const parseYMD = (s) => {
//     const [y, m, d] = s.split('-').map(Number);
//     return new Date(y, m - 1, d);
// };

// const formatDisplay = (d) => {
//     const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
//     return `${d.getDate()} ${months[d.getMonth()]}`;
// };

// const getPreviousPeriod = (fromStr, toStr) => {
//     const from = new Date(fromStr);
//     const to = new Date(toStr);
//     const diff = Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1;
//     const prevTo = new Date(from);
//     prevTo.setDate(prevTo.getDate() - 1);
//     const prevFrom = new Date(prevTo);
//     prevFrom.setDate(prevFrom.getDate() - diff + 1);
//     return { from: toYMD(prevFrom), to: toYMD(prevTo) };
// };

// const escapeHtml = (s) =>
//     String(s ?? '')
//         .replace(/&/g, '&amp;')
//         .replace(/</g, '&lt;')
//         .replace(/>/g, '&gt;')
//         .replace(/"/g, '&quot;');

// const formatMetricValue = (col, v) => {
//     const currency = ['spend','cost_per_registration','cost_per_exam','cost_per_internship','revenue','rpu','cac_all','cac_paid'];
//     return currency.includes(col) ? formatCurrency(v) : formatNumber(v);
// };

// /* =========================================================================
//    3. COLUMN DEFINITIONS (used for rendering + comparison expansion)
//    ========================================================================= */
// const METRIC_COLS = [
//     { key: 'spend',                  label: 'Spend',       type: 'currency', expandable: true  },
//     { key: 'registrations',          label: 'Registrations',type: 'number',  expandable: true  },
//     { key: 'cost_per_registration',  label: 'Cost/Reg',    type: 'currency', expandable: true  },
//     { key: 'exam_count',             label: 'Exams',       type: 'number',   expandable: true  },
//     { key: 'cost_per_exam',          label: 'Cost/Exam',   type: 'currency', expandable: true  },
//     { key: 'exam_percent',           label: 'Exam %',      type: 'percent',  expandable: false },
//     { key: 'internship_count',       label: 'Internships', type: 'number',   expandable: true  },
//     { key: 'second_internship',      label: '2nd Intern',  type: 'number',   expandable: true  },
//     { key: 'cost_per_internship',    label: 'Cost/Intern', type: 'currency', expandable: true  },
//     { key: 'revenue',                label: 'Revenue',     type: 'currency', expandable: true  },
//     { key: 'roi',                    label: 'ROI',         type: 'ratio',    expandable: true  },
//     { key: 'rpu',                    label: 'RPU',         type: 'currency', expandable: true  },
//     { key: 'cac_all',                label: 'CAC (All)',   type: 'currency', expandable: true  },
//     { key: 'cac_paid',               label: 'CAC (Paid)',  type: 'currency', expandable: true  },
//     { key: 'roas',                   label: 'ROAS',        type: 'ratio',    expandable: true  },
// ];

// /* =========================================================================
//    VERSION ANALYSIS - metric definitions + helpers (per PDF spec)
//    Cost metrics: lower is better  (CPM, CPC, CPL, Cost Per Exam, Spend)
//    Performance metrics: higher is better  (CTR, ROI)
//    ========================================================================= */
// const VA_METRICS = [
//     { key: 'cpm',            label: 'CPM',            type: 'currency', lowerIsBetter: true  },
//     { key: 'cpc',            label: 'CPC',            type: 'currency', lowerIsBetter: true  },
//     { key: 'ctr',            label: 'CTR',            type: 'percent',  lowerIsBetter: false },
//     { key: 'cpl',            label: 'CPL',            type: 'currency', lowerIsBetter: true  },
//     { key: 'cost_per_exam',  label: 'Cost Per Exam',  type: 'currency', lowerIsBetter: true  },
//     { key: 'roi',            label: 'ROI',            type: 'ratio',    lowerIsBetter: false },
//     { key: 'spend',          label: 'Spend',          type: 'currency', lowerIsBetter: true  },
// ];
// const VA_METRIC_MAP = Object.fromEntries(VA_METRICS.map(m => [m.key, m]));

// /** Format a metric value for display. Returns "—" for null/undefined. */
// function vaFormat(val, metricKey) {
//     if (val === null || val === undefined) return '\u2014';
//     const m = VA_METRIC_MAP[metricKey];
//     if (!m) return String(val);
//     if (m.type === 'percent')  return Number(val).toFixed(2) + '%';
//     if (m.type === 'ratio')    return Number(val).toFixed(2);
//     // currency - keep 2 decimals so small differences (that show up in the
//     // percentage column) are visible instead of being hidden by rounding
//     return '\u20B9' + Number(val).toLocaleString('en-IN', {
//         minimumFractionDigits: 2,
//         maximumFractionDigits: 2,
//     });
// }

// /**
//  * Compute the trend object for a metric vs previous row.
//  * Returns { arrow, pct, cls } or null (baseline / missing data).
//  *
//  * Sign convention (per user spec):
//  *   Value went UP from previous row   →  ▲ green with +X% (profit/gain)
//  *   Value went DOWN from previous row →  ▼ red with -X%   (loss)
//  *   Value unchanged                   →  no arrow, 0%
//  *
//  * Pure mathematical direction — applies to ALL metrics the same way,
//  * regardless of whether higher or lower is "business-better".
//  */
// function vaTrend(current, previous, metricKey) {
//     if (current === null || current === undefined) return null;
//     if (previous === null || previous === undefined) return null;
//     if (Number(previous) === 0) return { pct: 'N/A', cls: 'vwa-trend-neutral', arrow: '' };

//     // Same value -> neutral, no arrow
//     if (Number(current) === Number(previous)) {
//         return { pct: '+0.0%', cls: 'vwa-trend-neutral', arrow: '' };
//     }

//     const rawPct = ((Number(current) - Number(previous)) / Number(previous)) * 100;
//     const rounded = Math.round(rawPct * 10) / 10;
//     const isUp = Number(current) > Number(previous);

//     return {
//         // rounded already carries its own +/- sign
//         pct: (rounded >= 0 ? '+' : '') + rounded.toFixed(1) + '%',
//         cls: isUp ? 'vwa-trend-up' : 'vwa-trend-down',
//         arrow: isUp ? '\u25B2' : '\u25BC',   // ▲ / ▼
//     };
// }

// /* =========================================================================
//    4. EMBEDDED CSS (1:1 with meta-ads-dashboard.css)
//    ========================================================================= */
// const DASHBOARD_CSS = `
// .mad-wrap * { box-sizing: border-box; }
// .mad-wrap {
//     --primary: #1877f2;
//     --primary-hover: #166fe5;
//     --success: #42b72a;
//     --text-primary: #050505;
//     --text-secondary: #65676b;
//     --border: #dddfe2;
//     --bg-light: #f0f2f5;
//     --bg-white: #ffffff;
//     --bg-hover: #f2f3f5;
//     --bg-selected: #e7f3ff;
//     --shadow: 0 1px 2px rgba(0,0,0,.1);
//     font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
//     background: var(--bg-light);
//     color: var(--text-primary);
//     font-size: 14px;
//     line-height: 1.5;
//     min-height: 100vh;
// }
// .mad-wrap .container { max-width: 100%; margin: 0; padding: 16px; }

// .mad-wrap .dashboard-header {
//     background: var(--bg-white);
//     border-radius: 8px;
//     padding: 20px;
//     margin-bottom: 16px;
//     box-shadow: var(--shadow);
// }
// .mad-wrap .header-title { font-size: 20px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
// .mad-wrap .header-subtitle { font-size: 13px; color: var(--text-secondary); }

// .mad-wrap .filters-section {
//     background: var(--bg-white);
//     border-radius: 8px;
//     padding: 16px;
//     margin-bottom: 16px;
//     box-shadow: var(--shadow);
// }
// .mad-wrap .filter-group { display: flex; flex-direction: column; gap: 6px; }
// .mad-wrap .filter-label {
//     font-size: 12px; font-weight: 600; color: var(--text-secondary);
//     text-transform: uppercase; letter-spacing: .3px;
// }
// .mad-wrap .filter-select, .mad-wrap .filter-input {
//     width: 100%; padding: 8px 12px; border: 1px solid var(--border);
//     border-radius: 6px; font-size: 13px; font-family: inherit;
//     background: var(--bg-white); color: var(--text-primary);
// }
// .mad-wrap .filter-select:focus, .mad-wrap .filter-input:focus {
//     outline: none; border-color: var(--primary);
//     box-shadow: 0 0 0 2px rgba(24,119,242,.1);
// }
// .mad-wrap .btn-primary {
//     padding: 8px 16px; background: var(--primary); color: #fff;
//     border: none; border-radius: 6px; font-size: 13px; font-weight: 600;
//     cursor: pointer; display: flex; align-items: center; gap: 6px;
//     justify-content: center; white-space: nowrap; height: 36px;
// }
// .mad-wrap .btn-primary:hover { background: var(--primary-hover); }
// .mad-wrap .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

// .mad-wrap .search-date-row {
//     display: flex; gap: 12px; align-items: flex-end; margin-bottom: 12px;
//     flex-wrap: wrap;
// }
// .mad-wrap .search-wrapper { flex: 1; position: relative; min-width: 280px; }
// .mad-wrap .search-wrapper input {
//     width: 100%; padding: 9px 14px 9px 38px; border: 1px solid var(--border);
//     border-radius: 6px; font-size: 13px; font-family: inherit;
//     background: var(--bg-white); color: var(--text-primary);
// }
// .mad-wrap .search-wrapper input:focus {
//     outline: none; border-color: var(--primary);
//     box-shadow: 0 0 0 2px rgba(24,119,242,.1);
// }
// .mad-wrap .search-wrapper .search-icon {
//     position: absolute; left: 12px; top: 38px; font-size: 13px;
//     color: var(--text-secondary); pointer-events: none;
// }
// .mad-wrap .search-suggestions {
//     display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0;
//     background: #fff; border: 1px solid var(--border); border-radius: 6px;
//     box-shadow: 0 4px 12px rgba(0,0,0,.12); z-index: 100;
//     max-height: 220px; overflow-y: auto;
// }
// .mad-wrap .search-suggestions.visible { display: block; }
// .mad-wrap .suggestion-item {
//     padding: 8px 12px; font-size: 12.5px; color: var(--text-primary);
//     cursor: pointer; white-space: nowrap; overflow: hidden;
//     text-overflow: ellipsis;
// }
// .mad-wrap .suggestion-item:hover { background: var(--bg-selected); }
// .mad-wrap .suggestion-item .highlight { color: var(--primary); font-weight: 600; }

// .mad-wrap .date-range-btn {
//     display: flex; align-items: center; gap: 8px;
//     padding: 9px 14px; border: 1px solid var(--border); border-radius: 6px;
//     background: #fff; font-size: 13px; font-family: inherit;
//     color: var(--text-primary); cursor: pointer; white-space: nowrap;
//     min-width: 240px; justify-content: space-between; height: 36px;
// }
// .mad-wrap .date-range-btn:hover { border-color: var(--primary); }
// .mad-wrap .date-range-btn .dr-dates { font-weight: 500; font-size: 12.5px; }
// .mad-wrap .date-range-btn .dr-icon { color: var(--text-secondary); font-size: 12px; }

// .mad-wrap .datepicker-overlay {
//     display: none; position: fixed; inset: 0;
//     background: rgba(0,0,0,.35); z-index: 1000;
//     justify-content: center; align-items: center;
//     opacity: 0; transition: opacity .25s ease;
// }
// .mad-wrap .datepicker-overlay.visible { display: flex; opacity: 1; }
// .mad-wrap .datepicker-popup {
//     background: #fff; border-radius: 8px;
//     box-shadow: 0 8px 32px rgba(0,0,0,.18);
//     display: flex; overflow: hidden; width: 720px; max-height: 85vh;
//     overflow-y: auto; transform: translateY(-10px) scale(.98); opacity: 0;
//     transition: all .25s ease;
// }
// .mad-wrap .datepicker-overlay.visible .datepicker-popup {
//     transform: translateY(0) scale(1); opacity: 1;
// }
// .mad-wrap .dp-presets {
//     width: 170px; border-right: 1px solid var(--border);
//     padding: 12px 0; background: #fafafa; flex-shrink: 0;
// }
// .mad-wrap .dp-presets-title {
//     font-size: 11px; font-weight: 700; color: var(--text-secondary);
//     text-transform: uppercase; letter-spacing: .5px;
//     padding: 0 14px; margin-bottom: 8px;
// }
// .mad-wrap .dp-preset-item {
//     display: flex; align-items: center; gap: 10px;
//     padding: 7px 14px; cursor: pointer; font-size: 13px;
//     color: var(--text-primary); border: none; background: none;
//     width: 100%; text-align: left; font-family: inherit;
// }
// .mad-wrap .dp-preset-item:hover { background: #eef2ff; }
// .mad-wrap .dp-preset-item.active { color: var(--primary); font-weight: 600; }
// .mad-wrap .dp-preset-radio {
//     width: 16px; height: 16px; border-radius: 50%; border: 2px solid #ccc;
//     flex-shrink: 0; display: flex; align-items: center; justify-content: center;
// }
// .mad-wrap .dp-preset-item.active .dp-preset-radio {
//     border-color: var(--primary); background: var(--primary);
// }
// .mad-wrap .dp-preset-item.active .dp-preset-radio::after {
//     content: ''; width: 6px; height: 6px; background: #fff; border-radius: 50%;
// }
// .mad-wrap .dp-calendars { flex: 1; padding: 16px; }
// .mad-wrap .dp-cal-header {
//     display: flex; justify-content: space-between;
//     align-items: center; margin-bottom: 16px;
// }
// .mad-wrap .dp-cal-nav { display: flex; align-items: center; gap: 12px; }
// .mad-wrap .dp-cal-nav button {
//     background: none; border: none; cursor: pointer;
//     color: var(--text-secondary); font-size: 14px;
//     padding: 4px 8px; border-radius: 4px;
// }
// .mad-wrap .dp-cal-nav button:hover { background: #eee; }
// .mad-wrap .dp-cal-nav .month-year {
//     font-size: 13px; font-weight: 600; color: var(--text-primary);
//     min-width: 100px; text-align: center;
// }
// .mad-wrap .dp-two-calendars { display: flex; gap: 16px; }
// .mad-wrap .dp-calendar { flex: 1; }
// .mad-wrap .dp-calendar .cal-month-title {
//     font-size: 13px; font-weight: 600; color: var(--text-primary);
//     margin-bottom: 10px; text-align: center;
// }
// .mad-wrap .dp-calendar .cal-weekdays {
//     display: grid; grid-template-columns: repeat(7, 1fr);
//     gap: 2px; margin-bottom: 4px;
// }
// .mad-wrap .dp-calendar .cal-weekdays span {
//     font-size: 11px; font-weight: 600; color: var(--text-secondary);
//     text-align: center; padding: 4px 0;
// }
// .mad-wrap .dp-calendar .cal-days {
//     display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;
// }
// .mad-wrap .dp-calendar .cal-day {
//     aspect-ratio: 1; display: flex; align-items: center;
//     justify-content: center; font-size: 11.5px;
//     color: var(--text-primary); border-radius: 4px;
//     cursor: pointer; border: none; background: none;
//     font-family: inherit; padding: 4px;
// }
// .mad-wrap .dp-calendar .cal-day:hover { background: #e8eeff; }
// .mad-wrap .dp-calendar .cal-day.other-month { color: #bbb; }
// .mad-wrap .dp-calendar .cal-day.selected-start,
// .mad-wrap .dp-calendar .cal-day.selected-end {
//     background: var(--primary); color: #fff; font-weight: 600;
// }
// .mad-wrap .dp-calendar .cal-day.in-range { background: #dbeafe; border-radius: 0; }
// .mad-wrap .dp-calendar .cal-day.selected-start { border-radius: 4px 0 0 4px; }
// .mad-wrap .dp-calendar .cal-day.selected-end   { border-radius: 0 4px 4px 0; }
// .mad-wrap .dp-calendar .cal-day.selected-start.selected-end { border-radius: 4px; }
// .mad-wrap .dp-calendar .cal-day.today { border: 2px solid var(--primary); }
// .mad-wrap .dp-footer {
//     display: flex; justify-content: flex-end; align-items: center;
//     gap: 10px; margin-top: 20px; padding-top: 16px;
//     border-top: 1px solid var(--border);
// }
// .mad-wrap .dp-footer .dp-date-display {
//     font-size: 12px; color: var(--text-secondary); margin-right: auto;
// }
// .mad-wrap .btn-cancel {
//     padding: 7px 18px; background: #fff; color: var(--text-primary);
//     border: 1px solid var(--border); border-radius: 6px;
//     font-size: 13px; font-weight: 600; cursor: pointer;
//     font-family: inherit;
// }
// .mad-wrap .btn-cancel:hover { background: #f0f0f0; }
// .mad-wrap .btn-update {
//     padding: 7px 22px; background: var(--primary); color: #fff;
//     border: none; border-radius: 6px; font-size: 13px;
//     font-weight: 600; cursor: pointer; font-family: inherit;
// }
// .mad-wrap .btn-update:hover { background: var(--primary-hover); }
// .mad-wrap .dp-compare-section {
//     margin-bottom: 12px; padding-bottom: 12px;
//     border-bottom: 1px solid var(--border);
// }
// .mad-wrap .dp-compare-label {
//     display: inline-flex; align-items: center; gap: 8px;
//     cursor: pointer; font-size: 13px; font-weight: 500;
//     color: var(--text-primary); user-select: none;
// }
// .mad-wrap .dp-compare-label input[type="checkbox"] {
//     width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary);
// }
// .mad-wrap .dp-compare-range {
//     margin-top: 16px; padding-top: 16px;
//     border-top: 2px solid var(--border);
// }
// .mad-wrap .dp-compare-header {
//     font-size: 12px; font-weight: 600;
//     color: var(--text-primary); margin-bottom: 12px;
// }

// .mad-wrap .level-tabs {
//     background: var(--bg-white); border-radius: 8px 8px 0 0;
//     box-shadow: var(--shadow); display: flex;
//     overflow-x: auto; margin-bottom: 0;
// }
// .mad-wrap .level-tab {
//     flex: 1; min-width: 150px; padding: 12px 16px;
//     background: transparent; border: none;
//     border-bottom: 3px solid transparent;
//     color: var(--text-secondary); font-size: 13px; font-weight: 600;
//     cursor: pointer; display: flex; align-items: center;
//     justify-content: center; gap: 8px; white-space: nowrap;
//     font-family: inherit;
// }
// .mad-wrap .level-tab:hover { background: var(--bg-hover); }
// .mad-wrap .level-tab.active { color: var(--primary); border-bottom-color: var(--primary); }
// .mad-wrap .tab-badge {
//     display: inline-flex; align-items: center; justify-content: center;
//     min-width: 20px; height: 20px; padding: 0 6px;
//     background: #e4e6eb; color: var(--text-secondary);
//     font-size: 11px; font-weight: 700; border-radius: 10px;
// }
// .mad-wrap .level-tab.active .tab-badge { background: var(--primary); color: #fff; }

// .mad-wrap .table-section {
//     background: var(--bg-white); border-radius: 0 0 8px 8px;
//     box-shadow: var(--shadow); display: flex; flex-direction: column;
// }
// .mad-wrap .table-wrapper {
//     overflow-x: auto; overflow-y: auto;
//     max-height: 58vh; flex: 1;
// }
// .mad-wrap .data-table {
//     width: 100%; border-collapse: separate; border-spacing: 0;
//     font-size: 13px; min-width: 1400px; table-layout: fixed;
// }
// .mad-wrap .data-table thead {
//     position: sticky; top: 0; z-index: 10; background: var(--bg-light);
// }
// .mad-wrap .data-table thead th {
//     padding: 10px 12px; text-align: left; font-size: 11.5px; font-weight: 600;
//     color: var(--text-secondary); border-bottom: 2px solid var(--border);
//     white-space: nowrap; user-select: none; cursor: pointer;
//     background: var(--bg-light); position: relative;
// }
// .mad-wrap .data-table thead th:hover { background: #e4e6eb; }
// .mad-wrap .th-content { display: flex; align-items: center; gap: 4px; }
// .mad-wrap .sort-icon { font-size: 10px; color: var(--text-secondary); opacity: .4; }
// .mad-wrap .sort-icon.active { opacity: 1; color: var(--primary); }
// .mad-wrap .data-table tbody tr {
//     border-bottom: 1px solid var(--border);
// }
// .mad-wrap .data-table tbody tr:nth-child(even) { background: #f8f9fa; }
// .mad-wrap .data-table tbody tr:hover { background: var(--bg-hover); }
// .mad-wrap .data-table tbody tr.selected { background: var(--bg-selected) !important; }
// .mad-wrap .data-table tbody td {
//     padding: 9px 12px; color: var(--text-primary); white-space: nowrap;
// }
// .mad-wrap .checkbox-cell {
//     width: 40px !important; min-width: 40px !important; text-align: center;
// }
// .mad-wrap .custom-checkbox {
//     width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary);
// }
// .mad-wrap .text-cell {
//     max-width: 640px; overflow: hidden;
//     text-overflow: ellipsis; font-weight: 500;
// }
// .mad-wrap .currency, .mad-wrap .number { font-variant-numeric: tabular-nums; }
// .mad-wrap .currency { font-weight: 500; }

// .mad-wrap .footer-wrapper {
//     overflow-x: auto; border-top: 2px solid var(--border);
//     background: #eef1f5; border-radius: 0 0 8px 8px; flex-shrink: 0;
// }
// .mad-wrap .footer-table {
//     width: 100%; border-collapse: separate; border-spacing: 0;
//     font-size: 13px; min-width: 1400px; table-layout: fixed;
// }
// .mad-wrap .footer-table td {
//     padding: 9px 12px; font-weight: 600; color: var(--text-primary);
//     white-space: nowrap; border-top: none;
// }
// .mad-wrap .footer-table .footer-label {
//     color: var(--text-secondary); font-weight: 700; font-size: 12px;
// }

// .mad-wrap .data-table th, .mad-wrap .data-table td, .mad-wrap .footer-table td {
//     width: 120px; border-right: 1px solid #eef1f5;
// }
// .mad-wrap .data-table th:last-child, .mad-wrap .data-table td:last-child,
// .mad-wrap .footer-table td:last-child { border-right: none; }

// /* Column resize handle */
// .mad-wrap .col-resizer {
//     position: absolute;
//     top: 0;
//     right: -3px;
//     width: 6px;
//     height: 100%;
//     cursor: col-resize;
//     user-select: none;
//     z-index: 12;
//     background: transparent;
//     transition: background .15s;
// }
// .mad-wrap .col-resizer:hover,
// .mad-wrap .col-resizer.resizing {
//     background: var(--primary);
//     opacity: 0.3;
// }
// .mad-wrap .col-resizer.resizing {
//     opacity: 0.6;
// }
// .mad-wrap.is-resizing,
// .mad-wrap.is-resizing * {
//     cursor: col-resize !important;
//     user-select: none !important;
// }

// .mad-wrap .campaign-column, .mad-wrap .adset-column, .mad-wrap .ad-column {
//     min-width: 650px !important; max-width: 650px !important; width: 650px !important;
// }
// .mad-wrap .campaign-column .text-cell,
// .mad-wrap .adset-column .text-cell,
// .mad-wrap .ad-column .text-cell {
//     overflow: visible; text-overflow: unset; white-space: nowrap;
// }
// /* Blue name cells in data rows */
// .mad-wrap .data-table tbody td.campaign-column.text-cell,
// .mad-wrap .data-table tbody td.adset-column.text-cell,
// .mad-wrap .data-table tbody td.ad-column.text-cell {
//     color: var(--primary);
//     font-weight: 600;
// }

// /* Frozen columns */
// .mad-wrap .data-table th.checkbox-cell,
// .mad-wrap .data-table td.checkbox-cell,
// .mad-wrap .footer-table td.checkbox-cell {
//     position: sticky; left: 0; background: #fff; z-index: 6;
// }
// .mad-wrap .data-table th.campaign-column,
// .mad-wrap .data-table td.campaign-column,
// .mad-wrap .footer-table td.campaign-column {
//     position: sticky; left: 40px; background: #fff; z-index: 5;
// }
// .mad-wrap .data-table th.adset-column,
// .mad-wrap .data-table td.adset-column,
// .mad-wrap .footer-table td.adset-column {
//     position: sticky; left: 40px; background: #fff; z-index: 5;
// }
// .mad-wrap .data-table th.ad-column,
// .mad-wrap .data-table td.ad-column,
// .mad-wrap .footer-table td.ad-column {
//     position: sticky; left: 0; background: #fff; z-index: 5;
// }

// /* Status */
// .mad-wrap .status-badge {
//     display: inline-flex; align-items: center; gap: 6px;
//     padding: 4px 8px; border-radius: 4px;
//     font-size: 11.5px; font-weight: 600;
// }
// .mad-wrap .status-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
// .mad-wrap .status-active { background: #eafaf1; color: #1a7a45; }
// .mad-wrap .status-active .status-dot { background: #1a7a45; }
// .mad-wrap .status-inactive { background: #fef0f0; color: #b91c1c; }
// .mad-wrap .status-inactive .status-dot { background: #b91c1c; }
// .mad-wrap .status-paused { background: #fef9e7; color: #b7860e; }
// .mad-wrap .status-paused .status-dot { background: #b7860e; }
// .mad-wrap .status-in-review { background: #fef9e7; color: #b7860e; }
// .mad-wrap .status-in-review .status-dot { background: #b7860e; }
// .mad-wrap .status-unknown { background: #f3f4f6; color: #6b7280; }
// .mad-wrap .status-unknown .status-dot { background: #9ca3af; }

// /* Spinner */
// .mad-wrap .spinner {
//     display: inline-block; width: 12px; height: 12px;
//     border: 2px solid rgba(255,255,255,.3); border-radius: 50%;
//     border-top-color: #fff; animation: mad-spin .6s linear infinite;
// }
// @keyframes mad-spin { to { transform: rotate(360deg); } }

// /* Loading dots (for phase-2 delivery/event) */
// .mad-wrap .loading-dots {
//     display: inline-flex; align-items: center; gap: 3px;
//     color: var(--text-secondary); font-size: 12px;
// }
// .mad-wrap .loading-dots span {
//     width: 4px; height: 4px; background: currentColor;
//     border-radius: 50%; display: inline-block;
//     animation: madDotBounce 1.2s infinite ease-in-out;
// }
// .mad-wrap .loading-dots span:nth-child(2) { animation-delay: .2s; }
// .mad-wrap .loading-dots span:nth-child(3) { animation-delay: .4s; }
// @keyframes madDotBounce {
//     0%,80%,100% { opacity: .2; transform: scale(.8); }
//     40% { opacity: 1; transform: scale(1.2); }
// }

// /* Empty & Alerts */
// .mad-wrap .empty-state { text-align: center; padding: 60px 20px; }
// .mad-wrap .empty-icon { font-size: 48px; color: #cbd5e1; margin-bottom: 16px; }
// .mad-wrap .empty-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
// .mad-wrap .empty-text { font-size: 13px; color: var(--text-secondary); }

// .mad-wrap .alert {
//     padding: 12px 16px; border-radius: 6px; margin-bottom: 16px;
//     display: flex; align-items: center; gap: 10px; font-size: 13px;
// }
// .mad-wrap .alert-error { background: #fee; border: 1px solid #fcc; color: #c00; }
// .mad-wrap .alert-success { background: #efe; border: 1px solid #cfc; color: #090; }

// .mad-wrap .token-box {
//     display: none; margin-bottom: 16px; gap: 10px; align-items: center;
// }
// .mad-wrap .token-box.show { display: flex; }

// /* Filter icon + dropdown */
// .mad-wrap .filter-icon {
//     color: var(--text-secondary); font-size: 10px; opacity: 0;
//     cursor: pointer; margin-left: auto;
// }
// .mad-wrap .data-table th:hover .filter-icon { opacity: .6; }
// .mad-wrap .filter-icon:hover, .mad-wrap .filter-icon.active {
//     opacity: 1 !important; color: var(--primary);
// }
// .mad-wrap .column-filter-dropdown {
//     position: fixed; background: #fff; border: 1px solid var(--border);
//     border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,.15);
//     width: 260px; max-height: 360px; display: none;
//     flex-direction: column; z-index: 1001;
// }
// .mad-wrap .column-filter-dropdown.visible { display: flex; }
// .mad-wrap .filter-search-box {
//     padding: 8px 10px; border-bottom: 1px solid var(--border);
//     display: flex; align-items: center; gap: 8px;
// }
// .mad-wrap .filter-search-box input {
//     flex: 1; border: none; outline: none;
//     font-size: 12px; font-family: inherit; background: transparent;
// }
// .mad-wrap .filter-options {
//     flex: 1; overflow-y: auto; padding: 4px; max-height: 240px;
// }
// .mad-wrap .filter-option-item {
//     padding: 6px 8px; display: flex; align-items: center;
//     gap: 8px; cursor: pointer; border-radius: 4px;
// }
// .mad-wrap .filter-option-item:hover { background: var(--bg-hover); }
// .mad-wrap .filter-option-item input[type="checkbox"] {
//     width: 15px; height: 15px; accent-color: var(--primary);
// }
// .mad-wrap .filter-option-item label {
//     flex: 1; font-size: 12px; cursor: pointer;
//     overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
// }
// .mad-wrap .filter-actions {
//     padding: 8px; border-top: 1px solid var(--border);
//     display: flex; gap: 8px;
// }
// .mad-wrap .btn-filter-clear, .mad-wrap .btn-filter-ok {
//     flex: 1; padding: 6px 12px; border: none; border-radius: 4px;
//     font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;
// }
// .mad-wrap .btn-filter-clear { background: var(--bg-light); color: var(--text-primary); }
// .mad-wrap .btn-filter-clear:hover { background: #e0e0e0; }
// .mad-wrap .btn-filter-ok { background: var(--primary); color: #fff; }
// .mad-wrap .btn-filter-ok:hover { background: var(--primary-hover); }

// /* Comparison expansion */
// .mad-wrap .expand-icon {
//     color: var(--text-secondary); font-size: 10px;
//     opacity: 0;
//     cursor: pointer; margin-left: 4px; transition: transform .2s;
// }
// /* Always show the expand icon when comparison mode is on (not just on hover) */
// .mad-wrap.is-comparison .expand-icon {
//     opacity: .75;
// }
// .mad-wrap .data-table th:hover .expand-icon { opacity: 1; }
// .mad-wrap .expand-icon:hover { opacity: 1 !important; color: var(--primary); }
// .mad-wrap .expand-icon.expanded {
//     transform: rotate(90deg); opacity: 1 !important; color: var(--primary);
// }
// .mad-wrap .compare-header {
//     background: #f8f9fa !important; border-left: 2px solid var(--border);
// }
// .mad-wrap .compare-col {
//     background: #f8f9fa; border-left: 2px solid var(--border);
// }
// .mad-wrap .change-positive {
//     color: #1a7a1a; font-weight: 600; background: #f0fff0;
//     padding: 2px 6px; border-radius: 4px;
// }
// .mad-wrap .change-negative {
//     color: #cc0000; font-weight: 600; background: #fff0f0;
//     padding: 2px 6px; border-radius: 4px;
// }

// ::-webkit-scrollbar { width: 6px; height: 6px; }
// ::-webkit-scrollbar-track { background: #f0f2f5; }
// ::-webkit-scrollbar-thumb { background: #c4c4c4; border-radius: 3px; }
// ::-webkit-scrollbar-thumb:hover { background: #a0a0a0; }

// /* ==========================================================================
//    VERSION-WISE ANALYSIS (.vwa-) - scoped to avoid any clashes
//    ========================================================================== */
// .mad-wrap .vwa-root { padding: 0; }
// .mad-wrap .vwa-controls {
//     background: #fff; padding: 16px; border-radius: 8px;
//     margin-bottom: 12px; box-shadow: var(--shadow);
//     border: 1px solid var(--border-light, #e4e6eb);
// }
// .mad-wrap .vwa-controls-row {
//     display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 12px;
// }
// .mad-wrap .vwa-controls-row:last-child { margin-bottom: 0; }
// .mad-wrap .vwa-section-label {
//     font-size: 12px; font-weight: 600; color: var(--text-secondary);
//     text-transform: uppercase; letter-spacing: .3px; margin-bottom: 8px;
//     display: block;
// }
// .mad-wrap .vwa-version-pills { display: flex; flex-wrap: wrap; gap: 8px; }
// .mad-wrap .vwa-version-pill {
//     padding: 6px 14px; border-radius: 20px; font-size: 12.5px;
//     cursor: pointer; border: 1.5px solid var(--border);
//     background: #fff; color: var(--text-primary); font-weight: 500;
//     user-select: none; transition: all .15s; font-family: inherit;
// }
// .mad-wrap .vwa-version-pill:hover { border-color: var(--primary); }
// .mad-wrap .vwa-version-pill.active {
//     background: var(--primary); color: #fff; border-color: var(--primary);
// }
// .mad-wrap .vwa-metric-toggles { display: flex; flex-wrap: wrap; gap: 14px; }
// .mad-wrap .vwa-metric-toggle {
//     display: inline-flex; align-items: center; gap: 6px;
//     font-size: 13px; cursor: pointer; user-select: none;
// }
// .mad-wrap .vwa-metric-toggle input { accent-color: var(--primary); width: 15px; height: 15px; }

// .mad-wrap .vwa-campaign-card {
//     background: #fff; border: 1px solid var(--border);
//     border-radius: 8px; margin-bottom: 12px;
//     box-shadow: var(--shadow);
//     /* do NOT clip the per-card Columns dropdown (was overflow: hidden) */
// }
// .mad-wrap .vwa-campaign-header {
//     display: flex; align-items: center; padding: 14px 18px;
//     gap: 12px; cursor: pointer; background: #fafbfc;
//     border-bottom: 1px solid var(--border-light, #e4e6eb);
//     transition: background .15s;
//     border-radius: 8px 8px 0 0;
//     position: relative;   /* anchor for the absolute dropdown */
// }
// .mad-wrap .vwa-campaign-header:hover { background: #f2f3f5; }
// .mad-wrap .vwa-campaign-icon { color: #e53e3e; font-size: 16px; }
// .mad-wrap .vwa-campaign-name {
//     font-weight: 600; font-size: 13.5px; flex: 1;
//     color: var(--text-primary); overflow: hidden;
//     text-overflow: ellipsis; white-space: nowrap;
// }
// .mad-wrap .vwa-chevron {
//     transition: transform .25s ease;
//     color: var(--text-secondary); font-size: 12px;
// }
// .mad-wrap .vwa-chevron.expanded { transform: rotate(90deg); }
// .mad-wrap .vwa-campaign-body { padding: 16px; overflow: hidden; }

// /* Fix 2: smooth expand/collapse animation using max-height */
// .mad-wrap .vwa-collapsible {
//     overflow: hidden;
//     transition: max-height .3s ease, opacity .25s ease, padding .25s ease;
// }
// .mad-wrap .vwa-collapsible.vwa-collapsed {
//     max-height: 0 !important;
//     opacity: 0;
//     padding-top: 0 !important;
//     padding-bottom: 0 !important;
// }
// .mad-wrap .vwa-collapsible.vwa-expanded {
//     max-height: 5000px;  /* large enough for any content */
//     opacity: 1;
// }

// .mad-wrap .vwa-table-wrap { overflow-x: auto; }
// .mad-wrap .vwa-table {
//     width: 100%; border-collapse: separate; border-spacing: 0;
//     font-size: 13px; min-width: 600px;
// }
// .mad-wrap .vwa-table th {
//     background: #1565c0; color: #fff; font-weight: 600;
//     font-size: 12px; padding: 10px 12px; text-align: left;
//     white-space: nowrap; text-transform: uppercase; letter-spacing: .3px;
// }
// .mad-wrap .vwa-table th:first-child {
//     position: sticky; left: 0; z-index: 2; background: #1565c0;
// }
// .mad-wrap .vwa-table td {
//     padding: 9px 12px; border-bottom: 1px solid var(--border-light, #eef1f5);
//     white-space: nowrap; font-variant-numeric: tabular-nums;
// }
// .mad-wrap .vwa-table tbody tr:nth-child(even) { background: #f8f9fa; }
// .mad-wrap .vwa-table tbody tr:hover { background: #f0f7ff; }
// .mad-wrap .vwa-table .vwa-version-label {
//     font-weight: 600; background: #fff; position: sticky; left: 0;
//     border-right: 2px solid var(--border); color: var(--text-primary);
// }
// .mad-wrap .vwa-table tbody tr:nth-child(even) .vwa-version-label { background: #f8f9fa; }
// .mad-wrap .vwa-table tbody tr:hover .vwa-version-label { background: #f0f7ff; }

// .mad-wrap .vwa-trend-up { color: #1a7a1a; font-weight: 600; }
// .mad-wrap .vwa-trend-down { color: #cc0000; font-weight: 600; }
// .mad-wrap .vwa-trend-neutral { color: var(--text-secondary); font-weight: 500; }
// .mad-wrap .vwa-trend-small { font-size: 11px; margin-left: 4px; font-weight: 500; }
// .mad-wrap .vwa-no-data { color: #aaa; }
// .mad-wrap .vwa-baseline-note { color: var(--text-secondary); font-size: 10.5px; margin-left: 4px; }

// /* Entity (Campaign/Ad Set/Ad name) column with rowspan */
// .mad-wrap .vwa-entity-cell {
//     background: #eef2ff !important;
//     border-right: 2px solid var(--primary) !important;
//     font-weight: 700;
//     color: var(--primary);
//     vertical-align: middle !important;
//     padding: 14px 16px !important;
//     min-width: 520px;
//     width: auto;              /* grows to fit content */
//     white-space: nowrap;      /* keep name on one line */
//     position: sticky;
//     left: 0;
//     z-index: 3;
// }
// .mad-wrap .vwa-entity-cell .vwa-entity-label-small {
//     display: block;
//     font-size: 9.5px;
//     color: var(--text-secondary);
//     text-transform: uppercase;
//     letter-spacing: .3px;
//     font-weight: 700;
//     margin-bottom: 4px;
// }
// .mad-wrap .vwa-entity-cell .vwa-entity-name {
//     font-size: 12.5px;
//     line-height: 1.35;
//     color: var(--primary);
//     white-space: nowrap;      /* one-line display */
//     display: block;
//     font-weight: 700;
// }

// /* ===================================================
//    NOTES (Remark) column
//    =================================================== */
// .mad-wrap .vwa-note-cell {
//     background: #fffef5 !important;
//     border-left: 2px solid #f59e0b !important;
//     vertical-align: middle !important;
//     padding: 10px 12px !important;
//     min-width: 260px;
//     max-width: 320px;
//     position: relative;
// }
// .mad-wrap .vwa-note-preview {
//     cursor: pointer;
//     padding: 4px 6px;
//     border-radius: 4px;
//     min-height: 24px;
//     display: block;
//     font-size: 12px;
//     line-height: 1.45;
//     color: #1e293b;
//     transition: background .12s;
//     overflow: hidden;
//     text-overflow: ellipsis;
//     white-space: nowrap;
//     max-width: 100%;
// }
// .mad-wrap .vwa-note-preview:hover {
//     background: #fef3c7;
// }
// .mad-wrap .vwa-note-preview-empty {
//     color: #94a3b8;
//     font-style: italic;
//     font-size: 11.5px;
// }
// .mad-wrap .vwa-note-count-pill {
//     display: inline-block;
//     font-size: 9.5px;
//     font-weight: 700;
//     background: #f59e0b;
//     color: #fff;
//     padding: 1px 6px;
//     border-radius: 10px;
//     margin-left: 4px;
//     vertical-align: middle;
// }

// /* Hover tooltip with all users' notes */
// .mad-wrap .vwa-note-tooltip {
//     position: absolute;
//     top: 8px;
//     right: calc(100% + 8px);
//     min-width: 320px;
//     max-width: 480px;
//     background: #1e293b;
//     color: #f1f5f9;
//     border-radius: 8px;
//     padding: 10px 12px;
//     box-shadow: 0 8px 24px rgba(0,0,0,0.25);
//     font-size: 12px;
//     z-index: 500;
//     opacity: 0;
//     pointer-events: none;
//     transition: opacity .15s;
//     white-space: normal;
//     line-height: 1.45;
// }
// .mad-wrap .vwa-note-tooltip::before {
//     content: '';
//     position: absolute;
//     top: 14px;
//     right: -6px;
//     border-top: 6px solid transparent;
//     border-bottom: 6px solid transparent;
//     border-left: 6px solid #1e293b;
// }
// .mad-wrap .vwa-note-cell:hover .vwa-note-tooltip,
// .mad-wrap .vwa-note-preview:hover + .vwa-note-tooltip {
//     opacity: 1;
//     pointer-events: auto;
// }
// .mad-wrap .vwa-note-tooltip-title {
//     font-size: 10px;
//     text-transform: uppercase;
//     letter-spacing: .5px;
//     color: #94a3b8;
//     margin-bottom: 6px;
//     font-weight: 700;
// }
// .mad-wrap .vwa-note-tooltip-item {
//     padding: 6px 0;
//     border-bottom: 1px solid rgba(255,255,255,0.08);
// }
// .mad-wrap .vwa-note-tooltip-item:last-child { border-bottom: none; }
// .mad-wrap .vwa-note-tooltip-user {
//     font-weight: 700;
//     color: #fbbf24;
//     margin-right: 4px;
// }
// .mad-wrap .vwa-note-tooltip-text {
//     color: #e2e8f0;
//     white-space: pre-wrap;
//     word-break: break-word;
// }
// .mad-wrap .vwa-note-tooltip-time {
//     display: block;
//     font-size: 10px;
//     color: #94a3b8;
//     margin-top: 2px;
// }

// /* Inline editor */
// .mad-wrap .vwa-note-editor {
//     background: #fff;
//     border: 2px solid #f59e0b;
//     border-radius: 6px;
//     padding: 8px;
// }
// .mad-wrap .vwa-note-editor textarea {
//     width: 100%;
//     min-height: 60px;
//     max-height: 180px;
//     border: 1px solid #e2e8f0;
//     border-radius: 4px;
//     padding: 6px 8px;
//     font-family: inherit;
//     font-size: 12px;
//     line-height: 1.4;
//     resize: vertical;
//     outline: none;
//     box-sizing: border-box;
// }
// .mad-wrap .vwa-note-editor textarea:focus {
//     border-color: var(--primary);
// }
// .mad-wrap .vwa-note-editor-actions {
//     display: flex;
//     gap: 6px;
//     margin-top: 6px;
//     align-items: center;
//     flex-wrap: wrap;
// }
// .mad-wrap .vwa-note-editor-btn {
//     padding: 4px 10px;
//     border-radius: 4px;
//     font-size: 11px;
//     font-weight: 600;
//     cursor: pointer;
//     border: none;
//     font-family: inherit;
//     transition: opacity .12s;
// }
// .mad-wrap .vwa-note-editor-btn.save {
//     background: #16a34a;
//     color: #fff;
// }
// .mad-wrap .vwa-note-editor-btn.save:hover { opacity: .9; }
// .mad-wrap .vwa-note-editor-btn.cancel {
//     background: #e2e8f0;
//     color: #475569;
// }
// .mad-wrap .vwa-note-editor-btn.history {
//     background: transparent;
//     color: var(--primary);
//     text-decoration: underline;
//     padding: 4px 6px;
//     margin-left: auto;
// }
// .mad-wrap .vwa-note-editor-btn:disabled {
//     opacity: .5;
//     cursor: not-allowed;
// }

// /* History modal */
// .mad-wrap .vwa-history-modal-body {
//     max-height: 60vh;
// }
// .mad-wrap .vwa-history-entry {
//     border-left: 3px solid var(--primary);
//     padding: 10px 12px;
//     margin-bottom: 10px;
//     background: #f8fafc;
//     border-radius: 0 6px 6px 0;
// }
// .mad-wrap .vwa-history-entry.create { border-left-color: #16a34a; }
// .mad-wrap .vwa-history-entry.update { border-left-color: #f59e0b; }
// .mad-wrap .vwa-history-entry.delete { border-left-color: #dc2626; }
// .mad-wrap .vwa-history-meta {
//     font-size: 11.5px;
//     color: #64748b;
//     margin-bottom: 6px;
//     display: flex;
//     gap: 8px;
//     flex-wrap: wrap;
//     align-items: center;
// }
// .mad-wrap .vwa-history-action {
//     display: inline-block;
//     padding: 2px 8px;
//     border-radius: 10px;
//     font-size: 10px;
//     font-weight: 700;
//     text-transform: uppercase;
//     letter-spacing: .3px;
// }
// .mad-wrap .vwa-history-action.create { background: #d1fae5; color: #065f46; }
// .mad-wrap .vwa-history-action.update { background: #fef3c7; color: #92400e; }
// .mad-wrap .vwa-history-action.delete { background: #fee2e2; color: #991b1b; }
// .mad-wrap .vwa-history-user {
//     font-weight: 700;
//     color: #1e293b;
// }
// .mad-wrap .vwa-history-diff {
//     font-size: 12px;
//     margin-top: 4px;
// }
// .mad-wrap .vwa-history-old {
//     color: #991b1b;
//     text-decoration: line-through;
//     text-decoration-color: #fca5a5;
//     white-space: pre-wrap;
//     margin-bottom: 4px;
// }
// .mad-wrap .vwa-history-new {
//     color: #065f46;
//     white-space: pre-wrap;
// }

// /* Notes filter switch placement */
// .mad-wrap .vwa-notes-filter-toggle {
//     display: inline-flex;
//     align-items: center;
//     gap: 8px;
//     padding: 7px 12px;
//     background: #fffef5;
//     border: 1px solid #f59e0b;
//     border-radius: 6px;
//     font-size: 12px;
//     cursor: pointer;
//     user-select: none;
//     color: #92400e;
//     font-weight: 600;
//     height: 36px;
// }
// .mad-wrap .vwa-notes-filter-toggle.is-on {
//     background: #fef3c7;
//     border-color: #d97706;
// }

// /* Adset / Ad nested sections */
// .mad-wrap .vwa-adsets-wrap {
//     margin-top: 16px; padding-left: 14px;
//     border-left: 3px solid #dbeafe;
// }
// .mad-wrap .vwa-adset-card {
//     background: #fafbff; border: 1px solid #e3e8f5;
//     border-radius: 6px; margin-bottom: 10px; overflow: hidden;
// }
// .mad-wrap .vwa-adset-header {
//     display: flex; align-items: center; padding: 10px 14px;
//     gap: 10px; cursor: pointer; background: #eef3ff;
//     transition: background .15s;
// }
// .mad-wrap .vwa-adset-header:hover { background: #dbeafe; }
// .mad-wrap .vwa-adset-icon { color: #4a5568; font-size: 13px; }
// .mad-wrap .vwa-adset-name {
//     font-weight: 600; font-size: 12.5px; flex: 1;
//     color: var(--text-primary); overflow: hidden;
//     text-overflow: ellipsis; white-space: nowrap;
// }
// .mad-wrap .vwa-adset-body { padding: 12px; background: #fff; }

// .mad-wrap .vwa-ads-wrap {
//     margin-top: 12px; padding-left: 12px;
//     border-left: 3px solid #c7d2fe;
// }
// .mad-wrap .vwa-ad-card {
//     background: #f4f6ff; border: 1px solid #d6dcf5;
//     border-radius: 4px; margin-bottom: 8px; overflow: hidden;
// }
// .mad-wrap .vwa-ad-header {
//     display: flex; align-items: center; padding: 8px 12px;
//     gap: 8px; cursor: pointer; background: #e0e7ff;
// }
// .mad-wrap .vwa-ad-header:hover { background: #c7d2fe; }
// .mad-wrap .vwa-ad-name {
//     font-weight: 500; font-size: 12px; flex: 1;
//     color: var(--text-primary); overflow: hidden;
//     text-overflow: ellipsis; white-space: nowrap;
// }
// .mad-wrap .vwa-ad-body { padding: 10px; background: #fafbff; }

// /* Export button */
// .mad-wrap .vwa-btn-export {
//     padding: 5px 12px; background: #42b72a; color: #fff;
//     border: none; border-radius: 4px; font-size: 11px;
//     cursor: pointer; font-weight: 600; font-family: inherit;
//     display: inline-flex; align-items: center; gap: 5px;
// }
// .mad-wrap .vwa-btn-export:hover { background: #36a01f; }

// /* Skeleton loader */
// .mad-wrap .vwa-skeleton-row {
//     display: grid; grid-template-columns: 80px repeat(6, 1fr);
//     gap: 10px; padding: 10px 0;
// }
// .mad-wrap .vwa-skeleton-cell {
//     background: linear-gradient(90deg, #f0f0f0 25%, #e4e4e4 50%, #f0f0f0 75%);
//     background-size: 200% 100%;
//     animation: vwa-shimmer 1.3s infinite;
//     height: 14px; border-radius: 3px;
// }
// @keyframes vwa-shimmer {
//     0%   { background-position: 200% 0; }
//     100% { background-position: -200% 0; }
// }

// .mad-wrap .vwa-empty {
//     text-align: center; padding: 40px 20px;
//     color: var(--text-secondary); background: #fff;
//     border: 1px dashed var(--border); border-radius: 8px;
// }
// .mad-wrap .vwa-empty-icon { font-size: 36px; margin-bottom: 10px; color: #cbd5e1; }
// .mad-wrap .vwa-empty-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: var(--text-primary); }

// .mad-wrap .vwa-status-badge {
//     display: inline-flex; align-items: center; gap: 5px;
//     padding: 3px 9px; border-radius: 10px;
//     font-size: 10.5px; font-weight: 700; text-transform: uppercase;
// }
// .mad-wrap .vwa-status-badge::before {
//     content: ''; width: 6px; height: 6px; border-radius: 50%;
//     background: currentColor; display: inline-block;
// }
// .mad-wrap .vwa-status-active { background: #eafaf1; color: #1a7a45; }
// .mad-wrap .vwa-status-paused, .mad-wrap .vwa-status-in-review { background: #fef9e7; color: #b7860e; }
// .mad-wrap .vwa-status-inactive { background: #fef0f0; color: #b91c1c; }
// .mad-wrap .vwa-status-unknown { background: #f3f4f6; color: #6b7280; }

// /* Version Analysis: sticky controls bar + show-more + status filter + per-card toggles */
// .mad-wrap .vwa-sticky-controls {
//     position: sticky;
//     top: 0;
//     z-index: 100;
//     background: var(--bg-light);
//     padding: 10px 0 12px;
//     margin: 0 -4px 16px;
//     box-shadow: 0 6px 14px -6px rgba(0,0,0,0.18);
// }
// .mad-wrap .vwa-sticky-controls .vwa-controls {
//     margin-bottom: 0;
//     border: 1px solid var(--border);
//     background: #ffffff;
// }
// .mad-wrap .vwa-pills-wrap {
//     position: relative;
//     max-height: 120px;
//     overflow: hidden;
//     transition: max-height .25s ease;
// }
// .mad-wrap .vwa-pills-wrap.vwa-pills-expanded {
//     max-height: 800px;
// }
// .mad-wrap .vwa-show-more-pill {
//     padding: 6px 14px; border-radius: 20px; font-size: 12.5px;
//     cursor: pointer; border: 1.5px dashed var(--primary);
//     background: #fff; color: var(--primary); font-weight: 600;
//     user-select: none; font-family: inherit;
//     display: inline-flex; align-items: center; gap: 4px;
// }
// .mad-wrap .vwa-show-more-pill:hover { background: #e7f3ff; }

// .mad-wrap .vwa-status-filter {
//     min-width: 150px;
// }
// .mad-wrap .vwa-status-filter select {
//     width: 100%;
//     height: 36px;
//     padding: 0 12px;
//     border: 1px solid var(--border);
//     border-radius: 6px;
//     background: #fff;
//     font-size: 13px;
//     font-family: inherit;
//     cursor: pointer;
// }
// .mad-wrap .vwa-status-filter select:focus {
//     outline: none; border-color: var(--primary);
// }

// /* ======== SLIDING TOGGLE SWITCH (replaces checkboxes) ======== */
// .mad-wrap .vwa-switch-item {
//     display: inline-flex;
//     align-items: center;
//     gap: 8px;
//     padding: 6px 10px;
//     background: #fafbfc;
//     border: 1px solid var(--border);
//     border-radius: 6px;
//     font-size: 12.5px;
//     cursor: pointer;
//     user-select: none;
//     font-weight: 500;
//     color: var(--text-primary);
//     transition: background .15s, border-color .15s;
// }
// .mad-wrap .vwa-switch-item:hover { background: #f2f3f5; }
// .mad-wrap .vwa-switch-item.is-on {
//     background: #e7f3ff;
//     border-color: var(--primary);
//     color: var(--primary);
//     font-weight: 600;
// }
// .mad-wrap .vwa-switch {
//     position: relative;
//     display: inline-block;
//     width: 32px;
//     height: 18px;
//     flex-shrink: 0;
// }
// .mad-wrap .vwa-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
// .mad-wrap .vwa-switch-slider {
//     position: absolute; top: 0; left: 0; right: 0; bottom: 0;
//     background: #cbd5e1;
//     border-radius: 18px;
//     cursor: pointer;
//     transition: background .2s;
// }
// .mad-wrap .vwa-switch-slider::before {
//     content: ''; position: absolute;
//     height: 14px; width: 14px;
//     left: 2px; bottom: 2px;
//     background: #fff;
//     border-radius: 50%;
//     transition: transform .2s;
//     box-shadow: 0 1px 2px rgba(0,0,0,0.2);
// }
// .mad-wrap .vwa-switch input:checked + .vwa-switch-slider {
//     background: var(--primary);
// }
// .mad-wrap .vwa-switch input:checked + .vwa-switch-slider::before {
//     transform: translateX(14px);
// }

// /* ======== "SEE FINAL REPORTS" BUTTON ======== */
// .mad-wrap .vwa-final-btn {
//     padding: 8px 18px;
//     background: linear-gradient(135deg, #42b72a, #2d9318);
//     color: #fff;
//     border: none;
//     border-radius: 6px;
//     font-size: 13px;
//     font-weight: 700;
//     cursor: pointer;
//     font-family: inherit;
//     display: inline-flex;
//     align-items: center;
//     gap: 8px;
//     height: 36px;
//     box-shadow: 0 2px 6px rgba(66, 183, 42, 0.35);
//     transition: transform .15s, box-shadow .15s;
// }
// .mad-wrap .vwa-final-btn:hover {
//     transform: translateY(-1px);
//     box-shadow: 0 4px 10px rgba(66, 183, 42, 0.45);
// }
// .mad-wrap .vwa-final-btn:disabled {
//     background: #cbd5e1;
//     color: #fff;
//     cursor: not-allowed;
//     box-shadow: none;
//     transform: none;
// }

// /* ======== FINAL REPORT MODAL ======== */
// .mad-wrap .vwa-modal-overlay {
//     position: fixed;
//     inset: 0;
//     background: rgba(0,0,0,0.5);
//     z-index: 2000;
//     display: flex;
//     align-items: center;
//     justify-content: center;
//     padding: 30px 20px;
//     animation: vwa-fade-in .2s ease;
// }
// @keyframes vwa-fade-in { from { opacity: 0; } to { opacity: 1; } }
// .mad-wrap .vwa-modal {
//     background: #fff;
//     border-radius: 10px;
//     box-shadow: 0 20px 60px rgba(0,0,0,0.35);
//     max-width: 1200px;
//     width: 100%;
//     max-height: 90vh;
//     display: flex;
//     flex-direction: column;
//     overflow: hidden;
//     animation: vwa-slide-up .25s ease;
// }
// @keyframes vwa-slide-up {
//     from { opacity: 0; transform: translateY(20px) scale(.98); }
//     to   { opacity: 1; transform: translateY(0) scale(1); }
// }
// .mad-wrap .vwa-modal-header {
//     display: flex;
//     align-items: center;
//     padding: 18px 24px;
//     border-bottom: 1px solid var(--border);
//     background: linear-gradient(135deg, #1877f2, #0f5fc0);
//     color: #fff;
// }
// .mad-wrap .vwa-modal-title {
//     font-size: 17px;
//     font-weight: 700;
//     flex: 1;
//     display: flex;
//     align-items: center;
//     gap: 10px;
// }
// .mad-wrap .vwa-modal-close {
//     background: rgba(255,255,255,0.15);
//     color: #fff;
//     border: none;
//     width: 32px;
//     height: 32px;
//     border-radius: 6px;
//     font-size: 16px;
//     cursor: pointer;
//     font-family: inherit;
//     transition: background .15s;
// }
// .mad-wrap .vwa-modal-close:hover { background: rgba(255,255,255,0.3); }
// .mad-wrap .vwa-modal-body {
//     padding: 20px 24px;
//     overflow: auto;
//     flex: 1;
// }
// .mad-wrap .vwa-modal-subtitle {
//     font-size: 13px;
//     color: var(--text-secondary);
//     margin-bottom: 14px;
// }
// .mad-wrap .vwa-modal-controls {
//     display: flex;
//     align-items: center;
//     gap: 12px;
//     margin-bottom: 14px;
//     flex-wrap: wrap;
// }
// .mad-wrap .vwa-modal-table {
//     width: 100%;
//     border-collapse: separate;
//     border-spacing: 0;
//     font-size: 13px;
// }
// .mad-wrap .vwa-modal-table th {
//     background: #1877f2;
//     color: #fff;
//     font-weight: 600;
//     font-size: 12px;
//     padding: 10px 14px;
//     text-align: left;
//     text-transform: uppercase;
//     letter-spacing: .3px;
//     cursor: pointer;
//     user-select: none;
//     white-space: nowrap;
// }
// .mad-wrap .vwa-modal-table th:hover { background: #166fe5; }
// .mad-wrap .vwa-modal-table th .sort-ind {
//     margin-left: 6px;
//     opacity: .5;
//     font-size: 10px;
// }
// .mad-wrap .vwa-modal-table th.sort-active .sort-ind { opacity: 1; }
// .mad-wrap .vwa-modal-table td {
//     padding: 11px 14px;
//     border-bottom: 1px solid #eef1f5;
//     font-variant-numeric: tabular-nums;
// }
// .mad-wrap .vwa-modal-table tbody tr:nth-child(even) { background: #f8f9fa; }
// .mad-wrap .vwa-modal-table tbody tr:hover { background: #e7f3ff; }
// .mad-wrap .vwa-modal-table .vwa-rank {
//     display: inline-flex;
//     align-items: center;
//     justify-content: center;
//     width: 22px; height: 22px;
//     border-radius: 50%;
//     background: #cbd5e1;
//     color: #fff;
//     font-size: 11px;
//     font-weight: 700;
//     margin-right: 8px;
// }
// .mad-wrap .vwa-modal-table tr:first-child .vwa-rank { background: #f59e0b; }
// .mad-wrap .vwa-modal-table tr:nth-child(2) .vwa-rank { background: #64748b; }
// .mad-wrap .vwa-modal-table tr:nth-child(3) .vwa-rank { background: #b45309; }
// .mad-wrap .vwa-modal-table .vwa-version-cell {
//     font-weight: 700;
//     color: var(--primary);
// }
// .mad-wrap .vwa-modal-sort-select {
//     padding: 6px 10px;
//     border: 1px solid var(--border);
//     border-radius: 6px;
//     background: #fff;
//     font-size: 12.5px;
//     font-family: inherit;
// }

// /* Per-card metric dropdown */
// .mad-wrap .vwa-card-metric-btn {
//     padding: 4px 10px;
//     background: #fff;
//     color: var(--primary);
//     border: 1px solid var(--primary);
//     border-radius: 4px;
//     font-size: 11px;
//     font-weight: 600;
//     cursor: pointer;
//     font-family: inherit;
//     display: inline-flex;
//     align-items: center;
//     gap: 4px;
//     position: relative;
// }
// .mad-wrap .vwa-card-metric-btn:hover { background: #e7f3ff; }
// .mad-wrap .vwa-card-metric-dropdown {
//     position: absolute;
//     top: 100%;
//     right: 0;
//     margin-top: 4px;
//     background: #fff;
//     border: 1px solid var(--border);
//     border-radius: 6px;
//     box-shadow: 0 8px 24px rgba(0,0,0,.2);
//     padding: 10px;
//     z-index: 1000;
//     min-width: 200px;
//     max-height: 420px;
//     overflow-y: auto;
//     text-align: left;
//     display: flex;
//     flex-direction: column;
//     gap: 6px;
// }
// .mad-wrap .vwa-card-metric-dropdown .vwa-switch-item {
//     padding: 5px 8px;
//     font-size: 12px;
// }

// /* Clickable "Load Ad Sets" / "Load Ads" button */
// .mad-wrap .vwa-load-more {
//     display: flex;
//     align-items: center;
//     gap: 8px;
//     padding: 10px 14px;
//     background: #f0f7ff;
//     border: 1px dashed var(--primary);
//     border-radius: 6px;
//     cursor: pointer;
//     color: var(--primary);
//     font-weight: 600;
//     font-size: 12.5px;
//     margin-top: 10px;
//     transition: background .15s;
//     font-family: inherit;
//     width: 100%;
//     justify-content: center;
// }
// .mad-wrap .vwa-load-more:hover { background: #e0ecff; }
// .mad-wrap .vwa-load-more i { transition: transform .2s; }
// .mad-wrap .vwa-load-more.loaded i { transform: rotate(90deg); }
// `;

// /* =========================================================================
//    5. MAIN COMPONENT
//    ========================================================================= */
// export default function MetaAdsDashboard({
//     apiUrl = 'https://cit3.internshipstudio.com/admin/react-api/api/reports/meta_ads.php',
//     user = null,   // { id, name } — pass from AdminLayout's useAuth()
// }) {
//     // Normalize user object so the notes feature always has something to send.
//     // Different auth systems use different field names, so we check the common ones.
//     // If no user is passed we fall back to id=0/name='Anonymous' and notes
//     // will still work but ownership will be unclear.
//     const noteUser = {
//         id: Number(
//             (user && (user.id ?? user.user_id ?? user.uid ?? user.ID ?? user._id)) || 0
//         ),
//         name: String(
//             (user && (user.name ?? user.full_name ?? user.username ?? user.email)) || 'Anonymous'
//         ),
//     };
//     // Debug: log once so you can verify the user prop arrived correctly
//     useEffect(() => {
//         if (user !== null && user !== undefined) {
//             // eslint-disable-next-line no-console
//             console.log('[MetaAdsDashboard] user prop received:', user, '-> noteUser:', noteUser);
//         } else {
//             // eslint-disable-next-line no-console
//             console.warn('[MetaAdsDashboard] no user prop was passed. Notes save will fail. '
//                 + 'Pass user from your auth context, e.g. <MetaAdsDashboard user={user} />');
//         }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, []);

//     /* ---------- Refs (non-reactive raw data) ---------- */
//     const allMetaRawRef       = useRef([]);
//     const campaignStatusMap   = useRef({});
//     const campaignEventMap    = useRef({});
//     const adsetsFromMetaRef   = useRef([]);
//     const adsFromMetaRef      = useRef([]);
//     const tableWrapperRef     = useRef(null);
//     const footerWrapperRef    = useRef(null);
//     const searchBlurTimerRef  = useRef(null);

//     /* ---------- Core state ---------- */
//     const [citVersions, setCitVersions] = useState([]);
//     const [selectedCit, setSelectedCit] = useState('');
//     const [perPage, setPerPage]         = useState(100);

//     const [confirmedFrom,        setConfirmedFrom]        = useState('');
//     const [confirmedTo,          setConfirmedTo]          = useState('');
//     const [confirmedCompareFrom, setConfirmedCompareFrom] = useState('');
//     const [confirmedCompareTo,   setConfirmedCompareTo]   = useState('');
//     const [isComparison,         setIsComparison]         = useState(false);

//     const [campaignData, setCampaignData] = useState([]);
//     const [adsetData,    setAdsetData]    = useState([]);
//     const [adData,       setAdData]       = useState([]);

//     const [currentLevel, setCurrentLevel] = useState('campaign');

//     /* selections are kept in a ref + a counter to trigger rerenders
//        (Set mutation is faster than rebuilding immutable structures) */
//     const selectedCampaignNamesRef = useRef(new Set());
//     const selectedAdsetNamesRef    = useRef(new Set());
//     const selectedAdNamesRef       = useRef(new Set());
//     const [selectionTick, setSelectionTick] = useState(0);
//     const bumpSelection = useCallback(() => setSelectionTick(t => t + 1), []);

//     /* search / sort / filter */
//     const [searchTerm, setSearchTerm]           = useState('');
//     const [searchMode, setSearchMode]           = useState('campaign');
//     const [showSuggestions, setShowSuggestions] = useState(false);

//     const [sortField,     setSortField]     = useState(null);
//     const [sortDirection, setSortDirection] = useState('asc');

//     const [columnFilters, setColumnFilters]       = useState({});
//     const [activeFilterColumn, setActiveFilterColumn] = useState(null);
//     const [filterDropdown, setFilterDropdown]     = useState({ open: false, x: 0, y: 0 });
//     const [filterSearchTerm, setFilterSearchTerm] = useState('');
//     const [pendingFilterValues, setPendingFilterValues] = useState([]);

//     /* comparison expanded columns */
//     const [expandedColumns, setExpandedColumns] = useState(new Set());

//     /* ==================================================================
//        VERSION ANALYSIS STATE (per PDF spec)
//        ================================================================== */
//     const [selectedVersionsVA, setSelectedVersionsVA] = useState([]);
//     const [selectedMetricsVA,  setSelectedMetricsVA]  = useState(
//         new Set(['cpm','cpc','ctr','cpl','cost_per_exam','roi','spend'])
//     );
//     const [vaCampaigns,        setVaCampaigns]        = useState([]);
//     const [vaLoading,          setVaLoading]          = useState(false);
//     const [vaSearchTerm,       setVaSearchTerm]       = useState('');

//     /* accordion state (Sets of string keys) */
//     const [expandedCampaignsVA, setExpandedCampaignsVA] = useState(new Set());
//     const [expandedAdsetsVA,    setExpandedAdsetsVA]    = useState(new Set());

//     /* lazy-load caches */
//     const [adsetsCacheVA,   setAdsetsCacheVA]   = useState({}); // { campaignName: [...adsets] }
//     const [adsCacheVA,      setAdsCacheVA]      = useState({}); // { "camp|||adset": [...ads] }
//     const [loadingAdsetsVA, setLoadingAdsetsVA] = useState(new Set());
//     const [loadingAdsVA,    setLoadingAdsVA]    = useState(new Set());

//     /* NEW: user-initiated load tracking (don't auto-refetch on collapse/re-expand) */
//     const [loadedAdsetsVA, setLoadedAdsetsVA] = useState(new Set()); // campaigns whose adsets user has clicked Load
//     const [loadedAdsVA,    setLoadedAdsVA]    = useState(new Set()); // "camp|||adset" keys

//     /* NEW: show more pills (start collapsed) */
//     const [pillsExpandedVA, setPillsExpandedVA] = useState(false);

//     /* NEW: status filter (all / active / paused / inactive / unknown) */
//     const [statusFilterVA, setStatusFilterVA] = useState('all');

//     /* NEW: per-card metric overrides. Map of campaignName -> Set(metricKey)
//        If a campaign is NOT in this map, global metrics apply.
//        If it IS in the map, only those keys are shown for that card. */
//     const [perCardMetricsVA, setPerCardMetricsVA] = useState({});

//     /* NEW: Final Reports modal */
//     const [finalReportOpen, setFinalReportOpen] = useState(false);
//     const [finalReportSort, setFinalReportSort] = useState({ key: 'roi', dir: 'desc' });

//     /* ==================================================================
//        NOTES FEATURE STATE
//        allNotes: { "entityType|||entityName": [ {id, user_id, user_name, note, updated_at}, ... ] }
//        notesFilter: when true, only show entities that have at least one note
//        ================================================================== */
//     const [allNotes, setAllNotes] = useState({});
//     const [notesFilter, setNotesFilter] = useState(false);
//     const [noteHistory, setNoteHistory] = useState(null); // { entity, rows } when history modal open

//     /* ==================================================================
//        COLUMN RESIZE (mirrors the original JS implementation)
//        Attaches a drag-handle .col-resizer to each thead th after render,
//        listens to mousedown, and imperatively sets width on th+td of that
//        column. No React state churn during the drag (smooth).
//        ================================================================== */
//     const dataTableRef = useRef(null);
//     const footerTableRef = useRef(null);

//     useEffect(() => {
//         const table = dataTableRef.current;
//         if (!table) return;
//         const footerTable = footerTableRef.current;
//         const wrap = table.closest('.mad-wrap');

//         // Attach resizer divs to every thead th (skip if already present)
//         const headers = table.querySelectorAll('thead th');
//         headers.forEach(th => {
//             if (th.querySelector('.col-resizer')) return;
//             const resizer = document.createElement('div');
//             resizer.className = 'col-resizer';
//             // Stop click bubbling so th.onClick (sort) does not fire after a resize
//             resizer.addEventListener('click', (ev) => { ev.stopPropagation(); });
//             th.appendChild(resizer);
//         });

//         let startX = 0, startWidth = 0, colIndex = -1, activeResizer = null;

//         const onMouseMove = (e) => {
//             if (colIndex < 0) return;
//             const newW = Math.max(60, startWidth + (e.pageX - startX));

//             // Apply to every cell in that column (thead + tbody)
//             const selector = `th:nth-child(${colIndex + 1}), td:nth-child(${colIndex + 1})`;
//             table.querySelectorAll(selector).forEach(el => {
//                 el.style.width    = newW + 'px';
//                 el.style.minWidth = newW + 'px';
//                 el.style.maxWidth = newW + 'px';
//             });
//             if (footerTable) {
//                 footerTable.querySelectorAll(`td:nth-child(${colIndex + 1})`).forEach(el => {
//                     el.style.width    = newW + 'px';
//                     el.style.minWidth = newW + 'px';
//                     el.style.maxWidth = newW + 'px';
//                 });
//             }
//         };

//         const onMouseUp = () => {
//             document.removeEventListener('mousemove', onMouseMove);
//             document.removeEventListener('mouseup', onMouseUp);
//             if (activeResizer) activeResizer.classList.remove('resizing');
//             if (wrap) wrap.classList.remove('is-resizing');
//             // Suppress the sort-click that fires on mouseup after a drag
//             window.__madJustResized = true;
//             setTimeout(() => { window.__madJustResized = false; }, 100);
//             colIndex = -1;
//             activeResizer = null;
//         };

//         const onMouseDown = (e) => {
//             const resizer = e.target;
//             if (!resizer.classList || !resizer.classList.contains('col-resizer')) return;
//             e.preventDefault();
//             e.stopPropagation();
//             const th = resizer.parentElement;
//             colIndex = Array.prototype.indexOf.call(th.parentElement.children, th);
//             startX = e.pageX;
//             startWidth = th.offsetWidth;
//             activeResizer = resizer;
//             resizer.classList.add('resizing');
//             if (wrap) wrap.classList.add('is-resizing');
//             document.addEventListener('mousemove', onMouseMove);
//             document.addEventListener('mouseup', onMouseUp);
//         };

//         // Delegate via thead so new columns (added when comparison expands) get handled too
//         const thead = table.querySelector('thead');
//         if (thead) thead.addEventListener('mousedown', onMouseDown);

//         return () => {
//             if (thead) thead.removeEventListener('mousedown', onMouseDown);
//             document.removeEventListener('mousemove', onMouseMove);
//             document.removeEventListener('mouseup', onMouseUp);
//         };
//     }, [currentLevel, isComparison, expandedColumns]); // re-attach when thead structure changes

//     /* token box */
//     const [showTokenBox, setShowTokenBox] = useState(false);
//     const [newToken,     setNewToken]     = useState('');

//     /* alerts */
//     const [alert, setAlert] = useState(null);
//     const alertTimerRef = useRef(null);
//     const showAlert = useCallback((message, type = 'error') => {
//         setAlert({ message, type });
//         clearTimeout(alertTimerRef.current);
//         alertTimerRef.current = setTimeout(() => setAlert(null), 5000);
//     }, []);

//     /* loading */
//     const [loading, setLoading] = useState(false);

//     /* phase-2 background load flag (UI only) */
//     const [phase2Loading, setPhase2Loading] = useState(false);

//     /* =====================================================================
//        DATE PICKER STATE
//        ===================================================================== */
//     const [dpOpen, setDpOpen] = useState(false);
//     const [dpFromDate, setDpFromDate] = useState(null);
//     const [dpToDate,   setDpToDate]   = useState(null);
//     const [dpTempFrom, setDpTempFrom] = useState(null);
//     const [dpTempTo,   setDpTempTo]   = useState(null);
//     const [dpViewMonth, setDpViewMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
//     const [dpActivePreset, setDpActivePreset] = useState(null);

//     const [dpCompareFromDate, setDpCompareFromDate] = useState(null);
//     const [dpCompareToDate,   setDpCompareToDate]   = useState(null);
//     const [dpTempCompareFrom, setDpTempCompareFrom] = useState(null);
//     const [dpTempCompareTo,   setDpTempCompareTo]   = useState(null);
//     const [dpCompareViewMonth, setDpCompareViewMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
//     const [dpTempIsComparison, setDpTempIsComparison] = useState(false);

//     /* =====================================================================
//        ACTION: get_cit_versions + get_date_range
//        ===================================================================== */
//     const loadCitVersions = useCallback(async () => {
//         try {
//             const data = await apiAction(apiUrl, 'get_cit_versions');
//             if (data.success && data.versions.length > 0) {
//                 setCitVersions(data.versions);
//                 setSelectedCit(data.versions[0]);
//                 await loadDateRange(data.versions[0], true);
//             } else {
//                 showAlert('No CIT versions found');
//             }
//         } catch (e) {
//             showAlert('Error loading CIT versions: ' + e.message);
//         }
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [apiUrl]);

//     const loadDateRange = useCallback(async (citVersion, autoFetch = false) => {
//         try {
//             const data = await apiAction(apiUrl, 'get_date_range', { cit_version: citVersion });
//             if (data.success) {
//                 setDpFromDate(parseYMD(data.from_date));
//                 setDpToDate(parseYMD(data.to_date));
//                 setConfirmedFrom(data.from_date);
//                 setConfirmedTo(data.to_date);
//                 if (autoFetch) {
//                     setTimeout(() => {
//                         fetchAnalyticsRef.current(citVersion, data.from_date, data.to_date);
//                     }, 0);
//                 }
//             } else {
//                 showAlert(data.message || 'Error loading date range');
//             }
//         } catch (e) {
//             showAlert('Error loading date range: ' + e.message);
//         }
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [apiUrl]);

//     /* Keep the latest fetchAnalytics in a ref for autoFetch callback */
//     const fetchAnalyticsRef = useRef(null);

//     /* =====================================================================
//        ACTION: fetch_analytics_phase1 (fast) + phase2 (background)
//        ===================================================================== */
//     const fetchAnalytics = useCallback(async (overrideCit = null, overrideFrom = null, overrideTo = null) => {
//         const cit  = overrideCit  ?? selectedCit;
//         const from = overrideFrom ?? confirmedFrom;
//         const to   = overrideTo   ?? confirmedTo;

//         if (!cit || !from || !to) {
//             showAlert('Please select CIT version and date range');
//             return;
//         }

//         setLoading(true);

//         /* reset phase-2 caches */
//         campaignStatusMap.current = {};
//         campaignEventMap.current  = {};
//         adsFromMetaRef.current    = [];
//         adsetsFromMetaRef.current = [];
//         setPhase2Loading(true);

//         try {
//             const params = {
//                 cit_version: cit,
//                 from_date: from,
//                 to_date: to,
//                 per_page: perPage,
//             };
//             if (isComparison && confirmedCompareFrom && confirmedCompareTo) {
//                 params.compare_from_date = confirmedCompareFrom;
//                 params.compare_to_date   = confirmedCompareTo;
//             }

//             const data = await apiAction(apiUrl, 'fetch_analytics_phase1', params);

//             if (data.token_expired) {
//                 showAlert('Meta Access Token Expired. Please update token.');
//                 setShowTokenBox(true);
//                 setLoading(false);
//                 setPhase2Loading(false);
//                 return;
//             }

//             if (data.success) {
//                 const rows = (data.data || []).map(row => {
//                     const imp = row.impressions || 0;
//                     return {
//                         ...row,
//                         cpm: imp > 0 ? (row.spend / imp * 1000) : 0,
//                         exam_percent: row.registrations > 0 ? ((row.exam_count / row.registrations) * 100) : 0,
//                         delivery_status:  'LOADING',
//                         conversion_event: 'LOADING',
//                     };
//                 });

//                 setCampaignData(rows);
//                 allMetaRawRef.current = data.meta_raw || [];
//                 setIsComparison(!!data.is_comparison);

//                 /* reset selections and dependent tables */
//                 selectedCampaignNamesRef.current.clear();
//                 selectedAdsetNamesRef.current.clear();
//                 selectedAdNamesRef.current.clear();
//                 bumpSelection();
//                 setAdsetData([]);
//                 setAdData([]);
//                 setCurrentLevel('campaign');
//                 setSortField(null);
//                 setSortDirection('asc');
//                 setColumnFilters({});
//                 setSearchTerm('');
//                 setExpandedColumns(new Set());

//                 if (rows.length === 0) {
//                     showAlert('No data found for the selected filters', 'success');
//                 } else {
//                     showAlert(`Loaded ${rows.length} campaigns. Fetching delivery status...`, 'success');
//                 }

//                 /* kick off phase 2 in the background */
//                 fetchPhase2(cit, from, to);
//             } else {
//                 showAlert(data.message || 'Error fetching data');
//             }
//         } catch (e) {
//             showAlert('Error: ' + e.message);
//         } finally {
//             setLoading(false);
//         }
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [apiUrl, selectedCit, confirmedFrom, confirmedTo, perPage, isComparison, confirmedCompareFrom, confirmedCompareTo]);

//     /* update ref so loadDateRange auto-fetch works */
//     useEffect(() => { fetchAnalyticsRef.current = fetchAnalytics; }, [fetchAnalytics]);

//     const fetchPhase2 = useCallback(async (cit, from, to) => {
//         try {
//             const data = await apiAction(apiUrl, 'fetch_analytics_phase2', {
//                 cit_version: cit,
//                 from_date: from,
//                 to_date: to,
//             });

//             if (data.success) {
//                 campaignStatusMap.current = data.campaign_status_map || {};
//                 campaignEventMap.current  = data.campaign_event_map  || {};

//                 if (data.meta_raw && data.meta_raw.length > 0) {
//                     allMetaRawRef.current = data.meta_raw;
//                 }
//                 adsFromMetaRef.current    = data.ads_data    || [];
//                 adsetsFromMetaRef.current = data.adsets_data || [];

//                 /* patch campaignData with real status/event */
//                 setCampaignData(prev => prev.map(row => ({
//                     ...row,
//                     delivery_status:  campaignStatusMap.current[row.campaign_name] || 'UNKNOWN',
//                     conversion_event: campaignEventMap.current[row.campaign_id]    || 'UNKNOWN',
//                 })));

//                 /* if user already moved to adset tab, patch those too */
//                 setAdsetData(prev => prev.map(row => ({
//                     ...row,
//                     delivery_status:  campaignStatusMap.current[row.campaign_name] || row.delivery_status,
//                     conversion_event: campaignEventMap.current[row.campaign_id]    || row.conversion_event,
//                 })));

//                 showAlert('All data loaded successfully', 'success');
//             }
//         } catch (e) {
//             console.error('Phase 2 error:', e);
//         } finally {
//             setPhase2Loading(false);
//         }
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [apiUrl]);

//     /* =====================================================================
//        ACTION: fetch_adset_stats (called after campaign selection)
//        ===================================================================== */
//     const buildAdsetTable = useCallback(async () => {
//         const selected = selectedCampaignNamesRef.current;
//         if (selected.size === 0) {
//             setAdsetData([]);
//             return;
//         }

//         const map = {};
//         allMetaRawRef.current.forEach(row => {
//             if (!selected.has(row.campaign_name) || !row.adset_name) return;
//             const k = `${row.campaign_name}|||${row.adset_name}`;
//             if (!map[k]) {
//                 map[k] = {
//                     campaign_name: row.campaign_name,
//                     adset_name: row.adset_name,
//                     date_start: row.date_start,
//                     date_stop:  row.date_stop,
//                     spend: 0, impressions: 0, clicks: 0, reach: 0,
//                 };
//             }
//             map[k].spend       += parseFloat(row.spend || 0);
//             map[k].impressions += parseInt(row.impressions || 0);
//             map[k].clicks      += parseInt(row.clicks || 0);
//             map[k].reach       += parseInt(row.reach || 0);
//         });

//         const baseRows = Object.values(map).map(row => {
//             const mc = campaignData.find(c => c.campaign_name === row.campaign_name);
//             const cpm = row.impressions > 0 ? (row.spend / row.impressions * 1000) : 0;
//             return {
//                 ...row,
//                 cpm,
//                 exam_percent: 0,
//                 delivery_status:  mc ? mc.delivery_status  : 'UNKNOWN',
//                 conversion_event: mc ? mc.conversion_event : 'UNKNOWN',
//                 has_meta_data: true,
//                 registrations: 0, cost_per_registration: 0,
//                 exam_count: 0, cost_per_exam: 0,
//                 internship_count: 0, second_internship: 0, cost_per_internship: 0,
//                 revenue: 0, roi: 0, rpu: 0, cac_all: 0, cac_paid: 0, roas: 0,
//             };
//         });

//         setAdsetData(baseRows);

//         /* prune selections that no longer exist */
//         const valid = new Set(baseRows.map(r => r.campaign_name + '|||' + r.adset_name));
//         selectedAdsetNamesRef.current.forEach(k => {
//             if (!valid.has(k)) selectedAdsetNamesRef.current.delete(k);
//         });
//         bumpSelection();

//         /* fetch real DB stats for these adsets */
//         const adsetNames = baseRows.map(a => a.adset_name);
//         if (adsetNames.length === 0) return;

//         try {
//             const resp = await apiAction(apiUrl, 'fetch_adset_stats', {
//                 from_date: confirmedFrom,
//                 to_date: confirmedTo,
//                 adsets: adsetNames,
//             });
//             if (resp.success) {
//                 setAdsetData(prev => prev.map(row => {
//                     const stats = resp.data[row.adset_name];
//                     if (!stats) return row;
//                     const reg = stats.registrations || 0;
//                     const exam = stats.exam_count || 0;
//                     const intern = stats.internship_count || 0;
//                     const rev = stats.revenue || 0;
//                     const second = stats.second_internship || 0;
//                     return {
//                         ...row,
//                         registrations: reg,
//                         exam_count: exam,
//                         internship_count: intern,
//                         second_internship: second,
//                         revenue: rev,
//                         exam_percent:          reg > 0 ? (exam / reg * 100) : 0,
//                         cost_per_registration: reg > 0 ? row.spend / reg : 0,
//                         cost_per_exam:         exam > 0 ? row.spend / exam : 0,
//                         cost_per_internship:   intern > 0 ? row.spend / intern : 0,
//                         roi:   row.spend > 0 ? rev / row.spend : 0,
//                         rpu:   reg > 0 ? rev / reg : 0,
//                         cac_all:  reg > 0 ? row.spend / reg : 0,
//                         cac_paid: intern > 0 ? row.spend / intern : 0,
//                         roas: row.spend > 0 ? rev / row.spend : 0,
//                     };
//                 }));
//             }
//         } catch (e) {
//             console.error('fetch_adset_stats error:', e);
//         }
//     }, [apiUrl, campaignData, confirmedFrom, confirmedTo, bumpSelection]);

//     /* =====================================================================
//        ACTION: fetch_ad_stats (called after adset selection)
//        ===================================================================== */
//     const buildAdTable = useCallback(async () => {
//         const selectedAdsets = selectedAdsetNamesRef.current;
//         if (selectedAdsets.size === 0) {
//             setAdData([]);
//             return;
//         }

//         const map = {};
//         allMetaRawRef.current.forEach(row => {
//             const key = row.campaign_name + '|||' + row.adset_name;
//             if (!selectedAdsets.has(key) || !row.ad_name) return;
//             const k = `${row.campaign_name}|||${row.adset_name}|||${row.ad_name}`;
//             if (!map[k]) {
//                 map[k] = {
//                     campaign_name: row.campaign_name,
//                     adset_name: row.adset_name,
//                     ad_name: row.ad_name,
//                     date_start: row.date_start,
//                     date_stop:  row.date_stop,
//                     spend: 0, impressions: 0, clicks: 0, reach: 0,
//                 };
//             }
//             map[k].spend       += parseFloat(row.spend || 0);
//             map[k].impressions += parseInt(row.impressions || 0);
//             map[k].clicks      += parseInt(row.clicks || 0);
//             map[k].reach       += parseInt(row.reach || 0);
//         });

//         const baseRows = Object.values(map).map(row => {
//             const ma = adsetData.find(a => a.campaign_name === row.campaign_name && a.adset_name === row.adset_name);
//             const cpm = row.impressions > 0 ? (row.spend / row.impressions * 1000) : 0;
//             return {
//                 ...row,
//                 cpm,
//                 exam_percent: 0,
//                 delivery_status:  ma ? ma.delivery_status  : 'UNKNOWN',
//                 conversion_event: ma ? ma.conversion_event : 'UNKNOWN',
//                 has_meta_data: true,
//                 registrations: 0, cost_per_registration: 0,
//                 exam_count: 0, cost_per_exam: 0,
//                 internship_count: 0, second_internship: 0, cost_per_internship: 0,
//                 revenue: 0, roi: 0, rpu: 0, cac_all: 0, cac_paid: 0, roas: 0,
//             };
//         });

//         setAdData(baseRows);

//         selectedAdNamesRef.current.clear();
//         bumpSelection();

//         const adNames = baseRows.map(a => a.ad_name);
//         if (adNames.length === 0) return;

//         try {
//             const resp = await apiAction(apiUrl, 'fetch_ad_stats', {
//                 from_date: confirmedFrom,
//                 to_date: confirmedTo,
//                 ads: adNames,
//             });
//             if (resp.success) {
//                 setAdData(prev => prev.map(row => {
//                     const stats = resp.data[row.ad_name];
//                     if (!stats) return row;
//                     const reg = stats.registrations || 0;
//                     const exam = stats.exam_count || 0;
//                     const intern = stats.internship_count || 0;
//                     const rev = stats.revenue || 0;
//                     const second = stats.second_internship || 0;
//                     return {
//                         ...row,
//                         registrations: reg,
//                         exam_count: exam,
//                         internship_count: intern,
//                         second_internship: second,
//                         revenue: rev,
//                         exam_percent:          reg > 0 ? (exam / reg * 100) : 0,
//                         cost_per_registration: reg > 0 ? row.spend / reg : 0,
//                         cost_per_exam:         exam > 0 ? row.spend / exam : 0,
//                         cost_per_internship:   intern > 0 ? row.spend / intern : 0,
//                         roi:   row.spend > 0 ? rev / row.spend : 0,
//                         rpu:   reg > 0 ? rev / reg : 0,
//                         cac_all:  reg > 0 ? row.spend / reg : 0,
//                         cac_paid: intern > 0 ? row.spend / intern : 0,
//                         roas: row.spend > 0 ? rev / row.spend : 0,
//                     };
//                 }));
//             }
//         } catch (e) {
//             console.error('fetch_ad_stats error:', e);
//         }
//     }, [apiUrl, adsetData, confirmedFrom, confirmedTo, bumpSelection]);

//     /* =====================================================================
//        ACTION: update_meta_token
//        ===================================================================== */
//     const updateMetaToken = useCallback(async () => {
//         const token = newToken.trim();
//         if (!token) { showAlert('Enter token'); return; }
//         try {
//             const data = await apiAction(apiUrl, 'update_meta_token', { token });
//             if (data.success) {
//                 showAlert('Token Updated Successfully', 'success');
//                 setShowTokenBox(false);
//                 setNewToken('');
//                 fetchAnalytics();
//             } else {
//                 showAlert(data.message || 'Error updating token');
//             }
//         } catch (e) {
//             showAlert('Error: ' + e.message);
//         }
//     }, [apiUrl, newToken, fetchAnalytics, showAlert]);

//     /* =====================================================================
//        MOUNT
//        ===================================================================== */
//     useEffect(() => { loadCitVersions(); /* eslint-disable-next-line */ }, []);

//     /* =====================================================================
//        NOTES API FUNCTIONS (defined BEFORE fetch* so they're in-scope for deps)
//        ===================================================================== */

//     /** Bulk fetch notes for a list of entities [{type, name}, ...].
//         Merges into the allNotes state. */
//     const fetchNotes = useCallback(async (entities) => {
//         if (!entities || entities.length === 0) return;
//         try {
//             const resp = await apiAction(apiUrl, 'fetch_notes', {
//                 entities: JSON.stringify(entities),
//             });
//             if (resp && resp.success && resp.notes) {
//                 setAllNotes(prev => {
//                     const next = { ...prev };
//                     Object.keys(resp.notes).forEach(k => {
//                         next[k] = resp.notes[k];
//                     });
//                     return next;
//                 });
//             }
//         } catch (e) {
//             console.error('fetchNotes failed:', e);
//         }
//     }, [apiUrl]);

//     /** Save a note (create/update/delete when note is empty).
//         Optimistically merges into allNotes on success. */
//     const saveNote = useCallback(async (entityType, entityName, noteText, parentCampaign, parentAdset) => {
//         if (!noteUser.id) {
//             showAlert('Cannot save note: no user is logged in. Pass the `user` prop from AdminLayout.');
//             return;
//         }
//         try {
//             const resp = await apiAction(apiUrl, 'save_note', {
//                 entity_type: entityType,
//                 entity_name: entityName,
//                 parent_campaign: parentCampaign || '',
//                 parent_adset:    parentAdset    || '',
//                 user_id:   noteUser.id,
//                 user_name: noteUser.name,
//                 note: noteText || '',
//             });
//             if (!resp || !resp.success) {
//                 showAlert('Failed to save note: ' + (resp && resp.message || 'Unknown error'));
//                 return;
//             }

//             const key = entityType + '|||' + entityName;

//             setAllNotes(prev => {
//                 const next = { ...prev };
//                 const existingList = (next[key] || []).filter(n => n.user_id !== noteUser.id);

//                 if (resp.deleted) {
//                     if (existingList.length === 0) delete next[key];
//                     else next[key] = existingList;
//                 } else if (resp.note_id) {
//                     const updatedNote = {
//                         id: resp.note_id,
//                         user_id: noteUser.id,
//                         user_name: noteUser.name,
//                         note: noteText,
//                         updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
//                         created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
//                     };
//                     next[key] = [updatedNote, ...existingList];
//                 }
//                 return next;
//             });

//             if (resp.deleted) {
//                 showAlert('Note deleted', 'success');
//             } else {
//                 showAlert('Note saved', 'success');
//             }
//         } catch (e) {
//             showAlert('Network error while saving note: ' + e.message);
//         }
//     }, [apiUrl, noteUser.id, noteUser.name, showAlert]);

//     /** Fetch the full edit history for one entity. */
//     const fetchNoteHistory = useCallback(async (entityType, entityName) => {
//         try {
//             const resp = await apiAction(apiUrl, 'fetch_note_history', {
//                 entity_type: entityType,
//                 entity_name: entityName,
//             });
//             if (resp && resp.success) {
//                 setNoteHistory({
//                     entityType,
//                     entityName,
//                     rows: resp.history || [],
//                 });
//             }
//         } catch (e) {
//             console.error('fetchNoteHistory failed:', e);
//         }
//     }, [apiUrl]);

//     /* =====================================================================
//        VERSION ANALYSIS - ACTIONS
//        ===================================================================== */
//     const fetchVersionAnalysis = useCallback(async () => {
//         if (selectedVersionsVA.length === 0) {
//             showAlert('Please select at least one CIT version');
//             return;
//         }
//         setVaLoading(true);
//         setExpandedCampaignsVA(new Set());
//         setExpandedAdsetsVA(new Set());
//         setAdsetsCacheVA({});
//         setAdsCacheVA({});
//         setLoadedAdsetsVA(new Set());
//         setLoadedAdsVA(new Set());
//         setPerCardMetricsVA({});
//         setAllNotes({});
//         try {
//             const data = await apiAction(apiUrl, 'fetch_version_analysis', {
//                 versions: selectedVersionsVA,
//             });
//             if (data.token_expired) {
//                 showAlert('Meta Access Token Expired. Please update token.');
//                 setShowTokenBox(true);
//                 return;
//             }
//             if (data.success) {
//                 const campaigns = data.campaigns || [];
//                 setVaCampaigns(campaigns);
//                 // Fix 1: campaigns expanded by default per PDF spec 3.1
//                 setExpandedCampaignsVA(new Set(campaigns.map(c => c.campaign_name)));
//                 showAlert(`Loaded ${campaigns.length} campaigns across ${selectedVersionsVA.length} versions`, 'success');

//                 // Fetch notes for all returned campaigns (non-blocking)
//                 if (campaigns.length > 0) {
//                     fetchNotes(campaigns.map(c => ({ type: 'campaign', name: c.campaign_name })));
//                 }
//             } else {
//                 showAlert(data.message || 'Error fetching version data');
//                 setVaCampaigns([]);
//             }
//         } catch (e) {
//             showAlert('Error: ' + e.message);
//         } finally {
//             setVaLoading(false);
//         }
//     }, [apiUrl, selectedVersionsVA, showAlert]);

//     const fetchVersionAdsets = useCallback(async (campaignName) => {
//         if (adsetsCacheVA[campaignName]) return; // cached
//         setLoadingAdsetsVA(prev => {
//             const n = new Set(prev); n.add(campaignName); return n;
//         });
//         try {
//             const data = await apiAction(apiUrl, 'fetch_version_analysis_adsets', {
//                 versions: selectedVersionsVA,
//                 campaign_name: campaignName,
//             });
//             if (data.success) {
//                 const adsets = data.adsets || [];
//                 setAdsetsCacheVA(prev => ({ ...prev, [campaignName]: adsets }));
//                 if (adsets.length > 0) {
//                     fetchNotes(adsets.map(a => ({ type: 'adset', name: a.adset_name })));
//                 }
//             } else {
//                 showAlert(data.message || 'Error fetching ad sets');
//             }
//         } catch (e) {
//             showAlert('Error: ' + e.message);
//         } finally {
//             setLoadingAdsetsVA(prev => {
//                 const n = new Set(prev); n.delete(campaignName); return n;
//             });
//         }
//     }, [apiUrl, selectedVersionsVA, adsetsCacheVA, showAlert, fetchNotes]);

//     const fetchVersionAds = useCallback(async (campaignName, adsetName) => {
//         const key = campaignName + '|||' + adsetName;
//         if (adsCacheVA[key]) return;
//         setLoadingAdsVA(prev => {
//             const n = new Set(prev); n.add(key); return n;
//         });
//         try {
//             const data = await apiAction(apiUrl, 'fetch_version_analysis_ads', {
//                 versions: selectedVersionsVA,
//                 campaign_name: campaignName,
//                 adset_name: adsetName,
//             });
//             if (data.success) {
//                 const ads = data.ads || [];
//                 setAdsCacheVA(prev => ({ ...prev, [key]: ads }));
//                 if (ads.length > 0) {
//                     fetchNotes(ads.map(a => ({ type: 'ad', name: a.ad_name })));
//                 }
//             } else {
//                 showAlert(data.message || 'Error fetching ads');
//             }
//         } catch (e) {
//             showAlert('Error: ' + e.message);
//         } finally {
//             setLoadingAdsVA(prev => {
//                 const n = new Set(prev); n.delete(key); return n;
//             });
//         }
//     }, [apiUrl, selectedVersionsVA, adsCacheVA, showAlert]);

//     const toggleCampaignExpandVA = useCallback((campaignName) => {
//         setExpandedCampaignsVA(prev => {
//             const n = new Set(prev);
//             if (n.has(campaignName)) n.delete(campaignName);
//             else n.add(campaignName);
//             return n;
//         });
//     }, []);

//     const toggleAdsetExpandVA = useCallback((campaignName, adsetName) => {
//         const key = campaignName + '|||' + adsetName;
//         setExpandedAdsetsVA(prev => {
//             const n = new Set(prev);
//             if (n.has(key)) n.delete(key);
//             else n.add(key);
//             return n;
//         });
//     }, []);

//     const toggleVersionPillVA = useCallback((version) => {
//         setSelectedVersionsVA(prev =>
//             prev.includes(version) ? prev.filter(v => v !== version) : [...prev, version]
//         );
//     }, []);

//     const toggleMetricVA = useCallback((metricKey) => {
//         setSelectedMetricsVA(prev => {
//             const n = new Set(prev);
//             if (n.has(metricKey)) n.delete(metricKey);
//             else n.add(metricKey);
//             return n;
//         });
//     }, []);

//     /* Per-card metric override toggle.
//        Starts the card with its own copy of the global Set if absent. */
//     const togglePerCardMetric = useCallback((campaignName, metricKey) => {
//         setPerCardMetricsVA(prev => {
//             const existing = prev[campaignName] ? new Set(prev[campaignName]) : new Set(selectedMetricsVA);
//             if (existing.has(metricKey)) existing.delete(metricKey);
//             else existing.add(metricKey);
//             return { ...prev, [campaignName]: existing };
//         });
//     }, [selectedMetricsVA]);

//     const resetPerCardMetrics = useCallback((campaignName) => {
//         setPerCardMetricsVA(prev => {
//             const n = { ...prev };
//             delete n[campaignName];
//             return n;
//         });
//     }, []);

//     /* Explicit "Load Ad Sets" click handler. Fetches only if not yet loaded. */
//     const clickLoadAdsets = useCallback((campaignName) => {
//         setLoadedAdsetsVA(prev => {
//             const n = new Set(prev); n.add(campaignName); return n;
//         });
//         if (!adsetsCacheVA[campaignName]) {
//             fetchVersionAdsets(campaignName);
//         }
//     }, [adsetsCacheVA, fetchVersionAdsets]);

//     const clickLoadAds = useCallback((campaignName, adsetName) => {
//         const key = campaignName + '|||' + adsetName;
//         setLoadedAdsVA(prev => {
//             const n = new Set(prev); n.add(key); return n;
//         });
//         if (!adsCacheVA[key]) {
//             fetchVersionAds(campaignName, adsetName);
//         }
//     }, [adsCacheVA, fetchVersionAds]);

//     const exportCampaignCSV = useCallback((campaign) => {
//         const cols = ['version', ...VA_METRICS.filter(m => selectedMetricsVA.has(m.key)).map(m => m.key)];
//         let csv = cols.join(',') + '\n';
//         campaign.versions.forEach(v => {
//             const row = cols.map(c => {
//                 if (c === 'version') return `"${v.version}"`;
//                 const val = v.no_data ? '' : (v[c] ?? '');
//                 return `"${val}"`;
//             });
//             csv += row.join(',') + '\n';
//         });
//         const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
//         const link = document.createElement('a');
//         link.href = URL.createObjectURL(blob);
//         link.download = `version_analysis_${campaign.campaign_name.replace(/[^\w]+/g,'_')}.csv`;
//         link.click();
//     }, [selectedMetricsVA]);


//     /* Sync horizontal scroll between table and footer */
//     useEffect(() => {
//         const tw = tableWrapperRef.current;
//         const fw = footerWrapperRef.current;
//         if (!tw || !fw) return;
//         const onTw = () => { fw.scrollLeft = tw.scrollLeft; };
//         const onFw = () => { tw.scrollLeft = fw.scrollLeft; };
//         tw.addEventListener('scroll', onTw);
//         fw.addEventListener('scroll', onFw);
//         return () => {
//             tw.removeEventListener('scroll', onTw);
//             fw.removeEventListener('scroll', onFw);
//         };
//     }, [campaignData, adsetData, adData, currentLevel]);

//     /* =====================================================================
//        DERIVED: allData (what is currently shown)
//        ===================================================================== */
//     const getBaseData = () => {
//         if (currentLevel === 'campaign') return campaignData;
//         if (currentLevel === 'adset')    return adsetData;
//         return adData;
//     };

//     const allData = (() => {
//         let data = [...getBaseData()];

//         /* column filters */
//         if (Object.keys(columnFilters).length > 0) {
//             data = data.filter(row =>
//                 Object.entries(columnFilters).every(([col, values]) => {
//                     if (!values || values.length === 0) return true;
//                     let fieldValue;
//                     if      (col === 'campaign') fieldValue = row.campaign_name;
//                     else if (col === 'adset')    fieldValue = row.adset_name;
//                     else if (col === 'ad')       fieldValue = row.ad_name;
//                     else if (col === 'delivery') fieldValue = row.delivery_status;
//                     else if (col === 'event')    fieldValue = row.conversion_event;
//                     else fieldValue = row[col];
//                     return values.includes(String(fieldValue));
//                 })
//             );
//         }

//         /* search */
//         const term = searchTerm.toLowerCase().trim();
//         if (term) {
//             data = data.filter(r => {
//                 const field =
//                     searchMode === 'adset'    ? r.adset_name :
//                     searchMode === 'ad'       ? r.ad_name    :
//                                                 r.campaign_name;
//                 return field && field.toLowerCase().includes(term);
//             });
//         }

//         /* sort */
//         if (sortField) {
//             data.sort((a, b) => {
//                 let va = a[sortField];
//                 let vb = b[sortField];
//                 if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
//                 if (va == null) va = 0;
//                 if (vb == null) vb = 0;
//                 const dir = sortDirection === 'asc' ? 1 : -1;
//                 return va > vb ? dir : va < vb ? -dir : 0;
//             });
//         }

//         return data;
//     })();

//     /* =====================================================================
//        HEADER STATS (from full campaignData)
//        ===================================================================== */
//     const headerStats = (() => {
//         const t = campaignData.reduce((a, r) => {
//             a.spend += r.spend || 0;
//             a.registrations += r.registrations || 0;
//             a.revenue += r.revenue || 0;
//             return a;
//         }, { spend: 0, registrations: 0, revenue: 0 });
//         return {
//             campaigns: campaignData.length,
//             registrations: t.registrations,
//             spend: t.spend,
//             revenue: t.revenue,
//             roi: t.spend > 0 ? t.revenue / t.spend : 0,
//         };
//     })();

//     /* =====================================================================
//        FOOTER TOTALS (from allData - reflects current filters/search)
//        ===================================================================== */
//     const footerTotals = (() => {
//         const t = allData.reduce((a, r) => {
//             a.spend += r.spend || 0;
//             a.reg += r.registrations || 0;
//             a.exam += r.exam_count || 0;
//             a.intern += r.internship_count || 0;
//             a.intern2 += r.second_internship || 0;
//             a.revenue += r.revenue || 0;
//             a.impressions += r.impressions || 0;
//             a.reach += r.reach || 0;
//             return a;
//         }, { spend:0, reg:0, exam:0, intern:0, intern2:0, revenue:0, impressions:0, reach:0 });

//         return {
//             ...t,
//             cpm:         t.impressions > 0 ? (t.spend / t.impressions * 1000) : 0,
//             cost_per_registration: t.reg > 0 ? t.spend / t.reg : 0,
//             cost_per_exam:         t.exam > 0 ? t.spend / t.exam : 0,
//             exam_percent:          t.reg > 0 ? ((t.exam / t.reg) * 100) : 0,
//             cost_per_internship:   t.intern > 0 ? t.spend / t.intern : 0,
//             roi:  t.spend > 0 ? t.revenue / t.spend : 0,
//             rpu:  t.reg > 0 ? t.revenue / t.reg : 0,
//             cac_all:  t.reg > 0 ? t.spend / t.reg : 0,
//             cac_paid: t.intern > 0 ? t.spend / t.intern : 0,
//             roas: t.spend > 0 ? t.revenue / t.spend : 0,
//         };
//     })();

//     /* =====================================================================
//        BADGES
//        ===================================================================== */
//     const selCampaignCount = selectedCampaignNamesRef.current.size; // eslint-disable-line no-unused-vars
//     const selAdsetCount    = selectedAdsetNamesRef.current.size;    // eslint-disable-line no-unused-vars
//     const _tick = selectionTick;                                     // eslint-disable-line no-unused-vars

//     /* =====================================================================
//        CHECKBOX HANDLERS
//        ===================================================================== */
//     const handleRowCheckbox = (row, checked) => {
//         if (currentLevel === 'campaign') {
//             const key = row.campaign_name;
//             if (checked) selectedCampaignNamesRef.current.add(key);
//             else         selectedCampaignNamesRef.current.delete(key);
//             bumpSelection();
//             buildAdsetTable();
//         } else if (currentLevel === 'adset') {
//             const key = row.campaign_name + '|||' + row.adset_name;
//             if (checked) selectedAdsetNamesRef.current.add(key);
//             else         selectedAdsetNamesRef.current.delete(key);
//             bumpSelection();
//             buildAdTable();
//         }
//     };

//     const handleSelectAll = (checked) => {
//         if (currentLevel === 'campaign') {
//             if (checked) allData.forEach(r => selectedCampaignNamesRef.current.add(r.campaign_name));
//             else         allData.forEach(r => selectedCampaignNamesRef.current.delete(r.campaign_name));
//             bumpSelection();
//             buildAdsetTable();
//         } else if (currentLevel === 'adset') {
//             if (checked) allData.forEach(r => selectedAdsetNamesRef.current.add(r.campaign_name + '|||' + r.adset_name));
//             else         allData.forEach(r => selectedAdsetNamesRef.current.delete(r.campaign_name + '|||' + r.adset_name));
//             bumpSelection();
//             buildAdTable();
//         }
//     };

//     const isRowSelected = (row) => {
//         if (currentLevel === 'campaign')
//             return selectedCampaignNamesRef.current.has(row.campaign_name);
//         if (currentLevel === 'adset')
//             return selectedAdsetNamesRef.current.has(row.campaign_name + '|||' + row.adset_name);
//         return false;
//     };

//     const selectAllState = (() => {
//         const total = allData.length;
//         let sel = 0;
//         if (currentLevel === 'campaign')
//             sel = allData.filter(r => selectedCampaignNamesRef.current.has(r.campaign_name)).length;
//         else if (currentLevel === 'adset')
//             sel = allData.filter(r => selectedAdsetNamesRef.current.has(r.campaign_name + '|||' + r.adset_name)).length;
//         return { checked: total > 0 && sel === total, indeterminate: sel > 0 && sel < total };
//     })();

//     /* =====================================================================
//        LEVEL TAB SWITCH
//        ===================================================================== */
//     const switchLevel = (newLevel) => {
//         setSearchTerm('');
//         setShowSuggestions(false);

//         if (newLevel === 'adset' && selectedCampaignNamesRef.current.size === 0) {
//             showAlert('Please select at least one campaign first');
//             return;
//         }
//         if (newLevel === 'ad' && selectedAdsetNamesRef.current.size === 0) {
//             showAlert('Please select at least one ad set first');
//             return;
//         }

//         setCurrentLevel(newLevel);
//         if (newLevel === 'adset') buildAdsetTable();
//         if (newLevel === 'ad')    buildAdTable();
//     };

//     /* =====================================================================
//        SORT HANDLER
//        ===================================================================== */
//     const handleSort = (field) => {
//         // Ignore the click that fires right after a resize drag
//         if (typeof window !== 'undefined' && window.__madJustResized) return;

//         if (sortField === field) {
//             setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
//         } else {
//             setSortField(field);
//             setSortDirection('asc');
//         }
//     };

//     /* =====================================================================
//        SEARCH HANDLERS
//        ===================================================================== */
//     const handleSearchInput = (e) => {
//         setSearchTerm(e.target.value);
//         setShowSuggestions(e.target.value.trim() !== '');
//     };

//     const applySearchSuggestion = (type) => {
//         const term = searchTerm.trim();
//         setSearchMode(type);
//         setShowSuggestions(false);

//         if (type === 'campaign') {
//             setCurrentLevel('campaign');
//         } else if (type === 'adset') {
//             if (selectedCampaignNamesRef.current.size === 0) {
//                 showAlert('Please select at least one campaign first');
//                 return;
//             }
//             setCurrentLevel('adset');
//             buildAdsetTable();
//         } else if (type === 'ad') {
//             if (selectedAdsetNamesRef.current.size === 0) {
//                 showAlert('Please select at least one ad set first');
//                 return;
//             }
//             setCurrentLevel('ad');
//             buildAdTable();
//         }
//     };

//     /* =====================================================================
//        COLUMN FILTER HANDLERS
//        ===================================================================== */
//     const openColumnFilter = (column, evt) => {
//         evt.stopPropagation();
//         const rect = evt.currentTarget.getBoundingClientRect();
//         const fieldMap = {
//             campaign:'campaign_name', adset:'adset_name', ad:'ad_name',
//             delivery:'delivery_status', event:'conversion_event',
//         };
//         const fieldName = fieldMap[column] || column;
//         const values = new Set();
//         getBaseData().forEach(r => {
//             const v = r[fieldName];
//             if (v !== null && v !== undefined) values.add(String(v));
//         });
//         const existing = columnFilters[column];
//         const initial = existing ? [...existing] : Array.from(values);

//         setActiveFilterColumn(column);
//         setFilterSearchTerm('');
//         setPendingFilterValues(initial);
//         setFilterDropdown({ open: true, x: rect.left, y: rect.bottom + 5, options: Array.from(values).sort() });
//     };

//     const togglePendingValue = (val) => {
//         setPendingFilterValues(prev =>
//             prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
//         );
//     };

//     const toggleSelectAllFilter = (checked, allOptions) => {
//         setPendingFilterValues(checked ? [...allOptions] : []);
//     };

//     const applyColumnFilter = () => {
//         if (!activeFilterColumn) return;
//         const allOptions = filterDropdown.options || [];
//         if (pendingFilterValues.length === allOptions.length) {
//             setColumnFilters(prev => {
//                 const next = { ...prev };
//                 delete next[activeFilterColumn];
//                 return next;
//             });
//         } else {
//             setColumnFilters(prev => ({ ...prev, [activeFilterColumn]: pendingFilterValues }));
//         }
//         setFilterDropdown({ open: false, x: 0, y: 0 });
//         setActiveFilterColumn(null);
//     };

//     const clearColumnFilter = () => {
//         if (!activeFilterColumn) return;
//         setColumnFilters(prev => {
//             const next = { ...prev };
//             delete next[activeFilterColumn];
//             return next;
//         });
//         setFilterDropdown({ open: false, x: 0, y: 0 });
//         setActiveFilterColumn(null);
//     };

//     /* close filter on outside click */
//     useEffect(() => {
//         if (!filterDropdown.open) return;
//         const handler = (e) => {
//             if (!e.target.closest('.column-filter-dropdown') && !e.target.closest('.filter-icon')) {
//                 setFilterDropdown({ open: false, x: 0, y: 0 });
//                 setActiveFilterColumn(null);
//             }
//         };
//         setTimeout(() => document.addEventListener('click', handler), 10);
//         return () => document.removeEventListener('click', handler);
//     }, [filterDropdown.open]);

//     /* =====================================================================
//        COMPARISON EXPANSION
//        ===================================================================== */
//     const toggleExpand = (column, evt) => {
//         evt.stopPropagation();
//         if (!isComparison) return;
//         setExpandedColumns(prev => {
//             const next = new Set(prev);
//             if (next.has(column)) next.delete(column);
//             else next.add(column);
//             return next;
//         });
//     };

//     /* =====================================================================
//        DATE PICKER HANDLERS
//        ===================================================================== */
//     const openDatePicker = () => {
//         setDpTempFrom(dpFromDate ? new Date(dpFromDate) : null);
//         setDpTempTo(dpToDate ? new Date(dpToDate) : null);
//         setDpTempIsComparison(isComparison);
//         if (dpFromDate) setDpViewMonth(new Date(dpFromDate.getFullYear(), dpFromDate.getMonth(), 1));

//         if (isComparison) {
//             setDpTempCompareFrom(dpCompareFromDate ? new Date(dpCompareFromDate) : null);
//             setDpTempCompareTo(dpCompareToDate ? new Date(dpCompareToDate) : null);
//             if (dpCompareFromDate)
//                 setDpCompareViewMonth(new Date(dpCompareFromDate.getFullYear(), dpCompareFromDate.getMonth(), 1));
//         }
//         setDpOpen(true);
//     };

//     const closeDatePicker = () => setDpOpen(false);

//     const handleDayClick = (d) => {
//         if (!dpTempFrom || (dpTempFrom && dpTempTo)) {
//             setDpTempFrom(d);
//             setDpTempTo(null);
//             setDpActivePreset(null);
//             if (dpTempIsComparison) {
//                 const prev = getPreviousPeriod(toYMD(d), toYMD(d));
//                 setDpTempCompareFrom(parseYMD(prev.from));
//                 setDpTempCompareTo(parseYMD(prev.to));
//                 setDpCompareViewMonth(new Date(parseYMD(prev.from).getFullYear(), parseYMD(prev.from).getMonth(), 1));
//             }
//         } else {
//             let from = dpTempFrom, to = d;
//             if (d < dpTempFrom) { from = d; to = dpTempFrom; }
//             setDpTempFrom(from);
//             setDpTempTo(to);
//             setDpActivePreset(null);
//             if (dpTempIsComparison) {
//                 const prev = getPreviousPeriod(toYMD(from), toYMD(to));
//                 setDpTempCompareFrom(parseYMD(prev.from));
//                 setDpTempCompareTo(parseYMD(prev.to));
//                 setDpCompareViewMonth(new Date(parseYMD(prev.from).getFullYear(), parseYMD(prev.from).getMonth(), 1));
//             }
//         }
//     };

//     const handleCompareDayClick = (d) => {
//         if (!dpTempCompareFrom || (dpTempCompareFrom && dpTempCompareTo)) {
//             setDpTempCompareFrom(d);
//             setDpTempCompareTo(null);
//         } else {
//             if (d < dpTempCompareFrom) { setDpTempCompareTo(dpTempCompareFrom); setDpTempCompareFrom(d); }
//             else setDpTempCompareTo(d);
//         }
//     };

//     const applyPreset = (preset) => {
//         const today = new Date();
//         today.setHours(0, 0, 0, 0);
//         let from, to;
//         switch (preset) {
//             case 'today':     from = new Date(today); to = new Date(today); break;
//             case 'yesterday': from = new Date(today); from.setDate(from.getDate() - 1); to = new Date(from); break;
//             case 'last7':     to = new Date(today); from = new Date(today); from.setDate(from.getDate() - 6); break;
//             case 'last14':    to = new Date(today); from = new Date(today); from.setDate(from.getDate() - 13); break;
//             case 'last28':    to = new Date(today); from = new Date(today); from.setDate(from.getDate() - 27); break;
//             case 'last30':    to = new Date(today); from = new Date(today); from.setDate(from.getDate() - 29); break;
//             case 'thisweek':  from = new Date(today); from.setDate(from.getDate() - from.getDay()); to = new Date(today); break;
//             case 'lastweek':  to = new Date(today); to.setDate(to.getDate() - today.getDay() - 1); from = new Date(to); from.setDate(from.getDate() - 6); break;
//             case 'thismonth': from = new Date(today.getFullYear(), today.getMonth(), 1); to = new Date(today); break;
//             case 'lastmonth': to = new Date(today.getFullYear(), today.getMonth(), 0); from = new Date(today.getFullYear(), today.getMonth() - 1, 1); break;
//             default: return;
//         }
//         setDpTempFrom(from);
//         setDpTempTo(to);
//         setDpActivePreset(preset);
//         setDpViewMonth(new Date(from.getFullYear(), from.getMonth(), 1));
//         if (dpTempIsComparison) {
//             const prev = getPreviousPeriod(toYMD(from), toYMD(to));
//             setDpTempCompareFrom(parseYMD(prev.from));
//             setDpTempCompareTo(parseYMD(prev.to));
//             setDpCompareViewMonth(new Date(parseYMD(prev.from).getFullYear(), parseYMD(prev.from).getMonth(), 1));
//         }
//     };

//     const confirmDatePicker = () => {
//         if (!dpTempFrom || !dpTempTo) { showAlert('Please select both start and end dates.'); return; }
//         if (dpTempIsComparison && (!dpTempCompareFrom || !dpTempCompareTo)) {
//             showAlert('Please select comparison date range.');
//             return;
//         }

//         setDpFromDate(new Date(dpTempFrom));
//         setDpToDate(new Date(dpTempTo));
//         const f = toYMD(dpTempFrom), t = toYMD(dpTempTo);
//         setConfirmedFrom(f);
//         setConfirmedTo(t);

//         let cf = '', ct = '';
//         if (dpTempIsComparison) {
//             setDpCompareFromDate(new Date(dpTempCompareFrom));
//             setDpCompareToDate(new Date(dpTempCompareTo));
//             cf = toYMD(dpTempCompareFrom);
//             ct = toYMD(dpTempCompareTo);
//             setConfirmedCompareFrom(cf);
//             setConfirmedCompareTo(ct);
//             setIsComparison(true);
//         } else {
//             setConfirmedCompareFrom('');
//             setConfirmedCompareTo('');
//             setIsComparison(false);
//         }

//         setDpOpen(false);
//         setTimeout(() => fetchAnalyticsRef.current(null, f, t), 0);
//     };

//     /* =====================================================================
//        CALENDAR RENDER
//        ===================================================================== */
//     const renderCalendar = (monthDate, fromD, toD, onDayClick) => {
//         const year = monthDate.getFullYear();
//         const month = monthDate.getMonth();
//         const firstDay = new Date(year, month, 1).getDay();
//         const daysInMonth = new Date(year, month + 1, 0).getDate();
//         const daysInPrev = new Date(year, month, 0).getDate();
//         const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

//         const today = new Date();
//         today.setHours(0,0,0,0);

//         const cells = [];
//         for (let i = firstDay - 1; i >= 0; i--) {
//             const d = daysInPrev - i;
//             const prevMonthDate = new Date(year, month - 1, d);
//             cells.push(
//                 <button key={'p'+d} className="cal-day other-month" onClick={() => onDayClick(prevMonthDate)}>{d}</button>
//             );
//         }
//         for (let d = 1; d <= daysInMonth; d++) {
//             const current = new Date(year, month, d);
//             const cls = ['cal-day'];
//             if (current.getTime() === today.getTime()) cls.push('today');
//             if (fromD && toD) {
//                 const t = current.getTime(), sf = fromD.getTime(), se = toD.getTime();
//                 if (t === sf && t === se) cls.push('selected-start','selected-end');
//                 else if (t === sf) cls.push('selected-start');
//                 else if (t === se) cls.push('selected-end');
//                 else if (t > sf && t < se) cls.push('in-range');
//             } else if (fromD && current.getTime() === fromD.getTime()) {
//                 cls.push('selected-start','selected-end');
//             }
//             cells.push(
//                 <button key={'c'+d} className={cls.join(' ')} onClick={() => onDayClick(current)}>{d}</button>
//             );
//         }
//         const totalCells = firstDay + daysInMonth;
//         const remaining = (7 - (totalCells % 7)) % 7;
//         for (let d = 1; d <= remaining; d++) {
//             const nextMonthDate = new Date(year, month + 1, d);
//             cells.push(
//                 <button key={'n'+d} className="cal-day other-month" onClick={() => onDayClick(nextMonthDate)}>{d}</button>
//             );
//         }

//         return (
//             <div className="dp-calendar">
//                 <div className="cal-month-title">{months[month]} {year}</div>
//                 <div className="cal-weekdays">
//                     <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
//                 </div>
//                 <div className="cal-days">{cells}</div>
//             </div>
//         );
//     };

//     /* =====================================================================
//        DOWNLOAD CSV
//        ===================================================================== */
//     const downloadExcel = () => {
//         if (allData.length === 0) { showAlert('No data to export'); return; }
//         const headers = [
//             'campaign_name','adset_name','ad_name','delivery_status','conversion_event',
//             'date_start','date_stop','spend','impressions','clicks','reach','cpm',
//             'registrations','cost_per_registration','exam_count','cost_per_exam','exam_percent',
//             'internship_count','second_internship','cost_per_internship',
//             'revenue','roi','rpu','cac_all','cac_paid','roas',
//         ];
//         let csv = headers.join(',') + '\n';
//         allData.forEach(row => {
//             csv += headers.map(h => `"${(row[h] != null ? row[h] : '').toString().replace(/"/g,'""')}"`).join(',') + '\n';
//         });
//         const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
//         const link = document.createElement('a');
//         link.href = URL.createObjectURL(blob);
//         link.download = `meta_ads_roi_analytics_${confirmedFrom}_to_${confirmedTo}.csv`;
//         link.click();
//     };

//     /* =====================================================================
//        DATE PICKER LABELS
//        ===================================================================== */
//     const dateLabel = (() => {
//         if (!confirmedFrom || !confirmedTo) return 'Select dates...';
//         if (isComparison && confirmedCompareFrom && confirmedCompareTo)
//             return `${confirmedFrom} to ${confirmedTo} vs ${confirmedCompareFrom} to ${confirmedCompareTo}`;
//         return `${confirmedFrom} to ${confirmedTo}`;
//     })();

//     const dpSelectedDisplay = (() => {
//         if (dpTempFrom && dpTempTo) {
//             let t = `${formatDisplay(dpTempFrom)} - ${formatDisplay(dpTempTo)}`;
//             if (dpTempIsComparison && dpTempCompareFrom && dpTempCompareTo)
//                 t += ` vs ${formatDisplay(dpTempCompareFrom)} - ${formatDisplay(dpTempCompareTo)}`;
//             return t;
//         }
//         if (dpTempFrom) return `${formatDisplay(dpTempFrom)} - ...`;
//         return 'Dates are shown in Asia/Calcutta';
//     })();

//     /* =====================================================================
//        RENDER HELPERS
//        ===================================================================== */
//     const renderStatusCell = (row) => {
//         if (row.delivery_status === 'LOADING') {
//             return <span className="loading-dots"><span></span><span></span><span></span></span>;
//         }
//         const raw = (row.delivery_status || 'Unknown');
//         const statusClass = 'status-' + raw.toLowerCase().replace(/[^a-z]/g, '-');
//         const label = raw.replace(/_/g, ' ');
//         return (
//             <span className={`status-badge ${statusClass}`}>
//                 <span className="status-dot"></span>{label}
//             </span>
//         );
//     };

//     const renderEventCell = (row) => {
//         if (row.conversion_event === 'LOADING')
//             return <span className="loading-dots"><span></span><span></span><span></span></span>;
//         return row.conversion_event || '-';
//     };

//     const cellFor = (col, row) => {
//         const noMeta = row.has_meta_data === false;
//         const v = row[col.key] || 0;
//         if (col.type === 'percent')
//             return row.registrations > 0 ? ((row.exam_count / row.registrations) * 100).toFixed(1) + '%' : '-';
//         if (col.type === 'ratio')  return Number(v).toFixed(2);
//         if (col.type === 'currency') return noMeta && col.key !== 'revenue' ? '-' : formatCurrency(v);
//         return formatNumber(v);
//     };

//     const renderCompareCells = (col, row) => {
//         const cur  = row[col.key] || 0;
//         const cmp  = row['compare_' + col.key] || 0;
//         const chg  = cur - cmp;
//         const pct  = cmp !== 0 ? (chg / cmp) * 100 : 0;
//         return (
//             <>
//                 <td className="currency compare-col">{formatMetricValue(col.key, cmp)}</td>
//                 <td className="number compare-col">
//                     <span className={chg >= 0 ? 'change-positive' : 'change-negative'}>
//                         {(chg >= 0 ? '+' : '')}{formatMetricValue(col.key, chg)}
//                     </span>
//                 </td>
//                 <td className="number compare-col">
//                     <span className={pct >= 0 ? 'change-positive' : 'change-negative'}>
//                         {(pct >= 0 ? '+' : '')}{pct.toFixed(1)}%
//                     </span>
//                 </td>
//             </>
//         );
//     };

//     /* Header cell builder */
//     const renderSortIcon = (field) => {
//         if (sortField !== field) return <i className="fas fa-sort sort-icon"></i>;
//         return <i className={`fas ${sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} sort-icon active`}></i>;
//     };

//     const renderFilterIcon = (col) => (
//         <i
//             className={`fas fa-filter filter-icon ${columnFilters[col] ? 'active' : ''}`}
//             onClick={(e) => openColumnFilter(col, e)}
//             title="Filter"
//         ></i>
//     );

//     const renderExpandIcon = (col) => {
//         if (!isComparison) return null;
//         return (
//             <i
//                 className={`fas fa-chevron-right expand-icon ${expandedColumns.has(col) ? 'expanded' : ''}`}
//                 onClick={(e) => toggleExpand(col, e)}
//                 title="Expand comparison"
//             ></i>
//         );
//     };

//     const monthsList = ['January','February','March','April','May','June','July','August','September','October','November','December'];

//     /* =====================================================================
//        RENDER
//        ===================================================================== */
//     return (
//         <div className={`mad-wrap${isComparison ? ' is-comparison' : ''}`}>
//             <style>{DASHBOARD_CSS}</style>
//             <div className="container">

//                 {/* ========== HEADER (hidden on Version Analysis tab) ========== */}
//                 {currentLevel !== 'version' && (
//                 <div className="dashboard-header">
//                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
//                         <div>
//                             <h1 className="header-title">Meta Ads ROI Analytics</h1>
//                             <p className="header-subtitle">Track campaign performance and revenue metrics</p>
//                         </div>
//                         <div style={{ display: 'flex', gap: 32 }}>
//                             <HeaderStat label="Campaigns"      value={formatNumber(headerStats.campaigns)} />
//                             <HeaderStat label="Registrations"  value={formatNumber(headerStats.registrations)} />
//                             <HeaderStat label="Total Spend"    value={formatCurrency(headerStats.spend)} />
//                             <HeaderStat label="Revenue"        value={formatCurrency(headerStats.revenue)} />
//                             <HeaderStat label="Avg ROI"        value={headerStats.roi.toFixed(2)} />
//                         </div>
//                     </div>
//                 </div>
//                 )}

//                 {/* ========== FILTERS (hidden on Version Analysis tab) ========== */}
//                 {currentLevel !== 'version' && (
//                 <div className="filters-section">
//                     <div className="search-date-row">
//                         <div className="search-wrapper">
//                             <label className="filter-label" style={{ display: 'block', marginBottom: 6 }}>Search Campaigns</label>
//                             <i className="fas fa-search search-icon"></i>
//                             <input
//                                 type="text"
//                                 value={searchTerm}
//                                 placeholder="Search by campaign, adset, or ad name..."
//                                 autoComplete="off"
//                                 onChange={handleSearchInput}
//                                 onFocus={() => { if (searchTerm.trim()) setShowSuggestions(true); }}
//                                 onBlur={() => {
//                                     clearTimeout(searchBlurTimerRef.current);
//                                     searchBlurTimerRef.current = setTimeout(() => setShowSuggestions(false), 150);
//                                 }}
//                             />
//                             <div className={`search-suggestions ${showSuggestions ? 'visible' : ''}`}>
//                                 <div className="suggestion-item" onMouseDown={(e) => { e.preventDefault(); applySearchSuggestion('campaign'); }}>
//                                     Search "<span className="highlight">{searchTerm}</span>" in Campaigns
//                                 </div>
//                                 <div className="suggestion-item" onMouseDown={(e) => { e.preventDefault(); applySearchSuggestion('adset'); }}>
//                                     Search "<span className="highlight">{searchTerm}</span>" in Ad Sets
//                                 </div>
//                                 <div className="suggestion-item" onMouseDown={(e) => { e.preventDefault(); applySearchSuggestion('ad'); }}>
//                                     Search "<span className="highlight">{searchTerm}</span>" in Ads
//                                 </div>
//                             </div>
//                         </div>

//                         <div className="filter-group" style={{ minWidth: 160 }}>
//                             <label className="filter-label">CIT Version</label>
//                             <select
//                                 className="filter-select"
//                                 value={selectedCit}
//                                 onChange={(e) => { setSelectedCit(e.target.value); loadDateRange(e.target.value, true); }}
//                             >
//                                 {citVersions.length === 0
//                                     ? <option value="">Loading...</option>
//                                     : citVersions.map(v => <option key={v} value={v}>{v}</option>)}
//                             </select>
//                         </div>

//                         <div className="filter-group">
//                             <label className="filter-label">Date Range</label>
//                             <button className="date-range-btn" onClick={openDatePicker}>
//                                 <span><div className="dr-dates">{dateLabel}</div></span>
//                                 <i className="fas fa-calendar dr-icon"></i>
//                             </button>
//                         </div>

//                         <div className="filter-group" style={{ minWidth: 120 }}>
//                             <label className="filter-label">Per Page</label>
//                             <select className="filter-select" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
//                                 <option value={50}>50</option>
//                                 <option value={100}>100</option>
//                                 <option value={250}>250</option>
//                                 <option value={500}>500</option>
//                             </select>
//                         </div>

//                         <div className="filter-group">
//                             <label className="filter-label">&nbsp;</label>
//                             <button className="btn-primary" onClick={() => fetchAnalytics()} disabled={loading}>
//                                 {loading ? <><div className="spinner"></div><span>Loading...</span></> : <><i className="fas fa-sync-alt"></i><span>Load Data</span></>}
//                             </button>
//                         </div>

//                         <div className="filter-group">
//                             <label className="filter-label">&nbsp;</label>
//                             <button className="btn-primary" onClick={downloadExcel}>
//                                 <i className="fas fa-file-excel"></i><span>Download Excel</span>
//                             </button>
//                         </div>
//                     </div>
//                 </div>
//                 )}

//                 {/* ========== DATE PICKER OVERLAY ========== */}
//                 <div
//                     className={`datepicker-overlay ${dpOpen ? 'visible' : ''}`}
//                     onClick={(e) => { if (e.target === e.currentTarget) closeDatePicker(); }}
//                 >
//                     <div className="datepicker-popup">
//                         <div className="dp-presets">
//                             <div className="dp-presets-title">Recently used</div>
//                             {[
//                                 ['today','Today'],['yesterday','Yesterday'],['last7','Last 7 days'],
//                                 ['last14','Last 14 days'],['last28','Last 28 days'],['last30','Last 30 days'],
//                                 ['thisweek','This week'],['lastweek','Last week'],
//                                 ['thismonth','This month'],['lastmonth','Last month'],
//                             ].map(([key, lbl]) => (
//                                 <button
//                                     key={key}
//                                     className={`dp-preset-item ${dpActivePreset === key ? 'active' : ''}`}
//                                     onClick={() => applyPreset(key)}
//                                 >
//                                     <span className="dp-preset-radio"></span> {lbl}
//                                 </button>
//                             ))}
//                         </div>

//                         <div className="dp-calendars">
//                             <div className="dp-compare-section">
//                                 <label className="dp-compare-label">
//                                     <input
//                                         type="checkbox"
//                                         checked={dpTempIsComparison}
//                                         onChange={(e) => {
//                                             const c = e.target.checked;
//                                             setDpTempIsComparison(c);
//                                             if (c) {
//                                                 if (dpTempFrom && dpTempTo) {
//                                                     const prev = getPreviousPeriod(toYMD(dpTempFrom), toYMD(dpTempTo));
//                                                     setDpTempCompareFrom(parseYMD(prev.from));
//                                                     setDpTempCompareTo(parseYMD(prev.to));
//                                                     setDpCompareViewMonth(new Date(parseYMD(prev.from).getFullYear(), parseYMD(prev.from).getMonth(), 1));
//                                                 } else {
//                                                     const today = new Date(); today.setHours(0,0,0,0);
//                                                     const y = new Date(today); y.setDate(y.getDate() - 1);
//                                                     setDpTempCompareFrom(new Date(y));
//                                                     setDpTempCompareTo(new Date(y));
//                                                     setDpCompareViewMonth(new Date(y.getFullYear(), y.getMonth(), 1));
//                                                 }
//                                             } else {
//                                                 setDpTempCompareFrom(null);
//                                                 setDpTempCompareTo(null);
//                                             }
//                                         }}
//                                     />
//                                     <span>Compare</span>
//                                 </label>
//                             </div>

//                             <div className="dp-cal-header">
//                                 <div className="dp-cal-nav">
//                                     <button onClick={() => setDpViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
//                                         <i className="fas fa-chevron-left"></i>
//                                     </button>
//                                     <span className="month-year">
//                                         {`${monthsList[dpViewMonth.getMonth()]} ${dpViewMonth.getFullYear()} - ${monthsList[(dpViewMonth.getMonth() + 1) % 12]} ${dpViewMonth.getMonth() === 11 ? dpViewMonth.getFullYear() + 1 : dpViewMonth.getFullYear()}`}
//                                     </span>
//                                     <button onClick={() => setDpViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
//                                         <i className="fas fa-chevron-right"></i>
//                                     </button>
//                                 </div>
//                             </div>

//                             <div className="dp-two-calendars">
//                                 {renderCalendar(dpViewMonth, dpTempFrom, dpTempTo, handleDayClick)}
//                                 {renderCalendar(new Date(dpViewMonth.getFullYear(), dpViewMonth.getMonth() + 1, 1), dpTempFrom, dpTempTo, handleDayClick)}
//                             </div>

//                             {dpTempIsComparison && (
//                                 <div className="dp-compare-range">
//                                     <div className="dp-compare-header">Comparison Period</div>
//                                     <div className="dp-cal-header">
//                                         <div className="dp-cal-nav">
//                                             <button onClick={() => setDpCompareViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
//                                                 <i className="fas fa-chevron-left"></i>
//                                             </button>
//                                             <span className="month-year">
//                                                 {`${monthsList[dpCompareViewMonth.getMonth()]} ${dpCompareViewMonth.getFullYear()} - ${monthsList[(dpCompareViewMonth.getMonth() + 1) % 12]} ${dpCompareViewMonth.getMonth() === 11 ? dpCompareViewMonth.getFullYear() + 1 : dpCompareViewMonth.getFullYear()}`}
//                                             </span>
//                                             <button onClick={() => setDpCompareViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
//                                                 <i className="fas fa-chevron-right"></i>
//                                             </button>
//                                         </div>
//                                     </div>
//                                     <div className="dp-two-calendars">
//                                         {renderCalendar(dpCompareViewMonth, dpTempCompareFrom, dpTempCompareTo, handleCompareDayClick)}
//                                         {renderCalendar(new Date(dpCompareViewMonth.getFullYear(), dpCompareViewMonth.getMonth() + 1, 1), dpTempCompareFrom, dpTempCompareTo, handleCompareDayClick)}
//                                     </div>
//                                 </div>
//                             )}

//                             <div className="dp-footer">
//                                 <span className="dp-date-display">{dpSelectedDisplay}</span>
//                                 <button className="btn-cancel" onClick={closeDatePicker}>Cancel</button>
//                                 <button className="btn-update" onClick={confirmDatePicker}>Update</button>
//                             </div>
//                         </div>
//                     </div>
//                 </div>

//                 {/* ========== ALERT ========== */}
//                 {alert && (
//                     <div className={`alert alert-${alert.type}`}>
//                         <i className={`fas ${alert.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
//                         <span>{alert.message}</span>
//                     </div>
//                 )}

//                 {/* ========== TOKEN UPDATE BOX ========== */}
//                 <div className={`token-box ${showTokenBox ? 'show' : ''}`}>
//                     <input
//                         type="text"
//                         value={newToken}
//                         onChange={(e) => setNewToken(e.target.value)}
//                         placeholder="Enter new Meta Access Token"
//                         style={{ padding: 8, width: 350, border: '1px solid #ccc', borderRadius: 4 }}
//                     />
//                     <button onClick={updateMetaToken} className="btn-primary">Update Token</button>
//                 </div>

//                 {/* ========== LEVEL TABS ========== */}
//                 <div className="level-tabs">
//                     <button
//                         className={`level-tab ${currentLevel === 'campaign' ? 'active' : ''}`}
//                         onClick={() => switchLevel('campaign')}
//                     >
//                         <i className="fas fa-bullhorn"></i>
//                         <span>Campaigns</span>
//                         {selectedCampaignNamesRef.current.size > 0 && (
//                             <span className="tab-badge">{selectedCampaignNamesRef.current.size} selected</span>
//                         )}
//                     </button>
//                     <button
//                         className={`level-tab ${currentLevel === 'adset' ? 'active' : ''}`}
//                         onClick={() => switchLevel('adset')}
//                     >
//                         <i className="fas fa-layer-group"></i>
//                         <span>Ad sets for {selectedCampaignNamesRef.current.size} Campaign</span>
//                         {selectedCampaignNamesRef.current.size > 0 && adsetData.length > 0 && (
//                             <span className="tab-badge">{adsetData.length}</span>
//                         )}
//                     </button>
//                     <button
//                         className={`level-tab ${currentLevel === 'ad' ? 'active' : ''}`}
//                         onClick={() => switchLevel('ad')}
//                     >
//                         <i className="fas fa-ad"></i>
//                         <span>Ads for {selectedAdsetNamesRef.current.size} Campaign</span>
//                         {selectedAdsetNamesRef.current.size > 0 && adData.length > 0 && (
//                             <span className="tab-badge">{adData.length}</span>
//                         )}
//                     </button>
//                     <button
//                         className={`level-tab ${currentLevel === 'version' ? 'active' : ''}`}
//                         onClick={() => switchLevel('version')}
//                     >
//                         <i className="fas fa-chart-line"></i>
//                         <span>Version Analysis</span>
//                         {selectedVersionsVA.length > 0 && (
//                             <span className="tab-badge">{selectedVersionsVA.length}</span>
//                         )}
//                     </button>
//                 </div>

//                 {/* ========== TABLE or VERSION ANALYSIS ========== */}
//                 {currentLevel === 'version' ? (
//                     <VersionAnalysisView
//                         citVersions={citVersions}
//                         selectedVersionsVA={selectedVersionsVA}
//                         toggleVersionPillVA={toggleVersionPillVA}
//                         selectedMetricsVA={selectedMetricsVA}
//                         toggleMetricVA={toggleMetricVA}
//                         vaSearchTerm={vaSearchTerm}
//                         setVaSearchTerm={setVaSearchTerm}
//                         fetchVersionAnalysis={fetchVersionAnalysis}
//                         vaLoading={vaLoading}
//                         vaCampaigns={vaCampaigns}
//                         expandedCampaignsVA={expandedCampaignsVA}
//                         expandedAdsetsVA={expandedAdsetsVA}
//                         toggleCampaignExpandVA={toggleCampaignExpandVA}
//                         toggleAdsetExpandVA={toggleAdsetExpandVA}
//                         adsetsCacheVA={adsetsCacheVA}
//                         adsCacheVA={adsCacheVA}
//                         loadingAdsetsVA={loadingAdsetsVA}
//                         loadingAdsVA={loadingAdsVA}
//                         exportCampaignCSV={exportCampaignCSV}
//                         pillsExpandedVA={pillsExpandedVA}
//                         setPillsExpandedVA={setPillsExpandedVA}
//                         statusFilterVA={statusFilterVA}
//                         setStatusFilterVA={setStatusFilterVA}
//                         perCardMetricsVA={perCardMetricsVA}
//                         togglePerCardMetric={togglePerCardMetric}
//                         resetPerCardMetrics={resetPerCardMetrics}
//                         loadedAdsetsVA={loadedAdsetsVA}
//                         loadedAdsVA={loadedAdsVA}
//                         clickLoadAdsets={clickLoadAdsets}
//                         clickLoadAds={clickLoadAds}
//                         finalReportOpen={finalReportOpen}
//                         setFinalReportOpen={setFinalReportOpen}
//                         finalReportSort={finalReportSort}
//                         setFinalReportSort={setFinalReportSort}
//                         notesCtx={{
//                             allNotes,
//                             saveNote,
//                             fetchNoteHistory,
//                             noteUser,
//                         }}
//                         notesFilter={notesFilter}
//                         setNotesFilter={setNotesFilter}
//                         noteHistory={noteHistory}
//                         setNoteHistory={setNoteHistory}
//                     />
//                 ) : (
//                 <div className="table-section">
//                     <div className="table-wrapper" ref={tableWrapperRef}>
//                         <table className="data-table" ref={dataTableRef}>
//                             <thead>
//                                 <tr>
//                                     <th className="checkbox-cell" style={{ display: currentLevel === 'ad' ? 'none' : '' }}>
//                                         <input
//                                             type="checkbox"
//                                             className="custom-checkbox"
//                                             checked={selectAllState.checked}
//                                             ref={el => { if (el) el.indeterminate = selectAllState.indeterminate; }}
//                                             onChange={(e) => handleSelectAll(e.target.checked)}
//                                         />
//                                     </th>

//                                     {currentLevel === 'campaign' && (
//                                         <th className="campaign-column" onClick={() => handleSort('campaign_name')}>
//                                             <div className="th-content">
//                                                 <span>Campaign</span>{renderSortIcon('campaign_name')}{renderFilterIcon('campaign')}
//                                             </div>
//                                         </th>
//                                     )}
//                                     {currentLevel === 'adset' && (
//                                         <th className="adset-column" onClick={() => handleSort('adset_name')}>
//                                             <div className="th-content">
//                                                 <span>Ad Set</span>{renderSortIcon('adset_name')}{renderFilterIcon('adset')}
//                                             </div>
//                                         </th>
//                                     )}
//                                     {currentLevel === 'ad' && (
//                                         <th className="ad-column" onClick={() => handleSort('ad_name')}>
//                                             <div className="th-content">
//                                                 <span>Ad</span>{renderSortIcon('ad_name')}{renderFilterIcon('ad')}
//                                             </div>
//                                         </th>
//                                     )}

//                                     <th onClick={() => handleSort('delivery_status')}>
//                                         <div className="th-content"><span>Delivery</span>{renderSortIcon('delivery_status')}{renderFilterIcon('delivery')}</div>
//                                     </th>
//                                     <th onClick={() => handleSort('conversion_event')}>
//                                         <div className="th-content"><span>Event</span>{renderSortIcon('conversion_event')}{renderFilterIcon('event')}</div>
//                                     </th>
//                                     <th onClick={() => handleSort('impressions')}>
//                                         <div className="th-content"><span>Impressions</span>{renderSortIcon('impressions')}{renderFilterIcon('impressions')}</div>
//                                     </th>
//                                     <th onClick={() => handleSort('reach')}>
//                                         <div className="th-content"><span>Reach</span>{renderSortIcon('reach')}{renderFilterIcon('reach')}</div>
//                                     </th>
//                                     <th onClick={() => handleSort('cpm')}>
//                                         <div className="th-content"><span>CPM</span>{renderSortIcon('cpm')}{renderFilterIcon('cpm')}</div>
//                                     </th>

//                                     {METRIC_COLS.map(col => (
//                                         <React.Fragment key={col.key}>
//                                             <th onClick={() => handleSort(col.key)}>
//                                                 <div className="th-content">
//                                                     <span>{col.label}</span>{renderSortIcon(col.key)}{renderFilterIcon(col.key)}
//                                                     {col.expandable && renderExpandIcon(col.key)}
//                                                 </div>
//                                             </th>
//                                             {col.expandable && expandedColumns.has(col.key) && (
//                                                 <>
//                                                     <th className="compare-header">
//                                                         <div className="th-content" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
//                                                             <span style={{ fontSize: '11.5px' }}>{col.label}</span>
//                                                             <small style={{ fontWeight: 400, fontSize: 10, color: 'var(--text-secondary)' }}>
//                                                                 {confirmedCompareFrom} to {confirmedCompareTo}
//                                                             </small>
//                                                         </div>
//                                                     </th>
//                                                     <th className="compare-header"><div className="th-content"><span>Change</span></div></th>
//                                                     <th className="compare-header"><div className="th-content"><span>Change %</span></div></th>
//                                                 </>
//                                             )}
//                                         </React.Fragment>
//                                     ))}
//                                 </tr>
//                             </thead>

//                             <tbody>
//                                 {allData.length === 0 ? (
//                                     <tr>
//                                         <td colSpan={24} className="empty-state">
//                                             <div className="empty-icon"><i className="fas fa-chart-bar"></i></div>
//                                             <div className="empty-title">No Data Available</div>
//                                             <div className="empty-text">Select a CIT version and click "Load Data" to view analytics</div>
//                                         </td>
//                                     </tr>
//                                 ) : allData.map((row, idx) => {
//                                     const selected = isRowSelected(row);
//                                     const noMeta = row.has_meta_data === false;
//                                     const examPct = row.registrations > 0 ? ((row.exam_count / row.registrations) * 100).toFixed(1) + '%' : '-';
//                                     return (
//                                         <tr key={idx} className={selected ? 'selected' : ''}>
//                                             <td className="checkbox-cell" style={{ display: currentLevel === 'ad' ? 'none' : '' }}>
//                                                 {currentLevel !== 'ad' && (
//                                                     <input
//                                                         type="checkbox"
//                                                         className="custom-checkbox"
//                                                         checked={selected}
//                                                         onChange={(e) => handleRowCheckbox(row, e.target.checked)}
//                                                     />
//                                                 )}
//                                             </td>

//                                             {currentLevel === 'campaign' && (
//                                                 <td className="campaign-column text-cell" title={row.campaign_name}>{row.campaign_name || '-'}</td>
//                                             )}
//                                             {currentLevel === 'adset' && (
//                                                 <td className="adset-column text-cell" title={row.adset_name}>{row.adset_name || '-'}</td>
//                                             )}
//                                             {currentLevel === 'ad' && (
//                                                 <td className="ad-column text-cell" title={row.ad_name}>{row.ad_name || '-'}</td>
//                                             )}

//                                             <td>{renderStatusCell(row)}</td>
//                                             <td className="text-cell">{renderEventCell(row)}</td>
//                                             <td className="number">{formatNumber(row.impressions || 0)}</td>
//                                             <td className="number">{formatNumber(row.reach || 0)}</td>
//                                             <td className="currency">{noMeta ? '-' : formatCurrency(row.cpm || 0)}</td>

//                                             {METRIC_COLS.map(col => {
//                                                 let content;
//                                                 if (col.type === 'percent') content = examPct;
//                                                 else if (col.type === 'ratio') content = Number(row[col.key] || 0).toFixed(2);
//                                                 else if (col.type === 'currency') content = noMeta && col.key !== 'revenue' ? '-' : formatCurrency(row[col.key] || 0);
//                                                 else content = formatNumber(row[col.key] || 0);
//                                                 return (
//                                                     <React.Fragment key={col.key}>
//                                                         <td className={col.type === 'currency' ? 'currency' : 'number'}>{content}</td>
//                                                         {col.expandable && expandedColumns.has(col.key) && renderCompareCells(col, row)}
//                                                     </React.Fragment>
//                                                 );
//                                             })}
//                                         </tr>
//                                     );
//                                 })}
//                             </tbody>
//                         </table>
//                     </div>

//                     {/* ========== STICKY FOOTER ========== */}
//                     {allData.length > 0 && (
//                         <div className="footer-wrapper" ref={footerWrapperRef} style={{ display: 'block' }}>
//                             <table className="footer-table" ref={footerTableRef}>
//                                 <tbody>
//                                     <tr>
//                                         <td className="checkbox-cell" style={{ display: currentLevel === 'ad' ? 'none' : '' }}></td>
//                                         {currentLevel === 'campaign' && <td className="footer-label campaign-column">Totals</td>}
//                                         {currentLevel === 'adset'    && <td className="footer-label adset-column">Totals</td>}
//                                         {currentLevel === 'ad'       && <td className="footer-label ad-column">Totals</td>}
//                                         <td></td>
//                                         <td></td>
//                                         <td className="number">{formatNumber(footerTotals.impressions)}</td>
//                                         <td className="number">{formatNumber(footerTotals.reach)}</td>
//                                         <td className="currency">{formatCurrency(footerTotals.cpm)}</td>

//                                         {METRIC_COLS.map(col => {
//                                             let content;
//                                             if (col.type === 'percent')       content = footerTotals.exam_percent > 0 ? footerTotals.exam_percent.toFixed(1) + '%' : '-';
//                                             else if (col.type === 'ratio')    content = Number(footerTotals[col.key] || 0).toFixed(2);
//                                             else if (col.type === 'currency') content = formatCurrency(footerTotals[col.key === 'spend' ? 'spend' : col.key === 'revenue' ? 'revenue' : col.key] || 0);
//                                             else content = formatNumber(footerTotals[col.key === 'registrations' ? 'reg' : col.key === 'exam_count' ? 'exam' : col.key === 'internship_count' ? 'intern' : col.key === 'second_internship' ? 'intern2' : col.key] || 0);
//                                             return (
//                                                 <React.Fragment key={col.key}>
//                                                     <td className={col.type === 'currency' ? 'currency' : 'number'}>{content}</td>
//                                                     {col.expandable && expandedColumns.has(col.key) && (
//                                                         <>
//                                                             <td className="compare-col"></td>
//                                                             <td className="compare-col"></td>
//                                                             <td className="compare-col"></td>
//                                                         </>
//                                                     )}
//                                                 </React.Fragment>
//                                             );
//                                         })}
//                                     </tr>
//                                 </tbody>
//                             </table>
//                         </div>
//                     )}
//                 </div>
//                 )}

//                 {/* ========== COLUMN FILTER DROPDOWN ========== */}
//                 {filterDropdown.open && (
//                     <div
//                         className="column-filter-dropdown visible"
//                         style={{ left: filterDropdown.x, top: filterDropdown.y }}
//                     >
//                         <div className="filter-search-box">
//                             <i className="fas fa-search"></i>
//                             <input
//                                 type="text"
//                                 placeholder="Search..."
//                                 value={filterSearchTerm}
//                                 onChange={(e) => setFilterSearchTerm(e.target.value)}
//                                 autoFocus
//                             />
//                         </div>
//                         <div className="filter-options">
//                             {(() => {
//                                 const opts = filterDropdown.options || [];
//                                 const visible = opts.filter(v => v.toLowerCase().includes(filterSearchTerm.toLowerCase()));
//                                 const allChecked = pendingFilterValues.length === opts.length && opts.length > 0;
//                                 return (
//                                     <>
//                                         <div className="filter-option-item">
//                                             <input
//                                                 type="checkbox"
//                                                 id="filter-select-all"
//                                                 checked={allChecked}
//                                                 onChange={(e) => toggleSelectAllFilter(e.target.checked, opts)}
//                                             />
//                                             <label htmlFor="filter-select-all">(Select All)</label>
//                                         </div>
//                                         {visible.map((v, i) => (
//                                             <div key={i} className="filter-option-item">
//                                                 <input
//                                                     type="checkbox"
//                                                     id={`fv-${i}`}
//                                                     checked={pendingFilterValues.includes(v)}
//                                                     onChange={() => togglePendingValue(v)}
//                                                 />
//                                                 <label htmlFor={`fv-${i}`}>{v}</label>
//                                             </div>
//                                         ))}
//                                     </>
//                                 );
//                             })()}
//                         </div>
//                         <div className="filter-actions">
//                             <button className="btn-filter-clear" onClick={clearColumnFilter}>Clear</button>
//                             <button className="btn-filter-ok" onClick={applyColumnFilter}>OK</button>
//                         </div>
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// }

// /* =========================================================================
//    6. SMALL SUB-COMPONENT
//    ========================================================================= */
// function HeaderStat({ label, value }) {
//     return (
//         <div style={{ textAlign: 'center' }}>
//             <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
//             <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
//         </div>
//     );
// }

// /* =========================================================================
//    VERSION ANALYSIS VIEW - full tab content
//    ========================================================================= */
// function VersionAnalysisView(props) {
//     const {
//         citVersions, selectedVersionsVA, toggleVersionPillVA,
//         selectedMetricsVA, toggleMetricVA,
//         vaSearchTerm, setVaSearchTerm,
//         fetchVersionAnalysis, vaLoading, vaCampaigns,
//         expandedCampaignsVA, expandedAdsetsVA,
//         toggleCampaignExpandVA, toggleAdsetExpandVA,
//         adsetsCacheVA, adsCacheVA,
//         loadingAdsetsVA, loadingAdsVA,
//         exportCampaignCSV,
//         pillsExpandedVA, setPillsExpandedVA,
//         statusFilterVA, setStatusFilterVA,
//         perCardMetricsVA, togglePerCardMetric, resetPerCardMetrics,
//         loadedAdsetsVA, loadedAdsVA,
//         clickLoadAdsets, clickLoadAds,
//         finalReportOpen, setFinalReportOpen,
//         finalReportSort, setFinalReportSort,
//         notesCtx, notesFilter, setNotesFilter,
//         noteHistory, setNoteHistory,
//     } = props;

//     const activeMetricsGlobal = VA_METRICS.filter(m => selectedMetricsVA.has(m.key));

//     // Pills: show only first 12 by default, rest behind "Show more"
//     const PILL_VISIBLE_DEFAULT = 12;
//     const visibleVersions = pillsExpandedVA ? citVersions : citVersions.slice(0, PILL_VISIBLE_DEFAULT);
//     const hasMorePills = citVersions.length > PILL_VISIBLE_DEFAULT;

//     // Filter campaigns: search + status + notes
//     const filteredCampaigns = (() => {
//         let result = vaCampaigns;
//         const t = vaSearchTerm.trim().toLowerCase();
//         if (t) result = result.filter(c => c.campaign_name.toLowerCase().includes(t));
//         if (statusFilterVA !== 'all') {
//             result = result.filter(c => {
//                 const s = (c.delivery_status || 'UNKNOWN').toUpperCase();
//                 if (statusFilterVA === 'active')   return s === 'ACTIVE';
//                 if (statusFilterVA === 'paused')   return s === 'PAUSED';
//                 if (statusFilterVA === 'in_review')return s === 'IN_REVIEW';
//                 if (statusFilterVA === 'inactive') return s.includes('INACTIVE') || s.includes('DISAPPROVED') || s.includes('REJECTED');
//                 if (statusFilterVA === 'unknown')  return s === 'UNKNOWN' || s === '';
//                 return true;
//             });
//         }
//         if (notesFilter) {
//             // keep a campaign if it OR any of its loaded adsets/ads has a note
//             const allNotes = notesCtx.allNotes;
//             result = result.filter(c => {
//                 if (allNotes['campaign|||' + c.campaign_name]) return true;
//                 const adsets = adsetsCacheVA[c.campaign_name] || [];
//                 for (const a of adsets) {
//                     if (allNotes['adset|||' + a.adset_name]) return true;
//                     const ads = adsCacheVA[c.campaign_name + '|||' + a.adset_name] || [];
//                     for (const ad of ads) {
//                         if (allNotes['ad|||' + ad.ad_name]) return true;
//                     }
//                 }
//                 return false;
//             });
//         }
//         return result;
//     })();

//     // Show Final Reports button when: 2+ versions selected AND data loaded
//     const canShowFinalReports = selectedVersionsVA.length >= 2 && vaCampaigns.length > 0;

//     return (
//         <div className="vwa-root">
//             {/* ========== STICKY CONTROLS ========== */}
//             <div className="vwa-sticky-controls">
//                 <div className="vwa-controls">
//                     {/* Row 1: Version pills (with show more) */}
//                     <div className="vwa-controls-row">
//                         <div style={{ flex: 1, minWidth: 280 }}>
//                             <label className="vwa-section-label">
//                                 Select CIT Versions (click to toggle)
//                                 {selectedVersionsVA.length > 0 && (
//                                     <span style={{ marginLeft: 8, color: 'var(--primary)', fontWeight: 700 }}>
//                                         — {selectedVersionsVA.length} selected
//                                     </span>
//                                 )}
//                             </label>
//                             <div className={`vwa-pills-wrap ${pillsExpandedVA ? 'vwa-pills-expanded' : ''}`}>
//                                 <div className="vwa-version-pills">
//                                     {citVersions.length === 0 && (
//                                         <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading versions...</span>
//                                     )}
//                                     {visibleVersions.map(v => (
//                                         <button
//                                             key={v}
//                                             className={`vwa-version-pill ${selectedVersionsVA.includes(v) ? 'active' : ''}`}
//                                             onClick={() => toggleVersionPillVA(v)}
//                                         >
//                                             {v}
//                                         </button>
//                                     ))}
//                                     {hasMorePills && (
//                                         <button
//                                             className="vwa-show-more-pill"
//                                             onClick={() => setPillsExpandedVA(e => !e)}
//                                         >
//                                             <i className={`fas fa-chevron-${pillsExpandedVA ? 'up' : 'down'}`}></i>
//                                             {pillsExpandedVA ? 'Show less' : `Show more (${citVersions.length - PILL_VISIBLE_DEFAULT})`}
//                                         </button>
//                                     )}
//                                 </div>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Row 2: Metric switches + status filter + search + load + final-report */}
//                     <div className="vwa-controls-row">
//                         <div style={{ flex: 1 }}>
//                             <label className="vwa-section-label">Metric Columns (global)</label>
//                             <div className="vwa-metric-toggles">
//                                 {VA_METRICS.map(m => {
//                                     const on = selectedMetricsVA.has(m.key);
//                                     return (
//                                         <label key={m.key} className={`vwa-switch-item ${on ? 'is-on' : ''}`}>
//                                             <span className="vwa-switch">
//                                                 <input type="checkbox" checked={on} onChange={() => toggleMetricVA(m.key)} />
//                                                 <span className="vwa-switch-slider"></span>
//                                             </span>
//                                             <span>{m.label}</span>
//                                         </label>
//                                     );
//                                 })}
//                             </div>
//                         </div>

//                         <div className="vwa-status-filter">
//                             <label className="vwa-section-label">Status Filter</label>
//                             <select
//                                 value={statusFilterVA}
//                                 onChange={(e) => setStatusFilterVA(e.target.value)}
//                             >
//                                 <option value="all">All Statuses</option>
//                                 <option value="active">Active</option>
//                                 <option value="paused">Paused</option>
//                                 <option value="in_review">In Review</option>
//                                 <option value="inactive">Inactive / Rejected</option>
//                                 <option value="unknown">Unknown</option>
//                             </select>
//                         </div>

//                         <div>
//                             <label className="vwa-section-label">Notes Filter</label>
//                             <label className={`vwa-notes-filter-toggle ${notesFilter ? 'is-on' : ''}`}>
//                                 <span className="vwa-switch">
//                                     <input
//                                         type="checkbox"
//                                         checked={notesFilter}
//                                         onChange={(e) => setNotesFilter(e.target.checked)}
//                                     />
//                                     <span className="vwa-switch-slider"></span>
//                                 </span>
//                                 <i className="fas fa-sticky-note"></i>
//                                 Only with notes
//                             </label>
//                         </div>

//                         <div style={{ minWidth: 200 }}>
//                             <label className="vwa-section-label">Search Campaigns</label>
//                             <input
//                                 type="text"
//                                 className="filter-input"
//                                 placeholder="Filter by campaign name..."
//                                 value={vaSearchTerm}
//                                 onChange={(e) => setVaSearchTerm(e.target.value)}
//                                 style={{ height: 36 }}
//                             />
//                         </div>

//                         <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
//                             <button
//                                 className="btn-primary"
//                                 onClick={fetchVersionAnalysis}
//                                 disabled={vaLoading || selectedVersionsVA.length === 0}
//                             >
//                                 {vaLoading
//                                     ? <><div className="spinner"></div><span>Loading...</span></>
//                                     : <><i className="fas fa-chart-line"></i><span>Load Comparison</span></>}
//                             </button>

//                             {canShowFinalReports && (
//                                 <button
//                                     className="vwa-final-btn"
//                                     onClick={() => setFinalReportOpen(true)}
//                                     title="Ranked comparison across all selected versions"
//                                 >
//                                     <i className="fas fa-trophy"></i>
//                                     See Final Reports
//                                 </button>
//                             )}
//                         </div>
//                     </div>
//                 </div>
//             </div>

//             {/* ========== CAMPAIGN CARDS (scrollable area) ========== */}
//             {vaLoading && <VASkeletonCards />}

//             {!vaLoading && vaCampaigns.length === 0 && (
//                 <div className="vwa-empty">
//                     <div className="vwa-empty-icon"><i className="fas fa-chart-bar"></i></div>
//                     <div className="vwa-empty-title">No comparison data yet</div>
//                     <div>Select 2 or more CIT versions above and click "Load Comparison".</div>
//                 </div>
//             )}

//             {!vaLoading && filteredCampaigns.length === 0 && vaCampaigns.length > 0 && (
//                 <div className="vwa-empty">
//                     <div className="vwa-empty-title">No campaigns match your filter</div>
//                 </div>
//             )}

//             {!vaLoading && filteredCampaigns.map(campaign => {
//                 const cardMetricSet = perCardMetricsVA[campaign.campaign_name];
//                 const activeMetrics = cardMetricSet
//                     ? VA_METRICS.filter(m => cardMetricSet.has(m.key))
//                     : activeMetricsGlobal;
//                 const hasCardOverride = !!cardMetricSet;

//                 return (
//                     <CampaignAccordion
//                         key={campaign.campaign_name}
//                         campaign={campaign}
//                         activeMetrics={activeMetrics}
//                         hasCardOverride={hasCardOverride}
//                         cardMetricSet={cardMetricSet || selectedMetricsVA}
//                         togglePerCardMetric={togglePerCardMetric}
//                         resetPerCardMetrics={resetPerCardMetrics}
//                         selectedVersionsVA={selectedVersionsVA}
//                         expanded={expandedCampaignsVA.has(campaign.campaign_name)}
//                         onToggle={() => toggleCampaignExpandVA(campaign.campaign_name)}
//                         adsets={adsetsCacheVA[campaign.campaign_name]}
//                         loadingAdsets={loadingAdsetsVA.has(campaign.campaign_name)}
//                         adsetsLoaded={loadedAdsetsVA.has(campaign.campaign_name)}
//                         onLoadAdsets={() => clickLoadAdsets(campaign.campaign_name)}
//                         expandedAdsetsVA={expandedAdsetsVA}
//                         toggleAdsetExpandVA={toggleAdsetExpandVA}
//                         adsCacheVA={adsCacheVA}
//                         loadingAdsVA={loadingAdsVA}
//                         loadedAdsVA={loadedAdsVA}
//                         clickLoadAds={clickLoadAds}
//                         exportCampaignCSV={exportCampaignCSV}
//                         notesCtx={notesCtx}
//                     />
//                 );
//             })}

//             {/* ========== FINAL REPORT MODAL ========== */}
//             {finalReportOpen && (
//                 <FinalReportModal
//                     selectedVersions={selectedVersionsVA}
//                     campaigns={vaCampaigns}
//                     onClose={() => setFinalReportOpen(false)}
//                     sort={finalReportSort}
//                     setSort={setFinalReportSort}
//                 />
//             )}

//             {/* ========== NOTE HISTORY MODAL ========== */}
//             {noteHistory && (
//                 <NoteHistoryModal
//                     entity={noteHistory}
//                     onClose={() => setNoteHistory(null)}
//                 />
//             )}
//         </div>
//     );
// }

// /* Campaign-level accordion with per-card metric override + explicit Load Ad Sets button */
// function CampaignAccordion({
//     campaign, activeMetrics, hasCardOverride, cardMetricSet,
//     togglePerCardMetric, resetPerCardMetrics,
//     selectedVersionsVA,
//     expanded, onToggle,
//     adsets, loadingAdsets, adsetsLoaded, onLoadAdsets,
//     expandedAdsetsVA, toggleAdsetExpandVA,
//     adsCacheVA, loadingAdsVA, loadedAdsVA, clickLoadAds,
//     exportCampaignCSV,
//     notesCtx,
// }) {
//     const [metricDropdownOpen, setMetricDropdownOpen] = useState(false);
//     const dropdownRef = useRef(null);

//     useEffect(() => {
//         if (!metricDropdownOpen) return;
//         const onClick = (e) => {
//             if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
//                 setMetricDropdownOpen(false);
//             }
//         };
//         setTimeout(() => document.addEventListener('mousedown', onClick), 0);
//         return () => document.removeEventListener('mousedown', onClick);
//     }, [metricDropdownOpen]);

//     const rawStatus = (campaign.delivery_status || 'Unknown');
//     const statusCls = 'vwa-status-' + rawStatus.toLowerCase().replace(/[^a-z]/g, '-');
//     const statusLabel = rawStatus.replace(/_/g, ' ');

//     return (
//         <div className="vwa-campaign-card">
//             <div className="vwa-campaign-header" onClick={onToggle}>
//                 <i className="fas fa-bullseye vwa-campaign-icon"></i>
//                 <span className="vwa-campaign-name" title={campaign.campaign_name}>
//                     {campaign.campaign_name}
//                 </span>
//                 <span className={`vwa-status-badge ${statusCls}`}>{statusLabel}</span>

//                 {/* Per-card metric dropdown */}
//                 <div style={{ position: 'relative' }} ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
//                     <button
//                         className="vwa-card-metric-btn"
//                         onClick={() => setMetricDropdownOpen(o => !o)}
//                         title="Show/hide columns for this campaign only"
//                     >
//                         <i className="fas fa-sliders-h"></i>
//                         Columns
//                         {hasCardOverride && <span style={{ color: '#42b72a' }}>•</span>}
//                     </button>
//                     {metricDropdownOpen && (
//                         <div className="vwa-card-metric-dropdown">
//                             <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 2 }}>
//                                 This campaign only
//                             </div>
//                             {VA_METRICS.map(m => {
//                                 const on = cardMetricSet.has(m.key);
//                                 return (
//                                     <label key={m.key} className={`vwa-switch-item ${on ? 'is-on' : ''}`}>
//                                         <span className="vwa-switch">
//                                             <input
//                                                 type="checkbox"
//                                                 checked={on}
//                                                 onChange={() => togglePerCardMetric(campaign.campaign_name, m.key)}
//                                             />
//                                             <span className="vwa-switch-slider"></span>
//                                         </span>
//                                         <span>{m.label}</span>
//                                     </label>
//                                 );
//                             })}
//                             {hasCardOverride && (
//                                 <button
//                                     className="vwa-show-more-pill"
//                                     style={{ marginTop: 4, width: '100%', fontSize: 11, padding: '4px 10px' }}
//                                     onClick={() => { resetPerCardMetrics(campaign.campaign_name); setMetricDropdownOpen(false); }}
//                                 >
//                                     Reset to global
//                                 </button>
//                             )}
//                         </div>
//                     )}
//                 </div>

//                 <button
//                     className="vwa-btn-export"
//                     onClick={(e) => { e.stopPropagation(); exportCampaignCSV(campaign); }}
//                     title="Export this campaign's version data as CSV"
//                 >
//                     <i className="fas fa-file-csv"></i> CSV
//                 </button>
//                 <i className={`fas fa-chevron-right vwa-chevron ${expanded ? 'expanded' : ''}`}></i>
//             </div>

//             <div className={`vwa-campaign-body vwa-collapsible ${expanded ? 'vwa-expanded' : 'vwa-collapsed'}`}>
//                 {/* Campaign-level version comparison table */}
//                 <VersionComparisonTable
//                     versions={campaign.versions}
//                     activeMetrics={activeMetrics}
//                     entityName={campaign.campaign_name}
//                     entityLabel="Campaign"
//                     entityType="campaign"
//                     notesCtx={notesCtx}
//                 />

//                 {/* Nested Ad Sets section */}
//                 <div className="vwa-adsets-wrap">
//                     {!adsetsLoaded ? (
//                         <button
//                             className="vwa-load-more"
//                             onClick={onLoadAdsets}
//                         >
//                             <i className="fas fa-chevron-down"></i>
//                             Load Ad Sets in this campaign
//                         </button>
//                     ) : (
//                         <>
//                             <div className="vwa-section-label" style={{ marginBottom: 10 }}>
//                                 Ad Sets in this campaign
//                                 {loadingAdsets && <span className="vwa-spinner" style={{ marginLeft: 8 }}></span>}
//                             </div>

//                             {loadingAdsets && <VASkeletonRow cols={activeMetrics.length + 1} />}

//                             {!loadingAdsets && adsets && adsets.length === 0 && (
//                                 <div className="vwa-empty" style={{ padding: 20, fontSize: 12 }}>
//                                     No ad sets found for this campaign across the selected versions.
//                                 </div>
//                             )}

//                             {!loadingAdsets && adsets && adsets.map(adset => (
//                                 <AdsetAccordion
//                                     key={adset.adset_name}
//                                     adset={adset}
//                                     campaignName={campaign.campaign_name}
//                                     activeMetrics={activeMetrics}
//                                     selectedVersionsVA={selectedVersionsVA}
//                                     expanded={expandedAdsetsVA.has(campaign.campaign_name + '|||' + adset.adset_name)}
//                                     onToggle={() => toggleAdsetExpandVA(campaign.campaign_name, adset.adset_name)}
//                                     ads={adsCacheVA[campaign.campaign_name + '|||' + adset.adset_name]}
//                                     loadingAds={loadingAdsVA.has(campaign.campaign_name + '|||' + adset.adset_name)}
//                                     adsLoaded={loadedAdsVA.has(campaign.campaign_name + '|||' + adset.adset_name)}
//                                     onLoadAds={() => clickLoadAds(campaign.campaign_name, adset.adset_name)}
//                                     notesCtx={notesCtx}
//                                 />
//                             ))}
//                         </>
//                     )}
//                 </div>
//             </div>
//         </div>
//     );
// }

// function AdsetAccordion({ adset, campaignName, activeMetrics, expanded, onToggle, ads, loadingAds, adsLoaded, onLoadAds, notesCtx }) {
//     return (
//         <div className="vwa-adset-card">
//             <div className="vwa-adset-header" onClick={onToggle}>
//                 <i className="fas fa-layer-group vwa-adset-icon"></i>
//                 <span className="vwa-adset-name" title={adset.adset_name}>Ad Set: {adset.adset_name}</span>
//                 <i className={`fas fa-chevron-right vwa-chevron ${expanded ? 'expanded' : ''}`}></i>
//             </div>

//             <div className={`vwa-adset-body vwa-collapsible ${expanded ? 'vwa-expanded' : 'vwa-collapsed'}`}>
//                 <VersionComparisonTable
//                     versions={adset.versions}
//                     activeMetrics={activeMetrics}
//                     entityName={adset.adset_name}
//                     entityLabel="Ad Set"
//                     entityType="adset"
//                     parentCampaign={campaignName}
//                     notesCtx={notesCtx}
//                 />

//                 <div className="vwa-ads-wrap">
//                     {!adsLoaded ? (
//                         <button
//                             className="vwa-load-more"
//                             onClick={onLoadAds}
//                         >
//                             <i className="fas fa-chevron-down"></i>
//                             Load Ads in this ad set
//                         </button>
//                     ) : (
//                         <>
//                             <div className="vwa-section-label" style={{ marginBottom: 8 }}>
//                                 Ads in this ad set
//                                 {loadingAds && <span className="vwa-spinner" style={{ marginLeft: 8 }}></span>}
//                             </div>

//                             {loadingAds && <VASkeletonRow cols={activeMetrics.length + 1} />}

//                             {!loadingAds && ads && ads.length === 0 && (
//                                 <div className="vwa-empty" style={{ padding: 16, fontSize: 12 }}>
//                                     No ads found for this ad set across the selected versions.
//                                 </div>
//                             )}

//                             {!loadingAds && ads && ads.map(ad => (
//                                 <AdBlock
//                                     key={ad.ad_name}
//                                     ad={ad}
//                                     activeMetrics={activeMetrics}
//                                     campaignName={campaignName}
//                                     adsetName={adset.adset_name}
//                                     notesCtx={notesCtx}
//                                 />
//                             ))}
//                         </>
//                     )}
//                 </div>
//             </div>
//         </div>
//     );
// }

// function AdBlock({ ad, activeMetrics, campaignName, adsetName, notesCtx }) {
//     const [open, setOpen] = useState(false);
//     return (
//         <div className="vwa-ad-card">
//             <div className="vwa-ad-header" onClick={() => setOpen(o => !o)}>
//                 <i className="fas fa-ad"></i>
//                 <span className="vwa-ad-name" title={ad.ad_name}>{ad.ad_name}</span>
//                 <i className={`fas fa-chevron-right vwa-chevron ${open ? 'expanded' : ''}`}></i>
//             </div>
//             <div className={`vwa-ad-body vwa-collapsible ${open ? 'vwa-expanded' : 'vwa-collapsed'}`}>
//                 <VersionComparisonTable
//                     versions={ad.versions}
//                     activeMetrics={activeMetrics}
//                     entityName={ad.ad_name}
//                     entityLabel="Ad"
//                     entityType="ad"
//                     parentCampaign={campaignName}
//                     parentAdset={adsetName}
//                     notesCtx={notesCtx}
//                 />
//             </div>
//         </div>
//     );
// }

// /* The actual version comparison table (used at all 3 levels)
//    Shows entity (campaign/adset/ad) in a rowspan'd left column that stretches
//    the full table height. Versions are sorted ascending by CIT number so the
//    oldest version is the baseline and newer versions compare against it.
//    Also renders a Remark column (rowspan'd) on the far right when notesCtx is provided. */
// function VersionComparisonTable({
//     versions, activeMetrics, entityName, entityLabel,
//     entityType, parentCampaign, parentAdset, notesCtx,
// }) {
//     if (!versions || versions.length === 0) {
//         return <div className="vwa-empty" style={{ padding: 20, fontSize: 12 }}>No data</div>;
//     }
//     if (activeMetrics.length === 0) {
//         return <div className="vwa-empty" style={{ padding: 20, fontSize: 12 }}>No metric columns selected. Enable at least one metric in the toggles above.</div>;
//     }

//     // Sort ASCENDING by CIT numeric part (e.g., "CIT 157" < "CIT 158")
//     const sortedVersions = [...versions].sort((a, b) => {
//         const na = parseInt((a.version || '').replace(/\D/g, ''), 10) || 0;
//         const nb = parseInt((b.version || '').replace(/\D/g, ''), 10) || 0;
//         return na - nb;
//     });

//     const showEntityCol = !!(entityName && entityLabel);
//     const showNotesCol  = !!(notesCtx && entityType && entityName);

//     // Notes for this specific entity
//     const noteKey = entityType + '|||' + entityName;
//     const notesForEntity = (notesCtx && notesCtx.allNotes && notesCtx.allNotes[noteKey]) || [];

//     return (
//         <div className="vwa-table-wrap">
//             <table className="vwa-table">
//                 <thead>
//                     <tr>
//                         {showEntityCol && <th style={{ minWidth: 520 }}>{entityLabel}</th>}
//                         <th>Version</th>
//                         {activeMetrics.map(m => (
//                             <th key={m.key}>{m.label}</th>
//                         ))}
//                         {showNotesCol && <th style={{ minWidth: 260 }}>Remark</th>}
//                     </tr>
//                 </thead>
//                 <tbody>
//                     {sortedVersions.map((v, idx) => {
//                         const prev = idx > 0 ? sortedVersions[idx - 1] : null;
//                         const isBaseline = idx === 0;

//                         return (
//                             <tr key={v.version}>
//                                 {showEntityCol && idx === 0 && (
//                                     <td
//                                         className="vwa-entity-cell"
//                                         rowSpan={sortedVersions.length}
//                                         title={entityName}
//                                     >
//                                         <span className="vwa-entity-label-small">{entityLabel}</span>
//                                         <span className="vwa-entity-name">{entityName}</span>
//                                     </td>
//                                 )}
//                                 <td className="vwa-version-label">
//                                     {v.version}
//                                     {isBaseline && <span className="vwa-baseline-note">(baseline)</span>}
//                                 </td>
//                                 {activeMetrics.map(m => {
//                                     if (v.no_data) {
//                                         return <td key={m.key} className="vwa-no-data">{'\u2014'}</td>;
//                                     }
//                                     const cur = v[m.key];
//                                     const pv  = prev && !prev.no_data ? prev[m.key] : null;
//                                     const trend = isBaseline ? null : vaTrend(cur, pv, m.key);

//                                     return (
//                                         <td key={m.key}>
//                                             {trend && trend.arrow && (
//                                                 <span className={trend.cls}>{trend.arrow}</span>
//                                             )}
//                                             {' '}
//                                             <span>{vaFormat(cur, m.key)}</span>
//                                             {trend && trend.pct !== 'N/A' && (
//                                                 <small className={`vwa-trend-small ${trend.cls}`}>
//                                                     ({trend.pct})
//                                                 </small>
//                                             )}
//                                             {trend && trend.pct === 'N/A' && (
//                                                 <small className="vwa-trend-small vwa-no-data">(N/A)</small>
//                                             )}
//                                         </td>
//                                     );
//                                 })}
//                                 {showNotesCol && idx === 0 && (
//                                     <td
//                                         className="vwa-note-cell"
//                                         rowSpan={sortedVersions.length}
//                                     >
//                                         <NoteCell
//                                             entityType={entityType}
//                                             entityName={entityName}
//                                             parentCampaign={parentCampaign}
//                                             parentAdset={parentAdset}
//                                             notes={notesForEntity}
//                                             notesCtx={notesCtx}
//                                         />
//                                     </td>
//                                 )}
//                             </tr>
//                         );
//                     })}
//                 </tbody>
//             </table>
//         </div>
//     );
// }

// /* =========================================================================
//    NOTE CELL — shows the current user's note (truncated), hover reveals full
//    list of every user's note, click opens inline edit.
//    ========================================================================= */
// function NoteCell({ entityType, entityName, parentCampaign, parentAdset, notes, notesCtx }) {
//     const { saveNote, fetchNoteHistory, noteUser } = notesCtx;
//     const [editing, setEditing] = useState(false);
//     const [draftText, setDraftText] = useState('');
//     const [saving, setSaving] = useState(false);

//     // Find the current user's own note (if any)
//     const myNote = notes.find(n => Number(n.user_id) === Number(noteUser.id));
//     const otherNotes = notes.filter(n => Number(n.user_id) !== Number(noteUser.id));
//     const totalCount = notes.length;

//     const startEdit = (e) => {
//         if (e) e.stopPropagation();
//         setDraftText(myNote ? myNote.note : '');
//         setEditing(true);
//     };

//     const cancel = (e) => {
//         if (e) e.stopPropagation();
//         setEditing(false);
//         setDraftText('');
//     };

//     const commit = async (e) => {
//         if (e) e.stopPropagation();
//         setSaving(true);
//         await saveNote(entityType, entityName, draftText.trim(), parentCampaign, parentAdset);
//         setSaving(false);
//         setEditing(false);
//         setDraftText('');
//     };

//     const showHistory = (e) => {
//         if (e) e.stopPropagation();
//         fetchNoteHistory(entityType, entityName);
//     };

//     // ---------- EDIT MODE ----------
//     if (editing) {
//         return (
//             <div className="vwa-note-editor" onClick={(e) => e.stopPropagation()}>
//                 <textarea
//                     value={draftText}
//                     onChange={(e) => setDraftText(e.target.value)}
//                     placeholder="Write your note... (leave empty to delete)"
//                     autoFocus
//                 />
//                 <div className="vwa-note-editor-actions">
//                     <button
//                         className="vwa-note-editor-btn save"
//                         onClick={commit}
//                         disabled={saving}
//                     >
//                         {saving ? 'Saving...' : (myNote ? 'Update' : 'Save')}
//                     </button>
//                     <button
//                         className="vwa-note-editor-btn cancel"
//                         onClick={cancel}
//                         disabled={saving}
//                     >
//                         Cancel
//                     </button>
//                     {totalCount > 0 && (
//                         <button
//                             className="vwa-note-editor-btn history"
//                             onClick={showHistory}
//                             title="View full edit history"
//                             type="button"
//                         >
//                             <i className="fas fa-history" /> History
//                         </button>
//                     )}
//                 </div>
//             </div>
//         );
//     }

//     // ---------- DISPLAY MODE ----------
//     const displayText = myNote
//         ? myNote.note
//         : (otherNotes.length > 0 ? otherNotes[0].note : null);

//     return (
//         <>
//             <div
//                 className="vwa-note-preview"
//                 onClick={startEdit}
//                 title={displayText || 'Click to add a note'}
//             >
//                 {displayText ? (
//                     <>
//                         {!myNote && otherNotes.length > 0 && (
//                             <span style={{ color: '#64748b', fontSize: 10.5, fontWeight: 600, marginRight: 4 }}>
//                                 {otherNotes[0].user_name}:
//                             </span>
//                         )}
//                         <span>{displayText}</span>
//                         {totalCount > 1 && (
//                             <span className="vwa-note-count-pill">+{totalCount - 1}</span>
//                         )}
//                     </>
//                 ) : (
//                     <span className="vwa-note-preview-empty">
//                         <i className="fas fa-plus" style={{ marginRight: 4, fontSize: 9 }} />
//                         Add note...
//                     </span>
//                 )}
//             </div>

//             {/* Tooltip with all users' notes (hover to reveal) */}
//             {totalCount > 0 && (
//                 <div className="vwa-note-tooltip" onClick={(e) => e.stopPropagation()}>
//                     <div className="vwa-note-tooltip-title">
//                         Notes ({totalCount} {totalCount === 1 ? 'user' : 'users'})
//                     </div>
//                     {notes.map(n => (
//                         <div key={n.id} className="vwa-note-tooltip-item">
//                             <span className="vwa-note-tooltip-user">{n.user_name}:</span>
//                             <span className="vwa-note-tooltip-text">{n.note}</span>
//                             {n.updated_at && (
//                                 <span className="vwa-note-tooltip-time">
//                                     <i className="far fa-clock" style={{ marginRight: 3 }} />
//                                     {n.updated_at.replace('T', ' ').slice(0, 19)}
//                                 </span>
//                             )}
//                         </div>
//                     ))}
//                 </div>
//             )}
//         </>
//     );
// }

// /* =========================================================================
//    NOTE HISTORY MODAL — full audit log for one entity.
//    ========================================================================= */
// function NoteHistoryModal({ entity, onClose }) {
//     useEffect(() => {
//         const onKey = (e) => { if (e.key === 'Escape') onClose(); };
//         document.addEventListener('keydown', onKey);
//         return () => document.removeEventListener('keydown', onKey);
//     }, [onClose]);

//     const rows = entity.rows || [];
//     return (
//         <div className="vwa-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
//             <div className="vwa-modal" style={{ maxWidth: 720 }}>
//                 <div className="vwa-modal-header">
//                     <div className="vwa-modal-title">
//                         <i className="fas fa-history"></i>
//                         <span>Edit History</span>
//                     </div>
//                     <button className="vwa-modal-close" onClick={onClose} title="Close (Esc)">
//                         <i className="fas fa-times"></i>
//                     </button>
//                 </div>

//                 <div className="vwa-modal-body vwa-history-modal-body">
//                     <div className="vwa-modal-subtitle">
//                         <b style={{ textTransform: 'capitalize' }}>{entity.entityType}:</b>{' '}
//                         {entity.entityName}
//                     </div>

//                     {rows.length === 0 && (
//                         <div className="vwa-empty" style={{ padding: 20 }}>
//                             No history recorded yet.
//                         </div>
//                     )}

//                     {rows.map(r => (
//                         <div key={r.id} className={`vwa-history-entry ${r.action}`}>
//                             <div className="vwa-history-meta">
//                                 <span className={`vwa-history-action ${r.action}`}>{r.action}</span>
//                                 <span className="vwa-history-user">{r.user_name}</span>
//                                 <span>{r.created_at}</span>
//                             </div>
//                             {r.action === 'create' && r.new_note && (
//                                 <div className="vwa-history-diff">
//                                     <div className="vwa-history-new">{r.new_note}</div>
//                                 </div>
//                             )}
//                             {r.action === 'update' && (
//                                 <div className="vwa-history-diff">
//                                     {r.old_note && <div className="vwa-history-old">{r.old_note}</div>}
//                                     {r.new_note && <div className="vwa-history-new">{r.new_note}</div>}
//                                 </div>
//                             )}
//                             {r.action === 'delete' && r.old_note && (
//                                 <div className="vwa-history-diff">
//                                     <div className="vwa-history-old">{r.old_note}</div>
//                                 </div>
//                             )}
//                         </div>
//                     ))}
//                 </div>
//             </div>
//         </div>
//     );
// }

// /* Skeleton cards while the main campaign list is loading */
// function VASkeletonCards() {
//     return (
//         <>
//             {[0, 1, 2].map(i => (
//                 <div key={i} className="vwa-campaign-card">
//                     <div className="vwa-campaign-header">
//                         <div className="vwa-skeleton-cell" style={{ width: 16, height: 16 }}></div>
//                         <div className="vwa-skeleton-cell" style={{ flex: 1, height: 14 }}></div>
//                         <div className="vwa-skeleton-cell" style={{ width: 60, height: 14 }}></div>
//                     </div>
//                     <div className="vwa-campaign-body">
//                         <VASkeletonRow cols={7} />
//                         <VASkeletonRow cols={7} />
//                         <VASkeletonRow cols={7} />
//                     </div>
//                 </div>
//             ))}
//         </>
//     );
// }

// function VASkeletonRow({ cols = 7 }) {
//     return (
//         <div className="vwa-skeleton-row" style={{ gridTemplateColumns: `80px repeat(${cols - 1}, 1fr)` }}>
//             {Array.from({ length: cols }).map((_, i) => (
//                 <div key={i} className="vwa-skeleton-cell"></div>
//             ))}
//         </div>
//     );
// }

// /* =========================================================================
//    FINAL REPORT MODAL — aggregated per-version performance, sortable.
//    Sums spend/impressions/clicks/registrations/exams/revenue across all
//    campaigns for each selected version, recomputes the 6 metrics, then
//    sorts by the chosen column. Default: ROI descending (best on top).
//    ========================================================================= */
// function FinalReportModal({ selectedVersions, campaigns, onClose, sort, setSort }) {

//     // Close on ESC
//     useEffect(() => {
//         const onKey = (e) => { if (e.key === 'Escape') onClose(); };
//         document.addEventListener('keydown', onKey);
//         return () => document.removeEventListener('keydown', onKey);
//     }, [onClose]);

//     // Aggregate per-version totals across all campaigns
//     const rows = (() => {
//         return selectedVersions.map(v => {
//             let spend = 0, imp = 0, clicks = 0, reg = 0, exams = 0, rev = 0;
//             let campaignsWithData = 0;
//             campaigns.forEach(c => {
//                 const vData = c.versions && c.versions.find(x => x.version === v);
//                 if (vData && !vData.no_data) {
//                     spend  += Number(vData.spend)         || 0;
//                     imp    += Number(vData.impressions)   || 0;
//                     clicks += Number(vData.clicks)        || 0;
//                     reg    += Number(vData.registrations) || 0;
//                     exams  += Number(vData.exams)         || 0;
//                     rev    += Number(vData.revenue)       || 0;
//                     campaignsWithData++;
//                 }
//             });
//             return {
//                 version: v,
//                 spend, impressions: imp, clicks, registrations: reg, exams, revenue: rev,
//                 campaigns: campaignsWithData,
//                 cpm:           imp    > 0 ? (spend / imp * 1000)         : 0,
//                 cpc:           clicks > 0 ? (spend / clicks)             : 0,
//                 ctr:           imp    > 0 ? (clicks / imp * 100)         : 0,
//                 cpl:           reg    > 0 ? (spend / reg)                : 0,
//                 cost_per_exam: exams  > 0 ? (spend / exams)              : 0,
//                 roi:           spend  > 0 ? (rev / spend)                : 0,
//             };
//         });
//     })();

//     // Sort
//     const sorted = [...rows].sort((a, b) => {
//         const va = Number(a[sort.key]) || 0;
//         const vb = Number(b[sort.key]) || 0;
//         return sort.dir === 'asc' ? va - vb : vb - va;
//     });

//     const clickSort = (key) => {
//         setSort(prev => {
//             if (prev.key === key) {
//                 return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
//             }
//             return { key, dir: 'desc' };
//         });
//     };

//     // Column definitions for the modal
//     const cols = [
//         { key: 'version',        label: 'Version',       fmt: (v) => v, sortable: false, cellClass: 'vwa-version-cell' },
//         { key: 'cpm',            label: 'CPM',           fmt: (v) => '\u20B9' + Math.round(v).toLocaleString('en-IN') },
//         { key: 'cpc',            label: 'CPC',           fmt: (v) => '\u20B9' + Number(v).toFixed(2) },
//         { key: 'ctr',            label: 'CTR',           fmt: (v) => Number(v).toFixed(2) + '%' },
//         { key: 'cpl',            label: 'CPL',           fmt: (v) => '\u20B9' + Math.round(v).toLocaleString('en-IN') },
//         { key: 'cost_per_exam',  label: 'Cost Per Exam', fmt: (v) => '\u20B9' + Math.round(v).toLocaleString('en-IN') },
//         { key: 'roi',            label: 'ROI',           fmt: (v) => Number(v).toFixed(2) },
//         { key: 'spend',          label: 'Spend',         fmt: (v) => '\u20B9' + Math.round(v).toLocaleString('en-IN') },
//         { key: 'revenue',        label: 'Revenue',       fmt: (v) => '\u20B9' + Math.round(v).toLocaleString('en-IN') },
//         { key: 'registrations',  label: 'Regs',          fmt: (v) => Number(v).toLocaleString('en-IN') },
//         { key: 'exams',          label: 'Exams',         fmt: (v) => Number(v).toLocaleString('en-IN') },
//     ];

//     const sortMetricOptions = cols.filter(c => c.sortable !== false);

//     return (
//         <div className="vwa-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
//             <div className="vwa-modal">
//                 <div className="vwa-modal-header">
//                     <div className="vwa-modal-title">
//                         <i className="fas fa-trophy"></i>
//                         <span>Final Reports — Version Leaderboard</span>
//                     </div>
//                     <button className="vwa-modal-close" onClick={onClose} title="Close (Esc)">
//                         <i className="fas fa-times"></i>
//                     </button>
//                 </div>

//                 <div className="vwa-modal-body">
//                     <div className="vwa-modal-subtitle">
//                         Aggregated totals across all {campaigns.length} campaigns.
//                         Default sort: highest <b>{sortMetricOptions.find(c => c.key === sort.key)?.label || sort.key}</b> on top.
//                         Click any column header to re-sort.
//                     </div>

//                     <div className="vwa-modal-controls">
//                         <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Sort by:</span>
//                         <select
//                             className="vwa-modal-sort-select"
//                             value={sort.key}
//                             onChange={(e) => setSort({ key: e.target.value, dir: sort.dir })}
//                         >
//                             {sortMetricOptions.map(c => (
//                                 <option key={c.key} value={c.key}>{c.label}</option>
//                             ))}
//                         </select>
//                         <select
//                             className="vwa-modal-sort-select"
//                             value={sort.dir}
//                             onChange={(e) => setSort({ key: sort.key, dir: e.target.value })}
//                         >
//                             <option value="desc">Highest to Lowest</option>
//                             <option value="asc">Lowest to Highest</option>
//                         </select>
//                         <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
//                             Rows sorted by selected metric. Column headers also work.
//                         </span>
//                     </div>

//                     <table className="vwa-modal-table">
//                         <thead>
//                             <tr>
//                                 <th style={{ width: 60 }}>#</th>
//                                 {cols.map(c => (
//                                     <th
//                                         key={c.key}
//                                         onClick={() => c.sortable !== false && clickSort(c.key)}
//                                         className={sort.key === c.key ? 'sort-active' : ''}
//                                         style={{ cursor: c.sortable === false ? 'default' : 'pointer' }}
//                                     >
//                                         {c.label}
//                                         {c.sortable !== false && (
//                                             <span className="sort-ind">
//                                                 {sort.key === c.key
//                                                     ? (sort.dir === 'asc' ? '\u25B2' : '\u25BC')
//                                                     : '\u25B4\u25BE'}
//                                             </span>
//                                         )}
//                                     </th>
//                                 ))}
//                             </tr>
//                         </thead>
//                         <tbody>
//                             {sorted.map((r, idx) => (
//                                 <tr key={r.version}>
//                                     <td><span className="vwa-rank">{idx + 1}</span></td>
//                                     {cols.map(c => (
//                                         <td key={c.key} className={c.cellClass || ''}>
//                                             {c.fmt(r[c.key])}
//                                         </td>
//                                     ))}
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>

//                     {sorted.length === 0 && (
//                         <div className="vwa-empty" style={{ marginTop: 20 }}>
//                             <div className="vwa-empty-title">No data to rank</div>
//                         </div>
//                     )}
//                 </div>
//             </div>
//         </div>
//     );
// }


















/* ==========================================================================
   META ADS ROI ANALYTICS DASHBOARD - React Single File (1:1 with PHP version)
   - All backend calls go through ONE endpoint as action-based POST (same as PHP)
   - All state / selection / sort / filter / comparison logic preserved
   - All CSS embedded - drop-in component
   - Requires FontAwesome 6 + Inter font in the host page (CDN links below)
   ==========================================================================

   HOST PAGE HEAD (add once):
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
   <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

   USAGE:
   import MetaAdsDashboard from './MetaAdsDashboard';
   <MetaAdsDashboard apiUrl="/admin/real_time_reports2.php" />
   ========================================================================== */

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

/* =========================================================================
   1. API DISPATCHER - action based, same pattern as the PHP file
   ========================================================================= */
async function apiAction(apiUrl, action, params = {}) {
    const fd = new FormData();
    fd.append('action', action);
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        fd.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
    });
    const res = await fetch(apiUrl, {
        method: 'POST',
        body: fd,
    });
    return res.json();
}

/* =========================================================================
   2. HELPERS
   ========================================================================= */
const formatCurrency = (v) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(v || 0);

const formatNumber = (v) => new Intl.NumberFormat('en-IN').format(v || 0);

const toYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

const parseYMD = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};

const formatDisplay = (d) => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
};

const getPreviousPeriod = (fromStr, toStr) => {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    const diff = Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1;
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - diff + 1);
    return { from: toYMD(prevFrom), to: toYMD(prevTo) };
};

const escapeHtml = (s) =>
    String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const formatMetricValue = (col, v) => {
    const currency = ['spend','cost_per_registration','cost_per_exam','cost_per_internship','revenue','rpu','cac_all','cac_paid'];
    return currency.includes(col) ? formatCurrency(v) : formatNumber(v);
};

/* =========================================================================
   3. COLUMN DEFINITIONS (used for rendering + comparison expansion)
   ========================================================================= */
const METRIC_COLS = [
    { key: 'spend',                  label: 'Spend',       type: 'currency', expandable: true  },
    { key: 'registrations',          label: 'Registrations',type: 'number',  expandable: true  },
    { key: 'cost_per_registration',  label: 'Cost/Reg',    type: 'currency', expandable: true  },
    { key: 'exam_count',             label: 'Exams',       type: 'number',   expandable: true  },
    { key: 'cost_per_exam',          label: 'Cost/Exam',   type: 'currency', expandable: true  },
    { key: 'exam_percent',           label: 'Exam %',      type: 'percent',  expandable: false },
    { key: 'internship_count',       label: 'Internships', type: 'number',   expandable: true  },
    { key: 'second_internship',      label: '2nd Intern',  type: 'number',   expandable: true  },
    { key: 'cost_per_internship',    label: 'Cost/Intern', type: 'currency', expandable: true  },
    { key: 'revenue',                label: 'Revenue',     type: 'currency', expandable: true  },
    { key: 'roi',                    label: 'ROI',         type: 'ratio',    expandable: true  },
    { key: 'rpu',                    label: 'RPU',         type: 'currency', expandable: true  },
    { key: 'cac_all',                label: 'CAC (All)',   type: 'currency', expandable: true  },
    { key: 'cac_paid',               label: 'CAC (Paid)',  type: 'currency', expandable: true  },
    { key: 'roas',                   label: 'ROAS',        type: 'ratio',    expandable: true  },
];

/* =========================================================================
   VERSION ANALYSIS - metric definitions + helpers (per PDF spec)
   Cost metrics: lower is better  (CPM, CPC, CPL, Cost Per Exam, Spend)
   Performance metrics: higher is better  (CTR, ROI)
   ========================================================================= */
const VA_METRICS = [
    { key: 'cpm',            label: 'CPM',            type: 'currency', lowerIsBetter: true  },
    { key: 'cpc',            label: 'CPC',            type: 'currency', lowerIsBetter: true  },
    { key: 'ctr',            label: 'CTR',            type: 'percent',  lowerIsBetter: false },
    { key: 'cpl',            label: 'CPL',            type: 'currency', lowerIsBetter: true  },
    { key: 'cost_per_exam',  label: 'Cost Per Exam',  type: 'currency', lowerIsBetter: true  },
    { key: 'roi',            label: 'ROI',            type: 'ratio',    lowerIsBetter: false },
    { key: 'spend',          label: 'Spend',          type: 'currency', lowerIsBetter: true  },
];
const VA_METRIC_MAP = Object.fromEntries(VA_METRICS.map(m => [m.key, m]));

/** Format a metric value for display. Returns "—" for null/undefined. */
function vaFormat(val, metricKey) {
    if (val === null || val === undefined) return '\u2014';
    const m = VA_METRIC_MAP[metricKey];
    if (!m) return String(val);
    if (m.type === 'percent')  return Number(val).toFixed(2) + '%';
    if (m.type === 'ratio')    return Number(val).toFixed(2);
    // currency - keep 2 decimals so small differences (that show up in the
    // percentage column) are visible instead of being hidden by rounding
    return '\u20B9' + Number(val).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * Compute the trend object for a metric vs previous row.
 * Returns { arrow, pct, cls } or null (baseline / missing data).
 *
 * Sign convention (per user spec):
 *   Value went UP from previous row   →  ▲ green with +X% (profit/gain)
 *   Value went DOWN from previous row →  ▼ red with -X%   (loss)
 *   Value unchanged                   →  no arrow, 0%
 *
 * Pure mathematical direction — applies to ALL metrics the same way,
 * regardless of whether higher or lower is "business-better".
 */
function vaTrend(current, previous, metricKey) {
    if (current === null || current === undefined) return null;
    if (previous === null || previous === undefined) return null;
    if (Number(previous) === 0) return { pct: 'N/A', cls: 'vwa-trend-neutral', arrow: '' };

    // Same value -> neutral, no arrow
    if (Number(current) === Number(previous)) {
        return { pct: '+0.0%', cls: 'vwa-trend-neutral', arrow: '' };
    }

    const rawPct = ((Number(current) - Number(previous)) / Number(previous)) * 100;
    const rounded = Math.round(rawPct * 10) / 10;
    const isUp = Number(current) > Number(previous);

    return {
        // rounded already carries its own +/- sign
        pct: (rounded >= 0 ? '+' : '') + rounded.toFixed(1) + '%',
        cls: isUp ? 'vwa-trend-up' : 'vwa-trend-down',
        arrow: isUp ? '\u25B2' : '\u25BC',   // ▲ / ▼
    };
}

/* =========================================================================
   4. EMBEDDED CSS (1:1 with meta-ads-dashboard.css)
   ========================================================================= */
const DASHBOARD_CSS = `
.mad-wrap * { box-sizing: border-box; }
.mad-wrap {
    --primary: #1877f2;
    --primary-hover: #166fe5;
    --success: #42b72a;
    --text-primary: #050505;
    --text-secondary: #65676b;
    --border: #dddfe2;
    --bg-light: #f0f2f5;
    --bg-white: #ffffff;
    --bg-hover: #f2f3f5;
    --bg-selected: #e7f3ff;
    --shadow: 0 1px 2px rgba(0,0,0,.1);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg-light);
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.5;
    min-height: 100vh;
}
.mad-wrap .container { max-width: 100%; margin: 0; padding: 16px; }

.mad-wrap .dashboard-header {
    background: var(--bg-white);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: var(--shadow);
}
.mad-wrap .header-title { font-size: 20px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.mad-wrap .header-subtitle { font-size: 13px; color: var(--text-secondary); }

.mad-wrap .filters-section {
    background: var(--bg-white);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    box-shadow: var(--shadow);
}
.mad-wrap .filter-group { display: flex; flex-direction: column; gap: 6px; }
.mad-wrap .filter-label {
    font-size: 12px; font-weight: 600; color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: .3px;
}
.mad-wrap .filter-select, .mad-wrap .filter-input {
    width: 100%; padding: 8px 12px; border: 1px solid var(--border);
    border-radius: 6px; font-size: 13px; font-family: inherit;
    background: var(--bg-white); color: var(--text-primary);
}
.mad-wrap .filter-select:focus, .mad-wrap .filter-input:focus {
    outline: none; border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(24,119,242,.1);
}
.mad-wrap .btn-primary {
    padding: 8px 16px; background: var(--primary); color: #fff;
    border: none; border-radius: 6px; font-size: 13px; font-weight: 600;
    cursor: pointer; display: flex; align-items: center; gap: 6px;
    justify-content: center; white-space: nowrap; height: 36px;
}
.mad-wrap .btn-primary:hover { background: var(--primary-hover); }
.mad-wrap .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

.mad-wrap .search-date-row {
    display: flex; gap: 12px; align-items: flex-end; margin-bottom: 12px;
    flex-wrap: wrap;
}
.mad-wrap .search-wrapper { flex: 1; position: relative; min-width: 280px; }
.mad-wrap .search-wrapper input {
    width: 100%; padding: 9px 14px 9px 38px; border: 1px solid var(--border);
    border-radius: 6px; font-size: 13px; font-family: inherit;
    background: var(--bg-white); color: var(--text-primary);
}
.mad-wrap .search-wrapper input:focus {
    outline: none; border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(24,119,242,.1);
}
.mad-wrap .search-wrapper .search-icon {
    position: absolute; left: 12px; top: 38px; font-size: 13px;
    color: var(--text-secondary); pointer-events: none;
}
.mad-wrap .search-suggestions {
    display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    background: #fff; border: 1px solid var(--border); border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,.12); z-index: 100;
    max-height: 220px; overflow-y: auto;
}
.mad-wrap .search-suggestions.visible { display: block; }
.mad-wrap .suggestion-item {
    padding: 8px 12px; font-size: 12.5px; color: var(--text-primary);
    cursor: pointer; white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis;
}
.mad-wrap .suggestion-item:hover { background: var(--bg-selected); }
.mad-wrap .suggestion-item .highlight { color: var(--primary); font-weight: 600; }

.mad-wrap .date-range-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 14px; border: 1px solid var(--border); border-radius: 6px;
    background: #fff; font-size: 13px; font-family: inherit;
    color: var(--text-primary); cursor: pointer; white-space: nowrap;
    min-width: 240px; justify-content: space-between; height: 36px;
}
.mad-wrap .date-range-btn:hover { border-color: var(--primary); }
.mad-wrap .date-range-btn .dr-dates { font-weight: 500; font-size: 12.5px; }
.mad-wrap .date-range-btn .dr-icon { color: var(--text-secondary); font-size: 12px; }

.mad-wrap .datepicker-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,.35); z-index: 1000;
    justify-content: center; align-items: center;
    opacity: 0; transition: opacity .25s ease;
}
.mad-wrap .datepicker-overlay.visible { display: flex; opacity: 1; }
.mad-wrap .datepicker-popup {
    background: #fff; border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,.18);
    display: flex; overflow: hidden; width: 720px; max-height: 85vh;
    overflow-y: auto; transform: translateY(-10px) scale(.98); opacity: 0;
    transition: all .25s ease;
}
.mad-wrap .datepicker-overlay.visible .datepicker-popup {
    transform: translateY(0) scale(1); opacity: 1;
}
.mad-wrap .dp-presets {
    width: 170px; border-right: 1px solid var(--border);
    padding: 12px 0; background: #fafafa; flex-shrink: 0;
}
.mad-wrap .dp-presets-title {
    font-size: 11px; font-weight: 700; color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: .5px;
    padding: 0 14px; margin-bottom: 8px;
}
.mad-wrap .dp-preset-item {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 14px; cursor: pointer; font-size: 13px;
    color: var(--text-primary); border: none; background: none;
    width: 100%; text-align: left; font-family: inherit;
}
.mad-wrap .dp-preset-item:hover { background: #eef2ff; }
.mad-wrap .dp-preset-item.active { color: var(--primary); font-weight: 600; }
.mad-wrap .dp-preset-radio {
    width: 16px; height: 16px; border-radius: 50%; border: 2px solid #ccc;
    flex-shrink: 0; display: flex; align-items: center; justify-content: center;
}
.mad-wrap .dp-preset-item.active .dp-preset-radio {
    border-color: var(--primary); background: var(--primary);
}
.mad-wrap .dp-preset-item.active .dp-preset-radio::after {
    content: ''; width: 6px; height: 6px; background: #fff; border-radius: 50%;
}
.mad-wrap .dp-calendars { flex: 1; padding: 16px; }
.mad-wrap .dp-cal-header {
    display: flex; justify-content: space-between;
    align-items: center; margin-bottom: 16px;
}
.mad-wrap .dp-cal-nav { display: flex; align-items: center; gap: 12px; }
.mad-wrap .dp-cal-nav button {
    background: none; border: none; cursor: pointer;
    color: var(--text-secondary); font-size: 14px;
    padding: 4px 8px; border-radius: 4px;
}
.mad-wrap .dp-cal-nav button:hover { background: #eee; }
.mad-wrap .dp-cal-nav .month-year {
    font-size: 13px; font-weight: 600; color: var(--text-primary);
    min-width: 100px; text-align: center;
}
.mad-wrap .dp-two-calendars { display: flex; gap: 16px; }
.mad-wrap .dp-calendar { flex: 1; }
.mad-wrap .dp-calendar .cal-month-title {
    font-size: 13px; font-weight: 600; color: var(--text-primary);
    margin-bottom: 10px; text-align: center;
}
.mad-wrap .dp-calendar .cal-weekdays {
    display: grid; grid-template-columns: repeat(7, 1fr);
    gap: 2px; margin-bottom: 4px;
}
.mad-wrap .dp-calendar .cal-weekdays span {
    font-size: 11px; font-weight: 600; color: var(--text-secondary);
    text-align: center; padding: 4px 0;
}
.mad-wrap .dp-calendar .cal-days {
    display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;
}
.mad-wrap .dp-calendar .cal-day {
    aspect-ratio: 1; display: flex; align-items: center;
    justify-content: center; font-size: 11.5px;
    color: var(--text-primary); border-radius: 4px;
    cursor: pointer; border: none; background: none;
    font-family: inherit; padding: 4px;
}
.mad-wrap .dp-calendar .cal-day:hover { background: #e8eeff; }
.mad-wrap .dp-calendar .cal-day.other-month { color: #bbb; }
.mad-wrap .dp-calendar .cal-day.selected-start,
.mad-wrap .dp-calendar .cal-day.selected-end {
    background: var(--primary); color: #fff; font-weight: 600;
}
.mad-wrap .dp-calendar .cal-day.in-range { background: #dbeafe; border-radius: 0; }
.mad-wrap .dp-calendar .cal-day.selected-start { border-radius: 4px 0 0 4px; }
.mad-wrap .dp-calendar .cal-day.selected-end   { border-radius: 0 4px 4px 0; }
.mad-wrap .dp-calendar .cal-day.selected-start.selected-end { border-radius: 4px; }
.mad-wrap .dp-calendar .cal-day.today { border: 2px solid var(--primary); }
.mad-wrap .dp-footer {
    display: flex; justify-content: flex-end; align-items: center;
    gap: 10px; margin-top: 20px; padding-top: 16px;
    border-top: 1px solid var(--border);
}
.mad-wrap .dp-footer .dp-date-display {
    font-size: 12px; color: var(--text-secondary); margin-right: auto;
}
.mad-wrap .btn-cancel {
    padding: 7px 18px; background: #fff; color: var(--text-primary);
    border: 1px solid var(--border); border-radius: 6px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    font-family: inherit;
}
.mad-wrap .btn-cancel:hover { background: #f0f0f0; }
.mad-wrap .btn-update {
    padding: 7px 22px; background: var(--primary); color: #fff;
    border: none; border-radius: 6px; font-size: 13px;
    font-weight: 600; cursor: pointer; font-family: inherit;
}
.mad-wrap .btn-update:hover { background: var(--primary-hover); }
.mad-wrap .dp-compare-section {
    margin-bottom: 12px; padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
}
.mad-wrap .dp-compare-label {
    display: inline-flex; align-items: center; gap: 8px;
    cursor: pointer; font-size: 13px; font-weight: 500;
    color: var(--text-primary); user-select: none;
}
.mad-wrap .dp-compare-label input[type="checkbox"] {
    width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary);
}
.mad-wrap .dp-compare-range {
    margin-top: 16px; padding-top: 16px;
    border-top: 2px solid var(--border);
}
.mad-wrap .dp-compare-header {
    font-size: 12px; font-weight: 600;
    color: var(--text-primary); margin-bottom: 12px;
}

.mad-wrap .level-tabs {
    background: var(--bg-white); border-radius: 8px 8px 0 0;
    box-shadow: var(--shadow); display: flex;
    overflow-x: auto; margin-bottom: 0;
}
.mad-wrap .level-tab {
    flex: 1; min-width: 150px; padding: 12px 16px;
    background: transparent; border: none;
    border-bottom: 3px solid transparent;
    color: var(--text-secondary); font-size: 13px; font-weight: 600;
    cursor: pointer; display: flex; align-items: center;
    justify-content: center; gap: 8px; white-space: nowrap;
    font-family: inherit;
}
.mad-wrap .level-tab:hover { background: var(--bg-hover); }
.mad-wrap .level-tab.active { color: var(--primary); border-bottom-color: var(--primary); }
.mad-wrap .tab-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 20px; height: 20px; padding: 0 6px;
    background: #e4e6eb; color: var(--text-secondary);
    font-size: 11px; font-weight: 700; border-radius: 10px;
}
.mad-wrap .level-tab.active .tab-badge { background: var(--primary); color: #fff; }

.mad-wrap .table-section {
    background: var(--bg-white); border-radius: 0 0 8px 8px;
    box-shadow: var(--shadow); display: flex; flex-direction: column;
}
.mad-wrap .table-wrapper {
    overflow-x: auto; overflow-y: auto;
    max-height: 58vh; flex: 1;
}
.mad-wrap .data-table {
    width: 100%; border-collapse: separate; border-spacing: 0;
    font-size: 13px; min-width: 1400px; table-layout: fixed;
}
.mad-wrap .data-table thead {
    position: sticky; top: 0; z-index: 10; background: var(--bg-light);
}
.mad-wrap .data-table thead th {
    padding: 10px 12px; text-align: left; font-size: 11.5px; font-weight: 600;
    color: var(--text-secondary); border-bottom: 2px solid var(--border);
    white-space: nowrap; user-select: none; cursor: pointer;
    background: var(--bg-light); position: relative;
}
.mad-wrap .data-table thead th:hover { background: #e4e6eb; }
.mad-wrap .th-content { display: flex; align-items: center; gap: 4px; }
.mad-wrap .sort-icon { font-size: 10px; color: var(--text-secondary); opacity: .4; }
.mad-wrap .sort-icon.active { opacity: 1; color: var(--primary); }
.mad-wrap .data-table tbody tr {
    border-bottom: 1px solid var(--border);
}
.mad-wrap .data-table tbody tr:nth-child(even) { background: #f8f9fa; }
.mad-wrap .data-table tbody tr:hover { background: var(--bg-hover); }
.mad-wrap .data-table tbody tr.selected { background: var(--bg-selected) !important; }
.mad-wrap .data-table tbody td {
    padding: 9px 12px; color: var(--text-primary); white-space: nowrap;
}
.mad-wrap .checkbox-cell {
    width: 40px !important; min-width: 40px !important; text-align: center;
}
.mad-wrap .custom-checkbox {
    width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary);
}
.mad-wrap .text-cell {
    max-width: 640px; overflow: hidden;
    text-overflow: ellipsis; font-weight: 500;
}
.mad-wrap .currency, .mad-wrap .number { font-variant-numeric: tabular-nums; }
.mad-wrap .currency { font-weight: 500; }

.mad-wrap .footer-wrapper {
    overflow-x: auto; border-top: 2px solid var(--border);
    background: #eef1f5; border-radius: 0 0 8px 8px; flex-shrink: 0;
}
.mad-wrap .footer-table {
    width: 100%; border-collapse: separate; border-spacing: 0;
    font-size: 13px; min-width: 1400px; table-layout: fixed;
}
.mad-wrap .footer-table td {
    padding: 9px 12px; font-weight: 600; color: var(--text-primary);
    white-space: nowrap; border-top: none;
}
.mad-wrap .footer-table .footer-label {
    color: var(--text-secondary); font-weight: 700; font-size: 12px;
}

.mad-wrap .data-table th, .mad-wrap .data-table td, .mad-wrap .footer-table td {
    width: 120px; border-right: 1px solid #eef1f5;
}
.mad-wrap .data-table th:last-child, .mad-wrap .data-table td:last-child,
.mad-wrap .footer-table td:last-child { border-right: none; }

/* Column resize handle */
.mad-wrap .col-resizer {
    position: absolute;
    top: 0;
    right: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    user-select: none;
    z-index: 12;
    background: transparent;
    transition: background .15s;
}
.mad-wrap .col-resizer:hover,
.mad-wrap .col-resizer.resizing {
    background: var(--primary);
    opacity: 0.3;
}
.mad-wrap .col-resizer.resizing {
    opacity: 0.6;
}
.mad-wrap.is-resizing,
.mad-wrap.is-resizing * {
    cursor: col-resize !important;
    user-select: none !important;
}

.mad-wrap .campaign-column, .mad-wrap .adset-column, .mad-wrap .ad-column {
    min-width: 650px !important; max-width: 650px !important; width: 650px !important;
}
.mad-wrap .campaign-column .text-cell,
.mad-wrap .adset-column .text-cell,
.mad-wrap .ad-column .text-cell {
    overflow: visible; text-overflow: unset; white-space: nowrap;
}
/* Blue name cells in data rows */
.mad-wrap .data-table tbody td.campaign-column.text-cell,
.mad-wrap .data-table tbody td.adset-column.text-cell,
.mad-wrap .data-table tbody td.ad-column.text-cell {
    color: var(--primary);
    font-weight: 600;
}

/* Frozen columns */
.mad-wrap .data-table th.checkbox-cell,
.mad-wrap .data-table td.checkbox-cell,
.mad-wrap .footer-table td.checkbox-cell {
    position: sticky; left: 0; background: #fff; z-index: 6;
}
.mad-wrap .data-table th.campaign-column,
.mad-wrap .data-table td.campaign-column,
.mad-wrap .footer-table td.campaign-column {
    position: sticky; left: 40px; background: #fff; z-index: 5;
}
.mad-wrap .data-table th.adset-column,
.mad-wrap .data-table td.adset-column,
.mad-wrap .footer-table td.adset-column {
    position: sticky; left: 40px; background: #fff; z-index: 5;
}
.mad-wrap .data-table th.ad-column,
.mad-wrap .data-table td.ad-column,
.mad-wrap .footer-table td.ad-column {
    position: sticky; left: 0; background: #fff; z-index: 5;
}

/* Status */
.mad-wrap .status-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 8px; border-radius: 4px;
    font-size: 11.5px; font-weight: 600;
}
.mad-wrap .status-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.mad-wrap .status-active { background: #eafaf1; color: #1a7a45; }
.mad-wrap .status-active .status-dot { background: #1a7a45; }
.mad-wrap .status-inactive { background: #fef0f0; color: #b91c1c; }
.mad-wrap .status-inactive .status-dot { background: #b91c1c; }
.mad-wrap .status-paused { background: #fef9e7; color: #b7860e; }
.mad-wrap .status-paused .status-dot { background: #b7860e; }
.mad-wrap .status-in-review { background: #fef9e7; color: #b7860e; }
.mad-wrap .status-in-review .status-dot { background: #b7860e; }
.mad-wrap .status-unknown { background: #f3f4f6; color: #6b7280; }
.mad-wrap .status-unknown .status-dot { background: #9ca3af; }

/* Spinner */
.mad-wrap .spinner {
    display: inline-block; width: 12px; height: 12px;
    border: 2px solid rgba(255,255,255,.3); border-radius: 50%;
    border-top-color: #fff; animation: mad-spin .6s linear infinite;
}
@keyframes mad-spin { to { transform: rotate(360deg); } }

/* Loading dots (for phase-2 delivery/event) */
.mad-wrap .loading-dots {
    display: inline-flex; align-items: center; gap: 3px;
    color: var(--text-secondary); font-size: 12px;
}
.mad-wrap .loading-dots span {
    width: 4px; height: 4px; background: currentColor;
    border-radius: 50%; display: inline-block;
    animation: madDotBounce 1.2s infinite ease-in-out;
}
.mad-wrap .loading-dots span:nth-child(2) { animation-delay: .2s; }
.mad-wrap .loading-dots span:nth-child(3) { animation-delay: .4s; }
@keyframes madDotBounce {
    0%,80%,100% { opacity: .2; transform: scale(.8); }
    40% { opacity: 1; transform: scale(1.2); }
}

/* Empty & Alerts */
.mad-wrap .empty-state { text-align: center; padding: 60px 20px; }
.mad-wrap .empty-icon { font-size: 48px; color: #cbd5e1; margin-bottom: 16px; }
.mad-wrap .empty-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.mad-wrap .empty-text { font-size: 13px; color: var(--text-secondary); }

.mad-wrap .alert {
    padding: 12px 16px; border-radius: 6px; margin-bottom: 16px;
    display: flex; align-items: center; gap: 10px; font-size: 13px;
}
.mad-wrap .alert-error { background: #fee; border: 1px solid #fcc; color: #c00; }
.mad-wrap .alert-success { background: #efe; border: 1px solid #cfc; color: #090; }

.mad-wrap .token-box {
    display: none; margin-bottom: 16px; gap: 10px; align-items: center;
}
.mad-wrap .token-box.show { display: flex; }

/* Filter icon + dropdown */
.mad-wrap .filter-icon {
    color: var(--text-secondary); font-size: 10px; opacity: 0;
    cursor: pointer; margin-left: auto;
}
.mad-wrap .data-table th:hover .filter-icon { opacity: .6; }
.mad-wrap .filter-icon:hover, .mad-wrap .filter-icon.active {
    opacity: 1 !important; color: var(--primary);
}
.mad-wrap .column-filter-dropdown {
    position: fixed; background: #fff; border: 1px solid var(--border);
    border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,.15);
    width: 260px; max-height: 360px; display: none;
    flex-direction: column; z-index: 1001;
}
.mad-wrap .column-filter-dropdown.visible { display: flex; }
.mad-wrap .filter-search-box {
    padding: 8px 10px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px;
}
.mad-wrap .filter-search-box input {
    flex: 1; border: none; outline: none;
    font-size: 12px; font-family: inherit; background: transparent;
}
.mad-wrap .filter-options {
    flex: 1; overflow-y: auto; padding: 4px; max-height: 240px;
}
.mad-wrap .filter-option-item {
    padding: 6px 8px; display: flex; align-items: center;
    gap: 8px; cursor: pointer; border-radius: 4px;
}
.mad-wrap .filter-option-item:hover { background: var(--bg-hover); }
.mad-wrap .filter-option-item input[type="checkbox"] {
    width: 15px; height: 15px; accent-color: var(--primary);
}
.mad-wrap .filter-option-item label {
    flex: 1; font-size: 12px; cursor: pointer;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mad-wrap .filter-actions {
    padding: 8px; border-top: 1px solid var(--border);
    display: flex; gap: 8px;
}
.mad-wrap .btn-filter-clear, .mad-wrap .btn-filter-ok {
    flex: 1; padding: 6px 12px; border: none; border-radius: 4px;
    font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;
}
.mad-wrap .btn-filter-clear { background: var(--bg-light); color: var(--text-primary); }
.mad-wrap .btn-filter-clear:hover { background: #e0e0e0; }
.mad-wrap .btn-filter-ok { background: var(--primary); color: #fff; }
.mad-wrap .btn-filter-ok:hover { background: var(--primary-hover); }

/* Comparison expansion */
.mad-wrap .expand-icon {
    color: var(--text-secondary); font-size: 10px;
    opacity: 0;
    cursor: pointer; margin-left: 4px; transition: transform .2s;
}
/* Always show the expand icon when comparison mode is on (not just on hover) */
.mad-wrap.is-comparison .expand-icon {
    opacity: .75;
}
.mad-wrap .data-table th:hover .expand-icon { opacity: 1; }
.mad-wrap .expand-icon:hover { opacity: 1 !important; color: var(--primary); }
.mad-wrap .expand-icon.expanded {
    transform: rotate(90deg); opacity: 1 !important; color: var(--primary);
}
.mad-wrap .compare-header {
    background: #f8f9fa !important; border-left: 2px solid var(--border);
}
.mad-wrap .compare-col {
    background: #f8f9fa; border-left: 2px solid var(--border);
}
.mad-wrap .change-positive {
    color: #1a7a1a; font-weight: 600; background: #f0fff0;
    padding: 2px 6px; border-radius: 4px;
}
.mad-wrap .change-negative {
    color: #cc0000; font-weight: 600; background: #fff0f0;
    padding: 2px 6px; border-radius: 4px;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #f0f2f5; }
::-webkit-scrollbar-thumb { background: #c4c4c4; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #a0a0a0; }

/* ==========================================================================
   VERSION-WISE ANALYSIS (.vwa-) - scoped to avoid any clashes
   ========================================================================== */
.mad-wrap .vwa-root { padding: 0; }
.mad-wrap .vwa-controls {
    background: #fff; padding: 16px; border-radius: 8px;
    margin-bottom: 12px; box-shadow: var(--shadow);
    border: 1px solid var(--border-light, #e4e6eb);
}
.mad-wrap .vwa-controls-row {
    display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 12px;
}
.mad-wrap .vwa-controls-row:last-child { margin-bottom: 0; }
.mad-wrap .vwa-section-label {
    font-size: 12px; font-weight: 600; color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: .3px; margin-bottom: 8px;
    display: block;
}
.mad-wrap .vwa-version-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.mad-wrap .vwa-version-pill {
    padding: 6px 14px; border-radius: 20px; font-size: 12.5px;
    cursor: pointer; border: 1.5px solid var(--border);
    background: #fff; color: var(--text-primary); font-weight: 500;
    user-select: none; transition: all .15s; font-family: inherit;
}
.mad-wrap .vwa-version-pill:hover { border-color: var(--primary); }
.mad-wrap .vwa-version-pill.active {
    background: var(--primary); color: #fff; border-color: var(--primary);
}
.mad-wrap .vwa-metric-toggles { display: flex; flex-wrap: wrap; gap: 14px; }
.mad-wrap .vwa-metric-toggle {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 13px; cursor: pointer; user-select: none;
}
.mad-wrap .vwa-metric-toggle input { accent-color: var(--primary); width: 15px; height: 15px; }

.mad-wrap .vwa-campaign-card {
    background: #fff; border: 1px solid var(--border);
    border-radius: 8px; margin-bottom: 12px;
    box-shadow: var(--shadow);
    /* do NOT clip the per-card Columns dropdown (was overflow: hidden) */
}
.mad-wrap .vwa-campaign-header {
    display: flex; align-items: center; padding: 14px 18px;
    gap: 12px; cursor: pointer; background: #fafbfc;
    border-bottom: 1px solid var(--border-light, #e4e6eb);
    transition: background .15s;
    border-radius: 8px 8px 0 0;
    position: relative;   /* anchor for the absolute dropdown */
}
.mad-wrap .vwa-campaign-header:hover { background: #f2f3f5; }
.mad-wrap .vwa-campaign-icon { color: #e53e3e; font-size: 16px; }
.mad-wrap .vwa-campaign-name {
    font-weight: 600; font-size: 13.5px; flex: 1;
    color: var(--text-primary); overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
}
.mad-wrap .vwa-chevron {
    transition: transform .25s ease;
    color: var(--text-secondary); font-size: 12px;
}
.mad-wrap .vwa-chevron.expanded { transform: rotate(90deg); }
.mad-wrap .vwa-campaign-body { padding: 16px; overflow: hidden; }

/* Fix 2: smooth expand/collapse animation using max-height */
.mad-wrap .vwa-collapsible {
    overflow: hidden;
    transition: max-height .3s ease, opacity .25s ease, padding .25s ease;
}
.mad-wrap .vwa-collapsible.vwa-collapsed {
    max-height: 0 !important;
    opacity: 0;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
}
.mad-wrap .vwa-collapsible.vwa-expanded {
    max-height: 5000px;  /* large enough for any content */
    opacity: 1;
}

.mad-wrap .vwa-table-wrap { overflow-x: auto; }
.mad-wrap .vwa-table {
    width: 100%; border-collapse: separate; border-spacing: 0;
    font-size: 13px; min-width: 600px;
}
.mad-wrap .vwa-table th {
    background: #1565c0; color: #fff; font-weight: 600;
    font-size: 12px; padding: 10px 12px; text-align: left;
    white-space: nowrap; text-transform: uppercase; letter-spacing: .3px;
}
.mad-wrap .vwa-table th:first-child {
    position: sticky; left: 0; z-index: 3; background: #1565c0;
}
/* Version header sticks right after the entity header (offset set inline) */
.mad-wrap .vwa-table th.vwa-version-header {
    position: sticky; z-index: 2; background: #1565c0;
}
.mad-wrap .vwa-table td {
    padding: 9px 12px; border-bottom: 1px solid var(--border-light, #eef1f5);
    white-space: nowrap; font-variant-numeric: tabular-nums;
}
.mad-wrap .vwa-table tbody tr:nth-child(even) { background: #f8f9fa; }
.mad-wrap .vwa-table tbody tr:hover { background: #f0f7ff; }
/* Version body cell: sticky. The left offset is set inline per row
   based on the measured entity-cell width, so it lands flush against
   the entity column when the table scrolls horizontally. */
.mad-wrap .vwa-table .vwa-version-label {
    font-weight: 600; background: #fff; position: sticky; z-index: 2;
    border-right: 2px solid var(--border); color: var(--text-primary);
}
.mad-wrap .vwa-table tbody tr:nth-child(even) .vwa-version-label { background: #f8f9fa; }
.mad-wrap .vwa-table tbody tr:hover .vwa-version-label { background: #f0f7ff; }

.mad-wrap .vwa-trend-up { color: #1a7a1a; font-weight: 600; }
.mad-wrap .vwa-trend-down { color: #cc0000; font-weight: 600; }
.mad-wrap .vwa-trend-neutral { color: var(--text-secondary); font-weight: 500; }
.mad-wrap .vwa-trend-small { font-size: 11px; margin-left: 4px; font-weight: 500; }
.mad-wrap .vwa-no-data { color: #aaa; }
.mad-wrap .vwa-baseline-note { color: var(--text-secondary); font-size: 10.5px; margin-left: 4px; }

/* Entity (Campaign/Ad Set/Ad name) column with rowspan */
.mad-wrap .vwa-entity-cell {
    background: #eef2ff !important;
    border-right: 2px solid var(--primary) !important;
    font-weight: 700;
    color: var(--primary);
    vertical-align: middle !important;
    padding: 14px 16px !important;
    min-width: 520px;
    width: auto;              /* grows to fit content */
    white-space: nowrap;      /* keep name on one line */
    position: sticky;
    left: 0;
    z-index: 3;
}
.mad-wrap .vwa-entity-cell .vwa-entity-label-small {
    display: block;
    font-size: 9.5px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: .3px;
    font-weight: 700;
    margin-bottom: 4px;
}
.mad-wrap .vwa-entity-cell .vwa-entity-name {
    font-size: 12.5px;
    line-height: 1.35;
    color: var(--primary);
    white-space: nowrap;      /* one-line display */
    display: block;
    font-weight: 700;
}

/* ===================================================
   NOTES (Remark / Remark 2) columns
   =================================================== */
.mad-wrap .vwa-note-cell {
    vertical-align: middle !important;
    padding: 8px 10px !important;
    /* Default: fits the "+ Add note..." placeholder. Grows up to max-width
       when a note is present (table auto-layout picks the widest cell). */
    min-width: 90px;
    max-width: 220px;
    width: 1%;
    position: relative;
    transition: background .2s;
}
.mad-wrap .vwa-note-cell.r1 {
    background: #fffef5 !important;
    border-left: 2px solid #f59e0b !important;
}
.mad-wrap .vwa-note-cell.r2 {
    background: #f0f9ff !important;
    border-left: 2px solid #3b82f6 !important;
}
/* Preview mode */
.mad-wrap .vwa-note-preview {
    cursor: pointer;
    padding: 5px 7px;
    border-radius: 4px;
    min-height: 26px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    line-height: 1.45;
    color: #1e293b;
    transition: background .12s;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
}
.mad-wrap .vwa-note-cell.r1 .vwa-note-preview:hover { background: #fef3c7; }
.mad-wrap .vwa-note-cell.r2 .vwa-note-preview:hover { background: #dbeafe; }

.mad-wrap .vwa-note-preview-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
}
.mad-wrap .vwa-note-preview-empty {
    color: #94a3b8;
    font-style: italic;
    font-size: 11.5px;
}
.mad-wrap .vwa-note-count-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9.5px;
    font-weight: 700;
    color: #fff;
    padding: 1px 6px;
    border-radius: 10px;
    margin-left: 2px;
    flex-shrink: 0;
}
.mad-wrap .vwa-note-cell.r1 .vwa-note-count-pill { background: #f59e0b; }
.mad-wrap .vwa-note-cell.r2 .vwa-note-count-pill { background: #3b82f6; }

/* Hover tooltip — rendered via portal with inline fixed positioning,
   so it always appears above the cell and escapes overflow:hidden parents. */
.vwa-note-tooltip {
    min-width: 300px;
    max-width: 440px;
    background: #1e293b;
    color: #f1f5f9;
    border-radius: 8px;
    padding: 10px 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    font-size: 12px;
    z-index: 10000;
    pointer-events: none;
    white-space: normal;
    line-height: 1.45;
    font-family: inherit;
}
.vwa-note-tooltip::after {
    content: '';
    position: absolute;
    bottom: -6px;
    right: 16px;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid #1e293b;
}
.vwa-note-tooltip-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .5px;
    color: #94a3b8;
    margin-bottom: 6px;
    font-weight: 700;
    display: flex;
    justify-content: space-between;
}
.vwa-note-tooltip-item {
    padding: 6px 0;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.vwa-note-tooltip-item:last-child { border-bottom: none; }
.vwa-note-tooltip-user {
    font-weight: 700;
    color: #fbbf24;
    margin-right: 4px;
}
.vwa-note-tooltip.r2 .vwa-note-tooltip-user { color: #93c5fd; }
.vwa-note-tooltip-text {
    color: #e2e8f0;
    white-space: pre-wrap;
    word-break: break-word;
}
.vwa-note-tooltip-time {
    display: block;
    font-size: 10px;
    color: #94a3b8;
    margin-top: 2px;
}

/* Animated expanding editor — portaled to document.body so it never
   gets clipped by ancestors with overflow:hidden/auto. Positioning is
   set inline via fixed coordinates; these rules cover only appearance. */
.vwa-note-editor-overlay {
    background: #fff;
    border: 2px solid #3b82f6;
    border-radius: 8px;
    padding: 10px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.22);
    z-index: 10000;
    animation: vwa-editor-expand .22s cubic-bezier(.2,.9,.3,1.2);
    transform-origin: top right;
    font-family: inherit;
    box-sizing: border-box;
}
.vwa-note-editor-overlay.r1 { border-color: #f59e0b; }
.vwa-note-editor-overlay.r2 { border-color: #3b82f6; }

@keyframes vwa-editor-expand {
    from { opacity: 0; transform: scale(.6) translateY(-4px); }
    to   { opacity: 1; transform: scale(1)   translateY(0);  }
}

.vwa-note-editor-overlay .vwa-note-editor-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .4px;
    font-weight: 700;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
}
.vwa-note-editor-overlay.r1 .vwa-note-editor-label { color: #b45309; }
.vwa-note-editor-overlay.r2 .vwa-note-editor-label { color: #1d4ed8; }

.vwa-note-editor-overlay textarea {
    width: 100%;
    min-height: 90px;
    max-height: 260px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
    font-family: inherit;
    font-size: 12.5px;
    line-height: 1.45;
    resize: vertical;
    outline: none;
    box-sizing: border-box;
    background: #fafbfc;
}
.vwa-note-editor-overlay textarea:focus {
    background: #fff;
    border-color: #4f46e5;
}
.vwa-note-editor-overlay .vwa-note-editor-hint {
    font-size: 10.5px;
    color: #94a3b8;
    margin-top: 4px;
    margin-bottom: 6px;
}
.vwa-note-editor-overlay .vwa-note-editor-hint kbd {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-bottom-width: 2px;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    color: #475569;
}
.vwa-note-editor-overlay .vwa-note-editor-actions {
    display: flex;
    gap: 6px;
    margin-top: 2px;
    align-items: center;
}
.vwa-note-editor-overlay .vwa-note-editor-btn {
    padding: 5px 12px;
    border-radius: 5px;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    font-family: inherit;
    transition: opacity .12s, transform .12s;
}
.vwa-note-editor-overlay .vwa-note-editor-btn:hover { transform: translateY(-1px); }
.vwa-note-editor-overlay .vwa-note-editor-btn.save {
    background: #16a34a;
    color: #fff;
}
.vwa-note-editor-overlay .vwa-note-editor-btn.cancel {
    background: #e2e8f0;
    color: #475569;
}
.vwa-note-editor-overlay .vwa-note-editor-btn.history {
    background: transparent;
    color: #4f46e5;
    text-decoration: underline;
    padding: 5px 6px;
    margin-left: auto;
}
.vwa-note-editor-overlay .vwa-note-editor-btn:disabled {
    opacity: .5;
    cursor: not-allowed;
    transform: none !important;
}

/* Column headers use the remark color */
.mad-wrap .vwa-table th.vwa-remark-header-1 { background: #f59e0b !important; }
.mad-wrap .vwa-table th.vwa-remark-header-2 { background: #3b82f6 !important; }

/* History modal (reuse existing vwa-modal- classes, just tweak body) */
.mad-wrap .vwa-history-modal-body {
    max-height: 60vh;
}
.mad-wrap .vwa-history-entry {
    border-left: 3px solid var(--primary);
    padding: 10px 12px;
    margin-bottom: 10px;
    background: #f8fafc;
    border-radius: 0 6px 6px 0;
}
.mad-wrap .vwa-history-entry.create { border-left-color: #16a34a; }
.mad-wrap .vwa-history-entry.update { border-left-color: #f59e0b; }
.mad-wrap .vwa-history-entry.delete { border-left-color: #dc2626; }
.mad-wrap .vwa-history-meta {
    font-size: 11.5px;
    color: #64748b;
    margin-bottom: 6px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
}
.mad-wrap .vwa-history-action {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .3px;
}
.mad-wrap .vwa-history-action.create { background: #d1fae5; color: #065f46; }
.mad-wrap .vwa-history-action.update { background: #fef3c7; color: #92400e; }
.mad-wrap .vwa-history-action.delete { background: #fee2e2; color: #991b1b; }
.mad-wrap .vwa-history-user {
    font-weight: 700;
    color: #1e293b;
}
.mad-wrap .vwa-history-diff {
    font-size: 12px;
    margin-top: 4px;
}
.mad-wrap .vwa-history-old {
    color: #991b1b;
    text-decoration: line-through;
    text-decoration-color: #fca5a5;
    white-space: pre-wrap;
    margin-bottom: 4px;
}
.mad-wrap .vwa-history-new {
    color: #065f46;
    white-space: pre-wrap;
}

/* Notes filter switch placement */
.mad-wrap .vwa-notes-filter-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    background: #fffef5;
    border: 1px solid #f59e0b;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    color: #92400e;
    font-weight: 600;
    height: 36px;
}
.mad-wrap .vwa-notes-filter-toggle.is-on {
    background: #fef3c7;
    border-color: #d97706;
}

/* Adset / Ad nested sections */
.mad-wrap .vwa-adsets-wrap {
    margin-top: 16px; padding-left: 14px;
    border-left: 3px solid #dbeafe;
}
.mad-wrap .vwa-adset-card {
    background: #fafbff; border: 1px solid #e3e8f5;
    border-radius: 6px; margin-bottom: 10px; overflow: hidden;
}
.mad-wrap .vwa-adset-header {
    display: flex; align-items: center; padding: 10px 14px;
    gap: 10px; cursor: pointer; background: #eef3ff;
    transition: background .15s;
}
.mad-wrap .vwa-adset-header:hover { background: #dbeafe; }
.mad-wrap .vwa-adset-icon { color: #4a5568; font-size: 13px; }
.mad-wrap .vwa-adset-name {
    font-weight: 600; font-size: 12.5px; flex: 1;
    color: var(--text-primary); overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
}
.mad-wrap .vwa-adset-body { padding: 12px; background: #fff; }

.mad-wrap .vwa-ads-wrap {
    margin-top: 12px; padding-left: 12px;
    border-left: 3px solid #c7d2fe;
}
.mad-wrap .vwa-ad-card {
    background: #f4f6ff; border: 1px solid #d6dcf5;
    border-radius: 4px; margin-bottom: 8px; overflow: hidden;
}
.mad-wrap .vwa-ad-header {
    display: flex; align-items: center; padding: 8px 12px;
    gap: 8px; cursor: pointer; background: #e0e7ff;
}
.mad-wrap .vwa-ad-header:hover { background: #c7d2fe; }
.mad-wrap .vwa-ad-name {
    font-weight: 500; font-size: 12px; flex: 1;
    color: var(--text-primary); overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
}
.mad-wrap .vwa-ad-body { padding: 10px; background: #fafbff; }

/* Export button */
.mad-wrap .vwa-btn-export {
    padding: 5px 12px; background: #42b72a; color: #fff;
    border: none; border-radius: 4px; font-size: 11px;
    cursor: pointer; font-weight: 600; font-family: inherit;
    display: inline-flex; align-items: center; gap: 5px;
}
.mad-wrap .vwa-btn-export:hover { background: #36a01f; }

/* Skeleton loader */
.mad-wrap .vwa-skeleton-row {
    display: grid; grid-template-columns: 80px repeat(6, 1fr);
    gap: 10px; padding: 10px 0;
}
.mad-wrap .vwa-skeleton-cell {
    background: linear-gradient(90deg, #f0f0f0 25%, #e4e4e4 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: vwa-shimmer 1.3s infinite;
    height: 14px; border-radius: 3px;
}
@keyframes vwa-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.mad-wrap .vwa-empty {
    text-align: center; padding: 40px 20px;
    color: var(--text-secondary); background: #fff;
    border: 1px dashed var(--border); border-radius: 8px;
}
.mad-wrap .vwa-empty-icon { font-size: 36px; margin-bottom: 10px; color: #cbd5e1; }
.mad-wrap .vwa-empty-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: var(--text-primary); }

.mad-wrap .vwa-status-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 9px; border-radius: 10px;
    font-size: 10.5px; font-weight: 700; text-transform: uppercase;
}
.mad-wrap .vwa-status-badge::before {
    content: ''; width: 6px; height: 6px; border-radius: 50%;
    background: currentColor; display: inline-block;
}
.mad-wrap .vwa-status-active { background: #eafaf1; color: #1a7a45; }
.mad-wrap .vwa-status-paused, .mad-wrap .vwa-status-in-review { background: #fef9e7; color: #b7860e; }
.mad-wrap .vwa-status-inactive { background: #fef0f0; color: #b91c1c; }
.mad-wrap .vwa-status-unknown { background: #f3f4f6; color: #6b7280; }

/* Version Analysis: sticky controls bar + show-more + status filter + per-card toggles */
.mad-wrap .vwa-sticky-controls {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--bg-light);
    padding: 10px 0 12px;
    margin: 0 -4px 16px;
    box-shadow: 0 6px 14px -6px rgba(0,0,0,0.18);
}
.mad-wrap .vwa-sticky-controls .vwa-controls {
    margin-bottom: 0;
    border: 1px solid var(--border);
    background: #ffffff;
}
.mad-wrap .vwa-pills-wrap {
    position: relative;
    max-height: 120px;
    overflow: hidden;
    transition: max-height .25s ease;
}
.mad-wrap .vwa-pills-wrap.vwa-pills-expanded {
    max-height: 800px;
}
.mad-wrap .vwa-show-more-pill {
    padding: 6px 14px; border-radius: 20px; font-size: 12.5px;
    cursor: pointer; border: 1.5px dashed var(--primary);
    background: #fff; color: var(--primary); font-weight: 600;
    user-select: none; font-family: inherit;
    display: inline-flex; align-items: center; gap: 4px;
}
.mad-wrap .vwa-show-more-pill:hover { background: #e7f3ff; }

.mad-wrap .vwa-status-filter {
    min-width: 150px;
}
.mad-wrap .vwa-status-filter select {
    width: 100%;
    height: 36px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: #fff;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
}
.mad-wrap .vwa-status-filter select:focus {
    outline: none; border-color: var(--primary);
}

/* ======== SLIDING TOGGLE SWITCH (replaces checkboxes) ======== */
.mad-wrap .vwa-switch-item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #fafbfc;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12.5px;
    cursor: pointer;
    user-select: none;
    font-weight: 500;
    color: var(--text-primary);
    transition: background .15s, border-color .15s;
}
.mad-wrap .vwa-switch-item:hover { background: #f2f3f5; }
.mad-wrap .vwa-switch-item.is-on {
    background: #e7f3ff;
    border-color: var(--primary);
    color: var(--primary);
    font-weight: 600;
}
.mad-wrap .vwa-switch {
    position: relative;
    display: inline-block;
    width: 32px;
    height: 18px;
    flex-shrink: 0;
}
.mad-wrap .vwa-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
.mad-wrap .vwa-switch-slider {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: #cbd5e1;
    border-radius: 18px;
    cursor: pointer;
    transition: background .2s;
}
.mad-wrap .vwa-switch-slider::before {
    content: ''; position: absolute;
    height: 14px; width: 14px;
    left: 2px; bottom: 2px;
    background: #fff;
    border-radius: 50%;
    transition: transform .2s;
    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
.mad-wrap .vwa-switch input:checked + .vwa-switch-slider {
    background: var(--primary);
}
.mad-wrap .vwa-switch input:checked + .vwa-switch-slider::before {
    transform: translateX(14px);
}

/* ======== "SEE FINAL REPORTS" BUTTON ======== */
.mad-wrap .vwa-final-btn {
    padding: 8px 18px;
    background: linear-gradient(135deg, #42b72a, #2d9318);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    box-shadow: 0 2px 6px rgba(66, 183, 42, 0.35);
    transition: transform .15s, box-shadow .15s;
}
.mad-wrap .vwa-final-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(66, 183, 42, 0.45);
}
.mad-wrap .vwa-final-btn:disabled {
    background: #cbd5e1;
    color: #fff;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
}

/* ======== FINAL REPORT MODAL ======== */
.mad-wrap .vwa-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30px 20px;
    animation: vwa-fade-in .2s ease;
}
@keyframes vwa-fade-in { from { opacity: 0; } to { opacity: 1; } }
.mad-wrap .vwa-modal {
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.35);
    max-width: 1200px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: vwa-slide-up .25s ease;
}
@keyframes vwa-slide-up {
    from { opacity: 0; transform: translateY(20px) scale(.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}
.mad-wrap .vwa-modal-header {
    display: flex;
    align-items: center;
    padding: 18px 24px;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(135deg, #1877f2, #0f5fc0);
    color: #fff;
}
.mad-wrap .vwa-modal-title {
    font-size: 17px;
    font-weight: 700;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
}
.mad-wrap .vwa-modal-close {
    background: rgba(255,255,255,0.15);
    color: #fff;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
    font-family: inherit;
    transition: background .15s;
}
.mad-wrap .vwa-modal-close:hover { background: rgba(255,255,255,0.3); }
.mad-wrap .vwa-modal-body {
    padding: 20px 24px;
    overflow: auto;
    flex: 1;
}
.mad-wrap .vwa-modal-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 14px;
}
.mad-wrap .vwa-modal-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
    flex-wrap: wrap;
}
.mad-wrap .vwa-modal-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 13px;
}
.mad-wrap .vwa-modal-table th {
    background: #1877f2;
    color: #fff;
    font-weight: 600;
    font-size: 12px;
    padding: 10px 14px;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: .3px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
}
.mad-wrap .vwa-modal-table th:hover { background: #166fe5; }
.mad-wrap .vwa-modal-table th .sort-ind {
    margin-left: 6px;
    opacity: .5;
    font-size: 10px;
}
.mad-wrap .vwa-modal-table th.sort-active .sort-ind { opacity: 1; }
.mad-wrap .vwa-modal-table td {
    padding: 11px 14px;
    border-bottom: 1px solid #eef1f5;
    font-variant-numeric: tabular-nums;
}
.mad-wrap .vwa-modal-table tbody tr:nth-child(even) { background: #f8f9fa; }
.mad-wrap .vwa-modal-table tbody tr:hover { background: #e7f3ff; }
.mad-wrap .vwa-modal-table .vwa-rank {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px; height: 22px;
    border-radius: 50%;
    background: #cbd5e1;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    margin-right: 8px;
}
.mad-wrap .vwa-modal-table tr:first-child .vwa-rank { background: #f59e0b; }
.mad-wrap .vwa-modal-table tr:nth-child(2) .vwa-rank { background: #64748b; }
.mad-wrap .vwa-modal-table tr:nth-child(3) .vwa-rank { background: #b45309; }
.mad-wrap .vwa-modal-table .vwa-version-cell {
    font-weight: 700;
    color: var(--primary);
}
.mad-wrap .vwa-modal-sort-select {
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: #fff;
    font-size: 12.5px;
    font-family: inherit;
}

/* Per-card metric dropdown */
.mad-wrap .vwa-card-metric-btn {
    padding: 4px 10px;
    background: #fff;
    color: var(--primary);
    border: 1px solid var(--primary);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    position: relative;
}
.mad-wrap .vwa-card-metric-btn:hover { background: #e7f3ff; }
.mad-wrap .vwa-card-metric-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0,0,0,.2);
    padding: 10px;
    z-index: 1000;
    min-width: 200px;
    max-height: 420px;
    overflow-y: auto;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.mad-wrap .vwa-card-metric-dropdown .vwa-switch-item {
    padding: 5px 8px;
    font-size: 12px;
}

/* Clickable "Load Ad Sets" / "Load Ads" button */
.mad-wrap .vwa-load-more {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #f0f7ff;
    border: 1px dashed var(--primary);
    border-radius: 6px;
    cursor: pointer;
    color: var(--primary);
    font-weight: 600;
    font-size: 12.5px;
    margin-top: 10px;
    transition: background .15s;
    font-family: inherit;
    width: 100%;
    justify-content: center;
}
.mad-wrap .vwa-load-more:hover { background: #e0ecff; }
.mad-wrap .vwa-load-more i { transition: transform .2s; }
.mad-wrap .vwa-load-more.loaded i { transform: rotate(90deg); }

/* =====================================================================
   DAY / VERSION WISE ANALYSIS — modern design, matches main Meta theme
   ===================================================================== */
.mad-wrap .dv-view { padding-bottom: 40px; }

.mad-wrap .dv-controls-sticky {
    /* Admin layout has a fixed/sticky top bar (height ~62px, z-index 400),
       so offset by 70px to leave a small gap below it. */
    position: sticky;
    top: 70px;
    z-index: 60;
    background: var(--bg-light);
    padding: 8px 0 14px;
    margin: 0 -4px 18px;
}
.mad-wrap .dv-controls-sticky::before {
    /* Soft fade behind the sticky bar so table rows don't peek through
       above it while scrolling. */
    content: '';
    position: absolute;
    left: 0; right: 0; top: -10px; height: 10px;
    background: linear-gradient(180deg, var(--bg-light) 0%, rgba(240,242,245,0) 100%);
    pointer-events: none;
}
.mad-wrap .dv-controls {
    border: 1px solid var(--border);
    background: #fff;
    border-radius: 10px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 4px 14px -10px rgba(24,119,242,.18);
}
.mad-wrap .dv-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.mad-wrap .dv-row-spread { justify-content: space-between; }
.mad-wrap .dv-divider {
    height: 1px; background: var(--border); margin: 2px 0; border: 0;
}
.mad-wrap .dv-section-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary);
    letter-spacing: .05em;
    text-transform: uppercase;
    margin-right: 4px;
}

/* Segmented input-mode (replaces radio) */
.mad-wrap .dv-segmented {
    display: inline-flex;
    background: #eef2f7;
    padding: 3px;
    border-radius: 8px;
    border: 1px solid var(--border);
}
.mad-wrap .dv-segmented button {
    appearance: none; border: 0; background: transparent;
    padding: 6px 14px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
    font-family: inherit;
    display: inline-flex; align-items: center; gap: 6px;
    transition: all .15s;
}
.mad-wrap .dv-segmented button:hover:not(.is-on) { color: var(--text-primary); }
.mad-wrap .dv-segmented button.is-on {
    background: #fff;
    color: var(--primary);
    box-shadow: 0 1px 3px rgba(0,0,0,.08);
}
.mad-wrap .dv-segmented button:disabled {
    opacity: .45; cursor: not-allowed;
}

.mad-wrap .dv-view-toggle {
    display: inline-flex; align-items: center; gap: 10px;
}
.mad-wrap .dv-label-text {
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .05em;
}

/* Generic ghost button */
.mad-wrap .dv-ghost-btn {
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: #fff;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    color: var(--text-primary);
    font-family: inherit;
    transition: all .15s;
    display: inline-flex; align-items: center; gap: 6px;
}
.mad-wrap .dv-ghost-btn:hover:not(:disabled) {
    background: var(--bg-selected);
    border-color: var(--primary);
    color: var(--primary);
}
.mad-wrap .dv-ghost-btn:disabled { opacity: .45; cursor: not-allowed; }

/* Version pills (match vwa-version-pill) */
.mad-wrap .dv-pills-wrap {
    display: flex; flex-wrap: wrap; gap: 6px;
    max-height: 44px;
    overflow: hidden;
    transition: max-height .25s ease;
    flex: 1;
    min-width: 0;
}
.mad-wrap .dv-pills-wrap.dv-pills-expanded { max-height: 600px; }
.mad-wrap .dv-pill {
    padding: 6px 14px;
    border-radius: 20px;
    border: 1.5px solid var(--border);
    background: #fff;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-primary);
    cursor: pointer;
    font-family: inherit;
    transition: all .15s;
    user-select: none;
}
.mad-wrap .dv-pill:hover { border-color: var(--primary); }
.mad-wrap .dv-pill.is-on {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;
    font-weight: 600;
}
.mad-wrap .dv-show-more-pill {
    padding: 6px 14px;
    border-radius: 20px;
    border: 1.5px dashed var(--primary);
    background: #fff;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--primary);
    cursor: pointer;
    font-family: inherit;
}
.mad-wrap .dv-show-more-pill:hover { background: var(--bg-selected); }
.mad-wrap .dv-clear-btn {
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    display: inline-flex; align-items: center; gap: 5px;
}
.mad-wrap .dv-clear-btn:hover { background: #fee2e2; }

.mad-wrap .dv-date-range { display: flex; gap: 14px; align-items: flex-end; }
.mad-wrap .dv-date-range label {
    display: flex; flex-direction: column; gap: 5px;
    font-size: 11px; font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: .04em;
}
.mad-wrap .dv-date-range input {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: inherit;
    font-size: 13px;
    background: #fff;
    color: var(--text-primary);
    height: 36px;
}
.mad-wrap .dv-date-range input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(24,119,242,.1);
}

/* Columns dropdown */
.mad-wrap .dv-col-menu-wrap { position: relative; }
.mad-wrap .dv-col-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    z-index: 70;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 12px 32px -10px rgba(0,0,0,.18);
    padding: 10px;
    min-width: 300px;
    max-height: 360px;
    overflow-y: auto;
}
.mad-wrap .dv-col-menu-head {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: .05em;
    padding: 4px 8px 8px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 6px;
}
.mad-wrap .dv-col-menu-item {
    display: flex; gap: 10px; align-items: center;
    padding: 7px 8px;
    font-size: 13px;
    cursor: pointer;
    border-radius: 6px;
    color: var(--text-primary);
}
.mad-wrap .dv-col-menu-item:hover { background: var(--bg-selected); }
.mad-wrap .dv-col-menu-item input { accent-color: var(--primary); width: 15px; height: 15px; }
.mad-wrap .dv-col-menu-foot {
    border-top: 1px solid var(--border);
    padding-top: 8px; margin-top: 6px;
    display: flex; justify-content: space-between; gap: 8px;
}
.mad-wrap .dv-badge {
    margin-left: 4px;
    padding: 1px 7px;
    border-radius: 10px;
    background: var(--primary);
    color: #fff;
    font-size: 10.5px;
    font-weight: 700;
}

/* Primary "Load" button — matches btn-primary style */
.mad-wrap .dv-load-btn {
    padding: 9px 22px;
    border-radius: 8px;
    background: var(--primary);
    color: #fff;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    font-family: inherit;
    display: inline-flex; align-items: center; gap: 8px;
    height: 38px;
    transition: background .15s;
    box-shadow: 0 1px 2px rgba(24,119,242,.2);
}
.mad-wrap .dv-load-btn:hover:not(:disabled) { background: var(--primary-hover); }
.mad-wrap .dv-load-btn:disabled { opacity: .55; cursor: not-allowed; }

/* Download button — green Excel-style, sits in the result bar above the table */
.mad-wrap .dv-download-btn {
    padding: 7px 14px;
    border-radius: 8px;
    background: #1f7a4d;
    color: #fff;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 12.5px;
    font-family: inherit;
    display: inline-flex; align-items: center; gap: 7px;
    transition: background .15s, transform .08s;
    box-shadow: 0 1px 2px rgba(31,122,77,.25);
}
.mad-wrap .dv-download-btn:hover { background: #186640; }
.mad-wrap .dv-download-btn:active { transform: translateY(1px); }
.mad-wrap .dv-download-btn i { font-size: 14px; }

/* Empty state */
.mad-wrap .dv-empty {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 64px 20px;
    text-align: center;
    box-shadow: var(--shadow);
}
.mad-wrap .dv-empty-icon {
    width: 64px; height: 64px;
    margin: 0 auto 14px;
    border-radius: 50%;
    background: var(--bg-selected);
    color: var(--primary);
    display: flex; align-items: center; justify-content: center;
    font-size: 28px;
}
.mad-wrap .dv-empty-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.mad-wrap .dv-empty-hint  { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

/* ---------- Table ----------
   Sticky-thead strategy: we put position:sticky on each TH and use the PAGE
   as the scroll context. That means NO ancestor of the table can have any
   form of overflow set (auto/scroll/hidden) — that would create an implicit
   scroll container and detach sticky from the page. */
.mad-wrap .dv-table-wrap {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 1px 2px rgba(0,0,0,.04);
    overflow: visible;
}
.mad-wrap .dv-table {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    table-layout: fixed;
}
.mad-wrap .dv-table thead th {
    /* Sticky relative to page scroll. Offset set at runtime via
       --dv-thead-top (controls bar height + admin bar). */
    position: sticky;
    top: var(--dv-thead-top, 240px);
    z-index: 5;
    background: linear-gradient(180deg, #1976d2 0%, #1565c0 100%);
    color: #fff;
    text-align: left;
    padding: 12px 14px;
    font-weight: 600;
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: .4px;
    border-right: 1px solid rgba(255,255,255,.12);
    border-bottom: 1px solid rgba(0,0,0,.06);
    white-space: normal;
    line-height: 1.3;
    user-select: none;
}
.mad-wrap .dv-table thead th:last-child { border-right: 0; }
.mad-wrap .dv-table tbody td {
    padding: 11px 14px;
    border-bottom: 1px solid var(--border-light, #eef1f5);
    border-right: 1px solid #f3f5f8;
    vertical-align: top;
    color: var(--text-primary);
}
.mad-wrap .dv-table tbody td:last-child { border-right: 0; }
.mad-wrap .dv-table tbody tr { transition: background .12s; }
.mad-wrap .dv-table tbody tr:nth-child(even) td.dv-base-bg { background: #fafbfc; }
.mad-wrap .dv-table tbody tr:hover td.dv-base-bg { background: #f0f7ff; }

.mad-wrap .dv-table tfoot td {
    padding: 12px 14px;
    background: #eef2f7;
    font-weight: 700;
    border-top: 2px solid var(--primary);
    color: var(--text-primary);
    border-right: 1px solid #e3e8ef;
}
.mad-wrap .dv-table tfoot td:last-child { border-right: 0; }
.mad-wrap .dv-summary-total td {
    background: #dbe7f4;
    border-bottom: 0;
}

.mad-wrap .dv-table .dv-sticky-col {
    position: sticky;
    left: 0;
    z-index: 4;
    background: #fff;
    border-right: 2px solid var(--primary) !important;
}
.mad-wrap .dv-table thead th.dv-sticky-col {
    z-index: 6;
    background: linear-gradient(180deg, #1976d2 0%, #1565c0 100%);
}
.mad-wrap .dv-table tbody tr:nth-child(even) td.dv-sticky-col { background: #fafbfc; }
.mad-wrap .dv-table tbody tr:hover td.dv-sticky-col { background: #f0f7ff; }
.mad-wrap .dv-table tfoot td.dv-sticky-col { background: #eef2f7; }
.mad-wrap .dv-table tfoot .dv-summary-total td.dv-sticky-col { background: #dbe7f4; }

/* Label column */
.mad-wrap .dv-label-cell { display: flex; flex-direction: column; gap: 2px; }
.mad-wrap .dv-label-date { font-weight: 700; color: var(--text-primary); font-size: 13px; }
.mad-wrap .dv-label-ver  {
    font-size: 10.5px; color: var(--primary); font-weight: 600;
    background: var(--bg-selected);
    padding: 2px 7px; border-radius: 10px;
    align-self: flex-start;
    letter-spacing: .02em;
}

/* Stacked block cells */
.mad-wrap .dv-block { display: flex; flex-direction: column; gap: 2px; line-height: 1.3; }
.mad-wrap .dv-block-count { font-weight: 700; font-size: 13px; }
.mad-wrap .dv-block-pct   { font-size: 11px; opacity: .85; font-weight: 500; }
.mad-wrap .dv-block-cost  { font-size: 11px; opacity: .75; font-weight: 500; }

/* Footer summary labels look distinct */
.mad-wrap .dv-summary-label {
    display: inline-flex; align-items: center; gap: 6px;
    font-weight: 700;
    color: var(--primary);
    text-transform: uppercase;
    letter-spacing: .04em;
    font-size: 12px;
}
.mad-wrap .dv-summary-total .dv-summary-label { color: #0d47a1; }

/* ---------- Heatmap bands ----------
   Softer pastel palette so text stays readable and matches the FB-blue
   theme better than the saturated red/green of the reference. */
.mad-wrap .dv-band-1 { background: #fde7e9 !important; color: #b3261e !important; }
.mad-wrap .dv-band-2 { background: #fdebd0 !important; color: #a55a00 !important; }
.mad-wrap .dv-band-3 { background: #fff8dc !important; color: #7a5a00 !important; }
.mad-wrap .dv-band-4 { background: #e3f3da !important; color: #2f6a1f !important; }
.mad-wrap .dv-band-5 { background: #d4eede !important; color: #0d6e3a !important; }

.mad-wrap .dv-band-1 .dv-block-pct,
.mad-wrap .dv-band-1 .dv-block-cost { color: #b3261e; }
.mad-wrap .dv-band-2 .dv-block-pct,
.mad-wrap .dv-band-2 .dv-block-cost { color: #a55a00; }
.mad-wrap .dv-band-3 .dv-block-pct,
.mad-wrap .dv-band-3 .dv-block-cost { color: #7a5a00; }
.mad-wrap .dv-band-4 .dv-block-pct,
.mad-wrap .dv-band-4 .dv-block-cost { color: #2f6a1f; }
.mad-wrap .dv-band-5 .dv-block-pct,
.mad-wrap .dv-band-5 .dv-block-cost { color: #0d6e3a; }

/* Tiny trend dot on the right edge of each cell, for quick scanning */
.mad-wrap .dv-band-1::after,
.mad-wrap .dv-band-2::after,
.mad-wrap .dv-band-3::after,
.mad-wrap .dv-band-4::after,
.mad-wrap .dv-band-5::after {
    content: '';
    position: absolute;
    right: 6px; top: 50%;
    width: 6px; height: 6px;
    border-radius: 50%;
    transform: translateY(-50%);
    opacity: .8;
}
.mad-wrap .dv-table tbody td { position: relative; }
.mad-wrap .dv-band-1::after { background: #ef4444; }
.mad-wrap .dv-band-2::after { background: #f59e0b; }
.mad-wrap .dv-band-3::after { background: #eab308; }
.mad-wrap .dv-band-4::after { background: #84cc16; }
.mad-wrap .dv-band-5::after { background: #22c55e; }

/* Column resize handle */
.mad-wrap .dv-col-resizer {
    position: absolute;
    top: 0; right: 0;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    user-select: none;
    z-index: 2;
}
.mad-wrap .dv-col-resizer:hover,
.mad-wrap .dv-col-resizer.resizing {
    background: rgba(255,255,255,.5);
}

/* Subtle results count chip above the table */
.mad-wrap .dv-result-bar {
    display: flex; justify-content: space-between; align-items: center;
    margin: 4px 2px 10px;
    font-size: 12px;
    color: var(--text-secondary);
}
.mad-wrap .dv-result-chip {
    background: var(--bg-selected);
    color: var(--primary);
    padding: 4px 10px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 11.5px;
}
.mad-wrap .dv-legend { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.mad-wrap .dv-legend-item {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; color: var(--text-secondary);
}
.mad-wrap .dv-legend-dot {
    width: 10px; height: 10px; border-radius: 3px;
    display: inline-block;
}
`;

/* =========================================================================
   5. MAIN COMPONENT
   ========================================================================= */
export default function MetaAdsDashboard({
    apiUrl = 'https://cit3.internshipstudio.com/admin/react-api/api/reports/meta_ads.php',
    user = null,   // { id, name } — pass from AdminLayout's useAuth()
    canAccessRemark2 = true,  // pass hasPermission('meta_remark2_access') from parent
}) {
    // Normalize user object so the notes feature always has something to send.
    // Different auth systems use different field names, so we check the common ones.
    // If no user is passed we fall back to id=0/name='Anonymous' and notes
    // will still work but ownership will be unclear.
    const noteUser = {
        id: Number(
            (user && (user.id ?? user.user_id ?? user.uid ?? user.ID ?? user._id)) || 0
        ),
        name: String(
            (user && (user.name ?? user.full_name ?? user.username ?? user.email)) || 'Anonymous'
        ),
    };
    // Debug: log once so you can verify the user prop arrived correctly
    useEffect(() => {
        if (user !== null && user !== undefined) {
            // eslint-disable-next-line no-console
            console.log('[MetaAdsDashboard] user prop received:', user, '-> noteUser:', noteUser);
        } else {
            // eslint-disable-next-line no-console
            console.warn('[MetaAdsDashboard] no user prop was passed. Notes save will fail. '
                + 'Pass user from your auth context, e.g. <MetaAdsDashboard user={user} />');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ---------- Refs (non-reactive raw data) ---------- */
    const allMetaRawRef       = useRef([]);
    const campaignStatusMap   = useRef({});
    const campaignEventMap    = useRef({});
    const adsetsFromMetaRef   = useRef([]);
    const adsFromMetaRef      = useRef([]);
    const tableWrapperRef     = useRef(null);
    const footerWrapperRef    = useRef(null);
    const searchBlurTimerRef  = useRef(null);

    /* ---------- Core state ---------- */
    const [citVersions, setCitVersions] = useState([]);
    const [selectedCit, setSelectedCit] = useState('');
    const [perPage, setPerPage]         = useState(100);

    const [confirmedFrom,        setConfirmedFrom]        = useState('');
    const [confirmedTo,          setConfirmedTo]          = useState('');
    const [confirmedFromTime,    setConfirmedFromTime]    = useState('');
    const [confirmedToTime,      setConfirmedToTime]      = useState('');
    const [confirmedCompareFrom, setConfirmedCompareFrom] = useState('');
    const [confirmedCompareTo,   setConfirmedCompareTo]   = useState('');
    const [isComparison,         setIsComparison]         = useState(false);

    const [campaignData, setCampaignData] = useState([]);
    const [adsetData,    setAdsetData]    = useState([]);
    const [adData,       setAdData]       = useState([]);

    const [currentLevel, setCurrentLevel] = useState('campaign');

    /* selections are kept in a ref + a counter to trigger rerenders
       (Set mutation is faster than rebuilding immutable structures) */
    const selectedCampaignNamesRef = useRef(new Set());
    const selectedAdsetNamesRef    = useRef(new Set());
    const selectedAdNamesRef       = useRef(new Set());
    const [selectionTick, setSelectionTick] = useState(0);
    const bumpSelection = useCallback(() => setSelectionTick(t => t + 1), []);

    /* search / sort / filter */
    const [searchTerm, setSearchTerm]           = useState('');
    const [searchMode, setSearchMode]           = useState('campaign');
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [sortField,     setSortField]     = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');

    const [columnFilters, setColumnFilters]       = useState({});
    const [activeFilterColumn, setActiveFilterColumn] = useState(null);
    const [filterDropdown, setFilterDropdown]     = useState({ open: false, x: 0, y: 0 });
    const [filterSearchTerm, setFilterSearchTerm] = useState('');
    const [pendingFilterValues, setPendingFilterValues] = useState([]);

    /* comparison expanded columns */
    const [expandedColumns, setExpandedColumns] = useState(new Set());

    /* ==================================================================
       VERSION ANALYSIS STATE (per PDF spec)
       ================================================================== */
    const [selectedVersionsVA, setSelectedVersionsVA] = useState([]);
    const [selectedMetricsVA,  setSelectedMetricsVA]  = useState(
        new Set(['cpm','cpc','ctr','cpl','cost_per_exam','roi','spend'])
    );
    const [vaCampaigns,        setVaCampaigns]        = useState([]);
    const [vaLoading,          setVaLoading]          = useState(false);
    const [vaSearchTerm,       setVaSearchTerm]       = useState('');

    /* accordion state (Sets of string keys) */
    const [expandedCampaignsVA, setExpandedCampaignsVA] = useState(new Set());
    const [expandedAdsetsVA,    setExpandedAdsetsVA]    = useState(new Set());

    /* lazy-load caches */
    const [adsetsCacheVA,   setAdsetsCacheVA]   = useState({}); // { campaignName: [...adsets] }
    const [adsCacheVA,      setAdsCacheVA]      = useState({}); // { "camp|||adset": [...ads] }
    const [loadingAdsetsVA, setLoadingAdsetsVA] = useState(new Set());
    const [loadingAdsVA,    setLoadingAdsVA]    = useState(new Set());

    /* NEW: user-initiated load tracking (don't auto-refetch on collapse/re-expand) */
    const [loadedAdsetsVA, setLoadedAdsetsVA] = useState(new Set()); // campaigns whose adsets user has clicked Load
    const [loadedAdsVA,    setLoadedAdsVA]    = useState(new Set()); // "camp|||adset" keys

    /* NEW: show more pills (start collapsed) */
    const [pillsExpandedVA, setPillsExpandedVA] = useState(false);

    /* NEW: status filter (all / active / paused / inactive / unknown) */
    const [statusFilterVA, setStatusFilterVA] = useState('all');

    /* NEW: per-card metric overrides. Map of campaignName -> Set(metricKey)
       If a campaign is NOT in this map, global metrics apply.
       If it IS in the map, only those keys are shown for that card. */
    const [perCardMetricsVA, setPerCardMetricsVA] = useState({});

    /* NEW: Final Reports modal */
    const [finalReportOpen, setFinalReportOpen] = useState(false);
    const [finalReportSort, setFinalReportSort] = useState({ key: 'roi', dir: 'desc' });

    /* ==================================================================
       NOTES FEATURE STATE
       allNotes: { "entityType|||entityName": [ {id, user_id, user_name, note, updated_at}, ... ] }
       notesFilter: when true, only show entities that have at least one note
       ================================================================== */
    const [allNotes, setAllNotes] = useState({});
    const [notesFilter, setNotesFilter] = useState(false);
    const [noteHistory, setNoteHistory] = useState(null); // { entity, rows } when history modal open

    /* ==================================================================
       DAY / VERSION ANALYSIS STATE
       Controls the new "Day_Version wise Analysis" tab.
       inputModeDV  : 'versions' (pick CIT versions) | 'daterange' (free range)
       viewModeDV   : 'version'  (one row / version)  | 'day' (one row / day)
       Notes:
         - When inputModeDV === 'daterange', viewModeDV is forced to 'day'.
         - When versions are picked + viewModeDV === 'day', backend expands
           each version's range into per-day rows under that version.
       ================================================================== */
    const [inputModeDV,        setInputModeDV]        = useState('versions');
    const [selectedVersionsDV, setSelectedVersionsDV] = useState([]);
    const [dvFromDate,         setDvFromDate]         = useState('');
    const [dvToDate,           setDvToDate]           = useState('');
    const [viewModeDV,         setViewModeDV]         = useState('version');
    const [dvRows,             setDvRows]             = useState([]);
    const [dvLoading,          setDvLoading]          = useState(false);
    const [dvPillsExpanded,    setDvPillsExpanded]    = useState(false);
    // Column show/hide. Keys map to DV_COLUMNS below.
    const [dvHiddenCols, setDvHiddenCols] = useState(new Set());
    const [dvColMenuOpen, setDvColMenuOpen] = useState(false);

    /* ==================================================================
       COLUMN RESIZE (mirrors the original JS implementation)
       Attaches a drag-handle .col-resizer to each thead th after render,
       listens to mousedown, and imperatively sets width on th+td of that
       column. No React state churn during the drag (smooth).
       ================================================================== */
    const dataTableRef = useRef(null);
    const footerTableRef = useRef(null);

    useEffect(() => {
        const table = dataTableRef.current;
        if (!table) return;
        const footerTable = footerTableRef.current;
        const wrap = table.closest('.mad-wrap');

        // Attach resizer divs to every thead th (skip if already present)
        const headers = table.querySelectorAll('thead th');
        headers.forEach(th => {
            if (th.querySelector('.col-resizer')) return;
            const resizer = document.createElement('div');
            resizer.className = 'col-resizer';
            // Stop click bubbling so th.onClick (sort) does not fire after a resize
            resizer.addEventListener('click', (ev) => { ev.stopPropagation(); });
            th.appendChild(resizer);
        });

        let startX = 0, startWidth = 0, colIndex = -1, activeResizer = null;

        const onMouseMove = (e) => {
            if (colIndex < 0) return;
            const newW = Math.max(60, startWidth + (e.pageX - startX));

            // Apply to every cell in that column (thead + tbody)
            const selector = `th:nth-child(${colIndex + 1}), td:nth-child(${colIndex + 1})`;
            table.querySelectorAll(selector).forEach(el => {
                el.style.width    = newW + 'px';
                el.style.minWidth = newW + 'px';
                el.style.maxWidth = newW + 'px';
            });
            if (footerTable) {
                footerTable.querySelectorAll(`td:nth-child(${colIndex + 1})`).forEach(el => {
                    el.style.width    = newW + 'px';
                    el.style.minWidth = newW + 'px';
                    el.style.maxWidth = newW + 'px';
                });
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (activeResizer) activeResizer.classList.remove('resizing');
            if (wrap) wrap.classList.remove('is-resizing');
            // Suppress the sort-click that fires on mouseup after a drag
            window.__madJustResized = true;
            setTimeout(() => { window.__madJustResized = false; }, 100);
            colIndex = -1;
            activeResizer = null;
        };

        const onMouseDown = (e) => {
            const resizer = e.target;
            if (!resizer.classList || !resizer.classList.contains('col-resizer')) return;
            e.preventDefault();
            e.stopPropagation();
            const th = resizer.parentElement;
            colIndex = Array.prototype.indexOf.call(th.parentElement.children, th);
            startX = e.pageX;
            startWidth = th.offsetWidth;
            activeResizer = resizer;
            resizer.classList.add('resizing');
            if (wrap) wrap.classList.add('is-resizing');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        // Delegate via thead so new columns (added when comparison expands) get handled too
        const thead = table.querySelector('thead');
        if (thead) thead.addEventListener('mousedown', onMouseDown);

        return () => {
            if (thead) thead.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [currentLevel, isComparison, expandedColumns]); // re-attach when thead structure changes

    /* token box */
    const [showTokenBox, setShowTokenBox] = useState(false);
    const [newToken,     setNewToken]     = useState('');

    /* alerts */
    const [alert, setAlert] = useState(null);
    const alertTimerRef = useRef(null);
    const showAlert = useCallback((message, type = 'error') => {
        setAlert({ message, type });
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = setTimeout(() => setAlert(null), 5000);
    }, []);

    /* loading */
    const [loading, setLoading] = useState(false);

    /* phase-2 background load flag (UI only) */
    const [phase2Loading, setPhase2Loading] = useState(false);

    /* =====================================================================
       DATE PICKER STATE
       ===================================================================== */
    const [dpOpen, setDpOpen] = useState(false);
    const [dpFromDate, setDpFromDate] = useState(null);
    const [dpToDate,   setDpToDate]   = useState(null);
    const [dpTempFrom, setDpTempFrom] = useState(null);
    const [dpTempTo,   setDpTempTo]   = useState(null);
    const [dpViewMonth, setDpViewMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [dpActivePreset, setDpActivePreset] = useState(null);

    const [dpCompareFromDate, setDpCompareFromDate] = useState(null);
    const [dpCompareToDate,   setDpCompareToDate]   = useState(null);
    const [dpTempCompareFrom, setDpTempCompareFrom] = useState(null);
    const [dpTempCompareTo,   setDpTempCompareTo]   = useState(null);
    const [dpCompareViewMonth, setDpCompareViewMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [dpTempIsComparison, setDpTempIsComparison] = useState(false);

    /* =====================================================================
       ACTION: get_cit_versions + get_date_range
       ===================================================================== */
    const loadCitVersions = useCallback(async () => {
        try {
            const data = await apiAction(apiUrl, 'get_cit_versions');
            if (data.success && data.versions.length > 0) {
                setCitVersions(data.versions);
                setSelectedCit(data.versions[0]);
                await loadDateRange(data.versions[0], true);
            } else {
                showAlert('No CIT versions found');
            }
        } catch (e) {
            showAlert('Error loading CIT versions: ' + e.message);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl]);

    const loadDateRange = useCallback(async (citVersion, autoFetch = false) => {
        try {
            const data = await apiAction(apiUrl, 'get_date_range', { cit_version: citVersion });
            if (data.success) {
                setDpFromDate(parseYMD(data.from_date));
                setDpToDate(parseYMD(data.to_date));
                setConfirmedFrom(data.from_date);
                setConfirmedTo(data.to_date);
                setConfirmedFromTime(data.from_time || '');
                setConfirmedToTime(data.to_time || '');
                if (autoFetch) {
                    setTimeout(() => {
                        fetchAnalyticsRef.current(citVersion, data.from_date, data.to_date);
                    }, 0);
                }
            } else {
                showAlert(data.message || 'Error loading date range');
            }
        } catch (e) {
            showAlert('Error loading date range: ' + e.message);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl]);

    /* Keep the latest fetchAnalytics in a ref for autoFetch callback */
    const fetchAnalyticsRef = useRef(null);

    /* =====================================================================
       ACTION: fetch_analytics_phase1 (fast) + phase2 (background)
       ===================================================================== */
    const fetchAnalytics = useCallback(async (overrideCit = null, overrideFrom = null, overrideTo = null) => {
        const cit  = overrideCit  ?? selectedCit;
        const from = overrideFrom ?? confirmedFrom;
        const to   = overrideTo   ?? confirmedTo;

        if (!cit || !from || !to) {
            showAlert('Please select CIT version and date range');
            return;
        }

        setLoading(true);

        /* reset phase-2 caches */
        campaignStatusMap.current = {};
        campaignEventMap.current  = {};
        adsFromMetaRef.current    = [];
        adsetsFromMetaRef.current = [];
        setPhase2Loading(true);

        try {
            const params = {
                cit_version: cit,
                from_date: from,
                to_date: to,
                per_page: perPage,
            };
            if (isComparison && confirmedCompareFrom && confirmedCompareTo) {
                params.compare_from_date = confirmedCompareFrom;
                params.compare_to_date   = confirmedCompareTo;
            }

            const data = await apiAction(apiUrl, 'fetch_analytics_phase1', params);

            if (data.token_expired) {
                showAlert('Meta Access Token Expired. Please update token.');
                setShowTokenBox(true);
                setLoading(false);
                setPhase2Loading(false);
                return;
            }

            if (data.success) {
                const rows = (data.data || []).map(row => {
                    const imp = row.impressions || 0;
                    return {
                        ...row,
                        cpm: imp > 0 ? (row.spend / imp * 1000) : 0,
                        exam_percent: row.registrations > 0 ? ((row.exam_count / row.registrations) * 100) : 0,
                        delivery_status:  'LOADING',
                        conversion_event: 'LOADING',
                    };
                });

                setCampaignData(rows);
                allMetaRawRef.current = data.meta_raw || [];
                setIsComparison(!!data.is_comparison);

                /* reset selections and dependent tables */
                selectedCampaignNamesRef.current.clear();
                selectedAdsetNamesRef.current.clear();
                selectedAdNamesRef.current.clear();
                bumpSelection();
                setAdsetData([]);
                setAdData([]);
                setCurrentLevel('campaign');
                setSortField(null);
                setSortDirection('asc');
                setColumnFilters({});
                setSearchTerm('');
                setExpandedColumns(new Set());

                if (rows.length === 0) {
                    showAlert('No data found for the selected filters', 'success');
                } else {
                    showAlert(`Loaded ${rows.length} campaigns. Fetching delivery status...`, 'success');
                }

                /* kick off phase 2 in the background */
                fetchPhase2(cit, from, to);
            } else {
                showAlert(data.message || 'Error fetching data');
            }
        } catch (e) {
            showAlert('Error: ' + e.message);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl, selectedCit, confirmedFrom, confirmedTo, perPage, isComparison, confirmedCompareFrom, confirmedCompareTo]);

    /* update ref so loadDateRange auto-fetch works */
    useEffect(() => { fetchAnalyticsRef.current = fetchAnalytics; }, [fetchAnalytics]);

    const fetchPhase2 = useCallback(async (cit, from, to) => {
        try {
            const data = await apiAction(apiUrl, 'fetch_analytics_phase2', {
                cit_version: cit,
                from_date: from,
                to_date: to,
            });

            if (data.success) {
                campaignStatusMap.current = data.campaign_status_map || {};
                campaignEventMap.current  = data.campaign_event_map  || {};

                if (data.meta_raw && data.meta_raw.length > 0) {
                    allMetaRawRef.current = data.meta_raw;
                }
                adsFromMetaRef.current    = data.ads_data    || [];
                adsetsFromMetaRef.current = data.adsets_data || [];

                /* patch campaignData with real status/event */
                setCampaignData(prev => prev.map(row => ({
                    ...row,
                    delivery_status:  campaignStatusMap.current[row.campaign_name] || 'UNKNOWN',
                    conversion_event: campaignEventMap.current[row.campaign_id]    || 'UNKNOWN',
                })));

                /* if user already moved to adset tab, patch those too */
                setAdsetData(prev => prev.map(row => ({
                    ...row,
                    delivery_status:  campaignStatusMap.current[row.campaign_name] || row.delivery_status,
                    conversion_event: campaignEventMap.current[row.campaign_id]    || row.conversion_event,
                })));

                showAlert('All data loaded successfully', 'success');
            }
        } catch (e) {
            console.error('Phase 2 error:', e);
        } finally {
            setPhase2Loading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl]);

    /* =====================================================================
       ACTION: fetch_adset_stats (called after campaign selection)
       ===================================================================== */
    const buildAdsetTable = useCallback(async () => {
        const selected = selectedCampaignNamesRef.current;
        if (selected.size === 0) {
            setAdsetData([]);
            return;
        }

        const map = {};
        allMetaRawRef.current.forEach(row => {
            if (!selected.has(row.campaign_name) || !row.adset_name) return;
            const k = `${row.campaign_name}|||${row.adset_name}`;
            if (!map[k]) {
                map[k] = {
                    campaign_name: row.campaign_name,
                    adset_name: row.adset_name,
                    date_start: row.date_start,
                    date_stop:  row.date_stop,
                    spend: 0, impressions: 0, clicks: 0, reach: 0,
                };
            }
            map[k].spend       += parseFloat(row.spend || 0);
            map[k].impressions += parseInt(row.impressions || 0);
            map[k].clicks      += parseInt(row.clicks || 0);
            map[k].reach       += parseInt(row.reach || 0);
        });

        const baseRows = Object.values(map).map(row => {
            const mc = campaignData.find(c => c.campaign_name === row.campaign_name);
            const cpm = row.impressions > 0 ? (row.spend / row.impressions * 1000) : 0;
            return {
                ...row,
                cpm,
                exam_percent: 0,
                delivery_status:  mc ? mc.delivery_status  : 'UNKNOWN',
                conversion_event: mc ? mc.conversion_event : 'UNKNOWN',
                has_meta_data: true,
                registrations: 0, cost_per_registration: 0,
                exam_count: 0, cost_per_exam: 0,
                internship_count: 0, second_internship: 0, cost_per_internship: 0,
                revenue: 0, roi: 0, rpu: 0, cac_all: 0, cac_paid: 0, roas: 0,
            };
        });

        setAdsetData(baseRows);

        /* prune selections that no longer exist */
        const valid = new Set(baseRows.map(r => r.campaign_name + '|||' + r.adset_name));
        selectedAdsetNamesRef.current.forEach(k => {
            if (!valid.has(k)) selectedAdsetNamesRef.current.delete(k);
        });
        bumpSelection();

        /* fetch real DB stats for these adsets */
        const adsetNames = baseRows.map(a => a.adset_name);
        if (adsetNames.length === 0) return;

        try {
            const resp = await apiAction(apiUrl, 'fetch_adset_stats', {
                from_date: confirmedFrom,
                to_date: confirmedTo,
                adsets: adsetNames,
            });
            if (resp.success) {
                setAdsetData(prev => prev.map(row => {
                    const stats = resp.data[row.adset_name];
                    if (!stats) return row;
                    const reg = stats.registrations || 0;
                    const exam = stats.exam_count || 0;
                    const intern = stats.internship_count || 0;
                    const rev = stats.revenue || 0;
                    const second = stats.second_internship || 0;
                    return {
                        ...row,
                        registrations: reg,
                        exam_count: exam,
                        internship_count: intern,
                        second_internship: second,
                        revenue: rev,
                        exam_percent:          reg > 0 ? (exam / reg * 100) : 0,
                        cost_per_registration: reg > 0 ? row.spend / reg : 0,
                        cost_per_exam:         exam > 0 ? row.spend / exam : 0,
                        cost_per_internship:   intern > 0 ? row.spend / intern : 0,
                        roi:   row.spend > 0 ? rev / row.spend : 0,
                        rpu:   reg > 0 ? rev / reg : 0,
                        cac_all:  reg > 0 ? row.spend / reg : 0,
                        cac_paid: intern > 0 ? row.spend / intern : 0,
                        roas: row.spend > 0 ? rev / row.spend : 0,
                    };
                }));
            }
        } catch (e) {
            console.error('fetch_adset_stats error:', e);
        }
    }, [apiUrl, campaignData, confirmedFrom, confirmedTo, bumpSelection]);

    /* =====================================================================
       ACTION: fetch_ad_stats (called after adset selection)
       ===================================================================== */
    const buildAdTable = useCallback(async () => {
        const selectedAdsets = selectedAdsetNamesRef.current;
        if (selectedAdsets.size === 0) {
            setAdData([]);
            return;
        }

        const map = {};
        allMetaRawRef.current.forEach(row => {
            const key = row.campaign_name + '|||' + row.adset_name;
            if (!selectedAdsets.has(key) || !row.ad_name) return;
            const k = `${row.campaign_name}|||${row.adset_name}|||${row.ad_name}`;
            if (!map[k]) {
                map[k] = {
                    campaign_name: row.campaign_name,
                    adset_name: row.adset_name,
                    ad_name: row.ad_name,
                    date_start: row.date_start,
                    date_stop:  row.date_stop,
                    spend: 0, impressions: 0, clicks: 0, reach: 0,
                };
            }
            map[k].spend       += parseFloat(row.spend || 0);
            map[k].impressions += parseInt(row.impressions || 0);
            map[k].clicks      += parseInt(row.clicks || 0);
            map[k].reach       += parseInt(row.reach || 0);
        });

        const baseRows = Object.values(map).map(row => {
            const ma = adsetData.find(a => a.campaign_name === row.campaign_name && a.adset_name === row.adset_name);
            const cpm = row.impressions > 0 ? (row.spend / row.impressions * 1000) : 0;
            return {
                ...row,
                cpm,
                exam_percent: 0,
                delivery_status:  ma ? ma.delivery_status  : 'UNKNOWN',
                conversion_event: ma ? ma.conversion_event : 'UNKNOWN',
                has_meta_data: true,
                registrations: 0, cost_per_registration: 0,
                exam_count: 0, cost_per_exam: 0,
                internship_count: 0, second_internship: 0, cost_per_internship: 0,
                revenue: 0, roi: 0, rpu: 0, cac_all: 0, cac_paid: 0, roas: 0,
            };
        });

        setAdData(baseRows);

        selectedAdNamesRef.current.clear();
        bumpSelection();

        const adNames = baseRows.map(a => a.ad_name);
        if (adNames.length === 0) return;

        try {
            const resp = await apiAction(apiUrl, 'fetch_ad_stats', {
                from_date: confirmedFrom,
                to_date: confirmedTo,
                ads: adNames,
            });
            if (resp.success) {
                setAdData(prev => prev.map(row => {
                    const stats = resp.data[row.ad_name];
                    if (!stats) return row;
                    const reg = stats.registrations || 0;
                    const exam = stats.exam_count || 0;
                    const intern = stats.internship_count || 0;
                    const rev = stats.revenue || 0;
                    const second = stats.second_internship || 0;
                    return {
                        ...row,
                        registrations: reg,
                        exam_count: exam,
                        internship_count: intern,
                        second_internship: second,
                        revenue: rev,
                        exam_percent:          reg > 0 ? (exam / reg * 100) : 0,
                        cost_per_registration: reg > 0 ? row.spend / reg : 0,
                        cost_per_exam:         exam > 0 ? row.spend / exam : 0,
                        cost_per_internship:   intern > 0 ? row.spend / intern : 0,
                        roi:   row.spend > 0 ? rev / row.spend : 0,
                        rpu:   reg > 0 ? rev / reg : 0,
                        cac_all:  reg > 0 ? row.spend / reg : 0,
                        cac_paid: intern > 0 ? row.spend / intern : 0,
                        roas: row.spend > 0 ? rev / row.spend : 0,
                    };
                }));
            }
        } catch (e) {
            console.error('fetch_ad_stats error:', e);
        }
    }, [apiUrl, adsetData, confirmedFrom, confirmedTo, bumpSelection]);

    /* =====================================================================
       ACTION: update_meta_token
       ===================================================================== */
    const updateMetaToken = useCallback(async () => {
        const token = newToken.trim();
        if (!token) { showAlert('Enter token'); return; }
        try {
            const data = await apiAction(apiUrl, 'update_meta_token', { token });
            if (data.success) {
                showAlert('Token Updated Successfully', 'success');
                setShowTokenBox(false);
                setNewToken('');
                fetchAnalytics();
            } else {
                showAlert(data.message || 'Error updating token');
            }
        } catch (e) {
            showAlert('Error: ' + e.message);
        }
    }, [apiUrl, newToken, fetchAnalytics, showAlert]);

    /* =====================================================================
       MOUNT
       ===================================================================== */
    useEffect(() => { loadCitVersions(); /* eslint-disable-next-line */ }, []);

    /* =====================================================================
       NOTES API FUNCTIONS (defined BEFORE fetch* so they're in-scope for deps)
       Notes are now keyed per (entity, version, note_type).
       Key format: "entityType|||entityName|||versionName|||noteType"
       ===================================================================== */

    /** Bulk fetch notes for a list of entities.
        Entities can be {type, name} (any version/type) or
        {type, name, version, note_type} (scoped). Merges into allNotes. */
    const fetchNotes = useCallback(async (entities) => {
        if (!entities || entities.length === 0) return;
        try {
            const resp = await apiAction(apiUrl, 'fetch_notes', {
                entities: JSON.stringify(entities),
            });
            if (resp && resp.success && resp.notes) {
                setAllNotes(prev => {
                    const next = { ...prev };
                    Object.keys(resp.notes).forEach(k => {
                        next[k] = resp.notes[k];
                    });
                    return next;
                });
            }
        } catch (e) {
            console.error('fetchNotes failed:', e);
        }
    }, [apiUrl]);

    /** Save a note for a specific entity+version+note_type.
        noteType must be 'remark1' or 'remark2'. */
    const saveNote = useCallback(async (params) => {
        const {
            entityType, entityName, versionName, noteType,
            noteText, parentCampaign, parentAdset,
        } = params;

        if (!noteUser.id) {
            showAlert('Cannot save note: no user is logged in.');
            return;
        }
        try {
            const resp = await apiAction(apiUrl, 'save_note', {
                entity_type:     entityType,
                entity_name:     entityName,
                version_name:    versionName,
                note_type:       noteType,
                parent_campaign: parentCampaign || '',
                parent_adset:    parentAdset    || '',
                user_id:         noteUser.id,
                user_name:       noteUser.name,
                note:            noteText || '',
            });
            if (!resp || !resp.success) {
                showAlert('Failed to save note: ' + (resp && resp.message || 'Unknown error'));
                return;
            }

            const key = entityType + '|||' + entityName + '|||' + versionName + '|||' + noteType;

            setAllNotes(prev => {
                const next = { ...prev };
                const existingList = (next[key] || []).filter(n => n.user_id !== noteUser.id);

                if (resp.deleted) {
                    if (existingList.length === 0) delete next[key];
                    else next[key] = existingList;
                } else if (resp.note_id) {
                    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
                    const updatedNote = {
                        id: resp.note_id,
                        user_id: noteUser.id,
                        user_name: noteUser.name,
                        note: noteText,
                        version_name: versionName,
                        note_type: noteType,
                        updated_at: nowStr,
                        created_at: nowStr,
                    };
                    next[key] = [updatedNote, ...existingList];
                }
                return next;
            });

            if (resp.deleted)  showAlert('Note deleted', 'success');
            else               showAlert('Note saved', 'success');
        } catch (e) {
            showAlert('Network error while saving note: ' + e.message);
        }
    }, [apiUrl, noteUser.id, noteUser.name, showAlert]);

    /** Fetch edit history for one entity+version+type combo. */
    const fetchNoteHistory = useCallback(async (params) => {
        const { entityType, entityName, versionName, noteType } = params;
        try {
            const resp = await apiAction(apiUrl, 'fetch_note_history', {
                entity_type:  entityType,
                entity_name:  entityName,
                version_name: versionName || '',
                note_type:    noteType    || '',
            });
            if (resp && resp.success) {
                setNoteHistory({
                    entityType, entityName,
                    versionName, noteType,
                    rows: resp.history || [],
                });
            }
        } catch (e) {
            console.error('fetchNoteHistory failed:', e);
        }
    }, [apiUrl]);

    /* =====================================================================
       VERSION ANALYSIS - ACTIONS
       ===================================================================== */
    const fetchVersionAnalysis = useCallback(async () => {
        if (selectedVersionsVA.length === 0) {
            showAlert('Please select at least one CIT version');
            return;
        }
        setVaLoading(true);
        setExpandedCampaignsVA(new Set());
        setExpandedAdsetsVA(new Set());
        setAdsetsCacheVA({});
        setAdsCacheVA({});
        setLoadedAdsetsVA(new Set());
        setLoadedAdsVA(new Set());
        setPerCardMetricsVA({});
        setAllNotes({});
        try {
            const data = await apiAction(apiUrl, 'fetch_version_analysis', {
                versions: selectedVersionsVA,
            });
            if (data.token_expired) {
                showAlert('Meta Access Token Expired. Please update token.');
                setShowTokenBox(true);
                return;
            }
            if (data.success) {
                const campaigns = data.campaigns || [];
                setVaCampaigns(campaigns);
                // Fix 1: campaigns expanded by default per PDF spec 3.1
                setExpandedCampaignsVA(new Set(campaigns.map(c => c.campaign_name)));
                showAlert(`Loaded ${campaigns.length} campaigns across ${selectedVersionsVA.length} versions`, 'success');

                // Fetch notes for all returned campaigns across all selected versions.
                // We build (campaign × version) pairs so each row in the table has its notes.
                if (campaigns.length > 0) {
                    const pairs = [];
                    campaigns.forEach(c => {
                        selectedVersionsVA.forEach(v => {
                            pairs.push({ type: 'campaign', name: c.campaign_name, version: v });
                        });
                    });
                    if (pairs.length > 0) fetchNotes(pairs);
                }
            } else {
                showAlert(data.message || 'Error fetching version data');
                setVaCampaigns([]);
            }
        } catch (e) {
            showAlert('Error: ' + e.message);
        } finally {
            setVaLoading(false);
        }
    }, [apiUrl, selectedVersionsVA, showAlert]);

    const fetchVersionAdsets = useCallback(async (campaignName) => {
        if (adsetsCacheVA[campaignName]) return; // cached
        setLoadingAdsetsVA(prev => {
            const n = new Set(prev); n.add(campaignName); return n;
        });
        try {
            const data = await apiAction(apiUrl, 'fetch_version_analysis_adsets', {
                versions: selectedVersionsVA,
                campaign_name: campaignName,
            });
            if (data.success) {
                const adsets = data.adsets || [];
                setAdsetsCacheVA(prev => ({ ...prev, [campaignName]: adsets }));
                if (adsets.length > 0) {
                    const pairs = [];
                    adsets.forEach(a => {
                        selectedVersionsVA.forEach(v => {
                            pairs.push({ type: 'adset', name: a.adset_name, version: v });
                        });
                    });
                    if (pairs.length > 0) fetchNotes(pairs);
                }
            } else {
                showAlert(data.message || 'Error fetching ad sets');
            }
        } catch (e) {
            showAlert('Error: ' + e.message);
        } finally {
            setLoadingAdsetsVA(prev => {
                const n = new Set(prev); n.delete(campaignName); return n;
            });
        }
    }, [apiUrl, selectedVersionsVA, adsetsCacheVA, showAlert, fetchNotes]);

    const fetchVersionAds = useCallback(async (campaignName, adsetName) => {
        const key = campaignName + '|||' + adsetName;
        if (adsCacheVA[key]) return;
        setLoadingAdsVA(prev => {
            const n = new Set(prev); n.add(key); return n;
        });
        try {
            const data = await apiAction(apiUrl, 'fetch_version_analysis_ads', {
                versions: selectedVersionsVA,
                campaign_name: campaignName,
                adset_name: adsetName,
            });
            if (data.success) {
                const ads = data.ads || [];
                setAdsCacheVA(prev => ({ ...prev, [key]: ads }));
                if (ads.length > 0) {
                    const pairs = [];
                    ads.forEach(a => {
                        selectedVersionsVA.forEach(v => {
                            pairs.push({ type: 'ad', name: a.ad_name, version: v });
                        });
                    });
                    if (pairs.length > 0) fetchNotes(pairs);
                }
            } else {
                showAlert(data.message || 'Error fetching ads');
            }
        } catch (e) {
            showAlert('Error: ' + e.message);
        } finally {
            setLoadingAdsVA(prev => {
                const n = new Set(prev); n.delete(key); return n;
            });
        }
    }, [apiUrl, selectedVersionsVA, adsCacheVA, showAlert]);

    const toggleCampaignExpandVA = useCallback((campaignName) => {
        setExpandedCampaignsVA(prev => {
            const n = new Set(prev);
            if (n.has(campaignName)) n.delete(campaignName);
            else n.add(campaignName);
            return n;
        });
    }, []);

    const toggleAdsetExpandVA = useCallback((campaignName, adsetName) => {
        const key = campaignName + '|||' + adsetName;
        setExpandedAdsetsVA(prev => {
            const n = new Set(prev);
            if (n.has(key)) n.delete(key);
            else n.add(key);
            return n;
        });
    }, []);

    const toggleVersionPillVA = useCallback((version) => {
        setSelectedVersionsVA(prev =>
            prev.includes(version) ? prev.filter(v => v !== version) : [...prev, version]
        );
    }, []);

    const toggleMetricVA = useCallback((metricKey) => {
        setSelectedMetricsVA(prev => {
            const n = new Set(prev);
            if (n.has(metricKey)) n.delete(metricKey);
            else n.add(metricKey);
            return n;
        });
    }, []);

    /* Per-card metric override toggle.
       Starts the card with its own copy of the global Set if absent. */
    const togglePerCardMetric = useCallback((campaignName, metricKey) => {
        setPerCardMetricsVA(prev => {
            const existing = prev[campaignName] ? new Set(prev[campaignName]) : new Set(selectedMetricsVA);
            if (existing.has(metricKey)) existing.delete(metricKey);
            else existing.add(metricKey);
            return { ...prev, [campaignName]: existing };
        });
    }, [selectedMetricsVA]);

    const resetPerCardMetrics = useCallback((campaignName) => {
        setPerCardMetricsVA(prev => {
            const n = { ...prev };
            delete n[campaignName];
            return n;
        });
    }, []);

    /* Explicit "Load Ad Sets" click handler. Fetches only if not yet loaded. */
    const clickLoadAdsets = useCallback((campaignName) => {
        setLoadedAdsetsVA(prev => {
            const n = new Set(prev); n.add(campaignName); return n;
        });
        if (!adsetsCacheVA[campaignName]) {
            fetchVersionAdsets(campaignName);
        }
    }, [adsetsCacheVA, fetchVersionAdsets]);

    const clickLoadAds = useCallback((campaignName, adsetName) => {
        const key = campaignName + '|||' + adsetName;
        setLoadedAdsVA(prev => {
            const n = new Set(prev); n.add(key); return n;
        });
        if (!adsCacheVA[key]) {
            fetchVersionAds(campaignName, adsetName);
        }
    }, [adsCacheVA, fetchVersionAds]);

    /* ==================================================================
       DAY / VERSION ANALYSIS - fetch + helpers
       ================================================================== */
    const toggleVersionPillDV = useCallback((version) => {
        setSelectedVersionsDV(prev =>
            prev.includes(version) ? prev.filter(v => v !== version) : [...prev, version]
        );
    }, []);

    const toggleDvCol = useCallback((key) => {
        setDvHiddenCols(prev => {
            const n = new Set(prev);
            if (n.has(key)) n.delete(key); else n.add(key);
            return n;
        });
    }, []);

    const fetchDayVersionAnalysis = useCallback(async () => {
        // Effective view: daterange mode forces 'day'
        const effectiveView = inputModeDV === 'daterange' ? 'day' : viewModeDV;

        if (inputModeDV === 'versions' && selectedVersionsDV.length === 0) {
            showAlert('Please select at least one CIT version');
            return;
        }
        if (inputModeDV === 'daterange' && (!dvFromDate || !dvToDate)) {
            showAlert('Please pick a from and to date');
            return;
        }
        setDvLoading(true);
        setDvRows([]);
        try {
            const params = { mode: effectiveView };
            if (inputModeDV === 'versions') {
                params.versions = selectedVersionsDV;
            } else {
                params.from_date = dvFromDate;
                params.to_date   = dvToDate;
            }
            const data = await apiAction(apiUrl, 'fetch_day_version_analysis', params);
            if (data.token_expired) {
                showAlert('Meta Access Token Expired. Please update token.');
                setShowTokenBox(true);
                return;
            }
            if (data.success) {
                setDvRows(data.rows || []);
                if ((data.rows || []).length === 0) {
                    showAlert('No data for the selected input', 'info');
                }
            } else {
                showAlert(data.message || 'Error fetching day/version data');
            }
        } catch (e) {
            showAlert('Error: ' + e.message);
        } finally {
            setDvLoading(false);
        }
    }, [apiUrl, inputModeDV, viewModeDV, selectedVersionsDV, dvFromDate, dvToDate, showAlert]);

    const exportCampaignCSV = useCallback((campaign) => {
        const cols = ['version', ...VA_METRICS.filter(m => selectedMetricsVA.has(m.key)).map(m => m.key)];
        let csv = cols.join(',') + '\n';
        campaign.versions.forEach(v => {
            const row = cols.map(c => {
                if (c === 'version') return `"${v.version}"`;
                const val = v.no_data ? '' : (v[c] ?? '');
                return `"${val}"`;
            });
            csv += row.join(',') + '\n';
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `version_analysis_${campaign.campaign_name.replace(/[^\w]+/g,'_')}.csv`;
        link.click();
    }, [selectedMetricsVA]);


    /* Sync horizontal scroll between table and footer */
    useEffect(() => {
        const tw = tableWrapperRef.current;
        const fw = footerWrapperRef.current;
        if (!tw || !fw) return;
        const onTw = () => { fw.scrollLeft = tw.scrollLeft; };
        const onFw = () => { tw.scrollLeft = fw.scrollLeft; };
        tw.addEventListener('scroll', onTw);
        fw.addEventListener('scroll', onFw);
        return () => {
            tw.removeEventListener('scroll', onTw);
            fw.removeEventListener('scroll', onFw);
        };
    }, [campaignData, adsetData, adData, currentLevel]);

    /* =====================================================================
       DERIVED: allData (what is currently shown)
       ===================================================================== */
    const getBaseData = () => {
        if (currentLevel === 'campaign') return campaignData;
        if (currentLevel === 'adset')    return adsetData;
        return adData;
    };

    const allData = (() => {
        let data = [...getBaseData()];

        /* column filters */
        if (Object.keys(columnFilters).length > 0) {
            data = data.filter(row =>
                Object.entries(columnFilters).every(([col, values]) => {
                    if (!values || values.length === 0) return true;
                    let fieldValue;
                    if      (col === 'campaign') fieldValue = row.campaign_name;
                    else if (col === 'adset')    fieldValue = row.adset_name;
                    else if (col === 'ad')       fieldValue = row.ad_name;
                    else if (col === 'delivery') fieldValue = row.delivery_status;
                    else if (col === 'event')    fieldValue = row.conversion_event;
                    else fieldValue = row[col];
                    return values.includes(String(fieldValue));
                })
            );
        }

        /* search */
        const term = searchTerm.toLowerCase().trim();
        if (term) {
            data = data.filter(r => {
                const field =
                    searchMode === 'adset'    ? r.adset_name :
                    searchMode === 'ad'       ? r.ad_name    :
                                                r.campaign_name;
                return field && field.toLowerCase().includes(term);
            });
        }

        /* sort */
        if (sortField) {
            data.sort((a, b) => {
                let va = a[sortField];
                let vb = b[sortField];
                if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
                if (va == null) va = 0;
                if (vb == null) vb = 0;
                const dir = sortDirection === 'asc' ? 1 : -1;
                return va > vb ? dir : va < vb ? -dir : 0;
            });
        }

        return data;
    })();

    /* =====================================================================
       HEADER STATS (from full campaignData)
       ===================================================================== */
    const headerStats = (() => {
        const t = campaignData.reduce((a, r) => {
            a.spend += r.spend || 0;
            a.registrations += r.registrations || 0;
            a.revenue += r.revenue || 0;
            return a;
        }, { spend: 0, registrations: 0, revenue: 0 });
        return {
            campaigns: campaignData.length,
            registrations: t.registrations,
            spend: t.spend,
            revenue: t.revenue,
            roi: t.spend > 0 ? t.revenue / t.spend : 0,
        };
    })();

    /* =====================================================================
       FOOTER TOTALS (from allData - reflects current filters/search)
       ===================================================================== */
    const footerTotals = (() => {
        const t = allData.reduce((a, r) => {
            a.spend += r.spend || 0;
            a.reg += r.registrations || 0;
            a.exam += r.exam_count || 0;
            a.intern += r.internship_count || 0;
            a.intern2 += r.second_internship || 0;
            a.revenue += r.revenue || 0;
            a.impressions += r.impressions || 0;
            a.reach += r.reach || 0;
            return a;
        }, { spend:0, reg:0, exam:0, intern:0, intern2:0, revenue:0, impressions:0, reach:0 });

        return {
            ...t,
            cpm:         t.impressions > 0 ? (t.spend / t.impressions * 1000) : 0,
            cost_per_registration: t.reg > 0 ? t.spend / t.reg : 0,
            cost_per_exam:         t.exam > 0 ? t.spend / t.exam : 0,
            exam_percent:          t.reg > 0 ? ((t.exam / t.reg) * 100) : 0,
            cost_per_internship:   t.intern > 0 ? t.spend / t.intern : 0,
            roi:  t.spend > 0 ? t.revenue / t.spend : 0,
            rpu:  t.reg > 0 ? t.revenue / t.reg : 0,
            cac_all:  t.reg > 0 ? t.spend / t.reg : 0,
            cac_paid: t.intern > 0 ? t.spend / t.intern : 0,
            roas: t.spend > 0 ? t.revenue / t.spend : 0,
        };
    })();

    /* =====================================================================
       BADGES
       ===================================================================== */
    const selCampaignCount = selectedCampaignNamesRef.current.size; // eslint-disable-line no-unused-vars
    const selAdsetCount    = selectedAdsetNamesRef.current.size;    // eslint-disable-line no-unused-vars
    const _tick = selectionTick;                                     // eslint-disable-line no-unused-vars

    /* =====================================================================
       CHECKBOX HANDLERS
       ===================================================================== */
    const handleRowCheckbox = (row, checked) => {
        if (currentLevel === 'campaign') {
            const key = row.campaign_name;
            if (checked) selectedCampaignNamesRef.current.add(key);
            else         selectedCampaignNamesRef.current.delete(key);
            bumpSelection();
            buildAdsetTable();
        } else if (currentLevel === 'adset') {
            const key = row.campaign_name + '|||' + row.adset_name;
            if (checked) selectedAdsetNamesRef.current.add(key);
            else         selectedAdsetNamesRef.current.delete(key);
            bumpSelection();
            buildAdTable();
        }
    };

    const handleSelectAll = (checked) => {
        if (currentLevel === 'campaign') {
            if (checked) allData.forEach(r => selectedCampaignNamesRef.current.add(r.campaign_name));
            else         allData.forEach(r => selectedCampaignNamesRef.current.delete(r.campaign_name));
            bumpSelection();
            buildAdsetTable();
        } else if (currentLevel === 'adset') {
            if (checked) allData.forEach(r => selectedAdsetNamesRef.current.add(r.campaign_name + '|||' + r.adset_name));
            else         allData.forEach(r => selectedAdsetNamesRef.current.delete(r.campaign_name + '|||' + r.adset_name));
            bumpSelection();
            buildAdTable();
        }
    };

    const isRowSelected = (row) => {
        if (currentLevel === 'campaign')
            return selectedCampaignNamesRef.current.has(row.campaign_name);
        if (currentLevel === 'adset')
            return selectedAdsetNamesRef.current.has(row.campaign_name + '|||' + row.adset_name);
        return false;
    };

    const selectAllState = (() => {
        const total = allData.length;
        let sel = 0;
        if (currentLevel === 'campaign')
            sel = allData.filter(r => selectedCampaignNamesRef.current.has(r.campaign_name)).length;
        else if (currentLevel === 'adset')
            sel = allData.filter(r => selectedAdsetNamesRef.current.has(r.campaign_name + '|||' + r.adset_name)).length;
        return { checked: total > 0 && sel === total, indeterminate: sel > 0 && sel < total };
    })();

    /* =====================================================================
       LEVEL TAB SWITCH
       ===================================================================== */
    const switchLevel = (newLevel) => {
        setSearchTerm('');
        setShowSuggestions(false);

        if (newLevel === 'adset' && selectedCampaignNamesRef.current.size === 0) {
            showAlert('Please select at least one campaign first');
            return;
        }
        if (newLevel === 'ad' && selectedAdsetNamesRef.current.size === 0) {
            showAlert('Please select at least one ad set first');
            return;
        }

        setCurrentLevel(newLevel);
        if (newLevel === 'adset') buildAdsetTable();
        if (newLevel === 'ad')    buildAdTable();
    };

    /* DV columns are defined outside the component (see DV_COLUMNS) but we
       need a stable mode key derived from inputModeDV/viewModeDV for the table. */
    const dvEffectiveView = inputModeDV === 'daterange' ? 'day' : viewModeDV;

    /* =====================================================================
       SORT HANDLER
       ===================================================================== */
    const handleSort = (field) => {
        // Ignore the click that fires right after a resize drag
        if (typeof window !== 'undefined' && window.__madJustResized) return;

        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    /* =====================================================================
       SEARCH HANDLERS
       ===================================================================== */
    const handleSearchInput = (e) => {
        setSearchTerm(e.target.value);
        setShowSuggestions(e.target.value.trim() !== '');
    };

    const applySearchSuggestion = (type) => {
        const term = searchTerm.trim();
        setSearchMode(type);
        setShowSuggestions(false);

        if (type === 'campaign') {
            setCurrentLevel('campaign');
        } else if (type === 'adset') {
            if (selectedCampaignNamesRef.current.size === 0) {
                showAlert('Please select at least one campaign first');
                return;
            }
            setCurrentLevel('adset');
            buildAdsetTable();
        } else if (type === 'ad') {
            if (selectedAdsetNamesRef.current.size === 0) {
                showAlert('Please select at least one ad set first');
                return;
            }
            setCurrentLevel('ad');
            buildAdTable();
        }
    };

    /* =====================================================================
       COLUMN FILTER HANDLERS
       ===================================================================== */
    const openColumnFilter = (column, evt) => {
        evt.stopPropagation();
        const rect = evt.currentTarget.getBoundingClientRect();
        const fieldMap = {
            campaign:'campaign_name', adset:'adset_name', ad:'ad_name',
            delivery:'delivery_status', event:'conversion_event',
        };
        const fieldName = fieldMap[column] || column;
        const values = new Set();
        getBaseData().forEach(r => {
            const v = r[fieldName];
            if (v !== null && v !== undefined) values.add(String(v));
        });
        const existing = columnFilters[column];
        const initial = existing ? [...existing] : Array.from(values);

        setActiveFilterColumn(column);
        setFilterSearchTerm('');
        setPendingFilterValues(initial);
        setFilterDropdown({ open: true, x: rect.left, y: rect.bottom + 5, options: Array.from(values).sort() });
    };

    const togglePendingValue = (val) => {
        setPendingFilterValues(prev =>
            prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
        );
    };

    const toggleSelectAllFilter = (checked, allOptions) => {
        setPendingFilterValues(checked ? [...allOptions] : []);
    };

    const applyColumnFilter = () => {
        if (!activeFilterColumn) return;
        const allOptions = filterDropdown.options || [];
        if (pendingFilterValues.length === allOptions.length) {
            setColumnFilters(prev => {
                const next = { ...prev };
                delete next[activeFilterColumn];
                return next;
            });
        } else {
            setColumnFilters(prev => ({ ...prev, [activeFilterColumn]: pendingFilterValues }));
        }
        setFilterDropdown({ open: false, x: 0, y: 0 });
        setActiveFilterColumn(null);
    };

    const clearColumnFilter = () => {
        if (!activeFilterColumn) return;
        setColumnFilters(prev => {
            const next = { ...prev };
            delete next[activeFilterColumn];
            return next;
        });
        setFilterDropdown({ open: false, x: 0, y: 0 });
        setActiveFilterColumn(null);
    };

    /* close filter on outside click */
    useEffect(() => {
        if (!filterDropdown.open) return;
        const handler = (e) => {
            if (!e.target.closest('.column-filter-dropdown') && !e.target.closest('.filter-icon')) {
                setFilterDropdown({ open: false, x: 0, y: 0 });
                setActiveFilterColumn(null);
            }
        };
        setTimeout(() => document.addEventListener('click', handler), 10);
        return () => document.removeEventListener('click', handler);
    }, [filterDropdown.open]);

    /* =====================================================================
       COMPARISON EXPANSION
       ===================================================================== */
    const toggleExpand = (column, evt) => {
        evt.stopPropagation();
        if (!isComparison) return;
        setExpandedColumns(prev => {
            const next = new Set(prev);
            if (next.has(column)) next.delete(column);
            else next.add(column);
            return next;
        });
    };

    /* =====================================================================
       DATE PICKER HANDLERS
       ===================================================================== */
    const openDatePicker = () => {
        setDpTempFrom(dpFromDate ? new Date(dpFromDate) : null);
        setDpTempTo(dpToDate ? new Date(dpToDate) : null);
        setDpTempIsComparison(isComparison);
        if (dpFromDate) setDpViewMonth(new Date(dpFromDate.getFullYear(), dpFromDate.getMonth(), 1));

        if (isComparison) {
            setDpTempCompareFrom(dpCompareFromDate ? new Date(dpCompareFromDate) : null);
            setDpTempCompareTo(dpCompareToDate ? new Date(dpCompareToDate) : null);
            if (dpCompareFromDate)
                setDpCompareViewMonth(new Date(dpCompareFromDate.getFullYear(), dpCompareFromDate.getMonth(), 1));
        }
        setDpOpen(true);
    };

    const closeDatePicker = () => setDpOpen(false);

    const handleDayClick = (d) => {
        if (!dpTempFrom || (dpTempFrom && dpTempTo)) {
            setDpTempFrom(d);
            setDpTempTo(null);
            setDpActivePreset(null);
            if (dpTempIsComparison) {
                const prev = getPreviousPeriod(toYMD(d), toYMD(d));
                setDpTempCompareFrom(parseYMD(prev.from));
                setDpTempCompareTo(parseYMD(prev.to));
                setDpCompareViewMonth(new Date(parseYMD(prev.from).getFullYear(), parseYMD(prev.from).getMonth(), 1));
            }
        } else {
            let from = dpTempFrom, to = d;
            if (d < dpTempFrom) { from = d; to = dpTempFrom; }
            setDpTempFrom(from);
            setDpTempTo(to);
            setDpActivePreset(null);
            if (dpTempIsComparison) {
                const prev = getPreviousPeriod(toYMD(from), toYMD(to));
                setDpTempCompareFrom(parseYMD(prev.from));
                setDpTempCompareTo(parseYMD(prev.to));
                setDpCompareViewMonth(new Date(parseYMD(prev.from).getFullYear(), parseYMD(prev.from).getMonth(), 1));
            }
        }
    };

    const handleCompareDayClick = (d) => {
        if (!dpTempCompareFrom || (dpTempCompareFrom && dpTempCompareTo)) {
            setDpTempCompareFrom(d);
            setDpTempCompareTo(null);
        } else {
            if (d < dpTempCompareFrom) { setDpTempCompareTo(dpTempCompareFrom); setDpTempCompareFrom(d); }
            else setDpTempCompareTo(d);
        }
    };

    const applyPreset = (preset) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let from, to;
        switch (preset) {
            case 'today':     from = new Date(today); to = new Date(today); break;
            case 'yesterday': from = new Date(today); from.setDate(from.getDate() - 1); to = new Date(from); break;
            case 'last7':     to = new Date(today); from = new Date(today); from.setDate(from.getDate() - 6); break;
            case 'last14':    to = new Date(today); from = new Date(today); from.setDate(from.getDate() - 13); break;
            case 'last28':    to = new Date(today); from = new Date(today); from.setDate(from.getDate() - 27); break;
            case 'last30':    to = new Date(today); from = new Date(today); from.setDate(from.getDate() - 29); break;
            case 'thisweek':  from = new Date(today); from.setDate(from.getDate() - from.getDay()); to = new Date(today); break;
            case 'lastweek':  to = new Date(today); to.setDate(to.getDate() - today.getDay() - 1); from = new Date(to); from.setDate(from.getDate() - 6); break;
            case 'thismonth': from = new Date(today.getFullYear(), today.getMonth(), 1); to = new Date(today); break;
            case 'lastmonth': to = new Date(today.getFullYear(), today.getMonth(), 0); from = new Date(today.getFullYear(), today.getMonth() - 1, 1); break;
            default: return;
        }
        setDpTempFrom(from);
        setDpTempTo(to);
        setDpActivePreset(preset);
        setDpViewMonth(new Date(from.getFullYear(), from.getMonth(), 1));
        if (dpTempIsComparison) {
            const prev = getPreviousPeriod(toYMD(from), toYMD(to));
            setDpTempCompareFrom(parseYMD(prev.from));
            setDpTempCompareTo(parseYMD(prev.to));
            setDpCompareViewMonth(new Date(parseYMD(prev.from).getFullYear(), parseYMD(prev.from).getMonth(), 1));
        }
    };

    const confirmDatePicker = () => {
        if (!dpTempFrom || !dpTempTo) { showAlert('Please select both start and end dates.'); return; }
        if (dpTempIsComparison && (!dpTempCompareFrom || !dpTempCompareTo)) {
            showAlert('Please select comparison date range.');
            return;
        }

        setDpFromDate(new Date(dpTempFrom));
        setDpToDate(new Date(dpTempTo));
        const f = toYMD(dpTempFrom), t = toYMD(dpTempTo);
        setConfirmedFrom(f);
        setConfirmedTo(t);
        setConfirmedFromTime('');
        setConfirmedToTime('');

        let cf = '', ct = '';
        if (dpTempIsComparison) {
            setDpCompareFromDate(new Date(dpTempCompareFrom));
            setDpCompareToDate(new Date(dpTempCompareTo));
            cf = toYMD(dpTempCompareFrom);
            ct = toYMD(dpTempCompareTo);
            setConfirmedCompareFrom(cf);
            setConfirmedCompareTo(ct);
            setIsComparison(true);
        } else {
            setConfirmedCompareFrom('');
            setConfirmedCompareTo('');
            setIsComparison(false);
        }

        setDpOpen(false);
        setTimeout(() => fetchAnalyticsRef.current(null, f, t), 0);
    };

    /* =====================================================================
       CALENDAR RENDER
       ===================================================================== */
    const renderCalendar = (monthDate, fromD, toD, onDayClick) => {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrev = new Date(year, month, 0).getDate();
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

        const today = new Date();
        today.setHours(0,0,0,0);

        const cells = [];
        for (let i = firstDay - 1; i >= 0; i--) {
            const d = daysInPrev - i;
            const prevMonthDate = new Date(year, month - 1, d);
            cells.push(
                <button key={'p'+d} className="cal-day other-month" onClick={() => onDayClick(prevMonthDate)}>{d}</button>
            );
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const current = new Date(year, month, d);
            const cls = ['cal-day'];
            if (current.getTime() === today.getTime()) cls.push('today');
            if (fromD && toD) {
                const t = current.getTime(), sf = fromD.getTime(), se = toD.getTime();
                if (t === sf && t === se) cls.push('selected-start','selected-end');
                else if (t === sf) cls.push('selected-start');
                else if (t === se) cls.push('selected-end');
                else if (t > sf && t < se) cls.push('in-range');
            } else if (fromD && current.getTime() === fromD.getTime()) {
                cls.push('selected-start','selected-end');
            }
            cells.push(
                <button key={'c'+d} className={cls.join(' ')} onClick={() => onDayClick(current)}>{d}</button>
            );
        }
        const totalCells = firstDay + daysInMonth;
        const remaining = (7 - (totalCells % 7)) % 7;
        for (let d = 1; d <= remaining; d++) {
            const nextMonthDate = new Date(year, month + 1, d);
            cells.push(
                <button key={'n'+d} className="cal-day other-month" onClick={() => onDayClick(nextMonthDate)}>{d}</button>
            );
        }

        return (
            <div className="dp-calendar">
                <div className="cal-month-title">{months[month]} {year}</div>
                <div className="cal-weekdays">
                    <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>
                <div className="cal-days">{cells}</div>
            </div>
        );
    };

    /* =====================================================================
       DOWNLOAD CSV
       ===================================================================== */
    const downloadExcel = () => {
        if (allData.length === 0) { showAlert('No data to export'); return; }
        const headers = [
            'campaign_name','adset_name','ad_name','delivery_status','conversion_event',
            'date_start','date_stop','spend','impressions','clicks','reach','cpm',
            'registrations','cost_per_registration','exam_count','cost_per_exam','exam_percent',
            'internship_count','second_internship','cost_per_internship',
            'revenue','roi','rpu','cac_all','cac_paid','roas',
        ];
        let csv = headers.join(',') + '\n';
        allData.forEach(row => {
            csv += headers.map(h => `"${(row[h] != null ? row[h] : '').toString().replace(/"/g,'""')}"`).join(',') + '\n';
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `meta_ads_roi_analytics_${confirmedFrom}_to_${confirmedTo}.csv`;
        link.click();
    };

    /* =====================================================================
       DATE PICKER LABELS
       ===================================================================== */
    const dateLabel = (() => {
        if (!confirmedFrom || !confirmedTo) return 'Select dates...';
        if (isComparison && confirmedCompareFrom && confirmedCompareTo)
            return `${confirmedFrom} to ${confirmedTo} vs ${confirmedCompareFrom} to ${confirmedCompareTo}`;
        return `${confirmedFrom} to ${confirmedTo}`;
    })();

    const dpSelectedDisplay = (() => {
        if (dpTempFrom && dpTempTo) {
            let t = `${formatDisplay(dpTempFrom)} - ${formatDisplay(dpTempTo)}`;
            if (dpTempIsComparison && dpTempCompareFrom && dpTempCompareTo)
                t += ` vs ${formatDisplay(dpTempCompareFrom)} - ${formatDisplay(dpTempCompareTo)}`;
            return t;
        }
        if (dpTempFrom) return `${formatDisplay(dpTempFrom)} - ...`;
        return 'Dates are shown in Asia/Calcutta';
    })();

    /* =====================================================================
       RENDER HELPERS
       ===================================================================== */
    const renderStatusCell = (row) => {
        if (row.delivery_status === 'LOADING') {
            return <span className="loading-dots"><span></span><span></span><span></span></span>;
        }
        const raw = (row.delivery_status || 'Unknown');
        const statusClass = 'status-' + raw.toLowerCase().replace(/[^a-z]/g, '-');
        const label = raw.replace(/_/g, ' ');
        return (
            <span className={`status-badge ${statusClass}`}>
                <span className="status-dot"></span>{label}
            </span>
        );
    };

    const renderEventCell = (row) => {
        if (row.conversion_event === 'LOADING')
            return <span className="loading-dots"><span></span><span></span><span></span></span>;
        return row.conversion_event || '-';
    };

    const cellFor = (col, row) => {
        const noMeta = row.has_meta_data === false;
        const v = row[col.key] || 0;
        if (col.type === 'percent')
            return row.registrations > 0 ? ((row.exam_count / row.registrations) * 100).toFixed(1) + '%' : '-';
        if (col.type === 'ratio')  return Number(v).toFixed(2);
        if (col.type === 'currency') return noMeta && col.key !== 'revenue' ? '-' : formatCurrency(v);
        return formatNumber(v);
    };

    const renderCompareCells = (col, row) => {
        const cur  = row[col.key] || 0;
        const cmp  = row['compare_' + col.key] || 0;
        const chg  = cur - cmp;
        const pct  = cmp !== 0 ? (chg / cmp) * 100 : 0;
        return (
            <>
                <td className="currency compare-col">{formatMetricValue(col.key, cmp)}</td>
                <td className="number compare-col">
                    <span className={chg >= 0 ? 'change-positive' : 'change-negative'}>
                        {(chg >= 0 ? '+' : '')}{formatMetricValue(col.key, chg)}
                    </span>
                </td>
                <td className="number compare-col">
                    <span className={pct >= 0 ? 'change-positive' : 'change-negative'}>
                        {(pct >= 0 ? '+' : '')}{pct.toFixed(1)}%
                    </span>
                </td>
            </>
        );
    };

    /* Header cell builder */
    const renderSortIcon = (field) => {
        if (sortField !== field) return <i className="fas fa-sort sort-icon"></i>;
        return <i className={`fas ${sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} sort-icon active`}></i>;
    };

    const renderFilterIcon = (col) => (
        <i
            className={`fas fa-filter filter-icon ${columnFilters[col] ? 'active' : ''}`}
            onClick={(e) => openColumnFilter(col, e)}
            title="Filter"
        ></i>
    );

    const renderExpandIcon = (col) => {
        if (!isComparison) return null;
        return (
            <i
                className={`fas fa-chevron-right expand-icon ${expandedColumns.has(col) ? 'expanded' : ''}`}
                onClick={(e) => toggleExpand(col, e)}
                title="Expand comparison"
            ></i>
        );
    };

    const monthsList = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    /* =====================================================================
       RENDER
       ===================================================================== */
    return (
        <div className={`mad-wrap${isComparison ? ' is-comparison' : ''}`}>
            <style>{DASHBOARD_CSS}</style>
            <div className="container">

                {/* ========== HEADER (hidden on Version Analysis / Day-Version tabs) ========== */}
                {currentLevel !== 'version' && currentLevel !== 'dayversion' && (
                <div className="dashboard-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
                        <div>
                            <h1 className="header-title">Meta Ads ROI Analytics</h1>
                            <p className="header-subtitle">Track campaign performance and revenue metrics</p>
                        </div>
                        <div style={{ display: 'flex', gap: 32 }}>
                            <HeaderStat label="Campaigns"      value={formatNumber(headerStats.campaigns)} />
                            <HeaderStat label="Registrations"  value={formatNumber(headerStats.registrations)} />
                            <HeaderStat label="Total Spend"    value={formatCurrency(headerStats.spend)} />
                            <HeaderStat label="Revenue"        value={formatCurrency(headerStats.revenue)} />
                            <HeaderStat label="Avg ROI"        value={headerStats.roi.toFixed(2)} />
                        </div>
                    </div>
                </div>
                )}

                {/* ========== FILTERS (hidden on Version Analysis / Day-Version tabs) ========== */}
                {currentLevel !== 'version' && currentLevel !== 'dayversion' && (
                <div className="filters-section">
                    <div className="search-date-row">
                        <div className="search-wrapper">
                            <label className="filter-label" style={{ display: 'block', marginBottom: 6 }}>Search Campaigns</label>
                            <i className="fas fa-search search-icon"></i>
                            <input
                                type="text"
                                value={searchTerm}
                                placeholder="Search by campaign, adset, or ad name..."
                                autoComplete="off"
                                onChange={handleSearchInput}
                                onFocus={() => { if (searchTerm.trim()) setShowSuggestions(true); }}
                                onBlur={() => {
                                    clearTimeout(searchBlurTimerRef.current);
                                    searchBlurTimerRef.current = setTimeout(() => setShowSuggestions(false), 150);
                                }}
                            />
                            <div className={`search-suggestions ${showSuggestions ? 'visible' : ''}`}>
                                <div className="suggestion-item" onMouseDown={(e) => { e.preventDefault(); applySearchSuggestion('campaign'); }}>
                                    Search "<span className="highlight">{searchTerm}</span>" in Campaigns
                                </div>
                                <div className="suggestion-item" onMouseDown={(e) => { e.preventDefault(); applySearchSuggestion('adset'); }}>
                                    Search "<span className="highlight">{searchTerm}</span>" in Ad Sets
                                </div>
                                <div className="suggestion-item" onMouseDown={(e) => { e.preventDefault(); applySearchSuggestion('ad'); }}>
                                    Search "<span className="highlight">{searchTerm}</span>" in Ads
                                </div>
                            </div>
                        </div>

                        <div className="filter-group" style={{ minWidth: 160 }}>
                            <label className="filter-label">CIT Version</label>
                            <select
                                className="filter-select"
                                value={selectedCit}
                                onChange={(e) => { setSelectedCit(e.target.value); loadDateRange(e.target.value, true); }}
                            >
                                {citVersions.length === 0
                                    ? <option value="">Loading...</option>
                                    : citVersions.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>

                        <div className="filter-group">
                            <label className="filter-label">Date Range</label>
                            <button className="date-range-btn" onClick={openDatePicker}>
                                <span>
                                    <div className="dr-dates">{dateLabel}</div>
                                    {confirmedFromTime && confirmedToTime && !isComparison && (
                                        <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>
                                            {confirmedFromTime} - {confirmedToTime}
                                        </div>
                                    )}
                                </span>
                                <i className="fas fa-calendar dr-icon"></i>
                            </button>
                        </div>

                        <div className="filter-group" style={{ minWidth: 120 }}>
                            <label className="filter-label">Per Page</label>
                            <select className="filter-select" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={250}>250</option>
                                <option value={500}>500</option>
                            </select>
                        </div>

                        <div className="filter-group">
                            <label className="filter-label">&nbsp;</label>
                            <button className="btn-primary" onClick={() => fetchAnalytics()} disabled={loading}>
                                {loading ? <><div className="spinner"></div><span>Loading...</span></> : <><i className="fas fa-sync-alt"></i><span>Load Data</span></>}
                            </button>
                        </div>

                        <div className="filter-group">
                            <label className="filter-label">&nbsp;</label>
                            <button className="btn-primary" onClick={downloadExcel}>
                                <i className="fas fa-file-excel"></i><span>Download Excel</span>
                            </button>
                        </div>
                    </div>
                </div>
                )}

                {/* ========== DATE PICKER OVERLAY ========== */}
                <div
                    className={`datepicker-overlay ${dpOpen ? 'visible' : ''}`}
                    onClick={(e) => { if (e.target === e.currentTarget) closeDatePicker(); }}
                >
                    <div className="datepicker-popup">
                        <div className="dp-presets">
                            <div className="dp-presets-title">Recently used</div>
                            {[
                                ['today','Today'],['yesterday','Yesterday'],['last7','Last 7 days'],
                                ['last14','Last 14 days'],['last28','Last 28 days'],['last30','Last 30 days'],
                                ['thisweek','This week'],['lastweek','Last week'],
                                ['thismonth','This month'],['lastmonth','Last month'],
                            ].map(([key, lbl]) => (
                                <button
                                    key={key}
                                    className={`dp-preset-item ${dpActivePreset === key ? 'active' : ''}`}
                                    onClick={() => applyPreset(key)}
                                >
                                    <span className="dp-preset-radio"></span> {lbl}
                                </button>
                            ))}
                        </div>

                        <div className="dp-calendars">
                            <div className="dp-compare-section">
                                <label className="dp-compare-label">
                                    <input
                                        type="checkbox"
                                        checked={dpTempIsComparison}
                                        onChange={(e) => {
                                            const c = e.target.checked;
                                            setDpTempIsComparison(c);
                                            if (c) {
                                                if (dpTempFrom && dpTempTo) {
                                                    const prev = getPreviousPeriod(toYMD(dpTempFrom), toYMD(dpTempTo));
                                                    setDpTempCompareFrom(parseYMD(prev.from));
                                                    setDpTempCompareTo(parseYMD(prev.to));
                                                    setDpCompareViewMonth(new Date(parseYMD(prev.from).getFullYear(), parseYMD(prev.from).getMonth(), 1));
                                                } else {
                                                    const today = new Date(); today.setHours(0,0,0,0);
                                                    const y = new Date(today); y.setDate(y.getDate() - 1);
                                                    setDpTempCompareFrom(new Date(y));
                                                    setDpTempCompareTo(new Date(y));
                                                    setDpCompareViewMonth(new Date(y.getFullYear(), y.getMonth(), 1));
                                                }
                                            } else {
                                                setDpTempCompareFrom(null);
                                                setDpTempCompareTo(null);
                                            }
                                        }}
                                    />
                                    <span>Compare</span>
                                </label>
                            </div>

                            <div className="dp-cal-header">
                                <div className="dp-cal-nav">
                                    <button onClick={() => setDpViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
                                        <i className="fas fa-chevron-left"></i>
                                    </button>
                                    <span className="month-year">
                                        {`${monthsList[dpViewMonth.getMonth()]} ${dpViewMonth.getFullYear()} - ${monthsList[(dpViewMonth.getMonth() + 1) % 12]} ${dpViewMonth.getMonth() === 11 ? dpViewMonth.getFullYear() + 1 : dpViewMonth.getFullYear()}`}
                                    </span>
                                    <button onClick={() => setDpViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
                                        <i className="fas fa-chevron-right"></i>
                                    </button>
                                </div>
                            </div>

                            <div className="dp-two-calendars">
                                {renderCalendar(dpViewMonth, dpTempFrom, dpTempTo, handleDayClick)}
                                {renderCalendar(new Date(dpViewMonth.getFullYear(), dpViewMonth.getMonth() + 1, 1), dpTempFrom, dpTempTo, handleDayClick)}
                            </div>

                            {dpTempIsComparison && (
                                <div className="dp-compare-range">
                                    <div className="dp-compare-header">Comparison Period</div>
                                    <div className="dp-cal-header">
                                        <div className="dp-cal-nav">
                                            <button onClick={() => setDpCompareViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
                                                <i className="fas fa-chevron-left"></i>
                                            </button>
                                            <span className="month-year">
                                                {`${monthsList[dpCompareViewMonth.getMonth()]} ${dpCompareViewMonth.getFullYear()} - ${monthsList[(dpCompareViewMonth.getMonth() + 1) % 12]} ${dpCompareViewMonth.getMonth() === 11 ? dpCompareViewMonth.getFullYear() + 1 : dpCompareViewMonth.getFullYear()}`}
                                            </span>
                                            <button onClick={() => setDpCompareViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
                                                <i className="fas fa-chevron-right"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="dp-two-calendars">
                                        {renderCalendar(dpCompareViewMonth, dpTempCompareFrom, dpTempCompareTo, handleCompareDayClick)}
                                        {renderCalendar(new Date(dpCompareViewMonth.getFullYear(), dpCompareViewMonth.getMonth() + 1, 1), dpTempCompareFrom, dpTempCompareTo, handleCompareDayClick)}
                                    </div>
                                </div>
                            )}

                            <div className="dp-footer">
                                <span className="dp-date-display">{dpSelectedDisplay}</span>
                                <button className="btn-cancel" onClick={closeDatePicker}>Cancel</button>
                                <button className="btn-update" onClick={confirmDatePicker}>Update</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ========== ALERT ========== */}
                {alert && (
                    <div className={`alert alert-${alert.type}`}>
                        <i className={`fas ${alert.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                        <span>{alert.message}</span>
                    </div>
                )}

                {/* ========== TOKEN UPDATE BOX ========== */}
                <div className={`token-box ${showTokenBox ? 'show' : ''}`}>
                    <input
                        type="text"
                        value={newToken}
                        onChange={(e) => setNewToken(e.target.value)}
                        placeholder="Enter new Meta Access Token"
                        style={{ padding: 8, width: 350, border: '1px solid #ccc', borderRadius: 4 }}
                    />
                    <button onClick={updateMetaToken} className="btn-primary">Update Token</button>
                </div>

                {/* ========== LEVEL TABS ========== */}
                <div className="level-tabs">
                    <button
                        className={`level-tab ${currentLevel === 'campaign' ? 'active' : ''}`}
                        onClick={() => switchLevel('campaign')}
                    >
                        <i className="fas fa-bullhorn"></i>
                        <span>Campaigns</span>
                        {selectedCampaignNamesRef.current.size > 0 && (
                            <span className="tab-badge">{selectedCampaignNamesRef.current.size} selected</span>
                        )}
                    </button>
                    <button
                        className={`level-tab ${currentLevel === 'adset' ? 'active' : ''}`}
                        onClick={() => switchLevel('adset')}
                    >
                        <i className="fas fa-layer-group"></i>
                        <span>Ad sets for {selectedCampaignNamesRef.current.size} Campaign</span>
                        {selectedCampaignNamesRef.current.size > 0 && adsetData.length > 0 && (
                            <span className="tab-badge">{adsetData.length}</span>
                        )}
                    </button>
                    <button
                        className={`level-tab ${currentLevel === 'ad' ? 'active' : ''}`}
                        onClick={() => switchLevel('ad')}
                    >
                        <i className="fas fa-ad"></i>
                        <span>Ads for {selectedAdsetNamesRef.current.size} Campaign</span>
                        {selectedAdsetNamesRef.current.size > 0 && adData.length > 0 && (
                            <span className="tab-badge">{adData.length}</span>
                        )}
                    </button>
                    <button
                        className={`level-tab ${currentLevel === 'version' ? 'active' : ''}`}
                        onClick={() => switchLevel('version')}
                    >
                        <i className="fas fa-chart-line"></i>
                        <span>Version Analysis</span>
                        {selectedVersionsVA.length > 0 && (
                            <span className="tab-badge">{selectedVersionsVA.length}</span>
                        )}
                    </button>
                    <button
                        className={`level-tab ${currentLevel === 'dayversion' ? 'active' : ''}`}
                        onClick={() => switchLevel('dayversion')}
                    >
                        <i className="fas fa-calendar-day"></i>
                        <span>Day_Version wise Analysis</span>
                        {dvRows.length > 0 && (
                            <span className="tab-badge">{dvRows.length}</span>
                        )}
                    </button>
                </div>

                {/* ========== TABLE or VERSION ANALYSIS or DAY-VERSION ========== */}
                {currentLevel === 'dayversion' ? (
                    <DayVersionAnalysisView
                        citVersions={citVersions}
                        inputMode={inputModeDV}
                        setInputMode={setInputModeDV}
                        selectedVersions={selectedVersionsDV}
                        toggleVersionPill={toggleVersionPillDV}
                        clearVersions={() => setSelectedVersionsDV([])}
                        fromDate={dvFromDate}
                        setFromDate={setDvFromDate}
                        toDate={dvToDate}
                        setToDate={setDvToDate}
                        viewMode={viewModeDV}
                        setViewMode={setViewModeDV}
                        effectiveView={dvEffectiveView}
                        rows={dvRows}
                        loading={dvLoading}
                        fetchData={fetchDayVersionAnalysis}
                        pillsExpanded={dvPillsExpanded}
                        setPillsExpanded={setDvPillsExpanded}
                        hiddenCols={dvHiddenCols}
                        toggleCol={toggleDvCol}
                        colMenuOpen={dvColMenuOpen}
                        setColMenuOpen={setDvColMenuOpen}
                    />
                ) : currentLevel === 'version' ? (
                    <VersionAnalysisView
                        citVersions={citVersions}
                        selectedVersionsVA={selectedVersionsVA}
                        toggleVersionPillVA={toggleVersionPillVA}
                        selectedMetricsVA={selectedMetricsVA}
                        toggleMetricVA={toggleMetricVA}
                        vaSearchTerm={vaSearchTerm}
                        setVaSearchTerm={setVaSearchTerm}
                        fetchVersionAnalysis={fetchVersionAnalysis}
                        vaLoading={vaLoading}
                        vaCampaigns={vaCampaigns}
                        expandedCampaignsVA={expandedCampaignsVA}
                        expandedAdsetsVA={expandedAdsetsVA}
                        toggleCampaignExpandVA={toggleCampaignExpandVA}
                        toggleAdsetExpandVA={toggleAdsetExpandVA}
                        adsetsCacheVA={adsetsCacheVA}
                        adsCacheVA={adsCacheVA}
                        loadingAdsetsVA={loadingAdsetsVA}
                        loadingAdsVA={loadingAdsVA}
                        exportCampaignCSV={exportCampaignCSV}
                        pillsExpandedVA={pillsExpandedVA}
                        setPillsExpandedVA={setPillsExpandedVA}
                        statusFilterVA={statusFilterVA}
                        setStatusFilterVA={setStatusFilterVA}
                        perCardMetricsVA={perCardMetricsVA}
                        togglePerCardMetric={togglePerCardMetric}
                        resetPerCardMetrics={resetPerCardMetrics}
                        loadedAdsetsVA={loadedAdsetsVA}
                        loadedAdsVA={loadedAdsVA}
                        clickLoadAdsets={clickLoadAdsets}
                        clickLoadAds={clickLoadAds}
                        finalReportOpen={finalReportOpen}
                        setFinalReportOpen={setFinalReportOpen}
                        finalReportSort={finalReportSort}
                        setFinalReportSort={setFinalReportSort}
                        notesCtx={{
                            allNotes,
                            saveNote,
                            fetchNoteHistory,
                            noteUser,
                            canAccessRemark2,
                        }}
                        notesFilter={notesFilter}
                        setNotesFilter={setNotesFilter}
                        noteHistory={noteHistory}
                        setNoteHistory={setNoteHistory}
                    />
                ) : (
                <div className="table-section">
                    <div className="table-wrapper" ref={tableWrapperRef}>
                        <table className="data-table" ref={dataTableRef}>
                            <thead>
                                <tr>
                                    <th className="checkbox-cell" style={{ display: currentLevel === 'ad' ? 'none' : '' }}>
                                        <input
                                            type="checkbox"
                                            className="custom-checkbox"
                                            checked={selectAllState.checked}
                                            ref={el => { if (el) el.indeterminate = selectAllState.indeterminate; }}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                        />
                                    </th>

                                    {currentLevel === 'campaign' && (
                                        <th className="campaign-column" onClick={() => handleSort('campaign_name')}>
                                            <div className="th-content">
                                                <span>Campaign</span>{renderSortIcon('campaign_name')}{renderFilterIcon('campaign')}
                                            </div>
                                        </th>
                                    )}
                                    {currentLevel === 'adset' && (
                                        <th className="adset-column" onClick={() => handleSort('adset_name')}>
                                            <div className="th-content">
                                                <span>Ad Set</span>{renderSortIcon('adset_name')}{renderFilterIcon('adset')}
                                            </div>
                                        </th>
                                    )}
                                    {currentLevel === 'ad' && (
                                        <th className="ad-column" onClick={() => handleSort('ad_name')}>
                                            <div className="th-content">
                                                <span>Ad</span>{renderSortIcon('ad_name')}{renderFilterIcon('ad')}
                                            </div>
                                        </th>
                                    )}

                                    <th onClick={() => handleSort('delivery_status')}>
                                        <div className="th-content"><span>Delivery</span>{renderSortIcon('delivery_status')}{renderFilterIcon('delivery')}</div>
                                    </th>
                                    <th onClick={() => handleSort('conversion_event')}>
                                        <div className="th-content"><span>Event</span>{renderSortIcon('conversion_event')}{renderFilterIcon('event')}</div>
                                    </th>
                                    <th onClick={() => handleSort('impressions')}>
                                        <div className="th-content"><span>Impressions</span>{renderSortIcon('impressions')}{renderFilterIcon('impressions')}</div>
                                    </th>
                                    <th onClick={() => handleSort('reach')}>
                                        <div className="th-content"><span>Reach</span>{renderSortIcon('reach')}{renderFilterIcon('reach')}</div>
                                    </th>
                                    <th onClick={() => handleSort('cpm')}>
                                        <div className="th-content"><span>CPM</span>{renderSortIcon('cpm')}{renderFilterIcon('cpm')}</div>
                                    </th>

                                    {METRIC_COLS.map(col => (
                                        <React.Fragment key={col.key}>
                                            <th onClick={() => handleSort(col.key)}>
                                                <div className="th-content">
                                                    <span>{col.label}</span>{renderSortIcon(col.key)}{renderFilterIcon(col.key)}
                                                    {col.expandable && renderExpandIcon(col.key)}
                                                </div>
                                            </th>
                                            {col.expandable && expandedColumns.has(col.key) && (
                                                <>
                                                    <th className="compare-header">
                                                        <div className="th-content" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                                                            <span style={{ fontSize: '11.5px' }}>{col.label}</span>
                                                            <small style={{ fontWeight: 400, fontSize: 10, color: 'var(--text-secondary)' }}>
                                                                {confirmedCompareFrom} to {confirmedCompareTo}
                                                            </small>
                                                        </div>
                                                    </th>
                                                    <th className="compare-header"><div className="th-content"><span>Change</span></div></th>
                                                    <th className="compare-header"><div className="th-content"><span>Change %</span></div></th>
                                                </>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {allData.length === 0 ? (
                                    <tr>
                                        <td colSpan={24} className="empty-state">
                                            <div className="empty-icon"><i className="fas fa-chart-bar"></i></div>
                                            <div className="empty-title">No Data Available</div>
                                            <div className="empty-text">Select a CIT version and click "Load Data" to view analytics</div>
                                        </td>
                                    </tr>
                                ) : allData.map((row, idx) => {
                                    const selected = isRowSelected(row);
                                    const noMeta = row.has_meta_data === false;
                                    const examPct = row.registrations > 0 ? ((row.exam_count / row.registrations) * 100).toFixed(1) + '%' : '-';
                                    return (
                                        <tr key={idx} className={selected ? 'selected' : ''}>
                                            <td className="checkbox-cell" style={{ display: currentLevel === 'ad' ? 'none' : '' }}>
                                                {currentLevel !== 'ad' && (
                                                    <input
                                                        type="checkbox"
                                                        className="custom-checkbox"
                                                        checked={selected}
                                                        onChange={(e) => handleRowCheckbox(row, e.target.checked)}
                                                    />
                                                )}
                                            </td>

                                            {currentLevel === 'campaign' && (
                                                <td className="campaign-column text-cell" title={row.campaign_name}>{row.campaign_name || '-'}</td>
                                            )}
                                            {currentLevel === 'adset' && (
                                                <td className="adset-column text-cell" title={row.adset_name}>{row.adset_name || '-'}</td>
                                            )}
                                            {currentLevel === 'ad' && (
                                                <td className="ad-column text-cell" title={row.ad_name}>{row.ad_name || '-'}</td>
                                            )}

                                            <td>{renderStatusCell(row)}</td>
                                            <td className="text-cell">{renderEventCell(row)}</td>
                                            <td className="number">{formatNumber(row.impressions || 0)}</td>
                                            <td className="number">{formatNumber(row.reach || 0)}</td>
                                            <td className="currency">{noMeta ? '-' : formatCurrency(row.cpm || 0)}</td>

                                            {METRIC_COLS.map(col => {
                                                let content;
                                                if (col.type === 'percent') content = examPct;
                                                else if (col.type === 'ratio') content = Number(row[col.key] || 0).toFixed(2);
                                                else if (col.type === 'currency') content = noMeta && col.key !== 'revenue' ? '-' : formatCurrency(row[col.key] || 0);
                                                else content = formatNumber(row[col.key] || 0);
                                                return (
                                                    <React.Fragment key={col.key}>
                                                        <td className={col.type === 'currency' ? 'currency' : 'number'}>{content}</td>
                                                        {col.expandable && expandedColumns.has(col.key) && renderCompareCells(col, row)}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ========== STICKY FOOTER ========== */}
                    {allData.length > 0 && (
                        <div className="footer-wrapper" ref={footerWrapperRef} style={{ display: 'block' }}>
                            <table className="footer-table" ref={footerTableRef}>
                                <tbody>
                                    <tr>
                                        <td className="checkbox-cell" style={{ display: currentLevel === 'ad' ? 'none' : '' }}></td>
                                        {currentLevel === 'campaign' && <td className="footer-label campaign-column">Totals</td>}
                                        {currentLevel === 'adset'    && <td className="footer-label adset-column">Totals</td>}
                                        {currentLevel === 'ad'       && <td className="footer-label ad-column">Totals</td>}
                                        <td></td>
                                        <td></td>
                                        <td className="number">{formatNumber(footerTotals.impressions)}</td>
                                        <td className="number">{formatNumber(footerTotals.reach)}</td>
                                        <td className="currency">{formatCurrency(footerTotals.cpm)}</td>

                                        {METRIC_COLS.map(col => {
                                            let content;
                                            if (col.type === 'percent')       content = footerTotals.exam_percent > 0 ? footerTotals.exam_percent.toFixed(1) + '%' : '-';
                                            else if (col.type === 'ratio')    content = Number(footerTotals[col.key] || 0).toFixed(2);
                                            else if (col.type === 'currency') content = formatCurrency(footerTotals[col.key === 'spend' ? 'spend' : col.key === 'revenue' ? 'revenue' : col.key] || 0);
                                            else content = formatNumber(footerTotals[col.key === 'registrations' ? 'reg' : col.key === 'exam_count' ? 'exam' : col.key === 'internship_count' ? 'intern' : col.key === 'second_internship' ? 'intern2' : col.key] || 0);
                                            return (
                                                <React.Fragment key={col.key}>
                                                    <td className={col.type === 'currency' ? 'currency' : 'number'}>{content}</td>
                                                    {col.expandable && expandedColumns.has(col.key) && (
                                                        <>
                                                            <td className="compare-col"></td>
                                                            <td className="compare-col"></td>
                                                            <td className="compare-col"></td>
                                                        </>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                )}

                {/* ========== COLUMN FILTER DROPDOWN ========== */}
                {filterDropdown.open && (
                    <div
                        className="column-filter-dropdown visible"
                        style={{ left: filterDropdown.x, top: filterDropdown.y }}
                    >
                        <div className="filter-search-box">
                            <i className="fas fa-search"></i>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={filterSearchTerm}
                                onChange={(e) => setFilterSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="filter-options">
                            {(() => {
                                const opts = filterDropdown.options || [];
                                const visible = opts.filter(v => v.toLowerCase().includes(filterSearchTerm.toLowerCase()));
                                const allChecked = pendingFilterValues.length === opts.length && opts.length > 0;
                                return (
                                    <>
                                        <div className="filter-option-item">
                                            <input
                                                type="checkbox"
                                                id="filter-select-all"
                                                checked={allChecked}
                                                onChange={(e) => toggleSelectAllFilter(e.target.checked, opts)}
                                            />
                                            <label htmlFor="filter-select-all">(Select All)</label>
                                        </div>
                                        {visible.map((v, i) => (
                                            <div key={i} className="filter-option-item">
                                                <input
                                                    type="checkbox"
                                                    id={`fv-${i}`}
                                                    checked={pendingFilterValues.includes(v)}
                                                    onChange={() => togglePendingValue(v)}
                                                />
                                                <label htmlFor={`fv-${i}`}>{v}</label>
                                            </div>
                                        ))}
                                    </>
                                );
                            })()}
                        </div>
                        <div className="filter-actions">
                            <button className="btn-filter-clear" onClick={clearColumnFilter}>Clear</button>
                            <button className="btn-filter-ok" onClick={applyColumnFilter}>OK</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* =========================================================================
   6. SMALL SUB-COMPONENT
   ========================================================================= */
function HeaderStat({ label, value }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
        </div>
    );
}

/* =========================================================================
   VERSION ANALYSIS VIEW - full tab content
   ========================================================================= */
function VersionAnalysisView(props) {
    const {
        citVersions, selectedVersionsVA, toggleVersionPillVA,
        selectedMetricsVA, toggleMetricVA,
        vaSearchTerm, setVaSearchTerm,
        fetchVersionAnalysis, vaLoading, vaCampaigns,
        expandedCampaignsVA, expandedAdsetsVA,
        toggleCampaignExpandVA, toggleAdsetExpandVA,
        adsetsCacheVA, adsCacheVA,
        loadingAdsetsVA, loadingAdsVA,
        exportCampaignCSV,
        pillsExpandedVA, setPillsExpandedVA,
        statusFilterVA, setStatusFilterVA,
        perCardMetricsVA, togglePerCardMetric, resetPerCardMetrics,
        loadedAdsetsVA, loadedAdsVA,
        clickLoadAdsets, clickLoadAds,
        finalReportOpen, setFinalReportOpen,
        finalReportSort, setFinalReportSort,
        notesCtx, notesFilter, setNotesFilter,
        noteHistory, setNoteHistory,
    } = props;

    const activeMetricsGlobal = VA_METRICS.filter(m => selectedMetricsVA.has(m.key));

    // Pills: show only first 12 by default, rest behind "Show more"
    const PILL_VISIBLE_DEFAULT = 12;
    const visibleVersions = pillsExpandedVA ? citVersions : citVersions.slice(0, PILL_VISIBLE_DEFAULT);
    const hasMorePills = citVersions.length > PILL_VISIBLE_DEFAULT;

    // Filter campaigns: search + status + notes
    const filteredCampaigns = (() => {
        let result = vaCampaigns;
        const t = vaSearchTerm.trim().toLowerCase();
        if (t) result = result.filter(c => c.campaign_name.toLowerCase().includes(t));
        if (statusFilterVA !== 'all') {
            result = result.filter(c => {
                const s = (c.delivery_status || 'UNKNOWN').toUpperCase();
                if (statusFilterVA === 'active')   return s === 'ACTIVE';
                if (statusFilterVA === 'paused')   return s === 'PAUSED';
                if (statusFilterVA === 'in_review')return s === 'IN_REVIEW';
                if (statusFilterVA === 'inactive') return s.includes('INACTIVE') || s.includes('DISAPPROVED') || s.includes('REJECTED');
                if (statusFilterVA === 'unknown')  return s === 'UNKNOWN' || s === '';
                return true;
            });
        }
        if (notesFilter) {
            // keep a campaign if it OR any of its loaded adsets/ads has a NON-EMPTY note
            // on a note_type the current user is allowed to see.
            // Without this guard, a row would match because of a remark2 note even when
            // the user can't access the Remark 2 column at all.
            const allNotes = notesCtx.allNotes;
            const canSeeR2 = !!notesCtx.canAccessRemark2;
            const hasNote = (type, name) => {
                const prefix = type + '|||' + name + '|||';
                return Object.keys(allNotes).some(k => {
                    if (!k.startsWith(prefix)) return false;
                    // Hide remark2-only matches from users who can't see that column
                    if (!canSeeR2 && k.endsWith('|||remark2')) return false;
                    // Ignore stale empty entries left behind after note deletion
                    const arr = allNotes[k];
                    return Array.isArray(arr) && arr.some(n => String(n.note || '').trim() !== '');
                });
            };
            result = result.filter(c => {
                if (hasNote('campaign', c.campaign_name)) return true;
                const adsets = adsetsCacheVA[c.campaign_name] || [];
                for (const a of adsets) {
                    if (hasNote('adset', a.adset_name)) return true;
                    const ads = adsCacheVA[c.campaign_name + '|||' + a.adset_name] || [];
                    for (const ad of ads) {
                        if (hasNote('ad', ad.ad_name)) return true;
                    }
                }
                return false;
            });
        }
        return result;
    })();

    // Show Final Reports button when: 2+ versions selected AND data loaded
    const canShowFinalReports = selectedVersionsVA.length >= 2 && vaCampaigns.length > 0;

    return (
        <div className="vwa-root">
            {/* ========== STICKY CONTROLS ========== */}
            <div className="vwa-sticky-controls">
                <div className="vwa-controls">
                    {/* Row 1: Version pills (with show more) */}
                    <div className="vwa-controls-row">
                        <div style={{ flex: 1, minWidth: 280 }}>
                            <label className="vwa-section-label">
                                Select CIT Versions (click to toggle)
                                {selectedVersionsVA.length > 0 && (
                                    <span style={{ marginLeft: 8, color: 'var(--primary)', fontWeight: 700 }}>
                                        — {selectedVersionsVA.length} selected
                                    </span>
                                )}
                            </label>
                            <div className={`vwa-pills-wrap ${pillsExpandedVA ? 'vwa-pills-expanded' : ''}`}>
                                <div className="vwa-version-pills">
                                    {citVersions.length === 0 && (
                                        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading versions...</span>
                                    )}
                                    {visibleVersions.map(v => (
                                        <button
                                            key={v}
                                            className={`vwa-version-pill ${selectedVersionsVA.includes(v) ? 'active' : ''}`}
                                            onClick={() => toggleVersionPillVA(v)}
                                        >
                                            {v}
                                        </button>
                                    ))}
                                    {hasMorePills && (
                                        <button
                                            className="vwa-show-more-pill"
                                            onClick={() => setPillsExpandedVA(e => !e)}
                                        >
                                            <i className={`fas fa-chevron-${pillsExpandedVA ? 'up' : 'down'}`}></i>
                                            {pillsExpandedVA ? 'Show less' : `Show more (${citVersions.length - PILL_VISIBLE_DEFAULT})`}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Metric switches + status filter + search + load + final-report */}
                    <div className="vwa-controls-row">
                        <div style={{ flex: 1 }}>
                            <label className="vwa-section-label">Metric Columns (global)</label>
                            <div className="vwa-metric-toggles">
                                {VA_METRICS.map(m => {
                                    const on = selectedMetricsVA.has(m.key);
                                    return (
                                        <label key={m.key} className={`vwa-switch-item ${on ? 'is-on' : ''}`}>
                                            <span className="vwa-switch">
                                                <input type="checkbox" checked={on} onChange={() => toggleMetricVA(m.key)} />
                                                <span className="vwa-switch-slider"></span>
                                            </span>
                                            <span>{m.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="vwa-status-filter">
                            <label className="vwa-section-label">Status Filter</label>
                            <select
                                value={statusFilterVA}
                                onChange={(e) => setStatusFilterVA(e.target.value)}
                            >
                                <option value="all">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="paused">Paused</option>
                                <option value="in_review">In Review</option>
                                <option value="inactive">Inactive / Rejected</option>
                                <option value="unknown">Unknown</option>
                            </select>
                        </div>

                        <div>
                            <label className="vwa-section-label">Notes Filter</label>
                            <label className={`vwa-notes-filter-toggle ${notesFilter ? 'is-on' : ''}`}>
                                <span className="vwa-switch">
                                    <input
                                        type="checkbox"
                                        checked={notesFilter}
                                        onChange={(e) => setNotesFilter(e.target.checked)}
                                    />
                                    <span className="vwa-switch-slider"></span>
                                </span>
                                <i className="fas fa-sticky-note"></i>
                                Only with notes
                            </label>
                        </div>

                        <div style={{ minWidth: 200 }}>
                            <label className="vwa-section-label">Search Campaigns</label>
                            <input
                                type="text"
                                className="filter-input"
                                placeholder="Filter by campaign name..."
                                value={vaSearchTerm}
                                onChange={(e) => setVaSearchTerm(e.target.value)}
                                style={{ height: 36 }}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                            <button
                                className="btn-primary"
                                onClick={fetchVersionAnalysis}
                                disabled={vaLoading || selectedVersionsVA.length === 0}
                            >
                                {vaLoading
                                    ? <><div className="spinner"></div><span>Loading...</span></>
                                    : <><i className="fas fa-chart-line"></i><span>Load Comparison</span></>}
                            </button>

                            {canShowFinalReports && (
                                <button
                                    className="vwa-final-btn"
                                    onClick={() => setFinalReportOpen(true)}
                                    title="Ranked comparison across all selected versions"
                                >
                                    <i className="fas fa-trophy"></i>
                                    See Final Reports
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ========== CAMPAIGN CARDS (scrollable area) ========== */}
            {vaLoading && <VASkeletonCards />}

            {!vaLoading && vaCampaigns.length === 0 && (
                <div className="vwa-empty">
                    <div className="vwa-empty-icon"><i className="fas fa-chart-bar"></i></div>
                    <div className="vwa-empty-title">No comparison data yet</div>
                    <div>Select 2 or more CIT versions above and click "Load Comparison".</div>
                </div>
            )}

            {!vaLoading && filteredCampaigns.length === 0 && vaCampaigns.length > 0 && (
                <div className="vwa-empty">
                    <div className="vwa-empty-title">No campaigns match your filter</div>
                </div>
            )}

            {!vaLoading && filteredCampaigns.map(campaign => {
                const cardMetricSet = perCardMetricsVA[campaign.campaign_name];
                const activeMetrics = cardMetricSet
                    ? VA_METRICS.filter(m => cardMetricSet.has(m.key))
                    : activeMetricsGlobal;
                const hasCardOverride = !!cardMetricSet;

                return (
                    <CampaignAccordion
                        key={campaign.campaign_name}
                        campaign={campaign}
                        activeMetrics={activeMetrics}
                        hasCardOverride={hasCardOverride}
                        cardMetricSet={cardMetricSet || selectedMetricsVA}
                        togglePerCardMetric={togglePerCardMetric}
                        resetPerCardMetrics={resetPerCardMetrics}
                        selectedVersionsVA={selectedVersionsVA}
                        expanded={expandedCampaignsVA.has(campaign.campaign_name)}
                        onToggle={() => toggleCampaignExpandVA(campaign.campaign_name)}
                        adsets={adsetsCacheVA[campaign.campaign_name]}
                        loadingAdsets={loadingAdsetsVA.has(campaign.campaign_name)}
                        adsetsLoaded={loadedAdsetsVA.has(campaign.campaign_name)}
                        onLoadAdsets={() => clickLoadAdsets(campaign.campaign_name)}
                        expandedAdsetsVA={expandedAdsetsVA}
                        toggleAdsetExpandVA={toggleAdsetExpandVA}
                        adsCacheVA={adsCacheVA}
                        loadingAdsVA={loadingAdsVA}
                        loadedAdsVA={loadedAdsVA}
                        clickLoadAds={clickLoadAds}
                        exportCampaignCSV={exportCampaignCSV}
                        notesCtx={notesCtx}
                    />
                );
            })}

            {/* ========== FINAL REPORT MODAL ========== */}
            {finalReportOpen && (
                <FinalReportModal
                    selectedVersions={selectedVersionsVA}
                    campaigns={vaCampaigns}
                    onClose={() => setFinalReportOpen(false)}
                    sort={finalReportSort}
                    setSort={setFinalReportSort}
                />
            )}

            {/* ========== NOTE HISTORY MODAL ========== */}
            {noteHistory && (
                <NoteHistoryModal
                    entity={noteHistory}
                    onClose={() => setNoteHistory(null)}
                />
            )}
        </div>
    );
}

/* Campaign-level accordion with per-card metric override + explicit Load Ad Sets button */
function CampaignAccordion({
    campaign, activeMetrics, hasCardOverride, cardMetricSet,
    togglePerCardMetric, resetPerCardMetrics,
    selectedVersionsVA,
    expanded, onToggle,
    adsets, loadingAdsets, adsetsLoaded, onLoadAdsets,
    expandedAdsetsVA, toggleAdsetExpandVA,
    adsCacheVA, loadingAdsVA, loadedAdsVA, clickLoadAds,
    exportCampaignCSV,
    notesCtx,
}) {
    const [metricDropdownOpen, setMetricDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!metricDropdownOpen) return;
        const onClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setMetricDropdownOpen(false);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', onClick), 0);
        return () => document.removeEventListener('mousedown', onClick);
    }, [metricDropdownOpen]);

    const rawStatus = (campaign.delivery_status || 'Unknown');
    const statusCls = 'vwa-status-' + rawStatus.toLowerCase().replace(/[^a-z]/g, '-');
    const statusLabel = rawStatus.replace(/_/g, ' ');

    return (
        <div className="vwa-campaign-card">
            <div className="vwa-campaign-header" onClick={onToggle}>
                <i className="fas fa-bullseye vwa-campaign-icon"></i>
                <span className="vwa-campaign-name" title={campaign.campaign_name}>
                    {campaign.campaign_name}
                </span>
                <span className={`vwa-status-badge ${statusCls}`}>{statusLabel}</span>

                {/* Per-card metric dropdown */}
                <div style={{ position: 'relative' }} ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
                    <button
                        className="vwa-card-metric-btn"
                        onClick={() => setMetricDropdownOpen(o => !o)}
                        title="Show/hide columns for this campaign only"
                    >
                        <i className="fas fa-sliders-h"></i>
                        Columns
                        {hasCardOverride && <span style={{ color: '#42b72a' }}>•</span>}
                    </button>
                    {metricDropdownOpen && (
                        <div className="vwa-card-metric-dropdown">
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 2 }}>
                                This campaign only
                            </div>
                            {VA_METRICS.map(m => {
                                const on = cardMetricSet.has(m.key);
                                return (
                                    <label key={m.key} className={`vwa-switch-item ${on ? 'is-on' : ''}`}>
                                        <span className="vwa-switch">
                                            <input
                                                type="checkbox"
                                                checked={on}
                                                onChange={() => togglePerCardMetric(campaign.campaign_name, m.key)}
                                            />
                                            <span className="vwa-switch-slider"></span>
                                        </span>
                                        <span>{m.label}</span>
                                    </label>
                                );
                            })}
                            {hasCardOverride && (
                                <button
                                    className="vwa-show-more-pill"
                                    style={{ marginTop: 4, width: '100%', fontSize: 11, padding: '4px 10px' }}
                                    onClick={() => { resetPerCardMetrics(campaign.campaign_name); setMetricDropdownOpen(false); }}
                                >
                                    Reset to global
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <button
                    className="vwa-btn-export"
                    onClick={(e) => { e.stopPropagation(); exportCampaignCSV(campaign); }}
                    title="Export this campaign's version data as CSV"
                >
                    <i className="fas fa-file-csv"></i> CSV
                </button>
                <i className={`fas fa-chevron-right vwa-chevron ${expanded ? 'expanded' : ''}`}></i>
            </div>

            <div className={`vwa-campaign-body vwa-collapsible ${expanded ? 'vwa-expanded' : 'vwa-collapsed'}`}>
                {/* Campaign-level version comparison table */}
                <VersionComparisonTable
                    versions={campaign.versions}
                    activeMetrics={activeMetrics}
                    entityName={campaign.campaign_name}
                    entityLabel="Campaign"
                    entityType="campaign"
                    notesCtx={notesCtx}
                />

                {/* Nested Ad Sets section */}
                <div className="vwa-adsets-wrap">
                    {!adsetsLoaded ? (
                        <button
                            className="vwa-load-more"
                            onClick={onLoadAdsets}
                        >
                            <i className="fas fa-chevron-down"></i>
                            Load Ad Sets in this campaign
                        </button>
                    ) : (
                        <>
                            <div className="vwa-section-label" style={{ marginBottom: 10 }}>
                                Ad Sets in this campaign
                                {loadingAdsets && <span className="vwa-spinner" style={{ marginLeft: 8 }}></span>}
                            </div>

                            {loadingAdsets && <VASkeletonRow cols={activeMetrics.length + 1} />}

                            {!loadingAdsets && adsets && adsets.length === 0 && (
                                <div className="vwa-empty" style={{ padding: 20, fontSize: 12 }}>
                                    No ad sets found for this campaign across the selected versions.
                                </div>
                            )}

                            {!loadingAdsets && adsets && adsets.map(adset => (
                                <AdsetAccordion
                                    key={adset.adset_name}
                                    adset={adset}
                                    campaignName={campaign.campaign_name}
                                    activeMetrics={activeMetrics}
                                    selectedVersionsVA={selectedVersionsVA}
                                    expanded={expandedAdsetsVA.has(campaign.campaign_name + '|||' + adset.adset_name)}
                                    onToggle={() => toggleAdsetExpandVA(campaign.campaign_name, adset.adset_name)}
                                    ads={adsCacheVA[campaign.campaign_name + '|||' + adset.adset_name]}
                                    loadingAds={loadingAdsVA.has(campaign.campaign_name + '|||' + adset.adset_name)}
                                    adsLoaded={loadedAdsVA.has(campaign.campaign_name + '|||' + adset.adset_name)}
                                    onLoadAds={() => clickLoadAds(campaign.campaign_name, adset.adset_name)}
                                    notesCtx={notesCtx}
                                />
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function AdsetAccordion({ adset, campaignName, activeMetrics, expanded, onToggle, ads, loadingAds, adsLoaded, onLoadAds, notesCtx }) {
    return (
        <div className="vwa-adset-card">
            <div className="vwa-adset-header" onClick={onToggle}>
                <i className="fas fa-layer-group vwa-adset-icon"></i>
                <span className="vwa-adset-name" title={adset.adset_name}>Ad Set: {adset.adset_name}</span>
                <i className={`fas fa-chevron-right vwa-chevron ${expanded ? 'expanded' : ''}`}></i>
            </div>

            <div className={`vwa-adset-body vwa-collapsible ${expanded ? 'vwa-expanded' : 'vwa-collapsed'}`}>
                <VersionComparisonTable
                    versions={adset.versions}
                    activeMetrics={activeMetrics}
                    entityName={adset.adset_name}
                    entityLabel="Ad Set"
                    entityType="adset"
                    parentCampaign={campaignName}
                    notesCtx={notesCtx}
                />

                <div className="vwa-ads-wrap">
                    {!adsLoaded ? (
                        <button
                            className="vwa-load-more"
                            onClick={onLoadAds}
                        >
                            <i className="fas fa-chevron-down"></i>
                            Load Ads in this ad set
                        </button>
                    ) : (
                        <>
                            <div className="vwa-section-label" style={{ marginBottom: 8 }}>
                                Ads in this ad set
                                {loadingAds && <span className="vwa-spinner" style={{ marginLeft: 8 }}></span>}
                            </div>

                            {loadingAds && <VASkeletonRow cols={activeMetrics.length + 1} />}

                            {!loadingAds && ads && ads.length === 0 && (
                                <div className="vwa-empty" style={{ padding: 16, fontSize: 12 }}>
                                    No ads found for this ad set across the selected versions.
                                </div>
                            )}

                            {!loadingAds && ads && ads.map(ad => (
                                <AdBlock
                                    key={ad.ad_name}
                                    ad={ad}
                                    activeMetrics={activeMetrics}
                                    campaignName={campaignName}
                                    adsetName={adset.adset_name}
                                    notesCtx={notesCtx}
                                />
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function AdBlock({ ad, activeMetrics, campaignName, adsetName, notesCtx }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="vwa-ad-card">
            <div className="vwa-ad-header" onClick={() => setOpen(o => !o)}>
                <i className="fas fa-ad"></i>
                <span className="vwa-ad-name" title={ad.ad_name}>{ad.ad_name}</span>
                <i className={`fas fa-chevron-right vwa-chevron ${open ? 'expanded' : ''}`}></i>
            </div>
            <div className={`vwa-ad-body vwa-collapsible ${open ? 'vwa-expanded' : 'vwa-collapsed'}`}>
                <VersionComparisonTable
                    versions={ad.versions}
                    activeMetrics={activeMetrics}
                    entityName={ad.ad_name}
                    entityLabel="Ad"
                    entityType="ad"
                    parentCampaign={campaignName}
                    parentAdset={adsetName}
                    notesCtx={notesCtx}
                />
            </div>
        </div>
    );
}

/* The actual version comparison table (used at all 3 levels)
   Shows entity (campaign/adset/ad) in a rowspan'd left column that stretches
   the full table height. Versions are sorted ascending by CIT number so the
   oldest version is the baseline and newer versions compare against it.
   Each version row has its own Remark (and Remark 2 if permitted) cell. */
function VersionComparisonTable({
    versions, activeMetrics, entityName, entityLabel,
    entityType, parentCampaign, parentAdset, notesCtx,
}) {
    const entityCellRef = useRef(null);
    const [entityWidth, setEntityWidth] = useState(0);
    const showEntityCol = !!(entityName && entityLabel);

    // Measure entity column width so the Version column can stick right next
    // to it at `left: entityWidth` when horizontally scrolling.
    useLayoutEffect(() => {
        if (!showEntityCol) { setEntityWidth(0); return; }
        const el = entityCellRef.current;
        if (!el) return;
        const measure = () => setEntityWidth(el.getBoundingClientRect().width);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        window.addEventListener('resize', measure);
        return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
    }, [showEntityCol, entityName]);

    if (!versions || versions.length === 0) {
        return <div className="vwa-empty" style={{ padding: 20, fontSize: 12 }}>No data</div>;
    }
    if (activeMetrics.length === 0) {
        return <div className="vwa-empty" style={{ padding: 20, fontSize: 12 }}>No metric columns selected. Enable at least one metric in the toggles above.</div>;
    }

    const sortedVersions = [...versions].sort((a, b) => {
        const na = parseInt((a.version || '').replace(/\D/g, ''), 10) || 0;
        const nb = parseInt((b.version || '').replace(/\D/g, ''), 10) || 0;
        return na - nb;
    });

    const showNotesCol  = !!(notesCtx && entityType && entityName);
    const showRemark2   = showNotesCol && notesCtx.canAccessRemark2;
    const versionStickyLeft = showEntityCol ? entityWidth : 0;

    return (
        <div className="vwa-table-wrap">
            <table className="vwa-table">
                <thead>
                    <tr>
                        {showEntityCol && <th style={{ minWidth: 520 }}>{entityLabel}</th>}
                        <th
                            className="vwa-version-header"
                            style={{ left: versionStickyLeft }}
                        >
                            Version
                        </th>
                        {activeMetrics.map(m => (
                            <th key={m.key}>{m.label}</th>
                        ))}
                        {showNotesCol && <th className="vwa-remark-header-1">Remark</th>}
                        {showRemark2   && <th className="vwa-remark-header-2">Remark 2</th>}
                    </tr>
                </thead>
                <tbody>
                    {sortedVersions.map((v, idx) => {
                        const prev = idx > 0 ? sortedVersions[idx - 1] : null;
                        const isBaseline = idx === 0;

                        return (
                            <tr key={v.version}>
                                {showEntityCol && idx === 0 && (
                                    <td
                                        ref={entityCellRef}
                                        className="vwa-entity-cell"
                                        rowSpan={sortedVersions.length}
                                        title={entityName}
                                    >
                                        <span className="vwa-entity-label-small">{entityLabel}</span>
                                        <span className="vwa-entity-name">{entityName}</span>
                                    </td>
                                )}
                                <td
                                    className="vwa-version-label"
                                    style={{ left: versionStickyLeft }}
                                >
                                    {v.version}
                                    {isBaseline && <span className="vwa-baseline-note">(baseline)</span>}
                                </td>
                                {activeMetrics.map(m => {
                                    if (v.no_data) {
                                        return <td key={m.key} className="vwa-no-data">{'\u2014'}</td>;
                                    }
                                    const cur = v[m.key];
                                    const pv  = prev && !prev.no_data ? prev[m.key] : null;
                                    const trend = isBaseline ? null : vaTrend(cur, pv, m.key);

                                    return (
                                        <td key={m.key}>
                                            {trend && trend.arrow && (
                                                <span className={trend.cls}>{trend.arrow}</span>
                                            )}
                                            {' '}
                                            <span>{vaFormat(cur, m.key)}</span>
                                            {trend && trend.pct !== 'N/A' && (
                                                <small className={`vwa-trend-small ${trend.cls}`}>
                                                    ({trend.pct})
                                                </small>
                                            )}
                                            {trend && trend.pct === 'N/A' && (
                                                <small className="vwa-trend-small vwa-no-data">(N/A)</small>
                                            )}
                                        </td>
                                    );
                                })}
                                {showNotesCol && (
                                    <td className="vwa-note-cell r1">
                                        <NoteCell
                                            entityType={entityType}
                                            entityName={entityName}
                                            versionName={v.version}
                                            noteType="remark1"
                                            parentCampaign={parentCampaign}
                                            parentAdset={parentAdset}
                                            notesCtx={notesCtx}
                                        />
                                    </td>
                                )}
                                {showRemark2 && (
                                    <td className="vwa-note-cell r2">
                                        <NoteCell
                                            entityType={entityType}
                                            entityName={entityName}
                                            versionName={v.version}
                                            noteType="remark2"
                                            parentCampaign={parentCampaign}
                                            parentAdset={parentAdset}
                                            notesCtx={notesCtx}
                                        />
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/* =========================================================================
   NOTE CELL — per (entity, version, note_type)
   - Preview mode: truncated note, hover tooltip shows all users' notes ABOVE
   - Edit mode: animated floating editor, Enter = save, Shift+Enter = newline,
     Escape = cancel
   ========================================================================= */
function NoteCell({
    entityType, entityName, versionName, noteType,
    parentCampaign, parentAdset, notesCtx,
}) {
    const { saveNote, fetchNoteHistory, noteUser, allNotes } = notesCtx;
    const [editing, setEditing]   = useState(false);
    const [hovering, setHovering] = useState(false);
    const [draftText, setDraftText] = useState('');
    const [saving, setSaving]     = useState(false);
    const [rect, setRect] = useState(null);
    const previewRef = useRef(null);
    const textareaRef = useRef(null);
    const editorRef = useRef(null);

    // Find notes for this specific (entity, version, note_type)
    const noteKey = entityType + '|||' + entityName + '|||' + versionName + '|||' + noteType;
    const notes = (allNotes && allNotes[noteKey]) || [];

    const myNote = notes.find(n => Number(n.user_id) === Number(noteUser.id));
    const otherNotes = notes.filter(n => Number(n.user_id) !== Number(noteUser.id));
    const totalCount = notes.length;

    // Focus textarea when editor opens
    useEffect(() => {
        if (editing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [editing]);

    // Measure preview cell position while editor or tooltip is visible so
    // portaled overlays stay anchored even if the page scrolls / resizes.
    useLayoutEffect(() => {
        if (!editing && !hovering) return;
        const measure = () => {
            if (previewRef.current) setRect(previewRef.current.getBoundingClientRect());
        };
        measure();
        window.addEventListener('scroll', measure, true);
        window.addEventListener('resize', measure);
        return () => {
            window.removeEventListener('scroll', measure, true);
            window.removeEventListener('resize', measure);
        };
    }, [editing, hovering]);

    // Close editor when the user clicks anywhere outside it (and outside
    // the preview cell that owns it). Clicking another cell's preview will
    // close this one and open that one on the same click.
    useEffect(() => {
        if (!editing) return;
        const onDocMouseDown = (e) => {
            const inEditor  = editorRef.current  && editorRef.current.contains(e.target);
            const inPreview = previewRef.current && previewRef.current.contains(e.target);
            if (!inEditor && !inPreview) {
                setEditing(false);
                setDraftText('');
            }
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [editing]);

    const startEdit = (e) => {
        if (e) e.stopPropagation();
        setDraftText(myNote ? myNote.note : '');
        setHovering(false);
        setEditing(true);
    };

    const cancel = (e) => {
        if (e) e.stopPropagation();
        setEditing(false);
        setDraftText('');
    };

    const commit = async (e) => {
        if (e) e.stopPropagation();
        setSaving(true);
        await saveNote({
            entityType, entityName, versionName, noteType,
            noteText: draftText.trim(),
            parentCampaign, parentAdset,
        });
        setSaving(false);
        setEditing(false);
        setDraftText('');
    };

    const onKeyDown = (e) => {
        // Enter saves (Shift+Enter for newline); Escape cancels
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    };

    const showHistory = (e) => {
        if (e) e.stopPropagation();
        fetchNoteHistory({ entityType, entityName, versionName, noteType });
    };

    // ---------- Compute portal positions (fixed, viewport-relative) ----------
    // Editor: 380px wide; anchor its right edge to the cell's right edge,
    // clamp so it never spills off the viewport.
    const editorStyle = (() => {
        if (!rect) return { visibility: 'hidden' };
        const EDITOR_W = 380;
        const MARGIN = 8;
        let left = rect.right - EDITOR_W - 4;
        if (left < MARGIN) left = MARGIN;
        if (left + EDITOR_W > window.innerWidth - MARGIN) {
            left = window.innerWidth - EDITOR_W - MARGIN;
        }
        let top = rect.top + 4;
        // If editor would run past bottom, nudge it up
        const EDITOR_EST_H = 200;
        if (top + EDITOR_EST_H > window.innerHeight - MARGIN) {
            top = Math.max(MARGIN, window.innerHeight - EDITOR_EST_H - MARGIN);
        }
        return {
            position: 'fixed',
            top: `${top}px`,
            left: `${left}px`,
            width: `${EDITOR_W}px`,
        };
    })();

    // Tooltip: anchor bottom-right to cell's top-right, translated above.
    const tooltipStyle = (() => {
        if (!rect) return { visibility: 'hidden' };
        const MARGIN = 8;
        return {
            position: 'fixed',
            top: `${rect.top}px`,
            left: `${Math.min(rect.right, window.innerWidth - MARGIN)}px`,
            transform: 'translate(-100%, calc(-100% - 8px))',
        };
    })();

    const labelColor = noteType === 'remark1' ? 'Remark' : 'Remark 2';

    // ---------- PREVIEW + portaled overlays ----------
    const displayText = myNote
        ? myNote.note
        : (otherNotes.length > 0 ? otherNotes[0].note : null);

    return (
        <>
            <div
                ref={previewRef}
                className="vwa-note-preview"
                onClick={editing ? undefined : startEdit}
                onMouseEnter={() => !editing && totalCount > 0 && setHovering(true)}
                onMouseLeave={() => setHovering(false)}
                title={editing ? undefined : (displayText || 'Click to add a note')}
            >
                {displayText ? (
                    <>
                        {!myNote && otherNotes.length > 0 && (
                            <span style={{ color: '#64748b', fontSize: 10.5, fontWeight: 600 }}>
                                {otherNotes[0].user_name}:
                            </span>
                        )}
                        <span className="vwa-note-preview-text">{displayText}</span>
                        {totalCount > 1 && (
                            <span className="vwa-note-count-pill">+{totalCount - 1}</span>
                        )}
                    </>
                ) : (
                    <span className="vwa-note-preview-empty">
                        <i className="fas fa-plus" style={{ marginRight: 4, fontSize: 9 }} />
                        Add note...
                    </span>
                )}
            </div>

            {/* Editor portal — floats above page, escapes overflow:hidden parents */}
            {editing && createPortal(
                <div
                    ref={editorRef}
                    className={`vwa-note-editor-overlay ${noteType === 'remark1' ? 'r1' : 'r2'}`}
                    style={editorStyle}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="vwa-note-editor-label">
                        <i className={`fas ${noteType === 'remark1' ? 'fa-sticky-note' : 'fa-bookmark'}`}></i>
                        {labelColor} — {versionName}
                    </div>
                    <textarea
                        ref={textareaRef}
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="Write your note... (leave empty to delete)"
                    />
                    <div className="vwa-note-editor-hint">
                        <kbd>Enter</kbd> save &nbsp; <kbd>Shift</kbd>+<kbd>Enter</kbd> new line &nbsp; <kbd>Esc</kbd> cancel
                    </div>
                    <div className="vwa-note-editor-actions">
                        <button
                            className="vwa-note-editor-btn save"
                            onClick={commit}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : (myNote ? 'Update' : 'Save')}
                        </button>
                        <button
                            className="vwa-note-editor-btn cancel"
                            onClick={cancel}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        {totalCount > 0 && (
                            <button
                                className="vwa-note-editor-btn history"
                                onClick={showHistory}
                                title="View edit history"
                                type="button"
                            >
                                <i className="fas fa-history" /> History
                            </button>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Tooltip portal — floats above cell, escapes overflow:hidden parents */}
            {hovering && !editing && totalCount > 0 && createPortal(
                <div
                    className={`vwa-note-tooltip ${noteType === 'remark1' ? 'r1' : 'r2'} is-open`}
                    style={tooltipStyle}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="vwa-note-tooltip-title">
                        <span>Notes for {versionName}</span>
                        <span>{totalCount} {totalCount === 1 ? 'user' : 'users'}</span>
                    </div>
                    {notes.map(n => (
                        <div key={n.id} className="vwa-note-tooltip-item">
                            <span className="vwa-note-tooltip-user">{n.user_name}:</span>
                            <span className="vwa-note-tooltip-text">{n.note}</span>
                            {n.updated_at && (
                                <span className="vwa-note-tooltip-time">
                                    <i className="far fa-clock" style={{ marginRight: 3 }} />
                                    {String(n.updated_at).replace('T', ' ').slice(0, 19)}
                                </span>
                            )}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}

/* =========================================================================
   NOTE HISTORY MODAL — full audit log for one entity.
   ========================================================================= */
function NoteHistoryModal({ entity, onClose }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const rows = entity.rows || [];
    return (
        <div className="vwa-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="vwa-modal" style={{ maxWidth: 720 }}>
                <div className="vwa-modal-header">
                    <div className="vwa-modal-title">
                        <i className="fas fa-history"></i>
                        <span>Edit History</span>
                    </div>
                    <button className="vwa-modal-close" onClick={onClose} title="Close (Esc)">
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="vwa-modal-body vwa-history-modal-body">
                    <div className="vwa-modal-subtitle">
                        <b style={{ textTransform: 'capitalize' }}>{entity.entityType}:</b>{' '}
                        {entity.entityName}
                        {entity.versionName && (
                            <>
                                {' '}&middot;{' '}
                                <b>{entity.versionName}</b>
                            </>
                        )}
                        {entity.noteType && (
                            <>
                                {' '}&middot;{' '}
                                <span style={{
                                    padding: '2px 8px', borderRadius: 10,
                                    background: entity.noteType === 'remark1' ? '#fef3c7' : '#dbeafe',
                                    color: entity.noteType === 'remark1' ? '#92400e' : '#1d4ed8',
                                    fontSize: 11, fontWeight: 700,
                                }}>
                                    {entity.noteType === 'remark1' ? 'Remark' : 'Remark 2'}
                                </span>
                            </>
                        )}
                    </div>

                    {rows.length === 0 && (
                        <div className="vwa-empty" style={{ padding: 20 }}>
                            No history recorded yet.
                        </div>
                    )}

                    {rows.map(r => (
                        <div key={r.id} className={`vwa-history-entry ${r.action}`}>
                            <div className="vwa-history-meta">
                                <span className={`vwa-history-action ${r.action}`}>{r.action}</span>
                                <span className="vwa-history-user">{r.user_name}</span>
                                <span>{r.created_at}</span>
                            </div>
                            {r.action === 'create' && r.new_note && (
                                <div className="vwa-history-diff">
                                    <div className="vwa-history-new">{r.new_note}</div>
                                </div>
                            )}
                            {r.action === 'update' && (
                                <div className="vwa-history-diff">
                                    {r.old_note && <div className="vwa-history-old">{r.old_note}</div>}
                                    {r.new_note && <div className="vwa-history-new">{r.new_note}</div>}
                                </div>
                            )}
                            {r.action === 'delete' && r.old_note && (
                                <div className="vwa-history-diff">
                                    <div className="vwa-history-old">{r.old_note}</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* Skeleton cards while the main campaign list is loading */
function VASkeletonCards() {
    return (
        <>
            {[0, 1, 2].map(i => (
                <div key={i} className="vwa-campaign-card">
                    <div className="vwa-campaign-header">
                        <div className="vwa-skeleton-cell" style={{ width: 16, height: 16 }}></div>
                        <div className="vwa-skeleton-cell" style={{ flex: 1, height: 14 }}></div>
                        <div className="vwa-skeleton-cell" style={{ width: 60, height: 14 }}></div>
                    </div>
                    <div className="vwa-campaign-body">
                        <VASkeletonRow cols={7} />
                        <VASkeletonRow cols={7} />
                        <VASkeletonRow cols={7} />
                    </div>
                </div>
            ))}
        </>
    );
}

function VASkeletonRow({ cols = 7 }) {
    return (
        <div className="vwa-skeleton-row" style={{ gridTemplateColumns: `80px repeat(${cols - 1}, 1fr)` }}>
            {Array.from({ length: cols }).map((_, i) => (
                <div key={i} className="vwa-skeleton-cell"></div>
            ))}
        </div>
    );
}

/* =========================================================================
   FINAL REPORT MODAL — aggregated per-version performance, sortable.
   Sums spend/impressions/clicks/registrations/exams/revenue across all
   campaigns for each selected version, recomputes the 6 metrics, then
   sorts by the chosen column. Default: ROI descending (best on top).
   ========================================================================= */
function FinalReportModal({ selectedVersions, campaigns, onClose, sort, setSort }) {

    // Close on ESC
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Aggregate per-version totals across all campaigns
    const rows = (() => {
        return selectedVersions.map(v => {
            let spend = 0, imp = 0, clicks = 0, reg = 0, exams = 0, rev = 0;
            let campaignsWithData = 0;
            campaigns.forEach(c => {
                const vData = c.versions && c.versions.find(x => x.version === v);
                if (vData && !vData.no_data) {
                    spend  += Number(vData.spend)         || 0;
                    imp    += Number(vData.impressions)   || 0;
                    clicks += Number(vData.clicks)        || 0;
                    reg    += Number(vData.registrations) || 0;
                    exams  += Number(vData.exams)         || 0;
                    rev    += Number(vData.revenue)       || 0;
                    campaignsWithData++;
                }
            });
            return {
                version: v,
                spend, impressions: imp, clicks, registrations: reg, exams, revenue: rev,
                campaigns: campaignsWithData,
                cpm:           imp    > 0 ? (spend / imp * 1000)         : 0,
                cpc:           clicks > 0 ? (spend / clicks)             : 0,
                ctr:           imp    > 0 ? (clicks / imp * 100)         : 0,
                cpl:           reg    > 0 ? (spend / reg)                : 0,
                cost_per_exam: exams  > 0 ? (spend / exams)              : 0,
                roi:           spend  > 0 ? (rev / spend)                : 0,
            };
        });
    })();

    // Sort
    const sorted = [...rows].sort((a, b) => {
        const va = Number(a[sort.key]) || 0;
        const vb = Number(b[sort.key]) || 0;
        return sort.dir === 'asc' ? va - vb : vb - va;
    });

    const clickSort = (key) => {
        setSort(prev => {
            if (prev.key === key) {
                return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
            }
            return { key, dir: 'desc' };
        });
    };

    // Column definitions for the modal
    const cols = [
        { key: 'version',        label: 'Version',       fmt: (v) => v, sortable: false, cellClass: 'vwa-version-cell' },
        { key: 'cpm',            label: 'CPM',           fmt: (v) => '\u20B9' + Math.round(v).toLocaleString('en-IN') },
        { key: 'cpc',            label: 'CPC',           fmt: (v) => '\u20B9' + Number(v).toFixed(2) },
        { key: 'ctr',            label: 'CTR',           fmt: (v) => Number(v).toFixed(2) + '%' },
        { key: 'cpl',            label: 'CPL',           fmt: (v) => '\u20B9' + Math.round(v).toLocaleString('en-IN') },
        { key: 'cost_per_exam',  label: 'Cost Per Exam', fmt: (v) => '\u20B9' + Math.round(v).toLocaleString('en-IN') },
        { key: 'roi',            label: 'ROI',           fmt: (v) => Number(v).toFixed(2) },
        { key: 'spend',          label: 'Spend',         fmt: (v) => '\u20B9' + Math.round(v).toLocaleString('en-IN') },
        { key: 'revenue',        label: 'Revenue',       fmt: (v) => '\u20B9' + Math.round(v).toLocaleString('en-IN') },
        { key: 'registrations',  label: 'Regs',          fmt: (v) => Number(v).toLocaleString('en-IN') },
        { key: 'exams',          label: 'Exams',         fmt: (v) => Number(v).toLocaleString('en-IN') },
    ];

    const sortMetricOptions = cols.filter(c => c.sortable !== false);

    return (
        <div className="vwa-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="vwa-modal">
                <div className="vwa-modal-header">
                    <div className="vwa-modal-title">
                        <i className="fas fa-trophy"></i>
                        <span>Final Reports — Version Leaderboard</span>
                    </div>
                    <button className="vwa-modal-close" onClick={onClose} title="Close (Esc)">
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="vwa-modal-body">
                    <div className="vwa-modal-subtitle">
                        Aggregated totals across all {campaigns.length} campaigns.
                        Default sort: highest <b>{sortMetricOptions.find(c => c.key === sort.key)?.label || sort.key}</b> on top.
                        Click any column header to re-sort.
                    </div>

                    <div className="vwa-modal-controls">
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Sort by:</span>
                        <select
                            className="vwa-modal-sort-select"
                            value={sort.key}
                            onChange={(e) => setSort({ key: e.target.value, dir: sort.dir })}
                        >
                            {sortMetricOptions.map(c => (
                                <option key={c.key} value={c.key}>{c.label}</option>
                            ))}
                        </select>
                        <select
                            className="vwa-modal-sort-select"
                            value={sort.dir}
                            onChange={(e) => setSort({ key: sort.key, dir: e.target.value })}
                        >
                            <option value="desc">Highest to Lowest</option>
                            <option value="asc">Lowest to Highest</option>
                        </select>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                            Rows sorted by selected metric. Column headers also work.
                        </span>
                    </div>

                    <table className="vwa-modal-table">
                        <thead>
                            <tr>
                                <th style={{ width: 60 }}>#</th>
                                {cols.map(c => (
                                    <th
                                        key={c.key}
                                        onClick={() => c.sortable !== false && clickSort(c.key)}
                                        className={sort.key === c.key ? 'sort-active' : ''}
                                        style={{ cursor: c.sortable === false ? 'default' : 'pointer' }}
                                    >
                                        {c.label}
                                        {c.sortable !== false && (
                                            <span className="sort-ind">
                                                {sort.key === c.key
                                                    ? (sort.dir === 'asc' ? '\u25B2' : '\u25BC')
                                                    : '\u25B4\u25BE'}
                                            </span>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((r, idx) => (
                                <tr key={r.version}>
                                    <td><span className="vwa-rank">{idx + 1}</span></td>
                                    {cols.map(c => (
                                        <td key={c.key} className={c.cellClass || ''}>
                                            {c.fmt(r[c.key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {sorted.length === 0 && (
                        <div className="vwa-empty" style={{ marginTop: 20 }}>
                            <div className="vwa-empty-title">No data to rank</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* =========================================================================
   DAY / VERSION WISE ANALYSIS - column definitions + view component
   ========================================================================= */

/* Each top-level column may render a single value OR a stacked block of
   count / "% of reg" / cost-per-unit (matches the user's reference image).
   `kind` describes how to colour the cell:
     'higher-better'  -> high values  -> green band, low -> red
     'lower-better'   -> low values   -> green band, high -> red
     'neutral'        -> no colouring
   `denom` lists which sub-fields use the registrations count as denominator
   for the % line. */
const DV_COLUMNS = [
    { key: 'label',                 label: 'Date / Version',            kind: 'neutral',       width: 130, sticky: true, type: 'label'                       },
    { key: 'spend',                 label: 'Meta Spent',                kind: 'lower-better',  width: 110,                type: 'value', format: 'currency' },
    { key: 'registrations',         label: 'Registration Count',        kind: 'higher-better', width: 130,                type: 'value', format: 'int'      },
    { key: 'cost_per_registration', label: 'Cost per Registration',     kind: 'lower-better',  width: 140,                type: 'value', format: 'currency' },
    { key: 'exam_count',            label: 'Exam Taken Count',          kind: 'higher-better', width: 130,                type: 'value', format: 'int'      },
    { key: 'cost_per_exam',         label: 'Cost per Exam',             kind: 'lower-better',  width: 120,                type: 'value', format: 'currency' },
    { key: 'exam_percentage',       label: 'Exam %',                    kind: 'higher-better', width: 90,                 type: 'value', format: 'percent'  },
    { key: 'internship_count',      label: 'Internship Purchase Once',  kind: 'higher-better', width: 170,                type: 'value', format: 'int'      },
    { key: 'second_internship',     label: 'Internship Purchase Twice', kind: 'higher-better', width: 170,                type: 'value', format: 'int'      },
    { key: 'revenue',               label: 'Revenue',                   kind: 'higher-better', width: 120,                type: 'value', format: 'currency' },
    { key: 'roi',                   label: 'ROI',                       kind: 'higher-better', width: 80,                 type: 'value', format: 'ratio'    },
];

const DV_FMT_CURRENCY = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const DV_FMT_INT      = (v) => Number(v || 0).toLocaleString('en-IN');
const DV_FMT_RATIO    = (v) => Number(v || 0).toFixed(2);
const DV_FMT_DATE     = (s) => {
    if (!s) return '—';
    const [y, m, d] = s.split('-').map(Number);
    if (!y) return s;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d} ${months[m-1]} ${y}`;
};

/* Build "% of registrations" string. Returns "—" when reg = 0. */
function dvPct(num, reg) {
    if (!reg || reg <= 0) return '0.00%';
    return ((Number(num || 0) / reg) * 100).toFixed(2) + '%';
}

/* Heat-map colour band given a value vs that column's min/max.
   Returns a tailwind-style class string we map in CSS to a background tint. */
function dvBand(val, min, max, kind) {
    if (kind === 'neutral') return '';
    if (max === min) return 'dv-band-3'; // all equal -> neutral mid colour
    const norm = (val - min) / (max - min); // 0..1
    let score = kind === 'higher-better' ? norm : 1 - norm; // 1 = best
    if (score < 0.2) return 'dv-band-1';
    if (score < 0.4) return 'dv-band-2';
    if (score < 0.6) return 'dv-band-3';
    if (score < 0.8) return 'dv-band-4';
    return 'dv-band-5';
}

/* Lightweight, single-period date range picker for the Day/Version tab.
   Reuses the dp-* / cal-* CSS from the main analytics date picker but is
   completely self-contained — no comparison, no shared state. */
function DvDateRangePicker({ fromDate, toDate, onApply }) {
    const [open, setOpen] = useState(false);
    const [tempFrom, setTempFrom] = useState(null);
    const [tempTo,   setTempTo]   = useState(null);
    const [viewMonth, setViewMonth] = useState(new Date());
    const [activePreset, setActivePreset] = useState(null);

    const monthsList = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const openPicker = () => {
        const f = fromDate ? parseYMD(fromDate) : null;
        const t = toDate   ? parseYMD(toDate)   : null;
        setTempFrom(f);
        setTempTo(t);
        setActivePreset(null);
        const anchor = f || new Date();
        setViewMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
        setOpen(true);
    };
    const closePicker = () => setOpen(false);

    const handleDayClick = (d) => {
        if (!tempFrom || (tempFrom && tempTo)) {
            setTempFrom(d); setTempTo(null);
        } else {
            let from = tempFrom, to = d;
            if (d < tempFrom) { from = d; to = tempFrom; }
            setTempFrom(from); setTempTo(to);
        }
        setActivePreset(null);
    };

    const applyPreset = (preset) => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        let from, to;
        switch (preset) {
            case 'today':     from = new Date(today); to = new Date(today); break;
            case 'yesterday': from = new Date(today); from.setDate(from.getDate() - 1); to = new Date(from); break;
            case 'last7':     to = new Date(today); from = new Date(today); from.setDate(from.getDate() - 6); break;
            case 'last14':    to = new Date(today); from = new Date(today); from.setDate(from.getDate() - 13); break;
            case 'last28':    to = new Date(today); from = new Date(today); from.setDate(from.getDate() - 27); break;
            case 'last30':    to = new Date(today); from = new Date(today); from.setDate(from.getDate() - 29); break;
            case 'thisweek':  from = new Date(today); from.setDate(from.getDate() - from.getDay()); to = new Date(today); break;
            case 'lastweek':  to = new Date(today); to.setDate(to.getDate() - today.getDay() - 1); from = new Date(to); from.setDate(from.getDate() - 6); break;
            case 'thismonth': from = new Date(today.getFullYear(), today.getMonth(), 1); to = new Date(today); break;
            case 'lastmonth': to = new Date(today.getFullYear(), today.getMonth(), 0); from = new Date(today.getFullYear(), today.getMonth() - 1, 1); break;
            default: return;
        }
        setTempFrom(from); setTempTo(to);
        setActivePreset(preset);
        setViewMonth(new Date(from.getFullYear(), from.getMonth(), 1));
    };

    const confirm = () => {
        if (!tempFrom || !tempTo) return;
        onApply(toYMD(tempFrom), toYMD(tempTo));
        setOpen(false);
    };

    const renderCalendar = (monthDate) => {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrev = new Date(year, month, 0).getDate();
        const today = new Date(); today.setHours(0,0,0,0);
        const cells = [];
        for (let i = firstDay - 1; i >= 0; i--) {
            const d = daysInPrev - i;
            const prev = new Date(year, month - 1, d);
            cells.push(<button key={'p'+d} className="cal-day other-month" onClick={() => handleDayClick(prev)}>{d}</button>);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const current = new Date(year, month, d);
            const cls = ['cal-day'];
            if (current.getTime() === today.getTime()) cls.push('today');
            if (tempFrom && tempTo) {
                const t = current.getTime(), sf = tempFrom.getTime(), se = tempTo.getTime();
                if (t === sf && t === se) cls.push('selected-start','selected-end');
                else if (t === sf) cls.push('selected-start');
                else if (t === se) cls.push('selected-end');
                else if (t > sf && t < se) cls.push('in-range');
            } else if (tempFrom && current.getTime() === tempFrom.getTime()) {
                cls.push('selected-start','selected-end');
            }
            cells.push(<button key={'c'+d} className={cls.join(' ')} onClick={() => handleDayClick(current)}>{d}</button>);
        }
        const remaining = (7 - ((firstDay + daysInMonth) % 7)) % 7;
        for (let d = 1; d <= remaining; d++) {
            const next = new Date(year, month + 1, d);
            cells.push(<button key={'n'+d} className="cal-day other-month" onClick={() => handleDayClick(next)}>{d}</button>);
        }
        return (
            <div className="dp-calendar">
                <div className="cal-month-title">{monthsList[month]} {year}</div>
                <div className="cal-weekdays">
                    <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>
                <div className="cal-days">{cells}</div>
            </div>
        );
    };

    const display = (() => {
        if (!fromDate || !toDate) return 'Select date range...';
        const f = parseYMD(fromDate), t = parseYMD(toDate);
        const fl = `${f.getDate()} ${monthsList[f.getMonth()].slice(0,3)} ${f.getFullYear()}`;
        const tl = `${t.getDate()} ${monthsList[t.getMonth()].slice(0,3)} ${t.getFullYear()}`;
        return fromDate === toDate ? fl : `${fl} — ${tl}`;
    })();

    const summary = (() => {
        if (!tempFrom) return 'Select start date';
        if (!tempTo)   return `${tempFrom.getDate()} ${monthsList[tempFrom.getMonth()].slice(0,3)} — Select end date`;
        const f = `${tempFrom.getDate()} ${monthsList[tempFrom.getMonth()].slice(0,3)}`;
        const t = `${tempTo.getDate()} ${monthsList[tempTo.getMonth()].slice(0,3)}`;
        return `${f} — ${t}`;
    })();

    return (
        <>
            <button className="date-range-btn" onClick={openPicker} type="button">
                <span><div className="dr-dates">{display}</div></span>
                <i className="fas fa-calendar dr-icon"></i>
            </button>

            <div
                className={`datepicker-overlay ${open ? 'visible' : ''}`}
                onClick={(e) => { if (e.target === e.currentTarget) closePicker(); }}
            >
                <div className="datepicker-popup">
                    <div className="dp-presets">
                        <div className="dp-presets-title">Recently used</div>
                        {[
                            ['today','Today'],['yesterday','Yesterday'],['last7','Last 7 days'],
                            ['last14','Last 14 days'],['last28','Last 28 days'],['last30','Last 30 days'],
                            ['thisweek','This week'],['lastweek','Last week'],
                            ['thismonth','This month'],['lastmonth','Last month'],
                        ].map(([key, lbl]) => (
                            <button
                                key={key}
                                className={`dp-preset-item ${activePreset === key ? 'active' : ''}`}
                                onClick={() => applyPreset(key)}
                                type="button"
                            >
                                <span className="dp-preset-radio"></span> {lbl}
                            </button>
                        ))}
                    </div>

                    <div className="dp-calendars">
                        <div className="dp-cal-header">
                            <div className="dp-cal-nav">
                                <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
                                    <i className="fas fa-chevron-left"></i>
                                </button>
                                <span className="month-year">
                                    {`${monthsList[viewMonth.getMonth()]} ${viewMonth.getFullYear()} - ${monthsList[(viewMonth.getMonth() + 1) % 12]} ${viewMonth.getMonth() === 11 ? viewMonth.getFullYear() + 1 : viewMonth.getFullYear()}`}
                                </span>
                                <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
                                    <i className="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>

                        <div className="dp-two-calendars">
                            {renderCalendar(viewMonth)}
                            {renderCalendar(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                        </div>

                        <div className="dp-footer">
                            <span className="dp-date-display">{summary}</span>
                            <button className="btn-cancel"  type="button" onClick={closePicker}>Cancel</button>
                            <button className="btn-update"  type="button" onClick={confirm}>Update</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function DayVersionAnalysisView(props) {
    const {
        citVersions,
        inputMode, setInputMode,
        selectedVersions, toggleVersionPill, clearVersions,
        fromDate, setFromDate, toDate, setToDate,
        viewMode, setViewMode,
        effectiveView,
        rows, loading,
        fetchData,
        pillsExpanded, setPillsExpanded,
        hiddenCols, toggleCol,
        colMenuOpen, setColMenuOpen,
    } = props;

    /* Column resize state for this view (independent from main table) */
    const tableRef = useRef(null);
    const viewRef  = useRef(null);
    const stickyRef = useRef(null);

    /* Measure the sticky controls bar after every render and expose its height
       as --dv-thead-top so the table header sticks just below it on scroll. */
    useLayoutEffect(() => {
        const view = viewRef.current;
        const sticky = stickyRef.current;
        if (!view || !sticky) return;
        const apply = () => {
            // 70 = admin top bar (62) + 8px breathing space
            const offset = 70 + sticky.offsetHeight + 4;
            view.style.setProperty('--dv-thead-top', offset + 'px');
        };
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(sticky);
        window.addEventListener('resize', apply);
        return () => { ro.disconnect(); window.removeEventListener('resize', apply); };
    }, [inputMode, pillsExpanded, colMenuOpen, rows.length]);

    useEffect(() => {
        const table = tableRef.current;
        if (!table) return;
        const heads = table.querySelectorAll('thead th');
        heads.forEach(th => {
            if (th.querySelector('.dv-col-resizer')) return;
            const handle = document.createElement('div');
            handle.className = 'dv-col-resizer';
            handle.addEventListener('click', (ev) => ev.stopPropagation());
            th.appendChild(handle);
        });

        let startX = 0, startW = 0, colIdx = -1, active = null;
        const onMove = (e) => {
            if (colIdx < 0) return;
            const w = Math.max(60, startW + (e.pageX - startX));
            table.querySelectorAll(`th:nth-child(${colIdx + 1}), td:nth-child(${colIdx + 1})`).forEach(el => {
                el.style.width = w + 'px';
                el.style.minWidth = w + 'px';
                el.style.maxWidth = w + 'px';
            });
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (active) active.classList.remove('resizing');
            colIdx = -1; active = null;
        };
        const onDown = (e) => {
            const t = e.target;
            if (!t.classList || !t.classList.contains('dv-col-resizer')) return;
            e.preventDefault(); e.stopPropagation();
            const th = t.parentElement;
            colIdx = Array.prototype.indexOf.call(th.parentElement.children, th);
            startX = e.pageX; startW = th.offsetWidth;
            active = t; t.classList.add('resizing');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };
        table.addEventListener('mousedown', onDown);
        return () => { table.removeEventListener('mousedown', onDown); };
    }, [rows.length, hiddenCols.size, effectiveView]);

    /* Visible columns (preserving DV_COLUMNS order) */
    const visibleCols = useMemo(
        () => DV_COLUMNS.filter(c => !hiddenCols.has(c.key)),
        [hiddenCols]
    );

    /* Prepared rows: derive exam_percentage, and in version-wise mode sort by
       version ascending (natural numeric order on the version label). */
    const preparedRows = useMemo(() => {
        const out = rows.map(r => {
            const reg  = Number(r.registrations || 0);
            const exam = Number(r.exam_count || 0);
            return { ...r, exam_percentage: reg > 0 ? (exam / reg) * 100 : 0 };
        });
        if (effectiveView === 'version') {
            out.sort((a, b) => {
                const ax = parseInt(String(a.version || '').replace(/[^\d]/g, ''), 10) || 0;
                const bx = parseInt(String(b.version || '').replace(/[^\d]/g, ''), 10) || 0;
                if (ax !== bx) return ax - bx;
                return String(a.version || '').localeCompare(String(b.version || ''));
            });
        }
        return out;
    }, [rows, effectiveView]);

    /* Pre-compute min/max per column for heat-map */
    const stats = useMemo(() => {
        const out = {};
        DV_COLUMNS.forEach(c => {
            if (c.kind === 'neutral' || c.type === 'label') return;
            let min = Infinity, max = -Infinity;
            preparedRows.forEach(r => {
                const v = Number(r[c.key] || 0);
                if (v < min) min = v;
                if (v > max) max = v;
            });
            out[c.key] = { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
        });
        return out;
    }, [preparedRows]);

    /* Total row */
    const totals = useMemo(() => {
        const t = {
            spend: 0, registrations: 0,
            exam_count: 0, internship_count: 0, second_internship: 0, revenue: 0,
        };
        preparedRows.forEach(r => {
            t.spend             += Number(r.spend || 0);
            t.registrations     += Number(r.registrations || 0);
            t.exam_count        += Number(r.exam_count || 0);
            t.internship_count  += Number(r.internship_count || 0);
            t.second_internship += Number(r.second_internship || 0);
            t.revenue           += Number(r.revenue || 0);
        });
        t.roi                   = t.spend         > 0 ? t.revenue  / t.spend          : 0;
        t.cost_per_registration = t.registrations > 0 ? t.spend    / t.registrations  : 0;
        t.cost_per_exam         = t.exam_count    > 0 ? t.spend    / t.exam_count     : 0;
        t.exam_percentage       = t.registrations > 0 ? (t.exam_count / t.registrations) * 100 : 0;
        return t;
    }, [preparedRows]);

    /* CSV export — matches the current view: respects visible columns, sort
       order, and effectiveView mode. Numbers are exported raw (no currency or
       % symbol) so Excel can treat them as numbers. */
    const downloadCSV = () => {
        if (preparedRows.length === 0) return;

        // Header row, with the label split into Date / Version where useful.
        const headers = [];
        const fieldGetters = []; // (row) => stringified value for that column

        visibleCols.forEach(c => {
            if (c.type === 'label') {
                const hasDate = preparedRows.some(r => r.date);
                const hasVer  = preparedRows.some(r => r.version);
                if (hasDate)              { headers.push('Date');    fieldGetters.push(r => r.date    || ''); }
                if (hasVer)               { headers.push('Version'); fieldGetters.push(r => r.version || ''); }
                if (!hasDate && !hasVer)  { headers.push('Label');   fieldGetters.push(r => r.__label || ''); }
                return;
            }
            // Plain text label (strip the ₹ / % already in DV_COLUMNS labels)
            headers.push(c.label.replace(/\s*\(.*?\)\s*/g, '').trim());
            fieldGetters.push(r => {
                const v = Number(r[c.key] || 0);
                if (c.format === 'currency') return v.toFixed(2);
                if (c.format === 'ratio')    return v.toFixed(4);
                if (c.format === 'percent')  return v.toFixed(2);
                return Math.round(v);
            });
        });

        const escape = (v) => {
            const s = String(v ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const lines = [];
        lines.push(headers.map(escape).join(','));
        preparedRows.forEach(r => {
            lines.push(fieldGetters.map(fn => escape(fn(r))).join(','));
        });
        // Total row
        const totalRow = { ...totals, __label: 'Total' };
        lines.push(fieldGetters.map(fn => escape(fn(totalRow))).join(','));

        const today = new Date();
        const stamp = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const filename = `day_version_${effectiveView}wise_${stamp}.csv`;

        // Prepend BOM so Excel opens the file as UTF-8 (handles ₹ / unicode names).
        const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    /* Render the value inside one cell. */
    const renderCell = (col, row, isSummary = false) => {
        if (col.type === 'label') {
            if (isSummary) return row.__label;
            if (row.date && row.version) {
                return (
                    <div className="dv-label-cell">
                        <span className="dv-label-date">{DV_FMT_DATE(row.date)}</span>
                        <span className="dv-label-ver">{row.version}</span>
                    </div>
                );
            }
            if (row.date)    return DV_FMT_DATE(row.date);
            if (row.version) return row.version;
            return '—';
        }

        const v = Number(row[col.key] || 0);
        switch (col.format) {
            case 'currency': return DV_FMT_CURRENCY(v);
            case 'ratio':    return DV_FMT_RATIO(v);
            case 'percent':  return v.toFixed(2) + '%';
            case 'int':
            default:         return DV_FMT_INT(v);
        }
    };

    const cellBand = (col, row) => {
        if (col.kind === 'neutral' || col.type === 'label') return '';
        const s = stats[col.key];
        if (!s) return '';
        return dvBand(Number(row[col.key] || 0), s.min, s.max, col.kind);
    };

    /* renderCell uses the new dv-summary-label for footer label cells */
    const renderCellV2 = (col, row, isSummary = false) => {
        if (col.type === 'label') {
            if (isSummary) {
                return (
                    <span className="dv-summary-label">
                        <i className={row.__label === 'Total' ? 'fas fa-sigma' : 'fas fa-equals'} />
                        {row.__label}
                    </span>
                );
            }
            if (row.date && row.version) {
                return (
                    <div className="dv-label-cell">
                        <span className="dv-label-date">{DV_FMT_DATE(row.date)}</span>
                        <span className="dv-label-ver">{row.version}</span>
                    </div>
                );
            }
            if (row.date)    return <span className="dv-label-date">{DV_FMT_DATE(row.date)}</span>;
            if (row.version) return <span className="dv-label-date">{row.version}</span>;
            return '—';
        }
        return renderCell(col, row, isSummary);
    };

    return (
        <div className="dv-view" ref={viewRef}>
            {/* Sticky control bar */}
            <div className="dv-controls-sticky" ref={stickyRef}>
                <div className="dv-controls">

                    {/* Row 1: input mode segmented + view-as segmented */}
                    <div className="dv-row dv-row-spread">
                        <div className="dv-segmented" role="tablist" aria-label="Input mode">
                            <button
                                className={inputMode === 'versions' ? 'is-on' : ''}
                                onClick={() => setInputMode('versions')}
                            >
                                <i className="fas fa-tags" /> CIT Versions
                            </button>
                            <button
                                className={inputMode === 'daterange' ? 'is-on' : ''}
                                onClick={() => setInputMode('daterange')}
                            >
                                <i className="fas fa-calendar-week" /> Date Range
                            </button>
                        </div>

                        <div className="dv-view-toggle">
                            <span className="dv-label-text">View as</span>
                            <div className="dv-segmented" role="tablist" aria-label="View mode">
                                <button
                                    className={effectiveView === 'version' ? 'is-on' : ''}
                                    onClick={() => setViewMode('version')}
                                    disabled={inputMode === 'daterange'}
                                    title={inputMode === 'daterange'
                                        ? 'A free date range cannot be split into whole versions'
                                        : ''}
                                >
                                    <i className="fas fa-layer-group" /> Version wise
                                </button>
                                <button
                                    className={effectiveView === 'day' ? 'is-on' : ''}
                                    onClick={() => setViewMode('day')}
                                >
                                    <i className="fas fa-calendar-day" /> Day wise
                                </button>
                            </div>
                        </div>
                    </div>

                    <hr className="dv-divider" />

                    {/* Row 2: versions OR date range */}
                    {inputMode === 'versions' ? (
                        <div className="dv-row">
                            <div className="dv-section-title">Select CIT Versions</div>
                            <div className={`dv-pills-wrap ${pillsExpanded ? 'dv-pills-expanded' : ''}`}>
                                {citVersions.map(v => (
                                    <button
                                        key={v}
                                        className={`dv-pill ${selectedVersions.includes(v) ? 'is-on' : ''}`}
                                        onClick={() => toggleVersionPill(v)}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                            {citVersions.length > 12 && (
                                <button
                                    className="dv-show-more-pill"
                                    onClick={() => setPillsExpanded(!pillsExpanded)}
                                >
                                    {pillsExpanded
                                        ? 'Show less'
                                        : `Show more (${citVersions.length - 12})`}
                                </button>
                            )}
                            {selectedVersions.length > 0 && (
                                <button className="dv-clear-btn" onClick={clearVersions}>
                                    <i className="fas fa-times" /> Clear ({selectedVersions.length})
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="dv-row">
                            <div className="dv-section-title">Select Date Range</div>
                            <DvDateRangePicker
                                fromDate={fromDate}
                                toDate={toDate}
                                onApply={(f, t) => { setFromDate(f); setToDate(t); }}
                            />
                        </div>
                    )}

                    <hr className="dv-divider" />

                    {/* Row 3: column show/hide + Download + Load button */}
                    <div className="dv-row dv-row-spread">
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <div className="dv-col-menu-wrap">
                            <button
                                className="dv-ghost-btn"
                                onClick={() => setColMenuOpen(!colMenuOpen)}
                            >
                                <i className="fas fa-columns" /> Columns
                                <span className="dv-badge">
                                    {DV_COLUMNS.length - hiddenCols.size}/{DV_COLUMNS.length}
                                </span>
                            </button>
                            {colMenuOpen && (
                                <div className="dv-col-menu">
                                    <div className="dv-col-menu-head">Show / Hide Columns</div>
                                    {DV_COLUMNS.map(c => (
                                        <label key={c.key} className="dv-col-menu-item">
                                            <input
                                                type="checkbox"
                                                checked={!hiddenCols.has(c.key)}
                                                onChange={() => toggleCol(c.key)}
                                            />
                                            <span>{c.label}</span>
                                        </label>
                                    ))}
                                    <div className="dv-col-menu-foot">
                                        <button
                                            className="dv-ghost-btn"
                                            onClick={() => {
                                                // Reset = show all
                                                Array.from(hiddenCols).forEach(k => toggleCol(k));
                                            }}
                                        >Show all</button>
                                        <button
                                            className="dv-ghost-btn"
                                            onClick={() => setColMenuOpen(false)}
                                        >Done</button>
                                    </div>
                                </div>
                            )}
                        </div>
                      </div>

                        <button
                            className="dv-load-btn"
                            onClick={fetchData}
                            disabled={loading}
                        >
                            {loading ? (
                                <><i className="fas fa-spinner fa-spin" /> Loading...</>
                            ) : (
                                <><i className="fas fa-chart-bar" /> Load Comparison</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Table area */}
            {rows.length === 0 ? (
                <div className="dv-empty">
                    <div className="dv-empty-icon">
                        <i className="fas fa-chart-bar" />
                    </div>
                    <div className="dv-empty-title">No comparison data yet</div>
                    <div className="dv-empty-hint">
                        {inputMode === 'versions'
                            ? 'Select CIT versions above and click "Load Comparison".'
                            : 'Pick a date range and click "Load Comparison".'}
                    </div>
                </div>
            ) : (
                <>
                    <div className="dv-result-bar">
                        <span>
                            Showing <span className="dv-result-chip">{rows.length}</span>{' '}
                            {effectiveView === 'day' ? 'day rows' : 'version rows'}
                            {inputMode === 'versions' && selectedVersions.length > 0 && (
                                <> across <span className="dv-result-chip">{selectedVersions.length}</span> version(s)</>
                            )}
                        </span>
                        <div style={{ display:'flex', gap:14, alignItems:'center', flexWrap:'wrap' }}>
                            <div className="dv-legend">
                                <span className="dv-legend-item"><span className="dv-legend-dot" style={{ background:'#fde7e9' }} /> Low</span>
                                <span className="dv-legend-item"><span className="dv-legend-dot" style={{ background:'#fdebd0' }} /> Below avg</span>
                                <span className="dv-legend-item"><span className="dv-legend-dot" style={{ background:'#fff8dc' }} /> Avg</span>
                                <span className="dv-legend-item"><span className="dv-legend-dot" style={{ background:'#e3f3da' }} /> Above avg</span>
                                <span className="dv-legend-item"><span className="dv-legend-dot" style={{ background:'#d4eede' }} /> High</span>
                            </div>
                            <button
                                className="dv-download-btn"
                                onClick={downloadCSV}
                                title={`Download the current ${effectiveView}-wise table as CSV`}
                            >
                                <i className="fas fa-file-excel" /> Download Excel
                            </button>
                        </div>
                    </div>

                    <div className="dv-table-wrap">
                        <table className="dv-table" ref={tableRef}>
                            <thead>
                                <tr>
                                    {visibleCols.map(c => (
                                        <th
                                            key={c.key}
                                            className={c.sticky ? 'dv-sticky-col' : ''}
                                            style={{ width: c.width, minWidth: c.width }}
                                        >
                                            {c.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {preparedRows.map((r, idx) => (
                                    <tr key={(r.date || '') + '|' + (r.version || '') + '|' + idx}>
                                        {visibleCols.map(c => {
                                            const band = cellBand(c, r);
                                            const cls = [
                                                c.sticky ? 'dv-sticky-col' : '',
                                                band || 'dv-base-bg',
                                            ].filter(Boolean).join(' ');
                                            return (
                                                <td key={c.key} className={cls}>
                                                    {renderCellV2(c, r)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="dv-summary-row dv-summary-total">
                                    {visibleCols.map(c => (
                                        <td key={c.key} className={c.sticky ? 'dv-sticky-col' : ''}>
                                            {renderCellV2(c, { ...totals, __label: 'Total' }, true)}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}