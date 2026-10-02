import { expect, test } from '@playwright/test'
import { createClientSharingPreferencesStore } from '../src/client-sharing-preferences'
import { matchesStrategyClassification, type StrategyClassification } from '../src/client-strategy-classification'
import filterCopy from '../src/client-strategy-filter-copy.json' with { type: 'json' }
import { catalogueStrategies } from '../src/client-catalogue'

test.beforeEach(({ page }) => { page.setDefaultTimeout(15000) })

test('분류는 명시값만 사용하고 두 조건은 AND로 결합한다', () => {
  const rows: StrategyClassification[] = [{}, { kind: 'agent', market: 'stock' }, { kind: 'rule', market: 'crypto' }, { kind: 'mix', market: 'multi' }, { market: 'index' }]
  expect(rows.filter(row => matchesStrategyClassification(row, 'all', 'all'))).toHaveLength(5)
  expect(rows.filter(row => matchesStrategyClassification(row, 'agent', 'stock'))).toEqual([rows[1]])
  expect(rows.filter(row => matchesStrategyClassification(row, 'agent', 'crypto'))).toEqual([])
  expect(rows.filter(row => matchesStrategyClassification(row, 'all', 'index'))).toEqual([rows[4]])
  expect(rows.filter(row => matchesStrategyClassification(row, 'rule', 'index'))).toEqual([])
})

test('신규 필터의 불량 저장값을 자동 복구로 덮어쓰지 않는다', () => {
  for (const value of [null, false, {}, [], 'unknown']) for (const field of ['kind', 'market']) {
    const raw = JSON.stringify({ tab: 'find', sort: 'pick', dir: 'desc', asset: 'all', [field]: value })
    const writes: string[] = [], store = createClientSharingPreferencesStore('filters', { getItem: () => raw, setItem: (_, next) => { writes.push(next) }, removeItem() {} })
    expect(store.getSnapshot().storageError).toBe(true)
    expect(store.retrySave()).toBe(false)
    expect(writes).toEqual([])
  }
})

test('읽기·초기화 실패 뒤 새 선택의 복구는 폐기한 신규 필터를 되살리지 않는다', () => {
  let blocked = true, raw = JSON.stringify({ tab: 'follow', sort: 'fw', dir: 'desc', asset: '이더리움', kind: 'mix', market: 'multi' })
  const store = createClientSharingPreferencesStore('filters', {
    getItem: () => { if (blocked) throw Error('read blocked'); return raw },
    setItem: (_, value) => { raw = value }, removeItem: () => { throw Error('remove blocked') },
  })
  expect(store.clear()).toBe(false)
  expect(store.update({ kind: 'agent' })).toBe(false)
  blocked = false
  expect(store.retrySave()).toBe(true)
  expect(JSON.parse(raw)).toEqual({ tab: 'find', sort: 'pick', dir: 'desc', asset: 'all', kind: 'agent' })
})

test('기존 asset 저장값은 그대로 읽고 새 판단 방식·시장만 명시 선택으로 저장한다', () => {
  let raw = JSON.stringify({ tab: 'find', sort: 'fw', dir: 'desc', asset: '이더리움' })
  const original = raw, writes: string[] = []
  const storage = { getItem: () => raw, setItem: (_: string, value: string) => { raw = value; writes.push(value) }, removeItem: () => { raw = '' } }
  const store = createClientSharingPreferencesStore('filters', storage)
  expect(raw).toBe(original); expect(writes).toEqual([])
  expect(store.update({ kind: 'mix', market: 'stock' })).toBe(true)
  expect(createClientSharingPreferencesStore('filters', storage).getSnapshot().preferences).toMatchObject({ kind: 'mix', market: 'stock', asset: '이더리움' })
  expect(store.clear()).toBe(true)
  expect(store.getSnapshot().preferences.kind).toBeUndefined()
  expect(store.getSnapshot().preferences.market).toBeUndefined()
})

