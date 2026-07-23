// ============================================
// Social Media Assistant GAS - Server-side Code
// ============================================

function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('Social Media Content Creator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================
// Configuration
// ============================================
const SHEET_ID = '1F2zrQJfChJOqND_TNN5M_X8HmrwB7raUeuoJxeSQpTs'; // ใช้ Sheet เดียวกับ graphic_brief_creator

// ============================================
// Notion API Configuration
// ============================================
const NOTION_API_KEY = "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"; 
const NOTION_PROJECTS_DB = "2e69dccd181d81fabee1e65a00e86e72";

// ============================================
// Google Sheets - Brands Management
// ============================================
function saveBrandToSheets(brandData) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Brands');
    if (!sheet) {
      sheet = ss.insertSheet('Brands');
    }

    var headers = ['Timestamp', 'id', 'title', 'brandInfo', 'businessType', 'tone'];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    var isUpdated = false;
    var rowNumber = -1;
    if (sheet.getLastRow() > 1) {
      var idValues = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < idValues.length; i++) {
        if (idValues[i][0] === brandData.id) {
          rowNumber = i + 2;
          isUpdated = true;
          break;
        }
      }
    }

    var row = [];
    brandData.Timestamp = new Date().toISOString();
    for (var j = 0; j < headers.length; j++) {
      row.push(brandData[headers[j]] || '');
    }

    if (isUpdated) {
      sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      rowNumber = sheet.getLastRow();
    }

    // --- NEW: Save to History ---
    saveBrandHistoryToSheets(brandData);
    // ----------------------------

    return { success: true, action: isUpdated ? 'update' : 'create', rowNumber: rowNumber };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function loadBrandsFromSheets() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Brands');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, brands: [] };
    }

    var headers = ['Timestamp', 'id', 'title', 'brandInfo', 'businessType', 'tone'];
    var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length);
    var values = dataRange.getValues();
    
    var brands = [];
    for (var r = 0; r < values.length; r++) {
      var brand = {};
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

// ============================================
// Google Sheets - Load Customers from Graphic Brief Creator
// ============================================
function loadCustomersFromGraphicBrief() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Customers');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, customers: [] };
    }

    var headers = ['Timestamp', 'id', 'name', 'background', 'target', 'pain', 'obj', 'mood', 'rule', 'msg', 'cta', 'ref'];
    var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length);
    var values = dataRange.getValues();
    
    var customers = [];
    for (var r = 0; r < values.length; r++) {
      var customer = {};
      for (var c = 0; c < headers.length; c++) {
        customer[headers[c]] = values[r][c];
      }
      customers.push(customer);
    }
    return { success: true, customers: customers };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================
// Google Sheets - Brand History Management
// ============================================
function saveBrandHistoryToSheets(brandData) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('BrandHistory');
    if (!sheet) {
      sheet = ss.insertSheet('BrandHistory');
    }

    // Including more fields to keep the brief state intact
    var headers = ['Timestamp', 'id', 'title', 'brandInfo', 'businessType', 'tone', 'genderTone', 'platform', 'mediaFormat', 'productInfo', 'contentObjective', 'quantity'];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    var row = [];
    brandData.Timestamp = new Date().toISOString(); // Update timestamp for history
    for (var j = 0; j < headers.length; j++) {
      row.push(brandData[headers[j]] || '');
    }

    sheet.appendRow(row);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function loadBrandHistoryFromSheets(brandId) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('BrandHistory');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, history: [] };
    }

    var headers = ['Timestamp', 'id', 'title', 'brandInfo', 'businessType', 'tone', 'genderTone', 'platform', 'mediaFormat', 'productInfo', 'contentObjective', 'quantity'];
    var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length);
    var values = dataRange.getValues();
    
    var history = [];
    for (var r = 0; r < values.length; r++) {
      if (values[r][1] === brandId) { // Check 'id' matches
        var item = {};
        for (var c = 0; c < headers.length; c++) {
          item[headers[c]] = values[r][c];
        }
        history.push(item);
      }
    }
    
    // Sort descending by Timestamp
    history.sort(function(a, b) {
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });
    
    return { success: true, history: history };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================
