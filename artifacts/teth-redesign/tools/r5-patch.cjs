// Round 4 비평 반영 (Claude 시각 1, 3, 5 + Codex N1, N4, N5, V2~V10)
const fs=require('fs'); const D=__dirname+'/';
function edit(file,pairs){ let s=fs.readFileSync(D+file,'utf8'); for(const [a,b] of pairs){ const n=s.split(a).length-1; if(n!==1) throw new Error(file+' anchor x'+n+': '+a.slice(0,70)); s=s.replace(a,()=>b); } fs.writeFileSync(D+file,s); console.log(file,'ok',pairs.length); }
edit('agent-core.js',[
 // V4: 마지막으로 종목을 비교한 날을 상태에 남긴다
 ["if(!fixed&&!p&&(i-startI)%c.every===0){ var C=choose(i); lastTop=C.rows.slice(0,3).map(function(r){ return {k:r.k,mom:r.mom*100}; });",
  "if(!fixed&&!p&&(i-startI)%c.every===0){ var C=choose(i); topAt=i; lastTop=C.rows.slice(0,3).map(function(r){ return {k:r.k,mom:r.mom*100}; });"],
 ["var L=mkLedger(), eq=[], ev=[], pick=fixed, cur=startI, lastTop=null,","var L=mkLedger(), eq=[], ev=[], pick=fixed, cur=startI, topAt=null, lastTop=null,"],
 ["r.state={asOf:endI,pick:pick,top:lastTop,","r.state={asOf:endI,pick:pick,top:lastTop,topAt:topAt,"]
]);
edit('rd-ui.js',[
 // N1: 날짜 기준도 데이터 세대를 따른다
 ["var MK_ASOF=[2026,9,28], MK_DATA_V='2026-09-28.1', MK_D0=null;\nfunction idxToDate(i){ if(!MK_D0){ MK_D0=new Date(MK_ASOF[0],MK_ASOF[1]-1,MK_ASOF[2]); MK_D0.setDate(MK_D0.getDate()-(PRICE0.length-1)); }",
  "var MK_ASOF=[2026,9,28], MK_DATA_V='2026-09-28.1', MK_D0=null, MK_D0K='';\nfunction idxToDate(i){ var dk=MK_ASOF.join('-')+'|'+PRICE0.length+'|'+MK_DATA_V; if(!MK_D0||MK_D0K!==dk){ MK_D0K=dk; MK_D0=new Date(MK_ASOF[0],MK_ASOF[1]-1,MK_ASOF[2]); MK_D0.setDate(MK_D0.getDate()-(PRICE0.length-1)); }"],
 ["function mkCatSig(){ return JSON.stringify(MK_CAT)+JSON.stringify(MK_PX_CFG)+MK_DATA_V+MK_FEE+'|'+PRICE0.length; }","function mkCatSig(){ return JSON.stringify(MK_CAT)+JSON.stringify(MK_PX_CFG)+MK_DATA_V+MK_FEE+'|'+PRICE0.length+'|'+MK_ASOF.join('-'); }"],
 // N5: 기준 바로 위아래를 같은 숫자로 보이지 않게
 ["/* 조건까지의 위치:","/* 값과 기준을 나란히 쓸 때: 기준과 구별될 때까지 소수 자리를 늘리고, 그래도 같아 보이면 위아래를 말로 붙인다 */\nfunction mkVs(v,th,unit,plus){ var d=1, s, t2; for(;d<=6;d++){ s=v.toFixed(d); t2=th.toFixed(d); if(s!==t2) break; } if(d>6){ d=6; s=v.toFixed(6); } s=s.replace(/(\\.\\d*?[1-9])0+$/,'$1').replace(/\\.0+$/,''); if(d<=1&&Math.abs(v-th)>=1.5) s=String(Math.round(v)); return (plus&&v>0?'+':'')+s+unit+(v.toFixed(6)===th.toFixed(6)?(v>th?' (기준 바로 위)':v<th?' (기준 바로 아래)':' (기준과 같음)'):''); }\n/* 조건까지의 위치:"],
 ["var gap=Math.abs(cur-need), a=gap<0.005?cur.toFixed(4):gap<0.05?cur.toFixed(3):gap<0.5?cur.toFixed(2):gap<1.5?cur.toFixed(1):String(Math.round(cur)), tx='밀린 정도 '+a+', 기준 '+need+' 초과';",
  "var tx='밀린 정도 '+mkVs(100-q.rsi,need,'')+', 기준 '+need+' 초과';"],
 ["'<span class=\"mk3-gauge-t num\">하루 '+mkPct0(q.bounce,Math.abs(q.bounce-0.5)<0.005?4:Math.abs(q.bounce-0.5)<0.05?3:2)+', 기준 +0.5% 초과</span>'","'<span class=\"mk3-gauge-t num\">하루 '+mkVs(q.bounce,0.5,'%',true)+', 기준 +0.5% 초과</span>'"],
 ["'<span class=\"mk3-gauge-t num\">평균선 간격 '+q.gap.toFixed(Math.abs(q.gap-3)<0.05?3:Math.abs(q.gap-3)<0.5?2:1)+'%, 기준 3% 초과</span>'","'<span class=\"mk3-gauge-t num\">평균선 간격 '+mkVs(q.gap,3,'%')+', 기준 3% 초과</span>'"],
 // V4: 고를 때의 비교는 날짜와 함께
 ["    if(st.top&&st.top.length) rows+=row('AI가 비교한 것',gEsc(mkUni(s).label)+' 중 '+c.look+'일 오름폭 상위. '+st.top.map(function(x){ return gEsc(x.k)+' <i class=\"num\">'+mkPct0(x.mom,0)+'</i>'; }).join(', '));",
  "    if(st.top&&st.top.length&&st.topAt!=null) rows+=row('고를 때 본 것',mkMD(st.topAt)+'에 비교한 '+c.look+'일 오름폭. '+st.top.map(function(x){ return gEsc(x.k)+' <i class=\"num\">'+mkPct0(x.mom,0)+'</i>'; }).join(', '));"],
 // N4: 분석 요청에 실제 설정값
 ["+'. 지금: '+mkNowLine(s)+'. 최근 판단: '","+'. 설정값: '+Object.keys(s.cfg).filter(function(k){ return ['id','name','one','ex','fw','mkt','kind'].indexOf(k)<0; }).map(function(k){ return k+'='+s.cfg[k]; }).join(', ')+'. 지금: '+mkNowLine(s)+'. 최근 판단: '"],
 // 첫 배너: 그림 대 도식(비교 렌더)
 ["slide(0,'mkh-s2 mkh-k',\"mkKindPick('all')\",'판단 방식 세 가지','직접 고르기, 조건 실행,<br>둘을 나눠 맡기','무엇을 보고 언제 움직였는지 기록으로 남겨요','<i class=\"mkh-cta\">판단 방식으로 고르기</i>')",
  "slide(0,(MK_VAR.hero==='img'?'mkh-s2 mkh-dim':'mkh-kd')+' mkh-k',\"mkKindPick('all')\",'판단 방식 세 가지','직접 고르기, 조건 실행,<br>둘을 나눠 맡기','무엇을 보고 언제 움직였는지 기록으로 남겨요','<i class=\"mkh-cta\">판단 방식으로 고르기</i>'+(MK_VAR.hero==='img'?'':mkHeroArt()))"],
 ["function mkHero(){","/* 첫 배너의 그림: 세 판단 방식의 도식(카드의 식별 도식과 같은 문법) */\nfunction mkHeroArt(){\n  var W='rgba(233,235,238,.92)', D='rgba(233,235,238,.30)', o='', i;\n  for(i=0;i<8;i++) o+='<circle cx=\"'+(16+(i%4)*16)+'\" cy=\"'+(i<4?38:58)+'\" r=\"'+(i<3?5:3)+'\" fill=\"'+(i<3?W:D)+'\"/>';\n  o+='<path d=\"M108 30l18 40 14-12 22-20\" fill=\"none\" stroke=\"'+W+'\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"162\" cy=\"38\" r=\"4.5\" fill=\"'+W+'\"/><path d=\"M104 78h64\" stroke=\"'+D+'\" stroke-width=\"2\" stroke-dasharray=\"3 4\"/>';\n  for(i=0;i<3;i++) o+='<circle cx=\"206\" cy=\"'+(32+i*16)+'\" r=\"'+(i===1?5:3)+'\" fill=\"'+(i===1?W:D)+'\"/>';\n  o+='<path d=\"M216 48h10\" stroke=\"'+W+'\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><path d=\"M232 32l12 34 10-10 16-16\" fill=\"none\" stroke=\"'+W+'\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"270\" cy=\"40\" r=\"4.5\" fill=\"'+W+'\"/>';\n  return '<svg class=\"mkh-art\" viewBox=\"0 0 284 96\" aria-hidden=\"true\">'+o+'</svg>';\n}\nfunction mkHero(){"],
 // V10
 ["'</span><span class=\"mk3-gauge-t\">숫자는 최근 '+c.look+'일 오름폭, 순서는 그 오름폭을 흔들림으로 나눈 값이에요. 평균 아래는 60일 평균 가격보다 낮다는 뜻이고, 이런 종목은 사지 않아요. 종목 교체는 재평가 날에만 하고, 고점에서 '+c.trail+'% 밀렸는지는 매일 확인해요.</span>');",
  "'</span><span class=\"mk3-gauge-t\">숫자는 최근 '+c.look+'일 오름폭, 순서는 오름폭을 흔들림으로 나눈 값이에요. 60일 평균 가격보다 낮은 종목(평균 아래)은 사지 않아요.</span>');"]
]);
// V2: 판단 방식을 고른 뒤 같은 버튼에 포커스를 돌려준다
fs.appendFileSync(D+'rd-ui.js',`
function mkKindPick(v){ var t=tfSSState(), had=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.mk3-seg'); t.ss.kind=v; tfSave(); tfShareHub('find'); if(had){ var b=document.querySelector('.mk3-seg button[aria-pressed="true"]'); if(b) try{ b.focus({preventScroll:true}); }catch(e){ b.focus(); } } }
`);
fs.appendFileSync(D+'rd.css',`
/* Round 4 */
.mkh-kd{background:#131517}
.mkh-s2.mkh-dim{background:linear-gradient(90deg,rgba(11,12,14,.97) 0%,rgba(11,12,14,.86) 52%,rgba(11,12,14,.62) 100%),url(assets/hero-tiles-end.jpg) 70% 60%/cover no-repeat}
.mkh-art{position:absolute;right:30px;top:50%;width:284px;height:96px;margin-top:-48px;opacity:.95}
@media (max-width:1100px){.mkh-art{width:200px;height:68px;margin-top:-34px;right:18px;opacity:.5}}
@media (max-width:640px){.mkh-art{display:none}}
.mk3-dh-acts{gap:20px}
.mk3-panel.mk3-nowp{border-color:rgba(255,255,255,.24)}
.mk3-steps li,.mk3-steps li.done{opacity:1;border-color:rgba(255,255,255,.08)}
.mk3-steps li.on{border-color:rgba(255,255,255,.55)}
.mk3-steps li:not(.on) b{color:var(--gt2)}
.mk3-steps small{color:#aeb3b9}
#g-root .mk3:hover{background:#131517;border-color:rgba(255,255,255,.10)}
#g-root .mk .mk-tabs,#g-root .mk-tabs{overflow-y:hidden}
@media (max-width:860px){
  .mk3-dh-one{margin-top:10px;font-size:15px}
  .mk3-dh-acts{margin-top:12px;gap:10px}
  .mk3-dh-top{gap:12px}
}
`);
