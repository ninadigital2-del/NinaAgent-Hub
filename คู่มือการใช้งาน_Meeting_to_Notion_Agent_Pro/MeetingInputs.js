// ==========================================
// MeetingInputs.js -- turn one source file into text (step [2] of the flow)
// ==========================================
// One call = one file, so a single Apps Script run never nears the 6 minute
// limit. The browser passes a Drive file link/ID (the PM puts the file in Drive
// first -- big uploads through google.script.run are unreliable). Pasted text
// never comes here; the page just appends it.
//
// Honest limits (handoff section 6): UrlFetchApp payloads top out near 50 MB, and
// a 90 minute phone recording is ~40-45 MB. Anything over MEETING_MAX_FILE_BYTES
// is refused with a message instead of failing half way.

const MEETING_TZ = 'Asia/Bangkok';
const MEETING_MAX_FILE_BYTES = 48 * 1024 * 1024;
// Gemini rejects inline requests over ~20 MB total; base64 adds a third, so
// anything bigger than this goes through the File API instead.
const MEETING_INLINE_MAX_BYTES = 10 * 1024 * 1024;
const MEETING_TRANSCRIBE_MODEL = 'gemini-2.5-flash';
const MEETING_GEMINI_RETRIES = 3;
const MEETING_MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function meetingGeminiKey_() {
  const k = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!k || !k.trim()) throw new Error('ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Script Properties');
  return k.trim();
}

