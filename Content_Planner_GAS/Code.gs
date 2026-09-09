/**
 * Content Planner — Google Apps Script backend (Phase 2)
 *
 * Data model matches content-planner.html's mock item shape. One row per
 * content item in the "Content" sheet tab. Reminder rules are tracked per
 * row with "Sent_*" flag columns so a rule never fires twice for the same item.
 *
 * Deploy steps: see SETUP.md in this folder.
 */

const SHEET_CONTENT = 'Content';
const SHEET_OWNERS = 'Owners';
const SHEET_BRANDS = 'Brands';
const SHEET_OWNER_EMAILS = 'OwnerEmails';

const COLUMNS = [
  'ID', 'Brand', 'Campaign', 'Title', 'Note',
  'Platforms',        // comma-separated: Facebook,Instagram,TikTok,LINE,YouTube
  'Captions',         // JSON string, keyed by platform
  'MediaUrl',
  'ScheduledAt',       // ISO datetime
  'Owner', 'Reviewer',
  'Status',            // Draft|Review|Revision|Approved|Ready|Scheduled|Posted|Cancelled
  'PublishedUrls',     // JSON string, keyed by platform
  'Comments',          // JSON array
  'CreatedAt', 'UpdatedAt',
  // Sent_24h/Sent_1h are retired (dropped when the reminder ladder was
  // simplified) but kept as columns — renaming or deleting them would shift
  // every column after them out of alignment with existing sheet data — so
  // they're relabeled "(ไม่ใช้แล้ว)" instead. Sent_Prep1d was retired the same
  // way but is back in active use (see sendDailyReminders' "due tomorrow"
  // bucket) — reusing the dormant column instead of adding a new one.
  'Sent_Prep2d', 'Sent_Prep1d', 'Sent_24h (ไม่ใช้แล้ว)', 'Sent_1h (ไม่ใช้แล้ว)', 'Sent_OverdueAt',
  'CalendarEventId', // event on the shared "Content Planner" Google Calendar
  'Sent_DayOf', // dedup flag for the day-of-post morning reminder
];

// ---------- Sheet setup ----------
function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* fall through and recreate */ }
  }
  const ss = SpreadsheetApp.create('NinaAgent Hub - Content Planner Data');
  props.setProperty('SHEET_ID', ss.getId());
  setupSheets(ss);
  return ss;
}

function setupSheets(ss) {
  ss = ss || getSpreadsheet();
  let content = ss.getSheetByName(SHEET_CONTENT);
  if (!content) content = ss.insertSheet(SHEET_CONTENT);
  if (content.getLastRow() === 0) {
    content.appendRow(COLUMNS);
    content.setFrozenRows(1);
    content.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold').setBackground('#f3f4f6');
  } else {
    // Migrate an already-deployed sheet: fix up renamed columns and append
    // any new ones so existing data keeps lining up with COLUMNS by index.
    const headerRange = content.getRange(1, 1, 1, COLUMNS.length);
    const header = content.getRange(1, 1, 1, Math.max(content.getLastColumn(), COLUMNS.length)).getValues()[0];
    let changed = false;
    COLUMNS.forEach((col, i) => { if (header[i] !== col) { header[i] = col; changed = true; } });
    if (changed) headerRange.setValues([header.slice(0, COLUMNS.length)]);
  }
  let owners = ss.getSheetByName(SHEET_OWNERS);
  if (!owners) owners = ss.insertSheet(SHEET_OWNERS);
  if (owners.getLastRow() === 0) {
    owners.appendRow(['Name', 'SyncedAt']);
    owners.setFrozenRows(1);
  }
  let brands = ss.getSheetByName(SHEET_BRANDS);
  if (!brands) brands = ss.insertSheet(SHEET_BRANDS);
  if (brands.getLastRow() === 0) {
    brands.appendRow(['Name', 'SyncedAt']);
    brands.setFrozenRows(1);
  }
  let ownerEmails = ss.getSheetByName(SHEET_OWNER_EMAILS);
  if (!ownerEmails) ownerEmails = ss.insertSheet(SHEET_OWNER_EMAILS);
  if (ownerEmails.getLastRow() === 0) {
    ownerEmails.appendRow(['Owner', 'Email', 'SyncedAt']);
    ownerEmails.setFrozenRows(1);
  }
}

