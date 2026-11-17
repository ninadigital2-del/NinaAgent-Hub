'use strict';
// Run: node "คู่มือการใช้งาน_Meeting_to_Notion_Agent_Pro/test/meeting.test.js"
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('  ok - ' + name); }
  catch (err) { failures++; console.log('  FAIL - ' + name); console.log('    ' + err.stack.split('\n').slice(0, 3).join('\n    ')); }
}

function load(handler) {
  const calls = [];
  const props = { NOTION_API_KEY: 'nk', GEMINI_API_KEY: 'gk' };
  const ctx = {
    console, Logger: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (props[k] !== undefined ? props[k] : null) }) },
    Utilities: {
      sleep() {}, base64Encode: b => Buffer.from(b).toString('base64'),
      formatDate: () => '2026-11-17',
    },
    UrlFetchApp: {
      fetch(url, opts) {
        const body = opts && opts.payload && typeof opts.payload === 'string' ? JSON.parse(opts.payload) : undefined;
        calls.push({ url, method: (opts && opts.method) || 'get', body });
        const out = handler(url, opts, body, calls);
        return { getContentText: () => JSON.stringify(out), getResponseCode: () => 200, getHeaders: () => ({}) };
      },
    },
  };
  vm.createContext(ctx);
  ['CapacityStandards.js', 'MeetingInputs.js', 'MeetingAnalyze.js', 'Code.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  });
  return { ctx, calls };
}

const PROJECTS = [{ id: 'p-1', name: 'AIS - Q4 Campaign' }, { id: 'p-2', name: 'BPS - Website' }];
const CTX = { projects: PROJECTS, brands: ['AIS', 'BPS'], owners: ['PM - ยู้', 'PM - ชัย'], workTypes: ['Content', 'General', 'Video'], meetingDate: '2026-11-03', meetingTitle: 'Kickoff' };

test('meetingExtractDriveId_ takes bare ids and common link shapes, rejects junk', () => {
  const { ctx } = load(() => ({}));
  const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
  assert.strictEqual(ctx.meetingExtractDriveId_(id), id);
  assert.strictEqual(ctx.meetingExtractDriveId_('https://drive.google.com/file/d/' + id + '/view?usp=sharing'), id);
  assert.strictEqual(ctx.meetingExtractDriveId_('https://drive.google.com/open?id=' + id), id);
  assert.strictEqual(ctx.meetingExtractDriveId_('not a link'), '');
});

test('meetingKindFromMime_ routes each input type', () => {
  const { ctx } = load(() => ({}));
  assert.strictEqual(ctx.meetingKindFromMime_('audio/x-m4a', 'a.m4a'), 'audio');
  assert.strictEqual(ctx.meetingKindFromMime_('application/octet-stream', 'rec.mp3'), 'audio');
  assert.strictEqual(ctx.meetingKindFromMime_('image/png', 'n.png'), 'image');
  assert.strictEqual(ctx.meetingKindFromMime_('application/pdf', 'b.pdf'), 'pdf');
  assert.strictEqual(ctx.meetingKindFromMime_('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'b.docx'), 'docx');
  assert.strictEqual(ctx.meetingKindFromMime_('text/plain', 'chat.txt'), 'text');
  assert.strictEqual(ctx.meetingKindFromMime_('application/zip', 'x.zip'), '');
});

test('system prompt counts dates from the meeting date, lists brands/owners/work types, forbids AI-set Work By', () => {
  const { ctx } = load(() => ({}));
  const p = ctx.meetingBuildSystemPrompt_(CTX);
  assert.ok(p.includes('2026-11-03'));
  assert.ok(p.includes('ห้ามนับจากวันนี้'));
  assert.ok(p.includes('AIS, BPS') && p.includes('PM - ยู้, PM - ชัย') && p.includes('Content / General / Video'));
  assert.ok(p.includes('ห้ามกำหนดผู้รับผิดชอบงานย่อย (Work By)'));
  assert.ok(p.includes('AIS - Q4 Campaign (ID: p-1)'));
});

test('normalize: exact by real name, claimed-exact-but-missing downgrades, whitelists, bad dates dropped', () => {
  const { ctx } = load(() => ({}));
  const r = ctx.meetingNormalize_({ projects: [
    { project_name: 'AIS - Q4 Campaign', match_status: 'new', brand: 'ais', owner: 'PM - ยู้', deadline: '2026-11-10',
      sub_tasks: [{ name: 'ทำแบนเนอร์', work_type: 'Content', due_date: '2026-13-45', status: 'Weird' }, { name: '  ' }] },
    { project_name: 'ชื่อที่ไม่มี', match_status: 'exact', brand: 'Nobody', owner: 'PM - อ้อ',
      sub_tasks: [{ name: 'x', work_type: 'Made Up' }] },
    { project_name: '' },
  ] }, CTX);
  assert.strictEqual(r.projects.length, 2);
  const a = r.projects[0], b = r.projects[1];
  assert.strictEqual(a.project_id, 'p-1'); assert.strictEqual(a.match_status, 'exact');
  assert.strictEqual(a.brand, 'AIS'); assert.strictEqual(a.owner, 'PM - ยู้');
  assert.strictEqual(a.sub_tasks.length, 1);
  assert.strictEqual(a.sub_tasks[0].due_date, ''); assert.strictEqual(a.sub_tasks[0].status, 'Not started');
  assert.strictEqual(b.match_status, 'uncertain'); assert.strictEqual(b.project_id, '');
  assert.strictEqual(b.brand, ''); assert.strictEqual(b.owner, '');
  assert.strictEqual(b.sub_tasks[0].work_type, 'General');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.stats)), { tasks: 2, matched: 1, uncertain: 1, new: 0 });
});

