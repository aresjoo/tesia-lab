// 팝업의 설정 항목: 하위 메뉴(언어 및 통화) 없이 설정 페이지로만 간다. 손님은 먼저 로그인
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let s=fs.readFileSync(R,'utf8');
const i=s.indexOf('<div class="gm-item" id="gm-set-item"'), j=s.indexOf('<button class="gm-item" onclick="gSetMenuClose();tfNav(\'#/insight\')">');
if(i<0||j<0||j<i) throw new Error('block');
const block=s.slice(i,j);
const svg=block.match(/<svg[\s\S]*?<\/svg>/)[0];
s=s.slice(0,i)+'<button class="gm-item" id="gm-set-item" onclick="gmSetClick(event)">\r\n      '+svg+'\r\n      설정\r\n    </button>\r\n    '+s.slice(j);
const a="function gmSetClick(e){ if(S.user&&typeof stGo==='function'){ e.stopPropagation(); gSetMenuClose(); stGo('general'); return; } gmSub(e,'set'); }";
if(s.split(a).length!==2) throw new Error('a');
s=s.replace(a,"function gmSetClick(e){ e.stopPropagation(); gSetMenuClose(); if(!S.user){ authOpen('login'); if(typeof tfIntentSet==='function') tfIntentSet({kind:'settings'}); return; } stGo('general'); }");
// 하위 메뉴가 사라졌으니 그 안의 언어 이름을 갱신하던 코드는 요소가 없어도 넘어간다 (gm-set-st 는 if 로 보호돼 있음)
fs.writeFileSync(R,s); console.log('ok', /gm-sub-set/.test(s)?'sub still referenced in css only':'');
