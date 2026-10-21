// ============================================================
// Task Status Tracker — Google Apps Script (AD Review Queue)
// Master Sheet (Columns Q, R, S, T) & Sync to Individual Sheets
// Never Skip Active Tasks (Sent to P'Aof / มีปรับแก้) Regardless of Date
// ============================================================

const CONFIG = {
  // ตั้งค่า Google Sheet สำหรับทุกคนในทีม (สำหรับ Sync สถานะกลับชีตส่วนตัว)
  TEAM_SHEETS: {
    'จ๊ะเอ๋':  '1Q7CvHdG0mXtmIJ_hHsHU1wDHhSO-zYs0SBD6gYU7PTc',
    'อุ้ม':    '1zG0ZyQN2tT0dV9L7ktyJ-_477Yh_ybwjWLR87eFDbOY',
    'กิ๊บ':   '1L7arKfntBNEbiLJHMV24L4NGg4pyRTeK2a989VFgam4',
    'เป้':    '1hgEF_R0DQ8p3_mwcy7qXLl94bR0jF_nQsooFXXTbl88',
    'โชกุล':  '1L4m3C2zHnirHbyEhgqJilDtQhyorrsrj7xDEP22BF-w',
    'ท้อป':   '1Lz30YiHpxih0nBABS_Dg2Wm9PvZxX0aVFuwubbZIr2g',
    'โอม':    '1R4ieki0O1Kj-Hk6k-aUeGSLCAW94oDwHQqX9GdVhgeM',
  },

  // Master Sheet สำหรับเก็บข้อมูลคิวงานทั้งหมด (GEM_Graphic_Master)
  MASTER_SHEET_ID: '144OB0gy5dJ8MOnc5Te0k1KpltrDoG4ocnxcS3t4MR4g',

  // ตั้งค่า LINE (ตั้งค่าจริงใน Script Properties: Project Settings > Script Properties > LINE_CHANNEL_ACCESS_TOKEN)
  LINE_CHANNEL_ACCESS_TOKEN: PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN'),
  // bindGroupId() (triggered by typing "ผูกกลุ่ม" in a LINE chat) writes a new
  // destination to this same Script Property — read it here instead of a
  // hardcoded literal, or re-binding silently has no effect on where alerts
  // actually go. The literal is only a fallback for a brand-new deployment
  // that has never had the property set.
  LINE_GROUP_ID: PropertiesService.getScriptProperties().getProperty('LINE_GROUP_ID') || 'C73656d16402ca46690a9ef39b9382bfd',

  // ตำแหน่งคอลัมน์ใน GEM_Graphic_Master (📥 RAW DATA sheet)
  // Row 4: Header, Row 5+: Data
  // Index 0-based:
  MASTER_COL_OWNER_A: 0,        // Col A (คนทำงาน / Graphic Designer)
  MASTER_COL_STATUS: 1,         // Col B (Graphic Status: IMPORTRANGE - READ ONLY)
  MASTER_COL_JOB_NO: 10,        // Col K (Job No.)
  MASTER_COL_BRAND: 11,         // Col L (Brand / Client)
  MASTER_COL_TASK_NAME: 12,     // Col M (ชื่องาน)
  MASTER_COL_OWNER_N: 13,       // Col N (เจ้าของงาน / PM)
  MASTER_COL_LINK: 14,          // Col O (Link ไฟล์งาน / Preview)
  MASTER_COL_DEADLINE: 15,      // Col P (Deadline / Date)
  MASTER_COL_REVIEW_STATUS: 16, // Col Q (Review Status: รอรีวิว, มีปรับแก้, อนุมัติแล้ว)
  MASTER_COL_SENT_AT: 17,       // Col R (Sent to Review At)
  MASTER_COL_REVIEWED_AT: 18,   // Col S (Reviewed At)
  MASTER_COL_REVISION_ROUND: 19, // Col T (Revision Round)
  MASTER_COL_ALERT_SENT: 20      // Col U (LINE Alert Sent Status)
};

const CACHE_KEY = "AD_REVIEW_QUEUE_TASKS_v31"; // bumped v30 -> v31: Job No.-based key, invalidate old cache shape

// Helper to get or create the AD_REVIEW_QUEUE sheet (formerly Backend_State)
function getStateSheet(ss) {
  let stateSheet = ss.getSheetByName("AD_REVIEW_QUEUE");

  if (!stateSheet) {
    stateSheet = ss.getSheetByName("Backend_State");
    if (stateSheet) {
      stateSheet.setName("AD_REVIEW_QUEUE");
    } else {
      stateSheet = ss.insertSheet("AD_REVIEW_QUEUE");
    }
  }

  stateSheet.getRange(1, 1, 1, 18).setValues([[
    "TaskKey", "TaskKey ID", "Job No", "Task Name", "Worker", "PM", "Brand",
    "Task Date", "Graphic Status", "Review Status", "Sent At", "Reviewed At",
    "Round", "Alert Sent", "Link", "Last Graphic Status", "Last Alerted Round",
    "Pending Graphic Status"
  ]]);
  stateSheet.getRange("A1:R1").setFontWeight("bold");
  stateSheet.setFrozenRows(1);
  stateSheet.showSheet();

  return stateSheet;
}

// Shared lock so a manual update from the web app or LINE postback can never
// race the background sync (both read-then-rewrite the same AD_REVIEW_QUEUE
// state; without a shared lock, a sync that started just before a manual
// approve/revise can finish just after it and silently overwrite it with the
// stale status it read earlier).
function withQueueLock(fn, timeoutMs) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(timeoutMs || 30000);
  } catch (e) {
    return { ok: false, error: "ระบบกำลังซิงก์ข้อมูลอยู่ กรุณาลองอีกครั้งใน 2-3 วินาที" };
  }
  try {
    return { ok: true, result: fn() };
  } finally {
    lock.releaseLock();
  }
}

// Helper to parse date string like "22Jul26" or "22/07/2026" into "yyyy-MM-dd"
function parseTaskDateString(dateVal) {
  if (!dateVal) return "";
  if (dateVal instanceof Date) {
    return Utilities.formatDate(dateVal, "Asia/Bangkok", "yyyy-MM-dd");
  }
  const str = String(dateVal).trim();
  const m = str.match(/^(\d{1,2})([A-Za-z]{3})(\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const monthMap = { 'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12' };
    const month = monthMap[m[2].toLowerCase()] || '07';
    let year = m[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }
  const m2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) {
    const day = m2[1].padStart(2, '0');
    const month = m2[2].padStart(2, '0');
    const year = m2[3];
    return `${year}-${month}-${day}`;
  }
  return "";
}

// ============================================================
// 1. Web App Endpoint (GET)
// ============================================================
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'getTasks') {
    return ContentService.createTextOutput(getTasksData())
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'forceWriteV') {
    return ContentService.createTextOutput(forceWriteV());
  }

  if (action === 'wipeBackendState') {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const st = getStateSheet(ss);
    if (st.getLastRow() > 1) {
      st.getRange(2, 1, st.getLastRow() - 1, st.getLastColumn()).clearContent();
    }
    return ContentService.createTextOutput('Backend_State wiped!');
  }
  if (action === 'syncNow'|| action === 'syncnow') {
    syncMasterQueueStatus();
    return ContentService.createTextOutput("Synced successfully! GEM_Graphic_Master status checked, updated, and LINE alerts sent.");
  }

  if (action === 'fixImportRange') {
    const resultMsg = fixImportRange();
    return ContentService.createTextOutput(resultMsg);
  }

  if (action === 'fixFormulaSheet') {
    const resultMsg = fixFormulaSheet();
    return ContentService.createTextOutput(resultMsg);
  }

  if (action === 'clearPastData') {
    const resultMsg = clearPastData();
    return ContentService.createTextOutput(resultMsg);
  }

  if (action === 'testPush') {
    pushDailySummary();
    return ContentService.createTextOutput("Tested!");
  }

  if (action === 'updateTask') {
    const taskId = e.parameter.taskId;
    const status = e.parameter.status;
    const comment = e.parameter.comment || '';
    return ContentService.createTextOutput(updateTaskFromWeb(taskId, status, comment))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'setupTrigger') {
    return setupTrigger();
  }

  if (action === 'triggerLineAlerts') {
    return forceSendPendingLineAlerts();
  }

  if (action === 'manual') {
    return HtmlService.createHtmlOutputFromFile('Manual')
      .setTitle('คู่มือการใช้งาน GEM Review Queue')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (action === 'debugTasks') {
    return getDebugData();
  }

  // Read-only LINE health probe. Sends no message — tells whether the stored token is
  // valid, how much quota is left, and whether the bot can still see the target group.
  if (action === 'lineProbe') {
    const token = CONFIG.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'LINE_CHANNEL_ACCESS_TOKEN not set in Script Properties' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const opts = { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true };
    const probe = (label, url) => {
      try {
        const r = UrlFetchApp.fetch(url, opts);
        return { code: r.getResponseCode(), body: r.getContentText() };
      } catch (e) {
        return { code: 0, body: e.message };
      }
    };
    return ContentService.createTextOutput(JSON.stringify({
      groupId: CONFIG.LINE_GROUP_ID,
      tokenTail: token.slice(-6),
      botInfo: probe('info', 'https://api.line.me/v2/bot/info'),
      quota: probe('quota', 'https://api.line.me/v2/bot/message/quota'),
      consumption: probe('consumption', 'https://api.line.me/v2/bot/message/quota/consumption'),
      groupSummary: probe('group', 'https://api.line.me/v2/bot/group/' + CONFIG.LINE_GROUP_ID + '/summary')
    }, null, 2)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'resendToday') {
    return ContentService.createTextOutput(resendTodayAlerts())
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'fixDates') {
    fixCorruptDates();
    return ContentService.createTextOutput("Fixed");
  }

  if (action === 'runMigration') {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    let stateSheet = ss.getSheetByName("AD_REVIEW_QUEUE") || ss.getSheetByName("Backend_State");
    if (!stateSheet) return ContentService.createTextOutput("Sheet not found");

    stateSheet.setName("AD_REVIEW_QUEUE");
    const lastRow = stateSheet.getLastRow();
    if (lastRow >= 2) {
      const data = stateSheet.getRange(2, 1, lastRow - 1, 6).getValues();
      const newData = [];
      for (let i = 0; i < data.length; i++) {
        const reviewStatus = data[i][1];
        if (String(reviewStatus).indexOf("รอรีวิว") === -1 && String(reviewStatus).indexOf("อนุมัติแล้ว") === -1 && String(reviewStatus).indexOf("มีปรับแก้") === -1 && reviewStatus !== "") {
          return ContentService.createTextOutput("Already migrated. Found: " + reviewStatus);
        }
        newData.push([
          data[i][0], "", "", "", "", "", "", "", "", reviewStatus, data[i][2], data[i][3], data[i][4], data[i][5], ""
        ]);
      }
      stateSheet.getRange(2, 1, newData.length, 15).setValues(newData);
    }

    stateSheet.getRange(1, 1, 1, 15).setValues([[
      "TaskKey", "TaskKey ID", "Job No", "Task Name", "Worker", "PM", "Brand",
      "Task Date", "Graphic Status", "Review Status", "Sent At", "Reviewed At",
      "Round", "Alert Sent", "Link"
    ]]);
    stateSheet.showSheet();
    return ContentService.createTextOutput("Migrated successfully");
  }

  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('คิวงานรอรีวิว - GEM Review Queue')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Fix 📌 FORMULA sheet so formulas show as clean copyable text without #REF! errors
function fixFormulaSheet() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const sheets = ss.getSheets();
    let formulaSheet = null;

    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().indexOf('FORMULA') !== -1) {
        formulaSheet = sheets[i];
        break;
      }
    }

    if (!formulaSheet) return "Sheet 📌 FORMULA not found.";

    const importrangeFormulaText = `={
  {"จ๊ะเอ๋",  IMPORTRANGE("1Q7CvHdG0mXtmIJ_hHsHU1wDHhSO-zys0SBD6gYU7PTc", "Sheet1!A5:N5000")};
  {"อุ้ม",    IMPORTRANGE("1zG0ZyQN2tT0dV9L7ktyJ-_477Yh_ybwjWLR87eFDbOY", "Sheet1!A5:N5000")};
  {"กิ๊บ",   IMPORTRANGE("1L7arKfntBNEbiLJHMV24L4NGg4pyRTeK2a989VFgam4", "Sheet1!A5:N5000")};
  {"เป้",    IMPORTRANGE("1hgEF_R0DQ8p3_mwcy7qXLl94bR0jF_nQsooFXXTbl88", "Sheet1!A5:N5000")};
  {"โชกุล",  IMPORTRANGE("1L4m3C2zHnirHbyEhgqJilDtQhyorrsrj7xDEP22BF-w", "Sheet1!A5:N5000")};
  {"ท้อป",   IMPORTRANGE("1Lz30YiHpxih0nBABS_Dg2Wm9PvZxX0aVFuwubbZIr2g", "Sheet1!A5:N5000")};
  {"โอม",    IMPORTRANGE("1R4ieki0O1Kj-Hk6k-aUeGSLCAW94oDwHQqX9GdVhgeM", "Sheet1!A5:N5000")}
}`;

    const filterFormulaText = `=FILTER('📥 RAW DATA'!A5:O, '📥 RAW DATA'!A5:A="จ๊ะเอ๋")`;

    formulaSheet.getRange("A11").setValue("'" + importrangeFormulaText);
    formulaSheet.getRange("A16").setValue("'" + filterFormulaText);

    return "Successfully updated 📌 FORMULA sheet! A11 and A16 are now clean copyable templates without errors.";
  } catch (err) {
    return "Error updating 📌 FORMULA: " + err.message;
  }
}

