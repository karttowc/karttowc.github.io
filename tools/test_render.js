const el=()=>({classList:{toggle(){},add(){},remove(){}},addEventListener(){},querySelectorAll(){return[]},set innerHTML(v){},hidden:false,click(){}});
global.Image=function(){};global.document={getElementById:()=>el(),createElement:()=>({getContext:()=>null}),fonts:null,body:{appendChild(){}}};
global.window={scrollTo(){}};global.localStorage={getItem(){return null},setItem(){},removeItem(){}};global.setTimeout=()=>0;global.clearTimeout=()=>0;
const fs=require('fs');eval(fs.readFileSync(require('path').join(__dirname,'../build/game.js'),'utf8')+`
function quickSeason(){S.train=S.p.morale<40?'rest':'focus';if(S.train==='focus'){const r=recStats()[0].k;S.p.focus=[r,...S.p.focus.filter(k=>k!==r)].slice(0,2)}startSeason();if(S.season.gacha)resolveGacha(Math.random()<.5);S.season.incidents.forEach(i=>applyIncident(i,ri(0,1)));finishSeason()}

for(let run=0;run<200;run++){
newGame({name:'T',num:7,nat:'KOR',helmet:randomHelmet(),style:'racer',stats:styleStats(45,'racer'),focus:['race']});
let g=0;while(!S.p.retired&&g++<35){
  titleView();hofOpen=true;titleView();hofOpen=false;homeTab();reactTab();paddockTab();driverTab();recordsTab();newsTab='team';try{if(S.news)newsByTeam(S.news)}catch(e){console.log(e);process.exit(1)};for(const sh of ['st_rep','st_fans','rsv_','st_race','st_wet','go','stand','news',{type:'tbrief',id:'ferrari'},'train','ch','menu','retire',...S.events.map((_,i)=>'ev'+i)]){sheet=sh;try{if(sh!=='news'||S.news)sheetView()}catch(e){console.log('sheet',sh,e.message);process.exit(1)}}sheet=null;
  if(S.challenge&&Math.random()<.5)runChallenge();
  while(S.events.length){const e=evDef(S.events[0].id);applyEff(e.choices[0].eff);S.events.shift()}
  S.train='focus';startSeason();progressView();describe(roundInfo(0));stepper();if(S.season.gacha)resolveGacha(true);S.season.incidents.forEach(i=>applyIncident(i,0));finishSeason();homeTab();homeTab();S.phase='offers';homeTab();S.offers.forEach((x,i)=>{if(offerTeam(x)){sheet={type:'brief',i};sheetView()}});sheet=null;
  const o=S.offers;applyOffer(o.find(x=>x.kind==='f1')||o.find(x=>x.kind==='resign')||o[0]);
}
recordsTab();cardData();retiredView();for(let i=0;i<5;i++)cerPage(i);shareText();}
console.log('render ok', S.p.history.length, S.p.tot, S.p.challenges.length);
`);
