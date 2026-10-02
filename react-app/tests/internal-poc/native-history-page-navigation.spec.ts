import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
import { openNativeAccountMenu as openObservedNativeAccountMenu } from './native-account-test-helpers'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import nativeFixture from './fixtures/native-service-contracts.json' with { type: 'json' }

test.use({ trace: 'off', video: 'off', screenshot: 'off' })
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

const cursorFor = (page: number) => 'history_navigation_cursor_' + String(page).padStart(4, '0')
const approvalFor = (page: number) => ({ ...approval, strategyVersionId: 'sv_v03_' + page.toString(16).padStart(32, '0') })
const jobFor = (page: number) => ({ ...queued.data, backtestId: 'backtest_history_navigation_' + String(page).padStart(4, '0'), strategyVersionId: approvalFor(page).strategyVersionId, semanticHash: approvalFor(page).semanticHash })
async function setup(page: Page, withJob = false, initialSessionState = 'AUTHENTICATED') {
  const controls = { currentId: sessionId, currentRevision: '1', currentEtag: '"history_session_etag_0001"',
    absent: false, pageCount: 3, snapshotRevision: '4', failure: '' as '' | 'INTERNAL_ERROR' | 'AUTHENTICATION_REQUIRED' | 'FORBIDDEN' | 'SNAPSHOT_CHANGED' | 'CURSOR_INVALID', reads: [] as number[],
    snapshot: ready as typeof ready | typeof conversationFixture.snapshots.blockedAfterReady,
    empty: false, posts: [] as { path: string; body: unknown; key: string | undefined }[], historyCount: 0,
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
    const requestedCursor = new URL(route.request().url()).searchParams.get('cursor')
    // Only this private server fixture decodes its synthetic cursor. Product
    // navigation must keep the server token opaque and issue fresh GETs.
    const pageNumber = requestedCursor ? Number(requestedCursor.slice(-4)) : 1
    controls.historyCount++; controls.reads.push(pageNumber)
    if (controls.holdHistory) await controls.holdHistory()
    if (controls.failure) return route.fulfill({ status: controls.failure === 'AUTHENTICATION_REQUIRED' ? 401 : controls.failure === 'FORBIDDEN' ? 403 : controls.failure === 'INTERNAL_ERROR' ? 500 : 409,
      contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({
        meta: meta('0.8.0', controls.snapshotRevision), error: { code: controls.failure, message: 'Native history request failed.' },
      }) })
    const currentApproval = approvalFor(pageNumber)
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"history_snapshot_etag_0004"', 'cache-control': 'no-store' }, body: JSON.stringify({
      meta: meta('0.8.0', controls.snapshotRevision), data: { conversationId: ready.conversationId, snapshotRevision: controls.snapshotRevision, limit: 50,
        rows: controls.empty ? [] : [{ approval: currentApproval, job: withJob ? jobFor(pageNumber) : null }],
        ...(pageNumber < controls.pageCount ? { nextCursor: cursorFor(pageNumber + 1) } : {}) },
    }) })
  })
  await page.route('**/api/v7/**', route => {
    const request = route.request()
    const jobPage = request.method() === 'POST' ? parseInt(request.postDataJSON().strategyVersionId.slice(-4), 16) : Number(new URL(request.url()).pathname.slice(-4))
    if (route.request().method() === 'POST') {
      controls.posts.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key'] })
      if (controls.failSubmit) return route.abort('failed')
    }
    return route.fulfill({ status: route.request().method() === 'POST' ? 202 : 200, contentType: 'application/json', headers: { ETag: '"history_job_etag_0001"', 'cache-control': 'no-store' }, body: JSON.stringify({
      ...queued, data: jobFor(jobPage),
    }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  return controls
}
const history = (page: Page) => page.getByRole('region', { name: '실행 이력', exact: true })
const load = async (page: Page) => {
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await expect(history(page)).toBeVisible()
}
const next = (page: Page) => history(page).getByRole('button', { name: '다음 이력 페이지', exact: true })
const previous = (page: Page) => history(page).getByRole('button', { name: '이전 이력 페이지', exact: true })
const first = (page: Page) => history(page).getByRole('button', { name: '첫 이력 페이지 다시 조회', exact: true })
const atPage = async (page: Page, number: number) => {
  await expect(history(page).getByText('현재 이력 페이지: ' + number, { exact: true })).toBeVisible()
  await expect(history(page)).toContainText(approvalFor(number).strategyVersionId)
}

test('다음으로 간 뒤 이전·첫 페이지를 fresh GET하여 같은 기존 승인을 다시 선택한다', async ({ page }) => {
  const state = await setup(page)
  await load(page)
  await expect(previous(page)).toBeDisabled()
  await next(page).click(); await atPage(page, 2)
  await next(page).click(); await atPage(page, 3)
  await expect(next(page)).toHaveCount(0)
  await previous(page).click(); await atPage(page, 2)
  await first(page).click(); await atPage(page, 1)
  expect(state.reads).toEqual([1, 2, 3, 2, 1])
  await history(page).getByRole('button', { name: '이 승인 버전 선택', exact: true }).click()
  await expect(page.getByText('승인 버전: ' + approvalFor(1).strategyVersionId, { exact: true })).toBeVisible()
  expect(state.posts).toHaveLength(0)
})

for (const direction of ['previous', 'first'] as const) test(direction + ' 실패는 마지막 페이지·선택을 유지하고 같은 위치를 명시 재조회한다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await next(page).click(); await atPage(page, 2)
  await next(page).click(); await atPage(page, 3)
  await history(page).getByRole('button', { name: '이 승인 버전 선택', exact: true }).click()
  state.failure = 'INTERNAL_ERROR'
  const button = direction === 'previous' ? previous(page) : first(page)
  await button.click()
  await expect(page.getByText(/이력 페이지를 확인하지 못해 이동하지 않았습니다/)).toBeVisible()
  await atPage(page, 3)
  await expect(page.getByText('승인 버전: ' + approvalFor(3).strategyVersionId, { exact: true })).toBeVisible()
  state.failure = ''
  await button.click(); await atPage(page, direction === 'previous' ? 2 : 1)
  expect(state.reads.slice(-2)).toEqual(direction === 'previous' ? [2, 2] : [1, 1])
  expect(state.posts).toHaveLength(0)
})

for (const failure of ['SNAPSHOT_CHANGED', 'CURSOR_INVALID'] as const) test(failure + ' 거절은 이동·새 선택을 막고 첫 페이지의 새 스냅샷만 명시 수용한다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await next(page).click(); await atPage(page, 2)
  state.failure = failure
  await previous(page).click()
  await expect(page.getByText(/이력 스냅샷이나 탐색 위치가 바뀌어/)).toBeVisible()
  await atPage(page, 2)
  await expect(previous(page)).toBeDisabled(); await expect(next(page)).toBeDisabled()
  await expect(history(page).getByRole('button', { name: '이 승인 버전 선택', exact: true })).toBeDisabled()
  state.failure = ''; state.snapshotRevision = '5'
  await first(page).click(); await atPage(page, 1)
  await expect(history(page).getByRole('button', { name: '이 승인 버전 선택', exact: true })).toBeEnabled()
  expect(state.reads).toEqual([1, 2, 1, 1]); expect(state.posts).toHaveLength(0)
})

for (const direction of ['next', 'previous'] as const) test(direction + ' 성공 응답의 스냅샷 변경도 페이지 번호를 먼저 바꾸지 않는다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await next(page).click(); await atPage(page, 2)
  state.snapshotRevision = '5'
  await (direction === 'next' ? next(page) : previous(page)).click()
  await expect(page.getByText(/이력 스냅샷이 바뀌어 이동하지 않았습니다/)).toBeVisible()
  await atPage(page, 2)
  await first(page).click(); await atPage(page, 1)
  expect(state.posts).toHaveLength(0)
})

for (const failure of ['AUTHENTICATION_REQUIRED', 'FORBIDDEN'] as const) test(failure + ' 응답 뒤 이전 행과 탐색 위치를 화면에 남기지 않는다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await next(page).click(); await atPage(page, 2)
  state.failure = failure
  await previous(page).click()
  await expect(history(page)).toHaveCount(0)
  await expect(page.getByText(approvalFor(2).strategyVersionId, { exact: false })).toHaveCount(0)
  expect(state.posts).toHaveLength(0)
})

