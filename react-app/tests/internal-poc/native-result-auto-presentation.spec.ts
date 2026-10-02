import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { expect, test, type Page } from '@playwright/test'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import type { NativeJob, NativeReport, NativeTrades, NativeChartManifest } from '../../src/internal-poc/native-service-api'
import { resultHost } from './helpers/native-result-presentation-host'

test.use({ trace: 'retain-on-failure', video: 'off' })
test.setTimeout(35_000)
const queued = (fixtures.sources[3].fixture as unknown as { cases: { response: { data: NativeJob } }[] }).cases[0].response.data
const deliver = (page: Page) => page.evaluate(() => Reflect.get(window, 'deliverAutomaticResult')())
const markers = (control: Awaited<ReturnType<typeof resultHost>>) => control.requests.filter(url => url.pathname.endsWith('fill-markers'))
const skip = (page: Page) => page.getByRole('button', { name: 'Skip · 결과 보기', exact: true })
const flush = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
const consumed = (page: Page) => page.evaluate(() => Reflect.get(window, 'automaticResultAudit').consumed)
async function visibility(page: Page, hidden: boolean) {
  await page.evaluate(hidden => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: hidden ? 'hidden' : 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}
async function language(page: Page, value: string) {
  await page.evaluate(async value => {
    const hostSetter = Reflect.get(window, 'setAutomaticResultLanguage')
    if (hostSetter) { hostSetter(value); return }
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', value)
  }, value)
  await expect(page.locator('html')).toHaveAttribute('lang', value)
}
async function showChart(page: Page) {
  const analysis = page.locator('[data-analysis-tab="analysis"]')
  if (await analysis.isVisible()) await analysis.click()
}

test('new completion display request automatically presents one existing chart and Skip preserves the conversation', async ({ page }, info) => {
  const control = await resultHost(page)
  await expect(page.locator('.cp-chart canvas').first()).toBeAttached()
  const canvas = await page.locator('.cp-chart canvas').first().elementHandle()
  const input = page.locator('.g-composer textarea'), originalInput = await input.elementHandle()
  await expect(input).toHaveValue('자동 재생 뒤에도 보존할 질문')
  await input.focus()
  await input.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(3, 8))
  expect(await input.evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd])).toEqual([3, 8])
  await deliver(page)
  await expect(skip(page)).toBeVisible()
  await expect(page.locator('.cp-replay progress')).toBeVisible()
  expect(markers(control)).toHaveLength(1)
  await page.screenshot({ path: info.outputPath('automatic-current-window.png') })
  await skip(page).click()
  await expect(skip(page)).toHaveCount(0)
  await expect(input).toHaveValue('자동 재생 뒤에도 보존할 질문')
  await expect(input).toBeFocused()
  expect(await input.evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd])).toEqual([3, 8])
  expect(await input.evaluate((node, old) => node === old, originalInput)).toBe(true)
  expect(await page.locator('.cp-chart canvas').first().evaluate((node, old) => node === old, canvas)).toBe(true)
  expect(control.errors).toEqual([])
})

