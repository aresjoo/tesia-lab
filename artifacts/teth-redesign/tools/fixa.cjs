const fs=require('fs'); let L=fs.readFileSync('apply2.cjs','utf8').split('\n');
// 5g 의 두 번째 rep 이 여러 줄로 깨졌다: 그 구간을 찾아 한 줄짜리 올바른 코드로 바꾼다
const i=L.findIndex(x=>x.startsWith("rep(\"      +'<span class=\\\"tag '+(on?'on':'off')")); if(i<0) throw new Error('not found');
let j=i; while(!L[j].includes(",true);")) j++;
const good=[
"rep([\"      +'<span class=\\\"tag '+(on?'on':'off')+'\\\">'+(on?'따라가는 중':'중단됨')+'</span>'\",\"      +'<span style=\\\"flex:1\\\"></span><span class=\\\"cps-static num\\\">'+new Date(c2.at).toLocaleDateString('ko-KR')+' 시작</span></div>'\",\"      +(on?'<div class=\\\"cpd-kv\\\">'\"].join('\n'),",
"    [\"      +'<span class=\\\"tag '+(on&&!d.missing?'on':'off')+'\\\">'+(d.missing?'원본을 찾을 수 없음':on?'따라가는 중':'중단됨')+'</span>'\",\"      +'<span style=\\\"flex:1\\\"></span><span class=\\\"cps-static num\\\">'+new Date(c2.at).toLocaleDateString('ko-KR')+' 시작</span></div>'\",\"      +(d.missing?'<div class=\\\"cpd-kv\\\"><div><small>넣은 금액</small><b class=\\\"num\\\">'+cpUsd(d.inv)+'</b></div></div>':on?'<div class=\\\"cpd-kv\\\">'\"].join('\n'),true);"];
L.splice(i,j-i+1,...good); fs.writeFileSync('apply2.cjs',L.join('\n')); console.log('fixed lines',i,j);
