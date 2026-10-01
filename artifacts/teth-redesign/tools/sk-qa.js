/* ═══ QA 상태 패널 (sk-qa) ═══
   페이지별로 화면 상태를 한 번에 띄운다. 단추 하나 = 계정 상태 맞추기 + 해당 화면으로 이동 + 그 화면 안의 상태 만들기.
   배포 사이트에서는 주소에 ?qa=1 을 붙이면 켜지고(이 브라우저에 기억), ?qa=0 이면 끈다. AI 호출 없이 띄운다. */
(function(){ try{ var q=new URLSearchParams(location.search).get('qa'); if(q==='1'){ localStorage.setItem('tethDev','1'); localStorage.removeItem('tethQaOff'); } if(q==='0'){ localStorage.removeItem('tethDev'); localStorage.setItem('tethQaOff','1'); } }catch(e){} })();
var QA_NICK=null;
function qaNick(kind){ try{ var L=tfSSRows().filter(function(s){ return !s.me; }); var r=kind==='lev'?L.filter(function(s){ return /양방향 2배/.test(mkTitle(s)); })[0]:kind==='bad'?L.filter(function(s){ return s.id==='r1'||s.nick==='r1'; })[0]:null; return (r||L[0]).nick; }catch(e){ return 'f1'; } }
function qaClean(){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} ['ac-cf','ac-auth','ac-sheet','st-dlg'].forEach(function(id){ var e=document.getElementById(id); if(e) e.remove(); }); try{ mkFollowClose(true); }catch(e){} try{ tfSS3DlgClose(true); }catch(e){} }
function qaAcReset(){ try{ var t=tfS(); t.ac=null; window.AC_QA=null; acS(); acSave(); }catch(e){} }
/* 계정 상태: guest, free, uid(초대 계정, 사용량 여유), sub(구독만, 여유), both(둘 다, 여유) */
var QA_ACCT={guest:'01',free:'02',uid:'05',sub:'07',both:'10'};
function qaAcct(k){ window.TF_QA_NOGATE=false; window.TF_PREVIEW=false; tfQaPreset(QA_ACCT[k]||'02'); qaAcReset();
  if(k==='uid'||k==='both'){ try{ var a=acS(); a.conn.bitget={via:k==='uid'?'partner':'paid',at:Date.now(),uid:'38291042',kyc:'ok'}; acSave(); }catch(e){} }
  if(k==='sub'){ try{ var a2=acS(); a2.sub={st:'active',price:AC_CFG.price,next:Date.now()+21*864e5,at:Date.now()-9*864e5}; acSave(); }catch(e){} }
  tfSave(); }
/* AI 호출 없는 빈 대화 */
function qaConv(title){ S.strategy=newStrategy(); S.versions=[]; S.activeVer=0;
  var sx={id:'s'+Date.now(),title:title||'QA 대화',status:'draft',strategy:S.strategy,versions:S.versions,artifacts:[],team:{},actRows:[],convo:[],thread:[],tabs:[{id:'__act',title:'대화'}],live:false,rawIntent:null,step:null,pendingChips:null};
  G.sessions.unshift(sx); G.cur=sx; taiBind(sx); G.tabs=sx.tabs; G.activeTab='__act'; $('g-aux').style.display='none'; gSideRender(); gShowConv(); return sx; }
function qaSay(text){ try{ gConvUser(text); }catch(e){} }
function qaAI(html){ try{ taiThreadAdd('<div class="g-amsg">'+html+'</div>'); }catch(e){} }
/* 사용량 만들기: 목표 퍼센트(초대 계정과 무료는 잔액으로, 구독은 사용액으로) */
function qaUsage(pct){ try{ var m=aiMeter();
  if(m.tier==='CARD'){ var want=AI_SUB_USD*pct/100-m.used; if(want>0) bcAppend('debit','qa',-want,null,'qa'+Date.now()); }
  else { var used=m.used; if(used<=0){ bcAppend('debit','qa',-100,null,'qa'+Date.now()); used=100; } var bal=bcBalance(); var target=pct>=100?0:used*(100/pct-1); var d=target-bal; if(Math.abs(d)>0.01) bcAppend(d>0?'charge':'debit','qa',d,null,'qa'+Date.now()+Math.random()); }
  bcAfterChange('qa'); }catch(e){} try{ localStorage.removeItem('teth.use80'); }catch(e){} }
