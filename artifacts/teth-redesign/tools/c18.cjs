const fs=require('fs'), D=__dirname+'/'; let a=fs.readFileSync(D+'apply2.cjs','utf8');
const L=a.split('\n'), i=L.findIndex(x=>x.startsWith('// 5u.')); if(i<0) throw new Error('5u');
L[i+1]='rep("(all|1y|2y))?(?:","(all|1y|2y|30d|7d))?(?:",true);';
fs.writeFileSync(D+'apply2.cjs',L.join('\n')); console.log('ok');
