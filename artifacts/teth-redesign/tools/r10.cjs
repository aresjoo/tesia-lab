const fs=require('fs'), D=__dirname+'/';
let s=fs.readFileSync(D+'rd-ui.js','utf8'); const i=s.indexOf('function cpTopupDo('); if(i<0) throw new Error('fn'); s=s.slice(0,i)+fs.readFileSync(D+'topup.js','utf8'); fs.writeFileSync(D+'rd-ui.js',s);
let a=fs.readFileSync(D+'apply2.cjs','utf8'); const k=a.indexOf('// 6. rd'); if(k<0) throw new Error('marker');
const add=[
"// 5q. 예산 추가 직후의 연속 입력이 시작이나 바깥 닫기로 넘어가지 않게 한다",
"rep(\"  nick=s2.nick; /* ID 나 옛 이름으로 들어와도 같은 전략으로 저장 */\",\"  nick=s2.nick; /* ID 나 옛 이름으로 들어와도 같은 전략으로 저장 */\"+String.fromCharCode(10)+\"  if(TF_MKF.hold&&Date.now()<TF_MKF.hold) return; /* 예산 추가 직후의 연속 입력 */\",true);",
"rep(\"if(e.target===w) mkFollowClose(); });\",\"if(e.target===w&&!(TF_MKF.hold&&Date.now()<TF_MKF.hold)) mkFollowClose(); });\",true);",""].join('\n');
a=a.slice(0,k)+add+a.slice(k); fs.writeFileSync(D+'apply2.cjs',a); console.log('ok');
