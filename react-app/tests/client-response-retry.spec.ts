import { expect, test, type Page } from '@playwright/test'
import type { MarketResponseBinding } from '../src/client-market-response-presentation'
import { responseRetryText } from '../src/client-response-retry-copy'
import { followupText } from '../src/client-followup-copy'

// Supplied UI-port acceptance, not evidence of provider execution or orders.
const binding: MarketResponseBinding = { scopeId: 'retry-owner/session-a', messageId: 'retry-message', observationId: 'retry-observation' }
const question = '  원래 질문과 줄바꿈을\n그대로 다시 전달해주세요.  '
type Input = { binding: MarketResponseBinding; question: string; kind: 'stopped' | 'failed' }
const initial: Input = { binding, question, kind: 'stopped' }
const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const

async function mount(page: Page, value: Input = initial, mode = 'pending') {
  await page.route('**/response-retry-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"></body></html>' }))
  await page.goto('/response-retry-test.html')
  await page.evaluate(async ({ value, mode }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    for (const path of ['/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/src/client-reference.css', '/src/client-conversation.css', '/src/client-main-experience.css']) await import(/* @vite-ignore */ path)
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/components/ClientRetryResponse.tsx', pp = '/src/client-preferences.ts'
    const react = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp), { ClientRetryResponse } = await import(/* @vite-ignore */ cp), { setClientPreference } = await import(/* @vite-ignore */ pp)
    document.body.innerHTML = '<main class="client-source-app client-lab-conversation" style="max-width:780px;padding:16px;box-sizing:border-box;margin:auto;height:auto;display:block;font-family:Noto Sans KR Variable,sans-serif"><div id="response-retry-test"></div><textarea aria-label="대화 입력" style="box-sizing:border-box;max-width:100%">전송하지 않은 초안</textarea></main>'
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('response-retry-test')!), h = react.createElement ?? react.default.createElement
    const calls: unknown[] = [], signals: AbortSignal[] = [], resolvers: ((value: unknown) => void)[] = []
    let current = value, currentMode = mode, busy = false
    const render = () => root.render(h(react.StrictMode ?? react.default.StrictMode, null,
      h(react.Fragment ?? react.default.Fragment, null,
        h('p', { 'data-retry-question': true, style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, current.question),
        h(ClientRetryResponse, { ...current, busy,
          onRetry: currentMode === 'missing' ? undefined : async (request: unknown, signal: AbortSignal) => {
            calls.push(structuredClone(request)); signals.push(signal)
            if (currentMode === 'throw') throw new Error('TEST_PRIVATE_RETRY_ERROR')
            if (currentMode === 'pending') return new Promise(resolve => { resolvers.push(resolve) })
            if (currentMode === 'undefined') return undefined
            if (currentMode === 'truthy') return 'true'
            return currentMode === 'accept'
          },
        }),
      ),
    ))
    Object.assign(window, {
      responseRetryCalls: calls, responseRetrySignals: signals,
      responseRetryResolve: (index: number, accepted: unknown) => resolvers[index]?.(accepted),
      responseRetryRender: (next: typeof value) => { current = next; render() },
      responseRetryMode: (next: string) => { currentMode = next; render() },
      responseRetryBusy: (next: boolean) => { busy = next; render() },
      responseRetryRerender: render,
      responseRetryLanguage: (language: string) => setClientPreference('language', language),
      responseRetryUnmount: () => root.unmount(),
    })
    setClientPreference('language', 'ko'); render()
  }, { value, mode })
  await expect(page.locator('[data-retry-question]')).toBeAttached()
}
const surface = (page: Page) => page.locator('.client-response-retry')
const button = (page: Page) => surface(page).getByRole('button')
const notice = (page: Page) => surface(page).getByRole('status')
const calls = (page: Page) => page.evaluate(() => Reflect.get(window, 'responseRetryCalls'))
const aborted = (page: Page, index = 0) => page.evaluate(index => Reflect.get(window, 'responseRetrySignals')[index]?.aborted, index)

