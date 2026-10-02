import { expect, test, type Page } from '@playwright/test'
import { delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'

const parameters = delegationRecommendedParameters(), evaluated = evaluateDelegation(parameters, 1)
const revised = [8, 10, 15].flatMap(tp => [38, 40, 42, 44, 46].map(rsiTh => ({ ...parameters, tp, rsiTh }))).find(p => evaluateDelegation(p, 1).score >= 80)!
const key = 'teth-client-user-strategies:edit%40example.test'
const record = { id: '1000', createdAt: 1000, name: '내 이더리움 연구', status: 'live', environment: 'paper', parameters,
  score: evaluated.score, ret: evaluated.result.ret, mdd: evaluated.result.mdd, n: evaluated.result.n, winRate: evaluated.result.winRate,
  asset: '이더리움', exchangeId: 'okx', exchangeName: 'OKX', capital: 5000000, version: 'v1.0' }
async function setup(page: Page, patch: object = {}) {
  await page.addInitScript(({ record, key }) => {
    localStorage.setItem('tethCurrency', 'KRW'); localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '수정 검수', email: 'edit@example.test' }))
    if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify([{ sessionId: 'edit-session', record }, { sessionId: 'other-session', record: { ...record, id: '2000', createdAt: 2000, name: '다른 전략' } }]))
  }, { record: { ...record, ...patch }, key })
  await page.goto('/#/trade/bot/1000')
  await expect(page.getByRole('heading', { name: record.name, exact: true })).toBeVisible()
}
const stored = (page: Page) => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), key)
async function edit(page: Page) {
  const trigger = page.getByRole('button', { name: '전략 수정', exact: true })
  await expect(trigger).toBeEnabled(); await trigger.click()
  return page.getByRole('dialog', { name: `전략 수정: ${record.name}`, exact: true })
}
async function pickPassing(page: Page) {
  expect(revised).toBeDefined()
  await page.getByLabel('익절 목표', { exact: true }).selectOption(String(revised.tp))
  await page.getByLabel('진입 RSI 임계', { exact: true }).selectOption(String(revised.rsiTh))
  await page.getByRole('button', { name: '재검증', exact: true }).click()
  await expect(page.getByRole('button', { name: '이 전략에 적용', exact: true })).toBeEnabled()
}
for (const status of ['ready', 'off', 'live']) test(`상세 수정 ${status}: 후보만 검증하고 명시 적용 시 같은 전략·기간·지표를 저장한다`, async ({ page }) => {
  await setup(page, { status })
  const before = await stored(page)
  const storageBefore = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  const dialog = await edit(page)
  await expect(dialog.locator('select')).toHaveCount(4)
  await expect(dialog.getByRole('heading')).toBeFocused()
  await pickPassing(page)
  expect(await stored(page)).toEqual(before)
  await expect(dialog.locator('.user-edit-result')).toBeFocused()
  await dialog.getByRole('button', { name: '이 전략에 적용', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const after = await stored(page), changed = after.find((entry: { record: { id: string } }) => entry.record.id === '1000').record
  const result = evaluateDelegation(revised, 1)
  expect(changed).toEqual({ ...before[0].record, parameters: revised, status: status === 'live' ? 'off' : status,
    score: result.score, ret: result.result.ret, mdd: result.result.mdd, n: result.result.n, winRate: result.result.winRate })
  expect(after.find((entry: { record: { id: string } }) => entry.record.id === '2000')).toEqual(before[1])
  const storageAfter = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  for (const [name, value] of Object.entries(storageBefore)) if (name !== key) expect(storageAfter[name]).toBe(value)
  await expect(page.getByRole('button', { name: '전략 수정', exact: true })).toBeFocused()
  await page.reload()
  expect((await stored(page)).find((entry: { record: { id: string } }) => entry.record.id === '1000').record).toEqual(changed)
  await expect(page.locator('.nfxb-st')).toHaveText(status === 'ready' ? '시작 대기' : '중지됨')
})

test('입력 변경은 통과 후보를 무효화하고 취소·Escape·재진입은 기록을 바꾸지 않는다', async ({ page }) => {
  await setup(page)
  const before = await stored(page)
  const mainStyle = await page.locator('#tesia-main').getAttribute('style')
  const accountStyle = await page.locator('.client-main-account').getAttribute('style')
  let dialog = await edit(page); await pickPassing(page)
  await expect(page.locator('.client-main-account')).toHaveCSS('overflow-y', 'hidden')
  await dialog.getByLabel('손절선', { exact: true }).selectOption('-12')
  await expect(dialog.getByRole('button', { name: '이 전략에 적용', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('status')).toContainText('설정이 바뀌었어요')
  await dialog.getByRole('button', { name: '취소', exact: true }).click()
  await expect(page.getByRole('button', { name: '전략 수정', exact: true })).toBeFocused()
  dialog = await edit(page)
  await expect(dialog.getByLabel('손절선', { exact: true })).toHaveValue(String(parameters.sl))
  await dialog.press('Escape'); await expect(dialog).toHaveCount(0)
  expect(await stored(page)).toEqual(before)
  expect(await page.locator('#tesia-main').getAttribute('style') ?? '').toBe(mainStyle ?? '')
  expect(await page.locator('.client-main-account').getAttribute('style') ?? '').toBe(accountStyle ?? '')
})

for (const width of [320, 1440]) test(`수정 창 ${width}px: 원본 문구·선택·44px 버튼과 낮은 화면 내부 스크롤`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 600 })
  await setup(page)
  const dialog = await edit(page)
  await expect(dialog).toContainText('설정을 바꾸면 같은 검증 구간에서 다시 검증해요. 재검증을 통과해야 이 전략에 적용됩니다. 적용 시 실행이 일시정지돼요.')
  await expect(dialog.getByLabel('손절선').locator('option')).toHaveText(['-3%까지 (짧게 끊기)', '-5%까지 (표준)', '-8%까지 (여유있게)', '-12%까지 (길게 버티기)'])
  await pickPassing(page)
  await dialog.getByRole('button', { name: '이 전략에 적용', exact: true }).scrollIntoViewIfNeeded()
  for (const button of await dialog.locator('button').all()) {
    const rect = await button.boundingBox(); expect(rect!.width).toBeGreaterThanOrEqual(44); expect(rect!.height).toBeGreaterThanOrEqual(44)
    expect(rect!.x).toBeGreaterThanOrEqual(0); expect(rect!.x + rect!.width).toBeLessThanOrEqual(width)
    expect(rect!.y).toBeGreaterThanOrEqual(0); expect(rect!.y + rect!.height).toBeLessThanOrEqual(601)
  }
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: info.outputPath(`user-edit-${width}.png`) })
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
})

