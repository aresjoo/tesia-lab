const fs=require('fs');
for(const f of ['sk-cpx.js','sk-cpx.css']){ let s=fs.readFileSync(f,'utf8'); const n=(s.match(/\bcx-/g)||[]).length; s=s.replace(/\bcx-/g,'cq-'); fs.writeFileSync(f,s); console.log(f,n); }
