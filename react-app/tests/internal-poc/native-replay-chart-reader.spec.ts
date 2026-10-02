import { test, expect, type Page } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeChartManifest, NativeChartWindow, NativeReport, NativeTrades, NativeJob } from '../../src/internal-poc/native-service-api'

test.beforeEach(async ({ page }) => {
  await page.route('**/replay-reader-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>합성 SDK 재생 조회 수명 검사</body></html>' }))
  await page.goto('/replay-reader-test.html')
})

async function inspect(page: Page, scenario: string) {
  return page.evaluate(async ({ data, scenario }) => {
    const modulePath = '/src/internal-poc/native-replay-chart-reader.ts', apiPath = '/src/internal-poc/native-service-api.ts'
    const { createNativeReplayChartReader } = await import(/* @vite-ignore */ modulePath)
    const { createNativeServiceApi, NativeServiceTransport } = await import(/* @vite-ignore */ apiPath)
    const fixture = data.sources[0].fixture as unknown as { meta: unknown; binding: NativeChartManifest['binding']; sourcePolicy: NativeChartManifest['sourcePolicy']; manifest: Omit<NativeChartManifest, 'binding' | 'sourcePolicy'>; window: Omit<NativeChartWindow, 'binding' | 'sourcePolicy'> }
    const report = structuredClone((data.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data)
    const job = { ...(data.sources[3].fixture as unknown as { cases: { response: { data: NativeJob } }[] }).cases[0].response.data, state: 'COMPLETED', resultAvailable: true, nativeReportBinding: report.binding } as NativeJob
    const trades = structuredClone((data.sources[2].fixture as unknown as { pages: { name: string; response: { data: NativeTrades } }[] }).pages.find(item => item.name === 'is-last')!.response.data)
    const serverTradeHash = trades.tradeManifestContentHash
    const evaluation = report.nativeEnvelope.projection.segments.find(item => item.segment === 'IS')!
    const bounds = { fromInclusive: evaluation.evaluationStartInclusive, toExclusive: evaluation.evaluationEndExclusive }
    const binding = { ...fixture.binding, segment: 'IS', backtestId: job.backtestId, strategyVersionId: job.strategyVersionId, semanticHash: job.semanticHash, splitGroupId: job.splitGroupId, resultContentHash: evaluation.resultContentHash }
    const manifest = { ...fixture.manifest, binding, sourcePolicy: fixture.sourcePolicy, segmentBounds: bounds, series: fixture.manifest.series.map(item => ({ ...item, availableRange: bounds })) }
    const reversedPolicy = Object.fromEntries(Object.entries(fixture.sourcePolicy).reverse().map(([key, value]) => [key,
      value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).reverse()) : value]))
    const requests: string[] = [], owner = new AbortController()
    let aborts = 0, current = true, hold: string | null = null, release = () => {}, entered = () => {}, failOnce = false
    let enteredPromise = Promise.resolve(), heldPromise = Promise.resolve()
    const setHold = (kind: string) => {
      hold = kind
      enteredPromise = new Promise<void>(resolve => { entered = resolve })
      heldPromise = new Promise<void>(resolve => { release = resolve })
    }
    const transport = {
      abort() { aborts++ },
      async request(request: { path: string }) {
        const url = new URL(request.path, location.origin), kind = url.pathname.split('/').at(-1)!
        requests.push(kind)
        if (kind === hold) { entered(); await heldPromise }
        if (failOnce) { failOnce = false; throw new Error('SYNTHETIC_TIMEOUT') }
        if (scenario.startsWith('rotation-') && kind === scenario.slice('rotation-'.length)) {
          return { status: 409, headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ meta: fixture.meta, error: { code: 'SNAPSHOT_CHANGED', message: 'Result request failed.' } }) }
        }
        let body: unknown
        if (kind === 'chart-manifest') body = { meta: fixture.meta, data: manifest }
        else if (kind === 'fill-markers') body = { meta: fixture.meta, data: { binding, sourcePolicy: fixture.sourcePolicy, manifestContentHash: manifest.manifestContentHash,
          tradeManifestContentHash: scenario === 'bad-marker' ? 'a'.repeat(64) : serverTradeHash, limit: 100, markers: [], pageContentHash: '9'.repeat(64) } }
        else {
          const requestedRange = { fromInclusive: url.searchParams.get('fromInclusive'), toExclusive: url.searchParams.get('toExclusive') }
          body = { meta: fixture.meta, data: { ...fixture.window, binding, sourcePolicy: fixture.sourcePolicy, manifestContentHash: manifest.manifestContentHash,
            seriesId: url.searchParams.get('seriesId'), resolution: url.searchParams.get('resolution'), aggregationPolicy: 'UTC_EPOCH_COMPLETE_OHLCV', requestedRange,
            ...(scenario === 'bad-window' ? { binding: { ...binding, semanticHash: 'a'.repeat(64) } } : {}),
            bars: [], coverage: { status: 'UNAVAILABLE', coveredRanges: [], missingRanges: [requestedRange] } } }
        }
        if (scenario === 'policy-order' && kind !== 'chart-manifest') (body as { data: { sourcePolicy: unknown } }).data.sourcePolicy = reversedPolicy
        if (scenario === 'policy-changed' && kind !== 'chart-manifest') {
          (body as { data: { sourcePolicy: unknown } }).data.sourcePolicy = { ...fixture.sourcePolicy,
            sourceProvenance: { source: fixture.sourcePolicy.sourceProvenance.source === 'RECORDED_DEV_FIXTURE' ? 'SYNTHETIC_UI_FIXTURE' : 'RECORDED_DEV_FIXTURE', verification: 'UNVERIFIED', rights: 'PRIVATE_ONLY' } }
        }
        const encoded = JSON.stringify(body)
        return { status: 200, headers: { 'cache-control': 'no-store' }, body: scenario === 'strict' ? encoded.replace('"data":', '"data":null,"data":') : encoded }
      },
    }
    const create = () => createNativeReplayChartReader({ job, report, trades, segment: 'IS', transport, ownerSignal: owner.signal, isCurrent: () => current,
      ...(scenario === 'chrono-expected' ? { expectedManifestContentHash: 'a'.repeat(64) } : {}) })
    const reader = create(), count = (kind: string) => requests.filter(value => value === kind).length
    const failure = async (promise: Promise<unknown>) => { try { await promise; return 'RESOLVED' } catch (error) { return (error as Error).message } }
    if (scenario.startsWith('chrono-')) {
      const originalFetch = window.fetch, signals: AbortSignal[] = []
      const validatorPath = '/src/internal-poc/contracts/generated/api-v0.11/validator.ts'
      const { chronologicalFillPageContentHash } = await import(/* @vite-ignore */ validatorPath)
      let fillReads = 0
      window.fetch = async (url, init) => {
        fillReads++; signals.push(init!.signal as AbortSignal)
        if (scenario.startsWith('chrono-fill-')) { entered(); await heldPromise }
        const data = { binding, sourcePolicy: fixture.sourcePolicy, manifestContentHash: manifest.manifestContentHash,
          tradeManifestContentHash: serverTradeHash, limit: 100, totalCount: 0, offset: 0, eof: true, markers: [], pageContentHash: '' }
        data.pageContentHash = await chronologicalFillPageContentHash(data)
        const meta = { apiContractVersion: '0.11.0', requestId: 'req_chart_test_0001', traceId: 'trace_chart_test_0001', resourceRevision: null }
        const response = new Response(JSON.stringify({ meta, data }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', etag: `"${data.pageContentHash}"` } })
        Object.defineProperty(response, 'url', { value: String(url) })
        return response
      }
      try {
        if (scenario === 'chrono-expected') return { outcome: await failure(reader.readChronologicalMarkers()), fillReads, manifests: count('chart-manifest') }
        if (scenario === 'chrono-retry') {
          failOnce = true
          const first = await failure(reader.readChronologicalMarkers()), beforeRetry = fillReads
          const second = await failure(reader.readChronologicalMarkers())
          return { first, beforeRetry, second, fillReads, manifests: count('chart-manifest') }
        }
        if (scenario === 'chrono-capture') {
          job.semanticHash = 'a'.repeat(64); trades.tradeManifestContentHash = 'b'.repeat(64)
          report.nativeEnvelope.projection.segments[0].evaluationStartInclusive = '2000-01-01T00:00:00Z'
          const window = await reader.readWindow()
          window.manifest.manifestContentHash = 'c'.repeat(64); window.manifest.binding.runId = 'run_changed_0001'
          const outcome = await failure(reader.readChronologicalMarkers())
          return { outcome, fillReads, manifests: count('chart-manifest') }
        }
        const kind = scenario.startsWith('chrono-fill-') ? 'fill' : 'chart-manifest'
        setHold(kind)
        const pending = failure(reader.readChronologicalMarkers())
        await enteredPromise
        const busy = await failure(reader.readChronologicalMarkers())
        if (scenario === 'chrono-concurrent') {
          const window = failure(reader.readWindow()), markers = failure(reader.readMarkers())
          release()
          return { busy, outcomes: await Promise.all([pending, window, markers]), manifests: count('chart-manifest'), fillReads,
            done: await reader.readChronologicalMarkers() }
        }
        if (scenario.endsWith('-owner')) owner.abort()
        else if (scenario.endsWith('-stale')) current = false
        else reader.dispose()
        const abortedBeforeRelease = signals.map(signal => signal.aborted)
        release()
        const outcome = await pending, after = await failure(reader.readChronologicalMarkers())
        return { busy, outcome, after, fillReads, aborts, abortedBeforeRelease, aborted: signals.every(signal => signal.aborted) }
      } finally { release(); reader.dispose(); window.fetch = originalFetch }
    }
    if (scenario === 'isolated-transports') {
      // Use real browser transports: AbortController ownership, not just a fake
      // abort counter. No actual server/provider request leaves this page.
      const originalFetch = window.fetch, signals: AbortSignal[] = []
      let allEntered = () => {}
      const allPending = new Promise<void>(resolve => { allEntered = resolve })
      setHold('chart-window')
      window.fetch = async (input, init) => {
        const url = new URL(String(input)), signal = init!.signal as AbortSignal
        if (url.pathname.endsWith('chart-window')) { signals.push(signal); if (signals.length === 3) allEntered() }
        let rejectAbort = () => {}
        const aborted = new Promise<never>((_, reject) => { rejectAbort = () => reject(new DOMException('Aborted', 'AbortError')) })
        signal.addEventListener('abort', rejectAbort, { once: true })
        try {
          const result = await Promise.race([transport.request({ path: url.pathname + url.search }), aborted])
          const response = new Response(String(result.body), { status: result.status, headers: { ...result.headers, 'content-type': 'application/json' } })
          Object.defineProperty(response, 'url', { value: url.href })
          return response
        } finally { signal.removeEventListener('abort', rejectAbort) }
      }
      const firstTransport = new NativeServiceTransport(), secondTransport = new NativeServiceTransport(), manualTransport = new NativeServiceTransport()
      const first = createNativeReplayChartReader({ job, report, trades, segment: 'IS', transport: firstTransport, ownerSignal: owner.signal, isCurrent: () => current })
      const second = createNativeReplayChartReader({ job, report, trades, segment: 'IS', transport: secondTransport, ownerSignal: owner.signal, isCurrent: () => current })
      try {
        const a = failure(first.readWindow())
        await enteredPromise // Establish A's signal identity; arrival order of B/manual is immaterial.
        const b = failure(second.readWindow()), manual = failure(createNativeServiceApi(manualTransport).chart(job, report, 'IS'))
        await allPending
        first.dispose()
        const interrupted = signals.map(signal => signal.aborted)
        const firstOutcome = await a
        release()
        return { interrupted, outcomes: [firstOutcome, await b, await manual] }
      } finally {
        release(); first.dispose(); second.dispose(); manualTransport.abort(); reader.dispose(); window.fetch = originalFetch
      }
    }
    if (scenario === 'expected-hash') {
      const outcome = await failure(reader.readWindow({ expectedManifestContentHash: 'a'.repeat(64) }))
      reader.dispose()
      return { outcome, manifests: count('chart-manifest'), windows: count('chart-window') }
    }
    if (scenario.startsWith('rotation-')) {
      const outcome = await failure(scenario.endsWith('fill-markers') ? reader.readMarkers() : reader.readWindow())
      reader.dispose()
      return { outcome, manifests: count('chart-manifest'), reads: requests.length, aborts }
    }
    if (scenario === 'policy-order' || scenario === 'policy-changed') {
      const window = await failure(reader.readWindow()), markers = await failure(reader.readMarkers())
      const manual = await failure(createNativeServiceApi(transport).chart(job, report, 'IS'))
      reader.dispose()
      return { window, markers, manual }
    }
    if (scenario === 'reuse') {
      await reader.readWindow(); await reader.readWindow(); await reader.readMarkers()
      const replay = [count('chart-manifest'), count('chart-window'), count('fill-markers')]
      const manual = createNativeServiceApi(transport)
      await manual.chart(job, report, 'IS'); await manual.chart(job, report, 'IS')
      const afterManual = [count('chart-manifest'), count('chart-window')]
      const second = create(); await second.readWindow(); second.dispose(); reader.dispose()
      return { replay, afterManual, total: [count('chart-manifest'), count('chart-window')], aborts }
    }
    if (scenario === 'dispose' || scenario === 'owner-before' || scenario === 'current-before') {
      if (scenario === 'dispose') { reader.dispose(); reader.dispose() }
      else if (scenario === 'owner-before') owner.abort()
      else current = false
      const outcome = await failure(reader.readWindow()), marker = await failure(reader.readMarkers())
      reader.dispose()
      return { outcome, marker, requests, aborts }
    }
    if (scenario === 'snapshot') {
      const expectedHash = manifest.manifestContentHash
      job.semanticHash = 'a'.repeat(64)
      report.nativeEnvelope.projection.segments[0].evaluationStartInclusive = '2000-01-01T00:00:00Z'
      trades.tradeManifestContentHash = 'b'.repeat(64)
      const first = await reader.readWindow()
      first.manifest.manifestContentHash = 'b'.repeat(64)
      first.manifest.series[0].supportedResolutions.length = 0
      const second = await reader.readWindow()
      await reader.readMarkers()
      reader.dispose()
      return { hash: second.manifest.manifestContentHash, expectedHash, manifests: count('chart-manifest'), windows: count('chart-window') }
    }
    if (scenario === 'busy' || scenario === 'busy-marker') {
      const markersFirst = scenario === 'busy-marker'
      setHold(markersFirst ? 'fill-markers' : 'chart-manifest')
      const first = markersFirst ? reader.readMarkers() : reader.readWindow(); await enteredPromise
      const second = failure(markersFirst ? reader.readMarkers() : reader.readWindow())
      const marker = markersFirst ? reader.readWindow() : reader.readMarkers()
      // A busy call must reject without waiting for the held first read.
      const busy = await Promise.race([second, new Promise<string>(resolve => setTimeout(() => resolve('BLOCKED'), 100))])
      release(); await Promise.all([first, second, marker]); reader.dispose()
      return { busy, manifests: count('chart-manifest'), windows: count('chart-window'), markers: count('fill-markers') }
    }
    if (scenario.startsWith('late-') || scenario.startsWith('skip-') || scenario.startsWith('stale-')) {
      const kind = scenario.slice(scenario.indexOf('-') + 1), markerRead = kind === 'fill-markers'
      setHold(kind)
      const pending = failure(markerRead ? reader.readMarkers() : reader.readWindow())
      await enteredPromise
      if (scenario.startsWith('skip-')) reader.dispose()
      else if (scenario.startsWith('stale-')) current = false
      else owner.abort()
      release()
      const outcome = await pending, before = requests.length
      const next = await failure(reader.readWindow())
      reader.dispose()
      return { outcome, next, extraReads: requests.length - before, aborts }
    }
    if (scenario === 'retry') {
      failOnce = true
      const first = await failure(reader.readWindow())
      const next = await reader.readWindow()
      reader.dispose()
      return { first, state: next.window.coverage.status, manifests: count('chart-manifest') }
    }
    if (scenario === 'strict') {
      const outcome = await failure(reader.readWindow())
      reader.dispose()
      return { rejected: outcome !== 'RESOLVED', windows: count('chart-window') }
    }
    if (scenario === 'bad-marker' || scenario === 'bad-window') {
      const outcome = await failure(scenario === 'bad-marker' ? reader.readMarkers() : reader.readWindow())
      reader.dispose()
      return { outcome }
    }
    throw new Error('UNKNOWN_TEST_SCENARIO')
  }, { data: fixtures, scenario })
}