function qaCopy(o){ o=o||{}; var nick=o.nick||qaNick('lev'), s2=tfSSFind(nick); if(!s2) return null; var cp=cpState(); var had=cp.copies.filter(function(x){ return x.nick===s2.nick&&x.status==='active'; })[0]; if(had) return had;
  var back=(o.back||30)+1, eqA=s2.r.eq||[], si=eqA.length>back?eqA[eqA.length-back].i:null, amt=o.amt||560;
  var c={id:'cp'+Date.now(),nick:s2.nick,mode:'ratio',amount:amt,pairs:[CPP_PAIR[s2.asset]||s2.asset],gen:{asof:MK_ASOF.slice(),len:PRICE0.length},simStartI:si,
    adv:{marginMode:'follow',lev:'follow',slip:'sys',maxMarginPct:95,maxPosX:5,maxLoss:-20,existing:'skip'},at:Date.now()-(o.back?o.back*864e5:0),status:'active',ledger:[{at:Date.now()-(o.back?o.back*864e5:0),type:'add',amt:amt,i:si}]};
  if(o.add&&eqA.length>back){ var j=eqA[eqA.length-Math.round(back/2)].i; c.ledger.push({at:Date.now()-Math.round(o.back/2)*864e5,type:'add',amt:o.add,i:j}); }
  cp.copies.push(c); tfSaveNow(); return c; }
/* 포지션과 청산 이력이 있는 복사: 지금 포지션이 열린 원본을 90일 전부터 */
function qaCopyLive(){ var L=['ETH 빨리 접기','코인 둘 롱숏 갈아타기','DOGE 평균선 양방향 2배'], nick=null;
  for(var i=0;i<L.length&&!nick;i++){ var s=tfSSFind(L[i]); if(s&&s.r&&s.r.state&&s.r.state.open) nick=s.nick; }
  return qaCopy({nick:nick||qaNick('lev'),back:90,amt:800,add:200}); }
