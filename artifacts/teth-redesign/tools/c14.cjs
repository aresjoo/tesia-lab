// 개요 탭: 성과 그래프 아래에 전략의 말(대화)
const fs=require('fs'), D=__dirname+'/';
let s=fs.readFileSync(D+'rd-ui.js','utf8');
const a="    +chart+'<p class=\"mk3-since num\">'+mkdSince(s)+' 시작 이후 '+mkPct0(R0.ret)+'</p></section>'\n    +'</div>';";
if(s.split(a).length-1!==1) throw new Error('anchor');
s=s.replace(a,()=>"    +chart+'<p class=\"mk3-since num\">'+mkdSince(s)+' 시작 이후 '+mkPct0(R0.ret)+'</p></section>'\n    +mkChatHtml(s,R0,ne,pd)\n    +'</div>';");
s+=fs.readFileSync(D+'chat.js','utf8')+fs.readFileSync(D+'chat-ui.js','utf8');
fs.writeFileSync(D+'rd-ui.js',s);
fs.appendFileSync(D+'rd.css',fs.readFileSync(D+'chat.css','utf8'));
console.log('ok');
