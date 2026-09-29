const fs=require('fs'), D=__dirname+'/';
const rep=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,70)); return s.split(x).join(y); };
let g=fs.readFileSync(D+'bt-go.js','utf8');
g=rep(g,"if(v!==f.uid) btInval(f); f.uidIn=v; tfSave();","if(v!==f.uid){ var had=!!(f.okUid||f.api); btInval(f); f.uidIn=v; tfSave(); if(had) btGoRe(); } else { f.uidIn=v; tfSave(); }");
g=rep(g,"var g=btF(); btInval(g); tfSave();\n    btErr(","var g=btF(), had=!!(g.okUid||g.api); btInval(g); tfSave(); if(had) btGoRe();\n    btErr(");
fs.writeFileSync(D+'bt-go.js',g); console.log('ok');
