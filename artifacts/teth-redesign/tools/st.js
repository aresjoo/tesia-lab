/* ═══ 설정 (st): 일반, 계정, 알림, 결제, 보안 ═══
   사이드바의 설정은 작은 메뉴가 아니라 전용 화면으로 간다. 주소는 #/settings/<탭>.
   되돌리기 어려운 일(계정 삭제, 구독 해지, 카드 삭제, 모든 기기 로그아웃)은 결과를 알리고 한 번 더 확인한다. */
var ST_TABS=[['general','일반','<circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.700 1.700 0 0 0 .340 1.870l.060.060a2 2 0 1 1-2.830 2.830l-.060-.060a1.700 1.700 0 0 0-1.870-.340 1.700 1.700 0 0 0-1.040 1.560V21a2 2 0 1 1-4 0v-.090a1.700 1.700 0 0 0-1.110-1.560 1.700 1.700 0 0 0-1.870.340l-.060.060a2 2 0 1 1-2.830-2.830l.060-.060a1.700 1.700 0 0 0 .340-1.870 1.700 1.700 0 0 0-1.560-1.040H3a2 2 0 1 1 0-4h.090a1.700 1.700 0 0 0 1.560-1.110 1.700 1.700 0 0 0-.340-1.870l-.060-.060a2 2 0 1 1 2.830-2.830l.060.060a1.700 1.700 0 0 0 1.870.340h.080a1.700 1.700 0 0 0 1.040-1.560V3a2 2 0 1 1 4 0v.090a1.700 1.700 0 0 0 1.040 1.560 1.700 1.700 0 0 0 1.870-.340l.060-.060a2 2 0 1 1 2.830 2.830l-.060.060a1.700 1.700 0 0 0-.340 1.870v.080a1.700 1.700 0 0 0 1.560 1.040H21a2 2 0 1 1 0 4h-.090a1.700 1.700 0 0 0-1.560 1.040z"/>'],
  ['account','계정','<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.400 3.600-7 8-7s8 2.600 8 7"/>'],
  ['notify','알림','<path d="M6 9a6 6 0 1 1 12 0c0 6 2.500 7.500 2.500 7.500h-17S6 15 6 9z"/><path d="M10 20.500a2.200 2.200 0 0 0 4 0"/>'],
  ['billing','결제','<rect x="3" y="5.500" width="18" height="13" rx="2.500"/><path d="M3 10h18M7 15h3"/>'],
  ['security','보안','<path d="M12 3l7.500 3v5.500c0 4.700-3.200 8.300-7.500 9.500-4.300-1.200-7.500-4.800-7.500-9.500V6z"/><path d="M9 12l2.200 2.200L15.200 10"/>']];
