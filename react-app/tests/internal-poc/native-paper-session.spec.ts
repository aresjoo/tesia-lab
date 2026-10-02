import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { openNativeAccountMenu as openObservedNativeAccountMenu } from './native-account-test-helpers'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

// Synthetic HTTP contracts with the real native entry, SDK, catalog, adapter
// and existing Paper renderer. No engine/provider/market authority is implied.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })
test.setTimeout(30_000)
async function openNativeAccountMenu(page: Page) {
  if (!await page.locator('.client-settings-page').isVisible()) await revealSourceNavigation(page)
  return openObservedNativeAccountMenu(page)
}

const ready = conversationFixture.snapshots.ready
const approval = conversationFixture.documents.find(item => item.name === 'approval')!.value
const owner = 'session_paper_fixture_0001'
const paperId = 'paper_session_native_0001'
const fixtureId = 'paper_fixture_compiler_rsi14_btcusdt_15m_01'
const artifact = { fixtureId, dataClass: 'SYNTHETIC_RECORDED_MARKET_FIXTURE', symbol: 'BTCUSDT', sourceTimeframe: '1m', evaluationTimeframe: '15m',
  eventCount: 16, firstOpenTime: '2026-01-01T00:00:00Z', lastCloseTime: '2026-01-01T03:45:00Z', fileSha256: 'a'.repeat(64), contentHash: 'b'.repeat(64),
  provenanceHash: 'c'.repeat(64), policyHash: 'd'.repeat(64), manifestSha256: null, privateOnly: true, verified: false, verificationStatus: 'SYNTHETIC_ONLY' }
const binding = { artifactId: fixtureId, source: 'PACKAGED_SYNTHETIC', fileSha256: artifact.fileSha256, contentHash: artifact.contentHash,
  provenanceHash: artifact.provenanceHash, policyHash: artifact.policyHash, manifestSha256: null, verificationStatus: 'SYNTHETIC_ONLY' }
