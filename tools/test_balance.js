const el=()=>({classList:{toggle(){},add(){},remove(){}},addEventListener(){},querySelectorAll(){return[]},set innerHTML(v){},hidden:false,click(){}});
global.Image=function(){};global.document={getElementById:()=>el(),createElement:()=>({getContext:()=>null}),fonts:null,body:{appendChild(){}}};
global.window={scrollTo(){}};global.localStorage={getItem(){return null},setItem(){},removeItem(){}};
const fs=require('fs');eval(fs.readFileSync(require('path').join(__dirname,'../build/game.js'),'utf8')+`
let smart=false; // half the careers take the recommended program whenever it can change, half keep the style's program
function quickSeason(){S.train=S.p.morale<40?'rest':'focus';if(trOpen()){if(smart)setProg(recProg().id);S.progYear=S.year;S.progFree=null}startSeason();if(S.season.gacha)resolveGacha(Math.random()<.5);S.season.incidents.forEach(i=>applyIncident(i,ri(0,1)));finishSeason()}

let res={n:0,f1:0,ch1:0,ch5:0,debut:[],seasons:0};
for(let i=0;i<300;i++){smart=i%2===0;
  const st=styleStats(45,'racer');newGame({name:'T',num:7,nat:'KOR',helmet:'#fff',style:'racer',stats:st,focus:['race','quali']});
  let guard=0;
  while(!S.p.retired&&guard++<40){quickSeason();
    const o=S.offers;const pr=x=>({f1:0,resign:1,junior:x.tag==='월반'?2:x.tag==='아카데미'?2.5:x.tag==='승격'?3:5,reserve:6,alt:7,retire:9}[x.kind]);
    const best=[...o].sort((a,b)=>{if(a.kind==='f1'&&b.kind==='f1')return teamDef(b.teamId).machine-teamDef(a.teamId).machine;return pr(a)-pr(b)})[0];
    if(best.kind==='retire'&&S.p.age<38&&o.length>1){applyOffer(o.find(x=>x.kind!=='retire'))}else applyOffer(best);}
  res.n++;(res.pk=res.pk||[]).push(S.p.peak);(res.pot=res.pot||[]).push(S.p.potential);(res.w=res.w||[]).push(S.p.tot.wins);if(S.p.debutYear){res.f1++;res.debut.push(S.p.debutYear-S.startYear+14)}
  if(S.p.tot.titles>=1)res.ch1++;if(S.p.tot.titles>=5)res.ch5++;
}
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const q=(a,p)=>[...a].sort((x,y)=>x-y)[Math.floor(a.length*p)];console.log('peak p10/50/90',q(res.pk,.1),q(res.pk,.5),q(res.pk,.9),'pot med',q(res.pot,.5),'wins med/p90',q(res.w,.5),q(res.w,.9));console.log('F1 debut',res.f1/res.n,'champ1+',res.ch1/res.n,'champ5+',res.ch5/res.n,'debut age avg',avg(res.debut).toFixed(1));
`);