function qaCpx(c,tab){ qaClean(); if(!c){ var cp=cpState(); c=cp.copies.filter(function(x){ return x.status==='active'; })[0]; } if(c) setTimeout(function(){ cpDetailGo(c.id,tab||'pos'); },300); }
function qaOrder(st){ var o={asset:'비트코인',side:'sell',trigger:90000,qty:'all',ttl:'gtc'}; o=odNorm(o); o.id='odqa'+Date.now(); o.status=st||'wait'; o.at=Date.now(); o.ex='bitget'; o.sess=G.cur&&G.cur.id; odS().push(o); tfSave(); return o; }
function qaTerm(after){ qaClean(); location.hash='#/trade'; if(typeof tfNFRoute==='function') setTimeout(function(){ try{ tfNFRoute('#/trade'); }catch(e){} },50); if(after) setTimeout(after,1600); }
function qaTermPick(fn){ try{ var all=tfTmAll(); var s=all.filter(fn)[0]; if(s){ if(TF_TM.sel===s.key) TF_TM.sel=null; tfTmSelect(s.key); } }catch(e){} }
function qaBotTab(name){ var b=[].filter.call(document.querySelectorAll('.tft-botbar .nfxh-tab, .nfxh-tabs .nfxh-tab'),function(x){ return x.textContent.indexOf(name)>=0; })[0]; if(b) b.click(); }
function qaBt(nick,run,res){ qaClean(); location.hash='#/share/bt/'+encodeURIComponent(nick); if(run) setTimeout(function(){ try{ if(res){ BT.per=0; btReady(); btCompute(); btFinish(); } else btStart(); }catch(e){} },1800); }
function qaDetail(tab){ qaClean(); location.hash='#/share/s/'+encodeURIComponent(qaNick('lev')); if(tab) setTimeout(function(){ var t=[].filter.call(document.querySelectorAll('.mk-dtabs .mk-tab'),function(b){ return b.textContent.indexOf(tab)>=0; })[0]; if(t) t.click(); },1500); }
function qaFlow(steps){ qaClean(); tfBrokersView(); var i=0; (function nx(){ if(i>=steps.length) return; var f=steps[i++]; setTimeout(function(){ try{ f(); }catch(e){} nx(); },700); })(); }
/* 페이지별 상태 */
var QA_PAGES=[
 ['홈과 채팅',[
  ['게스트 홈',function(){ qaAcct('guest'); qaClean(); gHome(); }],
  ['로그인 홈',function(){ qaAcct('free'); qaClean(); gHome(); }],
  ['질문 시트(빠진 정보 묻기)',function(){ qaAcct('both'); qaConv('비트코인 자동매매 전략'); qaSay('비트코인 나 대신 거래해줘'); qaAI('<p>몇 가지만 여쭙겠습니다.</p>'); skaCard({steps:[{title:'언제 사겠습니까?',options:[{t:'조금 밀릴 때',d:'얕은 조정에서도 자주 진입'},{t:'크게 밀릴 때',d:'깊은 하락 뒤에만 진입'},{t:'RSI 30 아래',d:'과매도에서 진입'}]},{title:'얼마나 오르면 팔겠습니까?',options:[{t:'5% 익절',d:'짧게 자주'},{t:'10% 익절',d:'균형'},{t:'익절 없음',d:'보유 한도에 정리'}]},{title:'어느 기간으로 검증할까요?',options:[{t:'최근 1년',d:'요즘 흐름'},{t:'최근 2년',d:'상승장과 조정장'}]}]}); }],
  ['전략 카드',function(){ qaAcct('both'); qaConv('비트코인 RSI 전략'); qaSay('비트코인 RSI 10 미만일 때 사는 전략 만들어줘'); qaAI('<p>RSI 10 미만, 15% 익절, 5% 손절, 최근 2년 검증은 그대로 넣었습니다.</p>'); tfAiStrategy({asset:'비트코인',rsi:10,tp:15,sl:-5,trend:false,period:'2y',name:'RSI10 비트코인'}); }],
  ['전략 카드(검증에서 뺀 조건)',function(){ qaAcct('both'); qaConv('비트코인 레버리지 전략'); qaSay('비트코인 레버리지 20배로 RSI 10 미만일때만 1분마다'); qaAI('<p>레버리지 20배와 1분마다 확인은 이번 검증에서 뺐습니다.</p>'); tfAiStrategy({asset:'비트코인',rsi:10,tp:15,sl:-5,trend:false,period:'2y',name:'RSI10 비트코인',skip:['레버리지 20배','1분마다 확인']}); }],
  ['예약 카드(예약 전)',function(){ qaAcct('both'); qaConv('비트코인 예약 매도'); qaSay('비트코인 9만 달러 되면 팔아줘'); qaAI('<p>조건을 확인했습니다. 아래에서 예약합니다.</p>'); tfOrderCard({asset:'비트코인',side:'sell',trigger:90000,qty:'all',ttl:'gtc'}); }],
  ['예약 카드(조건 대기)',function(){ qaAcct('both'); qaConv('비트코인 예약 매도'); qaSay('비트코인 9만 달러 되면 팔아줘'); tfOrderCard({asset:'비트코인',side:'sell',trigger:90000,qty:'all',ttl:'7d'}); var c=document.querySelector('.od-card'); if(c) odPlace(c.id); }],
  ['예약 카드(롱 3배, 취소됨)',function(){ qaAcct('both'); qaConv('이더리움 예약 롱'); qaSay('이더리움 3천 아래로 오면 3배 롱'); tfOrderCard({asset:'이더리움',side:'long',trigger:3000,qty:'half',lev:3,ttl:'1d'}); var c=document.querySelector('.od-card'); if(c){ odPlace(c.id); odCancel(c.id); } }],
  ['사용량 80% 배너(닫을 수 있음)',function(){ qaAcct('uid'); qaConv('사용량 확인'); qaUsage(85); aiBar(); }],
  ['사용량 100%(초대 계정, 카드 등록)',function(){ qaAcct('uid'); qaConv('사용량 확인'); qaUsage(100); aiBar(); }],
  ['사용량 100%(구독만, 초대 계정 연결)',function(){ qaAcct('sub'); qaConv('사용량 확인'); qaUsage(100); aiBar(); }]
 ]],
 ['전략 복사',[
  ['목록',function(){ qaAcct('free'); qaClean(); tfShareHub('find'); }],
  ['목록(내 거래소 하나 연결)',function(){ qaAcct('uid'); qaClean(); tfShareHub('find'); }],
  ['목록(내 거래소 둘 연결)',function(){ qaAcct('both'); try{ var a=acS(); a.conn.okx={via:'paid',at:Date.now(),uid:'77120011',kyc:'ok'}; acSave(); }catch(e){} qaClean(); tfShareHub('find'); }],
  ['상세 개요',function(){ qaAcct('free'); qaDetail(); }],
  ['상세 전략 정보 탭',function(){ qaAcct('free'); qaDetail('전략 정보'); }],
  ['복사 창(연결됨)',function(){ qaAcct('uid'); qaDetail(); setTimeout(function(){ mkFollowSheet(qaNick('lev')); },1600); }],
  ['복사 창 대신 플랜(미연결)',function(){ qaAcct('free'); qaDetail(); setTimeout(function(){ mkFollowSheet(qaNick('lev')); },1600); }],
  ['복사한 전략 상세(진입 대기)',function(){ qaAcct('uid'); qaCpx(qaCopy()); }],
  ['복사한 전략 상세(포지션 있음)',function(){ qaAcct('uid'); qaCpx(qaCopyLive()); }],
  ['복사한 전략 상세(청산 이력)',function(){ qaAcct('uid'); qaCpx(qaCopyLive(),'hist'); }],
  ['복사한 전략 상세(자금 이동)',function(){ qaAcct('uid'); qaCpx(qaCopyLive(),'bal'); }]
 ]],
 ['백테스트',[
  ['돌리기 전',function(){ qaAcct('free'); qaBt(qaNick('lev')); }],
  ['도는 중',function(){ qaAcct('free'); qaBt(qaNick('lev'),true); }],
  ['결과(좋음)',function(){ qaAcct('free'); qaBt(qaNick('lev'),true,true); }],
  ['결과(나쁨, 공개 전략)',function(){ qaAcct('free'); qaBt('r1',true,true); }],
  ['결과(나쁨, 내 전략, 규칙 수정하기)',function(){ qaAcct('free'); qaConv('비트코인 급락 매수 전략'); tfAiStrategy({asset:'비트코인',depth:'deep',tp:8,sl:-5,fng:45,trend:false,period:'all',name:'괜찮을때만 사는 비트코인'}); setTimeout(function(){ qaBt('mine',true,true); },600); }]
 ]],
 ['AI 트레이딩',[
  ['게스트',function(){ qaAcct('guest'); qaTerm(); }],
  ['로그인, 거래소 미연결',function(){ qaAcct('free'); qaTerm(); }],
  ['연결, 전략 없음',function(){ qaAcct('uid'); qaTerm(); }],
  ['복사한 전략만',function(){ qaAcct('uid'); qaCopy(); qaTerm(); }],
  ['전략 있음, 포지션 있음',function(){ qaAcct('uid'); window.TF_PREVIEW=true; qaTerm(function(){ qaTermPick(function(s){ return s.status==='live'&&!!tfTmCalc(s).pos; }); }); }],
  ['전략 있음, 포지션 없음',function(){ qaAcct('uid'); window.TF_PREVIEW=true; qaTerm(function(){ qaTermPick(function(s){ return s.status==='live'&&!tfTmCalc(s).pos; }); }); }],
  ['전략 오류',function(){ qaAcct('uid'); window.TF_PREVIEW=true; qaTerm(function(){ qaTermPick(function(s){ return s.status==='err'; }); }); }],
  ['예약 주문 대기(미체결 주문)',function(){ qaAcct('uid'); qaOrder('wait'); qaTerm(function(){ qaBotTab('미체결'); }); }],
  ['복사한 전략, 포지션 있음',function(){ qaAcct('uid'); qaCopyLive(); qaTerm(); }],
  ['복사한 AI 전략(여러 종목)',function(){ qaAcct('uid'); qaCopy({nick:'코인 셋 나눠 담기',back:60,amt:1200}); qaTerm(); }],
  ['복사한 혼합 전략',function(){ qaAcct('uid'); qaCopy({nick:'대표 코인 돌파 따라가기',back:60,amt:900}); qaTerm(); }],
  ['복사한 전략 둘(AI와 규칙)',function(){ qaAcct('uid'); qaCopy({nick:'코인 둘 롱숏 갈아타기',back:60,amt:1500}); qaCopyLive(); qaTerm(); }]
 ]],
 ['거래소 연결과 플랜',[
  ['플랜(무료 초대 계정 / 구독)',function(){ qaAcct('free'); qaClean(); tfBrokersView(); }],
  ['거래소 선택',function(){ qaAcct('free'); qaFlow([function(){ plPick('partner'); }]); }],
  ['계정(가입 안내)',function(){ qaAcct('free'); qaFlow([function(){ plPick('partner'); },function(){ pxPickEx('okx'); }]); }],
  ['가입한 계정 연결',function(){ qaAcct('free'); qaFlow([function(){ plPick('partner'); },function(){ pxPickEx('okx'); },function(){ pxJoined(); }]); }],
  ['승인 화면',function(){ qaAcct('free'); qaFlow([function(){ plPick('partner'); },function(){ pxPickEx('okx'); },function(){ acHas('yes'); }]); }],
  ['연결 확인 중',function(){ qaAcct('free'); qaFlow([function(){ plPick('partner'); },function(){ pxPickEx('okx'); },function(){ acHas('yes'); },function(){ acAuthOpen(); },function(){ acAuthYes(); }]); }],
  ['구독 결제',function(){ qaAcct('free'); qaFlow([function(){ plPick('paid'); }]); }],
  ['연결된 계정 목록',function(){ qaAcct('uid'); qaClean(); tfBrokersView(); }]
 ]],
 ['설정',[
  ['일반',function(){ qaAcct('free'); qaClean(); stGo('general'); }],
  ['계정',function(){ qaAcct('free'); qaClean(); stGo('account'); }],
  ['알림',function(){ qaAcct('free'); qaClean(); stGo('notify'); }],
  ['결제(이용 방식 없음)',function(){ qaAcct('free'); qaClean(); stGo('billing'); }],
  ['결제(초대 계정)',function(){ qaAcct('uid'); qaClean(); stGo('billing'); }],
  ['결제(구독)',function(){ qaAcct('sub'); qaClean(); stGo('billing'); }],
  ['결제(구독과 초대 계정, 크레딧 차감)',function(){ qaAcct('both'); qaClean(); stGo('billing'); }],
  ['결제(구독 해지됨)',function(){ qaAcct('sub'); try{ var a=acS(); a.sub.st='cancelled'; a.sub.until=Date.now()+12*864e5; acSave(); }catch(e){} qaClean(); stGo('billing'); }],
  ['결제(결제 실패)',function(){ qaAcct('free'); try{ var a=acS(); a.pay={st:'fail'}; acSave(); }catch(e){} qaClean(); stGo('billing'); }],
  ['사용량 20%',function(){ qaAcct('uid'); qaUsage(20); qaClean(); stGo('usage'); }],
  ['사용량 85%',function(){ qaAcct('uid'); qaUsage(85); qaClean(); stGo('usage'); }],
  ['사용량 100%',function(){ qaAcct('uid'); qaUsage(100); qaClean(); stGo('usage'); }],
  ['보안',function(){ qaAcct('free'); qaClean(); stGo('security'); }]
 ]],
 ['연구 기록',[
  ['비어 있음',function(){ qaAcct('free'); qaClean(); gHistory(); }],
  ['기록 있음',function(){ qaAcct('free'); ['비트코인 급락 매수 전략','이더리움 RSI 전략','BNB 평균선 분석','나스닥 하락 뒤 반등'].forEach(function(t,i){ G.sessions.push({id:'s'+(Date.now()-i*86400000*(i+1)),title:t,convo:[],thread:[],artifacts:[],tabs:[{id:'__act',title:'대화'}],status:'draft',versions:[]}); }); qaClean(); gHistory(); }]
 ]]
];
var QA_OPEN={};
try{ QA_OPEN=JSON.parse(localStorage.getItem('teth.qa.open')||'{}'); }catch(e){}
function qaPanelHtml(){
  return '<div class="qa2-hd"><b>화면 상태</b><button type="button" class="qa2-x" aria-label="닫기" onclick="qaPanelTgl()">✕</button></div>'
    +'<p class="qa2-note">단추를 누르면 계정 상태를 맞추고 그 화면으로 이동합니다.</p><div class="qa2-cur" id="qa2-cur"></div>'
    +QA_PAGES.map(function(pg,pi){ var open=QA_OPEN[pi]!==false; return '<details class="qa2-sec"'+(open?' open':'')+' ontoggle="qaSecTgl('+pi+',this.open)"><summary>'+pg[0]+'<i>'+pg[1].length+'</i></summary><div class="qa2-list">'+pg[1].map(function(it,ii){ return '<button type="button" class="qa2-it" onclick="qaRun('+pi+','+ii+')">'+it[0]+'</button>'; }).join('')+'</div></details>'; }).join('')
    +'<details class="qa2-sec"><summary>계정 시나리오(과금 11케이스)<i>11</i></summary><div class="qa2-list">'+TF_QA_PRESETS.map(function(x){ return '<button type="button" class="qa2-it" onclick="tfQaPreset(\''+x.id+'\');qaMark(\''+gEsc(x.label)+'\')">'+x.label+'</button>'; }).join('')+'</div></details>'
    +'<button type="button" class="qa2-old" onclick="qaPanelTgl();tfDevPanelTgl0()">예전 실험실 열기</button>';
}
function qaSecTgl(i,open){ QA_OPEN[i]=open; try{ localStorage.setItem('teth.qa.open',JSON.stringify(QA_OPEN)); }catch(e){} }
function qaMark(label){ var c=document.getElementById('qa2-cur'); if(c) c.textContent='지금: '+label; }
function qaRun(pi,ii){ var it=QA_PAGES[pi][1][ii]; try{ it[1](); }catch(e){ console.error(e); toast('이 상태를 만들지 못했습니다'); } qaMark(QA_PAGES[pi][0]+', '+it[0]); }
function qaPanelTgl(){ var p=document.getElementById('qa2-panel'), b=document.getElementById('tf-devbtn');
  if(p){ p.remove(); if(b) b.classList.remove('on'); return; }
  if(b) b.classList.add('on'); p=document.createElement('div'); p.id='qa2-panel'; p.innerHTML=qaPanelHtml(); document.body.appendChild(p); }
