// 정책 페이지를 플랜 화면 문법으로: 소개와 같은 머리, 알약 탭, #212121 카드, 파란색 삽화 대신 요점 카드, 합니다체
const fs=require('fs');
const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/policies/index.html';
let h=fs.readFileSync(F,'utf8');
const cut=(a,b,rep)=>{ const i=h.indexOf(a), j=h.indexOf(b,i); if(i<0||j<0) throw new Error('miss '+a.slice(0,40)); h=h.slice(0,i)+rep+h.slice(j+b.length); };
const rep=(a,b)=>{ if(!h.includes(a)) throw new Error('miss '+a.slice(0,50)); h=h.split(a).join(b); };
const CSS=`<style>
/* 정책: 플랜 화면과 같은 문법(48/32px 400 제목, 흰 알약 버튼, #212121 카드 반경 26, 색은 쓰지 않음) */
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#cdcdcd;font-family:'Noto Sans KR',-apple-system,system-ui,sans-serif;font-size:16px;line-height:1.7;-webkit-font-smoothing:antialiased;word-break:keep-all}
a{color:inherit;text-decoration:none}
img,svg{display:block}
.hd{position:fixed;top:0;left:0;right:0;z-index:50;height:74px;display:flex;align-items:center;gap:34px;padding:0 28px;background:#000;color:#fff}
.hd .brand{display:flex;align-items:center;gap:9px;font-size:20px;font-weight:700}
.hd nav{display:flex;gap:6px}
.hd nav a{font-size:16px;padding:10px 16px;border-radius:999px;color:#cdcdcd;transition:background .15s}
.hd nav a:hover{background:rgba(255,255,255,.08);color:#fff}
.hd .sp{flex:1}
.hd .cta{display:inline-flex;align-items:center;height:40px;padding:0 20px;border-radius:999px;background:#fff;color:#000;font-size:14px;font-weight:500;white-space:nowrap}
.hd .cta:hover{background:#e6e6e6}
main{padding-top:74px;min-height:70vh}
.pg-top{max-width:1080px;margin:0 auto;padding:48px 24px 0}
.pg-lb{font-size:20px;font-weight:600;color:#fff}
.pg-h1{margin:14px 0 0;font-size:48px;line-height:1.2;font-weight:400;letter-spacing:-.015em;color:#fff}
.tabs{display:inline-flex;gap:4px;padding:4px;border-radius:999px;border:1px solid rgba(255,255,255,.16);margin:28px 0 0;max-width:100%;overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tabs a{display:inline-flex;align-items:center;height:36px;padding:0 16px;border-radius:999px;font-size:14px;color:#9a9a9a;white-space:nowrap}
.tabs a:hover{color:#fff}
.tabs a.on{background:#303030;color:#fff}
.tabs a:focus-visible,.toc a:focus-visible{outline:2px solid #fff;outline-offset:2px}
.view{display:none}
.view.on{display:block}
/* 개요 카드 */
.ov{max-width:1080px;margin:0 auto;padding:40px 24px 88px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.ov .cell{padding:28px;border-radius:26px;border:1px solid rgba(255,255,255,.16);background:#212121}
.ov .cell h2{font-size:24px;font-weight:400;line-height:1.35;color:#fff}
.ov .cell p{margin-top:14px;color:#cdcdcd}
.ov .cell .ico-row{display:grid;grid-template-columns:24px minmax(0,1fr);gap:16px;margin-top:14px}
.ov .cell .ico-row svg{width:24px;height:24px;stroke:#cdcdcd;margin-top:4px}
.ov .cell .ico-row p{margin-top:0}
.ov .cell .lnk-row{margin-top:20px}
a.lnk,.faqv a,.meta a{color:#ececec;text-decoration:underline;text-underline-offset:4px}
a.lnk:hover{color:#fff}
/* 문서 */
.doc{max-width:1080px;margin:0 auto;display:flex;gap:56px;padding:40px 24px 88px}
.toc{width:232px;flex-shrink:0;position:sticky;top:98px;align-self:flex-start}
.toc a{display:block;font-size:14px;line-height:1.5;padding:10px 14px;border-radius:12px;color:#9a9a9a;transition:background .12s}
.toc a:hover{color:#fff}
.toc a.on{background:#212121;color:#fff}
.docmain{flex:1;min-width:0;max-width:720px}
.docmain .inner{max-width:720px}
.sum{padding:0 24px;border-radius:26px;border:1px solid rgba(255,255,255,.16);background:#212121;margin:0 0 40px}
.sum-row{display:grid;grid-template-columns:20px minmax(0,1fr);gap:16px;padding:20px 0;border-top:1px solid rgba(255,255,255,.1)}
.sum-row:first-child{border-top:0}
.sum-row svg{color:#cdcdcd;margin-top:3px}
.sum-row b{display:block;font-size:16px;font-weight:500;color:#fff;line-height:1.5}
.sum-row span{display:block;margin-top:4px;font-size:15px;line-height:1.55;color:#cdcdcd}
.label{font-size:14px;color:#9a9a9a}
.intro{font-size:22px;font-weight:400;line-height:1.55;color:#fff;margin-top:10px}
.docmain p{margin-top:16px}
.docmain h2{font-size:28px;font-weight:400;line-height:1.35;color:#fff;margin-top:56px;letter-spacing:-.01em}
.docmain b{color:#ececec;font-weight:500}
.docmain ul{margin:14px 0 0 20px}
.docmain li{margin-top:10px}
.callout{display:grid;grid-template-columns:24px minmax(0,1fr);gap:16px;margin-top:28px;padding:20px 24px;border-radius:20px;border:1px solid rgba(255,255,255,.16)}
.callout svg{width:24px;height:24px;stroke:#cdcdcd}
.callout b{display:block;font-weight:500;color:#fff}
.callout .lnk{display:inline-block;margin-top:6px}
.meta{margin-top:28px;font-size:14px;color:#9a9a9a}
.hr{border-top:1px solid rgba(255,255,255,.1);margin:48px 0 0}
/* 자주 묻는 질문 */
.faqv{max-width:1080px;margin:0 auto;padding:40px 24px 88px}
.faqv .inner{max-width:760px;padding:0 24px;border-radius:26px;border:1px solid rgba(255,255,255,.16)}
.faqv h2{font-size:18px;font-weight:500;line-height:1.5;color:#fff;padding-top:24px;border-top:1px solid rgba(255,255,255,.1)}
.faqv h2:first-child{border-top:0}
.faqv p{margin-top:10px;color:#cdcdcd}
.faqv p+h2{margin-top:24px}
.faqv .inner>p:last-child{padding-bottom:24px}
@media (max-width:960px){
  .hd{height:64px;padding:0 16px}
  .hd nav{display:none}
  main{padding-top:64px}
  .pg-top{padding:32px 16px 0}
  .pg-h1{font-size:32px}
  .ov{grid-template-columns:1fr;gap:14px;padding:28px 16px 64px}
  .ov .cell{padding:22px 20px;border-radius:20px}
  .ov .cell h2{font-size:22px}
  .doc{padding:28px 16px 64px}
  .toc{display:none}
  .sum{padding:0 18px;border-radius:20px}
  .docmain h2{font-size:24px;margin-top:44px}
  .intro{font-size:19px}
  .faqv{padding:28px 16px 64px}
  .faqv .inner{padding:0 18px;border-radius:20px}
}
@media (prefers-reduced-motion:reduce){*{transition-duration:.01s!important}}
</style>`;
cut('<style>','</style>',CSS);
/* 머리: 소개와 같은 구성, 페이지 제목과 알약 탭은 본문 위로 */
cut('<header class="hd">','</header>',`<header class="hd">
  <a class="brand" href="../" style="color:#00f0ff"><img src="../assets/logo.png?v=3" alt="" style="width:22px;height:auto">TETH</a>
  <nav><a href="../about/">TETH 정보</a><a href="../download/">앱 다운로드</a></nav>
  <span class="sp"></span>
  <a class="cta" href="../">시작하기</a>
</header>`);
rep('<main>\r\n','<main>\r\n<div class="pg-top">\r\n  <span class="pg-lb">TETH</span>\r\n  <h1 class="pg-h1">개인정보 보호와 약관</h1>\r\n  <nav class="tabs" id="tabs">\r\n    <a href="#overview" data-v="overview">개요</a>\r\n    <a href="#privacy" data-v="privacy">개인정보처리방침</a>\r\n    <a href="#terms" data-v="terms">서비스 약관</a>\r\n    <a href="#technologies" data-v="technologies">기술</a>\r\n    <a href="#faq" data-v="faq">자주 묻는 질문</a>\r\n  </nav>\r\n</div>\r\n');
/* 파란 삽화 대신 요점 카드 */
const IC={lock:'<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',unlink:'<path d="M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1"/>',doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',block:'<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',pause:'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'};
const I=k=>'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+IC[k]+'</svg>';
const row=(k,b,s)=>'<div class="sum-row">'+I(k)+'<div><b>'+b+'</b><span>'+s+'</span></div></div>';
const SUMP='<div class="sum">'+row('lock','출금 권한은 요청하지 않습니다','잔고 조회와 주문 권한으로만 거래소에 연결합니다.')+row('unlink','연결은 언제든 해제합니다','해제하면 저장된 연결 정보를 바로 파기합니다.')+row('doc','기록은 직접 관리합니다','전략, 백테스트, 거래 기록을 언제든 내보내고 삭제합니다.')+row('block','광고 목적으로 판매하지 않습니다','수집한 정보는 서비스를 제공하는 데만 씁니다.')+'</div>';
const SUMT='<div class="sum">'+row('check','시작은 직접 승인합니다','전략은 승인한 경우에만 연결한 거래소에서 실행합니다.')+row('pause','언제든 멈춥니다','실행 중에도 일시정지와 종료를 바로 할 수 있습니다.')+row('doc','판단 근거를 남깁니다','거래마다 판단 근거를 기록해 다시 볼 수 있습니다.')+'</div>';
let k=0;
h=h.replace(/<div class="hero-ill">[\s\S]*?<\/svg>\s*<\/div>/g,()=>(k++===0?SUMP:SUMT));
if(k!==2) throw new Error('hero-ill '+k);
/* 문장 끝을 합니다체로 */
[['자세히 알아보세요.','자세히 알아봅니다.'],['안전하게 보호하세요.','안전하게 보호합니다.'],['참고하세요.','참고합니다.'],['확인하려고 하나요?','확인하려고 합니까?'],
 ['안전하게 보호하나요?','안전하게 보호합니까?'],['접근할 수 있나요?','접근할 수 있습니까?'],['믿어도 되나요?','믿어도 됩니까?'],['어떻게 하나요?','어떻게 합니까?'],['어떻게 알 수 있나요?','어떻게 알 수 있습니까?'],
 ['TETH는 홀드아웃 봉인과 Paper 검증 단계를 통해 과최적화를 줄이지만','TETH는 검증 기간을 나눠 과최적화를 줄이지만'],
 ['<title>개인정보 보호 및 약관 – TETH</title>','<title>개인정보 보호와 약관 | TETH</title>']
].forEach(p=>{ if(h.includes(p[0])) h=h.split(p[0]).join(p[1]); else console.log('skip',p[0]); });
/* 문서 스크롤 위치: 머리 74px 기준 */
rep('scrollY-116','scrollY-96');
fs.writeFileSync(F,h); console.log('ok');
