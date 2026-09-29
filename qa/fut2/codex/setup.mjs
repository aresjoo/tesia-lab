import fs from 'node:fs';
let s=fs.readFileSync('qa/fut/codex/independent.mjs','utf8');
s=s.replace('opt.gapFirst&&!fresh&&gap(liq))return {price:liq','opt.gapFirst!==false&&!fresh&&gap(liq))return {price:o').replace('opt.gapFirst&&!fresh&&target','opt.gapFirst!==false&&!fresh&&target').replaceAll('(i-start)%every','(i+(c.ph||0))%every').replace('reportedFunding:realizedFunding','reportedFunding:paid');
s=s.replace('const eq=[],trades=[],orders=[],stale=[],mixHeld=[],fundingBreach=[];','const eq=[],trades=[],orders=[],stale=[],mixHeld=[],fundingBreach=[],risk=[];');
s=s.replace('const fill=raw?rawPrice:rawPrice*(1-p.s*slip),cost=p.q*fill*fee;',`const fill=raw?rawPrice:rawPrice*(1-p.s*slip),cost=p.q*fill*fee;
    if(opt.trace)recordRisk(p,i,fill,'exit:'+why);`);
s=s.replace('  for(let i=start;i<=end;i++){',`  function recordRisk(p,i,price,source){
    const liq=liquidation(p,opt.mmr??.005,opt.markNotional);
    risk.push({i,date:day(i),id:p.id,k:p.k,side:p.s,entry:p.entry,enter:p.enter,price,liq,source,adverse:Math.max(0,-p.s*(price/p.entry-1)*100),gapPctEntry:p.s*(price-liq)/p.entry*100,gapPctPrice:p.s*(price-liq)/price*100});
  }
  for(let i=start;i<=end;i++){`);
s=s.replace('      if(exit)close(p,exit.price,i,exit.why,exit.raw);',`      if(opt.trace){
        const raw=p.s>0?d.l[i]:d.h[i];
        recordRisk(p,i,raw,'bar-envelope');
        if(!exit)recordRisk(p,i,raw,'held-extreme');
      }
      if(exit)close(p,exit.price,i,exit.why,exit.raw);`);
s=s.replace('fundingBreach,positions,cash','fundingBreach,positions,cash,risk');
fs.writeFileSync('qa/fut2/codex/independent.mjs',s);
