const fs=require('fs'), D=__dirname+'/'; let u=fs.readFileSync(D+'chat-ui.js','utf8');
const a=" '추적 손절':"; if(u.split(a).length-1!==1) throw new Error('gloss'); if(!u.includes("'되돌림 점수'")) u=u.replace(a," '되돌림 점수':'가격이 최근 얼마나 많이 내려왔는지를 0부터 100까지로 나타낸 값. 클수록 많이 내려온 상태다. 전략마다 정한 기준을 넘어야 매수를 검토한다.',\n '추적 손절':");
fs.writeFileSync(D+'chat-ui.js',u); console.log('ok');
