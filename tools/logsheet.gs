// KARTtoWC play log v2 — Google Apps Script for the log sheet.
// 1) Sheet → Extensions → Apps Script, paste this, put the secret in KEY (never commit it).
// 2) Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone → copy the /exec URL.
// One tab per month (Asia/Seoul), e.g. "2026-11". Columns: recv(ms) uid cid kind json.
// A batch from the game is written as ONE row (kind 'batch', json = array of records), split only to stay under the 50k-character cell limit.
// Older rows hold one record each; tools/logs.py reads both.
// '통계' tab (first tab, newest day on top): 날짜 · 플레이(그날 온 기기) · 처음 온 사람 · 돌아온 사람 · 누적 · 새 커리어 · 은퇴.
// '시간별' tab (second): 날짜 · 0시~23시 (그 시간에 온 기기, 0은 빈칸).
// Counted when a batch arrives (Seoul time of arrival). The hidden '기기' tab keeps each device's first/last day so nobody counts twice.
// Past days were filled once by tools/logs.py --stats-init.
const KEY = '여기에_비밀키';
const HEAD = ['recv', 'uid', 'cid', 'kind', 'json'], PAGE = 5000, MAXB = 50;

const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const isTab = n => /^\d{4}-\d{2}$/.test(n);
const fmt = (ms, p) => Utilities.formatDate(new Date(ms), 'Asia/Seoul', p);
const SH = ['날짜', '플레이', '처음 온 사람', '돌아온 사람', '누적', '새 커리어', '은퇴'];
const HH = ['날짜', ...Array.from({ length: 24 }, (_, i) => i + '시')];
const DH = ['기기', '처음', '마지막', '그날 시간'];
const fit = (sh, n) => { if (sh.getMaxColumns() > n) sh.deleteColumns(n + 1, sh.getMaxColumns() - n); };
// header row: written again whenever it isn't ours (e.g. the tab already existed, made by hand)
const head = (sh, H) => { const r = sh.getRange(1, 1, 1, H.length); if (r.getDisplayValues()[0].join('|') !== H.join('|')) r.setValues([H]).setFontWeight('bold'); };
const rowsFor = (sh, n) => { if (sh.getMaxRows() < n + 1) sh.insertRowsAfter(sh.getMaxRows(), n + 1 - sh.getMaxRows()); };

