import { expect, test, type Page } from '@playwright/test'
import { openNativeAccountMenu } from './internal-poc/native-account-test-helpers'
import conversationFixture from './fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import nativeFixture from './internal-poc/fixtures/native-service-contracts.json' with { type: 'json' }

test.use({ trace: 'off', video: 'off' })
const ready = conversationFixture.snapshots.ready
const approval = { ...conversationFixture.documents.find(item => item.name === 'approval')!.value,
  strategyVersionId: 'sv_v03_11111111111111111111111111111111' }
const queued = nativeFixture.sources[3].fixture.cases![0].response
const completed = nativeFixture.sources[3].fixture.cases![6].response
const envelope = (data: unknown, revision = '4') => ({
  meta: { apiContractVersion: '0.3.0', requestId: 'req_native_ui_fixture_01', traceId: 'trace_native_ui_fixture_01', resourceRevision: revision }, data,
})

async function closeConfirmedAuthSurface(page: Page) {
  const dialog = page.getByRole('dialog', { name: '로그인', exact: true })
  await expect(dialog).toBeVisible()
  const snapshot = () => page.evaluate(() => ({
    journals: Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('tesia.native.'))),
    drafts: [...document.querySelectorAll<HTMLTextAreaElement>('#strategy-idea,.g-composer textarea')].map(node => node.value),
  }))
  const before = await snapshot()
  const requests: string[] = []
  const observe = (request: import('@playwright/test').Request) => {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/')) requests.push(`${request.method()} ${path}`)
  }
  page.on('request', observe)
  try {
    await dialog.locator('[data-native-auth-close]').click()
    await expect(dialog).not.toBeVisible()
    expect(await snapshot()).toEqual(before)
    expect(requests).toEqual([])
  } finally { page.off('request', observe) }
}

