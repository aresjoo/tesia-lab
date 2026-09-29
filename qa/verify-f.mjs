// 최종 확인에서 남은 세 가지(F01, F02, F03)를 실제 브라우저에서 재현해 확인한다.
// 사용: node qa/verify-f.mjs <폴더>
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const round=process.argv[2]||'final2';
const OUT=new URL('./'+round+'/',import.meta.url); fs.mkdirSync(OUT,{recursive:true});
const DIR=decodeURIComponent(OUT.pathname).replace(/^\/([A-Za-z]:)/,'$1');
const log=[]; const p=await newPage(); await viewport(p,1440,900,{mobile:false});
const say=async(l,x)=>{ let v; try{ v=await evala(p,x); }catch(e){ v='ERR '+String(e).slice(0,300); } console.log(l,String(v).slice(0,1500)); log.push(l+' '+v); return v; };
const B='http://127.0.0.1:8765/index.html';
await goto(p,B+'?v='+Date.now()); await sleep(1200);
await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now()); await sleep(2500);
await evala(p,`tfQaPreset('02')`); await sleep(900);
await evala(p,`(function(){ var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s); })()`);

// ── F03: 재생 내내 패널의 날짜가, 그날까지 공개된 가장 최근 매수 판단의 날짜와 같은지
await evala(p,`location.hash='#/share/bt/h3'`); await sleep(2200);
await evala(p,`btStart()`);
let n=0, bad=[], shots=0, lastShotJ=-99;
for(;;){
  const s=JSON.parse(await evala(p,`(function(){ if(BT.phase!=='run') return JSON.stringify({phase:BT.phase}); var R=BT.R, j=BT.j, o=null; R.stops.forEach(function(x){ if(x.j<=j) o=x; }); var e=document.getElementById('bt-plast'); return JSON.stringify({phase:BT.phase,ph:BT.ph,j:j,stg:BT.stg,shown:e?e.textContent:'',want:o?btYMD(R.eq[o.j].i):'',panel:document.getElementById('bt-panel').getAttribute('data-st'),wantJ:o?o.j:null,feed:(document.querySelector('#bt-feed .bt-fc')||{innerText:''}).innerText.replace(/\\s+/g,' ')}); })()`));
  if(s.phase!=='run') break;
  if(s.ph===1&&s.stg<0&&s.want){ n++; if(s.shown.indexOf(s.want)<0||String(s.panel)!==String(s.wantJ)) bad.push(JSON.stringify(s)); if(s.j-lastShotJ>70&&shots<4){ lastShotJ=s.j; shots++; await shot(p,DIR+'F03-travel-'+shots+'.png',{full:false}); log.push('F03 shot '+shots+' '+JSON.stringify(s)); } }
  await sleep(30);
}
console.log('F03 samples',n,'mismatch',bad.length,bad.slice(0,3).join('\n')); log.push('F03 samples '+n+' mismatch '+bad.length+' '+bad.slice(0,5).join(' | '));
await sleep(900);

