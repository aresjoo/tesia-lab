// walk.mjs 를 4판 구조에 맞춘다(숫자 줄이 없어지고 판단 패널이 요약이 된다)
const fs=require('fs'), F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/qa/walk.mjs';
const BS=String.fromCharCode(92);
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c<1) throw new Error('x'+c+': '+x.slice(0,60)); return s.split(x).join(y); };
let w=fs.readFileSync(F,'utf8');
const ws="replace(/"+BS+BS+"s+/g,' ')";
w=one(w,"live:document.getElementById('bt-live').innerText."+ws+",","");
w=one(w,"await evala(p,`document.querySelector('#bt-live button').click()`);","await evala(p,`document.querySelector('#bt-panel .cell button').click()`);");
w=one(w,"feed:document.querySelectorAll('.bt-fc').length","feed:document.querySelectorAll('.bt-fr').length");
w=one(w,"cells:[...document.querySelectorAll('#bt-panel .cell')]","last:(document.getElementById('bt-plast')||{textContent:''}).textContent,marks:document.querySelectorAll('#bt-mk .bt-m.on').length,feedTop:(document.querySelector('.bt-fr')||{innerText:''}).innerText."+ws+",cells:[...document.querySelectorAll('#bt-panel .cell')]");
w=one(w,"rail:document.getElementById('bt-rail').innerText."+ws+".slice(0,900),","rail:document.getElementById('bt-rail').innerText."+ws+".slice(0,900),panel:document.getElementById('bt-panel').innerText."+ws+",widths:{col:document.querySelector('.bt-main').parentNode.clientWidth,chart:document.getElementById('bt-chart').offsetWidth,panel:document.getElementById('bt-panel').offsetWidth,ev:document.getElementById('bt-ev').scrollWidth,rail:document.getElementById('bt-rail').offsetWidth},");
fs.writeFileSync(F,w); console.log('ok');
