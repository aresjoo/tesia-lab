// Browser-only renderer fixture. No SDK, server result, or whole-period clock.
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { StrictMode, createRef, useLayoutEffect, useRef } from 'react'
import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts'
import { ClientProfessionalPriceChart, type ProfessionalChartControl, type ProfessionalReplayEnd } from '../../src/components/ClientProfessionalPriceChart'
import type { PriceChartView } from '../../src/chart/price-chart-view'
import type { ProfessionalExternalReplay } from '../../src/chart/price-replay-frame'
import { setClientPreference, type ClientLanguage } from '../../src/client-preferences'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-kr'
import '../../src/client-restored-research.css'

export function mount(initialView: PriceChartView, initialKey?: string, options: { autoReplay?: boolean; failInitial?: boolean; variant?: 'analysis' | 'market'; externalReplay?: ProfessionalExternalReplay; strict?: boolean } = {}) {
  const app = document.getElementById('root')!
  app.hidden = true
  const host = document.createElement('main')
  host.className = 'client-restored-research'
  host.style.cssText = 'position:absolute;inset:0 0 auto;min-height:100vh;z-index:9999;overflow:auto'
  document.body.append(host)
  const charts: IChartApi[] = []
  const removed: number[] = []
  const markers: { markers(): readonly { time: unknown; text?: string }[] }[] = []
  const moves = new Map<IChartApi, (event: MouseEventParams<Time>) => void>()
  const selected: string[] = []
  const replayEvents: { playing: boolean; reason?: ProfessionalReplayEnd }[] = []
  const control = createRef<ProfessionalChartControl>()
  const replayChanged = (playing: boolean, reason?: ProfessionalReplayEnd) => replayEvents.push({ playing, reason })
  let failure: { chartIndex: number; time: number; clearToo: boolean; primaryThrown: boolean; clearThrown: boolean } | null = options.failInitial
    ? { chartIndex: 0, time: initialView.bars[0].time, clearToo: false, primaryThrown: false, clearThrown: false } : null
  const injectedFailures: string[] = []
  let updateFailure: number | null = null
  const layoutCommits: { identity: string; times: unknown[]; source: string; quotes: string[] }[] = []
  const setDataInputs = new WeakMap<object, readonly unknown[]>()
  // Semantic identity is recorded at construction, before responsive pane
  // labels are suppressed. Never infer the study from its rendered title.
  const seriesTitles = new WeakMap<object, string>()
  const probe = {
    charts, removed, markers, setDataInputs, seriesTitles, injectedFailures, activeTimers: new Set<number>(),
    register(chart: IChartApi) {
      const index = charts.push(chart) - 1
      const remove = chart.remove.bind(chart)
      chart.remove = () => { removed.push(index); remove() }
      const subscribe = chart.subscribeCrosshairMove.bind(chart)
      chart.subscribeCrosshairMove = handler => { moves.set(chart, handler); subscribe(handler) }
      const addSeries = chart.addSeries.bind(chart)
      chart.addSeries = ((...args: Parameters<IChartApi['addSeries']>) => {
        const item = addSeries(...args)
        const update = item.update.bind(item)
        item.update = (...values) => {
          if (item.seriesType() === 'Candlestick' && updateFailure !== null && values[0].time === updateFailure) {
            updateFailure = null; injectedFailures.push('frame-update')
            throw new Error('TEST_ONLY_FRAME_UPDATE_FAILURE')
          }
          update(...values)
        }
        seriesTitles.set(item, item.options().title)
        const setData = item.setData.bind(item)
        item.setData = data => {
          // A deterministic renderer API fault, never an SDK/network failure.
          // Only this chart's candlestick API is affected; retry instances work.
          if (failure?.chartIndex === index && item.seriesType() === 'Candlestick') {
            if (!failure.primaryThrown && data[0]?.time === failure.time) {
              failure.primaryThrown = true
              injectedFailures.push('window-setData')
              throw new Error('TEST_ONLY_WINDOW_SET_DATA_FAILURE')
            }
            if (failure.primaryThrown && failure.clearToo && !failure.clearThrown && data.length === 0) {
              failure.clearThrown = true
              injectedFailures.push('cleanup-setData')
              throw new Error('TEST_ONLY_CLEAR_SET_DATA_FAILURE')
            }
          }
          setDataInputs.set(item, structuredClone(data)); setData(data)
        }
        return item
      }) as IChartApi['addSeries']
    },
  }
  Reflect.set(window, '__continuityProbe', probe)
  const root = createRoot(host)
  function RendererBoundary({ view, continuityKey, externalReplay }: { view: PriceChartView; continuityKey?: string; externalReplay?: ProfessionalExternalReplay }) {
    const mounted = useRef(false)
    useLayoutEffect(() => {
      // Parent layout effects run after descendant layout effects, before paint.
      // Skip initial mount, whose runtime is intentionally created passively.
      if (!mounted.current) { mounted.current = true; return }
      const chart = charts.at(-1)
      if (!chart || removed.includes(charts.length - 1)) return
      const candles = chart.panes().flatMap(pane => pane.getSeries()).find(item => item.seriesType() === 'Candlestick')
      layoutCommits.push({ identity: view.identity, times: candles?.data().map(row => row.time) ?? [], source: host.querySelector('.cp-source')?.textContent ?? '', quotes: [...host.querySelectorAll('.cp-quote dd')].map(node => node.textContent ?? '') })
    }, [view])
    return <ClientProfessionalPriceChart view={view} continuityKey={continuityKey} variant={options.variant} externalReplay={externalReplay} autoReplay={options.autoReplay} onFillSelect={fill => selected.push(fill.id)} controlRef={control} onReplayChange={replayChanged} />
  }
  let current = initialView
  let key = initialKey
  const render = (view: PriceChartView, continuityKey = key) => {
    current = view
    key = continuityKey
    const renderer = <RendererBoundary view={view} continuityKey={continuityKey} externalReplay={options.externalReplay} />
    flushSync(() => root.render(options.strict ? <StrictMode>{renderer}</StrictMode> : renderer))
  }
  render(initialView, initialKey)
  const pointer = (index: number) => {
    host.querySelector('.cp-surface')!.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', movementX: 2, movementY: 1 }))
    moves.get(charts.at(-1)!)?.({ time: current.bars[index].time } as MouseEventParams<Time>)
  }
  return {
    render, selected, pointer, replayEvents, layoutCommits,
    frame(view: PriceChartView, externalReplay?: ProfessionalExternalReplay) { options.externalReplay = externalReplay; render(view) },
    failNextFrame(time: number) { updateFailure = time },
    failNextMount(time: number) {
      failure = { chartIndex: charts.length, time, clearToo: false, primaryThrown: false, clearThrown: false }
    },
    failNextWindow(time: number, clearToo = false) {
      failure = { chartIndex: charts.length - 1, time, clearToo, primaryThrown: false, clearThrown: false }
    },
    play() { return control.current?.play() ?? false },
    skip() { control.current?.skip() },
    variant(value: 'analysis' | 'market') { options.variant = value; render(current) },
    selectFill(id: string) { control.current?.selectFill(id) },
    language(value: ClientLanguage) { flushSync(() => setClientPreference('language', value)) },
    queuePointerThenReplace(view: PriceChartView) {
      pointer(0)
      render(view)
    },
    unmount() { root.unmount(); host.remove(); app.hidden = false },
  }
}