test('reader의 manifest는 한 수명에 재사용하고 수동 chart는 매번 새로 조회한다', async ({ page }) => {
  expect(await inspect(page, 'reuse')).toEqual({ replay: [1, 2, 1], afterManual: [3, 4], total: [4, 5], aborts: 2 })
})
for (const scenario of ['dispose', 'owner-before', 'current-before']) test(`${scenario}: 폐기 뒤 window·marker 네트워크 조회는 0이다`, async ({ page }) => {
  expect(await inspect(page, scenario)).toEqual({ outcome: 'NATIVE_REPLAY_DISPOSED', marker: 'NATIVE_REPLAY_DISPOSED', requests: [], aborts: 1 })
})
test('호출자와 반환 manifest의 변이가 private snapshot을 바꾸지 않는다', async ({ page }) => {
  const result = await inspect(page, 'snapshot')
  expect(result).toMatchObject({ manifests: 1, windows: 2 })
  expect(result && 'hash' in result ? result.hash : undefined).toBe(result && 'expectedHash' in result ? result.expectedHash : null)
})
for (const scenario of ['busy', 'busy-marker']) test(`${scenario}: window·marker 각각 한 요청만 허용하며 중복은 즉시 거절한다`, async ({ page }) => {
  expect(await inspect(page, scenario)).toEqual({ busy: 'NATIVE_REPLAY_READ_BUSY', manifests: 1, windows: 1, markers: 1 })
})
for (const boundary of ['late', 'skip', 'stale']) for (const kind of ['chart-manifest', 'chart-window', 'fill-markers']) test(`${boundary}/${kind}: owner·Skip·현재수명 상실 뒤 늦은 응답과 후속 요청을 막는다`, async ({ page }) => {
  expect(await inspect(page, `${boundary}-${kind}`)).toEqual({ outcome: 'NATIVE_REPLAY_DISPOSED', next: 'NATIVE_REPLAY_DISPOSED', extraReads: 0, aborts: 1 })
})
for (const scenario of ['bad-marker', 'bad-window']) test(`${scenario}: 재사용 manifest도 window·trade 결속 오류를 거절한다`, async ({ page }) => {
  expect(await inspect(page, scenario)).toEqual({ outcome: 'NATIVE_RESULT_BINDING_CONFLICT' })
})
test('네트워크 실패는 사용자 취소로 바뀌지 않고 명시 재조회가 가능하다', async ({ page }) => {
  expect(await inspect(page, 'retry')).toEqual({ first: 'TRANSPORT_FAILED', state: 'UNAVAILABLE', manifests: 2 })
})
test('v5 strict JSON 중복 키 거절을 재생 reader도 유지한다', async ({ page }) => {
  expect(await inspect(page, 'strict')).toEqual({ rejected: true, windows: 0 })
})
test('예상 manifest가 다르면 window 요청 전 거절한다', async ({ page }) => {
  expect(await inspect(page, 'expected-hash')).toEqual({ outcome: 'NATIVE_RESULT_BINDING_CONFLICT', manifests: 1, windows: 0 })
})
for (const kind of ['chart-window', 'fill-markers']) test(`${kind}: 서버 스냅샷 변경을 자동 재조회로 덮지 않는다`, async ({ page }) => {
  expect(await inspect(page, `rotation-${kind}`)).toEqual({ outcome: 'SNAPSHOT_CHANGED', manifests: 1, reads: 2, aborts: 1 })
})
test('같은 sourcePolicy의 JSON 필드 순서는 결속 실패가 아니다', async ({ page }) => {
  expect(await inspect(page, 'policy-order')).toEqual({ window: 'RESOLVED', markers: 'RESOLVED', manual: 'RESOLVED' })
})
test('sourcePolicy의 실제 출처가 바뀌면 재생과 수동 조회 모두 거절한다', async ({ page }) => {
  expect(await inspect(page, 'policy-changed')).toEqual({ window: 'NATIVE_RESULT_BINDING_CONFLICT', markers: 'NATIVE_RESULT_BINDING_CONFLICT', manual: 'NATIVE_RESULT_BINDING_CONFLICT' })
})
test('재생 A의 Skip은 동시 재생 B와 수동 조회의 실제 transport를 취소하지 않는다', async ({ page }) => {
  expect(await inspect(page, 'isolated-transports')).toEqual({ interrupted: [true, false, false], outcomes: ['NATIVE_REPLAY_DISPOSED', 'RESOLVED', 'RESOLVED'] })
})

