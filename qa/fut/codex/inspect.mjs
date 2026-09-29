import fs from 'node:fs';
import {root,loadData,simulate,day}from './independent.mjs';
const {fut}=loadData(),read=f=>JSON.parse(fs.readFileSync(new URL(f,import.meta.url),'utf8'));
const rep=read('replication.json'),wf=read('walk-forward.json'),sens=read('sensitivity.json');
const rows=[];
for(const r of rep){
 const windows={};for(const [key,n]of [['y2',730],['y1',365]]){const ref=r.searchReference?.[key];const start=1366-n;
  const exact=simulate(r.config,fut,{start});windows[key]={start,date:day(start),bars:n+1,result:exact,reference:ref,diff:ref?[exact.ret-ref.ret,exact.mdd-ref.mdd]:null};}
 rows.push({id:r.id,windows});
 const tr=read(`trace-${r.id}.json`),w=wf.results.find(x=>x.id===r.id),s=sens.find(x=>x.id===r.id);
 console.log(JSON.stringify({id:r.id,windows,stale:tr.stale.length?{count:tr.stale.length,mismatch:tr.stale.filter(x=>x.mismatch),maxAge:Math.max(...tr.stale.map(x=>x.age))}:null,closed:tr.n,longs:tr.trades.filter(t=>t.side>0).length,shorts:tr.trades.filter(t=>t.side<0).length,liq:tr.liq,fundBreach:tr.fundingBreach.length,funding:tr.funding,reportedFunding:tr.reportedFunding,sens:Object.fromEntries(Object.entries(s.runs).map(([k,v])=>[k,[v.ret,v.mdd]])),wf:{raw:[w.rawWinner.config,w.rawWinner.test.ret,w.rawWinner.test.mdd],robust:[w.robustWinner.config,w.robustWinner.test.ret,w.robustWinner.test.mdd]}}));
}
fs.writeFileSync(new URL('window-reconciliation.json',import.meta.url),JSON.stringify(rows,null,2));
