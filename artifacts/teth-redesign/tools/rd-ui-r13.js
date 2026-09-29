/* ═══ 판단 방식 중심 목록과 상세 (rd) ═══
   세 가지 판단 방식: agent(직접 탐색), rule(조건 실행), mix(혼합).
   화면의 상태, 판단 기록, 성과는 모두 같은 계산 결과(r)에서 읽는다. 목록 카드와 상세가 다른 계산을 하지 않는다. */
var MK_KIND={agent:'직접 탐색',rule:'조건 실행',mix:'혼합'};
/* 이름이 바뀌어도 저장된 즐겨찾기와 따라가기가 같은 전략을 찾게 하는 별칭(옛 이름 → 전략 ID).
   이전 목록에서는 행동 값이 같은 조건 실행 9종만 연결한다. 나머지는 추정하지 않는다 */
var MK_ALIAS={'비트코인 바겐세일':'r1','김대리의 나스닥':'r2','손절은 칼같이':'r3','골드핑거':'r4','테슬라 역발상가':'r5','짧게 먹고 내린다':'r6','리플 잔돈 수집가':'r7','끝까지는 안 가':'r8','비트코인은 기다림':'r9',
  '한계선':'r3','거름':'h2','돌림':'d4','이음':'h3','깊은 숨':'r5','한구간':'r6','길잡이':'h4','분업':'h5','길목':'r9'};
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
    return {id:c.id,ord:k+1,kind:c.kind,mkt:c.mkt,nick:c.name,name:c.name,one:c.one,asset:c.kind==='rule'?c.asset:MK_UNI[c.uni].label,uni:c.uni||null,cfg:c,ex:c.ex,p:null,fw:c.fw,score:tfScore(r),ret:r.ret,mdd:r.mdd,n:r.n,r:r};
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
function tfSS3PdCalc(s,pd){
  if(pd==='all'||(!s.p&&!s.cfg)) return s.r;
  var days=pd==='1y'?365:730, end=PRICE0.length-1, key=mkSig(s)+'|'+pd;
  if(!MK_PDC[key]) MK_PDC[key]=s.cfg?mkRunCfg(s.cfg,Math.max(s.cfg.startI||61,end-days)):runBacktest({sl:s.p.sl,tp:s.p.tp,rsiTh:s.p.rsiTh,trendFilter:s.p.trendFilter,startI:Math.max(61,s.p.startI||61,s.p.endI-days),endI:s.p.endI,px:s.p.px,fill:s.p.fill});
  return MK_PDC[key];
}
/* 30일 수익률: 매번 결과에서 바로 계산한다(값이 바뀌면 곧바로 반영) */
function mk30(s){
  var r=s.r||tfSS3PdCalc(s,'all'), e=r.eq||[], d=(e.length&&e[e.length-1].i-e[0].i===e.length-1?e:mkDaily(e,PRICE0.length-1)).slice(-31), b0=d.length?d[0].v:1;
  d=d.map(function(x){ return {i:x.i,v:x.v/b0}; });
  return {ret:d.length>1?(d[d.length-1].v-1)*100:0,eq:d};
}
function mkSortKey(t){ if(t.ss.v!==3){ t.ss.v=3; t.ss.sort='pick'; t.ss.dir='desc'; t.ss.kind='all'; t.ss.asset='all'; t.ss.risk='all'; t.ss.pd='all'; } if(!{pick:1,ret:1,mdd:1,n:1}[t.ss.sort]) t.ss.sort='pick'; return t.ss.sort; }
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
function mkNowLine(s){
  var r=s.r||{}, st=r.state; if(!st) return s.me?'내가 공유한 전략':'';
  var pos=function(){ return ''; };
  if(s.kind==='agent'){ if(st.open.length) return st.open.map(function(o){ return o.k; }).join(', ')+' 보유'; return st.scan&&st.scan.weak?'시장 약세로 대기':'보유 없음, 탐색 중'; }
  if(st.open) return st.open.k+' 보유';
  if(s.kind==='mix') return st.pick?st.pick+' '+mkWaitWhy(st.cond,false)+pos(st.cond,s.cfg.rsiTh):'고를 종목 없음, 대기';
  return mkWaitWhy(st.cond,s.cfg&&s.cfg.tf)+pos(st.cond,s.cfg.rsiTh);
}

