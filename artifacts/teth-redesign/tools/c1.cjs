const fs=require('fs'), D=__dirname+'/';
const old=JSON.parse(fs.readFileSync(D+'copy-c0.json','utf8'));
const N={
d1:['코인 셋 나눠 담기','AI가 코인 8종을 5일마다 비교해, 많이 오른 최대 세 종목에 나눠 담아요.','haneul'],
d2:['네 시장에서 둘','AI가 지수, 금, 주식, 코인 6종을 비교해 최대 두 종목을 골라요.','moa_kim'],
d3:['코인 매일 갈아타기','AI가 코인 8종을 매일 비교해, 든 코인이 약해지면 다른 코인으로 바꿔요.','kite'],
d4:['기술주 셋 나눠 담기','AI가 미국 기술주 8종을 5일마다 비교해, 최대 세 종목에 나눠 담아요.','bluefin'],
d5:['기술주 함께 오를 때','기술주 8종 중 여섯 이상이 오르고 있을 때만 AI가 새로 사요.','sodam'],
d6:['대표 코인 하나만','AI가 비트코인, 이더리움, 솔라나를 10일마다 비교해 하나만 골라요.','orbit9'],
h1:['기술주 회복 기다리기','AI가 미국 기술주 중 하나를 골라, 떨어졌다가 다시 오를 때 사요.','june07'],
h2:['코인 시장 먼저 확인','AI가 고른 코인이 떨어졌다 다시 오를 때 사요. 시장이 약하면 기다려요.','nari_lab'],
h3:['지수와 금 짧게','AI가 나스닥, S&P 500, 금 중 하나를 골라, 산 가격보다 5% 오르면 팔아요.','pebble'],
h4:['네 시장에서 하나','AI가 지수, 금, 주식, 코인 중 하나를 골라, 다시 오를 때 사요.','yuna.s'],
h5:['많이 오른 코인 하나','AI가 대표 코인 셋 중 두 달간 많이 오른 하나를 골라, 다시 오를 때 사요.','harbor'],
r1:['비트코인 큰 하락 뒤','비트코인이 크게 떨어진 뒤 다시 오르는 걸 확인하고 사요.','dohyun_k'],
r2:['나스닥 4% 챙기기','나스닥이 떨어졌다 오를 때 사서, 산 가격보다 4% 오르면 팔아요.','mintleaf'],
r3:['이더리움 빨리 접기','이더리움이 산 가격보다 3% 떨어지면 바로 팔아요. 오를 때는 길게 둬요.','taeo'],
r4:['금 방향부터 확인','금이 크게 떨어졌다 다시 오를 때, 움직이는 방향까지 확인하고 사요.','lumen'],
r5:['테슬라 오래 기다리기','테슬라가 크게 떨어진 뒤 다시 오르면 사서, 크게 오를 때까지 기다려요.','sian_j'],
r6:['솔라나 짧게 자주','솔라나가 다시 오를 때 사서 5% 오르거나 3% 떨어지면 팔아요.','quill'],
r7:['리플 작게 여러 번','리플이 다시 오를 때 사서 4% 오르거나 5% 떨어지면 팔아요.','eunsol'],
r8:['엔비디아 8% 목표','엔비디아가 떨어졌다 오를 때 사서, 산 가격보다 8% 오르면 팔아요.','bora_c'],
r9:['비트코인 방향 확인','비트코인이 떨어졌다 다시 오를 때, 움직이는 방향까지 확인하고 사요.','jisu.p']};
const out={}, alias=[]; const names=new Set();
for(const id of Object.keys(old)){ const n=N[id]; if(!n) throw new Error(id); if(n[0].length>12) throw new Error('long '+n[0]); if(names.has(n[0])) throw new Error('dup '+n[0]); names.add(n[0]); out[id]={name:n[0],one:n[1],by:n[2]}; if(old[id].name!==n[0]) alias.push("'"+old[id].name+"':'"+id+"'"); }
fs.writeFileSync(D+'copy.json',JSON.stringify(out,null,1));
const one=(s,x,y)=>{ const n=s.split(x).length-1; if(n!==1) throw new Error('x'+n+': '+x.slice(0,60)); return s.replace(x,()=>y); };
let a=fs.readFileSync(D+'apply2.cjs','utf8');
a=one(a,"',fw:'+FW[i];","',fw:'+FW[i]+',by:'+q(c.by);"); fs.writeFileSync(D+'apply2.cjs',a);
let s=fs.readFileSync(D+'rd-ui.js','utf8');
s=one(s,"'길잡이':'h4','분업':'h5','길목':'r9'};","'길잡이':'h4','분업':'h5','길목':'r9',\n  /* 2026-09-29 이름 개편 전 이름 */\n  "+alias.join(',')+"};");
s=one(s,"ex:c.ex,p:null,fw:c.fw,","ex:c.ex,p:null,fw:c.fw,by:c.by||'',");
s=one(s,"if(!{pick:1,ret:1,mdd:1,n:1}[t.ss.sort]) t.ss.sort='pick';","if(!{pick:1,ret:1,fw:1,win:1}[t.ss.sort]) t.ss.sort='pick';");
s=one(s,"    mdd:function(a,b){return b.r.mdd-a.r.mdd;},\n    n:function(a,b){return b.r.n-a.r.n;}}","    fw:function(a,b){return (b.fw||0)-(a.fw||0);},\n    win:function(a,b){return (b.r.winRate||0)-(a.r.winRate||0);}}");
s=one(s,"[['ret','30일 수익률'],['mdd','낙폭 낮은 순'],['n','거래 수']]","[['ret','30일 수익률'],['fw','따라가는 사람'],['win','수익 낸 거래']]");
s=one(s,"(on&&o[0]!=='mdd'?(t.ss.dir==='asc'?' ↑':' ↓'):'')","(on?(t.ss.dir==='asc'?' ↑':' ↓'):'')");
s=one(s,"return [s.nick,s.asset,mkTitle(s),s.one||'',","return [s.nick,s.asset,mkTitle(s),s.one||'',s.by?'@'+s.by:'',");
s=one(s,"placeholder=\"이름, 종목, 판단 방식 검색\"","placeholder=\"이름, 종목, 등록자 검색\"");
// 지금 상태: 초보 말투
s=one(s,"function mkNowLine(s){","function mkWaitPlain(q,tf){ return !q?'조건이 맞기를 기다리는 중':!q.rsiOk?'가격이 내려오기를 기다리는 중':!q.bounceOk?'다시 오르기를 기다리는 중':(tf&&!q.trendOk)?'방향이 잡히기를 기다리는 중':q.mktOk===false?'시장이 약해 기다리는 중':'조건이 맞기를 기다리는 중'; }\nfunction mkNowLine(s){");
s=one(s,"return st.open.map(function(o){ return o.k; }).join(', ')+' 보유'; return st.scan&&st.scan.weak?'시장 약세로 대기':'보유 없음, 탐색 중'; }","return st.open.map(function(o){ return o.k; }).join(', ')+' 보유 중'; return st.scan&&st.scan.weak?'시장이 약해 기다리는 중':'살 종목을 찾는 중'; }");
s=one(s,"  if(st.open) return st.open.k+' 보유';","  if(st.open) return st.open.k+' 보유 중';");
s=one(s,"return st.pick?st.pick+' '+mkWaitWhy(st.cond,false)+pos(st.cond,s.cfg.rsiTh):'고를 종목 없음, 대기';","return st.pick?st.pick+', '+mkWaitPlain(st.cond,false):'고를 종목이 없어 기다리는 중';");
s=one(s,"  return mkWaitWhy(st.cond,s.cfg&&s.cfg.tf)+pos(st.cond,s.cfg.rsiTh);","  return mkWaitPlain(st.cond,s.cfg&&s.cfg.tf);");
s=one(s,"st.pick?gEsc(st.pick)+' '+mkWaitWhy(q,false)+' 중':","st.pick?gEsc(st.pick)+', '+mkWaitPlain(q,false):");
s=one(s,"head=mkWaitWhy(q2,c.tf)+' 중';","head=mkWaitPlain(q2,c.tf);");
s=one(s,"(st.scan.weak?'시장 약세로 대기 중':'살 종목을 찾는 중')","(st.scan.weak?'시장이 약해 기다리는 중':'살 종목을 찾는 중')");
// 카드
const i=s.indexOf('function mkCard(s){'), j=s.indexOf('function tfSS3GridHtml(){'); if(i<0||j<i) throw new Error('card');
s=s.slice(0,i)+fs.readFileSync(D+'card2.js','utf8')+s.slice(j);
// 상세 머리글: 등록자
s=one(s,"<p><b>'+(MK_KIND[s.kind]||'조건 실행')+'</b><span>'+gEsc(mkScope(s))+'</span></p></div>'","<p><b>'+(MK_KIND[s.kind]||'조건 실행')+'</b><span>'+gEsc(mkScope(s))+'</span>'+(s.by?'<span class=\"mk3-by\">@'+gEsc(s.by)+' 등록</span>':'')+'</p></div>'");
fs.writeFileSync(D+'rd-ui.js',s);
fs.appendFileSync(D+'rd.css',fs.readFileSync(D+'card2.css','utf8'));
console.log('ok', alias.length);
