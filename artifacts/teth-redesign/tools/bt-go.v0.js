/* ═══ 백테스트 뒤: 실행 방법 → 결제 또는 계정 확인 → 거래 연결 → 완료 ═══
   어느 화면에서도 무엇을 실행하려는지(전략 요약)가 보인다. 한 화면에 한 가지만 묻는다 */
var BT_EXS=[['bitget','Bitget'],['binance','Binance'],['okx','OKX'],['bybit','Bybit'],['mexc','MEXC']];
var BT_FLOW={own:[['go','실행 방법'],['card','결제'],['ex','거래소 연결'],['ok','완료']],partner:[['go','실행 방법'],['partner','거래소'],['uid','계정 확인'],['api','거래 연결'],['ok','완료']]};
var BT_BUSY=0;
function btF(){ var t=tfS(); t.bt=t.bt||{}; t.bt.flow=t.bt.flow||{path:null,ex:null,uid:'',has:1,card:null,api:null,okUid:0}; return t.bt.flow; }
function btExName(id){ for(var i=0;i<BT_EXS.length;i++) if(BT_EXS[i][0]===id) return BT_EXS[i][1]; return id||''; }
function btExLogo(id,z){ return '<img src="assets/logos/app-'+id+'.png" alt="" width="'+(z||28)+'" height="'+(z||28)+'" loading="lazy">'; }
function btNe(){ return tfSS3Rid(BT.s); }
function btGoTo(st){ location.hash='#/share/bt/'+btNe()+(st?'/'+st:''); }
function btUse(){
  var ne=btNe();
  if(!S.user){ try{ authOpen('signup'); }catch(e){} window.BT_RESUME=ne; var n=0, iv=setInterval(function(){ n++; if(S.user&&window.BT_RESUME){ clearInterval(iv); var r=window.BT_RESUME; window.BT_RESUME=null; location.hash='#/share/bt/'+r+'/go'; } else if(n>360||!window.BT_RESUME) clearInterval(iv); },500); return; }
  try{ tfTrack('bt_use',{id:BT.id}); }catch(e){}
  btGoTo('go');
}
function btSum(){
  var s=BT.s, R=BT.R;
  return '<div class="btg-sum">'+mkGlyph(s,32)+'<div class="t"><b>'+gEsc(mkHook(s))+'</b><span>'+MK_KIND[s.kind]+', '+gEsc(mkScope(s))+'</span></div>'
    +'<dl><div><dt>'+btPerL()+'</dt><dd class="num'+mkSign(R.ret)+'">'+mkPct0(R.ret,1)+'</dd></div><div><dt>가장 크게 내려간 폭</dt><dd class="num">'+R.mdd.toFixed(1)+'%</dd></div><div><dt>시작 금액</dt><dd class="num">'+btUsd(BT.amt)+'</dd></div></dl>'
    +'<button type="button" class="lk" onclick="btGoTo(\'\')">결과 다시 보기</button></div>';
}
function btProg(st){
  var f=btF(), L=BT_FLOW[f.path||'partner'], at=0; L.forEach(function(x,i){ if(x[0]===st) at=i; });
  if(st==='go') L=[['go','실행 방법'],['x','계정'],['y','거래 연결'],['ok','완료']];
  return '<ol class="btg-prog" aria-label="진행 단계">'+L.map(function(x,i){ return '<li class="'+(i<at?'ok':i===at?'on':'')+'"'+(i===at?' aria-current="step"':'')+'><span class="n num">'+(i<at?TAI_CHECK:(i+1))+'</span>'+x[1]+'</li>'; }).join('')+'</ol>';
}
function btShell(st,title,sub,body){
  return '<div class="bt btg" id="bt-root" data-phase="go"><div class="tfw-hd bt-hd"><button class="bk" onclick="history.back()" aria-label="뒤로"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><span class="ti">전략 실행 준비</span></div>'
    +btSum()+'<div class="btg-col">'+btProg(st)+'<h2 class="btg-h">'+title+'</h2>'+(sub?'<p class="btg-s">'+sub+'</p>':'')+body+'</div></div>';
}
function btGoView(st){
  var f=btF();
  if(!S.user){ btGoTo(''); return; }
  if(st!=='go'&&!f.path){ btGoTo('go'); return; }
  tfPageMode('tfbt','전략 실행 준비'); BT_BUSY=0;
  var h={go:btGoPick,card:btGoCard,ex:btGoEx,partner:btGoPartner,uid:btGoUid,api:btGoApi,ok:btGoOk}[st]();
  TF_RENDERING=true; gContent(h); TF_RENDERING=false;
  var a=document.querySelector('#bt-root [data-af]'); if(a&&innerWidth>640) try{ a.focus({preventScroll:true}); }catch(e){}
}

