// 판단 기록의 글을 새 목소리로: voice/out-1~4.json 을 모아 rd-ui.js 에 넣고, 글을 고를 때 열쇠로 찾아 쓴다(없으면 조립한 글)
const fs=require('fs'), D=__dirname+'/', V='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/artifacts/teth-redesign/chat/voice/';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,70)); return s.replace(x,()=>y); };
const all={}; let n=0;
for(let i=1;i<=4;i++){ const o=JSON.parse(fs.readFileSync(V+'out-'+i+'.json','utf8')); for(const id of Object.keys(o)){ all[id]=o[id]; n+=Object.keys(o[id]).length; } }
if(Object.keys(all).length!==20||n!==160) throw new Error('voice count '+Object.keys(all).length+' / '+n);
fs.writeFileSync(D+'voice.json',JSON.stringify(all));
let c=fs.readFileSync(D+'chat.js','utf8');
if(!c.includes('MK_VOICE')){
  c=one(c,"  out.push({i:i0,k:'intro',tag:'전략 개요',t:mkChatIntro(s),ts:mkTS(s,i0,null,1)});\n  return out;","  out.push({i:i0,k:'intro',tag:'전략 개요',t:mkChatIntro(s),ts:mkTS(s,i0,null,1)});\n  /* 미리 써 둔 글이 있으면 그 글을 쓴다. 열쇠는 기록의 종류와 날짜 번호와 종목 */\n  var V=(typeof MK_VOICE!=='undefined'&&MK_VOICE[s.id])||null;\n  if(V) out.forEach(function(m){ var key=m.k==='now'?'now':m.k==='intro'?'intro':'e'+m.i+(m.a?'_'+m.a:'')+'_'+m.k; if(V[key]) m.t=V[key]; });\n  return out;");
  fs.writeFileSync(D+'chat.js',c);
}
const u=fs.readFileSync(D+'chat-ui.js','utf8');
let s=fs.readFileSync(D+'rd-ui.js','utf8'); const i=s.indexOf('/* ── 개요의 대화:'); if(i<0) throw new Error('chat block');
s=s.slice(0,s.lastIndexOf('\n',i))+'\n/* 판단 기록의 글(전략마다 8편). 엔진 기록을 근거로 미리 써 둔 것. 만드는 법은 artifacts/teth-redesign/chat/voice-prompt.md */\nvar MK_VOICE='+JSON.stringify(all)+';\n'+c+u;
fs.writeFileSync(D+'rd-ui.js',s); console.log('ok',n);
