import { expect, test, type Page } from '@playwright/test'
import { deriveUsagePreview, usageBillPreview, usageGate, usageBannerVisible, usagePresentationBound, usageText, type UsagePresentation, type UsageTier } from '../src/client-usage-presentation'

const scope = 'usage-owner', resetAt = Date.UTC(2026, 10, 1)
const snapshot = (pct: number, tier: UsageTier = 'CARD'): UsagePresentation => ({ source: 'mock', scope, month: '2026-10', tier, pct, creditUsd: 0, resetAt })

test('source aiMeter formula for all tiers, original rounded thresholds and no input mutation', () => {
  for (const tier of ['FREE', 'UID', 'CARD', 'CARD_UID'] as const) {
    for (const pct of [79, 80, 99, 100]) {
      const usedUsd = tier === 'CARD' || tier === 'CARD_UID' ? pct * 2 : 100
      const balanceUsd = tier === 'FREE' || tier === 'UID' ? pct === 100 ? 0 : usedUsd * (100 / pct - 1) : 0
      const input = Object.freeze({ scope, month: '2026-10', tier, usedUsd, balanceUsd, resetAt })
      const meter = deriveUsagePreview(input)!
      expect(meter.pct).toBe(pct)
      expect(meter.resetAt).toBe(resetAt)
      expect(meter.source).toBe('mock')
      for (const action of ['new', 'edit', 'analyze'] as const) expect(usageGate(meter, scope, action)).toBe(pct >= 100 ? 'block' : pct >= 80 ? 'warn' : 'allow')
      expect(usageGate(meter, scope, 'read')).toBe('allow')
    }
  }
  expect(deriveUsagePreview({ scope, month: '2026-10', tier: 'CARD', usedUsd: 199, balanceUsd: 0, resetAt })?.pct).toBe(100)
  expect(deriveUsagePreview({ scope, month: '2026-10', tier: 'CARD_UID', usedUsd: 200, balanceUsd: 50, resetAt })?.pct).toBe(80)
  expect(deriveUsagePreview({ scope, month: '2026-10', tier: 'UID', usedUsd: 10, balanceUsd: -20, resetAt })?.pct).toBe(100)
})

test('unavailable and cross-owner values never become zero usage, and dismissal does not grant admission', () => {
  for (const value of [undefined, null, { ...snapshot(100), source: 'unavailable' as const }, { ...snapshot(100), pct: null }, { ...snapshot(100), scope: 'other' }, { ...snapshot(100), pct: Infinity }, { ...snapshot(100), month: '2026-13' }]) {
    expect(usagePresentationBound(value, scope)).toBe(false)
    expect(usageGate(value, scope, 'new')).toBe('unavailable')
    expect(usageGate(value, scope, 'read')).toBe('allow')
    expect(usageBannerVisible(value, scope)).toBe(false)
  }
  expect(usageGate(undefined, null, 'new')).toBe('allow')
  expect(usageBannerVisible(snapshot(100), null)).toBe(false)
  const dismissed = { scope, month: '2026-10' }
  expect(usageBannerVisible(snapshot(79), scope)).toBe(false)
  expect(usageBannerVisible(snapshot(80), scope, dismissed)).toBe(false)
  expect(usageBannerVisible(snapshot(99), scope, { scope: 'other', month: '2026-10' })).toBe(true)
  expect(usageBannerVisible({ ...snapshot(99), month: '2026-11' }, scope, dismissed)).toBe(true)
  expect(usageBannerVisible(snapshot(100), scope, dismissed)).toBe(true)
  expect(usageGate(snapshot(100), scope, 'new')).toBe('block')
})

test('billing preview arithmetic is explicit, deterministic and refuses absent/nonfinite inputs', () => {
  const input = { scope, month: '2026-10', tier: 'CARD_UID' as const, usedUsd: 250, balanceUsd: 10, resetAt }
  expect(usageBillPreview(input, 280, 50)).toEqual({ source: 'mock', gross: 280, credit: 50, extra: 40, total: 270 })
  expect(usageBillPreview({ ...input, tier: 'CARD' }, 280, 50)).toEqual({ source: 'mock', gross: 280, credit: 0, extra: 50, total: 330 })
  expect(deriveUsagePreview({ ...input, usedUsd: NaN })).toBeNull()
  expect(deriveUsagePreview({ ...input, resetAt: Infinity })).toBeNull()
  expect(usageBillPreview(input, NaN, 50)).toBeNull()
  const meter = deriveUsagePreview(input)
  expect(deriveUsagePreview(input)).toEqual(meter)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) expect(usageText(language, 'warning', { pct: 80 })).toContain('80')
})

