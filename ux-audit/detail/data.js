/* 상세 시안 공용 데이터: 날짜별 기준가(시작 1.000), 440일. 난수 없이 결정적으로 생성 */
(function(){
  var start=new Date(2025,6,14), nav=[], v=1;
  for(var i=0;i<440;i++){
    var d=new Date(start.getTime()+i*86400000);
    var drift=0.00055, wave=Math.sin(i*0.21)*0.0042+Math.sin(i*0.047+1.3)*0.0026+Math.sin(i*0.9)*0.0012;
    var shock=(i>395&&i<402)?-0.012:(i>412&&i<418)?0.011:(i>250&&i<258)?-0.007:0;
    v=v*(1+drift+wave*0.55+shock);
    nav.push({d:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'), v:Math.round(v*10000)/10000});
  }
  nav[0].v=1;
  window.DETAIL_NAV=nav;
  /* 운용금 변경 기록: 수익률에는 영향 없음 */
  window.DETAIL_EVENTS=[{d:nav[300].d, type:'deposit', amount:4000}];
  window.DETAIL_META={title:'비트코인 급락하면 줍고 8% 먹고 나온다', ex:'Binance', exLogo:'app-binance', ai:'RSI AI', aiAvatar:'rsi', since:'2025.07.14', min:'200 USDT', mdd:'-9.0%', win:'67%', trades:'12회'};
})();
