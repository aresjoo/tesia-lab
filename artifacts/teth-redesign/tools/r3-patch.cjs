// Round 3 소스 수정 (agent-core.js, rd-ui.js, rd.css, copy.json, apply2.cjs)
const fs=require('fs'); const D=__dirname+'/';
function edit(file,pairs){ let s=fs.readFileSync(D+file,'utf8'); for(const [a,b] of pairs){ const n=s.split(a).length-1; if(n!==1) throw new Error(file+' anchor x'+n+': '+a.slice(0,70)); s=s.replace(a,()=>b); } fs.writeFileSync(D+file,s); console.log(file,'ok',pairs.length); }

edit('agent-core.js',[
 ["function mkCheckIn(PX,N,c){ for(var z=0;z<PX.length;z++) if(PX[z].length!==N) throw new Error('price length');",
  "function mkCheckIn(PX,N,c){ for(var z=0;z<PX.length;z++){ if(PX[z].length!==N) throw new Error('price length'); for(var y=0;y<N;y++) if(!(PX[z][y]>0)||!isFinite(PX[z][y])) throw new Error('bad price'); }"],
 ["scan:{up:now.up,of:now.of,weak:now.breadth<c.gate,top:now.rows.slice(0,4).map(function(x){ return {k:x.k,mom:x.mom*100,above:x.above}; })},",
  "scan:{up:now.up,of:now.of,weak:now.breadth<c.gate,top:now.rows.slice(0,4).map(function(x){ return {k:x.k,mom:x.mom*100,above:x.above}; }),\n      rows:now.rows.map(function(x,q){ return {k:x.k,rank:q+1,mom:x.mom*100,above:x.above,ok:x.above&&x.score>=c.minS,held:L.pos.some(function(p){ return p.k===x.k; })}; })},"],
 ["function cond(P,i){ var rv=rsi(P,i-1), bo=(P[i]/P[i-1]-1)*100, s20=sma(P,20,i), s60=sma(P,60,i), gap=Math.abs(s20-s60)/P[i]*100; return {i:i,rsi:rv,rsiOk:rv<c.rsiTh,bounce:bo,bounceOk:bo>0.5,gap:gap,trendOk:!c.tf||gap>3}; }",
  "function upN(i){ var u=0; for(var z=0;z<U.length;z++) if(PX[z][i]>sma(PX[z],60,i)) u++; return u; }\n  function cond(P,i){ var rv=rsi(P,i-1), bo=(P[i]/P[i-1]-1)*100, s20=sma(P,20,i), s60=sma(P,60,i), gap=Math.abs(s20-s60)/P[i]*100, up=upN(i); return {i:i,rsi:rv,rsiOk:rv<c.rsiTh,bounce:bo,bounceOk:bo>0.5,gap:gap,trendOk:!c.tf||gap>3,up:up,of:U.length,mktOk:!!fixed||!c.gate||up/U.length>=c.gate}; }"],
 ["if(q.rsiOk&&q.bounceOk&&q.trendOk){ var up2=0; for(var u=0;u<U.length;u++) if(PX[u][i]>sma(PX[u],60,i)) up2++;\n          if(!fixed&&c.gate&&up2/U.length<c.gate) ev.push({i:i,t:'veto',a:pick,up:up2,of:U.length,rsi:q.rsi});",
  "if(q.rsiOk&&q.bounceOk&&q.trendOk){ var up2=q.up;\n          if(!q.mktOk) ev.push({i:i,t:'veto',a:pick,up:up2,of:U.length,rsi:q.rsi,bounce:q.bounce});"]
]);

