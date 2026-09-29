const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const n=s.split(x).length-1; if(n!==1) throw new Error('x'+n+': '+x.slice(0,60)); return s.replace(x,()=>y); };
let s=fs.readFileSync(D+'rd-ui.js','utf8');
s=one(s,`+'<div class="mk3-hd"><h3>`,`+'<h3>`);
s=one(s,`</button></h3>'+(s.by?'<span class="mk3-by">@'+gEsc(s.by)+'</span>':'')+'</div></div>'`,`</button></h3></div>'\n    +'<div class="mk3-meta">'+(s.by?'<span class="mk3-by">@'+gEsc(s.by)+'</span>':'')+'<span class="mk3-ex"><img src="assets/logos/'+ex[0]+'.png" alt="" width="12" height="12" loading="lazy">'+ex[1]+'에서 실행</span></div>'`);
s=one(s,`<span>'+gEsc(mkScope(s))+'</span><i class="mk3-ex"><img src="assets/logos/'+ex[0]+'.png" alt="" width="12" height="12" loading="lazy">'+ex[1]+'에서 실행</i></div>'`,`<span>'+gEsc(mkScope(s))+'</span></div>'`);
fs.writeFileSync(D+'rd-ui.js',s);
let c=fs.readFileSync(D+'rd.css','utf8'); const i=c.indexOf('/* 카드 v2:'); if(i<0) throw new Error('css'); c=c.slice(0,i)+fs.readFileSync(D+'card2.css','utf8').trimStart(); fs.writeFileSync(D+'rd.css',c); console.log('ok');
