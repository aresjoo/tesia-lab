// 초대 계정 회원이 다른 거래소를 구독으로 연결하는 길 + 연결 화면 폭
const fs=require('fs');
let p=fs.readFileSync('px.js','utf8');
const rep=(a,b)=>{ const i=p.indexOf(a); if(i<0) throw new Error('miss '+a.slice(0,60)); p=p.slice(0,i)+b+p.slice(i+a.length); };
rep(`<a class="pl-link acx-a" href="'+gEsc(acRef(a.ex))+'" target="_blank" rel="noopener">'+n+' 가입 화면 다시 열기</a></p>'`,
    `<a class="pl-link acx-a" href="'+gEsc(acRef(a.ex))+'" target="_blank" rel="noopener">'+n+' 가입 화면 다시 열기</a>'+pxPaidLink(n)+'</p>'`);
rep(`>기존 초대 계정 연결</button></p>');`,`>기존 초대 계정 연결</button>'+pxPaidLink(n)+'</p>');`);
p+=`
/* 초대 계정이 아닌, 지금 쓰는 거래소 계정을 구독으로 연결: 결제 → 같은 거래소 승인 */
function pxPaidLink(n){ return acSubOn()?'':'<button type="button" class="pl-link" onclick="pxPaidRoute()">지금 쓰는 '+n+' 계정으로 연결 (월 '+acUsd(AC_CFG.price)+')</button>'; }
function pxPaidRoute(){ var a=acS(), ex=a.ex, ctx=AC_CTX||{}; a.route='paid'; a.has=null; a.g=0; acSave(); try{ tfTrack('px_paid_route',{ex:ex}); }catch(e){} var c={}; for(var k in ctx) c[k]=ctx[k]; c.need=ex; plCheckout(c); }
`;
fs.writeFileSync('px.js',p);
let c=fs.readFileSync('px.css','utf8');
c+=`
/* 결제 화면 폭 제한(.pl.pl-co)이 연결 화면의 좁은 폭을 덮지 않게 */
.pl.pl-co.px{max-width:640px}
`;
fs.writeFileSync('px.css',c); console.log('ok');
