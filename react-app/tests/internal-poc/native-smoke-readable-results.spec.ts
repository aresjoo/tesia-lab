import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { createFixtureRecoveryPayloads } from '../../src/internal-poc/fixture-adapter'
import { formatResultRatePercent } from '../../src/internal-poc/native-result-number-format'

// Real Panel/module/SDK with private synthetic HTTP, not actual market results.
// Formatting is display-only: no new metric, formula, receipt or schema validator.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })
const PROFILE = 'ef6bc3100d735654f2b933fee9ac6dd71883ab6bec07385f29b1412d87e96497'
const OWNER = 'session_smoke_metrics_0001'
const metrics = [
  { name: 'MAX_DRAWDOWN_RATE', value: '0.01234567890123456789', formula: 'PEAK_TO_TROUGH_DIV_PEAK_EQUITY', derivedBy: 'ENGINE' },
  { name: 'WIN_RATE', value: '0.625', formula: 'WINNING_TRADES_DIV_TRADE_COUNT', derivedBy: 'ENGINE' },
]
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value !== null && typeof value === 'object' ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}` : JSON.stringify(value)
const hash = (prefix: string, value: unknown) => createHash('sha256').update(`${prefix}\0${canonical(value)}`).digest('hex')
const meta = (revision: string | null) => ({ apiContractVersion: '0.1.0', requestId: 'req_smoke_metrics_0001', traceId: 'trace_smoke_metrics_0001', resourceRevision: revision })
async function setup(page: Page, supplied: unknown = metrics) {
  const payloads = await createFixtureRecoveryPayloads(PROFILE)
  const report = payloads.report as unknown as Record<string, unknown>
  if (supplied === 'omitted') {
    delete report.derivedMetrics; delete report.metricsPolicy; delete report.initialCapitalSourceHash
  }
  else report.derivedMetrics = supplied
  // Re-seal only private fixture bytes so malformed metrics reach the existing
  // SDK shape/semantic checks, rather than merely failing a stale report hash.
  const { verifierReceipt, reportContentHash: oldHash, ...projection } = payloads.report
  void oldHash
  const reportHash = hash('tesia.api.verified-report.v0.1.0', projection)
  const { contentHash: oldReceipt, ...receiptProjection } = verifierReceipt
  void oldReceipt
  const receipt = { ...receiptProjection, subjectContentHash: reportHash }
  const receiptHash = hash('tesia.api.verifier-receipt.v0.1.0', receipt)
  Object.assign(report, { reportContentHash: reportHash, verifierReceipt: { ...receipt, contentHash: receiptHash } })
  Object.assign(payloads.job, { resultContentHash: reportHash })
  Object.assign(payloads.trustedVerifierAuthority, { expectedReceiptContentHash: receiptHash, expectedSubjectContentHash: reportHash })
  const state = { posts: 0, reportReads: 0, reportCode: 200, corruptReport: false, owner: OWNER }
  await page.route('**/readable-results-panel.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><head><link rel="stylesheet" href="/src/internal-poc/internal-poc.css"></head><body><div id="test-root"></div></body></html>' }))
  await page.route('**/internal-poc.html', route => {
    const a = payloads.trustedVerifierAuthority
    const names = ['structural-smoke-profile-hash', 'report-verifier-name', 'report-verifier-version', 'report-verifier-commit-sha', 'report-trust-anchor-hash', 'report-receipt-content-hash', 'report-subject-content-hash']
    const values = [PROFILE, a.verifierPin.name, a.verifierPin.version, a.verifierPin.commitSha, a.trustAnchorContentHash, a.expectedReceiptContentHash, a.expectedSubjectContentHash]
    return route.fulfill({ contentType: 'text/html', headers: { 'cache-control': 'no-store' }, body: names.map((name, i) => `<meta name="tesia-${name}" content="${values[i]}">`).join('') })
  })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    let data: unknown, revision: string | null = null, status = 200
    if (path === '/api/v1/auth/session') { revision = '1'; data = { sessionId: state.owner, state: 'AUTHENTICATED', revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }
    else if (path === '/api/v1/auth/csrf') data = { csrfToken: 'csrf_smoke_metrics_0001', expiresAt: '2030-01-02T00:00:00Z' }
    else if (path === '/api/v1/backtests' && request.method() === 'POST') { state.posts++; data = payloads.job; status = 202; revision = payloads.job.revision }
    else if (path === `/api/v1/backtests/${payloads.ids.backtestId}`) { data = payloads.job; revision = payloads.job.revision }
    else if (path.endsWith('/report')) {
      state.reportReads++
      if (state.reportCode !== 200) return route.fulfill({ status: state.reportCode, contentType: 'application/json', body: JSON.stringify({ meta: meta(null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic response' } }) })
      data = state.corruptReport ? { ...report, reportContentHash: 'f'.repeat(64) } : report
    } else if (path.endsWith('/manifest')) data = payloads.manifest
    else if (path.endsWith('/trades')) data = payloads.trades[url.searchParams.get('segment') === 'IS' ? 'IS' : 'OOS']
    else return route.abort()
    return route.fulfill({ status, contentType: 'application/json', headers: revision ? { ETag: '"smoke_metrics_revision_7"' } : {}, body: JSON.stringify({ meta: meta(revision), data }) })
  })
  await page.goto('/readable-results-panel.html')
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') })
  await page.evaluate(async binding => {
    const refreshPath = '/@react-refresh', reactPath = '/@id/react', domPath = '/@id/react-dom/client', panelPath = '/src/internal-poc/NativeStructuralSmokePanel.tsx'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const react = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath), { NativeStructuralSmokePanel } = await import(/* @vite-ignore */ panelPath)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('test-root'))
    root.render((react.createElement ?? react.default.createElement)(NativeStructuralSmokePanel, { binding, isCurrent: () => true, verifyOwner: async () => {}, onClose: () => root.unmount() }))
  }, { sessionId: OWNER, strategyVersionId: payloads.job.strategyVersionId, semanticHash: payloads.job.semanticHash, profileContentHash: PROFILE })
  await page.getByRole('button', { name: '같은 승인으로 합성 구조 시험 실행', exact: true }).click()
  await expect(page.getByRole('button', { name: '진행 자동 확인 중지', exact: true })).toBeVisible()
  await page.clock.runFor(5_000)
  await expect.poll(() => state.reportReads).toBe(1)
  return state
}
const summary = (page: Page) => page.getByRole('region', { name: '보고서 수준 서버 집계', exact: true })

const auxiliary = (page: Page) => page.getByRole('region', { name: '백분율 보조 표시', exact: true })

test('원문과 별도로 백분율 보조값과 반올림 기준을 읽는다', async ({ page }) => {
  const state = await setup(page)
  await expect(auxiliary(page)).toBeVisible()
  await expect(auxiliary(page)).toContainText('1.23%')
  await expect(auxiliary(page)).toContainText('62.50%')
  await expect(auxiliary(page)).toContainText('소수 2자리 반올림')
  await expect(summary(page).locator('dd')).toHaveText(['0.01234567890123456789', '0.625'])
  await expect(summary(page)).toContainText('구간별 지표가 아닙니다')
  await expect(summary(page)).toContainText('수익률 미제공')
  await expect(summary(page)).toContainText('자산·낙폭 시계열 미제공')
  await expect(page.locator('svg, canvas')).toHaveCount(0)
  expect(state.posts).toBe(1)
})

test('구간 의미와 원 통화 및 비용·거래 수를 분명하게 읽는다', async ({ page }) => {
  await setup(page)
  const table = page.getByRole('table', { name: '합성 구조 시험 구간별 서버 결과' })
  await expect(table).toContainText('IS (인샘플)')
  await expect(table).toContainText('OOS (아웃오브샘플)')
  await expect(table.getByRole('columnheader')).toHaveText(['구간', '순손익', '수수료', '펀딩 현금흐름', '거래 수', '거절 수'])
  for (const row of await table.locator('tbody tr').all()) {
    for (const cell of await row.locator('td').all().then(cells => cells.slice(0, 3))) await expect(cell).toContainText('USDT')
  }
  await expect(page.getByText('펀딩은 양수 수취·음수 지급인 현금흐름입니다.', { exact: true })).toBeVisible()
  await expect(page.getByText('거래 수는 구간 전체 서버 집계이며, 아래 첫 페이지에 표시한 거래 수와 다를 수 있습니다.', { exact: true })).toBeVisible()
})

test('문자열 반올림은 zero·정확한 half·carry·큰 정밀도를 보존한다', () => {
  const cases = [
    ['0', '0.00%'], ['-0.00000', '0.00%'], ['1', '100.00%'], ['0.625', '62.50%'],
    ['0.01234567890123456789', '1.23%'], ['0.01234999999999999999', '1.23%'],
    ['0.01235', '1.24%'], ['-0.01235', '−1.24%'], ['0.99995', '100.00%'],
    ['-0.99995', '−100.00%'], ['0.00005', '0.01%'], ['-0.00005', '−0.01%'],
    ['0.00004999999999999', '<0.01%'], ['-0.00004999999999999', '−0.01% 초과 · 0% 미만'],
    ['0.000000000000000000000000000001', '<0.01%'],
    ['9007199254740993.123456789', '900,719,925,474,099,312.35%'],
    ['-9007199254740993.123456789', '−900,719,925,474,099,312.35%'],
    ['1.5', '150.00%'], // Presentation is not a metric-domain/range validator.
  ] as const
  for (const [raw, expected] of cases) expect(formatResultRatePercent(raw), raw).toBe(expected)
})

test('보조 formatter의 지원 밖 문자열은 임의 숫자변환 없이 미표시한다', () => {
  for (const raw of [undefined, '', ' ', '1e-3', '0x10', '+0.1', '.1', '1.', '01', '1,000', 'NaN', 'Infinity', '0.1\n', '０.１', '0'.repeat(4097)]) {
    expect(formatResultRatePercent(raw), String(raw)).toBeUndefined()
  }
})

for (const [raw, expected] of [
  ['0', '0.00%'], ['0.0000000000001', '<0.01%'], ['-0.0000000000001', '−0.01% 초과 · 0% 미만'],
  ['0.99995', '100.00%'], ['1e-3', '백분율 보조 표시 불가'],
] as const) test(`보조 ${raw}는 원문과 구분하고 tiny·unsupported를 zero로 만들지 않는다`, async ({ page }) => {
  await setup(page, metrics.map(metric => ({ ...metric, value: raw })))
  await expect(summary(page).locator('dd')).toHaveText([raw, raw])
  await expect(auxiliary(page).locator('dd')).toHaveText([expected, expected])
})

for (const supplied of ['omitted', [], [{ ...metrics[0], value: null }], [{ ...metrics[0], derivedBy: 'BROWSER' }]]) test(`미제공·표시불가 ${JSON.stringify(supplied)}에서 거래 기반 백분율을 만들지 않는다`, async ({ page }) => {
  await setup(page, supplied)
  await expect(auxiliary(page).locator('dd')).toHaveText(['백분율 보조 표시 불가', '백분율 보조 표시 불가'])
  await expect(summary(page)).toContainText('MDD 미제공 또는 표시 불가')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

for (const invalidation of ['401', 'owner', 'hash'] as const) test(`재조회 ${invalidation}은 원값과 보조 표시를 함께 제거한다`, async ({ page }) => {
  const state = await setup(page)
  await expect(auxiliary(page)).toBeVisible()
  if (invalidation === '401') state.reportCode = 401
  if (invalidation === 'owner') state.owner = 'session_smoke_metrics_other'
  if (invalidation === 'hash') state.corruptReport = true
  await page.getByRole('button', { name: '구조 시험 결과 다시 조회', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(summary(page)).toHaveCount(0)
  await expect(auxiliary(page)).toHaveCount(0)
  expect(state.posts).toBe(1)
})

test('표의 비용·현금흐름·거래 수는 서버 원값 그대로이며 환산·합산하지 않는다', async ({ page }) => {
  const original = await createFixtureRecoveryPayloads(PROFILE)
  await setup(page)
  const rows = page.getByRole('table', { name: '합성 구조 시험 구간별 서버 결과' }).locator('tbody tr')
  for (const [index, { runtimeResult: r }] of original.report.segments.entries()) {
    await expect(rows.nth(index).locator('td')).toHaveText([`${r.netPnl} ${r.currency}`, `${r.fees} ${r.currency}`, `${r.funding} ${r.currency}`, String(r.tradeCount), String(r.rejectionCount)])
  }
})

test('기존 client 토큰에서 보조값과 가로 스크롤 구간표를 읽는다', async ({ page }, testInfo) => {
  await setup(page)
  // Private component mount only, not a replacement app route or live backend.
  await page.evaluate(async () => {
    for (const path of ['/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/geist/wght.css', '/src/client-reference.css', '/src/internal-poc/client-service.css']) await import(/* @vite-ignore */ path)
    const root = document.getElementById('test-root')!
    const wrapper = document.createElement('div')
    wrapper.className = 'client-service-app'
    root.before(wrapper); wrapper.append(root)
    root.className = 'decision-rail'
    await document.fonts.ready
  })
  await expect(auxiliary(page).getByText('62.50%', { exact: true })).toBeVisible()
  const dimensions = await page.evaluate(() => {
    const table = document.querySelector('.segment-table-wrap')!
    return { documentWidth: document.documentElement.scrollWidth, viewport: innerWidth, tableWidth: table.clientWidth, tableContentWidth: table.scrollWidth }
  })
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport)
  expect(dimensions.tableContentWidth).toBeGreaterThanOrEqual(dimensions.tableWidth)
  await auxiliary(page).evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }))
  if (process.env.TETH_READABLE_PROOF_ROOT) await page.screenshot({ path: process.env.TETH_READABLE_PROOF_ROOT + '/readable-results-' + testInfo.project.name + '.png' })
})