// Clears blocking values in both 📥 RAW DATA and 📌 VIEW sheets so formulas expand cleanly
function fixImportRange() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    let msg = "";

    const rawSheet = ss.getSheetByName('📥 RAW DATA') || ss.getSheetByName('RAW DATA');
    if (rawSheet) {
      rawSheet.getRange("A6:P2000").clearContent();
      msg += "[📥 RAW DATA] Cleared A6:P2000 successfully. ";
    }

    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      const sName = sheets[i].getName();
      if (sName.indexOf('VIEW') !== -1) {
        sheets[i].getRange("A11:P2000").clearContent();
        msg += `[${sName}] Cleared blocking cell B1310 and range A11:P2000 successfully! `;
      }
    }

    CacheService.getScriptCache().remove(CACHE_KEY);
    return msg || "No sheets found to fix.";
  } catch (err) {
    return "Error fixing sheets: " + err.message;
  }
}

// Function to clear retroactive past data in Columns Q, R, S, T for inactive rows before today
function clearPastData() {
  try {
    const sheet = getMasterRawDataSheet();
    if (!sheet) return "No sheet";
    const lastRow = sheet.getLastRow();
    if (lastRow < 5) return "No data";

    const data = sheet.getRange(1, 1, lastRow, 20).getValues();
    const todayStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
    let clearedCount = 0;

    for (let i = 4; i < data.length; i++) {
      const rowNum = i + 1;
      const dateVal = data[i][5]; // Col F (วันที่ส่งงาน)
      const taskDateStr = parseTaskDateString(dateVal);
      const graphicStatus = String(data[i][CONFIG.MASTER_COL_STATUS] || '').trim();
      const normVal = graphicStatus.toLowerCase().replace(/’/g, "'");
      const currentReviewStatus = String(data[i][CONFIG.MASTER_COL_REVIEW_STATUS] || '').trim();

      const isActiveTask = (normVal === "sent to p'aof" || normVal === "มีปรับแก้" || currentReviewStatus === "รอรีวิว" || currentReviewStatus === "มีปรับแก้");

      // If past task and NOT active, clear Col Q, R, S, T
      if (taskDateStr && taskDateStr < todayStr && !isActiveTask) {
        const currentQ = data[i][16];
        const currentR = data[i][17];
        const currentS = data[i][18];
        const currentT = data[i][19];
        if (currentQ !== "" || currentR !== "" || currentS !== "" || currentT !== "") {
          sheet.getRange(rowNum, 17, 1, 4).clearContent();
          clearedCount++;
        }
      }
    }
    CacheService.getScriptCache().remove(CACHE_KEY);
    return `Cleared ${clearedCount} past inactive rows before ${todayStr}`;
  } catch (err) {
    return "Error clearing past data: " + err.message;
  }
}

// ============================================================
// 2. LINE Webhook Endpoint (POST)
// ============================================================
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    if (postData.events) {
      return handleLineWebhook(postData.events);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'unknown_source' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// 3. Helper for Master Sheet (GEM_Graphic_Master)
// ============================================================
function getMasterRawDataSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  return ss.getSheetByName('📥 RAW DATA');
}

function ensureMasterHeaders() {
  const sheet = getMasterRawDataSheet();
  if (!sheet) return;

  const hQ = sheet.getRange(4, 17); // Col Q
  const hR = sheet.getRange(4, 18); // Col R
  const hS = sheet.getRange(4, 19); // Col S
  const hT = sheet.getRange(4, 20); // Col T
  const hU = sheet.getRange(4, 21); // Col U

  if (hQ.getValue() !== "Review Status") hQ.setValue("Review Status");
  if (hR.getValue() !== "Sent to Review At") hR.setValue("Sent to Review At");
  if (hS.getValue() !== "Reviewed At") hS.setValue("Reviewed At");
  if (hT.getValue() !== "Revision Round") hT.setValue("Revision Round");
  if (hU.getValue() !== "LINE Alert Sent") hU.setValue("LINE Alert Sent");

  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  if (ss.getSpreadsheetTimeZone() !== "Asia/Bangkok") {
    ss.setSpreadsheetTimeZone("Asia/Bangkok");
  }
}

