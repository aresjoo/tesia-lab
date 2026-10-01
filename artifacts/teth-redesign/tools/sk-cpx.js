/* ═══ 복사한 전략 상세를 ChatGPT 구조로 (sk-cpx) ═══
   위에서 아래로: 뒤로 → 전략 이름과 한 줄 → 현재 금액, 총손익, 내 수익률 → 원본 비교 한 줄 → 흰 알약 하나와 밑줄 링크
   → 금액 상세(접힘) → 현재 포지션(항상) → 탭 두 개(거래 기록, 예산 내역). 계산은 cpCalc 그대로. 결정 기록 qa/gpt-skin/cpx/DECISIONS.md */
var CPX_KIND={sl:'손절 조건',tp:'목표가 도달',time:'보유 기간 종료',trail:'고점 대비 되돌림',rot:'종목 교체'};
function cpxDate(ms){ var t=new Date(ms); return t.getFullYear()+'년 '+(t.getMonth()+1)+'월 '+t.getDate()+'일'; }
function cpxDot(t){ return t.getFullYear()+'. '+(t.getMonth()+1)+'. '+t.getDate()+'.'; }
function cpxSgn(v,dd){ return (v>0.004?'+':'')+cpUsd(v,dd); }
function cpxCls(v){ return Math.abs(v)<0.005?'':v>0?' u':' d'; }
function cpxSym(c2,k){ if(k) return mkTk(k); var p=(c2.pairs&&c2.pairs[0])||''; return String(p).replace(/\/USDT?$/,''); }
function cpxSide(x){ return (x.side<0?'숏':'롱')+(x.lev>1?' '+x.lev+'배':''); }
function cpxRow(l,ls,r,rs,cls){ return '<div class="cq-row"><div class="a"><b>'+l+'</b>'+(ls?'<span>'+ls+'</span>':'')+'</div><div class="z"><b class="num'+(cls||'')+'">'+r+'</b>'+(rs?'<span class="num">'+rs+'</span>':'')+'</div></div>'; }
function cpxEmpty(t,s){ return '<div class="cq-list"><div class="cq-row cq-none"><div class="a"><b>'+t+'</b>'+(s?'<span>'+s+'</span>':'')+'</div></div></div>'; }
/* 내 돈이 실제로 들어간 원본 거래만 */
function cpxTrades(c2,d){
  var s2=tfSSFind(c2.nick); if(!s2) return [];
  var startI=c2.simStartI!=null?c2.simStartI:0, endI=c2.endI!=null?c2.endI:(c2.status==='closed'&&c2.flatI!=null?c2.flatI:1e15);
  return (s2.r.trades||[]).filter(function(x){ var e=(x.exit!=null?x.exit:x.entry); return e>=startI&&e<=endI; })
    .map(function(x){ var inv=d.at(x.entry).invested*(x.w!=null?x.w:1); return {x:x,inv:inv,pnl:x.pnl*inv}; })
    .filter(function(r){ return r.inv>0.005; }).reverse();
}
function cpxPos2(c2,d){
  var s2=tfSSFind(c2.nick), on=c2.status==='active';
  var hd=function(n,act){ return '<div class="cq-sh"><h2>'+(n?'현재 포지션 '+n+'건':'현재 포지션')+'</h2>'+(act||'')+'</div>'; };
  if(!s2||!d.posOpen||!on) return hd(0)+cpxEmpty('현재 포지션 없음',on?(c2.winding?'새 진입을 멈췄습니다. 남은 포지션이 없습니다.':''):'복사를 중단해 포지션이 없습니다.');
  var c=s2.cfg||{}, st=(s2.r&&s2.r.state)||{}, o=st.open, list=!o?[]:o.length!=null?o:[o];
  if(d.stopI!=null) list=list.filter(function(x){ return x.entry==null||x.entry<=d.stopI; });
  var wsum=list.reduce(function(a,x){ return a+(x.w!=null?x.w:1); },0)||1;
  var rule=fuIs(s2)?(c.trail?'유리한 가격에서 '+c.trail+'% 되돌리면 종료':c.sl?'진입가에서 '+c.sl+'% 불리하면 종료':c.exitN?c.exitN+'일 기준선 이탈 때 종료':'방향이 바뀌면 종료'):s2.kind==='agent'?'고점에서 '+c.trail+'% 밀리면 종료':(c.sl!=null?'손절 '+c.sl+'%, 익절 +'+c.tp+'%':(s2.p?'손절 '+s2.p.sl+'%, 익절 +'+s2.p.tp+'%':'원본과 같은 조건'));
  var rows=list.map(function(x){ var w=(x.w!=null?x.w:1)/wsum, u=d.unreal*w;
    return cpxRow(gEsc(cpxSym(c2,x.k))+' '+cpxSide(x),'반영 금액 '+cpUsd(d.invested*w,0)+', 진입가 '+mkPxFmt(x.ep)+', 현재가 '+mkPxFmt(x.px)+'<br>'+rule,cpxSgn(u),'원본 수익률 '+mkPct0(x.chg,1),cpxCls(u)); }).join('');
  if(!rows) rows=cpxRow(gEsc(cpxSym(c2))+' 롱','반영 금액 '+cpUsd(d.invested,0)+'<br>'+rule,cpxSgn(d.unreal),'',cpxCls(d.unreal));
  return hd(list.length||1,'<button type="button" class="cq-gray" onclick="cpFlatDlg(\''+c2.id+'\')">'+(c2.winding?'포지션 정리 후 복사 종료':'포지션 전체 정리')+'</button>')+'<div class="cq-list">'+rows+'</div>';
}
function cpxTradesTab(c2,d){
  var L=cpxTrades(c2,d);
  if(!L.length) return cpxEmpty('종료된 거래가 없습니다','참여한 거래가 종료되면 여기에 표시합니다.');
  return '<div class="cq-list">'+L.slice(0,40).map(function(r){ var x=r.x, ex=x.exit!=null?x.exit:x.entry;
    return '<details class="cq-row cq-det"><summary><div class="a"><b>'+gEsc(cpxSym(c2,x.asset))+' '+cpxSide(x)+'</b><span>'+cpxDot(idxToDate(ex))+' 종료, '+(CPX_KIND[x.kind]||'종료 조건')+'</span></div>'
      +'<div class="z"><b class="num'+cpxCls(r.pnl)+'">'+cpxSgn(r.pnl)+'</b><span class="num">원본 수익률 '+mkPct0(x.pnl*100,1)+'</span></div></summary>'
      +'<div class="cq-more"><span>진입 '+cpxDot(idxToDate(x.entry))+', 원본 진입가 '+mkPxFmt(x.ep)+'</span><span>원본 종료가 '+mkPxFmt(x.xp!=null?x.xp:x.ep)+', 반영 금액 '+cpUsd(r.inv,0)+'</span></div></details>'; }).join('')+'</div>';
}
function cpxBudgetTab(c2,d){
  var rows=c2.ledger.map(function(e,ix){ return {e:e,ix:ix}; }).reverse();
  if(!rows.length) return cpxEmpty('예산 변경이 없습니다','');
  var when=function(r){ var l=(d.lots||[])[r.ix]; if(r.e.type!=='add'||!l) return ''; if(l.inv==null||(d.stopI!=null&&l.inv>d.stopI)) return c2.status==='active'&&d.stopI==null?'진입 대기':'반영 전 회수'; if(l.inv===l.i) return '즉시 반영'; return cpxDot(idxToDate(l.inv))+' 진입'; };
  return '<div class="cq-list">'+rows.map(function(r){ var e=r.e, add=e.type==='add'; var t=new Date(e.at), p=function(n){ return (n<10?'0':'')+n; };
    return cpxRow(add?'예산 추가':'예산 회수',cpxDot(t)+' '+p(t.getHours())+':'+p(t.getMinutes()),(add?'+':'-')+cpUsd(e.amt,e.amt%1?2:0),when(r),''); }).join('')+'</div>';
}
function cpxStatus(c2){ return c2.status!=='active'?'복사 중단됨':c2.winding?'종료 대기':'복사 중'; }
function cpxView(cid,tab){
  var c2=cpFind(cid);
  if(!c2){ toast('전략 복사 기록을 찾을 수 없습니다'); TF_ONSHARE=false; try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} tfShareHub('follow'); return; }
  tfSS3DlgClose(true);
  TF_ONSHARE=true; TF_ONSTRAT=false; window.TF_ONNF=false;
  G.cur=null; G.mode='tfcpx'; G.tabs=[]; G.activeTab=null;
  document.body.classList.remove('kb-open'); gComposer(false);
  $('g-aux').style.display='none'; gSideRender(); gTabsRender();
  gChead('','',null);
  tab=(tab==='bal')?'bal':'tr';
  var d=cpCalc(c2), m=cpMeta(c2.nick), ne=tfSSNe(c2.nick), on=c2.status==='active', s2=tfSSFind(c2.nick);
  var title=s2?mkTitle(s2):c2.nick;
  /* 한 줄 설명: 상태에 따라 하나 */
  var line=!on?cpxDate(c2.closedAt||c2.at)+'에 복사를 중단했습니다.'
    :c2.winding?'새 진입을 멈췄습니다. 열린 포지션은 '+(c2.stopMode==='wait'?'원본 전략이 종료할 때 함께 정리합니다.':'직접 정리할 때까지 남아 있습니다.')
    :cpxDate(c2.at)+'부터 복사 중입니다.';
  /* 원본 비교: 원인을 단정하지 않는다 */
  var cmp='';
  if(!d.missing&&d.grossIn>0){
    var why=on&&d.waiting>0.005?'원본 전략이 다음에 진입하면 예산 '+cpUsd(d.waiting,0)+'을 반영합니다.':Math.abs((d.myPct-d.pnlPct)*100)>=1?'내 수익률에는 예산을 넣고 뺀 시점이 반영됩니다.':'';
    cmp='<p class="cq-cmp">같은 기간 원본 수익률 <b class="num'+cpxCls(d.pnlPct)+'">'+mkPct0(d.pnlPct*100,1)+'</b></p>'+(why?'<p class="cq-why">'+why+'</p>':'');
  }
  var acts=on&&!c2.winding?'<div class="cq-acts"><button type="button" class="cq-cta" onclick="cpAdjDlg(\''+cid+'\')">예산 조정</button>'
      +'<button type="button" class="pl-link" onclick="cpEditSheet(\''+cid+'\')">설정</button>'
      +'<button type="button" class="pl-link" onclick="cpCloseDlg(\''+cid+'\')">복사 중단</button></div>'
    :on&&c2.winding?'<div class="cq-acts"><button type="button" class="cq-cta" onclick="cpFlatDlg(\''+cid+'\')">포지션 정리 후 복사 종료</button></div>':'';
  var det=[['회수 가능 금액',d.avail,0]].concat(on&&d.waiting>0.005?[['진입 대기 금액',d.waiting,0]]:[]).concat([['미실현 손익',d.unreal,1],['실현 손익',d.realized,1]]).concat(m.share>0?[['수익 분배 지급',d.share,0]]:[]).concat([['넣은 금액',d.inv,0]]);
  TF_RENDERING=true; document.body.classList.remove('tf-route');
  gContent('<div class="tf-page cq-page cpx">'
    +'<button type="button" class="cq-back" onclick="TF_ONSHARE=false;try{history.replaceState(null,\'\',location.pathname+location.search);}catch(e){}tfShareHub(\'follow\')">← 복사한 전략</button>'
    +'<header class="cq-hd"><h1>'+gEsc(title)+'</h1><p>'+line+' <button type="button" class="pl-link" onclick="cpProfileGo(\''+ne+'\')">원본 전략 보기</button></p></header>'
    +(d.missing?'<p class="cq-why">전략 기록을 불러올 수 없습니다. 넣은 금액 '+cpUsd(d.inv,0)+'은 그대로 있습니다.</p>'
      :'<section class="cq-hero"><small>현재 금액 <i>'+cpxStatus(c2)+'</i></small><div class="big num">'+cpUsd(d.est)+'</div>'
      +'<div class="cq-pl"><span>총손익 <b class="num'+cpxCls(d.net)+'">'+cpxSgn(d.net)+'</b></span><span>내 수익률 <b class="num'+cpxCls(d.myPct)+'">'+mkPct0(d.myPct*100,1)+'</b></span></div>'+cmp+'</section>')
    +acts
    +(d.missing?'':'<details class="cq-amt"><summary>금액 상세</summary><div class="cq-list">'+det.map(function(r){ return cpxRow(r[0],'',r[2]?cpxSgn(r[1]):cpUsd(r[1]),'',r[2]?cpxCls(r[1]):''); }).join('')+'</div></details>')
    +'<section class="cq-sec">'+cpxPos2(c2,d)+'</section>'
    +'<section class="cq-sec"><div class="cq-tabs" role="tablist">'
    +[['tr','거래 기록'],['bal','예산 내역']].map(function(t2){ return '<button type="button" role="tab" aria-selected="'+(tab===t2[0])+'" class="'+(tab===t2[0]?'on':'')+'" onclick="cpxTab(\''+cid+'\',\''+t2[0]+'\')">'+t2[1]+'</button>'; }).join('')+'</div>'
    +'<div id="cq-tabb">'+(tab==='bal'?cpxBudgetTab(c2,d):cpxTradesTab(c2,d))+'</div></section>'
    +'<p class="cq-help">막히면 상담원이 24시간 답합니다. <button type="button" class="pl-link" onclick="tfTxHelp()">상담원에게 묻기</button></p>'
    +'</div>');
  TF_RENDERING=false;
}
/* 탭을 바꿔도 스크롤 위치를 지킨다: 그 부분만 다시 그린다 */
function cpxTab(cid,tab){ var c2=cpFind(cid); if(!c2) return; var d=cpCalc(c2), b=$('cq-tabb'); if(!b){ cpDetailGo(cid,tab); return; }
  b.innerHTML=tab==='bal'?cpxBudgetTab(c2,d):cpxTradesTab(c2,d);
  [].forEach.call(document.querySelectorAll('.cq-tabs button'),function(x){ var on=x.getAttribute('onclick').indexOf("'"+tab+"'")>=0; x.classList.toggle('on',on); x.setAttribute('aria-selected',String(on)); });
  var r='#/share/c/'+cid+(tab==='bal'?'/bal':''); try{ history.replaceState(null,'',location.pathname+location.search+r); }catch(e){} }
