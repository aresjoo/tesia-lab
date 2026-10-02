import { expect, test } from '@playwright/test'
import { resultHost } from './helpers/native-result-presentation-host'

// Scope-only retirement of the actual React/SDK consumer over synthetic HTTP.
// Props and the outer host remain mounted. This is not evidence of an actual
// App account-switch leak or of a genuine backend/source-data producer.
test('모든 가격창·체결 EOF 준비 뒤 scope만 폐기해도 추가 GET 없이 재생과 ticker를 종료한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  const control = await resultHost(page, { replayReader: true, boundedReplayPrices: true })
  const result = page.locator('.native-service-result')
  await expect(result.getByRole('button', { name: '차트로 결과 보기', exact: true, includeHidden: true })).toHaveAttribute('aria-disabled', 'false')
  const originalResult = await result.elementHandle()
  const canvas = await page.locator('.cp-chart canvas').first().elementHandle()
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
  await page.evaluate(() => {
    const intervals = new Set<number>()
    const schedule = window.setInterval.bind(window), cancel = window.clearInterval.bind(window)
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const id = schedule(handler, timeout, ...args)
      if (timeout === 80) intervals.add(id)
      return id
    }) as typeof window.setInterval
    window.clearInterval = (id?: number) => { if (id !== undefined) intervals.delete(id); cancel(id) }
    Reflect.set(window, 'periodRetirementActiveTickers', () => intervals.size)
    Reflect.get(window, 'deliverAutomaticResult')()
  })
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith('/chronological-fill-markers')).length).toBe(1)
  await expect.poll(() => control.settled.filter(url => url.pathname.endsWith('/chart-window')).length).toBe(3)
  // One initial manual chart read and the replay's two price windows have
  // settled; its single chronological response has eof:true in the helper.
  await expect.poll(() => page.evaluate(() => {
    const audit = Reflect.get(window, 'automaticResultAudit')
    return { windows: audit.readerWindows, fills: audit.readerChronologicalMarkers, disposed: audit.readerDisposed }
  })).toEqual({ windows: 2, fills: 1, disposed: 0 })
  await page.clock.runFor(80)
  await expect(page.locator('.cp-replay progress')).toBeAttached()
  await page.clock.runFor(5_000)
  const windows = control.requests.filter(url => url.pathname.endsWith('/chart-window'))
  expect(new Set(windows.map(url => url.searchParams.get('fromInclusive'))).size).toBe(2)
  const finalStart = windows.at(-1)!.searchParams.get('fromInclusive')!
  await expect(result).toContainText(finalStart)
  const progress = await page.locator('.cp-replay progress').evaluate(node => (node as HTMLProgressElement).value)
  expect(progress).toBeGreaterThan(0)
  expect(progress).toBeLessThan(1)
  expect(await page.evaluate(() => Reflect.get(window, 'periodRetirementActiveTickers')())).toBe(1)
  const readCount = control.requests.length
  // Deliberately no owner prop change, React remount, or replacement factory.
  // This aborts only the real app-owned reader scope's existing generation.
  await page.evaluate(() => Reflect.get(window, 'invalidateAutomaticReaderScope')())
  await page.clock.runFor(240)
  expect(control.requests).toHaveLength(readCount)
  expect(await result.evaluate((node, old) => node === old, originalResult)).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'automaticResultAudit').scopeInvalidated)).toBe(1)
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.locator('.cp-replay progress')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'periodRetirementActiveTickers')())).toBe(0)
  expect(await page.evaluate(() => Reflect.get(window, 'automaticResultAudit').readerDisposed)).toBe(1)
  expect(await page.locator('.cp-chart canvas').first().evaluate((node, old) => node === old, canvas)).toBe(true)
  await page.clock.runFor(5_000)
  expect(control.requests).toHaveLength(readCount)
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  expect(control.errors).toEqual([])
})
