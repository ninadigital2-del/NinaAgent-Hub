// ============================================================
// GEM Graphic Capacity Board — Google Apps Script
// Version: 1.0.0
// ============================================================
// SETUP:
// 1. เปิด script.google.com สร้าง project ใหม่
// 2. วาง code นี้ลงไป
// 3. ไปที่ Project Settings → Script Properties → Add:
//    NOTION_API_KEY  = secret_xxxxxxxxxxxxxxxx
//    NOTION_TASKS_DB = 2e69dccd181d81df8919fbacf921c7d5
//    MASTER_SHEET_ID = 144OB0gy5dJ8MOnc5Te0k1KpltrDoG4ocnxcS3t4MR4g
// 4. Deploy → New deployment → Web app
//    Execute as: Me | Who has access: Anyone with Google Account
// ============================================================

// ---------- CONFIG ----------
const SHEET_IDS = {
  'จ๊ะเอ๋':  '1Q7CvHdG0mXtmIJ_hHsHU1wDHhSO-zYs0SBD6gYU7PTc',
  'อุ้ม':    '1zG0ZyQN2tT0dV9L7ktyJ-_477Yh_ybwjWLR87eFDbOY',
  'กิ๊บ':   '1L7arKfntBNEbiLJHMV24L4NGg4pyRTeK2a989VFgam4',
  'เป้':    '1hgEF_R0DQ8p3_mwcy7qXLl94bR0jF_nQsooFXXTbl88',
  'โชกุล':  '1L4m3C2zHnirHbyEhgqJilDtQhyorrsrj7xDEP22BF-w',
  'ท้อป':   '1Lz30YiHpxih0nBABS_Dg2Wm9PvZxX0aVFuwubbZIr2g',
  'โอม':    '1R4ieki0O1Kj-Hk6k-aUeGSLCAW94oDwHQqX9GdVhgeM',
};

const SHEET_COLUMNS = [
  'Check','Hr','Day','วันที่ส่งงาน','No','ช่วงเวลา',
  'ประเภทงาน','จำนวนรูปหรือVDO','Job No.','แบรนด์',
  'ชื่อชิ้นงาน','เจ้าของงาน','กำหนดลงโพสต์จริง','Actual'
];

const CAPACITY_THRESHOLD = { green: 3, amber: 8 }; // >8 = red

// ---------- ENTRY POINTS ----------

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'getAll')      return jsonResponse(getAllData());
  if (action === 'getTasks')    return jsonResponse(getNotionTasks());
  if (action === 'getCapacity') return jsonResponse(getCapacityData());
  if (action === 'getBrands')   return jsonResponse(getNotionBrands());

  return HtmlService.createHtmlOutput(getHtml())
    .setTitle('GEM Graphic Capacity Board')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAllData() {
  const t0 = new Date();
  const props = PropertiesService.getScriptProperties().getProperties();
  console.log('Props keys:', Object.keys(props).join(', '));

  const capacity = getCapacityData();
  const t1 = new Date();
  console.log('getCapacityData: ' + (t1-t0) + 'ms');

  const tasks = getNotionTasks();
  const t2 = new Date();
  console.log('getNotionTasks: ' + (t2-t1) + 'ms');
  console.log('total: ' + (t2-t0) + 'ms');

  return {
    ok: capacity.ok && tasks.ok,
    capacity,
    tasks,
    timings: {
      capacity: t1-t0,
      tasks: t2-t1,
      total: t2-t0,
    }
  };
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.action === 'assign') {
    return jsonResponse(handleAssign(body));
  }
  if (body.action === 'markDone') {
    return jsonResponse(handleMarkDone(body));
  }
  if (body.action === 'relocate') {
    return jsonResponse(handleRelocate(body));
  }
  if (body.action === 'edit') {
    return jsonResponse(handleEditTask(body));
  }
  if (body.action === 'delete') {
    return jsonResponse(handleDeleteTask(body));
  }
  return jsonResponse({ ok: false, error: 'Unknown action' });
}

// ---------- DATA: NOTION ----------

function getNotionTasks() {
  const props = PropertiesService.getScriptProperties();
  const key   = props.getProperty('NOTION_API_KEY') || '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';
  const dbId  = '2e69dccd181d81df8919fbacf921c7d5';

  const payload = {
    filter: {
      property: 'Status',
      status: { equals: 'Not started' }
    },
    sorts: [{ property: 'Due Date', direction: 'ascending' }],
    page_size: 100
  };

  const res = notionFetch(`databases/${dbId}/query`, 'POST', payload, key);
  if (!res || !res.results) return { ok: false, tasks: [] };

  const tasks = res.results.map(p => {
    const props = p.properties;
    return {
      id:          p.id,
      url:         p.url,
      name:        props['Name']?.title?.[0]?.plain_text || '(ไม่มีชื่อ)',
      status:      props['Status']?.status?.name || '',
      dueDate:     props['Due Date']?.date?.start || '',
      workType:    (props['Work Type']?.multi_select || []).map(x => x.name).join(', '),
      assignee:    props['Graphic Assignee']?.select?.name || '',
      workBy:      (props['Work By']?.multi_select || []).map(x => x.name).join(', '),
      jobNumber:   props['Job Number']?.formula?.string || '',
      brandCode:   props['Brand Code']?.rollup?.array?.[0]?.formula?.string || '',
    };
  }).filter(t => !t.assignee); // เฉพาะที่ยังไม่ assign

  return { ok: true, tasks };
}

function getNotionBrands() {
  const props = PropertiesService.getScriptProperties();
  const key   = props.getProperty('NOTION_API_KEY') || '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';
  const dbId  = '2eb9dccd181d80debb97000b71806eef';

  const res = notionFetch(`databases/${dbId}/query`, 'POST', {
    sorts: [{ property: 'Name', direction: 'ascending' }],
    page_size: 100
  }, key);

  if (!res || !res.results) return { ok: false, brands: [] };

  const brands = res.results.map(p => ({
    id:   p.id,
    name: p.properties['Name']?.title?.[0]?.plain_text || '',
    code: p.properties['Client Code']?.rich_text?.[0]?.plain_text || '',
  })).filter(b => b.name);

  return { ok: true, brands };
}

// ============================================================
// REPLACE getCapacityData() ใน GEM_Capacity_Board.gs
// ด้วย function นี้ทั้งหมด
// ============================================================

