import { expect, test, type Page } from '@playwright/test'
import { delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'

// Completed public Mock transcript only. This fixture is not a natural-language
// producer, exchange connection, service result, or order execution permission.
const owner = 'conditional-entry@example.test'
const answer = '지정한 가격까지 기다리도록 정리했어요.\n[ORDER {"asset":"이더리움","side":"buy","trigger":2400,"qty":"half","ttl":"7d"}]'
const parameters = delegationRecommendedParameters()
const verified = evaluateDelegation(parameters, 10000000)
const record = { id: '1000', createdAt: 1000, name: '보존할 사용자 연구', status: 'ready', environment: 'paper', parameters,
  score: verified.score, ret: verified.result.ret, mdd: verified.result.mdd, n: verified.result.n, winRate: verified.result.winRate,
  asset: '이더리움', exchangeId: 'okx', exchangeName: 'OKX', chartSymbol: 'BINANCE:ETHUSDT', capital: 10000000, version: 'v1.0' }

function session(id: string, text = answer) {
  return { id, title: id === 'order-a' ? '이더리움 예약 검수' : '비트코인 예약 검수', renamed: true, idea: '예약 미리보기', draft: '',
    pair: 'ETH/USDT', mode: 'dip', timeframe: '일봉', risk: '−8%', takeProfit: '+15%', researchStatus: '검토 필요', phase: 'plan',
    turns: [{ id: 'turn-1', question: '지정 가격에 예약하고 싶어요', answer: text, fullAnswer: text, startedAt: 1000,
      finishedAt: 1100, status: 'done', suggestions: [], phase: 'plan', conditionalOrderOwner: owner }], updatedAt: 4000, workspace: 'conversation', tradingReady: false }
}
async function seed(page: Page, withStrategy = true, invalid = false, excluded?: 'legacy' | 'foreign' | 'observed') {
  const sessions = [session('order-a', invalid ? answer.replace('"side":"buy"', '"side":false') : answer),
    session('order-b', answer.replace('이더리움', '비트코인').replace('2400', '60000'))]
  if (excluded) for (const item of sessions) {
    if (excluded === 'legacy') Reflect.deleteProperty(item.turns[0], 'conditionalOrderOwner')
    if (excluded === 'foreign') item.turns[0].conditionalOrderOwner = 'foreign@example.test'
    if (excluded === 'observed') Object.assign(item.turns[0], { responseSequenceInvalid: true })
  }
  await page.addInitScript(({ owner, record, sessions, withStrategy }) => {
    if (sessionStorage.getItem('conditional-entry-fixture-seeded')) return
    sessionStorage.setItem('conditional-entry-fixture-seeded', '1')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '예약 검수', email: owner }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: 'order-a', homeDraft: '', sessions }))
    if (withStrategy) sessionStorage.setItem(`teth-client-user-strategies:${encodeURIComponent(owner)}`, JSON.stringify([{ sessionId: 'registered', record }]))
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    localStorage.setItem('tethCurrency', 'KRW')
  }, { owner, record, withStrategy, sessions })
  await page.goto('/')
}
async function selectSession(page: Page, title: string) {
  const mobile = page.locator('.client-hamburger')
  if (await mobile.isVisible()) await mobile.click()
  else await page.locator('.client-rail-logo-row button').click()
  await page.locator('.client-sidebar-records .client-session').filter({ hasText: title }).click()
}
async function pendingTab(page: Page) {
  await expect(page.locator('.ctt-terminal')).toBeVisible()
  await expect.poll(() => page.locator('.ctt-terminal').evaluate(node =>
    (node.getAttribute('data-mobile') === 'true') === (node.getBoundingClientRect().width <= 960))).toBe(true)
  const mainTabs = page.getByRole('tablist', { name: '터미널 영역', exact: true })
  if (await mainTabs.isVisible()) await mainTabs.getByRole('tab', { name: '차트', exact: true }).click()
  await page.locator('.ctt-bottom-tabs').getByRole('tab', { name: '미체결 주문', exact: true }).click()
}
const card = (page: Page) => page.locator('.client-conditional-order')
const rows = (page: Page) => page.locator('.ctt-bottom-pane[data-tab-id="open"] .client-conditional-order-row')
async function orderBytes(page: Page) {
  return page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('teth:mock:conditional-orders:'))
    .sort().map(key => ({ key, value: JSON.parse(sessionStorage.getItem(key)!) })))
}