for (const mode of ['normal', 'two-cycles', 'double-click', 'lost-before', 'lost-after', 'malformed', 'changed-before', 'changed-after', 'pending', 'archive-full', 'storage-failure', 'wrong-response'] as const) {
  test(`native 로그아웃 ${mode}: 세션 종료와 사업 요청 보존을 분리한다`, async ({ page }) => {
    await syntheticSession(page)
    const originalId = 'session_native_ui_fixture_0001'
    let current: 'original' | 'absent' | 'other' | 'anonymous' = 'original'
    let bootstraps = 0
    let businessWrites = 0
    const logoutRequests: { key?: string; match?: string; body: string | null }[] = []
    const business = { version: 1, kind: 'CREATE_TURN', sessionId: originalId, sessionState: 'AUTHENTICATED', idempotencyKey: 'synthetic_business_request_001',
      turnIdempotencyKey: 'synthetic_business_turn_001', clientMessageId: 'client_message_synthetic_business_001', message: '로그아웃 전 미확정 전략' }
    const hasBusiness = mode === 'pending' || mode === 'archive-full'
    if (hasBusiness) await page.addInitScript(({ business, full }) => {
      if (!sessionStorage.getItem('logout-test-seeded')) {
        sessionStorage.setItem('logout-test-seeded', '1')
        sessionStorage.setItem('tesia.native.pending-command', JSON.stringify(business))
        if (full) for (let index = 0; index < 10; index++) sessionStorage.setItem(`tesia.native.detached-request.prior_${index}`, 'preserved prior bytes')
      }
    }, { business, full: mode === 'archive-full' })
    if (mode === 'storage-failure') await page.addInitScript(() => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (key === 'tesia.native.pending-logout') throw new DOMException('synthetic quota', 'QuotaExceededError')
        return original.call(this, key, value)
      }
    })
    const meta = (revision: string | null) => ({ apiContractVersion: '0.1.0', requestId: 'request_logout_fixture_001', traceId: 'trace_logout_fixture_001', resourceRevision: revision })
    const sessionData = (state: string, id = originalId, revision = '1') => ({ sessionId: id, state, revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' })
    await page.route('**/api/v3/**', route => {
      businessWrites++
      const turn = new URL(route.request().url()).pathname.endsWith('/messages')
      return route.fulfill({ status: turn ? 200 : 201, contentType: 'application/json', headers: { ETag: '"conversation-state-fixture-0004"' },
        body: JSON.stringify(envelope(turn ? conversationFixture.documents.find(item => item.name === 'turn')!.value : ready)) })
    })
    await page.route('**/api/v1/auth/session', route => current === 'absent'
      ? route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ meta: meta(null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic absent session' } }) })
      : route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: current === 'original' ? '"native_ui_session_etag_0001"' : '"native_ui_session_etag_0002"' },
        body: JSON.stringify({ meta: meta('1'), data: sessionData(current === 'anonymous' ? 'ANONYMOUS' : 'AUTHENTICATED', current === 'original' ? originalId : 'session_native_ui_changed_0002') }) }))
    await page.route('**/api/v1/anonymous-sessions', route => {
      bootstraps++; current = 'anonymous'
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { ETag: '"native_ui_session_etag_0002"' }, body: JSON.stringify({ meta: meta('1'), data: sessionData('ANONYMOUS', 'session_native_ui_changed_0002') }) })
    })
    await page.route('**/api/v1/auth/logout', async route => {
      logoutRequests.push({ key: route.request().headers()['idempotency-key'], match: route.request().headers()['if-match'], body: route.request().postData() })
      if (mode === 'lost-before' && logoutRequests.length === 1) { await route.abort('failed'); return }
      current = mode === 'changed-after' ? 'other' : 'absent'
      if (mode === 'lost-after') { await route.abort('failed'); return }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"native_ui_logout_etag_0002"' }, body: mode === 'malformed' ? '{"meta":'
        : JSON.stringify({ meta: meta('2'), data: sessionData('REVOKED', mode === 'wrong-response' ? 'session_native_ui_wrong_0003' : originalId, '2') }) })
    })
    await page.goto('/internal-poc.html#/native-client')
    const logout = await openNativeAccountMenu(page)
    await expect(logout).toBeEnabled()
    if (mode === 'changed-before') current = 'other'
    if (mode === 'double-click') await logout.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
    else await logout.click()
    if (mode === 'changed-before' || mode === 'storage-failure') {
      await expect(page.getByRole('alert')).toBeVisible()
      expect(logoutRequests).toHaveLength(0)
      expect(bootstraps).toBe(0)
      return
    }
    await expect.poll(() => logoutRequests.length).toBe(1)
    expect(logoutRequests[0].match).toBe('"native_ui_session_etag_0001"')
    expect(logoutRequests[0].body).toBeNull()
    const journal = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-logout'))
    expect(journal).not.toMatch(/csrf|cookie|bearer/i)
    if (hasBusiness) expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(JSON.stringify(business))
    if (mode === 'lost-before') {
      await expect(page.getByRole('button', { name: '같은 로그아웃 요청으로 재개', exact: true })).toBeEnabled()
      await page.reload()
      await expect(page.getByRole('button', { name: '같은 로그아웃 요청으로 재개', exact: true })).toBeEnabled()
      expect(logoutRequests).toHaveLength(1)
      await page.getByRole('button', { name: '같은 로그아웃 요청으로 재개', exact: true }).click()
      await expect.poll(() => logoutRequests.length).toBe(2)
      expect(logoutRequests[1]).toEqual(logoutRequests[0])
    }
    if (['lost-after', 'malformed', 'wrong-response'].includes(mode)) {
      await page.reload()
      await expect(page.getByRole('alert')).toContainText('로그아웃 응답과 서버의 세션 종료 여부는 확인하지 못했습니다')
      await expect(page.getByRole('heading', { name: '로그아웃 응답을 확인했습니다.' })).toHaveCount(0)
    }
    const newSession = page.getByRole('button', { name: '이전 요청 기록을 보존하고 현재 브라우저에서 새 대화 시작', exact: true })
    await expect(newSession).toBeEnabled()
    expect(bootstraps).toBe(0)
    expect(businessWrites).toBe(0)
    if (mode === 'changed-after') await expect(page.getByRole('alert')).toContainText('현재 세션이 로그아웃 요청의 세션과 달라')
    await newSession.click()
    if (mode === 'archive-full') {
      await expect(page.getByRole('alert')).toBeVisible()
      expect(bootstraps).toBe(0)
      expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(JSON.stringify(business))
      expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-logout'))).toBe(journal)
      return
    }
    await expect(page.locator('#strategy-idea')).toBeEnabled()
    expect(bootstraps).toBe(mode === 'changed-after' ? 0 : 1)
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-logout'))).toBeNull()
    if (hasBusiness) expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.detached-request.synthetic_business_request_001'))).toBe(JSON.stringify(business))
    expect(businessWrites).toBe(0)
    if (mode === 'normal' || mode === 'pending' || mode === 'two-cycles') {
      await page.locator('#strategy-idea').fill('로그아웃 후 명시 새 전략')
      await page.getByRole('button', { name: '대화 시작', exact: true }).click()
      await expect.poll(() => businessWrites).toBe(2)
      expect(logoutRequests).toHaveLength(1)
    }
    if (mode === 'two-cycles') {
      current = 'original' // Synthetic independent re-authentication, not an OAuth proof.
      // A fresh page observes the externally changed session; the healthy UI
      // no longer presents an unsolicited recovery button.
      await page.reload()
      await closeConfirmedAuthSurface(page)
      await (await openNativeAccountMenu(page)).click()
      await expect(newSession).toBeEnabled()
      await newSession.click()
      await expect(page.locator('#strategy-idea')).toBeEnabled()
      expect(bootstraps).toBe(2)
      expect(logoutRequests).toHaveLength(2)
      expect(logoutRequests[1].key).not.toBe(logoutRequests[0].key)
    }
  })
}

async function syntheticSession(page: Page, restore = false) {
  await page.addInitScript(({ restore, id }) => {
    if (!sessionStorage.getItem('native-test-initialized')) {
      sessionStorage.clear()
      sessionStorage.setItem('native-test-initialized', '1')
      if (restore) sessionStorage.setItem('tesia.native.conversation', id)
    }
  }, { restore, id: ready.conversationId })
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"native_ui_session_etag_0001"' }, body: JSON.stringify({
    meta: { apiContractVersion: '0.1.0', requestId: 'request_fixture_00000001', traceId: 'trace_fixture_00000001', resourceRevision: '1' },
    data: { sessionId: 'session_native_ui_fixture_0001', state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' },
  }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    meta: { apiContractVersion: '0.1.0', requestId: 'request_fixture_00000001', traceId: 'trace_fixture_00000001', resourceRevision: null },
    data: { csrfToken: 'csrf_native_ui_fixture_only_01', expiresAt: '2030-01-02T00:00:00Z' },
  }) }))
}

