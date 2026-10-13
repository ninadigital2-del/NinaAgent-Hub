'use strict';
// Node-only tests for LINK_REQUIRED_BRANDS -- the Script Property that
// scopes the "missing published link" badge/filter to specific brands
// (e.g. AIS) without affecting any other brand.
// Run with: node Content_Planner_GAS/test/link-required-brands.test.js
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

// ---------------------------------------------------------------------
test('unconfigured LINK_REQUIRED_BRANDS returns an empty list', () => {
  const { context } = loadCodeGs([]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.getLinkRequiredBrands())), []);
});

// ---------------------------------------------------------------------
test('a single configured brand is returned', () => {
  const { context } = loadCodeGs([]);
  context.PropertiesService.getScriptProperties().setProperty('LINK_REQUIRED_BRANDS', 'AIS');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.getLinkRequiredBrands())), ['AIS']);
});

// ---------------------------------------------------------------------
test('multiple comma-separated brands are trimmed and returned', () => {
  const { context } = loadCodeGs([]);
  context.PropertiesService.getScriptProperties().setProperty('LINK_REQUIRED_BRANDS', ' AIS , Nina Cosmetics ,,');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.getLinkRequiredBrands())), ['AIS', 'Nina Cosmetics']);
});

// ---------------------------------------------------------------------
test('the brands API action includes linkRequiredBrands alongside brands', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'Code.gs'), 'utf8');
  assert.ok(
    src.includes("if (action === 'brands') return jsonResponse({ success: true, brands: listBrands(), linkRequiredBrands: getLinkRequiredBrands() });"),
    "doGet's 'brands' action must attach linkRequiredBrands to the same response, not a separate endpoint"
  );
});

console.log('');
if (failures) {
  console.log(failures + ' test(s) failed.');
  process.exit(1);
} else {
  console.log('All tests passed.');
}
