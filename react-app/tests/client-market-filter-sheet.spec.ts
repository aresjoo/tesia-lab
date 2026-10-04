import { expect, test, type Page } from '@playwright/test'

// Source 9fbff821 index.html:2800-2812,18417-18446 uses a bottom sheet at
// <=760px. This public preview checks UI parity, not issued market/backtest data.
const labels = ['시장 전체', '가상자산', '미국 주식', '지수와 금', '여러 시장']
const trigger = (page: Page) => page.getByRole('button', { name: /^시장: / })
const sheet = (page: Page) => page.locator('dialog.client-sharing-sheet')
const menu = (page: Page) => page.getByRole('listbox', { name: '시장', exact: true })
test.use({ trace: 'off', video: 'off' })

async function open(page: Page, width: number, height = 844, reduced = true) {
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '시장 필터 검수', email: 'market-sheet@example.invalid' }))
  })
  await page.goto('/#/share')
  await expect(trigger(page)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

for (const width of [320, 390, 760, 761, 1440]) test(`${width}px source breakpoint, options and geometry`, async ({ page }, info) => {
  await open(page, width)
  await trigger(page).click()
  await expect(menu(page).getByRole('option')).toHaveText(labels.map((label, index) => width <= 760 && index === 0 ? `${label}✓` : label))
  await expect(menu(page).getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
  if (width <= 760) {
    await expect(sheet(page)).toBeVisible()
    await expect(sheet(page).locator('.hd b')).toHaveText('시장 전체')
    const geometry = await sheet(page).locator('.sh').evaluate(element => {
      const r = element.getBoundingClientRect(), s = getComputedStyle(element)
      return { left: r.left, right: r.right, bottom: r.bottom, top: r.top, width: innerWidth, height: innerHeight,
        background: s.backgroundColor, radius: s.borderTopLeftRadius, padding: s.padding, animation: s.animationName }
    })
    expect(geometry.left).toBe(0); expect(geometry.right).toBe(width); expect(geometry.bottom).toBe(geometry.height)
    expect(geometry.top).toBeGreaterThanOrEqual(16)
    expect(geometry.background).toBe('rgb(24, 26, 31)'); expect(geometry.radius).toBe('18px')
    expect(geometry.padding).toBe('6px 14px 14px'); expect(geometry.animation).toBe('none')
    await expect(page.locator('.tfbk-dropwrap .tfbk-menu')).toHaveCount(0)
  } else {
    await expect(sheet(page)).toHaveCount(0)
    await expect(menu(page)).toHaveClass('tfbk-menu')
    expect(await menu(page).evaluate(element => getComputedStyle(element).position)).toBe('absolute')
  }
  await page.screenshot({ path: info.outputPath(`market-${width}.png`) })
  await page.keyboard.press('End')
  await expect(menu(page).getByRole('option').last()).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(menu(page)).toHaveCount(0); await expect(trigger(page)).toBeFocused()
  await expect(trigger(page)).toContainText('여러 시장')
  await trigger(page).click()
  await expect(menu(page).getByRole('option').last()).toHaveAttribute('aria-selected', 'true')
  if (width <= 760) await expect(sheet(page).locator('.hd b')).toHaveText('여러 시장')
  await page.keyboard.press('Escape'); await expect(trigger(page)).toBeFocused()
})

test('mobile Tab wraps, Escape and source scrim/close restore focus without changing selection', async ({ page }) => {
  await open(page, 390)
  for (const dismiss of ['escape', 'scrim', 'close'] as const) {
    await trigger(page).click()
    const close = sheet(page).getByRole('button', { name: '닫기', exact: true })
    await expect(menu(page).getByRole('option').first()).toBeFocused()
    await page.keyboard.press('Tab'); await expect(close).toBeFocused()
    await page.keyboard.press('Tab'); await expect(menu(page).getByRole('option').first()).toBeFocused()
    await page.keyboard.press('Shift+Tab'); await expect(close).toBeFocused()
    if (dismiss === 'escape') await page.keyboard.press('Escape')
    else if (dismiss === 'scrim') await sheet(page).click({ position: { x: 8, y: 8 } })
    else await close.click()
    await expect(sheet(page)).toHaveCount(0); await expect(trigger(page)).toBeFocused()
    await expect(trigger(page)).toContainText('시장 전체')
  }
})

test('open resize crosses 760/761 with one surface, unchanged value and restored locks', async ({ page }) => {
  await open(page, 761)
  const original = await page.evaluate(() => document.body.style.overflowY)
  await trigger(page).click()
  await page.setViewportSize({ width: 760, height: 844 })
  await expect(sheet(page)).toBeVisible(); await expect(menu(page)).toHaveCount(1)
  expect(await page.evaluate(() => document.body.style.overflowY)).toBe('hidden')
  await page.setViewportSize({ width: 761, height: 844 })
  await expect(sheet(page)).toHaveCount(0); await expect(menu(page)).toHaveCount(1)
  await expect(menu(page).getByRole('option').first()).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflowY)).toBe(original)
  await page.setViewportSize({ width: 320, height: 360 })
  await expect(sheet(page)).toBeVisible()
  await page.keyboard.press('End'); await expect(menu(page).getByRole('option').last()).toBeInViewport({ ratio: 1 })
  await page.keyboard.press('Escape'); await expect(trigger(page)).toBeFocused()
  await expect(trigger(page)).toContainText('시장 전체')
  expect(await page.evaluate(() => document.body.style.overflowY)).toBe(original)
})

