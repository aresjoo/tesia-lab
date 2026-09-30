// 설정 화면 캡처: ChatGPT 참고(webp → png 변환)와 TETH 현재 화면(프리셋별)
// 사용: node qa/gpt-skin/cap-settings.mjs [url] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./settings/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
fs.mkdirSync(OUT,{recursive:true});
const REF=decodeURIComponent(new URL('./settings/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
const IMG='C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/images/';
const p=await newPage();
// 참고 이미지 변환 (한 번만)
if(!fs.existsSync(REF+'ref-general.png')){
  for(const [src,name,w,h] of [['93.webp','ref-general',2000,1068],['94.webp','ref-appearance',2000,1159],['95.webp','ref-account',2000,1154]]){
    await viewport(p,w,h,{}); await goto(p,'file:///'+IMG+src,600); await shot(p,REF+name+'.png',{full:false});
  }
}
const J=async(x)=>JSON.parse(await evala(p,`JSON.stringify(${x})`));
const cap=async(W,H,M,preset,tab,name)=>{
  await viewport(p,W,H,{mobile:M}); await goto(p,B+'?v='+Date.now(),1200);
  await evala(p,`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now(),2500);
  await evala(p,`var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s)`);
  await evala(p,`tfQaPreset('${preset}')`); await sleep(1200);
  await evala(p,`stGo('${tab}')`); await sleep(1200);
  await shot(p,OUT+name+(M?'-m':'')+'.png',{full:false});
  return J(`{h:location.hash,title:(document.querySelector('#st-main h1,#st-main h2')||{}).innerText}`);
};
const L=[['13','billing','B1-billing-sub'],['15','billing','B2-billing-expired'],['12','billing','B3-billing-invite'],['14','security','S1-security'],['02','security','S2-security-none'],['13','general','G1-general'],['13','account','A1-account']];
for(const [pr,tab,n] of L) console.log(n,JSON.stringify(await cap(1440,900,false,pr,tab,n)));
for(const [pr,tab,n] of L.slice(0,4)) console.log(n+'-m',JSON.stringify(await cap(390,844,true,pr,tab,n)));
await closePage(p);