function parseDateValue(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();
  if (!str) return null;

  // MUST check dd/MM/yyyy FIRST — new Date("04/08/2026") misreads as April 8 (US MM/DD)
  // but our data is Thai dd/MM/yyyy (= August 4). Regex handles this correctly.
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    const hh = m[4] ? m[4].padStart(2, '0') : '00';
    const mm = m[5] ? m[5].padStart(2, '0') : '00';
    const ss = m[6] ? m[6].padStart(2, '0') : '00';
    const d = new Date(`${year}-${month}-${day}T${hh}:${mm}:${ss}+07:00`);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback: ISO 8601, yyyy-MM-dd, etc. (formats new Date() handles correctly)
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

// ============================================================
// Job No. / Review Key
// Job No. IS the Review Key. If Notion already supplied one, it's used as-is.
// If not, generate ONCE ("AUTO-{BRAND}-{shortId}"), persist it back to the
// owner's PERSONAL sheet (RAW DATA's Job No. column is IMPORTRANGE-driven and
// cannot be written directly), and reuse it forever after — including across
// day-to-day copies, since the copied row carries the Job No. cell with it.
// Returns "" if it cannot be determined/written yet (caller should skip the
// row this pass and retry next sync).
// ============================================================
function ensureJobNo(masterRow, masterRowNum, masterSheet) {
  const existingJobNo = String(masterRow[CONFIG.MASTER_COL_JOB_NO] || '').trim();
  if (existingJobNo) return existingJobNo;

  const taskName = String(masterRow[CONFIG.MASTER_COL_TASK_NAME] || '').trim();
  const brand = String(masterRow[CONFIG.MASTER_COL_BRAND] || '').trim();
  const ownerA = String(masterRow[CONFIG.MASTER_COL_OWNER_A] || '').trim();
  const ownerN = String(masterRow[CONFIG.MASTER_COL_OWNER_N] || '').trim();
    console.log("ensureJobNo called: taskName=" + taskName + " brand=" + brand + " ownerA=" + ownerA + " ownerN=" + ownerN); // ← เพิ่มบรรทัดนี้
  if (!taskName || !brand) return "";

  const sheetId = findTeamSheetId(ownerA, ownerN);
  if (!sheetId) {
    console.error("ensureJobNo: no personal sheet for owner='" + (ownerA || ownerN) + "'");
    return "";
  }

  const brandSlug = brand.toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const newJobNo = `AUTO-${brandSlug}-${Utilities.getUuid().slice(0, 8).toUpperCase()}`;
  const taskDateVal = masterRow[5];
  const targetDateStr = parseTaskDateString(taskDateVal);

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    console.warn("ensureJobNo: could not obtain lock, skipping this pass.");
    return "";
  }

  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    let targetRow = -1;

    for (let i = data.length - 1; i >= 1; i--) {
      const rowText = data[i].join(' ');
      const existingJobNoInPersonal = String(data[i][9] || '').trim(); // Col J = Job No.
      if (rowText.indexOf(taskName) === -1 || existingJobNoInPersonal) continue;

      const rowDateStr = parseTaskDateString(data[i][4]); // Col E (วันที่) in personal sheet
      if (targetDateStr && rowDateStr === targetDateStr) {
        targetRow = i + 1;
        break;
      }
      if (targetRow === -1) targetRow = i + 1; // best-effort fallback if no exact date match
    }

    if (targetRow === -1) {
      console.error("ensureJobNo: no matching row found in personal sheet " + sheetId + " for task: " + taskName);
      return "";
    }

    sheet.getRange(targetRow, 10).setValue(newJobNo); // Col J = Job No.
    SpreadsheetApp.flush();
    return newJobNo;
  } catch (e) {
    console.error("ensureJobNo write failed: " + e.message);
    return "";
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// 4. Automatic Sync for Master Sheet (GEM_Graphic_Master)
// Always process active tasks (Sent to P'Aof / มีปรับแก้ / รอรีวิว) regardless of date
// ============================================================
// ============================================================
// แทนที่ syncMasterQueueStatus() เดิมทั้งฟังก์ชัน ด้วยอันนี้
// ============================================================
function syncMasterQueueStatus() {
  if (PropertiesService.getScriptProperties().getProperty('MAINTENANCE_MODE') === 'true') return;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    console.warn("Could not obtain lock, skipping this run to prevent duplicates.");
    return;
  }

  try {
    ensureMasterHeaders();
    const sheet = getMasterRawDataSheet();
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 5) return;

    const data = sheet.getRange(1, 1, lastRow, 22).getValues();
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const stateSheet = getStateSheet(ss);

    const stateData = stateSheet.getDataRange().getValues();

    const stateMap = {};
    for (let i = 1; i < stateData.length; i++) {
      const tKey = String(stateData[i][0]).trim();
      if (!tKey) continue;
      const row = stateData[i];
      stateMap[tKey] = {
        reviewStatus: String(row[9] || '').trim(),
        sentAt: row[10],
        reviewedAt: row[11],
        round: parseInt(row[12]) || 1,
        lastGraphicStatus: String(row[15] || '').trim().toLowerCase(),
        lastAlertedRound: parseInt(row[16]) || 0,
        pendingGraphicStatus: String(row[17] || '').trim().toLowerCase()
      };
    }

    const now = new Date();
    const todayStr = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
    const START_DATE = "2026-07-20";

    // ============================================================
    // รอบที่ 1 — จัดกลุ่มแถวตาม Job No.
    // ============================================================
    const rowsByJobNo = {};

    for (let i = 4; i < data.length; i++) {
      const rowNum = i + 1;
      const row = data[i];
      const taskName = String(row[CONFIG.MASTER_COL_TASK_NAME] || '').trim();
      if (!taskName) continue;

      const dateVal = row[5];
      const taskDateStr = parseTaskDateString(dateVal);
      if (taskDateStr && taskDateStr < START_DATE) continue;

      const taskKey = ensureJobNo(row, rowNum, sheet);
      if (!taskKey) continue;

      const graphicStatus = String(row[CONFIG.MASTER_COL_STATUS] || '').trim();
      const normVal = graphicStatus.toLowerCase().replace(/’/g, "'");

      if (!rowsByJobNo[taskKey]) rowsByJobNo[taskKey] = [];
      rowsByJobNo[taskKey].push({
        rowNum, row, dateVal, normVal, graphicStatus,
        taskName,
        workerName: String(row[CONFIG.MASTER_COL_OWNER_A] || row[CONFIG.MASTER_COL_OWNER_N] || 'ไม่ระบุ').trim(),
        pmName: String(row[CONFIG.MASTER_COL_OWNER_N] || '').trim(),
        brand: String(row[CONFIG.MASTER_COL_BRAND] || '').trim(),
        link: String(row[CONFIG.MASTER_COL_LINK] || '').trim()
      });
    }

    let hasChanges = false;
    const activeTasksByKey = {};

    // ============================================================
    // รอบที่ 2 — เลือกแถวตัวแทนต่อ Job No. แล้วตัดสินใจสถานะครั้งเดียว
    // ============================================================
    for (const taskKey in rowsByJobNo) {
      const rows = rowsByJobNo[taskKey];

      // ข้ามแถว Not Start/ว่าง เว้นแต่ทุกแถวเป็นแบบนั้นหมด
      const meaningfulRows = rows.filter(r => r.normVal !== "not start" && r.normVal !== "");
      const candidates = meaningfulRows.length > 0 ? meaningfulRows : rows;

      let rep = candidates[0];
      for (let k = 1; k < candidates.length; k++) {
        const c = candidates[k];
        const isNewer = (c.dateVal instanceof Date) && (!(rep.dateVal instanceof Date) || c.dateVal >= rep.dateVal);
        if (isNewer) rep = c;
      }

      let st = stateMap[taskKey];
      if (!st) {
        st = { reviewStatus: "", sentAt: "", reviewedAt: "", round: 1, lastGraphicStatus: "", lastAlertedRound: 0, pendingGraphicStatus: "" };
        stateMap[taskKey] = st;
      }

      const normVal = rep.normVal;
      let isActiveQueueTask = false;

      if (normVal === "sent to p'aof") {
        isActiveQueueTask = true;

        // Debounce: ต้องเห็น "sent to p'aof" ซ้ำ 2 รอบติดกัน ถึงจะเชื่อว่าเปลี่ยนจริง
        // (กัน IMPORTRANGE หน่วง/สะดุดชั่วครู่ มาทำให้เข้าใจผิดว่ามีการส่งใหม่)
        const rawTransition = st.lastGraphicStatus !== "sent to p'aof";
        let isRealTransition = false;
        if (rawTransition) {
          if (st.pendingGraphicStatus === "sent to p'aof") {
            isRealTransition = true;
            st.pendingGraphicStatus = "";
            st.lastGraphicStatus = "sent to p'aof"; // commit ก็ต่อเมื่อยืนยันแล้วเท่านั้น
          } else {
            st.pendingGraphicStatus = "sent to p'aof"; // เห็นครั้งแรก รอยืนยันรอบหน้า
          }
        } else {
          st.pendingGraphicStatus = "";
        }

        if (isRealTransition) {
          let newRound = st.round;
          if (st.reviewStatus === "มีปรับแก้" || st.reviewStatus === "อนุมัติแล้ว") {
            newRound = st.round + 1;
          } else if (st.reviewStatus === "") {
            newRound = 1;
          }
          st.reviewStatus = "รอรีวิว";
          st.sentAt = now;
          st.reviewedAt = "";
          st.round = newRound;
        }

        if (st.reviewStatus === "รอรีวิว" && st.lastAlertedRound < st.round) {
          const pushResult = sendLineReviewAlert(rep.taskName, rep.workerName, st.round, taskKey, rep.rowNum, CONFIG.MASTER_SHEET_ID);
          if (pushResult && pushResult.ok) {
            st.lastAlertedRound = st.round;
          }
        }

      } else if (normVal === "มีปรับแก้") {
        isActiveQueueTask = true;
        if (st.reviewStatus !== "มีปรับแก้") {
          st.reviewStatus = "มีปรับแก้";
          st.reviewedAt = now;
        }
        if (st.pendingGraphicStatus === "sent to p'aof") st.pendingGraphicStatus = "";
        st.lastGraphicStatus = normVal;

      } else if (normVal === "done" || normVal === "ok" || normVal === "อนุมัติแล้ว") {
        if (st.reviewStatus === "มีปรับแก้") {
          // นักออกแบบแก้งานเสร็จแล้วกด "Done" ตรงๆ (แทนที่จะกด "Sent to P'Aof")
          // ถือว่าเป็นการส่งกลับมารีวิวรอบใหม่เหมือนกัน — ไม่งั้นงานจะค้างสถานะ
          // "มีปรับแก้" อยู่ใน AD_REVIEW_QUEUE ตลอดไปเพราะไม่มีเงื่อนไขไหนเคย
          // พางานออกจากสถานะนี้เลย
          st.reviewStatus = "รอรีวิว";
          st.sentAt = now;
          st.reviewedAt = "";
          st.round = st.round + 1;
          isActiveQueueTask = true;

          if (st.lastAlertedRound < st.round) {
            const pushResult = sendLineReviewAlert(rep.taskName, rep.workerName, st.round, taskKey, rep.rowNum, CONFIG.MASTER_SHEET_ID);
            if (pushResult && pushResult.ok) {
              st.lastAlertedRound = st.round;
            }
          }
        } else if (st.reviewStatus === "รอรีวิว") {
          isActiveQueueTask = true;
        } else {
          if (st.reviewStatus !== "อนุมัติแล้ว") {
            st.reviewStatus = "อนุมัติแล้ว";
            if (!st.reviewedAt) {
              const dVal = rep.dateVal;
              st.reviewedAt = (dVal && dVal instanceof Date) ? dVal : now;
            }
          }
          const reviewedAtDate = (st.reviewedAt instanceof Date) ? st.reviewedAt : null;
          const reviewedIsToday = reviewedAtDate && Utilities.formatDate(reviewedAtDate, "Asia/Bangkok", "yyyy-MM-dd") === todayStr;
          isActiveQueueTask = !!reviewedIsToday;
        }
        if (st.pendingGraphicStatus === "sent to p'aof") st.pendingGraphicStatus = "";
        st.lastGraphicStatus = normVal;

      } else if (normVal === "not start" || normVal === "") {
        if (st.reviewStatus === "รอรีวิว" || st.reviewStatus === "มีปรับแก้") {
          st.reviewStatus = "";
        }
        isActiveQueueTask = false;
        if (st.pendingGraphicStatus === "sent to p'aof") st.pendingGraphicStatus = "";
        st.lastGraphicStatus = normVal;
      }

      if (isActiveQueueTask) {
        activeTasksByKey[taskKey] = [
          taskKey, taskKey, taskKey, rep.taskName, rep.workerName, rep.pmName, rep.brand,
          rep.dateVal, rep.graphicStatus, st.reviewStatus, st.sentAt, st.reviewedAt, st.round,
          "", rep.link, st.lastGraphicStatus, st.lastAlertedRound, st.pendingGraphicStatus
        ];
      }

      // ============================================================
      // รอบที่ 3 — Repaint คอลัมน์ Q-T ของทุกแถวจริงที่แชร์ Job No. นี้
      // ============================================================
      const newQ = st.reviewStatus;
      let newR = st.sentAt || '';
      if (st.sentAt && st.sentAt instanceof Date) {
        newR = "'" + Utilities.formatDate(st.sentAt, 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');
      }
      let newS = st.reviewedAt || '';
      if (st.reviewedAt && st.reviewedAt instanceof Date) {
        newS = "'" + Utilities.formatDate(st.reviewedAt, 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');
      }
      const newT = String(st.round);

      for (const r of rows) {
        const currentQ = String(r.row[16] || '');
        const currentR = String(r.row[17] || '');
        const currentS = String(r.row[18] || '');
        const currentT = String(r.row[19] || '');
        if (currentQ !== newQ || currentR !== newR || currentS !== newS || currentT !== newT) {
          sheet.getRange(r.rowNum, 17, 1, 4).setValues([[newQ, newR, newS, newT]]);
          hasChanges = true;
        }
      }
    }

    // Rebuild AD_REVIEW_QUEUE ทั้งหมด — 18 คอลัมน์
    const allActiveTasksForQueue = Object.values(activeTasksByKey);
    const lastStateRow = stateSheet.getLastRow();
    if (lastStateRow > 1) {
      stateSheet.getRange(2, 1, lastStateRow - 1, 18).clearContent();
      stateSheet.getRange(2, 1, lastStateRow - 1, 18).setBackground(null);
    }
    if (allActiveTasksForQueue.length > 0) {
      const dataRange = stateSheet.getRange(2, 1, allActiveTasksForQueue.length, 18);
      dataRange.setValues(allActiveTasksForQueue);
      stateSheet.getRange(2, 11, allActiveTasksForQueue.length, 1).setNumberFormat("dd/MM/yyyy HH:mm");
      stateSheet.getRange(2, 12, allActiveTasksForQueue.length, 1).setNumberFormat("dd/MM/yyyy HH:mm");

      const backgrounds = allActiveTasksForQueue.map(row => {
        const status = row[9];
        let color = null;
        if (status === "มีปรับแก้") color = "#dbeafe";
        else if (status === "รอรีวิว") color = "#ffedd5";
        return Array(18).fill(color);
      });
      dataRange.setBackgrounds(backgrounds);
    }

    if (hasChanges || allActiveTasksForQueue.length >= 0) {
      CacheService.getScriptCache().remove(CACHE_KEY);
    }
  } catch (err) {
    console.error("syncMasterQueueStatus error: " + err.message);
  } finally {
    lock.releaseLock();
  }
}

// Resend review alerts for TODAY's pending tasks only (recovery after a LINE outage or a
// bad token silently ate the pushes). Scoped to today so it can never spam the backlog.
function resendTodayAlerts() {
  try {
    const sheet = getMasterRawDataSheet();
    if (!sheet) return JSON.stringify({ success: false, error: 'RAW DATA sheet not found' });

    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(1, 1, lastRow, 22).getValues();
    const todayStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');

    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const stateSheet = getStateSheet(ss);
    const stateData = stateSheet.getDataRange().getValues();
    const stateRowByKey = {};
    for (let s = 1; s < stateData.length; s++) {
      const k = String(stateData[s][0] || '').trim();
      if (k) stateRowByKey[k] = s + 1;
    }

    const sent = [];
    const failed = [];

    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;
      const taskName = String(row[CONFIG.MASTER_COL_TASK_NAME] || '').trim();
      if (!taskName) continue;
      if (parseTaskDateString(row[5]) !== todayStr) continue;

      const graphicStatus = String(row[CONFIG.MASTER_COL_STATUS] || '').trim().toLowerCase().replace(/’/g, "'");
      const reviewStatus = String(row[CONFIG.MASTER_COL_REVIEW_STATUS] || '').trim();
      if (graphicStatus !== "sent to p'aof" || reviewStatus !== 'รอรีวิว') continue;

      const workerName = String(row[CONFIG.MASTER_COL_OWNER_A] || row[CONFIG.MASTER_COL_OWNER_N] || 'ไม่ระบุ').trim();
      const round = parseInt(row[CONFIG.MASTER_COL_REVISION_ROUND]) || 1;
      const taskKey = ensureJobNo(row, rowNum, sheet);
      if (!taskKey) continue;

      const result = sendLineReviewAlert(taskName, workerName, round, taskKey, rowNum, CONFIG.MASTER_SHEET_ID);
      const marker = result && result.ok ? 'SENT_R' + round : 'FAIL_' + ((result && result.code) || 0);

      sheet.getRange(rowNum, 21).setValue(marker);
      if (stateRowByKey[taskKey]) stateSheet.getRange(stateRowByKey[taskKey], 14).setValue(marker);

      if (result && result.ok) sent.push(taskName);
      else failed.push({ task: taskName, code: (result && result.code) || 0, body: (result && result.body) || '' });

      Utilities.sleep(300); // stay under LINE's push rate limit
    }

    CacheService.getScriptCache().remove(CACHE_KEY);
    return JSON.stringify({ success: true, date: todayStr, sentCount: sent.length, sent: sent, failedCount: failed.length, failed: failed }, null, 2);
  } catch (err) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

function forceSendPendingLineAlerts() {
  try {
    const sheet = getMasterRawDataSheet();
    if (!sheet) return ContentService.createTextOutput("Sheet not found");
    const data = sheet.getDataRange().getValues();
    let count = 0;
    for (let i = 4; i < data.length; i++) {
      const rowNum = i + 1;
      const graphicStatus = String(data[i][CONFIG.MASTER_COL_STATUS] || '').trim().toLowerCase();
      const reviewStatus = String(data[i][CONFIG.MASTER_COL_REVIEW_STATUS] || '').trim();
      if (graphicStatus === "sent to p'aof" || reviewStatus === "รอรีวิว") {
        const taskName = String(data[i][CONFIG.MASTER_COL_TASK_NAME] || '').trim();
        const workerName = String(data[i][CONFIG.MASTER_COL_OWNER_A] || data[i][CONFIG.MASTER_COL_OWNER_N] || 'ไม่ระบุ').trim();
        const round = parseInt(data[i][CONFIG.MASTER_COL_REVISION_ROUND]) || 1;
        const taskKey = ensureJobNo(data[i], rowNum, sheet);
        if (!taskKey) continue;
        sendLineReviewAlert(taskName, workerName, round, taskKey, rowNum, CONFIG.MASTER_SHEET_ID);
        sheet.getRange(rowNum, 21).setValue("SENT_R" + round);
        count++;
      }
    }
    return ContentService.createTextOutput("Sent " + count + " LINE alerts!");
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message);
  }
}

