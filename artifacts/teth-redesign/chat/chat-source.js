
/* ── 개요의 대화: 전략이 자기 말로 지금 상태, 하는 일, 움직이는 방식을 말한다 ──
   글은 모두 엔진의 상태와 사건 기록에서 만든다. 사고 과정 원문이 아니라 본 것, 한 일, 다음에 할 일의 요약이다.
   한 말은 200~300자. 꼭 할 말(core)을 먼저 놓고, 하는 일과 움직이는 방식(opt)을 200자를 넘길 때까지 잇는다 */
var MK_WHY_P={trail:'산 뒤 가장 높았던 가격에서 많이 떨어졌어요',weak:'오르던 힘이 약해졌어요',rot:'더 강한 종목에 순위가 밀렸어요',sl:'많이 떨어져서 더 기다리지 않았어요',tp:'목표만큼 올랐어요',time:'산 지 25일이 지났어요'};
function mkList(a){ return a.join(', '); }
function mkSay(core,opt,R){
  var t=core.filter(Boolean).join(' '), i=0, all=opt.slice();
  if(R) for(var k in R) all.push(R[k]);
  for(;i<all.length&&t.length<205;i++){ var x=all[i]; if(!x||t.indexOf(x)>=0) continue; if(t.length+1+x.length>300) continue; t+=' '+x; }
  return t;
}
/* 실제 가격에서 뽑은 말: 들고 있던 동안의 가장 높고 낮았던 때, 사기 전에 얼마나 내려와 있었는지 */
function mkHeldTxt(r,tid){ var tr=null; (r.trades||[]).forEach(function(x){ if(x.id===tid) tr=x; }); if(!tr) return ''; var P=mkPx(tr.asset), hi=-1e9, lo=1e9; for(var i=tr.entry;i<=tr.exit;i++){ var v=(P[i]/tr.ep-1)*100; if(v>hi) hi=v; if(v<lo) lo=v; } var n=tr.exit-tr.entry; return '들고 있던 '+n+'일 동안 산 가격보다 가장 높았을 때는 '+mkPct0(Math.max(0,hi))+', 가장 낮았을 때는 '+mkPct0(Math.min(0,lo))+'였어요.'; }
function mkDipTxt(a,i){ var P=mkPx(a), hi=0; for(var k=Math.max(0,i-20);k<=i;k++) if(P[k]>hi) hi=P[k]; var d=(P[i]/hi-1)*100; return d<-0.05?mkJ(a,'은','는')+' 그때 최근 20일 중 가장 높았던 가격보다 '+Math.abs(d).toFixed(1)+'% 아래에 있었어요.':''; }
function mkDipNow(a){ var P=mkPx(a), i=P.length-1, hi=0; for(var k=Math.max(0,i-20);k<=i;k++) if(P[k]>hi) hi=P[k]; var d=(P[i]/hi-1)*100; return d<-0.05?'지금 '+mkJ(a,'은','는')+' 최근 20일 중 가장 높았던 가격보다 '+Math.abs(d).toFixed(1)+'% 아래에 있어요.':'지금 '+mkJ(a,'은','는')+' 최근 20일 중 가장 높은 가격에 있어요.'; }
/* 하는 일, 움직이는 방식을 한 문장씩. 어느 말에나 이어 붙일 수 있게 1인칭으로 쓴다 */
function mkRules(s,of){
  var c=s.cfg||{}, u=mkUni(s), ev=c.every===1?'매일':c.every+'일마다', n=of||u.list.length, need=Math.ceil((c.gate||0)*n);
  var sell='산 뒤에는 '+c.tp+'% 넘게 오르거나 '+Math.abs(c.sl)+'% 넘게 떨어진 날 팔아요.', cap='어느 쪽도 아니면 산 지 25일째에 팔아요.';
  if(s.kind==='agent') return {
    what:'저는 '+mkJ(u.label,'을','를')+' '+ev+' 비교해서, 많이 오르면서 덜 흔들리는 종목을 최대 '+c.top+'종목까지 나눠 담아요.',
    sell:'산 종목이 가장 높았던 가격에서 '+c.trail+'% 떨어지면 다음 비교를 기다리지 않고 그날 팔아요.',
    rest:'오르는 종목이 '+n+'종 중 '+need+'종에 못 미치면 시장이 약하다고 보고 새로 사지 않아요.',
    size:'한 종목에는 자산의 '+Math.round(100/c.top)+'%까지만 넣고, 많이 흔들리는 종목은 더 적게 넣어요.',
    skip:'두 달 평균 가격보다 낮은 종목은 많이 올랐어도 사지 않아요.',
    swap:'비교하는 날에 든 종목의 힘이 꺾였거나 순위가 '+(c.top+2)+'위 밖으로 밀렸으면 팔아요.'};
  if(s.kind==='mix') return {
    what:'저는 둘이 나눠서 일해요. 종목은 AI가 고르고, 사고파는 날은 정해 둔 조건이 정해요.',
    pick:'AI는 '+u.label+' 중 두 달 평균 가격보다 높고 최근 '+c.look+'일 동안 가장 많이 오른 하나를 골라요.',
    buy:'고른 종목이 떨어졌다가 하루에 0.5% 넘게 다시 오르는 날 사요.',
    sell:sell, cap:cap,
    rest:c.gate?'오르는 종목이 '+n+'종 중 '+need+'종에 못 미치면 조건이 맞아도 AI가 기다리게 해요.':'',
    size:'살 때는 한 종목에 가진 금액을 다 넣어요.',
    again:'들고 있지 않을 때는 '+c.every+'일마다 종목을 다시 골라요. 들고 있는 동안에는 바꾸지 않아요.'};
  return {
    what:'저는 '+s.asset+'만 봐요. '+mkDepth(c.rsiTh)+' 떨어졌다가 하루에 0.5% 넘게 다시 오르는 걸 확인해야 사요.',
    sell:sell, cap:cap,
    rest:'하루에 한 번, 장이 끝날 때만 판단해요. 조건이 맞지 않는 날은 아무것도 하지 않아요.',
    size:'살 때는 가진 금액을 한 번에 다 넣어요.',
    tf:c.tf?'최근 흐름이 뚜렷하지 않을 때는 떨어졌다가 다시 올라도 사지 않아요.':''};
}
function mkChatIntro(s){
  var R=mkRules(s), c=s.cfg||{}, u=mkUni(s);
  if(s.kind==='agent') return mkSay(['안녕하세요. '+R.what,R.skip,R.size],[R.swap,R.sell,R.rest,'보는 종목은 '+mkList(u.list)+'예요.'],R);
  if(s.kind==='mix') return mkSay(['안녕하세요. '+R.what,R.pick,R.buy],[R.sell,R.cap,R.rest,R.size,R.again],R);
  return mkSay(['안녕하세요. '+R.what,R.tf,R.sell],[R.cap,R.size,R.rest,'사고파는 건 정해 둔 조건만 따르고, 그때그때 기분으로 바꾸지 않아요.'],R);
}
function mkChatWait(q,tf,a){
  if(!q) return '살 조건이 맞기를 기다리고 있어요.';
  if(!q.rsiOk) return mkJ(a,'이','가')+' 아직 충분히 떨어지지 않았어요.';
  if(!q.bounceOk) return mkJ(a,'은','는')+' 충분히 떨어졌는데, 아직 다시 오르지 않았어요. 어제보다 '+mkPct0(q.bounce)+'예요.';
  if(tf&&!q.trendOk) return mkJ(a,'이','가')+' 떨어졌다가 다시 올랐지만, 최근 흐름이 아직 뚜렷하지 않아요.';
  if(q.mktOk===false) return '살 조건은 맞았지만 '+q.of+'종 중 '+q.up+'종만 오르고 있어서 기다리고 있어요.';
  return '살 조건이 맞기를 기다리고 있어요.';
}
function mkChatNow(s,r){
  var st=r.state, c=s.cfg||{}; if(!st) return '';
  var R=mkRules(s,st.scan&&st.scan.of);
  if(s.kind==='agent'){
    if(st.open.length) return mkSay(['지금은 '+mkJ(mkList(st.open.map(function(o){ return o.k; })),'을','를')+' 들고 있어요.','산 뒤로 '+st.open.map(function(o){ return o.k+' '+mkPct0(o.chg); }).join(', ')+'예요.',mkMD(st.nextEval)+'에 '+st.scan.of+'종을 다시 비교할게요.'],[R.what,R.sell,R.swap,R.rest,R.size],R);
    return mkSay(['지금은 아무것도 들고 있지 않아요.',st.scan.weak?st.scan.of+'종 중 '+st.scan.up+'종만 오르고 있어서 기다리는 중이에요.':'기준을 넘는 종목이 없어서 살 만한 종목을 찾고 있어요.',mkMD(st.nextEval)+'에 다시 비교할게요.'],[R.what,R.rest,R.skip,R.size,R.sell],R);
  }
  if(st.open) return mkSay(['지금 '+mkJ(st.open.k,'을','를')+' 들고 있어요.',mkMD(st.open.entry)+'에 '+mkPxFmt(st.open.ep)+'에 샀고, 지금은 '+mkPct0(st.open.chg)+', '+st.open.held+'일째예요.',c.tp+'% 넘게 오르거나 '+Math.abs(c.sl)+'% 넘게 떨어진 날 팔 거예요.','그 전에 팔지 않으면 '+Math.max(0,25-st.open.held)+'일 뒤에 팔아요.'],[R.what,s.kind==='mix'?R.pick:R.rest,R.size,R.again,R.tf],R);
  if(s.kind==='mix'){
    if(!st.pick) return mkSay(['지금은 고를 만한 종목이 없어서 기다리고 있어요.',mkMD(st.nextEval)+'에 다시 골라 볼게요.'],[R.what,R.pick,R.buy,R.sell,R.rest],R);
    return mkSay([mkJ(st.pick,'을','를')+' 골라 두고 기다리는 중이에요.',mkChatWait(st.cond,false,st.pick),'내일 장이 끝나면 다시 확인할게요.'],[mkDipNow(st.pick),R.buy,R.what,R.sell,R.rest,R.cap,R.again],R);
  }
  return mkSay(['지금은 사지 않고 기다리는 중이에요.',mkChatWait(st.cond,c.tf,s.asset),'내일 장이 끝나면 다시 확인할게요.'],[mkDipNow(s.asset),R.what,R.tf,R.sell,R.cap,R.size,R.rest],R);
}
function mkChatEv(s,e){
  var c=s.cfg||{}, R=mkRules(s,e.of), held=function(){ return e.held&&e.held.length?mkJ(mkList(e.held),'은','는')+' 계속 들고 있어요.':''; };
  if(s.kind==='agent'){
    if(e.t==='enter'){ var g={held:[],below:[],weak:[]}; (e.skip||[]).forEach(function(x){ g[x.why].push(x.k); });
      return {k:'buy',tag:'샀어요',t:mkSay([mkJ(e.a,'을','를')+' 새로 샀어요.',e.of+'종 중 '+e.up+'종이 오르고 있었고, '+mkJ(e.a,'은','는')+' 최근 '+c.look+'일 동안 '+mkPct0(e.mom,0)+' 올랐어요.',
        g.below.length?mkJ(mkList(g.below),'은','는')+' 더 앞순위였지만 두 달 평균 가격보다 낮아서 뺐어요.':'',g.held.length?mkJ(mkList(g.held),'은','는')+' 이미 들고 있었어요.':'',
        '자산의 '+Math.round(e.w*100)+'%를 '+mkPxFmt(e.px)+'에 넣었어요.'+(e.cut?' 많이 흔들리는 종목이라 넣는 돈을 줄였어요.':'')],[R.sell,R.size,R.swap,R.what])}; }
    if(e.t==='exit') return {k:'sell',tag:'팔았어요',t:mkSay([mkJ(e.a,'을','를')+' '+mkPxFmt(e.px)+'에 팔았어요.',MK_WHY_P[e.why]+'.','결과는 '+mkPct0(e.pnl)+'예요.'],[mkHeldTxt(s.r,e.tid),e.why==='trail'?R.sell:R.swap,e.pnl<0?'잃고 파는 거래도 있어요. 떨어지는 종목을 오래 들고 있지 않으려는 거예요.':'',R.what,e.why==='trail'?R.swap:R.sell,R.rest],R)};
    if(e.t==='skip'&&e.why==='gate') return {k:'wait',tag:'기다렸어요',t:mkSay(['새로 사지 않았어요.',e.of+'종 중 '+e.up+'종만 오르고 있어서 시장이 약하다고 봤어요.',held()],[R.rest,R.what,R.sell,R.skip],R)};
    if(e.t==='skip') return {k:'wait',tag:'기다렸어요',t:mkSay(['새로 사지 않았어요.','기준을 넘는 종목이 없었어요.'+((e.top||[]).length?' 가장 많이 오른 건 '+mkTopTxt(e.top)+'였어요.':''),held()],[R.skip,R.what,R.size,R.sell],R)};
    return {k:'hold',tag:'그대로 뒀어요',t:mkSay(['바꾸지 않았어요.','들고 있는 '+mkJ(mkList(e.held),'이','가')+' 여전히 앞순위에 있어요.',(e.top||[]).length?'지금 가장 많이 오른 건 '+mkTopTxt(e.top)+'예요.':''],[R.swap,R.sell,R.what,R.rest],R)};
  }
  if(e.t==='pick') return {k:'pick',tag:'골랐어요',t:mkSay([mkJ(e.a,'을','를')+' 골랐어요.','최근 '+c.look+'일 동안 가장 많이 오른 종목이에요.'+((e.top||[]).length?' 비교해 보니 '+e.top.slice(0,3).map(function(x){ return x.k+' '+mkPct0(x.mom,0); }).join(', ')+'였어요.':''),'아직 사지는 않았어요.'],[R.buy,R.rest,R.sell,R.cap,R.what],R)};
  if(e.t==='unpick') return {k:'wait',tag:'기다렸어요',t:mkSay(['고를 만한 종목이 없어서 비워 뒀어요.','두 달 평균 가격보다 높은 종목이 없었어요.'],[R.pick,R.again,R.what,R.buy,R.sell],R)};
  if(e.t==='veto') return {k:'wait',tag:'기다렸어요',t:mkSay([mkJ(e.a,'이','가')+' 떨어졌다가 다시 오르기 시작했지만 사지 않았어요.',e.of+'종 중 '+e.up+'종만 오르고 있어서 시장이 약하다고 봤어요.'],[R.rest,R.what,R.buy,R.sell],R)};
  if(e.t==='enter') return {k:'buy',tag:'샀어요',t:mkSay([mkJ(e.a,'을','를')+' '+mkPxFmt(e.px)+'에 샀어요.','충분히 떨어졌다가 하루 만에 '+mkPct0(e.bounce)+' 올라서 살 조건이 맞았어요.',R.size],[mkDipTxt(e.a,e.i),R.sell,R.cap,s.kind==='mix'?R.again:R.what,R.tf,R.rest],R)};
  return {k:'sell',tag:'팔았어요',t:mkSay([mkJ(e.a,'을','를')+' '+mkPxFmt(e.px)+'에 팔았어요.',MK_WHY_P[e.why]+'.','결과는 '+mkPct0(e.pnl)+'예요.'],[mkHeldTxt(s.r,e.tid),e.why==='time'?'25일은 제가 가장 오래 들고 있는 기간이에요. 목표에 닿지 않아도 그날은 팔아요.':e.why==='sl'?'잃고 파는 거래도 있어요. '+Math.abs(c.sl)+'% 넘게 떨어지면 더 기다리지 않기로 정해 뒀어요.':'목표는 산 가격보다 '+c.tp+'% 위예요.',s.kind==='mix'?R.again:R.what,s.kind==='mix'?R.pick:R.rest,R.tf,R.buy],R)};
}
/* 최신순. 맨 위는 지금, 그 아래로 최근 판단, 맨 아래는 소개. 같은 결론이 이어지면 하나로 묶는다 */
function mkChatMsgs(s,r,n){
  var out=[], ev=r.events||[], end=PRICE0.length-1, now=mkChatNow(s,r);
  if(now) out.push({i:end,k:'now',tag:'지금',t:now});
  for(var i=ev.length-1;i>=0&&out.length<(n||6)+1;i--){
    var m=mkChatEv(s,ev[i]), p=out[out.length-1];
    if(p&&p.k===m.k&&(m.k==='hold'||m.k==='wait')&&p.tag===m.tag&&p.i-ev[i].i<=40){ p.cnt=(p.cnt||1)+1; p.from=ev[i].i; continue; }
    m.i=ev[i].i; out.push(m);
  }
  out.push({i:s.cfg&&s.cfg.startI!=null?s.cfg.startI:0,k:'intro',tag:'소개',t:mkChatIntro(s)});
  return out;
}
