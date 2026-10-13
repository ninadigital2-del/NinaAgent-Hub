'use strict';
// Node-only tests for the CLIENT_THEMES lookup and its wiring into doGet's
// already-verified client-link branch.
// Run with: node Content_Planner_GAS/test/client-brand-theming.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

const AIS_THEME = {
  title: 'AIS Retail Connect',
  subtitle: 'Content Calendar · ดูแลโดย GEM Digital Agency',
  dashboardUrl: '',
  fonts: { display: 'Anuphan:wght@500;600;700', body: 'IBM Plex Sans Thai:wght@400;500;600', num: 'IBM Plex Mono:wght@500;600' },
  light: { bg: '#F5F6F2', surface: '#FFFFFF', surface2: '#EEF0EA', line: '#DDE1D6', ink: '#211E1E', ink2: '#4B4E47', muted: '#6F7369',
    brand: '#BDDF19', brandInk: '#211E1E', accent: '#4E8A16',
    infoBg: '#E8EDF7', infoFg: '#2F4A7A', warnBg: '#FFF1D6', warnFg: '#8A5300', critBg: '#FDE2DF', critFg: '#A3261B' },
  dark: { bg: '#121411', surface: '#1A1C19', surface2: '#22251F', line: '#30342C', ink: '#EEF0EA', ink2: '#C4C8BD', muted: '#9A9F92',
    brand: '#BDDF19', brandInk: '#211E1E', accent: '#6BA71F',
    infoBg: '#1E2638', infoFg: '#A9BDE6', warnBg: '#3A2C10', warnFg: '#F4C56B', critBg: '#3D1C19', critFg: '#F4A49A' },
  status: { Posted: 'brand', Scheduled: 'surface2', Approved: 'surface2', Ready: 'surface2', Review: 'info', Revision: 'warn', Draft: 'surface2', Cancelled: 'surface2' },
};

function withThemes(context, themes) {
  context.PropertiesService.getScriptProperties().setProperty('CLIENT_THEMES', JSON.stringify(themes));
  return context;
}

// ---------------------------------------------------------------------
test('getClientTheme_ returns the configured theme for its own brand', () => {
  const { context } = loadCodeGs([]);
  withThemes(context, { AIS: AIS_THEME });
  // Code.gs runs in its own vm realm, so a value it returns has that
  // realm's Object.prototype -- round-trip through JSON on both sides
  // before comparing so deepStrictEqual compares structure, not realm.
  const got = JSON.parse(JSON.stringify(context.getClientTheme_('AIS')));
  assert.deepStrictEqual(got, AIS_THEME);
});

// ---------------------------------------------------------------------
test('getClientTheme_ returns null for a brand with no theme configured', () => {
  const { context } = loadCodeGs([]);
  withThemes(context, { AIS: AIS_THEME });
  assert.strictEqual(context.getClientTheme_('Nina Cosmetics'), null);
});

// ---------------------------------------------------------------------
test('getClientTheme_ returns null when CLIENT_THEMES is not set at all', () => {
  const { context } = loadCodeGs([]);
  assert.strictEqual(context.getClientTheme_('AIS'), null);
});

// ---------------------------------------------------------------------
test('getClientTheme_ tolerates malformed CLIENT_THEMES JSON instead of throwing', () => {
  const { context } = loadCodeGs([]);
  context.PropertiesService.getScriptProperties().setProperty('CLIENT_THEMES', '{not valid json');
  assert.strictEqual(context.getClientTheme_('AIS'), null);
});

// ---------------------------------------------------------------------
test('a brand never gets another brand\'s theme', () => {
  const { context } = loadCodeGs([]);
  const ninaTheme = Object.assign({}, AIS_THEME, { title: 'Nina Cosmetics Dashboard' });
  withThemes(context, { AIS: AIS_THEME, 'Nina Cosmetics': ninaTheme });
  assert.strictEqual(context.getClientTheme_('AIS').title, 'AIS Retail Connect');
  assert.strictEqual(context.getClientTheme_('Nina Cosmetics').title, 'Nina Cosmetics Dashboard');
});

// ---------------------------------------------------------------------
test('doGet source: action=theme lives inside the verified client branch, after verifyClientLink_', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
  const doGetBody = src.slice(src.indexOf('function doGet'), src.indexOf('function doPost'));
  const verifyIdx = doGetBody.indexOf('verifyClientLink_(clientBrand, clientSig)');
  const themeIdx = doGetBody.indexOf("action === 'theme'");
  assert.ok(verifyIdx !== -1, 'doGet must verify the client link');
  assert.ok(themeIdx !== -1, 'doGet must handle action=theme');
  assert.ok(themeIdx > verifyIdx, 'the theme branch must come after verification, never before it');
  const callIdx = doGetBody.indexOf('getClientTheme_(clientBrand)', themeIdx);
  assert.ok(callIdx !== -1 && callIdx > themeIdx,
    'action=theme must look up the theme for clientBrand specifically, not an arbitrary/unverified brand');
});

// ---------------------------------------------------------------------
test('doGet source: action=theme is unreachable from the admin (non-client-link) branch', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
  const doGetBody = src.slice(src.indexOf('function doGet'), src.indexOf('function doPost'));
  const clientBranchEnd = doGetBody.indexOf("if (action === 'list') return jsonResponse({ success: true, items: listContent() });");
  const adminBranch = doGetBody.slice(clientBranchEnd);
  assert.ok(!adminBranch.includes('getClientTheme_'), 'the admin branch must never call getClientTheme_ directly');
});

console.log('');
if (failures) {
  console.log(failures + ' test(s) failed.');
  process.exit(1);
} else {
  console.log('All tests passed.');
}
