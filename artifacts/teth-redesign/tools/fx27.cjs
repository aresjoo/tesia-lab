// 계정 화면 파란 카드 + 플랜 화면 세 카드 폭
const fs=require('fs');
let p=fs.readFileSync('px.js','utf8');
const rep=(a,b)=>{ const i=p.indexOf(a); if(i<0) throw new Error('miss '+a.slice(0,50)); p=p.slice(0,i)+b+p.slice(i+a.length); };
rep(`return '<div class="px-card"><ul class="px-steps"><li><b>TETH 초대 링크로 가입</b><span>이메일이나 전화번호로 가입합니다.</span></li>`,
    `return '<div class="px-card'+(j?' px-hi':'')+'"><ul class="px-steps"><li'+(j?' class="ok"':'')+'><b>'+(j?AC_CK:'')+'TETH 초대 링크로 가입</b><span>'+(j?n+' 가입 화면을 열었습니다. 가입을 마쳤다면 계정을 연결합니다.':'이메일이나 전화번호로 가입합니다.')+'</span></li>`);
rep(`(j?'<button type="button" class="pl-cta pl-cta-w px-cta" onclick="acGuide(2)">`,`(j?'<button type="button" class="pl-cta pl-cta-hi px-cta" onclick="acGuide(2)">`);
fs.writeFileSync('px.js',p);
let l=fs.readFileSync('pl.js','utf8');
const a0=`gContent('<div class="pl" id="pl-root">`; if(l.indexOf(a0)<0) throw new Error('miss pl');
l=l.replace(a0,`gContent('<div class="pl'+(bt?' pl-wide':'')+'" id="pl-root">`); fs.writeFileSync('pl.js',l);
let c=fs.readFileSync('pl.css','utf8');
c+=`
/* 결과 카드까지 세 장일 때는 폭을 넓힌다 (카드가 좁아 제목이 두 줄로 꺾이지 않게) */
.pl.pl-wide{max-width:1520px}
.pl.pl-wide .pl-grid.has-bt{gap:24px}
`;
fs.writeFileSync('pl.css',c); console.log('ok');
