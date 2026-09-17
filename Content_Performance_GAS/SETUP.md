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
   Connections → add this integration. Repeat for the **"Meta Ads"**
   database.

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

## 4. Deploy as Web App

Deploy → New deployment → type: Web app → Execute as: Me → Who has access:
Anyone. Copy the resulting `/exec` URL.

## 5. Point the frontend at it

In `content-performance.html`, paste the `/exec` URL from step 4 into the
`API_URL` constant near the top of the `<script>` block. Leave it empty to
keep using local mock data only.

## Notes

- This backend does not write anything back to Notion or Make — if the
  dashboard needs an "editable proposal notes" box synced across viewers
  later, that's a separate `doPost` action to add here, not something this
  read-only version does yet (today it just holds the text in the browser).
- `queryDataSource_` paginates up to 5 pages (500 rows) for content and 3
  pages (300 rows) for ads — plenty for a few months of weekly data. Raise
  the `maxPages` argument in `Code.gs` if the dashboard ever needs a longer
  history and requests start coming back truncated.
- Adding a second client later: drop the `NOTION_CLIENT_ID` script property
  filter (or extend `listContentPerformance`/`listMetaAds` to accept a
  `?client=` query param and filter per request) once there's a second
  client's data actually in these databases to separate out.
