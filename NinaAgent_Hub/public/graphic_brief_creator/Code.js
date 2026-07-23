function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('Graphic Brief System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==========================================
// ระบบจัดการข้อมูลลูกค้า/แบรนด์ (Sheet: Customers)
// ==========================================
function saveCustomerToSheets(customerData) {
  var SHEET_ID = '1F2zrQJfChJOqND_TNN5M_X8HmrwB7raUeuoJxeSQpTs';
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Customers');
    if (!sheet) {
      sheet = ss.insertSheet('Customers');
    }

    var headers = ['Timestamp', 'id', 'name', 'background', 'target', 'pain', 'obj', 'mood', 'rule', 'msg', 'cta', 'ref', 'files'];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    var isUpdated = false;
    var rowNumber = -1;
    if (sheet.getLastRow() > 1) {
      var idValues = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < idValues.length; i++) {
        if (idValues[i][0] === customerData.id) {
          rowNumber = i + 2;
          isUpdated = true;
          break;
        }
      }
    }

    var row = [];
    customerData.Timestamp = new Date().toISOString();
    for (var j = 0; j < headers.length; j++) {
      row.push(customerData[headers[j]] || '');
    }

    if (isUpdated) {
      sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      rowNumber = sheet.getLastRow();
    }

    return { success: true, action: isUpdated ? 'update' : 'create', rowNumber: rowNumber };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function loadBrandsFromSheets() {
  var SHEET_ID = '1F2zrQJfChJOqND_TNN5M_X8HmrwB7raUeuoJxeSQpTs';
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Customers'); 
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, brands: [] };
    }

    var headers = ['Timestamp', 'id', 'name', 'background', 'target', 'pain', 'obj', 'mood', 'rule', 'msg', 'cta', 'ref'];
    var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length);
    var values = dataRange.getValues();
    
    var brands = [];
    for (var r = 0; r < values.length; r++) {
      var brand = { uploadedCustomerFiles: [], uploadedBriefFiles: [] };
      for (var c = 0; c < headers.length; c++) {
        brand[headers[c]] = values[r][c];
      }
      brands.push(brand);
    }
    return { success: true, brands: brands };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// 2. ระบบจัดการข้อมูลแผ่น BRIEF (Sheet: Briefs)
// ==========================================
function saveBriefToSheets(briefData) {
  var SHEET_ID = '1F2zrQJfChJOqND_TNN5M_X8HmrwB7raUeuoJxeSQpTs';
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Briefs');
    if (!sheet) {
      sheet = ss.insertSheet('Briefs');
    }

var headers = ['Timestamp', 'id', 'brandId', 'brandName', 'projectName', 'channels', 'date', 'deadline', 'graphicName', 'bg', 'target', 'pain', 'obj', 'scope', 'deliver', 'mood', 'rule', 'msg', 'cta', 'ref', 'files'];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    var isUpdated = false;
    var rowNumber = -1;
    if (sheet.getLastRow() > 1) {
      var idValues = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < idValues.length; i++) {
        if (idValues[i][0] === briefData.id) {
          rowNumber = i + 2;
          isUpdated = true;
          break;
        }
      }
    }

    var row = [];
    briefData.Timestamp = new Date().toISOString();
    for (var i = 0; i < headers.length; i++) {
      row.push(briefData[headers[i]] || '');
    }

    if (isUpdated) {
      sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      rowNumber = sheet.getLastRow();
    }
    return { success: true, action: isUpdated ? 'update' : 'create', rowNumber: rowNumber };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function loadBriefsFromSheets() {
  var SHEET_ID = '1F2zrQJfChJOqND_TNN5M_X8HmrwB7raUeuoJxeSQpTs';
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Briefs');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, briefs: [] };
    }

    var headers = ['Timestamp', 'id', 'brandId', 'brandName', 'projectName', 'channels', 'date', 'deadline', 'graphicName', 'bg', 'target', 'pain', 'obj', 'scope', 'deliver', 'mood', 'rule', 'msg', 'cta', 'ref', 'files'];
    var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length);
    var values = dataRange.getValues();
    
    var briefs = [];
    for (var r = 0; r < values.length; r++) {
      var brief = {};
      for (var c = 0; c < headers.length; c++) {
        if (values[r][c] instanceof Date) {
          brief[headers[c]] = values[r][c].toISOString().split('T')[0];
        } else {
          brief[headers[c]] = values[r][c];
        }
      }
      briefs.push(brief);
    }
    return { success: true, briefs: briefs };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// อัปโหลดไฟล์ขึ้น Google Drive (ปรับใหม่ให้เสถียร 100%)
