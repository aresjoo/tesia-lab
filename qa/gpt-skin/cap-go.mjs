// 백테스트 실행 준비 화면(#/share/bt/mine/go) 캡처: 내 전략 + 실행 자격 있음
// 사용: node qa/gpt-skin/cap-go.mjs [url] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./go/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
const J=async(x)=>{ try{ return JSON.parse(await evala(p,`JSON.stringify(${x})`)); }catch(e){ return {err:String(e).slice(0,300)}; } };
const cap=async(W,H,M,preset,spec,name)=>{
  await viewport(p,W,H,{mobile:M}); await goto(p,B+'?v='+Date.now(),1200);
  await evala(p,`localStorage.clear(); sessionStorage.clear()`); await goto(p,B+'?v='+Date.now(),2800);
  await evala(p,`var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel{display:none!important}'; document.head.appendChild(s); window.__errs=[]; window.addEventListener('error',function(e){ __errs.push(String(e.message)); })`);
  await evala(p,`tfQaPreset('${preset}')`); await sleep(1200);
  await evala(p,`tfAiStrategy(${spec})`); await sleep(900);
  await evala(p,`location.hash='#/share/bt/mine'`); await sleep(2500); await evala(p,`BT.per=0; btReady(); btCompute(); btFinish()`); await sleep(2200);
  await shot(p,OUT+name+'-result'+(M?'-m':'')+'.png',{full:false});
  const r1=await J(`{bad:rvBad(),ret:+BT.R.ret.toFixed(1),btns:[].map.call(document.querySelectorAll('#bt-root .bt-cta,#bt-root .bt-sec'),function(b){ return b.innerText.trim(); })}`);
  await evala(p,`btUse()`); await sleep(1800);
  await evala(p,`document.getElementById('g-scroll').scrollTop=0`); await sleep(300);
  await shot(p,OUT+name+(M?'-m':'')+'.png',{full:false});
  const r2=await J(`{hash:location.hash,mode:G.mode,title:(document.querySelector('#bt-root h1,#bt-root h2,#pl-root h1')||{}).innerText,txt:(document.getElementById('bt-root')||document.getElementById('pl-root')||{innerText:''}).innerText.replace(/\\s+/g,' ').slice(0,500),errs:window.__errs}`);
  return {r1,r2};
};
const GOOD="{asset:'비트코인',depth:'deep',tp:12,sl:-8,fng:30,trend:true,period:'all',name:'크게 빠질 때 사는 비트코인'}";
for(const [W,H,M] of [[1440,900,false],[390,844,true]]){
  console.log('G1 invite', JSON.stringify(await cap(W,H,M,'12',GOOD,'G1-go-invite')));
  console.log('G2 sub', JSON.stringify(await cap(W,H,M,'13',GOOD,'G2-go-sub')));
}
await closePage(p);
