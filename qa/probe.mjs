// 겹침 확인: 고정 요소가 실행 버튼이나 전략 요약을 덮는지 본다
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
const W=+(process.argv[2]||1280), H=+(process.argv[3]||800), go=process.argv[4]==='go';
const p=await newPage(); await viewport(p,W,H,{mobile:W<700});
const B='http://127.0.0.1:8765/index.html';
await goto(p,B+'?v='+Date.now()); await sleep(1200);
await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(2500);
await evala(p,`tfQaPreset('02')`); await sleep(900);
await evala(p,`location.hash='#/share/bt/h3'`); await sleep(2000);
await evala(p,`btStart()`); await sleep(400); await evala(p,`btSkip&&btSkip()`); await sleep(1500);
if(go){ await evala(p,`btUse()`); await sleep(1500); }
const r=await evala(p,`(function(){ var out=[], t=document.querySelector(${go?"'.btg-me'":"'#bt-rail .bt-cta, .bt-cta'"}); var tr=t.getBoundingClientRect();
  [].forEach.call(document.querySelectorAll('body *'),function(e){ var cs=getComputedStyle(e); if(cs.position!=='fixed'&&cs.position!=='sticky'&&cs.position!=='absolute') return; var b=e.getBoundingClientRect(); if(b.width<20||b.width>120||b.height<20||b.height>120) return; if(b.right<tr.left||b.left>tr.right||b.bottom<tr.top||b.top>tr.bottom) return; if(t.contains(e)) return; out.push({id:e.id,cls:String(e.className).slice(0,80),tag:e.tagName,pos:cs.position,r:[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)],par:(e.parentElement.id||'')+'.'+String(e.parentElement.className).slice(0,60)}); });
  return JSON.stringify({target:[Math.round(tr.left),Math.round(tr.top),Math.round(tr.width),Math.round(tr.height)],phase:BT.phase,out:out}); })()`);
console.log(r);
await shot(p,process.argv[5]||'C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/probe.png',{full:false});
await closePage(p); process.exit(0);
