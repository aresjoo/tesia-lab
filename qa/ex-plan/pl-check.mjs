// 거래소 연결 플랜: 여섯 갈래 진입, 무료 경로(가입 안내, 바로 연결), 구독 경로(결제 먼저, 거래소 2곳 한도), 실행 직전 본인 확인
// 사용: node qa/ex-plan/pl-check.mjs [url] [w] [h]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html', W=+(process.argv[3]||1440), H=+(process.argv[4]||900), M=W<700, sfx=M?'-m':'';
const DIR=decodeURIComponent(new URL('./r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(DIR,{recursive:true});
const out=[]; const ok=(n,c,i)=>{ out.push((c?'PASS':'FAIL')+' | '+n+(i!==undefined?' | '+JSON.stringify(i).slice(0,400):'')); console.log(out[out.length-1]); };
const p=await newPage(); await viewport(p,W,H,{mobile:M});
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'ERR '+String(e).slice(0,200); } };
const J=async(x)=>{ try{ return JSON.parse(await ev(`JSON.stringify(${x})`)); }catch(e){ return {}; } };
const snap=async(n)=>{ await sleep(400); await shot(p,DIR+n+sfx+'.png',{full:false}); };
const waitFor=async(x,ms)=>{ const t=Date.now(); while(Date.now()-t<ms){ if(await ev(x)===true) return true; await sleep(300); } return false; };
const RESET=`(function(){ var t=tfS(); t.ac=null; t.api=null; t.conn=null; t.uidLinked=false; t.uid=''; t.payDone=false; window.AC_QA=null; acS(); acSave(); })()`;
const TXT=(sel)=>`(function(){ var e=document.querySelector('${sel}'); return e?e.innerText.replace(/\\s+/g,' ').slice(0,600):'NONE'; })()`;
await goto(p,B+'?v='+Date.now()); await sleep(600); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3800);
await ev(`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s);`);

