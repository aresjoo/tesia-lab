// 최종 선물 10개(위상, 시작일, 앞뒤 구간을 모두 통과한 것)로 카탈로그를 바꾼다
const fs=require('fs'), D=__dirname+'/';
const cd=JSON.parse(fs.readFileSync(D+'cat-data.json','utf8')), cp=JSON.parse(fs.readFileSync(D+'copy.json','utf8'));
cd.list=cd.list.filter(x=>!(x.c&&x.c.fut)); if(cd.list.length!==21) throw new Error('base '+cd.list.length);
const F=[
 ['f1','rule','비앤비',null,'binance',{mode:'ma',fast:20,slow:70,trail:25,sl:10,lev:2},'비앤비 평균선 양방향 2배','비앤비 선물의 20일 평균이 70일 평균을 넘으면 롱, 밑돌면 숏으로 2배 바꿔 타요.','noel_b'],
 ['f2','rule','도지코인',null,'okx',{mode:'ma',fast:10,slow:100,trail:20,sl:10,lev:2},'도지코인 평균선 양방향 2배','도지코인 선물의 10일 평균이 100일 평균을 넘으면 롱, 밑돌면 숏으로 2배 바꿔 타요.','tari'],
 ['f3','rule','아발란체',null,'bitget',{mode:'brk',n:55,exitN:10,trail:20,reg:200,lev:1},'아발란체 추세 양방향','아발란체 선물이 55일 최고가를 넘으면 롱, 최저가를 깨면 숏으로 따라가요.','kite_r'],
 ['f4','rule','이더리움',null,'bitget',{mode:'brk',n:70,exitN:20,trail:15,reg:200,lev:2},'이더리움 추세 양방향 2배','이더리움 선물이 70일 최고가를 넘으면 롱, 최저가를 깨면 숏으로 2배 따라가요.','dohyun_k'],
 ['f8','rule','아발란체',null,'okx',{mode:'ma',fast:20,slow:100,trail:20,sl:10,lev:1},'아발란체 평균선 양방향','아발란체 선물의 20일 평균이 100일 평균을 넘으면 롱, 밑돌면 숏으로 바꿔 타요.','woo_l'],
 ['f7','agent','','coin8','binance',{every:3,look:60,top:1,gate:0.88,lev:1},'가장 강한 코인 롱숏','AI가 3일마다 코인 8종을 비교해, 모두 오름세면 가장 강한 하나를 롱, 모두 꺾였으면 가장 약한 하나를 숏으로 잡아요.','haneul'],
 ['f5','mix','','big3','bitget',{mode:'brk',every:3,look:45,gate:0.5,n:20,exitN:15,sl:10,lev:1},'대표 코인 돌파 따라가기','AI가 비트코인, 이더리움, 솔라나 중 방향과 종목을 고르고, 20일 돌파가 나오면 롱이나 숏으로 들어가요.','sorae'],
 ['f6','rule','에이다',null,'bitget',{mode:'ma',fast:15,slow:50,trail:20,lev:1},'에이다 평균선 양방향','에이다 선물의 15일 평균이 50일 평균을 넘으면 롱, 밑돌면 숏으로 바꿔 타요.','mira_q'],
 ['f9','agent','','coin8','okx',{every:3,look:60,top:2,gate:0.88,lev:1},'코인 둘 롱숏 갈아타기','AI가 3일마다 코인 8종을 비교해, 모두 오름세면 강한 둘을 롱, 모두 꺾였으면 약한 둘을 숏으로 잡아요.','pebble'],
 ['f10','rule','비트코인',null,'bitget',{mode:'brk',n:55,exitN:5,trail:15,reg:200,lev:3},'비트코인 추세 양방향 3배','비트코인 선물이 55일 최고가를 넘으면 롱, 최저가를 깨면 숏으로 3배 따라가요.','june07'],
];
const add=F.map(([id,kind,asset,uni,ex,c,name,one,by])=>{ cp[id]={name,one,by}; return {id,kind,uni:uni||undefined,asset:asset||null,ex,c:Object.assign({fut:1,kind},c,{startI:101}),p:null,m:{}}; });
cd.list=add.concat(cd.list);
fs.writeFileSync(D+'cat-data.json',JSON.stringify(cd,null,1)); fs.writeFileSync(D+'copy.json',JSON.stringify(cp,null,1));
let u=fs.readFileSync(D+'fut-ui.js','utf8');
const x1="  if(c.kind==='agent') return ev+' '+n+'종목을 비교해요. 오름세 종목이 '+q.L+'개 이상이면 가장 강한 '+c.top+'종목을 롱, '+q.S+'개 이하면 가장 약한 '+c.top+'종목을 숏'+(q.L-q.S>1?', 그 사이면 쉬어요':'');";
if(u.split(x1).length!==2) throw new Error('fuAiTxt');
u=u.replace(x1,"  var cL=q.L>=n?n+'종목이 모두 오름세면':'오름세 종목이 '+q.L+'개 이상이면', cS=q.S<=0?'하나도 오름세가 아니면':'오름세 종목이 '+q.S+'개 이하면';\n  if(c.kind==='agent') return ev+' '+n+'종목을 비교해요. '+cL+' 가장 강한 '+c.top+'종목을 롱, '+cS+' 가장 약한 '+c.top+'종목을 숏'+(q.L-q.S>1?', 그 사이면 쉬어요':'');");
const x2="  return ev+' 방향과 종목을 정해요. 오름세 종목이 '+q.L+'개 이상이면 가장 강한 종목을 롱 후보로, '+q.S+'개 이하면 가장 약한 종목을 숏 후보로'";
if(u.split(x2).length!==2) throw new Error('fuAiTxt2');
u=u.replace(x2,"  return ev+' 방향과 종목을 정해요. '+cL+' 가장 강한 종목을 롱 후보로, '+cS+' 가장 약한 종목을 숏 후보로'");
fs.writeFileSync(D+'fut-ui.js',u);
console.log('ok',cd.list.length);
