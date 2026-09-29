/* 체험 예산 추가. 따라가기 시트 안에서는 확인 창을 띄우지 않고 그 자리에서 더한다:
   창을 겹치지 않으니 확인 버튼과 시작 버튼이 같은 자리에 놓일 일이 없고, 입력하던 값도 그대로다 */
function cpTopup(ne){
  if(!$('mk-follow')){
    tfSS3Dlg('체험 예산 추가','<div class="ntc">체험용 예산 1,000 USDT를 추가해요.</div>'
      +'<div class="acts3" style="margin-top:16px"><button type="button" class="obtn" onclick="tfSS3DlgClose()">취소</button>'
      +'<button type="button" class="wbtn" onclick="cpTopupDo(\''+ne+'\')">+1,000 USDT 추가</button></div>');
    return;
  }
  var cp=cpState(), min=TF_MKF.min||0; if(cp.spot>=min) return; /* 연달아 눌러도 모자랄 때만 */
  cp.spot+=1000; tfSaveNow();
  var el=$('cps-spot'), mx=document.querySelector('#mk-follow .mx'), lk=document.querySelector('#mk-follow .mk-f-hint .mk-lnk'), a=$('cps-amt');
  if(el) el.textContent=cpUsd(cp.spot,0);
  if(mx) mx.setAttribute('onclick',"$('cps-amt').value="+Math.floor(cp.spot)+";cpFormSync()");
  if(lk&&cp.spot>=min){ var had=document.activeElement===lk; lk.remove(); if(had&&a){ try{ a.focus(); }catch(e){} } }
  cpFormSync();
  var lv=$('mk-f-live'); if(lv) lv.textContent='1,000 USDT를 추가했어요. 사용 가능 '+cpUsd(cp.spot,0);
}
function cpTopupDo(ne){
  if(!$('ss3-dlgw')) return; /* 두 번 눌러도 한 번만 */
  cpState().spot+=1000; tfSaveNow(); tfSS3DlgClose(); toast('1,000 USDT를 추가했어요'); mkFollowSheet(ne);
}
