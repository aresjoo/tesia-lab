// QA 프리셋 12~15 로 결제, 보안, 거래소 연결, AI 트레이딩 화면을 찍는다
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const DIR=decodeURIComponent(new URL('./presets/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(DIR,{recursive:true});
const p=await newPage(); await viewport(p,1440,900,{mobile:false}); const log=[];
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'ERR '+String(e).slice(0,200); } };
await goto(p,B+'?v='+Date.now()); await sleep(600); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3800);
await ev(`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s);`);
for(const id of ['02','12','13','14','15']){
  await ev(`tfQaPreset('${id}')`); await sleep(900);
  const st=await ev(`JSON.stringify({acc:acAccess(),conn:Object.keys(acS().conn),ready:acReady(null),cards:acS().cards.length,bill:acS().bill.length})`); console.log(id,st); log.push(id+' '+st);
  for(const [name,go] of [['billing',`location.hash='#/settings/billing'`],['security',`location.hash='#/settings/security'`],['account',`location.hash='#/settings/account'`],['brokers',`stBack(); setTimeout(function(){ tfBrokersView(); },200)`],['trade',`stBack(); setTimeout(function(){ location.hash='#/trade'; },200)`]]){
    await ev(`history.replaceState(null,'',location.pathname); gHome()`); await sleep(400); await ev(go); await sleep(1500);
    await shot(p,DIR+'p'+id+'-'+name+'.png',{full:false});
    if(name==='billing'||name==='security'){ await ev(`var g=document.getElementById('g-scroll'); if(g) g.scrollTop=g.scrollHeight`); await sleep(300); await shot(p,DIR+'p'+id+'-'+name+'-2.png',{full:false}); }
  }
  await ev(`history.replaceState(null,'',location.pathname); gHome()`); await sleep(300);
}
console.log('errs',await ev(`JSON.stringify(window.__errs)`));
fs.writeFileSync(DIR+'log.txt',log.join('\n'));
await closePage(p); process.exit(0);
