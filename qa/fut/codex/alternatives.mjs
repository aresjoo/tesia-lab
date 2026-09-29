// Exploratory follow-up, explicitly NOT untouched holdout validation.
import fs from 'node:fs';
import {simulate,loadData,stats}from './independent.mjs';
const {fut}=loadData(),read=f=>JSON.parse(fs.readFileSync(new URL(f,import.meta.url),'utf8'));
const rep=read('replication.json'),neighbors=read('neighbors.json').results,wf=read('walk-forward.json');
const trials=[];
for(const r of rep){
 const pool=[{label:'original',config:r.config},...neighbors.find(n=>n.id===r.id).coarse.rows.map(n=>({label:n.key+'='+n.to,config:n.config})),{label:'wf-robust-1x',config:{...wf.results.find(w=>w.id===r.id).robustWinner.config,lev:1}}];
 if(r.id==='f9'||r.id==='f10')for(const every of [3,4,5,7])for(const look of [20,30,45])for(const top of [2,3])for(const gate of [.75,.88])pool.push({label:'exploratory-grid',config:{...r.config,every,look,top,gate,lev:1}});
 const rows=pool.map(({label,config})=>{
  const full=simulate(config,fut),test=simulate(config,fut,{start:731}),y1=simulate(config,fut,{start:1002}),phase=[];
  for(let shift=0;shift<(config.every||1);shift++)phase.push(simulate(config,fut,{start:1002+shift}).ret);
  return {label,config,full,test,y1,phaseMin:Math.min(...phase),phaseMax:Math.max(...phase)};
 });
 trials.push({id:r.id,rows});
 console.log(r.id,JSON.stringify(rows.filter(x=>x.label!=='exploratory-grid').map(x=>({label:x.label,full:[x.full.ret,x.full.mdd],test:[x.test.ret,x.test.mdd],y1:x.y1.ret,phase:[x.phaseMin,x.phaseMax]}))));
 if(r.id==='f9'||r.id==='f10')console.log('BEST-PHASE POSTHOC',r.id,JSON.stringify(rows.filter(x=>x.full.mdd>=-40&&x.test.ret>0).sort((a,b)=>b.phaseMin-a.phaseMin).slice(0,5)));
}
fs.writeFileSync(new URL('alternatives.json',import.meta.url),JSON.stringify({warning:'Exploratory after reading holdout, not new out-of-sample proof.',trials},null,2));
