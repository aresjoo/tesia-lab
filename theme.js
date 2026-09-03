/* TETH 공용 테마 — 서비스는 다크 단일 테마 (테마 선택 기능 제거됨) */
(function(){
  "use strict";
  document.body.classList.remove('light');
  try{ localStorage.setItem('tethTheme','dark'); }catch(e){}
})();
