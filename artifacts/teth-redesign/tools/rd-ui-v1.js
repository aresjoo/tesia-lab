/* ═══ 판단 방식 중심 목록과 상세 (rd) ═══
   이 블록은 같은 이름의 앞선 함수를 대체한다(뒤에 선언된 함수가 쓰인다).
   세 가지 판단 방식: agent(직접 탐색), rule(조건 실행), mix(혼합). 화면의 상태, 판단 기록, 성과는 모두 계산 결과(r)에서 읽는다. */
var MK_VAR=window.MK_VAR||{name:'C',id:'B1',cta:'P1'}; /* 비교 렌더용 변형 스위치 */
var MK_KIND={agent:'직접 탐색',rule:'조건 실행',mix:'혼합'};
var MK_MKT={crypto:'가상자산',stock:'미국 주식',index:'지수와 금',multi:'여러 시장'};
/* 날짜 기준: 마지막 봉이 어제가 되게 맞춘다. 가격, 판단 기록, 기간 계산이 모두 봉 번호를 쓰므로 함께 움직인다 */
var MK_D0=null;
function idxToDate(i){ if(!MK_D0){ var n=new Date(); MK_D0=new Date(n.getFullYear(),n.getMonth(),n.getDate()); MK_D0.setDate(MK_D0.getDate()-PRICE0.length); } var t=new Date(MK_D0.getTime()); t.setDate(t.getDate()+i); return t; }
function mkMD(i){ var d=idxToDate(i); return (d.getMonth()+1)+'월 '+d.getDate()+'일'; }
function mkUni(s){ return MK_UNI[s.uni]||{label:s.asset||'',list:[]}; }
function mkScope(s){ return s.kind==='rule'?s.asset:mkUni(s).label; }

/* ── 데이터 ── */
function mkRunCfg(c,startI){
  if(c.kind==='agent') return mkAgentRun({uni:MK_UNI[c.uni].list,look:c.look,top:c.top,gate:c.gate,every:c.every,trail:c.trail,volT:c.volT,minS:c.minS,startI:startI!=null?startI:c.startI});
  if(c.kind==='mix') return mkHybridRun({uni:MK_UNI[c.uni].list,every:c.every,look:c.look,rsiTh:c.rsiTh,tp:c.tp,sl:c.sl,gate:c.gate,startI:startI!=null?startI:c.startI});
  return runBacktest({sl:c.sl,tp:c.tp,rsiTh:c.rsiTh,trendFilter:!!c.tf,startI:startI!=null?startI:c.startI,endI:PRICE0.length-1,px:c.asset,fill:'close'});
}
function mkNameOf(c){ return c['n'+MK_VAR.name]||c.nC; }
function tfRankSeeds(){
  if(TF_SEEDS) return TF_SEEDS;
  TF_SEEDS=MK_CAT.map(function(c,k){
    var r=mkRunCfg(c), nm=mkNameOf(c);
    var p=c.kind==='rule'?{sl:c.sl,tp:c.tp,rsiTh:c.rsiTh,trendFilter:!!c.tf,startI:c.startI,endI:PRICE0.length-1,px:c.asset,fill:'close'}:null;
    return {id:c.id,ord:k+1,kind:c.kind,mkt:c.mkt,nick:nm,name:nm,one:c.one,asset:c.kind==='rule'?c.asset:MK_UNI[c.uni].label,uni:c.uni||null,cfg:c,ex:c.ex,av:c.av,p:p,fw:c.fw,score:tfScore(r),ret:r.ret,mdd:r.mdd,n:r.n,r:r};
  });
  return TF_SEEDS;
}
function tfSSRows(){
  if(!TF_SS_CACHE) TF_SS_CACHE=tfRankSeeds().map(function(s){ var o={}; for(var k in s) o[k]=s[k]; return o; });
  var t=tfSSState(), rows=TF_SS_CACHE.slice();
  if(t.shared&&t.sharedSnap){
    var sn=t.sharedSnap;
    rows.push({nick:(S.user&&S.user.name)||'나',title:sn.name,desc:sn.desc,asset:sn.asset,kind:'rule',mkt:'crypto',p:sn.p,fw:t.followers||0,score:sn.score,me:true,
      r:sn.p?runBacktest(sn.p):{ret:sn.ret,mdd:sn.mdd,n:sn.n,winRate:sn.winRate||0,eq:null,trades:[],byYear:{},pf:0,avgHold:0,lossCount:0}});
  }
  return rows;
}
function tfSS3PdCalc(s,pd){
  if(pd==='all'||(!s.p&&!s.cfg)) return s.r;
  var days=pd==='1y'?365:730, end=PRICE0.length-1, key=tfSS3Rid(s)+'|'+pd+'|'+(s.id||'')+'|'+(s.p?[s.p.sl,s.p.tp,s.p.rsiTh,s.p.trendFilter?1:0,s.p.startI,s.p.endI,s.p.px||'',s.p.fill||''].join(','):'');
  if(!TF_SS3_PDC[key]){
    if(s.cfg) TF_SS3_PDC[key]=mkRunCfg(s.cfg,Math.max(s.cfg.startI||61,end-days));
    else TF_SS3_PDC[key]=runBacktest({sl:s.p.sl,tp:s.p.tp,rsiTh:s.p.rsiTh,trendFilter:s.p.trendFilter,startI:Math.max(61,s.p.startI||61,s.p.endI-days),endI:s.p.endI,px:s.p.px,fill:s.p.fill});
  }
  return TF_SS3_PDC[key];
}
function mkSortKey(t){ if(t.ss.v!==3){ t.ss.v=3; t.ss.sort='pick'; t.ss.dir='desc'; t.ss.kind='all'; t.ss.asset='all'; t.ss.risk='all'; t.ss.pd='all'; } if(!{pick:1,ret:1,mdd:1,n:1}[t.ss.sort]) t.ss.sort='pick'; return t.ss.sort; }
function mkMktPick(v){ var t=tfSSState(); t.ss.asset=v; tfSave(); tfShareHub('find'); }

