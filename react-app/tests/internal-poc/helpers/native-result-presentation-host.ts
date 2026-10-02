import { expect, type Page, type Route } from '@playwright/test'
import fixtures from '../fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeChartManifest, NativeChartWindow, NativeFillMarkers, NativeJob, NativeReport, NativeTrades } from '../../../src/internal-poc/native-service-api'
import { chronologicalFillPageContentHash } from '../../../src/internal-poc/contracts/generated/api-v0.11/validator'
import type { ChronologicalFillPage, ChronologicalFillPageEnvelope } from '../../../src/internal-poc/contracts/generated/api-v0.11/types'

const envelope = (fixtures.sources[1].fixture as unknown as { response: { meta: unknown; data: NativeReport } }).response
const report = envelope.data
const queued = (fixtures.sources[3].fixture as unknown as { cases: { response: { data: NativeJob } }[] }).cases[0].response.data
// Display-only result prop. It is NOT an issued v7 COMPLETED response.
const displayJob = { ...queued, state: 'COMPLETED', resultAvailable: true, nativeReportBinding: report.binding }
const fixture = fixtures.sources[0].fixture as unknown as { meta: unknown; binding: NativeChartManifest['binding']; sourcePolicy: NativeChartManifest['sourcePolicy']; manifest: Omit<NativeChartManifest, 'binding' | 'sourcePolicy'>; window: Omit<NativeChartWindow, 'binding' | 'sourcePolicy'> }
const tradePages = (fixtures.sources[2].fixture as unknown as { pages: { name: string; response: { meta: unknown; data: NativeTrades } }[] }).pages
const utc = (time: number) => new Date(time).toISOString().replace('.000Z', 'Z')
const reply = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(body) })

