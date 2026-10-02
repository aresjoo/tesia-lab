import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { expect, test, type Page } from '@playwright/test'

async function mount(page: Page, supplied = true) {
  await page.route('**/broker-view-audit.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="fixture"></div></body></html>' }))
  await page.goto('/broker-view-audit.html')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(async supplied => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/internal-poc/ClientServiceExperience.tsx', source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React')
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, dp = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */dp)
    const { ClientServiceExperience: Shell } = await import(/* @vite-ignore */path), pp = '/src/client-preferences.ts'
    const preferences = await import(/* @vite-ignore */pp); preferences.setClientPreference('language', 'ko')
    const h = React.createElement
    function Host() {
      const [owner, setOwner] = React.useState('owner-a'), [identity, setIdentity] = React.useState('data-a'), [available, setAvailable] = React.useState(supplied), [revision, setRevision] = React.useState(0), [ties, setTies] = React.useState(false)
      Object.assign(window, { brokerViewOwner: setOwner, brokerViewIdentity: setIdentity, brokerViewSupply: setAvailable, brokerViewRefresh: () => setRevision((n: number) => n + 1), brokerViewLocale: (value: string) => preferences.setClientPreference('language', value), brokerViewTies: () => setTies(true) })
      const broker = { id: 'binance', name: 'Broker View', ord: 1, tag: '거래소', assets: 'BTC', assetsList: ['BTC'], conn: true, rating: 5, traders: '12', fw0: 0, rvN: 36, col: '#aabbee', fg: '#111111', site: 'example.com', about: `supplied-${revision}` }
      return h(Shell, { nativeAccounts: true, accountScope: owner,
        brokerPresentation: available ? { scope: owner, identity, catalog: ties ? ['A', 'B', 'C'].map((name, index) => ({ broker: { ...broker, id: `tie-${name}`, name, ord: index + 1, rating: index === 2 ? 5 : 4, rvN: index === 0 ? 10 : 20, traderN: 10 }, reviews: [], connectionState: 'CONNECTED' })) : [{ broker, connectionState: 'CONNECTED', reviews: Array.from({ length: 36 }, (_, i) => ({ id: i, rating: 5, text: `확인된 후기 ${i + 1}`, author: `작성자 ${i}`, date: '공급 날짜', categories: ['고객 지원'] })) }] } : undefined,
        state: { phase: 'ready', sessionState: 'AUTHENTICATED', messages: [{ id: 'one', role: 'user', text: '기존 대화' }], input: '', busy: false, inputDisabled: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
          onInput: () => {}, onSend: async () => {}, onReset: async () => {}, onRecover: undefined, onLogout: undefined } })
    }
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')).render(h(React.StrictMode, null, h(Host)))
  }, supplied)
  await expect(page.locator('.g-thread')).toBeVisible()
  await open(page)
}
async function open(page: Page) {
  const item = page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'brokers'), exact: true })
  if ((page.viewportSize()?.width ?? 1440) <= 860) await page.locator('.client-hamburger:visible').click()
  await item.click()
  await expect(page.locator('.native-brokers .bk2-hero')).toBeVisible()
}
async function choose(page: Page, label: string, value: string) {
  await page.getByRole('button', { name: new RegExp(`^${label}:`) }).click()
  await page.getByRole('option', { name: value, exact: true }).click()
}
async function returnToConversation(page: Page) {
  await page.locator('.native-brokers .hub-header button').click()
  await expect(page.locator('.native-brokers')).toHaveCount(0)
}
async function detail(page: Page) { await page.locator('.bk2-card .obtn').first().click(); await expect(page.locator('[data-tab=overview]')).toHaveAttribute('aria-selected', 'true') }
async function selections(page: Page) {
  await page.locator('.bk2-bar .fp').filter({ hasText: /^연결 지원$/ }).click()
  await choose(page, '거래소 정렬', '최고 평점')
  await detail(page); await page.locator('[data-tab=reviews]').click()
  await page.locator('.bk2-cats button').filter({ hasText: /^고객 지원$/ }).click()
  await choose(page, '리뷰 정렬', '최신순')
  await page.locator('.bk2-pg').getByRole('button', { name: '다음 페이지', exact: true }).click()
}
async function expectSelections(page: Page) {
  await expect(page.locator('.bk2-bar .fp.on')).toHaveText('연결 지원')
  await expect(page.getByRole('button', { name: /^거래소 정렬:/ })).toContainText('최고 평점')
  await detail(page); await page.locator('[data-tab=reviews]').click()
  await expect(page.locator('.bk2-cats .on')).toHaveText('고객 지원')
  await expect(page.getByRole('button', { name: /^리뷰 정렬:/ })).toContainText('최신순')
  await expect(page.locator('.bk2-pg [aria-current=page]')).toHaveText('2')
}