/* 1. 실행 방법 */
function btGoPick(){
  var f=btF(), ex=BT.s.ex||'bitget', p=f.path||'partner';
  var card=function(k,t,l1,l2,foot){ var on=p===k; return '<label class="btg-opt'+(on?' on':'')+'"><input type="radio" name="btg-path" value="'+k+'"'+(on?' checked':'')+' onchange="btPick(\''+k+'\')"><span class="rd" aria-hidden="true"></span><span class="bd"><b>'+t+'</b><span>'+l1+'</span><em>'+l2+'</em>'+foot+'</span></label>'; };
  return btShell('go','검증은 끝났어요. 어디에서 실행할까요?','전략은 회원님의 거래소 계정에서 돌아가요. 돈은 계속 그 계정에 있어요.',
    '<div class="btg-opts" role="radiogroup" aria-label="실행 방법">'
    +card('partner','TETH 제휴 거래소에서','제휴 거래소 계정을 연결하거나 새로 만들어요.','TETH 이용료는 0원이에요.','<span class="lg">'+['bitget','okx','binance','bybit'].map(function(e){ return btExLogo(e,22); }).join('')+'</span>')
    +card('own','지금 쓰는 거래소 그대로','쓰던 계정을 그대로 연결해요.','TETH 이용료는 카드로 내요. 월 49,000원.','')
    +'</div><button type="button" class="bt-cta" data-af onclick="btPickGo()">계속</button>'
    +'<p class="btg-n">나중에 다른 방법으로 바꿀 수 있어요.</p>');
}
function btPick(k){ var f=btF(); f.path=k; tfSave(); var o=document.querySelectorAll('.btg-opt'); for(var i=0;i<o.length;i++) o[i].classList.toggle('on',o[i].querySelector('input').value===k); }
function btPickGo(){ var f=btF(); if(!f.path) f.path='partner'; if(!f.ex) f.ex=f.path==='partner'?(BT.s.ex||'bitget'):null; tfSave(); btGoTo(f.path==='own'?'card':'partner'); }

/* 입력 칸과 확인 줄 */
function btIn(id,lb,ph,val,attr){ return '<label class="btg-f" for="'+id+'"><span>'+lb+'</span><input id="'+id+'" class="num" placeholder="'+ph+'" value="'+gEsc(val||'')+'" autocomplete="off" spellcheck="false" '+(attr||'')+'><small class="er" id="'+id+'-e" role="alert"></small></label>'; }
function btErr(id,msg){ var e=$(id+'-e'), i=$(id); if(e) e.textContent=msg||''; if(i){ i.classList.toggle('bad',!!msg); if(msg) try{ i.focus(); }catch(x){} } }
function btChecks(rows){ return '<ul class="btg-chk" id="btg-chk">'+rows.map(function(r,i){ return '<li id="btg-c'+i+'"><span class="ic"></span><b>'+r[0]+'</b><span>'+r[1]+'</span></li>'; }).join('')+'</ul>'; }
/* 확인을 차례로 진행한다. fail 은 실패한 줄 번호와 이유 */
function btRunChecks(n,fail,done){
  if(BT_BUSY) return; BT_BUSY=1; var root=$('bt-root'); if(root) root.classList.add('busy');
  var i=0; (function step(){
    if(!$('btg-chk')){ BT_BUSY=0; return; }
    if(i>0){ var p=$('btg-c'+(i-1)); if(fail&&fail.at===i-1){ p.className='no'; p.querySelector('.ic').textContent='!'; p.querySelector('span:last-child').textContent=fail.msg; BT_BUSY=0; if(root) root.classList.remove('busy'); return; } p.className='ok'; p.querySelector('.ic').innerHTML=TAI_CHECK; }
    if(i>=n){ BT_BUSY=0; if(root) root.classList.remove('busy'); setTimeout(done,420); return; }
    var c=$('btg-c'+i); c.className='run'; c.querySelector('.ic').innerHTML='<i></i>'; i++; setTimeout(step,760);
  })();
}

