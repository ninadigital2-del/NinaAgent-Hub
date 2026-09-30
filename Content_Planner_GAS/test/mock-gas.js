// Minimal mock of the Google Apps Script globals Code.gs touches, just
// enough to load the real file unmodified in Node and exercise the
// ApprovedAt/PostedAt stamping logic against a fake "Sheet".
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeMockSheet(initialRows) {
  // initialRows[0] is the header row; each subsequent row is a data row.
  const rows = initialRows.map(r => r.slice());
  function range(r, c, numRows, numCols) {
    numRows = numRows || 1;
    numCols = numCols || 1;
    return {
      getValues() {
        const out = [];
        for (let i = 0; i < numRows; i++) {
          const rowArr = rows[r - 1 + i] || [];
          const slice = [];
          for (let j = 0; j < numCols; j++) slice.push(rowArr[c - 1 + j] !== undefined ? rowArr[c - 1 + j] : '');
          out.push(slice);
        }
        return out;
      },
      setValues(vals) {
        for (let i = 0; i < numRows; i++) {
          while (rows.length < r + i) rows.push([]);
          const rowArr = rows[r - 1 + i];
          for (let j = 0; j < numCols; j++) rowArr[c - 1 + j] = vals[i][j];
        }
      },
      setValue(val) {
        while (rows.length < r) rows.push([]);
        rows[r - 1][c - 1] = val;
      },
      getValue() {
        return (rows[r - 1] || [])[c - 1];
      },
      setFontWeight() { return this; },
      setBackground() { return this; },
    };
  }
  return {
    _rows: rows,
    getLastRow() { return rows.length; },
    getLastColumn() { return rows[0] ? rows[0].length : 0; },
    appendRow(row) { rows.push(row.slice()); },
    getRange: range,
    getDataRange() { return range(1, 1, rows.length, this.getLastColumn()); },
    clearContents() { rows.length = 0; },
    setFrozenRows() {},
    deleteRow(idx) { rows.splice(idx - 1, 1); },
  };
}

function makeMockCalendarApp() {
  let calendar = null;
  return {
    EventColor: {
      PALE_BLUE: '1', PALE_GREEN: '2', MAUVE: '3', PALE_RED: '4', YELLOW: '5',
      ORANGE: '6', CYAN: '7', GRAY: '8', BLUE: '9', GREEN: '10', RED: '11',
    },
    createCalendar() {
      const events = {};
      let counter = 0;
      calendar = {
        id: 'cal-1',
        setDescription() { return this; },
        getId() { return this.id; },
        createEvent() {
          const id = 'evt-' + (++counter);
          const guestList = [];
          const ev = {
            setTitle() { return this; },
            setTime() { return this; },
            setDescription() { return this; },
            setColor(c) { this.color = c; return this; },
            getId() { return id; },
            getGuestList() { return guestList.map(email => ({ getEmail: () => email })); },
            addGuest(email) { if (guestList.indexOf(email) === -1) guestList.push(email); },
            removeGuest(email) { const i = guestList.indexOf(email); if (i > -1) guestList.splice(i, 1); },
            deleteEvent() { delete events[id]; },
          };
          events[id] = ev;
          return ev;
        },
        getEventById(id) { return events[id] || null; },
      };
      return calendar;
    },
    getCalendarById() { return calendar; },
  };
}

/**
 * Loads Content_Planner_GAS/Code.gs into a fresh sandbox with a mock
 * Content sheet pre-seeded with `contentRows` (array of COLUMNS-shaped
 * rows, header excluded -- the harness adds the header itself once
 * `context.COLUMNS` is known). Returns { context, sheet } so a test can
 * call context.createContent(...)/updateContent(...)/etc directly and
 * inspect sheet._rows afterwards.
 */
function loadCodeGs(contentRows) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');

  const scriptProps = { SHEET_ID: 'ss-1' };
  const sheets = {};

  const context = {
    console,
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(k) { return scriptProps[k] !== undefined ? scriptProps[k] : null; },
          setProperty(k, v) { scriptProps[k] = v; },
        };
      },
    },
    SpreadsheetApp: {
      openById() {
        return {
          getSheetByName(name) { return sheets[name] || null; },
          insertSheet(name) { const s = makeMockSheet([]); sheets[name] = s; return s; },
          getId() { return 'ss-1'; },
        };
      },
      create() { return context.SpreadsheetApp.openById(); },
    },
    CalendarApp: makeMockCalendarApp(),
    Utilities: {
      _uuidCounter: 0,
      getUuid() { return 'uuid-' + (++this._uuidCounter); },
      formatDate(date) { return date.toISOString(); },
    },
    Logger: { log() {} },
    ContentService: { createTextOutput: () => ({ setMimeType: () => ({}) }), MimeType: { JSON: 'JSON' } },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ atHour: () => ({ nearMinute: () => ({ everyDays: () => ({ inTimezone: () => ({ create() {} } ) }) }) }) }) }) },
    UrlFetchApp: { fetch() { throw new Error('UrlFetchApp should not be called by these tests'); } },
  };
  vm.createContext(context);
  // Top-level `const`/`let` bindings in a vm script don't become properties
  // of the context object the way `var`/function declarations do -- append
  // an explicit export footer (run as part of the same script, so it can
  // still see COLUMNS etc in scope) instead of touching Code.gs itself.
  const footer = '\n;this.COLUMNS = COLUMNS; this.APPROVED_OR_LATER = APPROVED_OR_LATER;';
  vm.runInContext(src + footer, context, { filename: 'Code.gs' });

  // Pre-seed the Content sheet the way setupSheets() would find an
  // already-deployed one: header row present, migration path taken.
  const header = context.COLUMNS.slice();
  const sheet = makeMockSheet([header, ...contentRows]);
  sheets['Content'] = sheet;

  return { context, sheet };
}

module.exports = { loadCodeGs, makeMockSheet };
