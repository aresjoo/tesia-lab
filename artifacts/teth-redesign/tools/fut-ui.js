/* ═══ 선물 전략의 말: 상세, 지금 상태, 판단 기록, 설명 ═══
   현물 전략의 글은 사고파는 말로 쓰여 있다. 선물 전략은 롱과 숏, 진입과 청산, 레버리지, 강제 청산 가격으로 말한다. */
function fuOp(st){ var o=st&&st.open; return !o?[]:o.length!=null?o:[o]; }
function fuNowLine(s){ var st=s.r&&s.r.state, op=fuOp(st), c=s.cfg; if(op.length) return op.map(function(o){ return mkTk(o.k)+' '+fuSd(o.side); }).join(', ')+' 보유 중'; if(c.kind==='mix') return st.pickL?mkTk(st.pickL)+' 롱 신호를 기다리는 중':st.pickS?mkTk(st.pickS)+' 숏 신호를 기다리는 중':'방향이 애매해 쉬는 중'; return '신호를 기다리는 중'; }
function fuIs(s){ return !!(s&&s.cfg&&s.cfg.fut); }
function fuSd(v){ return v>0?'롱':'숏'; }
function fuPct(g){ return Math.round(g*100)+'%'; }
var FU_WHY={sl:'진입가에서 손절 기준만큼 불리하게 움직였어요',trail:'가장 유리했던 가격에서 기준만큼 되돌렸어요',tp:'목표까지 움직였어요',time:'보유 기한을 채웠어요',chan:'추세가 꺾였어요',flip:'반대 방향 신호가 나왔어요',liq:'증거금이 바닥나 강제 청산됐어요',rot:'순위에서 밀렸어요',rest:'시장 방향이 애매해 쉬기로 했어요'};
var FU_WHY_P={sl:'진입가 대비 손절 기준에 도달했다',trail:'가장 유리했던 가격 대비 되돌림이 추적 손절 기준에 닿았다',tp:'익절 목표에 도달했다',time:'보유 기한이 지나 청산했다',chan:'가격이 출구 기준선을 벗어나 추세가 꺾였다고 판단했다',flip:'반대 방향 신호가 나와 포지션을 닫았다',liq:'증거금이 유지 증거금 아래로 내려가 강제 청산됐다',rot:'순위에서 밀렸다',rest:'시장 방향이 불분명해 포지션을 닫고 쉬었다'};
function fuSig(c){
  if(c.mode==='brk') return '종가가 최근 '+c.n+'일 최고가를 넘으면 롱, 최근 '+c.n+'일 최저가 아래로 내려가면 숏';
  if(c.mode==='ma') return c.fast+'일 평균 가격이 '+c.slow+'일 평균을 위로 넘으면 롱, 아래로 내려가면 숏';
  if(c.mode==='dip') return '최근 '+c.n+'일 고점에서 '+c.dip+'% 넘게 밀렸다가 반등하면 롱, 저점에서 '+c.dip+'% 넘게 올랐다가 꺾이면 숏';
  if(c.mode==='fg') return '공포 탐욕 지수가 '+c.lo+' 이하일 때 반등하면 롱, '+c.hi+' 이상일 때 꺾이면 숏';
  return ''; }
function fuOuts(c){ var o=[]; if(c.kind!=='agent') o.push('반대 방향 신호가 나오면 닫고 방향을 바꿔요'); if(c.exitN) o.push('종가가 반대쪽 '+c.exitN+'일 기준선을 벗어나면 닫아요'); if(c.trail) o.push('가장 유리했던 종가에서 '+c.trail+'% 되돌리면 닫아요'); if(c.sl) o.push('진입가에서 '+c.sl+'% 불리하게 움직이면 닫아요'); if(c.tp) o.push('진입가에서 '+c.tp+'% 유리하게 움직이면 닫아요'); if(c.hold) o.push('길어도 '+c.hold+'일'); return o; }
function fuNeed(c,n){ return {L:Math.ceil(c.gate*n-1e-9),S:Math.floor((1-c.gate)*n+1e-9)}; }
function fuAiTxt(s){ var c=s.cfg, u=mkUni(s), n=u.list.length, q=fuNeed(c,n), ev=c.every===1?'매일':c.every+'일마다';
  var cL=q.L>=n?n+'종목이 모두 오름세면':'오름세 종목이 '+q.L+'개 이상이면', cS=q.S<=0?'하나도 오름세가 아니면':'오름세 종목이 '+q.S+'개 이하면';
  if(c.kind==='agent') return ev+' '+n+'종목을 비교해요. '+cL+' 가장 강한 '+c.top+'종목을 롱, '+cS+' 가장 약한 '+c.top+'종목을 숏'+(q.L-q.S>1?', 그 사이면 쉬어요':'');
  return ev+' 방향과 종목을 정해요. '+cL+' 가장 강한 종목을 롱 후보로, '+cS+' 가장 약한 종목을 숏 후보로'+(q.L-q.S>1?', 그 사이면 후보를 비워요':' 골라요'); }
