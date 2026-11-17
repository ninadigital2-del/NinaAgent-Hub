// ==========================================
// MeetingAnalyze.js -- steps [3] analyze and [5] create in Notion
// ==========================================
// Rules carried over from the handoff:
//  - deadlines count from the MEETING date (or the date on a LINE message), never from "today"
//  - Brand / Contacts / Scope Item / Service Type / PM Owner come from Notion lists, not from the AI
//  - Work By / Task Type / Financial Risk come ONLY from WORK_TYPE_DEFAULTS_ (CapacityStandards.js)
//  - no graphic assignment here (done on the Capacity Board)
//  - if a Notion list cannot be loaded the call fails; there is no made-up fallback list

const MEETING_STATUSES = ['Not started', 'In progress', 'Done'];
const MEETING_LEAD_STATUSES = ['Lead - Initial Brief', 'Lead - Planning', 'Lead - Awaiting Presentaion',
  'Lead - Presented', 'Lead - Pending Decision', 'Won', 'Lost', '-'];
const MEETING_MAX_TEXT_CHARS = 300000;
const MEETING_ANALYZE_MODEL = 'gemini-2.5-flash';
const MEETING_UPLOAD_ROOT_FOLDER = 'Meeting Agent Uploads';

function meetingNotionKey_() {
  const k = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY');
  if (!k || !k.trim()) throw new Error('ยังไม่ได้ตั้งค่า NOTION_API_KEY ใน Script Properties');
  return k.trim();
}

