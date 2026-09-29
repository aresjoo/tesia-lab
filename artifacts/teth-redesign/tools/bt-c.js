/* ═══ 백테스트 여정 (bt) 3/4: 근거(판단, 거래, 월별, 자세한 지표)와 들어오고 나가기 ═══ */
/* 달마다: 기간이 한 달을 다 채우지 못한 첫 달과 끝 달은 "일부"라고 적는다 */
function btMonths(){
  var R=BT.R, m=R.mon, mx=Math.max.apply(null,m.map(function(x){ return Math.abs(x.ret); }).concat(1)), H=58;
  return '<div class="bt-monw"><div class="bt-mon" style="--n:'+m.length+'">'+m.map(function(x,q){ var h=Math.max(2,Math.abs(x.ret)/mx*H), up=x.ret>=0.05, dn=x.ret<=-0.05;
    return '<div class="bt-mo'+(up?' u':dn?' d':' z')+(x.part?' pt':'')+'"><b class="num">'+(Math.abs(x.ret)<0.05?'0%':mkPct0(x.ret,1))+'</b><span class="p"><i style="height:'+(up?h:0).toFixed(1)+'px"></i></span><span class="n"><i style="height:'+(dn?h:0).toFixed(1)+'px"></i></span><em class="num">'+(x.m===1||q===0?String(x.y).slice(2)+'년 ':'')+x.m+'월</em>'+(x.part?'<small>일부</small>':'')+'</div>'; }).join('')+'</div></div>';
}
function btMonthsSum(){ var m=BT.R.mon.filter(function(x){ return !x.part; }), u=m.filter(function(x){ return x.ret>=0.05; }).length; return m.length?('온전한 '+m.length+'개월 중 '+u+'개월이 올랐어요'):''; }
/* 그 무렵의 가격: 종목 하나의 가격 선, 산 곳과 판 곳, 들고 있던 구간. 글자는 화면에 그려지는 크기에 맞춘다 */
function btMini(a,i1,i2,marks,lines,hold){
  var P=mkPx(a), T=PRICE0.length-1, lo=Math.max(0,i1), hi=Math.min(T,i2), W=400, H=176, pl=6, pr=78, pt=22, pb=26, v=[]; for(var i=lo;i<=hi;i++) v.push(P[i]);
  var ex=v.concat((lines||[]).map(function(l){ return l[0]; })), mn=Math.min.apply(null,ex), mx=Math.max.apply(null,ex), pad=(mx-mn)*0.12||1; mn-=pad; mx+=pad;
  var X=function(i){ return pl+(i-lo)/Math.max(1,hi-lo)*(W-pl-pr); }, Y=function(p){ return pt+(1-(p-mn)/(mx-mn))*(H-pt-pb); }, d='';
  v.forEach(function(p,k){ d+=(k?' L':'M')+X(lo+k).toFixed(1)+' '+Y(p).toFixed(1); });
  var hs=''; if(hold){ var hx=X(Math.max(lo,hold[0])), hw=Math.max(2,X(Math.min(hi,hold[1]))-hx); hs='<rect x="'+hx.toFixed(1)+'" y="'+pt+'" width="'+hw.toFixed(1)+'" height="'+(H-pt-pb)+'" fill="rgba(255,255,255,.06)"/>'; }
  var ax=(lines&&lines.length)?'':[mx-pad,mn+pad].map(function(p){ return '<text x="'+(W-pr+8)+'" y="'+(Y(p)+4).toFixed(1)+'" font-size="12" fill="#8b9096">'+mkPxFmt(p)+'</text>'; }).join('');
  return '<svg class="bt-mini" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+gEsc(a)+' 가격">'+hs+'<path d="'+d+'" fill="none" stroke="rgba(255,255,255,.72)" stroke-width="1.5" stroke-linejoin="round"/>'
    +(lines||[]).map(function(l){ var y=Y(l[0]); return '<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="'+l[2]+'" stroke-dasharray="3 4" stroke-opacity=".7"/><text x="'+(W-pr+8)+'" y="'+(y+4).toFixed(1)+'" font-size="12" fill="'+l[2]+'">'+l[1]+'</text>'; }).join('')+ax
    +marks.map(function(m){ if(m[0]<lo||m[0]>hi) return ''; var x=X(m[0]), y=Y(P[m[0]]), ty=y-12<pt-4?y+22:y-12; return '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="5" fill="'+m[2]+'" stroke="#15171a" stroke-width="2"/><text x="'+x.toFixed(1)+'" y="'+ty.toFixed(1)+'" text-anchor="middle" font-size="12.5" font-weight="600" fill="'+m[2]+'">'+m[1]+'</text>'; }).join('')
    +'<text x="'+pl+'" y="'+(H-7)+'" font-size="12" fill="#8b9096">'+btYMD(lo).slice(2)+'</text><text x="'+(W-pr)+'" y="'+(H-7)+'" text-anchor="end" font-size="12" fill="#8b9096">'+btYMD(hi).slice(2)+'</text></svg>';
}
function btTradeOf(tid){ var t=null; BT.R.tr.forEach(function(x){ if(x.id===tid) t=x; }); return t; }
function btTradeMini(t){
  var c=BT.s.cfg||{};
  return btMini(t.a,t.e-14,(t.x!=null?t.x:BT.R.T)+10,[[t.e,'매수','#2fb98a']].concat(t.x!=null?[[t.x,'매도',t.pnl>=0?'#2fb98a':'#f0566a']]:[]),BT.s.kind==='agent'?[]:(c.tp!=null?[[t.ep*(1+c.tp/100),'목표 +'+c.tp+'%','#2fb98a']]:[]).concat([[t.ep*(1+c.sl/100),'손절 '+c.sl+'%','#f0566a']]),[t.e,t.x!=null?t.x:BT.R.T]);
}
function btFacts(L,gl){ return '<dl class="bt-dl">'+L.map(function(f){ return '<div><dt>'+(gl?mkGloss(gEsc(f[0]),0):gEsc(f[0]))+'</dt><dd class="num">'+f[1]+'</dd></div>'; }).join('')+'</dl>'; }
function btUpsHtml(ups){ if(!ups) return ''; return '<div class="bt-ups"><small>그날 오름세로 본 종목 <i>가격이 60일 평균보다 위</i></small><ul>'+BT.R.list.map(function(k){ var on=ups.indexOf(k)>=0; return '<li class="'+(on?'y':'n')+'">'+gEsc(mkTk(k))+'</li>'; }).join('')+'</ul></div>'; }
function btDecDetail(d){
  var t=d.tid!=null?btTradeOf(d.tid):null, mini='', R=BT.R;
  if(d.a){ if(t) mini=btTradeMini(t); else mini=btMini(d.a,d.i-25,d.i+25,[[d.i,d.k==='skip'?'보류':d.tag,d.k==='skip'?'#f0b840':'#9aa0a6']],[],null); }
  var after=''; if(d.k==='skip'&&d.a){ var P=mkPx(d.a), q=Math.min(R.T,d.i+25), ch=(P[q]/P[d.i]-1)*100; after='<div class="bt-blk"><h4>그 뒤 가격</h4><p class="bt-after">그 뒤 '+(q-d.i)+'일 동안 '+gEsc(mkTk(d.a))+'의 가격은 <b class="num'+mkSign(ch)+'">'+mkPct0(ch,1)+'</b> 움직였어요.</p></div>'; }
  return '<div class="bt-dd-in">'+(d.chain?'<div class="bt-dd-ch">'+btChainHtml(d)+'</div>':'')
    +(mini?'<div class="bt-dd-c"><small>'+gEsc(d.a)+' 가격, '+(t?'매수 전후':'그 무렵')+' <i>USDT</i></small>'+mini+'</div>':'')
    +'<div class="bt-dd-f"><div class="bt-blk"><h4>'+(d.k==='sell'?'판 내용':'그날 확인한 조건')+'</h4>'+btFacts(d.facts.map(function(f){ return [f[0],gEsc(f[1])]; }),1)+btUpsHtml(d.ups)+'</div>'+after+'</div></div>';
}
/* AI 판단 전략의 재평가 하루 */
function btEvDetail(E){
  var f=E.ds[0], b=E.ds.filter(function(d){ return d.k==='buy'; });
  var L=[['AI가 비교한 것',gEsc(f.p0[0]+', '+f.p0[1])],['시장 확인',gEsc(f.p1[0]+', '+f.p1[1])],['결정',gEsc(E.out==='buy'?E.title+' 매수':f.p2[0]+', '+f.p2[1])]];
  return '<div class="bt-dd-in one"><div class="bt-dd-f"><div class="bt-blk"><h4>그날 확인한 조건</h4>'+btFacts(L)+btUpsHtml(E.ups)+'</div>'
    +(b.length?'<div class="bt-blk"><h4>그날 산 종목</h4>'+btFacts(b.map(function(d){ return [d.tk,gEsc(d.facts[0][1]+', 비중 '+d.facts[1][1]+', '+d.cmp)]; }))+'</div>':'')+'</div></div>';
}
function btRowHtml(x){
  var d=x.d||x.ev, ev=!!x.ev, on=BT.sel&&(ev?(BT.sel.t==='e'&&BT.sel.ix===d.ix):(BT.sel.t==='d'&&BT.sel.ix===d.ix)), g=!ev&&BT.grp&&d.ix>=BT.grp.a&&d.ix<=BT.grp.b&&d.k==='skip';
  return '<div class="bt-row k-'+d.k+(on?' on':'')+(g?' grp':'')+'"><button type="button" class="bt-rb" aria-expanded="'+!!on+'" onclick="'+(ev?'btSelEv(':'btSelDec(')+d.ix+')"><time class="num">'+btYMD(d.i)+'</time><span class="tg">'+d.tag+'</span><b>'+gEsc(d.title)+(d.pnl!=null?' <i class="num'+mkSign(d.pnl)+'">'+mkPct0(d.pnl,1)+'</i>':'')+'</b><span class="wy num">'+gEsc(d.cmp||d.why||'')+'</span><svg class="cv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>'
    +(on?(ev?btEvDetail(d):btDecDetail(d)):'')+'</div>';
}
function btDecRows(){
  var L=btDecList(BT.filt), n=L.length;
  return (n?L.slice(0,BT.decN).map(btRowHtml).join(''):'<p class="bt-none">이 종류의 판단은 없었어요</p>')
    +(n>BT.decN?'<button type="button" class="bt-more" onclick="BT.decN+=12;btEvRe()">이전 판단 '+Math.min(12,n-BT.decN)+'건 더 보기</button>':'');
}
/* 거래 하나: 가격이 움직여서 생긴 손익과 수수료를 나눠 보여 준다 */
function btTrDetail(t){
  var put=BT.amt*t.cost, got=t.got!=null?BT.amt*t.got:put*(1+t.pnl/100), mv=(t.xp/t.ep-1)*100, fee=t.pnl-mv;
  var L=[['산 날',btYMD(t.e)+', '+btPx(t.ep)],[t.open?'지금 가격':'판 날',(t.open?'':btYMD(t.x)+', ')+btPx(t.xp)],['들고 있던 기간',t.days+'일'],['넣은 돈',btUsd(put)]];
  var P=[['가격이 움직인 만큼','<i class="num'+mkSign(mv)+'">'+mkPct0(mv,1)+'</i>']].concat(t.open?[]:[['수수료','<i class="num">'+mkPct0(fee,1)+'</i>, 살 때와 팔 때 0.1%씩']]).concat([[t.open?'지금 손익':'이 거래의 손익','<i class="num'+mkSign(t.pnl)+'">'+mkPct0(t.pnl,1)+'</i>, '+btUsdS(got-put)]]);
  return '<div class="bt-dd-in"><div class="bt-dd-c"><small>'+gEsc(t.a)+' 가격, 매수 전후 <i>USDT</i></small>'+btTradeMini(t)+'<p class="bt-cap2">밝은 구간이 들고 있던 기간이에요</p></div>'
    +'<div class="bt-dd-f"><div class="bt-blk"><h4>거래</h4>'+btFacts(L.map(function(f){ return [f[0],gEsc(f[1])]; }))+'</div><div class="bt-blk"><h4>손익이 나온 과정</h4>'+btFacts(P)+(t.open?'':'<p class="bt-after">판 이유: '+gEsc(MK_WHY[t.why]||'')+'</p>')+'</div></div></div>';
}
function btTrList(){ var f=BT.trf; return BT.R.tr.filter(function(t){ return f==='win'?(!t.open&&t.pnl>0):f==='loss'?(!t.open&&t.pnl<=0):true; }); }
function btTrRows(){
  var L=btTrList(), n=L.length;
  return '<div class="bt-th"><span>종목</span><span>산 날</span><span>판 날</span><span class="r">기간</span><span class="r">손익</span><span></span></div>'
    +(n?L.slice(0,BT.ordN).map(function(t){ var on=BT.sel&&BT.sel.t==='t'&&BT.sel.id===t.id;
      return '<div class="bt-row bt-tr'+(on?' on':'')+'"><button type="button" class="bt-rb" aria-expanded="'+!!on+'" onclick="btSelTr('+t.id+')"><b>'+gEsc(mkTk(t.a))+'</b><time class="num"><i>매수</i>'+btYMD(t.e)+'</time><time class="num"><i>매도</i>'+(t.open?'보유 중':btYMD(t.x))+'</time><span class="r num">'+t.days+'일</span><span class="r num'+mkSign(t.pnl)+'">'+mkPct0(t.pnl,1)+'</span><svg class="cv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>'
        +(on?btTrDetail(t):'')+'</div>'; }).join(''):'<p class="bt-none">이 종류의 거래는 없었어요</p>')
    +(n>BT.ordN?'<button type="button" class="bt-more" onclick="BT.ordN+=12;btEvRe()">이전 거래 '+Math.min(12,n-BT.ordN)+'건 더 보기</button>':'');
}
function btTech(){
  var R=BT.R, r=R.r, row=function(k,v,t){ return '<div><dt>'+(t?mkdTerm(k,t):k)+'</dt><dd class="num">'+v+'</dd></div>'; };
  return '<details class="bt-tech"><summary>자세한 지표<svg class="cv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary><dl class="bt-dl bt-tech-g">'
    +row('승률',Math.round(R.win)+'%','끝난 거래 중 이익으로 끝난 거래의 비율이에요.')
    +row('손익비',(r.pf||0).toFixed(2),'이긴 거래에서 번 돈을 진 거래에서 잃은 돈으로 나눈 값이에요. 1보다 크면 번 돈이 더 많아요.')
    +row('1년으로 환산한 수익률',mkPct0(r.cagr||0,1),'이 기간의 수익률을 1년 기준으로 바꾼 값이에요.')
    +row('종목을 들고 있던 시간',Math.round(Math.min(100,r.exposure||0))+'%','전체 기간 중 종목을 들고 있던 날의 비율이에요. 나머지는 현금으로 기다렸어요.')
    +row('낸 수수료',btUsd(BT.amt*(r.costImpact||0)/100,1),'살 때와 팔 때 낸 수수료를 모두 더한 값이에요. 위 결과는 이 수수료를 뺀 뒤의 값이에요.')
    +row('가장 길게 회복을 기다린 기간',(r.underwaterDays||0)+'일','잔고가 그 전 가장 높았던 값으로 돌아오기까지 걸린 가장 긴 기간이에요.')
    +'</dl></details>';
}
function btChipsL(){ var s=BT.s, R=BT.R; return btAi(s)?[['opp',btOppL(s)+' '+R.nOpp],['buy',(s.kind==='agent'?'종목 매수 ':'매수 ')+R.nBuy],['skip',btSkipL(s)+' '+R.nSkip],['sell','매도 '+R.cnt.exit],['all','전체 활동']]:[['all','전체 활동'],['buy','매수 '+R.nBuy],['sell','매도 '+R.cnt.exit]]; }
/* 먼저 볼 만한 판단: 처음 산 날과 처음 사지 않은 날 */
function btShortcuts(){
  var R=BT.R, b=null, k=null; R.D.forEach(function(d){ if(!b&&d.k==='buy') b=d; if(!k&&d.k==='skip') k=d; });
  var o=[]; if(b) o.push(['처음 산 날',b]); if(k) o.push([BT.s.kind==='agent'?'처음 쉬어 간 날':'처음 보류한 날',k]);
  return o.length?'<div class="bt-short"><small>먼저 볼 만한 판단</small>'+o.map(function(x){ return '<button type="button" onclick="btMarkClick('+x[1].ix+','+x[1].ix+')">'+x[0]+' <i class="num">'+btYMD(x[1].i)+'</i></button>'; }).join('')+'</div>':'';
}
function btEvidence(){
  var R=BT.R, L=btTrList(), tf=BT.trf;
  return '<section class="bt-sec-b" id="bt-dec"><header><h3>왜 그렇게 판단했나요</h3><div class="bt-chips" role="group" aria-label="판단 종류">'+btChipsL().map(function(c){ return '<button type="button" aria-pressed="'+(BT.filt===c[0])+'" onclick="btFilt(\''+c[0]+'\')">'+c[1]+'</button>'; }).join('')+'</div></header>'+btShortcuts()+'<div class="bt-list" id="bt-dl">'+btDecRows()+'</div></section>'
    +'<section class="bt-sec-b" id="bt-trs"><header><h3>거래 하나씩 보기</h3><div class="bt-chips" role="group" aria-label="거래 종류">'+[['all','전체 '+R.tr.length],['win','이긴 거래 '+R.wins.length],['loss','진 거래 '+R.loss.length]].map(function(c){ return '<button type="button" aria-pressed="'+(tf===c[0])+'" onclick="btTrFilt(\''+c[0]+'\')">'+c[1]+'</button>'; }).join('')+'</div></header><div class="bt-list bt-tlist" id="bt-tl">'+btTrRows()+'</div></section>'
    +'<section class="bt-sec-b"><header><h3>달마다 어땠나요</h3><span>'+btMonthsSum()+'</span></header>'+btMonths()+'</section>'
    +btTech();
}
function btEvRe(){ var a=$('bt-dl'), b=$('bt-tl'); if(a) a.innerHTML=btDecRows(); if(b) b.innerHTML=btTrRows(); btPin(); }
function btFilt(k){ BT.filt=k; BT.decN=8; BT.grp=null; if(BT.sel&&BT.sel.t!=='t') BT.sel=null; var e=$('bt-ev'); if(e) e.innerHTML=btEvidence(); btPin(); }
function btTrFilt(k){ BT.trf=k; BT.ordN=8; if(BT.sel&&BT.sel.t==='t') BT.sel=null; var e=$('bt-ev'); if(e) e.innerHTML=btEvidence(); btPin(); }
function btSelDec(ix){ var d=BT.R.D[ix]; BT.sel=(BT.sel&&BT.sel.t==='d'&&BT.sel.ix===ix)?null:{t:'d',ix:ix,j:d.j}; btEvRe(); }
function btSelEv(ix){ var E=BT.R.EV[ix]; BT.sel=(BT.sel&&BT.sel.t==='e'&&BT.sel.ix===ix)?null:{t:'e',ix:ix,j:E.j}; btEvRe(); }
function btSelTr(id){ var t=btTradeOf(id); BT.sel=(BT.sel&&BT.sel.t==='t'&&BT.sel.id===id)?null:{t:'t',id:id,j:Math.max(0,Math.min(BT.R.N-1,t.e-BT.R.i0))}; btEvRe(); }

