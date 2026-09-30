// 전략 상세 화면 캡처 (위, 스크롤 중간, 정보 탭, 모바일)
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./detail/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
for(const [W,H,M] of [[1440,900,false],[390,844,true]]){ const sx=M?'-m':'';
  await viewport(p,W,H,{mobile:M}); await goto(p,B+'?v='+Date.now(),1200); await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now(),3000);
  await evala(p,`var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s)`);
  await evala(p,`tfQaPreset('12')`); await sleep(1200);
  const nick=await evala(p,`(function(){ var r=tfSSRows().filter(function(s){ return !s.me&&/양방향 2배/.test(mkTitle(s)); })[0]||tfSSRows().filter(function(s){ return !s.me; })[0]; return r.nick; })()`);
  await evala(p,`location.hash='#/share/s/'+encodeURIComponent('${nick}')`); await sleep(2500);
  await shot(p,OUT+'D1-top'+sx+'.png',{full:false});
  for(const [k,y] of [['D2-mid',0.9],['D3-low',1.8],['D4-lower',2.7]]){ await evala(p,`document.getElementById('g-scroll').scrollTop=innerHeight*${y}`); await sleep(700); await shot(p,OUT+k+sx+'.png',{full:false}); }
  const tab=await evala(p,`(function(){ var b=[].filter.call(document.querySelectorAll('button,[role=tab]'),function(x){ return x.innerText.trim()==='정보'; })[0]; if(b){ b.click(); return 'ok'; } return 'none'; })()`);
  await evala(p,`document.getElementById('g-scroll').scrollTop=0`); await sleep(900); await shot(p,OUT+'D5-info'+sx+'.png',{full:false});
  console.log(W,nick,tab, await evala(p,`document.getElementById('g-scroll').scrollHeight`));
}
await closePage(p);
