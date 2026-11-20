// @ts-nocheck
/* 생성 파일: tools/extract-from-html.mjs 가 원본 index.html 에서 그대로 꺼낸다. 손으로 고치지 않는다. */
/* 원본 큰 스크립트의 계산 엔진과 카탈로그를 글자 그대로 꺼낸 것이다. 가격 자료는 data/px-daily.js, data/fut-daily.js 가 window 에 싣는다. */
/* eslint-disable */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
var PRICE=(function(){
  if(window.TETH_PX&&TETH_PX.px&&TETH_PX.px['비트코인']) return TETH_PX.px['비트코인'].slice(); /* 실제 비트코인 일봉. 없을 때만 아래 씨앗 데이터 */
  var rng=mulberry32(3), p=[16500], regimes=[[0,365,.0016],[365,660,.00003],[660,1050,.0013],[1050,1335,.0004]];
  for(var i=1;i<1335;i++){
    var drift=.0005;
    for(var r=0;r<regimes.length;r++){ if(i>=regimes[r][0]&&i<regimes[r][1]) drift=regimes[r][2]; }
    var shock=(rng()-.5)*.036;
    p.push(Math.max(9000, p[i-1]*(1+drift+shock)));
  }
  return p;
})();
var PRICE0=PRICE, MK_PXC={};
function mkPx(key){
  if(!key) return PRICE0;
  if(window.TETH_PX&&TETH_PX.px&&TETH_PX.px[key]) return TETH_PX.px[key]; /* 실제 일봉(쉬는 날은 직전 종가) */
  var c=MK_PX_CFG[key]; if(!c) return PRICE0;
  var ck=key+'|'+c.join('/')+'|'+PRICE0.length+'|'+MK_DATA_V; if(MK_PXC[ck]) return MK_PXC[ck];
  var rng=mulberry32(c[0]), p0=c[1], vol=c[2], N=PRICE0.length, p=[p0], i=1;
  while(i<N){
    var len=90+Math.floor(rng()*240), drift=(rng()*2.6-0.7)*0.001;
    for(var k=0;k<len&&i<N;k++,i++){
      var sh=(rng()-.5)*vol; if(rng()<0.014) sh+=(rng()-.66)*vol*3.2;
      p.push(Math.max(p0*0.18,p[i-1]*(1+drift+sh)));
    }
  }
  return (MK_PXC[ck]=p);
}
function mkWithPx(key,fn){ var keep=PRICE; PRICE=mkPx(key); try{ return fn(); } finally{ PRICE=keep; } }
function mkPxFmt(v){ if(v==null||!isFinite(v)) return '-'; var a=Math.abs(v); return a>=1000?Math.round(v).toLocaleString():a>=100?v.toFixed(1):a>=1?v.toFixed(2):v.toFixed(4); }
function sma(arr,n,i){ if(i<n-1) return null; var s=0; for(var k=i-n+1;k<=i;k++) s+=arr[k]; return s/n; }
function rsi(arr,i){
  var n=14; if(i<n) return 50;
  var g=0,l=0;
  for(var k=i-n+1;k<=i;k++){ var d=arr[k]-arr[k-1]; if(d>0) g+=d; else l-=d; }
  if(l===0) return 100;
  return 100-100/(1+(g/n)/(l/n));
}
var RUNSTATS={total:0,by:{}};
function runBacktest(params){ return mkWithPx(params&&params.px,function(){ return runBacktestCore(params); }); }
function runBacktestCore(params){
  RUNSTATS.total++; var pu=params.purpose||'candidate'; RUNSTATS.by[pu]=(RUNSTATS.by[pu]||0)+1;
  var sl=params.sl/100, tp=params.tp!=null?params.tp/100:null, rsiTh=params.rsiTh, trendFilter=params.trendFilter;
  var startI=params.startI!=null?params.startI:61, endI=params.endI!=null?params.endI:PRICE.length-1;
  var fee=params.feeRate!=null?params.feeRate:0.002, dly=params.entryDelay||0;
  var trades=[], eq=[{i:startI,v:1}], equity=1, inPos=false, entryI=0, entryP=0;
  for(var i=startI;i<=endI;i++){
    var s20=sma(PRICE,20,i), s60=sma(PRICE,60,i);
    if(!inPos){
      var wasLow = rsi(PRICE,i-1) < rsiTh;
      var bounce = PRICE[i] > PRICE[i-1]*1.005;
      var trendOk = !trendFilter || Math.abs(s20 - s60)/PRICE[i] > 0.03;
      if(wasLow && bounce && trendOk && i+dly<=endI){ inPos=true; entryI=i+dly; entryP=PRICE[i+dly]; }
    } else if(i>entryI){
      var chg=PRICE[i]/entryP-1, exit=null, exitPnl=0;
      if(chg<=sl){ exit='sl'; exitPnl=params.fill==='close'?chg:sl; } /* fill:'close' 는 조건에 닿은 날의 종가로 체결 */
      else if(tp!=null && chg>=tp){ exit='tp'; exitPnl=params.fill==='close'?chg:tp; }
      else if(i-entryI>=25){ exit='time'; exitPnl=chg; }
      if(exit){
        equity*=(1+exitPnl-fee);
        trades.push({entry:entryI, exit:i, pnl:exitPnl-fee, kind:exit});
        eq.push({i:i,v:equity});
        inPos=false;
      }
      else eq.push({i:i,v:equity*(1+chg)}); /* 보유 중 평가액 — 낙폭(mdd)이 청산 시점만 보던 왜곡 제거 (codex QA P1) */
    }
  }
  /* 관측 종료 시점의 미청산 포지션도 평가에 반영 — 마지막 보유 손익이 수익률에서 증발하지 않게 */
  var openPnl=0;
  if(inPos&&endI>entryI){ openPnl=PRICE[endI]/entryP-1; equity*=(1+openPnl); eq.push({i:endI,v:equity}); }
  S.btCount=(S.btCount||0)+1;
  /* low-volatility flag per trade (entry-time trend strength) */
  trades.forEach(function(t){
    var a=sma(PRICE,20,t.entry), b=sma(PRICE,60,t.entry);
    t.lowVol = Math.abs(a-b)/PRICE[t.entry] < 0.03;
  });
  var wins=trades.filter(function(t){return t.pnl>0;});
  var losses=trades.filter(function(t){return t.pnl<=0;});
  var gw=wins.reduce(function(a,t){return a+t.pnl;},0);
  var gl=losses.reduce(function(a,t){return a-t.pnl;},0);
  /* mdd + longest underwater */
  var peak=1, peakI=startI, mdd=0, mddStartI=startI, mddEndI=startI, curStart=startI, underMax=0;
  eq.forEach(function(e){
    if(e.v>=peak){ var dur=e.i-curStart; if(dur>underMax) underMax=dur; peak=e.v; curStart=e.i; peakI=e.i; }
    var dd=e.v/peak-1;
    if(dd<mdd){ mdd=dd; mddStartI=peakI; mddEndI=e.i; }
  });
  var tailDur=endI-curStart; if(tailDur>underMax) underMax=tailDur;
  /* per-year */
  var byYear={};
  trades.forEach(function(t){
    var y=idxToDate(t.exit).getFullYear();
    if(!byYear[y]) byYear[y]={prod:1,pnl:0,n:0,w:0};
    byYear[y].prod*=(1+t.pnl); byYear[y].n++; if(t.pnl>0) byYear[y].w++;
  });
  Object.keys(byYear).forEach(function(y){ byYear[y].pnl=byYear[y].prod-1; }); /* 연 수익률 = 체결 복리 — 자산 곡선과 같은 계산 (codex qa3 P1-7) */
  var worstYear=null, bestYear=null;
  Object.keys(byYear).forEach(function(y){
    if(worstYear===null||byYear[y].pnl<byYear[worstYear].pnl) worstYear=y;
    if(bestYear===null||byYear[y].pnl>byYear[bestYear].pnl) bestYear=y;
  });
  /* advanced */
  var years=Math.max((endI-startI)/365,0.2), n=trades.length;
  var mean=n?trades.reduce(function(a,t){return a+t.pnl;},0)/n:0;
  var sd=n>1?Math.sqrt(trades.reduce(function(a,t){return a+Math.pow(t.pnl-mean,2);},0)/(n-1)):0;
  var dSd=losses.length>1?Math.sqrt(losses.reduce(function(a,t){return a+t.pnl*t.pnl;},0)/losses.length):Math.abs(sl);
  var cagr=(Math.pow(equity,1/years)-1)*100;
  var sharpe=sd>0?mean/sd*Math.sqrt(n/years):0;
  var sortino=dSd>0?mean/dSd*Math.sqrt(n/years):0;
  var expoDays=trades.reduce(function(a,t){return a+(t.exit-t.entry);},0);
  var lowVolLosses=losses.filter(function(t){return t.lowVol;}).length;
  var eqNoFee=trades.reduce(function(a,t){return a*(1+t.pnl+fee);},1);
  return {
    params:params, trades:trades, eq:eq,
    ret:(equity-1)*100, mdd:mdd*100,
    winRate:n?wins.length/n*100:0,
    n:n, pf:gl>0?gw/gl:gw>0?9.9:0,
    byYear:byYear, worstYear:worstYear, bestYear:bestYear,
    worstYearPnl:worstYear?byYear[worstYear].pnl*100:0,
    bestYearPnl:bestYear?byYear[bestYear].pnl*100:0,
    mddStartI:mddStartI, mddEndI:mddEndI, underwaterDays:underMax,
    cagr:cagr, sharpe:sharpe, sortino:sortino,
    calmar:mdd<0?cagr/Math.abs(mdd*100):0,
    exposure:expoDays/Math.max(endI-startI,1)*100, tradeVol:sd*100,
    avgHold:n?expoDays/n:0,
    lossCount:losses.length, lowVolLosses:lowVolLosses,
    lowVolLossShare:losses.length?lowVolLosses/losses.length*100:0,
    costImpact:(eqNoFee-equity)*100
  };
}
var MK_FEE=0.001;
function mkVol(P,i,n){ var s=0,q=0; for(var k=i-n+1;k<=i;k++){ var r=P[k]/P[k-1]-1; s+=r; q+=r*r; } var m=s/n; return Math.sqrt(Math.max(1e-12,q/n-m*m)); }
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
function mkRuleRun(c){ return mkHybridRun({asset:c.asset,rsiTh:c.rsiTh,tp:c.tp,sl:c.sl,tf:c.tf,fng:c.fng,every:1,gate:0,startI:c.startI}); }
function mkOpen(k,i){ var o=window.TETH_PX&&TETH_PX.open&&TETH_PX.open[k]; return !o||o.charCodeAt(i)===49; }
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
var MK_FUT_FEE=0.00055, MK_FUT_SLIP=0.0005, MK_FUT_MMR=0.005;
function fuD(k){ var d=window.TETH_FUT&&TETH_FUT.sym&&TETH_FUT.sym[k]; if(!d) throw new Error('fut data: '+k); return d; }
function fuSma(A,n,i){ var s=0; for(var k=i-n+1;k<=i;k++) s+=A[k]; return s/n; }
function fuMax(A,a,b){ var m=-Infinity; for(var k=a;k<=b;k++) if(A[k]>m) m=A[k]; return m; }
function fuMin(A,a,b){ var m=Infinity; for(var k=a;k<=b;k++) if(A[k]<m) m=A[k]; return m; }
function fuVol(C,i,n){ var s=0,q=0; for(var k=i-n+1;k<=i;k++){ var r=C[k]/C[k-1]-1; s+=r; q+=r*r; } var m=s/n; return Math.sqrt(Math.max(1e-12,q/n-m*m)); }
function fuFng(i){ var f=window.TETH_PX&&TETH_PX.fng; return f&&f[i]!=null?f[i]:null; }
function fuLedger(){
  var L={cash:1,pos:[],trades:[],fees:0,fund:0,seq:0,liq:0};
  L.eqOf=function(p,price){ return p.margin+p.side*p.units*(price-p.ep)-p.fund; };
  L.value=function(px){ var v=L.cash; L.pos.forEach(function(p){ v+=Math.max(0,L.eqOf(p,px(p.k))); }); return v; };
  L.open=function(k,side,amount,lev,price,i,meta){ amount=Math.min(amount,L.cash); if(!(amount>1e-9)||!(price>0)) return null;
    var fill=price*(1+side*MK_FUT_SLIP), fee=amount*lev*MK_FUT_FEE/(1+lev*MK_FUT_FEE), margin=amount-fee, units=margin*lev/fill;
    L.cash-=amount; L.fees+=fee; var p={id:++L.seq,k:k,side:side,lev:lev,units:units,ep:fill,margin:margin,cost:amount,fee:fee,fund:0,ei:i,best:fill,w:meta&&meta.w}; L.pos.push(p); return p; };
  /* 강제 청산 가격: 증거금에서 손익과 펀딩비를 빼고 남은 돈이 유지 증거금(체결 금액의 0.5%)과 같아지는 가격 */
  L.liqPx=function(p){ return p.ep-p.side*(p.margin-p.fund-MK_FUT_MMR*p.units*p.ep)/p.units; };
  L.close=function(p,price,i,why,raw){ var fill=raw?price:price*(1-p.side*MK_FUT_SLIP), fee=p.units*fill*MK_FUT_FEE, got=why==='liq'?0:Math.max(0,L.eqOf(p,fill)-fee);
    L.cash+=got; L.fees+=fee; L.fund+=p.fund; if(why==='liq') L.liq++; L.pos=L.pos.filter(function(x){ return x!==p; });
    var t={id:p.id,fut:1,entry:p.ei,exit:i,asset:p.k,side:p.side,lev:p.lev,ep:p.ep,xp:fill,units:p.side*p.units,cost:p.cost,got:got,fee:p.fee+fee,fund:p.fund,pnl:got/p.cost-1,kind:why,w:p.w}; L.trades.push(t); return t; };
  return L;
}
function mkFutRun(c){
  var U=c.asset?[c.asset]:c.uni, DT=U.map(fuD), N=DT[0].c.length, endI=N-1, J={}; U.forEach(function(k,j){ J[k]=j; });
  var need=Math.max(61,(c.n||0)+2,(c.look||0)+2,(c.reg||0)+2,(c.slow||0)+2), startI=Math.max(need,c.startI||61), lev=Math.max(1,Math.min(10,c.lev||1));
  var L=fuLedger(), eq=[], ev=[], pend=[], cur=startI, invested=0, px=function(k){ return DT[J[k]].c[cur]; };
  var top=Math.max(1,Math.min(4,c.top||1)), every=c.every||1, pickL=c.asset||null, pickS=c.asset||null, lastTop=null, regime=c.asset?2:0; /* 2=양쪽, 1=롱만, -1=숏만, 0=쉼 */
  function qClose(p,why,i,extra){ if(pend.some(function(o){ return o.t==='close'&&o.p===p; })) return; var e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:why,_pend:1}; if(extra) for(var k in extra) e[k]=extra[k]; ev.push(e); pend.push({t:'close',p:p,why:why,ev:e}); }
  function qOpen(k,side,w,i,extra){ var e={i:i,t:'enter',a:k,side:side,lev:lev,_pend:1}; for(var x in extra) e[x]=extra[x]; ev.push(e); pend.push({t:'open',k:k,side:side,w:w,ev:e}); }
  function fillExit(e,t){ delete e._pend; e.xi=t.exit; e.tid=t.id; e.px=t.xp; e.units=Math.abs(t.units); e.got=t.got; e.fee=t.fee; e.fund=t.fund; e.ep=t.ep; e.chg=t.side*(t.xp/t.ep-1)*100; e.pnl=t.pnl*100; }
  /* 규칙 신호: 그 종목의 그날 종가 기준. +1 롱 진입, -1 숏 진입, 0 없음 */
  function sig(j,i){ var D=DT[j], C=D.c, s=0;
    if(c.mode==='brk'){ if(C[i]>fuMax(D.h,i-c.n,i-1)) s=1; else if(C[i]<fuMin(D.l,i-c.n,i-1)) s=-1; }
    else if(c.mode==='ma'){ var f0=fuSma(C,c.fast,i), s0=fuSma(C,c.slow,i), f1=fuSma(C,c.fast,i-1), s1=fuSma(C,c.slow,i-1); if(f0>s0&&f1<=s1) s=1; else if(f0<s0&&f1>=s1) s=-1; }
    else if(c.mode==='fg'){ var g=fuFng(i), r=C[i]/C[i-1]-1; if(g!=null&&g<=c.lo&&r>0.005) s=1; else if(g!=null&&g>=c.hi&&r<-0.005) s=-1; }
    else if(c.mode==='dip'){ var r2=C[i]/C[i-1]-1, dd=C[i]/fuMax(D.h,i-c.n,i)-1, up=C[i]/fuMin(D.l,i-c.n,i)-1; if(dd<=-c.dip/100&&r2>0.005) s=1; else if(up>=c.dip/100&&r2<-0.005) s=-1; }
    if(s&&c.reg){ var m=fuSma(C,c.reg,i); if(s>0&&C[i]<m) s=0; if(s<0&&C[i]>m) s=0; }
    if(s>0&&c.dir==='short') s=0; if(s<0&&c.dir==='long') s=0;
    return s; }
  function scan(i){ var rows=U.map(function(k,j){ var C=DT[j].c, m=C[i]/C[i-c.look]-1, v=fuVol(C,i,20); return {k:k,j:j,mom:m,vol:v,score:m/(v*Math.sqrt(c.look)),above:C[i]>fuSma(C,60,i)}; });
    var up=rows.filter(function(r){ return r.above; }).length; rows.sort(function(a,b){ return b.score-a.score; }); return {rows:rows,up:up,of:U.length,br:up/U.length}; }
  for(var i=startI;i<=endI;i++){
    cur=i;
    /* ① 전날 정한 주문: 시가 체결. 닫고 나서 연다 */
    if(pend.length){ var opx=function(k){ return DT[J[k]].o[i]; };
      pend.forEach(function(o){ if(o.t!=='close'||L.pos.indexOf(o.p)<0){ if(o.t==='close') o.ev._drop=1; return; } var po=opx(o.p.k), lq=L.liqPx(o.p), gl=o.p.side>0?po<=lq:po>=lq; if(gl) o.ev.why='liq'; fillExit(o.ev,L.close(o.p,po,i,gl?'liq':o.why,gl)); });
      var tot=L.cash; L.pos.forEach(function(p){ tot+=Math.max(0,L.eqOf(p,opx(p.k))); });
      pend.forEach(function(o){ if(o.t!=='open') return; var p=L.open(o.k,o.side,o.w*tot,lev,opx(o.k),i,{w:o.w}), e=o.ev; if(!p){ e._drop=1; return; } delete e._pend; e.xi=i; e.tid=p.id; e.px=p.ep; e.units=p.units; e.cost=p.cost; e.fee=p.fee; e.liq=L.liqPx(p); });
      pend=[]; }
    /* ② 장중: 강제 청산, 손절, 고점 추적 손절, 익절 */
    L.pos.slice().forEach(function(p){ var D=DT[J[p.k]], o=D.o[i], hi=D.h[i], lo=D.l[i], fresh=p.ei===i;
      var liq=L.liqPx(p), stop=c.sl?p.ep*(1-p.side*c.sl/100):null, tr=(c.trail&&!fresh)?p.best*(1-p.side*c.trail/100):null, tp=c.tp?p.ep*(1+p.side*c.tp/100):null;
      var worse=function(a,b){ return a==null?b:b==null?a:(p.side>0?Math.max(a,b):Math.min(a,b)); }, s0=worse(stop,tr), hitAdv=function(x){ return x!=null&&(p.side>0?lo<=x:hi>=x); }, gap=function(x){ return p.side>0?o<=x:o>=x; };
      var e;
      /* 시가가 이미 강제 청산 가격이나 익절 가격을 넘어 시작한 날: 시가에서 먼저 처리한다 */
      if(!fresh&&(p.side>0?o<=liq:o>=liq)){ e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:'liq',ref:liq}; ev.push(e); fillExit(e,L.close(p,o,i,'liq',true)); return; }
      if(!fresh&&tp!=null&&(p.side>0?o>=tp:o<=tp)){ e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:'tp',ref:tp}; ev.push(e); fillExit(e,L.close(p,o,i,'tp',true)); return; }
      if(s0!=null&&(p.side>0?s0>liq:s0<liq)&&hitAdv(s0)){ var why=(tr!=null&&s0===tr)?'trail':'sl'; e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:why,ref:s0}; ev.push(e); fillExit(e,L.close(p,(!fresh&&gap(s0))?o:s0,i,why)); return; }
      if(hitAdv(liq)){ e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:'liq',ref:liq}; ev.push(e); fillExit(e,L.close(p,liq,i,'liq',true)); return; }
      if(tp!=null&&(p.side>0?hi>=tp:lo<=tp)){ e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:'tp',ref:tp}; ev.push(e); fillExit(e,L.close(p,(!fresh&&(p.side>0?o>=tp:o<=tp))?o:tp,i,'tp',true)); return; }
    });
    /* ③ 펀딩비: 롱은 펀딩비가 양수일 때 내고, 숏은 받는다 */
    L.pos.forEach(function(p){ var D=DT[J[p.k]]; p.fund+=p.side*p.units*D.c[i]*D.f[i]/1e4; if(p.side>0?D.c[i]>p.best:D.c[i]<p.best) p.best=D.c[i]; });
    /* ④ 종가로 다음 날 주문을 정한다 */
    var held=function(k){ return L.pos.filter(function(p){ return p.k===k; })[0]||null; };
    if(c.kind==='agent'){
      if((i+(c.ph||0))%every===0){ var S=scan(i), rk={}; S.rows.forEach(function(r,q){ rk[r.k]=q; }); var n=S.rows.length;
        var reg=c.neutral?2:(S.br>=c.gate?1:(S.br<=1-c.gate?-1:0)), wantL=(reg===1||reg===2)?S.rows.slice(0,top).filter(function(r){ return c.neutral||(r.above&&r.score>0); }):[], wantS=(reg===-1||reg===2)?S.rows.slice(n-top).filter(function(r){ return c.neutral||(!r.above&&r.score<0); }):[];
        if(c.dir==='long') wantS=[]; if(c.dir==='short') wantL=[];
        var top3=S.rows.slice(0,3).map(function(r){ return {k:r.k,mom:r.mom*100}; }), bot3=S.rows.slice(n-3).reverse().map(function(r){ return {k:r.k,mom:r.mom*100}; });
        var want={}; wantL.forEach(function(r){ want[r.k]=1; }); wantS.forEach(function(r){ want[r.k]=-1; });
        L.pos.slice().forEach(function(p){ if(want[p.k]!==p.side) qClose(p,want[p.k]?'flip':(reg===0?'rest':'rot'),i); });
        var slots=(c.neutral?2:1)*top, fresh2=0;
        [].concat(wantL.map(function(r){ return [r,1]; }),wantS.map(function(r){ return [r,-1]; })).forEach(function(x){ var r=x[0], sd=x[1], h=held(r.k); if(h&&h.side===sd) return; fresh2++;
          qOpen(r.k,sd,1/slots,i,{mom:r.mom*100,rank:sd>0?rk[r.k]+1:n-rk[r.k],up:S.up,of:S.of,top:top3,bot:bot3,w:1/slots}); });
        if(!fresh2) ev.push({i:i,t:(wantL.length+wantS.length)?'hold':'skip',why:reg===0?'gate':'none',up:S.up,of:S.of,top:top3,bot:bot3,held:L.pos.map(function(p){ return p.k; })}); }
    } else {
      if(c.kind==='mix'&&(i+(c.ph||0))%every===0&&!L.pos.length){ var S2=scan(i), n2=S2.rows.length, a=S2.rows[0], b=S2.rows[n2-1];
        regime=S2.br>=c.gate?1:(S2.br<=1-c.gate?-1:0); lastTop={up:S2.up,of:S2.of,top:S2.rows.slice(0,3).map(function(r){ return {k:r.k,mom:r.mom*100}; }),bot:S2.rows.slice(n2-3).reverse().map(function(r){ return {k:r.k,mom:r.mom*100}; })};
        var nl=regime>0?a.k:null, ns=regime<0?b.k:null;
        if(nl!==pickL||ns!==pickS){ pickL=nl; pickS=ns; ev.push(nl||ns?{i:i,t:'pick',a:nl||ns,side:nl?1:-1,mom:(nl?a:b).mom*100,up:S2.up,of:S2.of,top:lastTop.top,bot:lastTop.bot}:{i:i,t:'unpick',up:S2.up,of:S2.of}); } }
      var p0=L.pos[0]||null;
      /* 보유 중: 반대 신호나 출구 채널, 보유 기한 */
      if(p0&&!pend.length){ var jj=J[p0.k], D0=DT[jj], sg=sig(jj,i), out=null;
        if(c.exitN&&(p0.side>0?D0.c[i]<fuMin(D0.l,i-c.exitN,i-1):D0.c[i]>fuMax(D0.h,i-c.exitN,i-1))) out='chan';
        else if(c.hold&&i-p0.ei>=c.hold) out='time';
        if(sg&&sg!==p0.side&&(c.kind!=='mix'||regime===sg||regime===2)){ qClose(p0,'flip',i); qOpen(p0.k,sg,1,i,{n:c.n,ref:sg>0?fuMax(D0.h,i-(c.n||1),i-1):fuMin(D0.l,i-(c.n||1),i-1),fng:fuFng(i),up:lastTop&&lastTop.up,of:lastTop&&lastTop.of}); }
        else if(out) qClose(p0,out,i); }
      else if(!p0&&!pend.length){ var cand=c.kind==='mix'?[pickL,pickS].filter(function(k){ return k; }):[c.asset];
        cand.forEach(function(k){ if(pend.length) return; var j2=J[k], D2=DT[j2], s2=sig(j2,i); if(!s2) return;
          if(c.kind==='mix'){ var okSide=(k===pickL&&s2>0)||(k===pickS&&s2<0); if(!okSide){ ev.push({i:i,t:'veto',a:k,side:s2,up:lastTop&&lastTop.up,of:lastTop&&lastTop.of,reg:regime}); return; } }
          qOpen(k,s2,1,i,{n:c.n,ref:c.mode==='brk'?(s2>0?fuMax(D2.h,i-c.n,i-1):fuMin(D2.l,i-c.n,i-1)):null,chg1:(D2.c[i]/D2.c[i-1]-1)*100,fng:fuFng(i),up:lastTop&&lastTop.up,of:lastTop&&lastTop.of}); }); }
    }
    var v=L.value(px); eq.push({i:i,v:v}); invested+=v>0?(v-L.cash)/v:0;
    if(v<=1e-6){ for(var z=i+1;z<=endI;z++) eq.push({i:z,v:0}); break; }
  }
  ev=ev.filter(function(e){ return !e._pend&&!e._drop; });
  cur=endI;
  var r=mkStatsOf(eq,L,{startI:startI,endI:endI},startI,endI,invested), tv=L.value(px);
  r.events=ev; r.fut=1; r.liqN=L.liq; r.fundPaid=L.fund+L.pos.reduce(function(a,p){ return a+p.fund; },0); r.feesPaid=L.fees;
  r.state={asOf:endI,fut:1,cash:tv>0?L.cash/tv:1,pickL:pickL,pickS:pickS,regime:regime,top:lastTop,
    open:(function(a){ return c.kind==='agent'?a:(a[0]||null); })(L.pos.map(function(p){ var v2=px(p.k); return {held:endI-p.ei,k:p.k,tid:p.id,side:p.side,lev:p.lev,entry:p.ei,ep:p.ep,units:p.side*p.units,cost:p.cost,px:v2,chg:p.side*(v2/p.ep-1)*100,pnl:(Math.max(0,L.eqOf(p,v2))/p.cost-1)*100,liq:L.liqPx(p),w:tv>0?Math.max(0,L.eqOf(p,v2))/tv:0,fut:1}; }))};
  return r;
}
function fuIs(s){ return !!(s&&s.cfg&&s.cfg.fut); }
function fuSd(v){ return v>0?'롱':'숏'; }
var FU_WHY={sl:'진입가에서 손절 기준만큼 불리하게 움직였습니다',trail:'가장 유리했던 가격에서 기준만큼 되돌렸습니다',tp:'목표까지 움직였습니다',time:'보유 기한을 채웠습니다',chan:'추세가 꺾였습니다',flip:'반대 방향 신호가 나왔습니다',liq:'증거금이 바닥나 강제 청산됐습니다',rot:'순위에서 밀렸습니다',rest:'시장 방향이 애매해 쉬기로 했습니다'};
var FU_WHY_P={sl:'진입가 대비 손절 기준에 도달했다',trail:'가장 유리했던 가격 대비 되돌림이 추적 손절 기준에 닿았다',tp:'익절 목표에 도달했다',time:'보유 기한이 지나 청산했다',chan:'가격이 출구 기준선을 벗어나 추세가 꺾였다고 판단했다',flip:'반대 방향 신호가 나와 포지션을 닫았다',liq:'증거금이 유지 증거금 아래로 내려가 강제 청산됐다',rot:'순위에서 밀렸다',rest:'시장 방향이 불분명해 포지션을 닫고 쉬었다'};
function fuSig(c){
  if(c.mode==='brk') return '종가가 최근 '+c.n+'일 최고가를 넘으면 롱, 최근 '+c.n+'일 최저가 아래로 내려가면 숏';
  if(c.mode==='ma') return c.fast+'일 평균 가격이 '+c.slow+'일 평균을 위로 넘으면 롱, 아래로 내려가면 숏';
  if(c.mode==='dip') return '최근 '+c.n+'일 고점에서 '+c.dip+'% 넘게 밀렸다가 반등하면 롱, 저점에서 '+c.dip+'% 넘게 올랐다가 꺾이면 숏';
  if(c.mode==='fg') return '공포 탐욕 지수가 '+c.lo+' 이하일 때 반등하면 롱, '+c.hi+' 이상일 때 꺾이면 숏';
  return ''; }
