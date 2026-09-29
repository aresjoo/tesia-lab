// Round 6 레드팀 반영
const fs=require('fs'); const D=__dirname+'/';
function edit(file,pairs){ let s=fs.readFileSync(D+file,'utf8'); for(const [a,b] of pairs){ const n=s.split(a).length-1; if(n!==1) throw new Error(file+' anchor x'+n+': '+a.slice(0,70)); s=s.replace(a,()=>b); } fs.writeFileSync(D+file,s); console.log(file,'ok',pairs.length); }
edit('rd-ui.js',[
 // N1: 세대 기록이 없는 저장은 세대 기록을 넣기 전의 데이터(9월 28일, 1335봉)에서 만들어진 것이다
 ["      if(!g){ c.gen=now; ch=true; }\n      else if(g.len!==now.len","      if(!g){ g=c.gen={asof:MK_GEN0.asof.slice(),len:MK_GEN0.len}; ch=true; }\n      if(g.len!==now.len"]
]);
fs.appendFileSync(D+'rd-ui.js',`
/* 세대 기록을 넣기 전 저장의 데이터 세대 */
var MK_GEN0={asof:[2026,9,28],len:1335};
`);
edit('apply2.cjs',[
 ["rep(\"toast(nick+' 님의 전략을 따라가기 시작했어요. 다음 진입부터 자동으로 따라가요');\",\"toast(nick+' 따라가기를 시작했어요. 다음 진입부터 자동으로 따라가요');\",true);",
  "{ const T0=\"toast(nick+' 님의 전략을 따라가기 시작했어요. 다음 진입부터 자동으로 따라가요');\", T1=\"toast(nick+' 따라가기를 시작했어요. 다음 진입부터 자동으로 따라가요');\", T2=\"toast(nick+' 따라가기를 시작했어요. '+(c2.adv.existing==='copy'?'지금 든 종목부터 바로 따라가요':'다음 진입부터 자동으로 따라가요'));\";\n  if(!t.includes(T2)) rep(t.includes(T1)?T1:T0,T2); }"],
 ["// 6. rd 블록이 선언하는 함수의 옛 정의를 지운다",
  "// 5n. 따라가기 시트: Tab 이 시트 안에서 돌고, 열린 동안 뒤 화면은 조작할 수 없다\nrep(\"function mkFollowEsc(e){ if(e.key==='Escape') mkFollowClose(); }\",\"function mkFollowEsc(e){\n  if(e.key==='Escape'){ mkFollowClose(); return; }\n  if(e.key!=='Tab') return;\n  var w=$('mk-follow'); if(!w) return;\n  var f=[].filter.call(w.querySelectorAll('button,input,select,textarea,summary,a[href]'),function(x){ return !x.disabled&&x.tabIndex>=0&&x.getClientRects().length; });\n  if(!f.length){ e.preventDefault(); return; }\n  var i=f.indexOf(document.activeElement);\n  if(e.shiftKey?i<=0:(i<0||i===f.length-1)){ e.preventDefault(); f[e.shiftKey?f.length-1:0].focus(); }\n}\nfunction mkFollowInert(on,w){ [].forEach.call(document.body.children,function(x){ if(x===w||x.tagName==='SCRIPT'||x.tagName==='STYLE') return; if(on){ if(!x.inert){ x.inert=true; x.setAttribute('data-mkf-inert','1'); } } else if(x.getAttribute('data-mkf-inert')){ x.inert=false; x.removeAttribute('data-mkf-inert'); } }); }\",true);\nrep(\"  var w=$('mk-follow'); if(w){ w.id=''; w.remove(); }\n  document.removeEventListener('keydown',mkFollowEsc);\",\"  var w=$('mk-follow'); if(w){ w.id=''; w.remove(); }\n  mkFollowInert(false);\n  document.removeEventListener('keydown',mkFollowEsc);\",true);\nrep(\"  document.body.appendChild(w);\n  var gs=$('g-scroll'); if(gs) gs.style.overflow='hidden';\n  document.addEventListener('keydown',mkFollowEsc);\",\"  document.body.appendChild(w);\n  mkFollowInert(true,w);\n  var gs=$('g-scroll'); if(gs) gs.style.overflow='hidden';\n  document.addEventListener('keydown',mkFollowEsc);\",true);\n// 6. rd 블록이 선언하는 함수의 옛 정의를 지운다"]
]);
fs.appendFileSync(D+'rd.css',`
/* Round 6: 좁은 화면의 조작 줄. 판단 방식 줄과 정렬, 시장, 검색 줄을 나눈다 */
@media (max-width:767px){
  .mk .mk-bar.mk3-bar{display:block;overflow:visible;padding-bottom:0}
  .mk .mk3-bar .mk3-kindrow{display:block;margin:0 0 12px}
  .mk .mk3-bar .mk3-seg{display:flex;width:100%}
  .mk .mk3-bar .mk3-seg button{flex:1 1 auto;justify-content:center;padding:0 8px;font-size:13.5px;gap:5px}
  .mk .mk3-bar .mk3-kindhelp{min-width:0;margin-top:10px}
  .mk .mk3-bar .mk3-flt{display:flex;flex-wrap:wrap;align-items:center;gap:8px;overflow:visible}
  .mk .mk3-bar .mk3-flt>.mk-chips{display:flex;flex:1 0 100%;flex-wrap:nowrap;gap:6px;margin:0;overflow-x:auto}
  .mk .mk3-bar .mk3-flt>.mk-chips .lb{display:none}
  .mk .mk3-bar .mk3-flt .mk-search-toggle{display:none}
  .mk .mk3-bar .mk3-flt .ss3-search{display:flex;flex:1 1 0;min-width:0}
  .mk .mk3-bar .mk3-flt .ss3-search input{min-width:0;width:100%}
}
`);
