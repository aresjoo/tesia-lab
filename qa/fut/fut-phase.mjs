import { newPage, closePage, goto, evala, viewport, sleep } from './cdp.mjs';
const C=[
 ['f1 old',{kind:'mix',uni:'big3',mode:'brk',every:5,look:45,gate:0.5,n:20,exitN:15,sl:10,trail:25,lev:1}],
 ['f1 new',{kind:'mix',uni:'big3',mode:'brk',every:3,look:45,gate:0.5,n:20,exitN:15,sl:10,lev:1}],
 ['f1 new 2x',{kind:'mix',uni:'big3',mode:'brk',every:3,look:45,gate:0.5,n:20,exitN:15,sl:10,lev:2}],
 ['f2 old',{kind:'mix',uni:'coin8',mode:'brk',every:5,look:90,gate:0.5,n:5,exitN:10,sl:15,trail:25,lev:1}],
 ['f8 old',{kind:'agent',uni:'big3',every:3,look:20,top:1,gate:0.75,lev:1}],
 ['f9 old',{kind:'agent',uni:'coin8',every:3,look:20,top:2,gate:0.88,lev:1}],
 ['f10 old',{kind:'agent',uni:'coin8',every:3,look:30,top:3,gate:0.5,sl:15,lev:1}],
 ['a new top2',{kind:'agent',uni:'coin8',every:3,look:60,top:2,gate:0.88,lev:1}],
 ['a new top1',{kind:'agent',uni:'coin8',every:3,look:60,top:1,gate:0.88,lev:1}],
 ['a new top2 2x',{kind:'agent',uni:'coin8',every:3,look:60,top:2,gate:0.88,lev:2}],
];
const p=await newPage(); await viewport(p,1200,800,{mobile:false});
await goto(p,'http://127.0.0.1:8765/index.html?v='+Date.now()); await sleep(4000);
for(const [n,c] of C){
  console.log(n.padEnd(14),await evala(p,`(function(){ var c=${JSON.stringify(c)}, T=PRICE0.length-1, out=[]; for(var ph=0;ph<c.every;ph++){ var f={}; for(var k in c) f[k]=c[k]; f.uni=MK_UNI[c.uni].list; f.fut=1; f.startI=101; f.ph=ph; var r=mkFutRun(f); var e=r.eq.filter(function(x){ return x.i>=731; }), te=(e[e.length-1].v/e[0].v-1)*100; out.push(r.ret.toFixed(0)+'/'+r.mdd.toFixed(0)+' 뒤'+te.toFixed(0)+(r.liqN?' liq'+r.liqN:'')); } return out.join('  |  '); })()`));
}
await closePage(p); process.exit(0);