// Google Sheets - Content History Management
// ============================================
function saveContentToSheets(contentData) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('ContentHistory');
    if (!sheet) {
      sheet = ss.insertSheet('ContentHistory');
    }

    var headers = ['Timestamp', 'id', 'platform', 'businessType', 'tone', 'contentType', 'mediaFormat', 'quantity', 'headline', 'caption', 'hashtags', 'visualSuggestion'];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    var row = [];
    contentData.Timestamp = new Date().toISOString();
    for (var i = 0; i < headers.length; i++) {
      row.push(contentData[headers[i]] || '');
    }

    sheet.appendRow(row);
    return { success: true, rowNumber: sheet.getLastRow() };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function loadContentHistoryFromSheets() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('ContentHistory');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, history: [] };
    }

    var headers = ['Timestamp', 'id', 'platform', 'businessType', 'tone', 'contentType', 'mediaFormat', 'quantity', 'headline', 'caption', 'hashtags', 'visualSuggestion'];
    var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length);
    var values = dataRange.getValues();
    
    var history = [];
    for (var r = 0; r < values.length; r++) {
      var item = {};
      for (var c = 0; c < headers.length; c++) {
        item[headers[c]] = values[r][c];
      }
      // แปลง hashtags จาก string กลับเป็น array
      if (item.hashtags && typeof item.hashtags === 'string') {
        item.hashtags = item.hashtags.split(',').map(function(tag) { return tag.trim(); });
      }
      history.push(item);
    }
    return { success: true, history: history };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================
// File Upload to Google Drive
// ============================================
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

