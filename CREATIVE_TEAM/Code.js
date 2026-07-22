// ============================================================
// Task Status Tracker — Google Apps Script
// ============================================================
// การตั้งค่าเบื้องต้น:
// 1. กด Deploy > New deployment (เลือก Web app, Execute as: Me, Who has access: Anyone)
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
  
  // Master Sheet สำหรับเก็บข้อมูลคิวงาน
  MASTER_SHEET_ID: '144OB0gy5dJ8MOnc5Te0k1KpltrDoG4ocnxcS3t4MR4g',
  
  // ตั้งค่า LINE
  LINE_CHANNEL_ACCESS_TOKEN: '0LdRnV4LLCmXBG8chf62N4WpIUHFkaEvJ/ljFjqbq6GbaqnLCVRqeiPZrhRJgsweUSvOM8TUbc9r500b+eviYoghG35l6qT+nxU+N6hqqODqCV7SEhCB/PRgMLJ1O0bB3ccg3dYy+XpNHX5RQdv0hwdB04t89/1O/w1cDnyilFU=',
  LINE_GROUP_ID: 'C73656d16402ca46690a9ef39b9382bfd',
  
  // ตำแหน่งคอลัมน์ (เริ่มนับ 0 = A, 1 = B, 2 = C)
  COL_TASK_ID: 9,      // คอลัมน์ J (Job No.)
  COL_TASK_NAME: 11,   // คอลัมน์ L (ชื่องาน)
  COL_OWNER: 12,       // คอลัมน์ M (เจ้าของงาน)
  COL_STATUS: 0,       // คอลัมน์ A (Check)
  COL_COMMENT: 14,     // คอลัมน์ O (ช่องใส่คอมเมนต์เมื่อมีการปรับแก้)
  
  // คอลัมน์ใหม่สำหรับระบบ AD Review Queue
  COL_REVIEW_STATUS: 15,     // คอลัมน์ P (รอรีวิว, มีปรับแก้, อนุมัติแล้ว)
  COL_SENT_TO_REVIEW_AT: 16, // คอลัมน์ Q (เวลาที่ส่งรีวิวล่าสุด)
  COL_REVIEWED_AT: 17,       // คอลัมน์ R (เวลาที่ AD ตรวจ)
  COL_REVISION_ROUND: 18,    // คอลัมน์ S (จำนวนรอบการปรับแก้)
  
  // ตำแหน่งคอลัมน์ใน GEM_Graphic_Master (RAW DATA)
  MASTER_COL_JOB_NO: 10,         // คอลัมน์ K (Job No.)
  MASTER_COL_TASK_NAME: 12,      // คอลัมน์ M (ชื่องาน)
  MASTER_COL_OWNER: 13,          // คอลัมน์ N (เจ้าของงาน)
  MASTER_COL_REVIEW_STATUS: 16, // คอลัมน์ Q (Review Status)
  MASTER_COL_SENT_AT: 17,       // คอลัมน์ R (Sent to Review At)
  MASTER_COL_REVIEWED_AT: 18,   // คอลัมน์ S (Reviewed At)
  MASTER_COL_REVISION_ROUND: 19 // คอลัมน์ T (Revision Round)
};