/** Accepts a bare Drive ID or any drive.google.com / docs.google.com link. */
function meetingExtractDriveId_(ref) {
  const s = String(ref || '').trim();
  const m = s.match(/\/d\/([A-Za-z0-9_-]{20,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : '';
}

/** Returns 'audio' | 'image' | 'pdf' | 'docx' | 'gdoc' | 'text' | '' (unsupported). */
function meetingKindFromMime_(mime, name) {
  mime = String(mime || '').toLowerCase();
  name = String(name || '').toLowerCase();
  if (mime.indexOf('audio/') === 0 || /\.(m4a|mp3|wav|aac|ogg|flac)$/.test(name)) return 'audio';
  if (mime.indexOf('image/') === 0) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime === MEETING_MIME_DOCX) return 'docx';
  if (mime === 'application/vnd.google-apps.document') return 'gdoc';
  if (mime === 'text/plain' || /\.txt$/.test(name)) return 'text';
  return '';
}

const MEETING_KIND_LABEL = {
  audio: '🎙️ เสียงประชุม',
  image: '✍️ รูป / โน้ตลายมือ',
  pdf: '📄 เอกสาร PDF',
  docx: '📄 เอกสาร Word',
  gdoc: '📄 Google Doc',
  text: '💬 ข้อความ / แชท',
};

const MEETING_TRANSCRIBE_PROMPT = {
  audio: 'ถอดเสียงการประชุมภาษาไทยนี้เป็นข้อความให้ครบตามที่ได้ยินเท่านั้น ห้ามสรุป ห้ามเดา ' +
    'ส่วนที่ฟังไม่ชัดให้ใส่ [ฟังไม่ชัด] ถ้าแยกผู้พูดได้ให้ขึ้นบรรทัดใหม่ด้วย "ชื่อผู้พูด:" ' +
    'ถ้าไม่รู้ชื่อให้ใช้ ผู้พูด 1, ผู้พูด 2',
  image: 'อ่านข้อความทั้งหมดจากรูปนี้ (โน้ตลายมือหรือ screenshot) ตามลำดับที่เห็น ' +
    'ตัวอักษรหรือคำที่อ่านไม่ออกให้ใส่ [อ่านไม่ออก] ห้ามเดาคำที่ไม่ชัด ห้ามสรุป',
  pdf: 'ดึงข้อความทั้งหมดจากเอกสารนี้ตามลำดับ ตารางให้เขียนเป็นข้อความทีละแถว ห้ามสรุป ห้ามเพิ่มข้อมูลที่ไม่มีในเอกสาร',
};

// Files dropped on the page travel to the server as base64 through google.script.run, which is
// unreliable for big payloads (handoff section 6.4). Keep it small; bigger files go through Drive.
const MEETING_MAX_DROP_BYTES = 8 * 1024 * 1024;
const MEETING_DROP_FOLDER = '_dropped files';

/**
 * Saves one file dropped on the page into Drive ("Meeting Agent Uploads/_dropped files") and
 * returns its id, which the page then feeds to meetingConvertDriveFile like any Drive file.
 * Only the input types this agent can read are accepted, and only up to MEETING_MAX_DROP_BYTES.
 * @return {{ok:boolean, id?:string, name?:string, error?:string}}
 */
function meetingUploadFile(name, mime, base64) {
  try {
    name = String(name || '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
    if (!name) return { ok: false, error: 'ไฟล์ไม่มีชื่อ' };
    const kind = meetingKindFromMime_(mime, name);
    if (!kind || kind === 'gdoc') {
      return { ok: false, name: name, error: 'ชนิดไฟล์นี้ไม่รองรับ (รองรับ เสียง · รูป · PDF · Word · .txt)' };
    }
    if (!base64) return { ok: false, name: name, error: 'ไฟล์ว่างเปล่า' };
    const bytes = Utilities.base64Decode(String(base64));
    if (bytes.length > MEETING_MAX_DROP_BYTES) {
      return { ok: false, name: name, error: 'ไฟล์ใหญ่เกิน ' + Math.round(MEETING_MAX_DROP_BYTES / 1048576) + ' MB สำหรับการลากใส่ — อัปโหลดเข้า Drive แล้ววางลิงก์แทน' };
    }
    const roots = DriveApp.getFoldersByName(MEETING_UPLOAD_ROOT_FOLDER);
    const root = roots.hasNext() ? roots.next() : DriveApp.createFolder(MEETING_UPLOAD_ROOT_FOLDER);
    const subs = root.getFoldersByName(MEETING_DROP_FOLDER);
    const folder = subs.hasNext() ? subs.next() : root.createFolder(MEETING_DROP_FOLDER);
    const file = folder.createFile(Utilities.newBlob(bytes, String(mime || 'application/octet-stream'), name));
    return { ok: true, id: file.getId(), name: name };
  } catch (err) {
    return { ok: false, error: 'บันทึกไฟล์ลง Drive ไม่สำเร็จ: ' + String(err && err.message || err) };
  }
}

/**
 * Config for the Google Drive Picker on the page: the visitor's own OAuth token plus the
 * developer key from Script Properties (PICKER_API_KEY).
 * Refuses unless the web app runs AS the visitor (executeAs USER_ACCESSING). Under USER_DEPLOYING
 * the token belongs to the owner, and handing it to the page would expose the owner's whole Drive.
 * @return {{ok:boolean, token?:string, key?:string, origin?:string, error?:string}}
 */
function meetingPickerConfig() {
  try {
    const active = Session.getActiveUser().getEmail();
    const effective = Session.getEffectiveUser().getEmail();
    if (!active || active !== effective) {
      return { ok: false, error: 'เปิด Picker ไม่ได้: เว็บแอปยังไม่ได้ตั้งให้รันด้วยสิทธิ์ของผู้ใช้ที่ login (USER_ACCESSING)' };
    }
    const key = PropertiesService.getScriptProperties().getProperty('PICKER_API_KEY');
    if (!key || !key.trim()) return { ok: false, error: 'ยังไม่ได้ตั้งค่า PICKER_API_KEY ใน Script Properties' };
    return { ok: true, token: ScriptApp.getOAuthToken(), key: key.trim() };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

/**
 * Server entry the page calls once per source file.
 * @return {{ok:boolean, name?:string, kind?:string, label?:string, text?:string, error?:string}}
 */
function meetingConvertDriveFile(ref) {
  try {
    const id = meetingExtractDriveId_(ref);
    if (!id) return { ok: false, error: 'ลิงก์หรือ ID ไฟล์ Drive ไม่ถูกต้อง' };
    let file;
    try { file = DriveApp.getFileById(id); }
    catch (e) { return { ok: false, error: 'เปิดไฟล์ไม่ได้ (ไม่พบไฟล์ หรือบัญชีที่ deploy ไม่มีสิทธิ์เข้าถึง)' }; }

    const name = file.getName();
    const kind = meetingKindFromMime_(file.getMimeType(), name);
    if (!kind) return { ok: false, name: name, error: 'ไม่รองรับไฟล์ชนิดนี้: ' + file.getMimeType() };
    if (kind !== 'gdoc' && file.getSize() > MEETING_MAX_FILE_BYTES) {
      return { ok: false, name: name, error: 'ไฟล์ใหญ่เกิน 48 MB — กรุณาตัดหรือบีบอัดไฟล์ก่อน' };
    }

    let text;
    if (kind === 'text') text = file.getBlob().getDataAsString('UTF-8');
    else if (kind === 'gdoc') text = DocumentApp.openById(id).getBody().getText();
    else if (kind === 'docx') text = meetingDocxToText_(id, name);
    else text = meetingGeminiTranscribe_(file.getBlob(), kind, name);

    text = String(text || '').trim();
    if (!text) return { ok: false, name: name, error: 'ไม่พบข้อความในไฟล์นี้' };
    return { ok: true, name: name, kind: kind, label: MEETING_KIND_LABEL[kind], text: text };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

/** Gemini cannot read .docx directly: copy it to a Google Doc, read it, trash the copy. */
function meetingDocxToText_(id, name) {
  const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '/copy', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ mimeType: 'application/vnd.google-apps.document', name: 'tmp-meeting-' + name }),
    muteHttpExceptions: true,
  });
  const copy = JSON.parse(res.getContentText());
  if (!copy.id) throw new Error('แปลงไฟล์ Word ไม่สำเร็จ: ' + ((copy.error && copy.error.message) || res.getResponseCode()));
  try {
    return DocumentApp.openById(copy.id).getBody().getText();
  } finally {
    try { DriveApp.getFileById(copy.id).setTrashed(true); } catch (e) { /* best effort */ }
  }
}

function meetingGeminiTranscribe_(blob, kind, name) {
  const key = meetingGeminiKey_();
  const mime = blob.getContentType() || (kind === 'audio' ? 'audio/mp4' : 'application/octet-stream');
  const bytes = blob.getBytes();
  let part, uploaded = null;
  if (bytes.length <= MEETING_INLINE_MAX_BYTES) {
    part = { inline_data: { mime_type: mime, data: Utilities.base64Encode(bytes) } };
  } else {
    uploaded = meetingGeminiUpload_(bytes, mime, name, key);
    part = { file_data: { mime_type: mime, file_uri: uploaded.uri } };
  }
  try {
    return meetingGeminiGenerate_([{ text: MEETING_TRANSCRIBE_PROMPT[kind] }, part], { temperature: 0 }, key);
  } finally {
    if (uploaded) meetingGeminiDeleteFile_(uploaded.name, key);
  }
}

/** Gemini File API, resumable protocol: start a session, send all bytes, wait until ACTIVE. */
function meetingGeminiUpload_(bytes, mime, name, key) {
  const start = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-goog-api-key': key,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length),
      'X-Goog-Upload-Header-Content-Type': mime,
    },
    payload: JSON.stringify({ file: { display_name: String(name).slice(0, 100) } }),
    muteHttpExceptions: true,
  });
  const headers = start.getHeaders();
  const uploadUrl = headers['x-goog-upload-url'] || headers['X-Goog-Upload-URL'] || headers['X-Goog-Upload-Url'];
  if (!uploadUrl) throw new Error('เริ่มอัปโหลดไป Gemini ไม่สำเร็จ (HTTP ' + start.getResponseCode() + ')');

  const up = UrlFetchApp.fetch(uploadUrl, {
    method: 'post',
    contentType: mime,
    headers: { 'X-Goog-Upload-Command': 'upload, finalize', 'X-Goog-Upload-Offset': '0' },
    payload: bytes,
    muteHttpExceptions: true,
  });
  const info = JSON.parse(up.getContentText());
  if (!info.file || !info.file.uri) throw new Error('อัปโหลดไฟล์ไป Gemini ไม่สำเร็จ: ' + ((info.error && info.error.message) || up.getResponseCode()));

  let file = info.file;
  for (let i = 0; i < 30 && file.state === 'PROCESSING'; i++) {
    Utilities.sleep(2000);
    const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/' + file.name, {
      headers: { 'x-goog-api-key': key }, muteHttpExceptions: true,
    });
    file = JSON.parse(r.getContentText());
  }
  if (file.state && file.state !== 'ACTIVE') throw new Error('Gemini ประมวลผลไฟล์ไม่สำเร็จ (state=' + file.state + ')');
  return file;
}

