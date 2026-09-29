const fs=require('fs'); let s=fs.readFileSync('agent-core.js','utf8');
function rep(a,b){ const n=s.split(a).length-1; if(n!==1) throw new Error('anchor x'+n+' '+a.slice(0,60)); s=s.replace(a,()=>b); }
// 원장 방어 + 체결 기록에 수량, 비용
rep("L.buy=function(k,price,amount,i,meta){ amount=Math.min(amount,L.cash); if(amount<=1e-9) return null;",
    "L.buy=function(k,price,amount,i,meta){ if(!(price>0)||!isFinite(price)||!isFinite(amount)) throw new Error('ledger: bad fill'); amount=Math.min(amount,L.cash); if(amount<=1e-9) return null;");
rep("var p={id:++L.seq,k:k,units:units,ei:i,ep:price,cost:amount,hi:price,w:meta&&meta.w}; L.pos.push(p); return p; };",
    "var p={id:++L.seq,k:k,units:units,ei:i,ep:price,cost:amount,fee:fee,hi:price,w:meta&&meta.w}; L.pos.push(p); return p; };");
rep("L.sell=function(p,price,i,why){ var gross=p.units*price,",
    "L.sell=function(p,price,i,why){ if(L.pos.indexOf(p)<0) throw new Error('ledger: not held'); if(!(price>0)||!isFinite(price)) throw new Error('ledger: bad fill'); var gross=p.units*price,");
rep("var t={id:p.id,entry:p.ei,exit:i,asset:p.k,ep:p.ep,xp:price,units:p.units,cost:p.cost,got:got,pnl:got/p.cost-1,kind:why,w:p.w};",
    "var t={id:p.id,entry:p.ei,exit:i,asset:p.k,ep:p.ep,xp:price,units:p.units,cost:p.cost,got:got,fee:p.fee+fee,pnl:got/p.cost-1,kind:why,w:p.w};");
// 회복 못 한 마지막 구간도 센다
rep("var byYear={}, prev=1;","var tail=endI-curStart; if(tail>underMax) underMax=tail;\n  var byYear={}, prev=1;");
// 입력 검사
rep("var U=c.uni, PX=U.map(function(k){ return mkPx(k); }), N=PX[0].length, endI=N-1, startI=Math.max(61,c.look+1,c.startI||61), top=Math.max(1,Math.min(4,c.top));\n  for(var z=1;z<PX.length;z++) if(PX[z].length!==N) throw new Error('price length');",
    "var U=c.uni, PX=U.map(function(k){ return mkPx(k); }), N=PX[0].length, endI=N-1, startI=Math.max(61,c.look+1,c.startI||61), top=Math.max(1,Math.min(4,c.top));\n  mkCheckIn(PX,N,c);");
rep("function mkStatsOf(","function mkCheckIn(PX,N,c){ for(var z=0;z<PX.length;z++) if(PX[z].length!==N) throw new Error('price length'); if(!(c.every>=1)||(c.look!=null&&!(c.look>=2&&c.look<N-62))) throw new Error('bad config'); }\nfunction mkStatsOf(");
// 사건에 체결 수량과 비용
rep("function out(p,i,why){ var t=L.sell(p,px(p.k),i,why); ev.push({i:i,t:'exit',a:p.k,why:why,tid:t.id,px:t.xp,pnl:t.pnl*100}); }",
    "function out(p,i,why){ var t=L.sell(p,px(p.k),i,why); ev.push({i:i,t:'exit',a:p.k,why:why,tid:t.id,px:t.xp,units:t.units,got:t.got,fee:t.fee,pnl:t.pnl*100}); }");
rep("ev.push({i:i,t:'enter',a:r2.k,tid:p2.id,px:r2.px,mom:r2.mom*100,w:p2.cost/total,up:S.up,of:S.of,top:top3});",
    "ev.push({i:i,t:'enter',a:r2.k,tid:p2.id,px:r2.px,units:p2.units,cost:p2.cost,fee:p2.fee,mom:r2.mom*100,w:p2.cost/total,up:S.up,of:S.of,top:top3});");
// 상태의 순위는 기준일 종가로 다시 본다(주문은 재평가 주기대로)
rep("cur=endI;\n  var r3=mkStatsOf(eq,L,{startI:startI,endI:endI},startI,endI,invested), total2=L.value(px);",
    "cur=endI; var now=scan(endI);\n  var r3=mkStatsOf(eq,L,{startI:startI,endI:endI},startI,endI,invested), total2=L.value(px);");
rep("scan:last?{up:last.up,of:last.of,weak:last.breadth<c.gate,top:last.rows.slice(0,4).map(function(x){ return {k:x.k,mom:x.mom*100,above:x.above}; })}:null,",
    "scan:{up:now.up,of:now.of,weak:now.breadth<c.gate,top:now.rows.slice(0,4).map(function(x){ return {k:x.k,mom:x.mom*100,above:x.above}; })},");
