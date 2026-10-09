import { expect, test, type Page } from '@playwright/test'
import {
  resolveClientHelpConfig,
  validateZendeskWidgetIdentifier,
  zendeskSnippetUrl,
} from '../src/client-help-config'

const widgetIdentifier = '00000000-1111-4222-8333-444444444444'
const snippetUrl = zendeskSnippetUrl(widgetIdentifier)

declare global {
  interface Window {
    __zendeskCalls: unknown[][]
  }
}

async function installPublicConfig(page: Page, value: unknown) {
  await page.addInitScript(value => {
    Object.assign(window, { TETH_CONFIG: { zendeskKey: value }, __zendeskCalls: [] })
  }, value)
}

test('public identifier resolution is own-property bounded and runtime-explicit', async ({ page }) => {
  expect(validateZendeskWidgetIdentifier(widgetIdentifier)).toBe(widgetIdentifier)
  for (const invalid of [undefined, null, 1, {}, '', ' ', 'key?token=x', 'key/value', '한글', 'a'.repeat(129)]) {
    expect(validateZendeskWidgetIdentifier(invalid), String(invalid)).toBeNull()
  }
  expect(resolveClientHelpConfig(undefined, widgetIdentifier)).toEqual({ zendeskWidgetIdentifier: widgetIdentifier })
  expect(resolveClientHelpConfig({}, widgetIdentifier)).toEqual({ zendeskWidgetIdentifier: widgetIdentifier })
  expect(resolveClientHelpConfig({ zendeskKey: '' }, widgetIdentifier)).toEqual({ zendeskWidgetIdentifier: null })
  expect(resolveClientHelpConfig({ zendeskKey: 'bad/value' }, widgetIdentifier)).toEqual({ zendeskWidgetIdentifier: null })
  expect(resolveClientHelpConfig(Object.create({ zendeskKey: widgetIdentifier }))).toEqual({ zendeskWidgetIdentifier: null })
  const accessor = Object.defineProperty({}, 'zendeskKey', { get: () => { throw new Error('must not run') } })
  expect(resolveClientHelpConfig(accessor, widgetIdentifier)).toEqual({ zendeskWidgetIdentifier: null })

  const external: string[] = []
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) external.push(request.url()) })
  await installPublicConfig(page, '')
  await page.goto('/about/')
  const trigger = page.locator('.site-help-trigger')
  await trigger.focus(); await page.keyboard.press('Enter')
  const popup = page.locator('.site-help-pop')
  await expect(popup.locator('h2')).toHaveText('24/7 고객지원')
  await expect(popup.locator('p').first()).toHaveText('무엇이든 물어보십시오. 상담원이 연중무휴 24시간 대기하고 있습니다.')
  await expect(popup.locator('a[href="/about/#faq"]')).toHaveCount(1)
  await expect(popup.locator('a[href="/policies/#overview"]')).toHaveCount(1)
  await expect(popup).toHaveCSS('animation-name', 'client-help-in')
  await expect(popup.locator('.help-close')).toBeFocused()
  await expect(page.locator(`#ze-snippet`)).toHaveCount(0)
  expect(external).toEqual([])
})

test('configured click injects the exact snippet once, opens once, and retries after load error', async ({ page }) => {
  await installPublicConfig(page, widgetIdentifier)
  let attempts = 0
  await page.route(snippetUrl, route => {
    attempts++
    if (attempts === 1) return route.abort('failed')
    return route.fulfill({
      contentType: 'application/javascript',
      body: `window.zE=(...args)=>window.__zendeskCalls.push(args);`,
    })
  })
  await page.goto('/about/')
  const trigger = page.locator('.site-help-trigger')
  await trigger.click()
  await expect.poll(() => attempts).toBe(1)
  await expect(page.locator('#ze-snippet')).toHaveCount(0)
  await expect(page.locator('.site-help-pop')).toBeVisible()
  await page.locator('.site-help-pop .help-close').click()

  await trigger.click()
  await expect.poll(() => attempts).toBe(2)
  await expect.poll(() => page.evaluate(() => window.__zendeskCalls)).toEqual([['webWidget', 'open']])
  await expect(page.locator('#ze-snippet')).toHaveCount(1)
  await expect(page.locator('#ze-snippet')).toHaveAttribute('src', snippetUrl)
  await trigger.click()
  await expect.poll(() => page.evaluate(() => window.__zendeskCalls.length)).toBe(2)
  expect(attempts).toBe(2)
})