/* ── 내 전략: 대화에서 정한 조건을 새 백테스트 화면이 쓰는 차트 규칙 전략으로 옮긴다 ── */
var BT_MINE_ALIAS={'나스닥 종합':'나스닥'};
function btMineAsset(){ var t=tfS(), a=((t.intake||{}).asset||{}).label||''; a=BT_MINE_ALIAS[a]||a; return MK_PX_CFG[a]?a:null; }
function btMine(){
  var t=tfS(); if(!S.user||!t.intake||!t.intake.asset) return null;
  var a=btMineAsset(); if(!a) return null;
  var p=(t.cloneFrom&&t.pendingP)?t.pendingP:tfParams(t.aiSpec?{sl:t.aiSpec.sl,tp:t.aiSpec.tp,rsiTh:t.aiSpec.rsiTh,trendFilter:!!t.aiSpec.tf,fng:t.aiSpec.fng}:null), iv=t.intake, st=((iv.style||{}).label||'').replace(/으로$/,''), sl=Math.abs(p.sl);
  var cfg={id:'mine',kind:'rule',asset:a,rsiTh:p.rsiTh,tp:p.tp,sl:p.sl,tf:p.trendFilter?1:0,fng:p.fng!=null?p.fng:null,startI:61};
  var sig=JSON.stringify(cfg)+'|'+((iv.period||{}).i)+'|'+(t.cloneFrom||'')+'|'+(t.cloneFrom&&p.startI!=null?p.startI:''), h=0; for(var i=0;i<sig.length;i++) h=(h*31+sig.charCodeAt(i))>>>0;
  var name=(t.cloneFrom?t.cloneFrom+' 님 전략, ':'')+(t.aiSpec&&t.aiSpec.name?t.aiSpec.name:a+' 반등 매수');
  var one=mkJ(a,'이','가')+' 내려왔다가 다시 오르는 날 사요. '+(p.tp!=null?'산 가격보다 '+p.tp+'% 오르거나 ':'산 가격보다 ')+sl+'% 내려가면, 또는 25일이 지나면 팔아요.'+(p.fng!=null?' 공포 탐욕 지수가 '+p.fng+' 이하일 때만 사요.':'');
  return {id:'mine-'+h.toString(36),mine:true,kind:'rule',mkt:/비트코인|이더리움|솔라나|리플|도지코인|에이다|아발란체|비앤비/.test(a)?'crypto':'stock',
    nick:name,name:name,one:one,asset:a,uni:null,cfg:cfg,ex:null,p:p,fw:0,by:'',style:st};
}
/* 지금 조건과 다른 결과인가. 대화에서 만든 결과(sig 있음)만 따진다 */
function btMineStale(){ var t=tfS(), c=t.cur; if(!c||!c.sig) return false; var m=btMine(); return !m||m.id!==c.sig; }
/* 결과가 나오면 대화 흐름이 쓰는 검증 기록(t.cur)을 이 결과로 채운다. 점수 게이트는 없다 */
function btMineDone(){
  var t=tfS(), s=BT.s, R=BT.R; if(!s||!s.mine||!R) return;
  var p={}; for(var k in s.p) p[k]=s.p[k]; p.startI=R.eq[0].i; p.endI=R.eq[R.N-1].i; p.px=s.asset; p.eng='mk';
  var done=R.tr.filter(function(x){ return !x.open; });
  t.cur={ret:R.ret,mdd:R.mdd,n:done.length,winRate:done.length?R.wins.length/done.length*100:0,p:p,sig:s.id,asset:s.asset,
    trades:done.map(function(x){ return {entry:x.e,exit:x.x,pnl:x.pnl/100,kind:x.why||x.kind}; })};
  try{ var sc=tfScore(mkRunCfg(s.cfg,p.startI)); t.score=isFinite(sc)?sc:0; }catch(e){ t.score=0; }
  t.workDone=true; if(t.stage==='verify'||t.stage==='ready'||!t.stage) t.stage='connect'; tfSave();
}

