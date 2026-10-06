import { expect, test } from '@playwright/test'
import conversationFixture from './fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
test.beforeEach(async ({ page }, info) => {
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 320 : 1440, height: 900 })
  await page.route('**/*', route => {
    const req = route.request(), url = new URL(req.url())
    return url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/') && ['GET', 'HEAD'].includes(req.method()) ? route.continue() : route.abort('blockedbyclient')
  })
  await page.route('**/execution-locale.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body style="margin:0"><div id="fixture"></div></body></html>' }))
})

test('native execution locale: actual service loading and error boundary retain seven language messages and no server action', async ({ page }) => {
  let release: () => void = () => {}, requested = 0
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/src/internal-poc/ClientServiceExperience.tsx', async route => { requested++; await held; await route.abort('failed') })
  await page.goto('/execution-locale.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const pp = '/src/client-preferences.ts', source = await (await fetch(pp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(rp), react = rm.default ?? rm, dp = '/@id/react-dom/client', dom = await import(dp), cp = '/src/internal-poc/ClientServiceBoundary.tsx', { ClientServiceBoundary } = await import(cp)
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(react.createElement(ClientServiceBoundary, { state: {} }))
  })
  const loading = ['화면을 준비하고 있습니다.', 'Preparing the screen.', '画面を準備しています。', '正在准备页面。', '正在準備頁面。', 'Preparando la pantalla.', 'Préparation de l’écran.']
  const reload = ['화면 다시 불러오기', 'Reload screen', '画面を再読み込み', '重新加载页面', '重新載入頁面', 'Recargar pantalla', 'Recharger l’écran']
  for (const [i, language] of locales.entries()) {
    await page.evaluate(async lang => { const p = '/src/client-preferences.ts'; (await import(p)).setClientPreference('language', lang) }, language)
    await expect(page.getByRole('status')).toHaveText(loading[i])
  }
  release()
  await expect(page.getByRole('alert')).toBeVisible()
  for (const [i, language] of locales.entries()) {
    await page.evaluate(async lang => { const p = '/src/client-preferences.ts'; (await import(p)).setClientPreference('language', lang) }, language)
    await expect(page.getByRole('button')).toHaveText(reload[i])
    if (language !== 'ko') await expect(page.getByRole('alert')).not.toContainText(/[가-힣]/)
  }
  expect(requested).toBe(1)
})

