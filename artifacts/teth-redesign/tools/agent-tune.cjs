// 직접 탐색, 혼합 전략의 계산 결과 확인과 값 고르기. 사용: node agent-tune.cjs
const fs=require('fs'), vm=require('vm');
const S20='C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/s20/';
const E=require(S20+'engine.cjs');
const base=JSON.parse(fs.readFileSync(S20+'out4.json','utf8')).assets;
const N=1335, END=N-1;
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function pxGen(seed,p0,vol){ var rng=mulberry32(seed), p=[p0], i=1; while(i<N){ var len=90+Math.floor(rng()*240), drift=(rng()*2.6-0.7)*0.001; for(var k=0;k<len&&i<N;k++,i++){ var sh=(rng()-.5)*vol; if(rng()<0.014) sh+=(rng()-.66)*vol*3.2; p.push(Math.max(p0*0.18,p[i-1]*(1+drift+sh))); } } return p; }
// 새 자산: [끝 가격, 비율 범위, 변동]
const NEW={'에이다':[0.85,[2,4],.085],'아발란체':[30,[1.8,4],.09],'비앤비':[1000,[2.5,4.5],.055],'마이크로소프트':[510,[1.7,2.4],.032],'아마존':[225,[2,2.8],.04],'메타':[740,[4,6.5],.045],'알파벳':[245,[2.2,3],.038],'에이엠디':[160,[1.8,2.8],.065]};
function pickSeed(name,salt){ const [end,ratio,vol]=NEW[name]; for(let s=1;s<5000;s++){ const sd=s*13+salt, raw=pxGen(sd,1,vol), r=raw[END]; if(r<ratio[0]||r>ratio[1]) continue; let mn=1e9; for(const v of raw) if(v<mn) mn=v; if(mn<0.55) continue; return [sd,+(end/r).toPrecision(4),vol]; } throw new Error(name); }
const CFG={}; for(const k in base) CFG[k]=[base[k].seed,base[k].p0,base[k].vol];
const argSalt=+(process.argv[2]||0);
Object.keys(NEW).forEach((k,i)=>{ CFG[k]=pickSeed(k,100+i*7+argSalt*31); });
const cache={}; const mkPx=k=>cache[k]||(cache[k]=pxGen(CFG[k][0],CFG[k][1],CFG[k][2]));
const ctx={mkPx,rsi:E.rsi,sma:E.sma,idxToDate:i=>{const t=new Date(2023,0,2);t.setDate(t.getDate()+i);return t;},Math,console};
vm.createContext(ctx); vm.runInContext(fs.readFileSync(__dirname+'/agent-core.js','utf8')+';this.mkAgentRun=mkAgentRun;this.mkHybridRun=mkHybridRun;',ctx);
const UNI={
 coin8:['비트코인','이더리움','솔라나','리플','도지코인','에이다','아발란체','비앤비'],
 tech8:['엔비디아','테슬라','애플','마이크로소프트','아마존','메타','알파벳','에이엠디'],
 macro6:['나스닥','S&P 500','금','비트코인','이더리움','엔비디아'],
 big3:['비트코인','이더리움','솔라나'],
 idx3:['나스닥','S&P 500','금']
};
function d30(r){ const e=r.eq; let v30=1; for(const p of e){ if(p.i<=END-30) v30=p.v; else break; } return (e[e.length-1].v/v30-1)*100; }
function show(tag,r,c){ console.log(tag.padEnd(16),'d30',d30(r).toFixed(1).padStart(5),'ret',r.ret.toFixed(0).padStart(4),'mdd',r.mdd.toFixed(1).padStart(6),'win',r.winRate.toFixed(0).padStart(3),'n',String(r.n).padStart(3),'hold',r.avgHold.toFixed(0),'open',JSON.stringify((r.state.open&&(Array.isArray(r.state.open)?r.state.open.map(o=>o.k):r.state.open.k))||null),JSON.stringify(c)); }
const out={cfg:CFG,list:[]};
function bestAgent(tag,uni,grid,target){ let b=null; for(const look of grid.look) for(const top of grid.top) for(const gate of grid.gate) for(const every of grid.every) for(const trail of grid.trail) for(const volT of grid.volT) for(const st of grid.start){ const c={uni:UNI[uni],look,top,gate,every,trail,volT,minS:grid.minS,startI:st}; const r=ctx.mkAgentRun(c), d=d30(r); let sc=Math.abs(d-target.d30)*3+Math.abs(r.mdd-target.mdd)*2+Math.abs(r.winRate-target.win)*.35+Math.abs(r.n-target.n)/Math.max(4,target.n)*14; if(d<1) sc+=60; if(r.n<5) sc+=60; if(r.winRate>80||r.winRate<38) sc+=35; if(r.mdd<-19) sc+=40; if(r.ret<5) sc+=30; if(target.open&&!r.state.open.length) sc+=25; if(target.open===false&&r.state.open.length) sc+=25; if(!b||sc<b.sc) b={sc,c,r}; } c0=b.c; show(tag+' sc'+b.sc.toFixed(0),b.r,{look:c0.look,top:c0.top,gate:c0.gate,every:c0.every,trail:c0.trail,volT:c0.volT,st:c0.startI}); out.list.push({tag,type:'agent',uni,c:Object.assign({},b.c,{uni:undefined}),m:{d30:d30(b.r),mdd:b.r.mdd,win:b.r.winRate,n:b.r.n,ret:b.r.ret}}); return b; }
function bestHybrid(tag,uni,grid,target){ let b=null; for(const every of grid.every) for(const look of grid.look) for(const rsiTh of grid.rsi) for(const st of grid.start){ const c={uni:UNI[uni],every,look,rsiTh,tp:grid.tp,sl:-grid.sl,startI:st}; const r=ctx.mkHybridRun(c), d=d30(r); let sc=Math.abs(d-target.d30)*3+Math.abs(r.mdd-target.mdd)*2+Math.abs(r.winRate-target.win)*.35+Math.abs(r.n-target.n)/Math.max(4,target.n)*14; if(d<1) sc+=60; if(r.n<5) sc+=60; if(r.winRate>80||r.winRate<38) sc+=35; if(r.mdd<-19) sc+=40; if(r.ret<5) sc+=30; if(!b||sc<b.sc) b={sc,c,r}; } show(tag+' sc'+b.sc.toFixed(0),b.r,{every:b.c.every,look:b.c.look,rsi:b.c.rsiTh,tp:b.c.tp,sl:b.c.sl,st:b.c.startI}); out.list.push({tag,type:'hybrid',uni,c:Object.assign({},b.c,{uni:undefined}),m:{d30:d30(b.r),mdd:b.r.mdd,win:b.r.winRate,n:b.r.n,ret:b.r.ret}}); return b; }
let c0;
const G=(o)=>Object.assign({look:[10,20,40],top:[1,2,3],gate:[.3,.5,.6],every:[1,5,10],trail:[8,12,18],volT:[.02,.03,.05],minS:.4,start:[61,300,600]},o);
bestAgent('A1 코인 전체','coin8',G({top:[2,3],every:[1,5]}),{d30:11,mdd:-14,win:52,n:70});
bestAgent('A2 기술주','tech8',G({top:[2,3],every:[5,10]}),{d30:6,mdd:-9,win:58,n:40});
bestAgent('A3 큰 자산','macro6',G({top:[1,2],gate:[.5,.6],every:[10,20],look:[40,60]}),{d30:3,mdd:-6,win:62,n:18});
bestAgent('A4 코인 집중','coin8',G({top:[1],every:[1,3],look:[10],trail:[8,12]}),{d30:15,mdd:-18,win:45,n:90});
bestAgent('A5 쉬는 편','tech8',G({top:[1,2],gate:[.6,.7],every:[5],look:[20,40]}),{d30:4,mdd:-7,win:60,n:22});
bestAgent('A6 셋 중 하나','big3',G({top:[1],gate:[.3,.6],every:[5,10],look:[20,40]}),{d30:8,mdd:-12,win:55,n:30});
const H=(o)=>Object.assign({every:[5,10,20],look:[40,60],rsi:[40,45,50],start:[61,300,600]},o);
bestHybrid('H1 기술주 눌림','tech8',H({tp:10,sl:5}),{d30:7,mdd:-11,win:58,n:30});
bestHybrid('H2 코인 눌림','coin8',H({tp:15,sl:8}),{d30:12,mdd:-16,win:50,n:28});
bestHybrid('H3 큰 자산','macro6',H({tp:6,sl:3}),{d30:3,mdd:-6,win:66,n:26});
bestHybrid('H4 셋 중','big3',H({tp:12,sl:5,rsi:[35,40]}),{d30:9,mdd:-13,win:55,n:20});
bestHybrid('H5 지수와 금','idx3',H({tp:5,sl:3,rsi:[45,50,55]}),{d30:2,mdd:-5,win:70,n:34});
fs.writeFileSync(__dirname+'/agent-out-'+argSalt+'.json',JSON.stringify(out,null,1));
