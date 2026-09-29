const fs=require('fs'), D=__dirname+'/';
let a=fs.readFileSync(D+'bt-a.js','utf8');
const x="E.cmp=b.length?b.map(function(d){ return d.tk+' '+d.cmp; }).join(' / '):f.cmp;";
if(a.split(x).length!==2) throw new Error('x');
a=a.replace(x,"E.cmp=b.length===1?b[0].cmp:b.length?b.map(function(d){ return d.tk+' '+d.cmp; }).join(' / '):f.cmp;");
fs.writeFileSync(D+'bt-a.js',a); console.log('ok');
