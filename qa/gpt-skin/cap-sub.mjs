// 하위 페이지(다운로드, 소개, 정책, 인사이트) 전체 캡처. 스크롤에 나타나는 애니메이션은 끝난 상태로 고정
// 사용: node qa/gpt-skin/cap-sub.mjs [base] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/';
const OUT=process.argv[3]||decodeURIComponent(new URL('./sub/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
const PAGES=[['dl','download/'],['about','about/'],['pol','policies/#privacy'],['insight','index.html#/insight']];
const settle=`(function(){ var s=document.createElement('style'); s.textContent='*{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}[class*=reveal],[class*=fade],[data-reveal],.rv,.in,.sr{opacity:1!important;transform:none!important;visibility:visible!important}#tf-devbtn,#qa2-panel{display:none!important}'; document.head.appendChild(s);
  [].forEach.call(document.querySelectorAll('img[loading=lazy]'),function(i){ i.loading='eager'; });
  var all=document.querySelectorAll('*'); [].forEach.call(all,function(e){ var cs=getComputedStyle(e); if(cs.opacity==='0'&&e.getBoundingClientRect().height>20){ e.style.opacity='1'; e.style.transform='none'; } }); })()`;
for(const [W,H,M] of [[1440,900,false],[390,844,true]]){ const sx=M?'-m':'';
  await viewport(p,W,H,{mobile:M});
  for(const [k,u] of PAGES){
    await goto(p,B+u,4500);
    /* 끝까지 천천히 내려 지연 이미지와 나타나는 요소를 깨운 뒤 맨 위로 */
    await evala(p,`(async function(){ var sc=document.getElementById('g-scroll')||document.scrollingElement; for(var y=0;y<sc.scrollHeight;y+=600){ sc.scrollTop=y; window.scrollTo(0,y); await new Promise(function(r){ setTimeout(r,120); }); } sc.scrollTop=0; window.scrollTo(0,0); })()`);
    await sleep(2500); await evala(p,settle); await sleep(1500);
    const info=await evala(p,`JSON.stringify({h:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,title:document.title,imgs:[].map.call(document.images,function(i){ return (i.getAttribute('src')||'').slice(0,60)+' '+i.naturalWidth; }).filter(function(x){ return !/data:|logo/.test(x); }).slice(0,12)})`);
    console.log(W,k,info);
    await shot(p,OUT+k+sx+'.png',{full:true});
  }
}
await closePage(p); process.exit(0);
