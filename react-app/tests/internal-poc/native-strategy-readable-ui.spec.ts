import { expect, test, type Page } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { recoverNativeAfterJournalFailure } from './native-session-recovery-test-helpers'

test.use({ trace: 'off', video: 'off' })
test.setTimeout(30_000)
const ready = fixture.snapshots.ready
const sourceProjection = ready.draftState.projection
const snapshotWith = (projection: unknown) => ({ ...ready, draftState: { ...ready.draftState, projection } })
const doc = (page: Page) => page.getByRole('article', { name: '현재 서버 전략 초안', exact: true })
const section = (page: Page, name: string) => doc(page).getByRole('region', { name, exact: true })
const documentTab = (page: Page) => page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true })
const chatTab = (page: Page) => page.locator('.g-tabs').getByRole('button', { name: '대화', exact: true })
async function openResearchDetails(page: Page) {
  await documentTab(page).click()
  const details = page.locator('.native-plan-technical')
  await expect(details).toBeVisible()
  if (!await details.evaluate(node => (node as HTMLDetailsElement).open)) await details.locator(':scope > summary').click()
}
async function backToConversation(page: Page) {
  await page.locator('.native-research-workspace').getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
}
async function openSource(page: Page) {
  const details = doc(page).locator('.native-strategy-source')
  if (await details.evaluate(node => !(node as HTMLDetailsElement).open)) await details.locator('summary').click()
  return details.locator('pre')
}

async function native(page: Page) {
  // Synthetic approved wire fixture through the real native SDK/controller.
  // No external compiler, validator, market data or execution is certified.
  const state = { snapshot: structuredClone(ready), requests: [] as string[], posts: 0 }
  const owner = 'session_readable_fixture_0001'
  const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision, requestId: 'req_readable_fixture_0001', traceId: 'trace_readable_fixture_0001' })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, id }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { owner, id: ready.conversationId })
  page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/')) state.requests.push(`${request.method()} ${path}`) })
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"readable_session_etag_0001"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'),
    data: { sessionId: owner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null),
    data: { csrfToken: 'csrf_readable_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v3/**', route => {
    if (route.request().method() !== 'GET') { state.posts++; return route.abort('failed') }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: `"readable_conversation_etag_000${state.snapshot.conversationStateRevision}"` },
      body: JSON.stringify({ meta: meta('0.3.0', state.snapshot.conversationStateRevision), data: state.snapshot }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  return state
}

async function mount(page: Page, snapshot: unknown) {
  // Isolated presentation defenses, NOT SDK acceptance or backend authority.
  // The real client shell/CSS/composer wraps the actual document component.
  const errors: string[] = [], api: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => { api.push(new URL(route.request().url()).pathname); return route.abort('failed') })
  await page.route('**/readable-document-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div></body></html>' }))
  await page.goto('/readable-document-fixture.html')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(async initial => {
    const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/ClientServiceExperience.tsx', documentPath = '/src/internal-poc/NativeStrategyDocument.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ rp), react = reactModule.default ?? reactModule
    const dom = await import(/* @vite-ignore */ dp), { ClientServiceExperience } = await import(/* @vite-ignore */ cp), { NativeStrategyDocument } = await import(/* @vite-ignore */ documentPath), h = react.createElement
    function Host() {
      const [snapshot, setSnapshot] = react.useState(initial), [input, setInput] = react.useState('')
      Object.assign(window, { setReadableSnapshot: setSnapshot })
      return h(ClientServiceExperience, { state: { phase: 'ready', sessionState: 'AUTHENTICATED', source: 'service', input, inputDisabled: false, busy: false,
        messages: [], quickReplies: [], workflow: h('p', null, '격리 표시 시험'), outcome: null, issue: null,
        onInput: setInput, onSend: () => setInput(''), onReset: () => {}, recovery: null },
        strategyDocument: { identity: 'isolated-display-only', content: h(NativeStrategyDocument, { snapshot }) } })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  }, snapshot)
  await documentTab(page).click()
  await expect(doc(page)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return { errors, api }
}

