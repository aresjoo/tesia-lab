import { expect, test, type Page } from '@playwright/test'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { CatalogueMarketData } from '../src/client-catalogue-market-data'
import { catalogueAssets, catalogueStrategies, catalogueSourceSha } from '../src/client-catalogue'
import { computeCatalogueBacktest, catalogueBacktestReplay } from '../src/client-catalogue-backtest-result'
import { catalogueBacktestPeriods, catalogueBacktestAmounts, catalogueBacktestUseBinding, createCatalogueBacktestClient, validCatalogueBacktestObservation, validCatalogueBacktestSelection, type CatalogueBacktestReply, type CatalogueBacktestRequest } from '../src/client-catalogue-backtest'
import source from '../src/client-catalogue-source.json' with { type:'json' }
import spot from '../src/client-catalogue-spot-data.json' with { type:'json' }
import futures from '../src/client-catalogue-futures-data.json' with { type:'json' }
import common from './fixtures/catalogue-source-runtime.json' with { type:'json' }
import future from './fixtures/catalogue-futures-runtime.json' with { type:'json' }
const data=new CatalogueMarketData(spot,futures)
const selection=(id='r1',period:typeof catalogueBacktestPeriods[number]=365,amount:typeof catalogueBacktestAmounts[number]=1000,owner='bt-owner-a')=>({owner,strategyId:id,period,amount})
function canonical(v:unknown):unknown {return v===null||typeof v!=='object'?v:Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.entries(v).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b,'en')).map(([k,v])=>[k,canonical(v)]))}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex')
for(const period of catalogueBacktestPeriods) test(`원본31cfg ${period}일: exact requestedStart·잔고·체결·판단·현재상태·보유벤치`,()=>{
 const context=vm.createContext({TETH_PX:spot,TETH_FUT:futures,PRICE0:spot.px['비트코인'],MK_UNI:source.universes,mkPx:(k:keyof typeof spot.px)=>spot.px[k]});context.window=context
 vm.runInContext(common.code+'\n'+future.code,context,{timeout:1000})
 for(const strategy of catalogueStrategies){
  const value=computeCatalogueBacktest(selection(strategy.id,period),data),start=period?Math.max(strategy.startI,data.length-1-period):strategy.startI
  context.config=source.catalogue.find(c=>c.id===strategy.id);context.start=start
  const original=vm.runInContext('mkRunCfg(config,start)',context,{timeout:1000})
  for(const key of ['eq','trades','events','state'] as const) expect(hash(value.result[key]),`${strategy.id}/${period}/${key}`).toBe(hash(original[key]))
  for(const key of ['ret','mdd','winRate','n','avgHold'] as const) expect(value.result[key],`${strategy.id}/${key}`).toBe(original[key])
  expect(value.result.params.startI).toBe(original.eq[0].i);expect(value.result.eq).toHaveLength(original.eq.length)
  expect(validCatalogueBacktestObservation(value,selection(strategy.id,period))).toBe(true)
  const prices=catalogueAssets(strategy).map(k=>data.prices(k))
  expect(value.benchmark.map(p=>p.v)).toEqual(value.result.eq.map(p=>prices.reduce((s,P)=>s+P[p.i]/P[original.eq[0].i],0)/prices.length))
  expect(value.strategy).toEqual(strategy);expect(Object.isFrozen(value.strategy)).toBe(true)
 }
})
test('네 예산은 가격·cfg·수익률을 바꾸지 않고 실제 거래 금액/수량만 비례한다',()=>{
 for(const id of ['r1','d1','f7']) for(const period of catalogueBacktestPeriods){
  const base=computeCatalogueBacktest(selection(id,period),data)
  for(const amount of catalogueBacktestAmounts){const value=computeCatalogueBacktest(selection(id,period,amount),data);expect(value.result).toEqual(base.result);expect(value.orders).toHaveLength(base.orders.length);for(const [i,o] of value.orders.entries()){expect(o.units).toBeCloseTo(base.orders[i].units*amount/1000,10);expect(o.amount).toBeCloseTo(base.orders[i].amount*amount/1000,8)};expect(value.runId).not.toBe(computeCatalogueBacktest(selection(id,period,amount,'other'),data).runId)}
 }
})
test('owner·id·period·amount·원본SHA·cfg·달력·손상자료를 조용히 보정하지 않는다',()=>{
 const original=computeCatalogueBacktest(selection(),data)
 for(const delta of [{owner:null},{owner:''},{owner:' x'},{strategyId:'BTC'},{period:30},{amount:0},{amount:2000}]) expect(validCatalogueBacktestSelection({...selection(),...delta})).toBe(false)
 expect(validCatalogueBacktestSelection(Object.defineProperty({},'owner',{get(){throw Error('fixture')}}))).toBe(false)
 for(const delta of [{owner:'other'},{strategyId:'r2'},{period:90},{amount:3000},{sourceSha:'wrong'},{runId:'wrong'},{strategy:{...original.strategy,tp:99}},{calendar:{...original.calendar,asof:'2026-02-30'}},{dataVersion:{spot:null,futures:'x'}},{orders:[{id:'bad'}]},{judgments:[{i:-1}]}]) expect(validCatalogueBacktestObservation({...original,...delta},selection())).toBe(false)
 const broken=structuredClone(original);broken.result.eq[1].v=NaN;expect(validCatalogueBacktestObservation(broken,selection())).toBe(false)
 const binding=catalogueBacktestUseBinding(original);expect(binding.sourceSha).toBe(catalogueSourceSha);expect(Object.isFrozen(binding.configuration)).toBe(true);expect(Object.isFrozen(binding.result.equity[0])).toBe(true);expect(binding).not.toHaveProperty('credential');expect(binding).not.toHaveProperty('orderIntent')
})
class FakePort {
 onmessage:((event:MessageEvent<CatalogueBacktestReply>)=>void)|null=null;onerror:((event:ErrorEvent)=>void)|null=null;onmessageerror:((event:MessageEvent)=>void)|null=null
 sent:CatalogueBacktestRequest[]=[];terminated=0;postMessage(v:CatalogueBacktestRequest){this.sent.push(v)}terminate(){this.terminated++}reply(v:CatalogueBacktestReply){this.onmessage?.({data:v} as MessageEvent<CatalogueBacktestReply>)}
}
test('port 정상관측·중복/late reply·취소·dispose는 요청 소유자만 정산한다',async()=>{
 const port=new FakePort(),client=createCatalogueBacktestClient(()=>port),controller=new AbortController()
 const cancelled=client.run(selection(),controller.signal);controller.abort();await expect(cancelled).rejects.toMatchObject({name:'AbortError'})
 const kept=client.run(selection('f1',90)),value=computeCatalogueBacktest(selection('f1',90),data)
 port.reply({kind:'result',requestId:1,value:computeCatalogueBacktest(selection(),data)});port.reply({kind:'result',requestId:2,value});expect(await kept).toEqual(value)
 port.reply({kind:'result',requestId:2,value});const next=client.run(selection());client.dispose();await expect(next).rejects.toMatchObject({name:'AbortError'});expect(port.terminated).toBe(1);await expect(client.run(selection())).rejects.toMatchObject({name:'AbortError'})
})
test('foreign/잘못된 결과·throwing port·손상 factory는 fail closed',async()=>{
 for(const delta of [{owner:'other'},{amount:3000},{result:{}}]){const port=new FakePort(),client=createCatalogueBacktestClient(()=>port),pending=client.run(selection());port.reply({kind:'result',requestId:1,value:{...computeCatalogueBacktest(selection(),data),...delta} as never});await expect(pending).rejects.toThrow('자료를 확인');expect(port.terminated).toBe(1);client.dispose()}
 const throwing=new FakePort();throwing.postMessage=()=>{throw Error('fixture')};const client=createCatalogueBacktestClient(()=>throwing);await expect(client.run(selection())).rejects.toThrow('자료를 확인');client.dispose()
 await expect(createCatalogueBacktestClient(()=>{throw Error('fixture')}).run(selection())).rejects.toThrow('자료를 확인')
 await expect(createCatalogueBacktestClient(()=>null as never).run(selection())).rejects.toThrow('자료를 확인')
})
test('재생은 source btPlan의 로컬 시간이며 엔진 결과·실행 권한을 만들지 않는다',()=>{
 const value=computeCatalogueBacktest(selection('d1',90),data),before=hash(value),plan=catalogueBacktestReplay(value)
 expect(plan.duration).toBeGreaterThan(1600);expect(plan.segments[0].start).toBe(700);expect(plan.segments.at(-1)!.end+900).toBe(plan.duration);expect(hash(value)).toBe(before)
 expect(plan.segments.every(s=>s.start<s.end&&s.a<=s.b)).toBe(true)
})
async function open(page:Page){
 await page.route('**/catalogue-bt-test.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#171717;color:#ececec;font-family:Arial,sans-serif"><main id="fixture"></main></body></html>'}))
 await page.goto('/catalogue-bt-test.html');await page.evaluate(async()=>{
  const refresh='/@react-refresh',runtime=(await import(/* @vite-ignore */refresh)).default;runtime.injectIntoGlobalHook(window);Object.assign(window,{$RefreshReg$:()=>{},$RefreshSig$:()=>(v:unknown)=>v,__vite_plugin_react_preamble_installed__:true})
  const path='/tests/fixtures/catalogue-backtest-host.tsx',host=await import(/* @vite-ignore */path);Reflect.set(window,'btFixture',host.mount())
 });await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase','ready');await expect(page.getByRole('button',{name:'과거를 다시 돌려 보기',exact:true})).toBeVisible()
}
async function result(page:Page){await page.getByRole('button',{name:'과거를 다시 돌려 보기',exact:true}).click();await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase','run');await page.getByRole('button',{name:'바로 결과 보기',exact:true}).click();await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase','result')}
test('실제worker 원본 기간·예산·원문·2선·결과·거래·판단·reload·조건 재검증',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const external:string[]=[];page.on('request',r=>{if(new URL(r.url()).origin!==new URL(info.project.use.baseURL!).origin)external.push(r.url())})
 await open(page);await page.getByRole('group',{name:'기간',exact:true}).getByRole('button',{name:'최근 3개월',exact:true}).click();await page.getByRole('group',{name:'시작 금액',exact:true}).getByRole('button',{name:'3,000',exact:true}).click()
 await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-period','90');await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-amount','3000');await result(page)
 await expect(page.getByText('해석을 불러오지 못했습니다. 결과 숫자는 위에 그대로 있습니다.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'이 전략 실행하기',exact:true})).toBeDisabled()
 await expect(page.locator('path[data-series]')).toHaveCount(2);const chart=page.getByRole('region',{name:'백테스트 자산과 그냥 보유 비교 차트'});await chart.focus();await chart.press('End');await expect(chart.getByRole('status')).toContainText('2026-09-28')
 const marker=page.locator('[data-backtest-marker=enter]').first();if(await marker.count()){await marker.focus();await marker.press('Enter');await expect(page.getByTestId('backtest-selected-evidence')).not.toBeEmpty()}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 // Source restoration replaces the old aggregate order-card heading with
 // individual trade statements. Keep the selected-budget assertion and
 // prove that the actual identified trade uses $3,000 × normalized cost.
 await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-amount','3000')
 const budgetObservation=await page.evaluate(async()=>Reflect.get(window,'btFixture').run({owner:'bt-owner-a',strategyId:'r1',period:90,amount:3000}))
 const trade=budgetObservation.result.trades[0]
 expect(trade).toBeTruthy()
 const tradeRow=page.locator(`#bt-tl .bt-tr[data-trade-id="${trade.id}"]`)
 await tradeRow.locator(':scope > .bt-rb').click()
 await expect(tradeRow).toHaveClass(/\bon\b/)
 await expect(tradeRow).toHaveAttribute('data-trade-id',String(trade.id))
 await expect(tradeRow.locator('.bt-dl > div').filter({has:page.getByText('넣은 돈',{exact:true})}).locator('dd')).toHaveText(`$${Math.round(3000*trade.cost).toLocaleString('en-US')}`)
 expect(await page.locator('.bt-grid').evaluate(el=>getComputedStyle(el).display)).toBe(info.project.name==='desktop'?'grid':'flex');await page.evaluate(async()=>{await document.fonts.load('14px "Noto Sans KR Variable"','백테스트 검증 거래');await document.fonts.ready});await page.screenshot({path:info.outputPath('catalogue-bt-result.png'),fullPage:true})
 await page.reload();await page.evaluate(async()=>{const refresh='/@react-refresh',r=(await import(/* @vite-ignore */refresh)).default;r.injectIntoGlobalHook(window);Object.assign(window,{$RefreshReg$:()=>{},$RefreshSig$:()=>(v:unknown)=>v,__vite_plugin_react_preamble_installed__:true});const path='/tests/fixtures/catalogue-backtest-host.tsx';Reflect.set(window,'btFixture',(await import(/* @vite-ignore */path)).mount())});await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase','result');await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-amount','3000')
 await page.getByRole('button',{name:'조건을 바꿔 다시 돌리기',exact:true}).click();await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase','ready');expect(errors).toEqual([]);expect(external).toEqual([])
})
test('실제worker 90/365/730/0는 현물·선물 요청 identity 그대로 정산한다',async({page},info)=>{
 await open(page)
 // Math.pow's final bit can differ between Node22 and Chromium V8. Keep
 // exact equality in the worker's execution runtime, plus the frozen source
 // oracle in that same runtime; never round or change the result contract.
 await page.evaluate(({code,spot,futures,source})=>{
  const run=new Function('window','TETH_PX','TETH_FUT','PRICE0','MK_UNI','mkPx','config','start',code+'\nreturn mkRunCfg(config,start)')
  Reflect.set(window,'btSourceReference',(request:{strategyId:string;period:number})=>{
   const config=source.catalogue.find(c=>c.id===request.strategyId)!,end=spot.px['비트코인'].length-1
   return run({TETH_PX:spot,TETH_FUT:futures},spot,futures,spot.px['비트코인'],source.universes,(k:keyof typeof spot.px)=>spot.px[k],config,request.period?Math.max(config.startI,end-request.period):config.startI)
  })
 },{code:common.code+'\n'+future.code,spot,futures,source})
 for(const id of ['r1','d1','h1','f1','f7'])for(const period of catalogueBacktestPeriods){
  const request=selection(id,period,500)
  const {observed,expected,original}=await page.evaluate(async request=>{
   const resultPath='/src/client-catalogue-backtest-result.ts',dataPath='/src/client-catalogue-market-data.ts'
   const [{computeCatalogueBacktest},{loadCatalogueMarketData}]=await Promise.all([import(/* @vite-ignore */resultPath),import(/* @vite-ignore */dataPath)])
   const observed=await Reflect.get(window,'btFixture').run(request)
   return {observed,expected:computeCatalogueBacktest(request,await loadCatalogueMarketData()),original:Reflect.get(window,'btSourceReference')(request)}
  },request)
  if(hash(observed)!==hash(expected)) await info.attach('worker-observation-difference',{body:JSON.stringify({request,expected,observed}),contentType:'application/json'})
  expect(hash(observed),`${id}/${period}/worker-envelope`).toBe(hash(expected))
  for(const key of ['eq','trades','events','state'] as const) expect(hash(observed.result[key]),`${id}/${period}/source/${key}`).toBe(hash(original[key]))
  for(const key of ['ret','mdd','winRate','n','avgHold','cagr','calmar'] as const) expect(observed.result[key],`${id}/${period}/source/${key}`).toBe(original[key])
 }
})
test('callback resolve는 awaiting만·owner변경/취소 late관측폐기·원 설정 보존',async({page})=>{
 await open(page);await page.evaluate(()=>Reflect.get(window,'btFixture').supply(true));await result(page);await page.getByRole('button',{name:'이 전략 실행하기',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'연결 확인을 요청'}).first()).toBeVisible()
 await page.evaluate(()=>Reflect.get(window,'btFixture').calls[0].resolve());await expect(page.getByText('연결 확인을 요청했습니다. 확인 결과를 기다립니다.',{exact:true}).first()).toBeVisible();await expect(page.getByRole('button',{name:'이 전략 실행하기',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'조건을 바꿔 다시 돌리기',exact:true}).click();await result(page);await page.getByRole('button',{name:'이 전략 실행하기',exact:true}).click();await page.evaluate(()=>Reflect.get(window,'btFixture').owner('bt-owner-b'));await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase','ready')
 expect(await page.evaluate(()=>Reflect.get(window,'btFixture').calls[1].signal.aborted)).toBe(true);await page.evaluate(()=>Reflect.get(window,'btFixture').calls[1].resolve());await expect(page.getByText('연결 확인을 요청했습니다. 확인 결과를 기다립니다.',{exact:true})).toHaveCount(0)
 await page.evaluate(()=>Reflect.get(window,'btFixture').owner(null));await expect(page.getByTestId('catalogue-backtest-unavailable')).toBeVisible()
})
test('중단·저장 throw/손상·잘못된 전략은 실행/쓰기 실패폐쇄',async({page})=>{
 await open(page);await page.getByRole('button',{name:'과거를 다시 돌려 보기',exact:true}).click();await page.getByRole('button',{name:'뒤로',exact:true}).click();await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase','ready');expect(await page.evaluate(()=>Reflect.get(window,'btFixture').counts().backs)).toBe(0)
 await page.evaluate(()=>{sessionStorage.setItem('teth-client-catalogue-backtest:bad-owner:r1','broken');Reflect.get(window,'btFixture').owner('bad-owner')});await expect(page.getByText(/이 탭에 조건을 저장/)).toBeVisible();expect(await page.evaluate(()=>sessionStorage.getItem('teth-client-catalogue-backtest:bad-owner:r1'))).toBe('broken')
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{};Reflect.get(window,'btFixture').owner('drop-owner')});await page.getByRole('button',{name:'과거를 다시 돌려 보기',exact:true}).click();await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase','ready');expect(await page.evaluate(()=>sessionStorage.getItem('teth-client-catalogue-backtest:drop-owner:r1'))).toBeNull();
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('fixture storage')};Reflect.get(window,'btFixture').owner('throw-owner')});await page.getByRole('button',{name:'과거를 다시 돌려 보기',exact:true}).click();await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase','ready')
 await page.evaluate(()=>Reflect.get(window,'btFixture').strategy('BTC'));await expect(page.getByTestId('catalogue-backtest-unavailable')).toBeVisible()
})
