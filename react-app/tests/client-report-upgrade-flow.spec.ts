import { expect, test, type Page } from '@playwright/test'
import { evaluateDelegation } from '../src/client-delegation-engine'
import { sourceSharedStrategies } from '../src/client-shared-strategies'

const owner = 'report-upgrade@example.test', sessionId = 'report-upgrade-eth'
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }
const lowParameters = { ...parameters, trendFilter: false, startI: 604 }
const evaluated = evaluateDelegation(parameters, 5000000)
const heading = '검증을 통과했어요. 실행하려면 연결하세요'
const seenKey = (identity = owner) => `teth-client-report-upgrade:account:${encodeURIComponent(identity)}`
const fingerprint = (p = parameters) => { const value = evaluateDelegation(p, 5000000); return `${value.result.ret}|${value.result.n}|${value.score}` }
const alternative = sourceSharedStrategies().find(row => row.score >= 80 && row.parameters.tp !== null && row.result.ret !== evaluated.result.ret)!.parameters
const secondParameters = { ...alternative, tp: alternative.tp! }
const answers = Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: key === 'asset' ? 1 : key === 'period' ? 2 : 1 }]))
const draft = '보고서와 별개로 보존할 초안'
type Options = { snapshot?: Record<string, unknown>; activeOwner?: string; sharedOwner?: string; secondSession?: boolean; secondReport?: boolean; signed?: boolean }
test.beforeEach(({ page }) => { page.setDefaultTimeout(15000) })

async function setup(page: Page, options: Options = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ options, owner, sessionId, parameters, answers, draft }) => {
    if (sessionStorage.getItem('report-upgrade-initialized')) return
    sessionStorage.setItem('report-upgrade-initialized', '1')
    localStorage.setItem('tethLang', 'ko'); localStorage.setItem('tethCurrency', 'KRW')
    if (options.signed !== false) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '보고서 검수자', email: options.activeOwner ?? owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: sessionId, homeDraft: '보고서 이전 홈 초안', sessions: [
      { id: sessionId, title: 'ETH 검증 보고서', renamed: true, idea: '이더리움 반등 전략', draft, pair: 'ETH/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-5%', takeProfit: '+12%', researchStatus: '초안', workspace: 'delegation', tradingReady: false, turns: [], updatedAt: 1,
        ...(options.sharedOwner ? { sharedCopy: { owner: options.sharedOwner, nick: '보존할 공유 원본', confirmedAt: 1, returnId: null, active: true } } : {}) },
      ...(options.secondSession ? [{ id: 'report-other-chat', title: '다른 대화', renamed: true, idea: '원래 별개 질문', draft: '다른 대화의 초안', pair: 'BTC/USDT', mode: 'trend', phase: 'plan', timeframe: '일봉', risk: '-3%', researchStatus: '초안', workspace: options.secondReport ? 'delegation' : 'conversation', tradingReady: false, turns: [], updatedAt: 2 }] : []),
    ], sharedFollows: [] }))
    sessionStorage.setItem(`teth:client-delegation:${sessionId}`, JSON.stringify({ page: 'report', answers, questionIndex: 5, attempt: 1, workStep: 5, chartInterval: '1D', parameters, ...options.snapshot }))
    if (options.secondReport) sessionStorage.setItem('teth:client-delegation:report-other-chat', JSON.stringify({ page: 'report', answers, questionIndex: 5, attempt: 1, workStep: 5, chartInterval: '1D', parameters }))
    sessionStorage.setItem(`teth-client-delegation-location:account:${encodeURIComponent(owner)}`, JSON.stringify({ sessionId }))
  }, { options, owner, sessionId, parameters, answers, draft })
}

async function navigate(page: Page, path: string) {
  await page.evaluate(path => { history.pushState(null, '', path); dispatchEvent(new Event('teth:navigate')) }, path)
}

