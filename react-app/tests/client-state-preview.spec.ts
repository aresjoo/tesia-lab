import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { SOURCE_QA_ROWS, createSourceQaState, toggleSourceQaState, sourceQaEnabled, resetSourceQaState, sourceQaBrokerState } from '../src/dev/client-state-preview-model'
import { delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'
import { billingPreviewBalance, billingPreviewTier } from '../src/client-billing-preview-state'

const qaEvent = (id: string, now = 1_800_000_000_000) => ({ id, now })
const originalQaRows = SOURCE_QA_ROWS.slice(0, 6)

test('원본 QA 아홉 상태: 기존 여섯 fixture와 과금 세 전이를 구분한다', () => {
  expect(SOURCE_QA_ROWS).toEqual([['login', '로그인'], ['uid', 'UID 연동'], ['pay', '구독 결제'], ['api', '거래소 연결 (Binance)'], ['free', '무료 분석 소진'], ['strat', '검증 통과 전략'], ['card', '카드 등록 (월 충전)'], ['bwarn', '크레딧 임계 경고'], ['bwatch', '크레딧 관망 모드']])
  for (const [key] of originalQaRows) {
    const initial = createSourceQaState(), serialized = JSON.stringify(initial)
    const on = toggleSourceQaState(initial, key, qaEvent(`${key}:on`))
    expect(JSON.stringify(initial)).toBe(serialized)
    expect(sourceQaEnabled(on, key)).toBe(true)
    expect(on.account.creditBal).toBe(0)
    expect(on.account.creditGrants).toEqual({})
    expect(on.account.tradeActiveUntil).toBeNull()
    expect(sourceQaEnabled(toggleSourceQaState(on, key, qaEvent(`${key}:off`)), key)).toBe(false)
    if (key !== 'api' && key !== 'login') expect(on.user).toBeNull()
  }
  const api = toggleSourceQaState(createSourceQaState(), 'api', qaEvent('api:on'))
  expect(api.user).toEqual({ name: '김도현', email: 'demo@teth.ai' })
  expect(api.account.uidLinked).toBe(false)
  expect(api.account.payDone).toBe(false)
  expect(toggleSourceQaState(api, 'api', qaEvent('api:off')).user).toBe(api.user)
  const source = readFileSync('src/dev/client-state-preview-model.ts', 'utf8')
  expect(source).not.toMatch(/localStorage|sessionStorage|fetch\(|setTimeout|XMLHttpRequest|navigator\./)
  expect(source).not.toMatch(/Date\.now|Math\.random|client-billing-preview-store|use-billing-preview/)
})

test('과금 QA는 순수 원장 상태만 전이하고 로그인만 보장한다', () => {
  const initial = createSourceQaState(), account = initial.account
  const card = toggleSourceQaState(initial, 'card', qaEvent('card:on'))
  expect(card.user).toEqual({ name: '김도현', email: 'demo@teth.ai' })
  expect(card.billing.cardOn).toBe(true)
  expect(billingPreviewBalance(card.billing)).toBe(3100)
  const linked = toggleSourceQaState(card, 'uid', qaEvent('uid:card'))
  expect(billingPreviewTier(linked.billing)).toBe('CARD_UID')
  expect(billingPreviewBalance(linked.billing)).toBe(3100)
  expect(linked.billing.ledger.some(entry => entry.reason === 'promo')).toBe(false)
  expect(card.billing.ledger.some(entry => entry.reason === 'card')).toBe(true)
  expect(card.plan).toBeNull()
  expect(card.account).toBe(account)
  const cardOff = toggleSourceQaState(card, 'card', qaEvent('card:off'))
  expect(cardOff.billing.cardOn).toBe(false)
  expect(cardOff.account.payDone).toBe(false)

  const warning = toggleSourceQaState(initial, 'bwarn', qaEvent('warn:on'))
  expect(warning.user).not.toBeNull()
  expect(warning.billing.mode).toBe('grace')
  expect(warning.billing.ledger.map(entry => [entry.reason, entry.amt])).toEqual([['welcome', 100], ['qa', -80]])
  expect(toggleSourceQaState(warning, 'bwarn', qaEvent('warn:off')).billing.mode).toBe('active')

  const watch = toggleSourceQaState(initial, 'bwatch', qaEvent('watch:on'))
  expect(watch.user).not.toBeNull()
  expect(watch.billing.mode).toBe('watch')
  expect(watch.billing.ledger.map(entry => [entry.reason, entry.amt])).toEqual([['welcome', 100], ['qa', -100]])
  expect(toggleSourceQaState(watch, 'bwatch', qaEvent('watch:off')).billing.mode).toBe('active')
  expect(resetSourceQaState(watch)).toEqual(createSourceQaState(1))
})

test('검증 토글은 원본 동일 조건의 결과를 사용하며 점수/체결을 조작하지 않는다', () => {
  const state = toggleSourceQaState(createSourceQaState(), 'strat', qaEvent('strat:on'))
  expect(state.verified).toEqual(evaluateDelegation(delegationRecommendedParameters(), 5_000_000))
  expect(state.verified!.score).toBe(80)
  expect(state.verified!.result.trades.length).toBe(state.verified!.result.n)
  expect(state).not.toHaveProperty('userStrategies')
  expect(state).not.toHaveProperty('conn')
})

test('64개 상태 조합의 초기화·로그아웃은 이전 상태를 남기지 않는다', () => {
  for (let mask = 0; mask < 64; mask++) {
    let state = createSourceQaState(7)
    originalQaRows.forEach(([key], i) => { if (mask & (1 << i)) state = toggleSourceQaState(state, key, qaEvent(`${mask}:${key}`)) })
    expect(sourceQaBrokerState(state, 'upbit', false)).toBe('SOON')
    expect(sourceQaBrokerState(state, 'binance', false)).toBe('SOON')
    expect(resetSourceQaState(state)).toEqual(createSourceQaState(8))
    if (state.user) expect(toggleSourceQaState(state, 'login', qaEvent(`${mask}:logout`))).toEqual(createSourceQaState(8))
  }
  const initial = createSourceQaState(), user = toggleSourceQaState(initial, 'login', qaEvent('login:on'))
  expect(sourceQaBrokerState(initial, 'binance', true)).toBe('GUEST')
  expect(sourceQaBrokerState(user, 'binance', true)).toBe('NEEDS_PLAN')
  expect(sourceQaBrokerState(toggleSourceQaState(user, 'pay', qaEvent('pay:on')), 'binance', true)).toBe('NEEDS_LINK')
  expect(sourceQaBrokerState(toggleSourceQaState(user, 'uid', qaEvent('uid:on')), 'binance', true)).toBe('NEEDS_LINK')
  expect(sourceQaBrokerState(toggleSourceQaState(user, 'api', qaEvent('api:connect')), 'binance', true)).toBe('CONNECTED')
})

test('DEV 전용 진입: 정상 public/service import 그래프에 포함하지 않는다', () => {
  for (const file of ['vite.config.ts', 'vite.service.config.ts', 'vite.internal-poc.config.ts', 'index.html', 'src/client-entry.ts', 'src/client-bootstrap.tsx']) {
    expect(readFileSync(file, 'utf8')).not.toMatch(/client-state-preview|client-state-entry|ClientStateControls/)
  }
  expect(readFileSync('src/dev/client-state-entry.ts', 'utf8')).toContain('if (import.meta.env.DEV)')
})

test('PLAN 상태 반영·정확한 토글 초점·저장소/네트워크 경계·초기화', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('teth-client-profile-preview', '{"name":"preserve","email":"preserve@example.test"}')
    localStorage.setItem('teth.state', '{"preserve":true}')
  })
  const api: string[] = []
  page.on('request', request => { if (/\/api\//.test(new URL(request.url()).pathname)) api.push(request.url()) })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/client-state-preview.html')
  const qa = page.getByRole('button', { name: '데모 상태 조작 패널', exact: true })
  await qa.click()
  const toggle = (key: string) => page.locator(`[data-qa-key="${key}"]`)
  await expect(toggle('login')).toBeFocused()
  await toggle('login').click()
  await expect(toggle('login')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('무료 체험', { exact: true })).toBeVisible()
  await toggle('free').click()
  await expect(toggle('free')).toBeFocused()
  await expect(page.getByText('업그레이드 필요', { exact: true })).toBeVisible()
  await toggle('pay').click()
  await expect(page.getByText('PRO 멤버십', { exact: true })).toBeVisible()
  await toggle('uid').click()
  await expect(page.getByText('연동됨 (무료)', { exact: true })).toBeVisible()
  await toggle('api').click()
  await toggle('strat').click()
  await page.keyboard.press('Escape')
  await expect(qa).toBeFocused()
  await expect(page.getByRole('dialog', { name: '데모 상태 조작', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '검증 결과', exact: true }).click()
  await expect(page.getByText(/TETH SCORE 80/)).toBeVisible()
  await expect(page.getByText(/손절·익절은 규칙가 가정\(일중·갭·슬리피지 미반영\)/)).toBeVisible()
  await qa.click()
  await page.getByRole('button', { name: '전부 초기화 (게스트)', exact: true }).click()
  for (const [key] of SOURCE_QA_ROWS) await expect(toggle(key)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('로그인 후 PLAN 및 크레딧을 확인할 수 있어요.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-profile-preview'))).toBe('{"name":"preserve","email":"preserve@example.test"}')
  expect(await page.evaluate(() => localStorage.getItem('teth.state'))).toBe('{"preserve":true}')
  expect(api).toEqual([])
  expect(errors).toEqual([])
  await page.reload()
  await qa.click()
  for (const [key] of SOURCE_QA_ROWS) await expect(toggle(key)).toHaveAttribute('aria-pressed', 'false')
})

for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`QA 패널 ${size.width}×${size.height}: 화면 내 배치·트리거 비겹침·키보드 끝행 접근`, async ({ page }, testInfo) => {
    await page.setViewportSize(size)
    await page.goto('/client-state-preview.html')
    const trigger = page.getByRole('button', { name: '데모 상태 조작 패널', exact: true })
    await trigger.click()
    const panel = page.getByRole('dialog', { name: '데모 상태 조작', exact: true })
    const p = (await panel.boundingBox())!, b = (await trigger.boundingBox())!
    expect(await trigger.evaluate(element => getComputedStyle(element).appearance)).toBe('none')
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeGreaterThanOrEqual(0)
    expect(p.x + p.width).toBeLessThanOrEqual(size.width)
    expect(p.y + p.height).toBeLessThanOrEqual(size.height)
    expect(p.y >= b.y + b.height + 7 || b.y >= p.y + p.height + 7).toBe(true)
    for (let i = 0; i < SOURCE_QA_ROWS.length; i++) await page.keyboard.press('Tab')
    const reset = page.getByRole('button', { name: '전부 초기화 (게스트)', exact: true })
    await expect(reset).toBeFocused()
    await expect(reset).toBeInViewport()
    await page.screenshot({ path: testInfo.outputPath('qa-panel.png') })
  })
}

