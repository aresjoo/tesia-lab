/* ═══ 전략 복사 상세 카피 (sk-detail) ═══
   요소는 그대로 두고 글자만 바꾼다. 탭 전환, 기간 변경처럼 부분만 다시 그려도 적용되게 #g-content 를 지켜본다.
   교체는 여러 번 적용해도 결과가 같게(멱등) 짠다. 코인 이름은 전략 이름처럼 심볼로(skSym). */
var SKD_EXACT={'★ 즐겨찾기':'즐겨찾기','정보':'전략 정보','수익금':'손익','현재 판단':'현재 포지션','거래내역':'거래 내역',
  '구분':'거래 유형','시간':'체결 시각','가격':'체결가','실행 거래소':'운용 거래소','등록':'등록자','선물 롱/숏 2배':'선물, 롱과 숏, 레버리지 2배'};
function skdDate(y,m,d){ return y+'. '+(+m)+'. '+(+d)+'.'; }
var SKD_RE=[
  [/니입니다/g,'니다'],
  [/반대 방향 신호가 나오면 닫고 방향을 바꿉니다/g,'반대 신호가 나오면 청산하고 방향을 바꿉니다'],
  [/에서 25% 되돌리면 닫습니다/g,'에서 25% 되돌아오면 청산합니다'],
  [/불리하게 움직이면 닫습니다/g,'불리하게 움직이면 청산합니다'],
  [/반대 방향 신호가 나와 포지션을 닫았습니다/g,'반대 신호가 나와 포지션을 청산했습니다'],
  [/넣은 돈 기준 손익은/g,'투입 금액 대비 손익은'],
  [/넣은 돈 기준/g,'투입 금액 대비'],
  [/^@(\S+) 등록$/,'등록자 @$1'],
  [/^최소 (\$[0-9,]+)$/,'최소 운용 금액 $1'],
  [/^(\d{4})\.(\d{2})\.(\d{2}) 시작$/,function(_,y,m,d){ return '시작일 '+skdDate(y,m,d); }],
  [/^(\d{4})\.(\d{2})\.(\d{2}) 시작 이후 ([+-][0-9.,]+%)$/,function(_,y,m,d,v){ return y+'년 '+(+m)+'월 '+(+d)+'일부터 누적 수익률은 '+v+'입니다.'; }],
  [/^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}:\d{2})$/,function(_,y,m,d,t){ return skdDate(y,m,d)+' '+t; }],
  [/손익은 [A-Z]{2,6}(\s*)$/,'손익은$1'],
  [/^(\s*)가장 유리했던(\s*)$/,'$1진입 후 가장 유리했던$2'],
  [/([.。] )가장 유리했던(\s*)$/,'$1진입 후 가장 유리했던$2'],
  [/가에서 (\d+)% 불리하게 움직이면 청산합니다/g,'가 대비 $1% 손실 방향으로 움직이면 청산합니다'],
  [/ ?손실은 포지션에 넣은 증거금으로 한정됩니다\./g,''],
  [/(^\s*|\. )[A-Z]{2,6}, (\d+일 평균이 \d+일 평균을 (?:위|아래)로) 넘음\./g,'$1$2 넘었습니다.'],
  [/^(\d{4})\.(\d{2})\.(\d{2}) ~ (\d{4})\.(\d{2})\.(\d{2})/,function(_,a,b,c,d,e,f){ return skdDate(a,b,c)+' ~ '+skdDate(d,e,f); }],
  [/^Max /,'최고 '],[/^Min /,'최저 '],
  [/, 끝난 거래 (\d+)회/,', 종료 거래 $1회'],
  [/^평가 기록이 있는 봉만 색이 칠해집니다\. 지난 봉 기준입니다\.$/,'종료된 봉의 평가 기록을 날짜별로 표시합니다.'],
  [/^이전 기록 (\d+)건 더 보기$/,'이전 기록 $1건 보기'],
  [/^주문 (\d+)건, (\$[0-9,]+)로 시작한 기준$/,'초기 운용 금액 $2, 주문 $1건'],
  [/선물의 (\d+일) 평균이 (\d+일) 평균을 넘으면 롱, 밑돌면 숏으로 (\d+배 )?바꿔 탑니다\./,'선물에서 $1 평균선이 $2 평균선보다 높으면 롱, 낮으면 숏으로 $3운용합니다.']
];
function skdText(t){
  var k=t.trim(); if(SKD_EXACT[k]&&k===t.trim()) return t.replace(k,SKD_EXACT[k]);
  for(var i=0;i<SKD_RE.length;i++) t=t.replace(SKD_RE[i][0],SKD_RE[i][1]);
  if(typeof skSym==='function') t=skSym(t);
  return t;
}
function skdApply(root){
  if(!root) return;
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT), n, L=[];
  while((n=w.nextNode())){ var pe=n.parentElement; if(!pe||/^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(pe.tagName)) continue; L.push(n); }
  L.forEach(function(x){ var v=x.nodeValue, nv=skdText(v);
    /* 정확히 일치 교체는 짧은 라벨(탭, 표 머리, 정보 행)에만 */
    var k=v.trim(); if(SKD_EXACT[k]){ var pe=x.parentElement, ok=pe&&(pe.closest('.mk-dtabs,.mko-tbl thead,.ss3-tbl thead,.mk-info-r small,.mk-info-r span,.mkd-pills,.mkd-pill,.mkd-fav,.mkc-h,.mko-go,.mko-h')); if(!ok) nv=v; }
    if(nv!==v) x.nodeValue=nv; });
}
var SKD_RULE=/레버리지는|반대 신호가 나오면 청산하고|되돌아오면 청산합니다|손실 방향으로 움직이면 청산합니다|한 종목을|양방향으로 거래합니다/;
function skdDedupe(root){
  [].forEach.call(root.querySelectorAll('.mkc-m.v2'),function(li){
    if(li.dataset.skdd) return; var hb=li.querySelector('.mkc-h b'); var ttl=hb?hb.textContent.trim():'';
    if(li.classList.contains('k-now')||/전략 개요|현재 포지션/.test(ttl)) { li.dataset.skdd='1'; return; }
    /* 판단 기록의 시각은 신호 시각이다. 체결은 다음 날 시가라 거래 내역 날짜와 하루 다를 수 있어 화면에서 구분한다 (Codex s5) */
    var tm=li.querySelector('.mkc-h time');
    if(tm&&/진입|청산/.test(ttl)){ var mt=tm.textContent.trim().match(/^(\d{2})\/(\d{2}) (\d{2}:\d{2})/); if(mt) tm.textContent='신호 '+(+mt[1])+'. '+(+mt[2])+'. '+mt[3]+', 다음 날 시가 체결'; }
    [].forEach.call(li.querySelectorAll('.mkc-t p'),function(p){
      /* 글자 노드를 문장 끝(다. )에서 쪼갠 뒤 문장별로 노드를 묶는다 */
      [].slice.call(p.childNodes).forEach(function(n){ if(n.nodeType!==3) return; var v=n.nodeValue, i, cur=n;
        while((i=cur.nodeValue.search(/다\. ?/))>=0&&i+2<cur.nodeValue.length){ var cut=i+2+(cur.nodeValue.charAt(i+2)===' '?1:0); if(cut>=cur.nodeValue.length) break; cur=cur.splitText(cut); } });
      var sent=[], all=[]; [].slice.call(p.childNodes).forEach(function(n){ sent.push(n); var t=n.textContent||''; if(/다\. ?$/.test(t)){ all.push(sent); sent=[]; } }); if(sent.length) all.push(sent);
      all.forEach(function(g){ var txt=g.map(function(n){ return n.textContent; }).join(''); if(SKD_RULE.test(txt)) g.forEach(function(n){ if(n.parentNode) n.parentNode.removeChild(n); }); });
    });
    li.dataset.skdd='1';
  });
}
(function(){
  var busy=false, mo=null;
  function run(){ var r=document.querySelector('#g-content .mk-detail'); if(!r) return; busy=true; try{ skdApply(r); skdDedupe(r); }finally{ busy=false; } }
  function watch(){ var c=document.getElementById('g-content'); if(!c||mo) return;
    var tm=null; mo=new MutationObserver(function(){ if(busy||tm) return; tm=setTimeout(function(){ tm=null; if(document.querySelector('#g-content .mk-detail')) run(); },300); });
    mo.observe(c,{childList:true,subtree:true,characterData:true}); }
  var r0=tfSS3DetailRender; tfSS3DetailRender=function(){ var r=r0.apply(this,arguments); try{ watch(); run(); }catch(e){} return r; };
})();
