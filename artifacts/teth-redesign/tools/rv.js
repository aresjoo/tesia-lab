/* ═══ 나쁜 백테스트 결과 뒤의 행동 (rv) ═══
   내 전략: "규칙 수정하기" → 그 전략을 만든 대화로 돌아가 TETH가 근거 있는 변경 하나와 대가를 제안 → "수정한 규칙으로 다시 검증하기" → 이전 판과 비교
   복사 전략: 규칙을 대화 형식으로 옮길 수 없으니 "다른 전략 만들기"만. 결과 요약을 새 대화에 붙인다
   나쁨 = 시작 돈보다 줄었거나 그냥 보유보다 낮음. 단추 순서의 기준일 뿐 딱지가 아니다 */
var RV={on:false,prop:null};
function rvTrades(){ var R=BT.R; return R?(R.wins.length+R.loss.length):0; }
function rvBad(){ var R=BT.R; if(!R||!rvTrades()) return false; return R.final<BT.amt||R.final<R.benchFinal; }
function rvSpecNow(){ var t=tfS(), s=t.aiSpec||{}, iv=t.intake||{}; var depth=s.rsiTh>=52?'shallow':s.rsiTh<=38?'deep':'mid';
  return {asset:(iv.asset||{}).label||'',depth:depth,tp:s.tp==null?null:s.tp,sl:s.sl,fng:s.fng==null?null:s.fng,trend:!!s.tf,period:['1y','2y','all'][(iv.period||{}).i||0]||'1y',name:s.name||null}; }
function rvRuleText(sp){ var dep={shallow:'조금',mid:'적당히',deep:'크게'}[sp.depth]||'적당히';
  return '사는 때: '+sp.asset+'이 '+dep+' 밀렸다가 하루 0.5% 넘게 반등한 날'+(sp.trend?', 방향이 뚜렷할 때만':'')+(sp.fng!=null?', 공포 탐욕 지수 '+sp.fng+' 이하일 때만':'')+'. 파는 때: '+(sp.tp!=null?'산 가격보다 '+sp.tp+'% 오르거나 ':'')+Math.abs(sp.sl)+'% 내리면, 또는 25일이 지나면'; }
function rvSnapNow(){ var R=BT.R, sp=rvSpecNow(), t=tfS(); return {at:Date.now(),spec:sp,rule:rvRuleText(sp),ai:JSON.parse(JSON.stringify(t.aiSpec||{})),pi:((t.intake||{}).period||{}).i,per:BT.per,amt:BT.amt,ret:R.ret,mdd:R.mdd,n:rvTrades(),bench:R.benchRet,final:R.final}; }
function rvSumCard(){ var R=BT.R, s=BT.s, diff=Math.round(R.final)-Math.round(R.benchFinal);
  return '<div class="rv-card"><b>'+gEsc(mkHook(s))+'</b><span>'+btPerL()+', '+btUsd(BT.amt)+'로 시작</span><div class="rv-kv"><div><small>수익률</small><i class="num'+mkSign(R.ret)+'">'+mkPct0(R.ret,1)+'</i></div><div><small>그냥 보유</small><i class="num">'+mkPct0(R.benchRet,1)+'</i></div><div><small>가장 크게 내려간 폭</small><i class="num">'+R.mdd.toFixed(1)+'%</i></div><div><small>거래</small><i class="num">'+rvTrades()+'번</i></div></div>'+(diff<0?'<em>그냥 보유보다 '+btUsd(Math.abs(diff))+' 덜 남겼습니다'+(Math.abs(R.mdd)<Math.abs(R.benchMdd)?'. 내려간 폭은 더 얕았습니다':'')+'</em>':'')+'</div>'; }
