import { expect, test } from '@playwright/test'
import type { SourceUserStrategyRecord } from '../src/client-user-strategy'

// Explicit independent expectations: do not ask the production dictionary to
// generate the expected plural form or word order for this regression.
const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const dashboard = ['대시보드', 'Dashboard', 'ダッシュボード', '仪表板', '儀表板', 'Panel', 'Tableau de bord']
const headings = ['저장된 검증 결과', 'Saved verification result', '保存された検証結果', '已保存的验证结果', '已儲存的驗證結果', 'Resultado de verificación guardado', 'Résultat de vérification enregistré']
const trades = ['거래 수', 'Number of trades', '取引数', '交易次数', '交易次數', 'Número de operaciones', 'Nombre de transactions']
const assets = ['자산 미확인', 'Assets not confirmed', '資産未確認', '资产未确认', '資產未確認', 'Activos sin confirmar', 'Actifs non confirmés']
const capital = ['투자금 미확인', 'Investment amount not confirmed', '投資金未確認', '投资金额未确认', '投資金額未確認', 'Capital invertido sin confirmar', 'Capital investi non confirmé']
const counts = {
  1: ['1회', '1 time', '1回', '1次', '1次', '1 vez', '1 fois'],
  13: ['13회', '13 times', '13回', '13次', '13次', '13 veces', '13 fois'],
} as const

for (const n of [1, 13] as const) test(`모델 없는 저장 전략 n=${n}: 7언어 횟수·fallback·원문·저장값 보존`, async ({ page, baseURL }) => {
  const forbidden: string[] = [], errors: string[] = [], workers: string[] = [], origin = new URL(baseURL!).origin
  page.on('pageerror', error => errors.push(error.message))
  page.on('worker', worker => workers.push(worker.url()))
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) { forbidden.push(`${request.method()} ${url.pathname}`); return route.abort() }
    return route.continue()
  })
  await page.route('**/missing-record-locale.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#141414;color:white"><div id="fixture"></div></body></html>' }))
  await page.goto('/missing-record-locale.html')
  const record: SourceUserStrategyRecord = { id: '1000', createdAt: 1000, name: '사용자가 지은 한국어 전략 $& <보존>', status: 'ready', environment: 'paper', parameters: null, score: 83, ret: 12.4, mdd: -5.7, n, winRate: 61.5 }
  await page.evaluate(async record => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientSourceTerminalWorkspace.tsx', dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts', sp = '/src/client-user-strategy-store.ts'
    const code = await (await fetch(cp)).text(), rp = code.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw Error('React dependency missing')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp), preferences = await import(/* @vite-ignore */ pp), stores = await import(/* @vite-ignore */ sp)
    for (const skin of ['/src/styles.css', '/src/client-reference.css', '/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css']) await import(/* @vite-ignore */ skin)
    const key = stores.clientUserStrategyKey('missing-record-localization-fixture')
    const stored = JSON.stringify([{ sessionId: 'saved-local-preview', record }])
    sessionStorage.setItem(key, stored)
    const store = stores.createClientUserStrategyStore('missing-record-localization-fixture')
    if (store.getSnapshot().storageError) throw Error('Fixture failed source record decoder')
    const records = Object.freeze(store.getSnapshot().entries.map((entry: { record: object }) => entry.record))
    const calls: unknown[] = [], React = rm.default ?? rm, root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    preferences.setClientPreference('language', 'ko')
    Object.assign(window, { missingRecordLocale: { key, stored, store, records, calls, language: (language: string) => preferences.setClientPreference('language', language) } })
    root.render(React.createElement(component.default, {
      userStrategies: records, includeSamples: false, accountDataMode: 'connection-required',
      onNew: () => calls.push('new'), onAsk: (value: string) => calls.push(['ask', value]),
      onUserStatus: (id: string, status: string) => calls.push(['status', id, status]),
      onAccountNavigate: (hash: string) => calls.push(['navigate', hash]), onConnectExchange: () => calls.push('connect'),
    }))
  }, record)
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1000')
  const stored = await page.evaluate(() => Reflect.get(window, 'missingRecordLocale').stored)
  for (const [index, language] of languages.entries()) {
    await page.evaluate(language => Reflect.get(window, 'missingRecordLocale').language(language), language)
    const detail = page.locator('.ctt-main-tabs [id$="-tab-detail"]')
    if (await detail.isVisible()) await detail.click()
    const button = page.locator('.cat-tabs [role="tab"]').nth(1)
    await expect(button).toHaveText(dashboard[index])
    await button.click()
    const panel = page.locator('[data-analysis-tab="dashboard"]')
    await expect(panel).toBeVisible()
    await expect(panel.locator('h3')).toHaveText(headings[index])
    const rows = panel.locator('.cst-matrix > div')
    await expect(rows).toHaveCount(5)
    await expect(rows.nth(3).locator('dt')).toHaveText(trades[index])
    await expect(rows.nth(3).locator('dd')).toHaveText(counts[n][index])
    await expect(panel.locator('dd')).toHaveText(['83', '+12.4%', '-5.7%', counts[n][index], '61.5%'])
    if (language !== 'ko') expect(await panel.innerText()).not.toMatch(/[가-힣\uFFFD]/)
    await expect(page.locator('.cat-brain > header > b')).toHaveText(record.name)
    await expect(page.locator('.cat-brain-meta')).toContainText(assets[index])
    await expect(page.locator('.cat-brain-meta')).toContainText(capital[index])
    await expect(page.locator('canvas, .cst-close-chart, .cp-surface')).toHaveCount(0)
    await expect(page.locator('[data-agent-event], [data-watch-event], [data-rule-event], [data-agent-operation]')).toHaveCount(0)
    const observed = await page.evaluate(() => {
      const f = Reflect.get(window, 'missingRecordLocale')
      return { records: f.records, restored: f.store.getSnapshot().entries.map((entry: { record: object }) => entry.record), stored: sessionStorage.getItem(f.key), calls: f.calls }
    })
    expect(observed.records).toEqual([record]); expect(observed.restored).toEqual([record])
    expect(observed.stored).toBe(stored); expect(observed.calls).toEqual([])
    await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1000')
  }
  expect(errors).toEqual([]); expect(forbidden).toEqual([]); expect(workers).toEqual([])
})
