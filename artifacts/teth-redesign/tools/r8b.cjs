const fs=require('fs'), D=__dirname+'/'; let s=fs.readFileSync(D+'apply2.cjs','utf8');
const a=s.indexOf('// 5n.'), b=s.indexOf('// 6. rd'); if(a<0||b<a) throw new Error('markers');
s=s.slice(0,a)+fs.readFileSync(D+'r8-apply.txt','utf8').trim()+'\n'+s.slice(b); fs.writeFileSync(D+'apply2.cjs',s);
fs.appendFileSync(D+'rd.css','\n/* Round 7: 따라가기 시트 위에서 여는 대화 상자는 시트보다 위 */\nbody:has(#mk-follow) #ss3-dlgw{z-index:340}\n'); console.log('ok');
