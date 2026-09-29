// apply2.cjs 의 사본을 만들되, 앵커가 없을 때 멈추지 않고 건너뛴 목록을 남긴다
const fs=require('fs'), D=__dirname+'/';
let a=fs.readFileSync(D+'apply2.cjs','utf8');
const x="throw new Error('anchor x'+n+': '+a.slice(0,80));";
if(a.split(x).length!==2) throw new Error('rep shape');
a=a.replace(x,()=>"if(process.env.MK_SKIP){ console.log('SKIP x'+n+': '+a.slice(0,120).split(String.fromCharCode(13)).join('').split(String.fromCharCode(10)).join(' ')); return; } "+x);
fs.writeFileSync(D+'apply2.probe.cjs',a); console.log('ok');