// ---------- Web API ----------
function doGet(e) {
  const action = (e.parameter.action || 'list');
  try {
    if (action === 'list') return jsonResponse({ success: true, items: listContent() });
    if (action === 'owners') return jsonResponse({ success: true, owners: listOwners() });
    if (action === 'brands') return jsonResponse({ success: true, brands: listBrands() });
    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    if (action === 'create') return jsonResponse({ success: true, item: createContent(body.data) });
    if (action === 'update') return jsonResponse({ success: true, item: updateContent(body.id, body.data) });
    if (action === 'updateStatus') return jsonResponse({ success: true, item: updateContent(body.id, { Status: body.status }) });
    if (action === 'addComment') return jsonResponse({ success: true, item: addComment(body.id, body.author, body.text) });
    if (action === 'extractImage') return jsonResponse({ success: true, items: extractCalendarImage(body.imageBase64, body.mimeType) });
    if (action === 'bulkCreate') return jsonResponse({ success: true, items: (body.items || []).map(createContent) });
    if (action === 'delete') { deleteContent(body.id); return jsonResponse({ success: true }); }
    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- CRUD ----------
function getContentSheet() {
  setupSheets();
  return getSpreadsheet().getSheetByName(SHEET_CONTENT);
}

function rowToItem(row) {
  const item = {};
  COLUMNS.forEach((col, i) => { item[col] = row[i]; });
  item.Platforms = item.Platforms ? String(item.Platforms).split(',').filter(Boolean) : [];
  item.Captions = safeJsonParse(item.Captions, {});
  item.PublishedUrls = safeJsonParse(item.PublishedUrls, {});
  item.Comments = safeJsonParse(item.Comments, []);
  return item;
}
function safeJsonParse(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch (e) { return fallback; }
}

function listContent() {
  const sheet = getContentSheet();
  const values = sheet.getDataRange().getValues();
  values.shift(); // header
  return values.filter(r => r[0]).map(rowToItem);
}

function findRowIndexById(sheet, id) {
  const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // 1-indexed, +1 for header
  }
  return -1;
}

function createContent(data) {
  const sheet = getContentSheet();
  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  const row = COLUMNS.map(col => {
    if (col === 'ID') return id;
    if (col === 'CreatedAt' || col === 'UpdatedAt') return now;
    if (col === 'Platforms') return (data.Platforms || []).join(',');
    if (col === 'Captions') return JSON.stringify(data.Captions || {});
    if (col === 'PublishedUrls') return JSON.stringify({});
    if (col === 'Comments') return JSON.stringify([]);
    if (col === 'CalendarEventId') return '';
    if (col.indexOf('Sent_') === 0) return '';
    return data[col] || '';
  });
  sheet.appendRow(row);
  const item = rowToItem(row);
  syncCalendarEventSafely(sheet, findRowIndexById(sheet, id), item);
  return item;
}

function updateContent(id, data) {
  const sheet = getContentSheet();
  const rowIdx = findRowIndexById(sheet, id);
  if (rowIdx === -1) throw new Error('Content not found: ' + id);
  const range = sheet.getRange(rowIdx, 1, 1, COLUMNS.length);
  const current = range.getValues()[0];

  // Reschedule -> the reminder ladder must restart for the new date, otherwise
  // an item already reminded under its old date silently never gets reminded
  // again (Sent_Prep2d/Sent_DayOf are "sent once ever" flags, not per-date).
  if (data.ScheduledAt !== undefined) {
    const oldTime = new Date(current[COLUMNS.indexOf('ScheduledAt')]).getTime();
    const newTime = new Date(data.ScheduledAt).getTime();
    if (oldTime !== newTime) {
      ['Sent_Prep2d', 'Sent_Prep1d', 'Sent_OverdueAt', 'Sent_DayOf'].forEach(col => {
        current[COLUMNS.indexOf(col)] = '';
      });
    }
  }

  COLUMNS.forEach((col, i) => {
    if (col === 'ID' || col === 'CreatedAt' || col === 'CalendarEventId') return;
    if (col === 'UpdatedAt') { current[i] = new Date().toISOString(); return; }
    if (data[col] === undefined) return;
    if (col === 'Platforms') { current[i] = (data.Platforms || []).join(','); return; }
    if (col === 'Captions' || col === 'PublishedUrls' || col === 'Comments') {
      current[i] = JSON.stringify(data[col]); return;
    }
    current[i] = data[col];
  });
  range.setValues([current]);
  const item = rowToItem(current);
  syncCalendarEventSafely(sheet, rowIdx, item);
  return item;
}

function addComment(id, author, text) {
  const sheet = getContentSheet();
  const rowIdx = findRowIndexById(sheet, id);
  if (rowIdx === -1) throw new Error('Content not found: ' + id);
  const commentsColIdx = COLUMNS.indexOf('Comments') + 1;
  const cell = sheet.getRange(rowIdx, commentsColIdx);
  const comments = safeJsonParse(cell.getValue(), []);
  comments.push({ author, text, time: new Date().toISOString() });
  cell.setValue(JSON.stringify(comments));
  return rowToItem(sheet.getRange(rowIdx, 1, 1, COLUMNS.length).getValues()[0]);
}

function deleteContent(id) {
  const sheet = getContentSheet();
  const rowIdx = findRowIndexById(sheet, id);
  if (rowIdx === -1) throw new Error('Content not found: ' + id);
  const row = sheet.getRange(rowIdx, 1, 1, COLUMNS.length).getValues()[0];
  const item = rowToItem(row);
  deleteCalendarEvent(item.CalendarEventId);
  sheet.deleteRow(rowIdx);
}

// ---------- Owners / Brands (synced from Notion) ----------
function listOwners() {
  return listSyncedNames(SHEET_OWNERS);
}
function listBrands() {
  return listSyncedNames(SHEET_BRANDS);
}
function listSyncedNames(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  values.shift();
  return values.filter(r => r[0]).map(r => r[0]);
}

/**
 * Queries a Notion database (following pagination) and returns every
 * result page. `filter`, if given, is passed straight through as the
 * Notion API's query filter object.
 */
function queryNotionDatabase(dbId, token, filter) {
  const pages = [];
  let cursor = undefined;
  do {
    const payload = {};
    if (cursor) payload.start_cursor = cursor;
    if (filter) payload.filter = filter;
    const resp = UrlFetchApp.fetch('https://api.notion.com/v1/databases/' + dbId + '/query', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token, 'Notion-Version': '2022-06-28' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const json = JSON.parse(resp.getContentText());
    if (json.error) throw new Error('Notion API Error: ' + json.error.message);
    if (json.results) pages.push(...json.results);
    cursor = json.has_more ? json.next_cursor : undefined;
  } while (cursor);
  return pages;
}

function writeSyncedNames(sheetName, names) {
  setupSheets();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  sheet.clearContents();
  sheet.appendRow(['Name', 'SyncedAt']);
  const now = new Date().toISOString();
  [...names].sort().forEach(name => sheet.appendRow([name, now]));
}

/**
 * Pulls the "Owner for Grouping" property from the Notion Tasks database
 * and writes the distinct names into the Owners tab. Run manually or on a
 * daily time-driven trigger — this is a cache, not a live call, so the
 * Content Planner form stays fast and works even if Notion is down.
 *
 * Requires Script Properties: NOTION_TOKEN, NOTION_DATABASE_ID
 * Adjust PROPERTY_NAME below if the Notion property is renamed.
 */
function syncOwnersFromNotion() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('NOTION_TOKEN');
  const dbId = props.getProperty('NOTION_DATABASE_ID');
  const PROPERTY_NAME = 'Owner for Grouping';
  if (!token || !dbId) throw new Error('Set NOTION_TOKEN and NOTION_DATABASE_ID in Script Properties first.');

  const names = new Set();
  queryNotionDatabase(dbId, token).forEach(page => {
    const prop = page.properties[PROPERTY_NAME];
    if (!prop) return;
    const value = extractNotionText(prop);
    if (value) names.add(value);
  });
  writeSyncedNames(SHEET_OWNERS, names);
}

/**
 * Pulls brand names from the Notion "Brand" database (Name property,
 * filtered to Active = Yes) into the Brands tab, same caching pattern as
 * syncOwnersFromNotion.
 *
 * Requires Script Property: NOTION_BRAND_DATABASE_ID (separate from
 * NOTION_DATABASE_ID since Brand lives in its own database). Reuses
 * NOTION_TOKEN — the same integration must be connected to this database
 * too (Brand database → ••• → Connections).
 */
function syncBrandsFromNotion() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('NOTION_TOKEN');
  const dbId = props.getProperty('NOTION_BRAND_DATABASE_ID');
  if (!token || !dbId) throw new Error('Set NOTION_TOKEN and NOTION_BRAND_DATABASE_ID in Script Properties first.');

  const filter = { property: 'Active = Yes', checkbox: { equals: true } };
  const names = new Set();
  queryNotionDatabase(dbId, token, filter).forEach(page => {
    const prop = page.properties['Name'];
    if (!prop) return;
    const value = extractNotionText(prop);
    if (value) names.add(value);
  });
  writeSyncedNames(SHEET_BRANDS, names);
}

