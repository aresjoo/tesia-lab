import { expect, test, type Page } from '@playwright/test'

// Fixed 9fbff821 index.html:11248 supplies KO '복사 완료'. Its unconditional
// failure toast is not an oracle: only an observed latest clipboard success qualifies.
// Clipboard promises below are synthetic; no OS clipboard permission is requested.
const draft = '원문 초안 보존'
const question = '비트코인 조건 원문'
const notice = '[data-user-message-copy-notice].show'
const foreignLabels = [
  ['en', 'Message copied'], ['ja', 'メッセージをコピーしました'],
  ['zh-CN', '消息已复制'], ['zh-TW', '訊息已複製'],
  ['es', 'Mensaje copiado'], ['fr', 'Message copié'],
] as const // Existing copiedMessage literals, not invented source translations.

async function mount(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    const turn = { id: 'copy-turn', question: '비트코인 조건 원문', answer: '응답 원문을 그대로 보존합니다.', fullAnswer: '응답 원문을 그대로 보존합니다.', status: 'done', startedAt: 1, finishedAt: 100, suggestions: [], phase: 'plan' }
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'Copy QA', email: 'copy@example.test' }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: 'copy-session', homeDraft: '', sessions: [{ id: 'copy-session', title: '사용자 지정 제목', renamed: true, idea: turn.question, draft: '원문 초안 보존', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', turns: [turn], updatedAt: 1 }] }))
    const pending: { text: string; resolve: () => void; reject: (reason: Error) => void }[] = []
    Reflect.set(window, 'userCopyPending', pending)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (text: string) => new Promise<void>((resolve, reject) => pending.push({ text, resolve, reject })) } })
  })
  await page.goto('/')
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await page.evaluate(async () => {
    await document.fonts.ready
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(path)
    Reflect.set(window, 'userCopyPreference', setClientPreference)
  })
  await page.clock.install()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  const input = page.locator('.g-composer textarea')
  await input.focus()
  await input.evaluate(input => {
    input.setSelectionRange(2, 5)
    Reflect.set(window, 'userCopyInput', input)
    Reflect.set(window, 'userCopyMessage', document.querySelector('.g-umsg'))
    Reflect.set(window, 'userCopyThread', document.querySelector('.g-thread'))
    Reflect.set(window, 'userCopyStorage', sessionStorage.getItem('teth-client-experience'))
  })
}

async function copy(page: Page, selector = '.g-uacts button:last-child') {
  // Invoke the existing handler without moving focus, so preservation is measurable.
  await page.locator(selector).evaluate(button => button.click())
}

async function deliver(page: Page, index: number, result: 'resolve' | 'reject') {
  await page.evaluate(({ index, result }) => {
    const pending = Reflect.get(window, 'userCopyPending')[index]
    if (result === 'resolve') pending.resolve()
    else pending.reject(new Error('synthetic clipboard denied'))
  }, { index, result })
  await page.clock.runFor(1)
}

async function preserved(page: Page) {
  const input = page.locator('.g-composer textarea')
  await expect(input).toHaveValue(draft)
  await expect(input).toBeFocused()
  await expect(page.locator('.g-umsg')).toHaveCount(1)
  await expect(page.locator('.g-umsg')).toHaveText(question)
  await expect(page.locator('.g-thread')).toContainText('응답 원문을 그대로 보존합니다.')
  expect(await input.evaluate(input => ({ sameInput: input === Reflect.get(window, 'userCopyInput'), selection: [input.selectionStart, input.selectionEnd], sameMessage: document.querySelector('.g-umsg') === Reflect.get(window, 'userCopyMessage'), sameThread: document.querySelector('.g-thread') === Reflect.get(window, 'userCopyThread'), sameStorage: sessionStorage.getItem('teth-client-experience') === Reflect.get(window, 'userCopyStorage') }))).toEqual({ sameInput: true, selection: [2, 5], sameMessage: true, sameThread: true, sameStorage: true })
}

test('KO 성공은 원문 복사 완료와 기존 2200ms 수명을 보존한다', async ({ page }) => {
  await mount(page)
  await copy(page)
  await expect(page.locator(notice)).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'userCopyPending')[0].text)).toBe(question)
  await deliver(page, 0, 'resolve')
  await expect(page.locator(notice)).toHaveText('복사 완료')
  await expect(page.locator(notice)).toHaveAttribute('role', 'status')
  await expect(page.locator(notice)).toHaveAttribute('aria-live', 'polite')
  await expect(page.locator(notice)).toHaveCSS('position', 'fixed')
  await expect(page.locator('.g-uacts button').last()).toHaveAttribute('aria-label', '메시지 복사 완료')
  await preserved(page)
  await page.clock.runFor(2198)
  await expect(page.locator(notice)).toHaveText('복사 완료')
  await page.clock.runFor(1)
  await expect(page.locator(notice)).toHaveCount(0)
  await preserved(page)
})

test('거절은 성공 안내 없이 기존 오류와 원문 DOM을 보존한다', async ({ page }) => {
  await mount(page)
  await copy(page)
  await deliver(page, 0, 'reject')
  await expect(page.locator('.g-copy-error')).toHaveText('복사 권한을 확인해주세요.')
  await expect(page.locator(notice)).toHaveCount(0)
  await expect(page.locator('.g-uacts button').last()).toHaveAttribute('aria-label', '메시지 복사')
  await preserved(page)
})

