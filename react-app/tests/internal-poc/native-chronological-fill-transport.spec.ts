import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import fixtures from './fixtures/chronological-fill-v11.json' with { type: 'json' }
import generation from '../../src/internal-poc/contracts/generated/api-v0.11/generation-manifest.json' with { type: 'json' }

const hash = (raw: Buffer) => createHash('sha256').update(raw).digest('hex')
const sample = fixtures.cases.find(item => item.id === 'first-complete')!.value
const request = { backtestId: sample.data.binding.backtestId, segment: 'IS' as const, manifestContentHash: sample.data.manifestContentHash }

test('Contracts39의 generated SDK와 synthetic fixture는 고정 원bytes다', () => {
  const root = new URL('../../src/internal-poc/contracts/generated/api-v0.11/', import.meta.url)
  expect(hash(readFileSync(new URL('generation-manifest.json', root)))).toBe('55a27e8f9d976b551fc66538a1dacdfe2fe7b05569d49c1cb4ae27564d8820da')
  for (const [name, digest] of Object.entries(generation.generatedSha256)) {
    expect(hash(readFileSync(new URL(name, root))), name).toBe(digest)
  }
  expect(hash(readFileSync(new URL('./fixtures/chronological-fill-v11.json', import.meta.url)))).toBe('19e84d3a1edef5f6b374fcce1caa3e8f095fafb0080ccedbb459785ced1cbfde')
})

test.beforeEach(async ({ page }) => {
  await page.route('**/fill-transport-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><body>시간순 체결 수신 검사</body></html>' }))
  await page.goto('/fill-transport-test.html')
})

test('원 SDK를 통해 실제 browser GET 한 번으로 매수·매도 페이지를 검증한다', async ({ page }) => {
  const calls: { method: string; path: string }[] = []
  await page.route('**/api/v11/**', route => {
    calls.push({ method: route.request().method(), path: new URL(route.request().url()).pathname })
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store', etag: `"${sample.data.pageContentHash}"` }, body: JSON.stringify(sample) })
  })
  const result = await page.evaluate(async request => {
    const path = '/src/internal-poc/native-chronological-fill-transport.ts'
    const { createNativeChronologicalFillClient } = await import(/* @vite-ignore */ path)
    const client = createNativeChronologicalFillClient()
    try {
      const response = await client.read(request)
      return { markers: response.body.data.markers, frozen: Object.isFrozen(response.body.data), status: response.status }
    } finally { client.dispose() }
  }, request)
  expect(result).toEqual({ markers: sample.data.markers, frozen: true, status: 200 })
  expect(calls).toEqual([{ method: 'GET', path: '/api/v11/backtests/backtest_chart_0001/chronological-fill-markers' }])
})

for (const scenario of ['cache-combined', 'etag-combined', 'content-type-combined', 'invalid-utf8', 'bom', 'oversize', 'redirect', 'network'] as const) {
  test(`브라우저 응답 ${scenario}는 검증 실패와 통신 실패를 구분하며 자동재시도하지 않는다`, async ({ page }) => {
    let calls = 0
    await page.route('**/api/v11/**', route => {
      calls++
      if (scenario === 'network') return route.abort()
      return route.fulfill({ status: scenario === 'redirect' ? 302 : 200,
        headers: {
          'content-type': scenario === 'content-type-combined' ? 'application/json, text/html' : 'application/json',
          'cache-control': scenario === 'cache-combined' ? 'no-store, public' : 'no-store',
          etag: scenario === 'etag-combined' ? `"${sample.data.pageContentHash}", "conflict"` : `"${sample.data.pageContentHash}"`,
          ...(scenario === 'redirect' ? { location: '/must-not-follow' } : {}),
        },
        body: scenario === 'invalid-utf8' ? Buffer.from([0xc3, 0x28]) : scenario === 'bom' ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify(sample))])
          : scenario === 'oversize' ? 'x'.repeat(262145) : JSON.stringify(sample),
      })
    })
    const result = await page.evaluate(async request => {
      const path = '/src/internal-poc/native-chronological-fill-transport.ts'
      const { createNativeChronologicalFillClient } = await import(/* @vite-ignore */ path)
      const client = createNativeChronologicalFillClient()
      try { await client.read(request); return 'ACCEPTED' }
      catch (error) { return (error as { code: string }).code }
      finally { client.dispose() }
    }, request)
    expect(result).toBe(scenario === 'network' ? 'TRANSPORT_FAILED' : 'INVALID_RESPONSE')
    expect(calls).toBe(1)
  })
}

