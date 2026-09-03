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

const COLUMNS = [
  'ID', 'Brand', 'Campaign', 'Title', 'Note',
  'Platforms',        // comma-separated: Facebook,Instagram,TikTok,LINE,YouTube
  'Captions',         // JSON string, keyed by platform
  'MediaUrl',
  'ScheduledAt',       // ISO datetime
  'Owner', 'Reviewer',
  'Status',            // Draft|Review|Revision|Approved|Ready|Posted|Cancelled
  'PublishedUrls',     // JSON string, keyed by platform
  'Comments',          // JSON array
  'CreatedAt', 'UpdatedAt',
  'Sent_Prep3d', 'Sent_Prep1d', 'Sent_24h', 'Sent_1h', 'Sent_OverdueAt', // reminder dedup flags
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
  }
  let owners = ss.getSheetByName(SHEET_OWNERS);
  if (!owners) owners = ss.insertSheet(SHEET_OWNERS);
  if (owners.getLastRow() === 0) {
    owners.appendRow(['Name', 'SyncedAt']);
    owners.setFrozenRows(1);
  }
}

// ---------- Web API ----------
function doGet(e) {
  const action = (e.parameter.action || 'list');
  try {
    if (action === 'list') return jsonResponse({ success: true, items: listContent() });
    if (action === 'owners') return jsonResponse({ success: true, owners: listOwners() });
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
    if (col.indexOf('Sent_') === 0) return '';
    return data[col] || '';
  });
  sheet.appendRow(row);
  return rowToItem(row);
}

function updateContent(id, data) {
  const sheet = getContentSheet();
  const rowIdx = findRowIndexById(sheet, id);
  if (rowIdx === -1) throw new Error('Content not found: ' + id);
  const range = sheet.getRange(rowIdx, 1, 1, COLUMNS.length);
  const current = range.getValues()[0];
  COLUMNS.forEach((col, i) => {
    if (col === 'ID' || col === 'CreatedAt') return;
    if (col === 'UpdatedAt') { current[i] = new Date().toISOString(); return; }
    if (data[col] === undefined) return;
    if (col === 'Platforms') { current[i] = (data.Platforms || []).join(','); return; }
    if (col === 'Captions' || col === 'PublishedUrls' || col === 'Comments') {
      current[i] = JSON.stringify(data[col]); return;
    }
    current[i] = data[col];
  });
  range.setValues([current]);
  return rowToItem(current);
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

// ---------- Owners (synced from Notion) ----------
function listOwners() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_OWNERS);
  const values = sheet.getDataRange().getValues();
  values.shift();
  return values.filter(r => r[0]).map(r => r[0]);
}

/**
 * Pulls the "Owner for Grouping" property from the Notion database and
 * writes the distinct names into the Owners tab. Run manually or on a
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
  let cursor = undefined;
  do {
    const payload = cursor ? { start_cursor: cursor } : {};
    const resp = UrlFetchApp.fetch('https://api.notion.com/v1/databases/' + dbId + '/query', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token, 'Notion-Version': '2022-06-28' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const json = JSON.parse(resp.getContentText());
    if (json.results) {
      json.results.forEach(page => {
        const prop = page.properties[PROPERTY_NAME];
        if (!prop) return;
        const value = extractNotionText(prop);
        if (value) names.add(value);
      });
    }
    cursor = json.has_more ? json.next_cursor : undefined;
  } while (cursor);

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_OWNERS);
  sheet.clearContents();
  sheet.appendRow(['Name', 'SyncedAt']);
  const now = new Date().toISOString();
  [...names].sort().forEach(name => sheet.appendRow([name, now]));
}

function extractNotionText(prop) {
  if (prop.type === 'select') return prop.select && prop.select.name;
  if (prop.type === 'title') return (prop.title || []).map(t => t.plain_text).join('');
  if (prop.type === 'rich_text') return (prop.rich_text || []).map(t => t.plain_text).join('');
  if (prop.type === 'multi_select') return (prop.multi_select || []).map(s => s.name).join(', ');
  return '';
}

// ---------- Reminders (LINE push via time-driven trigger) ----------
/**
 * Run every 15 minutes by a time-driven trigger (see setupReminderTrigger()).
 * Sends LINE push messages for each rule, using the Sent_* columns to avoid
 * duplicate sends. Requires Script Properties: LINE_CHANNEL_TOKEN, LINE_TARGET_ID
 * (a group ID or user ID — see SETUP.md for how to get a group ID).
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
    if (status === 'Posted' || status === 'Cancelled') return;
    const scheduledAt = new Date(row[col('ScheduledAt')]);
    if (isNaN(scheduledAt)) return;
    const hoursUntil = (scheduledAt - now) / 3600000;
    const notReady = status !== 'Ready' && status !== 'Approved';
    const title = row[col('Title')];
    const brand = row[col('Brand')];

    maybeSend(sheet, rowIdx, col('Sent_Prep3d'), notReady && hoursUntil <= 72 && hoursUntil > 24,
      `📋 เตรียมงาน 3 วันก่อนโพส: "${title}" (${brand}) ยังไม่พร้อม กำหนดโพส ${formatTH(scheduledAt)}`);

    maybeSend(sheet, rowIdx, col('Sent_Prep1d'), notReady && hoursUntil <= 24 && hoursUntil > 1,
      `⚠️ เหลือ 1 วัน: "${title}" (${brand}) ยังไม่พร้อม กำหนดโพส ${formatTH(scheduledAt)}`);

    maybeSend(sheet, rowIdx, col('Sent_24h'), hoursUntil <= 24 && hoursUntil > 23,
      `🔔 อีก 24 ชม. จะถึงกำหนดโพส: "${title}" (${brand})`);

    maybeSend(sheet, rowIdx, col('Sent_1h'), hoursUntil <= 1 && hoursUntil > 0,
      `⏰ อีก 1 ชม. จะถึงกำหนดโพส: "${title}" (${brand})`);

    if (hoursUntil < 0) {
      const lastSentStr = row[col('Sent_OverdueAt')];
      const lastSent = lastSentStr ? new Date(lastSentStr) : null;
      const dueForResend = !lastSent || (now - lastSent) / 3600000 >= 2;
      if (dueForResend) {
        sendLineMessage(`🚨 เลยกำหนดโพสแล้ว: "${title}" (${brand}) กำหนดเดิม ${formatTH(scheduledAt)}`);
        sheet.getRange(rowIdx, col('Sent_OverdueAt') + 1).setValue(now.toISOString());
      }
    }
  });
}

function maybeSend(sheet, rowIdx, colIdx, condition, message) {
  if (!condition) return;
  const cell = sheet.getRange(rowIdx, colIdx + 1);
  if (cell.getValue()) return; // already sent
  sendLineMessage(message);
  cell.setValue(new Date().toISOString());
}

function formatTH(date) {
  return Utilities.formatDate(date, 'Asia/Bangkok', 'dd MMM HH:mm');
}

function sendLineMessage(text) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_CHANNEL_TOKEN');
  const targetId = props.getProperty('LINE_TARGET_ID');
  if (!token || !targetId) {
    Logger.log('LINE not configured, would have sent: ' + text);
    return;
  }
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ to: targetId, messages: [{ type: 'text', text }] }),
    muteHttpExceptions: true,
  });
}

// ---------- One-time setup helpers ----------
function setupReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'checkReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkReminders').timeBased().everyMinutes(15).create();
}
