/* ═══ 백테스트 여정 (bt) 4/4: 실행 준비 ═══
   한 화면이다. 왼쪽에는 방금 검증한 전략이 끝까지 남고, 오른쪽에서 단계가 제자리에서 하나씩 펼쳐진다.
   한 번에 한 가지만 묻는다. 끝낸 단계는 한 줄로 접힌다. 끝낸 단계를 다시 열어 보는 것만으로는 아무것도 지워지지 않는다.
   제휴 계정: 실행할 곳 → 제휴 계정 확인 → 거래 연결. 쓰던 계정: 실행할 곳 → 거래 연결 → 결제 카드 등록 */
var BT_EXS=[['bitget','Bitget','https://www.bitget.com/account/newapi'],['binance','Binance','https://www.binance.com/en/my/settings/api-management'],['okx','OKX','https://www.okx.com/account/my-api'],['bybit','Bybit','https://www.bybit.com/app/user/api-management'],['mexc','MEXC','https://www.mexc.com/user/openapi']];
var BT_RUN=0; /* 확인 작업의 번호. 선택이 바뀌면 앞선 확인은 멈춘다 */
var BT_SEL=null; /* 실행할 곳을 고르는 동안의 선택(아직 확정 전) */
function btF(){ var t=tfS(); t.bt=t.bt||{}; if(!t.bt.flow) t.bt.flow={step:'pick',path:null,ex:null,uid:'',uidIn:'',has:1,joined:0,card:null,api:null,okUid:0}; return t.bt.flow; }
/* 계정이 달라지면 그 계정으로 했던 확인과 연결을 무효로 한다. 입력해 둔 번호는 칸에 남긴다 */
function btInval(f){ var t=tfS(); if(f.uid&&!f.uidIn) f.uidIn=f.uid; f.uid=''; f.okUid=0; if(f.api){ f.api=null; t.conn=false; } t.uidLinked=false; }
/* 계정에 관한 상태는 곧바로 저장한다. 미뤄 두면 새로고침 때 앞선 계정의 확인이 되살아난다 */
function btSave(){ tfSave(); try{ clearTimeout(STORE.t); STORE.flush(); }catch(e){} }
function btExName(id){ for(var i=0;i<BT_EXS.length;i++) if(BT_EXS[i][0]===id) return BT_EXS[i][1]; return id||''; }
function btExApi(id){ for(var i=0;i<BT_EXS.length;i++) if(BT_EXS[i][0]===id) return BT_EXS[i][2]; return ''; }
function btExLogo(id,z){ return '<img src="assets/logos/app-'+id+'.png" alt="" width="'+(z||28)+'" height="'+(z||28)+'" loading="lazy">'; }
function btExOf(f){ return f.ex||(f.path==='own'?'binance':(BT.s.ex||'bitget')); }
function btNe(){ return tfSS3Rid(BT.s); }
function btGoTo(st){ location.hash='#/share/bt/'+btNe()+(st?'/'+st:''); }
function btUse(){
  var ne=btNe();
  if(!S.user){ try{ authOpen('signup'); }catch(e){} window.BT_RESUME=ne; var n=0, iv=setInterval(function(){ n++; if(S.user&&window.BT_RESUME){ clearInterval(iv); var r=window.BT_RESUME; window.BT_RESUME=null; location.hash='#/share/bt/'+r+'/go'; } else if(n>360||!window.BT_RESUME) clearInterval(iv); },500); return; }
  try{ tfTrack('bt_use',{id:BT.id}); }catch(e){}
  btGoTo('go');
}
var BT_OUT='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';
/* 왼쪽: 실행할 전략. 백테스트에서 본 그 선을 작게 다시 그린다 */
function btGoSpark(){
  var R=BT.R, W=300, H=96, p=6, vs=R.eq.map(function(x){ return x.v; }), all=vs.concat(R.bench,[1]), mn=Math.min.apply(null,all), mx=Math.max.apply(null,all);
  var X=function(j){ return p+j/Math.max(1,R.N-1)*(W-2*p); }, Y=function(v){ return p+(1-(v-mn)/(mx-mn||1))*(H-2*p); }, d='', b='';
  vs.forEach(function(v,j){ d+=(j?' L':'M')+X(j).toFixed(1)+' '+Y(v).toFixed(1); }); R.bench.forEach(function(v,j){ b+=(j?' L':'M')+X(j).toFixed(1)+' '+Y(v).toFixed(1); });
  var up=R.ret>=0, col=up?'#2fb98a':'#f0566a';
  return '<svg class="btg-sp" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="백테스트 잔고 그래프"><defs><linearGradient id="btgsp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+col+'" stop-opacity=".22"/><stop offset="1" stop-color="'+col+'" stop-opacity="0"/></linearGradient></defs>'
    +'<line x1="'+p+'" x2="'+(W-p)+'" y1="'+Y(1).toFixed(1)+'" y2="'+Y(1).toFixed(1)+'" stroke="rgba(255,255,255,.16)"/>'
    +'<path d="'+b+'" fill="none" stroke="rgba(255,255,255,.26)" stroke-width="1.1" stroke-dasharray="2 4"/>'
    +'<path d="'+d+' L'+X(R.N-1).toFixed(1)+' '+H+' L'+X(0).toFixed(1)+' '+H+' Z" fill="url(#btgsp)"/><path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.7" stroke-linejoin="round"/>'
    +'<circle cx="'+X(R.N-1).toFixed(1)+'" cy="'+Y(vs[R.N-1]).toFixed(1)+'" r="3.2" fill="'+col+'"/></svg>';
}
function btGoMe(){
  var s=BT.s, R=BT.R, ai=btAi(s), diff=Math.round(R.final)-Math.round(R.benchFinal);
  return '<aside class="btg-me"><small class="lb">실행할 전략</small><div class="hd">'+mkGlyph(s,34)+'<div><b>'+gEsc(mkHook(s))+'</b><span>'+MK_KIND[s.kind]+', '+gEsc(mkScope(s))+'</span></div><button type="button" class="mret" onclick="btGoTo(\'\')"><i class="num'+mkSign(R.ret)+'">'+mkPct0(R.ret,1)+'</i><em>'+btPerL()+' 결과 보기</em></button></div>'
    +'<div class="fig"><div><small>'+btPerL()+' 백테스트</small><b class="num'+mkSign(R.ret)+'">'+mkPct0(R.ret,1)+'</b></div><div class="r"><small>'+btUsd(BT.amt)+'가</small><b class="num">'+btUsd(R.final)+'</b></div></div>'
    +btGoSpark()
    +'<dl><div><dt>그냥 들고 있었을 때보다</dt><dd class="num '+(diff>=0?'mk-up':'mk-dn')+'">'+btUsdS(diff)+'</dd></div><div><dt>가장 크게 내려간 폭</dt><dd class="num">'+R.mdd.toFixed(1)+'%</dd></div>'
    +(ai?'<div><dt>'+btOppL(s)+' '+R.nOpp+'번 중</dt><dd class="num">'+btSkipL(s)+' '+R.nSkip+'번</dd></div>':'<div><dt>이긴 거래</dt><dd class="num">'+btWinTxt()+'</dd></div>')+'</dl>'
    +'<button type="button" class="lk" onclick="btGoTo(\'\')">백테스트 결과 다시 보기</button></aside>';
}
/* 단계 */
function btPathNow(){ var f=btF(); return f.step==='pick'?(BT_SEL||f.path||'partner'):f.path; }
function btGoSteps(){ return btPathNow()==='own'?[['pick','실행할 곳'],['api','거래 연결'],['pay','결제 카드 등록']]:[['pick','실행할 곳'],['uid','제휴 계정 확인'],['api','거래 연결']]; }
function btDoneK(k){ var f=btF(); return k==='pick'?!!f.path:k==='uid'?!!(f.okUid&&f.uid):k==='api'?!!(f.api&&(f.path!=='partner'||(f.okUid&&f.uid))):!!f.card; }
function btGoSum(k){
  var f=btF(), ex=(f.api&&f.api.ex)||btExOf(f);
  if(k==='pick') return f.path==='own'?'지금 쓰는 계정 그대로':'TETH 제휴 계정으로';
  if(k==='pay') return '카드 끝자리 <span class="num">'+gEsc(f.card||'')+'</span> 등록됨';
  if(k==='uid') return btExLogo(btExOf(f),16)+btExName(btExOf(f))+' 계정 <span class="num">'+gEsc(String(f.uid).slice(0,2))+'••••'+gEsc(String(f.uid).slice(-2))+'</span>';
  return btExLogo(ex,16)+btExName(ex)+', 키 끝자리 <span class="num">'+gEsc(f.api?f.api.last4:'')+'</span>';
}
function btGoHead(){
  var f=btF(), s=BT.s, L=btGoSteps(), left=L.filter(function(x){ return !btDoneK(x[0]); }).length, ex=btExName((f.api&&f.api.ex)||btExOf(f));
  if(f.step==='done') return '<div class="btg-okm"><span class="ring"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><div><h2 class="btg-h">계정 연결이 끝났어요</h2><p class="btg-s">'+gEsc(mkHook(s))+' 전략이 '+ex+' 계정과 이어졌어요.</p></div></div>';
  if(f.step==='pick') return '<h2 class="btg-h">이 전략을 어느 계정으로 실행할까요?</h2><p class="btg-s">전략은 회원님의 거래소 계정에서 돌아가요. 돈은 계속 그 계정에 있어요.</p>';
  if(f.step==='pay') return '<h2 class="btg-h">'+ex+' 연결을 마쳤어요</h2><p class="btg-s">이용료를 낼 카드를 등록하면 준비가 끝나요.</p>';
  return '<h2 class="btg-h">'+gEsc(mkHook(s))+' 전략을 연결하고 있어요</h2><p class="btg-s">계정 연결까지 '+left+'단계 남았어요.</p>';
}
function btGoFlow(){
  var f=btF(), L=btGoSteps(), body={pick:btGoPick,pay:btGoCard,uid:btGoUid,api:btGoApi};
  return btGoHead()+'<ol class="btg-sts">'+L.map(function(x,i){ var st=f.step==='done'?'ok':x[0]===f.step?'on':btDoneK(x[0])&&f.step!=='pick'?'ok':(x[0]==='pick'&&f.step!=='pick')?'ok':'nx';
    return '<li class="btg-st '+st+'"'+(st==='on'?' aria-current="step"':'')+'><div class="sh"><span class="sn num">'+(st==='ok'?TAI_CHECK:(i+1))+'</span><b>'+x[1]+'</b>'+(st==='ok'?'<span class="sm">'+btGoSum(x[0])+'</span>'+(f.step!=='done'?'<button type="button" class="ed" onclick="btGoEdit(\''+x[0]+'\')">바꾸기</button>':''):'')+'</div>'
      +(st==='on'?'<div class="sb" id="btg-sb">'+body[x[0]]()+'</div>':'')+'</li>'; }).join('')+'</ol>'
    +(f.step==='done'?btGoNext():'');
}
function btGoPage(){
  return '<div class="bt btg" id="bt-root" data-phase="go"><div class="tfw-hd bt-hd"><button class="bk" onclick="btGoTo(\'\')" aria-label="결과로"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><span class="ti">전략 실행 준비</span></div>'
    +'<div class="btg-grid">'+btGoMe()+'<div class="btg-flow" id="btg-flow">'+btGoFlow()+'</div></div></div>';
}
function btGoView(){
  if(!S.user){ btGoTo(''); return; }
  if(!BT.R) btCompute();
  var f=btF(); if(f.step==='done'&&btGoNextStep()!=='done') f.step=f.path?btGoNextStep():'pick';
  tfPageMode('tfbt','전략 실행 준비'); BT_RUN++; BT_SEL=null;
  TF_RENDERING=true; gContent(btGoPage()); TF_RENDERING=false; btGoFocus();
}
function btGoRe(){ BT_RUN++; var e=$('btg-flow'); if(!e){ btGoView(); return; } var r0=$('bt-root'); if(r0) r0.classList.remove('busy'); e.innerHTML=btGoFlow(); btGoFocus(); var on=e.querySelector('.btg-st.on, .btg-okm'); if(on&&innerWidth<=900) try{ on.scrollIntoView({block:'start',behavior:'smooth'}); }catch(x){} }
function btGoFocus(){ var a=document.querySelector('#btg-flow input[data-af]'); if(a&&innerWidth>640) try{ a.focus({preventScroll:true}); }catch(e){} }
/* 끝낸 단계를 다시 연다. 여는 것만으로는 아무것도 지우지 않는다 */
function btGoEdit(k){ var f=btF(); f.step=k; BT_SEL=null; btSave(); btGoRe(); }
/* 다음에 할 단계: 아직 끝내지 않은 첫 단계 */
function btGoNextStep(){ var f=btF(), L=btGoSteps(); for(var i=0;i<L.length;i++) if(!btDoneK(L[i][0])) return L[i][0]; return 'done'; }

