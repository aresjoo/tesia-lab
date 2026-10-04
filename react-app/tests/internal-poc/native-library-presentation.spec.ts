import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
declare global { interface Window { libraryControls: { fail: boolean; calls: string[]; changeOwner: (owner: string) => void; changeDocument: (identity: string) => void; more: number; hold: boolean; finish: () => void; requestEdit: () => void }; chartIdentity: Element | null } }
test.setTimeout(35_000)

// Supplied UI projections only. No producer, real account or endpoint claim.
// Fixed source9fb keeps Insights in the real account menu, outside the sidebar IA.
// Consume actual source controls; never replace service state, handlers or ports.
async function sourceInsightEntry(page: Page) {
  // Guest drawer order is login→settings; the desktop rail reverses it.
  // Choose the settings action itself, never the anonymous login action.
  const settings = page.locator('[data-sidebar-action="settings"]')
  const trigger = await settings.count() ? settings : page.locator('[data-sidebar-action="account"], [data-sidebar-action="profile-settings"]').first()
  if (!await trigger.isVisible()) {
    await revealSourceNavigation(page)
    await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click()
  }
  await trigger.click()
  const entry = page.locator('.ca-settings [data-menu-action="insight"]')
  await expect(entry).toBeVisible()
  return entry
}

async function mount(page: Page, showAnalysis = true, includeBodyTag = false, nativeAccounts = true) {
  await page.route('**/library-port-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="test-root"></div></body></html>' }))
  await page.goto('/library-port-test.html')
  await page.evaluate(async ({ showAnalysis, includeBodyTag, nativeAccounts }) => {
    const refresh = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/ClientServiceExperience.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp)
    const { ClientServiceExperience } = await import(/* @vite-ignore */ cp)
    const controls = { fail: false, calls: [] as string[], changeOwner: (value: string) => { void value }, changeDocument: (value: string) => { void value }, more: 0, hold: false, finish: () => {}, requestEdit: () => {} }
    Object.assign(window, { libraryControls: controls })
    function StatefulOutcome() {
      const [count, setCount] = react.useState(0)
      return react.createElement('section', { 'data-stateful-outcome': true },
        react.createElement('input', { 'aria-label': '진행 중 인증 입력', defaultValue: '' }),
        react.createElement('button', { onClick: () => setCount((value: number) => value + 1) }, `동일 작업 확인 ${count}`))
    }
    function Host() {
      const [owner, setOwner] = react.useState('owner-a'), [input, setInput] = react.useState('')
      const [externalPending, setExternalPending] = react.useState(false)
      Reflect.set(window, 'setLibraryPending', setExternalPending)
      const [composerRequest, setComposerRequest] = react.useState(undefined)
      const [documentIdentity, setDocumentIdentity] = react.useState('research-one')
      const [connectionRequestId, setConnectionRequestId] = react.useState(null)
      const [connectionStage, setConnectionStage] = react.useState('method')
      Object.assign(window, { openConnection: setConnectionRequestId, setConnectionStage })
      controls.changeDocument = setDocumentIdentity
      controls.requestEdit = () => setComposerRequest({})
      const [activeId, setActive] = react.useState('one')
      const [records, setRecords] = react.useState([
        { id: 'one', title: '첫 번째 공급 대화', market: 'BTC', status: '완료', updatedAt: 1000, snapshot: null },
        { id: 'two', title: '두 번째 공급 대화', market: 'ETH', status: '초안', updatedAt: 2000, snapshot: null },
      ])
      controls.changeOwner = setOwner
      const mutate = async (action: string, change: () => void) => {
        controls.calls.push(action)
        if (controls.hold && (action.startsWith('select:') || action.startsWith('rename:'))) await new Promise<void>(resolve => { controls.finish = resolve })
        await new Promise(resolve => setTimeout(resolve, 100))
        if (controls.fail) throw new Error('PRIVATE_ERROR_NOT_FOR_UI')
        change()
      }
      return react.createElement(ClientServiceExperience, { nativeAccounts, accountScope: owner, composerRequest,
        connectionPresentation: connectionRequestId ? { scope: 'owner-a', identity: 'connection-one', requestId: connectionRequestId, status: 'ready', state: connectionStage === 'method'
          ? { id: 'method-one', kind: 'method', choices: [{ id: 'linked', title: '공급된 연결 방식', actionLabel: '이 방식으로 계속' }], onChoose: async (id: string) => { controls.calls.push(`connection:${id}`) } }
          : { id: 'api-one', kind: 'api', exchangeId: 'explicit-exchange', exchangeName: '공급 거래소', permissions: [], onConnect: async () => { controls.calls.push('connection:connect') } } } : undefined,
        accountPresentation: { scope: 'owner-a', identity: 'account-set', sourceLabel: '공급된 계좌', strategies: null, accounts: null,
          profile: { name: '공급된 계정 이름', email: 'supplied@example.invalid' },
          notifications: [{ id: 'one', type: 'review', title: '공급된 미확인 알림', read: false, timeLabel: '공급된 시각' }],
          ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null },
          plan: { title: '공급된 이용 플랜', sourceLabel: '이용 내역', sections: {
            plan: [{ id: 'plan', title: '공급된 플랜 상세', text: '계약된 이용 내용' }],
            rebates: [{ id: 'rebates', title: '공급된 정산 내역' }], alerts: [{ id: 'alerts', title: '공급된 알림 설정' }],
          } }, documents: [{ id: 'record1', kind: 'review', title: '공급된 거래 복기', sourceLabel: '확인된 거래', fields: [], sections: [{ id: 'summary', title: '복기 상세', text: '공급된 복기 본문' }] }],
        },
        feedbackPresentation: { scope: 'owner-a', onSubmit: async (value: { message: string }) => { controls.calls.push(`feedback:${value.message}`) } },
        insightPresentation: { scope: 'owner-a', data: { identity: 'supplied-feed', heading: '공급된 인사이트', subheading: '편집부 제공', articles: [{ slug: 'supplied-one', title: '공급된 기사 제목', sub: '공급된 소개', cat: '시장', authorName: '공급된 작성자', publishedAt: '2026-09-01T00:00:00Z', placement: 'featured', tags: ['bitcoin'], assets: [], body: [{ h: '공급된 본문', ps: ['테스트용 제공 내용입니다.'] }], shareUrl: 'https://example.test/supplied-one' }] } },
        conversationLibrary: { scope: 'owner-a', status: 'ready', records, activeId, hasMore: true, pending: externalPending,
          onSelect: (id: string) => mutate(`select:${id}`, () => setActive(id)),
          onPin: (id: string) => mutate(`pin:${id}`, () => setRecords((items: typeof records) => items.map((row: typeof records[number]) => row.id === id ? { ...row, pinned: !row.pinned } : row))),
          onRename: (id: string, title: string) => mutate(`rename:${id}`, () => setRecords((items: typeof records) => items.map((row: typeof records[number]) => row.id === id ? { ...row, title } : row))),
          onArchive: (id: string) => mutate(`archive:${id}`, () => setRecords((items: typeof records) => items.filter((row: typeof records[number]) => row.id !== id))),
          onLoadMore: async () => { controls.more++ },
        },
        researchPresentation: { scope: 'owner-a', data: { scopeId: 'research-one', status: 'running', entries: [{ id: 'observed', agent: 'Strategy Critic', state: 'warn', summary: '공급된 검토 결과' }], critic: react.createElement('p', null, '공급된 개선점 1개') } },
        strategyDocument: { identity: documentIdentity, content: react.createElement('div', { 'data-supplied-plan': true }, '공급된 전략 문서', includeBodyTag ? react.createElement('div', { 'data-short-body-tags': true, style: { display: 'flex' } }, react.createElement('span', { className: 'g-tag' }, '공급된 본문 상태'), react.createElement('span', null, '다음 문서 내용')) : null) },
        conversationNotice: react.createElement('span', { 'data-confirmed-result-status': true }, '확인된 결과 준비 상태'),
        analysis: showAnalysis ? react.createElement('input', { 'aria-label': 'singleton chart state', defaultValue: '차트 위치' }) : undefined,
        state: { phase: 'ready', sessionState: 'AUTHENTICATED', messages: [{ id: 'user-one', role: 'user', text: '기존 대화' }], input, busy: false, inputDisabled: false,
          source: 'service', recovery: null, quickReplies: [],
          workflow: react.createElement('button', { onClick: () => controls.calls.push('validate:current') }, '현재 전략 검증 실행'),
          outcome: react.createElement(StatefulOutcome), issue: null,
          onInput: setInput, onSend: async () => {}, onReset: async () => {}, onRecover: undefined, onLogout: undefined,
        },
      })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('test-root')).render(react.createElement(Host))
  }, { showAnalysis, includeBodyTag, nativeAccounts })
  await expect(page.locator('.g-thread')).toContainText('기존 대화')
}

