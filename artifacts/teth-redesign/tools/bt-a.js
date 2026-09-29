/* ═══ 백테스트 여정 (bt) 1/4: 계산과 그래프 ═══
   한 화면, 한 그래프. 기다리는 동안 그린 그래프가 그대로 결과가 된다.
   수치는 모두 카탈로그 엔진(mkRunCfg)이 고른 기간으로 실제 계산한 값이다 */
var BT={id:null,s:null,per:365,amt:1000,phase:'ready',R:null,raf:0,t0:0,ph:-1,j:-1,vj:-1,fed:0,seg:-1,stg:-1,sel:null,filt:null,trf:'all',grp:null,ordN:8,decN:8};
var BT_PER=[[90,'최근 3개월'],[365,'최근 1년'],[730,'최근 2년'],[0,'전체 기간']];
var BT_AMT=[500,1000,3000,10000];
function btUsd(v,d){ return (d?v.toFixed(d):Math.round(v).toLocaleString())+' USDT'; }
function btUsdS(v){ var r=Math.round(v); return (r>0?'+':r<0?'-':'')+Math.abs(r).toLocaleString()+' USDT'; }
function btPx(v){ return mkPxFmt(v)+' USDT'; } /* 토큰화 상품도 거래소에서는 USDT 로 사고판다 */
function btPerL(){ for(var i=0;i<BT_PER.length;i++) if(BT_PER[i][0]===BT.per) return BT_PER[i][1]; return '전체 기간'; }
function btYMD(i){ return mkDate(i); }
function btGate(s){ var c=s.cfg||{}; return s.kind==='mix'&&c.gate>0; }
function btAi(s){ return btGate(s)||s.kind==='agent'; }
function btNeed(s){ var c=s.cfg||{}, n=mkUni(s).list.length; return Math.ceil((c.gate||0)*n); }
function btOppL(s){ return s.kind==='agent'?'AI 재평가':btGate(s)?'기회':'조건 충족'; }
function btSkipL(s){ return s.kind==='agent'?'쉬어 감':'AI 보류'; }
function btDefFilt(s){ return btAi(s)?'opp':'all'; }

/* 전략의 규칙과 백테스트 조건을 쉬운 말로 (준비 화면) */
function btRules(s){
  var c=s.cfg||{}, u=mkUni(s), n=u.list.length, o=[];
  if(s.kind==='agent'){
    o.push(['종목 고르기','AI가 '+c.every+'일마다 '+u.label+'을 비교해 최대 '+c.top+'종목']);
    o.push(['쉬는 때','오름세 종목이 '+n+'개 중 '+btNeed(s)+'개 미만이면 새로 사지 않음']);
    o.push(['파는 때','든 뒤 가장 높았던 가격에서 '+c.trail+'% 밀리면']);
  } else {
    if(s.kind==='mix') o.push(['종목 고르기','AI가 '+c.every+'일마다 '+u.label+' 중 가장 강한 하나']);
    o.push(['사는 때','되돌림 점수가 '+c.rsiTh+' 아래로 내려간 뒤 하루 만에 0.5% 넘게 다시 오르면'+(c.tf?', 오름세일 때만':'')+(c.fng!=null?', 공포 탐욕 지수가 '+c.fng+' 이하일 때만':'')]);
    if(btGate(s)) o.push(['AI 확인','조건이 맞아도 오름세 종목이 '+n+'개 중 '+btNeed(s)+'개 미만이면 사지 않음']);
    o.push(['파는 때',(c.tp!=null?'+'+c.tp+'% 오르거나 ':'')+c.sl+'% 내리면, 또는 25일이 지나면']);
  }
  return o;
}
function btTerms(){ return [['판단 시점','하루 한 번, 그날 마지막 가격으로'],['비용','살 때와 팔 때마다 수수료 0.1%'],['비교 대상',mkUni(BT.s).list.length>1?'같은 종목을 똑같이 나눠 그냥 들고 있었을 때':'같은 종목을 그냥 들고 있었을 때']]; }
/* 그날 오름세로 센 종목(엔진과 같은 기준: 가격이 60일 평균보다 위) */
function btUps(list,px,i){ var o=[]; list.forEach(function(k,q){ var P=px[q]; if(i<60) return; var a=0; for(var z=i-59;z<=i;z++) a+=P[z]; if(P[i]>a/60) o.push(k); }); return o; }

