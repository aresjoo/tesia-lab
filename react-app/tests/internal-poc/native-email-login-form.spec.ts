import { expect, test, type Page } from '@playwright/test'
import { join } from 'node:path'

// Isolated controlled view, not an email service/SDK fixture or auth proof.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })
type HarnessWindow = Window & { emailForm: { update: (patch: Record<string, unknown>) => void; counts: Record<string, number>; unmount: () => void } }

async function mount(page: Page, initial: Record<string, unknown> = {}) {
  const requests: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.method()) })
  await page.route('**/email-form-view.html', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><button id="outside">바깥 버튼</button><div id="view"></div></body></html>' }))
  await page.goto('/email-form-view.html')
  await page.evaluate(async initial => {
    const refreshPath = '/@react-refresh', reactPath = '/@id/react', domPath = '/@id/react-dom/client', componentPath = '/src/internal-poc/NativeEmailLoginForm.tsx', stylePath = '/src/internal-poc/internal-poc.css', fontPath = '/node_modules/@fontsource-variable/noto-sans-kr/index.css'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    await import(/* @vite-ignore */ stylePath)
    await import(/* @vite-ignore */ fontPath)
    const react = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath), { NativeEmailLoginForm } = await import(/* @vite-ignore */ componentPath)
    const createElement = react.createElement ?? react.default.createElement
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('view'))
    const counts: Record<string, number> = {}
    let props: Record<string, unknown> = { phase: 'email', email: '', code: '', busy: false, statusText: '이메일 인증번호로 로그인합니다.', canRequest: true, canVerify: false, canResend: false, canRecover: false, canEditEmail: false, ...initial }
    const render = () => root.render(createElement(react.StrictMode ?? react.default.StrictMode, null, createElement(NativeEmailLoginForm, {
      ...props,
      onEmailChange: (value: string) => { counts.email = (counts.email ?? 0) + 1; props = { ...props, email: value }; render() },
      onCodeChange: (value: string) => { counts.code = (counts.code ?? 0) + 1; props = { ...props, code: value }; render() },
      ...Object.fromEntries(['Request', 'Verify', 'Resend', 'Recover', 'EditEmail', 'Complete'].map(action => [`on${action}`, () => { counts[action] = (counts[action] ?? 0) + 1 }])),
    })))
    ;(window as HarnessWindow).emailForm = { update: patch => { props = { ...props, ...patch }; render() }, counts, unmount: () => root.unmount() }
    render()
  }, initial)
  await expect(page.getByRole('form', { name: '이메일 로그인' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return requests
}
const update = (page: Page, patch: Record<string, unknown>) => page.evaluate(patch => (window as HarnessWindow).emailForm.update(patch), patch)
const counts = (page: Page) => page.evaluate(() => (window as HarnessWindow).emailForm.counts)

test('표시 전용 이메일 입력은 명시 요청만 전달하고 인증하거나 저장하지 않는다', async ({ page }, testInfo) => {
  const requests = await mount(page)
  const input = page.getByRole('textbox', { name: '이메일 주소', exact: true })
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('autocomplete', 'email')
  if (process.env.TETH_EMAIL_FORM_PROOF_ROOT) await page.screenshot({ path: join(process.env.TETH_EMAIL_FORM_PROOF_ROOT, `email-${testInfo.project.name}.png`), fullPage: true })
  await input.fill('Sample+tag@example.invalid')
  await expect(input).toHaveValue('Sample+tag@example.invalid')
  expect((await counts(page)).Request ?? 0).toBe(0)
  await page.getByRole('button', { name: '인증번호 요청', exact: true }).click()
  expect((await counts(page)).Request).toBe(1)
  expect((await counts(page)).Complete ?? 0).toBe(0)
  expect(requests).toEqual([])
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  await expect(page.locator('input[type="password"],input[autocomplete="bday"]')).toHaveCount(0)
  await expect(page.getByText('메일 발송 완료', { exact: false })).toHaveCount(0)
})

test('허용되지 않은 요청은 클릭과 form submit 모두 전달하지 않는다', async ({ page }) => {
  await mount(page, { canRequest: false })
  await expect(page.getByRole('button', { name: '인증번호 요청', exact: true })).toBeDisabled()
  await page.getByRole('form').dispatchEvent('submit')
  expect((await counts(page)).Request ?? 0).toBe(0)
})

test('6자리 입력은 ASCII 숫자와 선행0을 보존하며 자동 검증·성공은 없다', async ({ page }) => {
  await mount(page, { phase: 'code', canVerify: true, email: 'code@example.invalid' })
  const code = page.getByRole('textbox', { name: '6자리 인증번호', exact: true })
  await expect(code).toBeFocused()
  await expect(code).toHaveAttribute('inputmode', 'numeric')
  await expect(code).toHaveAttribute('autocomplete', 'one-time-code')
  await code.fill('000123')
  await expect(code).toHaveValue('000123')
  expect((await counts(page)).Verify ?? 0).toBe(0)
  await page.getByRole('button', { name: '인증번호 확인', exact: true }).click()
  expect((await counts(page)).Verify).toBe(1)
  expect((await counts(page)).Complete ?? 0).toBe(0)
  await expect(page.getByRole('heading', { name: '인증번호 입력', exact: true })).toBeVisible()
  await code.fill('a０1b2')
  await expect(code).toHaveValue('12')
})

test('만료·재요청 표시는 부모 원문이고 시간 경과만으로 액션을 열거나 전송하지 않는다', async ({ page }) => {
  await page.clock.install()
  await mount(page, { phase: 'code', expiryText: '서버 안내: 300초 후 만료', resendText: '서버 안내: 30초 후 다시 요청', canVerify: false, canResend: false })
  await page.clock.runFor(301_000)
  await expect(page.getByText('서버 안내: 300초 후 만료', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '서버 안내: 30초 후 다시 요청', exact: true })).toBeDisabled()
  expect(await counts(page)).toEqual({})
  await update(page, { expiryText: '인증번호가 만료되었습니다.', resendText: '인증번호 다시 요청', canResend: true })
  await page.getByRole('button', { name: '인증번호 다시 요청', exact: true }).click()
  expect((await counts(page)).Resend).toBe(1)
  expect((await counts(page)).Request ?? 0).toBe(0)
})

for (const phase of ['email', 'code', 'recovery'] as const) test(`${phase} 처리 중 입력·전송·복구·편집이 모두 잠긴다`, async ({ page }) => {
  await mount(page, { phase, busy: true, code: '123456', canRequest: true, canVerify: true, canResend: true, canRecover: true, canEditEmail: true, statusText: '서버 응답을 확인하고 있습니다.' })
  await expect(page.getByRole('form')).toHaveAttribute('aria-busy', 'true')
  for (const input of await page.locator('input').all()) await expect(input).toBeDisabled()
  for (const button of await page.getByRole('button').all()) {
    if (await button.getAttribute('id') !== 'outside') await expect(button).toBeDisabled()
  }
  await page.getByRole('form').dispatchEvent('submit')
  expect(await counts(page)).toEqual({})
  await expect(page.getByRole('status')).toContainText('서버 응답을 확인하고 있습니다.')
})

test('응답 불명 복구는 원값을 노출하지 않고 명시 recovery 액션만 전달한다', async ({ page }) => {
  await mount(page, { phase: 'recovery', email: 'hidden@example.invalid', code: '123456', canRequest: true, canVerify: true, canResend: true, canRecover: true, canEditEmail: false, error: '요청 결과를 확인할 수 없습니다.', statusText: '같은 요청을 확인해 주세요.' })
  await expect(page.locator('input')).toHaveCount(0)
  await expect(page.getByText('hidden@example.invalid')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '인증번호 다시 요청', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '같은 로그인 요청 확인', exact: true }).click()
  expect(await counts(page)).toEqual({ Recover: 1 })
})

