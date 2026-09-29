/* ═══ 실행 환경 활성화 (ac): 이용 방식, 거래소, 계정, 결제, 승인, 초대 계정 확인 ═══
   한 가지 상태 모델을 거래소 연결 화면, 활성화 창, 백테스트 뒤 실행 준비, AI 트레이딩 시작이 함께 쓴다.
   이미 끝낸 것은 다시 묻지 않는다. 고른 거래소는 끝까지 유지한다. 값(가격, 혜택, 지원 거래소)은 AC_CFG 한곳에 둔다. */
var AC_CFG={price:280,cur:'USD',
  /* TETH 초대로 가입한 계정의 거래 수수료 환급(%) */
  benefit:{binance:20,okx:20,bybit:20,mexc:20,bitget:20,woox:50,gate:50},
  order:['bitget','binance','okx','bybit','mexc','woox','gate']};
var AC_CTX=null, AC_RUN=0;
function acS(){ var t=tfS(); if(!t.ac) t.ac={route:null,ex:null,has:null,g:0,pay:{st:'none'},auth:{st:'idle'},uid:{st:'none'},conn:{},cards:[],bill:[],sub:null};
  var a=t.ac; a.conn=a.conn||{}; a.pay=a.pay||{st:'none'}; a.auth=a.auth||{st:'idle'}; a.uid=a.uid||{st:'none'}; a.cards=a.cards||[]; a.bill=a.bill||[];
  /* 예전 방식으로 연결해 둔 계정을 옮겨 온다 */
  if(t.api&&t.api.ex&&!a.conn[t.api.ex]) a.conn[t.api.ex]={via:t.uidLinked?'partner':(t.payDone?'paid':'partner'),at:Date.now(),uid:t.uid||''};
  return a; }
function acSave(){ tfSave(); try{ clearTimeout(STORE.t); STORE.flush(); }catch(e){} }
var AC_EXTRA={gate:{id:'gate',name:'Gate',site:'gate.com',conn:true,mono:'G'}};
function acExs(){ var o=[]; AC_CFG.order.forEach(function(id){ var f=0; for(var i=0;i<TF_BROKERS.length;i++){ var b=TF_BROKERS[i]; if(b.id===id&&b.conn){ o.push(b); f=1; } } if(!f&&AC_EXTRA[id]) o.push(AC_EXTRA[id]); }); return o; }
function acEx(id){ var L=acExs(); for(var i=0;i<L.length;i++) if(L[i].id===id) return L[i]; return null; }
function acName(id){ var b=acEx(id); return b?b.name:(id||''); }
function acLogo(id,z){ if(AC_EXTRA[id]) return '<i class="acx-mono" style="width:'+(z||28)+'px;height:'+(z||28)+'px;font-size:'+Math.round((z||28)*.5)+'px" aria-hidden="true">'+AC_EXTRA[id].mono+'</i>'; return '<img src="assets/logos/app-'+id+'.png" alt="" width="'+(z||28)+'" height="'+(z||28)+'" loading="lazy">'; }
function acRef(id){ var L=(window.TFC&&TFC.exchanges)||[]; for(var i=0;i<L.length;i++) if(L[i].id===id&&L[i].ref) return L[i].ref; var b=acEx(id); return 'https://'+(b&&b.site?b.site:'bitget.com'); }
function acSubOn(){ var a=acS(); return !!(a.sub&&a.sub.st==='active')||(!!tfS().payDone&&!(a.sub&&a.sub.st==='cancelled'&&a.sub.until<Date.now())); }
function acAccess(){ var a=acS(); if(acSubOn()) return 'paid'; for(var k in a.conn) if(a.conn[k].via==='partner') return 'partner'; return 'none'; }
function acConnList(){ var a=acS(), o=[]; for(var k in a.conn) if(acEx(k)) o.push(k); return o; }
function acUsd(n){ return '$'+Number(n).toLocaleString(); }
function acConnOk(k){ var c=acS().conn[k]; return !!c&&!!acEx(k)&&(c.via==='partner'||acSubOn()); }
/* 이미 연결해 둔 거래소는 승인을 다시 받지 않는다 */
function acAuthOk(ex){ var a=acS(); return (a.auth.st==='ok'&&a.auth.ex===ex)||!!a.conn[ex]; }
function acReady(ex){ return ex?acConnOk(ex):acConnList().some(acConnOk); }
/* 지금 해야 할 한 가지 */
function acStep(){
  var a=acS(), acc=acAccess(), ex=a.ex;
  if(ex&&acConnOk(ex)) return 'done';
  if(a.edit) return a.edit;
  var r=acRouteNow();
  if(!r) return 'route';
  if(!ex) return 'ex';
  if(r==='partner'){ if(!a.has) return 'acct'; if(a.has==='no'&&a.g<3) return 'guide'; if(!acAuthOk(ex)) return 'auth'; if(a.uid.st!=='ok'||a.uid.ex!==ex) return 'uid'; }
  else if(r==='paid'){ if(!acSubOn()) return 'pay'; if(!acAuthOk(ex)) return 'auth'; }
  return 'commit';
}
function acRouteNow(){ var a=acS(); return acSubOn()?'paid':(a.route||(acAccess()==='partner'?'partner':null)); }
function acCommit(){
  var a=acS(), t=tfS(), ex=a.ex, r=acRouteNow(); if(!ex) return;
  a.conn[ex]={via:r==='paid'?'paid':'partner',at:Date.now(),uid:a.uid.ex===ex?(a.uid.v||''):''};
  t.api={ex:ex,last4:null,oauth:true}; t.conn=true; if(a.conn[ex].via==='partner'){ t.uidLinked=true; t.uid=a.conn[ex].uid; } t.ob={st:'completed',ex:ex,uid:a.conn[ex].uid||'',err:null};
  a.doneAt=Date.now(); a.edit=null; acSave(); try{ tfTrack('ac_connected',{ex:ex,via:a.conn[ex].via}); tfSideSync&&tfSideSync(); }catch(e){}
}
/* ── 그리기 ── */
var AC_CK='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg>';
var AC_OUT='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';
function acSteps(){
  var a=acS(), acc=acAccess(), r=acRouteNow()||a.routeSel||'partner', L=[];
  if(acc==='none'||(!acSubOn()&&a.route==='paid')) L.push(['route','이용 방식']);
  L.push(['ex','거래소']);
  if(r==='partner'){ L.push(['acct','거래소 계정']); L.push(['auth','연결 승인']); L.push(['uid','초대 계정 확인']); }
  else { /* 결제는 아직 안 했거나 방금 이 흐름에서 마쳤을 때만 보인다 */ if(!acSubOn()||(a.pay.st==='ok'&&!acConnList().some(function(k){ return a.conn[k].via==='paid'; }))) L.push(['pay','결제']); L.push(['auth','연결 승인']); }
  return L;
}
function acSum(k){
  var a=acS();
  if(k==='route') return a.route==='paid'?'구독, 월 '+acUsd(AC_CFG.price):'TETH 초대 계정, 이용료 없음';
  if(k==='ex') return acLogo(a.ex,16)+acName(a.ex);
  if(k==='acct') return a.has==='no'?'새 계정, 가입과 본인 확인 완료':'계정 있음';
  if(k==='guide') return '가입과 본인 확인 완료';
  if(k==='pay') return a.cards[0]?'카드 끝자리 <span class="num">'+gEsc(a.cards[0].last4)+'</span>, 월 '+acUsd(AC_CFG.price):'결제 완료';
  if(k==='auth') return acName(a.ex)+'에서 승인 완료';
  if(k==='uid') return 'TETH 초대 계정으로 확인';
  return ''; }