function getCapacityData() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const windowStart = new Date(todayStart);
  windowStart.setDate(todayStart.getDate() - 14);

  const windowEnd = new Date(todayStart);
  windowEnd.setDate(todayStart.getDate() + 7);
  windowEnd.setHours(23, 59, 59, 999);

  const NAMES = ['จ๊ะเอ๋','อุ้ม','กิ๊บ','เป้','โชกุล','ท้อป','โอม'];
  const summary = {};
  NAMES.forEach(n => {
    summary[n] = { name: n, periodTasks: [], todayTasks: [], totalOpen: 0 };
  });

  const todayStr = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');

  const debugLogs = {};

  // วนลูปตามรายชื่อเพื่อดึงข้อมูลจากแต่ละ Sheet โดยตรง
  NAMES.forEach(personName => {
    const sheetId = SHEET_IDS[personName];
    if (!sheetId) return;

    debugLogs[personName] = {
      sheetId: sheetId,
      status: 'started',
      lastRow: 0,
      lastCol: 0,
      rowCount: 0,
      skippedNoDateOrName: 0,
      skippedInvalidDate: 0,
      skippedOutOfWindow: 0,
      skippedDoneOrCancelled: 0,
      okCount: 0,
      sampleRows: []
    };

    try {
      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheets()[0]; // ดึง Sheet แรกสุด
      const lastRow = Math.max(sheet.getLastRow(), 4);
      debugLogs[personName].lastRow = lastRow;
      if (lastRow < 5) {
        debugLogs[personName].status = 'skipped_lastrow_less_than_5';
        return;
      }

      const lastCol = sheet.getLastColumn();
      debugLogs[personName].lastCol = lastCol;
      if (lastCol < 11) {
        debugLogs[personName].status = 'skipped_col_less_than_11';
        return; // ไม่ใช่ Sheet งานที่ถูกต้อง
      }
      const data = sheet.getRange(5, 1, lastRow - 4, lastCol).getValues();
      debugLogs[personName].rowCount = data.length;

      data.forEach((row, index) => {
        const checkStatus = String(row[0] || ''); // Check
        const rawDate = row[4];                   // วันที่ส่งงาน (E)
        const workType = String(row[7] || '');    // ประเภทงาน (H)
        const brand = String(row[10] || '');      // แบรนด์ (K)
        const taskName = String(row[11] || '');   // ชื่อชิ้นงาน (L)

        if (debugLogs[personName].sampleRows.length < 5) {
          debugLogs[personName].sampleRows.push({
            rowIndex: index + 5,
            checkStatus,
            rawDateType: typeof rawDate,
            rawDateStr: String(rawDate),
            taskName,
            brand
          });
        }

        if (!rawDate || !taskName) {
          debugLogs[personName].skippedNoDateOrName++;
          return;
        }

        let taskDate;
        if (rawDate instanceof Date) {
          taskDate = rawDate;
        } else {
          const s = String(rawDate).trim();
          taskDate = new Date(s);
          if (isNaN(taskDate.getTime())) {
            // ลอง parse รูปแบบ dMMMyy (เช่น 9Jul26)
            const match = s.match(/^(\d{1,2})([A-Za-z]{3})(\d{2})$/);
            if (match) {
              const day = parseInt(match[1], 10);
              const mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const mIdx = mNames.findIndex(m => m.toLowerCase() === match[2].toLowerCase());
              const year = 2000 + parseInt(match[3], 10);
              if (mIdx >= 0) {
                taskDate = new Date(year, mIdx, day);
              }
            }
          }
        }
        
        if (!taskDate || isNaN(taskDate.getTime())) {
          debugLogs[personName].skippedInvalidDate++;
          return;
        }

        const taskDateStr = Utilities.formatDate(taskDate, 'Asia/Bangkok', 'yyyy-MM-dd');

        if (checkStatus === 'Done' || checkStatus === 'Cancelled') {
          debugLogs[personName].skippedDoneOrCancelled++;
          return;
        }

        // ยอดงานค้างรวม (totalOpen) นับตั้งแต่อดีตไปจนถึงอนาคต
        if (taskDate >= windowStart) {
          summary[personName].totalOpen++;
        }
        
        // ส่วนการแสดงผล Task ในกล่อง จะดึงเฉพาะช่วง ย้อนหลัง 14 วัน ถึง ล่วงหน้า 7 วัน
        if (taskDate >= windowStart && taskDate <= windowEnd) {
          debugLogs[personName].okCount++;
          const shortDate = Utilities.formatDate(taskDate, 'Asia/Bangkok', 'd MMM');
          const taskObj = { rowIndex: index + 5, name: taskName, brand, workType, dateStr: shortDate, rawDate: taskDateStr, status: checkStatus };
          
          if (taskDateStr === todayStr) {
            summary[personName].todayTasks.push(taskObj);
          } else {
            summary[personName].periodTasks.push(taskObj);
          }
        } else {
          debugLogs[personName].skippedOutOfWindow++;
        }
      });
      debugLogs[personName].status = 'success';
    } catch(e) {
      debugLogs[personName].status = 'error';
      debugLogs[personName].errorMsg = e.message;
      console.error(`Error reading sheet for ${personName}: ` + e.message);
    }
  });

  const people = NAMES.map(n => {
    const p = summary[n];
    const open = p.totalOpen;
    let flag = 'green';
    if (open > CAPACITY_THRESHOLD.amber) flag = 'red';
    else if (open > CAPACITY_THRESHOLD.green) flag = 'amber';

    p.periodTasks.sort((a,b) => a.rawDate.localeCompare(b.rawDate));

    return {
      name:       p.name,
      open,
      periodTasks: p.periodTasks,
      todayTasks:  p.todayTasks,
      flag,
      sheetId:    SHEET_IDS[n] || '',
    };
  });

  const fmtDate = d => Utilities.formatDate(d, 'Asia/Bangkok', 'd MMM');

  return {
    ok: true,
    people,
    windowRange: fmtDate(windowStart) + ' – ' + fmtDate(windowEnd),
    updatedAt: now.toISOString(),
    debugLogs
  };
}


// ---------- ACTION: MARK DONE ----------

