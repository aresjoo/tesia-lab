import fs from 'node:fs';
import {loadData,index,day}from './independent.mjs';
const {fut}=loadData();
const symbols={'비트코인':'BTCUSDT','이더리움':'ETHUSDT','솔라나':'SOLUSDT','리플':'XRPUSDT','도지코인':'DOGEUSDT','에이다':'ADAUSDT','아발란체':'AVAXUSDT','비앤비':'BNBUSDT'};
const rows=[];
for(const date of ['2023-04-12','2024-12-31','2026-09-28']){
 await Promise.all(Object.entries(symbols).map(async([name,symbol])=>{
  const t=Date.parse(date+'T00:00:00Z'),i=index(date),row={name,symbol,date};
  for(const type of ['candles','funding']){
   const path=type==='candles'?`kline?category=linear&symbol=${symbol}&interval=D&start=${t}&end=${t+86400000-1}&limit=2`:`funding/history?category=linear&symbol=${symbol}&startTime=${t}&endTime=${t+86400000-1}&limit=200`;
   const url='https://api.bybit.com/v5/market/'+path;
   try{const response=await fetch(url,{signal:AbortSignal.timeout(15000)});const text=await response.text();if(!response.ok)throw new Error(`HTTP ${response.status}: ${text.slice(0,100)}`);const json=JSON.parse(text);if(json.retCode!==0)throw new Error(JSON.stringify(json));
    const items=json.result.list;
    if(type==='candles'){const k=items.find(x=>Number(x[0])===t);if(!k)throw new Error('date absent');const actual=k.slice(1,5).map(x=>+(+x).toPrecision(7)),local=['o','h','l','c'].map(k=>fut.sym[name][k][i]);row[type]={url,actual,local,match:JSON.stringify(actual)===JSON.stringify(local)};}
    else{const actual=+(items.reduce((s,x)=>s+Number(x.fundingRate),0)*1e4).toFixed(3);row[type]={url,settlements:items,actual,local:fut.sym[name].f[i],match:actual===fut.sym[name].f[i]};}
   }catch(error){row[type]={url,error:String(error)};}
  }
  rows.push(row);console.log(name,date,row.candles.match??row.candles.error,row.funding.match??row.funding.error);
 }));
 fs.writeFileSync(new URL('source-check.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),rows},null,2));
}
