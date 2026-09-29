// 선물 전략 10개: 목록 맨 위에 있는가, 상세와 백테스트와 따라가기 화면이 오류 없이 열리는가, 숫자가 서로 같은가
// 사용: node qa/verify-fut.mjs <폴더>
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const round=process.argv[2]||'fut/shots';
const OUT=new URL('./'+round+'/',import.meta.url); fs.mkdirSync(OUT,{recursive:true});
const DIR=decodeURIComponent(OUT.pathname).replace(/^\/([A-Za-z]:)/,'$1');
const log=[]; const p=await newPage(); await viewport(p,1440,900,{mobile:false});
const say=async(l,x)=>{ let v; try{ v=await evala(p,x); }catch(e){ v='ERR '+String(e).slice(0,400); } console.log(l,String(v).slice(0,1200)); log.push(l+' '+v); return v; };
const B='http://127.0.0.1:8765/index.html';
await goto(p,B+'?v='+Date.now()); await sleep(1000); await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(3500);
await evala(p,`tfQaPreset('02')`); await sleep(1200);
await evala(p,`(function(){ var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s); window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)+' @'+e.lineno); }); })()`);
await say('top10',`JSON.stringify(tfRankSeeds().slice(0,10).map(function(s){ var b=(function(){ var U=s.cfg.asset?[s.cfg.asset]:MK_UNI[s.cfg.uni].list, a=s.r.eq[0].i, T=PRICE0.length-1, v=0; U.forEach(function(k){ var P=mkPx(k); v+=P[T]/P[a]; }); return (v/U.length-1)*100; })(); return s.id+' '+s.kind+' '+s.name+' | '+s.ret.toFixed(1)+'% 낙폭 '+s.mdd.toFixed(1)+' n'+s.n+' 강제청산 '+s.r.liqN+' | 현물 보유 '+b.toFixed(1)+'%'; }))`);
await evala(p,`tfShareHub('find')`); await sleep(2500);
await shot(p,DIR+'U01-finder-top.png',{full:false});
await say('finder cards',`[].slice.call(document.querySelectorAll('.mk3-card, .mk3')).slice(0,4).map(function(c){ return c.innerText.replace(/\\s+/g,' ').slice(0,160); }).join(' || ')`);
for(const id of ['f1','f5','f7']){
  await evala(p,`tfSS3Go('${id}','all','ov')`); await sleep(2500);
  await say('detail '+id,`(document.getElementById('g-content')||document.body).innerText.replace(/\\s+/g,' ').slice(0,900)`);
  await shot(p,DIR+'U02-detail-'+id+'.png',{full:false});
  for(const tab of ['log','trades','how']){ await evala(p,`try{ tfSS3Go('${id}','all','${tab}') }catch(e){ __errs.push('tab ${tab} '+e) }`); await sleep(1200); }
  await say('detail tabs '+id,`JSON.stringify(window.__errs)`);
  await evala(p,`location.hash='#/share/bt/${id}'`); await sleep(2000);
  await say('bt ready '+id,`document.getElementById('bt-rail').innerText.replace(/\\s+/g,' ').slice(0,700)`);
  await evala(p,`BT.per=0; btReady(); btStart()`); await sleep(5000); await shot(p,DIR+'U03-replay-'+id+'.png',{full:false});
  await evala(p,`btSkip()`); await sleep(1200);
  await say('bt result '+id,`JSON.stringify({ret:BT.R.ret,seed:tfSSFind('${id}').r.ret,mdd:BT.R.mdd,rail:document.getElementById('bt-rail').innerText.replace(/\\s+/g,' ').slice(0,420),panel:document.getElementById('bt-panel').innerText.replace(/\\s+/g,' ').slice(0,300)})`);
  await shot(p,DIR+'U04-result-'+id+'.png',{full:false});
  await evala(p,`(function(){ var L=BT.R.D.filter(function(x){ return x.k==='buy'&&x.side<0; }), d=L[L.length-1]||BT.R.D[BT.R.D.length-1]; btFilt('buy'); BT.decN=200; btSelDec(d.ix); })()`); await sleep(700);
  await evala(p,`var r=document.querySelector('.bt-row.on'); if(r) r.scrollIntoView({block:'center'})`); await sleep(400);
  await say('decision '+id,`(document.querySelector('.bt-row.on')||{innerText:''}).innerText.replace(/\\s+/g,' ').slice(0,500)`);
  await shot(p,DIR+'U05-decision-'+id+'.png',{full:false});
  await evala(p,`(function(){ var t=BT.R.tr.filter(function(x){ return !x.open&&x.side<0; })[0]||BT.R.tr[0]; btSelTr(t.id); })()`); await sleep(600);
  await evala(p,`var r=document.querySelector('.bt-tr.on'); if(r) r.scrollIntoView({block:'center'})`); await sleep(400);
  await say('trade '+id,`(document.querySelector('.bt-tr.on')||{innerText:''}).innerText.replace(/\\s+/g,' ').slice(0,500)`);
  await shot(p,DIR+'U06-trade-'+id+'.png',{full:false});
  await say('errs '+id,`JSON.stringify(window.__errs)`);
}
// 따라가기: 시작하고 장부 값이 나오는가
await evala(p,`(function(){ var t=tfS(); t.api={ex:'bitget',last4:'abcd'}; t.conn=true; tfSave(); })()`);
await evala(p,`tfShareHub('find')`); await sleep(1500);
await evala(p,`mkFollowSheet('f1')`); await sleep(900);
await say('follow sheet',`(document.querySelector('.mk-follow')||{innerText:'none'}).innerText.replace(/\\s+/g,' ').slice(0,400)`);
await evala(p,`(function(){ var e=document.getElementById('cps-amt'); e.value='500'; e.dispatchEvent(new Event('input',{bubbles:true})); })()`); await sleep(400);
await evala(p,`cpStart('f1')`); await sleep(2000);
await say('follow started',`JSON.stringify((cpState().copies||[]).slice(-1).map(function(c){ var d=cpCalc(c); return {nick:c.nick,est:d.est,net:d.net,posOpen:d.posOpen,missing:d.missing}; }))`);
await say('follow page',`JSON.stringify({hash:location.hash,txt:(document.getElementById('g-content')||document.body).innerText.replace(/\\s+/g,' ').slice(0,600)})`);
await shot(p,DIR+'U07-follow.png',{full:false});
await say('errs',`JSON.stringify(window.__errs)`);
await say('banned',`(function(){ var t=document.body.innerText; return ['시뮬레이션','데모','예시','MOCK','undefined','NaN','—','·'].map(function(w){ return w+':'+(t.split(w).length-1); }).join(' '); })()`);
fs.writeFileSync(DIR+'verify-fut-log.txt',log.join('\n'));
await closePage(p); process.exit(0);
