// AI 판단과 혼합 선물 전략을 다시 고른다. 조건: 재평가 날의 위상(ph)을 어떻게 잡아도, 시작일을 며칠 옮겨도 버티는 것.
// 고르는 구간(2023-04 ~ 2024-12)과 확인 구간(2025-01 ~ 2026-09)을 나눠서 둘 다 통과해야 한다.
import { newPage, closePage, goto, evala, viewport, sleep } from './cdp.mjs';
import fs from 'fs';
const p=await newPage(); await viewport(p,1200,800,{mobile:false});
await goto(p,'http://127.0.0.1:8765/index.html?v='+Date.now()); await sleep(4000);
await evala(p,`(function(){
  window.FS={};
  FS.grid=function(o){ var ks=Object.keys(o), out=[{}]; ks.forEach(function(k){ var n=[]; out.forEach(function(b){ o[k].forEach(function(v){ var x={}; for(var q in b) x[q]=b[q]; x[k]=v; n.push(x); }); }); out=n; }); return out; };
  FS.run=function(c,s,ph){ var f={}; for(var k in c) f[k]=c[k]; if(typeof f.uni==='string') f.uni=MK_UNI[f.uni].list; f.fut=1; f.startI=s; if(ph!=null) f.ph=ph; return mkFutRun(f); };
  FS.seg=function(r,a,b){ var e=r.eq.filter(function(x){ return x.i>=a&&x.i<=b; }); if(e.length<2) return {ret:0,mdd:0}; var v0=e[0].v, pk=v0, md=0; e.forEach(function(x){ if(x.v>pk) pk=x.v; md=Math.min(md,x.v/pk-1); }); return {ret:(e[e.length-1].v/v0-1)*100,mdd:md*100}; };
  FS.spot=function(c,a,b){ var U=c.asset?[c.asset]:MK_UNI[c.uni].list, v=0; U.forEach(function(k){ var P=mkPx(k); v+=P[b]/P[a]; }); return (v/U.length-1)*100; };
  FS.cut=(function(){ for(var i=0;i<PRICE0.length;i++){ var d=idxToDate(i); if(d.getFullYear()===2025&&d.getMonth()===0&&d.getDate()===1) return i; } return 731; })();
  FS.eval=function(c){ var T=PRICE0.length-1, ev=c.every||1, phs=[]; for(var q=0;q<ev;q++) phs.push(q);
    var rs=phs.map(function(ph){ var r=FS.run(c,101,ph); return {r:r,tr:FS.seg(r,101,FS.cut-1),te:FS.seg(r,FS.cut,T),y1:FS.seg(r,T-365,T)}; });
    if(rs.some(function(x){ return x.r.liqN>0||x.r.n<10; })) return null;
    var mn=function(f){ return Math.min.apply(null,rs.map(f)); }, md=function(f){ var a=rs.map(f).sort(function(x,y){ return x-y; }); return a[Math.floor(a.length/2)]; };
    var o={c:c,ret:md(function(x){ return x.r.ret; }),retMin:mn(function(x){ return x.r.ret; }),mdd:mn(function(x){ return x.r.mdd; }),tr:mn(function(x){ return x.tr.ret; }),te:mn(function(x){ return x.te.ret; }),teM:mn(function(x){ return x.te.mdd; }),y1:mn(function(x){ return x.y1.ret; }),y1M:mn(function(x){ return x.y1.mdd; }),n:rs[0].r.n,ret0:rs[0].r.ret,mdd0:rs[0].r.mdd};
    if(o.mdd<-50||o.retMin<100||o.tr<20||o.te<20||o.y1<5) return null;
    o.sp=FS.spot(c,101,T); o.spTe=FS.spot(c,FS.cut,T); o.sp1=FS.spot(c,T-365,T); if(o.retMin<o.sp||o.te<o.spTe||o.y1<o.sp1) return null;
    /* 기간을 새로 시작해 돌렸을 때(최근 1년, 2년, 시작일을 1주일 안에서 옮김)의 최저 */
    var st=[]; [365,730].forEach(function(d){ [0,2,4,6].forEach(function(s){ st.push(FS.run(c,T-d-s,0).ret); }); }); o.fresh=Math.min.apply(null,st); if(o.fresh<0) return null;
    return o; };
  FS.sweep=function(list){ var out=[]; list.forEach(function(c){ try{ var r=FS.eval(c); if(r) out.push(r); }catch(e){ FS.err=String(e); } }); return out; };
})()`);
const fam=[];
for(const u of ['coin8','big3']){
  fam.push(['mix-brk '+u,`FS.grid({kind:['mix'],uni:['${u}'],mode:['brk'],every:[3,5,7],look:[30,45,60,90],gate:[0.5,0.63],n:[5,10,20,30],exitN:[5,10,15],sl:[0,10,15],trail:[0,15,25],lev:[1,2]})`]);
  fam.push(['mix-ma '+u,`FS.grid({kind:['mix'],uni:['${u}'],mode:['ma'],every:[3,5,7],look:[30,60,90],gate:[0.5,0.63],fast:[5,10,20],slow:[50,100],sl:[0,10,15],trail:[0,15,25],lev:[1,2]})`]);
  fam.push(['agent '+u,`FS.grid({kind:['agent'],uni:['${u}'],every:[2,3,5,7],look:[15,20,30,45,60],top:${u==='big3'?'[1]':'[1,2,3]'},gate:[0.5,0.63,0.75,0.88],sl:[0,10,15],trail:[0,15,20],lev:[1,2]})`]);
}
const all=[]; let tested=0;
for(const [name,g] of fam){
  const t0=Date.now(); const n=+(await evala(p,`(function(){ window.FSG=${g}; return FSG.length; })()`)); tested+=n;
  let got=[]; for(let a=0;a<n;a+=150){ got=got.concat(JSON.parse(await evala(p,`JSON.stringify(FS.sweep(FSG.slice(${a},${a+150})))`))); }
  got.forEach(x=>x.fam=name); all.push(...got);
  console.log(name.padEnd(16),'tested',String(n).padStart(5),'passed',String(got.length).padStart(4),((Date.now()-t0)/1000).toFixed(0)+'s');
}
console.log('err',await evala(p,`FS.err||''`),'cut',await evala(p,`FS.cut+' '+mkDate(FS.cut)`));
all.forEach(x=>{ x.score=Math.min(x.tr/1.7,x.te/1.7,x.y1,x.fresh,x.retMin/3.5)/Math.max(10,-x.mdd); });
all.sort((a,b)=>b.score-a.score);
fs.writeFileSync('fut-search3b.json',JSON.stringify({tested,passed:all.length,top:all.slice(0,300)}));
console.log('tested',tested,'passed',all.length);
const seen={}; let shown=0;
for(const x of all){ seen[x.fam]=(seen[x.fam]||0)+1; if(seen[x.fam]>4) continue; if(++shown>24) break;
  const c=Object.assign({},x.c); delete c.kind; console.log(x.fam.padEnd(14),JSON.stringify(c).replace(/"/g,''),'| 전체(위상 중앙/최저)',x.ret.toFixed(0)+'/'+x.retMin.toFixed(0)+'% 낙폭',x.mdd.toFixed(0),'| 앞',x.tr.toFixed(0),'뒤',x.te.toFixed(0)+'/'+x.teM.toFixed(0),'| 1y',x.y1.toFixed(0),'새로',x.fresh.toFixed(0),'| 현물',x.sp.toFixed(0),'뒤',x.spTe.toFixed(0)); }
await closePage(p); process.exit(0);
