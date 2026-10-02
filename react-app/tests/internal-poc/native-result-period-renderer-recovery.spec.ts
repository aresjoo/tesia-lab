import { installCompiledModuleResponse } from '../fixtures/compiled-module-response'
import { expect, test, type Page } from '@playwright/test'
import { resultHost } from './helpers/native-result-presentation-host'

// Actual NativeServiceResult + actual LWC series APIs over SDK-valid synthetic
// HTTP fixtures. The only fault is one scoped candlestick setData exception.
// This does not establish genuine producer/source custody or service release.
async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await page.addInitScript(() => {
    const probe = { armed: false, allowEmpty: false, failures: 0, charts: 0, removed: 0,
      frame: null as { progress: number; state: string } | null, failedFrame: null as { progress: number; state: string } | null,
      register(chart: { addSeries: (...args: unknown[]) => { seriesType(): string; setData(data: unknown[]): void }; remove(): void }) {
        probe.charts++
        const remove = chart.remove.bind(chart)
        chart.remove = () => { probe.removed++; remove() }
        const add = chart.addSeries.bind(chart)
        chart.addSeries = (...args) => {
          const series = add(...args), setData = series.setData.bind(series)
          series.setData = data => {
            if (probe.armed && series.seriesType() === 'Candlestick' && (probe.allowEmpty || data.length > 0)) {
              probe.armed = false; probe.failures++
              probe.failedFrame = probe.frame && { ...probe.frame }
              throw Error('TEST_ONLY_NATIVE_PERIOD_SET_DATA_FAILURE')
            }
            setData(data)
          }
          return series
        }
      },
    }
    Reflect.set(window, 'periodRendererProbe', probe)
  })
  await installCompiledModuleResponse(page, "/src/components/ClientProfessionalPriceChart.tsx", original => {
    const body = original;
    expect(body).toContain('api.current = chart;')
    expect(body).toContain('updateExternalReplay.current = () => {')
    return body.replace('api.current = chart;',
      'api.current = chart; window.periodRendererProbe.register(chart);')
      .replace('updateExternalReplay.current = () => {',
        'updateExternalReplay.current = () => { window.periodRendererProbe.frame = runtimeInput.current.externalReplay?.frame ?? null;')
    }, ["updateExternalReplay.current = () => {","api.current = chart;"])
  const control = await resultHost(page, { replayReader: true, boundedReplayPrices: true })
  await expect(page.locator('.native-service-result').getByRole('button', { name: '차트로 결과 보기', exact: true, includeHidden: true })).toHaveAttribute('aria-disabled', 'false')
  const composer = await page.locator('.g-composer textarea').elementHandle()
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
  await page.evaluate(() => {
    const intervals = new Set<number>(), schedule = window.setInterval.bind(window), cancel = window.clearInterval.bind(window)
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const id = schedule(handler, timeout, ...args)
      if (timeout === 80) intervals.add(id)
      return id
    }) as typeof window.setInterval
    window.clearInterval = (id?: number) => { if (id !== undefined) intervals.delete(id); cancel(id) }
    Reflect.set(window, 'periodRendererActiveTickers', () => intervals.size)
    Reflect.get(window, 'deliverAutomaticResult')()
  })
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith('/chronological-fill-markers')).length).toBe(1)
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith('/chart-window')).length).toBe(3)
  await page.clock.runFor(80)
  await expect(page.locator('.cp-execution b')).toHaveText('BUY')
  return { control, composer }
}

async function arm(page: Page, allowEmpty = false) {
  await page.evaluate(value => {
    const probe = Reflect.get(window, 'periodRendererProbe')
    probe.armed = true; probe.allowEmpty = value
  }, allowEmpty)
}

async function waitForFault(page: Page, chunks: number) {
  for (let index = 0; index < chunks; index++) {
    if (await page.evaluate(() => Reflect.get(window, 'periodRendererProbe').failures > 0)) break
    await page.clock.runFor(1_000)
  }
  expect(await page.evaluate(() => Reflect.get(window, 'periodRendererProbe').failures)).toBe(1)
  await expect(page.locator('dialog[open]')).toHaveCount(1)
  await expect(page.locator('.cp-failure button')).toBeVisible()
  await expect(page.locator('.cp-surface canvas')).toHaveCount(0)
}

