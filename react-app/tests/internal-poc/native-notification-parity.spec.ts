import { expect, test, type Page } from '@playwright/test'
import ts from 'typescript'
import { resolve } from 'node:path'
import type { NativeAccountAlertsView } from '../../src/internal-poc/native-account-presentation'

test('알림 표시 타입은 명시적인 move 배지를 공급할 수 있다', () => {
  const file = resolve(process.cwd(), '.notification-type-probe.ts')
  const source = "import type { NativeAccountNotification } from './src/internal-poc/native-account-presentation'; const row: NativeAccountNotification = { id:'one', type:'pos', title:'Observed', timeLabel:'NOW', read:false, move:{label:'+0.00231 BTC',tone:'gain'} }; void row;"
  const options: ts.CompilerOptions = { noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  const host = ts.createCompilerHost(options), original = host.getSourceFile.bind(host)
  host.getSourceFile = (name, version, onError, create) => resolve(name) === file ? ts.createSourceFile(name, source, version, true) : original(name, version, onError, create)
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([file], options, host)).filter(item => item.file?.fileName === file).map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n'))
  expect(diagnostics).toEqual([])
})

async function mount(page: Page) {
  await page.route('**/notification-parity.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="fixture" style="height:100dvh"></div></body></html>' }))
  await page.goto('/notification-parity.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const font = '/node_modules/@fontsource-variable/noto-sans-kr/wght.css'; await import(/* @vite-ignore */font)
    document.body.style.fontFamily = '"Noto Sans KR Variable", sans-serif'
    const path = '/src/internal-poc/NativeTradingWorkspace.tsx', account = '/src/internal-poc/NativeAccountPlan.tsx', pp = '/src/client-preferences.ts'
    const source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React')
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, dp = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */dp), { NativeTradingWorkspace } = await import(/* @vite-ignore */path), { NativeAccountPlan } = await import(/* @vite-ignore */account)
    ;(await import(/* @vite-ignore */pp)).setClientPreference('language', 'ko')
    const h = React.createElement, calls: string[] = []
    function Host() {
      const [owner, setOwner] = React.useState('owner-a'), [identity, setIdentity] = React.useState('dataset-a'), [rowsRevision, setRowsRevision] = React.useState(0)
      const [route, setRoute] = React.useState(null), [view, setView] = React.useState(null as NativeAccountAlertsView | null), [supplied, setSupplied] = React.useState(true)
      const data = supplied ? { scope: owner, identity, sourceLabel: 'SUPPLIED ALERT TEST DATA', accounts: null, strategies: null, ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null }, notifications: [
        { id: 'pos-a', type: 'pos', title: '제목의 +99%를 배지로 추론하지 않습니다', timeLabel: '공급 시각', read: !!rowsRevision, move: { label: '-0.001270 BTC', tone: 'loss' } },
        { id: 'bot-a', type: 'bot', title: '공급된 전략 알림', timeLabel: '공급 시각', read: false, move: { label: '+0.023100 BTC', tone: 'gain' } },
        { id: 'review-a', type: 'review', title: '공급된 복기 알림', timeLabel: '공급 시각', read: true },
        { id: 'rebate-a', type: 'rebate', title: '제목의 +₩9,999도 계산하지 않습니다', timeLabel: '공급 시각', read: true },
        ...(rowsRevision ? [{ id: 'review-b', type: 'review', title: '새 공급 복기', timeLabel: '공급 시각', read: false }] : []),
      ], actions: { onRead: async (id: string) => { calls.push(id) }, onReadAll: async () => { calls.push('all') } } } : undefined
      const boundView = view?.scope === owner && view?.identity === data?.identity ? view : undefined
      if (view && !boundView) setView(null)
      Object.assign(window, { notificationSetOwner: setOwner, notificationSetIdentity: setIdentity, notificationUpdateRows: () => setRowsRevision((value: number) => value + 1), notificationSupply: setSupplied, notificationCalls: calls })
      // Match the actual shell: terminal is unmounted while account settings open.
      return route ? h(NativeAccountPlan, { accountScope: owner, presentation: data, location: route, onReturn: () => setRoute(null), onNavigate: setRoute })
        : h(NativeTradingWorkspace, { accountScope: owner, presentation: data, alertsRequest: 1, alertsView: boundView, onAlertsViewChange: setView, onNavigate: setRoute, onReturn: () => {}, onNew: () => {} })
    }
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  })
  await expect(page.locator('[data-native-account-alerts]')).toBeVisible()
}
const alerts = (page: Page) => page.locator('[data-native-account-alerts]')
const filter = (page: Page, name: RegExp) => alerts(page).getByRole('group').getByRole('button', { name })

test('명시 숫자배지는 정확히 표시하고 제목의 숫자에서는 배지를 만들지 않는다', async ({ page }) => {
  await mount(page)
  await expect(alerts(page).locator('.mv')).toHaveText(['-0.001270 BTC', '+0.023100 BTC'])
  await expect(alerts(page).locator('.mv.dn')).toHaveText('-0.001270 BTC')
  await expect(alerts(page).locator('.mv.up')).toHaveText('+0.023100 BTC')
  await filter(page, /^정산/).click()
  await expect(alerts(page).locator('.mv')).toHaveCount(0)
  await expect(alerts(page).locator('.nf-item')).toHaveCount(1)
})

test('원본 NF_TAB처럼 알림 설정 왕복 후 선택 분류를 유지한다', async ({ page }) => {
  await mount(page); await filter(page, /^거래복기/).click()
  await alerts(page).getByRole('button', { name: '수신 설정', exact: true }).click()
  await expect(page.locator('.native-service-plan')).toBeVisible()
  await page.locator('.native-plan-return').getByRole('button').click()
  await expect(filter(page, /^거래복기/)).toHaveAttribute('aria-pressed', 'true')
  await expect(alerts(page).locator('.nf-item')).toHaveCount(1)
})

test('일반 row갱신은 분류를 유지하지만 owner·dataset·미공급 전환은 폐기한다', async ({ page }) => {
  await mount(page); await filter(page, /^거래복기/).click()
  await page.evaluate(() => Reflect.get(window, 'notificationUpdateRows')())
  await expect(filter(page, /^거래복기/)).toHaveAttribute('aria-pressed', 'true')
  await expect(alerts(page).locator('.nf-item')).toHaveCount(2)
  await page.evaluate(() => Reflect.get(window, 'notificationSetOwner')('owner-b'))
  await expect(filter(page, /^전체/)).toHaveAttribute('aria-pressed', 'true')
  await filter(page, /^전략/).click()
  await page.evaluate(() => Reflect.get(window, 'notificationSetIdentity')('dataset-b'))
  await expect(filter(page, /^전체/)).toHaveAttribute('aria-pressed', 'true')
  await filter(page, /^전략/).click()
  await page.evaluate(() => Reflect.get(window, 'notificationSupply')(false))
  await expect(alerts(page).locator('.nf-item')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'notificationSupply')(true))
  await expect(filter(page, /^전체/)).toHaveAttribute('aria-pressed', 'true')
})

test('7언어 변경과 320px에서도 필터·badge 값을 그대로 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page)
  await filter(page, /^포지션/).click()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */path)).setClientPreference('language', language) }, language)
    await expect(alerts(page).getByRole('group').getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(alerts(page).locator('.mv')).toHaveText(['-0.001270 BTC', '+0.023100 BTC'])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('notification-320-fr.png'), fullPage: true })
})
