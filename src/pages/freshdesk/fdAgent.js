/*
 * src/pages/freshdesk/fdAgent.js
 *
 * Who is signed in, and what their emails are signed with.
 *
 * currentAgentProfile() resolves identity from the admin panel's own session
 * first -- that is the account holding the JWT, and therefore the account these
 * replies are actually sent by. There is deliberately no hard-coded fallback
 * name: this page used to greet every user, and sign every outgoing email, as
 * whoever happened to be logged in when it was written.
 */
import { kvGetSync, kvSet, kvDelete, kvGetAsync } from "./fdShared";
import { SEED_AGENTS } from "./pages/SettingsPage";

/* ============================================================================
   EMAIL SIGNATURE LAYER — Freshdesk-style auto signatures
   ========================================================================== */
const SIG_KEY = "hh-signature";

const SIG_DEFAULT = {
  enabled: true,
  applyForward: false,
  template: "Regards,\n\n{{Agent Name}}\n{{Designation}}\n{{Company Name}}",
  teams: {}, // e.g. { "Tech Support": "custom template" }
};

const SIG_PLACEHOLDERS = ["{{Agent Name}}", "{{Designation}}", "{{Department}}", "{{Company Name}}", "{{Support Email}}", "{{Phone Number}}"];

function getSigSettings() {
  try { return { ...SIG_DEFAULT, ...JSON.parse(kvGetSync(SIG_KEY) || "{}") }; } catch (e) { return { ...SIG_DEFAULT }; }
}

function saveSigSettings(next) { kvSet(SIG_KEY, JSON.stringify(next)); }

const TEAM_KEY = "hh-team";

function getTeamRoster() {
  try { const r = JSON.parse(kvGetSync(TEAM_KEY) || "null"); if (Array.isArray(r) && r.length) return r; } catch (e) {}
  return SEED_AGENTS;
}

/* Identity resolution for signatures — Freshdesk-style:
   1) who is logged in (auth session)  2) their record in Settings → Team Management
   3) the Admin Profile page  4) safe defaults.  Nothing is hardcoded per-agent. */
/*
 * Who is signed in.
 *
 * Resolution order, most authoritative first:
 *   1. The admin panel's own session (localStorage 'user') -- this is the
 *      account that actually authenticated and holds the JWT, so it is the
 *      truth about who is sending mail from this desk.
 *   2. Their row in Settings > Team Management, for the role/department/phone
 *      the panel session does not carry.
 *   3. This page's local profile overrides.
 *
 * There is deliberately no hard-coded fallback name any more. The desk used to
 * greet everyone as the person who happened to be logged in when the page was
 * written, and signed their emails with that name too -- which is worse than
 * cosmetic once these signatures go out to customers.
 */
function currentPanelUser() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (!u || (!u.name && !u.email)) return null;
    return u;
  } catch { return null; }
}

function currentAgentProfile() {
  const panel = currentPanelUser();
  const ses = authApi.sessionSync();
  const email = (panel && panel.email) || (ses && ses.email) || "";
  const name = (panel && panel.name) || (ses && ses.name) || "";

  const roster = getTeamRoster();
  const rec = email ? roster.find((a) => (a.email || "").toLowerCase() === email.toLowerCase()) : null;
  if (rec) {
    return { name: name || rec.name, role: rec.role, dept: rec.dept, team: rec.team,
             email: rec.email || email, phone: rec.phone };
  }

  let p = {};
  try { p = JSON.parse(kvGetSync("hh-profile") || "{}"); } catch (e) { /* nothing saved */ }
  const role = (p.role || "").split(" - ");
  return {
    name:  name || p.name || (email ? email.split("@")[0] : "Agent"),
    role:  (role[0] || "").trim(),
    dept:  role[1] || "",
    team:  "",
    email: email || p.email || "",
    phone: p.phone || "",
  };
}

function resolveSignature(settings, dept) {
  const st = settings || getSigSettings();
  if (!st.enabled) return "";
  const p = currentAgentProfile();
  // priority: this agent's own signature → team signature (ticket dept) → company default
  const tpl = (st.users && p.email && st.users[p.email.toLowerCase()])
    || (dept && st.teams && st.teams[dept])
    || st.template || "";
  return tpl
    .replaceAll("{{Agent Name}}", p.name || "")
    .replaceAll("{{loggedInUser.fullName}}", p.name || "")
    .replaceAll("{{Designation}}", p.role || "Support Executive")
    .replaceAll("{{loggedInUser.designation}}", p.role || "Support Executive")
    .replaceAll("{{Department}}", p.dept || dept || "")
    .replaceAll("{{loggedInUser.department}}", p.dept || dept || "")
    .replaceAll("{{Company Name}}", "Internship Studio")
    .replaceAll("{{loggedInUser.companyName}}", "Internship Studio")
    .replaceAll("{{Support Email}}", "contact@internshipstudio.com")
    .replaceAll("{{loggedInUser.supportEmail}}", "contact@internshipstudio.com")
    .replaceAll("{{Phone Number}}", p.phone || "")
    .replaceAll("{{loggedInUser.phone}}", p.phone || "");
}

