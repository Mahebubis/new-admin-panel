# Journey Builder — Backend API Contract & Schema

Implementation-ready contract for the PHP/MySQL backend behind the Journey Builder.
It is derived from the exact data shapes the frontend already uses (`journeyStore.js`),
so building the backend is a fill-in and the **only frontend change is swapping
`journeyStore.js` from localStorage to HTTP calls** (mapping in §4).

Full engine design (execution, scheduler, workers) lives in the spec docs
(`journey-engine-study-and-spec.md` §5–§8); this file is the CRUD + versioning seam the
current UI needs, plus the engine tables it will grow into.

---

## 1. The journey object (what the frontend reads/writes)

```jsonc
{
  "id": 462,
  "name": "iCAT · Entrance exam nudge",
  "tags": ["offcampusly", "icat"],          // ≤5
  "status": "draft",                         // draft|scheduled|ongoing|paused|stopped|completed|archived
  "startAt": "2026-08-06T10:00",             // datetime-local string
  "endType": "never",                        // never|date
  "endAt": "",                               // datetime-local when endType=date
  "dates": "Aug 06, 2026 10:00 am - Never ending",  // display cache (server may recompute)
  "graph": { "nodes": { "n1": {…} }, "edges": { "e1": {…} } },  // see §1.1
  "settings": { … },                          // see §1.2 (nullable)
  "versions": [ { "no":1, "at":"…", "name":"…", "status":"…", "nodes":{…}, "edges":{…}, "settings":{…} } ],
  "sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "conversions": 0, "revenue": 0,
  "convGoal": false, "revGoal": false,
  "edited": "Aug 06, 2026 11:45 am",          // display string
  "updatedAt": 1754480700000                  // epoch ms
}
```

### 1.1 Graph node / edge shape (canvas serialization)
```jsonc
// node
{ "id": "n1", "key": "trg_activity", "x": 60, "y": 40, "cfg": { … } }
// edge  (branch must match the node type's outputs; wait is null or a delay)
{ "id": "e1", "from": "n1", "branch": "Yes", "to": "n2", "wait": { "amount": "24", "unit": "hours" } }
```
`key` ∈ trigger/action/condition/flow node types; `cfg` is free-form per node (stored as JSON).

### 1.2 Settings shape (journey-level)
```jsonc
{ "start":"2026-08-06T10:00", "end":"Never ending", "endDate":"", "tags":["icat"],
  "goal":true, "goalEvent":"exam_started", "goalWindow":"48",
  "control":true, "controlMode":"Percentage", "controlPct":15, "controlList":"…",
  "dnd":true, "dndDays":[1,0,1,1,1,1,0], "dndTimes":[{"f":"21:00","t":"09:30"}, …7],
  "cap":true, "capN":2 }
```

---

## 2. REST endpoints

Base: `/api/journeys`. All responses `{ "success": true, "data": … }` or `{ "success": false, "error": "…" }`.
Auth: same JWT/session as the rest of the panel (`Authorization` / cookie).

| Method | Path | Body | Returns | Replaces store fn |
|---|---|---|---|---|
| GET  | `/api/journeys?status=&q=&tag=&page=&sort=` | — | `{ rows:[journey…], total }` | `listJourneys` |
| GET  | `/api/journeys/:id` | — | `journey` (with graph+settings+versions) | `getJourney` |
| POST | `/api/journeys` | `{ name, tags, startAt, endType, endAt, settings?, graph? }` | created `journey` | `createJourney` |
| PUT  | `/api/journeys/:id` | partial `journey` patch | updated `journey` | `updateJourney` |
| PUT  | `/api/journeys/:id/graph` | `{ nodes, edges, settings, name, status }` | updated `journey` | `saveGraph` |
| POST | `/api/journeys/:id/status` | `{ status }` | updated `journey` | `setStatus` |
| POST | `/api/journeys/:id/duplicate` | — | new draft `journey` | `duplicateJourney` |
| DELETE | `/api/journeys/:id` | — | `{ ok:true }` | `removeJourney` |
| POST | `/api/journeys/:id/versions` | `{ name, status, nodes, edges, settings }` | created `version` | `addVersion` |
| GET  | `/api/journeys/:id/versions` | — | `[version…]` | `listVersions` |

**Validate-before-deploy** (server mirrors the client validator in `problems()`): the
`POST /status` transition to `ongoing`/`scheduled` must re-run validation server-side and
reject with `{ success:false, error, problems:[…] }` if any hard rule fails (no trigger,
unconnected branch, split ≠ 100%, unreachable node, missing template/config, end<start).