test('native execution locale: Paper and structural headers blocked messages and close actions localize without authority calls', async ({ page }) => {
  let apiCalls = 0
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls++ })
  await page.goto('/execution-locale.html')
  const approval = conversationFixture.documents.find(item => item.name === 'approval')!.value
  await page.evaluate(async supplied => {
    const refresh = '/@react-refresh', runtime = (await import(refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const pp = '/src/client-preferences.ts', source = await (await fetch(pp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(rp), react = rm.default ?? rm, dp = '/@id/react-dom/client', dom = await import(dp), paper = '/src/internal-poc/NativePaperPanel.tsx', smoke = '/src/internal-poc/NativeStructuralSmokePanel.tsx'
    const { NativePaperPanel } = await import(paper), { NativeStructuralSmokePanel } = await import(smoke)
    const scope = { sessionId: 'session_native_smoke_ui_0001', strategyVersionId: supplied.strategyVersionId, semanticHash: supplied.semanticHash, strategyVersionContentHash: supplied.strategyVersionContentHash }
    const calls: string[] = [], h = react.createElement
    Object.assign(window, { executionLocaleCalls: calls })
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h('div', null,
      h('div', { id: 'paper' }, h(NativePaperPanel, { scope, isCurrent: () => false, verifyOwner: async () => { calls.push('paper-verify'); return '' }, onClose: () => calls.push('paper-close') })),
      h('div', { id: 'smoke' }, h(NativeStructuralSmokePanel, { binding: { sessionId: scope.sessionId, strategyVersionId: scope.strategyVersionId, semanticHash: scope.semanticHash, profileContentHash: 'ef6bc3100d735654f2b933fee9ac6dd71883ab6bec07385f29b1412d87e96497' }, isCurrent: () => false, verifyOwner: async () => { calls.push('smoke-verify') }, onClose: () => calls.push('smoke-close') }))))
  }, approval)
  await expect(page.locator('#paper [role=alert]')).toBeVisible()
  await page.locator('#smoke .primary-button').click()
  await expect(page.locator('#smoke [role=alert]')).toBeVisible()
  const paperTitle = ['기록 Paper', 'Recorded Paper', '記録Paper', '记录 Paper', '記錄 Paper', 'Paper registrado', 'Paper enregistré']
  const smokeTitle = ['합성 구조 시험', 'Synthetic structural test', '合成構造テスト', '合成结构测试', '合成結構測試', 'Prueba estructural sintética', 'Test structurel synthétique']
  const section = await page.locator('#smoke section').first().elementHandle()
  for (const [i, language] of locales.entries()) {
    await page.evaluate(async lang => { const p = '/src/client-preferences.ts'; (await import(p)).setClientPreference('language', lang) }, language)
    await expect(page.locator('#paper h2')).toHaveText(paperTitle[i])
    await expect(page.locator('#smoke h2')).toHaveText(smokeTitle[i])
    await expect(page.locator('#paper')).toContainText(approval.strategyVersionId)
    if (language !== 'ko') { await expect(page.locator('#paper')).not.toContainText(/[가-힣]/); await expect(page.locator('#smoke')).not.toContainText(/[가-힣]/) }
    expect(await page.locator('#smoke section').first().evaluate((node, saved) => node === saved, section)).toBe(true)
  }
  await page.locator('#paper button').first().click()
  await page.locator('#smoke button').first().click()
  expect(await page.evaluate(() => Reflect.get(window, 'executionLocaleCalls'))).toEqual(['paper-close', 'smoke-close'])
  expect(apiCalls).toBe(0)
})

test('native execution locale: actual Native Paper child catalog selection and queued state retain seven locales and exact request', async ({ page }) => {
  const approval = conversationFixture.documents.find(item => item.name === 'approval')!.value
  const fixtureId = 'paper_fixture_compiler_rsi14_btcusdt_15m_01'
  const posts: unknown[] = [], requests: string[] = []
  await page.route('**/internal/poc/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    requests.push(`${request.method()} ${path}`)
    const catalog = path.endsWith('/market-artifacts')
    if (request.method() === 'POST') posts.push(request.postDataJSON())
    return route.fulfill({ contentType: 'application/json', status: catalog ? 200 : 201, body: JSON.stringify({
      meta: { internalContractVersion: 'owner-local-paper-api/0.1', requestId: 'req_native_paper_fixture_01', traceId: 'trace_native_paper_fixture_01', resourceRevision: catalog ? null : '1' },
      data: catalog ? { artifacts: [{ fixtureId, dataClass: 'SYNTHETIC_RECORDED_MARKET_FIXTURE', symbol: 'BTCUSDT', sourceTimeframe: '1m', evaluationTimeframe: '15m', eventCount: 16, firstOpenTime: '2026-01-01T00:00:00Z', lastCloseTime: '2026-01-01T03:45:00Z', fileSha256: 'a'.repeat(64), contentHash: 'b'.repeat(64), provenanceHash: 'c'.repeat(64), policyHash: 'd'.repeat(64), manifestSha256: null, privateOnly: true, verified: false, verificationStatus: 'SYNTHETIC_ONLY' }] }
        : { paperSessionId: 'paper_session_native_0001', strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash, fixtureId, state: 'QUEUED', revision: '1', attempt: '0', createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z', resultAvailable: false, provenance: { dataClass: 'SYNTHETIC_RECORDED_MARKET_FIXTURE', verified: false, privateOnly: true } },
    }) })
  })
  await page.goto('/execution-locale.html')
  await page.evaluate(async supplied => {
    const refresh = '/@react-refresh', runtime = (await import(refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const css = '/src/internal-poc/internal-poc.css'; await import(css)
    const pp = '/src/client-preferences.ts', source = await (await fetch(pp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(rp), react = rm.default ?? rm, dp = '/@id/react-dom/client', dom = await import(dp), path = '/src/internal-poc/NativePaperPanel.tsx', { NativePaperPanel } = await import(path)
    const calls: boolean[] = []; Object.assign(window, { paperLocaleVerifyCalls: calls })
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(react.createElement(NativePaperPanel, { scope: { sessionId: 'session_paper_fixture_0001', strategyVersionId: supplied.strategyVersionId, semanticHash: supplied.semanticHash, strategyVersionContentHash: supplied.strategyVersionContentHash }, isCurrent: () => true, verifyOwner: async (mutation: boolean) => { calls.push(mutation); return 'csrf_native_paper_fixture_0001' }, onClose: () => {} }))
  }, approval)
  const picker = page.locator('.paper-artifact-picker'), panel = page.locator('.paper-session')
  await expect(picker.getByRole('radio')).toHaveCount(1)
  await picker.getByRole('radio').check()
  const radio = await picker.getByRole('radio').elementHandle()
  const headings = ['Paper 입력 artifact 선택', 'Select Paper input artifact', 'Paper 入力アーティファクトを選択', '选择 Paper 输入工件', '選擇 Paper 輸入工件', 'Seleccionar artefacto de entrada de Paper', "Sélectionner l'artefact d'entrée de Paper"]
  const before = await page.evaluate(() => Reflect.get(window, 'paperLocaleVerifyCalls'))
  for (const [i, language] of locales.entries()) {
    await page.evaluate(async lang => { const p = '/src/client-preferences.ts'; (await import(p)).setClientPreference('language', lang) }, language)
    await expect(picker.locator('h3')).toHaveText(headings[i])
    await expect(picker.getByRole('radio')).toBeChecked()
    expect(await picker.getByRole('radio').evaluate((node, saved) => node === saved, radio)).toBe(true)
    if (language !== 'ko') await expect(panel).not.toContainText(/[가-힣]/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  }
  expect(await page.evaluate(() => Reflect.get(window, 'paperLocaleVerifyCalls'))).toEqual(before)
  expect(posts).toEqual([])
  await page.evaluate(async () => { const p = '/src/client-preferences.ts'; (await import(p)).setClientPreference('language', 'ko') })
  await panel.getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect(panel).toContainText('서버 상태 revision 1 · attempt 0')
  expect(posts).toEqual([{ strategyVersionId: approval.strategyVersionId, expectedSemanticHash: approval.semanticHash, fixtureId }])
  const after = [...requests], afterVerify = await page.evaluate(() => Reflect.get(window, 'paperLocaleVerifyCalls'))
  for (const language of locales) {
    await page.evaluate(async lang => { const p = '/src/client-preferences.ts'; (await import(p)).setClientPreference('language', lang) }, language)
    await expect(panel).toContainText('revision 1')
    await expect(panel).toContainText('attempt 0')
    if (language !== 'ko') await expect(panel).not.toContainText(/[가-힣]/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  }
  expect(requests).toEqual(after)
  expect(await page.evaluate(() => Reflect.get(window, 'paperLocaleVerifyCalls'))).toEqual(afterVerify)
})

test('native execution locale: supplied Paper result safe errors and customer artifact names retain raw facts across seven locales', async ({ page }) => {
  await page.goto('/execution-locale.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const css = '/src/internal-poc/internal-poc.css'; await import(css)
    const pp = '/src/client-preferences.ts', source = await (await fetch(pp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(rp), react = rm.default ?? rm, dp = '/@id/react-dom/client', dom = await import(dp)
    const panelPath = '/src/internal-poc/PaperSessionPanel.tsx', pickerPath = '/src/internal-poc/PaperMarketArtifactPicker.tsx', provenancePath = '/src/internal-poc/paper-session.ts'
    const { PaperSessionPanel } = await import(panelPath), { PaperMarketArtifactPicker } = await import(pickerPath), { RECORDED_PAPER_PROVENANCE } = await import(provenancePath)
    const requestedStrategy = { strategyVersionId: 'sv_fixture_00000001', semanticHash: '39cbfd0090218a159ae03ef11e9d686482a644772dab291b03b864658caf2e46' }
    // Existing local-paper-api-adapter fixture values, not market/provider evidence.
    const snapshot = { artifactVersion: 'paper-session-view/1', sessionId: 'paper_session_local_00000001', viewSource: 'OWNER_LOCAL_API', stage: 'COMPLETED_LOCAL_FIXTURE_ONLY', requestedStrategy, recordedStrategy: requestedStrategy, fixtureId: 'paper_fixture_compiler_rsi14_btcusdt_15m_01', provenance: RECORDED_PAPER_PROVENANCE,
      strategyCoverage: { entryRuleEvaluated: true, riskLimitsApplied: true, exitRulesEvaluated: false, unevaluatedExitRuleIds: ['exit_stop', 'exit_take'] },
      externalEffects: { evidenceKind: 'STATIC_OFFLINE_CAPABILITY_BOUNDARY', networkCalls: 0, exchangeCalls: 0, credentialReads: 0, orders: 0 },
      execution: { evaluationCandleCount: 16, recordedMarketEventCount: 2, signalCount: 1, intentCount: 1, fillCount: 1, signalHash: 'a'.repeat(64), orderIntentHash: 'b'.repeat(64), fillHashes: ['c'.repeat(64)], ledger: { initialWallet: '1000', markPrice: '78', wallet: '999.95062500', equity: '998.70062500', quantity: '1.25', averageEntry: '79.0', realizedPnl: '0', unrealizedPnl: '-1.250', fees: '0.04937500', funding: '0' } },
      restart: { firstCheckpointRevision: 1, terminalCheckpointRevision: 2, fencingToken: 2, duplicateIntentCount: 1, duplicateEventCount: 1, newFillCountAfterDuplicateReplay: 0 }, fixtureFileSha256: 'd'.repeat(64), ledgerHash: 'e'.repeat(64), replayEqual: true, replayHash: 'f'.repeat(64), reportHash: '1'.repeat(64) }
    const calls: string[] = []; Object.assign(window, { suppliedPaperLocaleCalls: calls })
    const adapter = { kind: 'owner-local-api', readActive: async () => { calls.push('result-read'); return { snapshot, recoverySource: 'ACTIVE_PAPER' } }, resetLocalView: () => calls.push('reset') }
    const errorAdapter = { kind: 'owner-local-api', readActive: async () => { calls.push('error-read'); throw new Error('PAPER_API_DATA_INVALID') }, resetLocalView: () => calls.push('error-reset') }
    const artifact = { artifactId: 'paper_fixture_owner_btcusdt_15m_0001', displayName: '내 로컬 BTCUSDT 기록', source: 'OWNER_RECORDED_LOCAL_ARTIFACT', symbol: 'BTCUSDT', sourceInterval: '1m', interval: '15m', eventCount: 1, firstEventTime: '2026-09-04T00:00:00Z', lastEventTime: '2026-09-04T23:45:00Z', fileSha256: 'd'.repeat(64), contentHash: 'c'.repeat(64), provenanceHash: 'd'.repeat(64), policyHash: 'e'.repeat(64), manifestSha256: 'f'.repeat(64), provenance: { dataClass: 'OWNER_LOCAL_RECORDED_MARKET_ARTIFACT', verification: 'UNVERIFIED', verificationStatus: 'UNVERIFIED_FOR_TRADING', rights: 'PRIVATE_ONLY', label: '사용자 소유 로컬 기록 시장 artifact' } }
    const catalog = { kind: 'recorded-ui-fixture', readCatalog: async () => { calls.push('catalog-read'); return { artifactVersion: 'paper-market-artifact-catalog-view/1', items: [artifact] } } }
    const h = react.createElement
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h('div', null,
      h('div', { id: 'result' }, h(PaperSessionPanel, { adapterPromise: Promise.resolve(adapter), requestedStrategy, csrfToken: '' })),
      h('div', { id: 'safe-error' }, h(PaperSessionPanel, { adapterPromise: Promise.resolve(errorAdapter), requestedStrategy, csrfToken: '' })),
      h('div', { id: 'customer-picker' }, h(PaperMarketArtifactPicker, { adapterPromise: Promise.resolve(catalog), onSelectionChange: () => calls.push('selection') }))))
  })
  await expect(page.locator('#result .paper-result')).toBeVisible()
  await expect(page.locator('#safe-error [role=alert]')).toBeVisible()
  await expect(page.locator('#customer-picker input')).toBeVisible()
  const result = await page.locator('#result .paper-result').elementHandle()
  const summaries = ['Paper ledger 요약', 'Paper ledger summary', 'Paper 元帳サマリー', 'Paper 账本摘要', 'Paper 帳本摘要', 'Resumen del libro mayor Paper', 'Résumé du grand livre Paper']
  const before = await page.evaluate(() => Reflect.get(window, 'suppliedPaperLocaleCalls'))
  for (const [i, language] of locales.entries()) {
    await page.evaluate(async lang => { const p = '/src/client-preferences.ts'; (await import(p)).setClientPreference('language', lang) }, language)
    await expect(page.locator('#result .paper-metric-grid')).toHaveAttribute('aria-label', summaries[i])
    await expect(page.locator('#result')).toContainText('999.95062500 USDT')
    await expect(page.locator('#result')).toContainText('1.25 BTC')
    await expect(page.locator('#result')).toContainText('0.04937500 USDT')
    await expect(page.locator('#customer-picker .paper-artifact-main strong')).toHaveText('내 로컬 BTCUSDT 기록')
    await expect(page.locator('#customer-picker')).toContainText('2026-09-04T23:45:00Z')
    if (language === 'en') await expect(page.locator('#customer-picker')).toContainText('1 item')
    if (language === 'fr') await expect(page.locator('#customer-picker')).toContainText('1 élément')
    if (language !== 'ko') { await expect(page.locator('#result')).not.toContainText(/[가-힣]/); await expect(page.locator('#safe-error')).not.toContainText(/[가-힣]/) }
    expect(await page.locator('#result .paper-result').evaluate((node, saved) => node === saved, result)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  }
  expect(await page.evaluate(() => Reflect.get(window, 'suppliedPaperLocaleCalls'))).toEqual(before)
})

test('native execution locale: explicit fixed dictionary has seven complete columns tokens and fails closed on unknown prose', async ({ page }) => {
  await page.goto('/execution-locale.html')
  const data = await page.evaluate(async () => {
    const path = '/src/internal-poc/native-execution-ui-copy.ts', { nativeExecutionUiCopy, nativeExecutionUiText } = await import(path)
    const demoKey = '원본 artifact와 결속되지 않은 UI 상태 시연입니다. 현재 시장, Demo, 주문 또는 실행 증거가 아닙니다.'
    const counts = [0, 1, 2].flatMap(count => ['es', 'fr'].map(language => nativeExecutionUiText(language, '{count}개 표시 · 다음 서버 페이지 있음 · 부분 조회', { count })))
    return { rows: nativeExecutionUiCopy, demo: ['ja', 'zh-CN', 'zh-TW'].map(language => nativeExecutionUiText(language, demoKey)), counts, unknown: ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'].map(language => nativeExecutionUiText(language, '사용자가 쓴 전략 제목 {value}', { value: 'not-translated' })) }
  })
  expect(Object.keys(data.rows).length).toBeGreaterThan(190)
  for (const row of Object.values(data.rows) as string[][]) {
    expect(row).toHaveLength(7)
    const tokens = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort()
    for (const text of row) { expect(text.length).toBeGreaterThan(0); expect(tokens(text)).toEqual(tokens(row[0])) }
    for (const text of row.slice(1)) expect(text).not.toMatch(/[가-힣]/)
  }
  expect(data.unknown).toEqual(Array(7).fill('사용자가 쓴 전략 제목 {value}'))
  expect(data.demo).toEqual([
    '元のアーティファクトに結び付けられていない UI 状態のデモです。現在の市場、Demo、注文、実行の証拠ではありません。',
    '这是未与原始工件绑定的 UI 状态演示，不是当前市场、Demo、订单或执行的证据。',
    '這是未與原始工件綁定的 UI 狀態示範，不是目前市場、Demo、訂單或執行的證據。',
  ])
  expect(data.counts).toEqual([0, 1, 2].flatMap(count => [
    `Cantidad mostrada: ${count} · hay otra página en el servidor · consulta parcial`,
    `Nombre affiché : ${count} · page suivante disponible sur le serveur · consultation partielle`,
  ]))
  const koExceptions: Record<string, string> = {
    '펀딩 {value}': 'funding {value}',
    '{title} · {symbol} · 원본 {source} → 평가 {evaluation}': '{title} · {symbol} · source {source} → evaluation {evaluation}',
    '{count}건 단수': '{count}건',
  }
  for (const [key, row] of Object.entries(data.rows) as [string, string[]][]) expect(row[0]).toBe(koExceptions[key] ?? key)
})
