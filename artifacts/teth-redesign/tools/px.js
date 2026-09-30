/* ═══ 플랜 뒤 화면 (px): 거래소 선택, 계정, 승인, 확인, 한도, 완료를 화면 하나에 결정 하나로 ═══
   상태 기계(acStep, acS)는 그대로 두고 그리는 것만 바꾼다. 스텝퍼, 번호, "N단계 남았습니다", 부제 반복은 쓰지 않는다.
   모든 화면은 플랜 구성 화면과 같은 검정 배경, #303030 카드, 흰 알약 단추, 뒤로 가기 하나. */
var PX_CHEV='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
function pxCur(){ var c=acStep(); if(c==='commit'){ acCommit(); c='done'; } return c; }
function pxDoneLabel(){ var af=AC_CTX&&AC_CTX.after; return af&&af.kind==='copy'?'전략 복사 이어서 하기':af&&af.kind==='bt'?'전략 실행 이어서 하기':'전략 시작하기'; }
/* 화면마다 제목 하나, 한 줄 하나, 뒤로 가기 하나 */
function pxTitle(){
  var a=acS(), cur=pxCur(), ctx=AC_CTX||{}, n=acName(a.ex), r=acRouteNow();
  if(cur==='ex') return {h:'거래소 선택',s:'전략을 실행할 거래소를 선택합니다.',back:'plan'};
  if(cur==='acct'||cur==='guide') return {h:n+' 계정',s:'이용료 없이 연결하려면 TETH 초대로 가입한 '+n+' 계정이 필요합니다.',back:ctx.need?'plan':'ex'};
  if(cur==='auth') return {h:n+' 연결',s:n+'에서 승인하면 연결됩니다.',back:r==='partner'?'acct':(ctx.need?'':'ex')};
  if(cur==='uid'){ var u=a.uid.ex===a.ex?a.uid:{st:'none'}; return u.st==='fail'?{h:'TETH 초대 계정이 아닙니다',s:'이 '+n+' 계정은 TETH 초대로 만든 계정이 아닙니다. 아래에서 하나를 고르십시오.',back:''}:{h:n+' 연결 확인 중',s:'승인한 계정을 확인하고 있습니다.',back:''}; }
  if(cur==='limit') return {h:'거래소 '+AC_PAID_MAX+'곳이 연결되어 있습니다',s:'구독 하나로 '+AC_PAID_MAX+'곳까지 연결됩니다. '+n+' 연결 방법을 고르십시오.',back:'plan'};
  if(cur==='pay') return {h:'플랜 구성',s:'',back:''};
  if(cur==='done') return {h:'연결되었습니다',s:'이제 '+(ctx.name?gEsc(ctx.name)+' 전략을 ':'전략을 ')+'시작하면 '+acName(a.ex||acConnList()[0])+' 계정에서 실행됩니다.',back:''};
  return {h:'거래소 연결',s:'',back:''};
}
function pxHead(t){ return '<header class="pl-cohead px-head">'+(t.back?'<button type="button" class="pl-back" aria-label="뒤로" onclick="pxBack(\''+t.back+'\')">'+PX_CHEV+'</button>':'')+'<h1>'+t.h+'</h1></header>'+(t.s?'<p class="px-lead">'+t.s+'</p>':''); }
function pxBack(k){
  var a=acS(), ctx=AC_CTX||{};
  if(k==='plan'){ if(acConnList().length){ a.ex=null; a.adding=0; a.edit=null; acSave(); acPageView(); } else plView(ctx); return; }
  if(k==='ex'){ a.edit='ex'; a.exSel=a.ex; acSave(); acRe(); return; }
  if(k==='acct'){ a.has=null; a.g=0; a.edit=null; acSave(); acRe(); return; }
}
function pxHelp(){ return '<p class="px-help"><span>막히면 상담원이 24시간 답합니다.</span><button type="button" class="pl-link" onclick="tfTxHelp()">상담원에게 묻기</button></p>'; }
/* 거래소: 타일을 누르면 바로 다음 화면 */
function pxBEx(){
  var a=acS(), ctx=AC_CTX||{};
  return '<div class="pl-exs px-exs" role="group" aria-label="거래소">'+acExs().map(function(b){ var cn=!!a.conn[b.id];
    return '<button type="button" onclick="pxPickEx(\''+b.id+'\')">'+acLogo(b.id,30)+'<b>'+b.name+'</b>'+(cn?'<small>연결됨</small>':'')+'</button>'; }).join('')+'</div>';
}
function pxPickEx(id){ var a=acS(); a.exSel=id; acExGo(); }
/* 계정: 초대 가입 안내 한 카드, 단추 하나, 작은 갈래 둘 */
function pxBAcct(){
  var a=acS(), n=acName(a.ex), j=!!a.joined&&a.has==='no';
  return '<div class="px-card"><ul class="px-steps"><li><b>TETH 초대 링크로 가입</b><span>이메일이나 전화번호로 가입합니다.</span></li><li><b>본인 확인</b><span>전략을 시작하기 전에 '+n+'에서 마칩니다.</span></li></ul></div>'
    +(j?'<button type="button" class="pl-cta pl-cta-w px-cta" onclick="acGuide(2)">가입한 계정 연결</button><p class="px-links"><a class="pl-link acx-a" href="'+gEsc(acRef(a.ex))+'" target="_blank" rel="noopener">'+n+' 가입 화면 다시 열기</a></p>'
      :'<a class="pl-cta pl-cta-w px-cta acx-a" href="'+gEsc(acRef(a.ex))+'" target="_blank" rel="noopener" onclick="pxJoined()">'+n+' 가입 화면 열기'+AC_OUT+'</a><p class="px-links"><button type="button" class="pl-link acx-have" onclick="acHas(\'yes\')">기존 초대 계정 연결</button></p>');
}
function pxJoined(){ acGuideOpen(); setTimeout(acRe,50); }
/* 승인: 권한 두 줄, 단추 하나 */
function pxBAuth(){
  var a=acS(), n=acName(a.ex), st=a.auth.ex===a.ex?a.auth.st:'idle';
  return '<div class="px-card"><ul class="px-perm"><li>'+AC_CK+'<span><b>잔고 조회</b>전략에 쓸 잔고를 봅니다</span></li><li>'+AC_CK+'<span><b>주문</b>전략 조건에 맞을 때 주문을 냅니다</span></li></ul></div>'
    +(st==='fail'?'<p class="acx-fail px-fail" role="alert">'+n+'에서 승인을 마치지 못했습니다. 잠시 뒤 다시 시도해 주십시오.</p>':st==='cancel'?'<p class="px-note" role="status">승인을 취소했습니다. 연결된 것은 없습니다.</p>':'')
    +'<button type="button" class="pl-cta pl-cta-w px-cta" id="ac-go" onclick="acAuthOpen()">'+acLogo(a.ex,20)+n+'에서 승인하기</button>';
}
/* 초대 계정 확인: 진행 중이면 두 줄 목록, 아니면 세 갈래 */
function pxBUid(){
  var a=acS(), n=acName(a.ex), u=a.uid.ex===a.ex?a.uid:{st:'none'}, id=a.auth.uid||'';
  if(u.st==='fail') return '<div class="px-col"><button type="button" class="px-ch" onclick="acUidAlt(\'new\')"><b>TETH 초대로 새 계정 만들기</b><span>이용료 없이 씁니다</span></button><button type="button" class="px-ch" onclick="acUidAlt(\'paid\')"><b>이 계정을 그대로 쓰고 구독하기</b><span>월 '+acUsd(AC_CFG.price)+'</span></button><button type="button" class="px-ch" onclick="acUidAlt(\'ex\')"><b>다른 거래소 고르기</b><span>초대로 만든 계정이 다른 거래소에 있을 때</span></button></div>';
  return '<div class="px-card"><p class="px-acct">'+acLogo(a.ex,22)+'<b>'+n+'</b><span class="num">'+gEsc(String(id).slice(0,2))+'••••'+gEsc(String(id).slice(-2))+'</span></p>'
    +'<ul class="btg-chk acx-chk px-chk" id="ac-chk"><li class="run" id="ac-c0"><span class="ic"><i></i></span><b>계정 확인</b><span>승인한 계정을 읽는 중</span></li><li id="ac-c1"><span class="ic"></span><b>초대 계정 확인</b><span>TETH 초대로 만든 계정인지</span></li></ul></div>';
}
/* 한도: 갈래 둘, 작은 링크 하나 */
function pxBLimit(){
  var a=acS(), n=acName(a.ex), L=acConnList().filter(function(k){ return a.conn[k].via==='paid'; });
  return '<p class="px-acct px-now">'+L.map(function(k){ return '<i>'+acLogo(k,20)+acName(k)+'</i>'; }).join('')+'</p>'
    +'<div class="px-col"><button type="button" class="px-ch" onclick="acLimitAlt(\'partner\')"><b>'+n+'를 TETH 초대 계정으로 연결</b><span>이용료 없음. 초대 계정이 없으면 새로 가입합니다</span></button><button type="button" class="px-ch" onclick="acLimitAlt(\'more\')"><b>구독 추가</b><span>월 '+acUsd(AC_CFG.price)+', 거래소 '+AC_PAID_MAX+'곳 더 연결</span></button></div>'
    +(AC_CTX&&AC_CTX.need?'':'<p class="px-links"><button type="button" class="pl-link" onclick="acLimitAlt(\'ex\')">다른 거래소 고르기</button></p>');
}
/* 완료: 계정 한 줄, 단추 하나 */
function pxBDone(){
  var a=acS(), ex=a.ex||acConnList()[0], c=a.conn[ex]||{};
  return '<div class="px-card"><p class="px-acct">'+acLogo(ex,22)+'<b>'+acName(ex)+'</b>'+(c.uid?'<span class="num">'+gEsc(String(c.uid).slice(0,2))+'••••'+gEsc(String(c.uid).slice(-2))+'</span>':'')+'<em>'+(c.via==='paid'?'구독':'TETH 초대 계정')+'</em></p></div>'
    +'<button type="button" class="pl-cta pl-cta-w px-cta" onclick="acSheetDone()">'+pxDoneLabel()+'</button>'
    +'<p class="px-links"><button type="button" class="pl-link" onclick="acAddMore()">거래소 더 연결하기</button></p>';
}
/* 연결된 거래소 목록 화면 */
function pxList(){
  var a=acS(), L=acConnList();
  return '<div class="px-card px-list">'+L.map(function(k){ var c=a.conn[k]; return '<p class="px-acct"><span class="lg">'+acLogo(k,22)+'</span><b>'+acName(k)+'</b><em>'+(!acConnOk(k)?'구독이 끝나 새 주문이 멈췄습니다':c.via==='paid'?'구독':'TETH 초대 계정')+'</em><button type="button" class="pl-link" onclick="acDisc(\''+k+'\')">연결 끊기</button></p>'; }).join('')+'</div>'
    +'<button type="button" class="pl-cta pl-cta-w px-cta" onclick="acGoTerminal()">터미널 열기</button>'
    +'<p class="px-links"><button type="button" class="pl-link" onclick="acAddMore()">거래소 더 연결하기</button></p>';
}
(function(){
  /* 구독 하나로 거래소 7곳 전부 연결한다. 한도 화면은 쓰지 않는다 */
  acPaidFull=function(){ return false; };
  /* 머리와 몸을 화면 단위로. acRe()가 #ac-head, #ac-flow 를 다시 그리므로 페이지와 백테스트 실행 준비가 함께 바뀐다 */
  acHeadHtml=function(){ var ctx=AC_CTX||{}, a=acS(), L=acConnList();
    if(ctx.page&&L.length&&!L.some(acConnOk)) return pxHead({h:'구독이 끝났습니다',s:'연결은 그대로 있습니다. 다시 구독하면 전략이 새 주문을 이어서 냅니다.',back:''});
    if(ctx.list) return pxHead({h:'거래소 연결',s:'',back:''});
    return pxHead(pxTitle()); };
  acFlowHtml=function(){ var cur=pxCur();
    if(cur==='route'){ setTimeout(function(){ plView(AC_CTX||{}); },0); return ''; }
    if(cur==='pay'){ setTimeout(function(){ plCheckout(AC_CTX||{}); },0); return '<p class="px-lead">결제 화면으로 이동합니다.</p>'; }
    var b={ex:pxBEx,acct:pxBAcct,guide:pxBAcct,auth:pxBAuth,uid:pxBUid,limit:pxBLimit,done:pxBDone}[cur];
    return (b?b():'')+pxHelp(); };
  /* 완료 단추: 창이든 화면이든 같은 길 */
  acSheetDone=function(){ var af=AC_CTX&&AC_CTX.after; AC_CTX=null; plPageOff(); acAfter(af); };
  /* 거래소 연결 화면: 검정 바탕 한 열 */
  acPageView=function(ex){
    if(!S.user){ plView({ex:ex||null}); return; }
    var a=acS(); if(!acRouteNow()&&!acConnList().length){ plView({ex:ex||null}); return; }
    tfPageMode('tfbrokers','거래소 연결'); document.body.classList.remove('tf-route'); document.body.classList.add('pl-page','pl-dark'); acOpen({ex:ex||null,page:1});
    var L=acConnList(), OK=L.filter(acConnOk);
    if(!ex&&L.length&&!OK.length&&!a.adding){ a.ex=L[0]; a.route='paid'; a.pay=a.pay.st==='fail'?a.pay:{st:'none'}; acSave(); }
    if(!ex&&L.length&&a.ex&&!a.conn[a.ex]&&!a.adding){ a.ex=null; a.has=null; a.auth={st:'idle'}; a.uid={st:'none'}; acSave(); }
    var list=OK.length&&((!a.ex)||(a.ex&&acConnOk(a.ex)&&!a.adding)); AC_CTX.list=list?1:0;
    TF_RENDERING=true;
    gContent('<div class="pl pl-co px" id="pl-root"><div id="ac-head">'+acHeadHtml()+'</div><div class="px-body" id="ac-flow">'+(list?pxList()+pxHelp():acFlowHtml())+'</div></div>');
    TF_RENDERING=false; if(acStep()==='uid') acUidRun();
  };
  /* 활성화 창 대신 같은 화면 */
  acSheetOpen=function(ctx){ ctx=ctx||{}; ctx.sheet=0; acOpen(ctx); AC_CTX=ctx; AC_CTX.page=1;
    tfPageMode('tfbrokers','거래소 연결'); document.body.classList.remove('tf-route'); document.body.classList.add('pl-page','pl-dark');
    TF_RENDERING=true; gContent('<div class="pl pl-co px" id="pl-root"><div id="ac-head">'+acHeadHtml()+'</div><div class="px-body" id="ac-flow">'+acFlowHtml()+'</div></div>'); TF_RENDERING=false;
    if(acStep()==='uid') acUidRun(); };
  acAddMore=function(){ var a=acS(); a.ex=null; a.adding=1; a.has=null; a.auth={st:'idle'}; a.uid={st:'none'}; a.kyc={st:'none'}; a.doneAt=null; a.edit=null; acSave(); if(AC_CTX){ AC_CTX.need=null; AC_CTX.ex=null; } acPageView(); };
  /* 승인 창(거래소 화면 흉내): 출금 줄 없이 */
  var ao0=acAuthOpen; acAuthOpen=function(){ ao0.apply(this,arguments); var w=document.getElementById('ac-auth'); if(!w) return; var li=w.querySelector('li.pm-n'); if(li) li.remove(); };
  /* 본인 확인 관문: 제목 하나, 한 줄, 단추 하나 */
  acKycHtml=function(ex){ var a=acS(), c=a.conn[ex]||{}, n=acName(ex), st=c.kyc||'none';
    var s=st==='ok'?'본인 확인이 끝났습니다. 전략을 시작합니다.':st==='run'?n+'에서 본인 확인 상태를 보는 중입니다.':st==='review'?n+'에서 본인 확인을 검토하고 있습니다. 끝나면 전략을 시작할 수 있습니다.':st==='err'?'본인 확인 상태를 불러오지 못했습니다. 잠시 뒤 다시 확인해 주십시오.':'본인 확인이 끝나면 전략을 시작할 수 있습니다.';
    var act=st==='ok'?'':st==='run'?'<button type="button" class="pl-cta pl-cta-w px-cta" disabled><i class="acx-sp"></i>확인 중</button>'
      :(st==='fail'||st==='none'?'<a class="pl-cta pl-cta-w px-cta acx-a" href="'+gEsc(acRef(ex))+'" target="_blank" rel="noopener">'+n+'에서 본인 확인하기'+AC_OUT+'</a>':'')+'<p class="px-links"><button type="button" class="pl-link" onclick="acKycRun(\''+ex+'\')">'+(st==='err'?'다시 확인하기':'확인 상태 다시 보기')+'</button></p>';
    return '<div class="px-kyc st-'+st+'" id="ac-kyc"><p class="px-lead">'+s+'</p>'+act+'</div>'; };
  var rg0=acRunGate; acRunGate=function(ex,cb){ var a=acS(); ex=ex||acConnList()[0]; if(!ex||!a.conn[ex]||acRunOk(ex)){ cb(); return; }
    rg0.call(this,ex,cb); var d=document.getElementById('ac-cf'); if(!d) return; d.classList.add('px-cf'); var h=d.querySelector('h3'); if(h) h.textContent=acName(ex)+' 본인 확인'; var bt=d.querySelector('.bts'); if(bt){ var no=bt.querySelector('button:not(.ok)'); if(no) no.remove(); } var bx=d.querySelector('.bx'); if(bx) bx.insertAdjacentHTML('afterbegin','<button type="button" class="x" aria-label="닫기" onclick="acConfirmClose()">✕</button>'); };
})();
