// 전체 여정 테스트 A~G: 실제 브라우저에서 조작하고 통과 여부를 판정한다
// 사용: node qa/16-fixes/flows.mjs
import { newPage, closePage, goto, evala, viewport, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B='http://127.0.0.1:8765/index.html'; const out=[]; let p;
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'ERR '+String(e).slice(0,200); } };
const J=async(x)=>{ const v=await ev(`JSON.stringify(${x})`); try{ return JSON.parse(v); }catch(e){ return {err:v}; } };
const ok=(flow,name,cond,info)=>{ out.push((cond?'PASS':'FAIL')+' | '+flow+' | '+name+(info!==undefined?' | '+JSON.stringify(info):'')); console.log(out[out.length-1]); };
const fresh=async(login)=>{ if(p) await closePage(p); p=await newPage(); await viewport(p,1440,900,{mobile:false}); await goto(p,B+'?v='+Date.now()); await sleep(600); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3600);
  await ev(`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)); })`);
  if(login){ await ev(`tfQaPreset('02')`); await sleep(1100); await ev(`(function(){ var t=tfS(); t.ac=null; t.api=null; t.conn=null; t.uidLinked=false; t.uid=''; t.payDone=false; acS(); acSave(); })()`); } };
const waitFor=async(x,ms=9000)=>{ const t=Date.now(); while(Date.now()-t<ms){ if(await ev(x)===true) return true; await sleep(250); } return false; };
const modal=`(function(){ var m=document.getElementById('modal-auth'); return !!m&&(m.classList.contains('open')||m.classList.contains('on')||m.classList.contains('show')); })()`;
const signup=async()=>{ await ev(`authOauth('Google')`); await sleep(500); await ev(`(function(){ var a=document.getElementById('au-age-in'); if(a){ a.value='31'; authAgeFinish(); } })()`); await waitFor(`!!S.user`,6000); await sleep(1500); };

// A 손님 → 전략 상세 → 성과 확인 → 인증 → 그 전략 백테스트
await fresh(false);
await ev(`tfSS3Go('f3','all','ov')`); await sleep(2200);
await ev(`document.querySelector('.mk3-bt2').click()`); await sleep(700);
ok('A','인증 창이 열린다',await ev(modal)===true);
ok('A','하려던 일이 저장된다',(await J(`tfIntentPeek()`)).id==='f3');
await signup();
let s=await J(`{hash:location.hash,id:(window.BT&&BT.s)?BT.s.id:null,phase:window.BT&&BT.phase}`);
ok('A','인증 뒤 같은 전략의 백테스트로 이어진다',s.hash==='#/share/bt/f3'&&s.id==='f3',s);
ok('A','바로 결과 보기 단추가 없다',(await ev(`/바로 결과 보기/.test(document.body.innerText)`))===false);

// B 손님 → 전략 복사 → 인증 → 활성화(초대, 계정 없음) → 복사 설정으로 이어짐
await fresh(false);
await ev(`tfShareHub()`); await sleep(2200);
s=await J(`{btn:[].map.call(document.querySelectorAll('.mk-card button, .mk2-card button, [class*=card] button'),function(b){ return b.innerText.trim(); }).filter(function(x){ return /복사|따라/.test(x); }).slice(0,4)}`);
s=await J(`{btn:[].map.call(document.querySelectorAll('.mk-card .mk3-foot button'),function(b){ return b.innerText.trim(); }).slice(0,6)}`);
ok('B','목록 카드 단추는 전략 보기 하나',s.btn.length>0&&s.btn.every(x=>x==='전략 보기'),s.btn);
await fresh(true);
await ev(`acStart({need:'binance',name:'테스트 전략',after:{kind:'terminal'}})`); await sleep(500);
ok('B','활성화 창이 전략의 거래소를 유지한다',(await J(`{ex:acS().ex,step:acStep()}`)).ex==='binance');
await ev(`acPickRoute('partner'); acRouteGo()`); await sleep(200);
ok('B','거래소를 다시 묻지 않는다',(await ev(`acStep()`))==='acct');
await ev(`acHas('no')`); await sleep(200); ok('B','계정 없음 → 가입 안내',(await ev(`acStep()`))==='guide');
s=await J(`{a:(document.querySelector('#ac-flow a.acx-a')||{}).href||'',key:/API|키를 입력|시크릿/i.test(document.getElementById('ac-flow').innerText.replace('키를 만들거나 붙여 넣지 않습니다',''))}`);
ok('B','가입 주소가 있고 API 키 입력이 없다',!!s.a&&!s.key,s);
await ev(`acGuide(1); acGuide(2); acGuide(3)`); await sleep(200); ok('B','안내 뒤 연결 승인',(await ev(`acStep()`))==='auth');
await ev(`acAuthOpen()`); await sleep(300); await ev(`acAuthYes()`); ok('B','승인과 초대 계정 확인 뒤 완료',await waitFor(`acStep()==='done'`,9000));
ok('B','초대 회원, 이용료 없음',(await J(`{acc:acAccess(),via:acS().conn.binance.via}`)).via==='partner');