export async function resultHost(page: Page, options: { failure?: string; hold?: () => Promise<void>; heldPath?: string; mountOnDelivery?: boolean; replayReader?: boolean; factoryDisposed?: boolean; boundedReplayPrices?: boolean; paginatedReplayFills?: boolean } = {}) {
  const control = { requests: [] as URL[], settled: [] as URL[], failure: options.failure ?? '', hold: options.hold, heldPath: options.heldPath ?? '', errors: [] as string[], manifestHash: fixture.manifest.manifestContentHash }
  page.on('pageerror', error => control.errors.push(error.message))
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); control.requests.push(url)
    try {
    expect(route.request().method()).toBe('GET')
    if (control.hold && url.pathname.endsWith(`/${control.heldPath}`)) await control.hold()
    if (control.failure && url.pathname.endsWith(`/${control.failure}`)) return await route.abort()
    if (url.pathname.endsWith('native-report')) return await reply(route, envelope)
    const segment = url.searchParams.get('segment') as 'IS' | 'OOS'
    const trades = tradePages.find(item => item.name === (segment === 'IS' ? 'is-last' : 'oos-default'))!.response
    if (url.pathname.endsWith('native-trades')) return await reply(route, { ...trades, data: { ...trades.data, limit: 100 } })
    const evaluation = report.nativeEnvelope.projection.segments.find(item => item.segment === segment)!
    const bounds = { fromInclusive: evaluation.evaluationStartInclusive, toExclusive: evaluation.evaluationEndExclusive }
    // Only this explicitly requested synthetic PRICE supply is short. The
    // verified report segment remains unchanged: this is not a 730-day producer.
    const availableRange = options.boundedReplayPrices ? { ...bounds, toExclusive: utc(Math.min(Date.parse(bounds.toExclusive), Date.parse(bounds.fromInclusive) + 1200 * 60_000)) } : bounds
    const binding = { ...fixture.binding, segment, backtestId: displayJob.backtestId, splitGroupId: displayJob.splitGroupId, strategyVersionId: displayJob.strategyVersionId, semanticHash: displayJob.semanticHash, resultContentHash: evaluation.resultContentHash }
    if (url.pathname.endsWith('chart-manifest')) return await reply(route, { meta: fixture.meta, data: { ...fixture.manifest, manifestContentHash: control.manifestHash, binding, sourcePolicy: fixture.sourcePolicy, segmentBounds: bounds,
      series: [{ seriesId: 'contract-1m', priceKind: 'contract', nativeResolution: '1m', supportedResolutions: ['1m', '15m'], availableRange }] } })
    if (url.pathname.endsWith('chart-window')) {
      const requestedRange = { fromInclusive: url.searchParams.get('fromInclusive')!, toExclusive: url.searchParams.get('toExclusive')! }
      const first = Date.parse(requestedRange.fromInclusive), resolution = url.searchParams.get('resolution')!, step = resolution === '1m' ? 60_000 : 900_000
      // Bounded synthetic display fixture, original prices and source policy.
      const bars = fixture.window.bars.map((bar, i) => ({ ...bar, openTime: utc(first + i * 2 * step), closeTime: utc(first + (i * 2 + 1) * step), availableAt: utc(first + (i * 2 + 1) * step), sourceEventCount: step / 60_000 }))
      return await reply(route, { meta: fixture.meta, data: { ...fixture.window, binding, sourcePolicy: fixture.sourcePolicy, resolution, seriesId: 'contract-1m', priceKind: 'contract', nativeResolution: '1m', aggregationPolicy: resolution === '1m' ? 'NATIVE_CONFIRMED' : 'UTC_EPOCH_COMPLETE_OHLCV', requestedRange, bars,
        coverage: { status: 'PARTIAL', coveredRanges: bars.map(bar => ({ fromInclusive: bar.openTime, toExclusive: bar.closeTime })), missingRanges: [{ fromInclusive: bars[0].closeTime, toExclusive: bars[1].openTime }, { fromInclusive: bars[1].closeTime, toExclusive: requestedRange.toExclusive }] } } })
    }
    if (url.pathname.endsWith('chronological-fill-markers')) {
      const nextCursor = 'synthetic_chronological_page_000002'
      const cursor = url.searchParams.get('cursor')
      if (options.paginatedReplayFills) expect([null, nextCursor]).toContain(cursor)
      else expect(cursor).toBeNull()
      expect(url.searchParams.get('manifestContentHash')).toBe(control.manifestHash)
      expect(url.searchParams.get('limit')).toBe('100')
      const trade = trades.data.trades[0], start = Date.parse(bounds.fromInclusive)
      const common = { tradeEntryFillRef: trade.entryFillRef, tradeExitFillRef: trade.exitFillRef, executionPriceSourceRef: 'evt_candle_fixture_0001' }
      // Synthetic wire evidence, not actual HTTP producer/custody evidence.
      // Ordinals are explicit; the SDK computes/checks the canonical page hash.
      const data: ChronologicalFillPage = { binding, sourcePolicy: fixture.sourcePolicy, manifestContentHash: control.manifestHash,
        tradeManifestContentHash: trades.data.tradeManifestContentHash, limit: 100, offset: 0, totalCount: 2, eof: true, pageContentHash: '', markers: [
          { ...common, fillRef: trade.entryFillRef, leg: 'ENTRY', side: 'BUY', occurredAt: utc(start), price: trade.entryPrice, fillContentHash: '8'.repeat(64), sourceOrdinal: 0 },
          { ...common, fillRef: trade.exitFillRef, leg: 'EXIT', side: 'SELL', occurredAt: utc(start + 120000), price: trade.exitPrice, fillContentHash: 'a'.repeat(64), sourceOrdinal: 1 },
        ] }
      if (options.paginatedReplayFills) {
        // Opt-in synthetic 100+2 page journey. All timestamps intentionally tie;
        // the supplied sourceOrdinal, not string ID order, preserves executions.
        // This verifies SDK/UI paging, not the real producer's trade provenance.
        data.offset = cursor === nextCursor ? 100 : 0
        data.totalCount = 102; data.eof = data.offset === 100
        if (!data.eof) data.nextCursor = nextCursor
        data.markers = Array.from({ length: data.eof ? 2 : 100 }, (_, index) => {
          const ordinal = data.offset + index, pair = String(Math.floor(ordinal / 2)).padStart(8, '0')
          const entry = `evt_synthetic_entry_${pair}`, exit = `evt_synthetic_exit_${pair}`
          return { tradeEntryFillRef: entry, tradeExitFillRef: exit, executionPriceSourceRef: 'evt_candle_fixture_0001',
            fillRef: ordinal % 2 ? exit : entry, leg: ordinal % 2 ? 'EXIT' : 'ENTRY', side: ordinal % 2 ? 'SELL' : 'BUY',
            occurredAt: utc(start), price: ordinal % 2 ? trade.exitPrice : trade.entryPrice,
            fillContentHash: (ordinal % 2 ? 'a' : '8').repeat(64), sourceOrdinal: ordinal }
        })
      }
      data.pageContentHash = await chronologicalFillPageContentHash(data)
      const meta = fixture.meta as { requestId: string; traceId: string }
      const response: ChronologicalFillPageEnvelope = { meta: { requestId: meta.requestId, traceId: meta.traceId, apiContractVersion: '0.11.0', resourceRevision: null }, data }
      return await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store', etag: `"${data.pageContentHash}"` },
        body: JSON.stringify(response) })
    }
    if (url.pathname.endsWith('/fill-markers')) {
      const trade = trades.data.trades[0], start = Date.parse(bounds.fromInclusive)
      const common = { tradeEntryFillRef: trade.entryFillRef, tradeExitFillRef: trade.exitFillRef, executionPriceSourceRef: 'evt_candle_fixture_0001' }
      const data: NativeFillMarkers = { binding, sourcePolicy: fixture.sourcePolicy, manifestContentHash: control.manifestHash, tradeManifestContentHash: trades.data.tradeManifestContentHash, limit: 100, pageContentHash: '9'.repeat(64), markers: [
        { ...common, fillRef: trade.entryFillRef, leg: 'ENTRY', side: 'BUY', occurredAt: utc(start), price: trade.entryPrice, fillContentHash: '8'.repeat(64) },
        { ...common, fillRef: trade.exitFillRef, leg: 'EXIT', side: 'SELL', occurredAt: utc(start + 120000), price: trade.exitPrice, fillContentHash: 'a'.repeat(64) },
      ] }
      return await reply(route, { meta: fixture.meta, data })
    }
    return await route.abort()
    } finally { control.settled.push(url) }
  })
  await page.route('**/auto-result-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root" style="height:100dvh"></div></body></html>' }))
  await page.goto('/auto-result-test.html')
  await page.evaluate(async ({ job, mountOnDelivery, replayReader, factoryDisposed }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const shellPath = '/src/internal-poc/ClientServiceExperience.tsx'
    const source = await (await fetch(shellPath)).text(), reactPath = source.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing shared React instance')
    const domPath = '/@id/react-dom/client', apiPath = '/src/internal-poc/native-service-api.ts', resultPath = '/src/internal-poc/NativeServiceResult.tsx'
    const reactModule = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath)
    const React = reactModule.default ?? reactModule
    const { ClientServiceExperience } = await import(/* @vite-ignore */ shellPath)
    const { createNativeServiceApi } = await import(/* @vite-ignore */ apiPath), { NativeServiceResult } = await import(/* @vite-ignore */ resultPath)
    // Hold the real preference setter in the host before any virtual clock
    // advances. Locale assertions need not await a dev-module import while
    // the renderer's clock is paused.
    const preferencePath = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ preferencePath)
    Reflect.set(window, 'setAutomaticResultLanguage', (value: string) => setClientPreference('language', value))
    const api = createNativeServiceApi(), h = React.createElement, audit = { consumed: 0, markers: 0, readerCreated: 0, readerDisposed: 0, readerMarkers: 0, readerChronologicalMarkers: 0, readerWindows: 0, readerBindingFailures: 0, scopeInvalidated: 0, statuses: [] as { state: string; reportReady: boolean }[] }
    const observeStatus = (status: { state: string; reportReady: boolean }) => { audit.statuses.push(status) }
    const original = api.markers
    api.markers = async (...args: Parameters<typeof original>) => { audit.markers++; return original(...args) }
    let owner = 'synthetic-auto-owner', live = true
    const scopePath = '/src/internal-poc/native-replay-reader-scope.ts'
    const readerScope = replayReader ? (await import(/* @vite-ignore */ scopePath)).createNativeReplayReaderScope() : undefined
    // Stable callback: each explicit creation captures its owner, never a render
    // counter. The default host continues to exercise api.markers unchanged.
    const createReplayReader = readerScope ? (request: { job: NativeJob; report: NativeReport; trades: NativeTrades; segment: 'IS' | 'OOS'; expectedManifestContentHash: string }) => {
      if (factoryDisposed) throw new Error('NATIVE_REPLAY_DISPOSED')
      const captured = owner
      const reader = readerScope.create(request, () => live && owner === captured)
      audit.readerCreated++
      let disposed = false
      return {
        isActive: () => reader.isActive(),
        retirementSignal: reader.retirementSignal,
        readWindow: async (...args: Parameters<typeof reader.readWindow>) => {
          audit.readerWindows++
          try { return await reader.readWindow(...args) }
          catch (failure) { if (failure instanceof Error && failure.message === 'NATIVE_RESULT_BINDING_CONFLICT') audit.readerBindingFailures++; throw failure }
        },
        readChronologicalMarkers: async () => {
          audit.readerChronologicalMarkers++
          try { return await reader.readChronologicalMarkers() }
          catch (failure) { if (failure instanceof Error && failure.message === 'NATIVE_RESULT_BINDING_CONFLICT') audit.readerBindingFailures++; throw failure }
        },
        readMarkers: async (cursor?: string) => {
          audit.readerMarkers++
          try { return await reader.readMarkers(cursor) }
          catch (failure) { if (failure instanceof Error && failure.message === 'NATIVE_RESULT_BINDING_CONFLICT') audit.readerBindingFailures++; throw failure }
        },
        dispose: () => { if (!disposed) { disposed = true; audit.readerDisposed++; reader.dispose() } },
      }
    } : undefined
    // Stable replacement identities exercise consumer lifetime changes without
    // changing SDK behavior or introducing a network bypass.
    const replacementApi = { ...api }
    const replacementFactory = createReplayReader ? (...args: Parameters<typeof createReplayReader>) => createReplayReader(...args) : undefined
    const invalidateReaderScope = () => { if (readerScope) { audit.scopeInvalidated++; readerScope.invalidate() } }
    Reflect.set(window, 'invalidateAutomaticReaderScope', invalidateReaderScope)
    function Host() {
      const [automaticPresentation, setRequest] = React.useState(undefined)
      const [resultMounted, setResultMounted] = React.useState(!mountOnDelivery)
      const [scope, setScope] = React.useState(owner)
      const [blocked, setBlocked] = React.useState(false)
      const [input, setInput] = React.useState('자동 재생 뒤에도 보존할 질문')
      const [alternateApi, setAlternateApi] = React.useState(false)
      const [alternateFactory, setAlternateFactory] = React.useState(false)
      Reflect.set(window, 'replaceAutomaticResultApi', setAlternateApi)
      Reflect.set(window, 'replaceAutomaticResultFactory', setAlternateFactory)
      Reflect.set(window, 'deliverAutomaticResult', () => {
        const captured = owner; let consumed = false
        setResultMounted(true)
        setRequest({ backtestId: job.backtestId, consume: () => { if (consumed) return false; consumed = true; audit.consumed++; return live && owner === captured }, isCurrent: () => live && owner === captured })
      })
      Reflect.set(window, 'blockAutomaticResult', setBlocked)
      Reflect.set(window, 'replaceAutomaticOwner', () => { invalidateReaderScope(); owner = 'synthetic-auto-owner-replaced'; setScope(owner) })
      return h(ClientServiceExperience, { accountScope: scope, nativeAccounts: true, analysisPresentationBlocked: blocked,
        strategyDocument: { identity: `${scope}:draft`, content: h('p', null, '합성 계약 표시 검수') },
        analysisIdentity: job.backtestId,
        state: { phase: 'ready', sessionState: 'AUTHENTICATED', messages: [{ id: 'question', role: 'user', text: '체결 결과를 보여주세요.' }], input, inputDisabled: false, busy: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null, onInput: setInput, onSend: async () => {}, onReset: async () => true },
        analysis: resultMounted ? h(NativeServiceResult, { api: alternateApi ? replacementApi : api, job, embedded: true, automaticPresentation, onStatusChange: observeStatus, ...(createReplayReader ? { createReplayReader: alternateFactory ? replacementFactory : createReplayReader } : {}) }) : undefined,
      })
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('root'))
    Reflect.set(window, 'automaticResultAudit', audit)
    Reflect.set(window, 'retireAutomaticResult', () => { live = false; invalidateReaderScope(); root.unmount() })
    root.render(h(React.StrictMode, null, h(Host)))
  }, { job: displayJob, mountOnDelivery: options.mountOnDelivery ?? false, replayReader: options.replayReader ?? false, factoryDisposed: options.factoryDisposed ?? false })
  await expect(page.locator('.client-service-app')).toHaveCount(1)
  await expect(page.locator('.native-service-result')).toHaveCount(options.mountOnDelivery ? 0 : 1)
  return control
}
