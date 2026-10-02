import { expect, test, type Page } from '@playwright/test'
import { conditionalOrderDistance, conditionalOrderLine, createConditionalOrderPreviewStore, validConditionalOrder, validConditionalOrderSpec, type ConditionalOrderPreviewSpec } from '../src/client-conditional-order-preview'

const spec: ConditionalOrderPreviewSpec = { asset: '비트코인', symbol: 'BTC', side: 'sell', trigger: 80000, triggerPct: null, last: 75000, qty: 'half', qtyNum: null, lev: null, ttl: '7d', exchange: 'Bitget' }
function memory() {
  const data = new Map<string, string>(), writes: string[] = []
  return { data, writes, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { writes.push(key); data.set(key, value) } }
}

test('Mock 예약은 동일 ID로 초안→대기→취소를 저장하며 시간 경과나 reload로 체결을 만들지 않는다', () => {
  const storage = memory(); let at = 1000
  const options = { namespace: 'owner-a', sessionId: 'chat-a', storage, now: () => at, makeId: () => 'od-fixed' }
  const store = createConditionalOrderPreviewStore(options)
  const draft = store.create(spec)
  expect(draft.status).toBe('draft'); expect(store.storageKey).toMatch(/^teth:mock:conditional-orders:/)
  at = 2000; const waiting = store.place(draft.id)
  expect(waiting.id).toBe(draft.id); expect(waiting.placedAt).toBe(2000)
  expect(() => store.place(draft.id)).toThrow(); expect(() => store.updateDraft(draft.id, spec)).toThrow()
  at = 9_999_999
  const restored = createConditionalOrderPreviewStore(options)
  expect(restored.getSnapshot().orders).toEqual([waiting]); expect('fill' in store).toBe(false)
  const canceled = restored.cancel(waiting.id)
  expect(canceled.status).toBe('cancel'); expect(canceled.canceledAt).toBe(at)
  expect(() => restored.cancel(waiting.id)).toThrow()
  expect(createConditionalOrderPreviewStore({ ...options, namespace: 'owner-b' }).getSnapshot().orders).toEqual([])
  expect(createConditionalOrderPreviewStore({ ...options, sessionId: 'chat-b' }).getSnapshot().orders).toEqual([])
  expect(Object.isFrozen(restored.getSnapshot().orders[0])).toBe(true)
})

test('잘못된 금액·수량·식별자·credential 필드는 저장하지 않는다', () => {
  const storage = memory(), store = createConditionalOrderPreviewStore({ namespace: 'n', sessionId: 's', storage, now: () => 1000, makeId: () => 'order' })
  for (const patch of [{ trigger: Infinity }, { last: NaN }, { qty: 'num', qtyNum: 0 }, { trigger: null, triggerPct: null }, { triggerPct: -100 }, { symbol: '' }, { lev: 1 }, { apiKey: 'TEST_DO_NOT_STORE' }]) {
    expect(() => store.create({ ...spec, ...patch } as ConditionalOrderPreviewSpec)).toThrow()
  }
  expect(storage.writes).toEqual([]); expect(store.getSnapshot().orders).toEqual([])
  expect(validConditionalOrderSpec({ ...spec, qty: 'num', qtyNum: .0001 })).toBe(true)
  expect(() => createConditionalOrderPreviewStore({ namespace: '', sessionId: 's' })).toThrow()
})

test('손상·다른 계보·중복 ID·가짜 체결 저장은 원문을 덮어쓰지 않는다', () => {
  const storage = memory(), options = { namespace: 'n', sessionId: 's', storage, now: () => 1000, makeId: () => 'one' }
  const first = createConditionalOrderPreviewStore(options), order = first.create(spec)
  const envelope = JSON.parse(storage.getItem(first.storageKey)!)
  for (const value of ['{broken', JSON.stringify({ ...envelope, sourceSha: 'other' }), JSON.stringify({ ...envelope, namespace: 'other' }),
    JSON.stringify({ ...envelope, orders: [order, order] }), JSON.stringify({ ...envelope, orders: [{ ...order, status: 'done', placedAt: 1000, filledAt: 2000, fillPrice: 80000 }] }),
    JSON.stringify({ ...envelope, orders: [{ ...order, accessToken: 'TEST_PRIVATE_FIELD' }] })]) {
    storage.data.set(first.storageKey, value); const count = storage.writes.length
    const store = createConditionalOrderPreviewStore(options)
    expect(store.getSnapshot().error).toBe('corrupt'); expect(() => store.create(spec)).toThrow()
    expect(storage.writes.length).toBe(count); expect(storage.getItem(first.storageKey)).toBe(value)
  }
})

