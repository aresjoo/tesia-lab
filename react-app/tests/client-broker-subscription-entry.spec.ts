import { expect, test, type Page } from '@playwright/test'
import { evaluateDelegation } from '../src/client-delegation-engine'
import { openLegacySourceConsumer } from './fixtures/legacy-source-entry'

// Saved compatibility consumers + exported stores, not current Main's source
// connection/checkout path. No billing implementation is supplied by this host.
test.describe('현재 Main 밖: 보존된 구독 consumer와 표시선호 store 조립', () => {

const owner = 'broker-cycle@example.test', sessionId = 'broker-cycle-eth'
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }
const evaluated = evaluateDelegation(parameters, 5000000)
const original = { id: 'broker-cycle-other', title: '별개 대화', renamed: true, idea: '원래 BTC 질문', draft: '그대로 남길 미전송 초안', pair: 'BTC/USDT', mode: 'trend', phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '', researchStatus: '초안', workspace: 'conversation', tradingReady: false, turns: [], updatedAt: 1 }
const record = { id: '1900', createdAt: 1900, name: '보존할 ETH 전략', parameters, score: evaluated.score, ret: evaluated.result.ret, mdd: evaluated.result.mdd, n: evaluated.result.n, winRate: evaluated.result.winRate, status: 'off', environment: 'paper', asset: '이더리움', exchangeName: 'OKX' }
const intentKey = `teth-client-subscription-intent:account:${encodeURIComponent(owner)}`
const storageNotice = '구독 선택을 이 브라우저에 저장하지 못했어요. 현재 선택은 유지되지만 새로고침하면 달라질 수 있어요.'
type Options = { incomplete?: boolean; otherOwner?: boolean; locator?: boolean; initialIntent?: string; restoredConnect?: boolean; unregistered?: boolean; storageFailure?: 'get' | 'set' | 'remove' }
test.beforeEach(({ page }) => { page.setDefaultTimeout(15000) })

async function setup(page: Page, options: Options = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, sessionId, parameters, original, record, options, intentKey }) => {
    if (!sessionStorage.getItem('broker-cycle-fixture')) {
      sessionStorage.setItem('broker-cycle-fixture', '1')
      localStorage.setItem('tethLang', 'ko'); localStorage.setItem('tethCurrency', 'KRW')
      sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '구독 검수자', email: options.otherOwner ? 'broker-other@example.test' : owner }))
      sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: options.restoredConnect ? sessionId : original.id, homeDraft: '홈 초안 보존', sessions: [original, { ...original, id: sessionId, title: 'ETH 검증 대화', pair: 'ETH/USDT', draft: 'ETH 초안', tradingReady: !options.unregistered, workspace: options.restoredConnect ? 'delegation' : 'conversation' }], sharedFollows: [] }))
      sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`, JSON.stringify(options.unregistered ? [] : [{ sessionId, record }]))
      sessionStorage.setItem(`teth:client-delegation:${sessionId}`, JSON.stringify({ page: options.restoredConnect ? 'connect' : 'report', answers: Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: key === 'asset' ? 1 : key === 'period' ? 2 : 1 }])), questionIndex: 5, attempt: 1, workStep: options.incomplete ? 3 : 5, chartInterval: '1D', parameters }))
      if (options.locator !== false) sessionStorage.setItem(`teth-client-delegation-location:account:${encodeURIComponent(owner)}`, JSON.stringify({ sessionId }))
      if (options.initialIntent !== undefined) sessionStorage.setItem(intentKey, options.initialIntent)
    }
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem
    Object.assign(window, { readRawSubscription: () => get.call(sessionStorage, intentKey) })
    Storage.prototype.getItem = function (key) { if (options.storageFailure === 'get' && key === intentKey) throw new Error('fixture get unavailable'); return get.call(this, key) }
    Storage.prototype.setItem = function (key, value) { if (options.storageFailure === 'set' && key === intentKey) throw new Error('fixture set unavailable'); return set.call(this, key, value) }
    Storage.prototype.removeItem = function (key) { if (options.storageFailure === 'remove' && key === intentKey) throw new Error('fixture remove unavailable'); return remove.call(this, key) }
  }, { owner, sessionId, parameters, original, record, options, intentKey })
}

async function brokerSubscribe(page: Page) {
  await openLegacySourceConsumer(page)
  await page.getByRole('button', { name: 'Binance 자세히', exact: true }).click()
  await page.getByRole('button', { name: 'TETH로 연결', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Binance 연결에는 플랜이 필요해요', exact: true })
  await expect(sheet).toBeVisible()
  const before = await preserved(page)
  await sheet.getByRole('button', { name: '구독으로 업그레이드', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  return before
}

test('현재 Main 밖의 호환 거래소 caller에서 명시 구독한 ETH는 결제 주기로 진입한다', async ({ page }) => {
  await setup(page)
  await brokerSubscribe(page)
  await expect(page.locator('.client-delegation')).toHaveAttribute('data-session', sessionId)
  await expect(page.getByRole('heading', { name: '결제 주기를 선택해주세요', exact: true })).toBeVisible()
})

async function intent(page: Page) { return page.evaluate(() => Reflect.get(window, 'readRawSubscription')()) }
async function preserved(page: Page) {
  return page.evaluate(owner => ({
    registered: sessionStorage.getItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`),
    account: Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('teth-client-account'))),
    experience: JSON.parse(sessionStorage.getItem('teth-client-experience')!),
  }), owner)
}
async function cycle(page: Page) { await expect(page.getByRole('heading', { name: '결제 주기를 선택해주세요', exact: true })).toBeVisible() }

