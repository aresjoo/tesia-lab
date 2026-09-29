// 고친 글을 다시 넣는다: rd-ui.js 의 MK_VOICE 한 줄을 새 값으로
const fs=require('fs'), D=__dirname+'/', V='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/artifacts/teth-redesign/chat/voice/';
const all={}; let n=0; for(let i=1;i<=4;i++){ const o=JSON.parse(fs.readFileSync(V+'out-'+i+'.json','utf8')); for(const id in o){ all[id]=o[id]; n+=Object.keys(o[id]).length; } }
if(Object.keys(all).length!==20||n!==160) throw new Error('count');
let s=fs.readFileSync(D+'rd-ui.js','utf8'); const i=s.indexOf('var MK_VOICE='), j=s.indexOf('\n',i); if(i<0) throw new Error('voice'); s=s.slice(0,i)+'var MK_VOICE='+JSON.stringify(all)+';'+s.slice(j);
fs.writeFileSync(D+'rd-ui.js',s); fs.writeFileSync(D+'voice.json',JSON.stringify(all)); console.log('ok',n);
