// 선물 엔진과 선물 데이터를 빌드에 연결한다
const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
const one=(s,x,y,tag)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error(tag+' x'+c); return s.split(x).join(y); };
let a=fs.readFileSync(D+'apply2.cjs','utf8');
a=one(a,"fs.readFileSync(D+'agent-core.js','utf8')+'\\n'+fs.readFileSync(D+'rd-ui.js','utf8')","fs.readFileSync(D+'agent-core.js','utf8')+'\\n'+fs.readFileSync(D+'fut-core.js','utf8')+'\\n'+fs.readFileSync(D+'rd-ui.js','utf8')",'apply2');
fs.writeFileSync(D+'apply2.cjs',a);
let r=fs.readFileSync(D+'rd-ui.js','utf8');
r=one(r,"  var st=startI!=null?startI:c.startI;","  var st=startI!=null?startI:c.startI;\n  if(c.fut){ var f={}; for(var k in c) f[k]=c[k]; if(c.uni) f.uni=MK_UNI[c.uni].list; f.startI=st; return mkFutRun(f); }",'rd-ui');
fs.writeFileSync(D+'rd-ui.js',r);
let h=fs.readFileSync(F,'utf8');
h=one(h,'<script src="data/px-daily.js?v=2026-09-28b"></script>','<script src="data/px-daily.js?v=2026-09-28b"></script>\r\n<script src="data/fut-daily.js?v=2026-09-28"></script>','index');
fs.writeFileSync(F,h);
console.log('ok');
