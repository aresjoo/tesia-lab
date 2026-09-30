const fs=require('fs');let a=fs.readFileSync('rv.js','utf8');
function ed(x,y){ if(a.split(x).length!==2) throw new Error(x.slice(0,50)); a=a.replace(x,()=>y); }
ed("function rvFix(){\n  var t=tfS(); if(!BT.s||!BT.s.mine||!BT.R) return;",
   "function rvFix(){\n  var t=tfS(); if(!BT.s||!BT.s.mine||!BT.R) return;\n  if(TAI.req||(TAI.busy&&Date.now()-(TAI.busyAt||0)<180000)){ toast('이전 답변을 마무리하는 중입니다, 끝나면 다시 눌러 주십시오'); return; }");
ed("마지막 줄에 바뀐 설정 전체를 [STRATEGY {...}] 태그로 붙여라. asset, period, name은 그대로 두고 바꾼 값 하나만 다르게 하라.'; }",
   "마지막 줄에 바뀐 설정 전체를 [STRATEGY {...}] 태그로 붙이되 \"change\" 키에 바꾼 항목 이름 하나(depth, tp, sl, fng, trend 중 하나)를 넣어라. asset, period, name은 그대로 두고 바꾼 값 하나만 다르게 하라.'; }");
// 제안은 현재 설정에 바뀐 항목 하나만 얹는다. 이름, 자산, 기간은 그대로
ed("function rvProposal(sp){\n  var t=tfS(), before=rvRuleText(rvSpecNow()), after=rvRuleText(sp); RV.prop=sp;",
   "function rvOne(sp){ var cur=rvSpecNow(), F=['depth','tp','sl','fng','trend'], ch=(sp&&F.indexOf(sp.change)>=0)?sp.change:null;\n  if(!ch){ var d=F.filter(function(k){ return String(sp[k])!==String(cur[k]); }); ch=d[0]||null; }\n  var out={}; for(var k in cur) out[k]=cur[k]; if(ch){ out[ch]=sp[ch]; if(ch==='sl') out.sl=-Math.abs(Number(sp.sl)||5); if(ch==='tp') out.tp=sp.tp==null?null:Number(sp.tp); if(ch==='fng') out.fng=sp.fng==null?null:Number(sp.fng); if(ch==='trend') out.trend=!!sp.trend; }\n  out.change=ch; return out; }\nfunction rvProposal(sp){\n  sp=rvOne(sp); var t=tfS(), before=rvRuleText(rvSpecNow()), after=rvRuleText(sp); RV.prop=sp;\n  if(!sp.change||before===after){ taiThreadAdd('<div class=\"g-amsg\"><p>바꿀 조건을 하나 고르지 못했습니다. 바꾸고 싶은 조건을 말해 주시면 그 조건으로 다시 검증합니다.</p></div>'); gScrollBottom(); return; }");
fs.writeFileSync('rv.js',a); console.log('ok');
