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
2. Select `setupReminderTrigger` → Run. This installs the daily 8:15
   (Asia/Bangkok) trigger that sends the LINE reminders — see Notes below.

## 3. Set Script Properties

Project Settings → Script Properties → add:

| Key | Value |
|---|---|
| `NOTION_TOKEN` | Notion internal integration token (share the Owner database with this integration) |
| `NOTION_DATABASE_ID` | `2e69dccd-181d-81df-8919-fbacf921c7d5` (the "Tasks" database, confirmed to have "Owner for Grouping") |
| `NOTION_BRAND_DATABASE_ID` | `2eb9dccd-181d-808f-b888-cdf883503df6` (the "Brand" database — same integration needs Connections access here too) |
| `NOTION_TEAM_DATABASE_ID` | `092e35e9-9742-4e4a-9b20-d7df03c31dc6` (the "GEM Team Member" database — same integration needs Connections access here too; used for PM guest-invite emails, see step 7) |
| `LINE_CHANNEL_TOKEN` | Channel access token from the LINE Official Account (Messaging API) |
| `LINE_TARGET_ID` | Who to push reminders to — see below |
| `GEMINI_API_KEY` | For the "import from calendar image" feature — can reuse the same key as `Social_Media_Assistant_GAS` if you already have one |

**`LINE_TARGET_ID` accepts one ID or several, comma-separated** — each one
gets its own individual push (e.g. `userIdA,userIdB` sends the same
reminder twice, once per person). Useful early on, before a shared group
chat exists: point it at each person's own LINE user ID directly. Once
there's a real team group, switch to a single group ID instead.

**Getting a personal LINE user ID:** have that person message the bot (or
add it as a friend) once, then log `source.userId` from the resulting
webhook event.

