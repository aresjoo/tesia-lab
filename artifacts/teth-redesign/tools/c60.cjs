// 선물 전략을 화면에 연결한다: 상세, 백테스트, 따라가기, 카탈로그 맨 위 10개
const fs=require('fs'), D=__dirname+'/', R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
const ed=(file,pairs)=>{ let s=fs.readFileSync(file,'utf8'); for(const [x,y,n] of pairs){ const c=s.split(x).length-1; if(c!==(n||1)) throw new Error(file.slice(-14)+' x'+c+': '+x.slice(0,90)); s=s.split(x).join(y); } fs.writeFileSync(file,s); };

// ── rd-ui.js: 선물 전략이면 선물용 글로
ed(D+'rd-ui.js',[
  ["function mkEvents(s,r){\n","function mkEvents(s,r){\n  if(fuIs(s)) return (r.events||[]).map(function(e){ var x=fuEv(s,e); x.i=e.i; x.tid=e.tid; return x; });\n"],
  ["function mkDoes(s){\n","function mkDoes(s){\n  if(fuIs(s)) return fuDoes(s);\n"],
  ["function mkHowRows(s){\n","function mkHowRows(s){\n  if(fuIs(s)) return fuHow(s);\n"],
  ["function mkNowPanel(s,r){\n","function mkNowPanel(s,r){\n  if(fuIs(s)) return fuNow(s,r);\n"],
  ["function mkRules(s,of){\n","function mkRules(s,of){\n  if(fuIs(s)) return fuRules(s);\n"],
  ["function mkChatIntro(s){\n","function mkChatIntro(s){\n  if(fuIs(s)) return fuChatIntro(s);\n"],
  ["function mkChatNow(s,r){\n","function mkChatNow(s,r){\n  if(fuIs(s)) return fuChatNow(s,r);\n"],
  ["function mkChatEv(s,e){\n","function mkChatEv(s,e){\n  if(fuIs(s)) return fuChatEv(s,e);\n"],
  ["function mkFollowLine(s){ var c=s.cfg||{},","function mkFollowLine(s){ if(fuIs(s)) return fuLine(s); var c=s.cfg||{},"],
  ["function mkInstList(s){ var l=","function mkInstList(s){ if(fuIs(s)) return fuInst(s); var l="],
  ["  var c=s.cfg||{}, fut=c.inst==='futures', sh=c.dir==='short';\n","  var c=s.cfg||{}, fut=c.inst==='futures', sh=c.dir==='short';\n  if(c.fut) return {inst:'선물',tagIn:'선물 진입',tagOut:'선물 청산',buy:'진입',sell:'청산',hold:'포지션 유지'};\n"],
  ["  var rule=s2.kind==='agent'?'고점에서 '+c.trail+'% 밀리면':","  var rule=fuIs(s2)?(c.trail?'유리했던 가격에서 '+c.trail+'% 되돌리면':c.sl?'진입가에서 '+c.sl+'% 불리하면':c.exitN?c.exitN+'일 기준선 이탈':'방향이 바뀌면'):s2.kind==='agent'?'고점에서 '+c.trail+'% 밀리면':"],
  ["    return '<tr><td>'+gEsc(mkTk(x.k))+'</td><td class=\"u\">롱</td>","    return '<tr><td>'+gEsc(mkTk(x.k))+'</td><td class=\"'+(x.side<0?'d':'u')+'\">'+(x.side<0?'숏':'롱')+(x.lev>1?' '+x.lev+'배':'')+'</td>"],
  ["  var KN={sl:'손절',tp:'익절',time:'기간 청산',trail:'고점 이탈',weak:'힘 약화',rot:'순위 밀림'};","  var KN={sl:'손절',tp:'익절',time:'기간 청산',trail:s.cfg&&s.cfg.fut?'추적 손절':'고점 이탈',weak:'힘 약화',rot:'순위 밀림',chan:'추세 꺾임',flip:'방향 전환',liq:'강제 청산',rest:'쉬어 감'};"],
  ["+gEsc(x.asset||s.asset)+'</td><td>'+(KN[x.kind]||x.kind)+'</td>'","+gEsc(x.asset||s.asset)+(x.side?' '+(x.side>0?'롱':'숏')+(x.lev>1?' '+x.lev+'배':''):'')+'</td><td>'+(KN[x.kind]||x.kind)+'</td>'"],
  ["    o.push({i:t.entry,side:'in',a:t.asset,px:t.ep,q:t.units*B,sum:t.cost*B,id:t.id});\n    o.push({i:t.exit,side:'out',a:t.asset,px:t.xp,q:t.units*B,sum:t.got*B,id:t.id,pnl:t.pnl*100});",
   "    o.push({i:t.entry,side:'in',a:t.asset,px:t.ep,q:Math.abs(t.units)*B,sum:t.cost*B,id:t.id,ps:t.side});\n    o.push({i:t.exit,side:'out',a:t.asset,px:t.xp,q:Math.abs(t.units)*B,sum:t.got*B,id:t.id,pnl:t.pnl*100,ps:t.side});"],
  ["  op.forEach(function(p){ if(p.units!=null) o.push({i:p.entry,side:'in',a:p.k,px:p.ep,q:p.units*B,sum:p.cost*B,id:p.tid,open:true}); });","  op.forEach(function(p){ if(p.units!=null) o.push({i:p.entry,side:'in',a:p.k,px:p.ep,q:Math.abs(p.units)*B,sum:p.cost*B,id:p.tid,open:true,ps:p.side}); });"],
  ["  o.forEach(function(x){ x.label=x.side==='in'?W.buy:W.sell;","  o.forEach(function(x){ x.label=(x.ps?(x.ps>0?'롱 ':'숏 '):'')+(x.side==='in'?W.buy:W.sell);"],
]);