for (const blocked of ['browser', 'reduced-motion', 'controller-overlay', 'settings', 'settings-page', 'route'] as const) test(`${blocked}: completion is consumed without moving focus, returning never queues it`, async ({ page }) => {
  const control = await resultHost(page)
  await expect(page.locator('.cp-chart canvas').first()).toBeAttached()
  const input = page.locator('.g-composer textarea')
  await input.focus()
  if (blocked === 'browser') await visibility(page, true)
  if (blocked === 'reduced-motion') await page.emulateMedia({ reducedMotion: 'reduce' })
  if (blocked === 'controller-overlay') await page.evaluate(() => Reflect.get(window, 'blockAutomaticResult')(true))
  if (blocked === 'settings' || blocked === 'settings-page' || blocked === 'route') {
    if (page.viewportSize()!.width <= 1024) await page.locator('.client-hamburger').click()
    if (blocked !== 'route') {
      // Current client member UI: collapsed account / expanded profile row.
      // Do not restore the obsolete direct settings icon to satisfy this test.
      await page.locator('[data-sidebar-action="account"]:visible, [data-sidebar-action="profile-settings"]:visible').first().click()
      await expect(page.locator('.ca-settings')).toBeVisible()
      if (blocked === 'settings-page') {
        await page.locator('.ca-settings [data-menu-action="settings"]').click()
        await expect(page.locator('.client-settings-page')).toBeVisible()
        await expect(page).toHaveURL(/#\/settings\/general$/)
      }
    }
    else { await page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'sharing'), exact: true }).click(); await expect(page.locator('.native-strategies')).toBeVisible() }
  }
  await flush(page)
  const focus = await page.evaluateHandle(() => document.activeElement)
  await deliver(page)
  await expect.poll(() => consumed(page)).toBe(1)
  await flush(page)
  await expect(skip(page)).toHaveCount(0)
  expect(markers(control)).toHaveLength(0)
  expect(await page.evaluate(old => document.activeElement === old, focus)).toBe(true)
  if (blocked === 'browser') await visibility(page, false)
  if (blocked === 'reduced-motion') await page.emulateMedia({ reducedMotion: 'no-preference' })
  if (blocked === 'controller-overlay') await page.evaluate(() => Reflect.get(window, 'blockAutomaticResult')(false))
  if (blocked === 'settings') await page.keyboard.press('Escape')
  if (blocked === 'settings-page') {
    // Mobile detail returns through the client's settings index first.
    const list = page.locator('.client-settings-page .stg-mback')
    if (await list.isVisible()) {
      await list.click()
      await expect(page).toHaveURL(/#\/settings$/)
    }
    await page.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click()
    await expect(page.locator('.client-settings-page')).toHaveCount(0)
    await expect(input).toHaveValue('자동 재생 뒤에도 보존할 질문')
  }
  if (blocked === 'route') await page.goBack()
  await language(page, 'fr'); await language(page, 'ko'); await flush(page)
  await expect(skip(page)).toHaveCount(0)
  expect(markers(control)).toHaveLength(0)
  expect(control.errors).toEqual([])
})

// First-mount consumer boundary, still synthetic v6 report data and a display
// request. This deliberately does not promote an unissued v7 producer result.
for (const heldPath of ['native-report', 'native-trades', 'chart-window'])
for (const abandon of ['none', 'hidden', 'owner'] as const) test(`first result mount ${heldPath}/${abandon}: delayed preparation preserves or retires the one-shot request`, async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const control = await resultHost(page, { mountOnDelivery: true, heldPath, hold: () => pending })
  const input = page.locator('.g-composer textarea'), originalInput = await input.elementHandle()
  await input.focus()
  try {
    await deliver(page)
    await expect(page.locator('.native-service-result')).toHaveCount(1)
    await expect.poll(() => consumed(page)).toBe(1)
    await expect.poll(() => control.requests.some(url => url.pathname.endsWith(heldPath))).toBe(true)
    await expect(skip(page)).toHaveCount(0)
    expect(markers(control)).toHaveLength(0)
    if (abandon === 'hidden') await visibility(page, true)
    if (abandon === 'owner') await page.evaluate(() => Reflect.get(window, 'replaceAutomaticOwner')())
  } finally { release() }
  await expect(page.locator('.cp-chart canvas').first()).toBeAttached()
  const canvas = await page.locator('.cp-chart canvas').first().elementHandle()
  if (abandon === 'none') {
    await expect(skip(page)).toBeVisible()
    await expect(page.locator('.cp-replay progress')).toBeVisible()
    expect(markers(control)).toHaveLength(1)
    await skip(page).click()
    await expect(skip(page)).toHaveCount(0)
    await expect(input).toBeFocused()
  } else {
    if (abandon === 'hidden') await visibility(page, false)
    await language(page, 'fr'); await language(page, 'ko'); await flush(page)
    await expect(skip(page)).toHaveCount(0)
    expect(markers(control)).toHaveLength(0)
  }
  expect(await page.locator('.cp-chart canvas').first().evaluate((node, old) => node === old, canvas)).toBe(true)
  await expect(input).toHaveValue('자동 재생 뒤에도 보존할 질문')
  if (abandon !== 'owner') expect(await input.evaluate((node, old) => node === old, originalInput)).toBe(true)
  expect(await consumed(page)).toBe(1)
  expect(control.errors).toEqual([])
})

