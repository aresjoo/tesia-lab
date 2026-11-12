/* ═══ AI가 빠진 정보만 묻는다 (sk-ask) ═══
   AI 답변의 [ASK] 질문을 채팅 안이 아니라 입력창 바로 위 패널로 띄운다(Genspark식).
   "N개 중 M", 이전/다음, 닫기, 선택지는 한 번 누르면 다음 질문, 마지막에 "직접 답변 작성", 작은 "AI가 알아서 판단".
   "바로 실행" 단추는 고정 질문 다섯 개 대신 AI에게 보내고, AI가 대화에서 모르는 것만 묻는다. */
var SKA_CHEV_L='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
var SKA_CHEV_R='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
function skaDock(){ var w=document.querySelector('.g-composer-wrap'); if(!w) return null; var d=document.getElementById('g-askdock'); if(!d){ d=document.createElement('div'); d.id='g-askdock'; w.insertBefore(d,w.firstChild); } return d; }
function skaCard(cfg){
  if(!cfg) return;
  var steps=(cfg.steps&&cfg.steps.length)?cfg.steps:(cfg.options&&cfg.options.length?[cfg]:null);
  if(!steps) return;
  steps=steps.slice(0,4).filter(function(s){ return s&&s.options&&s.options.length; });
  if(!steps.length) return;
  var dock=skaDock(); if(!dock){ return; }
  TAI.qn=(TAI.qn||0)+1; var id='gqc'+TAI.qn;
  TAI.qcfg=TAI.qcfg||{}; TAI.qcfg[id]={steps:steps,idx:0,picks:steps.map(function(){ return []; }),free:steps.map(function(){ return ''; })};
  /* 채팅 안에는 한 줄만 */
  taiThreadAdd('<div class="ska-note" id="'+id+'-n">'+(steps.length>1?'몇 가지만 여쭙겠습니다. 아래에서 '+steps.length+'개에 답해 주십시오':'아래에서 골라 주십시오')+' <span aria-hidden="true">↓</span></div>');
  dock.innerHTML='<div class="ska" id="'+id+'" role="dialog" aria-label="TETH의 질문"></div>';
  skaRender(id);
}
function skaRender(id){
  var el=document.getElementById(id), st=(TAI.qcfg||{})[id]; if(!el||!st) return;
  var s=st.steps[st.idx], n=st.steps.length, multi=!!s.multi, freeOn=st.freeOn===st.idx;
  var pg=n>1?'<span class="pg"><button type="button" aria-label="이전 질문" onclick="skaNav(\''+id+'\',-1)"'+(st.idx===0?' disabled':'')+'>'+SKA_CHEV_L+'</button><span>'+n+'개 중 '+(st.idx+1)+'</span><button type="button" aria-label="다음 질문" onclick="skaNav(\''+id+'\',1)"'+(st.idx===n-1?' disabled':'')+'>'+SKA_CHEV_R+'</button></span>':'';
  el.innerHTML='<div class="hd"><b>'+gEsc(s.title||'몇 가지만 확인하겠습니다')+'</b>'+pg+'<button type="button" class="x" aria-label="닫기" onclick="taiAskClose(\''+id+'\')">✕</button></div>'
    +'<div class="ops">'+s.options.slice(0,6).map(function(o,i){ var on=st.picks[st.idx].indexOf(i)>=0; return '<button type="button" class="op'+(on?' on':'')+'" aria-pressed="'+on+'" onclick="skaPick(\''+id+'\','+i+')"><b>'+gEsc(o.t)+'</b>'+(o.d?'<span>'+gEsc(o.d)+'</span>':'')+'</button>'; }).join('')
    +(freeOn?'<div class="op free"><input id="'+id+'-f" type="text" placeholder="직접 답을 적어 주십시오" value="'+gEsc(st.free[st.idx]||'')+'" onkeydown="if(event.key===\'Enter\'){event.preventDefault();skaFree(\''+id+'\');}"><button type="button" class="send" onclick="skaFree(\''+id+'\')">확인</button></div>'
      :'<button type="button" class="op" onclick="skaFreeOpen(\''+id+'\')"><b>직접 답변 작성</b></button>')+'</div>'
    +'<div class="ft"><button type="button" class="lk" onclick="taiAskSkip(\''+id+'\')">AI가 알아서 판단</button>'+(multi?'<button type="button" class="go" onclick="skaNext(\''+id+'\')">'+(st.idx<n-1?'다음':'보내기')+'</button>':'')+'</div>';
  if(freeOn){ var f=document.getElementById(id+'-f'); if(f) try{ f.focus(); }catch(e){} }
}
function skaNav(id,dir){ var st=(TAI.qcfg||{})[id]; if(!st) return; st.freeOn=null; st.idx=Math.max(0,Math.min(st.steps.length-1,st.idx+dir)); skaRender(id); }
function skaPick(id,i){ var st=(TAI.qcfg||{})[id]; if(!st) return; var s=st.steps[st.idx], p=st.picks[st.idx];
  if(s.multi){ var k=p.indexOf(i); if(k>=0) p.splice(k,1); else p.push(i); skaRender(id); return; }
  st.picks[st.idx]=[i]; st.free[st.idx]=''; skaNext(id); }
