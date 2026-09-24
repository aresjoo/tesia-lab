/* ═══════════════════════════════════════════════════════════════
   W1 토대 — 파생 상태 엔진(tfDerive), 전략 이름(tfStratTitle), QA 실험실(tfQa*)
   정본: ux/spec/UX_STATE_MATRIX.md, ux/spec/QA_SCENARIOS.md
   ═══════════════════════════════════════════════════════════════ */
function tfDeriveCfg(){
  var d=TFC.derive;
  if(!d) d=TFC.derive={USAGE_HIGH:1500,TRADE_HIGH:1500,PLAN_KRW:49000,INCLUDED:1000,UNIT_KRW:10,KRW_PER_CREDIT:25,WELCOME_KRW:1000};
  var r=TFC.billing&&TFC.billing.VOLUME_TO_CREDIT_RATE; if(r&&!r.bitget) r.bitget={spot:0.00040,futures:0.00060}; /* D29 */
  return d;
}
var TF_EX_NAME={bitget:'Bitget',binance:'Binance',okx:'OKX',bybit:'Bybit',woox:'WOO X',mexc:'MEXC'};
function tfExName(id){ return TF_EX_NAME[id]||id||''; }
/* 순수 파생: 저장·알림·초기화 없음. 모든 화면은 이 결과만 읽는다 */
function tfDerive(){
  var D=tfDeriveCfg();
  var ready=!!(window.TF_STATE_READY&&window.TF_BOOTED);
  var user=!!S.user, t=tfNFInit(), b=(typeof bcInit==='function')?bcInit():{mode:'active',cardOn:false};
  var uid=user&&!!t.uidLinked, api=user&&!!(t.api&&t.api.ex), ex=t.api?t.api.ex:((t.ob&&t.ob.ex)||null);
  var plan=user&&!!(b.cardOn||t.payDone);
  var fq=(TFC.credit&&TFC.credit.freeQuota!=null)?TFC.credit.freeQuota:10, freeUsed=user?(t.freeUsed||0):0, freeLeft=Math.max(0,fq-freeUsed);
  var unit=(TFC.billing&&TFC.billing.AI_CALL_COST)||10;
  var usage=user?((typeof bcMonthSpend==='function'?bcMonthSpend():0)+freeUsed*unit):0;
  var trade=user&&uid?(typeof bcMonthVol==='function'?bcMonthVol():0):0;
  var usageBand=usage>=D.USAGE_HIGH?'high':'low';
  var tradeBand=trade<=0?'zero':(trade<D.TRADE_HIGH?'low':'high');
  var bal=user&&typeof bcBalance==='function'?bcBalance():0, watch=user&&b.mode==='watch';
  var cps=(t.cp&&t.cp.copies)||[];
  var owned=user?((t.strat||[]).length+(t.termClones||[]).length+cps.filter(function(c){ return c.status==='active'; }).length):0;
  var draft=user&&!!(t.cur&&t.score>=TFC.score.pass);
  /* 분류 */
  var id=null,key='guest';
  if(!user){ id=1; key='guest'; }
  else if(!plan){ if(!uid){ id=2; key='signed'; } else { id={zero:3,low:4,high:5}[tradeBand]; key={zero:'linked-zero',low:'linked-low',high:'linked-high'}[tradeBand]; } }
  else if(!uid){ id=usageBand==='high'?6:7; key=usageBand==='high'?'plan-high-unlinked':'plan-low-unlinked'; }
  else if(tradeBand==='zero'){ id=null; key='plan-linked-zero'; }
  else { var mm={'high/high':[8,'plan-high-high'],'high/low':[9,'plan-high-low'],'low/high':[10,'plan-low-high'],'low/low':[11,'plan-low-low']}[usageBand+'/'+tradeBand]; id=mm[0]; key=mm[1]; }
  /* 청구: 월 청구 = max(0, 플랜료 + 초과 종량 - 커미션 크레딧 - 무료 크레딧) */
  var planFee=plan?D.PLAN_KRW:0;
  var overage=Math.max(0,usage-(plan?D.INCLUDED:0))*D.UNIT_KRW;
  var commission=trade*D.KRW_PER_CREDIT;
  var freeKrw=(user&&!plan)?D.WELCOME_KRW:0;
  var due=Math.max(0,planFee+overage-commission-freeKrw);
  var gross=planFee+overage;
  var offsetPct=gross>0?Math.min(100,Math.round(Math.min(commission,gross)/gross*100)):0;
  var W=function(n){ return '₩'+Math.round(n).toLocaleString(); };
  var line;
  if(!user) line='';
  else if(plan) line='플랜 '+W(planFee)+(overage>0?' + 추가 사용 '+W(overage):'')+(commission>0?' - 상쇄 '+W(Math.min(commission,gross)):'')+' = 청구 '+W(due);
  else if(due>0) line='추가 사용 '+W(overage)+(commission>0?' - 상쇄 '+W(Math.min(commission,gross)):'')+' = 청구 '+W(due);
  else line='이번 달 청구 ₩0'+(freeLeft>0&&key==='signed'?', 무료 체험 '+freeLeft+'회 남음':(commission>0?', 거래 혜택으로 상쇄':''));
  var coverage;
  if(!user) coverage='none';
  else if(watch) coverage='blocked';
  else if(due===0&&commission>0) coverage='covered';
  else if(due===0) coverage='free';
  else if(commission>0) coverage='partial';
  else if(plan) coverage='postpaid';
  else coverage=(freeLeft>0||bal>0)?'partial':'blocked';
  /* 상태 문장·줄이는 방법 */
  var exName=tfExName(ex)||'거래소';
  var ST={
    guest:'',
    signed:'무료 체험 '+freeLeft+'회 남았어요. 연결이나 결제 없이 만들고 검증할 수 있어요',
    'linked-zero':exName+' 연결이 끝났어요. 첫 거래부터 이용료 상쇄가 시작돼요',
    'linked-low':'이용료 '+W(gross)+' 중 '+W(Math.min(commission,gross))+'가 거래 혜택으로 상쇄됐어요. 부족분은 카드로 청구돼요',
    'linked-high':'이번 달 이용료가 거래 혜택으로 충당됐어요',
    'plan-high-unlinked':'AI를 많이 쓰고 있어요. 거래소를 연결하면 거래 혜택만큼 줄어요',
    'plan-low-unlinked':'플랜을 정상 이용 중이에요',
    'plan-high-high':'거래 혜택이 플랜과 추가 사용료를 상쇄하고 있어요',
    'plan-high-low':'AI 사용이 많아 추가 사용료가 있어요. 거래 혜택으로 일부 상쇄됐어요',
    'plan-low-high':'TETH가 이번 달 플랜 비용을 대신 냈어요',
    'plan-low-low':'플랜에서 거래 혜택을 뺀 금액만 청구돼요',
    'plan-linked-zero':'준비 완료예요. 첫 거래부터 이용료 상쇄가 시작돼요'
  };
  var statusLine=ST[key]||'';
  if(user&&freeLeft===0&&key==='signed') statusLine='무료 체험을 다 썼어요. 거래소를 연결하거나 카드를 등록하면 계속 쓸 수 있어요';
  if(watch) statusLine='AI 기능이 잠시 멈춰 있어요. 카드 등록이나 거래소 연결 즉시 다시 켜져요';
  var reduceHint=null;
  if(user&&!uid) reduceHint='거래소를 연결하면 거래 혜택으로 이용료가 상쇄돼요';
  else if(user&&!plan&&due>0) reduceHint='카드를 등록하면 부족분이 자동으로 청구돼요';
  /* CTA */
  var exec=owned>0?{label:'터미널 열기',action:"tfNav('#/trade')"}:(draft?{label:'이 전략 실행하기',action:"tfNav('#/strategy/connect')"}:{label:'대표 전략 모의로 켜보기',action:'tfXLaunchDemo()'});
  var pri=null,sec=null;
  if(!user){ pri={label:'무료로 시작',action:"authOpen('signup')"}; sec={label:'터미널 미리 보기',action:'tfPreviewOpen()'}; }
  else if(key==='signed'){ pri=exec; sec=draft?{label:'직접 만들기',action:'gHome()'}:{label:'직접 만들기',action:'gHome()'}; }
  else if(key==='linked-zero'||key==='plan-linked-zero'){ pri=exec; sec={label:'공개 전략 골라보기',action:"tfShareHub('find')"}; }
  else if(key==='plan-high-unlinked'){ pri={label:'거래소 연결',action:"tfAcSheet('bitget')"}; sec={label:'이용 현황 보기',action:"tfNav('#/plan')"}; }
  else if(key==='plan-low-unlinked'){ pri=exec; sec={label:'거래소 연결',action:"tfAcSheet('bitget')"}; }
  else if(key==='linked-low'){ pri=exec; sec={label:'카드 등록',action:"tfAcSheet('card')"}; }
  else if(key==='plan-high-low'){ pri=exec; sec={label:'이용 현황 보기',action:"tfNav('#/plan')"}; }
  else { pri=exec; sec=null; }
  var interrupt='none';
  if(watch) interrupt='block';
  else if((key==='signed'&&freeLeft===0)||key==='linked-low'||key==='plan-high-unlinked'||key==='plan-high-low') interrupt='inline';
  else if(key==='plan-low-high') interrupt='toast';
  var actMsg=!user?'로그인이 필요해요':(uid&&api?exName+' 연결됨':(uid?'요금 연동 완료, 실행 연결 필요':(api?'실행 연결 완료, 요금 연동은 선택':'거래소 미연결')));
  return {
    ready:ready, stateId:id, stateKey:key,
    facts:{loggedIn:user,uid:uid,api:api,ex:ex,plan:plan,usage:usage,usageBand:usageBand,trade:trade,tradeBand:tradeBand,freeLeft:freeLeft,freeQuota:fq,balance:bal,watch:watch,owned:owned,draft:draft},
    entitlement:{browse:true,chat:user&&!watch&&(freeLeft>0||plan||bal>0),backtest:user&&!watch&&(freeLeft>0||plan||bal>0),paper:user,live:user&&api&&(draft||owned>0),follow:user&&api},
    coverage:coverage,
    bill:{plan:planFee,overage:overage,commission:commission,free:freeKrw,due:due,offsetPct:offsetPct,line:line},
    primaryCTA:pri, secondaryCTA:sec,
    activation:{uid:uid?'done':'none',api:api?'done':'none',card:plan?'done':'none',message:actMsg,ex:ex},
    statusLine:statusLine, reduceHint:reduceHint, interrupt:interrupt,
    terminalMode:!user?'guest':(owned>0?'active':'inactive')
  };
}
/* 안전 호출 — 다른 표면이 아직 없을 때 */
function tfXLaunchDemo(){ if(typeof tfTradeInactiveLaunch==='function') return tfTradeInactiveLaunch(); toast('대표 전략 모의 실행은 준비 중이에요'); }
function tfPreviewOpen(){ window.TF_PREVIEW=true; if(typeof tfDashView==='function'){ tfDashView(); } }
function tfPreviewClose(){ window.TF_PREVIEW=false; tfNav('#/trade'); }
function tfAcSheet(kind){ if(typeof tfAcSheetView==='function') return tfAcSheetView(kind); if(kind==='card'&&typeof tfUpSheet==='function') return tfUpSheet('plan'); if(typeof tfNFLinkUid==='function') return tfNFLinkUid(); }