/* 1. 실행할 곳: 거래소 이름이 아니라 계정의 조건으로 고른다 */
function btExRow(z){ return '<span class="lg">'+BT_EXS.map(function(e){ return btExLogo(e[0],z||22); }).join('')+'</span>'; }
function btGoPick(){
  var p=btPathNow();
  var card=function(k,t,who,l1,fee){ var on=p===k; return '<label class="btg-opt'+(on?' on':'')+'"><input type="radio" name="btg-path" value="'+k+'"'+(on?' checked':'')+' onchange="btPick(\''+k+'\')"><span class="rd" aria-hidden="true"></span><span class="bd"><b>'+t+'</b><span class="who">'+who+'</span><span>'+l1+'</span><span class="ft">'+btExRow(20)+'<em>'+fee+'</em></span></span></label>'; };
  return '<div class="btg-opts" role="radiogroup" aria-label="실행할 곳">'
    +card('partner','TETH 제휴 계정으로','TETH를 통해 만든 거래소 계정이 있거나, 새로 만들 분','계정 번호로 확인한 뒤 연결해요. 계정이 없으면 여기서 새로 만들 수 있어요.','TETH 이용료 0원')
    +card('own','지금 쓰는 계정 그대로','이미 쓰는 거래소 계정을 바꾸고 싶지 않은 분','쓰던 계정을 연결하고, 이용료를 낼 카드를 등록해요.','TETH 이용료 월 49,000원')
    +'</div><button type="button" class="bt-cta" onclick="btPickGo()">'+(p==='own'?'거래 연결로 계속':'제휴 계정 확인으로 계속')+'</button><p class="btg-n">나중에 다른 방법으로 바꿀 수 있어요.</p>';
}
function btPick(k){ BT_SEL=k; var keep=document.activeElement&&document.activeElement.value; btGoRe(); var r=document.querySelector('.btg-opt input[value="'+k+'"]'); if(r&&keep) try{ r.focus({preventScroll:true}); }catch(e){} }
function btPickGo(){ var f=btF(), k=btPathNow(); BT_SEL=null; if(f.path!==k){ btInval(f); f.api=null; f.card=null; f.ex=null; f.uidIn=''; f.joined=0; f.has=1; } f.path=k; if(!f.ex) f.ex=k==='partner'?(BT.s.ex||'bitget'):'binance'; f.step=btGoNextStep(); btSave(); btGoRe(); }

