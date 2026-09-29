const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
const G="  if(TF_MKF.hold&&Date.now()<TF_MKF.hold) return; /* 예산 추가 직후의 연속 입력 */";
let t=fs.readFileSync(F,'utf8'); const n=t.split(G+'\r\n').length-1; if(n!==1) throw new Error('g x'+n); t=t.replace(G+'\r\n',''); fs.writeFileSync(F,t);
const A="  if(!$('cps-amt')||!cpFormSync()){ toast('입력을 확인해주세요'); return; }"; if(t.split(A).length-1!==1) throw new Error('anchor');
let a=fs.readFileSync(D+'apply2.cjs','utf8'); const L=a.split('\n'), i=L.findIndex(x=>x.startsWith('rep("  var amt=parseFloat(')); if(i<0) throw new Error('line');
L[i]="rep(\""+A+"\",\""+G+"\"+String.fromCharCode(10)+\""+A+"\",true);";
fs.writeFileSync(D+'apply2.cjs',L.join('\n')); console.log('ok');