async function mount(page: Page, value: UsagePresentation | null, language = 'ko', currentScope: string | null = scope) {
  await page.route('**/usage-component-test', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:#212121;color:#fff"><div id="test-root"></div></body></html>' }))
  await page.goto('/usage-component-test')
  await page.evaluate(async ({ value, language, currentScope }) => {
    localStorage.setItem('tethLang', language)
    const refreshPath = '/@react-refresh'
    const refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (value: unknown) => value, __vite_plugin_react_preamble_installed__: true })
    const runtimeHelperPath = '/tests/fixtures/client-react-runtime.ts'
    const { testClientReactRuntimePaths } = await import(/* @vite-ignore */ runtimeHelperPath)
    const runtimePaths = await testClientReactRuntimePaths()
    const reactPath = runtimePaths.reactPath, domPath = runtimePaths.rootPath
    const bannerPath = '/src/components/ClientUsageBanner.tsx', settingsPath = '/src/components/ClientSettingsUsage.tsx'
    // Let Vite discover dependencies before requesting their optimizer output.
    await fetch('/src/client-bootstrap.tsx').then(response => response.text())
    const [Banner, Settings] = await Promise.all([import(/* @vite-ignore */ bannerPath), import(/* @vite-ignore */ settingsPath)])
    const [reactModule, domModule] = await Promise.all([import(/* @vite-ignore */ reactPath), import(/* @vite-ignore */ domPath)])
    const React = reactModule.default ?? reactModule, Dom = domModule.default ?? domModule
    const element = document.getElementById('test-root')!
    const root = Dom.createRoot(element)
    const state = window as typeof window & { usageRender: (value: unknown, owner?: string | null) => void; usageCalls: number[]; usageAutomatic: boolean[]; usageNext: string[] }
    state.usageCalls = []; state.usageAutomatic = []; state.usageNext = []
    state.usageRender = (presentation, owner = currentScope) => root.render(React.createElement(React.Fragment, null,
      React.createElement(Banner.ClientUsageBanner, { presentation, scope: owner, onNext: (tier: string) => state.usageNext.push(tier) }),
      React.createElement(Settings.ClientSettingsUsage, { presentation, scope: owner, onNext: (tier: string) => state.usageNext.push(tier),
        onTopup: async (amount: number) => { state.usageCalls.push(amount) }, onAutoTopup: async (on: boolean) => { state.usageAutomatic.push(on) } }),
    ))
    state.usageRender(value)
  }, { value, language, currentScope })
  await expect(page.locator('.client-settings-usage')).toBeVisible()
}
const render = (page: Page, value: UsagePresentation, owner = scope) => page.evaluate(({ value, owner }) => (window as typeof window & { usageRender: (value: UsagePresentation, scope: string) => void }).usageRender(value, owner), { value, owner })

test('80% banner dismissal is owner/month bound; full banner cannot be dismissed and results stay readable', async ({ page }) => {
  await mount(page, snapshot(79))
  await expect(page.locator('#g-usebar')).toHaveCount(0)
  await render(page, snapshot(80))
  await expect(page.locator('#g-usebar')).toContainText('80%')
  await page.locator('#g-usebar .use-x').click()
  await expect(page.locator('#g-usebar')).toHaveCount(0)
  await render(page, snapshot(99))
  await expect(page.locator('#g-usebar')).toHaveCount(0)
  await render(page, { ...snapshot(80), month: '2026-11' })
  await expect(page.locator('#g-usebar')).toContainText('80%')
  await render(page, snapshot(100))
  await expect(page.locator('#g-usebar')).toContainText('실행 중인 전략과 결과 보기는 그대로입니다.')
  await expect(page.locator('#g-usebar .use-x')).toHaveCount(0)
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  await render(page, snapshot(100), 'other-owner')
  await expect(page.locator('#g-usebar')).toHaveCount(0)
  await expect(page.locator('.use-h .num')).toHaveText('—')
})

test('guest and unavailable observations show no banner or invented percentage/reset', async ({ page }) => {
  await mount(page, snapshot(100), 'ko', null)
  await expect(page.locator('#g-usebar')).toHaveCount(0)
  await expect(page.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  await expect(page.locator('.use-h .num')).toHaveText('—')
  await expect(page.locator('.client-settings-usage')).not.toContainText('1970')
})

test('source top-up amounts dispatch once; fulfilled callbacks do not fabricate paid credit or automatic setting', async ({ page }) => {
  await mount(page, { ...snapshot(100, 'CARD_UID'), creditUsd: 8, autoTopup: false })
  await page.locator('.client-settings-usage .stg-b').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.use-amt')).toHaveText(['$10', '$25', '$50', '$100'])
  await dialog.getByRole('button', { name: '$25', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as typeof window & { usageCalls: number[] }).usageCalls)).toEqual([25])
  await expect(dialog).toBeVisible()
  await expect(page.locator('.use-h .num')).toHaveText('100%')
  await expect(page.locator('.client-settings-usage .stg-r .num')).toHaveText('$8')
  await dialog.locator('input[type=checkbox]').click()
  await expect.poll(() => page.evaluate(() => (window as typeof window & { usageAutomatic: boolean[] }).usageAutomatic)).toEqual([true])
  await expect(dialog.locator('input[type=checkbox]')).not.toBeChecked()
  await render(page, { ...snapshot(100, 'CARD_UID'), scope: 'other-owner' }, 'other-owner')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.use-h .num')).toHaveText('100%')
})

for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) test(`${language}: source warning and usage page fit narrow screen`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await mount(page, snapshot(80), language)
  await expect(page.locator('#g-usebar')).toContainText('80%')
  await expect(page.locator('.use-h .num')).toHaveText('80%')
  expect(await page.locator('.use-bar').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
})
