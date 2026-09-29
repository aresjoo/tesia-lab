const fs=require('fs'), D=__dirname+'/'; let c=fs.readFileSync(D+'rd.css','utf8');
const i=c.indexOf('/* 2열 가로형 카드'); if(i<0) throw new Error('i'); c=c.slice(0,i)+`/* 2열 가로형 카드: 왼쪽은 무엇을 하는 시스템인지, 오른쪽은 성과와 버튼. 1280 미만은 2열 세로형, 640 이하는 1열 */
@media (min-width:1280px){
  #g-root .mk3{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);grid-template-rows:auto auto 1fr auto;column-gap:32px;align-items:start;padding:24px 26px 22px}
  #g-root .mk3 .mk3-head{grid-column:1;grid-row:1}
  #g-root .mk3 .mk3-head h3,#g-root .mk3 .mk3-t{font-size:20px}
  #g-root .mk3 .mk3-how{grid-column:1;grid-row:2}
  #g-root .mk3 .mk3-one{grid-column:1;grid-row:3;margin-top:8px;font-size:15px;min-height:45px}
  #g-root .mk3 .mk3-now{grid-column:1;grid-row:4;margin-top:16px;padding-top:12px;font-size:13px}
  #g-root .mk3 .mk3-perf{grid-column:2;grid-row:1 / span 2;margin:0;gap:18px}
  #g-root .mk3 .mk3-ret b{font-size:22px}
  #g-root .mk3 .mk-spark{width:112px;height:42px}
  #g-root .mk3 .mk3-stats{grid-column:2;grid-row:3;margin:14px 0 0;align-self:end}
  #g-root .mk3 .mk3-foot{grid-column:2;grid-row:4;margin-top:16px}
}
@media (min-width:1280px) and (max-width:1439px){
  #g-root .mk3{column-gap:26px}
  #g-root .mk3 .mk3-one{font-size:14.5px;min-height:44px}
}
`; fs.writeFileSync(D+'rd.css',c); console.log('ok');