/* ── 들어오고 나가기 ── */
function btOpen(ne){ location.hash='#/share/bt/'+ne; }
function btBack(){ if(BT.phase==='run'){ btStop(); btReady(); return; } if(BT.s&&BT.s.mine){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} TF_ONSTRAT=false; tfBackToChat(); return; } var ne=BT.s?tfSS3Rid(BT.s):''; if(history.length>1) history.back(); else tfSS3Go(ne,'all','ov'); }
function btView(){
  tfPageMode('tfbt','백테스트'); TF_RENDERING=true; gContent(btPage()); TF_RENDERING=false;
  var t=tfS().bt||{};
  if(t.id===BT.id&&t.done){ if(!BT.R) btCompute(); btSub(); btFinish(); }
  else btReady();
}
function btRoute(h){
  var m=h.match(/^#\/share\/bt\/([^/]+)(?:\/(go))?$/); TF_ONSHARE=true;
  if(m&&m[1]==='mine'&&!window.TF_STATE_READY){ TF_ONSHARE=false; return; } /* 부팅이 끝나면 다시 불린다 */
  if(!m){ TF_ONSHARE=false; tfShareHub('find'); return; }
  var s=null; try{ s=tfSSFind(decodeURIComponent(m[1])); }catch(e){}
  if(!s&&m[1]==='mine'){ TF_ONSHARE=false; toast('이 자산은 아직 백테스트할 가격 자료가 없어요'); try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} tfBackToChat(); return; }
  if(!s||!s.cfg){ TF_ONSHARE=false; tfShareHub('find'); return; }
  if(s.mine){ TF_ONSHARE=false; TF_ONSTRAT=true; } /* 뒤로 가면 전략 목록이 아니라 대화로 */
  var t=tfS().bt||{};
  if(BT.id!==s.id){ btStop(); BT.id=s.id; BT.s=s; BT.R=null; BT.phase='ready'; BT.sel=null; BT.grp=null; BT.filt=null; BT.trf='all'; BT.decN=8; BT.ordN=8; if(t.id===s.id){ if(t.per!=null) BT.per=t.per; if(t.amt) BT.amt=t.amt; } else if(s.mine){ var t9=tfS(), pi=((t9.intake||{}).period||{}).i; BT.per=pi===0?365:pi===1?730:pi===2?0:365;
    if(t9.cloneFrom&&s.p&&s.p.startI!=null){ var span=(PRICE0.length-1)-s.p.startI, best=0, bd=1e9; BT_PER.forEach(function(o){ var d=Math.abs((o[0]||PRICE0.length)-span); if(d<bd){ bd=d; best=o[0]; } }); BT.per=best; } } }
  BT.s=s;
  if(!m[2]){ btView(); return; }
  if(!BT.R) btCompute();
  btGoView();
}
var BT_RS=0; window.addEventListener('resize',function(){ if(G.mode!=='tfbt'||!$('bt-chart')||BT.phase==='run') return; clearTimeout(BT_RS); BT_RS=setTimeout(function(){ if($('bt-chart')) btChartDraw(); },160); });