test('실제 메인: 완료 Mock 태그→카드→동일 ID 미체결→취소 및 reload·세션 왕복 보존', async ({ page }) => {
  const errors: string[] = [], external: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (/\/api\/|\/orders(?:\?|$)|\/billing/.test(request.url())) external.push(request.url()) })
  await seed(page)
  await expect(card(page)).toHaveCount(1)
  await expect(page.locator('.tesia-shell')).toContainText('지정한 가격까지 기다리도록 정리했어요.')
  await expect(page.locator('.tesia-shell')).not.toContainText('[ORDER')
  await expect(card(page)).toContainText('ETH가 $2,400')
  const id = await card(page).getAttribute('data-order-id')
  await card(page).getByRole('button', { name: '예약하기', exact: true }).click()
  await expect(card(page)).toHaveClass(/wait/)
  const first = await orderBytes(page)
  expect(first.flatMap(item => item.value.orders)).toHaveLength(1)
  expect(first[0].value.orders[0]).toMatchObject({ id, status: 'wait', namespace: `owner:${owner}` })
  await page.reload()
  await expect(card(page)).toHaveClass(/wait/)
  await expect(card(page)).toHaveAttribute('data-order-id', id!)
  await selectSession(page, '비트코인 예약 검수')
  await expect(card(page)).toContainText('BTC가 $60,000')
  await card(page).getByRole('button', { name: '예약하기', exact: true }).click()
  await selectSession(page, '이더리움 예약 검수')
  await expect(card(page)).toHaveAttribute('data-order-id', id!)
  await card(page).getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  await pendingTab(page)
  await expect(rows(page)).toHaveCount(2)
  // Match the row itself, not a descendant, while keeping punctuation in the ID safe.
  const row = page.locator('.client-conditional-order-row').filter({ hasText: 'ETH' })
  await expect(row).toHaveAttribute('data-order-id', id!)
  await expect(row).toContainText('조건 대기')
  expect(await row.evaluate(node => node.parentElement?.tagName)).toBe('TBODY')
  const table = page.locator('.co-pending-preview .tft-tbl')
  await expect(table.locator('thead th')).toHaveText(['거래소', '전략', '심볼', '방향', '유형', '가격', '수량', '상태', ''])
  const layout = await table.evaluate(node => {
    const wrapper = node.closest('.tft-tblw')!, cell = node.querySelector('td')!
    return { overflow: getComputedStyle(wrapper).overflowX, minWidth: getComputedStyle(node).minWidth,
      padding: getComputedStyle(cell).paddingLeft, clientWidth: wrapper.clientWidth, scrollWidth: wrapper.scrollWidth }
  })
  expect(layout).toMatchObject({ overflow: 'auto', minWidth: '640px', padding: '12px' })
  if (page.viewportSize()!.width < 480) expect(layout.scrollWidth).toBeGreaterThan(layout.clientWidth)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await row.getByRole('button', { name: '취소', exact: true }).click()
  await expect(rows(page)).toHaveCount(1)
  await selectSession(page, '이더리움 예약 검수')
  await expect(card(page)).toHaveClass(/cancel/)
  await page.reload()
  await expect(card(page)).toHaveClass(/cancel/)
  const saved = await orderBytes(page)
  expect(saved.flatMap(item => item.value.orders)).toHaveLength(2)
  expect(saved.flatMap(item => item.value.orders).some(item => item.status === 'done' || item.fillPrice !== undefined)).toBe(false)
  const transcript = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0].turns[0].answer)
  expect(transcript).toBe(answer)
  expect(errors).toEqual([]); expect(external).toEqual([])
})

test('예약만 있는 계정도 터미널에 진입하며 owner 교체는 과거 태그를 재예약하지 않는다', async ({ page }) => {
  await seed(page, false)
  await expect(card(page)).toHaveCount(1)
  await card(page).getByRole('button', { name: '예약하기', exact: true }).click()
  const before = await orderBytes(page)
  await card(page).getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  await pendingTab(page)
  await expect(rows(page)).toHaveCount(1)
  await selectSession(page, '이더리움 예약 검수')
  await page.evaluate(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '다른 계정', email: 'other-conditional@example.test' })))
  await page.reload()
  await expect(card(page)).toHaveCount(0)
  expect(await orderBytes(page)).toEqual(before)
})

test('손상된 ORDER 텍스트는 예약 카드·저장·실행을 만들지 않는다', async ({ page }) => {
  await seed(page, false, true)
  await expect(page.locator('.g-composer')).toBeVisible()
  await expect(card(page)).toHaveCount(0)
  expect(await orderBytes(page)).toEqual([])
})

for (const excluded of ['legacy', 'foreign', 'observed'] as const) test(`${excluded}: 계정 미확인·타계정·서비스 관측 태그는 Mock 예약에 들어오지 않는다`, async ({ page }) => {
  await seed(page, false, false, excluded)
  await expect(page.locator('.g-composer')).toBeVisible()
  await expect(card(page)).toHaveCount(0)
  if (excluded === 'legacy') {
    await expect(page.getByRole('status').filter({ hasText: '예약 미리보기의 계정 정보를 확인할 수 없어요.' })).toBeVisible()
    await expect(page.locator('.tesia-shell')).not.toContainText('[ORDER')
  }
  expect(await orderBytes(page)).toEqual([])
})
