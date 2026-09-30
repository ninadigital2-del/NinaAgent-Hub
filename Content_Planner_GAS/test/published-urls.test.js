'use strict';
// Node-only tests for the PublishedUrls handling in Code.gs -- specifically
// the regression where saveContent() in content-planner.html used to send
// `published: {}` on every save, silently wiping out any links an item
// already had. Run with: node Content_Planner_GAS/test/published-urls.test.js
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
test('editing an item without touching PublishedUrls keeps its existing links', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, {
    ID: 'row-1', Brand: 'AIS', Title: 'A', Status: 'Posted',
    PublishedUrls: JSON.stringify({ Facebook: 'https://fb.com/post/1' }),
  }));

  // Same shape the real frontend now sends: an explicit PublishedUrls with
  // the same content, alongside an unrelated field change.
  const item = context.updateContent('row-1', {
    Title: 'A (typo fixed)',
    PublishedUrls: { Facebook: 'https://fb.com/post/1' },
  });

  assert.strictEqual(item.Title, 'A (typo fixed)');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(item.PublishedUrls)), { Facebook: 'https://fb.com/post/1' });
});

// ---------------------------------------------------------------------
test('the pre-fix bug: sending PublishedUrls as {} would have wiped an existing link', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, {
    ID: 'row-2', Brand: 'AIS', Title: 'A', Status: 'Posted',
    PublishedUrls: JSON.stringify({ Facebook: 'https://fb.com/post/2' }),
  }));

  // This documents the old bug's mechanism at the backend level: updateContent
  // itself has always faithfully applied whatever PublishedUrls it's given --
  // the bug was entirely that the frontend always sent {}. Confirms the fix
  // has to live in (and does live in) content-planner.html's saveContent(),
  // not here.
  const item = context.updateContent('row-2', { Title: 'A (edited)', PublishedUrls: {} });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(item.PublishedUrls)), {}, 'updateContent applies exactly what it is given, by design');
});

// ---------------------------------------------------------------------
test('updateContent omitting PublishedUrls entirely leaves it untouched', () => {
  const { context, sheet } = loadCodeGs([]);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, {
    ID: 'row-3', Brand: 'AIS', Title: 'A', Status: 'Posted',
    PublishedUrls: JSON.stringify({ Facebook: 'https://fb.com/post/3' }),
  }));

  const item = context.updateContent('row-3', { Title: 'A (edited)' }); // no PublishedUrls key at all
  assert.deepStrictEqual(JSON.parse(JSON.stringify(item.PublishedUrls)), { Facebook: 'https://fb.com/post/3' });
});

// ---------------------------------------------------------------------
test('createContent stores a PublishedUrls supplied at creation time', () => {
  const { context } = loadCodeGs([]);
  const item = context.createContent({
    Brand: 'AIS', Title: 'Already-live post', Status: 'Posted',
    PublishedUrls: { Facebook: 'https://fb.com/post/new' },
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(item.PublishedUrls)), { Facebook: 'https://fb.com/post/new' });
});

// ---------------------------------------------------------------------
test('createContent with no PublishedUrls defaults to {}', () => {
  const { context } = loadCodeGs([]);
  const item = context.createContent({ Brand: 'AIS', Title: 'Draft', Status: 'Draft' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(item.PublishedUrls)), {});
});

// ---------------------------------------------------------------------
test('bulkCreateContent stores per-item PublishedUrls', () => {
  const { context } = loadCodeGs([]);
  const items = context.bulkCreateContent([
    { Brand: 'AIS', Title: 'One', Status: 'Draft' },
    { Brand: 'AIS', Title: 'Two', Status: 'Posted', PublishedUrls: { Facebook: 'https://fb.com/post/bulk' } },
  ]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(items[0].PublishedUrls)), {});
  assert.deepStrictEqual(JSON.parse(JSON.stringify(items[1].PublishedUrls)), { Facebook: 'https://fb.com/post/bulk' });
});

console.log('');
if (failures) {
  console.log(failures + ' test(s) failed.');
  process.exit(1);
} else {
  console.log('All tests passed.');
}