// C 있는 계정이 초대 계정이 아님 → 쉬운 말로 안내, 세 갈래
await fresh(true);
await ev(`window.AC_QA={uid:'fail'}; acStart({after:{kind:'terminal'}}); acPickRoute('partner'); acRouteGo(); acPickEx('okx'); acExGo(); acHas('yes'); acAuthOpen(); acAuthYes()`);
ok('C','초대 계정 확인 실패가 표시된다',await waitFor(`acS().uid.st==='fail'`,9000));
s=await J(`{t:document.getElementById('ac-flow').innerText.replace(/\\s+/g,' '),n:document.querySelectorAll('#ac-flow .acx-ch').length}`);
ok('C','UID, 레퍼럴 같은 말 없이 설명하고 선택지 3개',!/UID|레퍼럴|referral/i.test(s.t)&&s.n===3,{n:s.n});
ok('C','연결된 것으로 처리하지 않는다',(await ev(`acReady('okx')`))===false);
await ev(`window.AC_QA=null; acUidAlt('paid')`); await sleep(300); ok('C','구독으로 바꾸면 결제 단계',(await ev(`acStep()`))==='pay');

// D 구독: 카드 실패 → 다시 → 성공 → 승인 → 완료, 결제 내역 기록
await fresh(true);
await ev(`acStart({after:{kind:'terminal'}}); acPickRoute('paid'); acRouteGo(); acPickEx('bybit'); acExGo()`); await sleep(400);
const fill=(n)=>`(function(){ var L=document.querySelectorAll('#ac-flow input'); var v=['${n}','12 / 29','123','KIM TETH']; [].forEach.call(L,function(e,i){ e.value=v[i]; e.dispatchEvent(new Event('input',{bubbles:true})); }); return L.length; })()`;
ok('D','결제 단계에 카드 입력',(await ev(fill('0000 1111 2222 3333')))>=3);
await ev(`acPayGo()`); ok('D','결제 실패가 표시된다',await waitFor(`acS().pay.st==='fail'`,8000));
ok('D','실패하면 연결되지 않는다',(await ev(`acReady(null)`))===false);
await ev(fill('4242 4242 4242 4242')); await ev(`acPayGo()`); ok('D','다시 시도해 결제 성공',await waitFor(`acSubOn()===true`,8000));
await sleep(300); await ev(`acAuthOpen()`); await sleep(300); await ev(`acAuthYes()`); ok('D','승인 뒤 완료',await waitFor(`acStep()==='done'`,8000));
s=await J(`{bill:acS().bill.map(function(b){ return b.st; }),via:acS().conn.bybit.via}`); ok('D','결제 내역에 실패와 성공이 남는다',s.bill.length===2&&s.via==='paid',s);

// E 이미 충족: 다시 묻지 않음, 다른 거래소는 그 거래소만, 만료는 결제만
ok('E','같은 거래소는 창 없이 진행',(await J(`(function(){ acSheetClose(true); acStart({need:'bybit',after:{kind:'terminal'}}); return {sheet:!!document.getElementById('ac-sheet')}; })()`)).sheet===false);
s=await J(`(function(){ acStart({need:'okx',after:{kind:'terminal'}}); return {sheet:!!document.getElementById('ac-sheet'),ex:acS().ex,step:acStep(),steps:acSteps().map(function(x){ return x[0]; })}; })()`);
ok('E','구독 회원의 다른 거래소: 승인만 남는다',s.sheet&&s.ex==='okx'&&s.step==='auth'&&s.steps.indexOf('pay')<0,s);
await ev(`acSheetClose(true)`);
s=await J(`(function(){ var a=acS(); a.sub={st:'cancelled',until:Date.now()-1000}; tfS().payDone=false; acSave(); acOpen({ex:'bybit'}); return {ready:acReady('bybit'),step:acStep(),acc:acAccess()}; })()`);
ok('E','구독 만료: 준비 안 됨, 결제 단계로',s.ready===false&&s.step==='pay',s);
await ev(`location.hash='#/settings/general'`); await sleep(500); await ev(`location.hash='#/trade'`); await sleep(1800);
ok('E','만료 회원의 AI 트레이딩은 소개 화면과 시작하기',(await ev(`G.mode==='tfintro'&&/시작하기/.test((document.querySelector('.txh-hero button')||{}).innerText||'')`))===true);

