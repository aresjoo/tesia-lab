// Codex s2 의 F1~F4: 여러 번의 수동 정리, 멈춘 계좌는 그때 든 종목만, 멈춘 뒤 끝낼 때 정리 기록 유지, 끝난 계좌의 반영 열
const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
const CR=String.fromCharCode(13), LF=String.fromCharCode(10), nl=s=>s.split(CR+LF).join(LF).split(LF).join(CR+LF);
const cnt=(s,x)=>s.split(x).length-1;
const one=(s,x,y,n)=>{ const c=cnt(s,x); if(c!==(n||1)) throw new Error('x'+c+': '+x.slice(0,70)); return s.split(x).join(y); };
let s=fs.readFileSync(D+'rd-ui.js','utf8');
// F3: 멈춘 계좌를 정리하고 끝낼 때 앞선 정리 기록을 지우지 않는다
s=one(s,"  if(c2.winding){ c2.flatI=null; cpClose(cid); return; }","  if(c2.winding){ cpClose(cid); return; }");
// F1: 수동 정리는 할 때마다 기록에 더한다
s=one(s,"  c2.flatI=s2.r.eq[s2.r.eq.length-1].i; /* 이후 손익 계산 구간을 여기서 고정 */","  { var fb=s2.r.eq[s2.r.eq.length-1].i; if(!c2.flats) c2.flats=c2.flatI!=null?[c2.flatI]:[]; if(c2.flats.indexOf(fb)<0) c2.flats.push(fb); c2.flatI=fb; } /* 정리한 봉을 차례로 남긴다 */");
s=one(s,"['simStartI','flatI','endI','stopI'].forEach(function(k){ if(c[k]!=null) c[k]=Math.max(0,Math.min(now.len-1,c[k]+sh)); });","['simStartI','flatI','endI','stopI'].forEach(function(k){ if(c[k]!=null) c[k]=Math.max(0,Math.min(now.len-1,c[k]+sh)); }); if(c.flats) c.flats=c.flats.map(function(x){ return Math.max(0,Math.min(now.len-1,x+sh)); });");
fs.writeFileSync(D+'rd-ui.js',s);
let t=fs.readFileSync(F,'utf8');
const i0=t.indexOf('function cpCalc(c2){'), i1=t.indexOf('function cpAddNote(',i0); let c=t.slice(i0,i1);
c=one(c,"  var manI=(c2.flatI!=null&&!(c2.endI==null&&c2.status==='closed'))?c2.flatI:null;","  var manI=(c2.flatI!=null&&!(c2.endI==null&&c2.status==='closed'))?c2.flatI:null;"+CR+LF+"  var mans=(c2.flats&&c2.flats.length?c2.flats.slice():(manI!=null?[manI]:[])).sort(function(a,b){ return a-b; }); /* 수동 정리는 여러 번일 수 있다 */");
// 멈춘 계좌의 기준가: 멈춘 봉에 들고 있던 종목과 현금만 따라간다
c=one(c,"    windEnd=stillOpen?null:(held.length?Math.max.apply(null,held.map(function(x){ return x.exit; })):stopI); }",nl("    windEnd=stillOpen?null:(held.length?Math.max.apply(null,held.map(function(x){ return x.exit; })):stopI); }\n  /* 멈춘 뒤의 기준가: 멈춘 봉의 기준가에, 그때 들고 있던 종목의 값 변화만 더한다. 원본이 그 뒤에 새로 산 종목은 넣지 않는다 */\n  var frozen=null;\n  if(stopI!=null){ var hp=(s2.r.trades||[]).filter(function(x){ return x.entry<=stopI&&x.exit!=null&&x.exit>stopI&&x.units!=null; }).map(function(x){ return {k:x.asset,u:x.units,exit:x.exit,got:x.got}; });\n    (op?(op.length!=null?op:[op]):[]).forEach(function(o){ if(o&&o.entry!=null&&o.entry<=stopI&&o.units!=null) hp.push({k:o.k,u:o.units,exit:null,got:null}); });\n    var n0=navAt(stopI), pxs={}; hp.forEach(function(h){ if(!pxs[h.k]) pxs[h.k]=mkPx(h.k); });\n    frozen=function(i){ var v=n0, b=Math.min(i,T); hp.forEach(function(h){ var P=pxs[h.k], a=h.u*P[stopI]; v+=((h.exit!=null&&b>=h.exit)?h.got:h.u*P[b])-a; }); return v; }; }\n  var navF=function(i){ return frozen&&i>stopI?frozen(i):navAt(i); };"));
c=one(c,"    if(immediate&&(manI==null||i<manI)) return i;"+CR+LF+"    /* 입금은 그 봉의 진입부터 함께 간다. 수동 정리 뒤에는 정리한 봉 다음 진입부터 */"+CR+LF+"    var after=manI!=null&&i>=manI, from=after?Math.max(i,manI):i;"+CR+LF+"    for(var k=0;k<entries.length;k++) if(after?entries[k]>from:entries[k]>=from) return entries[k];",
  nl("    /* 수동 정리 뒤 아직 원본이 새로 진입하지 않은 동안(현금 상태)의 입금은 다음 진입부터. 그 밖에는 판단 방식대로 */\n    var inCash=mans.some(function(m){ if(m>i) return false; for(var k=0;k<entries.length;k++) if(entries[k]>m) return entries[k]>i; return true; });\n    if(immediate&&!inCash) return i;\n    for(var k=0;k<entries.length;k++) if(inCash?entries[k]>i:entries[k]>=i) return entries[k];"));
c=one(c,"u+=p.amt/navAt(p.inv); cb+=c0;","u+=p.amt/navF(p.inv); cb+=c0;");
c=one(c,"var doFlat=function(x,re){ if(u>1e-12){ var P=u*navAt(x);","var doFlat=function(x,re){ if(u>1e-12){ var P=u*navF(x);");
c=one(c,"    var flats=[]; if(manI!=null) flats.push({i:manI,re:true});","    var flats=[]; mans.forEach(function(m){ flats.push({i:m,re:true}); });");
c=one(c,"if(r>1e-9&&u>1e-12){ var nv=navAt(x), sold=","if(r>1e-9&&u>1e-12){ var nv=navF(x), sold=");
c=one(c,"    var nv2=navAt(b), invested=u*nv2,","    var nv2=navF(b), invested=u*nv2,");
c=one(c,"  else if(manI!=null){ var pm=stateAt(manI).pnl; if(pm>hwm) hwm=pm; if(!exits.length||exits[exits.length-1]<manI) realized=pm; }","  else if(mans.length){ mans.forEach(function(m){ var pm=stateAt(m).pnl; if(pm>hwm) hwm=pm; }); var lm=mans[mans.length-1]; if(!exits.length||exits[exits.length-1]<lm) realized=stateAt(lm).pnl; }");
t=t.slice(0,i0)+c+t.slice(i1);
// F4: 끝난 계좌의 반영 열
t=one(t,"if(l.inv==null) return '다음 진입 대기';","if(l.inv==null||(d.stopI!=null&&l.inv>d.stopI)) return c2.status==='active'&&d.stopI==null?'다음 진입 대기':'투입 전 회수';");
fs.writeFileSync(F,t); console.log('ok');
