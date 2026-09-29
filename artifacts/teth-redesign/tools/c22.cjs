// 판단 기록: 제목을 "판단 기록"으로, 말의 폭을 위 그래프와 같은 폭으로
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,60)); return s.replace(x,()=>y); };
for(const f of ['chat-ui.js','rd-ui.js']){ let s=fs.readFileSync(D+f,'utf8'); s=one(s,"<h3>'+gEsc(mkHook(s))+'의 판단 기록</h3>","<h3>판단 기록</h3>"); fs.writeFileSync(D+f,s); }
for(const f of ['chat.css','rd.css']){ let c=fs.readFileSync(D+f,'utf8');
  c=one(c,".mkc-m{display:flex;gap:12px;align-items:flex-start;max-width:840px}",".mkc-m{display:flex;gap:12px;align-items:flex-start}");
  c=one(c,".mkc-more{margin:22px 0 0 48px;",".mkc-more{display:block;margin:22px 0 0 48px;");
  fs.writeFileSync(D+f,c); }
console.log('ok');
