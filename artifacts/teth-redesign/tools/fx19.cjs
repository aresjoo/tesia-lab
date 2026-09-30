const fs=require('fs');let a=fs.readFileSync('rv.js','utf8');
function ed(x,y){ if(a.split(x).length!==2) throw new Error(x.slice(0,60)); a=a.replace(x,()=>y); }
// 판 저장에 원래 설정도 넣는다 (되돌리기용)
ed("function rvSnapNow(){ var R=BT.R, sp=rvSpecNow(); return {at:Date.now(),spec:sp,rule:rvRuleText(sp),per:BT.per,amt:BT.amt,ret:R.ret,mdd:R.mdd,n:rvTrades(),bench:R.benchRet,final:R.final}; }",
   "function rvSnapNow(){ var R=BT.R, sp=rvSpecNow(), t=tfS(); return {at:Date.now(),spec:sp,rule:rvRuleText(sp),ai:JSON.parse(JSON.stringify(t.aiSpec||{})),pi:((t.intake||{}).period||{}).i,per:BT.per,amt:BT.amt,ret:R.ret,mdd:R.mdd,n:rvTrades(),bench:R.benchRet,final:R.final}; }");
// 바뀐 조건 한 문장
ed("function rvProposal(sp){","function rvChangeText(cur,sp){ var k=sp.change; var pct=function(v){ return v==null?null:Math.abs(v)+'%'; };\n  if(k==='tp') return cur.tp==null?'산 가격보다 '+pct(sp.tp)+' 오르면 파는 조건을 새로 넣습니다':sp.tp==null?'산 가격보다 '+pct(cur.tp)+' 오르면 팔던 조건을 없앱니다':'산 가격보다 '+pct(cur.tp)+' 오르면 팔던 조건을 '+pct(sp.tp)+'로 바꿉니다';\n  if(k==='sl') return '산 가격보다 '+pct(cur.sl)+' 내리면 팔던 조건을 '+pct(sp.sl)+'로 바꿉니다';\n  if(k==='fng') return cur.fng==null?'공포 탐욕 지수 '+sp.fng+' 이하일 때만 사는 조건을 새로 넣습니다':sp.fng==null?'공포 탐욕 지수 '+cur.fng+' 이하일 때만 사던 조건을 없앱니다':'공포 탐욕 지수 '+cur.fng+' 이하일 때만 사던 조건을 '+sp.fng+' 이하로 바꿉니다';\n  if(k==='depth'){ var D={shallow:'조금',mid:'적당히',deep:'크게'}; return '사기 전에 밀리는 정도를 \"'+(D[cur.depth]||'적당히')+'\"에서 \"'+(D[sp.depth]||'적당히')+'\"로 바꿉니다'; }\n  if(k==='trend') return sp.trend?'방향이 뚜렷할 때만 사는 조건을 켭니다':'방향이 뚜렷할 때만 사던 조건을 끕니다';\n  return '조건 하나를 바꿉니다'; }\nfunction rvProposal(sp){");
ed("  var html='<div class=\"tf-sum rv-prop\" id=\"'+id+'\"><div class=\"h\">바뀔 규칙</div><div class=\"rv-rules\"><div><small>이전</small><p>'+gEsc(before)+'</p></div><div><small>이번</small><p>'+gEsc(after)+'</p></div></div>'\n    +'<button class=\"tf-btn p\" onclick=\"rvApply(\\''+id+'\\')\">수정한 규칙으로 다시 검증하기</button>",
   "  var html='<div class=\"tf-sum rv-prop\" id=\"'+id+'\"><div class=\"h\">바뀔 조건</div><p class=\"rv-ch\">'+gEsc(rvChangeText(rvSpecNow(),sp))+'</p><details class=\"rv-det\"><summary>규칙 전체 보기</summary><div class=\"rv-rules\"><div><small>이전</small><p>'+gEsc(before)+'</p></div><div><small>이번</small><p>'+gEsc(after)+'</p></div></div></details>'\n    +'<button class=\"tf-btn p\" onclick=\"rvApply(\\''+id+'\\')\">수정한 규칙으로 다시 검증하기</button>");
