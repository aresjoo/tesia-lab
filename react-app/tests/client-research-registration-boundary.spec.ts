import { expect, test, type Page } from '@playwright/test'
import { clientResearchRegistration } from '../src/client-research-registration'
import type { ClientSession, ClientTurn } from '../src/client-experience-store'
import type { InlineBacktestRecord } from '../src/client-inline-backtest'
import type { SourceUserStrategyRecord } from '../src/client-user-strategy'
import { sourceTerminalPrices } from '../src/client-terminal-source-fixture'

// Source-preview registration and navigation only. The fixed BTC research
// producer is not evidence that a selected ETH inline plan was researched.
const owner = 'research-registration-boundary@example.test'
const sessionId = 'research-registration-base-a'
const otherId = 'research-registration-other-b'
const turnId = 'research-registration-inline-eth'
const experienceKey = 'teth-client-experience'
const registrationKey = `teth-client-user-strategies:${encodeURIComponent(owner)}`
const selectedScope = `inline-plan:${JSON.stringify([sessionId, turnId])}`
const draft = '등록 경계에서도 보존할 대화 초안'
const runDraft = '실행 확인 문서에 작성하던 질문'
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: sourceTerminalPrices.length - 1 }
const turn: ClientTurn = { id: turnId, question: 'ETH 1시간봉 추세 손절 5%, 익절 12%', answer: '새 조건을 검증했어요.', fullAnswer: '새 조건을 검증했어요.',
  phase: 'plan', status: 'done', suggestions: [], startedAt: 1_700_000_000_000, finishedAt: 1_700_000_002_000,
  inlineRequest: { pair: 'ETH/USDT', timeframe: '1시간봉', parameters } }
const inlineResult: InlineBacktestRecord = { ...turn.inlineRequest!, turnId, ordinal: 1, completedAt: turn.finishedAt! + 1_100 }
const baseSession: ClientSession = { id: sessionId, title: '이전에 완료한 연구 A', renamed: true, idea: '기존 BTC 연구', draft, pair: 'BTC/USDT', timeframe: '일봉',
  mode: 'dip', risk: '−3%', takeProfit: '+8%', phase: 'plan', researchStatus: '검토 필요', workspace: 'research', tradingReady: true, turns: [], inlineResults: [], updatedAt: 1 }
const otherSession: ClientSession = { ...baseSession, id: otherId, title: '나중에 만든 전략 B 대화', draft: '다른 대화 초안', workspace: 'conversation', updatedAt: 2 }
const recordA: SourceUserStrategyRecord = { ...clientResearchRegistration(), id: '1000', createdAt: 1000, name: '보존할 기존 연구 A', status: 'off', version: 'v2.7' }
const recordB: SourceUserStrategyRecord = { ...clientResearchRegistration(), id: '2000', createdAt: 2000, name: '최신 전략 B', origin: 'delegation', status: 'live' }
const records = [{ sessionId, record: recordA }, { sessionId: otherId, record: recordB }]
const registrationBytes = JSON.stringify(records)
const deferredOtherOriginBytes = JSON.stringify([{ sessionId, record: { ...recordA, origin: 'delegation' } }, records[1]])
const completed = { seconds: 95, status: 'completed', view: 'activity', questions: [], clockVersion: 1 }
const documents = { active: 'run', tabs: ['report', 'run'], drafts: { run: runDraft }, rowDrafts: {}, replies: [], positions: {}, edits: {}, paper: false, paused: false }

