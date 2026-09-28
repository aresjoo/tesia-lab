// 전략별 목표 수치에 가까운 (자산 가격 씨앗, 규칙값) 탐색 + 20개 전체의 값 중복 제거. 사용: node search2.cjs out.json [seeds]
const fs=require('fs');
const E=require('./engine.cjs');
const N=1335, END=N-1, FEE=0.002;
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function pxGen(seed,p0,vol){ // index.html 의 mkPx 와 같은 식
  var rng=mulberry32(seed), p=[p0], i=1;
  while(i<N){ var len=90+Math.floor(rng()*240), drift=(rng()*2.6-0.7)*0.001;
    for(var k=0;k<len&&i<N;k++,i++){ var sh=(rng()-.5)*vol; if(rng()<0.014) sh+=(rng()-.66)*vol*3.2; p.push(Math.max(p0*0.18,p[i-1]*(1+drift+sh))); } }
  return p;
}
function prep(P){ var r=new Float64Array(N), s20=new Float64Array(N), s60=new Float64Array(N);
  for(var i=0;i<N;i++){ r[i]=E.rsi(P,i); s20[i]=i>=19?E.sma(P,20,i):NaN; s60[i]=i>=59?E.sma(P,60,i):NaN; } return {P:P,r:r,s20:s20,s60:s60}; }
