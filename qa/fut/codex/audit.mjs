import fs from 'node:fs';
import crypto from 'node:crypto';
import {root,loadData,simulate,benchmark,day,index,warmup} from './independent.mjs';
const out=new URL('./',import.meta.url);
const save=(name,value)=>fs.writeFileSync(new URL(name,out),JSON.stringify(value,null,2)+'\n');
const {fut,spot}=loadData(),source=JSON.parse(fs.readFileSync(root+'qa/fut/CANDIDATES.json','utf8'));
const configs=source.list.map(({claude,...c})=>({...c,uni:source.universes[c.uni]||c.uni}));
const end=Object.values(fut.sym)[0].c.length-1,trainEnd=index('2024-12-31'),testStart=index('2025-01-01');
const searches=[1,2].map(n=>JSON.parse(fs.readFileSync(root+`qa/fut/search-${n}.json`,'utf8')));
function same(a,b){const fields=new Set([...Object.keys(a),...Object.keys(b)]);return [...fields].every(k=>['id','fut','startI'].includes(k)||JSON.stringify(a[k]||0)===JSON.stringify(b[k]||0));}
const schema={meta:{fut:{start:fut.start,asof:fut.asof,made:fut.made},spot:{start:spot.start,asof:spot.asof,made:spot.made},days:end+1,searches:searches.map(s=>({tested:s.tested,passed:s.passed,saved:s.top.length}))},files:{},symbols:{}};
for(const file of ['data/fut-daily.js','data/px-daily.js','data/build-fut.mjs','artifacts/teth-redesign/tools/fut-core.js','qa/fut/CANDIDATES.json','qa/fut/search-1.json','qa/fut/search-2.json'])schema.files[file]=crypto.createHash('sha256').update(fs.readFileSync(root+file)).digest('hex');
for(const [k,d]of Object.entries(fut.sym)){
  const flat=[],bad=[],zeroFunding=[];let maxFund=0,maxGap=0;
  for(let i=0;i<=end;i++){
    if(['o','h','l','c','f'].some(f=>!Number.isFinite(d[f][i]))||d.l[i]<=0||d.l[i]>Math.min(d.o[i],d.c[i])||d.h[i]<Math.max(d.o[i],d.c[i]))bad.push(i);
    if(d.o[i]===d.h[i]&&d.h[i]===d.l[i]&&d.l[i]===d.c[i])flat.push(i);
    if(d.f[i]===0)zeroFunding.push(i);
    maxFund=Math.max(maxFund,Math.abs(d.f[i]));if(i)maxGap=Math.max(maxGap,Math.abs(d.o[i]/d.c[i-1]-1));
  }
  schema.symbols[k]={lengths:Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v.length])),bad,flat,zeroFunding:zeroFunding.length,maxFundBp:maxFund,maxOpenGapPct:maxGap*100,first:d.c[0],last:d.c[end],spotFirst:spot.px[k][0],spotLast:spot.px[k][end]};
}
save('data-audit.json',schema);console.log('DATA',JSON.stringify(schema.meta));console.log('INTEGRITY',JSON.stringify(schema.symbols));
const rep=[];
for(let n=0;n<configs.length;n++){
  const c=configs[n],raw=source.list[n],reference=searches.flatMap(s=>s.top).find(x=>same(x.c,Object.fromEntries(Object.entries(raw).filter(([k])=>k!=='claude'))));
  const periods={};
  for(const [label,start] of Object.entries({full:101,y2:end+1-730,y1:end+1-365,train:101,test:testStart})){
    const e=label==='train'?trainEnd:end,r=simulate(c,fut,{start,end:e,trace:label==='full',fng:spot.fng});
    if(label==='full')save(`trace-${c.id}.json`,r);
    const keys=c.asset?[c.asset]:c.uni;
    const {eq,trades,orders,stale,mixHeld,fundingBreach,positions,cash,...summary}=r;
    periods[label]={...summary,spot:benchmark(keys,spot.px,r.start,e),perpetualProxy:benchmark(keys,Object.fromEntries(keys.map(k=>[k,fut.sym[k].c])),r.start,e),spotCommonStart:benchmark(keys,spot.px,start,e)};
  }
  const ref=reference?{full:{ret:reference.ret,mdd:reference.mdd},y1:{ret:reference.y1,mdd:reference.y1m},y2:{ret:reference.y2,mdd:reference.y2m},b:reference.b,b1:reference.b1,b2:reference.b2}:null;
  rep.push({id:c.id,config:c,claude:raw.claude,searchReference:ref,periods});
  console.log('REPL',c.id,JSON.stringify({ref,ours:Object.fromEntries(Object.entries(periods).map(([k,v])=>[k,[v.ret,v.mdd,v.start,v.spot.ret]]))}));
}
save('replication.json',rep);
export const STEPS={every:1,look:5,gate:.05,n:5,exitN:5,sl:5,trail:5,lev:1,reg:20,fast:1,slow:10,top:1,tp:5,hold:5,dip:2};
function valid(c){return (!c.gate||c.gate>=.5&&c.gate<=1)&&c.lev>=1&&c.lev<=10&&(!c.top||c.top>=1&&c.top<=4)&&(!c.every||c.every>=1)&&(!c.fast||c.fast>=1&&c.fast<c.slow)&&(!c.n||c.n>=1)&&(!c.look||c.look>=2);}
function neighbors(c,unit=false){const a=[];for(const [key,value]of Object.entries(c))if(typeof value==='number'&&key in STEPS){for(const dir of [-1,1]){const step=unit?(key==='gate'?.01:1):STEPS[key],v=+(value+dir*step).toFixed(5);if(v<0||(v===0&&!['exitN','sl','trail','reg','tp','hold'].includes(key)))continue;const next={...c,[key]:v};if(valid(next))a.push({key,from:value,to:v,config:next});}}return a;}
const median=xs=>{const v=[...xs].sort((a,b)=>a-b);return(v[Math.floor((v.length-1)/2)]+v[Math.floor(v.length/2)])/2;};
const neighborReport=[];
for(const c of configs){
  const sets={};for(const [label,unit]of [['coarse',false],['unit',true]]){
    const rows=neighbors(c,unit).map(n=>({...n,full:simulate(n.config,fut,{start:101}),test:simulate(n.config,fut,{start:testStart})}));
    const bench=rep.find(r=>r.id===c.id).periods.test.spot.ret;
    sets[label]={count:rows.length,fullMedian:median(rows.map(r=>r.full.ret)),fullMin:Math.min(...rows.map(r=>r.full.ret)),testMedian:median(rows.map(r=>r.test.ret)),testMin:Math.min(...rows.map(r=>r.test.ret)),testPositive:rows.filter(r=>r.test.ret>0).length,testBeat:rows.filter(r=>r.test.ret>bench).length,rows};
  }
  neighborReport.push({id:c.id,...sets});console.log('NEIGH',c.id,JSON.stringify(Object.fromEntries(Object.entries(sets).map(([k,{rows,...v}])=>[k,v]))));
}
save('neighbors.json',{steps:STEPS,results:neighborReport});
const sens=[];
for(const c of configs){
  const variants={base:{},literalStops:{literalStops:true},gapFirst:{gapFirst:true},markNotional:{markNotional:true},fundingRecheck:{fundingRecheck:true},fundingAtOpen:{fundingAtOpen:true},costDouble:{fee:.0011,slip:.001},cost5x:{fee:.00275,slip:.0025},noFunding:{fundingScale:0},fundingDouble:{fundingScale:2},mixScheduled:{refreshMix:'scheduled'},mixDaily:{refreshMix:'daily'}};
  sens.push({id:c.id,runs:Object.fromEntries(Object.entries(variants).map(([k,opt])=>[k,simulate(c,fut,{start:101,...opt})]))});
}
save('sensitivity.json',sens);
// Train-only grid: no saved search winners or test scores enter selection.
// Within each fixed family/asset/universe, rank by train Calmar. Also select the
// max of median(train Calmar of the centre and its one-coordinate neighbours).
function product(base,grid){let all=[base];for(const [k,vs]of Object.entries(grid))all=all.flatMap(c=>vs.map(v=>({...c,[k]:v})));return all.filter(valid);}
function trainScore(r){const yrs=(r.end-r.start)/365,cagr=(Math.max(.000001,1+r.ret/100)**(1/yrs)-1)*100;return r.n>=5?cagr/Math.max(10,-r.mdd):-1e6;}
const wf=[];
for(const c of configs){
  let grid;
  if(c.kind==='mix')grid={every:[3,5,7],look:[20,45,60,90],gate:[.5,.63,.75,.88],n:[5,10,20,35,55],exitN:[5,10,15,20],sl:[5,10,15],trail:[15,20,25],lev:[1]};
  else if(c.kind==='agent')grid={every:[2,3,4,5,7],look:[15,20,30,45,60],top:[1,2,3],gate:[.5,.63,.75,.88],sl:[0,10,15],lev:[1]};
  else if(c.mode==='brk')grid={n:[20,35,55,75],exitN:[5,10,15,20],trail:[10,15,20,25],reg:[100,150,200],lev:[1,2,3]};
  else grid={fast:[5,7,10,15,20],slow:[60,80,100,120,150],trail:[0,10,15,20,25],lev:[1,2]};
  // Normalize absent numeric fields to zero and deduplicate before scoring.
  const signature=c=>JSON.stringify(Object.keys(grid).map(k=>c[k]||0));
  const pool=[...new Map([...product(c,grid),c].map(x=>{const config={...x};for(const k of Object.keys(grid))config[k]??=0;return [signature(config),config];})).values()];
  let rawWinner=null;
  const scored=pool.map(config=>{const train=simulate(config,fut,{start:101,end:trainEnd});const score=trainScore(train);return {config,train,score};}).sort((a,b)=>b.score-a.score);
  rawWinner=scored[0];
  // Neighbour criterion on all candidates, not a shortlist selected using test data.
  // Use grid-coordinate adjacent scores so evaluation is bounded and reproducible.
  const lookup=new Map(scored.map(r=>[signature(r.config),r]));
  for(const r of scored){const scores=[r.score];for(const [key,values] of Object.entries(grid)){const pos=values.indexOf(r.config[key]);for(const offset of [-1,1]){const val=values[pos+offset];if(val===undefined)continue;const x=lookup.get(signature({...r.config,[key]:val}));if(x)scores.push(x.score);}}r.robustScore=median(scores);}
  scored.sort((a,b)=>b.robustScore-a.robustScore||b.score-a.score);
  const robust=scored[0];
  const evaluate=r=>({...r,full:simulate(r.config,fut,{start:101}),test:simulate(r.config,fut,{start:testStart}),y1:simulate(r.config,fut,{start:end+1-365}),y2:simulate(r.config,fut,{start:end+1-730})});
  const row={id:c.id,tested:pool.length,originalTrain:rep.find(x=>x.id===c.id).periods.train,originalTest:rep.find(x=>x.id===c.id).periods.test,rawWinner:evaluate(rawWinner),robustWinner:evaluate(robust),trainTop10:scored.slice(0,10)};
  wf.push(row);save('walk-forward.json',{trainStart:101,trainEnd,testStart,end,criterion:'train annualized return / max(10%,abs(MDD)); >=5 closed trades; robust=median grid-neighbour scores',results:wf});
  console.log('WF',c.id,JSON.stringify({tested:row.tested,raw:row.rawWinner,robust:row.robustWinner}));
}
