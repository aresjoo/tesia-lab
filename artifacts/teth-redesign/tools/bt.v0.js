/* ═══ 백테스트 여정 (bt): 준비 → 과거 다시 돌리기 → 결과 → 실행 방법 → 연결 ═══
   한 화면, 한 그래프. 기다리는 동안 그린 그래프가 그대로 결과가 된다.
   수치는 모두 카탈로그 엔진(mkRunCfg)이 고른 기간으로 실제 계산한 값이다 */
var BT={id:null,s:null,per:365,amt:1000,phase:'ready',R:null,raf:0,t0:0,ph:-1,j:-1,fed:0,last:0,sel:null,filt:'all',ordN:8,decN:8,W:0};
var BT_PER=[[90,'최근 3개월'],[365,'최근 1년'],[730,'최근 2년'],[0,'전체 기간']];
var BT_AMT=[500,1000,3000,10000];
var BT_T=[1300,9000,1100,1500,900]; /* 준비, 다시 돌리기, 계산, 나빴던 구간, 정리 (ms) */
function btUsd(v,d){ return (d?v.toFixed(d):Math.round(v).toLocaleString())+' USDT'; }
function btPerL(){ for(var i=0;i<BT_PER.length;i++) if(BT_PER[i][0]===BT.per) return BT_PER[i][1]; return '전체 기간'; }
function btYMD(i){ return mkDate(i); }
function btGate(s){ var c=s.cfg||{}; return s.kind==='mix'&&c.gate>0; }
function btNeed(s){ var c=s.cfg||{}, n=mkUni(s).list.length; return Math.ceil((c.gate||0)*n); }

/* 전략이 하는 일을 쉬운 말로 (준비 화면의 "TETH가 채운 것") */
function btRules(s){
  var c=s.cfg||{}, u=mkUni(s), n=u.list.length, o=[];
  if(s.kind==='agent'){
    o.push(['종목 고르기','AI가 '+c.every+'일마다 '+u.label+'을 비교해 최대 '+c.top+'종목']);
    o.push(['쉬는 때','오름세 종목이 '+n+'개 중 '+btNeed(s)+'개 미만이면 새로 사지 않음']);
    o.push(['파는 때','든 뒤 가장 높았던 가격에서 '+c.trail+'% 밀리면']);
  } else {
    if(s.kind==='mix') o.push(['종목 고르기','AI가 '+c.every+'일마다 '+u.label+' 중 가장 강한 하나']);
    o.push(['사는 때','많이 떨어진 뒤 하루 만에 다시 오르면'+(c.tf?', 오름세일 때만':'')]);
    if(btGate(s)) o.push(['AI 보류','조건이 맞아도 오름세 종목이 '+n+'개 중 '+btNeed(s)+'개 미만이면 사지 않음']);
    o.push(['파는 때','+'+c.tp+'% 오르거나 '+c.sl+'% 내리면, 또는 25일이 지나면']);
  }
  o.push(['판단 시점','하루 한 번, 그날 마지막 가격으로']);
  o.push(['비용','살 때와 팔 때마다 수수료 0.1%']);
  return o;
}

/* ── 계산: 고른 기간으로 엔진을 돌리고, 화면이 쓰는 값을 한 번에 만든다 ── */
function btCompute(){
  var s=BT.s, c=s.cfg, T=PRICE0.length-1, min=c.startI!=null?c.startI:61, st=BT.per?Math.max(min,T-BT.per):min;
  var r=mkRunCfg(c,st), eq=r.eq, i0=eq[0].i, N=eq.length, list=mkUni(s).list, px=list.map(function(k){ return mkPx(k); });
  var bench=eq.map(function(p){ var a=0; px.forEach(function(P){ a+=P[p.i]/P[i0]; }); return a/px.length; });
  var mon=[], cur=null;
  eq.forEach(function(p,j){ var d=idxToDate(p.i), k=d.getFullYear()*12+d.getMonth(); if(!cur||cur.k!==k){ if(cur) mon.push(cur); cur={k:k,y:d.getFullYear(),m:d.getMonth()+1,base:j?eq[j-1].v:1,last:p.v,days:0}; } cur.last=p.v; cur.days++; });
  if(cur) mon.push(cur); mon.forEach(function(m){ m.ret=(m.last/m.base-1)*100; });
  var ev=(r.events||[]), cnt={enter:0,exit:0,veto:0,skip:0,pick:0,hold:0,unpick:0}; ev.forEach(function(e){ if(cnt[e.t]!=null) cnt[e.t]++; });
  var look=c.look, D=[];
  ev.forEach(function(e,ix){
    var tk=e.a?mkTk(e.a):'', d=null;
    if(e.t==='enter'){
      d={k:'buy',tag:'매수',title:tk+' 매수',why:s.kind==='agent'?('최근 '+look+'일 동안 '+mkPct0(e.mom,0)+' 올라 '+(e.rank||1)+'번째로 강했어요'):('떨어진 뒤 하루 만에 '+mkPct0(e.bounce,1)+' 다시 올랐어요'),
        facts:s.kind==='agent'?[['산 가격',mkPxU(e.a,e.px)],['비중',Math.round((e.w||0)*100)+'%'],['오름세 종목',e.of+'개 중 '+e.up+'개'],['최근 '+look+'일 상승률',mkPct0(e.mom,1)]]
          :[['산 가격',mkPxU(e.a,e.px)],['하루 반등',mkPct0(e.bounce,1)],['되돌림 점수',Math.round(e.rsi)+' (기준 '+c.rsiTh+' 아래)']].concat(e.of?[['오름세 종목',e.of+'개 중 '+e.up+'개']]:[])};
    } else if(e.t==='exit'){
      d={k:'sell',tag:'매도',title:tk+' 매도',pnl:e.pnl,why:MK_WHY[e.why]||'',facts:[['판 가격',mkPxU(e.a,e.px)],['이 거래의 손익',mkPct0(e.pnl,1)],['판 이유',MK_WHY[e.why]||'']]};
    } else if(e.t==='veto'){
      d={k:'skip',tag:'보류',title:tk+' 매수 보류',chain:1,why:'오름세 종목이 '+e.of+'개 중 '+e.up+'개뿐이라 AI가 사지 않았어요',
        facts:[['규칙 신호','조건 충족 (하루 반등 '+mkPct0(e.bounce,1)+')'],['되돌림 점수',Math.round(e.rsi)+' (기준 '+c.rsiTh+' 아래)'],['AI가 본 것','오름세 종목 '+e.of+'개 중 '+e.up+'개'],['사려면',btNeed(s)+'개 이상이어야 해요']]};
    } else if(e.t==='skip'){
      d={k:'skip',tag:'쉬어 감',title:'새로 사지 않음',why:e.why==='gate'?('오름세 종목이 '+e.of+'개 중 '+e.up+'개뿐이었어요'):'기준을 넘는 종목이 없었어요',
        facts:[['오름세 종목',e.of+'개 중 '+e.up+'개'],['사려면',btNeed(s)+'개 이상이어야 해요']].concat(e.held&&e.held.length?[['들고 있던 종목',e.held.map(mkTk).join(', ')]]:[])};
    } else if(e.t==='pick'){
      d={k:'pick',tag:'선정',title:tk+' 선정',why:'최근 '+look+'일 동안 '+mkPct0(e.mom,0)+' 올라 가장 강했어요',facts:(e.top||[]).slice(0,3).map(function(x,q){ return [(q+1)+'위',mkTk(x.k)+' '+mkPct0(x.mom,0)]; })};
    }
    if(d){ d.i=e.i; d.j=Math.max(0,Math.min(N-1,e.i-i0)); d.a=e.a; d.tid=e.tid; d.ix=D.length; D.push(d); }
  });
  var op=r.state&&r.state.open?(r.state.open.length!=null?r.state.open:[r.state.open]):[];
  var tr=(r.trades||[]).map(function(t){ return {id:t.id,a:t.asset,e:t.entry,x:t.exit,ep:t.ep,xp:t.xp,pnl:t.pnl*100,why:t.kind,cost:t.cost,got:t.got,days:t.exit-t.entry}; });
  op.forEach(function(o){ tr.push({id:o.tid,a:o.k,e:o.entry,x:null,ep:o.ep,xp:o.px,pnl:o.chg,why:null,cost:o.cost,got:null,days:T-o.entry,open:1}); });
  tr.sort(function(a,b){ return b.e-a.e; });
  var wins=tr.filter(function(t){ return !t.open&&t.pnl>0; }), loss=tr.filter(function(t){ return !t.open&&t.pnl<=0; });
  var avg=function(a){ return a.length?a.reduce(function(x,t){ return x+t.pnl; },0)/a.length:0; };
  var best=null, worst=null; tr.forEach(function(t){ if(t.open) return; if(!best||t.pnl>best.pnl) best=t; if(!worst||t.pnl<worst.pnl) worst=t; });
  var peakV=0, rec=null; for(var q=r.mddEndI-i0;q<N;q++){ if(q>=0&&eq[q].v>=eq[Math.max(0,r.mddStartI-i0)].v){ rec=eq[q].i; break; } }
  BT.R={r:r,eq:eq,i0:i0,N:N,T:T,bench:bench,mon:mon,cnt:cnt,D:D,tr:tr,wins:wins,loss:loss,avgW:avg(wins),avgL:avg(loss),best:best,worst:worst,rec:rec,list:list,
    ret:r.ret,mdd:r.mdd,n:r.n,win:r.winRate,benchRet:(bench[N-1]-1)*100,final:BT.amt*eq[N-1].v};
  return BT.R;
}

