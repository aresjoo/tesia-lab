// 터미널 미리 보기(예시 전략)는 사용자 흐름에서 빼고 QA 패널에서만 (파운더 2026-10-02 B안)
const fs=require('fs');
const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let h=fs.readFileSync(F,'utf8');
const a="if(!user){ pri={label:'무료로 시작',action:\"authOpen('signup')\"}; sec={label:'터미널 미리 보기',action:'tfPreviewOpen()'}; }";
if(!h.includes(a)) throw new Error('miss guest cta');
h=h.replace(a,"if(!user){ pri={label:'무료로 시작',action:\"authOpen('signup')\"}; sec=null; }");
fs.writeFileSync(F,h);
fs.appendFileSync('sk-qa.js',`
/* 터미널 미리 보기는 QA 상태에서만 켠다(window.TF_PREVIEW=true 를 QA 단추가 직접 설정). 사용자 흐름의 진입점은 일반 터미널로 */
tfPreviewOpen=function(){ window.TF_PREVIEW=false; try{ tfNav('#/trade'); }catch(e){} };
`);
console.log('ok');
