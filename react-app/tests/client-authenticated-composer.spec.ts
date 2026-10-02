import { expect, test, type Page } from '@playwright/test'
import copy from '../src/client-reference-copy.json' with { type: 'json' }

// Presentation props and synthetic same-origin native session responses only.
// No actual authentication, provider, attachment or strategy producer.
test.use({ trace: 'off', video: 'off' })
test.setTimeout(30_000)
const plus = (page: Page) => page.locator('.client-home-plus')
const popover = (page: Page) => page.locator('.client-plus-popover')
const input = (page: Page) => page.locator('#strategy-idea')
const texts = {
  ko: ['곧 제공됩니다.', '확인'], en: ['Coming soon.', 'OK'], ja: ['近日公開予定です。', '確認'],
  'zh-CN': ['即将推出。', '确认'], 'zh-TW': ['即將推出。', '確認'], es: ['Próximamente.', 'Aceptar'], fr: ['Bientôt disponible.', 'OK'],
} as const
const locale = (page: Page, code: string) => page.evaluate(async code => {
  const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', code)
}, code)

async function nativeHome(page: Page, authenticated: boolean) {
  const calls: string[] = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    calls.push(`${request.method()} ${path}`)
    const meta = { apiContractVersion: '0.1.0', requestId: 'req_composer_fixture_000001', traceId: 'trace_composer_fixture_000001', resourceRevision: path.endsWith('/session') ? '1' : null }
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: '"composer_session_etag_000001"' }
    if (path.endsWith('/session')) return route.fulfill({ status: 200, headers, body: JSON.stringify({ meta, data: { sessionId: 'session_composer_fixture_000001', state: authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) })
    if (path.endsWith('/csrf')) { delete headers.ETag; return route.fulfill({ status: 200, headers, body: JSON.stringify({ meta, data: { csrfToken: 'csrf_composer_fixture_000001', expiresAt: '2030-01-02T00:00:00Z' } }) }) }
    return route.abort('failed')
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(input(page)).toBeVisible()
  return calls
}

async function mountHome(page: Page, signedIn = true) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/authenticated-composer-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><button id="outside">Outside</button><div id="fixture"></div></body></html>' }))
  await page.goto('/authenticated-composer-fixture.html')
  await page.evaluate(async signedIn => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    for (const path of ['/src/internal-poc/internal-poc.css', '/src/client-reference.css']) await import(/* @vite-ignore */ path)
    const path = '/src/components/ClientHomeSurface.tsx', source = await (await fetch(path)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('React dependency missing')
    const rm = await import(/* @vite-ignore */ reactPath), react = rm.default ?? rm, h = react.createElement
    const domPath = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ domPath), { ClientHomeSurface } = await import(/* @vite-ignore */ path)
    const calls: string[] = []
    function Host() {
      const [value, onChange] = react.useState(''), [authenticated, setSignedIn] = react.useState(signedIn), [visible, setVisible] = react.useState(true)
      const [selection, onSelectionChange] = react.useState({ acts: [], assets: [] }), inputRef = react.useRef(null)
      Object.assign(window, { composerAudit: { calls, setSignedIn, setVisible } })
      return visible ? h(ClientHomeSurface, { value, inputRef, onChange, signedIn: authenticated, selection, onSelectionChange,
        onSend: () => calls.push('send'), onLogin: () => calls.push('login'), onSignup: () => calls.push('signup') }) : null
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  }, signedIn)
  await expect(plus(page)).toBeVisible()
}

test('실제 인증홈 ＋는 원본 곧제공·확인을 표시하고 로그인이나서버요청을 만들지 않는다', async ({ page }) => {
  const calls = await nativeHome(page, true), before = [...calls]
  await input(page).fill('보존할 초안')
  await plus(page).click()
  await expect(popover(page).locator('p')).toHaveText('곧 제공됩니다.')
  await expect(popover(page).getByRole('button', { name: '로그인', exact: true })).toHaveCount(0)
  await popover(page).getByRole('button', { name: '확인', exact: true }).click()
  await expect(popover(page)).toHaveCount(0)
  await expect(plus(page)).toBeFocused()
  await expect(input(page)).toHaveValue('보존할 초안')
  expect(calls).toEqual(before)
  await expect(page.locator('.native-auth-surface')).toHaveCount(0)
})

