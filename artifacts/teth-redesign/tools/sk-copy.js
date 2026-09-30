/* ═══ 전략 복사 창을 ChatGPT 어휘로 (sk-copy) ═══
   결정 두 개(얼마로, 얼마 잃으면 멈출지). 창은 유지하고 안을 다시 구성한다.
   순서: 전략 이름과 레버리지 한 줄 → 복사 예산 → 손실 중단 기준(알약) → 확인 행 → 복사 설정(접힘) → 흰 알약 단추.
   거래소가 연결되지 않은 회원은 이 창 대신 플랜 화면으로 간다. 입력 검증과 시작은 기존 cpFormSync, cpStart 그대로. */
var SKC_LOSS=[-10,-20,-30,-50];
function skcLev(s){ var c=s&&s.cfg; return c&&c.fut&&c.lev>1?c.lev:0; }
function skcSub(s){ var by=s.by?'@'+s.by:''; var sc=mkScope(s)+(fuIs(s)?' 선물':''); return [by,sc].filter(Boolean).join(', '); }
function skcRow(k,v,id){ return '<div class="r"><span>'+k+'</span><b'+(id?' id="'+id+'"':'')+' class="num">'+v+'</b></div>'; }
function skcSheet(ne){
  var nick; try{ nick=decodeURIComponent(ne); }catch(e){ nick=ne; }
  var s2=tfSSFind(nick), pt=$('mk-follow')&&TF_MKF.trig&&document.body.contains(TF_MKF.trig)?TF_MKF.trig:null;
  if(!s2||s2.me){ toast('지금은 복사할 수 없는 전략입니다'); return; }
  nick=s2.nick; ne=tfSSNe(nick);
  mkFollowClose(true); tfSS3DlgClose(true);
  var d=tfDerive(), can=!!(d.entitlement&&d.entitlement.follow);
  TF_MKF={loss:-20,existing:'skip',cap:95,ne:ne,nick:nick,trig:pt||document.activeElement};
  if(!can){ tfMkActivate(); return; } /* 거래소 미연결: 플랜 화면으로 */
  var cp=cpState(), min=mkMin(s2), lev=skcLev(s2); TF_MKF.min=min;
  var w=document.createElement('div'); w.className='mk-follow-w skc-w'; w.id='mk-follow';
  w.innerHTML='<div class="mk-follow skc" role="dialog" aria-modal="true" aria-labelledby="mk-f-t">'
    +'<div class="skc-body">'+'<div class="skc-hd"><h2 id="mk-f-t">전략 복사</h2><button type="button" class="mk-f-x" aria-label="닫기" onclick="mkFollowClose()">✕</button></div>'
    +'<div class="skc-strat"><div class="nm">'+mkGlyph(s2,32)+'<div><b>'+gEsc(mkTitle(s2))+'</b><span>'+gEsc(skcSub(s2))+'</span></div></div>'
    +(lev?'<p class="skc-lev">현재 레버리지는 <span class="num">'+lev+'배</span>입니다. 원본에서 바꾸면 내 복사에도 적용됩니다.</p>':'')+'</div>'
    +'<div class="skc-fld" id="cps-amt-fld"><label for="cps-amt">복사 예산</label>'
    +'<div class="skc-in"><i>$</i><input id="cps-amt" type="number" inputmode="decimal" min="'+min+'" placeholder="'+min+'" oninput="cpFormSync()" aria-describedby="skc-amt-h cps-amt-err"><button type="button" class="mx" onclick="$(\'cps-amt\').value='+Math.floor(cp.spot)+';cpFormSync()">최대</button></div>'
    +'<div class="skc-hint" id="skc-amt-h">사용 가능 <b class="num" id="cps-spot">'+cpUsd(cp.spot,0)+'</b>, 최소 <span class="num">'+cpUsd(min,0)+'</span>'+'</div>'
    +'<div class="skc-err" id="cps-amt-err" role="alert"></div></div>'
    +'<div class="skc-fld"><span class="lb" id="skc-loss-l">손실 중단 기준</span>'
    +'<div class="skc-pills" role="radiogroup" aria-labelledby="skc-loss-l">'+SKC_LOSS.map(function(v){ return '<button type="button" role="radio" aria-checked="'+(v===-20)+'" class="'+(v===-20?'on':'')+'" onclick="skcLoss('+v+',this)">'+Math.abs(v)+'%</button>'; }).join('')+'</div>'
    +'<div class="skc-hint" id="mk-f-lossh">예산의 20%를 잃으면 복사를 자동으로 멈춥니다.</div></div>'
    +'<div class="skc-sum" id="mk-f-sum"></div>'
    +'<p class="skc-more"><button type="button" class="pl-link" id="skc-more-b" aria-expanded="false" onclick="skcMore()">세부 설정</button></p>'
    +'<div class="skc-adv" id="skc-adv" hidden>'
    +'<div class="skc-fld"><span class="lb" id="skc-ex-l">복사 시작 시점</span><div class="skc-pills two" id="mk-f-ex" role="radiogroup" aria-labelledby="skc-ex-l"><button type="button" role="radio" aria-checked="true" class="on" onclick="skcEx(\'skip\',this)">다음 진입부터</button><button type="button" role="radio" aria-checked="false" onclick="skcEx(\'copy\',this)">현재 포지션부터</button></div><div class="skc-hint" id="skc-ex-h">원본이 새로 진입할 때부터 따라갑니다.</div></div>'
    +'<div class="skc-fld skc-cap"><label for="mk-f-cap">주문당 예산 한도</label><div class="skc-in sm"><input id="mk-f-cap" type="number" inputmode="numeric" min="5" max="95" step="5" value="95" oninput="mkFollowCap(this.value);cpFormSync()"><i>%</i></div></div>'
    +'<div class="skc-hint">한 번의 주문에 쓰는 예산 비율입니다.</div></div>'
    +'</div><div class="skc-ft">'+'<button type="button" class="pl-cta pl-cta-w skc-cta" id="cps-cta" disabled onclick="cpStart(\''+ne+'\')">전략 복사 시작</button>'
    +'<p class="skc-foot">복사는 무료이며 언제든 멈출 수 있습니다.</p></div>'
    +'<div id="mk-f-live" role="status" aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"></div>'
    +'</div>';
  w.addEventListener('click',function(e){ if(e.target===w) mkFollowClose(); });
  document.body.appendChild(w);
  mkFollowInert(true,w);
  var gs=$('g-scroll'); if(gs) gs.style.overflow='hidden';
  document.addEventListener('keydown',mkFollowEsc);
  cpFormSync();
  var inp=$('cps-amt'); if(inp&&innerWidth>760){ try{ inp.focus(); }catch(e){} }
}
function skcLoss(v,btn){ TF_MKF.loss=v; var g=btn&&btn.parentNode; if(g) [].forEach.call(g.children,function(b){ var on=b===btn; b.classList.toggle('on',on); b.setAttribute('aria-checked',String(on)); });
  var h=$('mk-f-lossh'); if(h) h.textContent='예산의 '+Math.abs(v)+'%를 잃으면 복사를 자동으로 멈춥니다.'; cpFormSync(); }
