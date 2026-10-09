import { expect, test, type Page } from '@playwright/test'

// Independent visual oracle: help-widget.js@9fbff821:29–30,69 and
// index.html:26680–26682. The empty title <i> is decoration, not a live
// support availability producer. Run Main and the actual Native service entry.
async function mount(page: Page, baseURL: string | undefined, surface: 'Main' | 'Native') {
  if (!baseURL) throw new Error('Local test origin required')
  const origin = new URL(baseURL).origin
  const mutations: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method())) { mutations.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (url.origin !== origin) return route.abort('blockedbyclient')
    if (url.pathname.startsWith('/api/')) {
      if (surface !== 'Native' || !['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) return route.abort('blockedbyclient')
      const session = url.pathname.endsWith('/session')
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"help_decoration_anonymous_001"' } : {}, body: JSON.stringify({
        meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_help_decoration_0001', traceId: 'trace_help_decoration_0001' },
        data: session ? { sessionId: 'session_help_decoration_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'csrf_help_decoration_0001', expiresAt: '2030-01-02T00:00:00Z' },
      }) })
    }
    if (surface === 'Native' && request.isNavigationRequest() && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  await page.goto('/')
  if (surface === 'Native') await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  else await expect(page.locator('#strategy-idea')).toBeVisible()
  return { mutations, errors }
}

for (const surface of ['Main', 'Native'] as const) for (const width of [320, 390, 1440]) {
  test(`${surface} 도움말 제목 원본 장식 ${width}px는 접근성 이름과 준비 안내를 보존한다`, async ({ page, baseURL }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const evidence = await mount(page, baseURL, surface)
    const trigger = page.locator('.site-help-trigger:visible')
    await trigger.focus()
    await page.keyboard.press('Enter')
    const panel = page.locator('.site-help-pop')
    await expect(panel).toBeVisible()
    const heading = panel.getByRole('heading', { level: 2, name: '24/7 고객지원', exact: true })
    await expect(heading).toHaveAccessibleName('24/7 고객지원')
    await expect(heading).toHaveText('24/7 고객지원')
    const decoration = heading.locator(':scope > i')
    await expect(decoration).toHaveCount(1)
    await expect(decoration).toHaveAttribute('aria-hidden', 'true')
    await expect(decoration).toHaveText('')
    expect(await decoration.evaluate(element => ({ role: element.getAttribute('role'), title: element.getAttribute('title'), label: element.getAttribute('aria-label'), tabIndex: (element as HTMLElement).tabIndex }))).toEqual({ role: null, title: null, label: null, tabIndex: -1 })
    await expect(panel.locator(':scope > p').first()).toHaveText('무엇이든 물어보십시오. 상담원이 연중무휴 24시간 대기하고 있습니다.')
    await expect(panel.locator(':scope > p').last()).toHaveText('상담원이 24시간 답합니다. support@teth.ai')
    // The existing outer button decoration has a distinct original 11px size.
    await expect(trigger.locator('.help-status-dot')).toHaveCSS('width', '11px')
    await expect(trigger.locator('.help-status-dot')).toHaveCSS('height', '11px')
    await page.evaluate(() => document.fonts.ready)
    const geometry = await heading.evaluate(element => {
      const style = getComputedStyle(element), rect = element.getBoundingClientRect()
      const point = element.querySelector('i')!, pointStyle = getComputedStyle(point), pointRect = point.getBoundingClientRect()
      const textNode = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())!
      const range = document.createRange(); range.selectNodeContents(textNode)
      const textRects = [...range.getClientRects()]
      const panel = element.closest<HTMLElement>('.site-help-pop')!, panelRect = panel.getBoundingClientRect()
      const closeRect = panel.querySelector('.help-close')!.getBoundingClientRect()
      return {
        display: style.display, alignItems: style.alignItems, gap: style.gap,
        margin: style.margin, lineHeight: style.lineHeight,
        point: { width: pointRect.width, height: pointRect.height, fontStyle: pointStyle.fontStyle, borderRadius: pointStyle.borderRadius, background: pointStyle.backgroundColor },
        centered: Math.abs(pointRect.top + pointRect.height / 2 - (rect.top + rect.height / 2)) < 0.5,
        textLines: textRects.length, textGap: textRects[0].left - pointRect.right,
        titleBeforeClose: textRects[0].right <= closeRect.left,
        contained: panelRect.left >= 0 && panelRect.right <= innerWidth && panelRect.top >= 0 && panelRect.bottom <= innerHeight,
        noOverflow: panel.scrollWidth <= panel.clientWidth && element.scrollWidth <= element.clientWidth,
      }
    })
    await info.attach('help-decoration-geometry', { body: JSON.stringify({ surface, width, ...geometry }), contentType: 'application/json' })
    expect(geometry).toEqual({ display: 'flex', alignItems: 'center', gap: '7px', margin: '0px 24px 6px 0px', lineHeight: '22.4px', point: { width: 8, height: 8, fontStyle: 'normal', borderRadius: '50%', background: 'rgb(43, 217, 124)' }, centered: true, textLines: 1, textGap: 7, titleBeforeClose: true, contained: true, noOverflow: true })
    await expect(panel.locator('.help-close')).toBeFocused()
    await page.screenshot({ path: info.outputPath(`help-decoration-${surface}-${width}.png`) })
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(evidence.mutations).toEqual([])
    expect(evidence.errors).toEqual([])
  })
}