(function(){
  if(typeof tfDevPanelTgl==='function'){ window.tfDevPanelTgl0=tfDevPanelTgl; tfDevPanelTgl=qaPanelTgl; }
  /* 파운더 결정(2026-10-01): 주소에 ?qa=1 없이도 항상 보인다. ?qa=0 으로 열면 이 브라우저에서 숨긴다 */
  var dev=true; try{ if(localStorage.getItem('tethQaOff')==='1') dev=false; }catch(e){}
  if(!dev) return;
  var b=document.getElementById('tf-devbtn');
  if(!b){ b=document.createElement('button'); b.id='tf-devbtn'; b.type='button'; b.textContent='QA'; b.setAttribute('aria-label','화면 상태'); document.body.appendChild(b); }
  b.onclick=qaPanelTgl;
})();
/* 오른쪽 위 알림 단추는 모든 화면에서 숨긴다(파운더 2026-10-01: 홈 → 전부) */
(function(){
  function sync(){ var el=document.getElementById('nf-util'); if(el) el.hidden=true; }
  if(typeof tfNFBar==='function'){ var nb0=tfNFBar; tfNFBar=function(){ var r=nb0.apply(this,arguments); try{ sync(); }catch(e){} return r; }; }
  if(typeof gHome==='function'){ var h0=gHome; gHome=function(){ var r=h0.apply(this,arguments); try{ sync(); }catch(e){} return r; }; }
  var last=null; setInterval(function(){ if(typeof G!=='undefined'&&G.mode!==last){ last=G.mode; try{ sync(); }catch(e){} } },400);
})();

/* 터미널 미리 보기는 QA 상태에서만 켠다(window.TF_PREVIEW=true 를 QA 단추가 직접 설정). 사용자 흐름의 진입점은 일반 터미널로 */
tfPreviewOpen=function(){ window.TF_PREVIEW=false; try{ tfNav('#/trade'); }catch(e){} };
