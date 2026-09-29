// 16개 요구사항의 화면 상태를 실제 브라우저에서 찍는다.
// 사용: node qa/16-fixes/shots.mjs <baseline|round-1|round-2> [폭] [높이]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const round=process.argv[2]||'baseline', W=+(process.argv[3]||1440), H=+(process.argv[4]||900);
const OUT=new URL('./'+round+'/'+(W===1440?'':'w'+W+'/'),import.meta.url); fs.mkdirSync(OUT,{recursive:true});
const DIR=decodeURIComponent(OUT.pathname).replace(/^\/([A-Za-z]:)/,'$1');
const log=[]; const B='http://127.0.0.1:8765/index.html';
let p=await newPage(); await viewport(p,W,H,{mobile:W<700});
const ev=async(x)=>{ try{ return await evala(p,x); }catch(e){ const m='ERR '+String(e).slice(0,260); log.push(m); console.log(m); return null; } };
const say=async(l,x)=>{ const v=await ev(x); console.log(l,String(v).slice(0,500)); log.push(l+' '+v); return v; };
const snap=async(n,full)=>{ if(full){ const hh=+(await ev(`(document.getElementById('g-scroll')||document.documentElement).scrollHeight`))||H; await viewport(p,W,Math.min(5200,Math.max(H,hh+60)),{mobile:W<700}); await sleep(600); await shot(p,DIR+n+'.png',{full:false}); await viewport(p,W,H,{mobile:W<700}); await sleep(300); } else await shot(p,DIR+n+'.png',{full:false}); log.push('shot '+n); };
const fresh=async(preset)=>{ await goto(p,B+'?v='+Date.now()); await sleep(800); await ev(`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3800);
  await ev(`(function(){ var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s); window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); })()`);
  if(preset){ await ev(`tfQaPreset('${preset}')`); await sleep(1200); } };
const top=async()=>{ await ev(`var g=document.getElementById('g-scroll'); if(g) g.scrollTop=0`); await sleep(250); };

// ── 손님
await fresh(null);
await ev(`tfShareHub('find')`); await sleep(2500); await snap('R06-R15-finder-guest');
await say('R06 controls',`(document.querySelector('.mk-bar, .mk3-bar, .mk3-ctl')||document.querySelector('#g-content')).innerText.replace(/\\s+/g,' ').slice(0,300)`);
await ev(`tfSS3Go('d1','all','ov')`); await sleep(2500); await top(); await snap('R01-R16-detail-guest');
await say('R16 cta',`[].map.call(document.querySelectorAll('#g-content button'),function(b){ return b.innerText.trim(); }).filter(Boolean).slice(0,8).join(' | ')`);
await ev(`(function(){ var b=[].filter.call(document.querySelectorAll('#g-content button'),function(x){ return /백테스트|테스트|돌려/.test(x.innerText); })[0]; if(b) b.click(); })()`); await sleep(1800);
await say('R01 after guest click',`JSON.stringify({hash:location.hash,mode:G.mode,auth:!!document.querySelector('.auth-modal, #auth-modal, .auth, #auth, .au-modal')||/회원가입|로그인/.test((document.querySelector('[role=dialog]')||{innerText:''}).innerText)})`);
await snap('R01-guest-click');
await ev(`try{ authClose() }catch(e){}`); await sleep(500);
await ev(`location.hash=''; try{ tfNav('#/trade') }catch(e){}`); await sleep(2200); await top(); await snap('R14-ai-trading-guest');
await ev(`try{ glcOpen({stopPropagation:function(){},preventDefault:function(){}}) }catch(e){ __errs.push('glc '+e) }`); await sleep(900); await snap('R07-language'); await ev(`try{ glcClose() }catch(e){}`);

// ── 로그인(연결 전)
await fresh('02');
await ev(`(function(){ var t=tfS(); t.api=null; t.conn=false; t.uidLinked=false; t.payDone=false; tfSave(); })()`);
await ev(`tfNav('#/trade')`); await sleep(2200); await top(); await snap('R14-ai-trading-user-inactive',true);
await ev(`try{ tfUpClose() }catch(e){} var d=document.querySelector('[role=dialog]'); if(d&&d.parentNode) d.parentNode.removeChild(d);`);
await ev(`tfSS3Go('d1','all','ov')`); await sleep(2500); await top(); await snap('R16-detail-user',true);
await ev(`tfSS3Go('r3','all','ov')`); await sleep(2500);
await ev(`(function(){ var h=[].filter.call(document.querySelectorAll('#g-content *'),function(x){ return /이전 기록/.test(x.innerText||'')&&x.children.length===0; })[0]; if(h) h.scrollIntoView({block:'end'}); })()`); await sleep(600); await snap('R05-activity-timeline');
// 백테스트
await ev(`location.hash='#/share/bt/h1'`); await sleep(2500); await snap('R04-backtest-ready');
await ev(`btStart()`); await sleep(3500); await snap('R04-processing-1'); await sleep(3500); await snap('R04-processing-2');
for(let k=0;k<40;k++){ const ph=await ev(`BT.phase`); if(ph==='result') break; await sleep(1500); }
await sleep(1200); await top(); await snap('R02-result');
await say('R02 reading',`(document.querySelector('.bt-read')||{innerText:''}).innerText.replace(/\\s+/g,' ')`);
await ev(`var e=document.getElementById('bt-ev'); if(e) e.scrollIntoView({block:'start'})`); await sleep(500); await snap('R03-decisions-7');
await ev(`location.hash='#/share/bt/d1'`); await sleep(2200); await ev(`BT.per=0; btReady(); btStart()`);
for(let k=0;k<60;k++){ const ph=await ev(`BT.phase`); if(ph==='result') break; await sleep(1500); }
await sleep(1200); await ev(`var e=document.getElementById('bt-ev'); if(e) e.scrollIntoView({block:'start'})`); await sleep(500); await snap('R03-decisions-100plus');
await say('R03 counts',`JSON.stringify({D:BT.R.D.length,rows:document.querySelectorAll('#bt-ev .bt-row').length})`);
// 설정
await ev(`location.hash=''`); await sleep(800);
await ev(`(function(){ var b=document.querySelector('#g-set-btn, .g-set, [aria-label="설정"]'); if(b) b.click(); else if(typeof gSetMenu==='function') gSetMenu({currentTarget:document.body,stopPropagation:function(){}}); })()`); await sleep(900); await snap('R12-settings-entry');
await ev(`try{ if(location.hash.indexOf('#/settings')<0) location.hash='#/settings/account' }catch(e){}`); await sleep(1500); await snap('R12-settings-account',true);
await ev(`location.hash='#/settings/billing'`); await sleep(1500); await snap('R13-settings-billing',true);
await say('errs',`JSON.stringify(window.__errs||[])`);
await say('endings',`(function(){ var t=document.body.innerText, a=(t.match(/[가-힣]요[.\\s]/g)||[]).length, b=(t.match(/니다[.\\s]/g)||[]).length; return '해요체 '+a+' 합니다체 '+b; })()`);
fs.writeFileSync(DIR+'shots-log.txt',log.join('\n'));
await closePage(p); process.exit(0);
