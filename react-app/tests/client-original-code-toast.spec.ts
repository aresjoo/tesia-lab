import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// 고정 원본 9fbff821:index.html 26443–26444행의 literal이다.
// 사전에서 기대값을 생성하지 않으며 Native SMTP/실제 전송 성공을 인증하지 않는다.
const original = {
  ko: ['인증 코드를 보냈습니다', '인증 코드를 다시 보냈습니다'],
  en: ['Verification code sent', 'We sent a new code'],
  ja: ['認証コードを送信しました', '認証コードを再送しました'],
  'zh-CN': ['验证码已发送', '已重新发送验证码'],
  'zh-TW': ['驗證碼已發送', '已重新發送驗證碼'],
  es: ['Código enviado', 'Hemos reenviado el código'],
  fr: ['Code envoyé', 'Nouveau code envoyé'],
} as const

test.use({ serviceWorkers: 'block' })
type Language = keyof typeof original
const copy = JSON.parse(readFileSync(new URL('../src/client-reference-copy.json', import.meta.url), 'utf8')) as { I18N: Record<string, Record<Language, string>> }
const widths = [{ width: 320, height: 480 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]
const preference = new WeakMap<object, Language>()

async function seedLanguage(page: Page, language: Language) {
  preference.set(page.context(), language)
  // 기존 fixture에는 언어 선택 UI가 없다. 인증 상태가 아닌 선언된 초기 선호값만 제공한다.
  await page.addInitScript(value => { localStorage.setItem('tethLang', value) }, language)
}

async function openLogin(page: Page) {
  await page.goto('/tests/fixtures/client-account-ui.html')
  await expect(page.getByRole('button', { name: 'login', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'login', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.evaluate(async () => { await document.fonts.ready })
  await page.clock.install()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
}

async function sendPreviewCode(page: Page, language: Language) {
  await page.getByRole('textbox', { name: copy.I18N['auth.email'][language], exact: true }).fill('notice@example.test')
  await page.getByRole('button', { name: copy.I18N['auth.continue'][language], exact: true }).click()
  await expect(page.getByRole('heading', { name: copy.I18N['code.title'][language], exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: copy.I18N['code.ph'][language], exact: true })).toBeFocused()
}

async function expectShown(page: Page, message: string) {
  const toast = page.locator('.ca-code-toast')
  await expect(toast).toHaveCount(1)
  await expect(toast).toHaveAttribute('role', 'status')
  await expect(toast).toHaveAttribute('aria-live', 'polite')
  await expect(toast).toHaveAttribute('aria-atomic', 'true')
  await expect(toast).toHaveClass(/\bshow\b/)
  await expect(toast).toHaveText(message)
}

async function inspectGeometry(page: Page, language: Language) {
  // 합성 시계는 CSS native timeline을 완료하지 않는다. 원본 transition 종료만 기다리며,
  // 아래 26px·<1px·전체 rect·hit 기준과 2200ms 합성 시간은 변경하지 않는다.
  await page.locator('.ca-code-toast').evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished))
  })
  const geometry = await page.locator('.ca-code-toast').evaluate(element => {
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
    const input = document.querySelector<HTMLInputElement>('.ca-auth input[autocomplete="one-time-code"]')!
    const inputRect = input.getBoundingClientRect()
    const inputHit = document.elementFromPoint(inputRect.x + inputRect.width / 2, inputRect.y + inputRect.height / 2)
    const toastHit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return {
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right },
      viewport: { width: innerWidth, height: innerHeight },
      inputHit: inputHit === input,
      toastHit: toastHit === element || element.contains(toastHit),
      inert: !!element.closest('[inert]'),
      overflow: document.documentElement.scrollWidth > innerWidth,
      style: { position: style.position, bottom: style.bottom, padding: style.padding, borderRadius: style.borderRadius, color: style.color, backgroundColor: style.backgroundColor, boxShadow: style.boxShadow, transitionDuration: style.transitionDuration, transitionTimingFunction: style.transitionTimingFunction, fontSize: style.fontSize, fontFamily: style.fontFamily, fontWeight: style.fontWeight, lineHeight: style.lineHeight, wordBreak: style.wordBreak, smoothing: style.webkitFontSmoothing },
    }
  })
  await test.info().attach(`geometry-${language}`, { body: Buffer.from(JSON.stringify(geometry)), contentType: 'application/json' })
  expect(geometry.rect.width).toBeGreaterThan(0)
  expect(geometry.rect.height).toBeGreaterThan(0)
  expect(geometry.rect.x).toBeGreaterThanOrEqual(0)
  expect(geometry.rect.y).toBeGreaterThanOrEqual(0)
  expect(geometry.rect.right).toBeLessThanOrEqual(geometry.viewport.width)
  expect(geometry.rect.bottom).toBeLessThanOrEqual(geometry.viewport.height)
  expect(Math.abs(geometry.rect.x + geometry.rect.width / 2 - geometry.viewport.width / 2)).toBeLessThan(1)
  expect(Math.abs(geometry.viewport.height - geometry.rect.bottom - 26)).toBeLessThan(1)
  expect(geometry.inert).toBe(false)
  expect(geometry.overflow).toBe(false)
  expect(geometry.inputHit).toBe(true)
  expect(geometry.style.position).toBe('fixed')
  expect(geometry.style.bottom).toBe('26px')
  expect(geometry.style.padding).toBe('11px 20px')
  expect(geometry.style.borderRadius).toBe('10px')
  expect(geometry.style.fontSize).toBe('13px')
  expect(geometry.style.fontFamily).toBe('-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif')
  expect(geometry.style.fontWeight).toBe('500')
  expect(geometry.style.lineHeight).toBe('20.8px')
  expect(geometry.style.wordBreak).toBe(language === 'ja' || language.startsWith('zh') ? 'normal' : 'keep-all')
  expect(geometry.style.smoothing).toBe('antialiased')
  expect(geometry.style.backgroundColor).toMatch(/^oklch\((?:0\.22|22%) 0\.012 262\)$/)
  expect(geometry.style.color).toMatch(/^oklch\((?:0\.996|99\.6%) 0\.001 95\)$/)
  expect(geometry.style.boxShadow).toMatch(/0px 8px 28px 0px/)
  expect(geometry.style.boxShadow).toMatch(/(?:0\.09|9%)/)
  expect(geometry.style.transitionDuration).toBe('0.3s')
  expect(geometry.style.transitionTimingFunction).toBe('cubic-bezier(0.16, 1, 0.3, 1)')
  const codeInput = page.getByRole('textbox', { name: copy.I18N['code.ph'][language], exact: true })
  await expect(codeInput).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: copy.I18N['auth.continue'][language], exact: true })).toBeFocused()
  expect(await page.locator('.ca-code-toast').evaluate(element => element.contains(document.activeElement))).toBe(false)
}