function bt(X,p){
  var P=X.P, sl=p.sl/100, tp=p.tp/100, eqI=[p.startI], eqV=[1], equity=1, inPos=false, eI=0, eP=0, n=0, w=0, hold=0, timeX=0;
  for(var i=p.startI;i<=END;i++){
    if(!inPos){ if(X.r[i-1]<p.rsiTh && P[i]>P[i-1]*1.005 && (!p.tf || Math.abs(X.s20[i]-X.s60[i])/P[i]>0.03)){ inPos=true; eI=i; eP=P[i]; } }
    else if(i>eI){ var chg=P[i]/eP-1, ex=0, pnl=0;
      if(chg<=sl){ ex=1; pnl=sl; } else if(chg>=tp){ ex=1; pnl=tp; } else if(i-eI>=25){ ex=2; pnl=chg; }
      if(ex){ equity*=(1+pnl-FEE); n++; if(pnl-FEE>0) w++; hold+=i-eI; if(ex===2) timeX++; eqI.push(i); eqV.push(equity); inPos=false; }
      else { eqI.push(i); eqV.push(equity*(1+chg)); } }
  }
  if(inPos&&END>eI){ equity*=(1+P[END]/eP-1); eqI.push(END); eqV.push(equity); }
  var peak=1, mdd=0; for(var k=0;k<eqV.length;k++){ if(eqV[k]>=peak) peak=eqV[k]; var dd=eqV[k]/peak-1; if(dd<mdd) mdd=dd; }
  var v30=1; for(var k2=0;k2<eqI.length;k2++){ if(eqI[k2]<=END-30) v30=eqV[k2]; else break; }
  var moves=0; for(var k3=0;k3<eqI.length;k3++) if(eqI[k3]>END-30) moves++;
  // 30일 구간 안의 최저점(시작 대비): 미니 차트가 너무 깊게 빨갛지 않게
  var lo30=0; for(var k4=0;k4<eqI.length;k4++) if(eqI[k4]>END-30){ var q=eqV[k4]/v30-1; if(q<lo30) lo30=q; }
  return {ret:(equity-1)*100, mdd:mdd*100, n:n, w:w, win:n?w/n*100:0, d30:(eqV[eqV.length-1]/v30-1)*100, moves:moves, open:inPos, hold:n?hold/n:0, timeX:n?timeX/n:0, lo30:lo30*100, pts:eqV.length, expo:hold/(END-p.startI)*100};
}
function score(m,t,c){
  var s=Math.abs(m.d30-t.d30)*3 + Math.abs(m.mdd-t.mdd)*2 + Math.abs(m.win-t.win)*0.35 + Math.abs(m.n-t.n)/Math.max(4,t.n)*14;
  if(m.win>80||m.win<40) s+=35; if(m.timeX>0.9&&m.n>8) s+=10; if(m.n<5) s+=60; if(m.d30<1) s+=60; if(m.ret<4) s+=30; if(m.moves<6) s+=15; if(m.pts<34) s+=40; if(m.mdd<-19) s+=40; if(m.n>95) s+=40; if(m.lo30<-7) s+=10; if(m.d30>19) s+=20;
  if(c){ if(c.mdd!=null&&m.mdd<c.mdd) s+=25+(c.mdd-m.mdd)*4; if(c.hold!=null&&m.hold>c.hold) s+=25+(m.hold-c.hold)*3; if(c.winMax!=null&&m.win>c.winMax) s+=20; }
  return s;
}
const spec=require('./spec3.cjs');
const SEEDS=+(process.argv[3]||4000), K=80;
const cand={};
for(const a of spec.assets){
  const strs=spec.strategies.filter(s=>s.asset===a.name); if(!strs.length) continue;
  const list=[];
  for(const vol of a.vol) for(let seed=1;seed<=SEEDS;seed++){
    const sd=seed*7+a.salt, raw=pxGen(sd,1,vol), ratio=raw[END]; if(ratio<a.ratio[0]||ratio>a.ratio[1]) continue;
    let mn=1e9; for(let z=0;z<N;z++) if(raw[z]<mn) mn=raw[z]; if(mn<0.5) continue;
    const p0=+(a.end/ratio).toPrecision(4), X=prep(pxGen(sd,p0,vol)); let tot=0; const picks=[];
    for(const s of strs){ let b=null;
      for(const rsiTh of s.rsi) for(const tf of s.tf) for(const st of s.start){ const p={rsiTh,tp:s.tp,sl:s.sl,tf,startI:st}, m=bt(X,p), sc=score(m,s.target,s.cap); if(!b||sc<b.sc) b={sc,p,m}; }
      tot+=b.sc*b.sc; picks.push(b); }
    list.push({tot,seed:sd,vol,p0,picks});
  }
  list.sort((x,y)=>x.tot-y.tot); cand[a.name]={strs,list:list.slice(0,K)};
  console.log(a.name.padEnd(8),'후보',list.length,'최고',list.length?Math.sqrt(list[0].tot/strs.length).toFixed(1):'-');
}
// 20개 전체에서 네 지표가 겹치지 않게 조립
const keysOf=m=>['d'+m.d30.toFixed(1),'m'+m.mdd.toFixed(1),'w'+Math.round(m.win),'n'+m.n];
const names=Object.keys(cand).sort((a,b)=>cand[a].list.length-cand[b].list.length);
let bestAsm=null;
for(let trial=0;trial<400;trial++){
  const rng=mulberry32(trial+1), order=names.slice(); if(trial) order.sort(()=>rng()-.5);
  const PRI=['비트코인','이더리움','테슬라']; order.sort((x,y)=>(PRI.indexOf(y)>=0?1:0)-(PRI.indexOf(x)>=0?1:0)); /* 대표 자산이 먼저 가장 좋은 후보를 가진다 */
  const used=new Set(), pick={}; let cost=0, ok=true;
  for(const nm of order){ const L=cand[nm].list; let ch=null;
    for(let i=0;i<L.length;i++){ const ks=[].concat(...L[i].picks.map(b=>keysOf(b.m))); if(new Set(ks).size!==ks.length) continue; if(ks.some(k=>used.has(k))) continue; ch=L[i]; ks.forEach(k=>used.add(k)); break; }
    if(!ch){ ok=false; break; } pick[nm]=ch; cost+=ch.tot; }
  if(ok&&(!bestAsm||cost<bestAsm.cost)) bestAsm={cost,pick};
}
if(!bestAsm) throw new Error('조립 실패: 후보를 늘려야 함');
const out={assets:{},strategies:[]};
for(const nm of Object.keys(bestAsm.pick)){ const c=bestAsm.pick[nm]; out.assets[nm]={seed:c.seed,vol:c.vol,p0:c.p0}; cand[nm].strs.forEach((s,i)=>out.strategies.push({id:s.id,asset:nm,target:s.target,pick:{p:c.picks[i].p,m:c.picks[i].m,sc:c.picks[i].sc}})); }
out.strategies.sort((a,b)=>a.id-b.id);
out.strategies.forEach(s=>{ const m=s.pick.m; console.log(String(s.id).padStart(2),s.asset.padEnd(8),'sc',s.pick.sc.toFixed(1).padStart(5),'d30',m.d30.toFixed(1).padStart(5),'('+s.target.d30+')','mdd',m.mdd.toFixed(1).padStart(6),'('+s.target.mdd+')','win',String(Math.round(m.win)).padStart(3),'('+s.target.win+')','n',String(m.n).padStart(3),'('+s.target.n+')','ret',m.ret.toFixed(0).padStart(4),'hold',m.hold.toFixed(0),'timeX',(m.timeX*100).toFixed(0)+'%','expo',m.expo.toFixed(0)+'%','lo30',m.lo30.toFixed(1),JSON.stringify(s.pick.p)); });
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1));
