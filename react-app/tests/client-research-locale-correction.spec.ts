import { expect, test, type Page } from '@playwright/test'

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const criteria = '이 패턴이 Research 구간과 Holdout 구간 모두에서 확인되어야 가설이 유지됩니다. 결과는 Backtest, Holdout artifact에서 확인하십시오.'
const plain = '많이 떨어져 과매도가 된 뒤, 가격이 다시 고개를 드는 순간의 반등을 노립니다.'
const singular = ['1회', '1 trade', '1回', '1次', '1次', '1 operación', '1 transaction']
const plural = ['13회', '13 trades', '13回', '13次', '13次', '13 operaciones', '13 transactions']

async function boot(page: Page, baseURL: string) {
  const errors: string[] = [], forbidden: string[] = [], origin = new URL(baseURL).origin
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const r = route.request(), u = new URL(r.url())
    if (u.origin !== origin || u.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(r.method())) { forbidden.push(`${r.method()} ${u.pathname}`); return route.abort() }
    return route.continue()
  })
  await page.route('**/research-correction.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#141414;color:white"><div id="fixture" style="height:900px"></div></body></html>' }))
  await page.goto('/research-correction.html')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientResearchWorkspace.tsx', dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts'
    const code = await (await fetch(cp)).text(), rp = code.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw Error('React dependency missing')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), preferences = await import(/* @vite-ignore */ pp), workspace = await import(/* @vite-ignore */ cp)
    for (const path of ['/src/styles.css', '/src/client-reference.css', '/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css']) await import(/* @vite-ignore */ path)
    const React = rm.default ?? rm, root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    Object.assign(window, { localeCorrection: { React, root, workspace, preferences, calls: [], language: (language: string) => preferences.setClientPreference('language', language) } })
  })
  return { errors, forbidden }
}

test('연구·위임 1/13 거래 수의 7언어 단복수는 독립 기대값과 일치한다', async ({ page, baseURL }) => {
  const guard = await boot(page, baseURL!)
  for (const [index, language] of languages.entries()) for (const count of [1, 13]) {
    const observed = await page.evaluate(async ({ language, count }) => {
      const cp = '/src/client-research-chart-ui-copy.ts', sp = '/src/client-research-static-content-copy.ts', dp = '/src/client-delegation-locale-copy.ts'
      const chart = await import(/* @vite-ignore */ cp), source = await import(/* @vite-ignore */ sp), delegation = await import(/* @vite-ignore */ dp)
      return { chart: chart.researchChartText(language, 'countTrades', { count }), research: source.researchStaticFormat('tradeCount', language, { count }), explained: chart.researchChartText(language, 'explained', { wins: 53, loss: 2.5, count }), caption: delegation.delegationLocaleText(language, '{0} · 원본 합성 일봉 · 완료 거래 {1}회', 'BTC/USDT', count), fee: delegation.delegationLocaleText(language, '완료 거래당 수수료 0.2% 포함, 거래 {0}회 표본 기준.', count), warning: source.researchStaticText('경고', language), integrity: source.researchStaticFormat('integrity', language, { backtests: count, passed: 8, total: 8, revisions: 1 }), easy: delegation.delegationLocaleText(language, '100번 중 {0}번 꼴로 이기는 전략이었고, 가장 안 좋았던 구간에서는 약 {1}%까지 떨어졌어요. {2}. 검증 구간 동안 총 {3}번 사고팔았어요.', 53, 2.5, 'SOURCE', count), expert: delegation.delegationLocaleText(language, '승률 {0}%, 거래 {1}회, MDD {2}%, Sharpe {3}, Profit Factor {4}, CAGR {5}%.', 53, count, -2.5, 1.5, 1.6, 7.8) }
    }, { language, count })
    expect.soft(observed.chart, language).toBe(count === 1 ? singular[index] : plural[index])
    expect.soft(observed.research, language).toBe(count === 1 ? singular[index] : plural[index])
    if (count === 1 && language === 'en') { expect.soft(observed.explained).toContain('1 time during'); expect.soft(observed.caption).toContain('1 completed trade'); expect.soft(observed.caption).not.toContain('1 completed trades'); expect.soft(observed.fee).toContain('1 trade.'); }
    if (count === 1 && language === 'es') { expect.soft(observed.explained).toContain('1 vez durante'); expect.soft(observed.caption).toContain('1 operación completada'); expect.soft(observed.fee).toContain('1 operación.'); }
    if (count === 1 && language === 'fr') { expect.soft(observed.explained).toContain('1 transaction pendant'); expect.soft(observed.caption).toContain('1 transaction terminée'); expect.soft(observed.fee).toContain('1 transaction.'); }
    expect.soft(observed.warning).toBe(['경고', 'Warning', '警告', '警告', '警告', 'Advertencia', 'Avertissement'][index])
    if (language === 'en') {
      expect.soft(observed.integrity).toContain(count === 1 ? '1 backtest,' : '13 backtests,')
      expect.soft(observed.integrity).toContain('1 revision,')
      expect.soft(observed.easy).toContain(count === 1 ? '1 trade in the' : '13 trades in the')
      expect.soft(observed.expert).toContain(count === 1 ? '1 trade, MDD' : '13 trades, MDD')
    }
    if (language === 'es') { expect.soft(observed.easy).toContain(count === 1 ? '1 operación en' : '13 operaciones en'); expect.soft(observed.expert).toContain(count === 1 ? '1 operación, MDD' : '13 operaciones, MDD') }
    if (language === 'fr') { expect.soft(observed.easy).toContain(count === 1 ? '1 transaction sur' : '13 transactions sur'); expect.soft(observed.expert).toContain(count === 1 ? '1 transaction, MDD' : '13 transactions, MDD') }
  }
  expect(guard.errors).toEqual([]); expect(guard.forbidden).toEqual([])
})

