// 사용: node shots.mjs <tag> [detailName...]  → artifacts/teth-redesign/<tag>-main.png 등
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
const OUT='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/artifacts/teth-redesign/';
const tag=process.argv[2]||'x', details=process.argv.slice(3);
const p=await newPage(); await viewport(p,1440,1000);
await goto(p,'http://127.0.0.1:8765/index.html?v='+Date.now()); await sleep(800); await evala(p,`localStorage.clear();sessionStorage.clear();'ok'`);
await goto(p,'http://127.0.0.1:8765/index.html?v='+Date.now()); await sleep(1200);
await evala(p,`window.__e=[];window.addEventListener('error',e=>__e.push(e.message+' @'+e.lineno));tfShareHub('find')`); await sleep(1800);
await shot(p,OUT+tag+'-main-top.png',{full:false});
const go=async(w,h,name,mob)=>{ await viewport(p,w,h,mob?{mobile:true}:undefined); await sleep(500); await evala(p,`(()=>{const g=document.querySelector('.mk-grid');g.scrollIntoView({block:'start'});window.scrollBy(0,-${mob?150:24});const s=document.getElementById('g-scroll');if(s&&!document.body.classList.contains('gft-doc'))s.scrollTop-=${mob?150:24};})()`); await sleep(900); await shot(p,OUT+tag+name,{full:false}); };
await go(1440,1000,'-main.png');
await go(1440,2000,'-main-full.png');
await go(1280,900,'-main-1280.png');
await go(390,844,'-main-390.png',true);
await viewport(p,1440,1000);
const names=details.length?details:JSON.parse(await evala(p,`JSON.stringify([...document.querySelectorAll('.mk-card .mk-c-tb')].slice(0,1).map(x=>x.innerText))`));
let k=0; for(const nm of names){ k++; await evala(p,`tfSS3Go(tfSSNe(${JSON.stringify(nm)}),'all','ov')`); await sleep(1600); await evala(p,`window.scrollTo(0,0);var s=document.getElementById('g-scroll');if(s)s.scrollTop=0;`); await sleep(300);
  const sfx=names.length>1?('-'+k):''; await shot(p,OUT+tag+'-detail'+sfx+'.png',{full:false});
  await viewport(p,1440,2400); await sleep(700); await shot(p,OUT+tag+'-detail'+sfx+'-full.png',{full:false}); await viewport(p,1440,1000);
  if(k===1){ await viewport(p,390,844,{mobile:true}); await sleep(700); await shot(p,OUT+tag+'-detail-390.png',{full:false}); await viewport(p,1440,1000); } }
console.log('errs',await evala(p,`JSON.stringify(__e)`));
await closePage(p);
