/* ═══ 백테스트 여정 (bt) 선물 전략 ═══
   판단 기록을 롱과 숏의 말로 만들고, 현물의 말(매수, 매도)로 쓰인 화면 글을 선물 전략일 때만 바꿔 보여 준다. */
function fuBtSig(c,e,tk){ var up=e.side>0;
  if(c.mode==='brk') return [tk+' '+c.n+'일 '+(up?'최고가 돌파':'최저가 이탈'),e.ref?('기준 '+mkPxFmt(e.ref)+' USDT를 종가로 '+(up?'넘었어요':'벗어났어요')):''];
  if(c.mode==='ma') return [tk+' 평균선 '+(up?'위로':'아래로')+' 교차',c.fast+'일 평균이 '+c.slow+'일 평균을 '+(up?'넘었어요':'밑돌았어요')];
  if(c.mode==='dip') return [tk+(up?' 밀린 뒤 반등':' 오른 뒤 꺾임'),'하루 '+mkPct0(e.chg1||0,1)];
  if(c.mode==='fg') return [tk+(up?' 공포 구간 반등':' 과열 구간 꺾임'),'공포 탐욕 지수 '+(e.fng!=null?e.fng:'-')];
  return [tk,'']; }
function fuBtDec(s,e,x){
  var c=s.cfg, tk=e.a?mkTk(e.a):'', sd=e.side?fuSd(e.side):'', q=fuNeed(c,x.n8), lv=(e.lev>1?e.lev+'배':'1배');
  var brd=e.up!=null?['오름세 '+e.up+' / '+e.of+'개',(e.side>0?'롱 기준 '+q.L+'개 이상':'숏 기준 '+q.S+'개 이하')]:null;
  var tops=function(){ return (e.top||[]).length?'강한 쪽 '+mkTk(e.top[0].k)+' '+mkPct0(e.top[0].mom,0)+', 약한 쪽 '+((e.bot||[])[0]?mkTk(e.bot[0].k)+' '+mkPct0(e.bot[0].mom,0):'-'):''; };
  var liq=(e.liq>0&&isFinite(e.liq))?btPx(e.liq):'없음';
  if(e.t==='unpick') return null;
  if(e.t==='pick') return {k:'pick',tag:'선정',title:tk+' '+sd+' 후보',side:e.side,cmp:'오름세 '+e.up+' / '+e.of+', '+c.look+'일 '+mkPct0(e.mom,1),why:'AI가 시장 방향을 '+sd+'으로 보고 '+(e.side>0?'가장 강한':'가장 약한')+' 종목을 골랐어요',
    facts:[['오름세 종목',e.of+'개 중 '+e.up+'개'],['강한 쪽',(e.top||[]).map(function(t){ return mkTk(t.k)+' '+mkPct0(t.mom,0); }).join(', ')],['약한 쪽',(e.bot||[]).map(function(t){ return mkTk(t.k)+' '+mkPct0(t.mom,0); }).join(', ')]]};
  if(e.t==='veto'){ var sg=fuBtSig(c,e,tk); return {k:'skip',tag:'보류',title:tk+' '+sd,side:e.side,chain:1,cmp:'AI가 본 방향과 반대',why:sd+' 신호가 나왔지만 AI가 본 시장 방향과 달라 진입하지 않았어요',
    p0:sg,p1:['오름세 '+e.up+' / '+e.of+'개','AI가 본 방향은 '+(e.reg>0?'롱':e.reg<0?'숏':'쉼')],p2:['보류','방향이 달라 진입하지 않았어요'],ups:x.upsOf(e),
    facts:[['규칙 신호',sd+', '+sg[0]],['AI가 본 방향',e.reg>0?'롱':e.reg<0?'숏':'쉼'],['오름세 종목',e.of+'개 중 '+e.up+'개']]}; }
  if(e.t==='skip') return {k:'skip',tag:'쉬어 감',title:'새로 진입하지 않음',cmp:'오름세 '+e.up+' / '+e.of+', 방향 애매',why:'오름세 종목이 '+e.of+'개 중 '+e.up+'개라 롱도 숏도 기준에 못 미쳤어요',
    p0:[x.n8+'종목 비교',tops()],p1:['오름세 '+e.up+' / '+e.of+'개','롱 '+q.L+'개 이상, 숏 '+q.S+'개 이하'],p2:['새로 진입하지 않음','방향이 애매해 쉬었어요'],ups:x.upsOf(e),
    facts:[['오름세 종목',e.of+'개 중 '+e.up+'개'],['기준','롱은 '+q.L+'개 이상, 숏은 '+q.S+'개 이하']].concat((e.held||[]).length?[['들고 있던 포지션',e.held.map(mkTk).join(', ')]]:[])};
  if(e.t==='hold') return {k:'hold',tag:'유지',title:'그대로 유지',cmp:(e.held||[]).map(mkTk).join(', ')+' 유지',why:'든 포지션이 여전히 조건에 맞아 그대로 뒀어요',
    p0:[x.n8+'종목 비교',tops()],p1:['오름세 '+e.up+' / '+e.of+'개','방향 유지'],p2:['그대로 유지','포지션을 바꾸지 않았어요'],ups:x.upsOf(e),
    facts:[['들고 있던 포지션',(e.held||[]).map(mkTk).join(', ')],['오름세 종목',e.of+'개 중 '+e.up+'개']]};
  if(e.t==='enter'){
    if(c.kind==='agent') return {k:'buy',tag:sd+' 진입',title:tk,side:e.side,cmp:(e.side>0?'강한 쪽 ':'약한 쪽 ')+e.rank+'위, '+c.look+'일 '+mkPct0(e.mom,1),why:'AI가 시장 방향을 '+sd+'으로 보고 '+(e.side>0?'강한':'약한')+' 쪽 '+e.rank+'번째 종목에 진입했어요',
      p0:[x.n8+'종목 비교',tops()],p1:brd,p2:[tk+' '+sd+' 진입',lv+', 다음 날 시가'],ups:x.upsOf(e),
      facts:[['진입 가격',btPx(e.px)],['비중',Math.round((e.w||0)*100)+'%'],['방향과 배수',sd+' '+lv],['강제 청산 가격',liq],['순위',(e.side>0?'강한 쪽 ':'약한 쪽 ')+e.rank+'위, '+c.look+'일 '+mkPct0(e.mom,1)],['오름세 종목',e.of+'개 중 '+e.up+'개']]};
    var s1=fuBtSig(c,e,tk), mix=c.kind==='mix';
    return {k:'buy',tag:sd+' 진입',title:tk,side:e.side,chain:mix?1:0,cmp:s1[0].replace(tk+' ',''),why:s1[0]+'. '+s1[1],
      p0:s1,p1:mix?brd:null,p2:[tk+' '+sd+' 진입',lv+', 다음 날 시가'],ups:mix?x.upsOf(e):null,
      facts:[['신호',s1[0]+(s1[1]?', '+s1[1]:'')]].concat(mix&&e.up!=null?[['오름세 종목',e.of+'개 중 '+e.up+'개']]:[]).concat([['진입 가격',btPx(e.px)],['방향과 배수',sd+' '+lv],['강제 청산 가격',liq]])}; }
  return {k:'sell',tag:sd+' 청산',title:tk,side:e.side,pnl:e.pnl,cmp:FU_WHY[e.why]||'',why:FU_WHY[e.why]||'',
    facts:[['청산 가격',btPx(e.px)],['진입 가격',btPx(e.ep)],['이 거래의 손익',mkPct0(e.pnl,1)+', 넣은 돈 기준'],['청산한 이유',FU_WHY[e.why]||''],['낸 펀딩비',mkPct0(-(e.fund||0)/(e.cost||1)*100,1)]]};
}
function fuBtRules(s){ var c=s.cfg, o=[];
  if(c.kind!=='rule') o.push([c.kind==='agent'?'AI 판단':'방향과 종목',(c.kind==='mix'?'AI가 ':'')+fuAiTxt(s)]);
  if(c.kind!=='agent') o.push(['진입',fuSig(c)+(c.reg?'. 롱은 '+c.reg+'일 평균 위, 숏은 아래에서만':'')]);
  o.push(['청산',fuOuts(c).join('. ')||'재평가 때 방향이나 순위가 바뀌면 닫아요']);
  o.push(['레버리지',c.lev>1?c.lev+'배, 손실은 넣은 증거금까지':'1배']);
  return o; }
