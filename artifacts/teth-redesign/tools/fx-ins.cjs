// 인사이트 기본 문구: 첫 제목, 주제 제목, 많이 읽는 글, 태그 한국어 이름. 빌드 목록에 sk-ins 추가
const fs=require('fs');
const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let h=fs.readFileSync(F,'utf8');
const rep=(a,b,all)=>{ if(!h.includes(a)){ if(h.includes(b)) return; throw new Error('miss '+a.slice(0,50)); } h=all?h.split(a).join(b):h.replace(a,b); };
rep(", 무슨 일이 벌어지고 있는 걸겠습니까?<br><em>그리고 왜 당신이 관심을 가져야 하겠습니까?</em></h1>",", 시장은 이렇게 움직입니다<br><em>내 전략에 무엇이 달라지는지 함께 봅니다</em></h1>");
rep('<div class="th5">더 많은 주제를 탐험하십시오</div>','<div class="th5">주제별로 보기</div>',true);
rep('<div class="rh">인기 급상승</div>','<div class="rh">많이 읽는 글</div>',true);
rep("'&quot;)\"><span>'+gEsc(t2)+'</span></button>'","'&quot;)\"><span>'+gEsc(window.tfInsTagKo?tfInsTagKo(t2):t2)+'</span></button>'");
rep("'&quot;)\">'+gEsc(tg)+'</span>'","'&quot;)\">'+gEsc(window.tfInsTagKo?tfInsTagKo(tg):tg)+'</span>'");
fs.writeFileSync(F,h);
/* 빌드 목록 */
const D='C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/rd/';
let b=fs.readFileSync(D+'build.sh','utf8'); if(!b.includes('sk-ins.css')) b=b.replace('sk-qa.css > bt.css','sk-qa.css sk-ins.css > bt.css'); fs.writeFileSync(D+'build.sh',b);
let a=fs.readFileSync(D+'apply2.cjs','utf8'); if(!a.includes("'sk-ins.js'")) a=a.replace("'sk-cpx.js','sk-qa.js']","'sk-cpx.js','sk-qa.js','sk-ins.js']"); fs.writeFileSync(D+'apply2.cjs',a);
console.log('ok',b.includes('sk-ins.css'),a.includes("'sk-ins.js'"));
