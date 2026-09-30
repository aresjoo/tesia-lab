/* ═══ 설정을 ChatGPT 설정 어휘로 (sk-settings) ═══
   셸(레일, 제목, 섹션 카드, 알약 조작)은 CSS로 모든 탭에 같이 적용한다.
   결제: 구독 카드 하나(플랜, 결제 수단, 청구 정보) / 결제 내역 최근 3건 / 관리는 창에서.
   보안: 로그인 / 로그인한 기기 / 거래소 연결. 한 행에 조작 하나.
   모바일: #/settings 는 목록, #/settings/<탭> 은 상세. */
var SK_CHEV='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
var SK_NEXT='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
function skMob(){ return window.innerWidth<=900; }
function stMList(){ var h='#/settings'; if(location.hash===h){ stRoute(h); return; } location.hash=h; }
function skDate(ms){ return stDate(ms); }
function skDateK(ms){ var d=new Date(ms); return d.getFullYear()+'년 '+(d.getMonth()+1)+'월 '+d.getDate()+'일'; }
function skExp(e){ var m=String(e||'').match(/([0-9]{2})[/]([0-9]{2})/); return m?'20'+m[2]+'년 '+(+m[1])+'월 만료':'만료 '+gEsc(e||''); }
/* ── 결제 ── */
function skBilling(){
  var a=acS(), acc=acAccess(), sub=a.sub, on=acSubOn(), cx=sub&&sub.st==='cancelled', def=a.cards.filter(function(c){ return c.def; })[0]||a.cards[0];
  var price=acUsd((sub&&sub.price)||AC_CFG.price)+' / 월';
  var plan=on?(cx?stRow('TETH 구독','<span class="num">'+price+'</span>',stBtn('다시 시작','stSubResume()'),'<span class="num">'+skDateK(sub.until)+'</span>까지 이용할 수 있습니다.')
      :stRow('TETH 구독','<span class="num">'+price+'</span>',stBtn('구독 관리','skSubDlg()'),'다음 결제일은 <span class="num">'+skDateK((sub&&sub.next)||Date.now()+30*864e5)+'</span>입니다.'))
    :acc==='partner'?stRow('TETH 초대 계정','','','이용료가 없습니다.')
    :cx?stRow('구독이 종료되었습니다','',stBtn('다시 구독','tfBrokersView()','p'),'<span class="num">'+skDateK(sub.until)+'</span>에 종료되어 전략의 신규 주문이 중단되었습니다.')
    :stRow('이용 중인 플랜이 없습니다','',stBtn('거래소 연결','tfBrokersView()','p'),'TETH 초대 계정은 무료, 구독은 월 '+acUsd(AC_CFG.price)+'입니다.');
  var showPay=!(acc==='partner'&&!a.cards.length&&!a.bill.length);
  var bt=a.billTo||{email:(S.user&&S.user.email)||''};
  var pay=showPay?stRow('결제 수단',def?'':'',stBtn(a.cards.length?'관리':'추가',a.cards.length?'skCardsDlg()':'stCardDlg()'),def?gEsc(def.brand)+' <span class="num">•••• '+gEsc(def.last4)+'</span>':'등록한 카드가 없습니다')
    +stRow('청구 정보','',stBtn('변경','skBillDlg()'),'<span class="num">'+gEsc(bt.email||'-')+'</span>'):'';
  var fail=a.pay&&a.pay.st==='fail'&&!on?'<p class="stg-warn" role="alert">마지막 결제가 승인되지 않았습니다. 결제 수단을 확인해 주십시오.</p>':'';
  var n=ST.allBill?a.bill.length:3;
  var hist=a.bill.length?'<div class="stg-card">'+a.bill.slice(0,n).map(function(b){ var bad=b.st==='failed';
      return '<button type="button" class="stg-r stg-hr" onclick="stReceipt(\''+b.id+'\')"><div class="k"><b class="num">'+skDate(b.at)+'</b><span'+(bad?' class="bad"':'')+'>'+({paid:'결제 완료',failed:'결제 실패',refunded:'환불 완료'}[b.st]||b.st)+'</span></div><div class="v num">'+acUsd(b.amt)+'</div><div class="a">'+SK_NEXT+'</div></button>'; }).join('')+'</div>'
    :'<div class="stg-card"><div class="stg-r"><div class="k"><span>'+(acc==='partner'?'TETH 초대 계정은 결제 내역이 없습니다.':'아직 결제 내역이 없습니다.')+'</span></div></div></div>';
  return '<h1>결제</h1>'+fail
    +'<section class="stg-sec"><header><h2>구독</h2></header><div class="stg-card">'+plan+pay+'</div></section>'
    +'<section class="stg-sec"><header><h2>결제 내역</h2>'+(a.bill.length>3&&!ST.allBill?'<button type="button" class="stg-lk" onclick="ST.allBill=1;stRe()">전체 보기</button>':'')+'</header>'+hist+'</section>';
}
function skSubDlg(){ var a=acS(), sub=a.sub||{}, def=a.cards.filter(function(c){ return c.def; })[0]||a.cards[0];
  stDlg('<button type="button" class="x" aria-label="닫기" onclick="stDlgClose()">✕</button><h3>TETH 구독</h3><div class="stg-card">'
    +stRow('요금','<span class="num">'+acUsd(sub.price||AC_CFG.price)+' / 월</span>')
    +stRow('다음 결제일','<span class="num">'+skDate(sub.next||Date.now()+30*864e5)+'</span>')
    +stRow('결제 수단',def?gEsc(def.brand)+' <span class="num">•••• '+gEsc(def.last4)+'</span>':'-')
    +'</div><div class="bts"><button type="button" class="dg" onclick="stDlgClose();stSubCancel()">구독 해지</button></div>','TETH 구독'); }
