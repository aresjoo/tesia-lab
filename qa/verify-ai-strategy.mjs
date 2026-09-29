// 대화 한 문장 → AI 전략서([STRATEGY] 태그) → 카드 → 실제 시세 백테스트까지 실제 AI 로 돌려 본다.
// 사용: node qa/verify-ai-strategy.mjs <폴더> "<문장>"
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const round=process.argv[2]||'ai', Q=process.argv[3]||'비트코인이 크게 빠지면 사서 15% 오르면 팔고 7% 빠지면 손절해줘. 공포 지수 25 아래일 때만 사';
const OUT=new URL('./'+round+'/',import.meta.url); fs.mkdirSync(OUT,{recursive:true});
const DIR=decodeURIComponent(OUT.pathname).replace(/^\/([A-Za-z]:)/,'$1');
const log=[]; const p=await newPage(); await viewport(p,1440,900,{mobile:false});
const say=async(l,x)=>{ let v; try{ v=await evala(p,x); }catch(e){ v='ERR '+String(e).slice(0,300); } console.log(l,String(v).slice(0,900)); log.push(l+' '+v); return v; };
const B='http://127.0.0.1:8765/index.html';
await goto(p,B+'?v='+Date.now()); await sleep(1000); await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(6000);
await evala(p,`tfQaPreset('02')`); await sleep(1200);
await evala(p,`(function(){ var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s); window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)); }); })()`);
await evala(p,`location.hash=''`); await sleep(800);
await evala(p,`gNew(${JSON.stringify(Q)})`);
let k=0; for(;k<60;k++){ await sleep(2500); const b=await evala(p,`JSON.stringify({busy:!!TAI.busy,card:!!document.querySelector('[id^=tfai]')})`); const s=JSON.parse(b); if(!s.busy&&k>2) break; }
await sleep(2500);
await say('raw tag',`(TAI.lastRaw||'').match(/\\[STRATEGY[^\\]]*\\]/)?(TAI.lastRaw||'').match(/\\[STRATEGY[^\\]]*\\]/)[0]:'NO TAG: '+(TAI.lastRaw||'').slice(-300)`);
await say('answer',`(document.getElementById('g-thread')||document.body).innerText.replace(/\\s+/g,' ').slice(-900)`);
await say('card',`(document.querySelector('[id^=tfai]')||{innerText:'NO CARD'}).innerText.replace(/\\s+/g,' ')`);
await say('spec',`JSON.stringify(tfS().aiSpec)`);
await evala(p,`var c=document.querySelector('[id^=tfai]'); if(c) c.scrollIntoView({block:'center'})`); await sleep(400);
await shot(p,DIR+'A01-chat-card.png',{full:false});
await evala(p,`var b=document.querySelector('[id^=tfai] .tf-btn'); if(b) b.click()`); await sleep(2200);
await say('bt ready',`JSON.stringify({hash:location.hash,name:(document.querySelector('.bt-hd, .bt h1, .bt-top')||{innerText:''}).innerText.replace(/\\s+/g,' ').slice(0,200),rules:(document.getElementById('bt-rail')||{innerText:''}).innerText.replace(/\\s+/g,' ').slice(0,500)})`);
await shot(p,DIR+'A02-ready.png',{full:false});
await evala(p,`btStart()`); await sleep(300); await evala(p,`btSkip()`); await sleep(1200);
await say('bt result',`JSON.stringify({ret:BT.R.ret,mdd:BT.R.mdd,trades:BT.R.tr.length,cfg:BT.s.cfg,rail:document.getElementById('bt-rail').innerText.replace(/\\s+/g,' ').slice(0,500)})`);
await say('fng facts',`JSON.stringify(BT.R.D.filter(function(d){ return d.k==='buy'; }).slice(0,4).map(function(d){ return mkDate(BT.R.eq[d.j].i)+' '+(d.facts||[]).map(function(f){ return f[0]+'='+f[1]; }).join(' | '); }))`);
// 독립 확인: 산 날마다 그날 공포 탐욕 지수가 상한 이하였는가
await say('fng check',`(function(){ var c=BT.s.cfg; if(c.fng==null) return 'no fng'; var bad=BT.R.tr.filter(function(t){ return !(TETH_PX.fng[t.e]<=c.fng); }); return JSON.stringify({limit:c.fng,buys:BT.R.tr.length,violations:bad.length}); })()`);
await shot(p,DIR+'A03-result.png',{full:false});
await say('errs',`JSON.stringify(window.__errs||[])`);
fs.writeFileSync(DIR+'verify-ai-log.txt',log.join('\n'));
await closePage(p); process.exit(0);
