// 실제 플레이어 봇 300커리어를 돌려 커리어별 기록을 tools/baseline_real300.json에 저장 (공개 전 기준값). 요약: python3 tools/career_report.py
const el=()=>({classList:{toggle(){},add(){},remove(){}},addEventListener(){},querySelectorAll(){return[]},set innerHTML(v){},hidden:false,click(){}});
global.Image=function(){};global.document={getElementById:()=>el(),createElement:()=>({getContext:()=>null}),fonts:null,body:{appendChild(){}}};
global.window={scrollTo(){}};global.localStorage={getItem(){return null},setItem(){},removeItem(){}};
const fs=require('fs');
// BOT=real: follow real players' choice rates (tools/bot_profile.json, made by tools/bot_profile.py). BOT=offer: only their offer rule
const BOFF=false,BOT=true?JSON.parse(fs.readFileSync(require('path').join(__dirname,'bot_profile.json'),'utf8')):null;
eval(fs.readFileSync(require('path').join(__dirname,'../build/game.js'),'utf8')+`
let smart=false; // half the careers take the recommended program whenever it can change, half keep the style's program
function quickSeason(){if(BOT)return botSeason();S.train=S.p.morale<40?'rest':'focus';if(trOpen()){if(smart)setProg(recProg().id);S.progYear=S.year;S.progFree=null}startSeason();if(S.season.gacha)resolveGacha(Math.random()<.5);S.season.incidents.forEach(i=>applyIncident(i,ri(0,1)));finishSeason()}
const wpick=o=>{const ks=Object.keys(o);let r=Math.random()*ks.reduce((a,k)=>a+o[k],0);return ks.find(k=>(r-=o[k])<0)||ks[0]};
function botSeason(){const p=S.p;
  S.train=Math.random()<(BOT.rest[String(Math.min(Math.max(Math.floor(p.morale/10)*10,30),80))]||0)?'rest':'focus';
  if(trOpen()){const o={};for(const k in BOT.prog)if(progDef(k).st.some(s=>p.stats[s]<99))o[k]=BOT.prog[k];if(Object.keys(o).length)setProg(wpick(o));S.progYear=S.year;S.progFree=null}
  for(const e of [...(S.events||[])]){const d=evDef(e.id);if(!d)continue;const cnt=BOT.ev[e.id];
    const j=cnt?+wpick(Object.fromEntries(d.choices.map((c,i)=>[i,(cnt[i]||0)+.5]))):ri(0,d.choices.length-1),c=d.choices[j];
    applyEff(c.eff);if(c.risk&&Math.random()<c.risk.p)applyEff(c.risk.eff);S.evSeason=[...(S.evSeason||[]),{id:e.id,j}]}
  if(S.challenge)runChallenge();// challenge choice wasn't logged before v0.29.12: assume taken
  startSeason();const G=S.season.gacha;if(G)resolveGacha(Math.random()<(BOT.ga[G.id]??BOT.ga_all));
  // incident choices aren't logged: assume the best expected result (lower delta = better)
  S.season.incidents.forEach(i=>{const d=INC.find(x=>x.id===i.id),ev=c=>{if(c.fixed)return c.fixed.delta;const q=incChance(c),m=a=>(a[0]+a[1])/2;return q*m(c.good)+(1-q)*m(c.bad)+(1-q)*(c.dnf||0)*2*8};
    let b=0;d.choices.forEach((c,k)=>{if(ev(c)<ev(d.choices[b]))b=k});applyIncident(i,b)});
  finishSeason()}
// real players pick the fastest car, re-signing included (the default bot hops to any other F1 team even from a top car)
function botOffer(o,pr){const myM=S.p.series==='F1'&&S.p.role==='race'?teamDef(S.p.team.id).machine:-1;
  const f=o.map(x=>({x,m:x.kind==='f1'?teamDef(x.teamId).machine:['resign','option','stay'].includes(x.kind)&&myM>=0?myM:null})).filter(y=>y.m!=null).sort((a,b)=>b.m-a.m);
  return f.length?f[0].x:[...o].sort((a,b)=>pr(a)-pr(b))[0]}

let OUT=[];let res={n:0,f1:0,ch1:0,ch5:0,debut:[],seasons:0};
for(let i=0;i<300;i++){smart=i%2===0;
  const st=styleStats(45,'racer');newGame({name:'T',num:7,nat:'KOR',helmet:'#fff',style:'racer',stats:st,focus:['race','quali']});
  let guard=0;
  while(!S.p.retired&&guard++<40){quickSeason();const H=S.p.history.at(-1);if(H&&H.sid==='F1'){const ms=[...S.teams].sort((a,b)=>b.machine-a.machine);H.carRank=S.p.team?ms.findIndex(t=>t.id===S.p.team.id)+1:null}
    const o=S.offers;const pr=x=>({f1:0,resign:1,junior:x.tag==='월반'?2:x.tag==='아카데미'?2.5:x.tag==='승격'?3:5,reserve:6,alt:7,retire:9}[x.kind]);
    const best=BOT||BOFF?botOffer(o,pr):[...o].sort((a,b)=>{if(a.kind==='f1'&&b.kind==='f1')return teamDef(b.teamId).machine-teamDef(a.teamId).machine;return pr(a)-pr(b)})[0];
    const ch=best.kind==='retire'&&S.p.age<38&&o.length>1?o.find(x=>x.kind!=='retire'):best;if(H){H.offers=o.map(x=>x.kind+(x.tag?':'+x.tag:'')+(x.teamId?'@'+x.teamId:x.series?'@'+x.series:x.altId?'@'+x.altId:''));H.pick=o.indexOf(ch)}applyOffer(ch);}
  OUT.push({potential:S.p.potential,peak:S.p.peak,tot:S.p.tot,debutYear:S.p.debutYear,startYear:S.startYear,retireAge:S.p.age,jr:S.p.jr.map(j=>j.name),alts:S.p.alts,f1Teams:S.p.f1Teams,earn:S.p.earn,history:S.p.history.map(h=>{const{hl,why,color,...r}=h;return{...r,why}})});
  res.n++;(res.pk=res.pk||[]).push(S.p.peak);(res.pot=res.pot||[]).push(S.p.potential);(res.w=res.w||[]).push(S.p.tot.wins);if(S.p.debutYear){res.f1++;res.debut.push(S.p.debutYear-S.startYear+14)}
  if(S.p.tot.titles>=1)res.ch1++;if(S.p.tot.titles>=5)res.ch5++;
}
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const q=(a,p)=>[...a].sort((x,y)=>x-y)[Math.floor(a.length*p)];console.log('peak p10/50/90',q(res.pk,.1),q(res.pk,.5),q(res.pk,.9),'pot med',q(res.pot,.5),'wins med/p90',q(res.w,.5),q(res.w,.9));fs.writeFileSync(require('path').join(__dirname,'baseline_real300.json'),JSON.stringify(OUT));console.log('F1 debut',res.f1/res.n,'champ1+',res.ch1/res.n,'champ5+',res.ch5/res.n,'debut age avg',avg(res.debut).toFixed(1));
`);
