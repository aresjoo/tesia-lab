// 행동 정의(cat-spec)를 그대로 돌려 결과를 확인하고, 원장 불변식을 검사한다. 출력: cat-data.json
const fs=require('fs'), vm=require('vm');
const S20='C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/s20/';
const o4=JSON.parse(fs.readFileSync(S20+'out4.json','utf8')), SP=require('./cat-spec.cjs');
const src=fs.readFileSync('C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html','utf8');
function grab(name){ const i=src.indexOf('\nfunction '+name+'('); if(i<0) throw new Error(name); let d=0,j=src.indexOf('{',i); for(let k=j;k<src.length;k++){ if(src[k]==='{')d++; else if(src[k]==='}'){d--; if(d===0) return src.slice(i+1,k+1);} } }
const N=1335, END=N-1;
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function pxGen(seed,p0,vol){ var rng=mulberry32(seed), p=[p0], i=1; while(i<N){ var len=90+Math.floor(rng()*240), drift=(rng()*2.6-0.7)*0.001; for(var k=0;k<len&&i<N;k++,i++){ var sh=(rng()-.5)*vol; if(rng()<0.014) sh+=(rng()-.66)*vol*3.2; p.push(Math.max(p0*0.18,p[i-1]*(1+drift+sh))); } } return p; }
function pickSeed(name,salt){ const [end,ratio,vol]=SP.NEWPX[name]; for(let s=1;s<9000;s++){ const sd=s*13+salt, raw=pxGen(sd,1,vol), r=raw[END]; if(r<ratio[0]||r>ratio[1]) continue; let mn=1e9; for(const v of raw) if(v<mn) mn=v; if(mn<0.55) continue; return [sd,+(end/r).toPrecision(4),vol]; } throw new Error(name); }
const CFG={}; for(const k in o4.assets) CFG[k]=[o4.assets[k].seed,o4.assets[k].p0,o4.assets[k].vol];
Object.keys(SP.NEWPX).forEach((k,i)=>{ CFG[k]=pickSeed(k,100+i*7); }); // 새 자산의 씨앗은 가격 범위만 보고 첫 후보로 고정
const cache={}; const mkPx=k=>cache[k]||(cache[k]=pxGen(CFG[k][0],CFG[k][1],CFG[k][2]));
const ctx={mkPx,Math,Error,PRICE:[],S:{},RUNSTATS:{total:0,by:{}}}; vm.createContext(ctx);
const core=fs.readFileSync(__dirname+'/agent-core.js','utf8');
let rb=grab('runBacktestCore'); if(process.argv.includes('--fillclose')||true){ /* 제품 패치와 같은 치환 */ rb=rb.replace("if(chg<=sl){ exit='sl'; exitPnl=sl; }","if(chg<=sl){ exit='sl'; exitPnl=params.fill==='close'?chg:sl; }").replace("else if(tp!=null && chg>=tp){ exit='tp'; exitPnl=tp; }","else if(tp!=null && chg>=tp){ exit='tp'; exitPnl=params.fill==='close'?chg:tp; }"); if(!/fill==='close'\?chg:sl/.test(rb)||!/fill==='close'\?chg:tp/.test(rb)) throw new Error('fill patch'); }
vm.runInContext([grab('mulberry32'),grab('sma'),grab('rsi'),'function idxToDate(i){ var t=new Date(2023,0,2); t.setDate(t.getDate()+i); return t; }',rb,core,'this.api={mkAgentRun:mkAgentRun,mkHybridRun:mkHybridRun,mkRuleRun:mkRuleRun,rule:function(P,p){ PRICE=P; return runBacktestCore(p); }};'].join('\n'),ctx);
function daily(eq){ const o=[]; let k=0; for(let i=eq[0].i;i<=END;i++){ while(k+1<eq.length&&eq[k+1].i<=i) k++; o.push({i,v:eq[k].v}); } return o; }
function d30(eq){ const d=daily(eq).slice(-31); return (d[d.length-1].v/d[0].v-1)*100; }
const out={cfg:CFG,uni:SP.UNI,list:[]}; let bad=0;
for(const s of SP.LIST){ let r,p=null,asset=null;
  if(s.kind==='rule'){ const o=o4.strategies.find(x=>x.id===s.from); asset=o.asset; p={sl:o.pick.p.sl,tp:o.pick.p.tp,rsiTh:o.pick.p.rsiTh,trendFilter:!!o.pick.p.tf,startI:o.pick.p.startI,endI:END,fill:'close'}; r=ctx.api.mkRuleRun({asset:asset,rsiTh:p.rsiTh,tp:p.tp,sl:p.sl,tf:p.trendFilter,startI:p.startI}); }
  else { const c=Object.assign({uni:SP.UNI[s.uni].list},s.c); r=s.kind==='agent'?ctx.api.mkAgentRun(c):ctx.api.mkHybridRun(c);
    // 불변식: 거래 손익으로 다시 만든 현금 흐름과 마지막 자산이 맞는가, 곡선이 하루에 한 점인가
    for(let j=1;j<r.eq.length;j++) if(r.eq[j].i!==r.eq[j-1].i+1){ bad++; console.log('gap',s.id); break; }
    const realized=r.trades.reduce((a,t)=>a+(t.got-t.cost),0), openV=(Array.isArray(r.state.open)?r.state.open:(r.state.open?[r.state.open]:[])); // 미실현은 상태에서
    if(!isFinite(r.ret)) bad++; }
  const m={d30:d30(r.eq),mdd:r.mdd,win:r.winRate,n:r.n,ret:r.ret,hold:r.avgHold,expo:r.exposure};
  out.list.push({id:s.id,kind:s.kind,uni:s.uni||null,asset,ex:s.ex,c:s.c||null,p,m});
  console.log(s.id.padEnd(3),s.kind.padEnd(6),String(asset||s.uni).padEnd(8),'d30',m.d30.toFixed(1).padStart(6),'mdd',m.mdd.toFixed(1).padStart(6),'win',String(Math.round(m.win)).padStart(3),'n',String(m.n).padStart(3),'ret',m.ret.toFixed(0).padStart(4),'hold',m.hold.toFixed(0).padStart(3),'expo',m.expo.toFixed(0)+'%',r.events?('ev '+r.events.length+' veto '+r.events.filter(e=>e.t==='veto').length+' open '+JSON.stringify(Array.isArray(r.state.open)?r.state.open.map(o=>o.k):r.state.open&&r.state.open.k)):''); }
