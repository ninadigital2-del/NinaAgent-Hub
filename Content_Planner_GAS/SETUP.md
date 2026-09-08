# Content Planner — Backend Setup (Phase 2)

Google Apps Script backend for the Content Planner. Do these steps from the
`nina.digital2@gmail.com` account (the agreed owner account).

## 1. Create the Apps Script project

1. Go to https://script.google.com → New project.
2. Rename it "NinaAgent Hub - Content Planner".
3. Delete the default `Code.gs` content, paste in this folder's `Code.gs`.
4. Open Project Settings → paste this folder's `appsscript.json` content into
   the manifest (enable "Show appsscript.json" first).

## 2. Run the one-time setup

1. In the Apps Script editor, select the `setupSheets` function → Run.
   Grant the permissions it asks for. This creates a new Google Sheet
   ("NinaAgent Hub - Content Planner Data") with the `Content`, `Owners`,
   and `Brands` tabs, and stores its ID in Script Properties automatically.
2. Select `setupReminderTrigger` → Run. This installs the 15-minute
   time-driven trigger that checks and sends reminders.

## 3. Set Script Properties

Project Settings → Script Properties → add:

| Key | Value |
|---|---|
| `NOTION_TOKEN` | Notion internal integration token (share the Owner database with this integration) |
| `NOTION_DATABASE_ID` | `2e69dccd-181d-81df-8919-fbacf921c7d5` (the "Tasks" database, confirmed to have "Owner for Grouping") |
| `NOTION_BRAND_DATABASE_ID` | `2eb9dccd-181d-808f-b888-cdf883503df6` (the "Brand" database — same integration needs Connections access here too) |
| `LINE_CHANNEL_TOKEN` | Channel access token from the LINE Official Account (Messaging API) |
| `LINE_TARGET_ID` | The LINE group ID to push reminders into (see below) |
| `GEMINI_API_KEY` | For the "import from calendar image" feature — can reuse the same key as `Social_Media_Assistant_GAS` if you already have one |

**Getting the LINE group ID:** add the bot to the team's LINE group, then
temporarily log the `source.groupId` from an incoming webhook event (or use
the LINE Official Account Manager's group chat details) — copy that ID here.

## 4. Sync owners and brands once

Run `syncOwnersFromNotion` and `syncBrandsFromNotion` manually the first
time to confirm each pulls the right names (`syncBrandsFromNotion` only
pulls brands where "Active = Yes" is checked). After that, add a daily
time-driven trigger for each if the Notion lists change often (Triggers →
Add Trigger → pick the function → Time-driven → Day timer).

## 5. Deploy as Web App

Deploy → New deployment → type: Web app → Execute as: Me → Who has access:
Anyone. Copy the resulting `/exec` URL.

## 6. Point the frontend at it

In `content-planner.html`, paste the `/exec` URL from step 5 into the
`API_URL` constant near the top of the `<script>` block. Leave it empty to
keep using local mock data only (Phase 1 behavior).

## 7. Subscribe to the shared content calendar

The first time any content item is created or updated, the backend
auto-creates a Google Calendar named **"NinaAgent Hub - Content Planner"**
under the owner account and stores its ID in Script Properties
(`CALENDAR_ID`) — no manual setup needed to create it. Every content item
gets one event on it (30-minute block at the scheduled post time), kept in
sync on edits and removed if the item is Cancelled.

Sync only runs inside create/update — items that already existed before this
feature was deployed won't get an event until touched again. Run
**`backfillCalendarEvents`** once (Apps Script editor → select it → Run) to
create events for all existing rows in one pass; safe to re-run any time,
it skips rows that already have a working event. If the calendar was
already created before the Thai description text was added, run
**`setCalendarDescription`** once too to apply it retroactively.

Each PM subscribes once:
1. Ask the owner account (`nina.digital2@gmail.com`) to share the calendar:
   Google Calendar → find "NinaAgent Hub - Content Planner" under "My
   calendars" → ⋮ → Settings and sharing → "Share with specific people" →
   add each PM's Google account (View permission is enough).
2. Each PM: open the invite email → Add to my calendar. Or, once shared,
   search for the calendar under "Other calendars" → "+" → Subscribe.

This is a **shared team calendar**, not each PM's personal calendar — it
avoids needing every PM's email mapped to a name in the system. If you'd
rather push events directly into each PM's own personal calendar instead,
that needs a name→email mapping and is a separate change — ask if you want
that instead.

## Notes

- Reminders now run on two triggers, both installed by `setupReminderTrigger`:
  - `sendDailyReminders` — once a day at **8:15 (Asia/Bangkok)**. Sends up to
    two LINE **Flex ("carousel") messages**: one bundling every item due in
    2 days that isn't Ready/Approved yet, one bundling every item due *today*
    (regardless of status). All items due the same day go in **one** message
    as separate cards, not one push per item.
  - `checkReminders` — every 15 minutes, only for the 🚨 overdue safety-net
    message (resent every 2 hours per item until it's no longer overdue).
  - Items with status **Scheduled** are skipped by both triggers entirely —
    use that status for anything already queued in another tool (e.g. Meta
    Business Suite) so it doesn't get nagged about here.
  - Each rule has a `Sent_*` column per row so it never fires twice for the
    same item.
- Two-way LINE replies (buttons to mark "Ready" or "Posted") are intentionally
  **not** built here — that's the Make.com scenario, scoped separately, which
  writes directly to the same `Content` sheet via its own Google Sheets
  connector.
- If you already had this backend deployed before this update, just re-paste
  `Code.gs`, run `setupSheets` once more (adds the `Sent_DayOf` column
  without touching existing data), and run **`setupReminderTrigger`** again
  too — it now installs the new daily 8:15 trigger alongside the existing
  15-minute one (old `checkReminders`-only trigger is replaced, not
  duplicated). The next Deploy → Manage deployments → New version may prompt
  you to re-authorize.
