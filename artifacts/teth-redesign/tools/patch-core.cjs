const fs=require('fs'); let s=fs.readFileSync('agent-core.js','utf8');
function rep(a,b){ if(s.split(a).length!==2) throw new Error('anchor '+a.slice(0,50)); s=s.replace(a,()=>b); }
rep("if(!inPos){ if(pj>=0){ var P=PX[pj]; if(rsi(P,i-1)<c.rsiTh&&P[i]>P[i-1]*1.005){ inPos=true; eI=i; eP=P[i]; ev.push({i:i,t:'enter',a:pick,rsi:rsi(P,i-1),bounce:(P[i]/P[i-1]-1)*100}); } } }",
"if(!inPos){ if(pj>=0){ var P=PX[pj]; if(rsi(P,i-1)<c.rsiTh&&P[i]>P[i-1]*1.005){\n      /* 규칙 신호가 떠도 시장이 약하면(오르는 종목 비율이 gate 미만) AI 가 진입을 보류한다 */\n      var up=0; for(var u=0;u<U.length;u++) if(PX[u][i]>sma(PX[u],60,i)) up++;\n      if(c.gate&&up/U.length<c.gate){ ev.push({i:i,t:'veto',a:pick,up:up,of:U.length,rsi:rsi(P,i-1)}); }\n      else { inPos=true; eI=i; eP=P[i]; ev.push({i:i,t:'enter',a:pick,rsi:rsi(P,i-1),bounce:(P[i]/P[i-1]-1)*100,up:up,of:U.length}); } } } }");
rep("c = {uni, every, look, rsiTh, tp, sl, startI} */","c = {uni, every, look, rsiTh, tp, sl, gate, startI} */");
fs.writeFileSync('agent-core.js',s); console.log('ok');
