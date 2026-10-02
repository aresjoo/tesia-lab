import { expect, test, type Page } from '@playwright/test'
import type { FollowupPresentation } from '../src/client-followup-presentation'
import { followupText } from '../src/client-followup-copy'

const presentation: FollowupPresentation = {
  binding: { scopeId: 'owner-a/conversation-a', messageId: 'answer-a', observationId: 'followups-a' },
  actions: [{ id: 'save', type: 'alert', label: '이 조건을 저장하기' }, { id: 'test', type: 'backtest', label: '이 아이디어로 과거 시장 검증하기' }],
  questions: [{ id: 'q1', label: '지금 시장에서 주의할 점은?', text: '지금 시장에서 주의할 점은?' }, { id: 'q2', label: '거래량도 같이 볼까요?', text: '거래량을 같이 설명해줘' }, { id: 'q3', label: '좀 더 쉽게 설명해줘', text: '좀 더 쉽게 설명해줘' }],
  showFreeBadge: true,
}
async function mount(page: Page, initial = presentation, mode = 'pending') {
  await page.route('**/followups-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"></body></html>' }))
  await page.goto('/followups-test.html')
  await page.evaluate(async ({ initial, mode }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    for (const path of ['/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/src/client-reference.css', '/src/client-conversation.css', '/src/client-main-experience.css']) await import(/* @vite-ignore */ path)
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/components/ClientResponseSequence.tsx', pp = '/src/client-preferences.ts'
    const react = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp), { ClientResponseSequence } = await import(/* @vite-ignore */ cp), { setClientPreference } = await import(/* @vite-ignore */ pp)
    document.body.innerHTML = '<main class="client-source-app client-lab-conversation" style="max-width:800px;padding:18px;box-sizing:border-box;margin:auto;height:auto;display:block;font-family:Noto Sans KR Variable,sans-serif"><div id="followups-test"></div><textarea aria-label="대화 입력">미전송 원문</textarea></main>'
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('followups-test')!), h = react.createElement ?? react.default.createElement
    const calls: unknown[] = [], signals: AbortSignal[] = []
    let resolve: (value: boolean) => void = () => {}, current = initial, currentMode = mode, busy = false
    const render = () => root.render(h(react.StrictMode ?? react.default.StrictMode, null, h(ClientResponseSequence, {
      source: 'service', blocks: [{ id: 'next', kind: 'followups', presentation: current }], followupActions: {
        busy, activate: currentMode === 'missing' ? undefined : async (selection: unknown, signal: AbortSignal) => {
          calls.push(selection); signals.push(signal)
          if (currentMode === 'throw') throw new Error('TEST_ONLY_FOLLOWUP_FAILURE')
          if (currentMode === 'pending') return new Promise<boolean>(done => { resolve = done })
          return currentMode === 'accept'
        },
      },
    })))
    Object.assign(window, { followupCalls: calls, followupSignals: signals, followupResolve: (value: boolean) => resolve(value), followupRender: (value: typeof initial) => { current = value; render() }, followupMode: (value: string) => { currentMode = value; render() }, followupBusy: (value: boolean) => { busy = value; render() }, followupLanguage: (value: string) => setClientPreference('language', value), followupUnmount: () => root.unmount() })
    setClientPreference('language', 'ko'); render()
  }, { initial, mode })
  await expect(page.locator('.client-followups')).toBeVisible()
}
const calls = (page: Page) => page.evaluate(() => Reflect.get(window, 'followupCalls'))

test('원본 주행동2→후속3→고지 순서·SVG·배지를 유지한다', async ({ page }, info) => {
  await mount(page, { ...presentation, actions: [...presentation.actions, { id: 'extra', type: 'auto_trade', label: '초과 행동' }], questions: [...presentation.questions, { id: 'extra', label: '초과 질문', text: '초과 질문' }] })
  await expect(page.locator('.client-followups>button')).toHaveCount(5)
  expect(await page.locator('.client-followups>button').evaluateAll(nodes => nodes.map(node => node.className))).toEqual(['g-acbtn','g-acbtn','g-nextq','g-nextq','g-nextq'])
  await expect(page.locator('.g-acbtn svg')).toHaveCount(2)
  expect(await page.locator('.g-acbtn svg path').first().getAttribute('d')).toBe('M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6')
  await expect(page.locator('.g-actnote')).toHaveText(followupText('ko', 'note'))
  await expect(page.locator('.bdg')).toHaveText([followupText('ko', 'free'),followupText('ko', 'free')])
  await page.screenshot({ path: info.outputPath('followups.png'), fullPage: true })
})

test('저장 ACK 전에는 성공하지 않고 중복 클릭을 막으며 질문 원문과 초안을 보존한다', async ({ page }) => {
  await mount(page)
  await page.locator('.g-acbtn').first().click()
  await expect(page.locator('.client-followups')).toHaveAttribute('aria-busy', 'true')
  await page.locator('.g-acbtn').first().evaluate(node => (node as HTMLButtonElement).click())
  expect(await calls(page)).toHaveLength(1)
  await expect(page.getByText(followupText('ko', 'saved'), { exact: true })).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'followupResolve')(true))
  await expect(page.locator('.g-acbtn').first()).toBeDisabled()
  await expect(page.locator('.g-acbtn .tx').first()).toHaveText(followupText('ko', 'saved'))
  await page.locator('.g-nextq').nth(1).click()
  expect((await calls(page))[1]).toEqual({ binding: presentation.binding, kind: 'question', item: presentation.questions[1] })
  await page.evaluate(() => Reflect.get(window, 'followupResolve')(true))
  await expect(page.locator('.client-followups')).toHaveCount(0)
  await expect(page.getByLabel('대화 입력')).toHaveValue('미전송 원문')
})