test('complete 마지막 setData 복원 실패는 모달·retry를 보존하고 재시도 후에만 종료한다', async ({ page }) => {
  const { control, composer } = await ready(page)
  await page.clock.runFor(5_000)
  const progress = await page.locator('.cp-replay progress').evaluate(node => (node as HTMLProgressElement).value)
  expect(progress).toBeGreaterThan(0); expect(progress).toBeLessThan(1)
  const finalStart = control.requests.filter(url => url.pathname.endsWith('/chart-window')).at(-1)!.searchParams.get('fromInclusive')!
  await expect(page.locator('.native-service-result')).toContainText(finalStart)
  const reads = control.requests.length
  const runtime = await page.evaluate(() => {
    const probe = Reflect.get(window, 'periodRendererProbe')
    return { charts: probe.charts, removed: probe.removed }
  })
  // Both windows and EOF fills are already loaded and the final price window
  // is displayed. Its next nonempty setData is complete's full restoration.
  await arm(page); await waitForFault(page, 75)
  const fault = await page.evaluate(() => Reflect.get(window, 'periodRendererProbe').failedFrame)
  expect(fault).toMatchObject({ state: 'complete', progress: 1 })
  expect(control.requests).toHaveLength(reads)
  expect(await page.evaluate(() => Reflect.get(window, 'automaticResultAudit').readerDisposed)).toBe(0)
  await page.clock.runFor(5_000)
  await expect(page.locator('dialog[open]')).toHaveCount(1)
  await expect(page.locator('.cp-failure button')).toBeVisible()
  await page.locator('.cp-failure button').click()
  await page.clock.runFor(160)
  await expect(page.locator('.cp-failure')).toHaveCount(0)
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.locator('.cp-replay progress')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'periodRendererActiveTickers')())).toBe(0)
  expect(await page.evaluate(() => Reflect.get(window, 'automaticResultAudit').readerDisposed)).toBe(1)
  const after = await page.evaluate(() => {
    const probe = Reflect.get(window, 'periodRendererProbe')
    return { charts: probe.charts, removed: probe.removed, failures: probe.failures }
  })
  expect(after).toEqual({ charts: runtime.charts + 1, removed: runtime.removed + 1, failures: 1 })
  expect(await page.locator('.g-composer textarea').evaluate((node, old) => node === old, composer)).toBe(true)
  await expect(page.locator('.g-composer textarea')).toHaveValue('자동 재생 뒤에도 보존할 질문')
  expect(control.requests).toHaveLength(reads)
  expect(control.errors).toEqual([])
})

test('complete 복원 실패 뒤 ticker 없이도 scope 폐기는 즉시 전체창을 닫고 대화를 보존한다', async ({ page }) => {
  const { control, composer } = await ready(page)
  await page.clock.runFor(5_000)
  await arm(page); await waitForFault(page, 75)
  expect(await page.evaluate(() => Reflect.get(window, 'periodRendererProbe').failedFrame)).toMatchObject({ state: 'complete', progress: 1 })
  expect(await page.evaluate(() => Reflect.get(window, 'periodRendererActiveTickers')())).toBe(0)
  const reads = control.requests.length
  // No replacement props, no clock advance and no GET: owner retirement is
  // independent of a completed renderer's stopped animation clock.
  await page.evaluate(() => Reflect.get(window, 'invalidateAutomaticReaderScope')())
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'automaticResultAudit').readerDisposed)).toBe(1)
  expect(await page.evaluate(() => Reflect.get(window, 'periodRendererActiveTickers')())).toBe(0)
  expect(await page.locator('.g-composer textarea').evaluate((node, old) => node === old, composer)).toBe(true)
  await expect(page.locator('.g-composer textarea')).toHaveValue('자동 재생 뒤에도 보존할 질문')
  await page.clock.runFor(5_000)
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  expect(control.requests).toHaveLength(reads)
  expect(control.errors).toEqual([])
})

test('진행 중 가격창 setData 실패는 시계를 동결하고 renderer retry 후 같은 attempt를 재개한다', async ({ page }) => {
  const { control, composer } = await ready(page)
  await arm(page, true); await waitForFault(page, 10)
  const before = await page.evaluate(() => ({ progress: Reflect.get(window, 'periodRendererProbe').failedFrame?.progress,
    audit: { ...Reflect.get(window, 'automaticResultAudit') } }))
  expect(before.progress).toBeLessThan(.1)
  const reads = control.requests.length
  await page.clock.runFor(20_000)
  await expect(page.locator('.cp-failure button')).toBeVisible()
  expect(control.requests).toHaveLength(reads)
  expect(await page.evaluate(() => Reflect.get(window, 'automaticResultAudit').readerDisposed)).toBe(0)
  await page.locator('.cp-failure button').click()
  await page.clock.runFor(80)
  await expect(page.locator('.cp-failure')).toHaveCount(0)
  await expect(page.locator('.cp-replay progress')).toBeVisible()
  await expect(page.locator('dialog[open]')).toHaveCount(1)
  const resumed = await page.locator('.cp-replay progress').evaluate(node => (node as HTMLProgressElement).value)
  expect(resumed).toBeGreaterThanOrEqual(before.progress)
  expect(resumed - before.progress).toBeLessThan(.01)
  expect(await page.evaluate(() => Reflect.get(window, 'automaticResultAudit').readerCreated)).toBe(before.audit.readerCreated)
  expect(await page.evaluate(() => Reflect.get(window, 'periodRendererActiveTickers')())).toBe(1)
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'periodRendererActiveTickers')())).toBe(0)
  expect(await page.evaluate(() => Reflect.get(window, 'automaticResultAudit').readerDisposed)).toBe(1)
  expect(await page.locator('.g-composer textarea').evaluate((node, old) => node === old, composer)).toBe(true)
  await expect(page.locator('.g-composer textarea')).toHaveValue('자동 재생 뒤에도 보존할 질문')
  expect(control.requests).toHaveLength(reads)
  expect(control.errors).toEqual([])
})
