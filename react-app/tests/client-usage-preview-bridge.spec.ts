import { expect, test, type Page } from '@playwright/test'
import { createClientUsagePreviewStore, clientUsagePreviewStorageKey, projectClientUsagePreview } from '../src/use-client-usage-preview'
import { createBillingPreviewState, billingPreviewConfig, type BillingPreviewState } from '../src/client-billing-preview-state'
import { usageGate } from '../src/client-usage-presentation'

const now = Date.UTC(2026, 9, 2, 3), owner = 'usage-bridge-owner'
function billing(scope = owner): BillingPreviewState {
  return { ...createBillingPreviewState(scope), cardOn: true, uidLinked: true, cycleAt: now,
    ledger: [{ id: 'grant', at: now - 2, type: 'grant', reason: 'welcome', amt: 200, ref: null },
      { id: 'debit', at: now - 1, type: 'debit', reason: 'ai', amt: -200, ref: null }] }
}
function memory() {
  const values = new Map<string, string>()
  let fail = false, silent = false, reads = 0, writes = 0
  return { values, stats: () => ({ reads, writes }), failure: (next: boolean) => { fail = next }, silence: (next: boolean) => { silent = next },
    getItem(key: string) { reads++; return values.get(key) ?? null },
    setItem(key: string, value: string) { writes++; if (fail) throw new Error('denied'); if (!silent) values.set(key, value) },
  }
}

test('bridge adds isolated Mock credit, preserves original ledger and stable external-store snapshot', () => {
  const storage = memory(), store = createClientUsagePreviewStore(owner, storage), state = billing(), original = JSON.stringify(state)
  const initial = store.getSnapshot()
  expect(store.getSnapshot()).toBe(initial)
  expect(store.retry()).toBe(true)
  expect(store.getSnapshot()).toBe(initial)
  expect(projectClientUsagePreview(owner, state, now, initial)?.pct).toBe(100)
  expect(store.topup(50)).toBe(true)
  const credited = projectClientUsagePreview(owner, state, now, store.getSnapshot())!
  expect(credited).toMatchObject({ source: 'mock', pct: 80, creditUsd: 50, scope: owner })
  expect(usageGate(credited, owner, 'new')).toBe('warn')
  expect(credited.resetAt).toBe(now + 30 * 864e5)
  expect(store.automatic(true)).toBe(true)
  expect(store.getSnapshot().data?.creditUsd).toBe(50)
  expect(store.dismiss(credited.month)).toBe(true)
  expect(createClientUsagePreviewStore(owner, storage).getSnapshot().data).toEqual(store.getSnapshot().data)
  expect(JSON.stringify(state)).toBe(original)
  expect(billingPreviewConfig.CARD_PLAN_PRICE_USD).toBe(49)
  expect([...storage.values.keys()]).toEqual([clientUsagePreviewStorageKey(owner)])
  expect(createClientUsagePreviewStore('another-owner', storage).getSnapshot().data?.creditUsd).toBe(0)
})

test('blocked writes and silent readback failures never publish successful credit/dismissal; explicit retry recovers', () => {
  for (const mode of ['throw', 'silent'] as const) {
    const storage = memory(), store = createClientUsagePreviewStore(owner, storage), initial = store.getSnapshot().data
    if (mode === 'throw') storage.failure(true); else storage.silence(true)
    expect(store.topup(100)).toBe(false)
    expect(store.getSnapshot().data).toBe(initial)
    expect(store.getSnapshot().error).toBe(mode === 'throw' ? 'storage' : 'readback')
    expect(projectClientUsagePreview(owner, billing(), now, store.getSnapshot())?.source).toBe('unavailable')
    expect(store.dismiss('2026-10')).toBe(false)
    storage.failure(false); storage.silence(false)
    expect(store.retry()).toBe(true)
    expect(store.topup(25)).toBe(true)
    expect(store.getSnapshot().data?.creditUsd).toBe(25)
  }
})