function fuOuts(c){ var o=[]; if(c.kind!=='agent') o.push('반대 방향 신호가 나오면 닫고 방향을 바꿉니다'); if(c.exitN) o.push('종가가 반대쪽 '+c.exitN+'일 기준선을 벗어나면 닫습니다'); if(c.trail) o.push('가장 유리했던 종가에서 '+c.trail+'% 되돌리면 닫습니다'); if(c.sl) o.push('진입가에서 '+c.sl+'% 불리하게 움직이면 닫습니다'); if(c.tp) o.push('진입가에서 '+c.tp+'% 유리하게 움직이면 닫습니다'); if(c.hold) o.push('길어도 '+c.hold+'일'); return o; }
function fuNeed(c,n){ return {L:Math.ceil(c.gate*n-1e-9),S:Math.floor((1-c.gate)*n+1e-9)}; }
function fuAiTxt(s){ var c=s.cfg, u=mkUni(s), n=u.list.length, q=fuNeed(c,n), ev=c.every===1?'매일':c.every+'일마다';
  var cL=q.L>=n?n+'종목이 모두 오름세면':'오름세 종목이 '+q.L+'개 이상이면', cS=q.S<=0?'하나도 오름세가 아니면':'오름세 종목이 '+q.S+'개 이하면';
  if(c.kind==='agent') return ev+' '+n+'종목을 비교합니다. '+cL+' 가장 강한 '+c.top+'종목을 롱, '+cS+' 가장 약한 '+c.top+'종목을 숏'+(q.L-q.S>1?', 그 사이면 쉽니다':'');
  return ev+' 방향과 종목을 정합니다. '+cL+' 가장 강한 종목을 롱 후보로, '+cS+' 가장 약한 종목을 숏 후보로'+(q.L-q.S>1?', 그 사이면 후보를 비웁니다':' 고릅니다'); }
