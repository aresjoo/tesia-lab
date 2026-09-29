// 백테스트 여정 전체를 실제 브라우저에서 눌러 가며 화면을 찍는다.
// 사용: node qa/walk.mjs <round-1|round-2|...> [전략 id] [폭] [높이]
// 준비: 정적 서버 127.0.0.1:8765, 헤드리스 Chrome 9333, CDP 드라이버(scratchpad/pw/cdp.mjs)
// S01~S15 는 검수 상태의 이름이다. 화면 수가 아니다(백테스트는 한 화면, 실행 준비도 한 화면)
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const MAIN='h3';
const round=process.argv[2]||'round-2', id=process.argv[3]||MAIN, W=+(process.argv[4]||1440), H=+(process.argv[5]||900);
const main=W===1440&&id===MAIN;
const OUT=new URL('./'+round+'/'+(main?'':(id!==MAIN?id+'-':'')+'w'+W+'/'),import.meta.url); fs.mkdirSync(OUT,{recursive:true});
const DIR=decodeURIComponent(OUT.pathname).replace(/^\/([A-Za-z]:)/,'$1');
const P=n=>DIR+n+'.png';
if(main) fs.mkdirSync(DIR+'seq',{recursive:true});
const p=await newPage(); await viewport(p,W,H,{mobile:W<700});
const log=[]; const say=async(l,x)=>{ let v; try{ v=await evala(p,x); }catch(e){ v='ERR '+String(e).slice(0,300); } console.log(l,String(v).slice(0,700)); log.push(l+' '+v); return v; };
const B='http://127.0.0.1:8765/index.html';
await goto(p,B+'?v='+Date.now()); await sleep(1200);
await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(2500);
await evala(p,`tfQaPreset('02')`); await sleep(900);
await evala(p,`(function(){ var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s); })()`);
await evala(p,`location.hash='#/share/bt/${id}'`); await sleep(2200);
await say('S01',`JSON.stringify({phase:document.getElementById('bt-root').dataset.phase,cap:document.querySelector('.bt-cap-l').innerText.replace(/\\s+/g,' '),rail:document.getElementById('bt-rail').innerText.replace(/\\s+/g,' ').slice(0,420),docW:document.documentElement.scrollWidth,cta:Math.round(document.querySelector('#bt-rail .bt-cta').getBoundingClientRect().bottom),vh:innerHeight,plan:{prep:BT.R.prepMs,run:Math.round(BT.R.runMs),wrap:BT.R.wrapMs,stops:BT.R.stops.length,full:BT.R.stops.filter(function(s){return s.full}).map(function(s){return Math.round(s.dw)}),brief:BT.R.stops.filter(function(s){return s.dw>0&&!s.full}).length}})`);
await shot(p,P('S01-backtest-ready'),{full:false});