for (const failure of ['native-report', 'chart-window', 'native-trades', 'fill-markers']) test(`${failure}: failed preparation never becomes a delayed automatic retry`, async ({ page }) => {
  const control = await resultHost(page, { failure })
  await deliver(page)
  await expect.poll(() => consumed(page)).toBe(1)
  await expect.poll(() => control.requests.some(url => url.pathname.endsWith(failure))).toBe(true)
  await expect(page.locator('.native-service-result').getByRole('alert', { includeHidden: true }).first()).toBeAttached()
  await expect(skip(page)).toHaveCount(0)
  control.failure = ''
  await showChart(page)
  if (failure !== 'native-report') {
    const source = page.locator('.ctt-main-tabs').getByRole('tab', { name: '실행 구간', exact: true })
    if (await source.isVisible()) await source.click()
  }
  const retry = page.getByRole('button', { name: failure === 'native-report' ? '보고서 다시 조회' : '결과 상세 다시 조회', exact: true })
  await retry.click()
  await expect(page.locator('.cp-chart canvas').first()).toBeAttached()
  await expect(page.getByRole('button', { name: '차트로 결과 보기', exact: true })).toHaveAttribute('aria-disabled', 'false')
  await flush(page)
  await expect(skip(page)).toHaveCount(0)
  expect(markers(control)).toHaveLength(failure === 'fill-markers' ? 1 : 0)
  // Manual retry/replay remains available after the one-shot visual request.
  await page.getByRole('button', { name: '차트로 결과 보기', exact: true }).click()
  await expect(skip(page)).toBeVisible(); await skip(page).click()
  expect(control.errors).toEqual([])
})

