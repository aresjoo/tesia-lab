const fs=require('fs'), D=__dirname+'/';
let c=fs.readFileSync(D+'rd.css','utf8'); const i=c.indexOf('/* 카드 그래프:'); if(i<0) throw new Error('css'); c=c.slice(0,i)+`/* 카드 그래프: 수익률 숫자 오른쪽에서 칸의 남은 폭을 쓰고, 라벨부터 숫자 아래까지 세로로 걸친다 */
#g-root .mk3v2 .mk3-perf{align-items:flex-start;gap:16px}
#g-root .mk3v2 .mk-spark{flex:1 1 0;min-width:0;width:auto;max-width:180px;height:78px;margin-left:auto;opacity:1}
@media (min-width:1280px){ #g-root .mk3v2 .mk3-facts{margin-top:8px} }
@media (max-width:1279px){ #g-root .mk3v2 .mk-spark{height:68px;max-width:170px} }
@media (max-width:640px){ #g-root .mk3v2 .mk-spark{height:68px;max-width:170px} }
`; fs.writeFileSync(D+'rd.css',c);
let s=fs.readFileSync(D+'rd-ui.js','utf8'); const a="var W=150, H=56, pad=4,"; if(s.split(a).length-1!==1) throw new Error('js'); s=s.replace(a,"var W=170, H=78, pad=5,"); fs.writeFileSync(D+'rd-ui.js',s); console.log('ok');
