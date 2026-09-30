// TETH에게 분석시키기: 카드 말풍선, 화면 캡처 단계, 그 뒤 실제 답변
// 사용: node qa/16-fixes/an-check.mjs [url] [전략id]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html', ID=process.argv[3]||'f1';
const DIR=decodeURIComponent(new URL('./an/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(DIR,{recursive:true});
const out=[]; const ok=(n,c,i)=>{ out.push((c?'PASS':'FAIL')+' | '+n+(i!==undefined?' | '+JSON.stringify(i).slice(0,400):'')); console.log(out[out.length-1]); };
const p=await newPage(); await viewport(p,1440,900,{mobile:false});
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'ERR '+String(e).slice(0,200); } };
const J=async(x)=>{ try{ return JSON.parse(await ev(`JSON.stringify(${x})`)); }catch(e){ return {}; } };
await goto(p,B+'?v='+Date.now()); await sleep(600); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3800);
await ev(`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); window.__net=[]; var f0=window.fetch; window.fetch=function(u,o){ var r={u:String(u).slice(0,90),t:Date.now()}; __net.push(r); return f0.apply(this,arguments); };`);
await ev(`tfQaPreset('02')`); await sleep(1300);
await ev(`tfSS3Go('${ID}','all','ov')`); await sleep(2500);
const t0=Date.now();
await ev(`(function(){ var b=[].filter.call(document.querySelectorAll('button'),function(x){ return /TETH에게 분석시키기/.test(x.innerText); })[0]; if(b){ b.click(); return 'menu'; } tfSS3Ask('${ID}','all'); return 'direct'; })()`); await sleep(300);
await ev(`(function(){ var b=[].filter.call(document.querySelectorAll('button'),function(x){ return /TETH에게 분석시키기/.test(x.innerText); })[0]; if(b) b.click(); })()`); await sleep(1500);
let s=await J(`{mode:G.mode,card:!!document.querySelector('.an-umsg .mk-card'),line:(document.querySelector('.an-line')||{}).innerText,prompt:/전략 분석 요청/.test(document.getElementById('g-thread').innerText),label:(document.querySelector('.g-act2 .hlb')||{}).innerText}`);
ok('내 말풍선은 카드 + 한 줄, 긴 요청문은 보이지 않는다',s.card&&s.line==='이 전략 분석해줘'&&!s.prompt,s);
await shot(p,DIR+'an-1-bubble.png',{full:false});
// 화면 캡처 단계가 끝날 때까지
let steps=[]; for(let k=0;k<50;k++){ await sleep(1000); steps=await J(`[].map.call(document.querySelectorAll('.g-act2 .ar'),function(r){ return {t:(r.querySelector('.at, .an')||{}).innerText||'',cls:r.className,img:!!r.querySelector('img.an-shot')}; })`); if(steps.filter(x=>x.img).length>=3||steps.some(x=>/실패/.test(x.t))||k>=45) break; }
const tChat=await J(`AN.sentAt||null`);
const shotsDone=steps.filter(x=>x.img);
ok('전략 페이지 열기 단계가 있다',steps.some(x=>/전략 페이지 열기/.test(x.t)),steps.map(x=>x.t));
ok('개요, 판단 기록, 거래 내역 화면 3장이 붙었다',shotsDone.length===3,shotsDone.map(x=>x.t));
const lastShot=await J(`AN.lastShotAt||null`); ok('화면을 다 찍은 뒤에 모델 호출을 보냈다',tChat!==null&&lastShot!==null&&tChat>=lastShot,{sent:tChat&&tChat-t0,lastShot:lastShot&&lastShot-t0});
await shot(p,DIR+'an-2-shots.png',{full:false});
await ev(`(function(){ var img=document.querySelector('img.an-shot'); if(img) img.scrollIntoView({block:'center'}); })()`); await sleep(400); await shot(p,DIR+'an-3-shot-zoom.png',{full:false});
// 답변
let ans=''; for(let k=0;k<70;k++){ await sleep(1500); const st=await J(`{busy:!!TAI.busy,err:!!document.querySelector('.g-errcard'),txt:(function(){ var L=document.querySelectorAll('#g-thread .g-amsg, #g-thread .tai-ans, #g-thread .g-ans'); return L.length?L[L.length-1].innerText:''; })()}`); ans=st.txt; if(st.err||(!st.busy&&ans.length>80)) break; }
ok('실제 답변이 붙었다',ans.length>80&&!/불러오지 못했습니다/.test(ans),ans.slice(0,160));
ok('답변에 설정 키 이름이 그대로 노출되지 않는다',!/\b(fast|slow|trail|lev|exitN|reg)\s*=/.test(ans),(ans.match(/\b(fast|slow|trail|lev)\s*=/g)||[]));
await ev(`document.getElementById('g-scroll').scrollTop=1e9`); await sleep(400); await shot(p,DIR+'an-4-answer.png',{full:false});
s=await J(`{errs:window.__errs,frames:document.querySelectorAll('iframe.an-frame').length}`); ok('콘솔 오류 없음, 숨긴 프레임 정리됨',s.errs.length===0&&s.frames===0,s);
const pass=out.filter(x=>x.startsWith('PASS')).length; out.push('','TOTAL '+pass+' / '+out.length); console.log(out[out.length-1]);
fs.writeFileSync(DIR+'an-check.txt',out.join('\n'));
await closePage(p); process.exit(0);