/* ── 식별 표현 ── */
function mkHash(str){ var h=0; str=String(str); for(var i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))>>>0; return h; }
/* B1: 전략의 고정 값으로 그리는 도식. 상태가 바뀌어도 그림은 같다 */
function mkGlyphB1(s,z){
  var c=s.cfg||{}, o='', W='#e9ebee', D='rgba(233,235,238,.30)', h=mkHash(s.id||s.nick);
  if(s.kind==='agent'){
    var n=mkUni(s).list.length, cols=n<=3?3:n<=6?3:4, rows=Math.ceil(n/cols), gx=n<=3?8:cols===3?8:6.4, gy=rows===1?0:rows===2?9:7, x0=14-(cols-1)*gx/2, y0=14-(rows-1)*gy/2, top=c.top||1, pick={};
    for(var q=0;q<top;q++) pick[(h+q*3)%n]=1;
    for(var i=0;i<n;i++){ var x=x0+(i%cols)*gx, y=y0+Math.floor(i/cols)*gy; o+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+(pick[i]?2.6:1.5)+'" fill="'+(pick[i]?W:D)+'"/>'; }
  } else if(s.kind==='mix'){
    var ps=(h%3); for(var j=0;j<3;j++) o+='<circle cx="6.5" cy="'+(7+j*7)+'" r="'+(j===ps?2.6:1.5)+'" fill="'+(j===ps?W:D)+'"/>';
    o+='<path d="M10.5 '+(7+ps*7)+'H13" stroke="'+W+'" stroke-width="1.4" stroke-linecap="round"/>';
    o+='<path d="M14 9l3.2 8 2.6-3.4 3.2-5" fill="none" stroke="'+W+'" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 19.5h10" stroke="'+D+'" stroke-width="1.2" stroke-dasharray="1.6 1.8"/>';
  } else {
    var dep=Math.max(3,Math.min(11,(60-(c.rsiTh||40))/3.2)), yb=8, yl=yb+dep, tp=Math.max(2,Math.min(9,(c.tp||8)/2.2));
    o+='<path d="M4 '+(yl-1.5).toFixed(1)+'h20" stroke="'+D+'" stroke-width="1.2" stroke-dasharray="1.6 1.8"/>';
    o+='<path d="M4 '+yb+'l5 '+(dep*0.55).toFixed(1)+' 4 '+(dep*0.75).toFixed(1)+' 4.500 -'+(dep*0.5).toFixed(1)+' 6 -'+tp.toFixed(1)+'" fill="none" stroke="'+W+'" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>';
    o+='<circle cx="17.5" cy="'+(yb+dep*0.8).toFixed(1)+'" r="2" fill="'+W+'"/>';
  }
  return '<svg class="mk3-g" width="'+z+'" height="'+z+'" viewBox="0 0 28 28" aria-hidden="true"><rect x=".5" y=".5" width="27" height="27" rx="7" fill="#1a1d21" stroke="rgba(255,255,255,.14)"/>'+o+'</svg>';
}
/* B2: TETH 로고의 두 고리에서 파생한 고정 기호. 간격, 크기, 끊김 위치로 구별 */
function mkGlyphB2(s,z){
  var h=mkHash((s.id||s.nick)+'b2'), W='#e9ebee', r1=5+(h%3), r2=5+((h>>>3)%3), dx=3.2+((h>>>6)%4)*0.9, a1=(h>>>9)%6*60, a2=(h>>>13)%6*60, g1=6+((h>>>17)%3)*4, g2=6+((h>>>20)%3)*4;
  var ring=function(cx,r,rot,gap){ var c=2*Math.PI*r; return '<circle cx="'+cx.toFixed(1)+'" cy="14" r="'+r+'" fill="none" stroke="'+W+'" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="'+(c-gap).toFixed(1)+' '+gap+'" transform="rotate('+rot+' '+cx.toFixed(1)+' 14)"/>'; };
  return '<svg class="mk3-g" width="'+z+'" height="'+z+'" viewBox="0 0 28 28" aria-hidden="true"><rect x=".5" y=".5" width="27" height="27" rx="7" fill="#1a1d21" stroke="rgba(255,255,255,.14)"/>'+ring(14-dx,r1,a1,g1)+ring(14+dx,r2,a2,g2)+'</svg>';
}
function mkGlyph(s,z){
  z=z||28;
  if(s.me||!s.kind||!s.id) return '<img class="mk3-g mk3-ga" src="assets/avatars/rsi.svg" alt="" width="'+z+'" height="'+z+'">';
  if(MK_VAR.id==='A') return '<img class="mk3-g mk3-ga" src="assets/avatars/'+s.av+'.svg" alt="" width="'+z+'" height="'+z+'">';
  return MK_VAR.id==='B2'?mkGlyphB2(s,z):mkGlyphB1(s,z);
}

