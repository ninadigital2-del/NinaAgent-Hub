'use strict';
// Node-only tests for pushing a status change back to its linked Notion
// Task, added to Code.gs's updateContent(). Content Planner's 8 statuses
// collapse onto Notion's 4 (Not started/In progress/Pending/Done):
//   Draft              -> Not started
//   Posted, Scheduled  -> Done
//   Cancelled          -> Notion Status left alone, a comment posted instead
//   Review/Revision/Approved/Ready -> In progress
// Run with: node Content_Planner_GAS/test/notion-task-status-sync.test.js
const assert = require('assert');
const { loadCodeGs } = require('./mock-gas');

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log('  ok - ' + name);
  } catch (err) {
    failures++;
    console.log('  FAIL - ' + name);
    console.log('    ' + err.message);
  }
}

function rowFrom(COLUMNS, partial) {
  return COLUMNS.map(col => (partial[col] !== undefined ? partial[col] : ''));
}

function withFetchSpy(context) {
  const calls = [];
  context.UrlFetchApp.fetch = (url, options) => {
    calls.push({ url, options });
    return { getContentText: () => '{}' };
  };
  return calls;
}

function seedRow(context, sheet, id, status) {
  const { COLUMNS } = context;
  context.PropertiesService.getScriptProperties().setProperty('NOTION_TOKEN', 'secret-token');
  sheet.appendRow(rowFrom(COLUMNS, {
    ID: id, Brand: 'AIS', Title: 'A', Status: status, NotionTaskId: 'notion-page-' + id,
  }));
}

// ---------------------------------------------------------------------
['Posted', 'Scheduled'].forEach(newStatus => {
  test(newStatus + ' maps to Notion Status "Done"', () => {
    const { context, sheet } = loadCodeGs([]);
    seedRow(context, sheet, newStatus.toLowerCase(), 'Review');
    const calls = withFetchSpy(context);

    context.updateContent(newStatus.toLowerCase(), { Status: newStatus });

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url, 'https://api.notion.com/v1/pages/notion-page-' + newStatus.toLowerCase());
    assert.strictEqual(calls[0].options.method, 'patch');
    const body = JSON.parse(calls[0].options.payload);
    assert.strictEqual(body.properties.Status.status.name, 'Done');
  });
});

// ---------------------------------------------------------------------
['Review', 'Revision', 'Approved', 'Ready'].forEach(newStatus => {
  test(newStatus + ' maps to Notion Status "In progress"', () => {
    const { context, sheet } = loadCodeGs([]);
    seedRow(context, sheet, newStatus.toLowerCase(), 'Draft');
    const calls = withFetchSpy(context);

    context.updateContent(newStatus.toLowerCase(), { Status: newStatus });

    assert.strictEqual(calls.length, 1);
    const body = JSON.parse(calls[0].options.payload);
    assert.strictEqual(body.properties.Status.status.name, 'In progress');
  });
});

test('Draft maps to Notion Status "Not started"', () => {
  const { context, sheet } = loadCodeGs([]);
  seedRow(context, sheet, 'draft-case', 'Review');
  const calls = withFetchSpy(context);

  context.updateContent('draft-case', { Status: 'Draft' });

  assert.strictEqual(calls.length, 1);
  const body = JSON.parse(calls[0].options.payload);
  assert.strictEqual(body.properties.Status.status.name, 'Not started');
});

// ---------------------------------------------------------------------
test('Cancelled does not touch Notion Status, but posts a comment instead', () => {
  const { context, sheet } = loadCodeGs([]);
  seedRow(context, sheet, 'cancel-case', 'Review');
  const calls = withFetchSpy(context);

  context.updateContent('cancel-case', { Status: 'Cancelled' });

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, 'https://api.notion.com/v1/comments');
  assert.strictEqual(calls[0].options.method, 'post');
  const body = JSON.parse(calls[0].options.payload);
  assert.strictEqual(body.parent.page_id, 'notion-page-cancel-case');
  assert.ok(body.rich_text[0].text.content.indexOf('ยกเลิก') !== -1);
});

// ---------------------------------------------------------------------
test('saving the identical Status never calls Notion', () => {
  const { context, sheet } = loadCodeGs([]);
  seedRow(context, sheet, 'same-status', 'Review');
  const calls = withFetchSpy(context);

  context.updateContent('same-status', { Status: 'Review' });

  assert.strictEqual(calls.length, 0);
});

// ---------------------------------------------------------------------
test('changing a field other than Status never calls Notion for status sync', () => {
  const { context, sheet } = loadCodeGs([]);
  seedRow(context, sheet, 'note-only', 'Review');
  const calls = withFetchSpy(context);

  context.updateContent('note-only', { Note: 'just a note edit' });

  assert.strictEqual(calls.length, 0);
});

// ---------------------------------------------------------------------
test('changing Status on an item with no NotionTaskId never calls Notion', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, { ID: 'no-link', Brand: 'AIS', Title: 'A', Status: 'Review', NotionTaskId: '' }));
  const calls = withFetchSpy(context);

  const item = context.updateContent('no-link', { Status: 'Posted' });

  assert.strictEqual(item.Status, 'Posted');
  assert.strictEqual(calls.length, 0);
});

// ---------------------------------------------------------------------
test('a failed Notion status push is logged but never throws or blocks the save', () => {
  const { context, sheet } = loadCodeGs([]);
  seedRow(context, sheet, 'fail-case', 'Review');
  context.UrlFetchApp.fetch = () => ({ getContentText: () => JSON.stringify({ error: { message: 'Could not find page' } }) });

  const item = context.updateContent('fail-case', { Status: 'Posted' });

  assert.strictEqual(item.Status, 'Posted', 'the Content Planner save itself must still succeed');
});

// ---------------------------------------------------------------------
test('changing both Title and Status in one save pushes both independently', () => {
  const { context, sheet } = loadCodeGs([]);
  seedRow(context, sheet, 'both-case', 'Review');
  const calls = withFetchSpy(context);

  context.updateContent('both-case', { Title: 'New title', Status: 'Posted' });

  assert.strictEqual(calls.length, 2);
  const payloads = calls.map(c => JSON.parse(c.options.payload));
  assert.ok(payloads.some(p => p.properties && p.properties.Name));
  assert.ok(payloads.some(p => p.properties && p.properties.Status));
});

if (failures) {
  console.log(failures + ' test(s) failed.');
  process.exitCode = 1;
} else {
  console.log('All tests passed.');
}
