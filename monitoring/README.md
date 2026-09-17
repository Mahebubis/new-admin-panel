# iStudio Monitoring

Synthetic browser monitoring for Internship Studio. Every few minutes a real
Chromium browser registers a student, signs in, starts and submits an exam, and
opens the payment checkout — exactly the journey a student takes. When any step
breaks, the team gets an email with the failing step, the error and a
screenshot, within minutes rather than when a student complains.

Built against the four projects in this repo:

| System | What it is | Monitored via |
|---|---|---|
| `user_dashboard` | React SPA + PHP API at `dashboard.internshipstudio.com` | Registration, login and checkout, driven in a real browser |
| `exam-frontend` | React SPA at `exam.internshipstudio.com` | Exam start and answering, driven in a real browser |
| `exam-backend` | Node/Express at `examapi.internshipstudio.com` (:3001) | `user_login_initiate`, `fetch_all_exams`, `fetch_random_questions`, `update_exam_data`, `end_exam`, `fetch_result` |
| `payment-backend` | Go/chi at `paymentapi.internshipstudio.com` (:3002) | `create-order`, `get-payment-details`, both webhook endpoints |

---

## What it checks

Two schedules, because the cheap checks should run often and the expensive ones
should not.

### Light group — every 5 minutes (`CRON_LIGHT`)

| Check | What it proves |
|---|---|
| **Website availability** | The dashboard, login, registration and exam pages all answer, and the dashboard SPA actually boots (not just a 200 on `index.html` with a broken bundle). This is the check that catches `server.accofin.in` going down. |
| **API health** | The MySQL database is reachable; registration, exam and payment APIs answer; the exam question bank is not empty; both payment webhook endpoints accept a POST without 5xx-ing — a dead webhook silently loses real payment callbacks. |

### Journey group — every 15 minutes (`CRON_JOURNEY`)

