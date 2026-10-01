// 다운로드 페이지 전체를 플랜 화면 문법으로 다시 짠다: 소개와 같은 머리, 흰 알약 버튼, #212121 카드, 실제 모바일 화면 3장과 대화/검증/실행 탭
const fs=require('fs');
const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/download/index.html';
let h=fs.readFileSync(F,'utf8');
const cut=(a,b,rep)=>{ const i=h.indexOf(a), j=h.indexOf(b,i); if(i<0||j<0) throw new Error('miss '+a); h=h.slice(0,i)+rep+h.slice(j+b.length); };
const CSS=`<style>
/* 앱 다운로드: 플랜 화면과 같은 문법(32/48px 400 제목, 흰 알약 버튼, #212121 카드 반경 26) */
*{margin:0;padding:0;box-sizing:border-box}
html,body{min-height:100%}
body{background:#000;color:#ececec;font-family:'Noto Sans KR',-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased;word-break:keep-all}
a{color:inherit;text-decoration:none}
button{font-family:inherit;border:0;background:none;cursor:pointer;color:inherit}
img,svg{display:block}
.hd{position:fixed;top:0;left:0;right:0;z-index:50;height:74px;display:flex;align-items:center;gap:34px;padding:0 28px;background:#000;color:#fff}
.hd .brand{display:flex;align-items:center;gap:9px;font-size:20px;font-weight:700}
.hd nav{display:flex;gap:6px}
.hd nav a{font-size:16px;padding:10px 16px;border-radius:999px;color:#cdcdcd;transition:background .15s}
.hd nav a:hover{background:rgba(255,255,255,.08);color:#fff}
.hd nav a[aria-current]{color:#fff}
.hd .sp{flex:1}
.hd .cta{display:inline-flex;align-items:center;height:40px;padding:0 20px;border-radius:999px;background:#fff;color:#000;font-size:14px;font-weight:500}
.hd .cta:hover{background:#e6e6e6}
.dl{max-width:1080px;margin:0 auto;padding:128px 24px 88px;display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:56px;align-items:center}
.pl-lb{font-size:20px;font-weight:600;color:#fff}
.dl-h1{margin:14px 0 0;font-size:48px;line-height:1.2;font-weight:400;letter-spacing:-.015em;color:#fff}
.dl-d{margin:16px 0 0;font-size:18px;line-height:1.6;color:#cdcdcd;max-width:520px}
.dl-stores{margin:36px 0 0;padding:0 24px;border-radius:26px;border:1px solid rgba(255,255,255,.16);background:#212121;max-width:520px}
.store{display:grid;grid-template-columns:28px minmax(0,1fr) 96px;gap:16px;align-items:center;padding:20px 0;border-top:1px solid rgba(255,255,255,.1)}
.store:first-child{border-top:0}
.store>svg{width:28px;height:28px}
.store b{display:block;font-size:16px;font-weight:500;color:#fff}
.store span{display:block;margin-top:4px;font-size:14px;line-height:1.5;color:#b4b4b4}
.store .qr{width:96px;height:96px;background:#fff;border-radius:12px;padding:6px}
.store .qr img{width:100%;height:100%}
.store .qr.todo{background:#141414;border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;text-align:center;color:#9a9a9a;font-size:12px;line-height:1.5;padding:8px}
.store .link{grid-column:2;margin-top:-8px;font-size:14px;color:#cdcdcd;text-decoration:underline;text-underline-offset:4px}
.dl-acts{display:flex;align-items:center;gap:24px;margin:32px 0 0;flex-wrap:wrap}
.dl-cta{display:inline-flex;align-items:center;height:52px;padding:0 28px;border-radius:999px;background:#fff;color:#000;font-size:16px;font-weight:500}
.dl-cta:hover{background:#e6e6e6}
.dl-free{font-size:14px;color:#9a9a9a}
.visual{display:flex;flex-direction:column;align-items:center}
.tabs{display:inline-flex;gap:4px;padding:4px;border-radius:999px;border:1px solid rgba(255,255,255,.16);margin:0 0 20px}
.tabs button{height:36px;padding:0 18px;border-radius:999px;font-size:14px;color:#9a9a9a}
.tabs button:hover{color:#fff}
.tabs button[aria-selected=true]{background:#303030;color:#fff}
.tabs button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.stage{display:grid;width:100%;justify-items:center}
.slide{grid-area:1/1;display:flex;flex-direction:column;align-items:center;opacity:0;transition:opacity .4s ease;pointer-events:none}
.slide.on{opacity:1;pointer-events:auto}
.dev{width:300px;height:600px;border-radius:44px;border:1px solid rgba(255,255,255,.16);background:#141414;padding:10px;overflow:hidden}
.dev .scr{height:100%;border-radius:34px;overflow:hidden;background:#000}
.dev img{width:100%;height:auto}
.slide p{margin:20px 0 0;font-size:16px;line-height:1.55;color:#cdcdcd;text-align:center;max-width:320px}
@media (max-width:900px){
  .hd{height:64px;padding:0 16px}
  .hd nav{display:none}
  .dl{grid-template-columns:1fr;gap:48px;padding:96px 16px 56px}
  .dl-h1{font-size:32px}
  .dl-d{font-size:16px}
  .dl-stores{padding:0 18px;border-radius:20px}
  .store{grid-template-columns:24px minmax(0,1fr) 84px;gap:14px}
  .store .qr{width:84px;height:84px}
  .dev{width:272px;height:544px}
}
@media (prefers-reduced-motion:reduce){*{transition-duration:.01s!important}}
</style>`;
cut('<style>','</style>',CSS);
const PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#34A853" d="M3.6 2.2 13.7 12 3.6 21.8c-.4-.2-.6-.6-.6-1.2V3.4c0-.6.2-1 .6-1.2z"/><path fill="#FBBC05" d="m13.7 12 3.2 3.1-3.9 2.2-6.5 3.7c-.3.2-.6.2-.9.1z"/><path fill="#EA4335" d="M13.7 12 5.6 2.9c.3-.1.6-.1.9.1l6.5 3.7 3.9 2.2z"/><path fill="#4285F4" d="m16.9 8.9 3.4 1.9c.9.5.9 1.9 0 2.4l-3.4 1.9L13.7 12z"/></svg>';
const APPLE='<svg viewBox="0 0 24 24" fill="#ececec" aria-hidden="true"><path d="M17.05 12.54c-.03-2.72 2.22-4.02 2.32-4.09-1.27-1.85-3.24-2.1-3.93-2.13-1.67-.17-3.26.98-4.1.98-.85 0-2.16-.96-3.55-.93-1.82.03-3.5 1.06-4.44 2.69-1.9 3.29-.49 8.16 1.36 10.83.9 1.3 1.98 2.77 3.39 2.72 1.36-.05 1.87-.88 3.52-.88 1.64 0 2.11.88 3.55.85 1.47-.02 2.4-1.33 3.29-2.64 1.04-1.52 1.47-2.99 1.49-3.06-.03-.02-2.86-1.1-2.9-4.34zM14.34 4.56c.75-.91 1.25-2.17 1.11-3.43-1.08.04-2.38.72-3.15 1.63-.69.8-1.3 2.09-1.14 3.32 1.2.09 2.43-.61 3.18-1.52z"/></svg>';
const slide=(on,img,alt,cap)=>'<div class="slide'+(on?' on':'')+'" role="tabpanel"><div class="dev"><div class="scr"><img src="../assets/shots/v2/'+img+'" width="780" height="1688"'+(on?'':' loading="lazy"')+' alt="'+alt+'"></div></div><p>'+cap+'</p></div>';
const BODY=`<header class="hd">
  <a class="brand" href="../" style="color:#00f0ff"><img src="../assets/logo.png?v=3" alt="" style="width:22px;height:auto">TETH</a>
  <nav><a href="../about/" data-i="navAbout">TETH 정보</a><a href="./" aria-current="page" data-i="navDl">앱 다운로드</a></nav>
  <span class="sp"></span>
  <a class="cta" href="../" data-i="login">시작하기</a>
</header>

<main class="dl">
  <div class="txt">
    <span class="pl-lb">TETH 앱</span>
    <h1 class="dl-h1">휴대전화에서도 그대로</h1>
    <p class="dl-d">대화로 전략을 만들고, 백테스트 결과를 보고, 터미널의 판단 기록을 휴대전화에서 이어서 확인합니다.</p>
    <div class="dl-stores">
      <div class="store" id="store-android">${PLAY}<div><b>Google Play</b><span>휴대전화 카메라로 스캔해 설치합니다</span></div><div class="qr" data-store="android"></div></div>
      <div class="store" id="store-ios">${APPLE}<div><b>App Store</b><span>휴대전화 카메라로 스캔해 설치합니다</span></div><div class="qr" data-store="ios"></div></div>
    </div>
    <div class="dl-acts"><a class="dl-cta" href="../">웹에서 바로 시작하기</a><span class="dl-free">영원히 무료, 카드 등록 없음</span></div>
  </div>
  <div class="visual">
    <div class="tabs" role="tablist" id="tabs"><button role="tab" aria-selected="true">대화</button><button role="tab" aria-selected="false">검증</button><button role="tab" aria-selected="false">실행</button></div>
    <div class="stage" id="stage">
      ${slide(1,'dl-chat.webp','TETH 모바일 대화 화면, 전략 카드','말하면 진입, 청산, 손절 조건이 정해진 전략 카드로 정리합니다.')}
      ${slide(0,'dl-report.webp','TETH 모바일 백테스트 결과 화면','실제 시장 데이터로 돌린 결과를 수익률과 내려간 폭으로 봅니다.')}
      ${slide(0,'dl-live.webp','TETH 모바일 터미널 판단 패널','보유 종목과 TETH의 생각, 판단 기록을 24시간 남깁니다.')}
    </div>
  </div>
</main>`;
cut('<header class="hd">','</main>',BODY);
const CAR=`/* 대화, 검증, 실행 탭: 6초마다 넘기고, 누르면 자동 넘김을 멈춘다 */
var slides=[].slice.call(document.querySelectorAll('.slide')),tabs=[].slice.call(document.querySelectorAll('#tabs button')),cur=0,auto=null;
function show(i){
  cur=(i+slides.length)%slides.length;
  slides.forEach(function(s,k){s.classList.toggle('on',k===cur);});
  tabs.forEach(function(t,k){t.setAttribute('aria-selected',k===cur?'true':'false');t.tabIndex=k===cur?0:-1;});
}
tabs.forEach(function(t,k){
  t.addEventListener('click',function(){ clearInterval(auto); show(k); });
  t.addEventListener('keydown',function(e){ if(e.key==='ArrowRight'||e.key==='ArrowLeft'){ e.preventDefault(); clearInterval(auto); show(cur+(e.key==='ArrowRight'?1:-1)); tabs[cur].focus(); } });
});
show(0);
if(!matchMedia('(prefers-reduced-motion: reduce)').matches) auto=setInterval(function(){show(cur+1);},6000);

`;
cut('/* carousel */','/* QR',CAR+'/* QR');
h=h.replace("q.textContent='출시 준비 중\\n곧 만나요';","q.textContent='출시 준비 중입니다';");
h=h.replace('<title>TETH 앱 다운로드</title>','<title>TETH 앱 다운로드</title>');
fs.writeFileSync(F,h); console.log('ok', h.includes('출시 준비 중입니다'));
