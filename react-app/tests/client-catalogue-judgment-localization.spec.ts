import { expect, test } from '@playwright/test'
import { catalogueStrategies } from '../src/client-catalogue'
import { CatalogueMarketData } from '../src/client-catalogue-market-data'
import { computeCatalogueBacktest } from '../src/client-catalogue-backtest-result'
import { catalogueTerminalModel, splitCatalogueThought } from '../src/client-catalogue-terminal'
import { catalogueJudgmentLocale } from '../src/client-catalogue-judgment-locale-copy'
import type { ClientLanguage } from '../src/client-preferences'
import dictionary from '../src/client-catalogue-judgment-locale-copy.json' with { type: 'json' }
import spot from '../src/client-catalogue-spot-data.json' with { type: 'json' }
import futures from '../src/client-catalogue-futures-data.json' with { type: 'json' }

const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const market = new CatalogueMarketData(spot, futures)
const numbers = (text: string) => [...text.matchAll(/[+-]?\d+(?:,\d{3})*(?:\.\d+)?/g)].map(v => v[0]).sort()
const freeze = (value: object) => { Object.values(value).forEach(v => { if (v && typeof v === 'object') freeze(v) }); Object.freeze(value) }

test('31×4 고정 결과: 7언어 완전성·숫자·KO 경계·입력 불변', () => {
  expect(Object.keys(dictionary)).toHaveLength(400)
  for (const [source, rows] of Object.entries(dictionary)) {
    expect(rows).toHaveLength(7); expect(rows[0]).toBe(source)
    for (const text of rows.slice(1)) {
      expect(text.trim()).not.toBe(''); expect(text).not.toMatch(/[가-힣\uFFFD]/)
      expect(text.match(/\{n\d+\}/g)?.sort() ?? []).toEqual(source.match(/\{n\d+\}/g)?.sort() ?? [])
      expect(text.replace(/\{n\d+\}/g, '')).not.toMatch(/\d/)
    }
  }
  for (const strategy of catalogueStrategies) for (const period of [0, 90, 365, 730] as const) {
    const value = computeCatalogueBacktest({ owner: 'judgment-locale-test', strategyId: strategy.id, period, amount: 1000 }, market)
    const before = JSON.stringify(value), source = catalogueTerminalModel(value, 'ko')
    freeze(value)
    for (const language of languages) {
      const translated = catalogueJudgmentLocale(value, language)
      for (const [original, display] of [[source.headline, translated.headline], [source.rule, translated.rule], ...source.holdings.map((p, i) => [p.asset, translated.assets[i]])] as const) {
        expect(display.translated, `${strategy.id}/${period}/${language}/${original}`).toBe(true)
        expect(numbers(display.text)).toEqual(numbers(original))
        if (language === 'ko') expect(display.text).toBe(original)
        else expect(display.text).not.toMatch(/[가-힣\uFFFD]/)
      }
      expect(translated.history).toHaveLength(source.history.length)
      for (const [i, original] of [source.thought, ...source.history.map(m => m.t)].entries()) {
        const display = i === 0 ? translated.thought : translated.history[i - 1]
        expect(display.translated, `${strategy.id}/${period}/${language}/${original}`).toBe(true)
        expect(numbers(`${display.head} ${display.rest}`)).toEqual(numbers(original))
        if (language === 'ko') expect({ head: display.head, rest: display.rest }).toEqual(splitCatalogueThought(original))
        else expect(`${display.head} ${display.rest}`).not.toMatch(/[가-힣\uFFFD]/)
      }
    }
    expect(JSON.stringify(value)).toBe(before)
  }
})

test('미등록·실서비스·작성자 원문은 번역 완료로 위장하지 않는다', () => {
  const value = computeCatalogueBacktest({ owner: 'judgment-locale-test', strategyId: 'd1', period: 730, amount: 1000 }, market)
  const unknown = structuredClone(value)
  const now = unknown.judgments!.find(m => m.k === 'now')!
  now.t = '사용자가 쓴 설명 12.34%입니다. 서버 원문을 마음대로 바꾸지 않습니다.'
  for (const language of languages.slice(1)) {
    const result = catalogueJudgmentLocale(unknown, language)
    expect(result.thought.translated).toBe(false); expect(result.thought.language).toBe('ko')
    expect(result.thought.rest).toBe(now.t)
    const foreignSource = catalogueJudgmentLocale({ ...value, sourceSha: 'unapproved-source' }, language)
    expect(foreignSource.thought.translated).toBe(false)
    const authored = catalogueJudgmentLocale({ ...value, strategy: { ...value.strategy, name: '작성자 전략 $& <원본>' } }, language)
    expect(authored.title).toBe('작성자 전략 $& <원본>'); expect(authored.thought.translated).toBe(false)
  }
})