async function openDrawer(page: Page) { await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click() }

// Utility-free is the explicit legacy nativeAccounts=false presentation, not an
// unauthenticated production state. Both variants retain the same supplied owner.
for (const nativeAccounts of [true, false]) for (const [width, height] of [[932, 430], [1024, 480], [1440, 480]]) test(`expanded native research Back focus ring ${width}x${height} utility=${nativeAccounts}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mount(page, false, true, nativeAccounts)
  const draft = '문서 저장 실패 뒤에도 유지할 질문\n두 번째 줄\n세 번째 줄'
  const longTitle = '가'.repeat(120)
  await page.locator('.g-composer textarea').fill(draft)
  await page.evaluate(() => Reflect.set(window, 'expandedNativeComposer', document.querySelector('.g-composer textarea')))
  await page.getByRole('button', { name: '대화 문서', exact: true }).click()
  const workspace = page.locator('.native-research-workspace')
  await workspace.locator('.g-title').click()
  const field = workspace.locator('.g-title-input')
  await field.fill(longTitle)
  await page.evaluate(() => { window.libraryControls.fail = true })
  for (let attempt = 0; attempt < 3; attempt++) {
    await field.press('Enter')
    await expect.poll(() => page.evaluate(() => window.libraryControls.calls.length)).toBe(attempt + 1)
    await expect(workspace.locator('.native-title-error')).toBeVisible()
    await expect(field).toBeEnabled()
    await expect(field).toBeFocused()
    await expect(field).toHaveValue(longTitle)
  }
  expect((await workspace.locator('.rw-scroll').boundingBox())!.height).toBeGreaterThanOrEqual(80)
  expect(await workspace.locator('.rw-header').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  const composer = page.locator('.g-composer textarea')
  await expect(composer).toHaveValue(draft)
  expect(await composer.evaluate(node => node === Reflect.get(window, 'expandedNativeComposer'))).toBe(true)
  expect(await composer.evaluate(node => {
    const r = node.getBoundingClientRect(), target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return r.top >= 0 && r.bottom <= innerHeight + 1 && (target === node || target !== null && node.contains(target))
  })).toBe(true)
  await field.press('Escape')
  await expect(workspace.locator('.g-title')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  const back = workspace.locator('.rw-title>button:first-child')
  await expect(back).toHaveAccessibleName('대화로 돌아가기')
  await expect(back).toBeFocused()
  expect(await back.evaluate(node => node.matches(':focus-visible'))).toBe(true)
  await back.evaluate(async node => { await Promise.all(node.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))) })
  const ring = await back.evaluate(node => {
    const r = node.getBoundingClientRect(), s = getComputedStyle(node)
    const spread = Math.max(0, parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset))
    const clip = { top: 0, left: 0, right: innerWidth, bottom: innerHeight }
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), box = parent.getBoundingClientRect()
      if (/hidden|clip|auto|scroll/.test(style.overflowY)) { clip.top = Math.max(clip.top, box.top); clip.bottom = Math.min(clip.bottom, box.bottom) }
      if (/hidden|clip|auto|scroll/.test(style.overflowX)) { clip.left = Math.max(clip.left, box.left); clip.right = Math.min(clip.right, box.right) }
    }
    return { top: r.top - spread, bottom: r.bottom + spread, left: r.left - spread, right: r.right + spread, clip, width: s.outlineWidth, color: s.outlineColor, offset: s.outlineOffset }
  })
  await info.attach('expanded-native-focus-geometry', { contentType: 'application/json', body: JSON.stringify(ring) })
  await page.screenshot({ path: info.outputPath('expanded-native-back-focus.png') })
  expect(ring.width).toBe('2px')
  expect(ring.color).toBe('rgb(91, 138, 247)')
  expect(ring.top, 'The complete keyboard focus ring must remain inside the viewport and clipping ancestors').toBeGreaterThanOrEqual(ring.clip.top - 0.5)
  expect(ring.bottom).toBeLessThanOrEqual(ring.clip.bottom + 0.5)
  expect(ring.left).toBeGreaterThanOrEqual(ring.clip.left - 0.5)
  expect(ring.right).toBeLessThanOrEqual(ring.clip.right + 0.5)
  await page.keyboard.press('Enter')
  // The workspace remains mounted while hidden so document state survives.
  await expect(workspace).toBeHidden()
  await expect(page.locator('.g-chead')).toBeVisible()
  await expect(page.locator('.g-thread')).toContainText('기존 대화')
  await expect(composer).toHaveValue(draft)
  expect(await composer.evaluate(node => node === Reflect.get(window, 'expandedNativeComposer'))).toBe(true)
  expect(await page.evaluate(() => window.libraryControls.calls)).toEqual(['rename:one', 'rename:one', 'rename:one'])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

for (const [width, height] of [[320, 360], [390, 360], [844, 390], [667, 375]]) test(`native research title rejection ${width}x${height} retains readable document and persistent draft`, async ({ page }, info) => {
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mount(page, false, true)
  await page.locator('.g-composer textarea').fill('저장 실패 뒤에도 남을 문서 질문')
  await page.evaluate(() => Reflect.set(window, 'shortResearchComposer', document.querySelector('.g-composer textarea')))
  await page.getByRole('button', { name: '대화 문서', exact: true }).click()
  const workspace = page.locator('.native-research-workspace')
  const field = workspace.locator('.g-title-input')
  await workspace.locator('.g-title').click()
  await field.fill('제목 저장이 실패해도 보존할 수정 내용')
  await page.evaluate(() => { window.libraryControls.fail = true })
  await field.press('Enter')
  const error = workspace.locator('.native-title-error')
  await expect(error).toBeVisible()
  await expect(field).toBeEnabled()
  await expect(field).toBeFocused()
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', 'fr') })
  await expect(field).toHaveValue('제목 저장이 실패해도 보존할 수정 내용')
  await expect(field).toBeFocused()
  const header = (await workspace.locator('.rw-header').boundingBox())!
  const body = (await workspace.locator('.rw-scroll').boundingBox())!
  const alert = (await error.boundingBox())!
  await info.attach('native-short-layout', { contentType: 'application/json', body: JSON.stringify(await page.evaluate(() =>
    ['.client-source-app', '.client-service-content', '.native-service-content', '.native-research-workspace', '.rw-center', '.rw-header', '.rw-heading', '.rw-tabs', '.rw-scroll', '.rw-composer-wrap', '.g-composer', '.g-composer textarea'].map(selector => {
      const node = document.querySelector(selector)
      if (!node) return { selector, missing: true }
      const rect = node.getBoundingClientRect(), style = getComputedStyle(node)
      return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height, minHeight: style.minHeight, maxHeight: style.maxHeight, padding: style.padding, overflow: style.overflow }
    }))) })
  await page.screenshot({ path: info.outputPath('native-research-rejection-short.png') })
  expect(alert.y).toBeGreaterThanOrEqual(header.y - 1)
  expect(alert.y + alert.height).toBeLessThanOrEqual(header.y + header.height + 1)
  expect(body.height, 'A failed title edit must leave at least the existing 80px document reading budget').toBeGreaterThanOrEqual(80)
  expect(await workspace.locator('.rw-header').evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'The header must not rely on horizontal scrolling').toBe(true)
  const status = (await workspace.locator('.rw-header .rw-title > .g-tag').boundingBox())!
  expect(status.width, 'The status must remain readable, not shrink into a vertical letter column').toBeGreaterThanOrEqual(100)
  expect(status.height).toBeLessThanOrEqual(32)
  expect(await workspace.locator('[data-short-body-tags] .g-tag').evaluate(node => getComputedStyle(node).order), 'Header ordering must not reorder supplied body content').toBe('0')
  const composer = workspace.locator('.g-composer textarea')
  await expect(composer).toHaveValue('저장 실패 뒤에도 남을 문서 질문')
  expect(await composer.evaluate(node => node === Reflect.get(window, 'shortResearchComposer'))).toBe(true)
  expect(await composer.evaluate(node => {
    const rect = node.getBoundingClientRect(), target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1 && (target === node || target !== null && node.contains(target))
  }), 'The persistent composer must remain inside the viewport and pointer reachable').toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  for (const control of await workspace.locator('.rw-header button').all()) {
    await control.focus()
    await expect(control).toBeFocused()
    await control.scrollIntoViewIfNeeded()
    const box = (await control.boundingBox())!
    const clip = (await workspace.locator('.rw-header').boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(clip.y - 1)
    expect(box.y + box.height).toBeLessThanOrEqual(clip.y + clip.height + 1)
    expect(await control.evaluate(node => {
      const box = node.getBoundingClientRect(), target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return target === node || target !== null && node.contains(target)
    })).toBe(true)
  }
  await field.focus()
  await expect(field).toBeEnabled()
  await page.evaluate(() => { window.libraryControls.fail = false })
  await field.press('Enter')
  await expect(workspace.locator('.g-title')).toHaveText('제목 저장이 실패해도 보존할 수정 내용')
  await expect(error).toHaveCount(0)
})

for (const target of ['composer', 'outcome'] as const) test(`delayed native title rejection preserves newer ${target} focus and the editable title`, async ({ page }) => {
  await mount(page)
  const field = page.locator('.g-chead .g-title-input')
  await page.locator('.g-chead .g-title').click()
  await field.fill('늦은 저장 실패 후 재시도할 제목')
  await page.evaluate(() => { window.libraryControls.hold = true; window.libraryControls.fail = true })
  await field.press('Enter')
  await expect(field).toBeDisabled()
  const destination = target === 'composer' ? page.locator('.g-composer textarea') : page.getByLabel('진행 중 인증 입력')
  await destination.fill('사용자가 선택한 새로운 입력')
  await page.evaluate(() => window.libraryControls.finish())
  await expect(page.locator('.g-chead .native-title-error')).toBeVisible()
  await expect(field).toBeEnabled()
  await expect(field).toHaveValue('늦은 저장 실패 후 재시도할 제목')
  await expect(destination).toBeFocused()
  await expect(destination).toHaveValue('사용자가 선택한 새로운 입력')
  await page.evaluate(() => { window.libraryControls.hold = false; window.libraryControls.fail = false })
  await field.press('Enter')
  await expect(page.locator('.g-chead .g-title')).toHaveText('늦은 저장 실패 후 재시도할 제목')
  await expect(page.locator('.g-chead .native-title-error')).toHaveCount(0)
  await expect(page.locator('.g-chead .g-title')).toBeFocused()
  expect(await page.evaluate(() => window.libraryControls.calls)).toEqual(['rename:one', 'rename:one'])
})

for (const mode of ['sync-throw', 'withdrawn'] as const) test(`native title ${mode} repeats restore focus after every failure without stealing a later input`, async ({ page }) => {
  await page.route('**/title-contract-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><body><div id="test-root"></div></body></html>' }))
  await page.goto('/title-contract-test.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/NativeConversationTitle.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp)
    const { NativeConversationTitle } = await import(/* @vite-ignore */ cp)
    const controls = { calls: 0, throws: true, allow: () => {}, withdraw: () => {} }
    Reflect.set(window, 'titleContractControls', controls)
    function Host() {
      const [enabled, setEnabled] = react.useState(true)
      controls.allow = () => { controls.throws = false; setEnabled(true) }
      controls.withdraw = () => setEnabled(false)
      return react.createElement('section', { 'data-native-title-contract': true },
        react.createElement(NativeConversationTitle, { title: '공급된 제목 계약', onSave: enabled ? () => { controls.calls++; if (controls.throws) throw new Error('SYNTHETIC_TITLE_REJECTION') } : undefined }),
        react.createElement('input', { 'aria-label': '더 최근에 선택한 입력' }))
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('test-root')).render(react.createElement(Host))
  })
  const surface = page.locator('[data-native-title-contract]')
  await surface.locator('.g-title').click()
  const field = surface.locator('.g-title-input')
  await field.fill('실패 이후에도 보존할 수정 제목')
  if (mode === 'withdrawn') await page.evaluate(() => Reflect.get(window, 'titleContractControls').withdraw())
  for (let attempt = 0; attempt < 3; attempt++) {
    await field.press('Enter')
    await expect(surface.getByRole('alert')).toBeVisible()
    await expect(field).toBeEnabled()
    await expect(field).toBeFocused()
    await expect(field).toHaveValue('실패 이후에도 보존할 수정 제목')
  }
  expect(await page.evaluate(() => Reflect.get(window, 'titleContractControls').calls)).toBe(mode === 'sync-throw' ? 3 : 0)
  const other = surface.getByLabel('더 최근에 선택한 입력')
  await other.fill('다른 입력 초안')
  await expect(other).toBeFocused()
  await expect(other).toHaveValue('다른 입력 초안')
  await page.evaluate(() => Reflect.get(window, 'titleContractControls').allow())
  await field.press('Enter')
  await expect(surface.locator('.g-title-input')).toHaveCount(0)
  await expect(surface.getByRole('alert')).toHaveCount(0)
  await expect(surface.locator('.g-title')).toBeFocused()
})

test('실제 셸의 알림 설정 왕복은 필터를 보존하고 owner 교체는 폐기한다', async ({ page }) => {
  await mount(page, false)
  const bell = page.locator('.client-account-utility .client-account-bell')
  await bell.click()
  const alerts = page.locator('[data-native-account-alerts]')
  await expect(alerts).toBeVisible()
  await alerts.getByRole('group').getByRole('button', { name: /^거래복기/ }).click()
  await alerts.getByRole('button', { name: '수신 설정', exact: true }).click()
  await expect(page.locator('.native-service-plan')).toBeVisible()
  await bell.click()
  await expect(alerts.getByRole('group').getByRole('button', { name: /^거래복기/ })).toHaveAttribute('aria-pressed', 'true')
  await page.evaluate(() => window.libraryControls.changeOwner('owner-b'))
  await page.evaluate(() => window.libraryControls.changeOwner('owner-a'))
  await bell.click()
  await expect(alerts.getByRole('group').getByRole('button', { name: /^전체/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.client-account-bell:visible')).toHaveCount(1)
})

test('대화 헤더 이름은 공급 목록과 같고 실패 시 편집 원문을 보존한 뒤 같은 콜백으로 저장한다', async ({ page }, info) => {
  await mount(page)
  const trigger = page.locator('.g-chead .g-title'), input = page.locator('.g-title-input')
  await expect(trigger).toHaveText('첫 번째 공급 대화')
  await trigger.click(); await input.fill('헤더에서 수정한 제목')
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
  await input.dispatchEvent('keydown', { key: 'Enter', keyCode: 229 })
  expect(await page.evaluate(() => window.libraryControls.calls)).toEqual([])
  await expect(input).toBeVisible()
  await page.evaluate(() => { window.libraryControls.fail = true })
  await input.press('Enter')
  await expect(page.locator('.g-chead [role="alert"]')).toBeVisible()
  await expect(input).toHaveValue('헤더에서 수정한 제목')
  await expect(page.getByText('PRIVATE_ERROR_NOT_FOR_UI')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('header-title-retry.png') })
  await page.evaluate(() => { window.libraryControls.fail = false; window.libraryControls.hold = true })
  await input.press('Enter')
  await expect(input).toBeDisabled()
  await expect(input).toHaveAttribute('aria-busy', 'true')
  await page.evaluate(() => window.libraryControls.finish())
  await expect(trigger).toHaveText('헤더에서 수정한 제목')
  await openDrawer(page)
  await expect(page.locator('.client-session').filter({ hasText: '헤더에서 수정한 제목' })).toBeVisible()
  expect(await page.evaluate(() => window.libraryControls.calls)).toEqual(['rename:one', 'rename:one'])
})

test('제목 저장 중 계정 변경 시 이전 편집·실패·초점이 새 계정에 넘어가지 않는다', async ({ page }) => {
  await mount(page)
  await page.locator('.g-chead .g-title').click()
  await page.locator('.g-title-input').fill('이전 계정 제목')
  await page.evaluate(() => { window.libraryControls.hold = true })
  await page.locator('.g-title-input').press('Enter')
  await expect(page.locator('.g-title-input')).toBeDisabled()
  await page.evaluate(() => window.libraryControls.changeOwner('owner-b'))
  const composer = page.locator('.g-composer textarea')
  await composer.fill('새 계정 질문')
  await page.evaluate(() => window.libraryControls.finish())
  await expect(page.locator('.g-chead .g-title')).not.toHaveText('이전 계정 제목')
  await expect(composer).toBeFocused()
  await expect(page.locator('.g-chead [role="alert"]')).toHaveCount(0)
})

test('다른 목록 작업이 시작되어도 편집한 제목은 사라지지 않고 나중에 저장할 수 있다', async ({ page }) => {
  await mount(page)
  await page.locator('.g-chead .g-title').click()
  const input = page.locator('.g-title-input')
  await input.fill('목록 작업 동안 보존할 제목')
  await page.evaluate(() => Reflect.get(window, 'setLibraryPending')(true))
  await input.press('Enter')
  await expect(input).toHaveValue('목록 작업 동안 보존할 제목')
  await expect(page.locator('.g-chead [role="alert"]')).toBeVisible()
  expect(await page.evaluate(() => window.libraryControls.calls)).toEqual([])
  await page.evaluate(() => Reflect.get(window, 'setLibraryPending')(false))
  await input.press('Enter')
  await expect(page.locator('.g-chead .g-title')).toHaveText('목록 작업 동안 보존할 제목')
  expect(await page.evaluate(() => window.libraryControls.calls)).toEqual(['rename:one'])
})

test('헤더 저장 중 사이드바의 같은 대화 이름 변경은 중복 발행되지 않는다', async ({ page }) => {
  await mount(page)
  await page.locator('.g-chead .g-title').click()
  await page.locator('.g-title-input').fill('첫 번째 저장 제목')
  await page.evaluate(() => { window.libraryControls.hold = true })
  await page.locator('.g-title-input').press('Enter')
  await expect(page.locator('.g-title-input')).toBeDisabled()
  await openDrawer(page)
  await page.getByRole('button', { name: '첫 번째 공급 대화 관리', exact: true }).click()
  await page.getByRole('menuitem', { name: '이름 변경', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('두 번째 저장 제목')
  await dialog.getByRole('button', { name: '이름 변경', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  expect(await page.evaluate(() => window.libraryControls.calls)).toEqual(['rename:one'])
  await page.evaluate(() => { window.libraryControls.hold = false; window.libraryControls.finish() })
  await expect(page.locator('.g-title-input')).toHaveCount(0)
  await expect(dialog.getByRole('textbox')).toHaveValue('두 번째 저장 제목')
  await dialog.getByRole('button', { name: '이름 변경', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => window.libraryControls.calls)).toEqual(['rename:one', 'rename:one'])
})

test('차트 없는 320px 대화의 긴 번역 제목 오류는 헤더 안에 들어가고 입력을 가리지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 850 })
  await mount(page, false)
  await page.locator('.g-chead .g-title').click()
  await page.locator('.g-title-input').fill('보존할 긴 제목')
  await page.evaluate(() => { window.libraryControls.fail = true })
  await page.locator('.g-title-input').press('Enter')
  await expect(page.locator('.g-chead [role="alert"]')).toBeVisible()
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', 'fr') })
  const header = (await page.locator('.g-chead').boundingBox())!, error = (await page.locator('.g-chead [role="alert"]').boundingBox())!, input = (await page.locator('.g-title-input').boundingBox())!
  expect(error.x).toBeGreaterThanOrEqual(header.x)
  expect(error.x + error.width).toBeLessThanOrEqual(header.x + header.width + 1)
  expect(error.y + error.height).toBeLessThanOrEqual(header.y + header.height + 1)
  expect(error.y).toBeGreaterThanOrEqual(input.y + input.height)
  await expect(page.locator('.g-title-input')).toHaveValue('보존할 긴 제목')
  await page.screenshot({ path: info.outputPath('header-title-320-fr.png') })
})

test('온보딩은 명시 요청으로 열리며 반환 시 대화 DOM·초안을 보존하고 owner 변경 시 비밀 입력을 제거한다', async ({ page }) => {
  await mount(page)
  await page.locator('.g-composer textarea').fill('연결 뒤 이어갈 질문')
  await page.evaluate(() => Reflect.set(window, 'composerBeforeConnection', document.querySelector('.g-composer textarea')))
  await page.evaluate(() => Reflect.get(window, 'openConnection')('request-one'))
  const connection = page.locator('.native-connection-onboarding')
  await expect(connection).toHaveAttribute('data-stage', 'method')
  await connection.getByRole('button', { name: '이 방식으로 계속', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.libraryControls.calls)).toContain('connection:linked')
  await expect(connection).toHaveAttribute('data-stage', 'method')
  await connection.getByRole('button', { name: '이전', exact: true }).click()
  await expect(connection).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue('연결 뒤 이어갈 질문')
  expect(await page.evaluate(() => Reflect.get(window, 'composerBeforeConnection') === document.querySelector('.g-composer textarea'))).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'setConnectionStage')('api'))
  await expect(connection).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'openConnection')('request-two'))
  await connection.getByLabel('API Key', { exact: true }).fill('TEST_ONLY_NOT_A_CREDENTIAL')
  await page.evaluate(() => window.libraryControls.changeOwner('owner-b'))
  await expect(connection).toHaveCount(0)
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue('연결 뒤 이어갈 질문')
  expect(await page.evaluate(() => window.libraryControls.calls)).toEqual(['connection:linked'])
})

test('원본 도움말은 서브페이지에서 열리고 대화로 돌아오면 컴포저를 가리지 않는다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('.site-help')).toHaveCount(0)
  await (await sourceInsightEntry(page)).click()
  const help = page.locator('.site-help')
  await expect(help).toBeVisible()
  await help.locator('button').last().click()
  await expect(help.locator('.site-help-pop')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(help.locator('.site-help-pop')).toHaveCount(0)
  await page.goBack()
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  await expect(help).toHaveCount(0)
})

test('전역 알림은 기존 트레이딩 알림함을 열고 다른 owner의 이름·개수를 보이지 않는다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('.client-account-utility .client-account-bell')).toHaveAccessibleName('알림, 1개 안읽음')
  await page.locator('.client-account-utility .client-account-bell').click()
  await expect(page.locator('.ctt-bottom-pane[data-tab-id="alerts"]')).toBeVisible()
  await expect(page.locator('.ctt-bottom-pane[data-tab-id="alerts"]').getByRole('button', { name: /공급된 미확인 알림/ })).toBeVisible()
  await page.evaluate(() => window.libraryControls.changeOwner('owner-b'))
  await expect(page.locator('.client-account-utility .client-account-bell')).toHaveAccessibleName('알림')
  await expect(page.getByRole('button', { name: /공급된 미확인 알림/ })).toHaveCount(0)
  await openDrawer(page)
  await expect(page.locator('.client-profile-settings')).not.toContainText('공급된 계정 이름')
})

test('연구 화면의 결과 상태가 보이며 같은 owner라도 이전 문서 입력은 차단한다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '대화 문서', exact: true }).click()
  await expect(page.locator('.native-research-workspace [data-confirmed-result-status]')).toBeVisible()
  await page.evaluate(() => window.libraryControls.changeDocument('research-two'))
  await expect(page.locator('.native-research-workspace')).toHaveCount(0)
  await expect(page.getByText('공급된 개선점 1개', { exact: true })).toHaveCount(0)
})

test('연구 문서에서도 검증·인증 조작부를 같은 인스턴스로 유지한다', async ({ page }) => {
  await mount(page)
  await page.getByRole('textbox', { name: '진행 중 인증 입력' }).fill('작성 중 인증 값')
  await page.getByRole('button', { name: '동일 작업 확인 0', exact: true }).click()
  await page.evaluate(() => Reflect.set(window, 'savedOutcome', document.querySelector('[data-stateful-outcome]')))
  await page.getByRole('button', { name: '대화 문서', exact: true }).click()
  await expect(page.getByRole('button', { name: '현재 전략 검증 실행', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '진행 중 인증 입력' })).toHaveValue('작성 중 인증 값')
  await page.getByRole('button', { name: '현재 전략 검증 실행', exact: true }).click()
  await page.getByRole('button', { name: '동일 작업 확인 1', exact: true }).click()
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.getByRole('button', { name: '동일 작업 확인 2', exact: true })).toBeVisible()
  await expect(page.locator('[data-stateful-outcome]')).toHaveCount(1)
  expect(await page.evaluate(() => Reflect.get(window, 'savedOutcome') === document.querySelector('[data-stateful-outcome]'))).toBe(true)
  expect(await page.evaluate(() => window.libraryControls.calls)).toEqual(['validate:current'])
})

test('공급 목록 고정·이름변경 실패/재시도·보관은 원본 UI와 확인된 콜백을 사용한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page); await openDrawer(page)
  await page.getByRole('button', { name: '첫 번째 공급 대화 관리', exact: true }).click()
  await page.getByRole('menuitem', { name: '고정', exact: true }).click()
  await expect(page.locator('.client-session').filter({ hasText: '첫 번째 공급 대화' }).getByLabel('고정됨')).toBeVisible()
  await page.getByRole('button', { name: '첫 번째 공급 대화 관리', exact: true }).click()
  await page.getByRole('menuitem', { name: '이름 변경', exact: true }).click()
  await page.getByRole('textbox', { name: '연구 이름', exact: true }).fill('수정한 제목')
  await page.evaluate(() => { window.libraryControls.fail = true })
  await page.getByRole('dialog').getByRole('button', { name: '이름 변경', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('다시 시도')
  await expect(page.getByRole('textbox', { name: '연구 이름', exact: true })).toHaveValue('수정한 제목')
  await expect(page.getByText('PRIVATE_ERROR_NOT_FOR_UI')).toHaveCount(0)
  await page.evaluate(() => { window.libraryControls.fail = false })
  await page.getByRole('dialog').getByRole('button', { name: '이름 변경', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: '수정한 제목 관리', exact: true }).click()
  await page.getByRole('menuitem', { name: '목록에서 보관', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('중단하거나 삭제하지 않습니다')
  await page.getByRole('dialog').getByRole('button', { name: '목록에서 보관', exact: true }).click()
  await expect(page.getByRole('button', { name: '수정한 제목 관리', exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('계정 변경은 목록과 열린 모달을 격리하고 자동 전체조회하지 않는다', async ({ page }) => {
  await mount(page); await openDrawer(page)
  await page.getByRole('button', { name: '기록 더 보기', exact: true }).click()
  expect(await page.evaluate(() => window.libraryControls.more)).toBe(1)
  await page.getByRole('button', { name: '첫 번째 공급 대화 관리', exact: true }).click()
  await page.getByRole('menuitem', { name: '이름 변경', exact: true }).click()
  await page.evaluate(() => window.libraryControls.changeOwner('owner-b'))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '첫 번째 공급 대화 관리', exact: true })).toHaveCount(0)
  await expect(page.locator('.client-sidebar-records')).toContainText('전체 연구 기록 조회는 아직 연결되지 않았습니다')
  expect(await page.evaluate(() => window.libraryControls.more)).toBe(1)
})

test('연구 문서 왕복은 실제 공급 내용만 표시하며 대화 초안과 차트 DOM을 유지한다', async ({ page }, info) => {
  await mount(page)
  await page.locator('.g-composer textarea').fill('아직 보내지 않은 질문')
  await page.evaluate(() => { window.chartIdentity = document.querySelector('[aria-label="singleton chart state"]') })
  await page.getByRole('button', { name: '대화 문서', exact: true }).click()
  await expect(page.getByText('공급된 전략 문서', { exact: true })).toBeVisible()
  await expect(page.locator('.native-research-composer-host textarea')).toHaveValue('아직 보내지 않은 질문')
  await expect(page.locator('.g-composer textarea')).toHaveCount(1)
  expect((await page.locator('.native-research-workspace .rw-center').boundingBox())!.width).toBeGreaterThan(300)
  expect((await page.locator('.native-research-composer-host textarea').boundingBox())!.width).toBeGreaterThan(180)
  await page.locator('.native-research-composer-host textarea').fill('문서를 보면서 바꾼 질문')
  await expect(page.locator('[data-supplied-plan]')).toHaveCount(1)
  if (await page.getByRole('button', { name: '연구 문서 열기', exact: true }).isVisible()) await page.getByRole('button', { name: '연구 문서 열기', exact: true }).click()
  await page.locator('.rw-artifact').filter({ hasText: '비판 검토 기록' }).click()
  await expect(page.getByText('공급된 개선점 1개', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('native-research-shell.png') })
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toHaveValue('문서를 보면서 바꾼 질문')
  expect(await page.evaluate(() => window.chartIdentity === document.querySelector('[aria-label="singleton chart state"]'))).toBe(true)
})

test('느린 기록 선택은 중복을 막고 단순 키 입력에도 확인된 선택 화면으로 돌아온다', async ({ page }) => {
  await mount(page)
  if (!(await page.getByRole('button', { name: '연구 기록', exact: true }).isVisible())) await openDrawer(page)
  await page.getByRole('button', { name: '연구 기록', exact: true }).click()
  await page.evaluate(() => { window.libraryControls.hold = true })
  await page.locator('.g-hist-row').first().click()
  await expect(page.locator('.g-hist-row').first()).toBeDisabled()
  await expect(page.locator('.g-hist-row').last()).toBeDisabled()
  await page.keyboard.press('ArrowDown')
  await page.evaluate(() => window.libraryControls.finish())
  await expect(page.locator('.g-hist-row')).toHaveCount(0)
  await expect(page.locator('.g-thread')).toContainText('기존 대화')
  expect(await page.evaluate(() => window.libraryControls.calls.filter(value => value.startsWith('select:')).length)).toBe(1)
})

test('다른 계정으로 넘어가면 이전 새 전략 확인 버튼과 인사이트 주소가 남지 않는다', async ({ page }) => {
  await mount(page)
  await (await sourceInsightEntry(page)).click()
  await expect(page).toHaveURL(/#\/insight$/)
  const newStrategy = page.locator('.client-rail-new-row button')
  if (await newStrategy.isVisible()) await newStrategy.click()
  else { await openDrawer(page); await page.locator('.client-new-strategy').click() }
  await expect(page.locator('.client-global-notice').getByRole('button', { name: '새 전략 시작', exact: true })).toBeVisible()
  await page.evaluate(() => window.libraryControls.changeOwner('owner-b'))
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
  await expect(page).not.toHaveURL(/#\/insight/)
  await expect(page.locator('.g-thread')).toContainText('기존 대화')
})

test('인사이트 서비스 라우팅은 직접 링크·뒤로·앞으로를 지원하고 초안을 보존한다', async ({ page }) => {
  await mount(page)
  await page.locator('.g-composer textarea').fill('보존할 질문')
  await (await sourceInsightEntry(page)).click()
  await expect(page).toHaveURL(/#\/insight$/)
  const article = page.locator('a[data-article="supplied-one"]').first()
  await expect(article).toHaveAttribute('href', '/library-port-test.html#/insight/supplied-one')
  await article.click()
  await expect(page).toHaveURL(/#\/insight\/supplied-one$/)
  await expect(page.getByRole('heading', { name: '공급된 본문', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/#\/insight$/)
  await expect(page.getByRole('heading', { name: '공급된 인사이트 편집부 제공', exact: true })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { name: '공급된 본문', exact: true })).toBeVisible()
  await page.goBack(); await page.goBack()
  await expect(page.locator('.g-composer textarea')).toHaveValue('보존할 질문')
})

test('계좌 직접 경로와 결제 설정 왕복은 공급 본문·대화 초안을 보존하고 owner 변경 시 제거한다', async ({ page }) => {
  await mount(page)
  await page.locator('.g-composer textarea').fill('계좌를 보며 작성한 질문')
  await page.evaluate(() => { history.pushState(null, '', '#/plan'); dispatchEvent(new Event('teth:navigate')) })
  await expect(page.getByRole('heading', { name: '공급된 플랜 상세', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/#\/settings\/billing$/)
  // The client removed PLAN tabs. Its alias now opens billing settings;
  // legacy rebate documents remain independently addressable, not a new tab.
  await page.evaluate(() => { history.pushState(null, '', '#/plan/rebates'); dispatchEvent(new Event('teth:navigate')) })
  await expect(page).toHaveURL(/#\/plan\/rebates$/)
  await expect(page.getByRole('heading', { name: '공급된 정산 내역', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: '공급된 플랜 상세', exact: true })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { name: '공급된 정산 내역', exact: true })).toBeVisible()
  await page.evaluate(() => { history.pushState(null, '', '#/review/record1'); dispatchEvent(new Event('teth:navigate')) })
  await expect(page.getByText('공급된 복기 본문', { exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: '공급된 정산 내역', exact: true })).toBeVisible()
  await page.evaluate(() => window.libraryControls.changeOwner('owner-b'))
  await expect(page).not.toHaveURL(/#\/(plan|review)/)
  await expect(page.getByText('공급된 정산 내역', { exact: true })).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue('계좌를 보며 작성한 질문')
  await page.evaluate(() => { history.pushState(null, '', '#/plan'); dispatchEvent(new Event('teth:navigate')) })
  await expect(page).toHaveURL(/#\/settings\/billing$/)
  await expect(page.locator('.client-settings-page')).toBeVisible()
  await expect(page.getByText('공급된 플랜 상세', { exact: true })).toHaveCount(0)
})

test('공유 hash 이동은 shell을 닫지 않고 브라우저 복귀시 원래 대화를 복원한다', async ({ page }) => {
  await mount(page)
  await page.locator('.g-composer textarea').fill('공유 화면 전에 쓰던 질문')
  if (!(await page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'sharing'), exact: true }).isVisible())) await openDrawer(page)
  await page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'sharing'), exact: true }).click()
  await expect(page).toHaveURL(/#\/share$/)
  await expect(page.locator('.native-strategies')).toBeVisible()
  await page.evaluate(() => { history.pushState(null, '', '#/share/t/supplied/pos'); dispatchEvent(new Event('teth:navigate')) })
  await expect(page.locator('.native-strategies')).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/#\/share$/)
  await expect(page.locator('.native-strategies')).toBeVisible()
  await page.goBack()
  await expect(page.locator('.g-composer textarea')).toHaveValue('공유 화면 전에 쓰던 질문')
})

test('연구 문서에서 확인된 초안 편집 명령은 대화 입력으로 정확히 초점을 돌려준다', async ({ page }) => {
  await mount(page)
  await page.locator('.g-composer textarea').fill('초안 편집에서 보존할 질문')
  await page.getByRole('button', { name: '대화 문서', exact: true }).click()
  await expect(page.locator('.native-research-composer-host textarea')).toBeVisible()
  await page.evaluate(() => window.libraryControls.requestEdit())
  await expect(page.locator('.native-research-workspace')).toBeHidden()
  await expect(page.locator('.g-composer textarea')).toHaveCount(1)
  await expect(page.locator('.g-composer textarea')).toHaveValue('초안 편집에서 보존할 질문')
  await expect(page.locator('.g-composer textarea')).toBeFocused()
})

test('인사이트에서 거래소로 이동 후 브라우저 뒤로가기도 원래 대화로 돌아온다', async ({ page }) => {
  await mount(page)
  await page.locator('.g-composer textarea').fill('거래소를 보고 돌아올 질문')
  await page.evaluate(() => { history.pushState(null, '', '#/insight'); dispatchEvent(new Event('teth:navigate')) })
  if (!(await page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'brokers'), exact: true }).isVisible())) await openDrawer(page)
  await page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'brokers'), exact: true }).click()
  await expect(page.locator('.native-brokers')).toBeVisible()
  await page.goBack()
  await expect(page.locator('.native-brokers')).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue('거래소를 보고 돌아올 질문')
})
