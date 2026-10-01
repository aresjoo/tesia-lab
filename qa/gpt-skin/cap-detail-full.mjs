// 전략 상세 화면 전체를 한 장으로, 그리고 부분별로 (1440, 390)
// 사용: node qa/gpt-skin/cap-detail-full.mjs [url] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./detail/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
for(const [W,M] of [[1440,false],[390,true]]){ const sx=M?'-m':'';
  await viewport(p,W,900,{mobile:M}); await goto(p,B+'?v='+Date.now(),1200); await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now(),3000);
  await evala(p,`var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel,#teth-help{display:none!important}'; document.head.appendChild(s)`);
  await evala(p,`tfQaPreset('12')`); await sleep(1200);
  const nick=await evala(p,`tfSSRows().filter(function(s){ return !s.me&&/양방향 2배/.test(mkTitle(s)); })[0].nick`);
  await evala(p,`location.hash='#/share/s/'+encodeURIComponent('${nick}')`); await sleep(2800);
  const tall=await evala(p,`(function(){ var L=[].filter.call(document.querySelectorAll('*'),function(e){ var c=getComputedStyle(e); return (c.overflowY==='auto'||c.overflowY==='scroll')&&e.scrollHeight>e.clientHeight+20; }).sort(function(a,b){ return b.scrollHeight-a.scrollHeight; }); return L[0]?L[0].scrollHeight:innerHeight; })()`);
  const content=await evala(p,`Math.round((document.querySelector('#g-content .gft')||document.querySelector('#gft-slot')||{getBoundingClientRect:function(){return {top:0};}}).getBoundingClientRect().top)||0`);
  const HH=Math.min(M?7000:5000,(content>200?content:tall)+20);
  await viewport(p,W,HH,{mobile:M}); await sleep(2500);
  await shot(p,OUT+'D0-full'+sx+'.png',{full:false});
  // 부분: 900 높이씩
  for(let i=0;i*900<HH&&i<6;i++){ await shot(p,OUT+'D0-part'+(i+1)+sx+'.png',{full:false,clip:{x:0,y:i*900,width:W,height:Math.min(900,HH-i*900),scale:1}}); }
  console.log(W,nick,tall,content,HH);
}
await closePage(p);