async function setup(page: Page, options: { inline: boolean; signed: boolean; terminal?: boolean; deferredOtherOriginRestore?: boolean }) {
  const requests: string[] = []
  await page.route('**/api/**', route => { requests.push(route.request().url()); return route.abort('failed') })
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) && !requests.includes(request.url())) requests.push(request.url()) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ options, owner, experienceKey, registrationKey, registrationBytes, deferredOtherOriginBytes, baseSession, otherSession, selectedScope, turn, inlineResult, completed, documents }) => {
    if (sessionStorage.getItem('research-registration-boundary-seeded')) return
    sessionStorage.setItem('research-registration-boundary-seeded', 'true')
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem('tethCurrency', 'KRW')
    if (options.signed) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '연구 등록 검수', email: owner }))
    const current = options.inline ? { ...baseSession, pair: 'ETH/USDT', timeframe: '1시간봉', mode: 'trend', risk: '−5%', takeProfit: '+12%',
      idea: turn.question, turns: [turn], inlineResults: [inlineResult], researchPlanTurnId: turn.id, researchPlanTurnIds: [turn.id] }
      : options.deferredOtherOriginRestore ? { ...baseSession, tradingReady: false } : baseSession
    sessionStorage.setItem(experienceKey, JSON.stringify({ currentId: current.id, homeDraft: '홈 초안 보존', sessions: [current, otherSession], sharedFollows: [] }))
    // The old base registration deliberately belongs to the same conversation
    // as the selected inline result; it must not lend that result its Live UI.
    sessionStorage.setItem(registrationKey, options.deferredOtherOriginRestore ? deferredOtherOriginBytes : registrationBytes)
    for (const scope of [baseSession.id, ...(options.inline ? [selectedScope] : [])]) {
      sessionStorage.setItem(`teth-research-preview:restored:${scope}`, JSON.stringify(completed))
      sessionStorage.setItem(`teth-client-research-documents:${scope}`, JSON.stringify(documents))
    }
    if (options.deferredOtherOriginRestore) {
      // Fail only the real store's first read, not its registration method.
      // Subsequent restores see the valid, same-session delegation record.
      const audit = { reads: 0, failures: 0, writes: 0 }
      Reflect.set(window, '__researchRegistrationStorageAudit', audit)
      const getItem = Storage.prototype.getItem
      const setItem = Storage.prototype.setItem
      Storage.prototype.getItem = function (key: string) {
        if (this === sessionStorage && key === registrationKey) {
          audit.reads++
          if (audit.reads === 1) {
            audit.failures++
            throw new DOMException('First strategy read unavailable', 'SecurityError')
          }
        }
        return getItem.call(this, key)
      }
      Storage.prototype.setItem = function (key: string, value: string) {
        if (this === sessionStorage && key === registrationKey) audit.writes++
        return setItem.call(this, key, value)
      }
    }
  }, { options, owner, experienceKey, registrationKey, registrationBytes, deferredOtherOriginBytes, baseSession, otherSession, selectedScope, turn, inlineResult, completed, documents })
  await page.goto(options.terminal ? '/#/trade' : '/')
  return requests
}
async function preservedRecords(page: Page) {
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBe(registrationBytes)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('teth-client-user-strategies:')))).toEqual([registrationKey])
}
async function openResearchA(page: Page) {
  const row = page.locator('.client-session').filter({ hasText: baseSession.title })
  if (!await row.isVisible()) {
    await page.locator((page.viewportSize()?.width ?? 1280) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  }
  await row.click()
  await expect(page.getByLabel('실행 확인에 질문', { exact: true })).toHaveValue(runDraft)
  await expect(page.getByRole('button', { name: '내 트레이딩에서 열기', exact: true })).toBeVisible()
}
async function chooseB(page: Page) {
  // The current source keeps the strategy rail inside the judgment selector.
  // Reach that visible consumer before focusing its B button; focusing the
  // mounted hidden rail leaves Enter on the previously selected A control.
  const judgment = page.getByRole('tab', { name: '판단', exact: true })
  if (await judgment.isVisible()) await judgment.click()
  await page.locator('.ctt-selector-button').click()
  const select = page.locator('[data-strategy-id="user:2000"] .tft-select')
  await select.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:2000')
}

for (const signed of [true, false]) test(`${signed ? '로그인' : '게스트'}: 완료된 inline 계획도 기존 base 연구의 Live·등록 권한을 빌리지 않는다`, async ({ page }) => {
  const requests = await setup(page, { inline: true, signed })
  await expect(page.getByLabel('실행 확인에 질문', { exact: true })).toHaveValue(runDraft)
  await expect(page.locator('.rw-artifact').filter({ hasText: /^Live/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '내 트레이딩에서 열기', exact: true })).toHaveCount(0)
  const url = page.url()
  const start = page.getByRole('button', { name: '가상 검증으로 시작', exact: true })
  await start.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: '선택한 계획의 연구 결과가 아직 연결되지 않았어요.' })).toBeVisible()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.locator('.client-account-terminal')).toHaveCount(0)
  expect(page.url()).toBe(url)
  await preservedRecords(page)
  const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), experienceKey)
  expect(saved.currentId).toBe(sessionId)
  expect(saved.sessions.find((item: { id: string }) => item.id === sessionId)).toMatchObject({ workspace: 'research', researchPlanTurnId: turnId, draft, turns: [turn], inlineResults: [inlineResult] })
  await page.reload()
  await expect(page.getByLabel('실행 확인에 질문', { exact: true })).toHaveValue(runDraft)
  await expect(page.locator('.rw-artifact').filter({ hasText: /^Live/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '내 트레이딩에서 열기', exact: true })).toHaveCount(0)
  await start.click()
  await expect(page.getByRole('status').filter({ hasText: '선택한 계획의 연구 결과가 아직 연결되지 않았어요.' })).toBeVisible()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  expect(page.url()).toBe(url)
  await preservedRecords(page)
  expect(requests).toEqual([])
})

