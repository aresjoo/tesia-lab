// F01-R: 번호를 바꿔 확인하는 도중에 새로고침하면 앞선 번호의 확인이 되살아나는지 본다.
// 사용: node qa/verify-reload.mjs <폴더>
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const round=process.argv[2]||'final3';
const OUT=new URL('./'+round+'/',import.meta.url); fs.mkdirSync(OUT,{recursive:true});
const DIR=decodeURIComponent(OUT.pathname).replace(/^\/([A-Za-z]:)/,'$1');
const log=[]; const p=await newPage(); await viewport(p,1440,900,{mobile:false});
const say=async(l,x)=>{ let v; try{ v=await evala(p,x); }catch(e){ v='ERR '+String(e).slice(0,300); } console.log(l,String(v).slice(0,900)); log.push(l+' '+v); return v; };
const B='http://127.0.0.1:8765/index.html';
const set=async(i,v)=>evala(p,`(function(){ var e=document.getElementById('${i}'); e.value=${JSON.stringify(v)}; e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
const stt=`JSON.stringify({step:btF().step,uid:btF().uid,uidIn:btF().uidIn,okUid:btF().okUid,api:btF().api,field:(document.getElementById('btg-uid')||{value:null}).value,sums:[].map.call(document.querySelectorAll('#btg-flow .btg-st'),function(x){ return x.className.replace('btg-st ','')+':'+x.querySelector('.sh').innerText.replace(/\\s+/g,' '); })})`;
await goto(p,B+'?v='+Date.now()); await sleep(1200);
await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(2500);
await evala(p,`tfQaPreset('02')`); await sleep(1500);
await evala(p,`location.hash='#/share/bt/h3'`); await sleep(2000); await evala(p,`btStart()`); await sleep(300); await evala(p,`btSkip()`); await sleep(1200);
await evala(p,`btUse()`); await sleep(1500);
await evala(p,`document.querySelector('.btg-opt input[value=partner]').click()`); await sleep(200); await evala(p,`btPickGo()`); await sleep(900);
await set('btg-uid','38291042'); await evala(p,`btUidGo()`); await sleep(3200);
await say('0 first uid verified',stt);
let fails=0;
const reload=async()=>{ await goto(p,B+'?r='+Date.now()+'#/share/bt/h3/go'); await sleep(3500); };
for(const [uid,wait] of [['55512345',150],['77712345',60],['66612345',400],['88812345',1100]]){
  // 화면의 바꾸기 단추로 번호 단계를 연다
  await evala(p,`(function(){ var b=[].filter.call(document.querySelectorAll('#btg-flow .btg-st'),function(x){ return /제휴 계정 확인/.test(x.innerText); })[0].querySelector('.ed'); if(b) b.click(); })()`); await sleep(600);
  await set('btg-uid',uid); await evala(p,`document.getElementById('btg-go').click()`); await sleep(wait);
  await reload();
  const v=JSON.parse(await say('reload '+wait+'ms after '+uid,stt));
  const bad=v.okUid||v.uid||v.api||v.step!=='uid'||v.field!==uid; if(bad) fails++;
  log.push('  => '+(bad?'FAIL':'PASS')); console.log('  =>',bad?'FAIL':'PASS');
  if(wait===150) await shot(p,DIR+'F01R-reload-150ms.png',{full:false});
  // 다음 회차를 위해 이 번호를 끝까지 확인한다
  await evala(p,`document.getElementById('btg-go').click()`); await sleep(3200);
  await say(' then verified',stt);
}
// 연결까지 마친 뒤 새로고침: 완료가 남아야 한다
await set('btg-ak','bg_x91k27QmT4vZ8r'); await set('btg-as','s3cr3t-Qw81kd02LmPz77'); await evala(p,`btApiGo()`); await sleep(4200);
await reload(); const d=JSON.parse(await say('reload after full connection',stt)); if(d.step!=='done'||d.uid!=='88812345') fails++;
// 완료 뒤 거래소를 바꾸는 도중 새로고침
await evala(p,`(function(){ var f=btF(); f.step='uid'; btSave(); btGoRe(); })()`); await sleep(600);
await evala(p,`(function(){ var b=document.querySelectorAll('.btg-exs button'); for(var i=0;i<b.length;i++) if(b[i].getAttribute('aria-checked')==='false'){ b[i].click(); break; } })()`); await sleep(80);
await reload(); const e=JSON.parse(await say('reload 80ms after exchange change',stt)); if(e.okUid||e.api||e.uid) fails++;
await shot(p,DIR+'F01R-reload-after-exchange-change.png',{full:false});
await say('errs',`JSON.stringify(window.__errs||[])`);
console.log('FAILS',fails); log.push('FAILS '+fails);
fs.writeFileSync(DIR+'verify-reload-log.txt',log.join('\n'));
await closePage(p); process.exit(0);
