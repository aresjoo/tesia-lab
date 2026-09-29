// 선물 롱/숏 전략 전수 탐색. 실제 Bybit 일봉과 펀딩비, 다음 날 시가 체결, 강제 청산 포함.
import { newPage, closePage, goto, evala, viewport, sleep } from './cdp.mjs';
import fs from 'fs';
const p=await newPage(); await viewport(p,1200,800,{mobile:false});
await goto(p,'http://127.0.0.1:8765/index.html?v='+Date.now()); await sleep(4000);
// 페이지 안에 탐색 도구를 심는다
await evala(p,`(function(){
  window.FS={};
  FS.grid=function(o){ var ks=Object.keys(o), out=[{}]; ks.forEach(function(k){ var n=[]; out.forEach(function(b){ o[k].forEach(function(v){ var x={}; for(var q in b) x[q]=b[q]; x[k]=v; n.push(x); }); }); out=n; }); return out; };
  FS.run=function(c,s){ var f={}; for(var k in c) f[k]=c[k]; if(typeof f.uni==='string') f.uni=MK_UNI[f.uni].list; f.fut=1; f.startI=s; return mkFutRun(f); };
  FS.bench=function(c,a){ var U=c.asset?[c.asset]:MK_UNI[c.uni].list, T=PRICE0.length-1, s=0, md=0; var eq=[]; for(var i=a;i<=T;i++){ var v=0; U.forEach(function(k){ var P=fuD(k).c; v+=P[i]/P[a]; }); eq.push(v/U.length); } var pk=0; eq.forEach(function(v){ if(v>pk) pk=v; md=Math.min(md,v/pk-1); }); return {ret:(eq[eq.length-1]-1)*100,mdd:md*100}; };
  FS.eval=function(c){ var T=PRICE0.length-1, H=Math.floor((101+T)/2), all=FS.run(c,101); if(all.n<10||all.liqN>0) return null; if(all.mdd<-45||all.ret<100) return null;
    var y1=FS.run(c,T-365), y2=FS.run(c,T-730); if(y1.ret<15||y2.ret<40||y1.mdd<-35) return null;
    var eqH=all.eq.filter(function(e){ return e.i<=H; }), half=(eqH[eqH.length-1].v-1)*100; if(half<20) return null;
    /* 연도별 */ var yr={}; all.eq.forEach(function(e){ var y=idxToDate(e.i).getFullYear(); if(!yr[y]) yr[y]={a:e.v}; yr[y].b=e.v; }); var ys=Object.keys(yr).map(function(y){ return (yr[y].b/yr[y].a-1)*100; }); var worstY=Math.min.apply(null,ys);
    var b=FS.bench(c,101), b1=FS.bench(c,T-365), b2=FS.bench(c,T-730);
    if(all.ret<b.ret||y1.ret<b1.ret||y2.ret<b2.ret) return null;
    return {c:c,ret:all.ret,mdd:all.mdd,n:all.n,win:all.winRate,y1:y1.ret,y1m:y1.mdd,y2:y2.ret,y2m:y2.mdd,half:half,worstY:worstY,ys:ys,b:b.ret,bm:b.mdd,b1:b1.ret,b2:b2.ret,fund:all.fundPaid*100,fees:all.feesPaid*100}; };
  FS.sweep=function(list){ var out=[]; list.forEach(function(c){ try{ var r=FS.eval(c); if(r) out.push(r); }catch(e){ FS.err=String(e); } }); return out; };
})()`);
const COINS=['비트코인','이더리움','솔라나','리플','도지코인','에이다','아발란체','비앤비'];
const fam=[];
for(const a of COINS){
  fam.push(['rule-brk '+a,`FS.grid({kind:['rule'],asset:['${a}'],mode:['brk'],n:[10,20,30,55],exitN:[0,5,10,20],trail:[0,10,15,20],lev:[1,2,3],reg:[0,100,200]})`]);
  fam.push(['rule-ma '+a,`FS.grid({kind:['rule'],asset:['${a}'],mode:['ma'],fast:[5,10,20],slow:[30,50,100],trail:[0,10,15,20],lev:[1,2,3],reg:[0,200]})`]);
  fam.push(['rule-fg '+a,`FS.grid({kind:['rule'],asset:['${a}'],mode:['fg'],lo:[20,25,30,35],hi:[70,75,80],tp:[0,15,30],sl:[0,8,12],hold:[15,30,60],lev:[1,2,3]})`]);
}
for(const u of ['coin8','big3']){
  fam.push(['mix-brk '+u,`FS.grid({kind:['mix'],uni:['${u}'],mode:['brk'],every:[5,10],look:[20,40,60],gate:[0.5,0.63,0.75],n:[5,10,20],exitN:[0,5,10],trail:[0,10,15,20],lev:[1,2,3]})`]);
  fam.push(['mix-dip '+u,`FS.grid({kind:['mix'],uni:['${u}'],mode:['dip'],every:[5,10],look:[20,40,60],gate:[0.5,0.63,0.75],n:[10,20],dip:[8,12,18],trail:[0,10,15],tp:[0,15,30],hold:[0,25],lev:[1,2,3]})`]);
  fam.push(['agent '+u,`FS.grid({kind:['agent'],uni:['${u}'],every:[3,5,7,10],look:[10,20,40,60],top:${u==='big3'?'[1]':'[1,2,3]'},gate:[0.5,0.63,0.75],neutral:[0,1],trail:[0,10,15,20],lev:[1,2,3]})`]);
}
const all=[]; let tested=0;
for(const [name,g] of fam){
  const t0=Date.now();
  const n=+(await evala(p,`(function(){ window.FSG=${g}; return FSG.length; })()`)); tested+=n;
  let got=[]; for(let a=0;a<n;a+=400){ const part=JSON.parse(await evala(p,`JSON.stringify(FS.sweep(FSG.slice(${a},${a+400})))`)); got=got.concat(part); }
  got.forEach(x=>x.fam=name); all.push(...got);
  console.log(name.padEnd(20),'tested',String(n).padStart(5),'passed',String(got.length).padStart(4),((Date.now()-t0)/1000).toFixed(0)+'s');
}
console.log('err',await evala(p,`FS.err||''`));
// 안정성 점수: 가장 약한 기간의 성과를 낙폭으로 나눈다
all.forEach(x=>{ x.score=Math.min(x.y1,x.y2/2,x.half,x.ret/3.5)/Math.max(8,-x.mdd); });
all.sort((a,b)=>b.score-a.score);
fs.writeFileSync('fut-search.json',JSON.stringify({tested,passed:all.length,top:all.slice(0,400)},null,0));
console.log('tested',tested,'passed',all.length);
const seen={}; let shown=0;
for(const x of all){ const key=x.fam; seen[key]=(seen[key]||0)+1; if(seen[key]>2) continue; if(++shown>40) break;
  const c=Object.assign({},x.c); delete c.kind; console.log(x.fam.padEnd(18),JSON.stringify(c).replace(/"/g,''),'| 전체',x.ret.toFixed(0)+'%/'+x.mdd.toFixed(0),'| 2y',x.y2.toFixed(0)+'%','| 1y',x.y1.toFixed(0)+'%/'+x.y1m.toFixed(0),'| 앞',x.half.toFixed(0)+'%','| 최악해',x.worstY.toFixed(0)+'%','| n',x.n,'| 보유',x.b.toFixed(0)+'%/'+x.bm.toFixed(0),'1y',x.b1.toFixed(0)+'%'); }
await closePage(p); process.exit(0);
