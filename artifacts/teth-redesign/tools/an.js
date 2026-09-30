/* ═══ TETH에게 분석시키기 (an): 전략 카드가 내 말이 되고, TETH가 전략 화면을 직접 열어 보며 분석한다 ═══
   1) 내 말풍선: 카드 + "이 전략 분석해줘"  2) 작업 타임라인: 전략 페이지 열기 → 개요, 판단 기록, 거래 내역 화면을 그 자리에서 찍어 붙임
   3) 모델에는 전략 설정과 기록을 담은 긴 요청을 넘긴다(화면에는 안 보임)  4) 화면을 다 찍기 전에는 모델 호출을 시작하지 않는다 */
var AN={gate:null,label:null,shots:{}};
var AN_TABS=[['ov','개요'],['log','판단 기록'],['trades','거래 내역']];
var AN_W=1180, AN_H=860, AN_OUT=760, AN_Q=0.55;
/* 모델에 넘길 요청문: 예전 tfSS3Ask 가 화면에 보여 주던 문장 그대로 */
function anPrompt(s,nick,pd){
  var r=tfSS3PdCalc(s,pd||'all'), q;
  if(s.cfg){ q='전략 분석 요청: "'+s.name+'" ('+MK_KIND[s.kind]+', '+mkScope(s)+'). 하는 일: '+mkDoes(s).map(function(d){ return d[0]+' '+d[1]; }).join('. ')+'. 움직이는 방식: '+mkHowRows(s).map(function(d){ return d[0]+' '+d[1]; }).join('. ')+'. 설정값: '+Object.keys(s.cfg).filter(function(k){ return ['id','name','one','ex','fw','mkt','kind'].indexOf(k)<0; }).map(function(k){ return k+'='+(typeof s.cfg[k]==='object'?JSON.stringify(s.cfg[k]):s.cfg[k]); }).join(', ')+'. 지금: '+mkNowLine(s)+'. 최근 판단: '+mkEvFold(mkEvents(s,s.r),3).map(function(e){ return mkMD(e.i)+' '+e.dec+' ('+e.obs+')'; }).join(' / ')+'. 기록(전체 기간): 수익률 '+(r.ret>=0?'+':'')+r.ret.toFixed(1)+'%, 최대 낙폭 '+r.mdd.toFixed(1)+'%, 승률 '+Math.round(r.win!=null?r.win:(r.winRate||0))+'%, 거래 '+r.n+'회. 이 전략의 강점과 약점, 그리고 전략 복사 전에 확인해야 할 점을 분석해줘.'; }
  else q='공유 전략 분석 요청: "'+nick+'" ('+s.asset+'). 규칙: RSI '+(s.p&&s.p.rsiTh!=null?s.p.rsiTh:'?')+' 이하 눌림 후 반등 진입'+(s.p&&s.p.trendFilter?', 추세 필터 사용':'')+', 손절 '+(s.p?s.p.sl:'?')+'%'+(s.p&&s.p.tp!=null?', 익절 +'+s.p.tp+'%':'')+'. 검증 결과: 수익 '+(r.ret>=0?'+':'')+r.ret.toFixed(1)+'%, MDD '+r.mdd.toFixed(1)+'%, 승률 '+Math.round(r.win)+'%, 거래 '+r.n+'회. 이 전략의 강점과 약점, 복사 전에 확인할 점을 분석해줘.';
  return q+' 답변은 화면에서 확인한 내용을 근거로 쓰되, 설정값 이름(fast, slow, trail 같은 키)은 그대로 쓰지 말고 쉬운 말로 풀어서 설명해.';
}
function tfSS3Ask(ne,pd){
  var nick; try{ nick=decodeURIComponent(ne); }catch(e){ return; }
  var s=tfSSFind(nick); if(!s) return;
  if(!S.user){ authOpen('login'); return; }
  pd=pd||'all';
  var q=anPrompt(s,nick,pd);
  var card=mkCard(s).replace(/<div class="mk3-foot">[\s\S]*?<\/div>/,'');
  tfTrack('strategy_ai_analysis',{nick:nick});
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  window.TF_ONSHARE=false;
  AN.label=mkHook(s)+' 전략 페이지를 열어 보는 중';
  AN.pre=function(run){ return anShots(run,s,ne,pd); };
  gNew({text:q,html:'<div class="an-card">'+card+'</div><div class="an-line">이 전략 분석해줘</div>'});
}
/* 작업 타임라인에 화면 확인 단계를 넣고, 다 찍힐 때까지 모델 호출을 막는다 */
function anShots(run,s,ne,pd){
  var done; AN.gate=new Promise(function(r){ done=r; });
  var mine=function(st){ AN.own=1; try{ return actStep(run,st); } finally{ AN.own=0; } };
  var open=mine({kind:'fetch',title:'전략 페이지 여는 중'});
  var fin=function(){ AN.gate=null; done(); };
  anFrame(ne,pd,function(fr){
    open.done('전략 페이지 열기 완료','',(Date.now()-open.st.t0)+'ms');
    var i=0;
    var next=function(){
      if(i>=AN_TABS.length){ AN.lastShotAt=Date.now(); setTimeout(function(){ try{ fr.remove(); }catch(e){} },200); anHead(run,mkHook(s)+' 전략을 분석하는 중'); fin(); return; }
      var tb=AN_TABS[i++], st=mine({kind:'fetch',title:tb[1]+' 화면 확인 중'});
      anCapture(fr,ne,pd,tb[0],function(url,w,h){
        if(url){ st.st.open=true; st.done(tb[1]+' 화면 확인 완료','<img class="an-shot" src="'+url+'" alt="'+tb[1]+' 화면" width="'+w+'" height="'+h+'" loading="lazy">',w+'×'+h); }
        else st.fail(tb[1]+' 화면 확인 실패','화면을 가져오지 못했습니다. 다른 화면으로 계속합니다.');
        setTimeout(next,300);
      });
    };
    next();
  },function(){ open.fail('전략 페이지 열기 실패','페이지를 불러오지 못했습니다. 설정값만으로 분석합니다.'); fin(); });
  return AN.gate;
}
function anHead(run,label){ try{ run.data.label=label; var h=run.el&&run.el.querySelector('.hlb'); if(h) h.textContent=label; }catch(e){} }
/* 같은 앱을 보이지 않는 프레임에 띄워 실제 상세 화면을 그린다 */
function anFrame(ne,pd,ok,fail){
  var fr=document.createElement('iframe'); fr.className='an-frame'; fr.setAttribute('aria-hidden','true'); fr.tabIndex=-1;
  fr.style.cssText='position:fixed;left:0;top:0;width:'+AN_W+'px;height:'+AN_H+'px;border:0;opacity:0;pointer-events:none;z-index:-1';
  fr.src=location.pathname+location.search+(location.search?'&':'?')+'an=1#/share/s/'+ne+'/'+pd;
  var t0=Date.now(), timer;
  fr.onload=function(){
    timer=setInterval(function(){
      var w=fr.contentWindow, d=fr.contentDocument;
      if(!w||!d){ return; }
      var ready=w.G&&w.G.mode==='tfss3d'&&d.querySelector('.mk3-dh, .mk3-t, #g-content .mk3');
      if(ready){ clearInterval(timer);
        try{ var st=d.createElement('style'); st.textContent='#tf-devbtn,#tf-devpanel,#teth-help,.hw-fab,#hw-fab,[id^=hw-],.g-terms{display:none!important} #g-scroll{scrollbar-width:none} html,body{overflow:hidden}'; d.head.appendChild(st); }catch(e){}
        anLib(d,function(){ setTimeout(function(){ ok(fr); },500); },function(){ fail(); fr.remove(); }); return; }
      if(Date.now()-t0>20000){ clearInterval(timer); fail(); fr.remove(); }
    },250);
  };
  fr.onerror=function(){ clearInterval(timer); fail(); fr.remove(); };
  document.body.appendChild(fr);
}
function anLib(d,ok,fail){
  if(d.defaultView.htmlToImage){ ok(); return; }
  var sc=d.createElement('script'); sc.src='https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.js'; sc.onload=ok; sc.onerror=fail; d.head.appendChild(sc);
}
/* 탭을 바꾸고 화면 전체를 찍는다. 저장 크기를 위해 줄인 JPEG */
function anCapture(fr,ne,pd,tab,cb){
  var w=fr.contentWindow, d=fr.contentDocument;
  try{ if(tab!=='ov') w.tfSS3Go(ne,pd,tab); }catch(e){}
  setTimeout(function(){
    try{ var g=d.getElementById('g-scroll'); if(g) g.scrollTop=0; }catch(e){}
    var lib=w.htmlToImage; if(!lib){ cb(null); return; }
    /* 그려지는 중인 애니메이션은 끝 상태로 고정하고 찍는다 */
    try{ d.querySelectorAll('clipPath rect').forEach(function(r){ var an=r.querySelector('animate'); if(an){ r.setAttribute('width',an.getAttribute('to')); an.remove(); } }); }catch(e){}
    try{ if(!d.getElementById('an-still')){ var st=d.createElement('style'); st.id='an-still'; st.textContent='*{animation:none!important;transition:none!important}'; d.head.appendChild(st); } }catch(e){}
    lib.toJpeg(d.getElementById('g-root')||d.body,{width:AN_W,height:AN_H,quality:AN_Q,pixelRatio:AN_OUT/AN_W,backgroundColor:'#0e0f11',skipFonts:true,filter:function(el){ if(el.tagName==='IMG') return !!(el.complete&&el.naturalWidth>0); return !(el.tagName==='IFRAME'||el.tagName==='VIDEO'); }})
      .then(function(url){ cb(url,AN_OUT,Math.round(AN_H*AN_OUT/AN_W)); })
      .catch(function(){ cb(null); });
  },tab==='ov'?900:1400);
}
/* 프레임 안에서는 분석 요청 창을 다시 열지 않는다 */
if(/[?&]an=1/.test(location.search)){ try{ document.documentElement.classList.add('an-inner'); }catch(e){} }
(function(){
  /* 내 말풍선에 HTML을 넣을 수 있게 */
  var cu0=gConvUser; gConvUser=function(t){ if(t&&typeof t==='object'){ gThreadAdd('<div class="g-urow an-urow"><div class="g-umsg an-umsg">'+t.html+'</div></div>'); return; } return cu0.apply(this,arguments); };
  var gn0=gNew; gNew=function(preset){ if(preset&&typeof preset==='object'){ var o=preset; var cu1=gConvUser; gConvUser=function(){ gConvUser=cu1; return cu1({html:o.html}); }; try{ return gn0(o.text); } finally{ gConvUser=cu1; } } return gn0.apply(this,arguments); };
  /* 작업 타임라인이 열리면 화면 확인 단계부터 */
  /* 화면을 찍는 동안 들어오는 다른 단계(매크로 확인 등)는 찍기가 끝난 뒤에 붙는다 */
  var st0=actStep; actStep=function(run,st){ if(AN.gate&&!AN.own){ var q=[], h={st:st,done:function(){ q.push(['done',arguments]); },fail:function(){ q.push(['fail',arguments]); },set:function(){ q.push(['set',arguments]); }}; AN.gate.then(function(){ var real=st0(run,st); q.forEach(function(c){ real[c[0]].apply(real,c[1]); }); h.done=real.done; h.fail=real.fail; h.set=real.set; }); return h; } return st0(run,st); };
  var as0=actStart; actStart=function(sess,label){ var run=as0(sess,AN.label||label); AN.label=null; if(AN.pre){ var f=AN.pre; AN.pre=null; try{ f(run); }catch(e){ AN.gate=null; } } return run; };
  /* 화면을 다 찍기 전에는 모델 호출을 보내지 않는다 */
  var f0=window.fetch; window.fetch=function(u,o){ var args=arguments, self=this; if(AN.gate&&window.TAI&&String(u)===TAI.url){ var g=AN.gate; return g.then(function(){ AN.sentAt=Date.now(); return f0.apply(self,args); }); } if(window.TAI&&String(u)===TAI.url) AN.sentAt=Date.now(); return f0.apply(self,args); };
})();
