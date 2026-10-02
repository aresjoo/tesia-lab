import { expect, test, type Page } from '@playwright/test'
import { commonBacktestText } from '../src/client-common-backtest-copy'
import { catalogueCopyStorageKey } from '../src/client-catalogue-copy-store'
import { catalogueCopyLocation, sharedHash } from '../src/client-shared-navigation'
import type { ClientLanguage } from '../src/client-preferences'

const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
async function scroll(page: Page, value: number, selector = '.client-source-app') {
  await page.locator(selector).evaluate((node, value) => {
    node.scrollTop = value; node.dispatchEvent(new Event('scroll'))
  }, value)
}
const hidden = (page: Page) => page.locator('.client-hamburger').evaluate(node => node.classList.contains('client-hamburger-scroll-hidden'))

test('actual Main menu follows source 60/4 thresholds, preserves focused/drawer controls and resets on route and viewport', async ({ page }, info) => {
  await page.goto('/#/share')
  const menu = page.locator('.client-hamburger')
  await expect(page.locator('.client-sharing-hub')).toBeVisible()
  await expect.poll(() => page.locator('.client-source-app').evaluate(n => n.scrollHeight - n.clientHeight)).toBeGreaterThan(200)
  // The outer hub mounts before its lazy strategy page and route scroll reset.
  await expect(page.locator('.client-sharing-hub .strategy-list-grid')).toHaveAttribute('aria-busy', 'false')
  await scroll(page, 60)
  expect(await hidden(page)).toBe(false)
  await scroll(page, 64)
  expect(await hidden(page)).toBe(false)
  await scroll(page, 69)
  expect(await hidden(page)).toBe(info.project.name === 'mobile')
  if (info.project.name === 'desktop') return
  await expect(menu).toHaveCSS('opacity', '0')
  await scroll(page, 65)
  expect(await hidden(page)).toBe(true)
  await scroll(page, 66)
  expect(await hidden(page)).toBe(true)
  await scroll(page, 61)
  expect(await hidden(page)).toBe(false)
  await scroll(page, 100)
  expect(await hidden(page)).toBe(true)
  await scroll(page, 60)
  expect(await hidden(page)).toBe(false)
  await menu.focus()
  await scroll(page, 120)
  expect(await hidden(page)).toBe(false)
  await menu.click()
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  await scroll(page, 180)
  expect(await hidden(page)).toBe(false)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await page.locator('.client-source-main').evaluate(n => { n.setAttribute('tabindex', '-1'); n.focus() })
  await scroll(page, 240)
  expect(await hidden(page)).toBe(true)
  await page.evaluate(() => { location.hash = '#/insight' })
  await expect(menu).not.toHaveClass(/client-hamburger-scroll-hidden/)
  await page.evaluate(() => { location.hash = '#/share' })
  await expect(page.locator('.client-sharing-hub')).toBeVisible()
  await scroll(page, 0); await scroll(page, 180)
  expect(await hidden(page)).toBe(true)
  await page.setViewportSize({ width: 900, height: 844 })
  expect(await hidden(page)).toBe(false)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await hidden(page)).toBe(false)
})

async function fixturePage(page: Page, path: string) {
  await page.route(`**/${path}`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><p>표시 전용 Mock fixture · 실제 주문/성과 아님</p><div id="followup-root"></div></body></html>' }))
  await page.goto('/' + path)
  await page.evaluate(async () => {
    const path = '/@react-refresh', runtime = (await import(/* @vite-ignore */ path)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (t: unknown) => t, __vite_plugin_react_preamble_installed__: true })
  })
}

