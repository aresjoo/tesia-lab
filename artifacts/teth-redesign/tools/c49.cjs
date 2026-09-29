// AI 연결: 한 번 끊김으로 표시되면 끝까지 대본으로 가던 문제.
// 보내기 직전에 다시 확인하고, 로컬에서 8799가 없으면 배포 프록시로 넘어간다. 일반 질문에는 대본 대신 연결 안내를 띄운다.
const fs=require('fs'), F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let h=fs.readFileSync(F,'utf8');
const rep=(x,y)=>{ const c=h.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,80)); h=h.split(x).join(y); };
if(h.indexOf('function taiEnsure(')>=0) throw new Error('already applied');
// 1. 핑에 시간 제한, 그리고 다시 확인하는 함수
rep("function taiPing(){\r\n  try{\r\n    fetch(TAI.url.replace('/api/chat','/api/ping')).then(function(r){ return r.json(); })\r\n      .then(function(j){ TAI.ok=!!j.ok; }).catch(function(){ TAI.ok=false; });\r\n  }catch(e){ TAI.ok=false; }\r\n}",
"function taiPing(done){\r\n  var fin=false, end=function(v){ if(fin) return; fin=true; TAI.ok=v; if(done) done(v); };\r\n  setTimeout(function(){ end(false); },3500);\r\n  try{\r\n    fetch(TAI.url.replace('/api/chat','/api/ping')).then(function(r){ return r.json(); })\r\n      .then(function(j){ end(!!j.ok); }).catch(function(){ end(false); });\r\n  }catch(e){ end(false); }\r\n}\r\n/* 보내기 직전 연결 확인. 끊김으로 표시돼 있으면 한 번 더 확인하고, 로컬 프록시가 없으면 배포 프록시로 넘어간다 */\r\nfunction taiEnsure(cb){\r\n  if(TAI.ok!==false){ cb(true); return; }\r\n  taiPing(function(v){\r\n    if(v){ cb(true); return; }\r\n    var loc=/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?\\//.test(TAI.url);\r\n    if(!loc){ taiResolveProxy(function(){ taiPing(function(v2){ cb(v2); }); }); return; }\r\n    fetch('https://raw.githubusercontent.com/aresjoo/tesia-lab/proxy-url/PROXY_URL?t='+Date.now()).then(function(r){ return r.ok?r.text():''; })\r\n      .then(function(u){ u=(u||'').trim(); if(/^https:\\/\\/[\\w.-]+$/.test(u)){ TAI.url=u+'/api/chat'; taiPing(function(v2){ cb(v2); }); } else cb(false); })\r\n      .catch(function(){ cb(false); });\r\n  });\r\n}\r\n/* AI 가 정말 닿지 않을 때: 전략 이야기면 기존 질문 카드로, 아니면 가짜 답 대신 사실대로 알린다 */\r\nfunction taiIsStratText(t){ return /전략|자동매매|매매|매수|매도|사고|팔고|떨어|하락|급락|반등|눌림|오르|추세|상승|돌파|손절|익절|물타/.test(t||''); }\r\nfunction taiOffline(t,retry){\r\n  var id='goff'+Date.now(); window.TAI_OFFQ=window.TAI_OFFQ||{}; TAI_OFFQ[id]=retry;\r\n  gConvAI('지금 AI 서버에 연결되지 않아 답을 드리지 못했어요. 잠시 뒤 다시 보내 주세요.');\r\n  try{ var th=$('g-thread'); if(th) th.insertAdjacentHTML('beforeend','<div class=\"g-nextcol\" id=\"'+id+'\"><button class=\"g-nextq\" onclick=\"taiOffRetry(\\''+id+'\\')\"><span>다시 보내기</span><span class=\"ar\">→</span></button></div>'); }catch(e){}\r\n}\r\nfunction taiOffRetry(id){ var f=(window.TAI_OFFQ||{})[id], e=$(id); if(e) e.remove(); if(!f) return; TAI.ok=null; taiEnsure(function(ok){ if(ok) f(); else toast('아직 AI 서버에 연결되지 않아요'); }); }");
// 2. 새 전략(홈에서 보낸 첫 문장)
rep("  if(TAI.ok!==false&&typeof taiMarket==='function'){ gStep=null; gUserPin(); taiMarket(text,null,function(){ gConvInterpret(text); }); }\r\n  else gConvInterpret(text);",
"  taiEnsure(function(ok){\r\n    if(ok&&typeof taiMarket==='function'){ gStep=null; gUserPin(); taiMarket(text,null,function(){ gConvInterpret(text); }); }\r\n    else if(taiIsStratText(text)) gConvInterpret(text);\r\n    else taiOffline(text,function(){ gStep=null; gUserPin(); taiMarket(text,null,function(){ gConvInterpret(text); }); });\r\n  });");
// 3. 대화 중 입력
rep("    if(S.user&&TAI.ok!==false){ gUserPin(); taiAskConv(t,cannedC); } else gThink('확인 중',600,cannedC);",
"    if(S.user) taiEnsure(function(ok){ if(ok){ gUserPin(); taiAskConv(t,cannedC); } else gThink('확인 중',600,cannedC); }); else gThink('확인 중',600,cannedC);");
// 4. 문서 옆 대화
rep("  if(S.user&&TAI.ok!==false) taiAsk(t,fin,canned);\r\n  else delay(900,canned);",
"  if(S.user) taiEnsure(function(ok){ if(ok) taiAsk(t,fin,canned); else delay(900,canned); });\r\n  else delay(900,canned);");
fs.writeFileSync(F,h); console.log('ok');
