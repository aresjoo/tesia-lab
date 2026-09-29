// main(좌수 계산)에서 cpCalc 가 다시 쓰였다. 5번 교체는 main 쪽 코드가 이미 품고 있으므로 뺀다
const fs=require('fs'), D=__dirname+'/', LF=String.fromCharCode(10);
let a=fs.readFileSync(D+'apply2.cjs','utf8');
const L=a.split(LF), i=L.findIndex(x=>x.indexOf('// 5. 원본을 찾지 못한 따라가기는')===0);
if(i<0) throw new Error('line');
if(L[i+1].indexOf('rep("if(!s2||!s2.r.eq')!==0||L[i+2].indexOf('missing:!s2};",true);')<0) throw new Error('shape');
L.splice(i,3,'// 5. (뺌) 원본을 찾지 못한 따라가기 표시: 좌수 계산으로 다시 쓴 cpCalc 의 none 값에 missing 이 들어 있다');
fs.writeFileSync(D+'apply2.cjs',L.join(LF)); console.log('ok');