/* ── 현재 상태 한 줄 (카드) ── */
function mkNowLine(s){
  var r=s.r||{}, st=r.state;
  if(s.kind==='agent'&&st){ if(st.open.length) return st.open.map(function(o){ return o.k; }).join(', ')+' 보유'; return st.scan&&st.scan.weak?'시장 약세로 대기':'보유 없음, 탐색 중'; }
  if(s.kind==='mix'&&st){ if(st.open) return st.open.k+' 보유'; return st.pick?st.pick+' 반등 대기':'고를 종목 없음, 대기'; }
  if(s.p){ return mkWithPx(s.p.px,function(){ var q=mkOpenPos(s.p,r); return q?s.asset+' 보유':'조건 대기'; }); }
  return '';
}
function mkPct0(v,d){ var x=+v.toFixed(d!=null?d:1); return (x>0?'+':'')+x.toFixed(d!=null?d:1)+'%'; }
function mkSign(v){ var x=+v.toFixed(1); return x>0?' mk-up':x<0?' mk-dn':''; }

/* ── 카드 ── */
function mkCard(s){
  if(!s.kind) s.kind='rule';
  var r=tfSS3PdCalc(s,'all'), m30=mk30(s), ne=tfSS3Rid(s), ex=mkEx(s);
  var w=(typeof r.winRate==='number'&&isFinite(r.winRate)&&(r.n||0)>=5)?Math.round(r.winRate)+'%':'-';
  var cta=MK_VAR.cta, bF='<button type="button" class="mk3-b'+(cta==='P0'?' lime':cta==='P2'?' fill':'')+'" onclick="cpSetupGo(\''+ne+'\')">따라가기</button>', bD='<button type="button" class="mk3-b'+(cta==='P1'?' fill':'')+'" onclick="tfSS3Go(\''+ne+'\')">자세히</button>';
  return '<article class="mk-card mk3 k-'+s.kind+'">'
    +'<div class="mk3-head">'+mkGlyph(s,28)+'<h3><button type="button" class="mk-c-tb mk3-t" onclick="tfSS3Go(\''+ne+'\')">'+gEsc(mkHook(s))+'</button></h3></div>'
    +'<div class="mk3-how"><b>'+MK_KIND[s.kind]+'</b><span>'+gEsc(mkScope(s))+'</span></div>'
    +'<p class="mk-c-one mk3-one">'+gEsc(mkOne(s)).replace(/%(?=[가-힣])/g,'%⁠')+'</p>'
    +'<div class="mk3-now"><small>지금</small><span>'+gEsc(mkNowLine(s))+'</span></div>'
    +'<div class="mk3-perf"><div class="mk-c-ret mk3-ret"><small>30일 수익률</small><b class="num'+mkSign(m30.ret)+'">'+mkPct0(m30.ret)+'</b></div>'+mkSpark(m30.eq,72,26)+'</div>'
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
    +'<div class="mk3-seg" role="group" aria-label="판단 방식">'+[['all','전체'],['agent','직접 탐색'],['rule','조건 실행'],['mix','혼합']].map(function(o){ var on=kind===o[0]; return '<button type="button" aria-pressed="'+on+'" onclick="mkKindPick(\''+o[0]+'\')">'+o[1]+'<i class="num">'+cnt[o[0]]+'</i></button>'; }).join('')+'</div>'
    +'<p class="mk3-kindhelp">'+({all:'AI가 거래 대상을 직접 고르는지, 정해 둔 조건만 실행하는지, 둘을 나눠 맡는지로 구분해요.',agent:'여러 종목을 비교해 무엇을 얼마나 들지 AI가 정해요. 시장이 약하면 쉬어요.',rule:'정해 둔 자산에서 정해 둔 조건이 맞을 때만 사고팔아요.',mix:'거래할 종목은 AI가 고르고, 사고파는 시점은 규칙이 정해요.'}[kind])+'</p>'
    +'<div class="mk-flt mk3-flt">'
    +'<div class="mk-chips" aria-label="정렬"><span class="lb">정렬</span>'+[['ret','30일 수익률'],['mdd','낙폭 낮은 순'],['n','거래 수']].map(function(o){ var on=sort===o[0]; return '<button type="button" class="mk-chip'+(on?' on':'')+'" aria-pressed="'+on+'" onclick="tfSS3SortPick(\''+o[0]+'\')">'+o[1]+(on&&o[0]!=='mdd'?(t.ss.dir==='asc'?' ↑':' ↓'):'')+'</button>'; }).join('')+'</div>'
    +tfBkDrop('ss3-m-asset',[['all','시장 전체'],['crypto','가상자산'],['stock','미국 주식'],['index','지수와 금'],['multi','여러 시장']],t.ss.asset||'all','mkMktPick')
    +'<button type="button" class="mk-search-toggle" aria-label="전략 검색" aria-expanded="false" onclick="tfMkSearchToggle(this)">⌕</button><label class="ss3-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>'
    +'<input id="ss3-q" type="search" placeholder="이름, 종목, 판단 방식 검색" value="'+gEsc(TF_SS_Q||'')+'" aria-label="전략 검색" oninput="tfSS3Search(this.value)"></label>'
    +'</div></div>';
}
function mkHero(){
  setTimeout(function(){ mkhGo(MKH_I); mkhStart(); },0);
  var slide=function(i,cls,act,sm,b,sp,extra){ return '<button type="button" class="mkh-slide '+cls+(i===MKH_I?' on':'')+'" onclick="'+act+'"><small>'+sm+'</small><b>'+b+'</b><span>'+sp+'</span>'+(extra||'')+'</button>'; };
  return '<section class="mkh" aria-label="전략 따라하기 소개">'
    +'<div><h2>전략 따라하기</h2><p class="mkh-sub">어떤 방식으로 판단하는 AI에게 거래를 맡길지 골라요.</p>'
    +'<button type="button" class="mkh-note" onclick="tfBrokersView()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10v4h3l5 4V6L6 10H3z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/></svg><span>OKX 거래소 연결이 추가됐어요</span></button></div>'
    +'<div class="mkh-ban"><div class="mkh-view">'
    +slide(0,'mkh-s2 mkh-k',"mkKindPick('all')",'판단 방식 세 가지','직접 고르는 AI,<br>조건만 실행하는 전략','무엇을 보고 언제 움직이는지 기록으로 남겨요','<i class="mkh-cta">판단 방식으로 고르기</i>')
    +slide(1,'mkh-s1',"tfShareHub('mine')",'10월 전략 리그','총상금 <em>1,000,000 USDT</em>','10월 1일 시작, 수익률 상위 전략에 상금','<i class="mkh-cta">내 전략 공개하기</i><span class="mkh-pod" aria-hidden="true"><i>2</i><i>1</i><i>3</i></span>')
    +slide(2,'mkh-s3',"tfBrokersView()",'Powered by Bitget','Bitget 계정 하나로<br>주식, 옵션, 암호화폐','출금 권한 없이 주문 권한만 연결해요','<i class="mkh-cta">거래소 연결하기</i><img src="assets/logos/bitget-512.png" alt="" width="92" height="92">')
    +'</div><div class="mkh-dots" role="group" aria-label="배너 선택">'+[0,1,2].map(function(i){ return '<button type="button" aria-label="배너 '+(i+1)+'" aria-current="'+(i===MKH_I)+'" onclick="mkhPick('+i+')"></button>'; }).join('')+'</div></div>'
    +'</section>';
}

