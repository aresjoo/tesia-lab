// 터미널(AI 트레이딩) 캡처와 글자 스타일 덤프: 전략 없음, 전략 있음 (1440, 390)
// 사용: node qa/gpt-skin/cap-term.mjs [url] [outDir]
import { newPage, closePage, goto, evala, viewport, shot, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
import fs from 'fs';
const B=process.argv[2]||'http://127.0.0.1:8765/index.html';
const OUT=process.argv[3]||decodeURIComponent(new URL('./term/r/',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1'); fs.mkdirSync(OUT,{recursive:true});
const p=await newPage();
const dump=`JSON.stringify((function(){ var root=document.querySelector('#g-content'); var out=[], seen={};
  function path(e){ var a=[]; while(e&&e!==root&&a.length<4){ var c=String(e.className&&e.className.baseVal!=null?e.className.baseVal:e.className||'').split(' ').filter(Boolean).slice(0,2).join('.'); a.unshift(e.tagName.toLowerCase()+(c?'.'+c:'')); e=e.parentElement; } return a.join(' > '); }
  [].forEach.call(root.querySelectorAll('*'),function(e){ var own=[].some.call(e.childNodes,function(n){ return n.nodeType===3&&n.nodeValue.trim(); }); if(!own) return; if(e.closest('svg,iframe')) return; var c=getComputedStyle(e); if(c.display==='none') return; var k=path(e)+'|'+c.fontSize+'|'+c.fontWeight; if(seen[k]) return; seen[k]=1; out.push(path(e)+' | '+c.fontSize+' '+c.fontWeight+' '+c.color+' bg:'+c.backgroundColor+' r:'+c.borderRadius+' | '+[].filter.call(e.childNodes,function(n){ return n.nodeType===3; }).map(function(n){ return n.nodeValue.trim(); }).join(' ').slice(0,50)); });
  return out; })())`;
const res={};
for(const [W,M] of [[1440,false],[390,true]]){ const sx=M?'-m':'';
  for(const [preset,tag] of [['12','empty'],['05','list']]){
    await viewport(p,W,900,{mobile:M}); await goto(p,B+'?v='+Date.now(),1200); await evala(p,`localStorage.clear()`); await goto(p,B+'?v='+Date.now(),3000);
    await evala(p,`var s=document.createElement('style'); s.textContent='#tf-devbtn,#tf-devpanel,#teth-help{display:none!important} iframe{visibility:hidden!important}'; document.head.appendChild(s)`);
    await evala(p,`tfQaPreset('${preset}')`); await sleep(1200);
    if(tag==='list') await evala(p,`window.TF_PREVIEW=true`); await evala(p,`location.hash='#/trade'`); await sleep(3500); if(tag==='list') await evala(p,`(function(){ var c=document.querySelector('.tft-card'); c&&c.click(); })()`); await sleep(1200);
    await evala(p,`[].forEach.call(document.querySelectorAll('iframe'),function(f){ f.remove(); })`); await sleep(600); await shot(p,OUT+'T-'+tag+sx+'.png',{full:false});
    if(!M) res[tag]=JSON.parse(await evala(p,dump));
    console.log(W,tag,await evala(p,`JSON.stringify({root:(document.querySelector('#g-content > *')||{}).className,strats:document.querySelectorAll('.tft-card').length})`));
  }
}
fs.writeFileSync(OUT+'term-style.json',JSON.stringify(res,null,1));
await closePage(p);
