// R07~R14: 활성화 흐름, AI 트레이딩 시작, 설정 화면을 상태별로 실제 조작하며 찍는다
// 사용: node qa/16-fixes/ac-check.mjs <폴더> [w] [h]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const round=process.argv[2]||'round-1', W=+(process.argv[3]||1440), H=+(process.argv[4]||900), M=W<700;
const sfx=M?'-m':'';
const OUT=new URL('./'+round+'/',import.meta.url); fs.mkdirSync(OUT,{recursive:true});
const DIR=decodeURIComponent(OUT.pathname).replace(/^\/([A-Za-z]:)/,'$1');
const log=[]; const p=await newPage(); await viewport(p,W,H,{mobile:M});
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ const m='ERR '+String(e).slice(0,300); log.push(m); console.log(m); return null; } };
const say=async(l,x)=>{ const v=await ev(x); console.log(l,String(v).slice(0,900)); log.push(l+' '+v); return v; };
const snap=async(n)=>{ await sleep(450); await shot(p,DIR+n+sfx+'.png',{full:false}); };
const B='http://127.0.0.1:8765/index.html';
const RESET=`(function(){ var t=tfS(); t.ac=null; t.api=null; t.conn=null; t.uidLinked=false; t.uid=''; t.payDone=false; window.AC_QA=null; acS(); acSave(); })()`;
const TXT=(sel)=>`(function(){ var e=document.querySelector('${sel}'); return e?e.innerText.replace(/\\s+/g,' ').slice(0,700):'NONE'; })()`;
const click=(sel)=>`(function(){ var e=document.querySelector('${sel}'); if(!e) return 'NO '+'${sel}'; e.click(); return 'ok'; })()`;
const clickT=(scope,t)=>`(function(){ var L=document.querySelectorAll('${scope} button, ${scope} a'); for(var i=0;i<L.length;i++) if(L[i].innerText.replace(/\\s+/g,' ').indexOf('${t}')>=0&&!L[i].disabled){ L[i].click(); return 'ok'; } return 'NO ${t}'; })()`;

await goto(p,B+'?v='+Date.now()); await sleep(800); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3800);
await ev(`(function(){ var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s); window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); })()`);

// R14 손님: AI 트레이딩 소개 → 시작 → 인증 창
await ev(`location.hash='#/trade'`); await sleep(1500); await snap('R14-guest-landing');
await say('R14 guest start',`(function(){ tfIntroStart(); var a=document.querySelector('#auth-ov,.auth-ov,[id*=auth]'); return JSON.stringify({intent:tfIntentPeek(),auth:!!document.querySelector('.auth-ov.on,#auth-ov.on,#auth.on,.auth.on')||document.body.innerText.indexOf('회원가입')>=0}); })()`);
await snap('R14-guest-auth');
await ev(`try{ closeModal('modal-auth'); }catch(e){}`);
await ev(`tfQaPreset('02')`); await sleep(1200); await ev(RESET);

// R14 회원, 실행 환경 없음
await ev(`location.hash='#/chat'`); await sleep(400); await ev(`location.hash='#/trade'`); await sleep(1400);
await say('R14 entry',TXT('.acx-entry')); await snap('R14-entry');
await ev(click('.acx-entry .bt-cta')); await sleep(600);
await say('R10 sheet route',TXT('#ac-sheet')); await snap('R09-A-route');

// R09 초대 경로: 거래소 → 계정 없음 → 가입 안내 → 승인 → 확인
await ev(`acPickRoute('partner'); acRouteGo()`); await sleep(400); await say('R09 ex step',TXT('#ac-flow .btg-st.on')); await snap('R09-B-exchange');
await ev(`acPickEx('binance'); acExGo()`); await sleep(400); await say('R09 acct step',TXT('#ac-flow .btg-st.on')); await snap('R09-C-account');
await ev(`acHas('no')`); await sleep(400); await say('R09 guide',TXT('#ac-flow .btg-st.on')); await snap('R09-D-guide');
await ev(`acGuide(1)`); await sleep(300); await ev(`acGuide(2)`); await sleep(300); await ev(`acGuide(3)`); await sleep(400);
await say('R09 auth step',TXT('#ac-flow .btg-st.on')); await snap('R09-E-authorize');
await ev(`acAuthOpen()`); await sleep(500); await say('R08 consent',TXT('#ac-auth')); await snap('R08-consent');
await ev(`acAuthNo()`); await sleep(400); await say('R09 auth cancelled',TXT('#ac-flow .btg-st.on')); await snap('R09-F-auth-cancel');
await ev(`window.AC_QA={uid:'fail'}; acAuthOpen()`); await sleep(400); await ev(`acAuthYes()`);
for(let k=0;k<30;k++){ const s=await ev(`acS().uid.st`); if(k===2) await snap('R09-G-uid-checking'); if(s==='fail'||s==='ok'||s==='other') break; await sleep(400); }
await sleep(500); await say('R09 uid fail',TXT('#ac-flow')); await snap('R09-H-uid-fail');
await ev(`window.AC_QA=null; acUidRun()`);
for(let k=0;k<30;k++){ const s=await ev(`acStep()`); if(s==='done') break; await sleep(400); }
await sleep(500); await say('R09 done',TXT('#ac-sheet')); await snap('R09-I-done');
await say('state',`JSON.stringify({acc:acAccess(),conn:acS().conn,ex:acS().ex,legacy:tfS().api})`);
await ev(`acSheetDone()`); await sleep(1500); await say('R14 terminal ready',TXT('.acx-entry')); await snap('R14-terminal-ready');