test('확인 화면은 부모 상태만 표시하며 권위 callback이나 새 요청은 없다', async ({ page }) => {
  await mount(page, { phase: 'confirmed', email: 'hidden@example.invalid', code: '123456', canRequest: true, canVerify: true, canResend: true, canRecover: true, canEditEmail: true, statusText: '서버 세션 확인 결과를 표시합니다.' })
  await expect(page.locator('input')).toHaveCount(0)
  await expect(page.getByRole('form').getByRole('button')).toHaveCount(0)
  await page.getByRole('form').dispatchEvent('submit')
  expect(await counts(page)).toEqual({})
  await expect(page.getByRole('status')).toHaveText('서버 세션 확인 결과를 표시합니다.')
})

test('오류는 입력을 보존하고 연결된 alert·focus로 표시하며 HTML로 실행하지 않는다', async ({ page }) => {
  await mount(page, { phase: 'code', code: '123456', canVerify: true })
  await page.getByRole('button', { name: '인증번호 확인', exact: true }).focus()
  await update(page, { error: '<img src=x onerror=alert(1)> 인증번호를 확인해 주세요.' })
  const input = page.getByRole('textbox', { name: '6자리 인증번호', exact: true })
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('123456')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert')).toContainText('<img src=x onerror=alert(1)>')
  expect(await input.getAttribute('aria-describedby')).toContain(await page.getByRole('alert').getAttribute('id'))
  await expect(page.getByRole('form').locator('img')).toHaveCount(0)
})

