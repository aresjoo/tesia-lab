const fs=require('fs'); let s=fs.readFileSync(__dirname+'/layout.mjs','utf8');
const a="  #g-root .mk3 .mk3-ret b{font-size:24px}\n  .mk3 .mk-spark{width:150px;height:46px}";
if(s.split(a).length-1!==1) throw new Error('a');
s=s.replace(a,"  #g-root .mk3 .mk3-ret b{font-size:22px}\n  #g-root .mk3 .mk3-perf{gap:18px}\n  .mk3 .mk-spark{width:112px;height:42px}");
fs.writeFileSync(__dirname+'/layout.mjs',s);
