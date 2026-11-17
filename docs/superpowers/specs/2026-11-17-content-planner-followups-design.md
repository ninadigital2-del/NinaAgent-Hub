# Content Planner — Follow-up tracking (หน้า Calendar)

**สถานะ:** ออกแบบเสร็จ รอ implement
**ผู้คุยออกแบบ:** @tochaib4 (COO) + Claude
**ผู้ implement ต่อ:** โอม

## 1. ปัญหา / เป้าหมาย

ตอนนี้ Content Planner ไม่มีที่ทางสำหรับบันทึก "งานที่ยังค้างอยู่ ต้องมีคนตามต่อ" — ไม่ว่าจะเป็นเรื่องที่ทีมเราต้องทำ (เช่น ส่งรูปเพิ่ม) หรือเรื่องที่รอฝั่งลูกค้าทำ (เช่น รอ confirm ยอดขาย) ตอนนี้เรื่องแบบนี้คุยกันผ่านแชทนอกระบบ ไม่มีใครเห็นภาพรวมร่วมกัน

เป้าหมาย: เพิ่มส่วน **"งานค้าง" (Follow-up)** เข้าไปในหน้า **Calendar** ของ Content Planner ให้ทั้งทีมเราและลูกค้า (ผ่าน client link) เห็นรายการเดียวกัน ติ๊กปิดได้ทั้งคู่

## 2. ขอบเขต (Scope)

**อยู่ในสโคปนี้:**
- รายการ follow-up ผูกกับคอนเทนต์ item ที่มีอยู่ หรือไม่ผูกก็ได้ (standalone)
- ทีม (PM) สร้างรายการเท่านั้น
- ทั้งทีมและลูกค้าติ๊กปิด (mark done) ได้
- แต่ละรายการมี: ข้อความ, ฝั่งที่ต้องรับผิดชอบ (เรา/ลูกค้า), วันครบกำหนด (ไม่บังคับ)
- แสดงผลในหน้า Calendar: จอกว้าง (คอม) = แบ่งครึ่งจอคู่กับปฏิทิน, จอแคบ (มือถือ) = ย่อเป็นแถบ/ปุ่มขยายได้
- brand-scoped เหมือนทุกอย่างในระบบนี้ — client link เห็นเฉพาะของแบรนด์ตัวเอง

**ไม่อยู่ในสโคปนี้ (ตัดออกตอนคุยออกแบบแล้ว อย่าใส่เพิ่มเอง):**
- ลูกค้าสร้างรายการเอง — ตัดออกแล้ว เพราะ scope/ความเสี่ยงเกินกว่าที่ต้องการจริง ถ้าอยากได้ทีหลังค่อยทำแยก
- Priority field — ตัดออกแล้ว เพราะ Due Date ทำหน้าที่บอกความเร่งด่วนเพียงพอแล้ว การมี 2 แกน (priority + due date) จะยิ่งซับซ้อนโดยไม่จำเป็น
- ระบบ login/ยืนยันตัวตนรายบุคคล — ระบบทั้งระบบไม่มีสิ่งนี้อยู่แล้ว (ดูหัวข้อ 6) ไม่ใช่ของที่ต้องทำในงานนี้

## 3. โครงสร้างข้อมูล

เพิ่มแท็บใหม่ชื่อ **`FollowUps`** ในชีต Google Sheet เดียวกับที่ Content Planner ใช้อยู่แล้ว (ชีตเดียวกับ `Content`/`Owners`/`Brands`/`OwnerEmails`) — ไม่ใช่ database ใหม่ ไม่ใช่ Notion database ใหม่

คอลัมน์ (เรียงตามลำดับ — **ห้ามสลับลำดับ** เพราะโค้ดอ้างด้วย index เหมือน `COLUMNS` ของ Content):

