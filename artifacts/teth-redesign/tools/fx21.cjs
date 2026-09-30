// 파운더 수정: 무료 경로 기본은 가입 안내, 작은 링크로 "이미 초대 계정 있음". KYC는 연결을 막지 않고 실행만 막는다
const fs=require('fs');
function ed(f,L){ let s=fs.readFileSync(f,'utf8'); for(const [a,b] of L){ const n=s.split(a).length-1; if(n!==1) throw new Error(f+' anchor '+n+' :: '+a.slice(0,70)); s=s.replace(a,()=>b); } fs.writeFileSync(f,s); }
ed('ac.js',[
 // KYC는 단계가 아니라 연결 뒤 상태. commit 전에 막지 않는다
 ["  if(r==='paid'){ if(!acSubOn()||a.more) return 'pay'; if(!ex) return 'ex'; if(!a.conn[ex]&&acPaidFull()) return 'limit'; if(!acAuthOk(ex)) return 'auth'; if(!acKycOk(ex)) return 'kyc'; }\n  else { if(!ex) return 'ex'; if(!a.has) return 'acct'; if(a.has==='no'&&a.g<2) return 'guide'; if(!acAuthOk(ex)) return 'auth'; if(a.uid.st!=='ok'||a.uid.ex!==ex) return 'uid'; if(!acKycOk(ex)) return 'kyc'; }",
  "  if(r==='paid'){ if(!acSubOn()||a.more) return 'pay'; if(!ex) return 'ex'; if(!a.conn[ex]&&acPaidFull()) return 'limit'; if(!acAuthOk(ex)) return 'auth'; }\n  else { if(!ex) return 'ex'; if(!a.has) return 'acct'; if(a.has==='no'&&a.g<2) return 'guide'; if(!acAuthOk(ex)) return 'auth'; if(a.uid.st!=='ok'||a.uid.ex!==ex) return 'uid'; }"],
 ["  if(r==='partner'){ L.push(['ex','거래소']); L.push(['acct','거래소 계정']); L.push(['auth','연결 승인']); L.push(['uid','초대 계정 확인']); L.push(['kyc','본인 확인']); }\n  else { /* 결제가 먼저. 이미 구독 중이면 결제 단계는 보이지 않는다 */ if(!acSubOn()||(a.pay.st==='ok'&&!acConnList().some(function(k){ return a.conn[k].via==='paid'; }))) L.push(['pay','결제']); L.push(['ex','거래소']); L.push(['auth','연결 승인']); L.push(['kyc','본인 확인']); }",
  "  if(r==='partner'){ L.push(['ex','거래소']); L.push(['acct','거래소 계정']); L.push(['auth','연결 승인']); L.push(['uid','초대 계정 확인']); }\n  else { /* 결제가 먼저. 이미 구독 중이면 결제 단계는 보이지 않는다 */ if(!acSubOn()||(a.pay.st==='ok'&&!acConnList().some(function(k){ return a.conn[k].via==='paid'; }))) L.push(['pay','결제']); L.push(['ex','거래소']); L.push(['auth','연결 승인']); }"],
 // 연결 기록에 본인 확인 상태를 둔다. 확인은 연결 뒤에 돌린다
 ["  a.conn[ex]={via:r==='paid'?'paid':'partner',at:Date.now(),uid:a.uid.ex===ex?(a.uid.v||''):''};","  a.conn[ex]={via:r==='paid'?'paid':'partner',at:Date.now(),uid:a.uid.ex===ex?(a.uid.v||''):'',kyc:'run'};"],
 ["function acKycRun(){ var a=acS(), my=++AC_RUN; a.kyc={st:'run',ex:a.ex}; acRe();\n  setTimeout(function(){ if(my!==AC_RUN) return; var q=(window.AC_QA&&AC_QA.kyc)||'ok'; a.kyc={st:(q==='fail'||q==='review'||q==='err')?q:'ok',ex:a.ex}; acSave(); acRe(); },1100); }",
  "function acKycRun(ex){ var a=acS(); ex=ex||a.ex; var c=a.conn[ex]; if(!c) return; var my=++AC_RUN; c.kyc='run'; a.kyc={st:'run',ex:ex}; acSave(); acRe();\n  setTimeout(function(){ if(my!==AC_RUN) return; var q=(window.AC_QA&&AC_QA.kyc)||'ok'; var st=(q==='fail'||q==='review'||q==='err')?q:'ok'; if(a.conn[ex]) a.conn[ex].kyc=st; a.kyc={st:st,ex:ex}; acSave(); acRe(); try{ var el=document.getElementById('ac-kyc'); if(el) el.outerHTML=acKycHtml(ex); }catch(e){} },1100); }\n/* 완료 화면과 설정에 쓰는 본인 확인 줄. 연결은 됐고, 전략 실행은 본인 확인이 끝나야 한다 */\nfunction acKycHtml(ex){ var a=acS(), c=a.conn[ex]||{}, n=acName(ex), st=c.kyc||'none';\n  var body=st==='ok'?'<b>본인 확인 완료</b><span>'+n+'에서 본인 확인이 끝났습니다. 전략을 실행할 수 있습니다.</span>'\n    :st==='run'?'<b>본인 확인 상태를 보는 중</b><span>'+n+'에서 확인하고 있습니다.</span>'\n    :st==='review'?'<b>'+n+'에서 본인 확인을 검토하고 있습니다</b><span>연결은 되었습니다. 검토가 끝나면 전략을 실행할 수 있습니다.</span>'\n    :st==='err'?'<b>본인 확인 상태를 불러오지 못했습니다</b><span>연결은 되었습니다. 잠시 뒤 다시 확인해 주십시오.</span>'\n    :'<b>'+n+'에서 본인 확인을 완료해 주십시오</b><span>연결은 되었습니다. 본인 확인이 끝나야 전략이 주문을 낼 수 있습니다.</span>';\n  var act=st==='ok'||st==='run'?'':(st==='fail'||st==='none'?'<a class=\"bt-sec acx-a\" href=\"'+gEsc(acRef(ex))+'\" target=\"_blank\" rel=\"noopener\">본인 확인하러 가기'+AC_OUT+'</a>':'')+'<button type=\"button\" class=\"bt-sec\" onclick=\"acKycRun(\\''+ex+'\\')\">다시 확인하기</button>';\n  return '<div class=\"acx-kyc st-'+st+'\" id=\"ac-kyc\"><div class=\"t\">'+(st==='ok'?AC_CK:st==='run'?'<i class=\"acx-sp\"></i>':'<em></em>')+'<div>'+body+'</div></div>'+act+'</div>'; }\nfunction acRunOk(ex){ var a=acS(); return !!(a.conn[ex]&&a.conn[ex].kyc==='ok'); }"],
 // 완료 화면에 본인 확인 줄. 연결 직후 확인을 돌린다
 ["    +(ctx.doneHtml?ctx.doneHtml():'<button type=\"button\" class=\"bt-cta\" onclick=\"acGoTerminal()\">터미널로 이동</button>');\n}","    +acKycHtml(ex)\n    +(ctx.doneHtml?ctx.doneHtml():'<button type=\"button\" class=\"bt-cta\" onclick=\"acGoTerminal()\">터미널로 이동</button>');\n}"],
 ["  a.doneAt=Date.now(); a.edit=null; acSave(); try{ tfTrack('ac_connected',{ex:ex,via:a.conn[ex].via}); tfSideSync&&tfSideSync(); }catch(e){}","  a.doneAt=Date.now(); a.edit=null; acSave(); try{ tfTrack('ac_connected',{ex:ex,via:a.conn[ex].via}); tfSideSync&&tfSideSync(); }catch(e){}\n  setTimeout(function(){ acKycRun(ex); },50);"],
 // 자동 이어가기: 승인/초대 뒤 kyc 단계 호출 제거
 ["    acSave(); acRe(); if(!bad&&acStep()==='uid') acUidRun(); else if(!bad&&acStep()==='kyc') acKycRun(); },1300);","    acSave(); acRe(); if(!bad&&acStep()==='uid') acUidRun(); },1300);"],
 ["      a.uid=bad?{st:'fail',ex:a.ex,v:a.auth.uid}:{st:'ok',ex:a.ex,v:a.auth.uid}; acSave(); acRe(); if(!bad&&acStep()==='kyc') acKycRun(); },900); },800);","      a.uid=bad?{st:'fail',ex:a.ex,v:a.auth.uid}:{st:'ok',ex:a.ex,v:a.auth.uid}; acSave(); acRe(); },900); },800);"],
 ["  TF_RENDERING=false; if(acStep()==='uid') acUidRun(); else if(acStep()==='kyc'&&acS().kyc.st!=='fail'&&acS().kyc.st!=='review'&&acS().kyc.st!=='err') acKycRun();\n}","  TF_RENDERING=false; if(acStep()==='uid') acUidRun();\n}"],
 ["body={route:acBRoute,ex:acBEx,acct:acBAcct,guide:acBGuide,pay:acBPay,auth:acBAuth,uid:acBUid,kyc:acBKyc,limit:acBLimit};","body={route:acBRoute,ex:acBEx,acct:acBAcct,guide:acBGuide,pay:acBPay,auth:acBAuth,uid:acBUid,limit:acBLimit};"],
 // 무료 경로의 계정 단계: 가입 안내가 기본, 작은 링크로 바로 연결
 ["  return '<p class=\"btg-p\">'+n+' 계정이 있습니까? TETH 초대로 가입한 계정이면 이용료 없이 씁니다. 승인 뒤에 TETH 초대로 가입한 계정인지 확인합니다.</p>'\n    +'<div class=\"acx-two\"><button type=\"button\" class=\"acx-ch\" onclick=\"acHas(\\'yes\\')\"><b>계정 있음</b><span>바로 연결합니다</span></button><button type=\"button\" class=\"acx-ch\" onclick=\"acHas(\\'no\\')\"><b>새로 만들기</b><span>TETH 초대로 가입합니다. 약 5분</span></button></div>';",
  "  return '<p class=\"btg-p\">TETH 초대로 '+n+'에 가입하면 이용료 없이 씁니다. 가입과 본인 확인은 약 5분 걸리고, 막히면 상담원이 24시간 함께 합니다.</p>'\n    +acBGuide()\n    +'<p class=\"acx-have\"><button type=\"button\" onclick=\"acHas(\\'yes\\')\">TETH 초대 계정이 이미 있습니까? 바로 연결</button><small>승인 뒤에 TETH 초대로 가입한 계정인지 확인합니다.</small></p>';"],
 ["function acGuideOpen(){ try{ tfTrack('ac_join_open',{ex:acS().ex}); }catch(e){} acS().joined=1; acSave(); }\nfunction acGuide(n){ var a=acS(); a.g=n; if(n>=1) a.joined=1; acSave(); acRe(); }",
  "function acGuideOpen(){ var a=acS(); try{ tfTrack('ac_join_open',{ex:a.ex}); }catch(e){} a.joined=1; if(!a.has) a.has='no'; acSave(); }\nfunction acGuide(n){ var a=acS(); a.g=n; if(n>=1) a.joined=1; if(!a.has) a.has='no'; acSave(); acRe(); }"],
 ["  if(k==='acct') return a.has==='no'?'새 계정, 가입 완료':'계정 있음';\n  if(k==='kyc') return acName(a.ex)+' 본인 확인 완료';","  if(k==='acct') return a.has==='no'?'새 계정, 가입 완료':'계정 있음';"],
 ["k==='acct'?(!!a.has&&(a.has!=='no'||a.g>=2)):k==='kyc'?acKycOk(ex):","k==='acct'?(!!a.has&&(a.has!=='no'||a.g>=2)):"],
]);
let a=fs.readFileSync('ac.js','utf8');
// 쓰지 않게 된 acBKyc 제거
const i=a.indexOf('/* 본인 확인(KYC): 거래소에서 마쳤는지 조회한다. 완료, 미완료, 심사 중, 조회 실패 */\nfunction acBKyc(){'), j=a.indexOf('function acKycRun(');
if(i<0||j<0) throw new Error('kyc block'); a=a.slice(0,i)+'/* 본인 확인(KYC): 연결을 막지 않는다. 전략 실행 전에만 확인한다 */\n'+a.slice(j);
fs.writeFileSync('ac.js',a);
fs.appendFileSync('bt6.css',`
/* 무료 경로: 이미 초대 계정이 있는 사람용 작은 링크 */
.acx-have{margin:14px 0 0;text-align:center}
.acx-have button{border:0;background:none;color:#aeb3ba;font:inherit;font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.acx-have button:hover{color:#fff}.acx-have small{display:block;margin-top:4px;font-size:11.5px;color:#5b6067}
/* 본인 확인 줄 */
.acx-kyc{margin:0 0 14px;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03)}
.acx-kyc .t{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:start}
.acx-kyc .t>svg,.acx-kyc .t>em,.acx-kyc .t>i{margin-top:3px}
.acx-kyc .t>em{display:block;width:14px;height:14px;border-radius:50%;border:2px solid #f0b840}
.acx-kyc.st-ok .t>svg{color:#2fb98a}
.acx-kyc b{display:block;font-size:14px;color:#f2f3f5}.acx-kyc span{display:block;font-size:12.5px;line-height:1.6;color:#8b9096;margin-top:2px}
.acx-kyc .bt-sec{margin-top:10px}.acx-kyc .bt-sec+.bt-sec{margin-top:6px}
.acx-kyc.st-fail,.acx-kyc.st-none{border-color:rgba(240,184,64,.35);background:rgba(240,184,64,.06)}
`);
console.log('ok');
