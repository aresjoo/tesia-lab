import { expect, test } from '@playwright/test'
import jobFixtures from './internal-poc/fixtures/native-service-contracts.json' with { type: 'json' }

type FrameAudit = {
  armed: boolean; disposed: boolean; scheduled: number; observerScheduled: number
  executed: number; canceled: number; late: number; pending: Set<number>
}

test('실제 대화 observer의 예약 frame은 unmount에서 취소되고 늦게 실행되지 않는다', async ({ page }, info) => {
  const errors: string[] = [], fixturePatches: number[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const Observer = window.ResizeObserver
    const request = window.requestAnimationFrame.bind(window)
    const cancel = window.cancelAnimationFrame.bind(window)
    const audit: FrameAudit = {
      armed: false, disposed: false, scheduled: 0, observerScheduled: 0,
      executed: 0, canceled: 0, late: 0, pending: new Set<number>(),
    }
    let deliveringThreadResize = false
    Reflect.set(window, 'conversationFrameAudit', audit)
    window.requestAnimationFrame = callback => {
      // Observe the real component's scheduling without replacing its callback.
      // Initial mount and unrelated app frames are outside this bounded audit.
      const tracked = audit.armed && Boolean(new Error().stack?.includes('ClientConversation.tsx'))
      const id = request(time => {
        if (tracked) {
          audit.pending.delete(id)
          audit.executed++
          if (audit.disposed) audit.late++
        }
        callback(time)
      })
      if (tracked) {
        audit.pending.add(id)
        audit.scheduled++
        if (deliveringThreadResize) audit.observerScheduled++
      }
      return id
    }
    window.cancelAnimationFrame = id => {
      if (audit.pending.delete(id)) audit.canceled++
      cancel(id)
    }
    window.ResizeObserver = class extends Observer {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          const threadResize = entries.some(entry => entry.target.matches('.g-thread'))
          deliveringThreadResize = threadResize
          try { callback(entries, observer) }
          finally { deliveringThreadResize = false }
          // Retire synchronously after the real resize callback has queued work,
          // before the browser can run the next animation frame.
          if (audit.armed && threadResize && audit.observerScheduled > 0 && audit.pending.size > 0) {
            audit.armed = false
            Reflect.get(window, 'unmountConversationGrowth')()
            audit.disposed = true
          }
        })
      }
    }
  })
  // Only expose the existing test fixture's root cleanup. Product modules,
  // including ClientConversation and its scheduler, are served unchanged.
  await page.route('**/tests/fixtures/conversation-growth-harness.tsx*', async route => {
    const response = await route.fetch(), body = await response.text()
    const needle = 'createRoot(container).render('
    const count = body.split(needle).length - 1
    expect(count).toBe(1)
    fixturePatches.push(count)
    await route.fulfill({ response, body: body.replace(needle,
      'const cleanupRoot = createRoot(container); Reflect.set(window, "unmountConversationGrowth", () => cleanupRoot.unmount()); cleanupRoot.render(') })
  })
  await page.route('**/conversation-frame-cleanup.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div></body></html>' }))
  await page.goto('/conversation-frame-cleanup.html')
  await page.evaluate(async job => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/tests/fixtures/conversation-growth-harness.tsx'
    const { mountConversationGrowth } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'conversationGrowth', mountConversationGrowth(document.getElementById('fixture'), job))
  }, jobFixtures.sources[3].fixture.cases!.find(item => item.name === 'QUEUED')!.response.data)
  await expect(page.locator('[data-growth-tail]')).toBeInViewport()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const parentCommits = await page.evaluate(() => Reflect.get(window, 'conversationGrowth').parentCommits)
  await page.evaluate(() => {
    const audit = Reflect.get(window, 'conversationFrameAudit') as FrameAudit
    audit.armed = true
    Reflect.get(window, 'conversationGrowth').growChild()
  })
  await expect.poll(() => page.evaluate(() => (Reflect.get(window, 'conversationFrameAudit') as FrameAudit).disposed)).toBe(true)
  await expect(page.locator('.g-scroll')).toHaveCount(0)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const snapshot = await page.evaluate(() => {
    const audit = Reflect.get(window, 'conversationFrameAudit') as FrameAudit
    return { ...audit, pending: audit.pending.size }
  })
  expect(snapshot.armed).toBe(false)
  expect(snapshot.observerScheduled).toBeGreaterThan(0)
  expect(snapshot.scheduled).toBeGreaterThan(0)
  expect(snapshot.canceled).toBeGreaterThan(0)
  expect(snapshot.pending).toBe(0)
  expect(snapshot.late).toBe(0)
  expect(snapshot.scheduled).toBe(snapshot.executed + snapshot.canceled)
  // Repeated later frames cannot resurrect already removed conversation work.
  await page.evaluate(async () => {
    for (let index = 0; index < 4; index++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  })
  expect(await page.evaluate(() => {
    const audit = Reflect.get(window, 'conversationFrameAudit') as FrameAudit
    return { ...audit, pending: audit.pending.size }
  })).toEqual(snapshot)
  expect(await page.evaluate(() => Reflect.get(window, 'conversationGrowth').parentCommits)).toBe(parentCommits)
  expect(fixturePatches).toEqual([1])
  expect(errors).toEqual([])
  await info.attach('conversation-frame-cleanup', { body: JSON.stringify(snapshot), contentType: 'application/json' })
})
