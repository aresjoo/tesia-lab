import { expect, test, type Page } from '@playwright/test'
import type { SourceUserStrategyRecord } from '../src/client-user-strategy'

// Controller selection only. These local display records grant no account,
// research, billing or order authority and issue no service request.
const first: SourceUserStrategyRecord = { id: '1000', createdAt: 1000, name: '이전에 등록한 연구 A', status: 'ready', environment: 'paper', parameters: null,
  score: 80, ret: 12, mdd: -5, n: 8, winRate: 50, asset: '비트코인', exchangeId: 'binance', exchangeName: 'Binance', capital: 5_000_000, version: 'v1.0' }
const second: SourceUserStrategyRecord = { ...first, id: '2000', createdAt: 2000, name: '나중에 등록한 전략 B', asset: '이더리움', exchangeId: 'okx', exchangeName: 'OKX' }
type SelectionRequest = { id: string; sequence: number }
type Options = { users?: SourceUserStrategyRecord[]; request?: SelectionRequest; owner?: string }

async function mount(page: Page, options: Options = {}) {
  await page.route('**/terminal-selection-request.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div></body></html>' }))
  await page.goto('/terminal-selection-request.html')
  await page.evaluate(async ({ options, first, second }) => {
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem('tethCurrency', 'KRW')
    const refreshPath = '/@react-refresh'
    const refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/components/ClientSourceTerminalWorkspace.tsx', domPath = '/@id/react-dom/client'
    const source = await (await fetch(componentPath)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    const preferencePath = source.match(/from "([^"]*\/client-preferences\.ts[^"]*)"/)?.[1]
    if (!reactPath || !preferencePath) throw new Error('Missing component dependency paths')
    const reactModule = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath)
    const component = await import(/* @vite-ignore */ componentPath), preferences = await import(/* @vite-ignore */ preferencePath)
    const react = reactModule.default ?? reactModule
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    const state = { users: options.users ?? [first, second], request: options.request, owner: options.owner ?? 'owner-a' }
    const render = () => root.render(react.createElement(component.default, {
      key: state.owner, userStrategies: state.users, selectionRequest: state.request,
      onNew: () => {}, onAsk: () => {}, accountDataMode: 'connection-required',
    }))
    Object.assign(window, {
      patchTerminalSelection: (patch: { users?: typeof state.users; request?: typeof state.request; owner?: string }) => { Object.assign(state, patch); render() },
      setTerminalSelectionPreference: preferences.setClientPreference,
    })
    render()
  }, { options, first, second })
  await expect(page.locator('.client-account-terminal')).toBeVisible()
}
async function patch(page: Page, patch: Options) {
  await page.evaluate(value => Reflect.get(window, 'patchTerminalSelection')(value), patch)
}
async function selected(page: Page, id: string) {
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', id)
}
async function manuallySelect(page: Page, id: string) {
  const tabs = page.getByRole('tablist', { name: '터미널 영역', exact: true })
  if (await tabs.isVisible()) await tabs.getByRole('tab', { name: '판단', exact: true }).click()
  await page.locator('.ctt-selector-button').click()
  const button = page.locator(`[data-strategy-id="${id}"] .tft-select`)
  await button.focus()
  await page.keyboard.press('Enter')
  await selected(page, id)
}

test('요청이 없으면 기존 newest 초기 선택을 유지하고 명시 A/B 요청만 정확히 선택한다', async ({ page }) => {
  await mount(page)
  await selected(page, 'user:2000')
  await patch(page, { request: { id: 'user:1000', sequence: 1 } })
  await selected(page, 'user:1000')
  await patch(page, { request: { id: 'user:2000', sequence: 2 } })
  await selected(page, 'user:2000')
})

test('늦게 도착한 entries에서 요청한 A가 newest B보다 우선하며 한번 처리 후 수동 선택을 유지한다', async ({ page }) => {
  await mount(page, { users: [], request: { id: 'user:1000', sequence: 1 } })
  await selected(page, 'demo:d1')
  await patch(page, { users: [first, second] })
  await selected(page, 'user:1000')
  await manuallySelect(page, 'user:2000')
  await patch(page, { users: [{ ...first, name: 'A 표시 이름 변경' }, { ...second, name: 'B 표시 이름 변경' }], request: { id: 'user:1000', sequence: 1 } })
  await selected(page, 'user:2000')
  for (const [key, value] of [['currency', 'USD'], ['language', 'en'], ['currency', 'KRW'], ['language', 'ko']]) {
    await page.evaluate(([key, value]) => Reflect.get(window, 'setTerminalSelectionPreference')(key, value), [key, value])
    await selected(page, 'user:2000')
  }
  // A new sequence is an intentional repeat request, even for the same ID.
  await patch(page, { request: { id: 'user:1000', sequence: 2 } })
  await selected(page, 'user:1000')
})

test('없는 ID는 현재 선택을 바꾸지 않고 새 요청 처리 뒤 entries 갱신에도 이전 요청을 재생하지 않는다', async ({ page }) => {
  const errors: string[] = [], mutations: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(request.url()) })
  await mount(page, { request: { id: 'user:9999', sequence: 1 } })
  await selected(page, 'user:2000')
  await patch(page, { request: { id: 'not-a-strategy', sequence: 2 }, users: [first, second] })
  await selected(page, 'user:2000')
  await patch(page, { request: { id: 'user:1000', sequence: 3 } })
  await selected(page, 'user:1000')
  // Existing new-user arrival behavior selects the new entry; the old pending
  // 9999 request must not supersede a subsequent explicit selection afterward.
  const late = { ...first, id: '9999', createdAt: 9999, name: '늦게 도착한 전략' }
  await patch(page, { users: [first, second, late] })
  await manuallySelect(page, 'user:2000')
  await patch(page, { users: [first, second, late], request: { id: 'user:1000', sequence: 3 } })
  await selected(page, 'user:2000')
  expect(errors).toEqual([])
  expect(mutations).toEqual([])
})

test('처리한 요청을 제거·재전달해도 재생하지 않으며 owner key remount는 새 요청으로 처리한다', async ({ page }) => {
  await mount(page, { request: { id: 'user:1000', sequence: 7 } })
  await selected(page, 'user:1000')
  await manuallySelect(page, 'user:2000')
  await patch(page, { users: [{ ...first, ret: 15 }, second], request: { id: 'user:1000', sequence: 7 } })
  await selected(page, 'user:2000')
  await patch(page, { request: undefined })
  await patch(page, { request: { id: 'user:1000', sequence: 7 } })
  await selected(page, 'user:2000')
  await patch(page, { owner: 'owner-b' })
  await selected(page, 'user:1000')
})