test('sheet locks the underlying scrollport and removes locks on route unmount', async ({ page }) => {
  await open(page, 390)
  await page.evaluate(() => document.body.style.setProperty('overflow-y', 'auto', 'important'))
  const before = await trigger(page).evaluate(element => {
    const out: { value: string; priority: string; top: number }[] = []
    for (let n = element.parentElement; n; n = n.parentElement) if (/^(auto|scroll)$/.test(getComputedStyle(n).overflowY))
      out.push({ value: n.style.getPropertyValue('overflow-y'), priority: n.style.getPropertyPriority('overflow-y'), top: n.scrollTop })
    return out
  })
  await trigger(page).click()
  expect(await page.evaluate(() => document.body.style.getPropertyValue('overflow-y'))).toBe('hidden')
  await page.mouse.move(8, 8); await page.mouse.wheel(0, 350)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const positions = await trigger(page).evaluate(element => {
    const out: number[] = []
    for (let n = element.parentElement; n; n = n.parentElement) if (n.style.overflowY === 'hidden') out.push(n.scrollTop)
    return out
  })
  expect(positions).toEqual(before.map(item => item.top))
  await page.evaluate(() => { location.hash = '#/share/library' })
  await expect(sheet(page)).toHaveCount(0)
  await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  expect(await page.evaluate(() => ({ value: document.body.style.getPropertyValue('overflow-y'), priority: document.body.style.getPropertyPriority('overflow-y') })))
    .toEqual({ value: 'auto', priority: 'important' })
  await page.getByRole('button', { name: '전략 찾기', exact: true }).click()
  await trigger(page).click(); await page.keyboard.press('Escape')
  const after = await trigger(page).evaluate(element => {
    const out: { value: string; priority: string }[] = []
    for (let n = element.parentElement; n; n = n.parentElement) if (/^(auto|scroll)$/.test(getComputedStyle(n).overflowY))
      out.push({ value: n.style.getPropertyValue('overflow-y'), priority: n.style.getPropertyPriority('overflow-y') })
    return out
  })
  expect(after).toEqual(before.map(({ value, priority }) => ({ value, priority })))
})

test('source sheet entrance animates only transform and scrim, reduced motion removes both', async ({ page }) => {
  await open(page, 390, 844, false)
  await trigger(page).click()
  const animation = await sheet(page).evaluate(element => ({
    sheet: getComputedStyle(element.querySelector('.sh')!).animationName,
    duration: getComputedStyle(element.querySelector('.sh')!).animationDuration,
    scrim: getComputedStyle(element, '::backdrop').animationName,
  }))
  expect(animation).toEqual({ sheet: 'client-sharing-sheet-in', duration: '0.2s', scrim: 'client-sharing-scrim-in' })
  await page.keyboard.press('Escape')
  await page.emulateMedia({ reducedMotion: 'reduce' }); await trigger(page).click()
  expect(await sheet(page).evaluate(element => [getComputedStyle(element.querySelector('.sh')!).animationName, getComputedStyle(element, '::backdrop').animationName])).toEqual(['none', 'none'])
  await page.keyboard.press('Escape'); await expect(sheet(page)).toHaveCount(0)
})