/* 입력 칸과 확인 줄 */
function btIn(id,lb,ph,val,attr){ return '<label class="btg-f" for="'+id+'"><span>'+lb+'</span><input id="'+id+'" class="num" placeholder="'+ph+'" value="'+gEsc(val||'')+'" autocomplete="off" spellcheck="false" aria-describedby="'+id+'-e" '+(attr||'')+'><small class="er" id="'+id+'-e" role="alert"></small></label>'; }
function btErr(id,msg){ var e=$(id+'-e'), i=$(id); if(e) e.textContent=msg||''; if(i){ i.classList.toggle('bad',!!msg); if(msg) try{ i.focus(); i.select&&i.select(); }catch(x){} } if(!msg){ var r=$('btg-rec'); if(r) r.remove(); } }
function btChecks(rows){ return '<div class="btg-chkw" id="btg-chkw"><p class="btg-tgt" id="btg-tgt"></p><ul class="btg-chk" id="btg-chk">'+rows.map(function(r,i){ return '<li id="btg-c'+i+'"><span class="ic"></span><b>'+r[0]+'</b><span>'+r[1]+'</span></li>'; }).join('')+'</ul></div>'; }
function btLock(on,label){ var r=$('bt-root'), b=$('btg-go'), sb=$('btg-sb'), q=document.querySelectorAll('#btg-flow .sb input, #btg-flow .sb .btg-exs button, #btg-flow .sb .btg-seg2 button'); if(r) r.classList.toggle('busy',!!on); if(sb) sb.classList.toggle('chk',!!on); for(var i=0;i<q.length;i++) q[i].disabled=!!on; if(b){ b.disabled=!!on; if(on){ b.setAttribute('data-l',b.textContent); b.innerHTML='<i class="sp"></i>'+label; } else if(b.getAttribute('data-l')) b.textContent=b.getAttribute('data-l'); } }
/* 확인을 차례로 진행한다. 확인하는 동안 입력한 것은 한 줄 요약으로 접히고, 그 자리에 확인 줄이 선다.
   선택이 바뀌면(BT_RUN 이 달라지면) 멈춘다. 실패하면 입력 칸이 값 그대로 돌아온다 */