| คอลัมน์ | ประเภท | หมายเหตุ |
|---|---|---|
| `ID` | string (uuid) | `Utilities.getUuid()` เหมือน Content |
| `Brand` | string | **บังคับ**. ถ้าผูกกับคอนเทนต์ (`ContentId` ไม่ว่าง) ให้ดึงจาก `Brand` ของคอนเทนต์นั้นอัตโนมัติเสมอ — ไม่รับค่าที่ client/frontend ส่งมาตรงๆ ถ้ามี ContentId (ป้องกัน mismatch) |
| `ContentId` | string, ว่างได้ | อ้างถึง `Content.ID`. ว่าง = รายการแบบ standalone |
| `Text` | string | ข้อความรายละเอียด |
| `ResponsibleSide` | `'Us'` \| `'Client'` | ตั้งตอนสร้าง, แก้ไขได้ภายหลังโดย PM |
| `DueDate` | ISO date string, ว่างได้ | ไม่บังคับใส่ |
| `CreatedAt` | ISO datetime | |
| `CreatedBy` | `'Team'` \| `'Client'` | มาจาก `clientMode` flag ตอนสร้าง (ดูหัวข้อ 6) — ในทางปฏิบัติจะเป็น `'Team'` เสมอ เพราะ client สร้างไม่ได้ แต่เก็บ column ไว้เผื่ออนาคต |
| `DoneAt` | ISO datetime, ว่างถ้ายังไม่เสร็จ | **นี่คือ flag ว่าเสร็จหรือยัง** — ว่าง = ยังไม่เสร็จ, มีค่า = เสร็จแล้ว ตาม pattern เดียวกับ `ApprovedAt`/`PostedAt`/`Sent_*` ของ `Content` sheet เป๊ะ (ไม่มีคอลัมน์ `Done` แยกเป็น boolean ต่างหาก ซ้ำซ้อนโดยไม่จำเป็น) — `rowToFollowUp()` ค่อยคำนวณ `Done: !!row[idx of DoneAt]` เป็น boolean ให้ frontend ใช้สะดวกตอนส่ง JSON กลับ ไม่ได้เก็บ boolean นี้ลงชีตจริง |
| `DoneBy` | `'Team'` \| `'Client'`, ว่างถ้ายังไม่เสร็จ | มาจาก `clientMode` ตอนติ๊กปิด |

### setupSheets() ต้องแก้

เพิ่ม block นี้ต่อจาก `ownerEmails` ใน `setupSheets()` (ตาม pattern เดิมเป๊ะ — ดู `Content_Planner_GAS/Code.gs` บรรทัดราวๆ 90-107):

```js
const SHEET_FOLLOWUPS = 'FollowUps';
const FOLLOWUP_COLUMNS = [
  'ID', 'Brand', 'ContentId', 'Text', 'ResponsibleSide', 'DueDate',
  'CreatedAt', 'CreatedBy', 'DoneAt', 'DoneBy',
];

// ...inside setupSheets(ss):
let followUps = ss.getSheetByName(SHEET_FOLLOWUPS);
if (!followUps) followUps = ss.insertSheet(SHEET_FOLLOWUPS);
if (followUps.getLastRow() === 0) {
  followUps.appendRow(FOLLOWUP_COLUMNS);
  followUps.setFrozenRows(1);
  followUps.getRange(1, 1, 1, FOLLOWUP_COLUMNS.length).setFontWeight('bold').setBackground('#f3f4f6');
}
```

(ถ้าจะเพิ่มคอลัมน์ทีหลัง ให้ทำ migration path แบบเดียวกับที่ `Content` ทำ — append ต่อท้ายเสมอ ห้ามแทรกกลาง)

## 4. Backend actions ใหม่ (Code.gs)

ทั้งหมดตาม pattern เดียวกับ `createContent`/`updateContent`/`clientUpdateStatus_` ที่มีอยู่แล้ว

### 4.1 `listFollowUps(brand)` — อ่านรายการ