function fuBtTerms(){ return [['판단 시점','하루 한 번, UTC 0시 종가로 정하고 다음 날 시가에 체결'],['비용','수수료 0.055%, 미끄러짐 0.05%, 펀딩비는 실제 기록'],['장중 위험','그날 고가와 저가로 손절과 강제 청산을 확인'],['비교 대상',mkUni(BT.s).list.length>1?'같은 종목을 똑같이 나눠 현물로 그냥 들고 있었을 때':'같은 종목을 현물로 그냥 들고 있었을 때']]; }
function fuTradeMini(t){ var c=BT.s.cfg, sd=fuSd(t.side);
  return btMini(t.a,t.e-14,(t.x!=null?t.x:BT.R.T)+10,[[t.e,sd+' 진입',t.side>0?'#2fb98a':'#b08cf5']].concat(t.x!=null?[[t.x,'청산',t.pnl>=0?'#2fb98a':'#f0566a']]:[]),c.sl?[[t.ep*(1-t.side*c.sl/100),'손절 '+c.sl+'%','#f0566a']]:[],[t.e,t.x!=null?t.x:BT.R.T]); }
function fuTrDetail(t){
  var put=BT.amt*t.cost, got=t.got!=null?BT.amt*t.got:put*(1+t.pnl/100), mv=t.side*(t.xp/t.ep-1)*100, lv=t.lev||1, cost=t.pnl-mv*lv, sd=fuSd(t.side);
  var L=[['방향과 배수',sd+' '+lv+'배'],['진입한 날',btYMD(t.e)+', '+btPx(t.ep)],[t.open?'지금 가격':'청산한 날',(t.open?'':btYMD(t.x)+', ')+btPx(t.xp)],['들고 있던 기간',t.days+'일'],['넣은 돈(증거금)',btUsd(put)]];
  var P=[['가격이 움직인 만큼','<i class="num'+mkSign(mv)+'">'+mkPct0(mv,1)+'</i>'+(t.side<0?', 숏이라 내릴수록 이익':'')]].concat(lv>1?[['레버리지 '+lv+'배 반영','<i class="num'+mkSign(mv*lv)+'">'+mkPct0(mv*lv,1)+'</i>']]:[]).concat(t.open?[]:[['수수료와 펀딩비','<i class="num">'+mkPct0(cost,1)+'</i>']]).concat([[t.open?'지금 손익':'이 거래의 손익','<i class="num'+mkSign(t.pnl)+'">'+mkPct0(t.pnl,1)+'</i>, '+btUsdS(got-put)]]);
  return '<div class="bt-dd-in"><div class="bt-dd-c"><small>'+gEsc(t.a)+' 선물 가격, 진입 전후 <i>USDT</i></small>'+fuTradeMini(t)+'<p class="bt-cap2">밝은 구간이 포지션을 들고 있던 기간이에요</p></div>'
    +'<div class="bt-dd-f"><div class="bt-blk"><h4>거래</h4>'+btFacts(L.map(function(f){ return [f[0],gEsc(f[1])]; }))+'</div><div class="bt-blk"><h4>손익이 나온 과정</h4>'+btFacts(P)+(t.open?'':'<p class="bt-after">청산한 이유: '+gEsc(FU_WHY[t.why]||'')+'</p>')+'</div></div></div>'; }
