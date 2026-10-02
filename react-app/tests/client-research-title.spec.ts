import { expect, test, type Locator, type Page } from '@playwright/test'

// 원본621cbed gChead/gTitleEdit: 연구 문서에서도 제목을 직접 편집한다.
// 공개 저장 미리보기와 명시 Native callback 시험이며 실제 API 인수는 아니다.
const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
// Independent expected copy: browser preferences import JSON/DOM and cannot
// run in the Node collector. The application still loads its real dictionary.
const retry = ['요청을 완료하지 못했습니다. 다시 시도해주세요.', 'Could not complete the request. Please try again.', '処理を完了できませんでした。再試行してください。', '未能完成请求，请重试。', '無法完成要求，請重試。', 'No se pudo completar. Inténtalo de nuevo.', 'Impossible de terminer. Réessayez.']
const editTitle = ['대화 제목 수정', 'Edit conversation title', '会話のタイトルを編集', '编辑对话标题', '編輯對話標題', 'Editar título de conversación', 'Modifier le titre de la conversation']
const getConversationCopy = (language: typeof languages[number], key: 'editTitle' | 'retry') => (key === 'editTitle' ? editTitle : retry)[languages.indexOf(language)]
const publicRoot = '.client-restored-research[data-source="client-fixture"]'
const nativeRoot = '.native-research-workspace:visible'
const idea = '이름과 분리하여 보존할 원래 연구 아이디어'
const oldTitle = '이미 이름을 바꾼 연구: 원래 아이디어와 다른 제목'
const draft = '제목을 바꿔도 유지할 문서 질문 초안'
const sessionId = 'research-title-test'