// 혼합과 조건 실행을 한 계산기로: c.asset 이 있으면 종목이 고정된 조건 실행
rep("function mkHybridRun(c){\n  var U=c.uni, PX=U.map(function(k){ return mkPx(k); }), N=PX[0].length, endI=N-1, startI=Math.max(61,c.look+1,c.startI||61);",
    "function mkHybridRun(c){\n  var fixed=c.asset||null, U=fixed?[fixed]:c.uni, PX=U.map(function(k){ return mkPx(k); }), N=PX[0].length, endI=N-1, startI=Math.max(61,(c.look||0)+1,c.startI||61);\n  mkCheckIn(PX,N,{every:c.every||1,look:c.look});\n  function cond(P,i){ var rv=rsi(P,i-1), bo=(P[i]/P[i-1]-1)*100, s20=sma(P,20,i), s60=sma(P,60,i), gap=Math.abs(s20-s60)/P[i]*100; return {i:i,rsi:rv,rsiOk:rv<c.rsiTh,bounce:bo,bounceOk:bo>0.5,gap:gap,trendOk:!c.tf||gap>3}; }");
rep("var L=mkLedger(), eq=[], ev=[], pick=null, cur=startI,","var L=mkLedger(), eq=[], ev=[], pick=fixed, cur=startI,");
rep("if(!p&&(i-startI)%c.every===0){ var C=choose(i);","if(!fixed&&!p&&(i-startI)%c.every===0){ var C=choose(i);");
rep("if(!p){ if(pick!==null){ var P=PX[J[pick]], rv=rsi(P,i-1);\n        if(rv<c.rsiTh&&P[i]>P[i-1]*1.005){ var up2=0; for(var u=0;u<U.length;u++) if(PX[u][i]>sma(PX[u],60,i)) up2++;\n          if(c.gate&&up2/U.length<c.gate) ev.push({i:i,t:'veto',a:pick,up:up2,of:U.length,rsi:rv});\n          else { var b=L.buy(pick,P[i],L.cash,i,{w:1}); ev.push({i:i,t:'enter',a:pick,tid:b.id,px:P[i],rsi:rv,bounce:(P[i]/P[i-1]-1)*100,up:up2,of:U.length}); } } } }",
    "if(!p){ if(pick!==null){ var P=PX[J[pick]], q=cond(P,i);\n        if(q.rsiOk&&q.bounceOk&&q.trendOk){ var up2=0; for(var u=0;u<U.length;u++) if(PX[u][i]>sma(PX[u],60,i)) up2++;\n          if(!fixed&&c.gate&&up2/U.length<c.gate) ev.push({i:i,t:'veto',a:pick,up:up2,of:U.length,rsi:q.rsi});\n          else { var b=L.buy(pick,P[i],L.cash,i,{w:1}); ev.push({i:i,t:'enter',a:pick,tid:b.id,px:P[i],units:b.units,cost:b.cost,fee:b.fee,rsi:q.rsi,bounce:q.bounce,up:up2,of:U.length}); } } } }");
rep("if(why){ var t=L.sell(p,v,i,why); ev.push({i:i,t:'exit',a:p.k,why:why,tid:t.id,px:v,chg:chg,pnl:t.pnl*100}); } }",
    "if(why){ var t=L.sell(p,v,i,why); ev.push({i:i,t:'exit',a:p.k,why:why,tid:t.id,px:v,units:t.units,got:t.got,fee:t.fee,chg:chg,pnl:t.pnl*100}); } }");
rep("var r=mkStatsOf(eq,L,{startI:startI,endI:endI,sl:c.sl,tp:c.tp,rsiTh:c.rsiTh},startI,endI,invested), o=L.pos[0]||null, Pn=pick!==null?PX[J[pick]]:null;",
    "var r=mkStatsOf(eq,L,{startI:startI,endI:endI,sl:c.sl,tp:c.tp,rsiTh:c.rsiTh},startI,endI,invested), o=L.pos[0]||null, Pn=pick!==null?PX[J[pick]]:null, ev1=c.every||1;");
rep("rsi:Pn?rsi(Pn,endI):null,bounce:Pn?(Pn[endI]/Pn[endI-1]-1)*100:null,lastEval:startI+Math.floor((endI-startI)/c.every)*c.every,nextEval:startI+(Math.floor((endI-startI)/c.every)+1)*c.every};",
    "cond:Pn?cond(Pn,endI):null,lastEval:startI+Math.floor((endI-startI)/ev1)*ev1,nextEval:startI+(Math.floor((endI-startI)/ev1)+1)*ev1};");
rep("function mkHybridRun(c){","/* 조건 실행: 종목이 하나로 고정된 같은 계산기. c = {asset, rsiTh, tp, sl, tf, startI} */\nfunction mkRuleRun(c){ return mkHybridRun({asset:c.asset,rsiTh:c.rsiTh,tp:c.tp,sl:c.sl,tf:c.tf,every:1,gate:0,startI:c.startI}); }\nfunction mkHybridRun(c){");
fs.writeFileSync('agent-core.js',s); console.log('core ok');
// run-cat: 조건 실행도 같은 계산기로
let r=fs.readFileSync('run-cat.cjs','utf8');
function rp(a,b){ if(r.split(a).length!==2) throw new Error('rc '+a.slice(0,40)); r=r.replace(a,()=>b); }
rp("this.api={mkAgentRun:mkAgentRun,mkHybridRun:mkHybridRun,","this.api={mkAgentRun:mkAgentRun,mkHybridRun:mkHybridRun,mkRuleRun:mkRuleRun,");
rp("r=ctx.api.rule(mkPx(asset),p); }","r=ctx.api.mkRuleRun({asset:asset,rsiTh:p.rsiTh,tp:p.tp,sl:p.sl,tf:p.trendFilter,startI:p.startI}); }");
fs.writeFileSync('run-cat.cjs',r); console.log('runcat ok');