test('native 현재 서버 초안의 RSI·진입·손절·익절 설명은 원문과 같고 읽기만으로 요청·승인하지 않는다', async ({ page }) => {
  const state = await native(page), before = [...state.requests]
  await openResearchDetails(page)
  await expect(section(page, '사용 지표')).toContainText('RSI')
  await expect(section(page, '사용 지표')).toContainText('14')
  await expect(section(page, '진입 조건')).toContainText('28')
  expect(await section(page, '진입 조건').locator('.native-rule-condition').evaluate(node => node.textContent?.replace(/\u00a0/g, ' '))).toBe('RSI (14봉, 종가, 15분봉) [rsi14] 값이 28 (지표값) 미만')
  await expect(section(page, '청산 조건')).toContainText('2%')
  await expect(section(page, '청산 조건')).toContainText('5%')
  await expect(section(page, '청산 조건').getByRole('heading', { name: '손절 거리 2%', exact: true })).toBeAttached()
  await expect(section(page, '청산 조건').getByRole('heading', { name: '익절 거리 5%', exact: true })).toBeAttached()
  await expect(await openSource(page)).toHaveText(JSON.stringify(sourceProjection, null, 2))
  await expect(doc(page).getByRole('button', { name: /승인|실행|검증/ })).toHaveCount(0)
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await backToConversation(page)
  await expect(page.getByRole('button', { name: '전략 검증', exact: true })).toBeEnabled()
  expect(state.requests).toEqual(before); expect(state.posts).toBe(0)
})

test('native 전송 전 기록 실패 후 재확인한 새 서버 revision은 조건 설명·거리 퍼센트·원문을 함께 갱신한다', async ({ page }) => {
  const state = await native(page)
  await openResearchDetails(page); await expect(section(page, '진입 조건')).toContainText('28')
  await backToConversation(page)
  state.snapshot = { ...ready, conversationStateRevision: '5', conversationStateHash: 'a'.repeat(64), draftRevision: '3', projectionHash: 'b'.repeat(64), semanticHash: 'c'.repeat(64),
    draftState: { ...ready.draftState, revision: 3, projectionHash: 'b'.repeat(64), projection: { ...sourceProjection,
      entryRules: [{ ...sourceProjection.entryRules[0], condition: { ...sourceProjection.entryRules[0].condition, right: { kind: 'number', value: '31', unit: 'index' } } }],
      exitRules: sourceProjection.exitRules.map(rule => ({ ...rule, distanceFraction: rule.kind === 'stop_loss' ? '0.03' : '0.075' })) } } }
  await recoverNativeAfterJournalFailure(page)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await openResearchDetails(page)
  await expect(doc(page)).toHaveAttribute('data-draft-revision', '3')
  await expect(section(page, '진입 조건')).toContainText('31')
  await expect(section(page, '청산 조건')).toContainText('3%')
  await expect(section(page, '청산 조건')).toContainText('7.5%')
  await expect(await openSource(page)).toHaveText(JSON.stringify(state.snapshot.draftState.projection, null, 2))
  expect(state.posts).toBe(0)
})

for (const width of [320, 1440]) test(`${width}px native 진입·청산 설명을 실제 읽는 위치에서 컴포저와 겹치지 않고 확인한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await native(page), before = [...state.requests]
  await openResearchDetails(page)
  await page.evaluate(() => document.fonts.ready)
  for (const [name, capture] of [['진입 조건', 'entry'], ['청산 조건', 'exit']]) {
    const heading = section(page, name).getByRole('heading', { name, exact: true })
    await heading.evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }))
    await expect(heading).toBeInViewport()
    const headingBox = await heading.boundingBox(), composerBox = await page.locator('.g-composer').boundingBox()
    expect(headingBox!.y + headingBox!.height).toBeLessThan(composerBox!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    if (width === 320 && capture === 'entry') {
      const phrase = await section(page, name).locator('.native-rule-condition').evaluate(node => {
        const text = node.firstChild
        if (!text || text.nodeType !== Node.TEXT_NODE) throw new Error('Expected a plain readable-condition text node')
        const value = text.textContent ?? ''
        return ['28', '(지표값)', '미만'].map(part => {
          const start = value.indexOf(part)
          if (start < 0) throw new Error(`Missing numeric phrase part: ${part}`)
          const range = document.createRange()
          range.setStart(text, start); range.setEnd(text, start + part.length)
          return { part, rects: [...range.getClientRects()].map(rect => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })) }
        })
      })
      for (const part of phrase) {
        expect(part.rects, part.part).toHaveLength(1)
        expect(part.rects[0].width).toBeGreaterThan(0)
        expect(Math.abs(part.rects[0].y - phrase[0].rects[0].y), `${part.part} must share the number's line`).toBeLessThan(1)
      }
      await testInfo.attach('numeric-phrase-320.json', { body: JSON.stringify(phrase, null, 2), contentType: 'application/json' })
    }
    await page.screenshot({ path: testInfo.outputPath(`native-readable-${capture}-${width}.png`), fullPage: true })
  }
  expect(state.requests).toEqual(before); expect(state.posts).toBe(0)
})

