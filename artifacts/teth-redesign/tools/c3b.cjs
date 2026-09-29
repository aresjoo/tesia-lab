const fs=require('fs'), D=__dirname+'/'; let s=fs.readFileSync(D+'rd-ui.js','utf8');
const one=(x,y)=>{ const n=s.split(x).length-1; if(n!==1) throw new Error('x'+n+': '+x.slice(0,50)); s=s.replace(x,()=>y); };
one("height=\"'+(yb+2).toFixed(1)+'\"/></clipPath>'\n    +'<clipPath id=\"'+id+'d\"><rect x=\"-2\" y=\"'+yb.toFixed(1)+'\"","height=\"'+(yb+3.2).toFixed(1)+'\"/></clipPath>'\n    +'<clipPath id=\"'+id+'d\"><rect x=\"-2\" y=\"'+(yb+1.2).toFixed(1)+'\"");
fs.writeFileSync(D+'rd-ui.js',s); console.log('ok');
