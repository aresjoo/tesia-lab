import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

const cataloguePath = new URL('../../../side-projects/teth-arena/evidence/strategy-discovery/catalogue/catalogue.json', import.meta.url)
const catalogueBody = existsSync(cataloguePath) ? readFileSync(cataloguePath, 'utf8') : ''
const ownerA = 'flow-a@example.test', ownerB = 'flow-b@example.test'
const keyA = 'teth-sharing-watch:account:flow-a%40example.test'
const itemA = 'eval-agent-gemini-aggressive', itemB = 'eval-agent-codex-standard'

test.beforeEach(async ({ page }) => {
  test.skip(process.env.VITE_LOCAL_STRATEGY_CATALOGUE !== 'true', 'Explicit local evaluated catalogue opt-in required.')
  test.skip(!catalogueBody, 'Actual local evaluation artifact not supplied; owner flow is unverified.')
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill({ contentType: 'application/json', body: catalogueBody }))
})

for (const failure of ['denied', 'corrupt'] as const) test(`favorite ${failure} reads are visible, do not overwrite records, and retry recovers`, async ({ page }) => {
  await page.addInitScript(({ owner, key, id, failure }) => {
    if (!sessionStorage.getItem('flow-storage-fixture')) {
      sessionStorage.setItem('flow-storage-fixture', 'ready')
      sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'Flow fixture', email: owner }))
      sessionStorage.setItem(key, failure === 'corrupt' ? '{invalid' : JSON.stringify([id]))
    }
    const original = Storage.prototype.getItem
    Reflect.set(window, 'flowDenyReads', failure === 'denied')
    Reflect.set(window, 'flowReadRawWatch', () => original.call(sessionStorage, key))
    Storage.prototype.getItem = function (value) {
      if (value === key && Reflect.get(window, 'flowDenyReads')) throw new DOMException('Fixture denied', 'SecurityError')
      return original.call(this, value)
    }
  }, { owner: ownerA, key: keyA, id: itemA, failure })
  await page.goto('/#/share/s/' + itemB)
  const error = page.locator('[data-watch-storage-error]')
  await expect(error).toContainText('관심 전략을 읽지 못했어요.')
  await expect(page.locator('.shared-detail-watch')).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'flowReadRawWatch')())).toBe(failure === 'corrupt' ? '{invalid' : JSON.stringify([itemA]))
  await page.locator('.tfbk-bc button').click()
  await expect(error).toBeVisible()
  await page.goto('/#/share/library')
  await expect(error).toBeVisible()
  await expect(page.getByText('아직 따라가는 전략이 없어요', { exact: true })).toHaveCount(0)
  await page.evaluate(({ key, id }) => {
    Reflect.set(window, 'flowDenyReads', false)
    sessionStorage.setItem(key, JSON.stringify([id]))
  }, { key: keyA, id: itemA })
  await error.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(error).toHaveCount(0)
  await expect(page.locator('#research-title')).toBeFocused()
  await expect(page.locator('.client-library-watches .strategy-list-card a')).toHaveAttribute('href', new RegExp(itemA))
  await page.locator('.client-library-watches .strategy-list-card a').click()
  await expect(page.locator('.shared-detail-watch')).toBeEnabled()
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'true')
})

test('Bitget connected fixture filters all actual 32 records without erasing them', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    const path = '/tests/fixtures/my-exchanges-harness.tsx'
    const { mountMyExchanges } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'flowExchangeHarness', mountMyExchanges({ ids: ['bitget'], preview: true }))
  })
  // Dynamic Vite import uses an explicit URL at the browser boundary.
  await expect(page.locator('#myex-test-root .strategy-list-card')).toHaveCount(10)
  await page.locator('.myex-w>button,.myex-w .tfbk-drop').click()
  await expect(page.locator('.myex-note')).toContainText('32개')
  await expect(page.locator('.myex-note')).toContainText('Bitget 전략')
  await expect(page.locator('.myex-note')).not.toContainText('바로 실행')
  const urls: string[] = []
  for (let pageNumber = 1; pageNumber <= 4; pageNumber++) {
    if (pageNumber > 1) await page.getByRole('button', { name: `${pageNumber}페이지`, exact: true }).click()
    urls.push(...await page.locator('#myex-test-root .strategy-list-card a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')!)))
  }
  expect(urls).toHaveLength(32); expect(new Set(urls).size).toBe(32)
})

test('preview owner remount isolates A, B and guest favorites; guest cannot write favorites', async ({ page }) => {
  await page.addInitScript(({ a, b, idA, idB }) => {
    if (sessionStorage.getItem('flow-owner-fixture')) return
    sessionStorage.setItem('flow-owner-fixture', 'ready')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'Flow fixture', email: a }))
    sessionStorage.setItem(`teth-sharing-watch:account:${encodeURIComponent(a)}`, JSON.stringify([idA]))
    sessionStorage.setItem(`teth-sharing-watch:account:${encodeURIComponent(b)}`, JSON.stringify([idB]))
    sessionStorage.setItem('teth-sharing-watch:guest', JSON.stringify(['eval-rule-mean20-reversion']))
  }, { a: ownerA, b: ownerB, idA: itemA, idB: itemB })
  await page.goto('/#/share/library')
  await expect(page.locator('.client-library-watches a')).toHaveAttribute('href', new RegExp(itemA))
  await page.evaluate(b => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'Flow fixture', email: b })), ownerB)
  await page.reload()
  await expect(page.locator('.client-library-watches a')).toHaveAttribute('href', new RegExp(itemB))
  await page.evaluate(() => sessionStorage.removeItem('teth-client-profile-preview'))
  await page.reload()
  await expect(page.locator('.client-library-watches a')).toHaveAttribute('href', /eval-rule-mean20-reversion/)
  await page.locator('.client-library-watches a').click()
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'false')
  await page.locator('.shared-detail-watch').click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('teth-sharing-watch:guest'))).toBe(JSON.stringify(['eval-rule-mean20-reversion']))
  expect(await page.evaluate(key => sessionStorage.getItem(key), keyA)).toBe(JSON.stringify([itemA]))
})


