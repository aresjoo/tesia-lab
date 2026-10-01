// Codex order/s3, usage/s3 반영
const fs=require('fs');
const D=__dirname+'/';
function edit(f,pairs){ let s=fs.readFileSync(D+f,'utf8'); for(const [a,b] of pairs){ const n=s.split(a).length-1; if(n!==1) throw new Error(f+' count '+n+' '+a.slice(0,70)); s=s.replace(a,b); } fs.writeFileSync(D+f,s); console.log(f,'ok'); }
/* ── 예약 주문 ── */
edit('sk-order.js',[
  [`var OD_SIDE={buy:'삽니다',sell:'팝니다',long:'롱으로 들어갑니다',short:'숏으로 들어갑니다'};`,
   `var OD_SIDE={buy:'한 번 매수합니다',sell:'한 번 매도합니다',long:'한 번 롱으로 진입합니다',short:'한 번 숏으로 진입합니다'};`],
  [`function odQtyText(o){ var tk=odSym(o.asset); if(o.qty==='num'&&o.qtyNum) return o.qtyNum+' '+tk; if(o.qty==='half') return '보유 '+tk+'의 절반'; return (o.side==='buy'||o.side==='long')?'정한 금액만큼':'보유 '+tk+' 전부'; }`,
   `function odQtyText(o){ var tk=odSym(o.asset); if(o.qty==='num'&&o.qtyNum) return o.qtyNum+' '+tk+'를'; if(o.qty==='half') return '주문 시점 보유 '+tk+'의 절반을'; return (o.side==='buy'||o.side==='long')?'정한 금액만큼':'주문 시점 보유 '+tk+' 전부를'; }`],
  [`  var when=o.trigger?tk+'가 '+odUsd(o.trigger)+'에 닿으면':(o.pct!=null?tk+'가 지금보다 '+(o.pct>0?'+':'')+o.pct+'% 움직이면':tk+'가 조건 가격에 닿으면');`,
   `  var up=o.trigger&&o.last?o.trigger>=o.last:(o.pct!=null?o.pct>=0:(o.side==='sell'||o.side==='short'));
  var when=o.trigger?tk+'가 '+odUsd(o.trigger)+(up?' 이상이 되면':' 이하가 되면'):(o.pct!=null?tk+'가 지금보다 '+(o.pct>0?'+':'')+o.pct+'% 움직이면':tk+'가 조건 가격에 닿으면');`],
  [`  var head=st==='wait'?'<div class="od-st"><i></i>대기 중</div>'`, `  var head=st==='wait'?'<div class="od-st"><i></i>조건 대기</div>'`],
  [`  toast('예약했습니다. 조건에 닿으면 바로 주문합니다');`, `  toast('예약했습니다. 조건이 충족되면 한 번 주문합니다');`],
  [`      +'<td class="r num">'+(x.trigger?Math.round(x.trigger).toLocaleString():'')+'</td><td class="r num">'+gEsc(x.qty==='num'&&x.qtyNum?String(x.qtyNum):(x.qty==='half'?'절반':'전부'))+'</td><td>'+gEsc(OD_TTL[x.ttl]||'')+'</td>'`,
   `      +'<td class="r num">'+(x.trigger?odUsd(x.trigger):'')+'</td><td class="r num">'+gEsc(x.qty==='num'&&x.qtyNum?String(x.qtyNum):(x.qty==='half'?'절반':'전부'))+'</td><td>'+gEsc({gtc:'취소 전까지','7d':'7일','1d':'하루'}[x.ttl]||'')+'</td>'`],
  [`<td>조건 대기</td>'`, `<td>조건 주문</td>'`],
  [`(function(){
  if(typeof tfTmPane!=='function') return;`,
`/* 대화를 다시 열면 카드는 저장된 상태로 다시 그린다(터미널에서 취소한 뒤에도 맞게) */
function odSync(){ [].forEach.call(document.querySelectorAll('#g-thread .od-card'),function(el){ var x=odFind(el.id); if(x) { var d=document.createElement('div'); d.innerHTML=odCardHtml(x); if(d.firstChild.outerHTML!==el.outerHTML) el.replaceWith(d.firstChild); } }); }
(function(){ if(typeof gSelect==='function'){ var s0=gSelect; gSelect=function(){ var r=s0.apply(this,arguments); setTimeout(function(){ try{ odSync(); }catch(e){} },0); return r; }; } })();
(function(){
  if(typeof tfTmPane!=='function') return;`]
]);
edit('sk-order.js',[[`  return '<div class="tf-sum od-card '+st+'" id="'+x.id+'">'+head+'<p class="od-line">'+gEsc(line)+'</p><p class="od-sub">'+(dist?gEsc(dist)+' <b>|</b> ':'')+gEsc(ttl)`,
  `  return '<div class="tf-sum od-card '+st+'" id="'+x.id+'">'+head+'<p class="od-line">'+gEsc(line)+'.</p><p class="od-sub">'+(dist?gEsc(dist)+' <b>|</b> ':'')+gEsc(ttl)`]]);
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
  [`'<p class="use-sub">'+stDate(m.reset)+'에 초기화됩니다.'+(note?' '+note:'')+'</p>`, `'<p class="use-sub">'+rdT+'에 초기화됩니다.'+(note?' '+note:'')+'</p>`],
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