// ── bt-a.js: 판단 기록, 표식, 거래 목록
ed(D+'bt-a.js',[
  ["  ev.forEach(function(e){\n    var tk=e.a?mkTk(e.a):'';\n","  ev.forEach(function(e){\n    var tk=e.a?mkTk(e.a):'';\n    if(c.fut){ var fd=fuBtDec(s,e,{n8:n8,upsOf:upsOf}); if(fd) push(fd,e); return; }\n"],
  ["pnl:t.pnl*100,why:t.kind,cost:t.cost,got:t.got,fee:t.fee,days:t.exit-t.entry}; });","pnl:t.pnl*100,why:t.kind,cost:t.cost,got:t.got,fee:t.fee,days:t.exit-t.entry,side:t.side,lev:t.lev,fund:t.fund}; });"],
  ["xp:o.px,pnl:o.chg,why:null,cost:o.cost,got:null,fee:null,days:T-o.entry,open:1}); });","xp:o.px,pnl:o.pnl!=null?o.pnl:o.chg,why:null,cost:o.cost,got:null,fee:null,days:T-o.entry,open:1,side:o.side,lev:o.lev}); });"],
  ["var m={k:d.k,j:d.j,j2:d.j,ix:d.ix,ix2:d.ix,n:1,pnl:d.pnl,t:","var m={k:d.k,side:d.side,j:d.j,j2:d.j,ix:d.ix,ix2:d.ix,n:1,pnl:d.pnl,t:"],
  ["    if(m.k==='buy') s='<path d=\"M'+x.toFixed(1)+' '+(y+7).toFixed(1)","    if(m.k==='buy'&&m.side<0) s='<path d=\"M'+x.toFixed(1)+' '+(y-7).toFixed(1)+' l'+a+' -'+h+' h-'+(2*a)+' z\" fill=\"#b08cf5\"/>';\n    else if(m.k==='buy') s='<path d=\"M'+x.toFixed(1)+' '+(y+7).toFixed(1)"],
  ["y-(m.k==='buy'?-2:34)","y-((m.k==='buy'&&!(m.side<0))?-2:34)"],
]);
ed(D+'bt-c.js',[["<b>'+gEsc(mkTk(t.a))+'</b><time class=\"num\"><i>매수</i>'","<b>'+gEsc(mkTk(t.a))+(t.side?' <i class=\"bt-sd'+(t.side<0?' s':'')+'\">'+(t.side>0?'롱':'숏')+(t.lev>1?' '+t.lev+'배':'')+'</i>':'')+'</b><time class=\"num\"><i>매수</i>'"]]);
fs.appendFileSync(D+'bt4.css',"\n/* 선물 거래의 방향 표시 */\n.bt-sd{font-style:normal;font-size:11.5px;font-weight:700;color:#2fb98a;margin-left:4px}.bt-sd.s{color:#b08cf5}\n");

