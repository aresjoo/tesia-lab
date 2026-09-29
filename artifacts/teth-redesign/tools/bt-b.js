/* ═══ 백테스트 여정 (bt) 2/4: 화면, 준비, 다시 돌리기, 결과 ═══ */
function btHeadHtml(){
  var s=BT.s;
  return '<div class="bt-id">'+mkGlyph(s,40)+'<div class="bt-id-t"><h2>'+gEsc(mkHook(s))+'</h2><p>'+gEsc(mkOne(s))+'</p>'
    +'<div class="bt-id-m"><b>'+MK_KIND[s.kind]+'</b><span>'+gEsc(mkScope(s))+'</span><span>'+mkInstList(s).join(', ')+'</span></div></div></div>';
}
function btSteps(){
  var s=BT.s;
  return [['prep','가격 자료 준비'],['run','하루씩 다시 돌리기'],
    ['chk',s.kind==='agent'?'AI 판단 되짚기':btGate(s)?'기회마다 AI 확인':s.kind==='mix'?'AI 종목 선정과 조건 확인':'사는 조건 확인'],['wrap','결과 정리']];
}
function btLegend(){
  var s=BT.s;
  return '<div class="bt-leg"><span class="a">이 전략</span><span class="b">그냥 들고 있었다면 <i class="num">'+(BT.R?mkPct0(BT.R.benchRet,1):'')+'</i></span><span class="m"><svg width="11" height="10" viewBox="0 0 11 10" aria-hidden="true"><path d="M5.5 1l4.5 8h-9z" fill="#2fb98a"/></svg>매수</span><span class="m"><svg width="11" height="10" viewBox="0 0 11 10" aria-hidden="true"><path d="M5.5 9l4.5 -8h-9z" fill="none" stroke="#cfd3d8" stroke-width="1.4" stroke-linejoin="round"/></svg>매도</span>'
    +(btAi(s)?'<span class="m"><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><rect x="2.4" y="2.4" width="6.2" height="6.2" transform="rotate(45 5.5 5.5)" fill="none" stroke="#f0b840" stroke-width="1.5"/></svg>'+btSkipL(s)+'</span>':'')+'</div>';
}
function btPage(){
  return '<div class="bt" id="bt-root" data-phase="'+BT.phase+'" data-kind="'+BT.s.kind+'">'
    +'<div class="tfw-hd bt-hd"><button class="bk" onclick="btBack()" aria-label="뒤로"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><span class="ti">백테스트</span><span class="sb" id="bt-sub"></span></div>'
    +btHeadHtml()
    +'<div class="bt-grid"><div class="bt-main">'
    +'<div class="bt-cap"><div class="bt-cap-l"><small id="bt-cap-k"></small><b class="num" id="bt-cap-v"></b><i class="num" id="bt-cap-p"></i></div>'+btLegend()+'</div>'
    +'<div class="bt-chart" id="bt-chart" onpointermove="btHover(event)" onpointerleave="btHover(null)" onclick="btChartClick(event)"></div>'
    +'<div class="bt-panel" id="bt-panel"></div>'
    +'<div class="bt-ev" id="bt-ev"></div>'
    +'</div><aside class="bt-rail" id="bt-rail"></aside></div>'
    +'<div class="bt-mcta" id="bt-mcta"></div>'
    +'</div>';
}
function btSub(){ var e=$('bt-sub'); if(e) e.textContent=btPerL()+', '+btUsd(BT.amt)+'로 시작'; }
function btCap(k,v,p,sg){ var a=$('bt-cap-k'), b=$('bt-cap-v'), c=$('bt-cap-p'); if(a&&a.textContent!==k) a.textContent=k; if(b&&b.textContent!==v) b.textContent=v; if(c){ if(c.textContent!==(p||'')) c.textContent=p||''; c.className='num'+(sg||''); } }

/* ── 판단 패널: 그래프 바로 아래의 고정된 자리 ──
   머리 줄은 지금(날짜와 들고 있는 것). 칸은 판단(발견, 확인, 결정). 지나간 판단은 "마지막 판단"이라는 날짜를 달고 남는다.
   다 돌리면 칸이 그대로 요약이 되고, 결과에서는 누르면 근거로 간다 */
