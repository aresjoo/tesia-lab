import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import dictionary from '../src/client-terminal-chart-locale-copy.json' with { type: 'json' }

const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const

test('차트 기본 문구 5개는 7언어이며 source-only 소비가 명시되어 있다', () => {
  expect(Object.keys(dictionary)).toHaveLength(5)
  for (const [source, rows] of Object.entries(dictionary)) {
    expect(rows).toHaveLength(7); expect(rows[0]).toBe(source)
    for (const translated of rows.slice(1)) { expect(translated.trim()).not.toBe(''); expect(translated).not.toMatch(/[가-힣\uFFFD]/) }
  }
  const workspace = readFileSync('src/components/ClientSourceTerminalWorkspace.tsx', 'utf8')
  expect(workspace).toContain('entered && sourceActionLogLocaleText(language, entered.txt)')
  expect(workspace).toContain('exited && sourceActionLogLocaleText(language, exited.txt)')
  expect(workspace).toContain('displayText={text => sourceActionLogLocaleText(language, text)}')
})

test('7언어: 캔버스·선택·판단 펼침·원시입력 보존, 실제 caller 문구는 기본값 그대로', async ({ page, baseURL }, info) => {
  const forbidden: string[] = [], errors: string[] = [], origin = new URL(baseURL!).origin
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => { const r = route.request(), url = new URL(r.url()); if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(r.method())) { forbidden.push(`${r.method()} ${url.pathname}`); return route.abort() } return route.continue() })
  await page.route('**/terminal-chart-localization.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#141414;color:#eee"><div id="fixture" style="max-width:720px;margin:auto"></div></body></html>' }))
  await page.goto('/terminal-chart-localization.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientSourceCloseChart.tsx', fp = '/src/components/ClientAgentFeed.tsx', bp = '/src/components/ClientCatalogueTerminalBinding.tsx', dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts', lp = '/src/client-user-strategy-locale-copy.ts', sp = '/src/client-terminal-source-fixture.ts', vp = '/src/client-terminal-source-view.ts', ep = '/src/client-catalogue-backtest-result.ts', mp = '/src/client-catalogue-market-data.ts'
    const code = await (await fetch(cp)).text(), rp = code.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw Error('React import missing')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), chart = await import(/* @vite-ignore */ cp), feed = await import(/* @vite-ignore */ fp), binding = await import(/* @vite-ignore */ bp), prefs = await import(/* @vite-ignore */ pp), copy = await import(/* @vite-ignore */ lp), source = await import(/* @vite-ignore */ sp), view = await import(/* @vite-ignore */ vp), engine = await import(/* @vite-ignore */ ep), market = await import(/* @vite-ignore */ mp)
    for (const skin of ['/src/styles.css', '/src/client-reference.css', '/src/client-source-terminal.css', '/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css']) await import(/* @vite-ignore */ skin)
    const React = rm.default ?? rm, h = React.createElement, root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    const originals = source.sourceTerminalSeeds.map((seed: { parameters: object; capital: number }) => source.evaluateSourceTerminal(seed.parameters, seed.capital))
    const texts = [...new Set(originals.flatMap((r: { L: { evs: { txt: string }[] } }) => r.L.evs.map(e => e.txt)))]
    const entryText = '진입 조건 충족: 전봉 RSI 17.3 < 임계 30, 반등 +1.05%'
    const check = { barIndex: 20, rows: [{ label: 'caller rule', value: '17.3', state: 'ok' }], outputs: [], provenance: 'caller provenance' }
    const events = [{ id: 'entry-1', type: 'entry', timeLabel: '2026-09-01', text: entryText }]
    const journal = [{ ...events[0], id: 'journal-1', ruleCheck: check }]
    const watch = [{ id: 'watch-2', type: 'watch', timeLabel: '2026-09-02', text: '조건 미충족: 전봉 RSI 36.4 ≥ 임계 30' }, { id: 'watch-1', type: 'watch', timeLabel: '2026-09-01', text: '사용자 판단 원문 91.2%' }]
    const watchJournal = watch.map(event => ({ ...event, ruleCheck: check }))
    const caller = [{ ...journal[0], id: 'caller-1', summary: '서버 요약 원문 91.2%', text: entryText }]
    const points = view.sourceChartPoints, markers = [{ id: 'mark-1', time: points[50].time, side: 'BUY' }]
    const value = engine.computeCatalogueBacktest({ owner: 'display-only-fixture', strategyId: 'd1', period: 730, amount: 1000 }, await market.loadCatalogueMarketData())
    const record = { id: 'copy-d1', status: 'active', binding: { strategyId: 'd1' } }, entry = { record }, calls: string[] = []
    const account = { owner: 'display-only-fixture', epoch: 1, raw: 'fixed', error: null, state: { copies: [entry] }, store: { inspect: async () => { calls.push('inspect'); return { entry, value } }, market: () => { calls.push('market'); throw Error('unexpected market') }, retry: () => calls.push('retry') } }
    const inputs = { originals, events, journal, watch, watchJournal, caller, points, markers, value }
    const freeze = (v: object) => { Object.values(v).forEach(x => { if (x && typeof x === 'object') freeze(x) }); Object.freeze(v) }
    freeze(inputs)
    prefs.setClientPreference('language', 'ko')
    function Fixture() {
      const { language } = prefs.useClientPreferences(), displayText = (text: string) => copy.sourceActionLogLocaleText(language, text)
      return h(React.Fragment, null,
        h('div', { id: 'default-chart' }, h(chart.ClientSourceCloseChart, { points, markers })),
        h('div', { id: 'caller-chart' }, h(chart.ClientSourceCloseChart, { points, markers, label: '사용자 제목 91.2%', presentation: { ariaLabel: '호출자 차트', interval: '호출자 주기', fit: '호출자 버튼', note: '호출자 원문', locale: 'ko-KR' } })),
        h('div', { id: 'source-feed' }, h(feed.ClientAgentFeed, { strategyId: 'source', events, sourceLabel: 'fixture', displayText })),
        h('div', { id: 'source-watch' }, h(feed.ClientAgentFeed, { strategyId: 'watch', events: watch, sourceLabel: 'fixture', displayText })),
        h('div', { id: 'source-journal' }, h(feed.ClientAgentFeed, { strategyId: 'journal', events: journal, sourceLabel: 'fixture', ruleJournal: true, displayText })),
        h('div', { id: 'source-watch-journal' }, h(feed.ClientAgentFeed, { strategyId: 'watch-journal', events: watchJournal, sourceLabel: 'fixture', ruleJournal: true, displayText })),
        h('div', { id: 'caller-journal' }, h(feed.ClientAgentFeed, { strategyId: 'caller', events: caller, sourceLabel: 'caller', ruleJournal: true })),
        h('div', { id: 'caller-feed' }, h(feed.ClientAgentFeed, { strategyId: 'caller-default', events, sourceLabel: 'caller' })),
        h(binding.ClientCatalogueTerminalBinding, { account, chartEnabled: false, onManage: () => calls.push('manage'), onFind: () => calls.push('find'), children: ({ emptyMarket }: { emptyMarket?: { context?: string } }) => h('p', { id: 'binding-context' }, emptyMarket?.context) }))
    }
    Object.assign(window, { chartLocaleFixture: { inputs, texts, calls, copy, locale: (l: string) => prefs.setClientPreference('language', l) } })
    root.render(h(Fixture))
  })
  await expect(page.locator('#default-chart canvas').first()).toBeVisible()
  await expect(page.locator('#binding-context')).toContainText('코인 셋 나눠 담기')
  const canvas = await page.locator('#default-chart canvas').first().elementHandle()
  const inputs = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'chartLocaleFixture').inputs))
  await page.locator('#source-watch .agt').click()
  await page.locator('#source-journal .tb-rule-toggle').click()
  await page.locator('#caller-journal .tb-rule-toggle').click()
  await page.locator('#source-watch-journal .tm-fold').click()
  await page.locator('#source-watch-journal .tb-rule-toggle').click()
  const journal = await page.locator('#source-journal .tb-rule-toggle').elementHandle()
  for (const locale of locales) {
    await page.evaluate(locale => Reflect.get(window, 'chartLocaleFixture').locale(locale), locale)
    await expect(page.locator('#default-chart > section')).toHaveAttribute('aria-label', dictionary['원본 합성 종가 차트'][locales.indexOf(locale)])
    expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
    expect(await journal!.evaluate(node => node.isConnected && node.getAttribute('aria-expanded') === 'true')).toBe(true)
    await expect(page.locator('#caller-journal .tb-rule-original')).toHaveText('서버 요약 원문 91.2%')
    await expect(page.locator('#caller-feed .agb')).toHaveText('진입 조건 충족: 전봉 RSI 17.3 < 임계 30, 반등 +1.05%')
    await expect(page.locator('#source-watch [data-watch-event="watch-1"] p')).toHaveText('사용자 판단 원문 91.2%')
    await expect(page.locator('#source-watch-journal .tb-rule-toggle')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#source-watch-journal [data-rule-event="watch-1"] .tb-rule-original')).toHaveText('사용자 판단 원문 91.2%')
    await expect(page.locator('#caller-chart header b')).toHaveText('사용자 제목 91.2%')
    await expect(page.locator('#caller-chart footer')).toHaveText('호출자 원문')
    if (locale !== 'ko') {
      for (const selector of ['#default-chart header', '#default-chart footer', '#source-feed .agb', '#source-journal .tb-rule-original', '#source-watch-journal [data-rule-event="watch-2"] .tb-rule-original', '#binding-context']) expect(await page.locator(selector).innerText()).not.toMatch(/[가-힣\uFFFD]/)
    }
    const translated = await page.evaluate(locale => { const f = Reflect.get(window, 'chartLocaleFixture'); return f.texts.map((source: string) => ({ source, text: f.copy.sourceActionLogLocaleText(locale, source) })) }, locale)
    for (const pair of translated) {
      if (locale === 'ko') expect(pair.text).toBe(pair.source)
      else expect(pair.text).not.toMatch(/[가-힣\uFFFD]/)
      expect(pair.text.match(/[+-]?\d+(?:\.\d+)?/g)?.sort()).toEqual(pair.source.match(/[+-]?\d+(?:\.\d+)?/g)?.sort())
    }
    expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'chartLocaleFixture').inputs))).toBe(inputs)
    expect(await page.evaluate(() => Reflect.get(window, 'chartLocaleFixture').calls)).toEqual(['inspect'])
  }
  await page.locator('#default-chart button').click()
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: info.outputPath('terminal-chart-fr.png') })
  expect(errors).toEqual([]); expect(forbidden).toEqual([])
})
