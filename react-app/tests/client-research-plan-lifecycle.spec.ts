import { expect, test, type Page } from '@playwright/test'
import type { ClientSession, ClientTurn } from '../src/client-experience-store'
import type { InlineBacktestRecord } from '../src/client-inline-backtest'
import { evaluateDelegation } from '../src/client-delegation-engine'
import { sourceTerminalPrices } from '../src/client-terminal-source-fixture'

// Real Main UI over local source fixtures. Research replay is not a service job
// or a claim that the supplied conditions produced the fixed research report.
const owner = 'research-plan-lifecycle@example.test'
const experienceKey = 'teth-client-experience'
const sessionId = 'research-plan-two-results'
const otherId = 'research-plan-other-session'
const draft = '두 검증 결과 뒤에 남겨둔 대화 초안'
const otherDraft = '다른 대화의 초안은 그대로'

test('이전 문서 복귀는 320px의 7언어에서도 읽히고 기존 non-inline 계획 진입은 유지한다', async ({ page }, testInfo) => {
  const requests = await setup(page)
  await page.setViewportSize({ width: 320, height: 760 })
  const labels = { ko: '이전 연구 문서', en: 'Previous Research Doc', ja: '過去の研究文書', 'zh-CN': '先前研究文档', 'zh-TW': '先前研究文件', es: 'Doc. de investigación previo', fr: 'Doc. de recherche précédent' }
  for (const [language, label] of Object.entries(labels)) {
    await page.evaluate(language => localStorage.setItem('tethLang', language), language)
    await page.reload()
    const button = page.locator('.client-next-actions').getByRole('button', { name: new RegExp(label.replaceAll('.', '\\.')) })
    await expect(button).toBeVisible()
    await button.scrollIntoViewIfNeeded()
    expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath('base-research-return-fr-320.png') })
  await page.addInitScript(({ key, sessionId }) => {
    if (sessionStorage.getItem('base-non-inline-fixture')) return
    sessionStorage.setItem('base-non-inline-fixture', 'true')
    const saved = JSON.parse(sessionStorage.getItem(key)!)
    const session = saved.sessions.find((s: ClientSession) => s.id === sessionId)
    session.inlineResults = []
    session.turns.forEach((turn: ClientTurn) => { delete turn.inlineRequest })
    sessionStorage.setItem(key, JSON.stringify(saved))
    localStorage.setItem('tethLang', 'ko')
  }, { key: experienceKey, sessionId })
  await page.reload()
  const original = page.locator('.client-next-actions').getByRole('button', { name: /^연구 계획 확인/ })
  await expect(original).toBeVisible()
  await original.click()
  await expect(page.locator('.rw-composer textarea')).toHaveValue('기존 legacy 문서 초안')
  expect(requests).toEqual([])
})
test('이전 완료 문서의 진행 기록이 손상되면 안내하고 문서·현재 대화를 보존한다', async ({ page }) => {
  const requests = await setup(page)
  const stored = JSON.stringify({ active: 'report', tabs: ['plan', 'report'], drafts: { plan: '기존 계획 초안', report: '보고서 초안 보존' }, positions: { report: 150 }, replies: [], edits: {} })
  await page.addInitScript(({ documentKey, replayKey, stored }) => {
    if (sessionStorage.getItem('base-broken-clock-fixture')) return
    sessionStorage.setItem('base-broken-clock-fixture', 'true')
    sessionStorage.setItem(documentKey, stored)
    sessionStorage.setItem(replayKey, '{broken')
  }, { documentKey: documentKey(sessionId), replayKey: replayKey(sessionId), stored })
  await page.reload()
  await page.locator('.client-next-actions').getByRole('button', { name: /이전 연구 문서/ }).click()
  await expect(page.locator('.client-global-notice')).toContainText('저장된 연구 진행을 확인할 수 없어요')
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(page.locator('.client-restored-research')).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), documentKey(sessionId))).toBe(stored)
  expect(await page.evaluate(key => sessionStorage.getItem(key), replayKey(sessionId))).toBe('{broken')
  expect(requests).toEqual([])
})
const firstDraft = '첫 ETH 계획의 문서 질문 초안'
const secondDraft = '둘째 BTC 계획의 독립 문서 초안'
const firstParameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: sourceTerminalPrices.length - 1 }
// Explicit local fixture: 411..1334 computes 81; the old 61..1334 computes 63
// and cannot offer a fresh Research Plan under the latest source 80-point gate.
const failedSecondParameters = { ...firstParameters, sl: -3, tp: 8, rsiTh: 36, trendFilter: false }
const secondParameters = { ...failedSecondParameters, startI: 411 }

