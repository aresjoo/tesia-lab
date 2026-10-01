/* ═══ 터미널 판단 패널을 DESIGN_PROMPT 대로 (sk-brain) ═══
   제목 하나(지금 하는 일) → 한 줄(어디서 운용, 다음 확인) → 행 목록(포지션, 손절, 익절, 보유 기간, 마지막 확인).
   상태 점 대신 글자, 색은 손익 숫자에만, 운용 거래소는 앱 아이콘. 가격은 전략 종목의 가격표에서 읽는다(BTC 가격표 오류 수정) */
function tbIcon(id,z){ if(!id) return ''; z=z||16; return '<img class="tb-ic" src="assets/logos/app-'+id+(id==='gate'?'.jpg':'.png')+'" alt="" width="'+z+'" height="'+z+'">'; }
function tbRow(k,v,cls){ return '<div class="tb-r"><span>'+k+'</span><b class="num'+(cls?' '+cls:'')+'">'+v+'</b></div>'; }
(function(){
  if(typeof tfTmStatusBlock!=='function') return;
  tfTmStatusBlock=function(s,c){
    var p=s.p||{}, st=s.status, e=p.endI;
    var watch=!window.TF_PREVIEW&&typeof bcInit==='function'&&bcInit().mode==='watch';
    var inPos=!!(c.pos&&st==='live');
    var head=st==='live'?(watch?'AI 판단이 잠시 멈춰 있습니다':inPos?'청산 조건을 확인하고 있습니다':'진입 조건을 확인하고 있습니다'):st==='off'?'일시정지 중입니다':st==='ready'?'실행 전입니다':'연결 오류로 멈췄습니다';
    var ex=s.exL||'', next=' 마지막 확인 <b id="tm-lastchk">'+tfTmAgo(tfTmEvalAt(s))+'</b>';
    var line=(ex?tbIcon(s.ex)+'<span>'+gEsc(ex)+(st==='live'?'에서 운용 중,':'에 연결,')+next+'</span>':'<span>'+next.trim()+'</span>');
    var tk=gEsc(tfAssetTicker(s.asset)), rows='';
    if(inPos){
      var q=c.pos.qty, pc=c.pos.chg*100;
      rows+=tbRow('포지션','롱 '+q.toFixed(4)+' '+tk+' <i class="'+(pc>=0?'u':'d')+'">'+tfTmPct(pc,1)+'</i>');
      rows+=tbRow('손절',tfTmPx(c.pos.stopP)+' ('+p.sl+'%)');
      if(c.pos.tpP) rows+=tbRow('익절',tfTmPx(c.pos.tpP)+' (+'+p.tp+'%)');
      rows+=tbRow('보유 기간',c.pos.bars+'일, 최대 25일');
    } else {
      rows+=tbRow('포지션',c.flat?'없음, 긴급 정지로 정리됨':'없음');
      rows+=tbRow('진입 조건','RSI '+p.rsiTh+' 아래에서 0.5% 넘게 반등'+(p.trendFilter?', 20일과 60일 평균 차이 3% 초과':''));
    }
    return '<div class="tm-status tb st-'+st+'">'
      +'<h3 class="tb-t">'+head+'</h3>'
      +'<p class="tb-d">'+line+'</p>'
      +'<div class="tb-list">'+rows+'</div>'
      +(watch?'<p class="tb-w">이용 한도로 AI 판단이 멈춰 있습니다. 손절과 익절 규칙은 계속 작동합니다.</p>':'')
      +'</div>';
  };
})();
/* 판단 기록과 질문 단추의 내부 말을 쉬운 말로 (판단 패널 안에서만) */
var TB_TXT=[['일봉 기준 검증 기록',''],['위험 규칙, 유지','그대로 유지'],['규칙 검사','규칙 확인'],['미도달','아직'],['✓ 도달','도달'],['25봉 청산','25일 보유 뒤 정리'],['체결만','거래만'],['/25봉','/25일'],['전략 관리','바꾸기'],['더 보수적으로 바꾸기','위험 낮추기'],['지금 가장 큰 위험','가장 큰 위험']];
function tbText(){ try{ var b=document.querySelector('#g-content .tft-brain'); if(!b) return;
  var w=document.createTreeWalker(b,NodeFilter.SHOW_TEXT,null), n, kill=[];
  while((n=w.nextNode())){ var t=n.nodeValue, u=t; TB_TXT.forEach(function(p){ if(u.indexOf(p[0])>=0) u=u.split(p[0]).join(p[1]); }); if(u!==t){ if(!u.trim()&&n.parentNode&&n.parentNode.tagName==='SMALL') kill.push(n.parentNode); else n.nodeValue=u; } }
  kill.forEach(function(e){ e.remove(); }); }catch(e){} }
(function(){ var t=0; var go=function(){ clearTimeout(t); t=setTimeout(tbText,200); };
  try{ new MutationObserver(go).observe(document.getElementById('g-content'),{childList:true,subtree:true}); }catch(e){} })();
/* 차트 탭 줄의 시세 출처 표시에도 운용 거래소 앱 아이콘 */
mktRefNote=function(){ try{ var bar=document.querySelector('#g-content .tft-page .mkt-tabs'); if(!bar) return;
  var id=null, ex=null, s=TF_TM.sel?tfTmOf(TF_TM.sel):null;
  if(s){ id=s.ex; ex=s.exL; } else { var c=cpState().copies.filter(function(x){ return x.status==='active'; })[0]; if(c){ id=(acConnList&&acConnList()[0])||'bitget'; ex=acName?acName(id):id; } }
  var el=bar.querySelector('.mkt-ref'), key=id&&id!=='binance'?id+'|'+ex:'';
  if(!key){ if(el) el.remove(); return; }
  if(el&&el.getAttribute('data-k')===key) return;
  if(!el){ el=document.createElement('span'); el.className='mkt-ref'; bar.appendChild(el); }
  el.setAttribute('data-k',key);
  el.innerHTML=tbIcon('binance',14)+'<span>Binance 시세</span><span class="sp"></span>'+tbIcon(id,14)+'<span>'+gEsc(ex||id)+'에서 운용</span>'; }catch(e){} };

/* 거래소 두 글자 배지(BI, WO, OK)를 앱 아이콘으로. Bitget과 Binance가 둘 다 BI라 글자로는 구분이 안 된다. 배지 색으로 거래소를 찾는다 */
function tbExbFix(){ try{ var root=document.getElementById('g-content'); if(!root) return; var L=root.querySelectorAll('span.exb:not([data-tb])'); if(!L.length) return;
  var map={}; (typeof TF_BROKERS!=='undefined'?TF_BROKERS:[]).forEach(function(b){ if(b&&b.col) map[String(b.col).toLowerCase()]=b.id; });
  var tmp=document.createElement('span');
  [].forEach.call(L,function(sp){ sp.setAttribute('data-tb','1'); tmp.style.background=''; tmp.style.background=sp.style.background; var hex=(sp.getAttribute('style')||'').match(/background:\s*(#[0-9a-fA-F]{3,6})/); var id=hex?map[hex[1].toLowerCase()]:null;
    if(id==='woo') id='woox'; if(!id) return; sp.outerHTML=tbIcon(id,sp.classList.contains('sm')?14:16); }); }catch(e){} }
(function(){ var t=0; var go=function(){ clearTimeout(t); t=setTimeout(tbExbFix,150); };
  try{ new MutationObserver(go).observe(document.getElementById('g-content'),{childList:true,subtree:true}); }catch(e){} })();