// 다시 검증하기: 같은 기간과 금액으로 바로 돌린다
ed("  if(t.aiSpec) t.aiSpec.sess=G.cur&&G.cur.id; tfSave();\n  setTimeout(function(){ location.hash='#/share/bt/mine'; },400);\n}",
   "  if(t.aiSpec) t.aiSpec.sess=G.cur&&G.cur.id; tfSave();\n  var prev=(t.btVers||[])[0]; rvRerun(prev?prev.per:null,prev?prev.amt:null);\n}\n/* 같은 기간과 금액으로 백테스트를 바로 시작한다 */\nfunction rvRerun(per,amt){ setTimeout(function(){ location.hash='#/share/bt/mine'; var n=0, iv=setInterval(function(){ n++; if(window.BT&&BT.s&&BT.s.mine&&BT.phase==='ready'&&document.getElementById('bt-root')){ clearInterval(iv); var ch=false; if(per!=null&&BT.per!==per){ BT.per=per; ch=true; } if(amt!=null&&BT.amt!==amt){ BT.amt=amt; ch=true; } if(ch) btReady(); setTimeout(function(){ try{ btStart(); }catch(e){} },300); } else if(n>60) clearInterval(iv); },150); },400); }\n/* 이전 규칙으로 돌아가기: 저장해 둔 설정을 되살리고 같은 조건으로 다시 돌린다 */\nfunction rvRevert(){ var t=tfS(), V=t.btVers||[], v=V[0]; if(!v||!v.ai) return; var now=rvSnapNow(); t.aiSpec=JSON.parse(JSON.stringify(v.ai)); if(t.intake&&t.intake.period&&v.pi!=null){ t.intake.period.i=v.pi; } t.cur=null; t.score=0; t.workDone=false; V.shift(); V.unshift(now); t.btVers=V.slice(0,5); tfSave(); toast('이전 규칙으로 돌아갑니다'); rvRerun(v.per,v.amt); }");
// 비교 블록: 효과 요약이 먼저, 규칙 전체는 접힘, 되돌리기 단추
ed("  return '<section class=\"bt-box rv-cmp\"><small>이전 판과 비교</small>'\n    +(same?'<p class=\"rv-same\">같은 기간, 같은 시작 금액, 같은 가격 자료로 비교했습니다</p>':'<p class=\"rv-same warn\">기간이나 금액이 달라 숫자를 나란히 비교하지 않습니다</p>')\n    +'<div class=\"rv-rules\"><div><small>이전 규칙</small><p>'+gEsc(v.rule)+'</p></div><div><small>이번 규칙</small><p>'+gEsc(rule)+'</p></div></div>'\n    +(same?'<div class=\"rv-rows\">",
   "  var up=R.ret>v.ret, sum=same?('수정 후 수익률은 '+mkPct0(v.ret,1)+'에서 '+mkPct0(R.ret,1)+'로 '+(up?'높아졌습니다':R.ret<v.ret?'낮아졌습니다':'같습니다')+'. 가장 크게 내려간 폭은 '+Math.abs(v.mdd).toFixed(1)+'%에서 '+Math.abs(R.mdd).toFixed(1)+'%로 '+(Math.abs(R.mdd)<Math.abs(v.mdd)?'줄었습니다':Math.abs(R.mdd)>Math.abs(v.mdd)?'커졌습니다':'같습니다')+'.'):'';\n  return '<section class=\"bt-box rv-cmp\"><small>이전 판과 비교</small>'\n    +(same?'<p class=\"rv-sum\">'+sum+'</p><p class=\"rv-same\">같은 기간, 같은 시작 금액, 같은 가격 자료로 비교했습니다</p>':'<p class=\"rv-same warn\">이전 검사와 기간이나 금액이 달라 결과 비교를 제공하지 않습니다</p>')\n    +(same?'<div class=\"rv-rows\">");
ed("    +'<button type=\"button\" class=\"rv-prev\" onclick=\"rvPrevOpen()\">이전 판 '+V.length+'개 보기</button></section>';",
   "    +'<details class=\"rv-det\"><summary>바뀐 규칙 전체 보기</summary><div class=\"rv-rules\"><div><small>이전 규칙</small><p>'+gEsc(v.rule)+'</p></div><div><small>이번 규칙</small><p>'+gEsc(rule)+'</p></div></div></details>'\n    +'<div class=\"rv-cmp-acts\"><button type=\"button\" class=\"rv-prev\" onclick=\"rvRevert()\">이전 규칙으로 돌아가기</button><button type=\"button\" class=\"rv-prev\" onclick=\"rvPrevOpen()\">이전 판 '+V.length+'개 보기</button></div></section>';");
// 복사 전략: 왜 규칙을 못 고치는지
ed("  if(bad||none) return note+mkC+runQ;","  var why='<p class=\"rv-why\">복사한 공개 전략은 규칙을 고칠 수 없습니다. 다른 전략을 직접 만들 수 있습니다.</p>';\n  if(bad||none) return note+why+mkC+runQ;");
fs.writeFileSync('rv.js',a);
fs.appendFileSync('bt6.css',`
.rv-sum{margin:0 0 6px;font-size:14px;line-height:1.6;color:#f2f3f5;font-weight:600}
.rv-why{margin:0 0 10px;font-size:12.5px;line-height:1.6;color:#8b9096}
.rv-ch{margin:6px 0 10px;font-size:14.5px;line-height:1.6;color:#f2f3f5;font-weight:600}
.rv-det{margin:0 0 12px}.rv-det summary{cursor:pointer;font-size:12.5px;color:#8b9096;list-style:none;display:flex;align-items:center;gap:6px}
.rv-det summary::before{content:'';width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .15s}
.rv-det[open] summary::before{transform:rotate(45deg)}
.rv-det .rv-rules{margin-top:8px}
.rv-cmp-acts{display:flex;gap:14px;flex-wrap:wrap}
`);
console.log('ok');