test('owner 폐기 후 늦은 응답과 재조회는 거절하고 다른 client는 유지한다', async ({ page }) => {
  const result = await page.evaluate(async ({ request, sample }) => {
    const path = '/src/internal-poc/native-chronological-fill-transport.ts'
    const { createNativeChronologicalFillClient } = await import(/* @vite-ignore */ path)
    const original = window.fetch, signals: AbortSignal[] = []
    let release = () => {}, entered = () => {}
    const held = new Promise<void>(resolve => { release = resolve })
    const started = new Promise<void>(resolve => { entered = resolve })
    window.fetch = async (input, init) => {
      signals.push(init!.signal as AbortSignal)
      if (signals.length === 2) entered()
      await held // Deliberately ignore abort to prove late-response rejection.
      const response = new Response(JSON.stringify(sample), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', etag: `"${sample.data.pageContentHash}"` } })
      Object.defineProperty(response, 'url', { value: String(input) })
      return response
    }
    const owner = new AbortController()
    const first = createNativeChronologicalFillClient(owner.signal), second = createNativeChronologicalFillClient()
    const outcome = async (promise: Promise<unknown>) => { try { await promise; return 'OK' } catch (error) { return (error as { code: string }).code } }
    try {
      const a = outcome(first.read(request)), b = outcome(second.read(request))
      await started
      owner.abort(); first.dispose(); first.dispose()
      const aborted = signals.map(signal => signal.aborted)
      release()
      const outcomes = await Promise.all([a, b])
      const retired = await outcome(first.read(request))
      return { aborted, outcomes, retired, fetches: signals.length }
    } finally { release(); first.dispose(); second.dispose(); window.fetch = original }
  }, { request, sample })
  expect(result).toEqual({ aborted: [true, false], outcomes: ['TRANSPORT_FAILED', 'OK'], retired: 'TRANSPORT_FAILED', fetches: 2 })
})

test('같은 origin의 명시 GET 이외 요청·중복query·과대target은 fetch 이전에 거절한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const path = '/src/internal-poc/native-chronological-fill-transport.ts'
    const { NativeChronologicalFillTransport } = await import(/* @vite-ignore */ path)
    const transport = new NativeChronologicalFillTransport(), original = window.fetch
    let calls = 0
    window.fetch = async () => { calls++; throw Error('unexpected fetch') }
    const base = { method: 'GET', path: '/api/v11/backtests/backtest_chart_0001/chronological-fill-markers?manifestContentHash=' + '5'.repeat(64) + '&segment=IS', headers: { Accept: 'application/json' }, credentials: 'include', cache: 'no-store', redirect: 'manual' }
    const requests = [
      { ...base, path: 'https://example.com' + base.path }, { ...base, path: '//example.com' + base.path },
      { ...base, path: '/api/v11/../v11' + base.path.slice(8) }, { ...base, path: base.path + '#fragment' },
      { ...base, path: base.path.replace('/v11/', '/v7/') }, { ...base, path: base.path + '&extra=1' },
      { ...base, path: base.path + '&segment=OOS' }, { ...base, path: base.path + '&cursor=' + 'a'.repeat(2048) },
      { ...base, method: 'POST' }, { ...base, credentials: 'omit' }, { ...base, redirect: 'follow' },
      { ...base, cache: 'default' }, { ...base, headers: { ...base.headers, Authorization: 'forbidden' } },
    ]
    try {
      const failures = []
      for (const request of requests) {
        try { await transport.request(request); failures.push('ACCEPTED') }
        catch (error) { failures.push((error as Error).message) }
      }
      return { calls, failures }
    } finally { transport.dispose(); window.fetch = original }
  })
  expect(result).toEqual({ calls: 0, failures: Array(13).fill('FILL_REQUEST_REJECTED') })
})

