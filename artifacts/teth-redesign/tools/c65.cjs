// Codex 2차(qa/fut2): f10 교체, f7 은 위상 중앙값으로, 예약 청산도 시가가 강제 청산 가격을 넘겼으면 강제 청산으로
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y,t)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error(t+' x'+c); return s.split(x).join(y); };
let e=fs.readFileSync(D+'fut-core.js','utf8');
e=one(e,"fillExit(o.ev,L.close(o.p,opx(o.p.k),i,o.why)); });","var po=opx(o.p.k), lq=L.liqPx(o.p), gl=o.p.side>0?po<=lq:po>=lq; if(gl) o.ev.why='liq'; fillExit(o.ev,L.close(o.p,po,i,gl?'liq':o.why,gl)); });",'pend');
fs.writeFileSync(D+'fut-core.js',e);
const cd=JSON.parse(fs.readFileSync(D+'cat-data.json','utf8')), cp=JSON.parse(fs.readFileSync(D+'copy.json','utf8'));
const f10=cd.list.find(x=>x.id==='f10'), f7=cd.list.find(x=>x.id==='f7');
Object.assign(f10.c,{exitN:6,lev:2}); f7.c.ph=2;
cp.f10={name:'비트코인 추세 양방향 2배',one:'비트코인 선물이 55일 최고가를 넘으면 롱, 최저가를 깨면 숏으로 2배 따라가요.',by:'june07'};
fs.writeFileSync(D+'cat-data.json',JSON.stringify(cd,null,1)); fs.writeFileSync(D+'copy.json',JSON.stringify(cp,null,1));
console.log('ok');