test('실제 판단 뷰: 언어 전환은 펼침·날짜·숫자·콜백·원본 결과를 보존한다', async ({ page, baseURL }, info) => {
  const forbidden: string[] = [], errors: string[] = [], origin = new URL(baseURL!).origin
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) { forbidden.push(`${request.method()} ${url.pathname}`); return route.abort() }
    return route.continue()
  })
  await page.route('**/judgment-localization.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#141414"><div id="tesia-main" style="max-width:520px;margin:auto"><div id="fixture" class="client-terminal-copies has-catalogue-judgment"></div></div></body></html>' }))
  await page.goto('/judgment-localization.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientCatalogueTerminalJudgment.tsx', dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts', ep = '/src/client-catalogue-backtest-result.ts', mp = '/src/client-catalogue-market-data.ts'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw Error('React import missing')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp), preferences = await import(/* @vite-ignore */ pp), engine = await import(/* @vite-ignore */ ep), market = await import(/* @vite-ignore */ mp)
    for (const skin of ['/src/styles.css', '/src/client-reference.css', '/src/client-terminal-copies.css', '/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css']) await import(/* @vite-ignore */ skin)
    const data = await market.loadCatalogueMarketData(), value = engine.computeCatalogueBacktest({ owner: 'judgment-locale-test', strategyId: 'd1', period: 730, amount: 1000 }, data)
    const calls: unknown[] = [], record = { id: 'source-copy-d1', status: 'active', binding: { strategyId: 'd1' } }, entry = { record }
    const account = { owner: 'judgment-locale-test', state: { copies: [entry, { record: { ...record, id: 'source-copy-f1', binding: { strategyId: 'f1' } } }] } }
    const freeze = (value: object) => { Object.values(value).forEach(v => { if (v && typeof v === 'object') freeze(v) }); Object.freeze(value) }
    freeze(value); freeze(account)
    preferences.setClientPreference('language', 'ko')
    const root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture')), React = rm.default ?? rm
    Object.assign(window, { judgmentFixture: { value, calls, locale: (l: string) => preferences.setClientPreference('language', l) } })
    root.render(React.createElement(component.ClientCatalogueTerminalJudgmentView, { account, selectedId: record.id, onSelect: (id: string) => calls.push(['select', id]), inspection: { state: 'ready', data: { entry, value }, retry: () => calls.push(['retry']) }, onManage: (id: string) => calls.push(['manage', id]), onFind: () => calls.push(['find']) }))
  })
  await expect(page.locator('.cctj-body')).toBeVisible()
  const original = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'judgmentFixture').value))
  await page.locator('.cctj-thought button').click()
  const detail = page.locator('.cctj-feed details').first()
  await detail.locator('summary').click()
  const element = await detail.elementHandle(), thought = await page.locator('.cctj-thought').elementHandle()
  const dates = await page.locator('.cctj-feed time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime')))
  for (const language of languages) {
    await page.evaluate(language => Reflect.get(window, 'judgmentFixture').locale(language), language)
    await expect(page.locator('.cctj-thought p')).toHaveAttribute('lang', language)
    await expect(page.locator('.cctj-thought button')).toHaveAttribute('aria-expanded', 'true')
    expect(await element!.evaluate(node => node.isConnected && node.hasAttribute('open'))).toBe(true)
    expect(await thought!.evaluate(node => node.isConnected)).toBe(true)
    expect(await page.locator('.cctj-feed time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime')))).toEqual(dates)
    if (language !== 'ko') expect(await page.locator('.cctj').innerText()).not.toMatch(/[가-힣\uFFFD]/)
    expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'judgmentFixture').value))).toBe(original)
    expect(await page.evaluate(() => Reflect.get(window, 'judgmentFixture').calls)).toEqual([])
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`judgment-${language}.png`), fullPage: true })
  }
  await page.locator('.cctj-manage').click()
  await page.locator('.cctj-body footer .cctj-link').click()
  await page.locator('.cctj-selector button').nth(1).click()
  expect(await page.evaluate(() => Reflect.get(window, 'judgmentFixture').calls)).toEqual([['manage', 'source-copy-d1'], ['find'], ['select', 'source-copy-f1']])
  expect(errors).toEqual([]); expect(forbidden).toEqual([])
})
