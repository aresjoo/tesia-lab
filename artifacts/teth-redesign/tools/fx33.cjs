// AI 지시문에 넣은 줄의 깨진 줄바꿈 고치기 (heredoc 이 백슬래시를 먹음)
const fs=require('fs');
const f='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let s=fs.readFileSync(f,'utf8');
const bad="+'\n전략 정보 확인:";
const bad2="+'\r\n전략 정보 확인:";
const good="+'\\n전략 정보 확인:";
let n=s.split(bad2).length-1; if(n===1){ s=s.replace(bad2,good); }
else { n=s.split(bad).length-1; if(n!==1) throw new Error('count '+n); s=s.replace(bad,good); }
fs.writeFileSync(f,s); console.log('fixed');
