// 시안을 얹은 화면을 1440 과 390 으로 찍는다
import fs from 'fs';
import { newPage, closePage, goto, evala, viewport, shot, shotEl, sleep } from 'file:///C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
const OUT='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/ux-audit/finder-h/';
const MOCK=fs.readFileSync(new URL('./hmock.js',import.meta.url),'utf8');
const p=await newPage();
for(const [w,h,m] of [[1440,1000,false],[390,844,true]]){
  await viewport(p,w,h,{mobile:m});
  await goto(p,'http://127.0.0.1:8765/index.html?v='+Date.now()); await sleep(1200);
  await evala(p,`localStorage.clear()`); await goto(p,'http://127.0.0.1:8765/index.html?v='+Date.now()+'#/share'); await sleep(2400);
  await evala(p,MOCK+';1');
  const detail=async(id,tag,sel,pad)=>{ await evala(p,`tfSS3Go('${id}','all','ov')`); await sleep(1700);
    if(sel){ await evala(p,`document.querySelector('${sel}').scrollIntoView({block:'center'})`); await sleep(400); }
    await shot(p,OUT+tag+'-'+w+'.png',{full:false}); };
  // H1
  await evala(p,`HM.reset()`); await detail('r1','h1-now');
  for(const v of [1,2,3]){ await evala(p,`HM.reset();HM.h1(${v})`); await detail('r1','h1-v'+v);
    console.log(w,'h1 v'+v, await evala(p,`(()=>{var k=document.querySelector('#mk3-kpi-host .mk3-kpis');return [...k.children].map(x=>x.querySelector('small').childNodes[0].textContent.trim()+'='+x.querySelector('b').innerText+' h'+Math.round(x.getBoundingClientRect().height)).join(' | ')+' rowH '+Math.round(k.getBoundingClientRect().height)})()`)); }
  // H5
  await evala(p,`HM.reset()`); await detail('h4','h5-now');
  for(const v of [1,2]){ await evala(p,`HM.reset();HM.h5(${v})`); await detail('h4','h5-v'+v);
    console.log(w,'h5 v'+v, await evala(p,`(()=>{var g=document.getElementById('mkd-chart');return 'NaN '+(g.innerHTML.match(/NaN/g)||[]).length+' h '+Math.round(g.getBoundingClientRect().height)})()`));
    await evala(p,`mkdSet('tab','bal')`); await sleep(1200); await shot(p,OUT+'h5-v'+v+'-bal-'+w+'.png',{full:false}); }
  // H6
  await evala(p,`HM.reset()`); await detail('r1','h6-now','#ss3-cal-host');
  for(const v of [1,2]){ await evala(p,`HM.reset();HM.h1(1);HM.h6(${v})`); await detail('r1','h6-v'+v,'#ss3-cal-host');
    console.log(w,'h6 v'+v, await evala(p,`document.querySelector('#ss3-cal-host .mt2').innerText`)); }
  // H4
  for(const v of ['C','A','B']){ await evala(p,`HM.reset();HM.h4('${v}');tfShareHub('find')`); await sleep(2200);
    await shot(p,OUT+'h4-'+v+'-'+w+'.png',{full:false});
    console.log(w,'h4 '+v, await evala(p,`(()=>{var c=[...document.querySelectorAll('.mk3')];return 'cardH '+c.slice(0,4).map(x=>Math.round(x.getBoundingClientRect().height)).join(',')+' docW '+document.documentElement.scrollWidth+' facts '+c[0].querySelector('.mk3-facts').innerText.replace(/\\s+/g,' ')})()`)); }
  await evala(p,`HM.reset()`);
}
// H2: 정렬 결과 비교(글)
console.log('h2', await evala(p,`(()=>{var R=tfSSRows().slice();var a=R.slice().sort((x,y)=>(y.r.winRate||0)-(x.r.winRate||0)).map(s=>s.id+' '+Math.round(s.r.winRate||0)+'%/'+s.r.n);var b=R.slice().sort((x,y)=>{var lx=(x.r.n||0)<20?1:0,ly=(y.r.n||0)<20?1:0;return lx-ly||(y.r.winRate||0)-(x.r.winRate||0)}).map(s=>s.id+' '+Math.round(s.r.winRate||0)+'%/'+s.r.n);return '지금: '+a.join(', ')+' || 20건 미만 뒤로: '+b.join(', ')})()`));
console.log('errs', await evala(p,`JSON.stringify(window.__errs||[])`));
await closePage(p);
