const text = '[21/07/2026 15:28:04] เปลี่ยนสถานะเป็น "Sent to P''Aof" (แก้ไขในชีต)';
const match = text.match(/\[(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})\]/);
console.log('Match:', match ? 'YES' : 'NO');
if (match) {
    const d = new Date(${match[3]}--T::+07:00);
    console.log('Date:', d.toISOString());
}
