const fs=require('fs'), D=__dirname+'/'; let a=fs.readFileSync(D+'apply2.cjs','utf8');
const L=a.split('\n'), i=L.findIndex(x=>x.startsWith('rep("tab=(tab&&MK_TAB_OK[tab])')); if(i<0) throw new Error('line'); L.splice(i,1); fs.writeFileSync(D+'apply2.cjs',L.join('\n'));
let s=fs.readFileSync(D+'rd-ui.js','utf8'); const x="MK_PD_OK={all:1,'1y':1,'30d':1,'7d':1,'2y':1};"; if(s.split(x).length-1!==1) throw new Error('pd'); s=s.replace(x,x+"\nMK_TAB_OK={ov:1,perf:1,trades:1,info:1}; /* 활동 탭은 없앴다. 옛 주소는 개요로 */"); fs.writeFileSync(D+'rd-ui.js',s); console.log('ok');