// 갈래 6 손님: 거래소 연결 = 플랜 화면, CTA는 가입 창
await ev(`tfBrokersView()`); await sleep(1200);
let s=await J(`{pl:!!document.getElementById('pl-root'),cards:document.querySelectorAll('.pl-card').length,ctas:[].map.call(document.querySelectorAll('.pl-cta'),function(b){ return b.innerText.trim(); }),price:[].map.call(document.querySelectorAll('.pl-price>span'),function(x){ return x.innerText; })}`);
ok('손님: 거래소 연결은 플랜 화면(무료, 구독 두 카드)',s.pl&&s.cards===2&&s.ctas[0]==='무료로 시작하기'&&s.ctas[1]==='구독으로 시작하기'&&s.price[0]==='0'&&s.price[1]==='280',s);
await snap('P1-plan-guest');
await ev(`plPick('partner')`); await sleep(500); s=await J(`{auth:(function(){ var m=document.getElementById('modal-auth'); return !!m&&(m.classList.contains('open')||m.classList.contains('on')); })(),intent:tfIntentPeek()}`);
ok('손님이 CTA를 누르면 가입 창, 고른 방식이 저장된다',s.auth&&s.intent&&s.intent.route==='partner',s); await ev(`closeModal('modal-auth')`);
// 회원, 자격 없음
await ev(`tfQaPreset('02')`); await sleep(1200); await ev(RESET);
await ev(`tfBrokersView()`); await sleep(1000); s=await J(`{pl:!!document.getElementById('pl-root'),bt:!!document.querySelector('.pl-bt')}`); ok('회원, 자격 없음: 플랜 화면, 결과 카드 없음',s.pl&&!s.bt,s);
await snap('P1-plan-member');
// 갈래 1, 5: 좋은 백테스트 → 실행 → 결과 카드가 왼쪽에
await ev(`location.hash='#/share/bt/f1'`); await sleep(2500); await ev(`BT.per=0; btReady(); btCompute(); btFinish()`); await sleep(1500);
await ev(`btUse()`); await sleep(1200);
s=await J(`{pl:!!document.getElementById('pl-root'),bt:!!document.querySelector('.pl-bt'),cols:document.querySelectorAll('.pl-grid>.pl-card').length,name:(document.querySelector('.pl-bt .pl-h')||{}).innerText,need:(document.querySelector('.pl-need')||{}).innerText,noBtn:!document.querySelector('.pl-bt button')}`);
ok('갈래 1: 좋은 결과에서 실행 → 결과 카드가 같은 크기로 왼쪽, 단추 없음',s.pl&&s.bt&&s.cols===3&&s.noBtn&&/Binance/.test(s.need),s);
await snap('P1-plan-with-backtest');
// 갈래 2: 나쁜 결과에서 실행 → 결과 카드 없음
await ev(`location.hash='#/share/bt/r1'`); await sleep(2500); await ev(`BT.per=0; btReady(); btCompute(); btFinish()`); await sleep(1500);
await ev(`(function(){ var L=document.querySelectorAll('#bt-root .bt-sec'); for(var i=0;i<L.length;i++) if(/실행하기/.test(L[i].innerText)){ L[i].click(); return; } })()`); await sleep(1200);
s=await J(`{pl:!!document.getElementById('pl-root'),bt:!!document.querySelector('.pl-bt')}`); ok('갈래 2: 나쁜 결과에서 실행 → 플랜 화면, 결과 카드 없음',s.pl&&!s.bt,s);
// 무료 경로: 가입 안내가 기본, 작은 링크로 바로 연결
await ev(`plPick('partner')`); await sleep(900);
s=await J(`{step:acStep(),txt:${TXT('#ac-flow')}}`); ok('무료 선택 → 전략의 거래소가 정해져 있어 거래소 단계를 건너뛴다',s.step==='acct',{step:s.step,ex:await ev(`acS().ex`)}); s=await J(`{step:acStep(),guide:!!document.querySelector('#ac-flow .px-steps'),have:(document.querySelector('.acx-have')||{}).innerText,join:!!document.querySelector('#ac-flow a.acx-a'),steps:document.querySelectorAll('#ac-flow .px-steps li').length}`);
ok('계정 단계: 가입 안내가 기본(가입, 본인 확인, TETH 연결), 작은 링크 "이미 있습니까"',s.step==='acct'&&s.guide&&/기존 초대 계정 연결/.test(s.have)&&s.join&&s.steps===2,s);
await snap('P2B-free-guide');
await ev(`acHas('yes')`); await sleep(400); ok('이미 있음 → 바로 승인 단계',(await ev(`acStep()`))==='auth');
await ev(`acAuthOpen()`); await sleep(300); await ev(`acAuthYes()`); ok('승인 → 초대 확인 → 완료(본인 확인은 여기서 검사하지 않음)',await waitFor(`acStep()==='done'`,9000));
s=await J(`{txt:${TXT('#ac-flow')},kyc:acS().conn.okx&&acS().conn.okx.kyc}`); ok('완료 화면에 본인 확인 요구가 없다',!/본인 확인/.test(s.txt)&&s.kyc==='none',s);
await snap('P3-free-done');
// 실행 직전 본인 확인 관문
await ev(`window.AC_QA={kyc:'fail'}`); await ev(`cpStart('r1')`); await sleep(1600);
s=await J(`{dlg:!!document.getElementById('ac-cf'),txt:${TXT('#ac-cf')},go:(document.getElementById('ac-kyc-go')||{}).disabled}`);
ok('전략 시작 직전: 본인 확인 미완료면 막고 안내(연결은 유지)',s.dlg&&/본인 확인/.test(s.txt)&&s.go===true,{txt:s.txt.slice(0,120)});
await snap('P4-kyc-gate-fail');
await ev(`window.AC_QA=null; acKycRun('okx')`); await sleep(1800); s=await J(`{dlg:!!document.getElementById('ac-cf'),kyc:acS().conn.okx.kyc}`); ok('다시 확인 → 완료되면 창이 닫히고 진행',!s.dlg&&s.kyc==='ok',s);
await ev(`try{ tfSS3DlgClose(true); }catch(e){} try{ mkFollowClose(true); }catch(e){}`);
// 구독 경로: 결제가 먼저(참고 B), 그다음 거래소
await ev(RESET); await ev(`history.replaceState(null,'',location.pathname); gHome()`); await sleep(400); await ev(`tfBrokersView()`); await sleep(900); await ev(`plPick('paid')`); await sleep(900);
s=await J(`{co:!!document.querySelector('.pl-co'),h1:(document.querySelector('.pl-cohead h1')||{}).innerText,apple:!!document.querySelector('.pl-apple'),exs:document.querySelectorAll('.pl-exs button').length,tot:(document.querySelector('.pl-lines .tot b')||{}).innerText,cta:(document.getElementById('ac-go')||{}).innerText,tax:/세액/.test(document.body.innerText)}`);
ok('구독 선택 → 플랜 구성(결제) 화면: Apple Pay, 카드, 거래소 7곳, 오늘 결제 금액, 세액 없음',s.co&&s.h1==='플랜 구성'&&s.apple&&s.exs===7&&s.tot==='$280.00'&&/결제하고 시작하기/.test(s.cta)&&!s.tax,s);
await snap('P2A-checkout');
const fill=(n)=>`(function(){ var v={'ac-cn':'${n}','ac-ce':'12 / 29','ac-cc':'123','ac-ch':'KIM DOHYUN'}; for(var k in v){ var e=document.getElementById(k); if(e){ e.value=v[k]; e.dispatchEvent(new Event('input',{bubbles:true})); } } return 'ok'; })()`;
await ev(`plPickEx('bybit')`); await sleep(400); await ev(fill('0000 1111 2222 3333')); await ev(`plPay()`); await sleep(2200);
s=await J(`{fail:acS().pay.st,txt:${TXT('.acx-fail')},kept:(document.getElementById('ac-cn')||{}).value}`); ok('결제 실패: 안내, 입력값 유지',s.fail==='fail'&&/승인되지 않았습니다/.test(s.txt)&&/0000/.test(s.kept),s);
await snap('P2A-checkout-fail');
await ev(fill('4242 4242 4242 4242')); await ev(`plPay()`); ok('결제 성공 → 거래소 승인 단계로(결제가 먼저)',await waitFor(`acSubOn()===true&&acStep()==='auth'&&acS().ex==='bybit'`,9000),await J(`{sub:acSubOn(),step:acStep(),ex:acS().ex}`));
await snap('P3-paid-auth');
await ev(`acAuthOpen()`); await sleep(300); await ev(`acAuthYes()`); ok('승인 → 완료',await waitFor(`acStep()==='done'`,9000));
s=await J(`{conn:Object.keys(acS().conn),bill:acS().bill.map(function(b){ return b.st; })}`); ok('결제 내역에 실패와 성공',s.bill.indexOf('failed')>=0&&s.bill.indexOf('paid')>=0&&s.conn[0]==='bybit',s);
// 구독 거래소 한도 2곳
await ev(`(function(){ var a=acS(); a.conn.okx={via:'paid',at:Date.now(),uid:'',kyc:'none'}; acSave(); })()`);
await ev(`acStart({need:'bitget',after:{kind:'terminal'}})`); await sleep(800);
s=await J(`{step:acStep(),page:!!document.getElementById('pl-root')}`); ok('구독 거래소 2곳 뒤 셋째: 한도 없이 승인 화면(구독 하나로 7곳 전부)',s.step==='auth'&&s.page,s);
await snap('P5-paid-limit');