(function(){
  var v0=cpDetailView; cpDetailView=function(cid,tab){ var r=cpxView(cid,tab); var sc=$('g-scroll'); if(sc) sc.scrollTop=0; return r; };
  /* 설정 창: 복사 방식과 시작일은 여기서 */
  cpEditSheet=function(cid){ var c2=cpFind(cid); if(!c2) return;
    tfSS3Dlg('복사 설정','<div class="cq-list cq-dlg">'
      +cpxRow('복사 방식','','원본 비율','','')
      +cpxRow('시작일','',cpxDot(new Date(c2.at)),'','')
      +cpxRow('따라갈 종목','',gEsc((c2.pairs||[]).map(function(p){ return String(p).replace(/\/USDT?$/,''); }).join(', ')),'','')
      +cpxRow('손실 중단 기준','',Math.abs((c2.adv&&c2.adv.maxLoss)||-20)+'%','','')
      +'</div><p class="cq-why" style="margin:14px 0 0">손실 중단 기준은 복사를 중단한 뒤 다시 시작할 때 바꿀 수 있습니다.</p>'
      +'<div class="acts3" style="margin-top:18px"><button type="button" class="obtn" onclick="tfSS3DlgClose()">닫기</button>'
      +'<button type="button" class="wbtn" onclick="tfSS3DlgClose();cpAdjDlg(\''+cid+'\')">예산 조정</button></div>'); };
})();