function fuLegend(){ var s=BT.s;
  return '<div class="bt-leg"><span class="a">이 전략</span><span class="b">그냥 들고 있었다면 <i class="num">'+(BT.R?mkPct0(BT.R.benchRet,1):'')+'</i></span><span class="m"><svg width="11" height="10" viewBox="0 0 11 10" aria-hidden="true"><path d="M5.5 1l4.5 8h-9z" fill="#2fb98a"/></svg>롱 진입</span><span class="m"><svg width="11" height="10" viewBox="0 0 11 10" aria-hidden="true"><path d="M5.5 9l4.5 -8h-9z" fill="#b08cf5"/></svg>숏 진입</span><span class="m"><svg width="11" height="10" viewBox="0 0 11 10" aria-hidden="true"><path d="M5.5 9l4.5 -8h-9z" fill="none" stroke="#cfd3d8" stroke-width="1.4" stroke-linejoin="round"/></svg>청산</span>'
    +(btAi(s)?'<span class="m"><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><rect x="2.4" y="2.4" width="6.2" height="6.2" transform="rotate(45 5.5 5.5)" fill="none" stroke="#f0b840" stroke-width="1.5"/></svg>'+btSkipL(s)+'</span>':'')+'</div>'; }
function fuSumCells(){ var R=BT.R, s=BT.s, w=R.wins.length, l=R.loss.length, nL=R.D.filter(function(d){ return d.k==='buy'&&d.side>0; }).length, nS=R.nBuy-nL;
  if(s.kind==='agent') return [['AI 재평가',[[R.nOpp+'번','opp']],R.N.toLocaleString()+'일 동안'],['시장 확인',[['쉬어 감 '+R.nSkip+'번','skip']],'유지 '+R.nHold+'번'],['결정',[['진입 '+R.nBuy+'번','buy']],'롱 '+nL+'번, 숏 '+nS+'번']];
  if(btGate(s)) return [['기회 발견',[[R.nOpp+'번','opp']],R.N.toLocaleString()+'일 동안'],['AI 확인',[[R.nOpp+'번 모두','opp']],'AI가 본 방향과 같은 신호만'],['결정',[['진입 '+R.nBuy+'번','buy'],['보류 '+R.nSkip+'번','skip']],'롱 '+nL+'번, 숏 '+nS+'번']];
  return [['조건 충족',[[R.nBuy+'번','buy']],'롱 '+nL+'번, 숏 '+nS+'번'],['결정',[['이긴 거래 '+w+'번','win'],['진 거래 '+l+'번','loss']],'진입 '+R.nBuy+'번']]; }
