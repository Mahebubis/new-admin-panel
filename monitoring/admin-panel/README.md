# Monitoring page for the admin panel

Two files, written to match the conventions in your existing `Attendance` page —
same `api` axios instance, `react-hot-toast`, `thS`/`tdS`/`lblS` style objects,
Plus Jakarta Sans, the indigo/violet gradient headers, and the same
`api_success` / `api_error` / `require_jwt` / `require_permission` pattern on the
PHP side.

| File | Goes to |
|---|---|
| `monitoring.php` | `/admin/react-api/api/monitoring/monitoring.php` |
| `Monitoring.jsx` | next to your other pages, e.g. `src/pages/monitoring/Monitoring.jsx` |

---

## Install

### 1. Copy the files

```
admin-panel/monitoring.php   →  admin/react-api/api/monitoring/monitoring.php
admin-panel/Monitoring.jsx   →  src/pages/monitoring/Monitoring.jsx
```

### 2. Grant the API access to the history database

**This is the step that is easy to miss.** The monitoring history lives in the
`monitor` database, not `istudio_cit`, so the account is deliberately kept
apart from your application data — the monitoring server never needs INSERT
rights anywhere near real student records.

Your admin API connects as `istudio_admin`, which was never added to `monitor`.
Until it is, every request returns a clear error rather than an empty page.

cPanel → **Manage My Databases** → **Add User To Database**

| Field | Value |
|---|---|
| User | `istudio_admin` |
| Database | `monitor` |

Then tick **SELECT** only, and click **Make Changes**. The panel never writes
to this table — the monitoring server does.

### 3. Add the permission

`require_permission('monitoring', $jwt)` gates the endpoint, matching how
`attendance` works. Add a `monitoring` permission to whichever roles should see
the page, the same way you added `attendance`.

### 4. Add the route and menu item

```jsx
import Monitoring from './pages/monitoring/Monitoring';

<Route path="/monitoring" element={<Monitoring />} />
```

---

## What the page shows

**Overview** — a card per check with its current state, 24-hour and 7-day
uptime as both a bar and a number, and the failing step spelled out when
something is broken. A banner at the top answers "is anything wrong right now"
before you read anything else. Refreshes itself every 60 seconds without
blanking the screen. Below that, a 30-day bar chart of passed against failed.

**Run History** — every result, filterable by check, outcome and date, with CSV
export. Clicking a row opens the full step-by-step trace of that run.

**Incidents** — consecutive failures grouped into outage windows, with how long
each lasted, whether an alert email went out, and when it recovered. Anything
still broken is marked **Ongoing**.

---

## Details worth knowing

**Times.** The monitor stores everything in UTC. The API converts to IST in SQL
(`CONVERT_TZ(...,'+00:00','+05:30')`), so nothing downstream has to think about
timezones — including the date filters, which mean IST calendar days.

**"Skipped" is not a failure.** When registration breaks, the exam and payment
checks cannot be evaluated at all, so they are recorded as `skip`. They are
excluded from every uptime and incident calculation — counting them either way
would give you a number that isn't true.

**Staleness.** The overview flags `stale` when nothing has been recorded for
over 20 minutes. The light checks run every 5, so silence that long means the
monitoring server itself is in trouble — and a monitor that has quietly stopped
looks exactly like one with nothing to report.

**Retention.** Rows older than 90 days are removed automatically by the
monitoring service (`DB_REPORT_RETENTION_DAYS`). At current schedules the table
settles around 55,000 rows.

---

## Endpoints

| Action | Returns |
|---|---|
| `?action=overview` | Current state of all six checks, uptime over 24h/7d/30d, staleness |
| `?action=runs` | Paginated history. Filters: `check`, `status`, `date`, `date_from`, `date_to`, `q`, `page`, `per_page` |
| `?action=run&run_id=…` | Every check in one run, with step traces and context |
| `?action=incidents&days=30` | Outage windows grouped from consecutive failures |
| `?action=trend&days=30` | Daily pass/fail counts for the chart |
| `?action=export` | CSV of the current filter, capped at 20,000 rows |
