// Round 3 비평 반영 (Claude 1~7). Codex 항목은 뒤에 추가
const fs=require('fs'); const D=__dirname+'/';
function edit(file,pairs){ let s=fs.readFileSync(D+file,'utf8'); for(const [a,b] of pairs){ const n=s.split(a).length-1; if(n!==1) throw new Error(file+' anchor x'+n+': '+a.slice(0,70)); s=s.replace(a,()=>b); } fs.writeFileSync(D+file,s); console.log(file,'ok',pairs.length); }
edit('rd-ui.js',[
 ["<em>'+(x.held?'보유':x.ok?'후보':x.above?'관찰':'약세')+'</em></span>'; }).join('')+'</span><span class=\"mk3-gauge-t\">순서는 최근 '+c.look+'일 오름폭을 흔들림으로 나눈 값이에요. '+st.scan.of+'종 중 '+st.scan.up+'종이 오름세</span>');",
  "<em>'+(x.held?'보유':x.ok?'후보':x.above?'기준 미달':'평균 아래')+'</em></span>'; }).join('')+'</span><span class=\"mk3-gauge-t\">순서는 최근 '+c.look+'일 오름폭을 흔들림으로 나눈 값이에요. '+(st.open.length>=c.top?'자리 '+c.top+'개가 다 차 있고, ':'')+'든 종목은 순위에서 많이 밀릴 때까지 유지해요</span>');"],
 ["if(p&&(e.k==='hold'||e.k==='wait')&&p.k===e.k&&p.dec===e.dec){ p.cnt=(p.cnt||1)+1; continue; }","if(p&&(e.k==='hold'||e.k==='wait')&&p.k===e.k&&p.dec===e.dec){ p.cnt=(p.cnt||1)+1; p.from=e.i; continue; }"],
 ["+mkMD(e.i)+(e.cnt?'<small>'+e.cnt+'번 연속</small>':'')+'</div>'","+mkMD(e.i)+(e.cnt?'<small>'+mkMD(e.from)+'부터 '+e.cnt+'번</small>':'')+'</div>'"],
 ["    if(st.open) rows+=row('정리 조건','+'+c.tp+'% 또는 '+c.sl+'%, 아니면 '+Math.max(0,25-st.open.held)+'일 뒤');\n    else if(q) rows+=mkCondRows(q,c,row);\n    rows+=row('다음 일정'",
  "    if(st.top&&st.top.length) rows+=row('AI가 비교한 것',gEsc(mkUni(s).label)+' 중 '+c.look+'일 오름폭 상위. '+st.top.map(function(x){ return gEsc(x.k)+' <i class=\"num\">'+mkPct0(x.mom,0)+'</i>'; }).join(', '));\n    if(st.open) rows+=row('정리 조건','+'+c.tp+'% 또는 '+c.sl+'%, 아니면 '+Math.max(0,25-st.open.held)+'일 뒤');\n    else if(q) rows+=mkCondRows(q,c,row);\n    rows+=row('다음 일정'"],
 ["function mkNowLine(s){\n  var r=s.r||{}, st=r.state; if(!st) return s.me?'내가 공유한 전략':'';",
  "function mkNowLine(s){\n  var r=s.r||{}, st=r.state; if(!st) return s.me?'내가 공유한 전략':'';\n  var pos=function(q,th){ return MK_VAR.now==='b'&&q&&!q.rsiOk?', 밀린 정도 '+Math.round(100-q.rsi)+' (기준 '+(100-th)+')':''; };"],
 ["  if(s.kind==='mix') return st.pick?st.pick+' '+mkWaitWhy(st.cond,false):'고를 종목 없음, 대기';\n  return mkWaitWhy(st.cond,s.cfg&&s.cfg.tf);",
  "  if(s.kind==='mix') return st.pick?st.pick+' '+mkWaitWhy(st.cond,false)+pos(st.cond,s.cfg.rsiTh):'고를 종목 없음, 대기';\n  return mkWaitWhy(st.cond,s.cfg&&s.cfg.tf)+pos(st.cond,s.cfg.rsiTh);"]
]);
fs.appendFileSync(D+'rd.css',`
.mk3-steps i,.mk3-kv i,.mk3-ulist i{font-style:normal}
.mk3-two>.mk3-does{align-self:start}
`);

