// 차트 색 통일 검증 캡처: 전략 상세 수익률 차트, 손익 달력, 백테스트 잔고 차트, 판단 기록, 월별 수익률
// 사용: node qa/gpt-skin/cap-chart.mjs [url] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./chart/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
const hide=`(function(){ var s=document.createElement('style'); s.textContent='#tf-devbtn,#qa2-panel,#teth-help,.g-app-banner{display:none!important}'; document.head.appendChild(s); })()`;
const run=async(pg,it)=>evala(p,`(function(){ var pi=QA_PAGES.findIndex(function(x){ return x[0]==='${pg}'; }); var ii=QA_PAGES[pi][1].findIndex(function(x){ return x[0]==='${it}'; }); qaRun(pi,ii); })()`);
const at=async(sel,name,pad=24)=>{ const ok=await evala(p,`(function(){ var e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; e.scrollIntoView({block:'start'}); var sc=document.getElementById('g-scroll'); if(sc) sc.scrollTop-=${pad}; return true; })()`); await sleep(700); if(ok) await shot(p,OUT+name,{full:false}); return ok; };
for(const [W,H,M] of [[1440,900,false],[390,844,true]]){ const sx=M?'-m':'';
  await viewport(p,W,H,{mobile:M});
  await goto(p,B+'?v='+Date.now(),1200); await evala(p,`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now(),3500);
  await evala(p,`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)); })`);
  await run('전략 복사','상세 개요'); await sleep(3500); await evala(p,hide);
  console.log(W,'detail chart',await at('.mkd-chart','C1-detail-chart'+sx+'.png',120));
  console.log(W,'calendar',await at('.cal-g','C2-calendar'+sx+'.png',140));
  await run('백테스트','결과(좋음)'); await sleep(7000); await evala(p,hide);
  console.log(W,'bt chart',await at('#bt-chart','C3-bt-chart'+sx+'.png',160));
  console.log(W,'bt log',await at('.bt-list.v2, #bt-ev','C4-bt-log'+sx+'.png',80));
  console.log(W,'bt month',await at('.skb-mtw, .skb-mt-short','C5-bt-month'+sx+'.png',120));
  console.log(W,'state',await evala(p,`JSON.stringify({ym:document.querySelectorAll('#bt-root .bt-ym').length, ymShown:[].filter.call(document.querySelectorAll('#bt-root .bt-ym'),function(e){ return getComputedStyle(e).display!=='none'; }).length, greenLine:!!document.querySelector('#bt-chart path[stroke="#2fb98a"]'), lineColor:(function(){ var e=document.querySelector('#bt-chart path[stroke="#2fb98a"]'); return e?getComputedStyle(e).stroke:null; })(), grad:(function(){ var e=document.querySelector('#bt-chart path[fill="url(#btgu)"]'); return e?getComputedStyle(e).display:null; })(), errs:window.__errs})`));
}
await closePage(p); process.exit(0);
