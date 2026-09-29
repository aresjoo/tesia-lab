const fs=require('fs'), D=__dirname+'/'; const cp=JSON.parse(fs.readFileSync(D+'copy.json','utf8'));
cp.r5.one='테슬라가 크게 떨어진 뒤 다시 오르면 사서, 18% 오르거나 25일 지나면 팔아요.';
cp.d3.one='AI가 코인 8종을 매일 비교해, 산 코인이 약해지면 팔고 강한 코인이 있으면 사요.';
fs.writeFileSync(D+'copy.json',JSON.stringify(cp,null,1)); console.log('ok');