// "Owner for Grouping" values (e.g. "PM - ยู้") are literal, human-typed
// tags from the Tasks database's "Work By" field — they are NOT derived
// from any person record, so there's no data-driven way to detect who a
// brand-new tag refers to. This tiny table is the one thing a human must
// still set by hand (once per new tag, essentially never); everything that
// actually needs to stay fresh — email address, whether they're still
// active — is pulled live from Notion by nickname via syncOwnerEmailsFromNotion.
const OWNER_TAG_TO_NICKNAME = {
  'PM - ยู้': 'You',
  // 'PM - อ้อ': 'Aor', // currently inactive in GEM Team Member — left
  //                     commented out so she's never added as a guest;
  //                     uncomment if she becomes active again.
};

/**
 * Looks up each nickname in OWNER_TAG_TO_NICKNAME against the Notion "GEM
 * Team Member" database and writes the still-active ones' emails into the
 * OwnerEmails tab, keyed by their Owner tag. syncCalendarEvent reads this
 * to decide who to add as a guest on a content item's calendar event — run
 * this whenever a mapped person's email changes or they go active/inactive
 * (or on a daily trigger, same as syncOwnersFromNotion) so that part stays
 * current without editing code. Adding a person tagged with a brand-new
 * "Work By" text still needs one line added to OWNER_TAG_TO_NICKNAME above.
 *
 * Requires Script Property: NOTION_TEAM_DATABASE_ID. Reuses NOTION_TOKEN —
 * same integration must be connected to this database too.
 */
