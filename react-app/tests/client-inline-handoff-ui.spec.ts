import { expect, test, type Page } from '@playwright/test'
import type { ClientSession, ClientTurn } from '../src/client-experience-store'
import type { InlineBacktestRecord } from '../src/client-inline-backtest'
import type { SharedFollowRecord } from '../src/client-shared-follow'
import { sourceTerminalPrices } from '../src/client-terminal-source-fixture'

// Public source preview only: selected conversation evidence is authoritative
// for this local handoff, never for an actual account, payment or order.
const experienceKey = 'teth-client-experience'
const owner = 'inline-handoff@example.test'
const sessionId = 'inline-handoff-current'
const priorId = 'inline-handoff-return'
const turnId = 'inline-handoff-eth-turn'
const followId = 'inline-handoff-follow'
const delegationKey = `teth:client-delegation:${sessionId}`
const registrationKey = `teth-client-user-strategies:${encodeURIComponent(owner)}`
const draft = '새 ETH 결과 뒤에도 남길 미전송 질문'
const previousDraft = '다른 BTC 대화에서 보존할 초안'
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: sourceTerminalPrices.length - 1 }
const oldParameters = { ...parameters, sl: -3, tp: 8, rsiTh: 36, trendFilter: false }
const turn: ClientTurn = {
  id: turnId, question: 'ETH 추세 1시간봉 손절 5%, 익절 12%',
  answer: '새 조건을 검증했어요.', fullAnswer: '새 조건을 검증했어요.',
  status: 'done', phase: 'plan', suggestions: [], startedAt: 1_700_000_000_000, finishedAt: 1_700_000_002_000,
  inlineRequest: { pair: 'ETH/USDT', timeframe: '1시간봉', parameters },
}
const record: InlineBacktestRecord = {
  turnId, ordinal: 1, pair: 'ETH/USDT', timeframe: '1시간봉', parameters, completedAt: turn.finishedAt! + 1_100,
}
const current: ClientSession = {
  id: sessionId, title: '공유 전략에서 바꾼 ETH 조건', renamed: true, idea: turn.question, draft,
  pair: 'ETH/USDT', mode: 'trend', timeframe: '1시간봉', risk: '−5%', takeProfit: '+12%',
  researchStatus: '초안', phase: 'plan', turns: [turn], updatedAt: 1_700_000_003_100,
  workspace: 'conversation', tradingReady: false, inlineResults: [record],
  sharedCopy: { owner, nick: '원본 팔로우', confirmedAt: 1_700_000_000_000, returnId: priorId, active: true, followId },
}
const prior: ClientSession = {
  ...current, id: priorId, title: '다른 BTC 대화', idea: 'BTC 반등', draft: previousDraft,
  pair: 'BTC/USDT', mode: 'dip', turns: [], inlineResults: [], sharedCopy: undefined,
}
const follow: SharedFollowRecord = {
  id: followId, owner, nick: '원본 팔로우', asset: '비트코인', parameters: oldParameters,
  budgetIndex: 2, confirmedAt: 1_700_000_000_000, sessionId, active: true,
}
const unrelated: SharedFollowRecord = { ...follow, id: 'unrelated-follow', owner: 'another@example.test', sessionId: 'unrelated-session' }
const oldDelegation = {
  page: 'report', questionIndex: 5, attempt: 2, workStep: 5, expert: false, chartInterval: '1D', parameters: oldParameters,
  answers: { asset: { index: 0 }, style: { index: 0 }, budget: { index: 2 }, period: { index: 2 }, stop: { index: 0 } },
}
type Persisted = { currentId: string; homeDraft: string; sessions: (ClientSession & { inlineConnectionTurnId?: string })[]; sharedFollows: SharedFollowRecord[] }

async function open(page: Page) {
  await page.clock.install()
  const requests: string[] = []
  await page.route('**/api/**', route => { requests.push(route.request().url()); return route.abort('failed') })
  page.on('request', request => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) && !requests.includes(request.url())) requests.push(request.url())
  })
  await page.addInitScript(({ experienceKey, owner, sessionId, current, prior, follow, unrelated, delegationKey, oldDelegation }) => {
    // Reload must restore the actual user transition, never reinject this fixture.
    if (sessionStorage.getItem('inline-handoff-seeded')) return
    sessionStorage.setItem('inline-handoff-seeded', 'true')
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem('tethCurrency', 'KRW')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '인라인 인계 검수', email: owner }))
    sessionStorage.setItem(experienceKey, JSON.stringify({ currentId: sessionId, homeDraft: '홈 초안 보존', sessions: [current, prior], sharedFollows: [follow, unrelated] }))
    sessionStorage.setItem(delegationKey, JSON.stringify(oldDelegation))
  }, { experienceKey, owner, sessionId, current, prior, follow, unrelated, delegationKey, oldDelegation })
  await page.goto('/')
  await expect(page.locator('.client-inline-backtest[data-turn-id="' + turnId + '"]')).toBeVisible()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  return requests
}

