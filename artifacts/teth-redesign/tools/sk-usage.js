/* ═══ AI 사용량과 과금 상태 (sk-usage) ═══
   입력 3개(이용 방식, 이번 달 AI 사용량, 거래 크레딧) + 공식 1개 + 막는 곳 3곳(새 전략, 전략 수정, 분석시키기). 케이스 번호 분기 금지.
   화면: 입력창 위 한 줄 배너(80%는 끌 수 있음, 100%는 단추 하나), 설정 > 사용량(퍼센트와 초기화 날짜만), 결제의 이번 달 청구 한 줄.
   파운더 결정(2026-10-01): 구독 $280에 AI 사용량 $200 상당, 초대 연결 보너스 없음, 선불 충전은 GPT 방식, 거래를 늘리라는 말 금지. */
var AI_SUB_USD=200;   /* 구독에 든 AI 사용량(달러 상당, 화면에는 비노출) */
function aiTier(){ try{ return bcTier(); }catch(e){ return 'FREE'; } }
function aiMeter(){
  var tier=aiTier(), used=0, bal=0; try{ used=bcMonthSpend(); bal=bcBalance(); }catch(e){}
  var allow;
  if(tier==='FREE'||tier==='UID') allow=used+Math.max(0,bal);  /* 무료분과 거래 크레딧은 원장 잔액이 덮는 만큼 */
  else allow=AI_SUB_USD+(tier==='CARD_UID'?Math.max(0,bal):0); /* 구독 포함분, 둘 다면 거래 크레딧이 더해짐 */
  var pct=allow>0?Math.min(100,Math.round(used/allow*100)):(used>0?100:0);
  var b=null; try{ b=bcInit(); }catch(e){}
  var reset=(b&&b.cycleAt)?b.cycleAt+30*864e5:(function(){ var d=new Date(); return new Date(d.getFullYear(),d.getMonth()+1,1).getTime(); })();
  try{ var sub=acS().sub; if(acSubOn()&&sub&&sub.next) reset=sub.next; }catch(e){} /* 구독이면 결제일과 같은 날 초기화 */
  return {tier:tier,used:used,allow:allow,pct:pct,bal:bal,reset:reset};
}
function aiBill(){
  var m=aiMeter(), gross=0, credit=0, extra=0; try{ gross=acSubOn()?((acS().sub&&acS().sub.price)||AC_CFG.price):0; }catch(e){}
  try{ if(m.tier==='CARD_UID'||m.tier==='UID') credit=Math.min(gross,bcMonthInflow()); }catch(e){}
  if(m.tier==='CARD'||m.tier==='CARD_UID') extra=Math.max(0,m.used-AI_SUB_USD-(m.tier==='CARD_UID'?Math.max(0,m.bal):0));
  return {gross:gross,credit:credit,extra:extra,total:Math.max(0,gross-credit+extra)};
}
/* 상태별 다음 행동: UID만 → 카드 등록, 구독만 → 초대 계정 연결, 둘 다 → 크레딧 추가, 무료 → 이용 방식 고르기 */
function aiNext(){
  var t=aiTier();
  if(t==='UID') return {label:'카드 등록',go:"stGo('billing');setTimeout(function(){ if(typeof stCardDlg==='function') stCardDlg(); },300)"};
  if(t==='CARD') return {label:'초대 계정 연결',go:"tfBrokersView()"};
  if(t==='CARD_UID') return {label:'크레딧 추가',go:"aiTopup()"};
  return {label:'이용 방식 고르기',go:"tfBrokersView()"};
}
function aiGate(action){ if(window.TF_QA_NOGATE) return 'allow'; var m=aiMeter(); if(m.pct>=100&&/^(new|edit|analyze)$/.test(action)) return 'block'; if(m.pct>=80) return 'warn'; return 'allow'; }
function aiMonthKey(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1); }
function aiDismissed(){ try{ return localStorage.getItem('teth.use80')===aiMonthKey(); }catch(e){ return false; } }
function aiDismiss(){ try{ localStorage.setItem('teth.use80',aiMonthKey()); }catch(e){} aiBar(); }
/* 입력창 위 한 줄 배너 */
function aiBarHtml(){
  if(!S.user) return ''; var m=aiMeter(); if(m.pct<80) return ''; if(m.pct<100&&aiDismissed()) return '';
  var nx=aiNext(), full=m.pct>=100;
  var msg=full?'이번 달 AI 사용량을 모두 써서 새 요청은 잠시 멈춥니다. 실행 중인 전략과 결과 보기는 그대로입니다.':'이번 달 AI 사용량의 '+m.pct+'%를 썼습니다.';
  return '<div class="use-bar'+(full?' full':'')+'" role="status"><span>'+msg+'</span><button type="button" class="use-go" onclick="'+nx.go+'">'+nx.label+'</button>'+(full?'':'<button type="button" class="use-x" aria-label="닫기" onclick="aiDismiss()">✕</button>')+'</div>';
}
function aiBar(){
  var w=document.querySelector('.g-composer-wrap'); if(!w) return;
  var d=document.getElementById('g-usebar'); var h=aiBarHtml();
  if(!h){ if(d) d.remove(); return; }
  if(!d){ d=document.createElement('div'); d.id='g-usebar'; var dock=document.getElementById('g-askdock'); if(dock) w.insertBefore(d,dock.nextSibling); else w.insertBefore(d,w.firstChild); }
  if(d.innerHTML!==h) d.innerHTML=h;
}
function aiTopup(){ stGo('billing'); setTimeout(function(){ if(typeof stDlg!=='function') return;
  stDlg('<h3>크레딧 추가</h3><p class="stg-note">충전한 금액에서 쓴 만큼 차감됩니다. 남은 금액은 다음 달로 이어집니다.</p><div class="use-amts">'+[10,25,50,100].map(function(v){ return '<button type="button" class="use-amt" onclick="aiTopupDo('+v+')">$'+v+'</button>'; }).join('')+'</div><label class="use-auto"><input type="checkbox" id="use-auto" '+(aiAuto()?'checked':'')+' onchange="aiAutoSet(this.checked)"> 잔액이 $5 아래로 내려가면 $25를 자동으로 충전합니다</label>'); },300); }
