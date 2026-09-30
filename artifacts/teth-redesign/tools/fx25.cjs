// 세 번째 검수 반영 + 파운더 결정: 구독 회원도 거래소 7곳 전부 연결 (한도 없음)
const fs=require('fs');
let p=fs.readFileSync('px.js','utf8');
const rep=(a,b)=>{ if(!p.includes(a)) throw new Error('miss '+a.slice(0,60)); p=p.replace(a,b); };
rep("s:'전략을 실행할 거래소를 고르십시오.'","s:'전략을 실행할 거래소를 선택합니다.'");
rep("s:'TETH 초대 링크로 가입한 '+n+' 계정만 연결됩니다.'","s:'이용료 없이 연결하려면 TETH 초대로 가입한 '+n+' 계정이 필요합니다.'");
rep("s:(ctx.name?gEsc(ctx.name)+' 전략을 ':'전략을 ')+acName(a.ex||acConnList()[0])+' 계정에서 실행합니다.'","s:'이제 '+(ctx.name?gEsc(ctx.name)+' 전략을 ':'전략을 ')+'시작하면 '+acName(a.ex||acConnList()[0])+' 계정에서 실행됩니다.'");
// 계정 화면: 가입 전에는 가입 단추 + 기존 계정 링크. 가입 화면을 열고 돌아오면 주 단추가 계정 연결
const oldAcct=p.slice(p.indexOf("function pxBAcct(){"), p.indexOf("/* 승인: 권한 두 줄"));
const newAcct=`function pxBAcct(){
  var a=acS(), n=acName(a.ex), j=!!a.joined&&a.has==='no';
  return '<div class="px-card"><ul class="px-steps"><li><b>TETH 초대 링크로 가입</b><span>이메일이나 전화번호로 가입합니다.</span></li><li><b>본인 확인</b><span>전략을 시작하기 전에 '+n+'에서 마칩니다.</span></li></ul></div>'
    +(j?'<button type="button" class="pl-cta pl-cta-w px-cta" onclick="acGuide(2)">가입한 계정 연결</button><p class="px-links"><a class="pl-link acx-a" href="'+gEsc(acRef(a.ex))+'" target="_blank" rel="noopener">'+n+' 가입 화면 다시 열기</a></p>'
      :'<a class="pl-cta pl-cta-w px-cta acx-a" href="'+gEsc(acRef(a.ex))+'" target="_blank" rel="noopener" onclick="pxJoined()">'+n+' 가입 화면 열기'+AC_OUT+'</a><p class="px-links"><button type="button" class="pl-link acx-have" onclick="acHas(\\'yes\\')">기존 초대 계정 연결</button></p>');
}
function pxJoined(){ acGuideOpen(); setTimeout(acRe,50); }
`;
p=p.replace(oldAcct,newAcct);
rep("<b>잔고 조회</b>전략 계산에 씁니다","<b>잔고 조회</b>전략에 쓸 잔고를 봅니다");
rep("<b>주문</b>전략 조건이 맞을 때 사고팝니다","<b>주문</b>전략 조건에 맞을 때 주문을 냅니다");
rep("'+(st==='err'?'다시 확인하기':'확인을 마쳤습니다')+'","'+(st==='err'?'다시 확인하기':'확인 상태 다시 보기')+'");
rep("var h=d.querySelector('h3'); if(h) h.textContent=acName(ex)+' 본인 확인이 필요합니다'; var bt=d.querySelector('.bts'); if(bt){ var no=bt.querySelector('button:not(.ok)'); if(no){ no.className='pl-link'; no.textContent='닫기'; } } };",
    "var h=d.querySelector('h3'); if(h) h.textContent=acName(ex)+' 본인 확인'; var bt=d.querySelector('.bts'); if(bt){ var no=bt.querySelector('button:not(.ok)'); if(no) no.remove(); } var bx=d.querySelector('.bx'); if(bx) bx.insertAdjacentHTML('afterbegin','<button type=\"button\" class=\"x\" aria-label=\"닫기\" onclick=\"acConfirmClose()\">✕</button>'); };");
// 구독 회원도 거래소 7곳 전부: 한도 없음
rep("(function(){\n  /* 머리와 몸을 화면 단위로.","(function(){\n  /* 구독 하나로 거래소 7곳 전부 연결한다. 한도 화면은 쓰지 않는다 */\n  acPaidFull=function(){ return false; };\n  /* 머리와 몸을 화면 단위로.");
fs.writeFileSync('px.js',p);

let l=fs.readFileSync('pl.js','utf8');
const repl=(a,b)=>{ if(!l.includes(a)) throw new Error('miss pl '+a.slice(0,60)); l=l.replace(a,b); };
repl("<li>'+plI('cal')+'<span>구독당 거래소 최대 '+AC_PAID_MAX+'곳 연결</span></li>","<li>'+plI('cal')+'<span>거래소 7곳 모두 연결</span></li>");
repl("'연결할 거래소를 고르십시오. 구독 하나로 '+AC_PAID_MAX+'곳까지 연결합니다.'","'먼저 연결할 거래소를 고르십시오. 구독 하나로 거래소 7곳을 모두 연결할 수 있습니다.'");
fs.writeFileSync('pl.js',l);

let c=fs.readFileSync('px.css','utf8');
c+=`
/* 세 번째 검수 반영: 타일과 카드 반경 26, 번호 없는 안내, 모바일도 제목 32 */
.px-exs button{background:#303030;border-radius:26px;border-color:transparent}
.px-exs button:hover{background:#3a3a3a;border-color:transparent}
.px-ch{border-radius:26px}
.px-steps li::before{display:none}
.px-steps li{grid-template-columns:minmax(0,1fr)}
.px-steps li>span{grid-column:1}
.px-steps b{line-height:1.4;margin-bottom:4px}
.px-perm li>span{font-size:16px}
.px-acct em{font-size:14px}
.acx-cf.px-cf .bx{position:relative}
.acx-cf.px-cf .bx>.x{position:absolute;right:18px;top:18px;width:34px;height:34px;border-radius:50%;border:0;background:none;color:#cdcdcd;font-size:15px;cursor:pointer}
.acx-cf.px-cf .bx>.x:hover{background:rgba(255,255,255,.08);color:#fff}
.acx-cf.px-cf h3{font-size:32px;padding-right:40px}
.acx-cf.px-cf .bts:empty{display:none}
@media (max-width:900px){ .px .px-head h1{font-size:32px} .px-card,.px-ch{border-radius:26px} .px-exs button{border-radius:20px} }
`;
fs.writeFileSync('px.css',c); console.log('patched');