function skcEx(v,btn){ mkFollowExisting(v,btn); var h=$('skc-ex-h'); if(h) h.textContent=v==='copy'?'원본이 지금 가진 포지션을 현재 가격으로 바로 따라 삽니다.':'원본이 새로 진입할 때부터 따라갑니다.'; var g=btn&&btn.parentNode; if(g) [].forEach.call(g.children,function(b){ b.setAttribute('aria-checked',String(b===btn)); }); }
function skcMore(){ var a=$('skc-adv'), b=$('skc-more-b'); if(!a) return; a.hidden=!a.hidden; if(b){ b.setAttribute('aria-expanded',String(!a.hidden)); b.textContent=a.hidden?'세부 설정':'세부 설정 접기'; } }
/* 확인 행: 지금 고른 값을 항상 보인다 (바꾼 값도 그대로) */
function skcSum(v){ var el=$('mk-f-sum'); if(!el) return; var L=Math.abs(TF_MKF.loss||20); if(v==null){ var raw=parseFloat(($('cps-amt')||{}).value); if(isFinite(raw)&&raw>0) v=raw; }
  el.innerHTML=skcRow('복사 예산',v==null?'<em>미입력</em>':cpUsd(v,0))
    +skcRow('손실 중단 기준',v==null?L+'%':cpUsd(v*L/100,0)+' ('+L+'%)')
    +skcRow('시작 시점',TF_MKF.existing==='copy'?'현재 포지션부터':'다음 진입부터')
    +skcRow('주문당 예산 한도',(TF_MKF.cap||95)+'%');
  var live=$('mk-f-live'); if(live&&v!=null) live.textContent='복사 예산 '+cpUsd(v,0)+', 손실 '+L+'%에서 멈춤'; }
(function(){
  mkFollowSheet=skcSheet;
  mkFollowSum=skcSum;
})();
/* 전략 복사 화면: 탭(전략 찾기, 복사한 전략, 내 공유)을 없애고 전략 목록만. 복사한 전략 관리는 터미널 오른쪽 칸 */
(function(){
  var h0=tfShareHub; tfShareHub=function(tab){ if(tab==='follow'){ tfNav('#/trade'); return; } var r=h0.call(this,'find'); var tb=document.querySelector('.ss3.mk .mk-tabs'); if(tb) tb.remove(); return r; };
  /* 대화로 만든 전략은 백테스트를 마치면 자동으로 공개 (파운더 결정 2026-10-01) */
  var md0=btMineDone; btMineDone=function(){ var r=md0.apply(this,arguments); try{ skcAutoPublish(); }catch(e){} return r; };
})();
function skcAutoPublish(){
  var t=tfS(), s=BT.s; if(!s||!s.mine||!t.cur) return;
  var nm=(s.name&&String(s.name).trim())||mkHook(s), first=!t.shared||!t.sharedSnap||t.sharedSnap.name!==nm;
  t.sharedName=nm;
  t.sharedSnap={name:nm,asset:(t.intake&&t.intake.asset)||s.asset||'',score:t.score||0,ret:t.cur.ret,mdd:t.cur.mdd,n:t.cur.n,winRate:t.cur.winRate||0,p:t.cur.p?JSON.parse(JSON.stringify(t.cur.p)):null,srcAt:null,desc:'',at:new Date().toISOString().slice(0,10),auto:1};
  t.shared=true; tfSave();
  if(first) try{ tfTrack('ss_auto_publish',{name:nm}); }catch(e){}
}
