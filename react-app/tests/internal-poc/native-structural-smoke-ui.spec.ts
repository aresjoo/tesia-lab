import { createHash } from 'node:crypto'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
import { openNativeAccountMenu } from './native-account-test-helpers'
import { createFixtureRecoveryPayloads } from '../../src/internal-poc/fixture-adapter'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

// Real UI/SDK consuming explicitly synthetic HTTP fixtures; not an engine run.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })
test.setTimeout(30_000)
const PROFILE = 'ef6bc3100d735654f2b933fee9ac6dd71883ab6bec07385f29b1412d87e96497'
const OWNER = 'session_native_smoke_ui_0001'
const ready = conversationFixture.snapshots.ready
const approval = conversationFixture.documents.find(item => item.name === 'approval')!.value
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value !== null && typeof value === 'object' ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}` : JSON.stringify(value)
const hash = (prefix: string, value: unknown) => createHash('sha256').update(`${prefix}\0${canonical(value)}`).digest('hex')
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_native_smoke_ui_0001', traceId: 'trace_native_smoke_ui_0001', resourceRevision: revision })
const panel = (page: Page) => page.getByRole('region', { name: '승인 전략의 합성 구조 시험', exact: true })
const open = (page: Page) => page.getByRole('button', { name: '합성 구조 시험 열기', exact: true }).click()
// This existing suite exercises explicit manual recovery. Stop the new optional
// read watch after acceptance; the separate progress suite proves automation.
const start = async (page: Page) => {
  await panel(page).getByRole('button', { name: '같은 승인으로 합성 구조 시험 실행', exact: true }).click()
  await expect.poll(async () => await panel(page).getByRole('alert').count() > 0
    || await panel(page).getByRole('button', { name: '진행 자동 확인 중지', exact: true }).count() > 0).toBe(true)
  const stop = panel(page).getByRole('button', { name: '진행 자동 확인 중지', exact: true })
  if (await stop.count()) await stop.click()
}
async function setup(page: Page) {
  const original = await createFixtureRecoveryPayloads(PROFILE)
  const payloads = structuredClone(original)
  // Rebind this private synthetic report to the recorded v3 approval, including
  // its existing content-addressed receipt. Shared fixture bytes stay unchanged.
  Object.assign(payloads.job, { strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash })
  Object.assign(payloads.report, { strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash })
  const { verifierReceipt, reportContentHash: _oldHash, ...projection } = payloads.report
  void _oldHash
  const reportHash = hash('tesia.api.verified-report.v0.1.0', projection)
  const { contentHash: _receiptHash, ...receiptProjection } = verifierReceipt
  void _receiptHash
  const newReceipt = { ...receiptProjection, subjectContentHash: reportHash }
  const receiptHash = hash('tesia.api.verifier-receipt.v0.1.0', newReceipt)
  Object.assign(payloads.report, { reportContentHash: reportHash, verifierReceipt: { ...newReceipt, contentHash: receiptHash } })
  Object.assign(payloads.job, { resultContentHash: reportHash })
  Object.assign(payloads.trustedVerifierAuthority, { expectedReceiptContentHash: receiptHash, expectedSubjectContentHash: reportHash })
  const controls = { owner: OWNER, revision: '1', etag: '"native_smoke_owner_1"', absent: false, changedDraft: false,
    losePost: false, responseCode: 200, reportCode: 200, incompleteAuthority: false, missingProfile: false,
    posts: [] as { key: string; csrf: string; body: unknown }[], resultReads: 0, statusReads: 0, otherPosts: [] as string[],
    waitPost: undefined as Promise<void> | undefined, waitResult: undefined as Promise<void> | undefined,
    waitHistory: undefined as Promise<void> | undefined, waitStatus: undefined as Promise<void> | undefined }
  await page.addInitScript(({ owner, id }) => { sessionStorage.setItem('tesia.native.conversation', id); sessionStorage.setItem('tesia.native.conversation-session', owner) }, { owner: OWNER, id: ready.conversationId })
  await page.route('**/internal-poc.html', async route => {
    const response = await route.fetch()
    const authority = payloads.trustedVerifierAuthority
    const values = [PROFILE, authority.verifierPin.name, authority.verifierPin.version, authority.verifierPin.commitSha,
      authority.trustAnchorContentHash, authority.expectedReceiptContentHash, authority.expectedSubjectContentHash]
    const names = ['structural-smoke-profile-hash', 'report-verifier-name', 'report-verifier-version', 'report-verifier-commit-sha', 'report-trust-anchor-hash', 'report-receipt-content-hash', 'report-subject-content-hash']
    let body = (await response.text()).replace(/<meta\b[^>]*name="tesia-[^"]*"[^>]*>/g, '')
    body = body.replace('</head>', names.map((name, index) => controls.missingProfile || (controls.incompleteAuthority && index > 0) ? '' : `<meta name="tesia-${name}" content="${values[index]}">`).join('') + '</head>')
    await route.fulfill({ response, body, headers: { ...response.headers(), 'cache-control': 'no-store' } })
  })
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    let data: unknown, version = '0.1.0', revision: string | null = null, status = 200, etag = controls.etag
    const failure = (code: number) => route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify({ meta: meta(version, null), error: { code: code === 401 ? 'AUTHENTICATION_REQUIRED' : code === 403 ? 'FORBIDDEN' : 'NOT_READY', message: 'Synthetic response' } }) })
    if (path === '/api/v1/auth/session') {
      if (controls.absent) return failure(401)
      revision = controls.revision; data = { sessionId: controls.owner, state: 'AUTHENTICATED', revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
    } else if (path === '/api/v1/auth/csrf') data = { csrfToken: 'csrf_native_smoke_ui_0001', expiresAt: '2030-01-02T00:00:00Z' }
    else if (path.startsWith('/api/v3/conversations/')) { data = controls.changedDraft ? { ...ready, semanticHash: 'f'.repeat(64) } : ready; version = '0.3.0'; revision = ready.conversationStateRevision; etag = '"native_smoke_conversation_4"' }
    else if (path.startsWith('/api/v8/')) { await controls.waitHistory; data = { conversationId: ready.conversationId, snapshotRevision: '5', limit: 50, rows: [{ approval, job: null }] }; version = '0.8.0'; revision = '5'; etag = '"native_smoke_history_5"' }
    else if (path === '/api/v1/backtests' && request.method() === 'POST') {
      controls.posts.push({ key: request.headers()['idempotency-key'], csrf: request.headers()['x-csrf-token'], body: request.postDataJSON() })
      await controls.waitPost
      if (controls.losePost) return route.abort()
      if (controls.responseCode !== 200) return failure(controls.responseCode)
      data = payloads.job; revision = payloads.job.revision; status = 202
    } else if (path === `/api/v1/backtests/${payloads.ids.backtestId}`) {
      controls.statusReads++; await controls.waitStatus; if (controls.responseCode !== 200) return failure(controls.responseCode)
      data = payloads.job; revision = payloads.job.revision
    } else if (path.endsWith('/report') || path.endsWith('/manifest') || path.endsWith('/trades')) {
      controls.resultReads++; await controls.waitResult
      if (path.endsWith('/report') && controls.reportCode === 500) return route.abort()
      if (path.endsWith('/report') && controls.reportCode !== 200) return failure(controls.reportCode)
      data = path.endsWith('/report') ? payloads.report : path.endsWith('/manifest') ? payloads.manifest : payloads.trades[new URL(request.url()).searchParams.get('segment') === 'IS' ? 'IS' : 'OOS']
    } else if (path === '/api/v1/auth/logout') {
      controls.otherPosts.push(path); controls.absent = true; revision = '2'; data = { sessionId: OWNER, state: 'REVOKED', revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
    } else { if (request.method() === 'POST') controls.otherPosts.push(path); return route.abort() }
    await route.fulfill({ status, contentType: 'application/json', headers: { ...(revision ? { ETag: etag } : {}), 'cache-control': 'no-store' }, body: JSON.stringify({ meta: meta(version, revision), data }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await page.getByRole('button', { name: '이 승인 버전 선택', exact: true }).click()
  await expect(page.getByRole('button', { name: '기록 Paper 열기', exact: true })).toBeEnabled()
  return { controls, payloads }
}

test('실부모 이력 조회 중 timer는 권위 폐기 없이 일시 중지하고 명시 재개한다', async ({ page }) => {
  const { controls } = await setup(page)
  await page.clock.install(); await open(page)
  await panel(page).getByRole('button', { name: '같은 승인으로 합성 구조 시험 실행', exact: true }).click()
  await expect(panel(page).getByRole('button', { name: '진행 자동 확인 중지', exact: true })).toBeVisible()
  let release: () => void = () => undefined
  controls.waitHistory = new Promise<void>(resolve => { release = resolve })
  const history = page.getByRole('button', { name: '이 대화의 실행 이력', exact: true })
  await history.click(); await expect(history).toBeDisabled()
  await page.clock.runFor(5_000)
  await expect(panel(page)).toContainText('다른 화면의 작업 중에는')
  await expect(panel(page)).toContainText('마지막으로 확인한 서버 상태: COMPLETED')
  await expect(panel(page).getByRole('alert')).toHaveCount(0)
  expect(controls.resultReads).toBe(0)
  release(); await expect(history).toBeEnabled()
  await page.clock.runFor(10_000); expect(controls.resultReads).toBe(0)
  await panel(page).getByRole('button', { name: '진행 자동 확인 재개', exact: true }).click()
  await page.clock.runFor(5_000); await expect(panel(page).getByRole('table')).toBeVisible()
  expect(controls.posts).toHaveLength(1)
})

test('실부모가 busy인 동안 재개 클릭은 가동하지 않는 진행중 표시를 만들지 않는다', async ({ page }) => {
  const { controls } = await setup(page)
  await page.clock.install(); await open(page); await start(page)
  let release: () => void = () => undefined
  controls.waitHistory = new Promise<void>(resolve => { release = resolve })
  const history = page.getByRole('button', { name: '이 대화의 실행 이력', exact: true })
  await history.click(); await expect(history).toBeDisabled()
  await panel(page).getByRole('button', { name: '진행 자동 확인 재개', exact: true }).click()
  await expect(panel(page)).toContainText('다른 화면의 작업 중에는')
  await expect(panel(page).getByRole('button', { name: '진행 자동 확인 중지', exact: true })).toHaveCount(0)
  await page.clock.runFor(10_000); expect(controls.resultReads).toBe(0)
  release(); await expect(history).toBeEnabled()
  await expect(panel(page)).toContainText('마지막으로 확인한 서버 상태: COMPLETED')
  expect(controls.posts).toHaveLength(1)
})

test('실부모 busy와 in-flight read 정착의 교차는 running 잔류 없이 명시 복구한다', async ({ page }) => {
  const { controls } = await setup(page)
  await page.clock.install(); await open(page)
  let releaseStatus: () => void = () => undefined, releaseHistory: () => void = () => undefined
  controls.waitStatus = new Promise<void>(resolve => { releaseStatus = resolve })
  await panel(page).getByRole('button', { name: '같은 승인으로 합성 구조 시험 실행', exact: true }).click()
  await expect(panel(page).getByRole('button', { name: '진행 자동 확인 중지', exact: true })).toBeVisible()
  await page.clock.runFor(5_000); await expect.poll(() => controls.statusReads).toBe(1)
  controls.waitHistory = new Promise<void>(resolve => { releaseHistory = resolve })
  const history = page.getByRole('button', { name: '이 대화의 실행 이력', exact: true })
  await history.click(); await expect(history).toBeDisabled(); releaseStatus()
  await expect(panel(page)).toContainText('다른 화면의 작업 중에는')
  await expect(panel(page).getByRole('button', { name: '진행 자동 확인 중지', exact: true })).toHaveCount(0)
  await expect(panel(page)).toContainText('마지막으로 확인한 서버 상태: COMPLETED')
  expect(controls.resultReads).toBe(0)
  releaseHistory(); await expect(history).toBeEnabled()
  await page.clock.runFor(10_000); expect(controls.resultReads).toBe(0)
  await panel(page).getByRole('button', { name: '진행 자동 확인 재개', exact: true }).click()
  await page.clock.runFor(5_000); await expect(panel(page).getByRole('table')).toBeVisible()
  expect(controls.posts).toHaveLength(1)
})

for (const ownerChange of ['different', 'absent'] as const) test(`실부모 busy 뒤 실제 owner ${ownerChange}는 일시 중지로 권위를 보존하지 않는다`, async ({ page }) => {
  const { controls } = await setup(page)
  await page.clock.install(); await open(page)
  await panel(page).getByRole('button', { name: '같은 승인으로 합성 구조 시험 실행', exact: true }).click()
  await expect(panel(page).getByRole('button', { name: '진행 자동 확인 중지', exact: true })).toBeVisible()
  let release: () => void = () => undefined
  controls.waitHistory = new Promise<void>(resolve => { release = resolve })
  const history = page.getByRole('button', { name: '이 대화의 실행 이력', exact: true })
  const waiting = page.waitForRequest(request => new URL(request.url()).pathname.startsWith('/api/v8/'))
  await history.click(); await waiting
  await page.clock.runFor(5_000); await expect(panel(page)).toContainText('다른 화면의 작업 중에는')
  if (ownerChange === 'different') controls.owner = 'session_different_smoke_0001'
  else controls.absent = true
  release()
  await expect(panel(page)).toHaveCount(0)
  await page.clock.runFor(10_000); expect(controls.resultReads).toBe(0); expect(controls.posts).toHaveLength(1)
})

test('실부모 busy 중 접수 정착은 job 추측 없이 원 키 명시 재전송만 허용한다', async ({ page }) => {
  const { controls } = await setup(page)
  await page.clock.install(); await open(page)
  let releasePost: () => void = () => undefined, releaseHistory: () => void = () => undefined
  controls.waitPost = new Promise<void>(resolve => { releasePost = resolve })
  await panel(page).getByRole('button', { name: '같은 승인으로 합성 구조 시험 실행', exact: true }).click()
  await expect.poll(() => controls.posts.length).toBe(1)
  controls.waitHistory = new Promise<void>(resolve => { releaseHistory = resolve })
  const history = page.getByRole('button', { name: '이 대화의 실행 이력', exact: true })
  await history.click(); await expect(history).toBeDisabled(); releasePost()
  await expect(panel(page)).toContainText('다른 화면의 작업 중에는')
  await expect(panel(page).getByText(/마지막으로 확인한 서버 상태:/)).toHaveCount(0)
  await page.clock.runFor(10_000); expect(controls.posts).toHaveLength(1); expect(controls.statusReads).toBe(0)
  releaseHistory(); await expect(history).toBeEnabled()
  await start(page)
  expect(controls.posts).toHaveLength(2); expect(controls.posts[1]).toEqual(controls.posts[0])
})

test('명시 구조 시험 열기/실행/결과 조회는 FULL·Paper와 구분된다', async ({ page }) => {
  const { controls } = await setup(page)
  expect(controls.posts).toHaveLength(0)
  await open(page); expect(controls.posts).toHaveLength(0)
  await start(page)
  await expect(panel(page)).toContainText('COMPLETED')
  expect(controls.resultReads).toBe(0)
  await panel(page).getByRole('button', { name: '구조 시험 결과 다시 조회', exact: true }).click()
  await expect(panel(page).getByRole('table', { name: '합성 구조 시험 구간별 서버 결과' })).toBeVisible()
  await expect(panel(page)).toContainText('각 구간 첫 50개')
  await expect(panel(page)).toContainText('실제 730일 결과가 아닙니다')
  expect(controls.posts).toHaveLength(1)
  expect(controls.posts[0].key).toMatch(/^smoke_[0-9a-f-]{36}$/)
  expect(controls.posts[0].csrf).toBe('csrf_native_smoke_ui_0001')
  expect(controls.posts[0].body).toEqual({ strategyVersionId: approval.strategyVersionId, expectedSemanticHash: approval.semanticHash, profileId: 'STRUCTURAL_SMOKE' })
  expect(controls.otherPosts).toEqual([])
})

test('응답 소실 뒤 닫기/재열기 명시 재전송은 동일 key를 유지한다', async ({ page }) => {
  const { controls } = await setup(page); controls.losePost = true
  await open(page); await start(page)
  await expect(panel(page).getByRole('alert')).toBeVisible()
  await panel(page).getByRole('button', { name: '구조 시험 화면 닫기' }).click()
  await open(page); expect(controls.posts).toHaveLength(1)
  controls.losePost = false; await start(page)
  await expect(panel(page)).toContainText('COMPLETED')
  expect(controls.posts).toHaveLength(2); expect(controls.posts[1]).toEqual(controls.posts[0])
})

for (const variant of ['owner', 'revision', 'etag', 'absent', 'draft'] as const) test(`열기 직전 ${variant} 변경은 새 실행/기존 승인 승격을 막는다`, async ({ page }) => {
  const { controls } = await setup(page)
  if (variant === 'owner') controls.owner = 'session_changed_smoke_0001'
  if (variant === 'revision') controls.revision = '2'
  if (variant === 'etag') controls.etag = '"changed_smoke_etag_0001"'
  if (variant === 'absent') controls.absent = true
  if (variant === 'draft') controls.changedDraft = true
  await open(page)
  await expect(page.getByRole('alert').first()).toBeVisible()
  await expect(panel(page)).toHaveCount(0)
  expect(controls.posts).toEqual([])
})

test('HTML profile 미제공이면 임의 hash/FULL/fixture 대체 없이 열기를 거절한다', async ({ page }) => {
  const { controls } = await setup(page)
  await page.evaluate(() => document.querySelector('meta[name="tesia-structural-smoke-profile-hash"]')?.remove())
  await open(page)
  await expect(page.getByRole('alert').first()).toBeVisible()
  await expect(panel(page)).toHaveCount(0); expect(controls.posts).toHaveLength(0)
})

test('동기 두 번 클릭은 POST 하나이며 완료를 기다린다', async ({ page }) => {
  const { controls } = await setup(page)
  let release: () => void = () => undefined
  controls.waitPost = new Promise<void>(resolve => { release = resolve })
  await open(page)
  await panel(page).getByRole('button', { name: '같은 승인으로 합성 구조 시험 실행' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect.poll(() => controls.posts.length).toBe(1)
  await expect(panel(page)).not.toContainText('COMPLETED')
  release(); await expect(panel(page)).toContainText('COMPLETED')
  expect(controls.posts).toHaveLength(1)
})

test('저장소 쓰기 실패는 POST 전에 중단한다', async ({ page }) => {
  const { controls } = await setup(page); await open(page)
  await page.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key.startsWith('tesia-native-smoke-command:')) throw new Error('Synthetic storage failure'); set.call(this, key, value) } })
  await start(page); await expect(panel(page).getByRole('alert')).toBeVisible()
  expect(controls.posts).toHaveLength(0)
})

test('결과 네트워크 실패 뒤 명시 결과 재조회는 새 POST 없이 복구한다', async ({ page }) => {
  const { controls } = await setup(page); await open(page); await start(page)
  await expect(panel(page)).toContainText('COMPLETED')
  controls.reportCode = 500
  await panel(page).getByRole('button', { name: '구조 시험 결과 다시 조회' }).click()
  await expect(panel(page).getByRole('alert')).toBeVisible()
  await expect(panel(page).getByRole('table')).toHaveCount(0)
  controls.reportCode = 200
  await panel(page).getByRole('button', { name: '구조 시험 결과 다시 조회' }).click()
  await expect(panel(page).getByRole('table')).toBeVisible()
  expect(controls.posts).toHaveLength(1)
})

// v1 report declares 401 but not 403. The latter is deliberately an invalid
// intermediary response: preserve SDK rejection and hide old state, not a new wire policy.
for (const code of [401, 403]) test(`결과 ${code}이면 기존 수치/거래/job 표시를 제거한다`, async ({ page }) => {
  const { controls } = await setup(page); await open(page); await start(page)
  await expect(panel(page)).toContainText('COMPLETED')
  await panel(page).getByRole('button', { name: '구조 시험 결과 다시 조회' }).click()
  await expect(panel(page).getByRole('table')).toBeVisible()
  controls.reportCode = code
  await panel(page).getByRole('button', { name: '구조 시험 결과 다시 조회' }).click()
  await expect(panel(page).getByRole('alert')).toBeVisible()
  await expect(panel(page).getByRole('table')).toHaveCount(0)
  await expect(panel(page)).not.toContainText('COMPLETED')
  await expect(panel(page).getByRole('button', { name: '같은 승인으로 합성 구조 시험 실행' })).toHaveCount(0)
})

test('report authority 미준비이면 결과를 숨기고 명시 재조회로만 재검증한다', async ({ page }) => {
  const { controls } = await setup(page); await open(page); await start(page)
  await expect(panel(page)).toContainText('COMPLETED'); controls.incompleteAuthority = true
  await panel(page).getByRole('button', { name: '구조 시험 결과 다시 조회' }).click()
  await expect(panel(page).getByRole('alert')).toBeVisible()
  expect(controls.resultReads).toBe(0)
  controls.incompleteAuthority = false
  await panel(page).getByRole('button', { name: '구조 시험 결과 다시 조회' }).click()
  await expect(panel(page).getByRole('table')).toBeVisible()
})

test('닫힌 패널의 지연 결과는 새 패널로 복원되지 않는다', async ({ page }) => {
  const { controls } = await setup(page); await open(page); await start(page)
  await expect(panel(page)).toContainText('COMPLETED')
  let release: () => void = () => undefined
  controls.waitResult = new Promise<void>(resolve => { release = resolve })
  await panel(page).getByRole('button', { name: '구조 시험 결과 다시 조회' }).click()
  await expect.poll(() => controls.resultReads).toBe(4)
  await panel(page).getByRole('button', { name: '구조 시험 화면 닫기' }).click()
  await open(page); release()
  await expect(panel(page)).not.toContainText('COMPLETED')
  await expect(panel(page).getByRole('table')).toHaveCount(0)
  expect(controls.posts).toHaveLength(1)
})

test('대기 중 초안 편집은 원 job을 취소하지 않고 늦은 결과를 격리한다', async ({ page }) => {
  const { controls } = await setup(page); await open(page); await start(page)
  await expect(panel(page)).toContainText('COMPLETED')
  let release: () => void = () => undefined
  controls.waitResult = new Promise<void>(resolve => { release = resolve })
  await panel(page).getByRole('button', { name: '구조 시험 결과 다시 조회' }).click()
  await expect.poll(() => controls.resultReads).toBe(4)
  await page.getByRole('button', { name: '현재 초안 수정하기' }).click()
  await expect(panel(page)).toHaveCount(0); release()
  await expect(page.getByRole('table', { name: '합성 구조 시험 구간별 서버 결과' })).toHaveCount(0)
  expect(controls.otherPosts).toEqual([])
})

test('요청 소실 뒤 reload와 동일 승인 선택은 네 필드 순서와 키를 유지한다', async ({ page }) => {
  const { controls } = await setup(page); controls.losePost = true
  await open(page); await start(page); await expect(panel(page).getByRole('alert')).toBeVisible()
  const saved = await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('tesia-native-smoke-command:')).map(key => ({ key, value: sessionStorage.getItem(key) })))
  expect(saved).toHaveLength(1)
  expect(Object.keys(JSON.parse(saved[0].value!).binding)).toEqual(['sessionId', 'strategyVersionId', 'semanticHash', 'profileContentHash'])
  expect(controls.posts[0].key).toBe(JSON.parse(saved[0].value!).idempotencyKey)
  expect(controls.posts[0].key).toMatch(/^smoke_[0-9a-f-]{36}$/)
  expect(controls.posts[0].csrf).toBe('csrf_native_smoke_ui_0001')
  await page.reload()
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await page.getByRole('button', { name: '이 승인 버전 선택', exact: true }).click()
  await expect(page.getByRole('button', { name: '합성 구조 시험 열기', exact: true })).toBeEnabled()
  await open(page); expect(controls.posts).toHaveLength(1)
  controls.losePost = false; await start(page); await expect(panel(page)).toContainText('COMPLETED')
  expect(controls.posts[1]).toEqual(controls.posts[0])
  expect(await page.evaluate(key => sessionStorage.getItem(key), saved[0].key)).toBe(saved[0].value)
})

test('미확정 구조 시험은 로그아웃을 막지 않고 원 요청 키를 보존한다', async ({ page }) => {
  const { controls } = await setup(page); controls.losePost = true
  await open(page); await start(page); await expect(panel(page).getByRole('alert')).toBeVisible()
  const saved = await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('tesia-native-smoke-command:')).map(key => [key, sessionStorage.getItem(key)]))
  await revealSourceNavigation(page)
  const logout = await openNativeAccountMenu(page)
  await logout.click()
  await expect.poll(() => controls.otherPosts.includes('/api/v1/auth/logout')).toBe(true)
  await expect(panel(page)).toHaveCount(0)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('tesia-native-smoke-command:')).map(key => [key, sessionStorage.getItem(key)]))).toEqual(saved)
  expect(controls.posts).toHaveLength(1)
})

test('빈 첫 페이지와 nextCursor 부분 조회를 전체 거래 없음으로 표시하지 않는다', async ({ page }) => {
  const { payloads } = await setup(page)
  Object.assign(payloads.trades.IS, { trades: [], nextCursor: 'opaque_next_smoke_fixture_cursor_0001' })
  await open(page); await start(page); await expect(panel(page)).toContainText('COMPLETED')
  await panel(page).getByRole('button', { name: '구조 시험 결과 다시 조회' }).click()
  const is = panel(page).getByRole('region', { name: 'IS 합성 거래 첫 페이지' })
  await expect(is).toContainText('이 페이지에 반환된 거래가 없습니다')
  await expect(is).toContainText('부분 조회')
  await expect(panel(page).getByRole('region', { name: 'OOS 합성 거래 첫 페이지' }).getByRole('listitem')).toHaveCount(1)
})

test('재조회 도중 다른 owner로 교체되면 이전 bundle을 다시 표시하지 않는다', async ({ page }) => {
  const { controls } = await setup(page); await open(page); await start(page)
  await expect(panel(page)).toContainText('COMPLETED')
  let release: () => void = () => undefined
  controls.waitResult = new Promise<void>(resolve => { release = resolve })
  await panel(page).getByRole('button', { name: '구조 시험 결과 다시 조회' }).click()
  await expect.poll(() => controls.resultReads).toBe(4)
  controls.owner = 'session_other_smoke_ui_0002'; release()
  await expect(panel(page).getByRole('alert')).toBeVisible()
  await expect(panel(page).getByRole('table')).toHaveCount(0)
  await expect(panel(page)).not.toContainText('COMPLETED')
  expect(controls.posts).toHaveLength(1)
})
