# Handoff: Meeting Agent — รับ Input หลายรูปแบบ + สร้างงานมาตรฐาน Capacity Board

- **ผู้รับงาน:** โอม
- **วันที่:** 17 พ.ย. 2026
- **Branch:** `claude/youthful-dirac-qmfsr9`
- **สถานะ:** ออกแบบเสร็จเกือบหมดแล้ว ยังไม่ได้เขียนโค้ด ต้องปิด 4 เรื่องในหัวข้อ "สิ่งที่ต้องตัดสินใจก่อนเริ่ม" ก่อน

---

## 1. สรุป 30 วินาที

**ปัญหา:** ทุกวันนี้ PM ได้ข้อมูลประชุมมาหลายแบบ ทั้งเสียงอัด, ลายมือใน iPad, บันทึกประชุมออนไลน์, บรีฟ PDF และแชท LINE แต่ Meeting Agent รับได้แค่ข้อความที่พิมพ์หรือวางเอง PM จึงต้องถอดเสียงหรือพิมพ์ลายมือใหม่เองทุกครั้ง ใช้เวลา 15–30 นาทีต่อการประชุม

**ปัญหาที่สอง:** Meeting Agent กับ Capacity Board สร้าง Project และ Task ใน Notion คนละมาตรฐาน งานที่มาจาก Meeting Agent จึงขาด Brand, Contacts, Scope Item, Service Type และ Financial Risk

**ทางแก้ที่ตกลงกันแล้ว:**
1. ให้ PM อัปโหลดหลายไฟล์ต่อการประชุม แปลงทุกไฟล์เป็นข้อความด้วย Gemini แล้วให้ PM ตรวจข้อความก่อนวิเคราะห์
2. ตอนสร้าง Project และ Task ใช้กฎชุดเดียวกับ Capacity Board

---

## 2. ระบบตอนนี้ (As-is)

### แผนที่ไฟล์
| ส่วน | ไฟล์ | หมายเหตุ |
|---|---|---|
| ปุ่มใน Hub | `index.html` บรรทัด 82 และ 194, `NinaAgent_Hub/index.html` บรรทัด 104 | ลิงก์ไป Web App `AKfycbzPkq...PQg/exec` |
| หลังบ้าน | `คู่มือการใช้งาน_Meeting_to_Notion_Agent_Pro/Code.js` (369 บรรทัด) | Gemini 2.5 Flash + Notion API |
| หน้าจอ | `คู่มือการใช้งาน_Meeting_to_Notion_Agent_Pro/Index.html` | system prompt ของ Gemini อยู่ในไฟล์นี้ ในฟังก์ชัน `showAnalyzing()` |
| Deploy | `คู่มือการใช้งาน_Meeting_to_Notion_Agent_Pro/.clasp.json` | scriptId `1cq5Z5_tg9Xc0cq...` |
| Make (ไม่ได้ใช้) | `PM Input To GPT.blueprint.json` | Webhook ไป Gemini ทำงานซ้ำกับ Apps Script |

### Flow ปัจจุบัน
วางข้อความ → Gemini แยกออกเป็น Project และ Sub-task พร้อมจับคู่กับ Project ใน Notion (exact / uncertain / new) → PM ตรวจและแก้ → `syncTasksToNotion()` สร้างหรืออัปเดตหน้าใน Notion

### ปัญหาที่เจอในโค้ดปัจจุบัน
| # | ปัญหา | ผลกระทบ | ที่อยู่ |
|---|---|---|---|
| 1 | `getNotionProjects()` ไม่แบ่งหน้า (paginate) จึงได้แค่ 100 Project แรก | Project ที่เกิน 100 จับคู่ไม่เจอ ระบบจึงสร้าง Project ซ้ำ | `Code.js` |
| 2 | ไม่กรอง Project ที่ปิดแล้ว (Done / Archived) | AI จับคู่ไปที่ Project ที่ปิดแล้วได้ | `Code.js` |
| 3 | ถ้าดึงข้อมูล Notion ไม่สำเร็จ ระบบใช้รายชื่อ Project สำรอง 10 ตัวที่เขียนไว้ในโค้ด ID เหล่านั้นไม่ใช่ ID จริงใน Notion | ถ้ากดส่ง จะ error หรือผูกงานผิด Project | `Index.html` → `loadNotionProjects()` |
| 4 | `syncAllToNotion()` เรียกฟังก์ชันที่ไม่มีอยู่จริง | ตอนนี้ยังไม่กระทบ เพราะไม่มีที่ไหนเรียกใช้ ลบทิ้งได้ | `Code.js` |
| 5 | มีฟังก์ชัน debug/test ค้างอยู่ 6 ตัว | ทำให้โค้ดรก | `Code.js` |
| 6 | รายชื่อ PM เขียนไว้ในโค้ด (`'PM - อ้อ', 'PM - ยู้'`) | ต้องแก้โค้ดทุกครั้งที่ทีมเปลี่ยน | `Index.html` → `state.owners` |
| 7 | deadline นับจากวันที่กดปุ่ม ไม่ใช่วันประชุม | ถ้า PM เอาข้อมูลเข้าช้า deadline จะเลื่อนผิด | system prompt ใน `Index.html` |

