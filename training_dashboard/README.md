# iStudio learning portal — `training.internshipstudio.com`

The learner-facing half of the LMS. Courses, sections and lessons are authored
in the admin panel (`/lms`, backed by `react-api/api/lms/lms_api.php`); this app
is where learners actually watch them.

```
training_dashboard/
├─ src/                      the React app (Vite + React 19)
└─ public/
   ├─ .htaccess              SPA fallback + protects /api/config
   └─ api/                   the portal's own PHP, deployed as-is
      ├─ _bootstrap.php      CORS, session, $conn, portal tables, helpers
      ├─ auth.php            sign in: password · Google · store · handoff
      ├─ catalog.php         enrolments, one course, one lesson, analytics
      ├─ progress.php        video position + mark complete
      ├─ library.php         notes (Bookmarks tab) + favourites
      ├─ track.php           visits, page views, time-on-page
      └─ config/             *.php.example → copy and fill in on the server
```

## Deploying

1. `npm ci && npm run build` — output lands in `dist/`.
2. Upload the contents of `dist/` to the `training.internshipstudio.com`
   document root. `public/` (including `api/` and `.htaccess`) is copied into
   `dist/` by Vite, so the API ships with the build.
3. On the server, in `dist/api/config/`, copy each `*.php.example` to the real
   name and fill it in:

   | file | what it holds |
   |---|---|
   | `secret.php` | the HMAC key that signs Skill Lab handoff links |
   | `google.php` | the Google Identity client id (optional but recommended) |
   | `db.php` | the database credentials. **Create this.** The shared `cit/common/helper.php` is only a fallback — it is the CIT front controller, not a connector, and including it runs its router and a Composer platform check that 500s on PHP 8.1 |

4. Copy the **same** `secret.php` into
   `user_dashboard/public/api/config/secret.php`. The two apps must agree or
   every handoff link is rejected.
   Generate one with `php -r "echo bin2hex(random_bytes(32));"`.
5. Set `VITE_GOOGLE_CLIENT_ID` in `.env.production` before building if you want
   Google sign-in, and add `https://training.internshipstudio.com` to that
   client's authorised JavaScript origins.
6. In the admin panel, **LMS → Settings → Learning portal**, set the store login
   password. Until it is set, ₹99-store-only buyers cannot sign in.

The `lms_*` portal tables create themselves on first request — nothing to run
by hand.

## How a learner gets in

There are four doors, and `auth.php` decides which one applies. The learner is
never asked which kind of account they have.

| door | who | check |
|---|---|---|
| password | anyone with a `users` row | bcrypt against `users.password` — the same password as the dashboard, because it is the same row |
| Google | a `users` row with that email | the credential JWT is verified with Google, then `aud` is pinned to our client id |
| store | a ₹99-store buyer with **no** `users` row | email must be on a successful `ninety_nine_store_orders` row **and** absent from `users`; password is the shared one from LMS → Settings. A `users` row is created on the spot, so the second visit is an ordinary password login |
| handoff | someone who pressed "Go to learning portal" in the dashboard's Skill Lab | see below |

Every attempt — success or failure, with the reason — is written to
`lms_learner_logins`.

## The Skill Lab handoff

```
dashboard  Training → Skill Lab → "Go to learning portal"
   │
   │  POST /api/skill_lab.php?action=handoff        (dashboard.internshipstudio.com)
   │      writes one lms_portal_handoffs row  ← this IS the click log
   │      returns { id, sig }    sig = HMAC-SHA256("handoff:<id>", secret)
   ▼
portal     GET /?sso=<id>&sig=<sig>                 (training.internshipstudio.com)
   │      auth.php verifies the signature
   │      auth.php checks the row was created TODAY
   │      → portal session starts, ?sso/&sig are scrubbed from the URL
   │      → the id is parked in the `istudio_learn_pass` cookie, expiring at
   │        local midnight
   ▼
later      a refresh replays the cookie and lands straight back inside;
           tomorrow the cookie is gone AND the server would refuse the id,
           so the learner is signed out.
```

Two independent expiries on purpose: a cookie can be edited, a row's
`created_at` cannot. The signature is what stops someone typing `?sso=1234`
and walking into another learner's account.

## Video

`catalog.php` sniffs each stored `video_url` once and tells the client what it
is, so `VideoPlayer.jsx` never has to guess:

| kind | source | plays via | reports position? |
|---|---|---|---|
| `file` | S3 / any direct MP4 | native `<video>` | yes |
| `hls` | `.m3u8` (Bunny CDN pull zone, any HLS origin) | `<video>` + `hls.js`, or natively on Safari | yes |
| `vimeo` | Vimeo links, incl. unlisted `/ID/HASH` | iframe + player.js `postMessage` | yes |
| `bunny` | `iframe.mediadelivery.net` embeds | iframe + player.js `postMessage` | yes |
| `youtube` | any YouTube URL | privacy-preserving iframe | no — complete it from the player menu |

`hls.js` is a dynamic import, so a course of plain MP4s never downloads it.
Every source shows a spinner until it genuinely reports ready, and a source
that fails gets a message and a retry rather than a black rectangle.

## Analytics

| table | what it answers |
|---|---|
| `lms_portal_handoffs` | how many times Skill Lab's button was pressed, by whom, and whether the learner actually landed (`consumed_at`) |
| `lms_learner_logins` | every sign-in and every failed attempt, by method |
| `lms_learner_visits` | one row per browser tab: entry page, referrer, page count, total seconds |
| `lms_learner_page_views` | seconds spent per screen, attributed to a course and lesson where there is one |

The client buffers time locally and POSTs **one batched flush per minute** to
`track.php?action=flush` — screens accumulate in a Map, so ten lesson switches
arrive as ten segments in a single request rather than ten requests.

Flushes also fire when the tab is hidden and on `pagehide`, both via
`navigator.sendBeacon` (a `fetch` at that point is routinely cancelled, and
`beforeunload` never fires reliably on mobile).

Time stops accruing two minutes after the last sign of life — a click, a key,
a scroll, or video playback — so a tab left open overnight does not report
eight hours of study.

## Local development

```bash
npm run dev        # http://localhost:5174
```

`vite.config.js` proxies `/api` to the live host, so the browser sees ONE origin
in dev exactly as it does in production, and you get real data without running
PHP locally.

That proxy is not a convenience — it is what keeps the session cookie
first-party. Point `VITE_API_BASE` at the full URL instead and every request
after login comes back 401: a `SameSite=Lax` cookie is withheld on cross-site
XHR. (`_bootstrap.php` does relax to `SameSite=None; Secure` for allow-listed
origins, so it works either way — but only while the browser still permits
third-party cookies. Use the proxy.)
