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
   **"Weekly Update Draft"**, **"Weekly Draft Revisions"**, and
   **"GEM Team Member"** (all owned by other projects, but the "PM Review"
   tab needs read/write access to all four).

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
| `NOTION_CLIENT_ID` | `2eb9dccd-181d-80b8-a31a-dbcc54726ad0` (STAEDTLER's page id in the Client database) — leave this property unset to return every client's rows once the dashboard needs to support more than one |
| `NOTION_CLIENT_NAME` | `STAEDTLER` — display label only, shown in the dashboard's top bar so viewers always know whose data they're looking at. Keep this in sync with `NOTION_CLIENT_ID` above; leave both unset together |
| `NOTION_DRAFT_DATASOURCE_ID` | `4a331637-29c3-41cb-b96f-d0b4628eca36` (the "Weekly Update Draft" data source, owned by the Agency Command Center's own Make scenario) — powers the "PM Review" tab. Leave unset to hide that tab's data (it'll show "โหลด draft ไม่สำเร็จ") |
| `NOTION_REVISIONS_DATASOURCE_ID` | `87ace625-3e0b-4af2-8e97-086269db9e09` (the "Weekly Draft Revisions" data source) — immutable, append-only log of every approved draft revision. The web app is the only writer; nothing else should ever write to it |
| `NOTION_TEAM_DATASOURCE_ID` | `f3f7a62c-966d-4391-9af2-237611d711db` (the "GEM Team Member" data source) — PM roster used to verify the "Web Approval Code" a PM enters before they can Save/Approve a draft |

## 4. Deploy as Web App

Deploy → New deployment → type: Web app → Execute as: Me → Who has access:
Anyone. Copy the resulting `/exec` URL.

## 5. Point the frontend at it

In `content-performance.html`, paste the `/exec` URL from step 4 into the
`API_URL` constant near the top of the `<script>` block. Leave it empty to
keep using local mock data only.

## Notes

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
  - `approveDraft` composes the final client-facing text (`Draft Text`
    with any NaN/blank-artifact lines hidden, plus the PM's shareable
    sections — `PM Working Notes` is deliberately excluded, it's internal
    only), then creates one **immutable** row in "Weekly Draft Revisions"
    and sets `LINE Requested Revision`/`LINE Delivery Status=Pending` on
    the Draft. `LockService` serializes concurrent approvals so two
    requests can never mint the same revision number. A duplicate
    approve with unchanged content returns the existing revision instead
    of creating a new one; approving while a request is still
    Pending/Sending/Uncertain is blocked until it resolves.
  - Make (scenario 7457016) is expected to poll `LINE Requested Revision`,
    send exactly the `Approved Text` + `LINE Recipient ID Snapshot` from
    that revision row, and update `LINE Delivery Status`/`LINE Sent
    Revision`/`LINE Sent At`/`LINE Delivery Error` on the Draft — the web
    app never writes those 4 fields.
- The "ข้อเสนอเดือนถัดไป" box on the ทีมคอนเทนต์ tab still only saves to
  `localStorage` (not synced across viewers) — that's a separate, smaller
  gap from the PM Review tab above and hasn't been wired up yet.
- `queryDataSource_` paginates up to 5 pages (500 rows) for content and 3
  pages (300 rows) for ads — plenty for a few months of weekly data. Raise
  the `maxPages` argument in `Code.gs` if the dashboard ever needs a longer
  history and requests start coming back truncated.
- Adding a second client later: drop the `NOTION_CLIENT_ID` script property
  filter (or extend `listContentPerformance`/`listMetaAds` to accept a
  `?client=` query param and filter per request) once there's a second
  client's data actually in these databases to separate out.
