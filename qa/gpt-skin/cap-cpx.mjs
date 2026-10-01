// 복사한 전략 상세(cpDetailView) 상태별 캡처
// 사용: node qa/gpt-skin/cap-cpx.mjs [url] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./cpx/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
const J=async(x)=>{ try{ return JSON.parse(await evala(p,`JSON.stringify(${x})`)); }catch(e){ return {err:String(e).slice(0,300)}; } };
const hide=`(function(){ var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel,#qa2-panel,#teth-help{display:none!important}'; document.head.appendChild(s); })()`;
const STATES=[['P1-wait','복사한 전략 상세(진입 대기)'],['P2-pos','복사한 전략 상세(포지션 있음)'],['P3-hist','복사한 전략 상세(청산 이력)'],['P4-bal','복사한 전략 상세(자금 이동)']];
for(const [W,H,M] of [[1440,900,false],[390,844,true]]){
  await viewport(p,W,H,{mobile:M});
  for(const [f,name] of STATES){
    await goto(p,B+'?v='+Date.now(),1200); await evala(p,`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tethDev','1')`); await goto(p,B+'?v='+Date.now(),3500);
    await evala(p,`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)); })`);
    await evala(p,`(function(){ var pi=QA_PAGES.findIndex(function(x){ return x[0]==='전략 복사'; }); var ii=QA_PAGES[pi][1].findIndex(function(x){ return x[0]==='${name}'; }); qaRun(pi,ii); })()`);
    await sleep(2200); await evala(p,hide); await sleep(200);
    const sfx=M?'-m':'';
    await shot(p,OUT+f+sfx+'.png',{full:true});
    const s=await J(`{mode:G.mode,h:location.hash,errs:window.__errs,txt:(document.querySelector('.cpx')||{innerText:''}).innerText.replace(/\\s+/g,' ').slice(0,900)}`);
    console.log(W,f,JSON.stringify(s));
  }
}
await closePage(p); process.exit(0);