/* 떠 있는 고객지원 단추가 실행 단추를 덮지 않게 비켜 세운다 */
var BT_FAB_T=0;
function btFabDodge(){
  var h=$('teth-help'); if(!h) return; var bt=document.querySelector('#g-content .bt');
  if(!bt){ if(h.style.bottom) h.style.bottom=''; if(h.style.visibility) h.style.visibility=''; return; } if(!h.offsetWidth) return;
  h.style.visibility=''; var tg=bt.querySelectorAll('.bt-cta, .bt-sec, .btg-out, #bt-rail p, #bt-rail b, #bt-rail dd, #bt-rail .num, .btg-flow p, .btg-flow .sm, .btg-flow .ed, .btg-flow input, .btg-flow li'), tries=['',20,150,230,310,400,500];
  for(var i=0;i<tries.length;i++){
    h.style.bottom=tries[i]===''?'':tries[i]+'px'; var f=h.getBoundingClientRect(), hit=false;
    for(var k=0;k<tg.length&&!hit;k++){ var r=tg[k].getBoundingClientRect(); if(!r.width||r.bottom<0||r.top>innerHeight) continue; hit=r.left<f.right+8&&r.right>f.left-8&&r.top<f.bottom+8&&r.bottom>f.top-8; }
    if(!hit) return;
  }
  h.style.bottom=''; h.style.visibility='hidden'; /* 비켜 설 자리가 없으면 내용을 덮지 않고 물러난다 */
}
function btFabTick(){ if(BT_FAB_T) return; BT_FAB_T=requestAnimationFrame(function(){ BT_FAB_T=0; try{ btFabDodge(); }catch(e){} }); }
document.addEventListener('scroll',btFabTick,true); window.addEventListener('resize',btFabTick); window.addEventListener('hashchange',function(){ setTimeout(btFabTick,500); });
try{ new MutationObserver(btFabTick).observe(document.getElementById('g-content')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-phase','class']}); }catch(e){}