/* ── 판단 기록: 본 것, 판단, 행동 ── */
/* 조사: 받침 유무에 따라 고른다 */
function mkJ(w,a,b){ var c=String(w).charCodeAt(String(w).length-1); if(c<0xAC00||c>0xD7A3) return w+a; return w+(((c-0xAC00)%28)?a:b); }
function mkTopTxt(top){ return (top||[]).slice(0,2).map(function(x){ return x.k+'('+mkPct0(x.mom,0)+')'; }).join(', '); }
var MK_WHY={trail:'든 뒤 고점에서 많이 밀렸어요',weak:'오르던 힘이 꺾였어요',rot:'더 강한 종목이 나타났어요',sl:'손절 기준까지 밀렸어요',tp:'목표까지 올랐어요',time:'25일을 채웠어요'};
function mkEvAgent(s,e){
  var c=s.cfg, per=c.look+'일';
  if(e.t==='enter') return {k:'buy',obs:e.of+'종 중 '+e.up+'종이 오름세. 가장 강한 건 '+mkTopTxt(e.top),dec:mkJ(e.a,'을','를')+' 새로 고름',act:'자산의 '+Math.round(e.w*100)+'%로 매수, 체결가 '+mkPxFmt(e.px)};
  if(e.t==='exit') return {k:'sell',obs:e.a+', '+MK_WHY[e.why],dec:e.why==='rot'?'다른 종목으로 교체':'보유를 끝냄',act:'전량 매도, 체결가 '+mkPxFmt(e.px)+', 손익 '+mkPct0(e.pnl)};
  if(e.t==='skip'&&e.why==='gate') return {k:'wait',obs:e.of+'종 중 '+e.up+'종만 오름세',dec:'시장이 약하다고 보고 새로 사지 않음',act:e.held.length?e.held.join(', ')+' 보유 유지':'주문 없음'};
  if(e.t==='skip') return {k:'wait',obs:'기준을 넘는 종목이 없음. 가장 강한 건 '+mkTopTxt(e.top),dec:'새로 사지 않음',act:e.held.length?e.held.join(', ')+' 보유 유지':'주문 없음'};
  return {k:'hold',obs:'보유 종목이 여전히 상위. 가장 강한 건 '+mkTopTxt(e.top),dec:'바꾸지 않음',act:e.held.join(', ')+' 보유 유지'};
}
function mkEvMix(s,e){
  var c=s.cfg;
  if(e.t==='pick') return {k:'pick',who:'AI',obs:mkUni(s).label+' 중 '+c.look+'일 동안 가장 많이 오른 건 '+mkTopTxt(e.top),dec:mkJ(e.a,'을','를')+' 거래 대상으로 고름',act:'규칙이 반등을 기다리기 시작'};
  if(e.t==='unpick') return {k:'wait',who:'AI',obs:'오름세인 종목이 없음',dec:'거래 대상을 비움',act:'주문 없음'};
  if(e.t==='veto') return {k:'wait',who:'AI',obs:e.a+' 반등 신호 발생. 그런데 '+e.of+'종 중 '+e.up+'종만 오름세',dec:'시장이 약해 진입을 보류',act:'주문 없음'};
  if(e.t==='enter') return {k:'buy',who:'규칙',obs:mkJ(e.a,'이','가')+' 밀렸다가 '+mkPct0(e.bounce)+' 반등',dec:'진입 조건 충족',act:'매수, 체결가 '+mkPxFmt(e.px)};
  return {k:'sell',who:'규칙',obs:e.a+' 진입가 대비 '+mkPct0(e.chg)+'. '+MK_WHY[e.why],dec:e.why==='tp'?'익절':e.why==='sl'?'손절':'기간 청산',act:'전량 매도, 체결가 '+mkPxFmt(e.px)+', 손익 '+mkPct0(e.pnl)};
}
/* 조건 실행: 체결 기록에서 사건을 만든다 */
function mkEvRule(s,r){
  var ev=[], P=mkPx(s.p.px);
  (r.trades||[]).forEach(function(t){
    var rv=rsi(P,t.entry-1), bo=(P[t.entry]/P[t.entry-1]-1)*100, chg=(P[t.exit]/P[t.entry]-1)*100;
    ev.push({i:t.entry,k:'buy',obs:mkJ(s.asset,'이','가')+' 충분히 밀린 뒤(하락 강도 '+Math.round(rv)+') '+mkPct0(bo)+' 반등',dec:'진입 조건 충족',act:'매수, 체결가 '+mkPxFmt(P[t.entry])});
    ev.push({i:t.exit,k:'sell',obs:s.asset+' 진입가 대비 '+mkPct0(chg)+'. '+MK_WHY[t.kind],dec:t.kind==='tp'?'익절':t.kind==='sl'?'손절':'기간 청산',act:'전량 매도, 체결가 '+mkPxFmt(P[t.exit])+', 손익 '+mkPct0(t.pnl*100)});
  });
  var o=mkWithPx(s.p.px,function(){ return mkOpenPos(s.p,r); });
  if(o) ev.push({i:o.entry,k:'buy',obs:mkJ(s.asset,'이','가')+' 충분히 밀린 뒤 반등',dec:'진입 조건 충족',act:'매수, 체결가 '+mkPxFmt(o.entryP)});
  return ev;
}
function mkEvents(s,r){
  if(s.kind==='agent') return (r.events||[]).map(function(e){ var x=mkEvAgent(s,e); x.i=e.i; return x; });
  if(s.kind==='mix') return (r.events||[]).map(function(e){ var x=mkEvMix(s,e); x.i=e.i; return x; });
  if(s.p) return mkEvRule(s,r);
  return [];
}
/* 같은 결론이 이어지면 한 줄로 묶는다(유지, 대기) */
function mkEvRecent(s,r,n){
  var all=mkEvents(s,r), out=[];
  for(var i=all.length-1;i>=0&&out.length<n;i--){ var e=all[i], p=out[out.length-1]; if(p&&(e.k==='hold'||e.k==='wait')&&p.k===e.k&&p.dec===e.dec){ p.from=e.i; p.cnt=(p.cnt||1)+1; continue; } out.push({i:e.i,k:e.k,who:e.who,obs:e.obs,dec:e.dec,act:e.act}); }
  return out;
}
var MK_EVK={buy:'매수',sell:'매도',wait:'대기',hold:'유지',pick:'선택'};
function mkEvRow(e,first){
  return '<li class="mk3-ev'+(first?' first':'')+' e-'+e.k+'"><div class="mk3-ev-d num">'+mkMD(e.i)+(e.cnt?'<small>'+e.cnt+'번 연속</small>':'')+'</div>'
    +'<div class="mk3-ev-b"><b>'+(e.who?'<i>'+e.who+'</i>':'')+gEsc(e.dec)+'</b><span>'+gEsc(e.obs)+'</span><em>'+gEsc(e.act)+'</em></div></li>';
}

