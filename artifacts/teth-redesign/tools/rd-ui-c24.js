/* ═══ 판단 방식 중심 목록과 상세 (rd) ═══
   세 가지 판단 방식: agent(직접 탐색), rule(조건 실행), mix(혼합).
   화면의 상태, 판단 기록, 성과는 모두 같은 계산 결과(r)에서 읽는다. 목록 카드와 상세가 다른 계산을 하지 않는다. */
var MK_KIND={agent:'AI 판단',rule:'차트 규칙',mix:'AI+규칙'};
/* 이름이 바뀌어도 저장된 즐겨찾기와 따라가기가 같은 전략을 찾게 하는 별칭(옛 이름 → 전략 ID).
   이전 목록에서는 행동 값이 같은 조건 실행 9종만 연결한다. 나머지는 추정하지 않는다 */
var MK_ALIAS={'비트코인 바겐세일':'r1','김대리의 나스닥':'r2','손절은 칼같이':'r3','골드핑거':'r4','테슬라 역발상가':'r5','짧게 먹고 내린다':'r6','리플 잔돈 수집가':'r7','끝까지는 안 가':'r8','비트코인은 기다림':'r9',
  '한계선':'r3','거름':'h2','돌림':'d4','이음':'h3','깊은 숨':'r5','한구간':'r6','길잡이':'h4','분업':'h5','길목':'r9',
  /* 2026-09-29 카드 1차 구현의 이름 */
  '네 시장에서 둘':'d2','코인 매일 갈아타기':'d3','대표 코인 하나만':'d6','네 시장에서 하나':'h4','많이 오른 코인 하나':'h5','금 방향부터 확인':'r4','테슬라 오래 기다리기':'r5','리플 작게 여러 번':'r7','비트코인 방향 확인':'r9',
  /* 2026-09-29 이름 개편 전 이름 */
  '세 갈래':'d1','건널목':'d2','환승':'d3','기술주 셋':'d4','동행':'d5','외길':'d6','맞물림':'h1','추림':'h2','지수와 금':'h3','갈림길':'h4','고른 뒤':'h5','되짚기':'r1','짧은 호흡':'r2','물러섬':'r3','두 문턱':'r4','깊은 되돌림':'r5','한 구간':'r6','작은 걸음':'r7','마침표':'r8','방향선':'r9'};