test('최초 전략 읽기 실패 뒤 등록 시 복원된 다른 origin은 연구로 열거나 덮어쓰지 않는다', async ({ page }) => {
  const requests = await setup(page, { inline: false, signed: true, deferredOtherOriginRestore: true })
  await expect(page.getByLabel('실행 확인에 질문', { exact: true })).toHaveValue(runDraft)
  await expect(page.getByRole('status').filter({ hasText: '전략 기록을 이 브라우저에 저장하거나 불러오지 못했어요.' })).toBeVisible()
  await expect(page.getByRole('button', { name: '내 트레이딩에서 열기', exact: true })).toHaveCount(0)
  const start = page.getByRole('button', { name: '가상 검증으로 시작', exact: true })
  await expect(start).toBeEnabled()
  const before = await page.evaluate(() => Reflect.get(window, '__researchRegistrationStorageAudit') as { reads: number; failures: number; writes: number })
  expect(before.failures).toBe(1)
  expect(before.writes).toBe(0)
  const url = page.url()
  await start.click()
  await expect(page.getByRole('status').filter({ hasText: '이 대화에는 다른 전략이 등록되어 있어요.' })).toBeVisible()
  await expect(page.locator('.client-account-terminal')).toHaveCount(0)
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '내 트레이딩에서 열기', exact: true })).toHaveCount(0)
  expect(page.url()).toBe(url)
  const after = await page.evaluate(() => Reflect.get(window, '__researchRegistrationStorageAudit') as { reads: number; failures: number; writes: number })
  expect(after.reads).toBeGreaterThan(before.reads)
  expect(after.failures).toBe(1)
  expect(after.writes).toBe(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBe(deferredOtherOriginBytes)
  const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), experienceKey)
  expect(saved.currentId).toBe(sessionId)
  expect(saved.sessions.find((item: { id: string }) => item.id === sessionId)).toMatchObject({ workspace: 'research', tradingReady: false, draft, turns: [], inlineResults: [] })
  await expect(page.getByLabel('실행 확인에 질문', { exact: true })).toHaveValue(runDraft)
  expect(requests).toEqual([])
})

for (const width of [320, 1440]) test(`${width}px 기존 연구 A 다시 열기는 최신 B나 수동 B 선택보다 우선하고 중지 상태를 보존한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const requests = await setup(page, { inline: false, signed: true, terminal: true })
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:2000')
  await preservedRecords(page)
  for (let attempt = 0; attempt < 2; attempt++) {
    await openResearchA(page)
    const open = page.getByRole('button', { name: '내 트레이딩에서 열기', exact: true })
    await open.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#\/trade$/)
    await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1000')
    await preservedRecords(page)
    const rows = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), registrationKey)
    expect(rows).toEqual(records)
    expect(rows[0].record).toMatchObject({ id: '1000', status: 'off', version: 'v2.7', name: recordA.name })
    if (attempt === 0) await page.screenshot({ path: test.info().outputPath(`research-selected-${width}.png`), fullPage: true })
    if (attempt === 0) await chooseB(page)
  }
  await page.reload()
  await preservedRecords(page)
  // Parent selection requests are page-local; reload need not preserve terminal
  // selection. Explicitly reopening the old research must still select A.
  await openResearchA(page)
  await page.getByRole('button', { name: '내 트레이딩에서 열기', exact: true }).click()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1000')
  await preservedRecords(page)
  expect(requests).toEqual([])
})