test('native turn 응답 유실은 conversation을 다시 만들지 않고 같은 turn으로 재개한다', async ({ page }) => {
  await syntheticSession(page)
  let creates = 0
  const turns: { body: string | null; key: string | undefined; match: string | undefined }[] = []
  const recordedTurn = conversationFixture.documents.find(item => item.name === 'turn')!.value
  await page.route('**/api/v3/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path === '/api/v3/conversations') {
      creates++
      await route.fulfill({ status: 201, contentType: 'application/json', headers: { ETag: '"conversation-state-fixture-0004"' }, body: JSON.stringify(envelope(ready)) })
    } else if (path.endsWith('/messages')) {
      turns.push({ body: request.postData(), key: request.headers()['idempotency-key'], match: request.headers()['if-match'] })
      if (turns.length === 1) await route.abort('failed')
      else await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"conversation-state-fixture-0005"' }, body: JSON.stringify(envelope(recordedTurn, '5')) })
    } else if (request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"conversation-state-fixture-0004"' }, body: JSON.stringify(envelope(ready)) })
    } else throw new Error(`Unexpected synthetic operation ${path}`)
  })
  await page.goto('/internal-poc.html#/native-client')
  await page.locator('#strategy-idea').fill('합성 native UI 재개 시험')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect.poll(() => turns.length).toBe(1)
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
  await expect(page.locator('.g-composer textarea')).toBeDisabled()
  await page.reload()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
  expect(turns.length).toBe(1)
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect.poll(() => turns.length).toBe(2)
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toHaveCount(0)
  expect(creates).toBe(1)
  expect(turns[1]).toEqual(turns[0])
  expect(JSON.parse(turns[0].body!).clientMessageId).toMatch(/^client_message_[A-Za-z0-9_-]{8,80}$/)
  await expect(page.locator('.g-umsg')).toHaveCount(1)
})

test('native 명시 승인 후 QUEUED를 표시하고 합성 COMPLETED wire는 실제 결과로 승격하지 않는다', async ({ page }) => {
  await syntheticSession(page, true)
  let approvalWrites = 0, submissions = 0, rejectCompleted = false
  await page.route('**/api/v3/**', async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = ready, status = 200
    if (path.endsWith('/validate')) data = conversationFixture.approvalAuthority.receipt
    else if (path.endsWith('/approval-challenges')) { data = conversationFixture.approvalAuthority.challenge; status = 201 }
    else if (path.endsWith('/approve')) { data = approval; status = 201; approvalWrites++ }
    await route.fulfill({ status, contentType: 'application/json', headers: { ETag: '"conversation-state-fixture-0004"' }, body: JSON.stringify(envelope(data)) })
  })
  await page.route('**/api/v7/**', async route => {
    const posting = route.request().method() === 'POST'
    if (posting) submissions++
    // Only the nonterminal fixture is rebound to this synthetic approval.
    // The published malformed COMPLETED fixture is kept intact and rejected.
    const body = rejectCompleted ? completed : { ...queued, data: { ...queued.data,
      strategyVersionId: approval.strategyVersionId, semanticHash: conversationFixture.approvalAuthority.receipt.semanticHash } }
    await route.fulfill({ status: posting ? 202 : 200, contentType: 'application/json', headers: { ETag: '"native_job_ui_etag_0001"', 'cache-control': 'no-store' }, body: JSON.stringify(body) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await page.getByRole('button', { name: '전략 검증', exact: true }).click()
  await page.getByRole('button', { name: '승인 내용 확인', exact: true }).click()
  const approve = page.getByRole('button', { name: '이 전략 버전 승인', exact: true })
  await expect(approve).toBeDisabled()
  expect(approvalWrites).toBe(0)
  expect(submissions).toBe(0)
  await page.getByRole('checkbox').check()
  await approve.click()
  await page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true }).click()
  await expect(page.getByRole('region', { name: '백테스트 진행' })).toContainText('QUEUED')
  rejectCompleted = true
  await page.getByRole('button', { name: '상태 다시 조회', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('region', { name: '백테스트 진행' })).toContainText('QUEUED')
  await expect(page.getByRole('region', { name: '백테스트 결과' })).toHaveCount(0)
  expect(approvalWrites).toBe(1)
  expect(submissions).toBe(1)
})

test('결과 UI projection fixture는 합성/MMR 한계와 조회 실패를 표시하며 차트를 만들어 채우지 않는다', async ({ page }) => {
  await page.route('**/native-result-projection-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><p>합성 UI projection 시험 · SDK 실행 완료 증거 아님</p><div id="projection-root"></div></body></html>' }))
  await page.goto('/native-result-projection-test.html')
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
  })
  await page.evaluate(async fixtures => {
    const reactPath = '/@id/react', domPath = '/@id/react-dom/client', panelPath = '/src/internal-poc/NativeServiceResult.tsx'
    const react = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath)
    const { NativeServiceResult } = await import(/* @vite-ignore */ panelPath)
    const report = fixtures.sources[1].fixture.response!.data
    const api = { report: async () => report, trades: async () => { throw new Error('SYNTHETIC_READ_UNAVAILABLE') }, chart: async () => { throw new Error('SYNTHETIC_READ_UNAVAILABLE') } }
    // Isolated UI projection only: no forged COMPLETED response enters the SDK.
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('projection-root')).render((react.createElement ?? react.default.createElement)(NativeServiceResult, { api, job: { backtestId: report.binding.backtestId } }))
  }, nativeFixture)
  const result = page.getByRole('region', { name: '백테스트 결과' })
  await expect(result).toContainText('합성 계약 fixture · 실제 시장 성과 아님')
  await expect(result).toContainText('현재 MMR 미검증')
  await expect(result).toContainText('청산 검증 불가(UNAVAILABLE)')
  await expect(result).toContainText('차트 데이터를 확인하지 못했습니다.')
  await expect(result).toContainText('거래 내역을 확인하지 못했습니다.')
  await expect(result.locator('canvas')).toHaveCount(0)
  await expect(result.getByRole('table')).toHaveCount(1)
})

