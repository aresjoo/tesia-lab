import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {loadData,simulate,benchmark,stats,index,day} from './independent.mjs';
const out='qa/fut2/codex/',{fut,spot}=loadData(),input=JSON.parse(fs.readFileSync('qa/fut2/CANDIDATES.json'));
const base=JSON.parse(fs.readFileSync(out+'results.json')),END=1366,CUT=index('2025-01-01');
const conf=c=>({...c,uni:typeof c.uni==='string'?input.universes[c.uni]:c.uni});
const run=(c,opt={})=>simulate(conf(c),fut,{start:101,...opt});
const brief=r=>({ret:r.ret,mdd:r.mdd,n:r.n,liq:r.liq,start:r.start});
const stress=c=>run(c,{fee:.00165,slip:.0015,fundingScale:2});
const seg=(eq,a,b)=>{const v0=eq.filter(x=>x.i<a).at(-1)?.v??1;return stats(eq.filter(x=>x.i>=a&&x.i<=b).map(x=>({...x,v:x.v/v0})));};
const extra={phaseStress:[],parameterCounts:[],neighborAllPhases:[],replacement:null,replacementExploration:[],dataAudit:[],leverage:[],searchBoundaryAudit:[]};
for(const c of input.list){
 const r=run(c,{trace:true});
 assert.ok(Math.abs((1+seg(r.eq,101,CUT-1).ret/100)*(1+seg(r.eq,CUT,END).ret/100)-(1+r.ret/100))<1e-10);
 if(c.kind!=='rule')for(let ph=0;ph<c.every;ph++)extra.phaseStress.push({id:c.id,ph,...brief(stress({...c,ph}))});
 const nb=base.neighbors.find(x=>x.id===c.id&&x.scheme==='broad');
 if(c.kind!=='rule'){
  const rows=nb.rows.map(n=>{const q={...c,[n.parameter]:n.value},runs=Array.from({length:q.every},(_,ph)=>run({...q,ph}));return {parameter:n.parameter,value:n.value,minRet:Math.min(...runs.map(x=>x.ret)),worstMDD:Math.min(...runs.map(x=>x.mdd))};});
  const sp=base.strategies.find(x=>x.id===c.id).spot.ret;
  extra.neighborAllPhases.push({id:c.id,n:rows.length,allProfitable:rows.filter(x=>x.minRet>0).length,allBeatSpot:rows.filter(x=>x.minRet>sp).length,rows});
 }
 for(const p of new Set(nb.rows.map(x=>x.parameter))){const rows=nb.rows.filter(x=>x.parameter===p);extra.parameterCounts.push({id:c.id,parameter:p,values:rows.map(x=>x.value),n:rows.length,positive:rows.filter(x=>x.ret>0).length,beat:rows.filter(x=>x.ret>x.spot.ret).length,testPositive:rows.filter(x=>x.test.ret>0).length});}
 if(c.lev>1){
  // Intraday loss from that day's open (new fills use the slippage-adjusted entry).
  const rows=r.risk.filter(x=>x.source!=='bar-envelope').map(x=>({...x,dailyAdverse:Math.max(0,-x.side*(x.price/(x.enter===x.i?x.entry:fut.sym[x.k].o[x.i])-1)*100)}));
  extra.leverage.push({id:c.id,dailyWorst:rows.toSorted((a,b)=>b.dailyAdverse-a.dailyAdverse)[0]});
 }
 const source=base.strategies.find(x=>x.id===c.id).search;
 const phases=Array.from({length:c.every||1},(_,ph)=>run({...c,ph},{trace:true}));
 const boundary=eq=>{const v0=eq.find(x=>x.i>=CUT).v;return stats(eq.filter(x=>x.i>=CUT).map(x=>({...x,v:x.v/v0})));};
 const minTrain=Math.min(...phases.map(x=>seg(x.eq,101,CUT-1).ret)),minTest=Math.min(...phases.map(x=>boundary(x.eq).ret)),worstTest=Math.min(...phases.map(x=>boundary(x.eq).mdd));
 assert.ok(Math.abs(source.tr-minTrain)<1e-8);assert.ok(Math.abs(source.te-minTest)<1e-8);assert.ok(Math.abs(source.teM-worstTest)<1e-8);
 extra.searchBoundaryAudit.push({id:c.id,claude:{train:source.tr,test:source.te,mdd:source.teM},independentSameDefinition:{train:minTrain,test:minTest,mdd:worstTest}});
}
// Minimal f10 replacement: one-day-longer exit channel, reduce 3x to 2x.
const original=input.list.find(c=>c.id==='f10'),candidate={...original,exitN:6,lev:2};delete candidate.claude;
for(const exitN of [6,7,8,10])for(const lev of [1,2,3]){const q={...original,exitN,lev};extra.replacementExploration.push({exitN,lev,full:brief(run(q)),stress:brief(stress(q))});}
const r=run(candidate,{trace:true}),neighbors=[];
for(const [key,step]of Object.entries({n:5,exitN:1,trail:3,reg:30,lev:1}))for(const sign of [-1,1]){const q={...candidate,[key]:candidate[key]+sign*step};neighbors.push({parameter:key,value:q[key],...brief(run(q)),stress:brief(stress(q))});}
const restarts=[];for(const horizon of [365,730])for(let shift=-7;shift<=7;shift++)restarts.push({horizon,shift,...brief(run(candidate,{start:END-horizon+shift}))});
extra.replacement={c:candidate,full:brief(r),train:seg(r.eq,101,CUT-1),test:seg(r.eq,CUT,END),stress:brief(stress(candidate)),spot:benchmark([candidate.asset],spot.px,101,END),spotActual:benchmark([candidate.asset],spot.px,r.start,END),neighbors,restarts};
for(const [k,d]of Object.entries(fut.sym)){
 for(const field of ['o','h','l','c','f'])assert.equal(d[field].length,1367);
 for(let i=0;i<=END;i++){assert.ok([d.o[i],d.h[i],d.l[i],d.c[i],d.f[i]].every(Number.isFinite));assert.ok(d.l[i]>0&&d.l[i]<=Math.min(d.o[i],d.c[i])&&d.h[i]>=Math.max(d.o[i],d.c[i]));assert.ok(spot.px[k][i]>0);}
 extra.dataAudit.push({asset:k,days:d.c.length,validOHLC:true});
}
// A queued next-open exit still runs before the new gap-liquidation branch.
const d={o:Array(104).fill(100),h:Array(104).fill(101),l:Array(104).fill(99),c:Array(104).fill(100),f:Array(104).fill(0)};
d.c[100]=99;d.c[101]=101;d.o[102]=101;d.c[102]=90;d.l[102]=90;d.h[102]=101;d.o[103]=51;d.c[103]=51;d.h[103]=52;d.l[103]=50;
const synthetic={kind:'rule',asset:'X',mode:'ma',fast:1,slow:2,lev:2,startI:101};
const gapBox={window:{TETH_FUT:{sym:{X:d}}},idxToDate:i=>new Date(Date.UTC(2023,0,1)+i*86400000)};
vm.createContext(gapBox);gapBox.TETH_FUT=gapBox.window.TETH_FUT;
for(const path of ['artifacts/teth-redesign/tools/agent-core.js','artifacts/teth-redesign/tools/fut-core.js'])vm.runInContext(fs.readFileSync(path,'utf8'),gapBox);
const gr=gapBox.mkFutRun(synthetic),gi=simulate(synthetic,{sym:{X:d}},{start:101,trace:true});
assert.equal(gr.liqN,0);assert.equal(gr.trades[0].kind,'flip');assert.ok(Math.abs(gr.trades[0].got-gi.trades[0].got)<1e-12);
extra.queuedGapCounterexample={config:synthetic,open:51,liquidation:gi.risk.find(x=>x.i===103&&x.id===1).liq,reportedKind:gr.trades[0].kind,reportedLiquidations:gr.liqN,recoveredCapital:gr.trades[0].got,affectedOriginalStrategies:base.strategies.filter(x=>x.risk.closest.gapPctPrice<=0).map(x=>x.id)};
fs.writeFileSync(out+'extra.json',JSON.stringify(extra,null,2));
console.log(JSON.stringify(extra.replacement,null,1));
console.log('LEVERAGE',JSON.stringify(extra.leverage));
