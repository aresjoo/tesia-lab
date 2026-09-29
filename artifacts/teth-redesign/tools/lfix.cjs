const fs=require('fs'); let s=fs.readFileSync(__dirname+'/layout.mjs','utf8');
const a=s.indexOf('s.textContent=${'), b=s.indexOf(";tfShareHub('find')",a); if(a<0||b<a) throw new Error('x');
s=s.slice(0,a)+"s.textContent=${JSON.stringify(V[k].css.split('#g-root').join('html body #g-root').split('.mk3 .mk-spark').join('html body #g-root .mk3 .mk-spark'))}"+s.slice(b);
fs.writeFileSync(__dirname+'/layout.mjs',s);
