"""tools/baseline_real300.json 요약: 데뷔 못 한 이유, 무대 진입 나이, 월챔 커리어"""
import json,collections as C,statistics as st
D=json.load(open(__import__('pathlib').Path(__file__).parent/'baseline_real300.json'));N=len(D)
ORD=['KART','F4','FRECA','F3','F2','F1']
def med(a):return st.median(a) if a else None
# 1 where careers end (non-debut)
end=C.Counter();endage=C.defaultdict(list)
for d in D:
    if d['debutYear']:continue
    jun=[h for h in d['history'] if h['sid'] in ORD[:-1]]
    top=max(jun,key=lambda h:ORD.index(h['sid']))['sid'] if jun else '?'
    after='ALT' if any(h['sid']=='ALT' for h in d['history']) else ('reserve' if any(h['role']=='reserve' for h in d['history']) else 'retire')
    end[(top,after)]+=1;endage[top].append(d['retireAge'] if after=='retire' else next(h['age'] for h in d['history'] if h['sid'] in('ALT',) or h['role']=='reserve'))
print('== 데뷔 못한 커리어',sum(end.values()),'/',N)
for k,v in sorted(end.items(),key=lambda x:-x[1]):print(' ',k,v)
# kart dead-end
kd=[d for d in D if all(h['sid']=='KART' for h in d['history'])]
print('== 카트에서 끝',len(kd),[ (d['history'][-1]['age'],[h['pos'] for h in d['history']]) for d in kd])
# 2 age entering each series
ent=C.defaultdict(list)
for d in D:
    seen=set()
    for h in d['history']:
        if h['sid'] in ORD and h['sid'] not in seen and not(h['sid']=='F1' and h['role']!='race'):seen.add(h['sid']);ent[h['sid']].append(h['age'])
print('== 무대 진입 (도달 비율, 나이 중앙값)')
for s in ORD:print(f'  {s}: {len(ent[s])/N:.0%}, {med(ent[s])}세')
deb=[d['debutYear']-d['startYear']+14 for d in D if d['debutYear']]
print('  F1 데뷔 나이 분포',sorted(C.Counter(deb).items()))
res=sum(1 for d in D if any(h['role']=='reserve' for h in d['history']));print('  리저브 경험',f'{res/N:.0%}')
alt=sum(1 for d in D if any(h['sid']=='ALT' for h in d['history']));print('  다른 무대 경험',f'{alt/N:.0%}')
skip=sum(1 for d in D if any((o or '').startswith('junior:월반') for h in d['history'] for i,o in enumerate(h.get('offers') or []) if i==h.get('pick')));print('  월반 선택',skip)
# 3 champions
ch=[d for d in D if d['tot']['titles']>0]
print('== 월챔',len(ch),f'{len(ch)/N:.0%}', '타이틀 분포',sorted(C.Counter(d['tot']['titles'] for d in ch).items()))
fa=[];rank=C.Counter();team=C.Counter();under=0;tot=0;yrs=[]
for d in ch:
    f1=[h for h in d['history'] if h['sid']=='F1' and h['role']=='race']
    first=next(h for h in f1 if h['titled']);fa.append(first['age']);yrs.append(f1.index(first)+1)
    team[first['team']]+=1
    for h in f1:
        if h['titled']:
            tot+=1;rank[h.get('carRank')]+=1
print('  첫 월챔 나이 중앙값',med(fa),'분포',sorted(C.Counter(fa).items()))
print('  첫 월챔까지 F1 시즌 수',sorted(C.Counter(yrs).items()))
print('  첫 월챔 팀',team.most_common())
print('  우승 시즌 차 순위(시즌 시작 예상 머신 기준 X, 시즌 후 머신 순위)',sorted(rank.items(),key=lambda x:(x[0] is None,x[0])),'총',tot)
# debut team tiers
dt=C.Counter()
for d in D:
    f1=[h for h in d['history'] if h['sid']=='F1' and h['role']=='race']
    if f1:dt[f1[0]['team']]+=1
print('== 데뷔 팀',dt.most_common())
print('== 은퇴 나이 중앙값',med([d['retireAge'] for d in D]),'| 데뷔자 F1 시즌 중앙값',med([sum(1 for h in d['history'] if h['sid']=='F1' and h['role']=='race') for d in D if d['debutYear']]))
print('== F1 우승 중앙값(데뷔자)',med([d['tot']['wins'] for d in D if d['debutYear']]),'포디움',med([d['tot']['podiums'] for d in D if d['debutYear']]))
