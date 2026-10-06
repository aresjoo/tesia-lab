import { expect, test, type Page } from '@playwright/test'

// 고정9fb index.html:20945의 g-in Enter 가드를 Main 문서 composer에 계승한다.
// Chromium 조합 상태와 합성 keyCode229를 구분하며 실제 OS IME/Native/API 성공은 주장하지 않는다.
const owner = 'research-ime-current', other = 'research-ime-other'
const prior = { doc: 'plan', question: '기존 질문', answer: '기존 답변' }
const draft = '조합 중 보존할 문서 초안'
const audits = new WeakMap<Page, { blocked: string[]; errors: string[] }>()
test.use({ serviceWorkers: 'block' })

async function mount(page: Page, baseURL: string | undefined) {
  if (!baseURL || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseURL).hostname)) throw Error('LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin
  const audit = { blocked: [] as string[], errors: [] as string[] }
  audits.set(page, audit)
  page.on('pageerror', () => audit.errors.push('PAGE_ERROR'))
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || request.method() !== 'GET' || url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      audit.blocked.push(url.origin !== origin ? 'EXTERNAL' : request.method() !== 'GET' ? 'MUTATION' : 'API')
      return route.abort('blockedbyclient')
    }
    return route.continue()
  })
  await page.context().routeWebSocket('**', socket => {
    const url = new URL(socket.url())
    const hmr = url.origin === origin.replace(/^http/, 'ws') && url.pathname === '/' && url.searchParams.has('token')
      && [...url.searchParams.keys()].every(key => key === 'token')
    if (!hmr) audit.blocked.push('WEBSOCKET')
    socket.close()
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, other, draft, prior }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: owner, homeDraft: '홈 별도 초안', sessions: [owner, other].map(id => ({
      id, title: id, renamed: true, idea: id, draft: `${id} 대화 별도 초안`, pair: 'BTC/USDT', mode: 'dip', phase: 'plan',
      timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'research', researchStatus: '초안', turns: [], updatedAt: 1,
    })) }))
    for (const id of [owner, other]) {
      sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 0, status: 'idle', view: 'plan', questions: [], clockVersion: 1 }))
      sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active: 'plan', tabs: ['plan'],
        drafts: { plan: id === owner ? draft : '다른 방 미전송 초안' }, rowDrafts: {}, replies: [prior], positions: {}, edits: {}, paper: false, paused: false }))
    }
    Object.assign(window, { __researchImeOther: sessionStorage.getItem(`teth-client-research-documents:${other}`) })
  }, { owner, other, draft, prior })
  await page.goto('/')
  await expect(page.locator('.client-restored-research')).toBeVisible()
  const field = page.getByLabel('연구 계획에 질문', { exact: true })
  await expect(field).toHaveValue(draft)
  await field.focus()
  await field.evaluate(node => Object.assign(window, { __researchImeField: node }))
  return field
}

async function preserved(page: Page, expectedDraft: string, addedReplies: number) {
  const field = page.getByLabel('연구 계획에 질문', { exact: true })
  await expect(field).toHaveValue(expectedDraft)
  await expect(field).toBeFocused()
  expect(await field.evaluate(node => node === Reflect.get(window, '__researchImeField'))).toBe(true)
  await expect(page.locator('.rw-thread .rw-answer')).toHaveCount(1 + addedReplies)
  await expect(page.locator('.rw-thread .rw-answer').first()).toHaveText(prior.answer)
  const snapshot = await page.evaluate(({ owner, other }) => ({
    docs: JSON.parse(sessionStorage.getItem(`teth-client-research-documents:${owner}`)!),
    otherUnchanged: sessionStorage.getItem(`teth-client-research-documents:${other}`) === Reflect.get(window, '__researchImeOther'),
    experience: JSON.parse(sessionStorage.getItem('teth-client-experience')!),
  }), { owner, other })
  expect(snapshot.docs.drafts.plan).toBe(expectedDraft)
  expect(snapshot.docs.replies).toHaveLength(1 + addedReplies)
  expect(snapshot.docs.replies[0]).toEqual(prior)
  expect(snapshot.otherUnchanged).toBe(true)
  expect(snapshot.experience.currentId).toBe(owner)
  expect(snapshot.experience.homeDraft).toBe('홈 별도 초안')
  expect(snapshot.experience.sessions.map((row: { id: string; draft: string }) => [row.id, row.draft])).toEqual([
    [owner, `${owner} 대화 별도 초안`], [other, `${other} 대화 별도 초안`],
  ])
}

test.afterEach(async ({ page }) => {
  expect(audits.get(page)).toEqual({ blocked: [], errors: [] })
})

test('research composer IME parity: falsecomposing keyCode229는 답변 추가·초안 삭제를 막는다', async ({ page, baseURL }) => {
  const field = await mount(page, baseURL)
  await field.dispatchEvent('keydown', { key: 'Enter', keyCode: 229, isComposing: false, bubbles: true, cancelable: true })
  await preserved(page, draft, 0)
})

test('research composer IME parity: Chromium 실제 조합 Enter는 문서 thread와 동일 입력을 보존한다', async ({ page, baseURL }) => {
  const field = await mount(page, baseURL)
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Input.imeSetComposition', { text: '가', selectionStart: 1, selectionEnd: 1 })
    const composingDraft = await field.inputValue()
    await field.evaluate(node => node.addEventListener('keydown', event => Object.assign(window, { __researchImeComposing: (event as KeyboardEvent).isComposing }), { once: true }))
    // 조합 중 실제 keydown만 관찰한다. Playwright press의 별도 char 이벤트는
    // 원본도 막지 않는 textarea 기본 줄바꿈이므로 이번 제출 가드와 구분한다.
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
    expect(await page.evaluate(() => Reflect.get(window, '__researchImeComposing'))).toBe(true)
    await preserved(page, composingDraft, 0)
  } finally { await cdp.detach() }
})

test('research composer IME parity: ShiftEnter는 줄바꿈만 넣고 다른 방과 thread를 보존한다', async ({ page, baseURL }) => {
  const field = await mount(page, baseURL)
  await field.press('End')
  await field.press('Shift+Enter')
  await preserved(page, `${draft}\n`, 0)
})

test('research composer IME parity: 일반 Enter는 동일 입력에서 한 번만 답변을 추가한다', async ({ page, baseURL }, info) => {
  const field = await mount(page, baseURL)
  await field.press('Enter')
  await preserved(page, '', 1)
  await expect(page.locator('.rw-thread .rw-user-message')).toHaveText([prior.question, draft])
  await expect(page.locator('.rw-thread .rw-answer').last()).toHaveText('아직 검증 결과가 없습니다. 연구를 먼저 시작하십시오.')
  await page.screenshot({ path: info.outputPath('research-composer-ime-enter.png') })
})