test('거래소 상태는 현재 상세를 보존하며 지원 예정 거래소를 활성화하지 않는다', async ({ page }) => {
  await page.goto('/client-state-preview.html')
  await page.getByRole('button', { name: '거래소', exact: true }).click()
  await page.getByRole('button', { name: 'Binance 자세히', exact: true }).click()
  const qa = page.getByRole('button', { name: '데모 상태 조작 패널', exact: true })
  await qa.click()
  await page.locator('[data-qa-key="api"]').click()
  await expect(page.locator('[data-qa-key="login"]')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '연결 관리', exact: true })).toBeVisible()
  await qa.click()
  await page.locator('[data-qa-key="api"]').click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '연결 관리', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'PLAN 및 크레딧', exact: true }).click()
  await page.getByRole('button', { name: '거래소', exact: true }).click()
  await page.getByRole('button', { name: '업비트 자세히', exact: true }).click()
  await expect(page.getByText('지원 예정', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'TETH로 연결', exact: true })).toHaveCount(0)
})

test('조합 중 Escape 보존·일반 Escape 복귀·정상 진입에서는 QA 비노출', async ({ page }) => {
  await page.goto('/client-state-preview.html')
  const trigger = page.getByRole('button', { name: '데모 상태 조작 패널', exact: true })
  await trigger.click()
  const panel = page.getByRole('dialog', { name: '데모 상태 조작', exact: true })
  for (const options of [{ isComposing: true }, { keyCode: 229 }]) {
    await page.locator('[data-qa-key="login"]').evaluate((element, options) => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, ...options }))
    }, options)
    await expect(panel).toBeVisible()
  }
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await page.goto('/')
  await expect(page.locator('.client-source-app')).toBeVisible()
  await expect(trigger).toHaveCount(0)
})

