import { expect, test, type Page } from '@playwright/test'
import footerCopy from '../../src/client-site-footer-copy.json' with { type: 'json' }

test.use({ trace: 'retain-on-failure', video: 'off' })
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII=', 'base64')
async function mount(page: Page, initial: 'feedback' | 'help' | 'floating' = 'feedback') {
  await page.route('**/feedback-help-motion.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#101114"><div id="root"></div></body></html>' }))
  await page.goto('/feedback-help-motion.html')
  await page.evaluate(async initial => {
    const dp = '/@id/react-dom/client', ap = '/src/components/ClientAccountUI.tsx', hp = '/src/components/ClientHelp.tsx', lp = '/src/components/ClientLocalePanel.tsx', refresh = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window); Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    for (const path of ['/src/styles.css', '/src/client-reference.css']) await import(/* @vite-ignore */path)
    const source = await (await fetch(ap)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing component React import')
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, h = React.createElement, dom = await import(/* @vite-ignore */dp)
    const { ClientFeedbackDialog } = await import(/* @vite-ignore */ap), { SiteHelp } = await import(/* @vite-ignore */hp), { ClientLocalePanel } = await import(/* @vite-ignore */lp)
    const calls: string[] = [], pending: { resolve: () => void; reject: () => void }[] = [], revoked: string[] = []
    const revoke = URL.revokeObjectURL.bind(URL); URL.revokeObjectURL = url => { revoked.push(url); revoke(url) }
    function App() {
      const [surface, setSurface] = React.useState(initial === 'floating' ? null : initial), [owner, setOwner] = React.useState('owner-a'), [helpMounted, setHelpMounted] = React.useState(true)
      const entry = React.useRef(null), host = React.useRef(null)
      React.useLayoutEffect(() => { if (host.current) host.current.inert = Boolean(surface) }, [surface])
      Object.assign(window, { fhSurface: setSurface, fhMountHelp: setHelpMounted, fhOwner: (value: string) => { entry.current = null; setOwner(value); setSurface(null) }, fhCalls: calls, fhRevoked: revoked,
        fhSettle: (index: number, failed = false) => failed ? pending[index].reject() : pending[index].resolve() })
      return h(React.Fragment, null,
        h('main', { ref: host }, h('button', { id: 'entry', ref: entry, onClick: () => setSurface(initial === 'floating' ? 'help' : initial) }, 'entry'), h('button', { id: 'other' }, 'other')),
        h('div', { className: 'client-source-overlays' },
          h(ClientFeedbackDialog, { key: owner, open: surface === 'feedback', returnFocus: entry, submissionScope: owner, onClose: () => setSurface(null), onSubmit: (value: { message: string }) => {
            calls.push(value.message); return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error('PRIVATE_ERROR')) }))
          } }),
          helpMounted && (initial === 'floating' ? h(SiteHelp) : h(SiteHelp, { key: `help-${owner}`, initialOpen: true, open: surface === 'help', returnFocus: entry, onClose: () => setSurface(null) })),
          h(ClientLocalePanel, { open: surface === 'locale', returnFocus: entry, manageBackground: false, onClose: () => setSurface(null) })))
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('root'))
    Object.assign(window, { fhUnmount: () => root.unmount() })
    root.render(h(React.StrictMode, null, h(App)))
  }, initial)
  await expect(page.locator('#entry')).toBeVisible()
}
async function change(page: Page, surface: string | null) { await page.evaluate(value => Reflect.get(window, 'fhSurface')(value), surface) }
async function closeSnapshot(page: Page, kind: 'feedback' | 'help') {
  return page.evaluate(async kind => {
    const selector = kind === 'feedback' ? '.ca-feedback-layer' : '.site-help-pop'
    const layer = document.querySelector(selector) as HTMLElement
    const closed = new Promise<void>(resolve => { const observer = new MutationObserver(() => { if (layer.dataset.surfaceClosing === 'true') { observer.disconnect(); resolve() } }); observer.observe(layer, { attributes: true }) })
    Reflect.get(window, 'fhSurface')(null)
    await closed
    const panel = kind === 'feedback' ? layer.querySelector('.ca-feedback')! : layer
    panel.getAnimations().forEach(animation => animation.pause())
    return { inert: layer.inert, hidden: layer.getAttribute('aria-hidden'), duration: getComputedStyle(panel).animationDuration, name: getComputedStyle(panel).animationName }
  }, kind)
}