test.beforeEach(async ({ context, baseURL }) => {
  const attempts: string[] = []
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (request.method() !== 'GET' || url.origin !== new URL(baseURL!).origin || /^\/api(?:\/|$)/.test(url.pathname)) {
      attempts.push(request.method() + ' blocked')
      await route.abort('blockedbyclient')
    } else await route.continue()
  })
  test.info().annotations.push({ type: 'scope', description: '기존 미리보기 fixture, 외부/API/nonGET 차단, 실제 SMTP 전송 아님' })
  await test.info().attach('guard-scope', { body: Buffer.from('External/API/nonGET blocked; no provider actions'), contentType: 'text/plain' })
  // 각 시험 종료 시 실제 차단 시도도 실패로 보존한다.
  guardAttempts.set(context, attempts)
})
const guardAttempts = new WeakMap<object, string[]>()
test.afterEach(async ({ context, page }) => {
  expect(guardAttempts.get(context)).toEqual([])
  if (!page.isClosed() && page.url() !== 'about:blank') {
    const language = preference.get(context)
    const stored = await page.evaluate(() => ({ local: Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])), session: sessionStorage.length }))
    expect(stored).toEqual({ local: language ? { tethLang: language } : {}, session: 0 })
  }
})

test('KO sendCode는 원문 status 토스트를 표시한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLogin(page)
  await page.getByRole('textbox', { name: '이메일 주소', exact: true }).fill('notice@example.test')
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await expect(page.getByRole('heading', { name: '받은 편지함을 확인하십시오', exact: true })).toBeVisible()
  const toast = page.locator('.ca-code-toast')
  await expect(toast).toHaveCount(1)
  await expect(toast).toHaveAttribute('role', 'status')
  await expect(toast).toHaveAttribute('aria-live', 'polite')
  await expect(toast).toHaveClass(/\bshow\b/)
  await expect(toast).toHaveText(original.ko[0])
})

test('원본 7언어 sent와 resent literal은 현재 사전과 정확히 같다', () => {
  for (const language of Object.keys(original) as Language[]) {
    expect(copy.I18N['code.sent'][language]).toBe(original[language][0])
    expect(copy.I18N['code.resent'][language]).toBe(original[language][1])
  }
})