// ── F02: 선정 근거. 화면의 글과 가격에서 직접 다시 계산한 값을 나란히 적는다
for(const id of ['h3','d1']){
  await evala(p,`location.hash='#/share/bt/${id}'`); await sleep(2000); await evala(p,`btStart()`); await sleep(300); await evala(p,`btSkip()`); await sleep(1200);
  await say('F02 '+id,`(function(){ var R=BT.R, c=BT.s.cfg||BT.cfg||{}, out=[]; R.D.filter(function(d){ return d.k==='buy'||d.k==='skip'; }).slice(0,40).forEach(function(d){ if(out.length>=6) return; var f=(d.facts||[]).filter(function(x){ return /고른 날|이날의|순위|상승률/.test(x[0]); }).map(function(x){ return x[0]+': '+x[1]; }); if(!f.length) return; out.push({date:btYMD(R.eq[d.j].i),k:d.k,tk:d.tk,p0:d.p0,cmp:d.cmp,facts:f}); }); return JSON.stringify(out); })()`);
}
await evala(p,`location.hash='#/share/bt/h3'`); await sleep(2000); await evala(p,`btStart()`); await sleep(300); await evala(p,`btSkip()`); await sleep(1200);
// 08.31 근처의 판단을 열어 화면으로 남긴다
await say('F02 open',`(function(){ var R=BT.R, d=null; R.D.forEach(function(x,i){ if((x.k==='buy'||x.k==='skip')&&/08\\.31|09\\.01/.test(btYMD(R.eq[x.j].i))&&!d) d=x; }); if(!d) d=R.D.filter(function(x){ return x.k==='skip'; }).pop(); btFilt(d.k); var rows=document.querySelectorAll('#bt-dl .bt-row'); var hit=null; [].forEach.call(rows,function(r){ if(r.innerText.indexOf(btYMD(R.eq[d.j].i).slice(5))>=0&&!hit) hit=r; }); var b=(hit||rows[rows.length-1]).querySelector('.bt-rb'); b.click(); return btYMD(R.eq[d.j].i)+' '+d.k; })()`);
await sleep(700); await evala(p,`document.querySelector('.bt-row.on').scrollIntoView({block:'center'})`); await sleep(500);
await shot(p,DIR+'F02-pick-reason.png',{full:false});
await say('F02 detail text',`document.querySelector('.bt-row.on').innerText.replace(/\\s+/g,' ').slice(0,900)`);
// 독립 계산: 가격 배열에서 직접 구한 그날의 상승률
await say('F02 independent',`(function(){ var R=BT.R, on=document.querySelector('.bt-row.on'); var out=[]; R.D.forEach(function(d){ if(d.k!=='buy'&&d.k!=='skip') return; var f=(d.facts||[]).filter(function(x){ return /이날의/.test(x[0]); })[0]; if(!f) return; var key=d.a||d.key, P=mkPx(key), i=R.eq[d.j].i, look=+(/(\\d+)일/.exec(f[0])||[])[1]; var v=(P[i]/P[i-look]-1)*100; out.push(btYMD(i)+' '+d.tk+' 화면 '+f[1]+' 계산 '+v.toFixed(2)+'%'); }); return out.slice(0,12).join(' ; '); })()`);

// ── R09: AI 판단 전략의 전체 활동에 유지가 들어가는지
await evala(p,`location.hash='#/share/bt/d1'`); await sleep(2000); await evala(p,`btStart()`); await sleep(300); await evala(p,`btSkip()`); await sleep(1200);
await say('R09 d1',`(function(){ btFilt('all'); var rows=document.querySelectorAll('#bt-dl .bt-row'); var holds=[].filter.call(rows,function(r){ return /유지/.test(r.innerText); }).length; return JSON.stringify({rows:rows.length,holdRows:holds,nHold:BT.R.nHold,chips:[].map.call(document.querySelectorAll('.bt-chips button'),function(b){ return b.innerText; }).join(' | ')}); })()`);
await evala(p,`document.querySelector('.bt-chips').scrollIntoView({block:'start'}); document.getElementById('g-scroll').scrollTop-=80`); await sleep(500);
await shot(p,DIR+'R09-all-activity-d1.png',{full:false});

