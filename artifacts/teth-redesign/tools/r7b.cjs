const fs=require('fs'), D=__dirname+'/'; let s=fs.readFileSync(D+'apply2.cjs','utf8');
const L=s.split(/\r?\n/), i=L.findIndex(x=>x.startsWith('rep("toast(nick+')); if(i<0) throw new Error('toast line');
L[i]=fs.readFileSync(D+'r7-apply.txt','utf8').trim(); fs.writeFileSync(D+'apply2.cjs',L.join('\n')); console.log('ok');
