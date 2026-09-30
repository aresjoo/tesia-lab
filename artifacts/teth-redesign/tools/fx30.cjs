// 구독 회원도 초대 계정으로 연결(작은 링크), 초대 경로에서 구독으로 되돌아가기, Gate 앱 아이콘
const fs=require('fs');
let p=fs.readFileSync('px.js','utf8');
const rep=(a,b)=>{ const i=p.indexOf(a); if(i<0) throw new Error('miss '+a.slice(0,60)); p=p.slice(0,i)+b+p.slice(i+a.length); };
rep(`n+'에서 승인하기</button>';`,`n+'에서 승인하기</button>'+pxInviteLink();`);
rep(`function pxPaidLink(n){ return acSubOn()?'':`,`function pxPaidLink(n){ return acSubOn()?'<button type="button" class="pl-link" onclick="pxSubRoute()">구독으로 연결</button>':`);
p+=`
/* 구독 회원이 이 거래소만 TETH 초대 계정으로 연결하고 싶을 때: 드문 경우라 승인 단추 아래 작은 링크 하나 */
function pxInviteLink(){ var a=acS(); if(!acSubOn()||acRouteNow()!=='paid'||!a.ex||a.conn[a.ex]) return ''; return '<p class="px-links px-sm"><button type="button" class="pl-link" onclick="pxInviteRoute()">TETH 초대 계정으로 연결</button></p>'; }
function pxInviteRoute(){ var a=acS(); a.route='partner'; a.has=null; a.g=0; a.auth={st:'idle'}; a.uid={st:'none'}; acSave(); try{ tfTrack('px_invite_route',{ex:a.ex}); }catch(e){} acRe(); }
function pxSubRoute(){ var a=acS(); a.route='paid'; a.has=null; a.g=0; acSave(); acRe(); }
(function(){
  /* Gate: 앱스토어 앱 아이콘 */
  var lg0=acLogo; acLogo=function(id,z){ if(id==='gate'){ z=z||28; return '<img src="assets/logos/app-gate.jpg" alt="" width="'+z+'" height="'+z+'" loading="lazy">'; } return lg0.apply(this,arguments); };
})();
`;
fs.writeFileSync('px.js',p);
let c=fs.readFileSync('px.css','utf8');
c+=`
.px-links.px-sm{margin-top:12px}
.px-links.px-sm .pl-link{font-size:13px;color:#9a9a9a}
.px-links.px-sm .pl-link:hover{color:#fff}
`;
fs.writeFileSync('px.css',c); console.log('ok');
