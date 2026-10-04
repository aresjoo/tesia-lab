import { expect, test, type Locator, type Page } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import copy from '../../src/client-settings-copy.json' with { type: 'json' }
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'

// Real service entry, synthetic auth/conversation HTTP only. No settings
// producer, identity mutation, security state, or notification state is invented.
test.setTimeout(60_000)
const ready = fixture.snapshots.ready, owner = 'session_settings_boundary_0001'
async function mount(page: Page) {
  const mutations: string[] = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, id }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { owner, id: ready.conversationId })
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') { mutations.push(`${request.method()} ${path}`); return route.abort('failed') }
    const conversation = path === `/api/v3/conversations/${ready.conversationId}`, session = path === '/api/v1/auth/session', csrf = path === '/api/v1/auth/csrf'
    if (!conversation && !session && !csrf) return route.abort('failed')
    const revision = conversation ? ready.conversationStateRevision : session ? '1' : null
    return route.fulfill({ contentType: 'application/json', headers: revision ? { ETag: '"settings_boundary_fixture_001"' } : {}, body: JSON.stringify({
      meta: { apiContractVersion: conversation ? '0.3.0' : '0.1.0', resourceRevision: revision, requestId: 'req_settings_boundary_0001', traceId: 'trace_settings_boundary_0001' },
      data: conversation ? ready : csrf ? { csrfToken: 'csrf_settings_boundary_0001', expiresAt: '2030-01-02T00:00:00Z' }
        : { sessionId: owner, state: 'AUTHENTICATED', revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' },
    }) })
  })
  await page.route(`http://127.0.0.1:${process.env.TETH_E2E_PORT ?? 4175}/`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/internal-poc/service-main.tsx');</script></body></html>` }))
  await page.goto('/')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  await page.locator('.g-composer textarea').fill('설정 검수 뒤에도 보존할 실제 입력 초안')
  await revealSourceNavigation(page)
  if (!await page.locator('[data-sidebar-action="account"]').isVisible()) await page.locator('.client-hamburger').click()
  const account = page.locator('[data-sidebar-action="account"]')
  await (await account.isVisible() ? account : page.locator('[data-sidebar-action="profile-settings"]')).click()
  await page.locator('.ca-settings [data-menu-action="settings"]').click()
  await expect(page.locator('.client-settings-page h1')).toHaveText('일반')
  return mutations
}
async function menu(page: Page) {
  if (!await page.locator('.stg-navigation').isVisible()) await page.locator('.stg-mback').click()
}
async function hit(target: Locator) {
  await target.scrollIntoViewIfNeeded()
  await expect(target).toBeInViewport({ ratio: 1 })
  expect(await target.evaluate(el => {
    const box = el.getBoundingClientRect(), top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return top === el || el.contains(top)
  })).toBe(true)
}
async function assertReadable(page: Page) {
  const issues = await page.locator('.client-settings-page').evaluate(root => {
    const issues: string[] = []
    for (const element of root.querySelectorAll<HTMLElement>('.stg-main :is(.k,.a,.v,button,select),.stg-navigation :is(button,a)')) {
      if (!element.checkVisibility() || element.closest('[inert]')) continue
      if (element.scrollWidth > element.clientWidth + 2) issues.push(`${element.className}:${element.textContent?.trim().slice(0,60)} width ${element.clientWidth}/${element.scrollWidth}`)
      if (element.matches('.stg-navigation :is(button,a)') && element.scrollHeight > element.clientHeight + 2) {
        issues.push(`${element.className}:${element.textContent?.trim().slice(0,60)} height ${element.clientHeight}/${element.scrollHeight}`)
      }
    }
    if (root.scrollWidth > root.clientWidth + 1) issues.push(`page ${root.clientWidth}/${root.scrollWidth}`)
    return issues
  })
  expect(issues).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

for (const width of [320, 390, 768, 1440]) for (const expanded of [false, true]) {
  test(`${width}px ${expanded ? '프랑스어 글자 200%' : '한국어'} 짧은 화면의 설정 4면·키보드 복귀 경계`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 480 })
    const mutations = await mount(page), settings = page.locator('.client-settings-page')
    const select = settings.getByRole('combobox')
    await hit(select)
    await select.focus(); await select.press('ArrowDown'); await select.press('Enter')
    await expect(select).toHaveValue('en')
    await select.selectOption(expanded ? 'fr' : 'ko')
    const language = expanded ? 'fr' : 'ko'
    await expect(select).toBeFocused()
    for (const tab of ['general', 'account', 'security', 'notify'] as const) {
      await menu(page)
      const link = settings.locator(`a[href="#/settings/${tab}"]`)
      await hit(link); await link.focus(); await link.press('Enter')
      await expect(settings.locator('h1')).toHaveText(copy[tab][language])
      if (expanded) {
        // Text-only 200% stress, not a claim of browser zoom emulation. Measure
        // each original font once so nested labels do not compound to 400%.
        await settings.evaluate(root => {
          const nodes = [...root.querySelectorAll<HTMLElement>('.stg-main :is(h1,h2,b,span,button,select,p),.stg-navigation :is(button,a,small)')]
            .filter(node => !node.dataset.qaScaled)
            .map(node => [node, parseFloat(getComputedStyle(node).fontSize)] as const)
          for (const [node, size] of nodes) { node.style.fontSize = `${size * 2}px`; node.dataset.qaScaled = 'true' }
        })
      }
      await assertReadable(page)
      if (tab === 'general') {
        await expect(settings.getByRole('combobox').locator('option')).toHaveCount(7)
        await expect(settings.locator('.stg-main .num')).toHaveText('USD')
      }
      if (tab === 'account') {
        const logout = settings.getByRole('button', { name: copy.logout[language], exact: true })
        await hit(logout); await logout.focus(); await logout.press('Enter')
        await expect(settings.locator('.stg-confirm')).toBeVisible()
        await page.keyboard.press('Escape'); await expect(settings.locator('.stg-confirm')).toHaveCount(0)
        await expect(logout).toBeFocused(); await hit(logout)
      }
      if (tab === 'notify') {
        await expect(settings.locator('[data-notification-topic]')).toHaveCount(6)
        await expect(settings.locator('[data-notification-channel]')).toHaveCount(12)
        await expect(settings.locator('[data-notification-channel]:enabled')).toHaveCount(0)
        await settings.locator('[data-notification-topic]').last().scrollIntoViewIfNeeded()
        await expect(settings.locator('[data-notification-topic]').last()).toBeInViewport()
      }
      // Source .stg-mback is intentionally display:none above 900px; only
      // rendered controls participate in pointer/focus reachability checks.
      for (const control of await settings.locator('.stg-main :is(button:enabled,select,a[href]):visible').all()) await hit(control)
      await page.screenshot({ path: info.outputPath(`${width}-${language}-${tab}.png`) })
    }
    await menu(page)
    const back = settings.getByRole('button', { name: copy.back[language], exact: true })
    await hit(back); await back.focus(); await back.press('Enter')
    await expect(settings).toHaveCount(0)
    await expect(page.locator('.g-composer textarea')).toBeFocused()
    await expect(page.locator('.g-composer textarea')).toHaveValue('설정 검수 뒤에도 보존할 실제 입력 초안')
    expect(mutations).toEqual([])
  })
}
