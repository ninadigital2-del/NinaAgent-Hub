// ============================================================
// Task Status Tracker — Google Apps Script (AD Review Queue)
// ============================================================

const CONFIG = {
  // ตั้งค่า Google Sheet สำหรับทุกคนในทีม
  TEAM_SHEETS: {
    'จ๊ะเอ๋':  '1Q7CvHdG0mXtmIJ_hHsHU1wDHhSO-zYs0SBD6gYU7PTc',
    'อุ้ม':    '1zG0ZyQN2tT0dV9L7ktyJ-_477Yh_ybwjWLR87eFDbOY',
    'กิ๊บ':   '1L7arKfntBNEbiLJHMV24L4NGg4pyRTeK2a989VFgam4',
    'เป้':    '1hgEF_R0DQ8p3_mwcy7qXLl94bR0jF_nQsooFXXTbl88',
    'โชกุล':  '1L4m3C2zHnirHbyEhgqJilDtQhyorrsrj7xDEP22BF-w',
    'ท้อป':   '1Lz30YiHpxih0nBABS_Dg2Wm9PvZxX0aVFuwubbZIr2g',
    'โอม':    '1R4ieki0O1Kj-Hk6k-aUeGSLCAW94oDwHQqX9GdVhgeM',
  },
  
  // Master Sheet สำหรับเก็บข้อมูลคิวงาน (GEM_Graphic_Master)
  MASTER_SHEET_ID: '144OB0gy5dJ8MOnc5Te0k1KpltrDoG4ocnxcS3t4MR4g',
  
  // ตั้งค่า LINE
  LINE_CHANNEL_ACCESS_TOKEN: '0LdRnV4LLCmXBG8chf62N4WpIUHFkaEvJ/ljFjqbq6GbaqnLCVRqeiPZrhRJgsweUSvOM8TUbc9r500b+eviYoghG35l6qT+nxU+N6hqqODqCV7SEhCB/PRgMLJ1O0bB3ccg3dYy+XpNHX5RQdv0hwdB04t89/1O/w1cDnyilFU=',
  LINE_GROUP_ID: 'C73656d16402ca46690a9ef39b9382bfd',
  
  // ตำแหน่งคอลัมน์ในชีตบุคคล
  COL_TASK_ID: 9,      // คอลัมน์ J (Job No.)
  COL_TASK_NAME: 11,   // คอลัมน์ L (ชื่องาน)
  COL_OWNER: 12,       // คอลัมน์ M (เจ้าของงาน)
  COL_STATUS: 0,       // คอลัมน์ A (Check / Status)
  COL_COMMENT: 14,     // คอลัมน์ O (ช่องใส่คอมเมนต์เมื่อมีการปรับแก้)
  
  // ตำแหน่งคอลัมน์ใน GEM_Graphic_Master (📥 RAW DATA sheet)
  // Row 4: Header, Row 5+: Data
  // Index 0-based:
  MASTER_COL_OWNER_A: 0,        // Col A (เจ้าของงาน)
  MASTER_COL_STATUS: 1,         // Col B (Graphic Status: Sent to P'Aof, มีปรับแก้, Done ฯลฯ)
  MASTER_COL_JOB_NO: 10,        // Col K (Job No.)
  MASTER_COL_BRAND: 11,         // Col L (Brand / Client)
  MASTER_COL_TASK_NAME: 12,     // Col M (ชื่องาน)
  MASTER_COL_OWNER_N: 13,       // Col N (เจ้าของงาน)
  MASTER_COL_LINK: 14,          // Col O (Link ไฟล์งาน / Preview)
  MASTER_COL_DEADLINE: 15,      // Col P (Deadline / Date)
  MASTER_COL_REVIEW_STATUS: 16, // Col Q (Review Status: รอรีวิว, มีปรับแก้, อนุมัติแล้ว)
  MASTER_COL_SENT_AT: 17,       // Col R (Sent to Review At)
  MASTER_COL_REVIEWED_AT: 18,   // Col S (Reviewed At)
  MASTER_COL_REVISION_ROUND: 19 // Col T (Revision Round)
};

const CACHE_KEY = "AD_REVIEW_QUEUE_TASKS_v5";

// ============================================================
// 1. Web App Endpoint (GET)
// ============================================================
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  
  if (action === 'getTasks') {
    return ContentService.createTextOutput(getTasksData())
      .setMimeType(ContentService.MimeType.JSON);
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
}