edit('rd-ui.js',[
 // 날짜 기준을 데이터 기준일로 고정
 ["/* 날짜 기준: 마지막 봉이 어제가 되게 맞춘다(세션 시작 때 한 번). 가격, 판단 기록, 기간 계산이 모두 봉 번호를 쓰므로 함께 움직인다 */\nvar MK_D0=null;\nfunction idxToDate(i){ if(!MK_D0){ var n=new Date(); MK_D0=new Date(n.getFullYear(),n.getMonth(),n.getDate()); MK_D0.setDate(MK_D0.getDate()-PRICE0.length); } var t=new Date(MK_D0.getTime()); t.setDate(t.getDate()+i); return t; }",
  "/* 데이터 기준일: 마지막 봉의 날짜. 가격 데이터를 바꿀 때 함께 바꾼다. 날짜, 판단 기록, 기간 계산, 저장된 시작 봉이 모두 이 기준에 묶인다 */\nvar MK_ASOF=[2026,9,28], MK_DATA_V='2026-09-28.1', MK_D0=null;\nfunction idxToDate(i){ if(!MK_D0){ MK_D0=new Date(MK_ASOF[0],MK_ASOF[1]-1,MK_ASOF[2]); MK_D0.setDate(MK_D0.getDate()-(PRICE0.length-1)); } var t=new Date(MK_D0.getTime()); t.setDate(t.getDate()+i); return t; }"],
 ["return c.id+'|'+JSON.stringify(c)+'|'+ks.map(function(k){ return (MK_PX_CFG[k]||[]).join('/'); }).join(',')+'|'+PRICE0.length+'|'+MK_FEE; }",
  "return c.id+'|'+JSON.stringify(c)+'|'+ks.map(function(k){ return (MK_PX_CFG[k]||[]).join('/'); }).join(',')+'|'+PRICE0.length+'|'+MK_FEE+'|'+MK_DATA_V; }\n/* 카탈로그나 가격 설정이 바뀌면 시드, 목록, 기간 계산을 함께 버린다 */\nvar MK_CATSIG=null;\nfunction mkCatSig(){ return JSON.stringify(MK_CAT)+JSON.stringify(MK_PX_CFG)+MK_DATA_V+MK_FEE; }"],
 ["function tfRankSeeds(){\n  if(TF_SEEDS) return TF_SEEDS;",
  "function tfRankSeeds(){\n  var sig=mkCatSig(); if(TF_SEEDS&&MK_CATSIG===sig) return TF_SEEDS;\n  MK_CATSIG=sig; TF_SS_CACHE=null; MK_PDC={};"],
 ["  return TF_SEEDS;\n}\nfunction tfSSRows(){\n  if(!TF_SS_CACHE)","  mkMigrate();\n  return TF_SEEDS;\n}\n/* 저장된 즐겨찾기와 따라가기의 이름을 현재 이름으로 맞춘다(별칭으로 찾을 수 있는 것만). 돈과 기록은 건드리지 않는다 */\nfunction mkMigrate(){\n  try{ var t=tfS(), ch=false, canon=function(n){ var id=MK_ALIAS[n]; if(!id) return n; for(var i=0;i<MK_CAT.length;i++) if(MK_CAT[i].id===id) return MK_CAT[i].name; return n; };\n    if(t.watch){ var w=[]; t.watch.forEach(function(n){ var c=canon(n); if(c!==n) ch=true; if(w.indexOf(c)<0) w.push(c); else ch=true; }); t.watch=w; }\n    if(t.cp&&t.cp.copies) t.cp.copies.forEach(function(c){ var n=canon(c.nick); if(n!==c.nick){ c.nick0=c.nick; c.nick=n; ch=true; } });\n    if(ch) tfSave(); }catch(e){}\n}\nfunction tfSSRows(){\n  tfRankSeeds();\n  if(!TF_SS_CACHE)"],
 ["function mk30(s){\n  var key=mkSig(s);\n  if(!MK_D30[key]){ var r=s.r||tfSS3PdCalc(s,'all'), d=mkDaily(r.eq,PRICE0.length-1).slice(-31), b0=d.length?d[0].v:1; d=d.map(function(x){ return {i:x.i,v:x.v/b0}; }); MK_D30[key]={ret:d.length>1?(d[d.length-1].v-1)*100:0,eq:d}; }\n  return MK_D30[key];\n}",
  "/* 30일 수익률: 매번 결과에서 바로 계산한다(값이 바뀌면 곧바로 반영) */\nfunction mk30(s){\n  var r=s.r||tfSS3PdCalc(s,'all'), e=r.eq||[], d=(e.length&&e[e.length-1].i-e[0].i===e.length-1?e:mkDaily(e,PRICE0.length-1)).slice(-31), b0=d.length?d[0].v:1;\n  d=d.map(function(x){ return {i:x.i,v:x.v/b0}; });\n  return {ret:d.length>1?(d[d.length-1].v-1)*100:0,eq:d};\n}"],
 ["var MK_ALIAS={'비트코인 바겐세일':'r1','김대리의 나스닥':'r2','손절은 칼같이':'r3','골드핑거':'r4','테슬라 역발상가':'r5','짧게 먹고 내린다':'r6','리플 잔돈 수집가':'r7','끝까지는 안 가':'r8','비트코인은 기다림':'r9'};",
  "var MK_ALIAS={'비트코인 바겐세일':'r1','김대리의 나스닥':'r2','손절은 칼같이':'r3','골드핑거':'r4','테슬라 역발상가':'r5','짧게 먹고 내린다':'r6','리플 잔돈 수집가':'r7','끝까지는 안 가':'r8','비트코인은 기다림':'r9',\n  '한계선':'r3','거름':'h2','돌림':'d4','이음':'h3','깊은 숨':'r5','한구간':'r6','길잡이':'h4','분업':'h5','길목':'r9'};"],
 // 상태 이유에 시장 보류 포함
 ["function mkWaitWhy(q,tf){ return !q?'조건 대기':!q.rsiOk?'하락 대기':!q.bounceOk?'반등 대기':(tf&&!q.trendOk)?'방향 대기':'조건 대기'; }",
  "function mkWaitWhy(q,tf){ return !q?'조건 대기':!q.rsiOk?'하락 대기':!q.bounceOk?'반등 대기':(tf&&!q.trendOk)?'방향 대기':q.mktOk===false?'시장 약세로 보류':'조건 대기'; }"],
 ["return '<span class=\"mk3-gauge\" role=\"img\" aria-label=\"밀린 정도 '+Math.round(cur)+', 기준 '+Math.round(need)+' 이상\"><u style=\"left:'+need.toFixed(0)+'%\"></u><i style=\"left:'+cur.toFixed(0)+'%\"></i></span><span class=\"mk3-gauge-t num\">밀린 정도 '+Math.round(cur)+', 기준 '+Math.round(need)+' 이상</span>';",
  "var near=Math.abs(cur-need)<1.5, a=near?cur.toFixed(1):String(Math.round(cur)), tx='밀린 정도 '+a+', 기준 '+need+' 초과';\n  return '<span class=\"mk3-gauge\" role=\"img\" aria-label=\"'+tx+'\"><u style=\"left:'+need.toFixed(0)+'%\"></u><i style=\"left:'+cur.toFixed(0)+'%\"></i></span><span class=\"mk3-gauge-t num\">'+tx+'</span>';"],
 ["  if(c.tf) o+=row('방향이 뚜렷한가',(q.trendOk?'<b>예</b>':'아직 아니에요')+'<span class=\"mk3-gauge-t num\">평균선 간격 '+q.gap.toFixed(1)+'%, 기준 3% 초과</span>');\n  return o;",
  "  if(c.tf) o+=row('방향이 뚜렷한가',(q.trendOk?'<b>예</b>':'아직 아니에요')+'<span class=\"mk3-gauge-t num\">평균선 간격 '+q.gap.toFixed(1)+'%, 기준 3% 초과</span>');\n  if(c.gate&&q.of>1) o+=row('시장이 받쳐 주나',(q.mktOk?'<b>예</b>':'아니에요, AI가 진입을 보류해요')+'<span class=\"mk3-gauge-t num\">'+q.of+'종 중 '+q.up+'종이 오름세, 기준 '+Math.ceil(c.gate*q.of)+'종 이상</span>');\n  return o;"],
 // 직접 탐색: 보는 종목 표
 ["    rows+=row('보는 범위',gEsc(mkUni(s).label)+' 중 '+st.scan.up+'종이 오름세');\n    rows+=row('지금 강한 종목',st.scan.top.slice(0,3).map(function(x){ return gEsc(x.k)+' <i class=\"num\">'+mkPct0(x.mom,0)+'</i>'; }).join(', '));",
  "    rows+=row('보는 종목','<span class=\"mk3-ulist\">'+st.scan.rows.map(function(x){ return '<span class=\"'+(x.held?'h':x.ok?'c':'')+'\"><b>'+x.rank+'</b>'+gEsc(x.k)+'<i class=\"num\">'+mkPct0(x.mom,0)+'</i><em>'+(x.held?'보유':x.ok?'후보':x.above?'관찰':'약세')+'</em></span>'; }).join('')+'</span><span class=\"mk3-gauge-t\">순서는 최근 '+c.look+'일 오름폭을 흔들림으로 나눈 값이에요. '+st.scan.of+'종 중 '+st.scan.up+'종이 오름세</span>');"],
 ["['언제 쉬나','오르는 종목이 '+Math.round(c.gate*100)+'%가 안 될 때. 가진 건 두고 새로 사지 않아요']",
  "['언제 쉬나','오르는 종목이 '+Math.round(c.gate*100)+'%가 안 될 때. 새로 사지 않고, 든 종목의 정리 조건은 계속 확인해요']"],
 // 배너 2
 ["slide(1,'mkh-s1',\"tfShareHub('mine')\",'10월 전략 리그','총상금 <em>1,000,000 USDT</em>','10월 1일 시작, 수익률 상위 전략에 상금','<i class=\"mkh-cta\">내 전략 공개하기</i><span class=\"mkh-pod\" aria-hidden=\"true\"><i>2</i><i>1</i><i>3</i></span>')",
  "slide(1,'mkh-s1 mkh-k',\"tfShareHub('mine')\",'10월 전략 리그','내 전략을 공개하고<br>같은 조건에서 겨뤄요','10월 1일 시작, 판단 기록과 함께 공개돼요','<i class=\"mkh-cta\">내 전략 공개하기</i>')"],
 // 카드 미니 차트: 완전히 평평하면 중립선
 ["+'</b></div>'+mkSpark(m30.eq,72,26)+'</div>'","+'</b></div>'+mkSpark3(m30.eq)+'</div>'"],
 ["/* ── 카드 ── */","function mkSpark3(eq){ var flat=true; for(var i=1;i<eq.length;i++) if(Math.abs(eq[i].v-eq[0].v)>1e-9){ flat=false; break; } if(flat) return '<svg class=\"mk-spark\" viewBox=\"0 0 72 26\" preserveAspectRatio=\"none\" aria-hidden=\"true\"><line x1=\"0\" y1=\"13\" x2=\"72\" y2=\"13\" stroke=\"rgba(255,255,255,.34)\" stroke-width=\"2\" vector-effect=\"non-scaling-stroke\"/></svg>'; return mkSpark(eq,72,26); }\n/* ── 카드 ── */"],
 // 조건 도식: 목표 폭은 네 단계로 3px 씩, 끝점 모양은 자산 종류
 ["var th=c.rsiTh||40, dep=th<=26?19:th<=32?16:th<=40?13:th<=46?10:th<=50?7:4, tp=c.tp||8, k=tp<=4?0:tp<=5?1:tp<=6?2:tp<=8?3:tp<=12?4:tp<=15?5:tp<=18?6:7, w=x1-x0, yT=5, xb=x0+w*0.34, xe=xb+w*(0.2+k*0.066);",
  "var th=c.rsiTh||40, dep=th<=26?19:th<=32?16:th<=40?13:th<=46?10:th<=50?7:4, tp=c.tp||8, k=tp<=5?0:tp<=8?1:tp<=15?2:3, w=x1-x0, yT=5, xb=x0+w*0.3, xe=xb+w*0.22+k*(w>15?3:1.7), sh=c.mkt==='stock'?'s':c.mkt==='index'?'d':'c';"],
 ["  o+='<circle cx=\"'+xe.toFixed(1)+'\" cy=\"'+(yT+dep-Math.min(dep,3+k*1.7)).toFixed(1)+'\" r=\"1.9\" fill=\"'+W+'\"/>';",
  "  o+=mkMark(xe,yT+dep-Math.min(dep,3+k*1.7),w>15?2.1:1.8,w>15?sh:'c',W);"]
]);
// 분석 요청, 혼합 설명
fs.appendFileSync(D+'rd-ui.js',`
/* TETH에게 분석시키기: 판단 방식과 실제 설정, 지금 상태를 질문에 담는다 */
function tfSS3Ask(ne,pd){
  var nick; try{ nick=decodeURIComponent(ne); }catch(e){ return; }
  var s=tfSSFind(nick); if(!s) return;
  if(!S.user){ authOpen('login'); return; }
  var r=tfSS3PdCalc(s,pd||'all'), q;
  if(s.cfg){ q='전략 분석 요청: "'+s.name+'" ('+MK_KIND[s.kind]+', '+mkScope(s)+'). 하는 일: '+mkDoes(s).map(function(d){ return d[0]+' '+d[1]; }).join('. ')+'. 지금: '+mkNowLine(s)+'. 기록: 시작 이후 '+mkPct0(r.ret)+', 최대 낙폭 '+r.mdd.toFixed(1)+'%, 승률 '+Math.round(r.winRate||0)+'%, 거래 '+r.n+'회. 이 전략의 강점과 약점, 그리고 따라가기 전에 확인해야 할 점을 분석해줘.'; }
  else q='공유 전략 분석 요청: "'+nick+'" ('+s.asset+'). 규칙: RSI '+(s.p&&s.p.rsiTh!=null?s.p.rsiTh:'?')+' 이하 눌림 후 반등 진입'+(s.p&&s.p.trendFilter?', 추세 필터 사용':'')+', 손절 '+(s.p?s.p.sl:'?')+'%'+(s.p&&s.p.tp!=null?', 익절 +'+s.p.tp+'%':'')+'. 검증 결과: 수익 '+(r.ret>=0?'+':'')+r.ret.toFixed(1)+'%, MDD '+r.mdd.toFixed(1)+'%, 승률 '+Math.round(r.winRate||0)+'%, 거래 '+r.n+'회. 이 전략의 강점과 약점, 그리고 따라하기 전에 확인해야 할 점을 분석해줘.';
  tfTrack('strategy_ai_analysis',{nick:nick});
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  window.TF_ONSHARE=false;
  gNew(q);
}
`);
// 스타일
fs.appendFileSync(D+'rd.css',`
.mk3-ulist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 18px}
.mk3-ulist>span{display:grid;grid-template-columns:18px minmax(0,1fr) auto 34px;gap:6px;align-items:baseline;font-size:13px;line-height:1.7;color:var(--gt2)}
.mk3-ulist b{font-weight:500;font-size:12px;color:var(--gt3);font-variant-numeric:tabular-nums}
.mk3-ulist i{font-style:normal;color:var(--gt3)}
.mk3-ulist em{font-style:normal;font-size:12px;color:var(--gt3);text-align:right}
.mk3-ulist>span.h{color:#f2f3f5;font-weight:600}
.mk3-ulist>span.h em{color:#f2f3f5}
.mk3-ulist>span.c em{color:#e3e3e3}
@media (max-width:860px){.mk3-ulist{grid-template-columns:minmax(0,1fr)}}
`);
// 설명 문구
{ const f=D+'copy.json', c=JSON.parse(fs.readFileSync(f,'utf8'));
  c.h2.one='AI가 고른 가상자산이 반등하면 규칙이 삽니다. 시장이 약하면 보류합니다.';
  c.h5.one='AI는 60일 동안 가장 많이 오른 하나를 고릅니다. 사고파는 때는 규칙이 정합니다.';
  fs.writeFileSync(f,JSON.stringify(c,null,1)); }