var ST={tab:'general',edit:null};
function stS(){ var t=tfS(); if(!t.st) t.st={handle:null,notif:{},twofa:false,pwAt:null}; return t.st; }
function stHandle(){ var s=stS(); if(s.handle) return s.handle; var e=(S.user&&S.user.email)||''; return (e.split('@')[0]||'teth_user').replace(/[^a-z0-9_]/gi,'').toLowerCase().slice(0,20)||'teth_user'; }
function stIc(p){ return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'; }
function stDate(ms){ var d=new Date(ms); return d.getFullYear()+'. '+(d.getMonth()+1)+'. '+d.getDate()+'.'; }
function stGo(tab){ var h='#/settings/'+(tab||'general'); if(location.hash===h){ stRoute(h); return; } location.hash=h; } /* 같은 주소면 hashchange가 없다 */
function stBack(){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} gHome(); }
function stRoute(h){
  var m=h.match(/^#\/settings(?:\/([a-z]+))?$/); if(!m) return false;
  if(!window.TF_STATE_READY) return true;
  if(!S.user){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} gHome(); authOpen('login'); return true; }
  ST.tab=ST_TABS.some(function(x){ return x[0]===m[1]; })?m[1]:'general'; ST.edit=null; stView(); return true;
}
function stView(){
  tfPageMode('tfset','설정'); document.body.classList.remove('tf-route');
  TF_RENDERING=true;
  gContent('<div class="stg" id="st-root"><nav class="stg-nav" aria-label="설정"><button type="button" class="stg-back" onclick="stBack()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>앱으로 돌아가기</button>'
    +'<small>설정</small>'+ST_TABS.map(function(x){ return '<button type="button" class="stg-ni'+(ST.tab===x[0]?' on':'')+'"'+(ST.tab===x[0]?' aria-current="page"':'')+' onclick="stGo(\''+x[0]+'\')">'+stIc(x[2])+x[1]+'</button>'; }).join('')
    +'<small>바로 가기</small><button type="button" class="stg-ni" onclick="tfBrokersView()">'+stIc('<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1"/><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>')+'거래소 연결</button><button type="button" class="stg-ni" onclick="tfTxHelp()">'+stIc('<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 1-1 1.700M12 17h.010"/>')+'상담원에게 묻기</button></nav>'
    +'<main class="stg-main" id="st-main">'+stBody()+'</main></div>');
  TF_RENDERING=false;
}
function stRe(){ var m=document.getElementById('st-main'); if(m) m.innerHTML=stBody(); else if(G.mode==='tfset') stView(); }
function stBody(){ return ({general:stGeneral,account:stAccount,notify:stNotify,billing:stBilling,security:stSecurity}[ST.tab]||stGeneral)(); }
function stRow(k,v,act,sub){ return '<div class="stg-r"><div class="k"><b>'+k+'</b>'+(sub?'<span>'+sub+'</span>':'')+'</div><div class="v">'+(v||'')+'</div>'+(act?'<div class="a">'+act+'</div>':'')+'</div>'; }
function stBtn(l,fn,cls){ return '<button type="button" class="stg-b'+(cls?' '+cls:'')+'" onclick="'+fn+'">'+l+'</button>'; }
function stSec(t,rows,act){ return '<section class="stg-sec">'+(t?'<header><h2>'+t+'</h2>'+(act||'')+'</header>':'')+'<div class="stg-card">'+rows+'</div></section>'; }
/* ── 일반 ── */
function stGeneral(){
  var cur=(GLC_LANGS.find(function(l){ return l.c===GLC.lang; })||GLC_LANGS[0]), th=document.body.classList.contains('light')?'light':'dark';
  return '<h1>일반</h1>'+stSec('',
    stRow('언어','','<select class="stg-sel" aria-label="언어" onchange="stLang(this.value)">'+GLC_LANGS.map(function(l){ return '<option value="'+l.c+'"'+(l.c===cur.c?' selected':'')+'>'+l.n+'</option>'; }).join('')+'</select>','화면과 알림에 쓰는 언어입니다')
    +stRow('화면','','<div class="stg-seg" role="group" aria-label="화면">'+[['dark','어둡게'],['light','밝게']].map(function(o){ return '<button type="button" aria-pressed="'+(th===o[0])+'" onclick="stTheme(\''+o[0]+'\')">'+o[1]+'</button>'; }).join('')+'</div>')
    +stRow('금액 표시','<span class="num">USD</span>','','모든 금액은 미국 달러로 표시합니다. 자산 수량은 BTC, ETH, USDT처럼 자산 단위 그대로입니다'));
}
function stLang(c){ GLC.lang=c; try{ localStorage.setItem('tethLang',c); }catch(e){} try{ applyLang(); }catch(e){} stView(); }
function stTheme(v){ try{ if(typeof gThemeSet==='function') gThemeSet(v); else { document.body.classList.toggle('light',v==='light'); localStorage.setItem('tethTheme',v); } }catch(e){} stRe(); }
/* ── 계정 ── */
function stAccessTxt(){ var acc=acAccess(), L=acConnList(); return acc==='paid'?'구독 이용 중':acc==='partner'?'TETH 초대 계정 이용 중':(L.length?'구독 종료':'실행 환경 미연결'); }
function stAccount(){
  var u=S.user||{}, a=acS(), L=acConnList(), e=ST.edit;
  var nameRow=e==='name'?'<div class="stg-r ed"><div class="k"><b>이름</b></div><div class="v"><input id="st-name" class="stg-in" maxlength="30" value="'+gEsc(u.name||'')+'"><small class="er" id="st-name-e"></small></div><div class="a">'+stBtn('취소','stEdit(null)')+stBtn('저장','stNameSave()','p')+'</div></div>':stRow('이름',gEsc(u.name||''),stBtn('변경','stEdit(\'name\')'));
  var hdRow=e==='handle'?'<div class="stg-r ed"><div class="k"><b>사용자명</b></div><div class="v"><span class="stg-at">@</span><input id="st-hd" class="stg-in" maxlength="20" value="'+gEsc(stHandle())+'"><small class="er" id="st-hd-e"></small></div><div class="a">'+stBtn('취소','stEdit(null)')+stBtn('저장','stHandleSave()','p')+'</div></div>':stRow('사용자명','<span class="num">@'+gEsc(stHandle())+'</span>',stBtn('변경','stEdit(\'handle\')'),'공유한 전략에 등록자로 표시됩니다');
  return '<h1>계정</h1>'+stSec('계정',
    stRow('상태','<span class="stg-pill '+(acAccess()==='none'?'':'on')+'">'+stAccessTxt()+'</span>',acAccess()==='none'?stBtn('실행 환경 연결','tfBrokersView()','p'):stBtn('결제와 이용 방식','stGo(\'billing\')'))
    +nameRow+hdRow
    +stRow('이메일','<span class="num">'+gEsc(u.email||'')+'</span>',stBtn('변경','stEmailDlg()')))
    +stSec('연결된 거래소',L.length?L.map(function(k){ var c=a.conn[k]; return stRow(acLogo(k,20)+acName(k),(c.via==='paid'?'구독으로 이용':'TETH 초대 계정')+(c.uid?', <span class="num">'+gEsc(String(c.uid).slice(0,2))+'••••'+gEsc(String(c.uid).slice(-2))+'</span>':''),stBtn('연결 끊기','acDisc(\''+k+'\')')); }).join(''):stRow('연결된 거래소가 없습니다','',stBtn('거래소 연결','tfBrokersView()','p'),'전략을 실행하려면 거래소 계정이 필요합니다'))
    +stSec('',stRow('로그아웃','',stBtn('로그아웃','stLogout()'),'이 기기에서만 로그아웃합니다'))
    +stSec('',stRow('계정 삭제','',stBtn('계정 삭제','stDelete()','dg'),'전략과 기록이 모두 지워지며 되돌릴 수 없습니다'));
}
function stEdit(k){ ST.edit=k; stRe(); var i=document.getElementById(k==='name'?'st-name':'st-hd'); if(i) try{ i.focus(); i.select(); }catch(e){} }
function stNameSave(){ var v=(document.getElementById('st-name').value||'').trim(), e=document.getElementById('st-name-e'); if(v.length<2){ e.textContent='이름은 2자 이상이어야 합니다'; return; } S.user.name=v; ST.edit=null; acSave(); try{ authSyncUI(); gSideRender(); }catch(x){} stRe(); toast('이름을 바꿨습니다'); }
function stHandleSave(){ var v=(document.getElementById('st-hd').value||'').trim().toLowerCase(), e=document.getElementById('st-hd-e'); if(!/^[a-z0-9_]{3,20}$/.test(v)){ e.textContent='영문 소문자, 숫자, 밑줄로 3자에서 20자까지 쓸 수 있습니다'; return; } if(/^(teth|admin|support)$/.test(v)){ e.textContent='쓸 수 없는 사용자명입니다'; return; } stS().handle=v; ST.edit=null; acSave(); stRe(); toast('사용자명을 바꿨습니다'); }
function stDlg(html,label){ stDlgClose(); var w=document.createElement('div'); w.id='st-dlg'; w.className='acx-cf stg-dlg'; w.setAttribute('role','dialog'); w.setAttribute('aria-modal','true'); w.setAttribute('aria-label',label||'설정'); w.innerHTML='<div class="bx">'+html+'</div>'; w.addEventListener('click',function(e){ if(e.target===w) stDlgClose(); }); document.body.appendChild(w); var f=w.querySelector('input,button'); if(f) try{ f.focus(); }catch(e){} }
function stDlgClose(){ var w=document.getElementById('st-dlg'); if(w) w.remove(); }
/* 이메일 변경: 새 주소 → 그 주소로 보낸 확인 번호 → 변경 */
function stEmailDlg(){ ST.em={step:0,v:''}; stEmailPaint(); }
function stEmailPaint(){ var s=ST.em;
  stDlg(s.step===0?'<h3>이메일 변경</h3><p>새 이메일 주소로 확인 번호를 보냅니다. 확인을 마치면 로그인 주소가 바뀝니다.</p><label class="ty"><span>새 이메일</span><input id="st-em" type="email" autocomplete="off" value="'+gEsc(s.v)+'" placeholder="name@example.com"></label><small class="er" id="st-em-e"></small><div class="bts"><button type="button" class="no" onclick="stDlgClose()">취소</button><button type="button" class="ok" onclick="stEmailSend()">확인 번호 보내기</button></div>'
    :'<h3>확인 번호 입력</h3><p><b class="num">'+gEsc(s.v)+'</b> 으로 보낸 6자리 번호를 입력해 주십시오.</p><label class="ty"><span>확인 번호</span><input id="st-ec" inputmode="numeric" maxlength="6" autocomplete="one-time-code" class="num"></label><small class="er" id="st-em-e"></small><div class="bts"><button type="button" class="no" onclick="ST.em.step=0;stEmailPaint()">주소 다시 입력</button><button type="button" class="ok" onclick="stEmailDone()">이메일 변경</button></div>','이메일 변경'); }
