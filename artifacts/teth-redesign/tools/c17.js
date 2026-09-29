
/* ── 기간: 최근 7일, 최근 30일, 최근 1년, 전체 ──
   7일과 30일은 전체 기록에서 그 구간을 잘라 계산한다(그 시점에 들고 있던 종목을 그대로 둔 채). 1년은 그 구간으로 다시 계산한다 */
MK_PD_OK={all:1,'1y':1,'30d':1,'7d':1,'2y':1};
function mkPdLabel(pd){ return {all:'전체 기간','2y':'최근 2년','1y':'최근 1년','30d':'최근 30일','7d':'최근 7일'}[pd]||'전체 기간'; }
function mkPdChips(ne,pd,tab){
  return '<div class="mk-chips mk-pdrow" aria-label="기간"><span class="lb">기간</span>'+[['7d','최근 7일'],['30d','최근 30일'],['1y','최근 1년'],['all','전체']].map(function(o){
    return '<button type="button" class="mk-chip'+(pd===o[0]?' on':'')+'" aria-pressed="'+(pd===o[0])+'" onclick="tfSS3Go(\''+ne+'\',\''+o[0]+'\',\''+tab+'\')">'+o[1]+'</button>'; }).join('')+'</div>';
}
function mkSlice(s,days){
  var r=s.r, end=PRICE0.length-1, d=mkDaily(r.eq||[],end), src=d.slice(-(days+1)); if(src.length<2) return r;
  var b=src[0].v, eq=src.map(function(x){ return {i:x.i,v:x.v/b}; }), pk=eq[0].v, mdd=0;
  eq.forEach(function(x){ if(x.v>pk) pk=x.v; var dd=(x.v/pk-1)*100; if(dd<mdd) mdd=dd; });
  var from=src[0].i, tr=(r.trades||[]).filter(function(t){ return t.exit>from; }), win=tr.filter(function(t){ return t.pnl>0; }).length, o={};
  for(var k in r) o[k]=r[k];
  o.eq=eq; o.ret=(eq[eq.length-1].v-1)*100; o.mdd=mdd; o.trades=tr; o.n=tr.length; o.winRate=tr.length?win/tr.length*100:0; o.params={startI:from,endI:end}; o.mddStartI=null; o.byYear={};
  return o;
}
function tfSS3PdCalc(s,pd){
  if(pd==='all'||(!s.p&&!s.cfg)) return s.r;
  var key=mkSig(s)+'|'+pd, end=PRICE0.length-1;
  if(s.cfg&&(pd==='7d'||pd==='30d')){ if(!MK_PDC[key]) MK_PDC[key]=mkSlice(s,pd==='7d'?7:30); return MK_PDC[key]; }
  var days=pd==='7d'?7:pd==='30d'?30:pd==='1y'?365:730;
  if(!MK_PDC[key]) MK_PDC[key]=s.cfg?mkRunCfg(s.cfg,Math.max(s.cfg.startI||61,end-days)):runBacktest({sl:s.p.sl,tp:s.p.tp,rsiTh:s.p.rsiTh,trendFilter:s.p.trendFilter,startI:Math.max(61,s.p.startI||61,s.p.endI-days),endI:s.p.endI,px:s.p.px,fill:s.p.fill});
  return MK_PDC[key];
}
/* 지표 이름에 붙는 설명 */
var MK_TIP={ret:'고른 기간 동안 이 전략이 거둔 수익의 비율이에요. 수수료를 뺀 값이에요.',
  ret30:'최근 30일 동안 이 전략이 거둔 수익의 비율이에요. 수수료를 뺀 값이에요.',
  mdd:'가장 높았던 때에서 가장 많이 내려간 폭이에요. 값이 클수록 중간에 크게 흔들렸다는 뜻이에요.',
  win:'끝난 거래 중 이익으로 끝난 거래의 비율이에요. 거래가 5번 미만이면 표시하지 않아요.',
  n:'사고팔기를 끝낸 횟수예요.',
  ex:'이 전략의 주문이 실제로 나가는 거래소예요. 따라가려면 이 거래소 계정을 연결해야 해요.'};
