/* TETH 사이트 푸터. 단일 출처: index.html(SPA) 과 about/, policies/, download/ 가 함께 쓴다.
   TETH_FOOTER.html({spa:true}) 는 SPA 액션(onclick), {base:'../'} 는 독립 페이지용 href. mount(el, opts) 는 CSS 주입 + 삽입. */
(function(){
  var CSS = ".gft{container-type:inline-size;margin-top:48px;background:#c8f43c;color:#0c0d0f;word-break:keep-all;overflow-wrap:anywhere}\n.gft-in{padding:64px 40px 28px}\n.gft-top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px 56px}\n.gft-cols{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}\n.gft-col h3{margin:0 0 14px;font-size:13px;font-weight:700;line-height:1.4;color:#0c0d0f}\n.gft-col a,.gft-col button{display:block;width:fit-content;margin:0 0 10px;padding:0;background:none;border:0;font:inherit;font-size:14px;line-height:1.5;color:#0c0d0f;text-decoration:none;text-align:left;cursor:pointer}\n.gft-col a:hover,.gft-col button:hover{text-decoration:underline;text-underline-offset:3px}\n.gft a:focus-visible,.gft button:focus-visible{outline:2px solid #0c0d0f;outline-offset:3px;border-radius:2px}\n.gft-copy p{margin:0 0 12px;font-size:13.5px;line-height:1.7;color:#0c0d0f}\n.gft-copy .dim{color:#39441a}\n.gft-pw{display:flex;align-items:center;gap:8px;margin-top:72px;font-size:15px;color:#39441a}\n.gft-pw img{width:22px;height:22px;border-radius:6px;box-shadow:0 0 0 1px rgba(12,13,15,.55)}\n.gft-pw b{font-weight:700;color:#0c0d0f}\n.gft-wm{display:block;width:100%;height:auto;margin-top:14px;fill:#0c0d0f}\n@container (max-width:900px){\n  .gft-top{grid-template-columns:minmax(0,1fr)}\n  .gft-cols{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:28px}\n}\n@container (max-width:600px){\n  .gft-in{padding:48px 20px 20px}\n  .gft-pw{margin-top:44px}\n  .gft-col h3{margin-bottom:4px}\n  .gft-col a,.gft-col button{display:flex;align-items:center;min-height:44px;margin:0}\n}";
  var WM = 'M0 0h1000v240h-1000zM350 0h300v1000h-300zM1070 0h300v1000h-300zM1070 0h760v240h-760zM1070 390h700v220h-700zM1070 760h760v240h-760zM1900 0h1000v240h-1000zM2250 0h300v1000h-300zM2970 0h300v1000h-300zM3670 0h300v1000h-300zM2970 390h1000v220h-1000z';
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function link(spa, base, label, spaAct, href, blank){
    if(spa && spaAct) return '<button type="button" onclick="'+spaAct+'">'+esc(label)+'</button>';
    return '<a href="'+(href.indexOf('http')===0||href.charAt(0)==='#'?href:base+href)+'"'+(blank?' target="_blank" rel="noopener noreferrer"':'')+'>'+esc(label)+'</a>';
  }
  function col(h, items){ return '<div class="gft-col"><h3>'+h+'</h3>'+items.join('')+'</div>'; }
  function html(opts){
    opts = opts || {}; var spa = !!opts.spa, base = spa ? '' : (opts.base || '');
    var help = spa ? 'event.stopPropagation();tfTxHelp()' : 'event.stopPropagation();if(window.tethHelpOpen){window.tethHelpOpen();}else{location.href=\''+base+'index.html#/trade\';}';
    return '<footer class="gft" aria-label="사이트 정보"><div class="gft-in"><div class="gft-top">'
      +'<nav class="gft-cols" aria-label="바닥글 메뉴">'
      +col('제품',[link(spa,base,'AI 트레이딩',"tfNav('#/trade')",'index.html#/trade'),link(spa,base,'전략 따라하기',"tfShareHub('find')",'index.html#/trade'),link(spa,base,'새 전략 만들기','gHome()','index.html'),link(spa,base,'거래소 연결','tfBrokersView()','index.html#/trade')])
      +col('회사',[link(spa,base,'TETH 정보',null,'about/'),link(spa,base,'앱 다운로드',null,'download/',true)])
      +col('도움',['<button type="button" onclick="'+help+'">24시간 상담</button>',link(spa,base,'인사이트',"tfNav('#/insight')",'index.html#/insight'),link(spa,base,'이용 현황',"tfNav('#/plan')",'index.html#/plan')])
      +col('약관',[link(spa,base,'서비스 약관',null,'policies/#terms',true),link(spa,base,'개인정보처리방침',null,'policies/#privacy',true)])
      +'</nav><div class="gft-copy">'
      +'<p>밤새 차트를 보는 대신, 말로 정한 전략을 AI가 대신 판단하고 실행해요. 주식, 옵션, 암호화폐까지 Bitget 계정 하나로 24시간 시장을 지켜보고, 사고팔 때마다 왜 그랬는지 기록으로 남겨요.</p>'
      +'<p><b>Bitget이 선정한 최고의 AI입니다.</b></p>'
      +'<p class="dim">돈은 내 거래소에 그대로 두고, TETH는 사고팔 권한만 받아요. 한도는 내가 정하고, 멈추는 버튼은 늘 내 손에 있어요.</p>'
      +'<p class="dim">© 2026 TETH AI. 모든 권리 보유.</p></div></div>'
      +'<div class="gft-pw">Powered by <img src="'+base+'assets/logos/bitget-512.png" alt="" width="22" height="22" loading="lazy"><b>Bitget</b></div>'
      +'<svg class="gft-wm" viewBox="0 0 3970 1000" role="img" aria-label="TETH"><path d="'+WM+'"/></svg>'
      +'</div></footer>';
  }
  function ensureCss(){ if(document.getElementById('teth-footer-css')) return; var st=document.createElement('style'); st.id='teth-footer-css'; st.textContent=CSS; document.head.appendChild(st); }
  function mount(el, opts){ ensureCss(); if(el){ el.outerHTML = html(opts); } }
  window.TETH_FOOTER = { html: function(o){ ensureCss(); return html(o); }, mount: mount, css: CSS };
  if(document.readyState!=='loading') ensureCss(); else document.addEventListener('DOMContentLoaded', ensureCss);
})();
