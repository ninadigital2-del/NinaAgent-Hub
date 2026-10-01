'use strict';
// Node-only tests for the client-link signing/verification and the
// brand-scoped restrictions on client-link requests in doGet/doPost.
// Run with: node Content_Planner_GAS/test/client-link-security.test.js
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

function withSecret(context, secret) {
  context.PropertiesService.getScriptProperties().setProperty('CLIENT_LINK_SECRET', secret || 'test-secret-key');
  return context;
}

// ---------------------------------------------------------------------
test('a freshly signed link verifies for its own brand', () => {
  const { context } = loadCodeGs([]);
  withSecret(context);
  const t = context.signClientLink_('AIS');
  const check = context.verifyClientLink_('AIS', t);
  assert.strictEqual(check.valid, true);
});

// ---------------------------------------------------------------------
test('a signature for one brand does not verify for another', () => {
  const { context } = loadCodeGs([]);
  withSecret(context);
  const t = context.signClientLink_('AIS');
  const check = context.verifyClientLink_('Nina Cosmetics', t);
  assert.strictEqual(check.valid, false);
  assert.strictEqual(check.reason, 'invalid');
});

// ---------------------------------------------------------------------
test('a tampered signature is rejected', () => {
  const { context } = loadCodeGs([]);
  withSecret(context);
  const t = context.signClientLink_('AIS');
  const tampered = t.slice(0, -1) + (t.slice(-1) === '0' ? '1' : '0');
  const check = context.verifyClientLink_('AIS', tampered);
  assert.strictEqual(check.valid, false);
  assert.strictEqual(check.reason, 'invalid');
});

// ---------------------------------------------------------------------
test('toggling a brand disabled then re-enabled: the original link works again unchanged', () => {
  const { context } = loadCodeGs([]);
  withSecret(context);
  const t = context.signClientLink_('AIS');
  assert.strictEqual(context.verifyClientLink_('AIS', t).valid, true);

  context.adminToggleClientLink_('AIS', true);
  const disabledCheck = context.verifyClientLink_('AIS', t);
  assert.strictEqual(disabledCheck.valid, false);
  assert.strictEqual(disabledCheck.reason, 'disabled');

  context.adminToggleClientLink_('AIS', false);
  assert.strictEqual(context.verifyClientLink_('AIS', t).valid, true, 'the SAME original token must work again');
});

// ---------------------------------------------------------------------
test('revoking (permanent) brand A breaks only A -- brand B is unaffected', () => {
  const { context } = loadCodeGs([]);
  withSecret(context);
  const tA = context.signClientLink_('AIS');
  const tB = context.signClientLink_('Nina Cosmetics');

  const newTA = context.adminRevokeClientLink_('AIS');

  assert.strictEqual(context.verifyClientLink_('AIS', tA).valid, false, 'old AIS token must stop working');
  assert.strictEqual(context.verifyClientLink_('AIS', newTA).valid, true, 'the newly issued AIS token must work');
  assert.strictEqual(context.verifyClientLink_('Nina Cosmetics', tB).valid, true, 'brand B must be completely unaffected');
});

// ---------------------------------------------------------------------
test('a brand new brand needs no setup -- defaults to version 1', () => {
  const { context } = loadCodeGs([]);
  withSecret(context);
  // No CLIENT_LINK_VERSIONS entry exists for this brand at all.
  const t = context.signClientLink_('Brand Nobody Configured');
  assert.strictEqual(context.verifyClientLink_('Brand Nobody Configured', t).valid, true);
});

// ---------------------------------------------------------------------
test('clientUpdateStatus_ rejects an item that actually belongs to a different brand', () => {
  const { context, sheet } = loadCodeGs([]);
  withSecret(context);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, { ID: 'row-1', Brand: 'Nina Cosmetics', Title: 'A', Status: 'Review' }));

  assert.throws(
    () => context.clientUpdateStatus_('AIS', 'row-1', 'Approved'),
    /BRAND_MISMATCH/,
    'an AIS-signed link must not be able to touch a Nina Cosmetics item by ID'
  );
});

