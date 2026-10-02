import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })
async function mount(page: Page, mode: 'service' | 'unit' = 'service') {
  await page.route('**/settings-motion.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div></body></html>' }))
  await page.goto('/settings-motion.html')
  await page.evaluate(async mode => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window); Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/internal-poc/ClientServiceExperience.tsx', source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React')
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, h = React.createElement, dp = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */dp)
    const { ClientServiceExperience: Shell } = await import(/* @vite-ignore */path)
    const localePath = '/src/components/ClientLocalePanel.tsx', accountPath = '/src/components/ClientAccountUI.tsx'
    const { ClientLocalePanel } = await import(/* @vite-ignore */localePath), { ClientSettingsMenu } = await import(/* @vite-ignore */accountPath)
    const calls: string[] = []
    function Unit() {
      const [surface, setSurface] = React.useState(null)
      Object.assign(window, { motionSurface: setSurface, motionCalls: calls })
      return h(React.Fragment, null, h('button', { id: 'entry', onClick: () => setSurface('settings') }, 'open'), h('button', { id: 'other' }, 'other'),
        h(ClientSettingsMenu, { open: surface === 'settings', signedIn: false, onClose: () => { calls.push('close-settings'); setSurface(null) }, onFeedback: () => calls.push('feedback'), onHelp: () => {}, onDownload: () => {} }),
        h(ClientLocalePanel, { open: surface === 'locale', onClose: () => { calls.push('close-locale'); setSurface(null) } }))
    }
    // Latest source keeps the small settings/locale menu only for guests.
    // Member page navigation is covered by client-settings-page.spec.ts.
    const props = { nativeAccounts: true, accountScope: 'test-owner', state: { phase: 'ready', sessionState: 'ANONYMOUS', messages: [], input: '', busy: false, inputDisabled: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null, onInput: () => {}, onSend: async () => {}, onReset: async () => {} } }
    const root = (DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('root'))
    Object.assign(window, { motionUnmount: () => root.unmount() })
    root.render(h(React.StrictMode, null, mode === 'unit' ? h(Unit) : h(Shell, props)))
  }, mode)
}
async function openSettings(page: Page) {
  const button = page.locator('.client-sidebar-bottom').getByRole('button', { name: /설정/ }).first()
  if (!await button.isVisible()) await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click()
  await button.click()
  await expect(page.locator('.ca-settings')).toBeVisible()
}
async function openDesktopLocaleShortcut(page: Page) {
  if(await page.locator('.ca-settings').isVisible()) {
    await page.keyboard.press('Escape')
    await expect(page.locator('.ca-settings')).toHaveCount(0)
  }
  // Current guest globe is desktop-only. Mobile language selection lives in
  // authenticated General; mobile panel behavior is tested in the unit host.
  await page.setViewportSize({width:1440,height:900})
  const globe=page.locator('.client-globe')
  await expect(globe).toBeVisible()
  await globe.click()
  await expect(page.locator('.client-locale-panel')).toBeFocused()
}
async function dismissAndPause(page: Page, selector: string) {
  return page.evaluate(async selector => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await new Promise(requestAnimationFrame)
    const panel = document.querySelector(selector) as HTMLElement | null
    panel?.getAnimations().forEach(animation => animation.pause())
    return panel && { closing: panel.closest('[data-surface-closing="true"]') !== null, inert: panel.closest('[inert]') !== null, name: getComputedStyle(panel).animationName }
  }, selector)
}
test('service 설정은 원본 180ms로 등장하고 비활성 퇴장 DOM을 유지한다', async ({ page }) => {
  await mount(page); await openSettings(page)
  await expect(page.locator('.ca-settings')).toHaveCSS('animation-duration', '0.18s')
  const state = await dismissAndPause(page, '.ca-settings')
  expect(state?.closing).toBe(true); expect(state?.inert).toBe(true)
  await expect(page.locator('.ca-settings')).toHaveCount(0)
  expect(await page.locator('.client-service-app').evaluate(node => (node as HTMLElement).inert)).toBe(false)
})
test('표면 교체 시 locale은 즉시 열리며 이전 퇴장 DOM이 초점과 잠금을 빼앗지 않는다', async ({ page }) => {
  await mount(page,'unit'); await page.locator('#entry').click()
  await page.evaluate(()=>Reflect.get(window,'motionSurface')('locale'))
  await expect(page.locator('.client-locale-panel')).toBeFocused()
  await expect(page.locator('.ca-menu-layer[data-surface-closing="true"]')).toHaveAttribute('inert', '')
  await expect(page.locator('.ca-settings')).toHaveCount(0)
  await expect(page.locator('.client-locale-panel')).toBeFocused()
  expect(await page.locator('#root').evaluate(node => (node as HTMLElement).inert)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-locale-panel')).toHaveCount(0)
  expect(await page.locator('#root').evaluate(node => (node as HTMLElement).inert)).toBe(false)
})
test('public main도 settings 퇴장을 유지한다', async ({ page }) => {
  await page.goto('/'); await openSettings(page)
  expect((await dismissAndPause(page, '.ca-settings'))?.closing).toBe(true)
  await expect(page.locator('.ca-settings')).toHaveCount(0)
})
test('StrictMode의 닫힘→재열기 뒤 이전 완료는 새 창을 닫지 않는다', async ({ page }) => {
  await mount(page, 'unit')
  await expect(page.locator('.ca-settings')).toHaveCount(0)
  await page.locator('#entry').click(); await page.evaluate(() => Reflect.get(window, 'motionSurface')(null))
  await expect(page.locator('.ca-menu-layer')).toHaveAttribute('inert', '')
  await page.evaluate(() => Reflect.get(window, 'motionSurface')('settings'))
  await expect(page.locator('.ca-menu-layer')).not.toHaveAttribute('inert', '')
  await page.waitForTimeout(300)
  await expect(page.locator('.ca-settings')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'motionUnmount')())
  await expect(page.locator('.ca-settings')).toHaveCount(0)
})
test('reduce는 퇴장 대기를 만들지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await mount(page); await openSettings(page)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-surface-closing="true"]')).toHaveCount(0)
  await expect(page.locator('.ca-settings')).toHaveCount(0)
})

