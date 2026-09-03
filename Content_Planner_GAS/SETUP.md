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
   ("NinaAgent Hub - Content Planner Data") with the `Content` and `Owners`
   tabs, and stores its ID in Script Properties automatically.
2. Select `setupReminderTrigger` → Run. This installs the 15-minute
   time-driven trigger that checks and sends reminders.

## 3. Set Script Properties

Project Settings → Script Properties → add:

| Key | Value |
|---|---|
| `NOTION_TOKEN` | Notion internal integration token (share the Owner database with this integration) |
| `NOTION_DATABASE_ID` | The Notion database ID that has the "Owner for Grouping" property |
| `LINE_CHANNEL_TOKEN` | Channel access token from the LINE Official Account (Messaging API) |
| `LINE_TARGET_ID` | The LINE group ID to push reminders into (see below) |

**Getting the LINE group ID:** add the bot to the team's LINE group, then
temporarily log the `source.groupId` from an incoming webhook event (or use
the LINE Official Account Manager's group chat details) — copy that ID here.

## 4. Sync owners once

Run `syncOwnersFromNotion` manually the first time to confirm it pulls the
right names. After that, add a daily time-driven trigger for it if the
Notion list changes often (Triggers → Add Trigger → `syncOwnersFromNotion` →
Time-driven → Day timer).

## 5. Deploy as Web App

Deploy → New deployment → type: Web app → Execute as: Me → Who has access:
Anyone. Copy the resulting `/exec` URL.

## 6. Point the frontend at it

In `content-planner.html`, the mock `items` array and local-only save logic
need to be replaced with `fetch()` calls to this Web App URL
(`?action=list` to read, POST `{action:'create'|'update'|...}` to write).
This wiring is the next piece of work — not done yet in this commit.

## Notes

- The reminder rules (3 days / 1 day / 24h / 1h / overdue every 2h) live in
  `checkReminders()`. Each rule has a `Sent_*` column per row so it never
  fires twice for the same item.
- Two-way LINE replies (buttons to mark "Ready" or "Posted") are intentionally
  **not** built here — that's the Make.com scenario, scoped separately, which
  writes directly to the same `Content` sheet via its own Google Sheets
  connector.
