import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'

// Independent literal Golden: aresjoo/tesia-lab@9fbff821 index.html:11671/26156.
// Normal Main preview only. These messages are not provider/SMTP/server ACKs.
const golden = { login: '다시 만나서 반갑습니다', signup: '계정 준비 완료, 시장은 기다려주지 않습니다', providerSuffix: ' 인증 완료' }
const viewports = [{ width: 320, height: 480 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]
type Mode = 'login' | 'signup'
type Audit = { attempts: { kind: string; method: string }[]; errors: string[] }
const audits = new WeakMap<BrowserContext, Audit>()
test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ context, page, baseURL }) => {
  if (!baseURL) throw new Error('로컬 Main origin이 필요합니다.')
  const origin = new URL(baseURL).origin, audit: Audit = { attempts: [], errors: [] }
  audits.set(context, audit)
  const observe = (page: Page) => page.on('pageerror', error => audit.errors.push(error.name))
  observe(page); context.on('page', observe)
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    const kind = url.origin !== origin ? 'external' : /^\/api(?:\/|$)/i.test(url.pathname) ? 'api' : request.method() !== 'GET' ? 'mutation' : null
    if (kind) { audit.attempts.push({ kind, method: request.method() }); return route.abort('blockedbyclient') }
    return route.continue()
  })
  await context.routeWebSocket('**', socket => {
    const url = new URL(socket.url()), local = new URL(origin)
    if (url.host !== local.host || /^\/api(?:\/|$)/i.test(url.pathname)) audit.attempts.push({ kind: 'websocket', method: 'WS' })
    socket.close()
  })
  await context.addInitScript(origin => {
    if (location.origin !== origin) return
    // Only Main display preferences; no account, session, conversation or research seed.
    localStorage.setItem('tethLang', 'ko'); localStorage.setItem('tethCurrency', 'USD')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
  }, origin)
})
test.afterEach(async ({ context }, info) => {
  const audit = audits.get(context)
  await info.attach('preview-auth-network-guard', { body: Buffer.from(JSON.stringify(audit)), contentType: 'application/json' })
  expect(audit).toEqual({ attempts: [], errors: [] })
})

async function hit(control: Locator) {
  await expect(control).toBeVisible()
  expect(await control.evaluate(element => {
    const r = element.getBoundingClientRect(), found = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return found === element || !!found && element.contains(found)
  })).toBe(true)
}

async function open(page: Page, viewport: { width: number; height: number }, mode: Mode) {
  await page.setViewportSize(viewport)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await expect(page.locator('.client-gallery-home')).toBeVisible()
  const entry = page.locator(mode === 'login' ? '.client-auth-nav .client-login' : '.client-auth-nav .client-signup')
  await hit(entry); await entry.click()
  const dialog = page.getByRole('dialog').filter({ has: page.locator('.au-title') })
  await expect(dialog).toBeVisible()
  expect(await page.locator('#root').evaluate(element => element.inert)).toBe(true)
  await page.evaluate(() => document.fonts.ready)
  await page.clock.install()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  return dialog
}

async function notice(page: Page, text: string, viewport: { width: number; height: number }) {
  const toast = page.locator('.ca-code-toast[data-preview-auth-notice]')
  await expect(toast).toHaveCount(1)
  await expect(toast).toHaveText(text)
  await expect(toast).toHaveClass(/\bshow\b/)
  await expect(toast).toHaveAttribute('role', 'status')
  await expect(toast).toHaveAttribute('aria-live', 'polite')
  await expect(toast).toHaveAttribute('aria-atomic', 'true')
  await toast.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)) })
  const box = await toast.evaluate(element => {
    const r = element.getBoundingClientRect(), css = getComputedStyle(element)
    return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
      outsideRoot: element.closest('#root') === null, inert: !!element.closest('[inert]'),
      dialog: !!element.closest('[role="dialog"]'), position: css.position, pointerEvents: css.pointerEvents,
      overflow: document.documentElement.scrollWidth > innerWidth }
  })
  expect(box.outsideRoot).toBe(true); expect(box.inert).toBe(false); expect(box.dialog).toBe(false)
  expect(box.position).toBe('fixed'); expect(box.pointerEvents).toBe('none')
  expect(box.width).toBeGreaterThan(0); expect(box.height).toBeGreaterThan(0)
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.right).toBeLessThanOrEqual(viewport.width); expect(box.bottom).toBeLessThanOrEqual(viewport.height)
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(1)
  expect(Math.abs(viewport.height - box.bottom - 26)).toBeLessThan(1)
  expect(box.overflow).toBe(false)
  return toast
}

async function finishAge(page: Page, dialog: Locator) {
  await expect(dialog.getByRole('heading', { name: '연령을 알려주세요', exact: true })).toBeVisible()
  const age = dialog.getByRole('textbox', { name: '연령', exact: true })
  await expect(age).toBeFocused(); await hit(age); await age.fill('30')
  const submit = dialog.locator('button.au-btn.primary[type="submit"]')
  await expect(submit).toHaveAccessibleName('시장에 입장하기')
  const originalSubmit = await submit.elementHandle()
  if (!originalSubmit) throw new Error('원본 연령 제출 버튼이 필요합니다.')
  await hit(submit); await submit.click()
  await expect(submit).toBeDisabled()
  expect(await submit.evaluate((element, original) => element === original, originalSubmit)).toBe(true)
  await expect(submit).toHaveAttribute('aria-busy', 'true')
  await expect(submit.locator('.au-spin')).toHaveAttribute('aria-label', '처리 중')
  await page.clock.runFor(999); await expect(dialog).toBeVisible()
  await page.clock.runFor(1); await expect(dialog).toHaveCount(0)
}