```js
function listFollowUps(filterBrand) {
  const sheet = getSpreadsheet().getSheetByName(SHEET_FOLLOWUPS);
  const rows = sheet.getDataRange().getValues();
  rows.shift(); // header
  return rows
    .map(rowToFollowUp) // แปลงเป็น object ตาม FOLLOWUP_COLUMNS, เพิ่ม Done: !!DoneAt เป็น boolean
    .filter(f => !filterBrand || f.Brand === filterBrand);
}
```

เรียกใช้ใน `doGet`:
- **Admin** (`action=list` ปกติ ไม่มี `brand`+`t`): เพิ่ม `if (action === 'followups') return jsonResponse({ success: true, followUps: listFollowUps(null) });`
- **Client** (อยู่ในบล็อกที่ผ่าน `verifyClientLink_` แล้ว): เพิ่ม `if (action === 'followups') return jsonResponse({ success: true, followUps: listFollowUps(clientBrand) });`

### 4.2 `createFollowUp(data)` — สร้างรายการ (admin เท่านั้น)

```js
function createFollowUp(data) {
  const sheet = getSpreadsheet().getSheetByName(SHEET_FOLLOWUPS);
  const id = Utilities.getUuid();
  const now = new Date().toISOString();

  let brand = data.Brand;
  if (data.ContentId) {
    const contentItem = findContentById_(data.ContentId); // helper ใหม่ หรือใช้ findRowIndexById + rowToItem ที่มีอยู่
    if (!contentItem) throw new Error('Linked content not found: ' + data.ContentId);
    brand = contentItem.Brand; // เชื่อคอนเทนต์เสมอ ไม่เชื่อค่าที่ frontend ส่งมา
  }
  if (!brand) throw new Error('Brand is required');

  sheet.appendRow([
    id, brand, data.ContentId || '', data.Text || '', data.ResponsibleSide || 'Us',
    data.DueDate || '', now, 'Team', '', '',
  ]);
  return rowToFollowUp(sheet.getRange(sheet.getLastRow(), 1, 1, FOLLOWUP_COLUMNS.length).getValues()[0]);
}
```

หมายเหตุ: `createFollowUp` ไม่มี client-facing เวอร์ชัน — เรียกได้จาก `doPost`'s admin branch เท่านั้น (ไม่อยู่ใน client-link branch เลย ตาม pattern ที่ `create`/`update`/`bulkCreate`/`delete` ไม่อยู่ในนั้นเหมือนกัน)

### 4.3 `toggleFollowUp(id, done)` / `clientToggleFollowUp_(brand, id, done)` — ติ๊กปิด/เปิด (admin + client)

```js
function toggleFollowUp(id, done, isClient) {
  const sheet = getSpreadsheet().getSheetByName(SHEET_FOLLOWUPS);
  const rowIdx = findRowIndexById_(sheet, id, FOLLOWUP_COLUMNS); // รองรับ sheet/COLUMNS เป็น param หรือ copy ฟังก์ชันเดิม
  if (rowIdx === -1) throw new Error('FollowUp not found: ' + id);
  const range = sheet.getRange(rowIdx, 1, 1, FOLLOWUP_COLUMNS.length);
  const row = range.getValues()[0];
  row[FOLLOWUP_COLUMNS.indexOf('DoneAt')] = done ? new Date().toISOString() : '';
  row[FOLLOWUP_COLUMNS.indexOf('DoneBy')] = done ? (isClient ? 'Client' : 'Team') : '';
  range.setValues([row]);
  return rowToFollowUp(row);
}

function clientToggleFollowUp_(brand, id, done) {
  const f = listFollowUps(null).find(x => x.ID === id);
  if (!f) throw new Error('FollowUp not found: ' + id);
  if (f.Brand !== brand) throw new Error('BRAND_MISMATCH'); // เหมือน clientUpdateStatus_ เป๊ะ
  return toggleFollowUp(id, done, true);
}
```

