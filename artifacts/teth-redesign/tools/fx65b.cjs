// fx65 의 나머지 (heredoc 백슬래시 손실로 중단된 뒤 Write 도구로 다시)
const fs=require('fs');
const rep=(f,a,b)=>{ let s=fs.readFileSync(f,'utf8'); if(!s.includes(a)) throw new Error(f+' miss '+a.slice(0,60)); s=s.split(a).join(b); fs.writeFileSync(f,s); };
const once=(f,mark,txt)=>{ const s=fs.readFileSync(f,'utf8'); if(!s.includes(mark)) fs.appendFileSync(f,txt); };
once('sk-detail.css','Codex 차트 s3',`
/* Codex 차트 s3: 초록은 목록 카드와 같은 #2EBD85, 지난 달력 칸 글자 대비, 모바일 달력 글자 12px */
.mk-detail .mkd-chart path[stroke="#2fb98a"]{stroke:#2ebd85}
.mk-detail .mkd-chart stop[stop-color="#2fb98a"]{stop-color:#2ebd85}
.mk-detail .cal-c.off{opacity:1!important;color:#6f6f6f!important}
@media (max-width:768px){ .mk-detail .cal-c,.mk-detail .cal-c.u,.mk-detail .cal-c.d{font-size:12px} .mk-detail .cal-c i{font-size:12px!important;letter-spacing:-.02em} }
`);
once('sk-bt.css','Codex 차트 s3',`
/* Codex 차트 s3: 초록 통일, 청산 표시는 범례처럼 회색, 모바일 월별 격자 */
#bt-root .bt-chart path[stroke="#2fb98a"]{stroke:#2ebd85}
#bt-root .bt-chart stop[stop-color="#2fb98a"]{stop-color:#2ebd85}
#bt-root .bt-chart g.bt-m.k-sell path{stroke:#cdcdcd!important;fill:#000!important}
#bt-root .bt-leg .a::before{background:linear-gradient(90deg,#2ebd85 50%,#f0566a 50%)!important}
.skb-mtm{display:none}
@media (max-width:768px){
  #bt-root .skb-mtw{display:none}
  .skb-mtm{display:block}
  .skb-mtm .y{display:flex;justify-content:space-between;align-items:baseline;margin:16px 0 8px;font-size:16px;color:#fff}
  .skb-mtm .y span{font-size:14px;color:#cdcdcd}
  .skb-mtm .g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
  .skb-mtm .c{padding:8px 6px;border-radius:12px;background:#171717;text-align:center}
  .skb-mtm .c em{display:block;font-style:normal;font-size:12px;color:#9a9a9a}
  .skb-mtm .c b{display:block;margin-top:2px;font-size:14px;font-weight:400;color:#ececec}
  .skb-mtm .c b.u,.skb-mtm .y span.u{color:#56c486}
  .skb-mtm .c b.d,.skb-mtm .y span.d{color:#ee766a}
  .skb-mtm .c small{display:block;font-size:11px;color:#9a9a9a}
  .skb-mtm .c.e b{color:#5d5d5d}
}
`);
// 로그인 전 "무료로 시작, 카드 등록 없음" 그라데이션 알약 삭제 (파운더 2026-10-01)
once('sk-main.css','g-free-row 삭제',`
/* g-free-row 삭제: 로그인 전 "무료로 시작, 카드 등록 없음" 알약 (파운더 2026-10-01) */
.g-free-row,.g-freecta{display:none!important}
`);
// 모바일 격자: 표와 같은 데이터로 연도마다 4열
const A="  w.classList.add('skb-hid'); w.insertAdjacentHTML('afterend',h);\n}";
const s=fs.readFileSync('sk-bt.js','utf8');
if(!s.includes('skb-mtm')){
  rep('sk-bt.js',A,
"  var mh='<div class=\"skb-mtm\">'+order.map(function(y){ var ys=yrSum(y), v=parseFloat(ys); return '<div class=\"y\">'+y+'<span class=\"num '+(v>0?'u':v<0?'d':'')+'\">누적 '+ys+'</span></div><div class=\"g\">'+[1,2,3,4,5,6,7,8,9,10,11,12].map(function(m){ var c=Y[y][m]; if(!c) return '<div class=\"c e\"><em>'+m+'월</em><b>-</b></div>'; var q=parseFloat(c.p); return '<div class=\"c\"><em>'+m+'월</em><b class=\"num '+(q>0?'u':q<0?'d':'')+'\">'+gEsc(c.p)+'</b>'+(c.part?'<small>일부</small>':'')+'</div>'; }).join('')+'</div>'; }).join('')+'</div>';\n  w.classList.add('skb-hid'); w.insertAdjacentHTML('afterend',h+mh);\n}");
  fs.appendFileSync('sk-bt.js',`
/* 잔고 차트: 색이 바뀌는 기준(시작 금액)을 선과 이름으로 표시 (Codex 차트 s3) */
(function(){ if(typeof btChartSvg!=='function') return; var c0=btChartSvg; btChartSvg=function(){ var h=c0.apply(this,arguments); try{ var G=btGeo(), y=G.Y(1); if(!isFinite(y)) return h;
  var g='<g class="skb-base"><line x1="'+G.pl+'" x2="'+(G.W-G.pr)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="rgba(255,255,255,.45)" stroke-width="1"/><text x="'+(G.W-G.pr)+'" y="'+(y-6).toFixed(1)+'" text-anchor="end" font-size="12" fill="#cdcdcd">시작 금액 $'+Math.round(BT.amt).toLocaleString()+'</text></g>';
  var k=h.indexOf('<g clip-path="url(#btrv)">'); if(k>0) h=h.slice(0,k)+g+h.slice(k); }catch(e){} return h; }; })();
`);
}
console.log('ok');
