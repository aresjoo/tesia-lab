// 플랜 뒤 화면(px): 거래소 선택, 계정, 승인, 확인, 한도, 완료, 본인 확인 관문이 화면 단위로 그려지는지
// 사용: node qa/ex-plan/px-check.mjs [url] [w] [h]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html', W=+(process.argv[3]||1440), H=+(process.argv[4]||900), M=W<700, sfx=M?'-m':'';
const DIR=decodeURIComponent(new URL('./s6/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(DIR,{recursive:true});
const out=[]; const ok=(n,c,i)=>{ out.push((c?'PASS':'FAIL')+' | '+n+(i!==undefined?' | '+JSON.stringify(i).slice(0,400):'')); console.log(out[out.length-1]); };
const p=await newPage(); await viewport(p,W,H,{mobile:M});
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'ERR '+String(e).slice(0,200); } };
const J=async(x)=>{ try{ return JSON.parse(await ev(`JSON.stringify(${x})`)); }catch(e){ return {}; } };
const snap=async(n)=>{ await sleep(450); await shot(p,DIR+n+sfx+'.png',{full:false}); };
const waitFor=async(x,ms)=>{ const t=Date.now(); while(Date.now()-t<ms){ if(await ev(x)===true) return true; await sleep(300); } return false; };
const RESET=`(function(){ var t=tfS(); t.ac=null; t.api=null; t.conn=null; t.uidLinked=false; t.uid=''; t.payDone=false; window.AC_QA=null; acS(); acSave(); })()`;
const TXT=(sel)=>`(function(){ var e=document.querySelector('${sel}'); return e?e.innerText.replace(/\\s+/g,' ').slice(0,600):'NONE'; })()`;
// 화면 공통: 검정 바탕, 제목 하나(32px 400), 연두 단추 없음, 스텝퍼 없음, 부제 반복 없음
const SCREEN=`(function(){ var r=document.getElementById('pl-root'); if(!r) return {root:false}; var h=r.querySelector('#ac-head h1'); var cs=h?getComputedStyle(h):null; var bg=getComputedStyle(document.getElementById('g-content')).backgroundColor; var t=r.innerText;
  return {root:true,h1:h?h.innerText:'',fw:cs?cs.fontWeight:'',fs:cs?cs.fontSize:'',bg:bg,lime:r.querySelectorAll('.bt-cta,.bt-sec').length,stepper:r.querySelectorAll('.btg-sts,.btg-st,.acx-sts').length,left:/단계 남았습니다|회원님|자산은 계속/.test(t),ctas:[].map.call(r.querySelectorAll('.px-cta'),function(b){ return b.innerText.trim(); }),back:!!r.querySelector('.pl-back'),help:r.querySelectorAll('.px-help').length,fab:getComputedStyle(document.getElementById('teth-help')||document.body).display}; })()`;
const clean=(s)=>s.root&&s.fw==='400'&&s.fs==='32px'&&s.bg==='rgb(0, 0, 0)'&&s.lime===0&&s.stepper===0&&!s.left&&s.help===1&&s.fab==='none';
await goto(p,B+'?v='+Date.now()); await sleep(600); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3800);
await ev(`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s);`);
await ev(`tfQaPreset('02')`); await sleep(1200); await ev(RESET);