// ============================================================
// 5. API Data Fetching (ดึงข้อมูลงานจาก Master Sheet ส่งให้ Dashboard)
// ============================================================
function handleApiRequest() {
  return ContentService.createTextOutput(getTasksData())
    .setMimeType(ContentService.MimeType.JSON);
}

function getTasksData() {
  try {
    // NOTE: sync no longer runs here — a read must never mutate data, send LINE
    // alerts, or bump revision rounds. syncMasterQueueStatus() is driven purely
    // by its own triggers (time-based + onEdit/onChange).
    const cache = CacheService.getScriptCache();
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return cached;
    }

    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const stateSheet = getStateSheet(ss);

    const lastRow = stateSheet.getLastRow();
    if (lastRow < 2) return JSON.stringify({ success: true, tasks: [] });

    const data = stateSheet.getRange(2, 1, lastRow - 1, 15).getValues();
    const tasks = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const taskKey = String(row[0] || '').trim();
      if (!taskKey) continue;

      const notionTaskId = String(row[1] || '').trim();
      const jobId = String(row[2] || '').trim();
      const taskName = String(row[3] || '').trim();
      const workerName = String(row[4] || '').trim();
      const pmName = String(row[5] || '').trim();
      const brand = String(row[6] || '').trim();
      const dateVal = row[7];
      const graphicStatus = String(row[8] || '').trim();
      const reviewStatus = String(row[9] || '').trim();

      const sentToReviewAtRaw = row[10];
      const reviewedAtRaw = row[11];
      const revisionRound = parseInt(row[12]) || 1;
      // row[13] is alertSent, we don't need it in frontend
      const link = String(row[14] || '').trim();

      let sentToReviewAt = "";
      const parsedSent = parseDateValue(sentToReviewAtRaw);
      if (parsedSent) {
        sentToReviewAt = parsedSent.toISOString();
      }

      let reviewedAt = "";
      const parsedReviewed = parseDateValue(reviewedAtRaw);
      if (parsedReviewed) {
        reviewedAt = parsedReviewed.toISOString();
      }

      let taskDateStr = "";
      if (dateVal && dateVal instanceof Date) {
        taskDateStr = Utilities.formatDate(dateVal, "Asia/Bangkok", "yyyy-MM-dd");
      } else if (dateVal) {
        taskDateStr = String(dateVal).trim();
      }

      tasks.push({
        id: taskKey,
        uniqueId: `master_${i+2}`,
        taskKey: taskKey,
        notionTaskId: notionTaskId,
        jobId: jobId,
        name: taskName,
        owner: workerName,
        pmName: pmName,
        brand: brand,
        link: link,
        status: reviewStatus,
        graphicStatus: graphicStatus,
        deadline: taskDateStr || null,
        sentToReviewAt: sentToReviewAt,
        reviewedAt: reviewedAt,
        revisionRound: revisionRound
      });
    }

    const jsonStr = JSON.stringify({ success: true, tasks: tasks });
    cache.put(CACHE_KEY, jsonStr, 5); // 5 seconds TTL
    return jsonStr;
  } catch (err) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

