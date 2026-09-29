// 20종(직접 탐색 6, 혼합 5, 조건 실행 9)의 값 고르기. 사용: node tune2.cjs [salts]
const fs=require('fs'), vm=require('vm');
const S20='C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/s20/';
const E=require(S20+'engine.cjs');
const o4=JSON.parse(fs.readFileSync(S20+'out4.json','utf8'));
const N=1335, END=N-1;
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function pxGen(seed,p0,vol){ var rng=mulberry32(seed), p=[p0], i=1; while(i<N){ var len=90+Math.floor(rng()*240), drift=(rng()*2.6-0.7)*0.001; for(var k=0;k<len&&i<N;k++,i++){ var sh=(rng()-.5)*vol; if(rng()<0.014) sh+=(rng()-.66)*vol*3.2; p.push(Math.max(p0*0.18,p[i-1]*(1+drift+sh))); } } return p; }
const NEW={'에이다':[0.85,[2,4],.085],'아발란체':[30,[1.8,4],.09],'비앤비':[1000,[2.5,4.5],.055],'마이크로소프트':[510,[1.7,2.4],.032],'아마존':[225,[2,2.8],.04],'메타':[740,[4,6.5],.045],'알파벳':[245,[2.2,3],.038],'에이엠디':[160,[1.8,2.8],.065]};
function pickSeed(name,salt){ const [end,ratio,vol]=NEW[name]; for(let s=1;s<9000;s++){ const sd=s*13+salt, raw=pxGen(sd,1,vol), r=raw[END]; if(r<ratio[0]||r>ratio[1]) continue; let mn=1e9; for(const v of raw) if(v<mn) mn=v; if(mn<0.55) continue; return [sd,+(end/r).toPrecision(4),vol]; } throw new Error(name); }
const UNI={coin8:['비트코인','이더리움','솔라나','리플','도지코인','에이다','아발란체','비앤비'],tech8:['엔비디아','테슬라','애플','마이크로소프트','아마존','메타','알파벳','에이엠디'],macro6:['나스닥','S&P 500','금','비트코인','이더리움','엔비디아'],big3:['비트코인','이더리움','솔라나'],idx3:['나스닥','S&P 500','금']};
function d30of(eq){ let v30=1; for(const p of eq){ if(p.i<=END-30) v30=p.v; else break; } return (eq[eq.length-1].v/v30-1)*100; }
function sc(m,t){ let s=Math.abs(m.d30-t.d30)*3+Math.abs(m.mdd-t.mdd)*2+Math.abs(m.win-t.win)*.35+Math.abs(m.n-t.n)/Math.max(4,t.n)*14; if(t.d30>0&&m.d30<1) s+=60; if(t.d30<0&&m.d30>-0.8) s+=60; if(m.n<5) s+=60; if(m.win>80||m.win<38) s+=35; if(m.mdd<-19) s+=40; if(m.ret<5) s+=30; if(m.d30<-8) s+=40; return s; }
// 조건 실행 9종: 기존 탐색 결과에서 가져오되 r7, r3 은 30일 마이너스가 되게 진입 깊이만 다시 고른다
const RULES=[[10,null],[6,null],[2,null],[3,{d30:-3.5}],[4,null],[5,null],[9,{d30:-1.8}],[15,null],[20,null]];
function ruleBt(P,p){ E.setPrice(P); const r=E.runBacktest({sl:p.sl,tp:p.tp,rsiTh:p.rsiTh,trendFilter:p.tf,startI:p.startI,endI:END}); const eq=[]; let k=0; for(let i=r.eq[0].i;i<=END;i++){ while(k+1<r.eq.length&&r.eq[k+1].i<=i) k++; eq.push({i,v:r.eq[k].v}); } return {d30:d30of(eq),mdd:r.mdd,win:r.winRate,n:r.n,ret:r.ret,hold:r.avgHold}; }
const SALTS=+(process.argv[2]||12);
let best=null;
for(let salt=0;salt<SALTS;salt++){
  const CFG={}; for(const k in o4.assets) CFG[k]=[o4.assets[k].seed,o4.assets[k].p0,o4.assets[k].vol];
  Object.keys(NEW).forEach((k,i)=>{ CFG[k]=pickSeed(k,100+i*7+salt*31); });
  const cache={}; const mkPx=k=>cache[k]||(cache[k]=pxGen(CFG[k][0],CFG[k][1],CFG[k][2]));
  const ctx={mkPx,rsi:E.rsi,sma:E.sma,idxToDate:i=>{const t=new Date(2023,0,2);t.setDate(t.getDate()+i);return t;},Math}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname+'/agent-core.js','utf8')+';this.mkAgentRun=mkAgentRun;this.mkHybridRun=mkHybridRun;',ctx);
  const list=[]; let cost=0;
  for(const [id,neg] of RULES){ const s=o4.strategies.find(x=>x.id===id); let p=Object.assign({},s.pick.p), m;
    if(neg){ let b=null; for(const rsiTh of [40,44,48,52,56,60,64]) for(const st of [61,200,400]) for(const tf of [false,true]){ const q={sl:p.sl,tp:p.tp,rsiTh,tf,startI:st}, mm=ruleBt(mkPx(s.asset),q), t={d30:neg.d30,mdd:s.target.mdd,win:s.target.win,n:s.target.n}, c=sc(mm,t); if(!b||c<b.c) b={c,q,mm}; } p=b.q; m=b.mm; cost+=b.c*b.c; }
    else m=ruleBt(mkPx(s.asset),p);
    list.push({key:'r'+id,kind:'rule',asset:s.asset,p,m}); }
  const G=o=>Object.assign({look:[10,20,40],top:[1,2,3],gate:[.3,.5,.6],every:[1,5,10],trail:[8,12,18],volT:[.02,.03,.05],minS:.4,start:[61,300,600]},o);
  const AG=[['a1','coin8',G({top:[3],every:[5]}),{d30:9,mdd:-13,win:50,n:75}],['a2','tech8',G({top:[2,3],every:[5,10]}),{d30:5.5,mdd:-9,win:57,n:40}],['a3','macro6',G({top:[2],gate:[.5,.6],every:[20],look:[40,60]}),{d30:2.4,mdd:-8,win:63,n:18}],['a4','coin8',G({top:[1],every:[1,3],look:[10],trail:[8,12],volT:[.02,.03]}),{d30:-4.2,mdd:-17,win:46,n:80}],['a5','tech8',G({top:[1,2],gate:[.6,.7],every:[5],look:[20,40]}),{d30:4.1,mdd:-7,win:60,n:24}],['a6','big3',G({top:[1],gate:[.3,.6],every:[5,10],look:[20,40]}),{d30:10.5,mdd:-14,win:53,n:26}]];
  for(const [key,uni,g,t] of AG){ let b=null; for(const look of g.look) for(const top of g.top) for(const gate of g.gate) for(const every of g.every) for(const trail of g.trail) for(const volT of g.volT) for(const st of g.start){ const c={uni:UNI[uni],look,top,gate,every,trail,volT,minS:g.minS,startI:st}, r=ctx.mkAgentRun(c), m={d30:d30of(r.eq),mdd:r.mdd,win:r.winRate,n:r.n,ret:r.ret,hold:r.avgHold,open:r.state.open.length}, s=sc(m,t); if(!b||s<b.s) b={s,c,m}; } cost+=b.s*b.s; const c2=Object.assign({},b.c); delete c2.uni; list.push({key,kind:'agent',uni,c:c2,m:b.m}); }
  const H=o=>Object.assign({every:[5,10,20],look:[40,60],rsi:[40,45,50],gate:[0,.4,.5],start:[61,300,600]},o);
  const HY=[['h1','tech8',H({tp:10,sl:5}),{d30:6.3,mdd:-11,win:58,n:30}],['h2','coin8',H({tp:15,sl:8}),{d30:11.4,mdd:-16,win:52,n:28}],['h3','macro6',H({tp:6,sl:3}),{d30:-2.6,mdd:-8,win:62,n:26}],['h4','big3',H({tp:12,sl:5,rsi:[35,40,45]}),{d30:8.6,mdd:-13,win:55,n:20}],['h5','idx3',H({tp:5,sl:3,rsi:[45,50,55]}),{d30:1.9,mdd:-5,win:70,n:34}]];
  for(const [key,uni,g,t] of HY){ let b=null; for(const every of g.every) for(const look of g.look) for(const rsiTh of g.rsi) for(const gate of g.gate) for(const st of g.start){ const c={uni:UNI[uni],every,look,rsiTh,tp:g.tp,sl:-g.sl,gate,startI:st}, r=ctx.mkHybridRun(c), m={d30:d30of(r.eq),mdd:r.mdd,win:r.winRate,n:r.n,ret:r.ret,hold:r.avgHold,veto:r.events.filter(e=>e.t==='veto').length}, s=sc(m,t)+(gate&&m.veto<2?15:0)+(gate===0?8:0); if(!b||s<b.s) b={s,c,m}; } cost+=b.s*b.s; const c2=Object.assign({},b.c); delete c2.uni; list.push({key,kind:'mix',uni,c:c2,m:b.m}); }
  // 네 지표가 서로 겹치면 벌점
  const keys=[].concat(...list.map(x=>['d'+x.m.d30.toFixed(1),'m'+x.m.mdd.toFixed(1),'w'+Math.round(x.m.win),'n'+x.m.n])); const dup=keys.length-new Set(keys).size; cost+=dup*400;
  if(!best||cost<best.cost) best={cost,salt,CFG,list,dup};
  console.log('salt',salt,'cost',Math.round(cost),'dup',dup);
}
best.list.forEach(x=>console.log(x.key.padEnd(4),x.kind.padEnd(6),(x.asset||x.uni).padEnd(8),'d30',x.m.d30.toFixed(1).padStart(5),'mdd',x.m.mdd.toFixed(1).padStart(6),'win',String(Math.round(x.m.win)).padStart(3),'n',String(x.m.n).padStart(3),'ret',x.m.ret.toFixed(0).padStart(4),'hold',x.m.hold.toFixed(0),x.m.veto!=null?'veto '+x.m.veto:'',x.m.open!=null?'open '+x.m.open:'',JSON.stringify(x.p||x.c)));
fs.writeFileSync(__dirname+'/tune2-out.json',JSON.stringify({salt:best.salt,cfg:best.CFG,list:best.list,uni:UNI},null,1)); console.log('best salt',best.salt,'dup',best.dup);
