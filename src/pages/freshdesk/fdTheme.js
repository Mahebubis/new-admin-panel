/*
 * src/pages/freshdesk/fdTheme.js
 *
 * The runtime theme editor's tokens and the code that writes them onto the
 * .app element as CSS custom properties.
 */

/* ============================================================================
   THEME MANAGER — drive the app's CSS variables live
   ========================================================================== */
// Each theme field maps to one or more CSS custom properties on `.app`.
const THEME_FIELDS = [
  { key: "primary", label: "Primary Color", vars: ["--primary"], soft: "--primary-soft" },
  { key: "accent", label: "Secondary Color", vars: ["--accent"], soft: "--accent-soft" },
  { key: "success", label: "Accent Color", vars: ["--success"], soft: "--success-soft" },
  { key: "bg", label: "Background Color", vars: ["--bg"] },
  { key: "surface", label: "Card Background", vars: ["--surface"] },
  { key: "surface2", label: "Sidebar Background", vars: ["--surface-2", "--hover"] },
  { key: "warning", label: "Warning Color", vars: ["--warning"], soft: "--warning-soft" },
  { key: "danger", label: "Error / Danger Color", vars: ["--danger"], soft: "--danger-soft" },
  { key: "text", label: "Text Color", vars: ["--text"] },
  { key: "muted", label: "Muted / Secondary Text", vars: ["--muted"] },
  { key: "border", label: "Border Color", vars: ["--border"] },
];

const THEME_DEFAULT = { primary: "#5B5CEB", accent: "#0EA5E9", success: "#10B981", bg: "#F8F9FC", surface: "#FFFFFF", surface2: "#F1F3F9", warning: "#F59E0B", danger: "#EF4444", text: "#1A1D29", muted: "#6B7280", border: "#E9EBF2" };

const THEME_DARK = { primary: "#7C7DFF", accent: "#38BDF8", success: "#34D399", bg: "#0E1017", surface: "#171A24", surface2: "#1F2331", warning: "#FBBF24", danger: "#F87171", text: "#EEF1F8", muted: "#9BA3B7", border: "#262B3B" };

const PRESETS = [
  { name: "Freshdesk Blue", t: { ...THEME_DEFAULT, primary: "#12344D", accent: "#25C16F", success: "#25C16F" } },
  { name: "Zendesk Green", t: { ...THEME_DEFAULT, primary: "#17494D", accent: "#37B24D", success: "#37B24D" } },
  { name: "Salesforce Blue", t: { ...THEME_DEFAULT, primary: "#0176D3", accent: "#1B96FF", success: "#2E844A" } },
  { name: "Royal Purple", t: { ...THEME_DEFAULT, primary: "#7C3AED", accent: "#F472B6", success: "#10B981" } },
  { name: "Sunset Orange", t: { ...THEME_DEFAULT, primary: "#EA580C", accent: "#F59E0B", success: "#22C55E", bg: "#FDF8F3" } },
  { name: "Material Indigo", t: { ...THEME_DEFAULT, primary: "#3F51B5", accent: "#03A9F4", success: "#4CAF50" } },
  { name: "Ocean Blue", t: { ...THEME_DEFAULT, primary: "#0EA5E9", accent: "#06B6D4", success: "#14B8A6", bg: "#F1F7FB" } },
  { name: "Emerald Green", t: { ...THEME_DEFAULT, primary: "#059669", accent: "#10B981", success: "#22C55E", bg: "#F3FBF7" } },
  { name: "Corporate Gray", t: { ...THEME_DEFAULT, primary: "#475569", accent: "#0EA5E9", success: "#16A34A", bg: "#F5F6F8" } },
  { name: "Light Theme", t: { ...THEME_DEFAULT } },
  { name: "Midnight Dark", t: { ...THEME_DARK, primary: "#818CF8", accent: "#22D3EE" } },
  { name: "Dark Theme", t: { ...THEME_DARK } },
];

const hexToRgb = (h) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h || ""); return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : "—"; };

const mix = (hex, pct, base) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || ""); if (!m) return hex;
  const b = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(base);
  const f = (i) => Math.round(parseInt(m[i], 16) * pct + parseInt(b[i], 16) * (1 - pct)).toString(16).padStart(2, "0");
  return `#${f(1)}${f(2)}${f(3)}`;
};

function applyTheme(theme, dark) {
  const root = document.querySelector(".app"); if (!root) return;
  const baseBg = theme.surface || (dark ? "#171A24" : "#fff");
  THEME_FIELDS.forEach((f) => {
    const val = theme[f.key]; if (!val) return;
    f.vars.forEach((v) => root.style.setProperty(v, val));
    if (f.soft) root.style.setProperty(f.soft, mix(val, dark ? 0.22 : 0.12, baseBg));
  });
  root.style.setProperty("--faint", mix(theme.muted || "#9AA1B1", 0.6, theme.bg || "#fff"));
}

export {
  PRESETS,
  THEME_DARK,
  THEME_DEFAULT,
  THEME_FIELDS,
  applyTheme,
  hexToRgb,
  mix,
};
