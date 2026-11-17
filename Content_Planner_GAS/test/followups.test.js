'use strict';
// Run with: node Content_Planner_GAS/test/followups.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadCodeGs } = require('./mock-gas');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('  ok - ' + name); }
  catch (err) { failures++; console.log('  FAIL - ' + name); console.log('    ' + err.message); }
}
function rowFrom(COLUMNS, partial) {
  return COLUMNS.map(col => (partial[col] !== undefined ? partial[col] : ''));
}
function setup() {
  const { context, sheet } = loadCodeGs([]);
  context.PropertiesService.getScriptProperties().setProperty('CLIENT_LINK_SECRET', 'k');
  sheet.appendRow(rowFrom(context.COLUMNS, { ID: 'c-A', Brand: 'AIS', Title: 'A post' }));
  sheet.appendRow(rowFrom(context.COLUMNS, { ID: 'c-B', Brand: 'Nina Cosmetics', Title: 'B post' }));
  return context;
}

test('createFollowUp standalone stores Brand, sets Team/Us defaults, derives Done=false', () => {
  const c = setup();
  const f = c.createFollowUp({ Brand: 'AIS', Text: 'send photos' });
  assert.strictEqual(f.Brand, 'AIS');
  assert.strictEqual(f.ResponsibleSide, 'Us');
  assert.strictEqual(f.CreatedBy, 'Team');
  assert.strictEqual(f.Done, false);
});

test('createFollowUp linked: Brand comes from the content, not the request (#4)', () => {
  const c = setup();
  const f = c.createFollowUp({ Brand: 'Nina Cosmetics', ContentId: 'c-A', Text: 'x' });
  assert.strictEqual(f.Brand, 'AIS');
});

test('createFollowUp rejects missing brand and unknown linked content', () => {
  const c = setup();
  assert.throws(() => c.createFollowUp({ Text: 'x' }), /Brand is required/);
  assert.throws(() => c.createFollowUp({ ContentId: 'nope', Text: 'x' }), /Linked content not found/);
});

test('listFollowUps: brand filter returns only that brand (#1)', () => {
  const c = setup();
  c.createFollowUp({ Brand: 'AIS', Text: 'a' });
  c.createFollowUp({ Brand: 'Nina Cosmetics', Text: 'b' });
  assert.strictEqual(c.listFollowUps('AIS').length, 1);
  assert.strictEqual(c.listFollowUps('AIS')[0].Text, 'a');
  assert.strictEqual(c.listFollowUps(null).length, 2);
});

test('toggleFollowUp stamps DoneAt/DoneBy and clears them on reopen', () => {
  const c = setup();
  const f = c.createFollowUp({ Brand: 'AIS', Text: 'a' });
  const done = c.toggleFollowUp(f.ID, true, false);
  assert.strictEqual(done.Done, true);
  assert.strictEqual(done.DoneBy, 'Team');
  assert.ok(done.DoneAt);
  const reopened = c.toggleFollowUp(f.ID, false, false);
  assert.strictEqual(reopened.Done, false);
  assert.strictEqual(reopened.DoneBy, '');
});

test('clientToggleFollowUp_ works for own brand, DoneBy=Client', () => {
  const c = setup();
  const f = c.createFollowUp({ Brand: 'AIS', Text: 'a' });
  assert.strictEqual(c.clientToggleFollowUp_('AIS', f.ID, true).DoneBy, 'Client');
});

test('clientToggleFollowUp_ rejects another brand even with the exact ID (#2)', () => {
  const c = setup();
  const f = c.createFollowUp({ Brand: 'Nina Cosmetics', Text: 'b' });
  assert.throws(() => c.clientToggleFollowUp_('AIS', f.ID, true), /BRAND_MISMATCH/);
  assert.strictEqual(c.listFollowUps('Nina Cosmetics')[0].Done, false);
});

test('updateFollowUp edits fields; deleteFollowUp removes row', () => {
  const c = setup();
  const f = c.createFollowUp({ Brand: 'AIS', Text: 'a' });
  const u = c.updateFollowUp(f.ID, { Text: 'b', ResponsibleSide: 'Client', DueDate: '2026-12-01' });
  assert.strictEqual(u.Text, 'b');
  assert.strictEqual(u.ResponsibleSide, 'Client');
  c.deleteFollowUp(f.ID);
  assert.strictEqual(c.listFollowUps(null).length, 0);
});

test('listFollowUps survives a follow-up whose content was deleted (#5)', () => {
  const c = setup();
  c.createFollowUp({ Brand: 'AIS', ContentId: 'c-A', Text: 'a' });
  c.deleteContent('c-A');
  const list = c.listFollowUps('AIS');
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].ContentId, 'c-A');
});

test('client doPost branch only allows toggleFollowUp; admin-only ones fall to the rejection (#3)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
  const body = src.slice(src.indexOf('function doPost'), src.indexOf('function jsonResponse'));
  const clientSection = body.slice(0, body.indexOf("if (action === 'create')"));
  assert.ok(clientSection.includes("'toggleFollowUp'"));
  ['createFollowUp', 'updateFollowUp', 'deleteFollowUp'].forEach(fn => {
    assert.ok(!clientSection.includes(fn), 'client branch must not reach ' + fn);
  });
  assert.ok(clientSection.includes('Action not allowed for client link'));
});

test('client doGet branch scopes followups to clientBrand', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
  const body = src.slice(src.indexOf('function doGet'), src.indexOf('function doPost'));
  assert.ok(body.includes('listFollowUps(clientBrand)'));
});

console.log('');
if (failures) { console.log(failures + ' test(s) failed.'); process.exit(1); }
else console.log('All tests passed.');
