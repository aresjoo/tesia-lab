/* ═══ 전략 목록 "내 거래소" 필터 (sk-myex, 파운더 2026-10-02) ═══
   거래소를 연결한 사람에게만 보인다. 기본은 꺼짐(전체). 거래소 1개면 토글, 2개 이상이면 작은 목록(연결한 거래소 전체 / 거래소별 / 끄기).
   추천순, 시장, 판단 방식 탭, 검색과 같이 걸린다. 켠 상태는 이 브라우저에 기억 */
var TF_MYEX_N=0;
function tfMyExConn(){ try{ return (S.user&&typeof acConnList==='function')?acConnList().filter(function(k){ return typeof acConnOk!=='function'||acConnOk(k); }):[]; }catch(e){ return []; } }
function tfMyExGet(){ var c=tfMyExConn(); if(!c.length) return ''; var v=''; try{ v=localStorage.getItem('teth.myex')||''; }catch(e){} if(v&&v!=='all'&&c.indexOf(v)<0) v='all'; return v; }
function tfMyExOn(){ return !!tfMyExGet(); }
function tfMyExIds(){ var v=tfMyExGet(), c=tfMyExConn(); return !v?[]:v==='all'?c:[v]; }
function tfMyExFilter(rows){ var ids=tfMyExIds(); if(!ids.length){ TF_MYEX_N=rows.length; return rows; }
  var r=rows.filter(function(s){ if(s.me) return false; var ex=mkEx(s); var id=String(ex&&ex[0]||'').replace(/^app-/,''); return ids.indexOf(id)>=0; }); TF_MYEX_N=r.length; return r; }
function tfMyExSet(v){ try{ if(v) localStorage.setItem('teth.myex',v); else localStorage.removeItem('teth.myex'); }catch(e){} tfMyExMenu(false); var t=tfSSState(); t.ss.page=1; tfShareHub('find'); }
function tfMyExNames(ids){ return ids.map(function(k){ return typeof acName==='function'?acName(k):k; }).join(', '); }
function tfMyExChip(){ var c=tfMyExConn(); if(!c.length) return ''; var v=tfMyExGet(), on=!!v, ids=on?tfMyExIds():c;
  var ic=ids.slice(0,3).map(function(k){ return tbIcon(k,16); }).join('');
  var lb=!on||v==='all'?'내 거래소':gEsc(tfMyExNames([v]))+'만';
  var act=c.length>1?'tfMyExMenu()':(on?'tfMyExSet(\'\')':'tfMyExSet(\'all\')');
  return '<div class="myex-w"><button type="button" class="myex'+(on?' on':'')+'" aria-pressed="'+on+'"'+(c.length>1?' aria-haspopup="true" aria-expanded="false"':'')+' onclick="event.stopPropagation();'+act+'"><span class="myex-ic">'+ic+'</span>'+lb+(c.length>1?' '+(typeof MKT_CHEV!=='undefined'?MKT_CHEV:'▾'):'')+'</button></div>'; }
function tfMyExMenu(open){ var w=document.querySelector('.myex-w'); if(!w) return; var m=w.querySelector('.myex-m'), b=w.querySelector('.myex');
  if(open===false||(open==null&&m)){ if(m) m.remove(); if(b) b.setAttribute('aria-expanded','false'); return; }
  var c=tfMyExConn(), v=tfMyExGet();
  var it=function(val,lab,ic){ var cur=(v||'')===val; return '<button type="button" role="menuitemradio" aria-checked="'+cur+'" class="'+(cur?'on':'')+'" onclick="event.stopPropagation();tfMyExSet(\''+val+'\')">'+(ic||'')+'<span>'+lab+'</span></button>'; };
  var h='<div class="myex-m" role="menu">'+it('all','연결한 거래소 전체',c.slice(0,3).map(function(k){ return tbIcon(k,16); }).join(''))+c.map(function(k){ return it(k,gEsc(tfMyExNames([k]))+'만',tbIcon(k,16)); }).join('')+it('','끄기, 전체 전략 보기','')+'</div>';
  w.insertAdjacentHTML('beforeend',h); if(b) b.setAttribute('aria-expanded','true'); }
document.addEventListener('click',function(e){ if(!e.target.closest||!e.target.closest('.myex-w')) tfMyExMenu(false); });
document.addEventListener('keydown',function(e){ if(e.key==='Escape') tfMyExMenu(false); });
(function(){
  /* 조작 줄: 시장 선택 바로 뒤에 알약 */
  var c0=mk3Controls; mk3Controls=function(){ var h=c0.apply(this,arguments); try{ var chip=tfMyExChip(); if(!chip) return h;
    var d=document.createElement('div'); d.innerHTML=h; var s=d.querySelector('.skf-sort'), mkt=d.querySelector('#ss3-m-asset'); var anchor=mkt?(mkt.closest('.tfbk-drop')||mkt.parentNode):s;
    if(anchor&&anchor.parentNode){ var x=document.createElement('div'); x.innerHTML=chip; anchor.parentNode.insertBefore(x.firstChild,anchor.nextSibling); return d.innerHTML; } }catch(e){} return h; };
  /* 목록: 켰을 때 안내 한 줄, 없을 때 안내와 전체 보기 */
  var g0=tfSS3GridHtml; tfSS3GridHtml=function(){ var h=g0.apply(this,arguments); try{ if(!tfMyExOn()) return h; var ids=tfMyExIds(), nm=gEsc(tfMyExNames(ids));
    if(!TF_MYEX_N||h.indexOf('ss3-empty')>=0) return '<div class="myex-empty"><p>'+nm+'에서 실행할 수 있는 전략이 아직 없습니다.</p><button type="button" class="pl-link" onclick="tfMyExSet(\'\')">전체 보기</button></div>';
    return '<p class="myex-note">'+nm+'에서 바로 실행할 수 있는 전략 '+TF_MYEX_N+'개입니다.</p>'+h; }catch(e){} return h; };
  var r0=tfSS3Reset; tfSS3Reset=function(){ try{ localStorage.removeItem('teth.myex'); }catch(e){} return r0.apply(this,arguments); };
})();