test('180ms exit is visual only and an immediate reopen survives old cleanup', async ({ page }) => {
  await open(page, 390, 844, false)
  const original = await page.evaluate(() => document.body.style.overflowY)
  await trigger(page).click()
  await page.clock.install()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  // Hold CSS end events to isolate the 240ms scheduling-safe fallback. The
  // source's 180ms visual exit and its real end event are checked separately.
  await page.addStyleTag({ content: '.client-sharing-sheet[data-surface-closing="true"] .sh,.client-sharing-sheet[data-surface-closing="true"]::before{animation-play-state:paused!important}' })
  await page.keyboard.press('Escape')
  await expect(sheet(page)).toHaveAttribute('data-surface-closing', 'true')
  await expect(sheet(page)).toHaveAttribute('aria-hidden', 'true')
  expect(await sheet(page).evaluate(element => ({ inert: element.inert, open: (element as HTMLDialogElement).open,
    pointer: getComputedStyle(element).pointerEvents, animation: getComputedStyle(element.querySelector('.sh')!).animationName })))
    .toEqual({ inert: true, open: false, pointer: 'none', animation: 'client-sharing-sheet-out' })
  await expect(trigger(page)).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflowY)).toBe(original)
  await page.clock.runFor(239); await expect(sheet(page)).toHaveCount(1)
  await page.clock.runFor(1); await expect(sheet(page)).toHaveCount(0)
  await trigger(page).click(); await page.keyboard.press('Escape')
  await expect(sheet(page)).toHaveAttribute('data-surface-closing', 'true')
  await trigger(page).click()
  await expect(sheet(page)).toHaveAttribute('data-surface-active', 'true')
  await page.clock.runFor(260)
  await expect(sheet(page)).toHaveCount(1); await expect(menu(page).getByRole('option').first()).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflowY)).toBe('hidden')
  await page.setViewportSize({ width: 761, height: 844 })
  await expect(sheet(page)).toHaveCount(0); await expect(menu(page)).toHaveCount(1)
  expect(await page.evaluate(() => document.body.style.overflowY)).toBe(original)
  await page.keyboard.press('Escape'); await expect(trigger(page)).toBeFocused()
})

test('unmount during exit cancels delayed focus/cleanup and preserves another overflow owner', async ({ page }) => {
  await open(page, 390, 844, false)
  await trigger(page).click()
  await page.clock.install(); await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await page.addStyleTag({ content: '.client-sharing-sheet[data-surface-closing="true"] .sh{animation-play-state:paused!important}' })
  await page.evaluate(() => document.body.style.setProperty('overflow-y', 'clip', 'important'))
  await page.keyboard.press('Escape')
  await expect(sheet(page)).toHaveAttribute('data-surface-closing', 'true')
  await page.evaluate(() => { location.hash = '#/share/library' })
  await expect(sheet(page)).toHaveCount(0)
  await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await page.getByRole('button', { name: '전략 찾기', exact: true }).focus()
  await page.clock.runFor(260)
  await expect(page.getByRole('button', { name: '전략 찾기', exact: true })).toBeFocused()
  expect(await page.evaluate(() => ({ value: document.body.style.getPropertyValue('overflow-y'), priority: document.body.style.getPropertyPriority('overflow-y') })))
    .toEqual({ value: 'clip', priority: 'important' })
})

test('my exchanges remains inline on mobile and keeps its supplied icons and choices', async ({ page }) => {
  await open(page, 390)
  await page.evaluate(async () => {
    const path = '/tests/fixtures/my-exchanges-harness.tsx'
    const { mountMyExchanges } = await import(/* @vite-ignore */ path)
    mountMyExchanges({ ids: ['binance', 'okx', 'bitget'] })
  })
  const exchange = page.locator('.myex-w .tfbk-drop')
  await exchange.click()
  await expect(sheet(page)).toHaveCount(0)
  const inline = page.locator('.myex-w .tfbk-menu')
  await expect(inline).toBeVisible(); await expect(inline.getByRole('option')).toHaveCount(5)
  await expect(inline.locator('.myex-ic img')).toHaveCount(6)
  await page.keyboard.press('Escape'); await expect(exchange).toBeFocused()
})

