/* ═══ 거래소 연결 플랜 화면 (pl): ChatGPT 플랜 업그레이드와 플랜 구성 화면을 따른다 ═══
   화면 1 두 카드(무료: TETH 초대 계정, 구독: 월 $280). 결과가 좋은 백테스트에서 왔으면 왼쪽에 결과 카드.
   화면 2A 구독 결제(참고 B). 결제가 먼저, 그다음 거래소 연결. 구독 하나로 거래소 2곳까지.
   화면 2B 무료: 가입 안내가 기본, 작은 링크로 바로 연결. */
var PL={ctx:null};
var PL_IC={
  bolt:'<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  coin:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.75 1.75 0 0 1 0 3.5h-3a1.75 1.75 0 0 0 0 3.5h4"/>',
  card:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18"/>',
  lock:'<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  head:'<path d="M4.5 13a7.5 7.5 0 0 1 15 0"/><rect x="3" y="12.5" width="4" height="6.5" rx="1.5"/><rect x="17" y="12.5" width="4" height="6.5" rx="1.5"/><path d="M19 19v1a2 2 0 0 1-2 2h-3"/>',
  swap:'<path d="M7 7h11M15 4l3 3-3 3M17 17H6M9 14l-3 3 3 3"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM6 6H4a2 2 0 0 0 2 4M18 6h2a2 2 0 0 1-2 4M12 13v4M8 21h8M10 17h4"/>'
};
function plI(k){ return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+PL_IC[k]+'</svg>'; }
function plLogos(z){ return '<span class="pl-logos">'+acExs().map(function(b){ return acLogo(b.id,z||18); }).join('')+'</span>'; }
function plRebate(){ var B=AC_CFG.benefit, g20=[], g50=[]; acExs().forEach(function(b){ (B[b.id]>=50?g50:g20).push(b.name); }); return g20.join(', ')+'는 거래 수수료의 20%, '+g50.join('과 ')+'는 50%를 환급합니다.'; }
/* 왼쪽 결과 카드: 이름, 거래소, 기간, 시작 금액, 수익률, 그냥 보유, 낙폭, 작은 그래프. 단추 없음 */
function plBtCard(b){ if(!b) return '';
  var eq=b.eq||[], W=280, H=72, mn=Math.min.apply(null,eq), mx=Math.max.apply(null,eq), rg=(mx-mn)||1;
  var pts=eq.map(function(v,i){ return (i/(eq.length-1)*W).toFixed(1)+','+(H-((v-mn)/rg)*(H-6)-3).toFixed(1); }).join(' ');
  return '<article class="pl-card pl-bt"><div class="pl-lb">실행할 전략</div><h2 class="pl-h">'+gEsc(b.name)+'</h2><p class="pl-d">'+gEsc(b.per)+', '+gEsc(b.amt)+'로 시작. '+acName(b.ex)+'에서 실행합니다.</p>'
    +'<div class="pl-price"><span class="num'+mkSign(b.ret)+'">'+mkPct0(b.ret,1)+'</span><small>검증 수익률</small></div>'
    +(eq.length>2?'<svg class="pl-spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true"><polyline points="'+pts+'" fill="none" stroke="'+(b.ret>=0?'#2fb98a':'#f0566a')+'" stroke-width="2"/></svg>':'')
    +'<ul class="pl-items"><li>'+plI('coin')+'<span>그냥 들고 있었다면 '+mkPct0(b.bench,1)+'</span></li><li>'+plI('swap')+'<span>가장 크게 내려간 폭 '+b.mdd.toFixed(1)+'%</span></li><li>'+plI('cal')+'<span>거래 '+b.n+'번</span></li></ul></article>'; }