/* 데이터 기준일: 마지막 봉의 날짜. 가격 데이터를 바꿀 때 함께 바꾼다. 날짜, 판단 기록, 기간 계산, 저장된 시작 봉이 모두 이 기준에 묶인다 */
var MK_ASOF=[2026,9,28], MK_DATA_V='2026-09-28.1', MK_D0=null, MK_D0K='';
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
  return mkRuleRun({asset:c.asset,rsiTh:c.rsiTh,tp:c.tp,sl:c.sl,tf:!!c.tf,startI:st});
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
      if(g.len!==now.len||g.asof.join('-')!==now.asof.join('-')){ var d0=new Date(g.asof[0],g.asof[1]-1,g.asof[2]), d1=new Date(now.asof[0],now.asof[1]-1,now.asof[2]), sh=(now.len-g.len)-Math.round((d1-d0)/86400000); ['simStartI','flatI'].forEach(function(k){ if(c[k]!=null) c[k]=Math.max(0,Math.min(now.len-1,c[k]+sh)); }); c.gen=now; ch=true; } });
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
  if(s.kind==='agent'){ if(st.open.length) return st.open.map(function(o){ return o.k; }).join(', ')+' 보유 중'; return st.scan&&st.scan.weak?'시장이 약해 기다리는 중':'살 종목을 찾는 중'; }
  if(st.open) return st.open.k+' 보유 중';
  if(s.kind==='mix') return st.pick?st.pick+', '+mkWaitPlain(st.cond,false):'고를 종목이 없어 기다리는 중';
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
    +'<div class="mk3-now"><small>지금</small><span>'+gEsc(mkNowLine(s))+'</span></div>'
    +'<div class="mk3-perf"><div class="mk-c-ret mk3-ret"><small>30일 수익률</small><b class="num'+mkSign(m30.ret)+'">'+mkPct0(m30.ret)+'</b></div>'+mkSpark3(m30.eq)+'</div>'
    +'<div class="mk3-facts">'+(win?'<div><small>전체 기간 수익 낸 거래</small><b class="num">'+win+'</b></div>':'')+(fw?mkFwHtml(s.fw):'')+'</div>'
    +'<div class="mk3-foot">'+(s.me?'':bF)+bD+'</div>'
    +'</article>';
}
function tfSS3GridHtml(){
  var t=tfSSState(), rows=tfSSRows(); mkSortKey(t);
  if(t.ss.asset&&t.ss.asset!=='all') rows=rows.filter(function(s){ return s.mkt===t.ss.asset; });
  if(t.ss.kind&&t.ss.kind!=='all') rows=rows.filter(function(s){ return (s.kind||'rule')===t.ss.kind; });
  if(TF_SS_Q){ var q=TF_SS_Q.toLowerCase(); rows=rows.filter(function(s){ return [s.nick,s.asset,mkTitle(s),s.one||'',s.by?'@'+s.by:'',s.id||'',mkOldNames(s.id),MK_KIND[s.kind]||'',mkUni(s).list.join(' ')].join(' ').toLowerCase().indexOf(q)>=0; }); }
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
    +'<div class="mk3-kindrow"><div class="mk3-seg" role="group" aria-label="판단 방식">'+[['all','전체'],['agent','AI 판단'],['rule','차트 규칙'],['mix','AI+규칙']].map(function(o){ var on=kind===o[0]; return '<button type="button" aria-pressed="'+on+'" onclick="mkKindPick(\''+o[0]+'\')">'+o[1]+'<i class="num">'+cnt[o[0]]+'</i></button>'; }).join('')+'</div>'
    +'<p class="mk3-kindhelp">'+({all:'AI 판단은 AI가 종목과 비중을 정하고, 차트 규칙은 정해 둔 가격 조건만 따르고, AI+규칙은 AI가 종목을 고르고 규칙이 시점을 정해요.',agent:'여러 종목을 비교해 무엇을 얼마나 들지 AI가 정해요. 시장이 약하면 새로 사지 않아요.',rule:'정해 둔 자산에서 정해 둔 조건이 맞을 때만 사고팔아요.',mix:'거래할 종목은 AI가 고르고, 사고파는 시점은 규칙이 정해요.'}[kind])+'</p></div>'
    +'<div class="mk-flt mk3-flt">'
    +'<div class="mk-chips" aria-label="정렬"><span class="lb">정렬</span>'+[['ret','30일 수익률'],['fw','따라가는 사람'],['win','거래 승률']].map(function(o){ var on=sort===o[0]; return '<button type="button" class="mk-chip'+(on?' on':'')+'" aria-pressed="'+on+'" onclick="tfSS3SortPick(\''+o[0]+'\')">'+o[1]+(on?(t.ss.dir==='asc'?' ↑':' ↓'):'')+'</button>'; }).join('')+'</div>'
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
  if(s.kind==='mix') return [['AI가 정하는 것','거래할 종목 하나. '+u.label+' 가운데 60일 평균 가격 위에 있고 '+c.look+'일 동안 가장 많이 오른 종목. 보유하지 않을 때 '+c.every+'일마다 다시 골라요'+(c.gate?'. 시장이 약하면 진입을 보류해요':'')],['규칙이 정하는 것','사는 때와 파는 때. 고른 종목이 밀렸다가 반등하면 사요'],['바뀌지 않는 한도',c.tp+'% 오르거나 '+Math.abs(c.sl)+'% 밀린 날 팔아요. 길어도 25일']];
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
    rows+=row('지금 든 것',st.open.length?st.open.map(function(o){ return '<b>'+gEsc(o.k)+'</b> 자산의 '+Math.round(o.w*100)+'%, <i class="num'+mkSign(o.chg)+'">'+mkPct0(o.chg)+'</i>'; }).join('<br>'):'없음, 현금 '+Math.round(st.cash*100)+'%');
    rows+=row('다음 재평가',mkMD(st.nextEval)+' 장 마감'+(st.lastEval<end?', 마지막 재평가 '+mkMD(st.lastEval):''));
    rows+=row('보는 종목','<span class="mk3-ulist">'+st.scan.rows.map(function(x){ return '<span class="'+(x.held?'h':x.ok?'c':'')+'"><b>'+x.rank+'</b>'+gEsc(x.k)+'<i class="num">'+mkPct0(x.mom,0)+'</i><em>'+(x.held?'보유':x.ok?'후보':x.above?'기준 미달':'평균 아래')+'</em></span>'; }).join('')+'</span><span class="mk3-gauge-t">숫자는 최근 '+c.look+'일 오름폭, 순서는 오름폭을 흔들림으로 나눈 값이에요. 60일 평균 가격보다 낮은 종목(평균 아래)은 사지 않아요.</span>');
  } else if(s.kind==='mix'){
    var step=st.open?3:st.pick?2:1, q=st.cond;
    head=st.open?gEsc(st.open.k)+' 보유 중':st.pick?gEsc(st.pick)+', '+mkWaitPlain(q,false):'고를 종목을 찾는 중';
    rows+='<ol class="mk3-steps"><li class="'+(step===1?'on':'done')+'"><small>AI</small><b>종목 고르기</b><span>'+(st.pick?gEsc(st.pick):'오름세 종목 없음')+'</span></li><li class="'+(step===2?'on':step>2?'done':'')+'"><small>규칙</small><b>반등 기다리기</b><span>'+(step===2?mkWaitWhy(q,false):step>2?'조건 충족':'')+'</span></li><li class="'+(step===3?'on':'')+'"><small>규칙</small><b>보유와 정리</b><span>'+(st.open?'<i class="num'+mkSign(st.open.chg)+'">'+mkPct0(st.open.chg)+'</i>, '+st.open.held+'일째':'')+'</span></li></ol>';
    if(st.top&&st.top.length&&st.topAt!=null) rows+=row('고를 때 본 것',mkMD(st.topAt)+'에 비교한 '+c.look+'일 오름폭. '+st.top.map(function(x){ return gEsc(x.k)+' <i class="num">'+mkPct0(x.mom,0)+'</i>'; }).join(', '));
    if(st.open) rows+=row('정리 조건','+'+c.tp+'% 또는 '+c.sl+'%, 아니면 '+Math.max(0,25-st.open.held)+'일 뒤');
    else if(q) rows+=mkCondRows(q,c,row);
    rows+=row('다음 일정','규칙 확인 '+mkMD(end+1)+(st.open?'':', 종목 재선택 '+mkMD(st.nextEval)));
  } else {
    var q2=st.cond;
    if(st.open){ head=gEsc(st.open.k)+' 보유 중'; rows+=row('진입',mkMD(st.open.entry)+', '+mkPxFmt(st.open.ep)); rows+=row('지금 손익','<i class="num'+mkSign(st.open.chg)+'">'+mkPct0(st.open.chg)+'</i>, '+st.open.held+'일째'); rows+=row('정리 조건','+'+c.tp+'% 또는 '+c.sl+'%, 아니면 '+Math.max(0,25-st.open.held)+'일 뒤'); }
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
    +(s.me?'<span class="ss3-st">내가 공유한 전략</span>':'<button type="button" class="mk-pri" onclick="cpSetupGo(\''+ne+'\')">따라가기</button>')
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
function mkOvTab(s,r,pd,ne){
  var R0=s.r||r, eq=mkDaily(R0.eq||[],PRICE0.length-1); MKD.eq=eq; MKD.tab='ret'; MKD.gran='day'; MKD.per=30;
  var chart='<div class="mkd-ctl" id="mkd-ctl">'+mkdCtlHtml()+'</div><p class="mkd-hint" id="mkd-hint"></p><div class="mkd-chart" id="mkd-chart" onpointermove="mkdHover(event)" onpointerdown="mkdHover(event)" onpointerleave="mkdHover(null)">'+mkdChartHtml()+'</div>';
  if(!s.cfg) return '<div class="mk3-ov"><section class="mk3-sec" style="margin-top:0"><h3>성과</h3>'+chart+'</section></div>';
  var m30=mk30(s), w=(typeof R0.winRate==='number'&&(R0.n||0)>=5)?Math.round(R0.winRate)+'%':'-';
  return '<div class="mk3-ov">'
    +'<section class="mk3-sec" style="margin-top:0"><h3>성과</h3>'
    +mkKpi4('mk3-kpis num','',['30일 수익률','ret30',mkPct0(m30.ret),mkSign(m30.ret)],['최대 낙폭','mdd',R0.mdd.toFixed(1)+'%'],['승률','win',w],['거래 수','n',Number(R0.n||0).toLocaleString()+'회'])
    +chart+'<p class="mk3-since num">'+mkdSince(s)+' 시작 이후 '+mkPct0(R0.ret)+'</p></section>'
    +mkChatHtml(s,R0,ne,pd)
    +'</div>';
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
  c2.winding=true; c2.windAt=Date.now();
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
  if(c2.winding){ c2.flatI=null; cpClose(cid); return; } /* 정산은 cpClose 한 곳에서: 보유 실현, 봉 고정, 반환 한 번 */
  c2.flatI=s2.r.eq[s2.r.eq.length-1].i; /* 이후 손익 계산 구간을 여기서 고정 */
  tfSaveNow(); tfSS3DlgClose();
  toast('포지션을 정리했어요. 다음 진입부터 다시 따라갑니다');
  cpDetailView(cid,'pos');
}
/* 따라가는 중 화면을 열 때 정리 대기 계정을 확인한다 */
var mkHub0=tfShareHub; tfShareHub=function(tab){ try{ mkWindCheck(); }catch(e){} var prev=G.mode==='tfss3'?MK_HUB_TAB:null, out=mkHub0.apply(this,arguments); MK_HUB_TAB=tab||'find'; if(MK_HUB_TAB==='find'&&prev!=='find') try{ mkCardsEnter(); }catch(e){} return out; };
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
  var wsum=list.reduce(function(a,x){ return a+(x.w!=null?x.w:1); },0)||1;
  var rule=s2.kind==='agent'?'고점에서 '+c.trail+'% 밀리면':(c.sl!=null?c.sl+'% / +'+c.tp+'%':(s2.p?s2.p.sl+'% / +'+s2.p.tp+'%':'원본과 같음'));
  var rows=list.map(function(x){ var w=(x.w!=null?x.w:1)/wsum;
    return '<tr><td>'+gEsc(x.k)+'</td><td class="u">롱</td><td class="num">'+cpUsd(c2.amount*0.4*w,0)+'</td>'
      +'<td class="num">'+mkPxFmt(x.ep)+'</td><td class="num">'+mkPxFmt(x.px)+'</td>'
      +'<td class="num">'+rule+'</td>'
      +'<td class="num '+(x.chg>=0?'u':'d')+'">'+mkPct0(x.chg,1)+'</td></tr>'; }).join('');
  if(!rows) rows='<tr><td>'+gEsc(c2.pairs&&c2.pairs[0]||mkScope(s2))+'</td><td class="u">롱</td><td class="num">'+cpUsd(c2.amount*0.4,0)+'</td><td class="num">-</td><td class="num">-</td><td class="num">'+rule+'</td><td class="num">-</td></tr>';
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
  if(s2&&s2.r&&s2.r.eq&&s2.r.eq.length&&c2.flatI==null) c2.flatI=s2.r.eq[s2.r.eq.length-1].i;
  var d=cpCalc(c2), back=Math.max(0,d.est);
  c2.status='closed'; c2.closedAt=Date.now(); c2.settle={net:d.net,share:d.share,back:back};
  c2.ledger.push({at:Date.now(),type:'out',amt:back});
  cp.spot+=back;
  tfSaveNow(); tfSS3DlgClose();
  tfTrack('cp_close',{id:cid,net:d.net});
  if(silent) return;
  toast('따라가기를 중단했어요'+(c2.stopMode&&c2.stopMode!=='now'?' ('+MK_STOP_L[c2.stopMode]+')':'')+'. '+cpUsd(back,0)+'가 예산으로 돌아왔어요');
  tfShareHub('follow');
}

