// bt-c.js 를 새 구조에 맞춘다. apply2 는 네 파일을 이어 붙인다
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,70)); return s.replace(x,()=>y); };
let s=fs.readFileSync(D+'bt-c.js','utf8');
s=one(s,"['skip',s.kind==='agent'?'쉬어 감':'보류']","['skip',btSkipL(s)]");
s=one(s,"<header><h3>왜 그렇게 판단했나요</h3>","<header><div><h3>왜 그렇게 판단했나요</h3>'+(s.kind==='rule'?'':'<span class=\"sub num\">'+btOppL(s)+' '+R.nOpp+'번, 매수 '+R.nBuy+'번, '+btSkipL(s)+' '+R.nSkip+'번</span>')+'</div>");
s=one(s,"  return '<div class=\"bt-dd-in\">'+(mini?","  return '<div class=\"bt-dd-in\">'+(d.chain?'<div class=\"bt-dd-ch\">'+btChainHtml(d)+'</div>':'')+(mini?");
s=one(s,"(?:\\/(go|card|ex|partner|uid|api|ok))?$/)","(?:\\/(go))?$/)");
s=one(s,"  btGoView(m[2]);","  btGoView();");
s=one(s,"if($('bt-chart')){ btChartDraw(); if(BT.phase==='result') $('bt-chart').classList.add('dd'); } },160); });","if($('bt-chart')) btChartDraw(); },160); });");
s=one(s,"  if(t.id===BT.id&&t.done&&BT.R&&BT.phase==='result'){ btSub(); btFinish(); }","  if(t.id===BT.id&&t.done){ if(!BT.R) btCompute(); btSub(); btFinish(); }");
fs.writeFileSync(D+'bt-c.js',s);
let a=fs.readFileSync(D+'apply2.cjs','utf8');
a=one(a,"fs.readFileSync(D+'bt.js','utf8')+'\\n'+fs.readFileSync(D+'bt-go.js','utf8')","['bt-a.js','bt-b.js','bt-c.js','bt-go.js'].map(f=>fs.readFileSync(D+f,'utf8')).join('\\n')");
fs.writeFileSync(D+'apply2.cjs',a); console.log('ok');