function acDoneK(k){ var a=acS(), ex=a.ex;
  return k==='route'?!!a.route:k==='ex'?!!ex:k==='acct'?(!!a.has&&(a.has!=='no'||a.g>=3)):k==='guide'?a.g>=3:k==='pay'?acSubOn():k==='auth'?acAuthOk(ex):k==='uid'?(a.uid.st==='ok'&&a.uid.ex===ex):false; }
function acHelp(){ return '<p class="acx-help"><span>막히는 곳이 있으면 상담원이 도와드립니다. 24시간 응답합니다.</span><button type="button" onclick="tfTxHelp()">상담원에게 묻기</button></p>'; }
function acFlowHtml(){
  var a=acS(), cur=acStep(), L=acSteps(), body={route:acBRoute,ex:acBEx,acct:acBAcct,guide:acBGuide,pay:acBPay,auth:acBAuth,uid:acBUid};
  if(cur==='commit'){ acCommit(); cur='done'; }
  if(cur==='done') return acDoneHtml();
  var seen=false, sub=cur==='guide'; if(sub) cur='acct';
  return '<ol class="btg-sts acx-sts">'+L.map(function(x,i){ var on=x[0]===cur, ok=!on&&!seen&&acDoneK(x[0]); if(on) seen=true;
    return '<li class="btg-st '+(on?'on':ok?'ok':'nx')+'"'+(on?' aria-current="step"':'')+'><div class="sh"><span class="sn num">'+(ok?AC_CK:(i+1))+'</span><b>'+x[1]+'</b>'+(ok?'<span class="sm">'+acSum(x[0])+'</span>'+((x[0]==='route'||x[0]==='ex'||x[0]==='acct')?'<button type="button" class="ed" onclick="acEdit(\''+x[0]+'\')">변경</button>':''):'')+'</div>'
      +(on?'<div class="sb" id="ac-sb">'+body[sub?'guide':x[0]]()+'</div>':'')+'</li>'; }).join('')+'</ol>'+acHelp();
}
function acRe(){ AC_RUN++; var h=document.getElementById('ac-flow'); if(!h) return; h.innerHTML=acFlowHtml(); var hd=document.getElementById('ac-head'); if(hd) hd.innerHTML=acHeadHtml(); if(acStep()==='done'&&AC_CTX&&AC_CTX.onDone) try{ AC_CTX.onDone(); }catch(e){}
  var on=h.querySelector('.btg-st.on'); if(on&&AC_CTX&&AC_CTX.sheet) try{ on.scrollIntoView({block:'nearest',behavior:'smooth'}); }catch(e){} }
