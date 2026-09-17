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
    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
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
      const reach = propNumber_(p.properties.Reach) || 0;
      const engagement = propNumber_(p.properties.Engagement) || 0;
      return {
        id: p.id,
        name: propText_(p.properties.Name),
        platform: propSelect_(p.properties.Platform),
        format: propSelect_(p.properties.Format),
        caption: propText_(p.properties.Caption),
        permalink: propUrl_(p.properties.Permalink),
        thumbnailUrl: propUrl_(p.properties['Thumbnail URL']),
        reach: reach,
        likes: propNumber_(p.properties.Likes) || 0,
        comments: propNumber_(p.properties.Comments) || 0,
        shares: propNumber_(p.properties.Shares) || 0,
        saves: propNumber_(p.properties.Saves) || 0,
        impressions: propNumber_(p.properties.Impressions) || 0,
        engagement: engagement,
        engagementRate: reach > 0 ? Math.round((engagement / reach) * 1000) / 10 : 0,
        isTopContent: propCheckbox_(p.properties['Is Top Content']),
        publishDate: propDate_(p.properties['Publish Date']),
        fetchedAt: propDate_(p.properties['Fetched At']),
      };
    });
}

// ---------- Meta Ads (weekly paid) ----------
function listMetaAds() {
  const pages = queryDataSource_(getConfig_().adsDataSourceId, 3);
  return pages.map(p => ({
    id: p.id,
    name: propText_(p.properties.Name),
    weekStart: propDate_(p.properties['Week Start']),
    weekEnd: propDate_(p.properties['Week End']),
    reach: propNumber_(p.properties.Reach) || 0,
    impressions: propNumber_(p.properties.Impressions) || 0,
    clicks: propNumber_(p.properties.Clicks) || 0,
    spend: propNumber_(p.properties['Ad Spend']) || 0,
    cpm: propNumber_(p.properties.CPM) || 0,
    fetchStatus: propSelect_(p.properties['Data Fetch Status']),
  }));
}
