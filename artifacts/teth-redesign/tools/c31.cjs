// 전략 찾기 검수 반영: H1, H2, H5, H6, U3, U4, 티커 검색
const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,70)); return s.replace(x,()=>y); };
let s=fs.readFileSync(D+'rd-ui.js','utf8');
// H1 성과 줄: 수익률과 낙폭은 고른 기간, 승률과 거래 수는 전체 기간
s=one(s,"/* 지표 넷은 그래프에서 고른 기간을 따른다 */\nfunction mkOvKpi(s,per){\n  var r=per?mkSlice(s,per):s.r, w=(typeof r.winRate==='number'&&(r.n||0)>=5)?Math.round(r.winRate)+'%':'-';\n  return mkKpi4('mk3-kpis num','',[MK_PER_L[per]+' 수익률','ret',mkPct0(r.ret),mkSign(r.ret)],['최대 낙폭','mdd',r.mdd.toFixed(1)+'%'],['승률','win',w],['거래 수','n',Number(r.n||0).toLocaleString()+'회']);\n}",
"/* 수익률과 최대 낙폭은 그래프에서 고른 기간을 따르고, 승률과 거래 수는 늘 전체 기간이다(짧은 기간의 거래 한두 건이 성과처럼 읽히지 않게) */\nfunction mkOvKpi(s,per){\n  var r=per?mkSlice(s,per):s.r, a=s.r||r, w=(typeof a.winRate==='number'&&(a.n||0)>=5)?Math.round(a.winRate)+'%':'-';\n  return mkKpi4('mk3-kpis num','',[MK_PER_L[per]+' 수익률','ret',mkPct0(r.ret),mkSign(r.ret)],[MK_PER_L[per]+' 최대 낙폭','mdd',r.mdd.toFixed(1)+'%'],['전체 기간 승률','win',w],['전체 기간 거래 수','n',Number(a.n||0).toLocaleString()+'회']);\n}");
s=one(s,"win:'끝난 거래 중 이익으로 끝난 거래의 비율이에요. 고른 기간에 끝난 거래가 5번 미만이면 - 로 표시해요.',\n  n:'사고팔기를 끝낸 횟수예요.',",
"win:'전체 기간에 끝난 거래 중 이익으로 끝난 거래의 비율이에요. 끝난 거래가 5번 미만이면 - 로 표시해요.',\n  n:'전체 기간에 사고팔기를 끝낸 횟수예요.',");
s=one(s,"mdd:'가장 높았던 때에서 가장 많이 내려간 폭이에요.","mdd:'고른 기간 안에서, 가장 높았던 때에서 가장 많이 내려간 폭이에요.");
// 검색에 티커
s=one(s,"MK_KIND[s.kind]||'',mkUni(s).list.join(' ')].join(' ')","MK_KIND[s.kind]||'',mkUni(s).list.join(' '),mkUni(s).list.map(mkTk).join(' '),mkTk(s.asset||'')].join(' ')");
// H2 승률 정렬: 거래가 20건 미만인 전략은 방향과 반복에 관계없이 맨 뒤
s=one(s,"  if(plain){ var base=rows.filter(function(s){ return !s.me; }), all=rows.slice(); for(var rp=1;rp<MAXP&&base.length;rp++) all=all.concat(base); rows=all; }\n",
"  if(plain){ var base=rows.filter(function(s){ return !s.me; }), all=rows.slice(); for(var rp=1;rp<MAXP&&base.length;rp++) all=all.concat(base); rows=all; }\n  if(mkSortKey(t)==='win'){ var few=function(s){ return ((s.r&&s.r.n)||0)<MK_WIN_MIN; }; rows=rows.filter(function(s){ return !few(s); }).concat(rows.filter(few)); }\n");
s=one(s,"function tfSS3GridHtml(){","var MK_WIN_MIN=20; /* 승률 정렬에서 앞에 설 수 있는 최소 거래 수 */\n/* 추천순은 방향을 바꾸지 않는다 */\nfunction tfSS3SortPick(v){\n  var t=tfSSState();\n  if(v==='pick'){ t.ss.sort='pick'; t.ss.dir='desc'; }\n  else if(t.ss.sort===v){ t.ss.dir=t.ss.dir==='asc'?'desc':'asc'; }\n  else { t.ss.sort=v; t.ss.dir='desc'; }\n  tfSave(); tfShareHub('find');\n}\nfunction tfSS3GridHtml(){");
// U4 추천순 칩
s=one(s,"[['ret','30일 수익률'],['fw','따라가는 사람'],['win','거래 승률']].map(function(o){ var on=sort===o[0]; return '<button type=\"button\" class=\"mk-chip'+(on?' on':'')+'\" aria-pressed=\"'+on+'\" onclick=\"tfSS3SortPick(\\''+o[0]+'\\')\">'+o[1]+(on?(t.ss.dir==='asc'?' ↑':' ↓'):'')+'</button>'; })",
"[['pick','추천순'],['ret','30일 수익률'],['fw','따라가는 사람'],['win','거래 승률']].map(function(o){ var on=sort===o[0]; return '<button type=\"button\" class=\"mk-chip'+(on?' on':'')+'\" aria-pressed=\"'+on+'\" onclick=\"tfSS3SortPick(\\''+o[0]+'\\')\">'+o[1]+(on&&o[0]!=='pick'?(t.ss.dir==='asc'?' ↑':' ↓'):'')+'</button>'; })");
// U3 지금 줄의 끝 낱말이 혼자 넘어가지 않게
s=one(s,"<div class=\"mk3-now\"><small>지금</small><span>'+gEsc(mkNowLine(s))+'</span></div>'","<div class=\"mk3-now\"><small>지금</small><span>'+gEsc(mkNowLine(s)).replace(/ (\\S+) 중$/,' $1&nbsp;중')+'</span></div>'");
fs.writeFileSync(D+'rd-ui.js',s);
fs.appendFileSync(D+'rd.css',`
/* 값이 변하지 않은 기간의 그래프 안내 */
.mkd-flat{position:absolute;left:54px;right:6px;top:30%;text-align:center;font-size:13px;color:var(--gt3);pointer-events:none}
@media (max-width:640px){ .mkd-flat{left:46px;font-size:12.5px} }
`);
// H6 달력 머리: 달의 승률을 빼고, 복리로 계산한 값에 맞는 이름
let a=fs.readFileSync(D+'apply2.cjs','utf8'); if(a.includes('// 5x.')) throw new Error('dup'); const m=a.indexOf('// 6. rd'); if(m<0) throw new Error('6');
a=a.slice(0,m)+"// 5x. 달력 머리: 달의 승률은 보이지 않는다(승률은 성과 줄의 전체 기간 값 하나만). 이름은 그 달 수익률\nrep(\"'건'+(trM.length?', 승률 '+Math.round(wM/trM.length*100)+'%':'')+'</span></div>'\",\"'건'+'</span></div>' /* 달의 승률 없음 */\",true);\nrep(\"<span class=\\\"mt2\\\">월 합산 '+(mtot>=0\",\"<span class=\\\"mt2\\\">'+(mo+1)+'월 수익률 '+(mtot>=0\",true);\n"+a.slice(m);
fs.writeFileSync(D+'apply2.cjs',a);
// H5 값이 모두 같은 기간의 그래프 (index.html 본문, 한 번만)
let t=fs.readFileSync(F,'utf8');
if(!t.includes('mkd-flat')){
  t=one(t,"function mkdTicks(a,b,n){ var span=(b-a)||1,","function mkdTicks(a,b,n){ if(!(b>a)){ var pd=Math.abs(a)>=100?Math.max(10,Math.round(Math.abs(a)*0.01)):1; return [a-pd,a,a+pd]; } /* 최저와 최고가 같으면 위아래로 여유를 둔다 */ var span=(b-a)||1,");
  t=one(t,"  var ys=P.map(function(p){return p.y;}), T=mkdTicks(","  var dsrc=MKD.per?(MKD.eq||[]).slice(-MKD.per-1):(MKD.eq||[]), flat=dsrc.length>1&&dsrc.every(function(p){ return Math.abs(p.v-dsrc[0].v)<1e-12; }); /* 하루 단위 값으로 본다 */\n  var ys=P.map(function(p){return p.y;}), flatBase=flat&&Math.abs(ys[0]-base)<1e-9, T=mkdTicks(".split('\n').join('\r\n'));
  t=one(t,"Z', G='#2fb98a', R='#f0566a';","Z', G=flatBase?'#8b9096':'#2fb98a', R=flatBase?'#8b9096':'#f0566a';");
  t=one(t,"var dec=Math.abs(mx-mn)<4?2:Math.abs(mx-mn)<20?1:0,","var dec=flat?0:Math.abs(mx-mn)<4?2:Math.abs(mx-mn)<20?1:0,");
  t=one(t,"    +'<div class=\"mkd-ht\" id=\"mkd-ht\" role=\"status\"></div>';","    +'<div class=\"mkd-ht\" id=\"mkd-ht\" role=\"status\"></div>'+(flat?'<div class=\"mkd-flat\">이 기간에는 '+({ret:'수익률',pnl:'수익금',bal:'잔고'}[MKD.tab])+' 변화가 없어요</div>':'');");
  fs.writeFileSync(F,t);
}
console.log('ok');