function handleMarkDone(body) {
  const { assignee, rowIndex } = body;
  const sheetId = SHEET_IDS[assignee];
  if (!sheetId) return { ok: false, error: 'ไม่พบ Sheet ของ ' + assignee };
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheets()[0];
    sheet.getRange(rowIndex, 1).setValue('Done');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function handleEditTask(body) {
  const { assignee, rowIndex, oldTaskName, oldJobNumber, taskName, brand, workType, dueDate } = body;
  const sheetId = SHEET_IDS[assignee];
  if (!sheetId) return { ok: false, error: 'ไม่พบ Sheet ของ ' + assignee };
  
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheets()[0];
    
    // 1. อัปเดตใน Google Sheet
    let dueFormatted = '';
    if (dueDate) {
      dueFormatted = Utilities.formatDate(new Date(dueDate), 'Asia/Bangkok', 'dMMMyy');
    }
    
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dayStr = dueDate ? dayNames[new Date(dueDate).getDay()] : '';
    
    sheet.getRange(rowIndex, 4).setValue(dayStr);
    sheet.getRange(rowIndex, 5).setValue(dueFormatted);
    sheet.getRange(rowIndex, 8).setValue(workType || '');
    sheet.getRange(rowIndex, 11).setValue(brand || '');
    sheet.getRange(rowIndex, 12).setValue(taskName || '');
    
    // 2. ค้นหาและอัปเดตใน Notion
    const pageId = findNotionPageId(oldTaskName, oldJobNumber);
    if (pageId) {
      updateNotionTaskDetails(pageId, { taskName, dueDate, workType });
    }
    
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function updateNotionTaskDetails(pageId, details) {
  const key = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY') || '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';
  const cleanId = pageId.replace(/-/g, '');
  
  const workTypes = String(details.workType || '').split(',').map(s => s.trim()).filter(Boolean);
  const multiSelect = workTypes.map(name => ({ name }));
  
  const properties = {
    'Name': {
      title: [{ text: { content: details.taskName } }]
    },
    'Work Type': {
      multi_select: multiSelect
    }
  };
  
  if (details.dueDate) {
    properties['Due Date'] = {
      date: { start: details.dueDate }
    };
  } else {
    properties['Due Date'] = {
      date: null
    };
  }
  
  const res = notionFetch(`pages/${cleanId}`, 'PATCH', { properties }, key);
  if (!res || res.object === 'error') {
    console.error('Failed to update Notion task details: ' + (res?.message || 'Unknown error'));
  }
}

function handleDeleteTask(body) {
  const { assignee, rowIndex, taskName, jobNumber } = body;
  const sheetId = SHEET_IDS[assignee];
  if (!sheetId) return { ok: false, error: 'ไม่พบ Sheet ของ ' + assignee };
  
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheets()[0];
    
    // 1. ลบแถวใน Google Sheet
    sheet.deleteRow(rowIndex);
    
    // 2. ค้นหาใน Notion และลบ Assignee
    const pageId = findNotionPageId(taskName, jobNumber);
    if (pageId) {
      const key = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY') || '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';
      const cleanId = pageId.replace(/-/g, '');
      const res = notionFetch(`pages/${cleanId}`, 'PATCH', {
        properties: {
          'Graphic Assignee': {
            select: null
          }
        }
      }, key);
      if (!res || res.object === 'error') {
        console.error('Failed to clear Notion assignee: ' + (res?.message || 'Unknown error'));
      }
    }
    
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function handleRelocate(body) {
  const { fromAssignee, rowIndex, targetAssignee } = body;
  
  const fromSheetId = SHEET_IDS[fromAssignee];
  const targetSheetId = SHEET_IDS[targetAssignee];
  
  if (!fromSheetId) return { ok: false, error: 'ไม่พบ Sheet ของ ' + fromAssignee };
  if (!targetSheetId) return { ok: false, error: 'ไม่พบ Sheet ของ ' + targetAssignee };
  
  try {
    const fromSs = SpreadsheetApp.openById(fromSheetId);
    const fromSheet = fromSs.getSheets()[0];
    const lastCol = fromSheet.getLastColumn();
    
    // 1. อ่านข้อมูลแถวเดิมของคนเก่า
    const rowValues = fromSheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
    
    // 0: Check, 1: Hr, 2: (Hidden), 3: Day, 4: วันที่ส่งงาน, 5: No, 6: ช่วงเวลา, 7: ประเภทงาน, 8: จำนวน, 9: Job No., 10: แบรนด์, 11: ชื่อชิ้นงาน, 12: เจ้าของงาน, 13: กำหนดลงโพสต์จริง
    const rawDateVal = rowValues[4];
    let dueDate = '';
    if (rawDateVal instanceof Date) {
      dueDate = Utilities.formatDate(rawDateVal, 'Asia/Bangkok', 'yyyy-MM-dd');
    } else {
      const s = String(rawDateVal || '').trim();
      const match = s.match(/^(\d{1,2})([A-Za-z]{3})(\d{2})$/);
      if (match) {
        const day = parseInt(match[1], 10);
        const mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const mIdx = mNames.findIndex(m => m.toLowerCase() === match[2].toLowerCase());
        const year = 2000 + parseInt(match[3], 10);
        if (mIdx >= 0) {
          dueDate = Utilities.formatDate(new Date(year, mIdx, day), 'Asia/Bangkok', 'yyyy-MM-dd');
        }
      } else {
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
          dueDate = Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
        }
      }
    }

    const taskName = String(rowValues[11] || ''); // ชื่อชิ้นงาน (L - index 11)
    const brand = String(rowValues[10] || '');    // แบรนด์ (K - index 10)
    const workType = String(rowValues[7] || '');  // ประเภทงาน (H - index 7)
    const owner = String(rowValues[12] || '');     // เจ้าของงาน (M - index 12)
    const jobNumber = String(rowValues[9] || ''); // Job No. (J - index 9)

    if (!taskName) {
      return { ok: false, error: 'ไม่พบชื่อชิ้นงานในแถวที่จะย้าย' };
    }

    // 2. เขียนแถวใหม่ใน Sheet ของคนใหม่
    const writeResult = writeToPersonSheet(targetAssignee, {
      taskName,
      dueDate,
      brand,
      workType,
      owner,
      jobNumber
    });
    if (!writeResult.ok) {
      return { ok: false, error: 'ไม่สามารถเขียนลง Sheet คนใหม่ได้: ' + writeResult.error };
    }

    // 3. จัดการแถวเก่าใน Sheet ของคนเก่า (Option 1: เปลี่ยนเป็น Cancelled)
    fromSheet.getRange(rowIndex, 1).setValue('Cancelled');

    // 4. อัปเดต Notion
    const pageId = findNotionPageId(taskName, jobNumber);
    if (pageId) {
      updateNotionAssignee(pageId, targetAssignee);
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function findNotionPageId(taskName, jobNumber) {
  const props = PropertiesService.getScriptProperties();
  const key   = props.getProperty('NOTION_API_KEY') || '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';
  const dbId  = '2e69dccd181d81df8919fbacf921c7d5';

  const payload = {
    filter: {
      property: 'Name',
      title: { equals: taskName }
    },
    page_size: 10
  };

  try {
    const res = notionFetch(`databases/${dbId}/query`, 'POST', payload, key);
    if (res && res.results && res.results.length > 0) {
      if (jobNumber) {
        const match = res.results.find(p => {
          const props = p.properties;
          const jNum = props['Job Number']?.formula?.string || props['Job Number']?.rich_text?.[0]?.plain_text || '';
          return String(jNum).trim() === String(jobNumber).trim();
        });
        if (match) return match.id;
      }
      return res.results[0].id;
    }
  } catch (e) {
    console.error('Error finding Notion page ID: ' + e.message);
  }
  return null;
}

// ---------- ACTION: ASSIGN ----------

function handleAssign(body) {
  const { taskId, taskName, taskUrl, assignee, dueDate,
          brand, workType, owner, jobNumber } = body;

  const errors = [];

  // 1. อัปเดต Notion
  const notionResult = updateNotionAssignee(taskId, assignee);
  if (!notionResult.ok) errors.push('Notion: ' + notionResult.error);

  // 2. เขียน row ใน Sheet ของคนนั้น
  const sheetResult = writeToPersonSheet(assignee, {
    taskName, dueDate, brand, workType, owner, jobNumber
  });
  if (!sheetResult.ok) errors.push('Sheet: ' + sheetResult.error);

  if (errors.length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    message: `Assign "${taskName}" → ${assignee} เสร็จแล้ว`,
    notionUrl: taskUrl,
    sheetRow: sheetResult.row
  };
}

function updateNotionAssignee(pageId, assigneeName) {
  const key = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY') || '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';
  const cleanId = pageId.replace(/-/g, '');

  const res = notionFetch(`pages/${cleanId}`, 'PATCH', {
    properties: {
      'Graphic Assignee': {
        select: { name: assigneeName }
      }
    }
  }, key);

  if (!res || res.object === 'error') {
    return { ok: false, error: res?.message || 'Notion API error' };
  }
  return { ok: true };
}

function writeToPersonSheet(assignee, task) {
  const sheetId = SHEET_IDS[assignee];
  if (!sheetId) return { ok: false, error: `ไม่พบ Sheet ของ ${assignee}` };

  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheets()[0]; // Sheet แรก (Sheet1)

    // หาแถวสุดท้ายที่มีข้อมูล
    const lastRow = Math.max(sheet.getLastRow(), 4);

    // แปลงวันที่
    const dueFormatted = task.dueDate
      ? Utilities.formatDate(new Date(task.dueDate), 'Asia/Bangkok', 'dMMMyy')
      : '';

    // Day of week
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dayStr = task.dueDate
      ? dayNames[new Date(task.dueDate).getDay()]
      : '';

    // วาง row ใหม่ตาม column structure ของ Sheet:
    // Check | Hr | (Hidden) | Day | วันที่ส่งงาน | No | ช่วงเวลา | ประเภทงาน | จำนวน | Job No. | แบรนด์ | ชื่อชิ้นงาน | เจ้าของงาน | กำหนดโพสต์ | Actual
    const newRow = [
      '',                    // Check — PM กรอกเอง (0) -> A
      '',                    // Hr (1) -> B
      '',                    // (Hidden/dropdown) (2) -> C
      dayStr,                // Day (3) -> D
      dueFormatted,          // วันที่ส่งงาน (4) -> E
      task.jobNumber || '',  // No / Job Number (5) -> F
      '09.00 - 18.00',       // ช่วงเวลา (default) (6) -> G
      task.workType || '',   // ประเภทงาน (7) -> H
      '',                    // จำนวนรูป/VDO (8) -> I
      task.jobNumber || '',  // Job No. (9) -> J
      task.brand || '',      // แบรนด์ (10) -> K
      task.taskName || '',   // ชื่อชิ้นงาน (11) -> L
      task.owner || '',      // เจ้าของงาน (12) -> M
      '',                    // กำหนดลงโพสต์จริง (13) -> N
    ];

    sheet.getRange(lastRow + 1, 1, 1, newRow.length).setValues([newRow]);

    return { ok: true, row: lastRow + 1 };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---------- NOTION HELPER ----------

function notionFetch(endpoint, method, payload, key) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  };
  if (payload) options.payload = JSON.stringify(payload);

  const res = UrlFetchApp.fetch(`https://api.notion.com/v1/${endpoint}`, options);
  try {
    return JSON.parse(res.getContentText());
  } catch (e) {
    return null;
  }
}

// ---------- JSON HELPER ----------

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- HTML APP ----------

function getHtml() {
  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>GEM Graphic Capacity Board</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'IBM Plex Sans Thai',sans-serif;background:#f5f4f0;color:#1a1a18;height:100vh;display:flex;flex-direction:column;overflow:hidden}
header{background:#fff;border-bottom:1px solid #e5e3dd;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.logo{font-size:13px;font-weight:500;color:#1a1a18}
.logo span{color:#aaa}
.sync{font-size:12px;color:#aaa}
.board{display:grid;grid-template-columns:1fr 1.4fr;gap:12px;padding:12px;flex:1;min-height:0}
@media(max-width:700px){
  body{height:auto;overflow:auto}
  .board{grid-template-columns:1fr;grid-template-rows:auto auto;flex:none;height:auto;padding:8px;gap:8px}
  .panel{min-height:320px;max-height:70vh}
  header{padding:8px 14px}
  .logo{font-size:12px}
}
.panel{background:#fff;border:1px solid #e5e3dd;border-radius:12px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.ph{padding:10px 14px;border-bottom:1px solid #e5e3dd;flex-shrink:0}
.ph-row{display:flex;align-items:center;justify-content:space-between}
.pt{font-size:11px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:.05em}
.pc{font-size:11px;color:#aaa}
.cond{font-size:10px;color:#bbb;margin-top:4px}
.pb{overflow-y:auto;flex:1;padding:10px}
.person-card{border:1px solid #e5e3dd;border-radius:8px;padding:9px 11px;margin-bottom:7px;cursor:pointer;background:#fff;transition:border-color .15s}
.person-card:hover{border-color:#bbb}
.person-card.selected{border-color:#378ADD;background:#EBF4FD}
.person-card.drag-over{border-color:#378ADD;border-style:dashed;background:#EBF4FD}
.pr{display:flex;align-items:center;gap:9px}
.av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;flex-shrink:0}
.pi{flex:1;min-width:0}
.pn{font-size:13px;font-weight:500}
.ps{font-size:11px;color:#aaa;margin-top:1px}
.badge{font-size:10px;font-weight:500;padding:2px 7px;border-radius:20px;flex-shrink:0}
.g{background:#EAF3DE;color:#3B6D11}
.a{background:#FAEEDA;color:#854F0B}
.r{background:#FCEBEB;color:#A32D2D}
.bw{display:flex;align-items:center;gap:7px;margin-top:5px}
.bb{flex:1;height:3px;background:#eee;border-radius:2px;overflow:hidden}
.bf{height:100%;border-radius:2px}
.bl{font-size:10px;color:#bbb;min-width:20px;text-align:right}
.today-box{margin-top:5px;padding:5px 8px;background:#f9f8f5;border-radius:6px;border:1px solid #ece9e3;font-size:11px;max-height:160px;overflow-y:auto;}
.today-lbl{color:#aaa;margin-bottom:2px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;position:sticky;top:0;background:#f9f8f5;padding-bottom:2px;z-index:1;}
.today-item{display:flex;align-items:center;padding:2px 0;gap:4px;}
.task-name-text{flex:1;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.today-item.is-today .task-name-text{color:#D83B01;font-weight:600;}
.task-date{font-size:9px;color:#999;display:inline-block;width:35px;flex-shrink:0;}
.today-item-actions{display:flex;align-items:center;gap:3px;margin-left:auto;flex-shrink:0}
.btn-done,.btn-edit,.btn-delete{background:transparent;border:1px solid #ddd;color:#888;border-radius:4px;padding:2px 5px;font-size:9px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center}
.btn-done:hover{background:#EAF3DE;border-color:#639922;color:#3B6D11}
.btn-edit:hover{background:#EBF4FD;border-color:#378ADD;color:#185FA5}
.btn-delete:hover{background:#FCEBEB;border-color:#E24B4A;color:#A32D2D}
.btn-done:disabled,.btn-edit:disabled,.btn-delete:disabled{opacity:0.5;cursor:default}
.modal-backdrop{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:1000;opacity:0;pointer-events:none;transition:opacity .2s}
.modal-backdrop.show{opacity:1;pointer-events:auto}
.modal-box{background:#fff;border-radius:12px;border:1px solid #e5e3dd;width:90%;max-width:360px;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,0.12);transform:scale(0.95);transition:transform .2s}
.modal-backdrop.show .modal-box{transform:scale(1)}
.modal-title{font-size:13px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.modal-form-group{margin-bottom:10px}
.modal-form-group label{display:block;font-size:10px;color:#888;margin-bottom:3px;text-transform:uppercase;font-weight:500}
.modal-form-group input{width:100%;padding:6px 9px;border:1px solid #ddd;border-radius:6px;font-size:12px;background:#fff;color:#1a1a18}
.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
.modal-btn{padding:6px 12px;font-size:11px;font-weight:500;border:1px solid #ddd;border-radius:6px;background:#fff;color:#555;cursor:pointer}
.modal-btn-save{border-color:#378ADD;background:#EBF4FD;color:#185FA5}
.modal-btn-save:hover{background:#378ADD;color:#fff}
.modal-btn-cancel:hover{background:#f5f4f0}
.task-item{border:1px solid #e5e3dd;border-radius:8px;padding:9px 11px;margin-bottom:7px;cursor:pointer;background:#fff;transition:border-color .15s}
.task-item:hover{border-color:#bbb}
.task-item.selected{border-color:#378ADD;background:#EBF4FD}
.tn{font-size:12px;font-weight:500;line-height:1.4;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm{display:flex;flex-wrap:wrap;gap:3px}
.tag{font-size:10px;padding:1px 6px;border-radius:4px;background:#f5f4f0;border:1px solid #e5e3dd;color:#777}
.tag-due{color:#854F0B}
.tag-late{color:#A32D2D}
.abar{padding:10px 14px;border-top:1px solid #e5e3dd;background:#fafaf8;display:flex;gap:8px;align-items:center;flex-shrink:0}
.abar select{flex:1;font-size:12px;padding:6px 9px;border:1px solid #ddd;border-radius:7px;background:#fff;color:#1a1a18}
.abtn{padding:6px 16px;font-size:12px;font-weight:500;border:1px solid #378ADD;border-radius:7px;background:#EBF4FD;color:#185FA5;cursor:pointer;white-space:nowrap}
.abtn:not(:disabled):hover{background:#378ADD;color:#fff}
.abtn:disabled{opacity:.4;cursor:default}
@media(max-width:700px){
  .abar{padding:8px 10px;position:sticky;bottom:0}
  .abar select{font-size:14px;padding:8px 10px}
  .abtn{padding:8px 18px;font-size:14px}
  .ph{padding:8px 12px}
  .pb{padding:8px}
  .person-card,.task-item{padding:8px 10px;margin-bottom:6px}
  .pn,.tn{font-size:14px}
  .ps,.tm{font-size:12px}
  .badge{font-size:11px;padding:3px 8px}
}
.empty{text-align:center;padding:36px 0;color:#bbb;font-size:12px}
.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#1a1a18;color:#fff;padding:8px 16px;border-radius:8px;font-size:12px;opacity:0;transition:opacity .25s;pointer-events:none;z-index:999;white-space:nowrap}
.toast.show{opacity:1}
</style>
</head>
<body>
<header>
  <div class="logo">GEM <span>/</span> Graphic Capacity Board</div>
  <div class="sync" id="sync-info">กำลังโหลด...</div>
</header>
<div class="board">
  <div class="panel">
    <div class="ph">
      <div class="ph-row">
        <span class="pt"><i class="ti ti-users"></i> Graphic team</span>
        <span class="pc" id="week-badge"></span>
      </div>
      <div class="cond">งานค้าง = Check ≠ Done/Cancelled (ย้อนหลัง 14 วัน - ล่วงหน้า 7 วัน)</div>
    </div>
    <div class="pb" id="people-panel"><div class="empty">กำลังดึงข้อมูล...</div></div>
  </div>
  <div class="panel">
    <div class="ph">
      <div class="ph-row">
        <span class="pt"><i class="ti ti-clipboard-list"></i> งานรอ assign</span>
        <span class="pc" id="task-count"></span>
      </div>
      <div class="cond">Status = Not started · ยังไม่มี Graphic Assignee</div>
    </div>
    <div class="pb" id="task-panel"><div class="empty">กำลังดึงข้อมูล...</div></div>
    <div class="abar">
      <select id="sel-assignee"><option value="">เลือก graphic...</option></select>
      <button class="abtn" id="btn-assign" disabled>Assign</button>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>

<!-- Edit Modal -->
<div class="modal-backdrop" id="edit-modal">
  <div class="modal-box">
    <div class="modal-title">
      <i class="ti ti-edit" style="color:#378ADD"></i> แก้ไขข้อมูลงาน
    </div>
    <input type="hidden" id="edit-assignee">
    <input type="hidden" id="edit-row-index">
    <input type="hidden" id="edit-old-task-name">
    <input type="hidden" id="edit-old-job-number">
    
    <div class="modal-form-group">
      <label for="edit-task-name">ชื่อชิ้นงาน</label>
      <input type="text" id="edit-task-name">
    </div>
    <div class="modal-form-group">
      <label for="edit-brand">แบรนด์</label>
      <input type="text" id="edit-brand">
    </div>
    <div class="modal-form-group">
      <label for="edit-work-type">ประเภทงาน</label>
      <input type="text" id="edit-work-type">
    </div>
    <div class="modal-form-group">
      <label for="edit-due-date">วันที่ส่งงาน (เช่น 9Jul26 หรือ yyyy-MM-dd)</label>
      <input type="text" id="edit-due-date">
    </div>
    
    <div class="modal-actions">
      <button class="modal-btn modal-btn-cancel" onclick="closeEditModal()">ยกเลิก</button>
      <button class="modal-btn modal-btn-save" id="btn-save-edit" onclick="saveEditTask()">บันทึก</button>
    </div>
  </div>
</div>

<script>
const COLORS = {
  'จ๊ะเอ๋':{bg:'#E6F1FB',fg:'#185FA5'},
  'อุ้ม':  {bg:'#E1F5EE',fg:'#0F6E56'},
  'กิ๊บ': {bg:'#FAEEDA',fg:'#854F0B'},
  'เป้':  {bg:'#FCEBEB',fg:'#A32D2D'},
  'โชกุล':{bg:'#EEEDFE',fg:'#3C3489'},
  'ท้อป': {bg:'#E1F5EE',fg:'#085041'},
  'โอม':  {bg:'#FBEAF0',fg:'#72243E'},
};
let state = {people:[], tasks:[], selectedTask:null};

function esc(str) {
  return String(str || '')
    .replace(/\\\\/g, '\\\\\\\\')
    .replace(/'/g, '\\\\\\\'')
    .replace(/"/g, '&quot;');
}

function init() {
  google.script.run
    .withSuccessHandler(function(res) {
      const cap = res.capacity || {};
      const tasks = res.tasks || {};
      if (cap.ok) {
        state.people = cap.people || [];
        const ms = res.timings ? res.timings.total : 0;
        document.getElementById('sync-info').textContent = 'อัปเดต ' + new Date(cap.updatedAt).toLocaleTimeString('th-TH') + ' (' + ms + 'ms)';
      } else {
        document.getElementById('sync-info').textContent = 'โหลด capacity ไม่สำเร็จ';
      }
      if (tasks.ok) {
        state.tasks = tasks.tasks || [];
      } else {
        document.getElementById('sync-info').textContent = 'โหลด tasks ไม่สำเร็จ';
      }
      const sel = document.getElementById('sel-assignee');
      state.people.slice().sort(function(a,b){return a.open-b.open;}).forEach(function(p) {
        const o = document.createElement('option');
        o.value = p.name;
        o.textContent = p.name + ' (' + p.open + ' งานค้าง)';
        sel.appendChild(o);
      });
      document.getElementById('week-badge').textContent = (cap.windowRange || '');
      renderPeople();
      renderTasks();
    })
    .withFailureHandler(function(err) {
      document.getElementById('sync-info').textContent = 'Error: ' + err.message;
    })
    .getAllData();
}

function renderPeople() {
  const el = document.getElementById('people-panel');
  el.innerHTML = '';
  const sorted = state.people.slice().sort(function(a,b){return a.open-b.open;});
  sorted.forEach(function(p) {
    const pct = Math.min(100, Math.round((p.open/14)*100));
    const flag = p.flag;
    const bc = flag==='green'?'g':flag==='amber'?'a':'r';
    const bl = flag==='green'?'ว่าง':flag==='amber'?'ปานกลาง':'ยุ่ง';
    const barC = flag==='green'?'#639922':flag==='amber'?'#EF9F27':'#E24B4A';
    const c = COLORS[p.name]||{bg:'#f0efea',fg:'#555'};
    let todayHtml = '';
    const allTasksCount = (p.todayTasks ? p.todayTasks.length : 0) + (p.periodTasks ? p.periodTasks.length : 0);
    
    if (allTasksCount > 0) {
      let tItems = (p.todayTasks || []).map(function(t){
        const escName = esc(t.name);
        const escBrand = esc(t.brand);
        const escWorkType = esc(t.workType);
        const escDate = esc(t.rawDate);
        const escJob = esc(t.jobNumber);
        return '<div class="today-item is-today" draggable="true" ondragstart="handleAssignedDragStart(event, &quot;'+p.name+'&quot;, '+t.rowIndex+')">'
             + '<span class="task-date">วันนี้</span>'
             + '<span class="task-name-text" title="'+escName+'">\u00b7 '+t.name+'</span>'
             + '<div class="today-item-actions" onclick="event.stopPropagation()">'
             + '<button class="btn-done" onclick="markTaskDone(&quot;'+p.name+'&quot;, '+t.rowIndex+', this, event)" title="ทำเสร็จแล้ว">✔</button>'
             + '<button class="btn-edit" onclick="openEditModal(&quot;'+p.name+'&quot;, '+t.rowIndex+', &quot;'+escName+'&quot;, &quot;'+escBrand+'&quot;, &quot;'+escWorkType+'&quot;, &quot;'+escDate+'&quot;, &quot;'+escJob+'&quot;)" title="แก้ไข">✎</button>'
             + '<button class="btn-delete" onclick="deleteTask(&quot;'+p.name+'&quot;, '+t.rowIndex+', &quot;'+escName+'&quot;, &quot;'+escJob+'&quot;, this)" title="ลบงาน">🗑</button>'
             + '</div></div>';
      }).join('');
      let pItems = (p.periodTasks || []).map(function(t){
        const escName = esc(t.name);
        const escBrand = esc(t.brand);
        const escWorkType = esc(t.workType);
        const escDate = esc(t.rawDate);
        const escJob = esc(t.jobNumber);
        return '<div class="today-item" draggable="true" ondragstart="handleAssignedDragStart(event, &quot;'+p.name+'&quot;, '+t.rowIndex+')">'
             + '<span class="task-date">'+t.dateStr+'</span>'
             + '<span class="task-name-text" title="'+escName+'">\u00b7 '+t.name+'</span>'
             + '<div class="today-item-actions" onclick="event.stopPropagation()">'
             + '<button class="btn-done" onclick="markTaskDone(&quot;'+p.name+'&quot;, '+t.rowIndex+', this, event)" title="ทำเสร็จแล้ว">✔</button>'
             + '<button class="btn-edit" onclick="openEditModal(&quot;'+p.name+'&quot;, '+t.rowIndex+', &quot;'+escName+'&quot;, &quot;'+escBrand+'&quot;, &quot;'+escWorkType+'&quot;, &quot;'+escDate+'&quot;, &quot;'+escJob+'&quot;)" title="แก้ไข">✎</button>'
             + '<button class="btn-delete" onclick="deleteTask(&quot;'+p.name+'&quot;, '+t.rowIndex+', &quot;'+escName+'&quot;, &quot;'+escJob+'&quot;, this)" title="ลบงาน">🗑</button>'
             + '</div></div>';
      }).join('');
      
      todayHtml = '<div class="today-box">'
                + '<div class="today-lbl">งาน ('+allTasksCount+' งาน)</div>'
                + tItems + pItems
                + '</div>';
    } else {
      todayHtml = '<div class="today-box" style="background:#EAF3DE;border-color:#C0DD97"><div style="color:#3B6D11;font-size:10px">ไม่มีงานในช่วงนี้</div></div>';
    }
    const card = document.createElement('div');
    card.className = 'person-card';
    card.innerHTML =
      '<div class="pr">'
      +'<div class="av" style="background:'+c.bg+';color:'+c.fg+'">'+p.name.substring(0,2)+'</div>'
      +'<div class="pi"><div class="pn">'+p.name+'</div><div class="ps">งานค้าง '+p.open+' งาน</div></div>'
      +'<span class="badge '+bc+'">'+bl+'</span>'
      +'</div>'
      +'<div class="bw"><div class="bb"><div class="bf" style="width:'+pct+'%;background:'+barC+'"></div></div>'
      +'<span class="bl">'+p.open+'</span></div>'
      +todayHtml;
    
    // Drag & Drop event handlers on target designer card
    card.ondragover = function(event) {
      event.preventDefault();
      card.classList.add('drag-over');
    };
    card.ondragleave = function() {
      card.classList.remove('drag-over');
    };
    card.ondrop = function(event) {
      card.classList.remove('drag-over');
      const source = event.dataTransfer.getData('source');
      if (source === 'unassigned') {
        const taskId = event.dataTransfer.getData('taskId');
        assignTaskViaDrag(taskId, p.name);
      } else if (source === 'assigned') {
        const fromAssignee = event.dataTransfer.getData('fromAssignee');
        const rowIndex = parseInt(event.dataTransfer.getData('rowIndex'), 10);
        if (fromAssignee !== p.name) {
          relocateTaskViaDrag(fromAssignee, rowIndex, p.name);
        }
      }
    };

    card.onclick = function() {
      document.getElementById('sel-assignee').value = p.name;
      updateBtn();
      document.querySelectorAll('.person-card').forEach(function(c){c.classList.remove('selected');});
      card.classList.add('selected');
    };
    el.appendChild(card);
  });
}

function renderTasks() {
  const el = document.getElementById('task-panel');
  document.getElementById('task-count').textContent = state.tasks.length + ' งาน';
  el.innerHTML = '';
  if (!state.tasks.length) {
    el.innerHTML = '<div class="empty"><i class="ti ti-circle-check" style="font-size:28px;display:block;margin:0 auto 8px;color:#639922"></i>ไม่มีงานรอ assign</div>';
    return;
  }

  // group by brand
  const groups = {};
  state.tasks.forEach(function(t) {
    const brand = t.brandCode || '(ไม่ระบุแบรนด์)';
    if (!groups[brand]) groups[brand] = [];
    groups[brand].push(t);
  });

  // เรียง brand alphabetically
  const brandNames = Object.keys(groups).sort();

  // auto-generate สีจาก brand name (hue จาก hash)
  function brandColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return {
      bg: 'hsl(' + hue + ',60%,94%)',
      border: 'hsl(' + hue + ',45%,80%)',
      text: 'hsl(' + hue + ',50%,30%)',
      dot: 'hsl(' + hue + ',55%,55%)',
    };
  }

  brandNames.forEach(function(brand) {
    const tasks = groups[brand].sort(function(a,b) {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
    const c = brandColor(brand);

    // brand header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:6px;margin:10px 0 5px;padding:5px 8px;'
      + 'background:'+c.bg+';border:1px solid '+c.border+';border-radius:6px;';
    header.innerHTML =
      '<div style="width:8px;height:8px;border-radius:50%;background:'+c.dot+';flex-shrink:0"></div>'
      +'<span style="font-size:11px;font-weight:500;color:'+c.text+';letter-spacing:.03em">'+brand+'</span>'
      +'<span style="font-size:10px;color:'+c.text+';opacity:.7;margin-left:auto">'+tasks.length+' งาน</span>';
    el.appendChild(header);

    tasks.forEach(function(t) {
      const item = document.createElement('div');
      item.className = 'task-item'+(state.selectedTask===t.id?' selected':'');
      item.style.borderLeft = '3px solid '+c.dot;
      
      // Make draggable
      item.setAttribute('draggable', 'true');
      item.ondragstart = function(event) {
        event.dataTransfer.setData('source', 'unassigned');
        event.dataTransfer.setData('taskId', t.id);
      };

      const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString('th-TH',{day:'numeric',month:'short'}) : '';
      const now = new Date();
      const dueD = t.dueDate ? new Date(t.dueDate) : null;
      const dueC = dueD?(dueD<now?'tag-late':(dueD-now<7*864e5?'tag-due':'')):'';
      item.innerHTML =
        '<div class="tn" title="'+t.name+'">'+t.name+'</div>'
        +'<div class="tm">'
        +(t.workType?'<span class="tag">'+t.workType+'</span>':'')
        +(due?'<span class="tag '+dueC+'"><i class="ti ti-calendar" style="font-size:10px"></i> '+due+'</span>':'')
        +'</div>';
      item.onclick = function() {
        state.selectedTask = state.selectedTask===t.id?null:t.id;
        renderTasks();
        updateBtn();
      };
      el.appendChild(item);
    });
  });
}

function updateBtn() {
  const sel = document.getElementById('sel-assignee').value;
  document.getElementById('btn-assign').disabled = !(state.selectedTask && sel);
}

document.getElementById('sel-assignee').addEventListener('change', updateBtn);

document.getElementById('btn-assign').addEventListener('click', function() {
  const assignee = document.getElementById('sel-assignee').value;
  const task = state.tasks.find(function(t){return t.id===state.selectedTask;});
  if (!task||!assignee) return;
  const btn = document.getElementById('btn-assign');
  btn.disabled = true;
  btn.textContent = 'กำลัง assign...';
  google.script.run
    .withSuccessHandler(function(res) {
      btn.textContent = 'Assign';
      if (res.ok) {
        showToast('Assign "'+task.name+'" \u2192 '+assignee+' เสร็จแล้ว');
        state.tasks = state.tasks.filter(function(t){return t.id!==task.id;});
        const person = state.people.find(function(p){return p.name===assignee;});
        if (person) person.open = Math.max(0,person.open+1);
        state.selectedTask = null;
        document.getElementById('sel-assignee').value = '';
        document.querySelectorAll('.person-card').forEach(function(c){c.classList.remove('selected');});
        renderPeople(); renderTasks(); updateBtn();
      } else {
        showToast('Error: '+(res.errors||[]).join(', '));
        btn.disabled = false;
      }
    })
    .withFailureHandler(function(err) {
      btn.textContent = 'Assign';
      showToast('Error: '+err.message);
      btn.disabled = false;
    })
    .handleAssign({
      action:'assign', taskId:task.id, taskName:task.name, taskUrl:task.url,
      assignee:assignee, dueDate:task.dueDate, brand:task.brandCode,
      workType:task.workType, owner:task.workBy, jobNumber:task.jobNumber,
    });
});

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');}, 3000);
}

function markTaskDone(assignee, rowIndex, btn, e) {
  e.stopPropagation(); // กันไม่ให้ไปคลิกเลือกคน
  btn.disabled = true;
  btn.textContent = '...';
  google.script.run
    .withSuccessHandler(function(res) {
      if (res.ok) {
        showToast('ทำเครื่องหมาย Done แล้ว!');
        btn.parentElement.style.opacity = '0.4';
        btn.remove(); // เอาปุ่มออก
        
        // หักลบจำนวนใน state แล้วสั่งเรนเดอร์ใหม่
        const person = state.people.find(function(p){return p.name===assignee;});
        if (person) {
          person.open = Math.max(0, person.open - 1);
          if (person.todayTasks) person.todayTasks = person.todayTasks.filter(function(t){return t.rowIndex!==rowIndex;});
          if (person.periodTasks) person.periodTasks = person.periodTasks.filter(function(t){return t.rowIndex!==rowIndex;});
          renderPeople();
        }
      } else {
        showToast('Error: ' + res.error);
        btn.disabled = false;
        btn.textContent = '✔ Done';
      }
    })
    .withFailureHandler(function(err) {
      showToast('Error: ' + err.message);
      btn.disabled = false;
      btn.textContent = '✔ Done';
    })
    .handleMarkDone({action:'markDone', assignee:assignee, rowIndex:rowIndex});
}

function handleAssignedDragStart(event, fromAssignee, rowIndex) {
  event.dataTransfer.setData('source', 'assigned');
  event.dataTransfer.setData('fromAssignee', fromAssignee);
  event.dataTransfer.setData('rowIndex', rowIndex);
}

function assignTaskViaDrag(taskId, targetAssignee) {
  const task = state.tasks.find(function(t){return t.id===taskId;});
  if (!task || !targetAssignee) return;
  showToast('กำลังมอบหมายงาน...');
  google.script.run
    .withSuccessHandler(function(res) {
      if (res.ok) {
        showToast('Assign "' + task.name + '" \u2192 ' + targetAssignee + ' เสร็จแล้ว');
        state.tasks = state.tasks.filter(function(t){return t.id!==task.id;});
        const person = state.people.find(function(p){return p.name===targetAssignee;});
        if (person) {
          person.open = Math.max(0, person.open + 1);
          // ดึงข้อมูลรอบใหม่เพื่อดึงงานเข้าแถวในตัวคน
          google.script.run
            .withSuccessHandler(function(allData) {
              if (allData.ok) {
                state.people = allData.capacity.people;
                renderPeople();
              }
            })
            .getAllData();
        }
        state.selectedTask = null;
        renderTasks();
        updateBtn();
      } else {
        showToast('Error: ' + (res.errors || []).join(', '));
      }
    })
    .withFailureHandler(function(err) {
      showToast('Error: ' + err.message);
    })
    .handleAssign({
      action: 'assign', taskId: task.id, taskName: task.name, taskUrl: task.url,
      assignee: targetAssignee, dueDate: task.dueDate, brand: task.brandCode,
      workType: task.workType, owner: task.workBy, jobNumber: task.jobNumber
    });
}

function relocateTaskViaDrag(fromAssignee, rowIndex, targetAssignee) {
  showToast('กำลังย้ายงาน...');
  google.script.run
    .withSuccessHandler(function(res) {
      if (res.ok) {
        showToast('ย้ายงาน \u2192 ' + targetAssignee + ' สำเร็จ!');
        // ดึงข้อมูลใหม่เพื่อให้อัปเดตตารางและจำนวนของทั้งสองคน
        google.script.run
          .withSuccessHandler(function(allData) {
            if (allData.ok) {
              state.people = allData.capacity.people;
              state.tasks = allData.tasks.tasks;
              renderPeople();
              renderTasks();
            }
          })
          .getAllData();
      } else {
        showToast('Error: ' + res.error);
      }
    })
    .withFailureHandler(function(err) {
      showToast('Error: ' + err.message);
    })
    .handleRelocate({
      action: 'relocate',
      fromAssignee: fromAssignee,
      rowIndex: rowIndex,
      targetAssignee: targetAssignee
    });
}

function openEditModal(assignee, rowIndex, name, brand, workType, rawDate, jobNumber) {
  document.getElementById('edit-assignee').value = assignee;
  document.getElementById('edit-row-index').value = rowIndex;
  document.getElementById('edit-old-task-name').value = name;
  document.getElementById('edit-old-job-number').value = jobNumber || '';
  
  document.getElementById('edit-task-name').value = name;
  document.getElementById('edit-brand').value = brand || '';
  document.getElementById('edit-work-type').value = workType || '';
  document.getElementById('edit-due-date').value = rawDate || '';
  
  document.getElementById('edit-modal').classList.add('show');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('show');
}

function saveEditTask() {
  const assignee = document.getElementById('edit-assignee').value;
  const rowIndex = parseInt(document.getElementById('edit-row-index').value, 10);
  const oldTaskName = document.getElementById('edit-old-task-name').value;
  const oldJobNumber = document.getElementById('edit-old-job-number').value;
  
  const taskName = document.getElementById('edit-task-name').value;
  const brand = document.getElementById('edit-brand').value;
  const workType = document.getElementById('edit-work-type').value;
  const dueDate = document.getElementById('edit-due-date').value;
  
  if (!taskName) {
    showToast('กรุณากรอกชื่อชิ้นงาน');
    return;
  }
  
  const btn = document.getElementById('btn-save-edit');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';
  
  google.script.run
    .withSuccessHandler(function(res) {
      btn.disabled = false;
      btn.textContent = 'บันทึก';
      if (res.ok) {
        showToast('แก้ไขข้อมูลงานสำเร็จ!');
        closeEditModal();
        google.script.run
          .withSuccessHandler(function(allData) {
            if (allData.ok) {
              state.people = allData.capacity.people;
              state.tasks = allData.tasks.tasks;
              renderPeople();
              renderTasks();
            }
          })
          .getAllData();
      } else {
        showToast('Error: ' + res.error);
      }
    })
    .withFailureHandler(function(err) {
      btn.disabled = false;
      btn.textContent = 'บันทึก';
      showToast('Error: ' + err.message);
    })
    .handleEditTask({
      action: 'edit',
      assignee: assignee,
      rowIndex: rowIndex,
      oldTaskName: oldTaskName,
      oldJobNumber: oldJobNumber,
      taskName: taskName,
      brand: brand,
      workType: workType,
      dueDate: dueDate
    });
}

function deleteTask(assignee, rowIndex, taskName, jobNumber, btn) {
  if (!confirm('ต้องการลบงาน "' + taskName + '" ใช่หรือไม่?\\n(งานจะหายไปจากตารางดีไซเนอร์ และกลับไปอยู่ที่งานรอ Assign ใน Notion)')) {
    return;
  }
  btn.disabled = true;
  google.script.run
    .withSuccessHandler(function(res) {
      if (res.ok) {
        showToast('ลบงานเรียบร้อย!');
        google.script.run
          .withSuccessHandler(function(allData) {
            if (allData.ok) {
              state.people = allData.capacity.people;
              state.tasks = allData.tasks.tasks;
              renderPeople();
              renderTasks();
            }
          })
          .getAllData();
      } else {
        showToast('Error: ' + res.error);
        btn.disabled = false;
      }
    })
    .withFailureHandler(function(err) {
      showToast('Error: ' + err.message);
      btn.disabled = false;
    })
    .handleDeleteTask({
      action: 'delete',
      assignee: assignee,
      rowIndex: rowIndex,
      taskName: taskName,
      jobNumber: jobNumber
    });
}

init();
</script>
</body>
</html>`;
} 