(function(){
  var D=[['살 때와 팔 때마다 수수료 0.1%','진입과 청산 때마다 수수료 0.055%'],['살 때와 팔 때 0.1%씩','진입과 청산 때'],['살 때와 팔 때 낸 수수료','진입과 청산 때 낸 수수료'],['종목 매수','진입'],['매수 전후','진입 전후'],['매수','진입'],['매도','청산'],['처음 산 날','처음 진입한 날'],['산 날','진입한 날'],['판 날','청산한 날'],['사는 조건','진입 조건'],['AI가 사지 않았고','AI가 진입을 보류했고'],['새로 사지 않고 쉬었어요','새로 진입하지 않고 쉬었어요'],['새로 사지 않음','새로 진입하지 않음'],['종목을 들고 있었어요','포지션을 들고 있었어요'],['종목을 들고 있던','포지션을 들고 있던'],['판 이유','청산한 이유'],['판 내용','청산 내용'],['그날 산 종목','그날 진입한 종목'],[/(현물로 )?그냥 들고 있었/g,'현물로 그냥 들고 있었']];
  function W(x){ if(typeof x==='string'){ if(x.length>80000) return x; for(var i=0;i<D.length;i++){ if(typeof D[i][0]!=='string') x=x.replace(D[i][0],D[i][1]); else if(x.indexOf(D[i][0])>=0) x=x.split(D[i][0]).join(D[i][1]); } return x; } if(Array.isArray(x)) return x.map(W); return x; }
  window.fuW=W;
  var on=function(){ return !!(window.BT&&BT.s&&BT.s.cfg&&BT.s.cfg.fut); };
  var OVR={btLegend:fuLegend,btSumCells:fuSumCells,btRules:function(s){ return fuBtRules(s); },btTerms:fuBtTerms,btTrDetail:fuTrDetail,btTradeMini:fuTradeMini,
    btHolding:function(i){ var R=BT.R, h=[]; R.tr.forEach(function(t){ if(t.e<=i&&(t.x==null||t.x>i)) h.push(mkTk(t.a)+' '+fuSd(t.side)); }); return h; }};
  var RET=['btPage','btHeadHtml','btSteps','btCols','btReadyRail','btRunRail','btChainHtml','btFeedRow','btChkTxt','btLastTxt','btWinTxt','btRead','btResultRail','btMonths','btDecDetail','btEvDetail','btRowHtml','btDecRows','btTrRows','btTech','btChipsL','btShortcuts','btEvidence','btGoMe','btGoHead','btGoNext','btGoFlow','btGoPage','btOppL','btSkipL'];
  var ARG=['btPanelHead','btPanelInit','btStep','btCap'];
  Object.keys(OVR).forEach(function(n){ var f=window[n]; if(typeof f!=='function') return; window[n]=function(){ return on()?W(OVR[n].apply(this,arguments)):f.apply(this,arguments); }; });
  RET.forEach(function(n){ var f=window[n]; if(typeof f!=='function') return; window[n]=function(){ var r=f.apply(this,arguments); return on()?W(r):r; }; });
  ARG.forEach(function(n){ var f=window[n]; if(typeof f!=='function') return; window[n]=function(){ return f.apply(this,on()?W([].slice.call(arguments)):arguments); }; });
  var pf=window.btPanelFill; if(typeof pf==='function') window.btPanelFill=function(){ var r=pf.apply(this,arguments); if(on()){ var q=document.querySelectorAll('#bt-panel .cell b, #bt-panel .cell span'); for(var i=0;i<q.length;i++){ var t=W(q[i].textContent); if(t!==q[i].textContent) q[i].textContent=t; } } return r; };
})();