function plView(ctx){
  ctx=ctx||{}; PL.ctx=ctx; AC_CTX=ctx;
  tfPageMode('tfbrokers','거래소 연결'); document.body.classList.remove('tf-route'); document.body.classList.add('pl-page'); document.body.classList.remove('pl-dark');
  var bt=ctx.bt||null, need=ctx.need?acName(ctx.need):null;
  var free='<article class="pl-card pl-hi"><div class="pl-top"><span class="pl-lb">TETH 초대 계정</span></div><h2 class="pl-h">거래하는 사람을 위해</h2>'
    +'<p class="pl-d">TETH 초대로 가입한 거래소 계정으로 이용합니다. 초대 계정이 없다면 거래소에 새로 가입합니다.</p>'
    +'<div class="pl-price"><i>$</i><span class="num pl-grad">0</span><small>/ 월</small></div>'
    +'<button type="button" class="pl-cta pl-cta-hi" onclick="plPick(\'partner\')">무료로 시작하기</button>'
    +'<div class="pl-sub">포함된 기능</div><ul class="pl-items">'
    +'<li>'+plI('bolt')+'<span>전략 자동 실행</span></li>'
    +'<li>'+plI('grid')+'<span>연결 가능한 거래소 7곳 '+plLogos(16)+'</span></li>'
    +'<li>'+plI('coin')+'<span>거래 수수료 환급</span></li>'
    +'<li>'+plI('trophy')+'<span>전략 대회 참가</span></li>'
    +'<li>'+plI('card')+'<span>카드 등록 없이 이용</span></li>'
    +'<li>'+plI('lock')+'<span>연결 권한: 잔고 조회와 주문</span></li>'
    +'<li>'+plI('head')+'<span>24시간 고객 지원</span></li></ul>'
    +'<p class="pl-foot">'+plRebate()+' 연결 과정에서 TETH 초대 계정 여부를 확인합니다.</p></article>';
  var paid='<article class="pl-card"><div class="pl-top"><span class="pl-lb">TETH 구독</span></div><h2 class="pl-h">지금 쓰는 계정 그대로</h2>'
    +'<p class="pl-d">TETH 초대로 가입하지 않은 거래소 계정도 연결합니다. 기존 계정을 유지하며 전략을 실행합니다.</p>'
    +'<div class="pl-price"><i>$</i><span class="num">280</span><small>/ 월</small></div>'
    +'<button type="button" class="pl-cta" onclick="plPick(\'paid\')">구독으로 시작하기</button>'
    +'<div class="pl-sub">구독 혜택</div><ul class="pl-items">'
    +'<li>'+plI('bolt')+'<span>전략 자동 실행</span></li>'
    +'<li>'+plI('grid')+'<span>연결 가능한 거래소 7곳 '+plLogos(16)+'</span></li>'
    +'<li>'+plI('swap')+'<span>초대 가입 없이 계정 연결</span></li>'
    +'<li>'+plI('cal')+'<span>거래소 7곳 모두 연결</span></li>'
    +'<li>'+plI('lock')+'<span>연결 권한: 잔고 조회와 주문</span></li>'
    +'<li>'+plI('head')+'<span>24시간 고객 지원</span></li></ul>'
    +'<p class="pl-foot">매월 자동 결제됩니다. 설정의 결제에서 언제든 해지할 수 있으며, 해지 후에도 남은 구독 기간 동안 이용할 수 있습니다.</p></article>';
  TF_RENDERING=true;
  gContent('<div class="pl'+(bt?' pl-wide':'')+'" id="pl-root"><header class="pl-head"><h1>거래소 연결</h1>'+(need?'<p class="pl-need">이 전략은 '+need+'에서 실행됩니다. '+need+' 계정을 연결합니다.</p>':'')+'</header>'
    +'<div class="pl-grid'+(bt?' has-bt':'')+'">'+plBtCard(bt)+free+paid+'</div>'+acHelp()+'</div>');
  TF_RENDERING=false;
}
function plPageOff(){ document.body.classList.remove('pl-page','pl-dark'); }
function plMore(b){ var c=b.closest('.pl-card'); var o=c.getAttribute('data-open')==='1'; c.setAttribute('data-open',o?'0':'1'); b.textContent=o?(c.classList.contains('pl-hi')?'혜택 자세히 보기':'포함 내용 보기'):'접기'; }
function plPick(route){
  var ctx=PL.ctx||{};
  if(!S.user){ authOpen('signup'); if(typeof tfIntentSet==='function') tfIntentSet({kind:'start',route:route,ex:ctx.ex||null,need:ctx.need||null,name:ctx.name||null,after:ctx.after||null,bt:ctx.bt||null}); return; }
  var a=acS(); a.route=route; a.routeSel=null; a.edit=null; a.has=null; a.g=0; acSave();
  try{ tfTrack('pl_pick',{route:route}); }catch(e){}
  if(route==='paid'&&!acSubOn()){ plCheckout(ctx); return; }
  acPageView(ctx.need||ctx.ex||null);
}
/* ── 화면 2A: 구독 결제 (참고 B) ── */
function plCheckout(ctx){
  ctx=ctx||PL.ctx||{}; PL.ctx=ctx; AC_CTX=ctx;
  tfPageMode('tfbrokers','플랜 구성'); document.body.classList.remove('tf-route'); document.body.classList.add('pl-page','pl-dark');
  var a=acS(), sv=a.cards.filter(function(c){ return c.def; })[0]||a.cards[0], useSaved=!!sv&&!a.newCard, f=a.pay.st==='fail';
  var fixed=ctx.need&&acEx(ctx.need)?ctx.need:null, cur=fixed||a.exSel||a.ex||acExs()[0].id; if(!fixed) a.exSel=cur;
  var exs=''; var exs0='<div class="pl-exs" role="radiogroup" aria-label="거래소">'+acExs().map(function(b){ var on=cur===b.id, off=fixed&&fixed!==b.id; return '<button type="button" role="radio" aria-checked="'+on+'" class="'+(on?'on':'')+(off?' off':'')+'"'+(off?' disabled':'')+' onclick="plPickEx(\''+b.id+'\')">'+acLogo(b.id,22)+'<b>'+b.name+'</b>'+(a.conn[b.id]?'<small>연결됨</small>':fixed===b.id?'<small>이 전략의 거래소</small>':'')+'</button>'; }).join('')+'</div>';
  var pay=useSaved?'<div class="pl-saved"><div class="r on">'+plI('card')+'<span><b>'+gEsc(sv.brand)+' •••• '+gEsc(sv.last4)+'</b><small>저장한 카드, '+gEsc(sv.exp)+'</small></span><i>'+AC_CK+'</i></div><button type="button" class="pl-link" onclick="acS().newCard=1;plCheckout()">다른 결제 수단 사용</button></div>'
    :'<button type="button" class="pl-apple" onclick="plApple()" aria-label="Apple Pay로 결제"><svg width="16" height="19" viewBox="0 0 16 19" aria-hidden="true"><path fill="currentColor" d="M13.1 10.1c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9s-1.9-.9-3.2-.8C3.2 4.7 1.7 5.6.8 7.2c-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.2.8c1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-.9-2.4-4.1zM10.7 3c.6-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"/></svg><span>Pay</span></button>'
    +'<div class="pl-or"><span>또는</span></div>'
    +(f?'<p class="acx-fail" role="alert">결제가 승인되지 않았습니다. 카드 한도나 해외 결제 설정을 확인하고 다시 시도하거나 다른 카드를 써 주십시오.</p>':'')
    +'<div class="pl-form"><div class="pl-in big"><input id="ac-cn" placeholder="카드 번호" inputmode="numeric" maxlength="19" autocomplete="cc-number" oninput="acCardFmt(this)" aria-label="카드 번호"><span class="pl-brands"><i class="visa">VISA</i><i class="mc"></i><i class="amex">AMEX</i></span></div>'
    +'<div class="two"><div class="pl-in"><input id="ac-ce" placeholder="만료 날짜" inputmode="numeric" maxlength="7" autocomplete="cc-exp" oninput="acExpFmt(this)" aria-label="만료 날짜"></div><div class="pl-in"><input id="ac-cc" placeholder="보안 코드" inputmode="numeric" maxlength="4" type="password" autocomplete="cc-csc" oninput="acErr(\'ac-cc\',\'\')" aria-label="보안 코드"><span class="pl-cvc">123</span></div></div>'
    +'<div class="pl-in"><input id="ac-ch" placeholder="카드에 적힌 이름" autocomplete="cc-name" oninput="acErr(\'ac-ch\',\'\')" aria-label="카드에 적힌 이름"></div>'
    +'<span class="er" id="ac-cn-e"></span><span class="er" id="ac-ce-e" hidden></span><span class="er" id="ac-cc-e" hidden></span><span class="er" id="ac-ch-e" hidden></span>'
    +'<label class="pl-ck"><input type="checkbox" id="pl-save" checked><span>다음 결제에도 이 카드 사용</span></label></div>';
  var acct='';
  TF_RENDERING=true;
  gContent('<div class="pl pl-co" id="pl-root"><header class="pl-cohead"><button type="button" class="pl-back" aria-label="뒤로" onclick="plView(PL.ctx)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button><h1>플랜 구성</h1></header>'
    +'<div class="pl-cogrid"><section class="pl-left"><h3 class="pl-t3 pl-hid">TETH 구독</h3>'+exs
    +'<h3 class="pl-t3 mt0">결제 수단 선택하기</h3>'+pay+'</section>'
    +'<aside class="pl-right"><div class="pl-sumcard"><h2>TETH 구독</h2><p>선택한 거래소 계정으로 전략을 실행합니다.</p><ul class="pl-items sm">'
    +'<li>'+plI('bolt')+'<span>전략 자동 실행</span></li><li>'+plI('swap')+'<span>초대 가입 없이 계정 연결</span></li><li>'+plI('lock')+'<span>연결 권한: 잔고 조회와 주문</span></li><li>'+plI('head')+'<span>24시간 고객 지원</span></li></ul>'
    +'<div class="pl-lines"><div><span>매월 구독료</span><b class="num">'+acUsd(AC_CFG.price)+'.00</b></div><div class="tot"><span>오늘 결제 금액</span><b class="num">'+acUsd(AC_CFG.price)+'.00</b></div></div>'
    +'<button type="button" class="pl-cta pl-cta-w" id="ac-go" onclick="'+(useSaved?'plPaySaved()':'plPay()')+'">'+acUsd(AC_CFG.price)+' 결제하고 시작하기</button></div>'
    +'<p class="pl-legal">해지할 때까지 매월 '+acUsd(AC_CFG.price)+'이 자동 결제됩니다. 설정의 결제에서 언제든 해지할 수 있으며, 해지 후에도 남은 구독 기간 동안 이용할 수 있습니다.</p></aside></div>'+acHelp()+'</div>');
  TF_RENDERING=false;
}
function plPickEx(id){ var a=acS(); a.exSel=id; plCheckout(); }
/* 결제 뒤에는 고른 거래소로 승인 단계로 간다 */
function plAfterPay(){ var a=acS(), ctx=PL.ctx||{}, ex=(ctx.need&&acEx(ctx.need))?ctx.need:null; a.newCard=0; a.exSel=null; a.ex=ex; if(!ex){ a.auth={st:'idle'}; a.adding=acConnList().length?1:0; } acSave(); acPageView(ex); }
function plPay(){ var c=acCardRead('ac-'); if(!c) return; var my=++AC_RUN; acBusy('ac-go','결제 승인 중'); var save=!!(document.getElementById('pl-save')||{checked:true}).checked;
  setTimeout(function(){ if(my!==AC_RUN) return; var a=acS(), t=tfS();
    if(!acCharge(c)){ a.pay={st:'fail',at:Date.now()}; acBillAdd('failed',c,AC_CFG.price); acSave(); var keep={}; ['ac-cn','ac-ce','ac-ch'].forEach(function(i){ var e=document.getElementById(i); if(e) keep[i]=e.value; }); plCheckout(); for(var k in keep){ var e=document.getElementById(k); if(e) e.value=keep[k]; } return; }
    var card={id:'c'+Date.now().toString(36),last4:c.last4,brand:c.brand,exp:c.exp,name:c.name,def:true}; if(save){ a.cards.forEach(function(x){ x.def=false; }); a.cards.unshift(card); }
    plPaid(card); },1500); }