test('쓰기 실패·silent drop·다른 store 변경은 상태 성공을 합성하거나 덮어쓰지 않는다', () => {
  const storage = memory(); let fail = false, drop = false
  const wrapped = { getItem: storage.getItem, setItem: (key: string, value: string) => { if (fail) throw new Error('blocked'); if (!drop) storage.setItem(key, value) } }
  const store = createConditionalOrderPreviewStore({ namespace: 'n', sessionId: 's', storage: wrapped, now: () => 1000, makeId: () => 'one' })
  store.create(spec); fail = true
  expect(() => store.place('one')).toThrow(); expect(store.getSnapshot().orders[0].status).toBe('draft')
  fail = false; drop = true
  expect(() => store.place('one')).toThrow(); expect(store.getSnapshot().orders[0].status).toBe('draft')
  drop = false; store.place('one'); expect(store.getSnapshot().error).toBeNull()
  const foreign = createConditionalOrderPreviewStore({ namespace: 'n', sessionId: 's', storage, now: () => 2000 })
  foreign.cancel('one'); const bytes = storage.getItem(store.storageKey)
  expect(() => store.cancel('one')).toThrow(); expect(store.getSnapshot().error).toBe('corrupt')
  expect(storage.getItem(store.storageKey)).toBe(bytes)
})

test('원본 가격 거리·수량·롱/숏·기한 문구를 유지하며 잘못된 체결 projection을 거부한다', () => {
  expect(conditionalOrderLine(spec)).toBe('BTC가 $80,000 이상이 되면 Bitget에서 주문 시점 보유 BTC의 절반을 한 번 매도합니다')
  expect(conditionalOrderDistance(spec)).toBe('지금 $75,000, 목표까지 +6.7%')
  expect(conditionalOrderLine({ ...spec, side: 'long', qty: 'num', qtyNum: .5, trigger: null, triggerPct: -5, lev: 3, exchange: null })).toBe('BTC가 지금보다 -5% 움직이면 연결한 거래소에서 0.5 BTC를 3배로 한 번 롱으로 진입합니다')
  const order = createConditionalOrderPreviewStore({ namespace: 'n', sessionId: 's', now: () => 1000, makeId: () => 'one' }).create(spec)
  expect(validConditionalOrder({ ...order, status: 'done' })).toBe(false)
  expect(validConditionalOrder({ ...order, status: 'done', placedAt: 1200, filledAt: 1300, fillPrice: 80000 })).toBe(true)
})

async function mount(page: Page, mode: 'mock' | 'pending' | 'missing' | 'throw' = 'mock') {
  await page.route('**/conditional-order-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#000;color:#fff;font-family:sans-serif;margin:0"><main style="padding:16px"><div id="fixture"></div></main></body></html>' }))
  await page.goto('/conditional-order-test.html')
  await page.evaluate(async ({ spec, mode }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const dp = '/@id/react-dom/client', cp = '/src/components/ClientConditionalOrderCard.tsx', sp = '/src/client-conditional-order-preview.ts'
    const transformed = await (await fetch(cp)).text(), rp = transformed.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ rp), react = reactModule.default ?? reactModule
    const dom = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp), module = await import(/* @vite-ignore */ sp)
    const store = module.createConditionalOrderPreviewStore({ namespace: 'owner-a', sessionId: 'chat-a', storage: sessionStorage, now: () => 1000, makeId: () => 'order-one' })
    store.create(spec)
    const calls: string[] = [], deferred: { resolve: () => void; reject: () => void }[] = []
    const source = mode === 'mock' ? 'mock' : 'service'
    let binding = 'owner-a', supplied = store.getSnapshot().orders[0], capabilities = mode !== 'missing'
    const place = async (id: string) => {
      calls.push(id)
      if (mode === 'mock') store.place(id)
      else if (mode === 'throw') throw new Error('TEST_PRIVATE_ERROR')
      else await new Promise<void>((resolve, reject) => deferred.push({ resolve, reject: () => reject(new Error('TEST_PRIVATE_ERROR')) }))
    }
    const cancel = (id: string) => store.cancel(id)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    function Host() {
      const state = react.useSyncExternalStore(store.subscribe, store.getSnapshot)
      const order = source === 'mock' ? state.orders[0] : supplied
      return react.createElement(react.Fragment, null,
        react.createElement(component.ClientConditionalOrderCard, { order, source, binding, onPlace: capabilities ? place : undefined, onCancel: capabilities ? cancel : undefined,
          onEdit: (id: string) => calls.push(`edit:${id}`), onTerminal: (id: string) => calls.push(`terminal:${id}`) }),
        react.createElement('div', { style: { overflowX: 'auto' } }, react.createElement('table', null, react.createElement('tbody', null,
          react.createElement(component.ClientConditionalOrderPendingRows, { orders: source === 'mock' ? state.orders : [supplied], source, binding, onCancel: capabilities ? cancel : undefined }))))
      )
    }
    const render = () => root.render(react.createElement(react.StrictMode, null, react.createElement(Host)))
    Object.assign(window, { orderFixture: { store, calls, deferred, render, replace: () => { binding = 'owner-b'; supplied = { ...supplied, namespace: 'owner-b', id: 'order-two' }; render() },
      withdraw: () => { capabilities = false; render() }, unmount: () => root.unmount(), status: () => store.getSnapshot().orders[0].status } })
    render()
  }, { spec, mode })
  await expect(page.locator('.client-conditional-order')).toBeVisible()
}