test('격리 표시: 선택 필드 미공급과 빈 규칙은 기본 전략을 발명하지 않는다', async ({ page }) => {
  const { market: _market, clock: _clock, positionSizing: _size, execution: _execution, ...rest } = sourceProjection
  void _market; void _clock; void _size; void _execution
  const projection = { ...rest, features: [], entryRules: [], exitRules: [] }
  const state = await mount(page, snapshotWith(projection))
  await expect(section(page, '사용 지표')).toContainText('등록된 지표가 없습니다.')
  await expect(section(page, '진입 조건')).toContainText('등록된 진입 규칙이 없습니다.')
  await expect(section(page, '청산 조건')).toContainText('등록된 청산 규칙이 없습니다.')
  await expect(section(page, '사용 지표')).not.toContainText('RSI')
  await expect(section(page, '진입 조건')).not.toContainText('28')
  await expect(section(page, '청산 조건')).not.toContainText('2%')
  await expect(await openSource(page)).toHaveText(JSON.stringify(projection, null, 2))
  expect(state.errors).toEqual([]); expect(state.api).toEqual([])
})

test('격리 표시: 평가 주기·진입 주문 미공급은 시장가나 봉 마감으로 보충하지 않는다', async ({ page }) => {
  const { clock: _clock, execution: _execution, ...projection } = sourceProjection
  void _clock; void _execution
  const state = await mount(page, snapshotWith(projection))
  const entry = section(page, '진입 조건')
  await expect(entry).toContainText('평가 시점은 미정입니다.')
  await expect(entry).not.toContainText('봉 마감 시 봉당 한 번 평가합니다.')
  await entry.locator('summary').click()
  await expect(entry.locator('dt').filter({ hasText: /^진입 주문$/ }).locator('xpath=following-sibling::dd[1]')).toHaveText('미정')
  expect(state.errors).toEqual([]); expect(state.api).toEqual([])
})

for (const mode of ['missing', 'duplicate'] as const) test(`격리 표시: ${mode} 지표 참조는 다른 지표로 추정하지 않고 명시적으로 구분한다`, async ({ page }) => {
  const projection = { ...sourceProjection, features: mode === 'missing' ? [] : [sourceProjection.features[0], { ...sourceProjection.features[0], period: 9 }] }
  const state = await mount(page, snapshotWith(projection))
  await expect(section(page, '진입 조건')).toContainText('rsi14')
  await expect(section(page, '진입 조건').locator('.native-rule-warning')).toContainText(mode === 'missing' ? '참조 대상을 찾을 수 없습니다.' : '중복된 ID로 참조 대상을 정할 수 없습니다.')
  await expect(await openSource(page)).toHaveText(JSON.stringify(projection, null, 2))
  expect(state.errors).toEqual([]); expect(state.api).toEqual([])
})

const complexProjection = () => ({ ...sourceProjection,
  features: [...sourceProjection.features, { id: 'ema20', type: 'ema', source: 'close', period: 20, timeframe: '15m' }, { id: 'sma60', type: 'sma', source: 'close', period: 60, timeframe: '15m' }],
  entryRules: [{ ...sourceProjection.entryRules[0], condition: { id: 'both', kind: 'logical', operator: 'and', conditions: [sourceProjection.entryRules[0].condition,
    { id: 'either', kind: 'logical', operator: 'or', conditions: [{ id: 'cross_up', kind: 'cross', operator: 'cross_above', left: { kind: 'feature_ref', featureId: 'ema20' }, right: { kind: 'feature_ref', featureId: 'sma60' } },
      { id: 'cross_down', kind: 'cross', operator: 'cross_below', left: { kind: 'feature_ref', featureId: 'ema20' }, right: { kind: 'feature_ref', featureId: 'sma60' } }] }] } }] })

