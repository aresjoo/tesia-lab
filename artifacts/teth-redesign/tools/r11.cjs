const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let s=fs.readFileSync(D+'rd-ui.js','utf8'); const i=s.indexOf('/* 체험 예산 추가'); if(i<0) throw new Error('fn'); s=s.slice(0,i)+fs.readFileSync(D+'topup.js','utf8'); fs.writeFileSync(D+'rd-ui.js',s);
// 시간으로 막던 처리를 걷어 낸다
let t=fs.readFileSync(F,'utf8');
const G="  if(TF_MKF.hold&&Date.now()<TF_MKF.hold) return; /* 예산 추가 직후의 연속 입력 */\r\n"; if(t.split(G).length-1!==1) throw new Error('G'); t=t.replace(G,'');
const H="if(e.target===w&&!(TF_MKF.hold&&Date.now()<TF_MKF.hold)) mkFollowClose(); });"; if(t.split(H).length-1!==1) throw new Error('H'); t=t.replace(H,"if(e.target===w) mkFollowClose(); });");
fs.writeFileSync(F,t);
let a=fs.readFileSync(D+'apply2.cjs','utf8'); const p=a.indexOf('// 5q.'), q=a.indexOf('// 6. rd'); if(p<0||q<p) throw new Error('5q');
// 5q 를 화면 읽기 도구용 알림 영역으로 바꾼다(보이는 문구는 늘지 않는다)
const add="// 5q. 시트 안의 상태 알림(화면 읽기 도구용, 보이지 않음)\nrep(\"    +'<div class=\\\"mk-f-sum\\\" id=\\\"mk-f-sum\\\"></div>'\",\"    +'<div class=\\\"mk-f-sum\\\" id=\\\"mk-f-sum\\\"></div><div id=\\\"mk-f-live\\\" role=\\\"status\\\" aria-live=\\\"polite\\\" style=\\\"position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)\\\"></div>'\",true);\n";
a=a.slice(0,p)+add+a.slice(q); fs.writeFileSync(D+'apply2.cjs',a); console.log('ok');