**สำคัญ**: `clientToggleFollowUp_` ต้องเช็ค `Brand` ของแถวจริงในชีต เทียบกับ `brand` ที่ signed ไว้ในลิงก์ — **ห้ามเชื่อ `brand` ที่ client ส่งมาตรงๆ** เหมือนกับที่ `clientUpdateStatus_`/`clientAddComment_` ทำ (อ่าน comment ในโค้ดเดิมประกอบ บรรทัด 488-497 ของ `Code.gs`)

### 4.4 `updateFollowUp(id, data)` / `deleteFollowUp(id)` — แก้ไข/ลบ (admin เท่านั้น)

ทำตาม pattern `updateContent`/`deleteContent` ปกติ ไม่มีอะไรพิเศษ ไม่ต้อง sync ไป Notion หรือ calendar (follow-up ไม่มี calendar event ของตัวเอง)

### 4.5 ต่อเข้า `doGet`/`doPost`

```js
// --- doGet, admin branch ---
if (action === 'followups') return jsonResponse({ success: true, followUps: listFollowUps(null) });

// --- doGet, client branch (ในบล็อกที่ verifyClientLink_ ผ่านแล้ว) ---
if (action === 'followups') return jsonResponse({ success: true, followUps: listFollowUps(clientBrand) });

// --- doPost, admin branch ---
if (action === 'createFollowUp') return jsonResponse({ success: true, followUp: createFollowUp(body.data) });
if (action === 'updateFollowUp') return jsonResponse({ success: true, followUp: updateFollowUp(body.id, body.data) });
if (action === 'toggleFollowUp') return jsonResponse({ success: true, followUp: toggleFollowUp(body.id, !!body.done, false) });
if (action === 'deleteFollowUp') { deleteFollowUp(body.id); return jsonResponse({ success: true }); }

// --- doPost, client branch (ในบล็อกที่ verifyClientLink_ ผ่านแล้ว) ---
if (action === 'toggleFollowUp') return jsonResponse({ success: true, followUp: clientToggleFollowUp_(clientBrand, body.id, !!body.done) });
// createFollowUp/updateFollowUp/deleteFollowUp **ไม่อยู่ในบล็อกนี้เลย** -- ถ้า client ยิง action พวกนี้มา จะตกไปโดน
// `return jsonResponse({ success: false, error: 'Action not allowed for client link: ' + action });` ที่ท้ายบล็อก client เหมือนเดิม
```

## 5. UI (content-planner.html)

### 5.1 ตำแหน่ง: อยู่ในแท็บ Calendar เท่านั้น (ไม่ใช่แท็บแยก)

ตามที่ตกลงกัน — ไม่ทำเป็นแท็บใหม่ข้างๆ "หน้ารวมงานวันนี้ | Calendar | รายการทั้งหมด | รายงาน" เพราะจะต้องสลับแท็บไปมา ขัดกับเป้าหมายเรื่อง visibility

### 5.2 Layout

**Desktop (จอกว้าง ≥ ~1024px):** แบ่งครึ่งจอแบบ flex row, ปฏิทิน (flex-grow) ด้านซ้าย + panel follow-up (fixed width ~300-320px) ด้านขวา panel มี:
- หัวข้อ "📌 งานค้าง" + badge ตัวเลข (นับเฉพาะที่ยังไม่เสร็จ) + ปุ่ม "+ เพิ่ม" (admin เท่านั้น, ซ่อนถ้า `clientMode`)
- รายการ: checkbox + ข้อความ + pill สีบอกฝั่งรับผิดชอบ (เรา = ม่วง `#eef2ff`/`#4338ca`, ลูกค้า = ส้ม `#fff7ed`/`#c2410c`) + วันครบกำหนด + (ถ้าผูกกับคอนเทนต์) ลิงก์ 🔗 ชื่อคอนเทนต์นั้น คลิกแล้วเปิด `viewDetail(contentId)`
- เรียงลำดับ: ยังไม่เสร็จก่อน (เรียงตาม DueDate ใกล้สุดก่อน, ไม่มี DueDate ไปท้ายสุด), ที่เสร็จแล้วพับไว้ใต้หัวข้อย่อย "เสร็จแล้ว (N)" กดขยาย/ย่อได้ (local UI state, ไม่ต้องเก็บใน backend)