test('corrupt and foreign account bytes are retained; aborted/stale store mutation writes nothing', () => {
  for (const raw of ['{broken', JSON.stringify({ v: 1, owner: 'foreign', revision: 0, creditUsd: 10, autoTopup: true, dismissedMonth: null })]) {
    const storage = memory(), key = clientUsagePreviewStorageKey(owner)
    storage.values.set(key, raw)
    const store = createClientUsagePreviewStore(owner, storage)
    expect(store.getSnapshot().error).toBe('corrupt')
    expect(store.topup(10)).toBe(false)
    expect(store.retry()).toBe(false)
    expect(storage.values.get(key)).toBe(raw)
    expect(storage.stats().writes).toBe(0)
  }
  const storage = memory(), store = createClientUsagePreviewStore(owner, storage)
  expect(store.topup(10, () => false)).toBe(false)
  expect(storage.stats().writes).toBe(0)
  const original = store.getSnapshot()
  expect(projectClientUsagePreview(null, billing(), now, original)).toBeNull()
  expect(projectClientUsagePreview('other', billing(), now, original)?.source).toBe('unavailable')
  const noCycle = { ...billing(), cycleAt: null }
  const projection = projectClientUsagePreview(owner, noCycle, now, original)!
  const local = new Date(now)
  expect(projection.resetAt).toBe(new Date(local.getFullYear(), local.getMonth() + 1, 1).getTime())
  expect(projectClientUsagePreview(owner, noCycle, now, original)).toEqual(projection)
})

async function mount(page: Page) {
  await page.route('**/usage-bridge-test', route => route.fulfill({ contentType: 'text/html', body: '<html><body><div id="test-root"></div></body></html>' }))
  await page.goto('/usage-bridge-test')
  await page.evaluate(async ({ state, now }) => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (value: unknown) => value, __vite_plugin_react_preamble_installed__: true })
    await fetch('/src/client-bootstrap.tsx').then(response => response.text())
    const hookPath = '/src/use-client-usage-preview.ts', bannerPath = '/src/components/ClientUsageBanner.tsx', settingsPath = '/src/components/ClientSettingsUsage.tsx'
    const [Hook, Banner, Settings] = await Promise.all([import(/* @vite-ignore */ hookPath), import(/* @vite-ignore */ bannerPath), import(/* @vite-ignore */ settingsPath)])
    const runtimeHelperPath = '/tests/fixtures/client-react-runtime.ts'
    const { testClientReactRuntimePaths } = await import(/* @vite-ignore */ runtimeHelperPath)
    const runtimePaths = await testClientReactRuntimePaths()
    const reactPath = runtimePaths.reactPath, rootPath = runtimePaths.rootPath
    // flushSync must use the same optimized React DOM internals as createRoot.
    const rootSource = await fetch(rootPath).then(response => response.text())
    const domImport = rootSource.match(/from\s+"([^"\n]*react-dom\.js[^"\n]*)"/)?.[1]
    if (!domImport) throw new Error('REACT_DOM_DEPENDENCY_NOT_FOUND')
    const domPath = new URL(domImport, new URL(rootPath, location.origin)).href
    const React = (await import(/* @vite-ignore */ reactPath)).default, Dom = (await import(/* @vite-ignore */ rootPath)).default, Flush = (await import(/* @vite-ignore */ domPath)).default
    const host = window as typeof window & { usageBridge: ReturnType<typeof Hook.useClientUsagePreview>; usageBridgeRender: (owner: string | null, state: unknown, now?: number) => void; usageOldTopup: (amount: number, signal: AbortSignal) => Promise<void> }
    function App(props: { owner: string | null; state: unknown; now: number }) {
      const bridge = Hook.useClientUsagePreview(props)
      host.usageBridge = bridge
      return React.createElement(React.Fragment, null,
        React.createElement('div', { id: 'scope' }, props.owner ?? 'guest'),
        React.createElement('div', { id: 'storage-error' }, String(bridge.storageError)),
        React.createElement(Banner.ClientUsageBanner, { ...bridge, scope: props.owner }),
        React.createElement(Settings.ClientSettingsUsage, { ...bridge, scope: props.owner }),
      )
    }
    const root = Dom.createRoot(document.getElementById('test-root'))
    host.usageBridgeRender = (owner, nextState, nextNow = now) => Flush.flushSync(() => root.render(React.createElement(App, { owner, state: nextState, now: nextNow })))
    host.usageBridgeRender(state.owner, state)
  }, { state: billing(), now })
  await expect(page.locator('.use-h .num')).toHaveText('100%')
}

