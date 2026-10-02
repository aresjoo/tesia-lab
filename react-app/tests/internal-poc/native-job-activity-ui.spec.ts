import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeJob } from '../../src/internal-poc/native-service-api'

test.use({ trace: 'off', video: 'off' })
test.setTimeout(30_000)
const ready = conversationFixture.snapshots.ready
const approval = { ...conversationFixture.documents.find(item => item.name === 'approval')!.value, strategyVersionId: 'sv_v03_11111111111111111111111111111111' }
const cases = fixtures.sources[3].fixture.cases!
const labels = { QUEUED: '백테스트 대기 중', PREPARING_DATA: '데이터 준비 중', VALIDATING: '백테스트 입력 검증 중', REPLAYING: '전략 재생 중', VERIFYING: '결과 검증 중', TERMINAL_READY: '결과 게시 대기', COMPLETED: '백테스트 완료', INVALID: '백테스트 결과 무효', FAILED: '백테스트 처리 실패' } as const
const reasons = { DATA_CONTRACT_INVALID: '데이터 확인 필요', STRATEGY_CONTRACT_INVALID: '전략 조건 확인 필요', ASSUMPTION_CONTRACT_INVALID: '백테스트 가정 확인 필요', RUNTIME_RESULT_INVALID: '실행 결과 확인 필요', VERIFICATION_FAILED: '결과 검증 실패' } as const
type State = keyof typeof labels
function jobFor(state: State, id?: string): NativeJob {
  const value = structuredClone(cases.find(item => item.name === state)!.response.data)
  // Reuse the existing schema-only job snapshots, including the COMPLETED
  // unissued binding exactly as recorded. Never relabel a synthetic report.
  return { ...value, strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash, ...(id ? { backtestId: id } : {}) } as NativeJob
}
const activity = (page: Page) => page.locator('.native-job-activity')
const region = (page: Page) => page.getByRole('region', { name: '백테스트 진행', exact: true })
const documentTab = (page: Page) => page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true })
const backToConversation = (page: Page) => page.locator('.native-research-workspace').getByRole('button', { name: '대화로 돌아가기', exact: true })
const researchNotice = (page: Page) => page.locator('.native-research-workspace .client-service-result-notice[role="status"]')
const ownerId = 'session_job_activity_fixture_0001'
async function setLanguage(page: Page, language: string) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', value)
  }, language)
}

for (const stateName of ['FAILED', 'COMPLETED'] as const) test(`${stateName} 종단 상태의 7언어 전환은 작업·보고서 재조회를 유발하지 않는다`, async ({ page }) => {
  const state = await native(page, stateName)
  await documentTab(page).click()
  const notice = researchNotice(page)
  await expect(notice).toBeVisible()
  // COMPLETED is the existing unissued schema fixture, deliberately returning
  // a report 404. This checks lookup failure, never a real result success.
  if (stateName === 'COMPLETED') {
    await expect(notice.locator('[data-native-result-status]')).toHaveAttribute('data-native-result-status', 'error')
    // Wait for both existing StrictMode mounts before taking the baseline.
    await expect.poll(() => state.reportReads).toBe(2)
  }
  const reads = [...state.jobReads], reports = state.reportReads, others = state.otherResultReads
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) {
    await setLanguage(page, language)
    await expect(activity(page)).toHaveAttribute('data-native-job-state', stateName)
    if (language !== 'ko') await expect(notice).not.toContainText(/[가-힣]/)
    else if (stateName === 'COMPLETED') await expect(notice).toContainText('결과 확인 필요')
    expect(state.jobReads).toEqual(reads)
    expect(state.reportReads).toBe(reports)
    expect(state.otherResultReads).toBe(others)
    expect(state.posts).toEqual([])
  }
})

test('긴 관측 기록을 위로 읽는 중 언어를 바꿔도 최신 행으로 끌려가지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await isolated(page, jobFor('QUEUED'))
  for (let index = 1; index <= 35; index++) {
    const state = index % 2 ? 'REPLAYING' : 'VALIDATING'
    await page.evaluate(value => Reflect.get(window, 'setIsolatedJobActivity')(value), { ...jobFor(state), revision: String(index + 1) })
    await expect(activity(page)).toHaveAttribute('data-native-job-state', state)
  }
  const log = activity(page).locator('.cot2')
  expect((await log.textContent())!.split('\n')).toHaveLength(34)
  await log.focus()
  await page.keyboard.press('Home')
  await expect.poll(() => log.evaluate(node => node.scrollTop)).toBe(0)
  for (const language of ['en', 'fr', 'ko']) {
    await setLanguage(page, language)
    await expect(log).toBeFocused()
    await expect.poll(() => log.evaluate(node => node.scrollTop)).toBe(0)
    expect((await log.textContent())!.split('\n')).toHaveLength(34)
    await expect(log).toContainText('32')
  }
})