test('게스트 터미널 차단·PLAN 하위 탭·API 해제 시 계좌 pane만 비우고 동일 차트 보존', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/client-state-preview.html')
  const qa = page.getByRole('button', { name: '데모 상태 조작 패널', exact: true })
  await page.getByRole('button', { name: '내 트레이딩', exact: true }).click()
  await expect(page.getByText('로그인하고 바로 시작하세요', { exact: true })).toBeVisible()
  await expect(page.locator('.client-source-terminal')).toHaveCount(0)
  await qa.click()
  await page.locator('[data-qa-key="api"]').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-source-terminal')).toBeVisible()
  const canvas = page.locator('.client-source-terminal canvas').first()
  await expect(canvas).toBeVisible()
  const handle = await canvas.elementHandle()
  await qa.click()
  await page.locator('[data-qa-key="api"]').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ctt-bottom-pane[data-selected="true"]').getByRole('button', { name: '거래소 연결하기', exact: true })).toBeVisible()
  expect(await canvas.evaluate((element, old) => element === old, handle)).toBe(true)
  await page.getByRole('button', { name: 'PLAN 및 크레딧', exact: true }).click()
  const tabs = page.getByRole('navigation', { name: 'PLAN 화면', exact: true })
  for (const name of ['정산', '알림 설정', '플랜']) {
    await tabs.getByRole('button', { name, exact: true }).click()
    await expect(tabs.getByRole('button', { name, exact: true })).toHaveAttribute('aria-current', 'page')
  }
  await qa.click()
  await page.locator('[data-qa-key="login"]').click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '내 트레이딩', exact: true }).click()
  await expect(page.locator('.client-source-terminal')).toHaveCount(0)
})

