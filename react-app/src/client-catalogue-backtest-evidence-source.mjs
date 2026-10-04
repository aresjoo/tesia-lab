/** Extracted presentation only. Fixed client source 9fbff821df62cad11d026022fc7628c7fcebc431 presentation projection.
 * Exact original functions/constants; NO trading engine, DOM, network or model call.
 * Caller must validate the observation and matching source data before invoking.
 * Original fallback text only, not generated AI analysis. */
export function projectSourceBacktestDecisions(value, {spot, future, universes}) {
  if(typeof value.runId!=='string'||!value.runId) throw Error('Run binding required');
  const TETH_PX=spot,TETH_FUT=future,PRICE0=spot.px['비트코인'],MK_UNI=universes;
  const window={TETH_PX,TETH_FUT};
  const mkPx=k=>spot.px[k];
  const BT={s:{...value.strategy,cfg:value.strategy},per:value.period,amt:value.amount};
  function mkRunCfg(c,start){
    const expected=value.period?Math.max(value.strategy.startI,PRICE0.length-1-value.period):value.strategy.startI;
    if(c!==value.strategy||start!==expected) throw Error('Source calculation mismatch');
    return value.result;
  }
var FU_WHY={sl:'진입가에서 손절 기준만큼 불리하게 움직였습니다',trail:'가장 유리했던 가격에서 기준만큼 되돌렸습니다',tp:'목표까지 움직였습니다',time:'보유 기한을 채웠습니다',chan:'추세가 꺾였습니다',flip:'반대 방향 신호가 나왔습니다',liq:'증거금이 바닥나 강제 청산됐습니다',rot:'순위에서 밀렸습니다',rest:'시장 방향이 애매해 쉬기로 했습니다'};
var MK_TK={'비트코인':'BTC','이더리움':'ETH','솔라나':'SOL','리플':'XRP','도지코인':'DOGE','에이다':'ADA','아발란체':'AVAX','비앤비':'BNB','테슬라':'TSLA','엔비디아':'NVDA','애플':'AAPL','마이크로소프트':'MSFT','아마존':'AMZN','메타':'META','알파벳':'GOOGL','에이엠디':'AMD'};
var MK_ASOF=window.TETH_PX?TETH_PX.asof.split('-').map(Number):[2026,9,28];
var MK_DATA_V=window.TETH_PX?TETH_PX.v:'2026-09-28.1';
var MK_D0=null;
var MK_D0K='';
var MK_WHY={trail:'든 뒤 고점에서 많이 밀렸습니다',weak:'오르던 힘이 꺾였습니다',rot:'순위에서 많이 밀렸습니다',sl:'손절 기준까지 밀렸습니다',tp:'목표까지 올랐습니다',time:'25일을 채웠습니다'};
var MK_WHY_P={trail:'진입 후 고점 대비 하락 폭이 추적 손절 기준에 닿았다',weak:'모멘텀이 꺾였다',rot:'상위 종목에 순위가 밀렸다',sl:'손절 기준에 도달했다',tp:'익절 목표에 도달했다',time:'보유 25일이 지나 기간 만료로 청산했다'};
function mkPxFmt(v){ if(v==null||!isFinite(v)) return '-'; var a=Math.abs(v); return a>=1000?Math.round(v).toLocaleString():a>=100?v.toFixed(1):a>=1?v.toFixed(2):v.toFixed(4); }
function mkDate(i){ var d=idxToDate(i); return d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0'); }
function fuSd(v){ return v>0?'롱':'숏'; }
function fuNeed(c,n){ return {L:Math.ceil(c.gate*n-1e-9),S:Math.floor((1-c.gate)*n+1e-9)}; }
function mkTk(k){ return MK_TK[k]||k; }
function idxToDate(i){ var dk=MK_ASOF.join('-')+'|'+PRICE0.length+'|'+MK_DATA_V; if(!MK_D0||MK_D0K!==dk){ MK_D0K=dk; MK_D0=new Date(MK_ASOF[0],MK_ASOF[1]-1,MK_ASOF[2]); MK_D0.setDate(MK_D0.getDate()-(PRICE0.length-1)); } var t=new Date(MK_D0.getTime()); t.setDate(t.getDate()+i); return t; }
function mkUni(s){ return MK_UNI[s.uni]||{label:s.asset||'',list:s.asset?[s.asset]:[]}; }
function mkPct0(v,d){ var n=d!=null?d:1, x=+v.toFixed(n); return (x>0?'+':'')+x.toFixed(n)+'%'; }
function btPx(v){ return '$'+mkPxFmt(v); }
function btYMD(i){ return mkDate(i); }
function btGate(s){ var c=s.cfg||{}; return s.kind==='mix'&&c.gate>0; }
function btAi(s){ return btGate(s)||s.kind==='agent'; }
function btNeed(s){ var c=s.cfg||{}, n=mkUni(s).list.length; return Math.ceil((c.gate||0)*n); }
function btUps(list,px,i){ var o=[]; list.forEach(function(k,q){ var P=px[q]; if(i<60) return; var a=0; for(var z=i-59;z<=i;z++) a+=P[z]; if(P[i]>a/60) o.push(k); }); return o; }
function btCompute(){
  var s=BT.s, c=s.cfg, T=PRICE0.length-1, min=c.startI!=null?c.startI:61, st=BT.per?Math.max(min,T-BT.per):min;
  var r=mkRunCfg(c,st), eq=r.eq, i0=eq[0].i, N=eq.length, list=mkUni(s).list, px=list.map(function(k){ return mkPx(k); });
  var bench=eq.map(function(p){ var a=0; px.forEach(function(P){ a+=P[p.i]/P[i0]; }); return a/px.length; });
  var bpk=0, bmd=0; bench.forEach(function(v){ if(v>bpk) bpk=v; var d=v/bpk-1; if(d<bmd) bmd=d; });
  var mon=[], cur=null;
  eq.forEach(function(p,j){ var d=idxToDate(p.i), k=d.getFullYear()*12+d.getMonth(); if(!cur||cur.k!==k){ if(cur) mon.push(cur); cur={k:k,y:d.getFullYear(),m:d.getMonth()+1,base:j?eq[j-1].v:1,last:p.v,d0:d.getDate(),d1:d.getDate(),dim:new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}; } cur.last=p.v; cur.d1=d.getDate(); });
  if(cur) mon.push(cur); mon.forEach(function(m){ m.ret=(m.last/m.base-1)*100; m.part=m.d0>1||m.d1<m.dim; });
  /* 그날까지의 가장 나빴던 구간(재생하는 동안 자라난다) */
  var dd=[], pk=eq[0].v, pkJ=0, best={v:0,a:0,b:0};
  eq.forEach(function(p,j){ if(p.v>=pk){ pk=p.v; pkJ=j; } var d=p.v/pk-1; if(d<best.v) best={v:d,a:pkJ,b:j}; dd.push(best); });
  var ev=(r.events||[]), cnt={enter:0,exit:0,veto:0,skip:0,pick:0,hold:0,unpick:0}; ev.forEach(function(e){ if(cnt[e.t]!=null) cnt[e.t]++; });
  var look=c.look, D=[], gate=btGate(s), need=btNeed(s), n8=list.length, agent=s.kind==='agent', lastPick={};
  var upsOf=function(e){ var u=btUps(list,px,e.i); return u.length===e.up?u:null; };
  var brd=function(e){ return ['오름세 '+e.up+' / '+e.of+'개','기준 '+need+'개 이상']; };
  var md=function(i){ var d=idxToDate(i); return String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0'); };
  var momAt=function(k,i){ var P=px[list.indexOf(k)]; return P&&i-look>=0?(P[i]/P[i-look]-1)*100:0; };
  var pkTxt=function(p){ return 'AI가 '+md(p.i)+'에 고른 종목, 그날 '+look+'일 상승률 '+mkPct0(p.mom,1); };
  var pkFacts=function(p,e){ return [['AI가 고른 날',btYMD(p.i)+', 오름세 종목 중 '+look+'일 상승률 1위 '+mkPct0(p.mom,1)],['이날의 '+look+'일 상승률',mkPct0(momAt(e.a,e.i),1)]]; };
  var top1=function(e){ var t=(e.top||[])[0]; return t?('점수 1위 '+mkTk(t.k)+', '+look+'일 '+mkPct0(t.mom,1)):''; };
  var push=function(d,e){ d.e=e; d.i=e.i; d.j=Math.max(0,Math.min(N-1,e.i-i0)); d.a=e.a; d.tk=e.a?mkTk(e.a):''; d.tid=e.tid; d.ix=D.length; D.push(d); return d; };
  ev.forEach(function(e){
    var tk=e.a?mkTk(e.a):'';
    if(c.fut){ var fd=fuBtDec(s,e,{n8:n8,upsOf:upsOf}); if(fd) push(fd,e); return; }
    if(e.t==='pick'){ lastPick[e.a]=e; push({k:'pick',tag:'선정',title:tk,cmp:'오름세 종목 중 '+look+'일 상승률 1위 '+mkPct0(e.mom,1),why:'오름세 종목 중 최근 '+look+'일 상승률이 '+mkPct0(e.mom,1)+'로 가장 높았습니다',facts:(e.top||[]).slice(0,3).map(function(x,q){ return [(q+1)+'위',mkTk(x.k)+' '+mkPct0(x.mom,0)]; })},e); return; }
    if(e.t==='enter'){
      if(agent){ push({k:'buy',tag:'매수',title:tk,cmp:'흔들림까지 본 순위 '+(e.rank||1)+'위, '+look+'일 '+mkPct0(e.mom,1),why:'가격 흔들림까지 고려한 순위에서 '+(e.rank||1)+'번째였습니다. 최근 '+look+'일 상승률은 '+mkPct0(e.mom,1)+'입니다',
          p0:[n8+'종목 비교',top1(e)],p1:brd(e),p2:[tk+' 매수','새로 담았습니다'],ups:e.of?upsOf(e):null,
          facts:[['산 가격',btPx(e.px)],['비중',Math.round((e.w||0)*100)+'%'],['순위',(e.rank||1)+'위, 상승률을 가격 흔들림으로 나눈 점수 기준'],['최근 '+look+'일 상승률',mkPct0(e.mom,1)],['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']]},e); return; }
      var pk2=lastPick[e.a], pkT=pk2?pkTxt(pk2):'떨어진 뒤 다시 올랐습니다';
      push({k:'buy',tag:'매수',title:tk,chain:gate?1:0,cmp:gate?('오름세 '+e.up+' / '+e.of+', 기준 '+need):('하루 반등 '+mkPct0(e.bounce,1)),
        why:gate?('오름세 종목이 '+e.of+'개 중 '+e.up+'개라 샀습니다'):('떨어진 뒤 하루 만에 '+mkPct0(e.bounce,1)+' 다시 올랐습니다'),
        p0:[tk+' 하루 반등 '+mkPct0(e.bounce,1),pkT],p1:gate&&e.of?brd(e):null,p2:[tk+' 매수',gate?'기준을 넘어 샀습니다':'조건이 맞아 샀습니다'],ups:gate&&e.of?upsOf(e):null,
        facts:(pk2?pkFacts(pk2,e):[]).concat([['하루 반등',mkPct0(e.bounce,1)+', 기준 0.5% 넘게'],['되돌림 점수',Math.round(e.rsi)+', 기준 '+c.rsiTh+' 아래']]).concat(gate&&e.of?[['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']]:[]).concat(c.fng!=null&&e.fng!=null?[['공포 탐욕 지수',e.fng+', 기준 '+c.fng+' 이하']]:[]).concat([['산 가격',btPx(e.px)]])},e); return; }
    if(e.t==='exit'){ push({k:'sell',tag:'매도',title:tk,pnl:e.pnl,cmp:MK_WHY[e.why]||'',why:MK_WHY[e.why]||'',facts:[['판 가격',btPx(e.px)],['이 거래의 손익',mkPct0(e.pnl,1)],['판 이유',MK_WHY[e.why]||'']]},e); return; }
    if(e.t==='veto'){ var pk3=lastPick[e.a];
      push({k:'skip',tag:'보류',title:tk,chain:1,cmp:'오름세 '+e.up+' / '+e.of+', 기준 '+need,why:'오름세 종목이 '+e.of+'개 중 '+e.up+'개뿐이라 사지 않았습니다',
        p0:[tk+' 하루 반등 '+mkPct0(e.bounce,1),pk3?pkTxt(pk3):'떨어진 뒤 다시 올랐습니다'],p1:brd(e),p2:['보류','기준에 못 미쳐 사지 않았습니다'],ups:upsOf(e),
        facts:(pk3?pkFacts(pk3,e):[]).concat([['하루 반등',mkPct0(e.bounce,1)+', 기준 0.5% 넘게'],['되돌림 점수',Math.round(e.rsi)+', 기준 '+c.rsiTh+' 아래'],['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']])},e); return; }
    if(e.t==='skip'){ var weak=e.why==='gate';
      push({k:'skip',tag:'쉬어 감',title:'새로 사지 않음',cmp:weak?('오름세 '+e.up+' / '+e.of+', 기준 '+need):'살 만한 종목 없음',why:weak?('오름세 종목이 '+e.of+'개 중 '+e.up+'개뿐이라 시장이 약하다고 봤습니다'):'오름세이면서 충분히 강한 종목이 없었습니다',
        p0:[n8+'종목 비교',top1(e)],p1:weak?brd(e):['살 만한 종목 0개','오름세이고 충분히 강해야 합니다'],p2:['새로 사지 않음',weak?'시장이 약해 쉬었습니다':'살 종목이 없어 쉬었습니다'],ups:upsOf(e),
        facts:[['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상'],['쉬어 간 이유',weak?'오름세 종목이 기준보다 적었습니다':'오름세이면서 충분히 강한 종목이 없었습니다']].concat(e.held&&e.held.length?[['들고 있던 종목',e.held.map(mkTk).join(', ')]]:[])},e); return; }
    if(e.t==='hold'){ push({k:'hold',tag:'유지',title:'그대로 유지',cmp:(e.held||[]).map(mkTk).join(', ')+' 보유',why:'이미 '+(e.held||[]).length+'종목을 들고 있어 그대로 뒀습니다',
        p0:[n8+'종목 비교',top1(e)],p1:['빈자리 0개','이미 '+(e.held||[]).length+'종목 보유 중'],p2:['그대로 유지','보유 종목을 그대로 유지했습니다'],ups:upsOf(e),
        facts:[['들고 있던 종목',(e.held||[]).map(mkTk).join(', ')],['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']]},e); }
  });
  /* AI 판단 전략: 재평가 한 번이 한 줄. 그날 산 종목, 유지, 쉬어 감을 결과로 적는다 */
  var EV=[]; if(agent){ var byD={}; D.forEach(function(d){ if(d.k!=='buy'&&d.k!=='skip'&&d.k!=='hold') return; if(!byD[d.j]){ byD[d.j]={j:d.j,i:d.i,ds:[]}; EV.push(byD[d.j]); } byD[d.j].ds.push(d); });
    EV.forEach(function(E,q){ var b=E.ds.filter(function(d){ return d.k==='buy'; }), f=E.ds[0]; E.ix=q; E.out=b.length?'buy':f.k; E.tag=b.length?'매수':f.tag; E.title=b.length?b.map(function(d){ return d.tk; }).join(', '):f.title; E.cmp=b.length===1?b[0].cmp:b.length?b.map(function(d){ return d.tk+' '+d.cmp; }).join(' / '):f.cmp; E.why=f.why; E.ups=f.ups; E.k=b.length?'buy':f.k; }); }
  var op=r.state&&r.state.open?(r.state.open.length!=null?r.state.open:[r.state.open]):[];
  var tr=(r.trades||[]).map(function(t){ return {id:t.id,a:t.asset,e:t.entry,x:t.exit,ep:t.ep,xp:t.xp,pnl:t.pnl*100,why:t.kind,cost:t.cost,got:t.got,fee:t.fee,days:t.exit-t.entry,side:t.side,lev:t.lev,fund:t.fund}; });
  op.forEach(function(o){ tr.push({id:o.tid,a:o.k,e:o.entry,x:null,ep:o.ep,xp:o.px,pnl:o.pnl!=null?o.pnl:o.chg,why:null,cost:o.cost,got:null,fee:null,days:T-o.entry,open:1,side:o.side,lev:o.lev}); });
  tr.sort(function(a,b){ return b.e-a.e; });
  var wins=tr.filter(function(t){ return !t.open&&t.pnl>0; }), loss=tr.filter(function(t){ return !t.open&&t.pnl<=0; });
  var avg=function(a){ return a.length?a.reduce(function(x,t){ return x+t.pnl; },0)/a.length:0; };
  var rec=null, a0=Math.max(0,r.mddStartI-i0); for(var q=Math.max(0,r.mddEndI-i0);q<N;q++){ if(eq[q].v>=eq[a0].v){ rec=eq[q].i; break; } }
  var nK=function(k){ return D.filter(function(d){ return d.k===k; }).length; };
  BT.R={r:r,eq:eq,i0:i0,N:N,T:T,bench:bench,benchMdd:bmd*100,mon:mon,dd:dd,cnt:cnt,D:D,EV:EV,tr:tr,wins:wins,loss:loss,avgW:avg(wins),avgL:avg(loss),rec:rec,list:list,px:px,
    nBuy:nK('buy'),nSkip:nK('skip'),nHold:nK('hold'),nOpp:agent?EV.length:nK('buy')+nK('skip'),ret:r.ret,mdd:r.mdd,n:r.n,win:r.winRate,benchRet:(bench[N-1]-1)*100,final:BT.amt*eq[N-1].v,benchFinal:BT.amt*bench[N-1]};
  btPlan();
  return BT.R;
}
function btPlan(){
  var R=BT.R, s=BT.s, stops=[], by={};
  R.D.forEach(function(d){ if(d.k!=='buy'&&d.k!=='skip'&&d.k!=='hold') return; if(!by[d.j]){ by[d.j]={j:d.j,ds:[]}; stops.push(by[d.j]); } by[d.j].ds.push(d); });
  stops.sort(function(a,b){ return a.j-b.j; });
  var ai=btAi(s), seenBuy=0, seenSkip=0, nBrief=0, gap=Math.max(2,Math.round(R.N/110)), imp={};
  if(ai){ var cl=R.tr.filter(function(t){ return !t.open; }).slice().sort(function(a,b){ return a.pnl-b.pnl; }); if(cl.length>=4) [cl[0],cl[cl.length-1]].forEach(function(t){ R.D.forEach(function(d){ if(d.k==='buy'&&d.tid===t.id) imp[d.j]=1; }); }); }
  stops.forEach(function(st,ix){ var hasBuy=st.ds.some(function(d){ return d.k==='buy'; }), hold=!hasBuy&&st.ds[0].k==='hold', sk=!hasBuy&&!hold, prev=stops[ix-1]; st.sk=sk; st.hold=hold; st.kind=hasBuy?'buy':hold?'hold':'skip';
    if(hold){ st.dw=0; return; }
    if((sk?!seenSkip:!seenBuy)||imp[st.j]){ st.full=1; st.t=ai?[900,1000,1300]:[900,0,1200]; st.dw=st.t[0]+st.t[1]+st.t[2]; if(sk) seenSkip=1; else seenBuy=1; }
    else if(prev&&prev.dw>0&&!prev.full&&st.j-prev.j<=gap&&prev.sk===sk){ st.dw=0; }
    else if(nBrief<7){ st.dw=ai?420:320; nBrief++; }
    else st.dw=0; });
  var bar=Math.max(4.5,Math.min(14,5200/R.N)), seg=[], t=0, pj=-1; /* 지나가는 날의 속도: 그래프가 자라는 것이 보일 만큼 */
  /* 기회가 있는 날에는 멈춤 구간만 들어간다. 지나가는 구간은 그 전날까지 */
  stops.forEach(function(st){ var to=st.dw>0?st.j-1:st.j; if(to>pj){ var dt=(to-pj)*bar; seg.push({k:'go',a:pj,b:to,t0:t,t1:t+dt}); t+=dt; pj=to; } if(st.dw>0){ seg.push({k:'stop',j:st.j,st:st,t0:t,t1:t+st.dw}); t+=st.dw; pj=st.j; } });
  if(pj<R.N-1){ var d2=(R.N-1-pj)*bar; seg.push({k:'go',a:pj,b:R.N-1,t0:t,t1:t+d2}); t+=d2; }
  R.seg=seg; R.runMs=t; R.prepMs=700; R.wrapMs=900; R.stops=stops;
}
function btPlain(){
  var R=BT.R, s=BT.s, c=s.cfg||{}, fut=!!c.fut, n=R.list.length, T=R.T, series=function(k){ return fut&&window.TETH_FUT&&TETH_FUT.sym[k]?TETH_FUT.sym[k].c:mkPx(k); };
  var trOf=function(id){ var t=null; R.tr.forEach(function(x){ if(x.id===id) t=x; }); return t; };
  R.D.forEach(function(d){ var e=d.e||{}, tk=d.tk, sd=d.side?(d.side>0?'롱':'숏'):'';
    d.act=d.k==='buy'?(tk+' '+(fut?sd+' 진입':'매수')):d.k==='sell'?(tk+' '+(fut?sd+' 청산':'매도')):d.k==='pick'?(tk+(fut?' '+sd+' 후보':' 선정')):d.k==='hold'?'보유 유지':(tk?tk+' 보류':'쉬어 감');
    if(fut){ d.say=String(d.why||'').replace(/어요\.?$/,'습니다'); }
    else if(d.k==='buy'){ d.say=s.kind==='agent'?(n+'종목을 비교한 순위에서 '+(e.rank||1)+'번째로 강해 자산의 '+Math.round((e.w||0)*100)+'%로 매수했습니다'):(btGate(s)&&e.of?(e.of+'종목 중 '+e.up+'종목이 오름세여서 반등 신호를 받아들였습니다'):('밀린 뒤 하루 '+mkPct0(e.bounce||0,1)+' 반등해 조건이 맞았습니다')); }
    else if(d.k==='skip'&&d.tk){ d.say='반등 신호는 나왔지만 '+e.of+'종목 중 '+e.up+'종목만 오름세여서 기다렸습니다'; }
    else if(d.k==='skip'){ d.say=e.why==='gate'?('오름세 종목이 '+e.of+'개 중 '+e.up+'개뿐이라 새로 사지 않았습니다'):'기준을 넘는 종목이 없어 새로 사지 않았습니다'; }
    else if(d.k==='hold'){ d.say='보유 종목이 여전히 상위권이라 바꾸지 않았습니다'; }
    else if(d.k==='pick'){ d.say='최근 '+c.look+'일 동안 가장 강해 거래 대상으로 골랐습니다'; }
    else if(d.k==='sell'){ d.say=(MK_WHY_P[e.why]||'').replace(/다$/,'습니다').replace(/했습니다습니다$/,'했습니다').replace(/닿았습니다습니다$/,'닿았습니다'); }
    d.out=null;
    if(d.k==='buy'&&d.tid!=null){ var t=trOf(d.tid); if(t) d.out=t.open?{t:'보유 중',v:t.pnl}:{t:t.days+'일 뒤 '+(fut?'청산':'매도'),v:t.pnl}; }
    else if(d.k==='sell'&&d.pnl!=null) d.out={t:'이 거래',v:d.pnl};
    else if(d.k==='skip'&&d.a){ var P=series(d.a), q=Math.min(T,d.i+25); if(q>d.i) d.out={t:'그 뒤 '+(q-d.i)+'일',v:(P[q]/P[d.i]-1)*100,mute:1}; }
  });
}
function fuBtSig(c,e,tk){ var up=e.side>0;
  if(c.mode==='brk') return [tk+' '+c.n+'일 '+(up?'최고가 돌파':'최저가 이탈'),e.ref?('기준 $'+mkPxFmt(e.ref)+'를 종가로 '+(up?'넘었습니다':'벗어났습니다')):''];
  if(c.mode==='ma') return [tk+' 평균선 '+(up?'위로':'아래로')+' 교차',c.fast+'일 평균이 '+c.slow+'일 평균을 '+(up?'넘었습니다':'밑돌았습니다')];
  if(c.mode==='dip') return [tk+(up?' 밀린 뒤 반등':' 오른 뒤 꺾임'),'하루 '+mkPct0(e.chg1||0,1)];
  if(c.mode==='fg') return [tk+(up?' 공포 구간 반등':' 과열 구간 꺾임'),'공포 탐욕 지수 '+(e.fng!=null?e.fng:'-')];
  return [tk,'']; }
function fuBtDec(s,e,x){
  var c=s.cfg, tk=e.a?mkTk(e.a):'', sd=e.side?fuSd(e.side):'', q=fuNeed(c,x.n8), lv=(e.lev>1?e.lev+'배':'1배');
  var brd=e.up!=null?['오름세 '+e.up+' / '+e.of+'개',(e.side>0?'롱 기준 '+q.L+'개 이상':'숏 기준 '+q.S+'개 이하')]:null;
  var tops=function(){ return (e.top||[]).length?'강한 쪽 '+mkTk(e.top[0].k)+' '+mkPct0(e.top[0].mom,0)+', 약한 쪽 '+((e.bot||[])[0]?mkTk(e.bot[0].k)+' '+mkPct0(e.bot[0].mom,0):'-'):''; };
  var liq=(e.liq>0&&isFinite(e.liq))?btPx(e.liq):'없음';
  if(e.t==='unpick') return null;
  if(e.t==='pick') return {k:'pick',tag:'선정',title:tk+' '+sd+' 후보',side:e.side,cmp:'오름세 '+e.up+' / '+e.of+', '+c.look+'일 '+mkPct0(e.mom,1),why:'AI가 시장 방향을 '+sd+'으로 보고 '+(e.side>0?'가장 강한':'가장 약한')+' 종목을 골랐습니다',
    facts:[['오름세 종목',e.of+'개 중 '+e.up+'개'],['강한 쪽',(e.top||[]).map(function(t){ return mkTk(t.k)+' '+mkPct0(t.mom,0); }).join(', ')],['약한 쪽',(e.bot||[]).map(function(t){ return mkTk(t.k)+' '+mkPct0(t.mom,0); }).join(', ')]]};
  if(e.t==='veto'){ var sg=fuBtSig(c,e,tk); return {k:'skip',tag:'보류',title:tk+' '+sd,side:e.side,chain:1,cmp:'AI가 본 방향과 반대',why:sd+' 신호가 나왔지만 AI가 본 시장 방향과 달라 진입하지 않았습니다',
    p0:sg,p1:['오름세 '+e.up+' / '+e.of+'개','AI가 본 방향은 '+(e.reg>0?'롱':e.reg<0?'숏':'쉼')],p2:['보류','방향이 달라 진입하지 않았습니다'],ups:x.upsOf(e),
    facts:[['규칙 신호',sd+', '+sg[0]],['AI가 본 방향',e.reg>0?'롱':e.reg<0?'숏':'쉼'],['오름세 종목',e.of+'개 중 '+e.up+'개']]}; }
  if(e.t==='skip') return {k:'skip',tag:'쉬어 감',title:'새로 진입하지 않음',cmp:'오름세 '+e.up+' / '+e.of+', 방향 애매',why:'오름세 종목이 '+e.of+'개 중 '+e.up+'개라 롱도 숏도 기준에 못 미쳤습니다',
    p0:[x.n8+'종목 비교',tops()],p1:['오름세 '+e.up+' / '+e.of+'개','롱 '+q.L+'개 이상, 숏 '+q.S+'개 이하'],p2:['새로 진입하지 않음','방향이 애매해 쉬었습니다'],ups:x.upsOf(e),
    facts:[['오름세 종목',e.of+'개 중 '+e.up+'개'],['기준','롱은 '+q.L+'개 이상, 숏은 '+q.S+'개 이하']].concat((e.held||[]).length?[['들고 있던 포지션',e.held.map(mkTk).join(', ')]]:[])};
  if(e.t==='hold') return {k:'hold',tag:'유지',title:'그대로 유지',cmp:(e.held||[]).map(mkTk).join(', ')+' 유지',why:'든 포지션이 여전히 조건에 맞아 그대로 뒀습니다',
    p0:[x.n8+'종목 비교',tops()],p1:['오름세 '+e.up+' / '+e.of+'개','방향 유지'],p2:['그대로 유지','포지션을 바꾸지 않았습니다'],ups:x.upsOf(e),
    facts:[['들고 있던 포지션',(e.held||[]).map(mkTk).join(', ')],['오름세 종목',e.of+'개 중 '+e.up+'개']]};
  if(e.t==='enter'){
    if(c.kind==='agent') return {k:'buy',tag:sd+' 진입',title:tk,side:e.side,cmp:(e.side>0?'강한 쪽 ':'약한 쪽 ')+e.rank+'위, '+c.look+'일 '+mkPct0(e.mom,1),why:'AI가 시장 방향을 '+sd+'으로 보고 '+(e.side>0?'강한':'약한')+' 쪽 '+e.rank+'번째 종목에 진입했습니다',
      p0:[x.n8+'종목 비교',tops()],p1:brd,p2:[tk+' '+sd+' 진입',lv+', 다음 날 시가'],ups:x.upsOf(e),
      facts:[['진입 가격',btPx(e.px)],['비중',Math.round((e.w||0)*100)+'%'],['방향과 배수',sd+' '+lv],['강제 청산 가격',liq],['순위',(e.side>0?'강한 쪽 ':'약한 쪽 ')+e.rank+'위, '+c.look+'일 '+mkPct0(e.mom,1)],['오름세 종목',e.of+'개 중 '+e.up+'개']]};
    var s1=fuBtSig(c,e,tk), mix=c.kind==='mix';
    return {k:'buy',tag:sd+' 진입',title:tk,side:e.side,chain:mix?1:0,cmp:s1[0].replace(tk+' ',''),why:s1[0]+'. '+s1[1],
      p0:s1,p1:mix?brd:null,p2:[tk+' '+sd+' 진입',lv+', 다음 날 시가'],ups:mix?x.upsOf(e):null,
      facts:[['신호',s1[0]+(s1[1]?', '+s1[1]:'')]].concat(mix&&e.up!=null?[['오름세 종목',e.of+'개 중 '+e.up+'개']]:[]).concat([['진입 가격',btPx(e.px)],['방향과 배수',sd+' '+lv],['강제 청산 가격',liq]])}; }
  return {k:'sell',tag:sd+' 청산',title:tk,side:e.side,pnl:e.pnl,cmp:FU_WHY[e.why]||'',why:FU_WHY[e.why]||'',
    facts:[['청산 가격',btPx(e.px)],['진입 가격',btPx(e.ep)],['이 거래의 손익',mkPct0(e.pnl,1)+', 넣은 돈 기준'],['청산한 이유',FU_WHY[e.why]||''],['낸 펀딩비',mkPct0(-(e.fund||0)/(e.cost||1)*100,1)]]};
}
  btCompute();btPlain();
  const indices=new Map(value.result.events.map((e,i)=>[e,i]));
  // Do not shallow-freeze here: the caller's recursive freeze deliberately skips
  // already-frozen objects, and facts/out/phase pairs must be frozen as well.
  return BT.R.D.map(({e,...fields})=>{
    const eventIndex=indices.get(e);
    if(eventIndex===undefined) throw Error('Missing original ledger event');
    return {...fields,eventIndex,runId:value.runId};
  });
}
