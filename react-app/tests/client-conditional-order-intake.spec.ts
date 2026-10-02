import { expect, test, type Page } from '@playwright/test'
import { conditionalOrderTurnId, readConditionalOrderTag } from '../src/client-conditional-order-intake'
import { createConditionalOrdersAccount } from '../src/use-client-conditional-orders'

const data = { asset: '비트코인', side: 'sell', trigger: 90000, triggerPct: null, qty: 'half', qtyNum: null, lev: null, ttl: '7d' }
const response = `조건을 확인했습니다. 아래에서 예약합니다.\n[ORDER ${JSON.stringify(data)}]`
function memory() {
  const values = new Map<string, string>(), writes: string[] = []
  return { values, writes, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); writes.push(key) } }
}

test('완료된 원본 ORDER만 분리하고 원문과 source ticker를 보존한다', () => {
  const parsed = readConditionalOrderTag(response)!
  expect(parsed.cleanText).toBe('조건을 확인했습니다. 아래에서 예약합니다.\n')
  expect(parsed.spec).toEqual({ asset: '비트코인', symbol: 'BTC', side: 'sell', trigger: 90000, triggerPct: null, last: null, qty: 'half', qtyNum: null, lev: null, ttl: '7d', exchange: null })
  const simple = readConditionalOrderTag('[ORDER {"asset":"ETH","side":"buy","trigger":3000}]')!
  expect(simple.spec.qty).toBe('all'); expect(simple.spec.ttl).toBe('gtc')
  expect(readConditionalOrderTag('[ORDER {"asset":"엔비디아","side":"buy","trigger":200}]')!.spec.symbol).toBe('NVDA')
  expect(Object.isFrozen(parsed.spec)).toBe(true)
})

test('손상·미완료·복수·중첩·secret·중복 field 태그와 숫자 강제변환을 거부한다', () => {
  for (const text of ['태그가 없는 문장', '[ORDER {"asset":"BTC"}', '[ORDER []]', `${response}\n${response}`,
    '[ORDER {"asset":"BTC","side":"sell","trigger":1,"side":"buy"}]',
    '[ORDER {"asset":"BTC","side":"sell","trigger":1,"apiKey":"TEST_PRIVATE"}]',
    '[ORDER {"asset":"BTC","side":"sell","trigger":{"amount":2}}]', '[order {"asset":"BTC","side":"sell","trigger":1}]',
    `[ORDER ${JSON.stringify({ ...data, side: 'unknown' })}]`, `[ORDER ${JSON.stringify({ ...data, side: false })}]`,
    `[ORDER ${JSON.stringify({ ...data, trigger: false })}]`, `[ORDER ${JSON.stringify({ ...data, trigger: '90000' })}]`,
    `[ORDER ${JSON.stringify({ ...data, qty: 'num', qtyNum: 0 })}]`, `[ORDER ${JSON.stringify({ ...data, qty: false })}]`,
    `[ORDER ${JSON.stringify({ ...data, ttl: false })}]`, '[ORDER {"asset":"BTC","side":"sell","trigger":1e999}]',
    `[ORDER ${JSON.stringify({ ...data, triggerPct: 10 })}]`, '[ORDER {"asset":"BTC","side":"buy","trigger":3,"lev":2}]',
    'x'.repeat(16001) + response]) expect(readConditionalOrderTag(text)).toBeNull()
})

test('실가격 미공급에서는 가격을 만들지 않고 명시 관측이 있을 때만 source pct를 환산한다', () => {
  const text = '[ORDER {"asset":"비트코인","side":"short","trigger":null,"triggerPct":5,"lev":3}]'
  expect(readConditionalOrderTag(text)!.spec).toMatchObject({ trigger: null, triggerPct: 5, last: null })
  expect(readConditionalOrderTag(text, { last: 80000, exchange: 'Bitget' })!.spec).toMatchObject({ trigger: 84000, triggerPct: 5, last: 80000, exchange: 'Bitget' })
  expect(readConditionalOrderTag(text, { last: Infinity })).toBeNull()
  expect(readConditionalOrderTag(text, { last: Number.MAX_VALUE })).toBeNull()
  expect(readConditionalOrderTag('[ORDER {"asset":"기타 자산","side":"sell","trigger":10}]')).toBeNull()
  expect(readConditionalOrderTag('[ORDER {"asset":"기타 자산","side":"sell","trigger":10}]', { symbol: 'SUPPLIED' })!.spec.symbol).toBe('SUPPLIED')
  expect(conditionalOrderTurnId('chat:a', 'turn:b')).not.toBe(conditionalOrderTurnId('chat', 'a:turn:b'))
})