const execute = (page: Page) => page.getByRole('button', { name: '이 전략 실행하기', exact: true })
async function settleViewportBeforeTransaction(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  // Finish the existing viewport debounce, then freeze elapsed time so
  // the assertions measure the explicit transaction, including failed writes.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
}
async function saved(page: Page): Promise<Persisted> {
  return page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), experienceKey)
}
async function observeWrites(page: Page, blockedKey: string | null = null) {
  await page.evaluate(({ experienceKey, blockedKey }) => {
    const original = Storage.prototype.setItem
    const writes: string[] = []
    Storage.prototype.setItem = function (key, value) {
      if (this === sessionStorage && key === blockedKey) throw new DOMException('Synthetic handoff write failure', 'QuotaExceededError')
      const result = original.call(this, key, value)
      if (this === sessionStorage && key === experienceKey) writes.push(value)
      return result
    }
    Object.assign(window, { handoffWrites: writes, restoreHandoffWrites: () => { Storage.prototype.setItem = original } })
  }, { experienceKey, blockedKey })
}
async function expectHandoff(page: Page) {
  await expect(page.getByRole('heading', { name: '어떻게 실행할까요?', exact: true })).toBeVisible()
  await expect(page.locator('.client-delegation')).toHaveAttribute('data-session', sessionId)
  const state = await saved(page), selected = state.sessions.find(item => item.id === sessionId)!
  expect(state.currentId).toBe(sessionId)
  expect(selected).toMatchObject({ workspace: 'delegation', inlineConnectionTurnId: turnId, draft, inlineResults: [record], sharedCopy: { ...current.sharedCopy, active: false } })
  expect(state.sharedFollows).toEqual([{ ...follow, active: false }, unrelated])
  expect(state.sessions.find(item => item.id === priorId)).toMatchObject({ id: priorId, pair: 'BTC/USDT', draft: previousDraft, turns: [], inlineResults: [] })
  expect(state.homeDraft).toBe('홈 초안 보존')
}
async function expectConversation(page: Page) {
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(page.locator('.client-inline-backtest[data-turn-id="' + turnId + '"] .gbt[data-rpt="1"]')).toBeVisible()
  const state = await saved(page)
  expect(state.currentId).toBe(sessionId)
  expect(state.sessions.find(item => item.id === sessionId)).toMatchObject({ workspace: 'conversation', draft, inlineResults: [record], turns: [turn] })
  expect(state.sessions.find(item => item.id === priorId)?.draft).toBe(previousDraft)
  expect(state.sharedFollows).toEqual([{ ...follow, active: false }, unrelated])
}
async function noOverflow(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
}
async function expectEthProjection(page: Page) {
  await expect.poll(() => page.evaluate(async sessionId => {
    const path = '/src/client-delegation-fixtures.ts'
    const { readDelegationUi } = await import(/* @vite-ignore */ path)
    return readDelegationUi(sessionId)
  }, sessionId)).toMatchObject({ inlineResult: true, inlineTurnId: turnId, parameters, answers: { asset: { index: 1, label: '이더리움' }, budget: { index: 1 } } })
}

