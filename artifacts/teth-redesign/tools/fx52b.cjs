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
