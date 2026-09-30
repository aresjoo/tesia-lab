// 사용자의 말과 전략 카드가 맞는지(실제 AI): RSI 숫자 그대로, 계산 못 하는 조건은 "검증에서 뺀 조건", 질문 시트는 입력창을 덮는다
// 사용: node qa/gpt-skin/ask/intent-check.mjs [url]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const DIR=decodeURIComponent(new URL('./r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(DIR,{recursive:true});
const out=[]; const ok=(n,c,i)=>{ out.push((c?'PASS':'FAIL')+' | '+n+(i!==undefined?' | '+JSON.stringify(i).slice(0,600):'')); console.log(out[out.length-1]); };
const p=await newPage(); await viewport(p,1440,900,{mobile:false});
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'ERR '+String(e).slice(0,200); } };
const J=async(x)=>{ try{ return JSON.parse(await ev(`JSON.stringify(${x})`)); }catch(e){ return {}; } };
const waitFor=async(x,ms)=>{ const t=Date.now(); while(Date.now()-t<ms){ if(await ev(x)===true) return true; await sleep(500); } return false; };
await goto(p,B+'?v='+Date.now()); await sleep(600); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3800);
await ev(`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s);`);
await ev(`tfQaPreset('02')`); await sleep(1200);
// 1) 조건을 다 말한 요청: 질문 없이 카드, RSI 10 그대로, 레버리지와 1분은 뺀 조건으로
await ev(`gNew('비트코인 레버리지 20배로 RSI 10 미만일때만 구매하는 전략 만들어줘. 1분마다 확인해서. 15% 오르면 팔고 5% 내리면 팔고, 최근 2년으로 검증')`); await sleep(1500);
await waitFor(`!!document.querySelector('#g-thread .tf-sum')||(!TAI.busy&&!TAI.req&&!!document.querySelector('#g-askdock .ska'))`,150000); await sleep(1500);
let s=await J(`{card:(function(){ var c=[].slice.call(document.querySelectorAll('#g-thread .tf-sum')).pop(); return c?c.innerText.replace(/\\s+/g,' '):''; })(),ask:!!document.querySelector('#g-askdock .ska'),ans:(function(){ var a=[].slice.call(document.querySelectorAll('#g-thread .g-amsg')).pop(); return a?a.innerText.slice(0,400):''; })()}`);
ok('RSI 10 미만이 카드에 그대로(RSI가 10 아래로)',/RSI가 10 아래/.test(s.card),s);
ok('레버리지 20배와 1분 확인은 "검증에서 뺀 조건"으로 드러난다',/검증에서 뺀 조건/.test(s.card)&&/20배/.test(s.card)&&/1분/.test(s.card),s.card);
ok('말한 값(+15%, -5%, 최근 2년)이 카드에 그대로',/\+15%/.test(s.card)&&/-5%/.test(s.card)&&/2년/.test(s.card),s.card);
ok('답변이 뺀 조건을 밝힌다',/레버리지|1분/.test(s.ans),s.ans);
await ev(`document.getElementById('g-scroll').scrollTop=1e9`); await sleep(400); await shot(p,DIR+'I1-card.png',{full:false});
// 2) 빠진 것이 있는 요청: 질문 시트가 입력창을 덮고, 선택지가 사용자의 말(RSI)로
await ev(`gNew('이더리움 RSI 낮을 때 사는 전략 만들어줘')`); await sleep(1500);
const asked=await waitFor(`!TAI.busy&&!TAI.req&&(!!document.querySelector('#g-askdock .ska .op')||!!document.querySelector('#g-thread .tf-sum'))`,150000); await sleep(800);
s=await J(`{ask:!!document.querySelector('#g-askdock .ska .op'),composerHidden:(function(){ var c=document.querySelector('.g-composer'); return !c||getComputedStyle(c).display==='none'; })(),steps:(function(){ var id=Object.keys(TAI.qcfg||{}).pop(); var st=id&&TAI.qcfg[id]; return st?st.steps.map(function(x){ return x.title+': '+x.options.map(function(o){ return o.t; }).join(', '); }):[]; })()}`);
ok('빠진 것만 묻고, 질문 중에는 입력창이 시트에 가려진다',asked&&s.ask&&s.composerHidden,s);
ok('사는 때 선택지가 사용자의 말(RSI)로',!s.steps.some(function(x){ return /사시겠|살 때|사는/.test(x); })||s.steps.some(function(x){ return /RSI/.test(x); }),s.steps);
await shot(p,DIR+'I2-ask-sheet.png',{full:false});
// 선택지로 답하면 요약 말풍선은 어두운 색
await ev(`(function(){ var n=0, iv=setInterval(function(){ var b=document.querySelector('#g-askdock .ska .op'); if(!b||n++>8){ clearInterval(iv); return; } b.click(); },700); })()`); await sleep(7000);
await waitFor(`!!document.querySelector('#g-thread .g-usum')`,20000);
s=await J(`(function(){ var u=[].slice.call(document.querySelectorAll('#g-thread .g-usum')).pop(); return u?getComputedStyle(u).backgroundColor:''; })()`);
ok('선택지 답 요약 말풍선이 어두운 색',typeof s==='string'&&/rgb\((\d+), (\d+), (\d+)\)/.test(s)&&Number(s.match(/\d+/)[0])<80,s);
await waitFor(`!TAI.busy&&!TAI.req`,150000); await sleep(800);
await ev(`document.getElementById('g-scroll').scrollTop=1e9`); await sleep(400); await shot(p,DIR+'I3-after-answer.png',{full:false});
s=await J(`window.__errs`); ok('콘솔 오류 없음',Array.isArray(s)&&s.length===0,s);
const pass=out.filter(x=>x.startsWith('PASS')).length; out.push('','TOTAL '+pass+' / '+out.length); console.log(out[out.length-1]);
fs.writeFileSync(DIR+'intent-check.txt',out.join('\n'));
await closePage(p); process.exit(0);