// Separate App-producer test seam. The real generated v3/v7 clients validate
// protocol fixtures, but NativeServiceResult is a prop observer, NOT a report
// reader. Never combine the unissued v7 binding with synthetic v6 evidence.
async function appProducer(page: Page, kind: 'fresh' | 'lost' | 'history' | 'history-approved' | 'restored' | 'initial-completed') {
  const completed = structuredClone(fixtures.sources[3].fixture.cases!.find(item => item.name === 'COMPLETED')!.response.data) as NativeJob
  const progressing = { ...queued, ...Object.fromEntries((['backtestId', 'splitGroupId', 'strategyVersionId', 'semanticHash', 'profileId', 'profileContentHash', 'createdAt'] as const).map(key => [key, completed[key]])) } as NativeJob
  const ready = { ...conversationFixture.snapshots.ready, semanticHash: completed.semanticHash }
  const documentValue = (name: string) => ({ ...conversationFixture.documents.find(item => item.name === name)!.value, semanticHash: completed.semanticHash })
  const approval = { ...documentValue('approval'), strategyVersionId: completed.strategyVersionId }
  const owner = 'session_auto_producer_fixture_0001'
  const state = { complete: false, lost: kind === 'lost', sessionOwner: owner, posts: [] as { path: string; body: string | null; key: string | undefined }[], reads: [] as string[] }
  const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision, requestId: 'req_auto_producer_fixture_0001', traceId: 'trace_auto_producer_fixture_0001' })
  await page.addInitScript(({ owner, ready, restored, completed }) => {
    sessionStorage.setItem('tesia.native.conversation', ready.conversationId)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
    if (restored) sessionStorage.setItem('tesia.native.pending-command', JSON.stringify({ version: 1, kind: 'SUBMIT', sessionId: owner, sessionState: 'AUTHENTICATED', idempotencyKey: '11111111-2222-4333-8444-555555555555', conversationId: ready.conversationId,
      body: { strategyVersionId: completed.strategyVersionId, expectedSemanticHash: completed.semanticHash, profileId: 'INTERNAL_POC_FULL' } }))
  }, { owner, ready, restored: kind === 'restored', completed })
  await page.route('**/src/internal-poc/NativeServiceResult.tsx*', route => route.fulfill({ contentType: 'application/javascript', body: `
    const seen = new WeakSet(), readers = [];
    export function NativeServiceResult(props) {
      const audit = window.resultProducerAudit ??= { requests: [], jobs: [] };
      audit.readerFactoryPresent = typeof props.createReplayReader === 'function';
      audit.factoryIdentityChanges ??= 0;
      if (audit.factory && audit.factory !== props.createReplayReader) audit.factoryIdentityChanges++;
      audit.factory = props.createReplayReader;
      audit.createReader = input => { readers.push(audit.factory(input)); return readers.length - 1; };
      audit.readReader = async index => {
        try { await readers[index].readMarkers(); return 'RESOLVED'; }
        catch (failure) { return failure.message; }
      };
      audit.disposeReaders = () => readers.forEach(reader => reader.dispose());
      if (!audit.jobs.includes(props.job.backtestId)) audit.jobs.push(props.job.backtestId);
      const request = props.automaticPresentation;
      if (request && !seen.has(request)) { seen.add(request); audit.requests.push({ id: request.backtestId, current: request.isCurrent(), consumed: request.consume() }); }
      return null;
    }
  ` }))
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() === 'POST') state.posts.push({ path, body: request.postData(), key: request.headers()['idempotency-key'] })
    else { expect(request.method()).toBe('GET'); state.reads.push(path) }
    const send = (data: unknown, version: string, revision: string | null, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { ...(revision === null ? {} : { ETag: `"auto_producer_fixture_${revision}"` }), 'cache-control': 'no-store' }, body: JSON.stringify({ meta: meta(version, revision), data }) })
    if (path === '/api/v1/auth/session') return send({ sessionId: state.sessionOwner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }, '0.1.0', '1')
    // App factory lifetime probe only. No synthetic report is accepted as an
    // issued result: its first manifest GET deliberately has no response.
    if (path.endsWith('/chart-manifest')) return route.abort()
    if (path === '/api/v1/auth/csrf') return send({ csrfToken: 'csrf_auto_producer_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' }, '0.1.0', null)
    if (path.startsWith('/api/v3/')) {
      const data = path.endsWith('/validate') ? documentValue('validation-receipt') : path.endsWith('/approval-challenges') ? documentValue('approval-challenge') : path.endsWith('/approve') ? approval : ready
      return send(data, '0.3.0', path.endsWith('/approve') ? '1' : ready.conversationStateRevision, path.endsWith('/approve') || path.endsWith('/approval-challenges') ? 201 : 200)
    }
    if (path.startsWith('/api/v8/')) return send({ conversationId: ready.conversationId, snapshotRevision: '4', limit: 50, rows: [{ approval, job: kind === 'history-approved' ? null : kind === 'initial-completed' ? completed : progressing }] }, '0.8.0', '4')
    if (path.startsWith('/api/v7/')) {
      if (request.method() === 'POST' && state.lost) { state.lost = false; return route.abort('failed') }
      const value = request.method() === 'POST' ? progressing : state.complete || kind === 'initial-completed' ? completed : progressing
      return send(value, '0.7.0', value.revision, request.method() === 'POST' ? 202 : 200)
    }
    throw new Error(`Unexpected producer-only request: ${path}`)
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  const workflow = page.getByRole('region', { name: '전략 요약', exact: true })
  if (kind === 'history' || kind === 'history-approved' || kind === 'initial-completed') {
    await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
    await page.getByRole('button', { name: kind === 'history-approved' ? '이 승인 버전 선택' : '작업 보기', exact: true }).click()
    if (kind === 'history-approved') await workflow.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true }).click()
  } else if (kind === 'restored') await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  else {
    for (const name of ['전략 검증', '승인 내용 확인']) await workflow.getByRole('button', { name, exact: true }).click()
    await workflow.getByRole('checkbox').check()
    await workflow.getByRole('button', { name: '이 전략 버전 승인', exact: true }).click()
    await workflow.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true }).click()
    if (kind === 'lost') await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  }
  await expect(page.locator('.native-job-activity')).toHaveAttribute('data-native-job-state', kind === 'initial-completed' ? 'COMPLETED' : 'QUEUED')
  return { ...state, state, id: completed.backtestId }
}

