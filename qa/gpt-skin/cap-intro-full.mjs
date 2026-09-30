// AI 트레이딩 소개 페이지 전체를 한 장으로 (손님, 1440과 390)
// 사용: node qa/gpt-skin/cap-intro-full.mjs [url] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./intro/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
for(const [W,H,M] of [[1440,900,false],[390,844,true]]){ const sx=M?'-m':'';
  await viewport(p,W,H,{mobile:M}); await goto(p,B+'?v='+Date.now(),1200); await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now(),3000);
  await evala(p,`var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important} #teth-help{display:none!important}'; document.head.appendChild(s)`);
  await evala(p,`location.hash='#/trade'`); await sleep(3500);
  const tall=await evala(p,`(function(){ var L=[].filter.call(document.querySelectorAll('*'),function(e){ var c=getComputedStyle(e); return (c.overflowY==='auto'||c.overflowY==='scroll')&&e.scrollHeight>e.clientHeight+20; }).sort(function(a,b){ return b.scrollHeight-a.scrollHeight; }); return L[0]?L[0].scrollHeight:innerHeight; })()`);
  const HH=Math.min(M?9000:7000,tall+40);
  await viewport(p,W,HH,{mobile:M}); await sleep(2500);
  // 화면에 들어오면 나타나는 요소를 모두 보이게
  await evala(p,`document.querySelectorAll('.txh *').forEach(function(e){ e.classList.add('in','on','shown','vis'); })`); await sleep(800);
  await shot(p,OUT+'T0-full'+sx+'.png',{full:false});
  const secs=await evala(p,`JSON.stringify([].map.call(document.querySelectorAll('.txh section,.txh-sec'),function(s){ var h=s.querySelector('h1,h2'); return (s.id||s.className).toString().slice(0,30)+' | '+(h?h.innerText.replace(/\\s+/g,' '):''); }))`);
  console.log(W,tall,secs);
}
await closePage(p);
