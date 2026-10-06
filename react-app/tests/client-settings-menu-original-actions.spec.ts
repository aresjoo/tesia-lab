import { expect, test, type Page } from '@playwright/test'

// KO literals: fixed tesia-lab 9fb index.html:5279/5283. The source rows are
// static KO, but the approved six existing translations must stay localized.
// Foreign literals below are preservation oracles, NOT original-source claims.
const labels = [
  { language: 'ko', support: '고객센터', download: '앱 다운로드' },
  { language: 'en', support: 'Support', download: 'Download' },
  { language: 'ja', support: '24時間サポート', download: 'ダウンロード' },
  { language: 'zh-CN', support: '24/7客服支持', download: '下载' },
  { language: 'zh-TW', support: '24/7客服支援', download: '下載' },
  { language: 'es', support: 'Soporte 24/7', download: 'Descargar' },
  { language: 'fr', support: 'Assistance 24h/24', download: 'Télécharger' },
] as const
type Host = 'Main' | 'Native'
const activeMenu = '.ca-menu-layer[data-surface-active="true"] .ca-settings'

async function bindLanguage(page: Page, language: typeof labels[number]['language']) {
  // Existing language-sync harness: import once, retain the real setter, then
  // invoke synchronously. No product dictionary is used as an expected value.
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'setCopyTradingPreference', setClientPreference)
    await document.fonts.ready
  })
  expect(await page.evaluate(language => {
    const setter = Reflect.get(window, 'setCopyTradingPreference') as typeof import('../src/client-preferences').setClientPreference | undefined
    return typeof setter === 'function' && setter('language', language)
  }, language)).toBe(true)
  await expect(page.locator('html')).toHaveAttribute('lang', language)
}

async function mount(page: Page, host: Host, member: boolean) {
  if (host === 'Main') {
    await page.evaluate(member => {
      if (member) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'Menu reader', email: 'menu@example.test' }))
      else sessionStorage.removeItem('teth-client-profile-preview')
    }, member)
    await page.goto('/')
  } else {
    // The same real Native shell dev-import fixture as drawer-fidelity. Account
    // presentation/actions and site-link mapper are deliberately unprovided.
    // This is controlled UI display, not NativeServiceApp/SDK authentication.
    await page.route('**/menu-original-actions.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="root" style="height:100dvh"></div></body></html>' }))
    await page.goto('/menu-original-actions.html')
    await page.evaluate(async member => {
      const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
      runtime.injectIntoGlobalHook(window)
      Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
      const path = '/src/internal-poc/ClientServiceExperience.tsx'
      const source = await (await fetch(path)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
      if (!reactPath) throw new Error('Existing Vite React instance required')
      const rm = await import(/* @vite-ignore */ reactPath), React = rm.default ?? rm, h = React.createElement
      const domPath = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */ domPath)
      const { ClientServiceExperience: Shell } = await import(/* @vite-ignore */ path)
      const calls: string[] = []
      function Fixture() {
        const [input, setInput] = React.useState('')
        const state = { phase: 'ready', sessionState: member ? 'AUTHENTICATED' : 'ANONYMOUS', messages: [], input, busy: false, inputDisabled: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
          onInput: (value: string) => { calls.push('input'); setInput(value) }, onSend: async () => { calls.push('send') }, onReset: async () => { calls.push('reset') } }
        Reflect.set(window, 'menuNativeState', { input, phase: state.phase, sessionState: state.sessionState, accountCallbacksSupplied: false })
        return h(Shell, { state, nativeAccounts: true, accountScope: 'menu-original-owner' })
      }
      Reflect.set(window, 'menuNativeCalls', calls)
      const root = (DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('root'))
      root.render(h(React.StrictMode, null, h(Fixture)))
    }, member)
    await expect(page.locator('.client-service-app')).toBeVisible()
  }
  // Mobile source drawers are attached but hidden until the hamburger opens.
  if (page.viewportSize()?.width === 320) await expect(page.locator('.client-sidebar')).toBeAttached()
  else await expect(page.locator('.client-sidebar')).toBeVisible()
}