function syncOwnerEmailsFromNotion() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('NOTION_TOKEN');
  const dbId = props.getProperty('NOTION_TEAM_DATABASE_ID');
  if (!token || !dbId) throw new Error('Set NOTION_TOKEN and NOTION_TEAM_DATABASE_ID in Script Properties first.');

  const filter = {
    and: [
      { property: 'Role', multi_select: { contains: 'PM' } },
      { property: 'Active', checkbox: { equals: true } },
    ],
  };
  const emailByNickname = {};
  queryNotionDatabase(dbId, token, filter).forEach(page => {
    const nickname = extractNotionText(page.properties['ชื่อเล่น']);
    const email = extractNotionText(page.properties['Email']);
    if (nickname && email) emailByNickname[nickname] = email;
  });

  const rows = [];
  Object.keys(OWNER_TAG_TO_NICKNAME).forEach(tag => {
    const email = emailByNickname[OWNER_TAG_TO_NICKNAME[tag]];
    if (email) rows.push([tag, email]); // silently skipped if inactive/not found — no guest added for that tag
  });
  writeOwnerEmails(rows);
}

function writeOwnerEmails(rows) {
  setupSheets();
  const sheet = getSpreadsheet().getSheetByName(SHEET_OWNER_EMAILS);
  sheet.clearContents();
  sheet.appendRow(['Owner', 'Email', 'SyncedAt']);
  const now = new Date().toISOString();
  rows.sort((a, b) => a[0].localeCompare(b[0])).forEach(([owner, email]) => sheet.appendRow([owner, email, now]));
}

/**
 * Owner tags are typed by humans in Notion and copied by hand into
 * OWNER_TAG_TO_NICKNAME, so exact-string matching is fragile against
 * invisible differences (e.g. the underlying "Work By" tag is literally
 * "PM-ยู้" with no spaces, while "Owner for Grouping" formats it with
 * spaces as "PM - ยู้") — collapsing whitespace around the dash and
 * trimming makes the match survive that instead of silently failing.
 */
function normalizeOwnerTag(s) {
  return (s || '').trim().replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ');
}

/** Reads the OwnerEmails tab into a plain {Owner: Email} object for syncCalendarEvent, keyed by normalized tag. */
function getOwnerEmailMap() {
  const sheet = getSpreadsheet().getSheetByName(SHEET_OWNER_EMAILS);
  if (!sheet) return {};
  const values = sheet.getDataRange().getValues();
  values.shift();
  const map = {};
  values.forEach(row => { if (row[0] && row[1]) map[normalizeOwnerTag(row[0])] = row[1]; });
  return map;
}

function extractNotionText(prop) {
  if (prop.type === 'email') return prop.email || '';
  if (prop.type === 'select') return prop.select && prop.select.name;
  if (prop.type === 'title') return (prop.title || []).map(t => t.plain_text).join('');
  if (prop.type === 'rich_text') return (prop.rich_text || []).map(t => t.plain_text).join('');
  if (prop.type === 'multi_select') return (prop.multi_select || []).map(s => s.name).join(', ');
  if (prop.type === 'formula') {
    // "Owner for Grouping" in the Tasks database is a formula field.
    // Its result can be string, number, boolean, or date depending on the formula.
    const f = prop.formula;
    if (!f) return '';
    if (f.type === 'string') return f.string || '';
    if (f.type === 'number') return f.number != null ? String(f.number) : '';
    if (f.type === 'boolean') return f.boolean ? 'true' : 'false';
    if (f.type === 'date') return (f.date && f.date.start) || '';
    return '';
  }
  return '';
}

// ---------- Shared Google Calendar sync ----------
/**
 * One shared calendar ("NinaAgent Hub - Content Planner") holding an event
 * per content item. PMs subscribe to this calendar once (Google Calendar →
 * Other calendars → Subscribe) rather than each item being pushed into
 * individual personal calendars — avoids needing everyone's email mapped
 * to a name, and one setup step covers the whole team.
 */
function getContentCalendar() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CALENDAR_ID');
  if (id) {
    try {
      const cal = CalendarApp.getCalendarById(id);
      if (cal) return cal;
    } catch (e) { /* fall through and recreate */ }
  }
  const cal = CalendarApp.createCalendar('NinaAgent Hub - Content Planner');
  cal.setDescription(
    'ปฏิทินรวมกำหนดการโพสต์คอนเทนต์ทุกแบรนด์ จากระบบ Content Planner (NinaAgent Hub)\n\n' +
    'แต่ละ event = คอนเทนต์ 1 ชิ้นที่ถูกกำหนดวันโพสต์ไว้ ระบบอัปเดตให้อัตโนมัติทุกครั้งที่มีการสร้าง/แก้ไข/ยกเลิกคอนเทนต์ในระบบ ไม่ต้องแก้ไข event ในปฏิทินนี้เอง\n\n' +
    'รายละเอียดแต่ละ event: สถานะ, ผู้รับผิดชอบ, ผู้ตรวจ, หมายเหตุ\n\n' +
    'หากต้องการแก้ไขข้อมูล หรือดูรายละเอียด Caption/สื่อ ให้เข้าที่ระบบ Content Planner โดยตรง'
  );
  props.setProperty('CALENDAR_ID', cal.getId());
  return cal;
}

/**
 * Run manually once if the calendar was already created before this
 * description text existed (setDescription only runs automatically on
 * first creation, not retroactively).
 */
