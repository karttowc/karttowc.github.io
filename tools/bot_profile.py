"""Build tools/bot_profile.json (choice frequencies of real players) from play_logs.json (made by tools/logs.py).
Usage: python3 tools/bot_profile.py   then   BOT=real node tools/test_balance.js
Only aggregate counts go into the profile (no uid/cid), so it can be committed."""
import json,collections
R=json.load(open('play_logs.json'))
PAIR={'quali+race':'speed','consistency+quali':'sim','mental+race':'craft','consistency+tyre':'longrun','tyre+wet':'rainx','mental+wet':'mind'}
S=collections.defaultdict(list)
for d in R:
    if d.get('kind')=='season':S[d['cid']].append(d)
ev=collections.defaultdict(lambda:collections.Counter());ga=collections.defaultdict(lambda:[0,0])
prog=collections.Counter();rest=collections.defaultdict(lambda:[0,0])
for L in S.values():
    L.sort(key=lambda d:d['t'])
    for i,d in enumerate(L):
        for e in d.get('ev') or []:
            k,j=e.split(':');ev[k][int(j)]+=1
        if d.get('ga'):
            k,r=d['ga'].split(':');ga[k][0]+=1;ga[k][1]+=r!='rest'
        m=d.get('morale0')
        if m is not None:
            b=str(min(max(m//10*10,30),80));rest[b][0]+=1;rest[b][1]+=d.get('train')=='rest'
        if d.get('train')!='focus':continue
        g=d.get('prog') or PAIR.get('+'.join(sorted(d.get('focus') or [])))  # old logs: focus pair -> program
        if g:prog[g]+=1
P={'careers':len(S),
   'ev':{k:[v[j] for j in range(max(v)+1)] for k,v in ev.items()},
   'ga':{k:round(v[1]/v[0],2) for k,v in ga.items()},
   'ga_all':round(sum(v[1] for v in ga.values())/max(1,sum(v[0] for v in ga.values())),2),
   'prog':dict(prog.most_common()),
   'rest':{k:round(v[1]/v[0],3) for k,v in sorted(rest.items())}}
json.dump(P,open('tools/bot_profile.json','w'),ensure_ascii=False,indent=1)
print('careers',P['careers'],'prog',P['prog'],'gacha go',P['ga_all'],'rest',P['rest'])