// ==========================================
function uploadFileToDrive(base64String, fileName, mimeType, folderId) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    var bytes = Utilities.base64Decode(base64String);
    var blob = Utilities.newBlob(bytes, mimeType, fileName);
    var file = folder.createFile(blob);
    return {
      success: true,
      fileId: file.getId(),
      url: file.getUrl()
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// ลบข้อมูลแบรนด์ลูกค้า ออกจาก Google Sheets
// ==========================================
function deleteCustomerFromSheets(brandId) {
  var SHEET_ID = '1F2zrQJfChJOqND_TNN5M_X8HmrwB7raUeuoJxeSQpTs';
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Customers');
    if (!sheet) return { success: false, error: 'ไม่พบแท็บ Customers' };

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var idToMatch = String(brandId).trim();

    // ลบย้อนกลับจากล่างขึ้นบน
    for (var r = values.length - 1; r > 0; r--) {
      if (String(values[r][1]).trim() === idToMatch) {
        sheet.deleteRow(r + 1);
        return { success: true };
      }
    }
    return { success: false, error: 'ไม่พบข้อมูลแบรนด์นี้ในชีต' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// ลบข้อมูลรายการ Briefs ออกจาก Google Sheets (แก้บั๊กการค้นหา ID แบบเป๊ะๆ)
// ==========================================
function deleteBriefsFromSheets(briefIds) {
  var SHEET_ID = '1F2zrQJfChJOqND_TNN5M_X8HmrwB7raUeuoJxeSQpTs';
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Briefs');
    if (!sheet) return { success: false, error: 'ไม่พบแท็บ Briefs' };

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var deletedCount = 0;

    // ทำให้ ID เป็น String ที่ตัดช่องว่างซ้ายขวาออกให้หมด เพื่อค้นหาเจอ 100%
    var idsToMatch = briefIds.map(function(id) { return String(id).trim(); });

    // ลบย้อนกลับจากล่างขึ้นบน
    for (var r = values.length - 1; r > 0; r--) {
      var rowId = String(values[r][1]).trim();
      if (idsToMatch.indexOf(rowId) !== -1) { 
        sheet.deleteRow(r + 1);
        deletedCount++;
      }
    }
    return { success: true, deletedCount: deletedCount };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// ลบไฟล์ตัวจริงออกจาก Google Drive โดยใช้ URL
// ==========================================
function deleteFileFromDriveByUrl(fileUrl) {
  try {
    if (!fileUrl) return { success: false, error: 'ไม่มีลิงก์ไฟล์' };
    
    // ใช้ Regex สกัดเอา File ID ออกมาจากลิงก์ของ Google Drive
    var idMatch = fileUrl.match(/[-\w]{25,}/);
    if (idMatch && idMatch[0]) {
      var fileId = idMatch[0];
      var file = DriveApp.getFileById(fileId);
      file.setTrashed(true); // โยนไฟล์ลงถังขยะ
      return { success: true, message: 'ลบไฟล์ลงถังขยะเรียบร้อย' };
    }
    return { success: false, error: 'สกัด ID ไฟล์จากลิงก์ไม่สำเร็จ' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
// ==========================================
// 🧠 ระบบสมองกล AI (ทำงานผ่าน Server หลังบ้าน)
// ==========================================
function callGeminiUniversal(prompt, systemInstruction, fileUrls, schema, apiKey) {
  try {
    if (!apiKey || apiKey.trim() === "") {
      return { success: false, error: 'กรุณาใส่ GEMINI_API_KEY ในไฟล์ constants.html' };
    }
    
    var parts = [{ text: prompt }];

    // โหลดไฟล์ตัวจริงจาก Google Drive ตามลิงก์ที่ส่งมา
    if (fileUrls && fileUrls.length > 0) {
      for (var i = 0; i < fileUrls.length; i++) {
        var url = fileUrls[i];
        if (!url) continue;
        
        var idMatch = url.match(/[-\w]{25,}/);
        if (idMatch && idMatch[0]) {
          var file = DriveApp.getFileById(idMatch[0]);
          
          // ป้องกันไฟล์ใหญ่เกิน 15MB ที่อาจทำให้ระบบค้าง
          if (file.getSize() > 15 * 1024 * 1024) { 
             return { success: false, error: 'ไฟล์มีขนาดใหญ่เกินกว่า 15MB AI ไม่สามารถอ่านแบบทันทีได้' };
          }
          
          var mimeType = file.getMimeType();
          var base64Data = Utilities.base64Encode(file.getBlob().getBytes());
          
          parts.push({
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          });
        }
      }
    }

    var payload = {
      contents: [{ parts: parts }]
    };

    if (systemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (schema) {
      payload.generationConfig = {
        responseMimeType: "application/json",
        responseSchema: schema
      };
    }

var fetchUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(fetchUrl, options);
    var json = JSON.parse(response.getContentText());

    if (json.error) {
       return { success: false, error: "Gemini API Error: " + json.error.message };
    }

    var aiText = json.candidates[0].content.parts[0].text;
    
    // ดักจับและทำความสะอาดกรณี AI ส่งข้อความขยะติดมา
    var match = aiText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    var cleanJson = match ? match[0] : aiText;
    
    return { success: true, data: JSON.parse(cleanJson) };

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
function forceAuth() {
  // คำสั่งนี้มีไว้เพื่อบังคับให้ Google เด้งหน้าต่างขอสิทธิ์เท่านั้น
  UrlFetchApp.fetch("https://www.google.com");
}

// ==========================================
// 📄 สร้าง Google Slides จาก Brief Data
// ==========================================
function createGoogleSlideBrief(briefData) {
  try {
    var brandName = briefData.brandName || "ไม่มีชื่อแบรนด์";
    var projectName = briefData.projectName || "โปรเจกต์งานออกแบบ";
    
    // สร้างสไลด์ใหม่ (ค่าเริ่มต้นขนาด 16:9)
    var presentation = SlidesApp.create('Graphic Brief - ' + brandName + ' - ' + projectName);
    
    // หน้าแรก (Title Slide)
    var titleSlide = presentation.getSlides()[0];
    var titleShape = titleSlide.getPlaceholder(SlidesApp.PlaceholderType.CENTERED_TITLE);
    var subtitleShape = titleSlide.getPlaceholder(SlidesApp.PlaceholderType.SUBTITLE);
    
    if (titleShape) {
      titleShape.asShape().getText().setText('Graphic Brief:\n' + brandName);
    }
    if (subtitleShape) {
      subtitleShape.asShape().getText().setText(projectName + '\nChannels: ' + (briefData.channels || '-') + '\nDeadline: ' + (briefData.deadline || '-'));
    }

    // หน้าสอง (Details) - สร้างสไลด์เปล่าเพื่อรองรับเทมเพลตพื้นหลังแบบหน้าเดียว
    var detailsSlide = presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    
    // ตั้งค่ารูปพื้นหลังของสไลด์หน้ารายละเอียดจาก Google Drive
    try {
      var bgFileId = '1n5D2Jf_tMM3IjJdpAnTDfxZ9AAL8g7W9';
      var bgBlob = DriveApp.getFileById(bgFileId).getBlob();
      detailsSlide.getBackground().setPictureFill(bgBlob);
    } catch(bgErr) {
      Logger.log("ไม่สามารถใส่รูปพื้นหลังได้: " + bgErr.toString());
    }

    // ฟังก์ชันสร้างกล่องข้อความเปล่า ไร้สีขอบ/พื้นหลัง ตัวหนังสือสีน้ำเงิน (พร้อมระบบ Autofit จำลอง)
    function addBriefTextBox(slide, text, left, top, width, height, defaultFontSize, isBold, textColor) {
      var cleanedText = stripHtml(text) || "-";
      var shape = slide.insertTextBox(cleanedText, left, top, width, height);
      shape.getBorder().setTransparent();
      shape.getFill().setTransparent();
      
      // ตั้งค่า Margin ไม่สามารถทำได้โดยตรงผ่าน Apps Script API จึงเอาโค้ดส่วนนี้ออกเพื่อป้องกัน Error
      // shape.setMarginTop(0);
      // shape.setMarginBottom(0);
      // shape.setMarginLeft(2);
      // shape.setMarginRight(2);
      
      // คำนวณขนาดตัวอักษรอัตโนมัติตามความยาวของข้อความ (Dynamic Font Sizing)
      var textLength = cleanedText.length;
      var fontSize = defaultFontSize || 7.5;
      
      if (!defaultFontSize) {
        // สำหรับเนื้อหารายละเอียดทั่วไปในสไลด์
        if (textLength > 150) {
          fontSize = 6.0;
        } else if (textLength > 100) {
          fontSize = 6.5;
        } else if (textLength > 70) {
          fontSize = 7.0;
        } else {
          fontSize = 7.5;
        }
      } else {
        // สำหรับแถบ Header (หากข้อมูลยาว ให้ย่อฟอนต์ลงเพื่อไม่ให้เบียดกัน)
        if (textLength > 28) {
          fontSize = defaultFontSize - 1.5;
        } else if (textLength > 18) {
          fontSize = defaultFontSize - 1.0;
        } else {
          fontSize = defaultFontSize;
        }
      }
      
      var textRange = shape.getText();
      var textStyle = textRange.getTextStyle();
      textStyle.setFontFamily("Sarabun");
      textStyle.setFontSize(fontSize);
      textStyle.setForegroundColor(textColor || "#0000ff"); // ตัวหนังสือสีน้ำเงินตามแบบ mockup
      if (isBold) {
        textStyle.setBold(true);
      }
      return shape;
    }

    // 1. แถบ Header ด้านบน (ข้อมูลแบรนด์/โปรเจกต์)
    addBriefTextBox(detailsSlide, briefData.brandName, 80, 23, 70, 18, 8.0, true);
    addBriefTextBox(detailsSlide, briefData.projectName, 205, 23, 115, 18, 8.0, true);
    addBriefTextBox(detailsSlide, briefData.channels, 370, 23, 95, 18, 8.0, true);
    addBriefTextBox(detailsSlide, briefData.date || briefData.dateStr, 515, 23, 45, 18, 8.0, true);
    addBriefTextBox(detailsSlide, briefData.graphicName, 650, 23, 65, 18, 8.0, true);

    // 2. โซนซ้าย (กรอบข้อมูลทั่วไปสีฟ้า)
    addBriefTextBox(detailsSlide, briefData.bg, 25, 78, 210, 48, null, false);
    addBriefTextBox(detailsSlide, briefData.target, 25, 148, 210, 42, null, false);
    addBriefTextBox(detailsSlide, briefData.pain, 25, 208, 210, 42, null, false);
    addBriefTextBox(detailsSlide, briefData.obj, 25, 284, 210, 28, null, false);
    addBriefTextBox(detailsSlide, briefData.scope, 25, 325, 210, 25, null, false);
    addBriefTextBox(detailsSlide, briefData.deliver, 25, 368, 210, 25, null, false);

    // 3. โซนขวาบน (กรอบข้อกำหนดดีไซน์สีส้ม)
    addBriefTextBox(detailsSlide, briefData.mood, 265, 78, 435, 42, null, false);
    addBriefTextBox(detailsSlide, briefData.rule, 265, 138, 435, 42, null, false);
    addBriefTextBox(detailsSlide, briefData.msg, 265, 198, 435, 42, null, false);
    addBriefTextBox(detailsSlide, briefData.cta, 265, 266, 435, 28, null, false);

    // 4. โซนขวาล่าง (กรอบ Reference สีเทา)
    addBriefTextBox(detailsSlide, briefData.ref, 265, 328, 435, 50, null, false);

    return {
      success: true,
      url: presentation.getUrl(),
      id: presentation.getId()
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function stripHtml(html) {
  if (!html) return "-";
  return html.replace(/<br\s*[\/]?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/ig, "").trim();
}

function formatText(placeholder) {
  var textRange = placeholder.asShape().getText();
  textRange.getTextStyle().setFontSize(12).setFontFamily("Sarabun");
  
  var text = textRange.asString();
  var headers = ["Background:", "Target Audience:", "Pain Point:", "Objective:", "Scope of work:", "Deliverables:", "Mood and Tone:", "Mandatory / Rule:", "Key Message:", "Call to Action:", "Reference:"];
  headers.forEach(function(header) {
    var index = text.indexOf(header);
    if (index !== -1) {
      textRange.getRange(index, index + header.length).getTextStyle().setBold(true).setForegroundColor("#1e3a8a");
    }
  });
}

function forceAuth() {
  // ฟังก์ชันนี้มีไว้เพื่อบังคับให้ Google ขอสิทธิ์ (Authorize)
  var slide = SlidesApp.create('Test Auth');
  var doc = DocumentApp.create('Test Auth');
  DriveApp.getFileById(slide.getId()).setTrashed(true);
  DriveApp.getFileById(doc.getId()).setTrashed(true);
}

// ==========================================
// 📄 สร้าง Google Docs จาก Customer Data
// ==========================================
function createGoogleDocCustomer(brandData) {
  try {
    var brandName = brandData.name || "ไม่มีชื่อแบรนด์";
    var doc = DocumentApp.create('Customer Profile - ' + brandName);
    var body = doc.getBody();
    
    var title = body.insertParagraph(0, 'ข้อมูลและข้อกำหนดลูกค้า: ' + brandName);
    title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    title.setForegroundColor('#4f46e5');
    
    function appendSection(label, content) {
      var p1 = body.appendParagraph(label);
      p1.setHeading(DocumentApp.ParagraphHeading.HEADING3);
      p1.setForegroundColor('#1e293b');
      var p2 = body.appendParagraph(stripHtml(content) || 'ไม่มีข้อมูลรายละเอียด');
      p2.setHeading(DocumentApp.ParagraphHeading.NORMAL);
      body.appendParagraph("");
    }
    
    appendSection('Background (ประวัติความเป็นมา):', brandData.background);
    appendSection('Target Audience (กลุ่มเป้าหมาย):', brandData.target);
    appendSection('Pain Point (จุดที่ต้องแก้ไข):', brandData.pain);
    appendSection('Objective (วัตถุประสงค์):', brandData.obj);
    appendSection('Mood and Tone (แนวทางอารมณ์ศิลปะ):', brandData.mood);
    
    return { success: true, url: doc.getUrl(), id: doc.getId() };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// 📄 สร้าง Google Slides จาก Customer Data
// ==========================================
function createGoogleSlideCustomer(brandData) {
  try {
    var brandName = brandData.name || "ไม่มีชื่อแบรนด์";
    var presentation = SlidesApp.create('Customer Profile - ' + brandName);
    
    var titleSlide = presentation.getSlides()[0];
    var titleShape = titleSlide.getPlaceholder(SlidesApp.PlaceholderType.CENTERED_TITLE);
    var subtitleShape = titleSlide.getPlaceholder(SlidesApp.PlaceholderType.SUBTITLE);
    
    if (titleShape) titleShape.asShape().getText().setText(brandName + '\nCustomer Profile');
    if (subtitleShape) subtitleShape.asShape().getText().setText('16:9 Landscape Slide\nสร้างโดยระบบ Brief AI Engine');

    var detailsSlide = presentation.appendSlide(SlidesApp.PredefinedLayout.TITLE_AND_TWO_COLUMNS);
    var dTitle = detailsSlide.getPlaceholder(SlidesApp.PlaceholderType.TITLE);
    var placeholders = detailsSlide.getPlaceholders();
    
    var dBody1 = null;
    var dBody2 = null;
    var bodyShapes = [];
    for (var i = 0; i < placeholders.length; i++) {
       var element = placeholders[i];
       if (element.getPageElementType() === SlidesApp.PageElementType.SHAPE) {
           var shape = element.asShape();
           if (shape.getPlaceholderType() === SlidesApp.PlaceholderType.BODY) {
               bodyShapes.push(element);
           }
       }
    }
    if (bodyShapes.length > 0) dBody1 = bodyShapes[0];
    if (bodyShapes.length > 1) dBody2 = bodyShapes[1];
    
    if (dTitle) dTitle.asShape().getText().setText('Brand Information');
    
    var leftText = "Background & Objective:\n" + stripHtml(brandData.background) + "\n\n";
    if(brandData.obj) leftText += "Objective:\n" + stripHtml(brandData.obj);
    
    var rightText = "Target & Pain Point:\n" + stripHtml(brandData.target) + "\n\n";
    if(brandData.pain) rightText += "Pain Point:\n" + stripHtml(brandData.pain) + "\n\n";
    rightText += "Mood and Tone:\n" + stripHtml(brandData.mood);
    
    if (dBody1) { dBody1.asShape().getText().setText(leftText); formatText(dBody1); }
    if (dBody2) { dBody2.asShape().getText().setText(rightText); formatText(dBody2); }

    return { success: true, url: presentation.getUrl(), id: presentation.getId() };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// 📄 สร้าง Google Docs จาก Brief Data
// ==========================================
function createGoogleDocBrief(briefData) {
  try {
    var brandName = briefData.brandName || "ไม่มีชื่อแบรนด์";
    var doc = DocumentApp.create('Graphic Brief - ' + brandName);
    var body = doc.getBody();
    
    var title = body.insertParagraph(0, 'Graphic Brief Creator - Document');
    title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    title.setForegroundColor('#4f46e5');
    
    body.appendParagraph("Brand Name: " + brandName).setBold(true);
    body.appendParagraph("Project Name: " + (briefData.projectName || '-'));
    body.appendParagraph("Channels: " + (briefData.channels || '-'));
    body.appendParagraph("วันที่ออกแบบ: " + (briefData.dateStr || '-'));
    body.appendParagraph("Deadline: " + (briefData.deadline || '-'));
    body.appendParagraph("Graphic Name: " + (briefData.graphicName || '-'));
    body.appendParagraph(""); 
    
    function appendSection(label, content) {
      var p1 = body.appendParagraph(label);
      p1.setHeading(DocumentApp.ParagraphHeading.HEADING3);
      p1.setForegroundColor('#1e3a8a');
      var p2 = body.appendParagraph(stripHtml(content) || '-');
      p2.setHeading(DocumentApp.ParagraphHeading.NORMAL);
      body.appendParagraph("");
    }
    
    appendSection('Background:', briefData.bg);
    appendSection('Target Audience:', briefData.target);
    appendSection('Pain Point:', briefData.pain);
    appendSection('Objective:', briefData.obj);
    appendSection('Scope of work:', briefData.scope);
    appendSection('Deliverables:', briefData.deliver);
    appendSection('Mood and Tone:', briefData.mood);
    appendSection('Mandatory / Rule:', briefData.rule);
    appendSection('Key Message:', briefData.msg);
    appendSection('Call to Action:', briefData.cta);
    appendSection('Reference:', briefData.ref);

    return { success: true, url: doc.getUrl(), id: doc.getId() };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}