test('초기 연 결제와 월 변경·reload는 동일 ETH 조건과 별개 대화·등록을 보존한다', async ({ page }) => {
  await setup(page)
  const before = await brokerSubscribe(page)
  await cycle(page)
  await expect(page.getByRole('button', { name: /연 결제/ })).toHaveAttribute('aria-pressed', 'true')
  expect(JSON.parse(await intent(page))).toEqual({ sessionId, cycle: 'year' })
  await page.getByRole('button', { name: /월 결제/ }).click()
  expect(JSON.parse(await intent(page))).toEqual({ sessionId, cycle: 'month' })
  await page.reload()
  await cycle(page)
  await expect(page.getByRole('button', { name: /월 결제/ })).toHaveAttribute('aria-pressed', 'true')
  const after = await preserved(page)
  expect(after.registered).toBe(before.registered)
  expect(after.account).toEqual(before.account)
  expect(after.experience.sessions.find((item: { id: string }) => item.id === original.id)).toEqual(before.experience.sessions.find((item: { id: string }) => item.id === original.id))
  expect(after.experience.homeDraft).toBe(before.experience.homeDraft)
  expect(after.experience.currentId).toBe(sessionId)
  expect(await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth:client-delegation:${id}`)!).parameters, sessionId)).toEqual(parameters)
})

test('카드 입력은 저장·전송하지 않고 reload는 선택한 월 주기로 돌아간다', async ({ page }) => {
  await setup(page)
  await brokerSubscribe(page)
  await cycle(page)
  await page.getByRole('button', { name: /월 결제/ }).click()
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await expect(page.getByRole('heading', { name: '결제 정보', exact: true })).toBeVisible()
  const mutations: string[] = []
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url()) })
  const before = await page.evaluate(() => ({ session: { ...sessionStorage }, local: { ...localStorage } }))
  await page.getByLabel('카드 번호', { exact: true }).fill('0000 1111 2222 3333')
  await page.getByLabel('유효기간', { exact: true }).fill('1239')
  await page.getByLabel('CVC', { exact: true }).fill('123')
  await page.getByLabel('카드 소유자 이름', { exact: true }).fill('FIXTURE ONLY')
  expect(await page.evaluate(() => ({ session: { ...sessionStorage }, local: { ...localStorage } }))).toEqual(before)
  await page.reload()
  await cycle(page)
  await expect(page.getByRole('button', { name: /월 결제/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '계속', exact: true }).click()
  for (const label of ['카드 번호', '유효기간', 'CVC', '카드 소유자 이름']) await expect(page.getByLabel(label, { exact: true })).toHaveValue('')
  expect(mutations).toEqual([])
})

test('실행 방법 다시 선택은 해당 세션 선호만 제거하고 reload에서도 방법 선택을 유지한다', async ({ page }) => {
  await setup(page)
  await brokerSubscribe(page)
  await cycle(page)
  await page.getByRole('button', { name: '실행 방법 다시 선택', exact: true }).click()
  await expect(page.getByRole('heading', { name: '어떻게 실행할까요?', exact: true })).toBeVisible()
  await expect(page.getByText('현재는 체험 모드예요. 이 화면의 결제, 연동, 주문은 실제로 실행되지 않습니다.', { exact: true })).toBeVisible()
  await expect(page.locator('.tf-optc.rec .ds')).toBeVisible()
  await expect(page.locator('.tf-optc.rec .ds')).toContainText('파트너 거래소의 유동성 수수료 지원으로 이용료가 없어요.')
  expect(await intent(page)).toBeNull()
  await page.reload()
  await expect(page.getByRole('heading', { name: '어떻게 실행할까요?', exact: true })).toBeVisible()
  expect(await intent(page)).toBeNull()
})

for (const [label, options] of [['미완료', { incomplete: true }], ['다른 계정', { otherOwner: true }], ['locator 없음', { locator: false }]] as const) test(`${label} 구독은 선호·권한을 만들지 않고 기존 채팅 안내로 돌아간다`, async ({ page }) => {
  await setup(page, options)
  const before = await brokerSubscribe(page)
  await expect(page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })).toHaveValue(original.draft)
  await expect(page.getByRole('status').filter({ hasText: '전략 검증을 통과하면 구독 단계로 이어져요. 채팅에서 전략을 맡겨보세요.' })).toBeVisible()
  expect(await preserved(page)).toEqual(before)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('teth-client-subscription-intent:')))).toEqual([])
})

test('다른 세션의 저장 선호는 현재 검증된 connect에 적용하거나 덮어쓰지 않는다', async ({ page }) => {
  const raw = JSON.stringify({ sessionId: original.id, cycle: 'month' })
  await setup(page, { restoredConnect: true, initialIntent: raw })
  await openLegacySourceConsumer(page)
  await expect(page.locator('.client-delegation')).toHaveAttribute('data-session', sessionId)
  await expect(page.getByRole('heading', { name: '어떻게 실행할까요?', exact: true })).toBeVisible()
  expect(await intent(page)).toBe(raw)
})

test('일반 PLAN 구독에는 거래소 전용 paid 선호를 생성하지 않는다', async ({ page }) => {
  await setup(page)
  await openLegacySourceConsumer(page, 'brokers', '#/plan')
  await page.getByRole('button', { name: '구독으로 업그레이드', exact: true }).click()
  await page.getByRole('dialog', { name: 'PRO 로 업그레이드', exact: true }).getByRole('button', { name: '구독으로 업그레이드', exact: true }).click()
  await expect(page.getByRole('heading', { name: '어떻게 실행할까요?', exact: true })).toBeVisible()
  expect(await intent(page)).toBeNull()
})

for (const failure of ['get', 'set'] as const) test(`저장소 ${failure} 실패는 원 bytes를 보존하고 현재 명시 구독 선택만 유지한다`, async ({ page }) => {
  const raw = JSON.stringify({ sessionId, cycle: 'month' })
  await setup(page, { storageFailure: failure, initialIntent: raw })
  await brokerSubscribe(page)
  await cycle(page)
  await expect(page.getByRole('status').filter({ hasText: storageNotice })).toBeVisible()
  expect(await intent(page)).toBe(raw)
  await page.getByRole('button', { name: /연 결제/ }).click()
  await expect(page.getByRole('button', { name: /연 결제/ })).toHaveAttribute('aria-pressed', 'true')
  expect(await intent(page)).toBe(raw)
})

test('선호 remove 실패는 현재 방법 선택으로 돌아가되 원 저장값과 실패 안내를 유지한다', async ({ page }) => {
  await setup(page, { storageFailure: 'remove' })
  await brokerSubscribe(page)
  await cycle(page)
  const raw = await intent(page)
  await page.getByRole('button', { name: '실행 방법 다시 선택', exact: true }).click()
  await expect(page.getByRole('heading', { name: '어떻게 실행할까요?', exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: storageNotice })).toBeVisible()
  expect(await intent(page)).toBe(raw)
})

test('손상된 선호 원문은 덮지 않고 명시 선택을 메모리에만 유지한다', async ({ page }) => {
  await setup(page, { initialIntent: '{broken' })
  await brokerSubscribe(page)
  await cycle(page)
  await expect(page.getByRole('status').filter({ hasText: storageNotice })).toBeVisible()
  expect(await intent(page)).toBe('{broken')
})

for (const width of [320, 1440]) test(`${width}px 명시 구독 진입은 결제 주기와 본문 초점을 읽을 수 있게 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 320 ? 640 : 900 })
  await setup(page)
  await brokerSubscribe(page)
  await cycle(page)
  await expect.poll(() => page.evaluate(() => { const el = document.activeElement as HTMLElement | null; return Boolean(el && el !== document.body && el.closest('.client-delegation') && el.getClientRects().length && !el.closest('[inert],[hidden]')) })).toBe(true)
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: info.outputPath(`broker-cycle-${width}-top.png`) })
  const monthly = page.getByRole('button', { name: /월 결제/ })
  await monthly.focus()
  await page.keyboard.press('Enter')
  await expect(monthly).toHaveAttribute('aria-pressed', 'true')
  await monthly.scrollIntoViewIfNeeded()
  const box = (await monthly.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(await monthly.evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === el || el.contains(hit) })).toBe(true)
  await page.screenshot({ path: info.outputPath(`broker-cycle-${width}-month.png`) })
})