for (const kind of ['stopped', 'failed'] as const) test(`${kind}: 원본 표면과 원질문을 보존하며 명시 ACK 전에 중복 요청을 차단한다`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page, { ...initial, kind })
  await expect(surface(page)).toHaveClass(new RegExp(kind === 'stopped' ? 'g-nextcol' : 'g-errcard'))
  await expect(button(page)).toHaveAccessibleName(kind === 'stopped' ? '다시 생성' : '다시 시도')
  if (kind === 'failed') {
    await expect(surface(page).locator('b')).toHaveText(responseRetryText('ko', 'title'))
    await expect(surface(page).locator('.d')).toHaveText(responseRetryText('ko', 'detail'))
  }
  await page.getByLabel('대화 입력').evaluate(el => Reflect.set(window, 'retryOriginalComposer', el))
  await button(page).evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect(surface(page)).toHaveAttribute('aria-busy', 'true')
  await expect(button(page)).toBeDisabled()
  expect(await calls(page)).toEqual([{ binding, question }])
  await expect(notice(page)).toHaveText(followupText('ko', 'pending'))
  await page.screenshot({ path: info.outputPath(`retry-${kind}-pending.png`), fullPage: true })
  await page.evaluate(() => Reflect.get(window, 'responseRetryResolve')(0, true))
  await expect(surface(page)).toHaveCount(0)
  expect(await page.locator('[data-retry-question]').textContent()).toBe(question)
  await expect(page.getByLabel('대화 입력')).toHaveValue('전송하지 않은 초안')
  expect(await page.getByLabel('대화 입력').evaluate(el => el === Reflect.get(window, 'retryOriginalComposer'))).toBe(true)
  expect(errors).toEqual([])
})

for (const mode of ['reject', 'throw', 'undefined', 'truthy']) test(`${mode}: 명시 true가 아닌 결과는 실패 후 원질문 재시도를 허용한다`, async ({ page }) => {
  await mount(page, { ...initial, kind: 'failed' }, mode)
  await button(page).click()
  await expect(notice(page)).toHaveText(followupText('ko', 'failed'))
  await expect(button(page)).toBeEnabled()
  await expect(page.getByText('TEST_PRIVATE_RETRY_ERROR', { exact: false })).toHaveCount(0)
  expect(await calls(page)).toEqual([{ binding, question }])
  await page.evaluate(() => Reflect.get(window, 'responseRetryMode')('accept'))
  await button(page).click()
  await expect(surface(page)).toHaveCount(0)
  expect(await calls(page)).toEqual([{ binding, question }, { binding, question }])
  await expect(page.getByLabel('대화 입력')).toHaveValue('전송하지 않은 초안')
})

for (const kind of ['stopped', 'failed'] as const) test(`${kind}: 공급 포트가 없으면 안내와 비활성 버튼만 표시하고 호출하지 않는다`, async ({ page }) => {
  await mount(page, { ...initial, kind }, 'missing')
  await expect(button(page)).toBeDisabled()
  await expect(notice(page)).toHaveText(followupText('ko', 'unavailable'))
  await button(page).evaluate(el => (el as HTMLButtonElement).click())
  expect(await calls(page)).toEqual([])
  await page.evaluate(() => Reflect.get(window, 'responseRetryMode')('accept'))
  await button(page).click()
  await expect(surface(page)).toHaveCount(0)
  expect(await calls(page)).toEqual([{ binding, question }])
})

for (const boundary of ['owner', 'message', 'observation', 'question', 'kind'] as const) test(`${boundary} 교체는 이전 요청을 취소하고 늦은 ACK가 새 표면을 숨기지 않는다`, async ({ page }) => {
  await mount(page)
  await button(page).click()
  const next: Input = boundary === 'question' ? { ...initial, question: '교체된 원질문' }
    : boundary === 'kind' ? { ...initial, kind: 'failed' }
      : { ...initial, binding: { ...binding, ...(boundary === 'owner' ? { scopeId: 'owner-b/session-b' } : boundary === 'message' ? { messageId: 'new-message' } : { observationId: 'new-observation' }) } }
  await page.evaluate(next => Reflect.get(window, 'responseRetryRender')(next), next)
  await expect.poll(() => aborted(page)).toBe(true)
  await expect(button(page)).toBeEnabled()
  await page.evaluate(() => Reflect.get(window, 'responseRetryResolve')(0, true))
  await expect(button(page)).toBeVisible()
  await button(page).click()
  expect(await calls(page)).toEqual([{ binding, question }, { binding: next.binding, question: next.question }])
  await page.evaluate(() => Reflect.get(window, 'responseRetryResolve')(1, true))
  await expect(surface(page)).toHaveCount(0)
  expect(await page.locator('[data-retry-question]').textContent()).toBe(next.question)
})

test('포트 소멸은 pending을 취소하고 재연결 후 새 요청만 수락한다', async ({ page }) => {
  await mount(page)
  await button(page).click()
  await page.evaluate(() => Reflect.get(window, 'responseRetryMode')('missing'))
  await expect.poll(() => aborted(page)).toBe(true)
  await expect(surface(page)).toHaveAttribute('aria-busy', 'false')
  await expect(button(page)).toBeDisabled()
  await page.evaluate(() => Reflect.get(window, 'responseRetryResolve')(0, true))
  await expect(button(page)).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'responseRetryMode')('accept'))
  await button(page).click()
  await expect(surface(page)).toHaveCount(0)
  expect(await calls(page)).toHaveLength(2)
})