test('closing or unmounting while the snippet loads prevents stale widget open', async ({ page }) => {
  await installPublicConfig(page, widgetIdentifier)
  let releaseRequest: (() => void) | undefined
  let requests = 0
  await page.route(snippetUrl, async route => {
    requests++
    await new Promise<void>(resolve => { releaseRequest = resolve })
    await route.fulfill({
      contentType: 'application/javascript',
      body: `window.zE=(...args)=>window.__zendeskCalls.push(args);`,
    })
  })
  await page.goto('/about/')
  await page.evaluate(async () => {
    const ReactModule = await import(/* @vite-ignore */'/@id/react')
    const React = ReactModule.default ?? ReactModule
    const dom = await import(/* @vite-ignore */'/@id/react-dom/client')
    const { SiteHelp } = await import(/* @vite-ignore */'/src/components/ClientHelp.tsx')
    const host = document.createElement('div'); host.id = 'widget-harness'; document.body.appendChild(host)
    const root = (dom.createRoot ?? dom.default.createRoot)(host)
    root.render(React.createElement(SiteHelp))
    Reflect.set(window, '__unmountHelpHarness', () => root.unmount())
  })
  await page.locator('#widget-harness .site-help-trigger').click()
  await expect.poll(() => requests).toBe(1)
  await page.evaluate(() => Reflect.get(window, '__unmountHelpHarness')())
  releaseRequest?.()
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, 'zE'))).toBe('function')
  expect(await page.evaluate(() => window.__zendeskCalls)).toEqual([['webWidget', 'hide']])
})

test('configured failures use the unchanged fallback for an invalid incumbent or a loaded snippet without zE', async ({ page }) => {
  await installPublicConfig(page, widgetIdentifier)
  let requests = 0
  await page.route(snippetUrl, route => {
    requests++
    return route.fulfill({ contentType: 'application/javascript', body: '/* widget API unavailable */' })
  })
  await page.goto('/about/')
  const trigger = page.locator('.site-help-trigger')
  await page.evaluate(() => {
    const incumbent = document.createElement('div')
    incumbent.id = 'ze-snippet'
    document.body.appendChild(incumbent)
  })
  await trigger.click()
  const popup = page.locator('.site-help-pop')
  await expect(popup).toBeVisible()
  await expect(popup.locator('h2')).toHaveText('24/7 고객지원')
  expect(requests).toBe(0)
  await popup.locator('.help-close').click()
  await page.locator('#ze-snippet').evaluate(element => element.remove())

  await trigger.click()
  await expect.poll(() => requests).toBe(1)
  await expect(popup).toBeVisible()
  await expect(page.locator('#ze-snippet')).toHaveCount(0)
  expect(await page.evaluate(() => window.__zendeskCalls)).toEqual([])
  await popup.locator('.help-close').click()
  await page.unroute(snippetUrl)
  await page.route(snippetUrl, route => {
    requests++
    return route.abort('failed')
  })
  await trigger.click()
  await expect.poll(() => requests).toBe(2)
  await expect(popup).toBeVisible()
  await expect(page.locator('#ze-snippet')).toHaveCount(0)
})