for (const stage of ['VALIDATE', 'CHALLENGE', 'APPROVE', 'SUBMIT'] as const) {
  for (const failure of ['lost', '401'] as const) {
    test(`${stage} ${failure} 뒤 reload는 자동 쓰기 없이 동일 요청만 명시 재개한다`, async ({ page }) => {
      await syntheticSession(page, true)
      const attempts: { body: string | null; key: string | undefined; match: string | undefined }[] = []
      await page.route(/\/api\/v[37]\//, async route => {
        const request = route.request(), path = new URL(request.url()).pathname
        const operation = path.endsWith('/validate') ? 'VALIDATE' : path.endsWith('/approval-challenges') ? 'CHALLENGE'
          : path.endsWith('/approve') ? 'APPROVE' : request.method() === 'POST' && path === '/api/v7/backtests' ? 'SUBMIT' : 'READ'
        if (operation === stage) {
          attempts.push({ body: request.postData(), key: request.headers()['idempotency-key'], match: request.headers()['if-match'] })
          if (attempts.length === 1) {
            if (failure === 'lost') await route.abort('failed')
            else await route.fulfill({ status: 401, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({
              meta: { ...envelope(null).meta, apiContractVersion: stage === 'SUBMIT' ? '0.7.0' : '0.3.0', resourceRevision: null },
              error: { code: 'AUTHENTICATION_REQUIRED', message: stage === 'SUBMIT' ? 'Native job request failed.' : 'Synthetic expired session' },
            }) })
            return
          }
        }
        const native = path.startsWith('/api/v7/')
        const data = operation === 'VALIDATE' ? conversationFixture.approvalAuthority.receipt : operation === 'CHALLENGE' ? conversationFixture.approvalAuthority.challenge : operation === 'APPROVE' ? approval : ready
        const body = native ? { ...queued, data: { ...queued.data, strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash } } : envelope(data)
        await route.fulfill({ status: native && request.method() === 'POST' ? 202 : ['CHALLENGE', 'APPROVE'].includes(operation) ? 201 : 200,
          contentType: 'application/json', headers: { ETag: '"native_ui_recovery_etag_0004"', 'cache-control': 'no-store' }, body: JSON.stringify(body) })
      })
      await page.goto('/internal-poc.html#/native-client')
      await page.getByRole('button', { name: '전략 검증', exact: true }).click()
      if (stage !== 'VALIDATE') await page.getByRole('button', { name: '승인 내용 확인', exact: true }).click()
      if (stage === 'APPROVE' || stage === 'SUBMIT') {
        await page.getByRole('checkbox').check()
        await page.getByRole('button', { name: '이 전략 버전 승인', exact: true }).click()
      }
      if (stage === 'SUBMIT') await page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true }).click()
      const resume = page.getByRole('button', { name: '같은 요청으로 재개', exact: true })
      await expect(resume).toBeVisible()
      if (failure === '401') {
        await expect(resume).toBeDisabled()
        // A fresh page observes the externally changed session; the healthy UI
      // no longer presents an unsolicited recovery button.
      await page.reload()
        await expect(resume).toBeEnabled()
      }
      const safeStored = await page.evaluate(() => {
        const raw = sessionStorage.getItem('tesia.native.pending-command')!
        return !raw.includes('csrf') && !raw.includes('cookie') && JSON.parse(raw).kind
      })
      expect(safeStored).toBe(stage)
      await page.reload()
      await expect(resume).toBeEnabled()
      expect(attempts).toHaveLength(1)
      if (stage === 'SUBMIT' && failure === 'lost') {
        const otherApproval = { ...approval, strategyVersionId: 'sv_v03_other_fixture_000001' }
        await page.route('**/api/v8/**', route => route.fulfill({ status: 200, contentType: 'application/json',
          headers: { ETag: '"native_history_pending_etag_0004"', 'cache-control': 'no-store' }, body: JSON.stringify({
            meta: { ...envelope(null).meta, apiContractVersion: '0.8.0' }, data: { conversationId: ready.conversationId, snapshotRevision: '4', limit: 50,
              rows: [{ approval: otherApproval, job: { ...queued.data, strategyVersionId: otherApproval.strategyVersionId, semanticHash: otherApproval.semanticHash } }] },
          }) }))
        await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
        await expect(page.getByRole('region', { name: '실행 이력' })).toContainText(otherApproval.strategyVersionId)
        await expect(page.getByRole('button', { name: '작업 보기', exact: true })).toBeDisabled()
      }
      await expect(page.getByText(`승인 버전: ${approval.strategyVersionId}`, { exact: true })).toHaveCount(0)
      await resume.click()
      await expect(resume).toHaveCount(0)
      expect(attempts).toHaveLength(2)
      expect(attempts[1]).toEqual(attempts[0])
      expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
      if (stage === 'APPROVE') await expect(page.getByText(`승인 버전: ${approval.strategyVersionId}`, { exact: true })).toBeVisible()
      if (stage === 'SUBMIT') await expect(page.getByRole('region', { name: '백테스트 진행' })).toContainText('QUEUED')
    })
  }
}

test('저장소 쓰기 불가 시 create 요청을 전송하지 않는다', async ({ page }) => {
  await syntheticSession(page)
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tesia.native.pending-command') throw new DOMException('Synthetic quota failure', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  let writes = 0
  await page.route('**/api/v3/**', route => { writes++; return route.abort('failed') })
  await page.goto('/internal-poc.html#/native-client')
  const composer = page.locator('#strategy-idea')
  await composer.fill('저장 불가 합성 시험')
  const originalComposer = await composer.elementHandle()
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('서버로 전송하지 않았습니다')
  // Pre-dispatch failure stays beside the original home input; it must not
  // manufacture the old conversation composer merely to show an error.
  await expect(composer).toHaveValue('저장 불가 합성 시험')
  expect(await originalComposer!.evaluate(node => node.isConnected)).toBe(true)
  expect(writes).toBe(0)
})