function btCols(){ var s=BT.s; return s.kind==='agent'?['AI 재평가','시장 확인','결정']:btGate(s)?['기회 발견','AI 확인','결정']:['조건 충족','결정']; }
function btPanelInit(msg,skip){
  var C=btCols();
  $('bt-panel').className='bt-panel c'+C.length; $('bt-panel').removeAttribute('data-st');
  $('bt-panel').innerHTML='<div class="ph" role="status" aria-live="polite"><span class="bt-dot idle" id="bt-pdot"></span><b class="num" id="bt-pdate"></b><span id="bt-pstate">'+(msg||'')+'</span><em class="num" id="bt-plast"></em>'+(skip?'<button type="button" class="bt-skip" onclick="btSkip()">바로 결과 보기</button>':'')+'</div>'
    +'<div class="pc">'+C.map(function(c,i){ return '<div class="cell" id="bt-pc'+i+'"><small><i class="num">'+(i+1)+'</i>'+c+'</small><b></b><span></span></div>'; }).join('')+'</div>';
}
function btPanelHead(dot,date,state,last){ var a=$('bt-pdot'), b=$('bt-pdate'), c=$('bt-pstate'), l=$('bt-plast'); if(a) a.className='bt-dot'+(dot?' '+dot:''); if(b&&b.textContent!==date) b.textContent=date; if(c&&c.innerHTML!==state) c.innerHTML=state; if(l&&l.textContent!==(last||'')) l.textContent=last||''; }
/* st: 기회가 생긴 날, stage: 0 발견, 1 확인, 2 결정 */
function btPanelFill(st,stage){
  var C=btCols(), n=C.length, last=n-1, ds=st.ds, buys=ds.filter(function(x){ return x.k==='buy'; }), d=buys[0]||ds[0];
  var T=[d.p0]; if(n===3) T.push(d.p1||['','']);
  T.push(buys.length>1?[buys.map(function(x){ return x.tk; }).join(', ')+' 매수',buys[0].p2[1]]:(buys[0]||d).p2);
  for(var i=0;i<n;i++){ var c=$('bt-pc'+i); if(!c) continue; var vis=i===0?stage>=0:i===last?stage>=2:stage>=1, act=(i===0&&stage===0)||(i===last&&stage>=2)||(i>0&&i<last&&stage===1);
    var cls='cell'+(vis?' on':'')+(act?' act':'')+(i===last&&vis?(st.kind==='buy'?' go':' no'):''); if(c.className!==cls) c.className=cls;
    var b=c.querySelector('b'), sp=c.lastElementChild, t=T[i]||['','']; if(vis){ if(b.textContent!==t[0]) b.textContent=t[0]; if(sp.textContent!==t[1]) sp.textContent=t[1]; } else { b.textContent=''; sp.textContent=''; } }
  $('bt-panel').setAttribute('data-st',st.j); BT.lastSt=st;
}
function btPanelRest(){ var c=document.querySelectorAll('#bt-panel .cell.act'); for(var i=0;i<c.length;i++) c[i].classList.remove('act'); $('bt-panel').classList.add('rest'); }
/* 다 돌린 뒤: 칸이 요약이 된다 */
function btSumCells(){
  var R=BT.R, s=BT.s, need=btNeed(s), w=R.wins.length, l=R.loss.length;
  if(s.kind==='agent') return [['AI 재평가',[[R.nOpp+'번','opp']],R.N.toLocaleString()+'일 동안'],['시장 확인',[['쉬어 감 '+R.nSkip+'번','skip']],'유지 '+R.nHold+'번'],['결정',[['종목 매수 '+R.nBuy+'번','buy']],'끝난 거래 '+(w+l)+'번']];
  if(btGate(s)) return [['기회 발견',[[R.nOpp+'번','opp']],R.N.toLocaleString()+'일 동안'],['AI 확인',[[R.nOpp+'번 모두','opp']],'기준: 오름세 '+need+'개 이상'],['결정',[['매수 '+R.nBuy+'번','buy'],['보류 '+R.nSkip+'번','skip']],'끝난 거래 '+(w+l)+'번']];
  return [['조건 충족',[[R.nBuy+'번','buy']],R.N.toLocaleString()+'일 동안'],['결정',[['이긴 거래 '+w+'번','win'],['진 거래 '+l+'번','loss']],'매수 '+R.nBuy+'번']];
}
function btPanelSum(link){
  var S=btSumCells();
  S.forEach(function(x,i){ var c=$('bt-pc'+i); if(!c) return; c.className='cell on sum'; c.querySelector('small').innerHTML='<i class="num">'+(i+1)+'</i>'+x[0];
    c.querySelector('b').innerHTML=x[1].map(function(a){ return link?'<button type="button" class="k-'+a[1]+'" onclick="btJump(\''+a[1]+'\')">'+a[0]+'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>':'<span class="k-'+a[1]+'">'+a[0]+'</span>'; }).join('');
    c.lastElementChild.textContent=x[2]; });
  var p=$('bt-panel'); p.classList.remove('rest'); p.classList.add('sum'); p.removeAttribute('data-st');
}