// R10 이미 충족: 같은 거래소 전략은 창 없이 이어 간다. 다른 거래소는 그 거래소를 유지한다
await say('R10 satisfied',`(function(){ acStart({need:'binance',after:{kind:'terminal'}}); return JSON.stringify({sheet:!!document.getElementById('ac-sheet')}); })()`);
await say('R10 other exchange (partner user, needs its own invite check)',`(function(){ acStart({need:'okx',name:'OKX 전략',after:{kind:'terminal'}}); return JSON.stringify({sheet:!!document.getElementById('ac-sheet'),ex:acS().ex,step:acStep()}); })()`); await sleep(500);
await say('R10 other exchange text',TXT('#ac-sheet')); await snap('R10-other-exchange'); await ev(`acSheetClose()`);

// R08 거래소 연결 화면: 연결됨
await ev(`tfBrokersView()`); await sleep(1400); await say('R08 page connected',TXT('.acx-page')); await snap('R08-page-connected');

// 이미 있는 계정이 초대 계정이 아닐 때
await ev(RESET); await ev(`window.AC_QA={uid:'fail'}; tfBrokersView()`); await sleep(900); await ev(`acPickRoute('partner'); acRouteGo(); acPickEx('gate'); acExGo(); acHas('yes')`); await sleep(400); await ev(`acAuthOpen()`); await sleep(300); await snap('R08-consent-gate'); await ev(`acAuthYes()`);
for(let k=0;k<30;k++){ const s=await ev(`acS().uid.st`); if(k===4) await snap('R09-G-uid-checking'); if(s==='fail') break; await sleep(350); }
await sleep(500); await say('R09 uid fail',TXT('#ac-flow')); await snap('R09-H-uid-fail'); await ev(`window.AC_QA=null`);
// 결제 경로: 실패 → 성공
await ev(RESET); await ev(`location.hash='#/chat'`); await sleep(300); await ev(`tfBrokersView()`); await sleep(1400);
await say('R08 page none',TXT('.acx-page')); await snap('R08-page');
await ev(`var g=document.getElementById('g-scroll'); if(g) g.scrollTop=g.scrollHeight`); await snap('R08-page-bottom'); await ev(`var g=document.getElementById('g-scroll'); if(g) g.scrollTop=0`);
await ev(`acPickRoute('paid'); acRouteGo()`); await sleep(300); await ev(`acPickEx('bitget'); acExGo()`); await sleep(400);
await say('R09 paid step',`acStep()+' :: '+${TXT('#ac-flow .btg-st.on')}`);
const fill=(n)=>`(function(){ var s=function(i,v){ var e=document.getElementById(i); if(e){ e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); } }; var L=document.querySelectorAll('#ac-flow input'); var ids=[].map.call(L,function(x){ return x.id; }); s(ids[0],'${n}'); s(ids[1],'12 / 29'); s(ids[2],'123'); if(ids[3]) s(ids[3],'KIM TETH'); return ids.join(','); })()`;
if((await ev(`acStep()`))==='acct'){ await ev(`acHas('yes')`); await sleep(300); }
await say('pay ids',fill('0000 1111 2222 3333')); await snap('R09-J-pay');
await ev(`acPayGo()`); for(let k=0;k<20;k++){ const s=await ev(`acS().pay.st`); if(s==='fail'||s==='ok') break; await sleep(400); }
await say('R09 pay fail',TXT('#ac-flow .btg-st.on')); await snap('R09-K-pay-fail');
await ev(fill('4242 4242 4242 4242')); await ev(`acPayGo()`); for(let k=0;k<20;k++){ const s=await ev(`acS().pay.st`); if(s==='ok') break; await sleep(400); }
await sleep(400); await say('R09 after pay',`acStep()+' :: '+${TXT('#ac-flow .btg-st.on')}`); await snap('R09-L-pay-ok');
if((await ev(`acStep()`))==='acct'){ await ev(`acHas('yes')`); await sleep(300); }
await ev(`acAuthOpen()`); await sleep(300); await ev(`acAuthYes()`); for(let k=0;k<30;k++){ const s=await ev(`acStep()`); if(s==='done') break; await sleep(400); }
await say('R09 paid done',`JSON.stringify({step:acStep(),acc:acAccess(),conn:acS().conn,bill:acS().bill.length})`); await snap('R09-M-paid-done');