test('service public Back closes the kept-alive market portal and Forward does not reopen it', async ({ page, baseURL }, info) => {
  const origin = new URL(baseURL!).origin, errors: string[] = [], mutations: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method())) { mutations.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (url.origin !== origin) return route.abort('blockedbyclient')
    if (url.pathname.startsWith('/api/')) {
      const session = url.pathname === '/api/v1/auth/session'
      if (!session && url.pathname !== '/api/v1/auth/csrf') return route.abort('blockedbyclient')
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"market_history_fixture_001"' } : {}, body: JSON.stringify({
        meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_market_history_0001', traceId: 'trace_market_history_0001' },
        data: session ? { sessionId: 'session_market_history_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'csrf_market_history_0001', expiresAt: '2030-01-02T00:00:00Z' },
      }) })
    }
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  await page.goto('/about/')
  await expect(page.locator('.client-info-about')).toBeVisible()
  // Use the real router entry point so the public document stays in history,
  // then the actual service renderer/parent owns the market's open state.
  await page.evaluate(async () => { const path = '/src/site-navigation.ts'; (await import(path)).pushSiteLocation('/#/share') })
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  const original = await page.evaluate(() => document.body.style.overflowY)
  await trigger(page).click()
  await expect(sheet(page)).toBeVisible()
  expect(await sheet(page).locator('.hd').evaluate(element => getComputedStyle(element).position)).toBe('static')
  expect(await sheet(page).locator('.sh').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(24, 26, 31)')
  await expect(sheet(page)).toHaveAccessibleName('시장 전체')
  await page.goBack()
  await expect(page).toHaveURL(/\/about\/$/)
  await expect(sheet(page)).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflowY)).toBe(original)
  await expect(page.locator('#site-main')).toBeFocused()
  const y = await page.evaluate(() => scrollY)
  await page.mouse.move(200, 400); await page.mouse.wheel(0, 350)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y)
  await page.screenshot({ path: info.outputPath('market-public-back.png') })
  await page.goForward()
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false')
  await expect(sheet(page)).toHaveCount(0)
  await trigger(page).click(); await page.keyboard.press('Escape')
  await expect(sheet(page)).toHaveCount(0); await expect(trigger(page)).toBeFocused()
  await expect(page).toHaveURL(/\/#\/share$/)
  await expect(trigger(page)).toContainText('시장 전체')
  expect(errors).toEqual([]); expect(mutations).toEqual([])
})

test('a drag starting in an option and ending on the scrim does not dismiss or select', async ({ page }) => {
  await open(page, 390)
  await trigger(page).click()
  const option = (await menu(page).getByRole('option').nth(1).boundingBox())!
  await page.mouse.move(option.x + option.width / 2, option.y + option.height / 2)
  await page.mouse.down(); await page.mouse.move(8, 8, { steps: 8 }); await page.mouse.up()
  await expect(sheet(page)).toBeVisible()
  await expect(menu(page).getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
  await page.mouse.click(8, 8)
  await expect(sheet(page)).toHaveCount(0); await expect(trigger(page)).toBeFocused()
  await expect(trigger(page)).toContainText('시장 전체')
})

test('source 180ms visual exit reaches animationend before its scheduling fallback', async ({ page }, info) => {
  await open(page, 390, 844, false)
  await trigger(page).click()
  await sheet(page).locator('.sh').evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished))
  })
  await page.evaluate(() => {
    const events: { name: string; elapsed: number }[] = []
    Object.assign(window, { marketExitEvents: events })
    document.querySelector('.client-sharing-sheet .sh')!.addEventListener('animationend', event => {
      const animation = event as AnimationEvent
      events.push({ name: animation.animationName, elapsed: animation.elapsedTime })
    })
  })
  await page.keyboard.press('Escape')
  await expect(sheet(page)).toHaveCount(0)
  const events = await page.evaluate(() => Reflect.get(window, 'marketExitEvents'))
  await info.attach('real-sheet-animation-end', { contentType: 'application/json', body: JSON.stringify(events) })
  expect(events).toEqual([{ name: 'client-sharing-sheet-out', elapsed: 0.18 }])
  await expect(trigger(page)).toBeFocused()
})
