import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext,runInContext} from 'node:vm';
import {MAX_CONTEXT_CHARS,buildInvestmentRequest} from '../investment-prompts.mjs';
const source=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const builder=source.slice(source.indexOf('function taiBuildSystem(fin,conv){'),source.indexOf('/* 스레드 공용 append'));
const prefetch=source.slice(source.indexOf('function taiOhlc(cb,sess,run,ast,plan){'),source.indexOf('/* 보조 타임프레임 실측정:'));

test('actual source inline scripts compile after deleting conflicting browser policies',()=>{
  const scripts=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].filter((match)=>match[1].trim());
  assert.ok(scripts.length>0);
  for(const [index,match] of scripts.entries()) new Script(match[1],{filename:`source-inline-${index}`});
  for(const old of ['function taiSystem(','function taiConvSystem(','function taiMarketRules(']) assert.ok(!source.includes(old));
});

test('actual client context carries bounded data and does not call positive holdout a pass',async()=>{
  const context=createContext({taiAI:()=>({hist:Array(24).fill({}),tf:'1d',chart:{label:'비트코인',tv:'BINANCE:BTCUSDT',data:'binance:BTCUSDT'}}),S:{strategy:{pair:'BTC/USDT',entryMode:'dip'},versions:[1,2]},gStep:'risk',holdoutOf:()=>({ret:0.1}),fin:{ret:12,mdd:-8,params:{sl:2,tp:7},worstYear:2024}});
  runInContext(builder,context);
  const serialized=runInContext('taiBuildSystem(fin,true)',context);
  const data=JSON.parse(serialized);
  assert.equal(data.kind,'unverified_browser_reference');assert.equal(data.historyTruncated,true);
  assert.equal(data.backtest.kind,'mock_simulation');assert.equal(data.backtest.returnPct,12);
  assert.equal(data.backtest.holdoutReturnPct,0.1);assert.ok(!serialized.includes('통과'));
  assert.equal(data.chart.interval,'1d');assert.equal(data.timeZone,'Asia/Seoul');assert.match(data.observedAt,/Z$/);
  const result=await buildInvestmentRequest({system:serialized,messages:[{role:'user',content:'비트코인 전략 만들어줘'}]});
  assert.equal(result.settingsPreview,null);
});

test('actual source builder and 730-sample prefetch fit server context budget without legacy instructions',async()=>{
  const asset={label:'비트코인',tv:'BINANCE:BTCUSDT',data:'binance:BTCUSDT'};
  const ai={hist:[],chart:asset,tf:'1d'},sess={};
  const market={last:123456.123456789,chg1d:-2,hi90:123499.123456789,lo90:122000.123456789,meta:{iv:'1d',n:730,src:'binance'},closesS:Array.from({length:730},(_,index)=>[index,123456.123456789]),closes30:[]};
  let done;
  const received=new Promise(resolve=>{done=resolve;});
  const context=createContext({taiAI:()=>ai,S:{strategy:{},versions:[]},gStep:null,holdoutOf:()=>null,TAI:{url:'http://localhost/api/chat',chart:asset},G:{cur:sess},window:{},TAI_TFL:{'1d':'일봉'},TAI_SRCNM:{binance:'바이낸스'},taiIvDesc:()=>'2년',taiBinDirect:async()=>market,taiChartPx:()=>{},fetch:()=>{throw Error('external fetch forbidden');},encodeURIComponent,Date});
  runInContext(builder,context);runInContext(prefetch,context);
  context.done=done;context.sess=sess;
  runInContext('taiOhlc(done,sess,null,null,{iv:"1d",n:730,why:"명시"})',context);
  const snapshot=await received;
  const serialized=runInContext('taiBuildSystem(null,true)',context)+snapshot;
  assert.ok(serialized.length<MAX_CONTEXT_CHARS,`context length ${serialized.length}`);
  assert.ok(!snapshot.includes('분석을 작성'));assert.ok(!serialized.includes('[GAUGE'));
  const request=await buildInvestmentRequest({system:serialized,messages:[{role:'user',content:'가격 알려줘'}]});
  assert.ok(request.messages[0].content.includes('미확인 참고자료'));
  // This is a synthetic serializer budget check, not a live market receipt.
});