test('guest ＋는 기존 로그인문구와 실제 로그인동선을 유지한다', async ({ page }) => {
  const calls = await nativeHome(page, false), before = [...calls]
  await input(page).fill('게스트 미전송 초안')
  await plus(page).click()
  await expect(popover(page).locator('p')).toHaveText(copy.I18N['plus.b'].ko)
  await popover(page).getByRole('button', { name: '로그인', exact: true }).click()
  await expect(popover(page)).toHaveCount(0)
  await expect(page.getByRole('region', { name: '실제 계정 로그인', exact: true })).toBeVisible()
  expect(calls).toEqual([...before, 'GET /api/v1/auth/session'])
  await expect(input(page)).toHaveValue('게스트 미전송 초안')
})

test('원본 mouse hover500ms·leave250ms·popover이동유지와 조기이탈취소를 지킨다', async ({ page }) => {
  await mountHome(page)
  await page.clock.install({ time: new Date('2026-10-02T00:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-02T00:00:10Z'))
  await plus(page).dispatchEvent('pointerover', { pointerType: 'mouse' })
  await page.clock.runFor(499); await expect(popover(page)).toHaveCount(0)
  await page.clock.runFor(1); await expect(popover(page)).toBeVisible()
  await plus(page).dispatchEvent('pointerout', { pointerType: 'mouse' })
  await page.clock.runFor(200)
  await popover(page).dispatchEvent('pointerover', { pointerType: 'mouse' })
  await page.clock.runFor(500); await expect(popover(page)).toBeVisible()
  await popover(page).dispatchEvent('pointerout', { pointerType: 'mouse' })
  await page.clock.runFor(249); await expect(popover(page)).toBeVisible()
  await page.clock.runFor(1); await expect(popover(page)).toHaveCount(0)
  await plus(page).dispatchEvent('pointerover', { pointerType: 'mouse' })
  await page.clock.runFor(300)
  await plus(page).dispatchEvent('pointerout', { pointerType: 'mouse' })
  await page.clock.runFor(800); await expect(popover(page)).toHaveCount(0)
})

test('Escape는pending hover를취소하고키보드로사용중인popover는pointer이탈만으로닫지않는다', async ({ page }) => {
  await mountHome(page)
  await page.clock.install({ time: new Date('2026-10-02T00:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-02T00:00:10Z'))
  await input(page).focus()
  await plus(page).dispatchEvent('pointerover', { pointerType: 'mouse' })
  await page.clock.runFor(200); await page.keyboard.press('Escape')
  await page.clock.runFor(800); await expect(popover(page)).toHaveCount(0)
  await expect(input(page)).toBeFocused()
  await plus(page).dispatchEvent('pointerover', { pointerType: 'mouse' })
  await page.clock.runFor(500)
  await popover(page).getByRole('button').focus()
  await popover(page).dispatchEvent('pointerout', { pointerType: 'mouse' })
  await page.clock.runFor(500); await expect(popover(page)).toBeVisible()
  await expect(popover(page).getByRole('button')).toBeFocused()
  await page.keyboard.press('Escape'); await expect(popover(page)).toHaveCount(0)
  await expect(plus(page)).toBeFocused()
})

test('touch는hover timer없이 클릭하며Enter·Space·Escape·확인으로동일메뉴를조작한다', async ({ page }) => {
  await mountHome(page)
  await page.clock.install()
  await plus(page).dispatchEvent('pointerover', { pointerType: 'touch' })
  await page.clock.runFor(600); await expect(popover(page)).toHaveCount(0)
  await plus(page).click(); await expect(popover(page)).toBeVisible()
  await page.keyboard.press('Escape'); await expect(popover(page)).toHaveCount(0)
  await expect(plus(page)).toBeFocused()
  await plus(page).press('Enter'); await expect(popover(page)).toBeVisible()
  await plus(page).press('Space'); await expect(popover(page)).toHaveCount(0)
  await plus(page).press('Space')
  await popover(page).getByRole('button', { name: '확인', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(popover(page)).toHaveCount(0); await expect(plus(page)).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'composerAudit').calls)).toEqual([])
})

test('열린메뉴의7언어·인증props변경은단일입력DOM·선택·초안과서버권한을보존한다', async ({ page }) => {
  await mountHome(page)
  await input(page).fill('편집하던 초안 $& {id}')
  const node = await input(page).elementHandle()
  await plus(page).click()
  await input(page).focus(); await input(page).evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(2, 6, 'backward'))
  for (const code of Object.keys(texts) as (keyof typeof texts)[]) {
    await locale(page, code)
    await expect(popover(page).locator('strong')).toHaveText(copy.I18N['plus.t'][code])
    await expect(popover(page).locator('p')).toHaveText(texts[code][0])
    await expect(popover(page).getByRole('button')).toHaveText(texts[code][1])
    await expect(input(page)).toHaveValue('편집하던 초안 $& {id}')
    await expect(input(page)).toBeFocused()
    expect(await input(page).evaluate((current, original) => current === original, node)).toBe(true)
    expect(await input(page).evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd, (node as HTMLTextAreaElement).selectionDirection])).toEqual([2, 6, 'backward'])
  }
  await page.evaluate(() => Reflect.get(window, 'composerAudit').setSignedIn(false))
  await expect(popover(page).locator('p')).toHaveText(copy.I18N['plus.b'].fr)
  await expect(popover(page).getByRole('button')).toHaveText(copy.I18N['nav.login'].fr)
  await page.evaluate(() => Reflect.get(window, 'composerAudit').setSignedIn(true))
  await expect(popover(page).locator('p')).toHaveText(texts.fr[0])
  expect(await page.evaluate(() => Reflect.get(window, 'composerAudit').calls)).toEqual([])
})