/* ── 계산: 고른 기간으로 엔진을 돌리고, 화면이 쓰는 값을 한 번에 만든다 ── */
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
  var push=function(d,e){ d.i=e.i; d.j=Math.max(0,Math.min(N-1,e.i-i0)); d.a=e.a; d.tk=e.a?mkTk(e.a):''; d.tid=e.tid; d.ix=D.length; D.push(d); return d; };
  ev.forEach(function(e){
    var tk=e.a?mkTk(e.a):'';
    if(e.t==='pick'){ lastPick[e.a]=e; push({k:'pick',tag:'선정',title:tk,cmp:'오름세 종목 중 '+look+'일 상승률 1위 '+mkPct0(e.mom,1),why:'오름세 종목 중 최근 '+look+'일 상승률이 '+mkPct0(e.mom,1)+'로 가장 높았어요',facts:(e.top||[]).slice(0,3).map(function(x,q){ return [(q+1)+'위',mkTk(x.k)+' '+mkPct0(x.mom,0)]; })},e); return; }
    if(e.t==='enter'){
      if(agent){ push({k:'buy',tag:'매수',title:tk,cmp:'흔들림까지 본 순위 '+(e.rank||1)+'위, '+look+'일 '+mkPct0(e.mom,1),why:'가격 흔들림까지 고려한 순위에서 '+(e.rank||1)+'번째였어요. 최근 '+look+'일 상승률은 '+mkPct0(e.mom,1)+'예요',
          p0:[n8+'종목 비교',top1(e)],p1:brd(e),p2:[tk+' 매수','새로 담았어요'],ups:e.of?upsOf(e):null,
          facts:[['산 가격',btPx(e.px)],['비중',Math.round((e.w||0)*100)+'%'],['순위',(e.rank||1)+'위, 상승률을 가격 흔들림으로 나눈 점수 기준'],['최근 '+look+'일 상승률',mkPct0(e.mom,1)],['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']]},e); return; }
      var pk2=lastPick[e.a], pkT=pk2?pkTxt(pk2):'떨어진 뒤 다시 올랐어요';
      push({k:'buy',tag:'매수',title:tk,chain:gate?1:0,cmp:gate?('오름세 '+e.up+' / '+e.of+', 기준 '+need):('하루 반등 '+mkPct0(e.bounce,1)),
        why:gate?('오름세 종목이 '+e.of+'개 중 '+e.up+'개라 샀어요'):('떨어진 뒤 하루 만에 '+mkPct0(e.bounce,1)+' 다시 올랐어요'),
        p0:[tk+' 하루 반등 '+mkPct0(e.bounce,1),pkT],p1:gate&&e.of?brd(e):null,p2:[tk+' 매수',gate?'기준을 넘어 샀어요':'조건이 맞아 샀어요'],ups:gate&&e.of?upsOf(e):null,
        facts:(pk2?pkFacts(pk2,e):[]).concat([['하루 반등',mkPct0(e.bounce,1)+', 기준 0.5% 넘게'],['되돌림 점수',Math.round(e.rsi)+', 기준 '+c.rsiTh+' 아래']]).concat(gate&&e.of?[['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']]:[]).concat(c.fng!=null&&e.fng!=null?[['공포 탐욕 지수',e.fng+', 기준 '+c.fng+' 이하']]:[]).concat([['산 가격',btPx(e.px)]])},e); return; }
    if(e.t==='exit'){ push({k:'sell',tag:'매도',title:tk,pnl:e.pnl,cmp:MK_WHY[e.why]||'',why:MK_WHY[e.why]||'',facts:[['판 가격',btPx(e.px)],['이 거래의 손익',mkPct0(e.pnl,1)],['판 이유',MK_WHY[e.why]||'']]},e); return; }
    if(e.t==='veto'){ var pk3=lastPick[e.a];
      push({k:'skip',tag:'보류',title:tk,chain:1,cmp:'오름세 '+e.up+' / '+e.of+', 기준 '+need,why:'오름세 종목이 '+e.of+'개 중 '+e.up+'개뿐이라 사지 않았어요',
        p0:[tk+' 하루 반등 '+mkPct0(e.bounce,1),pk3?pkTxt(pk3):'떨어진 뒤 다시 올랐어요'],p1:brd(e),p2:['보류','기준에 못 미쳐 사지 않았어요'],ups:upsOf(e),
        facts:(pk3?pkFacts(pk3,e):[]).concat([['하루 반등',mkPct0(e.bounce,1)+', 기준 0.5% 넘게'],['되돌림 점수',Math.round(e.rsi)+', 기준 '+c.rsiTh+' 아래'],['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']])},e); return; }
    if(e.t==='skip'){ var weak=e.why==='gate';
      push({k:'skip',tag:'쉬어 감',title:'새로 사지 않음',cmp:weak?('오름세 '+e.up+' / '+e.of+', 기준 '+need):'살 만한 종목 없음',why:weak?('오름세 종목이 '+e.of+'개 중 '+e.up+'개뿐이라 시장이 약하다고 봤어요'):'오름세이면서 충분히 강한 종목이 없었어요',
        p0:[n8+'종목 비교',top1(e)],p1:weak?brd(e):['살 만한 종목 0개','오름세이고 충분히 강해야 해요'],p2:['새로 사지 않음',weak?'시장이 약해 쉬었어요':'살 종목이 없어 쉬었어요'],ups:upsOf(e),
        facts:[['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상'],['쉬어 간 이유',weak?'오름세 종목이 기준보다 적었어요':'오름세이면서 충분히 강한 종목이 없었어요']].concat(e.held&&e.held.length?[['들고 있던 종목',e.held.map(mkTk).join(', ')]]:[])},e); return; }
    if(e.t==='hold'){ push({k:'hold',tag:'유지',title:'그대로 유지',cmp:(e.held||[]).map(mkTk).join(', ')+' 보유',why:'이미 '+(e.held||[]).length+'종목을 들고 있어 그대로 뒀어요',
        p0:[n8+'종목 비교',top1(e)],p1:['빈자리 0개','이미 '+(e.held||[]).length+'종목 보유 중'],p2:['그대로 유지','든 종목을 계속 들었어요'],ups:upsOf(e),
        facts:[['들고 있던 종목',(e.held||[]).map(mkTk).join(', ')],['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']]},e); }
  });
  /* AI 판단 전략: 재평가 한 번이 한 줄. 그날 산 종목, 유지, 쉬어 감을 결과로 적는다 */
  var EV=[]; if(agent){ var byD={}; D.forEach(function(d){ if(d.k!=='buy'&&d.k!=='skip'&&d.k!=='hold') return; if(!byD[d.j]){ byD[d.j]={j:d.j,i:d.i,ds:[]}; EV.push(byD[d.j]); } byD[d.j].ds.push(d); });
    EV.forEach(function(E,q){ var b=E.ds.filter(function(d){ return d.k==='buy'; }), f=E.ds[0]; E.ix=q; E.out=b.length?'buy':f.k; E.tag=b.length?'매수':f.tag; E.title=b.length?b.map(function(d){ return d.tk; }).join(', '):f.title; E.cmp=b.length===1?b[0].cmp:b.length?b.map(function(d){ return d.tk+' '+d.cmp; }).join(' / '):f.cmp; E.why=f.why; E.ups=f.ups; E.k=b.length?'buy':f.k; }); }
  var op=r.state&&r.state.open?(r.state.open.length!=null?r.state.open:[r.state.open]):[];
  var tr=(r.trades||[]).map(function(t){ return {id:t.id,a:t.asset,e:t.entry,x:t.exit,ep:t.ep,xp:t.xp,pnl:t.pnl*100,why:t.kind,cost:t.cost,got:t.got,fee:t.fee,days:t.exit-t.entry}; });
  op.forEach(function(o){ tr.push({id:o.tid,a:o.k,e:o.entry,x:null,ep:o.ep,xp:o.px,pnl:o.chg,why:null,cost:o.cost,got:null,fee:null,days:T-o.entry,open:1}); });
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
/* 재생 계획. 걸리는 시간은 정해 두지 않는다.
   아무 일 없는 날은 일정한 속도로 지나간다. 처음 나오는 매수와 처음 나오는 보류는 단계마다 읽을 시간을 주고,
   그 뒤의 판단은 완성된 모습으로 짧게 보여 준다. 날짜가 기회의 날에 닿는 것과 결정이 나는 것은 다른 일이다 */
