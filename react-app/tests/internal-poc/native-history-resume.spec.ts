import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
import { openNativeAccountMenu as openObservedNativeAccountMenu } from './native-account-test-helpers'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import nativeFixture from './fixtures/native-service-contracts.json' with { type: 'json' }

test.use({ trace: 'off', video: 'off' })
async function openNativeAccountMenu(page: Page) {
  if (!await page.locator('.client-settings-page').isVisible()) await revealSourceNavigation(page)
  return openObservedNativeAccountMenu(page)
}

const ready = conversationFixture.snapshots.ready
const approved = conversationFixture.documents.find(item => item.name === 'approval')!.value
const approval = { ...approved, strategyVersionId: 'sv_v03_11111111111111111111111111111111' }
const queued = nativeFixture.sources[3].fixture.cases![0].response
const sessionId = 'session_history_resume_fixture_0001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_history_resume_0001', traceId: 'trace_history_resume_0001', resourceRevision: revision })

async function setup(page: Page, withJob = false, initialSessionState = 'AUTHENTICATED') {
  const controls = { currentId: sessionId, currentRevision: '1', currentEtag: '"history_session_etag_0001"',
    absent: false,
    snapshot: ready as typeof ready | typeof conversationFixture.snapshots.blockedAfterReady,
    historyApproval: { ...approval }, posts: [] as { path: string; body: unknown; key: string | undefined }[], historyCount: 0,
    holdHistory: undefined as (() => Promise<void>) | undefined, failSubmit: false }
  // Synthetic browser/SDK integration, not actual authentication or seeding of
  // a real authority store. Only an existing conversation locator is persisted.
  await page.addInitScript(({ id, owner }) => {
    if (!sessionStorage.getItem('history-fixture-initialized')) {
      sessionStorage.setItem('history-fixture-initialized', '1')
      sessionStorage.setItem('tesia.native.conversation', id)
      sessionStorage.setItem('tesia.native.conversation-session', owner)
    }
  }, { id: ready.conversationId, owner: sessionId })
  await page.route('**/api/v1/auth/session', route => controls.absent ? route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic absent session' } }) }) : route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: controls.currentEtag }, body: JSON.stringify({
    meta: meta('0.1.0', controls.currentRevision), data: { sessionId: controls.currentId, state: initialSessionState, revision: controls.currentRevision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' },
  }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    meta: meta('0.1.0', null), data: { csrfToken: 'csrf_history_resume_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' },
  }) }))
  await page.route('**/api/v3/**', route => {
    if (route.request().method() !== 'GET') { controls.posts.push({ path: new URL(route.request().url()).pathname, body: null, key: undefined }); return route.abort() }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"history_conversation_etag_0004"' }, body: JSON.stringify({ meta: meta('0.3.0', controls.snapshot.conversationStateRevision), data: controls.snapshot }) })
  })
  await page.route('**/api/v8/**', async route => {
    controls.historyCount++
    if (controls.holdHistory) await controls.holdHistory()
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"history_snapshot_etag_0004"', 'cache-control': 'no-store' }, body: JSON.stringify({
      meta: meta('0.8.0', '4'), data: { conversationId: ready.conversationId, snapshotRevision: '4', limit: 50,
        rows: [{ approval: controls.historyApproval, job: withJob ? { ...queued.data, strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash } : null }] },
    }) })
  })
  await page.route('**/api/v7/**', route => {
    if (route.request().method() === 'POST') {
      controls.posts.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key'] })
      if (controls.failSubmit) return route.abort('failed')
    }
    return route.fulfill({ status: route.request().method() === 'POST' ? 202 : 200, contentType: 'application/json', headers: { ETag: '"history_job_etag_0001"', 'cache-control': 'no-store' }, body: JSON.stringify({
      ...queued, data: { ...queued.data, strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash },
    }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  return controls
}
const load = async (page: Page) => {
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await expect(page.getByRole('region', { name: '실행 이력', exact: true })).toBeVisible()
}

test('reload 이력의 승인-only 버전 명시 선택과 별도 submit은 기존 ID/hash를 재사용하며 재승인하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await page.reload(); await load(page)
  const select = page.getByRole('button', { name: '이 승인 버전 선택', exact: true })
  await expect(select).toBeEnabled()
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toHaveCount(0)
  await select.click()
  await expect(page.getByText(`승인 버전: ${approval.strategyVersionId}`, { exact: true })).toBeVisible()
  await expect(page.getByText(/서버 이력의 기존 승인 버전을 선택했습니다/)).toBeVisible()
  expect(controls.posts).toHaveLength(0)
  await page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true }).click()
  await expect(page.getByRole('region', { name: '백테스트 진행' })).toHaveAttribute('data-native-job-state', 'QUEUED')
  await expect(page.getByRole('region', { name: '백테스트 진행' }).getByRole('button', { name: '백테스트 대기 중', exact: true })).toBeVisible()
  expect(controls.posts).toHaveLength(1)
  expect(controls.posts[0].body).toEqual({ strategyVersionId: approval.strategyVersionId, expectedSemanticHash: approval.semanticHash, profileId: 'INTERNAL_POC_FULL' })
})

for (const moment of ['before-select', 'before-submit', 'late-history'] as const) for (const field of ['session-id', 'session-revision', 'session-etag'] as const) {
  test(`${moment}의 ${field} 교체는 다른 owner 승인 복원/전송을 차단한다`, async ({ page }) => {
    const controls = await setup(page)
    let release: () => void = () => undefined
    if (moment === 'late-history') controls.holdHistory = () => new Promise<void>(resolve => { release = resolve })
    await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
    await expect.poll(() => controls.historyCount).toBe(1)
    if (moment !== 'late-history') {
      await expect(page.getByRole('button', { name: '이 승인 버전 선택', exact: true })).toBeEnabled()
      if (moment === 'before-submit') {
        await page.getByRole('button', { name: '이 승인 버전 선택', exact: true }).click()
        await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toBeEnabled()
      }
    }
    if (field === 'session-id') controls.currentId = 'session_history_different_owner_0002'
    else if (field === 'session-revision') controls.currentRevision = '2'
    else controls.currentEtag = '"history_session_etag_0002"'
    if (moment === 'late-history') release()
    else await page.getByRole('button', { name: moment === 'before-select' ? '이 승인 버전 선택' : '과거 데이터 백테스트 시작', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('region', { name: '실행 이력', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toHaveCount(0)
    expect(controls.posts).toHaveLength(0)
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
  })
}

for (const moment of ['before-load', 'before-select', 'before-submit'] as const) test(`${moment} 변경 초안은 기존 승인으로 잘못 표시하거나 실행하지 않는다`, async ({ page }) => {
  const controls = await setup(page)
  if (moment === 'before-load') {
    controls.snapshot = conversationFixture.snapshots.blockedAfterReady
    await page.reload()
  }
  await load(page)
  if (moment === 'before-submit') {
    await page.getByRole('button', { name: '이 승인 버전 선택', exact: true }).click()
    await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toBeEnabled()
  }
  controls.snapshot = conversationFixture.snapshots.blockedAfterReady
  if (moment !== 'before-load') await page.getByRole('button', { name: moment === 'before-select' ? '이 승인 버전 선택' : '과거 데이터 백테스트 시작', exact: true }).click()
  await expect(page.getByText(/현재 초안과 다른 기존 승인입니다/)).toBeVisible()
  await expect(page.getByRole('button', { name: '이 승인 버전 선택', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toHaveCount(0)
  expect(controls.posts).toHaveLength(0)
})

test('불확정 submit은 이력 재조회가 가능해도 다른 행 선택과 새 submit을 막고 같은 key로만 재개한다', async ({ page }) => {
  const controls = await setup(page); await load(page)
  await page.getByRole('button', { name: '이 승인 버전 선택', exact: true }).click()
  controls.failSubmit = true
  await page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: '이 승인 버전 선택', exact: true })).toBeDisabled()
  await load(page)
  await expect(page.getByRole('button', { name: '이 승인 버전 선택', exact: true })).toBeDisabled()
  const original = controls.posts[0]
  await page.reload(); await load(page)
  await expect(page.getByRole('button', { name: '이 승인 버전 선택', exact: true })).toBeDisabled()
  controls.failSubmit = false
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect(page.getByRole('region', { name: '백테스트 진행' })).toHaveAttribute('data-native-job-state', 'QUEUED')
  await expect(page.getByRole('region', { name: '백테스트 진행' }).getByRole('button', { name: '백테스트 대기 중', exact: true })).toBeVisible()
  expect(controls.posts).toEqual([original, original])
})

test('기존 job 행의 작업 보기 동작은 읽기 전용 재선택으로 유지한다', async ({ page }) => {
  const controls = await setup(page, true); await load(page)
  await page.getByRole('button', { name: '작업 보기', exact: true }).click()
  await expect(page.getByRole('region', { name: '백테스트 진행' })).toHaveAttribute('data-native-job-state', 'QUEUED')
  await expect(page.getByRole('region', { name: '백테스트 진행' }).getByRole('button', { name: '백테스트 대기 중', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toHaveCount(0)
  expect(controls.posts).toHaveLength(0)
})

test('선택 직전 401은 이전 승인 이력 표시를 무효화하고 submit을 보내지 않는다', async ({ page }) => {
  const controls = await setup(page); await load(page)
  controls.absent = true
  await page.getByRole('button', { name: '이 승인 버전 선택', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('region', { name: '실행 이력', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toHaveCount(0)
  expect(controls.posts).toHaveLength(0)
})

test('이력 선택 중 이중 클릭은 자동 승인·submit 없이 한 선택만 완료한다', async ({ page }) => {
  const controls = await setup(page); await load(page)
  await page.getByRole('button', { name: '이 승인 버전 선택', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toBeEnabled()
  expect(controls.posts).toHaveLength(0)
  expect(controls.historyCount).toBe(1)
})

test('미확정 logout은 기존 승인 선택을 숨기며 business 요청을 새로 전송하지 않는다', async ({ page }) => {
  const controls = await setup(page); await load(page)
  let logouts = 0
  await page.route('**/api/v1/auth/logout', route => { logouts++; return route.abort('failed') })
  await (await openNativeAccountMenu(page)).click()
  await expect(page.getByRole('button', { name: '같은 로그아웃 요청으로 재개', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: '이 승인 버전 선택', exact: true })).toHaveCount(0)
  expect(logouts).toBe(1)
  expect(controls.posts).toHaveLength(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-logout'))).not.toBeNull()
})

test('익명 대화의 이력 클릭은 현재 초안과 검증 receipt를 유지하고 로그인 필요만 안내한다', async ({ page }) => {
  const controls = await setup(page, false, 'ANONYMOUS')
  const receipt = conversationFixture.documents.find(item => item.name === 'validation-receipt')!.value
  let validates = 0
  await page.route('**/api/v3/strategy-drafts/*/validate', route => {
    validates++
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"history_validation_etag_0004"' }, body: JSON.stringify({ meta: meta('0.3.0', '4'), data: receipt }) })
  })
  await page.getByRole('button', { name: '전략 검증', exact: true }).click()
  await expect(page.getByText(/검증 완료 · 만료:/)).toBeVisible()
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  await expect(page.getByText(/검증 완료 · 만료:/)).toBeVisible()
  await expect(page.getByRole('button', { name: '로그인 후 백테스트 계속', exact: true })).toBeEnabled()
  await expect(page.getByRole('alert')).toContainText('로그인 후 실행 이력을 확인할 수 있습니다')
  expect(validates).toBe(1)
  expect(controls.historyCount).toBe(0)
  expect(controls.posts).toHaveLength(0)
})
