/* 24시간 고객센터 플로팅 위젯 (우측 하단)
   site-config.js의 zendeskKey가 채워지면 실제 Zendesk Web Widget을 로드해 연다.
   키가 없는 동안은 준비 안내 팝오버를 보여준다. */
(function(){
  "use strict";
  var css = ''+
    '#teth-help{position:fixed;right:20px;bottom:20px;z-index:120;display:flex;align-items:center;gap:8px;height:46px;padding:0 18px 0 14px;border-radius:999px;background:#3d6ef0;color:#fff;font-size:13.5px;font-weight:600;border:0;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.35);font-family:inherit;transition:transform .15s,box-shadow .15s}'+
    '#teth-help:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(61,110,240,.45)}'+
    '#teth-help svg{flex-shrink:0}'+
    '#teth-help-pop{position:fixed;right:20px;bottom:76px;z-index:120;width:272px;background:#1e1f24;color:#e6e7ea;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px;font-size:13px;line-height:1.65;box-shadow:0 16px 48px rgba(0,0,0,.5);display:none;font-family:inherit}'+
    '#teth-help-pop.on{display:block}'+
    '#teth-help-pop b{display:block;font-size:14px;margin-bottom:6px;color:#fff}'+
    '#teth-help-pop .sub{color:#9aa0a6;font-size:12px;margin-top:8px}'+
    '@media (max-width:640px){#teth-help{right:14px;bottom:14px;height:44px;font-size:13px}#teth-help-pop{right:14px;bottom:66px}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var btn = document.createElement('button');
  btn.id = 'teth-help'; btn.setAttribute('aria-label','24시간 고객센터');
  btn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13a8 8 0 0 1 16 0"/><rect x="2.5" y="12" width="4" height="7" rx="2"/><rect x="17.5" y="12" width="4" height="7" rx="2"/><path d="M20 18v1a3 3 0 0 1-3 3h-3"/></svg>24시간 고객센터';
  var pop = document.createElement('div');
  pop.id = 'teth-help-pop';
  pop.innerHTML = '<b>24시간 고객센터</b>무엇이든 물어보세요. 상담원이 연중무휴 24시간 대기하고 있어요.<div class="sub">Zendesk 채팅 연결 준비 중 · support@teth.ai</div>';
  document.body.appendChild(btn); document.body.appendChild(pop);

  btn.addEventListener('click', function(){
    var cfg = window.TETH_CONFIG || {};
    if (cfg.zendeskKey) {
      if (window.zE) { window.zE('webWidget','open'); return; }
      var s = document.createElement('script');
      s.id = 'ze-snippet';
      s.src = 'https://static.zdassets.com/ekr/snippet.js?key=' + encodeURIComponent(cfg.zendeskKey);
      s.onload = function(){ if (window.zE) window.zE('webWidget','open'); };
      document.body.appendChild(s);
      return;
    }
    pop.classList.toggle('on');
  });
  document.addEventListener('click', function(e){
    if (!pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) pop.classList.remove('on');
  });
})();
