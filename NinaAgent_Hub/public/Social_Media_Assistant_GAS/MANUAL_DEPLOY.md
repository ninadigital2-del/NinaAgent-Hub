# 🚀 คู่มือ Deploy ด้วยตนเอง (Manual Deploy Guide)

ถ้า `deploy.bat` มีปัญหา ให้ทำตามขั้นตอนนี้ครับ:

---

## วิธีที่ 1: Deploy ผ่าน Apps Script Editor (แนะนำที่สุด)

### ขั้นตอนที่ 1: สร้างโปรเจคใหม่
1. เปิดเบราว์เซอร์ ไปที่: https://script.google.com
2. คลิกปุ่ม **"+ New project"** (สีน้ำเงิน)
3. ตั้งชื่อโปรเจคว่า `Social Media Assistant GAS`
4. กด Enter

### ขั้นตอนที่ 2: ลบโค้ดเดิม
1. คุณจะเห็นไฟล์ `Code.gs` เปิดอยู่
2. **ลบโค้ดทั้งหมด** ในไฟล์นั้น (Ctrl+A → Delete)

### ขั้นตอนที่ 3: Copy โค้ดจากเครื่อง
1. เปิดโฟลเดอร์ในเครื่อง:
   ```
   C:\Users\poomi\Downloads\NinaAgent\Social_Media_Assistant_GAS
   ```

2. เปิดไฟล์ `Code.gs` ด้วย Notepad หรือ VS Code
3. **Copy ทั้งหมด** (Ctrl+A → Ctrl+C)
4. กลับไปที่ Apps Script Editor
5. **วาง** โค้ดลงไป (Ctrl+V)
6. กด **Save** (Ctrl+S)

### ขั้นตอนที่ 4: สร้างไฟล์ HTML ทีละไฟล์
1. คลิกปุ่ม **"+"** ข้าง Files → เลือก **"HTML"**
2. ตั้งชื่อไฟล์ตามตารางนี้:

| ชื่อไฟล์ใน GAS | ไฟล์ต้นฉบับในเครื่อง |
|---|---|
| `index` | `index.html` |
| `css-styles` | `css/styles.html` |
| `js-constants` | `js/constants.html` |
| `js-ui-manager` | `js/ui-manager.html` |
| `js-file-handler` | `js/file-handler.html` |
| `js-app` | `js/app.html` |
| `js-sheets-handler` | `js/sheets-handler.html` |

3. **สำหรับแต่ละไฟล์:**
   - เปิดไฟล์จากเครื่อง (เช่น `index.html`)
   - Copy ทั้งหมด
   - วางลงในไฟล์ HTML ที่สร้างใน GAS
   - กด Save

### ขั้นตอนที่ 5: เปิด Manifest File
1. คลิกไอคอน **⚙️ Project Settings** (ด้านซ้าย)
2. เลื่อนลงหา **"Show appsscript.json manifest file in editor"**
3. ติ๊กถูก ✅
4. กลับไปที่ Editor (คลิกไอคอน `</>`)
5. คุณจะเห็นไฟล์ `appsscript.json` เพิ่มมา

### ขั้นตอนที่ 6: แก้ไข appsscript.json
1. คลิกเปิดไฟล์ `appsscript.json`
2. เปิดไฟล์ `appsscript.json` จากเครื่อง
3. Copy ทั้งหมด → วางทับใน GAS
4. กด Save

### ขั้นตอนที่ 7: Deploy เป็น Web App
1. คลิกปุ่ม **Deploy** (มุมขวาบน)
2. เลือก **"New deployment"**
3. คลิกไอคอน ⚙️ ข้าง "Select type"
4. เลือก **"Web app"**
5. ตั้งค่า:
   - **Description**: `v1`
   - **Execute as**: `Me (อีเมลของคุณ)`
   - **Who has access**: `Anyone`
6. คลิก **Deploy**
7. ระบบจะถาม Permission → คลิก **Authorize access**
8. เลือก Google Account → คลิก **Allow**
9. Copy **Web app URL** ที่ระบบให้มา

### ขั้นตอนที่ 8: เปิดใช้งาน!
1. เปิด URL ที่ copy มาในเบราว์เซอร์
2. เริ่มใช้งานได้เลย! 🎉

---

## วิธีที่ 2: Deploy ด้วย Clasp CLI (สำหรับนักพัฒนา)

### ขั้นตอนที่ 1: เปิด Command Prompt
1. กดปุ่ม Windows + R
2. พิมพ์ `cmd` แล้วกด Enter