// ============================================================
// 4. API Data Fetching (ดึงข้อมูลงานจาก Master Sheet ส่งให้ Dashboard)
// ============================================================
function handleApiRequest() {
  return ContentService.createTextOutput(getTasksData())
    .setMimeType(ContentService.MimeType.JSON);
}

function getTasksData() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return cached;
    }

    ensureMasterHeaders();
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

      // Fallback for sentToReviewAt if empty but status is "รอรีวิว"
      if (!sentToReviewAtRaw && reviewStatus === "รอรีวิว") {
        if (row[5] instanceof Date) {
          sentToReviewAtRaw = row[5];
        }
      }

      let sentToReviewAt = "";
      if (sentToReviewAtRaw instanceof Date) {
        sentToReviewAt = sentToReviewAtRaw.toISOString();
      } else if (sentToReviewAtRaw) {
        sentToReviewAt = String(sentToReviewAtRaw).trim();
      }

      let reviewedAt = "";
      let isToday = false;
      if (reviewedAtRaw instanceof Date) {
        reviewedAt = reviewedAtRaw.toISOString();
        const revStr = Utilities.formatDate(reviewedAtRaw, "Asia/Bangkok", "yyyy-MM-dd");
        isToday = (todayStr === revStr);
      } else if (reviewedAtRaw) {
        reviewedAt = String(reviewedAtRaw).trim();
        const parsed = new Date(reviewedAt);
        if (!isNaN(parsed.getTime())) {
          const revStr = Utilities.formatDate(parsed, "Asia/Bangkok", "yyyy-MM-dd");
          isToday = (todayStr === revStr);
        }
      }

      // Filter: Show "รอรีวิว", "มีปรับแก้", or "อนุมัติแล้ว" of today
      if (reviewStatus === "รอรีวิว" || reviewStatus === "มีปรับแก้" || (reviewStatus === "อนุมัติแล้ว" && isToday)) {
        tasks.push({
          id: String(row[CONFIG.MASTER_COL_JOB_NO] || `master_${i+1}`).trim(),
          uniqueId: `master_${i+1}`,
          name: taskName,
          owner: String(row[CONFIG.MASTER_COL_OWNER_N] || row[CONFIG.MASTER_COL_OWNER_A] || 'ไม่ระบุ').trim(),
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
// 5. Update Task Status (จาก Dashboard หรือ API)
// ============================================================
function updateTaskFromWeb(taskId, newStatus, commentText) {
  try {
    const sheet = getMasterRawDataSheet();
    if (!sheet) return JSON.stringify({ success: false, error: "ไม่พบแผ่นงานตารางหลัก" });
    
    ensureMasterHeaders();
    const data = sheet.getDataRange().getValues();
    let foundRow = -1;
    let taskName = '';
    let ownerName = '';

    const targetStr = String(taskId).trim();
    for (let i = 4; i < data.length; i++) {
      const uId = `master_${i+1}`;
      const jobNo = String(data[i][CONFIG.MASTER_COL_JOB_NO] || '').trim();
      
      if (targetStr === uId || (jobNo !== '' && targetStr === jobNo)) {
        foundRow = i + 1;
        taskName = data[i][CONFIG.MASTER_COL_TASK_NAME] || 'ไม่ระบุชื่อ';
        ownerName = data[i][CONFIG.MASTER_COL_OWNER_N] || data[i][CONFIG.MASTER_COL_OWNER_A] || '';
        break;
      }
    }
    
    if (foundRow > -1) {
      const now = new Date();
      const currentReviewStatus = String(sheet.getRange(foundRow, 17).getValue() || '').trim();
      const currentRound = parseInt(sheet.getRange(foundRow, 20).getValue()) || 1;

      if (newStatus === "มีปรับแก้") {
        sheet.getRange(foundRow, 2).setValue("มีปรับแก้");       // Col B
        sheet.getRange(foundRow, 17).setValue("มีปรับแก้");      // Col Q
        sheet.getRange(foundRow, 19).setValue(now);              // Col S (Reviewed At)
        // Col R (Sent to Review At) and Col T (Revision Round) remain unchanged
      } else if (newStatus === "อนุมัติแล้ว" || newStatus === "Done") {
        sheet.getRange(foundRow, 2).setValue("Done");            // Col B
        sheet.getRange(foundRow, 17).setValue("อนุมัติแล้ว");    // Col Q
        sheet.getRange(foundRow, 19).setValue(now);              // Col S (Reviewed At)
      } else if (newStatus === "รอรีวิว" || newStatus === "Sent to P'Aof") {
        sheet.getRange(foundRow, 2).setValue("Sent to P'Aof");   // Col B
        sheet.getRange(foundRow, 17).setValue("รอรีวิว");        // Col Q
        sheet.getRange(foundRow, 18).setValue(now);              // Col R (Sent to Review At)
        sheet.getRange(foundRow, 19).setValue("");               // Col S (Reviewed At) cleared
        if (currentReviewStatus !== "รอรีวิว") {
          sheet.getRange(foundRow, 20).setValue(currentRound + 1); // Col T (Revision Round) + 1
        }
      }

      // Sync to Graphic individual sheet if exists
      syncToIndividualSheet(taskId, taskName, ownerName, newStatus);

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

function syncToIndividualSheet(taskId, taskName, ownerName, newStatus) {
  if (!ownerName || !CONFIG.TEAM_SHEETS[ownerName]) return;
  try {
    const sheetId = CONFIG.TEAM_SHEETS[ownerName];
    const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
    const data = sheet.getDataRange().getValues();
    const targetStr = String(taskId).trim();

    let graphicStatusValue = newStatus;
    if (newStatus === "อนุมัติแล้ว") graphicStatusValue = "Done";
    if (newStatus === "รอรีวิว") graphicStatusValue = "Sent to P'Aof";

    for (let i = 1; i < data.length; i++) {
      const jobNo = String(data[i][CONFIG.COL_TASK_ID] || '').trim();
      const tName = String(data[i][CONFIG.COL_TASK_NAME] || '').trim();
      if ((jobNo !== '' && targetStr === jobNo) || tName === taskName) {
        sheet.getRange(i + 1, CONFIG.COL_STATUS + 1).setValue(graphicStatusValue);
        break;
      }
    }
  } catch (e) {
    console.error("syncToIndividualSheet error: " + e.message);
  }
}

// ============================================================
// 6. Master Sheet Edit Trigger (onTaskStatusChange)
// ============================================================
function onTaskStatusChange(e) {
  try { CacheService.getScriptCache().remove(CACHE_KEY); } catch(err) {}
  if (!e || !e.range) return;
  
  const sheet = e.range.getSheet();
  const spreadsheetId = e.source.getId();
  
  if (spreadsheetId !== CONFIG.MASTER_SHEET_ID || sheet.getName() !== '📥 RAW DATA') return;
  
  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row <= 4) return; // Skip headers

  ensureMasterHeaders();
  const now = new Date();
  const taskName = sheet.getRange(row, 13).getValue() || 'ไม่ระบุชื่อ';
  const owner = sheet.getRange(row, 14).getValue() || sheet.getRange(row, 1).getValue() || 'ไม่ระบุ';

  // If Col B (Graphic Status) was edited
  if (col === 2) {
    const newValue = String(sheet.getRange(row, col).getValue() || '').trim();
    const normVal = newValue.toLowerCase().replace(/’/g, "'");
    const currentReviewStatus = String(sheet.getRange(row, 17).getValue() || '').trim();
    const currentRound = parseInt(sheet.getRange(row, 20).getValue()) || 1;

    if (normVal === "sent to p'aof") {
      sheet.getRange(row, 17).setValue("รอรีวิว");
      sheet.getRange(row, 18).setValue(now);
      sheet.getRange(row, 19).setValue("");
      let newRound = currentRound;
      if (currentReviewStatus !== "รอรีวิว") {
        newRound = currentRound + 1;
        sheet.getRange(row, 20).setValue(newRound);
      }
      sendLineReviewAlert(taskName, owner, newRound, row, spreadsheetId);
    } else if (normVal === "มีปรับแก้") {
      sheet.getRange(row, 17).setValue("มีปรับแก้");
      sheet.getRange(row, 19).setValue(now);
    } else if (normVal === "done" || normVal === "ok" || normVal === "อนุมัติแล้ว") {
      sheet.getRange(row, 17).setValue("อนุมัติแล้ว");
      sheet.getRange(row, 19).setValue(now);
    }
  }
  
  // If Col Q (Review Status) was edited directly
  if (col === 17) {
    const newValue = String(sheet.getRange(row, col).getValue() || '').trim();
    const currentRound = parseInt(sheet.getRange(row, 20).getValue()) || 1;

    if (newValue === "รอรีวิว") {
      sheet.getRange(row, 2).setValue("Sent to P'Aof");
      sheet.getRange(row, 18).setValue(now);
      sheet.getRange(row, 19).setValue("");
      const newRound = currentRound + 1;
      sheet.getRange(row, 20).setValue(newRound);
      sendLineReviewAlert(taskName, owner, newRound, row, spreadsheetId);
    } else if (newValue === "มีปรับแก้") {
      sheet.getRange(row, 2).setValue("มีปรับแก้");
      sheet.getRange(row, 19).setValue(now);
    } else if (newValue === "อนุมัติแล้ว") {
      sheet.getRange(row, 2).setValue("Done");
      sheet.getRange(row, 19).setValue(now);
    }
  }
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
        { type: "text", text: `ผู้รับผิดชอบ: ${owner}`, size: "sm", color: "#666666", wrap: true },
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
// 7. LINE Webhook Handling
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

function updateSheetStatusFromPostback(replyToken, row, sheetId, newStatus) {
  try {
    const masterSheet = getMasterRawDataSheet();
    if (!masterSheet) {
      replyText(replyToken, "❌ ไม่พบ Master Sheet");
      return;
    }

    const r = parseInt(row);
    const taskName = masterSheet.getRange(r, 13).getValue() || 'ไม่ระบุชื่อ';
    const now = new Date();

    if (newStatus === "มีปรับแก้") {
      masterSheet.getRange(r, 2).setValue("มีปรับแก้");
      masterSheet.getRange(r, 17).setValue("มีปรับแก้");
      masterSheet.getRange(r, 19).setValue(now);
    } else if (newStatus === "Done" || newStatus === "อนุมัติแล้ว") {
      masterSheet.getRange(r, 2).setValue("Done");
      masterSheet.getRange(r, 17).setValue("อนุมัติแล้ว");
      masterSheet.getRange(r, 19).setValue(now);
    }

    CacheService.getScriptCache().remove(CACHE_KEY);
    const nowStr = Utilities.formatDate(now, "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
    const displayStatusStr = (newStatus === "Done" || newStatus === "อนุมัติแล้ว") ? "อนุมัติแล้ว" : "มีปรับแก้";
    replyText(replyToken, `🕒 ${nowStr}\n✅ อัปเดตงาน "${taskName}" เป็นสถานะ "${displayStatusStr}" เรียบร้อยแล้ว!`);
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
      const owner = data[i][CONFIG.MASTER_COL_OWNER_N] || data[i][CONFIG.MASTER_COL_OWNER_A] || 'ไม่ระบุ';
      const status = data[i][CONFIG.MASTER_COL_REVIEW_STATUS] || data[i][CONFIG.MASTER_COL_STATUS] || 'ยังไม่เริ่ม';
      responseText = `📌 ชิ้นงาน: ${taskName}\n👤 ผู้รับผิดชอบ: ${owner}\n🔄 สถานะรีวิว: ${status}`;
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
      const owner = data[i][CONFIG.MASTER_COL_OWNER_N] || data[i][CONFIG.MASTER_COL_OWNER_A] || 'ไม่ระบุ';
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
// 8. Triggers Setup
// ============================================================
function setupTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
    
    const masterSheet = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    ScriptApp.newTrigger('onTaskStatusChange')
      .forSpreadsheet(masterSheet)
      .onEdit()
      .create();
    
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
      
    return ContentService.createTextOutput(`ตั้งค่า Trigger สำหรับ Master Sheet สำเร็จแล้ว! 🚀\n(1) ผูก Master Sheet (onEdit)\n(2) แจ้งเตือนงานตอน 09:30 และ 17:00`);
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

  for (let i = 4; i < data.length; i++) {
    const revStatus = String(data[i][CONFIG.MASTER_COL_REVIEW_STATUS] || '').trim();
    const status = String(data[i][CONFIG.MASTER_COL_STATUS] || '').trim();
    if (revStatus === "รอรีวิว" || status === "Sent to P'Aof") {
      const taskName = data[i][CONFIG.MASTER_COL_TASK_NAME] || 'ไม่ระบุชื่อ';
      const owner = data[i][CONFIG.MASTER_COL_OWNER_N] || data[i][CONFIG.MASTER_COL_OWNER_A] || 'ไม่ระบุ';
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