// ============================================================
// 6. API Status Update (รับคำสั่งจาก Dashboard เปลี่ยนสถานะใน Sheet)
// ============================================================
function handleStatusUpdate(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const taskId = postData.taskId;
    const newStatus = postData.newStatus;

    return ContentService.createTextOutput(updateTaskStatus(taskId, newStatus))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function updateTaskFromWeb(taskId, newStatus, commentText) {
  return updateTaskStatus(taskId, newStatus);
}

// Wrapped with the same LockService lock that syncMasterQueueStatus() uses.
// Without this, a manual approve/revise from the dashboard and the 1-minute
// background sync can race: the sync can read AD_REVIEW_QUEUE just before
// this function commits its write, then finish its own clear-and-rewrite
// pass just after — silently reverting the dashboard action with no error
// shown to the user. (This was the root cause of "approved but it won't go
// away" reports.)
function updateTaskStatus(taskId, newStatus) {
  const locked = withQueueLock(() => updateTaskStatus_(taskId, newStatus), 30000);
  if (!locked.ok) {
    return JSON.stringify({ success: false, error: locked.error });
  }
  return locked.result;
}

function updateTaskStatus_(taskId, newStatus) {
  try {
    const sheet = getMasterRawDataSheet();
    if (!sheet) return JSON.stringify({ success: false, error: "ไม่พบแผ่นงานตารางหลัก" });

    ensureMasterHeaders();
    const data = sheet.getDataRange().getValues();
    let foundRow = -1;
    let taskName = '';
    let ownerA = '';
    let ownerN = '';
    let jobId = '';
    let brand = '';

       const targetStr = String(taskId).trim();
    let bestDateVal = null;
    for (let i = 4; i < data.length; i++) {
      const rowJobNo = String(data[i][CONFIG.MASTER_COL_JOB_NO] || '').trim();
      if (targetStr !== rowJobNo) continue;
      const rowDateVal = data[i][5];
      const isNewer = foundRow === -1 ||
        (rowDateVal instanceof Date && (!(bestDateVal instanceof Date) || rowDateVal >= bestDateVal));
      if (isNewer) {
        foundRow = i + 1;
        bestDateVal = rowDateVal;
        taskName = String(data[i][CONFIG.MASTER_COL_TASK_NAME] || 'ไม่ระบุชื่อ').trim();
        ownerA = String(data[i][CONFIG.MASTER_COL_OWNER_A] || '').trim();
        ownerN = String(data[i][CONFIG.MASTER_COL_OWNER_N] || '').trim();
        jobId = rowJobNo;
        brand = String(data[i][CONFIG.MASTER_COL_BRAND] || '').trim();
      }
    }
    if (foundRow > -1) {
      const now = new Date();
      const currentReviewStatus = String(sheet.getRange(foundRow, 17).getValue() || '').trim();
      const currentRound = parseInt(sheet.getRange(foundRow, 20).getValue()) || 1;

      if ((currentReviewStatus === "มีปรับแก้" || currentReviewStatus === "อนุมัติแล้ว") && newStatus !== "รอรีวิว") {
        return JSON.stringify({ success: true, taskName: taskName, alreadyUpdated: true, message: "งานไม่สามารถกดซ้ำ" });
      }

      const isApproved = (newStatus === "อนุมัติแล้ว" || newStatus === "Done");
      const newStatusStr = isApproved ? "อนุมัติแล้ว" : "มีปรับแก้";

      // 1. Update Master Sheet directly for instant UI feedback
      sheet.getRange(foundRow, 17).setValue(newStatusStr); // Col Q
      if (newStatusStr === "รอรีวิว") {
        sheet.getRange(foundRow, 18).setValue(now); // Col R
        sheet.getRange(foundRow, 19).setValue(""); // Col S
        if (currentReviewStatus !== "รอรีวิว") {
          sheet.getRange(foundRow, 20).setValue(currentRound + 1); // Col T
        }
      } else {
        sheet.getRange(foundRow, 19).setValue(now); // Col S
        sheet.getRange(foundRow, 21).setValue("REVIEWED"); // Col U
      }

      // 1b. Approve cascades: every OTHER row sharing this same Job No. (e.g. copied
      // to a later day while it was mid-review) must flip to Done too, so nothing
      // is left showing "มีปรับแก้" for a job that's already approved.
      if (isApproved || newStatusStr === "มีปรับแก้") {
        const cascadeStatus = isApproved ? "อนุมัติแล้ว" : "มีปรับแก้";
        const cascadeGraphicStatus = isApproved ? "Done" : "มีปรับแก้";
        for (let i = 4; i < data.length; i++) {
          if ((i + 1) === foundRow) continue;
          const otherJobNo = String(data[i][CONFIG.MASTER_COL_JOB_NO] || '').trim();
          if (otherJobNo !== targetStr) continue;
          const otherRowNum = i + 1;
          sheet.getRange(otherRowNum, 17).setValue(cascadeStatus);
          sheet.getRange(otherRowNum, 19).setValue(now);
          sheet.getRange(otherRowNum, 21).setValue("REVIEWED");
          const otherOwnerA = String(data[i][CONFIG.MASTER_COL_OWNER_A] || '').trim();
          const otherOwnerN = String(data[i][CONFIG.MASTER_COL_OWNER_N] || '').trim();
          const otherWorker = otherOwnerA || otherOwnerN || 'ไม่ระบุ';
          syncToIndividualSheet(targetStr, taskName, otherWorker, otherWorker, cascadeGraphicStatus, data[i][5]);
        }

      }

      // 2. Update AD_REVIEW_QUEUE
      // If approved, kick it out of the queue (Delete row).
      // If revised, update the status.
      const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
      const stateSheet = getStateSheet(ss);
      const stateData = stateSheet.getDataRange().getValues();
      let stateRowIdx = -1;

      for (let i = 1; i < stateData.length; i++) {
        if (stateData[i][0] === targetStr) {
          stateRowIdx = i + 1;
          break;
        }
      }

     if (stateRowIdx > 1) {
   if (isApproved) {
      stateSheet.getRange(stateRowIdx, 9).setValue("Done");
      stateSheet.getRange(stateRowIdx, 10).setValue("อนุมัติแล้ว"); // Review Status
      stateSheet.getRange(stateRowIdx, 12).setValue(now);           // Reviewed At
      stateSheet.getRange(stateRowIdx, 14).setValue("REVIEWED");    // Alert Sent
   } else {
      stateSheet.getRange(stateRowIdx, 10).setValue(newStatusStr);
      stateSheet.getRange(stateRowIdx, 12).setValue(now);
      stateSheet.getRange(stateRowIdx, 14).setValue("REVIEWED");
   }
} else if (!isApproved) {
         // Fallback if not found but needs to be added (rare, usually syncMasterQueueStatus does this)
         // We will just let syncMasterQueueStatus pick it up on the next tick to be safe.
      }
      SpreadsheetApp.flush();

      // 3. Sync to Graphic Designer's sheet
      const taskDateVal = data[foundRow - 1][5];
      const workerName = ownerA || ownerN || 'ไม่ระบุ';
      syncToIndividualSheet(jobId, taskName, workerName, workerName, newStatus, taskDateVal);

      // 4. Push LINE notification to group immediately
      //try {
      //  const sentAtRaw = sheet.getRange(foundRow, 18).getValue();
      //  const durationStr = formatDurationString(sentAtRaw, now);
      //  pushReviewResultFlex(taskName, workerName, brand, isApproved, durationStr);
      //} catch(lineErr) {
      //  console.warn("LINE push failed (non-blocking): " + lineErr.message);
      //}

      CacheService.getScriptCache().remove(CACHE_KEY);
      return JSON.stringify({ success: true, taskName: taskName });
    } else {
      return JSON.stringify({ success: false, error: "ไม่พบรหัสงานนี้ในระบบตารางหลัก" });
    }
  } catch (err) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

// ============================================================
// Sync Status back to Graphic Designer's Personal Sheet
// Intelligent Search matching Task Name + Date (Col F) + Job No
// ============================================================
function findTeamSheetId(ownerA, ownerN) {
  const strA = String(ownerA || '').trim();
  const strN = String(ownerN || '').trim();

  for (let key in CONFIG.TEAM_SHEETS) {
    if (strA && (strA.indexOf(key) !== -1 || key.indexOf(strA) !== -1)) {
      return CONFIG.TEAM_SHEETS[key];
    }
    if (strN && (strN.indexOf(key) !== -1 || key.indexOf(strN) !== -1)) {
      return CONFIG.TEAM_SHEETS[key];
    }
  }
  return null;
}

function syncToIndividualSheet(taskId, taskName, ownerA, ownerN, newStatus, taskDateVal) {
  const sheetId = findTeamSheetId(ownerA, ownerN);
  if (!sheetId) {
    console.error("syncToIndividualSheet: Sheet ID not found for ownerA='" + ownerA + "', ownerN='" + ownerN + "'");
    return;
  }

  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    const targetIdStr = String(taskId || '').trim();
    const targetTaskNameStr = String(taskName || '').trim();
    const targetDateStr = parseTaskDateString(taskDateVal);

    let graphicStatusValue = newStatus;
    if (newStatus === "มีปรับแก้") graphicStatusValue = "มีปรับแก้";
    if (newStatus === "อนุมัติแล้ว" || newStatus === "Done") graphicStatusValue = "Done";
    if (newStatus === "รอรีวิว" || newStatus === "Sent to P'Aof") graphicStatusValue = "Sent to P'Aof";

    let dateMatchRow = -1;    // ชื่องาน/Job No ตรง + วันที่ตรง (แม่นสุด)
    let activeStatusRow = -1; // ชื่องานตรง + Col A เป็นสถานะที่อยู่ในรอบรีวิว
    let anyMatchRow = -1;     // ชื่องานตรงอย่างเดียว (ตัวเลือกสุดท้าย)

    for (let i = data.length - 1; i >= 1; i--) {
      const rowNum = i + 1;
      const currentColA = String(data[i][0] || '').trim();
      const rowText = data[i].join(' ');
      const jobNo = String(data[i][9] || '').trim(); // Col J (Job No.)
      // วันที่งานของชีตช่างอยู่ Col E (index 4) เช่น "10Aug26" — Col D คือชื่อวัน, Col F คือ No
      const rowDateStr = parseTaskDateString(data[i][4]);

      const isNameMatch = (jobNo !== '' && targetIdStr !== '' && targetIdStr === jobNo) ||
                          (targetTaskNameStr !== '' && rowText.indexOf(targetTaskNameStr) !== -1);
      if (!isNameMatch) continue;

      if (targetDateStr && rowDateStr === targetDateStr) {
        dateMatchRow = rowNum;
        break;
      }

      const normColA = currentColA.toLowerCase().replace(/’/g, "'");
      if (normColA === "sent to p'aof" || normColA === "รอรีวิว" || normColA === "มีปรับแก้") {
        if (activeStatusRow === -1) activeStatusRow = rowNum;
      } else if (anyMatchRow === -1) {
        anyMatchRow = rowNum;
      }
    }

    // งานประจำชื่อซ้ำหลายวัน: ถ้าวันที่ไม่ตรงสักแถว ให้ยึดแถวที่กำลังรอรีวิวก่อน
    // กันเขียนทับแถว Not Start ของวันอนาคตใน template
    const bestMatchRow = dateMatchRow !== -1 ? dateMatchRow
      : (activeStatusRow !== -1 ? activeStatusRow : anyMatchRow);

    if (bestMatchRow > -1) {
      sheet.getRange(bestMatchRow, 1).setValue(graphicStatusValue); // Col A in Graphic's sheet
      SpreadsheetApp.flush();
      console.log("Successfully updated individual sheet (" + sheetId + ") row " + bestMatchRow + " (Col A) to " + graphicStatusValue);
    } else {
      console.error("syncToIndividualSheet: No matching row found in sheet " + sheetId + " for task: " + taskName);
    }
  } catch (e) {
    console.error("syncToIndividualSheet error: " + e.message);
  }
}

// ============================================================
// 7. Master Sheet Edit & Change Triggers
// ============================================================
function onTaskStatusChange(e) {
  syncMasterQueueStatus();
}

function sendLineReviewAlert(taskName, owner, round, taskKey, rowNum, spreadsheetId) {
  const nowStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
  const flexContents = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "🚨 งานรอตรวจ", weight: "bold", size: "xl", color: "#1DB446" },
        { type: "text", text: `ชิ้นงาน: ${taskName}`, margin: "md", wrap: true },
        { type: "text", text: `คนทำงาน: ${owner}`, size: "sm", color: "#666666", wrap: true },
        { type: "text", text: `รอบการตรวจ: รอบที่ ${round || 1}`, size: "sm", color: "#666666", wrap: true },
        { type: "text", text: `สถานะ: รอรีวิว`, size: "sm", color: "#1DB446", weight: "bold", wrap: true },
        { type: "text", text: `ส่งเมื่อ: ${nowStr}`, size: "xs", color: "#aaaaaa", margin: "sm" }
      ]
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "button",
          action: {
            type: "postback",
            label: "มีปรับแก้",
            data: `action=updateStatus&taskKey=${taskKey}&row=${rowNum}&sheetId=${spreadsheetId}&status=${encodeURIComponent("มีปรับแก้")}`
          },
          style: "primary",
          color: "#ff4757"
        },
        {
          type: "button",
          style: "primary",
          color: "#1DB446",
          action: {
            type: "postback",
            label: "อนุมัติ",
            data: `action=updateStatus&taskKey=${taskKey}&row=${rowNum}&sheetId=${spreadsheetId}&status=${encodeURIComponent("Done")}`
          }
        }
      ]
    }
  };
  return pushLineFlexMessage(`อัปเดตงาน "${taskName}" เป็น รอรีวิว`, flexContents);
}