for (const change of ['owner', 'revision', 'etag', 'absent'] as const) {
  for (const moment of ['before', 'inflight'] as const) test(change + '/' + moment + ' 권위 변경은 이전 페이지를 복원하지 않는다', async ({ page }) => {
    const state = await setup(page); await load(page)
    await next(page).click(); await atPage(page, 2)
    let release!: () => void
    if (moment === 'inflight') state.holdHistory = () => new Promise<void>(resolve => { release = resolve })
    const mutate = () => {
      if (change === 'owner') state.currentId = 'session_history_other_owner_0002'
      if (change === 'revision') state.currentRevision = '2'
      if (change === 'etag') state.currentEtag = '"history_session_etag_0002"'
      if (change === 'absent') state.absent = true
    }
    if (moment === 'before') mutate()
    await previous(page).click()
    if (moment === 'inflight') { await expect.poll(() => state.reads.length).toBe(3); mutate(); release() }
    await expect(history(page)).toHaveCount(0)
    expect(state.posts).toHaveLength(0)
    expect(state.reads.length).toBe(moment === 'before' ? 2 : 3)
  })
}

test('읽기 중 이중 클릭·다른 탐색·로그아웃 버튼은 중복 GET이나 POST를 만들지 않는다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await next(page).click(); await atPage(page, 2)
  let release!: () => void
  state.holdHistory = () => new Promise<void>(resolve => { release = resolve })
  await previous(page).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect.poll(() => state.reads.length).toBe(3)
  await expect(previous(page)).toBeDisabled(); await expect(first(page)).toBeDisabled(); await expect(next(page)).toBeDisabled()
  await expect(await openNativeAccountMenu(page)).toBeDisabled()
  // Member settings is now a page, not an Escape-dismissed profile dialog.
  if (!await page.locator('.client-settings-page .stg-back').isVisible()) await page.locator('.client-settings-page .stg-mback').click()
  await page.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click()
  await atPage(page, 2)
  release(); await atPage(page, 1)
  expect(state.reads).toEqual([1, 2, 1]); expect(state.posts).toHaveLength(0)
})

