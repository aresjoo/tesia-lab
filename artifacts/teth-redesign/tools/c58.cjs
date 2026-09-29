// 엔진: 그날 종가로 판단하고, 다음 거래일 종가에 체결한다(대기 주문). 주식, 지수, 금은 실제 거래일에만 판단하고 체결한다.
const fs=require('fs'), D=__dirname+'/';
let s=fs.readFileSync(D+'agent-core.js','utf8');
const a=s.indexOf('function mkAgentRun(c){'), b=s.indexOf('/* 혼합: AI 가 거래할 종목을 고르고');
const h1=s.indexOf('function mkHybridRun(c){'), h2=(function(x){ return x<0?s.length:x+1; })(s.indexOf('\nfunction ',h1+10));
if(a<0||b<0||h1<0||h2<1||!(a<b&&b<h1&&h1<h2)) throw new Error('anchors '+[a,b,h1,h2]);
const AGENT=`function mkAgentRun(c){
  var U=c.uni, PX=U.map(function(k){ return mkPx(k); }), N=PX[0].length, endI=N-1, startI=Math.max(61,c.look+1,c.startI||61), top=Math.max(1,Math.min(4,c.top));
  mkCheckIn(PX,N,c);
  var J={}; U.forEach(function(k,j){ J[k]=j; });
  var L=mkLedger(), eq=[], ev=[], last=null, invested=0, cur=startI, px=function(k){ return PX[J[k]][cur]; }, pend=[];
  function scan(i){
    var rows=U.map(function(k,j){ var P=PX[j], v=mkVol(P,i,20), m=P[i]/P[i-c.look]-1; return {k:k,mom:m,vol:v,score:m/(v*Math.sqrt(c.look)),above:P[i]>sma(P,60,i),px:P[i]}; });
    var up=rows.filter(function(r){ return r.above; }).length; rows.sort(function(a,b){ return b.score-a.score; });
    return {rows:rows,up:up,of:U.length,breadth:up/U.length};
  }
  var selling=function(p){ return pend.some(function(o){ return o.t==='sell'&&o.p===p; }); }, buying=function(k){ return pend.some(function(o){ return o.t==='buy'&&o.k===k; }); };
  /* 파는 결정: 그날 종가로 정하고, 다음 거래일 종가에 판다 */
  function out(p,i,why){ if(selling(p)) return; var e={i:i,t:'exit',a:p.k,why:why,_pend:1}; ev.push(e); pend.push({t:'sell',p:p,why:why,ev:e}); }
  for(var i=startI;i<=endI;i++){
    cur=i;
    /* 0) 대기 주문 체결: 판 다음에 산다. 그 자산이 거래되는 날의 종가 */
    if(pend.length){ var keep=[];
      pend.forEach(function(o){ if(o.t!=='sell') return; if(!mkOpen(o.p.k,i)){ keep.push(o); return; } var t=L.sell(o.p,px(o.p.k),i,o.why); var e=o.ev; delete e._pend; e.xi=i; e.tid=t.id; e.px=t.xp; e.units=t.units; e.got=t.got; e.fee=t.fee; e.pnl=t.pnl*100; });
      var tot0=L.value(px);
      pend.forEach(function(o){ if(o.t!=='buy') return; if(!mkOpen(o.k,i)){ keep.push(o); return; } var p2=L.buy(o.k,px(o.k),o.w*tot0,i,{w:o.w}); var e=o.ev; if(!p2){ e._drop=1; return; } delete e._pend; e.xi=i; e.tid=p2.id; e.px=px(o.k); e.units=p2.units; e.cost=p2.cost; e.fee=p2.fee; e.w=p2.cost/tot0; });
      pend=keep; }
    L.pos.forEach(function(p){ if(mkOpen(p.k,i)){ var v=px(p.k); if(v>p.hi) p.hi=v; } });
    /* 1) 이탈: 든 뒤 고점에서 trail% 밀리면 내린다(그 자산이 거래된 날에만 판단) */
    L.pos.slice().forEach(function(p){ if(i>p.ei&&mkOpen(p.k,i)&&px(p.k)<=p.hi*(1-c.trail/100)) out(p,i,'trail'); });
    /* 2) 재평가 */
    if((i-startI)%c.every===0){
      var S=scan(i), weak=S.breadth<c.gate, rank={}; S.rows.forEach(function(r,q){ rank[r.k]=q; });
      L.pos.slice().forEach(function(p){ if(!mkOpen(p.k,i)||selling(p)) return; var r=S.rows[rank[p.k]]; if(i>p.ei&&(r.score<0||!r.above)) out(p,i,'weak'); else if(i>p.ei&&rank[p.k]>top+1) out(p,i,'rot'); });
      var cand=S.rows.filter(function(r){ return r.above&&r.score>=c.minS&&mkOpen(r.k,i)&&!L.pos.some(function(p){ return p.k===r.k; })&&!buying(r.k); });
      var top3=S.rows.slice(0,3).map(function(r){ return {k:r.k,mom:r.mom*100,above:r.above}; }), held=function(){ return L.pos.filter(function(p){ return !selling(p); }).map(function(p){ return p.k; }); };
      var effN=function(){ return L.pos.filter(function(p){ return !selling(p); }).length+pend.filter(function(o){ return o.t==='buy'; }).length; };
      if(weak) ev.push({i:i,t:'skip',why:'gate',up:S.up,of:S.of,top:top3,held:held()});
      else if(effN()>=top) ev.push({i:i,t:'hold',up:S.up,of:S.of,top:top3,held:held()});
      else if(!cand.length) ev.push({i:i,t:'skip',why:'none',up:S.up,of:S.of,top:top3,held:held()});
      else { while(effN()<top&&cand.length){ var r2=cand.shift(), w=Math.max(0.1,Math.min(1/top,(1/top)*c.volT/r2.vol)), skip=[], rk=rank[r2.k];
          for(var sq=0;sq<rk;sq++){ var sr=S.rows[sq]; skip.push({k:sr.k,why:L.pos.some(function(p){ return p.k===sr.k; })?'held':!sr.above?'below':'weak'}); }
          var e2={i:i,t:'enter',a:r2.k,mom:r2.mom*100,w:w,rank:rk+1,skip:skip,cut:w<1/top-1e-9,up:S.up,of:S.of,top:top3,_pend:1}; ev.push(e2); pend.push({t:'buy',k:r2.k,w:w,ev:e2}); } }
      last=S;
    }
    var v2=L.value(px); eq.push({i:i,v:v2}); invested+=(v2-L.cash)/v2;
  }
  ev=ev.filter(function(e){ return !e._pend&&!e._drop; }); /* 마지막 날까지 체결되지 않은 결정은 거래로 치지 않는다 */
  cur=endI; var now=scan(endI);
  var r3=mkStatsOf(eq,L,{startI:startI,endI:endI},startI,endI,invested), total2=L.value(px);
  r3.events=ev;
  r3.state={asOf:endI,cash:L.cash/total2,open:L.pos.map(function(p){ var v=px(p.k); return {k:p.k,tid:p.id,entry:p.ei,ep:p.ep,units:p.units,cost:p.cost,px:v,chg:(v/p.ep-1)*100,w:p.units*v/total2,hi:p.hi,stop:p.hi*(1-c.trail/100)}; }),
    scan:{up:now.up,of:now.of,weak:now.breadth<c.gate,top:now.rows.slice(0,4).map(function(x){ return {k:x.k,mom:x.mom*100,above:x.above}; }),
      rows:now.rows.map(function(x,q){ return {k:x.k,rank:q+1,mom:x.mom*100,above:x.above,ok:x.above&&x.score>=c.minS,held:L.pos.some(function(p){ return p.k===x.k; })}; })},
    lastEval:startI+Math.floor((endI-startI)/c.every)*c.every,nextEval:startI+(Math.floor((endI-startI)/c.every)+1)*c.every};
  return r3;
}
`;
let hyb=s.slice(h1,h2);
const rep=(x,y)=>{ const c=hyb.split(x).length-1; if(c!==1) throw new Error('hyb x'+c+': '+x.slice(0,70)); hyb=hyb.split(x).join(y); };
rep("var L=mkLedger(), eq=[], ev=[], pick=fixed, cur=startI, topAt=null, lastTop=null, invested=0, lastEv=null, px=function(k){ return PX[J[k]][cur]; };",
    "var L=mkLedger(), eq=[], ev=[], pick=fixed, cur=startI, topAt=null, lastTop=null, invested=0, lastEv=null, px=function(k){ return PX[J[k]][cur]; }, pend=null;");
