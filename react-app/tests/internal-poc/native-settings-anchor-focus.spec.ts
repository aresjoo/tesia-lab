import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import copy from '../../src/client-settings-copy.json' with { type: 'json' }

test.use({ trace: 'off', video: 'off' })
test.setTimeout(25_000)
const owner = 'session_account_menu_fixture_0001', ready = fixture.snapshots.ready
async function native(page: Page, signedIn = true) {
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
  await page.addInitScript(({ owner, id }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { owner, id: ready.conversationId })
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/auth/csrf') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meta: { apiContractVersion: '0.1.0', resourceRevision: null, requestId: 'req_account_menu_fixture_0001', traceId: 'trace_account_menu_fixture_0001' }, data: { csrfToken: 'csrf_account_menu_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) })
    const conversation = path.startsWith('/api/v3/')
    if (!conversation && path !== '/api/v1/auth/session') return route.abort()
    const revision = conversation ? ready.conversationStateRevision : '1'
    return route.fulfill({ contentType: 'application/json', headers: { ETag: '"settings-probe-1"' }, body: JSON.stringify({
      meta: { apiContractVersion: conversation ? '0.3.0' : '0.1.0', resourceRevision: revision, requestId: 'req_account_menu_fixture_0001', traceId: 'trace_account_menu_fixture_0001' },
      data: conversation ? ready : { sessionId: owner, state: signedIn ? 'AUTHENTICATED' : 'ANONYMOUS', revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' },
    }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
}
async function open(page: Page, action = 'settings', settingsPage = true) {
  await revealSourceNavigation(page)
  let trigger = page.locator(`[data-sidebar-action="${action}"]`)
  if (!await trigger.isVisible()) await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click()
  if (!await trigger.isVisible()) trigger = page.locator('[data-sidebar-action="profile-settings"]')
  await trigger.click()
  if (settingsPage) await page.locator('.ca-settings [data-menu-action="settings"]').click()
  return trigger
}
async function list(page: Page) {
  if(!await page.locator('.stg-navigation').isVisible())await page.locator('.stg-mback').click()
}
for (const [width, height] of [[1280, 720], [861, 568], [320, 568]]) test(`signed native settings ${width}x${height}: source navigation and actions remain reachable`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: 'reduce' }); await native(page)
  await revealSourceNavigation(page)
  await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click()
  const entry = page.locator('[data-sidebar-action="profile-settings"]')
  await entry.click()
  await page.locator('.ca-settings [data-menu-action="settings"]').click()
  const menu = page.locator('.client-settings-page')
  await expect(menu.locator('h1')).toHaveText(copy.general.ko)
  await expect(menu.locator('h1')).toBeFocused()
  await expect(page.locator('.ca-settings,.ca-profile')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath(`settings-${width}.png`) })
  await list(page)
  await menu.getByRole('link', { name: '계정', exact: true }).click()
  const logout = menu.getByRole('button', { name: '로그아웃', exact: true })
  await logout.scrollIntoViewIfNeeded(); await expect(logout).toBeInViewport()
  await list(page)
  await menu.getByRole('link', { name: '일반', exact: true }).click()
  await expect(menu.getByRole('combobox')).toBeVisible()
  await list(page)
  await menu.getByRole('button', { name: copy.back.ko, exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toBeFocused()
})
for (const signedIn of [true, false]) for (const width of [1440, 320]) test(`native ${signedIn ? 'account' : 'guest'} ${width}: locale returns to logical entry`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await native(page, signedIn)
  const trigger = await open(page, signedIn ? 'account' : 'settings', signedIn)
  if (signedIn) {
    const settings = page.locator('.client-settings-page')
    await list(page)
    const general = settings.getByRole('link', { name: copy.general.ko, exact: true })
    const changesTab = await general.getAttribute('aria-current') !== 'page'
    await general.click()
    if (changesTab) await expect(settings.locator('h1')).toBeFocused()
    else await expect(general).toBeFocused()
    await settings.getByRole('combobox').focus()
    await settings.getByRole('combobox').selectOption('en')
    await expect(settings.getByRole('combobox')).toBeFocused()
    await settings.getByRole('combobox').selectOption('ko')
    await list(page)
    await settings.getByRole('button', { name: copy.back.ko, exact: true }).click()
    await expect(page.locator('.g-composer textarea')).toBeFocused()
    return
  }
  await expect(page.locator('.ca-settings')).toBeVisible()
  await expect(page.locator('.ca-settings [aria-controls="ca-sub-settings"]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-locale-panel')).toHaveCount(0)
  await expect(width <= 860 ? page.locator('.client-hamburger') : trigger).toBeFocused()
  expect(await page.evaluate(() => !!document.activeElement?.closest('[hidden],[inert]'))).toBe(false)
})
test('native profile opens source Account and restores conversation focus on explicit return', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await native(page)
  await open(page, 'account')
  await expect(page.locator('.client-settings-page h1')).toHaveText(copy.general.ko)
  await page.getByRole('button', { name: copy.back.ko, exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toBeFocused()
})

test('public collapsed account preserves the draft through dedicated Account return', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 계정', email: 'review@example.test' })))
  await page.goto('/')
  const account = page.locator('[data-sidebar-action="account"]')
  await page.locator('#strategy-idea').fill('돌아와 이어 쓸 질문')
  await account.click()
  await page.locator('.ca-settings [data-menu-action="settings"]').click()
  await expect(page.locator('.client-settings-page h1')).toHaveText(copy.general.ko)
  await page.getByRole('button', { name: copy.back.ko, exact: true }).click()
  await expect(page.locator('#strategy-idea')).toBeFocused()
  await expect(page.locator('#strategy-idea')).toHaveValue('돌아와 이어 쓸 질문')
})

