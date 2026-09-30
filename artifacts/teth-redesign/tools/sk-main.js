/* ═══ 첫 화면(AI 트레이딩 소개)과 전략 찾기 목록을 ChatGPT 어휘로 (sk-main) ═══
   첫 화면: 제목, 부제 문구만 바꾼다. 영상, "영원히 무료" 줄, 그 아래 섹션은 그대로.
   전략 찾기: 카드 정보는 넷(이름, 판단 방식과 실행 거래소, 최근 30일 수익률과 작은 그래프, 따라가는 사람 수). 카드 전체가 상세로 가는 링크.
   정렬 알약 넷은 선택 메뉴 하나로. */
(function(){
  var iv0=tfIntroView; tfIntroView=function(){ var r=iv0.apply(this,arguments);
    var h=document.getElementById('txh-h'); if(h) h.innerHTML='AI가 스스로<br class="txh-m"> 판단해 거래합니다';
    var s=document.querySelector('.txh-hero .txh-sub'); if(s) s.innerHTML='거래소 계정을 한 번 승인으로 연결하면<br>전략이 그 계정에서 직접 주문합니다.';
    return r; };
})();
function skfOpen(e,ne){ if(e&&e.type==='keydown'&&e.key!=='Enter'&&e.key!==' ') return; if(e&&e.type==='keydown') e.preventDefault(); tfSS3Go(ne); }
function skfCard(s){
  if(!s.kind) s.kind='rule';
  var m30=mk30(s), ne=tfSS3Rid(s), ex=mkEx(s), fw=s.fw?mkFwHtml(s.fw):'';
  return '<article class="mk-card skf k-'+s.kind+'" role="link" tabindex="0" aria-label="'+gEsc(mkHook(s))+' 전략 보기" onclick="skfOpen(event,\''+ne+'\')" onkeydown="skfOpen(event,\''+ne+'\')">'
    +'<div class="skf-top">'+mkGlyph(s,28)+'<div class="skf-nm"><h3>'+gEsc(mkHook(s))+'</h3><span><img src="assets/logos/'+ex[0]+'.png" alt="" width="14" height="14" loading="lazy">'+MK_KIND[s.kind]+', '+ex[1]+'에서 실행</span></div></div>'
    +'<div class="skf-perf"><div class="skf-ret"><small>최근 30일</small><b class="num'+mkSign(m30.ret)+'">'+mkPct0(m30.ret)+'</b></div>'+mkSpark3(m30.eq)+'</div>'
    +'<div class="skf-fw">'+fw+'</div>'
    +'</article>';
}
(function(){
  mkCard=skfCard; tfSS3Card=skfCard;
  /* 정렬: 알약 넷 → 선택 메뉴 하나(승률순은 뺀다) */
  var c0=mk3Controls; mk3Controls=function(t){ var h=c0.apply(this,arguments), sort=mkSortKey(t); if(sort==='win') sort='pick';
    var sel='<label class="skf-sort"><span class="sr">정렬</span><select aria-label="정렬" onchange="tfSS3SortPick(this.value)">'+[['pick','추천순'],['ret','최근 30일 수익률순'],['fw','따라가는 사람순']].map(function(o){ return '<option value="'+o[0]+'"'+(sort===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')+'</select></label>';
    var d=document.createElement('div'); d.innerHTML=h; var chips=d.querySelector('.mk-chips'); if(chips) chips.outerHTML=sel;
    var q=d.querySelector('#ss3-q'); if(q) q.setAttribute('placeholder','전략 검색');
    return d.innerHTML; };
})();
