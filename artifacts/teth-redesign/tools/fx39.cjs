const fs=require('fs'); const f=__dirname+'/sk-ask.js'; let s=fs.readFileSync(f,'utf8');
const a="몇 가지만 여쭙겠습니다. 아래에서 '+steps.length+'개에 답해 주십시오";
if(s.split(a).length!==2) throw new Error('count');
s=s.replace(a,"'+(steps.length>1?'몇 가지만 여쭙겠습니다. 아래에서 '+steps.length+'개에 답해 주십시오':'아래에서 골라 주십시오')+'");
fs.writeFileSync(f,s); console.log('ok');