test('미확정 실행 의도가 있어도 이전·첫 페이지는 읽기만 허용하고 원 journal을 보존한다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await history(page).getByRole('button', { name: '이 승인 버전 선택', exact: true }).click()
  state.failSubmit = true
  await page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
  const saved = await page.evaluate(() => JSON.stringify({ ...sessionStorage }))
  await next(page).click(); await atPage(page, 2)
  await previous(page).click(); await atPage(page, 1)
  await first(page).click(); await atPage(page, 1)
  await expect(history(page).getByRole('button', { name: '이 승인 버전 선택', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage }))).toBe(saved)
  expect(state.posts).toHaveLength(1)
})

test('첫 페이지 재조회와 이전 탐색은 선택된 기존 서버 job을 취소·재실행하지 않는다', async ({ page }) => {
  const state = await setup(page, true); await load(page)
  await next(page).click(); await atPage(page, 2)
  await history(page).getByRole('button', { name: '작업 보기', exact: true }).click()
  await expect(page.getByRole('region', { name: '백테스트 진행' })).toHaveAttribute('data-native-job-state', 'QUEUED')
  await expect(page.getByRole('region', { name: '백테스트 진행' }).getByRole('button', { name: '백테스트 대기 중', exact: true })).toBeVisible()
  await previous(page).click(); await atPage(page, 1)
  await first(page).click(); await atPage(page, 1)
  await expect(page.getByText('승인 버전: ' + approvalFor(2).strategyVersionId, { exact: true })).toBeVisible()
  expect(state.posts).toHaveLength(0)
})

test('빈 이전 페이지는 전체 이력 없음으로 표시하지 않고 첫 페이지 복귀를 유지한다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await next(page).click(); await atPage(page, 2)
  state.empty = true
  await previous(page).click()
  await expect(history(page)).toContainText('이 페이지에 반환된 승인·실행 이력이 없습니다.')
  await expect(history(page)).toContainText('현재 이력 페이지: 1')
  state.empty = false
  await first(page).click(); await atPage(page, 1)
})

