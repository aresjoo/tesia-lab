import { expect, test, type Locator } from '@playwright/test'

// 원본 aresjoo/tesia-lab@9fbff821 index.html:12/16/29/31/33/34/41,
// 124-125/138-139/5344/26190-26195/26443. Main preview 표시 검수만 한다.
// Native SMTP/provider/실인증 결과와 다르며 API 응답 fixture도 사용하지 않는다.
test.use({ serviceWorkers: 'block' })
const viewports = [{ width: 320, height: 480 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]
const originalFont = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif'
const guards = new WeakMap<object, { attempts: string[]; errors: string[] }>()

test.beforeEach(async ({ context, page, baseURL }) => {
  if (!baseURL) throw new Error('이 시험에는 로컬 baseURL이 필요합니다.')
  const origin = new URL(baseURL).origin
  const attempts: string[] = [], errors: string[] = []
  guards.set(context, { attempts, errors })
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || /^\/api(?:\/|$)/.test(url.pathname) || request.method() !== 'GET') {
      attempts.push(`${request.method()} ${url.origin}${url.pathname}`)
      return route.abort('blockedbyclient')
    }
    return route.continue()
  })
  await context.routeWebSocket('**/*', socket => {
    const url = new URL(socket.url()), local = new URL(origin)
    if (url.host !== local.host || !['ws:', 'wss:'].includes(url.protocol)) attempts.push(`WS ${url.origin}${url.pathname}`)
    // HMR도 필요하지 않다. 실제 외부 WS/provider 연결은 허용하지 않는다.
    socket.close()
  })
  await page.addInitScript(() => {
    // 정상 Main의 선호값과 배너 표시만 고정한다. 계정/대화/연구 데이터는 seed하지 않는다.
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem('tethCurrency', 'USD')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
  })
})

test.afterEach(async ({ context }, info) => {
  const audit = guards.get(context)
  await info.attach('main-network-guard', { body: Buffer.from(JSON.stringify(audit)), contentType: 'application/json' })
  expect(audit).toEqual({ attempts: [], errors: [] })
})

async function centerHit(locator: Locator) {
  await expect(locator).toBeVisible()
  return locator.evaluate(element => {
    const rect = element.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return hit === element || element.contains(hit)
  })
}