function makeTurn(id: string, pair: string, timeframe: string, parameters: typeof firstParameters, offset: number): ClientTurn {
  const question = `${pair} ${timeframe} 손절 ${parameters.sl}%, 익절 ${parameters.tp}%`
  return { id, question, answer: '조건별 검증 결과를 확인해주세요.', fullAnswer: '조건별 검증 결과를 확인해주세요.',
    phase: 'plan', status: 'done', suggestions: [], startedAt: 1_700_000_000_000 + offset, finishedAt: 1_700_000_002_000 + offset,
    inlineRequest: { pair, timeframe, parameters } }
}
function resultOf(turn: ClientTurn, ordinal: number): InlineBacktestRecord {
  return { ...turn.inlineRequest!, turnId: turn.id, ordinal, completedAt: turn.finishedAt! + 1_100 }
}
const firstTurn = makeTurn('plan-eth-result', 'ETH/USDT', '1시간봉', firstParameters, 0)
const secondTurn = makeTurn('plan-btc-result', 'BTC/USDT', '일봉', secondParameters, 10_000)
const otherTurn = makeTurn('plan-other-btc-result', 'BTC/USDT', '일봉', firstParameters, 20_000)
const firstResult = resultOf(firstTurn, 1), secondResult = resultOf(secondTurn, 2), otherResult = resultOf(otherTurn, 1)
const current: ClientSession = {
  id: sessionId, title: '같은 대화의 두 결과', renamed: true, idea: secondTurn.question, draft,
  pair: 'BTC/USDT', timeframe: '일봉', mode: 'dip', risk: '−3%', takeProfit: '+8%', phase: 'plan',
  researchStatus: '초안', workspace: 'conversation', tradingReady: false, turns: [firstTurn, secondTurn],
  inlineResults: [firstResult, secondResult], updatedAt: secondResult.completedAt,
}
const other: ClientSession = { ...current, id: otherId, title: '별도 대화의 연구', draft: otherDraft, idea: otherTurn.question,
  timeframe: '일봉', mode: 'trend', risk: '−5%', takeProfit: '+12%', turns: [otherTurn], inlineResults: [otherResult], updatedAt: otherResult.completedAt }

// Keep the expected key independent of the implementation helper under test.
const scope = (id: string, turnId: string) => `inline-plan:${JSON.stringify([id, turnId])}`
const firstScope = scope(sessionId, firstTurn.id), secondScope = scope(sessionId, secondTurn.id), otherScope = scope(otherId, otherTurn.id)
const replayKey = (scope: string) => `teth-research-preview:restored:${scope}`
const documentKey = (scope: string) => `teth-client-research-documents:${scope}`
const legacyReplay = JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [], clockVersion: 1 })
const legacyDocuments = JSON.stringify({ active: 'plan', tabs: ['plan'], drafts: { plan: '기존 legacy 문서 초안' }, rowDrafts: {}, replies: [], positions: {}, edits: {}, paper: false, paused: false })
type Replay = { seconds: number; status: 'idle' | 'playing' | 'paused' | 'completed'; clockStartedAt?: number }
type SavedSession = ClientSession & { researchPlanTurnId?: string; researchPlanTurnIds?: string[] }