function acEdit(k){ var a=acS(); a.edit=k; a.doneAt=null; acSave(); acRe(); }
/* 이용 방식 */
function acBRoute(){
  var a=acS(), p=a.routeSel||a.route||'partner';
  var card=function(k,t,l1,l2,fee){ var on=p===k; return '<label class="btg-opt acx-opt'+(on?' on':'')+'"><input type="radio" name="ac-route" value="'+k+'"'+(on?' checked':'')+' onchange="acPickRoute(\''+k+'\')"><span class="rd" aria-hidden="true"></span><span class="bd"><b>'+t+'</b><span class="who">'+l1+'</span><span>'+l2+'</span>'+(k==='partner'?acBenefit():'')+'<span class="ft"><em>'+fee+'</em></span></span></label>'; };
  return '<div class="btg-opts" role="radiogroup" aria-label="이용 방식">'
    +card('partner','TETH 초대로 가입한 거래소 계정','TETH를 통해 거래소에 가입하면 이용료가 계속 무료입니다.','카드 등록이 필요 없습니다. 계정이 없으면 여기서 바로 만듭니다.','TETH 이용료 없음')
    +card('paid','구독으로 이용','지금 쓰는 거래소 계정을 그대로 연결합니다.','초대 계정이 아니어도 됩니다.','월 '+acUsd(AC_CFG.price))
    +'</div><button type="button" class="bt-cta" onclick="acRouteGo()">계속</button>';
}
function acBenefit(){ return '<span class="acx-bf"><span class="t">TETH 초대 계정의 거래 수수료 환급</span><span class="l">'+acExs().map(function(b){ return '<i>'+acLogo(b.id,18)+b.name+' <b class="num">'+(AC_CFG.benefit[b.id]||0)+'%</b></i>'; }).join('')+'</span></span>'; }
function acPickRoute(k){ acS().routeSel=k; acRe(); }
function acRouteGo(){ var a=acS(), k=a.routeSel||a.route||'partner'; if(a.route!==k){ a.has=null; a.g=0; a.uid={st:'none'}; a.pay=a.pay.st==='ok'?a.pay:{st:'none'}; } a.route=k; a.routeSel=null; a.edit=null; acSave(); acRe(); }
/* 거래소: 지원하는 곳만. 고른 곳은 끝까지 유지한다 */
function acBEx(){
  var a=acS(), r=acRouteNow(), cur=a.exSel||a.ex||(AC_CTX&&AC_CTX.ex)||null;
  return (AC_CTX&&AC_CTX.need?'<p class="btg-p">이 전략은 '+acName(AC_CTX.need)+'에서 실행됩니다.</p>':'<p class="btg-p">TETH가 연결할 수 있는 거래소입니다. 전략의 주문은 고른 거래소의 회원님 계정에서 나갑니다.</p>')
    +'<div class="acx-exs" role="radiogroup" aria-label="거래소">'+acExs().map(function(b){ var on=cur===b.id, cn=!!a.conn[b.id], lock=AC_CTX&&AC_CTX.need&&AC_CTX.need!==b.id;
      return '<button type="button" role="radio" aria-checked="'+on+'" class="'+(on?'on':'')+(lock?' off':'')+'"'+(lock?' disabled':'')+' onclick="acPickEx(\''+b.id+'\')">'+acLogo(b.id,30)+'<span><b>'+b.name+'</b><small>'+(cn?'연결됨':(r==='partner'&&AC_CFG.benefit[b.id]?'거래 수수료 '+AC_CFG.benefit[b.id]+'% 환급':'현물, 선물'))+'</small></span></button>'; }).join('')+'</div>'
    +(r==='partner'?'<p class="btg-n">수수료 환급은 TETH 초대로 가입한 계정에만 주는 혜택입니다.</p>':'')
    +'<button type="button" class="bt-cta" onclick="acExGo()"'+(cur?'':' disabled')+'>'+(cur?acName(cur)+'로 계속':'거래소 선택')+'</button>';
}
function acPickEx(id){ acS().exSel=id; acRe(); }
function acExGo(){ var a=acS(), id=a.exSel||a.ex||(AC_CTX&&AC_CTX.ex); if(!id) return; if(a.ex!==id){ a.has=null; a.g=0; a.auth={st:'idle'}; a.uid={st:'none'}; a.doneAt=null; } a.ex=id; a.exSel=null; a.edit=null; acSave(); acRe(); }
/* 거래소 계정이 있는가 */
function acBAcct(){
  var a=acS(), n=acName(a.ex);
  return '<p class="btg-p">'+n+' 계정이 있습니까? TETH 초대로 가입한 계정이면 이용료 없이 씁니다.</p>'
    +'<div class="acx-two"><button type="button" class="acx-ch" onclick="acHas(\'yes\')"><b>계정 있음</b><span>바로 연결합니다</span></button><button type="button" class="acx-ch" onclick="acHas(\'no\')"><b>새로 만들기</b><span>TETH 초대로 가입합니다. 약 5분</span></button></div>';
}
function acHas(v){ var a=acS(); a.has=v; a.g=0; a.edit=null; acSave(); acRe(); }
/* 계정 만들기: 한 번에 한 가지 */
function acBGuide(){
  var a=acS(), n=acName(a.ex), g=a.g||0, T=[['계정 만들기','TETH 초대 주소로 '+n+' 가입 화면이 새 창에 열립니다. 이메일이나 전화번호로 가입합니다.'],['본인 확인',n+' 앱이나 웹에서 신분증으로 본인 확인을 마칩니다. 보통 몇 분이면 끝납니다.'],['입금','전략이 쓸 금액을 '+n+' 계정에 넣습니다. 지금 건너뛰고 나중에 넣어도 연결은 할 수 있습니다.']];
  return '<ol class="acx-g">'+T.map(function(x,i){ return '<li class="'+(i<g?'ok':i===g?'on':'')+'"><span class="n num">'+(i<g?AC_CK:(i+1))+'</span><div><b>'+x[0]+'</b>'+(i===g?'<p>'+x[1]+'</p>':'')+'</div></li>'; }).join('')+'<li><span class="n num">4</span><div><b>TETH 연결</b></div></li></ol>'
    +(g===0?'<a class="bt-cta acx-a" href="'+gEsc(acRef(a.ex))+'" target="_blank" rel="noopener" onclick="acGuideOpen()">'+n+' 가입 화면 열기'+AC_OUT+'</a><button type="button" class="bt-sec" onclick="acGuide(1)">가입 완료</button>'
      :g===1?'<button type="button" class="bt-cta" onclick="acGuide(2)">본인 확인 완료</button>'
      :'<button type="button" class="bt-cta" onclick="acGuide(3)">입금 완료</button><button type="button" class="bt-sec" onclick="acGuide(3)">나중에 입금</button>');
}
function acGuideOpen(){ try{ tfTrack('ac_join_open',{ex:acS().ex}); }catch(e){} acS().joined=1; acSave(); }
function acGuide(n){ var a=acS(); a.g=n; if(n>=1) a.joined=1; acSave(); acRe(); }
/* 결제 */
function acIn(id,lb,ph,attr){ return '<label class="btg-f" for="'+id+'"><span>'+lb+'</span><input id="'+id+'" class="num" placeholder="'+ph+'" autocomplete="off" spellcheck="false" aria-describedby="'+id+'-e" '+(attr||'')+'><small class="er" id="'+id+'-e" role="alert"></small></label>'; }
function acErr(id,msg){ var e=document.getElementById(id+'-e'), i=document.getElementById(id); if(e) e.textContent=msg||''; if(i){ i.classList.toggle('bad',!!msg); if(msg) try{ i.focus(); }catch(x){} } }
function acBPay(){
  var a=acS(), f=a.pay.st==='fail', sv=a.cards.filter(function(c){ return c.def; })[0]||a.cards[0];
  if(sv&&!a.newCard) return '<div class="acx-plan"><div><b>TETH 구독</b><span>거래소 계정은 지금 쓰는 것을 그대로 연결합니다.</span></div><strong class="num">'+acUsd(AC_CFG.price)+'<small> / 월</small></strong></div>'
    +(f?'<p class="acx-fail" role="alert">결제가 승인되지 않았습니다. 카드 한도나 해외 결제 설정을 확인하고 다시 시도하거나 다른 카드를 써 주십시오.</p>':'')
    +'<dl class="bt-dl acx-dl"><div><dt>결제 수단</dt><dd>'+gEsc(sv.brand)+' <span class="num">•••• '+gEsc(sv.last4)+'</span></dd></div></dl>'
    +'<button type="button" class="bt-cta" id="ac-go" onclick="acPaySaved()">'+acUsd(AC_CFG.price)+' 결제하고 계속</button><button type="button" class="bt-sec" onclick="acS().newCard=1;acRe()">다른 카드 사용</button><p class="btg-n">매달 같은 날 자동으로 결제됩니다. 설정의 결제에서 언제든 해지할 수 있습니다.</p>';
  return '<div class="acx-plan"><div><b>TETH 구독</b><span>거래소 계정은 지금 쓰는 것을 그대로 연결합니다.</span></div><strong class="num">'+acUsd(AC_CFG.price)+'<small> / 월</small></strong></div>'
    +(f?'<p class="acx-fail" role="alert">결제가 승인되지 않았습니다. 카드 한도나 해외 결제 설정을 확인하고 다시 시도하거나 다른 카드를 써 주십시오.</p>':'')
    +'<div class="btg-form">'+acIn('ac-cn','카드 번호','0000 0000 0000 0000','inputmode="numeric" maxlength="19" oninput="acCardFmt(this)"')
    +'<div class="two">'+acIn('ac-ce','유효기간','MM / YY','inputmode="numeric" maxlength="7" oninput="acExpFmt(this)"')+acIn('ac-cc','보안 코드','뒷면 3자리','inputmode="numeric" maxlength="4" type="password" oninput="acErr(\'ac-cc\',\'\')"')+'</div>'
    +acIn('ac-ch','카드에 적힌 이름','HONG GILDONG','oninput="acErr(\'ac-ch\',\'\')"')+'</div>'
    +'<button type="button" class="bt-cta" id="ac-go" onclick="acPayGo()">'+acUsd(AC_CFG.price)+' 결제하고 계속</button><p class="btg-n">매달 같은 날 자동으로 결제됩니다. 설정의 결제에서 언제든 해지할 수 있습니다.</p>';
}
function acCardFmt(e){ var v=e.value.replace(/\D/g,'').slice(0,16); e.value=v.replace(/(.{4})/g,'$1 ').trim(); acErr('ac-cn',''); }
function acExpFmt(e){ var v=e.value.replace(/\D/g,'').slice(0,4); e.value=v.length>2?v.slice(0,2)+' / '+v.slice(2):v; acErr('ac-ce',''); }
function acCardRead(p){ var g=function(i){ return (document.getElementById(p+i)||{value:''}).value; }, n=g('cn').replace(/\D/g,''), x=g('ce').replace(/\D/g,''), c=g('cc').replace(/\D/g,''), h=g('ch').trim();
  [p+'cn',p+'ce',p+'cc',p+'ch'].forEach(function(i){ acErr(i,''); });
  if(n.length<15){ acErr(p+'cn','카드 번호를 끝까지 입력해 주십시오'); return null; }
  var mm=+x.slice(0,2); if(x.length<4||mm<1||mm>12){ acErr(p+'ce','유효기간을 월과 연도 순서로 입력해 주십시오'); return null; }
  if(c.length<3){ acErr(p+'cc','보안 코드 3자리를 입력해 주십시오'); return null; }
  if(!h){ acErr(p+'ch','카드에 적힌 이름을 입력해 주십시오'); return null; }
  return {n:n,last4:n.slice(-4),brand:n.charAt(0)==='4'?'Visa':n.charAt(0)==='5'?'Mastercard':n.charAt(0)==='3'?'Amex':'카드',exp:x.slice(0,2)+'/'+x.slice(2),name:h}; }
