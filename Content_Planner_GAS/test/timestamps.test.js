'use strict';
// Node-only tests for the ApprovedAt/PostedAt stamping logic added to
// Code.gs. Run with: node Content_Planner_GAS/test/timestamps.test.js
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

// ---------------------------------------------------------------------
test('editing an old Posted item (blank ApprovedAt/PostedAt) without changing Status stamps nothing', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  const existing = rowFrom(COLUMNS, {
    ID: 'row-1', Brand: 'AIS', Title: 'Old post', Status: 'Posted',
    ScheduledAt: '2026-01-01T00:00:00.000Z', CreatedAt: '2025-01-01T00:00:00.000Z', UpdatedAt: '2025-01-01T00:00:00.000Z',
  });
  sheet.appendRow(existing);

  const item = context.updateContent('row-1', { Note: 'just a note edit' });

  assert.strictEqual(item.Status, 'Posted');
  assert.strictEqual(item.ApprovedAt, '', 'ApprovedAt must stay blank');
  assert.strictEqual(item.PostedAt, '', 'PostedAt must stay blank');
});

// ---------------------------------------------------------------------
test('Review -> Approved stamps ApprovedAt only', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, { ID: 'row-2', Brand: 'AIS', Title: 'A', Status: 'Review' }));

  const item = context.updateContent('row-2', { Status: 'Approved' });

  assert.ok(item.ApprovedAt, 'ApprovedAt should be set');
  assert.strictEqual(item.PostedAt, '', 'PostedAt should still be blank');
});

// ---------------------------------------------------------------------
test('Approved -> Posted keeps the original ApprovedAt and adds PostedAt', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, { ID: 'row-3', Brand: 'AIS', Title: 'A', Status: 'Review' }));

  const approved = context.updateContent('row-3', { Status: 'Approved' });
  const approvedAtFirst = approved.ApprovedAt;
  assert.ok(approvedAtFirst);

  // Small real delay so a bug that re-stamps ApprovedAt would be visible
  // as a different timestamp, not just coincidentally identical.
  const before = Date.now();
  while (Date.now() === before) { /* spin past this millisecond */ }

  const posted = context.updateContent('row-3', { Status: 'Posted' });
  assert.strictEqual(posted.ApprovedAt, approvedAtFirst, 'ApprovedAt must not change once set');
  assert.ok(posted.PostedAt, 'PostedAt should now be set');
});

// ---------------------------------------------------------------------
test('an item can skip straight from Review to Ready and still gets ApprovedAt', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, { ID: 'row-3b', Brand: 'AIS', Title: 'A', Status: 'Review' }));

  const item = context.updateContent('row-3b', { Status: 'Ready' });
  assert.ok(item.ApprovedAt, 'skipping Approved entirely still counts as approved');
  assert.strictEqual(item.PostedAt, '');
});

// ---------------------------------------------------------------------
test('creating a brand-new item directly as Posted stamps both timestamps', () => {
  const { context } = loadCodeGs([]);
  const item = context.createContent({ Brand: 'AIS', Title: 'Same-day post', Status: 'Posted' });
  assert.ok(item.ApprovedAt);
  assert.ok(item.PostedAt);
});

// ---------------------------------------------------------------------
test('a client cannot inject ApprovedAt/PostedAt directly via create payload', () => {
  const { context } = loadCodeGs([]);
  const item = context.createContent({
    Brand: 'AIS', Title: 'Sneaky', Status: 'Draft',
    ApprovedAt: '2020-01-01T00:00:00.000Z', PostedAt: '2020-01-01T00:00:00.000Z',
  });
  assert.strictEqual(item.ApprovedAt, '', 'ApprovedAt from payload must be ignored for a Draft item');
  assert.strictEqual(item.PostedAt, '', 'PostedAt from payload must be ignored for a Draft item');
});

// ---------------------------------------------------------------------
test('a client cannot inject ApprovedAt/PostedAt directly via update payload', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, { ID: 'row-4', Brand: 'AIS', Title: 'A', Status: 'Draft' }));

  const item = context.updateContent('row-4', {
    Note: 'trying to sneak a timestamp in',
    ApprovedAt: '2020-01-01T00:00:00.000Z',
    PostedAt: '2020-01-01T00:00:00.000Z',
  });
  assert.strictEqual(item.ApprovedAt, '');
  assert.strictEqual(item.PostedAt, '');
});

// ---------------------------------------------------------------------
test('updateStatus (LINE postback / bulk-status path) goes through the same stamping logic', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, { ID: 'row-5', Brand: 'AIS', Title: 'A', Status: 'Review' }));

  // doPost's updateStatus branch is literally `updateContent(id, { Status: status })`
  const item = context.updateContent('row-5', { Status: 'Posted' });
  assert.ok(item.ApprovedAt, 'updateStatus must also count as approval evidence');
  assert.ok(item.PostedAt);
});

// ---------------------------------------------------------------------
test('bulkCreateContent stamps each row independently based on its own Status', () => {
  const { context } = loadCodeGs([]);
  const items = context.bulkCreateContent([
    { Brand: 'AIS', Title: 'Draft one', Status: 'Draft' },
    { Brand: 'AIS', Title: 'Already posted', Status: 'Posted' },
    { Brand: 'AIS', Title: 'Approved only', Status: 'Ready' },
  ]);
  assert.strictEqual(items.length, 3);
  assert.strictEqual(items[0].ApprovedAt, '');
  assert.strictEqual(items[0].PostedAt, '');
  assert.ok(items[1].ApprovedAt);
  assert.ok(items[1].PostedAt);
  assert.ok(items[2].ApprovedAt);
  assert.strictEqual(items[2].PostedAt, '');
});

// ---------------------------------------------------------------------
test('bulkCreateContent also ignores client-supplied ApprovedAt/PostedAt', () => {
  const { context } = loadCodeGs([]);
  const items = context.bulkCreateContent([
    { Brand: 'AIS', Title: 'Sneaky bulk', Status: 'Draft', ApprovedAt: '2020-01-01T00:00:00.000Z' },
  ]);
  assert.strictEqual(items[0].ApprovedAt, '');
});

// ---------------------------------------------------------------------
test('ApprovedAt/PostedAt columns are appended after Sent_DayOf, not inserted mid-list', () => {
  const { context } = loadCodeGs([]);
  const idx = context.COLUMNS.indexOf('Sent_DayOf');
  assert.strictEqual(context.COLUMNS[idx + 1], 'ApprovedAt');
  assert.strictEqual(context.COLUMNS[idx + 2], 'PostedAt');
  assert.strictEqual(context.COLUMNS.length, idx + 3, 'ApprovedAt/PostedAt must be the last two columns');
});

console.log('');
if (failures) {
  console.log(failures + ' test(s) failed.');
  process.exit(1);
} else {
  console.log('All tests passed.');
}
