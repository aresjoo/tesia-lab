/* ═══ 터미널 카피 (sk-term) ═══  요소는 그대로, 글자만. 터미널은 조각조각 다시 그려지므로 #g-content 를 지켜본다 */
var SKT_EXACT={'+ 새 전략':'새 전략','전략을 선택하면 여기에 표시됩니다':'선택한 전략을 표시합니다.',
  '채팅에서 전략을 만들고 검증을 통과하면 여기서 실행됩니다.':'채팅에서 만든 전략을 검증한 뒤 실행할 수 있습니다.',
  '검색어나 필터를 조정해보십시오.':'검색어나 필터를 바꿔 보십시오.',
  '실행 중 전략이 진입하면 여기에 표시됩니다.':'실행 중인 전략이 진입하면 여기에 표시합니다.',
  '포지션이 열리면 규칙 기반 손절, 익절 주문이 여기 걸립니다.':'포지션이 열리면 손절과 익절 주문이 여기에 걸립니다.',
  '전략이 실행되면 체결, 복기, 정산 소식이 여기로 옵니다.':'전략이 실행되면 체결, 복기, 정산 알림이 여기에 쌓입니다.',
  '데모 체험, 시뮬레이션 데이터입니다':'예시 전략의 운용 화면을 미리 봅니다.','내 화면으로':'내 터미널','TETH가 보고 있습니다':'TETH가 진입 조건을 확인하고 있습니다',
  '기다리는 것':'기다리는 조건','검증 구간 재생, 일봉':'일봉 기준 검증 기록','✓ 도달':'도달','✓':'충족','리스크 규칙, 유지':'위험 규칙, 유지',
  '왜 아직 진입 안 했어?':'아직 진입하지 않은 이유','지금 가장 큰 리스크는?':'지금 가장 큰 위험','다음 진입 조건은?':'다음 진입 조건','더 보수적으로 바꿔줘':'더 보수적으로 바꾸기',
  'Equity':'평가 금액','USD 기준, 검증 구간':'USD 기준, 검증 구간 기록','BUY':'매수','SELL':'매도','전략 검색':'전략 검색'};
var SKT_RE=[
  [/^검증 구간 파생 기록, (현재 전략|전체 전략) 범위$/,'검증 구간 기록, $1 기준'],
  [/^진입 신호를 탐색하는 중입니다\.$/,'진입 신호를 찾고 있습니다.'],
  [/\s*\(시뮬레이션\)/g,''],
  [/^이전 판단 더 보기 \((\d+)\)$/,'이전 판단 더 보기, $1건'],
  [/^시장가 (매도|매수) 전량, /,'전량 시장가 $1, '],
  [/^(\d{4})\.(\d{2})\.(\d{2})$/,function(_,y,m,d){ return y+'. '+(+m)+'. '+(+d)+'.'; }],
  [/^(\d{4})\.(\d{2})\.(\d{2}) ~ (\d{4})\.(\d{2})\.(\d{2})$/,function(_,a,b,c,d,e,g){ return a+'. '+(+b)+'. '+(+c)+'. ~ '+d+'. '+(+e)+'. '+(+g)+'.'; }]
];
function sktText(t){ var k=t.trim(); if(SKT_EXACT[k]) return t.replace(k,SKT_EXACT[k]); for(var i=0;i<SKT_RE.length;i++) t=t.replace(SKT_RE[i][0],SKT_RE[i][1]); if(typeof skSym==='function') t=skSym(t); return t; }
function sktApply(root){
  if(!root) return;
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT), n, L=[];
  while((n=w.nextNode())){ var pe=n.parentElement; if(!pe||/^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(pe.tagName)) continue; L.push(n); }
  L.forEach(function(x){ var v=x.nodeValue, nv=sktText(v); if(nv!==v) x.nodeValue=nv; });
  /* 빈 목록의 단추는 오른쪽 "새 전략 만들기"와 같은 말로 */
  [].forEach.call(root.querySelectorAll('.tft-comp .row input'),function(i){ if(/바꿔줘/.test(i.placeholder)) i.placeholder='예: 손절을 -3%로 바꿔 주십시오'; });
  [].forEach.call(root.querySelectorAll('.tft-empty .nfx-btn.pri'),function(b){ if(/새 전략/.test(b.textContent)) b.textContent='새 전략 만들기'; });
}
(function(){
  var busy=false, mo=null;
  function run(){ var r=document.querySelector('#g-content .tft-page'); if(!r) return; busy=true; try{ sktApply(r); }finally{ busy=false; } }
  function watch(){ var c=document.getElementById('g-content'); if(!c||mo) return;
    var tm=null; mo=new MutationObserver(function(){ if(busy||tm) return; tm=setTimeout(function(){ tm=null; if(document.querySelector('#g-content .tft-page')) run(); },300); });
    mo.observe(c,{childList:true,subtree:true,characterData:true}); }
  function boot(){ if(document.getElementById('g-content')){ watch(); run(); } else setTimeout(boot,300); }
  boot();
})();
/* 모바일에서 전략이 없으면 "전략 찾기"가 있는 판단 탭을 먼저 보인다(요소 이동 없이 탭 선택만, 한 번) */
(function(){ var done=false; var a0=sktApply; sktApply=function(root){ a0(root); try{
  if(done||innerWidth>768||!root||root.classList.contains('tm-pv')||root.querySelector('.tft-card')) return;
  var tabs=root.querySelectorAll('.nfxh-tabs.m-only .nfxh-tab'); var t=[].filter.call(tabs,function(b){ return /판단/.test(b.textContent); })[0];
  if(t&&!t.classList.contains('on')){ done=true; t.click(); }
}catch(e){} }; })();