// ── 따라가기 장부: 멈춘 뒤의 값 계산에서 선물 포지션은 방향과 수량(부호)으로
ed(R+'index.html',[
  [".map(function(x){ return {k:x.asset,u:x.units,exit:x.exit,got:x.got}; });",".map(function(x){ return {k:x.asset,u:x.units,exit:x.exit,got:x.got,fut:x.fut,xp:x.xp}; });"],
  ["if(o&&o.entry!=null&&o.entry<=stopI&&o.units!=null) hp.push({k:o.k,u:o.units,exit:null,got:null}); });","if(o&&o.entry!=null&&o.entry<=stopI&&o.units!=null) hp.push({k:o.k,u:o.units,exit:null,got:null,fut:o.fut}); });"],
  ["hp.forEach(function(h){ var P=pxs[h.k], a=h.u*P[stopI]; v+=((h.exit!=null&&b>=h.exit)?h.got:h.u*P[b])-a; }); return v; };","hp.forEach(function(h){ var P=pxs[h.k], a=h.u*P[stopI]; v+=h.fut?h.u*(((h.exit!=null&&b>=h.exit)?h.xp:P[b])-P[stopI]):((h.exit!=null&&b>=h.exit)?h.got:h.u*P[b])-a; }); return v; };"],
]);

// ── apply2.cjs: 선물 전략 줄, 묶음 순서
ed(D+'apply2.cjs',[
  ["  if(s.kind==='rule') f+=',asset:'","  if(s.c&&s.c.fut) f+=(s.asset?',asset:'+q(s.asset):',uni:'+q(s.uni))+',inst:'+q('futures')+','+Object.keys(s.c).map(k=>k+':'+(typeof s.c[k]==='string'?q(s.c[k]):s.c[k])).join(',');\n  else if(s.kind==='rule') f+=',asset:'"],
  ["const MKT=s=>{ if(s.kind==='rule'){","const MKT=s=>{ if(s.c&&s.c.fut) return 'crypto'; if(s.kind==='rule'){"],
  ["const FW=[1284,","const FW=[612,548,731,496,455,389,342,527,418,377,1284,"],
  ["fs.readFileSync(D+'fut-core.js','utf8')+'\\n'+fs.readFileSync(D+'rd-ui.js','utf8')","fs.readFileSync(D+'fut-core.js','utf8')+'\\n'+fs.readFileSync(D+'fut-ui.js','utf8')+'\\n'+fs.readFileSync(D+'rd-ui.js','utf8')"],
  ["['bt-a.js','bt-b.js','bt-c.js','bt-go.js']","['bt-a.js','bt-b.js','bt-c.js','bt-go.js','bt-fut.js']"],
]);

