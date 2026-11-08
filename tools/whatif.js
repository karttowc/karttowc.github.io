// What-if: drop a real logged career (play_logs.json) into the sim at a given age and play the rest
// under the old rules (42 cap, no veteran growth) and the new ones, many times each.
// Usage: node tools/whatif.js <cid> [age=33] [n=100]   REPLAY=1: from that age follow the player's logged choices
//   (training, rest, preseason events, Le Mans/Indy, break gamble, which kind of offer and team tier, when they retired);
//   incident choices aren't logged (best expected result). Past their last logged season the bot takes over.
// The world (teams, AI grid) is the sim's own, not the player's real one: the player's stats, potential,
// style and recent F1 titles at that age come from the log. Runs the real-player bot (tools/bot_profile.json).
const el=()=>({classList:{toggle(){},add(){},remove(){}},addEventListener(){},querySelectorAll(){return[]},set innerHTML(v){},hidden:false,click(){}});
global.Image=function(){};global.document={getElementById:()=>el(),createElement:()=>({getContext:()=>null}),fonts:null,body:{appendChild(){}}};
global.window={scrollTo(){}};global.localStorage={getItem(){return null},setItem(){},removeItem(){}};
const fs=require('fs'),path=require('path');
const BOFF=false,BOT=JSON.parse(fs.readFileSync(path.join(__dirname,'bot_profile.json'),'utf8'));
const tb=fs.readFileSync(path.join(__dirname,'test_balance.js'),'utf8'),harness=tb.slice(tb.indexOf('let smart=false'),tb.indexOf('let res='));
const [cid,AGE='33',N='100']=process.argv.slice(2);
const logs=JSON.parse(fs.readFileSync('play_logs.json','utf8')).filter(d=>String(d.cid)===cid);
const seasons=logs.filter(d=>d.kind==='season').sort((a,b)=>a.year-b.year),ret=logs.find(d=>d.kind==='retire');
const at=seasons.find(d=>d.age>=+AGE&&d.s0);if(!at){console.log('no season at age',AGE);process.exit(1)}
eval(fs.readFileSync(path.join(__dirname,'../build/game.js'),'utf8')+harness+`
const NEW={vet:B.driver.veteran,cons:B.driver.age_decline_by_stat.consistency,old:B.career.old_seat_per_year,pm:B.career.player_max_age,am:B.career.ai_max_age};
const OLD={vet:null,cons:.8,old:0,pm:42,am:43};
const rules=r=>{B.driver.veteran=r.vet;B.driver.age_decline_by_stat.consistency=r.cons;B.career.old_seat_per_year=r.old;B.career.player_max_age=r.pm;B.career.ai_max_age=r.am};
const pickOffer=()=>{const o=S.offers,pr=x=>({f1:0,resign:1,junior:5,reserve:6,alt:7,retire:9}[x.kind]);const b=botOffer(o,pr);applyOffer(b.kind==='retire'&&S.p.age<38&&o.length>1?o.find(x=>x.kind!=='retire'):b)};
// warm up a world until the player is ${AGE} and in an F1 race seat (with the old rules: that is the world they lived in)
function warm(){for(let tries=0;tries<50;tries++){rules(OLD);
  newGame({name:'T',num:7,nat:'KOR',helmet:'#fff',style:'${(ret&&ret.style)||'racer'}',stats:styleStats(45,'racer'),focus:['race','quali']});
  let g=0;while(!S.p.retired&&g++<40){quickSeason();pickOffer();if(S.p.age>=${at.age})break}
  if(S.p.age===${at.age}&&S.p.series==='F1'&&S.p.role==='race')return true}return false}
const L=${JSON.stringify({s0:at.s0,pot:at.pot,style:null,age:at.age,prev:seasons.filter(d=>d.age<at.age).map(d=>({age:d.age,lk:d.lk,role:d.role,titled:!!d.titled})),titles:seasons.filter(d=>d.age<at.age&&d.lk==='F1'&&d.titled).length})};
function plant(){const p=S.p;p.stats={...L.s0};p.potential=L.pot;p.pot0=Math.min(p.pot0??L.pot,L.pot);
  p.history.forEach(h=>{const r=L.prev.find(x=>x.age===h.age);if(r&&r.lk==='F1'){h.sid='F1';h.lk='F1';h.titled=r.titled}});p.tot.titles=L.titles}
const LOG=${JSON.stringify(Object.fromEntries(seasons.filter(d=>d.age>=at.age).map(d=>[d.age,{train:d.train,prog:d.prog,ev:d.ev||[],ch:d.ch,ga:d.ga,pick:d.pick&&d.pick.pick}])))},RET=${ret?ret.age:99},REPLAY=${!!process.env.REPLAY};
function replaySeason(){const p=S.p,l=LOG[p.age];if(!REPLAY||!l)return quickSeason();
  S.train=l.train||'focus';if(l.prog&&progDef(l.prog)){setProg(l.prog);S.progYear=S.year;S.progFree=null}
  const want=Object.fromEntries((l.ev||[]).map(x=>x.split(':')));
  for(const e of [...(S.events||[])]){const d=evDef(e.id);if(!d)continue;const j=want[e.id]!=null?+want[e.id]:ri(0,d.choices.length-1),c=d.choices[j];
    applyEff(c.eff);if(c.risk&&Math.random()<c.risk.p)applyEff(c.risk.eff)}
  if(S.challenge){if(l.ch&&l.ch.endsWith(':go'))runChallenge();else S.challenge=null}
  startSeason();if(S.season.gacha)resolveGacha(l.ga?!l.ga.endsWith(':rest'):Math.random()<.5);
  S.season.incidents.forEach(i=>{const d=INC.find(x=>x.id===i.id),ev=c=>{if(c.fixed)return c.fixed.delta;const q=incChance(c),m=a=>(a[0]+a[1])/2;return q*m(c.good)+(1-q)*m(c.bad)+(1-q)*(c.dnf||0)*2*8};
    let b=0;d.choices.forEach((c,k)=>{if(ev(c)<ev(d.choices[b]))b=k});applyIncident(i,b)});
  finishSeason()}
function replayOffer(){const o=S.offers,a=S.p.age,l=LOG[a];if(!REPLAY)return pickOffer();
  const ret=o.find(x=>x.kind==='retire');
  if(!l){if(a>=RET&&RET<42&&ret)return applyOffer(ret);return pickOffer()}// they retired by choice at this age; past a forced 42 the bot keeps going
  if(!l.pick)return pickOffer();const [kind,,tier]=l.pick.split(':');
  if(kind==='retire'&&ret)return applyOffer(ret);
  const same=o.filter(x=>x.kind===kind&&(kind!=='f1'||teamDef(x.teamId).tier===tier)).sort((x,y)=>(x.teamId?teamDef(y.teamId).machine-teamDef(x.teamId).machine:0));
  if(same.length)return applyOffer(same[0]);
  if(['stay','resign','option'].includes(kind)){const k=o.find(x=>['stay','resign','option'].includes(x.kind));if(k)return applyOffer(k)}
  pickOffer()}
const out={OLD:[],NEW:[]};
for(let i=0;i<${+N};i++){if(!warm())continue;plant();const snap=JSON.stringify(S);
  for(const [k,r] of [['OLD',OLD],['NEW',NEW]]){S=JSON.parse(snap);rules(r);const t0=S.p.tot.titles;let g=0;
    while(!S.p.retired&&g++<20){replaySeason();replayOffer()}
    const fa=S.p.history.filter(h=>h.lk==='F1'&&h.role==='race').map(h=>h.age);
    out[k].push({t:S.p.tot.titles-t0,last:Math.max(...fa),age:S.p.age})}}
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length,dist=a=>{const c={};a.forEach(x=>c[x]=(c[x]||0)+1);return c};
console.log('career ${cid}: real titles ${ret?ret.titles:'?'} (before ${at.age}: '+L.titles+'), planted at age ${at.age} OVR '+ovrOf(L.s0)+' pot '+L.pot);
for(const k of ['OLD','NEW']){const a=out[k];if(!a.length)continue;
  console.log(k,'runs',a.length,'titles from ${at.age} avg',avg(a.map(x=>x.t)).toFixed(2),'total avg',(L.titles+avg(a.map(x=>x.t))).toFixed(2),'dist',JSON.stringify(dist(a.map(x=>L.titles+x.t))),'last F1 race age avg',avg(a.map(x=>x.last)).toFixed(1),'42+',a.filter(x=>x.last>=42).length)}
`);