test('같은 완료 turn의 반복 render·왕복·reload가 추가 주문이나 저장을 만들지 않는다', () => {
  const storage = memory(), options = { owner: 'owner-a', currentSessionId: 'chat-a', sessionIds: ['chat-a'], storage, now: () => 1000 }
  const account = createConditionalOrdersAccount(options), before = account.getSnapshot()
  expect(account.getSnapshot()).toBe(before)
  const first = account.observe('chat-a', 'turn-a', response)!
  const after = account.getSnapshot(), writes = storage.writes.length
  for (let index = 0; index < 10; index++) expect(account.observe('chat-a', 'turn-a', response)).toBe(first)
  expect(account.getSnapshot()).toBe(after); expect(storage.writes.length).toBe(writes)
  const restored = createConditionalOrdersAccount(options)
  expect(restored.observe('chat-a', 'turn-a', response)).toEqual(first)
  expect(storage.writes.length).toBe(writes)
  expect(restored.orderForTurn('chat-a', 'turn-a')?.id).toBe(first.id)
})

test('두 세션의 대기 주문은 같은 ID로 모이고 다른 owner와 삭제된 세션은 섞이지 않는다', () => {
  const storage = memory(), options = { owner: 'owner-a', currentSessionId: 'chat-a', sessionIds: ['chat-a', 'chat-b'], storage, now: () => 1000 }
  const account = createConditionalOrdersAccount(options)
  const a = account.observe('chat-a', 'same-turn', response)!, b = account.observe('chat-b', 'same-turn', response)!
  expect(a.id).not.toBe(b.id)
  account.place(a.id); account.place(b.id)
  expect(account.getSnapshot().currentOrders.map(order => order.id)).toEqual([a.id])
  expect(account.getSnapshot().allPendingOrders.map(order => order.id)).toEqual([a.id, b.id])
  const switched = createConditionalOrdersAccount({ ...options, currentSessionId: 'chat-b' })
  switched.cancel(a.id)
  expect(switched.getSnapshot().currentOrders[0].id).toBe(b.id)
  expect(switched.getSnapshot().allPendingOrders.map(order => order.id)).toEqual([b.id])
  const other = createConditionalOrdersAccount({ ...options, owner: 'owner-b' })
  expect(other.getSnapshot().currentOrders).toEqual([]); expect(() => other.cancel(b.id)).toThrow()
  const onlyA = createConditionalOrdersAccount({ ...options, sessionIds: ['chat-a'] })
  expect(onlyA.getSnapshot().allPendingOrders).toEqual([])
  expect(onlyA.observe('chat-b', 'turn-c', response)).toBeNull()
})

test('동일 turn의 변경 태그·손상 저장·미확인 scope는 기존 기록을 덮지 않는다', () => {
  const storage = memory(), options = { owner: 'owner-a', currentSessionId: 'chat-a', sessionIds: ['chat-a'], storage, now: () => 1000 }
  const account = createConditionalOrdersAccount(options), order = account.observe('chat-a', 'turn-a', response)!
  const writes = storage.writes.length
  expect(account.observe('chat-a', 'turn-a', response.replace('90000', '100000'))).toBeNull()
  expect(account.getSnapshot().error).toBe('conflict'); expect(account.getSnapshot().currentOrders[0]).toEqual(order)
  expect(storage.writes.length).toBe(writes)
  const key = storage.writes[0]; storage.values.set(key, '{broken')
  const broken = createConditionalOrdersAccount(options)
  expect(broken.observe('chat-a', 'turn-b', response)).toBeNull(); expect(broken.getSnapshot().error).toBe('corrupt')
  expect(storage.values.get(key)).toBe('{broken'); expect(storage.writes.length).toBe(writes)
  expect(createConditionalOrdersAccount({ ...options, currentSessionId: 'missing' }).getSnapshot().error).toBe('scope')
})

