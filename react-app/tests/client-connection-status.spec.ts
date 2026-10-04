import { expect, test, type Page } from '@playwright/test'
import { boundConnectionStatus, type ConnectionStatusPresentation, type ConnectionStatusRecord, type ConnectionStatusState } from '../src/client-connection-status-presentation'

const connection: ConnectionStatusRecord = { id: 'connection-a', exchange: 'bitget', route: 'partner', eligibility: 'eligible', maskedAccountLabel: '38••••42' }
const paid: ConnectionStatusRecord = { ...connection, route: 'paid', eligibility: 'expired' }
const states: { state: ConnectionStatusState; title: string; copy: string }[] = [
  { state: { kind: 'authorization_result', exchange: 'bitget', authorization: 'idle', invitationRouteAvailable: true }, title: 'Bitget 연결', copy: '전략에 쓸 잔고를 봅니다' },
  { state: { kind: 'invitation_verifying', exchange: 'bitget', maskedAccountLabel: '38••••42' }, title: 'Bitget 연결 확인 중', copy: 'TETH 초대로 만든 계정인지' },
  { state: { kind: 'not_invited', exchange: 'bitget' }, title: 'TETH 초대 계정이 아닙니다', copy: '초대로 만든 계정이 다른 거래소에 있을 때' },
  { state: { kind: 'connected_done', connection, strategyName: '테스트 전략', continuation: 'copy' }, title: '연결되었습니다', copy: '전략 복사 이어서 하기' },
  { state: { kind: 'strategy_start_after_connection', connection, strategyName: '테스트 전략', amountLabel: '₩500,000', feeLabel: '없음' }, title: '전략 시작', copy: '가상으로 먼저 시작' },
  { state: { kind: 'connected_list', connections: [connection, { ...paid, id: 'connection-b', exchange: 'okx' }] }, title: '거래소 연결', copy: '구독이 끝나 새 주문이 멈췄습니다' },
  { state: { kind: 'subscription_expired', connection: paid }, title: '구독이 끝났습니다', copy: '연결은 그대로 있습니다.' },
  { state: { kind: 'disconnect_confirmation', connection }, title: 'Bitget 연결을 끊으시겠습니까?', copy: '열려 있는 포지션은 거래소에 그대로 남습니다.' },
  { state: { kind: 'kyc_before_start', connection, kyc: 'none' }, title: 'Bitget 본인 확인', copy: '본인 확인이 끝나면 전략을 시작할 수 있습니다.' },
  { state: { kind: 'eligible_my_exchange_filter', connections: [connection], selected: 'all', empty: true }, title: '내 거래소', copy: 'Bitget에서 실행할 수 있는 전략이 아직 없습니다.' },
]
function presentation(state: ConnectionStatusState): ConnectionStatusPresentation {
  return { scope: 'owner-a', identity: 'observation-a', source: 'mock', state }
}

test('표시 binding은 source·owner·identity를 확인하고 unknown/역관측/손상을 거부한다', () => {
  const p = presentation(states[0].state)
  expect(boundConnectionStatus(p, 'owner-a', 'mock')).toBe(p)
  for (const [value, scope, source] of [
    [p, 'owner-b', 'mock'], [p, null, 'mock'], [{ ...p, identity: '' }, 'owner-a', 'mock'],
    [p, 'owner-a', 'service'], [{ ...p, source: 'unknown' }, 'owner-a', 'unknown'],
    [{ ...p, state: { kind: 'unknown' } }, 'owner-a', 'mock'],
    [presentation({ kind: 'connected_done', connection: paid }), 'owner-a', 'mock'],
    [presentation({ kind: 'connected_done', connection: { ...connection, eligibility: 'unknown' } }), 'owner-a', 'mock'],
    [presentation({ kind: 'subscription_expired', connection }), 'owner-a', 'mock'],
    [presentation({ kind: 'connected_list', connections: [connection, connection] }), 'owner-a', 'mock'],
    [presentation({ kind: 'connected_list', connections: [{ ...connection, maskedAccountLabel: '38291042' }] }), 'owner-a', 'mock'],
  ] as const) expect(boundConnectionStatus(value as ConnectionStatusPresentation, scope, source as 'mock')).toBeUndefined()
})

