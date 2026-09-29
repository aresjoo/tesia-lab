// 그래프 기준(고른 기간 첫날에 1,000)과 따라가기 계산의 결함 F1~F4
const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
const CR=String.fromCharCode(13), LF=String.fromCharCode(10), nl=s=>s.split(CR+LF).join(LF).split(LF).join(CR+LF);
const cnt=(s,x)=>s.split(x).length-1;
const one=(s,x,y,n)=>{ const c=cnt(s,x); if(c!==(n||1)) throw new Error('x'+c+': '+x.slice(0,70)); return s.split(x).join(y); };
// ── 원본(rd 블록)
let s=fs.readFileSync(D+'rd-ui.js','utf8'), src='rd-ui.js';
if(cnt(s,'function cpClose(')!==1){ throw new Error('cpClose not in rd-ui.js'); }
s=one(s,"return pts.map(function(p){ return {d:mkdDate(p.i), y:MKD.tab==='ret'?(p.v/base-1)*100:MKD.tab==='pnl'?1000*(p.v-base):1000*p.v}; });",
        "return pts.map(function(p){ return {d:mkdDate(p.i), y:MKD.tab==='ret'?(p.v/base-1)*100:MKD.tab==='pnl'?1000*(p.v/base-1):1000*p.v/base}; });");
s=one(s,"   잔고는 1,000 USDT 로 시작한 계좌의 그 시점 금액이고, 수익금은 고른 기간 동안 그 계좌에서 늘거나 준 금액이다 */",
        "   잔고와 수익금도 같은 기준이다: 고른 기간의 첫날에 1,000 USDT 를 넣은 계좌(전체 기간은 시작한 날). 그래서 세 값이 서로 맞는다 */");
s=one(s,"h.textContent=MKD.tab==='ret'?'':'1,000 USDT로 시작했다면';","h.textContent=MKD.tab==='ret'?'':mkdHintTxt();");
s=one(s,"function mkdSet(k,v){","function mkdHintTxt(){ return MKD.per?MK_PER_L[MKD.per].replace('최근 ','')+' 전에 1,000 USDT를 넣었다면':'시작한 날에 1,000 USDT를 넣었다면'; }\nfunction mkdSet(k,v){");
s=one(s,"['pnl','수익금','처음에 1,000 USDT로 시작한 계좌에서, 고른 기간 동안 늘거나 줄어든 금액이에요. 수수료를 뺀 금액이에요.'],['bal','잔고','처음에 1,000 USDT로 시작한 계좌에 그날 들어 있던 금액이에요. 아래 거래내역의 금액과 같은 기준이에요.']",
        "['pnl','수익금','고른 기간의 첫날에 1,000 USDT를 넣었다면 늘거나 줄어든 금액이에요. 수수료를 뺀 금액이에요.'],['bal','잔고','고른 기간의 첫날에 1,000 USDT를 넣었다면 그날 계좌에 들어 있던 금액이에요.']");
