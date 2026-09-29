// 5x 의 교체가 앞선 교체의 결과 문자열을 지웠다. 앞선 결과를 건드리지 않는 방식으로 바꾼다
const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,70)); return s.replace(x,()=>y); };
let a=fs.readFileSync(D+'apply2.cjs','utf8');
a=one(a,"rep(\"'건'+(trM.length?', 승률 '+Math.round(wM/trM.length*100)+'%':'')+'</span></div>'\",\"'건'+'</span></div>' /* 달의 승률 없음 */\",true);","rep(\"'건'+(trM.length?', 승률 '\",\"'건'+(false&&trM.length?', 승률 '\",true);");
fs.writeFileSync(D+'apply2.cjs',a);
let t=fs.readFileSync(F,'utf8');
t=one(t,"'건'+'</span></div>' /* 달의 승률 없음 */","'건'+(false&&trM.length?', 승률 '+Math.round(wM/trM.length*100)+'%':'')+'</span></div>'");
fs.writeFileSync(F,t); console.log('ok');
