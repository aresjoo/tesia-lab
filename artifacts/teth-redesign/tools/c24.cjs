const fs=require('fs'), D=__dirname+'/';
for(const f of ['chat-ui.js','rd-ui.js']){ let s=fs.readFileSync(D+f,'utf8'); const a="gEsc(mkPolite(MK_GLOSS[k]||''))"; if(s.split(a).length-1!==1) throw new Error(f); s=s.replace(a,"gEsc(mkPolite(MK_GLOSS[k]||'').split(/(?<=[.])\s+/).map(function(x){ return /니다[.]$/.test(x)?x:x.replace(/[.]$/,'입니다.'); }).join(' '))"); fs.writeFileSync(D+f,s); }
console.log('ok');