/* ── 그래프 ── */
function btGeo(){
  var R=BT.R, host=$('bt-chart'), W=Math.max(320,Math.round(host?host.clientWidth:900)), mob=W<560, H=mob?250:380, pl=mob?50:64, pr=mob?10:18, pt=26, pb=34;
  var vs=R.eq.map(function(p){ return p.v; }).concat(R.bench), mn=Math.min.apply(null,vs.concat(1))*BT.amt, mx=Math.max.apply(null,vs.concat(1))*BT.amt;
  var T=mkdTicks(mn,mx,5), lo=T[0], hi=T[T.length-1];
  var X=function(j){ return pl+j/Math.max(1,R.N-1)*(W-pl-pr); }, Y=function(v){ return pt+(1-(v*BT.amt-lo)/(hi-lo))*(H-pt-pb); };
  return (BT.G={W:W,H:H,pl:pl,pr:pr,pt:pt,pb:pb,T:T,X:X,Y:Y,mob:mob});
}
function btPath(arr,G){ var d=''; arr.forEach(function(v,j){ d+=(j?' L':'M')+G.X(j).toFixed(1)+' '+G.Y(v).toFixed(1); }); return d; }
function btChartSvg(){
  var R=BT.R, G=btGeo(), W=G.W, H=G.H, yb=G.Y(1), G1='#2fb98a', R1='#f0566a';
  var grid=G.T.map(function(v){ var y=G.Y(v/BT.amt); return '<line x1="'+G.pl+'" x2="'+(W-G.pr)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="rgba(255,255,255,'+(Math.abs(v-BT.amt)<1e-6?'.26':'.07')+')"/><text x="'+(G.pl-10)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" font-size="11" fill="#8b9096">'+Math.round(v).toLocaleString()+'</text>'; }).join('');
  var nx=G.mob?4:6, xl=''; for(var k=0;k<nx;k++){ var j=Math.round(k*(R.N-1)/(nx-1)), d=idxToDate(R.eq[j].i); xl+='<text x="'+G.X(j).toFixed(1)+'" y="'+(H-10)+'" text-anchor="'+(k===0?'start':k===nx-1?'end':'middle')+'" font-size="11" fill="#8b9096">'+String(d.getFullYear()).slice(2)+'.'+String(d.getMonth()+1).padStart(2,'0')+'</text>'; }
  var line=btPath(R.eq.map(function(p){ return p.v; }),G), area=line+' L'+G.X(R.N-1).toFixed(1)+' '+yb.toFixed(1)+' L'+G.X(0).toFixed(1)+' '+yb.toFixed(1)+' Z';
  var a=Math.max(0,R.r.mddStartI-R.i0), b=Math.max(0,Math.min(R.N-1,R.r.mddEndI-R.i0)), bx=G.X(a), bw=Math.max(2,G.X(b)-bx);
  var lbx=Math.max(G.pl+92,Math.min(W-G.pr-92,bx+bw/2));
  var mk=R.D.filter(function(d){ return d.k!=='pick'; }).map(function(d){ var x=G.X(d.j), y=G.Y(R.eq[d.j].v), s;
    if(d.k==='buy') s='<path d="M'+x.toFixed(1)+' '+(y+7).toFixed(1)+' l5 8 h-10 z" fill="'+G1+'"/>';
    else if(d.k==='sell') s='<path d="M'+x.toFixed(1)+' '+(y-7).toFixed(1)+' l5 -8 h-10 z" fill="'+(d.pnl>=0?G1:R1)+'"/>';
    else s='<rect x="'+(x-4).toFixed(1)+'" y="'+(y-22).toFixed(1)+'" width="8" height="8" transform="rotate(45 '+x.toFixed(1)+' '+(y-18).toFixed(1)+')" fill="#15171a" stroke="#f0b840" stroke-width="1.6"/>';
    return '<g class="bt-m" data-j="'+d.j+'" data-ix="'+d.ix+'">'+s+'</g>'; }).join('');
  return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="잔고 그래프"><defs>'
    +'<linearGradient id="btgu" gradientUnits="userSpaceOnUse" x1="0" y1="'+G.pt+'" x2="0" y2="'+yb.toFixed(1)+'"><stop offset="0" stop-color="'+G1+'" stop-opacity=".26"/><stop offset="1" stop-color="'+G1+'" stop-opacity=".02"/></linearGradient>'
    +'<linearGradient id="btgd" gradientUnits="userSpaceOnUse" x1="0" y1="'+yb.toFixed(1)+'" x2="0" y2="'+(H-G.pb)+'"><stop offset="0" stop-color="'+R1+'" stop-opacity=".02"/><stop offset="1" stop-color="'+R1+'" stop-opacity=".26"/></linearGradient>'
    +'<clipPath id="btcu"><rect x="0" y="0" width="'+W+'" height="'+yb.toFixed(1)+'"/></clipPath><clipPath id="btcd"><rect x="0" y="'+yb.toFixed(1)+'" width="'+W+'" height="'+(H-yb).toFixed(1)+'"/></clipPath>'
    +'<clipPath id="btrv"><rect id="bt-rv" x="0" y="0" height="'+H+'" width="'+(BT.phase==='ready'?0:W)+'"/></clipPath></defs>'
    +grid+xl
    +'<g class="bt-dd" id="bt-dd"><rect x="'+bx.toFixed(1)+'" y="'+G.pt+'" width="'+bw.toFixed(1)+'" height="'+(H-G.pt-G.pb)+'" fill="rgba(240,86,106,.10)"/><line x1="'+bx.toFixed(1)+'" x2="'+bx.toFixed(1)+'" y1="'+G.pt+'" y2="'+(H-G.pb)+'" stroke="rgba(240,86,106,.45)" stroke-dasharray="3 4"/><line x1="'+(bx+bw).toFixed(1)+'" x2="'+(bx+bw).toFixed(1)+'" y1="'+G.pt+'" y2="'+(H-G.pb)+'" stroke="rgba(240,86,106,.45)" stroke-dasharray="3 4"/>'
    +'<text x="'+lbx.toFixed(1)+'" y="'+(G.pt+16)+'" text-anchor="middle" font-size="12" font-weight="600" fill="#f58a98">가장 나빴던 구간 '+R.mdd.toFixed(1)+'%</text></g>'
    +'<path class="bt-bench" d="'+btPath(R.bench,G)+'" fill="none" stroke="rgba(255,255,255,.26)" stroke-width="1.3" stroke-dasharray="2 4"/>'
    +'<g clip-path="url(#btrv)">'
    +'<g clip-path="url(#btcu)"><path d="'+area+'" fill="url(#btgu)"/><path d="'+line+'" fill="none" stroke="'+G1+'" stroke-width="1.9" stroke-linejoin="round"/></g>'
    +'<g clip-path="url(#btcd)"><path d="'+area+'" fill="url(#btgd)"/><path d="'+line+'" fill="none" stroke="'+R1+'" stroke-width="1.9" stroke-linejoin="round"/></g>'
    +'</g><g id="bt-mk">'+mk+'</g>'
    +'<g class="bt-cur" id="bt-cur"><line id="bt-cl" x1="0" x2="0" y1="'+G.pt+'" y2="'+(H-G.pb)+'" stroke="rgba(255,255,255,.7)" stroke-dasharray="4 4"/><circle id="bt-cc" r="4.5" fill="#15171a" stroke="#fff" stroke-width="2"/></g>'
    +'<g class="bt-pin" id="bt-pin"><line id="bt-pl" x1="0" x2="0" y1="'+G.pt+'" y2="'+(H-G.pb)+'" stroke="#f0b840" stroke-width="1.2"/><circle id="bt-pc" r="5" fill="#f0b840"/></g>'
    +'</svg><div class="bt-tip" id="bt-tip" role="status"></div>';
}
function btChartDraw(){ var h=$('bt-chart'); if(!h) return; h.innerHTML=btChartSvg(); h.className='bt-chart ph-'+BT.phase; if(BT.phase==='result'){ btMarks(BT.R.N); btPin(); } }
function btMarks(j){ var m=document.querySelectorAll('#bt-mk .bt-m'); for(var i=0;i<m.length;i++){ if(+m[i].getAttribute('data-j')<=j) m[i].classList.add('on'); else m[i].classList.remove('on'); } }
function btCursor(j){
  var G=BT.G, R=BT.R, x=G.X(j), y=G.Y(R.eq[j].v), l=$('bt-cl'), c=$('bt-cc'), rv=$('bt-rv');
  if(l){ l.setAttribute('x1',x); l.setAttribute('x2',x); } if(c){ c.setAttribute('cx',x); c.setAttribute('cy',y); } if(rv) rv.setAttribute('width',x+1);
}
function btHover(ev){
  if(BT.phase!=='result') return; var h=$('bt-chart'), tip=$('bt-tip'), R=BT.R, G=BT.G; if(!h||!tip) return;
  if(!ev){ h.classList.remove('hov'); return; }
  var b=h.getBoundingClientRect(), x=(ev.clientX-b.left)/b.width*G.W, j=Math.round((x-G.pl)/(G.W-G.pl-G.pr)*(R.N-1)); j=Math.max(0,Math.min(R.N-1,j));
  var px=G.X(j), py=G.Y(R.eq[j].v), l=$('bt-cl'), c=$('bt-cc'); l.setAttribute('x1',px); l.setAttribute('x2',px); c.setAttribute('cx',px); c.setAttribute('cy',py);
  h.classList.add('hov');
  var v=R.eq[j].v, near=R.D.filter(function(d){ return d.k!=='pick'&&Math.abs(d.j-j)<=Math.max(1,Math.round(R.N/140)); })[0];
  tip.innerHTML='<b class="num">'+btYMD(R.eq[j].i)+'</b><span>잔고 <i class="num">'+btUsd(BT.amt*v)+'</i> <i class="num'+mkSign((v-1)*100)+'">'+mkPct0((v-1)*100,1)+'</i></span><span class="g">그냥 들고 있었다면 <i class="num">'+btUsd(BT.amt*R.bench[j])+'</i></span>'+(near?'<span class="e">'+gEsc(near.title)+(near.pnl!=null?' '+mkPct0(near.pnl,1):'')+'</span>':'');
  var tw=tip.offsetWidth||190, left=px/G.W*b.width+14; if(left+tw>b.width-6) left=px/G.W*b.width-tw-14; tip.style.left=Math.max(4,left)+'px'; tip.style.top=Math.max(6,Math.min(b.height-tip.offsetHeight-40,py/G.H*b.height-30))+'px';
}
/* 판단이나 거래를 고르면 그래프에 그 날을 표시한다 */
function btPin(){
  var g=$('bt-pin'); if(!g) return; var j=BT.sel&&BT.sel.j; if(j==null){ g.classList.remove('on'); return; }
  var x=BT.G.X(j), y=BT.G.Y(BT.R.eq[j].v); $('bt-pl').setAttribute('x1',x); $('bt-pl').setAttribute('x2',x); $('bt-pc').setAttribute('cx',x); $('bt-pc').setAttribute('cy',y); g.classList.add('on');
}

/* ── 화면 뼈대 ── */
function btHeadHtml(){
  var s=BT.s;
  return '<div class="bt-id">'+mkGlyph(s,40)+'<div class="bt-id-t"><h2>'+gEsc(mkHook(s))+'</h2><p>'+gEsc(mkOne(s))+'</p>'
    +'<div class="bt-id-m"><b>'+MK_KIND[s.kind]+'</b><span>'+gEsc(mkScope(s))+'</span><span>'+mkInstList(s).join(', ')+'</span></div></div></div>';
}
function btSteps(){
  var s=BT.s;
  return [['prep','가격 자료 준비'],['run','하루씩 다시 돌리기'],
    ['chk',s.kind==='agent'?'AI 판단 되짚기':btGate(s)?'규칙 신호와 AI 판단 확인':s.kind==='mix'?'AI 종목 선정과 규칙 확인':'사는 조건 확인'],
    ['calc','수익과 낙폭 계산'],['worst','가장 나빴던 구간 확인'],['wrap','결과 정리']];
}
function btPage(){
  var s=BT.s, ne=tfSS3Rid(s);
  return '<div class="bt" id="bt-root" data-phase="'+BT.phase+'">'
    +'<div class="tfw-hd bt-hd"><button class="bk" onclick="btBack()" aria-label="뒤로"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><span class="ti">백테스트</span><span class="sb" id="bt-sub"></span></div>'
    +btHeadHtml()
    +'<div class="bt-grid"><div class="bt-main">'
    +'<div class="bt-cap"><div class="bt-cap-l"><small id="bt-cap-k"></small><b class="num" id="bt-cap-v"></b><i class="num" id="bt-cap-p"></i></div>'
    +'<div class="bt-leg"><span class="a">이 전략</span><span class="b">그냥 들고 있었다면</span></div></div>'
    +'<div class="bt-chart" id="bt-chart" onpointermove="btHover(event)" onpointerleave="btHover(null)"></div>'
    +'<div class="bt-status" id="bt-status" role="status" aria-live="polite"></div>'
    +'<div class="bt-live" id="bt-live"></div>'
    +'</div><aside class="bt-rail" id="bt-rail"></aside></div>'
    +'<div class="bt-ev" id="bt-ev"></div>'
    +'</div>';
}
function btSub(){ var e=$('bt-sub'); if(e) e.textContent=btPerL()+', '+btUsd(BT.amt)+'로 시작'; }
function btCap(k,v,p,sg){ var a=$('bt-cap-k'), b=$('bt-cap-v'), c=$('bt-cap-p'); if(a) a.textContent=k; if(b) b.textContent=v; if(c){ c.textContent=p||''; c.className='num'+(sg||''); } }

/* ── 준비 ── */
function btReadyRail(){
  var s=BT.s, R=BT.R;
  var opt=function(list,cur,fn,fmt){ return '<div class="bt-seg" role="group">'+list.map(function(o){ var v=o[0]!=null&&o.length?o[0]:o, l=o.length?o[1]:fmt(o), on=v===cur; return '<button type="button" aria-pressed="'+on+'" onclick="'+fn+'('+v+')">'+l+'</button>'; }).join('')+'</div>'; };
  return '<section class="bt-box"><h3>내가 정한 것</h3>'
    +'<div class="bt-f"><small>돌려 볼 기간</small>'+opt(BT_PER,BT.per,'btSetPer')+'</div>'
    +'<div class="bt-f"><small>시작 금액</small>'+opt(BT_AMT.map(function(a){ return [a,a.toLocaleString()]; }),BT.amt,'btSetAmt')+'<em>USDT</em></div></section>'
    +'<section class="bt-box"><h3>TETH가 채운 것</h3><dl class="bt-dl">'+btRules(s).map(function(r){ return '<div><dt>'+r[0]+'</dt><dd>'+mkGloss(gEsc(r[1]),1)+'</dd></div>'; }).join('')+'</dl></section>'
    +'<button type="button" class="bt-cta" onclick="btStart()">과거를 다시 돌려 보기</button>'
    +'<p class="bt-note">'+btYMD(R.eq[0].i)+'부터 '+btYMD(R.eq[R.N-1].i)+'까지 '+R.N.toLocaleString()+'일을 하루씩 다시 돌려요. 15초쯤 걸려요.</p>';
}
function btReady(){
  BT.phase='ready'; BT.sel=null; btStop(); btCompute();
  var root=$('bt-root'); if(root) root.setAttribute('data-phase','ready');
  btSub(); btChartDraw();
  btCap('같은 기간 종목을 그냥 들고 있었다면',btUsd(BT.amt*BT.R.bench[BT.R.N-1]),mkPct0(BT.R.benchRet,1),mkSign(BT.R.benchRet));
  $('bt-status').innerHTML='<span class="bt-dot idle"></span>점선은 '+gEsc(mkUni(BT.s).label)+'을 똑같이 나눠 그냥 들고 있었을 때예요. 전략의 결과는 돌려 본 뒤에 그려져요.';
  $('bt-live').innerHTML=''; $('bt-rail').innerHTML=btReadyRail(); $('bt-ev').innerHTML='';
}
function btSetPer(v){ BT.per=v; btSaveSet(); btReady(); }
function btSetAmt(v){ BT.amt=v; btSaveSet(); btReady(); }
function btSaveSet(){ try{ var t=tfS(); t.bt=t.bt||{}; t.bt.per=BT.per; t.bt.amt=BT.amt; t.bt.id=BT.id; tfSave(); }catch(e){} }

/* ── 다시 돌리기 ── */
function btRunRail(){
  return '<section class="bt-box bt-stepbox"><h3>지금 하는 일</h3><ol class="bt-steps" id="bt-steps">'+btSteps().map(function(x,i){ return '<li id="bt-st-'+x[0]+'"><span class="ic"></span><span class="lb">'+x[1]+'</span><span class="evd num" id="bt-se-'+x[0]+'"></span></li>'; }).join('')+'</ol></section>'
    +'<section class="bt-box bt-feedbox"><h3>방금 내린 판단</h3><div class="bt-feed" id="bt-feed"><p class="bt-feed-e">다시 돌리기 시작하면 판단이 여기에 쌓여요</p></div></section>'
    +'<button type="button" class="bt-skip" onclick="btSkip()">바로 결과 보기</button>';
}
function btStep(id,st,evd){ var e=$('bt-st-'+id); if(!e) return; e.className=st; if(st==='ok') e.querySelector('.ic').innerHTML=TAI_CHECK; else if(st==='run') e.querySelector('.ic').innerHTML='<i></i>'; if(evd!=null){ var x=$('bt-se-'+id); if(x) x.textContent=evd; } }
function btLive(j){
  var R=BT.R, i=R.eq[j].i, closed=0, sk=0, en=0;
  R.D.forEach(function(d){ if(d.i>i) return; if(d.k==='sell') closed++; else if(d.k==='skip') sk++; else if(d.k==='buy') en++; });
  var v=R.eq[j].v, s=BT.s;
  $('bt-live').innerHTML='<div><small>지난 날</small><b class="num">'+(j+1).toLocaleString()+'<i> / '+R.N.toLocaleString()+'일</i></b></div>'
    +'<div><small>끝난 거래</small><b class="num">'+closed+'번</b></div>'
    +(s.kind==='rule'?'<div><small>매수</small><b class="num">'+en+'번</b></div>':'<div><small>'+(s.kind==='agent'?'쉬어 간 판단':'AI가 보류')+'</small><b class="num">'+sk+'번</b></div>');
  btCap(btYMD(i)+' 잔고',btUsd(BT.amt*v),mkPct0((v-1)*100,1),mkSign((v-1)*100));
  return {closed:closed,sk:sk,en:en};
}
function btHolding(i){ var R=BT.R, h=[]; R.tr.forEach(function(t){ if(t.e<=i&&(t.x==null||t.x>i)) h.push(mkTk(t.a)); }); return h; }
function btFeedCard(d){
  var pn=d.pnl!=null?'<i class="num'+mkSign(d.pnl)+'">'+mkPct0(d.pnl,1)+'</i>':'';
  return '<article class="bt-fc k-'+d.k+'"><header><time class="num">'+btYMD(d.i)+'</time><b>'+gEsc(d.title)+'</b>'+pn+'</header>'
    +(d.chain?'<div class="bt-chain"><span class="ok">규칙 신호</span><span class="ai">AI 확인</span><span class="no">보류</span></div>':'')
    +'<p>'+gEsc(d.why)+'</p></article>';
}
function btFeed(j){
  var R=BT.R, i=R.eq[j].i, f=$('bt-feed'); if(!f) return; var add='';
  while(BT.fed<R.D.length&&R.D[BT.fed].i<=i){ var d=R.D[BT.fed++]; if(d.k==='pick'&&BT.s.kind!=='mix') continue; add=btFeedCard(d)+add; }
  if(!add) return; var e=f.querySelector('.bt-feed-e'); if(e) e.remove();
  f.insertAdjacentHTML('afterbegin',add); while(f.children.length>4) f.removeChild(f.lastChild);
}
function btStart(){
  if(!BT.R) btCompute();
  BT.phase='run'; BT.ph=-1; BT.j=-1; BT.fed=0; BT.sel=null;
  var root=$('bt-root'); root.setAttribute('data-phase','run');
  $('bt-rail').innerHTML=btRunRail(); $('bt-ev').innerHTML=''; btChartDraw(); $('bt-live').innerHTML='';
  var still=false; try{ still=window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  if(still){ btFinish(); return; }
  BT.t0=performance.now(); BT.raf=requestAnimationFrame(btTick);
  try{ tfTrack('bt_start',{id:BT.id,per:BT.per}); }catch(e){}
}
function btStop(){ if(BT.raf) cancelAnimationFrame(BT.raf); BT.raf=0; }
function btTick(now){
  if(BT.phase!=='run'||!$('bt-root')){ BT.raf=0; return; }
  var e=now-BT.t0, R=BT.R, s=BT.s, T=BT_T, st=$('bt-status'), t1=T[0], t2=t1+T[1], t3=t2+T[2], t4=t3+T[3], t5=t4+T[4];
  if(e<t1){
    if(BT.ph<0){ BT.ph=0; btStep('prep','run'); }
    var k=e/t1, tot=R.list.length*R.N, nk=Math.floor(tot*k), ix=Math.min(R.list.length-1,Math.floor(k*R.list.length));
    btStep('prep','run',nk.toLocaleString()+'개'); st.innerHTML='<span class="bt-dot"></span>'+gEsc(mkTk(R.list[ix]))+'의 하루 가격을 불러오는 중';
    btCap('시작',btUsd(BT.amt),'','');
  } else if(e<t2){
    if(BT.ph<1){ BT.ph=1; btStep('prep','ok',R.list.length+'종목, 가격 '+(R.list.length*R.N).toLocaleString()+'개'); btStep('run','run'); btStep('chk','run'); $('bt-root').classList.add('cur'); }
    var j=Math.max(0,Math.min(R.N-1,Math.floor((e-t1)/T[1]*(R.N-1))));
    if(j!==BT.j){ BT.j=j; btCursor(j); btMarks(j); btFeed(j); var c=btLive(j), h=btHolding(R.eq[j].i);
      btStep('run','run',(j+1).toLocaleString()+' / '+R.N.toLocaleString()+'일');
      btStep('chk','run',s.kind==='rule'?'신호 '+c.en+'번':s.kind==='agent'?'쉬어 간 판단 '+c.sk+'번':btGate(s)?'신호 '+(c.en+c.sk)+'번 중 보류 '+c.sk+'번':'매수 '+c.en+'번');
      st.innerHTML='<span class="bt-dot"></span><b class="num">'+btYMD(R.eq[j].i)+'</b>'+(h.length?gEsc(h.join(', '))+' 보유 중':'조건이 맞기를 기다리는 중'); }
  } else if(e<t3){
    if(BT.ph<2){ BT.ph=2; btEndReplay(); btStep('calc','run'); st.innerHTML='<span class="bt-dot"></span>거래 '+R.n+'번의 수익과 가장 크게 내려간 폭을 계산하는 중'; }
  } else if(e<t4){
    if(BT.ph<3){ BT.ph=3; btStep('calc','ok',mkPct0(R.ret,1)+', 최대 낙폭 '+R.mdd.toFixed(1)+'%'); btStep('worst','run'); $('bt-chart').classList.add('dd'); st.innerHTML='<span class="bt-dot"></span>가장 나빴던 구간을 찾는 중'; }
  } else if(e<t5){
    if(BT.ph<4){ BT.ph=4; btStep('worst','ok',mkMD(R.r.mddStartI)+' ~ '+mkMD(R.r.mddEndI)); btStep('wrap','run'); st.innerHTML='<span class="bt-dot"></span>결과를 정리하는 중'; }
  } else { btStep('wrap','ok'); btFinish(); return; }
  BT.raf=requestAnimationFrame(btTick);
}
function btEndReplay(){
  var R=BT.R, s=BT.s, j=R.N-1; BT.j=j; btCursor(j); btMarks(j); btFeed(j); var c=btLive(j);
  btStep('run','ok',R.N.toLocaleString()+'일');
  btStep('chk','ok',s.kind==='rule'?'신호 '+c.en+'번':s.kind==='agent'?'쉬어 간 판단 '+c.sk+'번':btGate(s)?'신호 '+(c.en+c.sk)+'번 중 보류 '+c.sk+'번':'선정 '+R.cnt.pick+'번, 매수 '+c.en+'번');
  var root=$('bt-root'); if(root) root.classList.remove('cur');
}
function btSkip(){ btStop(); btFinish(); }

/* ── 결과 ── */
function btWinTxt(){ var R=BT.R, n=R.wins.length+R.loss.length; return n?n+'번 중 '+R.wins.length+'번':'아직 없음'; }
function btRead(){
  var R=BT.R, s=BT.s, o=[], n=R.wins.length+R.loss.length;
  if(n) o.push('끝난 거래 '+n+'번 중 '+R.wins.length+'번을 이겼어요. 이긴 거래는 평균 '+mkPct0(R.avgW,1)+', 진 거래는 평균 '+mkPct0(R.avgL,1)+'였어요.');
  else o.push('이 기간에는 끝난 거래가 없었어요.');
  if(btGate(s)&&R.cnt.veto) o.push('사는 조건이 '+(R.cnt.enter+R.cnt.veto)+'번 맞았는데, 그중 '+R.cnt.veto+'번은 오름세 종목이 적어 AI가 사지 않았어요.');
  else if(s.kind==='agent'&&R.cnt.skip) o.push('AI는 '+R.cnt.skip+'번의 판단에서 새로 사지 않고 기다렸어요.');
  else o.push('전체 기간의 '+Math.round(100-Math.min(100,R.r.exposure))+'%는 아무것도 들지 않고 기다렸어요.');
  var w='가장 나빴던 때는 '+mkMD(R.r.mddStartI)+'부터 '+mkMD(R.r.mddEndI)+'까지로, 잔고가 '+Math.abs(R.mdd).toFixed(1)+'% 줄었어요.';
  w+=R.rec!=null?' 원래대로 돌아오는 데 '+(R.rec-R.r.mddEndI)+'일 걸렸어요.':' 기간이 끝날 때까지 그 전 높이로 돌아오지 못했어요.';
  o.push(w);
  if(n&&n<20) o.push('거래가 '+n+'번뿐이라 결과가 몇 번의 거래에 크게 좌우돼요.');
  return o;
}
function btResultRail(){
  var R=BT.R, up=R.ret>=0, d=R.ret-R.benchRet;
  return '<section class="bt-box bt-verdict"><small>'+btPerL()+' 동안</small>'
    +'<p class="bt-v1"><span class="num">'+btUsd(BT.amt)+'</span>가<br><b class="num'+mkSign(R.ret)+'">'+btUsd(R.final)+'</b>'+(up?'가 됐어요':'로 줄었어요')+'</p>'
    +'<p class="bt-v2"><b class="num'+mkSign(R.ret)+'">'+mkPct0(R.ret,1)+'</b><span>그냥 들고 있었다면 <i class="num">'+mkPct0(R.benchRet,1)+'</i></span></p>'
    +'<div class="bt-k3"><div><small>가장 크게 내려간 폭</small><b class="num mk-dn">'+R.mdd.toFixed(1)+'%</b><em>'+mkdTerm('최대 낙폭','가장 높았던 때에서 가장 많이 내려간 폭이에요. 값이 클수록 중간에 크게 흔들렸다는 뜻이에요.')+'</em></div>'
    +'<div><small>이긴 거래</small><b class="num">'+btWinTxt()+'</b><em>'+mkdTerm('승률 '+Math.round(R.win)+'%','끝난 거래 중 이익으로 끝난 거래의 비율이에요.')+'</em></div>'
    +'<div><small>거래</small><b class="num">'+R.n+'번</b><em>평균 '+Math.round(R.r.avgHold||0)+'일 보유</em></div></div></section>'
    +'<section class="bt-box bt-read"><h3>TETH의 해석</h3>'+btRead().map(function(x){ return '<p>'+gEsc(x)+'</p>'; }).join('')+'</section>'
    +'<button type="button" class="bt-cta" onclick="btUse()">이 전략 실행하기</button>'
    +'<button type="button" class="bt-sec" onclick="btReady()">조건을 바꿔 다시 돌리기</button>';
}
function btFinish(){
  btStop(); BT.phase='result'; BT.j=BT.R.N-1;
  var root=$('bt-root'); if(!root) return; root.setAttribute('data-phase','result'); root.classList.remove('cur');
  btChartDraw(); $('bt-chart').classList.add('dd');
  var R=BT.R; btCap(btYMD(R.eq[R.N-1].i)+' 잔고',btUsd(R.final),mkPct0(R.ret,1),mkSign(R.ret));
  $('bt-status').innerHTML='<span class="bt-dot done"></span>'+R.N.toLocaleString()+'일을 다시 돌렸어요. 그래프 위에 마우스를 올리면 그날의 잔고가 보여요.';
  $('bt-live').innerHTML=''; $('bt-rail').innerHTML=btResultRail(); $('bt-ev').innerHTML=btEvidence();
  try{ var t=tfS(); t.bt=t.bt||{}; t.bt.id=BT.id; t.bt.per=BT.per; t.bt.amt=BT.amt; t.bt.done=1; t.bt.ret=R.ret; t.bt.mdd=R.mdd; t.bt.fin=R.final; tfSave(); tfTrack('bt_done',{id:BT.id,ret:R.ret}); }catch(e){}
}

/* ── 근거: 월별, 판단 기록, 거래내역, 자세한 지표 ── */
function btMonths(){
  var R=BT.R, m=R.mon, mx=Math.max.apply(null,m.map(function(x){ return Math.abs(x.ret); }).concat(1));
  return '<div class="bt-mon" style="--n:'+m.length+'">'+m.map(function(x){ var h=Math.max(2,Math.abs(x.ret)/mx*46), up=x.ret>=0.05, dn=x.ret<=-0.05;
    return '<div class="bt-mo'+(up?' u':dn?' d':' z')+'" title="'+x.y+'년 '+x.m+'월 '+mkPct0(x.ret,1)+'"><span class="p"><i style="height:'+(up?h:0).toFixed(1)+'px"></i></span><span class="n"><i style="height:'+(dn?h:0).toFixed(1)+'px"></i></span><em class="num">'+(x.m===1||x===m[0]?String(x.y).slice(2)+'.':'')+x.m+'</em><b class="num">'+(Math.abs(x.ret)<0.05?'0':mkPct0(x.ret,0))+'</b></div>'; }).join('')+'</div>';
}
/* 그 무렵의 가격: 종목 하나의 가격 선과 산 곳, 판 곳 */
function btMini(a,i1,i2,marks,lines){
  var P=mkPx(a), T=PRICE0.length-1, lo=Math.max(0,i1), hi=Math.min(T,i2), W=520, H=150, pl=8, pr=58, pt=14, pb=20, v=[]; for(var i=lo;i<=hi;i++) v.push(P[i]);
  var ex=v.concat((lines||[]).map(function(l){ return l[0]; })), mn=Math.min.apply(null,ex), mx=Math.max.apply(null,ex), pad=(mx-mn)*0.08||1; mn-=pad; mx+=pad;
  var X=function(i){ return pl+(i-lo)/Math.max(1,hi-lo)*(W-pl-pr); }, Y=function(p){ return pt+(1-(p-mn)/(mx-mn))*(H-pt-pb); }, d='';
  v.forEach(function(p,k){ d+=(k?' L':'M')+X(lo+k).toFixed(1)+' '+Y(p).toFixed(1); });
  return '<svg class="bt-mini" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+gEsc(a)+' 가격"><path d="'+d+'" fill="none" stroke="rgba(255,255,255,.62)" stroke-width="1.5"/>'
    +(lines||[]).map(function(l){ var y=Y(l[0]); return '<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="'+l[2]+'" stroke-dasharray="3 4" stroke-opacity=".7"/><text x="'+(W-pr+6)+'" y="'+(y+4).toFixed(1)+'" font-size="10.5" fill="'+l[2]+'">'+l[1]+'</text>'; }).join('')
    +marks.map(function(m){ if(m[0]<lo||m[0]>hi) return ''; var x=X(m[0]), y=Y(P[m[0]]); return '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="5" fill="'+m[2]+'" stroke="#15171a" stroke-width="2"/><text x="'+x.toFixed(1)+'" y="'+(y-10).toFixed(1)+'" text-anchor="middle" font-size="10.5" font-weight="600" fill="'+m[2]+'">'+m[1]+'</text>'; }).join('')
    +'<text x="'+pl+'" y="'+(H-5)+'" font-size="10.5" fill="#8b9096">'+btYMD(lo)+'</text><text x="'+(W-pr)+'" y="'+(H-5)+'" text-anchor="end" font-size="10.5" fill="#8b9096">'+btYMD(hi)+'</text></svg>';
}
function btTradeOf(tid){ var t=null; BT.R.tr.forEach(function(x){ if(x.id===tid) t=x; }); return t; }
function btDecDetail(d){
  var c=BT.s.cfg||{}, t=d.tid!=null?btTradeOf(d.tid):null, mini='';
  if(d.a){
    if(t) mini=btMini(d.a,t.e-14,(t.x!=null?t.x:BT.R.T)+10,[[t.e,'매수','#2fb98a']].concat(t.x!=null?[[t.x,'매도',t.pnl>=0?'#2fb98a':'#f0566a']]:[]),BT.s.kind==='agent'?[]:[[t.ep*(1+c.tp/100),'목표 +'+c.tp+'%','#2fb98a'],[t.ep*(1+c.sl/100),'손절 '+c.sl+'%','#f0566a']]);
    else mini=btMini(d.a,d.i-25,d.i+25,[[d.i,d.k==='skip'?'보류':d.tag,d.k==='skip'?'#f0b840':'#9aa0a6']],[]);
  }
  var after=''; if(d.k==='skip'&&d.a){ var P=mkPx(d.a), q=Math.min(BT.R.T,d.i+25), ch=(P[q]/P[d.i]-1)*100; after='<p class="bt-after">그 뒤 '+(q-d.i)+'일 동안 '+gEsc(mkTk(d.a))+'의 가격은 <b class="num'+mkSign(ch)+'">'+mkPct0(ch,1)+'</b> 움직였어요.</p>'; }
  return '<div class="bt-dd-in">'+(mini?'<div class="bt-dd-c"><small>'+gEsc(d.a)+' 가격, 그 무렵</small>'+mini+'</div>':'')
    +'<div class="bt-dd-f"><dl class="bt-dl">'+d.facts.map(function(f){ return '<div><dt>'+f[0]+'</dt><dd class="num">'+mkGloss(gEsc(f[1]),1)+'</dd></div>'; }).join('')+'</dl>'+after+'</div></div>';
}
function btDecRows(){
  var R=BT.R, L=R.D.filter(function(d){ return BT.filt==='all'?(d.k!=='pick'||BT.s.kind==='mix'):d.k===BT.filt; }).slice().reverse(), n=L.length;
  return (n?L.slice(0,BT.decN).map(function(d){ var on=BT.sel&&BT.sel.t==='d'&&BT.sel.ix===d.ix;
    return '<div class="bt-row k-'+d.k+(on?' on':'')+'"><button type="button" class="bt-rb" aria-expanded="'+!!on+'" onclick="btSelDec('+d.ix+')"><time class="num">'+btYMD(d.i)+'</time><span class="tg">'+d.tag+'</span><b>'+gEsc(d.title)+(d.pnl!=null?' <i class="num'+mkSign(d.pnl)+'">'+mkPct0(d.pnl,1)+'</i>':'')+'</b><span class="wy">'+gEsc(d.why)+'</span><svg class="cv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>'
      +(on?btDecDetail(d):'')+'</div>'; }).join(''):'<p class="bt-none">이 종류의 판단은 없었어요</p>')
    +(n>BT.decN?'<button type="button" class="bt-more" onclick="BT.decN+=12;btEvRe()">이전 판단 '+Math.min(12,n-BT.decN)+'건 더 보기</button>':'');
}
function btTrDetail(t){
  var c=BT.s.cfg||{};
  var mini=btMini(t.a,t.e-14,(t.x!=null?t.x:BT.R.T)+10,[[t.e,'매수','#2fb98a']].concat(t.x!=null?[[t.x,'매도',t.pnl>=0?'#2fb98a':'#f0566a']]:[]),BT.s.kind==='agent'?[]:[[t.ep*(1+c.tp/100),'목표 +'+c.tp+'%','#2fb98a'],[t.ep*(1+c.sl/100),'손절 '+c.sl+'%','#f0566a']]);
  var put=BT.amt*t.cost, got=t.got!=null?BT.amt*t.got:put*(1+t.pnl/100);
  return '<div class="bt-dd-in"><div class="bt-dd-c"><small>'+gEsc(t.a)+' 가격, 산 날부터 판 날까지</small>'+mini+'</div>'
    +'<div class="bt-dd-f"><dl class="bt-dl"><div><dt>산 날</dt><dd class="num">'+btYMD(t.e)+', '+mkPxU(t.a,t.ep)+'</dd></div>'
    +'<div><dt>'+(t.open?'지금 가격':'판 날')+'</dt><dd class="num">'+(t.open?mkPxU(t.a,t.xp):btYMD(t.x)+', '+mkPxU(t.a,t.xp))+'</dd></div>'
    +'<div><dt>들고 있던 기간</dt><dd class="num">'+t.days+'일</dd></div>'
    +'<div><dt>넣은 돈</dt><dd class="num">'+btUsd(put)+'</dd></div>'
    +'<div><dt>'+(t.open?'지금 값':'돌려받은 돈')+'</dt><dd class="num">'+btUsd(got)+' <i class="num'+mkSign(t.pnl)+'">'+mkPct0(t.pnl,1)+'</i></dd></div>'
    +(t.open?'':'<div><dt>판 이유</dt><dd>'+gEsc(MK_WHY[t.why]||'')+'</dd></div>')+'</dl></div></div>';
}
function btTrRows(){
  var R=BT.R, L=R.tr, n=L.length;
  return '<div class="bt-th"><span>종목</span><span>산 날</span><span>판 날</span><span class="r">기간</span><span class="r">손익</span><span></span></div>'
    +(n?L.slice(0,BT.ordN).map(function(t){ var on=BT.sel&&BT.sel.t==='t'&&BT.sel.id===t.id;
      return '<div class="bt-row bt-tr'+(on?' on':'')+'"><button type="button" class="bt-rb" aria-expanded="'+!!on+'" onclick="btSelTr('+t.id+')"><b>'+gEsc(mkTk(t.a))+'</b><time class="num">'+btYMD(t.e)+'</time><time class="num">'+(t.open?'보유 중':btYMD(t.x))+'</time><span class="r num">'+t.days+'일</span><span class="r num'+mkSign(t.pnl)+'">'+mkPct0(t.pnl,1)+'</span><svg class="cv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>'
        +(on?btTrDetail(t):'')+'</div>'; }).join(''):'<p class="bt-none">이 기간에는 거래가 없었어요</p>')
    +(n>BT.ordN?'<button type="button" class="bt-more" onclick="BT.ordN+=12;btEvRe()">이전 거래 '+Math.min(12,n-BT.ordN)+'건 더 보기</button>':'');
}
function btTech(){
  var R=BT.R, r=R.r, row=function(k,v,t){ return '<div><dt>'+(t?mkdTerm(k,t):k)+'</dt><dd class="num">'+v+'</dd></div>'; };
  return '<details class="bt-tech"><summary>자세한 지표<svg class="cv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary><dl class="bt-dl bt-tech-g">'
    +row('승률',Math.round(R.win)+'%','끝난 거래 중 이익으로 끝난 거래의 비율이에요.')
    +row('손익비',(r.pf||0).toFixed(2),'이긴 거래에서 번 돈을 진 거래에서 잃은 돈으로 나눈 값이에요. 1보다 크면 번 돈이 더 많아요.')
    +row('1년으로 환산한 수익률',mkPct0(r.cagr||0,1),'이 기간의 수익률을 1년 기준으로 바꾼 값이에요.')
    +row('샤프 지수',(r.sharpe||0).toFixed(2),'흔들린 정도에 비해 얼마나 벌었는지를 나타내요. 높을수록 덜 흔들리며 벌었다는 뜻이에요.')
    +row('평균 보유 기간',Math.round(r.avgHold||0)+'일')
    +row('종목을 들고 있던 시간',Math.round(Math.min(100,r.exposure||0))+'%','전체 기간 중 종목을 들고 있던 날의 비율이에요. 나머지는 현금으로 기다렸어요.')
    +row('낸 수수료',btUsd(BT.amt*(r.costImpact||0)/100,1),'살 때와 팔 때 낸 수수료를 모두 더한 값이에요. 위 결과는 이 수수료를 뺀 뒤의 값이에요.')
    +row('가장 길게 회복을 기다린 기간',(r.underwaterDays||0)+'일','잔고가 그 전 가장 높았던 값으로 돌아오기까지 걸린 가장 긴 기간이에요.')
    +'</dl></details>';
}
function btEvidence(){
  var s=BT.s, R=BT.R, chips=[['all','전체'],['buy','매수'],['sell','매도'],['skip',s.kind==='agent'?'쉬어 감':'보류']].filter(function(c){ return c[0]!=='skip'||s.kind!=='rule'; });
  return '<section class="bt-sec-b"><header><h3>달마다 어땠나요</h3><span>'+R.mon.length+'개월 중 '+R.mon.filter(function(m){ return m.ret>=0.05; }).length+'개월이 올랐어요</span></header>'+btMonths()+'</section>'
    +'<section class="bt-sec-b" id="bt-dec"><header><h3>왜 그렇게 판단했나요</h3><div class="bt-chips" role="group" aria-label="판단 종류">'+chips.map(function(c){ return '<button type="button" aria-pressed="'+(BT.filt===c[0])+'" onclick="btFilt(\''+c[0]+'\')">'+c[1]+'</button>'; }).join('')+'</div></header><div class="bt-list" id="bt-dl">'+btDecRows()+'</div></section>'
    +'<section class="bt-sec-b" id="bt-trs"><header><h3>거래 하나씩 보기</h3><span>'+R.tr.length+'건, '+btUsd(BT.amt)+'로 시작한 기준</span></header><div class="bt-list bt-tlist" id="bt-tl">'+btTrRows()+'</div></section>'
    +btTech()
    +'<div class="bt-foot"><div><b>'+gEsc(mkHook(s))+'</b><span class="num">'+btPerL()+' <i class="'+mkSign(R.ret).trim()+'">'+mkPct0(R.ret,1)+'</i>, 가장 크게 내려간 폭 '+R.mdd.toFixed(1)+'%</span></div><button type="button" class="bt-cta" onclick="btUse()">이 전략 실행하기</button></div>';
}
function btEvRe(){ var a=$('bt-dl'), b=$('bt-tl'); if(a) a.innerHTML=btDecRows(); if(b) b.innerHTML=btTrRows(); btPin(); }
function btFilt(k){ BT.filt=k; BT.decN=8; if(BT.sel&&BT.sel.t==='d') BT.sel=null; var e=$('bt-ev'); if(e) e.innerHTML=btEvidence(); btPin(); }
function btSelDec(ix){ var d=BT.R.D[ix]; BT.sel=(BT.sel&&BT.sel.t==='d'&&BT.sel.ix===ix)?null:{t:'d',ix:ix,j:d.j}; btEvRe(); }
function btSelTr(id){ var t=btTradeOf(id); BT.sel=(BT.sel&&BT.sel.t==='t'&&BT.sel.id===id)?null:{t:'t',id:id,j:Math.max(0,Math.min(BT.R.N-1,t.e-BT.R.i0))}; btEvRe(); }

/* ── 들어오고 나가기 ── */
function btOpen(ne){ location.hash='#/share/bt/'+ne; }
function btBack(){ if(BT.phase==='run'){ btStop(); btReady(); return; } var ne=BT.s?tfSS3Rid(BT.s):''; if(history.length>1) history.back(); else tfSS3Go(ne,'all','ov'); }
function btView(){
  tfPageMode('tfbt','백테스트'); TF_RENDERING=true; gContent(btPage()); TF_RENDERING=false;
  var t=tfS().bt||{};
  if(t.id===BT.id&&t.done&&BT.R&&BT.phase==='result'){ btSub(); btFinish(); }
  else btReady();
}
function btRoute(h){
  var m=h.match(/^#\/share\/bt\/([^/]+)(?:\/(go|card|ex|partner|uid|api|ok))?$/); TF_ONSHARE=true;
  if(!m){ TF_ONSHARE=false; tfShareHub('find'); return; }
  var s=null; try{ s=tfSSFind(decodeURIComponent(m[1])); }catch(e){}
  if(!s||!s.cfg){ TF_ONSHARE=false; tfShareHub('find'); return; }
  var t=tfS().bt||{};
  if(BT.id!==s.id){ btStop(); BT.id=s.id; BT.s=s; BT.R=null; BT.phase='ready'; BT.sel=null; BT.filt='all'; BT.decN=8; BT.ordN=8; if(t.id===s.id){ if(t.per!=null) BT.per=t.per; if(t.amt) BT.amt=t.amt; } }
  BT.s=s;
  if(!m[2]){ btView(); return; }
  if(!BT.R) btCompute();
  btGoView(m[2]);
}
var BT_RS=0; window.addEventListener('resize',function(){ if(G.mode!=='tfbt'||!$('bt-chart')||BT.phase==='run') return; clearTimeout(BT_RS); BT_RS=setTimeout(function(){ if($('bt-chart')){ btChartDraw(); if(BT.phase==='result') $('bt-chart').classList.add('dd'); } },160); });
