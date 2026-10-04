import vm from 'node:vm'
import { createHash } from 'node:crypto'
import type { CatalogueBacktestObservation } from '../../src/client-catalogue-backtest'
import type { CatalogueEvidenceDecision, CatalogueEvidenceDailyGroup } from '../../src/client-catalogue-backtest-evidence-types'
import source from '../../src/client-catalogue-source.json' with { type: 'json' }
import spot from '../../src/client-catalogue-spot-data.json' with { type: 'json' }
import future from '../../src/client-catalogue-futures-data.json' with { type: 'json' }

// Fixed source, independently extracted from final top-level AST declarations.
// UI-only 24969 skbGroupHolds and 8167 hidden month headers are intentionally
// tested in the browser separately. btCompute's final 23764 wrapper calls
// btPlain; invoke both below. No model, network, DOM side effect or new engine.
const frozen = {
  "source": "9fbff821df62cad11d026022fc7628c7fcebc431",
  "htmlSha": "f2475453a03b2646361546ac32002b00e4ce26ee014abf79d3be6262b318e321",
  "functions": {
    "btCompute": {
      "declarations": 1,
      "sha256": "3fc14e249f3568f2fab35cea51f42a64912cf9a31c7ad6c9035670db6279d3e7",
      "code": "function btCompute(){\r\n  var s=BT.s, c=s.cfg, T=PRICE0.length-1, min=c.startI!=null?c.startI:61, st=BT.per?Math.max(min,T-BT.per):min;\r\n  var r=mkRunCfg(c,st), eq=r.eq, i0=eq[0].i, N=eq.length, list=mkUni(s).list, px=list.map(function(k){ return mkPx(k); });\r\n  var bench=eq.map(function(p){ var a=0; px.forEach(function(P){ a+=P[p.i]/P[i0]; }); return a/px.length; });\r\n  var bpk=0, bmd=0; bench.forEach(function(v){ if(v>bpk) bpk=v; var d=v/bpk-1; if(d<bmd) bmd=d; });\r\n  var mon=[], cur=null;\r\n  eq.forEach(function(p,j){ var d=idxToDate(p.i), k=d.getFullYear()*12+d.getMonth(); if(!cur||cur.k!==k){ if(cur) mon.push(cur); cur={k:k,y:d.getFullYear(),m:d.getMonth()+1,base:j?eq[j-1].v:1,last:p.v,d0:d.getDate(),d1:d.getDate(),dim:new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}; } cur.last=p.v; cur.d1=d.getDate(); });\r\n  if(cur) mon.push(cur); mon.forEach(function(m){ m.ret=(m.last/m.base-1)*100; m.part=m.d0>1||m.d1<m.dim; });\r\n  /* 그날까지의 가장 나빴던 구간(재생하는 동안 자라난다) */\r\n  var dd=[], pk=eq[0].v, pkJ=0, best={v:0,a:0,b:0};\r\n  eq.forEach(function(p,j){ if(p.v>=pk){ pk=p.v; pkJ=j; } var d=p.v/pk-1; if(d<best.v) best={v:d,a:pkJ,b:j}; dd.push(best); });\r\n  var ev=(r.events||[]), cnt={enter:0,exit:0,veto:0,skip:0,pick:0,hold:0,unpick:0}; ev.forEach(function(e){ if(cnt[e.t]!=null) cnt[e.t]++; });\r\n  var look=c.look, D=[], gate=btGate(s), need=btNeed(s), n8=list.length, agent=s.kind==='agent', lastPick={};\r\n  var upsOf=function(e){ var u=btUps(list,px,e.i); return u.length===e.up?u:null; };\r\n  var brd=function(e){ return ['오름세 '+e.up+' / '+e.of+'개','기준 '+need+'개 이상']; };\r\n  var md=function(i){ var d=idxToDate(i); return String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0'); };\r\n  var momAt=function(k,i){ var P=px[list.indexOf(k)]; return P&&i-look>=0?(P[i]/P[i-look]-1)*100:0; };\r\n  var pkTxt=function(p){ return 'AI가 '+md(p.i)+'에 고른 종목, 그날 '+look+'일 상승률 '+mkPct0(p.mom,1); };\r\n  var pkFacts=function(p,e){ return [['AI가 고른 날',btYMD(p.i)+', 오름세 종목 중 '+look+'일 상승률 1위 '+mkPct0(p.mom,1)],['이날의 '+look+'일 상승률',mkPct0(momAt(e.a,e.i),1)]]; };\r\n  var top1=function(e){ var t=(e.top||[])[0]; return t?('점수 1위 '+mkTk(t.k)+', '+look+'일 '+mkPct0(t.mom,1)):''; };\r\n  var push=function(d,e){ d.e=e; d.i=e.i; d.j=Math.max(0,Math.min(N-1,e.i-i0)); d.a=e.a; d.tk=e.a?mkTk(e.a):''; d.tid=e.tid; d.ix=D.length; D.push(d); return d; };\r\n  ev.forEach(function(e){\r\n    var tk=e.a?mkTk(e.a):'';\r\n    if(c.fut){ var fd=fuBtDec(s,e,{n8:n8,upsOf:upsOf}); if(fd) push(fd,e); return; }\r\n    if(e.t==='pick'){ lastPick[e.a]=e; push({k:'pick',tag:'선정',title:tk,cmp:'오름세 종목 중 '+look+'일 상승률 1위 '+mkPct0(e.mom,1),why:'오름세 종목 중 최근 '+look+'일 상승률이 '+mkPct0(e.mom,1)+'로 가장 높았습니다',facts:(e.top||[]).slice(0,3).map(function(x,q){ return [(q+1)+'위',mkTk(x.k)+' '+mkPct0(x.mom,0)]; })},e); return; }\r\n    if(e.t==='enter'){\r\n      if(agent){ push({k:'buy',tag:'매수',title:tk,cmp:'흔들림까지 본 순위 '+(e.rank||1)+'위, '+look+'일 '+mkPct0(e.mom,1),why:'가격 흔들림까지 고려한 순위에서 '+(e.rank||1)+'번째였습니다. 최근 '+look+'일 상승률은 '+mkPct0(e.mom,1)+'입니다',\r\n          p0:[n8+'종목 비교',top1(e)],p1:brd(e),p2:[tk+' 매수','새로 담았습니다'],ups:e.of?upsOf(e):null,\r\n          facts:[['산 가격',btPx(e.px)],['비중',Math.round((e.w||0)*100)+'%'],['순위',(e.rank||1)+'위, 상승률을 가격 흔들림으로 나눈 점수 기준'],['최근 '+look+'일 상승률',mkPct0(e.mom,1)],['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']]},e); return; }\r\n      var pk2=lastPick[e.a], pkT=pk2?pkTxt(pk2):'떨어진 뒤 다시 올랐습니다';\r\n      push({k:'buy',tag:'매수',title:tk,chain:gate?1:0,cmp:gate?('오름세 '+e.up+' / '+e.of+', 기준 '+need):('하루 반등 '+mkPct0(e.bounce,1)),\r\n        why:gate?('오름세 종목이 '+e.of+'개 중 '+e.up+'개라 샀습니다'):('떨어진 뒤 하루 만에 '+mkPct0(e.bounce,1)+' 다시 올랐습니다'),\r\n        p0:[tk+' 하루 반등 '+mkPct0(e.bounce,1),pkT],p1:gate&&e.of?brd(e):null,p2:[tk+' 매수',gate?'기준을 넘어 샀습니다':'조건이 맞아 샀습니다'],ups:gate&&e.of?upsOf(e):null,\r\n        facts:(pk2?pkFacts(pk2,e):[]).concat([['하루 반등',mkPct0(e.bounce,1)+', 기준 0.5% 넘게'],['되돌림 점수',Math.round(e.rsi)+', 기준 '+c.rsiTh+' 아래']]).concat(gate&&e.of?[['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']]:[]).concat(c.fng!=null&&e.fng!=null?[['공포 탐욕 지수',e.fng+', 기준 '+c.fng+' 이하']]:[]).concat([['산 가격',btPx(e.px)]])},e); return; }\r\n    if(e.t==='exit'){ push({k:'sell',tag:'매도',title:tk,pnl:e.pnl,cmp:MK_WHY[e.why]||'',why:MK_WHY[e.why]||'',facts:[['판 가격',btPx(e.px)],['이 거래의 손익',mkPct0(e.pnl,1)],['판 이유',MK_WHY[e.why]||'']]},e); return; }\r\n    if(e.t==='veto'){ var pk3=lastPick[e.a];\r\n      push({k:'skip',tag:'보류',title:tk,chain:1,cmp:'오름세 '+e.up+' / '+e.of+', 기준 '+need,why:'오름세 종목이 '+e.of+'개 중 '+e.up+'개뿐이라 사지 않았습니다',\r\n        p0:[tk+' 하루 반등 '+mkPct0(e.bounce,1),pk3?pkTxt(pk3):'떨어진 뒤 다시 올랐습니다'],p1:brd(e),p2:['보류','기준에 못 미쳐 사지 않았습니다'],ups:upsOf(e),\r\n        facts:(pk3?pkFacts(pk3,e):[]).concat([['하루 반등',mkPct0(e.bounce,1)+', 기준 0.5% 넘게'],['되돌림 점수',Math.round(e.rsi)+', 기준 '+c.rsiTh+' 아래'],['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']])},e); return; }\r\n    if(e.t==='skip'){ var weak=e.why==='gate';\r\n      push({k:'skip',tag:'쉬어 감',title:'새로 사지 않음',cmp:weak?('오름세 '+e.up+' / '+e.of+', 기준 '+need):'살 만한 종목 없음',why:weak?('오름세 종목이 '+e.of+'개 중 '+e.up+'개뿐이라 시장이 약하다고 봤습니다'):'오름세이면서 충분히 강한 종목이 없었습니다',\r\n        p0:[n8+'종목 비교',top1(e)],p1:weak?brd(e):['살 만한 종목 0개','오름세이고 충분히 강해야 합니다'],p2:['새로 사지 않음',weak?'시장이 약해 쉬었습니다':'살 종목이 없어 쉬었습니다'],ups:upsOf(e),\r\n        facts:[['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상'],['쉬어 간 이유',weak?'오름세 종목이 기준보다 적었습니다':'오름세이면서 충분히 강한 종목이 없었습니다']].concat(e.held&&e.held.length?[['들고 있던 종목',e.held.map(mkTk).join(', ')]]:[])},e); return; }\r\n    if(e.t==='hold'){ push({k:'hold',tag:'유지',title:'그대로 유지',cmp:(e.held||[]).map(mkTk).join(', ')+' 보유',why:'이미 '+(e.held||[]).length+'종목을 들고 있어 그대로 뒀습니다',\r\n        p0:[n8+'종목 비교',top1(e)],p1:['빈자리 0개','이미 '+(e.held||[]).length+'종목 보유 중'],p2:['그대로 유지','보유 종목을 그대로 유지했습니다'],ups:upsOf(e),\r\n        facts:[['들고 있던 종목',(e.held||[]).map(mkTk).join(', ')],['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']]},e); }\r\n  });\r\n  /* AI 판단 전략: 재평가 한 번이 한 줄. 그날 산 종목, 유지, 쉬어 감을 결과로 적는다 */\r\n  var EV=[]; if(agent){ var byD={}; D.forEach(function(d){ if(d.k!=='buy'&&d.k!=='skip'&&d.k!=='hold') return; if(!byD[d.j]){ byD[d.j]={j:d.j,i:d.i,ds:[]}; EV.push(byD[d.j]); } byD[d.j].ds.push(d); });\r\n    EV.forEach(function(E,q){ var b=E.ds.filter(function(d){ return d.k==='buy'; }), f=E.ds[0]; E.ix=q; E.out=b.length?'buy':f.k; E.tag=b.length?'매수':f.tag; E.title=b.length?b.map(function(d){ return d.tk; }).join(', '):f.title; E.cmp=b.length===1?b[0].cmp:b.length?b.map(function(d){ return d.tk+' '+d.cmp; }).join(' / '):f.cmp; E.why=f.why; E.ups=f.ups; E.k=b.length?'buy':f.k; }); }\r\n  var op=r.state&&r.state.open?(r.state.open.length!=null?r.state.open:[r.state.open]):[];\r\n  var tr=(r.trades||[]).map(function(t){ return {id:t.id,a:t.asset,e:t.entry,x:t.exit,ep:t.ep,xp:t.xp,pnl:t.pnl*100,why:t.kind,cost:t.cost,got:t.got,fee:t.fee,days:t.exit-t.entry,side:t.side,lev:t.lev,fund:t.fund}; });\r\n  op.forEach(function(o){ tr.push({id:o.tid,a:o.k,e:o.entry,x:null,ep:o.ep,xp:o.px,pnl:o.pnl!=null?o.pnl:o.chg,why:null,cost:o.cost,got:null,fee:null,days:T-o.entry,open:1,side:o.side,lev:o.lev}); });\r\n  tr.sort(function(a,b){ return b.e-a.e; });\r\n  var wins=tr.filter(function(t){ return !t.open&&t.pnl>0; }), loss=tr.filter(function(t){ return !t.open&&t.pnl<=0; });\r\n  var avg=function(a){ return a.length?a.reduce(function(x,t){ return x+t.pnl; },0)/a.length:0; };\r\n  var rec=null, a0=Math.max(0,r.mddStartI-i0); for(var q=Math.max(0,r.mddEndI-i0);q<N;q++){ if(eq[q].v>=eq[a0].v){ rec=eq[q].i; break; } }\r\n  var nK=function(k){ return D.filter(function(d){ return d.k===k; }).length; };\r\n  BT.R={r:r,eq:eq,i0:i0,N:N,T:T,bench:bench,benchMdd:bmd*100,mon:mon,dd:dd,cnt:cnt,D:D,EV:EV,tr:tr,wins:wins,loss:loss,avgW:avg(wins),avgL:avg(loss),rec:rec,list:list,px:px,\r\n    nBuy:nK('buy'),nSkip:nK('skip'),nHold:nK('hold'),nOpp:agent?EV.length:nK('buy')+nK('skip'),ret:r.ret,mdd:r.mdd,n:r.n,win:r.winRate,benchRet:(bench[N-1]-1)*100,final:BT.amt*eq[N-1].v,benchFinal:BT.amt*bench[N-1]};\r\n  btPlan();\r\n  return BT.R;\r\n}"
    },
    "btPlain": {
      "declarations": 1,
      "sha256": "26018c5bfdcd7ad96f1dc071f8e5cae822f939ba25c198e163aa0607a12d6408",
      "code": "function btPlain(){\r\n  var R=BT.R, s=BT.s, c=s.cfg||{}, fut=!!c.fut, n=R.list.length, T=R.T, series=function(k){ return fut&&window.TETH_FUT&&TETH_FUT.sym[k]?TETH_FUT.sym[k].c:mkPx(k); };\r\n  var trOf=function(id){ var t=null; R.tr.forEach(function(x){ if(x.id===id) t=x; }); return t; };\r\n  R.D.forEach(function(d){ var e=d.e||{}, tk=d.tk, sd=d.side?(d.side>0?'롱':'숏'):'';\r\n    d.act=d.k==='buy'?(tk+' '+(fut?sd+' 진입':'매수')):d.k==='sell'?(tk+' '+(fut?sd+' 청산':'매도')):d.k==='pick'?(tk+(fut?' '+sd+' 후보':' 선정')):d.k==='hold'?'보유 유지':(tk?tk+' 보류':'쉬어 감');\r\n    if(fut){ d.say=String(d.why||'').replace(/어요\\.?$/,'습니다'); }\r\n    else if(d.k==='buy'){ d.say=s.kind==='agent'?(n+'종목을 비교한 순위에서 '+(e.rank||1)+'번째로 강해 자산의 '+Math.round((e.w||0)*100)+'%로 매수했습니다'):(btGate(s)&&e.of?(e.of+'종목 중 '+e.up+'종목이 오름세여서 반등 신호를 받아들였습니다'):('밀린 뒤 하루 '+mkPct0(e.bounce||0,1)+' 반등해 조건이 맞았습니다')); }\r\n    else if(d.k==='skip'&&d.tk){ d.say='반등 신호는 나왔지만 '+e.of+'종목 중 '+e.up+'종목만 오름세여서 기다렸습니다'; }\r\n    else if(d.k==='skip'){ d.say=e.why==='gate'?('오름세 종목이 '+e.of+'개 중 '+e.up+'개뿐이라 새로 사지 않았습니다'):'기준을 넘는 종목이 없어 새로 사지 않았습니다'; }\r\n    else if(d.k==='hold'){ d.say='보유 종목이 여전히 상위권이라 바꾸지 않았습니다'; }\r\n    else if(d.k==='pick'){ d.say='최근 '+c.look+'일 동안 가장 강해 거래 대상으로 골랐습니다'; }\r\n    else if(d.k==='sell'){ d.say=(MK_WHY_P[e.why]||'').replace(/다$/,'습니다').replace(/했습니다습니다$/,'했습니다').replace(/닿았습니다습니다$/,'닿았습니다'); }\r\n    d.out=null;\r\n    if(d.k==='buy'&&d.tid!=null){ var t=trOf(d.tid); if(t) d.out=t.open?{t:'보유 중',v:t.pnl}:{t:t.days+'일 뒤 '+(fut?'청산':'매도'),v:t.pnl}; }\r\n    else if(d.k==='sell'&&d.pnl!=null) d.out={t:'이 거래',v:d.pnl};\r\n    else if(d.k==='skip'&&d.a){ var P=series(d.a), q=Math.min(T,d.i+25); if(q>d.i) d.out={t:'그 뒤 '+(q-d.i)+'일',v:(P[q]/P[d.i]-1)*100,mute:1}; }\r\n  });\r\n}"
    },
    "btPlan": {
      "declarations": 1,
      "sha256": "fd11238767f89f765142cd7e98234a8b8d406f9c0615fc803a12dd058604aedf",
      "code": "function btPlan(){\r\n  var R=BT.R, s=BT.s, stops=[], by={};\r\n  R.D.forEach(function(d){ if(d.k!=='buy'&&d.k!=='skip'&&d.k!=='hold') return; if(!by[d.j]){ by[d.j]={j:d.j,ds:[]}; stops.push(by[d.j]); } by[d.j].ds.push(d); });\r\n  stops.sort(function(a,b){ return a.j-b.j; });\r\n  var ai=btAi(s), seenBuy=0, seenSkip=0, nBrief=0, gap=Math.max(2,Math.round(R.N/110)), imp={};\r\n  if(ai){ var cl=R.tr.filter(function(t){ return !t.open; }).slice().sort(function(a,b){ return a.pnl-b.pnl; }); if(cl.length>=4) [cl[0],cl[cl.length-1]].forEach(function(t){ R.D.forEach(function(d){ if(d.k==='buy'&&d.tid===t.id) imp[d.j]=1; }); }); }\r\n  stops.forEach(function(st,ix){ var hasBuy=st.ds.some(function(d){ return d.k==='buy'; }), hold=!hasBuy&&st.ds[0].k==='hold', sk=!hasBuy&&!hold, prev=stops[ix-1]; st.sk=sk; st.hold=hold; st.kind=hasBuy?'buy':hold?'hold':'skip';\r\n    if(hold){ st.dw=0; return; }\r\n    if((sk?!seenSkip:!seenBuy)||imp[st.j]){ st.full=1; st.t=ai?[900,1000,1300]:[900,0,1200]; st.dw=st.t[0]+st.t[1]+st.t[2]; if(sk) seenSkip=1; else seenBuy=1; }\r\n    else if(prev&&prev.dw>0&&!prev.full&&st.j-prev.j<=gap&&prev.sk===sk){ st.dw=0; }\r\n    else if(nBrief<7){ st.dw=ai?420:320; nBrief++; }\r\n    else st.dw=0; });\r\n  var bar=Math.max(4.5,Math.min(14,5200/R.N)), seg=[], t=0, pj=-1; /* 지나가는 날의 속도: 그래프가 자라는 것이 보일 만큼 */\r\n  /* 기회가 있는 날에는 멈춤 구간만 들어간다. 지나가는 구간은 그 전날까지 */\r\n  stops.forEach(function(st){ var to=st.dw>0?st.j-1:st.j; if(to>pj){ var dt=(to-pj)*bar; seg.push({k:'go',a:pj,b:to,t0:t,t1:t+dt}); t+=dt; pj=to; } if(st.dw>0){ seg.push({k:'stop',j:st.j,st:st,t0:t,t1:t+st.dw}); t+=st.dw; pj=st.j; } });\r\n  if(pj<R.N-1){ var d2=(R.N-1-pj)*bar; seg.push({k:'go',a:pj,b:R.N-1,t0:t,t1:t+d2}); t+=d2; }\r\n  R.seg=seg; R.runMs=t; R.prepMs=700; R.wrapMs=900; R.stops=stops;\r\n}"
    },
    "btGate": {
      "declarations": 1,
      "sha256": "e29cf4ef1775cf5af56eb4a316781e569c5c226d4700908f7895a4568b0aa20a",
      "code": "function btGate(s){ var c=s.cfg||{}; return s.kind==='mix'&&c.gate>0; }"
    },
    "btAi": {
      "declarations": 1,
      "sha256": "487e7cd4c369347c458941dd9da176834cc0e64767d044d49c3ee42cf65b7c9b",
      "code": "function btAi(s){ return btGate(s)||s.kind==='agent'; }"
    },
    "btNeed": {
      "declarations": 1,
      "sha256": "23fae3b30d676c372f376432d5e3a0f13c12435786e7e74c41feddea4f0eddb5",
      "code": "function btNeed(s){ var c=s.cfg||{}, n=mkUni(s).list.length; return Math.ceil((c.gate||0)*n); }"
    },
    "btUps": {
      "declarations": 1,
      "sha256": "f539ce410fb7cb8e8ad7eb47dcbeb9338c0ac680693599d285b0a98401cf0362",
      "code": "function btUps(list,px,i){ var o=[]; list.forEach(function(k,q){ var P=px[q]; if(i<60) return; var a=0; for(var z=i-59;z<=i;z++) a+=P[z]; if(P[i]>a/60) o.push(k); }); return o; }"
    },
    "btPx": {
      "declarations": 1,
      "sha256": "366a6348871b7ed2cf2bc71827d391d800dc416ffcb205edee2976e24e6b40dd",
      "code": "function btPx(v){ return '$'+mkPxFmt(v); }"
    },
    "btYMD": {
      "declarations": 1,
      "sha256": "591c96a505b2ac67a8a204e3b41b9643b5ccc0ff35de76949acb941a2d1e4b44",
      "code": "function btYMD(i){ return mkDate(i); }"
    },
    "fuBtDec": {
      "declarations": 1,
      "sha256": "19a40a002d6d15a4dff8136061ccddbda614af112259f372c612654c1a7d7a19",
      "code": "function fuBtDec(s,e,x){\r\n  var c=s.cfg, tk=e.a?mkTk(e.a):'', sd=e.side?fuSd(e.side):'', q=fuNeed(c,x.n8), lv=(e.lev>1?e.lev+'배':'1배');\r\n  var brd=e.up!=null?['오름세 '+e.up+' / '+e.of+'개',(e.side>0?'롱 기준 '+q.L+'개 이상':'숏 기준 '+q.S+'개 이하')]:null;\r\n  var tops=function(){ return (e.top||[]).length?'강한 쪽 '+mkTk(e.top[0].k)+' '+mkPct0(e.top[0].mom,0)+', 약한 쪽 '+((e.bot||[])[0]?mkTk(e.bot[0].k)+' '+mkPct0(e.bot[0].mom,0):'-'):''; };\r\n  var liq=(e.liq>0&&isFinite(e.liq))?btPx(e.liq):'없음';\r\n  if(e.t==='unpick') return null;\r\n  if(e.t==='pick') return {k:'pick',tag:'선정',title:tk+' '+sd+' 후보',side:e.side,cmp:'오름세 '+e.up+' / '+e.of+', '+c.look+'일 '+mkPct0(e.mom,1),why:'AI가 시장 방향을 '+sd+'으로 보고 '+(e.side>0?'가장 강한':'가장 약한')+' 종목을 골랐습니다',\r\n    facts:[['오름세 종목',e.of+'개 중 '+e.up+'개'],['강한 쪽',(e.top||[]).map(function(t){ return mkTk(t.k)+' '+mkPct0(t.mom,0); }).join(', ')],['약한 쪽',(e.bot||[]).map(function(t){ return mkTk(t.k)+' '+mkPct0(t.mom,0); }).join(', ')]]};\r\n  if(e.t==='veto'){ var sg=fuBtSig(c,e,tk); return {k:'skip',tag:'보류',title:tk+' '+sd,side:e.side,chain:1,cmp:'AI가 본 방향과 반대',why:sd+' 신호가 나왔지만 AI가 본 시장 방향과 달라 진입하지 않았습니다',\r\n    p0:sg,p1:['오름세 '+e.up+' / '+e.of+'개','AI가 본 방향은 '+(e.reg>0?'롱':e.reg<0?'숏':'쉼')],p2:['보류','방향이 달라 진입하지 않았습니다'],ups:x.upsOf(e),\r\n    facts:[['규칙 신호',sd+', '+sg[0]],['AI가 본 방향',e.reg>0?'롱':e.reg<0?'숏':'쉼'],['오름세 종목',e.of+'개 중 '+e.up+'개']]}; }\r\n  if(e.t==='skip') return {k:'skip',tag:'쉬어 감',title:'새로 진입하지 않음',cmp:'오름세 '+e.up+' / '+e.of+', 방향 애매',why:'오름세 종목이 '+e.of+'개 중 '+e.up+'개라 롱도 숏도 기준에 못 미쳤습니다',\r\n    p0:[x.n8+'종목 비교',tops()],p1:['오름세 '+e.up+' / '+e.of+'개','롱 '+q.L+'개 이상, 숏 '+q.S+'개 이하'],p2:['새로 진입하지 않음','방향이 애매해 쉬었습니다'],ups:x.upsOf(e),\r\n    facts:[['오름세 종목',e.of+'개 중 '+e.up+'개'],['기준','롱은 '+q.L+'개 이상, 숏은 '+q.S+'개 이하']].concat((e.held||[]).length?[['들고 있던 포지션',e.held.map(mkTk).join(', ')]]:[])};\r\n  if(e.t==='hold') return {k:'hold',tag:'유지',title:'그대로 유지',cmp:(e.held||[]).map(mkTk).join(', ')+' 유지',why:'든 포지션이 여전히 조건에 맞아 그대로 뒀습니다',\r\n    p0:[x.n8+'종목 비교',tops()],p1:['오름세 '+e.up+' / '+e.of+'개','방향 유지'],p2:['그대로 유지','포지션을 바꾸지 않았습니다'],ups:x.upsOf(e),\r\n    facts:[['들고 있던 포지션',(e.held||[]).map(mkTk).join(', ')],['오름세 종목',e.of+'개 중 '+e.up+'개']]};\r\n  if(e.t==='enter'){\r\n    if(c.kind==='agent') return {k:'buy',tag:sd+' 진입',title:tk,side:e.side,cmp:(e.side>0?'강한 쪽 ':'약한 쪽 ')+e.rank+'위, '+c.look+'일 '+mkPct0(e.mom,1),why:'AI가 시장 방향을 '+sd+'으로 보고 '+(e.side>0?'강한':'약한')+' 쪽 '+e.rank+'번째 종목에 진입했습니다',\r\n      p0:[x.n8+'종목 비교',tops()],p1:brd,p2:[tk+' '+sd+' 진입',lv+', 다음 날 시가'],ups:x.upsOf(e),\r\n      facts:[['진입 가격',btPx(e.px)],['비중',Math.round((e.w||0)*100)+'%'],['방향과 배수',sd+' '+lv],['강제 청산 가격',liq],['순위',(e.side>0?'강한 쪽 ':'약한 쪽 ')+e.rank+'위, '+c.look+'일 '+mkPct0(e.mom,1)],['오름세 종목',e.of+'개 중 '+e.up+'개']]};\r\n    var s1=fuBtSig(c,e,tk), mix=c.kind==='mix';\r\n    return {k:'buy',tag:sd+' 진입',title:tk,side:e.side,chain:mix?1:0,cmp:s1[0].replace(tk+' ',''),why:s1[0]+'. '+s1[1],\r\n      p0:s1,p1:mix?brd:null,p2:[tk+' '+sd+' 진입',lv+', 다음 날 시가'],ups:mix?x.upsOf(e):null,\r\n      facts:[['신호',s1[0]+(s1[1]?', '+s1[1]:'')]].concat(mix&&e.up!=null?[['오름세 종목',e.of+'개 중 '+e.up+'개']]:[]).concat([['진입 가격',btPx(e.px)],['방향과 배수',sd+' '+lv],['강제 청산 가격',liq]])}; }\r\n  return {k:'sell',tag:sd+' 청산',title:tk,side:e.side,pnl:e.pnl,cmp:FU_WHY[e.why]||'',why:FU_WHY[e.why]||'',\r\n    facts:[['청산 가격',btPx(e.px)],['진입 가격',btPx(e.ep)],['이 거래의 손익',mkPct0(e.pnl,1)+', 넣은 돈 기준'],['청산한 이유',FU_WHY[e.why]||''],['낸 펀딩비',mkPct0(-(e.fund||0)/(e.cost||1)*100,1)]]};\r\n}"
    },
    "fuBtSig": {
      "declarations": 1,
      "sha256": "bbae8cd6377af9ee7adde2e5d95e56f42f2a4612512a9fa8356414045c1750d9",
      "code": "function fuBtSig(c,e,tk){ var up=e.side>0;\r\n  if(c.mode==='brk') return [tk+' '+c.n+'일 '+(up?'최고가 돌파':'최저가 이탈'),e.ref?('기준 $'+mkPxFmt(e.ref)+'를 종가로 '+(up?'넘었습니다':'벗어났습니다')):''];\r\n  if(c.mode==='ma') return [tk+' 평균선 '+(up?'위로':'아래로')+' 교차',c.fast+'일 평균이 '+c.slow+'일 평균을 '+(up?'넘었습니다':'밑돌았습니다')];\r\n  if(c.mode==='dip') return [tk+(up?' 밀린 뒤 반등':' 오른 뒤 꺾임'),'하루 '+mkPct0(e.chg1||0,1)];\r\n  if(c.mode==='fg') return [tk+(up?' 공포 구간 반등':' 과열 구간 꺾임'),'공포 탐욕 지수 '+(e.fng!=null?e.fng:'-')];\r\n  return [tk,'']; }"
    },
    "fuSd": {
      "declarations": 1,
      "sha256": "e5379846c9b5b641e98724aa8f543a1a1d80b08b490009e69597d17461effc25",
      "code": "function fuSd(v){ return v>0?'롱':'숏'; }"
    },
    "fuNeed": {
      "declarations": 1,
      "sha256": "228012941539bf85733016d8a9dd8e962e6a7d6ab9aac5c8557419e370ec6e74",
      "code": "function fuNeed(c,n){ return {L:Math.ceil(c.gate*n-1e-9),S:Math.floor((1-c.gate)*n+1e-9)}; }"
    },
    "mkPxFmt": {
      "declarations": 1,
      "sha256": "825aff492b9564eee156a5b369f66200df1a97ed5eccf296adac3f3d4ac6aab7",
      "code": "function mkPxFmt(v){ if(v==null||!isFinite(v)) return '-'; var a=Math.abs(v); return a>=1000?Math.round(v).toLocaleString():a>=100?v.toFixed(1):a>=1?v.toFixed(2):v.toFixed(4); }"
    },
    "mkTk": {
      "declarations": 1,
      "sha256": "e7af7c75272371e69f8c102c5204166e166bce9ee7a04c6b3ea4fc1ece0fcf7b",
      "code": "function mkTk(k){ return MK_TK[k]||k; }"
    },
    "mkPct0": {
      "declarations": 1,
      "sha256": "9284c8d3df0c5936e70a8c8cef3bb8350bd68786f18fc0c302bfcdc07f2b8549",
      "code": "function mkPct0(v,d){ var n=d!=null?d:1, x=+v.toFixed(n); return (x>0?'+':'')+x.toFixed(n)+'%'; }"
    },
    "mkDate": {
      "declarations": 1,
      "sha256": "c72b3b731d61b9ee5d69fb980d488afb3dfdfaf46b74d16419502c710ea71fd0",
      "code": "function mkDate(i){ var d=idxToDate(i); return d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0'); }"
    },
    "mkUni": {
      "declarations": 1,
      "sha256": "6289d40d2eceea40117ae91ac507fa59b2a4941cd495e31dcadc5a087c9cbf69",
      "code": "function mkUni(s){ return MK_UNI[s.uni]||{label:s.asset||'',list:s.asset?[s.asset]:[]}; }"
    },
    "idxToDate": {
      "declarations": 1,
      "sha256": "6b13ed9c1c2ebed0aa8b96391fe1e6c4dedf56a2bd00eca3345ad479d5b446f2",
      "code": "function idxToDate(i){ var dk=MK_ASOF.join('-')+'|'+PRICE0.length+'|'+MK_DATA_V; if(!MK_D0||MK_D0K!==dk){ MK_D0K=dk; MK_D0=new Date(MK_ASOF[0],MK_ASOF[1]-1,MK_ASOF[2]); MK_D0.setDate(MK_D0.getDate()-(PRICE0.length-1)); } var t=new Date(MK_D0.getTime()); t.setDate(t.getDate()+i); return t; }"
    },
    "btDecList": {
      "declarations": 2,
      "sha256": "38b3e7ebbbb62dcebe2a7e3d89dd7a3936d943c8cdd5a4b2ad8eb4fe59de3858",
      "code": "function btDecList(f){\r\n  var s=BT.s, R=BT.R, L;\r\n  if(f==='opp') L=(s.kind==='agent'?R.EV.map(function(E){ return {ev:E}; }):R.D.filter(function(d){ return d.k==='buy'||d.k==='skip'; }).map(function(d){ return {d:d}; }));\r\n  else L=R.D.filter(function(d){ return f==='all'?(d.k!=='pick'||s.kind==='mix'):d.k===f; }).map(function(d){ return {d:d}; });\r\n  var so=BT.sort||'new', key=function(x){ return (x.d||x.ev).i; }, imp=function(x){ var d=x.d; return d&&d.out&&!d.out.mute?Math.abs(d.out.v):d&&d.pnl!=null?Math.abs(d.pnl):-1; };\r\n  if(so==='old') L.sort(function(a,b){ return key(a)-key(b); }); else if(so==='big') L.sort(function(a,b){ return imp(b)-imp(a)||key(b)-key(a); }); else L.sort(function(a,b){ return key(b)-key(a); });\r\n  return L;\r\n}"
    },
    "btDecRows": {
      "declarations": 2,
      "sha256": "6be5dee4d9c60f9fc136c2e3dbd35210cb4e19bd2a90577efb507a64f8ec70b1",
      "code": "function btDecRows(){\r\n  var L=btDecList(BT.filt), n=L.length, N=Math.max(BT_PAGE,BT.decN||BT_PAGE), so=BT.sort||'new', out='', ym='';\r\n  if(!n) return '<p class=\"bt-none\">이 종류의 판단은 없었습니다</p>';\r\n  L.slice(0,N).forEach(function(x){ var d=x.d||x.ev, dt=idxToDate(d.i), k=dt.getFullYear()+'년 '+(dt.getMonth()+1)+'월'; if(so!=='big'&&k!==ym){ ym=k; var c=0; L.forEach(function(y){ var t=idxToDate((y.d||y.ev).i); if(t.getFullYear()===dt.getFullYear()&&t.getMonth()===dt.getMonth()) c++; }); out+='<div class=\"bt-ym\"><b>'+k+'</b><span class=\"num\">'+c+'건</span></div>'; } out+=btRowHtml(x); });\r\n  return out+(n>N?'<button type=\"button\" class=\"bt-more\" onclick=\"BT.decN='+(N+BT_PAGE*2)+';btEvRe()\">이전 판단 더 보기 <i class=\"num\">'+N+' / '+n+'</i></button>':(n>BT_PAGE?'<p class=\"bt-end num\">'+n+'건을 모두 봤습니다</p>':''));\r\n}"
    },
    "btMarkClick": {
      "declarations": 1,
      "sha256": "c6e47da4cf6215e480ed0de45af944faa244fe396762272d41ce93da359bf93c",
      "code": "function btMarkClick(ix,ix2){\r\n  if(BT.phase!=='result') return; var d=BT.R.D[ix]; if(!d) return;\r\n  BT.grp=ix2>ix?{a:ix,b:ix2}:null;\r\n  if(BT.grp) BT.filt='skip'; else if(btRowAt(btDecList(BT.filt),d)<0) BT.filt=d.k==='sell'?'all':btDefFilt(BT.s);\r\n  var L=btDecList(BT.filt), at=btRowAt(L,d); if(BT.grp){ var last=btRowAt(L,BT.R.D[ix2]); at=Math.max(at,last); } if(at>=BT.decN) BT.decN=at+3;\r\n  var row=L[btRowAt(L,d)]; BT.sel=row&&row.ev?{t:'e',ix:row.ev.ix,j:d.j}:{t:'d',ix:ix,j:d.j};\r\n  var e=$('bt-ev'); if(e) e.innerHTML=btEvidence(); btPin();\r\n  var el=document.querySelector('.bt-row.on'); if(el) try{ el.scrollIntoView({block:'center',behavior:'smooth'}); }catch(x){}\r\n}"
    },
    "btDefFilt": {
      "declarations": 1,
      "sha256": "1945fda90495e7ec522fbdf99e2c36ee3309806fe885dae5cb4e0a1d279e4324",
      "code": "function btDefFilt(s){ return btAi(s)?'opp':'all'; }"
    },
    "btRowAt": {
      "declarations": 1,
      "sha256": "9e50ee9639de10fdd3cc322a69777e53c3bd561e1df3eec7dca00097f7a7760c",
      "code": "function btRowAt(L,d){ for(var i=0;i<L.length;i++){ if(L[i].d===d) return i; if(L[i].ev&&L[i].ev.j===d.j) return i; } return -1; }"
    },
    "btMini": {
      "declarations": 1,
      "sha256": "78aeeb8796eed6d1cb54b8b1e257c937783aa399e4d98965f3092f8372fb1169",
      "code": "function btMini(a,i1,i2,marks,lines,hold){\r\n  var P=mkPx(a), T=PRICE0.length-1, lo=Math.max(0,i1), hi=Math.min(T,i2), W=400, H=176, pl=6, pr=78, pt=22, pb=26, v=[]; for(var i=lo;i<=hi;i++) v.push(P[i]);\r\n  var ex=v.concat((lines||[]).map(function(l){ return l[0]; })), mn=Math.min.apply(null,ex), mx=Math.max.apply(null,ex), pad=(mx-mn)*0.12||1; mn-=pad; mx+=pad;\r\n  var X=function(i){ return pl+(i-lo)/Math.max(1,hi-lo)*(W-pl-pr); }, Y=function(p){ return pt+(1-(p-mn)/(mx-mn))*(H-pt-pb); }, d='';\r\n  v.forEach(function(p,k){ d+=(k?' L':'M')+X(lo+k).toFixed(1)+' '+Y(p).toFixed(1); });\r\n  var hs=''; if(hold){ var hx=X(Math.max(lo,hold[0])), hw=Math.max(2,X(Math.min(hi,hold[1]))-hx); hs='<rect x=\"'+hx.toFixed(1)+'\" y=\"'+pt+'\" width=\"'+hw.toFixed(1)+'\" height=\"'+(H-pt-pb)+'\" fill=\"rgba(255,255,255,.06)\"/>'; }\r\n  var ax=(lines&&lines.length)?'':[mx-pad,mn+pad].map(function(p){ return '<text x=\"'+(W-pr+8)+'\" y=\"'+(Y(p)+4).toFixed(1)+'\" font-size=\"12\" fill=\"#8b9096\">'+mkPxFmt(p)+'</text>'; }).join('');\r\n  return '<svg class=\"bt-mini\" viewBox=\"0 0 '+W+' '+H+'\" role=\"img\" aria-label=\"'+gEsc(a)+' 가격\">'+hs+'<path d=\"'+d+'\" fill=\"none\" stroke=\"rgba(255,255,255,.72)\" stroke-width=\"1.5\" stroke-linejoin=\"round\"/>'\r\n    +(lines||[]).map(function(l){ var y=Y(l[0]); return '<line x1=\"'+pl+'\" x2=\"'+(W-pr)+'\" y1=\"'+y.toFixed(1)+'\" y2=\"'+y.toFixed(1)+'\" stroke=\"'+l[2]+'\" stroke-dasharray=\"3 4\" stroke-opacity=\".7\"/><text x=\"'+(W-pr+8)+'\" y=\"'+(y+4).toFixed(1)+'\" font-size=\"12\" fill=\"'+l[2]+'\">'+l[1]+'</text>'; }).join('')+ax\r\n    +marks.map(function(m){ if(m[0]<lo||m[0]>hi) return ''; var x=X(m[0]), y=Y(P[m[0]]), ty=y-12<pt-4?y+22:y-12; return '<circle cx=\"'+x.toFixed(1)+'\" cy=\"'+y.toFixed(1)+'\" r=\"5\" fill=\"'+m[2]+'\" stroke=\"#15171a\" stroke-width=\"2\"/><text x=\"'+x.toFixed(1)+'\" y=\"'+ty.toFixed(1)+'\" text-anchor=\"middle\" font-size=\"12.5\" font-weight=\"600\" fill=\"'+m[2]+'\">'+m[1]+'</text>'; }).join('')\r\n    +'<text x=\"'+pl+'\" y=\"'+(H-7)+'\" font-size=\"12\" fill=\"#8b9096\">'+btYMD(lo).slice(2)+'</text><text x=\"'+(W-pr)+'\" y=\"'+(H-7)+'\" text-anchor=\"end\" font-size=\"12\" fill=\"#8b9096\">'+btYMD(hi).slice(2)+'</text></svg>';\r\n}"
    },
    "btTradeMini": {
      "declarations": 1,
      "sha256": "03e4f12536d37010e9a5010225e4e41671493db0ac18b96e8f0707ed7f714f1a",
      "code": "function btTradeMini(t){\r\n  var c=BT.s.cfg||{};\r\n  return btMini(t.a,t.e-14,(t.x!=null?t.x:BT.R.T)+10,[[t.e,'매수','#2fb98a']].concat(t.x!=null?[[t.x,'매도',t.pnl>=0?'#2fb98a':'#f0566a']]:[]),BT.s.kind==='agent'?[]:(c.tp!=null?[[t.ep*(1+c.tp/100),'목표 +'+c.tp+'%','#2fb98a']]:[]).concat([[t.ep*(1+c.sl/100),'손절 '+c.sl+'%','#f0566a']]),[t.e,t.x!=null?t.x:BT.R.T]);\r\n}"
    },
    "fuTradeMini": {
      "declarations": 1,
      "sha256": "e7876e0b2970679f1ef3663f657b8eafbe03944fc1129a36052f98882442148f",
      "code": "function fuTradeMini(t){ var c=BT.s.cfg, sd=fuSd(t.side);\r\n  return btMini(t.a,t.e-14,(t.x!=null?t.x:BT.R.T)+10,[[t.e,sd+' 진입',t.side>0?'#2fb98a':'#b08cf5']].concat(t.x!=null?[[t.x,'청산',t.pnl>=0?'#2fb98a':'#f0566a']]:[]),c.sl?[[t.ep*(1-t.side*c.sl/100),'손절 '+c.sl+'%','#f0566a']]:[],[t.e,t.x!=null?t.x:BT.R.T]); }"
    },
    "btSelDec": {
      "declarations": 1,
      "sha256": "1c8cbe07967f7a6ee37f5ad8d8bad75349a8a3c08dbfbef42fd41fbf69727780",
      "code": "function btSelDec(ix){ var d=BT.R.D[ix]; BT.sel=(BT.sel&&BT.sel.t==='d'&&BT.sel.ix===ix)?null:{t:'d',ix:ix,j:d.j}; btEvRe(); }"
    },
    "btSelEv": {
      "declarations": 1,
      "sha256": "b52b8a23c1b78019a57bb33565646b7c507606e14ddb1007ecd7fca8b6f58620",
      "code": "function btSelEv(ix){ var E=BT.R.EV[ix]; BT.sel=(BT.sel&&BT.sel.t==='e'&&BT.sel.ix===ix)?null:{t:'e',ix:ix,j:E.j}; btEvRe(); }"
    },
    "btMarkList": {
      "declarations": 1,
      "sha256": "89d82cb531fdc2b49ac9cbae82cb2a06a2e20e2840dbd2b028029d5d072c8199",
      "code": "function btMarkList(group){\r\n  var R=BT.R, G=BT.G, out=[], last=null, lastB=null;\r\n  R.D.forEach(function(d){ if(d.k==='pick'||d.k==='hold') return;\r\n    if(group&&d.k==='skip'&&last&&G.X(d.j)-G.X(last.j2)<12){ last.n++; last.j2=d.j; last.ix2=d.ix; return; }\r\n    if(d.k==='buy'&&lastB&&lastB.j===d.j){ lastB.n++; lastB.t+=', '+d.tk; return; }\r\n    var m={k:d.k,side:d.side,j:d.j,j2:d.j,ix:d.ix,ix2:d.ix,n:1,pnl:d.pnl,t:(d.tk?d.tk+' ':'')+d.tag}; out.push(m); if(d.k==='skip'){ last=m; } else if(d.k==='buy'){ last=null; lastB=m; } });\r\n  return out;\r\n}"
    },
    "FU_WHY": {
      "declarations": 1,
      "sha256": "28abebf54ab95bdcb7a125bd38a2fc50e8c7ac330fe43bf85e89c1b59489c7e3",
      "code": "var FU_WHY={sl:'진입가에서 손절 기준만큼 불리하게 움직였습니다',trail:'가장 유리했던 가격에서 기준만큼 되돌렸습니다',tp:'목표까지 움직였습니다',time:'보유 기한을 채웠습니다',chan:'추세가 꺾였습니다',flip:'반대 방향 신호가 나왔습니다',liq:'증거금이 바닥나 강제 청산됐습니다',rot:'순위에서 밀렸습니다',rest:'시장 방향이 애매해 쉬기로 했습니다'};"
    },
    "MK_TK": {
      "declarations": 1,
      "sha256": "8bdb5ed4c7d199414f812ffce0019d4ff75c68e3dc9bb77a576acc08f9c88d0b",
      "code": "var MK_TK={'비트코인':'BTC','이더리움':'ETH','솔라나':'SOL','리플':'XRP','도지코인':'DOGE','에이다':'ADA','아발란체':'AVAX','비앤비':'BNB','테슬라':'TSLA','엔비디아':'NVDA','애플':'AAPL','마이크로소프트':'MSFT','아마존':'AMZN','메타':'META','알파벳':'GOOGL','에이엠디':'AMD'};"
    },
    "MK_ASOF": {
      "declarations": 1,
      "sha256": "f888dc9e463751a7d3bdf9210b6e98af20c919b56d5a975301d0e618e200a4f6",
      "code": "var MK_ASOF=window.TETH_PX?TETH_PX.asof.split('-').map(Number):[2026,9,28];"
    },
    "MK_DATA_V": {
      "declarations": 1,
      "sha256": "cbfccf59371a29ecbe62aa9eb1a24fdd8eb02daecb17cb8dc502f83f63f89e15",
      "code": "var MK_DATA_V=window.TETH_PX?TETH_PX.v:'2026-09-28.1';"
    },
    "MK_D0": {
      "declarations": 1,
      "sha256": "b81cba134b4bc921b4c74fc596aee6eb2956da209fd775679a57ffe7a9c51c7d",
      "code": "var MK_D0=null;"
    },
    "MK_D0K": {
      "declarations": 1,
      "sha256": "147647c1d630b77cdef275b1b4ede8f0ca472528677ec026f67934eb41b8b051",
      "code": "var MK_D0K='';"
    },
    "MK_WHY": {
      "declarations": 1,
      "sha256": "e5f0e6cf45e4f1343e6e3cf076bc98cad1945e25f1d158f715e1ad17336068fc",
      "code": "var MK_WHY={trail:'든 뒤 고점에서 많이 밀렸습니다',weak:'오르던 힘이 꺾였습니다',rot:'순위에서 많이 밀렸습니다',sl:'손절 기준까지 밀렸습니다',tp:'목표까지 올랐습니다',time:'25일을 채웠습니다'};"
    },
    "MK_WHY_P": {
      "declarations": 1,
      "sha256": "7361e991ab547c1f8ec741dd9151abe100e821140fe7f9788ecbb0652c313988",
      "code": "var MK_WHY_P={trail:'진입 후 고점 대비 하락 폭이 추적 손절 기준에 닿았다',weak:'모멘텀이 꺾였다',rot:'상위 종목에 순위가 밀렸다',sl:'손절 기준에 도달했다',tp:'익절 목표에 도달했다',time:'보유 25일이 지나 기간 만료로 청산했다'};"
    },
    "BT_PAGE": {
      "declarations": 1,
      "sha256": "66c11f579f90ef042dcf97d2e2557c9d69fc49463c86fe636c55ae2abf3047a5",
      "code": "var BT_PAGE=12;"
    }
  }
} as const