test('feedback source 280ms entrance and inert retained exit', async ({ page }) => {
  await mount(page)
  await expect(page.locator('.ca-feedback')).toHaveCSS('animation-duration', '0.28s')
  await expect(page.locator('.ca-feedback')).toHaveCSS('animation-timing-function', 'cubic-bezier(0.16, 1, 0.3, 1)')
  const state = await closeSnapshot(page, 'feedback')
  expect(state).toEqual({ inert: true, hidden: 'true', duration: '0.28s', name: 'client-feedback-out' })
  await expect(page.locator('#entry')).toBeFocused()
  await expect(page.locator('.ca-feedback')).toHaveCount(0)
})

test('help source 180ms entrance and 160ms retained exit', async ({ page }) => {
  await mount(page, 'help')
  await expect(page.locator('.site-help-pop')).toHaveCSS('animation-duration', '0.18s')
  const state = await closeSnapshot(page, 'help')
  expect(state).toEqual({ inert: true, hidden: 'true', duration: '0.16s', name: 'client-help-out' })
  await expect(page.locator('#entry')).toBeFocused()
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
})

for (const kind of ['feedback', 'help'] as const) test(`${kind} closing programmatic link cannot navigate or open a policy tab`, async ({ page, context }, info) => {
  await mount(page, kind)
  await expect(page.locator(kind === 'feedback' ? '.ca-feedback textarea' : '.help-close')).toBeFocused()
  const observed = await page.evaluate(async kind => {
    const layer = document.querySelector(kind === 'feedback' ? '.ca-feedback-layer' : '.site-help-pop') as HTMLElement
    const commit = new Promise<void>(resolve => { const observer = new MutationObserver(() => { if (layer.dataset.surfaceClosing === 'true') { observer.disconnect(); resolve() } }); observer.observe(layer, { attributes: true }) })
    Reflect.get(window, 'fhSurface')(null); await commit
    const panel = kind === 'feedback' ? layer.querySelector('.ca-feedback')! : layer
    panel.getAnimations().forEach(animation => animation.pause())
    const link = layer.querySelector('a')!, before = location.href
    let targetCalls = 0
    link.addEventListener('click', () => { targetCalls++ }, { once: true })
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const accepted = link.dispatchEvent(event)
    return { inert: layer.inert, closing: layer.dataset.surfaceClosing, defaultPrevented: event.defaultPrevented, accepted, targetCalls, unchangedUrl: location.href === before }
  }, kind)
  await info.attach(`${kind}-closing-programmatic-event`, { body: JSON.stringify(observed, null, 2), contentType: 'application/json' })
  expect(observed).toEqual({ inert: true, closing: 'true', defaultPrevented: true, accepted: false, targetCalls: 0, unchangedUrl: true })
  await expect(page.locator('#entry')).toBeFocused()
  await expect(page.locator(kind === 'feedback' ? '.ca-feedback' : '.site-help-pop')).toHaveCount(0)
  expect(context.pages()).toHaveLength(1)
  expect(await page.evaluate(() => Reflect.get(window, 'fhCalls'))).toEqual([])
})

test('feedback close-reopen resets form and discards old delivery success and failure', async ({ page }) => {
  await mount(page)
  for (const failed of [false, true]) {
    await page.locator('.ca-feedback textarea').fill('old visit')
    await page.locator('input[type=file]').setInputFiles({ name: 'old.png', mimeType: 'image/png', buffer: png })
    await page.locator('.fb-send').click()
    await closeSnapshot(page, 'feedback')
    await change(page, 'feedback')
    await expect(page.locator('.ca-feedback textarea')).toHaveValue('')
    await expect(page.locator('.fb-prev')).toHaveCount(0)
    await page.locator('.ca-feedback textarea').fill('new visit')
    await page.evaluate(failed => Reflect.get(window, 'fhSettle')(failed ? 1 : 0, failed), failed)
    await page.waitForTimeout(420)
    await expect(page.locator('.ca-feedback textarea')).toHaveValue('new visit')
    await expect(page.locator('.fb-done, .ca-error')).toHaveCount(0)
    await expect(page.locator('.ca-feedback textarea')).toBeEnabled()
  }
  expect(await page.evaluate(() => Reflect.get(window, 'fhCalls'))).toEqual(['old visit', 'old visit'])
  expect(await page.evaluate(() => Reflect.get(window, 'fhRevoked').length)).toBe(2)
})

