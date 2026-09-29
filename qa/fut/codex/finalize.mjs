import fs from 'node:fs';
import {loadData,simulate,benchmark,day}from './independent.mjs';
const {fut,spot}=loadData(),read=f=>JSON.parse(fs.readFileSync(new URL(f,import.meta.url),'utf8'));
const rep=read('replication.json'),rows=[];
const changes={f1:{},f2:{sl:10},f3:{lev:1},f4:{lev:1},f5:{},f6:{},f7:{},f8:{},f9:{look:30},f10:{gate:.88}};
const verdicts={f1:'KEEP',f2:'REPLACE',f3:'KEEP WITH LOWER LEVERAGE',f4:'KEEP WITH LOWER LEVERAGE',f5:'KEEP',f6:'KEEP',f7:'KEEP',f8:'KEEP',f9:'REPLACE',f10:'REPLACE'};
for(const r of rep){
 const c={...r.config,...changes[r.id]},full=simulate(c,fut,{trace:true}),test=simulate(c,fut,{start:731}),y2=simulate(c,fut,{start:637}),y1=simulate(c,fut,{start:1002});
 const local=[];for(const [key,step]of Object.entries({every:1,look:5,top:1,gate:.05,sl:5,n:5,exitN:5,trail:5,fast:1,slow:10,reg:20})){if(c[key]===undefined)continue;for(const direction of [-1,1]){const v=+(c[key]+direction*step).toFixed(5);if(v<0||(v===0&&!['exitN','sl','trail','reg'].includes(key))||(key==='gate'&&(v<.5||v>1))||(key==='top'&&v>4))continue;const cc={...c,[key]:v},t=simulate(cc,fut,{start:731}),f=simulate(cc,fut),y=simulate(cc,fut,{start:1002});local.push({key,value:v,full:f,test:t,y1:y});}}
 const phases=[];for(let offset=-7;offset<=7;offset++){const x=simulate(c,fut,{start:1002+offset});phases.push({offset,ret:x.ret,mdd:x.mdd});}
 const {eq,trades,orders,stale,mixHeld,fundingBreach,positions,cash,...summary}=full;
 const orig=simulate(r.config,fut,{trace:true});
 const keys=c.asset?[c.asset]:c.uni,searchBench=benchmark(keys,Object.fromEntries(keys.map(k=>[k,fut.sym[k].c])),101,1366);
 const baseline=rep.find(x=>x.id===r.id).periods.full;
 const benchDelta=r.searchReference?r.searchReference.b-searchBench.ret:null;
 const closingFee=positions.reduce((s,p)=>s+p.q*fut.sym[p.k].c[1366]*.00055,0);
 rows.push({id:c.id,verdict:verdicts[c.id],changes:changes[c.id],config:c,full:summary,test,y2,y1,neighbors:local,phase:phases,phaseMin:Math.min(...phases.map(x=>x.ret)),phaseMax:Math.max(...phases.map(x=>x.ret)),searchBenchmarkAt101:searchBench,searchBenchmarkDifference:benchDelta,spotAt101:baseline.spotCommonStart,closingFeePctInitial:closingFee*100,originalMix:orig.mixHeld.length?{heldDays:orig.mixHeld.length,mismatchDays:orig.mixHeld.filter(x=>x.mismatch).length,maxAge:Math.max(...orig.mixHeld.map(x=>x.age)),staleFlatEntries:orig.stale.filter(x=>x.mismatch).length,firstMismatch:orig.mixHeld.find(x=>x.mismatch)}:null});
 console.log(JSON.stringify({id:c.id,verdict:verdicts[c.id],changes:changes[c.id],full:[summary.ret,summary.mdd],test:[test.ret,test.mdd],y2:[y2.ret,y2.mdd],y1:[y1.ret,y1.mdd],spot101:baseline.spotCommonStart.ret,searchBench:searchBench.ret,delta:benchDelta,phase:[rows.at(-1).phaseMin,rows.at(-1).phaseMax],localTestPass:local.filter(x=>x.test.ret>0).length+'/'+local.length,originalMix:rows.at(-1).originalMix}));
}
fs.writeFileSync(new URL('verdicts.json',import.meta.url),JSON.stringify({warning:'KEEP means research candidate; replacements are post-hoc proposals, not newly validated OOS strategies.',rows},null,2));