export type SourceDecision = Omit<CatalogueEvidenceDecision, 'runId' | 'eventIndex'> & { e: CatalogueBacktestObservation['result']['events'][number] }
export type SourceDailyGroup = Omit<CatalogueEvidenceDailyGroup, 'runId' | 'decisionIndices'> & { ds: SourceDecision[] }
export type SourceRow = { d?: SourceDecision; ev?: SourceDailyGroup }
export type SourceMarker = { k: string; j: number; j2: number; ix: number; ix2: number; n: number; t: string }
export function createCatalogueEvidenceOracle(value: CatalogueBacktestObservation) {
  for (const item of Object.values(frozen.functions)) {
    if (createHash('sha256').update(item.code).digest('hex') !== item.sha256) throw Error('Frozen source oracle changed')
  }
  if (frozen.functions.btDecList.declarations !== 2 || frozen.functions.btDecRows.declarations !== 2) throw Error('Final override not selected')
  const context = vm.createContext({
    TETH_PX: spot, TETH_FUT: future, PRICE0: spot.px['비트코인'], MK_UNI: source.universes,
    window: { TETH_PX: spot, TETH_FUT: future },
    mkPx: (asset: keyof typeof spot.px) => spot.px[asset],
    mkRunCfg: () => value.result,
    BT: { s: { ...value.strategy, cfg: value.strategy }, per: value.period, amt: value.amount, phase: 'result', decN: 12, sort: 'new', filt: 'all', sel: null, grp: null },
    $: () => null, document: { querySelector: () => null },
    btPin: () => {}, btEvRe: () => {},
    btRowHtml: (row: SourceRow) => `ROW:${row.ev ? 'e' : 'd'}:${(row.ev ?? row.d)!.ix};`,
    gEsc: (text: string) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
  })
  vm.runInContext(Object.values(frozen.functions).map(item => item.code).join('\n'), context, { timeout: 1000 })
  vm.runInContext('btCompute(); btPlain(); BT.filt=btDefFilt(BT.s)', context, { timeout: 1000 })
  const decisions = vm.runInContext('BT.R.D', context) as SourceDecision[]
  const groups = vm.runInContext('BT.R.EV', context) as SourceDailyGroup[]
  return {
    sourceSha: frozen.source, decisions, groups,
    trades: vm.runInContext('BT.R.tr', context) as { id: number; a: string; e: number; x: number | null; cost: number }[],
    list(filter = 'all', sort = 'new'): SourceRow[] {
      context.oracleFilter = filter; context.oracleSort = sort
      return vm.runInContext('BT.sort=oracleSort; btDecList(oracleFilter)', context) as SourceRow[]
    },
    page(filter = 'all', sort = 'new', count = 12): string {
      Object.assign(context, { oracleFilter: filter, oracleSort: sort, oracleCount: count })
      return vm.runInContext('BT.filt=oracleFilter; BT.sort=oracleSort; BT.decN=oracleCount; btDecRows()', context)
    },
    markers(width: number): SourceMarker[] {
      context.oracleWidth = width
      return vm.runInContext('BT.G={X:function(j){return 46+j/Math.max(1,BT.R.N-1)*(oracleWidth-54)}}; btMarkList(true)', context)
    },
    mini(decisionIndex: number): string {
      context.oracleIndex = decisionIndex
      return vm.runInContext(`(function(){var d=BT.R.D[oracleIndex],t=BT.R.tr.find(function(t){return t.id===d.tid;});if(t)return BT.s.cfg.fut?fuTradeMini(t):btTradeMini(t);return d.a?btMini(d.a,d.i-25,d.i+25,[[d.i,d.k==='skip'?'보류':d.tag,d.k==='skip'?'#f0b840':'#9aa0a6']],[],null):'';})()`, context)
    },
    selectMarker(index: number, end = index) {
      Object.assign(context, { oracleIndex: index, oracleEnd: end })
      return vm.runInContext('btMarkClick(oracleIndex,oracleEnd); JSON.parse(JSON.stringify({filter:BT.filt,sort:BT.sort,count:BT.decN,selected:BT.sel,group:BT.grp}))', context) as { filter: string; sort: string; count: number; selected: { t: string; ix: number; j: number }; group: { a: number; b: number } | null }
    },
  }
}
