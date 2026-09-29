const fs=require('fs'), D=__dirname+'/';
let c=fs.readFileSync(D+'bt4.css','utf8');
const a=c.indexOf('@media (max-width:900px){'), b=c.indexOf('@media (max-width:640px){');
if(a<0||b<0||b<a) throw new Error('blocks');
const blk=[
'@media (max-width:900px){',
'  .bt-grid{display:flex;flex-direction:column;gap:18px;width:100%}',
'  .bt-main{width:100%}',
'  .bt[data-phase=ready] .bt-rail .bt-box:not(.bt-set){display:block}',
'  /* 결과: 그래프와 요약 칸, 그다음 결과 요약, 그다음 근거 */',
'  .bt[data-phase=result] .bt-grid{gap:0}',
'  .bt[data-phase=result] .bt-main{display:contents}',
'  .bt[data-phase=result] .bt-cap{order:1;width:100%}',
'  .bt[data-phase=result] .bt-chart{order:2;width:100%}',
'  .bt[data-phase=result] .bt-panel{order:3;width:100%}',
'  .bt[data-phase=result] .bt-rail{order:4;margin-top:18px}',
'  .bt[data-phase=result] .bt-ev{order:5;margin-top:30px;width:100%}',
'  .bt[data-phase=result] .bt-rail .bt-cta{display:none}',
'  .bt[data-phase=result] .bt-rail .bt-sec{display:block}',
'  .btg-me .mret{display:block}',
'}',''].join('\n');
c=c.slice(0,a)+blk+c.slice(b);
fs.writeFileSync(D+'bt4.css',c); console.log('ok');