function plPaySaved(){ var a=acS(), sv=a.cards.filter(function(c){ return c.def; })[0]||a.cards[0]; if(!sv) return; var my=++AC_RUN; acBusy('ac-go','결제 승인 중');
  setTimeout(function(){ if(my!==AC_RUN) return; if(window.AC_QA&&AC_QA.pay==='fail'){ a.pay={st:'fail',at:Date.now()}; acBillAdd('failed',sv,AC_CFG.price); acSave(); plCheckout(); return; } plPaid(sv); },1500); }
function plApple(){ var my=++AC_RUN; var b=document.querySelector('.pl-apple'); if(b){ b.disabled=true; b.innerHTML='<i class="acx-sp"></i>Apple Pay 승인 중'; }
  setTimeout(function(){ if(my!==AC_RUN) return; var a=acS(); if(window.AC_QA&&AC_QA.pay==='fail'){ a.pay={st:'fail',at:Date.now()}; acBillAdd('failed',{brand:'Apple Pay',last4:''},AC_CFG.price); acSave(); plCheckout(); return; }
    var card={id:'ap'+Date.now().toString(36),last4:'',brand:'Apple Pay',exp:'',name:'',def:true}; a.cards.forEach(function(x){ x.def=false; }); a.cards.unshift(card); plPaid(card); },1400); }
