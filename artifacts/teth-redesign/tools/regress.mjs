import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
const OUT='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/artifacts/teth-redesign/';
const PORT=process.argv[2]||'8765';
const p=await newPage(); await viewport(p,1440,1000);
await goto(p,'http://127.0.0.1:'+PORT+'/index.html?v='+Date.now()); await sleep(800); await evala(p,`localStorage.clear();sessionStorage.clear();'ok'`);
await goto(p,'http://127.0.0.1:'+PORT+'/index.html?v='+Date.now()); await sleep(1500);
await evala(p,`window.__e=[];window.addEventListener('error',e=>__e.push(e.message+' @'+e.lineno));'ok'`);
const J=async(x)=>{ try{ return await evala(p,x); }catch(e){ return 'EVAL FAIL '+String(e).slice(0,200); } };
console.log('price', await J(`JSON.stringify({same:PRICE===PRICE0,end:mkDate(PRICE0.length-1)})`));
await J(`tfShareHub('find')`); await sleep(1500);
console.log('cards', await J(`JSON.stringify({n:document.querySelectorAll('.mk3').length,pager:document.querySelectorAll('.mk-pg').length,cut:[...document.querySelectorAll('.mk3')].filter(c=>['.mk3-t','.mk3-how span','.mk3-now span'].some(q=>{const e=c.querySelector(q);return e.scrollWidth>e.clientWidth+1})||(c.querySelector('.mk3-one').scrollHeight>c.querySelector('.mk3-one').clientHeight+1)).map(c=>c.querySelector('.mk3-t').innerText),heights:[...new Set([...document.querySelectorAll('.mk3')].map(c=>Math.round(c.getBoundingClientRect().height)))]})`));
for(const k of ['agent','rule','mix','all']){ await J(`mkKindPick('${k}')`); await sleep(700); console.log('kind',k, await J(`document.querySelectorAll('.mk3').length+' cards, pager '+document.querySelectorAll('.mk-pg').length`)); }
for(const s of ['ret','fw','win']){ await J(`tfSS3SortPick('${s}')`); await sleep(700); console.log('sort',s, await J(`JSON.stringify([...document.querySelectorAll('.mk3')].slice(0,4).map(c=>c.querySelector('.mk3-t').innerText+' '+c.querySelector('.mk3-ret b').innerText+' '+c.querySelector('.mk3-facts').innerText.replace(/\\s+/g,' ')))`)); }
for(const q of ['엔비디아','혼합','비트코인 큰 하락 뒤','@june07','맞물림','h1','네 시장에서 둘']){ await J(`tfSS3Search(${JSON.stringify(q)})`); await sleep(500); console.log('search',q, await J(`JSON.stringify([...document.querySelectorAll('.mk3 .mk3-t')].map(x=>x.innerText))`)); }
await J(`tfSS3Search('')`); await J(`tfSS3Page(7)`); await sleep(600);
console.log('page7', await J(`document.querySelector('.mk3 .mk3-t').innerText+' / '+document.querySelectorAll('.mk3').length`));
// 상세 탭: 유형별
for(const nm of ['세 갈래','되짚기','맞물림']){ for(const tb of ['ov','perf','trades','log','info']){ await J(`tfSS3Go(tfSSNe(${JSON.stringify(nm)}),'all','${tb}')`); await sleep(900); const tx=await J(`(document.querySelector('.mk-dbody')||{innerText:'NO BODY'}).innerText.replace(/\\s+/g,' ').slice(0,150)`); console.log(nm,tb,'|',tx); } }
await J(`tfSS3Go(tfSSNe('세 갈래'),'1y','perf')`); await sleep(1000); console.log('1y perf', await J(`(document.querySelector('.mk-kpis')||{innerText:''}).innerText.replace(/\\s+/g,' ')`));
// 옛 이름과 ID 로 조회
console.log('find', await J(`JSON.stringify(['d1','세 갈래','비트코인 바겐세일','김대리의 나스닥','애플 농부'].map(k=>{const s=tfSSFind(k);return k+'→'+(s?s.id:'null')}))`));
// 따라가기(로그인 프리셋 없이 S.user 지정)
await J(`S.user={name:'테스터'};tfShareHub('find')`); await sleep(800);
for(const nm of ['세 갈래','되짚기','맞물림']){ await J(`mkFollowSheet(tfSSNe(${JSON.stringify(nm)}))`); await sleep(900); console.log('sheet',nm, await J(`(document.querySelector('.mk-f-strat')||{innerText:'NO SHEET'}).innerText.replace(/\\s+/g,' ')+' | min:'+((document.getElementById('cps-amt-err')||{}).textContent||'')+' '+((document.querySelector('.mk-f')||document.body).innerText.match(/최소[^\\n]{0,30}/)||[''])[0]`)); if(nm==='세 갈래') await shot(p,OUT+'r2-follow-sheet.png',{full:false}); await J(`mkFollowClose(true)`); }
// 다른 화면
for(const h of ['#/trade','#/strategy','#/strategy/backtest']){ await J(`location.hash=${JSON.stringify(h)}`); await sleep(1300); }
await J(`typeof gHome==='function'&&gHome()`); await sleep(900);
await J(`typeof tfTermView==='function'&&tfTermView()`); await sleep(900);
console.log('errs', await J(`JSON.stringify({e:__e,price:PRICE===PRICE0})`));
await closePage(p);