test('스냅샷 폐기 뒤 첫 페이지 조회도 실패하면 오래된 행 선택 잠금을 해제하지 않는다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await next(page).click(); await atPage(page, 2)
  state.failure = 'SNAPSHOT_CHANGED'
  await previous(page).click()
  await expect(page.getByText(/이력 스냅샷이나 탐색 위치가 바뀌어/)).toBeVisible()
  await expect(previous(page)).toBeDisabled()
  state.failure = 'INTERNAL_ERROR'
  await first(page).click()
  await expect(page.getByText(/이력 페이지를 확인하지 못해 이동하지 않았습니다/)).toBeVisible()
  await expect(history(page).getByRole('button', { name: '이 승인 버전 선택', exact: true })).toBeDisabled()
  await expect(previous(page)).toBeDisabled(); await expect(next(page)).toBeDisabled()
  await atPage(page, 2)
  state.failure = ''; state.snapshotRevision = '5'
  await first(page).click(); await atPage(page, 1)
  await expect(history(page).getByRole('button', { name: '이 승인 버전 선택', exact: true })).toBeEnabled()
  expect(state.posts).toHaveLength(0)
})

test('새로고침은 탐색 cursor·행을 저장하지 않고 명시 첫 GET부터 다시 시작한다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await next(page).click(); await atPage(page, 2)
  const saved = await page.evaluate(() => JSON.stringify({ session: { ...sessionStorage }, local: { ...localStorage } }))
  expect(saved).not.toContain('history_navigation_cursor_')
  expect(saved).not.toContain(approvalFor(2).strategyVersionId)
  await page.reload()
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  await expect(history(page)).toHaveCount(0)
  expect(state.reads).toEqual([1, 2])
  await load(page); await atPage(page, 1)
  await expect(previous(page)).toBeDisabled(); expect(state.posts).toHaveLength(0)
})

test('새 전략 화면 전환은 이전 대화의 탐색 기록을 함께 정리하고 서버 POST하지 않는다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await next(page).click(); await atPage(page, 2)
  if (await page.getByRole('button', { name: '새 전략', exact: true }).isVisible()) await page.getByRole('button', { name: '새 전략', exact: true }).click()
  else {
    await revealSourceNavigation(page); await page.getByRole('button', { name: '메뉴', exact: true }).click()
    await page.getByRole('button', { name: '＋ 새 전략', exact: true }).click()
  }
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  await expect(history(page)).toHaveCount(0)
  await expect(page.locator('.client-service-app')).toHaveClass(/view-landing/)
  expect(state.posts).toHaveLength(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation'))).toBeNull()
})

test('미확정 로그아웃은 탐색 행·버튼을 숨기고 원 서버 작업에 쓰지 않는다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await next(page).click(); await atPage(page, 2)
  let logouts = 0
  await page.route('**/api/v1/auth/logout', route => { logouts++; return route.abort('failed') })
  await (await openNativeAccountMenu(page)).click()
  await expect(page.getByRole('button', { name: '같은 로그아웃 요청으로 재개', exact: true })).toBeEnabled()
  await expect(history(page)).toHaveCount(0)
  expect(logouts).toBe(1); expect(state.posts).toHaveLength(0)
})

test('이전 페이지에서 다시 다음 이동하면 방문 순서의 번호를 유지하고 전체 페이지로 표시하지 않는다', async ({ page }) => {
  const state = await setup(page); await load(page)
  await next(page).click(); await atPage(page, 2)
  await next(page).click(); await atPage(page, 3)
  await previous(page).click(); await atPage(page, 2)
  await next(page).click(); await atPage(page, 3)
  await previous(page).click(); await atPage(page, 2)
  expect(state.reads).toEqual([1, 2, 3, 2, 3, 2])
  await expect(history(page)).toContainText('전체 페이지 수를 뜻하지 않습니다')
})

test('보관 100개는 전체 페이지 제한이 아니며 102페이지 이후 가장 오래된 보관 위치와 첫 페이지를 구분한다', async ({ page }) => {
  test.setTimeout(120_000)
  const state = await setup(page); state.pageCount = 103; await load(page)
  for (let number = 2; number <= 102; number++) { await next(page).click(); await atPage(page, number) }
  await expect(history(page)).toContainText('최근 100개 위치만 보관')
  await expect(next(page)).toBeEnabled()
  for (let number = 101; number >= 3; number--) { await previous(page).click(); await atPage(page, number) }
  await expect(previous(page)).toBeDisabled()
  await expect(history(page)).toContainText('전체 페이지 수를 뜻하지 않습니다')
  await first(page).click(); await atPage(page, 1)
  await expect(history(page).getByText(/최근 100개 위치만 보관/)).toHaveCount(0)
  expect(state.reads).toHaveLength(202); expect(state.posts).toHaveLength(0)
})
