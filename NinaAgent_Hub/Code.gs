function getLogSheet() {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty('LOG_SHEET_ID');
  let ss;
  
  if (sheetId) {
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (e) {
      sheetId = null; // Recreate if deleted
    }
  }
  
  if (!sheetId) {
    ss = SpreadsheetApp.create('NinaAgent Hub - Access Logs');
    const sheet = ss.getActiveSheet();
    sheet.setName('Logs');
    sheet.appendRow(['Timestamp', 'User Email', 'Action', 'Details']);
    sheet.getRange("A1:D1").setFontWeight("bold").setBackground("#f3f3f3");
    sheet.setFrozenRows(1);
    props.setProperty('LOG_SHEET_ID', ss.getId());
  }
  
  // Setup Summary Tab if not done
  let summarySetup = props.getProperty('SUMMARY_SETUP_DONE');
  if (!summarySetup && ss) {
    try {
      const logSheet = ss.getSheets()[0];
      if (logSheet.getName() !== 'Logs') logSheet.setName('Logs');
      
      let summarySheet = ss.getSheetByName('Summary');
      if (!summarySheet) {
        summarySheet = ss.insertSheet('Summary');
        summarySheet.getRange('A1').setFormula('=QUERY(Logs!A:D, "SELECT C, D, COUNT(A) WHERE A IS NOT NULL GROUP BY C, D LABEL C \'ประเภท\', D \'หน้า / ชื่อเครื่องมือ\', COUNT(A) \'จำนวนครั้งที่เข้าใช้ (ครั้ง)\'", 1)');
        summarySheet.getRange("A1:C1").setFontWeight("bold").setBackground("#fff2cc");
      }
      props.setProperty('SUMMARY_SETUP_DONE', 'true');
    } catch(e) {}
  }
  
  return ss.getSheetByName('Logs') || ss.getSheets()[0];
}

function logAction(action, details) {
  try {
    const sheet = getLogSheet();
    const email = Session.getActiveUser().getEmail() || 'Anonymous (ไม่ได้ล็อกอิน)';
    const timestamp = new Date();
    sheet.appendRow([timestamp, email, action, details]);
  } catch(e) {
    console.error("Failed to log: " + e.toString());
  }
}

function testLog() {
  logAction("Test Action", "Testing the logging system");
  return "ทดสอบบันทึกข้อมูลสำเร็จ! ลองเช็คใน Google Sheet ดูครับ";
}

function doGet(e) {
  // Log page visit
  logAction('Page Load', 'User opened NinaAgent Hub');
  
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('NinaAgent Hub')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
