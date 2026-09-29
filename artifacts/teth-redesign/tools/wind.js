/* ── 따라가기 중단: 세 선택이 실제로 다르게 움직인다 ──
   지금 정리: 바로 정산. 원본 청산 대기, 직접 관리: 새 진입만 멈추고 열린 포지션은 남긴다(winding).
   남은 포지션이 없어지면(원본이 청산했거나 내가 정리하면) 그때 한 번 정산한다 */
function mkStopGo(cid,mode){
  var c2=cpFind(cid); if(!c2||c2.status!=='active') return;
  c2.stopMode=MK_STOP_L[mode]?mode:'now';
  var d=cpCalc(c2);
  if(c2.stopMode==='now'||!d.posOpen||d.missing){ cpClose(cid); return; }
  c2.winding=true; c2.windAt=Date.now();
  tfSaveNow(); tfSS3DlgClose();
  toast('새 진입을 멈췄어요. 열린 포지션은 '+(c2.stopMode==='wait'?'원본 전략이 청산할 때 함께 정리해요':'내가 정리할 때까지 남아 있어요'));
  if(location.hash.indexOf('#/share/c/')===0) cpDetailView(cid,'pos'); else tfShareHub('follow');
}
function mkWindActs(cid){
  var c2=cpFind(cid)||{};
  return '<span class="cps-static" style="align-self:center">새 진입 멈춤, '+(c2.stopMode==='wait'?'원본 전략이 청산하면 함께 정리':'열린 포지션은 내가 정리')+'</span>'
    +'<button type="button" class="ss3-dbtn" onclick="cpFlatDlg(\''+cid+'\')">포지션 정리하고 끝내기</button>';
}
function mkWindCheck(){
  var cp=cpState(); if(!cp||!cp.copies) return;
  cp.copies.forEach(function(c){ if(c.status==='active'&&c.winding){ var d=cpCalc(c); if(!d.missing&&!d.posOpen) cpClose(c.id,true); } });
}
function cpFlatDlg(cid){
  var c2=cpFind(cid); if(!c2) return; var d=cpCalc(c2);
  tfSS3Dlg(c2.winding?'포지션 정리하고 끝내기':'포지션 전체 정리','<div class="ntc">열려 있는 따라가기 포지션을 현재가로 정리해요.<br>미실현 '+cpUsd(d.unreal)+'이 실현 손익으로 확정되고, '+(c2.winding?'따라가기를 끝내고 예산을 돌려받아요.':'따라가기는 유지되어 다음 진입부터 다시 따라가요.')+'</div>'
    +'<div class="acts3" style="margin-top:16px"><button type="button" class="obtn" onclick="tfSS3DlgClose()">취소</button>'
    +'<button type="button" class="ss3-dbtn" onclick="cpFlat(\''+cid+'\')">정리하기</button></div>');
}
function cpFlat(cid){
  var c2=cpFind(cid); if(!c2||c2.status!=='active') return;
  var s2=tfSSFind(c2.nick); if(!s2||!s2.r.eq||!s2.r.eq.length) return;
  c2.flatI=s2.r.eq[s2.r.eq.length-1].i; /* 이후 손익 계산 구간을 여기서 고정 */
  tfTrack('cp_flat',{id:cid});
  if(c2.winding){ cpClose(cid); return; } /* 남은 포지션이 없으니 여기서 정산 */
  tfSaveNow(); tfSS3DlgClose();
  toast('포지션을 정리했어요. 다음 진입부터 다시 따라갑니다');
  cpDetailView(cid,'pos');
}
/* 따라가는 중 화면을 열 때 정리 대기 계정을 확인한다 */
var mkHub0=tfShareHub; tfShareHub=function(){ try{ mkWindCheck(); }catch(e){} return mkHub0.apply(this,arguments); };
/* 즐겨찾기: 저장 상태에서 머리글 버튼과 더 보기 버튼을 함께 맞춘다 */
function mkWatchSync(ne){
  var nick; try{ nick=decodeURIComponent(ne); }catch(e){ nick=ne; }
  var s=tfSSFind(nick), on=(tfS().watch||[]).indexOf(s?s.nick:nick)>=0;
  var h=document.querySelector('.mkd-fav'), b=$('ss3-watch-btn');
  if(h) h.setAttribute('aria-pressed',String(on));
  if(b){ b.innerHTML=tfSS3WatchLb(on); b.setAttribute('aria-pressed',String(on)); }
}
