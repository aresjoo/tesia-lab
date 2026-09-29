
/* ── 상세를 한 페이지로: 성과(지표, 그래프, 달력) → 판단 기록 → 거래내역. 탭은 개요와 정보. 거래내역 전체는 따로 연다 ── */
MK_TAB_OK={ov:1,info:1,trades:1}; /* 성과, 활동 탭은 없앴다. 옛 주소는 개요로 */
var MK_PER_L={7:'최근 7일',30:'최근 30일',90:'최근 3개월',365:'최근 1년',0:'전체 기간'};
/* 지표 넷은 그래프에서 고른 기간을 따른다 */
function mkOvKpi(s,per){
  var r=per?mkSlice(s,per):s.r, w=(typeof r.winRate==='number'&&(r.n||0)>=5)?Math.round(r.winRate)+'%':'-';
  return mkKpi4('mk3-kpis num','',[MK_PER_L[per]+' 수익률','ret',mkPct0(r.ret),mkSign(r.ret)],['최대 낙폭','mdd',r.mdd.toFixed(1)+'%'],['승률','win',w],['거래 수','n',Number(r.n||0).toLocaleString()+'회']);
}
function mkdSet(k,v){
  MKD[k]=v; var c=$('mkd-ctl'), h=$('mkd-hint'), g=$('mkd-chart'), q=$('mk3-kpi-host');
  if(c) c.innerHTML=mkdCtlHtml(); if(h) h.textContent=MKD.tab==='ret'?'':'1,000 USDT로 시작했다면';
  if(g){ g.classList.remove('hov'); g.innerHTML=mkdChartHtml(); }
  if(k==='per'&&q&&MKD.s) q.innerHTML=mkOvKpi(MKD.s,MKD.per);
}
function mkOvTab(s,r,pd,ne){
  var R0=s.r||r, eq=mkDaily(R0.eq||[],PRICE0.length-1); MKD.eq=eq; MKD.tab='ret'; MKD.gran='day'; MKD.per=30; MKD.s=s.cfg?s:null;
  var chart='<div class="mkd-ctl" id="mkd-ctl">'+mkdCtlHtml()+'</div><p class="mkd-hint" id="mkd-hint"></p><div class="mkd-chart" id="mkd-chart" onpointermove="mkdHover(event)" onpointerdown="mkdHover(event)" onpointerleave="mkdHover(null)">'+mkdChartHtml()+'</div>';
  if(!s.cfg) return '<div class="mk3-ov"><section class="mk3-sec" style="margin-top:0"><h3>성과</h3>'+chart+'</section>'+mkOrdersSec(s,ne)+'</div>';
  return '<div class="mk3-ov">'
    +'<section class="mk3-sec" style="margin-top:0"><h3>성과</h3>'
    +'<div id="mk3-kpi-host">'+mkOvKpi(s,30)+'</div>'
    +chart+'<p class="mk3-since num">'+mkdSince(s)+' 시작 이후 '+mkPct0(R0.ret)+'</p>'
    +'<div class="mk3-cal" id="ss3-cal-host">'+tfSS3CalHtml(R0,0)+'</div></section>'
    +mkChatHtml(s,R0,ne,pd)
    +mkOrdersSec(s,ne)
    +'</div>';
}
/* 거래내역: 주문 한 건이 한 줄. 끝난 거래의 매수와 매도, 지금 들고 있는 종목의 매수. 금액과 수량은 1,000 USDT 로 시작한 기준 */
function mkWhen(s,i,a,salt){
  var cr=a?!!MK_CRYPTO[a]:(s.mkt==='crypto'||s.mkt==='multi'), d=idxToDate(i), h=0, k=String(s.id||s.nick)+'|'+i+'|'+(salt||0);
  for(var x=0;x<k.length;x++) h=(h*31+k.charCodeAt(x))>>>0;
  var t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),cr?0:20,0,2+h%47)), p=function(n){ return (n<10?'0':'')+n; };
  return t.getFullYear()+'.'+p(t.getMonth()+1)+'.'+p(t.getDate())+' '+p(t.getHours())+':'+p(t.getMinutes());
}
function mkOrders(s){
  var r=s.r||{}, o=[], st=r.state, W=mkWords(s), B=1000;
  (r.trades||[]).forEach(function(t){
    if(t.units==null||t.ep==null) return;
    o.push({i:t.entry,side:'in',a:t.asset,px:t.ep,q:t.units*B,sum:t.cost*B,id:t.id});
    o.push({i:t.exit,side:'out',a:t.asset,px:t.xp,q:t.units*B,sum:t.got*B,id:t.id,pnl:t.pnl*100});
  });
  var op=!st?[]:st.open&&st.open.length!=null?st.open:st.open?[st.open]:[];
  op.forEach(function(p){ if(p.units!=null) o.push({i:p.entry,side:'in',a:p.k,px:p.ep,q:p.units*B,sum:p.cost*B,id:p.tid,open:true}); });
  o.sort(function(x,y){ return y.i-x.i||(x.side===y.side?y.id-x.id:(x.side==='out'?1:-1)); });
  o.forEach(function(x){ x.label=x.side==='in'?W.buy:W.sell; x.when=mkWhen(s,x.i,x.a,x.id+(x.side==='in'?0:7)); });
  return o;
}
function mkQty(v){ var a=Math.abs(v); return a>=1000?Math.round(v).toLocaleString():a>=10?v.toFixed(2):a>=0.1?v.toFixed(3):v.toFixed(5); }
function mkOrdersTable(s,rows){
  return '<div class="mk-tblw"><table class="ss3-tbl mko-tbl"><thead><tr><th>종목</th><th>구분</th><th>시간</th><th class="r">가격</th><th class="r">수량</th><th class="r">합계</th></tr></thead><tbody>'
    +(rows.length?rows.map(function(x){
      return '<tr class="'+(x.side==='in'?'in':'out')+'"><td><span class="mko-s" aria-hidden="true">'+(x.side==='in'?'+':'−')+'</span><b>'+gEsc(x.a)+'</b></td><td>'+x.label+(x.open?'<small> 보유 중</small>':'')+'</td><td class="num">'+x.when+'</td>'
        +'<td class="num r">'+mkPxU(x.a,x.px)+'</td><td class="num r">'+mkQty(x.q)+'</td><td class="num r">'+Math.round(x.sum).toLocaleString()+' USDT'+(x.pnl!=null?'<small class="'+(x.pnl>=0?'up':'dn')+'"> '+mkPct0(x.pnl)+'</small>':'')+'</td></tr>'; }).join('')
      :'<tr><td colspan="6" class="mko-e">아직 거래가 없어요</td></tr>')
    +'</tbody></table></div>';
}
function mkOrdersSec(s,ne){
  var o=s.cfg?mkOrders(s):[];
  if(!s.cfg) return '<section class="mk3-sec mko"><div class="mk3-sec-h"><h3>거래내역</h3></div>'+mkTradesTable(s,s.r,5)+'</section>';
  return '<section class="mk3-sec mko"><div class="mk3-sec-h"><h3><button type="button" class="mko-go" onclick="tfSS3Go(\''+ne+'\',\'all\',\'trades\')">거래내역<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></h3><span class="mko-n num">전체 '+o.length.toLocaleString()+'건, 1,000 USDT로 시작한 기준</span></div>'
    +mkOrdersTable(s,o.slice(0,5))+'</section>';
}
/* 거래내역 전체 화면 */
var MK_ORD_N=30;
function mkTradesTab(s,r,pd,ne){
  if(!s.cfg) return '<div class="mk-sec-hd"><b>거래내역</b></div>'+mkTradesTable(s,s.r);
  var o=mkOrders(s); MK_ORD_N=30; window.MK_ORD_S=s;
  return '<div class="mko mko-all"><button type="button" class="mk-lnk mko-back" onclick="tfSS3Go(\''+ne+'\',\'all\',\'ov\')">← 개요로</button>'
    +'<div class="mk3-sec-h"><h3>거래내역</h3><span class="mko-n num">전체 '+o.length.toLocaleString()+'건, 1,000 USDT로 시작한 기준</span></div>'
    +'<div id="mko-host">'+mkOrdersTable(s,o.slice(0,MK_ORD_N))+'</div>'
    +(o.length>MK_ORD_N?'<button type="button" class="mkc-more mko-more" id="mko-more" onclick="mkOrdMore()">이전 거래 더 보기</button>':'')+'</div>';
}
function mkOrdMore(){ var s=window.MK_ORD_S, h=$('mko-host'), b=$('mko-more'); if(!s||!h) return; var o=mkOrders(s); MK_ORD_N+=50; h.innerHTML=mkOrdersTable(s,o.slice(0,MK_ORD_N)); if(b&&MK_ORD_N>=o.length) b.remove(); }
