// 플랜 화면 3단계 지적 반영: 참고와 같은 명도, 굵기, 간격. 모바일 혜택 기본 펼침과 결제 잘림. 완료 문구. 본인 확인 창 주 단추
const fs=require('fs');
function ed(f,L){ let s=fs.readFileSync(f,'utf8'); for(const [a,b] of L){ const n=s.split(a).length-1; if(n!==1) throw new Error(f+' anchor '+n+' :: '+a.slice(0,70)); s=s.replace(a,()=>b); } fs.writeFileSync(f,s); }
ed('pl.js',[
 // 문구
 ["'<div class=\"pl-sub\">기본부터 시작:</div><ul class=\"pl-items\">'","'<div class=\"pl-sub\">포함된 기능</div><ul class=\"pl-items\">'"],
 ["'<div class=\"pl-sub\">구독에 포함:</div><ul class=\"pl-items\">'","'<div class=\"pl-sub\">구독 혜택</div><ul class=\"pl-items\">'"],
 ["'<li>'+plI('grid')+'<span>지원 거래소 7곳 '+plLogos(16)+'</span></li>'\n    +'<li>'+plI('coin')+'<span>거래 수수료 환급</span></li>'","'<li>'+plI('grid')+'<span>연결 가능한 거래소 7곳 '+plLogos(16)+'</span></li>'\n    +'<li>'+plI('coin')+'<span>거래 수수료 환급</span></li>'"],
 ["'<li>'+plI('grid')+'<span>지원 거래소 7곳 '+plLogos(16)+'</span></li>'\n    +'<li>'+plI('swap')+'<span>초대 가입 없이 계정 연결</span></li>'\n    +'<li>'+plI('cal')+'<span>구독 하나로 거래소 '+AC_PAID_MAX+'곳까지 연결</span></li>'","'<li>'+plI('grid')+'<span>연결 가능한 거래소 7곳 '+plLogos(16)+'</span></li>'\n    +'<li>'+plI('swap')+'<span>초대 가입 없이 계정 연결</span></li>'\n    +'<li>'+plI('cal')+'<span>구독당 거래소 최대 '+AC_PAID_MAX+'곳 연결</span></li>'"],
 ["+'<li>'+plI('lock')+'<span>잔고 조회와 주문 권한만 연결</span></li>'\n    +'<li>'+plI('head')+'<span>24시간 계정 상담</span></li></ul>'\n    +'<button type=\"button\" class=\"pl-more\" onclick=\"plMore(this)\">혜택 자세히 보기</button>","+'<li>'+plI('lock')+'<span>연결 권한: 잔고 조회와 주문</span></li>'\n    +'<li>'+plI('head')+'<span>24시간 고객 지원</span></li></ul>'"],
 ["+'<li>'+plI('lock')+'<span>잔고 조회와 주문 권한만 연결</span></li>'\n    +'<li>'+plI('head')+'<span>24시간 계정 상담</span></li></ul>'\n    +'<button type=\"button\" class=\"pl-more\" onclick=\"plMore(this)\">포함 내용 보기</button>","+'<li>'+plI('lock')+'<span>연결 권한: 잔고 조회와 주문</span></li>'\n    +'<li>'+plI('head')+'<span>24시간 고객 지원</span></li></ul>'"],
 ["'<p class=\"pl-d\">TETH 초대로 가입한 거래소 계정으로 이용합니다. 해당 계정이 없으면 새로 가입하고 본인 확인을 진행합니다.</p>'","'<p class=\"pl-d\">TETH 초대로 가입한 거래소 계정으로 이용합니다. 초대 계정이 없다면 거래소에 새로 가입합니다.</p>'"],
 ["'<li>'+plI('bolt')+'<span>전략 자동 실행</span></li><li>'+plI('swap')+'<span>초대 가입 없이 계정 연결</span></li><li>'+plI('lock')+'<span>잔고 조회와 주문 권한만 연결</span></li><li>'+plI('head')+'<span>24시간 계정 상담</span></li></ul>'","'<li>'+plI('bolt')+'<span>전략 자동 실행</span></li><li>'+plI('swap')+'<span>초대 가입 없이 계정 연결</span></li><li>'+plI('lock')+'<span>연결 권한: 잔고 조회와 주문</span></li><li>'+plI('head')+'<span>24시간 고객 지원</span></li></ul>'"],
 // 가격: 통화 기호는 작게, 숫자는 가늘게
 ["'<div class=\"pl-price\"><span class=\"num pl-grad\">$0</span><small>/ 월</small></div>'","'<div class=\"pl-price\"><i>$</i><span class=\"num pl-grad\">0</span><small>/ 월</small></div>'"],
 ["'<div class=\"pl-price\"><span class=\"num\">$280</span><small>/ 월</small></div>'","'<div class=\"pl-price\"><i>$</i><span class=\"num\">280</span><small>/ 월</small></div>'"],
 // 결제 화면: 거래소 선택 밀도 낮춤(이름만), 이름 입력 유지
 ["'<button type=\"button\" role=\"radio\" aria-checked=\"'+on+'\" class=\"'+(on?'on':'')+(off?' off':'')+'\"'+(off?' disabled':'')+' onclick=\"plPickEx(\\''+b.id+'\\')\">'+acLogo(b.id,26)+'<b>'+b.name+'</b><small>'+(a.conn[b.id]?'연결됨':(fixed===b.id?'이 전략의 거래소':'현물, 선물'))+'</small></button>'","'<button type=\"button\" role=\"radio\" aria-checked=\"'+on+'\" class=\"'+(on?'on':'')+(off?' off':'')+'\"'+(off?' disabled':'')+' onclick=\"plPickEx(\\''+b.id+'\\')\">'+acLogo(b.id,22)+'<b>'+b.name+'</b>'+(a.conn[b.id]?'<small>연결됨</small>':fixed===b.id?'<small>이 전략의 거래소</small>':'')+'</button>'"],
 // 페이지 배경 표시용 클래스
 ["  tfPageMode('tfbrokers','거래소 연결'); document.body.classList.remove('tf-route');\n  var bt=ctx.bt||null","  tfPageMode('tfbrokers','거래소 연결'); document.body.classList.remove('tf-route'); document.body.classList.add('pl-page'); document.body.classList.remove('pl-dark');\n  var bt=ctx.bt||null"],
 ["  tfPageMode('tfbrokers','플랜 구성'); document.body.classList.remove('tf-route');","  tfPageMode('tfbrokers','플랜 구성'); document.body.classList.remove('tf-route'); document.body.classList.add('pl-page','pl-dark');"],
 ["function plMore(b){","function plPageOff(){ document.body.classList.remove('pl-page','pl-dark'); }\nfunction plMore(b){"],
]);
// 다른 화면이 그려지면 플랜 배경을 걷는다
ed('p16.js',[["  var gc0=gContent; gContent=function(){ var r=gc0.apply(this,arguments); stFull(); return r; };","  var gc0=gContent; gContent=function(){ var r=gc0.apply(this,arguments); stFull(); try{ if(!document.getElementById('pl-root')) plPageOff(); }catch(e){} return r; };"]]);
ed('ac.js',[
 // 완료 문구: 연결 완료만 확정. 실행 전 조건을 적는다
 ["  if(cur==='done') return '<h2 class=\"btg-h\">실행 준비가 끝났습니다</h2><p class=\"btg-s\">'+(ctx.name?gEsc(ctx.name)+' 전략을 ':'전략을 ')+acName(a.ex||acConnList()[0])+' 계정에서 실행할 수 있습니다.</p>';","  if(cur==='done') return '<h2 class=\"btg-h\">거래소 연결 완료</h2><p class=\"btg-s\">'+(ctx.name?gEsc(ctx.name)+' 전략을 ':'전략을 ')+acName(a.ex||acConnList()[0])+' 계정에서 실행할 수 있습니다. 전략을 시작할 때 거래소의 본인 확인 상태를 봅니다.</p>';"],
 // 한도 안내: 연결된 거래소를 보여 주고 문구 교체. 전략 거래소가 정해져 있으면 다른 거래소 선택은 없음
 ["  return '<p class=\"acx-note\" role=\"status\"><b>구독으로는 거래소 '+AC_PAID_MAX+'곳까지 연결합니다</b><br>지금 구독에는 이미 '+acPaidCount()+'곳이 연결되어 있습니다. '+n+'는 TETH 초대 계정으로 연결하거나 구독을 하나 더 시작할 수 있습니다.</p>'\n    +'<div class=\"acx-col\"><button type=\"button\" class=\"acx-ch\" onclick=\"acLimitAlt(\\'partner\\')\"><b>TETH 초대 계정으로 연결</b><span>이용료 없이 씁니다. 초대 계정이 아니면 새로 만듭니다</span></button><button type=\"button\" class=\"acx-ch\" onclick=\"acLimitAlt(\\'more\\')\"><b>구독 하나 더 시작</b><span>월 '+acUsd(AC_CFG.price)+' 추가, 거래소 '+AC_PAID_MAX+'곳 더</span></button><button type=\"button\" class=\"acx-ch\" onclick=\"acLimitAlt(\\'ex\\')\"><b>다른 거래소 고르기</b><span></span></button></div>'; }",
  "  var L=acConnList().filter(function(k){ return a.conn[k].via==='paid'; });\n  return '<p class=\"acx-note\" role=\"status\"><b>현재 구독의 연결 한도에 도달했습니다</b><br>구독당 거래소 최대 '+AC_PAID_MAX+'곳입니다. 연결된 거래소: '+L.map(function(k){ return acLogo(k,16)+' '+acName(k); }).join(', ')+'</p>'\n    +'<div class=\"acx-col\"><button type=\"button\" class=\"acx-ch\" onclick=\"acLimitAlt(\\'partner\\')\"><b>'+n+'를 TETH 초대 계정으로 연결</b><span>이용료 없음. 초대 계정이 없으면 새로 가입합니다</span></button><button type=\"button\" class=\"acx-ch\" onclick=\"acLimitAlt(\\'more\\')\"><b>구독 추가</b><span>월 '+acUsd(AC_CFG.price)+', 거래소 최대 '+AC_PAID_MAX+'곳 추가 연결</span></button>'+(AC_CTX&&AC_CTX.need?'':'<button type=\"button\" class=\"acx-ch\" onclick=\"acLimitAlt(\\'ex\\')\"><b>다른 거래소 고르기</b><span>연결된 거래소 중에서 실행합니다</span></button>')+'</div>'; }"],
 // 본인 확인 창: 본인 확인이 주 단추
 ["  var act=st==='ok'||st==='run'?'':(st==='fail'||st==='none'?'<a class=\"bt-sec acx-a\" href=\"'+gEsc(acRef(ex))+'\" target=\"_blank\" rel=\"noopener\">본인 확인하러 가기'+AC_OUT+'</a>':'')+'<button type=\"button\" class=\"bt-sec\" onclick=\"acKycRun(\\''+ex+'\\')\">다시 확인하기</button>';",
  "  var act=st==='ok'||st==='run'?'':(st==='fail'||st==='none'?'<a class=\"bt-cta acx-a\" href=\"'+gEsc(acRef(ex))+'\" target=\"_blank\" rel=\"noopener\">본인 확인하러 가기'+AC_OUT+'</a>':'')+'<button type=\"button\" class=\"bt-sec\" onclick=\"acKycRun(\\''+ex+'\\')\">다시 확인하기</button>';"],
 ["'<div class=\"bts\"><button type=\"button\" onclick=\"acConfirmClose()\">닫기</button><button type=\"button\" class=\"ok\" id=\"ac-kyc-go\" onclick=\"acRunGateGo()\"'+(acRunOk(ex)?'':' disabled')+'>전략 시작</button></div></div>';","'<div class=\"bts\"><button type=\"button\" onclick=\"acConfirmClose()\">닫기</button><button type=\"button\" class=\"ok\" id=\"ac-kyc-go\" onclick=\"acRunGateGo()\"'+(acRunOk(ex)?'':' hidden disabled')+'>전략 시작</button></div></div>';"],
 // 가입 안내: 번호 대신 이름표
 ["  return '<ol class=\"acx-g\">'+T.map(function(x,i){ return '<li class=\"'+(i<g?'ok':i===g?'on':'')+'\"><span class=\"n num\">'+(i<g?AC_CK:(i+1))+'</span><div><b>'+x[0]+'</b>'+(i===g?'<p>'+x[1]+'</p>':'')+'</div></li>'; }).join('')+'<li><span class=\"n num\">3</span><div><b>TETH 연결</b></div></li></ol>'","  return '<ol class=\"acx-g acx-g2\">'+T.map(function(x,i){ return '<li class=\"'+(i<g?'ok':i===g?'on':'')+'\"><span class=\"n\">'+(i<g?AC_CK:'')+'</span><div><b>'+x[0]+'</b>'+(i===g?'<p>'+x[1]+'</p>':'')+'</div></li>'; }).join('')+'<li><span class=\"n\"></span><div><b>TETH 연결</b></div></li></ol>'"],
 ["  return '<p class=\"btg-p\">TETH 초대로 '+n+'에 가입하면 이용료 없이 씁니다. 가입과 본인 확인은 약 5분 걸리고, 막히면 상담원이 24시간 함께 합니다.</p>'","  return '<p class=\"btg-p\">TETH 초대로 '+n+'에 가입하면 TETH 이용료 없이 이용합니다. 가입 후 계정을 연결합니다. 본인 확인은 전략 시작 전에 필요합니다. 도움이 필요하면 24시간 고객 지원을 이용할 수 있습니다.</p>'"],
]);
let c=fs.readFileSync('pl.css','utf8');
c=c.replace(/\/\* ── 거래소 연결 플랜[\s\S]*$/,'');
c+=`/* ── 거래소 연결 플랜 (참고: ChatGPT 플랜 업그레이드, 플랜 구성) ── */
body.pl-page #g-content,body.pl-page #g-scroll,body.pl-page .g-center{background:#212121}
body.pl-page.pl-dark #g-content,body.pl-page.pl-dark #g-scroll,body.pl-page.pl-dark .g-center{background:#000}
body.pl-page #g-chead{background:transparent}
body.pl-page #g-appbanner{display:none!important}
.pl{max-width:1080px;margin:0 auto;padding:8px 24px 100px;color:#ececec;font-weight:400}
.pl-head{text-align:center;margin:0 0 26px}
.pl-head h1{margin:0;font-size:32px;font-weight:400;letter-spacing:-.01em;color:#fff}
.pl-need{margin:10px 0 0;font-size:15px;color:#b4b4b4}
.pl-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:27px;align-items:stretch}
.pl-grid.has-bt{grid-template-columns:repeat(3,minmax(0,1fr))}
.pl-card{position:relative;display:flex;flex-direction:column;padding:26px;border-radius:26px;border:1px solid rgba(255,255,255,.16);background:#212121;min-width:0}
.pl-card.pl-hi{border-color:#5a8dff;background:linear-gradient(180deg,#27303f 0%,#1f3556 45%,#1e4a8f 100%)}
.pl-top{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:28px}
.pl-lb{font-size:20px;font-weight:600;color:#fff}
.pl-h{margin:24px 0 0;font-size:32px;line-height:1.25;font-weight:400;letter-spacing:-.01em;color:#fff}
.pl-d{margin:14px 0 0;font-size:18px;line-height:1.55;color:#cdcdcd;min-height:84px}
.pl-price{display:flex;align-items:baseline;gap:4px;margin:34px 0 28px}
.pl-price>i{font-style:normal;font-size:20px;color:#fff;align-self:flex-start;margin-top:8px}
.pl-price>span{font-size:44px;font-weight:400;line-height:1;letter-spacing:-.01em;color:#fff}
.pl-price>small{font-size:16px;color:#cdcdcd;margin-left:4px}
.pl-grad{background:linear-gradient(120deg,#cfe0ff 0%,#8fb4ff 55%,#b39dff 100%);-webkit-background-clip:text;background-clip:text;color:transparent!important}
.pl-cta{width:100%;height:48px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;font:inherit;font-size:15px;font-weight:500;cursor:pointer;transition:background-color .15s ease,border-color .15s ease}
.pl-cta:hover{background:rgba(255,255,255,.08)}
.pl-cta-hi{background:#2f6fed;border-color:#2f6fed;color:#fff}
.pl-cta-hi:hover{background:#2b64d6}
.pl-cta-w{background:#fff;border-color:#fff;color:#000;font-weight:500}
.pl-cta-w:hover{background:#ececec}
.pl-cta:disabled{opacity:.6;cursor:default}
.pl-sub{margin:42px 0 16px;font-size:16px;color:#ececec}
.pl-items{list-style:none;margin:0;padding:0;display:grid;gap:20px}
.pl-items li{display:grid;grid-template-columns:20px minmax(0,1fr);gap:16px;align-items:center;font-size:16px;line-height:1.5;color:#ececec}
.pl-items li svg{color:#cdcdcd}
.pl-hi .pl-items li svg{color:#8fb4ff}
.pl-items.sm{gap:18px}.pl-items.sm li{font-size:16px}
.pl-logos{display:inline-flex;gap:4px;vertical-align:middle;margin-left:6px}
.pl-logos img,.pl-logos .acx-mono{border-radius:4px;vertical-align:0}
.pl-foot{margin:auto 0 0;padding-top:34px;font-size:13px;line-height:1.6;color:#b4b4b4}
.pl-bt .pl-price>span{font-size:40px}
.pl-spark{width:100%;height:72px;margin:0 0 20px}
.pl-more{display:none}
/* 플랜 구성(결제) */
.pl-co{max-width:1120px;padding-top:0}
.pl-cohead{display:flex;align-items:center;gap:14px;margin:0 0 30px}
.pl-cohead h1{margin:0;font-size:32px;font-weight:400;color:#fff}
.pl-back{width:36px;height:36px;border:0;border-radius:10px;background:transparent;color:#ececec;display:flex;align-items:center;justify-content:center;cursor:pointer}
.pl-back:hover{background:rgba(255,255,255,.08)}
.pl-cogrid{display:grid;grid-template-columns:minmax(0,1fr) 437px;gap:79px;align-items:start}
.pl-t3{margin:0 0 6px;font-size:18px;font-weight:600;color:#fff}.pl-t3.mt{margin-top:34px;margin-bottom:14px}
.pl-d2{margin:0 0 14px;font-size:14px;color:#b4b4b4}
.pl-exs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.pl-exs button{display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 8px 14px;border-radius:20px;border:2px solid transparent;background:#3a3a3a;color:#fff;font:inherit;cursor:pointer;transition:border-color .12s ease,background-color .12s ease}
.pl-exs button img,.pl-exs button .acx-mono{border-radius:7px}
.pl-exs button b{font-size:15px;font-weight:600}.pl-exs button small{font-size:11.5px;color:#cdcdcd}
.pl-exs button.on{border-color:#9a9a9a;background:#2c2c2c}
.pl-exs button.off{opacity:.35;cursor:default}
.pl-apple{width:100%;height:47px;border-radius:18px;border:0;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;gap:4px;font:inherit;font-size:20px;font-weight:600;cursor:pointer;letter-spacing:-.01em}
.pl-apple span{font-family:-apple-system,"Helvetica Neue",Arial,sans-serif}
.pl-apple:disabled{opacity:.7;cursor:default;font-size:14px}
.pl-or{display:flex;align-items:center;gap:12px;margin:14px 0;color:#9a9a9a;font-size:12px}
.pl-or::before,.pl-or::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.18)}
.pl-form{display:grid;gap:10px}
.pl-form .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pl-in{position:relative;display:flex;align-items:center;height:77px;padding:0 20px;border-radius:19px;background:#2f2f2f}
.pl-in.big{height:78px}
.pl-in input{flex:1;min-width:0;border:0;background:transparent;color:#fff;font:inherit;font-size:18px;font-weight:500;outline:0}
.pl-in input::placeholder{color:#a5a5a5;font-weight:500}
.pl-in input.bad{color:#ff9aa5}
.pl-brands{display:flex;gap:4px}
.pl-brands i{display:inline-flex;align-items:center;justify-content:center;width:34px;height:22px;border-radius:4px;font-size:9px;font-weight:800;font-style:normal;letter-spacing:.02em}
.pl-brands .visa{background:#1a1f71;color:#fff}.pl-brands .amex{background:#2e77bb;color:#fff}
.pl-brands .mc{background:radial-gradient(circle at 35% 50%,#eb001b 0 45%,transparent 46%),radial-gradient(circle at 65% 50%,#f79e1b 0 45%,transparent 46%),#000}
.pl-cvc{width:26px;height:18px;border-radius:3px;border:1.5px solid #a5a5a5;font-size:8px;color:#a5a5a5;display:flex;align-items:flex-end;justify-content:flex-end;padding:0 2px 1px}
.pl-form .er{display:none;font-size:12.5px;color:#f58a98}.pl-form .er:not(:empty){display:block}
.pl-ck{display:flex;align-items:center;gap:10px;margin-top:8px;font-size:15px;color:#ececec;cursor:pointer}
.pl-ck input{width:18px;height:18px;accent-color:#fff}
.pl-saved{display:grid;gap:10px}
.pl-saved .r{display:grid;grid-template-columns:20px minmax(0,1fr) 18px;gap:12px;align-items:center;padding:18px 20px;border-radius:19px;background:#2f2f2f;border:2px solid #9a9a9a}
.pl-saved .r b{display:block;font-size:16px;color:#fff}.pl-saved .r small{display:block;font-size:12px;color:#cdcdcd}
.pl-saved .r i{color:#2fb98a}
.pl-link{border:0;background:none;color:#cdcdcd;font:inherit;font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;justify-self:start}
.pl-sumcard{padding:34px;border-radius:36px;background:#303030;border:1px solid rgba(255,255,255,.1);color:#ececec}
.pl-sumcard h2{margin:0 0 8px;font-size:32px;font-weight:400;letter-spacing:-.01em;color:#fff}
.pl-sumcard>p{margin:0 0 24px;font-size:15px;color:#cdcdcd}
.pl-lines{margin:28px 0 24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.14);display:grid;gap:12px;font-size:15px;color:#cdcdcd}
.pl-lines div{display:flex;justify-content:space-between;gap:16px}
.pl-lines b{color:#fff;font-weight:400}
.pl-lines .tot{margin-top:4px;font-size:17px;color:#fff}.pl-lines .tot b{font-weight:700}
.pl-sumcard .pl-cta{height:65px;font-size:16px}
.pl-legal{margin:18px 8px 0;font-size:13.5px;line-height:1.6;color:#d0d0d0}
@media (max-width:1100px){ .pl-grid.has-bt{grid-template-columns:repeat(2,minmax(0,1fr))} .pl-bt{grid-column:1/-1} .pl-cogrid{grid-template-columns:minmax(0,1fr) 380px;gap:32px} }
@media (max-width:900px){
  .pl{padding:4px 5px 110px}
  .pl-head{margin-bottom:16px}.pl-head h1{font-size:26px}
  .pl-grid,.pl-grid.has-bt{grid-template-columns:1fr;gap:14px}
  .pl-bt{grid-column:auto;order:0}.pl-hi{order:1}.pl-card:not(.pl-hi):not(.pl-bt){order:2}
  .pl-card{padding:22px 20px;border-radius:19px}
  .pl-lb{font-size:18px}.pl-h{font-size:26px;margin-top:18px}.pl-d{font-size:15px;min-height:0;margin-top:10px}
  .pl-price{margin:22px 0 18px}.pl-price>span{font-size:36px}.pl-price>i{font-size:16px;margin-top:6px}
  .pl-sub{margin:26px 0 12px}.pl-items{gap:16px}.pl-items li{font-size:15px}
  .pl-foot{padding-top:24px}
  .pl-cogrid{grid-template-columns:minmax(0,1fr);gap:24px}
  .pl-right{order:2}.pl-left{order:1}
  .pl-sumcard{padding:24px;border-radius:24px}.pl-sumcard h2{font-size:26px}
  .pl-exs{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.pl-exs button{padding:12px 6px 10px;border-radius:14px}
  .pl-in{height:64px;border-radius:14px}.pl-in.big{height:68px}.pl-in input{font-size:16px}
}
`;
fs.writeFileSync('pl.css',c);
fs.appendFileSync('bt6.css',`
.acx-g2 .n{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.18);border:0;font-size:0;margin:7px}
.acx-g2 li.on .n{background:#fff}.acx-g2 li.ok .n{background:transparent;color:#2fb98a;width:24px;height:24px;margin:0;font-size:12px}
.acx-g2 li{grid-template-columns:24px minmax(0,1fr)}
`);
console.log('ok');