test('terminal portaled menu never adopts body-scroll hiding', async ({ page }) => {
  await fixturePage(page, 'source-menu-portal-test')
  await page.evaluate(async () => {
    const modulePath = '/src/components/ClientChrome.tsx', styles = '/src/client-reference.css'
    const { ClientChrome } = await import(/* @vite-ignore */ modulePath)
    await import(/* @vite-ignore */ styles)
    const runtimeHelperPath = '/tests/fixtures/client-react-runtime.ts'
    const { testClientReactRuntimePaths } = await import(/* @vite-ignore */ runtimeHelperPath)
    const runtimePaths = await testClientReactRuntimePaths()
    const reactPath = runtimePaths.reactPath, domPath = runtimePaths.rootPath
    const React = (await import(/* @vite-ignore */ reactPath)).default, dom = await import(/* @vite-ignore */ domPath)
    const root = document.getElementById('followup-root')!
    root.innerHTML = '<div class="client-source-app"><header id="portal-menu"></header><div id="chrome"></div><main class="client-source-main" tabindex="-1" style="height:200px;overflow:auto"><div style="height:1800px">Terminal body</div></main></div>'
    ;(dom.createRoot ?? dom.default.createRoot)(root.querySelector('#chrome')).render(React.createElement(ClientChrome, {
      signedIn: false, mobileMenuHost: root.querySelector('#portal-menu'), onHome: () => {}, onLogin: () => {}, onSignup: () => {}, onSettings: () => {}, onLocale: () => {}, onDashboard: () => {},
    }))
  })
  await expect(page.locator('#portal-menu .client-hamburger')).toBeAttached()
  await scroll(page, 200, '.client-source-main')
  expect(await hidden(page)).toBe(false)
})

test('body menu ignores textarea edits, horizontal strips and retired hidden scrollports', async ({ page }) => {
  await fixturePage(page, 'source-menu-scrollport-test')
  await page.evaluate(async () => {
    const modulePath = '/src/components/ClientChrome.tsx', { ClientChrome } = await import(/* @vite-ignore */ modulePath)
    const runtimeHelperPath = '/tests/fixtures/client-react-runtime.ts'
    const { testClientReactRuntimePaths } = await import(/* @vite-ignore */ runtimeHelperPath)
    const runtimePaths = await testClientReactRuntimePaths()
    const reactPath = runtimePaths.reactPath, domPath = runtimePaths.rootPath
    const React = (await import(/* @vite-ignore */ reactPath)).default, dom = await import(/* @vite-ignore */ domPath)
    const root = document.getElementById('followup-root')!
    root.innerHTML = '<div class="client-source-app"><div id="chrome"></div><main class="client-source-main"><textarea style="height:40px"></textarea><div id="strip" style="width:100px;height:40px;overflow-x:auto"><div style="width:1000px">Horizontal navigation</div></div><div hidden><div id="retired" style="height:100px;overflow:auto"><div style="height:1000px">Retired view</div></div></div></main></div>'
    root.querySelector('textarea')!.value = Array(30).fill('Draft unchanged').join('\n')
    ;(dom.createRoot ?? dom.default.createRoot)(root.querySelector('#chrome')).render(React.createElement(ClientChrome, {
      signedIn: false, onHome: () => {}, onLogin: () => {}, onSignup: () => {}, onSettings: () => {}, onLocale: () => {}, onDashboard: () => {},
    }))
  })
  await expect(page.locator('.client-hamburger')).toBeAttached()
  await scroll(page, 150, 'textarea')
  await page.locator('#strip').evaluate(node => { node.scrollLeft = 150; node.dispatchEvent(new Event('scroll')) })
  await scroll(page, 150, '#retired')
  expect(await hidden(page)).toBe(false)
  await expect(page.locator('textarea')).toHaveValue(Array(30).fill('Draft unchanged').join('\n'))
})

