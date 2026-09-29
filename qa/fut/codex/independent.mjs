// Independent simulator. Only data files are evaluated; no project engine is loaded.
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
export const root = fileURLToPath(new URL('../../../', import.meta.url));
export const day = i => new Date(Date.UTC(2023,0,1)+i*86400000).toISOString().slice(0,10);
export const index = d => Math.round((Date.parse(d+'T00:00:00Z')-Date.UTC(2023,0,1))/86400000);
export function loadData(){
  const box={window:{}}; vm.createContext(box);
  for(const file of ['data/fut-daily.js','data/px-daily.js']) vm.runInContext(fs.readFileSync(root+file,'utf8'),box);
  return {fut:box.window.TETH_FUT,spot:box.window.TETH_PX};
}
export function stats(curve){
  let peak=1,dd=0; for(const x of curve){peak=Math.max(peak,x.v);dd=Math.min(dd,x.v/peak-1);}
  return {ret:100*((curve.at(-1)?.v??1)-1),mdd:100*dd};
}
function average(a,i,n){let s=0;for(let t=i-n+1;t<=i;t++)s+=a[t];return s/n;}
function extreme(a,from,to,max){let v=max?-Infinity:Infinity;for(let t=from;t<=to;t++)v=max?Math.max(v,a[t]):Math.min(v,a[t]);return v;}
export function warmup(c){return Math.max(61,(c.n||0)+2,(c.look||0)+2,(c.reg||0)+2,(c.slow||0)+2);}
export function ranking(c,data,i){
  const rows=c.uni.map(k=>{const a=data.sym[k].c,mom=a[i]/a[i-c.look]-1;let sum=0,sq=0;
    for(let t=i-19;t<=i;t++){const r=a[t]/a[t-1]-1;sum+=r;sq+=r*r;}
    const vol=Math.sqrt(Math.max(1e-12,sq/20-(sum/20)**2));
    return {k,score:mom/vol/Math.sqrt(c.look),above:a[i]>average(a,i,60)};
  }).sort((a,b)=>b.score-a.score);
  return {rows,breadth:rows.filter(r=>r.above).length/rows.length};
}
export function signal(c,d,i,fng=[]){
  const a=d.c;let s=0;
  if(c.mode==='brk'){
    if(a[i]>extreme(d.h,i-c.n,i-1,true))s=1;
    else if(a[i]<extreme(d.l,i-c.n,i-1,false))s=-1;
  }else if(c.mode==='ma'){
    const now=average(a,i,c.fast)-average(a,i,c.slow),prev=average(a,i-1,c.fast)-average(a,i-1,c.slow);
    if(now>0&&prev<=0)s=1;else if(now<0&&prev>=0)s=-1;
  }else if(c.mode==='dip'){
    const change=a[i]/a[i-1]-1;
    if(a[i]/extreme(d.h,i-c.n,i,true)-1<=-c.dip/100&&change>.005)s=1;
    else if(a[i]/extreme(d.l,i-c.n,i,false)-1>=c.dip/100&&change<-.005)s=-1;
  }else if(c.mode==='fg'&&fng[i]!=null){
    if(fng[i]<=c.lo&&a[i]/a[i-1]-1>.005)s=1;
    else if(fng[i]>=c.hi&&a[i]/a[i-1]-1<-.005)s=-1;
  }
  if(c.reg&&s*(a[i]-average(a,i,c.reg))<0)s=0;
  if((c.dir==='long'&&s<0)||(c.dir==='short'&&s>0))s=0;
  return s;
}
export function liquidation(p,mmr=.005,markNotional=false){
  return markNotional?(p.s*p.q*p.entry-p.margin+p.funding)/(p.q*(p.s-mmr))
    :p.entry-p.s*((p.margin-p.funding)/p.q-mmr*p.entry);
}
export function positionValue(p,price){return p.margin+p.s*p.q*(price-p.entry)-p.funding;}
export function intraday(p,bar,c,opt={}){
  const {o,h,l}=bar,liq=liquidation(p,opt.mmr??.005,opt.markNotional),fresh=bar.i===p.enter;
  const adverse=x=>p.s>0?l<=x:h>=x,gap=x=>p.s>0?o<=x:o>=x;
  const stops=[];if(c.sl)stops.push({p:p.entry*(1-p.s*c.sl/100),why:'sl'});
  if(c.trail&&!fresh)stops.push({p:p.best*(1-p.s*c.trail/100),why:'trail'});
  stops.sort((a,b)=>p.s*(b.p-a.p));const stop=stops[0];
  const target=c.tp?p.entry*(1+p.s*c.tp/100):null;
  // Optional corrected chronology: gap liquidation / a favorable TP open precede later extremes.
  if(opt.gapFirst&&!fresh&&gap(liq))return {price:liq,why:'liq',raw:true};
  if(opt.gapFirst&&!fresh&&target!=null&&(p.s>0?o>=target:o<=target))return {price:o,why:'tp',raw:true};
  if(stop&&p.s*(stop.p-liq)>0&&adverse(stop.p))return {price:!fresh&&gap(stop.p)?o:stop.p,why:stop.why,raw:!!opt.literalStops};
  if(adverse(liq))return {price:liq,why:'liq',raw:true};
  if(target!=null&&(p.s>0?h>=target:l<=target))return {price:!fresh&&(p.s>0?o>=target:o<=target)?o:target,why:'tp',raw:true};
  return null;
}
export function simulate(c,data,opt={}){
  const keys=c.asset?[c.asset]:c.uni,end=opt.end??data.sym[keys[0]].c.length-1;
  const requested=opt.start??101,start=Math.max(requested,warmup(c)),lev=Math.max(1,Math.min(10,c.lev||1));
  const fee=opt.fee??.00055,slip=opt.slip??.0005,top=Math.max(1,Math.min(4,c.top||1)),every=c.every||1;
  let cash=1,positions=[],queue=[],fees=0,paid=0,realizedFunding=0,id=0,pickL=c.asset||null,pickS=c.asset||null,regime=c.asset?2:0,scanAt=null;
  const eq=[],trades=[],orders=[],stale=[],mixHeld=[],fundingBreach=[];
  const value=price=>cash+positions.reduce((sum,p)=>sum+Math.max(0,positionValue(p,price(p.k))),0);
  const close=(p,rawPrice,i,why,raw=false)=>{
    const fill=raw?rawPrice:rawPrice*(1-p.s*slip),cost=p.q*fill*fee;
    const proceeds=why==='liq'?0:Math.max(0,positionValue(p,fill)-cost);
    cash+=proceeds;fees+=cost;realizedFunding+=p.funding;
    trades.push({id:p.id,k:p.k,side:p.s,entry:p.enter,exit:i,ep:p.entry,xp:fill,cost:p.cost,got:proceeds,funding:p.funding,fee:p.fee+cost,why});
    positions=positions.filter(x=>x!==p);
  };
  for(let i=start;i<=end;i++){
    const opens=queue.filter(q=>q.action==='open');
    for(const q of queue.filter(q=>q.action==='close'))if(positions.includes(q.p))close(q.p,data.sym[q.p.k].o[i],i,q.why);
    const total=value(k=>data.sym[k].o[i]);
    for(const q of opens){
      const spend=Math.min(cash,q.weight*total);if(spend<=1e-9)continue;
      const entry=data.sym[q.k].o[i]*(1+q.side*slip),margin=spend/(1+lev*fee),units=margin*lev/entry,entryFee=spend-margin;
      cash-=spend;fees+=entryFee;
      const p={id:++id,k:q.k,s:q.side,entry,margin,q:units,funding:0,best:entry,enter:i,cost:spend,fee:entryFee};positions.push(p);
      if(opt.trace)orders.push({decision:q.decision,fill:i,k:q.k,side:q.side,price:entry});
    }
    queue=[];
    // Funding alternative is a sensitivity bound, not a reconstruction of settlement ticks.
    const accrue=(p,price)=>{const cost=p.s*p.q*price*(data.sym[p.k].f[i]||0)/1e4*(opt.fundingScale??1);p.funding+=cost;paid+=cost;};
    if(opt.fundingAtOpen)for(const p of positions)accrue(p,data.sym[p.k].o[i]);
    for(const p of [...positions]){
      const d=data.sym[p.k],exit=intraday(p,{i,o:d.o[i],h:d.h[i],l:d.l[i]},c,opt);
      if(exit)close(p,exit.price,i,exit.why,exit.raw);
    }
    for(const p of [...positions]){
      const price=data.sym[p.k].c[i];if(!opt.fundingAtOpen)accrue(p,price);
      if(p.s*(price-p.best)>0)p.best=price;
      if(p.s*(price-liquidation(p,opt.mmr??.005,opt.markNotional))<=0){
        if(opt.trace)fundingBreach.push({i,k:p.k,price,liq:liquidation(p,opt.mmr??.005,opt.markNotional)});
        if(opt.fundingRecheck)close(p,price,i,'liq',true);
      }
    }
    const held=k=>positions.find(p=>p.k===k),out=(p,why)=>queue.push({action:'close',p,why}),enter=(k,side,weight)=>queue.push({action:'open',k,side,weight,decision:i});
    if(c.kind==='agent'){
      if((i-start)%every===0){
        const {rows,breadth}=ranking(c,data,i),reg=c.neutral?2:breadth>=c.gate?1:breadth<=1-c.gate?-1:0;
        let longs=(reg===1||reg===2)?rows.slice(0,top).filter(r=>c.neutral||(r.above&&r.score>0)):[];
        let shorts=(reg===-1||reg===2)?rows.slice(-top).filter(r=>c.neutral||(!r.above&&r.score<0)):[];
        if(c.dir==='short')longs=[];if(c.dir==='long')shorts=[];
        const wanted=new Map([...longs.map(r=>[r.k,1]),...shorts.map(r=>[r.k,-1])]);
        for(const p of positions)if(wanted.get(p.k)!==p.s)out(p,wanted.has(p.k)?'flip':reg===0?'rest':'rot');
        for(const [k,s] of [...longs.map(r=>[r.k,1]),...shorts.map(r=>[r.k,-1])])if(held(k)?.s!==s)enter(k,s,1/(top*(c.neutral?2:1)));
      }
    }else{
      if(c.kind==='mix'&&((opt.refreshMix==='daily')||((i-start)%every===0&&(!positions.length||opt.refreshMix==='scheduled')))){
        const {rows,breadth}=ranking(c,data,i);regime=breadth>=c.gate?1:breadth<=1-c.gate?-1:0;
        pickL=regime>0?rows[0].k:null;pickS=regime<0?rows.at(-1).k:null;scanAt=i;
      }
      const p=positions[0];
      if(p){
        if(c.kind==='mix'&&opt.trace){const {breadth}=ranking(c,data,i),current=breadth>=c.gate?1:breadth<=1-c.gate?-1:0;mixHeld.push({i,k:p.k,scanAt,age:i-scanAt,regime,current,mismatch:current!==regime});}
        const d=data.sym[p.k],s=signal(c,d,i,opt.fng);let why=null;
        if(c.exitN&&(p.s>0?d.c[i]<extreme(d.l,i-c.exitN,i-1,false):d.c[i]>extreme(d.h,i-c.exitN,i-1,true)))why='chan';
        else if(c.hold&&i-p.enter>=c.hold)why='time';
        if(s&&s!==p.s&&(c.kind!=='mix'||regime===s||regime===2)){out(p,'flip');enter(p.k,s,1);}
        else if(why)out(p,why);
      }else{
        for(const k of c.kind==='mix'?[pickL,pickS].filter(Boolean):[c.asset]){
          const s=signal(c,data.sym[k],i,opt.fng);if(!s)continue;
          if(c.kind==='mix'&&!((k===pickL&&s>0)||(k===pickS&&s<0)))continue;
          if(c.kind==='mix'&&opt.trace){const {breadth}=ranking(c,data,i),current=breadth>=c.gate?1:breadth<=1-c.gate?-1:0;stale.push({i,k,s,scanAt,age:i-scanAt,regime,current,mismatch:current!==regime});}
          enter(k,s,1);break;
        }
      }
    }
    const v=value(k=>data.sym[k].c[i]);eq.push({i,v});
    if(v<=1e-6){for(let t=i+1;t<=end;t++)eq.push({i:t,v:0});break;}
  }
  const result={...stats(eq),start,end,n:trades.length,liq:trades.filter(t=>t.why==='liq').length,fees,funding:paid,reportedFunding:realizedFunding,openFunding:positions.reduce((s,p)=>s+p.funding,0)};
  if(opt.trace)Object.assign(result,{eq,trades,orders,stale,mixHeld,fundingBreach,positions,cash});
  return result;
}
export function benchmark(keys,prices,start,end){
  const eq=[];for(let i=start;i<=end;i++)eq.push({i,v:keys.reduce((s,k)=>s+prices[k][i]/prices[k][start],0)/keys.length});
  return {...stats(eq),start,end};
}
