// Explicit owner-bound Mock supplier tests for the common response branch.
// Fresh supplier-free source intake is covered by offline source journey specs.
import { installCommonResponseFixture } from './fixtures/client-common-response-fixture'
import { expect, test, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'
import { namedIntakeRsi, normalizeSourceRsi } from '../src/client-intake-input'
import { decodeInlineInput } from '../src/client-inline-backtest'
import { commonBacktestText } from '../src/client-common-backtest-copy'

const key = 'teth-client-experience'
test('RSI 해석은 명시한 진입값 하나만 받고 저장 입력은 적용값과 일치해야 한다', () => {
  for(const text of ['BTC 반등','손절 3%']) expect(namedIntakeRsi(text)).toEqual({kind:'absent'})
  for(const text of ['RSI 30','ＲＳＩ가 ３０ 미만','RSI 기준: 30 아래 매수']) expect(namedIntakeRsi(text)).toEqual({kind:'value',requested:30})
  for(const text of ['RSI(14) 30','RSI 14일','RSI 30/70','RSI 30~70','RSI 30,70','RSI 30 이상','RSI 30 이하','RSI 30으로 하지 마','RSI 2..5','RSI 1e3','RSI 30%','RSI 30 70','RSI NaN','RSI Infinity','RSI 30 말고 20']) expect(namedIntakeRsi(text),text).toEqual({kind:'unresolved'})
  const base={pair:'BTC/USDT',timeframe:'일봉',parameters:{sl:-3,tp:8,rsiTh:30,trendFilter:false,startI:61,endI:90}}
  expect(decodeInlineInput({...base,requestedRsi:29.6})?.requestedRsi).toBe(29.6)
  for(const raw of [null,'30',NaN,Infinity,[],{},44]) expect(decodeInlineInput({...base,requestedRsi:raw})).toBeUndefined()
  expect(decodeInlineInput(base)?.parameters.rsiTh).toBe(30)
  expect(normalizeSourceRsi(80)).toBe(70)
})
async function read(page: Page): Promise<ClientSession> {
  return page.evaluate(key => {
    const state = JSON.parse(sessionStorage.getItem(key)!)
    return state.sessions.find((s: ClientSession) => s.id === state.currentId)
  }, key)
}
async function ask(page: Page, text: string, home = false) {
  const input = page.locator(home ? '#strategy-idea' : '.g-composer textarea')
  await input.fill(text); await input.press('Enter'); await page.clock.fastForward(15_000)
}
async function open(page: Page) {
  await installCommonResponseFixture(page, 'rsi-common@example.test')
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'RSI 공급 검수', email: 'rsi-common@example.test' })))
  await page.clock.install(); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/')
}

test('명시 RSI는 대화·전략 카드·검증 입력·새로고침에 보존되고 수정은 과거 조건을 바꾸지 않는다', async ({ page }, info) => {
  await open(page)
  const idea = 'BTC 반등 일봉 RSI 30 미만 매수, 손절 3%, 익절 8%'
  await ask(page, idea, true)
  const first = (await read(page)).turns[0]
  expect(first.inlineRequest?.parameters.rsiTh).toBe(30)
  await expect(page.getByTestId('common-strategy-summary').last()).toContainText('RSI가 30 아래')
  await page.reload()
  expect((await read(page)).turns[0].inlineRequest).toEqual(first.inlineRequest)
  await ask(page, 'RSI 44 미만에서 반등 매수')
  let state = await read(page)
  expect(state.turns[0].inlineRequest).toEqual(first.inlineRequest)
  expect(state.turns.at(-1)?.inlineRequest?.parameters.rsiTh).toBe(44)
  await expect(page.getByTestId('common-strategy-summary').last()).toContainText('RSI가 44 아래')
  await ask(page, '손절 5%')
  state = await read(page)
  expect(state.turns.at(-1)?.inlineRequest?.parameters).toMatchObject({ rsiTh: 44, sl: -5, tp: 8 })
  await page.getByTestId('common-strategy-summary').last().getByRole('button', { name: '과거로 돌려 보기' }).click()
  await expect(page.getByTestId('common-backtest')).toHaveAttribute('data-phase', 'ready')
  expect((await read(page)).turns.at(-1)?.inlineRequest?.parameters.rsiTh).toBe(44)
  await page.screenshot({ path: info.outputPath('rsi-backtest-ready.png') })
})

