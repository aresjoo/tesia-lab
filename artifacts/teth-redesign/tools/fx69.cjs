// Codex 터미널 s5 반영
const fs=require('fs');
fs.appendFileSync('sk-mkt.js',`

/* s5: 포지션을 들고 있으면 판단 패널 문구를 보유 기준으로(진입 조건 → 청산 조건) */
var MKT_HOLD=[['TETH가 진입 조건을 확인하고 있습니다','TETH가 청산 조건을 확인하고 있습니다'],['아직 진입하지 않은 이유','포지션 보유 이유'],['다음 진입 조건','청산 조건']];
function mktHoldFix(){ try{ var s=TF_TM.sel?tfTmOf(TF_TM.sel):null; if(!s||s.status!=='live') return; var c=tfTmCalc(s); if(!c||!c.pos) return;
  var b=document.querySelector('#g-content .tft-brain'); if(!b) return;
  var w=document.createTreeWalker(b,NodeFilter.SHOW_TEXT,null), n;
  while((n=w.nextNode())){ var t=n.nodeValue, u=t; MKT_HOLD.forEach(function(p){ if(u.indexOf(p[0])>=0) u=u.split(p[0]).join(p[1]); }); if(u!==t) n.nodeValue=u; } }catch(e){} }
/* s5: 차트 시세 출처와 운용 거래소가 다르면 차트 탭 줄 오른쪽에 한 줄 */
function mktRefNote(){ try{ var bar=document.querySelector('#g-content .tft-page .mkt-tabs'); if(!bar) return;
  var ex=null, s=TF_TM.sel?tfTmOf(TF_TM.sel):null;
  if(s) ex=s.exL||null; else { var c=cpState().copies.filter(function(x){ return x.status==='active'; })[0]; if(c){ var k=(acConnList&&acConnList()[0])||'bitget'; ex=acName?acName(k):k; } }
  var el=bar.querySelector('.mkt-ref'); var txt=ex&&!/binance/i.test(ex)?'Binance 시세, '+ex+'에서 운용':'';
  if(!txt){ if(el) el.remove(); return; }
  if(!el){ el=document.createElement('span'); el.className='mkt-ref'; bar.appendChild(el); } if(el.textContent!==txt) el.textContent=txt; }catch(e){} }
(function(){ var t=0; var go=function(){ clearTimeout(t); t=setTimeout(function(){ mktHoldFix(); mktRefNote(); },250); };
  try{ new MutationObserver(go).observe(document.getElementById('g-content'),{childList:true,subtree:true,characterData:true}); }catch(e){} })();
`);
// 데이터 차트: 모바일은 좌표 폭을 화면에 맞춰 축 글자가 줄지 않게
let j=fs.readFileSync('sk-mkt.js','utf8');
const a="function mktSvg(x,series,o){ o=o||{}; var W=520,H=190,";
if(!j.includes(a)) throw new Error('miss mktSvg');
j=j.replace(a,"function mktSvg(x,series,o){ o=o||{}; var W=window.innerWidth<=768?Math.max(300,Math.min(520,window.innerWidth-56)):520,H=190,");
j=j.split('fill="#9a9a9a" font-size="11"').join('fill="#9a9a9a" font-size="12"');
fs.writeFileSync('sk-mkt.js',j);
fs.appendFileSync('sk-mkt.css',`
/* s5: 정보 15px, 출처 13px, 선택 전략 2px 테두리, 모바일 기간 단추 한 줄, 검색칸 높이, 시세 출처 줄, 관리 회색 알약 */
#mkt-info{font-size:15px}
.mki-src{font-size:13px!important;color:#9a9a9a!important}
.tft-page .tft-card.on{box-shadow:inset 0 0 0 2px #9a9a9a!important}
@media (max-width:768px){ .mkx-per{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none} .mkx-per::-webkit-scrollbar{display:none} .mkx-per button{flex:none} }
.mkp-q{flex:none;min-height:46px}
.mkt-ref{margin-left:auto;font-size:12px;color:#9a9a9a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.px-tbrain .r .pl-link{height:36px;padding:0 16px;border-radius:999px;background:#2f2f2f;color:#ececec;text-decoration:none;font-size:14px;flex:none}
.px-tbrain .r .pl-link:hover{background:#3a3a3a}
`);
console.log('ok');
