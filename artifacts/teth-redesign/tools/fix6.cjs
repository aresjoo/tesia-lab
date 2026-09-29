const fs=require('fs'); let s=fs.readFileSync('rd-ui.js','utf8');
const a="var MK_MOB=window.innerWidth<=640;\nwindow.addEventListener('resize',function(){ var m=window.innerWidth<=640; if(m===MK_MOB) return; MK_MOB=m; var g=document.getElementById('mkd-chart'); if(g&&typeof mkdChartHtml==='function'){ g.classList.remove('hov'); g.innerHTML=mkdChartHtml(); } });";
if(s.split(a).length!==2) throw new Error('a');
s=s.replace(a,"function mkChartW(){ var vw=window.innerWidth||1200; return Math.round(Math.max(360,Math.min(1136,vw-(vw>860?304:40)))/20)*20; }\nvar MK_CW=mkChartW();\nwindow.addEventListener('resize',function(){ var w=mkChartW(); if(w===MK_CW) return; MK_CW=w; var g=document.getElementById('mkd-chart'); if(g&&typeof mkdChartHtml==='function'){ g.classList.remove('hov'); g.innerHTML=mkdChartHtml(); } });");
s=s.replace("/* 화면 폭이 좁은 화면 기준(640px)을 넘나들면 성과 차트를 다시 그린다 */","/* 화면 폭이 바뀌면 성과 차트의 좌표를 다시 잡아 그린다 */");
fs.writeFileSync('rd-ui.js',s); console.log('ok');
