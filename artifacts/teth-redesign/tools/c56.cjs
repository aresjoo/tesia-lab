// 내 전략 주소는 저장된 상태가 복원된 뒤에 판단한다
const fs=require('fs'), D=__dirname+'/';
let c=fs.readFileSync(D+'bt-c.js','utf8');
const x="  var m=h.match(/^#\\/share\\/bt\\/([^/]+)(?:\\/(go))?$/); TF_ONSHARE=true;";
if(c.split(x).length!==2) throw new Error('anchor');
c=c.replace(x,x+"\n  if(m&&m[1]==='mine'&&!window.TF_STATE_READY){ TF_ONSHARE=false; return; } /* 부팅이 끝나면 다시 불린다 */");
fs.writeFileSync(D+'bt-c.js',c); console.log('ok');