rep("    cur=i; var p=L.pos[0]||null;",
    "    cur=i;\n    /* 대기 주문 체결: 판단한 다음 거래일 종가 */\n    if(pend&&mkOpen(pend.k,i)){ var e0=pend.ev; delete e0._pend; e0.xi=i;\n      if(pend.t==='buy'){ var Pb=PX[J[pend.k]], bb=L.buy(pend.k,Pb[i],L.cash,i,{w:1}); if(bb){ e0.tid=bb.id; e0.px=Pb[i]; e0.units=bb.units; e0.cost=bb.cost; e0.fee=bb.fee; } else e0._drop=1; }\n      else { var ts=L.sell(pend.p,px(pend.p.k),i,pend.why); e0.tid=ts.id; e0.px=ts.xp; e0.units=ts.units; e0.got=ts.got; e0.fee=ts.fee; e0.chg=(ts.xp/pend.p.ep-1)*100; e0.pnl=ts.pnl*100; }\n      pend=null; }\n    var p=L.pos[0]||null;");
rep("    if(!fixed&&!p&&(i-startI)%c.every===0){","    if(!fixed&&!p&&!pend&&(i-startI)%c.every===0){");
rep("    if(!p){ if(pick!==null){ var P=PX[J[pick]], q=cond(P,i);","    if(!p&&!pend){ if(pick!==null&&mkOpen(pick,i)){ var P=PX[J[pick]], q=cond(P,i);");
rep("          else { var b=L.buy(pick,P[i],L.cash,i,{w:1}); ev.push({i:i,t:'enter',a:pick,tid:b.id,px:P[i],units:b.units,cost:b.cost,fee:b.fee,rsi:q.rsi,bounce:q.bounce,fng:q.fng,up:up2,of:U.length}); } } } }",
    "          else { var eb={i:i,t:'enter',a:pick,rsi:q.rsi,bounce:q.bounce,fng:q.fng,up:up2,of:U.length,_pend:1}; ev.push(eb); pend={t:'buy',k:pick,ev:eb}; } } } }");
