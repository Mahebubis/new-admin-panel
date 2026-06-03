import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';

const API_DATA     = 'https://cit3.internshipstudio.com/admin/react-api/api/reports/datewise_data_realtime.php';
const API_VERSIONS = 'https://cit3.internshipstudio.com/admin/react-api/api/reports/cit_versions.php';
const DL_BASE      = '/download/download_data.php';

/* ─── helpers ─── */
const toISO = (s) => s; // already YYYY-MM-DD from <input type=date>
const today = () => new Date().toISOString().split('T')[0];
const lastWeek = () => { const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().split('T')[0]; };

function formatDate(iso) {
  if (!iso) return '';
  const dt = new Date(iso + 'T12:00:00');
  return `${dt.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()]} ${dt.getFullYear()}`;
}

function dateRange(start, end) {
  const dates = [], cur = new Date(start + 'T12:00:00'), fin = new Date(end + 'T12:00:00');
  while (cur <= fin) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate()+1); }
  return dates;
}

/* ROI → HSL color (red=0 → green=max) same as PHP JS */
function roiColor(roi, maxRoi) {
  if (!roi || !maxRoi) return '#e5e7eb';
  const ratio = Math.min(Math.max(roi / maxRoi, 0), 1);
  return `hsl(${Math.round(120 * ratio)}, 100%, 90%)`;
}
function lumCheck(hsl) {
  const hue = parseInt(hsl.match(/\d+/)?.[0]||'0');
  return hue > 60 ? '#1e293b' : '#7f1d1d';
}

const fmt = (n) => isNaN(+n) ? '0' : (+n).toFixed(2);
const fmtINR = (n) => `₹${(+n||0).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:0})}`;

/* ─── shared styles ─── */
const inpS = { padding:'7px 11px', border:'1.5px solid #e2e8f0', borderRadius:7,
  fontSize:12, fontFamily:'inherit', color:'#1e293b', outline:'none', background:'#fff' };
const selS = { ...inpS, cursor:'pointer' };
const btnS = (bg='linear-gradient(135deg,#4f46e5,#7c3aed)') => ({
  padding:'8px 16px', border:'none', borderRadius:8, fontSize:12, fontWeight:700,
  cursor:'pointer', color:'#fff', background:bg, whiteSpace:'nowrap' });

/* Per-metric chip colors — light bg + matching border so each row reads cleanly */
const METRIC_STYLE = {
  Cost:  { bg:'#fff7ed', bd:'#fed7aa' }, // amber
  Rev:   { bg:'#f0fdf4', bd:'#bbf7d0' }, // green
  Leads: { bg:'#eff6ff', bd:'#bfdbfe' }, // blue
  CPL:   { bg:'#fdf2f8', bd:'#fbcfe8' }, // pink
  CPM:   { bg:'#eef2ff', bd:'#c7d2fe' }, // indigo
  'C/Exam': { bg:'#f0fdfa', bd:'#99f6e4' }, // teal
  // ROI uses a dynamic heatmap color set inline.
};
const chipStyle = (lbl, bgOverride) => ({
  display:'flex', justifyContent:'space-between', gap:6,
  padding:'2px 6px',
  background: bgOverride || METRIC_STYLE[lbl].bg,
  border: `1px solid ${METRIC_STYLE[lbl]?.bd || 'rgba(0,0,0,.08)'}`,
  borderRadius:4,
});

