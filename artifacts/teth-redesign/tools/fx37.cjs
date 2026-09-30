// 백테스트 결과: "다른 전략 만들기" 제거, "규칙 수정하기"는 AI가 먼저 방향을 묻는다(ASK 선택지)
const fs=require('fs'); const f=__dirname+'/rv.js'; let s=fs.readFileSync(f,'utf8');
const rep=(a,b)=>{ const n=s.split(a).length-1; if(n!==1) throw new Error('count '+n+' '+a.slice(0,60)); s=s.replace(a,b); };
rep(`   복사 전략: 규칙을 대화 형식으로 옮길 수 없으니 "다른 전략 만들기"만. 결과 요약을 새 대화에 붙인다`,
    `   복사 전략: 규칙을 고칠 수 없으니 실행 단추만 둔다 ("다른 전략 만들기"는 파운더 결정으로 뺐다)`);
rep(`  var fix='<button type="button" class="bt-cta" onclick="rvFix()">규칙 수정하기</button>', mk='<button type="button" class="bt-sec" onclick="rvNew()">다른 전략 만들기</button>', mkC='<button type="button" class="bt-cta" onclick="rvNew()">다른 전략 만들기</button>';`,
    `  var fix='<button type="button" class="bt-cta" onclick="rvFix()">규칙 수정하기</button>';`);
rep(`  if(mine){ if(bad||none) return note+fix+mk+runQ; return run+links([['규칙 수정하기','rvFix()'],['다른 전략 만들기','rvNew()']]); }
  var why='<p class="rv-why">복사한 공개 전략은 규칙을 고칠 수 없습니다. 다른 전략을 직접 만들 수 있습니다.</p>';
  if(bad||none) return note+why+mkC+runQ;
  return run+links([['다른 전략 만들기','rvNew()']]);`,
    `  if(mine){ if(bad||none) return note+fix+runQ; return run+links([['규칙 수정하기','rvFix()']]); }
  return note+run;`);
rep(`/* 규칙 수정하기: 그 대화로 돌아가 TETH가 먼저 한 가지를 제안한다 */`,
    `/* 규칙 수정하기: 그 대화로 돌아가 TETH가 먼저 어느 쪽을 바꿀지 묻는다(선택지, 직접 입력, AI가 알아서 판단). 고르면 바뀔 조건 카드 */`);
rep(`    +'\\n지시: 결과 숫자를 근거로 바꿔 볼 조건을 정확히 하나만 고르고,`,
    `    +'\\n지시 1(지금): 아직 바꿀 조건을 정하지 마라. 합니다체 2문장으로 짧게 답하라. 첫 문장은 결과에서 가장 눈에 띄는 숫자 하나(예: 24번 중 14번이 손실로 끝났습니다), 둘째 문장은 "어느 쪽을 바꿔 볼까요? 아래에서 고르시거나 원하는 방향을 적어 주십시오."처럼 방향을 묻는 말. 그리고 [ASK] 태그로 질문 하나를 붙여라: title은 "어느 조건을 바꿔 볼까요?", multi는 false, options는 이 결과에 맞는 수정 방향 4개. 각 선택지 t는 10자 안팎의 짧은 이름(예: 파는 조건 넓히기, 사는 조건 까다롭게, 오르면 파는 조건 추가, 방향 확인 켜기), d는 무엇이 바뀌고 무엇을 기대하는지 한 문장(결과 숫자 근거). 결과 근거로 가장 먼저 비교해 볼 선택지를 첫째에 두고 d 끝에 "(추천)"을 붙여라. 이번 답에는 [STRATEGY] 태그를 붙이지 마라.'
    +'\\n지시 2(사용자가 고르거나, 직접 적거나, 알아서 판단해 달라고 한 다음 답): 그 방향에서 바꿔 볼 조건을 정확히 하나만 고르고,`);
rep(`마지막 줄에 바뀐 설정 전체를`, `다음 답의 마지막 줄에 바뀐 설정 전체를`);
rep(`질문 카드(ASK), 선택 칩(NEXT), 실행(ACT) 태그는 붙이지 마라.`, `그 답에는 질문 카드(ASK), 선택 칩(NEXT), 실행(ACT) 태그를 붙이지 마라.`);
rep(`function rvOther(){ var f=$('g-in'); if(f){ f.value='다른 조건을 바꿔서 제안해 주십시오: '; f.focus(); } }`,
    `/* 다른 수정 요청하기: 같은 방식으로 다시 방향을 묻게 한다 */
function rvOther(){ var f=$('g-in'); if(!f) return; RV.on=true; RV.prop=null; f.value='다른 조건을 바꿔 보고 싶습니다. 바꿀 수 있는 방향을 다시 선택지로 보여 주십시오'; gSend(); }`);
fs.writeFileSync(f,s); console.log('ok');