// 구독이 끝난 뒤: 결제 화면과 실행 준비가 같은 말을 해야 한다
await ev(`(function(){ var a=acS(); window.__sub=JSON.stringify(a.sub); a.sub={st:'cancelled',until:Date.now()-1000}; tfS().payDone=false; acSave(); })()`);
await say('R10 expired',`(function(){ acOpen({ex:'bitget',page:1}); return JSON.stringify({acc:acAccess(),ready:acReady('bitget'),step:acStep()}); })()`);
await ev(`tfBrokersView()`); await sleep(900); await say('R10 expired page',TXT('.acx-page')); await snap('R10-expired-subscription');
await ev(`location.hash='#/settings/billing'`); await sleep(900); await say('R13 expired billing',TXT('.stg-main')); await snap('R13-settings-billing-expired');
await ev(`(function(){ var a=acS(); a.sub=JSON.parse(window.__sub); tfS().payDone=true; acSave(); })()`);
// R12, R13 설정
for(const tab of ['general','account','notify','billing','security']){
  await ev(`location.hash='#/settings/${tab}'`); await sleep(900);
  await say('R12 '+tab,TXT('.stg-main')); await snap((tab==='billing'?'R13':'R12')+'-settings-'+tab+'-paid');
  if(tab==='billing'||tab==='account'){ await ev(`var g=document.getElementById('g-scroll'); if(g) g.scrollTop=g.scrollHeight`); await snap((tab==='billing'?'R13':'R12')+'-settings-'+tab+'-paid-bottom'); }
}
await ev(`location.hash='#/settings/account'`); await sleep(800);
await say('R12 delete dlg',`(function(){ var r=${clickT('.stg-main','계정 삭제')}; return r; })()`); await sleep(500); await say('R12 delete text',TXT('#ac-cf')); await snap('R12-delete-confirm');
await say('R12 delete disabled',`(function(){ var b=document.querySelector('#ac-cf .ok'); return b?String(b.disabled):'NO'; })()`); await ev(`acConfirmClose()`);
await ev(`location.hash='#/settings/billing'`); await sleep(800);
await say('R13 cancel',click('.stg-main .stg-b.dg')); await sleep(500); await say('R13 cancel text',TXT('#ac-cf')); await snap('R13-cancel-confirm'); await ev(`acConfirmClose()`);
// 초대 회원의 결제 화면: 가짜 구독을 보여 주지 않는다
await ev(RESET); await ev(`(function(){ var a=acS(); a.route='partner'; a.ex='bitget'; a.has='yes'; a.auth={st:'ok',ex:'bitget'}; a.uid={st:'ok',ex:'bitget'}; acCommit(); acSave(); })()`);
await ev(`location.hash='#/settings/general'`); await sleep(300); await ev(`location.hash='#/settings/billing'`); await sleep(900);
await say('R13 partner billing',TXT('.stg-main')); await snap('R13-settings-billing-partner');
await ev(RESET); await ev(`location.hash='#/settings/general'`); await sleep(300); await ev(`location.hash='#/settings/billing'`); await sleep(900);
await say('R13 none billing',TXT('.stg-main')); await snap('R13-settings-billing-none');
// R07 통화
await say('R07',`JSON.stringify({cur:GLC.cur,won:(document.body.innerText.match(/₩|만원/g)||[]).length,tf:tfWon(5000)})`);
await say('errs',`JSON.stringify(window.__errs||[])`);
fs.writeFileSync(DIR+'ac-check'+sfx+'.txt',log.join('\n'));
await closePage(p); process.exit(0);
