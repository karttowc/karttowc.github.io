// KARTtoWC play log v2 — Google Apps Script for the log sheet.
// 1) Sheet → Extensions → Apps Script, paste this, put the secret in KEY (never commit it).
// 2) Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone → copy the /exec URL.
// One tab per month (Asia/Seoul), e.g. "2026-11". Columns: recv(ms) uid cid kind json.
const KEY = '여기에_비밀키';
const HEAD = ['recv', 'uid', 'cid', 'kind', 'json'], PAGE = 5000, MAXB = 50;

const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const isTab = n => /^\d{4}-\d{2}$/.test(n);

function tab(name) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}

// POST body: one record or an array of records (game batches up to 30)
function doPost(e) {
  let a;
  try { a = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: 0 }); }
  if (!Array.isArray(a)) a = [a];
  a = a.filter(d => d && typeof d === 'object').slice(0, MAXB);
  if (!a.length) return out({ ok: 0 });
  const now = Date.now();
  const rows = a.map(d => [now, String(d.uid || '').slice(0, 40), String(d.cid || '').slice(0, 40),
    String(d.kind || '').slice(0, 20), JSON.stringify(d).slice(0, 40000)]);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = tab(Utilities.formatDate(new Date(now), 'Asia/Seoul', 'yyyy-MM'));
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEAD.length).setValues(rows);
    // feedback ("의견 보내기") also goes to a readable "의견" tab
    const fb = a.filter(d => d.kind === 'fb' && d.text).map(d => [
      Utilities.formatDate(new Date(now), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), String(d.text).slice(0, 300),
      String(d.lk || d.phase || ''), d.seasons || 0, String(d.v || ''), String(d.uid || '').slice(0, 6)]);
    if (fb.length) {
      const ss = SpreadsheetApp.getActive();
      let f = ss.getSheetByName('의견');
      if (!f) { f = ss.insertSheet('의견', 0); f.appendRow(['시간', '내용', '무대', '시즌 수', '버전', '기기']); f.setFrozenRows(1); f.setColumnWidth(2, 400); }
      f.getRange(f.getLastRow() + 1, 1, fb.length, 6).setValues(fb);
    }
  } finally { lock.releaseLock(); }
  return out({ ok: rows.length });
}

// GET ?key=KEY&tab=2026-11&row=120 → rows after row 120 of that tab, then later tabs, up to PAGE.
// Returns {rows, next:{tab,row}, more}; pass next back to keep reading (tools/logs.py does this).
function doGet(e) {
  const q = e.parameter || {};
  if (q.key !== KEY) return out({ error: 'key' });
  const ss = SpreadsheetApp.getActive();
  const tabs = ss.getSheets().map(s => s.getName()).filter(isTab).sort();
  const t = q.tab || '', row = +q.row || 1, rows = [];
  let next = { tab: t, row };
  for (const n of tabs) {
    if (n < t) continue;
    const sh = ss.getSheetByName(n), start = n === t ? row + 1 : 2, last = sh.getLastRow();
    if (last < start) { next = { tab: n, row: start - 1 }; continue; }
    const take = Math.min(last - start + 1, PAGE - rows.length);
    rows.push(...sh.getRange(start, 1, take, HEAD.length).getValues());
    next = { tab: n, row: start + take - 1 };
    if (rows.length >= PAGE) break;
  }
  return out({ rows, next, more: rows.length >= PAGE });
}
