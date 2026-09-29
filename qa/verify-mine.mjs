// 대화로 만든 전략이 예전 검증 페이지가 아니라 새 백테스트 화면(내 전략)으로 가는지, 끝까지 이어지는지 본다.
// 사용: node qa/verify-mine.mjs <폴더> [폭] [높이]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const round=process.argv[2]||'mine', W=+(process.argv[3]||1440), H=+(process.argv[4]||900);
const OUT=new URL('./'+round+'/'+(W===1440?'':'w'+W+'/'),import.meta.url); fs.mkdirSync(OUT,{recursive:true});
const DIR=decodeURIComponent(OUT.pathname).replace(/^\/([A-Za-z]:)/,'$1');
const log=[]; const p=await newPage(); await viewport(p,W,H,{mobile:W<700});
const say=async(l,x)=>{ let v; try{ v=await evala(p,x); }catch(e){ v='ERR '+String(e).slice(0,300); } console.log(l,String(v).slice(0,700)); log.push(l+' '+v); return v; };
const B='http://127.0.0.1:8765/index.html';
await goto(p,B+'?v='+Date.now()); await sleep(1200);
await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3000);
await evala(p,`tfQaPreset('02')`); await sleep(1200);
await evala(p,`(function(){ var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s); window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)); }); })()`);
const st=`JSON.stringify({hash:location.hash,mode:G.mode,id:BT.id,mine:!!(BT.s&&BT.s.mine),phase:BT.phase,stage:tfS().stage,cur:!!tfS().cur,score:tfS().score,title:(document.querySelector('.bt-cap-l')||document.querySelector('.tfw')||{innerText:''}).innerText.replace(/\\s+/g,' ').slice(0,120)})`;
// 대화에서 조건을 다 정한 상태를 만든다: 비트코인, 공격적, 500만원, 최근 1년, -3%
await evala(p,`(function(){ var t=tfS(); t.intake={asset:{i:0,label:'비트코인'},assetInfo:tfAssetLookup('비트코인'),style:{i:0,label:'공격적으로'},budget:{i:1,label:'500만원'},period:{i:0,label:'최근 1년'},stop:{i:0,label:'-3%까지'}}; t.qi=TF_QS.length; t.stage='ready'; t.cur=null; t.score=0; t.pendingP=null; tfSave(); })()`);
// 1. 예전 주소로 들어가도 새 화면으로 간다
await evala(p,`location.hash='#/strategy/backtest'`); await sleep(2000);
await say('1 old route',st);
// 2. 요약 카드의 단추(tfVerifyGo)로 들어간다
await evala(p,`location.hash=''`); await sleep(800);
await evala(p,`tfVerifyGo('x')`); await sleep(2000);
await say('2 verify button',st);
await say('2 ready rail',`document.getElementById('bt-rail').innerText.replace(/\\s+/g,' ').slice(0,500)`);
await shot(p,DIR+'M01-ready.png',{full:false});
await evala(p,`btStart()`); await sleep(4500); await shot(p,DIR+'M02-replay.png',{full:false});
await evala(p,`btSkip()`); await sleep(1200);
await say('3 result',st);
await say('3 rail',`document.getElementById('bt-rail').innerText.replace(/\\s+/g,' ').slice(0,600)`);
await say('3 cur',`JSON.stringify({ret:tfS().cur.ret,btRet:BT.R.ret,mdd:tfS().cur.mdd,btMdd:BT.R.mdd,n:tfS().cur.n,trades:tfS().cur.trades.length,p:tfS().cur.p})`);
await shot(p,DIR+'M03-result.png',{full:false});
// 3b. 뒤로 가기: 전략 목록이 아니라 대화로
await evala(p,`btBack()`); await sleep(1500);
await say('3b back',`JSON.stringify({hash:location.hash,mode:G.mode})`);
// 4. 실행 준비: 제휴 계정
await evala(p,`location.hash='#/share/bt/mine'`); await sleep(1800);
await say('4a restore',st);
await evala(p,`btUse()`); await sleep(1500);
await say('4 go',`JSON.stringify({hash:location.hash,me:document.querySelector('.btg-me').innerText.replace(/\\s+/g,' ').slice(0,200)})`);
await shot(p,DIR+'M04-activation.png',{full:false});
const set=async(i,v)=>evala(p,`(function(){ var e=document.getElementById('${i}'); e.value=${JSON.stringify(v)}; e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
await evala(p,`document.querySelector('.btg-opt input[value=partner]').click()`); await sleep(200); await evala(p,`btPickGo()`); await sleep(900);
await set('btg-uid','38291042'); await evala(p,`btUidGo()`); await sleep(3200);
await set('btg-ak','bg_x91k27QmT4vZ8r'); await set('btg-as','s3cr3t-Qw81kd02LmPz77'); await evala(p,`btApiGo()`); await sleep(4200);
await evala(p,`document.getElementById('g-scroll').scrollTop=0`); await sleep(300);
await say('5 done step',`document.getElementById('btg-flow').innerText.replace(/\\s+/g,' ').slice(0,600)`);
await shot(p,DIR+'M05-connected.png',{full:false});
await say('5b before final',`JSON.stringify({api:tfS().api,cur:!!tfS().cur,score:tfS().score,pass:TFC.score.pass})`); await evala(p,`btFinal()`); await sleep(1500);
await say('6 start page',`JSON.stringify({hash:location.hash,mode:G.mode,txt:document.getElementById('g-content').innerText.replace(/\\s+/g,' ').slice(0,400)})`);
await shot(p,DIR+'M06-start.png',{full:false});
// 7. 예전 연결 주소는 새 실행 준비로
await evala(p,`location.hash='#/strategy/connect'`); await sleep(1500);
await say('7 old connect',`JSON.stringify({hash:location.hash,mode:G.mode})`);
// 8. 게이트: 점수와 관계없이 시작할 수 있다
await evala(p,`location.hash='#/strategy/done'`); await sleep(1200);
await evala(p,`tfStartStrategy()`); await sleep(1500);
await say('8 started',`JSON.stringify({hash:location.hash,mode:G.mode,stage:tfS().stage,strat:(tfS().strat||[]).slice(0,1).map(function(x){ return x.name+' '+x.status; })})`);
// 9. 가격 자료가 없는 자산
await evala(p,`(function(){ var t=tfS(); t.intake.asset={i:0,label:'삼성전자'}; t.pendingP=null; tfSave(); })()`);
await evala(p,`location.hash=''`); await sleep(800); await evala(p,`location.hash='#/share/bt/mine'`); await sleep(1500);
await say('9 unsupported',`JSON.stringify({hash:location.hash,mode:G.mode,toast:(document.querySelector('.toast, #toast, .g-toast')||{innerText:''}).innerText})`);
await say('errs',`JSON.stringify(window.__errs||[])`);
await say('banned',`(function(){ var t=document.body.innerText; return ['시뮬레이션','기준 미달','80점','TETH Score'].map(function(w){ return w+':'+(t.split(w).length-1); }).join(' '); })()`);
fs.writeFileSync(DIR+'verify-mine-log.txt',log.join('\n'));
await closePage(p); process.exit(0);