test('언어 변경은 기존 진행 기록을 다시 표시하고 열린 정보·작업을 보존한다', async ({ page }, info) => {
  await isolated(page, jobFor('QUEUED'))
  await page.evaluate(value => Reflect.get(window, 'setIsolatedJobActivity')(value), jobFor('REPLAYING'))
  const root = activity(page), log = root.locator('.cot2'), metadata = root.locator('details')
  await metadata.locator('summary').click()
  await metadata.locator('summary').focus()
  await page.evaluate(() => {
    Reflect.set(window, 'originalJobNode', document.querySelector('.native-job-activity'))
    Reflect.set(window, 'originalJobMetadata', document.querySelector('.native-job-metadata'))
  })
  const originalTime = await root.locator('time').getAttribute('datetime')
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) {
    await setLanguage(page, language)
    await expect(root).toHaveAttribute('data-native-job-state', 'REPLAYING')
    await expect(metadata).toHaveAttribute('open', '')
    await expect(metadata.locator('summary')).toBeFocused()
    await expect(root.locator('time')).toHaveAttribute('datetime', originalTime!)
    await expect(log).toBeVisible()
    expect((await log.textContent())!.split('\n')).toHaveLength(4)
    if (language !== 'ko') await expect(root).not.toContainText('전략 재생 중')
    else await expect(log).toContainText('백테스트 대기 중')
    if (language === 'fr') await page.screenshot({ path: info.outputPath('job-progress-fr.png'), fullPage: true })
    expect(await page.evaluate(() => Reflect.get(window, 'originalJobNode') === document.querySelector('.native-job-activity') && Reflect.get(window, 'originalJobMetadata') === document.querySelector('.native-job-metadata'))).toBe(true)
  }
  expect(await page.evaluate(() => Reflect.get(window, 'isolatedJobAudit'))).toEqual({ intervals: 0, elapsedDateReads: 0 })
})