test('미등록 월 구독은 보고서 왕복·reload 뒤 실행 진입에서도 동일 월 주기를 유지한다', async ({ page }) => {
  await setup(page, { unregistered: true })
  await brokerSubscribe(page)
  await cycle(page)
  await page.getByRole('button', { name: /월 결제/ }).click()
  expect(JSON.parse(await intent(page))).toEqual({ sessionId, cycle: 'month' })
  await page.locator('.tf-connect-page').getByRole('button', { name: '뒤로', exact: true }).click()
  await expect(page.locator('.tf-report-page')).toBeVisible()
  const reportOffer = page.getByRole('dialog', { name: '검증을 통과했어요. 실행하려면 연결하세요', exact: true })
  await expect(reportOffer).toBeVisible()
  await reportOffer.getByRole('button', { name: '나중에 하기', exact: true }).click()
  await page.reload()
  await expect(page.locator('.tf-report-page')).toBeVisible()
  await page.getByRole('button', { name: '이 전략 실행하기', exact: true }).click()
  await cycle(page)
  await expect(page.getByRole('button', { name: /월 결제/ })).toHaveAttribute('aria-pressed', 'true')
  expect(JSON.parse(await intent(page))).toEqual({ sessionId, cycle: 'month' })
  expect((await preserved(page)).registered).toBe('[]')
})

