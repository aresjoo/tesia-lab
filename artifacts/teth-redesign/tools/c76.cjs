// 사이드바 설정과 프로필이 안 눌리는 문제
// 1) 설정 경로를 nf 화면의 "뒤로가기" 처리보다 먼저 본다
// 2) 같은 주소로 다시 가면 hashchange가 없으니 직접 그린다 (st.js)
// 3) 프로필은 계정 탭으로 (p16.js)
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let s=fs.readFileSync(R,'utf8');
const A="  if(h==='#/plan'&&S.user&&typeof stRoute==='function'){ try{ history.replaceState(null,'','#/settings/billing'); }catch(e){} TF_ONNF=false; if(stRoute('#/settings/billing')) return; }\r\n  if(h.indexOf('#/settings')===0&&typeof stRoute==='function'){ TF_ONNF=false; if(stRoute(h)) return; } /* 설정 전용 화면 */\r\n";
const B="  /* nf 라우트 (#/trade, #/plan, #/review, #/periodic) — share 패턴 준용 */\r\n";
if(s.split(A).length!==2) throw new Error('A'); if(s.split(B).length!==2) throw new Error('B');
s=s.replace(A,'');
s=s.replace(B,()=>"  /* 설정 전용 화면: nf 화면에서 들어와도 뒤로가기로 보지 않는다. #/plan 도 결제 설정으로 모은다 */\r\n  if(h==='#/plan'&&S.user&&typeof stRoute==='function'){ try{ history.replaceState(null,'','#/settings/billing'); }catch(e){} TF_ONNF=false; if(stRoute('#/settings/billing')) return; }\r\n  if(h.indexOf('#/settings')===0&&typeof stRoute==='function'){ TF_ONNF=false; if(stRoute(h)) return; }\r\n"+B);
fs.writeFileSync(R,s);
function ed(f,a,b){ let t=fs.readFileSync(f,'utf8'); if(t.split(a).length!==2) throw new Error(f+' :: '+a.slice(0,60)); fs.writeFileSync(f,t.replace(a,()=>b)); }
ed('st.js',"function stGo(tab){ location.hash='#/settings/'+(tab||'general'); }",
  "function stGo(tab){ var h='#/settings/'+(tab||'general'); if(location.hash===h){ stRoute(h); return; } location.hash=h; } /* 같은 주소면 hashchange가 없다 */");
ed('p16.js',"  if(!gSetMenu.p16){","  if(typeof gProfileClick==='function'&&!gProfileClick.p16){ gProfileClick=function(ev){ if(!S.user){ authOpen('login'); return; } try{ gSetMenuClose(); }catch(x){} stGo('account'); }; gProfileClick.p16=1; }\n  if(!gSetMenu.p16){");
console.log('ok');
