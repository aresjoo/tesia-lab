// 백테스트 결과 아래 링크: 내 전략은 "대화로 돌아가기"(만든 대화), 공개 전략은 "다른 전략 둘러보기"(전략 복사 목록)
const fs=require('fs'); const f=__dirname+'/rv.js'; let s=fs.readFileSync(f,'utf8');
const rep=(a,b)=>{ const n=s.split(a).length-1; if(n!==1) throw new Error('count '+n+' '+a.slice(0,60)); s=s.replace(a,b); };
rep(`  if(mine){ if(bad||none) return note+fix+runQ; return run+links([['규칙 수정하기','rvFix()']]); }
  return note+run;`,
    `  if(mine){ if(bad||none) return note+fix+runQ+links([['대화로 돌아가기','rvChat()']]); return run+links([['규칙 수정하기','rvFix()'],['대화로 돌아가기','rvChat()']]); }
  return note+run+links([['다른 전략 둘러보기','rvBrowse()']]);`);
rep(`/* 이전 판과 비교: 같은 기간과 금액일 때만 숫자를 나란히 놓는다 */`,
    `/* 들어온 곳으로 돌아가기: 내 전략은 그 전략을 만든 대화, 공개 전략은 전략 복사 목록 */
function rvChat(){ var t=tfS(), sid=t.aiSpec&&t.aiSpec.sess, sx=sid?G.sessions.filter(function(x){ return x.id===sid; })[0]:null;
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  if(!sx){ gHome(); return; } gSelect(sx.id); if(G.mode!=='conv') gShowConv(); }
function rvBrowse(){ tfShareHub('find'); }
/* 이전 판과 비교: 같은 기간과 금액일 때만 숫자를 나란히 놓는다 */`);
fs.writeFileSync(f,s); console.log('ok');
