// 하위 페이지를 화면 높이 단위로 잘라 캡처 (전체 캡처는 축소돼 세부가 안 보이므로)
// 사용: node qa/gpt-skin/cap-seg.mjs <path> <name> [w] [h] [mobile]
import { newPage, goto, evala, viewport, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const [,, path, name, W='1440', H='900', mob] = process.argv;
const OUT=decodeURIComponent(new URL('./sub/seg/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
fs.mkdirSync(OUT,{recursive:true});
const w=+W, h=+H, m=!!mob;
const p=await newPage();
await viewport(p,w,h,m?{dsf:2,mobile:true}:{});
await goto(p,'http://127.0.0.1:8765/'+path);
await sleep(1500);
await evala(p,`(function(){ var s=document.createElement('style'); s.textContent='*{animation-duration:0s!important;transition:none!important}.rv,[class*=reveal]{opacity:1!important;transform:none!important}#tf-devbtn,#qa2-panel{display:none!important}'; document.head.appendChild(s); [].forEach.call(document.querySelectorAll('img[loading=lazy]'),function(i){ i.loading='eager'; }); })()`);
const total=await evala(p,`(async function(){ for(var y=0;y<document.documentElement.scrollHeight;y+=600){ window.scrollTo(0,y); await new Promise(function(r){ setTimeout(r,80); }); } window.scrollTo(0,0); return document.documentElement.scrollHeight; })()`);
await sleep(800);
let i=0;
for(let y=0;y<total;y+=h){
  const r=await p.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y,width:w,height:Math.min(h,total-y),scale:m?1:1}});
  fs.writeFileSync(OUT+name+'-'+(i++)+'.png',Buffer.from(r.data,'base64'));
}
console.log(name,total,i);
process.exit(0);