for (const language of Object.keys(original) as Language[]) for (const viewport of widths) {
  test(`${language} ${viewport.width}×${viewport.height} 원문 토스트 geometry와 2200ms 수명 및 30초 재전송`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await seedLanguage(page, language)
    await openLogin(page)
    await sendPreviewCode(page, language)
    await expectShown(page, original[language][0])
    await page.clock.runFor(300)
    await inspectGeometry(page, language)
    await test.info().attach('shown-toast', { body: await page.screenshot(), contentType: 'image/png' })
    await page.clock.runFor(1899)
    await expect(page.locator('.ca-code-toast')).toHaveClass(/\bshow\b/)
    await page.clock.runFor(1)
    await expect(page.locator('.ca-code-toast')).not.toHaveClass(/\bshow\b/)
    await expect(page.locator('.ca-code-toast')).toHaveText(original[language][0])
    await page.clock.runFor(240)
    await expect(page.locator('.ca-code-toast')).toHaveText(original[language][0])
    await page.clock.runFor(27559)
    const resend = page.locator('.ca-auth .au-textbtn')
    await expect(resend).toBeDisabled()
    await page.clock.runFor(1)
    await expect(resend).toBeEnabled()
    await expect(resend).toHaveText(copy.I18N['code.resend'][language])
    await resend.click()
    await expectShown(page, original[language][1])
    await expect(resend).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.ca-code-toast')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'login', exact: true })).toBeFocused()
    await page.clock.runFor(30000)
    await page.getByRole('button', { name: 'login', exact: true }).click()
    await expect(page.locator('.ca-code-toast')).toHaveCount(1)
    await expect(page.locator('.ca-code-toast')).toHaveText('')
    await expect(page.locator('.ca-code-toast')).not.toHaveClass(/\bshow\b/)
  })
}

test('표시 중 같은 코드 문구를 다시 요청해도 2200ms 수명이 늘어나지 않는다', async ({ page }) => {
  await openLogin(page)
  await sendPreviewCode(page, 'ko')
  await expectShown(page, original.ko[0])
  await page.clock.runFor(1000)
  await page.getByRole('button', { name: copy.I18N['code.pwbtn'].ko, exact: true }).click()
  await page.getByRole('button', { name: copy.I18N['pw.codebtn'].ko, exact: true }).click()
  await page.clock.runFor(1199)
  await expect(page.locator('.ca-code-toast')).toHaveClass(/\bshow\b/)
  await page.clock.runFor(1)
  await expect(page.locator('.ca-code-toast')).not.toHaveClass(/\bshow\b/)
  await page.clock.runFor(240)
  await expect(page.locator('.ca-code-toast')).not.toHaveClass(/\bshow\b/)
  await expect(page.locator('.ca-code-toast')).toHaveText(original.ko[0])
})

test('재전송 뒤 비밀번호에서 코드로 돌아오면 다른 원문은 240ms 뒤 순서대로 표시된다', async ({ page }) => {
  await openLogin(page)
  await sendPreviewCode(page, 'ko')
  await page.clock.runFor(30000)
  await page.locator('.ca-auth .au-textbtn').click()
  await expectShown(page, original.ko[1])
  await page.getByRole('button', { name: copy.I18N['code.pwbtn'].ko, exact: true }).click()
  await page.getByRole('button', { name: copy.I18N['pw.codebtn'].ko, exact: true }).click()
  await expectShown(page, original.ko[1])
  await page.clock.runFor(2200)
  await expect(page.locator('.ca-code-toast')).not.toHaveClass(/\bshow\b/)
  await expect(page.locator('.ca-code-toast')).toHaveText(original.ko[1])
  await page.clock.runFor(239)
  await expect(page.locator('.ca-code-toast')).not.toHaveClass(/\bshow\b/)
  await page.clock.runFor(1)
  await expectShown(page, original.ko[0])
  await page.clock.runFor(2200)
  await expect(page.locator('.ca-code-toast')).not.toHaveClass(/\bshow\b/)
})

test('전송하지 않고 닫기와 Escape로 재진입해도 빈 live DOM만 남는다', async ({ page }) => {
  await openLogin(page)
  await expect(page.locator('.ca-code-toast')).toHaveCount(1)
  await expect(page.locator('.ca-code-toast')).toHaveText('')
  await page.getByRole('button', { name: copy.I18N['common.close'].ko, exact: true }).click()
  await expect(page.locator('.ca-code-toast')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'login', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'login', exact: true }).click()
  await expect(page.locator('.ca-code-toast')).toHaveText('')
  await page.keyboard.press('Escape')
  await page.clock.runFor(30000)
  await page.getByRole('button', { name: 'login', exact: true }).click()
  await expect(page.locator('.ca-code-toast')).not.toHaveClass(/\bshow\b/)
  await expect(page.locator('.ca-code-toast')).toHaveText('')
})

test('대기 중인 queue는 unmount 뒤 재진입한 안내를 덮어쓰지 않는다', async ({ page }) => {
  await openLogin(page)
  await sendPreviewCode(page, 'ko')
  await page.clock.runFor(30000)
  await page.locator('.ca-auth .au-textbtn').click()
  await page.getByRole('button', { name: copy.I18N['code.pwbtn'].ko, exact: true }).click()
  await page.getByRole('button', { name: copy.I18N['pw.codebtn'].ko, exact: true }).click()
  await page.clock.runFor(2200)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'login', exact: true }).click()
  await page.clock.runFor(240)
  await expect(page.locator('.ca-code-toast')).toHaveText('')
  await expect(page.locator('.ca-code-toast')).not.toHaveClass(/\bshow\b/)
  await sendPreviewCode(page, 'ko')
  await expectShown(page, original.ko[0])
})