function btRunChecks(n,fail,label,target,done,onFail){
  var my=++BT_RUN, box=$('btg-chk'); if(!box) return; var rows=box.querySelectorAll('li'); for(var z=0;z<rows.length;z++){ rows[z].className=''; rows[z].querySelector('.ic').innerHTML=''; }
  var tg=$('btg-tgt'); if(tg) tg.innerHTML=target;
  $('btg-chkw').classList.add('on'); btLock(1,label);
  var i=0; (function step(){
    if(my!==BT_RUN||!$('btg-chk')) return;
    if(i>0){ var p=$('btg-c'+(i-1)); if(fail&&fail.at===i-1){ p.className='no'; p.querySelector('.ic').textContent='!'; p.querySelector('span:last-child').textContent=fail.msg; setTimeout(function(){ if(my!==BT_RUN) return; btLock(0); onFail(fail); },700); return; } p.className='ok'; p.querySelector('.ic').innerHTML=TAI_CHECK; p.querySelector('span:last-child').textContent='확인했어요'; }
    if(i>=n){ setTimeout(function(){ if(my!==BT_RUN) return; done(); },480); return; }
    var c=$('btg-c'+i); c.className='run'; c.querySelector('.ic').innerHTML='<i></i>'; i++; setTimeout(step,700);
  })();
}