// 다시 돌리기: 상태를 보면서 찍는다
const st=async()=>JSON.parse(await evala(p,`JSON.stringify({phase:BT.phase,ph:BT.ph,j:BT.j,stg:BT.stg,N:BT.R.N,full:(BT.stg>=0&&BT.R.seg[BT.seg]&&BT.R.seg[BT.seg].st)?!!BT.R.seg[BT.seg].st.full:null,sk:(BT.stg>=0&&BT.R.seg[BT.seg]&&BT.R.seg[BT.seg].st)?BT.R.seg[BT.seg].st.sk:null,feed:document.querySelectorAll('.bt-fr').length,t:Math.round(performance.now()-BT.t0)})`));
const desc=`JSON.stringify({t:Math.round(performance.now()-BT.t0),cap:document.querySelector('.bt-cap-l').innerText.replace(/\\s+/g,' '),head:document.querySelector('#bt-panel .ph').innerText.replace(/\\s+/g,' '),last:(document.getElementById('bt-plast')||{textContent:''}).textContent,marks:document.querySelectorAll('#bt-mk .bt-m.on').length,feedTop:(document.querySelector('.bt-fr')||{innerText:''}).innerText.replace(/\\s+/g,' '),cells:[...document.querySelectorAll('#bt-panel .cell')].map(c=>(c.className.replace('cell','').trim()||'-')+':'+c.innerText.replace(/\\s+/g,' ')).join(' | '),steps:[...document.querySelectorAll('#bt-steps li')].map(l=>l.className+':'+l.innerText.replace(/\\s+/g,' ')).join(' | '),feed:document.querySelectorAll('.bt-fr').length})`;
const want=[
  ['S02-early-processing',s=>s.ph===1&&s.stg===1&&s.full===true&&!s.sk],
  ['S02b-first-decision',s=>s.ph===1&&s.stg===2&&s.full===true&&!s.sk],
  ['S03a-skip-signal',s=>s.ph===1&&s.stg===0&&s.sk===true],
  ['S03b-skip-review',s=>s.ph===1&&s.stg===1&&s.sk===true],
  ['S03-mid-processing',s=>s.ph===1&&s.stg===2&&s.sk===true&&s.full===true],
  ['S03c-between-events',s=>s.ph===1&&s.j>s.N*0.55&&s.stg<0],
  ['S04-final-processing',s=>s.ph===2||(s.ph===1&&s.j>s.N*0.96)],
];
const core=new Set(['S02-early-processing','S03-mid-processing','S04-final-processing']);
const got={}; const tl=[]; let seqN=0, lastSeq=0;
const t0=Date.now(); await evala(p,`btStart()`);
await sleep(300); await shot(p,P('S02a-preparing'),{full:false}); await say('S02a',desc);
for(;;){
  const s=await st(); tl.push([s.t,s.ph,s.j,s.stg,s.feed].join(','));
  if(s.phase!=='run') break;
  for(const [n,f] of want){ if(!got[n]&&f(s)){ got[n]=1; if(main||core.has(n)){ await shot(p,P(n),{full:false}); await say(n,desc); } } }
  if(main&&Date.now()-lastSeq>420){ lastSeq=Date.now(); await shot(p,DIR+'seq/f'+String(++seqN).padStart(3,'0')+'-t'+s.t+'.png',{full:false}); }
  if(Date.now()-t0>60000) break;
  await sleep(35);
}
for(const [n] of want) if(!got[n]&&core.has(n)) console.log('missed',n);
const total=Date.now()-t0; console.log('replay total ms',total); log.push('replay total ms '+total); log.push('timeline t,ph,j,stage,feed: '+tl.join(' ; '));
await sleep(900);
await shot(p,P('S05-results-above-fold'),{full:false});
await say('S05',`JSON.stringify({phase:document.getElementById('bt-root').dataset.phase,cap:document.querySelector('.bt-cap-l').innerText.replace(/\\s+/g,' '),rail:document.getElementById('bt-rail').innerText.replace(/\\s+/g,' ').slice(0,900),panel:document.getElementById('bt-panel').innerText.replace(/\\s+/g,' '),widths:{col:document.querySelector('.bt-main').parentNode.clientWidth,chart:document.getElementById('bt-chart').offsetWidth,panel:document.getElementById('bt-panel').offsetWidth,ev:document.getElementById('bt-ev').scrollWidth,rail:document.getElementById('bt-rail').offsetWidth},docW:document.documentElement.scrollWidth,ctaBottom:Math.round((document.querySelector('#bt-mcta .bt-cta')&&document.querySelector('#bt-mcta .bt-cta').offsetWidth?document.querySelector('#bt-mcta .bt-cta'):document.querySelector('#bt-rail .bt-cta')).getBoundingClientRect().bottom),vh:innerHeight})`);
if(main){
  const mx=JSON.parse(await evala(p,`(function(){ var d=BT.R.D.filter(function(x){return x.k==='sell'})[1]||BT.R.D[0], c=document.getElementById('bt-chart').getBoundingClientRect(); return JSON.stringify({x:c.x+BT.G.X(d.j)/BT.G.W*c.width,y:c.y+c.height*0.45}); })()`));
  await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:Math.round(mx.x),y:Math.round(mx.y)}); await sleep(400); await shot(p,P('S05b-results-hover'),{full:false}); await say('S05b',`document.getElementById('bt-tip').innerText.replace(/\\s+/g,' ')`); await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:700,y:6}); await sleep(200); }