test('격리 표시: AND 안의 OR 및 상향·하향 교차를 구분하고 숫자 조건을 유지한다', async ({ page }) => {
  const projection = complexProjection(), state = await mount(page, snapshotWith(projection))
  const entry = section(page, '진입 조건')
  await expect(entry).toContainText('28')
  await expect(entry).toContainText('EMA')
  await expect(entry).toContainText('SMA')
  await expect(entry.locator('.native-rule-condition')).toContainText(' 그리고 ')
  await expect(entry.locator('.native-rule-condition')).toContainText(' 또는 ')
  await expect(entry.locator('.native-rule-condition')).toContainText('상향 교차')
  await expect(entry.locator('.native-rule-condition')).toContainText('하향 교차')
  await expect(entry.locator('.native-rule-condition')).toHaveText(/^\(.+ 그리고 \(.+ 또는 .+\)\)$/)
  await expect(entry).not.toContainText('[object Object]')
  await expect(await openSource(page)).toHaveText(JSON.stringify(projection, null, 2))
  expect(state.errors).toEqual([]); expect(state.api).toEqual([])
})

test('격리 표시: OHLCV·rolling 지표는 공급 필드와 현재 봉 제외 조건을 보존한다', async ({ page }) => {
  const projection = { ...sourceProjection, features: [
    { id: 'volume', type: 'ohlcv', field: 'volume', timeframe: '15m' },
    { id: 'high20', type: 'rolling_max', source: 'high', period: 20, timeframe: '15m', excludeCurrent: true },
    { id: 'low60', type: 'rolling_min', source: 'low', period: 60, timeframe: '15m', excludeCurrent: true },
  ], entryRules: [] }
  const state = await mount(page, snapshotWith(projection)), features = section(page, '사용 지표')
  await expect(features).toContainText('거래량 (15분봉)')
  await expect(features).toContainText('구간 최댓값 (20봉, 고가, 15분봉, 현재 봉 제외)')
  await expect(features).toContainText('구간 최솟값 (60봉, 저가, 15분봉, 현재 봉 제외)')
  expect(state.errors).toEqual([]); expect(state.api).toEqual([])
})

test('격리 표시: SDK 밖의 과도한 깊이는 일부 조건을 완전한 설명으로 축약하지 않는다', async ({ page }) => {
  let condition: unknown = sourceProjection.entryRules[0].condition
  for (let i = 0; i < 10; i++) condition = { id: `deep_${i}`, kind: 'logical', operator: 'and', conditions: [sourceProjection.entryRules[0].condition, condition] }
  const projection = { ...sourceProjection, entryRules: [{ ...sourceProjection.entryRules[0], condition }] }
  const state = await mount(page, snapshotWith(projection)), entry = section(page, '진입 조건')
  await expect(entry.locator('.native-rule-condition')).toHaveText('조건 설명 확인 필요 · 전체 조건 원문을 확인해주세요.')
  await expect(entry.locator('.native-rule-warning')).toContainText('전체 설명을 표시하지 않았습니다.')
  await expect(await openSource(page)).toHaveText(JSON.stringify(projection, null, 2))
  expect(state.errors).toEqual([]); expect(state.api).toEqual([])
})

for (const width of [320, 1440]) test(`${width}px 격리 표시: 긴 식별자와 중첩 조건도 줄바꿈·스크롤·원문 포커스를 유지한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 })
  const projection = complexProjection(), longId = `signal_${'very_long_readable_identifier_'.repeat(8)}`
  const withLong = { ...projection, metadata: { title: '초안 조건을 함께 검토하는 상세 전략 문서', description: '서버에서 확인한 조건을 읽는 표시 시험입니다.' },
    features: [{ ...projection.features[0], id: longId }, ...projection.features.slice(1)],
    entryRules: [{ ...projection.entryRules[0], id: `entry_${longId}` }] }
  const state = await mount(page, snapshotWith(withLong))
  await section(page, '진입 조건').scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  expect(await doc(page).evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: testInfo.outputPath(`readable-rules-${width}.png`), fullPage: true })
  const pre = await openSource(page)
  await pre.focus()
  await expect(pre).toBeFocused()
  await expect(pre).toBeInViewport()
  await expect(pre).toHaveText(JSON.stringify(withLong, null, 2))
  await chatTab(page).click(); await documentTab(page).click()
  await expect(section(page, '진입 조건')).toContainText('28')
  expect(state.errors).toEqual([]); expect(state.api).toEqual([])
})