// ============================================================
// 1. Web App Endpoint (GET) - สำหรับเปิดหน้าเว็บ Dashboard
// ============================================================
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  
  // หากเรียก API แบบ GET เพื่อขอดึงข้อมูล (AJAX)
  if (action === 'getTasks') {
    return handleApiRequest();
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
  
  // หากเปิด URL ปกติ ให้แสดงหน้าเว็บ Index.html
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('CREATIVE TEAM')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ============================================================
// 2. LINE Webhook Endpoint (POST)
// ============================================================
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    
    // ตรวจสอบว่าเป็น Request จาก LINE หรือไม่ (LINE จะมี 'events')
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

const CACHE_KEY = 'TASKS_DATA_CACHE_V1';

// ============================================================
// 3. API Data Fetching (ดึงข้อมูลงานจาก Sheet ส่งให้หน้าเว็บ)
// ============================================================
function handleApiRequest() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return ContentService.createTextOutput(cached)
        .setMimeType(ContentService.MimeType.JSON);
    }

    const tasks = [];
    for (const [ownerName, sheetId] of Object.entries(CONFIG.TEAM_SHEETS)) {
      try {
        const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) continue;
        
        const data = sheet.getRange(1, 1, lastRow, 19).getValues();
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row[CONFIG.COL_TASK_NAME]) { 
            const status = String(row[CONFIG.COL_STATUS] || '').trim();
            const reviewStatus = String(row[CONFIG.COL_REVIEW_STATUS] || '').trim();
            const reviewedAt = row[CONFIG.COL_REVIEWED_AT] || '';
            const sentToReviewAt = row[CONFIG.COL_SENT_TO_REVIEW_AT] || '';
            
            // For legacy tasks
            const displayReviewStatus = reviewStatus || (status === "Sent to P'Aof" ? "รอรีวิว" : (status === "มีปรับแก้" ? "มีปรับแก้" : ""));
            
            let isToday = false;
            if (reviewedAt && reviewedAt instanceof Date) {
               const todayStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
               const revStr = Utilities.formatDate(reviewedAt, "Asia/Bangkok", "yyyy-MM-dd");
               isToday = (todayStr === revStr);
            }
            
            if (displayReviewStatus === "รอรีวิว" || displayReviewStatus === "มีปรับแก้" || (displayReviewStatus === "อนุมัติแล้ว" && isToday)) {
              tasks.push({
                id: row[CONFIG.COL_TASK_ID] || '-',
                uniqueId: `${ownerName}_${i+1}`,
                name: row[CONFIG.COL_TASK_NAME],
                owner: ownerName,
                status: displayReviewStatus,
                graphicStatus: status,
                date: (row[2] instanceof Date) ? Utilities.formatDate(row[2], "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss") : (row[2] || ''),
                time: (row[4] instanceof Date) ? Utilities.formatDate(row[4], "Asia/Bangkok", "HH:mm") : (row[4] || ''),
                brand: row[10] || '',
                comment: row[14] || '',
                sentToReviewAt: (sentToReviewAt instanceof Date) ? sentToReviewAt.toISOString() : 
                                (sentToReviewAt || (row[14] && String(row[14]).match(/\[(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})\]/) ? (() => {
                                   const m = String(row[14]).match(/\[(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})\]/);
                                   if (m) {
                                      const d = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}+07:00`);
                                      return isNaN(d.getTime()) ? '' : d.toISOString();
                                   }
                                   return '';
                                })() : '')),
                reviewedAt: (reviewedAt instanceof Date) ? reviewedAt.toISOString() : (reviewedAt || ''),
                revisionRound: parseInt(row[CONFIG.COL_REVISION_ROUND]) || 1
              });
            }
          }
        }
      } catch (e) {
        console.error("Error reading sheet for " + ownerName, e);
      }
    }
    
    const resStr = JSON.stringify({ success: true, tasks: tasks });
    try {
      cache.put(CACHE_KEY, resStr, 15);
    } catch (cacheErr) {
      // Ignore cache limit errors
    }
    return ContentService.createTextOutput(resStr)
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// 2.2 Helper for Centralized Review Database (RAW DATA)
// ============================================================
function getMasterRawDataSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  return ss.getSheetByName('📥 RAW DATA');
}

function ensureMasterHeaders() {
  const sheet = getMasterRawDataSheet();
  if (!sheet) return;
  
  const hQ = sheet.getRange(4, 17);
  const hR = sheet.getRange(4, 18);
  const hS = sheet.getRange(4, 19);
  const hT = sheet.getRange(4, 20);
  
  if (hQ.getValue() !== "Review Status") hQ.setValue("Review Status");
  if (hR.getValue() !== "Sent to Review At") hR.setValue("Sent to Review At");
  if (hS.getValue() !== "Reviewed At") hS.setValue("Reviewed At");
  if (hT.getValue() !== "Revision Round") hT.setValue("Revision Round");
}

// ============================================================
// 3.1. API Data Fetching for google.script.run (ใช้สำหรับ Iframe)
// ============================================================
function getTasksData() {
  const CACHE_KEY = "AD_REVIEW_QUEUE_TASKS_v4";
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return cached;
    }

    const tasks = [];
    const sheet = getMasterRawDataSheet();
    if (!sheet) return JSON.stringify({ success: true, tasks: [] });
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 5) return JSON.stringify({ success: true, tasks: [] });
    
    const data = sheet.getRange(1, 1, lastRow, 19).getValues();
    
    // Headers are at row 4 (index 3), Data starts at row 5 (index 4)
    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      const taskName = String(row[12] || '').trim(); // Col M
      if (taskName) {
        const status = String(row[1] || '').trim(); // Col B
        const ownerName = String(row[13] || row[0] || '').trim(); // Col N or Col A
        const logs = String(row[16] || ''); // Col Q
        const sentCount = parseInt(row[17]) || 0; // Col R
        const editCount = parseInt(row[18]) || 0; // Col S
        
        let sentToReviewAt = parseTimeFromLogs(logs, "Sent to P'Aof") || (row[5] instanceof Date ? row[5] : '');
        let reviewedAt = parseTimeFromLogs(logs, "Done") || '';
        let revisionRound = editCount > 0 ? editCount : 1;
        
        // Derive displayReviewStatus
        let displayReviewStatus = "";
        const normStatus = status.toLowerCase().replace(/’/g, "'");
        if (normStatus === "sent to p'aof") displayReviewStatus = "รอรีวิว";
        else if (status === "มีปรับแก้") displayReviewStatus = "มีปรับแก้";
        else if (status === "Done" || status === "OK") displayReviewStatus = "อนุมัติแล้ว";
        
        let isToday = false;
        if (reviewedAt && reviewedAt instanceof Date) {
           const todayStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
           const revStr = Utilities.formatDate(reviewedAt, "Asia/Bangkok", "yyyy-MM-dd");
           isToday = (todayStr === revStr);
        }
        
        if (displayReviewStatus === "รอรีวิว" || displayReviewStatus === "มีปรับแก้" || (displayReviewStatus === "อนุมัติแล้ว" && isToday)) {
          tasks.push({
            id: row[10] || '-', // Col K (Job No)
            uniqueId: `master_${i+1}`,
            name: taskName,
            owner: ownerName,
            status: displayReviewStatus,
            graphicStatus: status,
            date: (row[5] instanceof Date) ? Utilities.formatDate(row[5], "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss") : (row[5] || ''),
            time: (row[7] instanceof Date) ? Utilities.formatDate(row[7], "Asia/Bangkok", "HH:mm") : (row[7] || ''),
            brand: row[11] || '', // Col L
            comment: logs,
            sentToReviewAt: (sentToReviewAt instanceof Date) ? sentToReviewAt.toISOString() : (sentToReviewAt || ''),
            reviewedAt: (reviewedAt instanceof Date) ? reviewedAt.toISOString() : (reviewedAt || ''),
            revisionRound: revisionRound
          });
        }
      }
    }
    
    const result = JSON.stringify({ success: true, tasks: tasks });
    cache.put(CACHE_KEY, result, 600); // Cache for 10 minutes
    return result;
  } catch (err) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

// ============================================================
// DEBUG
// ============================================================
function getDebugData() {
  try {
    const debugRows = [];
    let sheetHeaders = [];
    for (const [ownerName, sheetId] of Object.entries(CONFIG.TEAM_SHEETS)) {
      try {
        const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
        const data = sheet.getDataRange().getValues();
        if (sheetHeaders.length === 0) sheetHeaders = data[0];
        
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const status = String(row[CONFIG.COL_STATUS] || '').trim();
          if (status === "Sent to P'Aof") {
            debugRows.push({
              sheet: ownerName,
              rowNumber: i + 1,
              rowData: row
            });
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ headers: sheetHeaders, tasks: debugRows }, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(err.message);
  }
}

// ============================================================
// 3.2. Web App Actions (อัปเดตสถานะและคอมเมนต์จากหน้าเว็บ)
// ============================================================
function updateTaskFromWeb(taskId, newStatus, commentText) {
  try {
    const sheet = getMasterRawDataSheet();
    if (!sheet) return JSON.stringify({ success: false, error: "ไม่พบแผ่นงานตารางหลัก" });
    
    const data = sheet.getDataRange().getValues();
    let foundRow = -1;
    let taskName = '';
    
    for (let i = 4; i < data.length; i++) {
      const uId = `master_${i+1}`;
      const jobNo = String(data[i][10] || '').trim(); // Col K
      const targetStr = String(taskId).trim();
      
      if (targetStr === uId || (jobNo !== '' && targetStr === jobNo)) {
        foundRow = i + 1;
        taskName = data[i][12] || 'ไม่ระบุชื่อ';
        break;
      }
    }
    
    if (foundRow > -1) {
      // อัปเดตสถานะที่ Col B (Index 1 -> Col 2)
      sheet.getRange(foundRow, 2).setValue(newStatus);
      
      // อัปเดต Log & Counts ที่ Col Q, R, S
      const nowStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
      const timestampLog = `[${nowStr}] ${commentText ? `(AD) ${commentText}` : `เปลี่ยนสถานะเป็น "${newStatus}"`}`;
      
      // Column Q (Index 16 -> Col 17)
      const logCell = sheet.getRange(foundRow, 17);
      const currentLog = String(logCell.getValue() || '').trim();
      const combinedLog = currentLog ? `${timestampLog}\n${currentLog}` : timestampLog;
      logCell.setValue(combinedLog);
      
      if (newStatus === "มีปรับแก้") {
        const sCell = sheet.getRange(foundRow, 19); // Col S
        const countS = parseInt(sCell.getValue()) || 0;
        sCell.setValue(countS + 1);
      } else if (newStatus === "Sent to P'Aof") {
        const rCell = sheet.getRange(foundRow, 18); // Col R
        const countR = parseInt(rCell.getValue()) || 0;
        rCell.setValue(countR + 1);
      }
      
      // เคลียร์ Cache เพื่อให้เรียกดูใหม่ได้ทันที
      CacheService.getScriptCache().remove("AD_REVIEW_QUEUE_TASKS_v4");
      
      return JSON.stringify({ success: true, taskName: taskName });
    } else {
      return JSON.stringify({ success: false, error: "ไม่พบรหัสงานนี้ในระบบตารางหลัก" });
    }
  } catch (err) {
    return JSON.stringify({ success: false, error: err.message });
  }
}

// ============================================================
// 4. จัดการ LINE Webhook
// ============================================================
function handleLineWebhook(events) {
  events.forEach(event => {
    // ป้องกันวิญญาณหลอน (Ghost Message): ข้าม event ที่เป็น Redelivery (ข้อความซ้ำจากคิวที่ส่งไม่สำเร็จ)
    if (event.deliveryContext && event.deliveryContext.isRedelivery) {
      return;
    }
    
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
  const userId = event.source.userId;
  
  // 1. เช็คว่ามี State รอรับคอมเมนต์อยู่หรือไม่
  const props = PropertiesService.getScriptProperties();
  const stateStr = props.getProperty('awaitingComment_' + userId);
  
  if (stateStr) {
    // ผู้ใช้อยู่ในโหมดกำลังพิมพ์คอมเมนต์
    const state = JSON.parse(stateStr);
    
    // ดักจับกรณีใช้ LINE PC (กดปุ่มแล้วมันส่งคำว่า "มีปรับแก้" มาเฉยๆ โดยไม่เปิดคีย์บอร์ด)
    if (userMessage === "มีปรับแก้") {
      return;
    }
    
    // ถ้าเป็นการพิมพ์คอมเมนต์ปกติ
    try {
      const sheet = SpreadsheetApp.openById(state.sheetId).getSheets()[0];
      
      // ลบคำว่า @Agent Paof ออก (ถ้ามี) และลบเครื่องหมายคำพูด (เผื่อผู้ใช้พิมพ์ "จบ")
      const cleanMessage = userMessage.replace(/@Agent Paof/g, '').replace(/["']/g, '').trim();
      if (!cleanMessage) return;
      
      // ดักจับคำสั่ง จบ หรือ ยกเลิก (กรณีผู้ใช้พิมพ์มาแทนการกดปุ่ม)
      if (cleanMessage === "ยกเลิก") {
        props.deleteProperty('awaitingComment_' + userId);
        replyText(replyToken, `❌ ยกเลิกการคอมเมนต์งาน "${state.taskName}" แล้วครับ`);
        return;
      }
      if (cleanMessage === "จบ" || cleanMessage === "พอแล้ว" || cleanMessage === "เสร็จแล้ว") {
        sheet.getRange(state.row, CONFIG.COL_STATUS + 1).setValue("มีปรับแก้");
        replyText(replyToken, `✅ บันทึกคอมเมนต์สำหรับงาน "${state.taskName}" ทั้งหมดเรียบร้อยครับ\nสถานะถูกเปลี่ยนเป็น "มีปรับแก้" แล้ว!`);
        props.deleteProperty('awaitingComment_' + userId);
        return;
      }
      
      // ดึงข้อความเดิมมา
      const existingText = String(sheet.getRange(state.row, CONFIG.COL_COMMENT + 1).getValue() || "");
      
      let prefix = "";
      if (state.isFirstComment) {
        const timestamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm");
        prefix = existingText ? `\n\n[รอบแก้: ${timestamp}]\n` : `[รอบแก้: ${timestamp}]\n`;
        
        // อัปเดต state ว่าไม่ใช่คอมเมนต์แรกแล้ว
        state.isFirstComment = false;
        props.setProperty('awaitingComment_' + userId, JSON.stringify(state));
      } else {
        prefix = existingText ? "\n" : "";
      }
      
      const newComment = existingText + prefix + "- " + cleanMessage;
      
      // เขียนคอมเมนต์ลงชีต
      sheet.getRange(state.row, CONFIG.COL_COMMENT + 1).setValue(newComment);
      
      // ให้บอทแอบจดเงียบๆ ไม่ต้องตอบกลับแล้ว เพื่อไม่ให้แชทรก
    } catch (e) {
      replyText(replyToken, `❌ เกิดข้อผิดพลาดในการบันทึกคอมเมนต์: ${e.message}`);
      props.deleteProperty('awaitingComment_' + userId);
    }
    return;
  }
  
  // 2. ถ้าไม่ใช่การคอมเมนต์ ให้เช็คคำสั่งทั่วไป
  if (userMessage.startsWith('!status')) {
    const taskId = userMessage.replace('!status', '').trim();
    if (taskId) {
      replyTaskStatus(replyToken, taskId);
    } else {
      replyText(replyToken, 'กรุณาพิมพ์รหัสงานต่อท้าย เช่น !status 1024');
    }
  } else if (userMessage === '!summary') {
    replySummaryTasks(replyToken);
  }
}

function handlePostback(event) {
  const replyToken = event.replyToken;
  const data = event.postback.data;
  const userId = event.source.userId;
  
  // แปลง Query String เป็น Object
  const params = data.split('&').reduce((acc, curr) => {
    const [key, val] = curr.split('=');
    acc[key] = decodeURIComponent(val);
    return acc;
  }, {});
  
  if (params.action === 'updateStatus') {
    updateSheetStatusFromPostback(replyToken, params.row, params.sheetId, params.status);
  } else if (params.action === 'requestRevision') {
    // ผู้ใช้กดปุ่ม "มีปรับแก้" -> เปลี่ยนสถานะทันทีโดยไม่ต้องรอคอมเมนต์
    updateSheetStatusFromPostback(replyToken, params.row, params.sheetId, "มีปรับแก้");
  }
}


function updateSheetStatusFromPostback(replyToken, row, sheetId, newStatus) {
  try {
    // รองรับปุ่มเก่าที่กดมาจากแชทก่อนหน้านี้ (ตอนที่ยังไม่มี sheetId ฝังมาด้วย)
    if (!sheetId || sheetId === 'undefined') {
      sheetId = CONFIG.TEAM_SHEETS['กิ๊บ'];
    }
    
    const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
    
    const taskName = sheet.getRange(parseInt(row), CONFIG.COL_TASK_NAME + 1).getValue() || 'ไม่ระบุชื่อ';
    const currentStatus = String(sheet.getRange(parseInt(row), CONFIG.COL_STATUS + 1).getValue() || '').trim();
    
    // ป้องกันการกดซ้ำ: เช็คว่าสถานะปัจจุบันยังเป็น "Sent to P'Aof" อยู่ไหม
    const normStatus = currentStatus.toLowerCase().replace(/’/g, "'");
    if (normStatus !== "sent to p'aof") {
      replyText(replyToken, `⚠️ ปุ่มนี้ถูกกดไปแล้วครับ!\n(งาน "${taskName}" ถูกเปลี่ยนสถานะเป็น "${currentStatus}" ไปแล้ว)`);
      return;
    }
    
    // อัปเดตคอลัมน์ Status
    sheet.getRange(parseInt(row), CONFIG.COL_STATUS + 1).setValue(newStatus);
    
    // Comment updating is removed as per user request
    
    // เคลียร์ Cache เพื่อให้หน้าเว็บเรียกดูข้อมูลใหม่ได้ทันที
    CacheService.getScriptCache().remove(CACHE_KEY);
    
    const nowStr = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    replyText(replyToken, `🕒 ${nowStr}\n✅ อัปเดตงาน "${taskName}" เป็นสถานะ "${newStatus}"`);
  } catch (err) {
    replyText(replyToken, `❌ เกิดข้อผิดพลาดในการอัปเดต: ${err.message}`);
  }
}

function replyTaskStatus(replyToken, taskId) {
  let found = false;
  let responseText = "";
  
  for (const [owner, sheetId] of Object.entries(CONFIG.TEAM_SHEETS)) {
    try {
      const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][CONFIG.COL_TASK_ID]).trim() === taskId) {
          const taskName = data[i][CONFIG.COL_TASK_NAME] || 'ไม่ระบุชื่อ';
          const status = data[i][CONFIG.COL_STATUS] || 'ยังไม่เริ่ม';
          responseText = `📌 ชิ้นงาน: ${taskName}\n👤 ผู้รับผิดชอบ: ${owner}\n🔄 สถานะ: ${status}`;
          found = true;
          break;
        }
      }
    } catch (e) {
      console.error(`Error reading sheet for ${owner}: ${e.message}`);
    }
    if (found) break;
  }
  
  if (!found) {
    responseText = `❌ ไม่พบรหัสงาน "${taskId}" ในระบบครับ`;
  }
  
  replyText(replyToken, responseText);
}

function replySummaryTasks(replyToken) {
  let summary = "📋 สรุปงานค้างทั้งหมด:\n";
  let totalTasks = 0;
  
  for (const [owner, sheetId] of Object.entries(CONFIG.TEAM_SHEETS)) {
    try {
      const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
      const data = sheet.getDataRange().getValues();
      
      let ownerTasks = 0;
      let ownerSummary = `\n👤 ${owner}:\n`;
      
      for (let i = 1; i < data.length; i++) {
        const status = String(data[i][CONFIG.COL_STATUS] || '').trim();
        if (status === "Sent to P'Aof" || status === "มีปรับแก้") {
          const taskName = data[i][CONFIG.COL_TASK_NAME] || 'ไม่ระบุชื่อ';
          ownerSummary += `- ${taskName} (${status})\n`;
          ownerTasks++;
        }
      }
      
      if (ownerTasks > 0) {
        summary += ownerSummary;
        totalTasks += ownerTasks;
      }
    } catch (e) {
      console.error(`Error reading sheet for ${owner}: ${e.message}`);
    }
  }
  
  if (totalTasks === 0) {
    summary = "🎉 ตอนนี้ไม่มีงานค้างเลยครับ เยี่ยมมาก!";
  }
  
  replyText(replyToken, summary);
}

function replyText(replyToken, text) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const payload = {
    replyToken: replyToken,
    messages: [{ type: 'text', text: text }]
  };
  
  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload)
  };
  
  UrlFetchApp.fetch(url, options);
}

// ============================================================
// 6. Push Message API (ส่งข้อความแจ้งเตือนอัตโนมัติ)
// ============================================================
function pushLineMessage(message) {
  if (!CONFIG.LINE_GROUP_ID) return; // ถ้ายังไม่ตั้งค่า ID กลุ่ม ให้ข้ามไป
  
  const url = 'https://api.line.me/v2/bot/message/push';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN
  };
  const payload = {
    to: CONFIG.LINE_GROUP_ID,
    messages: [{ type: 'text', text: message }]
  };
  
  const options = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload)
  };
  
  try {
    UrlFetchApp.fetch(url, options);
  } catch(e) {
    console.error("Push Error: " + e.message);
  }
}

function pushLineFlexMessage(altText, contents) {
  if (!CONFIG.LINE_GROUP_ID) return;
  
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: CONFIG.LINE_GROUP_ID,
    messages: [{
      type: 'flex',
      altText: altText,
      contents: contents
    }]
  };
  
  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.LINE_CHANNEL_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload)
  };
  
  try {
    UrlFetchApp.fetch(url, options);
  } catch(e) {
    console.error("Push Flex Error: " + e.message);
  }
}

// ============================================================
// 8. Cleanup Triggers
// ============================================================
function cleanupAllOldTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let count = 0;
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
    count++;
  }
  return "Deleted " + count + " triggers";
}
function onTaskStatusChange(e) {
  try { CacheService.getScriptCache().remove("AD_REVIEW_QUEUE_TASKS_v4"); } catch(err) {}
  if (!e || !e.range) return;
  
  const sheet = e.range.getSheet();
  const spreadsheetId = e.source.getId();
  
  // ตรวจสอบว่าเป็นไฟล์ GEM_Graphic_Master หรือไม่
  if (spreadsheetId !== CONFIG.MASTER_SHEET_ID) return;
  if (sheet.getName() !== '📥 RAW DATA') return;
  
  const row = e.range.getRow();
  const col = e.range.getColumn();
  
  if (row <= 4) return; // ข้ามหัวตาราง
  
  // ตรวจสอบว่าคอลัมน์ที่แก้ คือคอลัมน์ B (Status)
  if (col === 2) {
    const newValue = String(sheet.getRange(row, col).getValue() || '').trim();
    const normVal = newValue.toLowerCase().replace(/’/g, "'");
    
    if (normVal !== "sent to p'aof") return;
    
    const nowStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
    const taskName = sheet.getRange(row, 13).getValue() || 'ไม่ระบุชื่อ';
    const owner = sheet.getRange(row, 14).getValue() || sheet.getRange(row, 1).getValue() || 'ไม่ระบุ';
    
    // Log to Col Q (17)
    const logCell = sheet.getRange(row, 17);
    const currentLog = String(logCell.getValue() || '').trim();
    const timestampLog = `[${nowStr}] เปลี่ยนสถานะเป็น "Sent to P'Aof"`;
    logCell.setValue(currentLog ? `${timestampLog}\n${currentLog}` : timestampLog);
    
    // Count Col R (18)
    const rCell = sheet.getRange(row, 18);
    const countR = parseInt(rCell.getValue()) || 0;
    rCell.setValue(countR + 1);
    
    // Send LINE Flex Message
    let headerText = "🚨 งานรอตรวจ";
    let headerColor = "#1DB446";
    
    const flexContents = {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: headerText, weight: "bold", size: "xl", color: headerColor },
          { type: "text", text: `ชิ้นงาน: ${taskName}`, margin: "md", wrap: true },
          { type: "text", text: `ผู้รับผิดชอบ: ${owner}`, size: "sm", color: "#666666", wrap: true },
          { type: "text", text: `สถานะ: ${newValue}`, size: "sm", color: headerColor, weight: "bold", wrap: true },
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
              label: "Done",
              data: `action=updateStatus&row=${row}&sheetId=${spreadsheetId}&status=Done`
            }
          }
        ]
      }
    };
    
    pushLineFlexMessage(`อัปเดตงาน "${taskName}" เป็น ${newValue}`, flexContents);
  }
}

// ============================================================
// 8. Auto-Setup Trigger (สำหรับให้ติดตั้ง Trigger อัตโนมัติผ่านคลิกลิงก์)
// ============================================================
function setupTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let editTriggersCount = 0;
    
    // ลบ trigger เก่าทั้งหมดก่อนสร้างใหม่
    for (let i = 0; i < triggers.length; i++) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
    
    // สร้าง Trigger แจ้งเตือนเมื่อแก้ชีต สำหรับทุกไฟล์
    Object.keys(CONFIG.TEAM_SHEETS).forEach(name => {
      const sheetId = CONFIG.TEAM_SHEETS[name];
      const sheet = SpreadsheetApp.openById(sheetId);
      ScriptApp.newTrigger('onTaskStatusChange')
        .forSpreadsheet(sheet)
        .onEdit()
        .create();
      editTriggersCount++;
    });
    
    // สร้าง Trigger แจ้งเตือนตอน 9:30 โมงเช้า
    ScriptApp.newTrigger('pushDailySummary')
      .timeBased()
      .atHour(9)
      .nearMinute(30)
      .everyDays(1)
      .create();

    // สร้าง Trigger แจ้งเตือนตอน 17:00 (5 โมงเย็น)
    ScriptApp.newTrigger('pushDailySummary')
      .timeBased()
      .atHour(17)
      .everyDays(1)
      .create();
      
    return ContentService.createTextOutput(`ตั้งค่า Trigger แจ้งเตือนสำเร็จแล้ว! 🚀\n(1) ผูกตารางไปแล้ว ${editTriggersCount} ไฟล์\n(2) แจ้งเตือนงานตอน 09:30 และ 17:00`);
  } catch (err) {
    return ContentService.createTextOutput('Error: ' + err.message);
  }
}

// ============================================================
// 9. Daily Summary (แจ้งเตือนสรุปงานตอนเช้าและเย็น)
// ============================================================
function pushDailySummary() {
  const day = new Date().getDay();
  if (day === 0 || day === 6) {
    return; // ไม่ทำงานวันหยุด (0=Sunday, 6=Saturday)
  }

  let pAofCount = 0;
  let pendingTasks = [];
  
  // ลูปเช็คตารางของทุกคน
  Object.keys(CONFIG.TEAM_SHEETS).forEach(owner => {
    try {
      const sheetId = CONFIG.TEAM_SHEETS[owner];
      const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        const status = String(data[i][CONFIG.COL_STATUS] || '').trim();
        if (status === "Sent to P'Aof") {
          pAofCount++;
          pendingTasks.push(`• [${owner}] ${data[i][CONFIG.COL_TASK_NAME] || 'ไม่ระบุชื่อ'}`);
        }
      }
    } catch (e) {
      console.error(`Error reading sheet for ${owner}: ${e.message}`);
    }
  });
  
  // ถ้าไม่มีงานสเตตัส Sent to P'Aof ให้หยุดการทำงานทันที (ไม่ต้องแจ้งเตือน)
  if (pAofCount === 0) {
    return;
  }
  
  let taskListContents = [];
  const displayTasks = pendingTasks.slice(0, 5);
  displayTasks.forEach(t => {
    taskListContents.push({ type: "text", text: t, size: "sm", color: "#555555", wrap: true });
  });
  if (pendingTasks.length > 5) {
    taskListContents.push({ type: "text", text: `...และอีก ${pendingTasks.length - 5} งาน`, size: "sm", color: "#aaaaaa", style: "italic", margin: "sm" });
  }

  const hour = new Date().getHours();
  const titleText = hour < 12 ? "🌅 งานรอตรวจเช้านี้" : "🌇 งานรอตรวจเย็นนี้";

  const flexContents = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#378ADD",
      contents: [
        { type: "text", text: titleText, weight: "bold", color: "#ffffff", size: "lg" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "📤 งานที่ต้องตรวจ:", color: "#aaaaaa", size: "sm", flex: 2 },
            { type: "text", text: `${pAofCount} งาน`, weight: "bold", size: "sm", color: "#333333", align: "end", flex: 1 }
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