// 끝내기는 끝 봉(endI)에, 새 진입 멈춤은 멈춘 봉(stopI)에 적는다. 수동 정리 봉(flatI)과 섞지 않는다
s=one(s,"if(s2&&s2.r&&s2.r.eq&&s2.r.eq.length&&c2.flatI==null) c2.flatI=s2.r.eq[s2.r.eq.length-1].i;","if(s2&&s2.r&&s2.r.eq&&s2.r.eq.length) c2.endI=s2.r.eq[s2.r.eq.length-1].i;");
s=one(s,"c2.ledger.push({at:Date.now(),type:'out',amt:back,i:c2.flatI});","c2.ledger.push({at:Date.now(),type:'out',amt:back,i:c2.endI});");
s=one(s,"  c2.winding=true; c2.windAt=Date.now();","  c2.winding=true; c2.windAt=Date.now(); { var sw=tfSSFind(c2.nick); if(sw&&sw.r&&sw.r.eq&&sw.r.eq.length) c2.stopI=sw.r.eq[sw.r.eq.length-1].i; }");
s=one(s,"['simStartI','flatI'].forEach(","['simStartI','flatI','endI','stopI'].forEach(");
s=one(s,"  var c=s2.cfg||{}, st=(s2.r&&s2.r.state)||{}, o=st.open, list=!o?[]:o.length!=null?o:[o], up=d.unreal>=0;","  var c=s2.cfg||{}, st=(s2.r&&s2.r.state)||{}, o=st.open, list=!o?[]:o.length!=null?o:[o], up=d.unreal>=0;\n  if(d.stopI!=null) list=list.filter(function(x){ return x.entry==null||x.entry<=d.stopI; }); /* 새 진입을 멈춘 뒤에 원본이 산 종목은 내 포지션이 아니다 */");
fs.writeFileSync(D+'rd-ui.js',s);
// ── 본문(cpCalc 등)
let t=fs.readFileSync(F,'utf8');
if(t.includes('var endBar=')) throw new Error('already');
const i0=t.indexOf('function cpCalc(c2){'), i1=t.indexOf('function cpAddNote(',i0); if(i0<0||i1<0) throw new Error('cpCalc');
let c=t.slice(i0,i1);
c=one(c,"  var startI=c2.simStartI!=null?c2.simStartI:eq[eq.length-31].i;",nl("  var startI=c2.simStartI!=null?c2.simStartI:eq[eq.length-31].i;\n  /* 끝 봉(endBar): 따라가기를 끝낸 봉. 수동 정리 봉(manI): 따라가는 중에 포지션만 정리한 봉, 다음 진입부터 다시 들어간다.\n     멈춘 봉(stopI): 새 진입을 멈춘 봉. 그때 들고 있던 포지션이 모두 끝나는 봉(windEnd)까지만 따라간다 */\n  var endBar=c2.endI!=null?c2.endI:(c2.status==='closed'&&c2.flatI!=null?c2.flatI:null);\n  var manI=(c2.flatI!=null&&!(c2.endI==null&&c2.status==='closed'))?c2.flatI:null;\n  var stopI=(c2.winding&&c2.status==='active')||c2.stopI!=null?(c2.stopI!=null?c2.stopI:T):null;"));
c=one(c,"  entries=entries.filter(function(i){ return i!=null; }).sort(function(a,b){ return a-b; });",nl("  entries=entries.filter(function(i){ return i!=null; }).sort(function(a,b){ return a-b; });\n  var windEnd=null;\n  if(stopI!=null){ var held=(s2.r.trades||[]).filter(function(x){ return x.entry<=stopI&&x.exit!=null&&x.exit>stopI; }), stillOpen=(op?(op.length!=null?op:[op]):[]).some(function(o){ return o&&o.entry!=null&&o.entry<=stopI; });\n    windEnd=stillOpen?null:(held.length?Math.max.apply(null,held.map(function(x){ return x.exit; })):stopI); }"));
c=one(c,"    if(immediate&&(c2.flatI==null||i<c2.flatI)) return i;","    if((endBar!=null&&i>=endBar)||(stopI!=null&&i>stopI)) return null;\n".replace('\n',CR+LF)+"    if(immediate&&(manI==null||i<manI)) return i;");
c=one(c,"    var after=c2.flatI!=null&&i>=c2.flatI, from=after?Math.max(i,c2.flatI):i;","    var after=manI!=null&&i>=manI, from=after?Math.max(i,manI):i;");
const a0=c.indexOf("    var u=0,cb=0,w=0,cbw=0,dep=0,wd=0,pend=[],flat=false;"), a1m="    conv(b); if(c2.flatI!=null&&c2.flatI<=b) doFlat(c2.flatI);", a1=c.indexOf(a1m); if(a0<0||a1<0) throw new Error('stateAt');
c=c.slice(0,a0)+nl(`    var u=0,cb=0,w=0,cbw=0,dep=0,wd=0,pend=[],dead=false;
    var nextEntry=function(x){ for(var k=0;k<entries.length;k++) if(entries[k]>x) return entries[k]; return null; };
    var conv=function(x){ if(dead) return; pend=pend.filter(function(p){ if(p.inv!=null&&p.inv<=x&&(stopI==null||p.inv<=stopI)){ var c0=p.cost!=null?p.cost:p.amt; u+=p.amt/navAt(p.inv); cb+=c0; w-=p.amt; cbw-=c0; return false; } return true; }); };
    /* 정리: 좌수를 그 봉의 기준가로 현금으로 바꾼다. 수동 정리(re)는 그 돈을 다음 진입의 대기금으로 두고 매입 원금도 이어 간다 */
    var doFlat=function(x,re){ if(u>1e-12){ var P=u*navAt(x); w+=P; cbw+=cb; if(re) pend.push({amt:P,cost:cb,inv:nextEntry(x)}); u=0; cb=0; } if(!re) dead=true; };
    var flats=[]; if(manI!=null) flats.push({i:manI,re:true}); if(windEnd!=null) flats.push({i:windEnd,re:false}); if(endBar!=null) flats.push({i:endBar,re:false});
    var bars=[]; ev.forEach(function(e){ if(e.i<=b&&bars.indexOf(e.i)<0) bars.push(e.i); });
    flats.forEach(function(f){ if(f.i<=b&&bars.indexOf(f.i)<0) bars.push(f.i); });
    bars.sort(function(a,b2){ return a-b2; });
    bars.forEach(function(x){
      ev.forEach(function(e){ if(e.i===x&&e.type==='add'){ dep+=e.amt; w+=e.amt; cbw+=e.amt; pend.push({amt:e.amt,inv:e.inv}); } });
      conv(x);
      flats.forEach(function(f){ if(f.i===x) doFlat(x,f.re); });
      ev.forEach(function(e){ if(e.i===x&&e.type!=='add'){
        var r=e.amt; wd+=e.amt;
        var fw=Math.min(r,Math.max(0,w)); /* 대기 현금부터 뺀다 */
        if(fw>0){ var k2=(w-fw)/w; cbw*=k2; pend.forEach(function(p){ p.amt*=k2; if(p.cost!=null) p.cost*=k2; }); w-=fw; r-=fw; }
        if(r>1e-9&&u>1e-12){ var nv=navAt(x), sold=Math.min(u,r/nv); cb-=cb*(sold/u); u-=sold; } /* 나머지는 좌수를 판다. 평균 매입 원금도 같은 비율로 줄인다 */
      } });
    });
    conv(b);`)+c.slice(a1+a1m.length);
