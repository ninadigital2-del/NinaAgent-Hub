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
  LINE_GROUP_ID: 'C73656d16402ca46690a9ef39b9382bfd',
  
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

const CACHE_KEY = "AD_REVIEW_QUEUE_TASKS_v30";

// Helper to get or create the Backend_State sheet
function getStateSheet(ss) {
  let stateSheet = ss.getSheetByName("Backend_State");
  if (!stateSheet) {
    stateSheet = ss.insertSheet("Backend_State");
    stateSheet.hideSheet();
    stateSheet.appendRow(["TaskKey", "Review Status", "Sent At", "Reviewed At", "Round", "Alert Sent"]);
    stateSheet.getRange("A1:F1").setFontWeight("bold");
    stateSheet.setFrozenRows(1);
  }
  return stateSheet;
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
  
  if (action === 'fixBackendDates') {
    const res = fixBackendDates();
    return ContentService.createTextOutput(res);
  }

  if (action === 'syncNow') {
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
  
  if (action === 'fixDates') {
    fixCorruptDates();
    return ContentService.createTextOutput("Fixed");
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
// 4. Automatic Sync for Master Sheet (GEM_Graphic_Master)
// Always process active tasks (Sent to P'Aof / มีปรับแก้ / รอรีวิว) regardless of date
// ============================================================
function syncMasterQueueStatus() {
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

    // Get today and yesterday for filtering TaskKey display in Col V
    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const stateData = stateSheet.getDataRange().getValues();
    
    // Map existing state
    const stateMap = {};
    for (let i = 1; i < stateData.length; i++) {
      const tKey = String(stateData[i][0]).trim();
      if (!tKey) continue;
      stateMap[tKey] = {
        rowIdx: i + 1, // 1-based row in stateSheet
        reviewStatus: String(stateData[i][1] || '').trim(),
        sentAt: stateData[i][2],
        reviewedAt: stateData[i][3],
        round: parseInt(stateData[i][4]) || 1,
        alertSent: String(stateData[i][5] || '').trim()
      };
    }
    
    const now = new Date();
    const todayStr = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
    let hasChanges = false;
    let stateSheetChanges = false;

    const newStatesToAppend = [];

    for (let i = 4; i < data.length; i++) {
      const rowNum = i + 1;
      const row = data[i];
      const taskName = String(row[CONFIG.MASTER_COL_TASK_NAME] || '').trim();
      if (!taskName) continue;

      const START_DATE = "2026-07-20";
      const dateVal = row[5]; 
      const taskDateStr = parseTaskDateString(dateVal);
      if (taskDateStr && taskDateStr < START_DATE) {
        continue; 
      }

      const jobId = String(row[CONFIG.MASTER_COL_JOB_NO] || '').trim();
      const workerName = String(row[CONFIG.MASTER_COL_OWNER_A] || row[CONFIG.MASTER_COL_OWNER_N] || 'ไม่ระบุ').trim();
      const taskKey = `${jobId}::${taskName}::${workerName}`;

      let st = stateMap[taskKey];
      let isNewTask = false;
      if (!st) {
        st = { rowIdx: -1, reviewStatus: "", sentAt: "", reviewedAt: "", round: 1, alertSent: "" };
        stateMap[taskKey] = st;
        isNewTask = true;
      }

      const graphicStatus = String(row[CONFIG.MASTER_COL_STATUS] || '').trim();
      const normVal = graphicStatus.toLowerCase().replace(/’/g, "'");

      let updatedSt = false;

      // 1. Strict Override Rule: If Col B is Done / OK / อนุมัติแล้ว
      if (normVal === "done" || normVal === "ok" || normVal === "อนุมัติแล้ว") {
        if (st.reviewStatus !== "อนุมัติแล้ว") {
          st.reviewStatus = "อนุมัติแล้ว";
          if (!st.reviewedAt) {
            // Fix: Don't use "now" for old tasks, use sentAt or fallback to past date
            const dateVal = row[5];
            if (dateVal && dateVal instanceof Date) {
              st.reviewedAt = dateVal;
            } else {
              st.reviewedAt = now;
            }
          }
          st.alertSent = "REVIEWED";
          updatedSt = true;
        }
      } 
      // Skip past dates BEFORE today IF already approved or inactive
      else if (taskDateStr && taskDateStr < todayStr) {
        const isActiveTask = (normVal === "sent to p'aof" || normVal === "มีปรับแก้" || st.reviewStatus === "รอรีวิว" || st.reviewStatus === "มีปรับแก้");
        if (st.reviewStatus === "อนุมัติแล้ว" || !isActiveTask) {
           continue;
        }
      }

      if (normVal === "sent to p'aof") {
        if (st.reviewStatus !== "อนุมัติแล้ว") {
          let newRound = st.round;
          if (st.reviewStatus === "มีปรับแก้") {
            newRound = st.round + 1;
          } else if (st.reviewStatus === "") {
            newRound = 1;
          }

          const alertKey = "SENT_R" + newRound;

          if (st.reviewStatus !== "รอรีวิว" || (st.alertSent !== alertKey && st.alertSent !== "WAIT_SENT")) {
            st.reviewStatus = "รอรีวิว";
            st.sentAt = now;
            st.reviewedAt = "";
            st.round = newRound;
            st.alertSent = "WAIT_SENT";
            updatedSt = true;
          }

          if (st.alertSent === "WAIT_SENT" || (st.alertSent !== alertKey && st.alertSent !== "REVIEWED")) {
            if (isNewTask) {
              stateSheet.appendRow([taskKey, st.reviewStatus, st.sentAt, st.reviewedAt, st.round, st.alertSent]);
              st.rowIdx = stateSheet.getLastRow();
              isNewTask = false;
            } else if (st.rowIdx > 1) {
              stateSheet.getRange(st.rowIdx, 2, 1, 5).setValues([[st.reviewStatus, st.sentAt, st.reviewedAt, st.round, st.alertSent]]);
            }
            SpreadsheetApp.flush(); 

            // Pass taskKey instead of rowNum
            sendLineReviewAlert(taskName, workerName, st.round, taskKey, CONFIG.MASTER_SHEET_ID);
            
            st.alertSent = alertKey;
            updatedSt = true;
          } else if (!st.sentAt) {
            st.sentAt = now;
            updatedSt = true;
          }
        }
      } else if (normVal === "มีปรับแก้") {
        if (st.reviewStatus !== "มีปรับแก้") {
          st.reviewStatus = "มีปรับแก้";
          st.reviewedAt = now;
          st.alertSent = "REVIEWED";
          updatedSt = true;
        }
      } else if (normVal === "not start" || normVal === "") {
        if (st.reviewStatus === "รอรีวิว" || st.reviewStatus === "มีปรับแก้") {
          st.reviewStatus = "";
          st.alertSent = "";
          updatedSt = true;
        }
      }

      if (updatedSt) {
        if (isNewTask) {
          newStatesToAppend.push([taskKey, st.reviewStatus, st.sentAt, st.reviewedAt, st.round, st.alertSent]);
          isNewTask = false;
        } else if (st.rowIdx > 1) {
          stateSheet.getRange(st.rowIdx, 2, 1, 5).setValues([[st.reviewStatus, st.sentAt, st.reviewedAt, st.round, st.alertSent]]);
        }
        stateSheetChanges = true;
      }

      // Repaint Col Q-V in Master Sheet
      const currentQ = String(row[16] || '');
      const currentR = String(row[17] || '');
      const currentS = String(row[18] || '');
      const currentT = String(row[19] || '');
      const currentU = String(row[20] || '');
      const currentV = String(row[21] || '');

      const newQ = st.reviewStatus;
      const newR = (st.sentAt && st.sentAt instanceof Date) ? Utilities.formatDate(st.sentAt, "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss") : st.sentAt;
      const newS = (st.reviewedAt && st.reviewedAt instanceof Date) ? Utilities.formatDate(st.reviewedAt, "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss") : st.reviewedAt;
      const newT = String(st.round);
      const newU = st.alertSent;
      
      let shouldShowId = false;
      const taskDateVal = row[5];
      if (taskDateVal && taskDateVal instanceof Date && taskDateVal >= yesterday) shouldShowId = true;
      else if (st.sentAt && st.sentAt instanceof Date && st.sentAt >= yesterday) shouldShowId = true;
      else if (!taskDateVal && !st.sentAt) shouldShowId = true;

      const newV = shouldShowId ? taskKey : "";

      if (currentQ !== newQ || currentR !== newR || currentS !== newS || currentT !== newT || currentU !== newU || currentV !== newV) {
        sheet.getRange(rowNum, 17, 1, 6).setValues([[
          newQ, 
          st.sentAt || "", 
          st.reviewedAt || "", 
          newT, 
          newU,
          newV
        ]]);
        hasChanges = true;
      }
    }

    if (newStatesToAppend.length > 0) {
      stateSheet.getRange(stateSheet.getLastRow() + 1, 1, newStatesToAppend.length, 6).setValues(newStatesToAppend);
      stateSheetChanges = true;
    }

    if (hasChanges || stateSheetChanges) {
      CacheService.getScriptCache().remove(CACHE_KEY);
    }
  } catch (err) {
    console.error("syncMasterQueueStatus error: " + err.message);
  } finally {
    lock.releaseLock();
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
        sendLineReviewAlert(taskName, workerName, round, rowNum, CONFIG.MASTER_SHEET_ID);
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
    syncMasterQueueStatus();

    const cache = CacheService.getScriptCache();
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return cached;
    }

    const sheet = getMasterRawDataSheet();
    if (!sheet) return JSON.stringify({ success: true, tasks: [] });
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 5) return JSON.stringify({ success: true, tasks: [] });
    
    const data = sheet.getRange(1, 1, lastRow, 22).getValues();
    const tasks = [];
    const todayStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");

    // Header at row 4 (index 3), Data starts at row 5 (index 4)
    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      const taskName = String(row[CONFIG.MASTER_COL_TASK_NAME] || '').trim();
      if (!taskName) continue;

      const graphicStatus = String(row[CONFIG.MASTER_COL_STATUS] || '').trim();
      const normVal = graphicStatus.toLowerCase().replace(/’/g, "'");
      let reviewStatus = String(row[CONFIG.MASTER_COL_REVIEW_STATUS] || '').trim();

      // Auto mapping & strict override: If Col B is Done / OK, reviewStatus MUST be "อนุมัติแล้ว"
      if (normVal === "done" || normVal === "ok" || normVal === "อนุมัติแล้ว") {
        reviewStatus = "อนุมัติแล้ว";
      } else if (normVal === "not start" || normVal === "") {
        reviewStatus = graphicStatus || "Not Start";
      } else if (!reviewStatus) {
        if (normVal === "sent to p'aof") reviewStatus = "รอรีวิว";
        else if (graphicStatus === "มีปรับแก้") reviewStatus = "มีปรับแก้";
      }

      const isActiveTask = (normVal === "sent to p'aof" || normVal === "มีปรับแก้" || reviewStatus === "รอรีวิว" || reviewStatus === "มีปรับแก้");

      // STRICT BOUNDARY: ONLY fetch tasks starting from 20/07/2026 (20Jul26) onwards.
      const START_DATE = "2026-07-20";
      const dateVal = row[5]; // Col F (วันที่ส่งงาน)
      const taskDateStr = parseTaskDateString(dateVal);
      if (taskDateStr && taskDateStr < START_DATE) {
        continue; // Skip all tasks before July 20, 2026
      }

      let sentToReviewAtRaw = row[CONFIG.MASTER_COL_SENT_AT];
      let reviewedAtRaw = row[CONFIG.MASTER_COL_REVIEWED_AT];
      let revisionRound = parseInt(row[CONFIG.MASTER_COL_REVISION_ROUND]) || 1;

      if (!sentToReviewAtRaw && reviewStatus === "รอรีวิว") {
        if (row[5] instanceof Date) {
          sentToReviewAtRaw = row[5];
        }
      }

      let sentToReviewAt = "";
      const parsedSent = parseDateValue(sentToReviewAtRaw);
      if (parsedSent) {
        sentToReviewAt = parsedSent.toISOString();
      }

      let reviewedAt = "";
      let isToday = false;
      const parsedRev = parseDateValue(reviewedAtRaw);
      if (parsedRev) {
        reviewedAt = parsedRev.toISOString();
        const revStr = Utilities.formatDate(parsedRev, "Asia/Bangkok", "yyyy-MM-dd");
        isToday = (todayStr === revStr);
      }

      const workerName = String(row[CONFIG.MASTER_COL_OWNER_A] || row[CONFIG.MASTER_COL_OWNER_N] || 'ไม่ระบุ').trim();

      // Show "รอรีวิว", "มีปรับแก้", or "อนุมัติแล้ว" of today
      if (reviewStatus === "รอรีวิว" || reviewStatus === "มีปรับแก้" || (reviewStatus === "อนุมัติแล้ว" && isToday)) {
        const jId = String(row[CONFIG.MASTER_COL_JOB_NO] || '').trim();
        const tKey = `${jId}::${taskName}::${workerName}`;

        tasks.push({
          id: `master_${i+1}`,
          uniqueId: `master_${i+1}`,
          taskKey: tKey,
          name: taskName,
          owner: workerName,
          status: reviewStatus,
          graphicStatus: graphicStatus,
          brand: String(row[CONFIG.MASTER_COL_BRAND] || '').trim(),
          link: String(row[CONFIG.MASTER_COL_LINK] || '').trim(),
          deadline: (row[CONFIG.MASTER_COL_DEADLINE] instanceof Date) ? row[CONFIG.MASTER_COL_DEADLINE].toISOString() : String(row[CONFIG.MASTER_COL_DEADLINE] || ''),
          sentToReviewAt: sentToReviewAt,
          reviewedAt: reviewedAt,
          revisionRound: revisionRound
        });
      }
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

function updateTaskStatus(taskId, newStatus) {
  try {
    const sheet = getMasterRawDataSheet();
    if (!sheet) return JSON.stringify({ success: false, error: "ไม่พบแผ่นงานตารางหลัก" });
    
    ensureMasterHeaders();
    const data = sheet.getDataRange().getValues();
    let foundRow = -1;
    let taskName = '';
    let ownerA = '';
    let ownerN = '';

    const targetStr = String(taskId).trim();
    for (let i = 4; i < data.length; i++) {
      const uId = `master_${i+1}`;
      const jobNo = String(data[i][CONFIG.MASTER_COL_JOB_NO] || '').trim();
      
      if (targetStr === uId) {
        foundRow = i + 1;
        taskName = data[i][CONFIG.MASTER_COL_TASK_NAME] || 'ไม่ระบุชื่อ';
        ownerA = data[i][CONFIG.MASTER_COL_OWNER_A] || '';
        ownerN = data[i][CONFIG.MASTER_COL_OWNER_N] || '';
        break;
      }
    }
    
    if (foundRow > -1) {
      const now = new Date();
      const nowStr = Utilities.formatDate(now, "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
      const currentReviewStatus = String(sheet.getRange(foundRow, 17).getValue() || '').trim();
      const currentRound = parseInt(sheet.getRange(foundRow, 20).getValue()) || 1;

      if ((currentReviewStatus === "มีปรับแก้" || currentReviewStatus === "อนุมัติแล้ว") && newStatus !== "รอรีวิว") {
        return JSON.stringify({ 
          success: true, 
          taskName: taskName, 
          alreadyUpdated: true, 
          message: "งานไม่สามารถกดซ้ำ" 
        });
      }

      if (newStatus === "มีปรับแก้") {
        sheet.getRange(foundRow, 17).setValue("มีปรับแก้");      // Col Q (Review Status)
        sheet.getRange(foundRow, 19).setValue(now);           // Col S (Reviewed At)
        sheet.getRange(foundRow, 21).setValue("REVIEWED");      // Col U (LINE Alert Sent Status)
      } else if (newStatus === "อนุมัติแล้ว" || newStatus === "Done") {
        sheet.getRange(foundRow, 17).setValue("อนุมัติแล้ว");    // Col Q (Review Status)
        sheet.getRange(foundRow, 19).setValue(now);           // Col S (Reviewed At)
        sheet.getRange(foundRow, 21).setValue("REVIEWED");      // Col U (LINE Alert Sent Status)
      } else if (newStatus === "รอรีวิว" || newStatus === "Sent to P'Aof") {
        sheet.getRange(foundRow, 17).setValue("รอรีวิว");        // Col Q (Review Status)
        sheet.getRange(foundRow, 18).setValue(now);           // Col R (Sent to Review At)
        sheet.getRange(foundRow, 19).setValue("");               // Col S (Reviewed At cleared)
        if (currentReviewStatus !== "รอรีวิว") {
          sheet.getRange(foundRow, 20).setValue(currentRound + 1); // Col T (Revision Round) + 1
        }
      }

      // Sync status to Graphic designer's personal sheet (Col A)
      const taskDateVal = data[foundRow - 1][5]; // Col F (วันที่ส่งงาน)
      syncToIndividualSheet(taskId, taskName, ownerA, ownerN, newStatus, taskDateVal);

      // Invalidate Cache
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

    let bestMatchRow = -1;

    for (let i = data.length - 1; i >= 1; i--) {
      const rowNum = i + 1;
      const currentColA = String(data[i][0] || '').trim();
      const rowText = data[i].join(' ');
      const jobNo = String(data[i][9] || '').trim();
      const rowDateValD = data[i][3]; // Col D (Date in most templates)
      const rowDateValF = data[i][5]; // Col F (Date in some templates)
      const rowDateStrD = parseTaskDateString(rowDateValD);
      const rowDateStrF = parseTaskDateString(rowDateValF);
      
      const isNameMatch = (jobNo !== '' && targetIdStr === jobNo) || 
                          (targetTaskNameStr !== '' && rowText.indexOf(targetTaskNameStr) !== -1);
                          
      if (isNameMatch) {
        const normColA = currentColA.toLowerCase().replace(/’/g, "'");

        // If date matches strictly (checking both Col D and Col F), prioritize this row
        if (targetDateStr && (targetDateStr === rowDateStrD || targetDateStr === rowDateStrF)) {
          bestMatchRow = rowNum;
          break;
        }

        if (normColA === "sent to p'aof" || normColA === "รอรีวิว" || normColA === "มีปรับแก้") {
          if (bestMatchRow === -1) bestMatchRow = rowNum;
        } else if (bestMatchRow === -1) {
          bestMatchRow = rowNum;
        }
      }
    }

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

function sendLineReviewAlert(taskName, owner, round, row, spreadsheetId) {
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
            data: `action=updateStatus&row=${row}&sheetId=${spreadsheetId}&status=${encodeURIComponent("มีปรับแก้")}`
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
            data: `action=updateStatus&row=${row}&sheetId=${spreadsheetId}&status=${encodeURIComponent("Done")}`
          }
        }
      ]
    }
  };
  pushLineFlexMessage(`อัปเดตงาน "${taskName}" เป็น รอรีวิว`, flexContents);
}

// ============================================================
// 8. LINE Webhook Handling
// ============================================================
function handleLineWebhook(events) {
  events.forEach(event => {
    if (event.deliveryContext && event.deliveryContext.isRedelivery) return;
    if (event.type === 'message' && event.message.type === 'text') {
      handleTextMessage(event);
    } else if (event.type === 'postback') {
      handlePostback(event);
    }
  });
  return ContentService.createTextOutput('OK');
}

function handleTextMessage(event) {
  const replyToken = event.replyToken;
  const userMessage = event.message.text.trim();
  
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

﻿function updateSheetStatusFromPostback(replyToken, taskKey, row, sheetId, newStatus) {
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

    if (tKey && tKey !== 'undefined') {
      const stateData = stateSheet.getDataRange().getValues();
      for (let i = 1; i < stateData.length; i++) {
        if (stateData[i][0] === tKey) {
          stateRowIdx = i + 1;
          st = {
            reviewStatus: stateData[i][1],
            sentAt: stateData[i][2],
            reviewedAt: stateData[i][3],
            round: stateData[i][4],
            alertSent: stateData[i][5]
          };
          break;
        }
      }

      const masterData = masterSheet.getRange(1, 1, masterSheet.getLastRow(), 21).getValues();
      for (let i = 4; i < masterData.length; i++) {
        const jId = String(masterData[i][10] || '').trim();
        const tName = String(masterData[i][12] || '').trim();
        const wName = String(masterData[i][0] || masterData[i][13] || '').trim();
        const rKey = `${jId}::${tName}::${wName}`;
        if (rKey === tKey) {
          taskName = tName;
          workerName = wName;
          brand = String(masterData[i][11] || '').trim();
          jobId = jId;
          taskDateVal = masterData[i][15]; 
          break;
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
       taskName = masterSheet.getRange(r, 13).getValue() || 'ไม่ระบุชื่อ';
       const ownerA = masterSheet.getRange(r, 1).getValue() || '';
       const ownerN = masterSheet.getRange(r, 14).getValue() || '';
       workerName = String(ownerA || ownerN || 'ไม่ระบุ').trim();
       brand = masterSheet.getRange(r, 12).getValue() || '';
       jobId = masterSheet.getRange(r, 11).getValue() || `master_${r}`;
       taskDateVal = masterSheet.getRange(r, 16).getValue();
       tKey = `${jobId}::${taskName}::${workerName}`;

       const stateData = stateSheet.getDataRange().getValues();
       for (let i = 1; i < stateData.length; i++) {
         if (stateData[i][0] === tKey) {
           stateRowIdx = i + 1;
           st = {
             reviewStatus: stateData[i][1],
             sentAt: stateData[i][2],
             reviewedAt: stateData[i][3],
             round: stateData[i][4],
             alertSent: stateData[i][5]
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

    if (stateRowIdx > 1) {
      stateSheet.getRange(stateRowIdx, 2, 1, 5).setValues([[
        newStatusStr,
        st.sentAt,
        now,
        st.round,
        "REVIEWED"
      ]]);
    } else {
      stateSheet.appendRow([tKey, newStatusStr, sentAtVal, now, 1, "REVIEWED"]);
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
             const jId = String(masterData[r][10] || '').trim();
             const tName = String(masterData[r][12] || '').trim();
             const wName = String(masterData[r][0] || masterData[r][13] || '').trim();
             if (`${jId}::${tName}::${wName}` === tKey) {
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
    const jobNo = String(data[i][CONFIG.MASTER_COL_JOB_NO] || '').trim();
    if (jobNo === taskId) {
      const taskName = data[i][CONFIG.MASTER_COL_TASK_NAME] || 'ไม่ระบุชื่อ';
      const owner = data[i][CONFIG.MASTER_COL_OWNER_A] || data[i][CONFIG.MASTER_COL_OWNER_N] || 'ไม่ระบุ';
      const status = data[i][CONFIG.MASTER_COL_REVIEW_STATUS] || data[i][CONFIG.MASTER_COL_STATUS] || 'ยังไม่เริ่ม';
      responseText = `📌 ชิ้นงาน: ${taskName}\n👤 คนทำงาน: ${owner}\n🔄 สถานะรีวิว: ${status}`;
      found = true;
      break;
    }
  }

  if (!found) responseText = `❌ ไม่พบรหัสงาน "${taskId}" ในระบบครับ`;
  replyText(replyToken, responseText);
}

function replySummaryTasks(replyToken) {
  const sheet = getMasterRawDataSheet();
  if (!sheet) { replyText(replyToken, "❌ ไม่พบ Master Sheet"); return; }
  
  const data = sheet.getDataRange().getValues();
  let summary = "📋 สรุปงานรอรีวิวทั้งหมด:\n";
  let count = 0;

  for (let i = 4; i < data.length; i++) {
    const revStatus = String(data[i][CONFIG.MASTER_COL_REVIEW_STATUS] || '').trim();
    const status = String(data[i][CONFIG.MASTER_COL_STATUS] || '').trim();
    if (revStatus === "รอรีวิว" || status === "Sent to P'Aof") {
      const taskName = data[i][CONFIG.MASTER_COL_TASK_NAME] || 'ไม่ระบุชื่อ';
      const owner = data[i][CONFIG.MASTER_COL_OWNER_A] || data[i][CONFIG.MASTER_COL_OWNER_N] || 'ไม่ระบุ';
      const round = data[i][CONFIG.MASTER_COL_REVISION_ROUND] || 1;
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

function pushLineFlexMessage(altText, contents) {
  if (!CONFIG.LINE_GROUP_ID) return;
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = { to: CONFIG.LINE_GROUP_ID, messages: [{ type: 'flex', altText: altText, contents: contents }] };
  const options = {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify(payload)
  };
  try { UrlFetchApp.fetch(url, options); } catch(e) {}
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

function pushDailySummary() {
  const day = new Date().getDay();
  if (day === 0 || day === 6) return;

  const sheet = getMasterRawDataSheet();
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  let pendingTasks = [];
  const todayStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");

  for (let i = 4; i < data.length; i++) {
    const dateVal = data[i][5];
    const taskDateStr = parseTaskDateString(dateVal);
    const graphicStatus = String(data[i][CONFIG.MASTER_COL_STATUS] || '').trim();
    const normVal = graphicStatus.toLowerCase().replace(/’/g, "'");
    const revStatus = String(data[i][CONFIG.MASTER_COL_REVIEW_STATUS] || '').trim();
    const isActiveTask = (normVal === "sent to p'aof" || normVal === "มีปรับแก้" || revStatus === "รอรีวิว" || revStatus === "มีปรับแก้");

    if (taskDateStr && taskDateStr < todayStr && !isActiveTask) continue;

    if (revStatus === "รอรีวิว" || normVal === "sent to p'aof") {
      const taskName = data[i][CONFIG.MASTER_COL_TASK_NAME] || 'ไม่ระบุชื่อ';
      const owner = data[i][CONFIG.MASTER_COL_OWNER_A] || data[i][CONFIG.MASTER_COL_OWNER_N] || 'ไม่ระบุ';
      pendingTasks.push(`• [${owner}] ${taskName}`);
    }
  }

  if (pendingTasks.length === 0) return;

  let taskListContents = pendingTasks.slice(0, 5).map(t => ({
    type: "text", text: t, size: "sm", color: "#555555", wrap: true
  }));
  if (pendingTasks.length > 5) {
    taskListContents.push({ type: "text", text: `...และอีก ${pendingTasks.length - 5} งาน`, size: "sm", color: "#aaaaaa", style: "italic", margin: "sm" });
  }

  const hour = new Date().getHours();
  const titleText = hour < 12 ? "🌅 งานรอตรวจเช้านี้" : "🌇 งานรอตรวจเย็นนี้";

  const flexContents = {
    type: "bubble",
    header: {
      type: "box", layout: "vertical", backgroundColor: "#378ADD",
      contents: [{ type: "text", text: titleText, weight: "bold", color: "#ffffff", size: "lg" }]
    },
    body: {
      type: "box", layout: "vertical", spacing: "md",
      contents: [
        {
          type: "box", layout: "horizontal",
          contents: [
            { type: "text", text: "📤 งานที่ต้องตรวจ:", color: "#aaaaaa", size: "sm", flex: 2 },
            { type: "text", text: `${pendingTasks.length} งาน`, weight: "bold", size: "sm", color: "#333333", align: "end", flex: 1 }
          ]
        },
        { type: "separator", margin: "md" },
        { type: "text", text: "รายชื่องาน:", weight: "bold", size: "sm", margin: "md" },
        ...taskListContents
      ]
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
