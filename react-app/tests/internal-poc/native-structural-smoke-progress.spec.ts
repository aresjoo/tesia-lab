import { expect, test, type Page } from '@playwright/test'
import { createFixtureRecoveryPayloads } from '../../src/internal-poc/fixture-adapter'
import type { BacktestState } from '../../src/internal-poc/contracts/generated/api-v0.1'

// Isolated real Panel + SDK on synthetic HTTP, with a controlled browser clock.
// App approval/auth binding is covered by the separate full-entry UI suite.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })
const PROFILE = 'ef6bc3100d735654f2b933fee9ac6dd71883ab6bec07385f29b1412d87e96497'
const OWNER = 'session_smoke_progress_0001'
const meta = (revision: string | null) => ({ apiContractVersion: '0.1.0', requestId: 'req_smoke_progress_0001', traceId: 'trace_smoke_progress_0001', resourceRevision: revision })
async function setup(page: Page) {
  const payloads = await createFixtureRecoveryPayloads(PROFILE)
  const state = { jobState: 'RUNNING_IS' as BacktestState, postState: 'QUEUED' as BacktestState, owner: OWNER, postLost: false, statusLost: false, resultLost: false,
    posts: [] as string[], statusReads: 0, resultReads: 0, hold: undefined as Promise<void> | undefined }
  await page.route('**/progress-panel.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="test-root"></div></body></html>' }))
  const authority = payloads.trustedVerifierAuthority
  const names = ['structural-smoke-profile-hash', 'report-verifier-name', 'report-verifier-version', 'report-verifier-commit-sha', 'report-trust-anchor-hash', 'report-receipt-content-hash', 'report-subject-content-hash']
  const values = [PROFILE, authority.verifierPin.name, authority.verifierPin.version, authority.verifierPin.commitSha, authority.trustAnchorContentHash, authority.expectedReceiptContentHash, authority.expectedSubjectContentHash]
  await page.route('**/internal-poc.html', route => route.fulfill({ contentType: 'text/html', headers: { 'cache-control': 'no-store' }, body: names.map((name, index) => `<meta name="tesia-${name}" content="${values[index]}">`).join('') }))
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    let data: unknown, revision: string | null = null, status = 200
    const job = (state: string) => {
      const { resultContentHash, runContentHash, ...base } = payloads.job
      return { ...base, state, resultAvailable: state === 'COMPLETED', ...(state === 'COMPLETED' ? { resultContentHash, runContentHash } : state === 'INVALID' ? { invalidReason: 'VERIFICATION_FAILED' } : {}) }
    }
    if (path === '/api/v1/auth/session') { revision = '1'; data = { sessionId: state.owner, state: 'AUTHENTICATED', revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }
    else if (path === '/api/v1/auth/csrf') data = { csrfToken: 'csrf_smoke_progress_0000001', expiresAt: '2030-01-02T00:00:00Z' }
    else if (path === '/api/v1/backtests' && req.method() === 'POST') {
      state.posts.push(req.headers()['idempotency-key']); if (state.postLost) return route.abort()
      data = job(state.postState); revision = '7'; status = 202
    } else if (path === `/api/v1/backtests/${payloads.ids.backtestId}`) {
      state.statusReads++; await state.hold; if (state.statusLost) return route.abort()
      data = job(state.jobState); revision = '7'
    } else {
      state.resultReads++; if (state.resultLost) return route.abort()
      data = path.endsWith('/report') ? payloads.report : path.endsWith('/manifest') ? payloads.manifest : payloads.trades[new URL(req.url()).searchParams.get('segment') === 'IS' ? 'IS' : 'OOS']
    }
    await route.fulfill({ status, contentType: 'application/json', headers: revision ? { ETag: '"progress_fixture_revision_7"' } : {}, body: JSON.stringify({ meta: meta(revision), data }) })
  })
  await page.goto('/progress-panel.html')
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') })
  await page.evaluate(async binding => {
    const refreshPath = '/@react-refresh', reactPath = '/@id/react', domPath = '/@id/react-dom/client', panelPath = '/src/internal-poc/NativeStructuralSmokePanel.tsx'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true, progressCurrent: true })
    const react = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath), { NativeStructuralSmokePanel } = await import(/* @vite-ignore */ panelPath)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('test-root'))
    const isCurrent = () => (window as unknown as { progressCurrent: boolean }).progressCurrent
    root.render((react.createElement ?? react.default.createElement)(NativeStructuralSmokePanel, { binding, isCurrent, verifyOwner: async () => {}, onClose: () => root.unmount() }))
  }, { sessionId: OWNER, strategyVersionId: payloads.job.strategyVersionId, semanticHash: payloads.job.semanticHash, profileContentHash: PROFILE })
  await page.getByRole('button', { name: '같은 승인으로 합성 구조 시험 실행', exact: true }).waitFor()
  return state
}
async function start(page: Page) {
  await page.getByRole('button', { name: '같은 승인으로 합성 구조 시험 실행', exact: true }).click()
  await expect(page.getByText(/마지막으로 확인한 서버 상태: QUEUED/)).toBeVisible()
}
async function hidden(page: Page, value: boolean) {
  await page.evaluate(value => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value ? 'hidden' : 'visible' })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value })
    document.dispatchEvent(new Event('visibilitychange'))
  }, value)
}