function btPlan(){
  var R=BT.R, s=BT.s, stops=[], by={};
  R.D.forEach(function(d){ if(d.k!=='buy'&&d.k!=='skip'&&d.k!=='hold') return; if(!by[d.j]){ by[d.j]={j:d.j,ds:[]}; stops.push(by[d.j]); } by[d.j].ds.push(d); });
  stops.sort(function(a,b){ return a.j-b.j; });
  var ai=btAi(s), seenBuy=0, seenSkip=0, nBrief=0, gap=Math.max(2,Math.round(R.N/110));
  stops.forEach(function(st,ix){ var hasBuy=st.ds.some(function(d){ return d.k==='buy'; }), hold=!hasBuy&&st.ds[0].k==='hold', sk=!hasBuy&&!hold, prev=stops[ix-1]; st.sk=sk; st.hold=hold; st.kind=hasBuy?'buy':hold?'hold':'skip';
    if(hold){ st.dw=0; return; }
    if(sk?!seenSkip:!seenBuy){ st.full=1; st.t=ai?[900,1000,1300]:[900,0,1200]; st.dw=st.t[0]+st.t[1]+st.t[2]; if(sk) seenSkip=1; else seenBuy=1; }
    else if(prev&&prev.dw>0&&!prev.full&&st.j-prev.j<=gap&&prev.sk===sk){ st.dw=0; }
    else if(nBrief<7){ st.dw=ai?420:320; nBrief++; }
    else st.dw=0; });
  var bar=Math.max(2.4,Math.min(8,2400/R.N)), seg=[], t=0, pj=-1;
  /* 기회가 있는 날에는 멈춤 구간만 들어간다. 지나가는 구간은 그 전날까지 */
  stops.forEach(function(st){ var to=st.dw>0?st.j-1:st.j; if(to>pj){ var dt=(to-pj)*bar; seg.push({k:'go',a:pj,b:to,t0:t,t1:t+dt}); t+=dt; pj=to; } if(st.dw>0){ seg.push({k:'stop',j:st.j,st:st,t0:t,t1:t+st.dw}); t+=st.dw; pj=st.j; } });
  if(pj<R.N-1){ var d2=(R.N-1-pj)*bar; seg.push({k:'go',a:pj,b:R.N-1,t0:t,t1:t+d2}); t+=d2; }
  R.seg=seg; R.runMs=t; R.prepMs=700; R.wrapMs=900; R.stops=stops;
}