/* 결제 카드 등록 (쓰던 계정으로 실행할 때의 마지막 단계) */
function btGoCard(){
  return '<p class="btg-p">지금은 결제되지 않아요. 첫 결제는 전략을 시작하는 날이에요.</p>'
    +'<div class="btg-form">'+btIn('btg-cn','카드 번호','0000 0000 0000 0000','','inputmode="numeric" maxlength="19" data-af oninput="btCardFmt(this)"')
    +'<div class="two">'+btIn('btg-ce','유효기간','MM / YY','','inputmode="numeric" maxlength="7" oninput="btExpFmt(this)"')+btIn('btg-cc','보안 코드','뒷면 3자리','','inputmode="numeric" maxlength="4" type="password" oninput="btErr(\'btg-cc\',\'\')"')+'</div>'
    +btIn('btg-ch','카드에 적힌 이름','HONG GILDONG','','oninput="btErr(\'btg-ch\',\'\')"')
    +'</div><div class="btg-bill"><span>전략을 시작하는 날부터</span><b class="num">월 49,000원</b></div>'
    +'<button type="button" class="bt-cta" id="btg-go" onclick="btCardGo()">카드 등록하기</button>';
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
  if(n.slice(0,4)==='0000'){ btErr('btg-cn','이 카드는 등록되지 않았어요. 다른 카드로 다시 해 주세요'); return; }
  var f=btF(); f.card=n.slice(-4); f.step=btGoNextStep(); var t=tfS(); t.cardOn=true; btSave(); try{ if(f.step==='done') tfTrack('bt_connected',{id:BT.id,path:f.path}); }catch(e){} btGoRe();
}

