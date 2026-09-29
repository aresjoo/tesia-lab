const fs=require('fs'), D=__dirname+'/';
let c=fs.readFileSync(D+'rd.css','utf8');
const one=(s,a,b)=>{ const n=s.split(a).length-1; if(n!==1) throw new Error('x'+n+': '+a.slice(0,60)); return s.replace(a,()=>b); };
c=one(c,"#g-root .mk3-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}\n@media (max-width:1180px){#g-root .mk3-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}\n@media (max-width:1000px){#g-root .mk3-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}\n",
 "#g-root .mk3-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}\n@media (max-width:1100px){#g-root .mk3-grid{gap:14px}}\n");
c+=`
/* 2열 가로형 카드: 왼쪽은 무엇을 하는 시스템인지, 오른쪽은 성과와 버튼 */
@media (min-width:1101px){
  #g-root .mk3{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);grid-template-rows:auto auto 1fr auto;column-gap:32px;align-items:start;padding:24px 26px 22px}
  #g-root .mk3 .mk3-head{grid-column:1;grid-row:1}
  #g-root .mk3 .mk3-head h3,#g-root .mk3 .mk3-t{font-size:20px}
  #g-root .mk3 .mk3-how{grid-column:1;grid-row:2}
  #g-root .mk3 .mk3-one{grid-column:1;grid-row:3;margin-top:8px;font-size:15px;min-height:0}
  #g-root .mk3 .mk3-now{grid-column:1;grid-row:4;margin-top:16px;padding-top:12px;font-size:13px}
  #g-root .mk3 .mk3-perf{grid-column:2;grid-row:1 / span 2;margin:0;gap:18px}
  #g-root .mk3 .mk3-ret b{font-size:22px}
  #g-root .mk3 .mk-spark{width:112px;height:42px}
  #g-root .mk3 .mk3-stats{grid-column:2;grid-row:3;margin:14px 0 0;align-self:end}
  #g-root .mk3 .mk3-foot{grid-column:2;grid-row:4;margin-top:16px}
}
@media (min-width:1101px) and (max-width:1279px){
  #g-root .mk3{column-gap:22px;padding:22px 22px 20px}
  #g-root .mk3 .mk-spark{width:84px;height:36px}
  #g-root .mk3 .mk3-ret b{font-size:20px}
  #g-root .mk3 .mk3-foot .mk3-x{display:none}
}
`;
fs.writeFileSync(D+'rd.css',c);
let s=fs.readFileSync(D+'rd-ui.js','utf8');
s=one(s,"  var PER=20, MAXP=10;","  var PER=10, MAXP=10; /* 2열 5행 */");
fs.writeFileSync(D+'rd-ui.js',s); console.log('ok');