test('explicit close before a failed configured load suppresses a stale fallback', async ({ page }) => {
  await installPublicConfig(page, widgetIdentifier)
  let releaseRequest: (() => void) | undefined
  let requests = 0
  await page.route(snippetUrl, async route => {
    requests++
    await new Promise<void>(resolve => { releaseRequest = resolve })
    await route.abort('failed')
  })
  await page.goto('/about/')
  await page.evaluate(async () => {
    const ReactModule = await import(/* @vite-ignore */'/@id/react')
    const React = ReactModule.default ?? ReactModule
    const dom = await import(/* @vite-ignore */'/@id/react-dom/client')
    const { SiteHelp } = await import(/* @vite-ignore */'/src/components/ClientHelp.tsx')
    const host = document.createElement('div'); host.id = 'controlled-help-harness'; document.body.appendChild(host)
    const root = (dom.createRoot ?? dom.default.createRoot)(host)
    const render = (open: boolean) => root.render(React.createElement(SiteHelp, { initialOpen: true, open }))
    render(true)
    Reflect.set(window, '__closeControlledHelpHarness', () => render(false))
  })
  await expect.poll(() => requests).toBe(1)
  const popup = page.locator('.site-help-pop')
  await expect(popup).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, '__closeControlledHelpHarness')())
  releaseRequest?.()
  await expect(popup).toHaveCount(0)
  await expect(page.locator('#ze-snippet')).toHaveCount(0)
  expect(await page.evaluate(() => window.__zendeskCalls)).toEqual([])
})

test('double click and StrictMode join one shared loading snippet and open once', async ({ page }) => {
  await installPublicConfig(page, widgetIdentifier)
  const releases: Array<() => void> = []
  let requests = 0
  await page.route(snippetUrl, async route => {
    requests++
    await new Promise<void>(resolve => releases.push(resolve))
    await route.fulfill({
      contentType: 'application/javascript',
      body: `window.zE=(...args)=>window.__zendeskCalls.push(args);`,
    })
  })
  await page.goto('/about/')
  const trigger = page.locator('.site-help-trigger')
  await trigger.click()
  await trigger.click()
  await expect.poll(() => requests).toBe(1)
  releases.shift()?.()
  await expect.poll(() => page.evaluate(() => window.__zendeskCalls)).toEqual([
    ['webWidget', 'open'],
  ])

  await page.evaluate(() => {
    Reflect.deleteProperty(window, 'zE')
    document.getElementById('ze-snippet')?.remove()
    window.__zendeskCalls = []
  })
  await page.evaluate(async () => {
    const ReactModule = await import(/* @vite-ignore */'/@id/react')
    const React = ReactModule.default ?? ReactModule
    const dom = await import(/* @vite-ignore */'/@id/react-dom/client')
    const { SiteHelp } = await import(/* @vite-ignore */'/src/components/ClientHelp.tsx')
    const host = document.createElement('div'); host.id = 'strict-widget-harness'; document.body.appendChild(host)
    const root = (dom.createRoot ?? dom.default.createRoot)(host)
    root.render(React.createElement(React.StrictMode, null, React.createElement(SiteHelp, { initialOpen: true })))
    Reflect.set(window, '__unmountStrictHelpHarness', () => root.unmount())
  })
  await expect.poll(() => requests).toBe(2)
  releases.shift()?.()
  await expect.poll(() => page.evaluate(() => window.__zendeskCalls)).toEqual([
    ['webWidget', 'open'],
  ])
  expect(requests).toBe(2)
  await page.evaluate(() => Reflect.get(window, '__unmountStrictHelpHarness')())
})

