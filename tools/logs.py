"""Fetch the anonymous play log (Google Sheet via Apps Script, tools/logsheet.gs) and print a quick summary.
Usage: LOG_KEY=... python3 tools/logs.py [--old] [--since VER] [log files...]
  The key is the Apps Script KEY (not committed). Only records newer than the last run are fetched
  (cursor in play_logs_state.json); everything is kept in play_logs.json (both gitignored), the summary uses it all.
  --old  also fetch the whole first (v1) sheet once, to merge its records in.
  --since VER  compare careers started before / from that version (default PATCH = the latest balance patch).
  At the end (점검): feedback new since the last run, each with the sender's career at that moment
  (season, team, rank, age, OVR, path, stats, offers), and new flagged (ranking-excluded) careers. --fb N = last N feedback instead.
  Log files = "플레이 기록 파일 받기" downloads (unsent queue), merged in.
"""
import os,sys,json,urllib.request,urllib.parse,collections
URL='https://script.google.com/macros/s/AKfycbyvaW_ZcP86QI4zMVgIvp67PHEpDinuXji1EfBDgQUT11YoB62IAw9qDwIOfyilME89vQ/exec'  # v2 sheet (tools/logsheet.gs)
OLD_URL='https://script.google.com/macros/s/AKfycbwQLNST9m47Rbh9GRou9a2Yrl0L0cYt8ImopVt-ZC0TKSZcxVAWrTCNkuFCChwJuKIE/exec'
DB,ST='play_logs.json','play_logs_state.json'
PATCH='1.6.9'  # latest balance patch: update this whenever a balance change goes public (CLAUDE.md)
key=os.environ.get('LOG_KEY');args=sys.argv[1:];old='--old' in args
if '--since' in args:i=args.index('--since');PATCH=args[i+1];del args[i:i+2]
FBN=0
if '--fb' in args:i=args.index('--fb');FBN=int(args[i+1]);del args[i:i+2]
files=[a for a in args if a!='--old']
get=lambda u,q:json.load(urllib.request.urlopen(u+'?'+urllib.parse.urlencode(q),timeout=300))
def parse(rows):
    for r in rows:
        try:x=json.loads(r[4])
        except Exception:continue
        # a row is one record, or (logsheet.gs batch rows) a list of records
        if isinstance(x,list):yield from (d for d in x if isinstance(d,dict))
        else:yield x
recs=json.load(open(DB)) if os.path.exists(DB) else []
n0=len(recs)
if key and old:recs+=parse(get(OLD_URL,{'key':key}))
if key and URL:
    st0=json.load(open(ST)) if os.path.exists(ST) else {};cur={'tab':st0.get('tab',''),'row':st0.get('row',1)}
    while True:
        r=get(URL,{'key':key,**cur})
        if 'error' in r:sys.exit('sheet error: '+r['error'])
        recs+=parse(r['rows']);cur=r['next']
        if not r['more']:break
    json.dump({**st0,**cur},open(ST,'w'))
for f in files:recs+=json.load(open(f))
if not recs:sys.exit('no records (LOG_KEY env var or log files needed)')
seen=set();recs=[d for d in recs if not((d.get('uid'),d.get('t'),d.get('kind')) in seen or seen.add((d.get('uid'),d.get('t'),d.get('kind'))))]
json.dump(recs,open(DB,'w'),ensure_ascii=False)
print(f"new records {len(recs)-n0}")
print(f"records {len(recs)} · players {len({d['uid'] for d in recs})} · careers {len({d['cid'] for d in recs})} (new {sum(d.get('kind')=='new' for d in recs)}, retired {sum(d.get('kind')=='retire' for d in recs)})")
K=collections.defaultdict(list)
for d in recs:K[d.get('kind')].append(d)
R=K['retire']
if R:
    n=len(R);pct=lambda c:f"{100*sum(1 for d in R if c(d))/n:.0f}%"
    print(f"retired {n}: F1 debut {pct(lambda d:d['debut'])} · champ1+ {pct(lambda d:d['titles']>=1)} · champ5+ {pct(lambda d:d['titles']>=5)} · avg age {sum(d['age'] for d in R)/n:.1f}")