/* ── 준비 ── */
function btReadyRail(){
  var s=BT.s, R=BT.R;
  var opt=function(list,cur,fn){ return '<div class="bt-seg" role="group">'+list.map(function(o){ var on=o[0]===cur; return '<button type="button" aria-pressed="'+on+'" onclick="'+fn+'('+o[0]+')">'+o[1]+'</button>'; }).join('')+'</div>'; };
  var dl=function(L){ return '<dl class="bt-dl">'+L.map(function(r){ return '<div><dt>'+r[0]+'</dt><dd>'+mkGloss(gEsc(r[1]),1)+'</dd></div>'; }).join('')+'</dl>'; };
  var fold=function(t,b,cls){ return '<details class="bt-box bt-fold '+(cls||'')+'" '+(innerWidth>900?'open':'')+'><summary><h3>'+t+'</h3><svg class="cv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>'+b+'</details>'; };
  return '<section class="bt-box bt-set"><h3>돌려 볼 조건</h3>'
    +'<div class="bt-f"><small>기간</small>'+opt(BT_PER,BT.per,'btSetPer')+'</div>'
    +'<div class="bt-f"><small>시작 금액</small>'+opt(BT_AMT.map(function(a){ return [a,a.toLocaleString()]; }),BT.amt,'btSetAmt')+'<em>USDT</em></div>'
    +'<button type="button" class="bt-cta" onclick="btStart()">과거를 다시 돌려 보기</button>'
    +'<p class="bt-note">'+btYMD(R.eq[0].i)+'부터 '+btYMD(R.eq[R.N-1].i)+'까지, '+R.N.toLocaleString()+'일을 하루씩 다시 돌려요.</p></section>'
    +fold('이 전략의 규칙',dl(btRules(s)))+fold('백테스트 조건',dl(btTerms()),'bt-terms');
}
function btReady(){
  BT.phase='ready'; BT.sel=null; BT.grp=null; BT.trf='all'; btStop(); btCompute(); BT.filt=btDefFilt(BT.s);
  var root=$('bt-root'); if(root){ root.setAttribute('data-phase','ready'); root.classList.remove('cur'); }
  btSub(); btChartDraw(); { var lg=document.querySelector('.bt-leg .b i'); if(lg) lg.textContent=mkPct0(BT.R.benchRet,1); }
  btCap('시작 금액',btUsd(BT.amt),'','');
  var s=BT.s; btPanelInit(btAi(s)?'다시 돌리는 동안 '+(s.kind==='agent'?'AI가 판단할 때마다':'기회가 생길 때마다')+' 확인 과정이 여기에 보여요':'다시 돌리는 동안 사는 조건이 맞을 때마다 여기에 보여요');
  $('bt-rail').innerHTML=btReadyRail(); $('bt-ev').innerHTML=''; $('bt-mcta').innerHTML='';
}
function btSetPer(v){ BT.per=v; btSaveSet(); btReady(); }
function btSetAmt(v){ BT.amt=v; btSaveSet(); btReady(); }
function btSaveSet(){ try{ var t=tfS(); t.bt=t.bt||{}; t.bt.per=BT.per; t.bt.amt=BT.amt; t.bt.id=BT.id; t.bt.done=0; tfSave(); }catch(e){} }