test('getNotionProjects paginates and sends the Done/Archived filter', () => {
  let page = 0;
  const { ctx, calls } = load(() => {
    page++;
    const mk = i => ({ id: 'id' + i, properties: { 'Project Name': { title: [{ plain_text: 'P' + i }] } } });
    return page === 1 ? { results: [mk(1)], has_more: true, next_cursor: 'c2' } : { results: [mk(2)], has_more: false };
  });
  const list = ctx.getNotionProjects();
  assert.strictEqual(list.length, 2);
  assert.strictEqual(calls[1].body.start_cursor, 'c2');
  const f = JSON.stringify(calls[0].body.filter);
  assert.ok(f.includes('Done') && f.includes('Archived'));
});

test('meetingBootstrap fails loudly when Notion returns no projects (no made-up fallback list)', () => {
  const { ctx } = load(() => ({ object: 'error', message: 'unauthorized' }));
  const r = ctx.meetingBootstrap();
  assert.strictEqual(r.ok, false);
  assert.ok(/Project/.test(r.error));
});

test('meetingCreate: new project from template with brand/owner/service type; tasks get WORK_TYPE_DEFAULTS_, no Graphic Assignee', () => {
  const { ctx, calls } = load(url => {
    if (url.includes('2eb9dccd')) return { results: [{ id: 'b-ais', properties: { Name: { title: [{ plain_text: 'AIS' }] } } }] };
    return { object: 'page', id: 'new-page' };
  });
  const r = ctx.meetingCreate([{
    project_name: 'AIS - New', brand: 'AIS', owner: 'PM - ยู้', serviceTypeId: 'st-1', contactIds: ['c-1'], scopeItemIds: ['s-1'],
    deadline: '2026-12-01', _projSyncId: 'ps1',
    sub_tasks: [{ name: 'T1', work_type: 'Content', due_date: '2026-11-20', status: 'Not started', _syncId: 't1', work_by: 'PM - ยู้' }],
  }]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.errors)), []);
  assert.strictEqual(r.count, 1);
  const proj = calls.find(c => c.url.endsWith('/pages') && c.body && c.body.template);
  assert.ok(proj, 'project must be created from the default template');
  assert.strictEqual(proj.body.properties['Service Type'].relation[0].id, 'st-1');
  assert.strictEqual(proj.body.properties['Owner'].multi_select[0].name, 'PM - ยู้');
  assert.strictEqual(proj.body.properties['Scope Item'].relation[0].id, 's-1');
  assert.strictEqual(proj.body.properties['Contacts'].relation[0].id, 'c-1');
  const task = calls.find(c => c.url.endsWith('/pages') && c.body && c.body.parent && c.body.parent.database_id === '2e69dccd181d81df8919fbacf921c7d5');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(task.body.properties['Work By'])), { multi_select: [{ name: 'Graphic Team' }] });
  assert.strictEqual(task.body.properties['Financial Risk'].select.name, 'No');
  assert.ok(!('Graphic Assignee' in task.body.properties));
});

test('meetingCreate: existing project reused (no template create); new project without owner refused', () => {
  const { ctx, calls } = load(() => ({ object: 'page', id: 'x' }));
  const r = ctx.meetingCreate([
    { project_id: 'p-1', project_name: 'Old', sub_tasks: [{ name: 'T', work_type: 'General' }] },
    { project_name: 'No owner', sub_tasks: [{ name: 'U', work_type: 'General' }] },
  ]);
  assert.strictEqual(r.count, 1);
  assert.ok(!calls.some(c => c.body && c.body.template));
  assert.ok(r.errors.some(e => e.includes('PM Owner')));
});

test('meetingGeminiGenerate_ refuses a truncated or blocked answer, returns a complete one', () => {
  const reply = reason => ({ candidates: [{ content: { parts: [{ text: 'ข้อความ' }] }, finishReason: reason }] });
  assert.strictEqual(load(() => reply('STOP')).ctx.meetingGeminiGenerate_([{ text: 'x' }], {}, 'k'), 'ข้อความ');
  assert.throws(() => load(() => reply('MAX_TOKENS')).ctx.meetingGeminiGenerate_([{ text: 'x' }], {}, 'k'), /ถูกตัด/);
  assert.throws(() => load(() => reply('SAFETY')).ctx.meetingGeminiGenerate_([{ text: 'x' }], {}, 'k'), /SAFETY/);
});

console.log('');
if (failures) { console.log(failures + ' test(s) failed.'); process.exit(1); }
console.log('All tests passed.');