const into=async(sel,blk)=>{ await evala(p,`document.querySelector('${sel}').scrollIntoView({block:'${blk||'start'}'})`); await sleep(500); };
// 요약 줄의 첫 숫자를 눌러 근거로 간다
await evala(p,`document.querySelector('#bt-panel .cell button').click()`); await sleep(900);
await evala(p,`document.getElementById('g-scroll').scrollTop-=70`); await sleep(400);
await shot(p,P('S06-results-evidence'),{full:false});
await say('S06',`JSON.stringify({filt:BT.filt,rows:document.querySelectorAll('#bt-dl .bt-row').length,chips:[...document.querySelectorAll('.bt-chips button')].map(b=>b.innerText+(b.getAttribute('aria-pressed')==='true'?'*':'')).join(' '),txt:document.getElementById('bt-dl').innerText.replace(/\\s+/g,' ').slice(0,300)})`);
await evala(p,`(function(){ var R=BT.R, has=R.D.some(function(x){ return x.k==='skip'; }); if(has) btFilt('skip'); else btFilt('buy'); var b=document.querySelector('#bt-dl .bt-rb'); if(b) b.click(); })()`); await sleep(600);
await into('.bt-row.on','center'); await shot(p,P('S07-decision-detail'),{full:false});
await say('S07',`document.querySelector('.bt-row.on').innerText.replace(/\\s+/g,' ').slice(0,600)`);
await evala(p,`(function(){ var t=BT.R.tr.filter(function(x){ return !x.open&&x.pnl<0; })[0]||BT.R.tr[0]; btSelTr(t.id); })()`); await sleep(500);
await into('.bt-tr.on','center'); await shot(p,P('S08-trade-detail'),{full:false});
await say('S08',`document.querySelector('.bt-tr.on').innerText.replace(/\\s+/g,' ').slice(0,600)`);
if(main){ // 전체 길이: 안쪽 스크롤 영역을 다 담도록 창을 늘려 찍는다
  await evala(p,`(function(){ BT.sel=null; btFilt(btDefFilt(BT.s)); document.getElementById('g-scroll').scrollTop=0; })()`); await sleep(300);
  const hh=+(await evala(p,`document.getElementById('g-scroll').scrollHeight`)); await viewport(p,W,Math.min(6000,hh+40),{mobile:false}); await sleep(700); await shot(p,P('S08b-result-full-page'),{full:false}); await viewport(p,W,H,{mobile:false}); await sleep(500); }

