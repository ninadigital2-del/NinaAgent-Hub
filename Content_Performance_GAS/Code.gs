/**
 * Content Performance Dashboard — Google Apps Script backend
 *
 * Read-only proxy in front of the two Notion databases that
 * `PILOT — STD — Fetch Meta v1` (Make.com) already keeps updated every
 * Tuesday: "Content Performance" (per-post Reach/Engagement/Thumbnail) and
 * "Meta Ads" (weekly paid spend/reach). The dashboard front end
 * (content-performance.html) never talks to Notion directly — a browser
 * can't hold the Notion token safely, so this script holds it instead.
 *
 * Deploy steps: see SETUP.md in this folder.
 */

const NOTION_VERSION = '2025-09-03';

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    token: props.getProperty('NOTION_TOKEN'),
    contentDataSourceId: props.getProperty('NOTION_CONTENT_DATASOURCE_ID'),
    adsDataSourceId: props.getProperty('NOTION_ADS_DATASOURCE_ID'),
    draftDataSourceId: props.getProperty('NOTION_DRAFT_DATASOURCE_ID'), // "Weekly Update Draft" (Agency Command Center)
    revisionsDataSourceId: props.getProperty('NOTION_REVISIONS_DATASOURCE_ID'), // "Weekly Draft Revisions" (immutable, append-only)
    teamDataSourceId: props.getProperty('NOTION_TEAM_DATASOURCE_ID'), // "GEM Team Member" -- PM roster + Web Approval Code
    clientId: props.getProperty('NOTION_CLIENT_ID'), // optional — omit to return all clients
    clientName: props.getProperty('NOTION_CLIENT_NAME'), // display label only, e.g. "STAEDTLER"
  };
}

const PM_SESSION_TTL_SECONDS = 4 * 60 * 60;

// ---------- Web API ----------
function doGet(e) {
  const action = (e.parameter.action || 'data');
  try {
    if (action === 'data') {
      const cfg = getConfig_();
      return jsonResponse({
        success: true,
        client: cfg.clientId ? { id: cfg.clientId, name: cfg.clientName || '' } : null,
        content: listContentPerformance(),
        ads: listMetaAds(),
      });
    }
    if (action === 'drafts') {
      return jsonResponse({ success: true, drafts: listWeeklyDrafts() });
    }
    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) });
  }
}

// PM Review tab writes back here. This is the only part of the backend
// that isn't read-only. "pmLogin" trades a Web Approval Code for a session
// token; "saveDraft" writes only the PM-authored working fields (no
// revision created); "approveDraft" is the one action that creates an
// immutable Weekly Draft Revisions row and marks it as the outstanding
// LINE send request. Draft Text/Final Text/PM Prompt are never written
// here -- those belong to the Agency Command Center's own pipeline.
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'pmLogin') return jsonResponse(pmLogin_(body));
    if (body.action === 'saveDraft') return jsonResponse(saveDraft_(body));
    if (body.action === 'approveDraft') return jsonResponse(approveDraft_(body));
    return jsonResponse({ success: false, error: 'Unknown action: ' + body.action });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Notion query helper ----------
function queryDataSource_(dataSourceId, maxPages) {
  const cfg = getConfig_();
  if (!cfg.token || !dataSourceId) return [];
  const results = [];
  let cursor = null;
  let pages = 0;
  do {
    const filter = cfg.clientId
      ? { property: 'Client', relation: { contains: cfg.clientId } }
      : undefined;
    const body = { page_size: 100 };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;
    const res = UrlFetchApp.fetch('https://api.notion.com/v1/data_sources/' + dataSourceId + '/query', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + cfg.token,
        'Notion-Version': NOTION_VERSION,
      },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });
    const parsed = JSON.parse(res.getContentText());
    if (parsed.object === 'error') throw new Error('Notion API error: ' + (parsed.message || res.getContentText()));
    (parsed.results || []).forEach(p => results.push(p));
    cursor = parsed.has_more ? parsed.next_cursor : null;
    pages++;
  } while (cursor && pages < (maxPages || 5));
  return results;
}