for (const width of [320, 1440]) test(`${width}px 7언어 작업 정보와 무효 원코드는 겹치거나 화면 밖으로 나가지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await isolated(page, { ...jobFor('INVALID'), invalidReason: 'ASSUMPTION_CONTRACT_INVALID' })
  await activity(page).locator('details summary').click()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await setLanguage(page, language)
    await expect(activity(page).locator('code')).toHaveText('ASSUMPTION_CONTRACT_INVALID')
    const geometry = await activity(page).evaluate(root => ({
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      overlaps: [...root.querySelectorAll('dl > div')].some(row => {
        const label = row.querySelector('dt')!.getBoundingClientRect(), value = row.querySelector('dd')!.getBoundingClientRect()
        return label.right > value.left + 1 || value.right > innerWidth + 1
      }),
    }))
    expect(geometry, language).toEqual({ overflow: false, overlaps: false })
  }
  await page.screenshot({ path: info.outputPath(`job-invalid-fr-${width}.png`), fullPage: true })
})

test('실제 native 컨트롤러의 언어 변경은 초안과 선택을 유지하며 작업을 다시 접수하지 않는다', async ({ page }) => {
  const state = await native(page, 'REPLAYING', '언어를 바꿔도 이 입력은 보존')
  const composer = page.locator('.g-composer textarea')
  await expect(composer).toBeDisabled()
  const selected = page.locator('.native-history-list button[aria-current="true"]')
  await expect(selected).toHaveCount(1)
  await documentTab(page).click()
  await setLanguage(page, 'en')
  await expect(activity(page).locator('button.hd')).not.toContainText('전략 재생 중')
  await expect(researchNotice(page)).toBeVisible()
  await expect(researchNotice(page)).not.toContainText('전략 재생 중')
  await expect(selected).toHaveCount(1)
  await expect(selected).not.toContainText('작업 보기')
  await expect(composer).toHaveValue('언어를 바꿔도 이 입력은 보존')
  state.pollJobs.set(state.historyJob.backtestId, jobFor('VERIFYING'))
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'VERIFYING')
  await expect(activity(page)).not.toContainText('결과 검증 중')
  await setLanguage(page, 'ko')
  await backToConversation(page).click()
  await expect(activity(page).locator('button.hd')).toContainText('결과 검증 중')
  await expect(composer).toHaveValue('언어를 바꿔도 이 입력은 보존')
  expect(state.posts).toEqual([])
  expect(state.reportReads + state.otherResultReads).toBe(0)
})
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision, requestId: 'req_job_activity_fixture_0001', traceId: 'trace_job_activity_fixture_0001' })

async function native(page: Page, initial: State = 'QUEUED', unsentInput = '') {
  const initialJob = jobFor(initial)
  const state = { owner: ownerId, historyJob: initialJob, pollJobs: new Map([[initialJob.backtestId, initialJob]]), failPoll: false,
    holdPoll: undefined as ((id: string) => Promise<void>) | undefined, pollError: null as 'AUTHENTICATION_REQUIRED' | 'FORBIDDEN' | 'MALFORMED' | 'BAD_HEADERS' | 'BAD_UTF8' | 'INTERNAL_ERROR' | null,
    jobReads: [] as string[], pollFailures: 0, reportReads: 0, otherResultReads: 0, posts: [] as string[] }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, id }) => {
    if (sessionStorage.getItem('job-activity-fixture-initialized')) return
    sessionStorage.setItem('job-activity-fixture-initialized', '1')
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { owner: ownerId, id: ready.conversationId })
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"job_activity_session_etag_0001"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'),
    data: { sessionId: state.owner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_job_activity_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v3/**', route => {
    if (route.request().method() !== 'GET') { state.posts.push(new URL(route.request().url()).pathname); return route.abort('failed') }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"job_activity_draft_etag_0004"' }, body: JSON.stringify({ meta: meta('0.3.0', ready.conversationStateRevision), data: ready }) })
  })
  await page.route('**/api/v8/**', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"job_activity_history_etag_0004"', 'cache-control': 'no-store' }, body: JSON.stringify({ meta: meta('0.8.0', '4'),
    data: { conversationId: ready.conversationId, snapshotRevision: '4', limit: 50, rows: [{ approval, job: state.historyJob }] } }) }))
  await page.route('**/api/v7/**', async route => {
    const path = new URL(route.request().url()).pathname, id = path.split('/').at(-1)!
    if (route.request().method() !== 'GET') { state.posts.push(path); return route.abort('failed') }
    state.jobReads.push(id)
    const value = structuredClone(state.pollJobs.get(id))
    if (state.holdPoll) await state.holdPoll(id)
    if (state.failPoll || !value) { state.pollFailures++; return route.abort('failed') }
    if (state.pollError === 'BAD_HEADERS' || state.pollError === 'BAD_UTF8') return route.fulfill({ status: 200,
      contentType: 'application/json', headers: { ETag: `"job_activity_poll_etag_000${value.revision}"`, 'cache-control': state.pollError === 'BAD_HEADERS' ? 'public' : 'no-store' },
      body: state.pollError === 'BAD_UTF8' ? Buffer.from([0xff]) : JSON.stringify({ meta: meta('0.7.0', value.revision), data: value }) })
    if (state.pollError) return route.fulfill({ status: state.pollError === 'AUTHENTICATION_REQUIRED' ? 401 : state.pollError === 'FORBIDDEN' ? 403 : 500,
      contentType: 'application/json', headers: { 'cache-control': 'no-store' },
      body: state.pollError === 'MALFORMED' ? '{invalid' : JSON.stringify({ meta: meta('0.7.0', null), error: { code: state.pollError, message: 'Native job request failed.' } }) })
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: `"job_activity_poll_etag_000${value.revision}"`, 'cache-control': 'no-store' }, body: JSON.stringify({ meta: meta('0.7.0', value.revision), data: value }) })
  })
  await page.route(/\/api\/v[56]\//, route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/native-report')) state.reportReads++
    else state.otherResultReads++
    // Existing unissued COMPLETED schema fixture is not an issued result.
    // A deliberate report 404 checks error presentation, not readiness success.
    return route.fulfill({ status: 404, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ meta: meta('0.6.0', null), error: { code: 'NOT_FOUND', message: 'Native result request failed.' } }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  if (unsentInput) await page.locator('.g-composer textarea').fill(unsentInput)
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await page.getByRole('button', { name: '작업 보기', exact: true }).click()
  await expect(activity(page)).toHaveAttribute('data-native-job-state', initial)
  return state
}

// Controlled visibility events and virtual time exercise the real controller
// and generated SDK. This is not a real OS background-throttling benchmark.
async function visibility(page: Page, hidden: boolean) {
  await page.evaluate(hidden => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: hidden ? 'hidden' : 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}

test('숨겨진 브라우저 탭도 실제 상태를 계속 관측하며 복귀하면 즉시 따라잡고 종단에서 멈춘다', async ({ page }) => {
  await page.clock.install()
  const state = await native(page, 'REPLAYING', '다른 탭에 있어도 보존할 초안')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10))
  await visibility(page, true)
  const initial = state.jobReads.length
  await page.clock.runFor(29_000)
  expect(state.jobReads).toHaveLength(initial)
  state.pollJobs.set(state.historyJob.backtestId, jobFor('VERIFYING'))
  await page.clock.runFor(1000)
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'VERIFYING')
  expect(state.jobReads).toHaveLength(initial + 1)
  state.pollJobs.set(state.historyJob.backtestId, jobFor('FAILED'))
  await visibility(page, false)
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'FAILED')
  expect(state.jobReads).toHaveLength(initial + 2)
  await visibility(page, true); await visibility(page, false)
  await page.clock.runFor(60_000)
  expect(state.jobReads).toHaveLength(initial + 2)
  await expect(page.locator('.g-composer textarea')).toHaveValue('다른 탭에 있어도 보존할 초안')
  expect(state.posts).toEqual([])
})

for (const pollError of ['FORBIDDEN', 'AUTHENTICATION_REQUIRED', 'BAD_HEADERS'] as const) test(`${pollError} 이후 브라우저 탭 왕복이 자동 조회를 되살리지 않는다`, async ({ page }) => {
  await page.clock.install()
  const state = await native(page, 'REPLAYING')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10))
  state.pollError = pollError
  await page.clock.runFor(1500)
  await expect(page.locator('[data-native-polling="stopped"]')).toBeVisible()
  const reads = state.jobReads.length
  await visibility(page, true); await visibility(page, false)
  await page.clock.runFor(60_000)
  expect(state.jobReads).toHaveLength(reads)
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'REPLAYING')
  expect(state.posts).toEqual([])
})

test('소유자를 바꾼 후 탭을 복귀해도 이전 작업을 다시 조회하지 않는다', async ({ page }) => {
  await page.clock.install()
  const state = await native(page, 'REPLAYING')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10))
  await visibility(page, true)
  state.owner = 'session_job_visibility_other_0001'
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(activity(page)).toHaveCount(0)
  const reads = state.jobReads.length
  await visibility(page, false)
  await page.clock.runFor(60_000)
  expect(state.jobReads).toHaveLength(reads)
  expect(state.posts).toEqual([])
})

test('실제 controller의 완료 작업·보고서404는 같은 대화에 수치 없이 표시하며 owner 교체 때 제거한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 960 })
  const state = await native(page, 'COMPLETED')
  const summary = page.getByTestId('native-inline-result')
  await expect(summary).toHaveAttribute('data-state', 'error')
  await expect(summary).toBeVisible()
  await expect(summary).toHaveAttribute('data-backtest-id', state.historyJob.backtestId)
  await expect(summary.locator('[data-native-metric]')).toHaveCount(0)
  await expect(summary).not.toHaveAttribute('data-native-evidence')
  // The real dev entry uses StrictMode's existing two effect mounts. The
  // inline card must add no request when shown or when changing panes.
  await expect.poll(() => state.reportReads).toBe(2)
  await summary.getByRole('button', { name: '리포트와 차트 보기', exact: true }).click()
  await expect(page.locator('.native-analysis-result')).toBeFocused()
  await expect(page.getByRole('button', { name: '보고서 다시 조회', exact: true })).toBeVisible()
  await page.locator('[data-analysis-tab="chat"]').click()
  await expect(summary).toBeVisible()
  expect(state.reportReads).toBe(2)
  expect(state.otherResultReads).toBe(0)
  expect(state.posts).toEqual([])
  state.owner = 'session_job_activity_other_0001'
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(summary).toHaveCount(0)
  await expect(page.locator('.native-service-result')).toHaveCount(0)
})

test('native poll은 실제 상태 흐름을 남기며 문서 탭에서도 진행되고 접은 선택을 유지한다', async ({ page }, info) => {
  const state = await native(page), id = state.historyJob.backtestId
  const header = activity(page).locator('button.hd')
  await expect(header).toHaveAttribute('aria-expanded', 'true')
  await header.click()
  for (const next of ['PREPARING_DATA', 'VALIDATING', 'REPLAYING', 'VERIFYING', 'TERMINAL_READY'] as const) {
    if (next === 'VERIFYING') await documentTab(page).click()
    state.pollJobs.set(id, jobFor(next))
    await expect(activity(page)).toHaveAttribute('data-native-job-state', next)
    await expect(header).toContainText(labels[next])
    await expect(header).toHaveAttribute('aria-expanded', 'false')
    await expect(activity(page).locator('.g-act2')).toHaveCount(1)
    await expect(activity(page).locator('.tlin > li')).toHaveCount(1)
    await expect(activity(page).locator('.els')).toHaveCount(0)
  }
  await expect(researchNotice(page)).toBeVisible()
  await expect(researchNotice(page)).toContainText(labels.TERMINAL_READY)
  await backToConversation(page).click()
  await expect(region(page)).toBeVisible()
  await header.click()
  await expect(activity(page).locator('.cot2')).toBeVisible()
  for (const name of ['QUEUED', 'PREPARING_DATA', 'VALIDATING', 'REPLAYING', 'VERIFYING', 'TERMINAL_READY'] as const) {
    await expect(activity(page).locator('.cot2')).toContainText(labels[name])
  }
  await expect(activity(page).locator('.cot2')).not.toContainText(labels.COMPLETED)
  await page.screenshot({ path: info.outputPath('observed-job-progress.png') })
  expect(state.reportReads + state.otherResultReads).toBe(0)
  expect(state.posts).toEqual([])
})

test('통신 복구 후 사용자 재접수 없이 같은 작업을 문서 탭에서 다시 관측한다', async ({ page }) => {
  const state = await native(page, 'REPLAYING', '통신 복구 중에도 유지할 초안')
  state.failPoll = true
  await expect.poll(() => state.pollFailures).toBeGreaterThan(0)
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'REPLAYING')
  await documentTab(page).click()
  state.pollJobs.set(state.historyJob.backtestId, jobFor('VERIFYING'))
  state.failPoll = false
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'VERIFYING', { timeout: 10_000 })
  await expect(page.locator('[data-native-polling]')).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue('통신 복구 중에도 유지할 초안')
  expect(new Set(state.jobReads)).toEqual(new Set([state.historyJob.backtestId]))
  expect(state.posts).toEqual([])
  expect(state.reportReads + state.otherResultReads).toBe(0)
})

test('SDK INTERNAL_ERROR 복구는 같은 작업만 다시 읽고 열린 안내의 언어 변경은 요청을 만들지 않는다', async ({ page }) => {
  const state = await native(page, 'REPLAYING')
  state.pollError = 'INTERNAL_ERROR'
  const notice = page.locator('[data-native-polling="retrying"]')
  await expect(notice).toBeVisible()
  const reads = state.jobReads.length
  await setLanguage(page, 'fr'); await expect(notice).toContainText('La réponse')
  expect(state.jobReads).toHaveLength(reads)
  state.pollError = null
  state.pollJobs.set(state.historyJob.backtestId, jobFor('FAILED'))
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'FAILED')
  await expect(page.locator('[data-native-polling]')).toHaveCount(0)
  expect(state.posts).toEqual([])
})

for (const width of [320, 1440]) test(`${width}px 조회 복구 안내는 기존 작업 상태 아래에서 읽히며 버튼과 겹치지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await native(page, 'REPLAYING')
  state.failPoll = true
  const notice = page.locator('[data-native-polling="retrying"]')
  await expect(notice).toBeVisible()
  await setLanguage(page, 'fr')
  await notice.scrollIntoViewIfNeeded()
  const button = page.locator('.native-job-refresh')
  const text = await notice.boundingBox(), action = await button.boundingBox()
  expect(text!.x).toBeGreaterThanOrEqual(0); expect(text!.x + text!.width).toBeLessThanOrEqual(width + 1)
  expect(text!.y + text!.height).toBeLessThanOrEqual(action!.y)
  expect(action!.height).toBeGreaterThanOrEqual(44)
  expect(await notice.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`poll-retry-fr-${width}.png`) })
})

