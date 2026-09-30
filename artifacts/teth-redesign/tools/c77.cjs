// 팝업 메뉴는 예전대로. "설정" 항목만 하위 메뉴 대신 설정 페이지로 간다. 손님은 하위 메뉴(언어, 화면) 유지
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let s=fs.readFileSync(R,'utf8');
const a='    <div class="gm-item" role="button" tabindex="0" onclick="gmSub(event,\'set\')" onmouseenter="gmFlip(this)">';
if(s.split(a).length!==2) throw new Error('a');
s=s.replace(a,'    <div class="gm-item" id="gm-set-item" role="button" tabindex="0" onclick="gmSetClick(event)" onmouseenter="if(!S.user)gmFlip(this)">');
const b='function gmSub(e,which){';
if(s.split(b).length!==2) throw new Error('b');
s=s.replace(b,"/* 설정 항목: 회원은 설정 페이지로, 손님은 예전 하위 메뉴(언어, 화면) */\r\nfunction gmSetClick(e){ if(S.user&&typeof stGo==='function'){ e.stopPropagation(); gSetMenuClose(); stGo('general'); return; } gmSub(e,'set'); }\r\n"+b);
fs.writeFileSync(R,s);
// p16: 팝업을 가로채던 두 곳을 지운다
const P=__dirname+'/p16.js'; let p=fs.readFileSync(P,'utf8');
const c="  if(typeof gProfileClick==='function'&&!gProfileClick.p16){ gProfileClick=function(ev){ if(!S.user){ authOpen('login'); return; } try{ gSetMenuClose(); }catch(x){} stGo('account'); }; gProfileClick.p16=1; }\n  if(!gSetMenu.p16){ var g0=gSetMenu; gSetMenu=function(e){ if(S.user){ if(e&&e.stopPropagation) e.stopPropagation(); try{ gSetMenuClose(); }catch(x){} stGo('general'); return; } return g0.apply(this,arguments); }; gSetMenu.p16=1; }\n";
if(p.split(c).length!==2) throw new Error('c');
p=p.replace(c,"  /* 팝업 메뉴는 예전 그대로 둔다. 설정 항목의 이동은 index.html 의 gmSetClick 이 맡는다 */\n");
fs.writeFileSync(P,p); console.log('ok');
