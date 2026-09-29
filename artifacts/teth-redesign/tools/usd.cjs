// R07: 금액은 $ 하나로 적는다. 자산 이름(BTC/USDT, USDT 선물, USDT로 사고판다)은 그대로 둔다. 여러 번 돌려도 결과가 같다
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
let n=0;
function usdText(s){
  const c=()=>{ n++; };
  // 금액을 만드는 함수
  s=s.replace("Math.abs(n).toLocaleString(undefined,{minimumFractionDigits:dd,maximumFractionDigits:dd})+' USDT'; }",()=>{ c(); return "'$'+Math.abs(n).toLocaleString(undefined,{minimumFractionDigits:dd,maximumFractionDigits:dd}); }"; });
  s=s.replace("function btUsd(v,d){ return (d?v.toFixed(d):Math.round(v).toLocaleString())+' USDT'; }",()=>{ c(); return "function btUsd(v,d){ return (v<0?'-':'')+'$'+(d?Math.abs(v).toFixed(d):Math.round(Math.abs(v)).toLocaleString()); }"; });
  s=s.replace("return (r>0?'+':r<0?'-':'')+Math.abs(r).toLocaleString()+' USDT'; }",()=>{ c(); return "return (r>0?'+':r<0?'-':'')+'$'+Math.abs(r).toLocaleString(); }"; });
  s=s.replace("function btPx(v){ return mkPxFmt(v)+' USDT'; }",()=>{ c(); return "function btPx(v){ return '$'+mkPxFmt(v); }"; });
  s=s.replace("function tfTmPx(n){ return Math.round(n).toLocaleString()+' USDT'; }",()=>{ c(); return "function tfTmPx(n){ return '$'+Math.round(n).toLocaleString(); }"; });
  s=s.replace("function mkPxU(a,v){ return mkPxFmt(v)+(MK_CRYPTO[a]?' USDT':(a==='나스닥'||a==='S&P 500')?'포인트':' USD'); }",()=>{ c(); return "function mkPxU(a,v){ return (a==='나스닥'||a==='S&P 500')?mkPxFmt(v)+'포인트':'$'+mkPxFmt(v); }"; });
  // 식 뒤에 붙인 단위
  s=s.replace(/((?:Math\.(?:round|abs)|BT\.amt|mkMin)(?:\((?:[^()'"]|\((?:[^()'"]|\([^()'"]*\))*\))*\))?(?:\.toLocaleString\(\))?)\+' USDT/g,(m,x)=>{ c(); return "'$'+"+x+"+'"; });
  // 글자로 적은 금액
  s=s.replace(/(^|[^\/\w$])(\+?)(\d[\d,]*(?:\.\d+)?) USDT(?![\w가-힣]*선물)/g,(m,p,sg,v)=>{ c(); return p+sg+'$'+v; });
  s=s.replace(/>USDT</g,()=>{ c(); return '>USD<'; }).replace(/\(USDT\)/g,()=>{ c(); return '(USD)'; });
  s=s.replace("'최소 '+min+' USDT부터",()=>{ c(); return "'최소 $'+min+'부터"; });
  s=s.replace("'기준 '+mkPxFmt(e.ref)+' USDT를 종가로",()=>{ c(); return "'기준 $'+mkPxFmt(e.ref)+'를 종가로"; });
  s=s.replace(/\.toLocaleString\(\)\+' USDT/g,()=>{ c(); return ".toLocaleString()+' USD"; });
  s=s.replace(/손익, USDT 표기/g,()=>{ c(); return '손익, USD 기준'; });
  s=s.replace(/USDT 표기\. 시뮬레이션 데이터입니다/g,()=>{ c(); return '모든 금액은 USD 기준입니다'; });
  return s;
}
module.exports={usdText};
if(require.main!==module) return;
const f='index.html'; const a=fs.readFileSync(R+f,'utf8'), b=usdText(a); fs.writeFileSync(R+f,b);
console.log('usd',n,'USDT left',(b.match(/USDT/g)||[]).length);
