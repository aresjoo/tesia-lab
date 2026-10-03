import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createInvestmentOutputGate} from '../investment-output-gate.mjs';
import {readInvestmentDisplay,validInvestmentDisplay} from '../investment-display-contract.mjs';
import {admitSettingsPreview} from '../investment-intent-admission.mjs';
const ask={steps:[{title:'손실 한도는?',multi:false,options:[{t:'2%',d:'계좌 자기자본 기준'},{t:'5%',d:'계좌 자기자본 기준'}]}]};
const valid=[['ASK',ask],['NEXT',['비용 기준을 설명해줘','낙폭은 어떻게 읽어?']],['TITLE','계좌 손실 기준'],['CHART',{tv:'BINANCE:ETHUSDT',data:'binance:ETHUSDT',label:'이더리움'}]];
for(const [name,value] of valid){
  const tag=`[${name} ${JSON.stringify(value)}]`;
  for(const split of [0,1,4,8,tag.length-1,tag.length]) test(`schema-valid ${name} split=${split}`,()=>{
    const events=[],gate=createInvestmentOutputGate(e=>events.push(e));
    gate.send({text:'제공 자료 기준입니다.\n'+tag.slice(0,split)});
    if(split>0&&split<tag.length) assert.ok(!events.some(e=>e.text?.includes(`[${name} `)));
    gate.send({text:tag.slice(split)});gate.send({done:true});
    assert.ok(events.at(-1).done);assert.equal(events.map(e=>e.text||'').join(''),'제공 자료 기준입니다.\n'+tag);
  });
}
const invalid=[['ASK',{steps:[{title:'기간?',multi:false,options:'abc'}]}],['ASK',{steps:[{title:'기간?',multi:false,options:[null,null]}]}],['ASK',{steps:[{title:'기간?',multi:true,options:ask.steps[0].options}]}],['ASK',{steps:[ask.steps[0],ask.steps[0]]}],['ASK',{steps:[{...ask.steps[0],action:'trade'}]}],['ASK',{steps:[{...ask.steps[0],options:[{t:'2%',d:'계좌 기준'},{t:'2%',d:'가격 기준'}]}]}],['NEXT',[null,'질문']],['NEXT',['1','2','3']],['TITLE','x'.repeat(81)],['CHART',{tv:'BINANCE:ETHUSDT',data:'binance:BTCUSDT',label:'이더리움'}],['CHART',{tv:'javascript:alert',data:'none',label:'공격'}],['CHART',{tv:'NASDAQ:AAPL',data:'yahoo:NVDA',label:'애플'}]];
for(const [n,v] of invalid) test(`reject malformed display ${n} ${JSON.stringify(v).slice(0,70)}`,()=>{
  const events=[],gate=createInvestmentOutputGate(e=>events.push(e));for(const text of `[${n} ${JSON.stringify(v)}]`) gate.send({text});gate.send({done:true});
  assert.ok(gate.failed);assert.deepEqual(events,[{error:true}]);
});
test('plain, settings, later title, duplicate or combined ASK/NEXT cannot authorize display',()=>{
  for(const [options,text] of [[{allowDisplay:false},'[TITLE "x"]'],[{allowTitle:false},'[TITLE "x"]'],[{},'[TITLE "a"][TITLE "b"]'],[{},`[ASK ${JSON.stringify(ask)}][NEXT ["x"]]`],[{settingsPreview:{entryMode:null,pair:'BTC/USDT'}},'[TITLE "x"]']]){
    const events=[],gate=createInvestmentOutputGate(e=>events.push(e),options);for(const part of text)gate.send({text:part});gate.send({done:true});assert.ok(gate.failed);assert.ok(!events.some(e=>e.done));
  }
});
test('escaped quotes and brackets inside valid display values do not split JSON',()=>{
  const value={steps:[{...ask.steps[0],title:'"2%"와 [계좌]의 기준은?'}]};const tag=`[ASK ${JSON.stringify(value)}]`;
  assert.deepEqual(readInvestmentDisplay(tag).value,value);assert.ok(validInvestmentDisplay('ASK',value));
});
test('oversized and truncated display never emits partial structured controls',()=>{
  for(const text of ['[ASK {"steps":','[NEXT ["x"','[ASK {'+' '.repeat(4096)]){
    const events=[],gate=createInvestmentOutputGate(e=>events.push(e));gate.send({text});gate.send({done:true});assert.deepEqual(events,[{error:true}]);
  }
});
const source=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const response=source.slice(source.indexOf('function taiSafeInvestmentResponse('),source.indexOf('function taiMarket(t,fin,fallback){'));
const tagParser=source.slice(source.indexOf('function taiTagJson('),source.indexOf('\n}',source.indexOf('function taiTagJson('))+2);
const client=createContext({window:{TETH_INVESTMENT_UI:{readInvestmentDisplay,validInvestmentDisplay}},readInvestmentDisplay,validInvestmentDisplay});runInContext(tagParser,client);runInContext(response,client);
function accepts(text,current='BTC 전략 만들어줘',history=[],state={}){client.text=text;client.current=current;client.hist=history;client.state=state;return runInContext('taiSafeInvestmentResponse(text,current,hist,state)',client);}
test('actual client rejects old proxy execution tags and schema attacks even without the server gate',()=>{
  for(const text of ['[ORDER {}]','[STRATEGY {}]','[GAUGE {}]','[ACT []]','[TLINE []]','<think>hidden</think>',...invalid.map(([n,v])=>`[${n} ${JSON.stringify(v)}]`)]) assert.equal(accepts(text),false,text);
  assert.equal(accepts('개념 설명입니다.'),true);
});
test('actual client admits only exact-request matched null-mode Mock setup and preserves rich history',()=>{
  const tag='[SETUP {"entryMode":null,"pair":"BTC/USDT"}]';
  assert.equal(accepts(tag),true);
  assert.equal(accepts(tag,'ETH 전략 만들어줘'),false);
  assert.equal(accepts('[SETUP {"entryMode":"dip","pair":"BTC/USDT"}]'),false);
  assert.equal(accepts(tag,'BTC 전략 만들어줘',[{role:'user',content:'뉴스 1분봉 숏20배'}]),false);
  assert.equal(accepts(tag,'BTC 전략 만들어줘',[],{olderUserStatements:['뉴스 숏']}),false);
  assert.equal(accepts(tag,'이전 전략 조건은 가져오지 말고 BTC 새 전략 만들어줘',[{role:'user',content:'뉴스 숏'}]),true);
});
test('explicit new strategy scope admits settings without approving or deleting prior conditions',()=>{
  const messages=[{role:'user',content:'뉴스 1분봉 숏20배'},{role:'assistant',content:'조건을 보존합니다.'},{role:'user',content:'이전 조건과 별개로 ETH 새 전략 만들어줘'}];
  assert.deepEqual(admitSettingsPreview(messages,{historyTruncated:true}),{entryMode:null,pair:'ETH/USDT'});
  assert.equal(messages[0].content,'뉴스 1분봉 숏20배');
  assert.equal(admitSettingsPreview([{role:'user',content:'이전 조건과 별개로 ETH 새 전략 손절2%로 만들어줘'}]),null);
});

