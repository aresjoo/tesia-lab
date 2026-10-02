import { expect, test, type Locator, type Page } from '@playwright/test'
import { createClientUserStrategyStore, clientUserStrategyKey } from '../src/client-user-strategy-store'
import { delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'

async function seed(page: Page, signedIn = true, running = false, registered = true) {
  // Source18266 opens the alerts terminal only for a real owned Mock record.
  // Compute this fixture through the existing store; no fake metrics/authority.
  const owner = 'research-bell@example.test', data = new Map<string, string>()
  const fixture = createClientUserStrategyStore(owner, { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } })
  const result = evaluateDelegation(delegationRecommendedParameters(), 1)
  fixture.register('bell-owned-fixture', { name: '알림 레이아웃 Mock 전략', parameters: result.parameters, score: result.score,
    ret: result.result.ret, mdd: result.result.mdd, n: result.result.n, winRate: result.result.winRate,
    environment: 'paper', exchangeName: 'Binance', status: 'ready' }, 1000)
  const registrationKey = clientUserStrategyKey(owner), registration = data.get(registrationKey)!
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ signedIn, running, registered, registrationKey, registration }) => {
    const id = 'research-bell', idea = '비트코인 하락 후 반등을 장기적으로 검증하는 연구 제목 '.repeat(5)
    if (signedIn) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수', email: 'research-bell@example.test' }))
    if (signedIn && registered) sessionStorage.setItem(registrationKey, registration)
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: idea, idea, draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'research', researchStatus: running ? '연구 진행 중' : '초안', turns: [{ id: 'turn', question: '검증할 아이디어', answer: '연구 계획', fullAnswer: '연구 계획', startedAt: 1, status: 'done', suggestions: [], phase: 'plan' }], updatedAt: 1 }] }))
  }, { signedIn, running, registered, registrationKey, registration })
  await page.goto('/')
  await expect(page.locator('.rw-title')).toBeVisible()
  if (running) await page.getByRole('button', { name: '연구 시작', exact: true }).click()
}

async function disjointAndHittable(button: Locator, bell: Locator) {
  const a = (await button.boundingBox())!, b = (await bell.boundingBox())!
  expect(a.x + a.width).toBeLessThanOrEqual(b.x - 8)
  const hits = await button.evaluate(node => {
    const r = node.getBoundingClientRect()
    return [.15, .5, .85].map(fraction => node.contains(document.elementFromPoint(r.left + r.width * fraction, r.top + r.height / 2)))
  })
  expect(hits).toEqual([true, true, true])
}

for (const width of [320, 390, 640, 768, 860, 861, 960, 1100]) test(`${width}px 회원 연구 제목·연구 문서 열기/닫기가 알림과 겹치지 않는다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await seed(page)
  const open = page.getByRole('button', { name: '연구 문서 열기', exact: true }), bell = page.getByRole('button', { name: '알림', exact: true })
  await disjointAndHittable(open, bell)
  const title = await page.locator('.rw-heading .g-title span').evaluate(node => ({ ellipsis: getComputedStyle(node).textOverflow, overflow: getComputedStyle(node).overflow, clipped: node.scrollWidth > node.clientWidth }))
  expect(title).toEqual({ ellipsis: 'ellipsis', overflow: 'hidden', clipped: true })
  const tabsBefore = await page.locator('.rw-tabs').boundingBox()
  await open.click()
  const close = page.getByRole('button', { name: '연구 문서 닫기', exact: true })
  await expect(close).toBeVisible()
  await disjointAndHittable(close, bell)
  await close.click()
  await expect(open).toBeFocused()
  expect(await page.locator('.rw-tabs').boundingBox()).toEqual(tabsBefore)
  const tabFrame = await page.locator('.rw-tabs').evaluate(node => {
    const header = node.parentElement!, r = node.getBoundingClientRect(), h = header.getBoundingClientRect(), css = getComputedStyle(header)
    // Source g-chead places title/actions and tabs on one desktop row.
    // On wrapped mobile rows the tabs may use the whole content width.
    const peers = Array.from(header.querySelectorAll('.rw-title > *')).map(element => element.getBoundingClientRect())
      .filter(box => box.width > 0 && Math.min(box.bottom, r.bottom) - Math.max(box.top, r.top) > 1)
    const occupied = peers.reduce((sum, box) => sum + box.width, 0) + peers.length * parseFloat(css.columnGap)
    return { actual: r.width, expected: h.width - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight) - occupied }
  })
  expect(tabFrame.actual).toBeCloseTo(tabFrame.expected, 0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await bell.click()
  // The final client override opens the terminal's alerts pane, not a new route.
  await expect(page).toHaveURL(/#\/trade$/)
  // Narrow layouts expose this as a region; wide layouts use a tabpanel.
  await expect(page.getByRole('heading', { name: '알림', exact: true })).toBeVisible()
})

test('계정 없는 연구는 원본 제목·패널 여백을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await seed(page, false)
  await expect(page.locator('.client-account-utility')).toHaveCount(0)
  expect(await page.locator('.rw-title').evaluate(node => getComputedStyle(node).paddingRight)).toBe('0px')
  await page.getByRole('button', { name: '연구 문서 열기', exact: true }).click()
  expect(await page.locator('.rw-aux-heading').first().evaluate(node => getComputedStyle(node).paddingRight)).toBe('10px')
  await page.getByRole('button', { name: '연구 문서 닫기', exact: true }).click()
  await expect(page.getByRole('button', { name: '연구 문서 열기', exact: true })).toBeFocused()
})

test('1100px 밖의 원본 상시 아티팩트 레이아웃과 제목 여백은 변경하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await seed(page)
  await expect(page.getByRole('button', { name: '연구 문서 열기', exact: true })).toBeHidden()
  expect(await page.locator('.rw-title').evaluate(node => getComputedStyle(node).paddingRight)).toBe('0px')
  await expect(page.locator('.rw-aux')).toBeVisible()
})

test('320px 연구 진행 배지가 있어도 버튼은 겹치지 않고 키보드 닫기가 복귀한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await seed(page, true, true)
  await expect(page.locator('.rw-title > .g-tag')).toBeVisible()
  const open = page.getByRole('button', { name: '연구 문서 열기', exact: true }), bell = page.getByRole('button', { name: '알림', exact: true })
  await disjointAndHittable(open, bell)
  await open.focus(); await page.keyboard.press('Enter')
  const close = page.getByRole('button', { name: '연구 문서 닫기', exact: true })
  await disjointAndHittable(close, bell)
  await close.focus(); await page.keyboard.press('Enter')
  await expect(open).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})


test('소유 전략이 없는 연구의 알림 이동은 다른 전략을 빌려 터미널을 만들지 않는다', async ({ page }) => {
  await seed(page, true, false, false)
  await page.getByRole('button', { name: '알림', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade$/)
  await expect(page.locator('.txh')).toBeVisible()
  await expect(page.locator('.txh-hero h1')).toContainText('판단해 거래합니다')
  await expect(page.getByRole('heading', { name: '알림', exact: true })).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), clientUserStrategyKey('research-bell@example.test'))).toBeNull()
})
