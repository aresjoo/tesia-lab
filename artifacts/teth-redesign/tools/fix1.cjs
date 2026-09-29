const fs=require('fs'); let s=fs.readFileSync('rd-ui.js','utf8');
function rep(a,b){ if(s.split(a).length!==2) throw new Error('anchor '+a.slice(0,50)); s=s.replace(a,()=>b); }
rep("if(s.p){ var o=mkOpenPos(s.p,r); return mkWithPx(","if(s.p){ return mkWithPx(");
rep("[['언제 사나',c.every===1?'매일':c.every+'일마다'+' 종목을 다시 비교해서, 흐름이 가장 강한 종목이 기준을 넘을 때']","[['언제 사나',(c.every===1?'매일':c.every+'일마다')+' 종목을 다시 비교해서, 흐름이 가장 강한 종목이 기준을 넘을 때']");
rep("if(!s.kind||s.me&&!s.id) s.kind=s.kind||'rule';","if(!s.kind) s.kind='rule';");
fs.writeFileSync('rd-ui.js',s); console.log('ok');