/* ═══ 터미널 아래 탭에 복사한 전략도 (포지션, 미체결 주문, 주문 내역, 체결 내역, 종료 포지션) ═══
   tfTmAll 은 내가 만든 전략만 읽는다. 복사한 전략의 열린 포지션과 내 돈이 들어간 거래를 같은 표에 더한다. */
var CPX_TH={
  pos:'<th>거래소</th><th>전략</th><th>심볼</th><th>방향</th><th class="r">수량</th><th class="r">진입가</th><th class="r">현재가</th><th class="r">손절가</th><th class="r">미실현</th><th class="r">%</th><th class="r"></th>',
  open:'<th>거래소</th><th>전략</th><th>심볼</th><th>방향</th><th>유형</th><th class="r">가격</th><th class="r">수량</th><th>상태</th><th class="r"></th>',
  orders:'<th>거래소</th><th>전략</th><th>일자</th><th>심볼</th><th>방향</th><th>유형</th><th class="r">가격</th><th class="r">수량</th><th>상태</th>',
  fills:'<th>거래소</th><th>전략</th><th>일자</th><th>심볼</th><th>방향</th><th class="r">체결가</th><th class="r">수량</th><th class="r">수수료</th>',
  closed:'<th>거래소</th><th>전략</th><th>심볼</th><th>방향</th><th class="r">진입</th><th class="r">청산</th><th class="r">보유</th><th class="r">수수료</th><th class="r">실현 손익</th>'};
