import { expect, test, type Page, type TestInfo } from '@playwright/test'

// Navigation QA only. Auth/CSRF are explicit HTTP fixtures, not real login.
// The long-list case adds only title/date presentation rows, no trading results.
test.setTimeout(60_000)
test.use({ actionTimeout: 10_000 })
const owner = 'session_surface_navigation_001'

async function mount(page: Page, baseURL: string | undefined, authenticated: boolean, longList = false) {
  if (!baseURL) throw new Error('Local baseURL required')
  const origin = new URL(baseURL).origin, mutations: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => { localStorage.setItem('tethLang', 'ko'); localStorage.setItem('tethCurrency', 'KRW') })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method())) { mutations.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (url.origin !== origin) return route.abort('blockedbyclient')
    if (url.pathname.startsWith('/api/')) {
      if (!['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) return route.abort('blockedbyclient')
      const session = url.pathname.endsWith('/session')
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"surface_navigation_001"' } : {}, body: JSON.stringify({
        meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_surface_navigation_001', traceId: 'trace_surface_navigation_001' },
        data: session ? { sessionId: owner, state: authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'csrf_surface_navigation_001', expiresAt: '2030-01-02T00:00:00Z' },
      }) })
    }
    if (request.isNavigationRequest() && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      ${longList ? `const rm = await import('/@id/react'), dm = await import('/@id/react-dom/client'); const React = rm.default ?? rm, dom = dm.default ?? dm;
      const { NativeServiceApp } = await import('/src/internal-poc/NativeServiceApp.tsx');
      const { SiteRouter } = await import('/src/components/SiteRouter.tsx');
      const library = { scope: '${owner}', status: 'ready', onSelect: async () => {}, records: Array.from({length:80}, (_, i) => ({ id:'qa-row-'+i, title:'레이아웃 검수용 긴 연구 제목 '+String(i+1).padStart(3,'0')+' 시장을 살펴보고 투자 아이디어를 정리한 기록', market:'', status:'초안', updatedAt:1900000000000-i*86400000, snapshot:null })) };
      dom.createRoot(document.getElementById('internal-poc-root')).render(React.createElement(React.StrictMode,null,React.createElement(SiteRouter,{service:true},React.createElement(NativeServiceApp,{presentations:{conversationLibrary:library}}))));`
        : `await import('/src/internal-poc/service-main.tsx');`}
      </script></body></html>` })
    return route.continue()
  })
  await page.goto('/')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await page.evaluate(() => document.fonts.ready)
  return { mutations, errors }
}

async function openDrawer(page: Page) {
  const trigger = page.viewportSize()!.width <= 860 ? page.locator('.client-hamburger') : page.locator('.client-rail-logo-row button')
  await trigger.focus()
  await trigger.click()
  await expect(page.locator('.client-sidebar')).toHaveClass(/mobile-open/)
}

async function geometry(page: Page, info: TestInfo, name: string) {
  const data = await page.evaluate(() => {
    const pick = (selector: string) => { const e = document.querySelector<HTMLElement>(selector); if (!e) return null; const b = e.getBoundingClientRect(); return { className:e.className, x:b.x,y:b.y,width:b.width,height:b.height,scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,overflow:getComputedStyle(e).overflowY } }
    return { viewport:{width:innerWidth,height:innerHeight}, documentWidth:document.documentElement.scrollWidth, shell:pick('.client-service-app'), main:pick('.client-source-main'), history:pick('#research-main'), settings:pick('.client-settings-page'), header:pick('.hub-header'), hamburger:pick('.client-hamburger') }
  })
  await info.attach(name, { contentType:'application/json', body:JSON.stringify(data) })
  console.info(`SURFACE_GEOMETRY ${name} ${JSON.stringify(data)}`)
  await page.screenshot({ path:info.outputPath(`${name}.png`) })
  expect.soft(data.documentWidth, 'horizontal viewport overflow').toBeLessThanOrEqual(page.viewportSize()!.width + 1)
}

for (const width of [390, 768, 1440]) {
  test(`${width}px service-main history settings return and language`, async ({ page, baseURL }, info) => {
    await page.setViewportSize({ width, height:900 })
    const evidence = await mount(page, baseURL, true)
    await expect(page.locator('.landing-hero')).toBeVisible()
    await page.locator('#strategy-idea').fill('전송하지 않은 검수용 초안')
    await openDrawer(page)
    await page.locator('.client-research-navigation nav button').first().click()
    await expect(page.locator('#research-main')).toBeVisible()
    await expect(page.locator('.g-hist-row')).toHaveCount(0)
    await expect(page.locator('.g-hist-search input')).toBeDisabled()
    await expect(page.locator('.client-globe')).toHaveCount(0)
    await geometry(page, info, 'history-unavailable')
    await openDrawer(page)
    await page.locator('[data-sidebar-action="profile-settings"]').click()
    await page.getByRole('dialog', { name:'설정', exact:true }).getByRole('button', { name:'설정', exact:true }).click()
    await expect(page.locator('.client-settings-page')).toBeVisible()
    // A list URL needs its detail link; the default settings action opens general directly.
    if (new URL(page.url()).hash === '#/settings') await page.locator('.stg-nav a[href$="/general"]').click()
    for (const language of ['ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko', 'en']) {
      await page.locator('.stg-sel').selectOption(language)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      await expect(page.locator('.stg-sel')).toHaveValue(language)
      await expect(page.locator('.stg .num')).toHaveText('USD')
    }
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('.stg-sel')).toHaveValue('en')
    await expect(page.locator('.stg .num')).toHaveText('USD')
    await geometry(page, info, 'settings-english')
    if (width <= 860) await page.locator('.stg-mback').click()
    await page.locator('.stg-back').click()
    await expect(page.locator('#research-main')).toBeVisible()
    await expect(page.locator('#research-title')).toContainText('Research')
    await page.locator('.hub-header button').click()
    await expect(page.locator('#strategy-idea')).toHaveValue('전송하지 않은 검수용 초안')
    await expect(page.locator('.landing-hero h1')).toBeInViewport()
    expect(await page.evaluate(() => localStorage.getItem('tethCurrency'))).toBe('KRW')
    expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([])
  })

  test(`${width}px explicitly supplied long history keeps last row and header reachable`, async ({ page, baseURL }, info) => {
    await page.setViewportSize({ width, height:900 })
    const evidence = await mount(page, baseURL, true, true)
    await openDrawer(page)
    await page.locator('.client-research-navigation nav button').first().click()
    await expect(page.locator('.g-hist-row').first()).toBeVisible()
    const hub = page.locator('#research-main')
    await geometry(page, info, 'long-history-top')
    await page.mouse.move(width * .7, 700)
    await expect.poll(async () => {
      await page.mouse.wheel(0, 700)
      return page.locator('.g-hist-row').count()
    }, { timeout:15000, intervals:[150] }).toBe(80)
    await page.locator('.g-hist-row').last().scrollIntoViewIfNeeded()
    await expect(page.locator('.g-hist-row').last()).toBeInViewport()
    await geometry(page, info, 'long-history-bottom')
    await expect.soft(page.locator('.hub-header button'), 'sticky return control is reachable at the last row').toBeInViewport()
    await expect.poll(() => page.locator('.hub-header button').evaluate(element => {
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return Boolean(hit && (hit === element || element.contains(hit)))
    }), { message:'return button center must not be covered by app banner or account controls' }).toBe(true)
    expect.soft(await hub.evaluate(e => e.scrollHeight > e.clientHeight && e.scrollTop > 0), 'history must own its bounded scroll instead of overflowing the document').toBe(true)
    await page.mouse.wheel(0, -300)
    await openDrawer(page)
    await expect(page.locator('[data-sidebar-action="profile-settings"]')).toBeInViewport()
    expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([])
  })

  test(`${width}px guest locale selection uses source language-only surface`, async ({ page, baseURL }, info) => {
    await page.setViewportSize({ width, height:900 })
    const evidence = await mount(page, baseURL, false)
    if (width <= 860) {
      await expect(page.locator('.client-globe')).toBeHidden()
      await openDrawer(page)
      await page.locator('[data-sidebar-action="settings"]').click()
      await expect(page.getByRole('dialog', { name:'설정', exact:true })).toBeVisible()
      await expect(page.getByRole('dialog').getByRole('button', { name:/언어|Language/ })).toHaveCount(0)
      await geometry(page, info, 'mobile-guest-menu-no-locale-entry')
      expect(await page.evaluate(() => localStorage.getItem('tethCurrency'))).toBe('KRW')
      expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([])
      return
    }
    for (const [code, label] of [['ja','日本語'], ['zh-CN','简体中文'], ['zh-TW','繁體中文'], ['es','Español'], ['fr','Français'], ['ko','한국어'], ['en','English']]) {
      await page.locator('.client-globe').click()
      await expect(page.locator('.client-locale-panel')).toBeInViewport()
      await expect(page.locator('.client-locale-panel [role=region]')).toHaveCount(1)
      await page.locator('.client-locale-panel button').filter({hasText:label}).click()
      await expect(page.locator('html')).toHaveAttribute('lang', code)
      await expect(page.locator('.client-locale-panel')).toHaveCount(0)
      await expect(page.locator('.client-globe')).toBeFocused()
    }
    await page.locator('.client-globe').click()
    await expect(page.locator('.client-locale-panel button[aria-pressed=true]')).toContainText('English')
    await geometry(page, info, 'guest-locale-english')
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => localStorage.getItem('tethCurrency'))).toBe('KRW')
    expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([])
  })
}
