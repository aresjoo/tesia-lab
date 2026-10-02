import { expect, test, type Page } from '@playwright/test'
import type { MarketResponseBinding } from '../src/client-market-response-presentation'
import { followupText } from '../src/client-followup-copy'

// Presentation-port acceptance only. No live generation, producer or order authority.
const binding: MarketResponseBinding = { scopeId: 'owner-a/conversation-a', messageId: 'partial-a', observationId: 'observation-a' }
const partialText = '관측된 부분 답변입니다. 아직 결론과 출처 검증이 끝나지 않았습니다.'
const prompt = '방금 끊긴 답변을 이어서 계속 작성해줘'
type Input = { binding: MarketResponseBinding; partialText: string; restored?: boolean }
const initial: Input = { binding, partialText }

async function mount(page: Page, value: Input = initial, mode = 'pending') {
  await page.route('**/continuation-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"></body></html>' }))
  await page.goto('/continuation-test.html')
  await page.evaluate(async ({ value, mode }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    for (const path of ['/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/src/client-reference.css', '/src/client-conversation.css', '/src/client-main-experience.css']) await import(/* @vite-ignore */ path)
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/components/ClientContinueResponse.tsx', pp = '/src/client-preferences.ts'
    const react = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp), { ClientContinueResponse } = await import(/* @vite-ignore */ cp), { setClientPreference } = await import(/* @vite-ignore */ pp)
    document.body.innerHTML = '<main class="client-source-app client-lab-conversation" style="max-width:800px;padding:18px;box-sizing:border-box;margin:auto;height:auto;display:block;font-family:Noto Sans KR Variable,sans-serif"><div id="continuation-test"></div><textarea aria-label="대화 입력" style="box-sizing:border-box;max-width:100%">미전송 원문</textarea></main>'
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('continuation-test')!), h = react.createElement ?? react.default.createElement
    const calls: unknown[] = [], signals: AbortSignal[] = [], resolvers: ((accepted: boolean) => void)[] = []
    let current = value, currentMode = mode, busy = false
    const render = () => root.render(h(react.StrictMode ?? react.default.StrictMode, null,
      h(react.Fragment ?? react.default.Fragment, null,
        h('p', { 'data-partial-transcript': true, style: { overflowWrap: 'anywhere' } }, current.partialText),
        h(ClientContinueResponse, { ...current, busy,
          onContinue: currentMode === 'missing' ? undefined : async (request: unknown, signal: AbortSignal) => {
            calls.push(structuredClone(request)); signals.push(signal)
            if (currentMode === 'throw') throw new Error('TEST_ONLY_PRIVATE_CONTINUATION_FAILURE')
            if (currentMode === 'pending') return new Promise<boolean>(resolve => { resolvers.push(resolve) })
            return currentMode === 'accept'
          },
        }),
      ),
    ))
    Object.assign(window, { continuationCalls: calls, continuationSignals: signals,
      continuationResolve: (index: number, accepted: boolean) => resolvers[index]?.(accepted),
      continuationRender: (next: typeof value) => { current = next; render() },
      continuationMode: (next: string) => { currentMode = next; render() },
      continuationBusy: (next: boolean) => { busy = next; render() },
      continuationLanguage: (language: string) => setClientPreference('language', language),
      continuationUnmount: () => root.unmount(),
    })
    setClientPreference('language', 'ko'); render()
  }, { value, mode })
  await expect(page.locator('[data-partial-transcript]')).toBeAttached()
}
const list = (page: Page) => page.locator('.client-followups')
const button = (page: Page) => list(page).getByRole('button')
const calls = (page: Page) => page.evaluate(() => Reflect.get(window, 'continuationCalls'))
const aborted = (page: Page, index = 0) => page.evaluate(index => Reflect.get(window, 'continuationSignals')[index]?.aborted, index)