/* 결과 오른쪽 단추: 상태에 따라 순서가 바뀐다 */
function rvActs(){
  var s=BT.s, mine=!!(s&&s.mine), bad=rvBad(), none=!rvTrades();
  var run='<button type="button" class="bt-cta" onclick="btUse()">이 전략 실행하기</button>', runQ='<button type="button" class="bt-sec" onclick="btUse()">이 전략 실행하기</button>';
  var fix='<button type="button" class="bt-cta" onclick="rvFix()">규칙 수정하기</button>', mk='<button type="button" class="bt-sec" onclick="rvNew()">다른 전략 만들기</button>', mkC='<button type="button" class="bt-cta" onclick="rvNew()">다른 전략 만들기</button>';
  var links=function(L){ return '<p class="rv-links">'+L.map(function(x){ return '<button type="button" onclick="'+x[1]+'">'+x[0]+'</button>'; }).join('<i>·</i>')+'</p>'; };
  var note=none?'<p class="rv-note">거래가 한 번도 없어 결과를 판단하기 어렵습니다. 조건을 넓히거나 기간을 바꿔 보십시오.</p>':'';
  if(mine){ if(bad||none) return note+fix+mk+runQ; return run+links([['규칙 수정하기','rvFix()'],['다른 전략 만들기','rvNew()']]); }
  var why='<p class="rv-why">복사한 공개 전략은 규칙을 고칠 수 없습니다. 다른 전략을 직접 만들 수 있습니다.</p>';
  if(bad||none) return note+why+mkC+runQ;
  return run+links([['다른 전략 만들기','rvNew()']]);
}
/* 이전 판과 비교: 같은 기간과 금액일 때만 숫자를 나란히 놓는다 */
function rvCompare(){
  var t=tfS(), V=t.btVers||[], v=V[0], R=BT.R, s=BT.s; if(!v||!s||!s.mine||!R) return '';
  var same=v.per===BT.per&&v.amt===BT.amt, sp=rvSpecNow(), rule=rvRuleText(sp);
  var row=function(k,a,b,sg){ return '<div class="r"><span>'+k+'</span><i class="num">'+a+'</i><b class="num'+(sg||'')+'">'+b+'</b></div>'; };
  var up=R.ret>v.ret, sum=same?('수정 후 수익률은 '+mkPct0(v.ret,1)+'에서 '+mkPct0(R.ret,1)+'로 '+(up?'높아졌습니다':R.ret<v.ret?'낮아졌습니다':'같습니다')+'. 가장 크게 내려간 폭은 '+Math.abs(v.mdd).toFixed(1)+'%에서 '+Math.abs(R.mdd).toFixed(1)+'%로 '+(Math.abs(R.mdd)<Math.abs(v.mdd)?'줄었습니다':Math.abs(R.mdd)>Math.abs(v.mdd)?'커졌습니다':'같습니다')+'.'):'';
  return '<section class="bt-box rv-cmp"><small>이전 판과 비교</small>'
    +(same?'<p class="rv-sum">'+sum+'</p><p class="rv-same">같은 기간, 같은 시작 금액, 같은 가격 자료로 비교했습니다</p>':'<p class="rv-same warn">이전 검사와 기간이나 금액이 달라 결과 비교를 제공하지 않습니다</p>')
    +(same?'<div class="rv-rows"><div class="r h"><span></span><i>이전</i><b>이번</b></div>'+row('수익률',mkPct0(v.ret,1),mkPct0(R.ret,1),mkSign(R.ret-v.ret))+row('가장 크게 내려간 폭',v.mdd.toFixed(1)+'%',R.mdd.toFixed(1)+'%',mkSign(v.mdd-R.mdd))+row('거래 수',v.n+'번',rvTrades()+'번','')+'</div>':'')
    +'<details class="rv-det"><summary>바뀐 규칙 전체 보기</summary><div class="rv-rules"><div><small>이전 규칙</small><p>'+gEsc(v.rule)+'</p></div><div><small>이번 규칙</small><p>'+gEsc(rule)+'</p></div></div></details>'
    +'<div class="rv-cmp-acts"><button type="button" class="rv-prev" onclick="rvRevert()">이전 규칙으로 돌아가기</button><button type="button" class="rv-prev" onclick="rvPrevOpen()">이전 판 '+V.length+'개 보기</button></div></section>';
}
function rvPrevOpen(){ var V=(tfS().btVers||[]); if(!V.length) return;
  acConfirm({title:'이전 판',body:'',list:V.map(function(v){ return stDate(v.at)+' '+mkPct0(v.ret,1)+' (낙폭 '+v.mdd.toFixed(1)+'%, 거래 '+v.n+'번). '+v.rule; }),ok:'닫기',run:function(){}}); }
