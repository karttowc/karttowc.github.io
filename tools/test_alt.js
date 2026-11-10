// alt-league stress bot (made from test_balance.js): goes to league LG (WEC|INDY) whenever offered and stays till 45. LG=INDY AH='{"legend_max":8}' node tools/test_alt.js
const el=()=>({classList:{toggle(){},add(){},remove(){}},addEventListener(){},querySelectorAll(){return[]},set innerHTML(v){},hidden:false,click(){}});
global.Image=function(){};global.document={getElementById:()=>el(),createElement:()=>({getContext:()=>null}),fonts:null,body:{appendChild(){}}};
global.window={scrollTo(){}};global.localStorage={getItem(){return null},setItem(){},removeItem(){}};
const fs=require('fs');
// BOT=real: follow real players' choice rates (tools/bot_profile.json, made by tools/bot_profile.py). BOT=offer: only their offer rule
const BOFF=process.env.BOT==='offer',BOT=true?JSON.parse(fs.readFileSync(require('path').join(__dirname,'bot_profile.json'),'utf8')):null;
eval(fs.readFileSync(process.env.GAME||require('path').join(__dirname,'../build/game.js'),'utf8')+`
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


if(process.env.AH)Object.assign(B.career.alt_hunt,JSON.parse(process.env.AH));const L=process.env.LG||'WEC';let R={n:0,c:[]};
for(let i=0;i<+(process.env.N||300);i++){const st=styleStats(45,'racer');newGame({name:'T',num:7,nat:'KOR',helmet:'#fff',style:'racer',stats:st,focus:['race','quali']});
  let g=0;while(!S.p.retired&&g++<45){quickSeason();const o=S.offers,p=S.p;
    const inL=p.series==='ALT'&&p.alt===L;const mine=o.filter(x=>x.kind==='alt'&&x.altId===L).map(x=>({x,m:(altMach(L)||{})[x.altTeam]||0}));
    const keep=inL?o.filter(x=>['stay','resign','option'].includes(x.kind)).map(x=>({x,m:(altCarOf(L,p.team.name)||0)+.01})):[];
    const all=[...mine,...keep].sort((a,b)=>b.m-a.m);
    if(all.length)applyOffer(all[0].x);
    else{const pr=x=>({f1:0,resign:1,junior:x.tag==='월반'?2:x.tag==='승격'?3:5,reserve:6,alt:7,retire:9}[x.kind]);const nr=o.filter(x=>x.kind!=='retire');applyOffer(botOffer(nr.length&&p.age<45?nr:o,pr))}}
  R.n++;R.c.push(S.p.history.filter(h=>h.lk===L&&h.titled).length);}
const c=R.c,q=k=>c.filter(x=>x>=k).length/c.length;console.log(L,'n',R.n,'1+',q(1).toFixed(2),'4+',q(4).toFixed(2),'6+',q(6).toFixed(2),'8+',q(8).toFixed(3),'10+',q(10).toFixed(3),'max',Math.max(...c),'avg',(c.reduce((a,b)=>a+b,0)/c.length).toFixed(2));
`);
