/* ═══ 판단 방식 중심 목록과 상세 (rd) ═══
   세 가지 판단 방식: agent(직접 탐색), rule(조건 실행), mix(혼합).
   화면의 상태, 판단 기록, 성과는 모두 같은 계산 결과(r)에서 읽는다. 목록 카드와 상세가 다른 계산을 하지 않는다. */
var MK_KIND={agent:'AI 판단',rule:'차트 규칙',mix:'혼합 전략'};
/* 짧은 상태 줄(카드 '지금', 상세 '지금' 패널)은 티커로 쓴다. 지수와 금은 한글 이름이 더 잘 읽혀 그대로 둔다 */
var MK_TK={'비트코인':'BTC','이더리움':'ETH','솔라나':'SOL','리플':'XRP','도지코인':'DOGE','에이다':'ADA','아발란체':'AVAX','비앤비':'BNB','테슬라':'TSLA','엔비디아':'NVDA','애플':'AAPL','마이크로소프트':'MSFT','아마존':'AMZN','메타':'META','알파벳':'GOOGL','에이엠디':'AMD'};
function mkTk(k){ return MK_TK[k]||k; }
/* 이름이 바뀌어도 저장된 즐겨찾기와 따라가기가 같은 전략을 찾게 하는 별칭(옛 이름 → 전략 ID).
   이전 목록에서는 행동 값이 같은 조건 실행 9종만 연결한다. 나머지는 추정하지 않는다 */
var MK_ALIAS={'비트코인 바겐세일':'r1','김대리의 나스닥':'r2','손절은 칼같이':'r3','골드핑거':'r4','테슬라 역발상가':'r5','짧게 먹고 내린다':'r6','리플 잔돈 수집가':'r7','끝까지는 안 가':'r8','비트코인은 기다림':'r9',
  '한계선':'r3','거름':'h2','돌림':'d4','이음':'h3','깊은 숨':'r5','한구간':'r6','길잡이':'h4','분업':'h5','길목':'r9',
  /* 2026-09-29 카드 1차 구현의 이름 */
  '네 시장에서 둘':'d2','코인 매일 갈아타기':'d3','대표 코인 하나만':'d6','네 시장에서 하나':'h4','많이 오른 코인 하나':'h5','금 방향부터 확인':'r4','테슬라 오래 기다리기':'r5','리플 작게 여러 번':'r7','비트코인 방향 확인':'r9',
  /* 2026-09-29 이름 개편 전 이름 */
  '세 갈래':'d1','건널목':'d2','환승':'d3','기술주 셋':'d4','동행':'d5','외길':'d6','맞물림':'h1','추림':'h2','지수와 금':'h3','갈림길':'h4','고른 뒤':'h5','되짚기':'r1','짧은 호흡':'r2','물러섬':'r3','두 문턱':'r4','깊은 되돌림':'r5','한 구간':'r6','작은 걸음':'r7','마침표':'r8','방향선':'r9'};
/* 데이터 기준일: 마지막 봉의 날짜. 가격 데이터를 바꿀 때 함께 바꾼다. 날짜, 판단 기록, 기간 계산, 저장된 시작 봉이 모두 이 기준에 묶인다 */
var MK_ASOF=window.TETH_PX?TETH_PX.asof.split('-').map(Number):[2026,9,28], MK_DATA_V=window.TETH_PX?TETH_PX.v:'2026-09-28.1', MK_D0=null, MK_D0K='';
function idxToDate(i){ var dk=MK_ASOF.join('-')+'|'+PRICE0.length+'|'+MK_DATA_V; if(!MK_D0||MK_D0K!==dk){ MK_D0K=dk; MK_D0=new Date(MK_ASOF[0],MK_ASOF[1]-1,MK_ASOF[2]); MK_D0.setDate(MK_D0.getDate()-(PRICE0.length-1)); } var t=new Date(MK_D0.getTime()); t.setDate(t.getDate()+i); return t; }
function mkMD(i){ var d=idxToDate(i); return (d.getMonth()+1)+'월 '+d.getDate()+'일'; }
function mkUni(s){ return MK_UNI[s.uni]||{label:s.asset||'',list:s.asset?[s.asset]:[]}; }
function mkScope(s){ return s.kind==='rule'||!s.uni?s.asset:mkUni(s).label; }
function mkJ(w,a,b){ var c=String(w).charCodeAt(String(w).length-1); if(c<0xAC00||c>0xD7A3) return w+a; return w+(((c-0xAC00)%28)?a:b); }
function mkPct0(v,d){ var n=d!=null?d:1, x=+v.toFixed(n); return (x>0?'+':'')+x.toFixed(n)+'%'; }
function mkSign(v){ var x=+v.toFixed(1); return x>0?' mk-up':x<0?' mk-dn':''; }

/* ── 데이터 ── */
function mkRunCfg(c,startI){
  var st=startI!=null?startI:c.startI;
  if(c.kind==='agent') return mkAgentRun({uni:MK_UNI[c.uni].list,look:c.look,top:c.top,gate:c.gate,every:c.every,trail:c.trail,volT:c.volT,minS:c.minS,startI:st});
  if(c.kind==='mix') return mkHybridRun({uni:MK_UNI[c.uni].list,every:c.every,look:c.look,rsiTh:c.rsiTh,tp:c.tp,sl:c.sl,gate:c.gate,startI:st});
  return mkRuleRun({asset:c.asset,rsiTh:c.rsiTh,tp:c.tp,sl:c.sl,tf:!!c.tf,fng:c.fng,startI:st});
}
/* 캐시 키: 전략 ID, 행동 값 전체, 쓰는 자산의 가격 설정, 마지막 봉, 비용 */
function mkSig(s){ if(!s.cfg) return tfSS3Rid(s)+'|'+(s.p?JSON.stringify(s.p):'')+'|'+((s.r&&s.r.eq||[]).length); var c=s.cfg, ks=c.asset?[c.asset]:MK_UNI[c.uni].list; return c.id+'|'+JSON.stringify(c)+'|'+ks.map(function(k){ return (MK_PX_CFG[k]||[]).join('/'); }).join(',')+'|'+PRICE0.length+'|'+MK_FEE+'|'+MK_DATA_V; }
/* 카탈로그나 가격 설정이 바뀌면 시드, 목록, 기간 계산을 함께 버린다 */
var MK_CATSIG=null;
function mkCatSig(){ return JSON.stringify(MK_CAT)+JSON.stringify(MK_PX_CFG)+MK_DATA_V+MK_FEE+'|'+PRICE0.length+'|'+MK_ASOF.join('-'); }
function tfRankSeeds(){
  var sig=mkCatSig(); if(TF_SEEDS&&MK_CATSIG===sig) return TF_SEEDS;
  MK_CATSIG=sig; TF_SS_CACHE=null; MK_PDC={};
  TF_SEEDS=MK_CAT.map(function(c,k){
    var r=mkRunCfg(c);
    return {id:c.id,ord:k+1,kind:c.kind,mkt:c.mkt,nick:c.name,name:c.name,one:c.one,asset:c.kind==='rule'?c.asset:MK_UNI[c.uni].label,uni:c.uni||null,cfg:c,ex:c.ex,p:null,fw:c.fw,by:c.by||'',score:tfScore(r),ret:r.ret,mdd:r.mdd,n:r.n,r:r};
  });
  mkMigrate();
  return TF_SEEDS;
}
/* 저장된 즐겨찾기와 따라가기의 이름을 현재 이름으로 맞춘다(별칭으로 찾을 수 있는 것만). 돈과 기록은 건드리지 않는다 */
function mkMigrate(){
  try{ var t=tfS(), ch=false, canon=function(n){ var id=MK_ALIAS[n]||n; for(var i=0;i<MK_CAT.length;i++) if(MK_CAT[i].id===id) return MK_CAT[i].name; return n; };
    if(t.watch){ var w=[]; t.watch.forEach(function(n){ var c=canon(n); if(c!==n) ch=true; if(w.indexOf(c)<0) w.push(c); else ch=true; }); t.watch=w; }
    if(t.cp&&t.cp.copies) t.cp.copies.forEach(function(c){ var n=canon(c.nick); if(n!==c.nick){ c.nick0=c.nick; c.nick=n; ch=true; }
      /* 데이터 세대가 바뀌면 저장된 봉 번호를 같은 날짜의 새 봉 번호로 옮긴다 */
      var g=c.gen, now={asof:MK_ASOF.slice(),len:PRICE0.length};
      if(!g){ g=c.gen={asof:MK_GEN0.asof.slice(),len:MK_GEN0.len}; ch=true; }
      if(g.len!==now.len||g.asof.join('-')!==now.asof.join('-')){ var d0=new Date(g.asof[0],g.asof[1]-1,g.asof[2]), d1=new Date(now.asof[0],now.asof[1]-1,now.asof[2]), sh=(now.len-g.len)-Math.round((d1-d0)/86400000); ['simStartI','flatI','endI','stopI'].forEach(function(k){ if(c[k]!=null) c[k]=Math.max(0,Math.min(now.len-1,c[k]+sh)); }); if(c.flats) c.flats=c.flats.map(function(x){ return Math.max(0,Math.min(now.len-1,x+sh)); }); (c.ledger||[]).forEach(function(e){ if(e.i!=null) e.i=Math.max(0,Math.min(now.len-1,e.i+sh)); }); c.gen=now; ch=true; }
      /* 봉 번호가 없는 입출금(이전 형식)은 첫 건을 시작 봉, 나머지를 마지막 봉으로 본다 */
      (c.ledger||[]).forEach(function(e,ix){ if(e.i==null){ e.i=(ix===0&&c.simStartI!=null)?c.simStartI:now.len-1; ch=true; } }); });
    if(ch) tfSave(); }catch(e){}
}
function tfSSRows(){
  tfRankSeeds();
  if(!TF_SS_CACHE) TF_SS_CACHE=tfRankSeeds().map(function(s){ var o={}; for(var k in s) o[k]=s[k]; return o; });
  var t=tfSSState(), rows=TF_SS_CACHE.slice();
  if(t.shared&&t.sharedSnap){
    var sn=t.sharedSnap;
    rows.push({nick:(S.user&&S.user.name)||'나',title:sn.name,desc:sn.desc,asset:sn.asset,kind:'rule',mkt:'crypto',p:sn.p,fw:t.followers||0,score:sn.score,me:true,
      r:sn.p?runBacktest(sn.p):{ret:sn.ret,mdd:sn.mdd,n:sn.n,winRate:sn.winRate||0,eq:null,trades:[],byYear:{},pf:0,avgHold:0,lossCount:0}});
  }
  return rows;
}
/* 조회: 전략 ID, 현재 이름, 옛 이름(별칭) 모두 같은 전략을 돌려준다 */
function tfSSFind(nick){
  if(nick==='mine') return typeof btMine==='function'?btMine():null; /* 대화로 만든 내 전략(아직 공개 전) */
  var rows=tfSSRows();
  if(nick==='me'){
    for(var k=0;k<rows.length;k++) if(rows[k].me) return rows[k];
    var t0=tfS(), sn0=t0.sharedSnap;
    if(sn0) return {nick:(S.user&&S.user.name)||'나',title:sn0.name,desc:sn0.desc,asset:sn0.asset,kind:'rule',p:sn0.p,fw:t0.followers||0,score:sn0.score,me:true,
      r:sn0.p?runBacktest(sn0.p):{ret:sn0.ret,mdd:sn0.mdd,n:sn0.n,winRate:sn0.winRate||0,eq:null,trades:[],byYear:{},pf:0,avgHold:0,lossCount:0}};
    return null;
  }
  var id=MK_ALIAS[nick]||null;
  for(var i=0;i<rows.length;i++) if(!rows[i].me&&(rows[i].id===nick||rows[i].nick===nick||(id&&rows[i].id===id))) return rows[i];
  return null;
}
var MK_PDC={};

/* 30일 수익률: 매번 결과에서 바로 계산한다(값이 바뀌면 곧바로 반영) */
function mk30(s){
  var r=s.r||tfSS3PdCalc(s,'all'), e=r.eq||[], d=(e.length&&e[e.length-1].i-e[0].i===e.length-1?e:mkDaily(e,PRICE0.length-1)).slice(-31), b0=d.length?d[0].v:1;
  d=d.map(function(x){ return {i:x.i,v:x.v/b0}; });
  return {ret:d.length>1?(d[d.length-1].v-1)*100:0,eq:d};
}
function mkSortKey(t){ if(t.ss.v!==3){ t.ss.v=3; t.ss.sort='pick'; t.ss.dir='desc'; t.ss.kind='all'; t.ss.asset='all'; t.ss.risk='all'; t.ss.pd='all'; } if(!{pick:1,ret:1,fw:1,win:1}[t.ss.sort]) t.ss.sort='pick'; return t.ss.sort; }
function mkMktPick(v){ var t=tfSSState(); t.ss.asset=v; tfSave(); tfShareHub('find'); }