for (const error of ['AUTHENTICATION_REQUIRED', 'FORBIDDEN', 'MALFORMED', 'BAD_HEADERS', 'BAD_UTF8', 'BINDING_CONFLICT'] as const) test(`${error}: SDK/결속 거절 후 자동 조회는 멈추고 명시 조회로만 재개한다`, async ({ page }) => {
  const state = await native(page, 'REPLAYING')
  if (error === 'BINDING_CONFLICT') {
    const value = jobFor('VERIFYING')
    state.pollJobs.set(state.historyJob.backtestId, { ...value, profileContentHash: value.profileContentHash === 'a'.repeat(64) ? 'b'.repeat(64) : 'a'.repeat(64) })
  } else state.pollError = error
  await expect(page.locator('[data-native-polling="stopped"]')).toContainText('자동 조회를 멈췄습니다')
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'REPLAYING')
  const reads = state.jobReads.length
  await page.waitForTimeout(3700)
  expect(state.jobReads).toHaveLength(reads)
  state.pollError = null; state.pollJobs.set(state.historyJob.backtestId, jobFor('FAILED'))
  await page.getByRole('button', { name: '상태 다시 조회', exact: true }).click()
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'FAILED')
  await expect(page.locator('[data-native-polling]')).toHaveCount(0)
  expect(state.jobReads).toHaveLength(reads + 1); expect(state.posts).toEqual([])
})

