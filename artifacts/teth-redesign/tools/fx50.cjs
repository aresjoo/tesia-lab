// 과금 알림 문구: 거래를 늘리라는 권유 금지(이해상충), 초대 연결 보너스 없음(파운더)
const fs=require('fs');
const f='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html';
let s=fs.readFileSync(f,'utf8');
const rep=(a,b)=>{ const n=s.split(a).length-1; if(n!==1) throw new Error('count '+n+' '+a.slice(0,60)); s=s.replace(a,b); };
rep(`'bill.uid.small.b':{ko:'현재 거래량으로는 충전이 사용량을 따라가지 못합니다. 거래 규모를 늘리거나 카드 등록을 고려해보십시오.'`,
    `'bill.uid.small.b':{ko:'거래 크레딧이 이번 달 사용량을 다 덮지 못합니다. 카드를 등록하면 계속 쓸 수 있습니다.'`);
rep(`'bill.card.cross.b':{ko:'UID를 연동하면 거래량만큼 크레딧이 충전되고 다음 결제에서 그만큼 할인됩니다. AI 이용 크레딧 $100 혜택도 받을 수 있습니다`,
    `'bill.card.cross.b':{ko:'초대 계정을 연결하면 거래 크레딧이 매달 생기고 다음 결제에서 그만큼 줄어듭니다`);
fs.writeFileSync(f,s); console.log('ok');