// 적용 스크립트: 가격 캐시 키, 저장 이름 정규화, 찾지 못한 따라가기 표시, 터미널 문구
{ let s=fs.readFileSync(D+'apply2.cjs','utf8'); const a='// 6. rd 블록이 선언하는 함수의 옛 정의를 지운다'; if(s.split(a).length!==2) throw new Error('apply anchor');
  s=s.replace(a,`// 5c. 가격 캐시는 설정까지 포함한 키로
rep("  if(MK_PXC[key]) return MK_PXC[key];\\n  var c=(window.MK_PX_CFG||{})[key]; if(!c) return PRICE0;","  var c=(window.MK_PX_CFG||{})[key]; if(!c) return PRICE0;\\n  var ck=key+'|'+c.join('/'); if(MK_PXC[ck]) return MK_PXC[ck];",true);
rep("  return (MK_PXC[key]=p);","  return (MK_PXC[ck]=p);",true);
// 5d. 저장과 중복 검사는 현재 이름 하나로(ID, 옛 이름으로 들어와도 같은 전략)
rep("  var s2=tfSSFind(nick); if(!s2||s2.me) return;\\n  if(cpState().copies.some(","  var s2=tfSSFind(nick); if(!s2||s2.me) return;\\n  nick=s2.nick; /* ID 나 옛 이름으로 들어와도 같은 전략으로 저장 */\\n  if(cpState().copies.some(",true);
rep("  var t=tfS(); t.watch=t.watch||[];\\n  var i=t.watch.indexOf(nick);","  var sW=tfSSFind(nick); if(sW&&!sW.me) nick=sW.nick;\\n  var t=tfS(); t.watch=t.watch||[];\\n  var i=t.watch.indexOf(nick);",true);
rep("  if(!s2||s2.me){ toast('지금은 따라갈 수 없는 전략이에요'); return; }\\n  mkFollowClose(true); tfSS3DlgClose(true);","  if(!s2||s2.me){ toast('지금은 따라갈 수 없는 전략이에요'); return; }\\n  nick=s2.nick; ne=tfSSNe(nick);\\n  mkFollowClose(true); tfSS3DlgClose(true);",true);
// 5e. 원본을 찾지 못한 따라가기는 그렇다고 말한다
rep("    +'<div class=\\"mk-acct\\"><b>내 따라가기 계정</b>","    +(d.missing?'<div class=\\"warn3\\" style=\\"margin:0 0 12px\\">이전 목록의 전략이라 지금은 기록을 불러올 수 없어요. 넣은 금액은 그대로 보관돼요.</div>':'')\\n    +'<div class=\\"mk-acct\\"><b>내 따라가기 계정</b>",true);
rep("<small>작성자 '+gEsc(c.nick)+', 내 따라가기 계정</small><span class=\\"num\\">운용 '+cpUsd(d.inv)+', 순손익 '+cpUsd(d.net)+'</span>","<small>'+(seed?(MK_KIND[seed.kind]||'조건 실행')+', ':'')+'내 따라가기 계정</small><span class=\\"num\\">'+(d.missing?'원본 전략을 찾을 수 없어요, 넣은 금액 '+cpUsd(d.inv):'운용 '+cpUsd(d.inv)+', 순손익 '+cpUsd(d.net))+'</span>",true);
`+a); fs.writeFileSync(D+'apply2.cjs',s); console.log('apply2 ok'); }
// 카탈로그에 mkt 가 이미 있으므로 도식은 c.mkt 를 쓴다