async function setup(page: Page, shared = false) {
  const requests: string[] = []
  await page.route('**/api/**', route => { requests.push(route.request().url()); return route.abort('failed') })
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) && !requests.includes(request.url())) requests.push(request.url()) })
  await page.clock.install({ time: new Date('2026-09-16T12:00:00Z') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, experienceKey, current, other, legacyReplay, legacyDocuments }) => {
    if (sessionStorage.getItem('research-plan-lifecycle-seeded')) return
    sessionStorage.setItem('research-plan-lifecycle-seeded', 'true')
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem('tethCurrency', 'KRW')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '연구 수명 검수', email: owner }))
    sessionStorage.setItem(experienceKey, JSON.stringify({ currentId: current.id, homeDraft: '홈 초안 보존', sessions: [current, other], sharedFollows: [] }))
    sessionStorage.setItem(`teth-research-preview:restored:${current.id}`, legacyReplay)
    sessionStorage.setItem(`teth-client-research-documents:${current.id}`, legacyDocuments)
  }, { owner, experienceKey, current: shared ? { ...current, sharedCopy: { owner, nick: '원작자', active: false, confirmedAt: 1_700_000_000_000, returnId: otherId } } : current, other, legacyReplay, legacyDocuments })
  await page.goto('/')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000))
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  return requests
}
async function replay(page: Page, scope: string): Promise<Replay | null> {
  return page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? 'null'), replayKey(scope))
}
async function openPlan(page: Page, turnId: string, id = sessionId) {
  await page.locator(`.client-inline-backtest[data-turn-id="${turnId}"]`).getByRole('button', { name: '연구 계획서 크게 보기', exact: true }).click()
  await expect(page.locator('.client-restored-research')).toBeVisible()
  const state = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), experienceKey)
  expect(state.currentId).toBe(id)
  expect(state.sessions.find((item: SavedSession) => item.id === id)).toMatchObject({ workspace: 'research', researchPlanTurnId: turnId })
}
async function showPlan(page: Page) {
  await page.getByRole('tab', { name: '연구 계획', exact: true }).click()
  await expect(page.getByRole('heading', { name: '연구 계획', exact: true })).toBeVisible()
}
async function back(page: Page, expectedDraft = draft) {
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toHaveValue(expectedDraft)
}
const start = (page: Page) => page.getByRole('button', { name: '연구 시작', exact: true })
const blocked = (page: Page) => page.getByText(/^다른 연구가 진행 중이에요:/)
async function assertOriginals(page: Page) {
  const state = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), experienceKey)
  expect(state.sessions).toHaveLength(2)
  expect(state.sessions.find((item: SavedSession) => item.id === sessionId)).toMatchObject({ draft, turns: [firstTurn, secondTurn], inlineResults: [firstResult, secondResult] })
  expect(state.sessions.find((item: SavedSession) => item.id === otherId)).toMatchObject({ draft: otherDraft, turns: [otherTurn], inlineResults: [otherResult] })
  expect(state.homeDraft).toBe('홈 초안 보존')
  expect(await page.evaluate(key => sessionStorage.getItem(key), replayKey(sessionId))).toBe(legacyReplay)
  expect(await page.evaluate(key => sessionStorage.getItem(key), documentKey(sessionId))).toBe(legacyDocuments)
}