async function timedReport(page: Page, options: Options = {}, blockStorage = false) {
  await page.clock.install()
  await setup(page, options)
  await page.goto('/#/plan/alerts')
  await expect(page.locator('.client-account-activity')).toBeVisible()
  // Preload code only. The real Main route still owns mounting and state.
  await page.evaluate(async ({ key, blockStorage }) => {
    for (const path of ['/src/components/ClientDelegationWorkspace.tsx', '/src/components/ClientUpgradeSheet.tsx']) await import(/* @vite-ignore */ path)
    const set = Storage.prototype.setItem
    Object.assign(window, { reportUpgradeWrites: [], reportUpgradeAllWrites: [] })
    Storage.prototype.setItem = function (target, value) {
      if (target.startsWith('teth-client-report-upgrade:')) Reflect.get(window, 'reportUpgradeAllWrites').push({ key: target, value })
      if (target === key) {
        Reflect.get(window, 'reportUpgradeWrites').push(value)
        if (blockStorage) throw new Error('report fixture storage failure')
      }
      return set.call(this, target, value)
    }
  }, { key: seenKey(options.activeOwner), blockStorage })
  // Pause while PLAN is still mounted; allow transport latency before the clock
  // command. The report and its 700ms reservation are not mounted until below.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000))
  const before = await noExecution(page)
  await navigate(page, '/')
  if (options.sharedOwner && options.sharedOwner !== (options.activeOwner ?? owner)) {
    await expect(page.locator('.client-inline-recovery')).toContainText('현재 계정의 전략 기록을 다시 확인해주세요.')
  } else {
    await expect(page.locator('.client-delegation')).toHaveAttribute('data-session', sessionId)
  }
  return before
}

async function seen(page: Page, identity = owner) {
  return page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? 'null'), seenKey(identity))
}

