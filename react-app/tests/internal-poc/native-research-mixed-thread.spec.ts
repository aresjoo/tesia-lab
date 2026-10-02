import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })
// Real shell/workspace/document renderers, explicit synthetic callbacks/messages.
// This seam does not certify backend requests, ordering, authorization or persistence.
async function mount(page: Page, open = true, legacy = false) {
  const errors: string[] = [], requests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') || request.method() !== 'GET') requests.push(request.url()) })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.route('**/mixed-thread-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture"></div></body></html>' }))
  await page.goto('/mixed-thread-fixture.html')
  await page.evaluate(async legacy => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/internal-poc/ClientServiceExperience.tsx', source = await (await fetch(path)).text()
    const rp = source.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement
    const dp = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ dp)
    const { ClientServiceExperience } = await import(/* @vite-ignore */ path)
    const workspacePath = '/src/internal-poc/NativeResearchWorkspace.tsx', { NativeResearchWorkspace } = await import(/* @vite-ignore */ workspacePath)
    const preferencePath = '/src/client-preferences.ts', { setClientPreference } = await import(/* @vite-ignore */ preferencePath)
    type Message = { id: string; role: string; text: string; researchThread?: { scopeId: string; documentId: string }; delivery?: string }
    const pending: { resolve: (result: unknown) => void; reject: (error: Error) => void }[] = []
    const calls: string[] = []
    function Host() {
      const [owner, setOwner] = react.useState('owner-a'), [revision, setRevision] = react.useState('one'), [input, setInput] = react.useState('')
      const [messages, setMessages] = react.useState([{ id: 'initial', role: 'user', text: '시작한 전략' }] as Message[])
      const [view, setView] = react.useState({ activeDocumentId: 'report', openDocumentIds: ['plan', 'report', 'other'] })
      const scopeId = `${owner}:conversation`
      Object.assign(window, { mixedOwner: (value: string) => { setOwner(value); setMessages([{ id: 'initial', role: 'user', text: '새 전략' }]) }, mixedRevision: setRevision,
        mixedLanguage: (value: string) => setClientPreference('language', value), mixedCalls: calls,
        mixedResolve: (index: number, title: string, long = false) => pending[index].resolve({ title, summary: '공급된 민감도 원문 '.repeat(long ? 180 : 1), metrics: { return: { text: '+1.000125%' } } }),
        mixedReject: (index: number) => pending[index].reject(new Error('PRIVATE_DETAIL')),
        mixedAnswer: (id: string, text: string, documentId = 'report') => setMessages((current: Message[]) => [...current, { id, text, role: 'assistant', researchThread: { scopeId, documentId } }]),
        mixedUpdate: (id: string, text: string) => setMessages((current: Message[]) => current.map(message => message.id === id ? { ...message, text } : message)),
        mixedRemove: (id: string) => setMessages((current: Message[]) => current.filter(message => message.id !== id)),
        mixedRecreate: () => setMessages((current: Message[]) => [...current]),
        mixedBatch: (index: number) => {
          setMessages((current: Message[]) => [...current, { id: 'batch-a', role: 'assistant', text: 'A2', researchThread: { scopeId, documentId: 'report' } }])
          pending[index].resolve({ title: 'W2', summary: '같은 tick 성공 응답' })
        },
      })
      const researchData = { scopeId, view, onViewChange: setView, typedDocuments: ['report', 'other'].map(id => ({ id, title: id === 'report' ? 'Final Report' : '다른 보고서', kind: 'report', state: 'ready', revision,
          data: { strategyName: '공급 보고서', metrics: {}, evidence: [], whatIf: [{ id: 'fee', label: '수수료 2배', onRun: () => { calls.push(id); return new Promise((resolve, reject) => pending.push({ resolve, reject })) } }] },
        })) }
      if (legacy) return h(NativeResearchWorkspace, { ...researchData, title: '호환 문서', onBack: () => {}, threadForDocument: (id: string) => h('div', { 'data-legacy-thread': id }, '불투명 기존 기록', h('input', { 'aria-label': `legacy-${id}`, defaultValue: '초기 입력' })) })
      return h(ClientServiceExperience, { accountScope: owner,
        strategyDocument: { identity: scopeId, content: h('p', {}, '실제 전략 표시 슬롯') },
        researchPresentation: { scope: owner, data: researchData },
        state: { phase: 'ready', sessionState: 'AUTHENTICATED', messages, input, inputDisabled: false, busy: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
          onInput: setInput, onSend: async (value: string, _display: string, researchThread?: Message['researchThread']) => { setInput(''); setMessages((current: Message[]) => [...current, { id: `q-${current.length}`, role: 'user', text: value, researchThread }]) }, onReset: () => {} },
      })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  }, legacy)
  if (open && !legacy) {
    await page.locator('[data-native-open-research]').click()
    await expect(panel(page)).toBeVisible()
  }
  return { errors, requests }
}
const panel = (page: Page) => page.locator('.native-research-workspace [role="tabpanel"]:visible')
const composer = (page: Page) => page.locator('.g-composer textarea')
async function question(page: Page, text: string) { await composer(page).fill(text); await composer(page).press('Enter'); await expect(panel(page).locator('.g-umsg').last()).toHaveText(text) }
async function answer(page: Page, id: string, text: string, documentId = 'report') { await page.evaluate(({ id, text, documentId }) => Reflect.get(window, 'mixedAnswer')(id, text, documentId), { id, text, documentId }); await expect(page.locator(`.native-research-thread[data-document-id="${documentId}"]`)).toContainText(text) }
async function resolve(page: Page, index: number, title: string) { await page.evaluate(({ index, title }) => Reflect.get(window, 'mixedResolve')(index, title), { index, title }) }
async function whatIf(page: Page, index: number, title: string) { await panel(page).getByRole('button', { name: '수수료 2배', exact: true }).click(); await resolve(page, index, title); await expect(panel(page).getByRole('heading', { name: title, exact: true })).toBeVisible() }
async function order(page: Page, expected: string[]) {
  await expect.poll(async () => (await panel(page).locator('.g-umsg, .g-amsg[data-response-state="done"], [data-research-whatif-history] h3, [data-native-thread-kind="whatif"] h3').allTextContents()).flatMap(text => text.match(/\b(?:Q|A|W)\d\b/g) ?? [])).toEqual(expected)
}

