const fs=require('fs'), D=__dirname+'/'; let a=fs.readFileSync(D+'apply2.cjs','utf8');
const k=a.indexOf('// 6. rd'); if(k<0) throw new Error('marker');
const A="  gContent('<div class=\"tf-page tfbk ss3 mk\">'\n    +mkHero()\n    +tabs+controls+body", B="  gContent('<div class=\"tf-page tfbk ss3 mk\">'\n    +tabs+controls+body";
const line='// 5s. 전략 따라하기 상단 소개 영역(제목, 공지, 배너)을 없앤다\nrep('+JSON.stringify(A)+','+JSON.stringify(B)+',true);\n';
if(a.includes('// 5s.')) throw new Error('already'); a=a.slice(0,k)+line+a.slice(k); fs.writeFileSync(D+'apply2.cjs',a); console.log('ok');