test('signed settings retain all seven languages and reachable shortcuts after resizing', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await native(page)
  await open(page)
  const settings = page.locator('.client-settings-page')
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await settings.getByRole('combobox').selectOption(language)
    await expect(settings.locator('h1')).toHaveText(copy.general[language])
    await list(page)
    const help = settings.getByRole('button', { name: copy.help[language], exact: true })
    await help.focus(); await expect(help).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await settings.locator('a[href="#/settings/general"]').click()
  }
  await page.setViewportSize({ width: 1280, height: 720 })
  const help = settings.getByRole('button', { name: copy.help.fr, exact: true })
  await help.click(); await expect(page.locator('.site-help-pop')).toBeVisible()
  await page.keyboard.press('Escape'); await expect(help).toBeFocused()
})

test('focused settings shortcut stays in view when the mobile list resizes', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 }); await native(page)
  await open(page)
  await list(page)
  const help = page.locator('.client-settings-page').getByRole('button', { name: copy.help.ko, exact: true })
  await help.focus()
  await page.setViewportSize({ width: 360, height: 568 })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expect(help).toBeFocused()
  await expect(help).toBeInViewport({ ratio: 1 })
  await page.screenshot({ path: info.outputPath('settings-focused-shortcut-360.png') })
})

test('owner replacement retires help restoration and cannot refocus an old account', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/settings-owner.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }))
  await page.goto('/settings-owner.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window); Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/internal-poc/ClientServiceExperience.tsx', source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React')
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, h = React.createElement, dp = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */dp)
    const { ClientServiceExperience: Shell } = await import(/* @vite-ignore */path)
    const state = { phase: 'ready', sessionState: 'AUTHENTICATED', messages: [], input: '', busy: false, inputDisabled: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null, onInput: () => {}, onSend: async () => {}, onReset: async () => {} }
    function Host() {
      const [scope, setScope] = React.useState('owner-a')
      Object.assign(window, { replaceSettingsOwner: () => setScope('owner-b') })
      return h(Shell, { state, nativeAccounts: true, accountScope: scope })
    }
    const root = (DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('root'))
    root.render(h(React.StrictMode, null, h(Host)))
  })
  await open(page, 'account')
  await page.locator('.client-settings-page').getByRole('button', { name: copy.help.ko, exact: true }).click()
  await expect(page.locator('.site-help-pop .help-close')).toBeFocused()
  await page.evaluate(() => {
    const button = document.createElement('button'); button.id = 'owner-destination'; button.textContent = 'new context'; document.body.append(button)
    Reflect.get(window, 'replaceSettingsOwner')(); button.focus()
  })
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => ({
    id: document.activeElement?.id,
    tag: document.activeElement?.tagName,
    inert: (document.querySelector('.client-service-app') as HTMLElement).inert,
  }))).toEqual({ id: 'owner-destination', tag: 'BUTTON', inert: false })
  await expect(page.locator('.client-settings-page h1')).toHaveText(copy.general.ko)
  await expect(page.locator('[data-sidebar-action="account"]')).toBeHidden()
  await page.getByRole('button', { name: copy.back.ko, exact: true }).click()
  await open(page, 'account')
  await expect(page.locator('.client-settings-page h1')).toHaveText(copy.general.ko)
})

test('desktop pointer crosses the source submenu bridge without closing the flyout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await native(page, false)
  await open(page, 'settings', false)
  const help = page.locator('.ca-settings [aria-controls="ca-sub-help"]')
  await help.hover()
  const button = await help.boundingBox(), submenu = await page.locator('#ca-sub-help').boundingBox()
  await page.mouse.move((button!.x + button!.width + submenu!.x) / 2, button!.y + button!.height / 2, { steps: 8 })
  await expect(page.locator('#ca-sub-help')).toBeVisible()
  await page.locator('#ca-sub-help a').first().hover()
  await expect(page.locator('#ca-sub-help')).toBeVisible()
})