/* 2A. 결제 */
function btGoCard(){
  var f=btF();
  if(f.card) return btShell('card','결제 수단이 등록돼 있어요','', '<div class="btg-done"><span class="ic">'+TAI_CHECK+'</span><div><b>카드 끝자리 '+gEsc(f.card)+'</b><span>월 49,000원, 매달 같은 날 결제돼요</span></div></div><button type="button" class="bt-cta" data-af onclick="btGoTo(\'ex\')">거래소 연결하기</button>');
  return btShell('card','TETH 이용료를 낼 카드를 등록해요','월 49,000원이에요. 첫 결제는 전략을 시작하는 날에 이뤄져요.',
    '<div class="btg-form">'+btIn('btg-cn','카드 번호','0000 0000 0000 0000','','inputmode="numeric" maxlength="19" data-af oninput="btCardFmt(this)"')
    +'<div class="two">'+btIn('btg-ce','유효기간','MM / YY','','inputmode="numeric" maxlength="7" oninput="btExpFmt(this)"')+btIn('btg-cc','보안 코드','뒷면 3자리','','inputmode="numeric" maxlength="4" type="password"')+'</div>'
    +btIn('btg-ch','카드에 적힌 이름','HONG GILDONG','','')
    +'</div><div class="btg-bill"><span>TETH 이용료</span><b class="num">월 49,000원</b></div>'
    +'<button type="button" class="bt-cta" onclick="btCardGo()">카드 등록하고 계속</button>');
}
function btCardFmt(e){ var v=e.value.replace(/\D/g,'').slice(0,16); e.value=v.replace(/(.{4})/g,'$1 ').trim(); btErr('btg-cn',''); }
function btExpFmt(e){ var v=e.value.replace(/\D/g,'').slice(0,4); e.value=v.length>2?v.slice(0,2)+' / '+v.slice(2):v; btErr('btg-ce',''); }
function btCardGo(){
  var n=$('btg-cn').value.replace(/\D/g,''), x=$('btg-ce').value.replace(/\D/g,''), c=$('btg-cc').value.replace(/\D/g,''), h=$('btg-ch').value.trim();
  ['btg-cn','btg-ce','btg-cc','btg-ch'].forEach(function(i){ btErr(i,''); });
  if(n.length<15){ btErr('btg-cn','카드 번호를 끝까지 입력해 주세요'); return; }
  var mm=+x.slice(0,2); if(x.length<4||mm<1||mm>12){ btErr('btg-ce','유효기간을 월과 연도 순서로 입력해 주세요'); return; }
  if(c.length<3){ btErr('btg-cc','보안 코드 3자리를 입력해 주세요'); return; }
  if(!h){ btErr('btg-ch','카드에 적힌 이름을 입력해 주세요'); return; }
  if(n.slice(0,4)==='0000'){ btErr('btg-cn','이 카드는 승인되지 않았어요. 다른 카드로 다시 해 주세요'); return; }
  var f=btF(); f.card=n.slice(-4); var t=tfS(); t.payDone=true; t.plan='paid'; tfSave(); toast('카드를 등록했어요'); btGoTo('ex');
}