for (const transition of ['new-conversation', 'different-owner'] as const) test(`App replay reader ${transition}: actual factory retires old reads without cancelling a server job`, async ({ page }) => {
  const { state, id } = await appProducer(page, 'initial-completed')
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'resultProducerAudit')?.jobs ?? [])).toContain(id)
  const report = (fixtures.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
  const trades = (fixtures.sources[2].fixture as unknown as { pages: { name: string; response: { data: NativeTrades } }[] }).pages.find(p => p.name === 'is-last')!.response.data
  const expectedManifestContentHash = (fixtures.sources[0].fixture as unknown as { manifest: NativeChartManifest }).manifest.manifestContentHash
  const input = { job: queued, report, trades, segment: 'IS' as const, expectedManifestContentHash }
  const create = () => page.evaluate(input => Reflect.get(window, 'resultProducerAudit').createReader(input), input)
  const read = (index: number) => page.evaluate(index => Reflect.get(window, 'resultProducerAudit').readReader(index), index)
  const chartReads = () => state.reads.filter(path => path.endsWith('/chart-manifest')).length
  const oldReader = await create()
  expect(chartReads()).toBe(0)
  expect(await read(oldReader)).toBe('TRANSPORT_FAILED')
  expect(chartReads()).toBe(1)
  const posts = [...state.posts]
  const sessionsBefore = state.reads.filter(path => path === '/api/v1/auth/session').length
  if (transition === 'different-owner') state.sessionOwner = 'session_auto_producer_fixture_0002'
  if (await page.locator('.client-rail-new-row button').isVisible()) await page.locator('.client-rail-new-row button').click()
  else { await revealSourceNavigation(page); await page.locator('.client-hamburger').click(); await page.locator('.client-new-strategy').click() }
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  await expect(page.locator('.native-job-activity')).toHaveCount(0)
  expect(state.reads.filter(path => path === '/api/v1/auth/session').length).toBeGreaterThan(sessionsBefore)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', transition === 'different-owner' ? 'error' : 'ready')
  expect(await read(oldReader)).toBe('NATIVE_REPLAY_DISPOSED')
  expect(chartReads()).toBe(1)
  expect(state.posts).toEqual(posts)
  if (transition === 'new-conversation') {
    await page.getByRole('button', { name: '이전 대화 서버에서 다시 확인', exact: true }).click()
    await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
    await page.getByRole('button', { name: '작업 보기', exact: true }).click()
    await expect(page.locator('.native-job-activity')).toHaveAttribute('data-native-job-state', 'COMPLETED')
    const currentReader = await create()
    expect(await read(currentReader)).toBe('TRANSPORT_FAILED')
    expect(await read(oldReader)).toBe('NATIVE_REPLAY_DISPOSED')
    expect(chartReads()).toBe(2)
    expect(state.posts).toEqual(posts)
  }
  await page.evaluate(() => Reflect.get(window, 'resultProducerAudit').disposeReaders())
})

for (const kind of ['fresh', 'lost', 'history', 'history-approved', 'restored', 'initial-completed'] as const) test(`App producer ${kind}: only same-screen fresh observed jobs issue the display port, never a report fixture promotion`, async ({ page }) => {
  const { state, id } = await appProducer(page, kind)
  state.complete = true
  if (kind !== 'initial-completed') await page.locator('.native-job-refresh').click()
  await expect(page.locator('.native-job-activity')).toHaveAttribute('data-native-job-state', 'COMPLETED')
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'resultProducerAudit')?.jobs ?? [])).toContain(id)
  expect(await page.evaluate(() => Reflect.get(window, 'resultProducerAudit').readerFactoryPresent)).toBe(true)
  const requests = await page.evaluate(() => Reflect.get(window, 'resultProducerAudit').requests)
  expect(requests).toEqual(kind === 'fresh' || kind === 'lost' || kind === 'history-approved' ? [{ id, current: true, consumed: true }] : [])
  const submits = state.posts.filter(item => item.path === '/api/v7/backtests')
  expect(submits).toHaveLength(kind === 'history' || kind === 'initial-completed' ? 0 : kind === 'lost' ? 2 : 1)
  if (kind === 'lost') expect(submits[1]).toEqual(submits[0])
  const reads = state.reads.length, posts = [...state.posts]
  const factoryChanges = await page.evaluate(() => Reflect.get(window, 'resultProducerAudit').factoryIdentityChanges)
  await language(page, 'fr'); await language(page, 'ko'); await flush(page)
  expect(await page.evaluate(() => Reflect.get(window, 'resultProducerAudit').factoryIdentityChanges)).toBe(factoryChanges)
  expect(await page.evaluate(() => Reflect.get(window, 'resultProducerAudit').requests)).toEqual(requests)
  expect(state.reads).toHaveLength(reads); expect(state.posts).toEqual(posts)
})