**Getting the LINE group ID:** add the bot to the team's LINE group, then
temporarily log the `source.groupId` from an incoming webhook event (or use
the LINE Official Account Manager's group chat details) — copy that ID here.

## 4. Sync owners, brands, and PM emails once

Run `syncOwnersFromNotion` and `syncBrandsFromNotion` manually the first
time to confirm each pulls the right names (`syncBrandsFromNotion` only
pulls brands where "Active = Yes" is checked). Also run
`syncOwnerEmailsFromNotion` (see step 7 for what it does). After that, add a
daily time-driven trigger for each if the Notion data changes often
(Triggers → Add Trigger → pick the function → Time-driven → Day timer).

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

Each PM subscribes once (for anyone NOT in `OWNER_EMAIL_MAP` below — see
guest-invite instead for the PMs who are):
1. Ask the owner account (`nina.digital2@gmail.com`) to share the calendar:
   Google Calendar → find "NinaAgent Hub - Content Planner" under "My
   calendars" → ⋮ → Settings and sharing → "Share with specific people" →
   add each PM's Google account (View permission is enough).
2. Each PM: open the invite email → Add to my calendar. Or, once shared,
   search for the calendar under "Other calendars" → "+" → Subscribe.

**Guest-invite (real email reminders) for specific PMs** — every content
item's calendar event can add its Owner as a real guest, so Google Calendar
sends them an actual invite + reminder email, no subscribing needed. This
has two parts:

1. `OWNER_TAG_TO_NICKNAME` in `Code.gs` maps an Owner value (exactly as it
   appears from Notion's **"Owner for Grouping"** formula in the Tasks
   database, e.g. `"PM - ยู้"`) to that person's **ชื่อเล่น (nickname)** in
   the "GEM Team Member" database. This correspondence is human-authored —
   "Owner for Grouping" values are freely typed tags, not linked to a
   person record — so a brand-new tag needs one line added here. Existing
   entries essentially never need to change.
2. Run **`syncOwnerEmailsFromNotion`** (same caching pattern as
   `syncOwnersFromNotion`/`syncBrandsFromNotion`, writing to the
   `OwnerEmails` tab) to pull each mapped nickname's current email from
   "GEM Team Member" — only nicknames whose Role includes PM and who are
   Active come through, so deactivating someone there automatically stops
   them being invited on the next sync, with no code change. Add this to
   the same daily trigger as step 4's other syncs if the team changes
   often.

`syncCalendarEvent` reads the `OwnerEmails` tab on every create/update,
adding the matching guest if there is one and removing a previously-added
one if the item gets reassigned to someone else/unmapped.

**Important:** a PM handled this way should NOT also subscribe to the
shared calendar above — being both a guest on an event and a subscriber to
the calendar it lives on can show that event twice on their calendar.

**Do NOT try to fix this at the source by editing the "Owner for Grouping"
formula (or "Work By") in Notion** — this looks tempting ("just make it
pull from GEM Team Member directly") but it's genuinely risky: at least 10
saved views in the Tasks database filter on an exact string match against
"Owner for Grouping" (e.g. "🔔 ต้องเริ่มเตรียมงาน (อ้อ)", "💰 งานที่ยังไม่วางบิล
(ยู้)", "📥 Inbox — งานไม่มี Due Date (อ้อ)") — changing the formula's output
format breaks all of them silently, and other tools/Make.com scenarios
touching the same field may depend on the current text too, invisibly to
whoever makes the change. The real correct fix — turning "Work By" from a
free-typed multi-select into an actual relation to GEM Team Member — is a
schema migration across a shared, heavily-used database and deserves its
own careful, dedicated project (audit every dependent view/automation
first), not a quick edit made in passing. `OWNER_TAG_TO_NICKNAME` above is
deliberately read-only against Notion's current setup so it can't break
any of that.

## Notes

- Reminders now run on two triggers, both installed by `setupReminderTrigger`:
  - `sendDailyReminders` — once a day at **8:15 (Asia/Bangkok)**. Every run
    re-scans three date buckets fresh (due in 2 days / due tomorrow — both
    only if not yet Ready/Approved — / due today regardless of status), so
    it doesn't matter when an item was created or rescheduled: whichever
    bucket it lands in next gets checked the very next morning. Each bucket
    that has items becomes **one LINE Flex ("carousel") message** bundling
    all of them as separate cards, instead of one push per item — up to
    3 messages a day, never more per item than one per bucket.
  - `checkReminders` (🚨 overdue-every-2h nag) exists in the code but its
    trigger is **not installed** — turned off on purpose, since there's no
    LINE button for a PM to say "posted", so a repeating overdue ping nobody
    can dismiss would just be noise. Re-enable by uncommenting the trigger
    line in `setupReminderTrigger()` if a Make.com "mark as posted" flow
    gets built later.
  - Items with status **Scheduled** are skipped by `sendDailyReminders` —
    use that status for anything already queued in another tool (e.g. Meta
    Business Suite) so it doesn't get nagged about here.
  - Each rule has a `Sent_*` column per row so it never fires twice for the
    same item.
- Two-way LINE replies (buttons to mark "Ready" or "Posted") are intentionally
  **not** built here — that's the Make.com scenario, scoped separately, which
  writes directly to the same `Content` sheet via its own Google Sheets
  connector.
- `Sent_24h` / `Sent_1h` are retired and no longer used — kept as columns,
  not deleted (removing them would shift every column after them out of
  alignment with existing data). Re-run `setupSheets` and their headers will
  relabel to "(ไม่ใช้แล้ว)" so it's clear in the sheet they're dead; safe to
  ignore otherwise. `Sent_Prep1d` was retired the same way at first but is
  back in active use for the "due tomorrow" bucket above.
- If you already had this backend deployed before this update, just re-paste
  `Code.gs`, run `setupSheets` once more (adds the `Sent_DayOf` column and
  relabels the retired ones above, without touching existing data), and run
  **`setupReminderTrigger`** again too — it replaces the old 15-minute
  `checkReminders` trigger with the new daily 8:15 `sendDailyReminders` one
  (not installed alongside it — the 15-minute trigger is removed, per the
  overdue-nag being turned off above). The next Deploy → Manage deployments
  → New version may prompt you to re-authorize.
