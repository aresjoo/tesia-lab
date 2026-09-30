// AI 트레이딩 소개 페이지를 섹션별로 잘라 캡처 (1440, 390)
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./intro/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
for(const [W,M] of [[1440,false],[390,true]]){ const sx=M?'-m':'';
  await viewport(p,W,900,{mobile:M}); await goto(p,B+'?v='+Date.now(),1200); await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now(),3000);
  await evala(p,`var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important} #teth-help{display:none!important}'; document.head.appendChild(s)`);
  await evala(p,`location.hash='#/trade'`); await sleep(3500);
  const tall=await evala(p,`(function(){ var L=[].filter.call(document.querySelectorAll('*'),function(e){ var c=getComputedStyle(e); return (c.overflowY==='auto'||c.overflowY==='scroll')&&e.scrollHeight>e.clientHeight+20; }).sort(function(a,b){ return b.scrollHeight-a.scrollHeight; }); return L[0]?L[0].scrollHeight:innerHeight; })()`);
  await viewport(p,W,Math.min(9000,tall+40),{mobile:M}); await sleep(2200);
  await evala(p,`document.querySelectorAll('.txh *').forEach(function(e){ e.classList.add('in','on','shown','vis'); })`); await sleep(600);
  const R=JSON.parse(await evala(p,`JSON.stringify([].map.call(document.querySelectorAll('.txh-hero,#txh-ai,#txh-now,#txh-how,.txh-sec:last-of-type'),function(s){ var r=s.getBoundingClientRect(); return [Math.round(r.top),Math.round(r.height)]; }))`));
  const names=['S0-hero','S1-ai','S2-now','S3-how','S4-safe'];
  for(let i=0;i<R.length&&i<5;i++){ const [y,h]=R[i]; await shot(p,OUT+names[i]+sx+'.png',{full:false,clip:{x:0,y:Math.max(0,y),width:W,height:Math.max(200,Math.min(h,2400)),scale:1}}); }
  console.log(W,JSON.stringify(R));
}
await closePage(p);