function aiAuto(){ try{ return !!tfS().aiAutoTop; }catch(e){ return false; } }
function aiAutoSet(on){ tfS().aiAutoTop=!!on; tfSave(); }
function aiTopupDo(v){ try{ bcAppend('grant','topup',+v,null,'topup'+Date.now()); bcAfterChange('topup'); }catch(e){} tfSave(); if(typeof stDlgClose==='function') stDlgClose(); else { var d=document.querySelector('.stg-dlg'); if(d) d.remove(); } toast('$'+v+'를 충전했습니다'); aiBar(); if(typeof stRe==='function') stRe(); }
/* 설정 > 사용량: 퍼센트와 초기화 날짜만 */
function stUsage(){
  var m=aiMeter(), nx=aiNext(), tierL={FREE:'무료 둘러보기',UID:'TETH 초대 계정',CARD:'TETH 구독',CARD_UID:'TETH 구독과 초대 계정'}[m.tier]||'';
  var note=m.pct>=100?'새 요청은 잠시 멈춥니다. 실행 중인 전략과 결과 보기는 그대로입니다.':'';
  var rd=new Date(m.reset), rdT=rd.getFullYear()+'년 '+(rd.getMonth()+1)+'월 '+rd.getDate()+'일';
  var how={FREE:'둘러보기용 무료 사용량입니다.',UID:'모자라면 카드를 등록해 계속 쓸 수 있습니다.',CARD:'초대 계정을 연결하면 사용량이 매달 더 생깁니다.',CARD_UID:'모자라면 크레딧을 추가해 계속 쓸 수 있습니다.'}[m.tier]||'';
  return '<h1>사용량</h1>'
    +'<section class="stg-sec"><div class="stg-card use-card"><div class="use-h"><b>이번 달 AI 사용량</b><span class="num">'+m.pct+'%</span></div><div class="use-track"><i style="width:'+m.pct+'%"></i></div><p class="use-sub">'+rdT+'에 초기화됩니다.'+(note?' '+note:'')+'</p></div></section>'
    +stSec('',stRow('이용 방식',tierL,(m.pct>=80?stBtn(nx.label,nx.go,'p'):''),how))
    +(m.tier==='CARD_UID'||m.tier==='UID'?stSec('',stRow('거래 크레딧','<span class="num">'+acUsd(Math.max(0,m.bal))+'</span>')):'');
}
(function(){
  /* 설정 탭 추가 */
  if(typeof ST_TABS!=='undefined'&&!ST_TABS.some(function(x){ return x[0]==='usage'; })){ var i=ST_TABS.findIndex(function(x){ return x[0]==='billing'; }); ST_TABS.splice(i<0?ST_TABS.length:i+1,0,['usage','사용량','<path d="M4 19h16"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-4"/>']); }
  if(typeof stBody==='function'){ var sb0=stBody; stBody=function(){ return ST.tab==='usage'?stUsage():sb0.apply(this,arguments); }; }
  /* 결제: 다음 청구 금액은 구독 카드의 "다음 결제일" 줄에 이어 쓴다(ChatGPT처럼 카드 하나) */
  if(typeof stBilling==='function'){ var b0=stBilling; stBilling=function(){ var h=b0.apply(this,arguments); var q=aiBill(); if(!q.gross) return h;
    var line='구독 '+acUsd(q.gross)+(q.credit?' - 거래 크레딧 '+acUsd(q.credit):'')+(q.extra?' + 추가 사용 '+acUsd(q.extra):'')+' = '+acUsd(q.total);
    var rows=stRow('청구 예정 금액','<span class="num">'+acUsd(q.total)+'</span>','',(q.credit||q.extra)?'<span class="num">구독 '+acUsd(q.gross)+(q.credit?', 거래 크레딧 -'+acUsd(q.credit):'')+(q.extra?', 추가 사용 +'+acUsd(q.extra):'')+'</span>':'');
    /* 구독 카드 안, 결제 수단 행 바로 앞에 넣는다 */
    var i=h.indexOf('<div class="stg-r"><div class="k"><b>결제 수단</b>'); if(i<0) return h;
    return h.slice(0,i)+rows+h.slice(i); }; }
  /* 막는 곳: 새 전략과 수정(채팅), 분석시키기 */
  /* 막힐 때는 배너 하나로 알린다. 배너를 그릴 수 없는 홈에서만 짧은 안내 */
  function aiBlocked(){ aiBar(); var b=document.getElementById('g-usebar'); if(b&&b.offsetParent){ b.scrollIntoView({block:'nearest'}); return; } toast('이번 달 AI 사용량을 모두 썼습니다. 설정의 사용량에서 확인할 수 있습니다'); }
  if(typeof gSend==='function'){ var gs0=gSend; gSend=function(){ if(aiGate('new')==='block'){ aiBlocked(); return; } return gs0.apply(this,arguments); }; }
  if(typeof gNew==='function'){ var gn0=gNew; gNew=function(){ if(S.user&&aiGate('new')==='block'){ aiBlocked(); return; } return gn0.apply(this,arguments); }; }
  if(typeof tfVerifyGo==='function'){ var vg0=tfVerifyGo; tfVerifyGo=function(){ if(aiGate('analyze')==='block'){ aiBlocked(); return; } return vg0.apply(this,arguments); }; }
  /* 배너 갱신: 입력창이 보일 때마다, 과금 변화마다 */
  if(typeof gComposer==='function'){ var gc0=gComposer; gComposer=function(){ var r=gc0.apply(this,arguments); try{ aiBar(); }catch(e){} return r; }; }
  if(typeof bcAfterChange==='function'){ var ac0=bcAfterChange; bcAfterChange=function(){ var r=ac0.apply(this,arguments); try{ aiBar(); }catch(e){} return r; }; }
  if(typeof tfQaPreset==='function'){ var qp0=tfQaPreset; tfQaPreset=function(){ var r=qp0.apply(this,arguments); try{ aiBar(); }catch(e){} return r; }; }
  setTimeout(function(){ try{ aiBar(); }catch(e){} },1500);
})();