function skCardsDlg(){ var a=acS();
  stDlg('<button type="button" class="x" aria-label="닫기" onclick="stDlgClose()">✕</button><h3>결제 수단</h3><div class="stg-card">'
    +a.cards.map(function(c){ return stRow(gEsc(c.brand)+' <span class="num">•••• '+gEsc(c.last4)+'</span>','',(c.def?'':stBtn('기본으로 설정','skCardDef(\''+c.id+'\')'))+stBtn('삭제','stDlgClose();stCardDel(\''+c.id+'\')'),(c.def?'기본 결제 수단, ':'')+'<span class="num">'+skExp(c.exp)+'</span>'); }).join('')
    +'</div><div class="bts"><button type="button" class="ok" onclick="stDlgClose();stCardDlg()">결제 수단 추가</button></div>','결제 수단'); }
function skCardDef(id){ stCardDef(id); skCardsDlg(); }
function skBillDlg(){ var a=acS(), bt=a.billTo||{email:(S.user&&S.user.email)||'',name:(S.user&&S.user.name)||'',addr:''};
  stDlg('<h3>청구 정보</h3><label class="ty"><span>결제 이메일</span><input id="st-be" type="email" value="'+gEsc(bt.email||'')+'"></label><label class="ty"><span>이름</span><input id="st-bn" value="'+gEsc(bt.name||'')+'"></label><label class="ty"><span>청구지 주소</span><input id="st-ba" value="'+gEsc(bt.addr||'')+'" placeholder="도로명 주소, 도시, 우편번호, 국가"></label><small class="er" id="st-bi-e"></small><div class="bts"><button type="button" class="no" onclick="stDlgClose()">취소</button><button type="button" class="ok" onclick="skBillSave()">저장</button></div>','청구 정보'); }
function skBillSave(){ var e=(document.getElementById('st-be').value||'').trim(), n=(document.getElementById('st-bn').value||'').trim(), ad=(document.getElementById('st-ba').value||'').trim(), er=document.getElementById('st-bi-e');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)){ er.textContent='결제 이메일을 확인해 주십시오'; return; } if(!n){ er.textContent='이름을 입력해 주십시오'; return; }
  acS().billTo={email:e,name:n,addr:ad}; acSave(); stDlgClose(); stRe(); toast('청구 정보를 저장했습니다'); }