// 실행 준비: 한 화면에서 단계가 펼쳐진다
const set=async(i,v)=>evala(p,`(function(){ var e=document.getElementById('${i}'); e.value=${JSON.stringify(v)}; e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
const body=`document.getElementById('btg-flow').innerText.replace(/\\s+/g,' ').slice(0,700)`;
const top=async()=>{ await evala(p,`document.getElementById('g-scroll').scrollTop=0`); await sleep(250); };
const chk=async()=>{ await evala(p,`document.getElementById('btg-chk').scrollIntoView({block:'center'})`); await sleep(200); };
await evala(p,`btUse()`); await sleep(1500); await shot(p,P('S09-activation-choice'),{full:false}); await say('S09',body);
await say('S09 me',`document.querySelector('.btg-me').innerText.replace(/\\s+/g,' ')`);
// 쓰던 계정 그대로: 거래 연결 → 결제 카드 등록
await evala(p,`document.querySelector('.btg-opt input[value=own]').click()`); await sleep(300);
await evala(p,`btPickGo()`); await sleep(900);
await set('btg-ak','bn_x91k27QmT4vZ8r'); await set('btg-as','s3cr3t-Qw81kd02LmPz77');
await top(); if(main) await shot(p,P('S11a-exchange-form'),{full:false});
await evala(p,`btApiGo()`); await sleep(1150); await chk();
await shot(p,P('S11-exchange-connection'),{full:false}); await say('S11',body);
await sleep(2400); await say('after own api',`btF().step`);
await set('btg-cn','4242 4242 4242 4242'); await set('btg-ce','12 / 28'); await set('btg-cc','123'); await set('btg-ch','KIM DOHYUN');
await top(); await shot(p,P('S10-card-path'),{full:false}); await say('S10',body);
await evala(p,`btCardGo()`); await sleep(1200); await top(); await say('own done',`btF().step`);
if(main){ await shot(p,P('S15b-success-own-account'),{full:false}); await say('S15b',body); }
// 제휴 계정으로
await evala(p,`(function(){ var t=tfS(); t.bt.flow=null; tfSave(); btGoRe(); })()`); await sleep(900);
await evala(p,`document.querySelector('.btg-opt input[value=partner]').click()`); await sleep(200);
await evala(p,`btPickGo()`); await sleep(900);
await top(); await shot(p,P('S12-partner-exchange'),{full:false}); await say('S12',body);
if(main){ await evala(p,`btHas(0)`); await sleep(700); await top(); await shot(p,P('S12b-partner-new-account'),{full:false}); await evala(p,`btHas(1)`); await sleep(600); }
await set('btg-uid','38291042'); await evala(p,`btUidGo()`); await sleep(1000); await chk();
await shot(p,P('S13-uid-verification'),{full:false}); await say('S13',body);
await sleep(2000); await say('after uid',`btF().step`);
await set('btg-ak','bg_x91k27QmT4vZ8r'); await set('btg-as','s3cr3t-Qw81kd02LmPz77');
await top(); if(main) await shot(p,P('S14a-api-form'),{full:false});
await evala(p,`btApiGo()`); await sleep(1750); await chk();
await shot(p,P('S14-api-connection'),{full:false}); await say('S14',body);
await sleep(2300); await say('after api',`btF().step`);
await top(); await sleep(700); await shot(p,P('S15-success'),{full:false}); await say('S15',body);
// 실패와 복구
await evala(p,`(function(){ var f=btF(); f.step='uid'; f.okUid=0; f.api=null; tfSave(); btGoRe(); })()`); await sleep(800); await set('btg-uid','000000'); await evala(p,`btUidGo()`); await sleep(1500);
await evala(p,`document.getElementById('btg-uid').scrollIntoView({block:'center'})`); await sleep(250);
if(main) await shot(p,P('X01-uid-not-found'),{full:false}); await say('X01',`JSON.stringify({err:document.getElementById('btg-uid-e').innerText,rec:(document.getElementById('btg-rec')||{innerText:''}).innerText.replace(/\\s+/g,' '),btn:document.getElementById('btg-go').innerText,disabled:document.getElementById('btg-go').disabled,focus:document.activeElement.id})`);
// 확인 도중에 거래소를 바꾸면 앞선 확인이 멈추는지
await set('btg-uid','38291042'); await evala(p,`btUidGo()`); await sleep(500); await evala(p,`(function(){ var b=document.querySelectorAll('.btg-exs button')[2]; b.disabled=false; b.click(); })()`); await sleep(2600);
await say('X02 stale check',`JSON.stringify({step:btF().step,ex:btF().ex,okUid:btF().okUid})`);
await say('errs',`JSON.stringify(window.__errs||[])`);
await say('banned',`(function(){ var t=document.body.innerText; return ['시뮬레이션','데모','예시','프로토타입','MOCK','—','·'].map(function(w){ return w+':'+(t.split(w).length-1); }).join(' '); })()`);
fs.writeFileSync(DIR+'walk-log.txt',log.join('\n'));
await closePage(p);
