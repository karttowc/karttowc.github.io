// KARTtoWC play log v2 — Google Apps Script for the log sheet.
// 1) Sheet → Extensions → Apps Script, paste this, put the secret in KEY (never commit it).
// 2) Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone → copy the /exec URL.
// One tab per month (Asia/Seoul), e.g. "2026-11". Columns: recv(ms) uid cid kind json.
// A batch from the game is written as ONE row (kind 'batch', json = array of records), split only to stay under the 50k-character cell limit.
// Older rows hold one record each; tools/logs.py reads both.
// '통계' tab (first tab, newest day on top): 날짜 · 플레이(그날 온 기기) · 처음 온 사람 · 누적 · 새 커리어 · 은퇴 · 0시~23시(그 시간에 온 기기).
// Counted when a batch arrives (Seoul time of arrival). The hidden '기기' tab keeps each device's first/last day so nobody counts twice.
// Past days were filled once by tools/logs.py --stats-init.
const KEY = '여기에_비밀키';
const HEAD = ['recv', 'uid', 'cid', 'kind', 'json'], PAGE = 5000, MAXB = 50;

const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const isTab = n => /^\d{4}-\d{2}$/.test(n);
const fmt = (ms, p) => Utilities.formatDate(new Date(ms), 'Asia/Seoul', p);
const SH = ['날짜', '플레이', '처음 온 사람', '누적', '새 커리어', '은퇴', ...Array.from({ length: 24 }, (_, i) => i + '시')];
const DH = ['기기', '처음', '마지막', '그날 시간'];

// hour columns shaded by how many came (re-applied when a day row is added, since inserting rows shifts ranges)
function heat(s) {
  const r = s.getRange(2, 7, Math.max(s.getMaxRows() - 1, 1), 24);
  s.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue('#ffffff', SpreadsheetApp.InterpolationType.NUMBER, '0')
    .setGradientMaxpoint('#f4a261').setRanges([r]).build()]);
}
function statTab() {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName('통계');
  if (!s) {
    s = ss.insertSheet('통계', 0);
    if (s.getMaxColumns() > SH.length) s.deleteColumns(SH.length + 1, s.getMaxColumns() - SH.length);
    s.getRange(1, 1, 1, SH.length).setValues([SH]).setFontWeight('bold');
    s.setFrozenRows(1); s.setFrozenColumns(1);
    s.getRange('A:A').setNumberFormat('@'); s.setColumnWidth(1, 90); s.setColumnWidths(7, 24, 36);
    heat(s);
  }
  return s;
}
function devTab() {
  const ss = SpreadsheetApp.getActive();
  let d = ss.getSheetByName('기기');
  if (!d) {
    d = ss.insertSheet('기기');
    if (d.getMaxColumns() > DH.length) d.deleteColumns(DH.length + 1, d.getMaxColumns() - DH.length);
    d.getRange(1, 1, 1, DH.length).setValues([DH]); d.setFrozenRows(1);
    d.getRange('A:C').setNumberFormat('@'); d.hideSheet();
  }
  return d;
}
// count one arriving batch into today's row (row 2)
function stats(a, now) {
  const day = fmt(now, 'yyyy-MM-dd'), h = +fmt(now, 'H'), s = statTab(), dv = devTab();
  let row;
  if (s.getLastRow() >= 2 && s.getRange(2, 1).getDisplayValue() === day) row = s.getRange(2, 1, 1, SH.length).getValues()[0];
  else {
    const cum = s.getLastRow() >= 2 ? +s.getRange(2, 4).getValue() || 0 : 0;
    s.insertRowBefore(2); s.getRange(2, 1, 1, SH.length).setFontWeight('normal'); heat(s);
    row = [day, 0, 0, cum, 0, 0, ...Array(24).fill(0)];
  }
  [...new Set(a.map(d => String(d.uid || '').slice(0, 40)).filter(Boolean))].forEach(u => {
    const c = dv.getRange('A:A').createTextFinder(u).matchEntireCell(true).findNext();
    if (!c) {
      const r = dv.getRange(dv.getLastRow() + 1, 1, 1, 4);
      r.setNumberFormats([['@', '@', '@', '0']]).setValues([[u, day, day, 1 << h]]);
      row[1]++; row[2]++; row[3]++; row[6 + h]++; return;
    }
    const r = dv.getRange(c.getRow(), 1, 1, 4), v = r.getValues()[0];
    let bits = +v[3] || 0;
    if (String(v[2]) !== day) { bits = 0; v[2] = day; row[1]++; }
    if (!(bits >> h & 1)) { bits |= 1 << h; row[6 + h]++; }
    v[3] = bits; r.setValues([v]);
  });
  row[4] += a.filter(d => d.kind === 'new').length;
  row[5] += a.filter(d => d.kind === 'retire').length;
  s.getRange(2, 1, 1, SH.length).setValues([row]);
}
// POST ?key=KEY&init=1 body {days:[[날짜,...30 cols], newest first], devs:[[uid,first,last,bits]]}: replaces both tabs (tools/logs.py --stats-init)
function init(b) {
  const s = statTab(), dv = devTab();
  if (s.getLastRow() >= 2) s.getRange(2, 1, s.getLastRow() - 1, SH.length).clearContent();
  if (dv.getLastRow() >= 2) dv.getRange(2, 1, dv.getLastRow() - 1, DH.length).clearContent();
  if (b.days.length) {
    if (s.getMaxRows() < b.days.length + 1) s.insertRowsAfter(s.getMaxRows(), b.days.length + 1 - s.getMaxRows());
    s.getRange(2, 1, b.days.length, SH.length).setValues(b.days);
  }
  if (b.devs.length) {
    if (dv.getMaxRows() < b.devs.length + 1) dv.insertRowsAfter(dv.getMaxRows(), b.devs.length + 1 - dv.getMaxRows());
    const r = dv.getRange(2, 1, b.devs.length, 4);
    r.setNumberFormats(b.devs.map(() => ['@', '@', '@', '0'])).setValues(b.devs);
  }
  heat(s);
  return out({ ok: 1, days: b.days.length, devs: b.devs.length });
}

