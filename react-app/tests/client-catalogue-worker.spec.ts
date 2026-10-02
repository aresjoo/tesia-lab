import { expect, test } from '@playwright/test'
import { createCataloguePreviewClient, type CatalogueWorkerReply, type CatalogueWorkerRequest, type CataloguePreviewResult } from '../src/client-catalogue-preview'
import spotGolden from './fixtures/catalogue-spot-golden.json' with { type: 'json' }
import futuresGolden from './fixtures/catalogue-futures-golden.json' with { type: 'json' }
import windowGolden from './fixtures/catalogue-window-golden.json' with { type: 'json' }

class FakeWorker {
  onmessage: ((event: MessageEvent<CatalogueWorkerReply>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  sent: CatalogueWorkerRequest[] = []
  terminated = false
  postMessage(message: CatalogueWorkerRequest) { this.sent.push(message) }
  terminate() { this.terminated = true }
  reply(value: CatalogueWorkerReply) { this.onmessage?.({ data: value } as MessageEvent<CatalogueWorkerReply>) }
}
const sample = { source: 'client-snapshot-preview', period: 'all', strategy: { id: 'r1' }, result: {}, calculation: 'full-run', contextPeriod: 'selected' } as CataloguePreviewResult

test('worker는 첫 요청에만 생성하고 한 요청 취소는 다른 요청을 중단하지 않는다', async () => {
  const worker = new FakeWorker(); let created = 0
  const client = createCataloguePreviewClient(() => { created++; return worker })
  expect(created).toBe(0)
  const control = new AbortController(), a = client.run('r1', 'all', control.signal), cancelled = expect(a).rejects.toHaveProperty('name', 'AbortError')
  const b = client.run('d1', 'all'); expect(created).toBe(1)
  control.abort(); await cancelled
  expect(worker.terminated).toBe(false); expect(worker.sent).toContainEqual({ kind: 'cancel', requestId: 1 })
  worker.reply({ kind: 'result', requestId: 1, value: sample })
  worker.reply({ kind: 'result', requestId: 2, value: { ...sample, strategy: { ...sample.strategy, id: 'd1' } } })
  expect((await b).strategy.id).toBe('d1')
  client.dispose(); expect(worker.terminated).toBe(true)
  await expect(client.run('r1', 'all')).rejects.toHaveProperty('name', 'AbortError')
})

test('이전 worker의 늦은 응답은 새 요청에 섞이지 않고 오류는 재시도 가능하다', async () => {
  const first = new FakeWorker(), second = new FakeWorker(); let created = 0
  const client = createCataloguePreviewClient(() => ++created === 1 ? first : second)
  const a = client.run('r1', 'all'), failed = expect(a).rejects.toThrow('preview unavailable'), late = first.onmessage!
  first.onerror?.({ preventDefault() {} } as ErrorEvent); await failed
  expect(first.terminated).toBe(true)
  const b = client.run('r1', 'all')
  late({ data: { kind: 'result', requestId: 2, value: { ...sample, period: '1y' } } } as MessageEvent<CatalogueWorkerReply>)
  second.reply({ kind: 'result', requestId: 2, value: sample })
  expect((await b).period).toBe('all'); client.dispose()
})

test('생성실패·전송실패·역직렬화 오류·잘못된 결과는 실패로 닫고 비밀 오류를 노출하지 않는다', async () => {
  const createFailure = createCataloguePreviewClient(() => { throw Error('private test detail') })
  await expect(createFailure.run('r1', 'all')).rejects.toThrow(/^catalogue preview unavailable$/)
  for (const mode of ['post', 'decode', 'result'] as const) {
    const worker = new FakeWorker()
    if (mode === 'post') worker.postMessage = () => { throw Error('private test detail') }
    const client = createCataloguePreviewClient(() => worker), p = client.run('r1', 'all'), failed = expect(p).rejects.toThrow(/^catalogue preview unavailable$/)
    if (mode === 'decode') worker.onmessageerror?.({} as MessageEvent)
    if (mode === 'result') worker.reply({ kind: 'result', requestId: 1, value: { ...sample, period: '2y' } })
    await failed; expect(worker.terminated).toBe(true); client.dispose()
  }
})

test('소유자 종료는 모든 대기 요청을 해제하며 요청 상한을 넘겨 worker를 늘리지 않는다', async () => {
  const worker = new FakeWorker(), client = createCataloguePreviewClient(() => worker)
  const waits = Array.from({ length: 128 }, () => client.run('r1', 'all').catch(error => error.name))
  await expect(client.run('r1', 'all')).rejects.toThrow('preview unavailable')
  client.dispose(); client.dispose()
  expect(await Promise.all(waits)).toEqual(Array(128).fill('AbortError'))
  const already = new AbortController(); already.abort()
  const fresh = createCataloguePreviewClient(() => { throw Error('must not create worker') })
  await expect(fresh.run('r1', 'all', already.signal)).rejects.toHaveProperty('name', 'AbortError')
})

test('실제 브라우저 worker에서 31종·155기간을 원본 수치로 계산하고 UI 스레드를 분리한다', async ({ page }) => {
  await page.goto('/')
  const dataRequests: string[] = []
  page.on('request', request => { if (/client-catalogue-(spot|futures)-data/.test(request.url())) dataRequests.push(request.url()) })
  const expected = [...spotGolden.rows, ...futuresGolden.rows, ...windowGolden.rows]
  const output = await page.evaluate(async expected => {
    const path = '/src/client-catalogue-preview.ts', { createCataloguePreviewClient } = await import(path)
    const client = createCataloguePreviewClient()
    let frames = 0, running = true
    const frame = () => { frames++; if (running) requestAnimationFrame(frame) }; requestAnimationFrame(frame)
    try {
      const results = []
      for (let offset = 0; offset < expected.length; offset += 31) results.push(...await Promise.all(expected.slice(offset, offset + 31).map(async (r: { id: string; period: string }) => {
        const value = await client.run(r.id, r.period)
        return { id: value.strategy.id, period: value.period, ret: value.result.ret, n: value.result.n, startI: value.result.params.startI, source: value.source, asof: value.calendar.asof, eqEnd: value.result.eq.at(-1)?.v, calculation: value.calculation, contextPeriod: value.contextPeriod }
      })))
      const first = await client.run('r1', 'all'); first.result.eq[0].v = 999
      const again = await client.run('r1', 'all')
      return { results, frames, isolated: again.result.eq[0].v !== 999 }
    } finally { running = false; client.dispose() }
  }, expected.map(r => ({ id: r.id, period: r.period })))
  expect(output.frames).toBeGreaterThan(0); expect(output.isolated).toBe(true)
  for (const r of output.results) {
    const e = expected.find(e => e.id === r.id && e.period === r.period)!
    expect(r).toMatchObject({ n: e.n, startI: e.startI, source: 'client-snapshot-preview', asof: '2026-09-28' })
    const window = r.period === '7d' || r.period === '30d'
    expect(r.calculation).toBe(window ? 'equity-window' : r.period === 'all' ? 'full-run' : 'restart-run')
    expect(r.contextPeriod).toBe(window ? 'all' : 'selected')
    expect(r.ret).toBeCloseTo(e.ret, 10); expect(r.eqEnd).toBeCloseTo(1 + e.ret / 100, 12)
  }
  expect(dataRequests.filter(s => s.includes('spot-data')).length).toBe(1)
  expect(dataRequests.filter(s => s.includes('futures-data')).length).toBe(1)
})

test('실제 worker의 취소·결측 전략·재시도는 원본 결과나 다른 요청을 훼손하지 않는다', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const path = '/src/client-catalogue-preview.ts', { createCataloguePreviewClient } = await import(path)
    const client = createCataloguePreviewClient(), control = new AbortController()
    try {
      const cancelled = client.run('r1', 'all', control.signal).catch((e: Error) => e.name)
      const kept = client.run('f1', 'all'); control.abort()
      const error = await client.run('unknown', 'all').catch((e: Error) => e.message)
      return { cancelled: await cancelled, kept: (await kept).strategy.id, error, retry: (await client.run('r1', 'all')).strategy.id }
    } finally { client.dispose() }
  })
  expect(result).toEqual({ cancelled: 'AbortError', kept: 'f1', error: 'catalogue preview unavailable', retry: 'r1' })
})

