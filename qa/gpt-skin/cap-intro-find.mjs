// AI 트레이딩 첫 화면(tfIntroView)과 전략 찾기 목록 캡처
// 사용: node qa/gpt-skin/cap-intro-find.mjs [url] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./intro-find/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
const fresh=async(W,H,M)=>{ await viewport(p,W,H,{mobile:M}); await goto(p,B+'?v='+Date.now(),1200); await evala(p,`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now(),3000);
  await evala(p,`var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s)`); };
for(const [W,H,M] of [[1440,900,false],[390,844,true]]){
  const sx=M?'-m':'';
  // 손님: AI 트레이딩 첫 화면
  await fresh(W,H,M); await evala(p,`location.hash='#/trade'`); await sleep(3500);
  await shot(p,OUT+'I1-intro-guest'+sx+'.png',{full:false});
  await evala(p,`document.getElementById('g-scroll').scrollTop=innerHeight*0.9`); await sleep(1200);
  await shot(p,OUT+'I2-intro-scroll'+sx+'.png',{full:false});
  // 회원(연결 전): 같은 첫 화면
  await fresh(W,H,M); await evala(p,`tfQaPreset('02')`); await sleep(1200); await evala(p,`location.hash='#/trade'`); await sleep(3500);
  await shot(p,OUT+'I3-intro-member'+sx+'.png',{full:false});
  // 전략 찾기
  await evala(p,`tfShareHub()`); await sleep(1800); await evala(p,`document.getElementById('g-scroll').scrollTop=0`); await sleep(400);
  await shot(p,OUT+'F1-find'+sx+'.png',{full:false});
  await evala(p,`document.getElementById('g-scroll').scrollTop=innerHeight*0.8`); await sleep(600);
  await shot(p,OUT+'F2-find-scroll'+sx+'.png',{full:false});
  // 메인(연구 기록) 색 비교용
  await evala(p,`try{ tfHistView&&tfHistView(); }catch(e){}`); await sleep(800);
  await shot(p,OUT+'M1-main'+sx+'.png',{full:false});
}
console.log(await evala(p,`JSON.stringify({intro:typeof tfIntroView,hero:(document.querySelector('.tin-hero h1,.tin h1,h1')||{}).className})`));
await closePage(p);
