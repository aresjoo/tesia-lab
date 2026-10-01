const fs=require('fs');
let j=fs.readFileSync('sk-mkt.js','utf8'), n=0;
const r=(a,b)=>{ if(!j.includes(a)) throw new Error('miss '+a.slice(0,60)); j=j.replace(a,b); n++; };
r("['1h','1시간'],['4h','4시간'],['1d','1일']]","['1h','1시간'],['2h','2시간'],['4h','4시간'],['6h','6시간'],['12h','12시간'],['1d','1일']]");
r("var day=per==='1d';","var day=['4h','6h','12h','1d'].indexOf(per)>=0;");
fs.writeFileSync('sk-mkt.js',j);
let c=fs.readFileSync('sk-mkt.css','utf8');
c+="\n/* 탭과 기간 알약: 클릭 뒤 남는 파란 기본 테두리 제거, 키보드 초점만 회색 */\n.mkt-tabs button:focus,.mkx-per button:focus{outline:0;box-shadow:none}\n.mkt-tabs button:focus-visible,.mkx-per button:focus-visible{outline:2px solid #9a9a9a;outline-offset:2px}\n";
fs.writeFileSync('sk-mkt.css',c); console.log('ok',n);