test('원본 submenu 진입 시간과 locale easing·tooltip fade를 보존한다', async ({ page }) => {
  await mount(page); await openSettings(page)
  await page.locator('.ca-settings [aria-controls="ca-sub-help"]').click()
  const mobile = page.viewportSize()!.width <= 640
  await expect(page.locator('#ca-sub-help')).toHaveCSS('animation-duration', mobile ? '0.3s' : '0.16s')
  await page.keyboard.press('Escape')
  await expect(page.locator('[aria-controls="ca-sub-settings"]')).toHaveCount(0)
  await openDesktopLocaleShortcut(page)
  await expect(page.locator('.client-locale-panel')).toHaveCSS('animation-duration', '0.18s')
  await expect(page.locator('.client-locale-panel')).toHaveCSS('animation-timing-function', 'cubic-bezier(0.16, 1, 0.3, 1)')
  await expect(page.locator('.locale-tooltip')).toHaveCSS('transition-duration', '0.15s')
})

test('locale 퇴장은 자식 animationend를 무시하고 정확한 종료만 처리한다', async ({ page }) => {
  await mount(page, 'unit'); await page.evaluate(() => Reflect.get(window, 'motionSurface')('locale'))
  await expect(page.locator('.client-locale-panel')).toBeFocused()
  const result = await page.evaluate(async () => {
    const layer = document.querySelector<HTMLElement>('.client-preferences-layer')!
    // Observe React's closed commit before reading the exit animation. A rAF
    // can precede the commit and accidentally sample the entrance animation.
    await new Promise<void>(resolve => {
      const observer = new MutationObserver(() => {
        if (layer.dataset.surfaceClosing === 'true') { observer.disconnect(); resolve() }
      })
      observer.observe(layer, { attributes: true })
      Reflect.get(window, 'motionSurface')(null)
    })
    const panel = document.querySelector('.client-locale-panel') as HTMLElement
    panel.getAnimations().forEach(animation => animation.pause())
    const name = getComputedStyle(panel).animationName
    panel.querySelector('button')!.dispatchEvent(new AnimationEvent('animationend', { bubbles: true, animationName: name }))
    await new Promise(requestAnimationFrame)
    return { name, retained: panel.isConnected, inert: !!panel.closest('[inert]'), hidden: panel.closest('[aria-hidden="true"]') !== null }
  })
  expect(result).toEqual({ name: page.viewportSize()!.width <= 860 ? 'client-locale-sheet-out' : 'client-locale-out', retained: true, inert: true, hidden: true })
  await page.locator('.client-locale-panel').evaluate(node => node.dispatchEvent(new AnimationEvent('animationend', { bubbles: true, animationName: getComputedStyle(node).animationName })))
  await expect(page.locator('.client-locale-panel')).toHaveCount(0)
  expect(await page.locator('#root').evaluate(node => (node as HTMLElement).inert)).toBe(false)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('퇴장 중 reduce 전환은 즉시 정리하고 재열기·unmount 뒤 잠금이 남지 않는다', async ({ page }) => {
  await mount(page, 'unit'); await page.evaluate(() => Reflect.get(window, 'motionSurface')('locale'))
  await expect(page.locator('.client-locale-panel')).toBeFocused()
  await page.evaluate(async () => { Reflect.get(window, 'motionSurface')(null); await new Promise(requestAnimationFrame); document.querySelector('.client-locale-panel')?.getAnimations().forEach(a => a.pause()) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.client-locale-panel')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'motionSurface')('locale'))
  await expect(page.locator('.client-locale-panel')).toBeFocused()
  await page.evaluate(() => Reflect.get(window, 'motionUnmount')())
  await expect(page.locator('.client-preferences-layer')).toHaveCount(0)
  expect(await page.locator('#root').evaluate(node => (node as HTMLElement).inert)).toBe(false)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('퇴장 메뉴의 프로그램 클릭과 document 키보드 handler는 다시 실행되지 않는다', async ({ page }) => {
  await mount(page, 'unit'); await page.locator('#entry').click()
  await page.evaluate(async () => {
    // A frame callback can run before React commits closed. Verify the actual
    // retired state before injecting clicks that must be inert.
    const layer=document.querySelector<HTMLElement>('.ca-menu-layer')!
    await new Promise<void>(resolve=>{
      const observer=new MutationObserver(()=>{
        if(layer.dataset.surfaceClosing==='true'){observer.disconnect();resolve()}
      })
      observer.observe(layer,{attributes:true})
      Reflect.get(window,'motionSurface')(null)
    })
    const panel = document.querySelector('.ca-settings') as HTMLElement
    panel.getAnimations().forEach(a => a.pause())
    const feedback = Array.from(panel.querySelectorAll('button')).find(button => button.textContent?.includes('의견 보내기'))!
    feedback.click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  expect(await page.evaluate(() => Reflect.get(window, 'motionCalls'))).toEqual([])
  await expect(page.locator('#entry')).toBeFocused()
  await expect(page.locator('.ca-settings')).toHaveCount(0)
})

test('퇴장 후 다른 사용자 컨트롤로 이동한 초점을 종료 timer가 탈취하지 않는다', async ({ page }) => {
  await mount(page, 'unit'); await page.locator('#entry').click()
  await page.evaluate(async () => {
    const layer=document.querySelector<HTMLElement>('.ca-menu-layer')!
    await new Promise<void>(resolve=>{
      const observer=new MutationObserver(()=>{
        if(layer.dataset.surfaceClosing==='true'){observer.disconnect();resolve()}
      })
      observer.observe(layer,{attributes:true})
      Reflect.get(window,'motionSurface')(null)
    })
    document.querySelector('.ca-settings')?.getAnimations().forEach(a => a.pause())
    document.querySelector<HTMLButtonElement>('#other')!.focus()
  })
  await expect(page.locator('#other')).toBeFocused()
  await expect(page.locator('.ca-settings')).toHaveCount(0)
  await expect(page.locator('#other')).toBeFocused()
})

test('locale의 빠른 재열기는 이전 종료를 취소하고 검색을 초기화한다', async ({ page }) => {
  await mount(page, 'unit'); await page.evaluate(() => Reflect.get(window, 'motionSurface')('locale'))
  await page.locator('#locale-language input').fill('한국')
  const closing = await page.evaluate(async () => {
    const layer = document.querySelector<HTMLElement>('.client-preferences-layer')!, input = document.querySelector('#locale-language input')
    // A single rAF can run before React commits and batch null -> locale into
    // open -> open. Observe the actual closed commit, not a scheduler deadline.
    await new Promise<void>(resolve => {
      const observer = new MutationObserver(() => {
        if (layer.dataset.surfaceActive === 'false' && layer.dataset.surfaceClosing === 'true') { observer.disconnect(); resolve() }
      })
      observer.observe(layer, { attributes: true })
      Reflect.get(window, 'motionSurface')(null)
    })
    const result = { closing: layer.dataset.surfaceClosing, inert: layer.inert, sameInput: input === document.querySelector('#locale-language input') }
    Reflect.get(window, 'motionSurface')('locale')
    return result
  })
  expect(closing).toEqual({ closing: 'true', inert: true, sameInput: true })
  await expect(page.locator('#locale-language input')).toHaveValue('')
  await page.waitForTimeout(300)
  await expect(page.locator('.client-locale-panel')).toBeFocused()
  await expect(page.locator('.client-preferences-layer')).not.toHaveAttribute('inert', '')
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-preferences-layer')).toHaveCount(0)
  expect(await page.locator('#root').evaluate(node => (node as HTMLElement).inert)).toBe(false)
})

for (const shell of ['main', 'service'] as const) test(`${shell} desktop 단일 언어 재열기는 선택을 유지하고 검색 결과를 초기화한다`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  if (shell === 'main') await page.goto('/'); else await mount(page)
  const openLocale = async () => {
    await openDesktopLocaleShortcut(page)
  }
  await openLocale()
  await page.locator('#locale-language input').fill('한국')
  await expect(page.locator('#locale-language li')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-locale-panel')).toHaveCount(0)
  await openLocale()
  await expect(page.locator('#locale-currency, .client-locale-panel [role="tab"]')).toHaveCount(0)
  await expect(page.locator('#locale-language input')).toHaveValue('')
  await expect(page.locator('#locale-language li')).toHaveCount(7)
  await page.locator('#locale-language').getByRole('button', { name: '한국어', exact: true }).click()
  await expect(page.locator('.client-locale-panel')).toHaveCount(0)
  await openLocale()
  await expect(page.locator('#locale-language').getByRole('button', { name: '한국어', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => localStorage.getItem('tethLang'))).toBe('ko')
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-locale-panel')).toHaveCount(0)
  expect(await page.locator('body > *').evaluateAll(nodes => nodes.some(node => (node as HTMLElement).inert))).toBe(false)
})

test('실제 두 desktop 셸의 locale 빠른 닫기 후 이전 메뉴 cleanup과 배경 잠금이 남지 않는다', async ({ page }) => {
  for (const shell of ['service', 'main']) {
    if (shell === 'service') await mount(page); else await page.goto('/')
    await openSettings(page)
    await openDesktopLocaleShortcut(page)
    await page.keyboard.press('Escape')
    await expect(page.locator('.client-locale-panel,.ca-settings')).toHaveCount(0)
    expect(await page.locator('#root').evaluate(node => (node as HTMLElement).inert)).toBe(false)
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
    expect(await page.evaluate(() => document.activeElement !== document.body && !document.activeElement?.closest('[inert],[aria-hidden="true"]'))).toBe(true)
  }
})

test('320px 7언어의 open/close 반복은 overflow와 보이지 않는 활성 모달을 남기지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page, 'unit')
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(async language => { const p = '/src/client-preferences.ts'; (await import(/* @vite-ignore */p)).setClientPreference('language', language); Reflect.get(window, 'motionSurface')('locale') }, language)
    await expect(page.locator('.client-locale-panel')).toBeFocused()
    await page.locator('.locale-grab').press('Enter')
    await expect(page.locator('.client-preferences-layer')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  }
  await page.evaluate(() => Reflect.get(window, 'motionSurface')('settings'))
  await page.screenshot({ path: info.outputPath('settings-320.png') })
})
