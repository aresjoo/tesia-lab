/** Extracted pure presentation functions from aresjoo/tesia-lab 412fd6042e0b3935773831f43163a7da68191162.
 * No DOM, HTML injection, network, eval, trading authority, or stale MK_VOICE.
 * The original Korean narrative is source-language content. UI labels localize separately.
 */
export const judgmentSourceSha = '412fd6042e0b3935773831f43163a7da68191162'
export function createJudgmentRuntime({ prices, date, length, universes, symbol }) {
  const mkPx = prices, idxToDate = date, PRICE0 = { length }, MK_UNI = universes, skSym = symbol
  // Source timestamps synthesize seconds; only recorded civil dates are exposed.
  const mkTS = (_s, i) => date(i).toISOString().slice(0, 10)
  // Historical authored prose has no data-version binding and conflicts with this snapshot.
  const MK_VOICE = undefined
function mkPxFmt(v){ if(v==null||!isFinite(v)) return '-'; var a=Math.abs(v); return a>=1000?Math.round(v).toLocaleString():a>=100?v.toFixed(1):a>=1?v.toFixed(2):v.toFixed(4); }
function mkList(a){ return a.join(', '); }
function mkPxU(a,v){ return (a==='나스닥'||a==='S&P 500')?mkPxFmt(v)+'포인트':'$'+mkPxFmt(v); }
function mkInst(a){ return MK_CRYPTO[a]?'현물':(a==='나스닥'||a==='S&P 500')?'토큰화 지수':a==='금'?'토큰화 금':'토큰화 주식'; }
function mkTagIO(s,a,out){ var W=mkWords(s); return W.inst==='선물'?(out?W.tagOut:W.tagIn):mkInst(a)+(out?' 매도':' 매수'); }
function mkWords(s){
  var c=s.cfg||{}, fut=c.inst==='futures', sh=c.dir==='short';
  if(c.fut) return {inst:'선물',tagIn:'선물 진입',tagOut:'선물 청산',buy:'진입',sell:'청산',hold:'포지션 유지'};
  if(!fut) return {inst:'현물',tagIn:'현물 매수',tagOut:'현물 매도',buy:'매수',sell:'매도',hold:'보유'};
  return {inst:'선물',tagIn:'선물 '+(sh?'숏':'롱')+' 진입',tagOut:'선물 '+(sh?'숏':'롱')+' 청산',buy:(sh?'숏':'롱')+' 진입',sell:(sh?'숏':'롱')+' 청산',hold:(sh?'숏':'롱')+' 포지션 유지'};
}
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
function mkRules(s,of){
  if(fuIs(s)) return fuRules(s);
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
function mkHeldTxt(r,tid){ var tr=null; (r.trades||[]).forEach(function(x){ if(x.id===tid) tr=x; }); if(!tr) return ''; var P=mkPx(tr.asset), hi=-1e9, lo=1e9; for(var i=tr.entry;i<=tr.exit;i++){ var v=(P[i]/tr.ep-1)*100; if(v>hi) hi=v; if(v<lo) lo=v; } return '보유 '+(tr.exit-tr.entry)+'일 동안 진입가 대비 최고 '+mkPct0(Math.max(0,hi))+', 최저 '+mkPct0(Math.min(0,lo))+'였다.'; }
function mkDipAt(a,i){ var P=mkPx(a), hi=0; for(var k=Math.max(0,i-19);k<=i;k++) if(P[k]>hi) hi=P[k]; return (P[i]/hi-1)*100; }
function mkDipTxt(a,i){ var d=mkDipAt(a,i); return d<-0.05?'진입 시점에 '+mkJ(a,'은','는')+' 최근 20일 고점 대비 '+Math.abs(d).toFixed(1)+'% 아래에 있었다.':''; }
function mkDipNow(a){ var d=mkDipAt(a,mkPx(a).length-1); return d<-0.05?'현재 '+mkJ(a,'은','는')+' 최근 20일 고점 대비 '+Math.abs(d).toFixed(1)+'% 아래에 있다.':'현재 '+mkJ(a,'은','는')+' 최근 20일 고점에 있다.'; }
function mkChatIntro(s){
  if(fuIs(s)) return fuChatIntro(s);
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
  if(fuIs(s)) return fuChatNow(s,r);
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
  if(fuIs(s)) return fuChatEv(s,e);
  var c=s.cfg||{}, R=mkRules(s,e.of), W=mkWords(s), held=function(){ return e.held&&e.held.length?mkJ(mkList(e.held),'은','는')+' 계속 '+W.hold+'한다.':''; };
  if(s.kind==='agent'){
    if(e.t==='enter'){ var g={held:[],below:[],weak:[]}; (e.skip||[]).forEach(function(x){ g[x.why].push(x.k); });
      return {k:'buy',tag:mkTagIO(s,e.a,0),a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 신규 '+W.buy+'했다.',e.of+'종 중 '+e.up+'종이 상승 추세였고, '+e.a+'의 최근 '+c.look+'일 상승률은 '+mkPct0(e.mom,0)+'다.',
        g.below.length?mkJ(mkList(g.below),'은','는')+' 순위가 더 높았으나 60일 이동평균 아래여서 제외했다.':'',g.held.length?mkJ(mkList(g.held),'은','는')+' 이미 보유 중이었다.':'',
        '자산의 '+Math.round(e.w*100)+'%를 체결가 '+mkPxU(e.a,e.px)+'에 투입했다.'+(e.cut?' 변동성이 커서 비중을 줄였다.':'')],[R.sell,R.size,R.swap,R.what],R)}; }
    if(e.t==='exit') return {k:'sell',tag:mkTagIO(s,e.a,1),a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 체결가 '+mkPxU(e.a,e.px)+'에 '+W.sell+'했다.',MK_WHY_P[e.why]+'.','실현 손익은 비용 차감 후 '+mkPct0(e.pnl)+'다.'],[mkHeldTxt(s.r,e.tid),e.why==='trail'?R.sell:R.swap,e.pnl<0?'손실로 끝나는 거래도 있다. 하락하는 종목을 오래 들고 있지 않기 위한 규칙이다.':'',R.what,e.why==='trail'?R.swap:R.sell,R.rest],R)};
    if(e.t==='skip'&&e.why==='gate') return {k:'wait',tag:'관망',t:mkSay(['신규 '+W.buy+'를 하지 않았다.',e.of+'종 중 '+e.up+'종만 상승 추세여서 시장 약세로 판단했다.',held()],[R.rest,R.what,R.sell,R.skip],R)};
    if(e.t==='skip') return {k:'wait',tag:'관망',t:mkSay(['신규 '+W.buy+'를 하지 않았다.','기준을 넘는 종목이 없었다.'+((e.top||[]).length?' 순위 상위는 '+mkTopTxt(e.top)+'였다. 순위는 상승률을 변동성으로 나눠 매긴다.':''),held()],[R.skip,R.what,R.size,R.sell],R)};
    return {k:'hold',tag:'보유 유지',t:mkSay(['종목을 교체하지 않았다.',W.hold+' 중인 '+mkJ(mkList(e.held),'이','가')+' 여전히 상위권이다.',(e.top||[]).length?'순위 상위는 '+mkTopTxt(e.top)+'다. 순위는 상승률을 변동성으로 나눠 매기므로 상승률 순서와 다를 수 있다.':''],[R.swap,R.sell,R.what,R.rest],R)};
  }
  if(e.t==='pick') return {k:'pick',tag:'종목 선정',a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 거래 대상으로 선정했다.','최근 '+c.look+'일 상승률이 가장 높았다.'+((e.top||[]).length?' 비교 결과는 '+e.top.slice(0,3).map(function(x){ return x.k+' '+mkPct0(x.mom,0); }).join(', ')+'였다.':''),'아직 '+W.buy+'하지는 않았다.'],[R.buy,R.rest,R.sell,R.cap,R.what],R)};
  if(e.t==='unpick') return {k:'wait',tag:'관망',t:mkSay(['거래 대상을 비웠다.','60일 이동평균 위에 있는 종목이 없었다.'],[R.pick,R.again,R.what,R.buy,R.sell],R)};
  if(e.t==='veto') return {k:'wait',tag:'관망',a:e.a,t:mkSay([mkJ(e.a,'이','가')+' 되돌림 후 반등했으나 진입하지 않았다.',e.of+'종 중 '+e.up+'종만 상승 추세여서 시장 약세로 판단했다.'],[R.rest,R.what,R.buy,R.sell],R)};
  if(e.t==='enter') return {k:'buy',tag:mkTagIO(s,e.a,0),a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 체결가 '+mkPxU(e.a,e.px)+'에 '+W.buy+'했다.','되돌림 후 하루 만에 '+mkPct0(e.bounce)+' 반등해 진입 조건이 충족됐다.',R.size],[mkDipTxt(e.a,e.i),R.sell,R.cap,s.kind==='mix'?R.again:R.what,R.tf,R.rest],R)};
  return {k:'sell',tag:mkTagIO(s,e.a,1),a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 체결가 '+mkPxU(e.a,e.px)+'에 '+W.sell+'했다.',MK_WHY_P[e.why]+'.','실현 손익은 비용 차감 후 '+mkPct0(e.pnl)+'다.'],[mkHeldTxt(s.r,e.tid),e.why==='time'?'25일은 최대 보유 기간이다. 목표에 닿지 않아도 그날 청산한다.':e.why==='sl'?Math.abs(c.sl)+'% 이상 하락하면 추가로 기다리지 않도록 정해 두었다.':'익절 목표는 진입가 대비 +'+c.tp+'%다.',s.kind==='mix'?R.again:R.what,s.kind==='mix'?R.pick:R.rest,R.tf,R.buy],R)};
}
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
  /* 미리 써 둔 글이 있으면 그 글을 쓴다. 열쇠는 기록의 종류와 날짜 번호와 종목 */
  var V=(typeof MK_VOICE!=='undefined'&&MK_VOICE[s.id])||null;
  if(V) out.forEach(function(m){ var key=m.k==='now'?'now':m.k==='intro'?'intro':'e'+m.i+(m.a?'_'+m.a:'')+'_'+m.k; if(V[key]) m.t=V[key]; });
  return out;
}
function mkChatTitle(s,m){ var a=m.a?mkTk(m.a):'', fut=/^선물 /.test(m.tag||''), t=fut?m.tag.replace(/^선물 /,''):'';
  if(m.k==='now') return '현재 판단'; if(m.k==='intro') return '전략 개요';
  if(m.k==='buy') return a+' '+(fut?t:'매수'); if(m.k==='sell') return a+' '+(fut?t:'매도');
  if(m.k==='pick') return a+(fut?' '+t:' 선정'); if(m.k==='hold') return '보유 유지'; return a?a+' 관망':'관망'; }
function mkTopTxt(top){ return (top||[]).slice(0,2).map(function(x){ return x.k+' '+mkPct0(x.mom,0); }).join(', '); }
function mkJ(w,a,b){ var c=String(w).charCodeAt(String(w).length-1); if(c<0xAC00||c>0xD7A3) return w+a; return w+(((c-0xAC00)%28)?a:b); }
function mkPct0(v,d){ var n=d!=null?d:1, x=+v.toFixed(n); return (x>0?'+':'')+x.toFixed(n)+'%'; }
function mkUni(s){ return MK_UNI[s.uni]||{label:s.asset||'',list:s.asset?[s.asset]:[]}; }
function mkMD(i){ var d=idxToDate(i); return (d.getMonth()+1)+'월 '+d.getDate()+'일'; }
function mkTk(k){ return MK_TK[k]||k; }
function fuOp(st){ var o=st&&st.open; return !o?[]:o.length!=null?o:[o]; }
function fuIs(s){ return !!(s&&s.cfg&&s.cfg.fut); }
function fuSd(v){ return v>0?'롱':'숏'; }
function fuPct(g){ return Math.round(g*100)+'%'; }
function fuNeed(c,n){ return {L:Math.ceil(c.gate*n-1e-9),S:Math.floor((1-c.gate)*n+1e-9)}; }
function fuAiTxt(s){ var c=s.cfg, u=mkUni(s), n=u.list.length, q=fuNeed(c,n), ev=c.every===1?'매일':c.every+'일마다';
  var cL=q.L>=n?n+'종목이 모두 오름세면':'오름세 종목이 '+q.L+'개 이상이면', cS=q.S<=0?'하나도 오름세가 아니면':'오름세 종목이 '+q.S+'개 이하면';
  if(c.kind==='agent') return ev+' '+n+'종목을 비교합니다. '+cL+' 가장 강한 '+c.top+'종목을 롱, '+cS+' 가장 약한 '+c.top+'종목을 숏'+(q.L-q.S>1?', 그 사이면 쉽니다':'');
  return ev+' 방향과 종목을 정합니다. '+cL+' 가장 강한 종목을 롱 후보로, '+cS+' 가장 약한 종목을 숏 후보로'+(q.L-q.S>1?', 그 사이면 후보를 비웁니다':' 고릅니다'); }
function fuSig(c){
  if(c.mode==='brk') return '종가가 최근 '+c.n+'일 최고가를 넘으면 롱, 최근 '+c.n+'일 최저가 아래로 내려가면 숏';
  if(c.mode==='ma') return c.fast+'일 평균 가격이 '+c.slow+'일 평균을 위로 넘으면 롱, 아래로 내려가면 숏';
  if(c.mode==='dip') return '최근 '+c.n+'일 고점에서 '+c.dip+'% 넘게 밀렸다가 반등하면 롱, 저점에서 '+c.dip+'% 넘게 올랐다가 꺾이면 숏';
  if(c.mode==='fg') return '공포 탐욕 지수가 '+c.lo+' 이하일 때 반등하면 롱, '+c.hi+' 이상일 때 꺾이면 숏';
  return ''; }
function fuOuts(c){ var o=[]; if(c.kind!=='agent') o.push('반대 방향 신호가 나오면 닫고 방향을 바꿉니다'); if(c.exitN) o.push('종가가 반대쪽 '+c.exitN+'일 기준선을 벗어나면 닫습니다'); if(c.trail) o.push('가장 유리했던 종가에서 '+c.trail+'% 되돌리면 닫습니다'); if(c.sl) o.push('진입가에서 '+c.sl+'% 불리하게 움직이면 닫습니다'); if(c.tp) o.push('진입가에서 '+c.tp+'% 유리하게 움직이면 닫습니다'); if(c.hold) o.push('길어도 '+c.hold+'일'); return o; }
function fuEv(s,e){ var c=s.cfg, tk=e.a?mkTk(e.a):'', sd=e.side?fuSd(e.side):'';
  if(e.t==='pick') return {k:'pick',who:'AI',obs:e.of+'종 중 '+e.up+'종이 오름세. '+(e.side>0?'가장 강한 건 '+mkTopTxt(e.top):'가장 약한 건 '+mkTopTxt(e.bot)),dec:mkJ(tk,'을','를')+' '+sd+' 후보로 골랐습니다',act:'규칙이 신호를 기다리기 시작'};
  if(e.t==='unpick') return {k:'wait',who:'AI',obs:e.of+'종 중 '+e.up+'종이 오름세. 방향이 애매함',dec:'후보를 비웠습니다',act:'주문 없음'};
  if(e.t==='veto') return {k:'wait',who:'AI',obs:tk+' '+fuSd(e.side)+' 신호 발생. 그런데 AI가 본 시장 방향과 달라요('+e.of+'종 중 '+e.up+'종 오름세)',dec:'진입을 보류했습니다',act:'주문 없음'};
  if(e.t==='skip') return {k:'wait',obs:e.of+'종 중 '+e.up+'종이 오름세',dec:e.why==='gate'?'방향이 애매해 쉬었습니다':'조건에 맞는 종목이 없어 쉬었습니다',act:(e.held||[]).length?e.held.map(mkTk).join(', ')+' 유지':'주문 없음'};
  if(e.t==='hold') return {k:'hold',obs:e.of+'종 중 '+e.up+'종이 오름세. 가장 강한 건 '+mkTopTxt(e.top),dec:'포지션을 바꾸지 않았습니다',act:(e.held||[]).map(mkTk).join(', ')+' 유지'};
  if(e.t==='enter') return {k:'buy',who:c.kind==='mix'?'규칙':null,obs:c.kind==='agent'?(e.of+'종 중 '+e.up+'종이 오름세. '+tk+'의 '+c.look+'일 흐름 '+mkPct0(e.mom,0)+', '+(e.side>0?'강한 쪽 ':'약한 쪽 ')+e.rank+'위'):(tk+', '+(c.mode==='brk'?'종가가 최근 '+c.n+'일 '+(e.side>0?'최고가':'최저가')+' '+mkPxFmt(e.ref)+'을(를) '+(e.side>0?'넘음':'아래로 벗어남'):c.mode==='ma'?c.fast+'일 평균이 '+c.slow+'일 평균을 '+(e.side>0?'위로':'아래로')+' 넘음':'진입 조건 충족')),dec:sd+' 진입 조건이 맞았습니다',act:(e.lev>1?e.lev+'배 ':'')+sd+' 진입, 체결가 '+mkPxFmt(e.px)+(e.liq>0&&isFinite(e.liq)?', 강제 청산 가격 '+mkPxFmt(e.liq):'')};
  return {k:'sell',who:c.kind==='mix'?'규칙':null,obs:tk+' '+sd+', 진입가 대비 가격 '+mkPct0((e.px/e.ep-1)*100)+'. '+(FU_WHY[e.why]||''),dec:e.why==='liq'?'강제 청산됐습니다':sd+' 포지션을 닫았습니다',act:'전량 청산, 체결가 '+mkPxFmt(e.px)+', 손익 '+mkPct0(e.pnl)}; }
function fuRules(s){ var c=s.cfg, u=mkUni(s);
  return {what:(c.kind==='rule'?s.asset+' 선물 한 종목을 롱과 숏 양방향으로 거래한다.':c.kind==='mix'?'방향과 종목은 AI가, 진입과 청산 시점은 사전에 정한 차트 규칙이 맡는다. '+u.label+' 선물이 대상이다.':mkJ(u.label,'을','를')+' 비교해 강한 종목은 롱, 약한 종목은 숏으로 잡는다.'),
    buy:c.kind==='agent'?fuAiTxt(s)+'.':fuSig(c)+' 포지션에 진입한다. 체결은 신호 다음 날 시가다.',
    sell:fuOuts(c).map(function(x){ return x.replace(/요$/,'').replace(/닫아$/,'청산한다').replace(/바꿔$/,'바꾼다'); }).join('. ')+'.',
    size:(c.lev>1?'레버리지는 '+c.lev+'배다. ':'레버리지는 쓰지 않는다. ')+'손실은 포지션에 넣은 증거금으로 한정된다.',
    rest:'판단은 하루 한 번 UTC 0시 종가 기준으로 한다. 수수료와 펀딩비는 실제 값으로 반영한다.'}; }
function fuChatIntro(s){ var R=fuRules(s); return mkSay([R.what,R.buy,R.sell],[R.size,R.rest],null); }
function fuChatNow(s,r){ var st=r.state, R=fuRules(s), op=fuOp(st);
  if(op.length) return mkSay(['현재 '+op.map(function(o){ return o.k+' '+fuSd(o.side); }).join(', ')+' 포지션을 보유 중이다.','넣은 돈 기준 손익은 '+op.map(function(o){ return o.k+' '+mkPct0(o.pnl); }).join(', ')+'다.',R.sell],[R.size,R.what,R.rest],null);
  return mkSay(['현재 포지션이 없다.','진입 신호를 기다리는 중이다.',R.buy],[R.what,R.sell,R.size,R.rest],null); }
function fuChatEv(s,e){ var c=s.cfg, R=fuRules(s), x=fuEv(s,e), sd=e.side?fuSd(e.side):'';
  if(e.t==='enter') return {k:'buy',tag:'선물 '+sd+' 진입',a:e.a,t:mkSay([mkJ(e.a,'을','를')+' 체결가 '+mkPxU(e.a,e.px)+'에 '+sd+' 진입했다.',x.obs+'.',R.size],[R.sell,R.what,R.rest],null)};
  if(e.t==='exit') return {k:'sell',tag:'선물 '+sd+' 청산',a:e.a,t:mkSay([e.a+'의 '+sd+' 포지션을 체결가 '+mkPxU(e.a,e.px)+'에 청산했다.',(FU_WHY_P[e.why]||'')+'.','실현 손익은 수수료와 펀딩비를 뺀 뒤 넣은 돈 기준 '+mkPct0(e.pnl)+'다.'],[R.sell,R.size,R.what],null)};
  if(e.t==='pick') return {k:'pick',tag:sd+' 후보 선정',a:e.a,t:mkSay([mkJ(e.a,'을','를')+' '+sd+' 후보로 선정했다.',x.obs+'.','아직 진입하지는 않았다.'],[R.buy,R.sell,R.what],null)};
  return {k:x.k==='hold'?'hold':'wait',tag:x.k==='hold'?'포지션 유지':'관망',a:e.a,t:mkSay([x.dec.replace(/어요$/,'다')+'.',x.obs+'.'],[R.what,R.buy,R.sell],null)}; }
function skdText(t){
  var k=t.trim(); if(SKD_EXACT[k]&&k===t.trim()) return t.replace(k,SKD_EXACT[k]);
  for(var i=0;i<SKD_RE.length;i++) t=t.replace(SKD_RE[i][0],SKD_RE[i][1]);
  if(typeof skSym==='function') t=skSym(t);
  return t;
}
function skdDate(y,m,d){ return y+'. '+(+m)+'. '+(+d)+'.'; }
var MK_CRYPTO={'비트코인':1,'이더리움':1,'솔라나':1,'리플':1,'도지코인':1,'에이다':1,'아발란체':1,'비앤비':1};
var MK_WHY_P={trail:'진입 후 고점 대비 하락 폭이 추적 손절 기준에 닿았다',weak:'모멘텀이 꺾였다',rot:'상위 종목에 순위가 밀렸다',sl:'손절 기준에 도달했다',tp:'익절 목표에 도달했다',time:'보유 25일이 지나 기간 만료로 청산했다'};
var MK_TK={'비트코인':'BTC','이더리움':'ETH','솔라나':'SOL','리플':'XRP','도지코인':'DOGE','에이다':'ADA','아발란체':'AVAX','비앤비':'BNB','테슬라':'TSLA','엔비디아':'NVDA','애플':'AAPL','마이크로소프트':'MSFT','아마존':'AMZN','메타':'META','알파벳':'GOOGL','에이엠디':'AMD'};
var FU_WHY={sl:'진입가에서 손절 기준만큼 불리하게 움직였습니다',trail:'가장 유리했던 가격에서 기준만큼 되돌렸습니다',tp:'목표까지 움직였습니다',time:'보유 기한을 채웠습니다',chan:'추세가 꺾였습니다',flip:'반대 방향 신호가 나왔습니다',liq:'증거금이 바닥나 강제 청산됐습니다',rot:'순위에서 밀렸습니다',rest:'시장 방향이 애매해 쉬기로 했습니다'};
var FU_WHY_P={sl:'진입가 대비 손절 기준에 도달했다',trail:'가장 유리했던 가격 대비 되돌림이 추적 손절 기준에 닿았다',tp:'익절 목표에 도달했다',time:'보유 기한이 지나 청산했다',chan:'가격이 출구 기준선을 벗어나 추세가 꺾였다고 판단했다',flip:'반대 방향 신호가 나와 포지션을 닫았다',liq:'증거금이 유지 증거금 아래로 내려가 강제 청산됐다',rot:'순위에서 밀렸다',rest:'시장 방향이 불분명해 포지션을 닫고 쉬었다'};
var SKD_EXACT={'★ 즐겨찾기':'즐겨찾기','정보':'전략 정보','수익금':'손익','현재 판단':'현재 포지션','거래내역':'거래 내역',
  '구분':'거래 유형','시간':'체결 시각','가격':'체결가','실행 거래소':'운용 거래소','등록':'등록자','선물 롱/숏 2배':'선물, 롱과 숏, 레버리지 2배'};
var SKD_RE=[
  [/니입니다/g,'니다'],
  [/반대 방향 신호가 나오면 닫고 방향을 바꿉니다/g,'반대 신호가 나오면 청산하고 방향을 바꿉니다'],
  [/에서 25% 되돌리면 닫습니다/g,'에서 25% 되돌아오면 청산합니다'],
  [/불리하게 움직이면 닫습니다/g,'불리하게 움직이면 청산합니다'],
  [/반대 방향 신호가 나와 포지션을 닫았습니다/g,'반대 신호가 나와 포지션을 청산했습니다'],
  [/넣은 돈 기준 손익은/g,'투입 금액 대비 손익은'],
  [/넣은 돈 기준/g,'투입 금액 대비'],
  [/^@(\S+) 등록$/,'등록자 @$1'],
  [/^최소 (\$[0-9,]+)$/,'최소 운용 금액 $1'],
  [/^(\d{4})\.(\d{2})\.(\d{2}) 시작$/,function(_,y,m,d){ return '시작일 '+skdDate(y,m,d); }],
  [/^(\d{4})\.(\d{2})\.(\d{2}) 시작 이후 ([+-][0-9.,]+%)$/,function(_,y,m,d,v){ return y+'년 '+(+m)+'월 '+(+d)+'일부터 누적 수익률은 '+v+'입니다.'; }],
  [/^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}:\d{2})$/,function(_,y,m,d,t){ return skdDate(y,m,d)+' '+t; }],
  [/손익은 [A-Z]{2,6}(\s*)$/,'손익은$1'],
  [/^(\s*)가장 유리했던(\s*)$/,'$1진입 후 가장 유리했던$2'],
  [/([.。] )가장 유리했던(\s*)$/,'$1진입 후 가장 유리했던$2'],
  [/가에서 (\d+)% 불리하게 움직이면 청산합니다/g,'가 대비 $1% 손실 방향으로 움직이면 청산합니다'],
  [/ ?손실은 포지션에 넣은 증거금으로 한정됩니다\./g,''],
  [/(^\s*|\. )[A-Z]{2,6}, (\d+일 평균이 \d+일 평균을 (?:위|아래)로) 넘음\./g,'$1$2 넘었습니다.'],
  [/^(\d{4})\.(\d{2})\.(\d{2}) ~ (\d{4})\.(\d{2})\.(\d{2})/,function(_,a,b,c,d,e,f){ return skdDate(a,b,c)+' ~ '+skdDate(d,e,f); }],
  [/^Max /,'최고 '],[/^Min /,'최저 '],
  [/, 끝난 거래 (\d+)회/,', 종료 거래 $1회'],
  [/^평가 기록이 있는 봉만 색이 칠해집니다\. 지난 봉 기준입니다\.$/,'종료된 봉의 평가 기록을 날짜별로 표시합니다.'],
  [/^이전 기록 (\d+)건 더 보기$/,'이전 기록 $1건 보기'],
  [/^주문 (\d+)건, (\$[0-9,]+)로 시작한 기준$/,'초기 운용 금액 $2, 주문 $1건'],
  [/선물의 (\d+일) 평균이 (\d+일) 평균을 넘으면 롱, 밑돌면 숏으로 (\d+배 )?바꿔 탑니다\./,'선물에서 $1 평균선이 $2 평균선보다 높으면 롱, 낮으면 숏으로 $3운용합니다.']
];
var SKD_RULE=/레버리지는|반대 신호가 나오면 청산하고|되돌아오면 청산합니다|손실 방향으로 움직이면 청산합니다|한 종목을|양방향으로 거래합니다/;
var MK_GLOSS={
 '되돌림 점수':'가격이 최근 얼마나 많이 내려왔는지를 0부터 100까지로 나타낸 값. 클수록 많이 내려온 상태다. 전략마다 정한 기준을 넘어야 매수를 검토한다.',
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
 '토큰화 주식':'주식의 가격을 그대로 따라가도록 만든 디지털 자산. 가상자산 거래소에서 USDT로 사고판다.',
 '토큰화 지수':'나스닥 같은 지수의 가격을 그대로 따라가도록 만든 디지털 자산. 가상자산 거래소에서 USDT로 사고판다.',
 '토큰화 금':'금의 가격을 그대로 따라가도록 만든 디지털 자산. 가상자산 거래소에서 USDT로 사고판다.',
 '현물':'코인을 실제로 사서 보유하는 거래. 가격이 오르면 이익이 난다.',
 '선물':'실물을 사지 않고 가격의 방향에 거는 거래. 오르는 쪽(롱)과 내리는 쪽(숏) 모두 가능하다.',
 '매수':'사는 주문.',
 '매도':'파는 주문.',
 '롱':'가격이 오르면 이익이 나는 방향.',
 '숏':'가격이 내리면 이익이 나는 방향.'
};
var MKC_IC={buy:'<path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/>',sell:'<path d="M12 5v13M6.5 12.500L12 18l5.500-5.500"/>',now:'<circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8"/>',wait:'<path d="M9 6v12M15 6v12"/>',hold:'<path d="M6 12h12"/>',pick:'<path d="M5 12.500l4.500 4.500L19 7.500"/>',intro:'<path d="M6 5h12v14H6zM9 9h6M9 13h6"/>'};
  return {
    messages(s, r) {
      return mkChatMsgs(s, r, 6).map(m => {
        let text = skdText(m.t)
        if (m.k !== 'now' && m.k !== 'intro') text = text.split(/(?<=다\.)\s+/).filter(sentence => !SKD_RULE.test(sentence)).join(' ')
        return { ...m, t: text, title: skdText(mkChatTitle(s, m)) }
      })
    },
    glossary: MK_GLOSS, icons: MKC_IC,
  }
}
