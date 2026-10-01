// Codex order/s3, usage/s3 반영
const fs=require('fs');
const D=__dirname+'/';
function edit(f,pairs){ let s=fs.readFileSync(D+f,'utf8'); for(const [a,b] of pairs){ const n=s.split(a).length-1; if(n!==1) throw new Error(f+' count '+n+' '+a.slice(0,70)); s=s.replace(a,b); } fs.writeFileSync(D+f,s); console.log(f,'ok'); }
/* ── 사용량 ── */
edit('sk-usage.js',[
  [`  var reset=(b&&b.cycleAt)?b.cycleAt+30*864e5:(function(){ var d=new Date(); return new Date(d.getFullYear(),d.getMonth()+1,1).getTime(); })();`,
   `  var reset=(b&&b.cycleAt)?b.cycleAt+30*864e5:(function(){ var d=new Date(); return new Date(d.getFullYear(),d.getMonth()+1,1).getTime(); })();
  try{ var sub=acS().sub; if(acSubOn()&&sub&&sub.next) reset=sub.next; }catch(e){} /* 구독이면 결제일과 같은 날 초기화 */`],
  [`function aiGate(action){ var m=aiMeter();`, `function aiGate(action){ if(window.TF_QA_NOGATE) return 'allow'; var m=aiMeter();`],
  [`  var msg=full?'이번 달 AI 사용량을 모두 썼습니다. 실행 중인 전략은 계속 돌아갑니다.':'이번 달 AI 사용량이 '+m.pct+'%에 도달했습니다.';`,
   `  var msg=full?'이번 달 AI 사용량을 모두 써서 새 요청은 잠시 멈춥니다. 실행 중인 전략과 결과 보기는 그대로입니다.':'이번 달 AI 사용량의 '+m.pct+'%를 썼습니다.';`],
  [`  var note=m.pct>=100?'이번 달 사용량을 모두 썼습니다. 실행 중인 전략은 계속 돌아갑니다.':m.pct>=80?'사용량이 '+m.pct+'%에 도달했습니다.':'';`,
   `  var note=m.pct>=100?'새 요청은 잠시 멈춥니다. 실행 중인 전략과 결과 보기는 그대로입니다.':'';
  var rd=new Date(m.reset), rdT=rd.getFullYear()+'년 '+(rd.getMonth()+1)+'월 '+rd.getDate()+'일';`],
  [`<p class="use-sub">'+stDate(m.reset)+'에 초기화됩니다.'+(note?' '+note:'')+'</p>`, `<p class="use-sub">'+rdT+'에 초기화됩니다.'+(note?' '+note:'')+'</p>`],
  [`  var how={FREE:'둘러보기용 무료 사용량입니다. 초대 계정이나 구독으로 바꾸면 계속 쓸 수 있습니다.',UID:'거래 크레딧이 사용량을 덮는 동안은 이용료가 없습니다. 모자라면 카드를 등록해 계속 쓸 수 있습니다.',CARD:'구독에 든 사용량입니다. 초대 계정을 연결하면 사용량이 매달 더 생깁니다.',CARD_UID:'거래 크레딧이 구독료부터 줄입니다. 사용량이 모자라면 충전한 금액에서 차감됩니다.'}[m.tier]||'';`,
   `  var how={FREE:'둘러보기용 무료 사용량입니다.',UID:'모자라면 카드를 등록해 계속 쓸 수 있습니다.',CARD:'초대 계정을 연결하면 사용량이 매달 더 생깁니다.',CARD_UID:'모자라면 크레딧을 추가해 계속 쓸 수 있습니다.'}[m.tier]||'';`],
  [`    +(m.tier==='CARD_UID'||m.tier==='UID'?stSec('',stRow('거래 크레딧',(m.bal>0?'이번 달 사용량을 덮고 있습니다':'이번 달 사용량을 다 덮지 못합니다'),'','초대 계정의 거래에서 매달 생깁니다. 남는 크레딧은 한 달 이월된 뒤 사라집니다')):'');`,
   `    +(m.tier==='CARD_UID'||m.tier==='UID'?stSec('',stRow('거래 크레딧','<span class="num">'+acUsd(Math.max(0,m.bal))+'</span>')):'');`],
  [`    var add=' 청구 예정 금액은 <span class="num">'+acUsd(q.total)+'</span>입니다'+((q.credit||q.extra)?' (<span class="num">'+line+'</span>)':'')+'.';
    return h.replace(/(다음 결제일은 <span class="num">[^<]*<\\/span>입니다\\.)/,'$1'+add); }; }`,
   `    var rows=stRow('청구 예정 금액','<span class="num">'+acUsd(q.total)+'</span>','',(q.credit||q.extra)?'<span class="num">구독 '+acUsd(q.gross)+(q.credit?', 거래 크레딧 -'+acUsd(q.credit):'')+(q.extra?', 추가 사용 +'+acUsd(q.extra):'')+'</span>':'');
    /* 구독 카드 안, 결제 수단 행 바로 앞에 넣는다 */
    var i=h.indexOf('<div class="stg-r"><div class="k"><b>결제 수단</b>'); if(i<0) return h;
    return h.slice(0,i)+rows+h.slice(i); }; }`],
  [`  if(typeof gSend==='function'){ var gs0=gSend; gSend=function(){ if(aiGate('new')==='block'){ toast('이번 달 AI 사용량을 모두 썼습니다'); aiBar(); var b=document.getElementById('g-usebar'); if(b) b.scrollIntoView({block:'nearest'}); return; } return gs0.apply(this,arguments); }; }`,
   `  /* 막힐 때는 배너 하나로 알린다. 배너를 그릴 수 없는 홈에서만 짧은 안내 */
  function aiBlocked(){ aiBar(); var b=document.getElementById('g-usebar'); if(b&&b.offsetParent){ b.scrollIntoView({block:'nearest'}); return; } toast('이번 달 AI 사용량을 모두 썼습니다. 설정의 사용량에서 확인할 수 있습니다'); }
  if(typeof gSend==='function'){ var gs0=gSend; gSend=function(){ if(aiGate('new')==='block'){ aiBlocked(); return; } return gs0.apply(this,arguments); }; }
  if(typeof gNew==='function'){ var gn0=gNew; gNew=function(){ if(S.user&&aiGate('new')==='block'){ aiBlocked(); return; } return gn0.apply(this,arguments); }; }`],
  [`  if(typeof tfVerifyGo==='function'){ var vg0=tfVerifyGo; tfVerifyGo=function(){ if(aiGate('analyze')==='block'){ toast('이번 달 AI 사용량을 모두 썼습니다'); aiBar(); return; } return vg0.apply(this,arguments); }; }`,
   `  if(typeof tfVerifyGo==='function'){ var vg0=tfVerifyGo; tfVerifyGo=function(){ if(aiGate('analyze')==='block'){ aiBlocked(); return; } return vg0.apply(this,arguments); }; }`]
]);
