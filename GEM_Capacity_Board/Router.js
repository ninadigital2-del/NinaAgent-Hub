// ============================================================
// Router — shared entry points for every page served by this project
// ============================================================
// This file exists ONLY so that doGet/doPost and the PM Task Status
// Board backend can never be silently lost again. They used to live in
// Code.js, and more than once a full-file paste of Code.js (e.g. from an
// older local backup, made while only meaning to change Capacity Board
// logic) quietly wiped out the 'status-board' route along with
// getTasksForStatusBoard()/bulkUpdateStatus() -- with no error, just a
// page that silently fell back to showing GEM Capacity Board instead.
//
// RULES for whoever edits this project next:
//  1. Never paste a full replacement of Code.js from an old copy/backup.
//     Only edit the specific function(s) that actually changed.
//  2. Never add a doGet or doPost to Code.js (or any other file). There
//     must be exactly one of each in the whole project, and they live
//     here. Apps Script does not error on a duplicate -- it just makes
//     whichever one wins silently, which is exactly this bug again.
//  3. Adding a new page/route? Add it here in doGet(), not in Code.js.
// ============================================================

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'getAll')      return jsonResponse(getAllData());
  if (action === 'getTasks')    return jsonResponse(getNotionTasks());
  if (action === 'getCapacity') return jsonResponse(getCapacityData());
  if (action === 'getBrands')   return jsonResponse(getNotionBrands());
  if (action === 'manual')      return HtmlService.createHtmlOutputFromFile('manual').setTitle('คู่มือการใช้งาน GEM Graphic Capacity Board').addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  if (action === 'status-board') return HtmlService.createHtmlOutputFromFile('PMTaskStatusBoard').setTitle('PM Task Status Board').addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  return HtmlService.createHtmlOutput(getHtml())
    .setTitle('GEM Graphic Capacity Board')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.action === 'assign') {
    return jsonResponse(handleAssign(body));
  }
  if (body.action === 'markDone') {
    return jsonResponse(handleMarkDone(body));
  }
  if (body.action === 'relocate') {
    return jsonResponse(handleRelocate(body));
  }
  if (body.action === 'edit') {
    return jsonResponse(handleEditTask(body));
  }
  if (body.action === 'unassign') {
    return jsonResponse(handleUnassignTask(body));
  }
  if (body.action === 'deletePermanent') {
    return jsonResponse(handleDeleteTaskPermanently(body));
  }
  if (body.action === 'editNotion') {
    return jsonResponse(handleEditNotionTask(body));
  }
  if (body.action === 'deleteNotion') {
    return jsonResponse(handleDeleteNotionTask(body));
  }
  if (body.action === 'addSetting') {
    return jsonResponse(addDropdownSetting(body.type, body.newValue));
  }
  if (body.action === 'createTask') {
    return jsonResponse(handleCreateTask(body));
  }
  return jsonResponse({ ok: false, error: 'Unknown action' });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- PM TASK STATUS BOARD ----------

function getTasksForStatusBoard() {
  const props = PropertiesService.getScriptProperties();
  const key   = props.getProperty('NOTION_API_KEY');
  const dbId  = '2e69dccd181d81df8919fbacf921c7d5';

  const filter = {
    property: 'Status',
    status: { does_not_equal: 'Done' }
  };

  let allResults = [];
  let cursor = null;
  let failed = false;
  do {
    const payload = {
      filter: filter,
      sorts: [{ property: 'Due Date', direction: 'ascending' }],
      page_size: 100
    };
    if (cursor) payload.start_cursor = cursor;
    const res = notionFetch(`databases/${dbId}/query`, 'POST', payload, key);
    if (!res || !res.results) { failed = true; break; }
    allResults = allResults.concat(res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);

  if (failed) return { ok: false, tasks: [] };

  const tasks = allResults.map(p => {
    const props = p.properties;
    const ownerRollup = props['Owner']?.rollup?.array?.[0]?.multi_select || [];
    const brandRollup = props['Brand Name']?.rollup?.array?.[0];
    return {
      id:        p.id,
      url:       p.url,
      name:      props['Name']?.title?.[0]?.plain_text || '(ไม่มีชื่อ)',
      status:    props['Status']?.status?.name || '',
      dueDate:   props['Due Date']?.date?.start || '',
      priority:  props['Priority']?.select?.name || '',
      workBy:    (props['Work By']?.multi_select || []).map(x => x.name).join(', '),
      owner:     ownerRollup.map(x => x.name).join(', '),
      brand:     brandRollup?.formula?.string || brandRollup?.rich_text?.[0]?.plain_text || '',
      jobNumber: props['Job Number']?.formula?.string || '',
    };
  });

  return { ok: true, tasks };
}

function bulkUpdateStatus(pageIds, newStatus) {
  const key = PropertiesService.getScriptProperties().getProperty('NOTION_API_KEY');
  const result = { ok: true, updated: 0, failed: [] };

  (pageIds || []).forEach(pageId => {
    const cleanId = String(pageId).replace(/-/g, '');
    const res = notionFetch(`pages/${cleanId}`, 'PATCH', {
      properties: { 'Status': { status: { name: newStatus } } }
    }, key);
    if (!res || res.object === 'error') {
      result.failed.push({ pageId, error: (res && res.message) || 'Unknown error' });
    } else {
      result.updated++;
    }
  });

  if (result.failed.length) result.ok = false;
  return result;
}
