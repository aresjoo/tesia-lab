const fs=require('fs'), D=__dirname+'/'; let s=fs.readFileSync(D+'apply2.cjs','utf8');
const L=s.split('\n'), i=L.findIndex(x=>x.includes('시뮬레이션 데이터예요')); if(i<0) throw new Error('line');
L[i]=L[i].replace(/rep\(.*\);/,'').replace(/^\s*\}\s*$/,' }'); if(!L[i].trim()) L[i]=' }'; else if(!L[i].includes('}')) L[i]+=' }';
fs.writeFileSync(D+'apply2.cjs',L.join('\n')); console.log(JSON.stringify(L[i]));