test('같은 대화의 ETH·BTC 계획은 문서·시계를 분리하고 선행 연구 종료 뒤에만 새 연구를 시작한다', async ({ page }) => {
  const requests = await setup(page)
  await openPlan(page, firstTurn.id)
  await expect(page.locator('.rw-workspace .meta')).toContainText('ETH/USDT, 1시간봉')
  await expect(page.locator('.g-row').filter({ has: page.locator('.k', { hasText: /^손절$/ }) }).locator('.v')).toHaveText(/[−-]5%/)
  await expect(page.locator('.g-row').filter({ has: page.locator('.k', { hasText: /^익절$/ }) }).locator('.v')).toContainText('12%')
  await expect(page.locator('.rw-composer textarea')).toHaveValue('')
  await page.locator('.rw-composer textarea').fill(firstDraft)
  await start(page).click()
  await expect(page.locator('.rw-title')).toContainText('연구 진행 중')
  const first = await replay(page, firstScope)
  expect(first).toMatchObject({ status: 'playing', clockStartedAt: expect.any(Number) })
  await page.clock.fastForward(12_000)
  await back(page)
  await openPlan(page, firstTurn.id)
  expect((await replay(page, firstScope))?.clockStartedAt).toBe(first!.clockStartedAt)
  await showPlan(page)
  await expect(page.locator('.rw-composer textarea')).toHaveValue(firstDraft)
  await expect(start(page)).toHaveCount(0)
  await back(page)

  await openPlan(page, secondTurn.id)
  await expect(page.locator('.rw-workspace .meta')).toContainText('BTC/USDT, 일봉')
  await expect(page.locator('.g-row').filter({ has: page.locator('.k', { hasText: /^손절$/ }) }).locator('.v')).toHaveText(/[−-]3%/)
  await expect(page.locator('.rw-composer textarea')).toHaveValue('')
  await page.locator('.rw-composer textarea').fill(secondDraft)
  const beforeSecond = await replay(page, secondScope)
  expect(beforeSecond?.status ?? 'idle').toBe('idle')
  await start(page).click()
  await expect(blocked(page)).toContainText('완료 후 시작할 수 있어요')
  const control = await start(page).boundingBox(), documentViewport = await page.locator('.rw-scroll').boundingBox()
  expect(control).not.toBeNull(); expect(documentViewport).not.toBeNull()
  expect(control!.y).toBeGreaterThanOrEqual(documentViewport!.y - 1)
  expect(control!.y + control!.height).toBeLessThanOrEqual(documentViewport!.y + documentViewport!.height + 1)
  await expect(start(page)).toBeVisible()
  await expect(page.locator('.rw-title')).not.toContainText('연구 진행 중')
  expect((await replay(page, secondScope))?.status ?? 'idle').toBe('idle')
  expect((await replay(page, secondScope))?.clockStartedAt).toBeUndefined()
  expect((await replay(page, firstScope))?.clockStartedAt).toBe(first!.clockStartedAt)

  // The running first scope is unmounted. Starting another scope must catch it
  // up from wall time rather than trusting a stale session researchStatus.
  await page.clock.fastForward(95_000)
  await start(page).click()
  await expect(page.locator('.rw-title')).toContainText('연구 진행 중')
  const second = await replay(page, secondScope)
  expect(second).toMatchObject({ status: 'playing', clockStartedAt: expect.any(Number) })
  expect(second!.clockStartedAt).toBeGreaterThan(first!.clockStartedAt!)
  expect(await replay(page, firstScope)).toMatchObject({ status: 'completed', seconds: 95, clockStartedAt: first!.clockStartedAt })
  await back(page)
  await openPlan(page, firstTurn.id)
  await showPlan(page)
  await expect(page.locator('.rw-composer textarea')).toHaveValue(firstDraft)
  await expect(start(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: '연구 과정 보기', exact: true })).toBeVisible()
  await assertOriginals(page)
  const state = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), experienceKey)
  expect(state.sessions.find((item: SavedSession) => item.id === sessionId).researchPlanTurnIds).toEqual([firstTurn.id, secondTurn.id])

  await page.reload()
  await expect(page.locator('.rw-composer textarea')).toHaveValue(firstDraft)
  expect(await replay(page, firstScope)).toMatchObject({ status: 'completed', seconds: 95, clockStartedAt: first!.clockStartedAt })
  await back(page)
  await openPlan(page, secondTurn.id)
  await showPlan(page)
  await expect(page.locator('.rw-composer textarea')).toHaveValue(secondDraft)
  expect((await replay(page, secondScope))?.clockStartedAt).toBe(second!.clockStartedAt)
  await assertOriginals(page)
  expect(requests).toEqual([])
})

