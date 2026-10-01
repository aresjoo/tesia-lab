// 터미널 포지션 탭 배지를 표와 같은 범위(현재 전략 / 전체 전략)로 센다 (Codex term/s5)
const fs=require('fs');
const f='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let s=fs.readFileSync(f,'utf8');
const a="var CNT={alerts:unread,pos:all.filter(function(x){return x.status==='live'&&!!tfTmCalc(x).pos;}).length};";
const b="var CNT={alerts:unread,pos:all.filter(function(x){return x.status==='live'&&!!tfTmCalc(x).pos&&(TF_TM.scope==='all'||x.key===TF_TM.sel);}).length}; /* 표와 같은 범위로 */";
const n=s.split(a).length-1; if(n!==1) throw new Error('count '+n);
s=s.replace(a,b); fs.writeFileSync(f,s); console.log('ok');