test('원본 이어쓰기 요청은 명시 ACK 전까지 대기하며 중복 발화를 막고 부분 답변·초안을 보존한다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await expect(button(page)).toHaveAccessibleName('이어서 계속')
  await expect(list(page).locator('.g-acbtn,.g-actnote,.bdg')).toHaveCount(0)
  await page.getByLabel('대화 입력').evaluate(el => Reflect.set(window, 'continuationComposer', el))
  await button(page).evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
  await expect(list(page)).toHaveAttribute('aria-busy', 'true')
  await expect(button(page)).toBeDisabled()
  expect(await calls(page)).toEqual([{ binding, partialText, prompt }])
  await expect(page.locator('[data-partial-transcript]')).toHaveText(partialText)
  await page.screenshot({ path: info.outputPath('continuation-pending.png'), fullPage: true })
  await page.evaluate(() => Reflect.get(window, 'continuationResolve')(0, true))
  await expect(list(page)).toHaveCount(0)
  await expect(page.locator('[data-partial-transcript]')).toHaveText(partialText)
  await expect(page.getByLabel('대화 입력')).toHaveValue('미전송 원문')
  expect(await page.getByLabel('대화 입력').evaluate(el => el === Reflect.get(window, 'continuationComposer'))).toBe(true)
  expect(errors).toEqual([])
})

for (const mode of ['reject', 'throw', 'missing']) test(`${mode}: 실패는 부분 답변을 유지하고 명시 재시도만 수락한다`, async ({ page }) => {
  await mount(page, initial, mode)
  await button(page).click()
  await expect(list(page).locator('.followup-notice')).toHaveText(followupText('ko', mode === 'missing' ? 'unavailable' : 'failed'))
  await expect(page.getByText('TEST_ONLY_PRIVATE_CONTINUATION_FAILURE', { exact: false })).toHaveCount(0)
  await expect(button(page)).toBeEnabled()
  await expect(page.locator('[data-partial-transcript]')).toHaveText(partialText)
  expect(await calls(page)).toHaveLength(mode === 'missing' ? 0 : 1)
  await page.evaluate(() => Reflect.get(window, 'continuationMode')('accept'))
  await button(page).click()
  await expect(list(page)).toHaveCount(0)
  expect(await calls(page)).toHaveLength(mode === 'missing' ? 1 : 2)
  await expect(page.getByLabel('대화 입력')).toHaveValue('미전송 원문')
})

for (const text of ['', '  \n\t ']) test(`빈 부분 답변 ${JSON.stringify(text)}에는 이어쓰기 조작을 만들지 않는다`, async ({ page }) => {
  await mount(page, { ...initial, partialText: text })
  await expect(list(page)).toHaveCount(0)
  expect(await calls(page)).toEqual([])
})

for (const field of ['scopeId', 'messageId', 'observationId'] as const) test(`binding.${field} 미공급은 이어쓰기 조작을 만들지 않는다`, async ({ page }) => {
  await mount(page, { ...initial, binding: { ...binding, [field]: ' ' } })
  await expect(list(page)).toHaveCount(0)
  expect(await calls(page)).toEqual([])
})

for (const boundary of ['owner', 'message', 'observation', 'partial'] as const) test(`${boundary} 교체는 이전 대기를 취소하며 늦은 ACK가 새 버튼을 닫지 않는다`, async ({ page }) => {
  await mount(page)
  await button(page).click()
  const next: Input = boundary === 'partial' ? { ...initial, partialText: partialText + ' 새로 공급된 부분.' }
    : { ...initial, binding: { ...binding, ...(boundary === 'owner' ? { scopeId: 'owner-b/conversation-b' } : boundary === 'message' ? { messageId: 'partial-b' } : { observationId: 'observation-b' }) } }
  await page.evaluate(next => Reflect.get(window, 'continuationRender')(next), next)
  await expect.poll(() => aborted(page)).toBe(true)
  await expect(button(page)).toBeEnabled()
  await page.evaluate(() => Reflect.get(window, 'continuationResolve')(0, true))
  await expect(button(page)).toBeVisible()
  await button(page).click()
  expect(await calls(page)).toEqual([{ binding, partialText, prompt }, { binding: next.binding, partialText: next.partialText, prompt }])
  await page.evaluate(() => Reflect.get(window, 'continuationResolve')(1, true))
  await expect(list(page)).toHaveCount(0)
  await expect(page.locator('[data-partial-transcript]')).toHaveText(next.partialText)
})