/* 규칙 수정하기: 그 대화로 돌아가 TETH가 먼저 한 가지를 제안한다 */
function rvHidden(){ var sp=rvSpecNow(), F=btReadFacts();
  return '[규칙 수정 요청] 내가 만든 전략을 백테스트했더니 결과가 아쉽다. 규칙 하나만 고쳐 다시 검증하려고 한다.\n지금 규칙: '+rvRuleText(sp)+'\n설정값: '+JSON.stringify(sp)+'\n결과: '+JSON.stringify(F)
    +'\n지시: 결과 숫자를 근거로 바꿔 볼 조건을 정확히 하나만 고르고, 그 대가(예: 더 오래 들면 수익과 손실 폭이 함께 커질 수 있음)를 함께 말하라. 원인을 단정하지 말고 "비교해 볼 값"으로 말하고, 더 좋은 결과를 뜻하지 않는다고 덧붙여라. 합니다체 3~4문장. 익절, 손절 같은 용어 대신 "산 가격보다 8% 오르면 파는 조건"처럼 풀어 써라. 검색과 도구는 쓰지 마라. 질문 카드(ASK), 선택 칩(NEXT), 실행(ACT) 태그는 붙이지 마라. 마지막 줄에 바뀐 설정 전체를 [STRATEGY {...}] 태그로 붙이되 "change" 키에 바꾼 항목 이름 하나(depth, tp, sl, fng, trend 중 하나)를 넣어라. asset, period, name은 그대로 두고 바꾼 값 하나만 다르게 하라.'; }
function rvBubble(line){ return '<div class="an-card">'+rvSumCard()+'</div><div class="an-line">'+line+'</div>'; }
function rvFix(){
  var t=tfS(); if(!BT.s||!BT.s.mine||!BT.R) return;
  if(TAI.req||(TAI.busy&&Date.now()-(TAI.busyAt||0)<180000)){ toast('이전 답변을 마무리하는 중입니다, 끝나면 다시 눌러 주십시오'); return; }
  t.btLast=rvSnapNow(); tfSave();
  var hidden=rvHidden(), html=rvBubble('결과를 보고 규칙을 하나 고쳐 다시 검증하고 싶습니다');
  var sid=t.aiSpec&&t.aiSpec.sess, sx=sid?G.sessions.filter(function(x){ return x.id===sid; })[0]:null;
  RV.on=true; RV.prop=null;
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  if(!sx){ gNew({text:hidden,html:html}); return; }
  gSelect(sx.id); if(G.mode!=='conv') gShowConv();
  gConvUser({html:html});
  taiEnsure(function(ok){ if(ok&&typeof taiMarket==='function'){ taiMarket(hidden,null,function(){ rvDraft(); }); } else rvDraft(); });
}
/* AI를 못 부르면 입력창에 초안을 넣어 사용자가 보내게 한다 */
function rvDraft(){ RV.on=false; var f=$('g-in'); if(f){ f.value='지금 규칙: '+rvRuleText(rvSpecNow())+'. 결과가 그냥 보유보다 낮았습니다. 파는 조건 하나를 바꿔 다시 검증하고 싶습니다.'; f.focus(); } toast('제안을 받지 못했습니다. 바꾸고 싶은 조건을 적어 보내 주십시오'); }
/* 다른 전략 만들기: 새 대화에 결과를 붙이고 다른 접근을 묻는다 */
function rvNew(){
  var s=BT.s, R=BT.R; if(!s||!R) return; var F=btReadFacts();
  var hidden='[새 전략 요청] "'+mkHook(s)+'" 전략을 백테스트했더니 결과가 아쉽다. 결과: '+JSON.stringify(F)+'\n지시: 이 결과를 근거로 같은 자산에서 접근이 다른 전략 방향 2가지를 짧게 제안하고, 어느 쪽으로 갈지 물어라. 각 방향은 사는 때와 파는 때를 한 문장씩. 합니다체. 더 좋은 결과를 보장하지 않는다고 덧붙여라. 검색과 도구는 쓰지 마라. 아직 [STRATEGY] 태그는 붙이지 말고, 사용자가 방향을 고르면 그때 붙여라.';
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  RV.on=false; gNew({text:hidden,html:rvBubble('이 결과를 보고 다른 방식의 전략을 만들고 싶습니다')});
}
/* 제안 카드: 이전 규칙과 바뀐 규칙, 다시 검증하기 */
function rvOne(sp){ var cur=rvSpecNow(), F=['depth','tp','sl','fng','trend'], ch=(sp&&F.indexOf(sp.change)>=0)?sp.change:null;
  if(!ch){ var d=F.filter(function(k){ return String(sp[k])!==String(cur[k]); }); ch=d[0]||null; }
  var out={}; for(var k in cur) out[k]=cur[k]; if(ch){ out[ch]=sp[ch]; if(ch==='sl') out.sl=-Math.abs(Number(sp.sl)||5); if(ch==='tp') out.tp=sp.tp==null?null:Number(sp.tp); if(ch==='fng') out.fng=sp.fng==null?null:Number(sp.fng); if(ch==='trend') out.trend=!!sp.trend; }
  out.change=ch; return out; }
