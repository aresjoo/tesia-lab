import { expect, test, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'
import type { MarketChartPresentation, MarketChartRequest } from '../src/client-market-chart-presentation'
import type { StoredMarketResponse } from '../src/client-stored-market-response'

// Store-only supplier fixtures: neither an API producer nor observed market data.
const key = 'teth-client-experience', owner = 'chart-store@example.test'
const sessionId = 'chart-store-session', turnId = 'chart-store-turn'
const binding = { scopeId: JSON.stringify([owner, sessionId]), messageId: turnId, observationId: 'chart-old' }
function presentation(observationId = 'chart-old', resolutionSeconds = 86400): MarketChartPresentation {
  return { binding: { ...binding, observationId }, seriesId: 'btc-series', asset: 'BTC/USDT', assetLabel: '비트코인',
    resolutionSeconds, availableResolutions: [3600, 86400], state: 'ready', view: {
      identity: `${observationId}:${resolutionSeconds}`, market: 'BTC/USDT', resolutionSeconds, pricePrecision: 2,
      sourceLabel: '저장 시험용 합성 관측 · 실제 시세 아님',
      bars: Array.from({ length: 30 }, (_, i) => ({ time: 1700000000 + i * resolutionSeconds,
        open: 100 + i, high: 107 + i, low: 98 + i, close: 105 + i, volume: 50 + i })),
      fills: [{ id: 'fill-one', tradeId: 'trade-one', time: 1700000010, price: 103, side: 'BUY' }],
    } }
}
function envelope(): StoredMarketResponse {
  const other = presentation('eth-observation')
  other.seriesId = 'eth-series'; other.asset = 'ETH/USDT'; other.assetLabel = '이더리움'
  other.view = { ...other.view!, market: 'ETH/USDT' }
  return { version: 1, owner, writingObservationId: 'question-observation', blocks: [
    { id: 'btc-card', kind: 'market-chart', presentation: presentation() },
    { id: 'eth-card', kind: 'market-chart', presentation: other },
    { id: 'question-card', kind: 'market-question', presentation: {
      binding: { ...binding, observationId: 'question-observation' },
      steps: [{ id: 'risk', title: '어떤 하락을 생각하세요?', options: [{ id: 'small', label: '작은 하락' }, { id: 'large', label: '큰 하락' }] }],
      state: { index: 0, picks: [[]], direct: [true], closed: false, accepted: null },
    } },
    { id: 'evidence-card', kind: 'market-evidence', presentation: {
      binding, searches: 3, results: 5, pagesRead: 2, sources: [{ id: 'source', title: '제공된 원문', url: 'https://example.test/evidence' }],
    } },
  ] }
}
function session(): ClientSession {
  return { id: sessionId, title: '차트 공급 저장 시험', renamed: true, idea: '시장 질문', draft: '아직 보내지 않은 직접 입력',
    pair: 'BTC/USDT', mode: 'dip', timeframe: '1일봉', risk: '-3%', takeProfit: '+8%', phase: 'plan',
    researchStatus: '초안', workspace: 'conversation', tradingReady: false, updatedAt: 1700000002000,
    turns: [{ id: turnId, question: '최근 흐름을 알려주세요', answer: '제공된 시장 관측입니다.', fullAnswer: '제공된 시장 관측입니다.',
      status: 'done', phase: 'plan', startedAt: 1700000000000, finishedAt: 1700000002000, suggestions: ['다음 질문'], marketResponse: envelope() }] }
}
const request = (): MarketChartRequest => ({ binding: { ...binding }, seriesId: 'btc-series', asset: 'BTC/USDT', resolutionSeconds: 3600 })

async function setup(page: Page, initial = session(), currentId: string | null = sessionId) {
  // Avoid mounting a second app-owned store; only the real browser module is imported.
  await page.route('**/__chart-supply-store', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Store test host</body></html>' }))
  await page.goto('/__chart-supply-store')
  await page.evaluate(async ({ key, initial, currentId }) => {
    sessionStorage.clear()
    sessionStorage.setItem(key, JSON.stringify({ currentId, sessions: [initial], homeDraft: '홈 입력도 보존', sharedFollows: [] }))
    const path = '/src/client-experience-store.ts'
    const module = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'chartSupplyStore', module.createClientExperienceStore())
  }, { key, initial, currentId })
}
const snapshot = (page: Page) => page.evaluate(() => Reflect.get(window, 'chartSupplyStore').getSnapshot())
async function apply(page: Page, value: unknown = presentation('chart-new', 3600), selected = request()) {
  return page.evaluate(({ sessionId, turnId, owner, selected, value }) => Reflect.get(window, 'chartSupplyStore')
    .applyMarketChartResponse(sessionId, turnId, owner, selected, value), { sessionId, turnId, owner, selected, value })
}

test('새 observation의 지원 주기만 교체하고 다른 차트·질문 상태·초안·원문을 저장과 새 store에 보존한다', async ({ page }) => {
  await setup(page)
  const before = await snapshot(page), supplied = presentation('chart-new', 3600)
  const result = await page.evaluate(({ key, sessionId, turnId, owner, selected, supplied }) => {
    const store = Reflect.get(window, 'chartSupplyStore'), publications: boolean[] = []
    const unsubscribe = store.subscribe(() => {
      const persisted = JSON.parse(sessionStorage.getItem(key)!)
      publications.push(JSON.stringify(persisted.sessions) === JSON.stringify(store.getSnapshot().sessions))
    })
    const accepted = store.applyMarketChartResponse(sessionId, turnId, owner, selected, supplied)
    unsubscribe()
    // An untrusted supplier retaining its object must not mutate the committed view.
    supplied.view!.bars[0].close = 99999
    return { accepted, publications }
  }, { key, sessionId, turnId, owner, selected: request(), supplied })
  expect(result).toEqual({ accepted: true, publications: [true] })
  const expected = structuredClone(before)
  expected.sessions[0].turns[0].marketResponse.blocks[0].presentation = supplied
  expect(await snapshot(page)).toEqual(expected)
  await page.evaluate(async () => {
    const path = '/src/client-experience-store.ts'
    const module = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'chartSupplyStore', module.createClientExperienceStore())
  })
  expect(await snapshot(page)).toEqual(expected)
})