/* ─── Date cell ─── */
function DateCell({ d, maxRoi }) {
  const roiBg = roiColor(d.roi, maxRoi);
  const cpm = d.cpm ?? (d.impressions > 0 ? (d.cost / d.impressions) * 1000 : 0);
  const cpe = (d.exams > 0) ? (d.cost / d.exams) : 0;
  const lines = [
    ['Cost',  fmtINR(d.cost),    null],
    ['Rev',   fmtINR(d.revenue), null],
    ['Leads', d.leads,           null],
    ['CPL',   fmt(d.cpl),        null],
    ['CPM',   fmt(cpm),          null],
    ['C/Exam', fmt(cpe),         null],
    ['ROI',   fmt(d.roi),        roiBg], // heatmap-coloured
  ];
  return (
    <td style={{ padding:'5px 6px', background:'#fff', borderBottom:'1px solid #f1f5f9',
      borderRight:'1px solid #e2e8f0', minWidth:120, verticalAlign:'top' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {lines.map(([lbl,val,bg])=>(
          <div key={lbl} style={lbl === 'ROI'
            ? { ...chipStyle('Cost', bg), border:'1px solid rgba(0,0,0,.1)' }
            : chipStyle(lbl)}>
            <span style={{ fontSize:9.5, fontWeight:700, color:'#64748b' }}>{lbl}</span>
            <span style={{ fontSize:10.5, fontWeight:700, color:'#1e293b' }}>{val}</span>
          </div>
        ))}
      </div>
    </td>
  );
}

/* ─── Summary cell (avg/total) ─── */
function SummaryCell({ totalCost, totalRevenue, totalLeads, totalImpressions = 0, totalExams = 0 }) {
  const roi = totalCost   > 0 ? totalRevenue / totalCost           : 0;
  const cpl = totalLeads  > 0 ? totalCost    / totalLeads          : 0;
  const cpm = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0;
  const cpe = totalExams  > 0 ? totalCost    / totalExams          : 0;
  const lines = [
    ['Cost',  fmtINR(totalCost)],
    ['Rev',   fmtINR(totalRevenue)],
    ['Leads', totalLeads],
    ['CPL',   fmt(cpl)],
    ['CPM',   fmt(cpm)],
    ['C/Exam', fmt(cpe)],
    ['ROI',   fmt(roi)],
  ];
  return (
    <td style={{ padding:'5px 6px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0',
      borderRight:'1px solid #e2e8f0', minWidth:130, verticalAlign:'top' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {lines.map(([l,v])=>(
          <div key={l} style={l === 'ROI'
            ? { ...chipStyle('Cost'), background:'#f5f3ff', border:'1px solid #ddd6fe' }
            : chipStyle(l)}>
            <span style={{ fontSize:9.5, fontWeight:700, color:'#64748b' }}>{l}</span>
            <span style={{ fontSize:10.5, fontWeight:700, color:'#1e293b' }}>{v}</span>
          </div>
        ))}
      </div>
    </td>
  );
}

/* ─── Sticky cell ─── */
const stickyTd = (left, minW=180) => ({
  position:'sticky', left, background:'#fff', zIndex:3,
  padding:'10px 12px', borderBottom:'1px solid #f5f3ff',
  borderRight:'1px solid #e2e8f0', minWidth:minW, maxWidth:minW,
  verticalAlign:'top', boxShadow:'2px 0 4px rgba(0,0,0,.04)',
  // Long campaign/adset/ad names have no spaces — force char-level wrap so the
  // full text is visible inside the fixed-width sticky columns.
  whiteSpace:'normal', wordBreak:'break-word', overflowWrap:'anywhere',
});

/* ═══════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════ */
export default function AgencyReport2() {
  // versions: [{ name, from_date, to_date }] — sourced from exam_batch_for_reports
  const [citVersions, setCitVersions] = useState([]);

  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [selBatch,  setSelBatch]  = useState('');

  // adData: full ad-level rows from one API call. All other views derive from this.
  const [adData,   setAdData]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  // expanded: { [campId]: 'adsets'|'ads'|null }
  const [expanded, setExpanded] = useState({});

  /* ── load CIT versions from exam_batch_for_reports (same as Meta Ads Dashboard) ── */
  useEffect(() => {
    fetch(API_VERSIONS)
      .then(r => r.json())
      .then(d => {
        const list = d.versions || [];
        setCitVersions(list);
        // Default to the latest CIT version's date range
        if (list.length && list[0].from_date && list[0].to_date) {
          setSelBatch(list[0].name);
          setStartDate(list[0].from_date);
          setEndDate(list[0].to_date);
        }
      })
      .catch(() => {});
  }, []);

  /* ── single fetch: ad-level data, cached. All expansions render from this. ── */
  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setExpanded({});
    try {
      const p = new URLSearchParams({ start_date:startDate, end_date:endDate, expand:'ads' });
      const r = await fetch(`${API_DATA}?${p}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setAdData(d.data || []);
      // Meta failures are non-fatal: registrations/revenue/exams still load.
      // Flag it so a zero ad-spend view isn't mistaken for "no spend".
      if (d.meta_error) {
        toast(`Ad spend data unavailable (${d.meta_error}). Showing registrations, revenue & exams.`,
          { icon: '⚠️', duration: 5000 });
      }
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(()=>{ fetchData(); },[fetchData]);

  /* ── toggle expand (instant — no network) ── */
  const toggleExpand = useCallback((campId, type) => {
    setExpanded(p => ({ ...p, [campId]: p[campId] === type ? null : type }));
  }, []);

  /* ── batch select ── */
  const handleBatch = (name) => {
    setSelBatch(name);
    const b = citVersions.find(x => x.name === name);
    if (b) { setStartDate(b.from_date); setEndDate(b.to_date); }
  };

  /* ── derived: all dates ── */
  const allDates = useMemo(
    () => (startDate && endDate ? dateRange(startDate, endDate) : []),
    [startDate, endDate]
  );

  const isNoCampaign = (c) => !c || c === '-' || c.toLowerCase() === 'direct/unknown';

  /* ── single-pass aggregation: campaign / campaign+adset / campaign+adset+ad ── */
  const { campAgg, adsetAgg, adAgg, counts, globalCost, globalRevenue, globalImpr, globalLeads, globalExams } = useMemo(() => {
    const campAgg  = {}; // { camp: { date: {cost,revenue,leads,impressions,exams} } }
    const adsetAgg = {}; // { camp: { adset: { date: ... } } }
    const adAgg    = {}; // { camp: { adset: { ad: { date: ... } } } }
    const counts   = {};
    let gC = 0, gR = 0, gI = 0, gL = 0, gE = 0;

    const bump = (bucket, date, row) => {
      if (!bucket[date]) bucket[date] = { cost:0, revenue:0, leads:0, impressions:0, exams:0 };
      bucket[date].cost        += +row.cost        || 0;
      bucket[date].revenue     += +row.revenue     || 0;
      bucket[date].leads       += +row.leads       || 0;
      bucket[date].impressions += +row.impressions || 0;
      bucket[date].exams       += +row.exams       || 0;
    };

    for (const row of adData) {
      const camp  = row.campaign || '-';
      const adset = row.adset    || '';
      const ad    = row.ad       || '';
      const date  = row.date;

      if (!campAgg[camp]) campAgg[camp] = {};
      bump(campAgg[camp], date, row);

      if (!counts[camp]) counts[camp] = { _adsetSet: new Set(), _adSet: new Set() };
      if (adset) counts[camp]._adsetSet.add(adset);
      if (ad)    counts[camp]._adSet.add(ad);

      if (adset) {
        if (!adsetAgg[camp])        adsetAgg[camp] = {};
        if (!adsetAgg[camp][adset]) adsetAgg[camp][adset] = {};
        bump(adsetAgg[camp][adset], date, row);

        if (ad) {
          if (!adAgg[camp])               adAgg[camp] = {};
          if (!adAgg[camp][adset])        adAgg[camp][adset] = {};
          if (!adAgg[camp][adset][ad])    adAgg[camp][adset][ad] = {};
          bump(adAgg[camp][adset][ad], date, row);
        }
      }

      gC += +row.cost        || 0;
      gR += +row.revenue     || 0;
      gI += +row.impressions || 0;
      gL += +row.leads       || 0;
      gE += +row.exams       || 0;
    }

    for (const k of Object.keys(counts)) {
      counts[k] = {
        adset_count: counts[k]._adsetSet.size,
        ad_count:    counts[k]._adSet.size,
      };
    }
    return {
      campAgg, adsetAgg, adAgg, counts,
      globalCost: gC, globalRevenue: gR, globalImpr: gI, globalLeads: gL, globalExams: gE,
    };
  }, [adData]);

  const globalRoi = globalCost > 0 ? globalRevenue / globalCost : 0;
  const globalCpl = globalLeads > 0 ? globalCost / globalLeads : 0;
  const globalCpm = globalImpr  > 0 ? (globalCost / globalImpr) * 1000 : 0;
  const globalCpe = globalExams > 0 ? globalCost / globalExams : 0;

  /* sorted campaign names — "No Campaign" sinks to bottom */
  const campaigns = useMemo(() => {
    return Object.keys(campAgg).sort((a, b) => {
      const na = isNoCampaign(a) ? 1 : 0;
      const nb = isNoCampaign(b) ? 1 : 0;
      if (na !== nb) return na - nb;
      return a.localeCompare(b);
    });
  }, [campAgg]);

  /* CIT version for date → label */
  const citForDate = (date) => {
    for (const v of citVersions) {
      if (date >= v.from_date && date <= v.to_date) return v.name;
    }
    return '';
  };

  /* Group consecutive dates with same CIT version for header row */
  const citGroups = () => {
    const grps = [];
    let cur = null;
    allDates.forEach(d => {
      const v = citForDate(d);
      if (!cur || cur.label !== v) { cur = { label:v, count:1 }; grps.push(cur); }
      else cur.count++;
    });
    return grps;
  };

  /* ── Excel export — structured grid that mirrors the dashboard table:
        3 hierarchy columns (Campaign / AdSet / Ad), then every date expanded
        into its own metric columns (Cost, Rev, Leads, CPL, CPM, C/Exam, ROI),
        followed by Average and Total groups. Built from data, not the DOM, so
        each metric lands in its own cell instead of one concatenated blob. ── */
  const exportXlsx = () => {
    if (!campaigns.length || !allDates.length) { toast.error('No data to export'); return; }

    // xlsx-js-style = drop-in SheetJS with cell-style (fill/font/border) support.
    const loadXLSX = () => new Promise(resolve => {
      if (window.XLSX && window.XLSX.__styled) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style/dist/xlsx.bundle.js';
      s.onload = () => { try { window.XLSX.__styled = true; } catch { /* noop */ } resolve(); };
      document.head.appendChild(s);
    });

    // Light campaign tints — each campaign group (campaign + its adsets + ads)
    // gets one hue so adjacent campaigns read as separate blocks. `head` = the
    // campaign row, `body` = its adset/ad rows (a lighter shade of the same hue).
    const PALETTE = [
      { head: 'DBEAFE', body: 'EFF6FF' }, // blue
      { head: 'DCFCE7', body: 'F0FDF4' }, // green
      { head: 'FEF3C7', body: 'FFFBEB' }, // amber
      { head: 'F3E8FF', body: 'FAF5FF' }, // purple
      { head: 'FCE7F3', body: 'FDF2F8' }, // pink
      { head: 'CCFBF1', body: 'F0FDFA' }, // teal
      { head: 'FFE4E6', body: 'FFF1F2' }, // rose
      { head: 'E0E7FF', body: 'EEF2FF' }, // indigo
      { head: 'FEF9C3', body: 'FEFCE8' }, // yellow
      { head: 'D1FAE5', body: 'ECFDF5' }, // emerald
    ];

    const METRICS = ['Cost', 'Rev', 'Leads', 'CPL', 'CPM', 'C/Exam', 'ROI'];
    const D = allDates.length;

    // 7 metric values for one bucket (or zeros).
    const calc = (b = {}) => {
      const cost = +b.cost || 0, rev = +b.revenue || 0, leads = +b.leads || 0,
            impr = +b.impressions || 0, exams = +b.exams || 0;
      return [
        Math.round(cost),
        Math.round(rev),
        Math.round(leads),
        +(leads > 0 ? cost / leads : 0).toFixed(2),
        +(impr  > 0 ? (cost / impr) * 1000 : 0).toFixed(2),
        +(exams > 0 ? cost / exams : 0).toFixed(2),
        +(cost  > 0 ? rev / cost : 0).toFixed(2),
      ];
    };
    const sumBuckets = (dateMap) => {
      let cost = 0, revenue = 0, leads = 0, impressions = 0, exams = 0;
      for (const d of allDates) {
        const x = dateMap[d]; if (!x) continue;
        cost += x.cost; revenue += x.revenue; leads += x.leads;
        impressions += x.impressions || 0; exams += x.exams || 0;
      }
      return { cost, revenue, leads, impressions, exams };
    };
    // One full row: hierarchy cols + per-date metrics + Average + Total.
    const rowForAgg = (camp, adset, ad, dateMap = {}) => {
      const cells = [camp, adset, ad];
      for (const d of allDates) cells.push(...calc(dateMap[d]));
      const tot = sumBuckets(dateMap);
      const n = Math.max(D, 1);
      const avg = { cost: tot.cost / n, revenue: tot.revenue / n,
        leads: Math.round(tot.leads / n), impressions: Math.round(tot.impressions / n),
        exams: Math.round(tot.exams / n) };
      cells.push(...calc(avg));
      cells.push(...calc(tot));
      return cells;
    };

    const totalCols = 3 + (D + 2) * 7;
    const blank = () => new Array(totalCols).fill('');

    // Row 0: title.  Row 1: group header (dates / Average / Total).  Row 2: metric sub-headers.
    const titleRow = blank();
    titleRow[0] = `${selBatch || 'Report'}  ·  ${formatDate(startDate)} – ${formatDate(endDate)}`;

    const groupRow = blank();
    groupRow[0] = 'Campaign'; groupRow[1] = 'AdSet'; groupRow[2] = 'Ad';
    allDates.forEach((d, i) => { groupRow[3 + i * 7] = formatDate(d); });
    groupRow[3 + D * 7]       = 'Average';
    groupRow[3 + (D + 1) * 7] = 'Total';

    const subRow = blank();
    const putMetrics = (base) => METRICS.forEach((m, j) => { subRow[base + j] = m; });
    allDates.forEach((d, i) => putMetrics(3 + i * 7));
    putMetrics(3 + D * 7);
    putMetrics(3 + (D + 1) * 7);

    const aoa = [titleRow, groupRow, subRow];
    // Parallel to the DATA rows only — { fill, kind } so we can colour by group.
    const rowMeta = [];

    // Data rows — full hierarchy (campaign → adsets → ads), like the dashboard.
    campaigns.forEach((camp, ci) => {
      const pal = PALETTE[ci % PALETTE.length];
      aoa.push(rowForAgg(isNoCampaign(camp) ? 'No Campaign' : camp, '', '', campAgg[camp] || {}));
      rowMeta.push({ fill: pal.head, kind: 'campaign' });
      const adsetMap = adsetAgg[camp] || {};
      Object.keys(adsetMap).sort((a, b) => a.localeCompare(b)).forEach(aName => {
        aoa.push(rowForAgg('', aName, '', adsetMap[aName]));
        rowMeta.push({ fill: pal.body, kind: 'adset' });
        const adMap = (adAgg[camp] && adAgg[camp][aName]) || {};
        Object.keys(adMap).sort((a, b) => a.localeCompare(b)).forEach(adName => {
          aoa.push(rowForAgg('', '', adName, adMap[adName]));
          rowMeta.push({ fill: pal.body, kind: 'ad' });
        });
      });
    });

    loadXLSX().then(() => {
      const XLSX = window.XLSX;
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Merges: title across all; hierarchy headers span the 2 header rows;
      // each date / Average / Total label spans its 7 metric columns.
      const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];
      for (let c = 0; c < 3; c++) merges.push({ s: { r: 1, c }, e: { r: 2, c } });
      const bases = allDates.map((d, i) => 3 + i * 7);
      bases.push(3 + D * 7, 3 + (D + 1) * 7);
      bases.forEach(base => merges.push({ s: { r: 1, c: base }, e: { r: 1, c: base + 6 } }));
      ws['!merges'] = merges;

      // Column widths.
      const cols = [{ wch: 30 }, { wch: 24 }, { wch: 24 }];
      for (let i = 0; i < (D + 2) * 7; i++) cols.push({ wch: 9 });
      ws['!cols'] = cols;
      ws['!freeze'] = { xSplit: 3, ySplit: 3 };
      ws['!rows'] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 16 }];

      /* ── Cell styling ── */
      const thin   = { style: 'thin', color: { rgb: 'E2E8F0' } };
      const border = { top: thin, bottom: thin, left: thin, right: thin };
      const setStyle = (r, c, style) => {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (!ws[ref]) ws[ref] = { t: 's', v: '' };
        ws[ref].s = style;
      };
      const titleStyle = { fill: { patternType: 'solid', fgColor: { rgb: '4338CA' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 13 },
        alignment: { horizontal: 'left', vertical: 'center' } };
      const headerStyle = { fill: { patternType: 'solid', fgColor: { rgb: '4F46E5' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border };
      const subStyle = { fill: { patternType: 'solid', fgColor: { rgb: '6366F1' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9 },
        alignment: { horizontal: 'center', vertical: 'center' }, border };

      for (let c = 0; c < totalCols; c++) {
        setStyle(0, c, titleStyle);
        setStyle(1, c, headerStyle);
        setStyle(2, c, subStyle);
      }
      rowMeta.forEach((m, i) => {
        const r = 3 + i;
        for (let c = 0; c < totalCols; c++) {
          const hier = c < 3;
          setStyle(r, c, {
            fill: { patternType: 'solid', fgColor: { rgb: m.fill } },
            font: { bold: m.kind === 'campaign' && hier, color: { rgb: '1E293B' }, sz: 10 },
            alignment: { horizontal: hier ? 'left' : 'center', vertical: 'center', wrapText: hier },
            border,
          });
        }
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Agency Report');
      XLSX.writeFile(wb, `Agency_Report_${(selBatch || 'data').replace(/\s+/g, '_')}.xlsx`);
      toast.success('Downloaded!');
    });
  };

  const HEADER_ROW1_H = 38; // approx height of header row 1; row 2 (dates) stacks under
  const thBase = { color:'#fff', fontSize:10, fontWeight:700, padding:'9px 11px',
    textAlign:'center', textTransform:'uppercase', letterSpacing:'.3px',
    borderRight:'1px solid rgba(255,255,255,.15)', whiteSpace:'nowrap' };
  // Row-1 header cell (CIT group / Average / Total): sticky top only
  const topTh = {
    ...thBase, position:'sticky', top:0, zIndex:5,
    background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
  };
  // Corner cell (Campaign/AdSet/Ad): sticky on BOTH top + left, highest z-index
  const stickyTh = (left, minW=180) => ({
    ...thBase, position:'sticky', left, top:0, zIndex:7, textAlign:'left',
    background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
    boxShadow:'2px 0 4px rgba(0,0,0,.1)', minWidth:minW,
  });

  /* ════════════════ RENDER ════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .da-root *{box-sizing:border-box;font-family:'Plus Jakarta Sans',sans-serif;}
        .da-tr:hover td{filter:brightness(.96);}
        .da-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;
          background:#f5f3ff;color:#4f46e5;border:1.5px solid #c4b5fd;border-radius:6px;
          font-size:10.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .15s;}
        .da-btn:hover{background:#ede9fe;}
        .da-btn:disabled{opacity:.5;cursor:not-allowed;}
        @keyframes da_spin{to{transform:rotate(360deg)}}
        @keyframes da_dot{
          0%,80%,100%{transform:translateY(0) scale(.8);opacity:.45;}
          40%{transform:translateY(-8px) scale(1);opacity:1;}
        }
        .da-dots{display:inline-flex;gap:6px;align-items:center;}
        .da-dots span{
          width:9px;height:9px;border-radius:50%;
          background:linear-gradient(135deg,#4f46e5,#7c3aed);
          animation:da_dot 1.1s ease-in-out infinite;
          box-shadow:0 2px 6px rgba(79,70,229,.35);
        }
        .da-dots span:nth-child(2){animation-delay:.15s;}
        .da-dots span:nth-child(3){animation-delay:.30s;}

        /* ── Parent/child hierarchy brackets ── */
        /* AdSet rows: corner bracket on the AdSet cell */
        .da-br-adset{ position:relative; padding-left:22px !important; }
        .da-br-adset::before{
          content:''; position:absolute; left:8px; top:0; bottom:50%;
          border-left:2px solid #a78bfa;
        }
        .da-br-adset::after{
          content:''; position:absolute; left:8px; top:50%; width:10px;
          border-bottom:2px solid #a78bfa; border-bottom-left-radius:6px;
        }
        /* Ad rows under an adset: corner bracket on the Ad cell (lighter purple) */
        .da-br-ad{ position:relative; padding-left:22px !important; }
        .da-br-ad::before{
          content:''; position:absolute; left:8px; top:0; bottom:50%;
          border-left:2px solid #c4b5fd;
        }
        .da-br-ad::after{
          content:''; position:absolute; left:8px; top:50%; width:10px;
          border-bottom:2px solid #c4b5fd; border-bottom-left-radius:6px;
        }
        /* Continuous vertical line down through stacked adset children */
        .da-br-adset.da-br-continue::before{ bottom:-1px; }
        .da-br-ad.da-br-continue::before{ bottom:-1px; }
      `}</style>

      <div className="da-root" style={{
        display:'flex', flexDirection:'column', height:'calc(100vh - 62px)',
        /* Full-bleed: cancel AdminLayout <main> padding (16px 20px) so the page
           spans the entire content area width on any screen (laptop/desktop). */
        width:'auto', margin:'-16px -20px',
        padding:20, gap:12, overflow:'hidden', background:'#f5f3ff',
      }}>

        {/* ── HEADER ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#1e293b' }}>📈 Detailed Analytics</div>
          <button onClick={exportXlsx} style={btnS()}>⬇️ Download Report</button>
        </div>

        {/* ── CONTROLS ── */}
        <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #ede9fe',
          padding:'13px 16px', flexShrink:0, display:'flex', flexDirection:'column', gap:10 }}>

          {/* Row 1: batch + dates */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <label style={{ fontSize:10.5, fontWeight:700, color:'#64748b', textTransform:'uppercase' }}>CIT Version</label>
              <select style={{ ...selS, minWidth:160 }} value={selBatch} onChange={e=>handleBatch(e.target.value)}>
                <option value="">Select CIT Version...</option>
                {citVersions.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
            </div>
            {[['Start Date', startDate, setStartDate], ['End Date', endDate, setEndDate]].map(([lbl,val,fn])=>(
              <div key={lbl} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <label style={{ fontSize:10.5, fontWeight:700, color:'#64748b', textTransform:'uppercase' }}>📅 {lbl}</label>
                <input type="date" style={inpS} value={val} onChange={e=>fn(e.target.value)}/>
              </div>
            ))}
          </div>

        </div>

        {/* ── ROI LEGEND + GLOBAL SUMMARY ── */}
        <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0, width:'100%', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:'1 1 280px', minWidth:240 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#64748b', whiteSpace:'nowrap' }}>ROI Scale:</span>
            <span style={{ fontSize:10.5, color:'#94a3b8' }}>Low</span>
            <div style={{ flex:1, height:12, borderRadius:99,
              background:'linear-gradient(to right,hsl(0,100%,90%),hsl(60,100%,90%),hsl(120,100%,90%))' }}/>
            <span style={{ fontSize:10.5, color:'#94a3b8' }}>High</span>
          </div>
          {/* Global Rev / Cost / ROI */}
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, whiteSpace:'nowrap' }}>
            <span style={{ padding:'4px 8px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:6, fontWeight:700, color:'#15803d' }}>
              Rev: {fmtINR(globalRevenue)}
            </span>
            <span style={{ color:'#94a3b8', fontSize:13 }}>÷</span>
            <span style={{ padding:'4px 8px', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:6, fontWeight:700, color:'#c2410c' }}>
              Cost: {fmtINR(globalCost)}
            </span>
            <span style={{ color:'#94a3b8', fontSize:13 }}>=</span>
            <span style={{ padding:'4px 10px', background:'#f5f3ff', border:'1px solid #c4b5fd', borderRadius:6, fontWeight:800, color:'#4f46e5' }}>
              ROI: {fmt(globalRoi)}
            </span>
            <span style={{ padding:'4px 8px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:6, fontWeight:700, color:'#1d4ed8' }}>
              Leads: {globalLeads} · CPL: {fmt(globalCpl)} · CPM: {fmt(globalCpm)}
            </span>
            <span style={{ padding:'4px 8px', background:'#f0fdfa', border:'1px solid #99f6e4', borderRadius:6, fontWeight:700, color:'#0f766e' }}>
              Exams: {globalExams} · Cost/Exam: {fmt(globalCpe)}
            </span>
          </div>
        </div>

        {/* ── TABLE ── */}
        <div style={{ flex:1, minHeight:0, background:'#fff', borderRadius:12,
          border:'1.5px solid #ede9fe', overflow:'auto',
          boxShadow:'0 1px 8px rgba(79,70,229,.05)' }}>

          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              padding:'80px 20px', gap:18 }}>
              <div className="da-dots"><span/><span/><span/></div>
              {/* <div style={{ fontSize:12.5, fontWeight:600, color:'#64748b', letterSpacing:'.3px' }}>
                Fetching live data from Meta
              </div> */}
            </div>
          ) : adData.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#94a3b8', fontSize:13 }}>
              No data for selected range
            </div>
          ) : (
            <table id="da-export-table" style={{ borderCollapse:'separate', borderSpacing:0,
              minWidth: 200*3 + allDates.length*120 + 260 }}>
              <thead>
                {/* Row 1: sticky cols + CIT version groups */}
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  <th style={{ ...stickyTh(0), minWidth:200 }} rowSpan={2}>Campaign</th>
                  <th style={{ ...stickyTh(200), minWidth:200 }} rowSpan={2}>AdSet</th>
                  <th style={{ ...stickyTh(400), minWidth:200 }} rowSpan={2}>Ad</th>
                  {citGroups().map((g,i)=>(
                    <th key={i} colSpan={g.count} style={{ ...topTh,
                      borderBottom:'1.5px solid rgba(255,255,255,.2)' }}>
                      {g.label||' '}
                    </th>
                  ))}
                  <th style={{ ...topTh, top:0, zIndex:6 }} rowSpan={2}>Average</th>
                  <th style={{ ...topTh, top:0, zIndex:6 }} rowSpan={2}>Total</th>
                </tr>
                {/* Row 2: individual dates */}
                <tr style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {allDates.map(d=>(
                    <th key={d} style={{ ...thBase, fontSize:9.5, background:'rgba(79,70,229,.85)',
                      position:'sticky', top:HEADER_ROW1_H, zIndex:4, minWidth:110 }}>
                      {formatDate(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map(camp => {
                  const campId    = camp.replace(/[^a-z0-9]/gi,'_');
                  const dateMap   = campAgg[camp] || {};
                  const cnt       = counts[camp]  || {};
                  const mode      = expanded[campId]; // null | 'adsets' | 'ads'

                  // Campaign totals + per-row max ROI
                  let totCost=0, totRev=0, totLeads=0, totImp=0, totExams=0, campMaxRoi=0;
                  for (const d of allDates) {
                    const x = dateMap[d];
                    if (!x) continue;
                    totCost += x.cost; totRev += x.revenue; totLeads += x.leads; totImp += x.impressions || 0; totExams += x.exams || 0;
                    if (x.cost > 0) {
                      const r = x.revenue / x.cost;
                      if (r > campMaxRoi) campMaxRoi = r;
                    }
                  }

                  const rows = [];

                  /* ─── Campaign row ─── */
                  rows.push(
                    <tr key={`c-${camp}`} className="da-tr" data-campaign={campId}>
                      <td style={{ ...stickyTd(0), background:'#fff' }}>
                        <div style={{
                          fontSize:12, fontWeight:700, marginBottom:6,
                          color: isNoCampaign(camp) ? '#94a3b8' : '#1e293b',
                          fontStyle: isNoCampaign(camp) ? 'italic' : 'normal',
                        }}>
                          {isNoCampaign(camp) ? 'No Campaign' : camp}
                        </div>
                        {!isNoCampaign(camp) && (
                          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                            {(cnt.adset_count||0) > 0 && (
                              <button className="da-btn" onClick={()=>toggleExpand(campId,'adsets')}>
                                {mode==='adsets'?'▼':'▶'} AdSets ({cnt.adset_count})
                              </button>
                            )}
                            {(cnt.ad_count||0) > 0 && (
                              <button className="da-btn" onClick={()=>toggleExpand(campId,'ads')}>
                                {mode==='ads'?'▼':'▶'} Ads ({cnt.ad_count})
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={stickyTd(200)}><span style={{ color:'#94a3b8', fontSize:11 }}>—</span></td>
                      <td style={stickyTd(400)}><span style={{ color:'#94a3b8', fontSize:11 }}>—</span></td>
                      {allDates.map(d=>{
                        const x = dateMap[d] || {cost:0,revenue:0,leads:0};
                        const roi = x.cost>0 ? x.revenue/x.cost : 0;
                        return <DateCell key={d} d={{ ...x, roi, cpl: x.leads>0?x.cost/x.leads:0 }} maxRoi={campMaxRoi}/>;
                      })}
                      <SummaryCell totalCost={totCost/Math.max(allDates.length,1)}
                        totalRevenue={totRev/Math.max(allDates.length,1)}
                        totalLeads={Math.round(totLeads/Math.max(allDates.length,1))}
                        totalImpressions={Math.round(totImp/Math.max(allDates.length,1))}
                        totalExams={Math.round(totExams/Math.max(allDates.length,1))}/>
                      <SummaryCell totalCost={totCost} totalRevenue={totRev} totalLeads={totLeads} totalImpressions={totImp} totalExams={totExams}/>
                    </tr>
                  );

                  /* ─── Expansion rows (instant — from cached aggregates) ─── */
                  if (mode === 'adsets' || mode === 'ads') {
                    const adsetMap = adsetAgg[camp] || {};
                    const adsetNames = Object.keys(adsetMap).sort((a,b)=>a.localeCompare(b));

                    adsetNames.forEach((aName, aIdx) => {
                      const aDates = adsetMap[aName];
                      let aC=0, aR=0, aL=0, aI=0, aE=0, aMx=0;
                      for (const d of allDates) {
                        const x = aDates[d];
                        if (!x) continue;
                        aC += x.cost; aR += x.revenue; aL += x.leads; aI += x.impressions || 0; aE += x.exams || 0;
                        if (x.cost > 0) { const r = x.revenue/x.cost; if (r>aMx) aMx=r; }
                      }
                      const moreAdsetsAfter = aIdx < adsetNames.length - 1;

                      // AdSet row (parent bracket — continues if more adsets follow)
                      rows.push(
                        <tr key={`a-${camp}-${aName}`} style={{ background:'#faf9ff' }} className="da-tr">
                          <td style={{ ...stickyTd(0), background:'#faf9ff' }}>
                            <span style={{ color:'#94a3b8', fontSize:11 }}>—</span>
                          </td>
                          <td style={{ ...stickyTd(200), background:'#faf9ff', fontSize:11, color:'#1e293b', fontWeight:700 }}
                              className={`da-br-adset${moreAdsetsAfter || mode === 'ads' ? ' da-br-continue' : ''}`}>
                            {aName}
                          </td>
                          <td style={{ ...stickyTd(400), background:'#faf9ff' }}>
                            <span style={{ color:'#94a3b8', fontSize:11 }}>—</span>
                          </td>
                          {allDates.map(d=>{
                            const x = aDates[d] || {cost:0,revenue:0,leads:0};
                            const roi = x.cost>0?x.revenue/x.cost:0;
                            return <DateCell key={d} d={{...x,roi,cpl:x.leads>0?x.cost/x.leads:0}} maxRoi={aMx}/>;
                          })}
                          <SummaryCell totalCost={aC/Math.max(allDates.length,1)}
                            totalRevenue={aR/Math.max(allDates.length,1)}
                            totalLeads={Math.round(aL/Math.max(allDates.length,1))}
                            totalImpressions={Math.round(aI/Math.max(allDates.length,1))}
                            totalExams={Math.round(aE/Math.max(allDates.length,1))}/>
                          <SummaryCell totalCost={aC} totalRevenue={aR} totalLeads={aL} totalImpressions={aI} totalExams={aE}/>
                        </tr>
                      );

                      // For Ads mode: also list the ads under this adset
                      if (mode === 'ads') {
                        const adMap = (adAgg[camp] && adAgg[camp][aName]) || {};
                        const adNames = Object.keys(adMap).sort((a,b)=>a.localeCompare(b));

                        adNames.forEach((adName, adIdx) => {
                          const dDates = adMap[adName];
                          let dC=0, dR=0, dL=0, dI=0, dE=0, dMx=0;
                          for (const d of allDates) {
                            const x = dDates[d];
                            if (!x) continue;
                            dC += x.cost; dR += x.revenue; dL += x.leads; dI += x.impressions || 0; dE += x.exams || 0;
                            if (x.cost > 0) { const r = x.revenue/x.cost; if (r>dMx) dMx=r; }
                          }
                          const moreAdsAfter = adIdx < adNames.length - 1;

                          rows.push(
                            <tr key={`d-${camp}-${aName}-${adName}`} style={{ background:'#fdfcff' }} className="da-tr">
                              <td style={{ ...stickyTd(0), background:'#fdfcff' }}>
                                <span style={{ color:'#cbd5e1', fontSize:11 }}>—</span>
                              </td>
                              <td style={{ ...stickyTd(200), background:'#fdfcff' }}>
                                <span style={{ color:'#cbd5e1', fontSize:11 }}>—</span>
                              </td>
                              <td style={{ ...stickyTd(400), background:'#fdfcff', fontSize:11, color:'#334155' }}
                                  className={`da-br-ad${moreAdsAfter ? ' da-br-continue' : ''}`}>
                                {adName}
                              </td>
                              {allDates.map(d=>{
                                const x = dDates[d] || {cost:0,revenue:0,leads:0};
                                const roi = x.cost>0?x.revenue/x.cost:0;
                                return <DateCell key={d} d={{...x,roi,cpl:x.leads>0?x.cost/x.leads:0}} maxRoi={dMx}/>;
                              })}
                              <SummaryCell totalCost={dC/Math.max(allDates.length,1)}
                                totalRevenue={dR/Math.max(allDates.length,1)}
                                totalLeads={Math.round(dL/Math.max(allDates.length,1))}
                                totalImpressions={Math.round(dI/Math.max(allDates.length,1))}
                                totalExams={Math.round(dE/Math.max(allDates.length,1))}/>
                              <SummaryCell totalCost={dC} totalRevenue={dR} totalLeads={dL} totalImpressions={dI} totalExams={dE}/>
                            </tr>
                          );
                        });
                      }
                    });
                  }

                  return rows;
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}