function propText_(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return (prop.title || []).map(t => t.plain_text).join('');
  if (prop.type === 'rich_text') return (prop.rich_text || []).map(t => t.plain_text).join('');
  return '';
}
function propNumber_(prop) { return prop && prop.type === 'number' ? prop.number : null; }
function propSelect_(prop) { return prop && prop.type === 'select' && prop.select ? prop.select.name : ''; }
function propUrl_(prop) { return prop && prop.type === 'url' ? prop.url : ''; }
function propDate_(prop) { return prop && prop.type === 'date' && prop.date ? prop.date.start : ''; }
function propCheckbox_(prop) { return !!(prop && prop.type === 'checkbox' && prop.checkbox); }
function propRelationIds_(prop) { return prop && prop.type === 'relation' ? (prop.relation || []).map(r => r.id) : []; }
function richText_(str) { return str ? [{ type: 'text', text: { content: String(str) } }] : []; }

function notionRequest_(method, path, payload) {
  const cfg = getConfig_();
  const res = UrlFetchApp.fetch('https://api.notion.com/v1' + path, {
    method: method,
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + cfg.token,
      'Notion-Version': NOTION_VERSION,
    },
    payload: payload ? JSON.stringify(payload) : undefined,
    muteHttpExceptions: true,
  });
  const parsed = JSON.parse(res.getContentText());
  if (parsed.object === 'error') throw new Error('Notion API error: ' + (parsed.message || res.getContentText()));
  return parsed;
}

// ---------- Content Performance (per-post) ----------
function listContentPerformance() {
  const pages = queryDataSource_(getConfig_().contentDataSourceId, 5);
  return pages
    .filter(p => propSelect_(p.properties.Platform) !== 'Meta Ads' && propSelect_(p.properties.Platform) !== 'Google Ads')
    // Rows can be quarantined (e.g. misattributed to the wrong client) by
    // setting Data Quality to "Invalid" rather than deleting them -- see
    // the 2026-09-17 Agency Command Center handoff. Never show those.
    .filter(p => propSelect_(p.properties['Data Quality']) !== 'Invalid')
    .map(p => {
      // Notion returns null for a field that hasn't been fetched/measured
      // yet -- that's a different fact than a confirmed 0, so it's kept as
      // null all the way to the front end rather than coerced here.
      const reach = propNumber_(p.properties.Reach);
      const engagement = propNumber_(p.properties.Engagement);
      return {
        id: p.id,
        name: propText_(p.properties.Name),
        platform: propSelect_(p.properties.Platform),
        format: propSelect_(p.properties.Format),
        caption: propText_(p.properties.Caption),
        permalink: propUrl_(p.properties.Permalink),
        thumbnailUrl: propUrl_(p.properties['Thumbnail URL']),
        reach: reach,
        likes: propNumber_(p.properties.Likes),
        comments: propNumber_(p.properties.Comments),
        shares: propNumber_(p.properties.Shares),
        saves: propNumber_(p.properties.Saves),
        impressions: propNumber_(p.properties.Impressions),
        engagement: engagement,
        engagementRate: (reach > 0 && engagement != null) ? Math.round((engagement / reach) * 1000) / 10 : null,
        isTopContent: propCheckbox_(p.properties['Is Top Content']),
        publishDate: propDate_(p.properties['Publish Date']),
        fetchedAt: propDate_(p.properties['Fetched At']),
      };
    });
}