test('시간순 자식은 부모의 이미 표시된 manifest 불일치에서 GET0으로 닫힌다', async ({ page }) => {
  expect(await inspect(page, 'chrono-expected')).toEqual({ outcome: 'NATIVE_RESULT_BINDING_CONFLICT', fillReads: 0, manifests: 1 })
})
test('부모 manifest 실패는 시간순 GET을 만들지 않고 명시 재시도 때만 복구한다', async ({ page }) => {
  expect(await inspect(page, 'chrono-retry')).toEqual({ first: 'TRANSPORT_FAILED', beforeRetry: 0, second: 'RESOLVED', fillReads: 1, manifests: 2 })
})
test('lazy 시간순 생성에도 부모의 원입력과 반환 manifest 변이가 섞이지 않는다', async ({ page }) => {
  expect(await inspect(page, 'chrono-capture')).toEqual({ outcome: 'RESOLVED', fillReads: 1, manifests: 1 })
})
test('시간순·가격창·기존마커는 manifest1회만 공유하고 중복 시간순 읽기만 거절한다', async ({ page }) => {
  expect(await inspect(page, 'chrono-concurrent')).toEqual({ busy: 'NATIVE_REPLAY_READ_BUSY', outcomes: ['RESOLVED', 'RESOLVED', 'RESOLVED'], manifests: 1, fillReads: 1, done: null })
})
for (const stage of ['manifest', 'fill']) for (const retirement of ['dispose', 'owner', 'stale']) test(`시간순 부모 ${stage}/${retirement}는 늦은 응답과 후속 GET을 거절한다`, async ({ page }) => {
  expect(await inspect(page, `chrono-${stage}-${retirement}`)).toEqual({ busy: 'NATIVE_REPLAY_READ_BUSY', outcome: 'NATIVE_REPLAY_DISPOSED', after: 'NATIVE_REPLAY_DISPOSED',
    fillReads: stage === 'fill' ? 1 : 0, aborts: 1, abortedBeforeRelease: stage === 'fill' ? [retirement !== 'stale'] : [], aborted: true })
})