async function mount(page: Page, state: ConnectionStatusState, callbacks = false, source: 'mock' | 'service' = 'mock') {
  await page.goto('/')
  await page.evaluate(async ({ state, callbacks, source }) => {
    const domPath = '/@id/react-dom/client'
    const modulePath = '/src/components/ClientConnectionStatus.tsx'
    const transformed = await (await fetch(modulePath)).text()
    const reactPath = transformed.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const [reactModule, domModule, { ClientConnectionStatus }] = await Promise.all([
      import(/* @vite-ignore */ reactPath), import(/* @vite-ignore */ domPath), import(/* @vite-ignore */ modulePath),
    ])
    const React = reactModule.default ?? reactModule, { createRoot } = domModule.default ?? domModule
    document.body.replaceChildren(Object.assign(document.createElement('div'), { id: 'connection-fixture' }))
    document.body.style.background = '#000'; document.body.style.margin = '0'
    const calls: unknown[] = [], signals: AbortSignal[] = [], pending: { resolve: () => void; reject: () => void }[] = []
    const callback = (request: unknown, signal: AbortSignal) => {
      calls.push(request); signals.push(signal)
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error('PRIVATE_CALLBACK_DETAIL')) }))
    }
    const actions = callbacks ? Object.fromEntries(['authorize', 'invitationRoute', 'newAccount', 'subscribe', 'chooseExchange', 'continue', 'addExchange', 'startLive', 'startPaper', 'startLater', 'terminal', 'disconnect', 'openKyc', 'refresh', 'filter', 'help'].map(key => [key, callback])) : undefined
    const root = createRoot(document.getElementById('connection-fixture')!)
    const fixture = { calls, signals, pending, closeCount: 0,
      p: { scope: 'owner-a', identity: 'observation-a', source, state, actions }, scope: 'owner-a', source,
      render() { root.render(React.createElement(React.StrictMode, null, React.createElement(ClientConnectionStatus, {
        presentation: fixture.p, scope: fixture.scope, source: fixture.source, onClose: () => { fixture.closeCount++ },
      }))) },
    }
    Reflect.set(window, 'connectionFixture', fixture); fixture.render()
  }, { state, callbacks, source })
  await expect(page.locator('[data-connection-state]')).toBeVisible()
}
async function replace(page: Page, state: ConnectionStatusState, owner = 'owner-a') {
  await page.evaluate(({ state, owner }) => {
    const f = Reflect.get(window, 'connectionFixture'); f.scope = owner
    f.p = { ...f.p, scope: owner, identity: `${f.p.identity}-next`, state }; f.render()
  }, { state, owner })
}

for (const item of states) test(`원본 ${item.state.kind} 상태·문구·모바일 폭 및 미공급 동작`, async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => { if (/\/api\/|\/billing|\/orders(?:\?|$)/.test(request.url())) requests.push(request.method()) })
  await mount(page, item.state)
  await expect(page.getByRole('heading', { name: item.title, exact: true })).toBeVisible()
  await expect(page.locator('[data-connection-state]')).toContainText(item.copy)
  for (const button of await page.locator('[data-connection-state] button').all()) {
    if (await button.getAttribute('aria-label') !== '닫기' && await button.textContent() !== '취소') await expect(button).toBeDisabled()
  }
  expect(await page.locator('[data-connection-state]').evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(requests).toEqual([])
})

test('승인 failed/cancelled와 KYC 여섯 관측을 문구 그대로 표시하고 verified도 자동 실행하지 않는다', async ({ page }) => {
  await mount(page, states[0].state, true)
  for (const authorization of ['failed', 'cancelled'] as const) {
    await replace(page, { kind: 'authorization_result', exchange: 'bitget', authorization })
    await expect(page.locator('[data-connection-state]')).toContainText(authorization === 'failed' ? 'Bitget에서 승인을 마치지 못했습니다.' : '승인을 취소했습니다. 연결된 것은 없습니다.')
  }
  for (const kyc of ['none', 'running', 'review', 'error', 'verified', 'failed'] as const) {
    await replace(page, { kind: 'kyc_before_start', connection, kyc })
    await expect(page.getByRole('heading', { name: 'Bitget 본인 확인' })).toBeVisible()
    if (kyc === 'running') await expect(page.getByRole('button', { name: '확인 중', exact: true })).toBeDisabled()
    if (kyc === 'verified') await expect(page.locator('[data-connection-state]')).toContainText('본인 확인이 끝났습니다.')
  }
  expect(await page.evaluate(() => Reflect.get(window, 'connectionFixture').calls)).toEqual([])
})