// ---------- Meta Ads (weekly paid) ----------
function listMetaAds() {
  const pages = queryDataSource_(getConfig_().adsDataSourceId, 3);
  // Two writers can land a snapshot for the same client+week under two
  // different Unique Keys (seen 2026-09-17: "STD|Meta Ads|2026-09-07" and
  // "<Brand UUID>|Meta Ads|2026-09-07" with identical values) -- summing
  // or WoW-comparing both silently doubles every number. Restrict to Meta
  // Ads rows and keep only the first snapshot per week as a stopgap until
  // the source data has one canonical key per client+platform+week.
  const seenWeek = {};
  const out = [];
  pages.forEach(p => {
    const platform = propSelect_(p.properties.Platform);
    if (platform && platform !== 'Meta Ads') return;
    const weekStart = propDate_(p.properties['Week Start']);
    if (weekStart) {
      if (seenWeek[weekStart]) return;
      seenWeek[weekStart] = true;
    }
    out.push({
      id: p.id,
      name: propText_(p.properties.Name),
      weekStart: weekStart,
      weekEnd: propDate_(p.properties['Week End']),
      reach: propNumber_(p.properties.Reach),
      impressions: propNumber_(p.properties.Impressions),
      clicks: propNumber_(p.properties.Clicks),
      spend: propNumber_(p.properties['Ad Spend']),
      cpm: propNumber_(p.properties.CPM),
      fetchStatus: propSelect_(p.properties['Data Fetch Status']),
    });
  });
  return out;
}

// ---------- Weekly Update Draft (PM review) ----------
// "Draft Text" and the data-fetch side of "Status" are generated by the
// Agency Command Center's own Make scenario every week. We only ever read
// that text, and only ever write: the PM working fields (via saveDraft_),
// and Status/Approved At/LINE Requested Revision (via approveDraft_, which
// also creates the one immutable Weekly Draft Revisions row).
const OUTSTANDING_DELIVERY_STATUSES = ['Pending', 'Sending', 'Uncertain'];

function listWeeklyDrafts() {
  const pages = queryDataSource_(getConfig_().draftDataSourceId, 3);
  return pages
    .sort((a, b) => (propDate_(b.properties.Week) || '').localeCompare(propDate_(a.properties.Week) || ''))
    .map(p => ({
      id: p.id,
      name: propText_(p.properties.Name),
      weekStart: propDate_(p.properties.Week),
      weekEnd: propDate_(p.properties['Week End']),
      status: propSelect_(p.properties.Status),
      draftText: propText_(p.properties['Draft Text']),
      pmWorkingNotes: propText_(p.properties['PM Working Notes']),
      nextWeekPlan: propText_(p.properties['Next Week Plan']),
      nextWeekFocus: propText_(p.properties['Next Week Focus']),
      askFromClient: propText_(p.properties['Ask from Client']),
      optimizationNotes: propText_(p.properties['Optimization Notes']),
      numericAccuracyVerified: propCheckbox_(p.properties['Numeric Accuracy Verified']),
      lineRequestedRevision: propNumber_(p.properties['LINE Requested Revision']),
      lineDeliveryStatus: propSelect_(p.properties['LINE Delivery Status']),
      lineSentRevision: propNumber_(p.properties['LINE Sent Revision']),
      lineSentAt: propDate_(p.properties['LINE Sent At']),
      lineDeliveryError: propText_(p.properties['LINE Delivery Error']),
      approvedAt: propDate_(p.properties['Approved At']),
    }));
}

function assertDraftBelongsToClient_(page) {
  const cfg = getConfig_();
  if (cfg.clientId && propRelationIds_(page.properties.Client).indexOf(cfg.clientId) === -1) {
    throw new Error('This draft does not belong to the configured client');
  }
}

