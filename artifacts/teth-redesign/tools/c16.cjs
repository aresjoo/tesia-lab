// 대화 화면을 합친 안으로 교체(rd-ui.js, rd.css 안의 이전 대화 화면 부분을 새 파일로 바꾼다)
const fs=require('fs'), D=__dirname+'/';
let s=fs.readFileSync(D+'rd-ui.js','utf8');
const i=s.indexOf('/* 개요의 대화 화면'); if(i<0) throw new Error('ui');
const j=s.lastIndexOf('\n',i);
s=s.slice(0,j)+fs.readFileSync(D+'chat-ui.js','utf8'); fs.writeFileSync(D+'rd-ui.js',s);
let c=fs.readFileSync(D+'rd.css','utf8'); const k=c.indexOf('/* 개요의 대화 */'); if(k<0) throw new Error('css');
c=c.slice(0,c.lastIndexOf('\n',k))+fs.readFileSync(D+'chat.css','utf8'); fs.writeFileSync(D+'rd.css',c);
console.log('ok');
