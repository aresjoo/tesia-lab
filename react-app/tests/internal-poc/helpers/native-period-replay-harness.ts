import fixtures from '../fixtures/native-service-contracts.json' with { type: 'json' }
import { createNativePeriodReplayController, type NativeReplayFillFrame } from '../../../src/internal-poc/native-period-replay-controller'
import type { NativeChartManifest, NativeChartWindow, NativeChartWindowSelection } from '../../../src/internal-poc/native-service-api'
import type { NativeReplayChartReader } from '../../../src/internal-poc/native-replay-chart-reader'

// Explicit synthetic source adapters: controller/renderer coordination evidence,
// not actual 730-day source custody, a v0.11 reader, or NativeResult integration.
const source = fixtures.sources[0].fixture as unknown as {
  binding: NativeChartManifest['binding']; sourcePolicy: NativeChartManifest['sourcePolicy']
  manifest: Omit<NativeChartManifest, 'binding' | 'sourcePolicy'>
  window: Omit<NativeChartWindow, 'binding' | 'sourcePolicy'>
}
export const base = Date.parse('2024-01-01T00:00:00Z') / 1000
export const utc = (time: number) => new Date(time * 1000).toISOString().replace('.000Z', 'Z')
export const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const deferred = () => {
  let resolve = () => {}
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}
export function harness(minutes = 4_000) {
  const end = base + minutes * 60
  const availableRange = { fromInclusive: utc(base), toExclusive: utc(end) }
  const owner = new AbortController()
  let current = true, fail: string | null = null, active = 0, maxActive = 0, disposals = 0
  const calls: string[] = []
  let held: { at: string; gate: ReturnType<typeof deferred> } | null = null
  const reader: Pick<NativeReplayChartReader, 'readWindow' | 'dispose'> = {
    async readWindow(selection: NativeChartWindowSelection = {}) {
      const start = selection.fromInclusive!, from = Date.parse(start) / 1000, to = Math.min(end, from + 60_000)
      calls.push(start); active++; maxActive = Math.max(maxActive, active)
      try {
        if (held?.at === start) await held.gate.promise
        if (fail === start) { fail = null; throw new Error('PRIVATE_READ_FAILURE') }
        const manifest = { ...structuredClone(source.manifest), binding: structuredClone(source.binding), sourcePolicy: structuredClone(source.sourcePolicy) }
        const window = { ...structuredClone(source.window), binding: manifest.binding, sourcePolicy: manifest.sourcePolicy,
          seriesId: 'contract-1m' as const, resolution: '1m' as const, manifestContentHash: manifest.manifestContentHash,
          requestedRange: { fromInclusive: start, toExclusive: utc(to) }, windowContentHash: String(from).padStart(64, '0') }
        return { manifest, window, view: { identity: window.windowContentHash, market: 'BTC / USDT', resolutionSeconds: 60, pricePrecision: 2,
          sourceLabel: 'SYNTHETIC_CONTROLLER_TEST', fills: [], bars: [{ time: from, open: 100, high: 110, low: 90, close: 105, volume: 1 }] },
        navigation: { availableRange, supportedResolutions: ['1m'], previousFromInclusive: from === base ? null : utc(from - 60_000),
          nextFromInclusive: to === end ? null : utc(to) } }
      } finally { active-- }
    },
    dispose() { disposals++ },
  }
  const controller = createNativePeriodReplayController({ reader, ownerSignal: owner.signal, isCurrent: () => current, attemptId: 'period-test',
    identity: { seriesId: 'contract-1m', resolution: '1m', expectedManifestContentHash: source.manifest.manifestContentHash, availableRange } })
  const empty: NativeReplayFillFrame = { through: end, eof: true, markers: [] }
  return { controller, owner, end, calls, empty,
    retire: () => { current = false }, audit: () => ({ active, maxActive, disposals }),
    failAt: (time: number) => { fail = utc(time) },
    hold: (time: number) => { const gate = deferred(); held = { at: utc(time), gate }; return gate },
  }
}
