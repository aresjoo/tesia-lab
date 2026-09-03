/* 24시간 고객센터 플로팅 버튼 (우측 하단, 아이콘 온리)
   아이콘 = TETH 스파크가 헤드셋을 쓴 상담원 마크.
   site-config.js의 zendeskKey가 채워지면 클릭 시 실제 Zendesk Web Widget을 연다.
   키가 없는 동안은 준비 안내 팝오버를 보여준다. */
(function(){
  "use strict";
  /* 위젯 자체가 locale-aware — tethLang(localStorage)을 읽어 모든 문자열을 현재 언어로 */
  var HW_LANGS=['ko','en','ja','zh-CN','zh-TW','es','fr'];
  var HW={
    tip:['24/7 고객지원','24/7 Support','24時間サポート','24/7客服支持','24/7客服支援','Soporte 24/7','Assistance 24h/24'],
    body:['무엇이든 물어보세요. 상담원이 연중무휴 24시간 대기하고 있어요.','Ask us anything. Our agents are available around the clock.','何でもお尋ねください。担当者が24時間365日対応します。','有任何问题都可以咨询，客服全年无休24小时在线。','有任何問題都可以諮詢，客服全年無休24小時在線。','Pregúntanos lo que sea. Nuestro equipo está disponible 24/7.','Posez-nous vos questions. Notre équipe est disponible 24h/24, 7j/7.'],
    sub:['실시간 채팅은 곧 제공돼요. support@teth.ai','Live chat coming soon. support@teth.ai','ライブチャットは近日提供予定です。support@teth.ai','在线聊天即将上线。support@teth.ai','線上聊天即將上線。support@teth.ai','El chat en vivo llegará pronto. support@teth.ai','Le chat en direct arrive bientôt. support@teth.ai']
  };
  var hwIdx=0; try{ hwIdx=HW_LANGS.indexOf(localStorage.getItem('tethLang')||'ko'); }catch(e){}
  if(hwIdx<0) hwIdx=0;
  function hwT(k){ return HW[k][hwIdx]||HW[k][0]; }
  var css = ''+
    '#teth-help{position:fixed;right:22px;bottom:22px;z-index:60;width:54px;height:54px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:linear-gradient(160deg,#26282e,#141519);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.45);transition:transform .16s cubic-bezier(.2,0,0,1),box-shadow .16s,border-color .16s;padding:0}'+
    '#teth-help:hover{transform:translateY(-3px) scale(1.04);border-color:rgba(140,165,255,.45);box-shadow:0 14px 36px rgba(0,0,0,.55)}'+
    '#teth-help svg{display:block}'+
    '#teth-help .tip{position:absolute;right:64px;top:50%;transform:translateY(-50%);background:#eceef2;color:#17181b;font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:999px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s;box-shadow:0 4px 16px rgba(0,0,0,.35);font-family:inherit}'+
    '#teth-help:hover .tip{opacity:1}'+
    '#teth-help .dot{position:absolute;top:3px;right:3px;width:11px;height:11px;border-radius:50%;background:#2bd97c;border:2px solid #141519}'+
    '#teth-help-pop{position:fixed;right:22px;bottom:86px;z-index:60;width:280px;background:#1e1f24;color:#e6e7ea;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:18px 20px;font-size:13px;line-height:1.65;box-shadow:0 16px 48px rgba(0,0,0,.5);display:none;font-family:inherit}'+
    '#teth-help-pop.on{display:block}'+
    '#teth-help-pop b{display:flex;align-items:center;gap:7px;font-size:14px;margin-bottom:6px;color:#fff}'+
    '#teth-help-pop b i{font-style:normal;width:8px;height:8px;border-radius:50%;background:#2bd97c}'+
    '#teth-help-pop .sub{color:#9aa0a6;font-size:12px;margin-top:8px}'+
    '@media (max-width:640px){#teth-help{right:14px;bottom:14px;width:50px;height:50px}#teth-help-pop{right:14px;bottom:76px}#teth-help .tip{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* 로고 경로: 이 스크립트 src 기준으로 계산 → 어느 페이지에서 로드돼도 안전 */
  var hwBase='';
  try{
    var hs=document.querySelector('script[src*="help-widget"]');
    if(hs) hwBase=hs.getAttribute('src').replace(/help-widget[^/]*$/,'');
  }catch(e){}
  var btn = document.createElement('button');
  btn.id = 'teth-help'; btn.setAttribute('aria-label',hwT('tip'));
  btn.innerHTML =
    '<img src="'+hwBase+'assets/logo.png" alt="" style="width:30px;height:auto;display:block">'+
    '<span class="dot"></span>'+
    '<span class="tip">'+hwT('tip')+'</span>';
  var pop = document.createElement('div');
  pop.id = 'teth-help-pop';
  pop.innerHTML = '<b><i></i>'+hwT('tip')+'</b>'+hwT('body')+'<div class="sub">'+hwT('sub')+'</div>';
  document.body.appendChild(btn); document.body.appendChild(pop);

  btn.addEventListener('click', function(e){
    e.stopPropagation();
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
    if (!pop.contains(e.target) && !btn.contains(e.target)) pop.classList.remove('on');
  });
})();