function mkKpi4(cls,item,a,b,c,d){ return '<div class="'+cls+'">'+[a,b,c,d].map(function(x){ return '<div'+(item?' class="'+item+'"':'')+'><small>'+mkdTerm(x[0],MK_TIP[x[1]])+'</small><b class="num'+(x[3]||'')+'">'+x[2]+'</b></div>'; }).join('')+'</div>'; }
/* 성과 탭: 기간, 지표 넷, 월별 달력 */
function mkPerfTab(s,r,pd,ne){
  var wl=(r.n||0)>=5?Math.round(r.winRate)+'%':'-';
  return mkPdChips(ne,pd,'perf')
    +mkKpi4('mk-kpis four','mk-kpi',['수익률','ret',mkPct(r.ret),r.ret>=0?' mk-up':' mk-dn'],['최대 낙폭','mdd',r.mdd.toFixed(1)+'%'],['승률','win',wl],['거래 수','n',r.n+'회'])
    +'<section class="mk-sec"><div id="ss3-cal-host">'+tfSS3CalHtml(s.r,0)+'</div></section>';
}
function mkTradesTab(s,r,pd,ne){ return mkPdChips(ne,pd,'trades')+'<div class="mk-sec-hd"><b>체결 이력</b><span class="mt2">'+mkPdLabel(pd)+', '+r.n+'건</span></div>'+mkTradesTable(s,r); }
function mkInfoTab(s,r,ne){
  var a=(s.r.params&&s.r.params.startI!=null)?s.r.params.startI:61, b=PRICE0.length-1;
  var row=function(k,v){ return '<div class="mk-info-r"><small>'+k+'</small><span>'+v+'</span></div>'; };
  return '<div class="mk-info">'
    +row('판단 방식',MK_KIND[s.kind]||'차트 규칙')
    +row('거래 대상',gEsc(s.cfg&&s.cfg.uni?mkUni(s).list.join(', '):(CPP_PAIR[s.asset]||s.asset)))
    +row('실행 거래소',mkEx(s)[1])
    +row('기록 기간',mkDate(a)+' ~ '+mkDate(b)+' ('+Math.max(1,Math.round((b-a)/30.44))+'개월)')
    +row('등록',s.me?gEsc(s.nick)+' (나)':(s.by?'@'+gEsc(s.by):'TETH'))
    +'</div>';
}
/* 개요 그래프의 조작 줄: 수익률, 수익금, 잔고. 기간에 최근 7일 */
function mkdCtlHtml(){
  var tip='이 전략이 매매로 번 비율이에요. 돈을 더 넣거나 빼도 수익률은 그대로예요. 수수료를 뺀 실제 수익이에요. 이 전략의 거래만 계산해요.';
  return '<div class="mkd-pills" role="group" aria-label="그래프 종류">'+[['ret','수익률',tip],['pnl','수익금','1,000 USDT로 시작했다면 지금까지 벌거나 잃은 금액이에요. 수수료를 뺀 금액이에요.'],['bal','잔고','1,000 USDT로 시작했다면 지금 계좌에 있는 금액이에요. 처음 넣은 1,000 USDT에 수익금을 더한 값이에요.']].map(function(t){ return '<button type="button" class="mkd-pill" aria-pressed="'+(MKD.tab===t[0])+'" onclick="mkdSet(\'tab\',\''+t[0]+'\')">'+t[1]+(t[2]?'<i aria-hidden="true">i</i><span class="mkd-tip" role="tooltip">'+t[2]+'</span>':'')+'</button>'; }).join('')+'</div>'
    +'<div class="mkd-right"><div class="mkd-seg" role="group" aria-label="간격">'+[['day','일별'],['month','월별']].map(function(g){ return '<button type="button" aria-pressed="'+(MKD.gran===g[0])+'" onclick="mkdSet(\'gran\',\''+g[0]+'\')">'+g[1]+'</button>'; }).join('')+'</div>'
    +'<select class="mkd-per" aria-label="기간 선택" onchange="mkdSet(\'per\',+this.value)">'+[[7,'최근 7일'],[30,'최근 30일'],[90,'최근 3개월'],[365,'최근 1년'],[0,'전체']].map(function(o){ return '<option value="'+o[0]+'"'+(MKD.per===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')+'</select></div>';
}