**Mobile (จอแคบ):** ปฏิทินเต็มจอด้านบน, follow-up ย่อเป็นแถบ `position: sticky; bottom: 0` มี badge ตัวเลข + ปุ่ม chevron กดขยาย/ย่อ (เหมือน bottom sheet) ขยายแล้วแสดงรายการแบบ scroll ได้ (max-height + overflow-y: auto)

ดู mockup ที่ทำไว้แล้ว: https://claude.ai/artifact/QFd4pbiBtsCTG2Uga2Hco5 (artboard "Main" = desktop, "Mobile" = มือถือ)

### 5.3 สิทธิ์การใช้งานในหน้า UI

| การกระทำ | Admin (PM) | Client (ผ่าน client link) |
|---|---|---|
| ดูรายการ (เฉพาะแบรนด์ตัวเอง) | ✅ | ✅ |
| สร้างรายการใหม่ | ✅ | ❌ (ไม่มีปุ่ม "+ เพิ่ม" โชว์เลย) |
| ติ๊กปิด/เปิด | ✅ | ✅ |
| แก้ไขข้อความ/วันครบกำหนด/ฝั่งรับผิดชอบ | ✅ | ❌ |
| ลบรายการ | ✅ | ❌ |

ฝั่ง frontend ให้ใช้ตัวแปร `clientMode` ที่มีอยู่แล้วในการซ่อน/โชว์ปุ่มต่างๆ เหมือนที่ทำกับปุ่มลบ/แก้ไขคอนเทนต์ตอนนี้ (ดู `${clientMode ? '' : '<button ...ลบ...>'}` ใน `viewDetail()`)

**ย้ำอีกครั้ง: การซ่อนปุ่มใน UI ไม่ใช่การป้องกันจริง** — backend เองต้องปฏิเสธ `createFollowUp`/`updateFollowUp`/`deleteFollowUp` สำหรับ client link ไม่ว่า UI จะซ่อนปุ่มไว้หรือไม่ (ดูหัวข้อ 4.5 — ฟังก์ชันพวกนี้ไม่อยู่ใน client branch เลย จึงตกไปโดนปฏิเสธอัตโนมัติ)

## 6. การระบุตัวตน (CreatedBy / DoneBy)

ระบบ Content Planner **ไม่มีระบบ login จริงที่ไหนเลย** ไม่ว่าฝั่ง admin หรือ client (คอมเมนต์ที่มีอยู่ตอนนี้ก็ hardcode เป็น `'คุณ (จำลอง)'`/`'ลูกค้า (จำลอง)'` เหมือนกัน) — follow-up จะไม่พยายามแก้ปัญหานี้ให้ดีกว่าของเดิม ใช้กลไกเดียวกัน:

```js
const createdBy = clientMode ? 'Client' : 'Team';
```

ตรวจจาก `clientMode` (frontend) / การที่ request ผ่าน client-link branch หรือไม่ (backend) — ไม่มีช่องกรอกชื่อ ไม่มี dropdown เลือกคนเพิ่มเติม ตามที่ตกลงกันไว้ (สมมติฐาน: ทีมเราไม่มีเหตุผลต้องเข้าผ่าน client link เอง จึงเชื่อ mode การเข้าถึงแทนตัวตนจริงได้)

## 7. Security checklist (ต้องเทสครบก่อนปล่อยจริง)

เอาจาก pattern การเทสของ `client-link-security.test.js` ที่มีอยู่แล้ว ควรเขียนเทสคู่กันแบบเดียวกัน:

1. client link ของแบรนด์ A เห็นเฉพาะ follow-up ของแบรนด์ A เท่านั้น ไม่เห็นของแบรนด์ B
2. client link ของแบรนด์ A toggle follow-up ของแบรนด์ B ไม่ได้ (ต้อง throw `BRAND_MISMATCH`) แม้จะรู้ ID ตรงๆ
3. client link ยิง action `createFollowUp`/`updateFollowUp`/`deleteFollowUp` มาตรงๆ (ข้าม UI, เรียก API ตรง) ต้องโดนปฏิเสธด้วย `'Action not allowed for client link: ...'`
4. follow-up ที่สร้างแบบผูกกับคอนเทนต์ ต้องได้ `Brand` จากคอนเทนต์นั้นเสมอ แม้ว่า request จะพยายามส่ง `Brand` อื่นมาด้วย
5. ลิงก์คอนเทนต์ (ContentId) ที่ถูกลบไปแล้ว — `listFollowUps` ต้อง handle ได้ไม่ error (แค่ frontend ไม่โชว์ลิงก์ 🔗 อีกต่อไป)

## 8. Frontend: ฟังก์ชันที่ต้องเพิ่ม (content-planner.html)

ชื่อฟังก์ชันที่แนะนำ (ให้ตรง pattern เดิมของไฟล์นี้):

- `let followUps = [];` (global state เหมือน `items`)
- `loadFollowUps()` — เรียก `apiGet('followups')`, ใส่ผล into `followUps`, เรียกตอน `initApp()` คู่กับ `loadFromApi()`
- `renderFollowUpPanel()` — build HTML ของ panel, เรียกทุกครั้งที่ `followUps` เปลี่ยน (หลัง load/create/toggle)
- `openCreateFollowUp()` / `closeCreateFollowUp()` — modal เล็กๆ สำหรับฟอร์มสร้าง (ข้อความ, ฝั่งรับผิดชอบ, วันครบกำหนด, เลือกผูกกับคอนเทนต์หรือไม่ — ถ้าผูก ให้มี dropdown เลือกจาก `items` ปัจจุบัน)
- `toggleFollowUpDone(id, checked)` — เรียก `apiCall('toggleFollowUp', { id, done: checked })` แล้ว re-render
- `followUpBadgeCount()` — นับ `followUps.filter(f => !f.Done && f.Brand === (clientMode ? clientBrand : ...)).length` (ถ้า admin ดูทุกแบรนด์พร้อมกัน ให้กรองตาม `sharedBrand` filter ที่มีอยู่แล้วของหน้า Calendar ด้วย ให้ behavior สอดคล้องกับ filter bar เดิม)

mock data (ตอนไม่มี `API_URL`) ให้เพิ่ม array ตัวอย่าง 2-3 รายการในบล็อก mock เดิม (ดูที่ `mk(...)` ของ `items` เป็นตัวอย่าง)

## 9. สิ่งที่ยังไม่ได้ทำในงานนี้ (บอกไว้กันสับสนทีหลัง)

- Sync follow-up ไป Notion — ไม่อยู่ในสโคป (follow-up เป็น concept ของ Content Planner เท่านั้น ไม่มีของเทียบใน Notion)
- Reminder/แจ้งเตือนอัตโนมัติเมื่อใกล้ครบกำหนด (LINE) — ไม่อยู่ในสโคปนี้ ถ้าต้องการ ควรทำเป็นงานแยกต่อยอดจากระบบ `sendDailyReminders` ที่มีอยู่แล้ว
- "ล็อกลิงก์หลักของ PM" — เรื่องเก่าจากฟีเจอร์ client-link-security ก่อนหน้า ไม่เกี่ยวกับงานนี้

## 10. Mockup อ้างอิง

https://claude.ai/artifact/QFd4pbiBtsCTG2Uga2Hco5 — ดูหน้าตา desktop/mobile ประกอบก่อนเริ่ม implement UI