/* 거래소 고르기 (두 길이 함께 쓴다) */
function btExTiles(cur,fn){ return '<div class="btg-exs" role="radiogroup" aria-label="거래소">'+BT_EXS.map(function(e){ var on=cur===e[0]; return '<button type="button" role="radio" aria-checked="'+on+'" class="'+(on?'on':'')+'" onclick="'+fn+'(\''+e[0]+'\')">'+btExLogo(e[0],30)+'<span>'+e[1]+'</span></button>'; }).join('')+'</div>'; }
function btApiForm(ex){
  return '<div class="btg-perm"><span class="y">잔고 조회</span><span class="y">주문</span><span class="n">출금은 받지 않아요</span></div>'
    +'<div class="btg-form">'+btIn('btg-ak','API Key',btExName(ex)+'에서 만든 키','','data-af oninput="btErr(\'btg-ak\',\'\')"')+btIn('btg-as','Secret Key','키와 함께 받은 비밀 키','','type="password" oninput="btErr(\'btg-as\',\'\')"')
    +(ex==='okx'?btIn('btg-ap','Passphrase','키를 만들 때 정한 문구','','type="password" oninput="btErr(\'btg-ap\',\'\')"'):'')+'</div>'
    +'<details class="btg-how"><summary>키는 어디에서 만드나요</summary><ol><li>'+btExName(ex)+'에 로그인해 API 관리로 가요</li><li>새 키를 만들고 조회와 거래만 켜요. 출금은 끄세요</li><li>만들어진 키 두 개를 위 칸에 붙여 넣어요</li></ol></details>'
    +btChecks([['키 확인','키가 맞는지 봐요'],['주문 권한','전략이 주문을 낼 수 있는지 봐요'],['출금 권한 없음','출금이 꺼져 있는지 봐요']]);
}
function btApiGo(ex,next){
  var k=$('btg-ak').value.trim(), s=$('btg-as').value.trim(), p=$('btg-ap')?$('btg-ap').value.trim():'x';
  ['btg-ak','btg-as','btg-ap'].forEach(function(i){ btErr(i,''); });
  if(k.length<8){ btErr('btg-ak','API Key를 붙여 넣어 주세요'); return; }
  if(s.length<8){ btErr('btg-as','Secret Key를 붙여 넣어 주세요'); return; }
  if(!p){ btErr('btg-ap','OKX는 Passphrase도 필요해요'); return; }
  var fail=/^BAD/i.test(k)?{at:0,msg:'키가 맞지 않아요. 다시 복사해 붙여 넣어 주세요'}:/^NOTRADE/i.test(k)?{at:1,msg:'거래 권한이 꺼져 있어요. 키 설정에서 켜 주세요'}:/^WD/i.test(k)?{at:2,msg:'출금 권한이 켜져 있어요. 끄고 다시 해 주세요'}:null;
  btRunChecks(3,fail,function(){ var f=btF(), t=tfS(); f.api={ex:ex,last4:k.slice(-4)}; t.api={ex:ex,last4:k.slice(-4)}; t.conn=true; t.ob={st:'completed',ex:ex,uid:f.uid||t.uid||'',err:null}; tfSave(); btGoTo(next); });
}

/* 3A. 쓰던 거래소 연결 */
function btGoEx(){
  var f=btF(), ex=f.ex||'binance';
  return btShell('ex','쓰던 거래소를 연결해요','전략이 이 계정으로 주문을 내요. 돈은 옮기지 않아요.',
    btExTiles(ex,'btExSet')+'<div id="btg-api">'+btApiForm(ex)+'</div><button type="button" class="bt-cta" onclick="btApiGo(btF().ex||\'binance\',\'ok\')">연결하기</button>');
}
function btExSet(e){ var f=btF(); f.ex=e; tfSave(); btGoView(location.hash.split('/').pop()); }

