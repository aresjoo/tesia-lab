/* ═══ 판단 방식 계산기 (직접 탐색, 혼합) ═══
   제품(index.html)과 검증 도구(node)가 같은 코드를 쓴다. 의존: mkPx(key), rsi(arr,i), sma(arr,n,i), idxToDate(i).
   계약: 하루 한 번 종가에서 판단하고 그 종가에 체결한다. 모든 체결은 현금과 수량 원장에 기록하고,
   자산 곡선(현금 + 보유 평가액), 거래 손익, 판단 기록, 현재 상태를 그 원장 하나에서 낸다. 비용은 체결 금액의 0.1%.
   시드 데이터다. 실제 운용 기록 API 가 생기면 mkAgentRun, mkHybridRun 의 반환값을 응답으로 바꾼다. */
var MK_FEE=0.001;
function mkVol(P,i,n){ var s=0,q=0; for(var k=i-n+1;k<=i;k++){ var r=P[k]/P[k-1]-1; s+=r; q+=r*r; } var m=s/n; return Math.sqrt(Math.max(1e-12,q/n-m*m)); }
/* 원장: 현금 1에서 시작. buy 는 금액(수수료 포함)만큼 현금을 쓰고 수량을 받는다. sell 은 수량 전부를 팔아 현금을 받는다 */
function mkLedger(){
  var L={cash:1,pos:[],trades:[],fees:0,seq:0};
  L.value=function(px){ var v=L.cash; L.pos.forEach(function(p){ v+=p.units*px(p.k); }); return v; };
  L.buy=function(k,price,amount,i,meta){ if(!(price>0)||!isFinite(price)||!isFinite(amount)) throw new Error('ledger: bad fill'); amount=Math.min(amount,L.cash); if(amount<=1e-9) return null; var units=amount/(price*(1+MK_FEE)), fee=units*price*MK_FEE; L.cash-=amount; L.fees+=fee; var p={id:++L.seq,k:k,units:units,ei:i,ep:price,cost:amount,fee:fee,hi:price,w:meta&&meta.w}; L.pos.push(p); return p; };
  L.sell=function(p,price,i,why){ if(L.pos.indexOf(p)<0) throw new Error('ledger: not held'); if(!(price>0)||!isFinite(price)) throw new Error('ledger: bad fill'); var gross=p.units*price, fee=gross*MK_FEE, got=gross-fee; L.cash+=got; L.fees+=fee; L.pos=L.pos.filter(function(x){ return x!==p; });
    var t={id:p.id,entry:p.ei,exit:i,asset:p.k,ep:p.ep,xp:price,units:p.units,cost:p.cost,got:got,fee:p.fee+fee,pnl:got/p.cost-1,kind:why,w:p.w}; L.trades.push(t); return t; };
  return L;
}
function mkCheckIn(PX,N,c){ for(var z=0;z<PX.length;z++){ if(PX[z].length!==N) throw new Error('price length'); for(var y=0;y<N;y++) if(!(PX[z][y]>0)||!isFinite(PX[z][y])) throw new Error('bad price'); } if(!(c.every>=1)||(c.look!=null&&!(c.look>=2&&c.look<N-1))) throw new Error('bad config'); }
function mkStatsOf(eq,L,params,startI,endI,invested){
  var trades=L.trades, equity=eq.length?eq[eq.length-1].v:1, wins=trades.filter(function(t){return t.pnl>0;}), losses=trades.filter(function(t){return t.pnl<=0;});
  var gw=wins.reduce(function(a,t){return a+(t.got-t.cost);},0), gl=losses.reduce(function(a,t){return a+(t.cost-t.got);},0);
  var peak=1, peakI=startI, mdd=0, mddStartI=startI, mddEndI=startI, curStart=startI, underMax=0;
  eq.forEach(function(e){ if(e.v>=peak){ var d=e.i-curStart; if(d>underMax) underMax=d; peak=e.v; curStart=e.i; peakI=e.i; } var dd=e.v/peak-1; if(dd<mdd){ mdd=dd; mddStartI=peakI; mddEndI=e.i; } });
  /* 연도별 손익은 자산 곡선에서 구한다(연도를 넘는 보유의 평가 손익 포함) */
  var tail=endI-curStart; if(tail>underMax) underMax=tail;
  var byYear={}, prev=1; eq.forEach(function(e,j){ var y=idxToDate(e.i).getFullYear(), nx=eq[j+1]; if(!byYear[y]) byYear[y]={base:prev,n:0,w:0,pnl:0}; if(!nx||idxToDate(nx.i).getFullYear()!==y){ byYear[y].pnl=e.v/byYear[y].base-1; prev=e.v; } });
  trades.forEach(function(t){ var y=idxToDate(t.exit).getFullYear(); if(byYear[y]){ byYear[y].n++; if(t.pnl>0) byYear[y].w++; } });
  var worstYear=null,bestYear=null; Object.keys(byYear).forEach(function(y){ if(worstYear===null||byYear[y].pnl<byYear[worstYear].pnl) worstYear=y; if(bestYear===null||byYear[y].pnl>byYear[bestYear].pnl) bestYear=y; });
  var years=Math.max((endI-startI)/365,0.2), n=trades.length, mean=n?trades.reduce(function(a,t){return a+t.pnl;},0)/n:0;
  var sd=n>1?Math.sqrt(trades.reduce(function(a,t){return a+Math.pow(t.pnl-mean,2);},0)/(n-1)):0, cagr=(Math.pow(Math.max(equity,0.01),1/years)-1)*100;
  return {params:params,trades:trades,eq:eq,ret:(equity-1)*100,mdd:mdd*100,winRate:n?wins.length/n*100:0,n:n,pf:gl>0?gw/gl:gw>0?9.9:0,
    byYear:byYear,worstYear:worstYear,bestYear:bestYear,worstYearPnl:worstYear?byYear[worstYear].pnl*100:0,bestYearPnl:bestYear?byYear[bestYear].pnl*100:0,
    mddStartI:mddStartI,mddEndI:mddEndI,underwaterDays:underMax,cagr:cagr,sharpe:sd>0?mean/sd*Math.sqrt(n/years):0,sortino:0,calmar:mdd<0?cagr/Math.abs(mdd*100):0,
    exposure:invested/Math.max(endI-startI+1,1)*100,tradeVol:sd*100,avgHold:n?trades.reduce(function(a,t){return a+(t.exit-t.entry);},0)/n:0,lossCount:losses.length,lowVolLosses:0,lowVolLossShare:0,costImpact:L.fees*100};
}
/* 직접 탐색: 종목 묶음을 비교해 고르고, 비중을 정하고, 약해지면 내린다.
   c = {uni:[키], look:비교 기간, top:동시에 드는 종목 수(1~4), gate:오르는 종목 비율 기준, every:재평가 간격(일), trail:고점 대비 이탈 폭(%), volT:목표 하루 변동, minS:최소 강도, startI} */