function fuCost(){ return '수수료는 체결 금액의 0.055%, 펀딩비는 실제 기록대로 내거나 받아요'; }
function fuLevTxt(c){ return c.lev>1?'레버리지 '+c.lev+'배. 가격이 1% 움직이면 넣은 돈이 '+c.lev+'% 움직여요':'레버리지 없이 1배'; }
function fuDoes(s){ var c=s.cfg, u=mkUni(s);
  if(c.kind==='agent') return [['보는 것',u.label+' 선물의 최근 '+c.look+'일 흐름과 흔들림. '+u.list.join(', ')],['AI가 정하는 것','오를 쪽에 설지 내릴 쪽에 설지, 어느 종목으로 할지. '+fuAiTxt(s)],['바뀌지 않는 한도',fuLevTxt(c)+'. '+(fuOuts(c).join('. ')||'재평가 때 조건에서 벗어나면 닫아요')]];
  if(c.kind==='mix') return [['AI가 정하는 것','방향과 종목. '+fuAiTxt(s)],['규칙이 정하는 것','들어가는 때와 나오는 때. '+fuSig(c)],['바뀌지 않는 한도',fuLevTxt(c)+'. '+fuOuts(c).join('. ')]];
  return [['보는 것',s.asset+' 선물 가격 하나'],['정해 둔 조건',fuSig(c)+(c.reg?'. 롱은 가격이 '+c.reg+'일 평균 위일 때만, 숏은 아래일 때만':'')],['바뀌지 않는 한도',fuLevTxt(c)+'. '+fuOuts(c).join('. ')]]; }
function fuHow(s){ var c=s.cfg, o=[];
  if(c.kind==='agent') o.push(['언제 들어가나',fuAiTxt(s)]); else { if(c.kind==='mix') o.push(['누가 고르나','AI가 '+fuAiTxt(s)+'. 포지션이 있는 동안에는 바꾸지 않아요']); o.push(['언제 들어가나',fuSig(c)+(c.reg?'. 롱은 '+c.reg+'일 평균 위, 숏은 아래에서만':'')+'. 신호가 나온 다음 날 시가에 들어가요']); }
  o.push(['언제 나오나',fuOuts(c).join('. ')||'재평가 때 방향이나 순위가 바뀌면 닫아요']);
  o.push(['얼마나 거나',(c.kind==='agent'?'한 종목에 자산의 '+Math.round(100/((c.neutral?2:1)*c.top))+'%를 증거금으로':'한 번에 한 포지션, 자산 전부를 증거금으로')+'. '+fuLevTxt(c)]);
  o.push(['비용과 위험',fuCost()+'. 손실은 그 포지션에 넣은 증거금까지예요']);
  return o; }
