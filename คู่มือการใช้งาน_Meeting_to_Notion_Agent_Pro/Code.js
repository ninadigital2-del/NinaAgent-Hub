// ==========================================
// Meeting → Notion Agent Pro — entry point
// ==========================================
// Files in this project:
//   Code.js              this file: doGet only
//   CapacityStandards.js mirror of the Capacity Board's Notion rules (projects,
//                        brands, contacts, scope items, service types, work-type defaults)
//   MeetingInputs.js     turn Drive files (audio / image / PDF / Word / text) into text
//   MeetingAnalyze.js    prompt + analysis + creating Projects/Tasks in Notion
// Rule: exactly one doGet in the whole project, and it lives here.

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Meeting → Notion Agent Pro (GAS)')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