test('빈 ready 가격창도 명시 관측으로 저장하며 다음 유효 창으로 복원한다', async ({ page }) => {
  await setup(page)
  const empty = presentation('chart-empty', 3600)
  empty.view = { ...empty.view!, bars: [], fills: [] }
  expect(await apply(page, empty)).toBe(true)
  expect((await snapshot(page)).sessions[0].turns[0].marketResponse.blocks[0].presentation).toEqual(empty)
  expect(await apply(page, presentation('chart-restored', 86400), { ...request(), binding: empty.binding, resolutionSeconds: 86400 })).toBe(true)
})

test('이미 교체된 observation의 응답은 현재 차트와 저장 내용을 덮어쓰지 못한다', async ({ page }) => {
  await setup(page)
  expect(await apply(page)).toBe(true)
  const before = await snapshot(page)
  const raw = await page.evaluate(key => sessionStorage.getItem(key), key)
  expect(await apply(page, presentation('late-observation', 3600))).toBe(false)
  expect(await snapshot(page)).toEqual(before)
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(raw)
})

for (const guard of ['home', 'workspace', 'stopped', 'owner', 'turn', 'session', 'shared-owner', 'storage-error'] as const) {
  test(`${guard}: 현재 선택 대화·완료·소유자 guard가 맞지 않으면 저장하지 않는다`, async ({ page }) => {
    await setup(page)
    const result = await page.evaluate(({ guard, key, sessionId, turnId, owner, selected, supplied }) => {
      const store = Reflect.get(window, 'chartSupplyStore'), state = store.getSnapshot()
      if (guard === 'home') state.currentId = null
      if (guard === 'workspace') state.sessions[0].workspace = 'research'
      if (guard === 'stopped') state.sessions[0].turns[0].status = 'stopped'
      if (guard === 'shared-owner') state.sessions[0].sharedCopy = { owner: 'foreign@example.test' }
      if (guard === 'storage-error') state.storageError = true
      const before = JSON.stringify(state), raw = sessionStorage.getItem(key)
      const accepted = store.applyMarketChartResponse(guard === 'session' ? 'other-session' : sessionId,
        guard === 'turn' ? 'other-turn' : turnId, guard === 'owner' ? 'foreign@example.test' : owner, selected, supplied)
      return { accepted, same: before === JSON.stringify(store.getSnapshot()), durableSame: raw === sessionStorage.getItem(key) }
    }, { guard, key, sessionId, turnId, owner, selected: request(), supplied: presentation('chart-new', 3600) })
    expect(result).toEqual({ accepted: false, same: true, durableSame: true })
  })
}

