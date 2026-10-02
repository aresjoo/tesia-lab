import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { createFixtureRecoveryPayloads } from '../../src/internal-poc/fixture-adapter'

// Real Panel/module/SDK with synthetic HTTP. No actual engine or market claim.
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
  await page.route('**/metrics-panel.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="test-root"></div></body></html>' }))
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
  await page.goto('/metrics-panel.html')
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

test('서버 MDD와 승률의 decimal 원문을 보고서 수준으로 표시한다', async ({ page }) => {
  const state = await setup(page)
  await expect(summary(page)).toBeVisible()
  await expect(summary(page)).toContainText('0.01234567890123456789')
  await expect(summary(page)).toContainText('0.625')
  await expect(summary(page)).toContainText('구간별 지표가 아닙니다')
  await expect(summary(page)).toContainText('수익률 미제공')
  await expect(summary(page)).toContainText('자산·낙폭 시계열 미제공')
  await expect(summary(page)).not.toContainText('%')
  await expect(page.locator('svg, canvas')).toHaveCount(0)
  expect(state.posts).toBe(1)
})

for (const value of ['omitted', []] as const) test(`선택적 지표 ${typeof value === 'string' ? '누락' : '빈 배열'}은 미제공이며 거래로 계산하지 않는다`, async ({ page }) => {
  await setup(page, value)
  await expect(summary(page)).toBeVisible()
  await expect(summary(page)).toContainText('MDD 미제공')
  await expect(summary(page)).toContainText('승률 미제공')
  await expect(summary(page)).not.toContainText('0.625')
})

for (const value of [null, {}, [null], [{ ...metrics[0], value: 'not-a-decimal' }], [{ ...metrics[0], value: null }], [{ ...metrics[0], value: '' }], [{ ...metrics[0], value: 'Infinity' }], [{ ...metrics[0], value: {} }], [{ ...metrics[0], derivedBy: 'BROWSER' }]]) test(`SDK 수신 뒤 표시 불가 지표 ${JSON.stringify(value)}는 숫자로 노출하지 않는다`, async ({ page }) => {
  await setup(page, value)
  // The old SDK accepts these re-sealed private reports. This is UI fallback,
  // not proof of full metric schema/decimal/formula validation by that SDK.
  await expect(summary(page)).toBeVisible()
  await expect(summary(page)).toContainText('MDD 미제공 또는 표시 불가')
  await expect(summary(page)).not.toContainText('not-a-decimal')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('서버 zero 원문은 미제공으로 바꾸지 않는다', async ({ page }) => {
  await setup(page, metrics.map(metric => ({ ...metric, value: '0' })))
  await expect(summary(page).locator('dd')).toHaveText(['0', '0'])
})

test('표시 방어는 canonical decimal이나 수식 전체를 검증한 것으로 주장하지 않는다', async ({ page }) => {
  await setup(page, [{ ...metrics[0], value: '1e-3', formula: 'UNVERIFIED_FORMULA' }])
  await expect(summary(page).locator('dd').first()).toHaveText('1e-3')
  await expect(summary(page)).toContainText('서버가 제공한 보고서 집계')
})

test('결과 재조회 401은 이전 집계도 제거한다', async ({ page }) => {
  const state = await setup(page)
  await expect(summary(page)).toBeVisible()
  state.reportCode = 401
  await page.getByRole('button', { name: '구조 시험 결과 다시 조회', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(summary(page)).toHaveCount(0)
})

test('다른 owner 재조회는 이전 집계도 숨기고 자동 재계산하지 않는다', async ({ page }) => {
  const state = await setup(page)
  await expect(summary(page)).toBeVisible()
  state.owner = 'session_smoke_metrics_other'
  await page.getByRole('button', { name: '구조 시험 결과 다시 조회', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(summary(page)).toHaveCount(0)
  expect(state.posts).toBe(1)
})

test('기존 보고서 해시 무결성 거절은 이전 집계도 숨긴다', async ({ page }) => {
  const state = await setup(page)
  await expect(summary(page)).toBeVisible()
  state.corruptReport = true
  await page.getByRole('button', { name: '구조 시험 결과 다시 조회', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(summary(page)).toHaveCount(0)
  expect(state.posts).toBe(1)
})