test('미공급 설정은 수정 창을 만들지 않고 원본 선택 밖의 저장값은 몰래 바꾸지 않는다', async ({ page }) => {
  await setup(page, { parameters: null, status: 'ready' })
  await expect(page.getByRole('button', { name: '전략 수정', exact: true })).toHaveCount(0)
  await page.evaluate(({ key, record }) => sessionStorage.setItem(key, JSON.stringify([{ sessionId: 'edit-session', record: { ...record, parameters: { ...record.parameters, sl: -7, tp: null, rsiTh: 41 }, status: 'ready' } }])), { key, record })
  await page.reload()
  const dialog = await edit(page)
  await expect(dialog.getByLabel('손절선')).toHaveValue('-7')
  await expect(dialog.getByLabel('익절 목표')).toHaveValue('none')
  await expect(dialog.getByLabel('진입 RSI 임계')).toHaveValue('41')
  await dialog.press('Escape')
})

test('재검증 미달이면 원본 안내만 표시하고 적용 버튼이나 저장을 만들지 않는다', async ({ page }) => {
  await setup(page)
  const before = await stored(page), dialog = await edit(page)
  const failed = [-3, -5, -8, -12].flatMap(sl => [8, 10, 12, 15].map(tp => ({ ...parameters, sl, tp }))).find(p => evaluateDelegation(p, 1).score < 80)!
  expect(failed).toBeDefined()
  await dialog.getByLabel('손절선', { exact: true }).selectOption(String(failed.sl))
  await dialog.getByLabel('익절 목표', { exact: true }).selectOption(String(failed.tp))
  await dialog.getByRole('button', { name: '재검증', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('통과 전에는 적용되지 않아요.')
  await expect(dialog.getByRole('button', { name: '이 전략에 적용', exact: true })).toHaveCount(0)
  expect(await stored(page)).toEqual(before)
  await page.mouse.click(1, 1)
  await expect(dialog).toHaveCount(0)
})