test('클릭닫기·외부클릭·확대·navigation·unmount는미처리hover를재실행하지않는다', async ({ page }) => {
  await mountHome(page)
  await input(page).fill('전체 화면에서 편집할 초안\n두 번째 조건')
  await page.clock.install()
  await plus(page).dispatchEvent('pointerover', { pointerType: 'mouse' })
  await page.clock.runFor(200); await plus(page).click(); await plus(page).click()
  await page.clock.runFor(800); await expect(popover(page)).toHaveCount(0)
  await plus(page).click(); await page.locator('#outside').click()
  await page.clock.runFor(800); await expect(popover(page)).toHaveCount(0)
  await plus(page).dispatchEvent('pointerover', { pointerType: 'mouse' })
  await page.getByRole('button', { name: '전체 화면', exact: true }).click()
  await page.clock.runFor(800); await expect(popover(page)).toHaveCount(0)
  await expect(page.locator('.client-composer-dialog')).toBeVisible()
  await plus(page).click(); await popover(page).getByRole('button', { name: '확인', exact: true }).click()
  await expect(page.locator('.client-composer-dialog')).toBeVisible()
  await plus(page).dispatchEvent('pointerover', { pointerType: 'mouse' })
  await page.evaluate(() => { history.pushState(null, '', '/policies/'); window.dispatchEvent(new Event('teth:navigate')) })
  await page.clock.runFor(800)
  await expect(page.locator('.client-composer-dialog')).toHaveCount(0); await expect(popover(page)).toHaveCount(0)
  await plus(page).dispatchEvent('pointerover', { pointerType: 'mouse' })
  await page.evaluate(() => Reflect.get(window, 'composerAudit').setVisible(false))
  await page.clock.runFor(800); await expect(popover(page)).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'composerAudit').setVisible(true))
  await page.clock.runFor(800); await expect(popover(page)).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'composerAudit').calls)).toEqual([])
})

test('320px 실제인증홈 메뉴는7언어에서화면안에있고모바일확인으로닫힌다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const calls = await nativeHome(page, true), before = [...calls]
  const help = page.locator('.client-source-app > .site-help')
  await expect(help).toBeVisible()
  await plus(page).click()
  for (const code of Object.keys(texts) as (keyof typeof texts)[]) {
    await locale(page, code)
    await expect(popover(page).locator('p')).toHaveText(texts[code][0])
    const box = await popover(page).boundingBox()
    expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(321)
    expect(await popover(page).getByRole('button').evaluate(node => {
      const r = node.getBoundingClientRect()
      return [[r.x + r.width / 2, r.y + r.height / 2], [r.right - 12, r.bottom - 12]].map(([x, y]) => node.contains(document.elementFromPoint(x, y)))
    })).toEqual([true, true])
    await expect(help).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('authenticated-plus-320-fr.png') })
  await popover(page).getByRole('button').click(); await expect(popover(page)).toHaveCount(0)
  await expect(help).toBeVisible()
  expect(calls).toEqual(before)
})