// ── 카탈로그: 선물 10개를 맨 위에
{ const cd=JSON.parse(fs.readFileSync(D+'cat-data.json','utf8')), cp=JSON.parse(fs.readFileSync(D+'copy.json','utf8'));
  if(cd.list.some(x=>x.id==='f1')) throw new Error('f1 exists');
  const F=[
   ['f3','rule','아발란체',null,'bitget',{mode:'brk',n:55,exitN:10,trail:20,reg:200,lev:2},'아발란체 추세 양방향 2배','아발란체 선물이 55일 최고가를 넘으면 롱, 최저가를 깨면 숏으로 2배 따라가요.','kite_r'],
   ['f1','mix','','big3','bitget',{mode:'brk',every:5,look:45,gate:0.5,n:20,exitN:15,sl:10,trail:25,lev:1},'대표 코인 돌파 따라가기','AI가 비트코인, 이더리움, 솔라나 중 방향과 종목을 고르고, 20일 돌파가 나오면 롱이나 숏으로 들어가요.','sorae'],
   ['f8','agent','','big3','binance',{every:3,look:20,top:1,gate:0.75,lev:1},'대표 코인 강한 쪽 롱숏','AI가 3일마다 대표 코인 셋을 비교해, 시장이 강하면 가장 강한 코인을 롱, 약하면 가장 약한 코인을 숏으로 잡아요.','haneul'],
   ['f2','mix','','coin8','bitget',{mode:'brk',every:5,look:90,gate:0.5,n:5,exitN:10,sl:15,trail:25,lev:1},'코인 여덟 강약 골라 타기','AI가 코인 8종에서 가장 강한 쪽은 롱, 가장 약한 쪽은 숏 후보로 고르고, 5일 돌파에 들어가요.','mira_q'],
   ['f9','agent','','coin8','okx',{every:3,look:20,top:2,gate:0.88,lev:1},'코인 둘 롱숏 갈아타기','AI가 3일마다 코인 8종을 비교해, 거의 다 오를 때는 강한 둘을 롱, 거의 다 내릴 때는 약한 둘을 숏으로 잡아요.','pebble'],
   ['f4','rule','이더리움',null,'bitget',{mode:'brk',n:55,exitN:20,trail:15,reg:200,lev:2},'이더리움 추세 양방향 2배','이더리움 선물이 55일 최고가를 넘으면 롱, 최저가를 깨면 숏으로 2배 따라가요.','dohyun_k'],
   ['f10','agent','','coin8','binance',{every:3,look:30,top:3,gate:0.5,sl:15,lev:1},'코인 셋 롱숏 나눠 타기','AI가 3일마다 코인 8종을 비교해, 강한 장에서는 셋을 롱, 약한 장에서는 셋을 숏으로 나눠 잡아요.','june07'],
   ['f7','rule','비앤비',null,'binance',{mode:'ma',fast:7,slow:100,lev:1},'비앤비 평균선 양방향','비앤비 선물의 7일 평균이 100일 평균을 넘으면 롱, 밑돌면 숏으로 바꿔 타요.','noel_b'],
   ['f6','rule','도지코인',null,'okx',{mode:'ma',fast:10,slow:100,trail:20,lev:1},'도지코인 평균선 양방향','도지코인 선물의 10일 평균이 100일 평균을 넘으면 롱, 밑돌면 숏으로 바꿔 타요.','tari'],
   ['f5','rule','비트코인',null,'bitget',{mode:'brk',n:55,exitN:5,trail:15,reg:200,lev:3},'비트코인 추세 양방향 3배','비트코인 선물이 55일 최고가를 넘으면 롱, 최저가를 깨면 숏으로 3배 따라가요.','woo_l'],
  ];
  const add=F.map(([id,kind,asset,uni,ex,c,name,one,by])=>{ cp[id]={name,one,by}; return {id,kind,uni:uni||undefined,asset:asset||null,ex,c:Object.assign({fut:1,kind},c,{startI:101}),p:null,m:{}}; });
  cd.list=add.concat(cd.list);
  fs.writeFileSync(D+'cat-data.json',JSON.stringify(cd,null,1)); fs.writeFileSync(D+'copy.json',JSON.stringify(cp,null,1)); console.log('catalog',cd.list.length); }
console.log('ok');
