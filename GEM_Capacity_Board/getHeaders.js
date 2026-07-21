function getHeaders() {
  const ss = SpreadsheetApp.openById('1Q7CvHdG0mXtmIJ_hHsHU1wDHhSO-zYs0SBD6gYU7PTc');
  const sheet = ss.getSheets()[0];
  const headers = sheet.getRange("A4:O4").getValues()[0];
  console.log(JSON.stringify(headers));
}