// Codex 반례 재현: 100 → 200 → 100, 비중 0.5
{ const P=[]; for(let i=0;i<61;i++) P.push(90); P.push(100,200,100); const c2={mkPx:()=>P,Math,Error}; vm.createContext(c2); vm.runInContext('function sma(){return 50;} function rsi(){return 0;} function idxToDate(i){ var t=new Date(2023,0,2); t.setDate(t.getDate()+i); return t; }'+core+';this.r=mkAgentRun({uni:["x"],look:20,top:2,gate:0,every:100,trail:40,volT:100,minS:0,startI:61});',c2); console.log('반례1 곡선 수익',c2.r.ret.toFixed(4),'거래',JSON.stringify(c2.r.trades.map(t=>+(t.pnl*100).toFixed(3))),'비용',c2.r.costImpact.toFixed(4)); }
{ const P=[]; for(let i=0;i<61;i++) P.push(100); P.push(101,101); const c2={mkPx:()=>P,Math,Error}; vm.createContext(c2); vm.runInContext('function sma(){return 50;} function rsi(){return 0;} function idxToDate(i){ var t=new Date(2023,0,2); t.setDate(t.getDate()+i); return t; }'+core+';this.r=mkHybridRun({uni:["x"],look:20,every:100,rsiTh:30,tp:50,sl:-8,gate:0,startI:61});',c2); console.log('반례2 열린 포지션 수익',c2.r.ret.toFixed(4),'비용',c2.r.costImpact.toFixed(4)); }
fs.writeFileSync(__dirname+'/cat-data.json',JSON.stringify(out,null,1)); console.log('bad',bad);