test('all actual source chart identities stay supported and cannot be relabeled as another asset',()=>{
  const array=source.slice(source.indexOf('var TAI_AST=['),source.indexOf('function taiAssetFrom('));
  const ctx=createContext({});runInContext(array,ctx);
  const assets=runInContext('TAI_AST.map(function(row){return row[1];})',ctx);
  for(const a of assets) assert.equal(validInvestmentDisplay('CHART',a),true,JSON.stringify(a));
  assert.equal(validInvestmentDisplay('CHART',{tv:'BINANCE:BTCUSDT',data:'binance:BTCUSDT',label:'이더리움'}),false);
});
test('actual completed display extraction and stripping preserve quoted titles and bracketed questions',()=>{
  const functions=source.slice(source.indexOf('function taiInvestmentDisplays('),source.indexOf('function taiSafeInvestmentResponse('));
  const ctx=createContext({window:{TETH_INVESTMENT_UI:{readInvestmentDisplay,validInvestmentDisplay}}});runInContext(tagParser,ctx);runInContext(functions,ctx);
  const title='비트코인 "장기" 계획';ctx.input='본문\n[TITLE '+JSON.stringify(title)+']\n[NEXT ["RSI [[14]] 설명","다른 지표 비교"]]';
  assert.equal(runInContext('taiDisplayValue(input,"TITLE")',ctx),title);
  assert.deepEqual(JSON.parse(JSON.stringify(runInContext('taiDisplayValue(input,"NEXT")',ctx))),['RSI [[14]] 설명','다른 지표 비교']);
  assert.equal(runInContext('taiStripInvestmentDisplays(input)',ctx),'본문');
});
test('actual market classifiers respect explicit replacement, comparisons and numeric token boundaries',()=>{
  const from=source.indexOf('function taiPredictQ(t)'),to=source.indexOf('var TAI_TFL=',from);
  const ctx=createContext({});runInContext(source.slice(from,to),ctx);
  for(const [text,expected] of [['비트코인 말고 이더리움으로 바꿔줘','BINANCE:ETHUSDT'],['이더리움 말고 비트코인으로 바꿔줘','BINANCE:BTCUSDT'],['BTC와 ETH 차이가 뭐야',null],['도지 캔들의 뜻',null],['리플레이 결과 설명',null]]){ctx.text=text;assert.equal(runInContext('var a=taiAssetFrom(text);a?a.tv:null',ctx),expected,text);}
  for(const [text,expected] of [['15분봉 전략','15m'],['30분봉 전략','30m'],['4시간봉 전략','4h'],['24시간 동안',''],['15분 동안','']]){ctx.text=text;assert.equal(runInContext('taiTfFrom(text)||""',ctx),expected,text);}
  assert.equal(runInContext('taiPredictQ("엔비디아는 무슨 회사야?")',ctx),false);
});