function fuEv(s,e){ var c=s.cfg, tk=e.a?mkTk(e.a):'', sd=e.side?fuSd(e.side):'';
  if(e.t==='pick') return {k:'pick',who:'AI',obs:e.of+'종 중 '+e.up+'종이 오름세. '+(e.side>0?'가장 강한 건 '+mkTopTxt(e.top):'가장 약한 건 '+mkTopTxt(e.bot)),dec:mkJ(tk,'을','를')+' '+sd+' 후보로 골랐어요',act:'규칙이 신호를 기다리기 시작'};
  if(e.t==='unpick') return {k:'wait',who:'AI',obs:e.of+'종 중 '+e.up+'종이 오름세. 방향이 애매함',dec:'후보를 비웠어요',act:'주문 없음'};
  if(e.t==='veto') return {k:'wait',who:'AI',obs:tk+' '+fuSd(e.side)+' 신호 발생. 그런데 AI가 본 시장 방향과 달라요('+e.of+'종 중 '+e.up+'종 오름세)',dec:'진입을 보류했어요',act:'주문 없음'};
  if(e.t==='skip') return {k:'wait',obs:e.of+'종 중 '+e.up+'종이 오름세',dec:e.why==='gate'?'방향이 애매해 쉬었어요':'조건에 맞는 종목이 없어 쉬었어요',act:(e.held||[]).length?e.held.map(mkTk).join(', ')+' 유지':'주문 없음'};
  if(e.t==='hold') return {k:'hold',obs:e.of+'종 중 '+e.up+'종이 오름세. 가장 강한 건 '+mkTopTxt(e.top),dec:'포지션을 바꾸지 않았어요',act:(e.held||[]).map(mkTk).join(', ')+' 유지'};
  if(e.t==='enter') return {k:'buy',who:c.kind==='mix'?'규칙':null,obs:c.kind==='agent'?(e.of+'종 중 '+e.up+'종이 오름세. '+tk+'의 '+c.look+'일 흐름 '+mkPct0(e.mom,0)+', '+(e.side>0?'강한 쪽 ':'약한 쪽 ')+e.rank+'위'):(tk+', '+(c.mode==='brk'?'종가가 최근 '+c.n+'일 '+(e.side>0?'최고가':'최저가')+' '+mkPxFmt(e.ref)+'을(를) '+(e.side>0?'넘음':'아래로 벗어남'):c.mode==='ma'?c.fast+'일 평균이 '+c.slow+'일 평균을 '+(e.side>0?'위로':'아래로')+' 넘음':'진입 조건 충족')),dec:sd+' 진입 조건이 맞았어요',act:(e.lev>1?e.lev+'배 ':'')+sd+' 진입, 체결가 '+mkPxFmt(e.px)+(e.liq>0&&isFinite(e.liq)?', 강제 청산 가격 '+mkPxFmt(e.liq):'')};
  return {k:'sell',who:c.kind==='mix'?'규칙':null,obs:tk+' '+sd+', 진입가 대비 가격 '+mkPct0((e.px/e.ep-1)*100)+'. '+(FU_WHY[e.why]||''),dec:e.why==='liq'?'강제 청산됐어요':sd+' 포지션을 닫았어요',act:'전량 청산, 체결가 '+mkPxFmt(e.px)+', 손익 '+mkPct0(e.pnl)}; }
function fuNow(s,r){ var st=r.state, end=PRICE0.length-1, c=s.cfg, rows='', head='', op=fuOp(st);
  var row=function(k,v){ return '<div class="mk3-kv"><small>'+k+'</small><span>'+v+'</span></div>'; };
  head=op.length?op.map(function(o){ return gEsc(mkTk(o.k))+' '+fuSd(o.side)+(o.lev>1?' '+o.lev+'배':''); }).join(', ')+' 보유 중':(c.kind==='mix'?(st.pickL?gEsc(mkTk(st.pickL))+' 롱 신호를 기다리는 중':st.pickS?gEsc(mkTk(st.pickS))+' 숏 신호를 기다리는 중':'방향이 애매해 쉬는 중'):'신호를 기다리는 중');
  if(op.length){ rows+=row('지금 든 것',op.map(function(o){ return '<b>'+gEsc(mkTk(o.k))+' '+fuSd(o.side)+'</b> '+mkMD(o.entry)+' 진입, '+mkPxFmt(o.ep)+' → '+mkPxFmt(o.px)+', 넣은 돈 기준 <i class="num'+mkSign(o.pnl)+'">'+mkPct0(o.pnl)+'</i>'; }).join('<br>'));
    rows+=row('강제 청산 가격',op.map(function(o){ return gEsc(mkTk(o.k))+' '+(o.liq>0&&isFinite(o.liq)?mkPxFmt(o.liq):'없음(1배 롱)'); }).join(', '));
    rows+=row('나오는 조건',fuOuts(c).join('. ')||'재평가 때 방향이나 순위가 바뀌면'); }
  else rows+=row('들어가는 조건',c.kind==='agent'?fuAiTxt(s):fuSig(c));
  if(st.top&&st.top.top) rows+=row('AI가 본 시장',st.top.of+'종 중 '+st.top.up+'종이 오름세. 강한 쪽 '+mkTopTxt(st.top.top)+', 약한 쪽 '+mkTopTxt(st.top.bot));
  rows+=row('다음 확인',mkMD(end+1)+' 0시(UTC) 마감 기준');
  return '<section class="mk3-panel mk3-nowp"><div class="mk3-nowh"><h3>지금</h3><span class="mk3-asof num">'+mkMD(end)+' 마감 기준</span></div><p class="mk3-state">'+head+'</p>'+rows+'</section>'; }
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
function fuLine(s){ var c=s.cfg, by=s.by?'@'+s.by+' 등록, ':''; return by+MK_KIND[s.kind]+', '+mkScope(s)+' 선물, 롱과 숏'+(c.lev>1?', '+c.lev+'배':''); }
function fuInst(s){ var c=s.cfg; return ['선물 롱/숏'+(c.lev>1?' '+c.lev+'배':'')]; }
