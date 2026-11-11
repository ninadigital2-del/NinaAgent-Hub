'use strict';
// Node-only tests for pushing a renamed content item's title back to its
// linked Notion Task (NotionTaskId), added to Code.gs's updateContent().
// Run with: node Content_Planner_GAS/test/notion-task-title-sync.test.js
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

// ---------------------------------------------------------------------
test('renaming an item with a NotionTaskId pushes the new title to Notion', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  context.PropertiesService.getScriptProperties().setProperty('NOTION_TOKEN', 'secret-token');
  sheet.appendRow(rowFrom(COLUMNS, {
    ID: 'row-1', Brand: 'AIS', Title: 'Old title', Status: 'Draft', NotionTaskId: 'notion-page-1',
  }));
  const calls = withFetchSpy(context);

  const item = context.updateContent('row-1', { Title: 'New title' });

  assert.strictEqual(item.Title, 'New title');
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, 'https://api.notion.com/v1/pages/notion-page-1');
  assert.strictEqual(calls[0].options.method, 'patch');
  const body = JSON.parse(calls[0].options.payload);
  assert.strictEqual(body.properties.Name.title[0].text.content, 'New title');
  assert.strictEqual(calls[0].options.headers.Authorization, 'Bearer secret-token');
});

// ---------------------------------------------------------------------
test('editing a field other than Title never calls Notion, even with a NotionTaskId', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, {
    ID: 'row-2', Brand: 'AIS', Title: 'Same title', Status: 'Draft', NotionTaskId: 'notion-page-2',
  }));
  const calls = withFetchSpy(context);

  context.updateContent('row-2', { Note: 'just a note edit' });

  assert.strictEqual(calls.length, 0);
});

// ---------------------------------------------------------------------
test('saving the identical Title never calls Notion', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, {
    ID: 'row-3', Brand: 'AIS', Title: 'Unchanged', Status: 'Draft', NotionTaskId: 'notion-page-3',
  }));
  const calls = withFetchSpy(context);

  context.updateContent('row-3', { Title: 'Unchanged' });

  assert.strictEqual(calls.length, 0);
});

// ---------------------------------------------------------------------
test('renaming an item with no NotionTaskId (made directly in Content Planner) never calls Notion', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, {
    ID: 'row-4', Brand: 'AIS', Title: 'Old title', Status: 'Draft', NotionTaskId: '',
  }));
  const calls = withFetchSpy(context);

  const item = context.updateContent('row-4', { Title: 'New title' });

  assert.strictEqual(item.Title, 'New title');
  assert.strictEqual(calls.length, 0);
});

// ---------------------------------------------------------------------
test('a failed Notion push is logged but never throws or blocks the save', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  context.PropertiesService.getScriptProperties().setProperty('NOTION_TOKEN', 'secret-token');
  sheet.appendRow(rowFrom(COLUMNS, {
    ID: 'row-5', Brand: 'AIS', Title: 'Old title', Status: 'Draft', NotionTaskId: 'deleted-page',
  }));
  context.UrlFetchApp.fetch = () => ({ getContentText: () => JSON.stringify({ error: { message: 'Could not find page' } }) });

  const item = context.updateContent('row-5', { Title: 'New title' });

  assert.strictEqual(item.Title, 'New title', 'the Content Planner save itself must still succeed');
});

// ---------------------------------------------------------------------
test('missing NOTION_TOKEN skips the push silently instead of throwing', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, {
    ID: 'row-6', Brand: 'AIS', Title: 'Old title', Status: 'Draft', NotionTaskId: 'notion-page-6',
  }));
  const calls = withFetchSpy(context);

  const item = context.updateContent('row-6', { Title: 'New title' });

  assert.strictEqual(item.Title, 'New title');
  assert.strictEqual(calls.length, 0);
});

if (failures) {
  console.log(failures + ' test(s) failed.');
  process.exitCode = 1;
} else {
  console.log('All tests passed.');
}