// Apple Pay
await ev(RESET); await ev(`history.replaceState(null,'',location.pathname); gHome()`); await sleep(400); await ev(`tfBrokersView()`); await sleep(900); await ev(`plPick('paid')`); await sleep(900); await ev(`plApple()`);
ok('Apple Pay → 결제 완료 → 승인 단계',await waitFor(`acSubOn()===true&&acStep()==='auth'`,9000),await J(`{card:acS().cards[0]&&acS().cards[0].brand}`));
// 모바일 접기
if(M){ await ev(RESET); await ev(`history.replaceState(null,'',location.pathname); gHome()`); await sleep(400); await ev(`tfBrokersView()`); await sleep(900);
  s=await J(`{items:getComputedStyle(document.querySelector('.pl-hi .pl-items')).display,more:(document.querySelector('.pl-hi .pl-more')||{}).innerText,order:[].map.call(document.querySelectorAll('.pl-grid>.pl-card'),function(c){ return getComputedStyle(c).order; })}`);
  ok('모바일: 항목이 기본으로 펼쳐져 있고 무료 카드가 위',s.items!=='none'&&s.order[0]==='1',s); await ev(`document.getElementById('g-scroll').scrollTop=520`); await snap('P1-plan-member-open'); }
s=await J(`window.__errs`); ok('콘솔 오류 없음',Array.isArray(s)&&s.length===0,s);
const pass=out.filter(x=>x.startsWith('PASS')).length; out.push('','TOTAL '+pass+' / '+out.length); console.log(out[out.length-1]);
fs.writeFileSync(DIR+'pl-check'+sfx+'.txt',out.join('\n'));
await closePage(p); process.exit(0);
