const fs=require('fs'); let s=fs.readFileSync(__dirname+'/c19.cjs','utf8');
const a=`s=all(s,"'체결가 '+mkPxFmt(e.px)+'에","'체결가 '+mkPxU(e.a,e.px)+'에",4);`, b=`s=all(s,"체결가 '+mkPxFmt(e.px)+'에","체결가 '+mkPxU(e.a,e.px)+'에",4);`;
if(s.split(a).length-1!==1) throw new Error('a'); fs.writeFileSync(__dirname+'/c19.cjs',s.replace(a,()=>b)); console.log('ok');