test('응답 없는 worker는 제한 시간에 종료되고 다음 명시 요청에서만 재생성된다', async ({ page }) => {
  await page.goto('/')
  await page.clock.install()
  await page.evaluate(async () => {
    const path = '/src/client-catalogue-preview.ts', { createCataloguePreviewClient } = await import(path)
    const probe = { created: 0, terminated: 0, reply: null as null | ((event: MessageEvent) => void), result: null as null | Promise<string>, client: null as ReturnType<typeof createCataloguePreviewClient> | null }
    const client = createCataloguePreviewClient(() => { probe.created++; return { onmessage: null, onerror: null, onmessageerror: null, postMessage() {}, terminate() { probe.terminated++ } } })
    probe.client = client; probe.result = client.run('r1', 'all').catch((e: Error) => e.message)
    Object.assign(window, { catalogueTimeoutProbe: probe })
  })
  await page.clock.fastForward(30001)
  const result = await page.evaluate(async () => {
    const probe = (window as unknown as { catalogueTimeoutProbe: { created: number; terminated: number; result: Promise<string>; client: { run: (id: string, period: string) => Promise<unknown>; dispose: () => void } } }).catalogueTimeoutProbe
    const error = await probe.result, before = { created: probe.created, terminated: probe.terminated }
    const next = probe.client.run('r1', 'all').catch(() => null); probe.client.dispose(); await next
    return { error, before, after: { created: probe.created, terminated: probe.terminated } }
  })
  expect(result).toEqual({ error: 'catalogue preview unavailable', before: { created: 1, terminated: 1 }, after: { created: 2, terminated: 2 } })
})