One fixed test account walks the whole thing, in order, handing state along.
The account is deleted and re-registered at the start of every run — see
[The test account](#the-test-account).

| Check | Steps |
|---|---|
| **Student registration** | Delete the previous test account → open `/register` → type email, phone, name, password → submit → land on `/register/thank-you_instant` → confirm `user_id` was returned and the session works → flag the row as a test account |
| **Login and exam start** | Fresh browser context → `/login` → sign in → `user_login_initiate` → open `exam.internshipstudio.com` with the hash → click **Start Exam** → first question renders with options |
| **Exam answering and submission** | Pick options and click **Save & Next** (each click is a real `update_exam_data` call) → submit via `end_exam` → read the result back with `fetch_result` to prove it was stored |
| **Payment checkout** | Create a real order → load the Cashfree/Razorpay checkout with that session → confirm payment methods render → **abandon it** |

Registration failing means exam and payment are *skipped*, not failed — one
outage produces one alert naming the actual cause, not four.

---

## Quick start (local)

```bash
cd monitoring
npm install
npx playwright install chromium

cp .env.example .env      # fill in ALERT_TO and the SMTP block
```

Then run without touching anyone's inbox:

```bash
npm run once:light -- --no-alert     # availability + APIs, ~20s
npm run once:journey -- --no-alert   # full student journey, ~2-4 min
node src/runOnce.js --check=registration --no-alert
node src/runOnce.js --check            # list check ids
```

Prove the alert path works *before* you need it:

```bash
npm run test:alert                   # verifies SMTP, sends one sample CRITICAL email
```

Start the scheduler:

```bash
npm start                            # cron + status dashboard on :8080
```

---

## The alert

Subject and body follow the format in the spec:

```
[iStudio Monitor] CRITICAL: Payment checkout Failed — Load payment gateway checkout

Time: 25 Aug 2026, 11:25:04 am IST
Failed step: Load payment gateway checkout
Error: Cashfree checkout could not be opened: SDK failed to load (HTTP 500)
Attempts: 2 (retried before alerting)
Consecutive failing runs: 2
Failing since: 25 Aug 2026, 11:10:02 am IST
Last successful run: 25 Aug 2026, 11:07:41 am IST

Steps:
  [PASS] Create payment order (1.8s)
  [FAIL] Load payment gateway checkout (30.0s) — HTTP 500 from sdk.cashfree.com
```

with the screenshot and page HTML attached.

Throttling, so a long outage does not become a mailbox flood:

- `ALERT_AFTER_CONSECUTIVE_FAILURES` (default **2**) — a check must fail this
  many runs in a row before the first email. A single blip during a deploy is
  not worth waking anyone for. Set to `1` to alert immediately.
- `ALERT_REPEAT_MINUTES` (default **60**) — while it stays broken, one reminder
  per hour.
- `ALERT_ON_RECOVERY` (default **on**) — one "RECOVERED" email when it goes
  green again.

State lives in `state/state.json`, so a restart does not re-alert on something
the team already knows about.

Optional extra channels: `SLACK_WEBHOOK_URL` and `GENERIC_WEBHOOK_URL`
(the latter gets the full JSON result — point it at a WhatsApp Business API
relay, PagerDuty, or anything else). Neither can block or fail the email.

---

## Status page

`http://<server>:8080` — current state per check, recent run history, auto-refresh.

- `GET /healthz` → `200 {"status":"ok"}` or `503 {"status":"degraded", ...}`
- `GET /api/state` → the raw state JSON
- `POST /run/journey` → trigger a run by hand, e.g. right after deploying a fix

**Point an external uptime service at `/healthz`.** This monitor is itself a
single point of failure: if the box dies, it reports nothing and silence looks
like health. A free UptimeRobot/Better Stack check on `/healthz` closes that
hole for ₹0.

---

## The test account

**One fixed account is used for every journey run**, configured in `.env`:

```ini
MONITOR_EMAIL=monitor.test@internshipstudio.com
MONITOR_PASSWORD=M0nitorTest2026
MONITOR_FIRST_NAME=Monitor
MONITOR_LAST_NAME=Testaccount
MONITOR_PHONE=9000000001
```

Each journey run begins by **deleting that account from the database**, then
registers it again from scratch. That is what makes a fixed account work: the
exam can only be taken once per user and an order can only be paid once, so
without the reset the exam check would pass exactly once and fail forever
after. Deleting first also means registration is genuinely re-tested every
run, rather than being skipped after the first.

The values must satisfy the application's own validation, or registration
fails every run for reasons unrelated to production being broken. The config
validator refuses to start if they don't:

| Field | Rule | Where it comes from |
|---|---|---|
| Email | `/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/` — **no `+` addressing** | `RegisterPage.jsx` |
| Phone | exactly 10 digits, starting 6–9 | `RegisterPage.jsx` |
| Names | **letters only** — digits are rejected as "special characters" | `register2.php` |

> **The phone number must not belong to any real student.** The reset deletes
> the test account *by email*; phone is a separate unique key, so a number
> owned by someone else's account is never freed and registration then fails
> forever with *"Mobile number already exists"*. Check before you pick one:
> ```sql
> SELECT id, email FROM users WHERE phone = '9000000001';
> ```
> The default `9000000001` **is already taken** on your database — pick
> another. The registration check verifies this each run and names the
> conflicting account in the alert rather than letting it look like a broken
> signup form.

### Database access

The reset needs MySQL credentials:

```ini
DB_CLEANUP_ENABLED=true
DB_HOST=15.207.59.247
DB_USER=monitoring
DB_PASSWORD=...
DB_NAME=istudio_cit
DB_CLEANUP_DRY_RUN=true
DB_CLEANUP_TABLES=cit_results:user_id,cit_exam_login:user_id,payments:user_id
DB_MARK_TEST_ACCOUNT=true
```

Create a dedicated, tightly scoped MySQL user rather than reusing the app's:

```sql
CREATE USER 'monitoring'@'<monitor-server-ip>' IDENTIFIED BY '<strong-password>';
GRANT SELECT, DELETE, UPDATE ON istudio_cit.users          TO 'monitoring'@'<monitor-server-ip>';
GRANT SELECT, DELETE         ON istudio_cit.cit_results    TO 'monitoring'@'<monitor-server-ip>';
GRANT SELECT, DELETE         ON istudio_cit.cit_exam_login TO 'monitoring'@'<monitor-server-ip>';
GRANT SELECT, DELETE         ON istudio_cit.payments       TO 'monitoring'@'<monitor-server-ip>';
FLUSH PRIVILEGES;
```

Also open port 3306 to the monitoring server's IP in the database security
group — it is a different machine from the app servers.

> **Run with `DB_CLEANUP_DRY_RUN=true` first.** It logs exactly which tables
> and how many rows it *would* delete, and changes nothing. Read that output,
> confirm the table list matches your schema, then switch it off. Registration
> will fail on the second run while dry-run is on, because the email is still
> taken — that is expected.

### Safety

`src/db.js` is the only code that deletes anything, and it is deliberately
narrow:

- Rows are only ever resolved by `WHERE email = ?` with the exact
  `MONITOR_EMAIL` value. No `LIKE`, no pattern, no wildcard.
- It **refuses to run** unless the email's local part contains `monitor`,
  `test`, `synthetic` or `healthcheck` — so a mistyped `.env` cannot point it
  at a real student. Verified: `student.real@gmail.com` and
  `admin@internshipstudio.com` are rejected before a connection is even opened.
- Table and column names are whitelisted by shape (`/^[A-Za-z_]\w*$/`) before
  being used, and a table that doesn't exist is a logged warning, not a crash.
- After registering, `users.is_test_account` is set to `1` so your reporting
  can exclude the row.

### Excluding it from analytics

The browser sends a `InternshipStudioMonitor/1.0` User-Agent; the direct API
probes also send `X-Monitor-Probe: istudio-monitoring`. Use either to filter
these sessions out of GTM / Clarity / Netcore.

> The header is deliberately **not** sent from the browser contexts. A custom
> request header turns every cross-origin XHR into a preflighted request, and
> `payment-backend`'s CORS middleware answers preflights with a hardcoded
> `Access-Control-Allow-Headers: Content-Type, Authorization` — so the browser
> blocks the call and the monitor reports a payment outage no student is
> experiencing. A synthetic check has to send exactly what a real browser
> sends.

---

## Payment monitoring

### Why a real ₹1 payment cannot run unattended in production

This is worth being blunt about, because it shapes what the check can do.

Indian card payments are subject to RBI's **additional-factor authentication**
rule: the issuing bank sends a one-time password to the cardholder's phone and
the payment cannot proceed without it. An automated browser has no way to read
that OTP. The same applies to the other methods — UPI needs approval in the
payer's app, netbanking needs a bank login. Saving a card does not help;
the OTP is required per transaction unless you hold a specific
zero-AFA/recurring-mandate arrangement with the gateway, which most merchant
accounts do not.

So an unattended ₹1 payment against the **production** gateway is not
achievable, no matter how the automation is written.

### What the check does by default (`PAYMENT_COMPLETE=false`)

It goes exactly as far as a student does before typing a card number, then
abandons the checkout. **No money moves.**

1. `POST /create-order-testing` with the test account's user id
2. Load the Cashfree v3 SDK / Razorpay checkout with the returned session
3. Assert payment methods actually render (and that it is not a gateway error
   page dressed up as a 200)
4. Read the order back with `/get-payment-details` to prove it was persisted
5. Close the tab

That catches the failure the spec's alert example describes — *"payment gateway
did not load"* — plus a broken order API. The `api-health` check separately
POSTs to `/payment-webhook` and `/razorpay-webhook` and requires a non-5xx
answer, so a crashed or unreachable webhook handler is caught too.

The gap it leaves, stated honestly: `callback → webhook → order creation →
access activation` is not exercised end to end.

### Closing that gap (`PAYMENT_COMPLETE=true`, sandbox only)

Set up a staging `payment-backend` with `CASHFREE_ENVIRONMENT=TEST` (or
Razorpay test keys), point `PAYMENT_API_URL` at it, and set:

```ini
PAYMENT_COMPLETE=true
PAYMENT_CARD_NUMBER=4111111111111111
PAYMENT_CARD_EXPIRY_MONTH=12
PAYMENT_CARD_EXPIRY_YEAR=30
PAYMENT_CARD_CVV=123
PAYMENT_CARD_OTP=123456      # the sandbox's fixed OTP
```

The check then fills the card form, submits the sandbox OTP, waits for the
redirect back to `return_url`, and asserts the order is marked paid — proving
the entire chain including the webhook. `src/utils/payCard.js` handles the form
across both gateways.

**If you want a real ₹1 production payment monitored**, the realistic options
are: run it as a scheduled *manual* check where someone supplies the OTP; or
ask your gateway about a test/zero-AFA merchant flow. Automation alone will not
get there.

---

## Configuration

Everything is in `.env`; `.env.example` documents each key. The ones that
matter most:

| Key | Default | Why you'd change it |
|---|---|---|
| `CRON_LIGHT` | `*/5 * * * *` | Availability polling frequency |
| `CRON_JOURNEY` | `*/15 * * * *` | Full register → exam → checkout journey |
| `MONITOR_EMAIL` | `monitor.test@…` | The fixed test account. Must contain a test marker |
| `MONITOR_EXAM_ID` | `15` | **15 = mock exam.** `1` is the live iCAT and each run would consume a real attempt |
| `DB_CLEANUP_ENABLED` | `true` | Off means registration fails after the first run |
| `DB_CLEANUP_DRY_RUN` | `true` | **Start here.** Logs the deletes without doing them |
| `ALERT_TO` | — | Comma-separated recipients. Required |
| `ALERT_AFTER_CONSECUTIVE_FAILURES` | `2` | `1` = page on the first failure |
| `CHECK_RETRIES` | `1` | Retries before a check counts as failed |
| `PAYMENT_COMPLETE` | `false` | Sandbox only — production needs an OTP no bot can read |
| `HEADLESS` | `true` | `false` locally to watch it click through |

The process refuses to start on a configuration that would silently do nothing
— alerts enabled with no recipients, no SMTP host, missing target URLs.

---

## Hosting: the light server

### Recommendation

A **separate, small Linux VM** — not `server.accofin.in`, and not the
payment-app box. If the monitor lives on the machine it is watching, the outage
you most need to hear about is the one that also kills the alert.

| Option | Spec | Approx cost | Notes |
|---|---|---|---|
| **EC2 `t4g.small` (ARM), ap-south-1** ← recommended | 2 vCPU, 2 GB | **~₹1,100/mo** on-demand, ~₹650 with a 1-year Savings Plan | Same region as your existing boxes, ARM Chromium is supported by Playwright, comfortably fits the workload |
| EC2 `t3.small` (x86) | 2 vCPU, 2 GB | ~₹1,400/mo | Pick this if you want x86 parity with your other instances |
| Lightsail 2 GB | 2 vCPU, 2 GB, 60 GB SSD | **$12/mo flat (~₹1,000)** | Simplest — fixed price, bandwidth included, no security-group fiddling |
| EC2 `t3.micro` | 2 vCPU, 1 GB | ~₹700/mo | Works *only* with the 2 GB swap the setup script adds. Chromium on 1 GB is tight |
| Hetzner CPX11 / DigitalOcean | 2 GB | ~₹450–850/mo | Cheapest, but outside India — adds ~150 ms latency to every check and monitors from a different network path than your students |

That lands inside the ₹0–1,000/month figure in the spec.

**Sizing note:** one Chromium instance with a few tabs peaks around 600–900 MB.
2 GB RAM plus 2 GB swap is comfortable; 1 GB without swap will OOM mid-run and
produce false alerts, which is worse than no monitoring.

**Region:** put it in `ap-south-1` (Mumbai), same as your instances — but in a
**different Availability Zone**. Your two boxes are in `ap-south-1c` and
`ap-south-1b`; `ap-south-1a` for the monitor means an AZ-level failure does not
take out the watcher along with the watched.

### Step by step (EC2)

**1. Launch the instance**

- AMI: Ubuntu Server 24.04 LTS (`arm64` for `t4g.small`, `x86_64` for `t3.small`)
- Type: `t4g.small`
- Region/AZ: `ap-south-1a`
- Storage: 20 GB gp3
- Key pair: create a new one, keep the `.pem` safe
- Security group — inbound:
  | Port | Source | Why |
  |---|---|---|
  | 22 (SSH) | **Your office IP only** | Not `0.0.0.0/0` |
  | 8080 | Your office IP only | Status dashboard |
  | 443/80 | Your office IP only | Only if you put nginx in front |

  Outbound: allow all — it has to reach your sites, the payment gateways and SMTP.

**2. Provision it**

```bash
ssh -i your-key.pem ubuntu@<new-server-ip>

sudo bash -c 'apt update && apt install -y git'
# copy this folder up first (step 3), or fetch the script standalone:
sudo bash /opt/istudio-monitoring/deploy/setup-server.sh
```

`deploy/setup-server.sh` installs Node 22, Playwright's Chromium system
libraries, 2 GB of swap, a `monitor` service user, ufw rules, and the systemd
unit. It is safe to re-run.

**3. Deploy the code**

From your machine:

```bash
rsync -av --exclude node_modules --exclude .env --exclude artifacts \
  ./monitoring/ ubuntu@<server-ip>:/tmp/monitoring/

ssh ubuntu@<server-ip> '
  sudo rsync -a /tmp/monitoring/ /opt/istudio-monitoring/ &&
  sudo chown -R monitor:monitor /opt/istudio-monitoring &&
  sudo -u monitor bash -lc "cd /opt/istudio-monitoring && npm ci --omit=dev && npx playwright install chromium"
'
```

**4. Configure**

```bash
sudo -u monitor cp /opt/istudio-monitoring/.env.example /opt/istudio-monitoring/.env
sudo -u monitor nano /opt/istudio-monitoring/.env      # ALERT_TO + SMTP_*
sudo chmod 600 /opt/istudio-monitoring/.env
```

**5. Smoke test before going live**

```bash
cd /opt/istudio-monitoring
sudo -u monitor node src/runOnce.js --group=light --no-alert
sudo -u monitor node src/runOnce.js --group=journey --no-alert
sudo -u monitor npm run test:alert
```

The journey run should print `PASS` for all four checks and leave one synthetic
account behind — verify it appears in your admin panel, then delete it.

**6. Start it**

```bash
sudo systemctl enable --now istudio-monitoring
sudo systemctl status istudio-monitoring
sudo journalctl -u istudio-monitoring -f
```

**7. Watch the watcher**

Sign up for a free UptimeRobot account and add an HTTP monitor on
`http://<server-ip>:8080/healthz`, 5-minute interval, alerting the same team.
Now a dead monitoring box also produces an alert.

### Alternatives to a VPS

- **GitHub Actions** — [`.github/workflows/monitor.yml`](.github/workflows/monitor.yml)
  is ready to go. Zero servers, but GitHub's cron is best-effort and routinely
  runs 10–15 minutes late, which breaks the "know within 5–10 minutes" goal.
  Good as a *secondary* scheduler running from outside AWS.
- **Cron instead of the daemon** — if you would rather not run a long-lived
  process, drop the scheduler and use the one-shot CLI:
  ```cron
  */5  * * * * cd /opt/istudio-monitoring && /usr/bin/node src/runOnce.js --group=light   >> /var/log/monitor.log 2>&1
  */15 * * * * cd /opt/istudio-monitoring && /usr/bin/node src/runOnce.js --group=journey >> /var/log/monitor.log 2>&1
  ```
  You lose the status dashboard and overlap protection; the state file and
  alert throttling still work.

---

## Operating it

```bash
sudo systemctl restart istudio-monitoring     # after a config change
sudo journalctl -u istudio-monitoring -n 200  # recent logs
sudo journalctl -u istudio-monitoring -f      # follow

curl -s localhost:8080/api/state | jq         # current state
curl -X POST localhost:8080/run/journey       # re-run by hand after a fix
```

Failure evidence lands in `artifacts/<run-id>/` — screenshot, page HTML and
browser console log per failing check. Pruned after `ARTIFACT_RETENTION_DAYS`
(7 by default).

### When a check is failing but the site is fine

Almost always one of:

- **A selector moved.** The checks target stable attributes (`input[name="email"]`,
  button text like `Start Exam`), but a redesign can still break them. The
  attached screenshot tells you immediately. Update the check.
- **The registration page is in maintenance mode.** The check detects this and
  says so explicitly rather than reporting a missing field.
- **The synthetic phone number collided.** Rare — 9 random digits — and the
  retry handles it.
- **The mock exam ran out of questions.** `api-health` catches this
  independently, so look there first.

### Adding a check

Drop a file in `src/checks/` exporting `{ id, name, group, severity,
needsBrowser, requires, run(ctx) }` and register it in `src/checks/index.js`.
`ctx` gives you `config`, `recorder`, `browser`, `artifactDir`, `shared` and
`log`; wrap each student-visible action in `recorder.step('...', async () => ...)`
so failures name the step in the alert. `recorder.softStep` for things worth
reporting but not worth failing the check over.

---

## Layout

```
monitoring/
├── src/
│   ├── index.js           cron scheduler + dashboard (the service)
│   ├── runOnce.js         one-shot CLI
│   ├── runner.js          orchestration: retries, timeouts, deps, alerting
│   ├── config.js          every knob, plus start-up validation
│   ├── state.js           failure counters, throttling, recovery (state/state.json)
│   ├── browser.js         Playwright launch, console capture, gotoOk
│   ├── dashboard.js       status page + /healthz
│   ├── testAlert.js       SMTP verification + sample alert
│   ├── alert/             email (nodemailer), Slack, generic webhook, templates
│   ├── checks/            the six checks
│   └── utils/             http, result recorder, synthetic identity, artifacts
├── deploy/
│   ├── setup-server.sh    provision a fresh Ubuntu box
│   ├── monitoring.service systemd unit
│   ├── ecosystem.config.cjs  pm2 alternative
│   ├── nginx.conf         TLS + basic auth for the dashboard
│   └── cleanup-synthetic-users.sql
└── .github/workflows/monitor.yml
```