for (const [raw, normalized] of [[1,5], [80,70], [29.6,30]] as const) test(`원본 RSI 정규화 ${raw}→${normalized}는 입력과 적용값을 모두 표시한다`, async ({page})=>{
  await open(page); await ask(page, `BTC 반등 일봉 RSI ${raw} 미만 매수, 손절 3%, 익절 8%`, true)
  expect((await read(page)).turns.at(-1)?.inlineRequest?.parameters.rsiTh).toBe(normalized)
  await expect(page.getByTestId('common-strategy-summary')).toContainText(`RSI ${raw} → ${normalized}`)
})

test('미확정 RSI는 새 검증을 만들지 않으며 명시 수정 뒤 기존 결과를 보존한다', async ({page})=>{
  await open(page); await ask(page, 'BTC 반등 일봉 RSI 30 미만 매수, 손절 3%, 익절 8%', true)
  const before = (await read(page)).turns[0].inlineRequest
  for(const text of ['RSI 70 이상 매도', 'RSI 30 말고 20', 'RSI 30 미만 또는 RSI 20 미만', 'RSI(14) 30', 'RSI 2..5', 'RSI 1e999']) {
    await ask(page,text)
    expect((await read(page)).turns.at(-1)?.inlineRequest,text).toBeUndefined()
  }
  await page.reload(); await ask(page,'손절 5%')
  expect((await read(page)).turns.at(-1)?.inlineRequest).toBeUndefined()
  await ask(page,'RSI 25 미만에서 반등 매수')
  const after=await read(page)
  expect(after.turns[0].inlineRequest).toEqual(before)
  expect(after.turns.at(-1)?.inlineRequest?.parameters.rsiTh).toBe(25)
  expect(after.turns.at(-1)?.inlineRequest?.parameters.sl).toBe(-5)
})

test('첫 모호한 RSI도 다른 명시 조건은 보존하고 확인 전 검증하지 않는다',async({page})=>{
  await open(page); await ask(page,'BTC 반등 일봉 RSI 70 이상 매도, 손절 3%, 익절 8%',true)
  expect(await read(page)).toMatchObject({pair:'BTC/USDT',timeframe:'일봉',risk:'−3%',takeProfit:'+8%'})
  expect((await read(page)).turns.at(-1)?.inlineRequest).toBeUndefined()
  await expect(page.locator('.gcl')).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  await ask(page,'RSI 30 미만 매수')
  expect((await read(page)).turns.at(-1)?.inlineRequest?.parameters).toMatchObject({rsiTh:30,sl:-3,tp:8})
})