/* ── 상세: 하는 일, 지금, 움직이는 방식 ── */
function mkDoes(s){
  var c=s.cfg||{}, u=mkUni(s);
  if(s.kind==='agent') return [['보는 것',u.label+'의 최근 '+c.look+'일 흐름과 흔들림. '+u.list.join(', ')],['AI가 정하는 것','무엇을 살지, 얼마나 살지, 언제 바꿀지. 한 번에 최대 '+c.top+'종목'],['바뀌지 않는 한도','든 뒤 고점에서 '+c.trail+'% 밀리면 팔아요. 오르는 종목이 '+Math.round(c.gate*100)+'% 미만이면 새로 사지 않아요']];
  if(s.kind==='mix') return [['AI가 정하는 것','거래할 종목 하나. '+u.label+' 중 '+c.look+'일 동안 가장 많이 오른 종목을 '+c.every+'일마다 다시 골라요'+(c.gate?'. 시장이 약하면 진입을 보류해요':'')],['규칙이 정하는 것','사는 때와 파는 때. 고른 종목이 밀렸다가 반등하면 사요'],['바뀌지 않는 한도',c.tp+'% 오르거나 '+Math.abs(c.sl)+'% 밀리면 그날 팔아요. 길어도 25일']];
  if(s.p) return [['보는 것',s.asset+' 가격 하나'],['정해 둔 조건',(s.p.rsiTh<=32?'크게':s.p.rsiTh<=44?'깊게':'조금')+' 밀린 뒤 하루 0.5% 넘게 반등하면 사요'+(s.p.trendFilter?'. 가격이 한쪽으로 뚜렷하게 움직이는 때에만':'')],['바뀌지 않는 한도',Math.abs(s.p.tp)+'% 오르거나 '+Math.abs(s.p.sl)+'% 밀리면 그날 팔아요. 길어도 25일']];
  return [];
}
function mkHowRows(s){
  var c=s.cfg||{};
  if(s.kind==='agent') return [['언제 사나',(c.every===1?'매일':c.every+'일마다')+' 종목을 다시 비교해서, 흐름이 가장 강한 종목이 기준을 넘을 때'],['언제 파나','든 종목의 힘이 꺾이거나, 더 강한 종목이 나오거나, 고점에서 '+c.trail+'% 밀릴 때'],['언제 쉬나','오르는 종목이 '+Math.round(c.gate*100)+'%가 안 될 때. 가진 건 두고 새로 사지 않아요'],['얼마나 사나','한 종목에 자산의 최대 '+Math.round(100/c.top)+'%. 많이 흔들리는 종목은 덜 사요']];
  if(s.kind==='mix') return [['누가 고르나','AI가 '+c.every+'일마다 거래할 종목을 다시 골라요. 보유 중에는 바꾸지 않아요'],['언제 사나','고른 종목이 밀렸다가 하루 0.5% 넘게 반등한 날'+(c.gate?'. 단, 오르는 종목이 '+Math.round(c.gate*100)+'% 미만이면 AI가 보류':'')],['언제 파나',c.tp+'% 오르거나 '+Math.abs(c.sl)+'% 밀린 날, 아니면 25일째'],['얼마나 사나','한 번에 한 종목, 가진 금액 전부']];
  if(s.p) return [['언제 사나',mkJ(s.asset,'이','가')+' '+(s.p.rsiTh<=32?'크게':s.p.rsiTh<=44?'깊게':'조금')+' 밀린 다음 날 0.5% 넘게 반등하면'],['언제 파나',Math.abs(s.p.tp)+'% 오르거나 '+Math.abs(s.p.sl)+'% 밀린 날, 아니면 25일째'],['언제 쉬나','조건이 맞지 않는 동안'+(s.p.trendFilter?'. 가격 방향이 애매할 때도 쉬어요':'')],['얼마나 사나','한 번에 가진 금액 전부']];
  return [];
}
function mkNowPanel(s,r){
  var st=r.state, end=PRICE0.length-1, rows='', head='';
  var row=function(k,v){ return '<div class="mk3-kv"><small>'+k+'</small><span>'+v+'</span></div>'; };
  if(s.kind==='agent'&&st){
    head=st.open.length?st.open.length+'종목 보유 중':(st.scan&&st.scan.weak?'시장 약세로 대기 중':'살 종목을 찾는 중');
    rows+=row('보는 범위',gEsc(mkUni(s).label)+', 오르는 종목 '+st.scan.up+' / '+st.scan.of);
    rows+=row('지금 든 것',st.open.length?st.open.map(function(o){ return '<b>'+gEsc(o.k)+'</b> 자산의 '+Math.round(o.w*100)+'%, <i class="num'+mkSign(o.chg)+'">'+mkPct0(o.chg)+'</i>'; }).join('<br>'):'없음, 현금 '+Math.round(st.cash*100)+'%');
    rows+=row('가장 강한 종목',st.scan.top.slice(0,3).map(function(x){ return gEsc(x.k)+' <i class="num">'+mkPct0(x.mom,0)+'</i>'; }).join(', '));
    rows+=row('다음 재평가',mkMD(st.nextEval)+' 장 마감');
  } else if(s.kind==='mix'&&st){
    var step=st.open?3:st.pick?2:1;
    head=st.open?gEsc(st.open.k)+' 보유 중':st.pick?gEsc(st.pick)+' 반등을 기다리는 중':'고를 종목을 찾는 중';
    rows+='<ol class="mk3-steps"><li class="'+(step===1?'on':'done')+'"><small>AI</small><b>종목 고르기</b><span>'+(st.pick?gEsc(st.pick):'오름세 종목 없음')+'</span></li><li class="'+(step===2?'on':step>2?'done':'')+'"><small>규칙</small><b>반등 기다리기</b><span>'+(step===2?(st.rsi<s.cfg.rsiTh?'충분히 밀림, 반등 대기':'아직 덜 밀림'):step>2?'조건 충족':'')+'</span></li><li class="'+(step===3?'on':'')+'"><small>규칙</small><b>보유와 정리</b><span>'+(st.open?'<i class="num'+mkSign(st.open.chg)+'">'+mkPct0(st.open.chg)+'</i>, '+st.open.held+'일째':'')+'</span></li></ol>';
    rows+=row('다음 종목 재선택',st.open?'보유를 정리한 뒤':mkMD(st.nextEval)+' 장 마감');
  } else if(s.p){
    var o=mkOpenPos(s.p,r), e=mkRuleEval(s.p,end);
    if(o){ head=gEsc(s.asset)+' 보유 중'; rows+=row('진입',mkMD(o.entry)+', '+mkPxFmt(o.entryP)); rows+=row('지금 손익','<i class="num'+mkSign(o.chg)+'">'+mkPct0(o.chg)+'</i>, '+o.held+'일째'); rows+=row('정리 조건','+'+Math.abs(s.p.tp)+'% 또는 '+s.p.sl+'%, 아니면 '+(25-o.held>0?(25-o.held)+'일 뒤':'오늘')); }
    else { head='조건을 기다리는 중'; rows+=row('충분히 밀렸나',e.rsiOk?'<b>예</b>':'아직 아니에요'); rows+=row('반등했나',e.bounceOk?'<b>예</b>, 어제 '+mkPct0(e.bounce,2):'아직 아니에요, 어제 '+mkPct0(e.bounce,2)); if(s.p.trendFilter) rows+=row('방향이 뚜렷한가',e.trendOk?'<b>예</b>':'아직 아니에요'); }
    rows+=row('다음 확인',mkMD(end+1)+' 장 마감');
  }
  return '<section class="mk3-panel mk3-nowp"><h3>지금</h3><p class="mk3-state">'+head+'</p>'+rows+'<p class="mk3-asof num">'+mkMD(end)+' 장 마감 기준</p></section>';
}
function mk3Head(s,ne,pd,watching){
  var ex=mkEx(s);
  return '<header class="mk-d-head mk3-dh">'
    +'<div class="mk3-dh-top">'+mkGlyph(s,44)+'<div class="mk3-dh-t"><h2>'+gEsc(mkHook(s))+'</h2><p><b>'+(MK_KIND[s.kind]||'조건 실행')+'</b><span>'+gEsc(mkScope(s))+'</span></p></div>'
    +'<button type="button" class="mkd-ic" aria-label="링크 복사" onclick="tfSS3CopyLink(\''+ne+'\',\''+pd+'\')"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8 11l8-4M8 13l8 4"/></svg></button>'
    +(s.me?'':'<button type="button" class="mkd-fav" aria-pressed="'+watching+'" onclick="tfSS3WatchTgl(\''+ne+'\');this.setAttribute(\'aria-pressed\',String(this.getAttribute(\'aria-pressed\')!==\'true\'))">★ 즐겨찾기</button>')+'</div>'
    +'<p class="mk3-dh-one">'+gEsc(mkOne(s))+'</p>'
    +'<div class="mk-d-acts mk3-dh-acts">'
    +(s.me?'<span class="ss3-st">내가 공유한 전략</span>':'<button type="button" class="mk-pri" onclick="cpSetupGo(\''+ne+'\')">따라가기</button>')
    +'<span class="mk3-dh-meta"><span class="mk-xtag"><img src="assets/logos/'+ex[0]+'.png" alt="" width="16" height="16">'+ex[1]+'</span><span>최소 '+mkMin(s)+' USDT</span><span>'+mkdSince(s)+' 시작</span></span>'
    +'<div class="mk-more"><button type="button" class="mk-more-b" id="mk-menu-b" aria-haspopup="menu" aria-expanded="false" aria-label="더 보기" onclick="mkMenuTgl(event)">⋯</button>'
    +'<div class="mk-menu" id="mk-menu" role="menu" hidden>'
    +'<button type="button" role="menuitem" onclick="tfSS3Ask(\''+ne+'\',\''+pd+'\')">TETH에게 분석시키기</button>'
    +(s.me?'':'<button type="button" role="menuitem" id="ss3-watch-btn" aria-pressed="'+watching+'" onclick="tfSS3WatchTgl(\''+ne+'\')">'+tfSS3WatchLb(watching)+'</button>')
    +'<button type="button" role="menuitem" onclick="tfSS3CopyLink(\''+ne+'\',\''+pd+'\')">링크 복사</button>'
    +(s.me||!s.p?'':'<button type="button" role="menuitem" onclick="tfSS3Copy(\''+ne+'\')">설정 가져오기</button>')
    +'</div></div></div>'
    +'</header>';
}
function mkOvTab(s,r,pd,ne){
  var R0=s.r||r, eq=mkDaily(R0.eq||[],PRICE0.length-1); MKD.eq=eq; MKD.tab='ret'; MKD.gran='day'; MKD.per=30;
  var m30=mk30(s), w=(typeof R0.winRate==='number'&&(R0.n||0)>=5)?Math.round(R0.winRate)+'%':'-';
  var does=mkDoes(s), how=mkHowRows(s), evs=mkEvRecent(s,R0,5);
  return '<div class="mk3-ov">'
    +'<div class="mk3-two"><section class="mk3-panel"><h3>하는 일</h3>'+does.map(function(d){ return '<div class="mk3-kv"><small>'+d[0]+'</small><span>'+gEsc(d[1])+'</span></div>'; }).join('')+'</section>'+mkNowPanel(s,R0)+'</div>'
    +'<section class="mk3-sec"><div class="mk3-sec-h"><h3>최근 판단</h3><button type="button" class="mk-lnk" onclick="tfSS3Go(\''+ne+'\',\''+pd+'\',\'log\')">전체 기록</button></div>'
    +(evs.length?'<ol class="mk3-evs">'+evs.map(function(e,i){ return mkEvRow(e,i===0); }).join('')+'</ol>':'<p class="mt2">아직 기록이 없어요</p>')+'</section>'
    +'<section class="mk3-sec"><h3>움직이는 방식</h3><div class="mk3-how4">'+how.map(function(h){ return '<div><small>'+h[0]+'</small><p>'+gEsc(h[1])+'</p></div>'; }).join('')+'</div></section>'
    +'<section class="mk3-sec"><h3>성과</h3>'
    +'<div class="mk3-kpis num"><div><small>30일 수익률</small><b class="'+mkSign(m30.ret).trim()+'">'+mkPct0(m30.ret)+'</b></div><div><small>최대 낙폭</small><b>'+R0.mdd.toFixed(1)+'%</b></div><div><small>승률</small><b>'+w+'</b></div><div><small>거래 수</small><b>'+Number(R0.n||0).toLocaleString()+'회</b></div><div><small>시작 이후</small><b class="'+mkSign(R0.ret).trim()+'">'+mkPct0(R0.ret)+'</b></div></div>'
    +'<div class="mkd-ctl" id="mkd-ctl">'+mkdCtlHtml()+'</div><p class="mkd-hint" id="mkd-hint"></p><div class="mkd-chart" id="mkd-chart" onpointermove="mkdHover(event)" onpointerdown="mkdHover(event)" onpointerleave="mkdHover(null)">'+mkdChartHtml()+'</div></section>'
    +'</div>';
}
/* 활동 탭: 판단 기록 전체 */
function mkLogTab(s,r){
  var R0=s.r||r, all=mkEvents(s,R0).slice().reverse(), out=[], cur=null;
  all.forEach(function(e){ if((e.k==='hold'||e.k==='wait')&&cur&&cur.k===e.k&&cur.dec===e.dec){ cur.cnt=(cur.cnt||1)+1; return; } cur={i:e.i,k:e.k,who:e.who,obs:e.obs,dec:e.dec,act:e.act}; out.push(cur); });
  if(!out.length) return '<div class="ss3-empty">아직 판단 기록이 없어요</div>';
  return '<div class="mk-sec-hd"><b>판단 기록</b><span class="mt2">'+out.length+'건, 최신순</span></div><ol class="mk3-evs mk3-evs-all">'+out.slice(0,120).map(function(e,i){ return mkEvRow(e,false); }).join('')+'</ol>';
}
function mkTradesTable(s,r,limit){
  var tr=(r.trades||[]).slice(); if(limit) tr=tr.slice(-limit); tr.reverse();
  var KN={sl:'손절',tp:'익절',time:'기간 청산',trail:'고점 이탈',weak:'힘 약화',rot:'종목 교체'};
  return '<div class="mk-tblw"><table class="ss3-tbl"><thead><tr><th>진입일</th><th>청산일</th><th>보유</th><th>자산</th><th>구분</th><th style="text-align:right">진입가</th><th style="text-align:right">청산가</th><th style="text-align:right">손익률</th></tr></thead><tbody>'
    +(tr.length?tr.map(function(x){
      var P=x.asset?null:PRICE, p1=x.ep!=null?x.ep:P[x.entry], p2=x.xp!=null?x.xp:P[x.exit];
      return '<tr><td>'+mkDate(x.entry)+'</td><td>'+mkDate(x.exit)+'</td><td>'+(x.exit-x.entry)+'일</td><td>'+gEsc(x.asset||s.asset)+'</td><td>'+(KN[x.kind]||x.kind)+'</td>'
        +'<td style="text-align:right">'+mkPxFmt(p1)+'</td><td style="text-align:right">'+mkPxFmt(p2)+'</td>'
        +'<td class="'+(x.pnl>=0?'up':'dn')+'" style="text-align:right">'+mkPct(x.pnl*100,2)+'</td></tr>';
    }).join(''):'<tr><td colspan="8" style="text-align:center;height:80px">이 기간에는 체결이 없어요</td></tr>')
    +'</tbody></table></div>';
}
function mkTradesTab(s,r,pd,ne){ return mkPdChips(ne,pd,'trades')+'<div class="mk-sec-hd"><b>체결 이력</b><span class="mt2">'+mkPdLabel(pd)+', '+r.n+'건, 수수료 반영</span></div>'+mkTradesTable(s,r,0); }
function mkInfoTab(s,r,ne){
  var a=(r.params&&r.params.startI!=null)?r.params.startI:61, b=PRICE0.length-1;
  var row=function(k,v){ return '<div class="mk-info-r"><small>'+k+'</small><span>'+v+'</span></div>'; };
  return '<div class="mk-info">'
    +row('판단 방식',MK_KIND[s.kind]||'조건 실행')
    +row('거래 대상',gEsc(s.kind==='rule'||!s.kind?(CPP_PAIR[s.asset]||s.asset):mkUni(s).list.join(', ')))
    +row('실행 거래소',mkEx(s)[1])
    +row('판단 주기','하루 한 번, 장 마감')
    +row('기록 기간',mkDate(a)+' ~ '+mkDate(b)+' ('+Math.max(1,Math.round((b-a)/30.44))+'개월)')
    +row('비용',s.kind==='rule'||!s.kind?'거래당 0.2% 반영':'체결 금액의 0.1% 반영')
    +row('만든 곳',s.me?gEsc(s.nick)+' (나)':'TETH')
    +'</div>';
}
function mkdSince(s){ var e=s.r&&s.r.eq; return e&&e.length?mkDate(e[0].i):'-'; }
function mkMin(s){ if(s.kind==='agent') return (s.cfg.top>=3?500:s.cfg.top===2?300:200); var sl=s.cfg&&s.cfg.sl!=null?Math.abs(s.cfg.sl):(s.p?Math.abs(s.p.sl):5); return (sl>=8?500:sl>=5?200:100); }
function mkAi(s){ return [s.av||'rsi',s.name||'TETH']; }