Engine-facing endpoints (phase 2, from spec §5.6): `POST /api/events`,
`POST /api/business-events`, `POST /api/webhooks/:channel`,
`GET /api/journeys/:id/entries/:userId` (per-user trace),
`GET /api/journeys/:id/stats` (node/channel/variant rollups → replaces the report's
"from execution engine" placeholders).

---

## 3. MySQL 8 schema (CRUD + versioning slice)

```sql
CREATE TABLE journeys (
  id             BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name           VARCHAR(255) NOT NULL,
  status         ENUM('draft','scheduled','ongoing','paused','stopped','completed','archived') NOT NULL DEFAULT 'draft',
  tags           JSON NULL,                     -- ["offcampusly","icat"]
  start_at       DATETIME NULL,
  end_type       ENUM('never','date') NOT NULL DEFAULT 'never',
  end_at         DATETIME NULL,
  graph          JSON NOT NULL,                 -- { nodes:{}, edges:{} }
  settings       JSON NULL,
  conv_goal      TINYINT(1) NOT NULL DEFAULT 0,
  rev_goal       TINYINT(1) NOT NULL DEFAULT 0,
  goal_locked_at DATETIME NULL,                 -- goal immutable once deployed (spec §3.4)
  -- denormalised rollups the list/report read (kept fresh by the stats job, spec §5.7)
  sent           BIGINT UNSIGNED NOT NULL DEFAULT 0,
  delivered      BIGINT UNSIGNED NOT NULL DEFAULT 0,
  opened         BIGINT UNSIGNED NOT NULL DEFAULT 0,
  clicked        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  conversions    BIGINT UNSIGNED NOT NULL DEFAULT 0,
  revenue        DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_by     BIGINT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deployed_at    DATETIME NULL,
  INDEX idx_status (status),
  INDEX idx_updated (updated_at)
);

CREATE TABLE journey_versions (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  journey_id  BIGINT UNSIGNED NOT NULL,
  version_no  INT UNSIGNED NOT NULL,
  name        VARCHAR(255) NULL,
  status      VARCHAR(32) NULL,
  graph       JSON NOT NULL,                    -- { nodes, edges } snapshot
  settings    JSON NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_journey_version (journey_id, version_no),
  CONSTRAINT fk_ver_journey FOREIGN KEY (journey_id) REFERENCES journeys(id) ON DELETE CASCADE
);
```

`dates`/`edited` are display strings the frontend computes — the server can drop them and
let the client format from `start_at`/`end_type`/`end_at`/`updated_at`, or return them
precomputed for parity. `versions` embeds `nodes`/`edges` inline (matches `addVersion`);
normalize later only if version volume demands it.

**Execution-engine tables** (phase 2 — implement exactly as spec §5.2): `journey_entry`,
`journey_step`, `journey_wait` (the scheduler work queue), `journey_split_assignment`
(sticky variants), `journey_node_stat` (async rollups that feed `sent/opened/…` above).

---

## 4. Frontend swap plan (one file)

`journeyStore.js` exports are already API-shaped. To go live, replace each body with an
axios call to §2 (the app already uses `axios` — see `src/api/axios`), keeping the same
return shapes so **no component changes**:

```js
import api from '../../api/axios';
export const listJourneys  = (params)      => api.get('/api/journeys.php', { params }).then(r => r.data.data.rows);
export const getJourney     = (id)          => api.get(`/api/journeys.php?id=${id}`).then(r => r.data.data);
export const createJourney  = (details)     => api.post('/api/journeys.php', details).then(r => r.data.data);
export const updateJourney  = (id, patch)   => api.put(`/api/journeys.php?id=${id}`, patch).then(r => r.data.data);
export const saveGraph      = (id, payload) => api.put(`/api/journeys.php?id=${id}&graph=1`, payload).then(r => r.data.data);
export const setStatus      = (id, status)  => api.post(`/api/journeys.php?id=${id}&status=1`, { status }).then(r => r.data.data);
export const duplicateJourney = (id)        => api.post(`/api/journeys.php?id=${id}&duplicate=1`).then(r => r.data.data);
export const removeJourney  = (id)          => api.delete(`/api/journeys.php?id=${id}`).then(() => true);
export const addVersion     = (id, payload) => api.post(`/api/journeys.php?id=${id}&version=1`, payload).then(r => r.data.data);
export const listVersions   = (id)          => api.get(`/api/journeys.php?id=${id}&versions=1`).then(r => r.data.data);
```

One caveat: the current store is synchronous; the HTTP versions are async. The list and
report already tolerate an async load (they call once and set state) — they'd move to
`useEffect(async …)`. The builder loads once on mount, so its `initBuilder` would `await
getJourney` before `initBuilder(root, { initial })`. These are the only call sites to make
async; the store's function names and return shapes stay identical.
```