test('느린 자동 조회와 수동 조회는 같은 GET을 공유하며 별도 작업을 생성하지 않는다', async ({ page }) => {
  const state = await native(page, 'REPLAYING')
  let release!: () => void
  state.pollJobs.set(state.historyJob.backtestId, jobFor('FAILED'))
  state.holdPoll = () => new Promise(resolve => { release = resolve })
  const reads = state.jobReads.length
  await expect.poll(() => typeof release).toBe('function')
  await page.getByRole('button', { name: '상태 다시 조회', exact: true }).click()
  await expect(page.getByRole('button', { name: '상태 다시 조회', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '현재 초안 수정하기', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: '이 대화의 실행 이력', exact: true })).toBeEnabled()
  expect(state.jobReads).toHaveLength(reads + 1)
  state.holdPoll = undefined; release()
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'FAILED')
  expect(state.jobReads).toHaveLength(reads + 1); expect(state.posts).toEqual([])
})

test('활성 작업의 명시 재조회에서 인증 거절을 받으면 기존 세션 복구 경계로 전환한다', async ({ page }) => {
  const state = await native(page, 'REPLAYING')
  state.pollError = 'AUTHENTICATION_REQUIRED'
  await expect(page.locator('[data-native-polling="stopped"]')).toBeVisible()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await page.getByRole('button', { name: '상태 다시 조회', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  await expect(page.locator('.client-service-issue')).toContainText('AUTHENTICATION_REQUIRED')
  await expect(page.getByRole('button', { name: '현재 초안 수정하기', exact: true })).toBeDisabled()
  expect(state.posts).toEqual([])
})

test('poll 오류는 마지막 서버 상태를 실패로 바꾸지 않으며 명시 재조회도 지원한다', async ({ page }) => {
  const state = await native(page, 'REPLAYING')
  state.failPoll = true
  await expect(page.locator('[data-native-polling="retrying"]')).toContainText('상태 응답을 확인하지 못해')
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'REPLAYING')
  await expect(activity(page).locator('button.hd')).toContainText(labels.REPLAYING)
  const reads = state.jobReads.length
  await page.waitForTimeout(1700)
  expect(state.jobReads).toHaveLength(reads)
  state.failPoll = false
  state.pollJobs.set(state.historyJob.backtestId, jobFor('VERIFYING'))
  await page.getByRole('button', { name: '상태 다시 조회', exact: true }).click()
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'VERIFYING')
  await expect(activity(page).locator('time')).toHaveAttribute('datetime', jobFor('VERIFYING').updatedAt)
  expect(state.posts).toEqual([])
})

