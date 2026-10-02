import { expect, test, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'
import { evaluateDelegation } from '../src/client-delegation-engine'
const key = 'teth-client-experience', owner = 'offline-source@example.test'
async function read(page: Page): Promise<ClientSession> { return page.evaluate(key => { const s=JSON.parse(sessionStorage.getItem(key)!); return s.sessions.find((x:{id:string})=>x.id===s.currentId) },key) }
async function open(page:Page,host=false,custom?: 'guest' | 'throw' | 'invalid-id' | 'invalid-subscribe'){
  const external:string[]=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method())||new URL(r.url()).pathname.startsWith('/api/'))external.push(r.url())})
  await page.route('**/api/**',r=>r.abort('failed'));await page.clock.install({time:new Date('2026-10-01T00:00:00Z')});await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(({owner,custom})=>{localStorage.setItem('tethLang','ko');if(custom==='guest')sessionStorage.removeItem('teth-client-profile-preview');else sessionStorage.setItem('teth-client-profile-preview',JSON.stringify({name:'원본 offline',email:owner}))},{owner,custom})
  if(host){await page.route('**/offline-host.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script></body></html>'}));await page.goto('/offline-host.html');await page.evaluate(async ({owner,custom})=>{
    if (!custom) { const path='/tests/fixtures/ordered-response-host.tsx';const {mount}=await import(/* @vite-ignore */path);Reflect.set(window,'proposalHost',mount(owner)); return }
    const sideEffectPath='/tests/fixtures/ordered-response-host.tsx';await import(/* @vite-ignore */sideEffectPath)
    const runtimePath='/tests/fixtures/client-react-runtime.ts', {testClientReactRuntimePaths}=await import(/* @vite-ignore */runtimePath)
    const paths=await testClientReactRuntimePaths(), reactModule=await import(/* @vite-ignore */paths.reactPath), React=reactModule.default??reactModule
    const dom=await import(/* @vite-ignore */paths.rootPath), componentPath='/src/components/ClientMainExperience.tsx'
    const {ClientMainExperience}=await import(/* @vite-ignore */componentPath)
    const subscriptions: {receive:(update:unknown)=>boolean;signal:AbortSignal}[]=[]
    const source={id:custom==='invalid-id'?' ':'custom-source',owner:custom==='guest'?null:owner,subscribe:(receive:(update:unknown)=>boolean,signal:AbortSignal)=>{subscriptions.push({receive,signal});if(custom==='throw')throw Error('test unavailable source')}}
    const supplied=custom==='invalid-subscribe'?{...source,subscribe:null}:source
    const root=(dom.createRoot??dom.default.createRoot)(document.getElementById('fixture')!)
    root.render(React.createElement(ClientMainExperience,{responseSource:supplied}));Reflect.set(window,'customSubscriptions',subscriptions)
  },{owner,custom})}else await page.goto('/')
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));return external
}
async function start(page:Page,idea:string){await page.locator('#strategy-idea').fill(idea);await page.getByRole('button',{name:'대화 시작',exact:true}).click();await settle(page)}
async function settle(page:Page){await page.clock.fastForward(20_000);await page.clock.fastForward(2_000)}
test('fresh offline intake는 자동 결과와 실패 추천을 거쳐 같은 스레드의 연구로 진입한다',async({page})=>{
 const writes=await open(page);await start(page,'비트코인 하락 후 반등 전략')
 for(const name of ['1시간마다','-3% (표준)','익절 +8% 설정']){await page.getByRole('button',{name,exact:true}).click();await settle(page)}
 let s=await read(page);expect(s.inlineResults).toHaveLength(1);expect(s.turns.at(-1)?.backtestFlow).toBeUndefined();await expect(page.getByRole('button',{name:'과거로 돌려 보기',exact:true})).toHaveCount(0)
 const first=s.inlineResults![0];const computed=evaluateDelegation(first.parameters,5_000_000);await expect(page.locator('.gbt[data-bt="1"] .sc b')).toHaveText(String(computed.score))
 if(computed.score<80){await expect(page.getByRole('button',{name:'연구 계획서 크게 보기',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'추천 설정으로 다시 검증',exact:true}).click();await settle(page);s=await read(page);expect(s.inlineResults).toHaveLength(2);expect(s.inlineResults![0]).toEqual(first)}
 if(evaluateDelegation(s.inlineResults!.at(-1)!.parameters,5_000_000).score<80){await expect(page.getByRole('button',{name:'연구 계획서 크게 보기',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'조건을 직접 수정할게요',exact:true}).click();await settle(page);await page.locator('.g-composer textarea').fill('익절 12%');await page.getByRole('button',{name:'메시지 보내기',exact:true}).click();await settle(page);s=await read(page);expect(s.inlineResults).toHaveLength(3);expect(s.inlineResults![0]).toEqual(first)}
 const pass=s.inlineResults!.at(-1)!;expect(evaluateDelegation(pass.parameters,5_000_000).score).toBeGreaterThanOrEqual(80)
 await page.getByRole('button',{name:'연구 계획서 크게 보기',exact:true}).click();await expect(page.getByRole('heading',{name:'연구 계획',exact:true})).toBeVisible();await page.getByRole('button',{name:'연구 시작',exact:true}).click();await page.clock.fastForward(22_000);await page.reload();await page.clock.fastForward(110_000)
 await expect(page.getByRole('button',{name:'최종 보고서 열기',exact:true})).toBeVisible();expect((await read(page)).researchPlanTurnId).toBe(pass.turnId);expect((await read(page)).inlineResults).toEqual(s.inlineResults);expect(writes).toEqual([])
})
test('fresh 추천 duplicate와 reload는 원 조건·초안·정확한 두 결과를 보존한다',async({page})=>{
 const writes=await open(page);await start(page,'ETH 반등 1시간봉 손절 2%, 익절 8%');const before=await read(page),first=before.inlineResults![0];expect(evaluateDelegation(first.parameters,5_000_000).score).toBeLessThan(80)
 await page.locator('.g-composer textarea').fill('미전송 원 초안');await page.getByRole('button',{name:'추천 설정으로 다시 검증',exact:true}).evaluate(n=>{(n as HTMLButtonElement).click();(n as HTMLButtonElement).click()});expect((await read(page)).turns).toHaveLength(before.turns.length+1)
 await page.clock.fastForward(20_000);await page.reload();await settle(page);const next=await read(page);expect(next.inlineResults).toHaveLength(2);expect(next.inlineResults![0]).toEqual(first);expect(next.inlineResults![1]).toMatchObject({ordinal:2,pair:'ETH/USDT',parameters:{sl:-5,tp:8,trendFilter:true}});expect(next.turns.at(-1)?.backtestFlow).toBeUndefined();await expect(page.locator('.g-composer textarea')).toHaveValue('미전송 원 초안');await page.clock.fastForward(90_000);expect((await read(page)).inlineResults).toEqual(next.inlineResults);expect(writes).toEqual([])
})
test('owner-matched source의 늦은 완료 proposal은 local inline을 만들지 않고 common을 유지한다',async({page})=>{
 const writes=await open(page,true);await start(page,'ETH 추세 1시간봉 손절 5%, 익절 12%');const s=await read(page),t=s.turns.at(-1)!;expect(s.inlineResults??[]).toHaveLength(0);expect(t.backtestFlow).toBe('common')
 const accepted=await page.evaluate(({s,t,owner})=>{const h=Reflect.get(window,'proposalHost');return h.deliver({sessionId:s.id,turnId:t.id,expectedRevision:0,sequence:{version:1,owner,sessionId:s.id,turnId:t.id,revision:1,status:'done',blocks:[{id:'observed-text',kind:'text',status:'done',text:'공급 관측으로 확인한 조건입니다.'}],strategyProposal:{input:t.inlineRequest,period:365,excludedConditions:[]}}})},{s,t,owner});expect(accepted).toBe(true)
 await page.clock.fastForward(60_000);const observed=await read(page);expect(observed.inlineResults??[]).toHaveLength(0);expect(observed.turns.at(-1)).toMatchObject({backtestFlow:'common',responseSequence:{owner,status:'done'}});await expect(page.getByRole('button',{name:'과거로 돌려 보기',exact:true})).toBeVisible();await page.reload();await page.evaluate(async owner=>{const path='/tests/fixtures/ordered-response-host.tsx';const{mount}=await import(/* @vite-ignore */path);Reflect.set(window,'proposalHost',mount(owner))},owner);expect((await read(page)).turns.at(-1)?.responseSequence).toEqual(observed.turns.at(-1)?.responseSequence);expect(writes).toEqual([])
})
test('foreign source는 공급자로 인정하지 않고 새 요청은 original offline 결과를 만든다',async({page})=>{
 await open(page,true);await page.evaluate(()=>Reflect.get(window,'proposalHost').source('foreign-provider','foreign@example.test'));await start(page,'ETH 추세 1시간봉 손절 5%, 익절 12%');const s=await read(page);expect(s.inlineResults).toHaveLength(1);expect(s.turns.at(-1)?.backtestFlow).toBeUndefined();expect(s.turns.at(-1)?.responseSequence).toBeUndefined();await expect(page.getByRole('button',{name:'연구 계획서 크게 보기',exact:true})).toBeVisible()
})

for (const custom of ['throw', 'invalid-id', 'invalid-subscribe'] as const) test(`${custom} source는 관측 권한을 만들지 않고 fresh inline으로 복원한다`, async ({ page }) => {
  const writes = await open(page, true, custom)
  await start(page, 'ETH 추세 1시간봉 손절 5%, 익절 12%')
  const s = await read(page)
  expect(s.inlineResults).toHaveLength(1)
  expect(s.turns.at(-1)?.backtestFlow).toBeUndefined()
  expect(s.turns.at(-1)?.responseSequence).toBeUndefined()
  if (custom === 'throw') expect(await page.evaluate(() => Reflect.get(window, 'customSubscriptions').every((s: { signal: AbortSignal }) => s.signal.aborted))).toBe(true)
  expect(writes).toEqual([])
})

test('auth pending 새 owner는 이전 guest 공급 경로를 쓰지 않고 폐기된 callback도 거절한다', async ({ page }) => {
  const writes = await open(page, true, 'guest')
  await page.locator('#strategy-idea').fill('ETH 추세 1시간봉 손절 5%, 익절 12%')
  await page.getByRole('button', { name: '로그인', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('input[type=email]').fill(owner)
  await dialog.locator('button[type=submit]').click()
  await dialog.locator('input[inputmode=numeric]').fill('123456')
  await dialog.locator('button[type=submit]').click()
  await settle(page)
  const s = await read(page), turn = s.turns.at(-1)!
  expect(s.turns).toHaveLength(1)
  expect(s.inlineResults).toHaveLength(1)
  expect(turn.backtestFlow).toBeUndefined()
  expect(turn.responseSequence).toBeUndefined()
  const late = await page.evaluate(({ s, turn }) => {
    const subscriptions = Reflect.get(window, 'customSubscriptions')
    const old = subscriptions[0]
    return { aborted: old.signal.aborted, accepted: old.receive({sessionId:s.id,turnId:turn.id,expectedRevision:0,sequence:{version:1,owner:null,sessionId:s.id,turnId:turn.id,revision:1,status:'done',blocks:[{id:'late',kind:'text',status:'done',text:'이전 공급 관측'}]}}) }
  }, { s, turn })
  expect(late).toEqual({ aborted: true, accepted: false })
  expect((await read(page)).turns).toEqual(s.turns)
  expect(writes).toEqual([])
})

for (const mode of ['throw', 'invalid'] as const) test(`${mode} local getter 실패는 fresh session·draft·저장 bytes를 바꾸지 않는다`, async ({ page }) => {
  await page.route('**/offline-getter.html', route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local flow getter</title>'}))
  await page.goto('/offline-getter.html')
  const out = await page.evaluate(async mode => {
    const path='/src/client-experience-store.ts', {createClientExperienceStore}=await import(/* @vite-ignore */path)
    let fail=false
    const store=createClientExperienceStore({localBacktestFlow:()=>{if(fail){if(mode==='throw')throw Error('test getter');return 'unavailable'}return 'inline'}})
    store.draft('보존할 새 입력')
    const before=JSON.stringify(store.getSnapshot()),bytes=sessionStorage.getItem('teth-client-experience')
    fail=true
    let threw=false
    try{store.send('ETH 추세 1시간봉 손절5% 익절12%', 'composer', '보존할 새 입력', undefined, null)}catch{threw=true}
    return {threw,snapshot:JSON.stringify(store.getSnapshot())===before,bytes:sessionStorage.getItem('teth-client-experience')===bytes}
  },mode)
  expect(out).toEqual({threw:true,snapshot:true,bytes:true})
})