for (const mode of ['reject','throw','missing']) test(`${mode}: 성공을 만들지 않고 기존 목록에서 명시 재시도한다`, async ({ page }) => {
  await mount(page, presentation, mode)
  await page.locator('.g-acbtn').nth(1).click()
  await expect(page.locator('.followup-notice')).toHaveText(followupText('ko', mode === 'missing' ? 'unavailable' : 'failed'))
  await expect(page.locator('.g-acbtn')).toHaveCount(2)
  await page.evaluate(() => Reflect.get(window, 'followupMode')('accept'))
  await page.locator('.g-acbtn').nth(1).click()
  await expect(page.locator('.client-followups')).toHaveCount(0)
})

test('소유범위/응답 교체·언마운트는 대기 응답을 폐기한다', async ({ page }) => {
  await mount(page)
  await page.locator('.g-acbtn').first().click()
  await page.evaluate(value => Reflect.get(window, 'followupRender')(value), { ...presentation, binding: { ...presentation.binding, scopeId: 'owner-b/conversation-b' } })
  expect(await page.evaluate(() => Reflect.get(window, 'followupSignals')[0].aborted)).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'followupResolve')(true))
  await expect(page.locator('.g-acbtn .tx').first()).toHaveText(presentation.actions[0].label)
  await page.locator('.g-acbtn').first().click()
  await page.evaluate(() => Reflect.get(window, 'followupUnmount')())
  expect(await page.evaluate(() => Reflect.get(window, 'followupSignals')[1].aborted)).toBe(true)
})

test('연결 포트 제거는 대기를 해제하며 같은 목록의 재연결은 새 요청이다', async ({ page }) => {
  await mount(page)
  await page.locator('.g-acbtn').first().click()
  await page.evaluate(() => Reflect.get(window, 'followupMode')('missing'))
  await expect(page.locator('.client-followups')).toHaveAttribute('aria-busy', 'false')
  expect(await page.evaluate(() => Reflect.get(window, 'followupSignals')[0].aborted)).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'followupResolve')(true))
  await expect(page.locator('.g-acbtn .tx').first()).toHaveText(presentation.actions[0].label)
  await page.evaluate(() => Reflect.get(window, 'followupMode')('accept'))
  await page.locator('.g-acbtn').first().click()
  await expect(page.locator('.g-acbtn .tx').first()).toHaveText(followupText('ko', 'saved'))
})

test('busy·키보드·7언어 및 복원은 저장 상태와 원문 라벨을 보존한다', async ({ page }) => {
  await mount(page, { ...presentation, restored: true, showFreeBadge: false, actions: [{ ...presentation.actions[0], saved: true }, presentation.actions[1]] })
  await expect(page.locator('.bdg')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'followupBusy')(true))
  for (const button of await page.locator('.client-followups>button').all()) await expect(button).toBeDisabled()
  await page.evaluate(() => Reflect.get(window, 'followupBusy')(false))
  await page.keyboard.press('Tab')
  await expect(page.locator('.g-acbtn').nth(1)).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('.g-nextq').first()).toBeFocused()
  for (const language of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'followupLanguage')(value), language)
    await expect(page.locator('.g-acbtn .tx').first()).toHaveText(followupText(language, 'saved'))
    await expect(page.locator('.g-actnote')).toHaveText(followupText(language, 'note'))
    await expect(page.locator('.g-acbtn .tx').nth(1)).toHaveText(presentation.actions[1].label)
  }
  expect(await page.locator('.g-acbtn').first().evaluate(node => getComputedStyle(node).animationName)).toBe('none')
})

for (const width of [320, 390, 768, 1440]) test(`${width}px 장문·7언어·확대에서 라벨과 배지가 겹치지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await mount(page, { ...presentation, actions: presentation.actions.map(item => ({ ...item, label: `${item.label} 아주긴자산이름과조건도읽을수있어야합니다 `.repeat(2) })) })
  for (const language of ['ko','en','ja','zh-CN','zh-TW','es','fr']) {
    await page.evaluate(value => Reflect.get(window, 'followupLanguage')(value), language)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const bounds = await page.locator('.g-acbtn').first().evaluate(node => {
      const box = node.getBoundingClientRect(), label = node.querySelector('.lf')!.getBoundingClientRect(), badge = node.querySelector('.rt')!.getBoundingClientRect()
      return { contained: label.right <= box.right && badge.right <= box.right, separate: label.right <= badge.left || label.bottom <= badge.top, height: box.height }
    })
    expect(bounds).toMatchObject({ contained: true, separate: true })
    expect(bounds.height).toBeGreaterThanOrEqual(44)
  }
  await page.locator('.client-followups').evaluate(node => { (node as HTMLElement).style.zoom = '2' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.locator('.g-acbtn').first().evaluate(node => getComputedStyle(node).animationName)).toBe('none')
  if (width === 320) await page.screenshot({ path: info.outputPath('followups-320-fr-zoom.png'), fullPage: true })
})
