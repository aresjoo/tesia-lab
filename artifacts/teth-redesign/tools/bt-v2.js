/* ═══ 백테스트 여정 (bt) v2: 실제 AI 판단 문장, 실제 AI 해석, 100건이 넘어도 읽히는 판단 기록 ═══
   R02 결과 해석은 계산된 결과 숫자만 넘겨 모델이 쓴다. R04 판단 문장은 그날까지 알 수 있던 값만 넘겨 모델이 쓴다.
   결정 자체(사고, 보류하고, 파는 것)는 전략의 계산이 내린다. 모델은 그 결정을 그날의 값으로 설명한다. 호출이 실패하면 지어내지 않는다. */
var BT_AI={J:{},R:{},n:0};
function btAiCall(o,cb){
  var done=false, fin=function(e,t){ if(done) return; done=true; cb(e,t); }, to=setTimeout(function(){ fin('timeout'); },o.timeout||25000);
  var go=function(ok){ if(!ok){ clearTimeout(to); fin('offline'); return; }
    var body={messages:[{role:'user',content:o.user}],system:o.system}; if(o.think) body.think=true; else body.plain=true;
    fetch(TAI.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){ if(!r.ok) throw new Error('http '+r.status); return r.text(); })
      .then(function(raw){ clearTimeout(to); var t='', err=false, ok2=false; raw.split(/\n/).forEach(function(l){ if(l.indexOf('data:')!==0) return; try{ var j=JSON.parse(l.slice(5)); if(j.text) t+=j.text; if(j.error) err=true; if(j.done) ok2=true; }catch(e){} });
        t=btAiClean(t); if(err||!ok2||t.length<12) fin('bad'); else fin(null,t); })
      .catch(function(e){ clearTimeout(to); fin(String(e)); }); };
  if(typeof taiEnsure==='function') taiEnsure(go); else go(true);
}
/* 모델의 글에서 표식과 금지 부호를 걷어 낸다 */
function btAiClean(t){ return String(t||'').replace(/\[(?:NEXT|ACT|TITLE|CHART|SETUP|GAUGE|ASK|TLINE)[\s\S]*$/,'').replace(/[*#`>]/g,'').replace(/—|–/g,', ').replace(/·/g,', ').replace(/[ \t]+/g,' ').replace(/\n{2,}/g,'\n').trim(); }
function btR1(v,d){ return v==null||!isFinite(v)?null:+v.toFixed(d==null?1:d); }
/* 그날(i) 장 마감까지 알 수 있던 값만 모은다. i 뒤의 가격은 읽지 않는다 */
function btFactsAt(d){
  var R=BT.R, s=BT.s, c=s.cfg||{}, i=d.i, e=d.e||{}, fut=!!c.fut, a=d.a, o={날짜:btYMD(i),전략:mkHook(s),판단방식:MK_KIND[s.kind]+(fut?', 선물 롱과 숏'+(c.lev>1?' '+c.lev+'배':''):'')};
  var series=function(k){ return fut&&window.TETH_FUT&&TETH_FUT.sym[k]?TETH_FUT.sym[k].c:mkPx(k); };
  if(a){ var P=series(a), ch=function(n){ return i-n>=0?btR1((P[i]/P[i-n]-1)*100):null; }, hi=0, lo=1e18; for(var k=Math.max(0,i-19);k<=i;k++){ if(P[k]>hi) hi=P[k]; if(P[k]<lo) lo=P[k]; }
    var s20=0,s60=0; for(var k2=i-19;k2<=i;k2++) s20+=P[Math.max(0,k2)]; for(var k3=i-59;k3<=i;k3++) s60+=P[Math.max(0,k3)]; s20/=20; s60/=60;
    o.종목={이름:a,종가:+mkPxFmt(P[i]).replace(/,/g,''),'하루 변화':ch(1),'5일 변화':ch(5),'20일 변화':ch(20),'최근 20일 고점 대비':btR1((P[i]/hi-1)*100),'최근 20일 저점 대비':btR1((P[i]/lo-1)*100),'20일 평균 가격 대비':btR1((P[i]/s20-1)*100),'60일 평균 가격 대비':btR1((P[i]/s60-1)*100)};
    if(c.look) o.종목[c.look+'일 변화']=ch(c.look);
    try{ if(!fut&&typeof rsi==='function') o.종목['되돌림 점수(낮을수록 많이 밀림)']=Math.round(rsi(P,i-1)); }catch(x){}
    if(c.rsiTh&&!fut) o.종목['되돌림 점수 기준']=c.rsiTh+' 아래';
    if(e.ref) o.종목['돌파 기준 가격']=+mkPxFmt(e.ref).replace(/,/g,''); }
  if(e.up!=null&&e.of){ o.시장={'비교한 종목 수':e.of,'오름세 종목 수':e.up,'오름세의 뜻':'가격이 60일 평균 위'}; var ups=btUps(R.list,R.list.map(series),i); if(ups.length===e.up) o.시장['오름세 종목']=ups.map(mkTk); if(c.gate&&!fut) o.시장['매수에 필요한 오름세 종목 수']=Math.ceil(c.gate*e.of); if(fut&&c.gate){ var q=fuNeed(c,e.of); o.시장['롱 기준']=q.L+'개 이상'; o.시장['숏 기준']=q.S+'개 이하'; } }
  if(e.top&&e.top.length) o['강한 순서']=e.top.slice(0,3).map(function(x){ return mkTk(x.k)+' '+mkPct0(x.mom,1); });
  if(e.bot&&e.bot.length) o['약한 순서']=e.bot.slice(0,3).map(function(x){ return mkTk(x.k)+' '+mkPct0(x.mom,1); });
  if(e.rank) o.순위=e.rank+'위'; if(e.w) o.비중=Math.round(e.w*100)+'%';
  var f=window.TETH_PX&&TETH_PX.fng; if(f&&f[i]!=null&&(fut||(a&&MK_CRYPTO[a]))) o['공포 탐욕 지수(0 공포, 100 탐욕)']=f[i];
  var held=[]; R.tr.forEach(function(t){ if(t.e<=i&&(t.x==null||t.x>i)) held.push(mkTk(t.a)+(t.side?(t.side>0?' 롱':' 숏'):'')); }); o['그날 들고 있던 것']=held.length?held:'없음(현금)';
  var prev=null; R.tr.forEach(function(t){ if(t.x!=null&&t.x<=i&&(!prev||t.x>prev.x)) prev=t; }); if(prev) o['직전에 끝난 거래']=mkTk(prev.a)+' '+mkPct0(prev.pnl,1)+', '+(i-prev.x)+'일 전 종료';
  var j=Math.max(0,Math.min(R.N-1,d.j-1)); o['그날까지 전략의 누적 수익']=mkPct0((R.eq[j].v-1)*100,1);
  if(d.k==='sell'){ o['이 거래']={진입가:e.ep!=null?+mkPxFmt(e.ep).replace(/,/g,''):null,청산가:e.px!=null?+mkPxFmt(e.px).replace(/,/g,''):null,손익:mkPct0(d.pnl,1),사유:(fut?FU_WHY_P:MK_WHY_P)[e.why]||''}; }
  o['내려진 결정']=d.tag+(d.tk?' ('+d.tk+')':'');
  o.규칙=(fut?fuBtRules(s):btRules(s)).map(function(x){ return x[0]+': '+x[1]; });
  return o;
}
var BT_SYS_J='너는 TETH의 트레이딩 판단을 기록하는 분석가다. 입력은 과거 어느 날 장 마감 시점에 알 수 있었던 값뿐이다. 그날 이후의 가격과 결과는 모른다고 가정한다. 결정은 전략이 이미 내렸다. 그 결정을 내린 이유를 그날의 수치를 근거로 한국어 2문장 또는 3문장으로 쓴다. 문체는 합니다체(입니다, 합니다, 했습니다)로 통일한다. 입력에 있는 수치만 쓴다. 없는 수치, 뉴스, 사건은 지어내지 않는다. 가장 두드러진 사실부터 말하고, 매번 같은 틀로 시작하지 않는다. 마지막 문장은 그래서 무엇을 했는지로 끝낸다. 목록, 제목, 따옴표, 괄호 설명, 이모지, 긴 줄표, 가운뎃점은 쓰지 않는다. 전체 160자 안팎. 입력의 항목 이름을 그대로 옮기지 말고 사람이 말하듯 풀어 쓴다(예: 60일 평균 가격보다 11.4% 위). 날짜를 가리킬 때는 어제나 오늘이 아니라 이날이라고 쓴다. 종목 이름은 입력에 있는 그대로 쓴다.';
var BT_SYS_R='너는 TETH의 백테스트 결과를 읽어 주는 분석가다. 입력은 실제로 계산된 결과 숫자다. 검색이나 도구는 쓰지 않는다. 입력에 없는 숫자는 쓰지 않는다. 한국어 합니다체로 정확히 3문장을 쓰고, 문장마다 줄을 바꾼다. 첫 문장은 현물로 그냥 들고 있었을 때와 비교한 결론(남긴 금액의 차이와 흔들림의 차이). 둘째 문장은 전략이 실제로 어떻게 움직였는지(기회, 진입, 보류, 보유한 기간의 비율 중 의미 있는 것). 셋째 문장은 이 결과를 믿을 때 가장 조심할 점 한 가지(거래 수, 특정 거래 의존, 가장 나빴던 구간, 레버리지 중 실제 숫자가 뒷받침하는 것). 문장 하나는 70자를 넘기지 않는다. 숫자는 문장마다 두 개까지만 쓴다. 금액은 입력의 표기(쉼표 포함)를 그대로 쓴다. 과장하지 않는다. 권유하지 않는다. 목록, 제목, 따옴표, 이모지, 긴 줄표, 가운뎃점은 쓰지 않는다.';
function btJKey(d){ return BT.id+'|'+BT.per+'|'+d.ix+'|'+d.i+'|'+d.k; }
function btJudge(d,cb){
  var k=btJKey(d), J=BT_AI.J[k]; if(J&&J.st==='ok'){ if(cb) cb(J); return J; }
  if(J&&J.st==='load'){ if(cb) J.q.push(cb); return J; }
  J=BT_AI.J[k]={st:'load',t:'',q:cb?[cb]:[]};
  btAiCall({system:BT_SYS_J,user:JSON.stringify(btFactsAt(d)),timeout:20000},function(err,t){ if(err){ J.st='fail'; J.err=err; } else { J.st='ok'; J.t=t.replace(/\n+/g,' '); } var q=J.q; J.q=[]; q.forEach(function(f){ try{ f(J); }catch(e){} }); });
  return J;
}
/* ── 쉬운 말: 무엇을 봤고, 무엇을 했고, 그 뒤 어떻게 됐나 ── */
function btPlain(){
  var R=BT.R, s=BT.s, c=s.cfg||{}, fut=!!c.fut, n=R.list.length, T=R.T, series=function(k){ return fut&&window.TETH_FUT&&TETH_FUT.sym[k]?TETH_FUT.sym[k].c:mkPx(k); };
  var trOf=function(id){ var t=null; R.tr.forEach(function(x){ if(x.id===id) t=x; }); return t; };
  R.D.forEach(function(d){ var e=d.e||{}, tk=d.tk, sd=d.side?(d.side>0?'롱':'숏'):'';
    d.act=d.k==='buy'?(tk+' '+(fut?sd+' 진입':'매수')):d.k==='sell'?(tk+' '+(fut?sd+' 청산':'매도')):d.k==='pick'?(tk+(fut?' '+sd+' 후보':' 선정')):d.k==='hold'?'보유 유지':(tk?tk+' 보류':'쉬어 감');
    if(fut){ d.say=String(d.why||'').replace(/어요\.?$/,'습니다'); }
    else if(d.k==='buy'){ d.say=s.kind==='agent'?(n+'종목을 비교한 순위에서 '+(e.rank||1)+'번째로 강해 자산의 '+Math.round((e.w||0)*100)+'%로 매수했습니다'):(btGate(s)&&e.of?(e.of+'종목 중 '+e.up+'종목이 오름세여서 반등 신호를 받아들였습니다'):('밀린 뒤 하루 '+mkPct0(e.bounce||0,1)+' 반등해 조건이 맞았습니다')); }
    else if(d.k==='skip'&&d.tk){ d.say='반등 신호는 나왔지만 '+e.of+'종목 중 '+e.up+'종목만 오름세여서 기다렸습니다'; }
    else if(d.k==='skip'){ d.say=e.why==='gate'?('오름세 종목이 '+e.of+'개 중 '+e.up+'개뿐이라 새로 사지 않았습니다'):'기준을 넘는 종목이 없어 새로 사지 않았습니다'; }
    else if(d.k==='hold'){ d.say='보유 종목이 여전히 상위권이라 바꾸지 않았습니다'; }
    else if(d.k==='pick'){ d.say='최근 '+c.look+'일 동안 가장 강해 거래 대상으로 골랐습니다'; }
    else if(d.k==='sell'){ d.say=(MK_WHY_P[e.why]||'').replace(/다$/,'습니다').replace(/했습니다습니다$/,'했습니다').replace(/닿았습니다습니다$/,'닿았습니다'); }
    d.out=null;
    if(d.k==='buy'&&d.tid!=null){ var t=trOf(d.tid); if(t) d.out=t.open?{t:'보유 중',v:t.pnl}:{t:t.days+'일 뒤 '+(fut?'청산':'매도'),v:t.pnl}; }
    else if(d.k==='sell'&&d.pnl!=null) d.out={t:'이 거래',v:d.pnl};
    else if(d.k==='skip'&&d.a){ var P=series(d.a), q=Math.min(T,d.i+25); if(q>d.i) d.out={t:'그 뒤 '+(q-d.i)+'일',v:(P[q]/P[d.i]-1)*100,mute:1}; }
  });
}
/* ── 다시 돌리는 동안의 판단 패널: 바로 결과 보기는 없다. 대표 판단에서는 모델이 쓴 문장이 나온다 ── */
function btPanelInit(msg){
  var C=btCols();
  $('bt-panel').className='bt-panel c'+C.length; $('bt-panel').removeAttribute('data-st');
  $('bt-panel').innerHTML='<div class="ph" role="status" aria-live="polite"><span class="bt-dot idle" id="bt-pdot"></span><b class="num" id="bt-pdate"></b><span id="bt-pstate">'+(msg||'')+'</span><em class="num" id="bt-plast"></em></div>'
    +'<div class="pc">'+C.map(function(c,i){ return '<div class="cell" id="bt-pc'+i+'"><small><i class="num">'+(i+1)+'</i>'+c+'</small><b></b><span></span></div>'; }).join('')+'</div>'
    +'<div class="pj" id="bt-pjw" hidden><small>TETH의 판단</small><p id="bt-pj"></p></div>';
}
function btJStop(){ if(BT_AI.ty){ clearInterval(BT_AI.ty); BT_AI.ty=0; } if(BT_AI.wt){ clearTimeout(BT_AI.wt); BT_AI.wt=0; } }
function btJType(text,after){
  var w=$('bt-pjw'), p=$('bt-pj'); if(!w||!p){ if(after) after(); return; } btJStop(); w.hidden=false; w.className='pj on'; p.textContent=''; var t0=performance.now(), per=Math.max(9,Math.min(22,2600/text.length));
  /* 흐른 시간으로 글자 수를 정한다(탭이 가려져 타이머가 느려져도 제때 끝난다) */
  BT_AI.ty=setInterval(function(){ var i=Math.min(text.length,Math.floor((performance.now()-t0)/per)); p.textContent=text.slice(0,i); if(i>=text.length){ clearInterval(BT_AI.ty); BT_AI.ty=0; BT_AI.wt=setTimeout(function(){ BT_AI.wt=0; if(after) after(); },Math.min(2400,1000+text.length*8)); } },30);
}
/* 대표 판단에 닿으면 시계를 멈추고, 모델의 문장이 다 나온 뒤에 다시 간다. 기다림은 실제 호출이 걸린 시간이다 */
function btJShow(st){
  var d=st.ds.filter(function(x){ return x.k==='buy'; })[0]||st.ds[0]; if(!d||st.jShown) return; st.jShown=1; BT.pause=1;
  var w=$('bt-pjw'), p=$('bt-pj'); if(w){ w.hidden=false; w.className='pj wait'; try{ var sc=$('g-scroll'), pr=$('bt-panel').getBoundingClientRect(); if(sc&&pr.bottom>innerHeight-12) sc.scrollBy({top:pr.bottom-innerHeight+28,behavior:'smooth'}); }catch(x){} } if(p) p.textContent='그날까지의 값으로 판단을 정리하고 있습니다';
  var go=function(J){ if(BT.phase!=='run') return; var t=J.st==='ok'?J.t:(d.act+'. '+d.say+'.'); d.jt=J.st==='ok'?J.t:null; try{ var lb=$('bt-pjw').querySelector('small'); if(lb) lb.textContent=J.st==='ok'?'TETH의 판단':'계산된 근거 (판단 문장은 결과 화면에서 다시 불러올 수 있습니다)'; }catch(x){} btJType(t,function(){ BT.pause=0; var x=$('bt-pjw'); if(x) x.className='pj on rest'; }); };
  btJudge(d,go);
}
function btJPrefetch(){ (BT.R.stops||[]).forEach(function(st){ if(!st.full) return; var d=st.ds.filter(function(x){ return x.k==='buy'; })[0]||st.ds[0]; if(d) btJudge(d); }); }
/* ── 끝난 판단의 기록 한 줄: 칸막이 딱지 없이 ── */
function btDot(d){ return '<i class="bt-dt k-'+d.k+(d.side<0?' s':'')+'" aria-hidden="true"></i>'; }
function btOutHtml(d){ var o=d.out; if(!o) return ''; return '<span class="ot'+(o.mute?' m':'')+'"><small>'+o.t+'</small><i class="num'+mkSign(o.v)+'">'+mkPct0(o.v,1)+'</i></span>'; }
function btFeedRow(d){
  return '<div class="bt-fr v2 k-'+d.k+'"><time class="num">'+btYMD(d.i).slice(5)+'</time>'+btDot(d)+'<b>'+gEsc(d.act||d.title)+'</b>'+(d.pnl!=null?'<i class="num'+mkSign(d.pnl)+'">'+mkPct0(d.pnl,1)+'</i>':'')+'</div>';
}
/* ── 판단 기록: 요약이 먼저, 그다음에 고르고, 넘겨 본다 ── */
var BT_PAGE=12;
function btSum4(){ var R=BT.R, s=BT.s, fut=!!(s.cfg&&s.cfg.fut), ai=btAi(s), o=[];
  if(ai) o.push(['opp',s.kind==='agent'?'다시 비교한 날':'검토한 기회',R.nOpp]);
  o.push(['buy',fut?'진입':'매수',R.nBuy]); if(ai) o.push(['skip',s.kind==='agent'?'쉬어 감':'보류',R.nSkip]); o.push(['sell',fut?'청산':'매도',R.cnt.exit]);
  return o; }
function btDecList(f){
  var s=BT.s, R=BT.R, L;
  if(f==='opp') L=(s.kind==='agent'?R.EV.map(function(E){ return {ev:E}; }):R.D.filter(function(d){ return d.k==='buy'||d.k==='skip'; }).map(function(d){ return {d:d}; }));
  else L=R.D.filter(function(d){ return f==='all'?(d.k!=='pick'||s.kind==='mix'):d.k===f; }).map(function(d){ return {d:d}; });
  var so=BT.sort||'new', key=function(x){ return (x.d||x.ev).i; }, imp=function(x){ var d=x.d; return d&&d.out&&!d.out.mute?Math.abs(d.out.v):d&&d.pnl!=null?Math.abs(d.pnl):-1; };
  if(so==='old') L.sort(function(a,b){ return key(a)-key(b); }); else if(so==='big') L.sort(function(a,b){ return imp(b)-imp(a)||key(b)-key(a); }); else L.sort(function(a,b){ return key(b)-key(a); });
  return L;
}
function btRowHtml(x){
  var d=x.d||x.ev, ev=!!x.ev, on=BT.sel&&(ev?(BT.sel.t==='e'&&BT.sel.ix===d.ix):(BT.sel.t==='d'&&BT.sel.ix===d.ix)), g=!ev&&BT.grp&&d.ix>=BT.grp.a&&d.ix<=BT.grp.b&&d.k==='skip';
  var act=ev?(d.out==='buy'?d.title+' '+d.tag:d.title):(d.act||d.title), say=ev?(function(){ var B=d.ds.filter(function(q){ return q.k==='buy'; }); if(B.length>1) return BT.R.list.length+'종목을 비교해 순위가 높은 '+B.length+'종목을 나눠 매수했습니다'; return (d.ds[0]&&d.ds[0].say)||d.why||''; })():(d.say||d.why||''), dd=ev?(d.ds.filter(function(q){ return q.k==='buy'; })[0]||d.ds[0]):d;
  return '<div class="bt-row v2 k-'+d.k+(on?' on':'')+(g?' grp':'')+'"><button type="button" class="bt-rb" aria-expanded="'+!!on+'" onclick="'+(ev?'btSelEv(':'btSelDec(')+d.ix+')"><time class="num">'+btYMD(d.i).slice(2)+'</time>'+btDot(dd)+'<b>'+gEsc(act)+'</b><span class="wy">'+gEsc(say)+'</span>'+(ev?'':btOutHtml(d))
    +'<svg class="cv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>'
    +(on?(ev?btEvDetail(d):btDecDetail(d)):'')+'</div>';
}
function btDecRows(){
  var L=btDecList(BT.filt), n=L.length, N=Math.max(BT_PAGE,BT.decN||BT_PAGE), so=BT.sort||'new', out='', ym='';
  if(!n) return '<p class="bt-none">이 종류의 판단은 없었습니다</p>';
  L.slice(0,N).forEach(function(x){ var d=x.d||x.ev, dt=idxToDate(d.i), k=dt.getFullYear()+'년 '+(dt.getMonth()+1)+'월'; if(so!=='big'&&k!==ym){ ym=k; var c=0; L.forEach(function(y){ var t=idxToDate((y.d||y.ev).i); if(t.getFullYear()===dt.getFullYear()&&t.getMonth()===dt.getMonth()) c++; }); out+='<div class="bt-ym"><b>'+k+'</b><span class="num">'+c+'건</span></div>'; } out+=btRowHtml(x); });
  return out+(n>N?'<button type="button" class="bt-more" onclick="BT.decN='+(N+BT_PAGE*2)+';btEvRe()">이전 판단 더 보기 <i class="num">'+N+' / '+n+'</i></button>':(n>BT_PAGE?'<p class="bt-end num">'+n+'건을 모두 봤습니다</p>':''));
}
function btSort(v){ BT.sort=v; BT.decN=BT_PAGE; BT.sel=null; var e=$('bt-ev'); if(e) e.innerHTML=btEvidence(); btPin(); }
function btFilt(k){ BT.filt=k; BT.decN=BT_PAGE; BT.grp=null; if(BT.sel&&BT.sel.t!=='t') BT.sel=null; var e=$('bt-ev'); if(e) e.innerHTML=btEvidence(); btPin(); }
function btEvidence(){
  var R=BT.R, tf=BT.trf, so=BT.sort||'new', f=BT.filt, S4=btSum4(), fut=!!(BT.s.cfg&&BT.s.cfg.fut);
  return '<section class="bt-sec-b" id="bt-dec"><header class="v2"><h3>어떻게 판단했나</h3><label class="bt-sort"><span>정렬</span><select onchange="btSort(this.value)" aria-label="정렬">'+[['new','최신순'],['old','오래된순'],['big','결과가 큰 순']].map(function(o){ return '<option value="'+o[0]+'"'+(so===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')+'</select></label></header>'
    +'<div class="bt-s4 n'+(S4.length+1)+'" role="tablist" aria-label="판단 종류">'+S4.map(function(c){ return '<button type="button" role="tab" aria-selected="'+(f===c[0])+'" class="k-'+c[0]+'" onclick="btFilt(\''+c[0]+'\')"><small>'+c[1]+'</small><b class="num">'+c[2]+'<i>'+(c[0]==='opp'&&BT.s.kind==='agent'?'일':c[0]==='skip'&&BT.s.kind==='agent'?'일':c[0]==='opp'?'번':'건')+'</i></b></button>'; }).join('')
    +'<button type="button" role="tab" aria-selected="'+(f==='all')+'" class="k-all" onclick="btFilt(\'all\')"><small>전체 기록</small><b class="num">'+btDecList('all').length+'<i>건</i></b></button></div>'
    +'<div class="bt-list v2" id="bt-dl">'+btDecRows()+'</div></section>'
    +'<section class="bt-sec-b" id="bt-trs"><header><h3>거래 하나씩 보기</h3><div class="bt-chips" role="group" aria-label="거래 종류">'+[['all','전체 '+R.tr.length],['win','이긴 거래 '+R.wins.length],['loss','진 거래 '+R.loss.length]].map(function(c){ return '<button type="button" aria-pressed="'+(tf===c[0])+'" onclick="btTrFilt(\''+c[0]+'\')">'+c[1]+'</button>'; }).join('')+'</div></header><div class="bt-list bt-tlist" id="bt-tl">'+btTrRows()+'</div></section>'
    +'<section class="bt-sec-b"><header><h3>달마다 어땠나</h3><span>'+btMonthsSum()+'</span></header>'+btMonths()+'</section>'
    +btTech();
}
/* 판단 하나를 펼치면: 그날 TETH의 판단(모델이 그날의 값으로 쓴 문장), 그날의 가격, 확인한 조건, 그 뒤 */
function btJBlock(d){
  if(!btAi(BT.s)) return '';
  var id='bt-jb-'+d.ix, J=BT_AI.J[btJKey(d)]; if(!J) J=btJudge(d,function(){ var e=$(id); if(e) e.outerHTML=btJBlock(d); });
  return '<div class="bt-jb '+J.st+'" id="'+id+'"><h4>그날 TETH의 판단</h4>'+(J.st==='ok'?'<p>'+gEsc(J.t)+'</p>':J.st==='fail'?'<p class="f">판단 문장을 불러오지 못했습니다.</p><button type="button" onclick="btJRetry('+d.ix+')">다시 시도</button>':'<p class="l"><i></i><i></i><i></i></p>')+'</div>';
}
function btJRetry(ix){ var d=BT.R.D[ix]; if(!d) return; delete BT_AI.J[btJKey(d)]; var e=$('bt-jb-'+ix); if(e) e.outerHTML=btJBlock(d); }
/* ── 결과 해석: 계산된 숫자만 넘겨 모델이 쓴다 ── */
function btReadFacts(){
  var R=BT.R, s=BT.s, c=s.cfg||{}, r=R.r, fut=!!c.fut, cl=R.tr.filter(function(t){ return !t.open; }), best=null, worst=null; cl.forEach(function(t){ if(!best||t.pnl>best.pnl) best=t; if(!worst||t.pnl<worst.pnl) worst=t; });
  var dd=R.dd[R.N-1], o={전략:mkHook(s),판단방식:MK_KIND[s.kind],상품:fut?('선물 롱과 숏, 레버리지 '+(c.lev||1)+'배'):'현물',기간:btYMD(R.eq[0].i)+'부터 '+btYMD(R.eq[R.N-1].i)+'까지 '+R.N+'일',시작금액:BT.amt.toLocaleString()+' USDT',
    전략결과:{남은금액:Math.round(R.final).toLocaleString()+' USDT',수익률:mkPct0(R.ret,1),가장크게내려간폭:R.mdd.toFixed(1)+'%',가장나빴던구간:btYMD(R.eq[dd.a].i)+'부터 '+btYMD(R.eq[dd.b].i)+'까지'},
    현물로그냥보유:{남은금액:Math.round(R.benchFinal).toLocaleString()+' USDT',수익률:mkPct0(R.benchRet,1),가장크게내려간폭:R.benchMdd.toFixed(1)+'%'},
    그냥보유와의차이:(function(){ var d=Math.round(R.final)-Math.round(R.benchFinal); return d===0?'같음':('전략이 '+Math.abs(d).toLocaleString()+' USDT '+(d>0?'더 남김':'덜 남김')); })(),
    끝난거래:cl.length,이긴거래:R.wins.length,진거래:R.loss.length,평균보유일:Math.round(r.avgHold||0),포지션을든기간의비율:Math.round(Math.min(100,r.exposure||0))+'%'};
  if(btAi(s)){ o[s.kind==='agent'?'다시비교한횟수':'검토한기회']=R.nOpp; o[fut?'진입':'매수']=R.nBuy; o[s.kind==='agent'?'쉬어간횟수':'보류']=R.nSkip; }
  if(fut){ o.롱진입=R.D.filter(function(d){ return d.k==='buy'&&d.side>0; }).length; o.숏진입=R.D.filter(function(d){ return d.k==='buy'&&d.side<0; }).length; o.강제청산=r.liqN||0; o.낸펀딩비=mkPct0(-(r.fundPaid||0)*100,1)+' (시작 금액 대비)'; }
  if(best) o.가장좋았던거래=mkTk(best.a)+' '+mkPct0(best.pnl,1); if(worst) o.가장나빴던거래=mkTk(worst.a)+' '+mkPct0(worst.pnl,1);
  return o;
}
function btReadKey(){ var R=BT.R; return BT.id+'|'+BT.per+'|'+BT.amt+'|'+R.ret.toFixed(3)+'|'+R.N; }
function btReadHtml(){
  var k=btReadKey(), X=BT_AI.R[k]||{st:'load'};
  var body=X.st==='ok'?X.t.split(/\n+/).filter(Boolean).slice(0,4).map(function(x,i){ return '<p'+(i===0?' class="h"':'')+'>'+gEsc(x)+'</p>'; }).join('')
    :X.st==='fail'?'<p class="f">해석을 불러오지 못했습니다. 결과 숫자는 위에 그대로 있습니다.</p><button type="button" class="bt-rtry" onclick="btReadLoad(1)">다시 시도</button>'
    :'<div class="bt-sk" aria-label="결과를 읽는 중"><i></i><i></i><i></i></div><p class="l">결과를 읽고 있습니다</p>';
  return '<section class="bt-box bt-read v2 '+X.st+'" id="bt-read" aria-live="polite"><h3>TETH의 해석</h3>'+body+'</section>';
}
function btReadLoad(force){
  var k=btReadKey(), X=BT_AI.R[k]; if(X&&X.st==='ok'&&!force) return; if(X&&X.st==='load'&&!force) return;
  X=BT_AI.R[k]={st:'load'}; var paint=function(){ var e=$('bt-read'); if(e&&btReadKey()===k) e.outerHTML=btReadHtml(); }; paint();
  btAiCall({system:BT_SYS_R,user:JSON.stringify(btReadFacts()),timeout:40000},function(err,t){ if(err){ X.st='fail'; X.err=err; } else { X.st='ok'; X.t=t; } paint(); });
}
function btResultRail(){
  var R=BT.R, s=BT.s, pf=R.final-BT.amt, diff=Math.round(R.final)-Math.round(R.benchFinal);
  return '<section class="bt-box bt-verdict"><small>'+btPerL()+' 동안, '+btUsd(BT.amt)+'로</small>'
    +'<p class="bt-v1b"><b class="num'+mkSign(R.ret)+'">'+btUsdS(pf)+'</b></p>'
    +'<p class="bt-v2"><span>그냥 들고 있었다면 <i class="num">'+btUsdS(R.benchFinal-BT.amt)+'</i></span><b class="num '+(diff>=0?'mk-up':'mk-dn')+'">그보다 '+Math.abs(diff).toLocaleString()+' USDT '+(diff>=0?'많음':'적음')+'</b></p>'
    +'<div class="bt-k3"><div><small>가장 크게 내려간 폭</small><b class="num mk-dn">'+R.mdd.toFixed(1)+'%</b><em class="num">그냥 들고 있었다면 '+R.benchMdd.toFixed(1)+'%</em></div>'
    +'<div><small>이긴 거래</small><b class="num">'+btWinTxt()+'</b></div>'
    +'<div><small>평균 보유</small><b class="num">'+Math.round(R.r.avgHold||0)+'일</b></div></div></section>'
    +btReadHtml()
    +'<button type="button" class="bt-cta" onclick="btUse()">이 전략 실행하기</button>'
    +'<button type="button" class="bt-sec" onclick="btReady()">조건을 바꿔 다시 돌리기</button>'
    +'<p class="bt-rec num">'+TAI_CHECK+'<span>가격 '+(R.list.length*R.N).toLocaleString()+'개, '+R.N.toLocaleString()+'일을 확인했습니다</span></p>';
}
(function(){
  var c0=btCompute; btCompute=function(){ var r=c0.apply(this,arguments); try{ btPlain(); }catch(e){} return r; };
  var s0=btStart; btStart=function(){ BT.pause=0; btJStop(); var r=s0.apply(this,arguments); try{ if(BT.phase==='run') btJPrefetch(); }catch(e){} return r; };
  var f0=btFinish; btFinish=function(){ BT.pause=0; btJStop(); var r=f0.apply(this,arguments); try{ var w=$('bt-pjw'); if(w) w.hidden=true; var lg=document.querySelector('.bt-leg .b i'); if(lg) lg.textContent=mkPct0(BT.R.benchRet,1); btReadLoad(); }catch(e){} return r; };
  var p0=btPanelFill; btPanelFill=function(st,stage){ var r=p0.apply(this,arguments); try{ if(BT.phase==='run'&&st&&st.full&&stage===2&&!st.jShown&&btAi(BT.s)) btJShow(st); }catch(e){} return r; };
  var d0=btDecDetail; btDecDetail=function(d){ var h=d0.apply(this,arguments); try{ var j=btJBlock(d); if(j) h=h.replace('<div class="bt-dd-in">','<div class="bt-dd-in">'+j); }catch(e){} return h; };
})();
