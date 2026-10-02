import { expect, test, type Page } from '@playwright/test'
import type { ClientSession, ClientTurn } from '../src/client-experience-store'
import type { InlineBacktestRecord } from '../src/client-inline-backtest'
import { sourceTerminalPrices } from '../src/client-terminal-source-fixture'
import { copyPreviewStorageKey } from '../src/client-copy-preview-store'
import { copyPreviewPairs, createCopyPreviewState, startCopyPreview } from '../src/client-copy-preview-state'
import { sourceSharedStrategies } from '../src/client-shared-strategies'

// Exercise real Main navigation and reader recovery, not a replaced resume
// function. All supplied data is public source preview, never API authority.
const owner = 'inline-resume-integrity@example.test'
const copiedSource=sourceSharedStrategies()[0]
const managedCopy=startCopyPreview(createCopyPreviewState(owner),{owner,id:'unrelated-managed-copy',amount:200,pairs:[copyPreviewPairs(copiedSource)[0]],mode:'ratio',at:1000},copiedSource)
if(!managedCopy.ok)throw Error(managedCopy.message)
const managedCopyBytes=JSON.stringify(managedCopy.state), managedCopyKey=copyPreviewStorageKey(owner)
const sessionId = 'inline-resume-integrity-current'
const otherId = 'inline-resume-integrity-other'
const turnId = 'inline-resume-integrity-turn'
const experienceKey = 'teth-client-experience'
const delegationKey = `teth:client-delegation:${sessionId}`
const registrationKey = `teth-client-user-strategies:${encodeURIComponent(owner)}`
const locatorKey = `teth-client-delegation-location:account:${encodeURIComponent(owner)}`
const draft = '손상 복구 뒤에도 보존할 ETH 초안'
const otherDraft = '별도 BTC 대화의 미전송 초안'
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: sourceTerminalPrices.length - 1 }
const turn: ClientTurn = {
  id: turnId, question: 'ETH 1시간봉 추세 손절 5%, 익절 12%', answer: '새 조건의 검증 결과예요.', fullAnswer: '새 조건의 검증 결과예요.',
  phase: 'plan', status: 'done', suggestions: [], startedAt: 1_700_000_000_000, finishedAt: 1_700_000_002_000,
  inlineRequest: { pair: 'ETH/USDT', timeframe: '1시간봉', parameters },
}
const result: InlineBacktestRecord = { turnId, ordinal: 1, pair: 'ETH/USDT', timeframe: '1시간봉', parameters, completedAt: turn.finishedAt! + 1_100 }
const current: ClientSession = {
  id: sessionId, title: 'ETH 인라인 재개 검수', renamed: true, idea: turn.question, draft,
  pair: 'ETH/USDT', timeframe: '1시간봉', mode: 'trend', risk: '−5%', takeProfit: '+12%',
  phase: 'plan', researchStatus: '초안', workspace: 'conversation', tradingReady: false,
  turns: [turn], inlineResults: [result], updatedAt: result.completedAt,
}
const other: ClientSession = { ...current, id: otherId, title: '별도 BTC 대화', idea: 'BTC 반등', pair: 'BTC/USDT', draft: otherDraft, turns: [], inlineResults: [] }
type Damage = 'selector' | 'result'

async function route(page: Page, hash: string) {
  await page.evaluate(hash => { history.pushState(null, '', hash || location.pathname); dispatchEvent(new Event('teth:navigate')) }, hash)
}

async function prepareOrphan(page: Page, damage: Damage, terminal = false) {
  const requests: string[] = []
  await page.route('**/api/**', route => { requests.push(route.request().url()); return route.abort('failed') })
  page.on('request', request => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) && !requests.includes(request.url())) requests.push(request.url())
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ experienceKey, owner, current, other, terminal, managedCopyKey, managedCopyBytes }) => {
    if (sessionStorage.getItem('inline-resume-seeded')) return
    sessionStorage.setItem('inline-resume-seeded', 'true')
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem('tethCurrency', 'KRW')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '재개 경계 검수', email: owner }))
    // Current source shows the introduction for empty accounts. An unrelated,
    // valid managed copy makes the real terminal connection CTA available.
    if(terminal)sessionStorage.setItem(managedCopyKey,managedCopyBytes)
    sessionStorage.setItem(experienceKey, JSON.stringify({ currentId: current.id, homeDraft: '홈 초안 보존', sessions: [current, other], sharedFollows: [] }))
  }, { experienceKey, owner, current, other, terminal, managedCopyKey, managedCopyBytes })
  await page.goto('/')
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  // Produce the cache and locator through the actual successful CTA. A seeded
  // score-only cache would not demonstrate a broken post-handoff binding.
  await page.getByRole('button', { name: '이 전략 실행하기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '어떻게 실행할까요?', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? 'null'), delegationKey)).toMatchObject({
    page: 'connect', inlineResult: true, inlineTurnId: turnId, workStep: 5, questionIndex: 5, parameters,
  })
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), locatorKey)).toEqual({ sessionId })
  const cacheBytes = await page.evaluate(key => sessionStorage.getItem(key), delegationKey)
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBeNull()

  // Corrupt only persisted conversation evidence after the outgoing document's
  // pagehide flush. Keep valid cache bytes and the same-owner locator untouched.
  await page.addInitScript(({ experienceKey, sessionId, damage }) => {
    if (sessionStorage.getItem('inline-resume-damage-applied')) return
    sessionStorage.setItem('inline-resume-damage-applied', 'true')
    const saved = JSON.parse(sessionStorage.getItem(experienceKey)!)
    const selected = saved.sessions.find((item: { id: string }) => item.id === sessionId)
    if (damage === 'selector') selected.inlineConnectionTurnId = 'missing-inline-result'
    else selected.inlineResults[0].completedAt += 1
    sessionStorage.setItem(experienceKey, JSON.stringify(saved))
  }, { experienceKey, sessionId, damage })
  await page.reload()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(page.locator('.client-delegation')).toHaveCount(0)
  await expect(page.locator('.client-inline-backtest[data-turn-id="' + turnId + '"]')).toHaveCount(damage === 'selector' ? 1 : 0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), delegationKey)).toBe(cacheBytes)
  // Confirm this is still an otherwise resumable cache, not a low-score or
  // incomplete fixture accidentally rejected before the integrity boundary.
  expect(await page.evaluate(async sessionId => {
    const fixturePath = '/src/client-delegation-fixtures.ts'
    const connectionPath = '/src/client-delegation-connection.ts'
    const fixture = await import(/* @vite-ignore */ fixturePath)
    const connection = await import(/* @vite-ignore */ connectionPath)
    return connection.canResumeDelegationConnection(fixture.readDelegationUi(sessionId))
  }, sessionId)).toBe(true)
  return { requests, cacheBytes }
}

