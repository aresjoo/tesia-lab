import { expect, test } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeChartManifest, NativeJob, NativeReport, NativeTrades } from '../../src/internal-poc/native-service-api'

test('isActive는 GET 없이 명시dispose·owner폐기·현재성상실을 확인하며 폐기된 reader를 복구하지 않는다', async ({ page }) => {
  let reads = 0
  await page.route('**/api/**', route => { reads++; return route.abort() })
  await page.route('**/replay-scope-active-test.html', route => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><html lang="ko"><body>네트워크 없는 reader 수명 확인</body></html>' }))
  await page.goto('/replay-scope-active-test.html')
  const result = await page.evaluate(async data => {
    const path = '/src/internal-poc/native-replay-reader-scope.ts'
    const { createNativeReplayReaderScope } = await import(/* @vite-ignore */ path)
    const report = (data.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
    const job = { ...(data.sources[3].fixture as unknown as { cases: { response: { data: NativeJob } }[] }).cases[0].response.data,
      state: 'COMPLETED', resultAvailable: true, nativeReportBinding: report.binding } as NativeJob
    const trades = (data.sources[2].fixture as unknown as { pages: { name: string; response: { data: NativeTrades } }[] }).pages.find(p => p.name === 'is-last')!.response.data
    const expectedManifestContentHash = (data.sources[0].fixture as unknown as { manifest: NativeChartManifest }).manifest.manifestContentHash
    const request = { job, report, trades, segment: 'IS' as const, expectedManifestContentHash }
    const scope = createNativeReplayReaderScope()
    const explicit = scope.create(request, () => true)
    let explicitEvents = 0, ownerEvents = 0, currentEvents = 0
    explicit.retirementSignal.addEventListener('abort', () => { explicitEvents++ })
    const explicitStates = [explicit.isActive(), explicit.isActive()]
    explicit.dispose()
    explicitStates.push(explicit.isActive())
    explicit.dispose()
    explicitStates.push(explicit.isActive())

    const bound = scope.create(request, () => true)
    bound.retirementSignal.addEventListener('abort', () => { ownerEvents++ })
    const ownerStates = [bound.isActive()]
    scope.invalidate()
    ownerStates.push(bound.isActive())
    const replacement = scope.create(request, () => true)
    ownerStates.push(bound.isActive(), replacement.isActive())

    let current = true
    const stale = scope.create(request, () => current)
    stale.retirementSignal.addEventListener('abort', () => { currentEvents++ })
    const currentStates = [stale.isActive()]
    current = false
    currentStates.push(stale.isActive())
    current = true
    currentStates.push(stale.isActive())
    scope.invalidate()
    ownerStates.push(replacement.isActive())
    currentStates.push(stale.isActive())
    return { explicitStates, ownerStates, currentStates, events: [explicitEvents, ownerEvents, currentEvents],
      signals: [explicit.retirementSignal.aborted, bound.retirementSignal.aborted, stale.retirementSignal.aborted] }
  }, fixtures)
  expect(result).toEqual({ explicitStates: [true, true, false, false],
    ownerStates: [true, false, false, true, false], currentStates: [true, false, false, false], events: [1, 1, 1], signals: [true, true, true] })
  expect(reads).toBe(0)
})

test('scope 생성은 조회하지 않고 A→B→A에도 이전 reader가 되살아나지 않는다', async ({ page }) => {
  let reads = 0
  await page.route('**/api/**', route => { reads++; return route.abort() })
  await page.route('**/replay-scope-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><body>재생 조회 소유 수명 검사</body></html>' }))
  await page.goto('/replay-scope-test.html')
  const result = await page.evaluate(async data => {
    const path = '/src/internal-poc/native-replay-reader-scope.ts'
    const { createNativeReplayReaderScope } = await import(/* @vite-ignore */ path)
    const report = (data.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
    const job = { ...(data.sources[3].fixture as unknown as { cases: { response: { data: NativeJob } }[] }).cases[0].response.data,
      state: 'COMPLETED', resultAvailable: true, nativeReportBinding: report.binding } as NativeJob
    const trades = (data.sources[2].fixture as unknown as { pages: { name: string; response: { data: NativeTrades } }[] }).pages.find(p => p.name === 'is-last')!.response.data
    const expectedManifestContentHash = (data.sources[0].fixture as unknown as { manifest: NativeChartManifest }).manifest.manifestContentHash
    const request = { job, report, trades, segment: 'IS' as const, expectedManifestContentHash }
    const failure = async (promise: Promise<unknown>) => { try { await promise; return 'RESOLVED' } catch (error) { return (error as Error).message } }
    const scope = createNativeReplayReaderScope()
    const a = scope.create(request, () => true)
    scope.invalidate()
    const b = scope.create(request, () => true)
    scope.invalidate()
    const nextA = scope.create(request, () => true)
    const retired = await Promise.all([a.readWindow(), a.readMarkers(), b.readWindow(), b.readMarkers()].map(failure))
    // A current reader is still usable after invalidation. The test server
    // intentionally fails its first GET; it must not report owner disposal.
    const current = await failure(nextA.readMarkers())
    scope.invalidate()
    const after = await failure(nextA.readMarkers())
    scope.invalidate() // Idempotent even with no surviving readers.
    return { retired, current, after }
  }, fixtures)
  expect(result).toEqual({ retired: Array(4).fill('NATIVE_REPLAY_DISPOSED'), current: 'TRANSPORT_FAILED', after: 'NATIVE_REPLAY_DISPOSED' })
  expect(reads).toBe(1)
})