test('full Mock screen top-up refreshes usage only; month dismissal restores next month and owner swap rejects late callbacks', async ({ page }) => {
  await mount(page)
  const original = await page.evaluate(() => sessionStorage.getItem('teth-billing-preview:account:usage-bridge-owner'))
  await page.locator('.client-settings-usage .stg-b').click()
  await page.getByRole('dialog').getByRole('button', { name: '$50', exact: true }).click()
  await expect(page.locator('.use-h .num')).toHaveText('80%')
  await expect(page.locator('.client-settings-usage .stg-r .num')).toHaveText('$50')
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
  await page.locator('#g-usebar .use-x').click()
  await expect(page.locator('#g-usebar')).toHaveCount(0)
  await page.evaluate(({ state, now }) => {
    const host = window as typeof window & { usageBridge: { onTopup: (amount: number, signal: AbortSignal) => Promise<void> }; usageOldTopup: (amount: number, signal: AbortSignal) => Promise<void>; usageBridgeRender: (owner: string, state: unknown, now: number) => void }
    host.usageOldTopup = host.usageBridge.onTopup
    host.usageBridgeRender(state.owner, state, now)
  }, { state: billing(), now: Date.UTC(2026, 10, 2, 3) })
  await expect(page.locator('#g-usebar')).toContainText('80%')
  await page.evaluate(({ state, now }) => (window as typeof window & { usageBridgeRender: (owner: string, state: unknown, now: number) => void }).usageBridgeRender(state.owner, state, now), { state: billing('next-owner'), now })
  await expect(page.locator('#scope')).toHaveText('next-owner')
  await expect(page.locator('.use-h .num')).toHaveText('100%')
  expect(await page.evaluate(async () => {
    try { await (window as typeof window & { usageOldTopup: (amount: number, signal: AbortSignal) => Promise<void> }).usageOldTopup(25, new AbortController().signal); return 'accepted' }
    catch { return 'rejected' }
  })).toBe('rejected')
  await expect(page.locator('.client-settings-usage .stg-r .num')).toHaveText('$0')
  expect(await page.evaluate(() => sessionStorage.getItem('teth-billing-preview:account:usage-bridge-owner'))).toBe(original)
})

test('bridge aborts queued owner-late request and never creates the new owner credit', async ({ page }) => {
  await mount(page)
  const result = await page.evaluate(async ({ state, now }) => {
    const host = window as typeof window & { usageBridge: { onTopup: (amount: number, signal: AbortSignal) => Promise<void> }; usageBridgeRender: (owner: string, state: unknown, now: number) => void }
    const pending = host.usageBridge.onTopup(100, new AbortController().signal)
    host.usageBridgeRender(state.owner, state, now)
    try { await pending; return 'accepted' } catch { return 'rejected' }
  }, { state: billing('next-owner'), now })
  expect(result).toBe('rejected')
  expect(await page.evaluate(() => sessionStorage.getItem('teth-usage-ui:preview:usage-bridge-owner'))).toBeNull()
  expect(await page.evaluate(() => sessionStorage.getItem('teth-usage-ui:preview:next-owner'))).toBeNull()
})

test('blocked browser storage keeps unknown usage and never confirms charge; explicit retry restores original percentage', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Object.assign(window, { usageOriginalSetItem: original })
    Storage.prototype.setItem = function (key, value) { if (key.startsWith('teth-usage-ui:preview:')) throw new Error('write blocked'); return original.call(this, key, value) }
  })
  await page.locator('.client-settings-usage .stg-b').click()
  await page.getByRole('dialog').getByRole('button', { name: '$100', exact: true }).click()
  await expect(page.locator('#storage-error')).toHaveText('true')
  await expect(page.locator('.use-h .num')).toHaveText('—')
  await expect(page.locator('#g-usebar')).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('teth-usage-ui:preview:usage-bridge-owner'))).toBeNull()
  await page.evaluate(() => {
    const host = window as typeof window & { usageOriginalSetItem: typeof Storage.prototype.setItem; usageBridge: { retry: () => boolean } }
    Storage.prototype.setItem = host.usageOriginalSetItem
    host.usageBridge.retry()
  })
  await expect(page.locator('#storage-error')).toHaveText('false')
  await expect(page.locator('.use-h .num')).toHaveText('100%')
})