async function expectPreserved(page: Page, cacheBytes: string | null, damage: Damage) {
  expect(await page.evaluate(key => sessionStorage.getItem(key), delegationKey)).toBe(cacheBytes)
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBeNull()
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), locatorKey)).toEqual({ sessionId })
  await expect.poll(() => page.evaluate(({ experienceKey, sessionId }) => {
    const saved = JSON.parse(sessionStorage.getItem(experienceKey)!)
    const selected = saved.sessions.find((item: { id: string }) => item.id === sessionId)
    return { currentId: saved.currentId, workspace: selected.workspace, selector: selected.inlineConnectionTurnId ?? null }
  }, { experienceKey, sessionId })).toEqual({ currentId: sessionId, workspace: 'conversation', selector: null })
  const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), experienceKey)
  const selected = saved.sessions.find((item: { id: string }) => item.id === sessionId)
  expect(selected.inlineConnectionRecovery).toBe(true)
  expect(selected.draft).toBe(draft)
  expect(selected.turns[0]).toMatchObject({ id: turnId, question: turn.question, answer: turn.answer, inlineRequest: turn.inlineRequest })
  expect(selected.inlineResults).toEqual(damage === 'selector' ? [result] : [])
  if (damage === 'result') expect(selected.turns[0].inlineStopped).toBe(true)
  expect(saved.sessions.find((item: { id: string }) => item.id === otherId)).toMatchObject({ id: otherId, draft: otherDraft, pair: 'BTC/USDT', turns: [], inlineResults: [] })
  expect(saved.homeDraft).toBe('홈 초안 보존')
  expect(saved.sessions).toHaveLength(2)
}

for (const damage of ['selector', 'result'] as const) {
  test(`${damage} 손상 복구 뒤 PLAN의 최신 결제 설정 연결은 고아 inline 캐시를 재개하지 않는다`, async ({ page }) => {
    const { requests, cacheBytes } = await prepareOrphan(page, damage)
    await route(page, '#/plan')
    await expect(page).toHaveURL(/#\/settings\/billing$/)
    await expect(page.getByRole('heading', { name: '결제', exact: true })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'PRO 로 업그레이드', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '알림 닫기', exact: true }).click()
    const settingsBack = page.getByRole('link', { name: '설정', exact: true })
    if (await settingsBack.isVisible()) await settingsBack.click()
    await page.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click()
    await expect(page.locator('.client-delegation')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: '어떻게 실행할까요?', exact: true })).toHaveCount(0)
    await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
    await expectPreserved(page, cacheBytes, damage)
    expect(requests).toEqual([])
  })

  test(`${damage} 손상 복구 뒤 터미널 연결은 고아 inline 캐시 대신 최신 연결 플랜으로 이동한다`, async ({ page }) => {
    const { requests, cacheBytes } = await prepareOrphan(page, damage, true)
    await route(page, '#/trade')
    await expect(page.locator('.client-account-terminal')).toBeVisible()
    const panels = page.getByRole('tablist', { name: '터미널 영역', exact: true })
    if (await panels.isVisible()) await panels.getByRole('tab', { name: '차트', exact: true }).click()
    const connection = page.locator('.ctt-bottom-pane[data-selected="true"]').getByRole('button', { name: '거래소 연결하기', exact: true })
    await connection.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('connection-plan')).toHaveAttribute('data-step','plan')
    await expect(page.locator('.client-delegation')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: '어떻게 실행할까요?', exact: true })).toHaveCount(0)
    await expectPreserved(page, cacheBytes, damage)
    expect(await page.evaluate(key=>sessionStorage.getItem(key),managedCopyKey)).toBe(managedCopyBytes)
    expect(requests).toEqual([])
  })
}