function setCalendarDescription() {
  getContentCalendar().setDescription(
    'ปฏิทินรวมกำหนดการโพสต์คอนเทนต์ทุกแบรนด์ จากระบบ Content Planner (NinaAgent Hub)\n\n' +
    'แต่ละ event = คอนเทนต์ 1 ชิ้นที่ถูกกำหนดวันโพสต์ไว้ ระบบอัปเดตให้อัตโนมัติทุกครั้งที่มีการสร้าง/แก้ไข/ยกเลิกคอนเทนต์ในระบบ ไม่ต้องแก้ไข event ในปฏิทินนี้เอง\n\n' +
    'รายละเอียดแต่ละ event: สถานะ, ผู้รับผิดชอบ, ผู้ตรวจ, หมายเหตุ\n\n' +
    'หากต้องการแก้ไขข้อมูล หรือดูรายละเอียด Caption/สื่อ ให้เข้าที่ระบบ Content Planner โดยตรง'
  );
}

/**
 * Creates or updates the calendar event for a content item, and removes it
 * if the item is Cancelled. Never throws — a calendar hiccup shouldn't
 * block saving the content item itself, so failures are just logged.
 */
function syncCalendarEventSafely(sheet, rowIdx, item) {
  try {
    const colIdx = COLUMNS.indexOf('CalendarEventId') + 1;
    if (item.Status === 'Cancelled') {
      deleteCalendarEvent(item.CalendarEventId);
      sheet.getRange(rowIdx, colIdx).setValue('');
      return;
    }
    const eventId = syncCalendarEvent(item);
    if (eventId !== item.CalendarEventId) {
      sheet.getRange(rowIdx, colIdx).setValue(eventId);
    }
  } catch (e) {
    Logger.log('Calendar sync failed for ' + item.ID + ': ' + e);
  }
}

function syncCalendarEvent(item) {
  const cal = getContentCalendar();
  const start = new Date(item.ScheduledAt);
  if (isNaN(start)) return item.CalendarEventId || '';
  const end = new Date(start.getTime() + 30 * 60000);
  const title = `[${(item.Platforms || []).join(', ')}] ${item.Brand} - ${item.Title}`;
  const description = [
    'สถานะ: ' + item.Status,
    'ผู้รับผิดชอบ: ' + item.Owner,
    'ผู้ตรวจ: ' + item.Reviewer,
    item.Note ? 'หมายเหตุ: ' + item.Note : '',
  ].filter(Boolean).join('\n');
  const ownerEmailMap = getOwnerEmailMap();
  const targetGuestEmail = ownerEmailMap[normalizeOwnerTag(item.Owner)] || null;
  // Temporary debug line — check Apps Script → Executions after saving an
  // item to see the exact raw text on both sides. Remove once guest-invite
  // is confirmed working.
  Logger.log('Guest-invite debug: item.Owner=' + JSON.stringify(item.Owner) +
    ' normalized=' + JSON.stringify(normalizeOwnerTag(item.Owner)) +
    ' ownerEmailMapKeys=' + JSON.stringify(Object.keys(ownerEmailMap)) +
    ' matchedEmail=' + targetGuestEmail);

  let event = null;
  if (item.CalendarEventId) {
    try { event = cal.getEventById(item.CalendarEventId); } catch (e) { event = null; }
  }
  if (event) {
    event.setTitle(title);
    event.setTime(start, end);
    event.setDescription(description);
    syncEventGuest(event, targetGuestEmail, ownerEmailMap);
    return event.getId();
  }
  const created = cal.createEvent(title, start, end, { description });
  syncEventGuest(created, targetGuestEmail, ownerEmailMap);
  return created.getId();
}

/**
 * Adds targetEmail as a guest if it isn't one already, and removes any
 * previously-added guest from ownerEmailMap that's no longer the current
 * Owner (e.g. the item got reassigned) — but never touches a guest that
 * isn't one of ours (someone could have manually added themselves).
 */
function syncEventGuest(event, targetEmail, ownerEmailMap) {
  const managedEmails = Object.keys(ownerEmailMap).map(k => ownerEmailMap[k]);
  let current;
  try { current = event.getGuestList().map(g => g.getEmail()); } catch (e) { current = []; }
  current.forEach(email => {
    if (managedEmails.indexOf(email) !== -1 && email !== targetEmail) {
      try { event.removeGuest(email); } catch (e) { /* ignore */ }
    }
  });
  if (targetEmail && current.indexOf(targetEmail) === -1) {
    try { event.addGuest(targetEmail); } catch (e) { Logger.log('addGuest failed: ' + e); }
  }
}

function deleteCalendarEvent(eventId) {
  if (!eventId) return;
  try {
    const cal = getContentCalendar();
    const event = cal.getEventById(eventId);
    if (event) event.deleteEvent();
  } catch (e) { /* already gone, ignore */ }
}

/**
 * One-time backfill: run manually after adding calendar sync to pick up
 * content items that were created/edited before this feature existed
 * (calendar sync only fires inside createContent/updateContent, so older
 * rows were never touched). Safe to re-run — skips rows that already have
 * a CalendarEventId and a working event.
 */
