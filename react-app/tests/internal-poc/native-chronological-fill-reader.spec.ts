import { expect, test } from '@playwright/test'
import fixture from './fixtures/chronological-fill-v11.json' with { type: 'json' }
import type { NativeChartManifest, NativeTrades } from '../../src/internal-poc/native-service-api'

const sample = fixture.cases.find(item => item.id === 'first-complete')!.value

test.beforeEach(async ({ page }) => {
  await page.route('**/fill-reader-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><body>합성 시간순 페이지 결합 검사</body></html>' }))
  await page.goto('/fill-reader-test.html')
})

for (const scenario of ['chain', 'empty', 'retry', 'offset', 'total', 'order', 'same-time', 'tie', 'binding', 'trade-hash', 'policy', 'policy-order', 'before-start', 'entry-at-end', 'exit-at-end', 'capture', 'busy', 'owner', 'stale', 'disposed'] as const) {
  test(`시간순 reader ${scenario}: 원SDK·결속·사슬·폐기`, async ({ page }) => {
    const result = await page.evaluate(async ({ sample, scenario }) => {
      const modulePath = '/src/internal-poc/native-chronological-fill-reader.ts'
      const { createNativeChronologicalFillReader } = await import(/* @vite-ignore */ modulePath)
      const hashPath = '/src/internal-poc/contracts/generated/api-v0.11/validator.ts'
      const { chronologicalFillPageContentHash } = await import(/* @vite-ignore */ hashPath)
      const start = Date.parse(sample.data.markers[0].occurredAt)
      const utc = (second: number) => new Date(start + second * 1000).toISOString().replace('.000Z', 'Z')
      const manifest = { binding: structuredClone(sample.data.binding), manifestContentHash: sample.data.manifestContentHash,
        sourcePolicy: structuredClone(sample.data.sourcePolicy), segmentBounds: { fromInclusive: utc(0), toExclusive: utc(1000) } } as NativeChartManifest
      const trades = { binding: structuredClone(sample.data.binding), tradeManifestContentHash: sample.data.tradeManifestContentHash,
        strategyAuthorityMapping: { approvalStrategyVersionId: sample.data.binding.strategyVersionId } } as unknown as NativeTrades
      const owner = new AbortController(), originalFetch = window.fetch
      const requests: string[] = []
      let current = true, failOnce = scenario === 'retry', release = () => {}, entered = () => {}
      const held = new Promise<void>(resolve => { release = resolve })
      const started = new Promise<void>(resolve => { entered = resolve })
      window.fetch = async (input) => {
        const url = new URL(String(input)), cursor = url.searchParams.get('cursor')
        requests.push(cursor ?? 'FIRST')
        if (['busy', 'owner', 'stale'].includes(scenario)) { entered(); await held }
        if (cursor && failOnce) { failOnce = false; throw Error('synthetic network failure') }
        let offset = cursor ? Number(cursor.split('_')[1]) : 0
        if (cursor && scenario === 'offset') offset = 200
        const total = scenario === 'empty' ? 0 : scenario.endsWith('at-end') || scenario === 'before-start' ? 1 : cursor && scenario === 'total' ? 202 : 201
        const data = { ...structuredClone(sample.data), totalCount: total, offset, limit: 100,
          markers: Array.from({ length: Math.min(100, total - offset) }, (_, index) => {
            const ordinal = offset + index
            const ref = `evt_${String(ordinal).padStart(8, '0')}`
            const marker = { ...sample.data.markers[0], fillRef: ref, tradeEntryFillRef: ref,
              occurredAt: utc(['same-time', 'tie'].includes(scenario) ? 0 : scenario === 'order' && cursor ? index : ordinal), sourceOrdinal: ordinal }
            if (scenario === 'tie' && cursor) marker.sourceOrdinal = index
            if (scenario === 'before-start') marker.occurredAt = utc(-1)
            if (scenario.endsWith('at-end')) marker.occurredAt = utc(1000)
            if (scenario === 'exit-at-end') { marker.leg = 'EXIT'; marker.side = 'SELL'; marker.fillRef = marker.tradeExitFillRef }
            return marker
          }), eof: offset + Math.min(100, total - offset) === total,
        } as typeof sample.data & { nextCursor?: string }
        if (!data.eof) data.nextCursor = `cursor_${String(offset + 100).padStart(17, '0')}`
        if (cursor && scenario === 'binding') data.binding.runId = 'run_different_0001'
        if (cursor && scenario === 'trade-hash') data.tradeManifestContentHash = 'a'.repeat(64)
        if (cursor && scenario === 'policy') data.sourcePolicy.sourceProvenance.source = 'RECORDED_DEV_FIXTURE'
        if (scenario === 'policy-order') data.sourcePolicy = Object.fromEntries(Object.entries(data.sourcePolicy).reverse()) as typeof data.sourcePolicy
        data.pageContentHash = await chronologicalFillPageContentHash(data)
        const response = new Response(JSON.stringify({ meta: sample.meta, data }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', etag: `"${data.pageContentHash}"` } })
        Object.defineProperty(response, 'url', { value: url.href })
        return response
      }
      const reader = createNativeChronologicalFillReader({ manifest, trades, ownerSignal: owner.signal, isCurrent: () => current })
      const outcome = async (promise: Promise<unknown>) => { try { await promise; return 'OK' } catch (error) { return (error as Error).message } }
      try {
        if (scenario === 'capture') { manifest.binding.runId = 'mutated'; trades.tradeManifestContentHash = 'b'.repeat(64); manifest.segmentBounds.toExclusive = utc(1) }
        if (scenario === 'disposed') { reader.dispose(); return { error: await outcome(reader.readNext()), requests } }
        if (['busy', 'owner', 'stale'].includes(scenario)) {
          const pending = outcome(reader.readNext())
          await started
          const concurrent = await outcome(reader.readNext())
          if (scenario === 'owner') owner.abort()
          if (scenario === 'stale') current = false
          release()
          const first = await pending
          return { first, concurrent, requests }
        }
        const first = await reader.readNext()
        const pages = [first?.offset], frozen = Object.isFrozen(first) && Object.isFrozen(first.markers)
        if (['empty', 'exit-at-end'].includes(scenario)) return { pages, frozen, done: await reader.readNext(), requests }
        if (scenario === 'retry') {
          const failed = await outcome(reader.readNext())
          const second = await reader.readNext()
          return { failed, second: second.offset, requests }
        }
        if (['offset', 'total', 'order', 'tie', 'binding', 'trade-hash', 'policy'].includes(scenario)) {
          return { error: await outcome(reader.readNext()), again: await outcome(reader.readNext()), requests }
        }
        pages.push((await reader.readNext())?.offset, (await reader.readNext())?.offset)
        return { pages, frozen, done: await reader.readNext(), requests }
      } catch (error) { return { error: (error as Error).message, requests } }
      finally { release(); reader.dispose(); window.fetch = originalFetch }
    }, { sample, scenario })
    const cursor100 = 'cursor_00000000000000100', cursor200 = 'cursor_00000000000000200'
    if (['chain', 'same-time', 'policy-order', 'capture'].includes(scenario)) expect(result).toEqual({ pages: [0, 100, 200], frozen: true, done: null, requests: ['FIRST', cursor100, cursor200] })
    else if (['empty', 'exit-at-end'].includes(scenario)) expect(result).toEqual({ pages: [0], frozen: true, done: null, requests: ['FIRST'] })
    else if (scenario === 'retry') expect(result).toEqual({ failed: 'TRANSPORT_FAILED', second: 100, requests: ['FIRST', cursor100, cursor100] })
    else if (scenario === 'disposed') expect(result).toEqual({ error: 'NATIVE_REPLAY_DISPOSED', requests: [] })
    else if (['busy', 'owner', 'stale'].includes(scenario)) expect(result).toEqual({ first: scenario === 'busy' ? 'OK' : 'NATIVE_REPLAY_DISPOSED', concurrent: 'NATIVE_REPLAY_READ_BUSY', requests: ['FIRST'] })
    else if (['before-start', 'entry-at-end'].includes(scenario)) expect(result).toEqual({ error: 'NATIVE_RESULT_BINDING_CONFLICT', requests: ['FIRST'] })
    else expect(result).toEqual({ error: 'NATIVE_RESULT_BINDING_CONFLICT', again: 'NATIVE_RESULT_BINDING_CONFLICT', requests: ['FIRST', cursor100, cursor100] })
  })
}