// ============================================================
// 8. LINE Webhook Handling
// ============================================================
function handleLineWebhook(events) {
  events.forEach(event => {
    console.log("Source: " + JSON.stringify(event.source)); // ชั่วคราว — เอาไว้หา userId
    if (event.deliveryContext && event.deliveryContext.isRedelivery) return;
    if (event.type === 'join' && event.source && event.source.groupId) {
      bindGroupId(event.source.groupId, event.replyToken);
    } else if (event.type === 'message' && event.message.type === 'text') {
      handleTextMessage(event);
    } else if (event.type === 'postback') {
      handlePostback(event);
    }
  });
  return ContentService.createTextOutput('OK');
}

// Stores the group this bot should push alerts to. Called on join and on the "ผูกกลุ่ม"
// keyword, which covers the case where the bot was already in the group before setup.
function bindGroupId(groupId, replyToken) {
  PropertiesService.getScriptProperties().setProperty('LINE_GROUP_ID', groupId);
  if (replyToken) {
    replyText(replyToken, '✅ ผูกกลุ่มนี้เป็นห้องแจ้งเตือนงานรอตรวจแล้วค่ะ\nGroup ID: ' + groupId);
  }
}

function handleTextMessage(event) {
  const replyToken = event.replyToken;
  const userMessage = event.message.text.trim();

  if (userMessage === 'ผูกกลุ่ม') {
    if (event.source && event.source.groupId) {
      bindGroupId(event.source.groupId, replyToken);
    } else {
      replyText(replyToken, '❌ คำสั่งนี้ใช้ได้เฉพาะในกลุ่มค่ะ');
    }
    return;
  }

  if (userMessage.startsWith('!status')) {
    const taskId = userMessage.replace('!status', '').trim();
    if (taskId) replyTaskStatus(replyToken, taskId);
    else replyText(replyToken, 'กรุณาพิมพ์รหัสงานต่อท้าย เช่น !status 1024');
  } else if (userMessage === '!summary') {
    replySummaryTasks(replyToken);
  }
}

function handlePostback(event) {
  const replyToken = event.replyToken;
  const data = event.postback.data;

  const params = data.split('&').reduce((acc, curr) => {
    const [key, val] = curr.split('=');
    acc[key] = decodeURIComponent(val);
    return acc;
  }, {});

  if (params.action === 'updateStatus') {
    if (params.row && params.row.match(/[a-zA-Z]/) && !params.taskKey) {
      params.taskKey = params.row;
    }
    updateSheetStatusFromPostback(replyToken, params.taskKey, params.row, params.sheetId, params.status);
  }
}

// Helper to format review duration into "รีวิวใช้เวลา X ชม. Y น." or "รีวิวใช้เวลา X น."
function formatDurationString(sentAtVal, reviewedAtDate) {
  const sentAt = parseDateValue(sentAtVal);
  if (!sentAt || !reviewedAtDate) return `ข้อมูลเวลาไม่สมบูรณ์ ${Utilities.formatDate(reviewedAtDate || new Date(), "Asia/Bangkok", "HH:mm น.")}`;

  const diffMs = reviewedAtDate.getTime() - sentAt.getTime();
  if (diffMs <= 0) return "รีวิวใช้เวลา 1 น.";

  const totalMins = Math.round(diffMs / (1000 * 60));
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  if (hours > 0) {
    return `รีวิวใช้เวลา ${hours} ชม. ${mins} น.`;
  }
  return `รีวิวใช้เวลา ${mins > 0 ? mins : 1} น.`;
}

// Sends a clean Flex Message without buttons after review action
function replyReviewResultFlex(replyToken, taskName, workerName, brand, isApproved, durationStr) {
  const headerText = isApproved ? "✅ Approved" : "🔄 ส่งกลับไปแก้ไข";
  const headerColor = isApproved ? "#22A06B" : "#378ADD";

  const bodyContents = [
    {
      type: "text",
      text: headerText,
      weight: "bold",
      size: "md",
      color: headerColor
    },
    {
      type: "separator"
    },
    {
      type: "text",
      text: "📌 " + taskName,
      weight: "bold",
      size: "sm",
      wrap: true
    },
    {
      type: "text",
      text: "👤 " + workerName + (brand ? "  |  🏷️ " + brand : ""),
      size: "xs",
      color: "#555555",
      wrap: true
    }
  ];

  // ONLY include duration line when task is approved
  if (isApproved && durationStr) {
    bodyContents.push({
      type: "text",
      text: "⏱️ " + durationStr,
      size: "xs",
      color: "#777777"
    });
  }

  const contents = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: bodyContents
    }
  };

  replyFlexMessage(replyToken, `${headerText}: ${taskName}`, contents);
}

// Push review result to LINE group (for web-triggered actions — no replyToken)
function pushReviewResultFlex(taskName, workerName, brand, isApproved, durationStr) {
  const headerText = isApproved ? "✅ Approved" : "🔄 ส่งกลับไปแก้ไข";
  const headerColor = isApproved ? "#22A06B" : "#378ADD";

  const bodyContents = [
    { type: "text", text: headerText, weight: "bold", size: "md", color: headerColor },
    { type: "separator" },
    { type: "text", text: "📌 " + taskName, weight: "bold", size: "sm", wrap: true },
    { type: "text", text: "👤 " + workerName + (brand ? "  |  🏷️ " + brand : ""), size: "xs", color: "#555555", wrap: true },
    { type: "text", text: "🖥️ อัปเดตจากหน้าเว็บ", size: "xxs", color: "#aaaaaa", margin: "sm" }
  ];

  if (isApproved && durationStr) {
    bodyContents.splice(4, 0, { type: "text", text: "⏱️ " + durationStr, size: "xs", color: "#777777" });
  }

  const contents = {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "md", contents: bodyContents }
  };

  pushLineFlexMessage(`${headerText}: ${taskName}`, contents);
}

﻿function updateSheetStatusFromPostback(replyToken, taskKey, row, sheetId, newStatus) {
  const locked = withQueueLock(() => updateSheetStatusFromPostback_(replyToken, taskKey, row, sheetId, newStatus), 30000);
  if (!locked.ok) {
    replyText(replyToken, "❌ " + locked.error);
  }
}

