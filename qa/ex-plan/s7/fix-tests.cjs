// 세 번째 검수와 한도 폐지에 맞춘 검사 갱신
const fs=require('fs');
function patch(f,pairs){ let s=fs.readFileSync(f,'utf8'); pairs.forEach(([a,b])=>{ if(!s.includes(a)) throw new Error(f+' miss '+a.slice(0,70)); s=s.replace(a,b); }); fs.writeFileSync(f,s); console.log('ok',f); }
patch('qa/ex-plan/px-check.mjs',[
  ["s.links[0]==='가입 완료'&&/초대 계정으로 바로 연결/.test(s.links[1])&&/초대 링크로 가입한 OKX 계정만/.test(s.lead)","s.links.length===1&&/기존 초대 계정 연결/.test(s.links[0])&&/TETH 초대로 가입한 OKX 계정이 필요합니다/.test(s.lead)"],
  ["ok('계정 화면: 안내 2줄, 주 단추 \"OKX 가입 화면 열기\", 작은 갈래 \"가입 완료\" \"초대 계정으로 바로 연결\"'","ok('계정 화면: 안내 2줄, 주 단추 \"OKX 가입 화면 열기\", 작은 갈래 하나 \"기존 초대 계정 연결\"'"],
  ["await ev(`pxPickEx('okx')`); await sleep(500); await ev(`acGuide(2)`); await sleep(500);","await ev(`pxPickEx('okx')`); await sleep(500); await ev(`pxJoined()`); await sleep(400); s=await J(`{cta:(document.querySelector('#ac-flow .px-cta')||{}).innerText,link:(document.querySelector('#ac-flow .px-links a')||{}).innerText}`); ok('가입 화면을 열고 돌아오면 주 단추가 \"가입한 계정 연결\", 작은 링크는 다시 열기',/가입한 계정 연결/.test(s.cta)&&/다시 열기/.test(s.link),s); await snap('X2b-acct-joined'); await ev(`acGuide(2)`); await sleep(500);"],
  ["/OKX 계정에서 실행합니다/.test(s.lead)","/시작하면 OKX 계정에서 실행됩니다/.test(s.lead)"],
  ["s.h3==='OKX 본인 확인이 필요합니다'&&/끝나면 전략을 시작할 수 있습니다/.test(s.lead)&&/OKX에서 본인 확인하기/.test(s.cta)&&s.go===true&&s.lime===0","s.h3==='OKX 본인 확인'&&/끝나면 전략을 시작할 수 있습니다/.test(s.lead)&&/OKX에서 본인 확인하기/.test(s.cta)&&s.go===true&&s.lime===0&&!!document_x(s)"],
  ["ok('관문: \"OKX 본인 확인이 필요합니다\", 한 줄, 단추 \"OKX에서 본인 확인하기\", 연두 없음'","ok('관문: \"OKX 본인 확인\", 한 줄, 단추 \"OKX에서 본인 확인하기\", 오른쪽 위 닫기, 연두 없음'"],
  ["s=await J(`{dlg:!!document.getElementById('ac-cf'),px:!!document.querySelector('#ac-cf.px-cf'),h3:","s=await J(`{x:!!document.querySelector('#ac-cf .bx>.x'),dlg:!!document.getElementById('ac-cf'),px:!!document.querySelector('#ac-cf.px-cf'),h3:"],
  ["ok('셋째 거래소: 창이 아니라 화면 \"거래소 2곳이 연결되어 있습니다\", 갈래 2개, 전략 거래소가 고정이라 \"다른 거래소\" 없음',clean(s)&&!s.sheet&&s.h1==='거래소 2곳이 연결되어 있습니다'&&s.ch===2&&(await ev(`acStep()`))==='limit'&&!/다른 거래소 고르기/.test(await ev(TXT('#ac-flow'))),s);","ok('셋째 거래소: 한도 없이 바로 \"Bitget 연결\" 승인 화면(구독 하나로 7곳 전부)',clean(s)&&!s.sheet&&s.h1==='Bitget 연결'&&s.ch===0&&(await ev(`acStep()`))==='auth',s);"],
  ["await snap('X8-limit');\nawait ev(`acLimitAlt('partner')`); await sleep(600); s=await J(SCREEN); ok('한도에서 초대 계정으로 → \"Bitget 계정\" 화면',clean(s)&&s.h1==='Bitget 계정'&&(await ev(`acStep()`))==='acct',s);","await snap('X8-third');"],
]);
let s=fs.readFileSync('qa/ex-plan/px-check.mjs','utf8'); s=s.replace("&&!!document_x(s)","&&s.x===true"); fs.writeFileSync('qa/ex-plan/px-check.mjs',s);
patch('qa/16-fixes/flows.mjs',[
  ["n:document.querySelectorAll('#ac-flow .acx-ch').length}","n:document.querySelectorAll('#ac-flow .px-ch').length}"],
  ["return {sheet:!!document.getElementById('ac-sheet'),ex:acS().ex,step:acStep(),steps:acSteps().map(function(x){ return x[0]; })}; })()`);\nok('E','구독 회원의 다른 거래소: 승인만 남는다',s.sheet&&","return {sheet:!!document.getElementById('pl-root'),ex:acS().ex,step:acStep(),steps:acSteps().map(function(x){ return x[0]; })}; })()`);\nok('E','구독 회원의 다른 거래소: 승인만 남는다',s.sheet&&"],
]);
patch('qa/ex-plan/pl-check.mjs',[
  ["s=await J(`{step:acStep(),guide:!!document.querySelector('#ac-flow .acx-g'),have:(document.querySelector('.acx-have button')||{}).innerText,join:!!document.querySelector('#ac-flow a.acx-a'),steps:document.querySelectorAll('#ac-flow .acx-g li').length}`);\nok('계정 단계: 가입 안내가 기본(가입, 본인 확인, TETH 연결), 작은 링크 \"이미 있습니까\"',s.step==='acct'&&s.guide&&/이미 있습니까/.test(s.have)&&s.join&&s.steps===3,s);","s=await J(`{step:acStep(),guide:!!document.querySelector('#ac-flow .px-steps'),have:(document.querySelector('.acx-have')||{}).innerText,join:!!document.querySelector('#ac-flow a.acx-a'),steps:document.querySelectorAll('#ac-flow .px-steps li').length}`);\nok('계정 단계: 가입 안내가 기본(가입, 본인 확인), 작은 링크 \"기존 초대 계정 연결\"',s.step==='acct'&&s.guide&&/기존 초대 계정 연결/.test(s.have)&&s.join&&s.steps===2,s);"],
  ["ok('전략 시작 직전: 본인 확인 미완료면 막고 안내(연결은 유지)',s.dlg&&/본인 확인을 완료해 주십시오/.test(s.txt)&&s.go===true,{txt:s.txt.slice(0,120)});","ok('전략 시작 직전: 본인 확인 미완료면 막고 안내(연결은 유지)',s.dlg&&/본인 확인/.test(s.txt)&&s.go===true,{txt:s.txt.slice(0,120)});"],
  ["s=await J(`{step:acStep(),txt:${TXT('#ac-sheet #ac-flow')},sheet:!!document.getElementById('ac-sheet')}`); ok('구독 거래소 2곳 뒤 셋째: 한도 안내와 세 갈래',s.step==='limit'&&/연결 한도에 도달/.test(s.txt)&&/구독 추가/.test(s.txt),{step:s.step});\nawait snap('P5-paid-limit');\nawait ev(`acLimitAlt('partner')`); await sleep(500); ok('한도에서 초대 계정으로 → 계정 단계',(await ev(`acStep()`))==='acct'); await ev(`acSheetClose(true)`);","s=await J(`{step:acStep(),page:!!document.getElementById('pl-root')}`); ok('구독 거래소 2곳 뒤 셋째: 한도 없이 승인 화면',s.step==='auth'&&s.page,s);\nawait snap('P5-paid-third');"],
]);
