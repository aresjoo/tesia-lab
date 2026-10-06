import { expect, test } from '@playwright/test'
import type { InlineBacktestRecord } from '../src/client-inline-backtest'

const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
// Independent literal decimal expectations; no production formatter/dictionary oracle.
const cases = [
  { rsi: 42.5, sl: -2.5, tp: 0.125, dot: ['42.5', '-2.5', '+0.125', '25'], comma: ['42,5', '-2,5', '+0,125', '25'] },
  { rsi: 42.125, sl: -0.125, tp: 2.5, dot: ['42.125', '-0.125', '+2.5', '25'], comma: ['42,125', '-0,125', '+2,5', '25'] },
] as const

for (const fixture of cases) test(`inline conditions keep decimals: RSI ${fixture.rsi}, SL ${fixture.sl}, TP ${fixture.tp}`, async ({ page, baseURL }) => {
  const errors: string[] = [], forbidden: string[] = [], origin = new URL(baseURL!).origin
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      forbidden.push(`${request.method()} ${url.pathname}`); return route.abort()
    }
    return route.continue()
  })
  await page.route('**/inline-condition-localization.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#141414;color:white"><div id="fixture"></div></body></html>' }))
  await page.goto('/inline-condition-localization.html')
  const record: InlineBacktestRecord = { turnId: 'condition-display-fixture', ordinal: 1, completedAt: 1000, pair: 'BTC/USDT', timeframe: '1시간봉', parameters: { rsiTh: fixture.rsi, sl: fixture.sl, tp: fixture.tp, trendFilter: false, startI: 61, endI: 160 } }
  await page.evaluate(async record => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientInlineBacktest.tsx', dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts', ip = '/src/client-inline-backtest.ts', ep = '/src/client-delegation-engine.ts'
    const code = await (await fetch(cp)).text(), rp = code.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw Error('React dependency missing')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp), prefs = await import(/* @vite-ignore */ pp), inputs = await import(/* @vite-ignore */ ip), engine = await import(/* @vite-ignore */ ep)
    const decoded = inputs.decodeInlineInput(record)
    if (!decoded || Object.entries(record.parameters).some(([key, value]) => decoded.parameters[key] !== value)) throw Error('Fixture not accepted unchanged by inline decoder')
    Object.freeze(record.parameters); Object.freeze(record)
    const evaluated = JSON.stringify(engine.evaluateDelegation(record.parameters, 5_000_000)), calls: string[] = []
    const React = rm.default ?? rm, root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    prefs.setClientPreference('language', 'ko')
    Object.assign(window, { inlineCondition: { record, evaluated, calls, language: (locale: string) => prefs.setClientPreference('language', locale), evaluate: () => JSON.stringify(engine.evaluateDelegation(record.parameters, 5_000_000)) } })
    root.render(React.createElement(component.ClientInlineBacktest, { record, active: true, canConnect: false, onRecommend: () => calls.push('recommend'), onEdit: () => calls.push('edit'), onPlan: () => calls.push('plan'), onConnect: () => calls.push('connect') }))
  }, record)
  await page.locator('.client-inline-backtest details > summary').click()
  const details = await page.locator('.client-inline-backtest details').elementHandle()
  for (const locale of locales) {
    await page.evaluate(locale => Reflect.get(window, 'inlineCondition').language(locale), locale)
    // Wait for the selected language, not a fixed sleep or dictionary-generated expectation.
    const prefixes = { ko: '진입:', en: 'Entry:', ja: 'エントリー', 'zh-CN': '入场', 'zh-TW': '進場', es: 'Entrada:', fr: 'Entrée' }
    const entry = page.locator('.client-inline-backtest .dt2 p').nth(1), exit = page.locator('.client-inline-backtest .dt2 p').nth(2)
    await expect(entry).toContainText(prefixes[locale])
    const expected = locale === 'es' || locale === 'fr' ? fixture.comma : fixture.dot
    expect.soft((await entry.innerText()).match(/[+-]?\d+(?:[.,]\d+)?/g), `${locale} exact RSI`).toEqual([expected[0]])
    expect.soft((await exit.innerText()).match(/[+-]?\d+(?:[.,]\d+)?/g), `${locale} exact stop/target/holding`).toEqual(expected.slice(1))
    if (locale !== 'ko') expect.soft(await entry.innerText() + await exit.innerText()).not.toMatch(/[가-힣\uFFFD]/)
    expect(await details!.evaluate(node => node.isConnected && (node as HTMLDetailsElement).open)).toBe(true)
    const observed = await page.evaluate(() => { const f = Reflect.get(window, 'inlineCondition'); return { record: f.record, unchangedEvaluation: f.evaluated === f.evaluate(), calls: f.calls } })
    expect(observed.record).toEqual(record); expect(observed.unchangedEvaluation).toBe(true); expect(observed.calls).toEqual([])
  }
  expect(errors).toEqual([]); expect(forbidden).toEqual([])
})
