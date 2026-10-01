// 사용량 배너와 설정 > 사용량, 결제의 이번 달 청구: 프리셋별 상태(무료, 초대 계정, 구독, 둘 다)
// 사용: node qa/gpt-skin/usage/usage-check.mjs [url]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const DIR=decodeURIComponent(new URL('./r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(DIR,{recursive:true});
const out=[]; const ok=(n,c,i)=>{ out.push((c?'PASS':'FAIL')+' | '+n+(i!==undefined?' | '+JSON.stringify(i).slice(0,500):'')); console.log(out[out.length-1]); };
const p=await newPage(); await viewport(p,1440,900,{mobile:false});
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'ERR '+String(e).slice(0,200); } };
const J=async(x)=>{ try{ return JSON.parse(await ev(`JSON.stringify(${x})`)); }catch(e){ return {}; } };
const fresh=async(preset)=>{ await goto(p,B+'?v='+Date.now()); await sleep(500); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3500);
  await ev(`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s);`);
  await ev(`tfQaPreset('${preset}')`); await sleep(1000); await ev(`gNew('테스트')`); await sleep(900); await ev(`aiBar()`); await sleep(300); };
const BAR=`{bar:!!document.querySelector('#g-usebar .use-bar'),full:!!document.querySelector('#g-usebar .use-bar.full'),txt:(document.querySelector('#g-usebar .use-bar>span')||{}).innerText,btn:(document.querySelector('#g-usebar .use-go')||{}).innerText,x:!!document.querySelector('#g-usebar .use-x'),m:aiMeter()}`;
let s;
// 무료: 사용량 0 → 배너 없음
await fresh('02'); s=await J(BAR); ok('무료(02): 사용량 0, 배너 없음',!s.bar&&s.m.tier==='FREE'&&s.m.pct===0,s);
// 초대 계정, 사용량 초과(04) → 100% 배너, 끌 수 없음, 단추 "카드 등록", 보내기 막힘
await fresh('04'); s=await J(BAR); ok('초대 계정 초과(04): 100% 배너, 끌 수 없음, 카드 등록',s.bar&&s.full&&!s.x&&s.btn==='카드 등록'&&/모두 썼습니다/.test(s.txt)&&/실행 중인 전략은 계속/.test(s.txt),s);
await shot(p,DIR+'U1-uid-full.png',{full:false});
{ const t0=Date.now(); while(Date.now()-t0<90000&&await ev(`!!(TAI.busy||TAI.req)`)===true) await sleep(500); }
const n0=await ev(`document.querySelectorAll('#g-thread .g-umsg,#g-thread .g-urow').length`);
await ev(`var f=document.getElementById('g-in'); f.value='새 전략 만들어줘'; gSend()`); await sleep(800);
s=await J(`{busy:!!TAI.busy,req:!!TAI.req,n:document.querySelectorAll('#g-thread .g-umsg,#g-thread .g-urow').length,n0:${n0}}`); ok('100%: 새 전략 보내기가 막힌다(말풍선 안 늘고 요청 없음)',!s.busy&&!s.req&&s.n===s.n0,s);
// 초대 계정 80%대: 거래 크레딧을 더해 만든다 → 끌 수 있는 배너
await ev(`bcAppend('charge','volume',2100,'qa','qa-vol-x'+Date.now()); bcAfterChange('volume'); aiBar()`); await sleep(400);
s=await J(BAR); ok('초대 계정 80%대: 끌 수 있는 배너',s.bar&&!s.full&&s.x&&s.m.pct>=80&&s.m.pct<100&&/도달했습니다/.test(s.txt),s);
await shot(p,DIR+'U2-uid-80.png',{full:false});
await ev(`aiDismiss()`); await sleep(300); s=await J(BAR); ok('닫기 → 이번 달에는 다시 뜨지 않음',!s.bar,s);
// 구독만, AI 많이(06) → 100%, 단추 "초대 계정 연결"
await fresh('06'); s=await J(BAR); ok('구독만 초과(06): 100% 배너, 초대 계정 연결',s.bar&&s.full&&s.btn==='초대 계정 연결'&&s.m.tier==='CARD',s);
// 둘 다(08) → 크레딧 추가, 충전하면 배너 해제
await fresh('08'); s=await J(BAR); ok('구독과 초대 계정(08): 80% 이상 배너, 크레딧 추가',s.bar&&s.btn==='크레딧 추가'&&s.m.tier==='CARD_UID'&&s.m.pct>=80,s);
await ev(`location.hash='#/settings/usage'`); await sleep(1200);
s=await J(`{h1:(document.querySelector('#st-main h1')||{}).innerText,pct:(document.querySelector('.use-h span')||{}).innerText,sub:(document.querySelector('.use-sub')||{}).innerText,tab:!![].filter.call(document.querySelectorAll('.stg-ni'),function(b){ return /사용량/.test(b.innerText); }).length,dollar:/\\$/.test((document.getElementById('st-main')||{}).innerText||'')}`);
ok('설정 > 사용량: 퍼센트와 초기화 날짜만, 달러 없음',s.h1==='사용량'&&/%$/.test(s.pct)&&/초기화됩니다/.test(s.sub)&&s.tab&&!s.dollar,s);
await shot(p,DIR+'U3-settings-usage.png',{full:false});
await ev(`stGo('billing')`); await sleep(900);
s=await J(`{line:(function(){ var t=(document.getElementById('st-main')||{}).innerText||''; var m=t.match(/구독 \\$[0-9,]+[^\\n]*= \\$[0-9,]+/); return m?m[0]:''; })()}`);
s.card=await ev(`(function(){ var t=(document.getElementById('st-main')||{}).innerText||''; var m=t.match(/청구 예정 금액은 \\$[0-9,]+입니다[^\\n]*/); return m?m[0]:''; })()`);
ok('결제: 구독 카드 안에 청구 예정 금액과 계산(구독 - 거래 크레딧 = 합계)',/청구 예정 금액은 \$/.test(s.card)&&/구독 \$/.test(s.line),s);
await shot(p,DIR+'U4-settings-billing.png',{full:false});
await ev(`aiTopup()`); await sleep(700); await ev(`aiTopupDo(50)`); await sleep(600);
s=await J(`{bal:bcBalance(),m:aiMeter()}`); ok('크레딧 추가 $50 → 잔액 반영',s.bal>=50||s.m.allow>200,s);
s=await J(`window.__errs`); ok('콘솔 오류 없음',Array.isArray(s)&&s.length===0,s);
const pass=out.filter(x=>x.startsWith('PASS')).length; out.push('','TOTAL '+pass+' / '+out.length); console.log(out[out.length-1]);
fs.writeFileSync(DIR+'usage-check.txt',out.join('\n'));
await closePage(p); process.exit(0);