for (const change of ['session-id', 'session-state'] as const) test(`${change} 변경 후 pending 승인 요청은 무효화하며 자동 재승인하지 않는다`, async ({ page }) => {
  await syntheticSession(page, true)
  await page.addInitScript(({ snapshot, receipt, challenge, change }) => {
    if (sessionStorage.getItem('native-test-pending-seeded')) return
    sessionStorage.setItem('native-test-pending-seeded', '1')
    sessionStorage.setItem('tesia.native.pending-command', JSON.stringify({ version: 1, kind: 'APPROVE', sessionId: change === 'session-id' ? 'session_old_fixture_0001' : 'session_native_ui_fixture_0001', sessionState: change === 'session-state' ? 'ANONYMOUS' : 'AUTHENTICATED',
      idempotencyKey: 'synthetic_pending_approval_0001', conversationId: snapshot.conversationId, draftId: snapshot.draftId, ifMatch: '"native_ui_recovery_etag_0004"',
      body: { expectedConversationStateRevision: snapshot.conversationStateRevision, expectedConversationStateHash: snapshot.conversationStateHash,
        validationReceiptId: receipt.validationReceiptId, approvalChallengeId: challenge.approvalChallengeId, acknowledgedSemanticHash: receipt.semanticHash } }))
  }, { snapshot: ready, receipt: conversationFixture.approvalAuthority.receipt, challenge: conversationFixture.approvalAuthority.challenge, change })
  let requests = 0
  await page.route('**/api/v3/**', route => { requests++; return route.abort('failed') })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.getByRole('alert')).toContainText('세션이 변경되어')
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toHaveCount(0)
  expect(requests).toBe(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
})

