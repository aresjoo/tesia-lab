/* 스파크라인 시안 공용 데이터: 시작값 1 기준 자산 곡선 3케이스 (각 60포인트) */
(function(){
  function series(f){ var a=[]; for(var i=0;i<60;i++) a.push({i:i,v:f(i/59,i)}); return a; }
  function n(i,s){ return Math.sin(i*1.7+s)*0.012+Math.sin(i*0.53+s*2)*0.018; }
  window.SPARK_CASES=[
    {key:'loss', label:'손해', ret:'-18.4%', eq:series(function(t,i){ return t<0.42?1: 1-0.30*Math.min(1,(t-0.42)/0.10)+0.22*Math.exp(-Math.pow((t-0.78)/0.05,2))+0.10*Math.max(0,(t-0.82)/0.18)+n(i,1); })},
    {key:'profit', label:'수익', ret:'+35.7%', eq:series(function(t,i){ return 1+0.36*Math.pow(t,1.4)+n(i,2)*0.9; })},
    {key:'mixed', label:'손해와 수익', ret:'+9.6%', eq:series(function(t,i){ return 1-0.07*Math.sin(t*Math.PI*1.6)*(t<0.62?1:0)+(t>0.62?0.16*Math.min(1,(t-0.62)/0.12)-0.05*Math.max(0,(t-0.74)/0.26):0)+n(i,3)*0.7; })}
  ];
  window.SPARK_CASES.forEach(function(c){ c.eq[0].v=1; });
})();