test('configured initial open paints no fallback or focus trap until a load failure', async ({ page }) => {
  await installPublicConfig(page, widgetIdentifier)
  let releaseSuccess: (() => void) | undefined
  let requests = 0
  await page.route(snippetUrl, async route => {
    requests++
    await new Promise<void>(resolve => { releaseSuccess = resolve })
    await route.fulfill({
      contentType: 'application/javascript',
      body: `window.zE=(...args)=>window.__zendeskCalls.push(args);`,
    })
  })
  await page.goto('/about/')
  const footerHelp = page.locator('.client-site-footer .gft-col').nth(2).locator('button').first()
  await footerHelp.click()
  await expect.poll(() => requests).toBe(1)
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
  await expect(page.locator('.help-close')).toHaveCount(0)
  releaseSuccess?.()
  await expect.poll(() => page.evaluate(() => window.__zendeskCalls)).toEqual([
    ['webWidget', 'open'],
  ])
  await expect(page.locator('.site-help-pop')).toHaveCount(0)

  await page.unroute(snippetUrl)
  let releaseFailure: (() => void) | undefined
  await page.route(snippetUrl, async route => {
    requests++
    await new Promise<void>(resolve => { releaseFailure = resolve })
    await route.abort('failed')
  })
  await page.reload()
  const reloadedFooterHelp = page.locator('.client-site-footer .gft-col').nth(2).locator('button').first()
  await reloadedFooterHelp.click()
  await expect.poll(() => requests).toBe(2)
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
  await expect(page.locator('.help-close')).toHaveCount(0)
  releaseFailure?.()
  const fallback = page.locator('.site-help-pop')
  await expect(fallback).toBeVisible()
  await expect(fallback.locator('.help-close')).toBeFocused()
})

test('a completed non-owned same-source snippet without zE falls back immediately', async ({ page }) => {
  await installPublicConfig(page, widgetIdentifier)
  let requests = 0
  await page.route(snippetUrl, route => {
    requests++
    return route.fulfill({
      contentType: 'application/javascript',
      body: '/* completed incumbent without widget API */',
    })
  })
  await page.goto('/about/')
  await page.evaluate(source => new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = 'ze-snippet'
    script.src = source
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('incumbent failed')), { once: true })
    document.body.appendChild(script)
  }), snippetUrl)
  expect(requests).toBe(1)
  await page.locator('.site-help-trigger').click()
  await expect(page.locator('.site-help-pop')).toBeVisible()
  expect(requests).toBe(1)
  await expect(page.locator('#ze-snippet')).toHaveAttribute('src', snippetUrl)
  expect(await page.evaluate(() => Reflect.get(window, 'zE'))).toBeUndefined()

  await page.locator('.site-help-pop .help-close').click()
  await page.evaluate(async () => {
    const ReactModule = await import(/* @vite-ignore */'/@id/react')
    const React = ReactModule.default ?? ReactModule
    const dom = await import(/* @vite-ignore */'/@id/react-dom/client')
    const { SiteHelp } = await import(/* @vite-ignore */'/src/components/ClientHelp.tsx')
    const host = document.createElement('div'); host.id = 'completed-incumbent-initial-open'; document.body.appendChild(host)
    const root = (dom.createRoot ?? dom.default.createRoot)(host)
    root.render(React.createElement(SiteHelp, { initialOpen: true }))
  })
  await expect(page.locator('#completed-incumbent-initial-open .site-help-pop')).toBeVisible()
  expect(requests).toBe(1)
})