/* ── 다시 돌리기 ── */
function btRunRail(){
  return '<section class="bt-box bt-stepbox"><h3>지금 하는 일</h3><ol class="bt-steps" id="bt-steps">'+btSteps().map(function(x){ return '<li id="bt-st-'+x[0]+'"><span class="ic"></span><span class="lb">'+x[1]+'</span><span class="evd num" id="bt-se-'+x[0]+'"></span></li>'; }).join('')+'</ol></section>'
    +'<section class="bt-box bt-feedbox" id="bt-feedbox" hidden><h3>내린 판단</h3><div class="bt-feed" id="bt-feed"></div></section>';
}
function btStep(id,st,evd){ var e=$('bt-st-'+id); if(!e) return; if(e.className!==st){ e.className=st; if(st==='ok') e.querySelector('.ic').innerHTML=TAI_CHECK; else if(st==='run') e.querySelector('.ic').innerHTML='<i></i>'; } if(evd!=null){ var x=$('bt-se-'+id); if(x&&x.textContent!==evd) x.textContent=evd; } }
/* 그날까지 공개된 판단만 센다 */
function btCount(j,decided){
  var R=BT.R, s=BT.s, o=0,b=0,sk=0,hd=0,cl=0,days={};
  R.D.forEach(function(d){ if(d.j>j||(d.j===j&&!decided)) return; if(d.k==='sell'){ cl++; return; } if(d.k==='buy'){ b++; days[d.j]=1; o++; } else if(d.k==='skip'){ sk++; days[d.j]=1; o++; } else if(d.k==='hold'){ hd++; days[d.j]=1; } });
  return {o:s.kind==='agent'?Object.keys(days).length:o,b:b,s:sk,h:hd,c:cl};
}
function btHolding(i){ var R=BT.R, h=[]; R.tr.forEach(function(t){ if(t.e<=i&&(t.x==null||t.x>i)) h.push(mkTk(t.a)); }); return h; }
function btChainHtml(d){ if(!d.chain) return ''; return '<div class="bt-chain"><span class="ok">규칙 신호</span><span class="ai">AI 확인</span><span class="'+(d.k==='skip'?'no':'go')+'">'+(d.k==='skip'?'보류':'매수')+'</span></div>'; }
/* 끝난 판단의 짧은 기록 한 줄 */
function btFeedRow(d){
  return '<div class="bt-fr k-'+d.k+'"><time class="num">'+btYMD(d.i).slice(5)+'</time><span class="tg">'+d.tag+'</span><b>'+gEsc(d.k==='skip'&&!d.tk?'':d.tk||d.title)+'</b><span class="wy">'+(d.pnl!=null?'<i class="num'+mkSign(d.pnl)+'">'+mkPct0(d.pnl,1)+'</i>':gEsc(d.cmp||''))+'</span></div>';
}
function btFeed(j,decided){
  var R=BT.R, f=$('bt-feed'); if(!f) return; var add='';
  while(BT.fed<R.D.length){ var d=R.D[BT.fed]; if(d.j>j) break; if(d.j===j&&!decided) break; BT.fed++; if(d.k==='pick'||d.k==='hold') continue; add=btFeedRow(d)+add; }
  if(!add) return; var bx=$('bt-feedbox'); if(bx&&bx.hidden) bx.hidden=false;
  f.insertAdjacentHTML('afterbegin',add); while(f.children.length>5) f.removeChild(f.lastChild);
}
function btStart(){
  if(!BT.R) btCompute();
  BT.phase='run'; BT.ph=-1; BT.j=-2; BT.vj=-1; BT.fed=0; BT.seg=0; BT.stg=-1; BT.sel=null; BT.grp=null; BT.lastSt=null;
  var root=$('bt-root'); root.setAttribute('data-phase','run');
  $('bt-rail').innerHTML=btRunRail(); $('bt-ev').innerHTML=''; $('bt-mcta').innerHTML=''; btChartDraw(); btPanelInit('',1);
  var still=false; try{ still=window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  if(still){ btFinish(); return; }
  if(innerWidth<=900){ var c=document.querySelector('.bt-cap'); if(c) try{ c.scrollIntoView({block:'start',behavior:'smooth'}); }catch(e){} }
  BT.t0=performance.now(); BT.raf=requestAnimationFrame(btTick);
  try{ tfTrack('bt_start',{id:BT.id,per:BT.per}); }catch(e){}
}
function btStop(){ if(BT.raf) cancelAnimationFrame(BT.raf); BT.raf=0; }
function btChkTxt(c){ var s=BT.s; return s.kind==='agent'?'재평가 '+c.o+'번, 매수 '+c.b+'번, 쉬어 감 '+c.s+'번':btGate(s)?'기회 '+c.o+'번, 매수 '+c.b+'번, 보류 '+c.s+'번':s.kind==='mix'?'선정 '+BT.R.cnt.pick+'번, 매수 '+c.b+'번':'조건 충족 '+c.b+'번'; }
/* 그날까지 공개된 판단 중 가장 최근 것(유지는 AI 판단 전략에서만 판단으로 센다) */
function btLatest(j){ var S=BT.R.stops, o=null; for(var i=0;i<S.length;i++){ if(S[i].j>j) break; o=S[i]; } return o; }
function btLastTxt(){ var st=BT.lastSt; return st?(BT.s.kind==='agent'?'마지막 재평가 ':'마지막 매수 판단 ')+btYMD(BT.R.eq[st.j].i):''; } /* 패널은 살지 말지의 판단을 담는다. 매도는 기록 줄에 남는다 */
function btTick(now){
  if(BT.phase!=='run'||!$('bt-root')){ BT.raf=0; return; }
  var e=now-BT.t0, R=BT.R, t1=R.prepMs, t2=t1+R.runMs, t3=t2+R.wrapMs;
  if(e<t1){
    if(BT.ph<0){ BT.ph=0; btStep('prep','run'); btCap('시작 금액',btUsd(BT.amt),'',''); btCursor(-1); }
    var k=e/t1, tot=R.list.length*R.N, ix=Math.min(R.list.length-1,Math.floor(k*R.list.length));
    btStep('prep','run',Math.floor(tot*k).toLocaleString()+'개'); btPanelHead('','',gEsc(mkTk(R.list[ix]))+'의 하루 가격을 불러오는 중','');
  } else if(e<t2){
    if(BT.ph<1){ BT.ph=1; btStep('prep','ok',R.list.length+'종목, 가격 '+(R.list.length*R.N).toLocaleString()+'개'); btStep('run','run'); btStep('chk','run'); $('bt-root').classList.add('cur'); }
    var te=e-t1, sg=R.seg; while(BT.seg<sg.length-1&&te>=sg[BT.seg].t1) BT.seg++;
    var g=sg[BT.seg], j, stage=-1;
    if(g.k==='go'){ var p=Math.max(0,Math.min(1,(te-g.t0)/Math.max(1,g.t1-g.t0))); j=Math.round(g.a+(g.b-g.a)*p); }
    else { j=g.j; var q=te-g.t0, tt=g.st.t; stage=!g.st.full?2:q<tt[0]?0:q<tt[0]+tt[1]?1:2; }
    j=Math.max(-1,Math.min(R.N-1,j));
    if(j!==BT.j||stage!==BT.stg){
      BT.j=j; BT.stg=stage; var dec=stage<0||stage>=2, vj=dec?j:j-1; BT.vj=vj; /* 결정이 나기 전에는 잔고도 선도 표시도 전날에 머문다 */
      btCursor(vj); btMarks(vj); btDD(vj); btFeed(j,dec); var c=btCount(j,dec), v=btV(vj), dj=Math.max(0,j);
      btCap(btYMD(R.eq[dj].i)+' 잔고',btUsd(BT.amt*v),mkPct0((v-1)*100,1),mkSign((v-1)*100));
      btStep('run','run',(dj+1).toLocaleString()+' / '+R.N.toLocaleString()+'일'); btStep('chk','run',btChkTxt(c));
      if(stage>=0){ $('bt-panel').classList.remove('rest'); btPanelFill(g.st,stage); btPulse(stage<2?vj:null);
        btPanelHead('',btYMD(R.eq[j].i),stage===0?(BT.s.kind==='agent'?'AI가 종목을 다시 비교했어요':btGate(BT.s)?'기회를 찾았어요':'사는 조건이 맞았어요'):stage===1?'AI가 그날의 시장을 확인해요':gEsc(g.st.kind==='skip'&&g.st.ds[0].tk?g.st.ds[0].tk+' 매수 보류':g.st.ds[0].p2[0]),''); }
      else { btPulse(null); var ls=btLatest(j); if(ls&&ls!==BT.lastSt) btPanelFill(ls,2); btPanelRest(); var h=btHolding(R.eq[dj].i); btPanelHead('',btYMD(R.eq[dj].i),h.length?gEsc(h.join(', '))+' 보유 중':'조건이 맞기를 기다리는 중',btLastTxt()); }
    }
  } else if(e<t3){
    if(BT.ph<2){ BT.ph=2; btEndReplay(); btStep('wrap','run'); btPanelSum(0); btPanelHead('',btYMD(R.eq[R.N-1].i),R.N.toLocaleString()+'일을 다 돌렸어요. 결과를 정리하는 중',''); }
  } else { btStep('wrap','ok'); btFinish(); return; }
  BT.raf=requestAnimationFrame(btTick);
}
function btEndReplay(){
  var R=BT.R, j=R.N-1; BT.j=j; BT.vj=j; BT.stg=-1; btPulse(null); btCursor(j); btMarks(j); btDD(j); btFeed(j,true); var c=btCount(j,true), v=R.eq[j].v;
  btCap(btYMD(R.eq[j].i)+' 잔고',btUsd(BT.amt*v),mkPct0((v-1)*100,1),mkSign((v-1)*100));
  btStep('run','ok',R.N.toLocaleString()+'일'); btStep('chk','ok',btChkTxt(c));
  var root=$('bt-root'); if(root) root.classList.remove('cur');
}
function btSkip(){ btStop(); btFinish(); }

/* ── 결과 ── */
function btWinTxt(){ var R=BT.R, n=R.wins.length+R.loss.length; return n?n+'번 중 '+R.wins.length+'번':'아직 없음'; }
/* 해석: 세 문장. 평가, 움직인 방식, 조심할 점 */
function btRead(){
  var R=BT.R, s=BT.s, n=R.wins.length+R.loss.length, diff=Math.round(R.final)-Math.round(R.benchFinal), ex=Math.round(Math.min(100,R.r.exposure||0)), calm=Math.abs(R.mdd)<Math.abs(R.benchMdd), a=Math.abs(diff).toLocaleString()+' USDT';
  /* 손실끼리 비교할 때는 '덜 벌었다'가 아니라 '더 잃었다'. 전략이 손실이면 앞선 경우도 '덜 잃었다' */
  var won=R.final>=BT.amt, bwon=R.benchFinal>=BT.amt, vb=diff>=0?(won?'더 벌었':'덜 잃었'):(won?'덜 벌었':(bwon?'적게 남겼':'더 잃었'));
  var v='그냥 들고 있었을 때보다 '+a+' '+vb+(diff>=0?(calm?'고, 덜 흔들렸어요.':'지만, 더 크게 흔들렸어요.'):(calm?'지만, 덜 흔들렸어요.':'고, 더 크게 흔들렸어요.'));
  var b=btGate(s)?('기회 '+R.nOpp+'번 중 '+R.nSkip+'번은 AI가 사지 않았고, 전체 기간의 '+ex+'%만 종목을 들고 있었어요.'):s.kind==='agent'?('AI가 '+R.nOpp+'번 다시 비교했고, 그중 '+R.nSkip+'번은 새로 사지 않고 쉬었어요.'):('사는 조건은 '+R.nBuy+'번 맞았고, 전체 기간의 '+ex+'%만 종목을 들고 있었어요.');
  var c=n&&n<20?('거래가 '+n+'번뿐이라 몇 번의 거래가 결과를 좌우해요.'):('가장 나빴던 때는 '+mkMD(R.r.mddStartI)+'부터 '+mkMD(R.r.mddEndI)+'까지였어요.');
  return [v,b,c];
}
function btResultRail(){
  var R=BT.R, s=BT.s, pf=R.final-BT.amt, diff=Math.round(R.final)-Math.round(R.benchFinal);
  return '<section class="bt-box bt-verdict"><small>'+btPerL()+' 동안, '+btUsd(BT.amt)+'로</small>'
    +'<p class="bt-v1b"><b class="num'+mkSign(R.ret)+'">'+btUsdS(pf)+'</b></p>'
    +'<p class="bt-v2"><span>그냥 들고 있었다면 <i class="num">'+btUsdS(R.benchFinal-BT.amt)+'</i></span><b class="num '+(diff>=0?'mk-up':'mk-dn')+'">그보다 '+Math.abs(diff).toLocaleString()+' USDT '+(diff>=0?'많음':'적음')+'</b></p>'
    +'<div class="bt-k3"><div><small>가장 크게 내려간 폭</small><b class="num mk-dn">'+R.mdd.toFixed(1)+'%</b><em class="num">그냥 들고 있었다면 '+R.benchMdd.toFixed(1)+'%</em></div>'
    +'<div><small>이긴 거래</small><b class="num">'+btWinTxt()+'</b></div>'
    +'<div><small>평균 보유</small><b class="num">'+Math.round(R.r.avgHold||0)+'일</b></div></div></section>'
    +'<section class="bt-box bt-read"><h3>TETH의 해석</h3>'+btRead().map(function(x){ return '<p>'+gEsc(x)+'</p>'; }).join('')+'</section>'
    +'<button type="button" class="bt-cta" onclick="btUse()">이 전략 실행하기</button>'
    +'<button type="button" class="bt-sec" onclick="btReady()">조건을 바꿔 다시 돌리기</button>'
    +'<p class="bt-rec num">'+TAI_CHECK+'<span>가격 '+(R.list.length*R.N).toLocaleString()+'개, '+R.N.toLocaleString()+'일을 확인했어요</span></p>';
}
function btJump(k){
  if(BT.phase!=='result') return;
  if(k==='win'||k==='loss'||k==='tr'){ BT.trf=k==='tr'?'all':k; BT.ordN=8; var e0=$('bt-ev'); if(e0) e0.innerHTML=btEvidence(); var t=$('bt-trs'); if(t) try{ t.scrollIntoView({block:'start',behavior:'smooth'}); }catch(e){} return; }
  BT.filt=k; BT.decN=8; BT.grp=null; if(BT.sel&&BT.sel.t!=='t') BT.sel=null; var e=$('bt-ev'); if(e) e.innerHTML=btEvidence(); btPin();
  var d=$('bt-dec'); if(d) try{ d.scrollIntoView({block:'start',behavior:'smooth'}); }catch(x){}
}
function btFinish(){
  btStop(); BT.phase='result'; BT.j=BT.R.N-1; BT.vj=BT.j; BT.stg=-1; if(!BT.filt) BT.filt=btDefFilt(BT.s);
  var root=$('bt-root'); if(!root) return; root.setAttribute('data-phase','result'); root.classList.remove('cur');
  var R=BT.R; btCap(btYMD(R.eq[R.N-1].i)+' 잔고',btUsd(R.final),mkPct0(R.ret,1),mkSign(R.ret));
  if(!$('bt-pc0')) btPanelInit('');
  var sk=document.querySelector('#bt-panel .bt-skip'); if(sk) sk.remove();
  btPanelSum(1); btPanelHead('done','',R.N.toLocaleString()+'일을 다시 돌렸어요. 숫자나 그래프의 표시를 누르면 근거가 열려요.','');
  $('bt-rail').innerHTML=btResultRail(); $('bt-ev').innerHTML=btEvidence();
  $('bt-mcta').innerHTML='<div><b class="num'+mkSign(R.ret)+'">'+mkPct0(R.ret,1)+'</b><span>'+btPerL()+'</span></div><button type="button" class="bt-cta" onclick="btUse()">이 전략 실행하기</button>';
  btChartDraw(); requestAnimationFrame(function(){ if(BT.phase==='result'&&$('bt-chart')&&BT.G&&Math.abs($('bt-chart').clientWidth-BT.G.W)>2) btChartDraw(); }); /* 자리가 잡힌 뒤의 폭으로 다시 잰다 */
  try{ var t=tfS(); t.bt=t.bt||{}; t.bt.id=BT.id; t.bt.per=BT.per; t.bt.amt=BT.amt; t.bt.done=1; t.bt.ret=R.ret; t.bt.mdd=R.mdd; t.bt.fin=R.final; tfSave(); tfTrack('bt_done',{id:BT.id,ret:R.ret}); }catch(e){}
  if(BT.s&&BT.s.mine) btMineDone();
}