/* 거래소 고르기. 거래소를 바꾸면 그 거래소로 했던 확인과 연결은 다시 해야 한다 */
function btExTiles(cur){ return '<div class="btg-exs" role="radiogroup" aria-label="거래소">'+BT_EXS.map(function(e){ var on=cur===e[0]; return '<button type="button" role="radio" aria-checked="'+on+'" class="'+(on?'on':'')+'" onclick="btExSet(\''+e[0]+'\')">'+btExLogo(e[0],28)+'<span>'+e[1]+'</span></button>'; }).join('')+'</div>'; }
function btExSet(e){ var f=btF(); if(btExOf(f)===e) return; f.ex=e; btInval(f); f.api=null; f.uidIn=''; f.joined=0; btSave(); btGoRe(); }

/* 제휴 계정 확인 */
function btGoUid(){
  var f=btF(), ex=btExOf(f), has=f.has!==0, nm=btExName(ex), form=has||f.joined;
  return '<p class="btg-p">회원님의 제휴 계정이 맞는지 계정 번호로 확인해요. 비밀번호는 묻지 않아요.</p>'
    +btExTiles(ex)
    +'<div class="btg-seg2" role="radiogroup" aria-label="계정"><button type="button" role="radio" aria-checked="'+has+'" class="'+(has?'on':'')+'" onclick="btHas(1)">'+nm+' 제휴 계정이 있어요</button><button type="button" role="radio" aria-checked="'+!has+'" class="'+(!has?'on':'')+'" onclick="btHas(0)">새로 만들게요</button></div>'
    +(form?'<div class="btg-form">'+btIn('btg-uid',nm+' 계정 번호 (UID)','예: 38291042',f.uidIn||f.uid,'inputmode="numeric" maxlength="14" data-af oninput="this.value=this.value.replace(/\\D/g,\'\');btErr(\'btg-uid\',\'\')"')+'</div>'
      +'<p class="btg-hint">'+nm+' 앱에서 프로필 사진을 누르면 이름 아래에 보이는 숫자예요.</p>'
      +btChecks([['계정 찾기','이 번호의 계정이 있는지'],['제휴 계정 확인','TETH 제휴로 쓸 수 있는지']])
      +'<button type="button" class="bt-cta" id="btg-go" onclick="btUidGo()">계정 확인하기</button>'
      :'<div class="btg-new"><p>'+nm+' 가입 화면이 새 창으로 열려요. 가입을 마치고 이 화면으로 돌아오면 고른 내용이 그대로 남아 있어요.</p></div>'
      +'<button type="button" class="bt-cta" id="btg-go" onclick="btJoin()">'+nm+' 가입 화면 열기'+BT_OUT+'</button><button type="button" class="bt-sec" onclick="btJoined()">가입을 마쳤어요</button>');
}
function btHas(v){ var f=btF(); f.has=v; if(v) f.joined=0; btSave(); btGoRe(); }
function btJoined(){ var f=btF(); f.joined=1; btSave(); btGoRe(); }
function btJoin(){ var f=btF(), b=null; try{ TF_BROKERS.forEach(function(x){ if(x.id===btExOf(f)) b=x; }); }catch(e){} try{ window.open('https://'+(b&&b.site?b.site:'bitget.com'),'_blank','noopener'); }catch(e){} f.joined=1; btSave(); setTimeout(btGoRe,600); }
function btUidGo(){
  var v=$('btg-uid').value.replace(/\D/g,''); btErr('btg-uid','');
  if(v.length<6){ btErr('btg-uid','계정 번호는 숫자 6자리 이상이에요'); return; }
  var f=btF(), ex=btExOf(f), nm=btExName(ex); if(v!==f.uid){ var had=!!(f.okUid||f.api); btInval(f); f.uidIn=v; btSave(); if(had) btGoRe(); } else { f.uidIn=v; btSave(); }
  var fail=/^0+$/.test(v)?{at:0,msg:'찾지 못했어요',err:'이 번호의 '+nm+' 계정을 찾지 못했어요. 번호를 다시 확인해 주세요',alt:'other'}:/^9{6,}$/.test(v)?{at:1,msg:'제휴 계정이 아니에요',err:'다른 경로로 만든 계정이에요. 제휴 계정을 새로 만들거나, 이 계정을 그대로 쓰는 방법으로 바꿀 수 있어요',alt:'own'}:null;
  btRunChecks(2,fail,'계정 확인 중',btExLogo(ex,18)+nm+' 계정 <span class="num">'+gEsc(v)+'</span>',function(){ var g=btF(), t=tfS(); if(btExOf(g)!==ex||g.uidIn!==v) return; g.uid=v; g.uidIn=''; g.okUid=1; g.step=btGoNextStep(); t.uid=v; t.uidLinked=true; btSave(); btGoRe(); },function(x){
    var g=btF(), had=!!(g.okUid||g.api); btInval(g); btSave(); if(had) btGoRe();
    btErr('btg-uid',x.err); var host=$('btg-uid').closest('.btg-form'); if(host&&!$('btg-rec')) host.insertAdjacentHTML('beforeend','<div class="btg-rec" id="btg-rec"><button type="button" onclick="btHas(0)">제휴 계정 새로 만들기</button>'+(x.alt==='own'?'<button type="button" onclick="btToOwn()">이 계정 그대로 쓰기</button>':'<button type="button" onclick="btGoEdit(\'pick\')">실행할 곳 다시 고르기</button>')+'</div>'); });
}
function btToOwn(){ var f=btF(); btInval(f); f.api=null; f.path='own'; f.step='api'; btSave(); btGoRe(); }

