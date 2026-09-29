// Round 5 레드팀 반영
const fs=require('fs'); const D=__dirname+'/';
function edit(file,pairs){ let s=fs.readFileSync(D+file,'utf8'); for(const [a,b] of pairs){ const n=s.split(a).length-1; if(n!==1) throw new Error(file+' anchor x'+n+': '+a.slice(0,70)); s=s.replace(a,()=>b); } fs.writeFileSync(D+file,s); console.log(file,'ok',pairs.length); }
edit('agent-core.js',[
 // R1: 고른 종목보다 순위가 높은데 사지 않은 종목과 그 이유, 비중을 줄였는지를 사건에 남긴다
 ["      else { var total=L.value(px); while(L.pos.length<top&&cand.length){ var r2=cand.shift(), w=Math.max(0.1,Math.min(1/top,(1/top)*c.volT/r2.vol)), p2=L.buy(r2.k,r2.px,w*total,i,{w:w}); if(!p2) break; ev.push({i:i,t:'enter',a:r2.k,tid:p2.id,px:r2.px,units:p2.units,cost:p2.cost,fee:p2.fee,mom:r2.mom*100,w:p2.cost/total,up:S.up,of:S.of,top:top3}); } }",
  "      else { var total=L.value(px); while(L.pos.length<top&&cand.length){ var r2=cand.shift(), w=Math.max(0.1,Math.min(1/top,(1/top)*c.volT/r2.vol)), skip=[], rk=rank[r2.k];\n          for(var sq=0;sq<rk;sq++){ var sr=S.rows[sq]; skip.push({k:sr.k,why:L.pos.some(function(p){ return p.k===sr.k; })?'held':!sr.above?'below':'weak'}); }\n          var p2=L.buy(r2.k,r2.px,w*total,i,{w:w}); if(!p2) break;\n          ev.push({i:i,t:'enter',a:r2.k,tid:p2.id,px:r2.px,units:p2.units,cost:p2.cost,fee:p2.fee,mom:r2.mom*100,w:p2.cost/total,rank:rk+1,skip:skip,cut:w<1/top-1e-9,up:S.up,of:S.of,top:top3}); } }"]
]);
edit('rd-ui.js',[
 ["  if(e.t==='enter') return {k:'buy',obs:e.of+'종 중 '+e.up+'종이 오름세. 가장 강한 건 '+mkTopTxt(e.top),dec:mkJ(e.a,'을','를')+' 새로 골랐어요',act:'자산의 '+Math.round(e.w*100)+'%로 매수, 체결가 '+mkPxFmt(e.px)};",
  "  if(e.t==='enter'){ var g={held:[],below:[],weak:[]}, ps=[]; (e.skip||[]).forEach(function(x){ g[x.why].push(x.k); });\n    if(g.below.length) ps.push(mkJ(g.below.join(', '),'은','는')+' 60일 평균 아래라 제외');\n    if(g.held.length) ps.push(mkJ(g.held.join(', '),'은','는')+' 이미 보유');\n    if(g.weak.length) ps.push(mkJ(g.weak.join(', '),'은','는')+' 기준 미달');\n    ps.push((e.rank||1)+'위 '+e.a+' '+mkPct0(e.mom,0)+', 기준을 넘음');\n    return {k:'buy',obs:e.of+'종 중 '+e.up+'종이 오름세. '+ps.join('. '),dec:mkJ(e.a,'을','를')+' 새로 골랐어요',act:'자산의 '+Math.round(e.w*100)+'%로 매수'+(e.cut?'(흔들림이 커서 비중을 줄임)':'')+', 체결가 '+mkPxFmt(e.px)}; }"],
 // A: 상단 문장
 ["<p class=\"mkh-sub\">어떤 방식으로 판단하는 AI에게 거래를 맡길지 골라요.</p>","<p class=\"mkh-sub\">어떤 방식으로 판단해 거래할지 골라요.</p>"],
 // B: 직접 탐색의 하는 일에 실제 비교 방식
 ["['AI가 정하는 것','무엇을 살지, 얼마나 살지, 언제 바꿀지. 한 번에 최대 '+c.top+'종목']","['AI가 정하는 것','무엇을 살지, 얼마나 살지, 언제 바꿀지. 오름폭을 흔들림으로 나눠 순위를 매기고, 한 번에 최대 '+c.top+'종목']"],
 // N1: 저장된 시작 봉을 날짜로 다시 잇는다
 ["    if(t.cp&&t.cp.copies) t.cp.copies.forEach(function(c){ var n=canon(c.nick); if(n!==c.nick){ c.nick0=c.nick; c.nick=n; ch=true; } });",
  "    if(t.cp&&t.cp.copies) t.cp.copies.forEach(function(c){ var n=canon(c.nick); if(n!==c.nick){ c.nick0=c.nick; c.nick=n; ch=true; }\n      /* 데이터 세대가 바뀌면 저장된 봉 번호를 같은 날짜의 새 봉 번호로 옮긴다 */\n      var g=c.gen, now={asof:MK_ASOF.slice(),len:PRICE0.length};\n      if(!g){ c.gen=now; ch=true; }\n      else if(g.len!==now.len||g.asof.join('-')!==now.asof.join('-')){ var d0=new Date(g.asof[0],g.asof[1]-1,g.asof[2]), d1=new Date(now.asof[0],now.asof[1]-1,now.asof[2]), sh=(now.len-g.len)-Math.round((d1-d0)/86400000); ['simStartI','flatI'].forEach(function(k){ if(c[k]!=null) c[k]=Math.max(0,Math.min(now.len-1,c[k]+sh)); }); c.gen=now; ch=true; } });"]
]);
fs.appendFileSync(D+'rd-ui.js',`
/* 화면 폭이 좁은 화면 기준(640px)을 넘나들면 성과 차트를 다시 그린다 */
var MK_MOB=window.innerWidth<=640;
window.addEventListener('resize',function(){ var m=window.innerWidth<=640; if(m===MK_MOB) return; MK_MOB=m; var g=document.getElementById('mkd-chart'); if(g&&typeof mkdChartHtml==='function'){ g.classList.remove('hov'); g.innerHTML=mkdChartHtml(); } });
/* 따라가기 시트의 전략 요약: 수익이 아니라 판단 방식과 주기 */
function mkFollowLine(s){ var c=s.cfg||{}; if(!s.cfg) return (MK_KIND[s.kind]||'조건 실행')+', '+mkScope(s); return MK_KIND[s.kind]+', '+mkScope(s)+', '+(s.kind==='agent'?(c.every===1?'매일':c.every+'일마다')+' 종목을 다시 비교':s.kind==='mix'?c.every+'일마다 종목을 고르고 매일 조건 확인':'매일 조건 확인'); }
`);
fs.appendFileSync(D+'rd.css',`
/* Round 5 */
#g-root .mk-dtabs{overflow-y:hidden}
.mkh-s3{background:#101417}
@media (max-width:640px){
  .mkh-slide.mkh-k b{font-size:21px;line-height:1.3;max-width:none;margin-top:4px}
  .mkh-slide.mkh-k{padding:0 20px}
  .mkh-slide.mkh-k span{display:none}
  .mkh-slide.mkh-k .mkh-cta{margin-top:8px}
}
`);