// 무료 경로, 거래소가 정해지지 않은 경우: 거래소 선택 → 계정 → 승인 → 확인 → 완료
await ev(`tfBrokersView()`); await sleep(900); await ev(`plPick('partner')`); await sleep(900);
let s=await J(SCREEN); ok('무료 → 거래소 선택 화면: 검정 바탕, 제목 32px 400, 연두 단추와 스텝퍼 없음',clean(s)&&s.h1==='거래소 선택'&&s.back,s);
s=await J(`{tiles:document.querySelectorAll('#ac-flow .px-exs button').length,cont:!!document.querySelector('#ac-flow .px-cta'),rebate:/환급/.test(document.getElementById('ac-flow').innerText)}`); ok('타일 7개, 계속 단추 없음(타일이 곧 선택), 타일에 환급 문구 없음',s.tiles===7&&!s.cont&&!s.rebate,s);
await snap('X1-ex');
await ev(`pxPickEx('okx')`); await sleep(600); s=await J(SCREEN); ok('타일 누르면 바로 계정 화면 "OKX 계정"',clean(s)&&s.h1==='OKX 계정'&&(await ev(`acStep()`))==='acct',s);
s=await J(`{steps:document.querySelectorAll('#ac-flow .px-steps li').length,join:(document.querySelector('#ac-flow a.acx-a')||{}).innerText,links:[].map.call(document.querySelectorAll('#ac-flow .px-links .pl-link'),function(b){ return b.innerText; }),lead:${TXT('.px-lead')}}`);
ok('계정 화면: 안내 2줄, 주 단추 "OKX 가입 화면 열기", 작은 갈래 하나 "기존 초대 계정 연결"',s.steps===2&&/OKX 가입 화면 열기/.test(s.join)&&/기존 초대 계정 연결/.test(s.links[0])&&(s.links.length===1||/지금 쓰는 OKX 계정으로 연결/.test(s.links[1]))&&/TETH 초대로 가입한 OKX 계정이 필요합니다/.test(s.lead),s);
await snap('X2-acct');
await ev(`pxBack('ex')`); await sleep(500); ok('계정 화면 뒤로 → 거래소 선택',(await ev(`acStep()`))==='ex'&&(await J(SCREEN)).h1==='거래소 선택');
await ev(`pxPickEx('okx')`); await sleep(500); await ev(`pxJoined()`); await sleep(400); s=await J(`{cta:(document.querySelector('#ac-flow .px-cta')||{}).innerText,link:(document.querySelector('#ac-flow .px-links a')||{}).innerText}`); ok('가입 화면을 열고 돌아오면 주 단추가 "가입한 계정 연결", 작은 링크는 다시 열기',/가입한 계정 연결/.test(s.cta)&&/다시 열기/.test(s.link),s); await snap('X2b-acct-joined'); await ev(`acGuide(2)`); await sleep(500);
s=await J(SCREEN); ok('가입 완료 → 승인 화면 "OKX 연결", 단추 "OKX에서 승인하기"',clean(s)&&s.h1==='OKX 연결'&&s.ctas[0]==='OKX에서 승인하기',s);
s=await J(`{perm:document.querySelectorAll('#ac-flow .px-perm li').length,out:/출금|옮길 수 없|키를 만들/.test(document.getElementById('pl-root').innerText)}`); ok('권한 2줄(잔고 조회, 주문), 출금 부정문과 키 설명 없음',s.perm===2&&!s.out,s);
await snap('X3-auth');
await ev(`acAuthOpen()`); await sleep(300); s=await J(`{dlg:!!document.getElementById('ac-auth'),out:/출금/.test((document.getElementById('ac-auth')||{}).innerText||'')}`); ok('승인 창: 출금 줄 없음',s.dlg&&!s.out,s);
await ev(`acAuthYes()`); await sleep(1500); s=await J(SCREEN); ok('승인 → 확인 화면 "OKX 연결 확인 중"',s.root&&/연결 확인 중/.test(s.h1),s); await snap('X4-uid');
ok('확인 → 완료',await waitFor(`acStep()==='done'`,9000));
s=await J(SCREEN); s.lead=await ev(TXT('.px-lead')); s.txt=await ev(TXT('#pl-root')); ok('완료 화면: "연결되었습니다", 한 줄, 단추 "전략 시작하기", 영수증 표 없음, 본인 확인 요구 없음',clean(s)&&s.h1==='연결되었습니다'&&/시작하면 OKX 계정에서 실행됩니다/.test(s.lead)&&s.ctas[0]==='전략 시작하기'&&!/본인 확인/.test(await ev(TXT('#pl-root'))),s);
s=await J(`{dl:document.querySelectorAll('#pl-root dl').length,more:[].map.call(document.querySelectorAll('#ac-flow .px-links .pl-link'),function(b){ return b.innerText; })}`); ok('완료: 표 없음, 작은 갈래 "거래소 더 연결하기"',s.dl===0&&s.more[0]==='거래소 더 연결하기',s);
await snap('X5-done');
// 본인 확인 관문
await ev(`window.AC_QA={kyc:'fail'}`); await ev(`cpStart('r1')`); await sleep(1700);
s=await J(`{x:!!document.querySelector('#ac-cf .bx>.x'),dlg:!!document.getElementById('ac-cf'),px:!!document.querySelector('#ac-cf.px-cf'),h3:(document.querySelector('#ac-cf h3')||{}).innerText,lead:(document.querySelector('#ac-cf .px-lead')||{}).innerText,cta:(document.querySelector('#ac-cf .px-cta')||{}).innerText,go:(document.getElementById('ac-kyc-go')||{}).disabled,lime:document.querySelectorAll('#ac-cf .bt-cta,#ac-cf .bt-sec').length}`);
ok('관문: "OKX 본인 확인", 한 줄, 단추 "OKX에서 본인 확인하기", 오른쪽 위 닫기, 연두 없음',s.dlg&&s.px&&s.h3==='OKX 본인 확인'&&/끝나면 전략을 시작할 수 있습니다/.test(s.lead)&&/OKX에서 본인 확인하기/.test(s.cta)&&s.go===true&&s.lime===0&&s.x===true,s);
await snap('X6-kyc');
await ev(`window.AC_QA=null; acKycRun('okx')`); await sleep(1900); s=await J(`{dlg:!!document.getElementById('ac-cf'),kyc:acS().conn.okx.kyc}`); ok('확인을 마쳤습니다 → 완료되면 창이 닫히고 진행',!s.dlg&&s.kyc==='ok',s);
await ev(`try{ tfSS3DlgClose(true); }catch(e){} try{ mkFollowClose(true); }catch(e){}`);
// 연결된 거래소 목록 화면
await ev(`history.replaceState(null,'',location.pathname); gHome()`); await sleep(400); await ev(`tfBrokersView()`); await sleep(900);
s=await J(SCREEN); s.rows=await ev(`document.querySelectorAll('#ac-flow .px-list .px-acct').length`); ok('다시 들어오면 목록 화면: "거래소 연결", 연결된 계정 1줄, 단추 "터미널 열기"',clean(s)&&s.h1==='거래소 연결'&&s.rows===1&&s.ctas[0]==='터미널 열기',s);
await snap('X7-list');
// 구독 경로: 결제 뒤 승인 화면, 한도 화면
await ev(RESET); await ev(`history.replaceState(null,'',location.pathname); gHome()`); await sleep(400); await ev(`tfBrokersView()`); await sleep(900); await ev(`plPick('paid')`); await sleep(900);
await ev(`plApple()`); ok('구독 결제 → 거래소 선택 화면(무료와 같은 흐름)',await waitFor(`acSubOn()===true&&acStep()==='ex'`,9000)); await sleep(500); s=await J(SCREEN); ok('결제 뒤 거래소 선택: 같은 화면',clean(s)&&s.h1==='거래소 선택',s); await snap('X1b-ex-after-pay'); await ev(`pxPickEx('bybit')`); await sleep(600);
await sleep(500); s=await J(SCREEN); ok('구독 승인 화면 "Bybit 연결", 뒤로 가기 있음(거래소 바꾸기)',clean(s)&&s.h1==='Bybit 연결'&&s.ctas[0]==='Bybit에서 승인하기'&&s.back,s);
await snap('X3-auth-paid');
await ev(`acAuthOpen()`); await sleep(300); await ev(`acAuthYes()`); ok('승인 → 완료',await waitFor(`acStep()==='done'`,9000)); await sleep(400);
s=await J(SCREEN); ok('구독 완료 화면도 같은 꼴',clean(s)&&s.h1==='연결되었습니다',s);
await ev(`(function(){ var a=acS(); a.conn.okx={via:'paid',at:Date.now(),uid:'',kyc:'none'}; acSave(); })()`);
await ev(`acStart({need:'bitget',after:{kind:'terminal'}})`); await sleep(900);
s=await J(SCREEN); s.sheet=await ev(`!!document.getElementById('ac-sheet')`); s.ch=await ev(`document.querySelectorAll('#ac-flow .px-ch').length`);
ok('셋째 거래소: 한도 없이 바로 "Bitget 연결" 승인 화면(구독 하나로 7곳 전부)',clean(s)&&!s.sheet&&s.h1==='Bitget 연결'&&s.ch===0&&(await ev(`acStep()`))==='auth',s);
await snap('X8-third');
s=await J(`window.__errs`); ok('콘솔 오류 없음',Array.isArray(s)&&s.length===0,s);
const pass=out.filter(x=>x.startsWith('PASS')).length; out.push('','TOTAL '+pass+' / '+out.length); console.log(out[out.length-1]);
fs.writeFileSync(DIR+'px-check'+sfx+'.txt',out.join('\n'));
await closePage(p);
