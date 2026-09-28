# Content Performance Dashboard — Backend Setup

Google Apps Script backend for `content-performance.html`. Read-only — it
never writes to Notion, it just queries the two databases that
`PILOT — STD — Fetch Meta v1` (Make.com) already keeps updated every
Tuesday morning, and hands the rows to the dashboard as JSON.

Do these steps from the `nina.digital2@gmail.com` account (the agreed owner
account), same as the other GAS backends in this repo.

## 1. Create a Notion integration (if you don't have one already)

1. Go to https://www.notion.so/my-integrations → New integration.
2. Name it "NinaAgent Content Dashboard", workspace = the one with
   "Content Performance" and "Meta Ads".
3. Copy the "Internal Integration Secret" — this is `NOTION_TOKEN` below.
4. Open the **"Content Performance"** database in Notion → "..." menu →
   Connections → add this integration. Repeat for **"Meta Ads"**,
   **"Weekly Update Draft"**, **"Weekly Draft Revisions"**,
   **"GEM Team Member"**, and **"Client Connection Config"** (all owned by
   other projects, but the "PM Review" tab needs read/write access to all
   five — the last one is read-only, used to look up each brand's LINE
   recipient at Approve time).

(If a token already exists for this workspace — e.g. the one
`Content_Planner_GAS` uses — you can reuse it instead of creating a new
one, as long as it's been connected to both databases above.)

## 2. Create the Apps Script project

1. Go to https://script.google.com → New project.
2. Rename it "NinaAgent Hub - Content Performance".
3. Delete the default `Code.gs` content, paste in this folder's `Code.gs`.
4. Open Project Settings → paste this folder's `appsscript.json` content
   into the manifest (enable "Show appsscript.json" first).

## 3. Set Script Properties

Project Settings → Script Properties → add:

| Key | Value |
|---|---|
| `NOTION_TOKEN` | The integration secret from step 1 |
| `NOTION_CONTENT_DATASOURCE_ID` | `d5344e81-08a7-4230-8816-a0b060dfed86` (the "Content Performance" data source) |
| `NOTION_ADS_DATASOURCE_ID` | `1c98fd4d-d669-4575-bb2c-102cf58cf3e5` (the "Meta Ads" data source) |
| `NOTION_CLIENT_ID` | `2eb9dccd-181d-80b8-a31a-dbcc54726ad0` (STAEDTLER's page id in the Brand database) — now only a **fallback default** used when a request doesn't pass `?client=`. The dashboard itself always sends `?client=<brandId>` once the client switcher loads, so this mostly matters for direct API testing. Leave unset to default to no client filter |
| `NOTION_CLIENT_NAME` | `STAEDTLER` — display label used only as a fallback if a live Brand-name lookup fails. Keep in sync with `NOTION_CLIENT_ID` above |
| `NOTION_DRAFT_DATASOURCE_ID` | `4a331637-29c3-41cb-b96f-d0b4628eca36` (the "Weekly Update Draft" data source, owned by the Agency Command Center's own Make scenario) — powers the "PM Review" tab. Leave unset to hide that tab's data (it'll show "โหลด draft ไม่สำเร็จ") |
| `NOTION_REVISIONS_DATASOURCE_ID` | `87ace625-3e0b-4af2-8e97-086269db9e09` (the "Weekly Draft Revisions" data source) — immutable, append-only log of every approved draft revision. The web app is the only writer; nothing else should ever write to it |
| `NOTION_TEAM_DATASOURCE_ID` | `f3f7a62c-966d-4391-9af2-237611d711db` (the "GEM Team Member" data source) — PM roster used to verify the "Web Approval Code" a PM enters before they can Save/Approve a draft |
| `NOTION_CLIENT_CONFIG_DATASOURCE_ID` | `a93926c2-4d18-415e-b622-cddfbc1b7c1b` (the "Client Connection Config" data source) — holds `PM LINE Recipient ID` per brand, used only at Approve time to snapshot the recipient onto the new revision row. Leave unset to fall back to an empty snapshot (Make's send gate will keep blocking, not misfire) |

## 4. Deploy as Web App

Deploy → New deployment → type: Web app → Execute as: Me → Who has access:
Anyone. Copy the resulting `/exec` URL.

## 5. Point the frontend at it

In `content-performance.html`, paste the `/exec` URL from step 4 into the
`API_URL` constant near the top of the `<script>` block. Leave it empty to
keep using local mock data only.

## Notes

- **Multi-client:** `action=data` and `action=drafts` both accept an
  optional `?client=<brandId>` query param, and every PM Review write
  (`saveDraft`/`previewDraft`/`approveDraft`) accepts an optional
  `clientId` in its POST body — the frontend's client switcher sends both
  automatically. `action=clients` lists every brand whose "Client
  Connection Config" row has `Weekly Report Enabled` ticked (cached 10
  minutes via `CLIENT_LIST_CACHE_TTL_SECONDS`), which is what populates
  that switcher — a brand shows up there the moment Codex's pipeline turns
  Weekly Report on for it, no code change needed on our side. Without
  `NOTION_CLIENT_CONFIG_DATASOURCE_ID` set, `action=clients` falls back to
  the single `NOTION_CLIENT_ID`/`NOTION_CLIENT_NAME` pair, so a
  single-tenant deployment still works unchanged.
- The backend is otherwise read-only. The "PM Review" tab's three write
  actions (`pmLogin`, `saveDraft`, `approveDraft`) are the only writes:
  - `pmLogin` trades a PM's "Web Approval Code" (set per-person on their
    "GEM Team Member" row) for a short-lived session token, cached
    server-side via `CacheService` (4h TTL). Every subsequent call
    re-checks that member's `Active`/`Role` live, so revoking access takes
    effect on their very next action, not just when the token expires.
  - `saveDraft` writes only the PM-authored working fields (`Optimization
    Notes`, `Next Week Plan`, `Next Week Focus`, `Ask from Client`, `PM
    Working Notes`, `Numeric Accuracy Verified`) directly onto the Weekly
    Update Draft row — never `Draft Text`/`Status`/`Final Text`, which
    belong to the Agency Command Center's own Make scenario.
  - `approveDraft` first checks 3 hard gates and **blocks outright** (no
    silent workaround) if any fails: `Data Status = Error`, `Numeric
    Accuracy Verified` unchecked, or the raw `Draft Text` contains
    NaN/Infinity. NaN is a real upstream computation error, not cosmetic
    noise — it's never hidden-and-approved, only blocked, so a PM can't
    accidentally lock in a broken number. Once past the gates, it
    composes the final client-facing text (`Draft Text` plus the PM's
    shareable sections — `PM Working Notes` is deliberately excluded,
    it's internal only), then creates one **immutable** row in "Weekly
    Draft Revisions" and sets `LINE Requested Revision`/`LINE Delivery
    Status=Pending` on the Draft. `LockService` serializes concurrent
    approvals so two requests can never mint the same revision number.
    A re-approve with content identical to the latest revision reuses it
    instead of minting a new one — this also self-heals a partial write
    (revision row created but the Draft's pointer fields never got
    patched, e.g. a network failure mid-request) by republishing the
    pointer at the existing revision rather than creating an orphan.
    It never resets a `Sending`/`Uncertain`/`Sent` status — those stay
    Make's to transition. Approving while a *different* pending request
    is outstanding is blocked until it resolves.
    The `LINE Recipient ID Snapshot` written onto each revision comes from
    a live lookup against "Client Connection Config" (filtered by that
    row's `Client` relation containing the Draft's brand) at the moment of
    Approve, never from the Brand page itself (which has no such property).
  - Make (scenario 7457016) is expected to poll `LINE Requested Revision`,
    send exactly the `Approved Text` + `LINE Recipient ID Snapshot` from
    that revision row, and update `LINE Delivery Status`/`LINE Sent
    Revision`/`LINE Sent At`/`LINE Delivery Error` on the Draft — the web
    app never writes those 4 fields.
- **Performance:** `action=data` (Content Performance + Meta Ads) is capped
  to the last `CONTENT_WINDOW_DAYS` (90) by `Publish Date`/`Week Start`, and
  the whole response is cached server-side for `DATA_CACHE_TTL_SECONDS`
  (180s) via `CacheService`. Both live as constants near the top of
  `Code.gs` — raise the window if the dashboard ever needs to show older
  history. Neither applies to `action=drafts` or any PM Review write
  (`pmLogin`/`saveDraft`/`approveDraft`), which always hit Notion live so a
  PM sees their own edits immediately.
- The "ข้อเสนอเดือนถัดไป" box on the ทีมคอนเทนต์ tab still only saves to
  `localStorage` (not synced across viewers) — that's a separate, smaller
  gap from the PM Review tab above and hasn't been wired up yet.
- `queryDataSource_` paginates up to 5 pages (500 rows) for content and 3
  pages (300 rows) for ads — plenty for a few months of weekly data. Raise
  the `maxPages` argument in `Code.gs` if the dashboard ever needs a longer
  history and requests start coming back truncated.
- A brand only appears in the client switcher once its "Client Connection
  Config" row has `Weekly Report Enabled` ticked — a client mid-pilot with
  that flag still off (or no config row at all) stays invisible here even
  if its rows already exist in Content Performance/Meta Ads/Weekly Update
  Draft, which is deliberate: don't show a client's data on this dashboard
  before their pipeline is actually considered pilot-ready.
