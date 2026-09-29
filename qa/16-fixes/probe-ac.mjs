import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
const p=await newPage(); await viewport(p,1440,900,{mobile:false});
await goto(p,'http://127.0.0.1:8765/index.html?v='+Date.now()); await sleep(3500);
await evala(p,`tfQaPreset('02')`); await sleep(1000);
console.log(await evala(p,`(function(){ var t=tfS(); t.ac=null; t.api=null; acS(); acStart({after:{kind:'terminal'}}); var e=document.getElementById('ac-sheet'); var c=getComputedStyle(e); return JSON.stringify({pos:c.position,disp:c.display,z:c.zIndex,par:e.parentNode.tagName+'#'+e.parentNode.id,rect:e.getBoundingClientRect(),sw:getComputedStyle(e.firstChild).width}); })()`));
await closePage(p); process.exit(0);