function deleteFileFromDriveByUrl(fileUrl) {
  try {
    if (!fileUrl) return { success: false, error: 'ไม่มีลิงก์ไฟล์' };
    
    var idMatch = fileUrl.match(/[-\w]{25,}/);
    if (idMatch && idMatch[0]) {
      var fileId = idMatch[0];
      var file = DriveApp.getFileById(fileId);
      file.setTrashed(true);
      return { success: true, message: 'ลบไฟล์ลงถังขยะเรียบร้อย' };
    }
    return { success: false, error: 'สกัด ID ไฟล์จากลิงก์ไม่สำเร็จ' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================
// Gemini AI Integration
// ============================================
function callGeminiUniversal(prompt, systemInstruction, fileUrls, schema, apiKey) {
  try {
    if (!apiKey || apiKey.trim() === "") {
      return { success: false, error: 'กรุณาใส่ GEMINI_API_KEY ในไฟล์ constants.html' };
    }
    
    var parts = [{ text: prompt }];

    if (fileUrls && fileUrls.length > 0) {
      for (var i = 0; i < fileUrls.length; i++) {
        var url = fileUrls[i];
        if (!url) continue;
        
        var idMatch = url.match(/[-\w]{25,}/);
        if (idMatch && idMatch[0]) {
          var file = DriveApp.getFileById(idMatch[0]);
          
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
    
    var match = aiText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    var cleanJson = match ? match[0] : aiText;
    
    return { success: true, data: JSON.parse(cleanJson) };

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================
// Content Generation with Gemini
// ============================================
function generateSocialContent(promptData, apiKey) {
  try {
    if (!apiKey || apiKey.trim() === "") {
      return { success: false, error: 'กรุณาใส่ GEMINI_API_KEY ในไฟล์ constants.html' };
    }

    var contentTypesText = {
      educational: "คอนเทนต์ข้อมูลหรือความรู้ (Educational Content) – เน้นให้ข้อมูลและความรู้ที่เป็นประโยชน์กับผู้อ่าน ผ่านหัวข้อที่กลุ่มเป้าหมายสนใจ มีคุณค่า มีสาระแต่เข้าถึงง่าย",
      entertainment: "คอนเทนต์บันเทิง (Entertainment Content) – สร้างขึ้นเพื่อความสนุกสนาน บันเทิง ชวนใหอมยิ้ม หัวเราะ หรือมีอารมณ์ร่วมสูงและชวนคอมเมนต์แชร์ความคิดเห็น",
      inspirational: "คอนเทนต์แรงบันดาลใจ (Inspirational Content) – มุ่งเน้นให้ผู้ชมรู้สึกมีกำลังใจ อบอุ่น มีไฟ อยากพัฒนาตนเองหรือร่วมเป็นกระบอกเสียงส่งต่อพลังบวก",
      promotional: "คอนเทนต์ส่งเสริมการขาย (Promotional Content) – ออกแบบมาเพื่อกระตุ้นการตัดสินใจซื้อ มีข้อมูลโปรโมชั่น จุดเด่นสินค้าเด่นชัด หรือ Checklist บีบให้ปิดการขายอย่างชาญฉลาด",
      fear: "คอนเทนต์สร้างความรู้สึกกลัว (Fear of Missing Out / FOMO Content) - ไม่ใช่กลัวผี แต่กลัวตกเทรนด์ กลัวไม่ได้สิทธิพิเศษอันล้ำค่าที่แบรนด์เอามามอบให้ กลัวเสียประโยชน์หากไม่รีบตัดสินใจซื้อหรือเป็นส่วนหนึ่งของบางสิ่งทันที",
      qa: "คอนเทนต์ Q&A (Q&A Content) - รวบรวมข้อสงสัยของผู้บริโภค หรือจัดสมมติฐานคำถาม-คำตอบสำคัญเกี่ยวกับผลิตภัณฑ์หรือแบรนด์ เพื่อให้กลุ่มเป้าหมายเห็นถึงความรอบคอบ ความใส่ใจ และความเป็นมืออาชีพขั้นเทพของแบรนด์",
      realtime: "คอนเทนต์จับกระแส (Real-time Content) - อิงและเล่นกับประเด็นฮิตติดกระแสล่าสุดในปัจจุบัน ดึงกระแสมาล้อเลียนหรือเชื่อมโยงกับแบรนด์อย่างสร้างสรรค์ โดยจับทิศทางให้ดี เลี่ยงกระแสขัดแย้งที่ทำร้ายภาพลักษณ์แบรนด์อย่างระมัดระวัง",
      branding: "คอนเทนต์สร้างภาพลักษณ์แบรนด์ (Branding Content) - เน้นนำเสนอและสื่อสารวิสัยทัศน์ ตัวตน แหล่งกำเนิด คอนเซปต์ความตั้งใจ และจุดยืนแบรนด์เพื่อสร้างความผูกพัน ความเชื่อใจ และความรักในแบรนด์ระยะยาว ควบคู่ไปกับการทำ Content Marketing ทรงประสิทธิภาพ"
    };

    var promptText = '\n    สร้างโซเชียลมีเดียคอนเทนต์จำนวน ' + promptData.quantity + ' คอนเทนต์ สำหรับช่องทาง: ' + promptData.platform + '\n    โดยอิงข้อมูลต่อไปนี้อย่างละเอียดถี่ถ้วน:\n    \n    1. ข้อมูลแบรนด์: ' + promptData.brandInfo + '\n    2. ประเภทธุรกิจ: ' + promptData.businessType + '\n    3. โทนเสียง (Tone of Voice): ' + promptData.tone + '\n    4. เพศของโทนเสียง (Gender style): ' + promptData.genderTone + '\n    5. สินค้าหรือบริการเจาะจง: ' + (promptData.productInfo ? promptData.productInfo : 'ไม่ระบุเฉพาะเจาะจง ให้อิงจากภาพรวมแบรนด์เป็นหลัก') + '\n    6. วัตถุประสงค์เนื้อหา: ' + contentTypesText[promptData.contentType] + '\n    7. รูปแบบสื่อของ Content: ' + promptData.mediaFormat + '\n\n    คำแนะนำพิเศษที่สำคัญมากสำหรับการระบุรายละเอียดในฟิลด์ "visual_suggestion" (คู่มือแนะนำสไตล์ถ่ายภาพ / วิดีโอสั้นประกอบโฆษณา):\n    - หากรูปแบบสื่อคือ "Single image" (รูปเดี่ยว): ให้อธิบายโทนสี สไตล์ภาพ จัดระเบียบพร็อพ บรรยากาศ และระบุข้อความสั้นๆ ที่ต้องใส่ลงบนภาพพาดหัว (Text on Image)\n    \n    - หากรูปแบบสื่อคือ "Album image" (เซ็ตสไลด์/Carousel): บังคับให้เขียนแจกแจงอย่างละเอียด "ทีละภาพอย่างชัดเจน" เช่น:\n      [ภาพที่ 1 - สไลด์หน้าแรก (Hook)]: อธิบายรายละเอียดดีไซน์/ภาพประกอบที่จะดึงสายตา + ข้อความพาดหัวตัวใหญ่บนหน้าแรก (Text)\n      [ภาพที่ 2 - สไลด์เนื้อหา]: อธิบายแผนการจัดภาพ + ข้อความที่จะเขียนพาดบนภาพเพื่ออธิบายรายละเอียด\n      [ภาพที่ 3 - สไลด์ขยี้ใจความ]: อธิบายองค์ประกอบภาพ + ข้อความพาดบนภาพ\n      [ภาพที่ 4 - สไลด์สรุป (CTA)]: สไตล์รูปภาพ/รูปโปรดักต์ + ข้อความปิดการขายหรือกระตุ้นให้คอมเมนต์/กดปุ่มแชร์\n      \n    - หากรูปแบบสื่อคือ "Video" (วิดีโอสั้น/Reels/TikTok): บังคับให้แจกแจงเนื้อหา "ทีละซีนตามช่วงเวลาอย่างละเอียด" เช่น:\n      [ซีนที่ 1 (วินาทีที่ 0-3)]: มุมกล้อง Action ของตัวละคร/สิ่งของ + ข้อความพาดหัวกราฟิกเด้งบนหน้าจอ (Text Overlay) + คำพากย์เสียง/ซับไตเติ้ลภาษาไทย (Subtitle)\n      [ซีนที่ 2 (วินาทีที่ 3-7)]: ภาพประกอบการรีวิว/ดีไซน์โคลสอัป + ข้อความพาดหัวกราฟิกบนจอ + เสียงพากย์หรือซับไตเติ้ล\n      [ซีนที่ 3 (วินาทีที่ 7-15)]: ฉากสรุปผลลัพธ์/โชว์สินค้า + ข้อความและคำกระตุ้น CTA ให้คลิกลิงก์/บันทึกคลิปนี้ไว้\n\n    จงใช้ความรอบรู้ ทันโลก ทันสถานการณ์ อัปเดตข้อมูลความรู้ให้ทันสมัย ทันกระแสนิยมและเทรนด์ในไทยเสมอ! \n    เขียนคำโฆษณา (Copywriting) ที่โดนใจกลุ่มเป้าหมาย ดึงดูดความสนใจตั้งแต่บรรทัดแรก และจบด้วย Call to Action (CTA) ที่ทรงพลัง เหมาะกับพฤติกรรมผู้ใช้ในแพลตฟอร์ม ' + promptData.platform + '\n\n    บังคับส่งกลับมาในรูปแบบ JSON และห้ามมีคำพูดอื่นๆ หรือสัญลักษณ์ markdown คลุมหน้าหลังนอกเหนือจากตัว JSON เท่านั้น โครงสร้าง JSON จะต้องมีโครงสร้างตามรูปแบบนี้อย่างเป๊ะๆ:\n    {\n      "contents": [\n        {\n          "id": "post_1",\n          "headline": "พาดหัวดึงดูดใจ (Hook Line)",\n          "caption": "เนื้อหาแคปชั่นที่จัดวรรคตอนอย่างสวยงาม มีลูกเล่น สอดรับกับโทนเสียงและเพศเสียงที่ระบุ พร้อมคำลงท้ายหรือ Call to Action",\n          "hashtags": ["แท็ก1", "แท็ก2", "แท็ก3"],\n          "visual_suggestion": "คำแนะนำแบบแบ่งสไลด์หรือแบ่งซีนแบบละเอียด (ตามที่ระบุในเงื่อนไขด้านบน)"\n        }\n      ]\n    }\n    ';

    var systemPrompt = 'คุณคือ AI ผู้เชี่ยวชาญด้าน Social Media Content Strategy และ Copywriter มืออาชีพ\nหน้าที่ของคุณคือช่วยสร้าง Content และเขียนแคปชั่นที่ดึงดูดใจ มีจิตวิทยาการโน้มน้าวใจ โดยยึดหลัก:\n- เข้าใจพฤติกรรมและความต้องการของกลุ่มเป้าหมายในประเภทธุรกิจนั้นๆ อย่างแท้จริง\n- ใช้โทนเสียงและสไตล์เพศที่กำหนดอย่างเป็นธรรมชาติ ไม่แข็งกระด้าง\n- แทรก Call to Action (CTA) ที่กระตุ้นให้อยากมีส่วนร่วม สั่งซื้อ หรือคอมเมนต์ อย่างแนบเนียน\n- ปรับสไตล์ให้ตรงกับแพลตฟอร์ม ' + promptData.platform + ' เสมอ (เช่น หากเลือก IG ต้องเรียบหรู คุมโทน, TikTok ต้องฮุคแรง ทันกระแส, Line ต้องอบอุ่นและปิดการขายทันที)\n- คุณเป็นผู้รอบรู้ มีสมองที่ทันสมัย อิงจากข่าวสารและเทรนด์ยอดนิยมล่าสุดในไทยอยู่เสมอ\n- บังคับตอบเป็น JSON ที่ตรงตาม Schema เสมอ ห้ามเกริ่นนำหรือลงท้ายใดๆ ทั้งสิ้น';

    var schema = {
      type: "OBJECT",
      properties: {
        contents: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING" },
              headline: { type: "STRING" },
              caption: { type: "STRING" },
              hashtags: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              visual_suggestion: { type: "STRING" }
            },
            required: ["id", "headline", "caption", "hashtags", "visual_suggestion"]
          }
        }
      },
      required: ["contents"]
    };

    var payload = {
      contents: [{ parts: [{ text: promptText }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    };

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
    var match = aiText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    var cleanJson = match ? match[0] : aiText;
    
    return { success: true, data: JSON.parse(cleanJson) };

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================
// Content Refinement with Gemini
// ============================================
function refineContent(promptData, apiKey) {
  try {
    if (!apiKey || apiKey.trim() === "") {
      return { success: false, error: 'กรุณาใส่ GEMINI_API_KEY ในไฟล์ constants.html' };
    }

    var systemPrompt = 'คุณคือ AI Copywriter ขั้นเทพ หน้าที่ของคุณคือปรับแต่งแคปชั่นและคอนเทนต์ตามคำสั่งของผู้ใช้ โดยอิงจากโครงสร้างข้อมูลเดิมที่มีและแก้ไขให้ตรงโจทย์ที่ได้รับอย่างเป็นธรรมชาติที่สุด\nตอบกลับด้วย JSON โครงสร้างแบบเดิม:\n{\n  "id": "' + promptData.id + '",\n  "headline": "ปรับปรุงหัวข้อใหม่",\n  "caption": "ปรับปรุงแคปชั่นใหม่",\n  "hashtags": ["แฮชแท็กใหม่"],\n  "visual_suggestion": "ปรับปรุงคำแนะนำภาพหรือวิดีโอสับสไลด์/แบ่งซีนใหม่แบบละเอียด"\n}';

    var userPrompt = '\n    ปรับแต่งโซเชียลคอนเทนต์นี้:\n    --------------------------\n    หัวข้อเดิม: ' + promptData.originalHeadline + '\n    แคปชั่นเดิม: ' + promptData.originalCaption + '\n    ไอเดียรูปภาพ/สไลด์เดิม: ' + promptData.originalVisual + '\n    --------------------------\n    \n    คำสั่งปรับแต่งเพิ่มเติมจากผู้ใช้: "' + promptData.refinePrompt + '"\n    \n    ปรับปรุงให้ได้โทนที่ดึงดูดใจ ตรงตามคำสั่ง และสอดรับกับสไตล์ของแพลตฟอร์ม ' + promptData.platform;

    var schema = {
      type: "OBJECT",
      properties: {
        id: { type: "STRING" },
        headline: { type: "STRING" },
        caption: { type: "STRING" },
        hashtags: {
          type: "ARRAY",
          items: { type: "STRING" }
        },
        visual_suggestion: { type: "STRING" }
      },
      required: ["id", "headline", "caption", "hashtags", "visual_suggestion"]
    };

    var payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    };

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
    var match = aiText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    var cleanJson = match ? match[0] : aiText;
    
    return { success: true, data: JSON.parse(cleanJson) };

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================
// Brand Extraction from Files
// ============================================
function extractBrandFromFiles(promptData, apiKey) {
  try {
    if (!apiKey || apiKey.trim() === "") {
      return { success: false, error: 'กรุณาใส่ GEMINI_API_KEY ในไฟล์ constants.html' };
    }

    var systemPrompt = "คุณคือ AI ผู้ชำนาญการวิเคราะห์ข้อมูลแบรนด์และวางแผนกลยุทธ์เอกสาร Brand Book หน้าที่ของคุณคือการจับใจความสำคัญแล้วถอดบทสรุปโดยสรุปจุดขายที่โดดเด่น สไตล์แบรนด์ สินค้าหลัก และกลุ่มลูกค้าเป้าหมาย ให้อยู่ในข้อความย่อหน้ารวมสั้นๆ เพื่อนำไปป้อนให้ AI นำไปแต่งคำโฆษณาต่อ";
    var userPrompt = 'นี่คือคู่มือแบรนด์ ข้อมูลผลิตภัณฑ์ หรือภาพตัวอย่างแบรนด์ชื่อ "' + promptData.filename + '" จงสแกนและดึงแกนหลัก คอนเซปต์ จุดแข็ง เอกลักษณ์ แนะนำผลิตภัณฑ์ และกลุ่มลูกค้า ของธุรกิจนี้ออกมา สรุปให้มีความเป็นมืออาชีพ มีพลัง และอ่านเข้าใจง่ายทันทีในภาษาไทย';

    var schema = {
      type: "OBJECT",
      properties: {
        brandInfo: { type: "STRING" }
      },
      required: ["brandInfo"]
    };

    return callGeminiUniversal(userPrompt, systemPrompt, promptData.fileUrls, schema, apiKey);

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function extractProductFromFiles(promptData, apiKey) {
  try {
    if (!apiKey || apiKey.trim() === "") {
      return { success: false, error: 'กรุณาใส่ GEMINI_API_KEY ในไฟล์ constants.html' };
    }

    var systemPrompt = "คุณคือ AI ผู้ชำนาญการวิเคราะห์สเปกสินค้า โปรโมชั่น และข้อมูลบริการ หน้าที่ของคุณคือสกัดจุดเด่น สรรพคุณ ราคา เงื่อนไข หรือข้อมูลสำคัญของสินค้า/บริการนั้นๆ ออกมาเป็นข้อความสรุปสั้นๆ ที่เข้าใจง่าย เพื่อนำไปใช้เป็นข้อมูลประกอบการเขียนโฆษณา";
    var userPrompt = 'นี่คือข้อมูลสินค้า บริการ หรือโปรโมชั่นชื่อ "' + promptData.filename + '" จงสแกนและดึงรายละเอียดที่สำคัญ จุดเด่น สรรพคุณ เงื่อนไข หรือโปรโมชั่นออกมา สรุปให้มีความเป็นมืออาชีพ มีพลัง และอ่านเข้าใจง่ายทันทีในภาษาไทย';

    var schema = {
      type: "OBJECT",
      properties: {
        productInfo: { type: "STRING" }
      },
      required: ["productInfo"]
    };

    return callGeminiUniversal(userPrompt, systemPrompt, promptData.fileUrls, schema, apiKey);

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================
// Authentication Helper
// ============================================
function forceAuth() {
  UrlFetchApp.fetch("https://www.google.com");
}

// ============================================
// Notion API - Get Projects from Meeting Agent
// ============================================
function getNotionProjects() {
  const url = `https://api.notion.com/v1/databases/${NOTION_PROJECTS_DB}/query`;
  const options = {
    method: "post",
    headers: {
      "Authorization": "Bearer " + NOTION_API_KEY,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({}), 
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    if (data.error) return { success: false, error: data.error.message };

    let projects = [];
    data.results.forEach(page => {
      let titleProp = page.properties["Project Name"]; 
      let name = "Untitled";
      if (titleProp && titleProp.title && titleProp.title.length > 0) {
        name = titleProp.title[0].plain_text;
      }
      projects.push({ id: page.id, name: name });
    });
    return { success: true, projects: projects };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================
// API Endpoint for GitHub Pages Frontend
// ============================================
function doPost(e) {
  try {
    // Enable CORS by returning proper headers (GAS does this implicitly via Web App)
    var request = JSON.parse(e.postData.contents);
    var action = request.action;
    var payload = request.payload || {};
    var response = {};

    switch (action) {
      case 'saveBrandToSheets':
        response = saveBrandToSheets(payload.brandData);
        break;
      case 'loadBrandsFromSheets':
        response = loadBrandsFromSheets();
        break;
      case 'loadCustomersFromGraphicBrief':
        response = loadCustomersFromGraphicBrief();
        break;
      case 'saveBrandHistoryToSheets':
        response = saveBrandHistoryToSheets(payload.brandData);
        break;
      case 'loadBrandHistoryFromSheets':
        response = loadBrandHistoryFromSheets(payload.brandId);
        break;
      case 'saveContentToSheets':
        response = saveContentToSheets(payload.contentData);
        break;
      case 'loadContentHistoryFromSheets':
        response = loadContentHistoryFromSheets();
        break;
      case 'uploadFileToDrive':
        response = uploadFileToDrive(payload.base64String, payload.fileName, payload.mimeType, payload.folderId);
        break;
      case 'deleteFileFromDriveByUrl':
        response = deleteFileFromDriveByUrl(payload.fileUrl);
        break;
      case 'generateSocialContent':
        response = generateSocialContent(payload.promptData, payload.apiKey);
        break;
      case 'refineContent':
        response = refineContent(payload.promptData, payload.apiKey);
        break;
      case 'extractBrandFromFiles':
        response = extractBrandFromFiles(payload.promptData, payload.apiKey);
        break;
      case 'extractProductFromFiles':
        response = extractProductFromFiles(payload.promptData, payload.apiKey);
        break;
      case 'getNotionProjects':
        response = getNotionProjects();
        break;
      default:
        response = { success: false, error: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Support OPTIONS for CORS preflight
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
