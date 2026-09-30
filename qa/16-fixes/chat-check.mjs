// 채팅 한 번을 실제로 보내고 네트워크와 결과를 기록한다. 손님과 회원 둘 다
// 사용: node qa/16-fixes/chat-check.mjs [url] [문장]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
const B=process.argv[2]||'https://aresjoo.github.io/tesia-lab/index.html', Q=process.argv[3]||'gdgd';
const DIR=decodeURIComponent(new URL('./rail/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
const p=await newPage(); await viewport(p,1440,900,{mobile:false});
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'ERR '+String(e).slice(0,300); } };
const HOOK=`(function(){ if(window.__net) return; window.__net=[]; window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); window.addEventListener('unhandledrejection',function(e){ __errs.push('rej '+String(e.reason)); });
  var f0=window.fetch; window.fetch=function(u,o){ var rec={u:String(u).slice(0,120),m:(o&&o.method)||'GET',t:Date.now(),body:o&&o.body?String(o.body).slice(0,1500):''}; __net.push(rec); return f0.apply(this,arguments).then(function(r){ rec.s=r.status; rec.ms=Date.now()-rec.t; if(rec.u.indexOf('/api/chat')>=0){ r.clone().text().then(function(t){ rec.res=t.slice(0,1500); }); } return r; },function(e){ rec.err=String(e); rec.ms=Date.now()-rec.t; throw e; }); }; })()`;
for(const who of (process.argv[4]||'guest,user').split(',')){
  await goto(p,B+'?v='+Date.now()); await sleep(500); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(4000);
  await ev(HOOK);
  if(who==='user'){ await ev(`tfQaPreset('02')`); await sleep(1500); }
  console.log(who,'TAI before',await ev(`JSON.stringify({url:TAI.url,ok:TAI.ok,cfg:window.TETH_CONFIG&&TETH_CONFIG.aiProxy})`));
  await ev(`(function(){ var i=document.getElementById('g-home-in')||document.getElementById('g-in'); i.value=${JSON.stringify(Q)}; i.dispatchEvent(new Event('input',{bubbles:true})); if(document.getElementById('g-home-in')) gNew(); else gSend(); })()`);
  let done='';
  for(let k=0;k<60;k++){ await sleep(1500); done=await ev(`(function(){ var t=document.getElementById('g-thread')||document.body; var e=t.querySelector('.g-errcard'); if(e) return 'ERRCARD'; var a=document.querySelectorAll('.g-ans,.g-msg.ai,.tai-ans,[class*=answer]'); return (window.TAI&&TAI.busy)?'busy':(a.length?'answered':'idle'); })()`); if(done==='ERRCARD'||(done!=='busy'&&k>8)) break; }
  console.log(who,'result',done,'TAI after',await ev(`JSON.stringify({url:TAI.url,ok:TAI.ok,auth:!!document.querySelector('#modal-auth.open,#modal-auth.on')})`));
  console.log(who,'net',await ev(`JSON.stringify(__net.filter(function(x){ return !/\\.(png|jpg|svg|woff2?|css)(\\?|$)/.test(x.u); }))`));
  console.log(who,'errs',await ev(`JSON.stringify(__errs)`));
  console.log(who,'thread',String(await ev(`(document.getElementById('g-thread')||document.querySelector('main')).innerText.replace(/\\s+/g,' ').slice(0,500)`)));
  await shot(p,DIR+'chat-'+who+'.png',{full:false});
}
await closePage(p); process.exit(0);
