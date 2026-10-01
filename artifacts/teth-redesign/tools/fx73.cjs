// 페이지 제목 줄 삭제(대화 화면 제외), 모바일 메뉴 단추는 아래로 스크롤하면 숨김, 터미널 스크롤바 숨김, 모바일 QA 단추 작게
const fs=require('fs');
fs.appendFileSync('sk-main.js',`

/* 왼쪽 위 페이지 제목 줄은 대화 화면에서만(대화 이름과 이름 바꾸기). 나머지 페이지는 지우고 내용을 위로 (파운더 2026-10-02) */
(function(){
  function sync(){ try{ document.body.classList.toggle('nochead',!(typeof G!=='undefined'&&G.cur&&G.mode!=='home')); }catch(e){} }
  if(typeof gChead==='function'){ var c0=gChead; gChead=function(){ var r=c0.apply(this,arguments); sync(); return r; }; }
  var last=null; setInterval(function(){ var k=(typeof G!=='undefined'?(G.mode+'|'+!!G.cur):''); if(k!==last){ last=k; sync(); } },300);
  sync();
})();
/* 모바일: 아래로 스크롤하면 메뉴 단추를 숨기고, 위로 올리면 다시 보인다(내용 위에 겹치지 않게) */
(function(){
  var lastY=0, sc=null;
  function on(){ var s=document.getElementById('g-scroll'); if(!s||s===sc) return; sc=s; lastY=s.scrollTop;
    s.addEventListener('scroll',function(){ if(window.innerWidth>860) return; var y=s.scrollTop; if(y>60&&y>lastY+4) document.body.classList.add('ham-hide'); else if(y<lastY-4||y<=60) document.body.classList.remove('ham-hide'); lastY=y; },{passive:true}); }
  setInterval(on,1000); on();
})();
`);
fs.appendFileSync('sk-main.css',`
/* 페이지 제목 줄: PC는 통째로 없애고, 모바일은 메뉴 단추 자리는 두고 글자만 지운다 */
@media (min-width:861px){ body.nochead #g-chead{display:none!important} }
@media (max-width:860px){ body.nochead #g-chead-title,body.nochead #g-chead-sub{visibility:hidden} }
@media (max-width:860px){ body.ham-hide #g-hamburger{opacity:0;pointer-events:none;transform:translateY(-8px)} #g-hamburger{transition:opacity .18s,transform .18s} }
`);
fs.appendFileSync('sk-mkt.css',`
/* 터미널 스크롤바 숨김(전역 스크롤바 규칙보다 우선): 포지션 탭 줄, 정보와 데이터 칸, 질문 단추 줄 */
.tft-page .nfxh-tabs,.tft-page .mkt-pane,.tft-page .tft-comp>div,.tft-page .nfxh-pane,.tft-page .tb-copy,.tft-page .tft-bbody{scrollbar-width:none!important;-ms-overflow-style:none}
.tft-page .nfxh-tabs::-webkit-scrollbar,.tft-page .mkt-pane::-webkit-scrollbar,.tft-page .tft-comp>div::-webkit-scrollbar,.tft-page .nfxh-pane::-webkit-scrollbar,.tft-page .tb-copy::-webkit-scrollbar,.tft-page .tft-bbody::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}
`);
fs.appendFileSync('sk-qa.css',`
/* 모바일 QA 단추: 내용과 겹치지 않게 작게 왼쪽 아래 구석 */
@media (max-width:860px){ #tf-devbtn{top:auto!important;bottom:14px!important;left:12px!important;right:auto!important;height:32px;padding:0 12px;font-size:12px;opacity:.85} #qa2-panel{bottom:56px!important;left:12px!important;right:12px!important} }
`);
console.log('ok');
