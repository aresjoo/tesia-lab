/* ═══ 16-fixes 연결: 예전 진입점을 새 상태 모델로 잇는다 ═══ */
/* R14 AI 트레이딩 시작 화면(로그인했지만 실행 환경이 없는 회원). 전략을 먼저 고르게 하지 않는다 */
function acMyList(){
  var t=tfS(), o=[];
  if(t.intake&&t.intake.asset&&typeof btMine==='function'){ var m=btMine(); if(m) o.push({n:m.name,s:t.cur?'백테스트를 마쳤습니다':'아직 돌려 보지 않았습니다',f:"location.hash='#/share/bt/mine'"}); }
  try{ (cpState().copies||[]).forEach(function(c){ if(c.status==='active') o.push({n:c.nick,s:'복사한 전략',f:"tfShareHub('follow')"}); }); }catch(e){}
  (t.strat||[]).forEach(function(x){ if(x&&x.name) o.push({n:x.name,s:x.status==='live'?'실행 중':'준비됨',f:x.id?"tfNav('#/trade/bot/"+x.id+"')":"tfNav('#/trade')"}); });
  return o.slice(0,5);
}
function acReadyView(){
  tfPageMode('tfinactive','AI 트레이딩');
  var L=acMyList(), c=acS().conn, ks=acConnList();
  TF_RENDERING=true;
  gContent('<div class="acx-entry rdy"><section class="hero"><small>AI 트레이딩</small><h1>터미널이 준비되었습니다</h1><p>연결된 계정에서 실행할 전략을 고르면 이곳에 포지션과 주문이 표시됩니다.</p>'
    +'<div class="cta"><button type="button" class="bt-cta" onclick="tfShareHub()">전략 고르기</button><button type="button" class="bt-sec" onclick="tfBackToChat()">직접 만들기</button></div></section>'
    +'<section class="mine"><h2>연결된 계정</h2><div class="stg-card">'+ks.map(function(k){ var e=acEx(k); return '<button type="button" class="r" onclick="tfBrokersView()"><b>'+e.name+'</b><span>'+(c[k].via==='partner'?'TETH 초대 계정, 이용료 없음':'월 구독 이용 중')+'</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>'; }).join('')+'</div></section>'
    +(L.length?'<section class="mine"><h2>내 전략</h2><div class="stg-card">'+L.map(function(x){ return '<button type="button" class="r" onclick="'+x.f+'"><b>'+gEsc(x.n)+'</b><span>'+x.s+'</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>'; }).join('')+'</div></section>':'')
    +acHelp()+'</div>');
  TF_RENDERING=false;
}
function acEntryView(){
  if(acReady(null)){ acReadyView(); return; }
  tfPageMode('tfinactive','AI 트레이딩');
  var L=acMyList(), pt=function(t,d,p){ return '<li><span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg></span><b>'+t+'</b><span>'+d+'</span></li>'; };
  TF_RENDERING=true;
  gContent('<div class="acx-entry"><section class="hero"><small>AI 트레이딩</small><h1>전략이 회원님의 거래소 계정에서 <br>직접 거래합니다</h1><p>거래소 계정을 한 번 연결하면 터미널이 열립니다. 전략은 그다음에 고르거나 만들면 됩니다.</p>'
    +'<div class="cta"><button type="button" class="bt-cta" onclick="acStart({after:{kind:\'terminal\'}})">시작하기</button><span>TETH 초대로 가입한 계정은 이용료가 없습니다</span></div></section>'
    +'<ul class="pts">'+pt('자산은 거래소에 그대로','TETH로 돈을 옮기지 않습니다. 주문만 회원님 계정에서 나갑니다.','<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>')
    +pt('출금 권한 없음','잔고 조회와 주문 실행만 승인받습니다.','<path d="M12 3l7.5 3v5.5c0 4.7-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.8-7.5-9.5V6z"/>')
    +pt('언제든 멈춤','전략마다 손실 한도를 두고, 한 번에 모두 멈출 수 있습니다.','<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>')+'</ul>'
    +(L.length?'<section class="mine"><h2>내 전략</h2><div class="stg-card">'+L.map(function(x){ return '<button type="button" class="r" onclick="'+x.f+'"><b>'+gEsc(x.n)+'</b><span>'+x.s+'</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>'; }).join('')+'</div></section>':'')
    +acHelp()+'</div>');
  TF_RENDERING=false;
}
/* 뒤쪽 스크립트에 선언된 함수는 문서가 다 읽힌 뒤에 바꾼다 */
function p16Late(){
  if(typeof gSetMenu!=='function'||typeof GLC==='undefined') return;
  if(typeof gProfileClick==='function'&&!gProfileClick.p16){ gProfileClick=function(ev){ if(!S.user){ authOpen('login'); return; } try{ gSetMenuClose(); }catch(x){} stGo('account'); }; gProfileClick.p16=1; }
  if(!gSetMenu.p16){ var g0=gSetMenu; gSetMenu=function(e){ if(S.user){ if(e&&e.stopPropagation) e.stopPropagation(); try{ gSetMenuClose(); }catch(x){} stGo('general'); return; } return g0.apply(this,arguments); }; gSetMenu.p16=1; }
  GLC.cur='USD'; glcSetCur=function(){ GLC.cur='USD'; };
  try{ applyCurrency(); }catch(e){}
}
/* 백테스트 뒤 실행 준비: 같은 활성화 흐름을 쓴다. 검증한 전략은 왼쪽에 끝까지 남는다 */
function btGoCtx(){ var s=BT.s; return {need:s.ex&&acEx(s.ex)?s.ex:null,name:mkHook(s),page:1,doneHtml:function(){ return btGoNext(); }}; }
(function(){
  tfBrokersView=function(){ acPageView(); };
  tfBkConnect=function(id){ acStart({ex:acEx(id)?id:null,after:{kind:'terminal'}}); };
  tfUpSheet=function(ctx,opt){ opt=opt||{}; if(ctx==='follow'||ctx==='cp-follow'){ var s=null; try{ s=tfSSFind(decodeURIComponent(opt.ne)); }catch(e){} acStart({need:s&&s.ex&&acEx(s.ex)?s.ex:null,name:s?mkHook(s):opt.name,after:{kind:'copy',id:opt.ne}}); return; } if(ctx==='bk'){ acStart({ex:acEx(opt.bk)?opt.bk:null,after:{kind:'terminal'}}); return; } acStart({after:{kind:'terminal'}}); };
  tfAcSheet=function(kind){ acStart({ex:kind&&acEx(kind)?kind:null,after:{kind:'terminal'}}); };
  tfMkActivate=function(){ var s=null, ne=TF_MKF.ne; try{ s=tfSSFind(TF_MKF.nick); }catch(e){} mkFollowClose(true); acStart({need:s&&s.ex&&acEx(s.ex)?s.ex:null,name:s?mkHook(s):null,after:{kind:'copy',id:ne}}); };
  tfIntroStart=function(){ acStart({after:{kind:'terminal'}}); };
  tfTradeInactiveView=function(){ acEntryView(); };
  /* 좁은 화면: 지금 보는 설정 탭이 보이게 */
  var sv0=stView; stView=function(){ var r=sv0.apply(this,arguments); try{ var n=document.querySelector('.stg-ni.on'), w=n&&n.parentNode; if(w&&w.scrollWidth>w.clientWidth) w.scrollLeft=Math.max(0,n.offsetLeft-w.clientWidth/2+n.offsetWidth/2); }catch(e){} return r; };
  btGoFlow=function(){ return '<div id="ac-head">'+acHeadHtml()+'</div><div class="acx-flow" id="ac-flow">'+acFlowHtml()+'</div>'; };
  btGoView=function(){ if(!S.user){ btGoTo(''); return; } if(!BT.R) btCompute(); acOpen(btGoCtx()); tfPageMode('tfbt','전략 실행 준비'); TF_RENDERING=true; gContent(btGoPage()); TF_RENDERING=false; if(acStep()==='uid') acUidRun(); };
  btGoNext=function(){ var a=acS(), ex=a.ex||acConnList()[0], fee=acAccess()==='paid'?'월 '+acUsd(AC_CFG.price):'없음';
    if(BT.s&&BT.s.mine){ var t=tfS(), bud=TF_BUDGET[((t.intake||{}).budget||{}).i!=null?t.intake.budget.i:1];
      return '<section class="btg-next"><h3>이제 시작할 수 있습니다</h3><p>대화에서 정한 금액으로 바로 시작하거나, 가상으로 먼저 돌려 볼 수 있습니다.</p><dl class="bt-dl"><div><dt>사용할 금액</dt><dd class="num">'+tfWon(bud)+'</dd></div><div><dt>TETH 이용료</dt><dd>'+fee+'</dd></div></dl></section>'
        +'<button type="button" class="bt-cta" onclick="btMineStart(\'live\')">전략 시작</button><button type="button" class="bt-sec" onclick="btMineStart(\'paper\')">가상으로 먼저 시작</button><button type="button" class="bt-sec" onclick="btMineStart(\'later\')">나중에 시작</button>'; }
    return '<section class="btg-next"><h3>다음은 이 전략에 쓸 금액입니다</h3><p>백테스트에서는 '+btUsd(BT.amt)+'로 봤습니다. 실제로 쓸 금액과 손실 한도를 정하면 시작합니다.</p></section><button type="button" class="bt-cta" onclick="btFinal()">사용할 금액 정하기</button>'; };
  /* 필요한 것이 이미 다 있으면 실행 준비 화면을 건너뛴다 */
  var u0=btUse; btUse=function(){ var s=BT.s, need=s&&s.ex&&acEx(s.ex)?s.ex:null; if(S.user&&!s.mine&&acReady(need)){ try{ tfTrack('bt_use',{id:BT.id,skip:1}); }catch(e){} cpSetupGo(btNe()); return; } if(!S.user){ authOpen('signup'); tfIntentSet({kind:'bt',id:btNe()+'/go'}); return; } return u0.apply(this,arguments); };
  /* 설정 단추: 회원은 전용 화면으로, 손님은 기존 작은 메뉴 */
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',p16Late); else setTimeout(p16Late,0);
  /* R07 금액은 USD 하나 */
  try{ localStorage.setItem('tethCurrency','USD'); }catch(e){}
})();
