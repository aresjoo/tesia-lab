// 터미널 행 상태 칸, 검사 스크립트를 바뀐 문구에 맞춤
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/qa/gpt-skin/';
function edit(f,pairs){ let s=fs.readFileSync(f,'utf8'); for(const [a,b] of pairs){ const n=s.split(a).length-1; if(n!==1) throw new Error(f+' count '+n+' '+a.slice(0,70)); s=s.replace(a,b); } fs.writeFileSync(f,s); console.log(f.split('/').pop(),'ok'); }
edit(__dirname+'/sk-order.js',[[`<td>'+gEsc({gtc:'취소 전까지','7d':'7일','1d':'하루'}[x.ttl]||'')+'</td>'`,`<td>조건 대기, '+gEsc({gtc:'취소 전까지','7d':'7일','1d':'하루'}[x.ttl]||'')+'</td>'`]]);
edit(R+'order/order-check.mjs',[
  [`await ev(\`tfQaPreset('05')\`); await sleep(1200);
ok('프리셋 05: 거래소 연결됨',(await ev(\`!!tfS().api\`))===true);`,
   `await ev(\`tfQaPreset('10')\`); await sleep(1200);
ok('프리셋 10: 거래소 연결, 사용량 여유',(await ev(\`!!tfS().api&&aiMeter().pct<80\`))===true,await J('aiMeter()'));`],
  [`/닿으면|움직이면/.test(s.card)&&/팝니다|삽니다|들어갑니다/.test(s.card)`, `/이상이 되면|이하가 되면|움직이면/.test(s.card)&&/한 번 (매도|매수)합니다|한 번 (롱|숏)으로 진입합니다/.test(s.card)`],
  [`ok('예약하기 → 카드가 대기 중, 저장됨',/대기 중/.test(s.st)&&s.wait===1,s);`, `ok('예약하기 → 카드가 조건 대기, 저장됨',/조건 대기/.test(s.st)&&s.wait===1,s);`],
  [`ok('취소 → 행이 사라지고 상태가 취소',!s.row&&s.cancel===1,s);`,
   `ok('취소 → 행이 사라지고 상태가 취소',!s.row&&s.cancel===1,s);
await ev(\`gSelect(tfS().orders[0].sess)\`); await sleep(1500);
s=await J(\`{st:(document.querySelector('.od-card .od-st')||{}).innerText,btn:!!document.querySelector('.od-card .tf-btn.p')}\`);
ok('대화로 돌아가면 카드가 취소됨으로 보인다',/취소됨/.test(s.st||'')&&!s.btn,s);`]
]);
edit(R+'usage/usage-check.mjs',[
  [`await ev(\`tfQaPreset('\${preset}')\`); await sleep(1000); await ev(\`gNew('테스트')\`); await sleep(900);`,
   `await ev(\`tfQaPreset('\${preset}')\`); await sleep(1000); await ev(\`window.TF_QA_NOGATE=true; gNew('테스트'); window.TF_QA_NOGATE=false\`); await sleep(900);`],
  [`/모두 썼습니다/.test(s.txt)&&/실행 중인 전략은 계속/.test(s.txt)`, `/모두 써서 새 요청은 잠시 멈춥니다/.test(s.txt)&&/실행 중인 전략과 결과 보기는 그대로/.test(s.txt)`],
  [`/도달했습니다/.test(s.txt)`, `/%를 썼습니다/.test(s.txt)`],
  [`dollar:/\\\\$/.test((document.getElementById('st-main')||{}).innerText||'')`, `dollar:/\\\\$/.test((document.querySelector('.use-card')||{}).innerText||''),credit:(function(){ var t=(document.getElementById('st-main')||{}).innerText||''; var m=t.match(/거래 크레딧\\\\s*\\\\$[0-9,]+/); return m?m[0]:''; })()`],
  [`ok('설정 > 사용량: 퍼센트와 초기화 날짜만, 달러 없음',s.h1==='사용량'&&/%$/.test(s.pct)&&/초기화됩니다/.test(s.sub)&&s.tab&&!s.dollar,s);`,
   `ok('설정 > 사용량: 사용량 카드는 퍼센트와 초기화 날짜만, 거래 크레딧은 이름과 금액',s.h1==='사용량'&&/%$/.test(s.pct)&&/년 \\d+월 \\d+일에 초기화됩니다/.test(s.sub)&&s.tab&&!s.dollar&&/거래 크레딧\\s*\\$/.test(s.credit),s);`],
  [`ok('결제: 구독 카드 안에 청구 예정 금액과 계산(구독 - 거래 크레딧 = 합계)',/청구 예정 금액은 \\$/.test(s.card)&&/구독 \\$/.test(s.line),s);`,
   `s.row=await ev(\`(function(){ var r=[].filter.call(document.querySelectorAll('#st-main .stg-r'),function(x){ return /청구 예정 금액/.test(x.innerText); })[0]; return r?r.innerText.replace(/\\\\s+/g,' '):''; })()\`);
ok('결제: 구독 카드 안에 청구 예정 금액 행(구독, 거래 크레딧)',/청구 예정 금액/.test(s.row)&&/\\$[0-9,]+/.test(s.row)&&/구독 \\$/.test(s.row),s.row);`]
]);
