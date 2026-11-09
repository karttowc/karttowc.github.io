// KARTtoWC play log v2 — Google Apps Script for the log sheet.
// 1) Sheet → Extensions → Apps Script, paste this, put the secret in KEY (never commit it).
// 2) Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone → copy the /exec URL.
// One tab per month (Asia/Seoul), e.g. "2026-11". Columns: recv(ms) uid cid kind json.
// A batch from the game is written as ONE row (kind 'batch', json = array of records), split only to stay under the 50k-character cell limit.
// Older rows hold one record each; tools/logs.py reads both.
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
  const now = Date.now(), rows = [];
  let cur = [], len = 2;
  const push = () => { if (!cur.length) return; const d = cur[0];
    rows.push([now, String(d.uid || '').slice(0, 40), cur.length > 1 ? '' : String(d.cid || '').slice(0, 40),
      cur.length > 1 ? 'batch' : String(d.kind || '').slice(0, 20), JSON.stringify(cur.length > 1 ? cur : d).slice(0, 49000)]);
    cur = []; len = 2; };
  a.forEach(d => { const n = JSON.stringify(d).length + 1; if (cur.length && len + n > 45000) push(); cur.push(d); len += n; });
  push();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return out({ ok: 0 });  // busy: the game keeps the batch and retries
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
    // anti-cheat: a line when a career gets flagged, and feedback sent from a flagged career, in a "부정 플레이" tab
    // (stats all 99 = real cheat; ordinary stats = maybe wrongly caught → put its cid in X_OK in the game)
    const ST = ['quali', 'race', 'tyre', 'wet', 'consistency', 'mental'];
    const xs = a.filter(d => d.kind === 'flag' || (d.kind === 'fb' && d.x && d.text)).map(d => d.kind === 'flag' ? [
      Utilities.formatDate(new Date(now), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), '감지', String(d.why || ''), d.age || '', String(d.lk || ''), d.ovr || '',
      ST.map(k => (d.stats || {})[k] ?? '-').join('·'), (d.pot0 ?? '?') + '→' + (d.pot ?? '?'), d.titles || 0, (d.wins || 0) + '/' + (d.starts || 0),
      String(d.v || ''), String(d.cid || '')] : [
      Utilities.formatDate(new Date(now), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), '의견', String(d.text).slice(0, 300), '', String(d.lk || d.phase || ''), '',
      '', '', '', '', String(d.v || ''), String(d.cid || '')]);
    if (xs.length) {
      const ss = SpreadsheetApp.getActive();
      let x = ss.getSheetByName('부정 플레이');
      if (!x) { x = ss.insertSheet('부정 플레이', 0); x.appendRow(['시간', '종류', '이유·내용', '나이', '무대', 'OVR', '능력치(퀄·레·타·빗·일·멘)', '잠재력(처음→지금)', '월챔', '우승/출전', '버전', 'cid']);
        x.setFrozenRows(1); x.setColumnWidth(3, 260); x.setColumnWidth(7, 200); x.getRange('L:L').setNumberFormat('@'); }
      x.getRange(x.getLastRow() + 1, 1, xs.length, 12).setValues(xs);
    }
  } finally { lock.releaseLock(); }
  return out({ ok: a.length });
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
