// 예약 주문(실제 AI): 빠진 것만 묻기 → 카드 → 예약 → 터미널 미체결 주문 → 취소. 미연결 사용자는 플랜으로.
// 사용: node qa/gpt-skin/order/order-check.mjs [url]
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
await ev(`tfQaPreset('05')`); await sleep(1200);
ok('프리셋 05: 거래소 연결됨',(await ev(`!!tfS().api`))===true);
// 1) 빠진 것이 있는 요청 → 질문 시트
await ev(`gNew('비트코인 오르면 나 대신 팔아줘')`); await sleep(1500);
const asked=await waitFor(`!TAI.busy&&!TAI.req&&(!!document.querySelector('#g-askdock .ska .op')||!!document.querySelector('.od-card'))`,150000); await sleep(800);
let s=await J(`{ask:!!document.querySelector('#g-askdock .ska .op'),card:!!document.querySelector('.od-card'),steps:(function(){ var id=Object.keys(TAI.qcfg||{}).pop(); var st=id&&TAI.qcfg[id]; return st?st.steps.map(function(x){ return x.title+': '+x.options.map(function(o){ return o.t; }).join(', '); }):[]; })(),ans:(function(){ var a=[].slice.call(document.querySelectorAll('#g-thread .g-amsg')).pop(); return a?a.innerText.slice(0,200):''; })()}`);
ok('빠진 것(가격, 수량, 유효 기간)만 묻는다',asked&&s.ask&&s.steps.length>=1&&s.steps.length<=4,s);
ok('유효 기간을 묻는다',s.steps.some(function(x){ return /기간|언제까지|유지|취소/.test(x); }),s.steps);
await shot(p,DIR+'O1-ask.png',{full:false});
// 선택지로 전부 답한다
await ev(`(function(){ var n=0, iv=setInterval(function(){ var b=document.querySelector('#g-askdock .ska .op'); if(!b||n++>8){ clearInterval(iv); return; } b.click(); },700); })()`); await sleep(7000);
const got=await waitFor(`!!document.querySelector('.od-card')`,150000); await sleep(800);
s=await J(`{card:(function(){ var c=document.querySelector('.od-card'); return c?c.innerText.replace(/\\s+/g,' '):''; })(),btn:(document.querySelector('.od-card .tf-btn.p')||{}).innerText,lk:(document.querySelector('.od-card .od-lk')||{}).innerText,tags:/\\[ORDER|\\[STRATEGY/.test((document.getElementById('g-thread')||{}).innerText||''),ans:(function(){ var a=[].slice.call(document.querySelectorAll('#g-thread .g-amsg')).pop(); return a?a.innerText.slice(0,200):''; })()}`);
ok('예약 카드: 문장 하나, 흰 단추 "예약하기", 링크 "조건 바꾸기", 태그 노출 없음',got&&/닿으면|움직이면/.test(s.card)&&/팝니다|삽니다|들어갑니다/.test(s.card)&&s.btn==='예약하기'&&s.lk==='조건 바꾸기'&&!s.tags,s);
ok('카드에 유효 기간과 거리',/유지/.test(s.card),s.card);
await shot(p,DIR+'O2-card.png',{full:false});
// 2) 예약 → 대기 중, 터미널에 조건 대기 행
await ev(`odPlace(document.querySelector('.od-card').id)`); await sleep(800);
s=await J(`{st:(document.querySelector('.od-card .od-st')||{}).innerText,wait:tfS().orders.filter(function(x){ return x.status==='wait'; }).length}`);
ok('예약하기 → 카드가 대기 중, 저장됨',/대기 중/.test(s.st)&&s.wait===1,s);
await shot(p,DIR+'O3-wait.png',{full:false});
await ev(`location.hash='#/trade'`); await sleep(3000);
await ev(`(function(){ var b=[].filter.call(document.querySelectorAll('.tft-botbar .nfxh-tab'),function(x){ return /미체결/.test(x.innerText); })[0]; b&&b.click(); })()`); await sleep(800);
s=await J(`{row:!!document.querySelector('.od-row'),txt:(document.querySelector('.od-row')||{}).innerText}`);
ok('터미널 미체결 주문에 "조건 대기" 행',s.row&&/조건 대기/.test(s.txt||''),s);
await ev(`[].forEach.call(document.querySelectorAll('iframe'),function(f){ f.remove(); })`); await sleep(400); await shot(p,DIR+'O4-terminal.png',{full:false});
await ev(`(function(){ var b=document.querySelector('.od-row .od-cancel'); b&&b.click(); })()`); await sleep(800);
s=await J(`{row:!!document.querySelector('.od-row'),cancel:tfS().orders.filter(function(x){ return x.status==='cancel'; }).length}`);
ok('취소 → 행이 사라지고 상태가 취소',!s.row&&s.cancel===1,s);
const errs1=await J('window.__errs');
// 3) 미연결 사용자: 예약하기 → 플랜
await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3500); await ev(`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); });`); await ev(`tfQaPreset('02')`); await sleep(1000);
await ev(`gNew('테스트')`); await sleep(800); await ev(`TAI.req=null; TAI.busy=false; tfOrderCard({asset:'비트코인',side:'sell',trigger:90000,qty:'all',ttl:'gtc'})`); await sleep(600);
await ev(`odPlace(document.querySelector('.od-card').id)`); await sleep(1500);
s=await J(`{hash:location.hash,pl:!!document.getElementById('pl-root')}`);
ok('미연결 사용자가 예약하기 → 플랜 화면',s.pl||/plan/.test(s.hash),s);
s=await J(`window.__errs`); ok('콘솔 오류 없음',Array.isArray(errs1)&&errs1.length===0&&Array.isArray(s)&&s.length===0,{before:errs1,after:s});
const pass=out.filter(x=>x.startsWith('PASS')).length; out.push('','TOTAL '+pass+' / '+out.length); console.log(out[out.length-1]);
fs.writeFileSync(DIR+'order-check.txt',out.join('\n'));
await closePage(p); process.exit(0);