/* 2B. 제휴 거래소 */
function btGoPartner(){
  var f=btF(), ex=f.ex||BT.s.ex||'bitget', has=f.has!==0;
  return btShell('partner','어느 제휴 거래소를 쓸까요?','이 전략은 '+btExName(BT.s.ex||'bitget')+'에서 기록을 쌓았어요. 다른 제휴 거래소에서도 똑같이 실행돼요.',
    btExTiles(ex,'btExSet')
    +'<div class="btg-seg2" role="radiogroup" aria-label="계정"><button type="button" role="radio" aria-checked="'+has+'" class="'+(has?'on':'')+'" onclick="btHas(1)">'+btExName(ex)+' 계정이 있어요</button><button type="button" role="radio" aria-checked="'+!has+'" class="'+(!has?'on':'')+'" onclick="btHas(0)">새로 만들게요</button></div>'
    +(has?'<button type="button" class="bt-cta" data-af onclick="btGoTo(\'uid\')">계정 확인하러 가기</button>'
      :'<div class="btg-new"><ol><li>아래 버튼으로 '+btExName(ex)+' 가입 화면을 열어요. 2분쯤 걸려요</li><li>가입을 마치면 이 화면으로 돌아와요</li><li>계정 번호로 확인하면 끝나요</li></ol></div><button type="button" class="bt-cta" data-af onclick="btJoin()">'+btExName(ex)+' 가입 화면 열기</button><button type="button" class="bt-sec" onclick="btGoTo(\'uid\')">가입을 마쳤어요</button>'));
}
function btHas(v){ var f=btF(); f.has=v; tfSave(); btGoView('partner'); }
function btJoin(){ var f=btF(), b=null; try{ TF_BROKERS.forEach(function(x){ if(x.id===(f.ex||'bitget')) b=x; }); }catch(e){} try{ window.open('https://'+(b&&b.site?b.site:'bitget.com'),'_blank','noopener'); }catch(e){} toast('가입을 마치면 이 화면으로 돌아와 주세요'); }

/* 3B. 계정 확인 (UID) */
function btGoUid(){
  var f=btF(), ex=f.ex||'bitget';
  return btShell('uid','회원님의 '+btExName(ex)+' 계정이 맞는지 확인해요','계정 번호만 있으면 돼요. 비밀번호는 묻지 않아요.',
    '<div class="btg-with">'+btExLogo(ex,26)+'<b>'+btExName(ex)+'</b></div>'
    +'<div class="btg-form">'+btIn('btg-uid',btExName(ex)+' 계정 번호 (UID)','예: 38291042',f.uid,'inputmode="numeric" maxlength="14" data-af oninput="this.value=this.value.replace(/\\D/g,\'\');btErr(\'btg-uid\',\'\')"')+'</div>'
    +'<details class="btg-how"><summary>계정 번호는 어디에 있나요</summary><ol><li>'+btExName(ex)+' 앱이나 웹에 로그인해요</li><li>프로필 사진을 누르면 이름 아래에 숫자가 보여요</li><li>그 숫자를 복사해 위 칸에 붙여 넣어요</li></ol></details>'
    +btChecks([['계정 찾기','이 번호의 계정이 있는지 봐요'],['제휴 계정 확인','TETH 제휴로 쓸 수 있는 계정인지 봐요']])
    +'<button type="button" class="bt-cta" onclick="btUidGo()">확인하기</button>');
}
function btUidGo(){
  var v=$('btg-uid').value.replace(/\D/g,''); btErr('btg-uid','');
  if(v.length<6){ btErr('btg-uid','계정 번호는 숫자 6자리 이상이에요'); return; }
  var f=btF(); f.uid=v; tfSave();
  var fail=/^0+$/.test(v)?{at:0,msg:'이 번호의 계정을 찾지 못했어요. 번호를 다시 확인해 주세요'}:/^9{6,}$/.test(v)?{at:1,msg:'다른 경로로 만든 계정이에요. 새 계정을 만들면 제휴로 쓸 수 있어요'}:null;
  btRunChecks(2,fail,function(){ var t=tfS(); f.okUid=1; t.uid=v; t.uidLinked=true; tfSave(); btGoTo('api'); });
}

