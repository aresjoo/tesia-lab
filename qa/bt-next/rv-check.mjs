// 나쁜 결과 뒤의 행동: 내 전략(규칙 수정 → 제안 → 다시 검증 → 비교), 복사 전략(다른 전략 만들기), 좋은 결과
// 사용: node qa/bt-next/rv-check.mjs [url]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const DIR=decodeURIComponent(new URL('./r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(DIR,{recursive:true});
const out=[]; const ok=(n,c,i)=>{ out.push((c?'PASS':'FAIL')+' | '+n+(i!==undefined?' | '+JSON.stringify(i).slice(0,500):'')); console.log(out[out.length-1]); };
const p=await newPage(); await viewport(p,1440,900,{mobile:false});
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'ERR '+String(e).slice(0,200); } };
const J=async(x)=>{ try{ return JSON.parse(await ev(`JSON.stringify(${x})`)); }catch(e){ return {}; } };
const waitFor=async(x,ms)=>{ const t=Date.now(); while(Date.now()-t<ms){ if(await ev(x)===true) return true; await sleep(500); } return false; };
await goto(p,B+'?v='+Date.now()); await sleep(600); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3800);
await ev(`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s);`);
await ev(`tfQaPreset('02')`); await sleep(1200);
// 내 전략을 대화에서 만든 것처럼: 세션을 만들고 전략서를 붙인다
await ev(`gNew('비트코인이 크게 빠졌을 때 사서 8% 오르면 파는 전략')`); await sleep(1500);
await waitFor(`!TAI.busy&&!TAI.req`,120000); await sleep(500);
await ev(`tfAiStrategy({asset:'비트코인',depth:'deep',tp:8,sl:-5,fng:45,trend:false,period:'all',name:'괜찮을때만 사는 비트코인'})`); await sleep(800);
let s=await J(`{sess:tfS().aiSpec&&tfS().aiSpec.sess,cur:G.cur&&G.cur.id}`); ok('전략서가 만든 대화의 세션을 기억한다',!!s.sess&&s.sess===s.cur,s);
await shot(p,DIR+'R0-chat-strategy.png',{full:false});
// 백테스트 결과 (나쁨)
await ev(`location.hash='#/share/bt/mine'`); await sleep(2500); await ev(`BT.per=0; btReady(); btCompute(); btFinish()`); await sleep(2500);
s=await J(`{mine:!!BT.s.mine,ret:+BT.R.ret.toFixed(1),bench:+BT.R.benchRet.toFixed(1),bad:rvBad(),btns:[].map.call(document.querySelectorAll('#bt-root .bt-cta, #bt-root .bt-sec, #bt-root .rv-links button'),function(b){ return b.innerText.trim(); }),oldLink:/조건을 바꿔 다시 돌리기/.test(document.getElementById('bt-root').innerText)}`);
ok('내 전략, 나쁜 결과: 규칙 수정하기가 첫 단추, 다른 전략 만들기 없음, 기간 링크 없음',s.mine&&s.bad&&s.btns[0]==='규칙 수정하기'&&s.btns.indexOf('다른 전략 만들기')<0&&!s.oldLink,s);
await ev(`document.getElementById('g-scroll').scrollTop=0`); await sleep(300); await shot(p,DIR+'R2-result-bad-mine.png',{full:false});
// 규칙 수정하기 → 그 대화로, TETH가 먼저 제안
const nAns0=await ev(`document.querySelectorAll('#g-thread .g-amsg').length`); await ev(`rvFix()`); await sleep(1500);
s=await J(`{mode:G.mode,cur:G.cur&&G.cur.id,sess:tfS().aiSpec.sess,card:!!document.querySelector('.an-umsg .rv-card'),line:(document.querySelector('.an-line')||{}).innerText}`);
ok('규칙 수정하기: 만든 대화로 돌아가고 결과 카드가 내 말이 된다',s.mode==='conv'&&s.cur===s.sess&&s.card,s);
// 먼저 TETH가 방향을 묻는다: 질문 패널(선택지, 직접 답변, AI가 알아서 판단), 제안 카드는 아직 없다
const asked=await waitFor(`!!document.querySelector('#g-askdock .ska .op')&&!TAI.busy&&!TAI.req`,120000); await sleep(600);
s=await J(`{prop:!!document.querySelector('.rv-prop'),ops:[].map.call(document.querySelectorAll('#g-askdock .ska .op b'),function(b){ return b.innerText.trim(); }),title:(document.querySelector('#g-askdock .ska .hd b')||{}).innerText,skip:!!document.querySelector('#g-askdock .ska .lk'),ans:[].slice.call(document.querySelectorAll('#g-thread .g-amsg')).pop().innerText.slice(0,300)}`);
ok('규칙 수정하기: TETH가 먼저 어느 쪽을 바꿀지 묻고 선택지 4개, 직접 답변, AI가 알아서 판단이 뜬다',asked&&!s.prop&&s.ops.length>=4&&s.ops.indexOf('직접 답변 작성')>=0&&s.skip&&/니까[?]|까요[?]/.test(s.ans+s.title),s);
await shot(p,DIR+'R3b-chat-ask.png',{full:false});
await ev(`(function(){ var b=document.querySelector('#g-askdock .ska .op'); b&&b.click(); })()`);
const got=await waitFor(`!!document.querySelector('.rv-prop')`,120000);
s=await J(`{prop:!!document.querySelector('.rv-prop'),ans:(function(){ var p=document.querySelector('.rv-prop'); var e=p&&p.previousElementSibling; while(e&&(e.innerText||'').trim().length<80) e=e.previousElementSibling; return e?e.innerText.slice(0,400):''; })(),tags:/\\[STRATEGY|\\[NEXT|\\[ASK/.test((document.getElementById('g-thread')||{}).innerText||''),before:(document.querySelector('.rv-prop .rv-rules div:first-child p')||{}).textContent,after:(document.querySelector('.rv-prop .rv-rules div:last-child p')||{}).textContent,ch:(document.querySelector('.rv-prop .rv-ch')||{}).innerText}`);
ok('TETH가 변경 하나를 제안하고 제안 카드(이전, 이번 규칙)가 붙는다',got&&s.prop&&s.before!==s.after&&!s.tags,{ans:s.ans.slice(0,200),before:s.before,after:s.after});
ok('제안문이 합니다체이고 익절, 손절 용어가 없다',/니다[.]/.test(s.ans)&&!/익절|손절/.test(s.ans),s.ans.slice(0,120));
await ev(`document.getElementById('g-scroll').scrollTop=1e9`); await sleep(400); await shot(p,DIR+'R4-chat-proposal.png',{full:false});
// 다시 검증 → 새 판, 비교
await ev(`(function(){ var b=document.querySelector('.rv-prop .tf-btn.p'); b&&b.click(); })()`); await sleep(2500);
s=await J(`{hash:location.hash,vers:(tfS().btVers||[]).length,phase:BT.phase,per:BT.per}`); ok('수정한 규칙으로 다시 검증하기: 같은 기간으로 바로 재생 시작, 이전 판 저장',s.hash==='#/share/bt/mine'&&s.vers===1&&s.phase==='run'&&s.per===0,s);
await shot(p,DIR+'R5-rerun-running.png',{full:false});
await waitFor(`BT.phase==='result'`,150000); await sleep(1500);
s=await J(`{cmp:!!document.querySelector('.rv-cmp'),same:(document.querySelector('.rv-same')||{}).innerText,rows:[].map.call(document.querySelectorAll('.rv-rows .r'),function(r){ return r.innerText.replace(/\\s+/g,' '); }),rules:[].map.call(document.querySelectorAll('.rv-cmp .rv-rules p'),function(x){ return x.textContent; })}`);
ok('결과에 이전 판과 비교(효과 요약, 수익률, 낙폭, 거래 수, 규칙 전문)가 보인다',s.cmp&&/같은 기간/.test(s.same)&&s.rows.length>=4&&s.rules.length===2&&s.rules[0]!==s.rules[1]&&/수정 후 수익률은/.test(await ev(`(document.querySelector('.rv-sum')||{}).innerText||''`)),s);
ok('이전 규칙으로 돌아가기 단추가 있다',(await ev(`!![].filter.call(document.querySelectorAll('.rv-cmp button'),function(b){ return /이전 규칙으로 돌아가기/.test(b.innerText); }).length`))===true);
await ev(`document.getElementById('g-scroll').scrollTop=0`); await sleep(300); await shot(p,DIR+'R6-result-compare.png',{full:false});
// 복사 전략, 나쁜 결과
await ev(`location.hash='#/share/bt/r1'`); await sleep(2500); await ev(`BT.per=0; btReady(); btCompute(); btFinish()`); await sleep(2500);
s=await J(`{mine:!!BT.s.mine,bad:rvBad(),btns:[].map.call(document.querySelectorAll('#bt-root .bt-cta, #bt-root .bt-sec'),function(b){ return b.innerText.trim(); }),cmp:!!document.querySelector('.rv-cmp')}`);
ok('복사 전략, 나쁜 결과: 이 전략 실행하기만, 다른 전략 만들기와 규칙 수정 없음',!s.mine&&s.bad&&s.btns[0]==='이 전략 실행하기'&&s.btns.indexOf('다른 전략 만들기')<0&&s.btns.indexOf('규칙 수정하기')<0&&!s.cmp,s);
s=await J(`[].map.call(document.querySelectorAll('#bt-root .rv-links button'),function(b){ return b.innerText.trim(); })`);
ok('복사 전략: 아래 링크는 다른 전략 둘러보기',Array.isArray(s)&&s.indexOf('다른 전략 둘러보기')>=0,s);
await ev(`document.getElementById('g-scroll').scrollTop=0`); await sleep(300); await shot(p,DIR+'R3-result-bad-copy.png',{full:false});
// 좋은 결과
await ev(`location.hash='#/share/bt/f1'`); await sleep(2500); await ev(`BT.per=0; btReady(); btCompute(); btFinish()`); await sleep(2500);
s=await J(`{bad:rvBad(),ret:+BT.R.ret.toFixed(0),btns:[].map.call(document.querySelectorAll('#bt-root .bt-cta'),function(b){ return b.innerText.trim(); }),links:[].map.call(document.querySelectorAll('#bt-root .rv-links button'),function(b){ return b.innerText.trim(); })}`);
ok('좋은 결과: 이 전략 실행하기가 첫 단추, 다른 전략 만들기 없음',!s.bad&&s.btns[0]==='이 전략 실행하기'&&s.links.indexOf('다른 전략 만들기')<0,s);
await ev(`document.getElementById('g-scroll').scrollTop=0`); await sleep(300); await shot(p,DIR+'R1-result-good.png',{full:false});
await ev(`rvBrowse()`); await sleep(2000);
s=await J(`{hash:location.hash,bt:!!document.getElementById('bt-root'),cards:document.querySelectorAll('#g-content .mk3-card, #g-content .skf-card, #g-content [class*=skf]').length}`);
ok('다른 전략 둘러보기: 전략 복사 목록으로 이동',!s.bt&&s.cards>0,s);
// 내 전략 결과에서 대화로 돌아가기
await ev(`location.hash='#/share/bt/mine'`); await sleep(2500); await ev(`BT.per=0; btReady(); btCompute(); btFinish()`); await sleep(2500);
s=await J(`[].map.call(document.querySelectorAll('#bt-root .rv-links button'),function(b){ return b.innerText.trim(); })`);
ok('내 전략: 아래 링크에 대화로 돌아가기',Array.isArray(s)&&s.indexOf('대화로 돌아가기')>=0,s);
await ev(`rvChat()`); await sleep(1500);
s=await J(`{mode:G.mode,cur:G.cur&&G.cur.id,sess:tfS().aiSpec.sess,bt:!!document.getElementById('bt-root')}`);
ok('대화로 돌아가기: 그 전략을 만든 대화로 이동',s.mode==='conv'&&s.cur===s.sess&&!s.bt,s);
s=await J(`window.__errs`); ok('콘솔 오류 없음',Array.isArray(s)&&s.length===0,s);
const pass=out.filter(x=>x.startsWith('PASS')).length; out.push('','TOTAL '+pass+' / '+out.length); console.log(out[out.length-1]);
fs.writeFileSync(DIR+'rv-check.txt',out.join('\n'));
await closePage(p); process.exit(0);
