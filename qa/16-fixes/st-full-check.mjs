// 설정 전체 화면: 들어가면 앱 사이드바가 사라지고, 나오면 돌아오는지. 폭별 캡처
// 사용: node qa/16-fixes/st-full-check.mjs [url]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const DIR=decodeURIComponent(new URL('./rail/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
const out=[]; const ok=(n,c,i)=>{ out.push((c?'PASS':'FAIL')+' | '+n+(i!==undefined?' | '+JSON.stringify(i):'')); console.log(out[out.length-1]); };
const p=await newPage();
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'ERR '+String(e).slice(0,200); } };
const J=async(x)=>{ try{ return JSON.parse(await ev(`JSON.stringify(${x})`)); }catch(e){ return {}; } };
const vis=`{full:document.body.classList.contains('st-full'),side:getComputedStyle(document.getElementById('g-side')).display!=='none',nav:(function(){ var n=document.querySelector('.stg-nav'); if(!n) return null; var r=n.getBoundingClientRect(); return {x:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}; })(),main:(function(){ var m=document.querySelector('.stg-main'); if(!m) return null; var r=m.getBoundingClientRect(); return {x:Math.round(r.left),w:Math.round(r.width)}; })(),mode:G.mode,hash:location.hash,errs:window.__errs}`;
for(const [W,H] of [[1440,900],[2000,1025],[390,844]]){
  await viewport(p,W,H,{mobile:W<700});
  await goto(p,B+'?v='+Date.now()); await sleep(600); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3800);
  await ev(`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)); })`);
  await ev(`tfQaPreset('02')`); await sleep(1300);
  await ev(`location.hash='#/settings/general'`); await sleep(1300);
  let s=await J(vis); ok(W+': 설정에 들어가면 앱 사이드바가 사라진다',s.full&&!s.side,s);
  if(W>900) ok(W+': 설정 메뉴가 왼쪽 끝 전체 높이',s.nav&&s.nav.x===0&&s.nav.h>=H-2,s.nav);
  await shot(p,DIR+'st-full-'+W+'.png',{full:false});
  await ev(`stGo('notify')`); await sleep(900); await shot(p,DIR+'st-full-notify-'+W+'.png',{full:false});
  await ev(`stBack()`); await sleep(1000); s=await J(vis); ok(W+': 앱으로 돌아가기 → 사이드바 복귀',!s.full&&s.mode==='home',{full:s.full,mode:s.mode});
  await ev(`location.hash='#/settings/account'`); await sleep(1000); await ev(`tfBrokersView()`); await sleep(1200); s=await J(vis); ok(W+': 설정의 거래소 연결 → 사이드바 복귀',!s.full&&s.mode==='tfbrokers',{full:s.full,mode:s.mode});
  await ev(`location.hash='#/trade'`); await sleep(1200); await ev(`location.hash='#/settings/billing'`); await sleep(1000); await ev(`history.back()`); await sleep(1300); s=await J(vis); ok(W+': 설정에서 브라우저 뒤로 → 이전 화면과 사이드바 복귀',!s.full&&s.hash==='#/trade',{full:s.full,mode:s.mode,hash:s.hash});
  s=await J(`window.__errs`); ok(W+': 콘솔 오류 없음',Array.isArray(s)&&!s.length,s);
}
const pass=out.filter(x=>x.startsWith('PASS')).length; out.push('','TOTAL '+pass+' / '+(out.length)); console.log(out[out.length-1]);
fs.writeFileSync(DIR+'st-full-check.txt',out.join('\n'));
await closePage(p); process.exit(0);