for (const scenario of ['limit-exact', 'limit-over', 'multibyte-over', 'split-bom', 'declared-over', 'declared-invalid'] as const) {
  test(`stream ${scenario}는 원 바이트 상한과 UTF-8 의미를 보존하고 body를 해제한다`, async ({ page }) => {
    const result = await page.evaluate(async ({ scenario, sample, request }) => {
      const path = '/src/internal-poc/native-chronological-fill-transport.ts'
      const { NativeChronologicalFillTransport, createNativeChronologicalFillClient } = await import(/* @vite-ignore */ path)
      const original = window.fetch
      let cancelled = 0
      const encoder = new TextEncoder()
      const chunks = scenario === 'split-bom' ? [new Uint8Array([0xef]), new Uint8Array([0xbb, 0xbf]), encoder.encode(JSON.stringify(sample))]
        : scenario === 'multibyte-over' ? [encoder.encode('가'.repeat(87382))]
          : [encoder.encode('x'.repeat(scenario === 'limit-exact' ? 262144 : 262145))]
      window.fetch = async input => {
        const stream = new ReadableStream<Uint8Array>({ start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk)
          if (scenario === 'limit-exact' || scenario === 'split-bom') controller.close()
        }, cancel() { cancelled++ } })
        const response = new Response(stream, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', etag: `"${sample.data.pageContentHash}"`,
          ...(scenario === 'declared-over' ? { 'content-length': '262145' } : scenario === 'declared-invalid' ? { 'content-length': '12, 13' } : {}) } })
        Object.defineProperty(response, 'url', { value: String(input) })
        return response
      }
      const transport = new NativeChronologicalFillTransport(), client = createNativeChronologicalFillClient()
      try {
        let outcome = ''
        try {
          if (scenario === 'split-bom') { await client.read(request); outcome = 'ACCEPTED' }
          else {
            const response = await transport.request({ method: 'GET', path: `/api/v11/backtests/${request.backtestId}/chronological-fill-markers?manifestContentHash=${request.manifestContentHash}&segment=IS`,
              headers: { Accept: 'application/json' }, credentials: 'include', redirect: 'manual', cache: 'no-store' })
            outcome = String(encoder.encode(response.body).length)
          }
        } catch (error) { outcome = (error as { code?: string; message: string }).code ?? (error as Error).message }
        return { outcome, cancelled }
      } finally { transport.dispose(); client.dispose(); window.fetch = original }
    }, { scenario, sample, request })
    expect(result).toEqual({ outcome: scenario === 'limit-exact' ? '262144' : scenario === 'split-bom' ? 'INVALID_RESPONSE' : 'FILL_RESPONSE_TOO_LARGE',
      cancelled: scenario === 'limit-exact' || scenario === 'split-bom' ? 0 : 1 })
  })
}