test('원본 판단 방식과 시장을 조합하고 초기화해도 정렬을 보존한다', async ({ page }) => {
  await page.goto('/#/share')
  const kinds = page.getByRole('group', { name: '판단 방식', exact: true })
  await expect(kinds.getByRole('button')).toHaveText(['전체', 'AI 판단', '차트 규칙', '혼합 전략'])
  await kinds.getByRole('button', { name: '차트 규칙', exact: true }).click()
  await expect(kinds.getByRole('button', { name: '차트 규칙', exact: true })).toBeFocused()
  await expect(page.locator('.strategy-kind-help')).toHaveText('정해 둔 가격 조건이 맞을 때만 거래합니다.')
  const market = page.getByRole('button', { name: '시장: 시장 전체', exact: true })
  await market.click()
  await expect(page.getByRole('listbox').getByRole('option')).toHaveText(['시장 전체', '가상자산', '미국 주식', '지수와 금', '여러 시장'])
  await page.getByRole('option', { name: '지수와 금', exact: true }).click()
  const matching = catalogueStrategies.filter(s => s.kind === 'rule' && s.mkt === 'index')
  await expect(page.locator('.strategy-list-card')).toHaveCount(matching.length)
  await expect(page.locator('.strategy-list-card h3')).toHaveText(matching.map(s => s.name))
  await expect(page.locator('.strategy-list-card .strategy-identity-meta').first()).toContainText('차트 규칙')
  await page.getByRole('combobox', { name: '정렬 기준' }).selectOption('fw')
  await kinds.getByRole('button', { name: 'AI 판단', exact: true }).click()
  await page.getByRole('searchbox').fill('존재하지 않는 전략')
  await expect(page.locator('.strategy-list-card')).toHaveCount(0)
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click()
  await expect(kinds.getByRole('button', { name: '전체', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(market).toBeVisible()
  await expect(page.getByRole('combobox', { name: '정렬 기준' })).toHaveValue('fw')
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
})

test('서비스 분류가 없으면 이름이나 parameters로 AI·규칙·시장을 추측하지 않는다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => { const path = '/tests/fixtures/sharing-service-harness.tsx'; (await import(path)).mountSharing(true) })
  const root = page.locator('#sharing-test-root')
  await expect(root.locator('.strategy-list-card')).toHaveCount(1)
  for (const name of ['AI 판단', '차트 규칙', '혼합 전략']) {
    await root.getByRole('group', { name: '판단 방식', exact: true }).getByRole('button', { name, exact: true }).click()
    await expect(root.locator('.strategy-list-card')).toHaveCount(0)
  }
  await root.getByRole('button', { name: '필터 초기화', exact: true }).click()
  await root.getByRole('button', { name: '시장: 시장 전체', exact: true }).click()
  await root.getByRole('option', { name: '가상자산', exact: true }).click()
  await expect(root.locator('.strategy-list-card')).toHaveCount(0)
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) test(`${language} 320px 필터는 번역·초점·입력을 보존하고 긴 항목도 가리지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 960 })
  await page.goto('/#/share')
  const input = page.getByRole('searchbox'), original = await input.elementHandle()
  await input.fill('없는 전략')
  await page.evaluate(async language => {
    const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', language)
    await document.fonts.ready
  }, language)
  const copy = filterCopy[language], group = page.getByRole('group', { name: copy.kindLabel, exact: true })
  await expect(group.getByRole('button')).toHaveText([copy.all, copy.agent, copy.rule, copy.mix])
  // Native title is an accessible description for these text-named buttons;
  // selected buttons point to the visible paragraph instead. Prove both paths.
  for (const value of ['all', 'agent', 'rule', 'mix'] as const) {
    await expect(group.getByRole('button', { name: copy[value], exact: true })).toHaveAccessibleDescription(copy[`${value}Help`])
  }
  await group.getByRole('button', { name: copy.mix, exact: true }).click()
  await expect(group.getByRole('button', { name: copy.mix, exact: true })).toBeFocused()
  await expect(group.getByRole('button', { name: copy.mix, exact: true })).toHaveAccessibleDescription(copy.mixHelp)
  await expect(page.locator('.strategy-kind-help')).toHaveText(copy.mixHelp)
  expect(await input.evaluate((element, before) => element === before, original)).toBe(true)
  await expect(input).toHaveValue('없는 전략')
  const sortBounds = (await page.locator('.strategy-list-sort').boundingBox())!
  const marketBounds = (await page.locator('.tfbk-dropwrap').boundingBox())!
  const searchBounds = (await page.locator('.ss3-search').boundingBox())!
  expect(Math.abs(sortBounds.width - (await group.boundingBox())!.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(marketBounds.y - searchBounds.y)).toBeLessThanOrEqual(1)
  expect(marketBounds.x + marketBounds.width).toBeLessThanOrEqual(searchBounds.x)
  for (const button of await group.getByRole('button').all()) {
    expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  await page.getByRole('button', { name: `${copy.marketLabel}: ${copy.allMarkets}`, exact: true }).click()
  const last = page.getByRole('listbox').getByRole('option').last()
  await last.scrollIntoViewIfNeeded()
  expect(await last.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)) })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath(`filter-${language}-320.png`) })
})

test('공급된 분류는 공개와 같은 컨트롤에서 필터·검색·정렬을 조합한다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => { const path = '/tests/fixtures/sharing-service-harness.tsx'; (await import(path)).mountSharing(true, false, true) })
  const root = page.locator('#sharing-test-root'), cards = root.locator('.strategy-list-card')
  await expect(cards).toHaveCount(4)
  await root.getByRole('group', { name: '판단 방식', exact: true }).getByRole('button', { name: 'AI 판단', exact: true }).click()
  await expect(cards).toHaveCount(1)
  await expect(cards.getByRole('link')).toHaveAttribute('href', /AI%20/)
  await root.getByRole('button', { name: '시장: 시장 전체', exact: true }).click()
  await root.getByRole('option', { name: '미국 주식', exact: true }).click()
  await expect(cards).toHaveCount(1)
  await root.getByRole('searchbox').fill('AI 주식')
  await root.getByRole('combobox', { name: '정렬 기준' }).selectOption('fw')
  await expect(cards).toHaveCount(1)
  await root.getByRole('button', { name: '시장: 미국 주식', exact: true }).click()
  await root.getByRole('option', { name: '가상자산', exact: true }).click()
  await expect(cards).toHaveCount(0)
  await root.getByRole('button', { name: '필터 초기화', exact: true }).click()
  await expect(cards).toHaveCount(4)
  await expect(root.getByRole('searchbox')).toHaveValue('')
})

test('옛 asset은 숨은 필터가 아니며 새 선택은 reload 후 복원된다', async ({ page }) => {
  const owner = 'filter-owner@example.test', key = `teth-sharing-preferences:account:${encodeURIComponent(owner)}`
  const raw = JSON.stringify({ tab: 'find', sort: 'fw', dir: 'desc', asset: '이더리움' })
  await page.addInitScript(({ owner, key, raw }) => {
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '필터 검수', email: owner }))
    if (!localStorage.getItem(key)) localStorage.setItem(key, raw)
  }, { owner, key, raw })
  await page.goto('/#/share')
  await expect(page.locator('.strategy-list-card')).toHaveCount(10)
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw)
  await page.getByRole('group', { name: '판단 방식', exact: true }).getByRole('button', { name: '차트 규칙', exact: true }).click()
  await page.getByRole('button', { name: '시장: 시장 전체', exact: true }).click()
  await page.getByRole('option', { name: '지수와 금', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: '시장: 지수와 금', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: '판단 방식', exact: true }).getByRole('button', { name: '차트 규칙', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.strategy-list-card')).toHaveCount(catalogueStrategies.filter(s => s.kind === 'rule' && s.mkt === 'index').length)
})
