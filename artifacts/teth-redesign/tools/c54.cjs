// 터미널: 새 백테스트에서 만든 봇(p.eng='mk')은 같은 엔진, 같은 자산 가격으로 계산한다
const fs=require('fs'), D=__dirname+'/', R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
const ed=(file,pairs)=>{ let s=fs.readFileSync(file,'utf8'); for(const [x,y] of pairs){ const c=s.split(x).length-1; if(c!==1) throw new Error(file.slice(-12)+' x'+c+': '+x.slice(0,90)); s=s.split(x).join(y); } fs.writeFileSync(file,s); };
ed(R+'index.html',[
  ["  return {sl:p.sl,tp:p.tp!=null?p.tp:null,rsiTh:p.rsiTh,trendFilter:!!p.trendFilter,startI:s2,endI:p.endI!=null?p.endI:end};",
   "  return {sl:p.sl,tp:p.tp!=null?p.tp:null,rsiTh:p.rsiTh,trendFilter:!!p.trendFilter,startI:s2,endI:p.endI!=null?p.endI:end,px:p.px||null,eng:p.eng||null};"],
  ["function tfTmKey(p){ return [p.sl,p.tp,p.rsiTh,p.trendFilter?1:0,p.startI,p.endI,p.px||''].join('|'); }",
   "function tfTmKey(p){ return [p.sl,p.tp,p.rsiTh,p.trendFilter?1:0,p.startI,p.endI,p.px||'',p.eng||''].join('|'); }\r\n/* 새 백테스트 엔진 결과를 예전 엔진 결과 모양으로. 백테스트 화면에서 본 숫자와 터미널 숫자를 같게 한다 */\r\nfunction tfMkBt(p){ var r=mkRuleRun({asset:p.px,rsiTh:p.rsiTh,tp:p.tp,sl:p.sl,tf:!!p.trendFilter,startI:p.startI});\r\n  var tr=(r.trades||[]).map(function(t){ return {entry:t.entry,exit:t.exit,pnl:t.pnl,kind:t.kind}; }), w=tr.filter(function(t){ return t.pnl>0; });\r\n  return {ret:r.ret,mdd:r.mdd,n:tr.length,winRate:tr.length?w.length/tr.length*100:0,pf:r.pf,avgHold:r.avgHold,trades:tr,eq:r.eq,params:p,byYear:{},lossCount:tr.length-w.length,cagr:r.cagr,tradeVol:r.tradeVol}; }"],
  ["    var r=runBacktest(p);\r\n    var L2=mkWithPx(p.px,function(){ return tfBotLogEvents(p); });",
   "    var r=p.eng==='mk'?tfMkBt(p):runBacktest(p);\r\n    var L2=mkWithPx(p.px,function(){ return tfBotLogEvents(p); });"],
]);
ed(D+'bt-c.js',[["p.startI=R.eq[0].i; p.endI=R.eq[R.N-1].i; p.px=s.asset;","p.startI=R.eq[0].i; p.endI=R.eq[R.N-1].i; p.px=s.asset; p.eng='mk';"]]);
console.log('ok');
