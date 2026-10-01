// 백테스트 화면 캡처: 돌리기 전, 도는 중, 결과 (1440, 390)
// 사용: node qa/gpt-skin/cap-bt.mjs [url] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./bt/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
const tallShot=async(W,M,name)=>{ const tall=await evala(p,`(function(){ var L=[].filter.call(document.querySelectorAll('*'),function(e){ var c=getComputedStyle(e); return (c.overflowY==='auto'||c.overflowY==='scroll')&&e.scrollHeight>e.clientHeight+20; }).sort(function(a,b){ return b.scrollHeight-a.scrollHeight; }); return L[0]?L[0].scrollHeight:innerHeight; })()`);
  const HH=Math.min(M?6000:3600,tall+20); await viewport(p,W,HH,{mobile:M}); await sleep(1500); await shot(p,OUT+name+(M?'-m':'')+'.png',{full:false}); await viewport(p,W,900,{mobile:M}); await sleep(600); return tall; };
for(const [W,M] of [[1440,false],[390,true]]){
  await viewport(p,W,900,{mobile:M}); await goto(p,B+'?v='+Date.now(),1200); await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now(),3000);
  await evala(p,`var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel,#teth-help{display:none!important}'; document.head.appendChild(s)`);
  await evala(p,`tfQaPreset('12')`); await sleep(1200);
  const nick=await evala(p,`tfSSRows().filter(function(s){ return !s.me&&/양방향 2배/.test(mkTitle(s)); })[0].nick`);
  await evala(p,`location.hash='#/share/bt/'+encodeURIComponent('${nick}')`); await sleep(2800);
  await shot(p,OUT+'B1-before'+(M?'-m':'')+'.png',{full:false});
  await sleep(4000); await evala(p,`BT.per=0; btReady(); btCompute(); btFinish()`); await sleep(3500);
  await evala(p,`(function(){ var s=document.getElementById('g-scroll'); if(s) s.scrollTop=0; })()`); await sleep(400);
  await shot(p,OUT+'B2-result'+(M?'-m':'')+'.png',{full:false});
  const t=await tallShot(W,M,'B3-result-full');
  console.log(W,nick,t);
}
await closePage(p);