test('실제 shell 질문·답변과 What-if 성공은 한 문서에서 관측 순서로 섞인다', async ({ page }) => {
  const audit = await mount(page)
  await question(page, 'Q1'); await answer(page, 'a1', 'A1')
  await whatIf(page, 0, 'W1')
  await order(page, ['Q1', 'A1', 'W1'])
  await question(page, 'Q2'); await answer(page, 'a2', 'A2'); await whatIf(page, 1, 'W2')
  await order(page, ['Q1', 'A1', 'W1', 'Q2', 'A2', 'W2'])
  expect(audit.errors).toEqual([]); expect(audit.requests).toEqual([])
})

test('기존 opaque threadForDocument는 내용과 입력 DOM을 유지하며 What-if와 공존한다', async ({ page }) => {
  await mount(page, true, true)
  const input = panel(page).getByRole('textbox', { name: 'legacy-report' })
  await input.fill('기존 소비자 초안'); await input.evaluate(node => Reflect.set(window, 'legacyNode', node))
  await whatIf(page, 0, 'W1'); await whatIf(page, 1, 'W2')
  await expect(panel(page).locator('[data-legacy-thread]')).toContainText('불투명 기존 기록')
  await expect(input).toHaveValue('기존 소비자 초안')
  expect(await input.evaluate(node => node === Reflect.get(window, 'legacyNode'))).toBe(true)
  await expect(panel(page).locator('.native-research-thread')).toHaveCount(1)
})

test('기존 message ID 갱신은 위치·DOM을 유지하고 revision은 What-if만 비운다', async ({ page }) => {
  await mount(page); await question(page, 'Q1'); await answer(page, 'a1', 'A1'); await whatIf(page, 0, 'W1')
  await panel(page).locator('.g-umsg').evaluate(node => Reflect.set(window, 'mixedMessageNode', node))
  await composer(page).fill('보존할 입력'); await composer(page).evaluate(node => Reflect.set(window, 'mixedComposerNode', node))
  await page.evaluate(() => Reflect.get(window, 'mixedUpdate')('a1', 'A2'))
  await order(page, ['Q1', 'A2', 'W1'])
  await panel(page).getByRole('button', { name: '수수료 2배', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'mixedRevision')('two')); await resolve(page, 1, 'W2')
  await order(page, ['Q1', 'A2'])
  expect(await panel(page).locator('.g-umsg').evaluate(node => node === Reflect.get(window, 'mixedMessageNode'))).toBe(true)
  expect(await composer(page).evaluate(node => node === Reflect.get(window, 'mixedComposerNode'))).toBe(true)
  await expect(composer(page)).toHaveValue('보존할 입력')
})

