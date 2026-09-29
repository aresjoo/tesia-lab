const fs=require('fs'), D=__dirname+'/';
let s=fs.readFileSync(D+'rd-ui.js','utf8');
const i=s.indexOf('function mkSpark3(eq){'), j=s.indexOf('\n',i); if(i<0) throw new Error('spark');
s=s.slice(0,i)+fs.readFileSync(D+'spark3.js','utf8').trimEnd()+s.slice(j);
fs.writeFileSync(D+'rd-ui.js',s);
fs.appendFileSync(D+'rd.css',`
/* 카드 그래프: 넓고 높게, 수익률 숫자 오른쪽에서 칸의 남은 폭을 다 쓴다 */
#g-root .mk3v2 .mk3-perf{align-items:stretch;gap:16px}
#g-root .mk3v2 .mk-spark{flex:1 1 0;min-width:0;width:auto;max-width:170px;height:56px;margin-left:auto;opacity:1}
@media (max-width:1279px){ #g-root .mk3v2 .mk-spark{height:48px;max-width:150px} }
@media (max-width:640px){ #g-root .mk3v2 .mk-spark{max-width:160px} }
`);
console.log('ok');