test('closing a configured fallback clears it before successful reopen', async ({ page }) => {
  await installPublicConfig(page, widgetIdentifier)
  const releases: Array<(success: boolean) => void> = []
  let requests = 0
  await page.route(snippetUrl, async route => {
    requests++
    const success = await new Promise<boolean>(resolve => releases.push(resolve))
    if (!success) return route.abort('failed')
    return route.fulfill({
      contentType: 'application/javascript',
      body: `window.zE=(...args)=>window.__zendeskCalls.push(args);`,
    })
  })
  await page.goto('/about/')
  await page.evaluate(async () => {
    const ReactModule = await import(/* @vite-ignore */'/@id/react')
    const React = ReactModule.default ?? ReactModule
    const dom = await import(/* @vite-ignore */'/@id/react-dom/client')
    const { SiteHelp } = await import(/* @vite-ignore */'/src/components/ClientHelp.tsx')
    const host = document.createElement('div'); host.id = 'fallback-reopen-harness'; document.body.appendChild(host)
    const root = (dom.createRoot ?? dom.default.createRoot)(host)
    let open = true
    const render = (next: boolean) => {
      open = next
      root.render(React.createElement(SiteHelp, {
        initialOpen: true,
        open,
        onClose: () => {
          Reflect.set(window, '__fallbackCloseCount', Number(Reflect.get(window, '__fallbackCloseCount') ?? 0) + 1)
          render(false)
        },
      }))
    }
    Reflect.set(window, '__renderFallbackHarness', render)
    Reflect.set(window, '__fallbackCloseCount', 0)
    render(true)
  })

  const popup = page.locator('#fallback-reopen-harness .site-help-pop')
  await expect.poll(() => requests).toBe(1)
  releases.shift()?.(false)
  await expect(popup).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, '__fallbackCloseCount'))).toBe(1)

  await page.evaluate(() => Reflect.get(window, '__renderFallbackHarness')(true))
  await expect.poll(() => requests).toBe(2)
  await expect(popup).toHaveCount(0)
  releases.shift()?.(true)
  await expect.poll(() => page.evaluate(() => window.__zendeskCalls)).toEqual([['webWidget', 'open']])
  await expect(popup).toHaveCount(0)

  await page.evaluate(() => {
    Reflect.deleteProperty(window, 'zE')
    document.getElementById('ze-snippet')?.remove()
    window.__zendeskCalls = []
    Reflect.get(window, '__renderFallbackHarness')(true)
  })
  await expect.poll(() => requests).toBe(3)
  releases.shift()?.(false)
  await expect(popup).toBeVisible()
  await page.evaluate(() => Reflect.get(window, '__renderFallbackHarness')(false))
  await expect(popup).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, '__renderFallbackHarness')(true))
  await expect.poll(() => requests).toBe(4)
  await expect(popup).toHaveCount(0)
  releases.shift()?.(true)
  await expect.poll(() => page.evaluate(() => window.__zendeskCalls)).toEqual([['webWidget', 'open']])
  await expect(popup).toHaveCount(0)
})

test('superseding a pending configured instance closes its original host', async ({ page }) => {
  await installPublicConfig(page, widgetIdentifier)
  let releaseRequest: (() => void) | undefined
  let requests = 0
  await page.route(snippetUrl, async route => {
    requests++
    await new Promise<void>(resolve => { releaseRequest = resolve })
    await route.fulfill({
      contentType: 'application/javascript',
      body: `window.zE=(...args)=>window.__zendeskCalls.push(args);`,
    })
  })
  await page.goto('/about/')
  await page.evaluate(async () => {
    const ReactModule = await import(/* @vite-ignore */'/@id/react')
    const React = ReactModule.default ?? ReactModule
    const dom = await import(/* @vite-ignore */'/@id/react-dom/client')
    const { SiteHelp } = await import(/* @vite-ignore */'/src/components/ClientHelp.tsx')
    const firstHost = document.createElement('div'); firstHost.id = 'supersede-a'; document.body.appendChild(firstHost)
    const secondHost = document.createElement('div'); secondHost.id = 'supersede-b'; document.body.appendChild(secondHost)
    const firstRoot = (dom.createRoot ?? dom.default.createRoot)(firstHost)
    const secondRoot = (dom.createRoot ?? dom.default.createRoot)(secondHost)
    const renderFirst = (open: boolean) => firstRoot.render(React.createElement(SiteHelp, {
      initialOpen: true,
      open,
      onClose: () => {
        Reflect.set(window, '__supersededCloseCount', Number(Reflect.get(window, '__supersededCloseCount') ?? 0) + 1)
        renderFirst(false)
      },
    }))
    Reflect.set(window, '__supersededCloseCount', 0)
    renderFirst(true)
    secondRoot.render(React.createElement(SiteHelp))
  })
  await expect.poll(() => requests).toBe(1)
  await page.locator('#supersede-b .site-help-trigger').click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__supersededCloseCount'))).toBe(1)
  await expect(page.locator('#supersede-a .site-help-pop')).toHaveCount(0)
  expect(requests).toBe(1)
  releaseRequest?.()
  await expect.poll(() => page.evaluate(() => window.__zendeskCalls)).toEqual([['webWidget', 'open']])
  expect(await page.evaluate(() => Reflect.get(window, '__supersededCloseCount'))).toBe(1)
})
