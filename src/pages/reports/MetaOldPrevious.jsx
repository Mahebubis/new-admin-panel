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

import React, { useState, useEffect, useRef, useCallback } from 'react';

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

.mad-wrap .campaign-column, .mad-wrap .adset-column, .mad-wrap .ad-column {
    min-width: 650px !important; max-width: 650px !important; width: 650px !important;
}
.mad-wrap .campaign-column .text-cell,
.mad-wrap .adset-column .text-cell,
.mad-wrap .ad-column .text-cell {
    overflow: visible; text-overflow: unset; white-space: nowrap;
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
    color: var(--text-secondary); font-size: 10px; opacity: 0;
    cursor: pointer; margin-left: 4px; transition: transform .2s;
}
.mad-wrap .data-table th:hover .expand-icon { opacity: .6; }
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
`;

/* =========================================================================
   5. MAIN COMPONENT
   ========================================================================= */
export default function MetaAdsDashboard({ apiUrl = 'https://cit3.internshipstudio.com/admin/react-api/api/reports/meta_ads.php' }) {

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

    /* =====================================================================
       SORT HANDLER
       ===================================================================== */
    const handleSort = (field) => {
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
        <div className="mad-wrap">
            <style>{DASHBOARD_CSS}</style>
            <div className="container">

                {/* ========== HEADER ========== */}
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

                {/* ========== FILTERS ========== */}
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
                                <span><div className="dr-dates">{dateLabel}</div></span>
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
                </div>

                {/* ========== TABLE ========== */}
                <div className="table-section">
                    <div className="table-wrapper" ref={tableWrapperRef}>
                        <table className="data-table">
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
                            <table className="footer-table">
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