test('명시 submit 뒤 같은 작업 GET으로 진행하고 완료결과를 자동 표시한다', async ({ page }) => {
  const state = await setup(page)
  await page.clock.runFor(20_000); expect(state.posts).toHaveLength(0); expect(state.statusReads).toBe(0)
  await start(page)
  await page.clock.runFor(5_000); await expect.poll(() => state.statusReads).toBe(1)
  await expect(page.getByText(/마지막으로 확인한 서버 상태: RUNNING_IS/)).toBeVisible()
  state.jobState = 'COMPLETED'
  await page.clock.runFor(5_000); await expect.poll(() => state.statusReads).toBe(2)
  await expect(page.getByText(/마지막으로 확인한 서버 상태: COMPLETED/)).toBeVisible()
  await page.clock.runFor(5_000)
  await expect(page.getByRole('table')).toBeVisible()
  expect(state.resultReads).toBe(4); expect(state.posts).toHaveLength(1)
  const count = state.statusReads
  await page.clock.runFor(60_000); expect(state.statusReads).toBe(count); expect(state.resultReads).toBe(4)
})

test('탭 숨김은 자동 조회를 중단하며 복귀만으로 재개하지 않는다', async ({ page }) => {
  const state = await setup(page); await start(page)
  await hidden(page, true); await page.clock.runFor(30_000)
  expect(state.statusReads).toBe(0)
  await hidden(page, false); await page.clock.runFor(30_000)
  expect(state.statusReads).toBe(0)
  await page.getByRole('button', { name: '진행 자동 확인 재개', exact: true }).click()
  await page.clock.runFor(5_000); await expect.poll(() => state.statusReads).toBe(1)
  expect(state.posts).toHaveLength(1)
})

test('상태 조회는 2분 또는 24회 한도 뒤 추가 요청 없이 멈춘다', async ({ page }) => {
  const state = await setup(page); await start(page)
  for (let index = 0; index < 25; index++) {
    await page.clock.runFor(5_000)
    await expect(page.getByRole('button', { name: '구조 시험 상태 다시 조회', exact: true })).toBeEnabled()
  }
  await expect(page.getByText(/자동 확인 한도에 도달했습니다/)).toBeVisible()
  expect(state.statusReads).toBeGreaterThan(0); expect(state.statusReads).toBeLessThanOrEqual(24)
  const before = state.statusReads
  await page.clock.runFor(120_000)
  expect(state.statusReads).toBe(before); expect(state.posts).toHaveLength(1); expect(state.resultReads).toBe(0)
})

test('긴 timer 지연 후에는 새 상태 GET을 발급하지 않는다', async ({ page }) => {
  const state = await setup(page); await start(page)
  await page.clock.fastForward(120_001)
  await expect(page.getByText(/자동 확인 한도에 도달했습니다/)).toBeVisible()
  expect(state.statusReads).toBe(0); expect(state.posts).toHaveLength(1)
})

test('상태 network 오류에서 멈추고 수동 복구만 허용한다', async ({ page }) => {
  const state = await setup(page); state.statusLost = true; await start(page)
  await page.clock.runFor(5_000); await expect(page.getByRole('alert')).toBeVisible()
  expect(state.statusReads).toBe(1)
  await page.clock.runFor(30_000); expect(state.statusReads).toBe(1)
  state.statusLost = false
  await page.getByRole('button', { name: '구조 시험 상태 다시 조회', exact: true }).click()
  await expect(page.getByText(/마지막으로 확인한 서버 상태: RUNNING_IS/)).toBeVisible()
  const count = state.statusReads
  await page.clock.runFor(10_000); expect(state.statusReads).toBe(count)
  await page.getByRole('button', { name: '진행 자동 확인 재개', exact: true }).click()
  await page.clock.runFor(5_000); await expect.poll(() => state.statusReads).toBe(count + 1)
  expect(state.posts).toHaveLength(1)
})