test('SDK 해시 검사 도중 owner를 폐기해도 늦은 성공 결과가 나오지 않는다', async ({ page }) => {
  const result = await page.evaluate(async ({ request, sample }) => {
    const path = '/src/internal-poc/native-chronological-fill-transport.ts'
    const { createNativeChronologicalFillClient } = await import(/* @vite-ignore */ path)
    const originalFetch = window.fetch, originalDigest = crypto.subtle.digest
    let entered = () => {}, release = () => {}
    const started = new Promise<void>(resolve => { entered = resolve })
    const held = new Promise<void>(resolve => { release = resolve })
    crypto.subtle.digest = async (...args) => { entered(); await held; return originalDigest.apply(crypto.subtle, args) }
    window.fetch = async input => {
      const response = new Response(JSON.stringify(sample), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', etag: `"${sample.data.pageContentHash}"` } })
      Object.defineProperty(response, 'url', { value: String(input) }); return response
    }
    const owner = new AbortController(), client = createNativeChronologicalFillClient(owner.signal)
    try {
      const outcome = client.read(request).then(() => 'ACCEPTED', (error: { code: string }) => error.code)
      await started; owner.abort(); release()
      return await outcome
    } finally { release(); client.dispose(); window.fetch = originalFetch; crypto.subtle.digest = originalDigest }
  }, { request, sample })
  expect(result).toBe('TRANSPORT_FAILED')
})

test('같은 client의 동시 protocol/network 실패 분류가 서로 오염되지 않는다', async ({ page }) => {
  const result = await page.evaluate(async request => {
    const path = '/src/internal-poc/native-chronological-fill-transport.ts'
    const { createNativeChronologicalFillClient } = await import(/* @vite-ignore */ path)
    const original = window.fetch
    const client = createNativeChronologicalFillClient()
    let calls = 0
    window.fetch = async input => {
      calls++
      if (new URL(String(input)).searchParams.get('segment') === 'OOS') throw new TypeError('Network failure')
      const response = new Response('x'.repeat(262145), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
      Object.defineProperty(response, 'url', { value: String(input) }); return response
    }
    const outcome = async (segment: string) => { try { await client.read({ ...request, segment }); return 'ACCEPTED' } catch (error) { return (error as { code: string }).code } }
    try { return { outcomes: await Promise.all([outcome('IS'), outcome('OOS'), outcome('IS'), outcome('OOS')]), calls } }
    finally { client.dispose(); window.fetch = original }
  }, request)
  expect(result).toEqual({ outcomes: ['INVALID_RESPONSE', 'TRANSPORT_FAILED', 'INVALID_RESPONSE', 'TRANSPORT_FAILED'], calls: 4 })
})

test('30초 제한은 해당 요청만 취소하고 타이머를 해제한다', async ({ page }) => {
  const result = await page.evaluate(async request => {
    const path = '/src/internal-poc/native-chronological-fill-transport.ts'
    const { createNativeChronologicalFillClient } = await import(/* @vite-ignore */ path)
    const originalFetch = window.fetch, originalSet = window.setTimeout, originalClear = window.clearTimeout
    let expire = () => {}, entered = () => {}, cleared = 0, observed = 0
    const started = new Promise<void>(resolve => { entered = resolve })
    window.setTimeout = (handler, timeout) => {
      if (timeout !== 30_000 || typeof handler !== 'function') throw Error('unexpected timer')
      observed = timeout; expire = () => handler(); return 123456789
    }
    window.clearTimeout = id => { if (id === 123456789) cleared++; else originalClear(id) }
    window.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      entered()
    })
    const client = createNativeChronologicalFillClient()
    try {
      const pending = client.read(request).then(() => 'ACCEPTED', (error: { code: string }) => error.code)
      await started; expire()
      return { outcome: await pending, observed, cleared }
    } finally { client.dispose(); window.fetch = originalFetch; window.setTimeout = originalSet; window.clearTimeout = originalClear }
  }, request)
  expect(result).toEqual({ outcome: 'TRANSPORT_FAILED', observed: 30000, cleared: 1 })
})

test('SDK가 부정형 DTO를 거절하고 이미 종료된 owner는 요청하지 않는다', async ({ page }) => {
  const result = await page.evaluate(async request => {
    const path = '/src/internal-poc/native-chronological-fill-transport.ts'
    const { createNativeChronologicalFillClient } = await import(/* @vite-ignore */ path)
    const original = window.fetch
    let calls = 0
    window.fetch = async () => { calls++; throw Error('unexpected') }
    const owner = new AbortController(); owner.abort()
    const retired = createNativeChronologicalFillClient(owner.signal), active = createNativeChronologicalFillClient()
    const outcome = async (promise: Promise<unknown>) => { try { await promise; return 'ACCEPTED' } catch (error) { return (error as { code: string }).code } }
    try {
      return { outcomes: [await outcome(retired.read(request)), await outcome(active.read({ ...request, limit: 101 })),
        await outcome(active.read({ ...request, cursor: 'x'.repeat(8193) }))], calls }
    } finally { retired.dispose(); active.dispose(); window.fetch = original }
  }, request)
  expect(result).toEqual({ outcomes: ['TRANSPORT_FAILED', 'INVALID_REQUEST', 'INVALID_REQUEST'], calls: 0 })
})
