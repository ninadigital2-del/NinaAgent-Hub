# 🚀 Quick Start Guide - Deploy to Google Apps Script

## วิธี Deploy อัตโนมัติ (แนะนำ!)

### ขั้นตอนที่ 1: ติดตั้ง Node.js (ถ้ายังไม่มี)
ดาวน์โหลดและติดตั้ง Node.js จาก: https://nodejs.org

### ขั้นตอนที่ 2: รัน Script อัตโนมัติ
1. เปิด File Explorer ไปที่โฟลเดอร์นี้:
   ```
   C:\Users\poomi\Downloads\NinaAgent\Social_Media_Assistant_GAS
   ```

2. **ดับเบิลคลิก** ไฟล์ `deploy.bat`

3. ทำตามขั้นตอนในหน้าต่าง Command Prompt:
   - Script จะติดตั้ง Clasp อัตโนมัติ (ถ้ายังไม่มี)
   - จะเปิดเบราว์เซอร์ให้ Login Google Account
   - สร้างโปรเจค GAS อัตโนมัติ
   - Push โค้ดทั้งหมดขึ้น GAS
   - Deploy เป็น Web App

4. เมื่อเสร็จแล้ว Script จะเปิด Apps Script Editor ให้

### ขั้นตอนที่ 3: ตั้งค่า Google Sheets
1. ใน Apps Script Editor เปิดไฟล์ `Code.gs`
2. หาบรรทัดนี้:
   ```javascript
   const SHEET_ID = '';
   ```
3. ใส่ Google Sheet ID ของคุณ:
   ```javascript
   const SHEET_ID = '1F2zrQJfChJOqND_TNN5M_X8HmrwB7raUeuoJxeSQpTs';
   ```
4. กด Save (Ctrl+S)

### ขั้นตอนที่ 4: เปิดใช้งาน!
1. ใน Apps Script Editor คลิกปุ่ม **Deploy** → **Manage deployments**
2. Copy **Web app URL** ที่แสดงอยู่
3. เปิด URL นั้นในเบราว์เซอร์
4. เริ่มใช้งานได้เลย! 🎉

---

## 📋 สร้างแท็บใน Google Sheets

เปิด Google Sheet ของคุณ แล้วสร้าง 2 แท็บนี้:

### แท็บ 1: `Brands`
Headers (แถวแรก):
```
Timestamp | id | title | brandInfo | businessType | tone
```

### แท็บ 2: `ContentHistory`
Headers (แถวแรก):
```
Timestamp | id | platform | businessType | tone | contentType | mediaFormat | quantity | headline | caption | hashtags | visualSuggestion
```

---

## 🐛 ปัญหาที่พบบ่อย

### ❌ "clasp is not recognized"
**วิธีแก้:** เปิด Command Prompt ใหม่ หรือ restart คอมพิวเตอร์

### ❌ "Login failed"
**วิธีแก้:** ลองรัน `clasp logout` แล้วรัน `deploy.bat` ใหม่

### ❌ "Push failed"
**วิธีแก้:** 
1. เช็คว่ามีไฟล์ `.clasp.json` อยู่ในโฟลเดอร์
2. ลบไฟล์ `.clasp.json` แล้วรัน `deploy.bat` ใหม่

### ❌ "Permission denied" เมื่อเปิด Web App
**วิธีแก้:**
1. ไปที่ Deploy → Manage deployments
2. คลิก Edit (รูปดินสอ)
3. เปลี่ยน "Who has access" เป็น "Anyone"
4. คลิก Deploy

---

## 📞 ต้องการความช่วยเหลือ?

อ่าน `README.md` สำหรับรายละเอียดเพิ่มเติม
หรือดูคู่มือใน `README.md`

---

**สร้างโดย:** Nina Agent  
**วันที่:** 2026-06-16