function updateSheetStatusFromPostback_(replyToken, taskKey, row, sheetId, newStatus) {
  try {
    const masterSheet = getMasterRawDataSheet();
    if (!masterSheet) {
      replyText(replyToken, "❌ ไม่พบ Master Sheet");
      return;
    }

    const ss = SpreadsheetApp.openById(sheetId || CONFIG.MASTER_SHEET_ID);
    const stateSheet = getStateSheet(ss);

    let tKey = taskKey;
    let taskName = 'ไม่ระบุชื่อ';
    let workerName = 'ไม่ระบุ';
    let brand = '';
    let jobId = '';
    let taskDateVal = '';
    let sentAtVal = '';
    let st = null;
    let stateRowIdx = -1;
    let masterRowIdx = -1;

    if (tKey && tKey !== 'undefined') {
      // Parse stateData in 15-col format
      const stateData = stateSheet.getDataRange().getValues();
      for (let i = 1; i < stateData.length; i++) {
        if (stateData[i][0] === tKey) {
          stateRowIdx = i + 1;
          st = {
            reviewStatus: stateData[i][9],
            sentAt: stateData[i][10],
            reviewedAt: stateData[i][11],
            round: parseInt(stateData[i][12]) || 1,
            alertSent: stateData[i][13]
          };
          break;
        }
      }

      const masterData = masterSheet.getRange(1, 1, masterSheet.getLastRow(), 21).getValues();
      // tKey IS the Job No. — direct column match, no hash recomputation needed.
            let bestDateVal = null;
      for (let i = 4; i < masterData.length; i++) {
        const rowJobNo = String(masterData[i][CONFIG.MASTER_COL_JOB_NO] || '').trim();
        if (rowJobNo !== tKey) continue;
        const rowDateVal = masterData[i][5];
        const isNewer = masterRowIdx === -1 ||
          (rowDateVal instanceof Date && (!(bestDateVal instanceof Date) || rowDateVal >= bestDateVal));
        if (isNewer) {
          masterRowIdx = i + 1;
          bestDateVal = rowDateVal;
          taskName = String(masterData[i][CONFIG.MASTER_COL_TASK_NAME] || '').trim();
          workerName = String(masterData[i][CONFIG.MASTER_COL_OWNER_A] || masterData[i][CONFIG.MASTER_COL_OWNER_N] || '').trim();
          brand = String(masterData[i][CONFIG.MASTER_COL_BRAND] || '').trim();
          jobId = rowJobNo;
          taskDateVal = rowDateVal;
        }
      }
      if (taskName === 'ไม่ระบุชื่อ' && row && row !== 'undefined') {
         // Fallback to rowNum if Job No. lookup somehow missed
         const r = parseInt(row);
         if (r >= 5 && r <= masterData.length) {
           const fallbackData = masterData[r - 1]; // masterData starts from row 1, so index is r - 1.
           if (fallbackData) {
             tKey = String(fallbackData[CONFIG.MASTER_COL_JOB_NO] || '').trim() || tKey;
             masterRowIdx = r;
             taskName = String(fallbackData[CONFIG.MASTER_COL_TASK_NAME] || 'ไม่ระบุชื่อ').trim();
             workerName = String(fallbackData[CONFIG.MASTER_COL_OWNER_A] || fallbackData[CONFIG.MASTER_COL_OWNER_N] || 'ไม่ระบุ').trim();
             brand = String(fallbackData[CONFIG.MASTER_COL_BRAND] || '').trim();
             jobId = tKey;
             taskDateVal = fallbackData[5]; // Col F (วันที่ส่งงาน)

             // Try to find the (possibly updated) key in stateData
             for (let i = 1; i < stateData.length; i++) {
               if (stateData[i][0] === tKey) {
                 stateRowIdx = i + 1;
                 st = {
                   reviewStatus: stateData[i][9],
                   sentAt: stateData[i][10],
                   reviewedAt: stateData[i][11],
                   round: parseInt(stateData[i][12]) || 1,
                   alertSent: stateData[i][13]
                 };
                 break;
               }
             }
           }
         }
      }

      if (taskName === 'ไม่ระบุชื่อ') {
         const parts = tKey.split("::");
         if (parts.length >= 3) {
           jobId = parts[0];
           taskName = parts[1];
           workerName = parts[2];
         }
      }
      if (st) sentAtVal = st.sentAt;

    } else if (row && row !== 'undefined') {
       const r = parseInt(row);
       const rowData = masterSheet.getRange(r, 1, 1, 21).getValues()[0];
       tKey = String(rowData[CONFIG.MASTER_COL_JOB_NO] || '').trim();
       masterRowIdx = r;
       taskName = String(rowData[CONFIG.MASTER_COL_TASK_NAME] || 'ไม่ระบุชื่อ').trim();
       workerName = String(rowData[CONFIG.MASTER_COL_OWNER_A] || rowData[CONFIG.MASTER_COL_OWNER_N] || 'ไม่ระบุ').trim();
       brand = String(rowData[CONFIG.MASTER_COL_BRAND] || '').trim();
       jobId = tKey;
       taskDateVal = rowData[5]; // Col F (วันที่ส่งงาน)

       const stateData = stateSheet.getDataRange().getValues();
       for (let i = 1; i < stateData.length; i++) {
         if (stateData[i][0] === tKey) {
           stateRowIdx = i + 1;
           st = {
             reviewStatus: stateData[i][9],
             sentAt: stateData[i][10],
             reviewedAt: stateData[i][11],
             round: parseInt(stateData[i][12]) || 1,
             alertSent: stateData[i][13]
           };
           break;
         }
       }
       sentAtVal = st ? st.sentAt : masterSheet.getRange(r, 18).getValue();
    } else {
       replyText(replyToken, "❌ ข้อมูลไม่ครบถ้วน (Missing Row or TaskKey)");
       return;
    }

    const currentReviewStatus = st ? st.reviewStatus : "";

    if (currentReviewStatus === "มีปรับแก้" || currentReviewStatus === "อนุมัติแล้ว" || currentReviewStatus === "Done") {
      replyText(replyToken, "⚠️ งานไม่สามารถกดซ้ำ");
      return;
    }

    const now = new Date();
    const isApproved = (newStatus === "Done" || newStatus === "อนุมัติแล้ว");
    const newStatusStr = isApproved ? "อนุมัติแล้ว" : "มีปรับแก้";

    // Update Master Sheet directly (Col Q to U)
    if (masterRowIdx > -1) {
      masterSheet.getRange(masterRowIdx, 17).setValue(newStatusStr);
      masterSheet.getRange(masterRowIdx, 19).setValue(now);
      masterSheet.getRange(masterRowIdx, 21).setValue("REVIEWED");
    }

    // Approve cascades: flip every OTHER row sharing this Job No. to Done too.
    if ((isApproved || newStatusStr === "มีปรับแก้") && tKey) {
      const cascadeStatus = isApproved ? "อนุมัติแล้ว" : "มีปรับแก้";
      const cascadeGraphicStatus = isApproved ? "Done" : "มีปรับแก้";
      const allMasterData = masterSheet.getRange(1, 1, masterSheet.getLastRow(), 21).getValues();
      for (let i = 4; i < allMasterData.length; i++) {
        if ((i + 1) === masterRowIdx) continue;
        const otherJobNo = String(allMasterData[i][CONFIG.MASTER_COL_JOB_NO] || '').trim();
        if (otherJobNo !== tKey) continue;
        const otherRowNum = i + 1;
        masterSheet.getRange(otherRowNum, 17).setValue(cascadeStatus);
        masterSheet.getRange(otherRowNum, 19).setValue(now);
        masterSheet.getRange(otherRowNum, 21).setValue("REVIEWED");
        const otherOwnerA = String(allMasterData[i][CONFIG.MASTER_COL_OWNER_A] || '').trim();
        const otherOwnerN = String(allMasterData[i][CONFIG.MASTER_COL_OWNER_N] || '').trim();
        const otherWorker = otherOwnerA || otherOwnerN || 'ไม่ระบุ';
        syncToIndividualSheet(tKey, taskName, otherWorker, otherWorker, cascadeGraphicStatus, allMasterData[i][5]);
      }
    }
    // Update AD_REVIEW_QUEUE
   if (stateRowIdx > 1) {
   if (isApproved) {
      stateSheet.getRange(stateRowIdx, 9).setValue("Done");
      stateSheet.getRange(stateRowIdx, 10).setValue("อนุมัติแล้ว"); // Review Status
      stateSheet.getRange(stateRowIdx, 12).setValue(now);           // Reviewed At
      stateSheet.getRange(stateRowIdx, 14).setValue("REVIEWED");    // Alert Sent
   } else {
      stateSheet.getRange(stateRowIdx, 10).setValue(newStatusStr);
      stateSheet.getRange(stateRowIdx, 12).setValue(now);
      stateSheet.getRange(stateRowIdx, 14).setValue("REVIEWED");
   }
} else if (!isApproved) {
       // Rarely happens, let syncMasterQueueStatus pick it up
    }
    SpreadsheetApp.flush();

    syncToIndividualSheet(jobId, taskName, workerName, workerName, newStatus, taskDateVal);

    CacheService.getScriptCache().remove(CACHE_KEY);

    const durationStr = formatDurationString(sentAtVal, now);
    replyReviewResultFlex(replyToken, taskName, workerName, brand, isApproved, durationStr);

  } catch (err) {
    replyText(replyToken, `❌ เกิดข้อผิดพลาดในการอัปเดต: ${err.message}`);
  }
}

function fixBackendDates() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const stateSheet = getStateSheet(ss);
    const stateData = stateSheet.getDataRange().getValues();
    const masterSheet = getMasterRawDataSheet();
    const masterData = masterSheet.getDataRange().getValues();

    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let fixedCount = 0;

    for (let i = 1; i < stateData.length; i++) {
      const status = stateData[i][1];
      if (status === "อนุมัติแล้ว" || status === "Done") {
        const reviewedAt = stateData[i][3];
        if (reviewedAt && reviewedAt instanceof Date && reviewedAt >= today) {
          const tKey = stateData[i][0];
          let realSentAt = null;
          for (let r = 4; r < masterData.length; r++) {
             const rKey = String(masterData[r][CONFIG.MASTER_COL_JOB_NO] || '').trim();
             if (rKey === tKey) {
                realSentAt = masterData[r][5];
                break;
             }
          }
          if (realSentAt && realSentAt instanceof Date && realSentAt < yesterday) {
             stateSheet.getRange(i + 1, 4).setValue(realSentAt);
             fixedCount++;
          } else if (!realSentAt) {
             const pastDate = new Date(); pastDate.setDate(pastDate.getDate() - 10);
             stateSheet.getRange(i + 1, 4).setValue(pastDate);
             fixedCount++;
          }
        }
      }
    }
    CacheService.getScriptCache().remove(CACHE_KEY);
    return "Fixed " + fixedCount + " rows";
  } catch(e) {
    return e.message;
  }
}


function replyTaskStatus(replyToken, taskId) {
  const sheet = getMasterRawDataSheet();
  if (!sheet) { replyText(replyToken, "❌ ไม่พบ Master Sheet"); return; }

  const data = sheet.getDataRange().getValues();
  let found = false;
  let responseText = "";

  for (let i = 4; i < data.length; i++) {
    const row = data[i];
    const jobNo = String(row[CONFIG.MASTER_COL_JOB_NO] || '').trim();
    if (jobNo === taskId) {
      const taskName = row[CONFIG.MASTER_COL_TASK_NAME] || 'ไม่ระบุชื่อ';
      const owner = row[CONFIG.MASTER_COL_OWNER_A] || row[CONFIG.MASTER_COL_OWNER_N] || 'ไม่ระบุ';
      const status = row[CONFIG.MASTER_COL_REVIEW_STATUS] || row[CONFIG.MASTER_COL_STATUS] || 'ยังไม่เริ่ม';
      responseText = `📌 ชิ้นงาน: ${taskName}\n👤 คนทำงาน: ${owner}\n🔄 สถานะรีวิว: ${status}`;
      found = true;
      break;
    }
  }

  if (!found) responseText = `❌ ไม่พบรหัสงาน "${taskId}" ในระบบครับ`;
  replyText(replyToken, responseText);
}