function tab(name) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  // a new tab comes with 26 columns and the 10M-cell file limit counts empty ones too: keep only our 5
  if (sh.getMaxColumns() > HEAD.length) sh.deleteColumns(HEAD.length + 1, sh.getMaxColumns() - HEAD.length);
  return sh;
}

// POST body: one record or an array of records (game batches up to 30)
function doPost(e) {
  let a;
  try { a = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: 0 }); }
  const q = e.parameter || {};
  if (q.init) {
    if (q.key !== KEY) return out({ error: 'key' });
    const lk = LockService.getScriptLock();
    if (!lk.tryLock(25000)) return out({ error: 'busy' });
    try { return init(a); } finally { lk.releaseLock(); }
  }
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
    try { stats(a, now); } catch (err) { console.error('stats', err); }  // counting must never lose the log rows
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
    // anti-cheat: a line when a career gets flagged, feedback sent from a flagged career, and careers that dodged the game's check, in a "부정 플레이" tab
    // (stats all 99 = real cheat; ordinary stats = maybe wrongly caught → put its cid in X_OK in the game)
    const ST = ['quali', 'race', 'tyre', 'wet', 'consistency', 'mental'];
    const xs = a.filter(d => d.kind === 'flag' || (d.kind === 'fb' && d.x && d.text)).map(d => d.kind === 'flag' ? [
      Utilities.formatDate(new Date(now), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), '감지', String(d.why || ''), d.age || '', String(d.lk || ''), d.ovr || '',
      ST.map(k => (d.stats || {})[k] ?? '-').join('·'), (d.pot0 ?? '?') + '→' + (d.pot ?? '?'), d.titles || 0, (d.wins || 0) + '/' + (d.starts || 0),
      String(d.v || ''), String(d.cid || '')] : [
      Utilities.formatDate(new Date(now), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), '의견', String(d.text).slice(0, 300), '', String(d.lk || d.phase || ''), '',
      '', '', '', '', String(d.v || ''), String(d.cid || '')]);
    // careers the game didn't flag (its check was dodged, e.g. 11-12 '삐릿': all 99 at 15): numbers no real career reaches,
    // same lines as the game (young OVR cap 70+8×(age-14) up to 17, potential over 101). One line per career, never twice
    const P = PropertiesService.getScriptProperties(), cap = g => g <= 17 ? 70 + 8 * (g - 14) : 99;
    a.forEach(d => { if (d.kind === 'flag' && d.cid) P.setProperty('x' + d.cid, '1'); });
    a.forEach(d => {
      if (d.kind !== 'season' || !d.cid || P.getProperty('x' + d.cid)) return;
      const o = Math.max(+d.ovr0 || 0, +d.ovr1 || 0), why = o > cap(+d.age) ? `${d.age}세 OVR ${o} (상한 ${cap(+d.age)})` : (+d.pot > 101 ? `잠재력 ${d.pot}` : '');
      if (!why) return;
      P.setProperty('x' + d.cid, '1');
      xs.push([Utilities.formatDate(new Date(now), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), '감지 피함', why, d.age || '', String(d.lk || ''), d.ovr1 || '',
        ST.map(k => (d.stats || {})[k] ?? '-').join('·'), '?→' + (d.pot ?? '?'), '', (d.wins || 0) + '/' + (d.starts || 0) + ' (그 시즌)', String(d.v || ''), String(d.cid || '')]);
    });
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

// GET ?key=KEY&stats=1 → {stats: the '통계' tab as text, header first} (tools/logs.py --stats)
// GET ?key=KEY&tab=2026-11&row=120 → rows after row 120 of that tab, then later tabs, up to PAGE.
// Returns {rows, next:{tab,row}, more}; pass next back to keep reading (tools/logs.py does this).
function doGet(e) {
  const q = e.parameter || {};
  if (q.key !== KEY) return out({ error: 'key' });
  if (q.stats) return out({ stats: statTab().getDataRange().getDisplayValues() });
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
  // cells used by the whole file (Google's limit is 10M, empty cells included): tools/logs.py warns from 70%
  const cells = ss.getSheets().reduce((n, sh) => n + sh.getMaxRows() * sh.getMaxColumns(), 0);
  return out({ rows, next, more: rows.length >= PAGE, cells });
}
