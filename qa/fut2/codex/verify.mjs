import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {loadData,simulate,benchmark,stats,index,day,intraday,liquidation} from './independent.mjs';
const out='qa/fut2/codex/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const input=read('qa/fut2/CANDIDATES.json'), {fut,spot}=loadData();
const list=input.list.slice().sort((a,b)=>+a.id.slice(1)-+b.id.slice(1));
const END=index('2026-09-28'), CUT=index('2025-01-01'), START=101;
const config=c=>({...c,uni:typeof c.uni==='string'?input.universes[c.uni]:c.uni});
const run=(c,opt={})=>simulate(config(c),fut,{start:START,fng:spot.fng,...opt});
const keys=c=>c.asset?[c.asset]:input.universes[c.uni];
const bench=(c,a=START,b=END)=>benchmark(keys(c),spot.px,a,b);
const brief=r=>({ret:r.ret,mdd:r.mdd,n:r.n,liq:r.liq,start:r.start,fees:r.fees,funding:r.funding,openFunding:r.openFunding});
function segment(eq,a,b,previous=true){
 const base=previous?(eq.filter(x=>x.i<a).at(-1)?.v??1):(eq.find(x=>x.i>=a)?.v??1);
 return stats(eq.filter(x=>x.i>=a&&x.i<=b).map(x=>({...x,v:x.v/base})));
}
function summary(rows){return {n:rows.length,positive:rows.filter(x=>x.ret>0).length,beat:rows.filter(x=>x.ret>x.spot.ret).length,both:rows.filter(x=>x.ret>0&&x.ret>x.spot.ret).length,ret:[Math.min(...rows.map(x=>x.ret)),Math.max(...rows.map(x=>x.ret))],mdd:[Math.min(...rows.map(x=>x.mdd)),Math.max(...rows.map(x=>x.mdd))],minExcess:Math.min(...rows.map(x=>x.ret-x.spot.ret))};}
const hashes={};
for(const p of ['data/fut-daily.js','data/px-daily.js','artifacts/teth-redesign/tools/fut-core.js','artifacts/teth-redesign/tools/agent-core.js','qa/fut2/CANDIDATES.json'])hashes[p]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
// Oracle exists only here, never inside the independent simulator.
const box={window:{},idxToDate:i=>new Date(Date.UTC(2023,0,1)+i*86400000)};
vm.createContext(box);
for(const p of ['data/fut-daily.js','data/px-daily.js','artifacts/teth-redesign/tools/agent-core.js','artifacts/teth-redesign/tools/fut-core.js'])vm.runInContext(fs.readFileSync(p,'utf8'),box);
box.TETH_FUT=box.window.TETH_FUT;box.TETH_PX=box.window.TETH_PX;
const searches=['qa/fut/search-3-robust-ai.json','qa/fut/search-4-robust-rule.json'].map(read);
const match=(a,b)=>[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>!['id','claude'].includes(k)).every(k=>(a[k]??0)===(b[k]??0));
const results={hashes,dates:{start:day(START),cut:day(CUT),end:day(END)},searches:searches.map(x=>({tested:x.tested,passed:x.passed})),strategies:[],phases:[],neighbors:[],alternatives:[],tests:[]};
for(const c of list){
 const r=run(c,{trace:true}), ref=box.mkFutRun({...config(c),startI:START});
 const err=Math.max(...r.eq.map((e,i)=>Math.abs(e.v-ref.eq[i].v)));
 assert.ok(err<1e-9,`${c.id} equity ${err}`);assert.ok(Math.abs(r.funding-ref.fundPaid)<1e-9);
 const refSearch=searches.flatMap(x=>x.top).find(x=>match(c,x.c));
 const actual=r.risk.filter(x=>x.source!=='bar-envelope'), envelope=r.risk.filter(x=>x.source==='bar-envelope');
 const worst=actual.toSorted((a,b)=>b.adverse-a.adverse)[0], closest=actual.toSorted((a,b)=>a.gapPctPrice-b.gapPctPrice)[0];
 const row={id:c.id,c,full:brief(r),claude:c.claude,oracle:{ret:ref.ret,mdd:ref.mdd,maxEquityError:err},train:segment(r.eq,START,CUT-1),test:segment(r.eq,CUT,END),claudeBoundaryTest:segment(r.eq,CUT,END,false),search:refSearch??null,spot:bench(c),spotActual:bench(c,r.start),spotTrain:bench(c,START,CUT-1),spotTest:bench(c,CUT-1,END),stress:brief(run(c,{fee:.00055*3,slip:.0005*3,fundingScale:2})),lower:c.lev>1?brief(run({...c,lev:c.lev-1})):null,risk:{worst,closest,envelopeWorst:envelope.toSorted((a,b)=>b.adverse-a.adverse)[0],envelopeClosest:envelope.toSorted((a,b)=>a.gapPctPrice-b.gapPctPrice)[0]},fundingAtOpen:brief(run(c,{fundingAtOpen:true})),markModel:brief(run(c,{markNotional:true})),mixRefresh:c.kind==='mix'?brief(run(c,{refreshMix:'scheduled'})):null};
 results.strategies.push(row);
 fs.writeFileSync(out+'trace-'+c.id+'.json',JSON.stringify({eq:r.eq,trades:r.trades,orders:r.orders,positions:r.positions,risk:r.risk}));
 if(c.kind!=='rule'){
  const full=[];for(let ph=0;ph<c.every;ph++){const q=run({...c,ph},{trace:true});full.push({ph,...brief(q),train:segment(q.eq,START,CUT-1),test:segment(q.eq,CUT,END),searchTest:segment(q.eq,CUT,END,false),spot:bench(c)});}
  const fresh=[];for(const horizon of [365,730])for(let shift=-7;shift<=7;shift++)for(let ph=0;ph<c.every;ph++){const start=END-horizon+shift,q=run({...c,ph},{start});fresh.push({horizon,shift,ph,date:day(start),...brief(q),spot:bench(c,start)});}
  results.phases.push({id:c.id,full,fullSummary:summary(full),fresh,summaries:[365,730].map(horizon=>({horizon,earlier:summary(fresh.filter(x=>x.horizon===horizon&&x.shift<=0)),later:summary(fresh.filter(x=>x.horizon===horizon&&x.shift>=0)),both:summary(fresh.filter(x=>x.horizon===horizon))}))});
 }
 for(const scheme of ['broad','fine']){
  const step=scheme==='broad'?{every:1,look:10,gate:.12,top:1,n:5,exitN:3,fast:2,slow:15,trail:3,sl:3,reg:30,lev:1}:{every:1,look:1,gate:.01,top:1,n:1,exitN:1,fast:1,slow:1,trail:1,sl:1,reg:1,lev:1};
  const rows=[];
  for(const [k,v]of Object.entries(c))if(typeof v==='number'){
   assert.ok(step[k],`unknown numeric ${k}`);
   for(const sign of [-1,1]){
    const val=+(v+sign*step[k]).toFixed(8);if(val<=0||(k==='gate'&&val>1)||(k==='top'&&val>4)||(k==='lev'&&val>10))continue;
    const q={...c,[k]:val},r2=run(q,{trace:true});
    rows.push({parameter:k,value:val,...brief(r2),train:segment(r2.eq,START,CUT-1),test:segment(r2.eq,CUT,END),spot:bench(q),spotActual:bench(q,r2.start)});
   }
  }
  results.neighbors.push({id:c.id,scheme,summary:summary(rows),testPositive:rows.filter(x=>x.test.ret>0).length,testBeat:rows.filter(x=>x.test.ret>bench(c,CUT-1,END).ret).length,rows});
 }
 console.log(c.id,JSON.stringify({r:brief(r),train:row.train,test:row.test,spot:row.spot.ret,stress:row.stress,lower:row.lower,worst,closest}));
}
// Validate changed gap ordering and accounting with independent synthetic cases.
const p={s:1,q:2,entry:100,margin:100,funding:0,enter:1,best:100};
assert.deepEqual(intraday(p,{i:2,o:40,h:100,l:30},{sl:10}),{price:40,why:'liq',raw:true});
assert.deepEqual(intraday(p,{i:2,o:130,h:140,l:50},{sl:10,tp:20}),{price:130,why:'tp',raw:true});
const ps={...p,s:-1};assert.equal(intraday(ps,{i:2,o:160,h:170,l:100},{sl:10}).price,160);
assert.equal(intraday(ps,{i:2,o:70,h:150,l:60},{sl:10,tp:20}).price,70);
assert.equal(intraday(p,{i:2,o:100,h:130,l:85},{sl:10,tp:20}).why,'sl');
results.tests.push('five gap/stop-order synthetic assertions passed','ten full daily equity curves and open+closed funding matched independent vs current engine');
// Causality check: future mutation cannot change earlier equity.
const altered=structuredClone(fut),boundary=CUT;
for(const d of Object.values(altered.sym))for(let i=boundary+1;i<=END;i++){for(const k of ['o','h','l','c'])d[k][i]*=2;d.f[i]*=-3;}
for(const c of list){const before=run(c,{trace:true}),after=simulate(config(c),altered,{start:START,trace:true,fng:spot.fng});assert.deepEqual(before.eq.filter(x=>x.i<=boundary),after.eq.filter(x=>x.i<=boundary));}
results.tests.push('ten future-mutation causality assertions passed');
for(const c of list.filter(c=>c.lev>1))for(let lev=1;lev<c.lev;lev++){
 const q={...c,lev},r=run(q,{trace:true});results.alternatives.push({id:c.id,change:{lev},full:brief(r),train:segment(r.eq,START,CUT-1),test:segment(r.eq,CUT,END),stress:brief(run(q,{fee:.00055*3,slip:.0005*3,fundingScale:2}))});
}
fs.writeFileSync(out+'results.json',JSON.stringify(results,null,2));
console.log('PHASES',JSON.stringify(results.phases.map(x=>({id:x.id,full:x.fullSummary,fresh:x.summaries}))));
console.log('NEIGHBORS',JSON.stringify(results.neighbors.map(x=>({id:x.id,scheme:x.scheme,...x.summary,testPositive:x.testPositive}))));