function mkSpark3(eq){ var flat=true; for(var i=1;i<eq.length;i++) if(Math.abs(eq[i].v-eq[0].v)>1e-9){ flat=false; break; } if(flat) return '<svg class="mk-spark" viewBox="0 0 72 26" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="13" x2="72" y2="13" stroke="rgba(255,255,255,.34)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>'; return mkSpark(eq,72,26); }
/* ── 카드 ── */
function mkCard(s){
  if(!s.kind) s.kind='rule';
  var r=tfSS3PdCalc(s,'all'), m30=mk30(s), ne=tfSS3Rid(s), ex=mkEx(s);
  var w=(typeof r.winRate==='number'&&isFinite(r.winRate)&&(r.n||0)>=5)?Math.round(r.winRate)+'%':'-';
  var bF='<button type="button" class="mk3-b" onclick="cpSetupGo(\''+ne+'\')">따라가기</button>', bD='<button type="button" class="mk3-b fill" onclick="tfSS3Go(\''+ne+'\')">자세히</button>';
  return '<article class="mk-card mk3 k-'+s.kind+'">'
    +'<div class="mk3-head">'+mkGlyph(s,28)+'<h3><button type="button" class="mk-c-tb mk3-t" onclick="tfSS3Go(\''+ne+'\')">'+gEsc(mkHook(s))+'</button></h3></div>'
    +'<div class="mk3-how"><b>'+MK_KIND[s.kind]+'</b><span>'+gEsc(mkScope(s))+'</span></div>'
    +'<p class="mk-c-one mk3-one">'+gEsc(mkOne(s)).replace(/%(?=[가-힣])/g,'%⁠')+'</p>'
    +'<div class="mk3-now"><small>지금</small><span>'+gEsc(mkNowLine(s))+'</span></div>'
    +'<div class="mk3-perf"><div class="mk-c-ret mk3-ret"><small>30일 수익률</small><b class="num'+mkSign(m30.ret)+'">'+mkPct0(m30.ret)+'</b></div>'+mkSpark3(m30.eq)+'</div>'
    +'<div class="mk-c-stats mk3-stats num"><div><small>최대 낙폭</small><b>'+r.mdd.toFixed(1)+'%</b></div><div><small>승률</small><b>'+w+'</b></div><div><small>거래 수</small><b>'+Number(r.n||0).toLocaleString()+'회</b></div></div>'
    +'<div class="mk3-foot">'+(s.me?'':bF)+bD+'<span class="mk-xtag mk3-x"><img src="assets/logos/'+ex[0]+'.png" alt="" width="14" height="14" loading="lazy">'+ex[1]+'</span></div>'
    +'</article>';
}
function tfSS3GridHtml(){
  var t=tfSSState(), rows=tfSSRows(); mkSortKey(t);
  if(t.ss.asset&&t.ss.asset!=='all') rows=rows.filter(function(s){ return s.mkt===t.ss.asset; });
  if(t.ss.kind&&t.ss.kind!=='all') rows=rows.filter(function(s){ return (s.kind||'rule')===t.ss.kind; });
  if(TF_SS_Q){ var q=TF_SS_Q.toLowerCase(); rows=rows.filter(function(s){ return [s.nick,s.asset,mkTitle(s),s.one||'',MK_KIND[s.kind]||'',mkUni(s).list.join(' ')].join(' ').toLowerCase().indexOf(q)>=0; }); }
  var f={pick:function(a,b){return (a.ord||0)-(b.ord||0);},
    ret:function(a,b){return mk30(b).ret-mk30(a).ret;},
    mdd:function(a,b){return b.r.mdd-a.r.mdd;},
    n:function(a,b){return b.r.n-a.r.n;}}[mkSortKey(t)];
  rows.sort(f);
  if(t.ss.dir==='asc') rows.reverse();
  if(!rows.length) return '<div class="ss3-empty">조건에 맞는 전략이 없어요<br><button type="button" class="mk-btn2" style="margin-top:16px" onclick="tfSS3Reset()">필터 초기화</button></div>';
  var PER=20, MAXP=10;
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
    +'<div class="mk3-kindrow"><div class="mk3-seg" role="group" aria-label="판단 방식">'+[['all','전체'],['agent','직접 탐색'],['rule','조건 실행'],['mix','혼합']].map(function(o){ var on=kind===o[0]; return '<button type="button" aria-pressed="'+on+'" onclick="mkKindPick(\''+o[0]+'\')">'+o[1]+'<i class="num">'+cnt[o[0]]+'</i></button>'; }).join('')+'</div>'
    +'<p class="mk3-kindhelp">'+({all:'직접 탐색은 AI가 종목을 고르고, 조건 실행은 정해 둔 조건만 따르고, 혼합은 둘이 나눠 맡아요.',agent:'여러 종목을 비교해 무엇을 얼마나 들지 AI가 정해요. 시장이 약하면 새로 사지 않아요.',rule:'정해 둔 자산에서 정해 둔 조건이 맞을 때만 사고팔아요.',mix:'거래할 종목은 AI가 고르고, 사고파는 시점은 규칙이 정해요.'}[kind])+'</p></div>'
    +'<div class="mk-flt mk3-flt">'
    +'<div class="mk-chips" aria-label="정렬"><span class="lb">정렬</span>'+[['ret','30일 수익률'],['mdd','낙폭 낮은 순'],['n','거래 수']].map(function(o){ var on=sort===o[0]; return '<button type="button" class="mk-chip'+(on?' on':'')+'" aria-pressed="'+on+'" onclick="tfSS3SortPick(\''+o[0]+'\')">'+o[1]+(on&&o[0]!=='mdd'?(t.ss.dir==='asc'?' ↑':' ↓'):'')+'</button>'; }).join('')+'</div>'
    +tfBkDrop('ss3-m-asset',[['all','시장 전체'],['crypto','가상자산'],['stock','미국 주식'],['index','지수와 금'],['multi','여러 시장']],t.ss.asset||'all','mkMktPick')
    +'<button type="button" class="mk-search-toggle" aria-label="전략 검색" aria-expanded="false" onclick="tfMkSearchToggle(this)">⌕</button><label class="ss3-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>'
    +'<input id="ss3-q" type="search" placeholder="이름, 종목, 판단 방식 검색" value="'+gEsc(TF_SS_Q||'')+'" aria-label="전략 검색" oninput="tfSS3Search(this.value)"></label>'
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
    head=st.open.length?st.open.length+'종목 보유 중':(st.scan.weak?'시장 약세로 대기 중':'살 종목을 찾는 중');
    rows+=row('지금 든 것',st.open.length?st.open.map(function(o){ return '<b>'+gEsc(o.k)+'</b> 자산의 '+Math.round(o.w*100)+'%, <i class="num'+mkSign(o.chg)+'">'+mkPct0(o.chg)+'</i>'; }).join('<br>'):'없음, 현금 '+Math.round(st.cash*100)+'%');
    rows+=row('다음 재평가',mkMD(st.nextEval)+' 장 마감'+(st.lastEval<end?', 마지막 재평가 '+mkMD(st.lastEval):''));
    rows+=row('보는 종목','<span class="mk3-ulist">'+st.scan.rows.map(function(x){ return '<span class="'+(x.held?'h':x.ok?'c':'')+'"><b>'+x.rank+'</b>'+gEsc(x.k)+'<i class="num">'+mkPct0(x.mom,0)+'</i><em>'+(x.held?'보유':x.ok?'후보':x.above?'기준 미달':'평균 아래')+'</em></span>'; }).join('')+'</span><span class="mk3-gauge-t">숫자는 최근 '+c.look+'일 오름폭, 순서는 오름폭을 흔들림으로 나눈 값이에요. 60일 평균 가격보다 낮은 종목(평균 아래)은 사지 않아요.</span>');
  } else if(s.kind==='mix'){
    var step=st.open?3:st.pick?2:1, q=st.cond;
    head=st.open?gEsc(st.open.k)+' 보유 중':st.pick?gEsc(st.pick)+' '+mkWaitWhy(q,false)+' 중':'고를 종목을 찾는 중';
    rows+='<ol class="mk3-steps"><li class="'+(step===1?'on':'done')+'"><small>AI</small><b>종목 고르기</b><span>'+(st.pick?gEsc(st.pick):'오름세 종목 없음')+'</span></li><li class="'+(step===2?'on':step>2?'done':'')+'"><small>규칙</small><b>반등 기다리기</b><span>'+(step===2?mkWaitWhy(q,false):step>2?'조건 충족':'')+'</span></li><li class="'+(step===3?'on':'')+'"><small>규칙</small><b>보유와 정리</b><span>'+(st.open?'<i class="num'+mkSign(st.open.chg)+'">'+mkPct0(st.open.chg)+'</i>, '+st.open.held+'일째':'')+'</span></li></ol>';
    if(st.top&&st.top.length&&st.topAt!=null) rows+=row('고를 때 본 것',mkMD(st.topAt)+'에 비교한 '+c.look+'일 오름폭. '+st.top.map(function(x){ return gEsc(x.k)+' <i class="num">'+mkPct0(x.mom,0)+'</i>'; }).join(', '));
    if(st.open) rows+=row('정리 조건','+'+c.tp+'% 또는 '+c.sl+'%, 아니면 '+Math.max(0,25-st.open.held)+'일 뒤');
    else if(q) rows+=mkCondRows(q,c,row);
    rows+=row('다음 일정','규칙 확인 '+mkMD(end+1)+(st.open?'':', 종목 재선택 '+mkMD(st.nextEval)));
  } else {
    var q2=st.cond;
    if(st.open){ head=gEsc(st.open.k)+' 보유 중'; rows+=row('진입',mkMD(st.open.entry)+', '+mkPxFmt(st.open.ep)); rows+=row('지금 손익','<i class="num'+mkSign(st.open.chg)+'">'+mkPct0(st.open.chg)+'</i>, '+st.open.held+'일째'); rows+=row('정리 조건','+'+c.tp+'% 또는 '+c.sl+'%, 아니면 '+Math.max(0,25-st.open.held)+'일 뒤'); }
    else { head=mkWaitWhy(q2,c.tf)+' 중'; rows+=mkCondRows(q2,c,row); }
    rows+=row('다음 확인',mkMD(end+1)+' 장 마감');
  }
  return '<section class="mk3-panel mk3-nowp"><div class="mk3-nowh"><h3>지금</h3><span class="mk3-asof num">'+mkMD(end)+' 장 마감 기준</span></div><p class="mk3-state">'+head+'</p>'+rows+'</section>';
}
function mk3Head(s,ne,pd,watching){
  watching=(tfS().watch||[]).indexOf(s.nick)>=0; /* 어떤 주소로 들어와도 현재 이름으로 판정 */
  var ex=mkEx(s);
  return '<header class="mk-d-head mk3-dh">'
    +'<div class="mk3-dh-top">'+mkGlyph(s,44)+'<div class="mk3-dh-t"><h2>'+gEsc(mkHook(s))+'</h2><p><b>'+(MK_KIND[s.kind]||'조건 실행')+'</b><span>'+gEsc(mkScope(s))+'</span></p></div>'
    +'<button type="button" class="mkd-ic" aria-label="링크 복사" onclick="tfSS3CopyLink(\''+ne+'\',\''+pd+'\')"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8 11l8-4M8 13l8 4"/></svg></button>'
    +(s.me?'':'<button type="button" class="mkd-fav" aria-pressed="'+watching+'" onclick="tfSS3WatchTgl(\''+ne+'\');mkWatchSync(\''+ne+'\')">★ 즐겨찾기</button>')+'</div>'
    +'<p class="mk3-dh-one">'+gEsc(mkOne(s))+'</p>'
    +'<div class="mk-d-acts mk3-dh-acts">'
    +(s.me?'<span class="ss3-st">내가 공유한 전략</span>':'<button type="button" class="mk-pri" onclick="cpSetupGo(\''+ne+'\')">따라가기</button>')
    +'<span class="mk3-dh-meta"><span class="mk-xtag"><img src="assets/logos/'+ex[0]+'.png" alt="" width="16" height="16">'+ex[1]+'</span><span>최소 '+mkMin(s)+' USDT</span><span>'+mkdSince(s)+' 시작</span></span>'
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
  var does=mkDoes(s), how=mkHowRows(s), evs=mkEvFold(mkEvents(s,R0),4);
  return '<div class="mk3-ov">'
    +'<div class="mk3-two">'+mkNowPanel(s,R0)+'<section class="mk3-panel mk3-does"><h3>하는 일</h3>'+does.map(function(d){ return '<div class="mk3-kv"><small>'+d[0]+'</small><span>'+gEsc(d[1])+'</span></div>'; }).join('')+'</section></div>'
    +'<section class="mk3-sec"><h3>움직이는 방식</h3><div class="mk3-how4">'+how.map(function(h){ return '<div><small>'+h[0]+'</small><p>'+gEsc(h[1])+'</p></div>'; }).join('')+'</div></section>'
    +'<section class="mk3-sec"><div class="mk3-sec-h"><h3>최근 판단</h3><button type="button" class="mk-lnk" onclick="tfSS3Go(\''+ne+'\',\''+pd+'\',\'log\')">전체 기록</button></div>'
    +(evs.length?'<ol class="mk3-evs">'+evs.map(function(e,i){ return mkEvRow(e,i===0); }).join('')+'</ol>':'<p class="mt2">아직 기록이 없어요</p>')+'</section>'
    +'<section class="mk3-sec"><h3>성과</h3>'
    +'<div class="mk3-kpis num"><div><small>30일 수익률</small><b class="'+mkSign(m30.ret).trim()+'">'+mkPct0(m30.ret)+'</b></div><div><small>최대 낙폭</small><b>'+R0.mdd.toFixed(1)+'%</b></div><div><small>승률</small><b>'+w+'</b></div><div><small>거래 수</small><b>'+Number(R0.n||0).toLocaleString()+'회</b></div></div>'
    +chart+'<p class="mk3-since num">'+mkdSince(s)+' 시작 이후 '+mkPct0(R0.ret)+'</p></section>'
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
function mkTradesTab(s,r,pd,ne){ return mkPdChips(ne,pd,'trades')+'<div class="mk-sec-hd"><b>체결 이력</b><span class="mt2">'+mkPdLabel(pd)+', '+r.n+'건, 비용 반영</span></div>'+mkTradesTable(s,r,0); }
function mkInfoTab(s,r,ne){
  var a=(r.params&&r.params.startI!=null)?r.params.startI:61, b=PRICE0.length-1;
  var row=function(k,v){ return '<div class="mk-info-r"><small>'+k+'</small><span>'+v+'</span></div>'; };
  return '<div class="mk-info">'
    +row('판단 방식',MK_KIND[s.kind]||'조건 실행')
    +row('거래 대상',gEsc(s.cfg&&s.cfg.uni?mkUni(s).list.join(', '):(CPP_PAIR[s.asset]||s.asset)))
    +row('실행 거래소',mkEx(s)[1])
    +row('판단 주기','하루 한 번, 장 마감')
    +row('기록 기간',mkDate(a)+' ~ '+mkDate(b)+' ('+Math.max(1,Math.round((b-a)/30.44))+'개월)')
    +row('비용',s.cfg?'체결 금액의 0.1% 반영':'거래당 0.2% 반영')
    +row('만든 곳',s.me?gEsc(s.nick)+' (나)':'TETH')
    +'</div>';
}
function mkdSince(s){ var e=s.r&&s.r.eq; return e&&e.length?mkDate(e[0].i):'-'; }
function mkMin(s){ var c=s.cfg; if(c&&c.kind==='agent') return c.top>=3?500:c.top===2?300:200; var sl=c&&c.sl!=null?Math.abs(c.sl):(s.p?Math.abs(s.p.sl):5); return sl>=8?500:sl>=5?200:100; }
function mkAi(s){ return ['rsi',s.name||'TETH']; }
/* 성과 탭: 기간을 고르면 같은 계산기를 그 구간으로 다시 돌린다 */
function mkPerfTab(s,r,pd,ne){
  var up=r.ret>=0, wl=(r.n||0)>=5?Math.round(r.winRate)+'%':'-';
  return mkPdChips(ne,pd,'perf')
    +'<div class="mk-kpis four">'
    +'<div class="mk-kpi"><small>수익률</small><b class="num '+(up?'mk-up':'mk-dn')+'">'+mkPct(r.ret)+'</b></div>'
    +'<div class="mk-kpi"><small>최대 낙폭</small><b class="num">'+r.mdd.toFixed(1)+'%</b></div>'
    +'<div class="mk-kpi"><small>승률</small><b class="num">'+wl+'</b></div>'
    +'<div class="mk-kpi"><small>거래 수</small><b class="num">'+r.n+'회</b></div>'
    +'</div>'
    +(r.mdd<0&&r.mddStartI!=null?'<p class="mk3-since num">최대 낙폭은 '+mkDate(r.mddStartI)+'부터 '+mkDate(r.mddEndI)+'까지의 하락이에요</p>':'')
    +'<section class="mk-sec"><div class="mk-sec-hd"><b>누적 수익 곡선</b><span class="mt2">'+mkPdLabel(pd)+'</span></div>'
    +'<div class="ss3-bigwrap" id="ss3-bigchart">'+tfSS3Chart(r.eq,1216,360)+'<div class="ss3-xtip" id="ss3-xtip" hidden></div></div>'
    +tfSS3DD(r.eq,1216,120)+'</section>'
    +'<section class="mk-sec"><div id="ss3-cal-host">'+tfSS3CalHtml(r,0)+'</div></section>'
    +'<details class="mk-det"><summary>자세히<span class="mt2">보유기간 분포, 연도별 손익, 체결 이력</span></summary>'
    +tfSS3HoldHtml(r)
    +'<div class="mk-sec-hd mk-det-hd"><b>연도별 손익</b></div>'+tfSS3YearBars(r.byYear||{},1216,200)
    +'<div class="mk-sec-hd mk-det-hd"><b>체결 이력</b><span class="mt2">최근 12건</span></div>'+mkTradesTable(s,r,12)
    +'</details>';
}

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
function mkFollowLine(s){ var c=s.cfg||{}; if(!s.cfg) return (MK_KIND[s.kind]||'조건 실행')+', '+mkScope(s); return MK_KIND[s.kind]+', '+mkScope(s)+', '+(s.kind==='agent'?(c.every===1?'매일':c.every+'일마다')+' 종목을 다시 비교':s.kind==='mix'?c.every+'일마다 종목을 고르고 매일 조건 확인':'매일 조건 확인'); }

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
  cp.copies.forEach(function(c){ if(c.status==='active'&&c.winding){ var d=cpCalc(c); if(!d.missing&&!d.posOpen) cpClose(c.id,true); } });
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
  c2.flatI=s2.r.eq[s2.r.eq.length-1].i; /* 이후 손익 계산 구간을 여기서 고정 */
  tfTrack('cp_flat',{id:cid});
  if(c2.winding){ cpClose(cid); return; } /* 남은 포지션이 없으니 여기서 정산 */
  tfSaveNow(); tfSS3DlgClose();
  toast('포지션을 정리했어요. 다음 진입부터 다시 따라갑니다');
  cpDetailView(cid,'pos');
}
/* 따라가는 중 화면을 열 때 정리 대기 계정을 확인한다 */
var mkHub0=tfShareHub; tfShareHub=function(){ try{ mkWindCheck(); }catch(e){} return mkHub0.apply(this,arguments); };
/* 즐겨찾기: 저장 상태에서 머리글 버튼과 더 보기 버튼을 함께 맞춘다 */
function mkWatchSync(ne){
  var nick; try{ nick=decodeURIComponent(ne); }catch(e){ nick=ne; }
  var s=tfSSFind(nick), on=(tfS().watch||[]).indexOf(s?s.nick:nick)>=0;
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