test('다른 대화의 연구도 진행 중이면 새 계획의 시작을 막고 완료 후 허용한다', async ({ page }, testInfo) => {
  const requests = await setup(page)
  await openPlan(page, firstTurn.id)
  await start(page).click()
  const first = await replay(page, firstScope)
  await page.clock.fastForward(10_000)
  await back(page)
  await page.locator((page.viewportSize()?.width ?? 1280) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  await page.locator('.client-session').filter({ hasText: other.title }).click()
  await expect(page.locator('.g-composer textarea')).toHaveValue(otherDraft)
  await openPlan(page, otherTurn.id, otherId)
  await start(page).click()
  await expect(blocked(page)).toContainText('완료 후 시작할 수 있어요')
  await page.screenshot({ path: testInfo.outputPath('research-start-feedback.png') })
  await expect(start(page)).toBeVisible()
  expect((await replay(page, otherScope))?.status ?? 'idle').toBe('idle')
  expect((await replay(page, firstScope))?.clockStartedAt).toBe(first!.clockStartedAt)
  await page.clock.fastForward(95_000)
  await start(page).click()
  await expect(page.locator('.rw-title')).toContainText('연구 진행 중')
  expect(await replay(page, firstScope)).toMatchObject({ status: 'completed', seconds: 95 })
  const started = await replay(page, otherScope)
  expect(started).toMatchObject({ status: 'playing', clockStartedAt: expect.any(Number) })
  await page.reload()
  await expect(page.locator('.rw-title')).toContainText('연구 진행 중')
  expect((await replay(page, otherScope))?.clockStartedAt).toBe(started!.clockStartedAt)
  await assertOriginals(page)
  expect(requests).toEqual([])
})

test('공유 복제 대화의 계획에서 뒤로 가면 이전 원작자 대화가 아닌 현재 결과와 초안으로 돌아온다', async ({ page }) => {
  const requests = await setup(page, true)
  await openPlan(page, firstTurn.id)
  await page.locator('.rw-composer textarea').fill(firstDraft)
  await back(page)
  const state = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), experienceKey)
  expect(state.currentId).toBe(sessionId)
  expect(state.sessions.find((item: SavedSession) => item.id === sessionId).sharedCopy).toMatchObject({ owner, returnId: otherId, active: false })
  await openPlan(page, firstTurn.id)
  await expect(page.locator('.rw-composer textarea')).toHaveValue(firstDraft)
  expect(requests).toEqual([])
})

test('인라인 계획에서 기존 Research Plan으로 돌아가면 base 초안을 복원하고 selector만 제거한다', async ({ page }, testInfo) => {
  const requests = await setup(page)
  const before = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), experienceKey)
  await openPlan(page, firstTurn.id)
  await page.locator('.rw-composer textarea').fill(firstDraft)
  await back(page)
  const baseAction = page.locator('.client-next-actions').getByRole('button', { name: /이전 연구 문서/ })
  await expect(baseAction).toBeVisible()
  // Only the old research document entry returns. An inline journey must not
  // accidentally regain the unrelated legacy delegation path as a side effect.
  await expect(page.locator('.client-next-actions button')).toHaveCount(1)
  await baseAction.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('base-research-return-action.png') })
  await baseAction.click()
  await expect(page.locator('.client-restored-research')).toBeVisible()
  await expect(page.locator('.rw-tabs [aria-selected="true"]')).toBeFocused()
  await expect(page.locator('.rw-composer textarea')).toHaveValue('기존 legacy 문서 초안')
  await page.screenshot({ path: testInfo.outputPath('base-research-return-document.png') })
  await expect(page.locator('.rw-workspace .meta')).toContainText('BTC/USDT, 일봉')
  const base = await page.evaluate(({ experienceKey, sessionId }) => {
    const state = JSON.parse(sessionStorage.getItem(experienceKey)!)
    const selected = state.sessions.find((s: SavedSession) => s.id === sessionId)
    return { state, ownsSelector: Object.hasOwn(selected, 'researchPlanTurnId') }
  }, { experienceKey, sessionId })
  expect(base.ownsSelector).toBe(false)
  expect(base.state.currentId).toBe(sessionId)
  expect(base.state.sessions.find((s: SavedSession) => s.id === sessionId)).toMatchObject({
    workspace: 'research', researchPlanTurnIds: [firstTurn.id], draft, turns: [firstTurn, secondTurn], inlineResults: [firstResult, secondResult],
  })
  expect(base.state.sessions.find((s: SavedSession) => s.id === otherId)).toEqual(before.sessions.find((s: SavedSession) => s.id === otherId))
  expect(base.state.homeDraft).toBe(before.homeDraft)
  expect(await page.evaluate(key => sessionStorage.getItem(key), replayKey(sessionId))).toBe(legacyReplay)
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).drafts.plan, documentKey(firstScope))).toBe(firstDraft)

  await back(page)
  await openPlan(page, firstTurn.id)
  await expect(page.locator('.rw-composer textarea')).toHaveValue(firstDraft)
  await expect(page.locator('.rw-workspace .meta')).toContainText('ETH/USDT, 1시간봉')
  await page.reload()
  await expect(page.locator('.rw-composer textarea')).toHaveValue(firstDraft)
  await back(page)
  await baseAction.click()
  await expect(page.locator('.rw-composer textarea')).toHaveValue('기존 legacy 문서 초안')
  await page.reload()
  await expect(page.locator('.rw-composer textarea')).toHaveValue('기존 legacy 문서 초안')
  const restored = await page.evaluate(({ experienceKey, sessionId }) => {
    const state = JSON.parse(sessionStorage.getItem(experienceKey)!)
    const selected = state.sessions.find((s: SavedSession) => s.id === sessionId)
    return { state, ownsSelector: Object.hasOwn(selected, 'researchPlanTurnId') }
  }, { experienceKey, sessionId })
  expect(restored.ownsSelector).toBe(false)
  expect(restored.state.sessions.find((s: SavedSession) => s.id === sessionId)).toMatchObject({
    researchPlanTurnIds: [firstTurn.id], draft, turns: [firstTurn, secondTurn], inlineResults: [firstResult, secondResult],
  })
  expect(restored.state.homeDraft).toBe(before.homeDraft)
  expect(requests).toEqual([])
})

