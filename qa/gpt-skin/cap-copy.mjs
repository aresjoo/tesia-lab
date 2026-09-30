// 전략 복사 창(mkFollowSheet) 상태별 캡처
// 사용: node qa/gpt-skin/cap-copy.mjs [url] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./copy/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
const J=async(x)=>{ try{ return JSON.parse(await evala(p,`JSON.stringify(${x})`)); }catch(e){ return {err:String(e).slice(0,300)}; } };
const open=async(W,H,M)=>{ await viewport(p,W,H,{mobile:M}); await goto(p,B+'?v='+Date.now(),1200);
  await evala(p,`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now(),2800);
  await evala(p,`var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s); window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)); })`);
  await evala(p,`tfQaPreset('12')`); await sleep(1200);
  const nick=await evala(p,`(function(){ var r=tfSSRows().filter(function(s){ return !s.me&&/양방향|평균선/.test(mkTitle(s)); })[0]||tfSSRows().filter(function(s){ return !s.me; })[0]; return r.nick; })()`);
  await evala(p,`location.hash='#/share/s/'+encodeURIComponent('${nick}')`); await sleep(1500);
  await evala(p,`mkFollowSheet('${nick}')`); await sleep(700); return nick; };
const sfx=(M)=>M?'-m':'';
for(const [W,H,M] of [[1440,900,false],[390,844,true]]){
  const nick=await open(W,H,M);
  await shot(p,OUT+'C1-empty'+sfx(M)+'.png',{full:false});
  await evala(p,`(function(){ var e=document.getElementById('cps-amt'); e.value='50'; cpFormSync(); })()`); await sleep(300);
  await shot(p,OUT+'C2-under-min'+sfx(M)+'.png',{full:false});
  await evala(p,`(function(){ var e=document.getElementById('cps-amt'); e.value='800'; cpFormSync(); var d=document.querySelector('.mk-f-adv'); if(d) d.open=true; })()`); await sleep(400);
  await shot(p,OUT+'C3-filled-adv'+sfx(M)+'.png',{full:false});
  console.log(W, nick, JSON.stringify(await J(`{txt:document.getElementById('mk-follow').innerText.replace(/\\s+/g,' ').slice(0,700),errs:window.__errs}`)));
}
// 거래소 미연결 회원
await viewport(p,1440,900,{}); await goto(p,B+'?v='+Date.now(),1200); await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now(),2800);
await evala(p,`tfQaPreset('02')`); await sleep(1200);
const nk=await evala(p,`tfSSRows().filter(function(s){ return !s.me; })[0].nick`);
await evala(p,`mkFollowSheet('${nk}')`); await sleep(700); await shot(p,OUT+'C4-not-connected.png',{full:false});
await closePage(p);
