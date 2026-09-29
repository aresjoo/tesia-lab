// 16-fixes 묶음 2: R02, R03, R04 연결. 재생 시계 멈춤, 대표 판단, 사건 보존, 묶음 순서, 스타일
const fs=require('fs'), D=__dirname+'/';
const ed=(file,pairs)=>{ let s=fs.readFileSync(file,'utf8'); for(const [x,y,n] of pairs){ const c=s.split(x).length-1; if(c!==(n||1)) throw new Error(file.slice(-14)+' x'+c+': '+x.slice(0,90)); s=s.split(x).join(y); } fs.writeFileSync(file,s); };
ed(D+'bt-a.js',[
  ["  var push=function(d,e){ d.i=e.i;","  var push=function(d,e){ d.e=e; d.i=e.i;"],
  // 대표 판단: 처음 산 날과 처음 보류한 날, 그리고 가장 크게 잃은 거래와 가장 크게 번 거래의 진입
  ["  var ai=btAi(s), seenBuy=0, seenSkip=0, nBrief=0, gap=Math.max(2,Math.round(R.N/110));",
   "  var ai=btAi(s), seenBuy=0, seenSkip=0, nBrief=0, gap=Math.max(2,Math.round(R.N/110)), imp={};\n  if(ai){ var cl=R.tr.filter(function(t){ return !t.open; }).slice().sort(function(a,b){ return a.pnl-b.pnl; }); if(cl.length>=4) [cl[0],cl[cl.length-1]].forEach(function(t){ R.D.forEach(function(d){ if(d.k==='buy'&&d.tid===t.id) imp[d.j]=1; }); }); }"],
  ["    if(sk?!seenSkip:!seenBuy){ st.full=1; st.t=ai?[900,1000,1300]:[900,0,1200];","    if((sk?!seenSkip:!seenBuy)||imp[st.j]){ st.full=1; st.t=ai?[900,1000,1300]:[900,0,1200];"],
  ["  var bar=Math.max(2.4,Math.min(8,2400/R.N)), seg=[], t=0, pj=-1;","  var bar=Math.max(4.5,Math.min(14,5200/R.N)), seg=[], t=0, pj=-1; /* 지나가는 날의 속도: 그래프가 자라는 것이 보일 만큼 */"],
]);
ed(D+'bt-b.js',[
  ["function btTick(now){\n  if(BT.phase!=='run'||!$('bt-root')){ BT.raf=0; return; }\n","function btTick(now){\n  if(BT.phase!=='run'||!$('bt-root')){ BT.raf=0; return; }\n  /* 모델의 판단 문장을 기다리거나 보여 주는 동안에는 시계가 멈춘다 */\n  if(BT.pause){ BT.t0+=now-(BT.pt||now); BT.pt=now; BT.raf=requestAnimationFrame(btTick); return; } BT.pt=now;\n"],
]);
let v=fs.readFileSync(D+'bt-v2.js','utf8');
const a=v.indexOf('function btJBlock(d){'), b=v.indexOf('function btJRetry(ix)');
if(a<0||b<0) throw new Error('jblock');
v=v.slice(0,a)+"function btJBlock(d){\n  if(!btAi(BT.s)) return '';\n  var id='bt-jb-'+d.ix, J=BT_AI.J[btJKey(d)]; if(!J) J=btJudge(d,function(){ var e=$(id); if(e) e.outerHTML=btJBlock(d); });\n  return '<div class=\"bt-jb '+J.st+'\" id=\"'+id+'\"><h4>그날 TETH의 판단</h4>'+(J.st==='ok'?'<p>'+gEsc(J.t)+'</p>':J.st==='fail'?'<p class=\"f\">판단 문장을 불러오지 못했습니다.</p><button type=\"button\" onclick=\"btJRetry('+d.ix+')\">다시 시도</button>':'<p class=\"l\"><i></i><i></i><i></i></p>')+'</div>';\n}\n"+v.slice(b);
v=v.replace("if(BT.phase==='run'&&st&&st.full&&stage===(btCols().length===3?1:0)&&!st.jShown&&(btAi(BT.s)||(BT.s.cfg&&BT.s.cfg.fut))) btJShow(st);","if(BT.phase==='run'&&st&&st.full&&stage===1&&!st.jShown&&btAi(BT.s)) btJShow(st);");
v=v.replace("    if(fut){ d.say=String(d.why||'').replace(/어요\\.?$/,'습니다').replace(/([^다])$/,'$1'); }","    if(fut){ d.say=String(d.why||'').replace(/어요\\.?$/,'습니다'); }");
fs.writeFileSync(D+'bt-v2.js',v);
let ap=fs.readFileSync(D+'apply2.cjs','utf8');
if(!ap.includes("'bt-v2.js'")){ const x="['bt-a.js','bt-b.js','bt-c.js','bt-go.js','bt-fut.js']"; if(ap.split(x).length!==2) throw new Error('apply2'); ap=ap.replace(x,"['bt-a.js','bt-b.js','bt-c.js','bt-go.js','bt-v2.js','bt-fut.js']"); fs.writeFileSync(D+'apply2.cjs',ap); }
fs.writeFileSync(D+'bt5.css',`/* ── 16-fixes: 판단 패널의 판단 문장, 판단 기록 v2, 해석 상태 ── */
.bt-panel .pj{margin:0;padding:14px 18px 16px;border-top:1px solid rgba(255,255,255,.07)}
.bt-panel .pj[hidden]{display:none}
.bt-panel .pj small{display:block;font-size:11.5px;font-weight:600;letter-spacing:.02em;color:#c8f43c;margin:0 0 6px}
.bt-panel .pj p{margin:0;font-size:14.5px;line-height:1.7;color:#e9ebee;min-height:49px;text-wrap:pretty}
.bt-panel .pj.wait p{color:#8b9096}
.bt-panel .pj.wait small::after{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:#c8f43c;margin-left:8px;animation:btjp 1.1s ease-in-out infinite}
.bt-panel .pj.rest{opacity:.62;transition:opacity .4s ease}
.bt-panel .pj.rest small{color:#8b9096}
@keyframes btjp{0%,100%{opacity:.25}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){ .bt-panel .pj.wait small::after{animation:none} }
/* 기록 한 줄의 점: 딱지 대신 */
.bt-dt{flex:none;display:inline-block;width:8px;height:8px;border-radius:50%;background:#8b9096}
.bt-dt.k-buy{background:#2fb98a}.bt-dt.k-buy.s{background:#b08cf5}
.bt-dt.k-sell{background:transparent;box-shadow:inset 0 0 0 1.6px #cfd3d8}
.bt-dt.k-skip{background:transparent;box-shadow:inset 0 0 0 1.6px #f0b840;border-radius:2px;transform:rotate(45deg)}
.bt-dt.k-hold{background:#5b6067}.bt-dt.k-pick{background:#e9ebee}
.bt-fr.v2{display:grid;grid-template-columns:44px 10px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px}
.bt-fr.v2 time{color:#8b9096;font-size:12px}
.bt-fr.v2 b{font-weight:600;color:#e9ebee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-fr.v2 i{font-style:normal;font-weight:600}
/* 판단 기록: 요약 네 칸이 곧 거르개 */
.bt-sec-b header.v2{display:flex;align-items:center;gap:12px}
.bt-sort{margin-left:auto;display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:#8b9096}
.bt-sort select{height:32px;padding:0 28px 0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:#15171a url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23aeb3ba' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 9px center;color:#e9ebee;font:inherit;font-size:12.5px;appearance:none;-webkit-appearance:none;cursor:pointer}
.bt-s4{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;margin:14px 0 6px;border:1px solid rgba(255,255,255,.09);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.015)}
.bt-s4.n4{grid-template-columns:repeat(4,minmax(0,1fr))}.bt-s4.n3{grid-template-columns:repeat(3,minmax(0,1fr))}
.bt-s4 button{display:flex;flex-direction:column;gap:5px;align-items:flex-start;padding:13px 16px 12px;border:0;border-left:1px solid rgba(255,255,255,.07);background:none;color:inherit;font:inherit;cursor:pointer;text-align:left;position:relative}
.bt-s4 button:first-child{border-left:0}
.bt-s4 small{font-size:12px;color:#8b9096}
.bt-s4 b{font-size:21px;font-weight:700;letter-spacing:-.01em;color:#cfd3d8;line-height:1.1}
.bt-s4 button:hover b{color:#fff}
.bt-s4 button[aria-selected=true]{background:rgba(255,255,255,.05)}
.bt-s4 button[aria-selected=true] b{color:#fff}
.bt-s4 button[aria-selected=true] small{color:#e9ebee}
.bt-s4 button[aria-selected=true]::after{content:'';position:absolute;left:16px;right:16px;bottom:0;height:2px;background:#f2f3f5;border-radius:2px}
.bt-s4 .k-skip[aria-selected=true]::after{background:#f0b840}.bt-s4 .k-buy[aria-selected=true]::after{background:#2fb98a}
.bt-ym{display:flex;align-items:baseline;gap:8px;padding:18px 4px 6px;font-size:12.5px;color:#8b9096;border-bottom:1px solid rgba(255,255,255,.09)}
.bt-ym b{font-weight:600;color:#aeb3ba}
.bt-row.v2 .bt-rb{grid-template-columns:72px 10px minmax(96px,168px) minmax(0,1fr) auto 18px;gap:12px;padding:14px 4px}
.bt-row.v2 .bt-rb time{font-size:12.5px;color:#8b9096}
.bt-row.v2 .bt-rb b{font-size:14px;font-weight:600;color:#f2f3f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-row.v2 .bt-rb .wy{font-size:13.5px;color:#aeb3ba;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-row.v2.on .bt-rb .wy{white-space:normal}
.bt-row.v2 .ot{display:inline-flex;align-items:baseline;gap:7px;white-space:nowrap;font-size:13px}
.bt-row.v2 .ot small{font-size:12px;color:#8b9096}
.bt-row.v2 .ot i{font-style:normal;font-weight:600}
.bt-row.v2 .ot.m i{font-weight:500;opacity:.8}
.bt-row.v2.on{background:rgba(255,255,255,.025)}
.bt-more i{font-style:normal;color:#8b9096;margin-left:6px}
.bt-end{margin:14px 4px 0;font-size:12.5px;color:#8b9096}
.bt-jb{grid-column:1/-1;margin:0 0 4px;padding:14px 16px;border-radius:12px;background:rgba(200,244,60,.045);border:1px solid rgba(200,244,60,.16)}
.bt-jb h4{margin:0 0 6px;font-size:12px;font-weight:600;color:#c8f43c;letter-spacing:.02em}
.bt-jb p{margin:0;font-size:14.5px;line-height:1.7;color:#e9ebee;text-wrap:pretty}
.bt-jb p.f{color:#aeb3ba}
.bt-jb button,.bt-rtry{margin-top:10px;height:32px;padding:0 12px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:none;color:#e9ebee;font:inherit;font-size:12.5px;cursor:pointer}
.bt-jb p.l,.bt-sk{display:grid;gap:8px}
.bt-jb p.l i,.bt-sk i{display:block;height:10px;border-radius:5px;background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.14),rgba(255,255,255,.06));background-size:200% 100%;animation:btsk 1.3s linear infinite}
.bt-jb p.l i:nth-child(2),.bt-sk i:nth-child(2){width:92%}.bt-jb p.l i:nth-child(3),.bt-sk i:nth-child(3){width:64%}
@keyframes btsk{0%{background-position:200% 0}100%{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){ .bt-jb p.l i,.bt-sk i{animation:none} }
.bt-read.v2 p{margin:0 0 9px;font-size:14px;line-height:1.7;color:#cfd3d8;text-wrap:pretty}
.bt-read.v2 p.h{font-size:15px;font-weight:600;color:#fff}
.bt-read.v2 p.l{margin:12px 0 0;font-size:12.5px;color:#8b9096}
.bt-read.v2 p.f{color:#aeb3ba}
@media (max-width:900px){
  .bt-s4,.bt-s4.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
  .bt-s4 button:nth-child(odd){border-left:0}.bt-s4 button:nth-child(n+3){border-top:1px solid rgba(255,255,255,.07)}
  .bt-row.v2 .bt-rb{grid-template-columns:10px minmax(0,1fr) auto 18px;gap:4px 10px}
  .bt-row.v2 .bt-rb time{grid-column:2/-1;grid-row:1}
  .bt-row.v2 .bt-rb .bt-dt{grid-row:2}.bt-row.v2 .bt-rb b{grid-row:2}.bt-row.v2 .bt-rb .ot{grid-row:2}
  .bt-row.v2 .bt-rb .wy{grid-column:2/-1;grid-row:3;white-space:normal}
  .bt-row.v2 .bt-rb .cv{grid-row:2}
}
`);
console.log('ok');
