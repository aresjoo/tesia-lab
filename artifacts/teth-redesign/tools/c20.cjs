// chat.js 는 c19 에서 이미 고쳐졌다. chat-ui.js 를 고치고, rd-ui.js 의 대화 부분을 두 파일로 다시 조립한다
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,60)); return s.replace(x,()=>y); };
let u=fs.readFileSync(D+'chat-ui.js','utf8');
if(!u.includes('function mkGloss(html,body)')){
  u=one(u,"function mkGloss(html){","function mkGloss(html,body){");
  u=one(u,"MK_GLOSS_K.forEach(function(k){ var i=out.indexOf(k);","MK_GLOSS_K.forEach(function(k){ if(body&&(k==='매수'||k==='매도')) return; var i=out.indexOf(k);");
  u=one(u,"+gEsc(rest)).split(","+gEsc(rest),true).split(");
  u=one(u,".slice(0,5)+'부터</p>'",".replace(/ .*$/,'')+'부터</p>'");
  fs.writeFileSync(D+'chat-ui.js',u);
}
const c=fs.readFileSync(D+'chat.js','utf8'); if(!c.includes('function mkPxU(')) throw new Error('chat.js not patched');
let s=fs.readFileSync(D+'rd-ui.js','utf8'); const i=s.indexOf('/* ── 개요의 대화:'); if(i<0) throw new Error('chat block');
s=s.slice(0,s.lastIndexOf('\n',i))+c+u; fs.writeFileSync(D+'rd-ui.js',s); console.log('ok');