test('알림 수신 설정은 휘발성 검수 상태에만 반영되고 초기화된다', async ({ page }) => {
  await page.goto('/client-state-preview.html')
  const before = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))
  await page.getByRole('button', { name: '데모 상태 조작 패널', exact: true }).click()
  await page.locator('[data-qa-key="login"]').click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '알림 설정', exact: true }).click()
  const fixed = page.getByRole('switch', { name: '앱 내 수신함', exact: true })
  await expect(fixed).toBeChecked()
  await expect(fixed).toBeDisabled()
  expect(await page.getByRole('switch').count()).toBe(9)
  const pointer = page.getByRole('switch', { name: '포지션 진입/청산', exact: true })
  await pointer.locator('..').click()
  await expect(pointer).not.toBeChecked()
  await pointer.locator('..').click()
  await expect(pointer).toBeChecked()
  for (const control of await page.getByRole('switch').all()) {
    if (await control.isDisabled()) continue
    const checked = await control.isChecked()
    await control.focus()
    await control.press('Space')
    await expect(control).toBeChecked({ checked: !checked })
  }
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })) ).toEqual(before)
  await page.reload()
  await page.getByRole('button', { name: '알림 설정', exact: true }).click()
  await expect(page.getByRole('switch', { name: '포지션 진입/청산', exact: true })).toBeChecked()
})

for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`터미널 ${size.width}×${size.height}: 줄바꿈 헤더 아래 남은 높이 사용`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto('/client-state-preview.html')
    await page.getByRole('button', { name: '데모 상태 조작 패널', exact: true }).click()
    await page.locator('[data-qa-key="api"]').click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '내 트레이딩', exact: true }).click()
    const header = (await page.locator('.source-state-preview > header').boundingBox())!
    const terminal = (await page.locator('.source-preview-terminal').boundingBox())!
    expect(terminal.y).toBeCloseTo(header.y + header.height, 0)
    expect(terminal.y + terminal.height).toBeLessThanOrEqual(size.height + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