test('actual Main copy detail restores stop/take labels for a source-calculated open spot position without writing its ledger', async ({ page }) => {
  const owner = 'source-label-qa@example.test'
  await page.addInitScript(owner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '표시 검수', email: owner })), owner)
  await page.goto('/')
  const supplied = await page.evaluate(async owner => {
    const modulePath = '/src/client-catalogue-copy-account.ts'
    const { createCatalogueCopyAccountController } = await import(/* @vite-ignore */ modulePath)
    const previewPath = '/src/client-catalogue-preview.ts', { createCataloguePreviewClient } = await import(/* @vite-ignore */ previewPath)
    const preview = createCataloguePreviewClient()
    const c = createCatalogueCopyAccountController(owner)
    try {
      for (const strategyId of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9']) {
        const supplied = await preview.run(strategyId, 'all')
        if (!supplied.result.state.open) continue
        const id = 'source-label-' + strategyId
        const result = await c.start({ id, strategyId, at: Date.UTC(2026, 8, 1), settings: { amount: 500, loss: -20, existing: 'copy', cap: 95 } })
        if (!result.ok) throw Error(result.error)
        const data = await c.inspect(id, new AbortController().signal)
        if (data.projection.calculation.posOpen && data.value.result.state.open) return { id, sl: data.value.strategy.sl, tp: data.value.strategy.tp }
      }
      throw Error('Source fixture has no open spot-rule position')
    } finally { c.dispose(); preview.dispose() }
  }, owner)
  await page.goto('/' + sharedHash(catalogueCopyLocation(supplied.id)))
  const positions = page.locator('.catalogue-copy-management .cq-positions')
  await expect(positions.locator('.cq-row .a span').first()).toContainText(`${commonBacktestText('ko', 'stop')} ${supplied.sl}%, ${commonBacktestText('ko', 'take')} +${supplied.tp}%`)
  const key = catalogueCopyStorageKey(owner), before = await page.evaluate(key => sessionStorage.getItem(key), key)
  for (const language of languages) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts', { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(positions.locator('.cq-row .a span').first()).toContainText(`${commonBacktestText(language, 'stop')} ${supplied.sl}%, ${commonBacktestText(language, 'take')} +${supplied.tp}%`)
  }
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(before)
})

test('same position presentation uses existing localized Not Set when take profit is null and retains supplied numeric inputs', async ({ page }) => {
  // Expose only the existing private display component in the test HTTP response;
  // product bytes and calculation/store APIs remain untouched.
  await page.route('**/src/components/ClientCatalogueCopyManagement.tsx*', async route => {
    const response = await route.fetch(), body = await response.text()
    expect(body).toContain('function CopyPositions(')
    await route.fulfill({ response, body: body.replace('function CopyPositions(', 'export function CopyPositions(') })
  })
  await fixturePage(page, 'source-copy-rule-null-test')
  await page.evaluate(async () => {
    const path = '/src/components/ClientCatalogueCopyManagement.tsx', { CopyPositions } = await import(/* @vite-ignore */ path)
    const runtimeHelperPath = '/tests/fixtures/client-react-runtime.ts'
    const { testClientReactRuntimePaths } = await import(/* @vite-ignore */ runtimeHelperPath)
    const runtimePaths = await testClientReactRuntimePaths()
    const reactPath = runtimePaths.reactPath, domPath = runtimePaths.rootPath
    const React = (await import(/* @vite-ignore */ reactPath)).default, dom = await import(/* @vite-ignore */ domPath)
    const data = { entry: { record: { status: 'active' } }, value: { strategy: { kind: 'rule', sl: -3, tp: null }, result: { state: { open: { k: '비트코인', tid: 'display-fixture', entry: 0, ep: 100, px: 101, chg: 1 } } } }, projection: { calculation: { posOpen: true, invested: 50, unreal: .5 } } }
    Object.assign(window, { sourceCopyRuleFixture: data })
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('followup-root')).render(React.createElement(CopyPositions, { data, onFlat: () => {}, busy: false }))
  })
  const line = page.locator('.cq-positions .cq-row .a span').first()
  for (const language of languages) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts', { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(line).toContainText(`${commonBacktestText(language, 'stop')} -3%, ${commonBacktestText(language, 'take')} ${commonBacktestText(language, 'noTake')}`)
    await expect(line).not.toContainText('+—%')
  }
  expect(await page.evaluate(() => Reflect.get(window, 'sourceCopyRuleFixture').value.strategy)).toEqual({ kind: 'rule', sl: -3, tp: null })
})
