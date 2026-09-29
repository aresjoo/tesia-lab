const fs=require('fs'); const F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html'; let t=fs.readFileSync(F,'utf8');
const a="  var sW=tfSSFind(nick); if(sW&&!sW.me) nick=sW.nick;\r\n"; while(t.includes(a+a)) t=t.replace(a+a,a);
const w="    +(d.missing?'<div class=\"warn3\" style=\"margin:0 0 12px\">이전 목록의 전략이라 지금은 기록을 불러올 수 없어요. 넣은 금액은 그대로 보관돼요.</div>':'')\r\n"; while(t.includes(w+w)) t=t.replace(w+w,w);
fs.writeFileSync(F,t); console.log('sW',t.split(a).length-1,'warn',t.split(w).length-1);
