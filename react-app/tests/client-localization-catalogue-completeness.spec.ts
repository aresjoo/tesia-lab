import { expect, test, type Page } from '@playwright/test'

const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const tokenPattern = /\{\w+\}/g

async function shell(page: Page) {
  await page.route('**/catalogue-locale.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#171717;color:#ececec"><div id="fixture"></div></body></html>' }))
  await page.goto('/catalogue-locale.html')
  await page.addScriptTag({ type: 'module', content: `import runtime from '/@react-refresh'; runtime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>value=>value; window.__vite_plugin_react_preamble_installed__=true;
const {setClientPreference}=await import('/src/client-preferences.ts'); window.localeChange=language=>setClientPreference('language',language);
const {mount}=await import('/tests/fixtures/catalogue-backtest-host.tsx'); window.localeCatalogue=mount();` })
  await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase', 'ready')
}

test('catalogue locale: source-only dictionaries have seven complete columns and identical placeholders', async ({ page }) => {
  await page.route('**/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  await page.goto('/')
  const dictionaries = await page.evaluate(async () => {
    const a = '/src/client-static-ui-copy.json', b = '/src/client-catalogue-preview-locale-copy.json', c = '/src/client-conditional-order-locale-copy.json'
    return await Promise.all([a, b, c].map(async path => (await import(path)).default)) as Record<string, string[]>[]
  })
  for (const dictionary of dictionaries) for (const [source, row] of Object.entries(dictionary)) {
    expect(row).toHaveLength(7)
    expect(row[0]).toBe(source)
    for (const text of row) expect(text.trim()).not.toBe('')
    for (const text of row.slice(1)) {
      expect(text).not.toMatch(/[가-힣\uFFFD]/)
      expect(text.match(tokenPattern)?.sort() ?? []).toEqual(source.match(tokenPattern)?.sort() ?? [])
    }
  }
  const durations = await page.evaluate(async () => {
    const path = '/src/client-static-ui-copy.ts', { staticUiText } = await import(path)
    return ['en', 'es', 'fr'].map(language => [staticUiText(language, '{days}일', { days: 1 }), staticUiText(language, '{days}일', { days: 2 })])
  })
  expect(durations.map(row => row.map(text => text.replace(/\s/g, ' ')))).toEqual([['1 day', '2 days'], ['1 día', '2 días'], ['1 jour', '2 jours']])
  const counts = await page.evaluate(async () => {
    const path = '/src/client-static-ui-copy.ts', { staticUiText } = await import(path)
    return ['en', 'es', 'fr'].map(language => [staticUiText(language, '{count}회', { count: 1 }), staticUiText(language, '{count}회', { count: 13 })])
  })
  expect(counts).toEqual([['1 time', '13 times'], ['1 vez', '13 veces'], ['1 fois', '13 fois']])
})

test('catalogue locale: all original strategies retain numbers, decision keys, rules and observation bytes', async ({ page }) => {
  await page.route('**/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  await page.goto('/')
  const proof = await page.evaluate(async langs => {
    const cp = '/src/client-catalogue.ts', mp = '/src/client-catalogue-market-data.ts', bp = '/src/client-catalogue-backtest-result.ts', lp = '/src/client-catalogue-preview-locale.ts', ep = '/src/client-catalogue-evidence-state.ts'
    const { catalogueStrategies } = await import(cp), { loadCatalogueMarketData } = await import(mp)
    const { computeCatalogueBacktest } = await import(bp), { cataloguePreviewText } = await import(lp), { evidenceText } = await import(ep)
    const dictionaryPath = '/src/client-catalogue-preview-locale-copy.json'
    const dictionary = (await import(dictionaryPath)).default as Record<string, string[]>
    const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 }
    const data = await loadCatalogueMarketData(), missing: { strategy: string; source: string; display: string; language: string }[] = [], damaged: string[] = []
    let observations = 0, decisions = 0, presentations = 0
    const visit = (value: unknown, strategy: string, futures: boolean) => {
      if (typeof value === 'string') {
        const normalized = evidenceText(value, futures)
        for (const language of langs) {
          const display = cataloguePreviewText(language, value, futures)
          if (language === 'ko' && display !== value) damaged.push(strategy + ':ko')
          if (language !== 'ko' && /[가-힣\uFFFD]|\{n\d+\}/.test(display)) missing.push({ strategy, source: value, display, language })
          if (language !== 'ko') {
            const pattern = /-?\d+(?:,\d{3})*(?:\.\d+)?/g, values: string[] = []
            const template = normalized.replace(pattern, item => `{n${values.push(item) - 1}}`)
            // Preserve every data-number slot exactly. A translated lexical
            // unit such as 하루 → 1-day is not an observation-number change.
            // Its literal digit must be present in the reviewed target template;
            // arbitrary extra numbers are still rejected below.
            const target = dictionary[template]?.[column[language]]
            const expected = target === undefined ? normalized : target.replace(/\{n(\d+)\}/g, (match, index: string) => values[Number(index)] ?? match)
            const numbers = (text: string) => (text.match(pattern) ?? []).sort()
            if (JSON.stringify(numbers(display)) !== JSON.stringify(numbers(expected))) damaged.push(strategy + ':numbers:' + value)
            if (target !== undefined && display !== expected) damaged.push(strategy + ':slot-render:' + value)
          }
          presentations++
        }
      } else if (Array.isArray(value)) for (const item of value) visit(item, strategy, futures)
    }
    for (const strategy of catalogueStrategies) for (const period of [90, 365, 730, 0]) {
      const value = computeCatalogueBacktest({ owner: 'locale-evidence', strategyId: strategy.id, period, amount: 1000 }, data), before = JSON.stringify(value)
      for (const row of value.evidence.decisions) {
        for (const key of ['tag', 'title', 'cmp', 'why', 'act', 'say']) visit(row[key], strategy.id, !!strategy.fut)
        for (const key of ['facts', 'p0', 'p1', 'p2']) visit(row[key], strategy.id, !!strategy.fut)
        if (row.out) visit(row.out.t, strategy.id, !!strategy.fut)
        decisions++
      }
      if (JSON.stringify(value) !== before) damaged.push(strategy.id + ':observation-mutated')
      observations++
    }
    return { observations, decisions, presentations, missing: missing.slice(0, 30), missingCount: missing.length, damaged: [...new Set(damaged)].slice(0, 30), unknown: langs.map(lang => cataloguePreviewText(lang, '사용자/API 원문: 비트코인 SourceUnknownLiteral 반드시 보존')) }
  }, locales)
  expect(proof.observations).toBe(124)
  expect(proof.decisions).toBeGreaterThan(10000)
  expect(proof.presentations).toBeGreaterThan(100000)
  expect(proof.missing, JSON.stringify(proof.missing)).toEqual([])
  expect(proof.missingCount).toBe(0)
  expect(proof.damaged, JSON.stringify(proof.damaged)).toEqual([])
  expect(proof.unknown).toEqual(locales.map(() => '사용자/API 원문: 비트코인 SourceUnknownLiteral 반드시 보존'))
})

for (const strategyId of ['r1', 'f1', 'd1', 'r8']) test(`catalogue locale: ${strategyId} result translates in place, retains chart geometry and keyboard selection`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await shell(page)
  await page.evaluate(id => Reflect.get(window, 'localeCatalogue').strategy(id), strategyId)
  await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-strategy-id', strategyId)
  await page.getByRole('button', { name: '과거를 다시 돌려 보기', exact: true }).click()
  await page.getByRole('button', { name: '바로 결과 보기', exact: true }).click()
  await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase', 'result')
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  // Cover the decision disclosure as well as the trade disclosure. A missing
  // locale hook in this separate branch previously escaped summary-only checks.
  const decision = page.locator('[data-decision-index] > .bt-rb').first()
  if (strategyId !== 'd1') {
    await decision.click()
    await expect(decision).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('backtest-selected-evidence')).toBeVisible()
    await decision.click()
  }
  const before = await page.locator('[data-series]').evaluateAll(nodes => nodes.map(node => node.getAttribute('d')))
  const snapshotKey = `teth-client-catalogue-backtest:bt-owner-a:${strategyId}`
  const snapshot = await page.evaluate(key => sessionStorage.getItem(key), snapshotKey)
  // Open a real source trade detail and the extended metric disclosure: summary
  // checks alone previously missed holding-period and fee qualifiers.
  const trade = page.locator('[data-trade-id] .bt-rb').first()
  await trade.click()
  await expect(trade).toHaveAttribute('aria-expanded', 'true')
  await page.locator('.bt-tech summary').click()
  for (const language of locales) {
    await page.evaluate(lang => Reflect.get(window, 'localeChange')(lang), language)
    await expect(page.getByTestId('catalogue-backtest-shell')).toHaveAttribute('data-phase', 'result')
    expect(await page.locator('[data-series]').evaluateAll(nodes => nodes.map(node => node.getAttribute('d')))).toEqual(before)
    expect(await page.evaluate(key => sessionStorage.getItem(key), snapshotKey)).toBe(snapshot)
    const leftovers = await page.locator('.bt-id, .bt-dl, .bt-panel, .bt-mobile-status, .bt-verdict, .bt-dd-c').evaluateAll(nodes => nodes.flatMap(node => Array.from(node.querySelectorAll('*')).filter(child => !child.children.length && /[가-힣\uFFFD]/.test(child.textContent ?? '')).map(child => child.textContent)))
    if (language !== 'ko') expect(leftovers).toEqual([])
    const countColumn: Record<string, number> = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 }
    const countText = (count: number) => [String(count) + '건', count + (count === 1 ? ' item' : ' items'), String(count) + '件', String(count) + '条', String(count) + '筆', count + (count === 1 ? ' elemento' : ' elementos'), count + (count === 1 ? ' élément' : ' éléments')][countColumn[language]]
    for (const text of await page.locator('.bt-ym > .num').allTextContents()) {
      const count = Number(text.match(/^\d+/)?.[0])
      expect(Number.isFinite(count)).toBe(true)
      expect(text).toBe(countText(count))
    }
    const markerCount = await page.locator('.bt-marker-list summary > .num').textContent()
    expect(markerCount).toBe(countText(Number(markerCount?.match(/^\d+/)?.[0])))
    const clippedLabels = await page.locator('svg.bt-mini').evaluateAll(nodes => nodes.flatMap(svg => {
      const box = (svg as SVGSVGElement).viewBox.baseVal
      return Array.from(svg.querySelectorAll('text')).flatMap(text => {
        const b = text.getBBox()
        return b.x < box.x - 1 || b.x + b.width > box.x + box.width + 1
          ? [{ text: text.textContent, x: b.x, width: b.width, viewBox: box.width }] : []
      })
    }))
    expect(clippedLabels, JSON.stringify(clippedLabels)).toEqual([])
    const chart = page.locator('.bt-chart')
    await chart.focus(); await chart.press('End')
    const status = await page.locator('.catalogue-backtest-chart-status').textContent()
    expect(status).toContain('2026-09-28')
    if (language !== 'ko') expect(status).not.toMatch(/[가-힣]/)
  }
  expect(errors).toEqual([])
})