// ---------------------------------------------------------------------
test('clientUpdateStatus_ rejects changing a Posted item (locked, use comments instead)', () => {
  const { context, sheet } = loadCodeGs([]);
  withSecret(context);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, { ID: 'row-2', Brand: 'AIS', Title: 'A', Status: 'Posted' }));

  assert.throws(() => context.clientUpdateStatus_('AIS', 'row-2', 'Approved'), /STATUS_LOCKED/);
});

// ---------------------------------------------------------------------
test('clientUpdateStatus_ allows Approved -> Revision (a real client correction)', () => {
  const { context, sheet } = loadCodeGs([]);
  withSecret(context);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, { ID: 'row-3', Brand: 'AIS', Title: 'A', Status: 'Approved' }));

  const item = context.clientUpdateStatus_('AIS', 'row-3', 'Revision');
  assert.strictEqual(item.Status, 'Revision');
});

// ---------------------------------------------------------------------
test('clientUpdateStatus_ rejects a status outside the client-allowed set', () => {
  const { context, sheet } = loadCodeGs([]);
  withSecret(context);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, { ID: 'row-4', Brand: 'AIS', Title: 'A', Status: 'Review' }));

  assert.throws(() => context.clientUpdateStatus_('AIS', 'row-4', 'Posted'), /STATUS_NOT_ALLOWED/);
});

// ---------------------------------------------------------------------
test('clientAddComment_ rejects an item from a different brand', () => {
  const { context, sheet } = loadCodeGs([]);
  withSecret(context);
  const { COLUMNS } = context;
  sheet.appendRow(rowFrom(COLUMNS, { ID: 'row-5', Brand: 'Nina Cosmetics', Title: 'A', Status: 'Review' }));

  assert.throws(() => context.clientAddComment_('AIS', 'row-5', 'client', 'hi'), /BRAND_MISMATCH/);
});

// ---------------------------------------------------------------------
test('doGet source: client-scoped list only reaches listContent, never owners/brands', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'Code.gs'), 'utf8');
  const doGetBody = src.slice(src.indexOf('function doGet'), src.indexOf('function doPost'));
  assert.ok(doGetBody.includes("clientBrand && clientSig"), 'doGet must branch on a signed client request');
  assert.ok(doGetBody.includes("verifyClientLink_(clientBrand, clientSig)"), 'doGet must verify before doing anything else');
  assert.ok(!/clientBrand[\s\S]{0,400}listOwners\(\)/.test(doGetBody), "client branch must never call listOwners()");
  assert.ok(!/clientBrand[\s\S]{0,400}listBrands\(\)/.test(doGetBody), "client branch must never call listBrands()");
});

// ---------------------------------------------------------------------
test('doPost source: client-scoped requests are limited to updateStatus/addComment', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'Code.gs'), 'utf8');
  const doPostBody = src.slice(src.indexOf('function doPost'), src.indexOf('function jsonResponse'));
  // The client-only branch runs before the admin `if (action === 'create')`
  // chain -- it must not be able to reach any admin-only function.
  const clientSectionEnd = doPostBody.indexOf("if (action === 'create')");
  const clientSection = doPostBody.slice(0, clientSectionEnd);
  ['createContent(', 'updateContent(body.id, body.data)', 'bulkCreateContent(', 'deleteContent(', 'extractCalendarImage('].forEach(fnCall => {
    assert.ok(!clientSection.includes(fnCall), `client-scoped branch must not be able to reach ${fnCall}`);
  });
  assert.ok(clientSection.includes('clientUpdateStatus_'));
  assert.ok(clientSection.includes('clientAddComment_'));
});

console.log('');
if (failures) {
  console.log(failures + ' test(s) failed.');
  process.exit(1);
} else {
  console.log('All tests passed.');
}