function fuInst(s){ var c=s.cfg; return ['선물 롱/숏'+(c.lev>1?' '+c.lev+'배':'')]; }
var MK_PX_CFG={'비트코인':[799688,34120,0.07],'이더리움':[173287,1730,0.06],'테슬라':[700351,94.56,0.075],'금':[38266,1982,0.018],'나스닥':[463868,13680,0.024],'S&P 500':[313180,3696,0.023],'도지코인':[343292,0.09424,0.07],'엔비디아':[477311,16.31,0.07],'리플':[252221,0.4109,0.055],'솔라나':[769198,28.53,0.075],'애플':[321947,118.4,0.032],'에이다':[113,0.3221,0.085],'아발란체':[523,10.94,0.09],'비앤비':[179,275.8,0.055],'마이크로소프트':[303,295.8,0.032],'아마존':[141,105.1,0.04],'메타':[226,148.4,0.045],'알파벳':[168,105.2,0.038],'에이엠디':[162,77.19,0.065]};
var MK_UNI={
  coin8:{label:'가상자산 8종',list:['비트코인','이더리움','솔라나','리플','도지코인','에이다','아발란체','비앤비']},
  tech8:{label:'미국 기술주 8종',list:['엔비디아','테슬라','애플','마이크로소프트','아마존','메타','알파벳','에이엠디']},
  macro6:{label:'지수, 금, 주식, 가상자산 6종',list:['나스닥','S&P 500','금','비트코인','이더리움','엔비디아']},
  big3:{label:'가상자산 대표 3종',list:['비트코인','이더리움','솔라나']},
  idx3:{label:'지수와 금 3종',list:['나스닥','S&P 500','금']}
};
var MK_CAT=[
  {id:'f1',kind:'rule',mkt:'crypto',name:'비앤비 평균선 양방향 2배',one:'비앤비 선물의 20일 평균이 70일 평균을 넘으면 롱, 밑돌면 숏으로 2배 바꿔 탑니다.',ex:'binance',fw:612,by:'noel_b',asset:'비앤비',inst:'futures',fut:1,kind:'rule',mode:'ma',fast:20,slow:70,trail:25,sl:10,lev:2,startI:101},
  {id:'f2',kind:'rule',mkt:'crypto',name:'도지코인 평균선 양방향 2배',one:'도지코인 선물의 10일 평균이 100일 평균을 넘으면 롱, 밑돌면 숏으로 2배 바꿔 탑니다.',ex:'okx',fw:548,by:'tari',asset:'도지코인',inst:'futures',fut:1,kind:'rule',mode:'ma',fast:10,slow:100,trail:20,sl:10,lev:2,startI:101},
  {id:'f3',kind:'rule',mkt:'crypto',name:'아발란체 추세 양방향',one:'아발란체 선물이 55일 최고가를 넘으면 롱, 최저가를 깨면 숏으로 따라갑니다.',ex:'bitget',fw:731,by:'kite_r',asset:'아발란체',inst:'futures',fut:1,kind:'rule',mode:'brk',n:55,exitN:10,trail:20,reg:200,lev:1,startI:101},
  {id:'f4',kind:'rule',mkt:'crypto',name:'이더리움 추세 양방향 2배',one:'이더리움 선물이 70일 최고가를 넘으면 롱, 최저가를 깨면 숏으로 2배 따라갑니다.',ex:'bitget',fw:496,by:'dohyun_k',asset:'이더리움',inst:'futures',fut:1,kind:'rule',mode:'brk',n:70,exitN:20,trail:15,reg:200,lev:2,startI:101},
  {id:'f8',kind:'rule',mkt:'crypto',name:'아발란체 평균선 양방향',one:'아발란체 선물의 20일 평균이 100일 평균을 넘으면 롱, 밑돌면 숏으로 바꿔 탑니다.',ex:'okx',fw:455,by:'woo_l',asset:'아발란체',inst:'futures',fut:1,kind:'rule',mode:'ma',fast:20,slow:100,trail:20,sl:10,lev:1,startI:101},
  {id:'f7',kind:'agent',mkt:'crypto',name:'가장 강한 코인 롱숏',one:'AI가 3일마다 코인 8종을 비교해, 모두 오름세면 가장 강한 하나를 롱, 모두 꺾였으면 가장 약한 하나를 숏으로 잡습니다.',ex:'binance',fw:389,by:'haneul',uni:'coin8',inst:'futures',fut:1,kind:'agent',every:3,look:60,top:1,gate:0.88,lev:1,startI:101,ph:2},
  {id:'f5',kind:'mix',mkt:'crypto',name:'대표 코인 돌파 따라가기',one:'AI가 비트코인, 이더리움, 솔라나 중 방향과 종목을 고르고, 20일 돌파가 나오면 롱이나 숏으로 들어갑니다.',ex:'bitget',fw:342,by:'sorae',uni:'big3',inst:'futures',fut:1,kind:'mix',mode:'brk',every:3,look:45,gate:0.5,n:20,exitN:15,sl:10,lev:1,startI:101},
  {id:'f6',kind:'rule',mkt:'crypto',name:'에이다 평균선 양방향',one:'에이다 선물의 15일 평균이 50일 평균을 넘으면 롱, 밑돌면 숏으로 바꿔 탑니다.',ex:'bitget',fw:527,by:'mira_q',asset:'에이다',inst:'futures',fut:1,kind:'rule',mode:'ma',fast:15,slow:50,trail:20,lev:1,startI:101},
  {id:'f9',kind:'agent',mkt:'crypto',name:'코인 둘 롱숏 갈아타기',one:'AI가 3일마다 코인 8종을 비교해, 모두 오름세면 강한 둘을 롱, 모두 꺾였으면 약한 둘을 숏으로 잡습니다.',ex:'okx',fw:418,by:'pebble',uni:'coin8',inst:'futures',fut:1,kind:'agent',every:3,look:60,top:2,gate:0.88,lev:1,startI:101},
  {id:'f10',kind:'rule',mkt:'crypto',name:'비트코인 추세 양방향 2배',one:'비트코인 선물이 55일 최고가를 넘으면 롱, 최저가를 깨면 숏으로 2배 따라갑니다.',ex:'bitget',fw:377,by:'june07',asset:'비트코인',inst:'futures',fut:1,kind:'rule',mode:'brk',n:55,exitN:6,trail:15,reg:200,lev:2,startI:101},
  {id:'d1',kind:'agent',mkt:'crypto',name:'코인 셋 나눠 담기',one:'AI가 코인 8종을 5일마다 비교해, 많이 오른 최대 세 종목에 나눠 담습니다.',ex:'binance',fw:1284,by:'haneul',uni:'coin8',look:20,top:3,gate:0.4,every:5,trail:12,volT:0.03,minS:0.4,startI:400},
  {id:'r1',kind:'rule',mkt:'crypto',name:'비트코인 큰 하락 뒤',one:'비트코인이 크게 떨어진 뒤 다시 오르는 걸 확인하고 삽니다.',ex:'okx',fw:911,by:'dohyun_k',asset:'비트코인',rsiTh:26,tp:20,sl:-8,tf:0,startI:400},
  {id:'h1',kind:'mix',mkt:'stock',name:'기술주 회복 기다리기',one:'AI가 미국 기술주 중 하나를 골라, 떨어졌다가 다시 오를 때 삽니다.',ex:'bitget',fw:640,by:'june07',uni:'tech8',every:20,look:40,rsiTh:50,tp:10,sl:-5,gate:0.4,startI:300},
  {id:'r2',kind:'rule',mkt:'index',name:'나스닥 4% 챙기기',one:'나스닥이 떨어졌다 오를 때 사서, 산 가격보다 4% 넘게 오른 날 팝니다.',ex:'okx',fw:512,by:'mintleaf',asset:'나스닥',rsiTh:52,tp:4,sl:-3,tf:0,startI:200},
  {id:'d2',kind:'agent',mkt:'multi',name:'네 시장 둘 나눠 담기',one:'AI가 지수, 금, 주식, 코인 6종을 20일마다 비교해, 최대 두 종목에 나눠 담습니다.',ex:'bitget',fw:431,by:'moa_kim',uni:'macro6',look:60,top:2,gate:0.5,every:20,trail:10,volT:0.03,minS:0.4,startI:200},
  {id:'r3',kind:'rule',mkt:'crypto',name:'이더리움 빨리 접기',one:'이더리움이 3% 넘게 떨어지면 팔고, 15% 오르거나 25일 지나도 팝니다.',ex:'bitget',fw:377,by:'taeo',asset:'이더리움',rsiTh:52,tp:15,sl:-3,tf:1,startI:200},
  {id:'h2',kind:'mix',mkt:'crypto',name:'코인 시장 먼저 확인',one:'AI가 고른 코인이 떨어졌다 다시 오를 때 삽니다. 시장이 약하면 기다립니다.',ex:'binance',fw:822,by:'nari_lab',uni:'coin8',every:10,look:60,rsiTh:45,tp:15,sl:-8,gate:0.4,startI:400},
  {id:'d3',kind:'agent',mkt:'crypto',name:'코인 매일 비교하기',one:'AI가 코인 8종을 매일 비교해, 산 코인이 약해지면 팔고 강한 코인이 있으면 삽니다.',ex:'okx',fw:298,by:'kite',uni:'coin8',look:10,top:1,gate:0.5,every:1,trail:8,volT:0.02,minS:0.4,startI:600},
  {id:'r4',kind:'rule',mkt:'index',name:'금 뚜렷할 때만',one:'금이 크게 떨어졌다 다시 오를 때, 최근 흐름이 뚜렷한지도 확인하고 삽니다.',ex:'okx',fw:203,by:'lumen',asset:'금',rsiTh:30,tp:6,sl:-3,tf:1,startI:200},
  {id:'d4',kind:'agent',mkt:'stock',name:'기술주 셋 나눠 담기',one:'AI가 미국 기술주 8종을 5일마다 비교해, 최대 세 종목에 나눠 담습니다.',ex:'binance',fw:593,by:'bluefin',uni:'tech8',look:40,top:3,gate:0.4,every:5,trail:12,volT:0.02,minS:0.4,startI:300},
  {id:'h3',kind:'mix',mkt:'index',name:'지수와 금 짧게',one:'AI가 나스닥, S&P 500, 금 중 하나를 골라, 산 가격보다 5% 넘게 오른 날 팝니다.',ex:'binance',fw:705,by:'pebble',uni:'idx3',every:20,look:60,rsiTh:50,tp:5,sl:-3,gate:0.34,startI:61},
  {id:'r5',kind:'rule',mkt:'stock',name:'테슬라 큰 하락 뒤',one:'테슬라가 크게 떨어진 뒤 다시 오르면 사서, 18% 오르거나 25일 지나면 팝니다.',ex:'binance',fw:188,by:'sian_j',asset:'테슬라',rsiTh:30,tp:18,sl:-8,tf:0,startI:300},
  {id:'r6',kind:'rule',mkt:'crypto',name:'솔라나 짧게 자주',one:'솔라나가 다시 오를 때 사서, 5% 넘게 오르거나 3% 넘게 떨어진 날 팝니다.',ex:'bitget',fw:462,by:'quill',asset:'솔라나',rsiTh:52,tp:5,sl:-3,tf:0,startI:61},
  {id:'d5',kind:'agent',mkt:'stock',name:'기술주 함께 오를 때',one:'기술주 8종 중 여섯 이상이 두 달 평균 가격보다 높을 때만 AI가 새로 삽니다.',ex:'okx',fw:349,by:'sodam',uni:'tech8',look:20,top:2,gate:0.7,every:5,trail:10,volT:0.02,minS:0.4,startI:500},
  {id:'h4',kind:'mix',mkt:'multi',name:'네 시장 회복 기다리기',one:'AI가 지수, 금, 주식, 코인 중 하나를 골라, 떨어졌다가 다시 오를 때 삽니다.',ex:'okx',fw:318,by:'yuna.s',uni:'macro6',every:10,look:40,rsiTh:45,tp:8,sl:-5,gate:0.5,startI:200},
  {id:'r7',kind:'rule',mkt:'crypto',name:'리플 4% 챙기기',one:'리플이 다시 오를 때 사서, 4% 넘게 오르거나 5% 넘게 떨어진 날 팝니다.',ex:'bitget',fw:267,by:'eunsol',asset:'리플',rsiTh:46,tp:4,sl:-5,tf:0,startI:61},
  {id:'d6',kind:'agent',mkt:'crypto',name:'대표 코인 하나 담기',one:'AI가 비트코인, 이더리움, 솔라나를 10일마다 비교해 하나만 골라 담습니다.',ex:'bitget',fw:156,by:'orbit9',uni:'big3',look:40,top:1,gate:0.34,every:10,trail:15,volT:0.03,minS:0.4,startI:300},
  {id:'r8',kind:'rule',mkt:'stock',name:'엔비디아 8% 목표',one:'엔비디아가 떨어졌다 오를 때 사서, 산 가격보다 8% 넘게 오른 날 팝니다.',ex:'okx',fw:274,by:'bora_c',asset:'엔비디아',rsiTh:48,tp:8,sl:-5,tf:0,startI:400},
  {id:'h5',kind:'mix',mkt:'crypto',name:'강한 코인 회복 때',one:'AI가 대표 코인 셋 중 두 달간 많이 오른 하나를 골라, 떨어졌다 다시 오를 때 삽니다.',ex:'binance',fw:141,by:'harbor',uni:'big3',every:20,look:60,rsiTh:40,tp:12,sl:-5,gate:0,startI:600},
  {id:'r9',kind:'rule',mkt:'crypto',name:'비트코인 뚜렷할 때만',one:'비트코인이 떨어졌다 다시 오를 때, 최근 흐름이 뚜렷한지도 확인하고 삽니다.',ex:'binance',fw:233,by:'jisu.p',asset:'비트코인',rsiTh:40,tp:15,sl:-5,tf:1,startI:1100},
  {id:'h6',kind:'mix',mkt:'multi',name:'여섯 시장 골라 타기',one:'AI가 5일마다 지수, 금, 코인, 엔비디아 중 가장 강한 하나를 골라, 밀렸다가 반등하는 날 삽니다.',ex:'bitget',fw:486,by:'mira_q',uni:'macro6',every:5,look:40,rsiTh:45,tp:8,sl:-8,gate:0.5,startI:61}
];
var MK_KIND={agent:'AI 판단',rule:'차트 규칙',mix:'혼합 전략'};
var MK_TK={'비트코인':'BTC','이더리움':'ETH','솔라나':'SOL','리플':'XRP','도지코인':'DOGE','에이다':'ADA','아발란체':'AVAX','비앤비':'BNB','테슬라':'TSLA','엔비디아':'NVDA','애플':'AAPL','마이크로소프트':'MSFT','아마존':'AMZN','메타':'META','알파벳':'GOOGL','에이엠디':'AMD'};
function mkTk(k){ return MK_TK[k]||k; }
var MK_ALIAS={'비트코인 바겐세일':'r1','김대리의 나스닥':'r2','손절은 칼같이':'r3','골드핑거':'r4','테슬라 역발상가':'r5','짧게 먹고 내린다':'r6','리플 잔돈 수집가':'r7','끝까지는 안 가':'r8','비트코인은 기다림':'r9',
  '한계선':'r3','거름':'h2','돌림':'d4','이음':'h3','깊은 숨':'r5','한구간':'r6','길잡이':'h4','분업':'h5','길목':'r9',
  /* 2026-09-29 카드 1차 구현의 이름 */
  '네 시장에서 둘':'d2','코인 매일 갈아타기':'d3','대표 코인 하나만':'d6','네 시장에서 하나':'h4','많이 오른 코인 하나':'h5','금 방향부터 확인':'r4','테슬라 오래 기다리기':'r5','리플 작게 여러 번':'r7','비트코인 방향 확인':'r9',
  /* 2026-09-29 이름 개편 전 이름 */
  '세 갈래':'d1','건널목':'d2','환승':'d3','기술주 셋':'d4','동행':'d5','외길':'d6','맞물림':'h1','추림':'h2','지수와 금':'h3','갈림길':'h4','고른 뒤':'h5','되짚기':'r1','짧은 호흡':'r2','물러섬':'r3','두 문턱':'r4','깊은 되돌림':'r5','한 구간':'r6','작은 걸음':'r7','마침표':'r8','방향선':'r9'};