test('단계 변경은 입력으로 focus를 옮기지만 hidden 부모에서는 focus를 빼앗지 않는다', async ({ page }) => {
  await mount(page)
  await update(page, { phase: 'code' })
  await expect(page.getByRole('textbox', { name: '6자리 인증번호', exact: true })).toBeFocused()
  await page.locator('#view').evaluate(element => { element.hidden = true })
  await page.locator('#outside').focus()
  await update(page, { phase: 'email', error: '다시 확인해 주세요.' })
  await expect(page.locator('#outside')).toBeFocused()
})

test('IME 조합 Enter는 submit을 발생시키지 않는다', async ({ page }) => {
  await mount(page)
  expect(await page.getByRole('textbox').evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })))).toBe(false)
  expect((await counts(page)).Request ?? 0).toBe(0)
  await page.getByRole('textbox').press('Enter')
  expect((await counts(page)).Request).toBe(1)
})

test('이메일 편집·재전송은 다른 동작으로 전달하고 props 갱신 전에는 단계가 바뀌지 않는다', async ({ page }) => {
  await mount(page, { phase: 'code', email: 'edit@example.invalid', canEditEmail: true, canResend: true })
  await page.getByRole('button', { name: '이메일 주소 수정', exact: true }).click()
  await expect(page.getByRole('heading', { name: '인증번호 입력', exact: true })).toBeVisible()
  expect(await counts(page)).toEqual({ EditEmail: 1 })
  await update(page, { phase: 'email', email: 'changed@example.invalid', code: '' })
  await expect(page.getByRole('textbox', { name: '이메일 주소', exact: true })).toHaveValue('changed@example.invalid')
})

test('320px에서도 기존 폼 스타일과 긴 서버 안내를 읽을 수 있다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await mount(page, { phase: 'code', canVerify: true, canResend: true, email: `${'a'.repeat(64)}@example.invalid`, error: '인증번호를 확인할 수 없습니다. 현재 요청의 결과를 확인한 뒤 다시 시도해 주세요.', expiryText: '인증번호 유효 기간은 서버 응답에 따라 표시됩니다.' })
  const form = page.getByRole('form')
  expect(await form.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByRole('textbox')).toHaveCSS('font-size', '16px')
  await expect(page.getByRole('button', { name: '인증번호 확인', exact: true })).toHaveCSS('min-height', '52px')
  if (process.env.TETH_EMAIL_FORM_PROOF_ROOT) await page.screenshot({ path: join(process.env.TETH_EMAIL_FORM_PROOF_ROOT, `code-320-${testInfo.project.name}.png`), fullPage: true })
})