test('create 응답 유실 후 reload도 처음 할당한 create와 turn 키를 유지한다', async ({ page }) => {
  await syntheticSession(page)
  const creates: string[] = [], turns: string[] = []
  await page.route('**/api/v3/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v3/conversations') {
      creates.push(route.request().headers()['idempotency-key'])
      if (creates.length === 1) { await route.abort(); return }
    } else turns.push(route.request().headers()['idempotency-key'])
    const data = path.endsWith('/messages') ? conversationFixture.documents.find(item => item.name === 'turn')!.value : ready
    await route.fulfill({ status: path === '/api/v3/conversations' ? 201 : 200, contentType: 'application/json', headers: { ETag: '"native_create_recovery_etag_0004"' }, body: JSON.stringify(envelope(data)) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await page.locator('#strategy-idea').fill('합성 create response-loss')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  const resume = page.getByRole('button', { name: '같은 요청으로 재개', exact: true })
  await expect(resume).toBeEnabled()
  const allocatedTurn = await page.evaluate(() => JSON.parse(sessionStorage.getItem('tesia.native.pending-command')!).turnIdempotencyKey)
  await page.reload()
  await expect(resume).toBeEnabled()
  expect(creates).toHaveLength(1)
  expect(turns).toHaveLength(0)
  await resume.click()
  await expect(resume).toHaveCount(0)
  expect(creates).toHaveLength(2)
  expect(creates[1]).toBe(creates[0])
  expect(turns).toEqual([allocatedTurn])
})

for (const resultMode of ['same-key-reload', 'wrong-owner', 'missing-precondition', 'tampered-etag', 'ack-body-loss', 'empty-claim-400', 'empty-claim-network', 'empty-claim-malformed', 'empty-claim-session-changed', 'strategy-claim-400', 'strategy-claim-malformed', 'strategy-claim-session-changed', 'strategy-claim-network'] as const) {
  test(`실제 OAuth 패널 소비 ${resultMode}: 로그인과 claim은 별도 명시 동의이며 승인 권한을 복원하지 않는다`, async ({ page }) => {
    const empty = resultMode.startsWith('empty-claim')
    const rejectedStrategy = resultMode.startsWith('strategy-claim')
    await syntheticSession(page, !empty)
    const anonymous = { sessionId: 'session_anonymous_000001', state: 'ANONYMOUS', revision: '7', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
    const authenticated = { sessionId: 'session_authenticated_0001', state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:01:10Z', expiresAt: '2030-01-01T12:01:10Z' }
    if (resultMode === 'tampered-etag') await page.addInitScript(id => {
      sessionStorage.setItem('tesia.native.auth-claim-precondition', JSON.stringify({ provider: 'GOOGLE', sessionId: id, revision: '7', etag: '"native_tampered_claim_etag_0007"' }))
    }, anonymous.sessionId)
    let acknowledged = false, claims = 0, conversationReads = 0, newCreates = 0
    const keys: string[] = [], bodies: string[] = [], businessPosts: string[] = []
    page.on('request', request => {
      const path = new URL(request.url()).pathname
      if (request.method() === 'POST' && (path.startsWith('/api/v3/') || /\/claim$|approve|backtests|orders|exchange-connections/.test(path))) businessPosts.push(path)
    })
    const meta = (version: string, revision: string | null = '1') => ({ apiContractVersion: version, requestId: 'req_native_auth_ui_000001', traceId: 'trace_native_auth_ui_0001', resourceRevision: revision })
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: '"native_claim_session_etag_0001"' }
    const anonymousEtag = '"native_claim_anonymous_etag_0007"'
    await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, headers: { ...headers, ETag: acknowledged ? headers.ETag : anonymousEtag }, body: JSON.stringify({ meta: meta('0.1.0', acknowledged ? '1' : '7'), data: acknowledged ? authenticated : anonymous }) }))
    await page.route('**/api/v3/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (route.request().method() === 'GET') conversationReads++
      const creating = route.request().method() === 'POST' && path === '/api/v3/conversations'
      if (creating) newCreates++
      expect(path.endsWith('/approve')).toBe(false)
      const data = path.endsWith('/validate') ? conversationFixture.approvalAuthority.receipt : path.endsWith('/messages') ? conversationFixture.documents.find(item => item.name === 'turn')!.value : ready
      await route.fulfill({ status: creating ? 201 : 200, headers, body: JSON.stringify(envelope(data)) })
    })
    await page.route('**/api/v2/auth/google/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/transactions')) {
        expect(route.request().headers()['if-match']).toBe(anonymousEtag)
        await route.fulfill({ status: 201, headers, body: JSON.stringify({ meta: meta('0.2.0', '0'), data: { transactionId: 'oidc_tx_fixture_000001',
          issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:10:00Z', authorizationRedirect: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&response_type=code&state=opaque' } }) })
      } else if (path.endsWith('/results/current')) await route.fulfill({ status: 200, headers, body: JSON.stringify({ meta: meta('0.2.0', '0'), data: {
        resultId: 'oauth_result_fixture_0001', transactionId: 'oidc_tx_fixture_000001', status: 'READY_FOR_ACK', issuedAt: '2030-01-01T00:01:00Z',
        expiresAt: '2030-01-01T00:02:00Z', transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: 'csrf_result_fixture_000001',
      } }) })
      else if (path.endsWith('/acknowledgements')) {
        acknowledged = true
        if (resultMode === 'ack-body-loss') { await route.fulfill({ status: 200, headers, body: '{"meta":' }); return }
        await route.fulfill({ status: 200, headers, body: JSON.stringify({ meta: meta('0.2.0'), data: {
          resultId: 'oauth_result_fixture_0001', transactionId: 'oidc_tx_fixture_000001', session: authenticated,
          handoffReservation: { transactionId: 'oidc_tx_fixture_000001', initiatingSessionId: anonymous.sessionId, initiatingSessionRevision: '7', authenticatedSessionId: authenticated.sessionId, state: 'RESERVED_FOR_CLAIM', expiresAt: authenticated.expiresAt },
        } }) })
      } else throw new Error('No provider or transaction creation in this returned-page fixture')
    })
    await page.route('**/api/v1/anonymous-sessions/*/claim', async route => {
      claims++; keys.push(route.request().headers()['idempotency-key']); bodies.push(route.request().postData()!)
      if (empty || rejectedStrategy) {
        if (resultMode.endsWith('-network')) await route.abort()
        else await route.fulfill({ status: 400, headers, body: resultMode.endsWith('-malformed') ? '{"error":' : JSON.stringify({ meta: meta('0.1.0', null), error: { code: 'BAD_REQUEST', message: 'Synthetic rejected claim' } }) })
        return
      }
      if (resultMode === 'tampered-etag') {
        // Storage is never authority. A shaped but false ETag must still pass
        // the actual server precondition before any ownership is accepted.
        expect(route.request().headers()['if-match']).not.toBe(anonymousEtag)
        await route.fulfill({ status: 412, headers, body: JSON.stringify({ meta: meta('0.1.0', null), error: { code: 'PRECONDITION_FAILED', message: 'Synthetic mismatched anonymous precondition' } }) })
        return
      }
      expect(route.request().headers()['if-match']).toBe(anonymousEtag)
      if (claims === 1 && resultMode === 'same-key-reload') { await route.abort(); return }
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ meta: meta('0.1.0'), data: {
        sessionId: resultMode === 'wrong-owner' ? 'session_unrelated_000001' : authenticated.sessionId, state: 'AUTHENTICATED', revision: '1', oldSessionRevoked: true,
        claimedResourceCounts: { conversations: 1, messages: 1, drafts: 1, patches: 0, validations: 1, idempotencyRecords: 0 },
      } }) })
    })
    await page.goto('/internal-poc.html#/native-client')
    if (resultMode === 'missing-precondition' || resultMode === 'tampered-etag') {
      // Provider return is the original callback entry, not initial login UI.
      await page.evaluate(() => history.replaceState(null, '', '/auth/complete'))
    }
    if (empty) {
      // The supplied native SDK must finish session/CSRF recovery before
      // opening its owner-bound auth flow; the public shell paints earlier.
      await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
      await page.getByRole('button', { name: '로그인', exact: true }).click()
    }
    else {
      await page.getByRole('button', { name: '전략 검증', exact: true }).click()
      await page.getByRole('button', { name: '로그인 후 백테스트 계속', exact: true }).click()
    }
    const panel = page.getByRole('region', { name: '실제 계정 로그인' })
    if (resultMode !== 'missing-precondition' && resultMode !== 'tampered-etag') {
      await panel.getByRole('button', { name: 'Google로 계속하기', exact: true }).click()
      await panel.getByRole('button', { name: '돌아온 뒤 인증 결과 확인', exact: true }).click()
    } else {
      const recovery = panel.locator('details.native-auth-recovery')
      if (await recovery.getAttribute('open') === null) await recovery.locator('summary').click()
      await panel.getByRole('button', { name: 'Google 인증 결과 확인', exact: true }).click()
    }
    await panel.getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true }).click()
    if (resultMode === 'ack-body-loss') {
      await expect(panel.getByRole('alert')).toContainText('로그인 응답을 확인하지 못했습니다')
      await page.reload()
      await panel.locator('summary', { hasText: '인증을 마치고 돌아오셨나요?' }).click()
      await panel.getByRole('button', { name: 'Google 로그인 세션만 다시 확인', exact: true }).click()
      await expect(panel.getByRole('status')).toContainText('현재 브라우저의 인증 세션만 확인')
      await expect(page.locator('[data-native-auth-notice][role="status"]').filter({ hasText: '전략 인계는 미확인' })).toBeVisible()
      await closeConfirmedAuthSurface(page)
    }
    const claim = page.getByRole('button', { name: '로그인 전 전략 연결', exact: true })
    if (resultMode === 'missing-precondition') {
      await expect(page.locator('[data-native-auth-notice][role="status"]').filter({ hasText: '사전조건을 복구하지 못해 전략 연결을 차단' })).toBeVisible()
      await expect(claim).toHaveCount(0)
      expect(acknowledged).toBe(true); expect(claims).toBe(0)
      return
    }
    if (empty) {
      // Login is complete even when this tab has no earlier strategy. Never
      // create a claim merely to discover the server's hypothetical rejection.
      await expect(page.locator('[data-native-auth-notice][role="status"]').filter({ hasText: '로그인을 확인했습니다.' })).toBeVisible()
      await expect(claim).toHaveCount(0)
      await expect(page.getByRole('alert')).toHaveCount(0)
      await expect(page.getByRole('button', { name: '세션 다시 확인', exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toHaveCount(0)
      expect(acknowledged).toBe(true); expect(businessPosts).toEqual([])
      expect(claims).toBe(0); expect(conversationReads).toBe(0); expect(newCreates).toBe(0)
      expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
      await expect(page.getByRole('button', { name: '승인 내용 확인', exact: true })).toHaveCount(0)
      return
    }
    await expect(claim).toBeEnabled()
    expect(claims).toBe(0)
    await expect(page.getByRole('button', { name: '승인 내용 확인', exact: true })).toHaveCount(0)
    await claim.click()
    const resume = page.getByRole('button', { name: '같은 요청으로 재개', exact: true })
    if (rejectedStrategy) {
      const discard = page.getByRole('button', { name: '연결 요청 기록을 폐기하고 현재 로그인으로 새 대화 시작', exact: true })
      expect(conversationReads).toBe(1); expect(newCreates).toBe(0)
      if (resultMode === 'strategy-claim-400' || resultMode === 'strategy-claim-session-changed') {
        await expect(discard).toBeEnabled()
        await expect(resume).toBeDisabled()
        const rejected = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
        expect(rejected).not.toBeNull()
        await page.reload()
        await expect(resume).toBeEnabled()
        expect(claims).toBe(1)
        expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(rejected)
        // A real old-owner locator opens the authenticated recovery modal on
        // reload. Close it without changing the retained claim request bytes.
        await closeConfirmedAuthSurface(page)
        await resume.click()
        await expect(discard).toBeEnabled()
        expect(claims).toBe(2); expect(keys[1]).toBe(keys[0]); expect(bodies[1]).toBe(bodies[0])
        if (resultMode === 'strategy-claim-session-changed') {
          await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, headers, body: JSON.stringify({ meta: meta('0.1.0'), data: { ...authenticated, sessionId: 'session_other_account_0001' } }) }))
          await discard.click()
          await expect(discard).toBeDisabled()
          expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(rejected)
          expect(newCreates).toBe(0); expect(claims).toBe(2)
          return
        }
        await discard.click()
        await expect(page.locator('#strategy-idea')).toBeEnabled()
        expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
        expect(newCreates).toBe(0)
        await page.locator('#strategy-idea').fill('현재 로그인으로 새 전략')
        await page.getByRole('button', { name: '대화 시작', exact: true }).click()
        await expect(page.getByRole('region', { name: '전략 요약' })).toBeVisible()
        expect(newCreates).toBe(1); expect(claims).toBe(2)
      } else {
        await expect(resume).toBeEnabled()
        await expect(discard).toHaveCount(0)
        const saved = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
        expect(saved).not.toBeNull()
        await page.reload()
        await expect(resume).toBeEnabled()
        expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(saved)
        expect(claims).toBe(1); expect(newCreates).toBe(0)
        if (resultMode === 'strategy-claim-network') {
          // A transport abort proves no definitive rejection. Keep the exact
          // journal and explicitly replay only its existing key/request bytes.
          await closeConfirmedAuthSurface(page)
          await resume.click()
          await expect(resume).toBeEnabled()
          await expect(discard).toHaveCount(0)
          expect(claims).toBe(2); expect(keys[1]).toBe(keys[0]); expect(bodies[1]).toBe(bodies[0])
          expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(saved)
          expect(newCreates).toBe(0); expect(conversationReads).toBe(1)
          expect(businessPosts).toEqual([
            `/api/v3/strategy-drafts/${ready.draftId}/validate`,
            `/api/v1/anonymous-sessions/${anonymous.sessionId}/claim`,
            `/api/v1/anonymous-sessions/${anonymous.sessionId}/claim`,
          ])
          await expect(page.getByRole('button', { name: '승인 내용 확인', exact: true })).toHaveCount(0)
          await expect(page.getByRole('button', { name: '이 전략 버전 승인', exact: true })).toHaveCount(0)
        }
      }
      return
    }
    if (resultMode === 'ack-body-loss') {
      await expect(page.getByRole('button', { name: '전략 검증', exact: true })).toBeEnabled()
      await expect(page.locator('[data-native-auth-notice][role="status"]').filter({ hasText: '로그인 전 전략의 서버 연결을 확인' })).toHaveCount(1)
      expect(claims).toBe(1); expect(conversationReads).toBe(2)
      await expect(page.getByRole('button', { name: '이 전략 버전 승인', exact: true })).toHaveCount(0)
      return
    }
    await expect(resume).toBeEnabled()
    if (resultMode === 'same-key-reload') {
      expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('tesia.native.pending-command')!).conversationId)).toBe(ready.conversationId)
      await page.reload()
      await expect(resume).toBeEnabled()
      expect(claims).toBe(1)
      // A claim journal is not permission to fetch the old owner's conversation.
      expect(conversationReads).toBe(1)
      await closeConfirmedAuthSurface(page)
      await resume.click()
      await expect(resume).toHaveCount(0)
      expect(claims).toBe(2)
      expect(keys[1]).toBe(keys[0]); expect(bodies[1]).toBe(bodies[0])
      await expect(page.getByRole('button', { name: '전략 검증', exact: true })).toBeEnabled()
      expect(conversationReads).toBe(2)
    } else {
      await expect(page.getByRole('alert')).toContainText('응답을 확인하지 못했습니다')
      expect(conversationReads).toBe(1)
      await expect(page.getByRole('button', { name: '전략 검증', exact: true })).toHaveCount(0)
    }
    await expect(page.getByRole('button', { name: '이 전략 버전 승인', exact: true })).toHaveCount(0)
  })
}

