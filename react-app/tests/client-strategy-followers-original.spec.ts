import { expect, test, type Page, type TestInfo } from '@playwright/test'
import source from '../src/client-catalogue-source.json' with { type: 'json' }

// Independent oracle: fixed 9fb index.html:21876–21878 mkFwHtml, called by
// final skfCard:24637/24641/24645. No later definition/assignment rewrites it.
// Final CSS:7620 overrides the original SVG's 15px attrs to rendered 16px.
const originalPaths = ['M2.8 19.5c.5-3.3 3-5.4 6.2-5.4s5.7 2.1 6.2 5.4', 'M15.2 4.9a3.4 3.4 0 0 1 0 6.3', 'M17.6 14.4c2.1.6 3.4 2.4 3.7 5.1']
const foreign = [['en', 'Followers', 'Information not provided'], ['ja', 'フォロワー', '情報未提供'], ['zh-CN', '跟随人数', '未提供信息'], ['zh-TW', '跟隨人數', '未提供資訊'], ['es', 'Seguidores', 'Información no disponible'], ['fr', 'Abonnés', 'Information non fournie']] as const
const audits = new WeakMap<Page, { errors: string[]; blocked: string[] }>()
test.use({ serviceWorkers: 'block' })

async function guard(page: Page, baseURL: string | undefined) {
  if (!baseURL || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseURL).hostname)) throw Error('LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin, audit = { errors: [] as string[], blocked: [] as string[] }
  audits.set(page, audit)
  page.on('pageerror', () => audit.errors.push('PAGE_ERROR'))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || request.method() !== 'GET' || url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      audit.blocked.push(url.origin !== origin ? 'EXTERNAL' : request.method() !== 'GET' ? 'MUTATION' : 'API')
      return route.abort('blockedbyclient')
    }
    if (url.pathname === '/strategy-followers-original.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0e0f11"><main class="client-strategy-sharing"><div id="fixture"></div></main></body></html>' })
    return route.continue()
  })
  await page.context().routeWebSocket('**', socket => {
    const url = new URL(socket.url())
    if (!(url.origin === origin.replace(/^http/, 'ws') && url.pathname === '/' && url.searchParams.has('token') && [...url.searchParams.keys()].every(key => key === 'token'))) audit.blocked.push('WEBSOCKET')
    socket.close()
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: null, homeDraft: '원문 목록 복귀 초안', sessions: [], sharedFollows: [], storageError: false, recoveryWarning: false }))
  })
}

async function mount(page: Page, native = false) {
  await page.goto('/strategy-followers-original.html')
  await page.evaluate(async native => {
    const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/components/ClientStrategyListCard.tsx'
    const transformed = await (await fetch(componentPath)).text()
    const reactPath = transformed.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw Error('SAME_REACT_REQUIRED')
    const rm = await import(/* @vite-ignore */ reactPath), react = rm.default ?? rm
    const domPath = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ domPath)
    const preferencesPath = '/src/client-preferences.ts', preferences = await import(/* @vite-ignore */ preferencesPath)
    Reflect.set(window, 'followersLanguage', preferences.setClientPreference)
    const stylePath = '/src/client-strategy-sharing.css'; await import(/* @vite-ignore */ stylePath)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    if (native) {
      const nativePath = '/src/internal-poc/NativeStrategies.tsx', { NativeStrategies } = await import(/* @vite-ignore */ nativePath)
      root.render(react.createElement(NativeStrategies, { onReturn() {}, shouldFocus: () => true, onTabChange() {}, signedIn: false }))
    } else {
      const { ClientStrategyListCard } = await import(/* @vite-ignore */ componentPath)
      const counts = [17, 9999, 10000, 10500, 0, undefined, NaN, -1, .5]
      root.render(react.createElement('div', { className: 'strategy-list-container' }, react.createElement('div', { className: 'strategy-list-grid' }, counts.map((followers, i) => react.createElement(ClientStrategyListCard, {
        key: i, title: `원문 경계 ${i}`, asset: 'BTC', followers, performance: null, location: { nick: `row-${i}`, period: 'all' }, onNavigate() {},
      })))))
    }
  }, native)
  await expect(page.locator('.strategy-list-card').first()).toBeVisible()
}

async function receipt(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready)
  const rows = await page.locator('.skf-fw').evaluateAll(nodes => nodes.map(node => ({ text: (node as HTMLElement).innerText, description: node.textContent, overflow: node.scrollWidth - node.clientWidth })))
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  for (const row of rows) expect(row.overflow).toBeLessThanOrEqual(1)
  await info.attach(`${name}.json`, { body: JSON.stringify({ width: await page.evaluate(() => innerWidth), rows }), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath(`${name}.png`) })
}
test.afterEach(async ({ page }) => { expect(audits.get(page)).toEqual({ errors: [], blocked: [] }) })