/* ── 보안 ── */
function skSecurity(){ var s=stS(), ua=navigator.userAgent, dev=/Windows/.test(ua)?'Windows':/Mac/.test(ua)?'Mac':/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':'이 기기', br=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':/Firefox\//.test(ua)?'Firefox':'브라우저';
  var a=acS(), L=acConnList();
  return '<h1>보안</h1>'
    +stSec('로그인',stRow('비밀번호','',stBtn('변경','stPwDlg()'),s.pwAt?'마지막 변경일 <span class="num">'+skDate(s.pwAt)+'</span>':'12자 이상, 숫자와 특수문자를 포함합니다.')
      +stRow('2단계 인증','','<button type="button" class="stg-sw" role="switch" aria-checked="'+!!s.twofa+'" aria-label="2단계 인증" onclick="stTwofa()"><i></i></button>','로그인할 때 이메일 인증번호를 확인합니다.'))
    +stSec('로그인한 기기',stRow(dev+', '+br,'','','현재 기기')
      +(s.devices||[]).map(function(d){ return stRow(gEsc(d.n),'',stBtn('로그아웃','stOutOne(\''+d.id+'\')'),gEsc(d.where)+', 마지막 활동 <span class="num">'+gEsc(d.at)+'</span>'); }).join('')
      +stRow('다른 모든 기기','',stBtn('모두 로그아웃','stOutAll()'),'이 기기의 로그인은 유지합니다.'))
    +stSec('거래소 연결',L.length?L.map(function(k){ return stRow(acLogo(k,20)+acName(k),'',stBtn('연결 끊기','acDisc(\''+k+'\')'),'잔고 조회와 주문'); }).join('')
      :stRow('연결된 거래소가 없습니다','',stBtn('거래소 연결','tfBrokersView()'),'연결하면 거래소마다 허용한 권한이 여기에 보입니다.'));
}
(function(){
  stBilling=skBilling; stSecurity=skSecurity;
  /* 프리셋이 만든 설정 상태에 알림 값이 없으면 알림 탭이 멈춘다 */
  /* 알림: 설명 문장을 합니다체로, 한 섹션뿐이라 섹션 제목은 두지 않는다 */
  var NF_D={fill:'전략의 주문이 체결되면 알립니다.',state:'전략이 중지되거나 오류가 발생하면 알립니다.',risk:'설정한 손실 한도에 도달하면 알립니다.',copy:'원본 전략의 설정이 변경되면 알립니다.',bill:'결제와 로그인 내역, 보안 설정 변경을 알립니다.',news:'새 기능과 전략을 안내합니다.'};
  ST_NF.forEach(function(x){ if(NF_D[x[0]]) x[2]=NF_D[x[0]]; });
  var nf0=stNotify; stNotify=function(){ return nf0.apply(this,arguments).replace('<header><h2>TETH</h2></header>',''); };
  var ss0=stS; stS=function(){ var s=ss0(); if(!s.notif) s.notif={}; return s; };
  /* 모바일 목록 → 상세 */
  var r0=stRoute; stRoute=function(h){ var m=h.match(/^#\/settings(?:\/([a-z]+))?$/); ST.mList=!!m&&!m[1]; return r0.apply(this,arguments); };
  var b0=stBody; stBody=function(){ return '<button type="button" class="stg-mback" onclick="stMList()">'+SK_CHEV+'설정</button>'+b0.apply(this,arguments); };
  var v0=stView; stView=function(){ var r=v0.apply(this,arguments); var el=document.getElementById('st-root'); if(el){ el.classList.toggle('m-list',!!ST.mList); el.classList.toggle('m-detail',!ST.mList); if(ST.mList){ var on=el.querySelector('.stg-ni.on'); if(on){ on.classList.remove('on'); on.removeAttribute('aria-current'); } } } return r; };
})();