test('결과 오류는 자동 재시도하지 않고 수동 결과 조회로 복구한다', async ({ page }) => {
  const state = await setup(page); state.jobState = 'COMPLETED'; state.resultLost = true; await start(page)
  await page.clock.runFor(5_000); await expect(page.getByText(/마지막으로 확인한 서버 상태: COMPLETED/)).toBeVisible()
  await page.clock.runFor(5_000); await expect(page.getByRole('alert')).toBeVisible()
  expect(state.resultReads).toBe(4)
  await page.clock.runFor(30_000); expect(state.resultReads).toBe(4)
  state.resultLost = false
  await page.getByRole('button', { name: '구조 시험 결과 다시 조회', exact: true }).click()
  await expect(page.getByRole('table')).toBeVisible()
  expect(state.resultReads).toBe(8); expect(state.posts).toHaveLength(1)
})

for (const end of ['FAILED', 'CANCELLED', 'INVALID'] as const) test(`${end} 종료는 결과 GET 없이 자동 확인을 멈춘다`, async ({ page }) => {
  const state = await setup(page); state.jobState = end; await start(page)
  await page.clock.runFor(5_000)
  await expect(page.getByText(/서버가 반환한 종료 상태입니다/)).toBeVisible()
  expect(state.statusReads).toBe(1)
  await page.clock.runFor(30_000); expect(state.statusReads).toBe(1); expect(state.resultReads).toBe(0)
})