function acBusy(id,label){ var b=document.getElementById(id); if(!b) return; b.disabled=true; b.setAttribute('data-l',b.textContent); b.innerHTML='<i class="sp"></i>'+label; }
function acCharge(card){ return !(card.n.slice(0,4)==='0000'||(window.AC_QA&&AC_QA.pay==='fail')); }
function acBillAdd(st,card,amt,label){ var a=acS(); a.bill.unshift({id:'T'+Date.now().toString(36).toUpperCase(),at:Date.now(),label:label||'TETH 구독',amt:amt,st:st,last4:card?card.last4:'',brand:card?card.brand:''}); }
function acPaySaved(){ var a=acS(), sv=a.cards.filter(function(c){ return c.def; })[0]||a.cards[0]; if(!sv) return; var my=++AC_RUN; acBusy('ac-go','결제 승인 중');
  setTimeout(function(){ if(my!==AC_RUN) return; var t=tfS();
    if(window.AC_QA&&AC_QA.pay==='fail'){ a.pay={st:'fail',at:Date.now()}; acBillAdd('failed',sv,AC_CFG.price); acSave(); acRe(); return; }
    a.pay={st:'ok',at:Date.now()}; a.sub={st:'active',since:(a.sub&&a.sub.since)||Date.now(),next:Date.now()+30*864e5,price:AC_CFG.price}; t.payDone=true; t.cardOn=true; t.plan='paid'; acBillAdd('paid',sv,AC_CFG.price); acSave(); acRe(); },1500);
}
function acPayGo(){
  var c=acCardRead('ac-'); if(!c) return; var my=++AC_RUN; acBusy('ac-go','결제 승인 중');
  setTimeout(function(){ if(my!==AC_RUN) return; var a=acS(), t=tfS();
    if(!acCharge(c)){ a.pay={st:'fail',at:Date.now()}; acBillAdd('failed',c,AC_CFG.price); acSave(); var keep={}; ['ac-cn','ac-ce','ac-ch'].forEach(function(i){ var e=document.getElementById(i); if(e) keep[i]=e.value; }); acRe(); for(var k in keep){ var e=document.getElementById(k); if(e) e.value=keep[k]; } return; }
    a.newCard=0;
    var card={id:'c'+Date.now().toString(36),last4:c.last4,brand:c.brand,exp:c.exp,name:c.name,def:true}; a.cards.forEach(function(x){ x.def=false; }); a.cards.unshift(card);
    a.pay={st:'ok',at:Date.now()}; a.sub={st:'active',since:Date.now(),next:Date.now()+30*864e5,price:AC_CFG.price}; t.payDone=true; t.cardOn=true; t.plan='paid'; acBillAdd('paid',card,AC_CFG.price);
    if(!a.billTo) a.billTo={email:(S.user&&S.user.email)||'',name:c.name,addr:''};
    acSave(); try{ tfTrack('ac_paid',{}); }catch(e){} acRe(); },1500);
}
/* 연결 승인: 거래소의 승인 화면에서 한 번 누른다. 키를 만들거나 붙여 넣지 않는다 */
function acBAuth(){
  var a=acS(), n=acName(a.ex), st=a.auth.ex===a.ex?a.auth.st:'idle';
  return '<p class="btg-p">'+n+'의 승인 화면에서 한 번만 누르면 연결됩니다. 키를 만들거나 붙여 넣지 않습니다.</p>'
    +'<ul class="acx-perm"><li class="pm-y">'+AC_CK+'<span><b>잔고 조회</b>전략 계산과 위험 확인에 씁니다</span></li><li class="pm-y">'+AC_CK+'<span><b>주문 실행</b>전략 조건이 맞을 때 사고팝니다</span></li><li class="pm-n"><em aria-hidden="true"></em><span><b>출금</b>요청하지 않습니다. TETH는 자산을 옮길 수 없습니다</span></li></ul>'
    +(st==='fail'?'<p class="acx-fail" role="alert">'+n+'에서 승인을 마치지 못했습니다. 잠시 뒤 다시 시도해 주십시오. 계속 되지 않으면 상담원이 함께 확인합니다.</p>':st==='cancel'?'<p class="acx-note" role="status">승인을 취소했습니다. 연결된 것은 없습니다.</p>':'')
    +'<button type="button" class="bt-cta" id="ac-go" onclick="acAuthOpen()">'+acLogo(a.ex,20)+n+'에서 승인하기</button>';
}
function acAuthOpen(){
  var a=acS(), b=acEx(a.ex); if(!b) return; acAuthClose(); a.auth={st:'pending',ex:a.ex}; acSave();
  var w=document.createElement('div'); w.id='ac-auth'; w.className='acx-auth'; w.setAttribute('role','dialog'); w.setAttribute('aria-modal','true'); w.setAttribute('aria-label',b.name+' 연결 승인');
  w.innerHTML='<div class="acx-aw"><button type="button" class="x" aria-label="닫기" onclick="acAuthNo()">✕</button>'
    +'<div class="acx-ac"><div class="pr"><img src="assets/favicon.png" alt="" width="44" height="44" onerror="this.remove()"><i aria-hidden="true"></i>'+acLogo(b.id,44)+'</div><h3>'+b.name+' 계정을 TETH에 연결합니다</h3><p>아래 권한만 연결됩니다</p>'
    +'<ul><li>잔고와 주문 내역 조회</li><li>현물과 선물 주문</li><li class="pm-n">출금은 허용하지 않음</li></ul>'
    +'<div class="bts"><button type="button" class="no" onclick="acAuthNo()">취소</button><button type="button" class="ok" id="ac-auth-ok" onclick="acAuthYes()">승인</button></div><small>승인은 '+b.name+'의 보안 설정에서 언제든 끊을 수 있습니다.</small></div></div>';
  document.body.appendChild(w); try{ document.getElementById('ac-auth-ok').focus(); }catch(e){}
}
function acAuthClose(){ var w=document.getElementById('ac-auth'); if(w) w.remove(); }
function acAuthNo(){ var a=acS(); a.auth={st:'cancel',ex:a.ex}; acSave(); acAuthClose(); acRe(); }
function acAuthYes(){
  var a=acS(), my=++AC_RUN, ok=document.getElementById('ac-auth-ok'); if(ok){ ok.disabled=true; ok.innerHTML='<i class="sp"></i>승인 중'; }
  setTimeout(function(){ acAuthClose(); if(my!==AC_RUN) return; var bad=window.AC_QA&&AC_QA.auth==='fail';
    a.auth=bad?{st:'fail',ex:a.ex}:{st:'ok',ex:a.ex,at:Date.now(),uid:String(30000000+((mkHash((S.user&&S.user.email||'u')+a.ex))%60000000))};
    acSave(); acRe(); if(!bad&&acStep()==='uid') acUidRun(); },1300);
}
/* 초대 계정 확인: 승인으로 받은 계정 번호가 TETH 초대로 만든 계정인지 본다 */
function acBUid(){
  var a=acS(), n=acName(a.ex), u=a.uid.ex===a.ex?a.uid:{st:'none'}, id=a.auth.uid||'';
  if(u.st==='fail') return '<p class="acx-fail" role="alert">이 '+n+' 계정은 TETH 초대로 만든 계정이 아닙니다. 그래서 이용료 없는 방식은 이 계정에 적용되지 않습니다.</p>'
    +'<p class="btg-p">아래에서 하나를 고르면 이어서 진행합니다.</p>'
    +'<div class="acx-col"><button type="button" class="acx-ch" onclick="acUidAlt(\'new\')"><b>TETH 초대로 새 계정 만들기</b><span>이용료 없이 씁니다. 약 5분</span></button><button type="button" class="acx-ch" onclick="acUidAlt(\'paid\')"><b>이 계정을 그대로 쓰고 구독하기</b><span>월 '+acUsd(AC_CFG.price)+'</span></button><button type="button" class="acx-ch" onclick="acUidAlt(\'ex\')"><b>다른 거래소 고르기</b><span>초대로 만든 계정이 다른 거래소에 있을 때</span></button></div>';
  return '<p class="btg-tgt on">'+acLogo(a.ex,18)+n+' 계정 <span class="num">'+gEsc(String(id).slice(0,2))+'••••'+gEsc(String(id).slice(-2))+'</span></p>'
    +'<ul class="btg-chk acx-chk" id="ac-chk"><li class="run" id="ac-c0"><span class="ic"><i></i></span><b>계정 확인</b><span>승인한 계정을 읽는 중</span></li><li id="ac-c1"><span class="ic"></span><b>초대 계정 확인</b><span>TETH 초대로 만든 계정인지</span></li></ul>';
}
function acUidRun(){
  var a=acS(), my=++AC_RUN;
  setTimeout(function(){ if(my!==AC_RUN) return; var c0=document.getElementById('ac-c0'), c1=document.getElementById('ac-c1'); if(c0){ c0.className='ok'; c0.querySelector('.ic').innerHTML=AC_CK; c0.lastElementChild.textContent='확인했습니다'; } if(c1){ c1.className='run'; c1.querySelector('.ic').innerHTML='<i></i>'; }
    setTimeout(function(){ if(my!==AC_RUN) return; var bad=a.has!=='no'&&window.AC_QA&&AC_QA.uid==='fail';
      a.uid=bad?{st:'fail',ex:a.ex,v:a.auth.uid}:{st:'ok',ex:a.ex,v:a.auth.uid}; acSave(); acRe(); },900); },800);
}
function acUidAlt(k){ var a=acS(); if(k==='new'){ a.has='no'; a.g=0; a.auth={st:'idle'}; a.uid={st:'none'}; } else if(k==='paid'){ a.route='paid'; a.uid={st:'none'}; } else { a.ex=null; a.has=null; a.auth={st:'idle'}; a.uid={st:'none'}; } acSave(); acRe(); }
/* 끝 */
function acDoneHtml(){
  var a=acS(), ex=a.ex||acConnList()[0], c=a.conn[ex]||{}, acc=acAccess(), ctx=AC_CTX||{};
  return '<div class="acx-done"><span class="ring">'+AC_CK.replace('width="14" height="14"','width="26" height="26"')+'</span><div><h3>'+acName(ex)+' 계정이 연결되었습니다</h3><p>'+(c.via==='paid'?'구독으로 이용합니다. 월 '+acUsd(AC_CFG.price):'TETH 초대 계정으로 확인되었습니다. 이용료 없이 씁니다')+'.</p></div></div>'
    +'<dl class="bt-dl acx-dl"><div><dt>실행 계정</dt><dd>'+acLogo(ex,16)+acName(ex)+(c.uid?' <span class="num">'+gEsc(String(c.uid).slice(0,2))+'••••'+gEsc(String(c.uid).slice(-2))+'</span>':'')+'</dd></div><div><dt>TETH 이용료</dt><dd>'+(c.via==='paid'?'월 '+acUsd(AC_CFG.price):'없음')+'</dd></div>'+(c.via==='partner'&&AC_CFG.benefit[ex]?'<div><dt>TETH 혜택</dt><dd>거래 수수료 '+AC_CFG.benefit[ex]+'% 환급</dd></div>':'')+'</dl>'
    +(ctx.doneHtml?ctx.doneHtml():'<button type="button" class="bt-cta" onclick="acGoTerminal()">터미널로 이동</button>');
}
function acGoTerminal(){ acSheetClose(); tfNav('#/trade'); }
function acHeadHtml(){
  var cur=acStep(), ctx=AC_CTX||{}, a=acS(), acc=acAccess(), left=acSteps().filter(function(x){ return !acDoneK(x[0]); }).length;
  if(cur==='done') return '<h2 class="btg-h">실행 준비가 끝났습니다</h2><p class="btg-s">'+(ctx.name?gEsc(ctx.name)+' 전략을 ':'전략을 ')+acName(a.ex||acConnList()[0])+' 계정에서 실행할 수 있습니다.</p>';
  if(ctx.page&&acConnList().length&&!acConnList().some(acConnOk)) return '<h2 class="btg-h">구독이 끝났습니다</h2><p class="btg-s">연결은 그대로 있습니다. 다시 구독하면 전략이 새 주문을 이어서 냅니다.</p>';
  if(ctx.page&&acConnList().length&&!a.adding&&(!a.ex||acConnOk(a.ex))) return '<h2 class="btg-h">거래소 연결</h2><p class="btg-s">주문은 회원님의 거래소 계정에서 나갑니다. 자산은 계속 그 계정에 있습니다.</p>';
  var h=ctx.need&&acConnList().length&&!a.conn[ctx.need]?'이 전략은 '+acName(ctx.need)+'에서 실행됩니다':acc==='paid'?'거래소 계정을 연결하면 바로 실행합니다':acc==='partner'?'거래소를 하나 더 연결합니다':(ctx.name?gEsc(ctx.name)+' 전략을 실행할 계정을 연결합니다':'전략을 실행할 계정을 연결합니다');
  return '<h2 class="btg-h">'+h+'</h2><p class="btg-s">주문은 회원님의 거래소 계정에서 나갑니다. 자산은 계속 그 계정에 있습니다. '+(left>0?left+'단계 남았습니다.':'')+'</p>';
}
/* ── 들어오는 길 ── */
/* ctx: {ex 고른 거래소, need 전략이 요구하는 거래소, name 전략 이름, after 끝난 뒤 할 일, sheet 창 여부} */
function acOpen(ctx){
  ctx=ctx||{}; var a=acS(); AC_CTX=ctx; a.edit=null; a.routeSel=null; a.exSel=null;
  var want=ctx.need||ctx.ex||null;
  if(want&&acEx(want)&&a.ex!==want){ a.ex=want; a.has=null; a.g=0; a.auth={st:'idle'}; a.uid={st:'none'}; }
  if(want&&acEx(want)) a.doneAt=a.conn[want]?a.doneAt:null;
  acSave();
}
/* 필요한 것이 이미 다 있으면 창을 띄우지 않고 그대로 이어 간다 */
function acStart(ctx){
  ctx=ctx||{}; if(!S.user){ authOpen('signup'); if(typeof tfIntentSet==='function') tfIntentSet({kind:'start',ex:ctx.ex||null,need:ctx.need||null,name:ctx.name||null,after:ctx.after||null}); return; }
  if(acReady(ctx.need||ctx.ex||null)){ acAfter(ctx.after); return; }
  acSheetOpen(ctx);
}
function acAfter(af){ if(!af||af.kind==='terminal'){ tfNav('#/trade'); return; } if(af.kind==='copy'){ if(typeof mkFollowSheet==='function') mkFollowSheet(af.id); return; } if(af.kind==='bt'){ location.hash='#/share/bt/'+af.id+'/go'; return; } tfNav('#/trade'); }
function acSheetOpen(ctx){
  acSheetClose(true); ctx=ctx||{}; ctx.sheet=1; var af=ctx.after;
  ctx.doneHtml=function(){ return '<button type="button" class="bt-cta" onclick="acSheetDone()">'+(af&&af.kind==='copy'?'전략 복사 이어서 하기':af&&af.kind==='bt'?'전략 실행 이어서 하기':'터미널로 이동')+'</button>'; };
  acOpen(ctx);
  var w=document.createElement('div'); w.id='ac-sheet'; w.className='acx-sheet'; w.setAttribute('role','dialog'); w.setAttribute('aria-modal','true'); w.setAttribute('aria-label','TETH 실행 준비');
  w.innerHTML='<div class="acx-sw"><button type="button" class="x" aria-label="닫기" onclick="acSheetClose()">✕</button><div id="ac-head">'+acHeadHtml()+'</div><div class="btg-flow acx-flow" id="ac-flow">'+acFlowHtml()+'</div></div>';
  w.addEventListener('click',function(e){ if(e.target===w) acSheetClose(); });
  document.body.appendChild(w); document.addEventListener('keydown',acSheetKey);
  if(acStep()==='uid') acUidRun();
}
function acSheetKey(e){ if(e.key==='Escape'&&!document.getElementById('ac-auth')) acSheetClose(); }
function acSheetClose(silent){ AC_RUN++; acAuthClose(); var w=document.getElementById('ac-sheet'); if(w) w.remove(); document.removeEventListener('keydown',acSheetKey); if(!silent&&AC_CTX&&AC_CTX.sheet) AC_CTX=null; }
function acSheetDone(){ var af=AC_CTX&&AC_CTX.after; acSheetClose(true); AC_CTX=null; acAfter(af); }
/* 거래소 연결 화면 */
function acPageView(ex){
  if(!S.user){ authOpen('signup'); if(typeof tfIntentSet==='function') tfIntentSet({kind:'start',ex:ex||null}); return; }
  tfPageMode('tfbrokers','거래소 연결'); acOpen({ex:ex||null,page:1});
  var a=acS(), L=acConnList(), OK=L.filter(acConnOk), acc=acAccess();
  /* 구독이 끝난 계정만 남았으면 그 거래소로 다시 이어 간다 */
  if(!ex&&L.length&&!OK.length&&!a.adding){ a.ex=L[0]; a.route='paid'; a.pay=a.pay.st==='fail'?a.pay:{st:'none'}; acSave(); }
  /* 하다 만 다른 거래소 연결은 이 화면을 다시 열 때 들고 오지 않는다 */
  if(!ex&&L.length&&a.ex&&!a.conn[a.ex]&&!a.adding){ a.ex=null; a.has=null; a.auth={st:'idle'}; a.uid={st:'none'}; acSave(); }
  var st=L.length?'<section class="acx-now"><small>지금 연결된 계정</small>'+L.map(function(k){ var c=a.conn[k]; return '<div class="r">'+acLogo(k,22)+'<b>'+acName(k)+'</b><span>'+(!acConnOk(k)?'구독이 끝나 새 주문이 멈췄습니다':c.via==='paid'?'구독으로 이용':'TETH 초대 계정, 이용료 없음')+'</span><button type="button" onclick="acDisc(\''+k+'\')">연결 끊기</button></div>'; }).join('')+(OK.length?'<button type="button" class="bt-sec" onclick="acAddMore()">거래소 하나 더 연결</button>':'')+'</section>':'';
  TF_RENDERING=true;
  gContent('<div class="bt btg acx-page" id="bt-root" data-phase="go"><div class="acx-pg">'
    +'<div id="ac-head">'+acHeadHtml()+'</div>'+st
    +'<div class="btg-flow acx-flow" id="ac-flow">'+((OK.length&&!a.ex)||(a.ex&&acConnOk(a.ex)&&!a.adding)?(OK.length?'<button type="button" class="bt-cta" onclick="acGoTerminal()">터미널로 이동</button>'+acHelp():acFlowHtml()):acFlowHtml())+'</div></div></div>');
  TF_RENDERING=false; if(acStep()==='uid') acUidRun();
}
function acAddMore(){ var a=acS(); a.ex=null; a.adding=1; a.has=null; a.auth={st:'idle'}; a.uid={st:'none'}; a.doneAt=null; acSave(); acPageView(); }
function acDisc(k){
  acConfirm({title:acName(k)+' 연결을 끊으시겠습니까?',body:'이 거래소에서 돌아가는 전략은 새 주문을 내지 않습니다. 열려 있는 포지션은 거래소에 그대로 남습니다.',ok:'연결 끊기',danger:1,run:function(){ var a=acS(), t=tfS(); delete a.conn[k]; if(a.ex===k){ a.ex=null; a.auth={st:'idle'}; a.uid={st:'none'}; a.doneAt=null; } var L=acConnList(); if(L.length){ t.api={ex:L[0],last4:null,oauth:true}; } else { t.api=null; t.conn=false; t.uidLinked=false; } acSave(); toast(acName(k)+' 연결을 끊었습니다'); if(G.mode==='tfbrokers') acPageView(); else if(typeof stRe==='function') stRe(); }});
}
/* 확인 창: 되돌리기 어려운 일은 한 번 더 묻는다. type 이 있으면 그 글자를 쳐야 단추가 켜진다 */
function acConfirm(o){
  var old=document.getElementById('ac-cf'); if(old) old.remove();
  var w=document.createElement('div'); w.id='ac-cf'; w.className='acx-cf'; w.setAttribute('role','alertdialog'); w.setAttribute('aria-modal','true'); w.setAttribute('aria-label',o.title);
  w.innerHTML='<div class="bx"><h3>'+gEsc(o.title)+'</h3>'+(o.body?'<p>'+gEsc(o.body)+'</p>':'')+(o.list?'<ul>'+o.list.map(function(x){ return '<li>'+gEsc(x)+'</li>'; }).join('')+'</ul>':'')
    +(o.type?'<label class="ty"><span>계속하려면 <b>'+gEsc(o.type)+'</b> 를 입력해 주십시오</span><input id="ac-cf-in" autocomplete="off" spellcheck="false" oninput="var b=document.getElementById(\'ac-cf-ok\'); b.disabled=this.value.trim()!==\''+o.type+'\'"></label>':'')
    +'<div class="bts"><button type="button" class="no" onclick="acConfirmClose()">'+(o.no||'취소')+'</button><button type="button" class="ok'+(o.danger?' dg':'')+'" id="ac-cf-ok"'+(o.type?' disabled':'')+'>'+gEsc(o.ok||'확인')+'</button></div></div>';
  w.addEventListener('click',function(e){ if(e.target===w) acConfirmClose(); });
  document.body.appendChild(w); document.getElementById('ac-cf-ok').onclick=function(){ acConfirmClose(); try{ o.run(); }catch(e){} };
  try{ (document.getElementById('ac-cf-in')||w.querySelector('.no')).focus(); }catch(e){}
}
function acConfirmClose(){ var w=document.getElementById('ac-cf'); if(w) w.remove(); }
document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ if(document.getElementById('ac-cf')) acConfirmClose(); else if(document.getElementById('ac-auth')) acAuthNo(); } });