test('방법 재선택의 삭제 실패 뒤 명시 무료 선택은 저장소 복구 시 이전 월 선호 삭제를 재시도한다', async ({ page }) => {
  await setup(page)
  await brokerSubscribe(page)
  await cycle(page)
  await page.getByRole('button', { name: /월 결제/ }).click()
  const raw = await intent(page)
  await page.evaluate(key => {
    const remove = Storage.prototype.removeItem
    Object.assign(window, { restoreSubscriptionRemove: () => { Storage.prototype.removeItem = remove } })
    Storage.prototype.removeItem = function (target) { if (target === key) throw new Error('fixture temporary remove failure'); return remove.call(this, target) }
  }, intentKey)
  await page.getByRole('button', { name: '실행 방법 다시 선택', exact: true }).click()
  await expect(page.getByRole('heading', { name: '어떻게 실행할까요?', exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: storageNotice })).toBeVisible()
  expect(await intent(page)).toBe(raw)
  await page.evaluate(() => Reflect.get(window, 'restoreSubscriptionRemove')())
  await page.getByRole('button', { name: '무료로 시작', exact: true }).click()
  await expect(page.getByRole('heading', { name: '어느 거래소로 시작할까요? 하나만 고르면 돼요.', exact: true })).toBeVisible()
  expect(await intent(page)).toBeNull()
})
})