test('소실된 submit 응답에는 job을 추측하거나 자동 재POST하지 않는다', async ({ page }) => {
  const state = await setup(page); state.postLost = true
  await page.getByRole('button', { name: '같은 승인으로 합성 구조 시험 실행', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.clock.runFor(120_000)
  expect(state.posts).toHaveLength(1); expect(state.statusReads).toBe(0); expect(state.resultReads).toBe(0)
  state.postLost = false; await start(page)
  expect(state.posts).toHaveLength(2); expect(state.posts[0]).toMatch(/^smoke_[0-9a-f-]{36}$/); expect(state.posts[1]).toBe(state.posts[0])
})

test('수동 중지는 timer만 멈추며 서버 취소 요청을 보내지 않는다', async ({ page }) => {
  const state = await setup(page); await start(page)
  await page.getByRole('button', { name: '진행 자동 확인 중지', exact: true }).click()
  await page.clock.runFor(30_000)
  expect(state.statusReads).toBe(0); expect(state.posts).toHaveLength(1)
  await expect(page.getByText(/서버 작업을 취소한 것이 아닙니다/)).toBeVisible()
})

for (const previous of ['idle', 'paused', 'error', 'complete'] as const) test(`비가동 ${previous} 상태의 탭 숨김은 자동 확인 안내를 덮어쓰지 않는다`, async ({ page }) => {
  const state = await setup(page)
  if (previous !== 'idle') {
    if (previous === 'error') state.statusLost = true
    if (previous === 'complete') state.jobState = 'COMPLETED'
    await start(page)
    if (previous === 'paused') await page.getByRole('button', { name: '진행 자동 확인 중지', exact: true }).click()
    if (previous === 'error') { await page.clock.runFor(5_000); await expect(page.getByRole('alert')).toBeVisible() }
    if (previous === 'complete') {
      await page.clock.runFor(5_000); await expect(page.getByText(/마지막으로 확인한 서버 상태: COMPLETED/)).toBeVisible()
      await page.clock.runFor(5_000); await expect(page.getByRole('table')).toBeVisible()
      await expect(page.getByRole('button', { name: '진행 자동 확인 중지', exact: true })).toHaveCount(0)
    }
  }
  const before = { posts: state.posts.length, status: state.statusReads, results: state.resultReads }
  await hidden(page, true); await page.clock.runFor(30_000); await hidden(page, false)
  await expect(page.getByText(/탭을 숨겨 자동 확인을 멈췄습니다/)).toHaveCount(0)
  if (previous === 'error') await expect(page.getByRole('alert')).toBeVisible()
  if (previous === 'complete') await expect(page.getByRole('table')).toBeVisible()
  expect({ posts: state.posts.length, status: state.statusReads, results: state.resultReads }).toEqual(before)
})

test('숨긴 탭의 in-flight 상태 응답은 결과 자동 조회를 유발하지 않는다', async ({ page }) => {
  const state = await setup(page); state.jobState = 'COMPLETED'
  let release: () => void = () => undefined
  state.hold = new Promise<void>(resolve => { release = resolve })
  await start(page); await page.clock.runFor(5_000); await expect.poll(() => state.statusReads).toBe(1)
  await hidden(page, true); release()
  await expect(page.getByRole('button', { name: '구조 시험 상태 다시 조회', exact: true })).toBeEnabled()
  await hidden(page, false); await page.clock.runFor(30_000)
  await expect(page.getByText(/마지막으로 확인한 서버 상태: QUEUED/)).toBeVisible()
  expect(state.resultReads).toBe(0); expect(state.statusReads).toBe(1)
})

test('패널 닫기는 pending GET의 늦은 결과와 후속 timer를 격리한다', async ({ page }) => {
  const state = await setup(page)
  let release: () => void = () => undefined
  state.hold = new Promise<void>(resolve => { release = resolve })
  await start(page); await page.clock.runFor(5_000); await expect.poll(() => state.statusReads).toBe(1)
  await page.getByRole('button', { name: '구조 시험 화면 닫기' }).click(); release()
  await page.clock.runFor(30_000)
  await expect(page.getByRole('region')).toHaveCount(0)
  expect(state.statusReads).toBe(1); expect(state.posts).toHaveLength(1); expect(state.resultReads).toBe(0)
})

test('owner 교체는 기존 job 표시를 지우고 자동 확인을 중단한다', async ({ page }) => {
  const state = await setup(page); await start(page); state.owner = 'session_smoke_changed_0001'
  await page.clock.runFor(5_000); await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByText(/마지막으로 확인한 서버 상태/)).toHaveCount(0)
  expect(state.statusReads).toBe(0)
  await page.clock.runFor(30_000); expect(state.statusReads).toBe(0); expect(state.posts).toHaveLength(1)
})

test('상위 승인 세대 폐기 뒤 timer는 API를 호출하지 않는다', async ({ page }) => {
  const state = await setup(page); await start(page)
  await page.evaluate(() => Object.assign(window, { progressCurrent: false }))
  await page.clock.runFor(5_000); await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByText(/마지막으로 확인한 서버 상태/)).toHaveCount(0)
  expect(state.statusReads).toBe(0); expect(state.resultReads).toBe(0)
})

test('지연된 상태 GET이 정산되기 전에는 다음 GET을 겹쳐 보내지 않는다', async ({ page }) => {
  const state = await setup(page)
  let release: () => void = () => undefined
  state.hold = new Promise<void>(resolve => { release = resolve })
  await start(page); await page.clock.runFor(5_000); await expect.poll(() => state.statusReads).toBe(1)
  await page.clock.runFor(30_000); expect(state.statusReads).toBe(1)
  await expect(page.getByRole('button', { name: '구조 시험 상태 다시 조회', exact: true })).toBeDisabled()
  release(); await expect(page.getByText(/마지막으로 확인한 서버 상태: RUNNING_IS/)).toBeVisible()
  await page.clock.runFor(5_000); await expect.poll(() => state.statusReads).toBe(2)
  expect(state.posts).toHaveLength(1)
})

test('접수 응답이 이미 COMPLETED이면 결과 한 번만 자동 조회한다', async ({ page }) => {
  const state = await setup(page); state.postState = 'COMPLETED'; state.jobState = 'COMPLETED'
  await page.getByRole('button', { name: '같은 승인으로 합성 구조 시험 실행', exact: true }).click()
  await expect(page.getByText(/마지막으로 확인한 서버 상태: COMPLETED/)).toBeVisible()
  await page.clock.runFor(5_000); await expect(page.getByRole('table')).toBeVisible()
  expect(state.statusReads).toBe(1); expect(state.resultReads).toBe(4)
  await page.clock.runFor(60_000); expect(state.statusReads).toBe(1); expect(state.resultReads).toBe(4); expect(state.posts).toHaveLength(1)
})