function rvChangeText(cur,sp){ var k=sp.change; var pct=function(v){ return v==null?null:Math.abs(v)+'%'; };
  if(k==='tp') return cur.tp==null?'산 가격보다 '+pct(sp.tp)+' 오르면 파는 조건을 새로 넣습니다':sp.tp==null?'산 가격보다 '+pct(cur.tp)+' 오르면 팔던 조건을 없앱니다':'산 가격보다 '+pct(cur.tp)+' 오르면 팔던 조건을 '+pct(sp.tp)+'로 바꿉니다';
  if(k==='sl') return '산 가격보다 '+pct(cur.sl)+' 내리면 팔던 조건을 '+pct(sp.sl)+'로 바꿉니다';
  if(k==='fng') return cur.fng==null?'공포 탐욕 지수 '+sp.fng+' 이하일 때만 사는 조건을 새로 넣습니다':sp.fng==null?'공포 탐욕 지수 '+cur.fng+' 이하일 때만 사던 조건을 없앱니다':'공포 탐욕 지수 '+cur.fng+' 이하일 때만 사던 조건을 '+sp.fng+' 이하로 바꿉니다';
  if(k==='depth'){ var D={shallow:'조금',mid:'적당히',deep:'크게'}; return '사기 전에 밀리는 정도를 "'+(D[cur.depth]||'적당히')+'"에서 "'+(D[sp.depth]||'적당히')+'"로 바꿉니다'; }
  if(k==='trend') return sp.trend?'방향이 뚜렷할 때만 사는 조건을 켭니다':'방향이 뚜렷할 때만 사던 조건을 끕니다';
  return '조건 하나를 바꿉니다'; }