/* 4B. 거래 연결 (API) */
function btGoApi(){
  var f=btF(), ex=f.ex||'bitget';
  if(!f.okUid){ return btShell('api','계정 확인이 먼저예요','', '<button type="button" class="bt-cta" data-af onclick="btGoTo(\'uid\')">계정 확인하러 가기</button>'); }
  return btShell('api','이제 전략이 주문을 낼 수 있게 연결해요','계정은 확인됐어요. 남은 건 거래 연결 하나예요.',
    '<div class="btg-done sm"><span class="ic">'+TAI_CHECK+'</span><div><b>'+btExName(ex)+' 계정 '+gEsc(String(f.uid).slice(0,2))+'••••'+gEsc(String(f.uid).slice(-2))+'</b><span>계정 확인 완료</span></div></div>'
    +btApiForm(ex)+'<button type="button" class="bt-cta" onclick="btApiGo(btF().ex||\'bitget\',\'ok\')">연결하기</button>');
}

/* 5. 완료와 다음 단계 미리 보기 */
function btGoOk(){
  var f=btF(), s=BT.s, R=BT.R, ex=(f.api&&f.api.ex)||f.ex||'bitget';
  if(!f.api){ return btShell('ok','아직 거래 연결이 남았어요','', '<button type="button" class="bt-cta" data-af onclick="btGoTo(\''+(f.path==='own'?'ex':'api')+'\')">거래 연결하러 가기</button>'); }
  return '<div class="bt btg btg-ok" id="bt-root" data-phase="go"><div class="tfw-hd bt-hd"><button class="bk" onclick="btGoTo(\'\')" aria-label="결과로"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><span class="ti">전략 실행 준비</span></div>'
    +'<div class="btg-col">'+btProg('ok')
    +'<div class="btg-okm"><span class="ring"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><h2 class="btg-h">연결됐어요</h2><p class="btg-s">'+btExName(ex)+' 계정이 TETH와 이어졌어요. 이제 마지막 설정만 남았어요.</p></div>'
    +'<section class="btg-card"><header>'+mkGlyph(s,32)+'<div><b>'+gEsc(mkHook(s))+'</b><span>'+MK_KIND[s.kind]+', '+gEsc(mkScope(s))+'</span></div><i class="num'+mkSign(R.ret)+'">'+btPerL()+' '+mkPct0(R.ret,1)+'</i></header>'
    +'<dl class="bt-dl"><div><dt>실행 거래소</dt><dd>'+btExLogo(ex,18)+btExName(ex)+' <span class="num mut">키 끝자리 '+gEsc(f.api.last4)+'</span></dd></div>'
    +'<div><dt>TETH 이용료</dt><dd>'+(f.path==='own'?'월 49,000원, 카드 끝자리 '+gEsc(f.card||''):'0원')+'</dd></div>'
    +'<div><dt>권한</dt><dd>잔고 조회, 주문. 출금은 없음</dd></div></dl></section>'
    +'<section class="btg-next"><h3>다음에 정할 것</h3><ol><li class="on"><span class="n num">1</span><div><b>운용 금액</b><span>백테스트에서는 '+btUsd(BT.amt)+'로 봤어요. 실제로 맡길 금액을 정해요.</span></div></li>'
    +'<li><span class="n num">2</span><div><b>멈추는 기준</b><span>잔고가 얼마까지 줄면 전략을 멈출지 정해요.</span></div></li>'
    +'<li><span class="n num">3</span><div><b>마지막 확인</b><span>조건을 한 번 더 보고 직접 시작 버튼을 눌러요.</span></div></li></ol></section>'
    +'<button type="button" class="bt-cta" data-af onclick="btFinal()">마지막 설정으로 가기</button>'
    +'<button type="button" class="bt-sec" onclick="btGoTo(\'\')">백테스트 결과 다시 보기</button></div></div>';
}
function btFinal(){ try{ tfTrack('bt_final',{id:BT.id}); }catch(e){} cpSetupGo(btNe()); }
