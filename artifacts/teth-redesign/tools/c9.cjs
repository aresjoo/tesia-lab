const fs=require('fs'), D=__dirname+'/';
const cp=JSON.parse(fs.readFileSync(D+'copy.json','utf8')); cp.r3.one='이더리움이 3% 넘게 떨어지면 팔고, 15% 오르거나 25일 지나도 팔아요.'; fs.writeFileSync(D+'copy.json',JSON.stringify(cp,null,1));
let s=fs.readFileSync(D+'rd-ui.js','utf8'); const a="  if(n<10) return n+'번 중 '+Math.round(w*n/100)+'번';";
if(s.split(a).length-1!==1) throw new Error('a'); s=s.replace(a,a+"\n  if(w<=0) return n.toLocaleString()+'번 중 0번'; if(w>=100) return n.toLocaleString()+'번 모두';"); fs.writeFileSync(D+'rd-ui.js',s); console.log('ok');
