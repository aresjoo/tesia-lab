// 승률 정렬의 뒤로 보내기는 100칸으로 자른 뒤에. 눈금은 거의 같은 값도 같은 값으로 본다
const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,70)); return s.replace(x,()=>y); };
let s=fs.readFileSync(D+'rd-ui.js','utf8');
const P="  if(mkSortKey(t)==='win'){ var few=function(s){ return ((s.r&&s.r.n)||0)<MK_WIN_MIN; }; rows=rows.filter(function(s){ return !few(s); }).concat(rows.filter(few)); }\n";
s=one(s,P,"");
s=one(s,"  rows=rows.slice(0,PER*MAXP);\n","  rows=rows.slice(0,PER*MAXP);\n"+P);
fs.writeFileSync(D+'rd-ui.js',s);
let t=fs.readFileSync(F,'utf8');
t=one(t,"function mkdTicks(a,b,n){ if(!(b>a)){","function mkdTicks(a,b,n){ if(!(b-a>1e-9*Math.max(1,Math.abs(a)))){");
fs.writeFileSync(F,t); console.log('ok');