function backfillCalendarEvents() {
  const sheet = getContentSheet();
  const values = sheet.getDataRange().getValues();
  const header = values.shift();
  const idColIdx = header.indexOf('CalendarEventId');
  let created = 0, skipped = 0, failed = 0;

  values.forEach((row, i) => {
    if (!row[0]) return; // blank row
    const item = rowToItem(row);
    if (item.Status === 'Cancelled') { skipped++; return; }
    if (item.CalendarEventId) {
      try {
        const cal = getContentCalendar();
        if (cal.getEventById(item.CalendarEventId)) { skipped++; return; }
      } catch (e) { /* event missing, fall through and recreate */ }
    }
    try {
      const eventId = syncCalendarEvent(item);
      sheet.getRange(i + 2, idColIdx + 1).setValue(eventId);
      created++;
    } catch (e) {
      Logger.log('Backfill failed for ' + item.ID + ': ' + e);
      failed++;
    }
  });

  Logger.log(`Backfill done: ${created} created, ${skipped} already had events, ${failed} failed.`);
}

// ---------- Import content plan from a calendar image (Gemini Vision) ----------
/**
 * Reads a Canva-style content calendar image and returns a draft list of
 * content items extracted from it. Nothing is written to the Sheet here —
 * the frontend shows these as an editable review list first, and only
 * calls 'bulkCreate' once the user confirms.
 *
 * Requires Script Property: GEMINI_API_KEY (same key used by
 * Social_Media_Assistant_GAS's callGeminiUniversal, can be shared/reused).
 */
function extractCalendarImage(base64, mimeType) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Set GEMINI_API_KEY in Script Properties first.');

  const currentYear = new Date().getFullYear();
  const prompt = 'อ่านรูปปฏิทินคอนเทนต์นี้อย่างละเอียด แล้วแยกรายการคอนเทนต์แต่ละอันออกมา ' +
    'ตอบกลับเป็น JSON array เท่านั้น ห้ามมีข้อความอื่นหรือ markdown ล้อมกรอบ ' +
    'รูปแบบแต่ละรายการ: {"title": "หัวข้อ/คำอธิบายสั้นๆ ของคอนเทนต์", ' +
    '"date": "YYYY-MM-DD", "platform": "Facebook|Instagram|TikTok|LINE|YouTube", ' +
    '"note": "รายละเอียดเพิ่มเติมถ้ามีในรูป เช่น แคมเปญหรือแบรนด์"}. ' +
    'ถ้าวันที่ในรูปไม่ระบุปี ให้ใช้ปี ' + currentYear + '. ' +
    'ถ้าไม่ระบุแพลตฟอร์มชัดเจน ให้เดาจากไอคอน/สีที่ใกล้เคียงที่สุด หรือใส่ "Facebook" เป็นค่าเริ่มต้น.';

  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
    }],
  };

  const resp = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    }
  );
  const json = JSON.parse(resp.getContentText());
  if (json.error) throw new Error('Gemini API Error: ' + json.error.message);

  let text = json.candidates[0].content.parts[0].text;
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const items = JSON.parse(text);
  if (!Array.isArray(items)) throw new Error('Gemini did not return a JSON array');
  return items;
}

// ---------- Reminders (LINE push via time-driven triggers) ----------
// Statuses that never get reminded about at all — Posted/Cancelled are done,
// Scheduled means it's already queued elsewhere (e.g. Meta Business Suite),
// so no nag is needed for it.
const REMINDER_SKIP_STATUSES = ['Posted', 'Cancelled', 'Scheduled'];

/**
 * Run once a day at 8:15 (Asia/Bangkok) by a time-driven trigger (see
 * setupReminderTrigger()). Every morning re-scans three date buckets fresh —
 * due in 2 days, due tomorrow, due today — so nothing depends on when an
 * item was created or last edited; a reschedule just lands it in whichever
 * bucket matches on the next run. Each bucket becomes one LINE Flex
 * "carousel" message bundling every item in it, instead of one push per
 * item. Sent_Prep2d / Sent_Prep1d / Sent_DayOf mark a row as done per
 * bucket so it's never included twice.
 */
function sendDailyReminders() {
  const sheet = getContentSheet();
  const values = sheet.getDataRange().getValues();
  const header = values.shift();
  const col = name => header.indexOf(name);
  const tz = 'Asia/Bangkok';
  const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const tomorrowStr = Utilities.formatDate(new Date(Date.now() + 1 * 86400000), tz, 'yyyy-MM-dd');
  const in2DaysStr = Utilities.formatDate(new Date(Date.now() + 2 * 86400000), tz, 'yyyy-MM-dd');

  const prep2dItems = [];
  const prep1dItems = [];
  const dayOfItems = [];

  values.forEach((row, i) => {
    const rowIdx = i + 2;
    const status = row[col('Status')];
    if (REMINDER_SKIP_STATUSES.indexOf(status) !== -1) return;
    const scheduledAt = new Date(row[col('ScheduledAt')]);
    if (isNaN(scheduledAt)) return;
    const dateStr = Utilities.formatDate(scheduledAt, tz, 'yyyy-MM-dd');
    const info = {
      id: row[col('ID')],
      title: row[col('Title')],
      brand: row[col('Brand')],
      platforms: row[col('Platforms')],
      owner: row[col('Owner')],
      scheduledAtText: formatTH(scheduledAt),
      media: row[col('MediaUrl')],
    };

    const notReady = status !== 'Ready' && status !== 'Approved';
    if (dateStr === in2DaysStr && notReady && !row[col('Sent_Prep2d')]) {
      prep2dItems.push(info);
      sheet.getRange(rowIdx, col('Sent_Prep2d') + 1).setValue(new Date().toISOString());
    }
    if (dateStr === tomorrowStr && notReady && !row[col('Sent_Prep1d')]) {
      prep1dItems.push(info);
      sheet.getRange(rowIdx, col('Sent_Prep1d') + 1).setValue(new Date().toISOString());
    }
    if (dateStr === todayStr && !row[col('Sent_DayOf')]) {
      dayOfItems.push(info);
      sheet.getRange(rowIdx, col('Sent_DayOf') + 1).setValue(new Date().toISOString());
    }
  });

  if (prep2dItems.length) sendFlexReminder(prep2dItems, 'prep2d');
  if (prep1dItems.length) sendFlexReminder(prep1dItems, 'prep1d');
  if (dayOfItems.length) sendFlexReminder(dayOfItems, 'dayOf');
}