/* ═══ 전략 이름 체계 (UX_DECISION_LOG D11) — 자산 + 행동 (+ 통제 어휘), 가운뎃점 대신 쉼표 ═══ */
var TF_ASSET_TICKER={'비트코인':'BTC','이더리움':'ETH','솔라나':'SOL','나스닥':'NASDAQ','리플':'XRP','도지코인':'DOGE','아발란체':'AVAX','에이다':'ADA','BTC':'BTC','ETH':'ETH','SOL':'SOL'};
function tfAssetTicker(a){ if(!a) return ''; if(typeof a==='object') a=a.label||a.name||''; return TF_ASSET_TICKER[a]||String(a).replace(/\/.*$/,''); }
function tfStratTitle(p,asset,opt){
  p=p||{}; opt=opt||{};
  var tk=tfAssetTicker(asset);
  var beh=(p.rsiTh!=null&&p.rsiTh<=40&&!p.trendFilter)?'급락 후 반등 매수':'눌림목 반등 매수';
  var suf=[];
  if(p.trendFilter) suf.push('추세 구간');
  if(p.sl!=null&&p.sl>=-3) suf.push('보수형'); else if(p.tp!=null&&p.tp>=15) suf.push('공격형');
  if(opt.long) suf.push('장기');
  return (tk?tk+' ':'')+beh+(suf.length?', '+suf.join(', '):'');
}
function tfStratSub(p){
  p=p||{};
  var s='RSI '+(p.rsiTh!=null?p.rsiTh:44)+' 아래로 눌렸다가 반등하면 사고, +'+(p.tp!=null?p.tp:10)+'%에 팔고 '+(p.sl!=null?p.sl:-5)+'%면 멈춰요.';
  if(p.trendFilter) s+=' 추세 구간에서만 사요.';
  return s;
}
var TF_KIND_LABEL={agent:'AI 판단',rule:'규칙',hybrid:'규칙',follow:'따라가기'};
function tfKindBadge(kind,extra){ var k=TF_KIND_LABEL[kind]||'규칙'; return '<span class="tf-kind tf-kind-'+(kind||'rule')+'">'+k+'</span>'+(kind==='hybrid'||extra?'<span class="tf-kind tf-kind-sub">AI 검토 켜짐</span>':''); }
function tfSeedTitle(r){ return tfStratTitle(r.p,r.asset,{long:r.p&&r.p.startI!=null&&r.p.startI<=61}); }