// ── Codex Round 3 항목 ──
edit('rd-ui.js',[
 // N1: 세대(길이, 버전)를 서명에
 ["function mkCatSig(){ return JSON.stringify(MK_CAT)+JSON.stringify(MK_PX_CFG)+MK_DATA_V+MK_FEE; }","function mkCatSig(){ return JSON.stringify(MK_CAT)+JSON.stringify(MK_PX_CFG)+MK_DATA_V+MK_FEE+'|'+PRICE0.length; }"],
 // N3: 저장된 ID 도 현재 이름으로
 ["canon=function(n){ var id=MK_ALIAS[n]; if(!id) return n; for(var i=0;i<MK_CAT.length;i++) if(MK_CAT[i].id===id) return MK_CAT[i].name; return n; };",
  "canon=function(n){ var id=MK_ALIAS[n]||n; for(var i=0;i<MK_CAT.length;i++) if(MK_CAT[i].id===id) return MK_CAT[i].name; return n; };"],
 // N5: 경계에서 같은 값으로 보이지 않게
 ["var near=Math.abs(cur-need)<1.5, a=near?cur.toFixed(1):String(Math.round(cur)), tx='밀린 정도 '+a+', 기준 '+need+' 초과';",
  "var gap=Math.abs(cur-need), a=gap<0.005?cur.toFixed(4):gap<0.05?cur.toFixed(3):gap<0.5?cur.toFixed(2):gap<1.5?cur.toFixed(1):String(Math.round(cur)), tx='밀린 정도 '+a+', 기준 '+need+' 초과';"],
 ["'<span class=\"mk3-gauge-t num\">하루 '+mkPct0(q.bounce,2)+', 기준 +0.5% 초과</span>'","'<span class=\"mk3-gauge-t num\">하루 '+mkPct0(q.bounce,Math.abs(q.bounce-0.5)<0.005?4:Math.abs(q.bounce-0.5)<0.05?3:2)+', 기준 +0.5% 초과</span>'"],
 ["'<span class=\"mk3-gauge-t num\">평균선 간격 '+q.gap.toFixed(1)+'%, 기준 3% 초과</span>'","'<span class=\"mk3-gauge-t num\">평균선 간격 '+q.gap.toFixed(Math.abs(q.gap-3)<0.05?3:Math.abs(q.gap-3)<0.5?2:1)+'%, 기준 3% 초과</span>'"],
 // N6: 혼합의 재선택은 보유하지 않을 때만, 60일 평균 위에서
 ["['AI가 정하는 것','거래할 종목 하나. '+u.label+' 중 '+c.look+'일 동안 가장 많이 오른 종목을 '+c.every+'일마다 다시 골라요'+(c.gate?'. 시장이 약하면 진입을 보류해요':'')]",
  "['AI가 정하는 것','거래할 종목 하나. '+u.label+' 가운데 60일 평균 가격 위에 있고 '+c.look+'일 동안 가장 많이 오른 종목. 보유하지 않을 때 '+c.every+'일마다 다시 골라요'+(c.gate?'. 시장이 약하면 진입을 보류해요':'')]"],
 // N8, N10: 표 설명
 ["'</span><span class=\"mk3-gauge-t\">순서는 최근 '+c.look+'일 오름폭을 흔들림으로 나눈 값이에요. '+(st.open.length>=c.top?'자리 '+c.top+'개가 다 차 있고, ':'')+'든 종목은 순위에서 많이 밀릴 때까지 유지해요</span>');",
  "'</span><span class=\"mk3-gauge-t\">숫자는 최근 '+c.look+'일 오름폭, 순서는 그 오름폭을 흔들림으로 나눈 값이에요. 평균 아래는 60일 평균 가격보다 낮다는 뜻이고, 이런 종목은 사지 않아요. 종목 교체는 재평가 날에만 하고, 고점에서 '+c.trail+'% 밀렸는지는 매일 확인해요.</span>');"],
 ["['언제 파나','든 종목의 힘이 꺾이거나, 순위에서 많이 밀리거나, 고점에서 '+c.trail+'% 밀릴 때']",
  "['언제 파나','재평가 날에 든 종목의 힘이 꺾였거나 순위가 '+(c.top+2)+'위 밖이면 팔아요. 고점에서 '+c.trail+'% 밀리면 그날 바로 팔아요']"],
 // N9: 다음 재평가를 표보다 먼저
 ["    rows+=row('보는 종목',","    rows+=row('다음 재평가',mkMD(st.nextEval)+' 장 마감'+(st.lastEval<end?', 마지막 재평가 '+mkMD(st.lastEval):''));\n    rows+=row('보는 종목',"],
 ["</span>');\n    rows+=row('다음 재평가',mkMD(st.nextEval)+' 장 마감'+(st.lastEval<end?', 마지막 재평가 '+mkMD(st.lastEval):''));\n  } else if(s.kind==='mix'){","</span>');\n  } else if(s.kind==='mix'){"],
 // 접힌 기록: 첫 날짜와 마지막 날짜
 ["(e.cnt?'<small>'+mkMD(e.from)+'부터 '+e.cnt+'번</small>':'')","(e.cnt?'<small>'+mkMD(e.from)+'부터, '+e.cnt+'번</small>':'')"],
 // N4: 분석 요청의 기간과 설정
 ["q='전략 분석 요청: \"'+s.name+'\" ('+MK_KIND[s.kind]+', '+mkScope(s)+'). 하는 일: '+mkDoes(s).map(function(d){ return d[0]+' '+d[1]; }).join('. ')+'. 지금: '+mkNowLine(s)+'. 기록: 시작 이후 '+mkPct0(r.ret)",
  "q='전략 분석 요청: \"'+s.name+'\" ('+MK_KIND[s.kind]+', '+mkScope(s)+'). 하는 일: '+mkDoes(s).map(function(d){ return d[0]+' '+d[1]; }).join('. ')+'. 움직이는 방식: '+mkHowRows(s).map(function(d){ return d[0]+' '+d[1]; }).join('. ')+'. 지금: '+mkNowLine(s)+'. 최근 판단: '+mkEvFold(mkEvents(s,s.r),3).map(function(e){ return mkMD(e.i)+' '+e.dec+' ('+e.obs+')'; }).join(' / ')+'. 기록('+mkPdLabel(pd||'all')+'): 수익률 '+mkPct0(r.ret)"]
]);
// 적용 스크립트 추가 항목
{ let s=fs.readFileSync(D+'apply2.cjs','utf8'); const a='// 6. rd 블록이 선언하는 함수의 옛 정의를 지운다'; if(s.split(a).length!==2) throw new Error('apply anchor');
  s=s.replace(a,`// 5f. 가격 캐시 키에 길이와 데이터 버전
rep("  var ck=key+'|'+c.join('/'); if(MK_PXC[ck]) return MK_PXC[ck];","  var ck=key+'|'+c.join('/')+'|'+PRICE0.length+'|'+(window.MK_DATA_V||''); if(MK_PXC[ck]) return MK_PXC[ck];",true);
// 5g. 따라가는 중 목록: 원본을 찾지 못한 계정은 합계에서 빼고 그렇다고 표시
rep("  act.forEach(function(c2){ var d=cpCalc(c2); sum.est+=d.est;","  act.forEach(function(c2){ var d=cpCalc(c2); if(d.missing) return; sum.est+=d.est;",true);
rep("      +'<span class=\\"tag '+(on?'on':'off')+'\\">'+(on?'따라가는 중':'중단됨')+'</span>'\n      +'<span style=\\"flex:1\\"></span><span class=\\"cps-static num\\">'+new Date(c2.at).toLocaleDateString('ko-KR')+' 시작</span></div>'\n      +(on?'<div class=\\"cpd-kv\\">'","      +'<span class=\\"tag '+(on&&!d.missing?'on':'off')+'\\">'+(d.missing?'원본을 찾을 수 없음':on?'따라가는 중':'중단됨')+'</span>'\n      +'<span style=\\"flex:1\\"></span><span class=\\"cps-static num\\">'+new Date(c2.at).toLocaleDateString('ko-KR')+' 시작</span></div>'\n      +(d.missing?'<div class=\\"cpd-kv\\"><div><small>넣은 금액</small><b class=\\"num\\">'+cpUsd(d.inv)+'</b></div></div>':on?'<div class=\\"cpd-kv\\">'",true);
// 5h. 사람 작성자처럼 읽히는 문장
rep("toast(nick+' 님의 전략을 따라가기 시작했어요. 다음 진입부터 자동으로 따라가요');","toast(nick+' 따라가기를 시작했어요. 다음 진입부터 자동으로 따라가요');",true);
rep("'</b>로 '+gEsc(TF_MKF.nick||'')+' 님의 전략을 그대로 따라가요.</div>'","'</b>로 '+gEsc(TF_MKF.nick||'')+'의 판단을 그대로 따라가요.</div>'",true);
rep("수익이 나면 '+Math.round(cpMeta(nick).share*100)+'%를 작성자와 나눠요.</div>'","수익이 나면 그중 '+Math.round(cpMeta(nick).share*100)+'%가 전략 이용료로 나가요.</div>'",true);
rep("'%가 작성자에게 분배되고 내역이 여기에 남아요.'","'%가 전략 이용료로 나가고 내역이 여기에 남아요.'",true);
`+a); fs.writeFileSync(D+'apply2.cjs',s); console.log('apply2 ok'); }