for (const stage of ['VALIDATE', 'CHALLENGE', 'APPROVE'] as const) {
  test(`${stage} SDK-shaped 응답도 요청 snapshot 결속이 다르면 다음 권한을 표시하지 않는다`, async ({ page }) => {
    await syntheticSession(page, true)
    await page.route('**/api/v3/**', async route => {
      const path = new URL(route.request().url()).pathname
      const operation = path.endsWith('/validate') ? 'VALIDATE' : path.endsWith('/approval-challenges') ? 'CHALLENGE' : path.endsWith('/approve') ? 'APPROVE' : 'READ'
      let data: unknown = operation === 'VALIDATE' ? conversationFixture.approvalAuthority.receipt : operation === 'CHALLENGE' ? conversationFixture.approvalAuthority.challenge : operation === 'APPROVE' ? approval : ready
      if (operation === stage) data = { ...data as object, [stage === 'APPROVE' ? 'sourceConversationStateHash' : 'conversationStateHash']: '0'.repeat(64) }
      await route.fulfill({ status: ['CHALLENGE', 'APPROVE'].includes(operation) ? 201 : 200, contentType: 'application/json', headers: { ETag: '"native_binding_fixture_etag_0004"' }, body: JSON.stringify(envelope(data)) })
    })
    await page.goto('/internal-poc.html#/native-client')
    await page.getByRole('button', { name: '전략 검증', exact: true }).click()
    if (stage !== 'VALIDATE') await page.getByRole('button', { name: '승인 내용 확인', exact: true }).click()
    if (stage === 'APPROVE') {
      await page.getByRole('checkbox').check()
      await page.getByRole('button', { name: '이 전략 버전 승인', exact: true }).click()
    }
    await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true })).toHaveCount(0)
    if (stage === 'VALIDATE') await expect(page.getByRole('button', { name: '승인 내용 확인', exact: true })).toHaveCount(0)
    if (stage === 'CHALLENGE') await expect(page.getByRole('checkbox')).toHaveCount(0)
  })
}