/* ============================================================================
   ADMIN PROFILE
   ========================================================================== */
/* Shape only -- the values are filled from the signed-in account by
   currentAgentProfile(). Naming a real person here is how this page ended up
   signing every agent's emails as somebody else. */
const PROFILE_DEFAULT = { name: "", role: "", emp: "", email: "", phone: "", joined: "", location: "" };

/* ============================================================================
   APP  (lightweight router — swap for react-router-dom in your project)
   ========================================================================== */
/* ============================================================================
   SIGN IN
   ========================================================================== */
/* ============================================================================
   AUTH LAYER — mock API structured for a real backend (SendGrid/SES/SMTP later)
   ========================================================================== */
const SESSION_KEY = "hh-session";

const USERS_KEY = "hh-users";

const SESSION_DAYS = 8;

function parseSession(raw) {
  try { const s = JSON.parse(raw || ""); if (s && s.token && s.exp && Date.now() < s.exp) return s; } catch (e) {}
  return null;
}

function makeToken() {
  try { const a = new Uint8Array(24); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join(""); }
  catch (e) { return "t" + Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

/* Mock backend — swap each method's body for a fetch() call when the real API exists.
   Endpoints modelled: /auth/send-otp, /auth/verify-otp, /auth/login,
   /auth/forgot-password, /auth/reset-password, /auth/logout, /auth/session */
const API_BASE = (() => {
  try { return (globalThis.HELPHIVE_API_BASE || localStorage.getItem("hh-api-base") || "").replace(/\/$/, ""); } catch (e) { return ""; }
})();

/* Set this once in the browser console to enable the Google button:
     localStorage.setItem("hh-google-client-id", "YOUR_CLIENT_ID.apps.googleusercontent.com")
   Get a Client ID from https://console.cloud.google.com/apis/credentials
   (OAuth client → Web application → add your app's URL under
   "Authorized JavaScript origins"). The same ID must be set as
   GOOGLE_CLIENT_ID in backend/.env so the server can verify tokens. */
const GOOGLE_CLIENT_ID = (() => {
  try { return globalThis.HELPHIVE_GOOGLE_CLIENT_ID || localStorage.getItem("hh-google-client-id") || ""; } catch (e) { return ""; }
})();

/* When API_BASE is set (e.g. http://localhost:5001) every call below hits the
   real Express backend in /backend. Without it, the mock keeps the demo usable. */
const authApi = (() => {
  const live = !!API_BASE;
  let verifyTokenMem = null; // OTP proof from the backend, held for the login call

  const http = async (path, body, token) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || `Request failed (${res.status}).` };
      return data;
    } catch (e) {
      return { ok: false, error: "Cannot reach the auth server. Is the backend running?" };
    }
  };

  /* ---------- demo fallback (no backend configured) ---------- */
  let users = {
    "rainahemani14@gmail.com": { password: "helphive", name: "Hemani Raina" },
    // Team Management demo agents — same password, so you can see per-agent signatures
    "rahul.sharma@internshipstudio.com": { password: "helphive", name: "Rahul Sharma" },
    "priya.patel@internshipstudio.com": { password: "helphive", name: "Priya Patel" },
    // Ticket-assignee agents — log in as these to see a personalized My Dashboard
    "priya.nair@internshipstudio.com": { password: "helphive", name: "Priya Nair" },
    "rahul.sethi@internshipstudio.com": { password: "helphive", name: "Rahul Sethi" },
  };
  try { users = { ...users, ...JSON.parse(kvGetSync(USERS_KEY) || "{}") }; } catch (e) {}
  const otps = {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const OTP_TTL = 120e3, MAX_ATTEMPTS = 5, MAX_RESENDS = 3;

  return {
    live,
    async sendOtp(email, { reset = false, password = "" } = {}) {
      if (live) {
        const r = reset ? await http("/forgot-password", { email }) : await http("/send-otp", { email, password });
        if (!r.ok) return r;
        return { ok: true, ttl: r.ttl || 300e3, resendsLeft: 3 };
      }
      await wait(700);
      if (!users[email]) return { ok: false, error: reset ? "No account found for this email." : "Account not found. Contact your administrator." };
      if (!reset && users[email].status === "pending") return { ok: false, error: "Your account is awaiting administrator approval. You'll be able to sign in once approved." };
      const prev = otps[email];
      const resends = prev ? prev.resends + 1 : 0;
      if (resends > MAX_RESENDS) return { ok: false, error: "Too many OTP requests. Try again later." };
      // Demo environment (no backend configured): a fixed silent code — never shown in the UI.
      otps[email] = { code: "123456", exp: Date.now() + OTP_TTL, attempts: 0, resends, reset };
      return { ok: true, ttl: OTP_TTL, resendsLeft: MAX_RESENDS - resends };
    },
    async resendOtp(email, opts = {}) {
      if (live) {
        const r = opts.reset ? await http("/forgot-password", { email }) : await http("/resend-otp", { email });
        if (!r.ok) return r;
        return { ok: true, ttl: r.ttl || 300e3, resendsLeft: 3 };
      }
      return this.sendOtp(email, opts);
    },
    async verifyOtp(email, code, { reset = false } = {}) {
      if (live) {
        const r = await http(reset ? "/verify-reset-otp" : "/verify-otp", { email, otp: code });
        if (!r.ok) return r;
        verifyTokenMem = r.verifyToken;
        return { ok: true };
      }
      await wait(450);
      const rec = otps[email];
      if (!rec) return { ok: false, error: "No OTP was requested. Send a new code." };
      if (Date.now() > rec.exp) return { ok: false, error: "This code has expired. Request a new OTP.", expired: true };
      rec.attempts++;
      if (rec.attempts > MAX_ATTEMPTS) return { ok: false, error: "Too many incorrect attempts. Request a new OTP.", expired: true };
      if (rec.code !== code) return { ok: false, error: `Incorrect code. ${MAX_ATTEMPTS - rec.attempts} attempt${MAX_ATTEMPTS - rec.attempts !== 1 ? "s" : ""} left.` };
      rec.verified = true;
      return { ok: true };
    },
    async login(email, password) {
      if (live) {
        if (!verifyTokenMem) return { ok: false, error: "Verify the OTP sent to your email first." };
        const r = await http("/login", { email, password, verifyToken: verifyTokenMem });
        if (!r.ok) return r;
        verifyTokenMem = null;
        const session = { token: r.token, email: r.user.email, name: r.user.name, role: r.user.role, exp: Date.now() + (r.expiresInDays || 8) * 864e5 };
        await kvSet(SESSION_KEY, JSON.stringify(session));
        return { ok: true, session };
      }
      await wait(600);
      const rec = otps[email];
      if (!rec || !rec.verified) return { ok: false, error: "Verify the OTP sent to your email first." };
      const u = users[email];
      if (!u || u.password !== password) return { ok: false, error: "Incorrect password." };
      if (u.status === "pending") return { ok: false, error: "Your account is awaiting administrator approval. You'll be able to sign in once approved." };
      if (u.status === "rejected" || u.status === "disabled") return { ok: false, error: "This account is not active. Contact your administrator." };
      delete otps[email];
      const session = { token: makeToken(), email, name: u.name, exp: Date.now() + SESSION_DAYS * 864e5 };
      await kvSet(SESSION_KEY, JSON.stringify(session));
      return { ok: true, session };
    },
    async resetPassword(email, newPassword) {
      if (live) {
        if (!verifyTokenMem) return { ok: false, error: "Verify the OTP first." };
        const r = await http("/reset-password", { email, newPassword, verifyToken: verifyTokenMem });
        if (r.ok) verifyTokenMem = null;
        return r;
      }
      await wait(600);
      const rec = otps[email];
      if (!rec || !rec.verified) return { ok: false, error: "Verify the OTP first." };
      if (!newPassword || newPassword.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
      users[email] = { ...(users[email] || { name: email.split("@")[0] }), password: newPassword };
      delete otps[email];
      await kvSet(USERS_KEY, JSON.stringify(users));
      return { ok: true };
    },
    /* ---------- registration (email + mobile OTP) ---------- */
    async registerSendOtp(kind, dest) {
      if (live) {
        const r = await http(kind === "email" ? "/register/send-email-otp" : "/register/send-mobile-otp", kind === "email" ? { email: dest } : { mobile: dest });
        if (!r.ok) return r;
        return { ok: true, ttl: r.ttl || 300e3 };
      }
      await wait(600);
      let regUsers = {};
      try { regUsers = JSON.parse(kvGetSync(USERS_KEY) || "{}"); } catch (e) {}
      if (kind === "email" && (users[dest] || regUsers[dest])) return { ok: false, error: "An account with this email already exists." };
      otps[`reg-${kind}:${dest}`] = { code: "123456", exp: Date.now() + 300e3, attempts: 0, resends: 0 };
      return { ok: true, ttl: 300e3 };
    },
    async registerVerifyOtp(kind, dest, code) {
      if (live) {
        const r = await http(kind === "email" ? "/register/verify-email-otp" : "/register/verify-mobile-otp", kind === "email" ? { email: dest, otp: code } : { mobile: dest, otp: code });
        if (!r.ok) return r;
        if (kind === "email") this._emailToken = r.verifyToken; else this._mobileToken = r.verifyToken;
        return { ok: true };
      }
      await wait(400);
      const rec = otps[`reg-${kind}:${dest}`];
      if (!rec) return { ok: false, error: "No OTP was requested. Send a new code." };
      if (Date.now() > rec.exp) return { ok: false, error: "This code has expired. Request a new OTP.", expired: true };
      rec.attempts++;
      if (rec.attempts > MAX_ATTEMPTS) return { ok: false, error: "Too many incorrect attempts. Request a new OTP.", expired: true };
      if (rec.code !== code) return { ok: false, error: `Incorrect code. ${MAX_ATTEMPTS - rec.attempts} attempt${MAX_ATTEMPTS - rec.attempts !== 1 ? "s" : ""} left.` };
      rec.verified = true;
      return { ok: true };
    },
    async register(p) {
      if (live) {
        const r = await http("/register", { ...p, emailToken: this._emailToken, mobileToken: this._mobileToken });
        if (r.ok) { this._emailToken = null; this._mobileToken = null; }
        return r;
      }
      await wait(700);
      const em = otps[`reg-email:${p.email}`], mo = otps[`reg-mobile:${p.mobile}`];
      if (!em || !em.verified) return { ok: false, error: "Verify your email address first." };
      if (!mo || !mo.verified) return { ok: false, error: "Verify your mobile number first." };
      let regUsers = {};
      try { regUsers = JSON.parse(kvGetSync(USERS_KEY) || "{}"); } catch (e) {}
      if (users[p.email] || regUsers[p.email]) return { ok: false, error: "An account with this email already exists." };
      if (Object.values(regUsers).some((u) => u.phone === p.mobile)) return { ok: false, error: "An account with this mobile number already exists." };
      regUsers[p.email] = { password: p.password, name: p.fullName, phone: p.mobile, designation: p.designation, dept: p.department || "", company: p.companyName, status: "pending", emailVerified: true, mobileVerified: true, createdAt: Date.now() };
      users[p.email] = regUsers[p.email];
      delete otps[`reg-email:${p.email}`]; delete otps[`reg-mobile:${p.mobile}`];
      await kvSet(USERS_KEY, JSON.stringify(regUsers));
      return { ok: true, status: "pending" };
    },
    async googleLogin(credential) {
      if (live) {
        const r = await http("/google", { credential });
        if (!r.ok) return r;
        const session = { token: r.token, email: r.user.email, name: r.user.name, role: r.user.role, exp: Date.now() + (r.expiresInDays || 8) * 864e5 };
        await kvSet(SESSION_KEY, JSON.stringify(session));
        return { ok: true, session };
      }
      try {
        const b64 = credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(decodeURIComponent(escape(atob(b64))));
        const session = { token: makeToken(), email: payload.email, name: payload.name || (payload.email || "").split("@")[0], exp: Date.now() + SESSION_DAYS * 864e5 };
        await kvSet(SESSION_KEY, JSON.stringify(session));
        return { ok: true, session };
      } catch (e) { return { ok: false, error: "Could not read the Google response." }; }
    },
    async logout() {
      if (live) { const ses = parseSession(kvGetSync(SESSION_KEY)); http("/logout", {}, ses?.token); }
      await kvDelete(SESSION_KEY);
      return { ok: true };
    },
    sessionSync() { return parseSession(kvGetSync(SESSION_KEY)); },
    async sessionAsync() {
      const ses = parseSession(await kvGetAsync(SESSION_KEY)) || parseSession(kvGetSync(SESSION_KEY));
      if (!ses) return null;
      if (live) {
        const r = await http("/me", undefined, ses.token);
        if (!r.ok) { await kvDelete(SESSION_KEY); return null; }   // expired/invalid on server → auto sign-out
      }
      return ses;
    },
  };
})();

export {
  API_BASE,
  GOOGLE_CLIENT_ID,
  PROFILE_DEFAULT,
  SESSION_DAYS,
  SESSION_KEY,
  SIG_DEFAULT,
  SIG_KEY,
  SIG_PLACEHOLDERS,
  TEAM_KEY,
  USERS_KEY,
  authApi,
  currentAgentProfile,
  currentPanelUser,
  getSigSettings,
  getTeamRoster,
  makeToken,
  parseSession,
  resolveSignature,
  saveSigSettings,
};
