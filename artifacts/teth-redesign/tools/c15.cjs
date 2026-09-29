const fs=require('fs'), D=__dirname+'/';
let s=fs.readFileSync(D+'rd-ui.js','utf8'); const a="<em>펼치기</em></button></div></li>'"; if(s.split(a).length-1!==1) throw new Error('a'); s=s.replace(a,"<em>'+(open?'접기':'펼치기')+'</em></button></div></li>'"); fs.writeFileSync(D+'rd-ui.js',s);
let u=fs.readFileSync(D+'chat-ui.js','utf8'); u=u.replace(a,"<em>'+(open?'접기':'펼치기')+'</em></button></div></li>'"); fs.writeFileSync(D+'chat-ui.js',u);
let c=fs.readFileSync(D+'rd.css','utf8');
for(const [x,y] of [[".mkc-av{flex:none;width:40px;height:40px;margin-top:22px;",".mkc-av{flex:none;width:40px;height:40px;margin-top:0;"],["  .mkc-av{width:32px;height:32px;margin-top:22px}","  .mkc-av{width:32px;height:32px;margin-top:0}"]]){ if(c.split(x).length-1!==1) throw new Error(x); c=c.replace(x,y); }
fs.writeFileSync(D+'rd.css',c); console.log('ok');
