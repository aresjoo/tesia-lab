// 소개 페이지 본문 전체를 플랜 화면(거래소 연결) 문법으로 다시 짠다. 요소(첫 화면, 네 단계, 요금, 확인 사항, 질문, 마지막 안내)는 유지
const fs=require('fs');
const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/about/index.html';
let h=fs.readFileSync(F,'utf8');
const a=h.indexOf('<section class="hero">'), b=h.indexOf('<div id="site-footer"></div>');
if(a<0||b<0) throw new Error('miss body');
const IC={bolt:'<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',chat:'<path d="M4 5h16v11H8l-4 4z"/>',list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',chart:'<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>',doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',lock:'<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',think:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.4 1 2.5h6c0-1.1.3-1.9 1-2.5A6 6 0 0 0 12 3z"/>',pause:'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',wallet:'<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16 15h2"/>'};
const I=k=>'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+IC[k]+'</svg>';
const LOGOS='<span class="pl-logos">'+[['bitget','png'],['binance','png'],['okx','png'],['bybit','png'],['mexc','png'],['woox','png'],['gate','jpg']].map(e=>'<img src="../assets/logos/app-'+e[0]+'.'+e[1]+'" alt="" width="16" height="16">').join('')+'</span>';
const li=(k,t)=>'<li>'+I(k)+'<span>'+t+'</span></li>';
const step=(lb,hh,d,img,w,ht,alt,items,lnk,href)=>'<article class="ab-card rv"><div class="ab-tx"><span class="pl-lb">'+lb+'</span><h2 class="ab-h">'+hh+'</h2><p class="ab-d">'+d+'</p><ul class="pl-items">'+items+'</ul><a class="ab-link" href="'+href+'">'+lnk+'</a></div><div class="ab-shot"><img src="../assets/shots/v2/'+img+'" width="'+w+'" height="'+ht+'" loading="lazy" alt="'+alt+'"></div></article>';
const BODY=`<canvas id="stars" hidden></canvas>
<main class="ab">
<section class="ab-hero">
  <span class="pl-lb">TETH</span>
  <h1 class="ab-h1">거래하는 사람을 위한 AI 트레이딩</h1>
  <p class="ab-d">말로 전략을 만들고, 실제 시장 데이터로 검증하고, 지금 쓰는 거래소 계정에서 실행합니다.</p>
  <div class="ab-acts"><a class="ab-cta" href="../">무료로 시작하기</a><a class="ab-link" href="#pricing">요금 보기</a></div>
  <p class="ab-free">영원히 무료, 카드 등록 없음</p>
  <div class="ab-heroshot"><img src="../assets/shots/v2/about-live.webp" width="1376" height="900" alt="TETH 터미널, 차트와 판단 패널"></div>
</section>
<section class="ab-sec">
  <h2 class="ab-sh">이렇게 씁니다</h2>
  <p class="ab-ss">대화에서 시작해 실행까지 한 곳에서 이어집니다.</p>
  <div class="ab-steps">
  ${step('대화','말로 만드는 전략','아이디어를 말하면 TETH가 진입, 청산, 손절 조건이 정해진 전략으로 정리합니다.','about-plan.webp','1200','900','TETH 전략 카드, 자산과 사고파는 조건',li('chat','빠진 조건은 TETH가 먼저 묻습니다')+li('list','진입, 청산, 손절 조건으로 정리')+li('layers','차트 규칙, AI 판단, 혼합 전략'),'전략 만들기','../')}
  ${step('검증','실제 데이터로 검증','지난 시장 데이터로 전략을 돌려 수익과 위험을 숫자로 확인합니다.','about-backtest.webp','1200','900','TETH 백테스트 결과, 잔고 차트와 판단 기록',li('cal','최근 3개월부터 전체 기간까지')+li('chart','수익률과 가장 크게 내려간 폭')+li('doc','매번의 판단 기록'),'결과 보기','../')}
  ${step('연결','지금 쓰는 계정 그대로','거래소를 고르고 한 번 승인하면, 전략이 그 계정에서 직접 주문합니다.','about-connect.webp','900','640','TETH 거래소 선택 화면',li('grid','연결 가능한 거래소 7곳 '+LOGOS)+li('check','한 번 승인으로 연결')+li('lock','연결 권한: 잔고 조회와 주문'),'거래소 연결하기','../')}
  ${step('실행','판단 근거까지 기록','전략이 24시간 시장을 보고, 사고판 이유를 문장으로 남깁니다.','about-live.webp','1376','900','TETH 터미널 판단 패널',li('clock','24시간 자동 실행')+li('think','TETH의 생각과 판단 기록')+li('pause','언제든 일시정지와 긴급 정지'),'터미널 열기','../')}
  </div>
</section>
<section class="ab-sec" id="pricing">
  <h2 class="ab-sh">이용 방법을 선택합니다</h2>
  <p class="ab-ss">거래소 계정에 맞는 방법을 고릅니다.</p>
  <div class="plans" id="plans"></div>
</section>
<section class="ab-sec">
  <h2 class="ab-sh">이용 전에 확인합니다</h2>
  <div class="ab-list rv">
    <div class="ab-row">${I('wallet')}<div><b>거래 한도</b><span>전략마다 쓸 금액과 손실 중단 기준을 직접 정합니다.</span></div></div>
    <div class="ab-row">${I('cal')}<div><b>검증 기간</b><span>백테스트는 고른 기간의 실제 시장 데이터로 돌리고, 결과 화면에 기간을 함께 보여 줍니다.</span></div></div>
    <div class="ab-row">${I('lock')}<div><b>연결 권한</b><span>잔고 조회와 주문 권한으로 연결합니다. 연결은 언제든 해제할 수 있습니다.</span></div></div>
    <div class="ab-row">${I('doc')}<div><b>판단 기록</b><span>거래마다 판단 근거를 기록해 언제든 다시 볼 수 있습니다.</span></div></div>
  </div>
</section>
<section class="ab-sec">
  <h2 class="ab-sh">자주 묻는 질문</h2>
  <div class="ab-list ab-faq rv">
    <details><summary>TETH는 어떤 서비스입니까?</summary><p>말로 투자 전략을 만들고, 실제 시장 데이터로 검증하고, 연결한 거래소에서 실행하는 AI 트레이딩 서비스입니다.</p></details>
    <details><summary>전략은 어떻게 실행합니까?</summary><p>검증을 마친 전략은 연결한 거래소 계정에서 자동으로 실행합니다. 시작 전에 직접 승인합니다.</p></details>
    <details><summary>어떤 거래소를 연결합니까?</summary><p>Bitget, Binance, OKX, Bybit, MEXC, WOO X, Gate 7곳을 연결합니다.</p></details>
    <details><summary>백테스트 결과는 어디서 확인합니까?</summary><p>전략을 만들면 바로 검증하고, 결과 화면에서 수익률, 가장 크게 내려간 폭, 판단 기록을 보여 줍니다.</p></details>
    <details><summary>연결 권한은 무엇입니까?</summary><p>잔고 조회와 주문 권한으로 연결합니다. 연결은 언제든 해제할 수 있습니다.</p></details>
    <details><summary>무료로 쓸 수 있습니까?</summary><p>TETH 초대로 가입한 거래소 계정이면 TETH 초대 계정으로 씁니다. 영원히 무료, 카드 등록 없음입니다.</p></details>
    <details><summary>모바일 앱이 있습니까?</summary><p>iOS, Android 앱을 준비하고 있습니다. <a href="../download/">앱 다운로드 페이지</a>에서 소식을 확인합니다.</p></details>
  </div>
</section>
<section class="ab-sec">
  <article class="pl-card pl-hi ab-final rv">
    <span class="pl-lb">TETH 초대 계정</span>
    <h2 class="pl-h">거래하는 사람을 위해</h2>
    <p class="pl-d">아이디어 하나로 시작합니다. 전략을 만들고 검증한 뒤, 지금 쓰는 거래소에서 실행합니다.</p>
    <a class="pl-cta pl-cta-hi" href="../">무료로 시작하기</a>
    <p class="ab-free">영원히 무료, 카드 등록 없음</p>
  </article>
  <p class="ab-help">막히면 상담원이 24시간 답합니다. <a class="ab-link" href="../">상담원에게 묻기</a></p>
</section>
</main>
`;
h=h.slice(0,a)+BODY+h.slice(b);
const CSS=`
/* 소개 페이지 새 구성(ab): 플랜 화면 문법 */
.ab{max-width:1080px;margin:0 auto;padding:0 24px 40px;color:#ececec}
.ab .rv{opacity:1!important;transform:none!important}
.ab-hero{padding:120px 0 24px;text-align:left}
.ab-h1{margin:14px 0 0;font-size:48px;line-height:1.2;font-weight:400;letter-spacing:-.015em;color:#fff}
.ab-d{margin:16px 0 0;font-size:18px;line-height:1.6;color:#cdcdcd;max-width:640px}
.ab-acts{display:flex;align-items:center;gap:24px;margin:32px 0 0;flex-wrap:wrap}
.ab-cta{display:inline-flex;align-items:center;height:52px;padding:0 28px;border-radius:999px;background:#fff;color:#000;font-size:16px;font-weight:500;text-decoration:none}
.ab-cta:hover{background:#e6e6e6}
.ab-link{color:#cdcdcd;font-size:14px;text-decoration:underline;text-underline-offset:4px}
.ab-link:hover{color:#fff}
.ab-free{margin:14px 0 0;font-size:14px;color:#9a9a9a}
.ab-heroshot{margin:48px 0 0;border-radius:26px;border:1px solid rgba(255,255,255,.12);overflow:hidden;background:#141414}
.ab-heroshot img{display:block;width:100%;height:auto}
.ab-sec{padding:72px 0 0}
.ab-sh{margin:0;font-size:32px;font-weight:400;line-height:1.3;color:#fff;letter-spacing:-.01em}
.ab-ss{margin:10px 0 0;font-size:18px;color:#cdcdcd}
.ab-steps{display:grid;gap:20px;margin:32px 0 0}
.ab-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:32px;align-items:center;padding:28px;border-radius:26px;border:1px solid rgba(255,255,255,.16);background:#212121}
.ab-h{margin:20px 0 0;font-size:32px;line-height:1.25;font-weight:400;color:#fff;letter-spacing:-.01em}
.ab-card .ab-d{font-size:18px}
.ab-card .pl-items{margin:28px 0 0}
.ab-card .ab-link{display:inline-block;margin:28px 0 0}
.ab-shot{border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:#000}
.ab-shot img{display:block;width:100%;height:auto}
.ab .plans.pl-grid{margin:32px 0 0;max-width:none}
.ab-list{margin:28px 0 0;padding:0 24px;border-radius:26px;border:1px solid rgba(255,255,255,.16)}
.ab-row{display:grid;grid-template-columns:20px minmax(0,1fr);gap:16px;padding:20px 0;border-top:1px solid rgba(255,255,255,.1)}
.ab-row:first-child{border-top:0}
.ab-row svg{color:#cdcdcd;margin-top:2px}
.ab-row b{display:block;font-size:16px;font-weight:500;color:#fff}
.ab-row span{display:block;margin-top:4px;font-size:16px;line-height:1.55;color:#cdcdcd}
.ab-faq details{border-top:1px solid rgba(255,255,255,.1)}
.ab-faq details:first-child{border-top:0}
.ab-faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 0;font-size:16px;color:#fff}
.ab-faq summary::-webkit-details-marker{display:none}
.ab-faq summary::after{content:'';width:8px;height:8px;border-right:1.5px solid #9a9a9a;border-bottom:1.5px solid #9a9a9a;transform:rotate(45deg);margin-top:-4px;flex:none;transition:transform .15s}
.ab-faq details[open] summary::after{transform:rotate(-135deg);margin-top:4px}
.ab-faq p{margin:0 0 20px;font-size:16px;line-height:1.6;color:#cdcdcd}
.ab-faq a{color:#ececec}
.ab-final{max-width:none;padding:40px}
.ab-final .pl-cta{max-width:360px;margin-top:28px}
.ab-final .pl-d{min-height:0}
.ab-help{margin:32px 0 0;padding-top:20px;border-top:1px solid rgba(255,255,255,.1);font-size:14px;color:#9a9a9a}
.ab-help .ab-link{margin-left:6px}
@media (max-width:860px){
  .ab{padding:0 16px 32px}
  .ab-hero{padding:88px 0 16px}
  .ab-h1{font-size:32px}
  .ab-d,.ab-card .ab-d,.ab-ss{font-size:16px}
  .ab-sec{padding:56px 0 0}
  .ab-sh{font-size:28px}
  .ab-card{grid-template-columns:1fr;gap:20px;padding:22px 20px;border-radius:20px}
  .ab-h{font-size:26px;margin-top:14px}
  .ab-list{padding:0 18px;border-radius:20px}
  .ab-final{padding:24px 20px}
}
</style>`;
if(!h.includes('/* 소개 페이지 새 구성(ab)')) h=h.replace(/(<style id="sk-sub">[\s\S]*?)<\/style>/,'$1'+CSS);
fs.writeFileSync(F,h); console.log('ok');
