/* ═══ 예약 주문 (sk-order) ═══
   한 번만 하는 조건부 주문. AI가 빠진 것만 묻고(ASK), 다 갖춰지면 [ORDER] 태그 → 카드 하나(문장, 거리, 흰 단추 "예약하기", 링크 "조건 바꾸기").
   예약하면 같은 카드가 "대기 중"이 되고 터미널 미체결 주문에 "조건 대기" 행으로 보인다. 이용료 없음(파운더). 매수, 매도, 롱, 숏 모두. */
var OD_SIDE={buy:'한 번 매수합니다',sell:'한 번 매도합니다',long:'한 번 롱으로 진입합니다',short:'한 번 숏으로 진입합니다'};
var OD_SIDE_S={buy:'매수',sell:'매도',long:'롱',short:'숏'};
var OD_TTL={gtc:'취소하기 전까지 유지',"7d":'7일 동안 유지',"1d":'하루 동안 유지'};
function odS(){ var t=tfS(); t.orders=t.orders||[]; return t.orders; }
function odSym(a){ a=String(a||''); var tk=(typeof MK_TK!=='undefined'&&MK_TK[a])||(typeof TF_ASSET_TICKER!=='undefined'&&TF_ASSET_TICKER[a])||a; return tk; }
function odExName(){ var t=tfS(); var ex=t.api&&t.api.ex; return ex?((typeof tfExName==='function'&&tfExName(ex))||ex):''; }
function odLast(a){ try{ var tk=odSym(a); var c=TAI.chart; if(c&&c.label&&(c.label===a||String(c.tv||'').indexOf(tk)>=0)){ var ai=typeof taiAI==='function'&&taiAI(); var o=(ai&&ai.ohlc)||TAI.ohlc; if(o&&o.last) return +o.last; } if(window.TETH_PX&&TETH_PX.px&&TETH_PX.px[a]){ var px=TETH_PX.px[a]; var v=px[px.length-1]; return +(Array.isArray(v)?v[4]||v[1]:v)||null; } }catch(e){} return null; }
function odUsd(v){ return '$'+Math.round(+v).toLocaleString(); }
function odNorm(sp){
  sp=sp||{}; var o={asset:String(sp.asset||'').trim(),side:(/^(buy|sell|long|short)$/.test(sp.side)?sp.side:'sell'),trigger:isFinite(+sp.trigger)&&+sp.trigger>0?+sp.trigger:null,
    pct:isFinite(+sp.triggerPct)?+sp.triggerPct:null,qty:(/^(all|half|num)$/.test(sp.qty)?sp.qty:'all'),qtyNum:isFinite(+sp.qtyNum)&&+sp.qtyNum>0?+sp.qtyNum:null,
    lev:isFinite(+sp.lev)&&+sp.lev>1?Math.round(+sp.lev):null,ttl:(/^(gtc|7d|1d)$/.test(sp.ttl)?sp.ttl:'gtc')};
  var last=odLast(o.asset); if(o.trigger==null&&o.pct!=null&&last) o.trigger=Math.round(last*(1+o.pct/100));
  o.last=last; return o;
}
function odQtyText(o){ var tk=odSym(o.asset); if(o.qty==='num'&&o.qtyNum) return o.qtyNum+' '+tk+'를'; if(o.qty==='half') return '주문 시점 보유 '+tk+'의 절반을'; return (o.side==='buy'||o.side==='long')?'정한 금액만큼':'주문 시점 보유 '+tk+' 전부를'; }
function odLine(o){
  var tk=odSym(o.asset), ex=odExName()||'연결한 거래소';
  var up=o.trigger&&o.last?o.trigger>=o.last:(o.pct!=null?o.pct>=0:(o.side==='sell'||o.side==='short'));
  var when=o.trigger?tk+'가 '+odUsd(o.trigger)+(up?' 이상이 되면':' 이하가 되면'):(o.pct!=null?tk+'가 지금보다 '+(o.pct>0?'+':'')+o.pct+'% 움직이면':tk+'가 조건 가격에 닿으면');
  var lev=o.lev?(o.lev+'배로 '):'';
  return when+' '+ex+'에서 '+odQtyText(o)+' '+lev+OD_SIDE[o.side];
}
function odDist(o){ if(!o.trigger||!o.last) return ''; var d=(o.trigger/o.last-1)*100; return '지금 '+odUsd(o.last)+', 목표까지 '+(d>=0?'+':'')+d.toFixed(1)+'%'; }
function odCardHtml(x){
  var st=x.status||'draft', line=odLine(x), dist=odDist(x), ttl=OD_TTL[x.ttl]||OD_TTL.gtc;
  var head=st==='wait'?'<div class="od-st"><i></i>조건 대기</div>':st==='done'?'<div class="od-st"><i></i>체결 완료</div>':st==='cancel'?'<div class="od-st"><i></i>취소됨</div>':'';
  var acts='';
  if(st==='draft') acts='<div class="od-acts"><button type="button" class="tf-btn p" onclick="odPlace(\''+x.id+'\')">예약하기</button><button type="button" class="od-lk" onclick="odEdit(\''+x.id+'\')">조건 바꾸기</button></div>';
  else if(st==='wait') acts='<div class="od-acts"><button type="button" class="od-lk" onclick="odCancel(\''+x.id+'\')">예약 취소</button><button type="button" class="od-lk" onclick="tfNav(\'#/trade\')">터미널에서 보기</button></div>';
  return '<div class="tf-sum od-card '+st+'" id="'+x.id+'">'+head+'<p class="od-line">'+gEsc(line)+'.</p><p class="od-sub">'+(dist?gEsc(dist)+' <b>|</b> ':'')+gEsc(ttl)+(st==='done'&&x.fillAt?' <b>|</b> '+gEsc(stDate(x.fillAt)):'')+'</p>'+acts+'</div>';
}
function tfOrderCard(spec){
  var o=odNorm(spec); if(!o.asset){ taiThreadAdd('<div class="g-amsg"><p>어느 자산을 예약할지 알 수 없습니다. 자산을 말해 주십시오.</p></div>'); gScrollBottom(); return; }
  TAI.nn=(TAI.nn||0)+1; o.id='od'+Date.now().toString(36)+TAI.nn; o.status='draft'; o.at=Date.now(); o.sess=G.cur&&G.cur.id;
  odS().push(o); tfSave();
  taiThreadAdd(odCardHtml(o)); gScrollBottom();
}
function odFind(id){ return odS().filter(function(x){ return x.id===id; })[0]||null; }
function odRedraw(x){ var el=document.getElementById(x.id); if(el){ var d=document.createElement('div'); d.innerHTML=odCardHtml(x); el.replaceWith(d.firstChild); } }
function odPlace(id){
  var x=odFind(id); if(!x) return; var t=tfS();
  if(!t.api){ toast('먼저 거래소를 연결합니다'); window.TF_UP_CTX={ctx:'order',opt:{id:id}}; if(typeof tfAcSheet==='function') tfAcSheet('bitget'); else tfNav('#/plan'); return; }
  x.status='wait'; x.placedAt=Date.now(); x.ex=t.api.ex; tfSave(); odRedraw(x);
  toast('예약했습니다. 조건이 충족되면 한 번 주문합니다');
}
function odEdit(id){ var x=odFind(id); if(!x) return; var f=document.getElementById('g-in'); if(!f) return; f.value='예약 조건을 바꾸고 싶습니다: '; f.focus(); }
function odCancel(id){ var x=odFind(id); if(!x) return; x.status='cancel'; x.cancelAt=Date.now(); tfSave(); odRedraw(x); toast('예약을 취소했습니다'); if(document.querySelector('#g-content .tft-page')&&typeof tfTmBottom==='function') try{ tfTmBottom(); }catch(e){} }
function odFill(id,price){ var x=odFind(id); if(!x||x.status!=='wait') return; x.status='done'; x.fillAt=Date.now(); x.fillP=+price||x.trigger; tfSave(); odRedraw(x);
  if(typeof taiThreadAdd==='function'&&G.cur&&G.cur.id===x.sess) { taiThreadAdd('<div class="g-amsg"><p>'+gEsc(odSym(x.asset)+' '+odQtyText(x)+'를 '+odUsd(x.fillP)+'에 '+OD_SIDE_S[x.side]+'했습니다.')+'</p></div>'); gScrollBottom(); } }
