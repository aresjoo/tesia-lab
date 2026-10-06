import { expect, test, type Page } from '@playwright/test'
import { nativeAuthUiCopy, nativeAuthUiText } from '../../src/internal-poc/native-auth-ui-copy'

// Real view/controller/SDK; synthetic same-origin responses, not authentication proof.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })
const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const owner = 'session_locale_fixture_000001', etag = '"etag_locale_fixture_0000001"'
const expiresAt = '2030-01-01T00:05:00Z', resendAt = '2030-01-01T00:00:30Z'
const language = (page: Page, value: string) => page.evaluate(async value => {
  const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', value)
}, value)

async function mount(page: Page, kind: 'form' | 'provider' | 'email') {
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:15Z'))
  await page.route('**/auth-locale-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><button id="outside">Outside</button><div id="fixture"></div></body></html>' }))
  await page.goto('/auth-locale-fixture.html')
  await page.evaluate(async ({ kind, owner }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const style = '/src/internal-poc/internal-poc.css'
    await import(/* @vite-ignore */ style)
    const path = `/src/internal-poc/${kind === 'form' ? 'NativeEmailLoginForm' : kind === 'email' ? 'NativeEmailLoginPanel' : 'NativeLoginPanel'}.tsx`
    const source = await (await fetch(path)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React')
    const rm = await import(/* @vite-ignore */ reactPath), react = rm.default ?? rm, h = react.createElement
    const domPath = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ domPath), component = await import(/* @vite-ignore */ path)
    const Component = component.NativeEmailLoginForm ?? component.NativeEmailLoginPanel ?? component.NativeLoginPanel
    const counts: Record<string, number> = {}, count = (key: string) => { counts[key] = (counts[key] ?? 0) + 1 }
    function Host() {
      const [props, update] = react.useState({ hidden: false, resumeToken: 0, canDispatch: true, phase: 'email', email: '', code: '', busy: false, canRequest: true, canVerify: true, canResend: false, canRecover: true, canEditEmail: true })
      Object.assign(window, { authLocale: { counts, update: (patch: object) => update((previous: object) => ({ ...previous, ...patch })) } })
      return h(Component, { ...props, expectedSessionId: owner, isCurrent: () => true,
        onAuthenticated: () => count('authenticated'), onEmailAuthenticated: () => count('emailAuthenticated'), onSessionRecovered: () => count('recovered'), onClose: () => count('close'),
        onEmailChange: (email: string) => update((p: object) => ({ ...p, email })), onCodeChange: (code: string) => update((p: object) => ({ ...p, code })),
        ...Object.fromEntries(['Request', 'Verify', 'Resend', 'Recover', 'EditEmail'].map(key => [`on${key}`, () => count(key)])),
      })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  }, { kind, owner })
  await expect(page.locator('#fixture h2')).toBeVisible()
}
const update = (page: Page, patch: object) => page.evaluate(patch => Reflect.get(window, 'authLocale').update(patch), patch)