test('언마운트는 응답하지 않는 포트를 취소하고 늦은 ACK가 컴포저를 변경하지 않는다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await button(page).click()
  await page.evaluate(() => Reflect.get(window, 'responseRetryUnmount')())
  await expect.poll(() => aborted(page)).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'responseRetryResolve')(0, true))
  await expect(surface(page)).toHaveCount(0)
  await expect(page.getByLabel('대화 입력')).toHaveValue('전송하지 않은 초안')
  expect(await calls(page)).toHaveLength(1); expect(errors).toEqual([])
})

for (const kind of ['stopped', 'failed'] as const) test(`${kind}: 7언어와 callback wrapper 교체 중에도 같은 요청·버튼·원질문을 유지한다`, async ({ page }) => {
  await mount(page, { ...initial, kind })
  await button(page).click()
  await button(page).evaluate(el => Reflect.set(window, 'retryOriginalButton', el))
  for (const language of languages) {
    await page.evaluate(language => { Reflect.get(window, 'responseRetryLanguage')(language); Reflect.get(window, 'responseRetryRerender')() }, language)
    await expect(button(page)).toHaveAccessibleName(responseRetryText(language, kind === 'stopped' ? 'regenerate' : 'retry'))
    await expect(notice(page)).toHaveText(followupText(language, 'pending'))
    await expect(button(page)).toBeDisabled()
    expect(await aborted(page)).toBe(false)
    expect(await button(page).evaluate(el => el === Reflect.get(window, 'retryOriginalButton'))).toBe(true)
    if (kind === 'failed') {
      await expect(surface(page).locator('b')).toHaveText(responseRetryText(language, 'title'))
      await expect(surface(page).locator('.d')).toHaveText(responseRetryText(language, 'detail'))
    }
  }
  expect(await calls(page)).toEqual([{ binding, question }])
  await page.evaluate(() => Reflect.get(window, 'responseRetryResolve')(0, false))
  await expect(notice(page)).toHaveText(followupText('fr', 'failed'))
  await page.evaluate(() => Reflect.get(window, 'responseRetryLanguage')('ko'))
  await expect(notice(page)).toHaveText(followupText('ko', 'failed'))
})

for (const kind of ['stopped', 'failed'] as const) test(`${kind}: 320px에서 7언어와 모션 감소·키보드·busy 경계를 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mount(page, { ...initial, kind })
  await page.evaluate(() => Reflect.get(window, 'responseRetryBusy')(true))
  await expect(button(page)).toBeDisabled()
  await button(page).evaluate(el => (el as HTMLButtonElement).click())
  expect(await calls(page)).toEqual([])
  await page.evaluate(() => Reflect.get(window, 'responseRetryBusy')(false))
  for (const language of languages) {
    await page.evaluate(language => Reflect.get(window, 'responseRetryLanguage')(language), language)
    await expect(button(page)).toHaveAccessibleName(responseRetryText(language, kind === 'stopped' ? 'regenerate' : 'retry'))
    const geometry = await surface(page).evaluate(el => {
      const box = el.getBoundingClientRect(), button = el.querySelector('button')!, rect = button.getBoundingClientRect()
      return { left: box.left, right: box.right, overflow: el.scrollWidth > el.clientWidth, buttonRight: rect.right, height: rect.height, animation: getComputedStyle(button).animationName }
    })
    expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(320)
    expect(geometry.buttonRight).toBeLessThanOrEqual(320); expect(geometry.height).toBeGreaterThanOrEqual(44)
    expect(geometry.overflow).toBe(false); expect(geometry.animation).toBe('none')
  }
  await page.keyboard.press('Tab')
  await expect(button(page)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(surface(page)).toHaveAttribute('aria-busy', 'true')
  expect(await calls(page)).toEqual([{ binding, question }])
  await page.screenshot({ path: info.outputPath(`retry-${kind}-320.png`), fullPage: true })
})

for (const question of ['', ' \n\t ']) test(`빈 원질문 ${JSON.stringify(question)}은 재요청 표면을 만들지 않는다`, async ({ page }) => {
  await mount(page, { ...initial, question })
  await expect(surface(page)).toHaveCount(0)
  expect(await calls(page)).toEqual([])
})
for (const field of ['scopeId', 'messageId', 'observationId'] as const) test(`binding.${field} 미공급은 재요청을 표시하지 않는다`, async ({ page }) => {
  await mount(page, { ...initial, binding: { ...binding, [field]: ' ' } })
  await expect(surface(page)).toHaveCount(0)
  expect(await calls(page)).toEqual([])
})