for (const mismatchAt of ['SUBMIT', 'POLL', 'REFRESH'] as const) {
  test(`${mismatchAt}: 다른 전략의 SDK-shaped job 응답은 승인 옆에 승격하지 않는다`, async ({ page }) => {
    await syntheticSession(page, true)
    let reads = 0
    await page.route('**/api/v3/**', async route => {
      const path = new URL(route.request().url()).pathname
      const data = path.endsWith('/validate') ? conversationFixture.approvalAuthority.receipt : path.endsWith('/approval-challenges') ? conversationFixture.approvalAuthority.challenge : path.endsWith('/approve') ? approval : ready
      await route.fulfill({ status: path.endsWith('/approval-challenges') || path.endsWith('/approve') ? 201 : 200, contentType: 'application/json', headers: { ETag: '"native_job_binding_etag_0004"' }, body: JSON.stringify(envelope(data)) })
    })
    await page.route('**/api/v7/**', async route => {
      const post = route.request().method() === 'POST'
      if (!post) reads++
      const mismatched = post ? mismatchAt === 'SUBMIT' : true
      const body = { ...queued, data: { ...queued.data, strategyVersionId: mismatched ? 'sv_unrelated_fixture_00000001' : approval.strategyVersionId,
        semanticHash: approval.semanticHash, ...(mismatched && !post ? { state: 'PREPARING_DATA' } : {}) } }
      await route.fulfill({ status: post ? 202 : 200, contentType: 'application/json', headers: { ETag: '"native_job_binding_etag_0004"', 'cache-control': 'no-store' }, body: JSON.stringify(body) })
    })
    await page.goto('/internal-poc.html#/native-client')
    await page.getByRole('button', { name: '전략 검증', exact: true }).click()
    await page.getByRole('button', { name: '승인 내용 확인', exact: true }).click()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: '이 전략 버전 승인', exact: true }).click()
    await page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true }).click()
    if (mismatchAt === 'SUBMIT') {
      await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
      await expect(page.getByRole('region', { name: '백테스트 진행' })).toHaveCount(0)
      expect(reads).toBe(0)
    } else {
      const status = page.getByRole('region', { name: '백테스트 진행' })
      await expect(status).toContainText('QUEUED')
      if (mismatchAt === 'REFRESH') await page.getByRole('button', { name: '상태 다시 조회', exact: true }).click()
      await expect.poll(() => reads).toBeGreaterThan(0)
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(status).toContainText('QUEUED')
      await expect(status).not.toContainText('PREPARING_DATA')
    }
  })
}