test('손상된 세션 RSI만 격리하고 기존 전략 턴·다른 대화·저장 원문을 보존한다',async({page})=>{
  await page.route('**/rsi-fixture.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}))
  await page.goto('/rsi-fixture.html')
  const outcomes=await page.evaluate(async()=>{
    const path='/src/client-experience-store.ts'
    const {createClientExperienceStore}=await import(/* @vite-ignore */path)
    const key='teth-client-experience', original=createClientExperienceStore()
    original.send('BTC 반등 일봉 RSI 30 미만 매수, 손절 3%, 익절 8%')
    original.tick(Date.now()+30_000);original.flush()
    const saved=JSON.parse(sessionStorage.getItem(key)!), first=saved.sessions[0].turns[0]
    saved.sessions.push({...structuredClone(saved.sessions[0]),id:'unrelated-session',title:'다른 대화',draft:'작성 중인 초안'})
    return [null,'30',{},false].map(value=>{
      const payload=structuredClone(saved)
      payload.sessions[0].requestedRsi=value
      const bytes=JSON.stringify(payload);sessionStorage.setItem(key,bytes)
      const store=createClientExperienceStore(), restored=store.getSnapshot()
      const result={warning:restored.recoveryWarning,unresolved:restored.sessions[0].rsiUnresolved,
        same:JSON.stringify(first)===JSON.stringify(restored.sessions[0].turns[0]),bytes:sessionStorage.getItem(key)===bytes,
        unrelated:JSON.stringify(restored.sessions[1])===JSON.stringify(saved.sessions[1])}
      store.send('손절 5%');store.tick(Date.now()+30_000);store.flush()
      return {...result, request:store.getSnapshot().sessions[0].turns.at(-1).inlineRequest}
    })
  })
  for(const outcome of outcomes)expect(outcome).toEqual({warning:true,unresolved:true,same:true,bytes:true,unrelated:true,request:undefined})
})

for(const language of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as const) test(`${language}: RSI 조건 카드는 원본 문장·보정값·320px 줄바꿈을 유지한다`,async({page},info)=>{
  await page.setViewportSize({width:320,height:844})
  await page.addInitScript(language=>localStorage.setItem('tethLang',language),language)
  await open(page); await ask(page,'BTC 반등 일봉 RSI 29.6 미만 매수, 손절 3%, 익절 8%',true)
  const card=page.getByTestId('common-strategy-summary')
  await expect(card).toHaveCSS('background-color','rgb(48, 48, 48)')
  await expect(card.locator('h3')).toHaveCSS('font-size','16px')
  await expect(card.locator('.summary-open')).toHaveCSS('border-radius','999px')
  await expect(card.locator('.summary-open')).toHaveCSS('background-color','rgb(255, 255, 255)')
  await expect(card).toContainText(commonBacktestText(language,'rsiRebound').replace('{rsi}','30'))
  const raw=new Intl.NumberFormat(language).format(29.6)
  await expect(card).toContainText(`RSI ${raw} → 30`)
  expect(await card.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await card.scrollIntoViewIfNeeded()
  if(language==='ko'||language==='fr')await page.screenshot({path:info.outputPath(`rsi-card-${language}.png`)})
})

test('RSI 30 대화의 실제 로컬 결과는 44 기본값이 아니라 동일 730일 입력 계산과 일치한다',async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000}); await open(page)
  await ask(page,'BTC 반등 일봉 RSI 30 미만 매수, 손절 3%, 익절 8%',true)
  const card=page.getByTestId('common-strategy-summary')
  await card.scrollIntoViewIfNeeded()
  await page.screenshot({path:info.outputPath('rsi-card-desktop.png')})
  await card.getByRole('button',{name:'과거로 돌려 보기'}).click()
  const root=page.getByTestId('common-backtest')
  await expect(root).toHaveAttribute('data-phase','ready')
  await root.getByRole('button',{name:commonBacktestText('ko','run'),exact:true}).click()
  await expect(root).toHaveAttribute('data-phase','result')
  const expected=await page.evaluate(async()=>{
    const path='/src/client-common-backtest-preview.ts'
    const {commonBacktestInput,commonPreviewResult}=await import(/* @vite-ignore */path)
    const state=JSON.parse(sessionStorage.getItem('teth-client-experience')!)
    const session=state.sessions.find((s:ClientSession)=>s.id===state.currentId)
    const input=commonBacktestInput(session)!, actual=commonPreviewResult(input)
    const previous=commonPreviewResult({...input,input:{...input.input,parameters:{...input.input.parameters,rsiTh:44}}})
    const money=new Intl.NumberFormat('ko',{style:'currency',currency:'USD',maximumFractionDigits:2})
    return {rsi:actual.evaluation.r.params.rsiTh,bars:actual.points.length,pnl:money.format(actual.evaluation.pnl),previous:money.format(previous.evaluation.pnl)}
  })
  expect(expected.rsi).toBe(30); expect(expected.bars).toBe(730)
  expect(expected.pnl).not.toBe(expected.previous)
  await expect(root.getByTestId('common-result').locator(':scope > p')).toHaveText(expected.pnl)
  await page.screenshot({path:info.outputPath('rsi-result-730.png')})
  await page.reload()
  await expect(root).toHaveAttribute('data-phase','result')
  await expect(root.getByTestId('common-result').locator(':scope > p')).toHaveText(expected.pnl)
})