var MK_ASOF=window.TETH_PX?TETH_PX.asof.split('-').map(Number):[2026,9,28], MK_DATA_V=window.TETH_PX?TETH_PX.v:'2026-09-28.1', MK_D0=null, MK_D0K='';
function idxToDate(i){ var dk=MK_ASOF.join('-')+'|'+PRICE0.length+'|'+MK_DATA_V; if(!MK_D0||MK_D0K!==dk){ MK_D0K=dk; MK_D0=new Date(MK_ASOF[0],MK_ASOF[1]-1,MK_ASOF[2]); MK_D0.setDate(MK_D0.getDate()-(PRICE0.length-1)); } var t=new Date(MK_D0.getTime()); t.setDate(t.getDate()+i); return t; }
function mkMD(i){ var d=idxToDate(i); return (d.getMonth()+1)+'월 '+d.getDate()+'일'; }
function mkUni(s){ return MK_UNI[s.uni]||{label:s.asset||'',list:s.asset?[s.asset]:[]}; }
function mkScope(s){ return s.kind==='rule'||!s.uni?s.asset:mkUni(s).label; }
function mkJ(w,a,b){ var c=String(w).charCodeAt(String(w).length-1); if(c<0xAC00||c>0xD7A3) return w+a; return w+(((c-0xAC00)%28)?a:b); }
function mkPct0(v,d){ var n=d!=null?d:1, x=+v.toFixed(n); return (x>0?'+':'')+x.toFixed(n)+'%'; }
function mkSign(v){ var x=+v.toFixed(1); return x>0?' mk-up':x<0?' mk-dn':''; }
function mkRunCfg(c,startI){
  var st=startI!=null?startI:c.startI;
  if(c.fut){ var f={}; for(var k in c) f[k]=c[k]; if(c.uni) f.uni=MK_UNI[c.uni].list; f.startI=st; return mkFutRun(f); }
  if(c.kind==='agent') return mkAgentRun({uni:MK_UNI[c.uni].list,look:c.look,top:c.top,gate:c.gate,every:c.every,trail:c.trail,volT:c.volT,minS:c.minS,startI:st});
  if(c.kind==='mix') return mkHybridRun({uni:MK_UNI[c.uni].list,every:c.every,look:c.look,rsiTh:c.rsiTh,tp:c.tp,sl:c.sl,gate:c.gate,startI:st});
  return mkRuleRun({asset:c.asset,rsiTh:c.rsiTh,tp:c.tp,sl:c.sl,tf:!!c.tf,fng:c.fng,startI:st});
}
function mkDate(i){ var d=idxToDate(i); return d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0'); }
function mkdTicks(a,b,n){ if(!(b-a>1e-9*Math.max(1,Math.abs(a)))){ var pd=Math.abs(a)>=100?Math.max(10,Math.round(Math.abs(a)*0.01)):1; return [a-pd,a,a+pd]; } /* 최저와 최고가 같으면 위아래로 여유를 둔다 */ var span=(b-a)||1, st=Math.pow(10,Math.floor(Math.log10(span/n))), e=span/n/st; st*=e<1.5?1:e<3?2:e<7?5:10; var lo=Math.floor(a/st)*st, hi=Math.ceil(b/st)*st, t=[]; for(var v=lo;v<=hi+st/2;v+=st) t.push(+v.toFixed(6)); return t; }
function mkAssetKo(a){ return a||'자산'; }
function mkHook(s){
  if(s.name) return s.name;
  if(!s.p) return s.title||s.nick;
  var p=s.p, a=mkAssetKo(s.asset), tp=Math.abs(p.tp), sl=Math.abs(p.sl);
  var h=0, k=String(s.nick||''); for(var i=0;i<k.length;i++) h=(h*31+k.charCodeAt(i))>>>0;
  var pick=function(arr,salt){ return arr[(h+salt)%arr.length]; };
  var inn=p.rsiTh<=38?pick(['급락하면 줍고','무너질 때 담고','투매 나오면 받고'],0):p.rsiTh<=42?pick(['깊게 빠지면 사서','크게 밀리면 담아서','겁날 때 사서'],1):pick(['눌릴 때 사서','살짝 빠지면 담아서','쉬어갈 때 사서'],2);
  var out=sl>=8?pick(['흔들려도 '+tp+'%까지 버틴다','출렁여도 '+tp+'%까지 든다'],3):sl<=3?pick(['짧게 끊고 '+tp+'% 챙긴다','칼같이 끊고 '+tp+'% 노린다'],4):tp<=8?pick([tp+'% 먹고 나온다',tp+'%만 챙기고 빠진다'],5):tp<=12?pick([tp+'%까지 들고 간다',tp+'% 찍으면 판다'],6):pick([tp+'% 크게 노린다',tp+'%까지 길게 본다'],7);
  return a+' '+inn+' '+out+(p.trendFilter?'':', 추세 안 가림');
}
function mkOne(s){
  if(s.one) return s.one;
  if(!s.p) return (s.desc||'').split(/[.\n]/)[0];
  var d=s.p.rsiTh<=38?'급락 뒤':s.p.rsiTh<=42?'깊게 빠진 뒤':'살짝 눌린 뒤';
  return d+' 반등에 사서 +'+Math.abs(s.p.tp)+'% 익절, -'+Math.abs(s.p.sl)+'% 손절';
}
var MK_CRYPTO={'비트코인':1,'이더리움':1,'솔라나':1,'리플':1,'도지코인':1,'에이다':1,'아발란체':1,'비앤비':1};
function mkInst(a){ return MK_CRYPTO[a]?'현물':(a==='나스닥'||a==='S&P 500')?'토큰화 지수':a==='금'?'토큰화 금':'토큰화 주식'; }
function mkInstList(s){ if(fuIs(s)) return fuInst(s); var l=s.cfg&&s.cfg.uni?mkUni(s).list:[s.asset], o=[]; l.forEach(function(a){ var k=mkInst(a); if(o.indexOf(k)<0) o.push(k); }); return o; }
var MK_WHY={trail:'든 뒤 고점에서 많이 밀렸습니다',weak:'오르던 힘이 꺾였습니다',rot:'순위에서 많이 밀렸습니다',sl:'손절 기준까지 밀렸습니다',tp:'목표까지 올랐습니다',time:'25일을 채웠습니다'};
var MK_WHY_P={trail:'진입 후 고점 대비 하락 폭이 추적 손절 기준에 닿았다',weak:'모멘텀이 꺾였다',rot:'상위 종목에 순위가 밀렸다',sl:'손절 기준에 도달했다',tp:'익절 목표에 도달했다',time:'보유 25일이 지나 기간 만료로 청산했다'};
var MK_GLOSS={
 '되돌림 점수':'가격이 최근 얼마나 많이 내려왔는지를 0부터 100까지로 나타낸 값. 클수록 많이 내려온 상태다. 전략마다 정한 기준을 넘어야 매수를 검토한다.',
 '추적 손절':'가격이 오르면 파는 기준도 따라 올리는 방식. 가장 높았던 가격에서 정해 둔 폭만큼 내려오면 판다.',
 '이동평균':'최근 며칠 동안의 가격 평균. 60일 이동평균은 최근 60일 가격의 평균이다. 가격이 이 선 위에 있으면 오르는 흐름으로 본다.',
 '상승 추세':'가격이 꾸준히 오르는 흐름. 여기서는 가격이 60일 이동평균 위에 있는 상태를 말한다.',
 '실현 손익':'사고판 뒤 확정된 이익이나 손실. 아직 들고 있는 종목의 평가 손익과 구분한다.',
 '분산 보유':'한 종목에 몰지 않고 여러 종목에 나눠 드는 것.',
 '가용 자금':'지금 바로 주문에 쓸 수 있는 돈.',
 '기간 만료':'정해 둔 최대 보유 기간이 끝난 것. 이 전략은 25일이 지나면 결과와 관계없이 판다.',
 '체결가':'주문이 실제로 이루어진 가격.',
 '되돌림':'오르던 가격이 잠시 내려오는 움직임.',
 '모멘텀':'가격이 움직이는 힘. 최근에 많이 오른 종목일수록 모멘텀이 강하다고 한다.',
 '변동성':'가격이 오르내리는 폭. 변동성이 크면 하루 사이에도 가격이 크게 바뀐다.',
 '재평가':'보유 종목과 후보 종목을 정해진 날에 다시 비교하는 일.',
 '익절':'이익이 난 상태에서 팔아 이익을 확정하는 것.',
 '손절':'손실이 더 커지기 전에 팔아 손실을 확정하는 것.',
 '비중':'전체 자산 중 한 종목에 넣은 돈의 비율.',
 '관망':'사거나 팔지 않고 지켜보는 것.',
 '청산':'들고 있던 종목이나 포지션을 정리해 거래를 끝내는 것.',
 '진입':'새로 사거나 포지션을 여는 것.',
 '반등':'내리던 가격이 다시 오르는 움직임.',
 '종가':'하루 거래가 끝났을 때의 가격.',
 '고점':'일정 기간 중 가장 높았던 가격.',
 '토큰화 주식':'주식의 가격을 그대로 따라가도록 만든 디지털 자산. 가상자산 거래소에서 USDT로 사고판다.',
 '토큰화 지수':'나스닥 같은 지수의 가격을 그대로 따라가도록 만든 디지털 자산. 가상자산 거래소에서 USDT로 사고판다.',
 '토큰화 금':'금의 가격을 그대로 따라가도록 만든 디지털 자산. 가상자산 거래소에서 USDT로 사고판다.',
 '현물':'코인을 실제로 사서 보유하는 거래. 가격이 오르면 이익이 난다.',
 '선물':'실물을 사지 않고 가격의 방향에 거는 거래. 오르는 쪽(롱)과 내리는 쪽(숏) 모두 가능하다.',
 '매수':'사는 주문.',
 '매도':'파는 주문.',
 '롱':'가격이 오르면 이익이 나는 방향.',
 '숏':'가격이 내리면 이익이 나는 방향.'
};
var MK_GLOSS_K=Object.keys(MK_GLOSS).sort(function(a,b){ return b.length-a.length; }), MK_CHAT_N=0;
function mkPolite(x){
  return String(x||'').replace(/(.)(.)다\.(?=\s|$)/g,function(m,a,b){
    var cb=b.charCodeAt(0), han=cb>=0xAC00&&cb<=0xD7A3, j=han?(cb-0xAC00)%28:-1;
    if(b==='이') return a+'입니다.';
    if(b==='하') return a+'합니다.';
    if(b==='는') return a+'습니다.';
    if(j===20||j===18) return a+b+'습니다.';
    if(j===4) return a+String.fromCharCode(cb-4+17)+'니다.';
    return a+b+'입니다.';
  });
}
var TF_STOP=[-3,-5,-8,-12];
var TF_BUDGET=[1000000,5000000,10000000,30000000];
var BT_SYS_J='너는 TETH의 트레이딩 판단을 기록하는 분석가다. 입력은 과거 어느 날 장 마감 시점에 알 수 있었던 값뿐이다. 그날 이후의 가격과 결과는 모른다고 가정한다. 결정은 전략이 이미 내렸다. 그 결정을 내린 이유를 그날의 수치를 근거로 한국어 2문장 또는 3문장으로 쓴다. 문체는 합니다체(입니다, 합니다, 했습니다)로 통일한다. 입력에 있는 수치만 쓴다. 없는 수치, 뉴스, 사건은 지어내지 않는다. 가장 두드러진 사실부터 말하고, 매번 같은 틀로 시작하지 않는다. 마지막 문장은 그래서 무엇을 했는지로 끝낸다. 목록, 제목, 따옴표, 괄호 설명, 이모지, 긴 줄표, 가운뎃점은 쓰지 않는다. 전체 160자 안팎. 입력의 항목 이름을 그대로 옮기지 말고 사람이 말하듯 풀어 쓴다(예: 60일 평균 가격보다 11.4% 위). 날짜를 가리킬 때는 어제나 오늘이 아니라 이날이라고 쓴다. 종목 이름은 입력에 있는 그대로 쓴다.';
var BT_SYS_R='너는 TETH의 백테스트 결과를 읽어 주는 분석가다. 입력은 실제로 계산된 결과 숫자다. 검색이나 도구는 쓰지 않는다. 입력에 없는 숫자는 쓰지 않는다. 한국어 합니다체로 정확히 3문장을 쓰고, 문장마다 줄을 바꾼다. 첫 문장은 현물로 그냥 들고 있었을 때와 비교한 결론(남긴 금액의 차이와 흔들림의 차이). 둘째 문장은 전략이 실제로 어떻게 움직였는지(기회, 진입, 보류, 보유한 기간의 비율 중 의미 있는 것). 셋째 문장은 이 결과를 믿을 때 가장 조심할 점 한 가지(거래 수, 특정 거래 의존, 가장 나빴던 구간, 레버리지 중 실제 숫자가 뒷받침하는 것). 문장 하나는 70자를 넘기지 않는다. 숫자는 문장마다 두 개까지만 쓴다. 금액은 입력의 표기(쉼표 포함)를 그대로 쓴다. 과장하지 않는다. 권유하지 않는다. 목록, 제목, 따옴표, 이모지, 긴 줄표, 가운뎃점은 쓰지 않는다.';
export { mulberry32, PRICE, PRICE0, mkPx, mkWithPx, mkPxFmt, sma, rsi, RUNSTATS, runBacktest, runBacktestCore, MK_FEE, mkVol, mkLedger, mkCheckIn, mkStatsOf, mkAgentRun, mkRuleRun, mkOpen, mkFng, mkHybridRun, MK_FUT_FEE, fuD, fuSma, fuMax, fuMin, fuVol, fuFng, fuLedger, mkFutRun, fuIs, fuSd, FU_WHY, FU_WHY_P, fuSig, fuOuts, fuNeed, fuAiTxt, fuInst, MK_PX_CFG, MK_UNI, MK_CAT, MK_KIND, MK_TK, mkTk, MK_ALIAS, MK_ASOF, idxToDate, mkMD, mkUni, mkScope, mkJ, mkPct0, mkSign, mkRunCfg, mkDate, mkdTicks, mkAssetKo, mkHook, mkOne, MK_CRYPTO, mkInst, mkInstList, MK_WHY, MK_WHY_P, MK_GLOSS, MK_GLOSS_K, mkPolite, TF_STOP, TF_BUDGET, BT_SYS_J, BT_SYS_R, MK_DATA_V };