async function routes(page: Page) {
  const state = { calls: [] as string[], delivery: 'ACCEPTED', error: '', resultError: '', hold: undefined as (() => Promise<void>) | undefined }
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    state.calls.push(`${req.method()} ${path}`)
    const version = path.includes('/v9/') ? '0.9.0' : path.includes('/v2/') ? '0.2.0' : '0.1.0'
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: etag }
    const meta = { apiContractVersion: version, resourceRevision: '7' as string | null, requestId: 'req_locale_fixture_000001', traceId: 'trace_locale_fixture_000001' }
    let data: unknown, status = 200
    if (path.endsWith('/session')) data = { sessionId: owner, state: 'ANONYMOUS', revision: '7', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
    else if (path.endsWith('/csrf')) { data = { csrfToken: 'csrf_locale_fixture_000001', expiresAt: '2030-01-01T12:00:00Z' }; meta.resourceRevision = null; delete headers.ETag }
    else {
      if (state.hold) await state.hold()
      const error = path.endsWith('/results/current') ? state.resultError : state.error
      if (error) {
        const status = error === 'CODE_INVALID' ? 400 : error === 'MAIL_DISABLED' ? 503 : error === 'RATE_LIMITED' ? 429 : error === 'CHALLENGE_EXPIRED' ? 410 : 409
        if (version === '0.9.0') meta.resourceRevision = null
        return route.fulfill({ status, headers, body: JSON.stringify({ meta, error: { code: error, message: 'Authentication request failed.' } }) })
      }
      if (path.endsWith('/transactions')) { status = 201; data = { transactionId: 'oidc_tx_locale_fixture_000001', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:10:00Z', authorizationRedirect: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&response_type=code&state=opaque' } }
      else if (path.endsWith('/challenges')) { status = 201; data = { challengeId: 'email_challenge_locale_fixture_0001', initiatingSessionId: owner, initiatingSessionRevision: '7', initiatingSessionEtag: etag, issuedAt: '2030-01-01T00:00:00Z', expiresAt, resendAllowedAt: resendAt, deliveryStatus: state.delivery } }
      else return route.abort()
    }
    return route.fulfill({ status, headers, body: JSON.stringify({ meta, data }) })
  })
  return state
}

test('7언어 사전은 모든 키·동일 매개변수·원문 값을 보존한다', () => {
  for (const [key, translations] of Object.entries(nativeAuthUiCopy)) {
    expect(translations).toHaveLength(7)
    for (const text of translations) {
      expect(text.trim(), key).not.toBe('')
      expect(text.match(/\{\w+\}/g) ?? [], key).toEqual(translations[0].match(/\{\w+\}/g) ?? [])
    }
  }
  for (const code of languages) {
    const raw = '2030-01-01T00:00:00.000001Z $& {timestamp}'
    expect(nativeAuthUiText(code, 'emailExpiresAt', { timestamp: raw })).toContain(raw)
    expect(nativeAuthUiText(code, 'openProvider', { provider: 'Google' })).toContain('Google')
    expect(nativeAuthUiText(code, 'emailExpiresAt', Object.create({ timestamp: 'inherited' }))).toContain('{timestamp}')
  }
})

test('7언어 표시 변경은 같은 input DOM·초안·포커스·서버원문·호출횟수를 보존한다', async ({ page }) => {
  await mount(page, 'form')
  await page.locator('input').fill('Locale+Case@example.invalid')
  await page.evaluate(() => Reflect.set(window, 'originalAuthInput', document.querySelector('input')))
  for (const code of languages) {
    await language(page, code)
    await expect(page.getByRole('form')).toHaveAttribute('aria-label', nativeAuthUiText(code, 'emailForm'))
    await expect(page.locator('h2')).toHaveText(nativeAuthUiText(code, 'emailLogin'))
    await expect(page.locator('input')).toHaveValue('Locale+Case@example.invalid')
    await expect(page.locator('input')).toBeFocused()
    expect(await page.evaluate(() => Reflect.get(window, 'originalAuthInput') === document.querySelector('input'))).toBe(true)
  }
  await update(page, { phase: 'code', code: '000123', error: 'CODE_INVALID: raw server text', expiryText: expiresAt, resendText: resendAt })
  for (const code of languages) {
    await language(page, code)
    await expect(page.locator('h2')).toHaveText(nativeAuthUiText(code, 'codeTitle'))
    await expect(page.locator('input')).toHaveValue('000123')
    await expect(page.getByRole('alert')).toHaveText('CODE_INVALID: raw server text')
    await expect(page.getByText(expiresAt, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: resendAt })).toBeDisabled()
  }
  expect(await page.evaluate(() => Reflect.get(window, 'authLocale').counts)).toEqual({})
})

