// Codex(qa/fut) 지적 반영: 갭으로 강제 청산 가격이나 익절 가격을 넘겨 시작한 날, 재평가 일정을 달력에 고정, 열린 포지션의 펀딩비 집계
const fs=require('fs'), D=__dirname+'/';
const ed=(file,pairs)=>{ let s=fs.readFileSync(file,'utf8'); for(const [x,y,n] of pairs){ const c=s.split(x).length-1; if(c!==(n||1)) throw new Error(file.slice(-14)+' x'+c+': '+x.slice(0,90)); s=s.split(x).join(y); } fs.writeFileSync(file,s); };
ed(D+'fut-core.js',[
  ["      var e;\n      if(s0!=null&&","      var e;\n      /* 시가가 이미 강제 청산 가격이나 익절 가격을 넘어 시작한 날: 시가에서 먼저 처리한다 */\n      if(!fresh&&(p.side>0?o<=liq:o>=liq)){ e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:'liq',ref:liq}; ev.push(e); fillExit(e,L.close(p,o,i,'liq',true)); return; }\n      if(!fresh&&tp!=null&&(p.side>0?o>=tp:o<=tp)){ e={i:i,t:'exit',a:p.k,side:p.side,lev:p.lev,why:'tp',ref:tp}; ev.push(e); fillExit(e,L.close(p,o,i,'tp',true)); return; }\n      if(s0!=null&&"],
  ["      if((i-startI)%every===0){ var S=scan(i),","      if((i+(c.ph||0))%every===0){ var S=scan(i),"],
  ["      if(c.kind==='mix'&&(i-startI)%every===0&&!L.pos.length){","      if(c.kind==='mix'&&(i+(c.ph||0))%every===0&&!L.pos.length){"],
  ["r.fundPaid=L.fund;","r.fundPaid=L.fund+L.pos.reduce(function(a,p){ return a+p.fund; },0);"],
  ["   ③ 하루 펀딩비 정산 ④ 종가로 다음 날 주문을 정함.","   ③ 하루 펀딩비 정산 ④ 종가로 다음 날 주문을 정함. AI 재평가 날은 달력에 고정한다(돌려 보는 기간을 바꿔도 같은 날)."],
]);
console.log('ok');