function stEmailSend(){ var v=(document.getElementById('st-em').value||'').trim().toLowerCase(), e=document.getElementById('st-em-e'); if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)){ e.textContent='이메일 주소를 확인해 주십시오'; return; } if(v===(S.user.email||'').toLowerCase()){ e.textContent='지금 쓰는 주소와 같습니다'; return; } ST.em={step:1,v:v}; stEmailPaint(); }
function stEmailDone(){ var c=(document.getElementById('st-ec').value||'').replace(/\D/g,''), e=document.getElementById('st-em-e'); if(c.length!==6){ e.textContent='6자리 번호를 입력해 주십시오'; return; } if(c==='000000'){ e.textContent='번호가 맞지 않습니다. 다시 확인해 주십시오'; return; } S.user.email=ST.em.v; acSave(); stDlgClose(); try{ authSyncUI(); }catch(x){} stRe(); toast('이메일을 바꿨습니다'); }
function stLogout(){ acConfirm({title:'로그아웃하시겠습니까?',body:'돌아가는 전략은 계속 실행됩니다. 이 기기에서만 로그아웃합니다.',ok:'로그아웃',run:function(){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} gLogout(); }}); }
function stDelete(){
  var live=(tfS().strat||[]).filter(function(x){ return x.status==='live'; }).length, cps=((tfS().cp&&tfS().cp.copies)||[]).filter(function(c){ return c.status==='active'; }).length;
  acConfirm({title:'계정을 삭제하시겠습니까?',body:'삭제하면 되돌릴 수 없습니다. 아래 내용이 모두 지워집니다.',list:['만든 전략과 백테스트 기록','복사해 실행 중인 전략'+(live+cps?' ('+(live+cps)+'개는 즉시 멈춥니다)':''),'거래소 연결과 결제 정보','대화 기록'].concat(acSubOn()?['구독은 즉시 해지되며 남은 기간은 환불되지 않습니다']:[]),type:'삭제',ok:'계정 삭제',danger:1,run:function(){
    acConfirm({title:'마지막 확인입니다',body:(S.user.email||'')+' 계정을 지금 삭제합니다. 거래소에 있는 자산과 열린 포지션은 거래소에 그대로 남습니다.',ok:'영구 삭제',danger:1,run:function(){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} try{ S.tf=null; localStorage.removeItem('teth.state'); }catch(e){} gLogout(); toast('계정을 삭제했습니다'); }}); }});
}
/* ── 알림 ── */
var ST_NF=[['fill','체결','전략이 사고팔았을 때',['push','email']],['state','전략 상태','전략이 멈추거나 오류가 났을 때',['push','email']],['risk','손실 한도','정해 둔 손실 한도에 닿았을 때',['push','email']],['copy','복사한 전략','원본 전략의 설정이 바뀌었을 때',['push']],['bill','결제와 계정','결제, 로그인, 보안 변경',['email']],['news','소식','새 기능과 전략 소개',[]]];
function stNfOf(k){ var n=stS().notif[k]; if(n) return n; for(var i=0;i<ST_NF.length;i++) if(ST_NF[i][0]===k) return ST_NF[i][3].slice(); return []; }
function stNotify(){
  return '<h1>알림</h1>'+stSec('TETH',ST_NF.map(function(x){ var v=stNfOf(x[0]), lock=x[0]==='bill';
    return stRow(x[1],'','<div class="stg-seg multi" role="group" aria-label="'+x[1]+' 알림">'+[['push','푸시'],['email','이메일']].map(function(o){ var on=v.indexOf(o[0])>=0, dis=lock&&o[0]==='email'; return '<button type="button" aria-pressed="'+on+'"'+(dis?' disabled title="결제와 보안 알림은 이메일로 항상 보냅니다"':'')+' onclick="stNf(\''+x[0]+'\',\''+o[0]+'\')">'+o[1]+'</button>'; }).join('')+'</div>',x[2]); }).join(''));
}
function stNf(k,ch){ var s=stS(), v=stNfOf(k).slice(), i=v.indexOf(ch); if(i>=0) v.splice(i,1); else v.push(ch); s.notif[k]=v; acSave(); stRe(); }
/* ── 결제 ── */
function stBilling(){
  var a=acS(), acc=acAccess(), sub=a.sub, on=acSubOn(), def=a.cards.filter(function(c){ return c.def; })[0]||a.cards[0];
  var plan=on?stRow('TETH 구독','<span class="num">'+acUsd((sub&&sub.price)||AC_CFG.price)+' / 월</span>',(sub&&sub.st==='cancelled')?stBtn('구독 다시 시작','stSubResume()','p'):'',(sub&&sub.st==='cancelled')?'<span class="num">'+stDate(sub.until)+'</span> 까지 쓸 수 있습니다. 그 뒤에는 결제되지 않습니다':'다음 결제일 <span class="num">'+stDate((sub&&sub.next)||Date.now()+30*864e5)+'</span>')
    :acc==='partner'?stRow('TETH 초대 계정','이용료 없음','','월 결제가 없습니다. 카드 등록도 필요 없습니다')
    :(sub&&sub.st==='cancelled')?stRow('구독이 끝났습니다','',stBtn('다시 구독','tfBrokersView()','p'),'<span class="num">'+stDate(sub.until)+'</span>에 끝났습니다. 전략은 새 주문을 내지 않습니다')
    :stRow('이용 중인 방식이 없습니다','',stBtn('실행 환경 연결','tfBrokersView()','p'),'TETH 초대 계정은 이용료가 없고, 구독은 월 '+acUsd(AC_CFG.price)+'입니다');
  var fail=a.pay&&a.pay.st==='fail'&&!on?'<p class="stg-warn" role="alert">마지막 결제가 승인되지 않았습니다. 결제 수단을 확인해 주십시오.</p>':'';
  var hist=a.bill.length?'<div class="stg-tbl">'+a.bill.slice(0,ST.allBill?99:4).map(function(b){ return '<button type="button" class="stg-tr" onclick="stReceipt(\''+b.id+'\')"><b>'+gEsc(b.label)+'</b><span class="num">'+stDate(b.at)+'</span><span class="stg-tag '+b.st+'">'+({paid:'결제 완료',failed:'결제 실패',refunded:'환불 완료'}[b.st]||b.st)+'</span><span class="num am">'+acUsd(b.amt)+'</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>'; }).join('')+'</div>':'<div class="stg-card"><p class="stg-empty">'+(acc==='partner'?'TETH 초대 계정은 결제 내역이 없습니다':'아직 결제 내역이 없습니다')+'</p></div>';
  var bt=a.billTo||{email:(S.user&&S.user.email)||'',name:(S.user&&S.user.name)||'',addr:''};
  var info=ST.edit==='bill'?'<div class="stg-card"><div class="stg-form"><label><span>결제 이메일</span><input id="st-be" class="stg-in" value="'+gEsc(bt.email)+'"></label><label><span>이름</span><input id="st-bn" class="stg-in" value="'+gEsc(bt.name)+'"></label><label><span>청구지 주소</span><input id="st-ba" class="stg-in" value="'+gEsc(bt.addr)+'" placeholder="도로명 주소, 도시, 우편번호, 국가"></label><small class="er" id="st-bi-e"></small><div class="bts">'+stBtn('취소','stEdit(null)')+stBtn('저장','stBillSave()','p')+'</div></div></div>'
    :'<div class="stg-card">'+stRow('결제 이메일','<span class="num">'+gEsc(bt.email||'-')+'</span>')+stRow('이름',gEsc(bt.name||'-'))+stRow('청구지 주소',gEsc(bt.addr||'입력하지 않음'))+'</div>';
  var cards=a.cards.length?a.cards.map(function(c){ return '<div class="stg-r cd"><div class="k">'+stIc('<rect x="3" y="5.500" width="18" height="13" rx="2.500"/><path d="M3 10h18"/>')+'<div><b>'+gEsc(c.brand)+'</b><span class="num">•••• '+gEsc(c.last4)+', '+gEsc(c.exp)+'</span></div></div><div class="v">'+(c.def?'<span class="stg-tag def">기본</span>':'')+'</div><div class="a">'+(c.def?'':stBtn('기본으로','stCardDef(\''+c.id+'\')'))+stBtn('삭제','stCardDel(\''+c.id+'\')')+'</div></div>'; }).join(''):'<p class="stg-empty">등록한 결제 수단이 없습니다</p>';
  return '<h1>결제</h1>'+fail+stSec('',plan)
    +'<section class="stg-sec"><header><h2>결제 내역</h2>'+(a.bill.length>4&&!ST.allBill?stBtn('모두 보기','ST.allBill=1;stRe()'):'')+'</header>'+hist+'</section>'
    +(acc==='partner'&&!a.cards.length&&!a.bill.length?'':'<section class="stg-sec"><header><h2>결제 정보</h2>'+(ST.edit==='bill'?'':stBtn('편집','stEdit(\'bill\')'))+'</header>'+info+'</section>'
    +'<section class="stg-sec"><header><h2>결제 수단</h2>'+stBtn('새로 추가','stCardDlg()')+'</header><div class="stg-card">'+cards+'</div></section>')
    +(on&&!(sub&&sub.st==='cancelled')?stSec('',stRow('구독 해지','',stBtn('해지','stSubCancel()','dg'),'해지해도 결제한 기간이 끝날 때까지는 모든 기능을 쓸 수 있습니다')):'');
}
function stBillSave(){ var e=(document.getElementById('st-be').value||'').trim(), n=(document.getElementById('st-bn').value||'').trim(), ad=(document.getElementById('st-ba').value||'').trim(), er=document.getElementById('st-bi-e'); if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)){ er.textContent='결제 이메일을 확인해 주십시오'; return; } if(!n){ er.textContent='이름을 입력해 주십시오'; return; } acS().billTo={email:e,name:n,addr:ad}; ST.edit=null; acSave(); stRe(); toast('결제 정보를 저장했습니다'); }
function stReceipt(id){ var a=acS(), b=a.bill.filter(function(x){ return x.id===id; })[0]; if(!b) return; var bt=a.billTo||{};
  stDlg('<h3>'+({paid:'영수증',failed:'결제 실패 내역',refunded:'환불 내역'}[b.st]||'내역')+'</h3><dl class="stg-rc"><div><dt>내용</dt><dd>'+gEsc(b.label)+'</dd></div><div><dt>날짜</dt><dd class="num">'+stDate(b.at)+'</dd></div><div><dt>금액</dt><dd class="num">'+acUsd(b.amt)+' USD</dd></div><div><dt>결제 수단</dt><dd class="num">'+gEsc(b.brand||'')+' •••• '+gEsc(b.last4||'')+'</dd></div><div><dt>상태</dt><dd>'+({paid:'결제 완료',failed:'승인되지 않음',refunded:'환불 완료'}[b.st])+'</dd></div><div><dt>번호</dt><dd class="num">'+gEsc(b.id)+'</dd></div>'+(bt.name?'<div><dt>받는 사람</dt><dd>'+gEsc(bt.name)+'</dd></div>':'')+'</dl><div class="bts"><button type="button" class="ok" onclick="stDlgClose()">닫기</button></div>','결제 내역'); }
