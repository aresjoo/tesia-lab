import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadData,simulate,signal,ranking,intraday,liquidation,positionValue,stats}from './independent.mjs';
const {fut}=loadData(),read=f=>JSON.parse(fs.readFileSync(new URL(f,import.meta.url),'utf8'));
const candidates=read('replication.json').map(r=>r.config),tests=[];
const test=(name,fn)=>{const evidence=fn();tests.push({name,pass:true,evidence});};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const p={entry:100,margin:1,q:.02,s:1,funding:0,best:110,enter:100};
test('long / short funding sign and entry-notional liquidation algebra',()=>{
 const a=liquidation(p),short={...p,s:-1};near(a,50.5);near(liquidation(short),149.5);
 near(positionValue(p,a),.005*p.q*p.entry);
 near(liquidation({...p,funding:.01}),51);near(liquidation({...short,funding:-.01}),150);
 return {long:a,short:liquidation(short),markNotionalLong:liquidation(p,.005,true),markNotionalShort:liquidation(short,.005,true)};
});
test('same bar stop / take profit: stop first, new position included',()=>{
 const bar={i:100,o:100,h:120,l:80},r=intraday(p,bar,{sl:10,tp:10});assert.equal(r.why,'sl');near(r.price,90);
 const short=intraday({...p,s:-1},bar,{sl:10,tp:10});assert.equal(short.why,'sl');near(short.price,110);return {long:r,short};
});
test('trailing stop uses previous best close; disabled on entry bar',()=>{
 const bar={i:100,o:100,h:120,l:91};assert.equal(intraday(p,bar,{trail:10}),null);
 const next=intraday(p,{...bar,i:101},{trail:10});assert.equal(next.why,'trail');near(next.price,99);return next;
});
test('gap through stop: fill at open; open beyond liquidation gets wrongly classified as stop',()=>{
 const ordinary=intraday(p,{i:101,o:85,h:90,l:80},{sl:10});near(ordinary.price,85);
 const bar={i:101,o:50.2,h:60,l:49},base=intraday(p,bar,{sl:10}),fixed=intraday(p,bar,{sl:10},{gapFirst:true});
 assert.equal(base.why,'sl');assert.equal(fixed.why,'liq');
 const optimisticProceeds=Math.max(0,positionValue(p,base.price*(1-.0005))-p.q*base.price*(1-.0005)*.00055);
 assert.ok(optimisticProceeds>0);return {ordinary,base,fixed,optimisticProceeds};
});
test('favorable TP gap precedes later stop: engine chronology violates limit resting at open',()=>{
 const bar={i:101,o:115,h:120,l:85},base=intraday(p,bar,{sl:10,tp:10}),chronological=intraday(p,bar,{sl:10,tp:10},{gapFirst:true});
 assert.equal(base.why,'sl');assert.equal(chronological.why,'tp');return {base,chronological};
});
test('fee charged on notional, allocation includes opening fee',()=>{
 const amount=1,lev=3,rate=.00055,margin=amount/(1+lev*rate),units=margin*lev/100,fee=amount-margin;
 near(fee,units*100*rate);near(margin+fee,amount);return {margin,units,fee};
});
test('breakout inclusive channel contains exactly n previous highs',()=>{
 const d={c:[1,1,1,5,6],h:[100,2,3,5,6],l:[1,1,1,1,1]};
 assert.equal(signal({mode:'brk',n:2},d,3),1);assert.equal(signal({mode:'brk',n:3},d,3),0);
 return {n2:'indices 1,2 exclude index 0 and decision-day index 3',n3:'indices 0,1,2 includes old high 100'};
});
test('causality: future suffix mutation and decision-day agent rankings',()=>{
 const evidence=[];
 for(const c of candidates){for(const cut of [500,900,1200]){
  const base=simulate(c,fut,{trace:true}),changed=structuredClone(fut);
  for(const [key,d]of Object.entries(changed.sym))for(let i=cut+1;i<d.c.length;i++){
   const factor=1.5+(i%7)*.03;for(const field of ['o','h','l','c'])d[field][i]*=factor;d.f[i]*=-10;
  }
  const other=simulate(c,changed,{trace:true});
  assert.deepEqual(other.eq.filter(x=>x.i<=cut),base.eq.filter(x=>x.i<=cut));
  const decisions=run=>run.orders.filter(x=>x.decision<=cut).map(({decision,fill,k,side})=>({decision,fill,k,side}));assert.deepEqual(decisions(other),decisions(base));
  if(c.kind==='agent')assert.deepEqual(ranking(c,changed,cut),ranking(c,fut,cut));
  evidence.push({id:c.id,cut,ok:true});
 }}return evidence;
});
test('funding after last intraday check can breach margin without liquidation',()=>{
 const N=106,a=Array(N).fill(100),d={o:[...a],h:a.map(v=>v+1),l:a.map(v=>v-1),c:[...a],f:Array(N).fill(0)};
 d.c[101]=102;d.h[101]=103;d.o[102]=102;d.c[102]=102;d.h[102]=103;d.l[102]=101;d.f[102]=600;
 // 10x: 6% funding leaves equity 0.4, then another 4% crosses maintenance at the close.
 d.o[103]=d.c[103]=102;d.h[103]=103;d.l[103]=101;d.f[103]=400;
 const data={sym:{A:d}},c={asset:'A',kind:'rule',mode:'brk',n:2,lev:10};
 const base=simulate(c,data,{start:101,end:103,trace:true}),fixed=simulate(c,data,{start:101,end:103,trace:true,fundingRecheck:true});
 assert.ok(base.fundingBreach.length);assert.equal(base.liq,0);assert.equal(fixed.liq,1);return {base:{ret:base.ret,liq:base.liq,breach:base.fundingBreach},fixed:{ret:fixed.ret,liq:fixed.liq}};
});
const windowPhase=[];
for(const c of candidates){const rows=[];for(let offset=-7;offset<=7;offset++){
 const r=simulate(c,fut,{start:1002+offset});rows.push({offset,ret:r.ret,mdd:r.mdd});}
 windowPhase.push({id:c.id,rows,min:Math.min(...rows.map(x=>x.ret)),max:Math.max(...rows.map(x=>x.ret))});}
fs.writeFileSync(new URL('attacks.json',import.meta.url),JSON.stringify({note:'Tests exercise independent model and documented source branches; project engine is never executed.',tests,windowPhase},null,2));
console.log('PASS',tests.length,'tests; causality',tests.find(t=>t.name.startsWith('causality')).evidence.length,'prefix comparisons');
console.log(JSON.stringify(windowPhase.map(({rows,...x})=>x)));
