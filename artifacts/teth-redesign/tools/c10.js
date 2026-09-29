
/* 관심 전략: 로그인한 사람만 저장한다. 비로그인이면 가입 창을 띄우고, 가입이나 로그인을 마치면 누르려던 전략을 추가한다 */
function mkAuthHook(){
  if(window.MK_AUTH_HOOKED) return; window.MK_AUTH_HOOKED=true;
  var ao=window.authOpen; if(typeof ao==='function') window.authOpen=function(){ window.MK_WATCH_RESUME=null; return ao.apply(this,arguments); };
  var sd=window.signupDone; if(typeof sd==='function') window.signupDone=function(){
    var r=window.MK_WATCH_RESUME; window.MK_WATCH_RESUME=null;
    var out=sd.apply(this,arguments);
    if(r&&S.user){ setTimeout(function(){ var s=tfSSFind(decodeURIComponent(r.ne)); if(!s||s.me) return; var t=tfS(); t.watch=t.watch||[]; if(t.watch.indexOf(s.nick)<0){ t.watch.push(s.nick); tfSave(); toast('관심 전략에 추가했어요'); } mkWatchSync(r.ne); },400); }
    return out;
  };
}
function tfSS3WatchTgl(ne){
  var nick; try{ nick=decodeURIComponent(ne); }catch(e){ return; }
  if(!S.user){ mkAuthHook(); authOpen('signup'); window.MK_WATCH_RESUME={ne:ne}; return; } /* authOpen 이 비우므로 그 뒤에 기록 */
  var sW=tfSSFind(nick); if(sW&&!sW.me) nick=sW.nick;
  var t=tfS(); t.watch=t.watch||[];
  var i=t.watch.indexOf(nick);
  if(i>=0){ t.watch.splice(i,1); toast('관심 전략에서 제외했어요'); }
  else { t.watch.push(nick); toast('관심 전략에 추가했어요. 전략 따라하기 화면에서 모아볼 수 있어요'); }
  tfSave(); tfTrack('strategy_watch',{nick:nick,on:i<0});
  var b=$('ss3-watch-btn'); if(b){ b.innerHTML=tfSS3WatchLb(i<0); b.setAttribute('aria-pressed',String(i<0)); }
  else if(G.mode==='tfss3') tfShareHub('follow'); /* 팔로우 탭의 관심 섹션에서 해제한 경우 목록 재렌더 */
}
/* 목록에 처음 들어올 때만 카드가 차례로 올라온다. 정렬, 판단 방식 전환, 검색은 그대로 바뀐다 */
var MK_HUB_TAB=null;
function mkCardsEnter(){
  var g=document.querySelector('.mk3-grid'); if(!g) return;
  try{ if(matchMedia('(prefers-reduced-motion: reduce)').matches) return; }catch(e){}
  [].forEach.call(g.children,function(c,i){ c.style.setProperty('--i',i); });
  g.classList.add('mk3-enter');
  setTimeout(function(){ g.classList.remove('mk3-enter'); },1400);
}
