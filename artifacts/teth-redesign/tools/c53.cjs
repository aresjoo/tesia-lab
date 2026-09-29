// 실제 시세 연결 + Codex(qa/mine) P1 다섯 건
const fs=require('fs'), D=__dirname+'/', R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
const ed=(file,pairs)=>{ let s=fs.readFileSync(file,'utf8'); for(const [x,y,n] of pairs){ const c=s.split(x).length-1; if(c!==(n||1)) throw new Error(file.slice(-12)+' x'+c+': '+x.slice(0,90)); s=s.split(x).join(y); } fs.writeFileSync(file,s); };

// ── A. 실제 시세: 데이터 파일을 먼저 읽고, 가격 줄과 날짜 기준을 거기서 가져온다
{ let h=fs.readFileSync(R+'index.html','utf8');
  const x1='<script src="site-config.js?v=2"></script>';
  if(h.split(x1).length!==2) throw new Error('site-config anchor');
  h=h.replace(x1,x1+'\r\n<script src="data/px-daily.js?v=2026-09-28"></script>');
  fs.writeFileSync(R+'index.html',h); }
ed(R+'index.html',[
  ["var PRICE=(function(){\r\n  var rng=mulberry32(3)","var PRICE=(function(){\r\n  if(window.TETH_PX&&TETH_PX.px&&TETH_PX.px['비트코인']) return TETH_PX.px['비트코인'].slice(); /* 실제 비트코인 일봉. 없을 때만 아래 씨앗 데이터 */\r\n  var rng=mulberry32(3)"],
  ["function mkPx(key){\r\n  if(!key) return PRICE0;\r\n","function mkPx(key){\r\n  if(!key) return PRICE0;\r\n  if(window.TETH_PX&&TETH_PX.px&&TETH_PX.px[key]) return TETH_PX.px[key]; /* 실제 일봉(쉬는 날은 직전 종가) */\r\n"],
  ["var DEV_END=909, HOLD_START=910, FULL_END=1334;","var FULL_END=PRICE.length-1, HOLD_START=FULL_END-424, DEV_END=HOLD_START-1;"],
  // P1-3: 터미널의 봇은 자기 자산의 가격 줄로 계산한다
  ["function tfTmKey(p){ return [p.sl,p.tp,p.rsiTh,p.trendFilter?1:0,p.startI,p.endI].join('|'); }","function tfTmKey(p){ return [p.sl,p.tp,p.rsiTh,p.trendFilter?1:0,p.startI,p.endI,p.px||''].join('|'); }\r\nfunction tfSPx(s){ return mkPx((s&&s.p&&s.p.px)||null); } /* 봇이 쓰는 자산의 가격 줄 */"],
  ["    var L2=tfBotLogEvents(p);","    var L2=mkWithPx(p.px,function(){ return tfBotLogEvents(p); });"],
]);
{ let h=fs.readFileSync(R+'index.html','utf8'); const lines=h.split('\r\n'); let n=0;
  const own=(i)=>{ for(let k=i;k>=0;k--){ const m=/^function (tfTmCalc|tfTmDash|tfTmDone|tfTmTradeDlg|tfTmPane)\(/.exec(lines[k]); if(m) return true; if(/^function /.test(lines[k])) return false; } return false; };
  for(let i=0;i<lines.length;i++){ if(lines[i].includes('PRICE[')&&own(i)){ const c=(lines[i].match(/PRICE\[/g)||[]).length; lines[i]=lines[i].split('PRICE[').join('tfSPx(s)['); n+=c; } }
  fs.writeFileSync(R+'index.html',lines.join('\r\n')); console.log('terminal price reads',n); }
ed(D+'rd-ui.js',[["var MK_ASOF=[2026,9,28], MK_DATA_V='2026-09-28.1',","var MK_ASOF=window.TETH_PX?TETH_PX.asof.split('-').map(Number):[2026,9,28], MK_DATA_V=window.TETH_PX?TETH_PX.v:'2026-09-28.1',"]]);

// ── B. 내 전략(mine) P1
ed(D+'bt-c.js',[
  // P1-1: 새로 답한 조건이 우선. 복제한 전략만 받은 설정(pendingP)을 쓴다. 기간도 식별에 넣는다
  ["  var p=t.pendingP||tfParams(), iv=t.intake,","  var p=(t.cloneFrom&&t.pendingP)?t.pendingP:tfParams(), iv=t.intake,"],
  ["  var sig=JSON.stringify(cfg), h=0;","  var sig=JSON.stringify(cfg)+'|'+((iv.period||{}).i)+'|'+(t.cloneFrom||'')+'|'+(t.cloneFrom&&p.startI!=null?p.startI:''), h=0;"],
  // P1-4: 승률은 끝난 거래 기준, 손익은 비율로. 열린 거래는 빼고, 가격 줄 자산(px)을 남긴다. P1-2: 어떤 조건의 결과인지(sig) 남긴다
  ["  var p={}; for(var k in s.p) p[k]=s.p[k]; p.startI=R.eq[0].i; p.endI=R.eq[R.N-1].i;\n  t.pendingP=s.p; t.cur={ret:R.ret,mdd:R.mdd,n:R.tr.length,winRate:R.tr.length?R.wins/R.tr.length*100:0,p:p,\n    trades:R.tr.map(function(x){ return {entry:x.e,exit:x.x,pnl:x.pnl,kind:x.why||x.kind}; })};",
   "  var p={}; for(var k in s.p) p[k]=s.p[k]; p.startI=R.eq[0].i; p.endI=R.eq[R.N-1].i; p.px=s.asset;\n  var done=R.tr.filter(function(x){ return !x.open; });\n  t.cur={ret:R.ret,mdd:R.mdd,n:done.length,winRate:done.length?R.wins.length/done.length*100:0,p:p,sig:s.id,asset:s.asset,\n    trades:done.map(function(x){ return {entry:x.e,exit:x.x,pnl:x.pnl/100,kind:x.why||x.kind}; })};"],
  // P1-5: 복제한 전략은 받은 기간에 가장 가까운 기간 선택지로 연다
  ["else if(s.mine){ var pi=((tfS().intake||{}).period||{}).i; BT.per=pi===0?365:pi===1?730:pi===2?0:365; } }",
   "else if(s.mine){ var t9=tfS(), pi=((t9.intake||{}).period||{}).i; BT.per=pi===0?365:pi===1?730:pi===2?0:365;\n    if(t9.cloneFrom&&s.p&&s.p.startI!=null){ var span=(PRICE0.length-1)-s.p.startI, best=0, bd=1e9; BT_PER.forEach(function(o){ var d=Math.abs((o[0]||PRICE0.length)-span); if(d<bd){ bd=d; best=o[0]; } }); BT.per=best; } } }"],
]);
// 결과가 지금 조건의 것인지: 조건이 바뀌었거나 가격 자료가 없는 자산이면 예전 결과로 실행하지 않는다
ed(D+'bt-c.js',[["/* 결과가 나오면 대화 흐름이 쓰는 검증 기록(t.cur)을 이 결과로 채운다. 점수 게이트는 없다 */",
  "/* 지금 조건과 다른 결과인가. 대화에서 만든 결과(sig 있음)만 따진다 */\nfunction btMineStale(){ var t=tfS(), c=t.cur; if(!c||!c.sig) return false; var m=btMine(); return !m||m.id!==c.sig; }\n/* 결과가 나오면 대화 흐름이 쓰는 검증 기록(t.cur)을 이 결과로 채운다. 점수 게이트는 없다 */"]]);
ed(R+'index.html',[
  ["function tfIntakeRedo(id){\r\n  var el=$(id); if(el){ el.remove(); taiRecFix(id,null); }\r\n  var t=tfS(); t.intake={}; t.qi=0; t.stage='intake'; tfSave();",
   "function tfIntakeRedo(id){\r\n  var el=$(id); if(el){ el.remove(); taiRecFix(id,null); }\r\n  var t=tfS(); t.intake={}; t.qi=0; t.stage='intake'; if(t.cur&&t.cur.sig){ t.cur=null; t.score=0; t.workDone=false; } if(!t.cloneFrom) t.pendingP=null; tfSave();"],
  ["function tfDoneView(){\r\n  var t=tfS();\r\n","function tfDoneView(){\r\n  var t=tfS();\r\n  if(typeof btMineStale==='function'&&btMineStale()){ toast('조건이 바뀌어서 다시 돌려 볼게요'); tfNav('#/share/bt/mine'); return; }\r\n"],
  ["function tfStartStrategy(){\r\n  var t=tfS();\r\n","function tfStartStrategy(){\r\n  var t=tfS();\r\n  if(typeof btMineStale==='function'&&btMineStale()){ toast('조건이 바뀌어서 다시 돌려 볼게요'); tfNav('#/share/bt/mine'); return; }\r\n"],
]);
// P2: 연결 완료 다음에 완료 화면을 한 번 더 거치지 않는다. 내 전략은 이 자리에서 바로 시작
ed(D+'bt-go.js',[["      +'<button type=\"button\" class=\"bt-cta\" onclick=\"btFinal()\">시작 준비로</button>'; }",
  "      +'<button type=\"button\" class=\"bt-cta\" onclick=\"btMineStart(\\'live\\')\">전략 시작</button><button type=\"button\" class=\"bt-sec\" onclick=\"btMineStart(\\'paper\\')\">가상으로 먼저 시작</button><button type=\"button\" class=\"bt-sec\" onclick=\"btMineStart(\\'later\\')\">나중에 시작</button>'; }\nfunction btMineStart(m){ var t=tfS(); if(!t.cur) btMineDone(); if(typeof btMineStale==='function'&&btMineStale()){ toast('조건이 바뀌어서 다시 돌려 볼게요'); btGoTo(''); return; } t.stage='done'; if(t.ob) t.ob.st='completed'; tfSave(); if(m==='later'){ tfLater(); return; } if(m==='paper') TF_NF_ENV='paper'; tfStartStrategy(); }"]]);
ed(D+'bt-go.js',[["return '<section class=\"btg-next\"><h3>다음은 전략 시작이에요</h3><p>대화에서 정한 투자금으로 바로 시작하거나, 가상으로 먼저 돌려 볼 수 있어요.</p>'",
  "return '<section class=\"btg-next\"><h3>이제 시작할 수 있어요</h3><p>대화에서 정한 투자금으로 바로 시작하거나, 가상으로 먼저 돌려 볼 수 있어요.</p>'"]]);
console.log('ok');
