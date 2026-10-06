import { expect, test, type Page } from '@playwright/test'

// Independent literal oracle: aresjoo/tesia-lab fixed 9fb index.html:26433,
// 26434 and 26441, applied by authI18n/applyLang/authResendLabel.
// Controlled Native view only: not email delivery or authentication proof.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })
const original = [
  ['ko', '이메일 주소', '계속', '이메일 다시 보내기'],
  ['en', 'Email address', 'Continue', 'Resend email'],
  ['ja', 'メールアドレス', '続行', 'メールを再送信'],
  ['zh-CN', '电子邮件地址', '继续', '重新发送邮件'],
  ['zh-TW', '電子郵件地址', '繼續', '重新發送郵件'],
  ['es', 'Correo electrónico', 'Continuar', 'Reenviar correo'],
  ['fr', 'Adresse e-mail', 'Continuer', "Renvoyer l'e-mail"],
] as const

async function mount(page: Page, baseURL: string | undefined, phase: 'email' | 'code') {
  const api: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.pathname.startsWith('/api/')) { api.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (url.origin !== new URL(baseURL!).origin || !['GET', 'HEAD'].includes(request.method())) return route.abort('blockedbyclient')
    if (url.pathname === '/native-original-copy-fixture.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="fixture"></div></body></html>' })
    return route.continue()
  })
  await page.goto('/native-original-copy-fixture.html')
  await page.evaluate(async phase => {
    const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/internal-poc/NativeEmailLoginForm.tsx', style = '/src/internal-poc/internal-poc.css'
    await import(/* @vite-ignore */ style)
    const source = await (await fetch(path)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React')
    const rm = await import(/* @vite-ignore */ reactPath), react = rm.default ?? rm
    const domPath = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ domPath), component = await import(/* @vite-ignore */ path)
    const counts: Record<string, number> = {}, count = (key: string) => { counts[key] = (counts[key] ?? 0) + 1 }
    function Host() {
      const [email, setEmail] = react.useState('Original+Copy@example.invalid'), [code, setCode] = react.useState('000123')
      Reflect.set(window, 'originalCopyCounts', counts)
      return react.createElement(component.NativeEmailLoginForm, {
        phase, email, code, busy: false, canRequest: true, canVerify: true, canResend: true, canRecover: false, canEditEmail: false,
        onEmailChange: setEmail, onCodeChange: setCode,
        ...Object.fromEntries(['Request', 'Verify', 'Resend', 'Recover', 'EditEmail'].map(key => [`on${key}`, () => count(key)])),
      })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(react.createElement(Host))
  }, phase)
  await expect(page.locator('#fixture h2')).toBeVisible()
  return { api, errors }
}

async function language(page: Page, value: string) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    ;(await import(/* @vite-ignore */ path)).setClientPreference('language', value)
  }, value)
}
const counts = (page: Page) => page.evaluate(() => Reflect.get(window, 'originalCopyCounts'))

test('Native 원문 7언어 이메일 주소·요청 버튼은 입력과 명시 action을 보존한다', async ({ page, baseURL }) => {
  const audit = await mount(page, baseURL, 'email'), input = page.locator('input'), originalInput = await input.elementHandle()
  for (const [locale, address, proceed] of original) {
    await language(page, locale)
    await expect(input).toHaveAccessibleName(address)
    await expect(input).toHaveValue('Original+Copy@example.invalid')
    await expect(input).toBeFocused()
    expect(await input.evaluate((node, old) => node === old, originalInput)).toBe(true)
    await expect(page.getByRole('button', { name: proceed, exact: true })).toBeEnabled()
  }
  expect(await counts(page)).toEqual({})
  await page.getByRole('button', { name: original[6][2], exact: true }).click()
  expect(await counts(page)).toEqual({ Request: 1 })
  await expect(input).toHaveValue('Original+Copy@example.invalid')
  expect(audit.api).toEqual([]); expect(audit.errors).toEqual([])
})

test('Native 원문 7언어 코드 확인·재전송 버튼은 코드와 별도 action을 보존한다', async ({ page, baseURL }) => {
  const audit = await mount(page, baseURL, 'code'), input = page.locator('input'), originalInput = await input.elementHandle()
  for (const [locale, , proceed, resend] of original) {
    await language(page, locale)
    await expect(input).toHaveValue('000123')
    await expect(input).toBeFocused()
    expect(await input.evaluate((node, old) => node === old, originalInput)).toBe(true)
    await expect(page.getByRole('button', { name: proceed, exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: resend, exact: true })).toBeEnabled()
  }
  expect(await counts(page)).toEqual({})
  await page.getByRole('button', { name: original[6][2], exact: true }).click()
  expect(await counts(page)).toEqual({ Verify: 1 })
  await page.getByRole('button', { name: original[6][3], exact: true }).click()
  expect(await counts(page)).toEqual({ Verify: 1, Resend: 1 })
  await expect(input).toHaveValue('000123')
  expect(audit.api).toEqual([]); expect(audit.errors).toEqual([])
})