test('언마운트 뒤 늦은 ACK는 요청을 취소하고 외부 컴포저를 변경하지 않는다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await button(page).click()
  await page.evaluate(() => Reflect.get(window, 'continuationUnmount')())
  await expect.poll(() => aborted(page)).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'continuationResolve')(0, true))
  await expect(list(page)).toHaveCount(0)
  await expect(page.getByLabel('대화 입력')).toHaveValue('미전송 원문')
  expect(await calls(page)).toHaveLength(1); expect(errors).toEqual([])
})

test('포트 소멸은 대기 요청을 폐기하고 재연결 후 새 요청을 허용한다', async ({ page }) => {
  await mount(page)
  await button(page).click()
  await page.evaluate(() => Reflect.get(window, 'continuationMode')('missing'))
  await expect.poll(() => aborted(page)).toBe(true)
  await expect(list(page)).toHaveAttribute('aria-busy', 'false')
  await page.evaluate(() => Reflect.get(window, 'continuationResolve')(0, true))
  await expect(button(page)).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'continuationMode')('accept'))
  await button(page).click()
  await expect(list(page)).toHaveCount(0)
  expect(await calls(page)).toHaveLength(2)
})

test('대기 중 7언어 전환은 같은 요청·DOM·한국어 원본 prompt를 보존한다', async ({ page }) => {
  await mount(page)
  await button(page).click()
  await button(page).evaluate(el => Reflect.set(window, 'continuationOriginalButton', el))
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) {
    await page.evaluate(language => Reflect.get(window, 'continuationLanguage')(language), language)
    await expect(list(page)).toHaveAttribute('aria-busy', 'true')
    await expect(button(page)).toBeDisabled()
    expect(await aborted(page)).toBe(false)
    expect(await button(page).evaluate(el => el === Reflect.get(window, 'continuationOriginalButton'))).toBe(true)
    if (language === 'en') await expect(button(page)).toHaveAccessibleName('Continue')
    if (language === 'ko') await expect(button(page)).toHaveAccessibleName('이어서 계속')
  }
  expect(await calls(page)).toEqual([{ binding, partialText, prompt }])
  await page.evaluate(() => Reflect.get(window, 'continuationResolve')(0, false))
  await expect(list(page).locator('.followup-notice')).toHaveText(followupText('ko', 'failed'))
  await page.evaluate(() => Reflect.get(window, 'continuationLanguage')('en'))
  await expect(list(page).locator('.followup-notice')).toHaveText(followupText('en', 'failed'))
  await button(page).click()
  expect((await calls(page))[1]).toEqual({ binding, partialText, prompt })
})

test('320px 복원·모션 감소·busy 해제 뒤 키보드로 이어쓰되 초안과 원문은 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mount(page, { ...initial, restored: true })
  await page.evaluate(() => Reflect.get(window, 'continuationBusy')(true))
  await expect(button(page)).toBeDisabled()
  expect(await calls(page)).toEqual([])
  await page.evaluate(() => Reflect.get(window, 'continuationBusy')(false))
  await expect(button(page)).toBeEnabled()
  await page.keyboard.press('Tab')
  await expect(button(page)).toBeFocused()
  const geometry = await button(page).evaluate(el => { const box = el.getBoundingClientRect(); return { x: box.x, right: box.right, height: box.height, overflow: el.scrollWidth > el.clientWidth, animation: getComputedStyle(el).animationName } })
  expect(geometry.x).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(320)
  expect(geometry.height).toBeGreaterThanOrEqual(44); expect(geometry.overflow).toBe(false); expect(geometry.animation).toBe('none')
  await page.keyboard.press('Enter')
  await expect(list(page)).toHaveAttribute('aria-busy', 'true')
  expect(await calls(page)).toEqual([{ binding, partialText, prompt }])
  await page.screenshot({ path: info.outputPath('continuation-320-reduced.png'), fullPage: true })
  await page.evaluate(() => Reflect.get(window, 'continuationResolve')(0, true))
  await expect(page.locator('[data-partial-transcript]')).toHaveText(partialText)
  await expect(page.getByLabel('대화 입력')).toHaveValue('미전송 원문')
})
