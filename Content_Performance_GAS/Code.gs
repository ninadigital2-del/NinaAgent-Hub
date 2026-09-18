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
    clientId: props.getProperty('NOTION_CLIENT_ID'), // optional — omit to return all clients
    clientName: props.getProperty('NOTION_CLIENT_NAME'), // display label only, e.g. "STAEDTLER"
  };
}

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

// PM Review form on the "PM Weekly Draft" tab writes back here. This is the
// only part of the backend that isn't read-only, and it only ever touches
// the 4 PM-authored fields plus Status -- never Draft Text/Final Text/etc,
// which belong to the Agency Command Center's own generation pipeline.
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'saveDraftReview') {
      return jsonResponse(saveDraftReview_(body));
    }
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
// This data source belongs to the Agency Command Center's own Make
// scenario, which generates "Draft Text" and moves "Status" through
// Pending -> ... -> Waiting for PM Review every week on its own. We only
// ever read that generated text, and only ever write the 4 PM-authored
// fields below plus Status=Approved -- never Draft Text/Final Text/PM
// Prompt, which are that other system's to own.
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
    }));
}

function saveDraftReview_(body) {
  const cfg = getConfig_();
  if (!body.pageId) throw new Error('Missing pageId');

  const page = notionRequest_('get', '/pages/' + body.pageId);
  if (cfg.clientId && propRelationIds_(page.properties.Client).indexOf(cfg.clientId) === -1) {
    throw new Error('This draft does not belong to the configured client');
  }

  const properties = {};
  if (body.pmWorkingNotes !== undefined) properties['PM Working Notes'] = { rich_text: richText_(body.pmWorkingNotes) };
  if (body.nextWeekPlan !== undefined) properties['Next Week Plan'] = { rich_text: richText_(body.nextWeekPlan) };
  if (body.nextWeekFocus !== undefined) properties['Next Week Focus'] = { rich_text: richText_(body.nextWeekFocus) };
  if (body.askFromClient !== undefined) properties['Ask from Client'] = { rich_text: richText_(body.askFromClient) };
  if (body.approve) properties['Status'] = { select: { name: 'Approved' } };

  notionRequest_('patch', '/pages/' + body.pageId, { properties: properties });
  return { success: true };
}