test('최신 실패 뒤 이전 성공은 성공 안내와 체크를 만들지 않는다', async ({ page }) => {
  await mount(page)
  await copy(page)
  await copy(page)
  await deliver(page, 1, 'reject')
  await deliver(page, 0, 'resolve')
  await expect(page.locator(notice)).toHaveCount(0)
  await expect(page.locator('.g-copy-error')).toHaveText('복사 권한을 확인해주세요.')
  await expect(page.locator('.g-uacts button').last()).toHaveAttribute('aria-label', '메시지 복사')
  await preserved(page)
})

test('최신 성공 뒤 이전 실패는 성공 안내를 덮거나 수명을 연장하지 않는다', async ({ page }) => {
  await mount(page)
  await copy(page)
  await copy(page)
  await deliver(page, 1, 'resolve')
  await expect(page.locator(notice)).toHaveText('복사 완료')
  await deliver(page, 0, 'reject')
  await expect(page.locator('.g-copy-error')).toHaveCount(0)
  await expect(page.locator(notice)).toHaveText('복사 완료')
  await preserved(page)
  await page.clock.runFor(2200)
  await expect(page.locator(notice)).toHaveCount(0)
})

test('unmount 뒤 늦은 성공은 portal 안내를 만들지 않는다', async ({ page }) => {
  await mount(page)
  await copy(page)
  // Actual Main navigation, without inventing a service state or callback.
  await page.locator('.client-rail-new-row button').evaluate(button => button.click())
  await expect(page.locator('.g-uacts')).toHaveCount(0)
  const homeInput = page.locator('.client-home-pill textarea')
  await expect(homeInput).toBeVisible()
  await homeInput.fill('홈 원문 보존')
  await homeInput.focus()
  await deliver(page, 0, 'resolve')
  await expect(page.locator(notice)).toHaveCount(0)
  await expect(homeInput).toHaveValue('홈 원문 보존')
  await expect(homeInput).toBeFocused()
  await page.clock.runFor(2500)
  await expect(page.locator(notice)).toHaveCount(0)
})

test('같은 컴포넌트의 메시지 교체는 이전 promise만 무효화한다', async ({ page }) => {
  await mount(page)
  // A separate read-only props probe uses the real shared Main/Native component.
  // Static Main imports already supply the existing AccountUI CSS and fonts.
  await page.evaluate(async () => {
    const reactPath = '/@id/react'
    const domPath = '/@id/react-dom/client'
    const componentPath = '/src/components/ClientConversation.tsx'
    const [react, dom, component] = await Promise.all([import(reactPath), import(domPath), import(componentPath)])
    const host = document.createElement('div')
    host.id = 'user-copy-props-probe'
    document.body.append(host)
    const root = (dom.createRoot ?? dom.default.createRoot)(host)
    const h = react.createElement ?? react.default.createElement
    const render = (text: string) => root.render(h(component.ClientUserMessage, { onEdit: () => {}, children: text }))
    Reflect.set(window, 'userCopyPropsRender', render)
    Reflect.set(window, 'userCopyPropsRoot', root)
    render('이전 메시지')
  })
  const row = page.locator('#user-copy-props-probe .g-umsg')
  const button = page.locator('#user-copy-props-probe .g-uacts button').last()
  await expect(row).toHaveText('이전 메시지')
  const previousRow = await row.elementHandle()
  await copy(page, '#user-copy-props-probe .g-uacts button:last-child')
  await page.evaluate(() => Reflect.get(window, 'userCopyPropsRender')('교체 메시지'))
  await expect(row).toHaveText('교체 메시지')
  expect(await row.evaluate((node, previous) => node === previous, previousRow)).toBe(true)
  await deliver(page, 0, 'resolve')
  await expect(page.locator(notice)).toHaveCount(0)
  await expect(button).toHaveAttribute('aria-label', '메시지 복사')
  await copy(page, '#user-copy-props-probe .g-uacts button:last-child')
  expect(await page.evaluate(() => Reflect.get(window, 'userCopyPending')[1].text)).toBe('교체 메시지')
  await deliver(page, 1, 'resolve')
  await expect(page.locator(notice)).toHaveText('복사 완료')
  await page.evaluate(() => Reflect.get(window, 'userCopyPropsRoot').unmount())
  await expect(page.locator(notice)).toHaveCount(0)
  await preserved(page)
})

test('외국어 안내는 완료 시점의 기존 copiedMessage 6번역을 소비한다', async ({ page }) => {
  await mount(page)
  let index = 0
  for (const [language, label] of foreignLabels) {
    await copy(page)
    await page.evaluate(language => Reflect.get(window, 'userCopyPreference')('language', language), language)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await deliver(page, index++, 'resolve')
    await expect(page.locator(notice)).toHaveText(label)
    await expect(page.locator('.g-uacts button').last()).toHaveAttribute('aria-label', label)
    await preserved(page)
    await page.clock.runFor(2200)
    await expect(page.locator(notice)).toHaveCount(0)
  }
})