function mkAgentRun(c){
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
/* 혼합: AI 가 거래할 종목을 고르고(every 일마다, 60일 평균 위에서 가장 많이 오른 종목), 규칙 신호가 떠도 시장이 약하면 진입을 보류한다.
   진입과 청산은 규칙: 떨어진 뒤(rsi) 반등(+0.5% 초과)에 사서, 익절 또는 손절 조건에 닿은 날 종가에, 아니면 25일째 종가에 판다.
   c = {uni, every, look, rsiTh, tp, sl, gate, startI} */
/* 조건 실행: 종목이 하나로 고정된 같은 계산기. c = {asset, rsiTh, tp, sl, tf, startI} */
function mkRuleRun(c){ return mkHybridRun({asset:c.asset,rsiTh:c.rsiTh,tp:c.tp,sl:c.sl,tf:c.tf,fng:c.fng,every:1,gate:0,startI:c.startI}); }
/* 그날 그 자산이 실제로 거래됐는가(쉬는 날은 직전 종가를 이어 붙였을 뿐 체결할 수 없다) */
function mkOpen(k,i){ var o=window.TETH_PX&&TETH_PX.open&&TETH_PX.open[k]; return !o||o.charCodeAt(i)===49; }
/* 공포 탐욕 지수(그날 00시 UTC 발표, 그날 종가 판단에 쓸 수 있음). 자료가 없으면 null */
function mkFng(i){ var f=window.TETH_PX&&TETH_PX.fng; return f&&f[i]!=null?f[i]:null; }
function mkHybridRun(c){
  var fixed=c.asset||null, U=fixed?[fixed]:c.uni, PX=U.map(function(k){ return mkPx(k); }), N=PX[0].length, endI=N-1, startI=Math.max(61,(c.look||0)+1,c.startI||61);
  mkCheckIn(PX,N,{every:c.every||1,look:c.look});
  function upN(i){ var u=0; for(var z=0;z<U.length;z++) if(PX[z][i]>sma(PX[z],60,i)) u++; return u; }
  function cond(P,i){ var rv=rsi(P,i-1), bo=(P[i]/P[i-1]-1)*100, s20=sma(P,20,i), s60=sma(P,60,i), gap=Math.abs(s20-s60)/P[i]*100, up=upN(i); return {i:i,rsi:rv,rsiOk:rv<c.rsiTh,bounce:bo,bounceOk:bo>0.5,gap:gap,trendOk:!c.tf||gap>3,fng:mkFng(i),fngOk:c.fng==null||(mkFng(i)!=null&&mkFng(i)<=c.fng),up:up,of:U.length,mktOk:!!fixed||!c.gate||up/U.length>=c.gate}; }
  var J={}; U.forEach(function(k,j){ J[k]=j; });
  var L=mkLedger(), eq=[], ev=[], pick=fixed, cur=startI, topAt=null, lastTop=null, invested=0, lastEv=null, px=function(k){ return PX[J[k]][cur]; }, pend=null;
  function choose(i){ var rows=U.map(function(k,j){ var P=PX[j]; return {k:k,mom:P[i]/P[i-c.look]-1,above:P[i]>sma(P,60,i)}; }); var up=rows.filter(function(r){ return r.above; }); up.sort(function(a,b){ return b.mom-a.mom; }); return {rows:up,up:up.length}; }
  for(var i=startI;i<=endI;i++){
    cur=i;
    /* 대기 주문 체결: 판단한 다음 거래일 종가 */
    if(pend&&mkOpen(pend.k,i)){ var e0=pend.ev; delete e0._pend; e0.xi=i;
      if(pend.t==='buy'){ var Pb=PX[J[pend.k]], bb=L.buy(pend.k,Pb[i],L.cash,i,{w:1}); if(bb){ e0.tid=bb.id; e0.px=Pb[i]; e0.units=bb.units; e0.cost=bb.cost; e0.fee=bb.fee; } else e0._drop=1; }
      else { var ts=L.sell(pend.p,px(pend.p.k),i,pend.why); e0.tid=ts.id; e0.px=ts.xp; e0.units=ts.units; e0.got=ts.got; e0.fee=ts.fee; e0.chg=(ts.xp/pend.p.ep-1)*100; e0.pnl=ts.pnl*100; }
      pend=null; }
    var p=L.pos[0]||null;
    if(!fixed&&!p&&!pend&&(i-startI)%c.every===0){ var C=choose(i); topAt=i; lastTop=C.rows.slice(0,3).map(function(r){ return {k:r.k,mom:r.mom*100}; });
      if(!C.rows.length){ if(pick!==null) ev.push({i:i,t:'unpick'}); pick=null; }
      else if(pick!==C.rows[0].k){ pick=C.rows[0].k; ev.push({i:i,t:'pick',a:pick,mom:C.rows[0].mom*100,top:lastTop}); } }
    if(!p&&!pend){ if(pick!==null&&mkOpen(pick,i)){ var P=PX[J[pick]], q=cond(P,i);
        if(q.rsiOk&&q.bounceOk&&q.trendOk&&q.fngOk){ var up2=q.up;
          if(!q.mktOk) ev.push({i:i,t:'veto',a:pick,up:up2,of:U.length,rsi:q.rsi,bounce:q.bounce});
          else { var eb={i:i,t:'enter',a:pick,rsi:q.rsi,bounce:q.bounce,fng:q.fng,up:up2,of:U.length,_pend:1}; ev.push(eb); pend={t:'buy',k:pick,ev:eb}; } } } }
    else if(p&&!pend&&i>p.ei&&mkOpen(p.k,i)){ var v=px(p.k), chg=(v/p.ep-1)*100, why=chg<=c.sl?'sl':(c.tp!=null&&chg>=c.tp)?'tp':(i-p.ei>=25?'time':null);
      if(why){ var es={i:i,t:'exit',a:p.k,why:why,_pend:1}; ev.push(es); pend={t:'sell',k:p.k,p:p,why:why,ev:es}; } }
    var v3=L.value(px); eq.push({i:i,v:v3}); invested+=(v3-L.cash)/v3;
  }
  ev=ev.filter(function(e){ return !e._pend&&!e._drop; }); /* 마지막 날까지 체결되지 않은 결정은 빼다 */
  cur=endI;
  var r=mkStatsOf(eq,L,{startI:startI,endI:endI,sl:c.sl,tp:c.tp,rsiTh:c.rsiTh},startI,endI,invested), o=L.pos[0]||null, Pn=pick!==null?PX[J[pick]]:null, ev1=c.every||1;
  r.events=ev;
  r.state={asOf:endI,pick:pick,top:lastTop,topAt:topAt,open:o?{k:o.k,tid:o.id,entry:o.ei,ep:o.ep,units:o.units,cost:o.cost,px:px(o.k),chg:(px(o.k)/o.ep-1)*100,held:endI-o.ei}:null,
    cond:Pn?cond(Pn,endI):null,lastEval:startI+Math.floor((endI-startI)/ev1)*ev1,nextEval:startI+(Math.floor((endI-startI)/ev1)+1)*ev1};
  return r;
}