/* 거래 연결 */
function btGoApi(){
  var f=btF(), ex=btExOf(f), nm=btExName(ex), okx=ex==='okx';
  return '<p class="btg-p">전략이 '+nm+' 계정으로 주문을 낼 수 있게 연결해요. 돈은 옮기지 않아요.</p>'
    +(f.path==='own'?btExTiles(ex):'')
    +'<div class="btg-guide"><ol><li><span>'+nm+'의 <b>API 관리</b>에서 새 키를 만들어요</span></li><li><span><b>조회</b>와 <b>거래</b>만 켜고, 출금은 꺼 두세요</span></li><li><span>만들어진 값 '+(okx?'세':'두')+' 개를 아래에 붙여 넣어요</span></li></ol>'
    +'<a class="btg-out" href="'+btExApi(ex)+'" target="_blank" rel="noopener" onclick="btApiOut()">'+nm+' API 관리 열기'+BT_OUT+'</a></div>'
    +'<div class="btg-form">'+btIn('btg-ak','API Key',nm+'에서 만든 키','','data-af oninput="btErr(\'btg-ak\',\'\')"')+btIn('btg-as','Secret Key','키와 함께 받은 비밀 키','','type="password" oninput="btErr(\'btg-as\',\'\')"')
    +(okx?btIn('btg-ap','Passphrase','키를 만들 때 정한 문구','','type="password" oninput="btErr(\'btg-ap\',\'\')"'):'')+'</div>'
    +'<p class="btg-perm">TETH가 쓰는 권한은 <b>잔고 조회</b>와 <b>주문</b>이에요. 출금 권한은 받지 않아요.</p>'
    +btChecks([['키 확인','키가 맞는지'],['주문 권한','주문을 낼 수 있는지'],['출금 권한 없음','출금이 꺼져 있는지']])
    +'<button type="button" class="bt-cta" id="btg-go" onclick="btApiGo()">'+nm+' 연결하기</button>';
}
function btApiOut(){ try{ btSave(); tfTrack('bt_api_out',{ex:btExOf(btF())}); }catch(e){} }
function btApiGo(){
  var f=btF(), ex=btExOf(f), nm=btExName(ex), path=f.path, k=$('btg-ak').value.trim(), s=$('btg-as').value.trim(), p=$('btg-ap')?$('btg-ap').value.trim():'x';
  ['btg-ak','btg-as','btg-ap'].forEach(function(i){ btErr(i,''); });
  if(k.length<8){ btErr('btg-ak','API Key를 붙여 넣어 주세요'); return; }
  if(s.length<8){ btErr('btg-as','Secret Key를 붙여 넣어 주세요'); return; }
  if(!p){ btErr('btg-ap','OKX는 Passphrase도 필요해요'); return; }
  var fail=/^BAD/i.test(k)?{at:0,msg:'맞지 않아요',err:'키가 맞지 않아요. '+nm+'에서 다시 복사해 붙여 넣어 주세요'}:/^NOTRADE/i.test(k)?{at:1,msg:'꺼져 있어요',err:'거래 권한이 꺼져 있어요. '+nm+'의 키 설정에서 거래를 켜 주세요'}:/^WD/i.test(k)?{at:2,msg:'켜져 있어요',err:'출금 권한이 켜져 있어요. 끄고 다시 연결해 주세요'}:null;
  btRunChecks(3,fail,nm+' 연결 확인 중',btExLogo(ex,18)+nm+', 키 끝자리 <span class="num">'+gEsc(k.slice(-4))+'</span>',function(){ var g=btF(), t=tfS(); if(g.path!==path||btExOf(g)!==ex) return; g.ex=ex; g.api={ex:ex,last4:k.slice(-4)}; g.step=btGoNextStep(); t.api={ex:ex,last4:k.slice(-4)}; t.conn=true; t.ob={st:'completed',ex:ex,uid:g.path==='partner'?g.uid:'',err:null}; btSave(); if(g.step==='done') try{ tfTrack('bt_connected',{id:BT.id,path:path}); }catch(e){} btGoRe(); },function(x){ btErr('btg-ak',x.err); });
}

/* 끝: 바로 다음 한 가지 */
function btGoNext(){
  var f=btF();
  return '<section class="btg-next"><h3>다음은 계정에서 사용할 금액이에요</h3><p>백테스트에서는 '+btUsd(BT.amt)+'로 봤어요. 이 전략이 계정에서 쓸 금액을 정하면, 멈추는 기준을 확인하고 직접 시작 버튼을 눌러요.</p>'
    +'<dl class="bt-dl"><div><dt>실행 계정</dt><dd>'+btExLogo(f.api.ex,16)+btExName(f.api.ex)+'</dd></div><div><dt>TETH 이용료</dt><dd>'+(f.path==='own'?'월 49,000원, 시작하는 날부터':'0원')+'</dd></div></dl></section>'
    +'<button type="button" class="bt-cta" onclick="btFinal()">사용할 금액 정하기</button>';
}
function btFinal(){ try{ tfTrack('bt_final',{id:BT.id}); }catch(e){} cpSetupGo(btNe()); }