rep("    else if(i>p.ei){ var v=px(p.k), chg=(v/p.ep-1)*100, why=chg<=c.sl?'sl':(c.tp!=null&&chg>=c.tp)?'tp':(i-p.ei>=25?'time':null);\n      if(why){ var t=L.sell(p,v,i,why); ev.push({i:i,t:'exit',a:p.k,why:why,tid:t.id,px:v,units:t.units,got:t.got,fee:t.fee,chg:chg,pnl:t.pnl*100}); } }",
    "    else if(p&&!pend&&i>p.ei&&mkOpen(p.k,i)){ var v=px(p.k), chg=(v/p.ep-1)*100, why=chg<=c.sl?'sl':(c.tp!=null&&chg>=c.tp)?'tp':(i-p.ei>=25?'time':null);\n      if(why){ var es={i:i,t:'exit',a:p.k,why:why,_pend:1}; ev.push(es); pend={t:'sell',k:p.k,p:p,why:why,ev:es}; } }");
rep("  cur=endI;\n  var r=mkStatsOf(","  ev=ev.filter(function(e){ return !e._pend&&!e._drop; }); /* 마지막 날까지 체결되지 않은 결정은 빼다 */\n  cur=endI;\n  var r=mkStatsOf(");
s=s.slice(0,a)+AGENT+s.slice(b,h1)+hyb+s.slice(h2);
// 거래일 판단: 코인은 매일, 주식, 지수, 금은 실제 거래가 있던 날만
s=s.replace("/* 공포 탐욕 지수(그날 00시 UTC 발표","/* 그날 그 자산이 실제로 거래됐는가(쉬는 날은 직전 종가를 이어 붙였을 뿐 체결할 수 없다) */\nfunction mkOpen(k,i){ var o=window.TETH_PX&&TETH_PX.open&&TETH_PX.open[k]; return !o||o.charCodeAt(i)===49; }\n/* 공포 탐욕 지수(그날 00시 UTC 발표");
if(!s.includes('function mkOpen(')) throw new Error('mkOpen');
fs.writeFileSync(D+'agent-core.js',s);
console.log('ok');