test('TERMINAL_READY는 완료나 결과 준비가 아니며 결과 GET을 시작하지 않는다', async ({ page }) => {
  const state = await native(page, 'TERMINAL_READY')
  await expect(activity(page).locator('button.hd')).toContainText(labels.TERMINAL_READY)
  await expect(activity(page)).toContainText('아직 결과를 조회할 수 없습니다.')
  await activity(page).locator('.native-job-metadata summary').click()
  await expect(activity(page).locator('dt').filter({ hasText: /^결과 조회$/ }).locator('xpath=following-sibling::dd[1]')).toHaveText('아직 불가')
  await page.waitForTimeout(1700)
  expect(state.jobReads.length).toBeGreaterThan(0)
  expect(state.reportReads + state.otherResultReads).toBe(0)
  await expect(page.getByRole('region', { name: '백테스트 결과', exact: true })).toHaveCount(0)
})

test('기존 unissued COMPLETED job의 결과 404는 완료 상태와 구분하며 문서 왕복으로 재요청하지 않는다', async ({ page }) => {
  const state = await native(page, 'COMPLETED')
  const pane = async (name: '대화' | '차트·분석') => {
    const tabs = page.getByRole('tablist', { name: '대화와 결과 보기' })
    if (await tabs.isVisible()) await tabs.getByRole('tab', { name, exact: true }).click()
  }
  await pane('차트·분석')
  await expect(page.getByRole('button', { name: '보고서 다시 조회', exact: true })).toBeVisible()
  // The actual native entry is wrapped in React development StrictMode. Its
  // initial passive-effect replay is distinct from an application retry.
  // Confirmed independently at report() entry: commitPassiveMountOnFiber then
  // reconnectPassiveEffects → doubleInvokeEffectsOnFiber. This final native
  // regression runs the unchanged product source without that instrumentation.
  await expect.poll(() => state.reportReads).toBe(2)
  await page.waitForTimeout(2000)
  expect(state.reportReads).toBe(2)
  await pane('대화')
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'COMPLETED')
  await expect(activity(page).locator('button.hd')).toContainText(labels.COMPLETED)
  await documentTab(page).click()
  await expect(researchNotice(page)).toBeVisible()
  await expect(researchNotice(page)).toContainText('결과 확인 필요')
  await page.locator('.native-plan-technical > summary').click()
  await expect(page.locator('.native-strategy-document')).toBeVisible()
  await backToConversation(page).click()
  expect(state.reportReads).toBe(2)
  await pane('차트·분석')
  await page.getByRole('button', { name: '보고서 다시 조회', exact: true }).click()
  await expect.poll(() => state.reportReads).toBe(3)
  await expect(page.getByRole('button', { name: '보고서 다시 조회', exact: true })).toBeVisible()
  expect(state.otherResultReads).toBe(0)
  expect(state.posts).toEqual([])
})