async function mountHook(page: Page) {
  await page.route('**/conditional-order-hook-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture"></div></body></html>' }))
  await page.goto('/conditional-order-hook-test.html')
  await page.evaluate(async response => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const hp = '/src/use-client-conditional-orders.ts', dp = '/@id/react-dom/client'
    const transformed = await (await fetch(hp)).text(), rp = transformed.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const module = await import(/* @vite-ignore */ hp), reactModule = await import(/* @vite-ignore */ rp), react = reactModule.default ?? reactModule, dom = await import(/* @vite-ignore */ dp)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    let owner = 'owner-a', currentSessionId = 'chat-a', observe = true
    const stableNow = () => 1000, sessionIds = ['chat-a', 'chat-b']
    function Host() {
      const account = module.useClientConditionalOrders({ owner, currentSessionId, sessionIds, now: stableNow })
      react.useEffect(() => { if (observe) { account.observe('chat-a', 'turn-a', response); account.observe('chat-b', 'turn-b', response) } }, [account.observe])
      return react.createElement('div', null,
        react.createElement('p', { id: 'current' }, JSON.stringify(account.currentOrders.map((order: { id: string }) => order.id))),
        react.createElement('p', { id: 'pending' }, JSON.stringify(account.allPendingOrders.map((order: { id: string }) => order.id))),
        react.createElement('p', { id: 'error' }, account.error ?? ''),
        ...account.currentOrders.map((order: { id: string; status: string }) => react.createElement('button', { key: order.id, onClick: () => account.place(order.id), disabled: order.status !== 'draft' }, '예약하기')),
        ...account.allPendingOrders.map((order: { id: string }) => react.createElement('button', { key: `cancel:${order.id}`, onClick: () => account.cancel(order.id) }, `취소 ${order.id}`)))
    }
    const render = () => root.render(react.createElement(react.StrictMode, null, react.createElement(Host)))
    Object.assign(window, { orderHook: { render, switchSession: () => { currentSessionId = currentSessionId === 'chat-a' ? 'chat-b' : 'chat-a'; render() },
      switchOwner: () => { owner = 'owner-b'; observe = false; render() } } })
    render()
  }, response)
  await expect(page.getByRole('button', { name: '예약하기', exact: true })).toBeVisible()
}

test('StrictMode hook는 재렌더·세션 왕복에 두 주문을 유지하고 계정 변경에서 격리한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mountHook(page)
  const a = conditionalOrderTurnId('chat-a', 'turn-a')!, b = conditionalOrderTurnId('chat-b', 'turn-b')!
  await expect(page.locator('#current')).toHaveText(JSON.stringify([a]))
  await page.getByRole('button', { name: '예약하기', exact: true }).click()
  await expect(page.locator('#pending')).toHaveText(JSON.stringify([a]))
  await page.evaluate(() => Reflect.get(window, 'orderHook').switchSession())
  await expect(page.locator('#current')).toHaveText(JSON.stringify([b]))
  await page.getByRole('button', { name: '예약하기', exact: true }).click()
  await expect(page.locator('#pending')).toHaveText(JSON.stringify([a, b]))
  await page.getByRole('button', { name: `취소 ${a}`, exact: true }).click()
  await expect(page.locator('#pending')).toHaveText(JSON.stringify([b]))
  await page.evaluate(() => { Reflect.get(window, 'orderHook').render(); Reflect.get(window, 'orderHook').render() })
  await expect(page.locator('#pending')).toHaveText(JSON.stringify([b]))
  await page.evaluate(() => Reflect.get(window, 'orderHook').switchOwner())
  await expect(page.locator('#current')).toHaveText('[]'); await expect(page.locator('#pending')).toHaveText('[]')
  expect(errors).toEqual([])
})