/* ═══ QA 실험실 — 11 시나리오 프리셋(스냅샷 통째 교체) + 오버레이 + 기대값 + 진척판 ═══ */
var TF_DEV_ROWS=[
  ['login','로그인'],['uid','요금 연동 (UID)'],['pay','카드 결제'],['api','거래소 연결 (Bitget)'],['free','무료 체험 다 씀'],['strat','검증 통과 전략'],
  ['card','카드 등록 (월 충전)'],['bwarn','크레딧 임계 경고'],['bwatch','크레딧 관망 모드']
];
var TF_QA_PRESETS=[
  {id:'01',key:'guest',label:'① 게스트',login:false},
  {id:'02',key:'signed',label:'② 로그인만',login:true,free:3},
  {id:'03',key:'linked-zero',label:'③ 연결, 거래 0',login:true,uid:1,api:1},
  {id:'04',key:'linked-low',label:'④ 연결, 저거래',login:true,uid:1,api:1,ai:2500,vol:600},
  {id:'05',key:'linked-high',label:'⑤ 연결, 고거래',login:true,uid:1,api:1,ai:2500,vol:2000},
  {id:'06',key:'plan-high-unlinked',label:'⑥ 카드, AI 많이, 미연결',login:true,card:1,ai:2500},
  {id:'07',key:'plan-low-unlinked',label:'⑦ 카드, AI 적게, 미연결',login:true,card:1,ai:200},
  {id:'08',key:'plan-high-high',label:'⑧ 카드, 연결, AI 많이, 고거래',login:true,card:1,uid:1,api:1,ai:2500,vol:2000},
  {id:'09',key:'plan-high-low',label:'⑨ 카드, 연결, AI 많이, 저거래',login:true,card:1,uid:1,api:1,ai:2500,vol:600},
  {id:'10',key:'plan-low-high',label:'⑩ 카드, 연결, AI 적게, 고거래',login:true,card:1,uid:1,api:1,ai:200,vol:2000},
  {id:'11',key:'plan-low-low',label:'⑪ 카드, 연결, AI 적게, 저거래',login:true,card:1,uid:1,api:1,ai:200,vol:600}
];
var TF_QA_OVERLAYS=[
  ['strat','활성 전략 1개'],['preview','데모 미리 보기'],['logs','판단 로그 채움'],['payfail','결제 실패'],['creditout','크레딧 다 씀'],['bwatch','관망 모드']
];
var TF_QA_EXPECT={
  guest:['무료로 시작','없음','없음','미연결','guest','#/trade, 따라하기, 거래소 연결'],
  signed:['대표 전략 모의로 켜보기','₩0, 무료 체험','무료 N회','미연결','inactive','#/trade, 이용 현황'],
  'linked-zero':['이 전략 실행하기 / 모의로 켜보기','₩0','가능','연결됨','inactive','#/trade, 이용 현황, 거래소 연결'],
  'linked-low':['터미널/실행','공식(부족분)','가능','연결됨','inactive','이용 현황(상쇄 바 부분)'],
  'linked-high':['터미널/실행','₩0 상쇄','가능','연결됨','inactive','이용 현황(충당 문구)'],
  'plan-high-unlinked':['거래소 연결','플랜 + 추가','가능','미연결','inactive','이용 현황, 거래소 연결'],
  'plan-low-unlinked':['실행','플랜','가능','미연결','inactive','이용 현황(배너 없음)'],
  'plan-high-high':['실행','공식','가능','연결됨','inactive','이용 현황'],
  'plan-high-low':['실행','공식(차액 큼)','가능','연결됨','inactive','이용 현황(인라인)'],
  'plan-low-high':['실행','₩0 대신 냄','가능','연결됨','inactive','이용 현황(축하 1회)'],
  'plan-low-low':['실행','공식','가능','연결됨','inactive','이용 현황'],
  'plan-linked-zero':['이 전략 실행하기','플랜','가능','연결됨','inactive','이용 현황(첫 거래 대기)']
};
var TF_QA_PROGRESS=['AI 트레이딩 게스트','AI 트레이딩 로그인','활성화(연결·결제)','터미널','전략 따라하기','전략 상세','거래소 연결','11 상태','데스크톱 QA','모바일 QA'];
var TF_QA_PSTATES=['NOT_STARTED','IN_REVIEW','PASS','FAIL'];
function tfQaStore(k,v){ try{ if(v===undefined) return JSON.parse(localStorage.getItem(k)||'{}'); localStorage.setItem(k,JSON.stringify(v)); }catch(e){ return {}; } }
var TF_QA_USER={name:'김도현',email:'demo@teth.ai'};
function tfQaWipe(){
  if(typeof TF_SS_TOKEN!=='undefined') TF_SS_TOKEN++;
  try{ localStorage.removeItem('teth.state'); }catch(e){}
  S.user=null; S.tf=null; tfS(); tfNFInit();
  var t=S.tf; t.cp=null; t.termClones=[]; t.termDemo={}; t.termDel=[]; t.follows=[]; t.shared=false; t.sharedSnap=null; t.watch=[]; t.bill=null;
  window.TF_NF_RESUME=null; window.TF_UP_CTX=null; window.TF_PREVIEW=false; window.TF_QA_LOGFILL=false;
  if(typeof TF_TM!=='undefined'&&TF_TM){ TF_TM.sel=null; }
  try{ authSyncUI(); }catch(e){}
}
function tfQaPreset(id){
  var P=null; TF_QA_PRESETS.forEach(function(x){ if(x.id===id) P=x; }); if(!P) return;
  tfQaWipe();
  var t=tfS();
  if(P.login){
    S.user={name:TF_QA_USER.name,email:TF_QA_USER.email}; try{ authSyncUI(); }catch(e){}
    tfNFInit(); if(typeof bcEnsureWelcome==='function') bcEnsureWelcome();
    if(P.free) t.freeUsed=P.free;
    if(P.uid){ t.uidLinked=true; t.uid='38291042'; t.creditGrants.uid=Date.now(); t.creditBal=1000; }
    if(P.api){ t.api={ex:'bitget',last4:'QA01'}; t.conn=true; t.ob={st:'completed',ex:'bitget',uid:P.uid?'38291042':'',err:null}; }
    if(P.card){ t.payDone=true; t.plan='paid'; if(typeof bcCardOn==='function'){ bcCardOn(true); } if(typeof bcCardCharged==='function') bcCardCharged('cyqa-'+id); }
    if(P.ai){ bcAppend('debit','ai',-P.ai,'qa','qa-ai-'+id+'-'+Date.now()); }
    if(P.vol){ bcAppend('charge','volume',P.vol,'qa','qa-vol-'+id+'-'+Date.now()); t.tradeActiveUntil=Date.now()+30*864e5; }
  }
  window.TF_QA_PRESET=P.key;
  tfSave(); tfDevRefresh();
}
function tfQaOverlay(k){
  var t=tfS();
  if(k==='strat'){ if(!S.user){ S.user={name:TF_QA_USER.name,email:TF_QA_USER.email}; try{ authSyncUI(); }catch(e){} }
    if(!tfDevSt('strat')) tfDevTgl('strat'); if(!(t.strat||[]).length){ try{ tfStartStrategy(); }catch(e){} } }
  else if(k==='preview'){ window.TF_PREVIEW=!window.TF_PREVIEW; }
  else if(k==='logs'){ window.TF_QA_LOGFILL=!window.TF_QA_LOGFILL; }
  else if(k==='payfail'){ var b=bcInit(); b.simPayFail=!b.simPayFail; }
  else if(k==='creditout'){ tfDevBillUser(); var fq=(TFC.credit&&TFC.credit.freeQuota)||10; t.freeUsed=fq; tfDevBillDrain(0); }
  else if(k==='bwatch'){ tfDevTgl('bwatch'); return; }
  tfSave(); tfDevRefresh();
}
function tfQaOvSt(k){
  var t=tfS();
  if(k==='strat') return !!((t.strat||[]).length);
  if(k==='preview') return !!window.TF_PREVIEW;
  if(k==='logs') return !!window.TF_QA_LOGFILL;
  if(k==='payfail') return !!(bcInit().simPayFail);
  if(k==='creditout') return tfDevSt('free');
  if(k==='bwatch') return tfDevSt('bwatch');
  return false;
}
function tfQaMark(res){ var d=tfDerive(); var r=tfQaStore('teth.qa.results'); r[d.stateKey]={res:res,at:Date.now()}; tfQaStore('teth.qa.results',r); tfDevSync(); }
function tfQaProg(i){ var p=tfQaStore('teth.qa.progress'); var cur=TF_QA_PSTATES.indexOf(p[i]||'NOT_STARTED'); p[i]=TF_QA_PSTATES[(cur+1)%TF_QA_PSTATES.length]; tfQaStore('teth.qa.progress',p); tfDevSync(); }
/* 기존 원시 토글 (고급) */
function tfDevSt(k){
  var t=tfS();
  if(k==='login') return !!S.user;
  if(k==='uid') return !!t.uidLinked;
  if(k==='pay') return !!t.payDone;
  if(k==='api') return !!t.api;
  if(k==='free') return (t.freeUsed||0)>=((TFC.credit&&TFC.credit.freeQuota)||10);
  if(k==='strat') return !!(t.cur&&t.score>=TFC.score.pass);
  if(k==='card') return !!(typeof bcInit==='function'&&bcInit().cardOn);
  if(k==='bwarn') return !!(typeof bcInit==='function'&&bcInit().mode==='grace');
  if(k==='bwatch') return !!(typeof bcInit==='function'&&bcInit().mode==='watch');
  return false;
}
function tfDevBillUser(){ if(!S.user){ S.user={name:TF_QA_USER.name,email:TF_QA_USER.email}; try{ authSyncUI(); }catch(e){} } }
function tfDevBillGrant(){ bcAppend('charge','qa',Math.ceil(bcWarnBase()*0.5)+50,null,'qa'+Date.now()+Math.random()); bcAfterChange('qa'); }
function tfDevBillDrain(target){ var d=bcBalance()-target; if(d>0){ bcAppend('debit','qa',-d,null,'qa'+Date.now()+Math.random()); bcAfterChange('ai'); } }
function tfDevTgl(k){
  var t=tfS(), on=tfDevSt(k);
  if(k==='login'){
    if(on){ try{ gLogout(); }catch(e){ S.user=null; } tfDevSync(); return; }
    S.user={name:TF_QA_USER.name,email:TF_QA_USER.email}; try{ authSyncUI(); }catch(e){}
  }
  if(k==='uid'){ t.uidLinked=!on; t.uid=!on?'38291042':null; }
  if(k==='pay'){ t.payDone=!on; if(!on){ t.plan='paid'; } else if(t.plan==='paid'&&!t.payDone){ t.plan=null; } }
  if(k==='api'){ t.api=on?null:{ex:'bitget',last4:'QA01'};
    if(on){ t.conn=false; t.ob=t.ob||{}; if(t.ob.st) t.ob.st=null; t.ob.ex=null; } else { t.conn=true; t.ob={st:'completed',ex:'bitget',uid:t.uid||'',err:null}; }
    if(!on&&!S.user){ S.user={name:TF_QA_USER.name,email:TF_QA_USER.email}; try{ authSyncUI(); }catch(e){} } }
  if(k==='free'){ var fq=(TFC.credit&&TFC.credit.freeQuota)||10; t.freeUsed=on?0:fq; }
  if(k==='strat'){
    if(on){ t.score=0; t.stage='intake'; t.cur=null; if(typeof TF_SS_TOKEN!=='undefined') TF_SS_TOKEN++; }
    else {
      var p0={sl:-5,tp:12,rsiTh:44,trendFilter:true,startI:61,endI:PRICE.length-1};
      var r0=runBacktest(p0);
      t.intake={asset:{i:0,label:'비트코인'},assetInfo:tfAssetLookup('비트코인'),style:{i:1,label:'중립적으로'},budget:{i:1,label:'500만원'},period:{i:2,label:'전체 기간'},stop:{i:1,label:'-5%까지'}};
      t.cur={p:p0,ret:r0.ret,mdd:r0.mdd,winRate:r0.winRate,n:r0.n,sharpe:r0.sharpe,pf:r0.pf,cagr:r0.cagr,tradeVol:r0.tradeVol,trades:r0.trades.slice(-40).map(function(x){return {e:x.entry,x:x.exit,pnl:x.pnl,kind:x.kind};}),startI:p0.startI,endI:p0.endI};
      t.score=tfScore(r0); t.stage='verified'; t.upFor=String(t.cur.ret)+'|'+t.cur.n+'|'+t.score;
    }
  }
  if(k==='card'){ tfDevBillUser(); if(on){ bcCardOn(false); } else { bcCardOn(true); bcCardCharged('cyqa'+Date.now()); } }
  if(k==='bwarn'){ tfDevBillUser();
    if(on){ tfDevBillGrant(); }
    else { if(bcInit().mode==='watch') tfDevBillGrant(); var wAt=Math.floor(bcWarnBase()*((TFC.billing&&TFC.billing.THRESHOLD_WARN)||0.2)); if(bcBalance()<=wAt) tfDevBillGrant(); tfDevBillDrain(Math.max(0,wAt)); } }
  if(k==='bwatch'){ tfDevBillUser();
    if(on){ tfDevBillGrant(); }
    else { var b9=bcInit(); if(b9.mode==='active') tfDevBillDrain(0); else { bcAppend('debit','qa',-bcBalance(),null,'qa'+Date.now()+Math.random()); bcAfterChange('ai'); }
      b9.graceAt=Date.now()-(((TFC.billing&&TFC.billing.GRACE_HOURS)||24)+1)*36e5; bcTick(); } }
  tfSave(); tfDevRefresh();
}
function tfDevRefresh(){
  try{
    var m=G.mode;
    if(m==='home') gHome();
    else if(m==='tfbrokers') tfBrokersView();
    else if(m==='tfbroker'&&typeof TFBK_CUR!=='undefined'&&TFBK_CUR) tfBrokerView(TFBK_CUR,tfS().bkTab);
    else if(m==='tfdash'||m==='tfintro'||m==='tfinactive'){ if(location.hash==='#/trade'){ if(typeof tfNFRoute==='function') tfNFRoute('#/trade'); } else tfNav('#/trade'); }
    else if(m==='nfplan'&&typeof tfPlanView==='function') tfPlanView('plan');
    else if(m==='tfss3'&&typeof tfShareHub==='function') tfShareHub((tfSSState().ss||{}).tab||'find');
  }catch(e){}
  tfDevSync();
}
function tfDevSync(){
  var p=$('tf-devpanel'); if(!p) return;
  var d=tfDerive();
  TF_DEV_ROWS.forEach(function(r){ var el=p.querySelector('[data-k="'+r[0]+'"] .st'); if(!el) return; var on=tfDevSt(r[0]); el.textContent=on?'ON':'OFF'; el.classList.toggle('on',on); });
  TF_QA_OVERLAYS.forEach(function(r){ var el=p.querySelector('[data-ov="'+r[0]+'"] .st'); if(!el) return; var on=tfQaOvSt(r[0]); el.textContent=on?'ON':'OFF'; el.classList.toggle('on',on); });
  TF_QA_PRESETS.forEach(function(x){ var el=p.querySelector('[data-preset="'+x.id+'"]'); if(el) el.classList.toggle('on',d.stateKey===x.key); });
  var ex=TF_QA_EXPECT[d.stateKey]||['','','','','',''];
  var res=tfQaStore('teth.qa.results')[d.stateKey];
  var box=p.querySelector('.qa-expect'); if(box){
    box.innerHTML='<div class="qa-row"><span>현재</span><b>'+(d.stateId!=null?d.stateId+' ':'')+d.stateKey+'</b></div>'
      +'<div class="qa-row"><span>1차 CTA</span><b>'+gEsc(d.primaryCTA?d.primaryCTA.label:'없음')+'</b><i>'+gEsc(ex[0])+'</i></div>'
      +'<div class="qa-row"><span>청구</span><b>'+gEsc(d.bill.line||'없음')+'</b><i>'+gEsc(ex[1])+'</i></div>'
      +'<div class="qa-row"><span>AI 자격</span><b>'+(d.entitlement.chat?'가능':'없음')+(d.facts.loggedIn&&d.stateKey==='signed'?' ('+d.facts.freeLeft+'회)':'')+'</b><i>'+gEsc(ex[2])+'</i></div>'
      +'<div class="qa-row"><span>거래소</span><b>'+gEsc(d.activation.message)+'</b><i>'+gEsc(ex[3])+'</i></div>'
      +'<div class="qa-row"><span>터미널</span><b>'+d.terminalMode+'</b><i>'+gEsc(ex[4])+'</i></div>'
      +'<div class="qa-row"><span>확인 화면</span><i>'+gEsc(ex[5])+'</i></div>'
      +'<div class="qa-pf"><button type="button" class="'+(res&&res.res==='PASS'?'on':'')+'" onclick="tfQaMark(\'PASS\')">PASS</button><button type="button" class="'+(res&&res.res==='FAIL'?'on fail':'')+'" onclick="tfQaMark(\'FAIL\')">FAIL</button></div>';
  }
  var pg=tfQaStore('teth.qa.progress'), pb=p.querySelector('.qa-progress'); if(pb){
    pb.innerHTML=TF_QA_PROGRESS.map(function(n,i){ var s=pg[i]||'NOT_STARTED'; return '<button type="button" class="qa-prow s-'+s+'" onclick="tfQaProg('+i+')"><span>'+n+'</span><em>'+s.replace('_',' ')+'</em></button>'; }).join('');
  }
}
function tfDevPanelTgl(){
  var p=$('tf-devpanel'), b=$('tf-devbtn');
  if(p){ p.remove(); if(b) b.classList.remove('on'); return; }
  if(b) b.classList.add('on');
  p=document.createElement('div'); p.id='tf-devpanel';
  p.innerHTML='<h4>제품 실험실</h4><div class="hint">시나리오를 누르면 상태를 통째로 바꾸고 현재 화면을 다시 그려요</div>'
    +'<div class="qa-sec"><div class="qa-st">시나리오</div><div class="qa-grid">'+TF_QA_PRESETS.map(function(x){ return '<button type="button" class="qa-pre" data-preset="'+x.id+'" onclick="tfQaPreset(\''+x.id+'\')">'+x.label+'</button>'; }).join('')+'</div></div>'
    +'<div class="qa-sec"><div class="qa-st">오버레이</div>'+TF_QA_OVERLAYS.map(function(r){ return '<button type="button" class="row" data-ov="'+r[0]+'" onclick="tfQaOverlay(\''+r[0]+'\')"><span>'+r[1]+'</span><span class="st">OFF</span></button>'; }).join('')+'</div>'
    +'<div class="qa-sec"><div class="qa-st">기대값</div><div class="qa-expect"></div></div>'
    +'<div class="qa-sec"><div class="qa-st">진척</div><div class="qa-progress"></div></div>'
    +'<details class="qa-adv"><summary>고급 (원시 토글)</summary>'+TF_DEV_ROWS.map(function(r){ return '<button type="button" class="row" data-k="'+r[0]+'" onclick="tfDevTgl(\''+r[0]+'\')"><span>'+r[1]+'</span><span class="st">OFF</span></button>'; }).join('')
    +'<button type="button" class="reset" onclick="tfDevReset()">전부 초기화 (게스트)</button></details>';
  document.body.appendChild(p);
  tfDevSync();
}
function tfDevReset(){ tfQaPreset('01'); var m=G.mode; if(m==='tfconnect'||m==='tfwork'||m==='tfreport'||m==='tfdone'){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} gHome(); tfDevSync(); } }
(function(){
  if(document.getElementById('tf-devbtn')) return;
  var dev=/^(localhost|127\.0\.0\.1)$/.test(location.hostname); try{ if(localStorage.getItem('tethDev')==='1') dev=true; }catch(e){}
  if(!dev) return; /* 프로덕션 노출 차단 (D22) */
  var b=document.createElement('button'); b.id='tf-devbtn'; b.type='button'; b.textContent='QA';
  b.setAttribute('aria-label','제품 실험실');
  b.onclick=tfDevPanelTgl;
  document.body.appendChild(b);
})();
/* ==JS:tx== (AI 트레이딩 게스트/미활성 뷰 전용 함수는 이 아래에 추가) */
/* ==JS:ac== (활성화 시트/이용 현황 전용 함수) */
/* ==JS:mk== (전략 따라하기 전용 함수) */
/* ==JS:cx== (거래소 연결 전용 함수) */
/* ==JS:tm== (터미널/판단 로그 전용 함수) */