function meetingGeminiDeleteFile_(fileName, key) {
  try {
    UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/' + fileName, {
      method: 'delete', headers: { 'x-goog-api-key': key }, muteHttpExceptions: true,
    });
  } catch (e) { /* the file expires on its own after 48h */ }
}

/**
 * One generateContent call with retry on transient errors. Returns the text of the
 * first candidate; throws on every other outcome (no silent empty result).
 */
function meetingGeminiGenerate_(parts, generationConfig, key, systemInstruction, model) {
  const transient = { 408: true, 429: true, 500: true, 502: true, 503: true, 504: true };
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + (model || MEETING_TRANSCRIBE_MODEL) + ':generateContent';
  const payload = { contents: [{ parts: parts }], generationConfig: generationConfig || {} };
  if (systemInstruction) payload.systemInstruction = { parts: [{ text: systemInstruction }] };

  let message = '';
  for (let attempt = 0; attempt <= MEETING_GEMINI_RETRIES; attempt++) {
    if (attempt > 0) Utilities.sleep(Math.pow(2, attempt - 1) * 1000 + Math.floor(Math.random() * 500));
    let res, data;
    try {
      res = UrlFetchApp.fetch(url, {
        method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key },
        payload: JSON.stringify(payload), muteHttpExceptions: true,
      });
      data = JSON.parse(res.getContentText());
    } catch (e) { message = String(e && e.message || e); continue; }
    const code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      const cand = data.candidates && data.candidates[0];
      const out = cand && cand.content && cand.content.parts && cand.content.parts.map(function(p) { return p.text || ''; }).join('');
      if (!out) throw new Error('Gemini ไม่ส่งข้อความกลับมา (finishReason=' + (cand && cand.finishReason) + ')');
      // Never hand back a half answer as if it were complete (a long transcript
      // cut off at the output limit would otherwise look like a finished one).
      const finish = cand.finishReason;
      if (finish === 'MAX_TOKENS') throw new Error('ข้อความที่ถอดถูกตัดเพราะยาวเกินขีดจำกัดของ Gemini — ตัดไฟล์เป็นช่วงสั้นลงแล้วลองใหม่');
      if (finish && finish !== 'STOP') throw new Error('Gemini หยุดก่อนเสร็จ (finishReason=' + finish + ')');
      return out;
    }
    message = (data && data.error && data.error.message) || ('HTTP ' + code);
    if (!transient[code]) throw new Error('Gemini: ' + message);
  }
  throw new Error('Gemini ไม่ตอบสนองหลังลองซ้ำ: ' + message);
}
