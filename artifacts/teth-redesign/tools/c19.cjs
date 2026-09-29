// Codex 검수(d2-codex.md)의 사실 지적 반영: 순위 기준, 20일 구간, 가격 단위, 비용 차감, 일수 표현, 해가 다른 기록의 연도
const fs=require('fs'), D=__dirname+'/';
const all=(s,x,y,n)=>{ const c=s.split(x).length-1; if(c!==n) throw new Error('x'+c+' (want '+n+'): '+x.slice(0,60)); return s.split(x).join(y); };
for(const f of ['chat.js','rd-ui.js']){
  let s=fs.readFileSync(D+f,'utf8');
  // F2 최근 20일은 그날을 포함한 20개
  s=all(s,"for(var k=Math.max(0,i-20);k<=i;k++)","for(var k=Math.max(0,i-19);k<=i;k++)",1);
  // F3 가격 단위
  s=all(s,"function mkList(a){ return a.join(', '); }","function mkList(a){ return a.join(', '); }\nfunction mkPxU(a,v){ return mkPxFmt(v)+(MK_CRYPTO[a]?' USDT':(a==='나스닥'||a==='S&P 500')?'포인트':' USD'); }",1);
  s=all(s,"체결가 '+mkPxFmt(e.px)+'에","체결가 '+mkPxU(e.a,e.px)+'에",4);
  s=all(s,"mkMD(st.open.entry)+'에 '+mkPxFmt(st.open.ep)+'에 '","mkMD(st.open.entry)+'에 '+mkPxU(st.open.k,st.open.ep)+'에 '",1);
  // F3 비용 차감
  s=all(s,"'실현 손익은 '+mkPct0(e.pnl)+'다.'","'실현 손익은 비용 차감 후 '+mkPct0(e.pnl)+'다.'",2);
  // F4 일수 표현
  s=all(s,"cap='둘 다 아니면 보유 25일째에 청산한다.'","cap='둘 다 아니면 매수 후 25일이 지난 날 청산한다.'",1);
  s=all(s,"', 보유 '+st.open.held+'일째다.'","', 매수 후 '+st.open.held+'일이 지났다.'",1);
  // F1 순위 기준
  s=all(s,"' 상승률 상위는 '+mkTopTxt(e.top)+'였다.'","' 순위 상위는 '+mkTopTxt(e.top)+'였다(괄호 없이 적은 값은 상승률, 순위는 상승률을 변동성으로 나눠 매긴다).'",1);
  s=all(s,"'현재 상승률 상위는 '+mkTopTxt(e.top)+'다.'","'순위 상위는 '+mkTopTxt(e.top)+'다. 순위는 상승률을 변동성으로 나눠 매기므로 상승률 순서와 다를 수 있다.'",1);
  // F5 해가 다른 기록에는 연도
  s=all(s,"  return p(d.getMonth()+1)+'/'+p(d.getDate())+' '","  return (d.getFullYear()!==MK_ASOF[0]?d.getFullYear()+'/':'')+p(d.getMonth()+1)+'/'+p(d.getDate())+' '",1);
  s=all(s,"mkTS(s,m.from,null,3).slice(0,5)+'부터'","mkTS(s,m.from,null,3).replace(/ .*$/,'')+'부터'",f==='rd-ui.js'?1:0);
  fs.writeFileSync(D+f,s);
}
// 낱말 설명: 본문에서는 매수, 매도에 밑줄을 긋지 않는다(태그에서만)
for(const f of ['chat-ui.js','rd-ui.js']){
  let s=fs.readFileSync(D+f,'utf8');
  s=all(s,"function mkGloss(html){\n  var hold=[], out=html;\n  MK_GLOSS_K.forEach(function(k){ var i=out.indexOf(k);","function mkGloss(html,body){\n  var hold=[], out=html;\n  MK_GLOSS_K.forEach(function(k){ if(body&&(k==='매수'||k==='매도')) return; var i=out.indexOf(k);",1);
  s=all(s,"var g=mkGloss(gEsc(head)+'\\u0003'+gEsc(rest)).split('\\u0003');","var g=mkGloss(gEsc(head)+'\\u0003'+gEsc(rest),true).split('\\u0003');",1);
  if(f==='chat-ui.js') s=all(s,"mkTS(s,m.from,null,3).slice(0,5)+'부터'","mkTS(s,m.from,null,3).replace(/ .*$/,'')+'부터'",1);
  fs.writeFileSync(D+f,s);
}
console.log('ok');