function replySummaryTasks(replyToken) {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  const stateSheet = getStateSheet(ss);
  if (!stateSheet) { replyText(replyToken, "❌ ไม่พบ State Sheet"); return; }

  const data = stateSheet.getDataRange().getValues();
  let summary = "📋 สรุปงานรอรีวิวทั้งหมด:\n";
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const revStatus = String(data[i][9] || '').trim(); // Review Status
    const status = String(data[i][8] || '').trim(); // Graphic Status
    if (revStatus === "รอรีวิว" || status.toLowerCase() === "sent to p'aof") {
      const taskName = data[i][3] || 'ไม่ระบุชื่อ';
      const owner = data[i][4] || 'ไม่ระบุ';
      const round = data[i][12] || 1;
      summary += `• [${owner}] ${taskName} (รอบที่ ${round})\n`;
      count++;
    }
  }

  if (count === 0) summary = "🎉 ตอนนี้ไม่มีงานรอรีวิวเลยครับ!";
  replyText(replyToken, summary);
}

function replyText(replyToken, text) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const payload = { replyToken: replyToken, messages: [{ type: 'text', text: text }] };
  const options = {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify(payload)
  };
  try { UrlFetchApp.fetch(url, options); } catch(e) {}
}

function replyFlexMessage(replyToken, altText, contents) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const payload = { replyToken: replyToken, messages: [{ type: 'flex', altText: altText, contents: contents }] };
  const options = {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify(payload)
  };
  try { UrlFetchApp.fetch(url, options); } catch(e) {}
}

// Returns { ok, code, body } so callers can tell a real delivery from a silent failure.
// Never throws — a LINE outage must not abort syncMasterQueueStatus.

function pushLineFlexMessage(altText, contents) {
  if (!CONFIG.LINE_GROUP_ID) return { ok: false, code: 0, body: 'LINE_GROUP_ID not set' };
  if (!CONFIG.LINE_CHANNEL_ACCESS_TOKEN) return { ok: false, code: 0, body: 'LINE_CHANNEL_ACCESS_TOKEN not set' };
  const url = 'https://api.line.me/v2/bot/message/push';
  const targetIds = CONFIG.LINE_GROUP_ID.split(',').map(s => s.trim()).filter(s => s);
  const results = targetIds.map(id => {
    const payload = { to: id, messages: [{ type: 'flex', altText: altText, contents: contents }] };
    const options = {
      method: 'post',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    try {
      const resp = UrlFetchApp.fetch(url, options);
      const code = resp.getResponseCode();
      const body = resp.getContentText();
      if (code !== 200) console.error('LINE push failed for ' + id + ' ' + code + ': ' + body);
      return { ok: code === 200, code: code, body: body };
    } catch (e) {
      console.error('LINE push threw for ' + id + ': ' + e.message);
      return { ok: false, code: 0, body: e.message };
    }
  });
  return { ok: results.some(r => r.ok), code: results[0] ? results[0].code : 0, body: JSON.stringify(results) };
}

function getDebugData() {
  try {
    const sheet = getMasterRawDataSheet();
    const data = sheet.getDataRange().getValues();
    return ContentService.createTextOutput(JSON.stringify({ rowCount: data.length, headers: data[3] }, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(err.message);
  }
}

// ============================================================
// 9. Triggers Setup (Instant Master Sheet & Web App Direct Triggers)
// ============================================================
function setupTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      ScriptApp.deleteTrigger(triggers[i]);
    }

    const masterSheet = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);

    // (1) 1-Minute Time-driven Trigger for IMPORTRANGE status sync & LINE push
    ScriptApp.newTrigger('syncMasterQueueStatus')
      .timeBased()
      .everyMinutes(1)
      .create();

    // (2) Instant OnChange Trigger for direct master sheet updates
    ScriptApp.newTrigger('onTaskStatusChange')
      .forSpreadsheet(masterSheet)
      .onChange()
      .create();

    // (3) Instant OnEdit Trigger for manual user edits
    ScriptApp.newTrigger('onTaskStatusChange')
      .forSpreadsheet(masterSheet)
      .onEdit()
      .create();

    // (3) Daily summary triggers at 09:30 and 17:00
    ScriptApp.newTrigger('pushDailySummary')
      .timeBased()
      .atHour(9)
      .nearMinute(30)
      .everyDays(1)
      .create();

    ScriptApp.newTrigger('pushDailySummary')
      .timeBased()
      .atHour(17)
      .everyDays(1)
      .create();

    return ContentService.createTextOutput(`ตั้งค่า Trigger สำหรับ Master Sheet ใหม่ครบทั้งเซ็ตเรียบร้อยแล้ว! 🚀\n(1) ล้าง Trigger เก่าทั้งหมดออกเรียบร้อย\n(2) ระบบสแกนพื้นหลัง IMPORTRANGE & เด้ง LINE (ทุกๆ 1 นาที)\n(3) ระบบตอบสนองทันทีบนตาราง Master (onChange & onEdit)\n(4) สรุปงานประจำวัน 09:30 น. และ 17:00 น.`);
  } catch (err) {
    return ContentService.createTextOutput('Error: ' + err.message);
  }
}

// ============================================================
// แพตช์ที่ 1 — แทนที่ pushDailySummary() เดิมทั้งฟังก์ชัน ด้วยอันนี้
// เช้า: เตือนเสมอ (kickoff ประจำวัน แม้ไม่มีงานค้าง)
// เย็น: เตือนเฉพาะถ้ายังมีงานค้างรีวิวจริง (กันกองงาน)
// ============================================================
function pushDailySummary() {
  if (PropertiesService.getScriptProperties().getProperty('MAINTENANCE_MODE') === 'true') return;
  const day = new Date().getDay();
  if (day === 0 || day === 6) return;

  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  const stateSheet = getStateSheet(ss);
  if (!stateSheet) return;

  const stateData = stateSheet.getDataRange().getValues();
  let pendingTasks = [];

  // AD_REVIEW_QUEUE has headers on row 1, data starts at index 1
  for (let i = 1; i < stateData.length; i++) {
    const graphicStatus = String(stateData[i][8] || '').trim().toLowerCase();
    const reviewStatus = String(stateData[i][9] || '').trim();

    // Only include tasks waiting for P'Aof's review
    if (reviewStatus === "รอรีวิว" || graphicStatus === "sent to p'aof") {
      const taskName = stateData[i][3] || 'ไม่ระบุชื่อ';
      const owner = stateData[i][4] || 'ไม่ระบุ';
      pendingTasks.push(`• [${owner}] ${taskName}`);
    }
  }

  const hour = new Date().getHours();
  const isEvening = hour >= 12;

  // เย็น: ไม่มีงานค้าง = ไม่ต้องเตือน (กันสแปม) — เช้า: เตือนเสมอ ไม่ว่าจะมีงานค้างหรือไม่
  if (isEvening && pendingTasks.length === 0) return;

  const titleText = isEvening ? "🌇 งานรอรีวิวเย็นนี้" : "🌅 งานรอรีวิวเช้านี้";

  let bodyContents;
  if (pendingTasks.length === 0) {
    // เกิดได้เฉพาะตอนเช้าเท่านั้น (เย็น return ไปแล้วถ้าว่าง)
    bodyContents = [
      { type: "text", text: "🎉 ไม่มีงานค้างรีวิวตอนนี้", weight: "bold", size: "md", color: "#22A06B" }
    ];
  } else {
    let taskListContents = pendingTasks.slice(0, 5).map(t => ({
      type: "text", text: t, size: "sm", color: "#555555", wrap: true
    }));
    if (pendingTasks.length > 5) {
      taskListContents.push({ type: "text", text: `...และอีก ${pendingTasks.length - 5} งาน`, size: "sm", color: "#aaaaaa", style: "italic", margin: "sm" });
    }

    bodyContents = [
      {
        type: "box", layout: "horizontal",
        contents: [
          { type: "text", text: "📋 งานที่ต้องตรวจ:", color: "#aaaaaa", size: "sm", flex: 2 },
          { type: "text", text: `${pendingTasks.length} งาน`, weight: "bold", size: "sm", color: "#333333", align: "end", flex: 1 }
        ]
      },
      { type: "separator", margin: "md" },
      { type: "text", text: "รายชื่องาน:", weight: "bold", size: "sm", margin: "md" },
      ...taskListContents
    ];
  }

  const flexContents = {
    type: "bubble",
    header: {
      type: "box", layout: "vertical", backgroundColor: "#378ADD",
      contents: [{ type: "text", text: titleText, weight: "bold", color: "#ffffff", size: "lg" }]
    },
    body: {
      type: "box", layout: "vertical", spacing: "md",
      contents: bodyContents
    }
  };
  pushLineFlexMessage(titleText, flexContents);
}
// ============================================================
// ONE-TIME FIX: Corrupted April 8th Dates
// ============================================================
function fixCorruptDates() {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  const sheet = ss.getSheetByName('?? RAW DATA');
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  const rangeR = sheet.getRange(5, 18, lastRow - 4, 1);
  const rangeS = sheet.getRange(5, 19, lastRow - 4, 1);
  const valsR = rangeR.getValues();
  const valsS = rangeS.getValues();

  let changes = 0;
  for (let i = 0; i < valsR.length; i++) {
    const dR = valsR[i][0];
    if (dR instanceof Date && dR.getMonth() === 3 && dR.getDate() === 8 && dR.getFullYear() === 2026) {
      // It's April 8, 2026. Change it to August 4, 2026 keeping time intact
      const newD = new Date(dR);
      newD.setMonth(7); // 7 is August
      newD.setDate(4);
      valsR[i][0] = newD;
      changes++;
    }
    const dS = valsS[i][0];
    if (dS instanceof Date && dS.getMonth() === 3 && dS.getDate() === 8 && dS.getFullYear() === 2026) {
      const newD = new Date(dS);
      newD.setMonth(7); // 7 is August
      newD.setDate(4);
      valsS[i][0] = newD;
      changes++;
    }
  }
  if (changes > 0) {
    rangeR.setValues(valsR);
    rangeS.setValues(valsS);
    CacheService.getScriptCache().remove(CACHE_KEY);
  }
  console.log("Fixed " + changes + " corrupted dates.");
}

﻿function forceWriteV() {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.MASTER_SHEET_NAME) || ss.getSheets()[0];
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(1, 1, lastRow, 21).getValues();
  let count = 0;
  for (let i = 4; i < data.length; i++) {
    const row = data[i];
    const taskName = String(row[12] || '').trim();
    if (!taskName) continue;
    const taskKey = ensureJobNo(row, i + 1, sheet);
    if (!taskKey) continue;
    sheet.getRange(i+1, 22).setValue(taskKey);
    count++;
  }
  return "Forced " + count + " rows";
}
