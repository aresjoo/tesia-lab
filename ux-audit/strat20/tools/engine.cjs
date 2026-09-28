// index.html 에서 엔진만 뽑아 node 에서 실행
const fs=require('fs');
const src=fs.readFileSync('C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html','utf8');
function grab(name){ const i=src.indexOf('\nfunction '+name+'('); if(i<0) throw new Error(name); let d=0,j=src.indexOf('{',i); for(let k=j;k<src.length;k++){ if(src[k]==='{')d++; else if(src[k]==='}'){d--; if(d===0) return src.slice(i+1,k+1);} } }
const code=['mulberry32','sma','rsi','idxToDate','runBacktestCore'].map(grab).join('\n');
const mod=new Function('var PRICE=[],S={},RUNSTATS={total:0,by:{}};'+code+';return {mulberry32,runBacktest:runBacktestCore,setPrice:function(p){PRICE=p;},rsi,sma};')();
module.exports=mod;
