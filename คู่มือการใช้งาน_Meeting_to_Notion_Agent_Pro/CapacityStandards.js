// ============================================================
// CapacityStandards.js -- MIRROR of the Capacity Board's Notion rules
// ============================================================
// Copied verbatim from GEM_Capacity_Board/Code.js (as of main @ 2026-11-17)
// so a Project/Task created from Meeting Agent gets exactly the same
// Brand / Contacts / Scope Item / Service Type / Owner and the same
// Work By / Task Type / Financial Risk defaults as one made on the board.
// Meeting Agent stays its own Apps Script project (P'Ohm 2026-11-17: do not
// merge it into Capacity Board), so this is a copy, not a shared library:
// when one of these rules changes on the board, change it here too.
// Graphic assignment (Graphic Assignee / writeToPersonSheet) is deliberately
// NOT mirrored -- PMs assign graphic work on the Capacity Board.
// ============================================================

// Service Type "Brand Management" — Project กลุ่มนี้ไม่มี Task ประเภท Graphic
// ให้สร้างผ่านบอร์ดนี้ เลยตัดออกจาก dropdown
const SERVICE_TYPE_BRAND_MANAGEMENT_ID = '2f09dccd-181d-8059-b2a6-cfa7b4a18b1e';

function getNotionProjects() {
  const key = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY');
  const dbId = '2e69dccd181d81fabee1e65a00e86e72'; // Projects DB
  const filter = {
    and: [
      { property: 'Status', status: { does_not_equal: 'Done' } },
      { property: 'Status', status: { does_not_equal: 'Archived' } },
      { property: 'Service Type', relation: { does_not_contain: SERVICE_TYPE_BRAND_MANAGEMENT_ID } },
    ]
  };

  let allResults = [];
  let cursor = null;
  do {
    const payload = { page_size: 100, filter: filter };
    if (cursor) payload.start_cursor = cursor;
    const res = notionFetch(`databases/${dbId}/query`, 'POST', payload, key);
    if (!res || !res.results) break;
    allResults = allResults.concat(res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);

  return allResults.map(p => {
    const t = p.properties['Project Name'];
    const name = (t && t.title && t.title[0] && t.title[0].plain_text) ? t.title[0].plain_text : 'Untitled';
    return { id: p.id, name: name };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// รายชื่อ PM สำหรับ dropdown "Project Owner" / "PM ผู้สร้างงาน" — ดึงจาก
// "GEM Team Member" (Role มี "PM" และ Active = true) แทนการอ่าน schema ของ
// Owner property ใน Projects DB ตรงๆ เพราะ schema นั้นสะสม option เก่าของ PM
// ที่ออกจากทีมไปแล้วไว้ตลอด ไม่เคยถูกลบ (ของเดิมใช้ getAvailablePmNames_()
// ซึ่งพังง่ายเพราะ Task ที่ยังไม่ assign อาจไม่มีอันไหนผูก Project ที่มี
// Owner เลย). ชื่อที่ใช้เป็น Owner คือ "PM - " + ชื่อเล่น เสมอ ตามรูปแบบที่
// ใช้จริงใน Projects.Owner (เช่น "PM - ยู้").
const GEM_TEAM_MEMBER_DB_ID = '092e35e997424e4a9b20d7df03c31dc6';

function getActivePmTeamMembers_(key) {
  const payload = {
    filter: {
      and: [
        { property: 'Role', multi_select: { contains: 'PM' } },
        { property: 'Active', checkbox: { equals: true } }
      ]
    }
  };
  const res = notionFetch(`databases/${GEM_TEAM_MEMBER_DB_ID}/query`, 'POST', payload, key);
  if (!res || !res.results) return [];
  return res.results.map(function(p) {
    const nickname = (p.properties['ชื่อเล่น']?.rich_text || []).map(function(t) { return t.plain_text; }).join('').trim();
    const botInboxRelation = p.properties['Bot Inbox Project']?.relation || [];
    return {
      pageId: p.id,
      ownerName: nickname ? ('PM - ' + nickname) : '',
      botInboxProjectId: botInboxRelation[0]?.id || ''
    };
  }).filter(function(m) { return m.ownerName; });
}

function getProjectOwnerOptions() {
  const key = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY');
  return getActivePmTeamMembers_(key).map(function(m) { return m.ownerName; }).sort((a, b) => a.localeCompare(b, 'th'));
}

// หา Bot Inbox Project ของ PM คนนั้น (จาก relation "Bot Inbox Project" ใน
// GEM Team Member) — ถ้ายังไม่เคยมี ให้สร้าง Project ใหม่ให้อัตโนมัติ แล้ว
// ผูก relation กลับไว้ใช้ครั้งถัดไป กัน PM คนใหม่ต้องรอแอดมินมาแก้โค้ด/deploy
// ทุกครั้งที่มีคนเข้าทีม
function getOrCreateBotInboxProjectId_(pmOwnerName, key) {
  const member = getActivePmTeamMembers_(key).find(function(m) { return m.ownerName === pmOwnerName; });
  if (!member) {
    return { ok: false, error: 'ไม่พบ PM "' + pmOwnerName + '" ใน GEM Team Member (อาจยังไม่ได้เพิ่ม หรือ Active ถูกปิดไว้)' };
  }
  if (member.botInboxProjectId) return { ok: true, id: member.botInboxProjectId };

  const nickname = pmOwnerName.replace(/^PM - /, '');
  const created = notionFetch('pages', 'POST', {
    parent: { database_id: '2e69dccd181d81fabee1e65a00e86e72' }, // Projects DB
    properties: {
      'Project Name': { title: [{ text: { content: '🤖 Bot Inbox — รอจัด Project (' + nickname + ')' } }] },
      'Owner': { multi_select: [{ name: pmOwnerName }] }
    }
  }, key);
  if (!created || created.object === 'error') {
    return { ok: false, error: 'สร้าง Bot Inbox Project ให้ ' + pmOwnerName + ' ไม่สำเร็จ: ' + ((created && created.message) || 'Notion API error') };
  }

  notionFetch(`pages/${member.pageId}`, 'PATCH', {
    properties: { 'Bot Inbox Project': { relation: [{ id: created.id }] } }
  }, key);

  return { ok: true, id: created.id };
}

// ผู้ติดต่อ (Contacts) ของแบรนด์ — ให้ PM เลือกเองว่าจะผูกใครเข้า Project ใหม่
// แทนการ copy ทุกคนมาอัตโนมัติเหมือนก่อน (Brand ที่มี Contact หลายคนจะรกถ้า
// เอามาหมด)
function getContactsForBrand(brandId) {
  if (!brandId) return [];
  const key = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY');
  const dbId = '2e69dccd181d810bb092e486e4d9c7db'; // Contacts DB (database page id, not data source id)
  const res = notionFetch(`databases/${dbId}/query`, 'POST', {
    filter: { property: 'Brand', relation: { contains: brandId } }
  }, key);
  if (!res || !res.results) return [];
  return res.results.map(function(p) {
    return {
      id: p.id,
      name: p.properties['Contact Name']?.title?.[0]?.plain_text || '(ไม่มีชื่อ)',
      email: p.properties['Email']?.email || '',
    };
  });
}

// ============================================================
// Scope Item (Scope Baseline) — ผูก Project กับบรรทัดใบเสนอราคา
// ============================================================
const SCOPE_BASELINE_DB_ID = '0e9b74ddce4747078198a3a9d9228459';

function getScopeItemsForBrand(brandId) {
  if (!brandId) return [];
  const key = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY');
  const filter = {
    and: [
      { property: 'Brand', relation: { contains: brandId } },
      { property: 'Closed (Override)', checkbox: { equals: false } }
    ]
  };

  let allResults = [];
  let cursor = null;
  do {
    const payload = { page_size: 100, filter: filter };
    if (cursor) payload.start_cursor = cursor;
    const res = notionFetch(`databases/${SCOPE_BASELINE_DB_ID}/query`, 'POST', payload, key);
    if (!res || !res.results) break;
    allResults = allResults.concat(res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);

  const today = new Date();
  const windowStart = new Date(today); windowStart.setDate(today.getDate() - 31);
  const windowEnd = new Date(today); windowEnd.setDate(today.getDate() + 60);

  const items = allResults.map(function(p) {
    const props = p.properties;
    const period = (props['Period'] && props['Period'].date) || null;
    const targetMonth = (props['Target Month'] && props['Target Month'].date) || null;
    return {
      id: p.id,
      item: (props['Item'] && props['Item'].title && props['Item'].title[0] && props['Item'].title[0].plain_text) || '',
      itemType: (props['Item Type'] && props['Item Type'].select && props['Item Type'].select.name) || '',
      status: (props['Status'] && props['Status'].formula && props['Status'].formula.string) || '',
      qtNo: (props['QT No.'] && props['QT No.'].rich_text && props['QT No.'].rich_text[0] && props['QT No.'].rich_text[0].plain_text) || '',
      periodStart: period ? (period.start || '') : '',
      periodEnd: period ? (period.end || '') : '',
      targetMonth: targetMonth ? (targetMonth.start || '') : '',
      platformTarget: (props['Platform Target'] && props['Platform Target'].rich_text && props['Platform Target'].rich_text[0] && props['Platform Target'].rich_text[0].plain_text) || ''
    };
  }).filter(function(it) {
    if (it.itemType === 'Service' || it.itemType === 'Ads') return false;
    if (it.status === 'ส่งมอบแล้ว' || it.status === 'ปิด') return false;
    if (it.itemType === 'Retainer' && (it.periodStart || it.periodEnd)) {
      const end = it.periodEnd ? new Date(it.periodEnd) : null;
      const start = it.periodStart ? new Date(it.periodStart) : null;
      if (end && end < windowStart) return false;
      if (start && start > windowEnd) return false;
    }
    return true;
  });

  // Retainer ก่อน → Deliverable เรียงตาม QT No. ใหม่ → เก่า
  items.sort(function(a, b) {
    if (a.itemType !== b.itemType) {
      if (a.itemType === 'Retainer') return -1;
      if (b.itemType === 'Retainer') return 1;
    }
    return (b.qtNo || '').localeCompare(a.qtNo || '');
  });

  return items;
}

// Service Type DB (relation จาก Projects.Service Type) — "Content / Graphic
// Design Production" คือ default ของ Project ที่สร้างผ่านบอร์ดนี้ เพราะเป็น
// บอร์ดของทีม Graphic โดยเฉพาะ ใช้ fallback นี้เมื่อไม่ได้ระบุ serviceTypeId
// มา (เช่น flow สร้าง Project จากรูปปฏิทินที่ยังไม่มี UI ให้เลือก)
const SERVICE_TYPE_CONTENT_GRAPHIC_ID = '2e89dccd181d80f59747e0c36a461402';

function getServiceTypeOptions() {
  const key = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY');
  const dbId = '2e89dccd181d8024a6edf9ead857546c'; // Service Type DB (database page id, not data source id)
  const res = notionFetch(`databases/${dbId}/query`, 'POST', { page_size: 100 }, key);
  if (!res || !res.results) return [];
  return res.results
    .map(function(p) { return { id: p.id, name: p.properties['Name']?.title?.[0]?.plain_text || '' }; })
    .filter(function(s) { return s.name && s.id !== SERVICE_TYPE_BRAND_MANAGEMENT_ID; })
    .sort(function(a, b) { return a.name.localeCompare(b, 'th'); });
}

function createNotionProject(name, brandName, ownerName, scopeItemIds, serviceTypeId, contactIds, key) {
  const payload = {
    parent: { type: 'data_source_id', data_source_id: '2e69dccd-181d-81d0-83af-000b1fd9260b' },
    template: { type: 'default' },
    properties: {
      'Project Name': { title: [{ text: { content: name } }] },
      'Service Type': { relation: [{ id: serviceTypeId || SERVICE_TYPE_CONTENT_GRAPHIC_ID }] }
    }
  };
  if (ownerName) payload.properties['Owner'] = { multi_select: [{ name: ownerName }] };
  if (scopeItemIds && scopeItemIds.length) {
    payload.properties['Scope Item'] = { relation: scopeItemIds.map(function(id) { return { id: id }; }) };
  }
  if (brandName) {
    const brands = getNotionBrands();
    if (brands.ok) {
      const match = brands.brands.find(b => b.name === brandName);
      if (match) {
        payload.properties['Brand'] = { relation: [{ id: match.id }] };
        // "Company" ของ Project เป็น rollup ที่คำนวณจาก Contacts (ไม่ใช่จาก Brand
        // โดยตรง) เลยต้องมี Contacts ก่อนถึงจะคำนวณ Company ให้เองได้ — ใช้ contactIds
        // ที่ PM เลือกมาจากฟอร์ม (ถ้ามี) แทนการ copy ทุกคนของ Brand มาอัตโนมัติ
        // (ของเดิม) ซึ่งรกถ้า Brand มี Contact หลายคน; ถ้าไม่ได้ส่ง contactIds มาเลย
        // (เช่น flow Calendar Import ที่ยังไม่มี UI ให้เลือก) ใช้ของเดิมคือเอาทุกคน
        const finalContactIds = (contactIds !== undefined && contactIds !== null) ? contactIds : (match.contactIds || []);
        if (finalContactIds.length) {
          payload.properties['Contacts'] = { relation: finalContactIds.map(id => ({ id })) };
        }
      }
    }
  }
  // parent.type=data_source_id + template ต้องใช้ Notion-Version 2025-09-03 เฉพาะ call นี้
  const res = notionFetch('pages', 'POST', payload, key, '2025-09-03');
  if (!res || res.object === 'error') return { ok: false, error: (res && res.message) || 'Notion API error' };
  return { ok: true, id: res.id };
}

// Work Type → {Work By, Task Type, Financial Risk} ค่าเริ่มต้นอัตโนมัติ —
// ใช้ชื่อ option ตรงตาม schema จริงของ Tasks DB (มีเว้นวรรครอบ "/" เช่น
// "Graphic / Artwork") ถ้า Work Type ไม่อยู่ใน list นี้ (เช่นของเก่าที่ custom
// ไว้) จะไม่เดาให้ ปล่อยว่างให้คนกรอกเอง workBy: 'project' แปลว่าใช้ Owner
// ของ Project ที่ Task นี้ผูกอยู่ (ดึงสดจาก Notion ไม่ hardcode ชื่อ PM)
const WORK_TYPE_DEFAULTS_ = {
  'Content':             { workBy: ['Graphic Team'], taskType: 'Internal', financialRisk: 'No' },
  'Graphic / Artwork':   { workBy: ['Graphic Team'], taskType: 'Internal', financialRisk: 'No' },
  'Video':               { workBy: ['Graphic Team & VDO Editor'], taskType: 'Internal', financialRisk: 'No' },
  'Ads / Performance':   { workBy: ['Ads Specialist'], taskType: 'Internal', financialRisk: 'No' },
  'Project Management':  { workBy: 'project', taskType: 'External / Vendor', financialRisk: 'Yes' },
  'Affiliate':           { workBy: 'project', taskType: 'External / Vendor', financialRisk: 'No' },
  'Influencer / KOL':    { workBy: 'project', taskType: 'External / Vendor', financialRisk: 'Yes' },
  'Operation':           { workBy: 'project', taskType: 'Internal', financialRisk: 'No' },
  'General':             { workBy: 'project', taskType: 'Internal', financialRisk: 'No' },
};

function applyWorkTypeDefaults_(properties, workType, projectId, key) {
  const rule = WORK_TYPE_DEFAULTS_[workType];
  if (!rule) return;

  let workByNames = rule.workBy;
  if (workByNames === 'project') {
    workByNames = [];
    if (projectId) {
      const proj = notionFetch(`pages/${projectId}`, 'GET', null, key);
      const owners = proj?.properties?.['Owner']?.multi_select || [];
      workByNames = owners.map(function(o) { return o.name; });
    }
  }
  if (workByNames.length) properties['Work By'] = { multi_select: workByNames.map(function(n) { return { name: n }; }) };
  properties['Task Type'] = { multi_select: [{ name: rule.taskType }] };
  properties['Financial Risk'] = { select: { name: rule.financialRisk } };
}

function getNotionBrands() {
  const props = PropertiesService.getScriptProperties();
  const key   = props.getProperty('NOTION_API_KEY');
  // ID ของ Database Brands
  const dbId  = '2eb9dccd181d808fb888cdf883503df6';

  const res = notionFetch(`databases/${dbId}/query`, 'POST', {
    filter: { property: 'Active = Yes', checkbox: { equals: true } },
    sorts: [{ property: 'Name', direction: 'ascending' }],
    page_size: 100
  }, key);

  if (!res || !res.results) return { ok: false, brands: [] };

  const brands = res.results.map(p => ({
    id:   p.id,
    name: p.properties['Name']?.title?.[0]?.plain_text || '',
    code: p.properties['Client Code']?.rich_text?.[0]?.plain_text || '',
    contactIds: (p.properties['Contacts']?.relation || []).map(r => r.id),
  })).filter(b => b.name);

  return { ok: true, brands };
}

// ---------- NOTION HELPER ----------

function notionFetch(endpoint, method, payload, key, version) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Notion-Version': version || '2022-06-28',
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
