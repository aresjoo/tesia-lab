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
/* 소개 페이지 아래 섹션 전체: 문구를 DESIGN_PROMPT.md 톤으로 (Codex s1 반영). 로고, 아바타, 영상, "영원히 무료" 줄은 그대로 */
function skIntroCopy(){
  var q=function(s){ return document.querySelector(s); }, qa=function(s){ return [].slice.call(document.querySelectorAll(s)); };
  var set=function(el,t){ if(el) el.textContent=t; };
  /* 첫 화면 설명: 강제 줄바꿈 없이 한 문장 */
  set(q('.txh-hero .txh-sub'),'거래소 계정을 한 번 승인으로 연결하면 전략이 그 계정에서 직접 주문합니다.');
  /* TETH가 쓰는 AI */
  var ai=q('#txh-ai'); if(ai){ var k=ai.querySelector('.txh-kick'); if(k) k.remove(); set(q('#txh-ai-h'),'TETH가 쓰는 AI'); set(ai.querySelector('.txh-lead'),'뉴스 확인, 시장 분석, 판단 정리마다 맞는 AI를 씁니다.');
    var H=['뉴스 확인','시장 분석','판단 정리']; qa('.txh-ai-col h3').forEach(function(h,i){ if(H[i]) h.textContent=H[i]; });
    var R={'Gemini':'구글 검색으로 최신 정보를 확인합니다','Grok':'X에서 지금 여론을 확인합니다','Perplexity':'뉴스와 공시의 출처를 찾습니다','DeepSeek':'시장을 분석합니다','Qwen':'여러 종목을 한 번에 비교합니다','Kimi':'긴 보고서와 자료를 읽습니다','ChatGPT':'상황을 정리해 판단합니다','Claude':'판단한 이유를 문장으로 씁니다','Le Chat (Mistral)':'보조 판단을 냅니다'};
    qa('.txh-ai-col li').forEach(function(li){ var b=li.querySelector('b'), s=li.querySelector('span'); if(b&&s&&R[b.textContent.trim()]) s.textContent=R[b.textContent.trim()]; }); }
  /* 지금 TETH가 하는 일 */
  set(q('#txh-now-h'),'지금 TETH가 하는 일'); var nw=q('#txh-now'); if(nw) set(nw.querySelector('.txh-lead'),'거래할 때도, 기다릴 때도 이유를 적어 둡니다.');
  var C=[{n:'워렌 버핏 AI 버전 13',m:['$12,480','+8.2%','+$946'],b:'AI 관련 기업의 강세를 예상해 기존 롱 포지션을 유지합니다. 주말 유동성과 거시 경제 일정을 고려해 새 거래와 헤지는 더하지 않습니다. NVDA 지지선과 MSFT 상승 추세를 보다가, 추세가 꺾이면 조정합니다.'},
         {n:'RSI 반등 규칙 버전 2',m:['$1,000','+3.1%','+$31'],b:'비트코인이 내려 RSI가 28입니다. 반등할 수 있지만, 규칙상 30을 다시 넘을 때만 삽니다. 그래서 지금은 기다립니다. 산 뒤 5% 내리면 팔고, 12% 오르면 절반을 정리합니다.'}];
  qa('.txh-card').forEach(function(c,i){ var d=C[i]; if(!d) return; set(c.querySelector('.txh-name'),d.n);
    var dt=c.querySelectorAll('dt'); if(dt[2]) dt[2].textContent='손익';
    [].forEach.call(c.querySelectorAll('dd'),function(x,j){ if(d.m[j]){ x.removeAttribute('data-usd-unit'); x.removeAttribute('data-sign'); x.textContent=d.m[j]; } });
    var bd=c.querySelector('.txh-body'); if(bd) bd.textContent=d.b; });
  /* 시작 방법: 번호 없이 세 행 */
  set(q('#txh-w-h'),'시작 방법'); var hw=q('#txh-how'); if(hw) set(hw.querySelector('.txh-lead'),'대화로 전략을 정하고, 과거 시장에서 확인한 뒤 거래를 시작합니다.');
  var S=[['대화로 정하기','무엇을, 얼마로, 언제 멈출지 말로 정합니다.'],['과거 시장에서 확인','지난 시장에서 돌려 보고 결과와 기준을 확인합니다.'],['거래소 연결','거래소 계정을 연결하면 정한 예산으로 거래를 시작합니다.']];
  qa('.txh-step').forEach(function(st,i){ var n=st.querySelector('.n'); if(n) n.remove(); if(S[i]){ set(st.querySelector('b'),S[i][0]); set(st.querySelector('p'),S[i][1]); } });
  /* 마지막: 실행 설정 (묻지 않은 걱정 대신 무엇을 정하는지) */
  set(q('#txh-g-h'),'실행 설정'); var sf=q('#txh-g-h'); var sec=sf&&sf.closest('.txh-sec'); if(sec) set(sec.querySelector('.txh-lead'),'전략마다 예산과 멈추는 조건을 정합니다.');
  var F=[['연결 권한','잔고 조회와 주문만 승인합니다.'],['전략 예산','전략마다 쓸 금액을 따로 정합니다.'],['손실 한도','정한 손실에 닿으면 새 주문을 멈춥니다.'],['거래 중지','언제든 전략을 끄고 포지션을 정리합니다.']];
  qa('.txh-safe li').forEach(function(li,i){ if(F[i]){ set(li.querySelector('b'),F[i][0]); set(li.querySelector('span'),F[i][1]); } });
}
(function(){ var iv1=tfIntroView; tfIntroView=function(){ var r=iv1.apply(this,arguments); try{ skIntroCopy(); }catch(e){} return r; };
  /* 통화를 다시 칠하는 함수가 카드 금액을 되돌리지 않게 */
  if(typeof applyCurrency==='function'){ var ac0=applyCurrency; applyCurrency=function(){ var r=ac0.apply(this,arguments); try{ if(document.querySelector('.txh-card')) skIntroCopy(); }catch(e){} return r; }; }
})();
/* 다른 전략 만들기: 결과를 붙인 새 대화 대신 메인 홈으로 */
rvNew=function(){ try{ RV.on=false; history.replaceState(null,'',location.pathname+location.search); }catch(e){} gHome(); };
/* 전략 이름의 코인은 심볼로 표기: 비앤비 평균선 양방향 2배 → BNB 평균선 양방향 2배 */
var SK_SYM={'비트코인':'BTC','이더리움':'ETH','솔라나':'SOL','리플':'XRP','도지코인':'DOGE','에이다':'ADA','아발란체':'AVAX','비앤비':'BNB'};
function skSym(t){ return String(t==null?'':t).replace(/비트코인|이더리움|솔라나|리플|도지코인|에이다|아발란체|비앤비/g,function(k){ return SK_SYM[k]; }); }
(function(){
  if(typeof MK_CAT!=='undefined') MK_CAT.forEach(function(s){ if(s&&s.name) s.name=skSym(s.name); });
  var mt=mkTitle; mkTitle=function(){ return skSym(mt.apply(this,arguments)); };
})();
/* 연구 기록 문구 */
(function(){ var h0=gHistory; gHistory=function(){ var r=h0.apply(this,arguments); try{ var q=document.getElementById('g-hist-q'); if(q){ q.placeholder='연구 기록 검색'; q.setAttribute('aria-label','연구 기록 검색'); } }catch(e){} return r; };
  var l0=gHistList; gHistList=function(){ var r=l0.apply(this,arguments); try{ var n=document.querySelector('#g-hist-list .g-note'); if(n&&/아직 연구 기록이 없습니다/.test(n.textContent)) n.textContent='아직 연구 기록이 없습니다. 새 전략을 만들면 여기에 쌓입니다.'; var m=document.getElementById('g-hist-more'); if(m) m.textContent='아래로 내리면 더 불러옵니다'; }catch(e){} return r; }; })();