/**
 * Run every 15 minutes by a time-driven trigger (see setupReminderTrigger()).
 * Only handles the overdue safety-net message now — the 2-day-before and
 * day-of reminders are handled by the once-a-day sendDailyReminders() above.
 */
function checkReminders() {
  const sheet = getContentSheet();
  const values = sheet.getDataRange().getValues();
  const header = values.shift();
  const col = name => header.indexOf(name);
  const now = new Date();

  values.forEach((row, i) => {
    const rowIdx = i + 2;
    const status = row[col('Status')];
    if (REMINDER_SKIP_STATUSES.indexOf(status) !== -1) return;
    const scheduledAt = new Date(row[col('ScheduledAt')]);
    if (isNaN(scheduledAt)) return;
    const hoursUntil = (scheduledAt - now) / 3600000;
    if (hoursUntil >= 0) return;

    const lastSentStr = row[col('Sent_OverdueAt')];
    const lastSent = lastSentStr ? new Date(lastSentStr) : null;
    const dueForResend = !lastSent || (now - lastSent) / 3600000 >= 2;
    if (!dueForResend) return;

    const title = row[col('Title')];
    const brand = row[col('Brand')];
    const owner = row[col('Owner')];
    sendLineMessage(`🚨 เลยกำหนดโพสแล้วนะคะ: "${title}" (${brand}) กำหนดเดิม ${formatTH(scheduledAt)} — รับผิดชอบ: ${owner}`);
    sheet.getRange(rowIdx, col('Sent_OverdueAt') + 1).setValue(now.toISOString());
  });
}

function formatTH(date) {
  return Utilities.formatDate(date, 'Asia/Bangkok', 'dd MMM HH:mm');
}

const PLATFORM_SHORT_LABEL = { Facebook: 'Fb', Instagram: 'Ig', TikTok: 'TikTok', LINE: 'LINE', YouTube: 'YouTube' };
function shortPlatforms(platformsCsv) {
  return (platformsCsv || '').split(',').filter(Boolean)
    .map(p => PLATFORM_SHORT_LABEL[p.trim()] || p.trim()).join(', ');
}

const REMINDER_KIND = {
  prep2d: { headerColor: '#f59e0b', headerText: '📋 อีก 2 วันจะถึงกำหนดโพส', closingText: 'รีบเตรียมให้ทันด้วยนะคะ 🙏', altText: n => `อีก 2 วัน มีกำหนดโพส ${n} งานที่ยังไม่พร้อมนะคะ` },
  prep1d: { headerColor: '#ea580c', headerText: '⚠️ พรุ่งนี้ถึงกำหนดโพสแล้ว', closingText: 'เหลือเวลาไม่มากแล้ว รีบเช็คให้พร้อมด้วยนะคะ', altText: n => `พรุ่งนี้มีกำหนดโพส ${n} งานที่ยังไม่พร้อมนะคะ` },
  dayOf: { headerColor: '#4f46e5', headerText: '📅 วันนี้มีกำหนดโพส', closingText: 'ถึงกำหนดโพสวันนี้แล้วค่ะ', altText: n => `วันนี้มีกำหนดโพส ${n} งานนะคะ` },
};

// Buttons rendered in each card's footer — tapping one fires a LINE postback
// event (handled by the "GEM Content Planner - LINE Status Buttons" Make.com
// scenario), which calls this backend's doPost({action:'updateStatus'}).
// prep2d/prep1d only chase readiness; dayOf chases the actual posting action,
// with "ตั้งเวลาไว้แล้ว" covering items already queued in another tool (its
// Scheduled status is in REMINDER_SKIP_STATUSES, so it silences all further
// reminders for that item on its own — no extra code needed here).
const REMINDER_KIND_ACTIONS = {
  prep2d: [{ label: '✅ พร้อมแล้ว', status: 'Ready', color: '#f59e0b' }],
  prep1d: [{ label: '✅ พร้อมแล้ว', status: 'Ready', color: '#ea580c' }],
  dayOf: [
    { label: '✅ โพสแล้ว', status: 'Posted', color: '#4f46e5' },
    { label: '📅 ตั้งเวลาไว้แล้ว', status: 'Scheduled', style: 'secondary' },
  ],
};