const status = { paperSessionId: paperId, strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash, fixtureId, state: 'QUEUED', revision: '1', attempt: '0',
  createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z', resultAvailable: false,
  provenance: { dataClass: 'SYNTHETIC_RECORDED_MARKET_FIXTURE', verified: false, privateOnly: true } }
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_native_paper_fixture_01', traceId: 'trace_native_paper_fixture_01', resourceRevision: revision })
const internal = (revision: string | null) => ({ internalContractVersion: 'owner-local-paper-api/0.1', requestId: 'req_native_paper_fixture_01', traceId: 'trace_native_paper_fixture_01', resourceRevision: revision })
const scope = { sessionId: owner, strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash, strategyVersionContentHash: approval.strategyVersionContentHash }
const canonical = (value: Record<string, unknown>) => `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${JSON.stringify(value[key])}`).join(',')}}`
const scopePrefix = (value = scope) => `tesia.native.paper.${createHash('sha256').update(canonical(value)).digest('hex')}`
const paper = (page: Page) => page.getByRole('region', { name: '승인 전략의 기록 Paper', exact: true })
const open = (page: Page) => page.getByRole('button', { name: '기록 Paper 열기', exact: true }).click()
async function select(page: Page) {
  await paper(page).getByRole('radio').first().check()
  await expect(paper(page).getByRole('button', { name: 'Paper 실행', exact: true })).toBeEnabled()
}
async function setup(page: Page) {
  const controls = { owner, revision: '1', etag: '"native_paper_session_0001"', absent: false, failSession: false, changedDraft: false,
    catalogCode: 200, catalogEmpty: false, postCode: 201, readCode: 200, loseStart: false, reads: 0, catalogs: 0,
    posts: [] as { key: string; body: Record<string, unknown>; csrf: string }[], apiPosts: [] as string[],
    holdCatalog: undefined as (() => Promise<void>) | undefined, holdPost: undefined as (() => Promise<void>) | undefined, holdRead: undefined as (() => Promise<void>) | undefined }
  await page.addInitScript(({ owner, id }) => { sessionStorage.setItem('tesia.native.conversation', id); sessionStorage.setItem('tesia.native.conversation-session', owner) }, { owner, id: ready.conversationId })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() === 'POST') controls.apiPosts.push(path)
    let data: unknown, version = '0.1.0', revision: string | null = controls.revision, etag = controls.etag
    if (path === '/api/v1/auth/session') {
      if (controls.failSession) return route.abort()
      if (controls.absent) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ meta: meta(version, null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic session absent' } }) })
      data = { sessionId: controls.owner, state: 'AUTHENTICATED', revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
    } else if (path === '/api/v1/auth/csrf') { data = { csrfToken: 'csrf_native_paper_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' }; revision = null }
    else if (path.startsWith('/api/v3/conversations/')) { data = controls.changedDraft ? { ...ready, semanticHash: 'f'.repeat(64) } : ready; version = '0.3.0'; revision = ready.conversationStateRevision; etag = '"native_paper_conversation_0004"' }
    else if (path.startsWith('/api/v8/')) { data = { conversationId: ready.conversationId, snapshotRevision: '5', limit: 50, rows: [{ approval, job: null }] }; version = '0.8.0'; revision = '5'; etag = '"native_paper_history_0005"' }
    else if (path === '/api/v1/auth/logout') { controls.absent = true; data = { sessionId: controls.owner, state: 'REVOKED', revision: '2', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }; revision = '2'; etag = '"native_paper_revoked_0002"' }
    else return route.abort()
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ...(revision === null ? {} : { ETag: etag }), 'Cache-Control': 'no-store' }, body: JSON.stringify({ meta: meta(version, revision), data }) })
  })
  await page.route('**/internal/poc/**', async route => {
    const path = new URL(route.request().url()).pathname
    let code: number, data: unknown = status
    if (path === '/internal/poc/market-artifacts') {
      controls.catalogs++; if (controls.holdCatalog) await controls.holdCatalog()
      code = controls.catalogCode; data = { artifacts: controls.catalogEmpty ? [] : [artifact] }
    } else if (route.request().method() === 'POST') {
      controls.posts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON(), csrf: route.request().headers()['x-csrf-token'] })
      if (controls.holdPost) await controls.holdPost()
      if (controls.loseStart) return route.abort()
      code = controls.postCode
    } else { controls.reads++; if (controls.holdRead) await controls.holdRead(); code = controls.readCode }
    return route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(code >= 400
      ? { meta: internal(null), error: { code: code === 401 ? 'AUTHENTICATION_REQUIRED' : code === 403 ? 'FORBIDDEN' : code === 409 ? 'PAPER_STRATEGY_FIXTURE_MISMATCH' : 'NOT_FOUND', message: 'Synthetic recorded service response' } }
      : { meta: internal(path.endsWith('market-artifacts') ? null : '1'), data }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await page.getByRole('button', { name: '이 승인 버전 선택', exact: true }).click()
  await expect(page.getByRole('button', { name: '기록 Paper 열기', exact: true })).toBeEnabled()
  return controls
}

test('명시 열기→서버 catalog 선택→명시 Paper POST, FULL과 기존 승인을 바꾸지 않는다', async ({ page }) => {
  const controls = await setup(page)
  expect(controls.catalogs).toBe(0); expect(controls.posts).toHaveLength(0)
  await open(page); await select(page)
  expect(controls.posts).toHaveLength(0)
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect(paper(page)).toContainText('서버 상태 revision 1 · attempt 0')
  expect(controls.posts).toHaveLength(1)
  expect(controls.posts[0].body).toEqual({ strategyVersionId: approval.strategyVersionId, expectedSemanticHash: approval.semanticHash, fixtureId })
  expect(controls.posts[0].csrf).toBe('csrf_native_paper_fixture_0001')
  expect(controls.apiPosts).toHaveLength(0)
  await expect(paper(page)).toContainText('FULL 백테스트가 아닙니다')
  await expect(paper(page)).toContainText('exitRulesEvaluated=false')
  await paper(page).getByRole('button', { name: '기록 Paper 화면 닫기' }).click()
  await open(page)
  await expect(paper(page)).toContainText('서버 상태 revision 1 · attempt 0')
  expect(controls.posts).toHaveLength(1); expect(controls.reads).toBeGreaterThan(0)
})

test('응답 소실 후 닫기/다시 열기 및 reload는 명시 같은 key만 재전송한다', async ({ page }) => {
  const controls = await setup(page); controls.loseStart = true
  await open(page); await select(page)
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect(paper(page).getByRole('button', { name: '동일 요청 재전송' })).toBeVisible()
  const before = await page.evaluate(key => sessionStorage.getItem(key), scopePrefix() + '.pending')
  expect(before).not.toBeNull()
  await page.reload()
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await page.getByRole('button', { name: '이 승인 버전 선택', exact: true }).click()
  await open(page); await select(page)
  expect(controls.posts).toHaveLength(1)
  controls.loseStart = false
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect(paper(page)).toContainText('서버 상태 revision 1 · attempt 0')
  expect(controls.posts).toHaveLength(2); expect(controls.posts[1].key).toBe(controls.posts[0].key)
  expect(controls.posts[1].body).toEqual(controls.posts[0].body)
})

for (const variant of ['id', 'revision', 'etag', 'absent', 'network'] as const) test(`열기 전 fresh session ${variant} 거절은 catalog/POST를 보내지 않는다`, async ({ page }) => {
  const controls = await setup(page)
  if (variant === 'id') controls.owner = 'session_paper_other_0002'
  if (variant === 'revision') controls.revision = '2'
  if (variant === 'etag') controls.etag = '"native_paper_session_changed"'
  if (variant === 'absent') controls.absent = true
  if (variant === 'network') controls.failSession = true
  await open(page)
  await expect(page.getByRole('alert').first()).toBeVisible()
  await expect(paper(page)).toHaveCount(0)
  expect(controls.posts).toHaveLength(0); expect(controls.catalogs).toBe(0)
})

for (const code of [401, 403, 404, 409]) test(`실행 응답 ${code}: 성공/성과를 만들지 않고 pending을 보존한다`, async ({ page }) => {
  const controls = await setup(page); controls.postCode = code
  await open(page); await select(page)
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect(paper(page).getByRole('alert').first()).toBeVisible()
  expect(await page.evaluate(key => sessionStorage.getItem(key) !== null, scopePrefix() + '.pending')).toBe(true)
  await expect(paper(page)).not.toContainText('COMPLETED_LOCAL_FIXTURE_ONLY')
  expect(controls.posts).toHaveLength(1)
})

for (const empty of [false, true]) test(`catalog ${empty ? '빈 목록' : '미준비404'}은 fixture를 만들어 실행하지 않는다`, async ({ page }) => {
  const controls = await setup(page); controls.catalogEmpty = empty; controls.catalogCode = empty ? 200 : 404
  await open(page)
  await expect(paper(page)).toContainText(empty ? '사용 가능한 owner-local artifact가 없습니다' : '서버')
  await expect(paper(page).getByRole('button', { name: 'Paper 실행', exact: true })).toBeDisabled()
  expect(controls.posts).toHaveLength(0)
})

test('늦은 catalog 응답은 명시 현재 초안 수정 뒤 Paper를 다시 표시하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  let release = () => {}; controls.holdCatalog = () => new Promise<void>(resolve => { release = resolve })
  await open(page); await expect.poll(() => controls.catalogs).toBeGreaterThan(0)
  await page.getByRole('button', { name: '현재 초안 수정하기', exact: true }).click()
  release(); await expect(page.locator('textarea').first()).toBeEnabled()
  await expect(paper(page)).toHaveCount(0); expect(controls.posts).toHaveLength(0)
})

test('두 번 동기 클릭은 동일 Paper POST를 하나만 만든다', async ({ page }) => {
  const controls = await setup(page)
  await open(page); await select(page)
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(paper(page)).toContainText('서버 상태 revision 1 · attempt 0')
  expect(controls.posts).toHaveLength(1)
})

test('scope별 모든 연산은 타계정 pending과 legacy키를 읽거나 삭제하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await open(page); await select(page); controls.loseStart = true
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect(paper(page).getByRole('button', { name: '동일 요청 재전송' })).toBeVisible()
  const result = await page.evaluate(async ({ scope, binding }) => {
    const { createLocalPaperApiAdapter, LOCAL_PAPER_PENDING_REQUEST_KEY } = await import('/src/internal-poc/local-paper-api-adapter.ts')
    const before = JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))
    const other = await createLocalPaperApiAdapter({ ...scope, sessionId: 'session_paper_other_0002' })
    const read = await other.readActive(scope), pending = other.hasPendingRequest!()
    other.invalidateArtifactBinding!(binding.artifactId); other.resetLocalView!()
    return { pending, snapshot: read.snapshot, unchanged: before === JSON.stringify(Object.fromEntries(Object.entries(sessionStorage))), legacy: sessionStorage.getItem(LOCAL_PAPER_PENDING_REQUEST_KEY) }
  }, { scope, binding })
  expect(result).toEqual({ pending: false, snapshot: null, unchanged: true, legacy: null })
  expect(controls.posts).toHaveLength(1); expect(controls.reads).toBe(0)
})

test('16개 저장 scope 상한은 타scope bytes를 보존하고 새 POST를 보내지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await page.evaluate(() => { for (let i=0; i<16; i++) sessionStorage.setItem(`tesia.native.paper.${i.toString(16).padStart(64, '0')}.pending`, 'preserved-opaque-existing') })
  await open(page); await select(page)
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect(paper(page)).toContainText('보관 한도(16개)')
  expect(controls.posts).toHaveLength(0)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('tesia.native.paper.')).length)).toBe(16)
})

test('소실된 POST 뒤 catalog 실패는 원 pending bytes와 재전송 key를 보존한다', async ({ page }) => {
  const controls = await setup(page); controls.loseStart = true
  await open(page); await select(page)
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect(paper(page).getByRole('button', { name: '동일 요청 재전송' })).toBeVisible()
  const before = await page.evaluate(key => sessionStorage.getItem(key), scopePrefix() + '.pending')
  expect(before).not.toBeNull()
  controls.catalogCode = 404
  await paper(page).getByRole('button', { name: '목록 다시 불러오기', exact: true }).click()
  await expect.poll(() => controls.catalogs).toBeGreaterThan(1)
  await expect(paper(page).getByText(/목록 응답을 확인하지 못했습니다|내용을 숨겼습니다/)).toBeVisible()
  expect(await page.evaluate(({ key, before }) => sessionStorage.getItem(key) === before, { key: scopePrefix() + '.pending', before })).toBe(true)
  await expect(paper(page)).toContainText('내용을 숨겼습니다')
  await paper(page).getByRole('button', { name: '기록 Paper 화면 닫기' }).click()
  controls.catalogCode = 200; controls.loseStart = false
  await open(page); await select(page)
  expect(controls.posts).toHaveLength(1)
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect(paper(page)).toContainText('서버 상태 revision 1 · attempt 0')
  expect(controls.posts[1].key).toBe(controls.posts[0].key)
})

for (const code of [401, 403]) test(`기존 queued 조회 ${code}는 이전 표시를 숨기고 pointer를 보존한다`, async ({ page }) => {
  const controls = await setup(page)
  await open(page); await select(page)
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect(paper(page)).toContainText('서버 상태 revision 1 · attempt 0')
  controls.readCode = code
  await paper(page).getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(paper(page)).toContainText('내용을 숨겼습니다')
  await expect(paper(page)).not.toContainText('서버 상태 revision 1 · attempt 0')
  expect(await page.evaluate(key => sessionStorage.getItem(key) !== null, scopePrefix() + '.pointer')).toBe(true)
  expect(controls.posts).toHaveLength(1)
})

test('POST 도중 다른 owner로 교체되면 늦은 결과는 표시하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  let release = () => {}; controls.holdPost = () => new Promise<void>(resolve => { release = resolve })
  await open(page); await select(page)
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect.poll(() => controls.posts.length).toBe(1)
  controls.owner = 'session_paper_changed_0002'; release()
  await expect(paper(page)).toHaveCount(0)
  await expect(page.getByRole('alert').first()).toBeVisible()
  expect(controls.posts).toHaveLength(1)
})

test('미확정 로컬 요청 폐기는 두 번째 명시 확인 뒤만, 서버 취소 POST는 없다', async ({ page }) => {
  const controls = await setup(page); controls.loseStart = true
  await open(page); await select(page)
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect(paper(page).getByRole('button', { name: '동일 요청 재전송' })).toBeVisible()
  await paper(page).getByRole('button', { name: '요청 명시적 폐기', exact: true }).click()
  await expect(paper(page)).toContainText('서버가 이미 받은 실행은 계속될 수 있습니다')
  expect(await page.evaluate(key => sessionStorage.getItem(key) !== null, scopePrefix() + '.pending')).toBe(true)
  await paper(page).getByRole('button', { name: '이 로컬 요청 기록만 폐기', exact: true }).click()
  await expect(paper(page).getByRole('button', { name: 'Paper 실행', exact: true })).toBeVisible()
  expect(await page.evaluate(key => sessionStorage.getItem(key), scopePrefix() + '.pending')).toBeNull()
  expect(controls.posts).toHaveLength(1); expect(controls.apiPosts).toHaveLength(0)
})

test('미확정 Paper가 있어도 명시 로그아웃은 가능하고 원 pending은 보존한다', async ({ page }) => {
  const controls = await setup(page); controls.loseStart = true
  await open(page); await select(page)
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect(paper(page).getByRole('button', { name: '동일 요청 재전송' })).toBeVisible()
  const before = await page.evaluate(key => sessionStorage.getItem(key), scopePrefix() + '.pending')
  const logout = await openNativeAccountMenu(page)
  await logout.click()
  await expect.poll(() => controls.apiPosts.includes('/api/v1/auth/logout')).toBe(true)
  await expect(paper(page)).toHaveCount(0)
  expect(await page.evaluate(({ key, before }) => sessionStorage.getItem(key) === before, { key: scopePrefix() + '.pending', before })).toBe(true)
  expect(controls.posts).toHaveLength(1)
})

test('새 pending 저장 실패는 POST 전에 멈춘다', async ({ page }) => {
  const controls = await setup(page)
  await open(page); await select(page)
  await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key.startsWith('tesia.native.paper.')) throw new Error('SYNTHETIC_STORAGE_FAILURE'); return original.call(this, key, value) } })
  await paper(page).getByRole('button', { name: 'Paper 실행', exact: true }).click()
  await expect(paper(page).getByRole('alert').first()).toBeVisible()
  expect(controls.posts).toHaveLength(0)
})

test('catalog 읽기 중 owner 교체는 늦은 목록을 새 계정에서 표시하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  let release = () => {}; controls.holdCatalog = () => new Promise<void>(resolve => { release = resolve })
  await open(page); await expect.poll(() => controls.catalogs).toBeGreaterThan(0)
  controls.owner = 'session_paper_changed_0002'; release()
  await expect(paper(page)).toHaveCount(0)
  await expect(page.getByRole('alert').first()).toBeVisible()
  expect(controls.posts).toHaveLength(0)
})

test('승인 뒤 서버 초안이 바뀌면 catalog나 실행으로 넘어가지 않는다', async ({ page }) => {
  const controls = await setup(page); controls.changedDraft = true
  await open(page)
  await expect(page.getByRole('alert').first()).toBeVisible()
  await expect(paper(page)).toHaveCount(0)
  expect(controls.posts).toHaveLength(0); expect(controls.catalogs).toBe(0)
})
