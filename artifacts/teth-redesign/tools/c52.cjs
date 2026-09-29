// 익절 없음(tp null)을 엔진과 문구가 제대로 다루게, 점수 계산, 설명 문장 조사
const fs=require('fs'), D=__dirname+'/';
const ed=(f,pairs)=>{ let s=fs.readFileSync(D+f,'utf8'); for(const [x,y] of pairs){ const c=s.split(x).length-1; if(c!==1) throw new Error(f+' x'+c+': '+x.slice(0,80)); s=s.split(x).join(y); } fs.writeFileSync(D+f,s); };
ed('agent-core.js',[["why=chg<=c.sl?'sl':chg>=c.tp?'tp':","why=chg<=c.sl?'sl':(c.tp!=null&&chg>=c.tp)?'tp':"]]);
ed('bt-a.js',[["o.push(['파는 때','+'+c.tp+'% 오르거나 '+c.sl+'% 내리면, 또는 25일이 지나면']);","o.push(['파는 때',(c.tp!=null?'+'+c.tp+'% 오르거나 ':'')+c.sl+'% 내리면, 또는 25일이 지나면']);"]]);
ed('bt-c.js',[
  ["BT.s.kind==='agent'?[]:[[t.ep*(1+c.tp/100),'목표 +'+c.tp+'%','#2fb98a'],[t.ep*(1+c.sl/100),'손절 '+c.sl+'%','#f0566a']],","BT.s.kind==='agent'?[]:(c.tp!=null?[[t.ep*(1+c.tp/100),'목표 +'+c.tp+'%','#2fb98a']]:[]).concat([[t.ep*(1+c.sl/100),'손절 '+c.sl+'%','#f0566a']]),"],
  ["  var one=a+'이(가) 내려왔다가 다시 오르는 날 사요. '+(p.tp!=null?'산 가격보다 '+p.tp+'% 오르면 팔고, ':'')+sl+'% 내려가면 팔아요.';",
   "  var one=mkJ(a,'이','가')+' 내려왔다가 다시 오르는 날 사요. '+(p.tp!=null?'산 가격보다 '+p.tp+'% 오르거나 ':'산 가격보다 ')+sl+'% 내려가면, 또는 25일이 지나면 팔아요.';"],
  ["  try{ t.score=tfScore(t.cur); }catch(e){ t.score=0; }","  try{ var sc=tfScore(mkRunCfg(s.cfg,p.startI)); t.score=isFinite(sc)?sc:0; }catch(e){ t.score=0; }"]
]);
console.log('ok');