for (const kind of ['feedback', 'help'] as const) {
  test(`${kind} replacement locale retains focus and late closing handlers are inactive`, async ({ page }) => {
    await mount(page, kind)
    await change(page, 'locale')
    await expect(page.locator('.client-locale-panel')).toBeFocused()
    await page.waitForTimeout(420)
    await expect(page.locator('.client-locale-panel')).toBeFocused()
    await expect(page.locator('.ca-feedback, .site-help-pop')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page.locator('#entry')).toBeFocused()
  })
  test(`${kind} reduced motion clears immediately, owner replacement cannot restore old focus`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await mount(page, kind)
    await change(page, null)
    await expect(page.locator('[data-surface-closing=true]')).toHaveCount(0)
    await expect(page.locator('.ca-feedback, .site-help-pop')).toHaveCount(0)
    await change(page, kind)
    await page.evaluate(() => { Reflect.get(window, 'fhOwner')('owner-b') })
    await expect(page.locator('.ca-feedback, .site-help-pop')).toHaveCount(0)
    await page.locator('#other').focus()
    await page.waitForTimeout(420)
    await expect(page.locator('#other')).toBeFocused()
  })
}

test('floating help trigger can reopen during exit and preserves external click focus', async ({ page }) => {
  await mount(page, 'floating')
  await page.locator('.site-help-trigger').click()
  await page.locator('.help-close').click()
  await expect(page.locator('.site-help-pop')).toHaveAttribute('data-surface-closing', 'true')
  await page.locator('.site-help-trigger').click()
  await page.waitForTimeout(300)
  await expect(page.locator('.site-help-pop')).toBeVisible()
  await page.locator('#other').click()
  await expect(page.locator('#other')).toBeFocused()
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
})

test('feedback exact exit ignores bubbled and unrelated animation ends and keeps all 280ms', async ({ page }) => {
  await mount(page)
  const result = await page.evaluate(async () => {
    const layer = document.querySelector('.ca-feedback-layer') as HTMLElement
    const commit = new Promise<void>(resolve => { const observer = new MutationObserver(() => { if (layer.dataset.surfaceClosing === 'true') { observer.disconnect(); resolve() } }); observer.observe(layer, { attributes: true }) })
    Reflect.get(window, 'fhSurface')(null); await commit
    const panel = layer.querySelector('.ca-feedback')!
    panel.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 140 })
    layer.querySelector('textarea')!.dispatchEvent(new AnimationEvent('animationend', { animationName: 'client-feedback-out', bubbles: true }))
    panel.dispatchEvent(new AnimationEvent('animationend', { animationName: 'unrelated-out', bubbles: true }))
    await new Promise(resolve => setTimeout(resolve, 290))
    const matrix = new DOMMatrix(getComputedStyle(panel).transform)
    const retained = panel.isConnected, translation = matrix.m41, width = panel.getBoundingClientRect().width
    panel.dispatchEvent(new AnimationEvent('animationend', { animationName: 'client-feedback-out', bubbles: true }))
    return { retained, translation, width }
  })
  expect(result.retained).toBe(true)
  expect(result.translation).toBeGreaterThan(0)
  expect(result.translation).toBeLessThan(result.width * 1.05)
  await expect(page.locator('.ca-feedback')).toHaveCount(0)
})

test('closed late help mount cannot focus or register Escape against a newer locale', async ({ page }) => {
  await mount(page, 'help')
  await page.evaluate(() => Reflect.get(window, 'fhMountHelp')(false))
  await change(page, 'locale')
  await expect(page.locator('.client-locale-panel')).toBeFocused()
  await page.evaluate(() => Reflect.get(window, 'fhMountHelp')(true))
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
  await expect(page.locator('.client-locale-panel')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('#entry')).toBeFocused()
})