async function signedIn(page: Page) {
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.client-auth-nav .client-login,.client-auth-nav .client-signup')).toHaveCount(0)
  const account = page.locator('.client-sidebar-bottom [data-sidebar-action="account"]')
  await expect(account).toHaveCount(1)
  await expect(account).toHaveAttribute('aria-label', '내 계정')
  await expect(account.locator('span')).toHaveCount(0)
  expect(await page.locator('#root').evaluate(element => element.inert)).toBe(false)
}

for (const viewport of viewports) for (const provider of ['Google', 'Apple'] as const) {
  test(`원본 Main ${viewport.width}px ${provider} 로그인·가입 안내: provider→완료 queue와 body portal`, async ({ context }, info) => {
    for (const mode of ['login', 'signup'] as const) {
      const page = await context.newPage(), dialog = await open(page, viewport, mode)
      const button = dialog.getByRole('button', { name: `${provider}로 계속하기`, exact: true })
      await hit(button); await button.click()
      const providerText = provider + golden.providerSuffix
      const toast = await notice(page, providerText, viewport)
      if (mode === 'signup') {
        expect(await page.locator('#root').evaluate(element => element.inert)).toBe(true)
        await finishAge(page, dialog)
        await expect(toast).toHaveText(providerText)
        await page.clock.runFor(1199)
      } else {
        await signedIn(page); await page.clock.runFor(2199)
      }
      await expect(toast).toHaveClass(/\bshow\b/)
      await expect(toast).toHaveText(providerText)
      await page.clock.runFor(1); await expect(toast).not.toHaveClass(/\bshow\b/)
      await page.clock.runFor(239); await expect(toast).not.toHaveClass(/\bshow\b/)
      await expect(toast).toHaveText(providerText)
      await page.clock.runFor(1); await notice(page, golden[mode], viewport); await signedIn(page)
      await page.screenshot({ path: info.outputPath(`preview-${provider}-${mode}-${viewport.width}.png`) })
      await page.clock.runFor(2199); await expect(toast).toHaveClass(/\bshow\b/)
      await page.clock.runFor(1); await expect(toast).not.toHaveClass(/\bshow\b/)
      await expect(toast).toHaveText(golden[mode])
      await page.clock.runFor(3000); await expect(toast).not.toHaveClass(/\bshow\b/)
      await page.close()
    }
    const cancelled = await context.newPage(), dialog = await open(cancelled, viewport, 'signup')
    await dialog.getByRole('button', { name: `${provider}로 계속하기`, exact: true }).click()
    const toast = await notice(cancelled, provider + golden.providerSuffix, viewport)
    await expect(dialog.getByRole('heading', { name: '연령을 알려주세요', exact: true })).toBeVisible()
    await cancelled.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(cancelled.locator('.client-auth-nav .client-login')).toBeVisible()
    expect(await cancelled.locator('#root').evaluate(element => element.inert)).toBe(false)
    await cancelled.clock.runFor(2199); await expect(toast).toHaveClass(/\bshow\b/)
    await cancelled.clock.runFor(1); await expect(toast).not.toHaveClass(/\bshow\b/)
    await cancelled.clock.runFor(3000)
    await expect(toast).toHaveText(provider + golden.providerSuffix)
    await expect(toast).not.toHaveClass(/\bshow\b/)
    await expect(cancelled.locator('.client-auth-nav .client-signup')).toBeVisible()
    await cancelled.close()
    info.annotations.push({ type: 'scope', description: '원9fb provider/완료 literal의 Main preview 표시만; 실제 provider/account/auth ACK 아님' })
  })
}

for (const viewport of viewports) {
  test(`원본 Main ${viewport.width}px 이메일 코드·비밀번호 로그인과 가입 완료 안내`, async ({ context }, info) => {
    for (const method of ['code-login', 'password-login', 'signup'] as const) {
      const mode = method === 'signup' ? 'signup' : 'login'
      const page = await context.newPage(), dialog = await open(page, viewport, mode)
      await dialog.getByRole('textbox', { name: '이메일 주소', exact: true }).fill('preview-notice@example.test')
      await dialog.getByRole('button', { name: '계속', exact: true }).click()
      if (method === 'signup') {
        await expect(dialog.getByRole('heading', { name: '비밀번호 생성하기', exact: true })).toBeVisible()
        await dialog.getByLabel('비밀번호', { exact: true }).fill('TEST ONLY 0123!')
        await dialog.getByRole('button', { name: '계속', exact: true }).click()
      }
      const localCode = dialog.locator('.ca-code-toast')
      await expect(localCode).toHaveText('인증 코드를 보냈습니다')
      await expect(localCode).toHaveClass(/\bshow\b/)
      if (method === 'password-login') {
        await dialog.getByRole('button', { name: '비밀번호로 계속하기', exact: true }).click()
        await dialog.getByLabel('비밀번호', { exact: true }).fill('TEST ONLY 0123!')
      } else await dialog.getByRole('textbox', { name: '코드', exact: true }).fill('123456')
      await dialog.getByRole('button', { name: '계속', exact: true }).click()
      if (mode === 'signup') await finishAge(page, dialog)
      await signedIn(page)
      const toast = await notice(page, golden[mode], viewport)
      await expect(page.locator('.ca-code-toast:not([data-preview-auth-notice])')).toHaveCount(0)
      await page.clock.runFor(2199); await expect(toast).toHaveClass(/\bshow\b/)
      await page.clock.runFor(1); await expect(toast).not.toHaveClass(/\bshow\b/)
      await expect(toast).toHaveText(golden[mode])
      await page.screenshot({ path: info.outputPath(`preview-email-${method}-${viewport.width}.png`) })
      await page.close()
    }
    info.annotations.push({ type: 'scope', description: '기존 Main 이메일 preview의 완료 안내만; SMTP/SDK/실제코드발송0' })
  })
}