test('library read failure preserves stored favorites without confirmed empty fallback', async ({ page }) => {
  let available = false
  await page.unroute('**/__local/strategy-catalogue.json')
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill(available ? { contentType: 'application/json', body: catalogueBody } : { status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(({ owner, key, id }) => {
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'Flow fixture', email: owner }))
    sessionStorage.setItem(key, JSON.stringify([id]))
  }, { owner: ownerA, key: keyA, id: itemA })
  await page.goto('/#/share/library')
  await expect(page.getByText('9월 평가 자료를 읽지 못했어요.', { exact: false })).toBeVisible()
  await expect(page.getByText('아직 따라가는 전략이 없어요', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), keyA)).toBe(JSON.stringify([itemA]))
  available = true
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.locator('.client-library-watches a')).toHaveAttribute('href', new RegExp(itemA))
})


for (const start of ['account', 'guest'] as const) test(`same mounted sharing component isolates owners when starting as ${start}`, async ({ page }) => {
  const guestItem = 'eval-rule-mean20-reversion'
  const original = { a: JSON.stringify([itemA]), b: JSON.stringify([itemB]), guest: JSON.stringify([guestItem]) }
  await page.goto('/')
  await page.evaluate(async ({ owner, a, b, guest }) => {
    sessionStorage.setItem('teth-sharing-watch:account:flow-a%40example.test', a)
    sessionStorage.setItem('teth-sharing-watch:account:flow-b%40example.test', b)
    sessionStorage.setItem('teth-sharing-watch:guest', guest)
    const path = '/tests/fixtures/evaluated-watch-owner-harness.tsx'
    const { mountEvaluatedWatchOwner } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'evaluatedOwnerHarness', mountEvaluatedWatchOwner({ owner }))
  }, { owner: start === 'account' ? ownerA : null, ...original })
  const library = page.locator('#evaluated-owner-test-root .client-library-watches a')
  const bytes = () => page.evaluate(() => ({ a: sessionStorage.getItem('teth-sharing-watch:account:flow-a%40example.test'), b: sessionStorage.getItem('teth-sharing-watch:account:flow-b%40example.test'), guest: sessionStorage.getItem('teth-sharing-watch:guest') }))
  await expect(library).toHaveAttribute('href', new RegExp(start === 'account' ? itemA : guestItem))
  for (const [owner, id] of (start === 'account' ? [[null, guestItem], [ownerB, itemB], [ownerA, itemA]] : [[ownerA, itemA], [null, guestItem], [ownerA, itemA]]) as [string | null, string][]) {
    await page.evaluate(owner => Reflect.get(window, 'evaluatedOwnerHarness').update({ owner, location: { section: 'library', period: 'all' } }), owner)
    await expect(library).toHaveAttribute('href', new RegExp(id))
    expect(await bytes()).toEqual(original)
    if (owner === null) {
      await library.click()
      await expect(page.locator('#evaluated-owner-test-root .shared-detail-watch')).toHaveAttribute('aria-pressed', 'false')
      await page.locator('#evaluated-owner-test-root .shared-detail-watch').click()
      expect(await page.evaluate(() => Reflect.get(window, 'ownerFixtureAuthIntent'))).toBe('signup')
      expect(await bytes()).toEqual(original)
    }
  }
  await library.click()
  const watch = page.locator('#evaluated-owner-test-root .shared-detail-watch')
  await expect(watch).toHaveAttribute('aria-pressed', 'true')
  await watch.click()
  expect(await bytes()).toEqual({ ...original, a: '[]' })
})

const executionLabels = { ko: 'Bitget', en: 'Bitget', ja: 'Bitget', 'zh-CN': 'Bitget', 'zh-TW': 'Bitget', es: 'Bitget', fr: 'Bitget' }
for (const [language, label] of Object.entries(executionLabels)) test(`actual ${language} cards show planned Bitget execution and load the real exchange logo`, async ({ page }) => {
  await page.addInitScript(language => localStorage.setItem('tethLang', language), language)
  await page.goto('/#/share')
  const cards = page.locator('.strategy-list-card')
  await expect(cards).toHaveCount(10)
  const metadata = cards.locator('.strategy-identity-meta')
  for (const item of await metadata.all()) { await expect(item).toContainText(label); await expect(item).not.toContainText(/Binance|가격 자료|가격자료|Data source/) }
  const logo = metadata.first().locator('img')
  await expect(logo).toBeVisible()
  await expect.poll(() => logo.evaluate(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)).toBe(true)
  const response = await page.request.get(await logo.getAttribute('src') as string)
  expect(response.ok()).toBe(true); expect(response.headers()['content-type']).toMatch(/^image\//)
})