test('숨김 문서 응답은 그 문서 순서에만 추가되고 실패·중복요청은 결과를 생성하지 않는다', async ({ page }) => {
  await mount(page); await question(page, 'Q1'); await whatIf(page, 0, 'W1')
  await panel(page).getByRole('button', { name: '수수료 2배', exact: true }).evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
  expect(await page.evaluate(() => Reflect.get(window, 'mixedCalls'))).toEqual(['report', 'report'])
  await page.locator('.rw-tabs').getByRole('tab', { name: '다른 보고서', exact: true }).click()
  await question(page, 'Q2'); await resolve(page, 1, 'W2'); await answer(page, 'a1', 'A1')
  await order(page, ['Q2'])
  await page.locator('.rw-tabs [role="tab"]').nth(1).click()
  await order(page, ['Q1', 'W1', 'W2', 'A1'])
  await panel(page).getByRole('button', { name: '수수료 2배', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'mixedReject')(2))
  await expect(panel(page).getByRole('alert')).toBeVisible(); await order(page, ['Q1', 'W1', 'W2', 'A1'])
  await expect(page.locator('body')).not.toContainText('PRIVATE_DETAIL')
})

test('owner 교체는 과거 혼합 기록과 늦은 결과를 버린다', async ({ page }) => {
  await mount(page); await question(page, 'Q1'); await whatIf(page, 0, 'W1')
  await panel(page).getByRole('button', { name: '수수료 2배', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'mixedOwner')('owner-b')); await resolve(page, 1, 'W2')
  await page.locator('[data-native-open-research]').click()
  await order(page, [])
  await question(page, 'Q2'); await whatIf(page, 2, 'W3'); await order(page, ['Q2', 'W3'])
})

test('320px·7언어에서도 혼합 순서와 하나의 composer DOM을 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page)
  await question(page, 'Q1'); await whatIf(page, 0, 'W1'); await answer(page, 'a1', 'A1')
  await composer(page).fill('유지할 초안'); await composer(page).evaluate(node => Reflect.set(window, 'mixedComposerNode', node))
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(locale => Reflect.get(window, 'mixedLanguage')(locale), locale)
    await order(page, ['Q1', 'W1', 'A1'])
    await expect(composer(page)).toHaveValue('유지할 초안')
    expect(await composer(page).evaluate(node => node === Reflect.get(window, 'mixedComposerNode'))).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
})

test('키보드 문서 열기는 숨겨진 trigger 대신 활성 문서 tab으로 초점을 옮긴다', async ({ page }) => {
  await mount(page, false)
  const open = page.locator('[data-native-open-research]')
  await open.focus(); await open.press('Enter')
  await expect(panel(page)).toBeVisible()
  await expect(page.locator('.rw-tabs [aria-selected="true"]')).toBeFocused()
  await composer(page).fill('유지할 선택 영역')
  await composer(page).evaluate(node => { node.focus(); (node as HTMLTextAreaElement).setSelectionRange(2, 5) })
  await page.evaluate(() => Reflect.get(window, 'mixedLanguage')('en'))
  await expect(composer(page)).toBeFocused()
  expect(await composer(page).evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd])).toEqual([2, 5])
  await page.locator('.rw-title > button').first().click()
  await composer(page).focus()
  await composer(page).evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(2, 5))
  await page.locator('[data-native-open-research]').evaluate(node => (node as HTMLButtonElement).click())
  await expect(composer(page)).toBeFocused()
  expect(await composer(page).evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd])).toEqual([2, 5])
})

test('같은 tick의 결과 resolve·새 메시지는 유실 없이 로컬 관측 순서를 유지한다', async ({ page }) => {
  await mount(page); await question(page, 'Q1'); await whatIf(page, 0, 'W1')
  await panel(page).locator('.g-umsg').evaluate(node => Reflect.set(window, 'mixedMessageNode', node))
  await panel(page).getByRole('button', { name: '수수료 2배', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'mixedBatch')(1))
  // The result callback is observed before the queued parent message commits.
  // No server timestamp or enqueue-time provenance is inferred from React props.
  await order(page, ['Q1', 'W1', 'W2', 'A2'])
  await page.evaluate(() => Reflect.get(window, 'mixedRecreate')())
  await order(page, ['Q1', 'W1', 'W2', 'A2'])
  expect(await panel(page).locator('.g-umsg').evaluate(node => node === Reflect.get(window, 'mixedMessageNode'))).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'mixedRemove')('batch-a'))
  await order(page, ['Q1', 'W1', 'W2'])
})