// ── F01: 계정이 바뀌거나 확인에 실패하면 앞선 확인과 연결이 무효가 되는지
const set=async(i,v)=>evala(p,`(function(){ var e=document.getElementById('${i}'); e.value=${JSON.stringify(v)}; e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
const stt=`JSON.stringify({step:btF().step,uid:btF().uid,uidIn:btF().uidIn,okUid:btF().okUid,api:btF().api,conn:tfS().conn,uidLinked:tfS().uidLinked,head:(document.querySelector('#btg-flow .btg-h')||{innerText:''}).innerText,sums:[].map.call(document.querySelectorAll('#btg-flow .btg-st'),function(x){ return x.className.replace('btg-st ','')+':'+x.querySelector('.sh').innerText.replace(/\\s+/g,' '); })})`;
await evala(p,`location.hash='#/share/bt/h3'`); await sleep(2000); await evala(p,`btStart()`); await sleep(300); await evala(p,`btSkip()`); await sleep(1200);
await evala(p,`btUse()`); await sleep(1500);
await evala(p,`document.querySelector('.btg-opt input[value=partner]').click()`); await sleep(200); await evala(p,`btPickGo()`); await sleep(900);
await set('btg-uid','38291042'); await evala(p,`btUidGo()`); await sleep(3000);
await set('btg-ak','bg_x91k27QmT4vZ8r'); await set('btg-as','s3cr3t-Qw81kd02LmPz77'); await evala(p,`btApiGo()`); await sleep(4000);
await say('F01 0 connected',stt);
// 재현 1: 끝난 뒤가 아니라 연결 도중에 되돌아가는 경우까지 보려고, 완료 상태에서 번호 단계를 다시 연다
await evala(p,`(function(){ var f=btF(); f.step='api'; tfSave(); btGoRe(); })()`); await sleep(600);
await evala(p,`btGoEdit('uid')`); await sleep(700);
await say('F01 1 opened uid only',stt);
await set('btg-uid','000000'); await evala(p,`btUidGo()`); await sleep(2200);
await say('F01 2 after failed uid',stt);
await shot(p,DIR+'F01-a-uid-failed.png',{full:false});
await evala(p,`btGoEdit('pick')`); await sleep(700); await evala(p,`btPickGo()`); await sleep(900);
await say('F01 3 after pick same path, continue',stt);
await shot(p,DIR+'F01-b-after-continue.png',{full:false});
// 재현 2: 다른 번호로 바꾸면 거래 연결을 다시 해야 하는지
await set('btg-uid','38291042'); await evala(p,`btUidGo()`); await sleep(3000);
await set('btg-ak','bg_x91k27QmT4vZ8r'); await set('btg-as','s3cr3t-Qw81kd02LmPz77'); await evala(p,`btApiGo()`); await sleep(4000);
await say('F01 4 connected again',stt);
await evala(p,`(function(){ var f=btF(); f.step='api'; tfSave(); btGoRe(); })()`); await sleep(500); await evala(p,`btGoEdit('uid')`); await sleep(600);
await set('btg-uid','55512345'); await evala(p,`btUidGo()`); await sleep(3000);
await say('F01 5 after changing to another valid uid',stt);
await evala(p,`document.getElementById('g-scroll').scrollTop=0`); await sleep(300);
await shot(p,DIR+'F01-c-changed-uid-needs-api.png',{full:false});
// 재현 3: 열어 보기만 하면 아무것도 지워지지 않는지(R14)
await set('btg-ak','bg_x91k27QmT4vZ8r'); await set('btg-as','s3cr3t-Qw81kd02LmPz77'); await evala(p,`btApiGo()`); await sleep(4000);
await evala(p,`(function(){ var f=btF(); f.step='api'; tfSave(); btGoRe(); })()`); await sleep(500); await evala(p,`btGoEdit('uid')`); await sleep(500); await evala(p,`btGoEdit('pick')`); await sleep(500); await evala(p,`btPickGo()`); await sleep(900);
await say('F01 6 open only, same choice',stt);
// 재현 4: 같은 번호를 다시 확인하면 연결이 남는지
await evala(p,`(function(){ var f=btF(); f.step='uid'; tfSave(); btGoRe(); })()`); await sleep(500);
await say('F01 7 field value when reopened',`document.getElementById('btg-uid').value`);
await evala(p,`btUidGo()`); await sleep(3000);
await say('F01 8 same uid rechecked',stt);
await evala(p,`document.getElementById('g-scroll').scrollTop=0`); await sleep(300);
await shot(p,DIR+'F01-d-success-valid.png',{full:false});
await say('errs',`JSON.stringify(window.__errs||[])`);
fs.writeFileSync(DIR+'verify-log.txt',log.join('\n'));
await closePage(p); process.exit(0);
