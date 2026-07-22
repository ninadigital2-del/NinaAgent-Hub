// ============================================================
// Task Status Tracker — Google Apps Script (AD Review Queue)
// Master Sheet (Columns Q, R, S, T) & Sync to Individual Sheets
// Filter Today Onwards & Clear Past Retroactive Data
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
  
  // ตั้งค่า LINE
  LINE_CHANNEL_ACCESS_TOKEN: '0LdRnV4LLCmXBG8chf62N4WpIUHFkaEvJ/ljFjqbq6GbaqnLCVRqeiPZrhRJgsweUSvOM8TUbc9r500b+eviYoghG35l6qT+nxU+N6hqqODqCV7SEhCB/PRgMLJ1O0bB3ccg3dYy+XpNHX5RQdv0hwdB04t89/1O/w1cDnyilFU=',
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
  MASTER_COL_REVISION_ROUND: 19 // Col T (Revision Round)
};

const CACHE_KEY = "AD_REVIEW_QUEUE_TASKS_v21";

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
  
  if (action === 'syncNow') {
    syncMasterQueueStatus();
    return ContentService.createTextOutput("Synced successfully! GEM_Graphic_Master status checked, updated, and LINE alerts sent.");
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
  
  if (action === 'manual') {
    return HtmlService.createHtmlOutputFromFile('Manual')
      .setTitle('คู่มือการใช้งาน CREATIVE TEAM')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  if (action === 'debugTasks') {
    return getDebugData();
  }
  
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('คิวงานรอรีวิว - AD Review Queue')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Function to clear retroactive past data in Columns Q, R, S, T for rows before today
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

      // If task date is strictly before today, clear Col Q, R, S, T (17, 18, 19, 20)
      if (taskDateStr && taskDateStr < todayStr) {
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
    return `Cleared ${clearedCount} past retroactive rows before ${todayStr}`;
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
  
  if (hQ.getValue() !== "Review Status") hQ.setValue("Review Status");
  if (hR.getValue() !== "Sent to Review At") hR.setValue("Sent to Review At");
  if (hS.getValue() !== "Reviewed At") hS.setValue("Reviewed At");
  if (hT.getValue() !== "Revision Round") hT.setValue("Revision Round");

  sheet.getRange("R5:S2000").setNumberFormat("dd/mm/yyyy hh:mm:ss");
}

function parseDateValue(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();
  if (!str) return null;

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

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
  return null;
}

// ============================================================
// 4. Automatic Sync for Master Sheet (GEM_Graphic_Master)
// Processes Tasks starting from TODAY (Asia/Bangkok) onwards
// ============================================================
function syncMasterQueueStatus() {
  try {
    ensureMasterHeaders();
    const sheet = getMasterRawDataSheet();
    if (!sheet) return;
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 5) return;
    
    const data = sheet.getRange(1, 1, lastRow, 20).getValues();
    const now = new Date();
    const todayStr = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
    let hasChanges = false;

    // Header at row 4 (index 3), Data starts at row 5 (index 4)
    for (let i = 4; i < data.length; i++) {
      const rowNum = i + 1;
      const row = data[i];
      const taskName = String(row[CONFIG.MASTER_COL_TASK_NAME] || '').trim();
      if (!taskName) continue;

      // Filter: Only process tasks from TODAY onwards
      const dateVal = row[5]; // Col F (วันที่ส่งงาน)
      const taskDateStr = parseTaskDateString(dateVal);
      if (taskDateStr && taskDateStr < todayStr) {
        continue; // Skip past dates before today
      }

      const graphicStatus = String(row[CONFIG.MASTER_COL_STATUS] || '').trim();
      const normVal = graphicStatus.toLowerCase().replace(/’/g, "'");
      const currentReviewStatus = String(row[CONFIG.MASTER_COL_REVIEW_STATUS] || '').trim();
      const currentSentAt = row[CONFIG.MASTER_COL_SENT_AT];
      const currentReviewedAt = parseDateValue(row[CONFIG.MASTER_COL_REVIEWED_AT]);
      const currentRound = parseInt(row[CONFIG.MASTER_COL_REVISION_ROUND]) || 1;
      const workerName = String(row[CONFIG.MASTER_COL_OWNER_A] || row[CONFIG.MASTER_COL_OWNER_N] || 'ไม่ระบุ').trim();

      if (normVal === "sent to p'aof") {
        if (currentReviewStatus !== "รอรีวิว") {
          // Safeguard: If AD reviewed this task less than 2 minutes ago,
          // wait for IMPORTRANGE formula to catch up from Graphic's personal sheet
          if (currentReviewedAt && (now.getTime() - currentReviewedAt.getTime()) < 2 * 60 * 1000) {
            continue;
          }

          let newRound = currentRound;
          if (currentReviewStatus !== "") {
            newRound = currentRound + 1;
          }
          
          sheet.getRange(rowNum, 17).setValue("รอรีวิว"); // Col Q
          sheet.getRange(rowNum, 18).setNumberFormat("dd/mm/yyyy hh:mm:ss").setValue(now); // Col R
          sheet.getRange(rowNum, 19).setValue("");         // Col S (Reviewed At cleared)
          sheet.getRange(rowNum, 20).setValue(newRound);   // Col T (Revision Round)
          
          sendLineReviewAlert(taskName, workerName, newRound, rowNum, CONFIG.MASTER_SHEET_ID);
          hasChanges = true;
        } else if (!currentSentAt) {
          sheet.getRange(rowNum, 18).setNumberFormat("dd/mm/yyyy hh:mm:ss").setValue(now);
          hasChanges = true;
        }
      } else if (normVal === "มีปรับแก้") {
        if (currentReviewStatus !== "มีปรับแก้") {
          sheet.getRange(rowNum, 17).setValue("มีปรับแก้"); // Col Q
          sheet.getRange(rowNum, 19).setNumberFormat("dd/mm/yyyy hh:mm:ss").setValue(now); // Col S
          hasChanges = true;
        }
      } else if (normVal === "done" || normVal === "ok" || normVal === "อนุมัติแล้ว") {
        if (currentReviewStatus !== "อนุมัติแล้ว") {
          sheet.getRange(rowNum, 17).setValue("อนุมัติแล้ว"); // Col Q
          sheet.getRange(rowNum, 19).setNumberFormat("dd/mm/yyyy hh:mm:ss").setValue(now); // Col S
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      CacheService.getScriptCache().remove(CACHE_KEY);
    }
  } catch (err) {
    console.error("syncMasterQueueStatus error: " + err.message);
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
    
    const data = sheet.getRange(1, 1, lastRow, 20).getValues();
    const tasks = [];
    const todayStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");

    // Header at row 4 (index 3), Data starts at row 5 (index 4)
    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      const taskName = String(row[CONFIG.MASTER_COL_TASK_NAME] || '').trim();
      if (!taskName) continue;

      // Filter: Only return tasks from TODAY onwards
      const dateVal = row[5]; // Col F (วันที่ส่งงาน)
      const taskDateStr = parseTaskDateString(dateVal);
      if (taskDateStr && taskDateStr < todayStr) {
        continue; // Skip past dates before today
      }

      const graphicStatus = String(row[CONFIG.MASTER_COL_STATUS] || '').trim();
      let reviewStatus = String(row[CONFIG.MASTER_COL_REVIEW_STATUS] || '').trim();
      
      // Auto mapping if Review Status is empty
      if (!reviewStatus) {
        const norm = graphicStatus.toLowerCase().replace(/’/g, "'");
        if (norm === "sent to p'aof") reviewStatus = "รอรีวิว";
        else if (graphicStatus === "มีปรับแก้") reviewStatus = "มีปรับแก้";
        else if (graphicStatus === "Done" || graphicStatus === "OK") reviewStatus = "อนุมัติแล้ว";
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

      // Filter: Show "รอรีวิว", "มีปรับแก้", or "อนุมัติแล้ว" of today
      if (reviewStatus === "รอรีวิว" || reviewStatus === "มีปรับแก้" || (reviewStatus === "อนุมัติแล้ว" && isToday)) {
        tasks.push({
          id: String(row[CONFIG.MASTER_COL_JOB_NO] || `master_${i+1}`).trim(),
          uniqueId: `master_${i+1}`,
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

    const result = JSON.stringify({ success: true, tasks: tasks });
    try { cache.put(CACHE_KEY, result, 15); } catch(e) {}
    return result;
  } catch (err) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

// ============================================================
// 6. Update Task Status (จาก Dashboard หรือ API)
// ============================================================
function updateTaskFromWeb(taskId, newStatus, commentText) {
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
      
      if (targetStr === uId || (jobNo !== '' && targetStr === jobNo)) {
        foundRow = i + 1;
        taskName = data[i][CONFIG.MASTER_COL_TASK_NAME] || 'ไม่ระบุชื่อ';
        ownerA = data[i][CONFIG.MASTER_COL_OWNER_A] || '';
        ownerN = data[i][CONFIG.MASTER_COL_OWNER_N] || '';
        break;
      }
    }
    
    if (foundRow > -1) {
      const now = new Date();
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
        sheet.getRange(foundRow, 19).setNumberFormat("dd/mm/yyyy hh:mm:ss").setValue(now); // Col S (Reviewed At)
      } else if (newStatus === "อนุมัติแล้ว" || newStatus === "Done") {
        sheet.getRange(foundRow, 17).setValue("อนุมัติแล้ว");    // Col Q (Review Status)
        sheet.getRange(foundRow, 19).setNumberFormat("dd/mm/yyyy hh:mm:ss").setValue(now); // Col S (Reviewed At)
      } else if (newStatus === "รอรีวิว" || newStatus === "Sent to P'Aof") {
        sheet.getRange(foundRow, 17).setValue("รอรีวิว");        // Col Q (Review Status)
        sheet.getRange(foundRow, 18).setNumberFormat("dd/mm/yyyy hh:mm:ss").setValue(now); // Col R (Sent to Review At)
        sheet.getRange(foundRow, 19).setValue("");               // Col S (Reviewed At cleared)
        if (currentReviewStatus !== "รอรีวิว") {
          sheet.getRange(foundRow, 20).setValue(currentRound + 1); // Col T (Revision Round) + 1
        }
      }

      // Sync status to Graphic designer's personal sheet (Col A)
      syncToIndividualSheet(taskId, taskName, ownerA, ownerN, newStatus);

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
// Intelligent Bottom-Up Search prioritizing active 'Sent to P'Aof' rows
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

function syncToIndividualSheet(taskId, taskName, ownerA, ownerN, newStatus) {
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
      
      const isNameMatch = (jobNo !== '' && targetIdStr === jobNo) || 
                          (targetTaskNameStr !== '' && rowText.indexOf(targetTaskNameStr) !== -1);
                          
      if (isNameMatch) {
        const normColA = currentColA.toLowerCase().replace(/’/g, "'");
        if (normColA === "sent to p'aof" || normColA === "รอรีวิว" || normColA === "มีปรับแก้") {
          bestMatchRow = rowNum;
          break;
        } else if (bestMatchRow === -1) {
          bestMatchRow = rowNum;
        }
      }
    }

    if (bestMatchRow > -1) {
      sheet.getRange(bestMatchRow, 1).setValue(graphicStatusValue); // Col A in Graphic's sheet
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
            data: `action=updateStatus&row=${row}&sheetId=${spreadsheetId}&status=Done`
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
    updateSheetStatusFromPostback(replyToken, params.row, params.sheetId, params.status);
  }
}

// Helper to format review duration into "รีวิวใช้เวลา X ชม. Y น." or "รีวิวใช้เวลา X น."
function formatDurationString(sentAtVal, reviewedAtDate) {
  const sentAt = parseDateValue(sentAtVal);
  if (!sentAt || !reviewedAtDate) return `อัปเดตเมื่อ ${Utilities.formatDate(reviewedAtDate || new Date(), "Asia/Bangkok", "HH:mm น.")}`;
  
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
  const headerText = isApproved ? "✅ Approved" : "🔄 ส่งกลับแก้ไข";
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

function updateSheetStatusFromPostback(replyToken, row, sheetId, newStatus) {
  try {
    const masterSheet = getMasterRawDataSheet();
    if (!masterSheet) {
      replyText(replyToken, "❌ ไม่พบ Master Sheet");
      return;
    }

    const r = parseInt(row);
    const taskName = masterSheet.getRange(r, 13).getValue() || 'ไม่ระบุชื่อ';
    const ownerA = masterSheet.getRange(r, 1).getValue() || '';
    const ownerN = masterSheet.getRange(r, 14).getValue() || '';
    const brand = masterSheet.getRange(r, 12).getValue() || '';
    const jobId = masterSheet.getRange(r, 11).getValue() || `master_${r}`;
    const sentAtVal = masterSheet.getRange(r, 18).getValue();
    const workerName = String(ownerA || ownerN || 'ไม่ระบุ').trim();

    // Check current status in Col Q (17)
    const currentReviewStatus = String(masterSheet.getRange(r, 17).getValue() || '').trim();

    // Shortened Duplicate / Re-trigger Warning as requested: "⚠️ งานไม่สามารถกดซ้ำ"
    if (currentReviewStatus === "มีปรับแก้" || currentReviewStatus === "อนุมัติแล้ว") {
      replyText(replyToken, "⚠️ งานไม่สามารถกดซ้ำ");
      return;
    }

    const now = new Date();
    const isApproved = (newStatus === "Done" || newStatus === "อนุมัติแล้ว");

    if (newStatus === "มีปรับแก้") {
      masterSheet.getRange(r, 17).setValue("มีปรับแก้");      // Col Q (Review Status)
      masterSheet.getRange(r, 19).setNumberFormat("dd/mm/yyyy hh:mm:ss").setValue(now); // Col S (Reviewed At)
    } else if (isApproved) {
      masterSheet.getRange(r, 17).setValue("อนุมัติแล้ว");    // Col Q (Review Status)
      masterSheet.getRange(r, 19).setNumberFormat("dd/mm/yyyy hh:mm:ss").setValue(now); // Col S (Reviewed At)
    }

    // Sync status back to Graphic designer's personal sheet
    syncToIndividualSheet(jobId, taskName, ownerA, ownerN, newStatus);

    CacheService.getScriptCache().remove(CACHE_KEY);

    // Format review duration string (e.g. "รีวิวใช้เวลา 1 ชม. 30 น.")
    const durationStr = formatDurationString(sentAtVal, now);

    // Send clean Flex Message WITHOUT buttons in reply
    replyReviewResultFlex(replyToken, taskName, workerName, brand, isApproved, durationStr);
  } catch (err) {
    replyText(replyToken, `❌ เกิดข้อผิดพลาดในการอัปเดต: ${err.message}`);
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
// 9. Triggers Setup
// ============================================================
function setupTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
    
    const masterSheet = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    
    // (1) 1-Minute Time-driven Trigger for IMPORTRANGE status sync & Line alerts
    ScriptApp.newTrigger('syncMasterQueueStatus')
      .timeBased()
      .everyMinutes(1)
      .create();

    // (2) OnChange Trigger for spreadsheet updates
    ScriptApp.newTrigger('syncMasterQueueStatus')
      .forSpreadsheet(masterSheet)
      .onChange()
      .create();

    // (3) OnEdit Trigger for manual user edits
    ScriptApp.newTrigger('onTaskStatusChange')
      .forSpreadsheet(masterSheet)
      .onEdit()
      .create();
    
    // (4) Daily summary triggers at 09:30 and 17:00
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
      
    return ContentService.createTextOutput(`ตั้งค่า Trigger สำหรับ Master Sheet สำเร็จแล้ว! 🚀\n(1) ตั้งค่าระบบ Sync อัตโนมัติทุก 1 นาที (ประมวลผลเฉพาะงานตั้งแต่วันนี้เป็นต้นไป)\n(2) ผูก Master Sheet (onChange & onEdit)\n(3) แจ้งเตือนสรุปงาน 09:30 และ 17:00`);
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
    if (taskDateStr && taskDateStr < todayStr) continue;

    const revStatus = String(data[i][CONFIG.MASTER_COL_REVIEW_STATUS] || '').trim();
    const status = String(data[i][CONFIG.MASTER_COL_STATUS] || '').trim();
    if (revStatus === "รอรีวิว" || status === "Sent to P'Aof") {
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