# before / after the latest balance patch, by the version a career started in
vt=lambda v:tuple(int(x) for x in str(v or '0').split('-')[0].split('.')) if str(v or '0').split('-')[0].replace('.','').isdigit() else (0,)
cv={d['cid']:d.get('v') for d in K['new']}
if R:
    print(f"balance patch v{PATCH} (careers by start version):")
    for lb,f in (('before',lambda c:vt(cv.get(c))<vt(PATCH)),('after',lambda c:c in cv and vt(cv[c])>=vt(PATCH))):
        G=[d for d in R if f(d['cid'])];n=len(G)
        if not n:print(f"  {lb}: no retired careers yet");continue
        pc=lambda c:f"{100*sum(1 for d in G if c(d))/n:.0f}%"
        print(f"  {lb} {n}: F1 debut {pc(lambda d:d['debut'])} · champ1+ {pc(lambda d:d['titles']>=1)} · champ5+ {pc(lambda d:d['titles']>=5)} · avg age {sum(d['age'] for d in G)/n:.1f}")
    ac=sum(1 for c in cv if vt(cv[c])>=vt(PATCH));print(f"  careers started from v{PATCH}: {ac} (retired ones above; unfinished ones not counted)")
S=K['season']
if S:
    print('seasons by series:',dict(collections.Counter(d['lk'] for d in S)))
    m0=[d['morale0'] for d in S if d.get('morale0') is not None]
    if m0:print(f"stamina at season start: avg {sum(m0)/len(m0):.0f}, <60 {100*sum(1 for x in m0 if x<60)/len(m0):.0f}%")
    print('training:',dict(collections.Counter(d.get('train') for d in S)))
    ch=[d['ch'] for d in S if d.get('ch')]
    if ch:print('challenge go/no:',dict(collections.Counter(c.split(':')[1] for c in ch)))
    ev=collections.Counter(e for d in S for e in d.get('ev') or [])
    if ev:print('event picks (id:choice):',dict(ev.most_common()))
    # per-stat change: in season (growth + break gamble) = stats - s0; preseason (events) = s0 - previous season's stats
    prev={};pre=collections.Counter();ins=collections.Counter();cnt=0
    for d in sorted(S,key=lambda d:(d['cid'],d['year'])):
        s0=d.get('s0')
        if s0:
            cnt+=1
            for k,v in d['stats'].items():ins[k]+=v-s0[k]
            p=prev.get(d['cid'])
            if p:
                for k in s0:pre[k]+=s0[k]-p[k]
        prev[d['cid']]=d['stats']
    if cnt:print('avg stat change / season (in season):',{k:round(v/cnt,2) for k,v in ins.items()});print('total preseason change:',dict(pre))
    ga=collections.Counter((d.get('ga') or '').split(':')[1] for d in S if d.get('ga'))
    if ga:print('break gamble:',dict(ga))
    ir=[x.split(':') for d in S for x in d.get('incr') or []]
    if ir:
        B=collections.defaultdict(lambda:[0,0])
        for pc,ok in ir:b=B[int(pc)//10*10];b[0]+=1;b[1]+=int(ok)
        print('race incidents (shown % -> actual):',' · '.join(f"{k}%대 {v[1]}/{v[0]} = {100*v[1]/v[0]:.0f}%" for k,v in sorted(B.items())))
# where careers stop: last series of careers with no retire record
last={}
for d in S:last[d['cid']]=d['lk']
stop=collections.Counter(v for c,v in last.items() if c not in {d['cid'] for d in R})
if stop:print('unfinished careers stopped at:',dict(stop))
# --- 점검: feedback with the sender's situation, flagged careers (only what's new since the last check) ---
import datetime
kst=lambda t:datetime.datetime.fromtimestamp(t/1000,datetime.timezone(datetime.timedelta(hours=9))).strftime('%m-%d %H:%M')
st=json.load(open(ST)) if os.path.exists(ST) else {}
BY=collections.defaultdict(list)
for d in recs:BY[d.get('cid')].append(d)
SN={'quali':'퀄리','race':'레이스','tyre':'타이어','wet':'빗길','consistency':'일관성','mental':'멘탈'}
def situ(f):
    """the sender's career as it was when the feedback was sent"""
    C=sorted((d for d in BY.get(f.get('cid'),[]) if d['t']<=f['t']),key=lambda d:d['t'])
    S2=[d for d in C if d.get('kind')=='season'];R2=[d for d in C if d.get('kind')=='retire']
    if not S2:return ['기록 없음 (기록 끄기·다른 기기·커리어 시작 전)']
    L=S2[-1];rl={'reserve':' 리저브','test':' 테스트'}.get(L.get('role'),'')
    out=[f"{L['year']} {L['lk']}{rl} {L.get('team') or ''} {L['pos']}/{L['field']}위 · {L['age']}세 · OVR {L['ovr0']}→{L['ovr1']} (잠재 {L.get('pot')}) · {len(S2)}시즌째"+(' · 은퇴함' if R2 else '')]
    path=[d['lk']+('r' if d.get('role')=='reserve' else '') for d in S2];deb=next((d['year'] for d in S2 if d['lk']=='F1' and d.get('role')=='race'),None)
    tt=sum(1 for d in S2 if d['lk']=='F1' and d.get('titled'));w=sum(d.get('wins',0) for d in S2 if d['lk']=='F1')
    out.append('경로 '+('…>' if len(path)>12 else '')+'>'.join(path[-12:])+(f" · F1 데뷔 {deb}" if deb else ' · F1 데뷔 없음')+(f" · F1 우승 {w} · 월챔 {tt}" if deb else ''))
    if L.get('s0') and L.get('stats'):
        ch=[f"{SN.get(k,k)} {v}{'(%+d)'%(v-L['s0'][k]) if v!=L['s0'][k] else ''}" for k,v in L['stats'].items()]
        out.append('능력치 '+' · '.join(ch))
    pk=L.get('pick')
    if pk:out.append(f"이번 제안 {len(pk.get('offers') or [])}개: {', '.join(pk.get('offers') or [])} → 고름 {pk.get('pick')}")
    if any(d.get('x') for d in R2):out.append(f"조작 표시 x={R2[-1].get('x')}")
    return out
FB=sorted(K['fb'],key=lambda d:d['t'])
if FB:
    show=FB[-FBN:] if FBN else [d for d in FB if d['t']>st.get('fbSeen',0)]
    print(f"\nfeedback {len(FB)} · new since last check {sum(1 for d in FB if d['t']>st.get('fbSeen',0))}"+('' if show else ' (older: --fb N)'))
    for d in show:
        print(f"\n[{kst(d['t'])}] v{d.get('v')} {d.get('lk') or d.get('phase')} | "+d['text'].replace('\n',' / '))
        for x in situ(d):print('   ',x)
    if not FBN:st['fbSeen']=FB[-1]['t']
X=[d for d in R if d.get('x')]
if X:
    nx=[d for d in X if d['t']>st.get('xSeen',0)]
    print(f"\nflagged careers (ranking excluded) {len(X)} · new {len(nx)} (x=1 numbers, x=2 console random)")
    for d in nx:print(f"  [{kst(d['t'])}] v{d.get('v')} x={d['x']} · 월챔 {d['titles']} · 우승 {d['wins']}/{d['starts']} · peak {d['peak']} · pot {d['pot']}")
    st['xSeen']=max(d['t'] for d in X)
# missed by the in-game check (ranking may have it): retire pot > 101 (97 max + awaken 4) or > start pot + 4, or OVR over the age cap
NP={d['cid']:d.get('pot') for d in K['new']}
cap=lambda a:70+8*(a-14) if a<=17 else 99
MS=[d for d in R if not d.get('x') and (d.get('pot',0)>101 or (isinstance(NP.get(d['cid']),(int,float)) and d.get('pot',0)>NP[d['cid']]+4) or any(isinstance(s.get('ovr1'),(int,float)) and s['ovr1']>cap(s['age']) for s in BY.get(d['cid'],[]) if s.get('kind')=='season'))]
if MS:
    print(f"\nsuspicious careers not flagged in game {len(MS)} (check the ranking, delete by cid in Supabase)")
    for d in MS:print(f"  [{kst(d['t'])}] cid {d['cid']} v{d.get('v')} · 월챔 {d['titles']} · 우승 {d['wins']}/{d['starts']} · pot {NP.get(d['cid'])}→{d['pot']}")
json.dump(st,open(ST,'w'))
