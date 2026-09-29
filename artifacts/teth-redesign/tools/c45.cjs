// Codex 최종 확인의 F01, F02, F03 과 남은 작은 것들
const fs=require('fs'), D=__dirname+'/';
const rep=(s,x,y,n)=>{ const c=s.split(x).length-1; if(c!==(n||1)) throw new Error('x'+c+': '+x.slice(0,70)); return s.split(x).join(y); };
// ── F02: 종목을 고른 이유는 고른 날의 값이다. 고른 날을 밝히고, 판단한 날의 값은 따로 적는다
let a=fs.readFileSync(D+'bt-a.js','utf8');
a=rep(a,"  var top1=function(e){","  var md=function(i){ var d=idxToDate(i); return String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0'); };\n  var momAt=function(k,i){ var P=px[list.indexOf(k)]; return P&&i-look>=0?(P[i]/P[i-look]-1)*100:0; };\n  var pkTxt=function(p){ return 'AI가 '+md(p.i)+'에 고른 종목, 그날 '+look+'일 상승률 '+mkPct0(p.mom,1); };\n  var pkFacts=function(p,e){ return [['AI가 고른 날',btYMD(p.i)+', 오름세 종목 중 '+look+'일 상승률 1위 '+mkPct0(p.mom,1)],['이날의 '+look+'일 상승률',mkPct0(momAt(e.a,e.i),1)]]; };\n  var top1=function(e){");
a=rep(a,"var pk2=lastPick[e.a], pkT=pk2?('AI가 고른 종목, '+look+'일 상승률 1위 '+mkPct0(pk2.mom,0)):'떨어진 뒤 다시 올랐어요';","var pk2=lastPick[e.a], pkT=pk2?pkTxt(pk2):'떨어진 뒤 다시 올랐어요';");
a=rep(a,"pk3?('AI가 고른 종목, '+look+'일 상승률 1위 '+mkPct0(pk3.mom,0)):'떨어진 뒤 다시 올랐어요'","pk3?pkTxt(pk3):'떨어진 뒤 다시 올랐어요'");
a=rep(a,"(pk2?[['종목을 고른 이유',n8+'종목 중 최근 '+look+'일 상승률 1위, '+mkPct0(pk2.mom,0)]]:[])","(pk2?pkFacts(pk2,e):[])");
a=rep(a,"(pk3?[['종목을 고른 이유',n8+'종목 중 최근 '+look+'일 상승률 1위, '+mkPct0(pk3.mom,0)]]:[])","(pk3?pkFacts(pk3,e):[])");
a=rep(a,"cmp:look+'일 '+mkPct0(e.mom,0)+', 가장 강함',why:'최근 '+look+'일 동안 '+mkPct0(e.mom,0)+' 올라 가장 강했어요'","cmp:'오름세 종목 중 '+look+'일 상승률 1위 '+mkPct0(e.mom,1),why:'오름세 종목 중 최근 '+look+'일 상승률이 '+mkPct0(e.mom,1)+'로 가장 높았어요'");
// AI 판단 전략의 순위는 상승률만이 아니라 가격 흔들림까지 본 점수의 순위다
a=rep(a,"push({k:'buy',tag:'매수',title:tk,cmp:look+'일 '+mkPct0(e.mom,0)+', '+(e.rank||1)+'위',why:'최근 '+look+'일 동안 '+mkPct0(e.mom,0)+' 올라 '+(e.rank||1)+'번째로 강했어요',","push({k:'buy',tag:'매수',title:tk,cmp:'흔들림까지 본 순위 '+(e.rank||1)+'위, '+look+'일 '+mkPct0(e.mom,1),why:'가격 흔들림까지 고려한 순위에서 '+(e.rank||1)+'번째였어요. 최근 '+look+'일 상승률은 '+mkPct0(e.mom,1)+'예요',");
a=rep(a,"['최근 '+look+'일 상승률',mkPct0(e.mom,1)+', '+(e.rank||1)+'위'],","['순위',(e.rank||1)+'위, 상승률을 가격 흔들림으로 나눈 점수 기준'],['최근 '+look+'일 상승률',mkPct0(e.mom,1)],");
a=rep(a,"  var top1=function(e){ var t=(e.top||[])[0]; return t?('가장 강한 종목 '+mkTk(t.k)+' '+mkPct0(t.mom,0)):''; };","  var top1=function(e){ var t=(e.top||[])[0]; return t?('점수 1위 '+mkTk(t.k)+', '+look+'일 '+mkPct0(t.mom,1)):''; };");
// R09: AI 판단 전략의 전체 활동에는 유지도 들어간다
a=rep(a,"return f==='all'?(d.k!=='hold'&&(d.k!=='pick'||s.kind==='mix')):d.k===f;","return f==='all'?(d.k!=='pick'||s.kind==='mix'):d.k===f;");
// ── F03: 패널은 멈춰서 보여 준 판단이 아니라, 그날까지 공개된 가장 최근 판단을 담는다
let b=fs.readFileSync(D+'bt-b.js','utf8');
b=rep(b,"      else { btPulse(null); btPanelRest(); var h=btHolding(R.eq[dj].i);","      else { btPulse(null); var ls=btLatest(j); if(ls&&ls!==BT.lastSt) btPanelFill(ls,2); btPanelRest(); var h=btHolding(R.eq[dj].i);");
b=rep(b,"function btLastTxt(){","/* 그날까지 공개된 판단 중 가장 최근 것(유지는 AI 판단 전략에서만 판단으로 센다) */\nfunction btLatest(j){ var S=BT.R.stops, o=null; for(var i=0;i<S.length;i++){ if(S[i].j>j) break; o=S[i]; } return o; }\nfunction btLastTxt(){");
b=rep(b,"T.push(buys.length>1?[buys.map(function(x){ return x.tk; }).join(', ')+' 매수',d.p2[1]]:d.p2);","T.push(buys.length>1?[buys.map(function(x){ return x.tk; }).join(', ')+' 매수',buys[0].p2[1]]:(buys[0]||d).p2);");
b=rep(b,"var C=btCols(), n=C.length, last=n-1, ds=st.ds, d=ds[0], buys=ds.filter(function(x){ return x.k==='buy'; });","var C=btCols(), n=C.length, last=n-1, ds=st.ds, buys=ds.filter(function(x){ return x.k==='buy'; }), d=buys[0]||ds[0];");
fs.writeFileSync(D+'bt-a.js',a);
fs.writeFileSync(D+'bt-b.js',b);
console.log('ab ok');