### ขั้นตอนที่ 2: ไปที่โฟลเดอร์โปรเจค
```cmd
cd C:\Users\poomi\Downloads\NinaAgent\Social_Media_Assistant_GAS
```

### ขั้นตอนที่ 3: Login Google
```cmd
clasp login
```
- เบราว์เซอร์จะเปิด → Login ด้วย Google Account
- กลับมาที่ Command Prompt

### ขั้นตอนที่ 4: เปิด Apps Script Settings
1. เปิดเบราว์เซอร์ ไปที่: https://script.google.com/home/usersettings
2. เปิด **"Google Apps Script API"** (ถ้ายังไม่เปิด)

### ขั้นตอนที่ 5: สร้างโปรเจค
```cmd
clasp create --type standalone --title "Social Media Assistant GAS"
```

### ขั้นตอนที่ 6: Push ไฟล์ทั้งหมด
```cmd
clasp push --force
```

### ขั้นตอนที่ 7: Deploy
```cmd
clasp deploy --description "v1"
```

### ขั้นตอนที่ 8: เปิดโปรเจค
```cmd
clasp open
```
- Apps Script Editor จะเปิดในเบราว์เซอร์

---

## 🔧 ตั้งค่าหลัง Deploy

### 1. ตั้งค่า Google Sheet ID
1. เปิด Google Sheet ที่ต้องการใช้
2. ดู URL:
   ```
   https://docs.google.com/spreadsheets/d/1F2zrQJfChJOqND_TNN5M_X8HmrwB7raUeuoJxeSQpTs/edit
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                    นี่คือ Sheet ID (copy ส่วนนี้)
   ```
3. ใน Apps Script Editor:
   - เปิดไฟล์ `Code.gs`
   - หาบรรทัด: `const SHEET_ID = '';`
   - แก้เป็น: `const SHEET_ID = '1F2zrQJfChJOqND_TNN5M_X8HmrwB7raUeuoJxeSQpTs';`
   - กด Save

### 2. สร้างแท็บใน Google Sheets
สร้าง 2 แท็บ:

**แท็บ 1: ชื่อ `Brands`**
```
A1: Timestamp
B1: id
C1: title
D1: brandInfo
E1: businessType
F1: tone
```

**แท็บ 2: ชื่อ `ContentHistory`**
```
A1: Timestamp
B1: id
C1: platform
D1: businessType
E1: tone
F1: contentType
G1: mediaFormat
H1: quantity
I1: headline
J1: caption
K1: hashtags
L1: visualSuggestion
```

---

## ❓ ปัญหาที่พบบ่อย

### 1. "clasp is not recognized"
**สาเหตุ:** Clasp ยังไม่ได้ติดตั้ง หรือ PATH ไม่ถูกต้อง
**วิธีแก้:**
```cmd
npm install -g @google/clasp
```

### 2. "Authorization required"
**สาเหตุ:** ยังไม่ได้ให้สิทธิ์ Apps Script
**วิธีแก้:**
- เปิด Apps Script Editor
- คลิก Deploy → Manage deployments
- คลิกไอคอนดินสอ → Authorize

### 3. "Script function not found"
**สาเหตุ:** ชื่อฟังก์ชันใน Code.gs ไม่ตรงกับที่เรียกใน HTML
**วิธีแก้:**
- เช็คว่า function `doGet()`, `callGemini()`, `uploadToDrive()` มีอยู่ใน Code.gs

### 4. "Exceeded maximum execution time"
**สาเหตุ:** Gemini API ใช้เวลานานเกินไป
**วิธีแก้:**
- ลดจำนวน content ที่ generate ในครั้งเดียว
- หรือลอง generate ทีละชิ้น

### 5. UI ไม่แสดง หรือ error
**สาเหตุ:** ชื่อไฟล์ HTML ไม่ถูกต้อง
**วิธีแก้:**
- เช็คว่าใน `Code.gs` ฟังก์ชัน `include()` อ้างอิงชื่อไฟล์ถูกต้อง
- ตัวอย่าง: `include('css-styles')` ต้องตรงกับชื่อไฟล์ `css-styles.html`

---

## 📞 ต้องการความช่วยเหลือ?

ถ้าติดปัญหา:
1. ถ่าย screenshot ข้อความ error
2. ส่งมาให้ผม
3. ผมจะช่วย debug ให้!

---

**ขอให้สนุกกับการใช้งาน Social Media Assistant! 🎉**