test('번역된 오류만 바뀌면 focus를 이동하지 않고 새 오류 identity에는 기존 autofocus를 적용한다', async ({ page }) => {
  await mount(page, 'form')
  await update(page, { error: '원문 오류', errorIdentity: 'CODE_INVALID' })
  await page.locator('#outside').focus()
  await expect(page.locator('#outside')).toBeFocused()
  await update(page, { error: 'Translated error', errorIdentity: 'CODE_INVALID' })
  await expect(page.locator('#outside')).toBeFocused()
  await update(page, { error: 'New error', errorIdentity: 'CHALLENGE_EXPIRED' })
  await expect(page.locator('input')).toBeFocused()
})

test('provider held 응답·실패·복구 표시는 현재 언어이며 재요청과 성공을 합성하지 않는다', async ({ page }) => {
  const state = await routes(page)
  await mount(page, 'provider')
  let release = () => {}
  state.hold = () => new Promise<void>(resolve => { release = resolve })
  await page.getByRole('button', { name: 'Google로 계속하기', exact: true }).click()
  await expect.poll(() => state.calls.filter(call => call.endsWith('/transactions')).length).toBe(1)
  await language(page, 'en')
  await expect(page.getByRole('status')).toHaveText(nativeAuthUiText('en', 'providerBusy'))
  state.hold = undefined; release()
  await expect(page.getByRole('status')).toHaveText(nativeAuthUiText('en', 'startLink'))
  for (const code of languages) {
    await language(page, code)
    await expect(page.getByRole('link')).toHaveText(nativeAuthUiText(code, 'openProvider', { provider: 'Google' }))
    await expect(page.locator('[data-native-auth-close]')).toHaveText(nativeAuthUiText(code, 'close'))
  }
  state.resultError = 'AUTH_RESULT_NOT_READY'
  await page.getByRole('button', { name: nativeAuthUiText('fr', 'resultAfterReturn'), exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(nativeAuthUiText('fr', 'providerNotReady'))
  await language(page, 'ja')
  await expect(page.getByRole('alert')).toHaveText(nativeAuthUiText('ja', 'providerNotReady'))
  const calls = [...state.calls]
  await update(page, { resumeToken: 1 })
  await language(page, 'en')
  await expect(page.locator('h2')).toHaveText(nativeAuthUiText('en', 'resumeTitle'))
  expect(state.calls).toEqual(calls)
  expect(await page.evaluate(() => Reflect.get(window, 'authLocale').counts)).toEqual({})
})

for (const delivery of ['ACCEPTED', 'UNKNOWN', 'FAILED']) test(`email ${delivery} held 응답은 현언어·서버시각·코드초안을 유지한다`, async ({ page }) => {
  const state = await routes(page); state.delivery = delivery
  await mount(page, 'email')
  await page.locator('input').fill('Test+Locale@example.invalid')
  let release = () => {}
  state.hold = () => new Promise<void>(resolve => { release = resolve })
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await expect.poll(() => state.calls.filter(call => call.endsWith('/challenges')).length).toBe(1)
  await language(page, 'en')
  await expect(page.locator('input')).toHaveValue('Test+Locale@example.invalid')
  state.hold = undefined; release()
  const message = delivery === 'ACCEPTED' ? 'emailAccepted' : delivery === 'UNKNOWN' ? 'emailUnknown' : 'emailDeliveryFailed'
  await expect(page.getByRole('status')).toHaveText(nativeAuthUiText('en', message))
  await page.locator('input').fill('000123')
  for (const code of languages) {
    await language(page, code)
    await expect(page.getByRole('status')).toHaveText(nativeAuthUiText(code, message))
    await expect(page.locator('input')).toHaveValue('000123')
    await expect(page.getByText(nativeAuthUiText(code, 'emailExpiresAt', { timestamp: expiresAt }), { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: nativeAuthUiText(code, 'emailResendAt', { timestamp: resendAt }) })).toBeDisabled()
  }
  state.error = 'CODE_INVALID'
  state.hold = () => new Promise<void>(resolve => { release = resolve })
  await page.getByRole('button', { name: nativeAuthUiText('fr', 'verifyCode'), exact: true }).click()
  await expect.poll(() => state.calls.filter(call => call.endsWith('/verifications')).length).toBe(1)
  await language(page, 'ja')
  await expect(page.locator('input')).toHaveValue('000123')
  state.hold = undefined; release()
  await expect(page.getByRole('alert')).toHaveText(nativeAuthUiText('ja', 'emailCodeInvalid'))
  await page.locator('#outside').focus()
  await language(page, 'en')
  await expect(page.getByRole('alert')).toHaveText(nativeAuthUiText('en', 'emailCodeInvalid'))
  await expect(page.locator('#outside')).toBeFocused()
  await expect(page.locator('input')).toHaveValue('000123')
  expect(state.calls.filter(call => call.startsWith('POST'))).toHaveLength(2)
  expect(await page.evaluate(() => Reflect.get(window, 'authLocale').counts)).toEqual({})
})

for (const [error, key] of [['MAIL_DISABLED', 'emailDisabled'], ['RATE_LIMITED', 'emailRateLimited']] as const) test(`${error} 확정 오류 언어 변경은 입력·guard·닫기 속성을 보존한다`, async ({ page }) => {
  const state = await routes(page); state.error = error
  await mount(page, 'email')
  await page.locator('input').fill('retained@example.invalid')
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(nativeAuthUiText('ko', key))
  for (const code of languages) {
    await language(page, code)
    await expect(page.getByRole('alert')).toHaveText(nativeAuthUiText(code, key))
    await expect(page.locator('input')).toHaveValue('retained@example.invalid')
    await expect(page.locator('[data-native-auth-close]')).toHaveText(nativeAuthUiText(code, 'close'))
  }
  expect(state.calls.filter(call => call.startsWith('POST'))).toHaveLength(1)
})

test('복구·확인 단계도 7언어로 바뀌며 표시 props에서 요청·성공을 생성하지 않는다', async ({ page }) => {
  await mount(page, 'form')
  for (const [phase, key] of [['recovery', 'emailRecoveryTitle'], ['confirmed', 'emailConfirmedTitle']] as const) {
    await update(page, { phase, canRecover: false, statusText: 'server_reference_000001' })
    for (const code of languages) {
      await language(page, code)
      await expect(page.locator('h2')).toHaveText(nativeAuthUiText(code, key))
      await expect(page.getByRole('status')).toHaveText('server_reference_000001')
      await expect(page.locator('input')).toHaveCount(0)
      if (phase === 'recovery') await expect(page.getByRole('button', { name: nativeAuthUiText(code, 'sameRequest'), exact: true })).toBeDisabled()
      else await expect(page.locator('form button')).toHaveCount(0)
    }
  }
  expect(await page.evaluate(() => Reflect.get(window, 'authLocale').counts)).toEqual({})
})

test('320px 7언어 폼은 기존 구조를 유지하고 locale 변경으로 guard를 풀지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const state = await routes(page)
  await mount(page, 'email')
  await page.locator('input').fill('retained@example.invalid')
  await update(page, { canDispatch: false })
  for (const code of languages) {
    await language(page, code)
    await expect(page.locator('input')).toBeDisabled()
    await expect(page.locator('input')).toHaveValue('retained@example.invalid')
    await expect(page.getByRole('button', { name: nativeAuthUiText(code, 'requestCode'), exact: true })).toBeDisabled()
    await expect(page.getByText(nativeAuthUiText(code, 'emailDispatchBlocked'), { exact: true })).toBeVisible()
    await page.locator('form').dispatchEvent('submit')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
  }
  expect(state.calls).toEqual([])
  expect(await page.evaluate(() => Reflect.get(window, 'authLocale').counts)).toEqual({})
})
