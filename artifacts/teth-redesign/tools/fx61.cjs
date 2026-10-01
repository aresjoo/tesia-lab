const fs=require('fs');
let b=fs.readFileSync('build.sh','utf8'); if(!b.includes('sk-cpx.css')){ b=b.replace('sk-mkt.css sk-qa.css > bt.css','sk-mkt.css sk-cpx.css sk-qa.css > bt.css'); fs.writeFileSync('build.sh',b); }
let a=fs.readFileSync('apply2.cjs','utf8'); if(!a.includes("'sk-cpx.js'")){ a=a.replace("'sk-mkt.js','sk-qa.js']","'sk-mkt.js','sk-cpx.js','sk-qa.js']"); fs.writeFileSync('apply2.cjs',a); }
console.log(fs.readFileSync('build.sh','utf8').includes('sk-cpx.css'), fs.readFileSync('apply2.cjs','utf8').includes("'sk-cpx.js'"));
