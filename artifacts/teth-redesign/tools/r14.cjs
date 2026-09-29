const fs=require('fs'), D=__dirname+'/'; let s=fs.readFileSync(D+'rd-ui.js','utf8');
const one=(a,b)=>{ const n=s.split(a).length-1; if(n!==1) throw new Error('x'+n+': '+a.slice(0,60)); s=s.replace(a,()=>b); };
// 직접 관리는 원본이 청산해도 자동으로 끝내지 않는다(내가 정리할 때까지)
one("if(c.status==='active'&&c.winding){","if(c.status==='active'&&c.winding&&c.stopMode==='wait'){");
// 즐겨찾기는 바로 저장
one("  var s=tfSSFind(nick), on=(tfS().watch||[]).indexOf(s?s.nick:nick)>=0;","  try{ tfSaveNow(); }catch(e){}\n  var s=tfSSFind(nick), on=(tfS().watch||[]).indexOf(s?s.nick:nick)>=0;");
// 수동 정리 경로: 봉을 고정한 뒤 공통 정산으로
one("  if(c2.winding){ cpClose(cid); return; } /* 남은 포지션이 없으니 여기서 정산 */","  if(c2.winding){ c2.flatI=null; cpClose(cid); return; } /* 정산은 cpClose 한 곳에서: 보유 실현, 봉 고정, 반환 한 번 */");
one("  c2.flatI=s2.r.eq[s2.r.eq.length-1].i; /* 이후 손익 계산 구간을 여기서 고정 */\n  tfTrack('cp_flat',{id:cid});","  tfTrack('cp_flat',{id:cid});");
one("  tfSaveNow(); tfSS3DlgClose();\n  toast('포지션을 정리했어요. 다음 진입부터 다시 따라갑니다');","  c2.flatI=s2.r.eq[s2.r.eq.length-1].i; /* 이후 손익 계산 구간을 여기서 고정 */\n  tfSaveNow(); tfSS3DlgClose();\n  toast('포지션을 정리했어요. 다음 진입부터 다시 따라갑니다');");
s+=`
/* 따라가기 종료의 공통 정산: 어느 경로(지금 정리, 정리하고 끝내기, 모두 멈추기)든
   남은 보유를 현재가로 실현하고 봉을 고정한 뒤 한 번만 돌려준다 */
function cpClose(cid,silent){
  var c2=cpFind(cid), cp=cpState(); if(!c2||c2.status!=='active') return;
  var s2=tfSSFind(c2.nick);
  if(s2&&s2.r&&s2.r.eq&&s2.r.eq.length&&c2.flatI==null) c2.flatI=s2.r.eq[s2.r.eq.length-1].i;
  var d=cpCalc(c2), back=Math.max(0,d.est);
  c2.status='closed'; c2.closedAt=Date.now(); c2.settle={net:d.net,share:d.share,back:back};
  c2.ledger.push({at:Date.now(),type:'out',amt:back});
  cp.spot+=back;
  tfSaveNow(); tfSS3DlgClose();
  tfTrack('cp_close',{id:cid,net:d.net});
  if(silent) return;
  toast('따라가기를 중단했어요'+(c2.stopMode&&c2.stopMode!=='now'?' ('+MK_STOP_L[c2.stopMode]+')':'')+'. '+cpUsd(back,0)+'가 예산으로 돌아왔어요');
  tfShareHub('follow');
}
`;
fs.writeFileSync(D+'rd-ui.js',s); console.log('ok');