async function prepare(page: Page, baseURL: string | undefined, width: number) {
  if (!baseURL) throw new Error('로컬 baseURL이 필요합니다.')
  const origin = new URL(baseURL).origin, blocked: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.setViewportSize({ width, height: width === 320 ? 844 : 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  return { blocked, errors }
}

async function publicMount(page: Page, baseURL: string | undefined, width: number) {
  const audit = await prepare(page, baseURL, width)
  await page.addInitScript(({ idea, oldTitle, draft, sessionId }) => {
    if (sessionStorage.getItem('research-title-seeded')) return
    sessionStorage.setItem('research-title-seeded', '1')
    localStorage.setItem('tethLang', 'ko'); localStorage.setItem('tethCurrency', 'USD')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: sessionId, homeDraft: '홈 원문', sessions: [{
      id: sessionId, title: oldTitle, renamed: true, idea, draft: '원래 대화 초안', pair: 'BTC/USDT', mode: 'dip',
      phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', workspace: 'research',
      researchStatus: '초안', turns: [], updatedAt: 1,
    }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${sessionId}`, JSON.stringify({ seconds: 0, status: 'idle', view: 'activity', questions: [], clockVersion: 1 }))
    sessionStorage.setItem(`teth-client-research-documents:${sessionId}`, JSON.stringify({ active: 'plan', tabs: ['plan', 'activity'],
      drafts: { plan: draft }, replies: [], rowDrafts: {}, positions: {}, edits: {}, paper: false, paused: false }))
  }, { idea, oldTitle, draft, sessionId })
  await page.goto('/')
  await expect(page.locator(publicRoot)).toBeVisible()
  await expect(page.locator(`${publicRoot} .rw-composer textarea`)).toHaveValue(draft)
  await page.evaluate(() => document.fonts.ready)
  return audit
}

async function locale(page: Page, value: string) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    ;(await import(/* @vite-ignore */ path)).setClientPreference('language', value)
  }, value)
}

async function headerFits(root: Locator) {
  const geometry = await root.locator('.rw-header').evaluate(header => {
    const box = header.getBoundingClientRect(), heading = header.querySelector('.rw-heading')!
    const r = heading.getBoundingClientRect()
    const control = heading.querySelector('input,button')!, c = control.getBoundingClientRect()
    const hit = document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2)
    return { inside: r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1,
      reachable: !!hit && (hit === control || control.contains(hit)),
      overflow: header.scrollWidth > header.clientWidth + 1,
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 }
  })
  expect(geometry).toEqual({ inside: true, reachable: true, overflow: false, pageOverflow: false })
}

for (const width of [320, 1440]) {
  test(`공개 연구 ${width}px: 저장된 제목·Enter/blur/Escape/IME와 문서·초안·원래 아이디어를 보존한다`, async ({ page, baseURL }, info) => {
    const audit = await publicMount(page, baseURL, width)
    const root = page.locator(publicRoot), trigger = root.locator('.rw-heading .g-title'), field = root.locator('.rw-heading .g-title-input')
    const composer = root.locator('.rw-composer textarea'), doc = root.locator('.g-doc'), selected = root.getByRole('tab', { selected: true })
    const composerNode = await composer.elementHandle(), docNode = await doc.elementHandle(), selectedNode = await selected.elementHandle()
    const preserved = async () => {
      await expect(composer).toHaveValue(draft)
      expect(await composer.evaluate((node, original) => node === original, composerNode)).toBe(true)
      expect(await doc.evaluate((node, original) => node === original, docNode)).toBe(true)
      expect(await selected.evaluate((node, original) => node === original, selectedNode)).toBe(true)
    }
    await expect(trigger).toHaveText(oldTitle)
    for (const lang of languages) {
      await locale(page, lang)
      await expect(trigger).toHaveAccessibleName(getConversationCopy(lang, 'editTitle'))
      await expect(trigger).toHaveText(oldTitle)
      await headerFits(root)
      await preserved()
    }
    await trigger.click(); await field.fill('IME 조합 중인 제목')
    await headerFits(root)
    expect((await field.boundingBox())!.width).toBeGreaterThan(100)
    if (width === 320) await expect(field).toHaveCSS('font-size', '16px')
    await page.screenshot({ path: info.outputPath(`public-title-edit-${width}.png`) })
    await field.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
    await field.dispatchEvent('keydown', { key: 'Enter', keyCode: 229 })
    await expect(field).toHaveValue('IME 조합 중인 제목')
    await field.press('Escape')
    await expect(trigger).toHaveText(oldTitle); await expect(trigger).toBeFocused()
    await preserved()
    await trigger.click(); await field.fill('Enter로 저장한 제목'); await field.press('Enter')
    await expect(trigger).toHaveText('Enter로 저장한 제목'); await expect(trigger).toBeFocused()
    await preserved()
    await trigger.click(); await field.fill('blur로 저장한 마지막 제목'); await composer.click()
    await expect(trigger).toHaveText('blur로 저장한 마지막 제목'); await expect(composer).toBeFocused()
    await preserved()
    await page.reload()
    await expect(trigger).toHaveText('blur로 저장한 마지막 제목')
    await expect(composer).toHaveValue(draft)
    const stored = await page.evaluate(id => {
      const record = JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions.find((row: { id: string }) => row.id === id)
      return { title: record.title, idea: record.idea, draft: record.draft, workspace: record.workspace }
    }, sessionId)
    expect(stored).toEqual({ title: 'blur로 저장한 마지막 제목', idea, draft: '원래 대화 초안', workspace: 'research' })
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}

async function nativeMount(page: Page, baseURL: string | undefined, width: number, canRename = true) {
  const audit = await prepare(page, baseURL, width)
  await page.route('**/research-title-native.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="title-root"></div></body></html>' }))
  await page.goto('/research-title-native.html')
  await page.evaluate(async ({ canRename, draft }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/ClientServiceExperience.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('동일 React 인스턴스를 찾을 수 없습니다.')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp)
    const { ClientServiceExperience } = await import(/* @vite-ignore */ cp)
    const control = { fail: false, hold: false, calls: [] as { owner: string; id: string; title: string }[],
      finish: () => {}, changeOwner: (owner: string) => { void owner } }
    Reflect.set(window, 'researchTitleHost', control)
    function Host() {
      const [owner, setOwner] = react.useState('owner-a'), [input, setInput] = react.useState(draft)
      const [titles, setTitles] = react.useState({ 'owner-a': '명시 공급 연구 제목', 'owner-b': '새 계정 연구 제목' })
      control.changeOwner = setOwner
      return react.createElement(ClientServiceExperience, { nativeAccounts: true, accountScope: owner,
        conversationLibrary: { scope: owner, status: 'ready', activeId: 'one', records: [{ id: 'one', title: titles[owner], market: 'BTC', status: '초안', updatedAt: 1000, snapshot: null }], hasMore: false,
          onRename: canRename ? async (id: string, title: string) => {
            const captured = owner
            control.calls.push({ owner: captured, id, title })
            if (control.hold) await new Promise<void>(resolve => { control.finish = resolve })
            if (control.fail) throw new Error('PRIVATE_RENAME_ERROR')
            setTitles((old: Record<string, string>) => ({ ...old, [captured]: title }))
          } : undefined,
        },
        researchPresentation: { scope: owner, data: { scopeId: `plan-${owner}`, status: 'unavailable', entries: [],
          critic: react.createElement('p', null, '명시 공급 Critic 원문') } },
        strategyDocument: { identity: `plan-${owner}`, content: react.createElement('p', { 'data-title-plan': true }, '제목과 별개인 원래 전략 문서') },
        state: { phase: 'ready', sessionState: 'AUTHENTICATED', messages: [{ id: 'user-one', role: 'user', text: '연구 문서 보기' }],
          input, busy: false, inputDisabled: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
          onInput: setInput, onSend: async () => {}, onReset: async () => {}, onRecover: undefined, onLogout: undefined },
      })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('title-root')).render(react.createElement(Host))
  }, { canRename, draft })
  await page.locator('[data-native-open-research]').click()
  await expect(page.locator(nativeRoot)).toBeVisible()
  await expect(page.locator(`${nativeRoot} textarea`)).toHaveValue(draft)
  await page.evaluate(() => document.fonts.ready)
  return audit
}

test('공개 연구의 비어 있는 저장 제목은 번역된 기본 제목으로 표시하고 원래 아이디어를 바꾸지 않는다', async ({ page, baseURL }) => {
  const audit = await publicMount(page, baseURL, 320)
  // Simulate an existing valid record with no name before the next mount;
  // disable the old document's flush so it cannot overwrite this fixture.
  await page.goto('/about')
  await page.evaluate(id => {
    const snapshot = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
    snapshot.sessions.find((row: { id: string }) => row.id === id).title = ' '
    sessionStorage.setItem('teth-client-experience', JSON.stringify(snapshot))
  }, sessionId)
  await page.goto('/')
  const trigger = page.locator(`${publicRoot} .rw-heading .g-title`)
  await expect(trigger).toHaveText('새 전략')
  await trigger.click()
  await page.locator(`${publicRoot} .g-title-input`).press('Escape')
  expect(await page.evaluate(id => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions.find((row: { id: string }) => row.id === id).idea, sessionId)).toBe(idea)
  expect(audit).toEqual({ blocked: [], errors: [] })
})

for (const width of [320, 860]) {
  test(`공개 로그인 연구 ${width}px: 로드 순서와 무관하게 알림·제목·문서 열기가 서로 가리지 않는다`, async ({ page, baseURL }, info) => {
    await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 계정', email: 'review@example.test' })))
    const audit = await publicMount(page, baseURL, width)
    const root = page.locator(publicRoot), header = root.locator('.rw-header')
    await expect(page.locator('.client-account-utility')).toBeVisible()
    // This stylesheet is also a lazy dependency. Header protection must not
    // depend on its injection order relative to the main shell's styles.
    await page.evaluate(() => {
      const style = document.querySelector('style[data-vite-dev-id$="/src/client-restored-research.css"]')
      if (!style) throw new Error('Missing actual research stylesheet')
      style.parentElement!.append(style)
    })
    await expect(header).toHaveCSS('padding-right', '72px')
    await headerFits(root)
    await root.getByRole('button', { name: '연구 문서 열기', exact: true }).click()
    await expect(root.locator('.rw-aux')).toBeVisible()
    await root.getByRole('button', { name: '연구 문서 닫기', exact: true }).click()
    await expect(root.locator('.rw-aux')).not.toBeVisible()
    await root.locator('.rw-heading .g-title').click()
    await headerFits(root)
    await expect(root.locator('.g-title-input')).toHaveValue(oldTitle)
    expect((await root.locator('.g-title-input').boundingBox())!.width).toBeGreaterThan(170)
    await page.screenshot({ path: info.outputPath(`signed-in-title-${width}.png`) })
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}

for (const width of [320, 1440]) {
  test(`Native 연구 ${width}px: 명시 rename 실패·재시도·중복잠금과 7언어에서도 같은 문서·입력을 보존한다`, async ({ page, baseURL }, info) => {
    const audit = await nativeMount(page, baseURL, width)
    const root = page.locator(nativeRoot), trigger = root.locator('.rw-heading .g-title'), field = root.locator('.rw-heading .g-title-input')
    const composer = root.locator('textarea'), composerNode = await composer.elementHandle()
    const doc = root.locator('[data-title-plan]'), docNode = await doc.elementHandle()
    const selected = root.getByRole('tab', { selected: true }), selectedNode = await selected.elementHandle()
    await expect(trigger).toHaveText('명시 공급 연구 제목')
    await trigger.click(); await field.fill('재시도할 연구 제목')
    await field.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
    expect(await page.evaluate(() => Reflect.get(window, 'researchTitleHost').calls)).toEqual([])
    await page.evaluate(() => { Reflect.get(window, 'researchTitleHost').fail = true })
    await field.press('Enter')
    await expect(root.locator('.rw-heading [role="alert"]')).toBeVisible()
    await expect(field).toHaveValue('재시도할 연구 제목')
    await expect(page.getByText('PRIVATE_RENAME_ERROR')).toHaveCount(0)
    for (const lang of languages) {
      await locale(page, lang)
      await expect(field).toHaveAccessibleName(getConversationCopy(lang, 'editTitle'))
      await expect(root.locator('.rw-heading [role="alert"]')).toHaveText(getConversationCopy(lang, 'retry'))
      await headerFits(root)
      const errorBox = (await root.locator('.rw-heading [role="alert"]').boundingBox())!
      const fieldBox = (await field.boundingBox())!
      expect(fieldBox.width).toBeGreaterThan(170)
      const headerBox = (await root.locator('.rw-header').boundingBox())!
      expect(fieldBox.y - headerBox.y).toBeGreaterThanOrEqual(5)
      expect(errorBox.y).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height)
    }
    await page.screenshot({ path: info.outputPath(`native-title-error-${width}.png`) })
    await page.evaluate(() => { Object.assign(Reflect.get(window, 'researchTitleHost'), { fail: false, hold: true }) })
    await field.press('Enter')
    await expect(field).toBeDisabled(); await expect(field).toHaveAttribute('aria-busy', 'true')
    await field.dispatchEvent('keydown', { key: 'Enter' }); await field.dispatchEvent('blur')
    expect(await page.evaluate(() => Reflect.get(window, 'researchTitleHost').calls)).toEqual([
      { owner: 'owner-a', id: 'one', title: '재시도할 연구 제목' }, { owner: 'owner-a', id: 'one', title: '재시도할 연구 제목' },
    ])
    await page.evaluate(() => Reflect.get(window, 'researchTitleHost').finish())
    await expect(trigger).toHaveText('재시도할 연구 제목')
    await expect(root.locator('.rw-heading [role="alert"]')).toHaveCount(0)
    await expect(composer).toHaveValue(draft)
    expect(await composer.evaluate((node, original) => node === original, composerNode)).toBe(true)
    expect(await doc.evaluate((node, original) => node === original, docNode)).toBe(true)
    expect(await selected.evaluate((node, original) => node === original, selectedNode)).toBe(true)
    expect(audit).toEqual({ blocked: [], errors: [] })
  })

  test(`Native 연구 ${width}px: rename 포트 없으면 제목은 읽을 수 있지만 편집을 시작하지 않는다`, async ({ page, baseURL }) => {
    const audit = await nativeMount(page, baseURL, width, false)
    const root = page.locator(nativeRoot)
    await expect(root.locator('.rw-heading .g-title')).toHaveText('명시 공급 연구 제목')
    await expect(root.locator('.rw-heading .g-title')).toBeDisabled()
    await expect(root.locator('.g-title-input')).toHaveCount(0)
    expect(await page.evaluate(() => Reflect.get(window, 'researchTitleHost').calls)).toEqual([])
    expect(audit).toEqual({ blocked: [], errors: [] })
  })

  test(`Native 연구 ${width}px: 저장 대기 중 scope 교체는 이전 제목·오류·늦은 초점을 새 계정으로 넘기지 않는다`, async ({ page, baseURL }) => {
    const audit = await nativeMount(page, baseURL, width)
    const root = page.locator(nativeRoot)
    await root.locator('.rw-heading .g-title').click()
    await root.locator('.g-title-input').fill('이전 계정의 늦은 제목')
    await page.evaluate(() => { Object.assign(Reflect.get(window, 'researchTitleHost'), { hold: true, fail: true }) })
    await root.locator('.g-title-input').press('Enter')
    await expect(root.locator('.g-title-input')).toBeDisabled()
    await page.evaluate(() => Reflect.get(window, 'researchTitleHost').changeOwner('owner-b'))
    // 실제 셸의 owner 교체는 연구를 닫을 수 있으므로 보이는 정식 진입으로 재개한다.
    const open = page.locator('[data-native-open-research]:visible')
    if (await open.isVisible()) await open.click()
    await expect(root.locator('.rw-heading .g-title')).toHaveText('새 계정 연구 제목')
    const composer = root.locator('textarea')
    await composer.fill('새 계정에서 작성한 초안')
    await page.evaluate(() => Reflect.get(window, 'researchTitleHost').finish())
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(root.locator('.rw-heading .g-title')).toHaveText('새 계정 연구 제목')
    await expect(root.locator('.rw-heading [role="alert"]')).toHaveCount(0)
    await expect(composer).toHaveValue('새 계정에서 작성한 초안'); await expect(composer).toBeFocused()
    expect(await page.evaluate(() => Reflect.get(window, 'researchTitleHost').calls)).toEqual([{ owner: 'owner-a', id: 'one', title: '이전 계정의 늦은 제목' }])
    expect(audit).toEqual({ blocked: [], errors: [] })
  })
}
