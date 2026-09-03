/* TETH 공용 테마 로더 — 앱에서 고른 테마(tethTheme: system|light|dark)를 모든 페이지가 따른다.
   시스템 테마 변화와 다른 탭에서의 변경(storage 이벤트)도 실시간 반영. */
(function(){
  "use strict";
  function isDark(t){
    if(t==='dark') return true;
    if(t==='light') return false;
    try{ return !matchMedia('(prefers-color-scheme: light)').matches; }catch(e){ return true; }
  }
  function apply(){
    var t='system';
    try{ t=localStorage.getItem('tethTheme')||'system'; }catch(e){}
    document.body.classList.toggle('light', !isDark(t));
  }
  apply();
  try{ matchMedia('(prefers-color-scheme: light)').addEventListener('change',apply); }catch(e){}
  window.addEventListener('storage',function(ev){ if(ev.key==='tethTheme') apply(); });
})();
