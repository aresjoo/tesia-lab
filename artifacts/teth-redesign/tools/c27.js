
/* ── 한 페이지 상세: Codex 검수 반영 ── */
/* 그래프 값의 기준. 수익률은 고른 기간의 첫 값이 기준이고, 전체 기간은 처음 넣은 돈(1)이 기준이다.
   잔고는 1,000 USDT 로 시작한 계좌의 그 시점 금액이고, 수익금은 고른 기간 동안 그 계좌에서 늘거나 준 금액이다 */
function mkdSeries(){
  var eq=MKD.eq||[], src=MKD.per?eq.slice(-MKD.per-1):eq.slice(); if(src.length<2) return [];
  var base=MKD.per?src[0].v:1, pts=src;
  if(MKD.gran==='month'){ var seen={}, order=[]; src.forEach(function(p){ var k=mkdDate(p.i).slice(0,7); if(!seen[k]) order.push(k); seen[k]=p; }); pts=[src[0]].concat(order.map(function(k){ return seen[k]; }).filter(function(p){ return p!==src[0]; })); }
  return pts.map(function(p){ return {d:mkdDate(p.i), y:MKD.tab==='ret'?(p.v/base-1)*100:MKD.tab==='pnl'?1000*(p.v-base):1000*p.v}; });
}
/* 달력은 어느 주소로 들어와도 전체 기록으로 그린다 */
function tfSS3CalRe(){ var c=TF_SS3_CALCTX; if(!c) return; var host=$('ss3-cal-host'); if(!host) return;
  var s=tfSSFind(c.nick); if(!s) return; host.innerHTML=tfSS3CalHtml(s.r,TF_SS3_CALM); }
/* 거래내역 전체 화면은 새 기록으로 연다(뒤로 가기 한 번이면 개요). 돌아오면 고른 기간과 보던 위치를 되살린다 */
var MK_OV_KEEP=null;
function mkGoTrades(ne){
  var sc=$('g-scroll'); MK_OV_KEEP={ne:ne,per:MKD.per,tab:MKD.tab,gran:MKD.gran,top:sc?sc.scrollTop:0};
  location.hash='#/share/s/'+ne+'/all/trades';
}
function mkBackOv(ne){ if(MK_OV_KEEP&&MK_OV_KEEP.ne===ne&&history.length>1){ history.back(); return; } tfSS3Go(ne,'all','ov'); }
function mkOvRestore(ne){
  var k=MK_OV_KEEP; if(!k||k.ne!==ne) return; MK_OV_KEEP=null;
  MKD.per=k.per; MKD.tab=k.tab; MKD.gran=k.gran; mkdSet('per',k.per);
  var sc=$('g-scroll'); if(sc) setTimeout(function(){ sc.scrollTop=k.top; },0);
}