function meetingToday_() {
  return Utilities.formatDate(new Date(), MEETING_TZ, 'yyyy-MM-dd');
}
function meetingValidDate_(s) {
  s = String(s || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? '' : s;
}

/** Everything the page needs from Notion before it can analyze or let the PM pick. */
function meetingBootstrap() {
  try {
    meetingNotionKey_();
    const projects = getNotionProjects();
    if (!projects.length) return { ok: false, error: 'ดึงรายชื่อ Project จาก Notion ไม่สำเร็จ (ได้ 0 รายการ) — ตรวจ NOTION_API_KEY และสิทธิ์ของ integration' };
    const brands = getNotionBrands();
    if (!brands.ok) return { ok: false, error: 'ดึงรายชื่อ Brand จาก Notion ไม่สำเร็จ' };
    const owners = getProjectOwnerOptions();
    if (!owners.length) return { ok: false, error: 'ไม่พบ PM ที่ Active ใน GEM Team Member' };
    return {
      ok: true,
      today: meetingToday_(),
      projects: projects,
      brands: brands.brands.map(function(b) { return { id: b.id, name: b.name }; }),
      owners: owners,
      serviceTypes: getServiceTypeOptions(),
      workTypes: Object.keys(WORK_TYPE_DEFAULTS_),
    };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

/** Contacts + open Scope Items for a Brand, for the "new project" fields. */
function meetingBrandOptions(brandId) {
  try {
    return { ok: true, contacts: getContactsForBrand(brandId), scopeItems: getScopeItemsForBrand(brandId) };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

function meetingBuildSystemPrompt_(ctx) {
  const projectsCtx = ctx.projects.map(function(p) { return '- ' + p.name + ' (ID: ' + p.id + ')'; }).join('\n');
  return 'คุณคือ PM Agent ทำหน้าที่วิเคราะห์ข้อมูลการประชุมภาษาไทย แยกเป็นโปรเจกต์ (Project) และงานย่อย (Sub Tasks) แล้วตอบเป็น JSON ตามโครงสร้างด้านล่างเท่านั้น\n\n' +
    'ข้อมูลที่ให้อาจมาจากหลายแหล่งปนกัน (หัวข้อแต่ละส่วนบอกแหล่งที่มา เช่น เสียงประชุม, โน้ต iPad, แชท LINE, เอกสาร) ให้รวมเป็นภาพเดียว ห้ามนับงานเดียวกันซ้ำ\n\n' +
    'วันที่ประชุม: ' + ctx.meetingDate + (ctx.meetingTitle ? ' · ชื่อประชุม: ' + ctx.meetingTitle : '') + '\n' +
    'กติกาเรื่องวันที่ (สำคัญมาก):\n' +
    '- คำบอกเวลาแบบสัมพัทธ์ ("พรุ่งนี้", "ศุกร์นี้", "สัปดาห์หน้า") ให้นับจากวันที่ประชุมข้างบน ห้ามนับจากวันนี้\n' +
    '- ข้อความจากแชท LINE มีวันที่กำกับแต่ละข้อความ ให้นับคำบอกเวลาจากวันที่ของข้อความนั้น\n' +
    '- ถ้าไม่มีวันที่ที่อนุมานได้จริง ให้ใส่ "" ห้ามเดา\n' +
    '- รูปแบบวันที่ YYYY-MM-DD เสมอ\n\n' +
    'รายชื่อโปรเจกต์ที่มีอยู่ใน Notion (ยังไม่ปิด):\n' + projectsCtx + '\n\n' +
    'match_status:\n' +
    '- "exact": ชื่อตรงกับโปรเจกต์ข้างบนชัดเจน ให้ใช้ชื่อตามรายการเป๊ะ\n' +
    '- "uncertain": มีคำคีย์เวิร์ด/แบรนด์ที่คล้ายกับโปรเจกต์เดิม ให้เลือก uncertain เพื่อให้ผู้ใช้ยืนยัน ห้ามตั้งเป็น "new" มั่ว\n' +
    '- "new": ไม่เกี่ยวกับโปรเจกต์ใดเลย\n\n' +
    'brand: เลือกจากรายชื่อนี้เท่านั้น (ถ้าไม่แน่ใจให้ใส่ ""): ' + ctx.brands.join(', ') + '\n' +
    'owner (PM เจ้าของโปรเจกต์): เลือกจากรายชื่อนี้เท่านั้น: ' + ctx.owners.join(', ') + ' — ถ้าข้อมูลไม่ระบุ ให้ใส่ "" ห้ามสุ่ม\n' +
    'work_type ของงานย่อย: เลือกจาก ' + ctx.workTypes.join(' / ') + ' เท่านั้น\n' +
    'ห้ามกำหนดผู้รับผิดชอบงานย่อย (Work By), Task Type หรือ Financial Risk เอง ระบบจะเติมตาม work_type\n' +
    'ถ้าข้อมูลพูดถึงว่าใครจะทำงานชิ้นไหน ให้เขียนไว้ใน owner_hint เป็นข้อความอิสระ\n' +
    'status: "Not started" / "In progress" / "Done" · lead_status: ' + MEETING_LEAD_STATUSES.join(' / ') + '\n' +
    'ถ้าข้อความตอนไหนเป็น [ฟังไม่ชัด] หรือ [อ่านไม่ออก] อย่านำไปเดาเป็นงาน\n\n' +
    'รูปแบบ JSON:\n' +
    '{"projects":[{"project_name":"","brand":"","owner":"","match_status":"exact|uncertain|new","tags":"","start_date":"","deadline":"",' +
    '"status":"Not started","lead_status":"-","notes":"","sub_tasks":[{"name":"","work_type":"","owner_hint":"","status":"Not started","due_date":""}]}]}';
}

/** Cleans whatever the model returned so the page never receives a value Notion would reject. */
function meetingNormalize_(raw, ctx) {
  const wtSet = {}; ctx.workTypes.forEach(function(w) { wtSet[w] = true; });
  const str = function(v) { return String(v == null ? '' : v).trim(); };
  const projects = ((raw && raw.projects) || []).map(function(p) {
    const name = str(p.project_name);
    if (!name) return null;
    let match = ['exact', 'uncertain', 'new'].indexOf(p.match_status) !== -1 ? p.match_status : 'new';
    let id = '';
    const byName = ctx.projects.filter(function(x) { return x.name === name; })[0];
    if (byName) { id = byName.id; match = 'exact'; }
    else if (match === 'exact') match = 'uncertain'; // claimed exact but the name is not in Notion
    const brand = ctx.brands.filter(function(b) { return b.toLowerCase() === str(p.brand).toLowerCase(); })[0] || '';
    const owner = ctx.owners.indexOf(str(p.owner)) !== -1 ? str(p.owner) : '';
    const subs = (p.sub_tasks || []).map(function(s) {
      const n = str(s.name);
      if (!n) return null;
      return {
        name: n,
        work_type: wtSet[str(s.work_type)] ? str(s.work_type) : 'General',
        owner_hint: str(s.owner_hint),
        status: MEETING_STATUSES.indexOf(s.status) !== -1 ? s.status : 'Not started',
        due_date: meetingValidDate_(s.due_date),
      };
    }).filter(Boolean);
    return {
      project_name: name, project_id: id, match_status: match, brand: brand, owner: owner,
      tags: str(p.tags), start_date: meetingValidDate_(p.start_date), deadline: meetingValidDate_(p.deadline),
      status: MEETING_STATUSES.indexOf(p.status) !== -1 ? p.status : 'Not started',
      lead_status: MEETING_LEAD_STATUSES.indexOf(p.lead_status) !== -1 ? p.lead_status : '-',
      notes: str(p.notes), sub_tasks: subs,
    };
  }).filter(Boolean);
  const count = function(m) { return projects.filter(function(p) { return p.match_status === m; }).length; };
  return {
    projects: projects,
    stats: {
      tasks: projects.reduce(function(n, p) { return n + p.sub_tasks.length; }, 0),
      matched: count('exact'), uncertain: count('uncertain'), new: count('new'),
    },
  };
}

/** Step [3]. input = { text, meetingDate, title }. */
function meetingAnalyze(input) {
  try {
    input = input || {};
    const text = String(input.text || '').trim();
    if (!text) return { ok: false, error: 'ไม่มีข้อความให้วิเคราะห์' };
    if (text.length > MEETING_MAX_TEXT_CHARS) return { ok: false, error: 'ข้อความยาวเกินไป (' + text.length + ' ตัวอักษร) กรุณาตัดบางส่วนออก' };
    const meetingDate = meetingValidDate_(input.meetingDate) || meetingToday_();

    const boot = meetingBootstrap();
    if (!boot.ok) return boot;
    const ctx = {
      projects: boot.projects, brands: boot.brands.map(function(b) { return b.name; }),
      owners: boot.owners, workTypes: boot.workTypes, meetingDate: meetingDate,
      meetingTitle: String(input.title || '').trim(),
    };
    const out = meetingGeminiGenerate_([{ text: text }], { responseMimeType: 'application/json', temperature: 0.2 },
      meetingGeminiKey_(), meetingBuildSystemPrompt_(ctx), MEETING_ANALYZE_MODEL);
    let raw;
    try { raw = JSON.parse(out.replace(/```json/gi, '').replace(/```/g, '').trim()); }
    catch (e) { return { ok: false, error: 'Gemini ส่ง JSON ที่อ่านไม่ได้ — ลองวิเคราะห์ใหม่อีกครั้ง' }; }

    const result = meetingNormalize_(raw, ctx);
    const saved = meetingSaveTranscript_(ctx.meetingTitle, meetingDate, text);
    return Object.assign({ ok: true, meetingDate: meetingDate, boot: boot }, result, saved);
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

/** Q2: keep the reviewed transcript in Drive, one folder per meeting. Best effort -- never blocks analysis. */
function meetingSaveTranscript_(title, meetingDate, text) {
  try {
    const roots = DriveApp.getFoldersByName(MEETING_UPLOAD_ROOT_FOLDER);
    const root = roots.hasNext() ? roots.next() : DriveApp.createFolder(MEETING_UPLOAD_ROOT_FOLDER);
    const folder = root.createFolder(meetingDate + ' ' + (title || 'meeting').slice(0, 80));
    folder.createFile('transcript.txt', text, MimeType.PLAIN_TEXT);
    return { savedFolderUrl: folder.getUrl() };
  } catch (err) {
    return { saveWarning: 'บันทึกข้อความลง Drive ไม่สำเร็จ: ' + String(err && err.message || err) };
  }
}

/**
 * Step [5]. payload = array of projects as the page shows them:
 *   { project_id, project_name, brand, owner, serviceTypeId, contactIds[], scopeItemIds[],
 *     deadline, lead_status, _projSyncId, sub_tasks:[{ name, work_type, due_date, status, notion_page_id, _syncId }] }
 * A project without project_id is created with the Capacity Board's createNotionProject().
 */
function meetingCreate(payload) {
  const result = { success: true, count: 0, errors: [], warnings: [], successfulSyncIds: [], updatedProjects: {}, taskIds: {} };
  try {
    if (typeof payload === 'string') payload = JSON.parse(payload);
    if (!Array.isArray(payload) || !payload.length) return { success: false, errors: ['ไม่มีข้อมูลที่จะส่งเข้า Notion'], warnings: [], count: 0 };
    const key = meetingNotionKey_();

    payload.forEach(function(proj) {
      let projectId = proj.project_id || '';
      if (!projectId) {
        if (!proj.owner) { result.errors.push('โปรเจกต์ [' + proj.project_name + ']: ยังไม่ได้เลือก PM Owner'); return; }
        const created = createNotionProject(proj.project_name || 'Untitled Project', proj.brand, proj.owner,
          proj.scopeItemIds || [], proj.serviceTypeId || '', proj.contactIds || [], key);
        if (!created.ok) { result.errors.push('โปรเจกต์ [' + proj.project_name + ']: ' + created.error); return; }
        projectId = created.id;
        if (proj._projSyncId) result.updatedProjects[proj._projSyncId] = projectId;
        if (proj.brand && !(getNotionBrands().brands || []).some(function(b) { return b.name === proj.brand; })) {
          result.warnings.push('ไม่พบ Brand "' + proj.brand + '" ใน Notion — Project ถูกสร้างโดยไม่ผูก Brand');
        }
        const extra = {};
        if (proj.deadline) extra['Deadline'] = { date: { start: proj.deadline } };
        if (proj.lead_status && proj.lead_status !== '-') extra['Lead Status'] = { status: { name: proj.lead_status } };
        if (Object.keys(extra).length) {
          const r = notionFetch('pages/' + projectId, 'PATCH', { properties: extra }, key);
          if (!r || r.object === 'error') result.warnings.push('ตั้ง Deadline/Lead Status ของ [' + proj.project_name + '] ไม่สำเร็จ: ' + ((r && r.message) || 'Notion API error'));
        }
        Utilities.sleep(300);
      }

      (proj.sub_tasks || []).forEach(function(sub) {
        const properties = {
          'Name': { title: [{ text: { content: sub.name } }] },
          'Project': { relation: [{ id: projectId }] },
          'Status': { status: { name: sub.status || 'Not started' } },
        };
        if (sub.work_type) properties['Work Type'] = { multi_select: [{ name: sub.work_type }] };
        if (sub.due_date) properties['Due Date'] = { date: { start: sub.due_date } };
        applyWorkTypeDefaults_(properties, sub.work_type, projectId, key);

        const res = sub.notion_page_id
          ? notionFetch('pages/' + sub.notion_page_id, 'PATCH', { properties: properties }, key)
          : notionFetch('pages', 'POST', { parent: { database_id: '2e69dccd181d81df8919fbacf921c7d5' }, properties: properties }, key);
        if (!res || res.object === 'error') {
          result.errors.push(sub.name + ': ' + ((res && res.message) || 'Notion API error'));
        } else {
          result.count++;
          if (sub._syncId) { result.successfulSyncIds.push(sub._syncId); result.taskIds[sub._syncId] = res.id; }
        }
        Utilities.sleep(350);
      });
    });
    return result;
  } catch (err) {
    result.success = false;
    result.errors.push(String(err && err.message || err));
    return result;
  }
}