// ---------- PM session (Web Approval Code -> short-lived token) ----------
function pmLogin_(body) {
  const cfg = getConfig_();
  const code = (body.code || '').trim();
  if (!code) throw new Error('Missing code');

  const result = notionRequest_('post', '/data_sources/' + cfg.teamDataSourceId + '/query', {
    page_size: 2,
    filter: {
      and: [
        { property: 'Web Approval Code', rich_text: { equals: code } },
        { property: 'Active', checkbox: { equals: true } },
        { property: 'Role', multi_select: { contains: 'PM' } },
      ],
    },
  });
  const match = (result.results || [])[0];
  if (!match) throw new Error('Invalid or inactive PM code');

  const token = Utilities.getUuid();
  const name = propText_(match.properties.Name);
  CacheService.getScriptCache().put(
    'pmsession_' + token,
    JSON.stringify({ teamMemberId: match.id, name: name }),
    PM_SESSION_TTL_SECONDS
  );
  return { success: true, token: token, name: name };
}

// Re-checks Active/Role live on every call (not just at login) so a PM
// whose access is revoked mid-session loses it on their very next action,
// not just when the cached token happens to expire.
function requireSession_(body) {
  const token = body.token;
  if (!token) throw new Error('Not signed in');
  const cached = CacheService.getScriptCache().get('pmsession_' + token);
  if (!cached) throw new Error('Session expired, please enter your PM code again');
  const session = JSON.parse(cached);

  const member = notionRequest_('get', '/pages/' + session.teamMemberId);
  const stillActive = propCheckbox_(member.properties.Active);
  const stillPM = (member.properties.Role && member.properties.Role.multi_select || []).some(o => o.name === 'PM');
  if (!stillActive || !stillPM) {
    CacheService.getScriptCache().remove('pmsession_' + token);
    throw new Error('PM access has been revoked');
  }
  return { teamMemberId: session.teamMemberId, name: session.name };
}

function saveDraft_(body) {
  const session = requireSession_(body);
  if (!body.pageId) throw new Error('Missing pageId');

  const page = notionRequest_('get', '/pages/' + body.pageId);
  assertDraftBelongsToClient_(page);

  // Manual PM fields only -- never Draft Text/Status/Final Text, so a
  // metrics refresh from the other system's pipeline can never clobber
  // what the PM typed here, and vice versa.
  const properties = {};
  if (body.pmWorkingNotes !== undefined) properties['PM Working Notes'] = { rich_text: richText_(body.pmWorkingNotes) };
  if (body.nextWeekPlan !== undefined) properties['Next Week Plan'] = { rich_text: richText_(body.nextWeekPlan) };
  if (body.nextWeekFocus !== undefined) properties['Next Week Focus'] = { rich_text: richText_(body.nextWeekFocus) };
  if (body.askFromClient !== undefined) properties['Ask from Client'] = { rich_text: richText_(body.askFromClient) };
  if (body.optimizationNotes !== undefined) properties['Optimization Notes'] = { rich_text: richText_(body.optimizationNotes) };
  if (body.numericAccuracyVerified !== undefined) properties['Numeric Accuracy Verified'] = { checkbox: !!body.numericAccuracyVerified };

  notionRequest_('patch', '/pages/' + body.pageId, { properties: properties });
  return { success: true, approvedBy: session.name };
}

// Combines the auto-generated Draft Text (with any NaN/blank-artifact
// lines hidden -- a stopgap for the known Make-side bug, reported
// separately) with the PM's shareable sections. PM Working Notes is
// intentionally excluded: it's the PM's own internal scratchpad, not
// client-facing copy, per the "no internal notes in client copy" rule.
function composeApprovedText_(page) {
  const rawLines = propText_(page.properties['Draft Text']).split('\n');
  const cleanLines = rawLines.filter(line => !/nan|infinity/i.test(line));
  let text = cleanLines.join('\n').trim();

  const sections = [
    ['สิ่งที่ปรับ/ข้อสังเกต', propText_(page.properties['Optimization Notes'])],
    ['แผนสัปดาห์หน้า', propText_(page.properties['Next Week Plan'])],
    ['โฟกัสสัปดาห์หน้า', propText_(page.properties['Next Week Focus'])],
    ['สิ่งที่ต้องการจากลูกค้า', propText_(page.properties['Ask from Client'])],
  ];
  sections.forEach(([label, value]) => {
    const trimmed = (value || '').trim();
    if (trimmed) text += '\n—-\n' + label + '\n' + trimmed;
  });
  return text.trim();
}