function cpxTermEx(){ var ex='bitget'; try{ var cn=acS().conn||{}; var k=Object.keys(cn)[0]; if(k) ex=k; }catch(e){} return tfTmCellEx({ex:ex}); }
function cpxPxStop(s2,x){ var c=s2.cfg||{}, sl=c.sl!=null?c.sl:(s2.p&&s2.p.sl); if(sl==null||!x.ep) return null; var a=Math.abs(sl)/100; return x.side<0?x.ep*(1+a):x.ep*(1-a); }
function cpxPxTp(s2,x){ var c=s2.cfg||{}, tp=c.tp!=null?c.tp:(s2.p&&s2.p.tp); if(tp==null||!x.ep||fuIs(s2)) return null; return x.ep*(1+Math.abs(tp)/100); }
function cpxSd(side,buy){ return buy?'<span class="sd lg">BUY</span>':'<span class="sd sh">SELL</span>'; }
function cpxTermRows(k){
  var out=[];
  try{
    if(!tfS().api) return out;
    if(TF_TM.sel&&TF_TM.scope!=='all') return out;
    cpState().copies.filter(function(c){ return c.status==='active'; }).forEach(function(c2){
      var s2=tfSSFind(c2.nick); if(!s2) return; var d=cpCalc(c2); if(d.missing) return;
      var EX=cpxTermEx(), ST='<a class="stlk" onclick="cpDetailGo(&quot;'+c2.id+'&quot;)">'+gEsc(mkTitle(s2))+'</a> <span class="mut">복사</span>';
      var sym=function(kk){ return gEsc(cpxSym(c2,kk))+'USDT'; };
      if(k==='pos'||k==='open'){
        if(!d.posOpen) return;
        var o=(s2.r.state||{}).open, list=!o?[]:o.length!=null?o:[o];
        if(d.stopI!=null) list=list.filter(function(x){ return x.entry==null||x.entry<=d.stopI; });
        var wsum=list.reduce(function(a,x){ return a+(x.w!=null?x.w:1); },0)||1;
        list.forEach(function(x){ var w=(x.w!=null?x.w:1)/wsum, amt=d.invested*w, qty=x.ep?amt*(x.lev||1)/x.ep:0, u=d.unreal*w, sp=cpxPxStop(s2,x), tp=cpxPxTp(s2,x);
          var dir=x.side<0?'<span class="sd sh">SHORT</span>':'<span class="sd lg">LONG</span>';
          if(k==='pos') out.push('<tr><td>'+EX+'</td><td>'+ST+'</td><td class="num">'+sym(x.k)+'</td><td>'+dir+'</td><td class="r num">'+qty.toFixed(4)+'</td><td class="r num">'+mkPxFmt(x.ep)+'</td><td class="r num">'+mkPxFmt(x.px)+'</td><td class="r num">'+(sp?mkPxFmt(sp):'-')+'</td>'
            +'<td class="r num '+(u>=0?'u':'d')+'">'+cpxSgn(u)+'</td><td class="r num '+(x.chg>=0?'u':'d')+'">'+mkPct0(x.chg,1)+'</td><td class="r"><button class="tbtn" onclick="cpFlatDlg(&quot;'+c2.id+'&quot;)">정리</button></td></tr>');
          else {
            if(sp) out.push('<tr><td>'+EX+'</td><td>'+ST+'</td><td class="num">'+sym(x.k)+'</td><td>'+cpxSd(0,x.side<0)+'</td><td>손절 STOP</td><td class="r num">'+mkPxFmt(sp)+'</td><td class="r num">'+qty.toFixed(4)+'</td><td>대기</td><td class="r"><span class="mut">원본 규칙 주문</span></td></tr>');
            if(tp) out.push('<tr><td>'+EX+'</td><td>'+ST+'</td><td class="num">'+sym(x.k)+'</td><td>'+cpxSd(0,false)+'</td><td>익절 LIMIT</td><td class="r num">'+mkPxFmt(tp)+'</td><td class="r num">'+qty.toFixed(4)+'</td><td>대기</td><td class="r"><span class="mut">원본 규칙 주문</span></td></tr>');
          }
        });
        return;
      }
      cpxTrades(c2,d).slice(0,k==='closed'?10:8).forEach(function(r){ var x=r.x, sh=x.side<0, qty=x.ep?r.inv*(x.lev||1)/x.ep:0, xp=x.xp!=null?x.xp:x.ep, fee=x.cost?r.inv*(x.fee||0)/x.cost:0;
        var TY={sl:'손절 STOP',tp:'익절 LIMIT'}[x.kind]||'시장가';
        if(k==='orders'){
          out.push('<tr><td>'+EX+'</td><td>'+ST+'</td><td class="num">'+fmtDate(idxToDate(x.exit))+'</td><td class="num">'+sym(x.asset)+'</td><td>'+cpxSd(0,sh)+'</td><td>'+TY+'</td><td class="r num">'+mkPxFmt(xp)+'</td><td class="r num">'+qty.toFixed(4)+'</td><td><span class="okst">체결 완료</span></td></tr>');
          out.push('<tr><td>'+EX+'</td><td>'+ST+'</td><td class="num">'+fmtDate(idxToDate(x.entry))+'</td><td class="num">'+sym(x.asset)+'</td><td>'+cpxSd(0,!sh)+'</td><td>진입 시장가</td><td class="r num">'+mkPxFmt(x.ep)+'</td><td class="r num">'+qty.toFixed(4)+'</td><td><span class="okst">체결 완료</span></td></tr>');
        } else if(k==='fills'){
          out.push('<tr><td>'+EX+'</td><td>'+ST+'</td><td class="num">'+fmtDate(idxToDate(x.exit))+'</td><td class="num">'+sym(x.asset)+'</td><td>'+cpxSd(0,sh)+'</td><td class="r num">'+mkPxFmt(xp)+'</td><td class="r num">'+qty.toFixed(4)+'</td><td class="r num">'+cpUsd(fee/2)+'</td></tr>');
          out.push('<tr><td>'+EX+'</td><td>'+ST+'</td><td class="num">'+fmtDate(idxToDate(x.entry))+'</td><td class="num">'+sym(x.asset)+'</td><td>'+cpxSd(0,!sh)+'</td><td class="r num">'+mkPxFmt(x.ep)+'</td><td class="r num">'+qty.toFixed(4)+'</td><td class="r num">'+cpUsd(fee/2)+'</td></tr>');
        } else if(k==='closed'){
          out.push('<tr onclick="cpDetailGo(&quot;'+c2.id+'&quot;)" style="cursor:pointer"><td>'+EX+'</td><td>'+ST+'</td><td class="num">'+sym(x.asset)+'</td><td>'+(sh?'<span class="sd sh">SHORT</span>':'<span class="sd lg">LONG</span>')+'</td>'
            +'<td class="r num">'+mkPxFmt(x.ep)+'</td><td class="r num">'+mkPxFmt(xp)+'</td><td class="r num">'+(x.exit-x.entry)+'일</td><td class="r num">'+cpUsd(fee)+'</td>'
            +'<td class="r num '+(r.pnl>=0?'u':'d')+'">'+cpxSgn(r.pnl)+' ('+mkPct0(x.pnl*100,1)+')</td></tr>');
        }
      });
    });
  }catch(e){}
  return out;
}
(function(){
  if(typeof tfTmPane!=='function') return;
  var p0=tfTmPane; tfTmPane=function(k){ var h=p0.apply(this,arguments); if(!CPX_TH[k]) return h;
    var rows=cpxTermRows(k); if(!rows.length) return h;
    if(h.indexOf('<tbody>')>=0) return h.replace('<tbody>','<tbody>'+rows.join(''));
    var cut=h.indexOf('<div class="tft-empty'); var note=cut>0?h.slice(0,cut):'';
    return note+'<div class="tft-tblw"><table class="tft-tbl"><thead><tr>'+CPX_TH[k]+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>'; };
})();