/** Sends one LINE Flex "carousel" message — one bubble card per item — for a batch of items due the same day. */
function sendFlexReminder(items, kind) {
  const meta = REMINDER_KIND[kind];
  const bubbles = items.map(info => {
    const bubble = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: meta.headerColor, paddingAll: '12px',
        contents: [{ type: 'text', text: meta.headerText, color: '#ffffff', weight: 'bold', size: 'sm', wrap: true }],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
        contents: [
          { type: 'text', text: '📅 กำหนดโพส: ' + info.scheduledAtText, size: 'sm', weight: 'bold', color: '#1f2937', wrap: true },
          { type: 'text', text: info.title, weight: 'bold', size: 'md', wrap: true },
          { type: 'text', text: info.brand, size: 'sm', color: '#888888' },
          { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
            { type: 'text', text: 'Channel:', size: 'xs', color: '#aaaaaa', flex: 2 },
            { type: 'text', text: shortPlatforms(info.platforms), size: 'xs', color: '#333333', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
            { type: 'text', text: 'รับผิดชอบ:', size: 'xs', color: '#aaaaaa', flex: 2 },
            { type: 'text', text: info.owner || '-', size: 'xs', color: '#333333', flex: 5, wrap: true },
          ]},
          { type: 'text', text: meta.closingText, size: 'xs', color: meta.headerColor, wrap: true, margin: 'md' },
        ],
      },
    };
    const footerButtons = REMINDER_KIND_ACTIONS[kind].map(a => ({
      type: 'button', style: a.style || 'primary', height: 'sm', color: a.color,
      action: {
        type: 'postback', label: a.label, displayText: `${a.label}: ${info.title}`,
        data: JSON.stringify({ action: 'updateStatus', id: info.id, status: a.status }),
      },
    }));
    // Only add the "open link" button if there's an actual http(s) link —
    // LINE rejects uri actions with other schemes, and a button that opens
    // nothing is worse than no button.
    if (info.media && /^https?:\/\//i.test(info.media)) {
      footerButtons.push({
        type: 'button', style: 'link', height: 'sm',
        action: { type: 'uri', label: '🔗 เปิดดูงานนี้', uri: info.media },
      });
    }
    if (footerButtons.length) {
      bubble.footer = { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px', contents: footerButtons };
    }
    return bubble;
  });

  sendLineFlexMessage(meta.altText(items.length), { type: 'carousel', contents: bubbles });
}

// LINE_TARGET_ID can hold one ID (a group/room/user) or several separated
// by commas — each gets its own push. Useful before a shared group chat
// exists: e.g. "userIdA,userIdB" pushes individually to two people.
function getLineTargetIds() {
  const raw = PropertiesService.getScriptProperties().getProperty('LINE_TARGET_ID');
  return (raw || '').split(',').map(s => s.trim()).filter(Boolean);
}

function pushLineMessage(token, targetId, message) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ to: targetId, messages: [message] }),
    muteHttpExceptions: true,
  });
}

function sendLineMessage(text) {
  const token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_TOKEN');
  const targets = getLineTargetIds();
  if (!token || !targets.length) {
    Logger.log('LINE not configured, would have sent: ' + text);
    return;
  }
  targets.forEach(targetId => pushLineMessage(token, targetId, { type: 'text', text }));
}

function sendLineFlexMessage(altText, contents) {
  const token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_TOKEN');
  const targets = getLineTargetIds();
  if (!token || !targets.length) {
    Logger.log('LINE not configured, would have sent flex: ' + altText);
    return;
  }
  targets.forEach(targetId => pushLineMessage(token, targetId, { type: 'flex', altText, contents }));
}

// ---------- One-time setup helpers ----------
function setupReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'checkReminders' || t.getHandlerFunction() === 'sendDailyReminders') {
      ScriptApp.deleteTrigger(t);
    }
  });
  // checkReminders (the 🚨 overdue-every-2h nag) is intentionally NOT installed —
  // there's no LINE button for a PM to mark something posted, so a repeating
  // "overdue" ping nobody can dismiss just becomes noise. Re-add it with:
  //   ScriptApp.newTrigger('checkReminders').timeBased().everyMinutes(15).create();
  // if that changes later.
  ScriptApp.newTrigger('sendDailyReminders').timeBased().atHour(8).nearMinute(15).everyDays(1).inTimezone('Asia/Bangkok').create();
}

/**
 * Installs a once-daily trigger for each Notion sync (Owners, Brands,
 * OwnerEmails) so the cached names/emails stay current automatically —
 * run this once instead of adding the three triggers by hand through the
 * Triggers UI. Safe to re-run any time (removes and reinstalls its own
 * triggers first, same pattern as setupReminderTrigger).
 */
function setupNotionSyncTriggers() {
  const handlers = ['syncOwnersFromNotion', 'syncBrandsFromNotion', 'syncOwnerEmailsFromNotion'];
  ScriptApp.getProjectTriggers().forEach(t => {
    if (handlers.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  handlers.forEach(fn => {
    ScriptApp.newTrigger(fn).timeBased().atHour(7).nearMinute(0).everyDays(1).inTimezone('Asia/Bangkok').create();
  });
}