test('320px and seven languages keep the original panel within the viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 }); await mount(page)
  await page.locator('.ca-feedback textarea').fill('locale must not reset this visit')
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */path)).setClientPreference('language', language) }, language)
    await expect(page.locator('.ca-feedback textarea')).toHaveValue('locale must not reset this visit')
    await expect.poll(() => page.locator('.ca-feedback').evaluate(panel => panel.getAnimations().every(animation => animation.playState === 'finished'))).toBe(true)
    expect(await page.locator('.ca-feedback').evaluate(panel => { const rect = panel.getBoundingClientRect(); return panel.scrollWidth <= panel.clientWidth + 1 && rect.left >= -1 && rect.right <= innerWidth + 1 })).toBe(true)
    await change(page, 'help')
    await expect(page.locator('.help-close')).toBeFocused()
    await expect.poll(() => page.locator('.site-help-pop').evaluate(panel => panel.getAnimations().every(animation => animation.playState === 'finished'))).toBe(true)
    expect(await page.locator('.site-help-pop').evaluate(panel => { const rect = panel.getBoundingClientRect(); return panel.scrollWidth <= panel.clientWidth + 1 && rect.left >= -1 && rect.right <= innerWidth + 1 })).toBe(true)
    await expect(page.locator('.ca-feedback')).toHaveCount(0)
    await change(page, 'feedback')
    await page.locator('.ca-feedback textarea').fill('locale must not reset this visit')
  }
  await expect.poll(() => page.locator('.ca-feedback').evaluate(panel => panel.getAnimations().every(animation => animation.playState === 'finished'))).toBe(true)
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('feedback-320-fr.png') })
  await change(page, 'help')
  await expect(page.locator('.ca-feedback')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('help-320-fr.png') })
})

async function mountService(page: Page, signedIn = true) {
  await page.route('**/feedback-help-shell.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div></body></html>' }))
  await page.goto('/feedback-help-shell.html')
  await page.evaluate(async signedIn => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window); Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/internal-poc/ClientServiceExperience.tsx', source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing service React import')
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, dp = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */dp), { ClientServiceExperience } = await import(/* @vite-ignore */path)
    const props = { nativeAccounts: true, accountScope: 'motion-owner', state: { phase: 'ready', sessionState: signedIn ? 'AUTHENTICATED' : 'ANONYMOUS', messages: [], input: '보존할 서비스 초안', busy: false, inputDisabled: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null, onInput: () => {}, onSend: async () => {}, onReset: async () => {} } }
    const root = (DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('root'))
    root.render(React.createElement(React.StrictMode, null, React.createElement(ClientServiceExperience, props)))
  }, signedIn)
  await expect(page.locator('.client-service-app')).toBeVisible()
}

for (const shell of ['public', 'service'] as const) test(`${shell} member footer help closing keeps one visible headset trigger`, async ({ page }, info) => {
  const width = info.project.name === 'mobile' ? 320 : 1440
  await page.setViewportSize({ width, height: 900 })
  if (shell === 'service') await mountService(page); else {
    await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '도움말 검수', email: 'help-motion@example.test' })))
    await page.goto('/')
  }
  const entry = page.locator('.client-site-footer').getByRole('button', { name: footerCopy.ko.sections.help.items[0], exact: true })
  await expect(entry).toBeVisible(); await entry.click()
  await expect(page.locator('.client-modal-help .help-close')).toBeFocused()
  await expect(page.locator('.site-help-trigger:visible')).toHaveCount(1)
  const observed = await page.evaluate(async () => {
    const popup = document.querySelector('.client-modal-help .site-help-pop') as HTMLElement
    const commit = new Promise<void>(resolve => { const observer = new MutationObserver(() => { if (popup.dataset.surfaceClosing === 'true') { observer.disconnect(); resolve() } }); observer.observe(popup, { attributes: true }) })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await commit
    popup.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 16 })
    await new Promise(requestAnimationFrame)
    return { closing: popup.dataset.surfaceClosing, triggers: [...document.querySelectorAll<HTMLElement>('.site-help-trigger')].map(button => {
      const rect = button.getBoundingClientRect(), style = getComputedStyle(button)
      return { mode: button.closest('.client-modal-help') ? 'modal' : 'floating', visible: rect.width > 0 && rect.height > 0 && style.visibility === 'visible' && style.display !== 'none', inert: Boolean(button.closest('[inert]')), x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }) }
  })
  await info.attach(`${shell}-help-trigger-geometry-${width}`, { body: JSON.stringify(observed, null, 2), contentType: 'application/json' })
  expect(observed.closing).toBe('true')
  expect(observed.triggers.filter(trigger => trigger.visible)).toHaveLength(1)
  await expect(page.locator('.client-modal-help')).toHaveCount(0)
  await expect(page.locator('.site-help-trigger:visible')).toHaveCount(1)
  await expect(entry).toBeFocused()
  await page.locator('.site-help-trigger:visible').click()
  await expect(page.locator('.site-help:not(.client-modal-help) .site-help-pop')).toBeVisible()
})