function plPaid(card){ var a=acS(), t=tfS(); a.pay={st:'ok',at:Date.now()}; var nS=(a.more&&a.sub&&a.sub.st==='active')?((a.sub.n||1)+1):1; a.more=0;
  a.sub={st:'active',since:(a.sub&&a.sub.since)||Date.now(),next:Date.now()+30*864e5,price:AC_CFG.price,n:nS}; t.payDone=true; t.cardOn=true; t.plan='paid'; acBillAdd('paid',card,AC_CFG.price);
  if(!a.billTo) a.billTo={email:(S.user&&S.user.email)||'',name:card.name||'',addr:''}; acSave(); try{ tfTrack('ac_paid',{}); }catch(e){} toast('결제가 완료되었습니다'); plAfterPay(); }
(function(){
  /* 들어오는 길: 이용 자격이 없으면 플랜 화면. 손님도 플랜 화면을 본다 */
  var st0=acStart; acStart=function(ctx){ ctx=ctx||{}; if(ctx.route&&S.user){ var a=acS(); a.route=ctx.route; acSave(); }
    if(!S.user){ plView(ctx); return; }
    if(acReady(ctx.need||ctx.ex||null)){ acAfter(ctx.after); return; }
    if(!acRouteNow()){ plView(ctx); return; }
    if(ctx.route==='paid'&&!acSubOn()){ plCheckout(ctx); return; }
    return st0.apply(this,arguments); };
  var pv0=acPageView; acPageView=function(ex){ if(!S.user){ plView({ex:ex||null}); return; } var a=acS(); if(!acRouteNow()&&!acConnList().length){ plView({ex:ex||null}); return; } return pv0.apply(this,arguments); };
  /* 구독 경로의 결제 단계는 플랜 구성 화면에서 */
  var bp0=acBPay; acBPay=function(){ var a=acS(); if(!(a.more)){ setTimeout(function(){ plCheckout(AC_CTX||{}); },0); return '<p class="btg-p">결제 화면으로 이동합니다.</p>'; } return bp0.apply(this,arguments); };
  /* 가입 뒤 이어가기: 고른 방식과 결과 카드까지 */
  var ir0=tfIntentRun; tfIntentRun=function(){ var o=tfIntentPeek(); if(o&&o.kind==='start'&&S.user){ tfIntentClear(); acStart({route:o.route||null,ex:o.ex||null,need:o.need||null,name:o.name||null,after:o.after||null,bt:o.bt||null}); return true; } return ir0.apply(this,arguments); };
})();