test('서비스 callback 완료는 관측 상태를 바꾸지 않고 중복 승인 요청을 막는다', async ({ page }) => {
  await mount(page, states[0].state, true, 'service')
  await page.getByRole('button', { name: 'Bitget에서 승인하기', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Bitget에서 승인하기', exact: true })).toBeDisabled()
  await page.evaluate(() => Reflect.get(window, 'connectionFixture').pending[0].resolve())
  await expect(page.locator('.ccs-feedback')).toHaveText('최신 연결 상태를 확인하고 있습니다.')
  await expect(page.locator('[data-connection-state]')).toHaveAttribute('data-connection-state', 'authorization_result')
  await expect(page.getByRole('button', { name: 'Bitget에서 승인하기', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'connectionFixture').calls)).toEqual([
    { scope: 'owner-a', identity: 'observation-a', source: 'service', action: 'authorize', exchange: 'bitget' },
  ])
})

test('owner 교체·late failure는 이전 observation을 abort하며 새 화면을 오염시키지 않는다', async ({ page }) => {
  await mount(page, states[0].state, true, 'service')
  await page.getByRole('button', { name: 'Bitget에서 승인하기', exact: true }).click()
  await replace(page, { kind: 'not_invited', exchange: 'okx' }, 'owner-b')
  expect(await page.evaluate(() => Reflect.get(window, 'connectionFixture').signals[0].aborted)).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'connectionFixture').pending[0].reject())
  await expect(page.getByRole('heading', { name: 'TETH 초대 계정이 아닙니다' })).toBeVisible()
  await expect(page.locator('.ccs-feedback')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('PRIVATE_CALLBACK_DETAIL')
})

test('KYC close와 disconnect 취소는 관측을 폐기하고 늦은 결과가 후속 실행을 만들지 않는다', async ({ page }) => {
  for (const kind of ['kyc', 'disconnect'] as const) {
    await mount(page, kind === 'kyc' ? { kind: 'kyc_before_start', connection, kyc: 'review' } : { kind: 'disconnect_confirmation', connection }, true, 'service')
    await page.getByRole('button', { name: kind === 'kyc' ? '확인 상태 다시 보기' : '연결 끊기', exact: true }).click()
    await page.getByRole('button', { name: kind === 'kyc' ? '닫기' : '취소', exact: true }).click()
    expect(await page.evaluate(() => Reflect.get(window, 'connectionFixture').signals[0].aborted)).toBe(true)
    await page.evaluate(() => Reflect.get(window, 'connectionFixture').pending[0].resolve())
    await expect(page.getByRole('status')).toHaveText('연결 상태 화면을 닫았습니다.')
    expect(await page.evaluate(() => Reflect.get(window, 'connectionFixture').calls.length)).toBe(1)
    expect(await page.evaluate(() => Reflect.get(window, 'connectionFixture').closeCount)).toBe(1)
  }
})

test('실패는 unknown으로 표시하고 원 오류나 disconnect 성공·목록 삭제를 합성하지 않는다', async ({ page }) => {
  await mount(page, { kind: 'disconnect_confirmation', connection }, true, 'service')
  await page.getByRole('button', { name: '연결 끊기', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'connectionFixture').pending[0].reject())
  await expect(page.locator('.ccs-feedback')).toContainText('처리 결과를 확인하지 못했습니다.')
  await expect(page.locator('[data-connection-state]')).toHaveAttribute('data-connection-state', 'disconnect_confirmation')
  await expect(page.locator('body')).not.toContainText('PRIVATE_CALLBACK_DETAIL')
  await expect(page.getByRole('button', { name: '연결 끊기', exact: true })).toBeDisabled()
})

test('내 거래소는 만료/unknown을 제외하고 삭제된 선택을 전체로 돌리며 Escape로 목록만 닫는다', async ({ page }) => {
  const okx = { ...connection, exchange: 'okx', id: 'connection-okx' } as const
  const unknown = { ...connection, exchange: 'gate', id: 'connection-gate', eligibility: 'unknown' } as const
  await mount(page, { kind: 'eligible_my_exchange_filter', connections: [connection, okx, { ...paid, exchange: 'binance', id: 'connection-expired' }, unknown], selected: 'gate' }, true)
  await page.getByRole('button', { name: '내 거래소', exact: true }).click()
  await expect(page.getByRole('menuitemradio', { name: '연결한 거래소 전체' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('menuitemradio', { name: 'Binance만' })).toHaveCount(0)
  await expect(page.getByRole('menuitemradio', { name: 'Gate만' })).toHaveCount(0)
  await page.getByRole('button', { name: '내 거래소', exact: true }).press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'connectionFixture').closeCount)).toBe(0)
  await replace(page, { kind: 'eligible_my_exchange_filter', connections: [{ ...connection, eligibility: 'unknown' }], selected: 'all' })
  await expect(page.getByRole('button', { name: '내 거래소', exact: true })).toBeDisabled()
  await expect(page.getByRole('status')).toContainText('이용 가능한 연결을 확인할 수 없습니다.')
})

