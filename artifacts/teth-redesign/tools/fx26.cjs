// 설정 픽셀 검수 1차 반영
const fs=require('fs');
let p=fs.readFileSync('sk-settings.js','utf8');
const rep=(a,b)=>{ if(!p.includes(a)) throw new Error('miss '+a.slice(0,60)); p=p.split(a).join(b); };
rep("function skDate(ms){ return stDate(ms); }","function skDate(ms){ return stDate(ms); }\nfunction skDateK(ms){ var d=new Date(ms); return d.getFullYear()+'년 '+(d.getMonth()+1)+'월 '+d.getDate()+'일'; }\nfunction skExp(e){ var m=String(e||'').match(/(\d{2})\/(\d{2})/); return m?'20'+m[2]+'년 '+(+m[1])+'월 만료':'만료 '+gEsc(e||''); }");
rep("stBtn('관리','skSubDlg()'),'<span class=\"num\">'+skDate((sub&&sub.next)||Date.now()+30*864e5)+'</span>에 다음 결제가 진행됩니다.')","stBtn('구독 관리','skSubDlg()'),'다음 결제일은 <span class=\"num\">'+skDateK((sub&&sub.next)||Date.now()+30*864e5)+'</span>입니다.')");
rep("'<span class=\"num\">'+skDate(sub.until)+'</span>까지 이용할 수 있습니다.'","'<span class=\"num\">'+skDateK(sub.until)+'</span>까지 이용할 수 있습니다.'");
rep("'<span class=\"num\">'+skDate(sub.until)+'</span>에 종료되었습니다. 전략의 신규 주문이 중단되었습니다.'","'<span class=\"num\">'+skDateK(sub.until)+'</span>에 종료되어 전략의 신규 주문이 중단되었습니다.'");
rep("'>'+gEsc(b.label)+', '+({paid:'결제 완료',failed:'결제 실패',refunded:'환불 완료'}[b.st]||b.st)+'</span>","'>'+({paid:'결제 완료',failed:'결제 실패',refunded:'환불 완료'}[b.st]||b.st)+'</span>");
rep("stBtn('기본으로 지정','skCardDef(","stBtn('기본으로 설정','skCardDef(");
rep("(c.def?'기본 결제 수단, ':'')+'만료 <span class=\"num\">'+gEsc(c.exp)+'</span>'","(c.def?'기본 결제 수단, ':'')+'<span class=\"num\">'+skExp(c.exp)+'</span>'");
rep("'현재 기기는 로그인을 유지합니다.'","'이 기기의 로그인은 유지합니다.'");
rep("  var ss0=stS;","  /* 알림: 설명 문장을 합니다체로, 한 섹션뿐이라 섹션 제목은 두지 않는다 */\n  var NF_D={fill:'전략의 주문이 체결되면 알립니다.',state:'전략이 중지되거나 오류가 발생하면 알립니다.',risk:'설정한 손실 한도에 도달하면 알립니다.',copy:'원본 전략의 설정이 변경되면 알립니다.',bill:'결제와 로그인 내역, 보안 설정 변경을 알립니다.',news:'새 기능과 전략을 안내합니다.'};\n  ST_NF.forEach(function(x){ if(NF_D[x[0]]) x[2]=NF_D[x[0]]; });\n  var nf0=stNotify; stNotify=function(){ return nf0.apply(this,arguments).replace('<header><h2>TETH</h2></header>',''); };\n  var ss0=stS;");
fs.writeFileSync('sk-settings.js',p);
let c=fs.readFileSync('sk-settings.css','utf8');
c+=`
/* 픽셀 검수 1차 반영 */
body.st-full .stg-main h1{font-size:28px}
body.st-full .stg-main{margin:0 max(0px,calc((100% - 840px) / 2 - 100px)) 0 auto}
.acx-cf h3{font-weight:600}
.stg-dlg .stg-r .k b,.stg-dlg .stg-r .v{font-size:16px;font-weight:400}
.stg-dlg .stg-r .v b,.stg-dlg .stg-r .k b b{font-weight:400}
body.st-full .stg-seg.multi{background:none;padding:0;gap:8px}
body.st-full .stg-seg.multi button{height:34px;padding:0 14px;border-radius:999px;background:#2f2f2f;color:#cdcdcd;display:inline-flex;align-items:center;gap:6px}
body.st-full .stg-seg.multi button[aria-pressed=true]{background:#fff;color:#000}
body.st-full .stg-seg.multi button[aria-pressed=true]::before{content:'';width:9px;height:5px;border-left:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-45deg) translateY(-1px)}
body.st-full .stg-seg.multi button:disabled{opacity:.85}
@media (max-width:900px){
  body.st-full #g-scroll{padding-top:0}
  body.st-full .stg-nav{padding-top:calc(24px + env(safe-area-inset-top))}
  body.st-full .stg-main{margin:0;padding-top:calc(16px + env(safe-area-inset-top))}
  body.st-full .stg-main h1{font-size:28px}
}
`;
fs.writeFileSync('sk-settings.css',c); console.log('patched');
