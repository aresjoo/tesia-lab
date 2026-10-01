// 내 거래소 거르기 줄을 빌드 소스(rd-ui.js)의 tfSS3GridHtml 에 넣는다 (index.html 원본에 넣으면 빌드 때 덮어써짐)
const fs=require('fs');
let s=fs.readFileSync('rd-ui.js','utf8');
const nl=s.includes('\r\n')?'\r\n':'\n';
const a="mkTk(s.asset||'')].join(' ').toLowerCase().indexOf(q)>=0; }); }";
const i=s.indexOf(a); if(i<0) throw new Error('miss q');
if(!s.includes('rows=tfMyExFilter(rows)')) s=s.slice(0,i+a.length)+nl+"  if(typeof tfMyExFilter==='function') rows=tfMyExFilter(rows);"+s.slice(i+a.length);
const b="var plain=(!t.ss.asset||t.ss.asset==='all')&&(!t.ss.kind||t.ss.kind==='all')&&!TF_SS_Q;";
if(s.includes(b)) s=s.replace(b,"var plain=(!t.ss.asset||t.ss.asset==='all')&&(!t.ss.kind||t.ss.kind==='all')&&!TF_SS_Q&&!(typeof tfMyExOn==='function'&&tfMyExOn());");
fs.writeFileSync('rd-ui.js',s);
console.log('ok',s.includes('rows=tfMyExFilter(rows)'),s.includes('tfMyExOn())'));