/* ── 그래프 ── */
function btGeo(){
  var R=BT.R, host=$('bt-chart'), W=Math.max(300,Math.round(host?host.clientWidth:900)), mob=W<560, H=mob?240:Math.max(300,Math.min(372,Math.round(innerHeight*0.41))), pl=mob?46:64, pr=mob?8:18, pt=26, pb=40;
  var vs=R.eq.map(function(p){ return p.v; }).concat(R.bench), mn=Math.min.apply(null,vs.concat(1))*BT.amt, mx=Math.max.apply(null,vs.concat(1))*BT.amt;
  var T=mkdTicks(mn,mx,5), lo=T[0], hi=T[T.length-1];
  var X=function(j){ return pl+Math.max(0,j)/Math.max(1,R.N-1)*(W-pl-pr); }, Y=function(v){ return pt+(1-(v*BT.amt-lo)/(hi-lo))*(H-pt-pb); };
  return (BT.G={W:W,H:H,pl:pl,pr:pr,pt:pt,pb:pb,T:T,X:X,Y:Y,mob:mob});
}
function btV(j){ return j<0?1:BT.R.eq[j].v; } /* j=-1 은 첫날의 거래가 반영되기 전 */
function btPath(arr,G){ var d=''; arr.forEach(function(v,j){ d+=(j?' L':'M')+G.X(j).toFixed(1)+' '+G.Y(v).toFixed(1); }); return d; }
/* 그래프 위의 표시. 돌리는 동안에는 판단 하나가 표시 하나(그 날짜에). 끝난 뒤에는 가까이 붙은 보류와 같은 날의 매수를 묶는다 */
function btMarkList(group){
  var R=BT.R, G=BT.G, out=[], last=null, lastB=null;
  R.D.forEach(function(d){ if(d.k==='pick'||d.k==='hold') return;
    if(group&&d.k==='skip'&&last&&G.X(d.j)-G.X(last.j2)<12){ last.n++; last.j2=d.j; last.ix2=d.ix; return; }
    if(d.k==='buy'&&lastB&&lastB.j===d.j){ lastB.n++; lastB.t+=', '+d.tk; return; }
    var m={k:d.k,j:d.j,j2:d.j,ix:d.ix,ix2:d.ix,n:1,pnl:d.pnl,t:(d.tk?d.tk+' ':'')+d.tag}; out.push(m); if(d.k==='skip'){ last=m; } else if(d.k==='buy'){ last=null; lastB=m; } });
  return out;
}
function btChartSvg(){
  var R=BT.R, G=btGeo(), W=G.W, H=G.H, yb=G.Y(1), G1='#2fb98a', R1='#f0566a', res=BT.phase==='result', base=H-G.pb;
  var grid=G.T.map(function(v){ var y=G.Y(v/BT.amt); return '<line x1="'+G.pl+'" x2="'+(W-G.pr)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="rgba(255,255,255,'+(Math.abs(v-BT.amt)<1e-6?'.26':'.07')+')"/><text x="'+(G.pl-10)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" font-size="11" fill="#8b9096">'+Math.round(v).toLocaleString()+'</text>'; }).join('');
  var nx=G.mob?4:6, xl=''; for(var k=0;k<nx;k++){ var j=Math.round(k*(R.N-1)/(nx-1)), d=idxToDate(R.eq[j].i); xl+='<text x="'+G.X(j).toFixed(1)+'" y="'+(H-8)+'" text-anchor="'+(k===0?'start':k===nx-1?'end':'middle')+'" font-size="11" fill="#8b9096">'+String(d.getFullYear()).slice(2)+'.'+String(d.getMonth()+1).padStart(2,'0')+'</text>'; }
  var line=btPath(R.eq.map(function(p){ return p.v; }),G), area=line+' L'+G.X(R.N-1).toFixed(1)+' '+yb.toFixed(1)+' L'+G.X(0).toFixed(1)+' '+yb.toFixed(1)+' Z';
  var ML=btMarkList(res), dense=ML.length>60, sz=dense?0.72:1;
  var mk=ML.map(function(m){ var x=G.X(m.j), y=G.Y(R.eq[m.j].v), s, col=m.pnl>=0?G1:R1, a=5*sz, h=8*sz;
    if(m.k==='buy') s='<path d="M'+x.toFixed(1)+' '+(y+7).toFixed(1)+' l'+a+' '+h+' h-'+(2*a)+' z" fill="'+G1+'"/>';
    else if(m.k==='sell') s='<path d="M'+x.toFixed(1)+' '+(y-7).toFixed(1)+' l'+a+' -'+h+' h-'+(2*a)+' z" fill="#15171a" stroke="'+col+'" stroke-width="1.5" stroke-linejoin="round"/>';
    else s='<rect x="'+(x-4.5).toFixed(1)+'" y="'+(y-24.5).toFixed(1)+'" width="9" height="9" transform="rotate(45 '+x.toFixed(1)+' '+(y-20).toFixed(1)+')" fill="#15171a" stroke="#f0b840" stroke-width="1.7"/>'+(m.n>1?'<text x="'+(x+9).toFixed(1)+'" y="'+(y-27).toFixed(1)+'" font-size="10.5" font-weight="700" fill="#f0b840">'+m.n+'번</text>':'');
    return '<g class="bt-m k-'+m.k+'" data-j="'+m.j+'" data-ix="'+m.ix+'" tabindex="-1" role="button" aria-label="'+gEsc(btYMD(R.eq[m.j].i)+' '+m.t+(m.n>1&&m.k==='skip'?' 외 '+(m.n-1)+'번':''))+'" onclick="event.stopPropagation();btMarkClick('+m.ix+','+(m.k==='skip'?m.ix2:m.ix)+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();btMarkClick('+m.ix+','+(m.k==='skip'?m.ix2:m.ix)+')}"><rect x="'+(x-11).toFixed(1)+'" y="'+(y-(m.k==='buy'?-2:34)).toFixed(1)+'" width="22" height="'+(m.k==='skip'?34:20)+'" fill="transparent"/>'+s+'</g>'; }).join('');
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="잔고 그래프"><defs>'
    +'<linearGradient id="btgu" gradientUnits="userSpaceOnUse" x1="0" y1="'+G.pt+'" x2="0" y2="'+yb.toFixed(1)+'"><stop offset="0" stop-color="'+G1+'" stop-opacity=".26"/><stop offset="1" stop-color="'+G1+'" stop-opacity=".02"/></linearGradient>'
    +'<linearGradient id="btgd" gradientUnits="userSpaceOnUse" x1="0" y1="'+yb.toFixed(1)+'" x2="0" y2="'+base+'"><stop offset="0" stop-color="'+R1+'" stop-opacity=".02"/><stop offset="1" stop-color="'+R1+'" stop-opacity=".26"/></linearGradient>'
    +'<clipPath id="btcu"><rect x="0" y="0" width="'+W+'" height="'+yb.toFixed(1)+'"/></clipPath><clipPath id="btcd"><rect x="0" y="'+yb.toFixed(1)+'" width="'+W+'" height="'+(H-yb).toFixed(1)+'"/></clipPath>'
    +'<clipPath id="btrv"><rect id="bt-rv" x="0" y="0" height="'+H+'" width="'+(res?W:0)+'"/></clipPath></defs>'
    +grid+xl
    /* 가장 나빴던 구간: 시간 축을 따라 놓인 띠와 이름표. 그래프 전체를 칠하지 않는다 */
    +'<g class="bt-dd" id="bt-dd"><rect id="bt-ddr" x="0" y="'+(base+3)+'" width="0" height="4" rx="2" fill="#f0566a"/><line id="bt-dda" x1="0" x2="0" y1="'+G.pt+'" y2="'+base+'" stroke="rgba(240,86,106,.32)" stroke-dasharray="2 5"/><line id="bt-ddb" x1="0" x2="0" y1="'+G.pt+'" y2="'+base+'" stroke="rgba(240,86,106,.32)" stroke-dasharray="2 5"/>'
    +'<text id="bt-ddt" x="0" y="'+(base-8)+'" text-anchor="middle" font-size="11.5" font-weight="600" fill="#f58a98"></text></g>'
    +'<path class="bt-bench" d="'+btPath(R.bench,G)+'" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.3" stroke-dasharray="2 4"/>'
    +'<g clip-path="url(#btrv)">'
    +'<g clip-path="url(#btcu)"><path d="'+area+'" fill="url(#btgu)"/><path d="'+line+'" fill="none" stroke="'+G1+'" stroke-width="1.9" stroke-linejoin="round"/></g>'
    +'<g clip-path="url(#btcd)"><path d="'+area+'" fill="url(#btgd)"/><path d="'+line+'" fill="none" stroke="'+R1+'" stroke-width="1.9" stroke-linejoin="round"/></g>'
    +'</g><g id="bt-mk">'+mk+'</g>'
    +'<g class="bt-pu" id="bt-pu"><circle id="bt-pu1" r="7" fill="none" stroke="#c8f43c" stroke-width="1.6"/><circle id="bt-pu2" r="3.2" fill="#c8f43c"/></g>'
    +'<g class="bt-cur" id="bt-cur"><line id="bt-cl" x1="0" x2="0" y1="'+G.pt+'" y2="'+base+'" stroke="rgba(255,255,255,.7)" stroke-dasharray="4 4"/><circle id="bt-cc" r="4.5" fill="#15171a" stroke="#fff" stroke-width="2"/></g>'
    +'<g class="bt-pin" id="bt-pin"><line id="bt-pl" x1="0" x2="0" y1="'+G.pt+'" y2="'+base+'" stroke="#f0b840" stroke-width="1.2"/><circle id="bt-pc" r="5" fill="#f0b840"/></g>'
    +'</svg><div class="bt-tip" id="bt-tip" role="status"></div>';
}
function btChartDraw(){ var h=$('bt-chart'); if(!h) return; h.innerHTML=btChartSvg(); h.className='bt-chart ph-'+BT.phase; if(BT.phase==='result'){ btMarks(BT.R.N); btDD(BT.R.N-1); btPin(); var m=h.querySelectorAll('.bt-m'); for(var i=0;i<m.length;i++) m[i].setAttribute('tabindex','0'); } }
function btMarks(j){ var m=document.querySelectorAll('#bt-mk .bt-m'); for(var i=0;i<m.length;i++){ if(+m[i].getAttribute('data-j')<=j) m[i].classList.add('on'); else m[i].classList.remove('on'); } }
/* 그날까지 가장 나빴던 구간 */
function btDD(j){
  var R=BT.R, G=BT.G, d=j>=0?R.dd[j]:null, g=$('bt-dd'); if(!g) return;
  if(!d||d.v>-0.03){ g.classList.remove('on'); return; }
  var x=G.X(d.a), w=Math.max(3,G.X(d.b)-x), lx=Math.max(G.pl+92,Math.min(G.W-G.pr-92,x+w/2));
  $('bt-ddr').setAttribute('x',x); $('bt-ddr').setAttribute('width',w); $('bt-dda').setAttribute('x1',x); $('bt-dda').setAttribute('x2',x); $('bt-ddb').setAttribute('x1',x+w); $('bt-ddb').setAttribute('x2',x+w);
  var t=$('bt-ddt'); t.setAttribute('x',lx); t.textContent=(BT.phase==='result'?'가장 나빴던 구간 ':'지금까지 가장 나빴던 구간 ')+(d.v*100).toFixed(1)+'%';
  g.classList.add('on');
}
function btCursor(j){
  var G=BT.G, x=G.X(j), y=G.Y(btV(j)), l=$('bt-cl'), c=$('bt-cc'), rv=$('bt-rv');
  if(l){ l.setAttribute('x1',x); l.setAttribute('x2',x); } if(c){ c.setAttribute('cx',x); c.setAttribute('cy',y); } if(rv) rv.setAttribute('width',j<0?0:x+1);
}
/* 기회가 생긴 자리를 짚는다 */
function btPulse(j){ var g=$('bt-pu'); if(!g) return; if(j==null){ g.classList.remove('on'); return; } var x=BT.G.X(j), y=BT.G.Y(btV(j)); $('bt-pu1').setAttribute('cx',x); $('bt-pu1').setAttribute('cy',y); $('bt-pu2').setAttribute('cx',x); $('bt-pu2').setAttribute('cy',y); g.classList.add('on'); }
function btNear(j){ var R=BT.R, tol=Math.max(1,Math.round(R.N/140)), best=null; R.D.forEach(function(d){ if(d.k==='pick'||d.k==='hold') return; var q=Math.abs(d.j-j); if(q<=tol&&(!best||q<Math.abs(best.j-j))) best=d; }); return best; }
function btHoverJ(ev){ var h=$('bt-chart'), R=BT.R, G=BT.G, b=h.getBoundingClientRect(), x=(ev.clientX-b.left)/b.width*G.W; return Math.max(0,Math.min(R.N-1,Math.round((x-G.pl)/(G.W-G.pl-G.pr)*(R.N-1)))); }
function btHover(ev){
  if(BT.phase!=='result') return; var h=$('bt-chart'), tip=$('bt-tip'), R=BT.R, G=BT.G; if(!h||!tip) return;
  if(!ev){ h.classList.remove('hov'); return; }
  var b=h.getBoundingClientRect(), j=btHoverJ(ev), px=G.X(j), py=G.Y(R.eq[j].v), l=$('bt-cl'), c=$('bt-cc'); l.setAttribute('x1',px); l.setAttribute('x2',px); c.setAttribute('cx',px); c.setAttribute('cy',py);
  h.classList.add('hov'); var v=R.eq[j].v, near=btNear(j); h.classList.toggle('ev',!!near);
  tip.innerHTML='<b class="num">'+btYMD(R.eq[j].i)+'</b><span>잔고 <i class="num">'+btUsd(BT.amt*v)+'</i> <i class="num'+mkSign((v-1)*100)+'">'+mkPct0((v-1)*100,1)+'</i></span><span class="g">그냥 들고 있었다면 <i class="num">'+btUsd(BT.amt*R.bench[j])+'</i></span>'
    +(near?'<span class="e"><em class="num">'+btYMD(near.i)+'</em>'+gEsc((near.tk?near.tk+' ':'')+near.tag)+(near.pnl!=null?' <i class="num'+mkSign(near.pnl)+'">'+mkPct0(near.pnl,1)+'</i>':'')+'<em>누르면 이유가 열려요</em></span>':'');
  var tw=tip.offsetWidth||190, left=px/G.W*b.width+14; if(left+tw>b.width-6) left=px/G.W*b.width-tw-14; tip.style.left=Math.max(4,left)+'px'; tip.style.top=Math.max(6,Math.min(b.height-tip.offsetHeight-40,py/G.H*b.height-30))+'px';
}
function btChartClick(ev){ if(BT.phase!=='result') return; var d=btNear(btHoverJ(ev)); if(d) btMarkClick(d.ix,d.ix); }
/* 판단이나 거래를 고르면 그래프에 그 날을 표시한다 */
function btPin(){
  var g=$('bt-pin'); if(!g) return; var j=BT.sel&&BT.sel.j; if(j==null){ g.classList.remove('on'); return; }
  var x=BT.G.X(j), y=BT.G.Y(BT.R.eq[j].v); $('bt-pl').setAttribute('x1',x); $('bt-pl').setAttribute('x2',x); $('bt-pc').setAttribute('cx',x); $('bt-pc').setAttribute('cy',y); g.classList.add('on');
}
/* 근거 목록에 나올 줄. AI 판단 전략의 "재평가"는 하루가 한 줄 */
function btDecList(f){
  var s=BT.s, R=BT.R;
  if(f==='opp') return (s.kind==='agent'?R.EV.map(function(E){ return {ev:E}; }):R.D.filter(function(d){ return d.k==='buy'||d.k==='skip'; }).map(function(d){ return {d:d}; })).reverse();
  return R.D.filter(function(d){ return f==='all'?(d.k!=='pick'||s.kind==='mix'):d.k===f; }).map(function(d){ return {d:d}; }).reverse();
}
function btRowAt(L,d){ for(var i=0;i<L.length;i++){ if(L[i].d===d) return i; if(L[i].ev&&L[i].ev.j===d.j) return i; } return -1; }
/* 그래프의 표시를 누르면 그 판단의 근거로 간다. 묶인 보류는 보류만 모아 그 묶음을 짚어 보여 준다 */
function btMarkClick(ix,ix2){
  if(BT.phase!=='result') return; var d=BT.R.D[ix]; if(!d) return;
  BT.grp=ix2>ix?{a:ix,b:ix2}:null;
  if(BT.grp) BT.filt='skip'; else if(btRowAt(btDecList(BT.filt),d)<0) BT.filt=d.k==='sell'?'all':btDefFilt(BT.s);
  var L=btDecList(BT.filt), at=btRowAt(L,d); if(BT.grp){ var last=btRowAt(L,BT.R.D[ix2]); at=Math.max(at,last); } if(at>=BT.decN) BT.decN=at+3;
  var row=L[btRowAt(L,d)]; BT.sel=row&&row.ev?{t:'e',ix:row.ev.ix,j:d.j}:{t:'d',ix:ix,j:d.j};
  var e=$('bt-ev'); if(e) e.innerHTML=btEvidence(); btPin();
  var el=document.querySelector('.bt-row.on'); if(el) try{ el.scrollIntoView({block:'center',behavior:'smooth'}); }catch(x){}
}