test('두 차트가 같은 요청에 일치하면 첫 항목을 임의로 골라 갱신하지 않는다', async ({ page }) => {
  const initial = session(), response = initial.turns[0].marketResponse!
  response.blocks.push({ ...structuredClone(response.blocks[0]), id: 'duplicate-matching-chart' })
  await setup(page, initial)
  const before = await snapshot(page)
  expect(before.sessions[0].turns[0].marketResponse.blocks).toHaveLength(5)
  expect(await apply(page)).toBe(false)
  expect(await snapshot(page)).toEqual(before)
})

test('요청의 scope·message·observation·series·asset·지원 주기를 모두 정확하게 검증한다', async ({ page }) => {
  await setup(page)
  const variants: MarketChartRequest[] = [
    { ...request(), binding: { ...binding, scopeId: 'foreign' } },
    { ...request(), binding: { ...binding, messageId: 'foreign' } },
    { ...request(), binding: { ...binding, observationId: 'foreign' } },
    { ...request(), seriesId: 'foreign' }, { ...request(), asset: 'ETH/USDT' },
    { ...request(), resolutionSeconds: 7200 }, { ...request(), resolutionSeconds: 0 },
    { ...request(), resolutionSeconds: 3600.1 },
  ]
  const before = await snapshot(page), raw = await page.evaluate(key => sessionStorage.getItem(key), key)
  for (const selected of variants) expect(await apply(page, presentation('chart-new', selected.resolutionSeconds), selected), JSON.stringify(selected)).toBe(false)
  expect(await snapshot(page)).toEqual(before)
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(raw)
})

