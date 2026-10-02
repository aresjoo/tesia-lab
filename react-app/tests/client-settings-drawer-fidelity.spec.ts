import { expect, test, type Locator, type Page } from '@playwright/test'

type Surface = 'public' | 'native'
const menuActive = '.ca-menu-layer[data-surface-active="true"]'
const localeActive = '.client-preferences-layer[data-surface-active="true"]'

// Native uses the same real Shell + dev import fixture as the existing
// native-settings-anchor-focus/motion specs. No SDK or server state is claimed.
async function mount(page: Page, baseURL: string | undefined, surface: Surface, member: boolean, width = 1440, height = 900) {
  if (!baseURL) throw new Error('로컬 baseURL이 필요합니다.')
  const origin = new URL(baseURL).origin, blocked: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ member, surface }) => {
    localStorage.setItem('tethLang', 'ko'); localStorage.setItem('tethCurrency', 'USD')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    if (surface === 'public' && member) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '설정 검수', email: 'settings@example.test' }))
  }, { member, surface })
  if (surface === 'public') await page.goto('/')
  else {
    await page.route('**/settings-drawer-fidelity.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="root" style="height:100dvh"></div></body></html>' }))
    await page.goto('/settings-drawer-fidelity.html')
    await page.evaluate(async member => {
      const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
      runtime.injectIntoGlobalHook(window)
      Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
      const path = '/src/internal-poc/ClientServiceExperience.tsx'
      const source = await (await fetch(path)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
      if (!reactPath) throw new Error('기존 Vite React 인스턴스를 찾지 못했습니다.')
      const rm = await import(/* @vite-ignore */ reactPath), React = rm.default ?? rm, h = React.createElement
      const domPath = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */ domPath)
      const { ClientServiceExperience: Shell } = await import(/* @vite-ignore */ path)
      const calls: string[] = []
      const state = { phase: 'ready', sessionState: member ? 'AUTHENTICATED' : 'ANONYMOUS', messages: [], input: '', busy: false, inputDisabled: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
        onInput: () => calls.push('input'), onSend: async () => { calls.push('send') }, onReset: async () => { calls.push('reset') } }
      function Host() {
        const [scope, setScope] = React.useState('settings-owner-a')
        Object.assign(window, { replaceDrawerOwner: () => setScope('settings-owner-b') })
        return h(Shell, { state, nativeAccounts: true, accountScope: scope })
      }
      const root = (DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('root'))
      Object.assign(window, { unmountDrawerOwner: () => root.unmount(), drawerFixtureCalls: calls })
      root.render(h(React.StrictMode, null, h(Host)))
    }, member)
    await expect(page.locator('.client-service-app')).toBeVisible()
  }
  await expect(page.locator('.client-sidebar')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return { blocked, errors }
}

async function box(locator: Locator) {
  await expect(locator).toBeVisible()
  const rect = await locator.boundingBox()
  expect(rect).not.toBeNull()
  return rect!
}

async function expand(page: Page) {
  const trigger = page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button')
  await trigger.click()
  await expect(page.locator('.client-sidebar')).toHaveClass(/mobile-open/)
  return trigger
}

function settingsTrigger(page: Page, member: boolean) {
  return page.locator(`[data-sidebar-action="${member ? 'profile-settings' : 'settings'}"]`)
}

// 9fb source26743 enters the Settings page directly; the removed settings
// submenu must not be rebuilt in a fixture. Help remains the nested surface.
async function openHelp(page: Page) {
  await page.locator(`${menuActive} [aria-controls="ca-sub-help"]`).click()
  await expect(page.locator('#ca-sub-help')).toBeVisible()
}