c=one(c,"  var endI=c2.flatI!=null?c2.flatI:T, pnlPct=","  var endI=endBar!=null?endBar:(windEnd!=null?windEnd:T), pnlPct=");
c=one(c,"  if(c2.flatI!=null){ realized=total; if(total>hwm) hwm=total; }","  if(endBar!=null||windEnd!=null){ realized=total; if(total>hwm) hwm=total; }"+CR+LF+"  else if(manI!=null){ var pm=stateAt(manI).pnl; if(pm>hwm) hwm=pm; if(!exits.length||exits[exits.length-1]<manI) realized=pm; } /* 수동 정리도 손익을 확정한다 */");
c=one(c,"  var posOpen=c2.flatI==null&&S.units>1e-9&&hasOpen;","  var posOpen=endBar==null&&windEnd==null&&S.units>1e-9&&hasOpen;");
c=one(c,"S.invested*(c2.flatI!=null?1:cashRatio)","S.invested*(endBar!=null?1:cashRatio)");
c=one(c,"entriesYear:entries.filter(function(i){ return i>T-365; }).length,lots:lots,at:stateAt};","entriesYear:entries.filter(function(i){ return i>T-365; }).length,lots:lots,at:stateAt,stopI:stopI,windEnd:windEnd,endBar:endBar};");
if(c.includes('c2.flatI')&&cnt(c,'c2.flatI')!==cnt(c,'c2.flatI!=null?c2.flatI:null')+cnt(c,'(c2.flatI!=null&&!(')+0) console.log('note: flatI refs left', cnt(c,'c2.flatI'));
t=t.slice(0,i0)+c+t.slice(i1);
t=one(t,"endI=c2.flatI!=null?c2.flatI:1e15;","endI=c2.endI!=null?c2.endI:(c2.status==='closed'&&c2.flatI!=null?c2.flatI:1e15);",2);
// F3, F4
t=one(t,"  if(d.waiting>0.005) h+='<div class=\"cpx-sumline\">투자 중 ","  if(c2.status!=='active') return h; /* 끝낸 따라가기에는 기다리는 돈이 없다 */"+CR+LF+"  if(d.waiting>0.005) h+='<div class=\"cpx-sumline\">투자 중 ");
t=one(t,"(gap<0?'기준가가 높을 때 추가한 금액이 있어서 전략보다 낮아요.':'기준가가 낮을 때 추가한 금액이 있어서 전략보다 높아요.')","(d.waiting>0.05*Math.max(1,d.value)?'넣은 돈 중 '+cpUsd(d.waiting,0)+'가 아직 다음 진입을 기다리고 있어서 전략과 달라요.':gap<0?'기준가가 높을 때 추가한 금액이 있어서 전략보다 낮아요.':'기준가가 낮을 때 추가한 금액이 있어서 전략보다 높아요.')");
t=one(t,"'<div class=\"cpx-sumline\">예산 추가와 회수 '+rows.length+'건 (최근 180일).'+(d.waiting>0.005?","'<div class=\"cpx-sumline\">예산 추가와 회수 '+rows.length+'건 (최근 180일).'+(c2.status==='active'&&d.waiting>0.005?");
fs.writeFileSync(F,t); console.log('ok');
