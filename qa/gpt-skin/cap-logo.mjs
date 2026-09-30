// 사이드바 로고와 TETH 글자 확대 캡처 (원본 비교용)
// 사용: node qa/gpt-skin/cap-logo.mjs [url] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./brand/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
await viewport(p,1440,900,{}); await goto(p,B+'?v='+Date.now(),3000);
const r=await evala(p,`(function(){ var e=document.querySelector('#g-brand-row'); var b=e.getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height,col:getComputedStyle(e.querySelector('.g-word')).color}; })()`);
console.log(r);
await shot(p,OUT+'L1-side-logo.png',{full:false,clip:{x:0,y:0,width:300,height:70,scale:4}});
await goto(p,B.replace('index.html','about/')+'?v='+Date.now(),2500);
await shot(p,OUT+'L2-about-logo.png',{full:false,clip:{x:0,y:0,width:300,height:80,scale:3}});
await closePage(p);
