const fs=require('fs');
const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let s=fs.readFileSync(F,'utf8');
function ed(a,b){ const n=s.split(a).length-1; if(n!==1) throw new Error('anchor count '+n+' :: '+a.slice(0,60)); s=s.replace(a,()=>b); }
ed("  if(h.indexOf('#/share/bt/')===0){ TF_ONNF=false; btRoute(h); return; } /* 백테스트 여정 */",
   "  if(h.indexOf('#/share/bt/')===0){ TF_ONNF=false; btRoute(h); return; } /* 백테스트 여정 */\r\n  if(h.indexOf('#/settings')===0&&typeof stRoute==='function'){ TF_ONNF=false; if(stRoute(h)) return; } /* 설정 전용 화면 */");
fs.writeFileSync(F,s); console.log('ok');
