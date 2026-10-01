/* ═══ 백테스트 카피 (sk-bt) ═══
   Codex bt/s1 교체표. 요소는 그대로, 글자만. 결과가 그려질 때마다(#bt-root 변화) 적용하며 여러 번 적용해도 같다. */
var SKB_EXACT={'현물로 그냥 들고 있었다면':'현물 보유','결정':'거래 결과','어떻게 판단했나':'판단 기록','거래 하나씩 보기':'거래 내역','달마다 어땠나':'월별 수익률',
  '진입한 날':'진입일','청산한 날':'청산일','기간':'보유 기간','백테스트 조건':'계산 기준','결과를 읽고 있습니다':'결과를 해석하고 있습니다.',
  '선물 롱/숏 2배':'선물 양방향 2배','조건을 바꿔 다시 돌리기':'조건을 바꿔 다시 돌리기','과거를 다시 돌려 보기':'과거를 다시 돌려 보기'};
var SKB_DT={'진입':'진입 조건','청산':'청산 조건'};
var SKB_RE=[
  [/^(최근 \d+(?:개월|년)|전체 기간), (\$[0-9,]+)로 시작$/,'$1, 시작 금액 $2'],
  [/^(최근 \d+(?:개월|년)|전체 기간) 동안, (\$[0-9,]+)로$/,'$1, 시작 금액 $2 기준 손익'],
  [/^(\d{4})\.(\d{2})\.(\d{2}) 잔고$/,function(_,y,m,d){ return y+'. '+(+m)+'. '+(+d)+'. 잔고'; }],
  [/^가장 나빴던 구간/,'최대 하락 구간'],
  [/^다시 돌리는 동안 진입 조건이 맞을 때마다 여기에 보입니다$/,'진입 조건이 맞으면 여기에 표시합니다.'],
  [/^([0-9,]+)일을 다시 돌렸습니다\. 숫자나 그래프의 표시를 누르면 근거가 열립니다\.$/,'$1일간의 결과입니다. 숫자나 차트 표시를 누르면 판단 근거가 열립니다.'],
  [/^이긴 거래 (\d+)번$/,'수익 거래 $1건'],[/^진 거래 (\d+)번$/,'손실 거래 $1건'],
  [/^이긴 거래 (\d+)$/,'수익 $1건'],[/^진 거래 (\d+)$/,'손실 $1건'],[/^전체 (\d+)$/,'전체 $1건'],
  [/^이긴 거래$/,'수익 거래'],[/^(\d+)번 중 (\d+)번$/,'청산 $1건 중 $2건'],[/^평균 보유$/,'평균 보유 기간'],
  [/^가장 크게 내려간 폭$/,'최대 하락률'],
  [/^(?:현물로 )?그냥 들고 있었다면\s*([+-]?[0-9.,]+%)$/,'현물 보유 최대 하락률 $1'],
  [/^(\d+) \/ (\d+)$/,'$2건 중 $1건 표시'],
  [/^(\d{2})\.(\d{2})\.(\d{2})$/,function(_,y,m,d){ return '20'+y+'. '+(+m)+'. '+(+d)+'.'; }],
  [/^(\d{4})\.(\d{2})\.(\d{2})$/,function(_,y,m,d){ return y+'. '+(+m)+'. '+(+d)+'.'; }],
  [/^그보다 (\$[0-9,]+) (많음|적음)$/,function(_,v,k){ return '현물 보유 대비 '+(k==='많음'?'+':'-')+v; }],
  [/^가격 ([0-9,]+)개, ([0-9,]+)일을 확인했습니다$/,'$2일의 가격 $1개를 확인했습니다.'],
  [/^(\d{4})\.(\d{2})\.(\d{2})부터 (\d{4})\.(\d{2})\.(\d{2})까지, [0-9,]+일을 하루씩 다시 돌립니다\.$/,function(_,a,b,c,d,e,f){ return a+'년 '+(+b)+'월 '+(+c)+'일부터 '+d+'년 '+(+e)+'월 '+(+f)+'일까지 돌립니다.'; }],
  [/^반대 방향 신호가 나왔습니다$/,'반대 방향 신호로 청산했습니다.'],
  [/^([A-Z]{2,6}) 평균선 위로 교차\. (\d+일) 평균이 (\d+일) 평균을 넘었습니다$/,'$2 평균이 $3 평균을 넘어 롱에 진입했습니다.'],
  [/^([A-Z]{2,6}) 평균선 아래로 교차\. (\d+일) 평균이 (\d+일) 평균을 밑돌았습니다$/,'$2 평균이 $3 평균을 밑돌아 숏에 진입했습니다.'],
  [/^진입가에서 손절 기준만큼 불리하게 움직였습니다$/,'진입가에서 손절 기준만큼 불리하게 움직여 청산했습니다.'],
  [/^가장 유리했던 가격에서 기준만큼 되돌렸습니다$/,'가격이 가장 유리했던 지점에서 청산 기준만큼 되돌아와 청산했습니다.'],
  [/^이 거래$/,'거래 손익'],[/^(\d+)일 뒤 청산$/,'$1일 보유 후 청산'],
  [/^이전 판단 더 보기$/,'이전 판단 더 보기'],
  [/^온전한 (\d+)개월 중 (\d+)개월이 올랐습니다$/,'한 달 전체를 계산한 $1개월 중 $2개월에 수익이 났습니다.'],
  [/반대 방향 신호가 나오면 닫고 방향을 바꿉니다/g,'반대 신호가 나오면 청산하고 방향을 바꿉니다'],
  [/에서 25% 되돌리면 닫습니다/g,'에서 25% 되돌아오면 청산합니다'],
  [/불리하게 움직이면 닫습니다/g,'불리하게 움직이면 청산합니다'],
  [/^(\d+)배, 손실은 넣은 증거금까지$/,'$1배'],
  [/선물의 (\d+일) 평균이 (\d+일) 평균을 넘으면 롱, 밑돌면 숏으로 (\d+배 )?바꿔 탑니다\./,'선물에서 $1 평균선이 $2 평균선보다 높으면 롱, 낮으면 숏으로 $3운용합니다.']
];
function skbText(t){
  var k=t.trim(); if(SKB_EXACT[k]) return t.replace(k,SKB_EXACT[k]);
  for(var i=0;i<SKB_RE.length;i++) t=t.replace(SKB_RE[i][0],SKB_RE[i][1]);
  if(typeof skSym==='function') t=skSym(t);
  return t;
}
function skbApply(root){
  if(!root) return;
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT), n, L=[];
  while((n=w.nextNode())){ var pe=n.parentElement; if(!pe||/^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(pe.tagName)) continue; L.push(n); }
  L.forEach(function(x){ var v=x.nodeValue, nv=skbText(v); var k=v.trim();
    /* 정확히 일치 교체는 라벨 자리에서만: 머리, 셀 라벨, 범례, 표 머리, 규칙 dt, 요약 제목, 읽는 중 */
    if(SKB_EXACT[k]){ var pe=x.parentElement, ok=pe&&pe.closest('.bt-leg,.bt-panel .cell small,.bt-sec-b header h3,.bt-sec-b > header > h3,.bt-th,.bt-dl dt,.bt-box h3,.bt-box summary,.bt-read p.l,.bt-id-m,.bt-chips,.bt-verdict,.bt-k3,.bt-cta,.bt-sec,.bt-tech summary'); if(!ok) nv=v; }
    if(nv!==v) x.nodeValue=nv; });
  /* 결과 카드: 현물 보유 손익, 현물 보유 최대 하락률 값은 계산 결과에서 직접 */
  var v2=root.querySelector('.bt-v2 > span'); if(v2&&v2.firstChild&&v2.firstChild.nodeType===3&&/^현물 보유 $/.test(v2.firstChild.nodeValue)) v2.firstChild.nodeValue='현물 보유 손익 ';
  var em=root.querySelector('.bt-k3 em.num'); if(em&&window.BT&&BT.R&&isFinite(BT.R.benchMdd)&&!/[0-9]%/.test(em.textContent)) em.textContent='현물 보유 최대 하락률 '+BT.R.benchMdd.toFixed(1)+'%';
  /* 금액 선택지 500 → $500 (em USD 는 CSS로 숨김) */
  [].forEach.call(root.querySelectorAll('.bt-dl dt'),function(d){ var t=d.textContent.trim(); if(SKB_DT[t]) d.textContent=SKB_DT[t]; });
  [].forEach.call(root.querySelectorAll('.bt-f button'),function(b){ var t=b.textContent.trim(); if(/^[0-9][0-9,]*$/.test(t)) b.textContent='$'+t; });
}
(function(){
  var busy=false, mo=null;
  function run(){ var r=document.getElementById('bt-root'); if(!r) return; busy=true; try{ skbApply(r); }finally{ busy=false; } }
  function watch(){ var c=document.getElementById('g-content'); if(!c||mo) return;
    var tm=null; mo=new MutationObserver(function(){ if(busy||tm) return; tm=setTimeout(function(){ tm=null; if(document.getElementById('bt-root')) run(); },300); });
    mo.observe(c,{childList:true,subtree:true,characterData:true}); }
  /* 백테스트 화면은 여러 함수가 조각조각 그리므로 #g-content 를 처음부터 지켜본다 */
  function boot(){ if(document.getElementById('g-content')){ watch(); run(); } else setTimeout(boot,300); }
  boot();
  ['btReady','btFinish'].forEach(function(fn){ if(typeof window[fn]==='function'){ var f0=window[fn]; window[fn]=function(){ var r=f0.apply(this,arguments); try{ watch(); setTimeout(run,0); }catch(e){} return r; }; } });
})();