/* 터미널 미체결 주문: 조건 대기 행을 위에 붙인다 */
function odRowsHtml(){
  var L=odS().filter(function(x){ return x.status==='wait'; }); if(!L.length) return '';
  return L.map(function(x){ var ex=(typeof tfExName==='function'&&x.ex&&tfExName(x.ex))||x.ex||'';
    return '<tr class="od-row"><td>'+gEsc(ex)+'</td><td>예약 주문</td><td class="num">'+gEsc(odSym(x.asset))+'</td><td><span class="od-tag">'+OD_SIDE_S[x.side]+(x.lev?' '+x.lev+'배':'')+'</span></td><td>조건 주문</td>'
      +'<td class="r num">'+(x.trigger?odUsd(x.trigger):'')+'</td><td class="r num">'+gEsc(x.qty==='num'&&x.qtyNum?String(x.qtyNum):(x.qty==='half'?'절반':'전부'))+'</td><td>조건 대기, '+gEsc({gtc:'취소 전까지','7d':'7일','1d':'하루'}[x.ttl]||'')+'</td>'
      +'<td class="r"><button type="button" class="od-cancel" onclick="odCancel(\''+x.id+'\')">취소</button></td></tr>'; }).join('');
}
/* 대화를 다시 열면 카드는 저장된 상태로 다시 그린다(터미널에서 취소한 뒤에도 맞게) */
function odSync(){ [].forEach.call(document.querySelectorAll('#g-thread .od-card'),function(el){ var x=odFind(el.id); if(x) { var d=document.createElement('div'); d.innerHTML=odCardHtml(x); if(d.firstChild.outerHTML!==el.outerHTML) el.replaceWith(d.firstChild); } }); }
(function(){ if(typeof gSelect==='function'){ var s0=gSelect; gSelect=function(){ var r=s0.apply(this,arguments); setTimeout(function(){ try{ odSync(); }catch(e){} },0); return r; }; } })();
(function(){
  if(typeof tfTmPane!=='function') return;
  var p0=tfTmPane; tfTmPane=function(k){ var h=p0.apply(this,arguments); if(k!=='open') return h; var rows=odRowsHtml(); if(!rows) return h;
    /* 표가 있으면 첫 행 앞에, 비어 있으면 표를 새로 */
    if(/<tbody>/.test(h)) return h.replace('<tbody>','<tbody>'+rows);
    return '<div class="tft-tblw"><table class="tft-tbl"><thead><tr><th>거래소</th><th>전략</th><th>심볼</th><th>방향</th><th>유형</th><th class="r">가격</th><th class="r">수량</th><th>상태</th><th class="r"></th></tr></thead><tbody>'+rows+'</tbody></table></div>'; };
})();
