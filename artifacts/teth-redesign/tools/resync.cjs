// main 의 index.html 에서 RD_CORE, RD_CSS 블록을 꺼내 패치 원본(agent-core.js, rd-ui.js, rd.css)을 맞춘다
const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
const CR=String.fromCharCode(13), LF=String.fromCharCode(10);
const t=fs.readFileSync(F,'utf8').split(CR+LF).join(LF);
function blk(tag){ const B='/*'+tag+'_BEGIN*/', E='/*'+tag+'_END*/', i=t.indexOf(B), j=t.indexOf(E); if(i<0||j<0) throw new Error(tag); return t.slice(i+B.length,j).trim(); }
const core=blk('RD_CORE'), css=blk('RD_CSS');
const ui0=fs.readFileSync(D+'rd-ui.js','utf8').split(CR+LF).join(LF);
const first=ui0.trim().split(LF)[0];
const n=core.split(LF+first+LF).length-1; if(n!==1) throw new Error('split x'+n+': '+first.slice(0,60));
const k=core.indexOf(LF+first+LF);
const ac=core.slice(0,k).trim()+LF, ui=core.slice(k+1).trim()+LF;
const old={ac:fs.readFileSync(D+'agent-core.js','utf8').split(CR+LF).join(LF), css:fs.readFileSync(D+'rd.css','utf8').split(CR+LF).join(LF)};
console.log('agent-core', old.ac.trim()===ac.trim()?'same':'CHANGED', ac.length);
console.log('rd-ui', ui0.trim()===ui.trim()?'same':'CHANGED', ui.length);
console.log('rd.css', old.css.trim()===css.trim()?'same':'CHANGED', css.length);
fs.writeFileSync(D+'agent-core.js',ac); fs.writeFileSync(D+'rd-ui.js',ui); fs.writeFileSync(D+'rd.css',css+LF);