for (const viewport of viewports) {
  test(`원본 Main ${viewport.width}×${viewport.height} 코드 토스트: body portal·26px 중앙·모션·초점·닫기 수명`, async ({ page }, info) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await expect(page.locator('.client-gallery-home')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
    await page.evaluate(() => document.fonts.ready)
    const root = page.locator('#root'), login = page.locator('.client-auth-nav .client-login')
    const initial = await page.evaluate(() => ({ inert: document.getElementById('root')!.inert, overflow: document.body.style.overflow }))
    expect(initial.inert).toBe(false)
    expect(await centerHit(login)).toBe(true)
    await login.click()
    const dialog = page.getByRole('dialog'), toast = dialog.locator('.ca-code-toast')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(await root.evaluate(element => element.inert)).toBe(true)
    await expect(toast).toHaveCount(1)
    await expect(toast).toHaveText('')
    await expect(toast).not.toHaveClass(/\bshow\b/)
    expect(await toast.evaluate(element => element.closest('#root,[inert]') === null)).toBe(true)
    await page.evaluate(() => document.fonts.ready)
    await page.clock.install()
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
    const email = dialog.getByRole('textbox', { name: '이메일 주소', exact: true })
    await expect(email).toBeFocused()
    await email.fill('main-notice@example.test')
    const submit = dialog.getByRole('button', { name: '계속', exact: true })
    expect(await centerHit(submit)).toBe(true)
    await submit.click()
    await expect(dialog.getByRole('heading', { name: '받은 편지함을 확인하십시오', exact: true })).toBeVisible()
    const code = dialog.getByRole('textbox', { name: '코드', exact: true })
    await expect(code).toBeFocused()
    await expect(toast).toHaveText('인증 코드를 보냈습니다')
    await expect(toast).toHaveClass(/\bshow\b/)
    await expect(toast).toHaveAttribute('role', 'status')
    await expect(toast).toHaveAttribute('aria-live', 'polite')
    await expect(toast).toHaveAttribute('aria-atomic', 'true')
    await page.clock.runFor(300)
    // 합성 JS 시계로 좌표를 추측하지 않고 원 CSS transition 완료만 기다린다.
    await toast.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)) })
    const geometry = await toast.evaluate(element => {
      const rect = element.getBoundingClientRect(), css = getComputedStyle(element)
      return {
        x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom,
        viewport: { width: innerWidth, height: innerHeight },
        overflow: document.documentElement.scrollWidth > innerWidth,
        dialog: !!element.closest('[role="dialog"][aria-modal="true"]'),
        root: !!element.closest('#root'), inert: !!element.closest('[inert]'),
        css: { position: css.position, bottom: css.bottom, padding: css.padding, borderRadius: css.borderRadius,
          background: css.backgroundColor, color: css.color, fontFamily: css.fontFamily, fontSize: css.fontSize,
          fontWeight: css.fontWeight, lineHeight: css.lineHeight, wordBreak: css.wordBreak,
          smoothing: css.webkitFontSmoothing, duration: css.transitionDuration, easing: css.transitionTimingFunction },
      }
    })
    await info.attach('main-toast-geometry', { body: Buffer.from(JSON.stringify(geometry)), contentType: 'application/json' })
    expect(geometry.width).toBeGreaterThan(0)
    expect(geometry.height).toBeGreaterThan(0)
    expect(geometry.x).toBeGreaterThanOrEqual(0)
    expect(geometry.y).toBeGreaterThanOrEqual(0)
    expect(geometry.right).toBeLessThanOrEqual(viewport.width)
    expect(geometry.bottom).toBeLessThanOrEqual(viewport.height)
    expect(Math.abs(geometry.x + geometry.width / 2 - viewport.width / 2)).toBeLessThan(1)
    expect(Math.abs(viewport.height - geometry.bottom - 26)).toBeLessThan(1)
    expect(geometry.overflow).toBe(false)
    expect(geometry.dialog).toBe(true)
    expect(geometry.root).toBe(false)
    expect(geometry.inert).toBe(false)
    expect(geometry.css.position).toBe('fixed')
    expect(geometry.css.bottom).toBe('26px')
    expect(geometry.css.padding).toBe('11px 20px')
    expect(geometry.css.borderRadius).toBe('10px')
    expect(geometry.css.background).toMatch(/^oklch\((?:0\.22|22%) 0\.012 262\)$/)
    expect(geometry.css.color).toMatch(/^oklch\((?:0\.996|99\.6%) 0\.001 95\)$/)
    expect(geometry.css.fontFamily).toBe(originalFont)
    expect(geometry.css.fontSize).toBe('13px')
    expect(geometry.css.fontWeight).toBe('500')
    expect(parseFloat(geometry.css.lineHeight) / parseFloat(geometry.css.fontSize)).toBeCloseTo(1.6, 6)
    expect(geometry.css.wordBreak).toBe('keep-all')
    expect(geometry.css.smoothing).toBe('antialiased')
    expect(geometry.css.duration).toBe('0.3s')
    expect(geometry.css.easing).toBe('cubic-bezier(0.16, 1, 0.3, 1)')
    expect(await centerHit(code)).toBe(true)
    await expect(code).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(submit).toBeFocused()
    expect(await toast.evaluate(element => element.contains(document.activeElement))).toBe(false)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await toast.evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0.01s')
    await page.screenshot({ path: info.outputPath(`main-code-toast-${viewport.width}.png`) })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    expect(await root.evaluate(element => element.inert)).toBe(false)
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(initial.overflow)
    await expect(login).toBeFocused()
    await login.click()
    await expect(dialog).toBeVisible()
    await expect(toast).toHaveText('')
    await expect(toast).not.toHaveClass(/\bshow\b/)
    await expect(dialog.getByRole('textbox', { name: '이메일 주소', exact: true })).toBeFocused()
    await page.clock.runFor(3000)
    await expect(toast).toHaveText('')
    await expect(toast).not.toHaveClass(/\bshow\b/)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    expect(await root.evaluate(element => element.inert)).toBe(false)
    await expect(login).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    info.annotations.push({ type: 'scope', description: '원본9fb Main preview 실제 portal; SWblock/외부·API·nonGET차단; 실제SMTP/provider로그인 증거 아님' })
  })
}
