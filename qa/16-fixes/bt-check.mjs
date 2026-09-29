// R02, R03, R04: 실제 AI 호출이 들어간 백테스트 한 번을 끝까지 돌려 본다
// 사용: node qa/16-fixes/bt-check.mjs <폴더> [전략 id] [기간]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const round=process.argv[2]||'round-1', id=process.argv[3]||'h1', per=process.argv[4]||'365';
const OUT=new URL('./'+round+'/',import.meta.url); fs.mkdirSync(OUT,{recursive:true});
const DIR=decodeURIComponent(OUT.pathname).replace(/^\/([A-Za-z]:)/,'$1');
const log=[]; const p=await newPage(); await viewport(p,1440,900,{mobile:false});
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ const m='ERR '+String(e).slice(0,260); log.push(m); console.log(m); return null; } };
const say=async(l,x)=>{ const v=await ev(x); console.log(l,String(v).slice(0,1400)); log.push(l+' '+v); return v; };
const B='http://127.0.0.1:8765/index.html';
await goto(p,B+'?v='+Date.now()); await sleep(800); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3800);
await ev(`tfQaPreset('02')`); await sleep(1200);
await ev(`(function(){ var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s); window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); })()`);
await ev(`location.hash='#/share/bt/${id}'`); await sleep(2200);
await ev(`BT.per=${per}; btReady()`); await sleep(600);
await say('skip control',`JSON.stringify({skipBtn:!!document.querySelector('.bt-skip'),txt:/바로 결과 보기/.test(document.body.innerText)})`);
const t0=Date.now(); await ev(`btStart()`);
let shots=0, lastJ='';
for(let k=0;k<200;k++){
  const s=JSON.parse(await ev(`JSON.stringify({phase:BT.phase,pause:BT.pause,j:BT.j,N:BT.R.N,pj:(document.getElementById('bt-pj')||{}).textContent||'',cls:(document.getElementById('bt-pjw')||{}).className||''})`)||'{}');
  if(s.phase!=='run') break;
  if(s.pause&&/on/.test(s.cls)&&s.pj.length>60&&s.pj!==lastJ&&!/rest/.test(s.cls)){ const full=await ev(`(function(){ var st=BT.R.stops.filter(function(x){ return x.jShown; }).pop(); var d=st&&(st.ds.filter(function(x){ return x.k==='buy'; })[0]||st.ds[0]); return d&&d.jt?btYMD(d.i)+' '+d.act+' :: '+d.jt:''; })()`); if(full&&full!==lastJ&&shots<4){ lastJ=full; shots++; await sleep(1500); await shot(p,DIR+'R04-judgment-'+shots+'-'+id+'.png',{full:false}); log.push('R04 judgment '+shots+' '+full); console.log('R04 judgment',shots,full); } }
  if(k===6) await shot(p,DIR+'R04-early-'+id+'.png',{full:false});
  await sleep(500);
}
const total=Date.now()-t0; console.log('replay ms',total); log.push('replay ms '+total);
await sleep(800); await shot(p,DIR+'R02-reading-loading-'+id+'.png',{full:false});
for(let k=0;k<60;k++){ const st=await ev(`(document.getElementById('bt-read')||{}).className||''`); if(/ ok| fail/.test(st)) break; await sleep(700); }
await say('R02 reading',`JSON.stringify({cls:document.getElementById('bt-read').className,txt:document.getElementById('bt-read').innerText.replace(/\\s+/g,' ')})`);
await say('R02 facts',`JSON.stringify(btReadFacts())`);
await ev(`var g=document.getElementById('g-scroll'); if(g) g.scrollTop=0`); await sleep(300); await shot(p,DIR+'R02-result-'+id+'.png',{full:false});
await ev(`document.getElementById('bt-dec').scrollIntoView({block:'start'}); document.getElementById('g-scroll').scrollTop-=70`); await sleep(500);
await say('R03 summary',`JSON.stringify({s4:[].map.call(document.querySelectorAll('.bt-s4 button'),function(b){ return b.innerText.replace(/\\s+/g,' '); }),rows:document.querySelectorAll('#bt-dl .bt-row').length,groups:document.querySelectorAll('#bt-dl .bt-ym').length,more:(document.querySelector('#bt-dl .bt-more')||{innerText:''}).innerText,first:[].slice.call(document.querySelectorAll('#bt-dl .bt-row')).slice(0,3).map(function(r){ return r.innerText.replace(/\\s+/g,' '); })})`);
await shot(p,DIR+'R03-decisions-'+id+'.png',{full:false});
await ev(`(function(){ var b=document.querySelector('#bt-dl .bt-row .bt-rb'); if(b) b.click(); })()`); await sleep(600);
for(let k=0;k<40;k++){ const st=await ev(`(document.querySelector('.bt-jb')||{}).className||''`); if(/ ok| fail/.test(st)||!st) break; await sleep(600); }
await ev(`var r=document.querySelector('.bt-row.on'); if(r) r.scrollIntoView({block:'start'}); document.getElementById('g-scroll').scrollTop-=90`); await sleep(500);
await say('R03 open row',`JSON.stringify({pin:document.getElementById('bt-pin')&&document.getElementById('bt-pin').classList.contains('on'),txt:(document.querySelector('.bt-row.on')||{innerText:''}).innerText.replace(/\\s+/g,' ').slice(0,700)})`);
await shot(p,DIR+'R03-decision-open-'+id+'.png',{full:false});
await ev(`btSort('big')`); await sleep(500); await say('R03 sort big',`[].slice.call(document.querySelectorAll('#bt-dl .bt-row')).slice(0,3).map(function(r){ return r.innerText.replace(/\\s+/g,' ').slice(0,90); }).join(' || ')`);
await say('errs',`JSON.stringify(window.__errs||[])`);
fs.writeFileSync(DIR+'bt-check-'+id+'.txt',log.join('\n'));
await closePage(p); process.exit(0);