/* 앱 배너는 메인(홈)에서만. 다른 화면은 배너와 그 자리(64px)를 함께 없애 페이지를 위로 올린다(파운더 2026-10-01) */
(function(){
  function want(){ var hide=false; try{ hide=!!sessionStorage.getItem('tethBannerHide'); }catch(e){} return !hide&&typeof G!=='undefined'&&G.mode==='home'; }
  function sync(){ try{ document.body.classList.toggle('has-banner',want()); }catch(e){} }
  if(typeof gHome==='function'){ var h0=gHome; gHome=function(){ var r=h0.apply(this,arguments); sync(); return r; }; }
  var last=null; setInterval(function(){ var m=typeof G!=='undefined'?G.mode:null; if(m!==last){ last=m; sync(); } },300);
  sync();
})();


/* 왼쪽 위 페이지 제목 줄은 대화 화면에서만(대화 이름과 이름 바꾸기). 나머지 페이지는 지우고 내용을 위로 (파운더 2026-10-02) */
(function(){
  function sync(){ try{ document.body.classList.toggle('nochead',!(typeof G!=='undefined'&&G.cur&&G.mode!=='home')); }catch(e){} }
  if(typeof gChead==='function'){ var c0=gChead; gChead=function(){ var r=c0.apply(this,arguments); sync(); return r; }; }
  var last=null; setInterval(function(){ var k=(typeof G!=='undefined'?(G.mode+'|'+!!G.cur):''); if(k!==last){ last=k; sync(); } },300);
  sync();
})();
/* 모바일: 아래로 스크롤하면 메뉴 단추를 숨기고, 위로 올리면 다시 보인다(내용 위에 겹치지 않게) */
(function(){
  var lastY=0, sc=null;
  function on(){ var s=document.getElementById('g-scroll'); if(!s||s===sc) return; sc=s; lastY=s.scrollTop;
    s.addEventListener('scroll',function(){ if(window.innerWidth>860) return; var y=s.scrollTop; if(y>60&&y>lastY+4) document.body.classList.add('ham-hide'); else if(y<lastY-4||y<=60) document.body.classList.remove('ham-hide'); lastY=y; },{passive:true}); }
  setInterval(on,1000); on();
})();