async function openMenu(page: Page, member: boolean, width: number) {
  await page.locator(width === 320 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  await expect(page.locator('.client-sidebar')).toHaveClass(/mobile-open/)
  const trigger = page.locator(`[data-sidebar-action="${member ? 'profile-settings' : 'settings'}"]`)
  await trigger.click()
  await expect(page.locator(activeMenu)).toBeVisible()
  return trigger
}

for (const host of ['Main', 'Native'] as const) for (const oracle of labels) {
  test(`${host} menu [${oracle.language}] ${oracle.language === 'ko' ? 'Korean 대표' : '기존 번역'} 로그인조건·두 action·초안·geometry`, async ({ page, baseURL }, info) => {
    if (!baseURL) throw new Error('Local origin required')
    const width = info.project.name === 'desktop' ? 1440 : 320
    const origin = new URL(baseURL).origin
    const audit = { errors: [] as string[], external: [] as string[], mutations: [] as string[], api: [] as string[] }
    page.on('pageerror', error => audit.errors.push(error.message))
    await page.context().route('**/*', route => {
      const request = route.request(), url = new URL(request.url())
      if (url.origin !== origin) { audit.external.push(request.method()); return route.abort() }
      if (!['GET', 'HEAD'].includes(request.method())) { audit.mutations.push(request.method()); return route.abort() }
      if (url.pathname.startsWith('/api/')) { audit.api.push(url.pathname); return route.abort() }
      return route.continue()
    })
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => { localStorage.setItem('tethLang', 'ko'); sessionStorage.setItem('teth-app-banner-dismissed', '1') })
    // Establish an origin for the Main fixture's real preview storage entry.
    await page.goto('/')
    await mount(page, host, false)
    await bindLanguage(page, oracle.language)
    await openMenu(page, false, width)
    await expect(page.locator(`${activeMenu} > button.gm-item`)).toHaveCount(4)
    await expect(page.locator(activeMenu).getByRole('button', { name: oracle.support, exact: true })).toHaveCount(0)
    await expect(page.locator(activeMenu).getByRole('button', { name: oracle.download, exact: true })).toHaveCount(0)
    await mount(page, host, true)
    await bindLanguage(page, oracle.language)
    const input = page.locator('#strategy-idea'), draft = `menu preserved ${oracle.language}`
    await input.fill(draft)
    const inputNode = await input.elementHandle()
    const trigger = await openMenu(page, true, width)
    const rows = page.locator(`${activeMenu} > button.gm-item`)
    await expect(rows).toHaveCount(8)
    const support = rows.nth(4), download = rows.nth(5)
    expect.soft(await support.innerText(), 'KO source / six preserved translations: support').toBe(oracle.support)
    expect.soft(await download.innerText(), 'KO source / six preserved translations: download').toBe(oracle.download)
    await expect(support).toHaveAccessibleName(oracle.support)
    await expect(download).toHaveAccessibleName(oracle.download)
    const geometry = await page.locator(activeMenu).evaluate(menu => {
      const box = menu.getBoundingClientRect()
      const rows = Array.from(menu.querySelectorAll(':scope > button.gm-item')).slice(4, 6).map(row => {
        const rect = row.getBoundingClientRect(), range = document.createRange()
        range.selectNodeContents(row)
        const text = range.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        return { height: rect.height, textWithin: text.left >= rect.left - 1 && text.right <= rect.right + 1, hit: hit === row || !!hit && row.contains(hit) }
      })
      return { menuWithin: box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1, overflow: document.documentElement.scrollWidth - innerWidth, rows }
    })
    expect(geometry.menuWithin).toBe(true)
    expect(geometry.overflow).toBeLessThanOrEqual(1)
    for (const row of geometry.rows) { expect(row.height).toBe(width === 1440 ? 44 : 58); expect(row.textWithin).toBe(true); expect(row.hit).toBe(true) }
    await support.focus(); await page.keyboard.press('Enter')
    await expect(page.locator('.site-help-pop')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.site-help-pop')).toHaveCount(0)
    // Mobile openFrom retires the drawer/profile row. Its existing logical
    // return target is the visible hamburger, not that unmounted profile row.
    await expect(width === 320 ? page.locator('.client-hamburger') : trigger).toBeFocused()
    await expect(input).toHaveValue(draft)
    expect(await input.evaluate((node, original) => node === original, inputNode)).toBe(true)
    expect(await page.evaluate(() => localStorage.getItem('tethLang'))).toBe(oracle.language)
    if (host === 'Native') expect(await page.evaluate(() => Reflect.get(window, 'menuNativeState'))).toEqual({ input: draft, phase: 'ready', sessionState: 'AUTHENTICATED', accountCallbacksSupplied: false })
    // A foreground help callback may have closed the mobile drawer.
    if (!await page.locator('.client-sidebar').evaluate(node => node.classList.contains('mobile-open'))) await openMenu(page, true, width)
    else { await trigger.click(); await expect(page.locator(activeMenu)).toBeVisible() }
    await page.locator(`${activeMenu} > button.gm-item`).nth(5).click()
    await expect(page.locator(activeMenu)).toHaveCount(0)
    if (host === 'Main') { await expect(page).toHaveURL(/\/download\/$/); await expect(page.locator('.client-info-download')).toBeVisible() }
    else {
      // Unprovided Native mapping remains the existing honest unavailable path.
      await expect(page).toHaveURL(/\/menu-original-actions\.html$/)
      await expect(input).toHaveValue(draft)
      expect(await page.evaluate(() => Reflect.get(window, 'menuNativeCalls'))).toEqual(['input'])
    }
    expect(audit).toEqual({ errors: [], external: [], mutations: [], api: [] })
    await info.attach('menu-original-actions-observed', { body: JSON.stringify({ host, language: oracle.language, width, oracle, geometry, nativeAccountCallbacksSupplied: host === 'Native' ? false : null, audit }), contentType: 'application/json' })
  })
}
