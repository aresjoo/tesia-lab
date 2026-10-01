// QA 상태 패널: 단추를 모두 눌러 오류 없이 화면이 뜨는지, 기대 요소가 있는지 확인하고 캡처를 남긴다
// 사용: node qa/gpt-skin/qa-panel/qa-panel-check.mjs [url]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const DIR=decodeURIComponent(new URL('./r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(DIR,{recursive:true});
const out=[]; const ok=(n,c,i)=>{ out.push((c?'PASS':'FAIL')+' | '+n+(i!==undefined?' | '+JSON.stringify(i).slice(0,300):'')); console.log(out[out.length-1]); };
const p=await newPage(); await viewport(p,1440,900,{mobile:false});
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'ERR '+String(e).slice(0,200); } };
const J=async(x)=>{ try{ return JSON.parse(await ev(`JSON.stringify(${x})`)); }catch(e){ return {}; } };
await goto(p,B+'?qa=1&v='+Date.now()); await sleep(600); await ev(`localStorage.clear(); localStorage.setItem('tethDev','1')`); await goto(p,B+'?v='+Date.now()); await sleep(3800);
await ev(`window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); window.addEventListener('unhandledrejection',function(e){ __errs.push('rej '+String(e.reason).slice(0,120)); });`);
ok('QA 단추가 보인다',(await ev(`!!document.getElementById('tf-devbtn')&&getComputedStyle(document.getElementById('tf-devbtn')).display!=='none'`))===true);
await ev(`qaPanelTgl()`); await sleep(400);
const pages=await J(`QA_PAGES.map(function(p){ return [p[0],p[1].map(function(x){ return x[0]; })]; })`);
ok('패널: 페이지 묶음 7개',Array.isArray(pages)&&pages.length===7,pages.map(x=>x[0]));
await shot(p,DIR+'P0-panel.png',{full:false});
/* 기대 요소 */
const EXPECT={
 '홈과 채팅':['#g-home-in, .g-home','#g-home-in, .g-home','#g-askdock .ska','#g-thread .tf-sum','#g-thread .tf-sum','.od-card.draft','.od-card.wait','.od-card.cancel','#g-usebar .use-bar:not(.full)','#g-usebar .use-bar.full','#g-usebar .use-bar.full'],
 '전략 복사':['.skf-card, [class*=skf]','.mk-detail','.mk-detail .mk-info-r','.mk-follow, .skc','#pl-root, .pl'],
 '백테스트':['#bt-root','#bt-root','#bt-root .bt-verdict','#bt-root .bt-verdict','#bt-root .rv-links, #bt-root .bt-cta'],
 'AI 트레이딩':['.tft-page, .tx-page, [class*=tx]','.tft-page, [class*=tx], #pl-root','.tft-page','.tft-page','.tft-page .tft-card.on','.tft-page .tft-card.on','.tft-page .tft-card.on','.od-row'],
 '거래소 연결과 플랜':['#pl-root, #ac-flow','#ac-flow','#ac-flow','#ac-flow','#ac-flow','#ac-flow','#pl-root, #ac-flow','#ac-flow, .px-list'],
 '설정':['#st-main','#st-main','#st-main','#st-main','#st-main','#st-main','#st-main','#st-main','#st-main .stg-warn','#st-main .use-card','#st-main .use-card','#st-main .use-card','#st-main'],
 '연구 기록':['.g-hist','.g-hist .g-hist-row']
};
let n=0;
for(let pi=0;pi<pages.length;pi++){ const [pg,items]=pages[pi];
  for(let ii=0;ii<items.length;ii++){ n++;
    await ev(`window.__errs=[]; qaRun(${pi},${ii})`); await sleep(pg==='거래소 연결과 플랜'?5200:pg==='백테스트'?5200:pg==='AI 트레이딩'?4200:2600);
    const sel=(EXPECT[pg]||[])[ii]||'#g-content > *';
    const s=await J(`{has:!!document.querySelector(${JSON.stringify(sel)}),errs:window.__errs,mode:G.mode,h1:((document.querySelector('#g-content h1, #g-content h2')||{}).innerText||'').slice(0,40)}`);
    ok(pg+' / '+items[ii],s.has&&Array.isArray(s.errs)&&s.errs.length===0,{sel:sel,mode:s.mode,h1:s.h1,errs:s.errs});
    await ev(`(function(){ var p=document.getElementById('qa2-panel'); if(p) p.style.visibility='hidden'; [].forEach.call(document.querySelectorAll('iframe'),function(f){ f.style.visibility='hidden'; }); })()`);
    await shot(p,DIR+'S'+String(n).padStart(2,'0')+'.png',{full:false,clip:{x:0,y:0,width:1440,height:900,scale:0.5}});
    await ev(`(function(){ var p=document.getElementById('qa2-panel'); if(p) p.style.visibility=''; })()`);
  }
}
/* 홈 알림 단추 숨김 */
await ev(`qaRun(0,1)`); await sleep(1500);
let s=await J(`{home:G.mode,hidden:(function(){ var e=document.getElementById('nf-util'); return !e||e.hidden||getComputedStyle(e).display==='none'; })()}`);
ok('홈에서는 오른쪽 위 알림 단추가 없다',s.home==='home'&&s.hidden===true,s);
await ev(`qaRun(5,0)`); await sleep(1500); await ev(`qaRun(3,2)`); await sleep(3000);
s=await J(`{mode:G.mode,shown:(function(){ var e=document.getElementById('nf-util'); return !!e&&!e.hidden; })()}`);
ok('다른 화면에서는 알림 단추가 그대로',s.shown===true,s);
const pass=out.filter(x=>x.startsWith('PASS')).length; out.push('','TOTAL '+pass+' / '+out.length); console.log(out[out.length-1]);
fs.writeFileSync(DIR+'qa-panel-check.txt',out.join('\n'));
await closePage(p); process.exit(0);