test('동일 주문의 채팅 카드와 터미널 대기행이 함께 갱신되며 취소 뒤 행만 제거한다', async ({ page }) => {
  const outgoing: string[] = []; page.on('request', request => { if (request.method() !== 'GET') outgoing.push(request.url()) })
  await mount(page)
  await page.getByRole('button', { name: '조건 바꾸기', exact: true }).click()
  await page.getByRole('button', { name: '예약하기', exact: true }).click()
  await expect(page.locator('.client-conditional-order .od-st')).toHaveText('조건 대기')
  await expect(page.locator('.od-row')).toHaveAttribute('data-order-id', 'order-one')
  await expect(page.locator('.od-row')).toContainText('조건 대기, 7일')
  await page.locator('.od-row').getByRole('button', { name: '취소', exact: true }).click()
  await expect(page.locator('.client-conditional-order .od-st')).toHaveText('취소됨')
  await expect(page.locator('.od-row')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'orderFixture').calls)).toEqual(['edit:order-one', 'order-one'])
  expect(outgoing).toEqual([])
})

test('서비스 callback 성공은 대기나 체결을 합성하지 않고 진행 중 중복 클릭을 차단한다', async ({ page }) => {
  await mount(page, 'pending')
  await page.getByRole('button', { name: '예약하기', exact: true }).click()
  await expect(page.getByRole('button', { name: '예약하기', exact: true })).toBeDisabled()
  await page.evaluate(() => Reflect.get(window, 'orderFixture').deferred[0].resolve())
  await expect(page.getByRole('button', { name: '예약하기', exact: true })).toBeEnabled()
  await expect(page.locator('.od-st')).toHaveCount(0); await expect(page.locator('.od-row')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'orderFixture').calls)).toEqual(['order-one'])
})

test('실패와 callback 미공급은 실제 상태를 유지하고 원 오류를 노출하지 않는다', async ({ page }) => {
  await mount(page, 'throw')
  await page.getByRole('button', { name: '예약하기', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('요청을 완료하지 못했어요. 다시 시도해주세요.')
  await expect(page.locator('body')).not.toContainText('TEST_PRIVATE_ERROR')
  await page.evaluate(() => Reflect.get(window, 'orderFixture').withdraw())
  await expect(page.getByRole('button', { name: '예약하기', exact: true })).toBeDisabled()
  await expect(page.locator('.od-unavailable')).toHaveText('예약 주문 연결이 아직 제공되지 않았어요.')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('계정·주문 교체 후 이전 callback 실패가 새 주문을 변경하지 않는다', async ({ page }) => {
  await mount(page, 'pending')
  await page.getByRole('button', { name: '예약하기', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'orderFixture').replace())
  await expect(page.locator('.client-conditional-order')).toHaveAttribute('data-order-id', 'order-two')
  await page.evaluate(() => Reflect.get(window, 'orderFixture').deferred[0].reject())
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '예약하기', exact: true })).toBeEnabled()
  await expect(page.locator('.od-st')).toHaveCount(0)
})

test('원본 카드 타이포와 버튼 위계를 유지하고 모바일 화면 밖으로 넘치지 않는다', async ({ page }) => {
  await mount(page, 'missing')
  const dimensions = await page.locator('.client-conditional-order').evaluate(el => {
    const style = getComputedStyle(el), line = getComputedStyle(el.querySelector('.od-line')!), button = getComputedStyle(el.querySelector('.tf-btn.p')!)
    return { bg: style.backgroundColor, radius: style.borderRadius, font: line.fontSize, weight: line.fontWeight, buttonBg: button.backgroundColor, height: parseFloat(button.minHeight), overflow: document.documentElement.scrollWidth > innerWidth }
  })
  expect(dimensions).toEqual({ bg: 'rgb(48, 48, 48)', radius: '20px', font: '18px', weight: '400', buttonBg: 'rgb(255, 255, 255)', height: 48, overflow: false })
})
