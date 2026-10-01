// 하위 페이지(다운로드, 소개, 정책) 전체 캡처
// 사용: node qa/gpt-skin/cap-sub.mjs [base] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/';
const OUT=process.argv[3]||decodeURIComponent(new URL('./sub/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
const PAGES=[['dl','download/'],['about','about/'],['pol','policies/#privacy']];
for(const [W,H,M] of [[1440,900,false],[390,844,true]]){ const sx=M?'-m':'';
  await viewport(p,W,H,{mobile:M});
  for(const [k,u] of PAGES){
    await goto(p,B+u+(u.includes('#')?'':'?v='+Date.now()),3500);
    await evala(p,`(function(){ var s=document.createElement('style'); s.textContent='#tf-devbtn,#qa2-panel{display:none!important}'; document.head.appendChild(s); })()`);
    const info=await evala(p,`JSON.stringify({h:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,title:document.title,imgs:[].map.call(document.images,function(i){ return i.getAttribute('src')+' '+i.naturalWidth+'x'+i.naturalHeight; })})`);
    console.log(W,k,info);
    await shot(p,OUT+k+sx+'.png',{full:true});
  }
}
await closePage(p); process.exit(0);
