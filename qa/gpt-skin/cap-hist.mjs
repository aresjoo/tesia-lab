// 연구 기록 화면 캡처: 비어 있을 때, 기록이 있을 때, 검색 (1440, 390)
// 사용: node qa/gpt-skin/cap-hist.mjs [url] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./hist/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
for(const [W,M] of [[1440,false],[390,true]]){ const sx=M?'-m':'';
  await viewport(p,W,900,{mobile:M}); await goto(p,B+'?v='+Date.now(),1200); await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now(),3000);
  await evala(p,`var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel,#teth-help{display:none!important}'; document.head.appendChild(s)`);
  await evala(p,`tfQaPreset('12')`); await sleep(1200);
  await evala(p,`gHistory()`); await sleep(900);
  await shot(p,OUT+'H1-empty'+sx+'.png',{full:false});
  await evala(p,`['비트코인 급락 매수 전략','이더리움 RSI 전략','BNB 평균선 분석','나스닥 하락 뒤 반등'].forEach(function(t,i){ G.sessions.push({id:'s'+(Date.now()-i*86400000*(i===0?0:i+1)),title:t,convo:[]}); }); gHistory()`); await sleep(900);
  await shot(p,OUT+'H2-list'+sx+'.png',{full:false});
  await evala(p,`var q=document.getElementById('g-hist-q'); q.value='비트'; q.dispatchEvent(new Event('input'))`); await sleep(500);
  await shot(p,OUT+'H3-search'+sx+'.png',{full:false});
  console.log(W,await evala(p,`JSON.stringify({ph:document.getElementById('g-hist-q').placeholder,rows:document.querySelectorAll('.g-hist-row').length,fs:getComputedStyle(document.querySelector('.g-hist-row .t')).fontSize,bg:getComputedStyle(document.querySelector('.g-hist-search')).backgroundColor})`));
}
await closePage(p);