async function noExecution(page: Page) {
  return page.evaluate(({ owner, sessionId }) => ({
    registration: sessionStorage.getItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`),
    account: Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('teth-client-account'))),
    experience: JSON.parse(sessionStorage.getItem('teth-client-experience')!),
    ui: JSON.parse(sessionStorage.getItem(`teth:client-delegation:${sessionId}`)!),
  }), { owner, sessionId })
}

async function showAtDeadline(page: Page) {
  await expect(page.locator('.tf-report-page')).toBeVisible()
  await expect.poll(() => seen(page)).toEqual({ fingerprint: fingerprint() })
  await page.clock.runFor(700)
  const sheet = page.getByRole('dialog', { name: heading, exact: true })
  await expect(sheet).toBeVisible()
  return sheet
}

test('완료된 정상 ETH 보고서는 자동 연결 안내를 표시한다', async ({ page }, info) => {
  await setup(page)
  await page.goto('/')
  await expect(page.locator('.tf-report-page')).toBeVisible()
  await expect(page.getByRole('dialog', { name: heading, exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('report-upgrade-initial.png') })
  expect(evaluated.score).toBeGreaterThanOrEqual(80)
})

test('StrictMode에서 예약 전 지문을 한 번 저장하고 699ms에는 없으며 700ms에 한 시트만 표시한다', async ({ page }) => {
  await timedReport(page)
  await expect.poll(() => seen(page)).toEqual({ fingerprint: fingerprint() })
  expect(await page.evaluate(() => Reflect.get(window, 'reportUpgradeWrites'))).toEqual([JSON.stringify({ fingerprint: fingerprint() })])
  const before = await noExecution(page)
  await page.clock.runFor(699)
  await expect(page.getByRole('dialog', { name: heading, exact: true })).toHaveCount(0)
  await page.clock.runFor(1)
  const sheet = page.getByRole('dialog', { name: heading, exact: true })
  await expect(sheet).toHaveCount(1)
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('button', { name: '무료로 연동하기', exact: true })).toBeDisabled()
  await sheet.getByRole('button', { name: '무료로 연동하기', exact: true }).evaluate(el => (el as HTMLButtonElement).click())
  await expect(sheet).toBeVisible()
  expect(await noExecution(page)).toEqual(before)
})

for (const close of ['닫기', '나중에 하기', 'Escape', 'backdrop']) test(`${close}는 보고서를 유지하고 같은 결과의 경로 왕복·새로고침은 재유도하지 않는다`, async ({ page }) => {
  await timedReport(page)
  const sheet = await showAtDeadline(page), before = await noExecution(page)
  const chart = await page.locator('.tf-report-page svg[aria-label="이더리움 과거 검증 구간 가격, 매수와 매도 지점"]').elementHandle()
  expect(chart).not.toBeNull()
  if (close === 'Escape') await page.keyboard.press('Escape')
  else if (close === 'backdrop') await page.mouse.click(2, 2)
  else await sheet.getByRole('button', { name: close, exact: true }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.locator('.tf-report-page')).toBeVisible()
  expect(await chart!.evaluate(el => el === document.querySelector('.tf-report-page svg[aria-label="이더리움 과거 검증 구간 가격, 매수와 매도 지점"]'))).toBe(true)
  expect(await noExecution(page)).toEqual(before)
  await expect.poll(() => page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    return Boolean(el && el !== document.body && el.getClientRects().length && !el.closest('[inert],[hidden]'))
  })).toBe(true)
  await navigate(page, '/#/plan')
  await expect(page.locator('.client-settings-page h1')).toHaveText('결제')
  await expect(page.locator('.tf-report-page')).toBeHidden()
  await navigate(page, '/')
  await expect(page.locator('.tf-report-page')).toBeVisible()
  await page.clock.runFor(1500)
  await expect(sheet).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.tf-report-page')).toBeVisible()
  await page.clock.runFor(1500)
  await expect(sheet).toHaveCount(0)
  expect(await seen(page)).toEqual({ fingerprint: fingerprint() })
})

test('구독은 보고서의 같은 ETH 세션 connect로만 이어지고 결제·등록 권한은 만들지 않는다', async ({ page }) => {
  await timedReport(page)
  const sheet = await showAtDeadline(page), before = await noExecution(page)
  const requests: string[] = []
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) requests.push(request.url()) })
  await sheet.getByRole('button', { name: '구독으로 업그레이드', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.locator('.client-delegation')).toHaveAttribute('data-session', sessionId)
  await expect(page.getByRole('button', { name: '무료로 시작', exact: true })).toBeVisible()
  const after = await noExecution(page)
  expect(after.registration).toBeNull()
  expect(after.account).toEqual(before.account)
  expect(after.experience).toEqual(before.experience)
  expect(after.ui.parameters).toEqual(parameters)
  expect(after.ui.page).toBe('connect')
  for (const key of ['payDone', 'uidLinked', 'plan', 'apiKey', 'secretKey']) expect(after.ui).not.toHaveProperty(key)
  expect(requests).toEqual([])
})

test('계정의 마지막 단일 지문은 A→B→A를 각각 표시하며 과거 모든 결과 집합으로 확장하지 않는다', async ({ page }) => {
  expect(fingerprint(secondParameters)).not.toBe(fingerprint())
  await timedReport(page)
  const sheet = await showAtDeadline(page)
  await sheet.getByRole('button', { name: '닫기', exact: true }).click()
  for (const next of [secondParameters, parameters]) {
    await navigate(page, '/#/plan/alerts')
    await expect(page.locator('.tf-report-page')).toHaveCount(0)
    await page.evaluate(async ({ sessionId, parameters }) => {
      const path = '/src/client-delegation-fixtures.ts'
      const { readDelegationUi, saveDelegationUi } = await import(/* @vite-ignore */ path)
      const current = readDelegationUi(sessionId)
      if (!current || !saveDelegationUi(sessionId, { ...current, page: 'report', parameters, pendingParameters: undefined, workStep: 5 })) throw new Error('Invalid completed fixture')
    }, { sessionId, parameters: next })
    await navigate(page, '/')
    await expect(page.locator('.tf-report-page')).toBeVisible()
    await expect.poll(() => seen(page)).toEqual({ fingerprint: fingerprint(next) })
    await page.clock.runFor(700)
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: '닫기', exact: true }).click()
  }
  expect(await page.evaluate(() => Reflect.get(window, 'reportUpgradeWrites').map((text: string) => JSON.parse(text)))).toEqual([parameters, secondParameters, parameters].map(p => ({ fingerprint: fingerprint(p) })))
})

for (const destination of ['/#/plan', '/about']) test(`700ms 전에 ${destination}로 이탈하면 늦은 팝업은 없고 예약은 유지한다`, async ({ page }) => {
  await timedReport(page)
  await expect.poll(() => seen(page)).toEqual({ fingerprint: fingerprint() })
  await page.clock.runFor(600)
  await navigate(page, destination)
  await page.clock.runFor(2000)
  await expect(page.getByRole('dialog', { name: heading, exact: true })).toHaveCount(0)
  expect(await seen(page)).toEqual({ fingerprint: fingerprint() })
  await navigate(page, '/')
  await expect(page.locator('.tf-report-page')).toBeVisible()
  await page.clock.runFor(1000)
  await expect(page.getByRole('dialog', { name: heading, exact: true })).toHaveCount(0)
})

for (const fixture of [
  { name: '미완료', snapshot: { workStep: 4 } },
  { name: '낮은 점수', snapshot: { parameters: lowParameters } },
  { name: '손상 pending', snapshot: { pendingParameters: { ...parameters, endI: 9000 } } },
  { name: '미완성 답변', snapshot: { answers: { asset: { index: 1 } } } },
]) test(`${fixture.name}는 완료 보고서 안내를 예약하거나 띄우지 않는다`, async ({ page }) => {
  await timedReport(page, { snapshot: fixture.snapshot })
  await page.clock.runFor(1600)
  await expect(page.getByRole('dialog', { name: heading, exact: true })).toHaveCount(0)
  expect(await seen(page)).toBeNull()
  expect((await noExecution(page)).registration).toBeNull()
})

test('명시적으로 다른 owner의 공유 세션은 현재 계정에 자동 안내를 예약하지 않는다', async ({ page }) => {
  const before = await timedReport(page, { sharedOwner: 'foreign-report@example.test' })
  await expect(page.locator('.tf-report-page, .client-delegation')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '대화로 돌아가기', exact: true })).toBeVisible()
  await page.clock.runFor(1200)
  await expect(page.getByRole('dialog', { name: heading, exact: true })).toHaveCount(0)
  expect(await seen(page)).toBeNull()
  expect(await page.evaluate(() => Reflect.get(window, 'reportUpgradeAllWrites'))).toEqual([])
  expect(await noExecution(page)).toEqual(before)
})

test('계정별 지문은 같은 결과라도 별도로 예약하고 이전 계정의 bytes를 바꾸지 않는다', async ({ page }) => {
  await setup(page)
  await page.goto('/')
  const sheet = page.getByRole('dialog', { name: heading, exact: true })
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')
  const previous = await seen(page), other = 'second-report@example.test'
  await page.evaluate(other => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '다른 계정', email: other })), other)
  await page.reload()
  await expect(sheet).toBeVisible()
  expect(await seen(page, other)).toEqual({ fingerprint: fingerprint() })
  expect(await seen(page)).toEqual(previous)
})

test('표시 기록 저장 실패도 현재 페이지 중복은 막고 실제 저장 실패를 알린다', async ({ page }) => {
  await timedReport(page, {}, true)
  await expect(page.getByRole('status').filter({ hasText: '안내 표시 기록을 저장하지 못했어요' })).toBeVisible()
  await page.clock.runFor(700)
  const sheet = page.getByRole('dialog', { name: heading, exact: true })
  await expect(sheet).toBeVisible()
  expect(await seen(page)).toBeNull()
  await page.keyboard.press('Escape')
  await navigate(page, '/#/plan')
  await expect(page.locator('.client-settings-page h1')).toHaveText('결제')
  await expect(page.locator('.tf-report-page')).toBeHidden()
  await navigate(page, '/')
  await expect(page.locator('.tf-report-page')).toBeVisible()
  await page.clock.runFor(1000)
  await expect(sheet).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'reportUpgradeWrites').length)).toBe(1)
})

test('예약 중 다른 대화를 선택하면 이전 보고서의 늦은 팝업을 띄우지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await timedReport(page, { secondSession: true })
  await expect.poll(() => seen(page)).toEqual({ fingerprint: fingerprint() })
  await page.clock.runFor(600)
  await page.locator('.client-rail-logo-row button').click()
  await page.locator('.client-session[title="다른 대화"]').click()
  await expect(page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })).toHaveValue('다른 대화의 초안')
  await page.clock.runFor(2000)
  await expect(page.getByRole('dialog', { name: heading, exact: true })).toHaveCount(0)
  const stored = await noExecution(page)
  expect(stored.experience.currentId).toBe('report-other-chat')
  expect(stored.experience.sessions.find((row: { id: string }) => row.id === sessionId).draft).toBe(draft)
})

test('같은 계정의 동일 지문 다른 보고서 세션도 이미 본 결과로 취급한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await timedReport(page, { secondSession: true, secondReport: true })
  const sheet = await showAtDeadline(page)
  await page.keyboard.press('Escape')
  await page.locator('.client-rail-logo-row button').click()
  await page.locator('.client-session[title="다른 대화"]').click()
  await expect(page.locator('.client-delegation')).toHaveAttribute('data-session', 'report-other-chat')
  await expect(page.locator('.tf-report-page')).toBeVisible()
  await page.clock.runFor(1500)
  await expect(sheet).toHaveCount(0)
  expect(await seen(page)).toEqual({ fingerprint: fingerprint() })
  expect(await page.evaluate(() => Reflect.get(window, 'reportUpgradeWrites').length)).toBe(1)
})

test('예약 중 로그아웃은 이전 팝업을 취소하고 guest 홈에 계정 기록을 노출하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await timedReport(page)
  await expect.poll(() => seen(page)).toEqual({ fingerprint: fingerprint() })
  const ownerRaw = await page.evaluate(key => sessionStorage.getItem(key), seenKey())
  const before = await noExecution(page)
  await page.clock.runFor(600)
  await page.locator('[data-sidebar-action="account"]').filter({ visible: true }).click()
  await page.locator('[data-menu-action="settings"]').click()
  await page.locator('[data-settings-tab="account"]').click()
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await page.locator('.stg-confirm').getByRole('button', { name: '로그아웃', exact: true }).click()
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-profile-preview'))).toBeNull()
  const guestKey = 'teth-client-report-upgrade:guest'
  const sheet = page.getByRole('dialog', { name: heading, exact: true })
  await expect(page.locator('#strategy-idea')).toBeVisible()
  await page.clock.runFor(100)
  await expect(sheet).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), guestKey)).toBeNull()
  await page.locator('.client-rail-logo-row button').click()
  await expect(page.locator('.client-session')).toHaveCount(0)
  await expect(page.locator('.tf-report-page')).toHaveCount(0)
  await page.clock.runFor(2000)
  await expect(sheet).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), guestKey)).toBeNull()
  expect(await page.evaluate(key => sessionStorage.getItem(key), seenKey())).toBe(ownerRaw)
  const after = await noExecution(page)
  expect(after.experience.sessions).toEqual(before.experience.sessions)
  expect(after.experience.homeDraft).toBe(before.experience.homeDraft)
  expect(after.ui).toEqual(before.ui)
  expect(await page.evaluate(() => Reflect.get(window, 'reportUpgradeAllWrites'))).toEqual([
    { key: seenKey(), value: JSON.stringify({ fingerprint: fingerprint() }) },
  ])
})

for (const width of [320, 1440]) test(`${width}px 자동 안내는 가시 초점·터치 영역과 보고서 복귀를 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 320 ? 640 : 900 })
  await timedReport(page)
  const sheet = await showAtDeadline(page)
  await page.evaluate(() => document.fonts.ready)
  await expect(sheet.getByRole('button', { name: '닫기', exact: true })).toBeFocused()
  await expect(sheet).toHaveCSS('word-break', 'keep-all')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: info.outputPath(`report-upgrade-${width}-top.png`) })
  const later = sheet.getByRole('button', { name: '나중에 하기', exact: true })
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(later).toBeFocused()
  const box = await later.boundingBox()
  expect(box).not.toBeNull()
  const touch = await page.evaluate(() => matchMedia('(pointer:coarse), (max-width:640px)').matches)
  expect(box!.height).toBeGreaterThanOrEqual(touch ? 44 : 24)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
  expect(await later.evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === el || el.contains(hit) })).toBe(true)
  await page.screenshot({ path: info.outputPath(`report-upgrade-${width}-later.png`) })
  await page.keyboard.press('Enter')
  await expect(sheet).toHaveCount(0)
  await expect(page.locator('.tf-report-page')).toBeVisible()
})