---

## 3. สิ่งที่ตกลงแล้ว (Decisions)

| # | เรื่อง | ข้อตกลง |
|---|---|---|
| D1 | Input ที่รองรับ | ① ไฟล์เสียงจากมือถือ ② ลายมือหรือรูปจาก iPad ③ บันทึกประชุมออนไลน์ ④ เอกสารหรือบรีฟ (PDF, Word) ⑤ แชท LINE (วางข้อความ, ไฟล์ .txt ที่ export หรือ screenshot) |
| D2 | จำนวนไฟล์ต่อการประชุม | **หลายแบบปนกัน** ต้องรวมทุกไฟล์เป็นผลสรุปเดียว |
| D3 | ความยาวเสียง | ปกติ 30–90 นาที |
| D4 | วิธีส่งไฟล์เข้าระบบ | **อัปโหลดในหน้าเว็บ Agent และเลือกไฟล์จาก Google Drive ได้** (ไม่ทำ LINE OA หรือโฟลเดอร์ Drive ที่ระบบหยิบไฟล์ไปเอง) |
| D5 | วิธีประมวลผล | **ทาง A:** แปลงทีละไฟล์เป็นข้อความ → PM ตรวจข้อความ → วิเคราะห์ด้วย flow เดิม (ไม่ส่งทุกไฟล์ให้ Gemini ในครั้งเดียว และไม่ใช้บริการถอดเสียงภายนอก) |
| D6 | มาตรฐานตอนสร้าง Project และ Task | **ใช้แบบเดียวกับ Capacity Board** (รายละเอียดในหัวข้อ 4.4) |
| D7 | มอบงานให้ช่าง Graphic | **ไม่ทำใน Meeting Agent** ให้ PM ไปมอบงานใน Capacity Board ซึ่งเห็นภาระงานของช่างแต่ละคน |

---

## 4. ดีไซน์ที่เสนอ (To-be)

### 4.1 Flow 5 ขั้น
```
[1] รวมไฟล์ ─► [2] ตรวจข้อความ ─► [3] AI วิเคราะห์ ─► [4] ตรวจ Task ─► [5] ส่งเข้า Notion
    ใหม่            ใหม่            เดิม + ปรับ        เดิม + ปรับ        เดิม + ปรับ
```

**[1] รวมไฟล์ของการประชุม**
- ช่องกรอก: ชื่อประชุม และ **วันที่ประชุม** (ค่าเริ่มต้นเป็นวันนี้)
- ใส่ข้อมูลได้ 3 ทาง: ลากไฟล์ใส่, เลือกไฟล์จาก Drive (Google Picker) หรือวางข้อความ
- แต่ละไฟล์แสดงเป็นการ์ด มีไอคอนบอกประเภทและลบได้
- ตรวจขนาดไฟล์ตั้งแต่ตอนเลือก ถ้าเกิน 50MB บล็อกไว้และบอกให้ตัดหรือบีบอัดไฟล์

**[2] แปลงเป็นข้อความ แล้วให้ PM ตรวจ**
- แปลงทีละไฟล์ (เรียก server แยกครั้งต่อไฟล์ เพื่อไม่ให้ชนเวลาจำกัด 6 นาทีของ Apps Script)
- แสดงสถานะรายไฟล์: ⏳ กำลังแปลง / ✅ เสร็จ / ❌ ไม่สำเร็จ (ลองใหม่ หรือข้ามได้)
- ข้อความรวมแยกหัวข้อตามแหล่งที่มา เช่น `🎙️ เสียงประชุม`, `✍️ โน้ต iPad`, `💬 LINE (3–5 พ.ย.)`
- PM แก้ข้อความได้ก่อนกดวิเคราะห์