for (const boundary of ['new-conversation', 'new-owner'] as const) test(`${boundary} 이후 늦은 기존 job poll은 작업 기록을 되살리지 않는다`, async ({ page }) => {
  const state = await native(page)
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  state.holdPoll = () => held
  await expect.poll(() => state.jobReads.length).toBeGreaterThan(0)
  if (boundary === 'new-owner') {
    state.owner = 'session_job_activity_other_0001'
    await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    await expect(page.getByRole('alert')).toContainText('세션이 변경되어')
  } else {
    if (await page.getByRole('button', { name: '새 전략', exact: true }).isVisible()) await page.getByRole('button', { name: '새 전략', exact: true }).click()
    else { await revealSourceNavigation(page); await page.getByRole('button', { name: '메뉴', exact: true }).click(); await page.getByRole('button', { name: '＋ 새 전략', exact: true }).click() }
    await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
    await expect(page.locator('.client-service-app')).toHaveClass(/view-landing/)
  }
  release(); await page.waitForTimeout(100)
  await expect(activity(page)).toHaveCount(0)
  await expect(page.locator('.g-conversation-notice')).toHaveCount(0)
  await expect(researchNotice(page)).toHaveCount(0)
  expect(state.reportReads + state.otherResultReads).toBe(0)
  expect(state.posts).toEqual([])
})

test('다른 job 명시 선택 후 늦은 이전 poll은 새 job의 상태와 설명을 덮지 않는다', async ({ page }) => {
  const state = await native(page), old = state.historyJob.backtestId
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  state.holdPoll = id => id === old ? held : Promise.resolve()
  await expect.poll(() => state.jobReads.length).toBeGreaterThan(0)
  const next = jobFor('FAILED', 'backtest_job_activity_next_0002')
  state.historyJob = next; state.pollJobs.set(next.backtestId, next)
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await page.getByRole('button', { name: '작업 보기', exact: true }).click()
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'FAILED')
  release(); await page.waitForTimeout(100)
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'FAILED')
  await expect(activity(page)).toContainText('구체적인 실패 사유는 서버에서 제공하지 않았습니다.')
  await activity(page).locator('.native-job-metadata summary').click()
  await expect(activity(page)).toContainText(next.backtestId)
  expect(state.posts).toEqual([])
})

async function isolated(page: Page, job: unknown, rawActivity = false) {
  await page.route('**/job-activity-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div></body></html>' }))
  await page.goto('/job-activity-fixture.html')
  await page.evaluate(async ({ initial, rawActivity }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/ClientServiceExperience.tsx', jp = '/src/internal-poc/NativeJobActivity.tsx', ap = '/src/components/ClientResearchActivity.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement, dom = await import(/* @vite-ignore */ dp)
    await import(/* @vite-ignore */ cp)
    const { NativeJobActivity } = await import(/* @vite-ignore */ jp), { ClientResearchActivity } = await import(/* @vite-ignore */ ap)
    const audit = { intervals: 0, elapsedDateReads: 0 }
    const originalInterval = window.setInterval.bind(window), originalNow = Date.now
    window.setInterval = ((...args: Parameters<typeof setInterval>) => { audit.intervals++; return originalInterval(...args) }) as typeof setInterval
    Date.now = () => { if (/ElapsedTime|ClientResearchActivity/.test(new Error().stack ?? '')) audit.elapsedDateReads++; return originalNow() }
    function Host() {
      const [value, setValue] = react.useState(initial)
      Object.assign(window, { setIsolatedJobActivity: setValue })
      return h('div', { className: 'client-service-app client-lab-conversation', style: { padding: '20px', display: 'block', minHeight: '100vh', fontFamily: 'Noto Sans KR Variable, sans-serif' } },
        rawActivity ? h(ClientResearchActivity, { source: 'service', label: '관측된 현재 상태', status: 'running', ...(value === 'omitted' ? {} : { startedAt: value === 'NaN' ? NaN : Infinity }), steps: [{ id: 'current', title: '현재 서버 상태', status: 'running' }] }) : h(NativeJobActivity, { job: value }))
    }
    Object.assign(window, { isolatedJobAudit: audit })
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  }, { initial: job, rawActivity })
  await expect(page.locator('.g-act2')).toHaveCount(1)
}

for (const state of Object.keys(labels) as State[]) test(`격리 ${state}: 현재 상태 1개만 표시하고 단계 이력·시간·진행률을 발명하지 않는다`, async ({ page }) => {
  // Includes schema-only COMPLETED display, not an issued result assertion.
  await isolated(page, jobFor(state))
  await expect(activity(page).locator('button.hd')).toContainText(labels[state])
  await expect(activity(page).locator('.tlin > li')).toHaveCount(1)
  await expect(activity(page).locator('.els')).toHaveCount(0)
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(activity(page).locator('time')).toHaveAttribute('datetime', jobFor(state).updatedAt)
  await page.waitForTimeout(40)
  expect(await page.evaluate(() => Reflect.get(window, 'isolatedJobAudit'))).toEqual({ intervals: 0, elapsedDateReads: 0 })
})

for (const [reason, label] of Object.entries(reasons)) test(`격리 INVALID ${reason}: 접힌 상태에서도 정확한 무효 사유와 코드를 보여준다`, async ({ page }) => {
  await isolated(page, { ...jobFor('INVALID'), invalidReason: reason })
  await expect(activity(page).locator('button.hd')).toHaveAttribute('aria-expanded', 'false')
  await expect(activity(page).locator('.native-job-problem strong')).toHaveText(label)
  await expect(activity(page).locator('.native-job-problem code')).toHaveText(reason)
  await expect(activity(page).locator('.native-job-problem')).toBeVisible()
})

