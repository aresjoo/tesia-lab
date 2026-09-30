// 구독: 결제 화면은 돈만 받는다. 거래소 고르기는 결제 뒤 무료 경로와 같은 연결 흐름에서
const fs=require('fs');
let l=fs.readFileSync('pl.js','utf8');
const rep=(a,b)=>{ const i=l.indexOf(a); if(i<0) throw new Error('miss '+a.slice(0,60)); l=l.slice(0,i)+b+l.slice(i+a.length); };
// 거래소 칸 삭제
rep(`  var exs='<div class="pl-exs" role="radiogroup"`,`  var exs=''; var exs0='<div class="pl-exs" role="radiogroup"`);
rep(`var acct=a.conn[cur]?'연결할 계정: '+acName(cur)+', 이미 연결됨':'연결할 계정: '+acName(cur);`,`var acct='';`);
rep(`<p class="pl-d2">'+(fixed?'이 전략의 거래소가 정해져 있습니다.':'먼저 연결할 거래소를 고르십시오. 구독 하나로 거래소 7곳을 모두 연결할 수 있습니다.')+'</p>'+exs`,`<p class="pl-d2">결제를 마치면 거래소를 연결합니다. 구독 하나로 거래소 7곳을 모두 연결할 수 있습니다.</p>'+exs`);
rep(`<div class="pl-lines"><div><span>'+acct+'</span></div><div><span>매월 구독료</span>`,`<div class="pl-lines"><div><span>매월 구독료</span>`);
rep(`+'<h3 class="pl-t3 mt">결제 수단 선택하기</h3>'`,`+'<h3 class="pl-t3 mt0">결제 수단 선택하기</h3>'`);
rep(`<section class="pl-left"><h3 class="pl-t3">TETH 구독</h3>`,`<section class="pl-left"><h3 class="pl-t3 pl-hid">TETH 구독</h3>`);
// 결제 뒤: 전략의 거래소가 정해져 있으면 그 거래소 승인, 아니면 거래소 선택
rep(`function plAfterPay(){ var a=acS(), ctx=PL.ctx||{}, ex=(ctx.need&&acEx(ctx.need))?ctx.need:(a.exSel||a.ex); a.newCard=0; if(ex){ a.ex=ex; a.exSel=null; } acSave(); acPageView(ex||null); }`,
    `function plAfterPay(){ var a=acS(), ctx=PL.ctx||{}, ex=(ctx.need&&acEx(ctx.need))?ctx.need:null; a.newCard=0; a.exSel=null; a.ex=ex; if(!ex){ a.auth={st:'idle'}; a.adding=acConnList().length?1:0; } acSave(); acPageView(ex); }`);
fs.writeFileSync('pl.js',l);
let c=fs.readFileSync('pl.css','utf8');
c+=`
/* 결제 화면은 돈만 받는다: 거래소 칸 없음. 폭 제한이 풀리지 않게 */
.pl.pl-co{max-width:1120px}
.pl-t3.pl-hid{display:none}
.pl-t3.mt0{margin:0 0 6px}
.pl-left .pl-d2{margin:0 0 18px}
`;
fs.writeFileSync('pl.css',c); console.log('ok');
