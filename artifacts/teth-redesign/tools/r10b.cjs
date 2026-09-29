const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
const G="  if(TF_MKF.hold&&Date.now()<TF_MKF.hold) return; /* 예산 추가 직후의 연속 입력 */";
let t=fs.readFileSync(F,'utf8'); const n=t.split('\r\n'+G).length-1; if(n!==1) throw new Error('g x'+n); t=t.replace('\r\n'+G,''); fs.writeFileSync(F,t);
let a=fs.readFileSync(D+'apply2.cjs','utf8'); const L=a.split('\n'), i=L.findIndex(x=>x.startsWith('rep("  nick=s2.nick; /* ID 나')); if(i<0) throw new Error('line');
L[i]="rep(\"  var amt=parseFloat($('cps-amt').value);\",\"  if(TF_MKF.hold&&Date.now()<TF_MKF.hold) return; /* 예산 추가 직후의 연속 입력 */\"+String.fromCharCode(10)+\"  var amt=parseFloat($('cps-amt').value);\",true);";
fs.writeFileSync(D+'apply2.cjs',L.join('\n')); console.log('ok');
