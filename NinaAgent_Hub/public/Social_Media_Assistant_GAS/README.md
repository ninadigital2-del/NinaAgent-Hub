# Social Media Content Creator - Google Apps Script Version

ระบบ AI อัจฉริยะช่วยสร้าง Content และแคปชั่นสำหรับโซเชียลมีเดีย แปลงจาก React TSX เป็น Google Apps Script (GAS) format

## 📋 สารบัญ

- [คุณสมบัติหลัก](#คุณสมบัติหลัก)
- [การติดตั้ง](#การติดตั้ง)
- [การตั้งค่า Google Sheets](#การตั้งค่า-google-sheets)
- [การใช้งาน](#การใช้งาน)
- [โครงสร้างไฟล์](#โครงสร้างไฟล์)
- [การ Deploy](#การ-deploy)
- [การแก้ปัญหา](#การแก้ปัญหา)

---

## ✨ คุณสมบัติหลัก

### 🎨 สร้างคอนเทนต์ด้วย AI
- **Gemini 2.5 Flash AI** - สร้างคอนเทนต์คุณภาพสูง
- **8 ประเภทคอนเทนต์**: Educational, Entertainment, Inspirational, Promotional, FOMO, Q&A, Real-time, Branding
- **5 แพลตฟอร์ม**: Facebook, Instagram, TikTok, YouTube, Line
- **3 รูปแบบสื่อ**: Single Image, Album/Carousel, Video
- **สูงสุด 20 ไอเดีย** ต่อครั้ง

### 📤 อัปโหลดไฟล์อัจฉริยะ
- **รองรับหลายรูปแบบ**: รูปภาพ (JPG, PNG), PDF, Word (.doc/.docx), Text (.txt)
- **AI Extract** - สกัดข้อมูลแบรนด์และสินค้าอัตโนมัติ
- **Google Drive Integration** - อัปโหลดไฟล์ตรงไปยัง Google Drive
- **รองรับหลายไฟล์** - อัปโหลดไฟล์สินค้าได้พร้อมกัน

### 🎯 ปรับแต่งขั้นสูง
- **10 ประเภทธุรกิจ** ยอดนิยมในไทย
- **10 โทนเสียง** (Tone of Voice)
- **4 สไตล์เพศเสียง** (Gender Tone)
- **AI Refiner** - ให้ AI ปรับแต่งคอนเทนต์ตามคำสั่ง
- **Custom Inputs** - ระบุค่าเองได้ทั้งหมด

### 💾 บันทึกและส่งออก
- **Google Sheets** - บันทึกประวัติคอนเทนต์อัตโนมัติ
- **Export Word (.doc)** - ส่งออกเป็นเอกสาร
- **Export Slide Deck** - ส่งออกสไลด์นำเสนอ (HTML)
- **LocalStorage** - บันทึกข้อมูลในเบราว์เซอร์

### 🌓 Dark/Light Theme
- สลับธีมได้ทันที
- บันทึกการตั้งค่าธีม

---

## 🚀 การติดตั้ง

### วิธีที่ 1: Copy-Paste เข้า Apps Script Editor (แนะนำสำหรับมือใหม่)

#### ขั้นตอนที่ 1: สร้างโปรเจคใหม่
1. เปิดเบราว์เซอร์ไปที่ **[https://script.google.com](https://script.google.com)**
2. คลิก **"+ New project"**
3. ตั้งชื่อโปรเจคว่า `Social Media Content Creator`

#### ขั้นตอนที่ 2: แก้ไข Code.gs
1. ไฟล์ `Code.gs` จะมีอยู่แล้ว → **ลบโค้ดเดิมทั้งหมด**
2. เปิดไฟล์ `Code.gs` ในเครื่อง
3. **Copy ทั้งหมด** → **วาง** ลงใน Apps Script Editor
4. กด **Ctrl+S** (Save)

#### ขั้นตอนที่ 3: สร้างไฟล์ HTML
คลิก **"+"** ข้าง Files → เลือก **"HTML"** → ตั้งชื่อและ Copy-Paste โค้ดจากเครื่อง:

| ชื่อไฟล์ใน GAS | มาจากไฟล์ในเครื่อง |
|---|---|
| `index` | `index.html` |
| `css-styles` | `css/styles.html` |
| `js-constants` | `js/constants.html` |
| `js-ui-manager` | `js/ui-manager.html` |
| `js-file-handler` | `js/file-handler.html` |
| `js-app` | `js/app.html` |
| `js-sheets-handler` | `js/sheets-handler.html` |

#### ขั้นตอนที่ 4: แก้ไข appsscript.json
1. คลิก ⚙️ **Project Settings** → ติ๊กถูก **"Show appsscript.json manifest file in editor"**
2. กลับมาที่ Editor → Copy-Paste จาก `appsscript.json` ในเครื่องทับลงไป
3. กด Save

---

### วิธีที่ 2: ใช้ Clasp CLI (แนะนำสำหรับนักพัฒนา)

#### ติดตั้ง Clasp
```bash
npm install -g @google/clasp
```

#### Login
```bash
clasp login
```

#### สร้างโปรเจคและ Clone Script ID
1. ไปที่ [https://script.google.com](https://script.google.com) → สร้างโปรเจคใหม่
2. เปิดโปรเจค → **Project Settings** → Copy **Script ID**
3. แก้ไขไฟล์ `.clasp.json`:
```json
{
  "scriptId": "วาง_Script_ID_ที่นี่",
  "rootDir": "."
}
```

#### Push โค้ดขึ้น GAS
```bash
cd C:\Users\poomi\Downloads\NinaAgent\Social_Media_Assistant_GAS
clasp push
```

#### Deploy
```bash
clasp deploy --description "v1"
```

---

## 📊 การตั้งค่า Google Sheets

### 1. แก้ไข SHEET_ID
เปิดไฟล์ `Code.gs` และแก้บรรทัดนี้:
```javascript
const SHEET_ID = 'ใส่_Google_Sheet_ID_ของคุณ';
```

**วิธีหา Sheet ID:**
- เปิด Google Sheet
- ดูที่ URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID_ตรงนี้]/edit`

### 2. สร้างแท็บใน Google Sheets

#### แท็บ `Brands`
Headers (แถวแรก):
```
Timestamp | id | title | brandInfo | businessType | tone
```

#### แท็บ `ContentHistory`
Headers (แถวแรก):
```
Timestamp | id | platform | businessType | tone | contentType | mediaFormat | quantity | headline | caption | hashtags | visualSuggestion
```

---

## 💡 การใช้งาน

### การสร้างคอนเทนต์

1. **กรอกข้อมูลแบรนด์**
   - พิมพ์ข้อมูลเอง หรือ
   - อัปโหลดไฟล์ (รูปภาพ, PDF, Word, Text)
   - ดึงจาก Notion (Mock)

2. **ตั้งค่าพื้นฐาน**
   - เลือกประเภทธุรกิจ (10 ตัวเลือก)
   - เลือกโทนเสียง (10 ตัวเลือก)
   - เลือกเพศเสียง (4 ตัวเลือก)

3. **เลือกแพลตฟอร์มและรูปแบบ**
   - Platform: Facebook, IG, TikTok, YouTube, Line
   - Media Format: Single Image, Album, Video

4. **ระบุข้อมูลสินค้า** (ถ้ามี)
   - พิมพ์เอง หรืออัปโหลดไฟล์ (เลือกได้หลายไฟล์)

5. **เลือกประเภทคอนเทนต์** (8 ตัวเลือก)
   - 🎓 Educational
   - 🎭 Entertainment
   - ✨ Inspirational
   - 💰 Promotional
   - 🚨 FOMO (Fear of Missing Out)
   - 💬 Q&A
   - ⚡ Real-time
   - 💎 Branding

6. **กำหนดจำนวน** (1-20 ไอเดีย)

7. **กดปุ่ม "เริ่มสร้างสรรค์เนื้อหา"**

### การปรับแต่งคอนเทนต์

- **แก้ไขด้วยตนเอง**: แก้ไขหัวข้อ, แคปชั่น, แฮชแท็ก, Visual suggestion ได้โดยตรง
- **AI Refiner**: พิมพ์คำสั่งให้ AI ปรับแต่ง เช่น "ขอฮาๆ สั้นลง", "เน้น CTA ให้กดแชร์"
- **เพิ่ม/ลบแฮชแท็ก**: คลิกปุ่ม + หรือ × ที่แฮชแท็ก

### การส่งออก

- **Export Word**: ดาวน์โหลดเป็นไฟล์ .doc
- **Export Slide Deck**: ดาวน์โหลดเป็น HTML สำหรับนำเสนอ (ใช้ปุ่มลูกศร ← → เพื่อเลื่อนสไลด์)

---

## 📁 โครงสร้างไฟล์

```
Social_Media_Assistant_GAS/
├── Code.gs                    # Server-side GAS code
│   ├── doGet()                # Entry point
│   ├── saveBrandToSheets()    # บันทึกแบรนด์
│   ├── loadBrandsFromSheets() # โหลดแบรนด์
│   ├── saveContentToSheets()  # บันทึกคอนเทนต์
│   ├── loadContentHistoryFromSheets() # โหลดประวัติ
│   ├── uploadFileToDrive()    # อัปโหลดไฟล์
│   ├── deleteFileFromDriveByUrl() # ลบไฟล์
│   ├── generateSocialContent() # สร้างคอนเทนต์
│   ├── refineContent()        # ปรับแต่งคอนเทนต์
│   └── callGeminiUniversal()  # เรียก Gemini API
│
├── index.html                 # หน้าเว็บหลัก
├── appsscript.json            # GAS Manifest
├── .clasp.json                # Clasp CLI config
├── README.md                  # เอกสารนี้
│
├── css/
│   └── styles.html            # CSS ทั้งหมด
│
└── js/
    ├── constants.html         # ค่าคงที่, API Key, State
    ├── ui-manager.html        # Theme, Toast, Modal, Tab
    ├── file-handler.html      # Upload ไฟล์, AI Extract
    ├── app.html               # Core logic, Generate, Export
    └── sheets-handler.html    # Google Sheets integration
```

---

## 🌐 การ Deploy เป็น Web App

### ผ่าน Apps Script Editor

1. คลิก **Deploy** (มุมขวาบน) → **"New deployment"**
2. คลิก ⚙️ เลือก Type เป็น **"Web app"**
3. ตั้งค่า:
   - **Description**: `v1` (หรือเวอร์ชันที่คุณต้องการ)
   - **Execute as**: `Me (your email)`
   - **Who has access**: 
     - `Anyone` - ทุกคนเข้าถึงได้ (ไม่ต้อง login)
     - `Anyone with Google account` - ต้อง login Google
     - `Only myself` - เฉพาะคุณ
4. คลิก **Deploy**
5. ระบบจะให้ **URL เว็บแอป** → Copy เก็บไว้ใช้งาน

### ผ่าน Clasp CLI

```bash
clasp deploy --description "v1"
```

---

## 🔧 การแก้ปัญหา

### ❌ "Script function not found"
**สาเหตุ**: ชื่อ function ใน Code.gs ไม่ตรงกับที่เรียกใน HTML  
**วิธีแก้**: เช็คว่าชื่อ function ตรงกันทุกตัว

### ❌ "Permission denied"
**สาเหตุ**: ยังไม่ได้ให้สิทธิ์ Google Apps Script  
**วิธีแก้**: 
1. ไปที่ Deploy → Manage deployments
2. คลิก Edit → Authorize access
3. อนุญาตสิทธิ์ทั้งหมด

### ❌ "Exceeded maximum execution time"
**สาเหตุ**: Gemini API ใช้เวลานานเกินไป  
**วิธีแก้**:
- ลดจำนวนคอนเทนต์ที่ต้องการสร้าง
- เพิ่ม timeout ใน UrlFetchApp (Code.gs)

### ❌ UI ไม่แสดง
**สาเหตุ**: `include()` ใน `index.html` อ้างอิงชื่อไฟล์ HTML ไม่ถูกต้อง  
**วิธีแก้**: 
- ถ้าใช้ Clasp: เปลี่ยน `<?!= include('css/styles'); ?>` เป็น `<?!= include('css-styles'); ?>`
- หรือเปลี่ยนชื่อไฟล์ใน GAS Editor ให้ตรงกับที่ใช้ใน `include()`

### ❌ อัปโหลดไฟล์ไม่สำเร็จ
**สาเหตุ**: ไม่มีสิทธิ์เข้าถึง Google Drive  
**วิธีแก้**:
1. เปิด Code.gs
2. รัน function `forceAuth()` ครั้งแรก
3. อนุญาตสิทธิ์ Drive

### ❌ ไม่ได้รับข้อมูลจาก Gemini API
**สาเหตุ**: API Key ไม่ถูกต้อง หรือ quota เต็ม  
**วิธีแก้**:
- เช็คว่า `GEMINI_API_KEY` ใน `js/constants.html` ถูกต้อง
- ตรวจสอบ quota ที่ [Google AI Studio](https://aistudio.google.com/)

---

## 📝 หมายเหตุสำคัญ

### ข้อจำกัดของ Google Apps Script
- **Execution time**: สูงสุด 6 นาทีต่อครั้ง
- **File size**: ไฟล์ที่อัปโหลดต้องไม่เกิน 15MB
- **API quota**: Gemini API มี quota จำกัด (เช็คที่ Google AI Studio)

### ข้อแตกต่างจาก React Version
| ฟีเจอร์ | React (TSX) | GAS (HTML) |
|---|---|---|
| State Management | `useState` / `useEffect` | Vanilla JS + global variables |
| Gemini API | Client-side fetch | Server-side `UrlFetchApp` |
| Notion Import | Mock data | ดึงจาก Google Sheets แท็บ `Brands` |
| File Upload | Base64 in memory | อัปโหลดเข้า Google Drive |
| Export | Browser download | Browser download |

### การอัปเดตโค้ด
- **ผ่าน Apps Script Editor**: แก้ไขโค้ด → Save → Deploy new version
- **ผ่าน Clasp**: แก้ไขโค้ด → `clasp push` → `clasp deploy --description "v2"`

---

## 🎯 Tips & Tricks

### การใช้ AI Refiner ให้ได้ผลดี
- **ระบุชัดเจน**: "ขอฮาๆ สั้นลง", "เน้น CTA ให้กดแชร์"
- **เปลี่ยนโทน**: "เปลี่ยนเป็นทางการมากขึ้น", "ขอเป็นวัยรุ่นมากขึ้น"
- **ปรับความยาว**: "ขอยาวขึ้นอีก", "สรุปให้สั้นกว่านี้"

### การเลือกประเภทคอนเทนต์
- **Educational**: ให้ข้อมูล ความรู้ How-to
- **Entertainment**: ตลก มุกขำ ชวนยิ้ม
- **Inspirational**: ให้กำลังใจ รีวิวจากใจ
- **Promotional**: โปรโมชั่น ปิดการขาย
- **FOMO**: กลัวตกเทรนด์ พลาดดีล
- **Q&A**: ตอบคำถาม ข้อสงสัย
- **Real-time**: เล่นกระแส ฮิตติดเทรนด์
- **Branding**: สื่อสารตัวตน ค่านิยมแบรนด์

### การใช้ Visual Suggestion
- **Single Image**: อธิบายโทนสี สไตล์ ภาพประกอบ ข้อความบนภาพ
- **Album/Carousel**: แจกแจงทีละสไลด์อย่างละเอียด
- **Video**: แจกแจงทีละซีนตามช่วงเวลา พร้อมข้อความพาดหัวและซับไตเติ้ล

---

## 📞 การสนับสนุน

หากพบปัญหาหรือมีคำถาม:
1. เช็คส่วน "การแก้ปัญหา" ด้านบน
2. ตรวจสอบ Console Log ใน Apps Script Editor (View → Logs)
3. ตรวจสอบ Browser Console (F12) สำหรับ error ในฝั่ง client

---

## 📄 License

โปรเจคนี้พัฒนาเพื่อการศึกษาและใช้งานภายในองค์กร

---

## 🙏 Credits

- **Gemini API** by Google
- **Google Apps Script** by Google
- **Tailwind CSS** for styling
- **Font Awesome** for icons
- **Sarabun Font** by Cadson Demak

---

**พัฒนาด้วย ❤️ โดย AI Assistant**

*เวอร์ชัน: 2.0 (GAS)*  
*อัปเดตล่าสุด: มิถุนายน 2026*
