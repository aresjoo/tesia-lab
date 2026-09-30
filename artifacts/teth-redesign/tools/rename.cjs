// R15: 화면 용어 "따라가기"를 "전략 복사"로 맞춘다 (전략 이름과 매매 방식 이름은 그대로). 여러 번 돌려도 결과가 같다
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
let n=0;
function renameText(s){
  return s.replace(/(돌파 |추세 |흐름 )?(비율 |전략 )?따라가기/g,(m,keep,pre)=>{ if(keep) return m; n++; if(pre==='비율 ') return '비율대로 복사'; return '전략 복사'; })
    .replace(/따라가려면/g,()=>{ n++; return '복사하려면'; }).replace(/따라가는 사람/g,()=>{ n++; return '복사한 사람'; }).replace(/(?<!이 )따라가는 중/g,()=>{ n++; return '복사한 전략'; }).replace(/전략 따라하기/g,()=>{ n++; return '전략 복사'; }).replace(/는지입니다/g,()=>{ n++; return '는지를 뜻합니다'; }).replace(/느냐입니다/g,()=>{ n++; return '느냐의 문제입니다'; }).replace(/따라갈 수 없는 전략/g,()=>{ n++; return '복사할 수 없는 전략'; });
}
module.exports={renameText};
if(require.main!==module) return;
for(const f of ['index.html','teth-copy.js']){ fs.writeFileSync(R+f,renameText(fs.readFileSync(R+f,'utf8'))); }
console.log('rename',n);
