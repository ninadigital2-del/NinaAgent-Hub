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
  
  // ตั้งค่า LINE
  LINE_CHANNEL_ACCESS_TOKEN: '0LdRnV4LLCmXBG8chf62N4WpIUHFkaEvJ/ljFjqbq6GbaqnLCVRqeiPZrhRJgsweUSvOM8TUbc9r500b+eviYoghG35l6qT+nxU+N6hqqODqCV7SEhCB/PRgMLJ1O0bB3ccg3dYy+XpNHX5RQdv0hwdB04t89/1O/w1cDnyilFU=',
  LINE_GROUP_ID: 'C73656d16402ca46690a9ef39b9382bfd',
  
  // ตำแหน่งคอลัมน์ (เริ่มนับ 0 = A, 1 = B, 2 = C)
  COL_TASK_ID: 9,      // คอลัมน์ J (Job No.)
  COL_TASK_NAME: 11,   // คอลัมน์ L (ชื่องาน)
  COL_OWNER: 12,       // คอลัมน์ M (เจ้าของงาน)
  COL_STATUS: 0,       // คอลัมน์ A (Check)
  COL_COMMENT: 14,     // คอลัมน์ O (ช่องใส่คอมเมนต์เมื่อมีการปรับแก้)
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
      .setTitle('คู่มือการใช้งาน Agent Task Tracker')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  if (action === 'debugTasks') {
    return getDebugData();
  }
  
  // หากเปิด URL ปกติ ให้แสดงหน้าเว็บ Index.html
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Agent Task Tracker')
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
        
        const data = sheet.getRange(1, 1, lastRow, 15).getValues();
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row[CONFIG.COL_TASK_NAME]) { 
            const status = String(row[CONFIG.COL_STATUS] || '').trim();
            // ดึงเฉพาะ Sent to P'Aof และ มีปรับแก้ เพื่อลดขนาดข้อมูล กัน Error 100KB cache limit
            if (status === "Sent to P'Aof" || status === "มีปรับแก้") {
              tasks.push({
                id: row[CONFIG.COL_TASK_ID] || '-',
                uniqueId: `${ownerName}_${i+1}`,
                name: row[CONFIG.COL_TASK_NAME],
                owner: ownerName,
                status: status,
                date: (row[2] instanceof Date) ? Utilities.formatDate(row[2], "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss") : (row[2] || ''),
                time: (row[4] instanceof Date) ? Utilities.formatDate(row[4], "Asia/Bangkok", "HH:mm") : (row[4] || ''),
                brand: row[10] || '',
                link: row[13] || '',
                comment: row[14] || ''
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
// 3.1. API Data Fetching for google.script.run (ใช้สำหรับ Iframe)
// ============================================================
function getTasksData() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return cached;
    }

    const tasks = [];
    for (const [ownerName, sheetId] of Object.entries(CONFIG.TEAM_SHEETS)) {
      try {
        const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) continue;
        
        const data = sheet.getRange(1, 1, lastRow, 15).getValues();
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row[CONFIG.COL_TASK_NAME]) {
            const status = String(row[CONFIG.COL_STATUS] || '').trim();
            // ดึงเฉพาะ Sent to P'Aof และ มีปรับแก้ เพื่อลดขนาดข้อมูล
            if (status === "Sent to P'Aof" || status === "มีปรับแก้") {
              tasks.push({
                id: row[CONFIG.COL_TASK_ID] || '-',
                uniqueId: `${ownerName}_${i+1}`,
                name: row[CONFIG.COL_TASK_NAME],
                owner: ownerName,
                status: status,
                date: (row[2] instanceof Date) ? Utilities.formatDate(row[2], "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss") : (row[2] || ''),
                time: (row[4] instanceof Date) ? Utilities.formatDate(row[4], "Asia/Bangkok", "HH:mm") : (row[4] || ''),
                brand: row[10] || '',
                link: row[13] || '',
                comment: row[14] || ''
              });
            }
          }
        }
      } catch (e) {
        console.error("Error reading sheet for " + ownerName, e);
      }
    }
    
    const result = JSON.stringify({ success: true, tasks: tasks });
    cache.put(CACHE_KEY, result, 15);
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
    let found = false;
    let taskName = '';
    
    // ค้นหางานจากทุก Sheet
    for (const [owner, sheetId] of Object.entries(CONFIG.TEAM_SHEETS)) {
      const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        const uId = `${owner}_${i+1}`;
        const taskIdVal = String(data[i][CONFIG.COL_TASK_ID] || '').trim();
        const targetStr = String(taskId).trim();
        
        if (targetStr === uId || (taskIdVal !== '' && targetStr === taskIdVal)) {
          const row = i + 1;
          taskName = data[i][CONFIG.COL_TASK_NAME] || 'ไม่ระบุชื่อ';
          
          // ตรวจสอบสถานะเดิมก่อน (ให้ยืดหยุ่นเรื่องตัวพิมพ์และอักขระพิเศษ)
          const currentStatus = String(data[i][CONFIG.COL_STATUS] || '').trim();
          const normCurrent = currentStatus.toLowerCase().replace(/’/g, "'");
          const isPAof = normCurrent === "sent to p'aof";
          
          if (!isPAof && currentStatus !== newStatus) {
            return JSON.stringify({ success: false, error: `ปุ่มนี้ถูกกดไปแล้ว (งานเปลี่ยนสถานะเป็น "${currentStatus}" ไปแล้ว)` });
          }
          
          // อัปเดตสถานะ
          sheet.getRange(row, CONFIG.COL_STATUS + 1).setValue(newStatus);
          
          // บันทึกวันเวลาและประวัติการอัปเดตลงคอลัมน์ O (Comment) ทุกครั้ง!
          const timestamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
          const existingComment = String(data[i][CONFIG.COL_COMMENT] || '').trim();
          const detailNote = commentText ? `: ${commentText}` : '';
          const statusLog = `[${timestamp}] เปลี่ยนสถานะเป็น "${newStatus}"${detailNote}`;
          const combinedComment = existingComment ? `${existingComment}\n${statusLog}` : statusLog;
          
          sheet.getRange(row, CONFIG.COL_COMMENT + 1).setValue(combinedComment);
          
          // เคลียร์ Cache เพื่อให้เรียกดูใหม่ได้ทันที
          CacheService.getScriptCache().remove(CACHE_KEY);
          
          found = true;
          break;
        }
      }
      if (found) break;
    }
    
    if (found) {
      return JSON.stringify({ success: true, taskName: taskName });
    } else {
      return JSON.stringify({ success: false, error: "ไม่พบรหัสงานนี้ในระบบ" });
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
    
    // บันทึกวันเวลาและประวัติการอัปเดตลงคอลัมน์ O (Comment) ทุกครั้ง!
    const timestamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
    const existingComment = String(sheet.getRange(parseInt(row), CONFIG.COL_COMMENT + 1).getValue() || '').trim();
    const statusLog = `[${timestamp}] (LINE) เปลี่ยนสถานะเป็น "${newStatus}"`;
    const combinedComment = existingComment ? `${existingComment}\n${statusLog}` : statusLog;
    sheet.getRange(parseInt(row), CONFIG.COL_COMMENT + 1).setValue(combinedComment);
    
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
// 7. Trigger: เมื่อมีการเปลี่ยนแปลงข้อมูลใน Google Sheet (onEdit)
// ============================================================
function onTaskStatusChange(e) {
  if (!e || !e.range) return;
  
  const sheet = e.range.getSheet();
  const spreadsheetId = e.source.getId();
  
  // หาว่าไฟล์นี้เป็นของใคร
  let owner = 'ไม่ระบุ';
  for (const [name, id] of Object.entries(CONFIG.TEAM_SHEETS)) {
    if (id === spreadsheetId) {
      owner = name;
      break;
    }
  }
  
  const row = e.range.getRow();
  const col = e.range.getColumn();
  
  // ข้ามแถว 1 (หัวตาราง)
  if (row <= 1) return;
  
  // ตรวจสอบว่าคอลัมน์ที่แก้ คือคอลัมน์ Status หรือไม่ (เริ่มนับที่ 1)
  if (col === CONFIG.COL_STATUS + 1) {
    const newValue = String(sheet.getRange(row, col).getValue() || '').trim();
    const normVal = newValue.toLowerCase().replace(/’/g, "'");
    
    // แสดงเฉพาะสถานะ "Sent to P'Aof" เท่านั้น
    if (normVal !== "sent to p'aof") return;
    
    const now = new Date();
    
    // บันทึกประวัติการเปลี่ยนสถานะลงคอลัมน์ O (Comment) เฉพาะกรณีที่เปลี่ยนเป็น "Sent to P'Aof"
    const timestampLog = Utilities.formatDate(now, "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
    const existingComment = String(sheet.getRange(row, CONFIG.COL_COMMENT + 1).getValue() || '').trim();
    const statusLog = `[${timestampLog}] เปลี่ยนสถานะเป็น "${newValue}" (แก้ไขในชีต)`;
    const combinedComment = existingComment ? `${existingComment}\n${statusLog}` : statusLog;
    sheet.getRange(row, CONFIG.COL_COMMENT + 1).setValue(combinedComment);
    
    // Auto-Stamp วันที่ (คอลัมน์ C) และเวลา (คอลัมน์ E) ถ้าย้ายมา Sent to P'Aof แล้วช่องยังว่างอยู่
    const dateCell = sheet.getRange(row, 3); // คอลัมน์ C
    const timeCell = sheet.getRange(row, 5); // คอลัมน์ E
    if (!dateCell.getValue()) {
      dateCell.setValue(now);
    }
    if (!timeCell.getValue()) {
      timeCell.setValue(Utilities.formatDate(now, "Asia/Bangkok", "HH:mm:ss"));
    }
    
    // เคลียร์ Cache เพื่อให้หน้าเว็บดึงข้อมูลสดทันที
    CacheService.getScriptCache().remove(CACHE_KEY);
    
    // ดึงชื่องานมาแสดง
    const taskName = sheet.getRange(row, CONFIG.COL_TASK_NAME + 1).getValue() || 'ไม่ระบุชื่อ';
    
    // ตั้งค่าสีและข้อความของ Header ตามสถานะ
    let headerText = "🚨 งานรอตรวจ";
    let headerColor = "#1DB446"; // Green
    
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
          { type: "text", text: `ส่งเมื่อ: ${new Date().toLocaleString('th-TH', {timeZone: 'Asia/Bangkok'})}`, size: "xs", color: "#aaaaaa", margin: "sm" }
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
