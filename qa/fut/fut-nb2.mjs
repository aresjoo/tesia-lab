// 고른 10개의 주변 조합 안정성: 값 하나씩 바꿨을 때도 그냥 보유를 이기는 비율
import { newPage, closePage, goto, evala, viewport, sleep } from './cdp.mjs';
import fs from 'fs';
const C=[{"id":"f1","kind":"rule","asset":"비앤비","mode":"ma","fast":20,"slow":70,"trail":25,"sl":10,"lev":2},{"id":"f2","kind":"rule","asset":"도지코인","mode":"ma","fast":10,"slow":100,"trail":20,"sl":10,"lev":2},{"id":"f3","kind":"rule","asset":"아발란체","mode":"brk","n":55,"exitN":10,"trail":20,"reg":200,"lev":1},{"id":"f4","kind":"rule","asset":"이더리움","mode":"brk","n":70,"exitN":20,"trail":15,"reg":200,"lev":2},{"id":"f5","kind":"mix","uni":"big3","mode":"brk","every":3,"look":45,"gate":0.5,"n":20,"exitN":15,"sl":10,"lev":1},{"id":"f6","kind":"rule","asset":"에이다","mode":"ma","fast":15,"slow":50,"trail":20,"lev":1},{"id":"f7","kind":"agent","uni":"coin8","every":3,"look":60,"top":1,"gate":0.88,"lev":1},{"id":"f8","kind":"rule","asset":"아발란체","mode":"ma","fast":20,"slow":100,"trail":20,"sl":10,"lev":1},{"id":"f9","kind":"agent","uni":"coin8","every":3,"look":60,"top":2,"gate":0.88,"lev":1},{"id":"f10","kind":"rule","asset":"비트코인","mode":"brk","n":55,"exitN":5,"trail":15,"reg":200,"lev":3}];
const V={every:[-1,1],sl:[-3,3],look:[-10,10],gate:[-0.12,0.12],n:[-5,5],dip:[-3,3],tp:[-3,3],exitN:[-3,3],trail:[-3,3],reg:[-30,30],fast:[-2,2],slow:[-15,15],top:[1]};
const p=await newPage(); await viewport(p,1200,800,{mobile:false});
await goto(p,'http://127.0.0.1:8765/index.html?v='+Date.now()); await sleep(4000);
const res=JSON.parse(await evala(p,`(function(){ var C=${JSON.stringify(C)}, V=${JSON.stringify(V)}, T=PRICE0.length-1;
  var run=function(c,s){ var f={}; for(var k in c) f[k]=c[k]; if(typeof f.uni==='string') f.uni=MK_UNI[f.uni].list; f.fut=1; f.startI=s; return mkFutRun(f); };
  var bench=function(c,a){ var U=c.asset?[c.asset]:MK_UNI[c.uni].list, v=0; U.forEach(function(k){ var P=fuD(k).c; v+=P[T]/P[a]; }); return (v/U.length-1)*100; };
  return JSON.stringify(C.map(function(c){ var b=run(c,101), bh=bench(c,101), nb=[], beat=0, pos=0;
    Object.keys(V).forEach(function(k){ if(c[k]==null||!c[k]) return; V[k].forEach(function(d){ var x={}; for(var q in c) x[q]=c[q]; x[k]=+(c[k]+d).toFixed(2); if(x[k]<=0) return; try{ var r=run(x,101); nb.push(k+(d>0?'+':'')+d+':'+r.ret.toFixed(0)+'/'+r.mdd.toFixed(0)+(r.liqN?'!liq':'')); if(r.ret>bh) beat++; if(r.ret>0) pos++; }catch(e){ nb.push(k+':err'); } }); });
    [1,2,3,5].forEach(function(l){ if(l===c.lev) return; var x={}; for(var q in c) x[q]=c[q]; x.lev=l; var r=run(x,101); nb.push('lev'+l+':'+r.ret.toFixed(0)+'/'+r.mdd.toFixed(0)+(r.liqN?'!liq'+r.liqN:'')); });
    var y1=run(c,T-365), y2=run(c,T-730), m3=run(c,T-90);
    return {id:c.id,ret:b.ret,mdd:b.mdd,n:b.n,win:b.winRate,liq:b.liqN,y1:y1.ret,y1m:y1.mdd,y2:y2.ret,m3:m3.ret,bench:bh,b1:bench(c,T-365),nbN:nb.filter(function(x){ return x.indexOf('lev')!==0; }).length,beat:beat,pos:pos,nb:nb}; })); })()`));
res.forEach(r=>console.log(r.id.padEnd(4),'전체',r.ret.toFixed(0)+'%/'+r.mdd.toFixed(0),'n',r.n,'승률',r.win.toFixed(0),'| 2y',r.y2.toFixed(0),'1y',r.y1.toFixed(0)+'/'+r.y1m.toFixed(0),'3m',r.m3.toFixed(0),'| 보유',r.bench.toFixed(0),'1y',r.b1.toFixed(0),'| 주변',r.beat+'/'+r.nbN+' 보유 이김, '+r.pos+'/'+r.nbN+' 이익','\n     ',r.nb.join('  ')));
fs.writeFileSync('fut-nb2.json',JSON.stringify({C,res},null,1));
await closePage(p); process.exit(0);