function stCardDlg(){ stDlg('<h3>결제 수단 추가</h3><div class="btg-form">'+acIn('sc-cn','카드 번호','0000 0000 0000 0000','inputmode="numeric" maxlength="19" oninput="var v=this.value.replace(/\\D/g,\'\').slice(0,16); this.value=v.replace(/(.{4})/g,\'$1 \').trim()"')+'<div class="two">'+acIn('sc-ce','유효기간','MM / YY','inputmode="numeric" maxlength="7" oninput="var v=this.value.replace(/\\D/g,\'\').slice(0,4); this.value=v.length>2?v.slice(0,2)+\' / \'+v.slice(2):v"')+acIn('sc-cc','보안 코드','뒷면 3자리','inputmode="numeric" maxlength="4" type="password"')+'</div>'+acIn('sc-ch','카드에 적힌 이름','HONG GILDONG','')+'</div><div class="bts"><button type="button" class="no" onclick="stDlgClose()">취소</button><button type="button" class="ok" onclick="stCardAdd()">추가</button></div>','결제 수단 추가'); }
function stCardAdd(){ var c=acCardRead('sc-'); if(!c) return; if(!acCharge(c)){ acErr('sc-cn','이 카드는 등록되지 않았습니다. 다른 카드를 써 주십시오'); return; } var a=acS(); a.cards.push({id:'c'+Date.now().toString(36),last4:c.last4,brand:c.brand,exp:c.exp,name:c.name,def:!a.cards.length}); acSave(); stDlgClose(); stRe(); toast('결제 수단을 추가했습니다'); }
function stCardDef(id){ acS().cards.forEach(function(c){ c.def=c.id===id; }); acSave(); stRe(); }
function stCardDel(id){ var a=acS(), c=a.cards.filter(function(x){ return x.id===id; })[0]; if(!c) return;
  if(c.def&&acSubOn()&&a.cards.length<2&&!(a.sub&&a.sub.st==='cancelled')){ acConfirm({title:'이 카드는 지금 삭제할 수 없습니다',body:'구독 결제에 쓰는 유일한 카드입니다. 다른 카드를 먼저 추가하거나 구독을 해지해 주십시오.',ok:'카드 추가',run:function(){ stCardDlg(); }}); return; }
  acConfirm({title:c.brand+' •••• '+c.last4+' 카드를 삭제하시겠습니까?',body:'삭제한 카드로는 더 결제되지 않습니다.',ok:'삭제',danger:1,run:function(){ a.cards=a.cards.filter(function(x){ return x.id!==id; }); if(a.cards.length&&!a.cards.some(function(x){ return x.def; })) a.cards[0].def=true; acSave(); stRe(); toast('카드를 삭제했습니다'); }}); }