test('유효 base 캐시가 없는 inline-only 대화에는 기존 Research Plan CTA를 만들지 않는다', async ({ page }) => {
  const requests = await setup(page)
  await page.evaluate(keys => { for (const key of keys) sessionStorage.removeItem(key) }, [replayKey(sessionId), documentKey(sessionId)])
  // Reload clears the real preview's memory map; no helper/store method is
  // replaced to hide an otherwise valid legacy plan from the UI.
  await page.reload()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  const baseAction = page.locator('.client-next-actions').getByRole('button', { name: /이전 연구 문서/ })
  await expect(baseAction).toHaveCount(0)
  await expect(page.locator('.client-next-actions button')).toHaveCount(0)
  for (const turnId of [firstTurn.id, secondTurn.id]) {
    await expect(page.locator(`.client-inline-backtest[data-turn-id="${turnId}"]`).getByRole('button', { name: '연구 계획서 크게 보기', exact: true })).toBeVisible()
  }
  await openPlan(page, firstTurn.id)
  await page.locator('.rw-composer textarea').fill(firstDraft)
  await back(page)
  await expect(baseAction).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(baseAction).toHaveCount(0)
  await openPlan(page, firstTurn.id)
  await expect(page.locator('.rw-composer textarea')).toHaveValue(firstDraft)
  const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), experienceKey)
  expect(saved.sessions.find((s: SavedSession) => s.id === sessionId)).toMatchObject({
    researchPlanTurnId: firstTurn.id, researchPlanTurnIds: [firstTurn.id], draft, turns: [firstTurn, secondTurn], inlineResults: [firstResult, secondResult],
  })
  expect(saved.homeDraft).toBe('홈 초안 보존')
  expect(requests).toEqual([])
})

 test('80점 미달인 이전 두 번째 조건은 계획 CTA·연구 실행을 만들지 않고 원기록을 보존한다', async ({ page }) => {
  expect(evaluateDelegation(failedSecondParameters, 5_000_000).score).toBe(63)
  expect(evaluateDelegation(secondParameters, 5_000_000).score).toBe(81)
  await setup(page)
  await page.addInitScript(({ key, sessionId, failed }) => {
    if (sessionStorage.getItem('failed-score-fixture-installed')) return
    sessionStorage.setItem('failed-score-fixture-installed', 'true')
    const saved = JSON.parse(sessionStorage.getItem(key)!)
    const session = saved.sessions.find((s: { id: string }) => s.id === sessionId)
    session.turns[1].inlineRequest.parameters = failed
    session.inlineResults[1].parameters = failed
    sessionStorage.setItem(key, JSON.stringify(saved))
  }, { key: experienceKey, sessionId, failed: failedSecondParameters })
  await page.reload()
  const card = page.locator(`.client-inline-backtest[data-turn-id="${secondTurn.id}"]`)
  await expect(card.locator('.sc b')).toHaveText('63')
  await expect(card.getByRole('button', { name: '연구 계획서 크게 보기', exact: true })).toHaveCount(0)
  const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), experienceKey)
  expect(saved.sessions.find((s: { id: string }) => s.id === sessionId).inlineResults[1].parameters).toEqual(failedSecondParameters)
})
