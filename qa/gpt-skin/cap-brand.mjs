// Bitget 청록 로고, 푸터 선, 심볼 이름, 질문 패널 압축 확인 캡처
// 사용: node qa/gpt-skin/cap-brand.mjs [url] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./brand/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
const hide=`var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel,#teth-help{display:none!important}'; document.head.appendChild(s)`;
const toFooter=`(function(){ var f=document.querySelector('.gft'); if(!f) return 'nofooter'; f.scrollIntoView({block:'start'}); return 'ok'; })()`;
for(const [W,M] of [[1440,false],[390,true]]){ const sx=M?'-m':'';
  await viewport(p,W,900,{mobile:M}); await goto(p,B+'?v='+Date.now(),1200); await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now(),3000);
  await evala(p,hide); await evala(p,`tfQaPreset('12')`); await sleep(1200);
  await evala(p,`gHome()`); await sleep(1500);
  await shot(p,OUT+'H1-home-top'+sx+'.png',{full:false});
  console.log('home footer',await evala(p,toFooter)); await sleep(800);
  await shot(p,OUT+'H2-home-footer'+sx+'.png',{full:false});
  await evala(p,`tfShareHub('find')`); await sleep(2200);
  await shot(p,OUT+'F1-find'+sx+'.png',{full:false});
  console.log('names',await evala(p,`[].slice.call(document.querySelectorAll('#g-content h3, #g-content .skf-t, #g-content b')).map(function(e){return e.textContent.trim();}).filter(function(t){return /평균선|추세|하락|빨리/.test(t);}).slice(0,8).join(' | ')`));
  console.log('find footer',await evala(p,toFooter)); await sleep(800);
  await shot(p,OUT+'F2-find-footer'+sx+'.png',{full:false});
  // 질문 패널
  await evala(p,`gNew({text:'비트코인 나 대신 거래해줘',html:'비트코인 나 대신 거래해줘'})`); await sleep(1200);
  await evala(p,`try{ TAI.req=null; TAI.busy=false; }catch(e){}; skaCard({steps:[{title:'어떤 방식으로 운용할까요?',options:[{t:'AI 판단',d:'AI가 시장을 보고 직접 사고팝니다'},{t:'차트 규칙',d:'정한 조건에서만 사고팝니다'}]},{title:'얼마나 오르면 팔겠습니까?',options:[{t:'5% 익절',d:'짧게 자주 수익을 챙깁니다'},{t:'10% 익절',d:'수익 폭과 빈도 사이 균형형입니다'},{t:'20% 익절',d:'큰 상승을 끝까지 기다립니다'},{t:'익절 없음',d:'보유 한도 25일이 되면 정리합니다'}]}]})`); await sleep(900);
  await evala(p,`skaNav(Object.keys(TAI.qcfg).pop(),1)`); await sleep(500);
  console.log('ska h',await evala(p,`Math.round(document.querySelector('.ska').getBoundingClientRect().height)`));
  await shot(p,OUT+'A1-ask'+sx+'.png',{full:false});
}
// 독립 페이지 푸터
await viewport(p,1440,900,{}); await goto(p,B.replace('index.html','about/')+'?v='+Date.now(),2500);
await evala(p,toFooter); await sleep(800); await shot(p,OUT+'P1-about-footer.png',{full:false});
await closePage(p);