test('App producer background catch-up never issues a delayed automatic presentation on return', async ({ page }) => {
  const { state, id } = await appProducer(page, 'fresh')
  await visibility(page, true)
  state.complete = true
  // The production poller slows hidden observations and performs a catch-up
  // GET on return. It must still observe the job, without delayed auto-entry.
  await visibility(page, false)
  await expect(page.locator('.native-job-activity')).toHaveAttribute('data-native-job-state', 'COMPLETED')
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'resultProducerAudit')?.jobs ?? [])).toContain(id)
  expect(await page.evaluate(() => Reflect.get(window, 'resultProducerAudit').requests)).toEqual([])
  expect(state.posts.filter(item => item.path === '/api/v7/backtests')).toHaveLength(1)
})

for (const abandon of ['owner', 'hidden', 'overlay', 'skip'] as const) test(`${abandon}: abandoning an in-flight automatic marker read cannot replay its late response`, async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const control = await resultHost(page, { heldPath: 'fill-markers', hold: () => pending })
  await expect(page.locator('.cp-chart canvas').first()).toBeAttached()
  await deliver(page)
  await expect.poll(() => markers(control).length).toBe(1)
  await expect(skip(page)).toBeVisible()
  if (abandon === 'owner') await page.evaluate(() => Reflect.get(window, 'replaceAutomaticOwner')())
  if (abandon === 'hidden') await visibility(page, true)
  if (abandon === 'overlay') await page.evaluate(() => Reflect.get(window, 'blockAutomaticResult')(true))
  if (abandon === 'skip') await skip(page).click()
  await expect(skip(page)).toHaveCount(0)
  release(); await flush(page)
  if (abandon === 'hidden') await visibility(page, false)
  if (abandon === 'overlay') await page.evaluate(() => Reflect.get(window, 'blockAutomaticResult')(false))
  await language(page, 'fr'); await language(page, 'ko'); await flush(page)
  await expect(skip(page)).toHaveCount(0)
  await expect(page.locator('.cp-replay')).toHaveCount(0)
  expect(markers(control)).toHaveLength(1)
  expect(control.errors).toEqual([])
})

test('mid-replay reduced motion returns the original draft selection without restarting', async ({ page }) => {
  const control = await resultHost(page)
  await expect(page.locator('.cp-chart canvas').first()).toBeAttached()
  const input = page.locator('.g-composer textarea'), original = await input.elementHandle()
  await expect(input).toHaveValue('자동 재생 뒤에도 보존할 질문')
  await input.focus()
  await input.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(3, 8, 'backward'))
  await deliver(page)
  await expect(skip(page)).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(skip(page)).toHaveCount(0)
  await expect(input).toBeFocused()
  expect(await input.evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd, (node as HTMLTextAreaElement).selectionDirection])).toEqual([3, 8, 'backward'])
  expect(await input.evaluate((node, old) => node === old, original)).toBe(true)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await language(page, 'fr'); await language(page, 'ko'); await flush(page)
  await expect(skip(page)).toHaveCount(0)
  expect(markers(control)).toHaveLength(1)
})

test('natural completion remains slow, single-canvas, and a locale change never starts it again', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  const control = await resultHost(page)
  await expect(page.locator('.cp-chart canvas').first()).toBeAttached()
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
  await deliver(page)
  await expect(skip(page)).toBeVisible()
  await expect(page.locator('.cp-replay progress')).toBeAttached()
  await page.clock.runFor(12000)
  await expect(skip(page)).toBeVisible()
  await expect(page.locator('.cp-execution')).toContainText('BUY')
  await page.clock.runFor(47000)
  await expect(skip(page)).toBeVisible()
  await page.clock.runFor(1100)
  await expect(skip(page)).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue('자동 재생 뒤에도 보존할 질문')
  for (const value of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) await language(page, value)
  await page.clock.runFor(2000)
  expect(markers(control)).toHaveLength(1)
  await expect(skip(page)).toHaveCount(0)
  expect(control.errors).toEqual([])
})