function stSubCancel(){ var a=acS(), until=(a.sub&&a.sub.next)||Date.now()+30*864e5, L=acConnList(), part=L.some(function(k){ return a.conn[k].via==='partner'; });
  acConfirm({title:'구독을 해지하시겠습니까?',body:stDate(until)+' 까지는 지금처럼 쓸 수 있습니다.',list:['그 뒤에는 결제되지 않습니다',part?'TETH 초대 계정이 연결되어 있어 해지 뒤에도 이용료 없이 계속 쓸 수 있습니다':'그 뒤에는 돌아가는 전략이 새 주문을 내지 않습니다. 열린 포지션은 거래소에 그대로 남습니다'],ok:'구독 해지',danger:1,run:function(){ a.sub={st:'cancelled',since:a.sub&&a.sub.since,until:until,price:(a.sub&&a.sub.price)||AC_CFG.price}; acSave(); stRe(); toast('구독을 해지했습니다'); }}); }
function stSubResume(){ var a=acS(); if(!a.cards.length){ acConfirm({title:'결제 수단이 필요합니다',body:'구독을 다시 시작하려면 카드를 먼저 등록해 주십시오.',ok:'카드 추가',run:function(){ stCardDlg(); }}); return; } a.sub={st:'active',since:(a.sub&&a.sub.since)||Date.now(),next:(a.sub&&a.sub.until)||Date.now()+30*864e5,price:AC_CFG.price}; tfS().payDone=true; acSave(); stRe(); toast('구독을 다시 시작했습니다'); }
/* ── 보안 ── */
function stSecurity(){ var s=stS(), ua=navigator.userAgent, dev=/Windows/.test(ua)?'Windows':/Mac/.test(ua)?'Mac':/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':'이 기기', br=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':/Firefox\//.test(ua)?'Firefox':'브라우저';
  return '<h1>보안</h1>'+stSec('로그인',
    stRow('비밀번호','',stBtn('변경','stPwDlg()'),s.pwAt?'<span class="num">'+stDate(s.pwAt)+'</span> 에 바꿨습니다':'12자 이상, 숫자와 특수문자를 포함합니다')
    +stRow('2단계 인증','','<button type="button" class="stg-sw" role="switch" aria-checked="'+!!s.twofa+'" aria-label="2단계 인증" onclick="stTwofa()"><i></i></button>','로그인할 때 이메일로 받은 번호를 한 번 더 확인합니다'))
    +stSec('로그인된 기기',stRow(dev+', '+br,'<span class="stg-tag def">이 기기</span>','','지금 사용 중')+stRow('다른 기기 모두 로그아웃','',stBtn('로그아웃','stOutAll()'),'이 기기를 뺀 모든 곳에서 로그아웃합니다'))
    +stSec('거래소 권한',stRow('TETH가 쓰는 권한','잔고 조회, 주문 실행','','출금 권한은 요청하지 않습니다. 승인은 거래소의 보안 설정에서 언제든 끊을 수 있습니다'));
}
function stTwofa(){ var s=stS(); if(s.twofa){ acConfirm({title:'2단계 인증을 끄시겠습니까?',body:'비밀번호만으로 로그인하게 됩니다.',ok:'끄기',danger:1,run:function(){ s.twofa=false; acSave(); stRe(); }}); } else { s.twofa=true; acSave(); stRe(); toast('2단계 인증을 켰습니다'); } }
function stOutAll(){ acConfirm({title:'다른 기기를 모두 로그아웃하시겠습니까?',body:'이 기기는 그대로 로그인되어 있습니다. 돌아가는 전략에는 영향이 없습니다.',ok:'모두 로그아웃',run:function(){ toast('다른 기기를 모두 로그아웃했습니다'); }}); }
function stPwDlg(){ stDlg('<h3>비밀번호 변경</h3><label class="ty"><span>지금 비밀번호</span><input id="st-p0" type="password" autocomplete="current-password"></label><label class="ty"><span>새 비밀번호</span><input id="st-p1" type="password" autocomplete="new-password"></label><label class="ty"><span>새 비밀번호 확인</span><input id="st-p2" type="password" autocomplete="new-password"></label><small class="er" id="st-pw-e"></small><div class="bts"><button type="button" class="no" onclick="stDlgClose()">취소</button><button type="button" class="ok" onclick="stPwSave()">변경</button></div>','비밀번호 변경'); }
function stPwSave(){ var g=function(i){ return document.getElementById(i).value; }, e=document.getElementById('st-pw-e'), a=g('st-p0'), b=g('st-p1'), c=g('st-p2'); if(!a){ e.textContent='지금 비밀번호를 입력해 주십시오'; return; } if(b.length<12||!/\d/.test(b)||!/[^A-Za-z0-9]/.test(b)){ e.textContent='새 비밀번호는 12자 이상이고 숫자와 특수문자가 있어야 합니다'; return; } if(b!==c){ e.textContent='새 비밀번호가 서로 다릅니다'; return; } if(a===b){ e.textContent='지금 비밀번호와 다른 것을 써 주십시오'; return; } stS().pwAt=Date.now(); acSave(); stDlgClose(); stRe(); toast('비밀번호를 바꿨습니다'); }