test('격리 상태 건너뛰기·동일 폴링·다른 작업은 설명 흐름을 만들거나 섞지 않는다', async ({ page }) => {
  await isolated(page, jobFor('QUEUED'))
  const set = (value: NativeJob) => page.evaluate(next => Reflect.get(window, 'setIsolatedJobActivity')(next), value)
  await set(jobFor('REPLAYING'))
  const log = activity(page).locator('.cot2')
  await expect(log).toContainText(labels.QUEUED)
  await expect(log).toContainText(labels.REPLAYING)
  await expect(log).not.toContainText(labels.PREPARING_DATA)
  await expect(log).not.toContainText(labels.VALIDATING)
  const text = await log.textContent()
  await set({ ...jobFor('REPLAYING'), revision: '5', updatedAt: '2026-09-10T00:05:00Z' })
  await expect(log).toHaveText(text!)
  await set(jobFor('REPLAYING', 'bt_observation_other_0001'))
  await expect(log).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'isolatedJobAudit'))).toEqual({ intervals: 0, elapsedDateReads: 0 })
})

test('완료 후에도 과거 상태는 일반 텍스트이며 개행·UTC 표기와 원본 펼침을 유지한다', async ({ page }) => {
  const queued = jobFor('QUEUED')
  await isolated(page, queued)
  // Isolated presentation only, not an issued/SDK-validated result binding.
  const complete = { ...jobFor('COMPLETED'), backtestId: queued.backtestId, splitGroupId: queued.splitGroupId,
    strategyVersionId: queued.strategyVersionId, semanticHash: queued.semanticHash, profileContentHash: queued.profileContentHash }
  await page.evaluate(value => Reflect.get(window, 'setIsolatedJobActivity')(value), complete)
  await expect(activity(page)).toHaveAttribute('data-native-job-state', 'COMPLETED')
  await activity(page).locator('button.hd').click()
  await activity(page).locator('button.arh').click()
  const log = activity(page).locator('.cot2')
  await expect(log).toBeVisible()
  const rendered = await log.evaluate(node => ({ whiteSpace: getComputedStyle(node).whiteSpace,
    text: node.textContent, children: node.childElementCount }))
  expect(rendered.whiteSpace).toBe('pre-wrap')
  expect(rendered.text?.split('\n')).toHaveLength(4)
  expect(rendered.text).toContain('UTC')
  expect(rendered.children).toBe(0)
  await expect(activity(page).locator('.tlin > .ar.done')).toHaveCount(1)
  await expect(log).not.toContainText(labels.PREPARING_DATA)
  await expect(activity(page).locator('.els')).toHaveCount(0)
})

for (const value of ['omitted', 'NaN', 'Infinity']) test(`격리 shared Activity ${value} 시작 시각은 Date 경과 계산·타이머를 시작하지 않는다`, async ({ page }) => {
  await isolated(page, value, true)
  await page.waitForTimeout(2100)
  await expect(page.locator('.els')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'isolatedJobAudit'))).toEqual({ intervals: 0, elapsedDateReads: 0 })
})

for (const width of [320, 1440]) test(`${width}px native 현재 상태의 접힘·키보드·작업 정보·문서 복귀를 확인한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await native(page, 'REPLAYING')
  const header = activity(page).locator('button.hd')
  await header.focus(); await page.keyboard.press('Enter')
  await expect(header).toHaveAttribute('aria-expanded', 'false')
  await expect(header).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(header).toHaveAttribute('aria-expanded', 'true')
  await activity(page).locator('.native-job-metadata summary').click()
  await page.evaluate(() => document.fonts.ready)
  await header.evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }))
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  const geometry = { header: await header.boundingBox(), composer: await page.locator('.g-composer').boundingBox(),
    metadata: await activity(page).locator('.native-job-metadata').boundingBox() }
  expect(geometry.header).not.toBeNull()
  expect(geometry.header!.x).toBeGreaterThanOrEqual(0)
  expect(geometry.header!.x + geometry.header!.width).toBeLessThanOrEqual(width + 1)
  if (geometry.composer) expect(geometry.header!.y + geometry.header!.height).toBeLessThanOrEqual(geometry.composer.y)
  await testInfo.attach(`job-activity-geometry-${width}.json`, { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' })
  await page.screenshot({ path: testInfo.outputPath(`native-job-activity-${width}.png`), fullPage: true })
  await documentTab(page).click()
  await expect(researchNotice(page)).toBeVisible()
  await expect(researchNotice(page)).toContainText(labels.REPLAYING)
  await backToConversation(page).click()
  await expect(region(page)).toBeVisible()
  expect(state.reportReads + state.otherResultReads).toBe(0)
  expect(state.posts).toEqual([])
})