**[3] AI วิเคราะห์ (ใช้ของเดิม ปรับ prompt)**
- นับ deadline จาก **วันที่ประชุม** หรือ **วันที่ของข้อความ LINE** ไม่ใช่วันที่กดปุ่ม
- ใช้ชื่อผู้พูดจากเสียงหรือ LINE มาช่วยเดาผู้รับผิดชอบ
- เพิ่มการเดา Brand จากรายชื่อใน Brand DB

**[4] ตรวจ Task (ของเดิม เพิ่มช่องแบบ Capacity Board)**
- เมื่อเป็น Project ใหม่ ให้มีช่อง Brand → Contacts → Scope Item → Service Type → PM Owner (โหลดตัวเลือกจาก Notion)

**[5] ส่งเข้า Notion (ใช้กฎของ Capacity Board)**

### 4.2 การแปลงแต่ละประเภทเป็นข้อความ
| ประเภท | วิธี | ข้อควรระวัง |
|---|---|---|
| เสียง (.m4a, .mp3, .wav) | Gemini File API (upload ก่อน แล้วอ้างอิงด้วย fileUri) | ไฟล์เกิน 20MB ส่งเป็น inline ไม่ได้ ต้องใช้ File API |
| รูปลายมือ / screenshot | Gemini (inline image) | ควรให้ prompt ตอบว่า "อ่านไม่ออก" แทนการเดา |
| PDF | Gemini (inline PDF หรือ File API) | |
| Word (.docx) | แปลงเป็น Google Doc ผ่าน Drive แล้วอ่านข้อความ | Gemini อ่าน .docx ตรงๆ ไม่ได้ |
| LINE .txt / ข้อความ | ไม่ต้องใช้ AI ส่งต่อได้เลย | ต้องเก็บวันที่และชื่อผู้ส่งของแต่ละข้อความไว้ |

### 4.3 การจัดการแชท LINE
- ไฟล์ .txt ที่ export จาก LINE มีวันที่กำกับทุกข้อความ **ต้องส่งวันที่และชื่อผู้ส่งต่อไปให้ prompt** ห้ามตัดทิ้ง
- ไฟล์ export ไม่มีข้อความเสียงและรูปในแชท ถ้าสำคัญ PM ต้องบันทึกออกมาแล้วอัปโหลดแยก ให้เขียนเป็นข้อความแนะนำไว้ในหน้าจอ

### 4.4 มาตรฐานของ Capacity Board ที่ต้องนำมาใช้
อ้างอิงฟังก์ชันใน `GEM_Capacity_Board/Code.js`:

| ฟังก์ชัน | ทำอะไร |
|---|---|
| `getNotionProjects()` | แบ่งหน้าดึงครบทุก Project, กรอง Done / Archived / Brand Management ออก |
| `getActivePmTeamMembers_()`, `getProjectOwnerOptions()` | ดึงรายชื่อ PM จาก GEM Team Member เฉพาะ Role มี PM และ Active ใช้รูปแบบชื่อ `"PM - " + ชื่อเล่น` |
| `getNotionBrands()` | รายชื่อ Brand |
| `getContactsForBrand()` | Contacts ของ Brand ให้ PM เลือกเอง |
| `getScopeItemsForBrand()` | Scope Item (บรรทัดในใบเสนอราคา) ที่ยังไม่ปิด |
| `getServiceTypeOptions()` | Service Type |
| `createNotionProject()` | สร้าง Project จาก template, ผูก Brand / Contacts / Scope Item / Service Type / Owner |
| `WORK_TYPE_DEFAULTS_`, `applyWorkTypeDefaults_()` | เติม Work By, Task Type, Financial Risk ตาม Work Type |
| `getOrCreateBotInboxProjectId_()` | Task ที่ไม่มี Project ให้เข้า Bot Inbox ของ PM |

**สิ่งที่ไม่ต้องเอามา:** การมอบงานให้ช่าง (`Graphic Assignee`) และ `writeToPersonSheet()` ตามข้อตกลง D7

**ข้อสำคัญ:** AI เดาค่าตั้งต้นให้ได้ แต่ค่าของ Work By, Task Type และ Financial Risk **ต้องมาจาก `WORK_TYPE_DEFAULTS_` เท่านั้น** ห้ามให้ AI เดา