test('실제 서비스 셸 대화 왕복과 sidebar 목록 재진입은 목록/후기 선택을 보존한다', async ({ page }) => {
  await mount(page); await selections(page)
  await returnToConversation(page); await open(page); await expectSelections(page)
  await page.locator('.bk2-bc button').click(); await expectSelections(page)
  await returnToConversation(page); await page.evaluate(() => Reflect.get(window, 'brokerViewRefresh')()); await open(page); await expectSelections(page)
})

test('owner/dataset 교체 및 공급소멸은 과거 선택을 폐기하고 최초 미공급 필터는 왕복 보존한다', async ({ page }) => {
  await mount(page)
  for (const [action, value] of [['brokerViewOwner', 'owner-b'], ['brokerViewIdentity', 'data-b'], ['brokerViewSupply', false]] as const) {
    await selections(page); await returnToConversation(page)
    await page.evaluate(([action, value]: [string, string | boolean]) => Reflect.get(window, action)(value), [action, value] as [string, string | boolean])
    await open(page)
    await expect(page.locator('.bk2-bar .fp.on')).toHaveText('전체')
    await expect(page.getByRole('button', { name: /^거래소 정렬:/ })).toContainText('기본 순서')
  }
  await page.locator('.bk2-bar .fp').filter({ hasText: /^증권사$/ }).click()
  await returnToConversation(page); await open(page)
  await expect(page.locator('.bk2-bar .fp.on')).toHaveText('증권사')
  await expect(page.locator('.native-brokers')).not.toContainText('supplied-')
})

test('최초 미공급의 비민감 필터·7언어·320px·키보드 왕복은 저장소 없이 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await mount(page, false)
  const storage = () => page.evaluate(() => ({ local: Object.keys(localStorage).filter(k => /broker/i.test(k)), session: Object.keys(sessionStorage).filter(k => /broker/i.test(k)) }))
  const before = await storage()
  await page.locator('.bk2-bar .fp').nth(2).focus(); await page.keyboard.press('Enter')
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(value => Reflect.get(window, 'brokerViewLocale')(value), language)
    await expect(page.locator('.bk2-bar .fp').nth(2)).toHaveAttribute('aria-pressed', 'true')
    await returnToConversation(page)
    await page.evaluate(() => Reflect.get(window, 'brokerViewLocale')('ko')); await open(page)
    await expect(page.locator('.bk2-bar .fp').nth(2)).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  expect(await storage()).toEqual(before)
})

test('공급된 목록 정렬의 동률은 원본 평점/리뷰수 2차키로 해소한다', async ({ page }) => {
  await mount(page); await page.evaluate(() => Reflect.get(window, 'brokerViewTies')())
  await expect(page.locator('.bk2-card .nm')).toHaveText(['A', 'B', 'C'])
  await choose(page, '거래소 정렬', '최고 평점')
  await expect(page.locator('.bk2-card .nm')).toHaveText(['C', 'B', 'A'])
  await choose(page, '거래소 정렬', '최다 리뷰')
  await expect(page.locator('.bk2-card .nm')).toHaveText(['C', 'B', 'A'])
  await choose(page, '거래소 정렬', '최다 사용자')
  await expect(page.locator('.bk2-card .nm')).toHaveText(['C', 'A', 'B'])
})
