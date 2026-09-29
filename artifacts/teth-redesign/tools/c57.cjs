// 따라가기: 이용료 없음(PROFIT_SHARE 0, 분배 표시 숨김), 거래소 연결 전에는 예산과 잔고를 묻지 않는다
const fs=require('fs'), R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
const ed=(file,pairs)=>{ let s=fs.readFileSync(file,'utf8'); for(const [x,y] of pairs){ const c=s.split(x).length-1; if(c!==1) throw new Error(file.slice(-12)+' x'+c+': '+x.slice(0,90)); s=s.split(x).join(y); } fs.writeFileSync(file,s); };
{ let c=fs.readFileSync(R+'teth-copy.js','utf8'); if(!/PROFIT_SHARE: 0\.10,/.test(c)) throw new Error('share anchor'); c=c.replace(/PROFIT_SHARE: 0\.10,( *)\/\* 수익 분배율 \*\//,'PROFIT_SHARE: 0,$1/* 수익 분배율. 따라가기는 무료(파운더 결정 2026-09-29) */'); fs.writeFileSync(R+'teth-copy.js',c); }
ed(R+'index.html',[
  // 분배율이 0이면 분배 탭, 분배 표시를 숨긴다
  ["  var TABS=[['pos','포지션'],['hist','청산 이력'],['share','수익 분배'],['bal','자금 이동'],['tx','거래 내역']];\r\n  var body=",
   "  var TABS=[['pos','포지션'],['hist','청산 이력']].concat(m.share>0?[['share','수익 분배']]:[]).concat([['bal','자금 이동'],['tx','거래 내역']]); if(tab==='share'&&!(m.share>0)) tab='pos';\r\n  var body="],
  ["+'<div class=\"cpp-meta num\"><span>비율 따라가기</span><span title=\"Profit share ratio\">수익 분배 '+Math.round(m.share*100)+'%</span>'",
   "+'<div class=\"cpp-meta num\"><span>비율 따라가기</span>'+(m.share>0?'<span title=\"Profit share ratio\">수익 분배 '+Math.round(m.share*100)+'%</span>':'<span>이용료 없음</span>')"],
  ["+K('가용',d.avail)+K('순손익 (분배 차감 후)',d.net,1)\r\n    +K('미실현 손익',d.unreal,1)+K('실현 손익',d.realized,1)+K('수익 분배 지급',d.share,0,'Profit share amount')",
   "+K('가용',d.avail)+K(m.share>0?'순손익 (분배 차감 후)':'순손익',d.net,1)\r\n    +K('미실현 손익',d.unreal,1)+K('실현 손익',d.realized,1)+(m.share>0?K('수익 분배 지급',d.share,0,'Profit share amount'):'')"],
  ["      +'<div><small>수익 분배 지급</small><b class=\"num\">'+cpUsd(d.share)+'</b></div>'",
   "      +(d.share>0?'<div><small>수익 분배 지급</small><b class=\"num\">'+cpUsd(d.share)+'</b></div>':'')"],
  ["      +'<div><small>수익 분배 지급</small><b class=\"num\">'+cpUsd((c2.settle&&c2.settle.share)||0)+'</b></div>'",
   "      +((c2.settle&&c2.settle.share)>0?'<div><small>수익 분배 지급</small><b class=\"num\">'+cpUsd(c2.settle.share)+'</b></div>':'')"],
  ["+K('미실현 손익',sum.unreal)+K('실현 손익',sum.realized)+K('수익 분배 지급',sum.share,'Profit share amount')",
   "+K('미실현 손익',sum.unreal)+K('실현 손익',sum.realized)+(sum.share>0?K('수익 분배 지급',sum.share,'Profit share amount'):'')"],
  // 따라가기 창: 연결 전에는 예산, 잔고, 요약을 보여 주지 않고 순서만 안내한다
  ["    +'<div class=\"mk-f-fld\" id=\"cps-amt-fld\"><label for=\"cps-amt\">예산 (USDT)</label>'",
   "    +(!can?'<ol class=\"mk-f-steps\"><li><b>거래소 연결</b><span>쓰고 있는 거래소 계정을 연결해요. 돈은 그 계정에 그대로 있어요.</span></li><li><b>예산 정하기</b><span>연결한 계정의 잔고를 보고, 이 전략에 쓸 금액을 정해요.</span></li><li><b>따라가기 시작</b><span>원본이 쓰는 비율대로 내 예산 안에서 같이 사고팔아요.</span></li></ol>':'')\r\n    +(can?'<div class=\"mk-f-fld\" id=\"cps-amt-fld\"><label for=\"cps-amt\">예산 (USDT)</label>'"],
  ["    +'<div class=\"mk-f-sum\" id=\"mk-f-sum\"></div><div id=\"mk-f-live\"",
   "    +'<div class=\"mk-f-sum\" id=\"mk-f-sum\"></div>':'')+'<div id=\"mk-f-live\""],
  ["    +'</details>'\r\n    +(can?'<button type=\"button\" class=\"mk-pri mk-f-cta\" id=\"cps-cta\" disabled",
   "    +'</details>':'')\r\n    +(can?'<button type=\"button\" class=\"mk-pri mk-f-cta\" id=\"cps-cta\" disabled"],
  ["    +'<details class=\"mk-f-adv\"><summary>고급</summary>'","    +(can?'<details class=\"mk-f-adv\"><summary>고급</summary>'"],
  ["      :'<div class=\"mk-f-gate\">따라가기는 거래소 연결 뒤에 시작할 수 있어요</div><button type=\"button\" class=\"mk-pri mk-f-cta\" onclick=\"tfMkActivate()\">거래소 연결하기</button>')",
   "      :'<button type=\"button\" class=\"mk-pri mk-f-cta\" onclick=\"tfMkActivate()\">거래소 연결하기</button>')"],
  ["    +'<div class=\"mk-f-foot\">시작 후에도 언제든 중단할 수 있어요. 수익이 나면 그중 '+Math.round(cpMeta(nick).share*100)+'%가 전략 이용료로 나가요.</div>'",
   "    +'<div class=\"mk-f-foot\">따라가기는 무료예요. 시작한 뒤에도 언제든 멈출 수 있어요.</div>'"],
]);
console.log('ok');