### 4.5 Notion IDs ที่เกี่ยวข้อง (มีอยู่ในโค้ดแล้ว)
| DB | ID |
|---|---|
| Projects (database) | `2e69dccd181d81fabee1e65a00e86e72` |
| Projects (data source, ใช้ตอนสร้างจาก template) | `2e69dccd-181d-81d0-83af-000b1fd9260b` |
| Tasks | `2e69dccd181d81df8919fbacf921c7d5` |
| Brands | `2eb9dccd181d808fb888cdf883503df6` |
| GEM Team Member | `092e35e997424e4a9b20d7df03c31dc6` |
| Contacts | `2e69dccd181d810bb092e486e4d9c7db` |
| Scope Baseline | `0e9b74ddce4747078198a3a9d9228459` |
| Service Type | `2e89dccd181d8024a6edf9ead857546c` |

### 4.6 สิ่งที่ไม่ทำในรอบนี้ (Out of scope)
- ดึงข้อมูลจาก Fireflies หรือ LINE OA อัตโนมัติ
- สร้างหน้า Meeting Summary หรือ Decision log ใน Notion (ทำต่อได้ง่ายในรอบหน้า เพราะข้อความรวมจากขั้น [2] พร้อมแล้ว)
- แยกเสียงว่าใครพูดประโยคไหนแบบแม่นยำ
- มอบงานให้ช่าง Graphic

---

## 5. สิ่งที่ต้องตัดสินใจก่อนเริ่ม ⚠️

| # | คำถาม | คำแนะนำ | เหตุผล |
|---|---|---|---|
| Q0 | Web App ที่ Hub ลิงก์อยู่ (`AKfycbzPkq...`) เป็น project เดียวกับ scriptId `1cq5Z5_tg9Xc0cq...` ใน repo ใช่ไหม และโค้ดใน Apps Script ใหม่กว่าใน repo หรือเปล่า | **เช็กก่อนแก้อะไรทั้งหมด** ใน Apps Script ดูที่ Deploy → Manage deployments และ Project Settings | ถ้าโค้ดใน Apps Script ใหม่กว่า ต้อง `clasp pull` ลงมาก่อน ไม่อย่างนั้นจะทับงานล่าสุด |
| Q1 | Meeting Agent จะอยู่ที่ไหน | **A. ย้ายเข้า project ของ Capacity Board** เป็นหน้าใหม่ `?action=meeting` ผ่าน `Router.js` และแยกไฟล์ของตัวเอง (เช่น `MeetingAgent.js`, `MeetingAgent.html`) | ใช้โค้ดสร้าง Project/Task ชุดเดียวกันได้โดยไม่ต้อง copy ทางเลือกอื่นคือแยก project แล้วทำ Apps Script Library กลาง แต่ดูแลเวอร์ชันยากกว่า |
| Q2 | ไฟล์ที่อัปโหลดจะเก็บหรือลบ | **เก็บในโฟลเดอร์ Drive แยกตามการประชุม** | ย้อนตรวจได้ และใช้ผูกกับหน้า Meeting Summary ในรอบหน้า (ถ้ากังวลข้อมูลลูกค้า ให้เลือกลบหลังประมวลผล) |
| Q3 | ใคร deploy และทดสอบ | โอม | ต้องใช้บัญชี Google ที่มีสิทธิ์ใน Apps Script, Notion และ Drive |

---

## 6. ข้อควรระวังทางเทคนิค

1. **กฎของ `Router.js` (ห้ามละเมิด):** ในไฟล์มีบันทึกเตือนว่าเคยพังแบบไม่มี error เพราะเหตุนี้
   - ห้ามเพิ่ม `doGet` หรือ `doPost` ที่ไฟล์อื่น
   - ห้าม copy ไฟล์ `Code.js` ทั้งไฟล์จาก backup มาทับ
   - หน้าใหม่ต้องเพิ่มใน `doGet()` ของ `Router.js` เท่านั้น