test('strategy followers original: KO positive 원문·약만 단위·known0 AT·미제공·16px SVG', async ({ page, baseURL }, info) => {
  await guard(page, baseURL); await mount(page)
  const cards = page.locator('.strategy-list-card'), rows = cards.locator('.skf-fw')
  for (const [index, text] of ['17명이 따라가는 중', '9,999명이 따라가는 중', '약 1만명이 따라가는 중', '약 1.1만명이 따라가는 중'].entries()) {
    await expect(rows.nth(index)).toHaveText(text)
    await expect(cards.nth(index).getByRole('link')).toHaveAccessibleDescription(new RegExp(text))
  }
  expect(await rows.nth(4).evaluate(node => { const clone = node.cloneNode(true) as HTMLElement; clone.querySelectorAll('.sr-only').forEach(child => child.remove()); return clone.textContent?.trim() })).toBe('')
  await expect(rows.nth(4).locator('.sr-only')).toHaveCSS('clip-path', 'inset(50%)')
  await expect(rows.nth(4).locator('.sr-only')).toHaveCSS('width', '1px')
  await expect(rows.nth(4).locator('.sr-only')).toHaveCSS('height', '1px')
  await expect(rows.nth(4).locator('svg')).toHaveCount(0)
  await expect(cards.nth(4).getByRole('link')).toHaveAccessibleDescription(/따라가는 사람 0/)
  for (const index of [5, 6, 7, 8]) {
    await expect(rows.nth(index)).toHaveText('따라가는 사람 —정보 미제공')
    await expect(cards.nth(index).getByRole('link')).toHaveAccessibleDescription(/정보 미제공/)
  }
  const icon = rows.first().locator('svg')
  await expect(icon).toHaveAttribute('stroke-width', '1.9')
  await expect(icon).toHaveAttribute('stroke-linecap', 'round')
  await expect(icon).toHaveAttribute('stroke-linejoin', 'round')
  await expect(icon.locator('circle')).toHaveAttribute('cy', '8')
  expect(await icon.locator('path').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).toEqual(originalPaths)
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(icon).toHaveCSS('width', '16px'); await expect(icon).toHaveCSS('height', '16px')
    await receipt(page, info, `ko-${width}`)
  }
})

test('strategy followers original: 다른6언어 기존 count·미제공·같은 link DOM 보존', async ({ page, baseURL }, info) => {
  await guard(page, baseURL); await mount(page)
  const cards = page.locator('.strategy-list-card'), first = await cards.first().getByRole('link').elementHandle()
  for (const [language, label, unavailable] of foreign) {
    await page.evaluate(language => Reflect.get(window, 'followersLanguage')('language', language), language)
    for (const [index, count] of [17, 9999, 10000, 10500, 0].entries()) await expect(cards.nth(index).locator('.skf-fw')).toHaveText(`${label} ${count.toLocaleString(language)}`)
    for (const index of [5, 6, 7, 8]) await expect(cards.nth(index).locator('.skf-fw')).toHaveText(`${label} —${unavailable}`)
    expect(await cards.first().getByRole('link').evaluate((node, old) => node === old, first)).toBe(true)
  }
  await receipt(page, info, 'foreign-fr')
})

test('strategy followers original: 실Main 공급 snapshot·card navigation·검색 DOM·초안 보존', async ({ page, baseURL }, info) => {
  await guard(page, baseURL); await page.goto('/#/share')
  const card = page.locator('.strategy-list-card').first(), first = source.catalogue[0]
  await expect(card.locator('.skf-fw')).toHaveText(`${first.fw.toLocaleString('ko')}명이 따라가는 중`)
  await expect(card.getByRole('link')).toHaveAccessibleDescription(new RegExp(`${first.fw.toLocaleString('ko')}명이 따라가는 중`))
  const search = page.getByRole('searchbox'), before = await search.elementHandle()
  const state = await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', 'en') })
  expect(await search.evaluate((node, old) => node === old, before)).toBe(true)
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', 'ko') })
  const title = await card.locator('h3').innerText()
  await card.getByRole('link').click(); await expect(page.locator('.ss3-dtitle')).toHaveText(title)
  await page.goBack(); await expect(page.locator('.strategy-list-card').first()).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))).toBe(state)
  await receipt(page, info, 'main')
})

test('strategy followers original: Native 미공급 수치 생성0·accessible 미제공 유지', async ({ page, baseURL }, info) => {
  await guard(page, baseURL); await mount(page, true)
  const cards = page.locator('.strategy-list-card')
  await expect(cards).toHaveCount(10)
  for (const card of await cards.all()) {
    await expect(card.locator('.skf-fw')).toHaveText('따라가는 사람 —정보 미제공')
    await expect(card.getByRole('link')).toHaveAccessibleDescription(/정보 미제공/)
    await expect(card.locator('.skf-ret')).toHaveText('최근 30일—정보 미제공')
  }
  await receipt(page, info, 'native-unavailable')
})