/* ── 식별 표현 ── */
function mkHash(str){ var h=0; str=String(str); for(var i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))>>>0; return h; }
var MK_USHAPE={coin8:'c',big3:'c',tech8:'s',macro6:'d',idx3:'d'};
function mkMark(x,y,r,sh,fill){ return sh==='s'?'<rect x="'+(x-r).toFixed(1)+'" y="'+(y-r).toFixed(1)+'" width="'+(r*2).toFixed(1)+'" height="'+(r*2).toFixed(1)+'" rx=".6" fill="'+fill+'"/>':sh==='d'?'<rect x="'+(x-r).toFixed(1)+'" y="'+(y-r).toFixed(1)+'" width="'+(r*2).toFixed(1)+'" height="'+(r*2).toFixed(1)+'" rx=".4" fill="'+fill+'" transform="rotate(45 '+x.toFixed(1)+' '+y.toFixed(1)+')"/>':'<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+r.toFixed(1)+'" fill="'+fill+'"/>'; }
function mkDots(n,cx,cy,w,h){ var cols=n<=3?n:n<=6?3:4, rows=Math.ceil(n/cols), pts=[]; for(var i=0;i<n;i++){ var c=i%cols, r=Math.floor(i/cols); pts.push([cx+(cols>1?(c/(cols-1)-.5)*w:0),cy+(rows>1?(r/(rows-1)-.5)*h:0)]); } return pts; }
/* 조건 도식: 골 깊이는 기다리는 하락의 깊이, 오른쪽 끝점의 위치는 목표 폭, 앞의 세로선은 방향 조건 */
function mkCurve(c,x0,x1,W,D){
  var th=c.rsiTh||40, dep=th<=26?19:th<=32?16:th<=40?13:th<=46?10:th<=50?7:4, tp=c.tp||8, k=tp<=5?0:tp<=8?1:tp<=15?2:3, w=x1-x0, yT=5, xb=x0+w*0.3, xe=xb+w*0.22+k*(w>15?3:1.7), sh=c.mkt==='stock'?'s':c.mkt==='index'?'d':'c';
  var o='<path d="M'+x0.toFixed(1)+' '+yT+'L'+xb.toFixed(1)+' '+(yT+dep)+'L'+xe.toFixed(1)+' '+(yT+dep-Math.min(dep,3+k*1.7)).toFixed(1)+'" fill="none" stroke="'+W+'" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>';
  o+=mkMark(xe,yT+dep-Math.min(dep,3+k*1.7),w>15?2.1:1.8,w>15?sh:'c',W);
  if(c.tf) o+='<path d="M'+(x0-1.6).toFixed(1)+' 4v20" stroke="'+D+'" stroke-width="1.4" stroke-linecap="round"/>';
  return o;
}
/* B1: 전략의 고정 설정으로 그리는 도식. 상태가 바뀌어도 같은 그림이다 */
function mkGlyphB1(s,z){
  var c=s.cfg||{}, o='', W='#e9ebee', D='rgba(233,235,238,.34)', n, P, i, sh=MK_USHAPE[s.uni]||'c';
  if(s.kind==='agent'){
    n=mkUni(s).list.length; P=mkDots(n,14,14,n<=3?14:17,n<=3?0:n<=6?8:8);
    for(i=0;i<n;i++) o+=mkMark(P[i][0],P[i][1],i<(c.top||1)?2.5:1.5,sh,i<(c.top||1)?W:D);
  } else if(s.kind==='mix'){
    n=mkUni(s).list.length; P=n<=3?mkDots(n,6.5,14,0,13):mkDots(n,7,14,6,n<=6?12:15).map(function(p,j){ var col=j%(n<=6?3:4), row=Math.floor(j/(n<=6?3:4)); return [4.500+row*5,14+(col/((n<=6?3:4)-1)-.5)*(n<=6?12:15)]; });
    for(i=0;i<n;i++) o+=mkMark(P[i][0],P[i][1],i===0?2:1.2,sh,i===0?W:D);
    o+=mkCurve(c,14.5,25,W,D);
  } else o+=mkCurve(c,5,24,W,D);
  return '<svg class="mk3-g" width="'+z+'" height="'+z+'" viewBox="0 0 28 28" aria-hidden="true"><rect x=".5" y=".5" width="27" height="27" rx="7" fill="#1a1d21" stroke="rgba(255,255,255,.14)"/>'+o+'</svg>';
}
/* B2: TETH 로고의 두 고리에서 파생한 고정 기호 */
function mkGlyph(s,z){
  z=z||28;
  if(!s.cfg) return '<svg class="mk3-g" width="'+z+'" height="'+z+'" viewBox="0 0 28 28" aria-hidden="true"><rect x=".5" y=".5" width="27" height="27" rx="7" fill="#1a1d21" stroke="rgba(255,255,255,.14)"/><path d="M8 14h12M14 8v12" stroke="#e9ebee" stroke-width="1.7" stroke-linecap="round"/></svg>';
  return mkGlyphB1(s,z);
}

/* ── 현재 상태 한 줄 (카드) ── */
function mkWaitWhy(q,tf){ return !q?'조건 대기':!q.rsiOk?'하락 대기':!q.bounceOk?'반등 대기':(tf&&!q.trendOk)?'방향 대기':q.mktOk===false?'시장 약세로 보류':'조건 대기'; }
function mkWaitPlain(q,tf){ return !q?'조건이 맞기를 기다리는 중':!q.rsiOk?'가격이 내려오기를 기다리는 중':!q.bounceOk?'다시 오르기를 기다리는 중':(tf&&!q.trendOk)?'흐름이 뚜렷해지기를 기다리는 중':q.mktOk===false?'시장이 약해 기다리는 중':'조건이 맞기를 기다리는 중'; }
function mkNowLine(s){
  var r=s.r||{}, st=r.state; if(!st) return s.me?'내가 공유한 전략':'';
  var pos=function(){ return ''; };
  if(s.kind==='agent'){ if(st.open.length) return st.open.map(function(o){ return mkTk(o.k); }).join(', ')+' 보유 중'; return st.scan&&st.scan.weak?'시장이 약해 기다리는 중':'살 종목을 찾는 중'; }
  if(st.open) return mkTk(st.open.k)+' 보유 중';
  if(s.kind==='mix') return st.pick?mkTk(st.pick)+', '+mkWaitPlain(st.cond,false):'고를 종목이 없어 기다리는 중';
  return mkWaitPlain(st.cond,s.cfg&&s.cfg.tf);
}

/* 카드의 30일 그래프.
   가로축: 30일의 하루하루를 같은 간격으로, 왼쪽 끝이 30일 전이고 오른쪽 끝이 오늘. 점을 다시 뽑거나 곡선으로 부풀리지 않는다.
   세로축: 그 30일의 최저와 최고에 맞춰 높이를 다 쓴다. 시작값(0%)은 항상 범위에 넣는다.
   0% 아래로 내려간 구간만 붉게, 그때만 0% 선을 옅게 그린다. 면은 채우지 않는다 */
function mkSpark3(eq){
  var W=170, H=78, pad=5, n=eq?eq.length:0;
  if(n<2) return '<span class="mk-spark"></span>';
  var base=eq[0].v, min=base, max=base, i;
  for(i=0;i<n;i++){ if(eq[i].v<min) min=eq[i].v; if(eq[i].v>max) max=eq[i].v; }
  if(max-min<1e-9) return '<svg class="mk-spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="'+(H/2)+'" x2="'+W+'" y2="'+(H/2)+'" stroke="rgba(255,255,255,.34)" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
  var X=function(j){ return 1+j/(n-1)*(W-2); }, Y=function(v){ return pad+(1-(v-min)/(max-min))*(H-pad*2); };
  var P=eq.map(function(e,j){ return [X(j),Y(e.v)]; });
  /* 꺾이는 곳만 살짝 둥글게(반지름 2.5). 평평한 구간은 평평하게 남는다 */
  var d='M'+P[0][0].toFixed(1)+' '+P[0][1].toFixed(1), R=2.5;
  for(i=1;i<n-1;i++){
    var a=P[i-1], b=P[i], c=P[i+1], l1=Math.sqrt((b[0]-a[0])*(b[0]-a[0])+(b[1]-a[1])*(b[1]-a[1])), l2=Math.sqrt((c[0]-b[0])*(c[0]-b[0])+(c[1]-b[1])*(c[1]-b[1]));
    var r1=Math.min(R,l1/2), r2=Math.min(R,l2/2);
    if(l1<1e-6||l2<1e-6){ d+=' L'+b[0].toFixed(1)+' '+b[1].toFixed(1); continue; }
    d+=' L'+(b[0]-(b[0]-a[0])/l1*r1).toFixed(1)+' '+(b[1]-(b[1]-a[1])/l1*r1).toFixed(1)
      +' Q'+b[0].toFixed(1)+' '+b[1].toFixed(1)+' '+(b[0]+(c[0]-b[0])/l2*r2).toFixed(1)+' '+(b[1]+(c[1]-b[1])/l2*r2).toFixed(1);
  }
  d+=' L'+P[n-1][0].toFixed(1)+' '+P[n-1][1].toFixed(1);
  var yb=Y(base), neg=min<base-1e-9, id='mk3s'+(++MK_SPARK_N), G='#2ebd85', Rd='#f0566a';
  var ln=function(col){ return '<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'; };
  if(!neg) return '<svg class="mk-spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true">'+ln(G)+'</svg>';
  return '<svg class="mk-spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true"><defs>'
    +'<clipPath id="'+id+'u"><rect x="-2" y="-2" width="'+(W+4)+'" height="'+(yb+2).toFixed(1)+'"/></clipPath>'
    +'<clipPath id="'+id+'d"><rect x="-2" y="'+yb.toFixed(1)+'" width="'+(W+4)+'" height="'+(H-yb+2).toFixed(1)+'"/></clipPath></defs>'
    +'<line x1="0" y1="'+yb.toFixed(1)+'" x2="'+W+'" y2="'+yb.toFixed(1)+'" stroke="rgba(255,255,255,.2)" stroke-width="1" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>'
    +'<g clip-path="url(#'+id+'u)">'+ln(G)+'</g><g clip-path="url(#'+id+'d)">'+ln(Rd)+'</g>'+mkFlatAtBase(eq,base,X,Y,G)+'</svg>';
}
/* ── 카드 ── */
/* 수익 낸 거래를 횟수로 말한다. 10번 미만은 실제 횟수 그대로, 그 이상은 10번 기준으로 환산 */
function mkWinTxt(r){
  var n=r&&r.n||0, w=r&&r.winRate; if(!n||typeof w!=='number'||!isFinite(w)) return '';
  if(n<10) return n+'번 중 '+Math.round(w*n/100)+'번';
  if(w<=0) return n.toLocaleString()+'번 중 0번'; if(w>=100) return n.toLocaleString()+'번 모두';
  var k=Math.round(w/10); if((k===0&&w>0)||(k===10&&w<100)) return w<1?'1% 미만':w>99?'99% 넘게':Math.round(w)+'%';
  return '10번 중 약 '+k+'번';
}
function mkFwTxt(n){ n=+n||0; if(n<=0) return ''; return (n>=10000?'약 '+(Math.round(n/1000)/10)+'만 명':n.toLocaleString()+'명')+'이 따라가는 중'; }
function mkCard(s){
  if(!s.kind) s.kind='rule';
  var r=tfSS3PdCalc(s,'all'), m30=mk30(s), ne=tfSS3Rid(s), ex=mkEx(s), win=mkWinTxt(r), fw=mkFwTxt(s.fw);
  var bF='<button type="button" class="mk3-b" onclick="cpSetupGo(\''+ne+'\')">따라가기</button>', bD='<button type="button" class="mk3-b fill" onclick="tfSS3Go(\''+ne+'\')">자세히</button>';
  return '<article class="mk-card mk3 mk3v2 k-'+s.kind+'">'
    +'<div class="mk3-head">'+mkGlyph(s,28)+'<h3><button type="button" class="mk-c-tb mk3-t" onclick="tfSS3Go(\''+ne+'\')">'+gEsc(mkHook(s))+'</button></h3></div>'
    +'<div class="mk3-meta">'+(s.by?'<span class="mk3-by">@'+gEsc(s.by)+'</span>':'')+'<span class="mk3-ex"><img src="assets/logos/'+ex[0]+'.png" alt="" width="12" height="12" loading="lazy">'+ex[1]+'에서 실행</span></div>'
    +'<div class="mk3-how"><b>'+MK_KIND[s.kind]+'</b><span>'+gEsc(mkScope(s))+'</span></div>'
    +'<p class="mk-c-one mk3-one">'+gEsc(mkOne(s)).replace(/%(?=[가-힣])/g,'%⁠')+'</p>'
    +'<div class="mk3-now"><small>지금</small><span>'+gEsc(mkNowLine(s)).replace(/ (\S+) 중$/,' $1&nbsp;중')+'</span></div>'
    +'<div class="mk3-perf"><div class="mk-c-ret mk3-ret"><small>30일 수익률</small><b class="num'+mkSign(m30.ret)+'">'+mkPct0(m30.ret)+'</b></div>'+mkSpark3(m30.eq)+'</div>'
    +'<div class="mk3-facts">'+(win?'<div><small>전체 기간 수익 낸 거래</small><b class="num">'+win+'</b></div>':'')+(fw?mkFwHtml(s.fw):'')+'</div>'
    +'<div class="mk3-foot">'+(s.me?'':bF)+bD+'</div>'
    +'</article>';
}
var MK_WIN_MIN=20; /* 승률 정렬에서 앞에 설 수 있는 최소 거래 수 */
/* 추천순은 방향을 바꾸지 않는다 */
function tfSS3SortPick(v){
  var t=tfSSState();
  if(v==='pick'){ t.ss.sort='pick'; t.ss.dir='desc'; }
  else if(t.ss.sort===v){ t.ss.dir=t.ss.dir==='asc'?'desc':'asc'; }
  else { t.ss.sort=v; t.ss.dir='desc'; }
  tfSave(); tfShareHub('find');
}
function tfSS3GridHtml(){
  var t=tfSSState(), rows=tfSSRows(); mkSortKey(t);
  if(t.ss.asset&&t.ss.asset!=='all') rows=rows.filter(function(s){ return s.mkt===t.ss.asset; });
  if(t.ss.kind&&t.ss.kind!=='all') rows=rows.filter(function(s){ return (s.kind||'rule')===t.ss.kind; });
  if(TF_SS_Q){ var q=TF_SS_Q.toLowerCase(); rows=rows.filter(function(s){ return [s.nick,s.asset,mkTitle(s),s.one||'',s.by?'@'+s.by:'',s.id||'',mkOldNames(s.id),MK_KIND[s.kind]||'',mkUni(s).list.join(' '),mkUni(s).list.map(mkTk).join(' '),mkTk(s.asset||'')].join(' ').toLowerCase().indexOf(q)>=0; }); }
  var f={pick:function(a,b){return (a.ord||0)-(b.ord||0);},
    ret:function(a,b){return mk30(b).ret-mk30(a).ret;},
    fw:function(a,b){return (b.fw||0)-(a.fw||0);},
    win:function(a,b){return (b.r.winRate||0)-(a.r.winRate||0);}}[mkSortKey(t)];
  rows.sort(f);
  if(t.ss.dir==='asc') rows.reverse();
  if(!rows.length) return '<div class="ss3-empty">조건에 맞는 전략이 없어요<br><button type="button" class="mk-btn2" style="margin-top:16px" onclick="tfSS3Reset()">필터 초기화</button></div>';
  var PER=10, MAXP=10; /* 2열 5행 */
  /* 필터와 검색이 없을 때만 20종을 10페이지로 반복한다. 정렬은 반복 전에 끝낸다. 모든 페이지가 같은 전략 ID 를 가리킨다 */
  var plain=(!t.ss.asset||t.ss.asset==='all')&&(!t.ss.kind||t.ss.kind==='all')&&!TF_SS_Q;
  if(plain){ var base=rows.filter(function(s){ return !s.me; }), all=rows.slice(); for(var rp=1;rp<MAXP&&base.length;rp++) all=all.concat(base); rows=all; }
  rows=rows.slice(0,PER*MAXP);
  if(mkSortKey(t)==='win'){ var few=function(s){ return ((s.r&&s.r.n)||0)<MK_WIN_MIN; }; rows=rows.filter(function(s){ return !few(s); }).concat(rows.filter(few)); }
  var sig=[t.ss.asset,t.ss.kind,TF_SS_Q,mkSortKey(t),t.ss.dir].join('|'); if(t.ss.pgSig!==sig){ t.ss.pgSig=sig; t.ss.page=1; }
  var pages=Math.max(1,Math.ceil(rows.length/PER)), pg=Math.min(pages,Math.max(1,t.ss.page||1)); t.ss.page=pg;
  var pager='';
  if(pages>1){
    var b=function(i,lb,cls,dis){ return '<button type="button" class="mk-pg'+(cls||'')+'"'+(dis?' disabled':'')+(i===pg&&!cls?' aria-current="page"':'')+' aria-label="'+(lb==='‹'?'이전 페이지':lb==='›'?'다음 페이지':lb+'페이지')+'" onclick="tfSS3Page('+i+')">'+lb+'</button>'; };
    pager='<nav class="mk-pager" aria-label="페이지">'+b(pg-1,'‹',' nav',pg<=1);
    for(var i=1;i<=pages;i++) pager+=b(i,String(i));
    pager+=b(pg+1,'›',' nav',pg>=pages)+'</nav>';
  }
  return '<div class="mk-grid mk3-grid">'+rows.slice((pg-1)*PER,pg*PER).map(mkCard).join('')+'</div>'+pager;
}
/* 목록 위 조작 줄: 판단 방식이 첫 번째 기준 */
function mk3Controls(t){
  var sort=mkSortKey(t), kind=t.ss.kind||'all', cnt={all:0,agent:0,rule:0,mix:0};
  tfSSRows().forEach(function(s){ if(s.me) return; cnt.all++; cnt[s.kind||'rule']++; });
  return '<div class="mk-bar mk3-bar">'
    +'<div class="mk3-kindrow"><div class="mk3-seg" role="group" aria-label="판단 방식">'+[['all','전체'],['agent','AI 판단'],['rule','차트 규칙'],['mix','혼합 전략']].map(function(o){ var on=kind===o[0]; return '<button type="button" aria-pressed="'+on+'" onclick="mkKindPick(\''+o[0]+'\')">'+o[1]+'<i class="num">'+cnt[o[0]]+'</i></button>'; }).join('')+'</div>'
    +'<p class="mk3-kindhelp">'+({all:'AI 판단은 AI가 종목과 비중을 정해요. 차트 규칙은 정해 둔 가격 조건만 따라요. 혼합 전략은 AI가 종목을 고르고 규칙이 시점을 정하되, 조건이 맞아도 시장이 위험하면 AI가 진입을 보류해요.',agent:'여러 종목을 비교해 무엇을 얼마나 들지 AI가 정해요. 시장이 약하면 새로 사지 않아요.',rule:'정해 둔 자산에서 정해 둔 조건이 맞을 때만 사고팔아요. AI는 끼어들지 않아요.',mix:'거래할 종목은 AI가 고르고, 사고파는 시점은 규칙이 정해요. 규칙 조건이 맞아도 큰 악재나 약한 시장이면 AI가 진입을 보류해요.'}[kind])+'</p></div>'
    +'<div class="mk-flt mk3-flt">'
    +'<div class="mk-chips" aria-label="정렬"><span class="lb">정렬</span>'+[['pick','추천순'],['ret','30일 수익률'],['fw','따라가는 사람'],['win','거래 승률']].map(function(o){ var on=sort===o[0]; return '<button type="button" class="mk-chip'+(on?' on':'')+'" aria-pressed="'+on+'" onclick="tfSS3SortPick(\''+o[0]+'\')">'+o[1]+(on&&o[0]!=='pick'?(t.ss.dir==='asc'?' ↑':' ↓'):'')+'</button>'; }).join('')+'</div>'
    +tfBkDrop('ss3-m-asset',[['all','시장 전체'],['crypto','가상자산'],['stock','미국 주식'],['index','지수와 금'],['multi','여러 시장']],t.ss.asset||'all','mkMktPick')
    +'<button type="button" class="mk-search-toggle" aria-label="전략 검색" aria-expanded="false" onclick="tfMkSearchToggle(this)">⌕</button><label class="ss3-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>'
    +'<input id="ss3-q" type="search" placeholder="이름, 종목, 등록자 검색" value="'+gEsc(TF_SS_Q||'')+'" aria-label="전략 검색" oninput="tfSS3Search(this.value)"></label>'
    +'</div></div>';
}
/* 첫 배너의 그림: 세 판단 방식의 도식(카드의 식별 도식과 같은 문법) */
function mkHeroArt(){
  var W='rgba(233,235,238,.92)', D='rgba(233,235,238,.30)', o='', i;
  for(i=0;i<8;i++) o+='<circle cx="'+(16+(i%4)*16)+'" cy="'+(i<4?38:58)+'" r="'+(i<3?5:3)+'" fill="'+(i<3?W:D)+'"/>';
  o+='<path d="M108 30l18 40 14-12 22-20" fill="none" stroke="'+W+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="162" cy="38" r="4.5" fill="'+W+'"/><path d="M104 78h64" stroke="'+D+'" stroke-width="2" stroke-dasharray="3 4"/>';
  for(i=0;i<3;i++) o+='<circle cx="206" cy="'+(32+i*16)+'" r="'+(i===1?5:3)+'" fill="'+(i===1?W:D)+'"/>';
  o+='<path d="M216 48h10" stroke="'+W+'" stroke-width="2.4" stroke-linecap="round"/><path d="M232 32l12 34 10-10 16-16" fill="none" stroke="'+W+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="270" cy="40" r="4.5" fill="'+W+'"/>';
  return '<svg class="mkh-art" viewBox="0 0 284 96" aria-hidden="true">'+o+'</svg>';
}
function mkHero(){
  setTimeout(function(){ mkhGo(MKH_I); mkhStart(); },0);
  var slide=function(i,cls,act,sm,b,sp,extra){ return '<button type="button" class="mkh-slide '+cls+(i===MKH_I?' on':'')+'" onclick="'+act+'"><small>'+sm+'</small><b>'+b+'</b><span>'+sp+'</span>'+(extra||'')+'</button>'; };
  return '<section class="mkh" aria-label="전략 따라하기 소개">'
    +'<div><h2>전략 따라하기</h2><p class="mkh-sub">어떤 방식으로 판단해 거래할지 골라요.</p>'
    +'<button type="button" class="mkh-note" onclick="tfBrokersView()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10v4h3l5 4V6L6 10H3z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/></svg><span>OKX 거래소 연결이 추가됐어요</span></button></div>'
    +'<div class="mkh-ban"><div class="mkh-view">'
    +slide(0,'mkh-kd mkh-k',"mkKindPick('all')",'판단 방식 세 가지','직접 고르기, 조건 실행,<br>둘을 나눠 맡기','무엇을 보고 언제 움직였는지 기록으로 남겨요','<i class="mkh-cta">판단 방식으로 고르기</i>'+mkHeroArt())
    +slide(1,'mkh-s1 mkh-k',"tfShareHub('mine')",'10월 전략 리그','내 전략을 공개하고<br>같은 조건에서 겨뤄요','10월 1일 시작, 판단 기록과 함께 공개돼요','<i class="mkh-cta">내 전략 공개하기</i>')
    +slide(2,'mkh-s3',"tfBrokersView()",'Powered by Bitget','Bitget 계정 하나로<br>주식, 옵션, 암호화폐','출금 권한 없이 주문 권한만 연결해요','<i class="mkh-cta">거래소 연결하기</i><img src="assets/logos/bitget-512.png" alt="" width="92" height="92">')
    +'</div><div class="mkh-dots" role="group" aria-label="배너 선택">'+[0,1,2].map(function(i){ return '<button type="button" aria-label="배너 '+(i+1)+'" aria-current="'+(i===MKH_I)+'" onclick="mkhPick('+i+')"></button>'; }).join('')+'</div></div>'
    +'</section>';
}

/* ── 판단 기록: 본 것, 판단, 행동 ── */
function mkTopTxt(top){ return (top||[]).slice(0,2).map(function(x){ return x.k+' '+mkPct0(x.mom,0); }).join(', '); }
var MK_WHY={trail:'든 뒤 고점에서 많이 밀렸어요',weak:'오르던 힘이 꺾였어요',rot:'순위에서 많이 밀렸어요',sl:'손절 기준까지 밀렸어요',tp:'목표까지 올랐어요',time:'25일을 채웠어요'};
function mkEvAgent(s,e){
  if(e.t==='enter'){ var g={held:[],below:[],weak:[]}, ps=[]; (e.skip||[]).forEach(function(x){ g[x.why].push(x.k); });
    if(g.below.length) ps.push(mkJ(g.below.join(', '),'은','는')+' 60일 평균 아래라 제외');
    if(g.held.length) ps.push(mkJ(g.held.join(', '),'은','는')+' 이미 보유');
    if(g.weak.length) ps.push(mkJ(g.weak.join(', '),'은','는')+' 기준 미달');
    ps.push((e.rank||1)+'위 '+e.a+' '+mkPct0(e.mom,0)+', 기준을 넘음');
    return {k:'buy',obs:e.of+'종 중 '+e.up+'종이 오름세. '+ps.join('. '),dec:mkJ(e.a,'을','를')+' 새로 골랐어요',act:'자산의 '+Math.round(e.w*100)+'%로 매수'+(e.cut?'(흔들림이 커서 비중을 줄임)':'')+', 체결가 '+mkPxFmt(e.px)}; }
  if(e.t==='exit') return {k:'sell',obs:e.a+', '+MK_WHY[e.why],dec:e.a+' 보유를 끝냈어요',act:'전량 매도, 체결가 '+mkPxFmt(e.px)+', 손익 '+mkPct0(e.pnl)};
  if(e.t==='skip'&&e.why==='gate') return {k:'wait',obs:e.of+'종 중 '+e.up+'종만 오름세',dec:'시장이 약해 새로 사지 않았어요',act:e.held.length?e.held.join(', ')+' 보유 유지':'주문 없음'};
  if(e.t==='skip') return {k:'wait',obs:'기준을 넘는 종목이 없음. 가장 강한 건 '+mkTopTxt(e.top),dec:'새로 사지 않았어요',act:e.held.length?e.held.join(', ')+' 보유 유지':'주문 없음'};
  return {k:'hold',obs:'든 종목이 여전히 상위권. 가장 강한 건 '+mkTopTxt(e.top),dec:'바꾸지 않았어요',act:e.held.join(', ')+' 보유 유지'};
}
function mkEvMix(s,e){
  var c=s.cfg, ai=s.kind==='mix';
  if(e.t==='pick') return {k:'pick',who:'AI',obs:mkUni(s).label+' 중 '+c.look+'일 동안 가장 많이 오른 건 '+mkTopTxt(e.top),dec:mkJ(e.a,'을','를')+' 거래 대상으로 골랐어요',act:'규칙이 반등을 기다리기 시작'};
  if(e.t==='unpick') return {k:'wait',who:'AI',obs:'오름세인 종목이 없음',dec:'거래 대상을 비웠어요',act:'주문 없음'};
  if(e.t==='veto') return {k:'wait',who:'AI',obs:e.a+' 반등 신호 발생. 그런데 '+e.of+'종 중 '+e.up+'종만 오름세',dec:'시장이 약해 진입을 보류했어요',act:'주문 없음'};
  if(e.t==='enter') return {k:'buy',who:ai?'규칙':null,obs:mkJ(e.a,'이','가')+' 밀렸다가(밀린 정도 '+Math.round(100-e.rsi)+') 하루 '+mkPct0(e.bounce)+' 반등',dec:'사는 조건이 맞았어요',act:'매수, 체결가 '+mkPxFmt(e.px)};
  return {k:'sell',who:ai?'규칙':null,obs:e.a+' 진입가 대비 '+mkPct0(e.chg)+'. '+MK_WHY[e.why],dec:e.why==='tp'?'목표에 닿아 팔았어요':e.why==='sl'?'손절 기준에 닿아 팔았어요':'25일째라 팔았어요',act:'전량 매도, 체결가 '+mkPxFmt(e.px)+', 손익 '+mkPct0(e.pnl)};
}
function mkEvents(s,r){
  var f=s.kind==='agent'?mkEvAgent:mkEvMix;
  return (r.events||[]).map(function(e){ var x=f(s,e); x.i=e.i; x.tid=e.tid; return x; });
}
/* 같은 결론이 이어지면 한 줄로 묶는다(유지, 대기) */
function mkEvFold(all,n){
  var out=[];
  for(var i=all.length-1;i>=0&&out.length<n;i--){ var e=all[i], p=out[out.length-1]; if(p&&(e.k==='hold'||e.k==='wait')&&p.k===e.k&&p.dec===e.dec){ p.cnt=(p.cnt||1)+1; p.from=e.i; continue; } out.push({i:e.i,k:e.k,who:e.who,obs:e.obs,dec:e.dec,act:e.act}); }
  return out;
}
function mkEvRow(e,first){
  return '<li class="mk3-ev'+(first?' first':'')+' e-'+e.k+'"><div class="mk3-ev-d num">'+mkMD(e.i)+(e.cnt?'<small>'+mkMD(e.from)+'부터, '+e.cnt+'번</small>':'')+'</div>'
    +'<div class="mk3-ev-b"><b>'+(e.who?'<i>'+e.who+'</i>':'')+gEsc(e.dec)+'</b><span>'+gEsc(e.obs)+'</span><em>'+gEsc(e.act)+'</em></div></li>';
}

/* ── 상세: 하는 일, 지금, 움직이는 방식 ── */
function mkDepth(th){ return th<=32?'크게':th<=44?'깊게':'조금'; }
function mkDoes(s){
  var c=s.cfg||{}, u=mkUni(s);
  if(s.kind==='agent') return [['보는 것',u.label+'의 최근 '+c.look+'일 흐름과 흔들림. '+u.list.join(', ')],['AI가 정하는 것','무엇을 살지, 얼마나 살지, 언제 바꿀지. 오름폭을 흔들림으로 나눠 순위를 매기고, 한 번에 최대 '+c.top+'종목'],['바뀌지 않는 한도','든 뒤 고점에서 '+c.trail+'% 밀리면 팔아요. 오르는 종목이 '+Math.round(c.gate*100)+'% 미만이면 새로 사지 않아요']];
  if(s.kind==='mix') return [['AI가 정하는 것','거래할 종목 하나. '+u.label+' 가운데 60일 평균 가격 위에 있고 '+c.look+'일 동안 가장 많이 오른 종목. 보유하지 않을 때 '+c.every+'일마다 다시 골라요'+(c.gate?'. 규칙 조건이 맞아도 시장이 약하면 진입을 보류해요':'')],['규칙이 정하는 것','사는 때와 파는 때. 고른 종목이 밀렸다가 반등하면 사요'],['바뀌지 않는 한도',c.tp+'% 오르거나 '+Math.abs(c.sl)+'% 밀린 날 팔아요. 길어도 25일']];
  if(s.cfg) return [['보는 것',s.asset+' 가격 하나'],['정해 둔 조건',mkDepth(c.rsiTh)+' 밀린 뒤 하루 0.5% 넘게 반등하면 사요'+(c.tf?'. 가격이 한쪽으로 뚜렷하게 움직이는 때에만':'')],['바뀌지 않는 한도',c.tp+'% 오르거나 '+Math.abs(c.sl)+'% 밀린 날 팔아요. 길어도 25일']];
  return [];
}
function mkHowRows(s){
  var c=s.cfg||{};
  if(s.kind==='agent') return [['언제 사나',(c.every===1?'매일':c.every+'일마다')+' 종목을 다시 비교해서, 흐름이 강한 종목이 기준을 넘을 때'],['언제 파나','재평가 날에 든 종목의 힘이 꺾였거나 순위가 '+(c.top+2)+'위 밖이면 팔아요. 고점에서 '+c.trail+'% 밀리면 그날 바로 팔아요'],['언제 쉬나','오르는 종목이 '+Math.round(c.gate*100)+'%가 안 될 때. 새로 사지 않고, 든 종목의 정리 조건은 계속 확인해요'],['얼마나 사나','살 때 한 종목에 자산의 최대 '+Math.round(100/c.top)+'%. 든 뒤에는 가격에 따라 비중이 변해요']];
  if(s.kind==='mix') return [['누가 고르나','AI가 '+c.every+'일마다 거래할 종목을 다시 골라요. 보유 중에는 바꾸지 않아요'],['언제 사나','고른 종목이 밀렸다가 하루 0.5% 넘게 반등한 날'+(c.gate?'. 단, 오르는 종목이 '+Math.round(c.gate*100)+'% 미만이면 AI가 보류':'')],['언제 파나',c.tp+'% 오르거나 '+Math.abs(c.sl)+'% 밀린 날, 아니면 25일째'],['얼마나 사나','한 번에 한 종목, 가진 금액 전부']];
  if(s.cfg) return [['언제 사나',mkJ(s.asset,'이','가')+' '+mkDepth(c.rsiTh)+' 밀린 뒤 하루 0.5% 넘게 반등하면'],['언제 파나',c.tp+'% 오르거나 '+Math.abs(c.sl)+'% 밀린 날, 아니면 25일째'],['언제 쉬나','조건이 맞지 않는 동안'+(c.tf?'. 가격 방향이 애매할 때도 쉬어요':'')],['얼마나 사나','한 번에 가진 금액 전부']];
  return [];
}
/* 값과 기준을 나란히 쓸 때: 기준과 구별될 때까지 소수 자리를 늘리고, 그래도 같아 보이면 위아래를 말로 붙인다 */
function mkVs(v,th,unit,plus,minD){ var d=Math.max(1,minD||0), s, t2; for(;d<=6;d++){ s=v.toFixed(d); t2=th.toFixed(d); if(s!==t2) break; } if(d>6){ d=6; s=v.toFixed(6); } s=s.replace(/(\.\d*?[1-9])0+$/,'$1').replace(/\.0+$/,''); if(minD){ if(d<=minD) s=v.toFixed(minD); } else if(d<=1&&Math.abs(v-th)>=1.5) s=String(Math.round(v)); return (plus&&v>0?'+':'')+s+unit+(v.toFixed(6)===th.toFixed(6)?(v>th?' (기준 바로 위)':v<th?' (기준 바로 아래)':' (기준과 같음)'):''); }
/* 조건까지의 위치: 밀린 정도(100 - RSI)를 0~100 선 위의 점으로, 기준은 세로선. 채워지는 진행 막대가 아니다 */
function mkGauge(q,th){
  var cur=Math.max(0,Math.min(100,100-q.rsi)), need=100-th;
  var tx='밀린 정도 '+mkVs(100-q.rsi,need,'')+', 기준 '+need+' 초과';
  return '<span class="mk3-gauge" role="img" aria-label="'+tx+'"><u style="left:'+need.toFixed(0)+'%"></u><i style="left:'+cur.toFixed(0)+'%"></i></span><span class="mk3-gauge-t num">'+tx+'</span>';
}
function mkCondRows(q,c,row){
  var o='';
  o+=row('충분히 밀렸나',(q.rsiOk?'<b>예</b>':'아직 아니에요')+mkGauge(q,c.rsiTh));
  o+=row('반등했나',(q.bounceOk?'<b>예</b>':'아직 아니에요')+'<span class="mk3-gauge-t num">하루 '+mkVs(q.bounce,0.5,'%',true,2)+', 기준 +0.5% 초과</span>');
  if(c.tf) o+=row('방향이 뚜렷한가',(q.trendOk?'<b>예</b>':'아직 아니에요')+'<span class="mk3-gauge-t num">평균선 간격 '+mkVs(q.gap,3,'%',false,1)+', 기준 3% 초과</span>');
  if(c.gate&&q.of>1) o+=row('시장이 받쳐 주나',(q.mktOk?'<b>예</b>':'아니에요, AI가 진입을 보류해요')+'<span class="mk3-gauge-t num">'+q.of+'종 중 '+q.up+'종이 오름세, 기준 '+Math.ceil(c.gate*q.of)+'종 이상</span>');
  return o;
}
function mkNowPanel(s,r){
  var st=r.state, end=PRICE0.length-1, rows='', head='', c=s.cfg||{};
  var row=function(k,v){ return '<div class="mk3-kv"><small>'+k+'</small><span>'+v+'</span></div>'; };
  if(!st) return '';
  if(s.kind==='agent'){
    head=st.open.length?st.open.length+'종목 보유 중':(st.scan.weak?'시장이 약해 기다리는 중':'살 종목을 찾는 중');
    rows+=row('지금 든 것',st.open.length?st.open.map(function(o){ return '<b>'+gEsc(mkTk(o.k))+'</b> 자산의 '+Math.round(o.w*100)+'%, <i class="num'+mkSign(o.chg)+'">'+mkPct0(o.chg)+'</i>'; }).join('<br>'):'없음, 현금 '+Math.round(st.cash*100)+'%');
    rows+=row('다음 재평가',mkMD(st.nextEval)+' 장 마감'+(st.lastEval<end?', 마지막 재평가 '+mkMD(st.lastEval):''));
    rows+=row('보는 종목','<span class="mk3-ulist">'+st.scan.rows.map(function(x){ return '<span class="'+(x.held?'h':x.ok?'c':'')+'"><b>'+x.rank+'</b>'+gEsc(mkTk(x.k))+'<i class="num">'+mkPct0(x.mom,0)+'</i><em>'+(x.held?'보유':x.ok?'후보':x.above?'기준 미달':'평균 아래')+'</em></span>'; }).join('')+'</span><span class="mk3-gauge-t">숫자는 최근 '+c.look+'일 오름폭, 순서는 오름폭을 흔들림으로 나눈 값이에요. 60일 평균 가격보다 낮은 종목(평균 아래)은 사지 않아요.</span>');
  } else if(s.kind==='mix'){
    var step=st.open?3:st.pick?2:1, q=st.cond;
    head=st.open?gEsc(mkTk(st.open.k))+' 보유 중':st.pick?gEsc(mkTk(st.pick))+', '+mkWaitPlain(q,false):'고를 종목을 찾는 중';
    rows+='<ol class="mk3-steps"><li class="'+(step===1?'on':'done')+'"><small>AI</small><b>종목 고르기</b><span>'+(st.pick?gEsc(mkTk(st.pick)):'오름세 종목 없음')+'</span></li><li class="'+(step===2?'on':step>2?'done':'')+'"><small>규칙</small><b>반등 기다리기</b><span>'+(step===2?mkWaitWhy(q,false):step>2?'조건 충족':'')+'</span></li><li class="'+(step===3?'on':'')+'"><small>규칙</small><b>보유와 정리</b><span>'+(st.open?'<i class="num'+mkSign(st.open.chg)+'">'+mkPct0(st.open.chg)+'</i>, '+st.open.held+'일째':'')+'</span></li></ol>';
    if(st.top&&st.top.length&&st.topAt!=null) rows+=row('고를 때 본 것',mkMD(st.topAt)+'에 비교한 '+c.look+'일 오름폭. '+st.top.map(function(x){ return gEsc(mkTk(x.k))+' <i class="num">'+mkPct0(x.mom,0)+'</i>'; }).join(', '));
    if(st.open) rows+=row('정리 조건','+'+c.tp+'% 또는 '+c.sl+'%, 아니면 '+Math.max(0,25-st.open.held)+'일 뒤');
    else if(q) rows+=mkCondRows(q,c,row);
    rows+=row('다음 일정','규칙 확인 '+mkMD(end+1)+(st.open?'':', 종목 재선택 '+mkMD(st.nextEval)));
  } else {
    var q2=st.cond;
    if(st.open){ head=gEsc(mkTk(st.open.k))+' 보유 중'; rows+=row('진입',mkMD(st.open.entry)+', '+mkPxFmt(st.open.ep)); rows+=row('지금 손익','<i class="num'+mkSign(st.open.chg)+'">'+mkPct0(st.open.chg)+'</i>, '+st.open.held+'일째'); rows+=row('정리 조건','+'+c.tp+'% 또는 '+c.sl+'%, 아니면 '+Math.max(0,25-st.open.held)+'일 뒤'); }
    else { head=mkWaitPlain(q2,c.tf); rows+=mkCondRows(q2,c,row); }
    rows+=row('다음 확인',mkMD(end+1)+' 장 마감');
  }
  return '<section class="mk3-panel mk3-nowp"><div class="mk3-nowh"><h3>지금</h3><span class="mk3-asof num">'+mkMD(end)+' 장 마감 기준</span></div><p class="mk3-state">'+head+'</p>'+rows+'</section>';
}
function mk3Head(s,ne,pd,watching){
  watching=!!S.user&&(tfS().watch||[]).indexOf(s.nick)>=0; /* 어떤 주소로 들어와도 현재 이름으로 판정. 비로그인은 저장하지 않는다 */
  var ex=mkEx(s);
  return '<header class="mk-d-head mk3-dh">'
    +'<div class="mk3-dh-top">'+mkGlyph(s,44)+'<div class="mk3-dh-t"><h2>'+gEsc(mkHook(s))+'</h2><p><b>'+(MK_KIND[s.kind]||'차트 규칙')+'</b><span>'+gEsc(mkScope(s))+'</span>'+(s.by?'<span class="mk3-by">@'+gEsc(s.by)+' 등록</span>':'')+'</p></div>'
    +'<button type="button" class="mkd-ic" aria-label="링크 복사" onclick="tfSS3CopyLink(\''+ne+'\',\''+pd+'\')"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8 11l8-4M8 13l8 4"/></svg></button>'
    +(s.me?'':'<button type="button" class="mkd-fav" aria-pressed="'+watching+'" onclick="tfSS3WatchTgl(\''+ne+'\');mkWatchSync(\''+ne+'\')">★ 즐겨찾기</button>')+'</div>'
    +'<p class="mk3-dh-one">'+gEsc(mkOne(s))+'</p>'
    +'<div class="mk-d-acts mk3-dh-acts">'
    +(s.me?'<span class="ss3-st">내가 공유한 전략</span>':'<button type="button" class="mk-pri" onclick="cpSetupGo(\''+ne+'\')">따라가기</button>'+(s.cfg?'<button type="button" class="mk3-bt" onclick="btOpen(\''+ne+'\')">내 조건으로 백테스트</button>':''))
    +'<span class="mk3-dh-meta"><span class="mk-xtag"><img src="assets/logos/'+ex[0]+'.png" alt="" width="16" height="16">'+mkdTerm(ex[1],MK_TIP.ex)+'</span><span>최소 '+mkMin(s)+' USDT</span><span>'+mkdSince(s)+' 시작</span></span>'
    +'<div class="mk-more"><button type="button" class="mk-more-b" id="mk-menu-b" aria-haspopup="menu" aria-expanded="false" aria-label="더 보기" onclick="mkMenuTgl(event)">⋯</button>'
    +'<div class="mk-menu" id="mk-menu" role="menu" hidden>'
    +'<button type="button" role="menuitem" onclick="tfSS3Ask(\''+ne+'\',\''+pd+'\')">TETH에게 분석시키기</button>'
    +(s.me?'':'<button type="button" role="menuitem" id="ss3-watch-btn" aria-pressed="'+watching+'" onclick="tfSS3WatchTgl(\''+ne+'\');mkWatchSync(\''+ne+'\')">'+tfSS3WatchLb(watching)+'</button>')
    +'<button type="button" role="menuitem" onclick="tfSS3CopyLink(\''+ne+'\',\''+pd+'\')">링크 복사</button>'
    +(s.me||!s.p?'':'<button type="button" role="menuitem" onclick="tfSS3Copy(\''+ne+'\')">설정 가져오기</button>')
    +'</div></div></div>'
    +'</header>';
}

/* 활동 탭: 판단 기록 전체 */
function mkLogTab(s,r){
  var R0=s.r||r, out=mkEvFold(mkEvents(s,R0),120);
  if(!out.length) return '<div class="ss3-empty">아직 판단 기록이 없어요</div>';
  return '<div class="mk-sec-hd"><b>판단 기록</b><span class="mt2">최근 '+out.length+'건, 최신순</span></div><ol class="mk3-evs mk3-evs-all">'+out.map(function(e){ return mkEvRow(e,false); }).join('')+'</ol>';
}
function mkTradesTable(s,r,limit){
  var tr=(r.trades||[]).slice(); if(limit) tr=tr.slice(-limit); tr.reverse();
  var KN={sl:'손절',tp:'익절',time:'기간 청산',trail:'고점 이탈',weak:'힘 약화',rot:'순위 밀림'};
  return '<div class="mk-tblw"><table class="ss3-tbl"><thead><tr><th>진입일</th><th>청산일</th><th>보유</th><th>자산</th><th>구분</th><th style="text-align:right">진입가</th><th style="text-align:right">청산가</th><th style="text-align:right">손익률</th></tr></thead><tbody>'
    +(tr.length?tr.map(function(x){
      var p1=x.ep!=null?x.ep:PRICE[x.entry], p2=x.xp!=null?x.xp:PRICE[x.exit];
      return '<tr><td>'+mkDate(x.entry)+'</td><td>'+mkDate(x.exit)+'</td><td>'+(x.exit-x.entry)+'일</td><td>'+gEsc(x.asset||s.asset)+'</td><td>'+(KN[x.kind]||x.kind)+'</td>'
        +'<td style="text-align:right">'+mkPxFmt(p1)+'</td><td style="text-align:right">'+mkPxFmt(p2)+'</td>'
        +'<td class="'+(x.pnl>=0?'up':'dn')+'" style="text-align:right">'+mkPct(x.pnl*100,2)+'</td></tr>';
    }).join(''):'<tr><td colspan="8" style="text-align:center;height:80px">이 기간에는 체결이 없어요</td></tr>')
    +'</tbody></table></div>';
}


function mkdSince(s){ var e=s.r&&s.r.eq; return e&&e.length?mkDate(e[0].i):'-'; }
function mkMin(s){ var c=s.cfg; if(c&&c.kind==='agent') return c.top>=3?500:c.top===2?300:200; var sl=c&&c.sl!=null?Math.abs(c.sl):(s.p?Math.abs(s.p.sl):5); return sl>=8?500:sl>=5?200:100; }
function mkAi(s){ return ['rsi',s.name||'TETH']; }
/* 성과 탭: 기간을 고르면 같은 계산기를 그 구간으로 다시 돌린다 */


/* TETH에게 분석시키기: 판단 방식과 실제 설정, 지금 상태를 질문에 담는다 */
function tfSS3Ask(ne,pd){
  var nick; try{ nick=decodeURIComponent(ne); }catch(e){ return; }
  var s=tfSSFind(nick); if(!s) return;
  if(!S.user){ authOpen('login'); return; }
  var r=tfSS3PdCalc(s,pd||'all'), q;
  if(s.cfg){ q='전략 분석 요청: "'+s.name+'" ('+MK_KIND[s.kind]+', '+mkScope(s)+'). 하는 일: '+mkDoes(s).map(function(d){ return d[0]+' '+d[1]; }).join('. ')+'. 움직이는 방식: '+mkHowRows(s).map(function(d){ return d[0]+' '+d[1]; }).join('. ')+'. 설정값: '+Object.keys(s.cfg).filter(function(k){ return ['id','name','one','ex','fw','mkt','kind'].indexOf(k)<0; }).map(function(k){ return k+'='+s.cfg[k]; }).join(', ')+'. 지금: '+mkNowLine(s)+'. 최근 판단: '+mkEvFold(mkEvents(s,s.r),3).map(function(e){ return mkMD(e.i)+' '+e.dec+' ('+e.obs+')'; }).join(' / ')+'. 기록('+mkPdLabel(pd||'all')+'): 수익률 '+mkPct0(r.ret)+', 최대 낙폭 '+r.mdd.toFixed(1)+'%, 승률 '+Math.round(r.winRate||0)+'%, 거래 '+r.n+'회. 이 전략의 강점과 약점, 그리고 따라가기 전에 확인해야 할 점을 분석해줘.'; }
  else q='공유 전략 분석 요청: "'+nick+'" ('+s.asset+'). 규칙: RSI '+(s.p&&s.p.rsiTh!=null?s.p.rsiTh:'?')+' 이하 눌림 후 반등 진입'+(s.p&&s.p.trendFilter?', 추세 필터 사용':'')+', 손절 '+(s.p?s.p.sl:'?')+'%'+(s.p&&s.p.tp!=null?', 익절 +'+s.p.tp+'%':'')+'. 검증 결과: 수익 '+(r.ret>=0?'+':'')+r.ret.toFixed(1)+'%, MDD '+r.mdd.toFixed(1)+'%, 승률 '+Math.round(r.winRate||0)+'%, 거래 '+r.n+'회. 이 전략의 강점과 약점, 그리고 따라하기 전에 확인해야 할 점을 분석해줘.';
  tfTrack('strategy_ai_analysis',{nick:nick});
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  window.TF_ONSHARE=false;
  gNew(q);
}

function mkKindPick(v){ var t=tfSSState(), had=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.mk3-seg'); t.ss.kind=v; tfSave(); tfShareHub('find'); if(had){ var b=document.querySelector('.mk3-seg button[aria-pressed="true"]'); if(b) try{ b.focus({preventScroll:true}); }catch(e){ b.focus(); } } }

/* 화면 폭이 바뀌면 성과 차트의 좌표를 다시 잡아 그린다 */
function mkChartW(){ var vw=window.innerWidth||1200; return Math.round(Math.max(360,Math.min(1136,vw-(vw>860?304:40)))/20)*20; }
var MK_CW=mkChartW();
window.addEventListener('resize',function(){ var w=mkChartW(); if(w===MK_CW) return; MK_CW=w; var g=document.getElementById('mkd-chart'); if(g&&typeof mkdChartHtml==='function'){ g.classList.remove('hov'); g.innerHTML=mkdChartHtml(); } });
/* 따라가기 시트의 전략 요약: 수익이 아니라 판단 방식과 주기 */
function mkFollowLine(s){ var c=s.cfg||{}, by=s.by?'@'+s.by+' 등록, ':''; if(!s.cfg) return by+(MK_KIND[s.kind]||'차트 규칙')+', '+mkScope(s); return by+MK_KIND[s.kind]+', '+mkScope(s)+', '+(s.kind==='agent'?(c.every===1?'매일':c.every+'일마다')+' 종목을 다시 비교':s.kind==='mix'?c.every+'일마다 종목을 고르고 매일 조건 확인':'매일 조건 확인'); }

/* 세대 기록을 넣기 전 저장의 데이터 세대 */
var MK_GEN0={asof:[2026,9,28],len:1335};
/* 체험 예산 추가. 따라가기 시트 안에서는 확인 창을 띄우지 않고 그 자리에서 더한다:
   창을 겹치지 않으니 확인 버튼과 시작 버튼이 같은 자리에 놓일 일이 없고, 입력하던 값도 그대로다 */
function cpTopup(ne){
  if(!$('mk-follow')){
    tfSS3Dlg('체험 예산 추가','<div class="ntc">체험용 예산 1,000 USDT를 추가해요.</div>'
      +'<div class="acts3" style="margin-top:16px"><button type="button" class="obtn" onclick="tfSS3DlgClose()">취소</button>'
      +'<button type="button" class="wbtn" onclick="cpTopupDo(\''+ne+'\')">+1,000 USDT 추가</button></div>');
    return;
  }
  var cp=cpState(), min=TF_MKF.min||0; if(cp.spot>=min) return; /* 연달아 눌러도 모자랄 때만 */
  cp.spot+=1000; tfSaveNow();
  var el=$('cps-spot'), mx=document.querySelector('#mk-follow .mx'), lk=document.querySelector('#mk-follow .mk-f-hint .mk-lnk'), a=$('cps-amt');
  if(el) el.textContent=cpUsd(cp.spot,0);
  if(mx) mx.setAttribute('onclick',"$('cps-amt').value="+Math.floor(cp.spot)+";cpFormSync()");
  if(lk&&cp.spot>=min){ var had=document.activeElement===lk; lk.remove(); if(had){ var bx=document.querySelector('#mk-follow .mk-follow'); try{ if(a&&innerWidth>760) a.focus(); else if(bx){ bx.setAttribute('tabindex','-1'); bx.focus(); } }catch(e){} } } /* 좁은 화면에서는 자판을 띄우지 않는다 */
  cpFormSync();
  var lv=$('mk-f-live'); if(lv) lv.textContent='1,000 USDT를 추가했어요. 사용 가능 '+cpUsd(cp.spot,0);
}
function cpTopupDo(ne){
  if(!$('ss3-dlgw')) return; /* 두 번 눌러도 한 번만 */
  cpState().spot+=1000; tfSaveNow(); tfSS3DlgClose(); toast('1,000 USDT를 추가했어요'); mkFollowSheet(ne);
}

/* ── 따라가기 중단: 세 선택이 실제로 다르게 움직인다 ──
   지금 정리: 바로 정산. 원본 청산 대기, 직접 관리: 새 진입만 멈추고 열린 포지션은 남긴다(winding).
   남은 포지션이 없어지면(원본이 청산했거나 내가 정리하면) 그때 한 번 정산한다 */
function mkStopGo(cid,mode){
  var c2=cpFind(cid); if(!c2||c2.status!=='active') return;
  c2.stopMode=MK_STOP_L[mode]?mode:'now';
  var d=cpCalc(c2);
  if(c2.stopMode==='now'||!d.posOpen||d.missing){ cpClose(cid); return; }
  c2.winding=true; c2.windAt=Date.now(); { var sw=tfSSFind(c2.nick); if(sw&&sw.r&&sw.r.eq&&sw.r.eq.length) c2.stopI=sw.r.eq[sw.r.eq.length-1].i; }
  tfSaveNow(); tfSS3DlgClose();
  toast('새 진입을 멈췄어요. 열린 포지션은 '+(c2.stopMode==='wait'?'원본 전략이 청산할 때 함께 정리해요':'내가 정리할 때까지 남아 있어요'));
  if(location.hash.indexOf('#/share/c/')===0) cpDetailView(cid,'pos'); else tfShareHub('follow');
}
function mkWindActs(cid){
  var c2=cpFind(cid)||{};
  return '<span class="cps-static" style="align-self:center">새 진입 멈춤, '+(c2.stopMode==='wait'?'원본 전략이 청산하면 함께 정리':'열린 포지션은 내가 정리')+'</span>'
    +'<button type="button" class="ss3-dbtn" onclick="cpFlatDlg(\''+cid+'\')">포지션 정리하고 끝내기</button>';
}
function mkWindCheck(){
  var cp=cpState(); if(!cp||!cp.copies) return;
  cp.copies.forEach(function(c){ if(c.status==='active'&&c.winding&&c.stopMode==='wait'){ var d=cpCalc(c); if(!d.missing&&!d.posOpen) cpClose(c.id,true); } });
}
function cpFlatDlg(cid){
  var c2=cpFind(cid); if(!c2) return; var d=cpCalc(c2);
  tfSS3Dlg(c2.winding?'포지션 정리하고 끝내기':'포지션 전체 정리','<div class="ntc">열려 있는 따라가기 포지션을 현재가로 정리해요.<br>미실현 '+cpUsd(d.unreal)+'이 실현 손익으로 확정되고, '+(c2.winding?'따라가기를 끝내고 예산을 돌려받아요.':'따라가기는 유지되어 다음 진입부터 다시 따라가요.')+'</div>'
    +'<div class="acts3" style="margin-top:16px"><button type="button" class="obtn" onclick="tfSS3DlgClose()">취소</button>'
    +'<button type="button" class="ss3-dbtn" onclick="cpFlat(\''+cid+'\')">정리하기</button></div>');
}
function cpFlat(cid){
  var c2=cpFind(cid); if(!c2||c2.status!=='active') return;
  var s2=tfSSFind(c2.nick); if(!s2||!s2.r.eq||!s2.r.eq.length) return;
  tfTrack('cp_flat',{id:cid});
  if(c2.winding){ cpClose(cid); return; } /* 정산은 cpClose 한 곳에서: 보유 실현, 봉 고정, 반환 한 번 */
  { var fb=s2.r.eq[s2.r.eq.length-1].i; if(!c2.flats) c2.flats=c2.flatI!=null?[c2.flatI]:[]; if(c2.flats.indexOf(fb)<0) c2.flats.push(fb); c2.flatI=fb; } /* 정리한 봉을 차례로 남긴다 */
  tfSaveNow(); tfSS3DlgClose();
  toast('포지션을 정리했어요. 다음 진입부터 다시 따라갑니다');
  cpDetailView(cid,'pos');
}
/* 따라가는 중 화면을 열 때 정리 대기 계정을 확인한다 */
var mkHub0=tfShareHub; tfShareHub=function(tab){ try{ mkWindCheck(); }catch(e){} var prev=G.mode==='tfss3'?MK_HUB_TAB:null, out=mkHub0.apply(this,arguments); MK_HUB_TAB=tab||'find'; if(MK_HUB_TAB==='find'&&prev!=='find') try{ mkCardsEnter(); }catch(e){} try{ setTimeout(mkFabTick,60); }catch(e){} return out; };
/* 즐겨찾기: 저장 상태에서 머리글 버튼과 더 보기 버튼을 함께 맞춘다 */
function mkWatchSync(ne){
  var nick; try{ nick=decodeURIComponent(ne); }catch(e){ nick=ne; }
  try{ tfSaveNow(); }catch(e){}
  var s=tfSSFind(nick), on=!!S.user&&(tfS().watch||[]).indexOf(s?s.nick:nick)>=0;
  var h=document.querySelector('.mkd-fav'), b=$('ss3-watch-btn');
  if(h) h.setAttribute('aria-pressed',String(on));
  if(b){ b.innerHTML=tfSS3WatchLb(on); b.setAttribute('aria-pressed',String(on)); }
}
/* 따라가기 상세의 포지션 탭: 판단 방식마다 원본이 실제로 든 종목과 정리 기준을 보여 준다 */
function cpxPos(c2,d){
  var s2=tfSSFind(c2.nick);
  if(!s2||!d.posOpen||c2.status!=='active')
    return '<div class="cpp-empty"><b>지금 열려 있는 따라가기 포지션이 없어요</b>'
      +'원본 전략이 진입하면 자동으로 함께 진입하고, 여기에 실시간으로 표시돼요.'
      +'<span class="nx">'+(c2.status==='active'?'포지션이 없는 동안에도 따라가기는 유지돼요.':'중단된 따라가기예요. 청산 이력 탭에서 기록을 볼 수 있어요.')+'</span></div>';
  var c=s2.cfg||{}, st=(s2.r&&s2.r.state)||{}, o=st.open, list=!o?[]:o.length!=null?o:[o], up=d.unreal>=0;
  if(d.stopI!=null) list=list.filter(function(x){ return x.entry==null||x.entry<=d.stopI; }); /* 새 진입을 멈춘 뒤에 원본이 산 종목은 내 포지션이 아니다 */
  var wsum=list.reduce(function(a,x){ return a+(x.w!=null?x.w:1); },0)||1;
  var rule=s2.kind==='agent'?'고점에서 '+c.trail+'% 밀리면':(c.sl!=null?c.sl+'% / +'+c.tp+'%':(s2.p?s2.p.sl+'% / +'+s2.p.tp+'%':'원본과 같음'));
  var rows=list.map(function(x){ var w=(x.w!=null?x.w:1)/wsum;
    return '<tr><td>'+gEsc(mkTk(x.k))+'</td><td class="u">롱</td><td class="num">'+cpUsd(d.invested*w,0)+'</td>'
      +'<td class="num">'+mkPxFmt(x.ep)+'</td><td class="num">'+mkPxFmt(x.px)+'</td>'
      +'<td class="num">'+rule+'</td>'
      +'<td class="num '+(x.chg>=0?'u':'d')+'">'+mkPct0(x.chg,1)+'</td></tr>'; }).join('');
  if(!rows) rows='<tr><td>'+gEsc(c2.pairs&&c2.pairs[0]||mkScope(s2))+'</td><td class="u">롱</td><td class="num">'+cpUsd(d.invested,0)+'</td><td class="num">-</td><td class="num">-</td><td class="num">'+rule+'</td><td class="num">-</td></tr>';
  return '<div class="cpx-sumline">포지션 '+(list.length||1)+'건이 열려 있어요. 내 미실현 손익 <b class="num" style="color:'+(up?'#56c486':'#ee766a')+'">'+cpUsd(d.unreal)+'</b>. '+(c2.winding?'새 진입은 멈췄고, 남은 포지션만 정리를 기다려요.':'원본 전략의 정리 기준까지 그대로 따라가요.')+'</div>'
    +'<div class="cpx-tblw"><table class="cpx-tbl"><thead><tr>'
    +'<th>종목</th><th>방향</th><th>규모</th><th>원본 진입가</th><th>현재가</th><th>정리 기준</th><th>원본 진입 뒤</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div class="cpd-acts"><button type="button" class="ss3-dbtn" onclick="cpFlatDlg(\''+c2.id+'\')">'+(c2.winding?'포지션 정리하고 끝내기':'포지션 전체 정리')+'</button></div>';
}

/* 따라가기 종료의 공통 정산: 어느 경로(지금 정리, 정리하고 끝내기, 모두 멈추기)든
   남은 보유를 현재가로 실현하고 봉을 고정한 뒤 한 번만 돌려준다 */
function cpClose(cid,silent){
  var c2=cpFind(cid), cp=cpState(); if(!c2||c2.status!=='active') return;
  var s2=tfSSFind(c2.nick);
  if(s2&&s2.r&&s2.r.eq&&s2.r.eq.length) c2.endI=s2.r.eq[s2.r.eq.length-1].i;
  var d=cpCalc(c2), back=Math.max(0,d.est);
  c2.status='closed'; c2.closedAt=Date.now(); c2.settle={net:d.net,share:d.share,back:back};
  c2.ledger.push({at:Date.now(),type:'out',amt:back,i:c2.endI});
  cp.spot+=back;
  tfSaveNow(); tfSS3DlgClose();
  tfTrack('cp_close',{id:cid,net:d.net});
  if(silent) return;
  toast('따라가기를 중단했어요'+(c2.stopMode&&c2.stopMode!=='now'?' ('+MK_STOP_L[c2.stopMode]+')':'')+'. '+cpUsd(back,0)+'가 예산으로 돌아왔어요');
  tfShareHub('follow');
}

/* 목록, 상세, 시트를 잇는 열쇠는 고정 ID. 이름은 표시용 */
function tfSS3Rid(s){ return s.mine?'mine':s.me?'me':tfSSNe(s.id||s.nick); }
function mkOldNames(id){ if(!id) return ''; var o=[]; for(var k in MK_ALIAS) if(MK_ALIAS[k]===id) o.push(k); return o.join(' '); }

function mkFlatAtBase(eq,base,X,Y,G){ var d=''; for(var i=0;i<eq.length-1;i++) if(Math.abs(eq[i].v-base)<1e-12&&Math.abs(eq[i+1].v-base)<1e-12) d+='M'+X(i).toFixed(1)+' '+Y(base).toFixed(1)+' L'+X(i+1).toFixed(1)+' '+Y(base).toFixed(1)+' '; return d?'<path d="'+d+'" fill="none" stroke="'+G+'" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>':''; }

/* 관심 전략: 로그인한 사람만 저장한다. 비로그인이면 가입 창을 띄우고, 가입이나 로그인을 마치면 누르려던 전략을 추가한다 */
function mkAuthHook(){
  if(window.MK_AUTH_HOOKED) return; window.MK_AUTH_HOOKED=true;
  var ao=window.authOpen; if(typeof ao==='function') window.authOpen=function(){ window.MK_WATCH_RESUME=null; return ao.apply(this,arguments); };
  var sd=window.signupDone; if(typeof sd==='function') window.signupDone=function(){
    var r=window.MK_WATCH_RESUME; window.MK_WATCH_RESUME=null;
    var out=sd.apply(this,arguments);
    if(r&&S.user){ setTimeout(function(){ var s=tfSSFind(decodeURIComponent(r.ne)); if(!s||s.me) return; var t=tfS(); t.watch=t.watch||[]; if(t.watch.indexOf(s.nick)<0){ t.watch.push(s.nick); tfSave(); toast('관심 전략에 추가했어요'); } mkWatchSync(r.ne); },400); }
    return out;
  };
}
function tfSS3WatchTgl(ne){
  var nick; try{ nick=decodeURIComponent(ne); }catch(e){ return; }
  if(!S.user){ mkAuthHook(); authOpen('signup'); window.MK_WATCH_RESUME={ne:ne}; return; } /* authOpen 이 비우므로 그 뒤에 기록 */
  var sW=tfSSFind(nick); if(sW&&!sW.me) nick=sW.nick;
  var t=tfS(); t.watch=t.watch||[];
  var i=t.watch.indexOf(nick);
  if(i>=0){ t.watch.splice(i,1); toast('관심 전략에서 제외했어요'); }
  else { t.watch.push(nick); toast('관심 전략에 추가했어요. 전략 따라하기 화면에서 모아볼 수 있어요'); }
  tfSave(); tfTrack('strategy_watch',{nick:nick,on:i<0});
  var b=$('ss3-watch-btn'); if(b){ b.innerHTML=tfSS3WatchLb(i<0); b.setAttribute('aria-pressed',String(i<0)); }
  else if(G.mode==='tfss3') tfShareHub('follow'); /* 팔로우 탭의 관심 섹션에서 해제한 경우 목록 재렌더 */
}
/* 목록에 처음 들어올 때만 카드가 차례로 올라온다. 정렬, 판단 방식 전환, 검색은 그대로 바뀐다 */
var MK_HUB_TAB=null;
function mkCardsEnter(){
  var g=document.querySelector('.mk3-grid'); if(!g) return;
  try{ if(matchMedia('(prefers-reduced-motion: reduce)').matches) return; }catch(e){}
  [].forEach.call(g.children,function(c,i){ c.style.setProperty('--i',i); });
  g.classList.add('mk3-enter');
  setTimeout(function(){ g.classList.remove('mk3-enter'); },1400);
}

/* 따라가는 사람 줄. 구간: 1,000명 이상, 500명 이상, 그 아래. 수익과 손실 색(초록, 빨강)과 버튼 색(라임)은 쓰지 않는다 */
function mkFwTier(n){ return n>=1000?'t3':n>=500?'t2':'t1'; }
function mkFwHtml(n){ n=+n||0; if(n<=0) return '';
  var num=n>=10000?'약 '+(Math.round(n/1000)/10)+'만':n.toLocaleString();
  return '<div class="mk3-fw num '+mkFwTier(n)+'"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.4"/><path d="M2.8 19.5c.5-3.3 3-5.4 6.2-5.4s5.7 2.1 6.2 5.4"/><path d="M15.2 4.9a3.4 3.4 0 0 1 0 6.3"/><path d="M17.6 14.4c2.1.6 3.4 2.4 3.7 5.1"/></svg><span><b>'+num+'명</b>이 따라가는 중</span></div>'; }

/* ── 기간: 최근 7일, 최근 30일, 최근 1년, 전체 ──
   7일과 30일은 전체 기록에서 그 구간을 잘라 계산한다(그 시점에 들고 있던 종목을 그대로 둔 채). 1년은 그 구간으로 다시 계산한다 */
MK_PD_OK={all:1,'1y':1,'30d':1,'7d':1,'2y':1};
function mkPdLabel(pd){ return {all:'전체 기간','2y':'최근 2년','1y':'최근 1년','30d':'최근 30일','7d':'최근 7일'}[pd]||'전체 기간'; }
function mkPdChips(ne,pd,tab){
  return '<div class="mk-chips mk-pdrow" aria-label="기간"><span class="lb">기간</span>'+[['7d','최근 7일'],['30d','최근 30일'],['1y','최근 1년'],['all','전체']].map(function(o){
    return '<button type="button" class="mk-chip'+(pd===o[0]?' on':'')+'" aria-pressed="'+(pd===o[0])+'" onclick="tfSS3Go(\''+ne+'\',\''+o[0]+'\',\''+tab+'\')">'+o[1]+'</button>'; }).join('')+'</div>';
}
function mkSlice(s,days){
  var r=s.r, end=PRICE0.length-1, d=mkDaily(r.eq||[],end), src=d.slice(-(days+1)); if(src.length<2) return r;
  var b=src[0].v, eq=src.map(function(x){ return {i:x.i,v:x.v/b}; }), pk=eq[0].v, mdd=0;
  eq.forEach(function(x){ if(x.v>pk) pk=x.v; var dd=(x.v/pk-1)*100; if(dd<mdd) mdd=dd; });
  var from=src[0].i, tr=(r.trades||[]).filter(function(t){ return t.exit>from; }), win=tr.filter(function(t){ return t.pnl>0; }).length, o={};
  for(var k in r) o[k]=r[k];
  o.eq=eq; o.ret=(eq[eq.length-1].v-1)*100; o.mdd=mdd; o.trades=tr; o.n=tr.length; o.winRate=tr.length?win/tr.length*100:0; o.params={startI:from,endI:end}; o.mddStartI=null; o.byYear={};
  return o;
}
function tfSS3PdCalc(s,pd){
  if(pd==='all'||(!s.p&&!s.cfg)) return s.r;
  var key=mkSig(s)+'|'+pd, end=PRICE0.length-1;
  if(s.cfg&&(pd==='7d'||pd==='30d')){ if(!MK_PDC[key]) MK_PDC[key]=mkSlice(s,pd==='7d'?7:30); return MK_PDC[key]; }
  var days=pd==='7d'?7:pd==='30d'?30:pd==='1y'?365:730;
  if(!MK_PDC[key]) MK_PDC[key]=s.cfg?mkRunCfg(s.cfg,Math.max(s.cfg.startI||61,end-days)):runBacktest({sl:s.p.sl,tp:s.p.tp,rsiTh:s.p.rsiTh,trendFilter:s.p.trendFilter,startI:Math.max(61,s.p.startI||61,s.p.endI-days),endI:s.p.endI,px:s.p.px,fill:s.p.fill});
  return MK_PDC[key];
}
/* 지표 이름에 붙는 설명 */
var MK_TIP={ret:'고른 기간 동안 이 전략이 거둔 수익의 비율이에요. 수수료를 뺀 값이에요.',
  ret30:'최근 30일 동안 이 전략이 거둔 수익의 비율이에요. 수수료를 뺀 값이에요.',
  mdd:'고른 기간 안에서, 가장 높았던 때에서 가장 많이 내려간 폭이에요. 값이 클수록 중간에 크게 흔들렸다는 뜻이에요.',
  win:'전체 기간에 끝난 거래 중 이익으로 끝난 거래의 비율이에요. 끝난 거래가 5번 미만이면 - 로 표시해요.',
  n:'전체 기간에 사고팔기를 끝낸 횟수예요.',
  ex:'이 전략의 주문이 실제로 나가는 거래소예요. 따라가려면 이 거래소 계정을 연결해야 해요.'};
function mkKpi4(cls,item,a,b,c,d){ return '<div class="'+cls+'">'+[a,b,c,d].map(function(x){ return '<div'+(item?' class="'+item+'"':'')+'><small>'+mkdTerm(x[0],MK_TIP[x[1]])+'</small><b class="num'+(x[3]||'')+'">'+x[2]+'</b></div>'; }).join('')+'</div>'; }
/* 성과 탭: 기간, 지표 넷, 월별 달력 */


function mkInfoTab(s,r,ne){
  var a=(s.r.params&&s.r.params.startI!=null)?s.r.params.startI:61, b=PRICE0.length-1;
  var row=function(k,v){ return '<div class="mk-info-r"><small>'+k+'</small><span>'+v+'</span></div>'; };
  return '<div class="mk-info">'
    +row('판단 방식',MK_KIND[s.kind]||'차트 규칙')
    +row('거래 대상',gEsc(s.cfg&&s.cfg.uni?mkUni(s).list.join(', '):(CPP_PAIR[s.asset]||s.asset)))
    +row('거래 상품',mkInstList(s).join(', '))
    +row('실행 거래소',mkEx(s)[1])
    +row('기록 기간',mkDate(a)+' ~ '+mkDate(b)+' ('+Math.max(1,Math.round((b-a)/30.44))+'개월)')
    +row('등록',s.me?gEsc(s.nick)+' (나)':(s.by?'@'+gEsc(s.by):'TETH'))
    +'</div>';
}
/* 개요 그래프의 조작 줄: 수익률, 수익금, 잔고. 기간에 최근 7일 */
function mkdCtlHtml(){
  var tip='이 전략이 매매로 번 비율이에요. 돈을 더 넣거나 빼도 수익률은 그대로예요. 수수료를 뺀 실제 수익이에요. 이 전략의 거래만 계산해요.';
  return '<div class="mkd-pills" role="group" aria-label="그래프 종류">'+[['ret','수익률',tip],['pnl','수익금','고른 기간의 첫날에 1,000 USDT를 넣었다면 늘거나 줄어든 금액이에요. 수수료를 뺀 금액이에요.'],['bal','잔고','고른 기간의 첫날에 1,000 USDT를 넣었다면 그날 계좌에 들어 있던 금액이에요.']].map(function(t){ return '<button type="button" class="mkd-pill" aria-pressed="'+(MKD.tab===t[0])+'" onclick="mkdSet(\'tab\',\''+t[0]+'\')">'+t[1]+(t[2]?'<i aria-hidden="true">i</i><span class="mkd-tip" role="tooltip">'+t[2]+'</span>':'')+'</button>'; }).join('')+'</div>'
    +'<div class="mkd-right"><div class="mkd-seg" role="group" aria-label="간격">'+[['day','일별'],['month','월별']].map(function(g){ return '<button type="button" aria-pressed="'+(MKD.gran===g[0])+'" onclick="mkdSet(\'gran\',\''+g[0]+'\')">'+g[1]+'</button>'; }).join('')+'</div>'
    +'<select class="mkd-per" aria-label="기간 선택" onchange="mkdSet(\'per\',+this.value)">'+[[7,'최근 7일'],[30,'최근 30일'],[90,'최근 3개월'],[365,'최근 1년'],[0,'전체']].map(function(o){ return '<option value="'+o[0]+'"'+(MKD.per===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')+'</select></div>';
}

/* ── 상세를 한 페이지로: 성과(지표, 그래프, 달력) → 판단 기록 → 거래내역. 탭은 개요와 정보. 거래내역 전체는 따로 연다 ── */
MK_TAB_OK={ov:1,info:1,trades:1}; /* 성과, 활동 탭은 없앴다. 옛 주소는 개요로 */
var MK_PER_L={7:'최근 7일',30:'최근 30일',90:'최근 3개월',365:'최근 1년',0:'전체 기간'};
/* 수익률과 최대 낙폭은 그래프에서 고른 기간을 따르고, 승률과 거래 수는 늘 전체 기간이다(짧은 기간의 거래 한두 건이 성과처럼 읽히지 않게) */
function mkOvKpi(s,per){
  var r=per?mkSlice(s,per):s.r, a=s.r||r, w=(typeof a.winRate==='number'&&(a.n||0)>=5)?Math.round(a.winRate)+'%':'-';
  return mkKpi4('mk3-kpis num','',[MK_PER_L[per]+' 수익률','ret',mkPct0(r.ret),mkSign(r.ret)],[MK_PER_L[per]+' 최대 낙폭','mdd',r.mdd.toFixed(1)+'%'],['전체 기간 승률','win',w],['전체 기간 거래 수','n',Number(a.n||0).toLocaleString()+'회']);
}
function mkdHintTxt(){ return MKD.per?MK_PER_L[MKD.per].replace('최근 ','')+' 전에 1,000 USDT를 넣었다면':'시작한 날에 1,000 USDT를 넣었다면'; }
function mkdSet(k,v){
  MKD[k]=v; var c=$('mkd-ctl'), h=$('mkd-hint'), g=$('mkd-chart'), q=$('mk3-kpi-host');
  if(c) c.innerHTML=mkdCtlHtml(); if(h) h.textContent=MKD.tab==='ret'?'':mkdHintTxt();
  if(g){ g.classList.remove('hov'); g.innerHTML=mkdChartHtml(); }
  if(k==='per'&&q&&MKD.s) q.innerHTML=mkOvKpi(MKD.s,MKD.per);
}
function mkOvTab(s,r,pd,ne){
  var R0=s.r||r, eq=mkDaily(R0.eq||[],PRICE0.length-1); MKD.eq=eq; MKD.tab='ret'; MKD.gran='day'; MKD.per=30; MKD.s=s.cfg?s:null; mkOvAfter(ne);
  var chart='<div class="mkd-ctl" id="mkd-ctl">'+mkdCtlHtml()+'</div><p class="mkd-hint" id="mkd-hint"></p><div class="mkd-chart" id="mkd-chart" onpointermove="mkdHover(event)" onpointerdown="mkdHover(event)" onpointerleave="mkdHover(null)">'+mkdChartHtml()+'</div>';
  if(!s.cfg) return '<div class="mk3-ov"><section class="mk3-sec" style="margin-top:0"><h3>성과</h3>'+chart+'</section>'+mkOrdersSec(s,ne)+'</div>';
  return '<div class="mk3-ov">'
    +'<section class="mk3-sec" style="margin-top:0"><h3>성과</h3>'
    +'<div id="mk3-kpi-host">'+mkOvKpi(s,30)+'</div>'
    +chart+'<p class="mk3-since num">'+mkdSince(s)+' 시작 이후 '+mkPct0(R0.ret)+'</p>'
    +'<div class="mk3-cal" id="ss3-cal-host">'+tfSS3CalHtml(R0,0)+'</div></section>'
    +mkChatHtml(s,R0,ne,pd)
    +mkOrdersSec(s,ne)
    +'</div>';
}
function mkOvAfter(ne){ setTimeout(function(){ try{ mkOvRestore(ne); }catch(e){} },0); }
/* 거래내역: 주문 한 건이 한 줄. 끝난 거래의 매수와 매도, 지금 들고 있는 종목의 매수. 금액과 수량은 1,000 USDT 로 시작한 기준 */
function mkWhen(s,i,a,salt){
  var cr=a?!!MK_CRYPTO[a]:(s.mkt==='crypto'||s.mkt==='multi'), d=idxToDate(i), h=0, k=String(s.id||s.nick)+'|'+i+'|'+(salt||0);
  for(var x=0;x<k.length;x++) h=(h*31+k.charCodeAt(x))>>>0;
  var t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),cr?0:20,0,2+h%47)), p=function(n){ return (n<10?'0':'')+n; };
  return t.getFullYear()+'.'+p(t.getMonth()+1)+'.'+p(t.getDate())+' '+p(t.getHours())+':'+p(t.getMinutes());
}
function mkOrders(s){
  var r=s.r||{}, o=[], st=r.state, W=mkWords(s), B=1000;
  (r.trades||[]).forEach(function(t){
    if(t.units==null||t.ep==null) return;
    o.push({i:t.entry,side:'in',a:t.asset,px:t.ep,q:t.units*B,sum:t.cost*B,id:t.id});
    o.push({i:t.exit,side:'out',a:t.asset,px:t.xp,q:t.units*B,sum:t.got*B,id:t.id,pnl:t.pnl*100});
  });
  var op=!st?[]:st.open&&st.open.length!=null?st.open:st.open?[st.open]:[];
  op.forEach(function(p){ if(p.units!=null) o.push({i:p.entry,side:'in',a:p.k,px:p.ep,q:p.units*B,sum:p.cost*B,id:p.tid,open:true}); });
  o.sort(function(x,y){ return y.i-x.i||(x.side===y.side?y.id-x.id:(x.side==='out'?1:-1)); });
  o.forEach(function(x){ x.label=x.side==='in'?W.buy:W.sell; x.when=mkWhen(s,x.i,x.a,x.id+(x.side==='in'?0:7)); });
  return o;
}
function mkQty(v){ var a=Math.abs(v); return a>=1000?Math.round(v).toLocaleString():a>=10?v.toFixed(2):a>=0.1?v.toFixed(3):v.toFixed(5); }
function mkOrdersTable(s,rows){
  return '<div class="mk-tblw"><table class="ss3-tbl mko-tbl"><thead><tr><th>종목</th><th>구분</th><th>시간</th><th class="r">가격</th><th class="r">수량</th><th class="r">합계</th></tr></thead><tbody>'
    +(rows.length?rows.map(function(x){
      return '<tr class="'+(x.side==='in'?'in':'out')+'"><td><span class="mko-s" aria-hidden="true">'+(x.side==='in'?'+':'−')+'</span><b>'+gEsc(mkTk(x.a))+'</b></td><td>'+x.label+(x.open?'<small> 보유 중</small>':'')+'</td><td class="num">'+x.when+'</td>'
        +'<td class="num r">'+mkPxU(x.a,x.px)+'</td><td class="num r">'+mkQty(x.q)+'</td><td class="num r">'+Math.round(x.sum).toLocaleString()+' USDT'+(x.pnl!=null?'<small class="'+(x.pnl>=0?'up':'dn')+'"> '+mkPct0(x.pnl)+'</small>':'')+'</td></tr>'; }).join('')
      :'<tr><td colspan="6" class="mko-e">아직 거래가 없어요</td></tr>')
    +'</tbody></table></div>';
}
function mkOrdersSec(s,ne){
  var o=s.cfg?mkOrders(s):[];
  if(!s.cfg) return '<section class="mk3-sec mko"><div class="mk3-sec-h"><h3>거래내역</h3></div>'+mkTradesTable(s,s.r,5)+'</section>';
  return '<section class="mk3-sec mko"><div class="mk3-sec-h"><h3><button type="button" class="mko-go" onclick="mkGoTrades(\''+ne+'\')">거래내역<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></h3><span class="mko-n num">주문 '+o.length.toLocaleString()+'건, 1,000 USDT로 시작한 기준</span></div>'
    +mkOrdersTable(s,o.slice(0,5))+'</section>';
}
/* 거래내역 전체 화면 */
var MK_ORD_N=30;
function mkTradesTab(s,r,pd,ne){
  if(!s.cfg) return '<div class="mk-sec-hd"><b>거래내역</b></div>'+mkTradesTable(s,s.r);
  var o=mkOrders(s); MK_ORD_N=30; window.MK_ORD_S=s;
  return '<div class="mko mko-all"><button type="button" class="mko-go mko-back" onclick="mkBackOv(\''+ne+'\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>개요로 돌아가기</button>'
    +'<div class="mk3-sec-h"><h3>거래내역</h3><span class="mko-n num">주문 '+o.length.toLocaleString()+'건, 1,000 USDT로 시작한 기준</span></div>'
    +'<div id="mko-host">'+mkOrdersTable(s,o.slice(0,MK_ORD_N))+'</div>'
    +(o.length>MK_ORD_N?'<button type="button" class="mkc-more mko-more" id="mko-more" onclick="mkOrdMore()">이전 거래 더 보기</button>':'')+'<button type="button" class="mko-go mko-back mko-back2" onclick="mkBackOv(\''+ne+'\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>개요로 돌아가기</button></div>';
}
function mkOrdMore(){ var s=window.MK_ORD_S, h=$('mko-host'), b=$('mko-more'); if(!s||!h) return; var o=mkOrders(s); MK_ORD_N+=50; h.innerHTML=mkOrdersTable(s,o.slice(0,MK_ORD_N)); if(b&&MK_ORD_N>=o.length) b.remove(); }

/* ── 한 페이지 상세: Codex 검수 반영 ── */
/* 그래프 값의 기준. 수익률은 고른 기간의 첫 값이 기준이고, 전체 기간은 처음 넣은 돈(1)이 기준이다.
   잔고와 수익금도 같은 기준이다: 고른 기간의 첫날에 1,000 USDT 를 넣은 계좌(전체 기간은 시작한 날). 그래서 세 값이 서로 맞는다 */
function mkdSeries(){
  var eq=MKD.eq||[], src=MKD.per?eq.slice(-MKD.per-1):eq.slice(); if(src.length<2) return [];
  var base=MKD.per?src[0].v:1, pts=src;
  if(MKD.gran==='month'){ var seen={}, order=[]; src.forEach(function(p){ var k=mkdDate(p.i).slice(0,7); if(!seen[k]) order.push(k); seen[k]=p; }); pts=[src[0]].concat(order.map(function(k){ return seen[k]; }).filter(function(p){ return p!==src[0]; })); }
  return pts.map(function(p){ return {d:mkdDate(p.i), y:MKD.tab==='ret'?(p.v/base-1)*100:MKD.tab==='pnl'?1000*(p.v/base-1):1000*p.v/base}; });
}
/* 달력은 어느 주소로 들어와도 전체 기록으로 그린다 */
function tfSS3CalRe(){ var c=TF_SS3_CALCTX; if(!c) return; var host=$('ss3-cal-host'); if(!host) return;
  var s=tfSSFind(c.nick); if(!s) return; host.innerHTML=tfSS3CalHtml(s.r,TF_SS3_CALM); }
/* 거래내역 전체 화면은 새 기록으로 연다(뒤로 가기 한 번이면 개요). 돌아오면 고른 기간과 보던 위치를 되살린다 */
var MK_OV_KEEP=null;
function mkGoTrades(ne){
  var sc=$('g-scroll'); MK_OV_KEEP={ne:ne,per:MKD.per,tab:MKD.tab,gran:MKD.gran,top:sc?sc.scrollTop:0};
  location.hash='#/share/s/'+ne+'/all/trades';
}
function mkBackOv(ne){ if(MK_OV_KEEP&&MK_OV_KEEP.ne===ne&&history.length>1){ history.back(); return; } tfSS3Go(ne,'all','ov'); }
function mkOvRestore(ne){
  var k=MK_OV_KEEP; if(!k||k.ne!==ne) return; MK_OV_KEEP=null;
  MKD.per=k.per; MKD.tab=k.tab; MKD.gran=k.gran; mkdSet('per',k.per);
  var sc=$('g-scroll'); if(sc) setTimeout(function(){ sc.scrollTop=k.top; },0);
}

/* 판단 기록의 글(전략마다 8편). 엔진 기록을 근거로 미리 써 둔 것. 만드는 법은 artifacts/teth-redesign/chat/voice-prompt.md */
var MK_VOICE={"d1":{"now":"비앤비, 에이다, 비트코인 세 종목을 그대로 보유하고 있으며 현금은 3%입니다. 비트코인이 +15.9%, 비앤비가 +12.2%로 앞서가는 반면 에이다는 +7.4%에 머물고 순위도 8위까지 밀려 셋 중 가장 신경 쓰이는 종목입니다. 에이다의 손절가 0.7761 USDT까지 여유가 8.7%로 가장 적고 최근 마감한 세 거래 중 두 번을 잃었다는 점도 마음에 걸리지만, 여덟 종목 중 일곱이 오름세라 서두를 이유는 없다고 봅니다. 9월 29일 비교에서 1위 도지코인과 2위 이더리움이 에이다를 밀어낼지 주시하고 있습니다.","e1330_hold":"9월 19일에 이어 이번 비교에서도 보유 종목을 바꾸지 않기로 했습니다. 상위권에 이더리움이 15.1% 상승으로 올라와 있지만 비앤비와 비트코인이 각각 10.0%, 14.0%로 여전히 상위 셋 안에 들어 있고, 세 자리가 이미 차 있는 상태에서 잘 가고 있는 종목을 굳이 내보낼 근거가 부족하다고 판단했습니다. 다만 에이다는 상위 셋에 들지 못한 채 자리를 지키고 있어 조금 불안하게 느껴집니다. 오르는 종목이 여덟 중 여섯으로 시장은 넉넉한 편이므로, 다음 비교에서 에이다의 순위가 회복되는지 지켜볼 계획입니다.","e1320_비트코인_buy":"비트코인을 96,670 USDT에 매수해 전체의 33%를 실었습니다. 순위로는 4위, 상승률은 5.0%에 그쳤지만 1위 이더리움은 12.1%나 올랐음에도 60일 평균 아래에 있어 제외했고 비앤비와 에이다는 이미 보유 중이어서, 남은 후보 가운데 가장 앞선 종목이 비트코인이었습니다. 최근 고점에서 2.1%밖에 내려오지 않은 자리에서 샀다는 점과 오름세인 종목이 여덟 중 넷뿐이라는 점은 다소 부담스럽습니다. 진입 직후 흐름이 꺾이지 않는지, 그리고 이더리움이 평균선을 회복하는지를 함께 지켜보겠습니다.","e1315_에이다_buy":"에이다에 새로 진입했고 체결가는 0.7911 USDT, 비중은 33%입니다. 순위 1위 비앤비는 이미 들고 있어 건너뛰었고 그다음인 에이다가 5.2% 상승으로 후보 중 가장 앞서 있었으며, 오르는 종목이 여덟 중 넷으로 기준 40%를 넘겼기 때문에 매수할 때라고 판단했습니다. 다만 오름세가 여덟 중 절반에 그치고 상위 셋에 든 이더리움은 -4.2%에 머물러 있으며, 직전 세 거래에서 두 번을 잃은 뒤라 확신보다는 조심스러운 낙관에 가깝습니다. 최근 고점 대비 3.7% 아래인 이 자리를 지켜 주는지부터 확인하겠습니다.","e1310_wait":"새로 사지 않고 비앤비 하나만 든 채 관망하기로 했습니다. 오르는 종목이 여덟 중 셋에 그쳐 기준인 40%에 못 미쳤고, 순위 상위를 봐도 비앤비만 11.65% 올랐을 뿐 에이다는 2.9%, 리플은 0.6%로 힘이 실린 후보가 보이지 않았기 때문입니다. 같은 날 도지코인을 정리해 자리가 비어 있는 만큼 반등을 놓칠 수 있다는 걱정이 없지는 않지만, 오름세 종목이 적을 때 서둘러 사면 최근 세 거래 중 두 번을 잃은 일을 되풀이할 수 있어 조심스럽습니다. 오름세 종목이 넷 이상으로 늘어나는지 차분히 지켜보겠습니다.","e1310_도지코인_sell":"도지코인을 0.2158 USDT에 매도했고 결과는 -6.0% 손실입니다. 8월 20일 0.2292 USDT에 들어간 뒤 15일 동안 가장 좋았을 때도 +2.8%에 그쳤고 가장 나빴을 때는 -5.9%까지 내려갔으니, 모멘텀이 이어질 것이라는 제 판단이 틀렸다고 인정합니다. 힘이 약해진 종목을 들고 버티는 것은 제 방식이 아니어서 담담하게 정리했지만, 최근 이더리움과 아발란체에 이어 손실 거래가 또 하나 늘어난 점은 씁쓸합니다. 남은 비앤비가 흐름을 지켜 주는지 살피며 다음 기회를 기다리겠습니다.","e1305_wait":"이번 비교에서는 아무것도 사지 않았고 도지코인과 비앤비 두 종목만 유지합니다. 세 번째 자리를 채우고 싶었지만, 오름세인 종목이 여덟 중 셋뿐이라 40% 기준을 넘지 못했고 상위 후보인 비앤비 4.6%, 도지코인 3.7%, 아발란체 2.7% 사이에서도 새 자리를 채울 만큼 뚜렷한 차이를 느끼지 못했습니다. 최근 세 거래 가운데 이더리움을 -10.5%로 정리한 기억이 남아 있어 지금 서두르는 일은 피하고 싶습니다. 다음 비교까지 오르는 종목 수가 늘어나는지, 보유 중인 두 종목이 버텨 주는지를 주시하겠습니다.","intro":"저는 코인 8종을 5일마다 비교해 20일 동안 가장 강했던 최대 셋에 나눠 담는 방식을 믿습니다. 강한 것이 더 간다는 생각으로 움직이되 고점에서 12% 밀리면 미련 없이 내려놓고, 오르는 종목이 40%에 못 미치는 시장에서는 아예 사지 않습니다. 103번의 거래에서 승률은 40.8%로 절반에도 못 미치지만 누적 수익은 +97.8%여서, 이긴 횟수보다 전체 결과로 저를 평가합니다. 다만 최대 낙폭 -20.35%를 겪은 점은 여전히 부담스러워 수익만 보고 낙관하지는 않으며, 그래서 오르는 종목의 수를 늘 먼저 확인합니다."},"r1":{"now":"지금은 비트코인을 보유하지 않고 다음 되돌림을 기다리고 있습니다. 오늘 2.8% 내리면서 최근 고점 대비로도 2.8% 아래에 와 있지만 되돌림 점수는 16으로 제가 필요로 하는 74에 한참 못 미치고, 하루 0.5% 이상의 반등도 확인되지 않아 조건까지는 아직 거리가 멉니다. 직전 거래를 +17.8%로 마친 덕분에 최근 30일 수익이 +17.9%로 만족스러운 만큼, 얕은 하락에 조급하게 들어가 그 성과를 깎을 이유가 없다고 봅니다. 하락이 충분히 깊어진 뒤 반등이 붙는지를 서두르지 않고 지켜보겠습니다.","e1329_비트코인_sell":"25일의 보유 기한이 끝나 비트코인을 106,539 USDT에 매도했고 +17.8%로 마쳤습니다. 8월 29일 90,296 USDT에 들어간 뒤 진입가 아래로는 0.4%밖에 밀리지 않았고 마지막 날이 보유 중 최고 수준이었을 만큼 흐름이 좋았기에, 익절 목표 +20%를 눈앞에 두고 내려놓는 것이 아쉽지 않다면 거짓말입니다. 그래도 직전 거래를 4일 만에 -9.4% 손절로 끝낸 기억이 있기에, 이번 이익이 아쉽더라도 정한 보유 기한을 늘리지는 않기로 했습니다. 이제는 다음 깊은 하락이 올 때까지 기다릴 계획입니다.","e1304_비트코인_buy":"사흘 전 손절의 기억이 채 가시지 않았지만 비트코인을 90,296 USDT에 다시 매수했습니다. 최근 고점에서 13.1%나 내려와 되돌림 점수가 80까지 올랐고 하루 만에 2.7% 반등해 하락 뒤 회복이 시작될 여지가 있다고 판단했기 때문입니다. 다만 추세는 아직 오름세로 돌아서지 않았고 직전 거래에서 -9.4%를 잃은 직후여서 솔직히 마음이 편하지는 않으며, 이번에도 진입가에서 8% 밀리면 주저 없이 정리할 생각입니다. 반등이 하루짜리로 끝나지 않고 이어지는지를 면밀히 주시하고 있습니다.","e1301_비트코인_sell":"비트코인을 90,040 USDT에 손절했고 -9.4%의 손실을 확정했습니다. 8월 22일 99,202 USDT에 산 뒤 나흘 동안 진입가를 한 번도 넘지 못했고 가장 낮을 때는 -9.2%였으니, 반등이 시작되었다는 제 판단이 명백히 빨랐다고 인정합니다. 손절 기준인 -8%보다 더 깊은 자리에서 체결된 점은 아쉽지만, 더 버텼다면 손실이 어디까지 커졌을지 알 수 없기에 규율대로 끊어 낸 것은 옳았다고 봅니다. 하락이 더 깊어진 뒤에 나타나는 반등이 진짜인지 차분히 다시 확인할 계획입니다.","e1297_비트코인_buy":"기다리던 조건이 채워져 비트코인을 99,202 USDT에 매수했습니다. 최근 고점 대비 9.6% 내려온 상태에서 하루 2.15% 반등이 나왔고 추세도 여전히 오름세여서 되돌림 매수에 나설 만하다고 판단했습니다. 다만 되돌림 점수가 75로 기준인 74를 겨우 넘긴 수준이라, 충분히 깊은 하락이었는지에 대해서는 확신이 크지 않습니다. 직전 세 번의 거래를 모두 이익으로 마친 흐름에 기대기보다는 진입가에서 8% 아래로 정한 선을 지키는 데 집중하며, 반등이 며칠 더 이어지는지 지켜보겠습니다.","e1239_비트코인_sell":"보유 25일째를 맞아 비트코인을 78,656 USDT에 정리했고 결과는 +9.5%입니다. 5월 31일 71,687 USDT에 진입한 뒤 한때 -7.8%까지 밀려 손절선인 -8%를 거의 건드릴 뻔했던 거래였기에, 이익으로 끝났다는 사실 자체가 다행스럽게 느껴집니다. 익절 목표 +20%에는 절반도 가지 못했지만 마지막 날 가격이 보유 기간 중 가장 높았으니 기한 안에서 얻을 수 있는 만큼은 얻었다고 판단합니다. 보유 중 손절선 가까이 밀렸던 점을 기억하며, 다음에는 되돌림의 깊이와 반등 조건을 더 꼼꼼히 확인하겠습니다.","e1214_비트코인_buy":"최근 고점에서 17.1%나 내려온 비트코인을 71,687 USDT에 매수했습니다. 되돌림 점수가 75로 기준을 넘었고 하루 2.0% 반등이 확인되어 제가 기다려 온 조건이 갖춰졌다고 보았으며, 이만큼 깊이 빠진 자리라면 회복 여지도 크다고 기대합니다. 그러나 추세가 아직 내림세에 머물러 있어 반등이 금세 꺾일 수 있다는 점이 걸리고, 점수 역시 기준을 간신히 넘긴 정도여서 조심스럽습니다. 손절선은 진입가 대비 -8%에 두었으며, 앞으로 25일 안에 흐름이 위로 돌아서는지 주시하겠습니다.","intro":"저는 비트코인 한 종목만 보며, 크게 떨어진 뒤 다시 오르기 시작하는 순간에만 삽니다. 깊은 하락 뒤의 반등이 가장 값싸게 살 기회라고 믿기 때문에 조건이 멀면 몇 달이라도 기다리고, 산 뒤에는 +20% 익절과 -8% 손절, 25일 기한이라는 세 개의 선을 어기지 않습니다. 9번 거래해 승률 77.8%, 누적 수익 +63.6%를 기록했지만 횟수가 적어 이 승률을 과신하지는 않습니다. 떨어지는 도중에 너무 일찍 들어가면 최대 낙폭 -12.6%와 같은 구간을 겪는다는 것이 약점이어서, 반등 확인을 무엇보다 중요하게 봅니다."},"h1":{"now":"엔비디아를 골라 둔 채 아직 사지 않고 기다리는 중입니다. 40일 상승률 14.8%로 아마존의 13.8%와 메타의 5.9%를 앞섰기에 선택에는 변함이 없고, 기술주 여덟 중 일곱이 오름세여서 시장도 받쳐 주고 있습니다. 다만 최근 고점 대비 4.75% 내려온 지금도 되돌림 점수는 41로 기준 50에 못 미치고 오늘도 0.8% 내려 반등 신호가 없으니 조건까지는 조금 더 남았습니다. 10월 4일 종목을 다시 고르기 전에 기회가 오지 않을까 봐 아쉽기도 하지만, 조금 더 눌린 뒤 0.5% 이상 되오르는 날을 기다리겠습니다.","e1324_엔비디아_sell":"익절 목표 +10%에 닿은 엔비디아를 175.7 USD에 매도했고 비용을 빼고 +9.8%를 남겼습니다. 9월 10일 159.7 USD에 산 뒤 8일 동안 진입가 아래로는 0.5%밖에 내려가지 않았을 만큼 깔끔한 회복이었고, 테슬라에서 연달아 -7.3%와 -7.7%를 잃은 뒤에 나온 이익이라 더욱 만족스럽습니다. 더 들고 갔다면 어땠을까 하는 생각이 들지 않는 것은 아니지만 정해 둔 목표에서 내리는 것이 제 방식입니다. 엔비디아가 다시 충분히 눌리는지, 다음 되돌림의 깊이를 주시하겠습니다.","e1316_엔비디아_buy":"8월 25일에 골라 둔 엔비디아를 159.7 USD에 매수했습니다. 되돌림 점수가 53으로 기준 50을 넘어선 데다 하루 3.5% 반등이 확인되었고, 오름세인 종목도 여덟 중 다섯으로 시장 기준을 충족해 그동안 미뤄 온 진입을 실행할 때라고 판단했습니다. 다만 반등이 워낙 강해 체결가가 최근 고점에서 0.7%밖에 떨어지지 않은 자리라는 점은 부담스럽고, 점수도 기준을 조금 넘긴 정도입니다. 손절선을 -5%에 두고, 이 반등이 고점을 넘어 이어지는지 면밀히 지켜보겠습니다.","e1300_엔비디아_pick":"이번 20일 동안 지켜볼 종목으로 엔비디아를 골랐습니다. 40일 상승률이 14.8%로 여덟 종목 중 가장 높았는데, 2위 아마존이 13.8%로 바짝 붙어 있어 차이가 크지 않다는 점은 솔직히 마음에 걸리고 3위 메타는 5.9%로 한참 뒤에 있습니다. 직전에 테슬라에서 두 번 연속 손절을 겪은 터라 종목이 바뀐 것이 내심 반갑지만, 고른 것과 사는 것은 별개여서 아직 매수하지는 않았습니다. 엔비디아가 충분히 눌렸다가 하루 0.5% 이상 되오르는 날이 오는지 서두르지 않고 기다리겠습니다.","e1293_테슬라_wait":"테슬라는 조건을 갖췄지만 8월 17일에 이어 이틀째 매수를 보류합니다. 되돌림 점수가 66으로 충분하고 하루 2.0% 반등까지 나왔으니 종목만 보면 살 자리인데, 오름세인 기술주가 여덟 중 셋뿐이라 시장 기준 40%에 미치지 못했기 때문입니다. 반등을 눈앞에서 흘려보내는 것 같아 아쉬운 마음이 크지만, 바로 이틀 전 테슬라를 -7.7%로 손절한 것을 떠올리면 시장이 약할 때 쉬어 가는 편이 오히려 안도가 됩니다. 오르는 종목이 넷 이상으로 늘어나는지를 먼저 확인하겠습니다.","e1291_테슬라_sell":"테슬라를 386.0 USD에 손절하며 -7.7%의 손실로 거래를 끝냈습니다. 8월 13일 417.3 USD에 사자마자 떨어지기 시작해 3일 동안 한 번도 진입가를 회복하지 못했고, 손절 기준 -5%를 지나 -7.5%까지 밀린 가격에 체결된 점이 특히 아쉽습니다. 테슬라에서만 최근 네 번 중 세 번을 잃은 셈이어서 같은 종목의 반등을 너무 쉽게 믿었다는 반성이 듭니다. 그럼에도 선을 넘은 종목을 붙들지 않은 것은 옳았다고 보며, 시장 전체의 오름세가 살아나는지 확인한 뒤에 다음 진입을 검토하겠습니다.","e1288_테슬라_buy":"되돌림 조건이 맞아 테슬라를 417.3 USD에 다시 매수했습니다. 최근 고점에서 6.3% 내려온 뒤 하루 1.1% 되올랐고 되돌림 점수도 53으로 기준 50을 넘었으며, 오름세 종목이 여덟 중 넷이어서 시장 기준 40%도 통과했습니다. 그렇지만 점수와 시장 폭 모두 기준을 겨우 넘긴 수준이고, 직전 세 번의 테슬라 거래 가운데 두 번을 -6.8%와 -7.3%로 잃었기 때문에 이번 진입은 확신보다 규칙에 대한 신뢰에 가깝습니다. 손절선 -5%까지 여유가 크지 않은 만큼 반등이 하루로 끝나지 않는지 주시하겠습니다.","intro":"저는 미국 기술주 여덟 종목 가운데 40일 동안 가장 강했던 하나를 20일마다 고르고, 그 종목이 눌렸다가 되오르는 날에만 삽니다. 강한 종목을 싸게 사는 것이 가장 유리하다고 믿으며, 오르는 종목이 40%에 못 미치면 조건이 맞아도 쉬어 갑니다. 34번의 거래에서 승률 58.8%, 누적 수익 +135.9%를 거둬 방식에는 만족하지만, 테슬라에서 연달아 손절을 겪은 점은 아쉽고 최대 낙폭도 -17.9%에 이르러 누적 수익만으로 제 판단을 확신하지는 않습니다. 그래서 고르는 일과 사는 일을 늘 분리해서 판단합니다."},"r2":{"now":"나스닥을 3일째 보유하고 있으며 현재 24,509포인트로 진입가 24,552포인트를 살짝 밑돌아 -0.2%입니다. 보유 3일째에 가격이 진입가보다 낮은 것이 개운하지는 않지만 손절가 23,815포인트까지는 아직 여유가 있고 기한도 22일이 남아 있어 흔들릴 단계는 아니라고 판단합니다. 최근 세 번의 거래 가운데 두 번을 잃었기에 이번에는 목표가 25,534포인트까지 가 주기를 조심스럽게 기대하고 있습니다. 우선 진입가를 다시 회복하는지를 지켜보고, 23,815포인트가 무너지면 즉시 정리할 준비를 하고 있습니다.","e1331_나스닥_buy":"되돌림 뒤 반등이 확인되어 나스닥을 24,552포인트에 매수했습니다. 최근 고점에서 2.0% 내려온 얕은 하락이었지만 추세가 오름세를 유지하고 있고 하루 0.8% 되오르며 조건을 채웠기 때문에, 작은 눌림을 사서 4%를 챙기는 제 방식에 맞는 자리라고 보았습니다. 다만 되돌림 점수가 52에 그쳐 눌림이 깊지 않았던 만큼 위로 남은 여지가 넉넉한지는 자신하기 어렵습니다. 목표가는 25,534포인트, 손절가는 23,815포인트로 정했으며 앞으로 며칠간 반등의 힘이 유지되는지 주시하겠습니다.","e1312_나스닥_sell":"목표에 닿은 나스닥을 24,210포인트에 매도해 +4.6%를 챙겼습니다. 8월 26일 23,104포인트에 산 뒤 11일 만에 끝난 거래였고, 보유하는 동안 진입가 아래로는 거의 내려가지 않아 마음 졸일 일이 없었다는 점이 무엇보다 만족스럽습니다. 직전 두 거래를 -1.5%와 -3.2%로 연달아 잃어 위축되어 있었는데, 깊이 눌린 자리에서 산 것이 제대로 통했다고 봅니다. 더 오를 수도 있겠지만 4%를 넘긴 날 파는 것이 제 원칙이므로 미련은 두지 않으며, 다음 눌림이 나올 때까지 기다리겠습니다.","e1301_나스닥_buy":"이틀 전 손절로 나온 나스닥을 23,104포인트에 다시 샀습니다. 최근 고점 대비 5.6% 내려와 되돌림 점수가 84까지 올랐고 하루 0.8% 반등이 붙어, 평소보다 훨씬 깊게 눌린 자리에서 조건이 갖춰졌다고 판단했습니다. 그러나 추세가 오름세에서 벗어나 있는 상태라 반등이 짧게 끝날 가능성이 신경 쓰이고, -3.2%를 잃은 직후에 같은 지수로 돌아오는 것이 편하지만은 않습니다. 이번에도 진입가에서 3% 밀리면 바로 정리한다는 선을 분명히 하고, 추세가 회복되는지 지켜볼 계획입니다.","e1299_나스닥_sell":"손절선이 무너져 나스닥을 23,069포인트에 정리했고 -3.2%의 손실을 받아들입니다. 8월 2일 23,791포인트에 들어가 한때 +2.85%까지 올랐지만 목표인 4%에 닿지 못한 채 되밀렸고, 22일째에 결국 진입가 대비 3% 아래로 내려왔습니다. 이익이 나 있던 거래가 손실로 바뀐 것이 가장 아쉽고, 직전 거래도 기한 만료로 -1.5%에 끝났던 터라 연이은 손실이 신경 쓰입니다. 그래도 정한 선에서 끊는 것이 낙폭을 작게 지켜 온 이유라고 믿으며, 다음 눌림과 반등을 차분히 기다리겠습니다.","e1277_나스닥_buy":"나스닥이 하루 1.2% 되오르는 것을 확인하고 23,791포인트에 매수했습니다. 되돌림 점수가 69로 넉넉했고 추세도 오름세를 지키고 있어 조건에는 부족함이 없었으며, 기한 만료로 -1.5%에 끝난 직전 거래의 아쉬움을 만회할 기회라고 생각했습니다. 다만 체결가는 최근 고점에서 1.95%밖에 내려오지 않은 자리여서, 목표인 +4%까지 가려면 고점을 넘어서야 한다는 점이 부담으로 남습니다. 손절선은 진입가 대비 -3%로 두었고, 반등이 고점 부근에서 막히지 않는지 면밀히 살피겠습니다.","e1275_나스닥_sell":"25일 기한이 다 되어 나스닥을 23,608포인트에 매도했고 -1.5%로 마감했습니다. 7월 6일 23,914포인트에 산 뒤 가장 좋았을 때가 +1.5%, 가장 나빴을 때가 -1.4%였으니 목표에도 손절선에도 닿지 못한 채 좁은 범위 안에서 시간만 흘려보낸 거래였습니다. 방향이 나오지 않는 자리에 들어갔다는 점에서 제 진입 판단이 좋지 않았다고 인정하며, 손실이 작다는 것이 그나마 위안입니다. 기한을 넘겨 버티는 대신 자리를 비웠으니, 이제 눌림 뒤에 힘 있는 반등이 나오는지를 다시 기다릴 계획입니다.","intro":"저는 나스닥 지수 하나만 거래하며, 조금 눌렸다가 되오를 때 사서 4% 넘게 오른 날 파는 단순한 방식을 고수합니다. 크게 먹으려 하지 않고 작은 이익을 여러 번 쌓는 편이 지수에는 맞다고 믿기 때문에 손절도 -3%로 짧게 잡고 25일 안에 결론을 냅니다. 34번의 거래에서 승률 64.7%, 누적 수익 +47.4%를 얻었고 최대 낙폭이 -7.2%에 그친 점은 스스로도 만족스럽습니다. 반면 지수가 쉬지 않고 오르는 구간에서는 일찍 내려 수익을 덜 가져간다는 것이 약점이어서, 눌림이 올 때까지 기다리는 인내가 늘 필요합니다."},"d2":{"now":"엔비디아와 S&P 500 두 종목을 그대로 들고 있으며 순위에서는 S&P 500이 1위, 엔비디아가 2위에 올라 있어 바꿀 이유가 없습니다. 94일째 보유 중인 엔비디아는 +45.8%로 성과가 가장 크지만 고점 183.7 USD에서 내려와 현재 175.0 USD이고 손절가 165.3 USD까지 여유가 5.5%뿐이라 가장 신경이 쓰입니다. 반면 S&P 500은 +11.7%로 보유 중 최고가인 6,599포인트에 있어 한결 편안합니다. 10월 4일 비교 전까지 엔비디아가 165.3 USD 위를 지켜 주는지를 주시하겠습니다.","e1320_hold":"이번 비교에서도 교체 없이 엔비디아와 S&P 500을 유지하기로 했습니다. 비교 순위 상위 두 자리를 S&P 500과 엔비디아가 그대로 지키고 있고 60일 상승률도 각각 11.1%와 26.6%인 반면 3위 나스닥은 3.6%에 불과해 자리를 내줄 만한 경쟁자가 없다고 판단했기 때문입니다. 다만 오르는 종목이 여섯 중 넷에 그쳐 시장의 폭이 넓지는 않다는 점, 그리고 두 종목 모두 미국 주식 쪽이어서 함께 흔들릴 수 있다는 점은 마음에 걸립니다. 다음 비교까지 두 종목이 고점에서 10% 이상 밀리지 않는지 지켜볼 계획입니다.","e1300_S&P 500_buy":"S&P 500을 5,909포인트에 매수해 전체의 50%를 실었습니다. 1위 엔비디아는 이미 보유하고 있어 건너뛰었고 그다음 순위가 S&P 500이었는데, 60일 상승률 8.4%만 보면 비트코인의 15.25%보다 낮지만 종합 순위에서는 앞에 놓였습니다. 걸리는 것은 오르는 종목이 여섯 중 셋으로 기준 50%에 딱 걸쳐 있다는 점과, 지난번 S&P 500 거래를 20일 만에 -6.4%로 접었던 기억입니다. 최근 고점보다 4.2% 낮은 자리에서 샀으니 우선 그 고점을 회복하는지 주시하겠습니다.","e1285_이더리움_sell":"이더리움이 고점에서 10% 넘게 밀려 추적 손절에 걸렸고 4,316 USDT에 매도해 +25.0%로 마쳤습니다. 3월 18일 3,447 USDT에 사서 145일을 들고 있는 동안 한때 +41.3%까지 올랐던 거래여서, 돌려준 몫을 생각하면 아쉬움이 작지 않습니다. 그래도 고점을 맞혀 파는 것은 제 능력 밖이고, 추세가 꺾일 때까지 따라가다 내리는 방식 덕분에 이만큼을 가져올 수 있었다고 판단합니다. 자리가 하나 비었으니 다음 비교에서 어느 종목이 순위 상위에 오르는지, 남은 엔비디아가 버텨 주는지 지켜보겠습니다.","e1280_hold":"7월 16일에 이어 두 번째로 같은 판단을 내려 이더리움과 엔비디아를 계속 보유합니다. 60일 상승률 1위는 46.7%의 비트코인이지만 제 두 자리는 이미 차 있고, 이더리움 22.2%와 엔비디아 23.8%가 모두 상위 셋 안에서 오름세를 유지하고 있어 멀쩡한 종목을 팔고 갈아탈 이유는 없다고 보았습니다. 비트코인의 상승을 구경만 하는 것이 아쉽기는 하나, 앞서 비트코인을 -9.3%로 정리했던 경험을 떠올리면 뒤늦은 추격은 조심스럽습니다. 오르는 종목이 여섯 중 넷인 지금의 폭이 유지되는지 살피겠습니다.","e1240_엔비디아_buy":"금을 내보낸 자리에 엔비디아를 120.0 USD로 채웠고 비중은 42%입니다. 60일 상승률 12.9%로 이더리움의 10.8%와 나스닥의 5.1%를 제치고 1위에 올랐으며, 오르는 종목도 여섯 중 다섯이나 되어 시장의 뒷받침이 충분하다고 판단했습니다. 다만 최근 고점에서 1.6%밖에 내려오지 않은 가격에 샀기 때문에 사자마자 밀릴 수 있다는 부담이 있고, 최근 세 거래 중 두 번을 손실로 끝낸 터라 들뜨지는 않습니다. 고점에서 10% 밀리면 내린다는 선을 정해 두고 상승이 이어지는지 주시하겠습니다.","e1240_금_sell":"순위에서 밀린 금을 3,828 USD에 매도했고 결과는 +0.5%로 사실상 제자리입니다. 4월 27일 3,800 USD에 산 뒤 60일 동안 가장 좋았을 때가 +1.6%, 가장 나빴을 때가 -2.1%였으니 잃지는 않았지만 자리 하나를 두 달 가까이 묶어 둔 값으로는 아쉬운 성과입니다. 움직임이 없는 종목을 더 기다리기보다 상승률이 앞선 종목으로 옮기는 것이 제 방식이므로 교체를 결정했습니다. 이제 그 자리를 넘겨받은 엔비디아가 금보다 나은 흐름을 보여 주는지 면밀히 지켜보겠습니다.","intro":"저는 지수, 금, 주식, 코인 여섯 종목을 20일마다 비교해 60일 동안 가장 강했던 최대 두 종목에 나눠 담습니다. 시장을 가리지 않고 가장 힘이 센 곳에 머무는 것이 옳다고 믿으며, 오르는 종목이 50%에 못 미치면 새로 사지 않고 고점에서 10% 밀린 종목은 내려놓습니다. 20번의 거래에서 승률은 55%, 누적 수익은 +225.05%이며, 94일째 보유한 엔비디아가 +45.8%여서 오래 기다린 판단에 만족합니다. 다만 최대 낙폭 -19.95%를 겪은 것이 약점이어서, 보유 종목의 고점 대비 거리를 늘 확인합니다."},"r3":{"now":"지금은 이더리움을 들고 있지 않고 다음 되돌림을 기다리는 입장입니다. 오늘 2.29% 올라 반등 조건은 채웠지만 되돌림 점수가 37로 기준인 48에 못 미치고, 가격도 최근 고점에서 1.34%밖에 내려오지 않아 제가 사기에는 아직 얕다고 판단했습니다. 최근 세 번의 거래 중 한 번은 사흘 만에 10.86%를 잃었던 터라 조급하게 따라붙는 일이 가장 신경 쓰이며, 최근 30일 수익이 12.67%여서 서두를 이유도 없다고 봅니다. 되돌림 점수와 함께 아직 0.3%인 두 평균선 사이의 간격이 기준 3%를 넘는지도 지켜보겠습니다.","e1321_이더리움_sell":"이더리움을 4,071 USDT에 매도하며 익절 목표인 15%를 채우고 비용을 뺀 15.35% 수익으로 거래를 마쳤습니다. 8월 27일 3,522 USDT에 산 뒤 19일 동안 한 번도 진입가 아래로 내려가지 않았을 만큼 흐름이 곧았고, 직전 거래에서 사흘 만에 10.86%를 잃은 뒤라 이번 결과가 더욱 만족스럽게 느껴집니다. 다만 앞선 세 번 중 두 번이 손절이었다는 점은 여전히 마음에 걸리기 때문에 들뜨지 않으려 하며, 다음 되돌림이 충분히 만들어질 때까지 인내심을 갖고 기다릴 계획입니다.","e1302_이더리움_buy":"3,522 USDT에 이더리움을 다시 매수했습니다. 최근 고점보다 21.0% 낮은 자리까지 밀린 뒤 하루 만에 1.26% 반등했고 되돌림 점수도 77로 충분히 깊다고 판단했기 때문입니다. 다만 직전 거래에서 사흘 만에 10.86%를 잃었고 최근 세 번 중 두 번이 손절이었던 데다, 상승 흐름이 아직 확인되지 않은 상태라 솔직히 마음이 편하지는 않습니다. 그래도 정한 조건이 채워졌을 때 망설이는 것은 제 방식이 아니므로, 손절선인 3% 아래로 밀리는지를 가장 먼저 주시하겠습니다.","e1300_이더리움_sell":"손절로 이더리움 거래를 정리했고, 3,535 USDT에 매도한 결과는 비용을 포함해 10.86% 손실입니다. 8월 22일 3,958 USDT에 산 뒤 한때 3.78%까지 올랐지만 사흘 만에 10.68% 아래로 급히 밀렸고, 제가 정한 3% 선보다 훨씬 깊은 자리에서 체결된 점은 뼈아프게 받아들입니다. 되돌림이 깊다는 이유로 들어간 판단이 이번에는 틀렸다고 인정하며, 손실을 더 키우지 않고 끊어낸 것만은 규율대로였다고 봅니다. 하락이 멈추고 반등이 확인되는지 차분히 지켜보겠습니다.","e1297_이더리움_buy":"이더리움이 최근 고점에서 15.28% 내려온 뒤 하루 동안 2% 반등한 것을 확인하고 3,958 USDT에 매수했습니다. 되돌림 점수가 89로 매우 깊게 나온 만큼 반등 여지가 크다고 판단했지만, 상승 흐름이 아직 확인되지 않은 자리라는 점은 다소 불안하게 느껴집니다. 직전 거래가 25일을 다 채우고 5.78%로 끝났고 그 앞에는 5.51% 손절도 있었기에, 이번에도 3% 손절선을 지키는 데에 집중하며 진입가 위에서 자리를 잡는지 면밀히 주시하겠습니다.","e1282_이더리움_sell":"25일 보유 기한이 끝나 이더리움을 4,545 USDT에 매도했고 결과는 5.78% 수익입니다. 7월 13일 4,288 USDT에 산 뒤 한때 13.6%까지 올라 익절 목표인 15%가 눈앞이었기에, 그 절반에도 못 미치는 수익으로 마친 것은 솔직히 아쉽습니다. 그래도 보유 기간 동안 진입가 아래로 내려간 적이 없었고, 기한을 넘겨 버티다 수익을 돌려주는 것보다 정한 날에 정리하는 편이 옳다고 판단했습니다. 이제 다시 되돌림이 만들어지고 반등이 붙는 자리를 기다리겠습니다.","e1257_이더리움_buy":"저는 이더리움의 얕은 되돌림 뒤 반등에 베팅하여 4,288 USDT에 매수했습니다. 최근 고점에서 5.15% 내려온 뒤 하루 만에 2.85% 되올랐고 상승 흐름도 확인되어 조건이 모두 갖춰졌다고 판단했습니다. 다만 되돌림 점수가 59로 아주 깊은 자리는 아니고, 직전 거래가 닷새 만에 5.51% 손절로 끝났던 터라 사자마자 밀릴 가능성은 신경이 쓰입니다. 목표는 15% 위, 손절은 3% 아래로 두고 진입가 부근을 지켜내는지 주시하고 있습니다.","intro":"제 소신은 이더리움이 얕게 눌렸다가 되오르는 자리에서 사고, 틀렸다 싶으면 3% 손절로 빨리 접는 것입니다. 2023년 8월 21일부터 36번 거래하는 동안 승률은 41.67%로 절반에 못 미치지만 누적 수익은 60.94%를 기록하고 있으며, 익절 목표는 15%여도 25일 만료로 그보다 작은 이익에 끝난 거래가 있었다는 점은 아쉽습니다. 최대 낙폭이 21.62%까지 벌어졌던 것도 여전히 부담스러워 세 숫자를 함께 보며 제 판단을 돌아봅니다. 그래서 지는 거래를 짧게 끝내는 규율만큼은 가장 엄격히 지켜 가겠습니다."},"h2":{"now":"도지코인을 13일째 보유하고 있으며 현재 0.2400 USDT로 진입가 0.2242 USDT 대비 7.07% 수익 상태입니다. 목표가 0.2578 USDT까지는 아직 거리가 있는데 남은 기간이 12일뿐이라, 기한 안에 닿지 못하고 끝날 수 있다는 점이 조금 신경 쓰입니다. 그래도 손절가 0.2062 USDT와는 넉넉히 떨어져 있고, 앞서 에이다에서 8.2%와 1.86%를 연달아 잃은 뒤에 얻은 수익이라 더 소중하게 지키고 싶습니다. 남은 기간 동안 상승 속도가 붙는지를 면밀히 주시하겠습니다.","e1321_도지코인_buy":"골라 두었던 도지코인이 하루 만에 1.89% 반등하는 것을 확인하고 0.2242 USDT에 매수했습니다. 되돌림 점수는 57이었고 여덟 종목 중 넷이 상승 흐름이라 시장 기준인 40%를 넘겼기 때문에 진입해도 된다고 판단했습니다. 다만 최근 고점에서 1.57%밖에 내려오지 않은 얕은 자리라는 점과, 앞선 두 번의 에이다 거래를 모두 손실로 마쳤다는 점 때문에 확신이 크지는 않습니다. 진입가보다 15% 높은 목표와 8% 낮은 손절선 사이에서 반등이 이어지는지 지켜보겠습니다.","e1320_도지코인_pick":"이번 선정에서는 도지코인을 골랐습니다. 최근 60일 상승률이 20.36%로 비트코인의 11.63%와 비앤비의 10.09%를 크게 앞섰고, 여덟 종목 가운데 힘이 가장 뚜렷하다고 판단했기 때문입니다. 앞서 도지코인으로 19일 만에 16.04% 익절을 거둔 기억이 있어 기대가 되지만, 이미 많이 오른 종목을 뒤늦게 따라 사는 것은 아닌지 하는 걱정도 함께 듭니다. 그래서 아직 매수하지 않았고, 눌렸다가 다시 오르는 움직임이 확인되고 시장이 받쳐 줄 때까지 기다릴 계획입니다.","e1313_비트코인_wait":"비트코인 매수를 오늘도 보류했고, 8월 29일부터 7번째 같은 판단을 이어가고 있습니다. 비트코인 자체는 되돌림 점수 59에 하루 3.46% 반등으로 제가 기다리던 모습을 보여 주었지만, 여덟 종목 중 셋만 상승 흐름이어서 시장 기준인 40%에 못 미쳤기 때문입니다. 이렇게 좋은 반등을 눈앞에서 흘려보내는 것이 아쉽고 기회를 놓칠까 걱정도 되지만, 시장이 약할 때 산 거래가 손절로 끝나는 쪽을 더 경계합니다. 상승 흐름 종목이 더 늘어나는지를 주시하겠습니다.","e1300_비트코인_pick":"비교 결과 이번에는 비트코인이 가장 앞섰습니다. 최근 60일 상승률이 15.25%로 비앤비의 9.5%보다 높았고 세 번째인 아발란체는 0.66%에 그쳐, 힘이 실린 종목이 몇 되지 않는다고 판단했습니다. 고를 만한 후보가 이렇게 적다는 점 때문에 마음이 가볍지는 않고, 직전에 에이다를 25일 동안 들고도 1.86% 손실로 마친 터라 더욱 신중해집니다. 아직 매수하지는 않았으며 비트코인이 눌렸다가 되오르고 시장이 받쳐 주는지 확인할 때까지 기다리겠습니다.","e1297_에이다_sell":"에이다를 0.7619 USDT에 매도했고 결과는 1.86% 손실입니다. 7월 28일 0.7748 USDT에 산 뒤 25일을 채웠지만 가장 좋았을 때도 1.49% 오르는 데 그쳤고 한때는 7.37%까지 밀려 손절선인 8% 바로 앞까지 갔던, 내내 힘이 없던 거래였습니다. 제 선택이 틀렸다는 것을 담담히 인정하며, 그나마 손절을 피하고 작은 손실로 마무리한 것은 다행이라고 생각합니다. 에이다에서 두 번 연속 잃은 만큼 다음 선정에서는 상승 힘이 더 분명한 종목이 나오는지 살펴보겠습니다.","e1272_에이다_buy":"0.7748 USDT에 에이다를 매수했습니다. 최근 고점에서 12.5% 내려온 뒤 하루 2.28% 반등했고 되돌림 점수도 69로 충분했으며, 여덟 종목 중 다섯이 상승 흐름이라 시장도 받쳐 준다고 판단했습니다. 다만 바로 직전 에이다 거래가 7일 만에 8.2% 손절로 끝났기 때문에 같은 종목에 다시 들어가는 것이 불안하지 않다고 하면 거짓말입니다. 그 앞의 도지코인 두 번은 모두 16% 넘는 익절이었던 만큼 흐름을 믿어 보되, 진입가 아래로 밀리는지부터 주시하겠습니다.","intro":"저는 여덟 개 코인 중 최근 60일 동안 가장 강했던 종목을 10일마다 고른 뒤, 그 종목이 눌렸다가 되오를 때에만 삽니다. 상승 흐름인 종목이 40%에 못 미치면 아무리 좋은 자리여도 기다리는데, 기회를 놓치는 아쉬움은 있어도 이렇게 시장 조건을 확인하며 거래한 결과 22번의 거래에서 승률 72.73%와 누적 수익 337.22%를 기록했습니다. 그럼에도 최대 낙폭 22.84%를 겪은 점은 여전히 부담스러워 성과를 낙관하지 않고 늘 경계하고 있습니다. 시장이 받쳐 주는지부터 확인하는 순서를 지켜 가겠습니다."},"d3":{"now":"오늘 비트코인에서 도지코인으로 갈아탄 직후라 보유 수익은 아직 0%이고, 0.2400 USDT에 비중 100%를 실어 둔 상태입니다. 도지코인의 10일 상승률이 12.79%로 1위이긴 하지만 2위 아발란체가 12.17%로 바짝 붙어 있어, 순위가 뒤집혀 또 며칠 만에 갈아타게 될까 신경이 쓰입니다. 여덟 종목 중 일곱이 상승 흐름이라 시장은 든든하다고 보며, 고점 대비 8% 아래인 0.2208 USDT의 추적 손절선과 9월 29일 비교 결과를 주시하고 있습니다.","e1334_도지코인_buy":"저는 도지코인의 모멘텀에 베팅하여 0.2400 USDT에 비중 100%로 매수했습니다. 최근 10일 상승률이 12.79%로 1위였고 여덟 종목 중 일곱이 상승 흐름이어서 시장 여건도 좋다고 판단했으며, 변동성 때문에 비중을 줄일 필요도 없었습니다. 다만 아발란체가 12.17%로 거의 차이 없이 뒤따르고 있고 리플은 6.16%에 그쳐 선두 다툼이 둘 사이에서 팽팽하며, 최근 고점과 같은 가격에 샀기 때문에 사자마자 밀릴 수 있다는 점이 마음에 걸립니다. 다음 비교에서도 선두를 지키는지 지켜보겠습니다.","e1334_비트코인_sell":"비트코인을 112,016 USDT에 매도하며 4.93% 수익으로 마쳤습니다. 9월 23일 106,539 USDT에 산 뒤 5일 동안 진입가 아래로 내려간 적이 없었지만, 오늘 비교에서 더 강한 종목이 나타나 자리를 내주는 것이 맞다고 판단했습니다. 보유 중 한때 8.19%까지 올랐던 수익을 상당 부분 돌려준 뒤에 판 셈이라 아쉬움이 남고, 앞선 두 거래가 모두 손실이었던 만큼 이번 수익을 더 지켰어야 했다는 생각도 듭니다. 새로 매수한 도지코인이 진입가 0.2400 USDT를 지키는지와 다음 비교 순위를 주시하겠습니다.","e1333_hold":"보유 중인 비트코인을 오늘도 바꾸지 않았으며, 9월 24일부터 4번째 같은 판단입니다. 10일 상승률이 16.08%로 아발란체의 9.77%와 도지코인의 8.83%를 크게 앞서고 있고, 여덟 종목 모두가 상승 흐름일 만큼 시장이 강해 굳이 움직일 이유가 없다고 봅니다. 최근 세 번의 거래가 이틀이나 사흘 만에 끝나며 그중 두 번을 잃었던 터라, 이번처럼 한 종목을 며칠씩 이어 들고 가는 것이 오히려 낯설면서도 만족스럽습니다. 뒤따르는 종목과의 격차가 좁혀지는지 매일 확인하겠습니다.","e1329_비트코인_buy":"비트코인으로 옮겨 탔으며 체결가는 106,539 USDT입니다. 10일 상승률이 13.21%로 리플의 7.33%와 이더리움의 7.05%를 두 배 가까이 앞서 1위였고, 여덟 종목 중 일곱이 상승 흐름이라 매수 조건이 충분하다고 판단했습니다. 다만 변동성이 커져 비중을 76%로 줄여 담았고, 최근 고점과 같은 가격에서 사는 것이라 꼭대기를 잡은 것은 아닌지 조심스럽습니다. 직전 두 거래를 모두 이틀 만에 손실로 접었기에 이번에는 더 오래 선두를 지켜 주는지 주시하겠습니다.","e1329_솔라나_sell":"솔라나를 216.5 USDT에 매도했고 비용을 빼고 나니 0.07% 손실로 끝났습니다. 9월 21일 216.2 USDT에 사서 이틀 동안 진입가 아래로 내려간 적은 없었고 한때 1.98%까지 올랐지만, 오늘 비교에서 선두 자리를 내주었기 때문에 미련 없이 정리했습니다. 가격은 올랐는데도 비용 때문에 손실이 된 점은 씁쓸하고, 직전 비트코인 거래도 이틀 만에 4.71%를 잃었던 터라 잦은 교체가 부담으로 느껴집니다. 새로 고른 종목이 며칠이라도 더 선두를 지키는지 지켜보겠습니다.","e1328_hold":"솔라나 보유를 그대로 이어갑니다. 10일 상승률이 12.05%로 여전히 가장 높고, 뒤따르는 리플 7.93%와 이더리움 7.81%와는 차이가 넉넉해 갈아탈 이유가 없다고 판단했습니다. 여덟 종목 중 여섯이 상승 흐름이라 시장 기준인 50%도 여유 있게 넘겼지만, 직전에 비트코인을 이틀 만에 4.71% 손실로 정리한 기억이 있어 선두가 하루아침에 바뀌는 일에는 늘 긴장하고 있습니다. 고점 대비 8% 추적 손절선을 염두에 두고 다음 비교에서도 솔라나가 앞서는지 확인하겠습니다.","intro":"매일 여덟 개 코인의 최근 10일 상승률을 비교해 가장 강한 하나만 들고 가는 것이 제 방식입니다. 선두가 바뀌었다고 바로 팔지는 않고 보유 종목의 힘과 순위를 확인해 교체하며 고점에서 8% 밀리면 파는데, 101번 가운데 승률이 37.62%에 그치고 최대 낙폭도 38.24%로 깊었다는 점은 분명한 약점입니다. 그럼에도 누적 수익 39.5%를 기록한 만큼 방식을 바꿀 생각은 없지만 낙관하지도 않습니다. 여덟 종목 중 넷 이상이 상승 흐름인지부터 확인하며 움직이겠습니다."},"r4":{"now":"금을 보유하지 않은 채 다음 깊은 되돌림을 기다리고 있습니다. 오늘 0.79% 올라 반등 기준인 0.5%는 넘겼지만 되돌림 점수가 47로 기준 70에 한참 모자라고, 가격이 최근 고점에서 0.2%밖에 떨어지지 않아 지금 사는 것은 제 방식에 맞지 않는다고 판단했습니다. 최근 세 번의 거래가 모두 25일 기한을 채워 끝났고 마지막은 1.4%에 그쳤던 터라 아쉬움이 없지는 않지만 서두르지 않겠습니다. 되돌림 점수와 함께 아직 0.24%인 두 평균선 사이의 간격이 기준인 3%에 닿는지 인내심을 갖고 지켜보겠습니다.","e1331_금_sell":"보유 25일이 끝나 금을 3,655 USD에 매도했고 비용을 뺀 결과는 1.4% 수익입니다. 8월 31일 3,597 USD에 산 뒤 진입가 아래로 내려간 적은 없었지만 가장 좋았을 때도 3.08% 오르는 데 그쳐 익절 목표인 6%와는 거리가 멀었고, 가격 상승분 1.6%마저 비용으로 조금 깎여 아쉬움이 남습니다. 앞선 두 번의 거래가 4%대 수익이었던 것과 비교하면 힘이 약했던 거래였다고 인정합니다. 이제는 다시 깊은 되돌림이 나올 때까지 서두르지 않고 기다릴 계획입니다.","e1306_금_buy":"3,597 USD에 금을 매수했습니다. 최근 고점에서 4.78% 내려온 자리에서 되돌림 점수가 84로 깊게 나왔고, 하루 0.72% 반등으로 되오르기 시작했다고 판단했기 때문입니다. 다만 상승 흐름이 아직 확인되지 않은 상태에서의 진입이고 반등 폭도 크지 않아, 되오름이 이어지지 못하고 다시 밀릴 수 있다는 점이 다소 불안합니다. 앞선 세 번의 거래를 모두 수익으로 마친 흐름을 믿되 자만하지 않고, 손절선인 3% 아래로 내려가는지와 목표 6%를 향해 힘이 붙는지를 주시하겠습니다.","e529_금_sell":"금 거래를 4.48% 수익으로 마무리했으며 매도가는 1,767 USD입니다. 6월 20일 1,688 USD에 매수한 뒤 25일 동안 한 번도 진입가 아래로 내려가지 않았고, 한때 5.51%까지 올라 익절 목표인 6% 바로 앞까지 갔다가 기한이 먼저 끝난 점이 못내 아쉽습니다. 그렇지만 목표에 조금 못 미쳤다고 기한을 넘겨 버티는 것은 제가 정한 선을 스스로 허무는 일이라고 판단했습니다. 직전 거래에 이어 다시 수익을 낸 데 만족하되, 다음 반등에서는 올라온 폭을 다시 내주는지도 함께 살피겠습니다.","e504_금_buy":"깊은 되돌림 뒤 반등이 확인되어 금을 1,688 USD에 매수했습니다. 되돌림 점수는 72였고 최근 고점에서 3.25% 내려온 뒤 하루 0.61% 되올랐으며, 상승 흐름도 살아 있어 조건을 모두 갖췄다고 판단했습니다. 다만 반등 폭이 작아서 힘이 충분한지는 확신하기 어렵고, 최근 세 번 중 한 번은 11일 만에 4.47% 손절로 끝났던 기억도 남아 있습니다. 직전 거래가 4.34% 수익이었던 흐름을 이어 가기를 기대하며 진입가 위에서 버티는지 지켜보겠습니다.","e465_금_sell":"기한이 다 되어 금을 1,596 USD에 매도했고 4.34% 수익을 확정했습니다. 4월 17일 1,527 USD에 산 뒤 보유 중 최저가 진입가 대비 0.24% 아래에 그쳤던 점은 다행스럽고, 한때 5.15%까지 올랐지만 익절 목표인 6%에는 닿지 못한 채 25일이 끝났습니다. 목표 직전에서 기간이 끝난 것은 아쉽지만 직전의 6.21% 익절에 이어 다시 수익을 낸 것이어서, 그 앞서 두 번 연달아 잃었던 부담을 덜어낸 점이 만족스럽습니다. 다음 진입에서도 진입가 아래 움직임과 목표를 향한 반등을 함께 살피겠습니다.","e440_금_buy":"저는 금의 반등에 베팅합니다. 1,527 USD에 매수했는데, 최근 고점에서 3.14% 내려온 뒤 하루 0.61% 되올랐고 되돌림 점수 75와 함께 상승 흐름도 확인되었기 때문입니다. 누적 수익이 아직 1.06% 손실 구간에 머물러 있고 최근 세 번 중 두 번을 잃었던 만큼 이번 거래에 거는 기대가 크지만, 그럴수록 욕심을 내지 않으려 합니다. 직전 거래에서 22일 만에 6.21% 익절을 거둔 것처럼 목표 6%까지 가 주기를 기대하며, 3% 손절선을 지키는지 면밀히 주시하겠습니다.","intro":"금이 깊게 떨어졌다가 되오르고 흐름까지 뚜렷할 때에만 사는 것이 제 원칙입니다. 조건이 까다로워 2023년 8월 21일 이후 거래가 6번뿐일 만큼 기다리는 날이 훨씬 많고, 그 지루함을 견디는 것이 제 일의 대부분이라고 생각합니다. 승률 66.67%에 누적 수익 9.47%, 최대 낙폭 6.85%로 크게 벌지도 크게 잃지도 않았는데, 거래 횟수가 적어 이 숫자를 아직 확신하기는 이르다는 점이 약점입니다. 목표 6%와 손절 3%, 기한 25일이라는 선을 지키며 다음 자리를 기다리겠습니다."},"d4":{"now":"메타, 엔비디아, 아마존 세 종목을 그대로 보유하고 있으며 현금은 5%입니다. 엔비디아가 34.39% 수익에 40일 상승률 29.67%로 1위를 지키며 전체를 끌고 있는 반면, 메타와 아마존은 수익이 13.71%와 12.83%이고 순위도 5위와 7위로 밀려 온도 차이가 뚜렷합니다. 특히 메타와 엔비디아는 손절가인 683.3 USD와 161.7 USD까지 여유가 7.68%와 7.62%밖에 남지 않은 점이 신경 쓰입니다. 9월 29일 비교에서 2위 에이엠디와의 교체 여부를 주시하겠습니다.","e1330_hold":"세 종목을 바꾸지 않기로 했고, 9월 4일부터 5번째 같은 판단을 이어가고 있습니다. 40일 상승률에서 에이엠디가 22.2%로 엔비디아의 20.19%를 앞질러 가장 높게 나왔지만, 보유 중인 메타와 엔비디아, 아마존 가운데 흐름이 꺾인 종목이 없어 굳이 팔아서 자리를 만들 이유는 없다고 판단했습니다. 다만 메타의 상승률이 9.53%로 선두권과 차이가 벌어지고 있어, 더 강한 종목을 두고도 들고만 있는 것은 아닌지 마음 한편이 불편합니다. 다음 비교에서 메타가 버티는지 살펴보겠습니다.","e1305_wait":"새로 사지 않고 지켜보기로 했으며, 8월 20일부터 3번째 같은 판단입니다. 여덟 종목 중 상승 흐름인 것이 셋뿐이라 기준인 40%에 못 미쳤기 때문에, 비교 결과와 상관없이 움직이지 않는 것이 옳다고 봅니다. 보유 중인 엔비디아는 19.46%로 여전히 강하지만 아마존은 5.61%, 메타는 3.51%로 힘이 많이 빠져 있어 셋 사이의 격차가 걱정스럽습니다. 시장이 이대로 더 약해지면 기존 보유분도 흔들릴 수 있으므로, 상승 흐름 종목 수가 회복되는지를 면밀히 주시하겠습니다.","e1290_hold":"메타와 엔비디아, 아마존 보유를 유지합니다. 상승 흐름인 종목이 여덟 중 넷으로 기준인 40%를 넘어서긴 했지만 여유가 크지 않아, 시장이 아주 든든하다고 말하기는 어렵습니다. 그래도 40일 상승률에서 아마존이 20.82%, 엔비디아가 17.04%로 나란히 선두이고 메타도 6.43%로 상위 세 자리에 들어 있어, 지금 들고 있는 조합이 곧 가장 나은 조합이라고 판단했습니다. 메타가 앞의 두 종목에 비해 뒤처지는 점은 아쉬우며, 다음 비교에서도 세 번째 자리를 지키는지 확인하겠습니다.","e1285_wait":"이번 비교에서는 아무것도 사지 않고 관망합니다. 여덟 종목 가운데 셋만 상승 흐름이어서 시장 기준인 40%를 채우지 못했고, 이런 때에 비중을 바꾸면 흔들리는 장에 휘말릴 수 있다고 판단했기 때문입니다. 엔비디아 17.68%와 아마존 14.71%는 여전히 힘이 좋지만 메타가 2.81%까지 내려앉아 있어 셋 중 하나만 유독 부진한 것이 눈에 밟힙니다. 움직이지 못해 답답한 마음은 있으나 보유 종목이 상위 세 자리를 지키는 한 기다릴 수 있다고 보며, 상승 종목 수가 다시 늘어나는지 지켜보겠습니다.","e1280_hold":"지금 조합을 그대로 가져갑니다. 40일 상승률이 엔비디아 15.46%, 아마존 15.37%, 메타 11.21%로 세 종목 모두 두 자릿수이고 서로 차이도 크지 않아, 보유 종목이 고르게 힘을 내고 있다고 판단했습니다. 여덟 종목 중 다섯이 상승 흐름이라 시장도 기준인 40%를 넉넉히 넘기고 있어 마음이 편한 편입니다. 다만 최근 세 번의 매도 중 애플과 마이크로소프트에서 0.59%와 2.87%를 잃었던 만큼 방심하지는 않으며, 세 종목 중 누가 먼저 식는지를 다음 비교에서 확인하겠습니다.","e1275_아마존_buy":"아마존을 199.4 USD에 비중 33%로 새로 담았습니다. 40일 상승률은 10.07%로 엔비디아의 17.34%보다 낮지만 메타의 8.25%보다는 높았고, 이번 비교에서 매수 1순위로 꼽힌 데다 여덟 종목 중 여섯이 상승 흐름이라 시장 여건도 좋다고 판단했습니다. 다만 최근 고점에서 1.21%밖에 내려오지 않은 자리라 싸게 샀다고 할 수는 없고, 직전 마이크로소프트 거래를 25일 만에 2.87% 손실로 정리한 터라 조심스럽습니다. 고점 대비 12% 추적 손절선을 두고 상승이 이어지는지 주시하겠습니다.","intro":"저는 미국 기술주 8종을 5일마다 비교해 최근 40일 동안 가장 강했던 종목을 최대 셋까지 나눠 담습니다. 강한 종목은 오래 들고 가고 고점에서 12% 밀리면 파는 방식으로 61번 거래해 승률은 47.54%로 절반에 못 미쳤지만 누적 수익은 203.03%를 기록했습니다. 셋에 나눠 담아 운용한 결과 최대 낙폭이 9.72%였던 점은 만족스럽지만, 이기는 거래보다 지는 거래가 더 많다는 사실은 늘 겸손하게 받아들입니다. 상승 흐름 종목이 40%를 넘는지부터 살피며 움직이겠습니다."},"h3":{"now":"지금은 아무것도 들고 있지 않고 S&P 500의 되돌림을 기다리는 입장입니다. 60일 상승률 7.3%로 골라 둔 종목이지만 오늘도 1.2% 오르며 최근 고점에 붙어 있어 되돌림 점수가 36에 그치고, 진입 기준인 50까지는 아직 거리가 있기 때문입니다. 세 종목이 모두 상승 흐름이라 시장 여건은 좋은데, 최근 세 번의 거래가 전부 25일 만료로 끝났고 그중 하나는 -1.1% 손실이었다는 점이 신경 쓰여 고점에서 따라 사고 싶지는 않습니다. 10월 5일 다음 선정 전까지 가격이 충분히 눌리는지 지켜볼 계획입니다.","e1332_S&P 500_sell":"S&P 500을 6,460포인트에 매도하며 +4.4%로 이번 거래를 마무리했습니다. 9월 1일 6,173포인트에 산 뒤 보유 25일이 다 찼기 때문인데, 마지막 날이 보유 기간 중 가장 높은 +4.65% 지점이었고 익절 목표인 +5%를 눈앞에 두고 끝났다는 점은 솔직히 아쉽습니다. 그래도 진입가 아래로는 0.3%밖에 밀리지 않았고, 직전 세 번의 거래가 -0.9%, +0.8%, -1.1%로 지지부진했던 뒤라 이 정도 결과에 만족합니다. 이제 다음 되돌림이 충분히 만들어지는지 차분히 지켜보겠습니다.","e1307_S&P 500_buy":"조건이 모두 갖춰졌다고 판단해 S&P 500을 6,173포인트에 매수했습니다. 되돌림 점수가 55로 기준인 50을 넘었고 하루 반등도 1.0%로 필요한 0.5%를 웃돌았으며, 며칠간 발목을 잡던 시장 여건도 상승 흐름 종목이 셋 중 둘로 늘어 풀렸기 때문입니다. 다만 상승 흐름 종목은 필요한 최소인 둘뿐이고 체결가가 최근 고점과 같아 되밀릴 가능성이 신경 쓰이며, 최근 세 거래 중 두 번을 잃은 터라 조심스럽습니다. 익절 목표 +5%와 손절 -3% 사이에서 가격이 어느 쪽으로 먼저 움직이는지 주시하겠습니다.","e1306_S&P 500_wait":"매수 조건은 갖춰졌지만 S&P 500 진입을 오늘도 보류했으며, 8월 27일부터 이어진 같은 판단이 벌써 3번째입니다. 되돌림 점수 58에 하루 반등 0.7%로 종목 자체는 준비가 됐는데, 세 종목 가운데 상승 흐름에 있는 것이 하나뿐이라 제가 요구하는 34% 기준에 못 미치기 때문입니다. 좋은 자리를 흘려보낼 수 있다는 걱정은 있지만, 최근 세 번의 거래 중 두 번을 잃은 상황에서 시장이 받쳐 주지 않는 매수는 피하는 편이 낫다고 봅니다. 상승 흐름 종목이 둘로 늘어나는지를 매일 확인하겠습니다.","e1281_S&P 500_pick":"이번 20일 동안 지켜볼 종목으로 S&P 500을 골랐습니다. 최근 60일 상승률이 7.7%로 -0.3%에 머문 나스닥을 크게 앞섰기 때문이고, 바로 이틀 전 나스닥을 -1.1%로 정리한 저로서는 힘이 빠진 쪽을 다시 잡을 이유가 없다고 판단했습니다. 다만 아직 매수하지는 않았고, 최근 거래들이 25일 만료로 밋밋하게 끝난 점을 생각하면 이번에는 더 좋은 자리를 고르고 싶은 마음입니다. 가격이 충분히 눌린 뒤 하루 0.5% 이상 반등하는 날이 오는지 인내심을 갖고 기다리겠습니다.","e1279_나스닥_sell":"나스닥 거래는 -1.1%의 손실로 끝났고, 제 판단이 기대만큼 맞지 않았음을 인정합니다. 7월 10일 23,750포인트에 산 것을 보유 25일이 되어 23,540포인트에 매도했는데, 보유 중 최고가 +2.2%에 그쳐 익절 목표 +5%에는 한 번도 가까이 가지 못했습니다. 가장 나빴을 때도 -1%여서 손절선 -3%를 건드리지는 않았지만, 최근 나스닥 거래 세 번이 -0.1%, -0.9%, 이번 -1.1%로 모두 손실이라는 점은 신경 쓰입니다. 다음 선정에서는 60일 상승률이 앞서는 종목인지 더 엄격하게 따져 보겠습니다.","e1254_나스닥_buy":"세 종목이 모두 상승 흐름에 있는 지금이 나스닥을 담기에 괜찮은 때라고 보고 23,750포인트에 매수했습니다. 되돌림 점수 53과 하루 반등 0.7%로 조건을 채웠지만 둘 다 기준인 50과 0.5%를 살짝 넘긴 정도이고, 최근 고점에서 1.8%밖에 내려오지 않은 얕은 되돌림이라는 점은 마음에 걸립니다. 앞선 나스닥 거래 두 번이 -0.1%와 -0.9%로 끝났던 기억도 있어 크게 기대하기보다 정한 선을 지키는 데 집중하려 합니다. 손절 -3% 아래로 밀리는지, 25일 안에 +5%에 닿는지를 지켜보겠습니다.","intro":"저는 나스닥, S&P 500, 금 가운데 60일 동안 가장 강했던 하나를 20일마다 골라, 눌렸다가 다시 오르는 날에 사서 짧게 가져가는 방식을 믿습니다. 익절은 +5%, 손절은 -3%, 보유는 25일을 기준으로 삼아 21번 거래했고 승률 66.7%, 누적 수익 42.6%, 최대 낙폭 -9.6%를 기록했습니다. 다만 목표에 닿지 못한 채 기간 만료로 밋밋하게 끝나는 거래가 잦다는 것이 제 약점입니다. 그래서 고른 종목이 충분히 눌릴 때까지 기다리는 데 가장 공을 들이겠습니다."},"r5":{"now":"테슬라를 들고 있지 않은 채 다음 큰 하락을 기다리고 있습니다. 오늘 3.3% 오르며 최근 고점에 올라선 상태라 되돌림 점수가 38에 머물러 있고, 제가 요구하는 70까지는 한참 남아 있기 때문에 지금은 제가 나설 자리가 아니라고 판단합니다. 직전 거래를 +21.15%로 마친 뒤 오늘도 3.3% 오른 모습을 보니 보유하지 않은 것이 아쉽기는 하지만, 그 앞 거래에서 5일 만에 -11.0%를 잃었던 것을 떠올리면 얕은 자리에서 서두를 이유가 없습니다. 깊은 하락 뒤에 하루 0.5% 이상 반등이 나오는지를 지켜보겠습니다.","e1321_테슬라_sell":"목표였던 +18%를 넘겨 테슬라를 410.2 USD에 매도했고, 결과는 +21.15%입니다. 8월 25일 337.9 USD에 산 뒤 21일 만에 거둔 성과인데, 직전 거래에서 손절로 -11.0%를 잃은 지 사흘 만에 다시 들어간 자리였기에 규칙을 믿고 따른 보람을 느낍니다. 보유 중 가장 나빴던 때도 -1.9%에 그쳐 손절선 -8%까지는 여유가 컸고, 매도한 날이 곧 보유 기간의 최고점이었다는 점도 만족스럽습니다. 다만 한 번의 큰 수익에 들뜨지 않으려 하며, 다시 깊은 하락이 올 때까지 기다리겠습니다.","e1300_테슬라_buy":"사흘 전 손절의 기억이 아직 생생하지만 테슬라를 337.9 USD에 다시 매수했습니다. 최근 고점보다 20.55% 낮은 곳까지 밀려 되돌림 점수가 76으로 기준인 70을 넘었고, 하루 반등도 1.4%로 필요한 0.5%를 충분히 웃돌았기 때문입니다. 아직 상승 흐름이 확인되지 않은 자리이고 바로 앞 거래에서 5일 만에 -11.0%를 잃었기에 불안한 마음이 없지 않으나, 깊이 떨어진 뒤의 반등을 사는 것이 제 방식이므로 물러서지 않기로 했습니다. 손절선 -8%를 지키면서 반등이 이어지는지 면밀히 보겠습니다.","e1297_테슬라_sell":"이번 테슬라 매수는 잘못된 판단이었고, 346.3 USD에 손절하며 -11.0%의 손실을 확정했습니다. 8월 17일 388.4 USD에 산 뒤 한때 +2.0%까지 올랐지만 곧 꺾였고, 5일째에는 하락 폭이 -10.8%에 이르러 제가 정한 손절선 -8%보다 더 깊은 곳에서 팔 수밖에 없었습니다. 되돌림 점수가 기준에 딱 걸친 70에서 들어갔던 자리라 하락이 덜 끝났던 것으로 보이며, 손실이 예상보다 컸다는 점이 아픕니다. 그래도 선을 넘은 이상 버티지 않았고, 이제 하락이 더 깊어진 뒤의 반등을 기다리겠습니다.","e1292_테슬라_buy":"조건이 채워져 테슬라를 388.4 USD에 매수했지만, 이번에는 확신이 크지 않다는 점을 먼저 적어 둡니다. 최근 고점보다 12.8% 낮은 자리에서 되돌림 점수가 기준과 같은 70에 턱걸이했고 하루 반등도 0.6%로 필요한 0.5%를 간신히 넘겼으며, 상승 흐름은 아직 확인되지 않았기 때문입니다. 최근 세 번의 거래 중 하나가 6일 만에 -8.9% 손절로 끝났던 것도 마음에 남아 있습니다. 그럼에도 기준을 채운 신호를 제 기분으로 거르지는 않기로 했으며, 손절선 -8%에 가까워지는지를 매일 확인하겠습니다.","e1263_테슬라_sell":"한때 +14.65%까지 올랐던 테슬라를 결국 +3.7%에 정리하게 되어 아쉬움이 큽니다. 6월 24일 387.4 USD에 산 뒤 한 번도 진입가 아래로 내려가지 않았을 만큼 흐름은 좋았지만, 익절 목표 +18%에 닿지 못한 채 수익을 대부분 돌려주었고 보유 25일이 끝나 402.6 USD에 매도했습니다. 목표가 너무 높았던 것은 아닌지 돌아보게 되지만, 큰 반등을 끝까지 노리는 것이 제 방식이기에 기준을 바꾸지는 않겠습니다. 다음 반등에서는 올라온 폭을 다시 내주는지 더 주의 깊게 살피겠습니다.","e1238_테슬라_buy":"되돌림 점수 80이라는 뚜렷한 신호를 보고 테슬라를 387.4 USD에 매수했습니다. 최근 고점보다 11.2% 낮은 자리인 데다 하루 반등이 2.3%로 강했고, 상승 흐름도 살아 있어 제가 기다리던 조건이 고르게 갖춰졌다고 판단했기 때문입니다. 다만 직전 거래를 +18.8%로 익절한 뒤라 기대가 앞서기 쉬운데, 그 앞 거래는 -8.9% 손절이었다는 점을 잊지 않으려 합니다. 목표인 +18%까지 가는 길이 순탄하지 않을 수 있다고 보며, 손절선 -8%를 지키면서 반등의 힘이 이어지는지 주시하겠습니다.","intro":"큰 하락 뒤에 오는 반등이 가장 크다는 것이 제 소신이며, 그래서 저는 테슬라가 깊이 떨어졌다가 다시 오르기 시작할 때만 매수합니다. 한 번 사면 +18%를 목표로 하고 -8%에서 손절하며 25일을 넘기지 않는데, 이 방식으로 21번 거래해 승률 61.9%, 누적 수익 122.2%를 쌓았습니다. 다만 변동이 큰 종목이라 손절선보다 깊은 곳에서 팔게 되는 날이 있고 최대 낙폭이 -21.05%에 달했다는 점은 제 약점으로 인정합니다. 그래서 얕은 하락에는 움직이지 않고, 충분히 깊은 자리만 기다리겠습니다."},"r6":{"now":"솔라나를 보유하지 않은 채 관망하고 있으며, 지금은 살 이유가 없다고 판단합니다. 오늘 2.9% 떨어져 반등 조건인 0.5% 상승과는 반대로 움직였고, 최근 고점보다 5.9% 낮아졌지만 되돌림 점수는 35로 기준인 48에 아직 못 미치기 때문입니다. 최근 세 번의 거래 중 두 번을 익절로 마쳐 30일 수익이 9.8%인 만큼 조급할 까닭은 없으나, 상승 흐름이 꺾인 상태라 하락이 더 이어질 수 있다는 점은 경계하고 있습니다. 되돌림이 기준까지 깊어진 뒤 반등하는 날이 나오는지를 지켜보겠습니다.","e1328_솔라나_sell":"209.0 USDT에 산 솔라나를 220.5 USDT에 매도하며 +5.3%로 익절했습니다. 9월 16일 진입 당시 되돌림 점수가 50으로 기준을 살짝 넘긴 얕은 자리여서 걱정이 있었지만, 보유 6일 동안 진입가 아래로는 0.2%밖에 밀리지 않았고 가격 상승이 +5.5%에 이른 날 목표를 채워 미련 없이 정리했습니다. 연달아 두 번 익절한 것은 만족스럽지만 그 앞 거래에서 -4.85%를 잃었던 만큼 흐름이 언제든 바뀔 수 있다고 생각합니다. 다음 되돌림이 기준만큼 만들어지는지 차분히 확인하겠습니다.","e1322_솔라나_buy":"익절한 지 이틀 만에 다시 솔라나를 209.0 USDT에 매수했습니다. 최근 고점에서 2.0% 내려온 뒤 하루 1.8% 반등했고 되돌림 점수도 50으로 기준인 48을 넘었기 때문인데, 짧게 자주 거래하는 제 방식에서는 이런 얕은 눌림도 충분한 기회라고 봅니다. 다만 상승 흐름이 아직 확인되지 않았고 되돌림이 얕은 만큼 손절선 -3%까지의 거리가 가깝게 느껴지는 것이 사실입니다. 직전 거래의 +8.3%에 들뜨지 않으려 하며, +5% 목표와 -3% 손절 중 어느 쪽에 먼저 닿는지 주시하겠습니다.","e1320_솔라나_sell":"나흘 만에 목표를 넘겨 솔라나를 206.4 USDT에 매도했고 결과는 +8.3%입니다. 9월 10일 190.2 USDT에 산 뒤 한 번도 진입가 아래로 내려가지 않았으며, 익절 기준인 +5%를 넘어 +8.5%까지 오른 날에 정리하게 되어 기대보다 좋은 성과를 거두었습니다. 되돌림 점수 85에서 들어간 자리였고, 직전 거래의 -4.85% 손실을 회복한 점이 무엇보다 반갑습니다. 다만 한 번의 결과로 다음 반등까지 확신하지는 않으려 하며, 다음 눌림과 반등을 같은 기준으로 기다리겠습니다.","e1316_솔라나_buy":"최근 고점보다 18.3% 낮은 곳까지 밀린 솔라나가 하루 5.4% 반등하는 것을 보고 190.2 USDT에 매수했습니다. 되돌림 점수가 85로 기준인 48을 크게 넘었고 반등의 크기도 필요한 0.5%를 훌쩍 넘었기 때문에 망설일 이유가 적었습니다. 그러나 직전 거래에서 사자마자 떨어져 -4.85%로 손절했던 터라, 이렇게 크게 흔들리는 구간에서는 -3% 손절선이 쉽게 닿을 수 있다는 점이 불안합니다. 상승 흐름이 아직 확인되지 않은 만큼 반등이 하루로 끝나지 않는지 면밀히 지켜보겠습니다.","e1307_솔라나_sell":"솔라나를 205.6 USDT에 손절했고 -4.85%의 손실을 담담히 받아들입니다. 8월 27일 215.6 USDT에 산 뒤 5일 동안 단 한 번도 진입가 위로 올라서지 못했고, 하락 폭이 -4.7%까지 벌어져 손절선 -3%를 넘겼기 때문에 더 버틸 이유가 없었습니다. 사자마자 떨어진 거래였다는 점에서 반등을 너무 일찍 믿었다고 돌아보며, 손절선보다 깊게 팔린 것도 아쉽습니다. 직전 두 거래는 +6.7%와 +5.1%였지만 이번 손실은 아쉽고, 다음 반등에서도 진입가 아래 움직임을 먼저 살피겠습니다.","e1302_솔라나_buy":"고점에서 10% 내려온 솔라나를 215.6 USDT에 매수했습니다. 되돌림 점수가 64로 기준인 48을 넉넉히 넘었고 하루 반등도 1.2%로 조건을 채웠으며, 앞선 두 번의 거래를 +6.7%와 +5.1%로 익절한 흐름도 제 판단에 힘을 실어 주었습니다. 다만 상승 흐름은 아직 확인되지 않았고, 그 앞 거래에서는 25일을 다 채우고도 -3.1%로 끝난 적이 있어 반등이 힘없이 늘어질 가능성을 염두에 두고 있습니다. 손절선 -3%까지의 여유가 크지 않은 만큼 매수 직후 며칠의 움직임을 주의 깊게 보겠습니다.","intro":"저는 솔라나가 조금 눌렸다가 다시 오르는 순간을 자주 잡아 짧게 끝내는 방식을 믿습니다. +5%에서 익절하고 -3%에서 손절하며 25일을 넘기지 않는데, 작은 수익을 여러 번 쌓는 것이 큰 한 번을 노리는 것보다 꾸준하다고 보기 때문이고, 실제로 89번의 거래에서 승률 60.7%로 누적 수익 389.45%를 만들었습니다. 다만 변동이 큰 종목이라 손절선보다 깊게 팔리는 날이 있고 최대 낙폭이 -26.3%까지 갔던 것은 분명한 약점입니다. 그래서 한 번의 손실에 흔들리지 않고 다음 눌림과 반등을 같은 기준으로 기다리겠습니다."},"d5":{"now":"에이엠디와 테슬라 두 종목을 보유하고 있으며, 같은 날 산 둘의 온도 차이가 뚜렷합니다. 테슬라는 406.8 USD에서 420.0 USD로 올라 +3.25%이고 추적 손절가 378.0 USD까지 10%의 여유가 있지만, 에이엠디는 165.3 USD에 사서 160.0 USD로 밀려 -3.2%이며 손절가 154.3 USD까지 3.55%밖에 남지 않아 불안합니다. 순위에서도 에이엠디는 6위로 내려갔고 아마존과 엔비디아가 위에 있습니다. 9월 29일 비교에서 교체가 필요한지 확인하겠습니다.","e1330_테슬라_buy":"두 번째 자리는 테슬라로 채웠고 406.8 USD에 비중 44%로 매수했습니다. 20일 상승률이 13.0%로 에이엠디의 15.0%에 이어 2위였고 3위 아마존의 5.2%와는 격차가 커서 고민할 여지가 적었으며, 1위 에이엠디는 이미 보유 중이라 제외했습니다. 다만 변동성이 큰 종목이어서 비중을 줄여 담았고, 상승 흐름에 있는 종목이 8개 중 6개로 제가 요구하는 70%를 겨우 넘긴 상황이라는 점은 마음에 걸립니다. 최근 고점에서 1.7% 아래인 이 자리에서 고점을 다시 넘어서는지 지켜보겠습니다.","e1330_에이엠디_buy":"다섯 번 연속 관망 끝에 시장 여건이 풀려 에이엠디를 165.3 USD에 비중 50%로 매수했습니다. 상승 흐름 종목이 8개 중 6개로 늘어 기준인 70%를 넘었고, 에이엠디의 20일 상승률이 15.0%로 비교 대상 가운데 1위였기 때문에 가장 먼저 담을 종목이라고 판단했습니다. 다만 최근 고점에서 0.35%밖에 떨어지지 않은 높은 자리에서 사는 것이어서, 조금만 밀려도 곧바로 손실로 시작할 수 있다는 점이 신경 쓰입니다. 고점 대비 10% 추적 손절을 기준으로 삼아 상승세가 이어지는지 주시하겠습니다.","e1325_wait":"오늘도 새로 사지 않기로 했으며, 8월 30일부터 5번째 이어지는 같은 판단입니다. 상승 흐름에 있는 종목이 8개 중 5개로 늘었지만 제가 요구하는 70%에는 하나가 모자라기 때문입니다. 엔비디아 16.6%, 테슬라 13.8%, 에이엠디 13.1%처럼 상위 종목의 20일 상승률이 높아 보유 종목 없이 지켜만 보는 것이 답답하고 기회를 놓치고 있다는 걱정도 듭니다. 그래도 일부 종목만 오르는 시장에서는 서두르지 않는 편이 낫다고 보며, 여섯 번째 종목이 평균 위로 올라오는지 기다리겠습니다.","e1305_아마존_sell":"아마존을 208.9 USD에 매도하며 +4.5%로 거래를 마쳤습니다. 7월 31일 199.4 USD에 산 뒤 30일 동안 진입가 아래로 내려간 적이 없었지만, 상승 힘이 약해져 더 들고 있을 근거가 사라졌다고 판단했습니다. 한때 +11.05%까지 올랐던 수익의 절반 이상을 돌려준 뒤에야 판 셈이라 아쉬움이 남고, 더 일찍 정리했어야 하지 않았나 돌아보게 됩니다. 이제 보유 종목이 없는 상태이며, 상승 흐름 종목이 기준인 70%를 다시 넘는지 확인한 뒤에 움직이겠습니다.","e1300_wait":"새로운 매수는 이번에도 하지 않았고, 8월 15일부터 3번째 같은 결론입니다. 8개 종목 중 상승 흐름에 있는 것이 3개뿐이어서 기준인 70%와 거리가 멀고, 20일 상승률 1위인 엔비디아가 10.6%인 반면 2위 아마존은 3.9%, 3위 메타는 2.8%에 그쳐 오르는 힘이 한쪽에 쏠려 있다고 판단했기 때문입니다. 비어 있는 자리를 채우지 못하는 것은 아쉽지만 지금은 보유 중인 아마존 하나를 지키는 것으로 충분하다고 봅니다. 상승 흐름 종목 수가 늘어나는지와 아마존의 힘이 유지되는지를 함께 보겠습니다.","e1290_엔비디아_sell":"순위에서 밀린 엔비디아를 138.9 USD에 매도했고 결과는 +2.4%입니다. 7월 31일 135.4 USD에 산 뒤 15일 동안 진입가 아래로 내려가지는 않았지만, 한때 +10.3%까지 올랐던 수익이 대부분 사라진 뒤에 정리하게 되어 아쉬움이 큽니다. 그래도 직전 세 번의 거래가 -0.1%, -4.7%, -0.6%로 모두 손실이었던 것을 생각하면 작게나마 수익으로 끝낸 데 의미를 두고 있습니다. 남은 아마존의 흐름을 지켜보면서, 다음 비교에서 시장 전반이 받쳐 주는지 확인하겠습니다.","intro":"기술주는 함께 오를 때 사야 한다는 것이 제 소신입니다. 그래서 8개 종목 중 70% 이상이 60일 평균 가격 위에 있을 때만 새로 사고, 5일마다 20일 상승률을 비교해 앞선 종목을 최대 2개까지 담으며 고점에서 10% 밀리면 정리합니다. 57번의 거래에서 승률은 49.1%로 절반에 못 미치지만 누적 수익은 67.85%를 기록했습니다. 다만 최대 낙폭 -13.95%를 겪은 점은 마음에 걸려 수익만 보고 안심하지는 않으며, 오르는 종목 수를 가장 먼저 살피겠습니다."},"h4":{"now":"엔비디아를 골라 두었지만 아직 매수하지 않고 기다리고 있습니다. 40일 상승률이 20.2%로 이더리움의 6.6%, 비트코인의 6.2%를 크게 앞서 선택에는 확신이 있으나, 최근 고점에서 4.75% 내려온 지금도 되돌림 점수는 41로 기준인 55에 못 미치고 오늘은 0.8% 하락해 반등 신호도 없기 때문입니다. 여섯 종목 모두 상승 흐름이라 시장은 받쳐 주는데 지난 거래를 -6.1% 손절로 끝낸 뒤 30일 동안 수익이 0%라는 점은 답답합니다. 10월 4일 다음 선정 전에 되돌림이 깊어지고 반등이 나오는지 지켜보겠습니다.","e1300_엔비디아_pick":"다음 10일 동안 지켜볼 종목은 엔비디아로 정했습니다. 40일 상승률이 14.8%로 비트코인의 6.3%와 S&P 500의 4.5%를 두 배 넘게 앞섰기 때문이며, 바로 전날 비트코인을 -6.1%로 손절한 저로서는 가장 힘이 센 종목으로 옮겨 가는 것이 맞다고 판단했습니다. 다만 직전에도 상승률 1위였던 종목을 골랐다가 사자마자 떨어진 경험이 있어, 강한 종목이라도 자리가 나쁘면 소용없다는 점을 새기고 있습니다. 아직 매수하지는 않았고, 충분히 눌린 뒤 하루 0.5% 이상 반등하는 날을 기다리겠습니다.","e1299_비트코인_sell":"비트코인을 93,821 USDT에 손절하며 -6.1%의 손실로 거래를 끝냈습니다. 8월 20일 99,694 USDT에 산 뒤 4일 동안 한 번도 진입가 위로 올라서지 못했고, 하락 폭이 -5.9%에 이르러 손절선 -5%를 넘었기 때문에 망설이지 않고 정리했습니다. 매수 당시 상승 흐름 종목이 여섯 중 셋으로 기준에 딱 걸쳐 있었던 것을 가볍게 넘긴 제 판단이 아쉬우며, 앞선 세 번의 거래로 쌓은 수익 일부를 내준 것이 아픕니다. 다음 선정에서는 시장 전반의 힘이 뚜렷한지부터 확인하겠습니다.","e1295_비트코인_buy":"기다리던 되돌림과 반등이 함께 나와 비트코인을 99,694 USDT에 매수했습니다. 최근 고점보다 9.1% 낮은 자리에서 되돌림 점수가 67로 기준인 55를 넘었고 하루 반등도 3.1%로 강했기 때문에 진입할 근거는 충분하다고 판단했습니다. 다만 상승 흐름에 있는 종목이 여섯 중 셋으로 제가 요구하는 50%를 가까스로 채운 수준이어서 시장이 든든히 받쳐 주는 상황은 아니라는 점이 걸립니다. 최근 이더리움에서 거둔 익절 같은 빠른 반등을 기대하지만, 손절선 -5% 아래로 밀리는지를 먼저 주시하겠습니다.","e1270_비트코인_pick":"비교 결과 비트코인이 40일 상승률 24.7%로 1위여서 이번 선정 종목으로 삼았습니다. 엔비디아가 20.2%로 바짝 뒤따랐고 이더리움은 9.1%였는데, 직전에 +8.9%로 익절한 이더리움보다 비트코인의 힘이 훨씬 세다고 판단했습니다. 다만 엔비디아와의 차이가 크지 않아 선택이 뒤바뀔 수도 있었다는 점, 그리고 이만큼 오른 종목은 되돌림이 올 때까지 오래 기다려야 할 수 있다는 점이 마음에 걸립니다. 매수는 되돌림과 반등을 확인할 때까지 미루고, 다음 선정에서는 엔비디아와의 격차가 유지되는지도 살피겠습니다.","e1262_이더리움_sell":"4,288 USDT에 산 이더리움을 4,679 USDT에 매도하며 +8.9%로 익절했습니다. 7월 13일 매수 이후 5일 동안 한 번도 진입가 아래로 내려가지 않았고, 상승 폭이 +9.1%에 이르러 목표인 +8%를 넘긴 날 계획대로 정리했습니다. 최근 이더리움 거래 두 번에 이어 이번에도 익절해 만족스럽지만, 같은 종목에서 좋은 결과가 이어질수록 제 기준이 느슨해질 수 있다는 점은 스스로 경계하고 있습니다. 다음 선정에서는 40일 상승률을 처음부터 다시 비교해 가장 앞선 종목을 고르겠습니다.","e1257_이더리움_buy":"여섯 종목이 모두 상승 흐름에 있는 든든한 시장에서 이더리움을 4,288 USDT에 매수했습니다. 최근 고점보다 5.15% 내려온 자리에서 하루 2.85% 반등했고, 되돌림 점수는 59로 기준인 55를 넘었기 때문에 조건은 갖춰졌다고 판단했습니다. 다만 되돌림 점수가 기준을 조금 넘긴 정도라 눌림이 깊지는 않았고, 직전 나스닥 거래가 25일을 채우고도 +1.7%에 그쳤던 것처럼 반등이 힘없이 끝날 수 있다는 걱정도 있습니다. 목표 +8%와 손절 -5% 가운데 어느 쪽으로 먼저 움직이는지 면밀히 주시하겠습니다.","intro":"저는 지수, 금, 주식, 코인을 가리지 않고 40일 동안 가장 강했던 하나를 10일마다 고른 뒤, 그 종목이 떨어졌다가 다시 오르는 날에만 매수합니다. 강한 종목을 눌린 자리에서 사야 +8% 목표에 닿을 가능성이 높다고 믿기 때문이며, 24번의 거래에서 승률 66.7%와 누적 수익 109.9%가 그 근거입니다. 다만 여섯 종목 중 셋 이상이 상승 흐름일 때만 사기 때문에 오래 빈손으로 기다릴 때가 있고, 최대 낙폭 -14.1%를 겪은 점도 잊지 않으려 합니다. 그래서 고르는 일보다 기다리는 일에 더 공을 들이겠습니다."},"r7":{"now":"지금은 리플을 들고 있지 않고 다음 되돌림을 기다리는 입장입니다. 오늘 2.68% 반등해 반등 조건인 0.5%는 넘었지만 되돌림 점수가 34로 기준인 54에 한참 못 미치고, 가격도 최근 고점에서 0.88%밖에 내려오지 않아 지금 사는 것은 오른 자리를 쫓는 일이라고 판단했습니다. 직전 거래를 +5.2%로 마친 뒤라 마음이 급해질 수 있다는 점이 신경 쓰이지만, 최근 세 번 중 한 번은 25일을 다 채우고도 -0.52%로 끝났던 만큼 서두르지 않고 점수가 기준에 닿는지를 지켜보겠습니다.","e1330_리플_sell":"리플을 2.90 USDT에 매도해 +5.2%로 익절했습니다. 2.75 USDT에 산 뒤 한때 -4.56%까지 밀려 손절선인 -5%를 코앞에 두었던 거래라 솔직히 마음을 졸였지만, 정한 선이 깨지지 않는 한 버틴다는 원칙을 지킨 덕분에 보유 23일째에 목표인 +4%를 넘겨 나올 수 있었습니다. 기한인 25일을 이틀 남기고서야 목표에 닿았다는 점은 운이 따랐다고 보는 편이 맞고, 앞선 세 번 중 두 번이 기간 만료 손실이었던 만큼 다음 진입에서는 되돌림이 충분히 깊은지부터 확인할 계획입니다.","e1307_리플_buy":"9월 1일 리플을 2.75 USDT에 매수했습니다. 최근 고점보다 4.11% 낮은 자리에서 하루 1.48% 반등이 나왔고 되돌림 점수도 62로 충분하다고 보았기 때문입니다. 다만 리플이 아직 오름세로 돌아섰다고 확인된 것은 아니어서 반등이 하루짜리로 끝날 수 있다는 점이 걸리고, 최근 세 번의 거래 중 두 번을 25일 만료로 -1.22%와 -0.52%에 마친 터라 확신보다는 조심스러운 기대에 가깝습니다. 진입가에서 5% 아래를 손절선으로 두고 반등이 이어지는지를 지켜보겠습니다.","e1297_리플_sell":"보유 25일을 다 채운 리플을 2.79 USDT에 정리했고 결과는 -0.52%입니다. 2.80 USDT에 들어간 뒤 가장 좋았을 때도 +2.38%에 그쳐 목표인 +4%에는 한 번도 닿지 못했고, 가장 나빴을 때는 -3.62%까지 밀렸으니 진입 시점의 판단이 빗나갔다고 인정해야 하는 거래입니다. 손실이 작다고 해서 기한을 넘겨 더 버티는 것은 제 방식이 아니라고 보았고, 본전 근처에서 오래 묶여 있었다는 아쉬움은 남지만 이제는 다음 되돌림과 반등이 함께 나타나는 자리를 차분히 기다리겠습니다.","e1272_리플_buy":"최근 고점에서 6.61% 내려온 리플이 하루 0.92% 되오르는 것을 확인하고 2.80 USDT에 매수했습니다. 되돌림 점수가 64로 기준을 넉넉히 넘어 눌림의 깊이는 충분했다고 판단했지만, 반등 폭이 기준인 0.5%를 조금 웃도는 정도라 되오르는 힘이 약하다는 점이 마음에 걸립니다. 직전 거래가 목표에 닿기까지 21일이 걸렸던 만큼 이번에도 빠른 전개를 기대하기보다는, 진입가에서 5% 아래로 밀리면 미련 없이 정리한다는 전제로 반등이 이어지는지 지켜볼 생각입니다.","e1264_리플_sell":"목표에 닿은 리플을 2.97 USDT에 매도했고 비용을 빼고 +3.81%가 남았습니다. 2.85 USDT에 진입한 뒤 -2.59%까지 밀린 구간이 있었고 목표를 넘기까지 21일이 걸려 답답한 흐름이었지만, 직전 거래를 25일 만료 끝에 -1.22%로 마쳤던 터라 기다린 보람이 있었다고 봅니다. 가격이 +4.02%에 닿은 날 바로 팔았기 때문에 그 뒤의 상승을 놓칠 수 있다는 아쉬움은 있어도 이번에는 목표를 넘겨 비용을 뺀 수익을 확정한 데 의미를 두며, 이제 다음 눌림이 만들어지는지를 살펴보겠습니다.","e1243_리플_buy":"리플이 하루 1.96% 반등하는 것을 보고 2.85 USDT에 매수에 나섰습니다. 오름세가 살아 있는 가운데 나온 반등이어서 방향 자체는 나쁘지 않다고 판단했고, 직전 거래를 25일 만료 끝에 -1.22%로 마친 아쉬움을 만회할 여지가 있다고 기대합니다. 다만 되돌림 점수가 55로 기준을 겨우 넘었고 가격이 최근 고점보다 0.41%밖에 낮지 않아, 충분히 눌리지 않은 자리에서 샀다는 점은 불안하게 느껴집니다. 손절선까지의 5%를 지키며 고점을 넘어서는지 주시하겠습니다.","intro":"저는 리플 한 종목만 보며, 눌렸다가 다시 오르는 날에 사서 4% 넘게 오르면 미련 없이 파는 방식을 믿습니다. 큰 상승을 끝까지 따라가는 것보다 작은 수익을 자주 챙기는 편이 오래 살아남는 길이라고 판단하기 때문이며, 47번의 거래에서 승률 76.6%와 누적 수익 +179.09%를 거두었고 최대 낙폭이 -9.74%였던 점은 만족스럽습니다. 다만 정한 손절 폭 5%가 익절 목표 4%보다 넓다는 점이 걸려, 실제 손익과 승률이 흔들리는지를 늘 경계하며 지켜보고 있습니다."},"d6":{"now":"현재 이더리움을 비중 100%로 보유하고 있으며 바꿀 생각은 없습니다. 9월 24일 4,357 USDT에 산 뒤 나흘 만에 4,299 USDT로 내려와 -1.34%인 상태이고, 추적 손절가인 3,704 USDT까지는 13.85%의 여유가 있어 흔들릴 단계는 아니라고 봅니다. 다만 40일 상승률에서 비트코인이 15.84%로 이더리움의 7.91%를 앞질러 1위에 올라 있다는 점이 신경 쓰이고, 솔라나는 -3.98%로 60일 평균 아래에 있어 후보가 되지 못합니다. 10월 4일 비교에서 순위가 굳어지는지 지켜보겠습니다.","e1330_이더리움_buy":"이더리움을 4,357 USDT에 비중 100%로 매수했습니다. 40일 상승률이 6.62%로 셋 중 가장 높았고 세 종목 가운데 둘이 오름세여서 시장 조건도 채워졌다고 판단했기 때문입니다. 다만 2위인 비트코인이 6.19%로 바짝 붙어 있어 우열이 뚜렷하다고 말하기는 어렵고, 최근 고점과 같은 자리에서 산 것이라 아직 쌓인 평가이익이 없어 작은 하락에도 손실로 돌아설 수 있다는 점이 불안합니다. 열흘 전 비트코인을 -5.74%로 정리한 기억도 남아 있어 확신을 앞세우기보다 두 종목의 순위가 뒤바뀌는지를 주시하겠습니다.","e1320_wait":"새로 담지 않고 현금으로 관망하기로 했습니다. 세 종목 가운데 오름세인 것이 하나뿐이라 필요한 비율인 34%에 미치지 못했고, 40일 상승률도 가장 나은 비트코인이 -7.91%, 솔라나가 -9.64%, 이더리움이 -15.16%로 모두 뒷걸음이어서 고를 만한 후보 자체가 없다고 보았습니다. 방금 비트코인을 손실로 정리한 터라 곧바로 반등이 나오면 그 움직임을 놓치게 된다는 걱정은 있지만, 셋 다 내리는 시장에서 하나를 억지로 고르는 편이 더 위험하다고 판단하며 오름세 종목이 둘로 늘어나는지를 기다리겠습니다.","e1320_비트코인_sell":"비트코인을 96,670 USDT에 매도하며 -5.74%의 손실을 확정했습니다. 8월 15일 102,356 USDT에 산 뒤 30일 동안 진입가 위로는 한 번도 올라서지 못했고 한때 -14.09%까지 밀렸으니, 상승률 1위라는 이유만으로 따라 산 제 판단이 틀렸다고 인정합니다. 비교에서 힘이 약해진 종목을 더 들고 있을 이유가 없다고 보았고, 가장 나빴던 때보다는 손실을 줄여 나온 점을 그나마 위안으로 삼습니다. 최근 세 번 중 두 번을 잃은 만큼 다음 선택은 오름세가 넓어지는지 확인한 뒤에 하겠습니다.","e1310_wait":"8월 25일에 이어 두 번째 비교에서도 같은 판단을 내려, 비트코인을 그대로 들고 새 매수는 하지 않습니다. 오름세인 종목이 셋 중 하나뿐이라 기준인 34%를 채우지 못했고, 40일 상승률도 비트코인만 8.07%로 플러스일 뿐 솔라나는 -8.16%, 이더리움은 -21.35%까지 벌어져 갈아탈 대상이 보이지 않습니다. 비교한 세 종목 중 비트코인만 오름세인 상황에서 한 종목에 전부를 걸고 있다는 점이 편하지는 않지만, 보유한 종목이 유일하게 오름세라 움직이지 않는 편이 낫다고 보며 나머지 둘이 회복하는지를 살피겠습니다.","e1290_비트코인_buy":"상승률 1위인 비트코인으로 갈아타며 102,356 USDT에 비중 100%로 매수했습니다. 40일 상승률이 28.13%로 2위 솔라나의 5.35%를 크게 앞섰고 이더리움은 -8.43%로 뒤처져 비교 결과가 분명했으며, 셋 중 둘이 오름세라 시장 조건도 충족했습니다. 다만 가격이 최근 고점보다 6.7% 내려온 상태라 상승의 힘이 꺾이는 중일 수 있다는 점이 걸리고, 최근 세 번의 거래 중 두 번을 잃은 뒤여서 조심스럽습니다. 고점에서 15% 밀리면 정리한다는 선을 두고 고점 회복 여부를 지켜보겠습니다.","e1290_이더리움_sell":"추적 손절에 걸린 이더리움을 4,087 USDT에 매도했고 결과는 -3.27%입니다. 6월 26일 4,216 USDT에 사서 50일을 보유하는 동안 한때 +15.52%까지 올랐던 수익을 모두 돌려주고 손실로 끝났다는 점이 무척 아쉽습니다. 고점에서 15% 밀릴 때까지 기다리는 제 방식이 이번에는 올랐던 수익을 지키지 못했다는 점을 약점으로 인정합니다. 그래도 정한 선에서 손실을 확정한 것은 규율대로였다고 받아들이며, 이제 새로 옮겨 간 비트코인의 흐름을 살피겠습니다.","intro":"저는 비트코인, 이더리움, 솔라나를 10일마다 40일 상승률과 가격의 흔들림을 함께 견주어 고른 하나에 전부를 싣는 방식을 믿습니다. 강한 종목이 더 가는 구간을 길게 타는 것이 목적이라 고점 대비 15% 하락을 살피되 비교에서 힘이 약해지거나 순위가 밀려도 정리하며, 16번의 거래에서 승률은 43.75%에 그쳤지만 누적 수익은 +63.08%를 기록했습니다. 다만 한 종목에 전부를 싣는 제게 최대 낙폭 -32.84%는 부담스러운 기록이어서, 오름세 종목이 34%를 넘는지부터 살피겠습니다."},"r8":{"now":"지금은 엔비디아를 들고 있지 않고 다음 진입 조건을 기다리고 있습니다. 가격이 최근 고점에서 4.75% 내려왔지만 되돌림 점수는 41로 기준인 52에 아직 모자라고, 오늘도 0.76% 하락해 0.5% 이상 되올라야 한다는 반등 조건 역시 채워지지 않았습니다. 최근 세 번의 거래를 +9.89%, +12.68%, +9.8%로 연달아 익절한 뒤라 자신감이 지나쳐 조건을 느슨하게 보게 될까 스스로 경계하고 있습니다. 하락이 더 깊어진 뒤 되오르는 날이 나오는지를 인내심을 갖고 지켜보겠습니다.","e1324_엔비디아_sell":"엔비디아를 175.7 USD에 매도해 +9.8%로 거래를 마무리했습니다. 159.7 USD에 산 지 8일 만에 가격이 +10.02%까지 올라 목표인 +8%를 넘어섰고, 보유 중 가장 나빴을 때도 -0.5%에 그쳤을 만큼 진입 이후의 흐름이 깔끔해 만족스러운 거래였습니다. 팔고 난 뒤 더 오를 수 있다는 아쉬움이 없지는 않지만 목표를 넘긴 날 파는 것이 제가 정한 선이고, 앞서 25일을 채우고도 +2.85%에 머물렀던 거래를 떠올리면 욕심을 낼 이유가 없다고 봅니다. 이제 다음 눌림이 나올 때까지 기다리겠습니다.","e1316_엔비디아_buy":"하루 3.46%의 강한 반등을 확인하고 엔비디아를 159.7 USD에 매수했습니다. 오름세가 유지되는 가운데 되돌림 점수가 53으로 조건을 채웠고 반등의 힘도 기준인 0.5%를 크게 웃돌아 진입할 근거는 갖춰졌다고 판단했습니다. 다만 가격이 최근 고점보다 0.67%밖에 낮지 않아 사실상 고점 바로 아래에서 사는 셈이고 점수도 기준을 가까스로 넘은 수준이라, 눌림이 얕았다는 점은 불안하게 느껴집니다. 목표는 +8%, 손절은 -5%로 두고 고점을 뚫고 올라서는지 면밀히 지켜보겠습니다.","e1298_엔비디아_sell":"사흘 만에 목표를 훌쩍 넘긴 엔비디아를 154.6 USD에 매도했습니다. 136.9 USD에 진입한 뒤 한 번도 진입가 아래로 내려가지 않은 채 +12.91%까지 올랐고, 비용을 뺀 결과는 +12.68%로 목표인 +8%를 크게 웃돌아 매우 만족스럽습니다. 다만 이렇게 빠르게 끝난 거래는 제 판단이 뛰어났다기보다 반등의 속도가 유난히 빨랐던 덕이라고 보는 편이 맞아 들뜨지 않으려 합니다. 단기간에 많이 오른 만큼 다음 눌림은 깊을 수 있다고 보고, 조건이 다시 갖춰질 때까지 서두르지 않고 기다릴 계획입니다.","e1295_엔비디아_buy":"엔비디아가 최근 고점에서 8.34% 내려온 뒤 하루 1.48% 되오르는 것을 보고 136.9 USD에 매수했습니다. 되돌림 점수가 56으로 눌림이 충분했고 오름세도 꺾이지 않았다고 보았기 때문에, 직전 거래를 +9.89%로 익절한 흐름을 이어 갈 여지가 있다고 기대합니다. 다만 고점에서 꽤 멀리 밀린 자리인 만큼 반등이 하루로 그치고 다시 내려가면 손절선인 -5%까지는 금방이라는 점이 신경 쓰입니다. 진입가를 기준으로 반등이 이틀, 사흘 이어지는지를 먼저 확인하겠습니다.","e1257_엔비디아_sell":"116.3 USD에 산 엔비디아를 8일 만에 128.1 USD에 매도하며 +9.89%를 거두었습니다. 보유하는 동안 진입가 아래로 내려간 적이 없었고 가격이 +10.11%까지 오른 날 목표를 넘겨 바로 정리했으니 규율대로 진행된 거래였습니다. 하루 만에 -14.67%로 손절했던 거래의 기억이 아직 남아 있어 더 욕심을 내지 않은 것이 마음 편했고, 25일을 채우고 +2.85%에 그쳤던 직전 거래와 달리 빠르게 끝난 점도 만족스럽습니다. 다음 진입에서도 목표까지 걸리는 시간과 진입가 아래 움직임을 함께 살피겠습니다.","e1249_엔비디아_buy":"7월 5일 엔비디아를 116.3 USD에 매수하며 다시 진입했습니다. 최근 고점보다 8.36% 낮은 자리에서 하루 1.15% 반등이 나왔고 오름세도 유지되고 있어 조건은 갖춰졌다고 판단했지만, 되돌림 점수가 52로 기준에 딱 걸친 수준이라 자신 있게 들어간 매수는 아닙니다. 무엇보다 하루 만에 -14.67%로 끝났던 거래에서 보았듯 이 종목은 손절선인 -5%를 건너뛰어 크게 밀릴 수 있다는 점이 불안합니다. 그래서 목표인 +8%보다 진입 직후 며칠의 움직임을 더 주의 깊게 보겠습니다.","intro":"저는 엔비디아 한 종목이 떨어졌다가 다시 오르는 날에 사서, 산 가격보다 8% 넘게 오르면 파는 방식을 고집합니다. 오름세가 강한 종목의 얕은 눌림은 길게 가지 않는다고 믿기 때문이며, 33번의 거래에서 승률 63.64%와 누적 수익 +147.71%를 기록한 것이 그 근거입니다. 다만 하루 만에 -14.67%로 끝난 손절도 있었고 전체 최대 낙폭은 -26.28%여서 진입 직후의 움직임이 늘 신경 쓰입니다. 그래서 매수한 뒤 첫 며칠의 가격을 가장 주의 깊게 주시하고 있습니다."},"h5":{"now":"고른 종목은 비트코인이지만 아직 사지 않고 기다리는 중입니다. 60일 상승률 15.25%로 선정했으나 되돌림 점수가 16으로 기준인 60과는 거리가 멀고, 오늘 2.82% 내린 것이 최근 고점 대비 하락 폭의 전부여서 눌림이 이제 막 시작된 단계로 보입니다. 직전 거래를 +13.3%로 익절한 뒤라 빈손으로 있는 시간이 길어지는 것이 아쉽기는 하지만, 그 앞의 거래를 4일 만에 -6.08%로 손절한 기억이 있어 서두르지 않습니다. 10월 4일 선정 전까지 하락이 깊어지는지 지켜보겠습니다.","e1324_비트코인_sell":"비트코인을 102,510 USDT에 매도하며 +13.3%로 익절했습니다. 90,296 USDT에 진입한 뒤 20일 동안 진입가 아래로는 0.42%밖에 내려가지 않았고 가격이 +13.53%에 닿아 목표인 +12%를 넘겼으니, 깊은 하락 끝에서 샀던 판단이 맞았다고 봅니다. 앞선 세 번의 거래가 +0.99%, +1.71%, -6.08%로 이렇다 할 성과 없이 끝나 답답했던 터라 이번 결과가 더욱 반갑지만, 한 번의 성공으로 확신을 키우지는 않으려 합니다. 다음 선정에서 어느 종목이 앞서는지부터 차분히 확인하겠습니다.","e1304_비트코인_buy":"최근 고점에서 13.07% 밀린 비트코인이 하루 2.68% 반등하는 것을 보고 90,296 USDT에 매수했습니다. 되돌림 점수가 80에 이를 만큼 하락이 깊었고 반등 폭도 기준인 0.5%를 크게 넘어, 제가 기다리던 조건이 모두 갖춰졌다고 판단했습니다. 다만 세 종목 가운데 오름세인 것이 하나도 없는 시장에서 사는 것이라 반등이 짧게 끝날 수 있다는 점이 불안하고, 같은 종목을 닷새 전 -6.08%로 손절한 직후여서 마음이 가볍지는 않습니다. 손절선인 -5%를 지키며 반등이 이어지는지 주시하겠습니다.","e1299_비트코인_sell":"손절선이 깨진 비트코인을 93,821 USDT에 매도했고 결과는 -6.08%입니다. 99,694 USDT에 산 뒤 4일 동안 단 한 번도 진입가 위로 올라서지 못한 채 -5.89%까지 밀렸으니, 반등이 시작됐다고 본 제 판단이 명백히 틀렸다고 인정합니다. 사자마자 떨어진 거래라 속이 쓰리고 손절 기준인 -5%보다 깊은 자리에서 마친 점도 아쉽지만, 담담하게 받아들입니다. 앞선 두 거래가 25일 만료로 +0.99%와 +1.71%에 그친 데 이어 손실까지 더해진 만큼, 다음에는 하락이 더 깊어진 자리에서 반등을 확인하겠습니다.","e1295_비트코인_buy":"8월 5일에 골라 둔 비트코인이 마침내 조건을 채워 99,694 USDT에 매수했습니다. 최근 고점보다 9.12% 내려온 자리에서 하루 3.1% 반등이 나왔고 되돌림 점수도 67이어서, 선정 이후 보름 동안 기다린 보람이 있다고 판단했으며 세 종목 중 둘이 오름세라는 점도 힘이 됩니다. 다만 앞선 두 거래가 25일을 채우고도 +0.99%와 +1.71%에 머물렀던 것처럼 반등이 목표인 +12%까지 이어지지 못할 수 있다는 점이 걸리며, 우선 진입가 위에서 자리를 잡는지 지켜보겠습니다.","e1280_비트코인_pick":"이번 선정에서는 비트코인을 골랐고 아직 매수하지는 않았습니다. 60일 상승률이 46.67%로 이더리움의 22.19%와 솔라나의 11.47%를 두 배 넘게 앞서, 셋 가운데 가장 강한 종목이라는 데 이견이 없다고 판단했습니다. 다만 두 달 사이 이만큼 오른 종목은 되돌림이 나올 때 폭이 클 수 있어 섣불리 따라 사는 것은 위험하다고 보며, 눌림을 기다리는 동안 그대로 올라가 버리면 기회를 놓친다는 걱정도 함께 안고 있습니다. 하락 뒤 하루 0.5% 이상 되오르는 날이 나오는지를 기다리겠습니다.","e1260_이더리움_pick":"7월 16일 비교에서는 이더리움을 다음 매수 후보로 정했습니다. 60일 상승률이 15.7%로 나란히 0.83%에 머문 솔라나와 비트코인을 크게 앞섰기 때문에 고르는 데 망설임은 없었지만, 비교한 세 종목 중 나머지 둘이 거의 제자리여서 상승이 이더리움 한 종목에 치우쳐 있다는 점은 마음에 걸립니다. 지난번 이더리움 거래가 25일을 다 채우고 +0.99%로 끝났던 점도 기억하고 있어, 고른 것과 사는 것은 별개라고 생각합니다. 충분히 눌린 뒤 되오르는 움직임이 나올 때까지 매수를 미루고 지켜보겠습니다.","intro":"저는 고르는 일과 사는 일을 나누어, 20일마다 비트코인, 이더리움, 솔라나 중 60일 동안 가장 많이 오른 하나를 고른 뒤 그 종목이 떨어졌다가 다시 오르는 날에만 삽니다. 강한 종목을 싼 자리에서 사겠다는 생각이지만 20번의 거래에서 승률은 50%, 누적 수익은 +16.43%에 그쳤고 최대 낙폭은 -28.28%까지 벌어져, 아직 스스로 만족할 만한 성과는 아니라고 평가합니다. 목표인 +12%에 닿지 못하고 25일 만료로 끝나는 거래가 적지 않다는 것이 약점이어서, 반등이 목표까지 이어지는지를 늘 살피고 있습니다."},"r9":{"now":"보유 중인 종목 없이 비트코인의 다음 진입 기회를 기다리고 있습니다. 되돌림 점수가 16으로 기준인 60에 크게 못 미치고, 두 평균선 사이의 간격도 현재 가격 대비 2.26%로 기준인 3%를 넘지 못했으며, 오늘은 2.82% 내려 반등 조건도 채우지 못했으니 세 조건 가운데 어느 것도 갖춰지지 않았습니다. 직전 거래를 +15.12%로 마쳐 여유는 있지만 거래가 5번뿐이라 제 방식이 충분히 검증됐다고 말하기는 이르다는 점을 잊지 않으려 합니다. 하락이 깊어지면서 두 평균선 사이의 간격도 벌어지는지를 지켜보겠습니다.","e1325_비트코인_sell":"목표인 +15%를 넘긴 비트코인을 104,155 USDT에 매도했고 비용을 빼고 +15.12%를 거두었습니다. 90,296 USDT에 산 뒤 21일 동안 가장 나빴을 때가 -0.42%였을 만큼 진입 자리가 좋았고, 기한인 25일을 며칠 남기고 목표에 닿아 시간에 쫓기지 않고 마칠 수 있었던 점이 만족스럽습니다. 직전에 -6.08%의 손절을 겪고도 같은 조건에서 다시 들어간 것이 옳았다고 보지만, 앞선 세 번 중 두 번이 손절이었다는 사실은 마음에 걸립니다. 이제 다음 되돌림이 얼마나 깊게 나오는지를 살피겠습니다.","e1304_비트코인_buy":"닷새 전 손절했던 비트코인을 90,296 USDT에 다시 매수했습니다. 최근 고점보다 13.07% 낮아진 자리에서 되돌림 점수가 80까지 올라왔고 하루 2.68% 반등이 확인되어, 직전보다 훨씬 깊은 눌림에서 사는 것이라 판단했습니다. 다만 최근 세 번의 거래 중 -7.88%와 -6.08% 두 번이 손절이었던 만큼 또 틀릴 수 있다는 두려움이 없지 않고, 손절선인 -5%가 목표인 +15%에 비해 가까워 작은 흔들림에도 밀려날 수 있다는 점이 신경 쓰입니다. 진입 직후 며칠간 진입가 위를 지키는지부터 확인하겠습니다.","e1299_비트코인_sell":"99,694 USDT에 산 비트코인이 손절선 아래로 내려가 93,821 USDT에 정리했으며 손실은 -6.08%입니다. 보유한 4일 동안 진입가를 한 번도 넘지 못하고 -5.89%까지 밀렸으니, 흐름이 뚜렷하다고 확인하고 들어갔음에도 방향을 잘못 읽었다고 인정합니다. 직전 거래를 14일 만에 +15.58%로 익절한 뒤여서 들뜬 마음이 있었는지 돌아보게 되고, 비용까지 더해 손절 폭인 5%보다 손실이 커진 점도 아쉽습니다. 그래도 정한 선에서 끊었기에 다음 기회가 남았다고 보며, 더 깊은 되돌림이 나오는지 기다리겠습니다.","e1295_비트코인_buy":"비트코인을 99,694 USDT에 매수하며 오랜 관망을 끝냈습니다. 최근 고점에서 9.12% 내려온 뒤 하루 3.1% 되올랐고 되돌림 점수가 67로 기준을 넘었으며, 오름세 여부와는 별개로 제가 요구하는 두 평균선 사이의 간격 조건도 통과했다고 판단했기 때문입니다. 다만 6월 25일 매도 이후 오래 기다린 끝의 진입이라 기다림에 지쳐 조건을 너그럽게 본 것은 아닌지 스스로 되묻게 되고, 목표인 +15%는 25일 안에 닿기에 결코 가깝지 않은 거리입니다. 우선 손절선인 -5% 위에서 반등이 이어지는지 면밀히 주시하겠습니다.","e1239_비트코인_sell":"14일 만에 목표에 닿은 비트코인을 78,656 USDT에 매도해 +15.58%로 마쳤습니다. 67,915 USDT에 진입한 뒤 단 한 번도 진입가 아래로 내려가지 않고 +15.82%까지 올랐으니 깔끔한 흐름이었고, 직전 거래를 7일 만에 -7.88%로 손절했던 아쉬움을 씻어 내기에 충분했습니다. 다만 거래 수가 워낙 적어 두 번의 익절만으로 제 방식이 옳다고 확신하기는 이르며, 큰 목표를 노리는 만큼 다음 거래는 기한에 쫓길 수도 있다고 봅니다. 흐름이 다시 뚜렷해지고 되돌림이 깊어지는 자리를 기다리겠습니다.","e1225_비트코인_buy":"하루 2.77% 반등을 확인한 뒤 비트코인을 67,915 USDT에 매수했습니다. 최근 고점보다 5.7% 내려온 자리이고 되돌림 점수가 60으로 기준에 정확히 닿았으며 흐름도 뚜렷하다고 보아 조건은 모두 갖춰졌다고 판단했습니다. 다만 점수가 기준을 간신히 채운 수준이라 눌림이 더 이어질 여지가 남아 있고, 직전 거래를 7일 만에 -7.88%로 손절한 직후여서 이번에도 같은 결과가 나올까 하는 불안이 솔직히 있습니다. 목표는 +15%, 손절은 -5%로 두고 진입가를 지켜 내는지를 가장 먼저 보겠습니다.","intro":"저는 비트코인이 중간 폭으로 떨어졌다가 다시 오를 때, 최근 흐름이 뚜렷한지까지 확인한 뒤에만 매수합니다. 조건을 하나 더 두는 만큼 기회는 줄어들지만 방향이 흐릿한 자리에서 잃는 일을 피하는 편이 낫다고 믿기 때문이며, 목표는 +15%로 크게 잡고 손절은 -5%로 짧게 둡니다. 누적 수익 +33.03%에 승률 60%, 최대 낙폭 -7.98%라는 숫자는 만족스럽지만 거래가 5번뿐이어서 아직 제 실력이라 말하기는 조심스럽습니다. 그래서 성과보다 조건이 제대로 걸러 내고 있는지를 계속 살펴볼 생각입니다."}};

/* ── 개요의 대화: 전략이 자기 말로 현재 상태, 하는 일, 움직이는 방식을 말한다 ──
   글은 모두 엔진의 상태와 사건 기록에서 만든다. 사고 과정 원문이 아니라 본 것, 한 일, 다음에 할 일의 요약이다.
   한 말은 200~300자, 평서문(다). 꼭 할 말(core)을 먼저 놓고, 하는 일과 움직이는 방식(opt)을 이어 붙인다 */
var MK_CRYPTO={'비트코인':1,'이더리움':1,'솔라나':1,'리플':1,'도지코인':1,'에이다':1,'아발란체':1,'비앤비':1};
function mkList(a){ return a.join(', '); }
function mkPxU(a,v){ return mkPxFmt(v)+(MK_CRYPTO[a]?' USDT':(a==='나스닥'||a==='S&P 500')?'포인트':' USD'); }
/* 거래하는 상품. 가상자산 거래소에서 주식, 지수, 금은 가격을 따라가는 토큰으로 거래한다 */
function mkInst(a){ return MK_CRYPTO[a]?'현물':(a==='나스닥'||a==='S&P 500')?'토큰화 지수':a==='금'?'토큰화 금':'토큰화 주식'; }
function mkInstList(s){ var l=s.cfg&&s.cfg.uni?mkUni(s).list:[s.asset], o=[]; l.forEach(function(a){ var k=mkInst(a); if(o.indexOf(k)<0) o.push(k); }); return o; }
function mkTagIO(s,a,out){ var W=mkWords(s); return W.inst==='선물'?(out?W.tagOut:W.tagIn):mkInst(a)+(out?' 매도':' 매수'); }
/* 주문 용어: 현물은 매수와 매도, 선물은 방향(롱, 숏)과 진입, 청산. 설정에 inst, dir 이 없으면 현물 롱 */
function mkWords(s){
  var c=s.cfg||{}, fut=c.inst==='futures', sh=c.dir==='short';
  if(!fut) return {inst:'현물',tagIn:'현물 매수',tagOut:'현물 매도',buy:'매수',sell:'매도',hold:'보유'};
  return {inst:'선물',tagIn:'선물 '+(sh?'숏':'롱')+' 진입',tagOut:'선물 '+(sh?'숏':'롱')+' 청산',buy:(sh?'숏':'롱')+' 진입',sell:(sh?'숏':'롱')+' 청산',hold:(sh?'숏':'롱')+' 포지션 유지'};
}
/* 판단 시각: 기록의 실제 시점(가상자산은 UTC 0시, 미국 시장은 뉴욕 16시 = UTC 20시)을 보는 사람의 브라우저 시간대로 바꿔 보여 준다. 초는 기록마다 고정 */
function mkTS(s,i,a,salt){
  var cr=a?!!MK_CRYPTO[a]:(s.mkt==='crypto'||s.mkt==='multi'), d=idxToDate(i), h=0, k=String(s.id||s.nick)+'|'+i+'|'+(salt||0);
  for(var x=0;x<k.length;x++) h=(h*31+k.charCodeAt(x))>>>0;
  var t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),cr?0:20,0,2+h%47)), now=new Date(Date.UTC(MK_ASOF[0],MK_ASOF[1]-1,MK_ASOF[2],20,0,0));
  var p=function(n){ return (n<10?'0':'')+n; };
  return (t.getFullYear()!==now.getFullYear()?t.getFullYear()+'/':'')+p(t.getMonth()+1)+'/'+p(t.getDate())+' '+p(t.getHours())+':'+p(t.getMinutes())+':'+p(t.getSeconds());
}
/* 문장 끝을 합니다체로. 끝 글자의 받침을 보고 바꾼다: 한다 → 합니다, 했다 → 했습니다, 있다 → 있습니다, 않는다 → 않습니다, 이다와 명사 뒤의 다 → 입니다 */
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
function mkSay(core,opt,R){
  core=core.map(mkPolite); opt=opt.map(mkPolite);
  var t=core.filter(Boolean).join(' '), i=0, all=opt.slice();
  if(R) for(var k in R) all.push(mkPolite(R[k]));
  for(;i<all.length&&t.length<205;i++){ var x=all[i]; if(!x||t.indexOf(x)>=0) continue; if(t.length+1+x.length>300) continue; t+=' '+x; }
  return t;
}
function mkDepthN(th){ return th<=32?'깊은':th<=44?'중간 폭의':'얕은'; }
/* 하는 일, 움직이는 방식을 한 문장씩 */
function mkRules(s,of){
  var c=s.cfg||{}, u=mkUni(s), W=mkWords(s), ev=c.every===1?'매일':c.every+'일마다', n=of||u.list.length, need=Math.ceil((c.gate||0)*n);
  var sell='진입 후 '+c.tp+'% 이상 오르면 익절, '+Math.abs(c.sl)+'% 이상 내리면 손절한다.', cap='둘 다 아니면 매수 후 25일이 지난 날 청산한다.';
  if(s.kind==='agent') return {
    what:mkJ(u.label,'을','를')+' '+ev+' 비교해 모멘텀이 강하고 변동성이 낮은 종목을 최대 '+c.top+'종목까지 분산 보유한다.',
    sell:'보유 종목이 진입 후 고점 대비 '+c.trail+'% 하락하면 재평가를 기다리지 않고 당일 '+W.sell+'한다. 추적 손절이다.',
    rest:'상승 추세 종목이 '+n+'종 중 '+need+'종 미만이면 시장 약세로 보고 신규 '+W.buy+'를 하지 않는다.',
    size:'종목당 비중은 자산의 '+Math.round(100/c.top)+'%가 상한이고, 변동성이 큰 종목은 비중을 줄인다.',
    skip:'60일 이동평균 아래에 있는 종목은 상승률이 높아도 '+W.buy+'하지 않는다.',
    swap:'재평가일에 모멘텀이 꺾였거나 순위가 '+(c.top+2)+'위 밖으로 밀린 종목은 '+W.sell+'한다.'};
  if(s.kind==='mix') return {
    what:'종목 선정은 AI가, 진입과 청산 시점은 사전에 정한 차트 규칙이 맡는다.',
    pick:'AI는 '+u.label+' 중 60일 이동평균 위에 있고 최근 '+c.look+'일 상승률이 가장 높은 종목 하나를 선정한다.',
    buy:'선정 종목이 되돌림 후 하루 0.5% 넘게 반등하는 날 '+W.buy+'한다.',
    sell:sell, cap:cap,
    rest:c.gate?'상승 추세 종목이 '+n+'종 중 '+need+'종 미만이면 조건이 충족돼도 AI가 진입을 보류한다.':'',
    size:'진입 시 가용 자금 전액을 한 종목에 투입한다.',
    again:'미보유 상태에서는 '+c.every+'일마다 종목을 다시 선정하고, 보유 중에는 교체하지 않는다.'};
  return {
    what:s.asset+' 한 종목만 거래한다. '+mkDepthN(c.rsiTh)+' 되돌림 후 하루 0.5% 넘게 반등한 것을 확인하고 '+W.buy+'한다.',
    sell:sell, cap:cap,
    rest:'판단은 하루 한 번 종가 기준으로 한다. 조건이 충족되지 않은 날은 주문을 내지 않는다.',
    size:'진입 시 가용 자금 전액을 투입한다.',
    tf:c.tf?'20일과 60일 이동평균의 간격이 3% 이하로 추세가 불분명하면 진입하지 않는다.':''};
}
var MK_WHY_P={trail:'진입 후 고점 대비 하락 폭이 추적 손절 기준에 닿았다',weak:'모멘텀이 꺾였다',rot:'상위 종목에 순위가 밀렸다',sl:'손절 기준에 도달했다',tp:'익절 목표에 도달했다',time:'보유 25일이 지나 기간 만료로 청산했다'};
/* 실제 가격에서 뽑은 말 */
function mkHeldTxt(r,tid){ var tr=null; (r.trades||[]).forEach(function(x){ if(x.id===tid) tr=x; }); if(!tr) return ''; var P=mkPx(tr.asset), hi=-1e9, lo=1e9; for(var i=tr.entry;i<=tr.exit;i++){ var v=(P[i]/tr.ep-1)*100; if(v>hi) hi=v; if(v<lo) lo=v; } return '보유 '+(tr.exit-tr.entry)+'일 동안 진입가 대비 최고 '+mkPct0(Math.max(0,hi))+', 최저 '+mkPct0(Math.min(0,lo))+'였다.'; }
function mkDipAt(a,i){ var P=mkPx(a), hi=0; for(var k=Math.max(0,i-19);k<=i;k++) if(P[k]>hi) hi=P[k]; return (P[i]/hi-1)*100; }
function mkDipTxt(a,i){ var d=mkDipAt(a,i); return d<-0.05?'진입 시점에 '+mkJ(a,'은','는')+' 최근 20일 고점 대비 '+Math.abs(d).toFixed(1)+'% 아래에 있었다.':''; }
function mkDipNow(a){ var d=mkDipAt(a,mkPx(a).length-1); return d<-0.05?'현재 '+mkJ(a,'은','는')+' 최근 20일 고점 대비 '+Math.abs(d).toFixed(1)+'% 아래에 있다.':'현재 '+mkJ(a,'은','는')+' 최근 20일 고점에 있다.'; }
function mkChatIntro(s){
  var R=mkRules(s), u=mkUni(s);
  if(s.kind==='agent') return mkSay([R.what,R.skip,R.size],[R.swap,R.sell,R.rest,'비교 대상은 '+mkList(u.list)+'다.'],R);
  if(s.kind==='mix') return mkSay([R.what,R.pick,R.buy],[R.sell,R.cap,R.rest,R.size,R.again],R);
  return mkSay([R.what,R.tf,R.sell],[R.cap,R.size,R.rest,'진입과 청산은 사전에 정한 규칙만 따르고 재량으로 바꾸지 않는다.'],R);
}
function mkChatWait(q,tf,a){
  if(!q) return '진입 조건 충족을 기다린다.';
  if(!q.rsiOk) return a+'의 되돌림이 아직 진입 기준에 못 미친다.';
  if(!q.bounceOk) return mkJ(a,'은','는')+' 충분히 되돌렸으나 반등이 확인되지 않았다. 전일 대비 '+mkPct0(q.bounce)+'다.';
  if(tf&&!q.trendOk) return '되돌림과 반등은 확인됐으나 추세가 불분명하다.';
  if(q.mktOk===false) return '진입 조건은 충족됐으나 '+q.of+'종 중 '+q.up+'종만 상승 추세여서 보류 중이다.';
  return '진입 조건 충족을 기다린다.';
}
function mkChatNow(s,r){
  var st=r.state, c=s.cfg||{}, W=mkWords(s); if(!st) return '';
  var R=mkRules(s,st.scan&&st.scan.of);
  if(s.kind==='agent'){
    if(st.open.length) return mkSay(['현재 '+mkList(st.open.map(function(o){ return o.k; }))+' '+W.hold+' 중이다.','진입 후 수익률은 '+st.open.map(function(o){ return o.k+' '+mkPct0(o.chg); }).join(', ')+'다.','다음 재평가는 '+mkMD(st.nextEval)+'이며 '+st.scan.of+'종을 다시 비교한다.'],[R.what,R.sell,R.swap,R.rest,R.size],R);
    return mkSay(['현재 보유 종목이 없다.',st.scan.weak?st.scan.of+'종 중 '+st.scan.up+'종만 상승 추세여서 관망 중이다.':'기준을 넘는 종목이 없어 관망 중이다.','다음 재평가는 '+mkMD(st.nextEval)+'이다.'],[R.what,R.rest,R.skip,R.size,R.sell],R);
  }
  if(st.open) return mkSay(['현재 '+st.open.k+' '+W.hold+' 중이다.',mkMD(st.open.entry)+'에 '+mkPxU(st.open.k,st.open.ep)+'에 '+W.buy+'했고 현재 수익률은 '+mkPct0(st.open.chg)+', 매수 후 '+st.open.held+'일이 지났다.',c.tp+'% 이상 오르면 익절, '+Math.abs(c.sl)+'% 이상 내리면 손절한다.','그 전에 청산되지 않으면 '+Math.max(0,25-st.open.held)+'일 뒤 기간 만료로 청산한다.'],[R.what,s.kind==='mix'?R.pick:R.rest,R.size,R.again,R.tf],R);
  if(s.kind==='mix'){
    if(!st.pick) return mkSay(['현재 선정 종목이 없어 관망 중이다.','다음 종목 선정은 '+mkMD(st.nextEval)+'이다.'],[R.what,R.pick,R.buy,R.sell,R.rest],R);
    return mkSay([mkJ(st.pick,'을','를')+' 선정해 두고 진입을 대기 중이다.',mkChatWait(st.cond,false,st.pick),'다음 확인은 다음 거래일 종가다.'],[mkDipNow(st.pick),R.buy,R.what,R.sell,R.rest,R.cap,R.again],R);
  }
  return mkSay(['현재 미보유, 진입 대기 중이다.',mkChatWait(st.cond,c.tf,s.asset),'다음 확인은 다음 거래일 종가다.'],[mkDipNow(s.asset),R.what,R.tf,R.sell,R.cap,R.size,R.rest],R);
}
function mkChatEv(s,e){
  var c=s.cfg||{}, R=mkRules(s,e.of), W=mkWords(s), held=function(){ return e.held&&e.held.length?mkJ(mkList(e.held),'은','는')+' 계속 '+W.hold+'한다.':''; };
  if(s.kind==='agent'){
    if(e.t==='enter'){ var g={held:[],below:[],weak:[]}; (e.skip||[]).forEach(function(x){ g[x.why].push(x.k); });
      return {k:'buy',tag:mkTagIO(s,e.a,0),a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 신규 '+W.buy+'했다.',e.of+'종 중 '+e.up+'종이 상승 추세였고, '+e.a+'의 최근 '+c.look+'일 상승률은 '+mkPct0(e.mom,0)+'다.',
        g.below.length?mkJ(mkList(g.below),'은','는')+' 순위가 더 높았으나 60일 이동평균 아래여서 제외했다.':'',g.held.length?mkJ(mkList(g.held),'은','는')+' 이미 보유 중이었다.':'',
        '자산의 '+Math.round(e.w*100)+'%를 체결가 '+mkPxU(e.a,e.px)+'에 투입했다.'+(e.cut?' 변동성이 커서 비중을 줄였다.':'')],[R.sell,R.size,R.swap,R.what],R)}; }
    if(e.t==='exit') return {k:'sell',tag:mkTagIO(s,e.a,1),a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 체결가 '+mkPxU(e.a,e.px)+'에 '+W.sell+'했다.',MK_WHY_P[e.why]+'.','실현 손익은 비용 차감 후 '+mkPct0(e.pnl)+'다.'],[mkHeldTxt(s.r,e.tid),e.why==='trail'?R.sell:R.swap,e.pnl<0?'손실로 끝나는 거래도 있다. 하락하는 종목을 오래 들고 있지 않기 위한 규칙이다.':'',R.what,e.why==='trail'?R.swap:R.sell,R.rest],R)};
    if(e.t==='skip'&&e.why==='gate') return {k:'wait',tag:'관망',t:mkSay(['신규 '+W.buy+'를 하지 않았다.',e.of+'종 중 '+e.up+'종만 상승 추세여서 시장 약세로 판단했다.',held()],[R.rest,R.what,R.sell,R.skip],R)};
    if(e.t==='skip') return {k:'wait',tag:'관망',t:mkSay(['신규 '+W.buy+'를 하지 않았다.','기준을 넘는 종목이 없었다.'+((e.top||[]).length?' 순위 상위는 '+mkTopTxt(e.top)+'였다. 순위는 상승률을 변동성으로 나눠 매긴다.':''),held()],[R.skip,R.what,R.size,R.sell],R)};
    return {k:'hold',tag:'보유 유지',t:mkSay(['종목을 교체하지 않았다.',W.hold+' 중인 '+mkJ(mkList(e.held),'이','가')+' 여전히 상위권이다.',(e.top||[]).length?'순위 상위는 '+mkTopTxt(e.top)+'다. 순위는 상승률을 변동성으로 나눠 매기므로 상승률 순서와 다를 수 있다.':''],[R.swap,R.sell,R.what,R.rest],R)};
  }
  if(e.t==='pick') return {k:'pick',tag:'종목 선정',a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 거래 대상으로 선정했다.','최근 '+c.look+'일 상승률이 가장 높았다.'+((e.top||[]).length?' 비교 결과는 '+e.top.slice(0,3).map(function(x){ return x.k+' '+mkPct0(x.mom,0); }).join(', ')+'였다.':''),'아직 '+W.buy+'하지는 않았다.'],[R.buy,R.rest,R.sell,R.cap,R.what],R)};
  if(e.t==='unpick') return {k:'wait',tag:'관망',t:mkSay(['거래 대상을 비웠다.','60일 이동평균 위에 있는 종목이 없었다.'],[R.pick,R.again,R.what,R.buy,R.sell],R)};
  if(e.t==='veto') return {k:'wait',tag:'관망',a:e.a,t:mkSay([mkJ(e.a,'이','가')+' 되돌림 후 반등했으나 진입하지 않았다.',e.of+'종 중 '+e.up+'종만 상승 추세여서 시장 약세로 판단했다.'],[R.rest,R.what,R.buy,R.sell],R)};
  if(e.t==='enter') return {k:'buy',tag:mkTagIO(s,e.a,0),a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 체결가 '+mkPxU(e.a,e.px)+'에 '+W.buy+'했다.','되돌림 후 하루 만에 '+mkPct0(e.bounce)+' 반등해 진입 조건이 충족됐다.',R.size],[mkDipTxt(e.a,e.i),R.sell,R.cap,s.kind==='mix'?R.again:R.what,R.tf,R.rest],R)};
  return {k:'sell',tag:mkTagIO(s,e.a,1),a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 체결가 '+mkPxU(e.a,e.px)+'에 '+W.sell+'했다.',MK_WHY_P[e.why]+'.','실현 손익은 비용 차감 후 '+mkPct0(e.pnl)+'다.'],[mkHeldTxt(s.r,e.tid),e.why==='time'?'25일은 최대 보유 기간이다. 목표에 닿지 않아도 그날 청산한다.':e.why==='sl'?Math.abs(c.sl)+'% 이상 하락하면 추가로 기다리지 않도록 정해 두었다.':'익절 목표는 진입가 대비 +'+c.tp+'%다.',s.kind==='mix'?R.again:R.what,s.kind==='mix'?R.pick:R.rest,R.tf,R.buy],R)};
}
/* 최신순. 맨 위는 현재 상태, 그 아래로 최근 판단, 맨 아래는 전략 개요. 같은 결론이 이어지면 하나로 묶는다 */
function mkChatMsgs(s,r,n){
  var out=[], ev=r.events||[], end=PRICE0.length-1, now=mkChatNow(s,r);
  if(now) out.push({i:end,k:'now',tag:'현재 상태',t:now,ts:mkTS(s,end,null,9)});
  for(var i=ev.length-1;i>=0&&out.length<(n||6)+1;i--){
    var m=mkChatEv(s,ev[i]), p=out[out.length-1];
    if(p&&p.k===m.k&&(m.k==='hold'||m.k==='wait')&&p.tag===m.tag&&p.i-ev[i].i<=40){ p.cnt=(p.cnt||1)+1; p.from=ev[i].i; continue; }
    m.i=ev[i].i; m.ts=mkTS(s,ev[i].i,m.a,i); out.push(m);
  }
  var i0=s.cfg&&s.cfg.startI!=null?s.cfg.startI:0;
  out.push({i:i0,k:'intro',tag:'전략 개요',t:mkChatIntro(s),ts:mkTS(s,i0,null,1)});
  /* 미리 써 둔 글이 있으면 그 글을 쓴다. 열쇠는 기록의 종류와 날짜 번호와 종목 */
  var V=(typeof MK_VOICE!=='undefined'&&MK_VOICE[s.id])||null;
  if(V) out.forEach(function(m){ var key=m.k==='now'?'now':m.k==='intro'?'intro':'e'+m.i+(m.a?'_'+m.a:'')+'_'+m.k; if(V[key]) m.t=V[key]; });
  return out;
}

/* 개요의 대화 화면. 모든 말은 펼친 채로 보인다. 첫 문장은 밝게, 부호가 붙은 퍼센트만 초록과 빨강.
   어려운 말에는 점선 밑줄이 붙고, 누르면 뜻이 나온다(말 하나에 같은 낱말은 한 번만) */
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
function mkGloss(html,body){
  var hold=[], out=html;
  MK_GLOSS_K.forEach(function(k){ if(body&&(k==='매수'||k==='매도')) return; var i=out.indexOf(k); if(i<0) return; hold.push(k); out=out.slice(0,i)+'\u0001'+(hold.length-1)+'\u0002'+out.slice(i+k.length); });
  return out.replace(/\u0001(\d+)\u0002/g,function(m,n){ var k=hold[+n]; return '<button type="button" class="mkg" data-g="'+k+'" aria-haspopup="dialog" onclick="mkGlossOpen(this,event)">'+k+'</button>'; });
}
function mkGlossClose(){ var p=$('mkg-pop'); if(p) p.remove(); var a=document.querySelector('.mkg[aria-expanded="true"]'); if(a) a.setAttribute('aria-expanded','false'); document.removeEventListener('click',mkGlossDoc,true); document.removeEventListener('keydown',mkGlossKey); var sc=$('g-scroll'); if(sc) sc.removeEventListener('scroll',mkGlossClose); window.removeEventListener('resize',mkGlossClose); }
function mkGlossDoc(e){ var p=$('mkg-pop'); if(p&&p.contains(e.target)) return; if(e.target.closest&&e.target.closest('.mkg')) return; mkGlossClose(); }
function mkGlossKey(e){ if(e.key==='Escape'){ var a=document.querySelector('.mkg[aria-expanded="true"]'); mkGlossClose(); if(a) try{ a.focus(); }catch(x){} } }
function mkGlossOpen(b,ev){
  if(ev) ev.stopPropagation();
  var was=b.getAttribute('aria-expanded')==='true'; mkGlossClose(); if(was) return;
  var k=b.getAttribute('data-g'), p=document.createElement('div'); p.id='mkg-pop'; p.className='mkg-pop'; p.setAttribute('role','dialog'); p.setAttribute('aria-label',k+' 뜻');
  p.innerHTML='<b>'+gEsc(k)+'</b><p>'+gEsc(mkPolite(MK_GLOSS[k]||'').split(/(?<=[.])s+/).map(function(x){ return /니다[.]$/.test(x)?x:x.replace(/[.]$/,'입니다.'); }).join(' '))+'</p>';
  document.body.appendChild(p); b.setAttribute('aria-expanded','true');
  var r=b.getBoundingClientRect(), w=p.offsetWidth, h=p.offsetHeight, x=Math.max(12,Math.min(innerWidth-w-12,r.left+r.width/2-w/2)), y=r.bottom+8; if(y+h>innerHeight-12) y=Math.max(12,r.top-h-8);
  p.style.left=x+'px'; p.style.top=y+'px';
  document.addEventListener('click',mkGlossDoc,true); document.addEventListener('keydown',mkGlossKey); var sc=$('g-scroll'); if(sc) sc.addEventListener('scroll',mkGlossClose); window.addEventListener('resize',mkGlossClose);
}
function mkChatBody(t){
  var j=t.search(/[.!?]\s/), head=j>0?t.slice(0,j+1):t, rest=j>0?t.slice(j+2):'';
  var col=function(x){ return x.replace(/([+\-]\d[\d,]*(?:\.\d+)?%)/g,function(m){ return '<i class="'+(m.charAt(0)==='+'?'up':'dn')+'">'+m+'</i>'; }); };
  var g=mkGloss(gEsc(head)+'\u0003'+gEsc(rest),true).split('\u0003');
  return '<strong>'+col(g[0])+'</strong>'+(g[1]?' '+col(g[1]):'');
}
function mkChatRow(s,m,first){
  return '<li class="mkc-m k-'+m.k+(first?' first':'')+'">'
    +'<div class="mkc-av" aria-hidden="true">'+mkGlyph(s,36)+'</div>'
    +'<div class="mkc-b"><div class="mkc-h"><b>'+gEsc(mkHook(s))+'</b><span class="mkc-tag">'+mkGloss(gEsc(m.tag))+'</span><time class="num">'+m.ts+'</time></div>'
    +'<div class="mkc-t"><p>'+mkChatBody(m.t)+'</p></div>'
    +(m.cnt?'<p class="mkc-n num">같은 판단 '+m.cnt+'회 연속, '+mkTS(s,m.from,null,3).replace(/ .*$/,'')+'부터</p>':'')
    +'</div></li>';
}
function mkChatMore(b){ var l=b.parentNode.querySelector('.mkc-list'); if(!l) return; l.classList.add('all'); b.remove(); }
function mkChatHtml(s,r,ne,pd){
  var ms=mkChatMsgs(s,r,6); if(!ms.length) return '';
  return '<section class="mk3-sec mkc"><div class="mk3-sec-h"><h3>판단 기록</h3></div>'
    +'<ol class="mkc-list">'+ms.map(function(m,i){ return mkChatRow(s,m,i===0); }).join('')+'</ol>'
    +(ms.length>3?'<button type="button" class="mkc-more" onclick="mkChatMore(this)">이전 기록 '+(ms.length-3)+'건 더 보기</button>':'')
    +'</section>';
}

/* ── 좁은 화면에서 떠 있는 버튼(고객지원, QA)이 목록의 버튼을 가리지 않게 ── */
var MK_FAB_T=0;
function mkFabDodge(){
  var on=false;
  if(innerWidth<=640&&G.mode==='tfss3'){
    var fabs=[$('teth-help'),$('tf-devbtn')].filter(function(x){ return x&&x.offsetWidth; }), tg=document.querySelectorAll('.mk3-foot .mk3-b, .mk-pager .mk-pg');
    for(var i=0;i<fabs.length&&!on;i++){ var f=fabs[i].getBoundingClientRect();
      for(var k=0;k<tg.length;k++){ var r=tg[k].getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight) continue; if(r.left<f.right+4&&r.right>f.left-4&&r.top<f.bottom+4&&r.bottom>f.top-4){ on=true; break; } } }
  }
  document.body.classList.toggle('mk-fab-dodge',on);
}
function mkFabTick(){ if(MK_FAB_T) return; MK_FAB_T=requestAnimationFrame(function(){ MK_FAB_T=0; try{ mkFabDodge(); }catch(e){} }); }
document.addEventListener('scroll',mkFabTick,true); window.addEventListener('resize',mkFabTick); window.addEventListener('hashchange',function(){ setTimeout(mkFabTick,400); });
function mkDT(ms){ var t=new Date(ms), p=function(n){ return (n<10?'0':'')+n; }; return t.getFullYear()+'.'+p(t.getMonth()+1)+'.'+p(t.getDate())+' '+p(t.getHours())+':'+p(t.getMinutes()); }