test('외국어로 질문해도 canonical 저장·bt1 번역·원문 질문·소수 RSI를 보존한다', async ({ page, baseURL }) => {
  const guard = await boot(page, baseURL!)
  for (const language of languages) {
    const id = `research-correction-${language}`
    await page.evaluate(({ id, language }) => {
      const f = Reflect.get(window, 'localeCorrection')
      sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [], clockVersion: 1 }))
      sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active: 'hypo', tabs: ['plan', 'hypo', 'bt1'], drafts: {}, rowDrafts: {}, replies: [], positions: {}, edits: {} }))
      const context = Object.freeze({ pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '−2.5%', takeProfit: '+0.125%', parameters: Object.freeze({ sl: -2.5, tp: 0.125, rsiTh: 42.125, trendFilter: false, startI: 61, endI: 160 }) })
      f.context = context; f.language(language)
      f.root.render(f.React.createElement(f.workspace.ClientResearchWorkspace, { sessionId: id, idea: '사용자가 작성한 제목 $&', planContext: context, onBack: () => f.calls.push('back') }))
    }, { id, language })
    await expect(page.locator('.rw-heading')).toHaveText('사용자가 작성한 제목 $&')
    await page.locator('.rw-composer textarea').fill('사용자 질문 원문 $& <유지>')
    await page.locator('.rw-composer textarea').press('Enter')
    await expect(page.locator('.rw-user-message').last()).toHaveText('사용자 질문 원문 $& <유지>')
    const answer = page.locator('.rw-answer').last()
    if (language !== 'ko') expect.soft(await answer.innerText(), `${language} hypo`).not.toMatch(/[가-힣\uFFFD]/)
    await expect.poll(() => page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth-client-research-documents:${id}`) ?? '{}').replies?.length, id)).toBe(1)
    const saved = await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth-client-research-documents:${id}`)!).replies, id)
    expect.soft(saved[0].answer, `${language} stored canonical`).toBe(`${plain} ${criteria}`)
    await page.locator('.rw-tabs button').nth(2).click()
    await page.locator('.rw-composer textarea').fill('why?')
    await page.locator('.rw-composer textarea').press('Enter')
    if (language !== 'ko') expect.soft(await page.locator('.rw-answer').last().innerText(), `${language} bt1`).not.toMatch(/[가-힣\uFFFD]/)
    else expect.soft(await page.locator('.rw-answer').last().innerText()).toContain('v1은 ')
    await page.locator('.rw-tabs button').nth(0).click()
    const entry = page.locator('.g-row').nth(1).locator('.v')
    expect.soft(await entry.innerText(), `${language} exact RSI`).toContain(language === 'es' || language === 'fr' ? '42,125' : '42.125')
    expect(await page.evaluate(() => Reflect.get(window, 'localeCorrection').context.parameters)).toEqual({ sl: -2.5, tp: 0.125, rsiTh: 42.125, trendFilter: false, startI: 61, endI: 160 })
    await page.evaluate(() => Reflect.get(window, 'localeCorrection').language('ko'))
    await page.locator('.rw-tabs button').nth(1).click()
    expect.soft(await answer.innerText()).toBe(`${plain} ${criteria}`)
    expect(await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth-client-research-documents:${id}`)!).replies[0], id)).toEqual(saved[0])
  }
  expect(await page.evaluate(() => Reflect.get(window, 'localeCorrection').calls)).toEqual([])
  expect(guard.errors).toEqual([]); expect(guard.forbidden).toEqual([])
})

test('고정 거래 참고·what-if만 표시 번역하고 사용자·미지 답변과 캐시를 보존한다', async ({ page, baseURL }) => {
  const guard = await boot(page, baseURL!)
  const original = await page.evaluate(async () => {
    const path = '/src/client-research-fixtures.ts', { CLIENT_RESEARCH_FIXTURE: data } = await import(/* @vite-ignore */ path)
    const f = Reflect.get(window, 'localeCorrection'), trade = data.versions[0].trades[0], id = 'source-reference-correction'
    const bar = (i: number) => `${(i + 1).toLocaleString('ko-KR')}번째 봉`, percent = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
    const reference = `Backtest v1 · 거래 1 · ${bar(trade.entry)} 매수 → ${bar(trade.exit)} 매도 · ${percent(trade.pnl * 100)}`
    const replies = [
      { doc: 'bt1', question: `사용자 질문 $&\n\n참고: ${reference}`, answer: `${reference}\n문서에 기록된 거래입니다. 조건 변경은 새 검증이 필요하며 기존 결과는 그대로 유지됩니다.` },
      { doc: 'bt1', question: '수수료 2배', answer: `만약에 · 수수료 2배, 수익 ${percent(data.whatif[0][1])}, 낙폭 ${data.whatif[0][2].toFixed(1)}%, ${data.whatif[0][3]}회 (정식 연구 아님)` },
      { doc: 'bt1', question: '수수료 2배', answer: '외부 원문 답변 7.25% $& 번역 금지' },
      { doc: 'bt1', question: '사용자 질문\n\n참고: 임의의 다른 거래', answer: '임의의 거래\n문서에 기록된 거래입니다. 조건 변경은 새 검증이 필요하며 기존 결과는 그대로 유지됩니다.' },
    ]
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [], clockVersion: 1 }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active: 'bt1', tabs: ['bt1'], drafts: {}, rowDrafts: {}, replies, positions: {}, edits: {} }))
    f.language('ko'); f.root.render(f.React.createElement(f.workspace.ClientResearchWorkspace, { sessionId: id, idea: '사용자 제목', onBack: () => f.calls.push('back') }))
    return replies
  })
  await expect(page.locator('.rw-thread .rw-answer')).toHaveCount(4)
  for (const [i, language] of languages.entries()) {
    await page.evaluate(language => Reflect.get(window, 'localeCorrection').language(language), language)
    const label = ['참고:', 'Reference:', '参考:', '参考：', '參考：', 'Referencia:', 'Référence :'][i]
    await expect(page.locator('.rw-thread .rw-user-message').nth(0)).toContainText(label)
    expect(await page.locator('.rw-thread .rw-user-message').nth(0).innerText()).toMatch(/^사용자 질문 \$&\n\n/)
    if (language !== 'ko') {
      expect(await page.locator('.rw-thread .rw-user-message').nth(0).innerText()).toContain(['', 'Trade 1', '取引 1', '交易 1', '交易 1', 'Operación 1', 'Transaction 1'][i])
      expect(await page.locator('.rw-thread .rw-answer').nth(0).innerText()).not.toMatch(/[가-힣\uFFFD]/)
      expect(await page.locator('.rw-thread .rw-answer').nth(1).innerText()).not.toMatch(/[가-힣\uFFFD]/)
      expect(await page.locator('.rw-thread .rw-user-message').nth(1).innerText()).not.toMatch(/[가-힣\uFFFD]/)
    } else await expect(page.locator('.rw-thread .rw-answer').nth(0)).toHaveText(original[0].answer)
    await expect(page.locator('.rw-thread .rw-user-message').nth(2)).toHaveText(original[2].question)
    await expect(page.locator('.rw-thread .rw-answer').nth(2)).toHaveText(original[2].answer)
    await expect(page.locator('.rw-thread .rw-user-message').nth(3)).toHaveText(original[3].question)
    await expect(page.locator('.rw-thread .rw-answer').nth(3)).toHaveText(original[3].answer)
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-research-documents:source-reference-correction')!).replies)).toEqual(original)
  }
  expect(guard.errors).toEqual([]); expect(guard.forbidden).toEqual([])
})

test('실제 합성평가 1/13거래 차트는 날짜·단복수만 전환하고 봉·마커·저장값을 보존한다', async ({ page, baseURL }) => {
  const guard = await boot(page, baseURL!)
  const initial = await page.evaluate(async () => {
    const ep = '/src/client-terminal-source-fixture.ts', cp = '/src/components/ClientDelegationChart.tsx', wp = '/src/components/ClientDelegationWorkspace.tsx'
    const source = await import(/* @vite-ignore */ ep), chart = await import(/* @vite-ignore */ cp), workspace = await import(/* @vite-ignore */ wp), f = Reflect.get(window, 'localeCorrection')
    const models: { r: { n: number; params: { startI: number; endI: number } } }[] = []
    for (const count of [1, 13]) {
      let found
      for (let endI = 62; endI < source.sourceTerminalPrices.length; endI++) {
        const candidate = source.evaluateSourceTerminal({ sl: -3, tp: 8, rsiTh: 44, trendFilter: false, startI: 61, endI }, 5_000_000)
        if (candidate.r.n === count) { found = candidate; break }
      }
      if (!found) throw Error(`No actual source evaluation with ${count} completed trades`)
      models.push(found)
    }
    const freeze = (v: object) => { Object.values(v).forEach(x => { if (x && typeof x === 'object') freeze(x) }); Object.freeze(v) }; freeze(models)
    const initialUi = { page: 'backtest', answers: {}, questionIndex: 5, attempt: 1, workStep: 5, expert: false, chartInterval: '1D', parameters: models[1].r.params }
    f.models = models; f.language('ko')
    f.root.render(f.React.createElement(f.React.Fragment, null,
      ...models.map((model, i) => f.React.createElement('div', { id: `count-chart-${i}`, key: i }, f.React.createElement(chart.ClientDelegationChart, { asset: 'BTC/USDT', evaluation: model }))),
      f.React.createElement('div', { id: 'delegation-date' }, f.React.createElement(workspace.ClientDelegationWorkspace, { sessionId: 'date-correction', idea: '사용자 원문 제목', initialUi, sourceCopy: true, onBack: () => f.calls.push('back') }))))
    return { models: JSON.stringify(models), indices: models.map(model => model.r.params), iso: models.map(model => { const d = source.sourceTerminalDate(model.r.params.endI); return [d.getFullYear(), d.getMonth() + 1, d.getDate()] }) }
  })
  await expect(page.locator('#count-chart-0 .tf-source-marker')).toHaveCount(2)
  await expect(page.locator('#count-chart-1 .tf-source-marker')).toHaveCount(26)
  const chart = await page.locator('#count-chart-0 svg').elementHandle()
  const paths = await page.locator('#count-chart-0 .tf-source-price, #count-chart-1 .tf-source-price').evaluateAll(nodes => nodes.map(node => node.getAttribute('d')))
  for (const language of languages) {
    await page.evaluate(language => Reflect.get(window, 'localeCorrection').language(language), language)
    for (let i = 0; i < 2; i++) {
      const [year, month, day] = initial.iso[i]
      const expectedDate = language === 'ko' ? `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}` : new Date(year, month - 1, day).toLocaleDateString(language)
      await expect(page.locator(`#count-chart-${i} .tf-source-readout time`)).toHaveText(expectedDate)
      const caption = await page.locator(`#count-chart-${i} .tf-source-sr`).first().innerText()
      if (language === 'en') expect(caption).toContain(i === 0 ? '1 completed trade.' : '13 completed trades.')
      if (language === 'es') expect(caption).toContain(i === 0 ? '1 operación completada.' : '13 operaciones completadas.')
      if (language === 'fr') expect(caption).toContain(i === 0 ? '1 transaction terminée.' : '13 transactions terminées.')
    }
    const period = await page.locator('#delegation-date .tfw-rail .r .v').last().innerText()
    const date = (index: number) => { const d = new Date(2023, 0, 2); d.setDate(d.getDate() + index); return d.toLocaleDateString(language) }
    expect(period).toBe(`${date(initial.indices[1].startI)} ~ ${date(initial.indices[1].endI)}`)
    expect(await chart!.evaluate(node => node.isConnected)).toBe(true)
    expect(await page.locator('#count-chart-0 .tf-source-price, #count-chart-1 .tf-source-price').evaluateAll(nodes => nodes.map(node => node.getAttribute('d')))).toEqual(paths)
    expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'localeCorrection').models))).toBe(initial.models)
    expect(await page.evaluate(() => Reflect.get(window, 'localeCorrection').calls)).toEqual([])
  }
  expect(guard.errors).toEqual([]); expect(guard.forbidden).toEqual([])
})
