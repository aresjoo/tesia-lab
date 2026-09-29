
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
