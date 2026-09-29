const fs=require('fs'), D=__dirname+'/'; let s=fs.readFileSync(D+'rd-ui.js','utf8');
const a="gEsc(s.by)+' 등록</span>':'')+'<span class=\"mk3-ex\">", b="gEsc(s.by)+'</span>':'')+'<span class=\"mk3-ex\">";
if(s.split(a).length-1!==1) throw new Error('anchor'); s=s.replace(a,()=>b); fs.writeFileSync(D+'rd-ui.js',s); console.log('ok');