2. **Timezone:** `GEM_Capacity_Board/appsscript.json` ตั้งเป็น `America/New_York` ส่วน Meeting Agent ตั้งเป็น `Asia/Bangkok` ถ้าย้าย project ต้องใช้ `Utilities.formatDate(date, 'Asia/Bangkok', ...)` ทุกจุดที่ใช้วันที่ ห้ามเปลี่ยน timezone ของทั้ง project เพราะอาจกระทบ Capacity Board
3. **ขนาดไฟล์:** `UrlFetchApp` ส่ง payload ได้ประมาณ 50MB เสียงจากมือถือ 90 นาทีมักอยู่ราว 40–45MB ใกล้ขีดจำกัดมาก **ต้องทดสอบกับไฟล์จริงเป็นอย่างแรก**
4. **อัปโหลดจากเบราว์เซอร์:** การส่งไฟล์ใหญ่ผ่าน `google.script.run` ไม่เสถียร ให้ใช้ Google Picker เลือกไฟล์ที่อยู่ใน Drive แล้ว หรืออัปโหลดเข้า Drive ก่อน แล้วค่อยส่งแค่ fileId ให้ server
5. **เวลาจำกัด:** Apps Script รันได้นานสุด 6 นาทีต่อครั้ง ต้องแปลง 1 ไฟล์ต่อ 1 call และถ้าเสียง 90 นาทีแปลงไม่ทันเวลา ต้องตัดเป็นช่วง
6. **Gemini API key:** ถ้าย้ายเข้า Capacity Board ต้องเช็กว่าใน Script Properties มี `GEMINI_API_KEY` แล้ว (Capacity Board ใช้ Gemini กับฟีเจอร์นำเข้ารูปปฏิทินอยู่ จึงน่าจะมี)
7. **Model:** Capacity Board ใช้ `gemini-3.1-flash-lite` (มี fallback) ส่วน Meeting Agent ใช้ `gemini-2.5-flash` การถอดเสียงภาษาไทยควรทดสอบเทียบกันก่อนเลือก

---

## 7. ลำดับงานที่แนะนำ

1. [ ] **ปิด Q0–Q3** (หัวข้อ 5)
2. [ ] **Spike ทดสอบไฟล์เสียงจริง 60–90 นาที** ผ่าน Gemini File API จาก Apps Script วัดเวลา ขนาดไฟล์ และความแม่นภาษาไทย ถ้าไม่ผ่าน ต้องกลับมาคุยเรื่องวิธีประมวลผลใหม่
3. [ ] แก้ปัญหา #1–#3 ในหัวข้อ 2 (pagination, กรอง Project, ตัดรายชื่อสำรองปลอมออก) ทำเสร็จได้เร็วและลดความเสี่ยงทันที
4. [ ] ย้ายเข้า Capacity Board project (ถ้า Q1 = A) แล้วเพิ่ม route `meeting`
5. [ ] สร้างขั้น [1] รวมไฟล์ และขั้น [2] แปลงเป็นข้อความ
6. [ ] ปรับ prompt ขั้น [3] (วันที่ประชุม, วันที่ข้อความ LINE, Brand)
7. [ ] ขั้น [4] และ [5]: เพิ่มช่อง Brand / Contacts / Scope Item / Service Type และใช้ `createNotionProject()` กับ `applyWorkTypeDefaults_()` ของ Capacity Board
8. [ ] อัปเดตลิงก์ใน Hub (`index.html` และ `NinaAgent_Hub/index.html`) และคู่มือ

## 8. ไฟล์ทดสอบที่ต้องเตรียม
- เสียงประชุมจริง 30–60 นาที (1 ไฟล์) และ 90 นาที (1 ไฟล์)
- รูปโน้ตลายมือจาก iPad
- แชท LINE ที่ export เป็น .txt (คุยกันหลายวัน)
- บรีฟ PDF และ Word
- **เคสรวม:** ประชุมเดียวที่มีเสียง + โน้ต + บรีฟ

## 9. เกณฑ์ว่าเสร็จ
- PM ใส่ไฟล์ของประชุม 1 ครั้งได้ภายใน 1–2 นาที ไม่ต้องพิมพ์ใหม่
- PM เห็นและแก้ข้อความที่ AI แปลงได้ก่อนวิเคราะห์
- deadline นับจากวันประชุมหรือวันที่ส่งข้อความ LINE
- Project และ Task ที่สร้างจาก Meeting Agent มีข้อมูลครบเท่ากับที่สร้างจาก Capacity Board
- ไม่มี Project ซ้ำจากการจับคู่ไม่เจอ
- Capacity Board ทำงานได้เหมือนเดิม และหน้า PM Task Status Board ยังเปิดได้