function skaFreeOpen(id){ var st=(TAI.qcfg||{})[id]; if(!st) return; st.freeOn=st.idx; skaRender(id); }
function skaFree(id){ var st=(TAI.qcfg||{})[id]; if(!st) return; var f=document.getElementById(id+'-f'), v=(f&&f.value||'').trim(); if(!v){ toast('답을 적어 주십시오'); return; } st.free[st.idx]=v; st.picks[st.idx]=[]; st.freeOn=null; skaNext(id); }
function skaNext(id){ var st=(TAI.qcfg||{})[id]; if(!st) return;
  if(st.idx<st.steps.length-1){ st.idx++; skaRender(id); return; }
  skaSend(id); }
function skaSend(id){
  var st=(TAI.qcfg||{})[id]; if(!st) return;
  if(TAI.req||(TAI.busy&&Date.now()-(TAI.busyAt||0)<180000)){ toast('이전 답변을 마무리하는 중입니다, 끝나면 다시 눌러 주십시오'); return; }
  var parts=[], rows='';
  for(var k=0;k<st.steps.length;k++){
    var ttl=(st.steps[k].title||'').replace(/[?？].*$/,'').trim();
    var vals=st.free[k]||st.picks[k].map(function(i){ return st.steps[k].options[i].t; }).join(', ');
    if(!vals) continue;
    parts.push((ttl?ttl+': ':'')+vals); rows+='<div class="rw"><b>'+gEsc(ttl||'답')+'</b><span>'+gEsc(vals)+'</span></div>';
  }
  taiAskClose(id);
  if(!parts.length){ taiAskSkipText(); return; }
  taiNextClear(); taiActClear();
  taiThreadAdd('<div class="g-usum">'+rows+'</div>'); gUserPin();
  var fin=S.versions.length?S.versions[S.versions.length-1]:null;
  taiMarket(parts.join(' / ')+' 기준으로 진행해줘',fin,function(){ gConvAI('네트워크 연결을 확인한 뒤 다시 시도해 주십시오.'); });
}
function taiAskSkipText(){ var f=document.getElementById('g-in'); if(f){ f.value='세부 조건은 알아서 합리적으로 판단해서 바로 진행해줘'; gSend(); } }
(function(){
  taiAskCard=skaCard; taiAskRender=skaRender;
  taiAskClose=function(id){ var el=document.getElementById(id); if(el) el.remove(); var d=document.getElementById('g-askdock'); if(d&&!d.children.length) d.remove(); var n=document.getElementById(id+'-n'); if(n){ n.textContent='질문에 답했습니다'; n.classList.add('done'); } if(TAI.qcfg) delete TAI.qcfg[id]; };
  taiAskSkip=function(id){ taiAskClose(id); taiAskSkipText(); };
  /* "바로 실행" 류 단추: 고정 질문 다섯 개 대신 AI에게 보낸다. AI가 모르는 것만 [ASK]로 묻는다 */
  var ts0=tfStart; tfStart=function(act){
    if(act&&act.label&&G.mode==='conv'&&document.getElementById('g-in')&&!(act.fixed)){ var f=document.getElementById('g-in'); f.value=act.label; gSend(); return; }
    return ts0.apply(this,arguments); };
})();
/* 전략 설계서 카드가 사용자의 말을 그대로 보여 준다: RSI 숫자는 그대로 엔진 기준값으로, 계산하지 못한 조건은 "검증에서 뺀 조건"으로 */
(function(){
  var ai1=tfAiStrategy;
  tfAiStrategy=function(sp){
    if(!sp||(window.RV&&RV.on&&!RV.apply)) return ai1.apply(this,arguments);
    var rsi=(sp.rsi!=null&&isFinite(+sp.rsi))?Math.max(5,Math.min(70,Math.round(+sp.rsi))):null;
    var skip=Array.isArray(sp.skip)?sp.skip.map(function(x){ return String(x||'').trim(); }).filter(Boolean).slice(0,4):[];
    if(rsi==null&&!skip.length) return ai1.apply(this,arguments);
    var sp2={}; for(var k in sp) sp2[k]=sp[k]; if(rsi!=null){ TF_AI_DEPTH.__rsi=rsi; sp2.depth='__rsi'; }
    var ta=taiThreadAdd;
    taiThreadAdd=function(h){
      if(typeof h==='string'&&h.indexOf('class="tf-sum"')>=0){
        if(rsi!=null) h=h.replace(/(<span class="v">)[^<]*?밀렸다가 하루 0\.5% 넘게 반등한 날/,'$1RSI가 '+rsi+' 아래로 내려갔다가 하루 0.5% 넘게 반등한 날');
        if(skip.length) h=h.replace('</div><div style="font-size:11.5px','<div class="r"><span class="k">검증에서 뺀 조건</span><span class="v">'+gEsc(skip.join(', '))+'</span></div></div><div style="font-size:11.5px');
      }
      return ta.apply(this,arguments.length?[h].concat([].slice.call(arguments,1)):arguments);
    };
    try{ return ai1.call(this,sp2); } finally{ taiThreadAdd=ta; delete TF_AI_DEPTH.__rsi; }
  };
})();