test('unknown source와 owner mismatch는 기존 성공 화면을 남기지 않는다', async ({ page }) => {
  await mount(page, { kind: 'connected_done', connection })
  await page.evaluate(() => { const f = Reflect.get(window, 'connectionFixture'); f.p = { ...f.p, source: 'unknown' }; f.render() })
  await expect(page.getByRole('status')).toHaveText('연결 상태를 확인할 수 없습니다.')
  await expect(page.getByRole('heading', { name: '연결되었습니다' })).toHaveCount(0)
  await page.evaluate(() => { const f = Reflect.get(window, 'connectionFixture'); f.p = { ...f.p, source: 'mock', scope: 'owner-b' }; f.render() })
  await expect(page.getByRole('status')).toHaveText('연결 상태를 확인할 수 없습니다.')
})

test('내 거래소 필터는 원본 최대 세 개·선택별 16px 앱 아이콘과 요청 identity를 보존한다', async ({ page }, info) => {
  const connections: ConnectionStatusRecord[] = ['bitget', 'okx', 'gate', 'binance'].map(exchange => ({
    ...connection, exchange: exchange as ConnectionStatusRecord['exchange'], id: `connection-${exchange}`,
  }))
  const requests: string[] = []
  page.on('request', request => { if (/\/api\/|\/billing|\/orders(?:\?|$)/.test(request.url())) requests.push(request.method()) })
  await mount(page, { kind: 'eligible_my_exchange_filter', connections, selected: 'all' }, true, 'service')
  const trigger = page.getByRole('button', { name: '내 거래소', exact: true })
  const expected = ['bitget.png', 'okx.png', 'gate.jpg'].map(file => `/client-broker-assets/app-${file}`)
  await expect(trigger).toHaveAttribute('aria-pressed', 'true')
  await expect(trigger.locator('img')).toHaveCount(3)
  expect(await trigger.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src')))).toEqual(expected)
  for (const image of await trigger.locator('img').all()) {
    await expect(image).toHaveAttribute('alt', '')
    await expect.poll(() => image.evaluate(element => {
      const image = element as HTMLImageElement, rect = image.getBoundingClientRect()
      return { loaded: image.complete && image.naturalWidth > 0, width: rect.width, height: rect.height }
    })).toEqual({ loaded: true, width: 16, height: 16 })
  }
  const positions = await trigger.locator('img').evaluateAll(images => images.map(image => image.getBoundingClientRect().left))
  expect(positions[1] - positions[0]).toBe(12)
  expect(positions[2] - positions[1]).toBe(12)
  await trigger.click()
  const all = page.getByRole('menuitemradio', { name: '연결한 거래소 전체', exact: true })
  expect(await all.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src')))).toEqual(expected)
  for (const [label, path] of [['Bitget', 'bitget.png'], ['OKX', 'okx.png'], ['Gate', 'gate.jpg'], ['Binance', 'binance.png']]) {
    const item = page.getByRole('menuitemradio', { name: `${label}만`, exact: true })
    await expect(item.locator('img')).toHaveCount(1)
    await expect(item.locator('img')).toHaveAttribute('src', `/client-broker-assets/app-${path}`)
  }
  await expect(page.getByRole('menuitemradio', { name: '끄기, 전체 전략 보기' }).locator('img')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('connection-filter-icons.png') })
  expect(await page.evaluate(() => Reflect.get(window, 'connectionFixture').calls)).toEqual([])
  await page.getByRole('menuitemradio', { name: 'Gate만', exact: true }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  // The callback requests a change; only a new observation may change the label/icons.
  await expect(trigger).toHaveText('내 거래소')
  await expect(trigger.locator('img')).toHaveCount(3)
  expect(await page.evaluate(() => Reflect.get(window, 'connectionFixture').calls)).toEqual([
    { scope: 'owner-a', identity: 'observation-a', source: 'service', action: 'filter', selection: 'gate', exchange: 'gate' },
  ])
  await replace(page, { kind: 'eligible_my_exchange_filter', connections, selected: 'gate' })
  const gateTrigger = page.getByRole('button', { name: 'Gate만', exact: true })
  await expect(gateTrigger).toHaveAttribute('aria-pressed', 'true')
  await expect(gateTrigger.locator('img')).toHaveCount(1)
  await expect(gateTrigger.locator('img')).toHaveAttribute('src', expected[2])
  await replace(page, { kind: 'eligible_my_exchange_filter', connections, selected: 'off' })
  await expect(trigger).toHaveAttribute('aria-pressed', 'false')
  await expect(trigger.locator('img')).toHaveCount(3)
  expect(await trigger.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src')))).toEqual(expected)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(requests).toEqual([])
})

test('내 거래소 아이콘은 만료·unknown 연결을 제외하며 필터 권한을 만들지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await mount(page, { kind: 'eligible_my_exchange_filter', selected: 'all', connections: [
    connection, { ...connection, exchange: 'okx', id: 'connection-okx' },
    { ...paid, exchange: 'gate', id: 'connection-gate' },
    { ...connection, exchange: 'binance', id: 'connection-binance', eligibility: 'unknown' },
  ] })
  const trigger = page.getByRole('button', { name: '내 거래소', exact: true })
  await expect(trigger.locator('img')).toHaveCount(2)
  await trigger.click()
  await expect(page.getByRole('menuitemradio', { name: 'Gate만' })).toHaveCount(0)
  await expect(page.getByRole('menuitemradio', { name: 'Binance만' })).toHaveCount(0)
  for (const item of await page.getByRole('menuitemradio').all()) await expect(item).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'connectionFixture').calls)).toEqual([])
  await replace(page, { kind: 'eligible_my_exchange_filter', connections: [connection], selected: 'bitget' })
  const bitgetTrigger = page.getByRole('button', { name: 'Bitget만', exact: true })
  await expect(bitgetTrigger).toBeDisabled()
  await expect(bitgetTrigger.locator('img')).toHaveCount(1)
  await replace(page, { kind: 'eligible_my_exchange_filter', connections: [paid], selected: 'all' })
  await expect(trigger).toBeDisabled()
  await expect(trigger.locator('img')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

for (const unavailable of ['expired', 'image-error'] as const) test(`내 거래소 ${unavailable} 빈 아이콘 영역은 여백을 남기지 않는다`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  if (unavailable === 'image-error') await page.route('**/client-broker-assets/app-bitget.png', route => route.fulfill({ status: 404, body: '' }))
  await mount(page, { kind: 'eligible_my_exchange_filter', connections: [unavailable === 'expired' ? paid : connection], selected: 'all' })
  const trigger = page.getByRole('button', { name: '내 거래소', exact: true })
  await expect(trigger.locator('img')).toHaveCount(0)
  await expect(trigger.locator('.myex-ic')).toBeHidden()
  await expect(trigger.locator('.myex-ic')).toHaveCSS('display', 'none')
  await expect(trigger).toBeDisabled()
  await expect(trigger).toHaveAttribute('aria-pressed', String(unavailable !== 'expired'))
  expect(await page.evaluate(() => Reflect.get(window, 'connectionFixture').calls)).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