async function checkSourceLanguage(page: Page, member: boolean) {
  if (member) {
    await page.locator(`${menuActive} [data-menu-action="settings"]`).click()
    await expect(page.getByRole('heading', { name: '일반', exact: true })).toBeVisible()
    const language = page.locator('.stg-main select.stg-sel')
    await expect(language).toHaveAccessibleName('언어')
    await language.focus()
    await language.selectOption('ko')
    await expect(language).toBeFocused()
    expect(await page.evaluate(() => localStorage.getItem('tethLang'))).toBe('ko')
    await language.selectOption('en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(language).toBeFocused()
    await expect(page.locator(menuActive)).toHaveCount(0)
    expect(await page.evaluate(() => !!document.activeElement?.closest('[hidden],[inert]'))).toBe(false)
  } else {
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    const globe = page.locator('.client-globe')
    await globe.click()
    await expect(page.locator(localeActive)).toBeVisible()
    await expect(page.locator('.client-locale-panel')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator(localeActive)).toHaveCount(0)
    await expect(globe).toBeFocused()
    await globe.click()
    await page.locator('#locale-language').getByRole('button', { name: '한국어', exact: true }).click()
    await expect(page.locator(localeActive)).toHaveCount(0)
    await expect(globe).toBeFocused()
    expect(await page.evaluate(() => localStorage.getItem('tethLang'))).toBe('ko')
    await globe.click()
    await page.locator('#locale-language').getByRole('button', { name: 'English', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator(localeActive)).toHaveCount(0)
    await expect(globe).toBeFocused()
    expect(await page.evaluate(() => !!document.activeElement?.closest('[hidden],[inert]'))).toBe(false)
  }
}

async function anchorMatches(page: Page, trigger: Locator) {
  // ResizeObserver/rAF anchoring is asynchronous; measure the live trigger,
  // never the pre-click rectangle of a closing/reflowing sidebar.
  await expect.poll(async () => {
    const anchor = await box(trigger), menu = await box(page.locator('.ca-settings'))
    return Math.round(anchor.y - menu.y - menu.height)
  }).toBe(10)
  const anchor = await box(trigger), menu = await box(page.locator('.ca-settings'))
  expect(menu.x).toBeCloseTo(Math.max(10, Math.min(anchor.x, page.viewportSize()!.width - menu.width - 12)), 0)
}

for (const surface of ['public', 'native'] as const) for (const member of [false, true]) {
  const label = `${surface} ${member ? '회원' : '게스트'}`
  test(`${label}: 펼친 데스크톱 도움말→설정→서랍 Escape 순서와 원본 언어 진입·초점을 보존한다`, async ({ page, baseURL }) => {
    const audit = await mount(page, baseURL, surface, member)
    const drawer = page.locator('.client-sidebar'), rail = await expand(page), entry = settingsTrigger(page, member)
    const original = await entry.elementHandle()
    await entry.click()
    await expect(page.locator(menuActive)).toBeVisible()
    await expect(drawer).toHaveClass(/mobile-open/)
    expect(await entry.evaluate((element, saved) => element === saved, original)).toBe(true)
    await anchorMatches(page, entry)
    const settings = page.locator(`${menuActive} [aria-controls="ca-sub-help"]`)
    await settings.click()
    await expect(page.locator('#ca-sub-help')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#ca-sub-help')).toHaveCount(0)
    await expect(page.locator(menuActive)).toBeVisible()
    await expect(settings).toBeFocused()
    await expect(drawer).toHaveClass(/mobile-open/)
    await page.keyboard.press('Escape')
    await expect(page.locator(menuActive)).toHaveCount(0)
    await expect(entry).toBeFocused()
    await expect(drawer).toHaveClass(/mobile-open/)
    await page.keyboard.press('Escape')
    await expect(drawer).not.toHaveClass(/mobile-open/)
    await expect(rail).toBeFocused()

    await expand(page); await entry.click()
    await checkSourceLanguage(page, member)
    expect(audit).toEqual({ blocked: [], errors: [] })
  })

  test(`${label}: 낮은 데스크톱 설정·도움말 flyout은 현재 viewport 안에서 부모 메뉴와 겹치지 않는다`, async ({ page, baseURL }, info) => {
    const audit = await mount(page, baseURL, surface, member, 1100, 480)
    await expand(page)
    const entry = settingsTrigger(page, member)
    await entry.scrollIntoViewIfNeeded(); await entry.click()
    await expect(page.locator(menuActive)).toBeVisible()
    await expect(page.locator('.client-sidebar')).toHaveClass(/mobile-open/)
    const help = page.locator(`${menuActive} [aria-controls="ca-sub-help"]`)
    await help.scrollIntoViewIfNeeded(); await help.click()
    const flyout = page.locator('#ca-sub-help')
    await expect(flyout).toBeVisible()
    // Dynamic flyout measurement is allowed to settle after opening/resize.
    await expect.poll(async () => {
      const r = await box(flyout)
      return r.y >= 0 && r.y + r.height <= page.viewportSize()!.height + 1
    }).toBe(true)
    const main = await box(page.locator('.ca-settings')), sub = await box(flyout)
    expect(main.y).toBeGreaterThanOrEqual(0)
    expect(main.y + main.height).toBeLessThanOrEqual(481)
    expect(sub.x).toBeGreaterThanOrEqual(0)
    expect(sub.x + sub.width).toBeLessThanOrEqual(1101)
    const overlapX = Math.min(main.x + main.width, sub.x + sub.width) - Math.max(main.x, sub.x)
    const overlapY = Math.min(main.y + main.height, sub.y + sub.height) - Math.max(main.y, sub.y)
    expect(overlapX <= 1 || overlapY <= 1).toBe(true)
    await flyout.locator('a').first().focus()
    await expect(flyout.locator('a').first()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(flyout).toHaveCount(0)
    await expect(help).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(entry).toBeFocused()
    expect(audit).toEqual({ blocked: [], errors: [] })
    await page.screenshot({ path: info.outputPath(`settings-short-${surface}-${member}.png`) })
  })

  test(`${label}: 860→861 경계에서 메뉴가 남아도 숨은 앵커를 재사용하지 않고 잠금·초점을 복구한다`, async ({ page, baseURL }) => {
    const audit = await mount(page, baseURL, surface, member)
    await expand(page)
    const originalTrigger = await settingsTrigger(page, member).elementHandle()
    await settingsTrigger(page, member).click()
    await expect(page.locator(menuActive)).toBeVisible()
    await page.setViewportSize({ width: 860, height: 844 })
    await expect(page.locator('.client-sidebar')).not.toHaveClass(/mobile-open/)
    await expect(page.locator(menuActive)).toBeVisible()
    await page.setViewportSize({ width: 861, height: 844 })
    if (member) {
      // The expanded profile row is replaced by keyed collapsed controls.
      // A detached anchor uses the established 12px CSS fallback, not the
      // 10px clamp that applies to a still-connected guest settings button.
      expect(await originalTrigger!.evaluate(node => node.isConnected)).toBe(false)
      await expect(page.locator('[data-sidebar-action="profile-settings"]')).toHaveCount(0)
      await expect(page.locator('[data-sidebar-action="account"]')).toBeVisible()
      await expect.poll(() => page.locator('.ca-settings').evaluate(node => node.style.left)).toBe('')
    } else expect(await originalTrigger!.evaluate(node => node.isConnected)).toBe(true)
    await expect.poll(async () => Math.round((await box(page.locator('.ca-settings'))).x)).toBe(member ? 12 : 10)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.locator(menuActive)).toHaveCount(0)
    // The expanded member control no longer exists; any restored target must
    // be the actual visible sidebar control, not an inert/detached old entry.
    expect(await page.evaluate(() => {
      const active = document.activeElement
      return active instanceof HTMLElement && !!active.closest('.client-sidebar') && active.getClientRects().length > 0 && !active.closest('[inert],[hidden]')
    })).toBe(true)
    await page.setViewportSize({ width: 860, height: 844 })
    await expand(page); await settingsTrigger(page, member).click()
    await expect(page.locator(menuActive)).toBeVisible()
    await expect(page.locator('.client-sidebar')).not.toHaveClass(/mobile-open/)
    await page.keyboard.press('Escape')
    await expect(page.locator(menuActive)).toHaveCount(0)
    await expect(page.locator('.client-hamburger')).toBeFocused()
    expect(await page.locator('#root').evaluate(element => (element as HTMLElement).inert)).toBe(false)
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}

for (const retire of ['owner', 'unmount'] as const) {
  test(`실제 Native 셸 ${retire}: 열린 설정·도움말의 늦은 cleanup은 새 사용자 초점을 빼앗지 않는다`, async ({ page, baseURL }) => {
    const audit = await mount(page, baseURL, 'native', true)
    await expand(page); await settingsTrigger(page, true).click(); await openHelp(page)
    await page.evaluate(retire => {
      const destination = document.createElement('button')
      destination.id = 'settings-new-context'; destination.textContent = '새 화면의 명시 초점'
      document.body.append(destination)
      Reflect.get(window, retire === 'owner' ? 'replaceDrawerOwner' : 'unmountDrawerOwner')()
      destination.focus()
    }, retire)
    await expect(page.locator(menuActive)).toHaveCount(0)
    await expect(page.locator('#settings-new-context')).toBeFocused()
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(page.locator('#settings-new-context')).toBeFocused()
    expect(await page.locator('#root').evaluate(element => (element as HTMLElement).inert)).toBe(false)
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
    expect(await page.evaluate(() => Reflect.get(window, 'drawerFixtureCalls'))).toEqual([])
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}