function findLatestRevision_(cfg, pageId) {
  const result = notionRequest_('post', '/data_sources/' + cfg.revisionsDataSourceId + '/query', {
    page_size: 1,
    filter: { property: 'Draft', relation: { contains: pageId } },
    sorts: [{ property: 'Revision', direction: 'descending' }],
  });
  return (result.results || [])[0] || null;
}

function approveDraft_(body) {
  const cfg = getConfig_();
  const session = requireSession_(body);
  if (!body.pageId) throw new Error('Missing pageId');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Another approval is in progress, please try again');
  try {
    const page = notionRequest_('get', '/pages/' + body.pageId);
    assertDraftBelongsToClient_(page);

    const approvedText = composeApprovedText_(page);
    if (!approvedText) throw new Error('Nothing to approve yet -- draft text and PM fields are both empty');

    const latest = findLatestRevision_(cfg, body.pageId);
    const currentStatus = propSelect_(page.properties['LINE Delivery Status']);
    const currentRequested = propNumber_(page.properties['LINE Requested Revision']);
    const hasOutstandingRequest = OUTSTANDING_DELIVERY_STATUSES.indexOf(currentStatus) !== -1 && currentRequested != null;

    if (latest && latest.properties['Approved Text'] && propText_(latest.properties['Approved Text']) === approvedText
        && currentRequested === propNumber_(latest.properties.Revision)) {
      // Identical re-approve (double click, or no changes since last approve) -- return the existing request, don't mint a new revision.
      return { success: true, revision: propNumber_(latest.properties.Revision), duplicate: true, approvedText: approvedText };
    }
    if (hasOutstandingRequest) {
      throw new Error('Revision ' + currentRequested + ' is still ' + currentStatus.toLowerCase() + ' -- wait for it to resolve before approving a new one');
    }

    const clientIds = propRelationIds_(page.properties.Client);
    let lineRecipientSnapshot = '';
    if (clientIds[0]) {
      try {
        const brand = notionRequest_('get', '/pages/' + clientIds[0]);
        lineRecipientSnapshot = propText_(brand.properties['PM LINE Recipient ID']);
      } catch (e) { /* recipient lookup is best-effort; Make can still resolve it independently */ }
    }

    const newRevision = latest ? propNumber_(latest.properties.Revision) + 1 : 1;
    const weekStart = propDate_(page.properties.Week);

    notionRequest_('post', '/pages', {
      parent: { type: 'data_source_id', data_source_id: cfg.revisionsDataSourceId },
      properties: {
        Name: { title: richText_(propText_(page.properties.Name) + ' — rev ' + newRevision) },
        Draft: { relation: [{ id: body.pageId }] },
        Client: { relation: clientIds.map(id => ({ id: id })) },
        'Week Start': weekStart ? { date: { start: weekStart } } : { date: null },
        Revision: { number: newRevision },
        'Approved Text': { rich_text: richText_(approvedText) },
        'Approved By': { relation: [{ id: session.teamMemberId }] },
        'Approved At': { date: { start: new Date().toISOString() } },
        'LINE Recipient ID Snapshot': { rich_text: richText_(lineRecipientSnapshot) },
      },
    });

    notionRequest_('patch', '/pages/' + body.pageId, {
      properties: {
        Status: { select: { name: 'Approved' } },
        'Approved At': { date: { start: new Date().toISOString() } },
        'LINE Requested Revision': { number: newRevision },
        'LINE Delivery Status': { select: { name: 'Pending' } },
      },
    });

    return { success: true, revision: newRevision, duplicate: false, approvedText: approvedText };
  } finally {
    lock.releaseLock();
  }
}