// '시간별': hours shaded by how many came, 0 shown blank (rule re-applied when a day row is added, since inserting rows shifts ranges)
function heat(h) {
  const r = h.getRange(2, 2, Math.max(h.getMaxRows() - 1, 1), 24);
  r.setNumberFormat('0;-0;;@');
  h.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue('#ffffff', SpreadsheetApp.InterpolationType.NUMBER, '0')
    .setGradientMaxpoint('#f4a261').setRanges([r]).build()]);
}
function hourTab() {
  const ss = SpreadsheetApp.getActive();
  let h = ss.getSheetByName('시간별');
  if (!h) {
    h = ss.insertSheet('시간별', 1); fit(h, HH.length);
    h.getRange(1, 1, 1, HH.length).setValues([HH]).setFontWeight('bold');
    h.setFrozenRows(1); h.setFrozenColumns(1);
    h.getRange('A:A').setNumberFormat('@'); h.setColumnWidth(1, 90); h.setColumnWidths(2, 24, 36);
    heat(h);
  }
  head(h, HH);
  return h;
}
function statTab() {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName('통계');
  if (!s) {
    s = ss.insertSheet('통계', 0); fit(s, SH.length);
    s.getRange(1, 1, 1, SH.length).setValues([SH]).setFontWeight('bold');
    s.setFrozenRows(1); s.getRange('A:A').setNumberFormat('@'); s.setColumnWidth(1, 90);
  } else if (s.getMaxColumns() > SH.length && s.getLastColumn() > SH.length && ['0시', ''].includes(s.getRange(1, 8).getDisplayValue())) {
    // first version had the hours in this tab too (header 0시, or no header when the tab already existed): move them to '시간별'
    const h = hourTab(), last = s.getLastRow();
    if (last >= 2) { const v = s.getRange(2, 1, last - 1, 31).getValues().map(r => [r[0], ...r.slice(7)]); rowsFor(h, v.length); h.getRange(2, 1, v.length, HH.length).setValues(v); }
    s.setConditionalFormatRules([]); s.setFrozenColumns(0); fit(s, SH.length); heat(h);
  }
  head(s, SH); s.setFrozenRows(1); s.getRange('A:A').setNumberFormat('@');
  return s;
}
function devTab() {
  const ss = SpreadsheetApp.getActive();
  let d = ss.getSheetByName('기기');
  if (!d) {
    d = ss.insertSheet('기기'); fit(d, DH.length);
    d.getRange(1, 1, 1, DH.length).setValues([DH]); d.setFrozenRows(1);
    d.getRange('A:C').setNumberFormat('@'); d.hideSheet();
  }
  head(d, DH);
  return d;
}
// today's row (row 2, newest on top) of a tab, added if missing
function today(sh, day, blank, isHour) {
  if (sh.getLastRow() >= 2 && sh.getRange(2, 1).getDisplayValue() === day) return sh.getRange(2, 1, 1, blank.length).getValues()[0].map((v, i) => i ? +v || 0 : v);
  sh.insertRowBefore(2); sh.getRange(2, 1, 1, blank.length).setFontWeight('normal');
  if (isHour) heat(sh);
  return blank;
}
// count one arriving batch into today's rows
function stats(a, now) {
  const day = fmt(now, 'yyyy-MM-dd'), h = +fmt(now, 'H'), s = statTab(), hs = hourTab(), dv = devTab();
  const cum = s.getLastRow() >= 2 ? +s.getRange(2, 5).getValue() || 0 : 0;
  const row = today(s, day, [day, 0, 0, 0, cum, 0, 0]), hr = today(hs, day, [day, ...Array(24).fill(0)], true);
  [...new Set(a.map(d => String(d.uid || '').slice(0, 40)).filter(Boolean))].forEach(u => {
    const c = dv.getRange('A:A').createTextFinder(u).matchEntireCell(true).findNext();
    if (!c) {
      const r = dv.getRange(dv.getLastRow() + 1, 1, 1, 4);
      r.setNumberFormats([['@', '@', '@', '0']]).setValues([[u, day, day, 1 << h]]);
      row[1]++; row[2]++; row[4]++; hr[1 + h]++; return;
    }
    const r = dv.getRange(c.getRow(), 1, 1, 4), v = r.getValues()[0];
    let bits = +v[3] || 0;
    if (String(v[2]) !== day) { bits = 0; v[2] = day; row[1]++; row[3]++; }
    if (!(bits >> h & 1)) { bits |= 1 << h; hr[1 + h]++; }
    v[3] = bits; r.setValues([v]);
  });
  row[5] += a.filter(d => d.kind === 'new').length;
  row[6] += a.filter(d => d.kind === 'retire').length;
  s.getRange(2, 1, 1, SH.length).setValues([row]);
  hs.getRange(2, 1, 1, HH.length).setValues([hr]);
}
// POST ?key=KEY&init=1 body {days:[[날짜, 플레이, 처음, 돌아옴, 누적, 새 커리어, 은퇴, 0시..23시], newest first], devs:[[uid,first,last,bits]]}
// replaces the three tabs (tools/logs.py --stats-init)
function init(b) {
  const s = statTab(), hs = hourTab(), dv = devTab();
  [[s, SH.length], [hs, HH.length], [dv, DH.length]].forEach(([t, n]) => { if (t.getLastRow() >= 2) t.getRange(2, 1, t.getLastRow() - 1, n).clearContent(); });
  if (b.days.length) {
    rowsFor(s, b.days.length); rowsFor(hs, b.days.length);
    s.getRange(2, 1, b.days.length, SH.length).setValues(b.days.map(r => r.slice(0, 7)));
    hs.getRange(2, 1, b.days.length, HH.length).setValues(b.days.map(r => [r[0], ...r.slice(7)]));
  }
  if (b.devs.length) {
    rowsFor(dv, b.devs.length);
    dv.getRange(2, 1, b.devs.length, 4).setNumberFormats(b.devs.map(() => ['@', '@', '@', '0'])).setValues(b.devs);
  }
  heat(hs);
  return out({ ok: 1, days: b.days.length, devs: b.devs.length });
}
// both tabs as text, joined by date: header + [날짜, 플레이, 처음, 돌아옴, 누적, 새 커리어, 은퇴, 0시..23시] (blank hour = 0)
function statRows() {
  const s = statTab().getDataRange().getDisplayValues(), h = hourTab().getDataRange().getDisplayValues(), m = {};
  h.slice(1).forEach(r => { m[r[0]] = r.slice(1); });
  return [SH.concat(HH.slice(1)), ...s.slice(1).filter(r => r[0]).map(r => r.slice(0, 7).concat((m[r[0]] || Array(24).fill('')).map(v => v || '0')))];
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

// GET ?key=KEY&stats=1 → {stats: statRows()} (tools/logs.py --stats)
// GET ?key=KEY&tab=2026-11&row=120 → rows after row 120 of that tab, then later tabs, up to PAGE.
// Returns {rows, next:{tab,row}, more}; pass next back to keep reading (tools/logs.py does this).
function doGet(e) {
  const q = e.parameter || {};
  if (q.key !== KEY) return out({ error: 'key' });
  if (q.stats) return out({ stats: statRows() });
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