const scroll = (page: Page) => page.locator('.native-research-workspace .rw-scroll')
async function scrollTo(page: Page, bottom: boolean) {
  await scroll(page).evaluate((node, bottom) => { node.scrollTop = bottom ? node.scrollHeight : 0; node.dispatchEvent(new Event('scroll', { bubbles: true })) }, bottom)
}
const bottomGap = (page: Page) => scroll(page).evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop)

test('What-if 성공만 바닥 독자를 따라가며 위를 읽을 때는 unread로 알린다', async ({ page }) => {
  await mount(page); await question(page, 'Q1'); await answer(page, 'long-answer', `A1 ${'관측된 설명 '.repeat(300)}`)
  await panel(page).getByRole('button', { name: '수수료 2배', exact: true }).click()
  await scrollTo(page, true)
  await expect(page.locator('.native-thread-unread')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'mixedResolve')(0, 'W1', true))
  await expect(panel(page).getByRole('heading', { name: 'W1', exact: true })).toBeVisible()
  await expect.poll(() => bottomGap(page)).toBeLessThan(3)
  await panel(page).getByRole('button', { name: '수수료 2배', exact: true }).click(); await scrollTo(page, false)
  await resolve(page, 1, 'W2')
  await expect(page.locator('.native-thread-unread')).toBeVisible()
  expect(await scroll(page).evaluate(node => node.scrollTop)).toBe(0)
  await page.locator('.native-thread-unread').click()
  await expect.poll(() => bottomGap(page)).toBeLessThan(3)
  await expect(page.locator('.native-thread-unread')).toHaveCount(0)
})

test('다른 문서와 숨김 workspace는 성공 unread만 남기며 revision 무효화는 알림도 제거한다', async ({ page }) => {
  await mount(page)
  await panel(page).getByRole('button', { name: '수수료 2배', exact: true }).click()
  await page.locator('.rw-tabs').getByRole('tab', { name: '다른 보고서', exact: true }).click()
  await scrollTo(page, false); await resolve(page, 0, 'W1')
  const reportArtifact = page.locator('.rw-artifact').filter({ hasText: '검증 결과' })
  await expect(reportArtifact.locator('small')).toHaveText('새 응답')
  await expect(page.locator('.native-thread-unread')).toHaveCount(0)
  expect(await scroll(page).evaluate(node => node.scrollTop)).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'mixedRevision')('two'))
  await expect(reportArtifact.locator('small')).not.toHaveText('새 응답')
  await page.locator('.rw-tabs [role="tab"]').nth(1).click()
  await panel(page).getByRole('button', { name: '수수료 2배', exact: true }).click()
  await page.locator('.rw-title > button').first().click()
  await resolve(page, 1, 'W2')
  await expect(reportArtifact.locator('small')).toHaveText('새 응답')
  await page.locator('[data-native-open-research]').click()
  await expect(page.locator('.native-thread-unread')).toBeVisible()
  await order(page, ['W2'])
})

test('서로 다른 두 문서가 같은 batch에 성공해도 숨김 문서별 unread가 모두 남는다', async ({ page }) => {
  await mount(page)
  await panel(page).getByRole('button', { name: '수수료 2배', exact: true }).click()
  await page.locator('.rw-tabs').getByRole('tab', { name: '다른 보고서', exact: true }).click()
  await panel(page).getByRole('button', { name: '수수료 2배', exact: true }).click()
  await page.locator('.rw-title > button').first().click()
  await page.evaluate(() => { Reflect.get(window, 'mixedResolve')(0, 'W1'); Reflect.get(window, 'mixedResolve')(1, 'W2') })
  await expect(page.locator('.rw-artifact').filter({ hasText: '검증 결과' }).locator('small')).toHaveText('새 응답')
  await expect(page.locator('.rw-artifact').filter({ hasText: '다른 보고서' }).locator('small')).toHaveText('새 응답')
  await page.locator('[data-native-open-research]').click()
  await order(page, ['W2'])
  await page.locator('.rw-tabs [role="tab"]').nth(1).click()
  await order(page, ['W1'])
})
