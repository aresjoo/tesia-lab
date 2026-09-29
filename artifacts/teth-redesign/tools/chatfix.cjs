const fs=require('fs'), D=__dirname+'/'; let s=fs.readFileSync(D+'chat.js','utf8');
const one=(x,y)=>{ const n=s.split(x).length-1; if(n!==1) throw new Error('x'+n+': '+x.slice(0,60)); s=s.replace(x,()=>y); };
// 모자라면 남은 규칙 문장으로 채운다
one("function mkSay(core,opt){\n  var t=core.filter(Boolean).join(' '), i=0;\n  for(;i<opt.length&&t.length<200;i++){ if(!opt[i]) continue; if(t.length+1+opt[i].length>300) continue; t+=' '+opt[i]; }\n  return t;\n}",
"function mkSay(core,opt,R){\n  var t=core.filter(Boolean).join(' '), i=0, all=opt.slice();\n  if(R) for(var k in R) all.push(R[k]);\n  for(;i<all.length&&t.length<205;i++){ var x=all[i]; if(!x||t.indexOf(x)>=0) continue; if(t.length+1+x.length>300) continue; t+=' '+x; }\n  return t;\n}\n/* 실제 가격에서 뽑은 말: 들고 있던 동안의 가장 높고 낮았던 때, 사기 전에 얼마나 내려와 있었는지 */\nfunction mkHeldTxt(r,tid){ var tr=null; (r.trades||[]).forEach(function(x){ if(x.id===tid) tr=x; }); if(!tr) return ''; var P=mkPx(tr.asset), hi=-1e9, lo=1e9; for(var i=tr.entry;i<=tr.exit;i++){ var v=(P[i]/tr.ep-1)*100; if(v>hi) hi=v; if(v<lo) lo=v; } var n=tr.exit-tr.entry; return '들고 있던 '+n+'일 동안 산 가격보다 가장 높았을 때는 '+mkPct0(Math.max(0,hi))+', 가장 낮았을 때는 '+mkPct0(Math.min(0,lo))+'였어요.'; }\nfunction mkDipTxt(a,i){ var P=mkPx(a), hi=0; for(var k=Math.max(0,i-20);k<=i;k++) if(P[k]>hi) hi=P[k]; var d=(P[i]/hi-1)*100; return d<-0.05?mkJ(a,'은','는')+' 그때 최근 20일 중 가장 높았던 가격보다 '+mkPct0(d)+' 아래에 있었어요.':''; }\nfunction mkDipNow(a){ var P=mkPx(a), i=P.length-1, hi=0; for(var k=Math.max(0,i-20);k<=i;k++) if(P[k]>hi) hi=P[k]; var d=(P[i]/hi-1)*100; return d<-0.05?'지금 '+mkJ(a,'은','는')+' 최근 20일 중 가장 높았던 가격보다 '+mkPct0(d)+' 아래에 있어요.':'지금 '+mkJ(a,'은','는')+' 최근 20일 중 가장 높은 가격에 있어요.'; }");
// R 을 넘긴다: mkSay(…,[…]) 의 닫는 괄호에 R 추가
s=s.replace(/(mkSay\(\[[^\n]*?\],\[[^\n]*?\])\)/g,'$1,R)');
// 실제 가격 문장을 앞쪽 선택 문장으로
one("'결과는 '+mkPct0(e.pnl)+'예요.'],[e.why==='trail'?R.sell:R.swap,","'결과는 '+mkPct0(e.pnl)+'예요.'],[mkHeldTxt(s.r,e.tid),e.why==='trail'?R.sell:R.swap,");
one("'결과는 '+mkPct0(e.pnl)+'예요.'],[e.why==='time'?","'결과는 '+mkPct0(e.pnl)+'예요.'],[mkHeldTxt(s.r,e.tid),e.why==='time'?");
one("R.size],[R.sell,R.cap,s.kind==='mix'?R.again:R.what,R.tf,R.rest]","R.size],[mkDipTxt(e.a,e.i),R.sell,R.cap,s.kind==='mix'?R.again:R.what,R.tf,R.rest]");
one("'내일 장이 끝나면 다시 확인할게요.'],[R.buy,R.what,","'내일 장이 끝나면 다시 확인할게요.'],[mkDipNow(st.pick),R.buy,R.what,");
one("'내일 장이 끝나면 다시 확인할게요.'],[R.what,R.tf,","'내일 장이 끝나면 다시 확인할게요.'],[mkDipNow(s.asset),R.what,R.tf,");
fs.writeFileSync(D+'chat.js',s); console.log('ok', (s.match(/,R\)/g)||[]).length);