test('공급 결과는 ready presentation 자체이며 손상된 shape·가격·체결·binding·주기·상태를 거절한다', async ({ page }) => {
  await setup(page)
  const results = await page.evaluate(({ key, sessionId, turnId, owner, selected, supplied }) => {
    const store = Reflect.get(window, 'chartSupplyStore'), before = JSON.stringify(store.getSnapshot()), raw = sessionStorage.getItem(key)
    const variants: [string, unknown][] = [
      ['null', null], ['envelope', { version: 1, owner, blocks: [{ id: 'chart', kind: 'market-chart', presentation: supplied }] }],
      ['block', { id: 'chart', kind: 'market-chart', presentation: supplied }],
      ['loading', { ...supplied, state: 'loading' }], ['error', { ...supplied, state: 'error' }], ['unavailable', { ...supplied, state: 'unavailable' }],
      ['view-null', { ...supplied, view: null }], ['binding-null', { ...supplied, binding: null }],
      ['scope', { ...supplied, binding: { ...supplied.binding, scopeId: 'foreign' } }],
      ['message', { ...supplied, binding: { ...supplied.binding, messageId: 'foreign' } }],
      ['observation-empty', { ...supplied, binding: { ...supplied.binding, observationId: ' ' } }],
      ['series', { ...supplied, seriesId: 'foreign' }], ['asset', { ...supplied, asset: 'ETH/USDT' }],
      ['resolution', { ...supplied, resolutionSeconds: 86400 }],
      ['resolution-options', { ...supplied, availableResolutions: [3600, 3600] }],
      ['bars-shape', { ...supplied, view: { ...supplied.view, bars: [null] } }],
      ['ohlc', { ...supplied, view: { ...supplied.view, bars: [{ ...supplied.view!.bars[0], high: 1 }] } }],
      ['nonfinite', { ...supplied, view: { ...supplied.view, bars: [{ ...supplied.view!.bars[0], close: Infinity }] } }],
      ['duplicate-time', { ...supplied, view: { ...supplied.view, bars: [supplied.view!.bars[0], supplied.view!.bars[0]] } }],
      ['negative-volume', { ...supplied, view: { ...supplied.view, bars: [{ ...supplied.view!.bars[0], volume: -1 }] } }],
      ['source', { ...supplied, view: { ...supplied.view, sourceLabel: ' ' } }],
      ['duplicate-fills', { ...supplied, view: { ...supplied.view, fills: [supplied.view!.fills[0], supplied.view!.fills[0]] } }],
      ['view-market', { ...supplied, view: { ...supplied.view, market: 'ETH/USDT' } }],
      ['view-resolution', { ...supplied, view: { ...supplied.view, resolutionSeconds: 60 } }],
      ['scenario', { ...supplied, scenario: { binding: supplied.binding } }],
    ]
    return variants.map(([name, value]) => ({ name, accepted: store.applyMarketChartResponse(sessionId, turnId, owner, selected, value),
      same: before === JSON.stringify(store.getSnapshot()), durableSame: raw === sessionStorage.getItem(key) }))
  }, { key, sessionId, turnId, owner, selected: request(), supplied: presentation('chart-new', 3600) })
  for (const { name, ...result } of results) expect(result, name).toEqual({ accepted: false, same: true, durableSame: true })
})

for (const fault of ['denied', 'drop', 'corrupt', 'readback'] as const) {
  test(`${fault}: durable readback 전 성공을 게시하지 않고 불확실 저장은 다음 요청까지 잠근다`, async ({ page }) => {
    await setup(page)
    const result = await page.evaluate(({ fault, key, sessionId, turnId, owner, selected, supplied }) => {
      const store = Reflect.get(window, 'chartSupplyStore'), before = store.getSnapshot()
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem
      let written = false, accepted = false, threw = false, publications = 0
      const unsubscribe = store.subscribe(() => { publications++ })
      Storage.prototype.setItem = function (name, text) {
        if (this === sessionStorage && name === key) {
          written = true
          if (fault === 'denied') throw new Error('injected storage denial')
          if (fault === 'drop') return
          if (fault === 'corrupt') return set.call(this, name, '{}')
        }
        return set.call(this, name, text)
      }
      Storage.prototype.getItem = function (name) {
        if (this === sessionStorage && name === key && written && fault === 'readback') throw new Error('injected readback failure')
        return get.call(this, name)
      }
      try { accepted = store.applyMarketChartResponse(sessionId, turnId, owner, selected, supplied) }
      catch { threw = true }
      finally { Storage.prototype.getItem = get; Storage.prototype.setItem = set; unsubscribe() }
      const unchanged = before === store.getSnapshot(), uncertain = store.commitUncertain()
      const raw = sessionStorage.getItem(key)
      const retry = store.applyMarketChartResponse(sessionId, turnId, owner, selected, supplied)
      return { accepted, threw, unchanged, uncertain, publications, retry,
        lockedStorageUnchanged: !uncertain || raw === sessionStorage.getItem(key),
        draft: store.getSnapshot().sessions[0].draft }
    }, { fault, key, sessionId, turnId, owner, selected: request(), supplied: presentation('chart-new', 3600) })
    const uncertain = fault === 'corrupt' || fault === 'readback'
    expect(result).toEqual({ accepted: false, threw: true, unchanged: true, uncertain, publications: 0,
      retry: !uncertain, lockedStorageUnchanged: true, draft: '아직 보내지 않은 직접 입력' })
  })
}