for (const shell of ['public', 'service'] as const) for (const kind of ['feedback', 'help'] as const) {
  test(`${shell} guest shell ${kind} keeps exit visual only and restores the original entry`, async ({ page }, info) => {
    const renderErrors: string[] = []
    page.on('console', message => { if (message.type() === 'error' && /same key|unique.*key|Invalid hook call|React.*invariant/i.test(message.text())) renderErrors.push(message.text()) })
    page.on('pageerror', error => renderErrors.push(error.message))
    const width = info.project.name === 'mobile' ? 320 : 1440
    await page.setViewportSize({ width, height: 900 })
    if (shell === 'service') await mountService(page, false); else await page.goto('/')
    const settings = page.locator('[data-sidebar-action="settings"], [data-sidebar-action="profile-settings"]')
    const footerHelp = page.locator('.client-site-footer').getByRole('button', { name: footerCopy.ko.sections.help.items[0], exact: true })
    const enter = async () => {
      if (kind === 'help') { await footerHelp.click(); return }
      if (width <= 860) await page.locator('.client-hamburger').click()
      await expect(settings).toBeVisible()
      await settings.click()
      await page.locator('.ca-settings').getByRole('button', { name: '의견 보내기', exact: true }).click()
    }
    await enter()
    const panel = page.locator(kind === 'feedback' ? '.ca-feedback' : '.client-modal-help .site-help-pop')
    await expect(panel).toBeVisible()
    await expect(panel).toHaveCSS('animation-duration', kind === 'feedback' ? '0.28s' : '0.18s')
    if (kind === 'feedback') await panel.locator('textarea').fill('명시적 새 진입은 초기화')
    const snapshot = await page.evaluate(async kind => {
      const selector = kind === 'feedback' ? '.ca-feedback-layer' : '.client-modal-help .site-help-pop', layer = document.querySelector(selector) as HTMLElement
      const commit = new Promise<void>(resolve => { const observer = new MutationObserver(() => { if (layer.dataset.surfaceClosing === 'true') { observer.disconnect(); resolve() } }); observer.observe(layer, { attributes: true }) })
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await commit
      const panel = kind === 'feedback' ? layer.querySelector('.ca-feedback')! : layer
      const animation = panel.getAnimations()[0]; animation?.pause(); if (animation) animation.currentTime = kind === 'feedback' ? 28 : 16
      return { inert: layer.inert, hidden: layer.getAttribute('aria-hidden'), duration: getComputedStyle(panel).animationDuration }
    }, kind)
    await page.screenshot({ path: info.outputPath(`${shell}-${kind}-exit-progress-${width}.png`) })
    expect(snapshot).toEqual({ inert: true, hidden: 'true', duration: kind === 'feedback' ? '0.28s' : '0.16s' })
    await expect(kind === 'help' ? footerHelp : width === 320 ? page.locator('.client-hamburger') : settings).toBeFocused()
    await expect(page.locator('#root')).not.toHaveAttribute('inert', '')
    await expect(panel).toHaveCount(0)
    await enter()
    await expect(panel).toBeVisible()
    if (kind === 'feedback') await expect(panel.locator('textarea')).toHaveValue('')
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    if (shell === 'service') await expect(page.locator('#strategy-idea')).toHaveValue('보존할 서비스 초안')
    expect(renderErrors).toEqual([])
  })
}