for (const width of [320, 1440]) test(`${width}px active 공유 대화의 새 ETH 결과는 원자적 인계·뒤로·reload에도 같은 결과와 초안을 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const requests = await open(page)
  await expect(execute(page)).toBeEnabled()
  await execute(page).scrollIntoViewIfNeeded()
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath(`inline-handoff-${width}-result.png`), fullPage: true })
  await execute(page).focus()
  await expect(execute(page)).toBeFocused()
  // Finish the pre-existing 250ms scroll-position persistence before measuring
  // the explicit handoff transaction; it is not an extra connection mutation.
  await settleViewportBeforeTransaction(page)
  await observeWrites(page)
  await page.keyboard.press('Enter')
  await expectHandoff(page)
  const writes = await page.evaluate(() => Reflect.get(window, 'handoffWrites') as string[])
  expect(writes).toHaveLength(1)
  const committed = JSON.parse(writes[0]) as Persisted
  expect(committed.sessions.find(item => item.id === sessionId)).toMatchObject({ inlineConnectionTurnId: turnId, workspace: 'delegation', sharedCopy: { active: false } })
  expect(committed.sharedFollows).toEqual([{ ...follow, active: false }, unrelated])
  await expectEthProjection(page)
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath(`inline-handoff-${width}-connection.png`), fullPage: true })
  await page.reload()
  await expectHandoff(page)
  await expectEthProjection(page)
  const back = page.locator('.client-delegation').getByRole('button', { name: '뒤로', exact: true })
  await back.focus()
  await expect(back).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.tf-report-page')).toBeVisible()
  const edit = page.locator('.tf-report-page').getByRole('button', { name: '전략 수정', exact: true })
  await edit.focus()
  await expect(edit).toBeFocused()
  await page.keyboard.press('Enter')
  await expectConversation(page)
  // The report cache is a presentation preference, not an instruction to
  // reopen the report after the user explicitly chooses execution again.
  await execute(page).click()
  await expectHandoff(page)
  await expect(page.locator('.tf-report-page')).toHaveCount(0)
  await page.locator('.client-delegation').getByRole('button', { name: '뒤로', exact: true }).click()
  await page.locator('.tf-report-page').getByRole('button', { name: '전략 수정', exact: true }).click()
  await expectConversation(page)
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath(`inline-handoff-${width}-returned.png`), fullPage: true })
  await page.reload()
  await expectConversation(page)
  expect(requests).toEqual([])
})

test('연결근거가손상된일반실행은같은대화로이어지며남은캐시를실행하지않는다', async ({ page }) => {
  const requests = await open(page)
  await execute(page).click()
  await expectHandoff(page)
  await page.addInitScript(({ experienceKey, sessionId }) => {
    if (sessionStorage.getItem('inline-handoff-lost-evidence')) return
    sessionStorage.setItem('inline-handoff-lost-evidence', 'true')
    const state = JSON.parse(sessionStorage.getItem(experienceKey)!)
    const target = state.sessions.find((item: { id: string }) => item.id === sessionId)
    target.inlineResults = []
    delete target.turns[0].inlineRequest
    sessionStorage.setItem(experienceKey, JSON.stringify(state))
  }, { experienceKey, sessionId })
  await page.reload()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  const before = await saved(page), previous = before.sessions.find(item => item.id === sessionId)!
  const cache = await page.evaluate(key => sessionStorage.getItem(key), delegationKey)
  const input = await page.locator('.g-composer textarea').elementHandle()
  await page.getByRole('button', { name: /^전략 맡기기/ }).click()
  await expect.poll(async () => (await saved(page)).sessions.find(item => item.id === sessionId)?.turns.at(-1)?.question).toBe('전략 맡기기')
  await expect.poll(async () => (await saved(page)).sessions.find(item => item.id === sessionId)?.turns.at(-1)?.status).toBe('done')
  const after = await saved(page), current = after.sessions.find(item => item.id === sessionId)!
  expect(after.currentId).toBe(sessionId)
  expect(current.workspace).toBe('conversation')
  expect(current.turns.slice(0, -1)).toEqual(previous.turns)
  expect(current.turns).toHaveLength(previous.turns.length + 1)
  expect(current.inlineResults).toEqual(previous.inlineResults)
  expect(current.turns.at(-1)?.inlineRequest).toBeUndefined()
  expect(current.turns.at(-1)?.sourceIntake).toBeUndefined()
  expect(after.sharedFollows).toEqual(before.sharedFollows)
  expect(after.sessions.find(item => item.id === priorId)).toEqual(before.sessions.find(item => item.id === priorId))
  expect(await page.evaluate(key => sessionStorage.getItem(key), delegationKey)).toBe(cache)
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  expect(await page.locator('.g-composer textarea').evaluate((node, original) => node === original, input)).toBe(true)
  await expect(page.locator('.client-delegation')).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBeNull()
  expect(requests).toEqual([])
})

test('저장 확인이 불가능하면 메뉴를 가리지 않는 안내를 유지하고 연구·삭제는 보존적으로 거절한다', async ({ page }, info) => {
  await open(page)
  await execute(page).focus()
  await settleViewportBeforeTransaction(page)
  await page.evaluate(key => {
    const set = Storage.prototype.setItem, get = Storage.prototype.getItem
    let awaitingReadback = false
    Storage.prototype.setItem = function (name, value) {
      set.call(this, name, value)
      if (this === sessionStorage && name === key) awaitingReadback = true
    }
    Storage.prototype.getItem = function (name) {
      if (this === sessionStorage && name === key && awaitingReadback) {
        awaitingReadback = false
        throw new DOMException('Synthetic readback failure', 'SecurityError')
      }
      return get.call(this, name)
    }
  }, experienceKey)
  await page.keyboard.press('Enter')
  const persistent = page.getByRole('alert').filter({ hasText: '추가 변경 전에 새로고침' })
  await expect(persistent).toBeVisible()
  const transient = page.locator('.client-global-notice[role="status"]').filter({ hasText: '저장 여부를 확인할 수 없어요.' })
  await expect(transient).toHaveCount(0)
  await expect(persistent).toBeVisible()
  await expect(persistent.getByRole('button')).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(page.locator('.client-delegation')).toHaveCount(0)
  const before = await page.evaluate(({ experienceKey, delegationKey }) => ({ experience: sessionStorage.getItem(experienceKey), cache: sessionStorage.getItem(delegationKey) }), { experienceKey, delegationKey })
  await page.getByRole('button', { name: '연구 계획서 크게 보기', exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await page.getByRole('button', { name: '대화 메뉴', exact: true }).click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await page.getByRole('button', { name: '정말 삭제할까요? 되돌릴 수 없어요', exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(page.getByText('목록에서 제거했지만 저장소의 일부 기록을 삭제하지 못했습니다.', { exact: true })).toHaveCount(0)
  await expect(persistent).toBeVisible()
  await page.screenshot({ path: info.outputPath('inline-quarantine-readable.png') })
  expect(await page.evaluate(({ experienceKey, delegationKey }) => ({ experience: sessionStorage.getItem(experienceKey), cache: sessionStorage.getItem(delegationKey) }), { experienceKey, delegationKey })).toEqual(before)
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBeNull()
})

for (const nextOwner of ['handoff-other@example.test', null]) test(`${nextOwner ?? 'guest'}: 다른 소유자의 저장된 인라인 연결은 복원으로 계정 검사를 우회하지 않는다`, async ({ page }) => {
  const requests = await open(page)
  await execute(page).click()
  await expectHandoff(page)
  const before = await saved(page)
  await page.addInitScript(nextOwner => {
    if (nextOwner) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '다른 계정', email: nextOwner }))
    else sessionStorage.removeItem('teth-client-profile-preview')
  }, nextOwner)
  await page.reload()
  await expect(page.getByRole('heading', { name: '현재 계정의 전략 기록을 다시 확인해주세요.', exact: true })).toBeVisible()
  await expect(page.locator('.client-delegation')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '무료로 시작', exact: true })).toHaveCount(0)
  const after = await saved(page)
  expect(after.sharedFollows).toEqual(before.sharedFollows)
  expect(after.sessions.find(item => item.id === sessionId)?.inlineResults).toEqual([record])
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBeNull()
  expect(requests).toEqual([])
})

test('등록 기록을 읽지 못하면 미등록으로 오인해 팔로우를 해제하지 않는다', async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, '{broken-registration'), registrationKey)
  const requests = await open(page)
  await execute(page).scrollIntoViewIfNeeded()
  await settleViewportBeforeTransaction(page)
  const before = await saved(page)
  const cache = await page.evaluate(key => sessionStorage.getItem(key), delegationKey)
  await observeWrites(page)
  await execute(page).click()
  await expect(page.getByRole('status').filter({ hasText: '기존 전략을 불러오지 못했어요. 저장 상태를 확인한 뒤 다시 시도해주세요.' })).toBeVisible()
  expect(await saved(page)).toEqual(before)
  expect(await page.evaluate(key => sessionStorage.getItem(key), delegationKey)).toBe(cache)
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBe('{broken-registration')
  expect(await page.evaluate(() => Reflect.get(window, 'handoffWrites'))).toEqual([])
  await expect(page.locator('.client-delegation')).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  expect(requests).toEqual([])
})

test('experience 저장 실패는 active 팔로우·BTC 캐시·대화 원문을 보존하고 명시 CTA 재시도만 인계한다', async ({ page }) => {
  const requests = await open(page)
  await execute(page).scrollIntoViewIfNeeded()
  await settleViewportBeforeTransaction(page)
  const before = await page.evaluate(({ experienceKey, delegationKey }) => ({ experience: sessionStorage.getItem(experienceKey), delegation: sessionStorage.getItem(delegationKey) }), { experienceKey, delegationKey })
  await observeWrites(page, experienceKey)
  await execute(page).click()
  await expect(page.getByRole('status').filter({ hasText: '검증 결과를 연결하지 못했어요' })).toBeVisible()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(execute(page)).toBeEnabled()
  await expect(page.locator('.client-delegation')).toHaveCount(0)
  expect(await page.evaluate(({ experienceKey, delegationKey }) => ({ experience: sessionStorage.getItem(experienceKey), delegation: sessionStorage.getItem(delegationKey) }), { experienceKey, delegationKey })).toEqual(before)
  expect((await saved(page)).sharedFollows).toEqual([follow, unrelated])
  await page.evaluate(() => Reflect.get(window, 'restoreHandoffWrites')())
  await observeWrites(page)
  await execute(page).click()
  await expectHandoff(page)
  expect(await page.evaluate(() => Reflect.get(window, 'handoffWrites').length)).toBe(1)
  await page.reload()
  await expectHandoff(page)
  expect(requests).toEqual([])
})

test('오래된 BTC delegation 캐시의 저장이 막혀도 새 ETH 선택으로 등록하며 reload는 중복 등록하지 않는다', async ({ page }) => {
  const requests = await open(page)
  const oldBytes = await page.evaluate(key => sessionStorage.getItem(key), delegationKey)
  await observeWrites(page, delegationKey)
  await execute(page).click()
  await expectHandoff(page)
  expect(await page.evaluate(key => sessionStorage.getItem(key), delegationKey)).toBe(oldBytes)
  await page.getByRole('button', { name: '무료로 시작', exact: true }).click()
  await page.getByRole('button', { name: 'OKX', exact: true }).click()
  await page.getByRole('button', { name: '가입 완료했어요', exact: true }).click()
  await page.getByLabel('OKX UID', { exact: true }).fill('8765432109')
  await page.getByRole('button', { name: '연동 확인하기', exact: true }).click()
  await page.getByLabel('API Key', { exact: true }).fill('HANDOFF_FAKE_KEY_Z7Q6')
  await page.getByLabel('Secret Key', { exact: true }).fill('HANDOFF_FAKE_SECRET_Y8R5')
  await page.getByRole('button', { name: '권한 확인하고 연결하기', exact: true }).click()
  await page.getByRole('button', { name: '나중에 시작', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade\/bot\/\d+$/)
  const registered = await page.evaluate(key => sessionStorage.getItem(key), registrationKey)
  const entries = JSON.parse(registered!)
  expect(entries).toHaveLength(1)
  expect(entries[0]).toMatchObject({ sessionId, record: { asset: '이더리움', parameters, capital: 5_000_000, status: 'ready', exchangeId: 'okx', exchangeName: 'OKX' } })
  const storage = await page.evaluate(() => Object.values({ ...localStorage, ...sessionStorage }).join('\n'))
  expect(storage).not.toMatch(/8765432109|HANDOFF_FAKE|Z7Q6|Y8R5/)
  await page.reload()
  await expect(page.getByRole('heading', { name: '이더리움 위임 전략', exact: true })).toBeVisible()
  expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBe(registered)
  expect(requests).toEqual([])
})

test('존재하지 않는 결과 selector로 reload하면 캐시 조건을 채택하지 않고 원 대화에서 명시 재선택한다', async ({ page }) => {
  const requests = await open(page)
  await execute(page).click()
  await expectHandoff(page)
  // Apply a one-time corruption after the old document's pagehide flush. Do not
  // reinject sessions/results: mutate only the persisted selection under test.
  await page.addInitScript(({ experienceKey, sessionId, delegationKey, oldDelegation }) => {
    if (sessionStorage.getItem('inline-handoff-corruption-applied')) return
    sessionStorage.setItem('inline-handoff-corruption-applied', 'true')
    const value = JSON.parse(sessionStorage.getItem(experienceKey)!)
    value.sessions.find((item: { id: string }) => item.id === sessionId).inlineConnectionTurnId = 'missing-result-turn'
    sessionStorage.setItem(experienceKey, JSON.stringify(value))
    sessionStorage.setItem(delegationKey, JSON.stringify(oldDelegation))
  }, { experienceKey, sessionId, delegationKey, oldDelegation })
  await page.reload()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(page.locator('.client-delegation')).toHaveCount(0)
  await expect(page.locator('.client-inline-backtest[data-turn-id="' + turnId + '"]')).toBeVisible()
  await expect(execute(page)).toBeEnabled()
  await execute(page).click()
  await expectHandoff(page)
  await expectEthProjection(page)
  expect(requests).toEqual([])
})