function rvProposal(sp){
  sp=rvOne(sp); var t=tfS(), before=rvRuleText(rvSpecNow()), after=rvRuleText(sp); RV.prop=sp;
  if(!sp.change||before===after){ taiThreadAdd('<div class="g-amsg"><p>바꿀 조건을 하나 고르지 못했습니다. 바꾸고 싶은 조건을 말해 주시면 그 조건으로 다시 검증합니다.</p></div>'); gScrollBottom(); return; }
  TAI.nn=(TAI.nn||0)+1; var id='rv'+Date.now().toString(36)+TAI.nn;
  var html='<div class="tf-sum rv-prop" id="'+id+'"><div class="h">바뀔 조건</div><p class="rv-ch">'+gEsc(rvChangeText(rvSpecNow(),sp))+'</p><details class="rv-det"><summary>규칙 전체 보기</summary><div class="rv-rules"><div><small>이전</small><p>'+gEsc(before)+'</p></div><div><small>이번</small><p>'+gEsc(after)+'</p></div></div></details>'
    +'<button class="tf-btn p" onclick="rvApply(\''+id+'\')">수정한 규칙으로 다시 검증하기</button><button class="tf-btn ghost" onclick="rvOther()">다른 수정 요청하기</button></div>';
  taiThreadAdd(html); gScrollBottom();
}
function rvApply(id){ var t=tfS(), sp=RV.prop; if(!sp) return; RV.on=false; RV.prop=null;
  if(t.btLast){ t.btVers=t.btVers||[]; t.btVers.unshift(t.btLast); t.btVers=t.btVers.slice(0,5); t.btLast=null; }
  var el=$(id); if(el){ var b=el.querySelectorAll('button'); [].forEach.call(b,function(x){ x.disabled=true; }); }
  RV.apply=true; try{ tfAiStrategy(sp); } finally{ RV.apply=false; }
  if(t.aiSpec) t.aiSpec.sess=G.cur&&G.cur.id; tfSave();
  var prev=(t.btVers||[])[0]; rvRerun(prev?prev.per:null,prev?prev.amt:null);
}
/* 같은 기간과 금액으로 백테스트를 바로 시작한다 */
function rvRerun(per,amt){ setTimeout(function(){ location.hash='#/share/bt/mine'; var n=0, iv=setInterval(function(){ n++; if(window.BT&&BT.s&&BT.s.mine&&BT.phase==='ready'&&document.getElementById('bt-root')){ clearInterval(iv); var ch=false; if(per!=null&&BT.per!==per){ BT.per=per; ch=true; } if(amt!=null&&BT.amt!==amt){ BT.amt=amt; ch=true; } if(ch) btReady(); setTimeout(function(){ try{ btStart(); }catch(e){} },300); } else if(n>60) clearInterval(iv); },150); },400); }
/* 이전 규칙으로 돌아가기: 저장해 둔 설정을 되살리고 같은 조건으로 다시 돌린다 */
function rvRevert(){ var t=tfS(), V=t.btVers||[], v=V[0]; if(!v||!v.ai) return; var now=rvSnapNow(); t.aiSpec=JSON.parse(JSON.stringify(v.ai)); if(t.intake&&t.intake.period&&v.pi!=null){ t.intake.period.i=v.pi; } t.cur=null; t.score=0; t.workDone=false; V.shift(); V.unshift(now); t.btVers=V.slice(0,5); tfSave(); toast('이전 규칙으로 돌아갑니다'); rvRerun(v.per,v.amt); }
function rvOther(){ var f=$('g-in'); if(f){ f.value='다른 조건을 바꿔서 제안해 주십시오: '; f.focus(); } }
(function(){
  /* 결과 오른쪽 단추를 상태에 맞게 바꾸고, 이전 판과 비교를 끼운다 */
  var rr0=btResultRail; btResultRail=function(){ var h=rr0.apply(this,arguments);
    var old='<button type="button" class="bt-cta" onclick="btUse()">이 전략 실행하기</button><button type="button" class="bt-sec" onclick="btReady()">조건을 바꿔 다시 돌리기</button>';
    if(h.indexOf(old)>=0) h=h.replace(old,rvCompare()+rvActs()); return h; };
  /* 규칙 수정 대화에서는 [STRATEGY] 태그를 바로 적용하지 않고 제안 카드로 보여 준다. 만든 대화의 세션을 기억한다 */
  var ai0=tfAiStrategy; tfAiStrategy=function(sp){ if(RV.on&&!RV.apply){ rvProposal(sp); return; } var r=ai0.apply(this,arguments); try{ var t=tfS(); if(t.aiSpec&&G.cur) t.aiSpec.sess=G.cur.id; }catch(e){} return r; };
})();
