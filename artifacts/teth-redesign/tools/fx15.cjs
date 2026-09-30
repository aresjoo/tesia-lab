const fs=require('fs');let a=fs.readFileSync('an.js','utf8');
function ed(x,y){ if(a.split(x).length!==2) throw new Error(x.slice(0,50)); a=a.replace(x,()=>y); }
ed("var sc=d.createElement('script'); sc.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; sc.onload=ok; sc.onerror=fail; d.head.appendChild(sc);",
   "var sc=d.createElement('script'); sc.src='https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.js'; sc.onload=ok; sc.onerror=fail; d.head.appendChild(sc);");
ed("  if(d.defaultView.html2canvas){ ok(); return; }","  if(d.defaultView.htmlToImage){ ok(); return; }");
ed(`    var h2c=w.html2canvas; if(!h2c){ cb(null); return; }
    h2c(d.body,{width:AN_W,height:AN_H,windowWidth:AN_W,windowHeight:AN_H,scale:AN_OUT/AN_W,backgroundColor:'#0e0f11',useCORS:true,logging:false,ignoreElements:function(el){ return el.tagName==='IFRAME'||el.tagName==='VIDEO'; }})
      .then(function(cv){ try{ cb(cv.toDataURL('image/jpeg',AN_Q),cv.width,cv.height); }catch(e){ cb(null); } })
      .catch(function(){ cb(null); });
  },tab==='ov'?300:900);`,
`    var lib=w.htmlToImage; if(!lib){ cb(null); return; }
    /* 그려지는 중인 애니메이션은 끝 상태로 고정하고 찍는다 */
    try{ d.querySelectorAll('clipPath rect').forEach(function(r){ var an=r.querySelector('animate'); if(an){ r.setAttribute('width',an.getAttribute('to')); an.remove(); } }); }catch(e){}
    try{ if(!d.getElementById('an-still')){ var st=d.createElement('style'); st.id='an-still'; st.textContent='*{animation:none!important;transition:none!important}'; d.head.appendChild(st); } }catch(e){}
    lib.toJpeg(d.getElementById('g-root')||d.body,{width:AN_W,height:AN_H,quality:AN_Q,pixelRatio:AN_OUT/AN_W,backgroundColor:'#0e0f11',skipFonts:true,filter:function(el){ if(el.tagName==='IMG') return !!(el.complete&&el.naturalWidth>0); return !(el.tagName==='IFRAME'||el.tagName==='VIDEO'); }})
      .then(function(url){ cb(url,AN_OUT,Math.round(AN_H*AN_OUT/AN_W)); })
      .catch(function(){ cb(null); });
  },tab==='ov'?900:1400);`);
// 승률 필드, 모델 호출 시각 기록, 다른 단계는 화면을 다 찍은 뒤에
ed("승률 '+Math.round(r.win)+'%, 거래 '+r.n+'회. 이 전략의 강점과 약점, 그리고 전략 복사 전에","승률 '+Math.round(r.win!=null?r.win:(r.winRate||0))+'%, 거래 '+r.n+'회. 이 전략의 강점과 약점, 그리고 전략 복사 전에");
ed("var g=AN.gate; return g.then(function(){ return f0.apply(self,args); }); }","var g=AN.gate; return g.then(function(){ AN.sentAt=Date.now(); return f0.apply(self,args); }); } if(window.TAI&&String(u)===TAI.url) AN.sentAt=Date.now();");
ed("  var as0=actStart;","  /* 화면을 찍는 동안 들어오는 다른 단계(매크로 확인 등)는 찍기가 끝난 뒤에 붙는다 */\n  var st0=actStep; actStep=function(run,st){ if(AN.gate&&!AN.own){ var q=[], h={st:st,done:function(){ q.push(['done',arguments]); },fail:function(){ q.push(['fail',arguments]); },set:function(){ q.push(['set',arguments]); }}; AN.gate.then(function(){ var real=st0(run,st); q.forEach(function(c){ real[c[0]].apply(real,c[1]); }); h.done=real.done; h.fail=real.fail; h.set=real.set; }); return h; } return st0(run,st); };\n  var as0=actStart;");
ed("  var open=actStep(run,{kind:'fetch',title:'전략 페이지 여는 중'});\n  var done; AN.gate=new Promise(function(r){ done=r; });","  var done; AN.gate=new Promise(function(r){ done=r; });\n  var mine=function(st){ AN.own=1; try{ return actStep(run,st); } finally{ AN.own=0; } };\n  var open=mine({kind:'fetch',title:'전략 페이지 여는 중'});");
ed("var tb=AN_TABS[i++], st=actStep(run,{kind:'fetch',title:tb[1]+' 화면 확인 중'});","var tb=AN_TABS[i++], st=mine({kind:'fetch',title:tb[1]+' 화면 확인 중'});");
fs.writeFileSync('an.js',a); console.log('ok');