/* 목록, 상세, 시트를 잇는 열쇠는 고정 ID. 이름은 표시용 */
function tfSS3Rid(s){ return s.me?'me':tfSSNe(s.id||s.nick); }
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
MK_TAB_OK={ov:1,perf:1,trades:1,info:1}; /* 활동 탭은 없앴다. 옛 주소는 개요로 */
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
  mdd:'가장 높았던 때에서 가장 많이 내려간 폭이에요. 값이 클수록 중간에 크게 흔들렸다는 뜻이에요.',
  win:'끝난 거래 중 이익으로 끝난 거래의 비율이에요. 거래가 5번 미만이면 표시하지 않아요.',
  n:'사고팔기를 끝낸 횟수예요.',
  ex:'이 전략의 주문이 실제로 나가는 거래소예요. 따라가려면 이 거래소 계정을 연결해야 해요.'};
function mkKpi4(cls,item,a,b,c,d){ return '<div class="'+cls+'">'+[a,b,c,d].map(function(x){ return '<div'+(item?' class="'+item+'"':'')+'><small>'+mkdTerm(x[0],MK_TIP[x[1]])+'</small><b class="num'+(x[3]||'')+'">'+x[2]+'</b></div>'; }).join('')+'</div>'; }
/* 성과 탭: 기간, 지표 넷, 월별 달력 */
function mkPerfTab(s,r,pd,ne){
  var wl=(r.n||0)>=5?Math.round(r.winRate)+'%':'-';
  return mkPdChips(ne,pd,'perf')
    +mkKpi4('mk-kpis four','mk-kpi',['수익률','ret',mkPct(r.ret),r.ret>=0?' mk-up':' mk-dn'],['최대 낙폭','mdd',r.mdd.toFixed(1)+'%'],['승률','win',wl],['거래 수','n',r.n+'회'])
    +'<section class="mk-sec"><div id="ss3-cal-host">'+tfSS3CalHtml(s.r,0)+'</div></section>';
}
function mkTradesTab(s,r,pd,ne){ return mkPdChips(ne,pd,'trades')+'<div class="mk-sec-hd"><b>체결 이력</b><span class="mt2">'+mkPdLabel(pd)+', '+r.n+'건</span></div>'+mkTradesTable(s,r); }
function mkInfoTab(s,r,ne){
  var a=(s.r.params&&s.r.params.startI!=null)?s.r.params.startI:61, b=PRICE0.length-1;
  var row=function(k,v){ return '<div class="mk-info-r"><small>'+k+'</small><span>'+v+'</span></div>'; };
  return '<div class="mk-info">'
    +row('판단 방식',MK_KIND[s.kind]||'차트 규칙')
    +row('거래 대상',gEsc(s.cfg&&s.cfg.uni?mkUni(s).list.join(', '):(CPP_PAIR[s.asset]||s.asset)))
    +row('실행 거래소',mkEx(s)[1])
    +row('기록 기간',mkDate(a)+' ~ '+mkDate(b)+' ('+Math.max(1,Math.round((b-a)/30.44))+'개월)')
    +row('등록',s.me?gEsc(s.nick)+' (나)':(s.by?'@'+gEsc(s.by):'TETH'))
    +'</div>';
}
/* 개요 그래프의 조작 줄: 수익률, 수익금, 잔고. 기간에 최근 7일 */
function mkdCtlHtml(){
  var tip='이 전략이 매매로 번 비율이에요. 돈을 더 넣거나 빼도 수익률은 그대로예요. 수수료를 뺀 실제 수익이에요. 이 전략의 거래만 계산해요.';
  return '<div class="mkd-pills" role="group" aria-label="그래프 종류">'+[['ret','수익률',tip],['pnl','수익금','1,000 USDT로 시작했다면 지금까지 벌거나 잃은 금액이에요. 수수료를 뺀 금액이에요.'],['bal','잔고','1,000 USDT로 시작했다면 지금 계좌에 있는 금액이에요. 처음 넣은 1,000 USDT에 수익금을 더한 값이에요.']].map(function(t){ return '<button type="button" class="mkd-pill" aria-pressed="'+(MKD.tab===t[0])+'" onclick="mkdSet(\'tab\',\''+t[0]+'\')">'+t[1]+(t[2]?'<i aria-hidden="true">i</i><span class="mkd-tip" role="tooltip">'+t[2]+'</span>':'')+'</button>'; }).join('')+'</div>'
    +'<div class="mkd-right"><div class="mkd-seg" role="group" aria-label="간격">'+[['day','일별'],['month','월별']].map(function(g){ return '<button type="button" aria-pressed="'+(MKD.gran===g[0])+'" onclick="mkdSet(\'gran\',\''+g[0]+'\')">'+g[1]+'</button>'; }).join('')+'</div>'
    +'<select class="mkd-per" aria-label="기간 선택" onchange="mkdSet(\'per\',+this.value)">'+[[7,'최근 7일'],[30,'최근 30일'],[90,'최근 3개월'],[365,'최근 1년'],[0,'전체']].map(function(o){ return '<option value="'+o[0]+'"'+(MKD.per===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')+'</select></div>';
}

/* ── 개요의 대화: 전략이 자기 말로 현재 상태, 하는 일, 움직이는 방식을 말한다 ──
   글은 모두 엔진의 상태와 사건 기록에서 만든다. 사고 과정 원문이 아니라 본 것, 한 일, 다음에 할 일의 요약이다.
   한 말은 200~300자, 평서문(다). 꼭 할 말(core)을 먼저 놓고, 하는 일과 움직이는 방식(opt)을 이어 붙인다 */
var MK_CRYPTO={'비트코인':1,'이더리움':1,'솔라나':1,'리플':1,'도지코인':1,'에이다':1,'아발란체':1,'비앤비':1};
function mkList(a){ return a.join(', '); }
function mkPxU(a,v){ return mkPxFmt(v)+(MK_CRYPTO[a]?' USDT':(a==='나스닥'||a==='S&P 500')?'포인트':' USD'); }
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
      return {k:'buy',tag:W.tagIn,a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 신규 '+W.buy+'했다.',e.of+'종 중 '+e.up+'종이 상승 추세였고, '+e.a+'의 최근 '+c.look+'일 상승률은 '+mkPct0(e.mom,0)+'다.',
        g.below.length?mkJ(mkList(g.below),'은','는')+' 순위가 더 높았으나 60일 이동평균 아래여서 제외했다.':'',g.held.length?mkJ(mkList(g.held),'은','는')+' 이미 보유 중이었다.':'',
        '자산의 '+Math.round(e.w*100)+'%를 체결가 '+mkPxU(e.a,e.px)+'에 투입했다.'+(e.cut?' 변동성이 커서 비중을 줄였다.':'')],[R.sell,R.size,R.swap,R.what],R)}; }
    if(e.t==='exit') return {k:'sell',tag:W.tagOut,a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 체결가 '+mkPxU(e.a,e.px)+'에 '+W.sell+'했다.',MK_WHY_P[e.why]+'.','실현 손익은 비용 차감 후 '+mkPct0(e.pnl)+'다.'],[mkHeldTxt(s.r,e.tid),e.why==='trail'?R.sell:R.swap,e.pnl<0?'손실로 끝나는 거래도 있다. 하락하는 종목을 오래 들고 있지 않기 위한 규칙이다.':'',R.what,e.why==='trail'?R.swap:R.sell,R.rest],R)};
    if(e.t==='skip'&&e.why==='gate') return {k:'wait',tag:'관망',t:mkSay(['신규 '+W.buy+'를 하지 않았다.',e.of+'종 중 '+e.up+'종만 상승 추세여서 시장 약세로 판단했다.',held()],[R.rest,R.what,R.sell,R.skip],R)};
    if(e.t==='skip') return {k:'wait',tag:'관망',t:mkSay(['신규 '+W.buy+'를 하지 않았다.','기준을 넘는 종목이 없었다.'+((e.top||[]).length?' 순위 상위는 '+mkTopTxt(e.top)+'였다. 순위는 상승률을 변동성으로 나눠 매긴다.':''),held()],[R.skip,R.what,R.size,R.sell],R)};
    return {k:'hold',tag:'보유 유지',t:mkSay(['종목을 교체하지 않았다.',W.hold+' 중인 '+mkJ(mkList(e.held),'이','가')+' 여전히 상위권이다.',(e.top||[]).length?'순위 상위는 '+mkTopTxt(e.top)+'다. 순위는 상승률을 변동성으로 나눠 매기므로 상승률 순서와 다를 수 있다.':''],[R.swap,R.sell,R.what,R.rest],R)};
  }
  if(e.t==='pick') return {k:'pick',tag:'종목 선정',a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 거래 대상으로 선정했다.','최근 '+c.look+'일 상승률이 가장 높았다.'+((e.top||[]).length?' 비교 결과는 '+e.top.slice(0,3).map(function(x){ return x.k+' '+mkPct0(x.mom,0); }).join(', ')+'였다.':''),'아직 '+W.buy+'하지는 않았다.'],[R.buy,R.rest,R.sell,R.cap,R.what],R)};
  if(e.t==='unpick') return {k:'wait',tag:'관망',t:mkSay(['거래 대상을 비웠다.','60일 이동평균 위에 있는 종목이 없었다.'],[R.pick,R.again,R.what,R.buy,R.sell],R)};
  if(e.t==='veto') return {k:'wait',tag:'관망',a:e.a,t:mkSay([mkJ(e.a,'이','가')+' 되돌림 후 반등했으나 진입하지 않았다.',e.of+'종 중 '+e.up+'종만 상승 추세여서 시장 약세로 판단했다.'],[R.rest,R.what,R.buy,R.sell],R)};
  if(e.t==='enter') return {k:'buy',tag:W.tagIn,a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 체결가 '+mkPxU(e.a,e.px)+'에 '+W.buy+'했다.','되돌림 후 하루 만에 '+mkPct0(e.bounce)+' 반등해 진입 조건이 충족됐다.',R.size],[mkDipTxt(e.a,e.i),R.sell,R.cap,s.kind==='mix'?R.again:R.what,R.tf,R.rest],R)};
  return {k:'sell',tag:W.tagOut,a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 체결가 '+mkPxU(e.a,e.px)+'에 '+W.sell+'했다.',MK_WHY_P[e.why]+'.','실현 손익은 비용 차감 후 '+mkPct0(e.pnl)+'다.'],[mkHeldTxt(s.r,e.tid),e.why==='time'?'25일은 최대 보유 기간이다. 목표에 닿지 않아도 그날 청산한다.':e.why==='sl'?Math.abs(c.sl)+'% 이상 하락하면 추가로 기다리지 않도록 정해 두었다.':'익절 목표는 진입가 대비 +'+c.tp+'%다.',s.kind==='mix'?R.again:R.what,s.kind==='mix'?R.pick:R.rest,R.tf,R.buy],R)};
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
  return out;
}

/* 개요의 대화 화면. 모든 말은 펼친 채로 보인다. 첫 문장은 밝게, 부호가 붙은 퍼센트만 초록과 빨강.
   어려운 말에는 점선 밑줄이 붙고, 누르면 뜻이 나온다(말 하나에 같은 낱말은 한 번만) */
var MK_GLOSS={
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
 '현물':'코인이나 주식을 실제로 사서 보유하는 거래. 가격이 오르면 이익이 난다.',
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