// F 설정: 전용 화면, 통화 설정 없음, 계정 삭제 확인, 초대 회원 결제 화면
await fresh(true);
await ev(`gSetMenu({stopPropagation:function(){},currentTarget:document.body})`); await sleep(500);
ok('F','톱니를 누르면 예전 팝업 메뉴',(await ev(`!document.getElementById('g-setmenu').hidden`))===true);
await ev(`document.getElementById('gm-set-item').click()`); await sleep(900);
ok('F','팝업의 설정 항목이 설정 페이지를 연다',(await ev(`location.hash`))==='#/settings/general');
s=await J(`{cur:!!document.querySelector('.stg-main select[onchange*=Cur], #glc-cur:not([style*=none])')&&getComputedStyle(document.getElementById('glc-cur')||document.body).display!=='none'&&!!document.getElementById('glc-cur'),lang:document.querySelectorAll('.stg-main select option').length,txt:document.querySelector('.stg-main').innerText}`);
ok('F','언어만 고르고 통화 선택은 없다',s.lang>=5&&!/통화 선택|KRW|원화/.test(s.txt),{lang:s.lang});
await ev(`location.hash='#/settings/account'`); await sleep(800);
await ev(`(function(){ var L=document.querySelectorAll('.stg-main button'); for(var i=0;i<L.length;i++) if(L[i].innerText.trim()==='계정 삭제'){ L[i].click(); return; } })()`); await sleep(400);
s=await J(`{open:!!document.getElementById('ac-cf'),dis:(document.querySelector('#ac-cf .ok')||{}).disabled,user:!!S.user}`);
ok('F','계정 삭제는 확인 창과 입력을 거친다',s.open&&s.dis===true&&s.user,s);
await ev(`(function(){ var i=document.querySelector('#ac-cf input'); i.value='삭제'; i.dispatchEvent(new Event('input',{bubbles:true})); })()`); await sleep(200);
ok('F','삭제를 입력하면 단추가 켜진다',(await ev(`document.querySelector('#ac-cf .ok').disabled`))===false);
await ev(`acConfirmClose()`);
await ev(`(function(){ var a=acS(); a.route='partner'; a.ex='bitget'; a.has='yes'; a.auth={st:'ok',ex:'bitget'}; a.uid={st:'ok',ex:'bitget'}; acCommit(); })()`);
await ev(`location.hash='#/settings/general'`); await sleep(300); await ev(`location.hash='#/settings/billing'`); await sleep(900);
s=await J(`{t:document.querySelector('.stg-main').innerText.replace(/\\s+/g,' ')}`);
ok('F','초대 회원에게 구독이나 다음 결제일을 보여 주지 않는다',/TETH 초대 계정/.test(s.t)&&!/다음 결제일|280 . 월|구독 해지/.test(s.t));

// G AI 트레이딩: 손님 소개 → 시작 → 인증 → 실행 방식 선택 → 연결 → 터미널, 전략 선택 강요 없음
await fresh(false);
await ev(`location.hash='#/trade'`); await sleep(1500);
await ev(`tfIntroStart()`); await sleep(600);
ok('G','시작을 누르면 인증 창',await ev(modal)===true);
await signup(); await sleep(800);
s=await J(`{sheet:!!document.getElementById('ac-sheet'),step:typeof acStep==='function'?acStep():null,t:(document.getElementById('ac-sheet')||{innerText:''}).innerText.replace(/\\s+/g,' ').slice(0,200)}`);
ok('G','인증 뒤 실행 방식 선택으로 이어진다',s.sheet&&s.step==='route',s);
ok('G','전략을 먼저 고르라고 하지 않는다',!/전략을 (먼저 )?(고르|선택)/.test(s.t));
await ev(`acPickRoute('partner'); acRouteGo(); acPickEx('bitget'); acExGo(); acHas('yes'); acAuthOpen(); acAuthYes()`);
ok('G','연결 완료',await waitFor(`acStep()==='done'`,9000));
await ev(`acSheetDone()`); await sleep(1500);
s=await J(`{hash:location.hash,rdy:!!document.querySelector('.acx-entry.rdy'),term:!!document.querySelector('.tft-page, .tm-page, [class*=tm-]')}`);
ok('G','전략 없이도 터미널에 들어간다',s.hash==='#/trade'&&(s.rdy||s.term),s);

// 공통: 문체, 통화, 오류
await ev(`tfShareHub()`); await sleep(2000);
s=await J(`{yo:(document.body.innerText.match(/[가-힣](어요|아요|해요|예요|에요|세요)[.!?\\s]/g)||[]).length,won:(document.body.innerText.match(/₩|만원/g)||[]).length,usdt:(document.body.innerText.match(/[0-9] USDT/g)||[]).length,errs:window.__errs}`);
ok('공통','전략 목록: 해요체 0, 원화 0, USDT 금액 0, 오류 0',s.yo===0&&s.won===0&&s.usdt===0&&s.errs.length===0,s);
await ev(`tfSS3Go('d1','all','ov')`); await sleep(2500);
s=await J(`{yo:(document.body.innerText.match(/[가-힣](어요|아요|해요|예요|에요|세요)[.!?\\s]/g)||[]),won:(document.body.innerText.match(/₩|만원/g)||[]).length,usdt:(document.body.innerText.match(/[0-9] USDT/g)||[]).length,chips:/현재 상태|현물 매수|현물 매도/.test(document.querySelector('#g-content').innerText),errs:window.__errs}`);
ok('공통','전략 상세: 해요체 0, 원화 0, USDT 금액 0, 칩 없음',s.yo.length===0&&s.won===0&&s.usdt===0&&!s.chips&&s.errs.length===0,s);
const pass=out.filter(x=>x.startsWith('PASS')).length;
out.push('', 'TOTAL '+pass+' / '+out.length+' passed'); console.log(out[out.length-1]);
fs.writeFileSync(decodeURIComponent(new URL('./FLOWS_RESULT.txt',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'),out.join('\n'));
await closePage(p); process.exit(0);
