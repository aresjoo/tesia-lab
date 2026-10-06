import { expect, test } from '@playwright/test'
import { clientResearchLabel } from '../src/client-research-label'

const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const planTitles = ['연구 계획', 'Research Plan', '研究計画', '研究计划', '研究計畫', 'Plan de investigación', 'Plan de recherche']
const critics = ['비판 검토 기록', 'Critic Review', '批判的レビュー', '批判性审查', '批判性審查', 'Revisión crítica', 'Revue critique']

test.beforeEach(async ({ page }, info) => {
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 320 : 1440, height: 900 })
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    return url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/') && ['GET', 'HEAD'].includes(request.method()) ? route.continue() : route.abort('blockedbyclient')
  })
})

test('research completeness: system document labels cover seven locales without altering authored text', () => {
  for (const [index, language] of locales.entries()) {
    expect(clientResearchLabel('Research Plan', language)).toBe(planTitles[index])
    expect(clientResearchLabel('Critic Review', language)).toBe(critics[index])
    expect(clientResearchLabel('BTC/USDT · 사용자 Research Plan', language)).toBe('BTC/USDT · 사용자 Research Plan')
    expect(clientResearchLabel('StrategyID-123', language)).toBe('StrategyID-123')
  }
})

test('research completeness: Native report binding labels and USDT unit localize in six foreign locales', async ({ page }) => {
  await page.route('**/report-copy-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  await page.goto('/report-copy-fixture.html')
  const labels = await page.evaluate(async langs => {
    const path = '/src/internal-poc/native-result-copy.ts', { nativeResultCopy } = await import(path)
    const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 }
    return langs.map(lang => [nativeResultCopy.bindingProjectionHash[column[lang]], nativeResultCopy.bindingTerminalSealHash[column[lang]], nativeResultCopy.slippageCostRow[column[lang]]])
  }, locales)
  expect(labels).toEqual([
    ['Projection hash', 'Terminal seal hash', '슬리피지 (USDT)'],
    ['Projection hash', 'Terminal seal hash', 'Slippage (USDT)'],
    ['射影ハッシュ', '終了封印ハッシュ', 'スリッページ (USDT)'],
    ['投影哈希', '终止封存哈希', '滑点 (USDT)'],
    ['投影雜湊', '終止封存雜湊', '滑價 (USDT)'],
    ['Hash de proyección', 'Hash del sello terminal', 'Deslizamiento (USDT)'],
    ['Empreinte de projection', 'Empreinte du sceau terminal', 'Glissement (USDT)'],
  ])
})

test('research completeness: explicit static Mock inventory covers all locales without changing evidence or producer verdict', async ({ page }) => {
  await page.route('**/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  await page.goto('/')
  const data = await page.evaluate(async langs => {
    const cp = '/src/client-research-static-content-copy.ts', mp = '/src/mock-research-preview.ts', vp = '/src/research-view-model.ts', fp = '/src/client-research-fixtures.ts'
    const { researchStaticCopy, researchStaticTemplates } = await import(cp)
    const chartPath = '/src/client-research-chart-ui-copy.ts', { researchChartUiCopy } = await import(chartPath)
    const { previewEntries, previewCritic } = await import(mp)
    const { criticParagraphs } = await import(vp), { researchPercent } = await import(fp)
    const review = previewCritic(95)
    return { rows: [...Object.values(researchStaticCopy), ...Object.values(researchStaticTemplates), ...Object.values(researchChartUiCopy)] as string[][], original: previewEntries(95), entries: langs.map(language => previewEntries(95, language)), verdicts: langs.map(language => criticParagraphs({ ...review, verdict: '사용자/producer 원문 Verdict' }, language).verdict), frenchPercent: researchPercent(12.3, 1, 'fr'), originalPercent: researchPercent(-3.5) }
  }, locales)
  for (const row of data.rows) {
    expect(row).toHaveLength(7)
    for (const text of row) expect(text.trim()).not.toBe('')
    for (const text of row.slice(1)) expect(text).not.toMatch(/[가-힣]/)
    const tokens = (value: string) => [...value.matchAll(/\{\w+\}/g)].map(match => match[0]).sort()
    for (const text of row.slice(1)) expect(tokens(text)).toEqual(tokens(row[0]))
  }
  for (const [index, language] of locales.entries()) {
    const rows = data.entries[index]
    expect(rows.map((row: { id: string; agent: string; elapsedSeconds: number; state: string }) => [row.id, row.agent, row.elapsedSeconds, row.state])).toEqual(data.original.map((row: { id: string; agent: string; elapsedSeconds: number; state: string }) => [row.id, row.agent, row.elapsedSeconds, row.state]))
    if (language !== 'ko') for (const row of rows) expect(row.summary + Object.values(row.finding ?? {}).join('')).not.toMatch(/[가-힣]/)
    expect(data.verdicts[index]).toBe('사용자/producer 원문 Verdict')
  }
  expect(data.frenchPercent).toBe('+12,3%')
  expect(data.originalPercent).toBe('-3.5%')
})

test('research completeness: professional research chart preserves canvas draft and selection while seven locale aria updates', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    const id = 'locale-analysis'
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '작성한 이름', renamed: true, idea: '사용자 아이디어', draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', workspace: 'research', researchStatus: '검토 필요', turns: [], updatedAt: 1 }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [] }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active: 'report', tabs: ['report'], drafts: { report: '用户 작성한 chart draft' }, replies: [] }))
  })
  await page.goto('/')
  await page.getByRole('button', { name: '차트로 자세히 보기', exact: true }).click()
  await expect(page.locator('.ra-chart canvas').first()).toBeVisible()
  const canvas = await page.locator('.ra-chart canvas').first().elementHandle()
  await page.locator('.ra-ledger > button').nth(1).click()
  if (info.project.name === 'mobile') await page.locator('.ra-mobile-nav button').last().click()
  const field = page.locator('#ra-question'), originalField = await field.elementHandle()
  const sends = ['차트 질문 보내기', 'Send chart question', 'チャートの質問を送信', '发送图表问题', '傳送圖表問題', 'Enviar pregunta sobre el gráfico', 'Envoyer la question sur le graphique']
  for (const [index, language] of locales.entries()) {
    await page.evaluate(async lang => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', lang) }, language)
    await expect(page.locator('.ra-composer button')).toHaveAccessibleName(sends[index])
    await expect(field).toHaveValue('用户 작성한 chart draft')
    await expect(page.locator('.ra-ledger > button').nth(1)).toHaveAttribute('aria-pressed', 'true')
    if (language !== 'ko') {
      expect(await page.locator('.ra-ledger > button').nth(1).getAttribute('aria-label')).not.toMatch(/[가-힣]/)
      await expect(page.locator('.ra-header')).not.toContainText(/[가-힣]/)
    }
    expect(await canvas!.evaluate(node => node === document.querySelector('.ra-chart canvas'))).toBe(true)
    expect(await field.evaluate((node, saved) => node === saved, originalField)).toBe(true)
  }
})

test('research completeness: mini chart seven locale descriptions preserve SVG keyboard selection and geometry', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    const id = 'locale-mini'
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '고객 제목', renamed: true, idea: '원문', draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', workspace: 'research', researchStatus: '검토 필요', turns: [], updatedAt: 1 }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [] }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active: 'bt1', tabs: ['bt1'], drafts: { bt1: '고객 chart draft' }, replies: [] }))
  })
  await page.goto('/')
  const slider = page.locator('.rw-price svg[role=slider]').first()
  await expect(slider).toBeVisible()
  const original = await slider.elementHandle(), helpId = await slider.getAttribute('aria-describedby')
  const paths = await slider.locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d')))
  const captions = ['가격, 거래 시점, 봉인 구간', 'Prices, trade times and sealed period', '価格・取引時点・封印区間', '价格、交易时点和封存区间', '價格、交易時點和封存區間', 'Precios, operaciones y periodo sellado', 'Prix, transactions et période scellée']
  await slider.focus()
  await slider.press('End')
  const end = await slider.getAttribute('aria-valuenow')
  for (const [index, language] of locales.entries()) {
    await page.evaluate(async lang => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', lang) }, language)
    await expect(page.locator('.rw-price .g-note').first()).toHaveText(captions[index])
    await expect(slider).toHaveAttribute('aria-describedby', helpId!)
    await expect(slider).toHaveAttribute('aria-valuenow', end!)
    expect(await slider.locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d')))).toEqual(paths)
    expect(await slider.evaluate((node, saved) => node === saved, original)).toBe(true)
    await expect(page.locator('.rw-composer textarea')).toHaveValue('고객 chart draft')
    if (language !== 'ko') {
      expect(await slider.getAttribute('aria-label')).not.toMatch(/[가-힣]/)
      expect(await slider.getAttribute('aria-valuetext')).not.toMatch(/[가-힣]/)
      expect(await page.locator(`[id="${helpId}"]`).textContent()).not.toMatch(/[가-힣]/)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await slider.press('Home')
  await expect(slider).toHaveAttribute('aria-valuenow', '1')
  await slider.press('ArrowRight')
  expect(Number(await slider.getAttribute('aria-valuenow'))).toBeGreaterThan(1)
})

test('research completeness: supplied execution workspace uses seven locale labels and UTC formatting without changing IDs or draft', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?chart-workspace-preview=1')
  await page.getByRole('button', { name: '차트 작업 공간 열기', exact: true }).click()
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.locator('.bw-ledger > button').first().click()
  await page.locator('.bw-discuss').click()
  const field = page.locator('.bw-composer textarea')
  await field.fill('actual 사용자 draft 原文')
  const originalField = await field.elementHandle()
  const searches = ['체결·거래 ID 검색', 'Search execution/trade ID', '約定・取引IDを検索', '搜索成交/交易ID', '搜尋成交/交易ID', 'Buscar ID de ejecución/operación', 'Rechercher un ID d’exécution/transaction']
  for (const [index, language] of locales.entries()) {
    await page.evaluate(async lang => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', lang) }, language)
    await expect(page.locator('.bw-ledger-tools input')).toHaveAttribute('placeholder', searches[index])
    await expect(page.locator('.bw-ledger > button').first()).toContainText('trade-a')
    await expect(page.locator('.bw-ledger > button').first()).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.bw-header > strong')).toHaveText('전략 연구')
    if (language !== 'ko') expect(await page.locator('.bw-ledger > button').first().getAttribute('aria-label')).not.toMatch(/[가-힣]/)
    await expect(field).toHaveValue('actual 사용자 draft 原文')
    expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
    expect(await field.evaluate((node, saved) => node === saved, originalField)).toBe(true)
  }
})

test('research completeness: source inline result full sentences and disclaimer localize without recomputation or callback changes', async ({ page }) => {
  await page.route('**/research-inline-locale-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="fixture"></div></body></html>' }))
  await page.goto('/research-inline-locale-fixture.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/components/ClientInlineBacktest.tsx', source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const rm = await import(rp), react = rm.default ?? rm, dp = '/@id/react-dom/client', dom = await import(dp)
    const { ClientInlineBacktest } = await import(path), ep = '/src/client-delegation-engine.ts', { delegationRecommendedParameters } = await import(ep)
    const calls: string[] = []
    Reflect.set(window, 'localeInlineCalls', calls)
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(react.createElement(ClientInlineBacktest, { record: { turnId: 'source-turn-preserved', ordinal: 2, completedAt: 1, pair: 'ETH/USDT', timeframe: '1시간봉', parameters: delegationRecommendedParameters() }, active: true, canConnect: true, onRecommend: () => calls.push('recommend'), onEdit: () => calls.push('edit'), onPlan: () => calls.push('plan'), onConnect: () => calls.push('connect') }))
  })
  await expect(page.locator('.client-inline-backtest')).toBeVisible()
  const result = page.locator('.gbt[data-bt]'), report = page.locator('.gbt[data-rpt]')
  await expect(report).toBeVisible()
  const original = await result.elementHandle(), before = await result.locator('.kp dd').allTextContents()
  const headings = ['전략 검증 결과', 'Strategy validation result', '戦略検証結果', '策略验证结果', '策略驗證結果', 'Resultado de validación de estrategia', 'Résultat de validation de stratégie']
  for (const [index, language] of locales.entries()) {
    await page.evaluate(async lang => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', lang) }, language)
    await expect(result.getByRole('heading')).toHaveText(headings[index])
    if (language !== 'ko') {
      await expect(result).not.toContainText(/[가-힣]/)
      await expect.poll(async () => (await report.locator('h4, .bd, .acts').allTextContents()).join(' ')).not.toMatch(/[가-힣]/)
    }
    await expect(result).toContainText('ETH/USDT')
    expect(await result.evaluate((node, saved) => node === saved, original)).toBe(true)
    await report.locator('.acts button').last().click()
  }
  expect(await page.evaluate(() => Reflect.get(window, 'localeInlineCalls'))).toEqual(Array(7).fill('plan'))
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', 'ko') })
  expect(await result.locator('.kp dd').allTextContents()).toEqual(before)
})

test('research completeness: retained completed report and Mock critic localize immediately in seven locales', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    const id = 'locale-completed'
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '사용자 이름', renamed: true, idea: '원문 아이디어', draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', workspace: 'research', researchStatus: '검토 필요', turns: [], updatedAt: 1 }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [] }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active: 'report', tabs: ['activity', 'plan', 'critic', 'report'], drafts: { report: '保存した 사용자 원문' }, replies: [{ doc: 'report', question: '사용자가 작성한 질문', answer: 'actual producer 고유 문장 保持' }, { doc: 'report', question: '기존 정적 문서 질문', answer: '수익성 판단은 일치하지만 위험 심사는 낙폭과 손실 지속 기간 측면에서 보류했습니다. 다수결로 덮지 않고 실제 체결 차이는 가상 검증에서 확인합니다.' }] }))
  })
  await page.goto('/')
  const field = page.locator('.rw-composer textarea')
  await expect(field).toHaveValue('保存した 사용자 원문')
  const original = await field.elementHandle()
  const articles = ['가상 검증 권장', 'Paper validation recommended', '仮想検証を推奨', '建议模拟验证', '建議模擬驗證', 'Se recomienda validación simulada', 'Validation simulée recommandée']
  for (const [index, language] of locales.entries()) {
    await page.evaluate(async lang => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', lang) }, language)
    await expect(page.locator('.rw-scroll .rw-verdict')).toContainText(articles[index])
    if (language !== 'ko') {
      await expect.poll(async () => (await page.locator('.rw-scroll > article > :not(.rw-thread)').allTextContents()).join(' ')).not.toMatch(/[가-힣]/)
      await expect(page.locator('.rw-answer').nth(1)).not.toContainText(/[가-힣]/)
    }
    await expect(page.locator('.rw-answer').first()).toHaveText('actual producer 고유 문장 保持')
    await expect(field).toHaveValue('保存した 사용자 원문')
    expect(await field.evaluate((element, saved) => element === saved, original)).toBe(true)
    await page.getByRole('tab', { name: critics[index], exact: true }).click()
    if (language !== 'ko') await expect(page.locator('.research-critic-document')).not.toContainText(/[가-힣]/)
    await page.locator('.rw-tabs').getByRole('tab').first().click()
    if (language !== 'ko') await expect(page.locator('.g-research-log')).not.toContainText(/[가-힣]/)
    await page.locator('.rw-tabs').getByRole('tab').last().click()
  }
  expect(errors).toEqual([])
})

test('research completeness: Native supplied critic prose stays verbatim while chrome and elapsed aria switch locale', async ({ page }) => {
  await page.route('**/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="fixture"></div></body></html>' }))
  await page.goto('/')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/internal-poc/NativeResearchDocuments.tsx', logPath = '/src/components/ClientResearchLog.tsx'
    const source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const rm = await import(rp), react = rm.default ?? rm, dp = '/@id/react-dom/client', dom = await import(dp)
    const { NativeResearchDocuments } = await import(path), { ClientResearchLog } = await import(logPath)
    const h = react.createElement
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h('section', { className: 'client-restored-research' },
      h(NativeResearchDocuments, { scopeId: 'original-service-owner', document: { id: 'critic-actual', kind: 'critic', state: 'ready', revision: 'one', data: { builder: '공급 원문 Builder BTC/USDT', critic: '供給原文 Critic', verdict: '사용자 판정 原文', verdictTone: 'warning' } } }),
      h(ClientResearchLog, { source: 'service', status: 'running', entries: [{ id: 'observed', elapsedSeconds: 1.5, agent: 'Strategy Critic', summary: '실제 공급된 prose', state: 'work' }] })))
  })
  const headings = ['Builder', 'Builder', '構築担当', '构建者', '建構者', 'Constructor', 'Concepteur']
  const elapsed = ['시작 후 1.5초', '1.5 seconds since start', '開始から1.5秒', '开始后1.5秒', '開始後1.5秒', '1,5 segundos desde el inicio', '1,5 secondes depuis le début']
  for (const [index, language] of locales.entries()) {
    await page.evaluate(async lang => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', lang) }, language)
    await expect(page.locator('.research-critic-blocks .g-tag').first()).toHaveText(headings[index])
    await expect(page.locator('.research-critic-blocks p')).toHaveText(['공급 원문 Builder BTC/USDT', '供給原文 Critic', '사용자 판정 原文'])
    await expect(page.locator('.g-act .bd')).toContainText('실제 공급된 prose')
    await expect(page.locator('.g-act time')).toHaveAttribute('aria-label', elapsed[index])
  }
})

test('research completeness: Main retained plan localizes chrome and preserves draft DOM and original question', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: 'locale-research', homeDraft: '', sessions: [{ id: 'locale-research', title: '사용자 제목 Research Plan', idea: 'BTC/USDT 사용자 원문', draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'research', researchStatus: '초안', turns: [], updatedAt: Date.now() }] }))
  })
  await page.goto('/')
  const field = page.locator('.rw-composer textarea')
  await expect(field).toBeVisible()
  await field.fill('Research Plan 사용자 질문 그대로 日本語')
  const original = await field.elementHandle()
  const start = ['연구 시작', 'Start research', '研究を開始', '开始研究', '開始研究', 'Iniciar investigación', 'Lancer la recherche']
  const send = ['문서 질문 보내기', 'Send document question', '文書への質問を送信', '发送文档问题', '傳送文件問題', 'Enviar pregunta sobre el documento', 'Envoyer la question sur le document']
  for (const [index, language] of locales.entries()) {
    await page.evaluate(async lang => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', lang) }, language)
    await expect(page.getByRole('tab', { name: planTitles[index], exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.rw-scroll').getByRole('button', { name: start[index], exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: send[index], exact: true })).toBeVisible()
    await expect(field).toHaveValue('Research Plan 사용자 질문 그대로 日本語')
    expect(await field.evaluate((element, saved) => element === saved, original)).toBe(true)
    await expect(page.locator('.rw-heading')).toContainText('사용자 제목 Research Plan')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
})

test('research completeness: Main retained execution document shows original paper validation step in seven locales', async ({ page }, info) => {
  const errors: string[] = [], apiRequests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.method()) })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    const id = 'locale-execution-paper'
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '사용자 이름', renamed: true, idea: '원문 아이디어', draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', workspace: 'research', researchStatus: '검토 필요', turns: [], updatedAt: 1 }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [] }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active: 'run', tabs: ['report', 'run'], drafts: { run: '실행 전 확인하던 사용자 질문 日本語' }, replies: [] }))
  })
  await page.goto('/')
  const step = page.locator('.rw-scroll article > .meta > b'), field = page.locator('.rw-composer textarea')
  await expect(step).toHaveText('가상 검증')
  await expect(field).toHaveValue('실행 전 확인하던 사용자 질문 日本語')
  const originalField = await field.elementHandle(), originalArticle = await page.locator('.rw-scroll article').elementHandle(), url = page.url()
  const stored = await page.evaluate(() => sessionStorage.getItem('teth-client-research-documents:locale-execution-paper'))
  // Independent original KO step (index9fb:12001), not a runtime dictionary oracle.
  const steps = ['가상 검증', 'Paper validation', '仮想検証', '模拟验证', '模擬驗證', 'Validación simulada', 'Validation simulée']
  for (const [i, language] of locales.entries()) {
    await page.evaluate(async lang => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', lang) }, language)
    await expect(step).toHaveText(steps[i])
    await expect(step).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(field).toHaveValue('실행 전 확인하던 사용자 질문 日本語')
    expect(await field.evaluate((node, saved) => node === saved, originalField)).toBe(true)
    expect(await page.locator('.rw-scroll article').evaluate((node, saved) => node === saved, originalArticle)).toBe(true)
    expect(await page.evaluate(() => sessionStorage.getItem('teth-client-research-documents:locale-execution-paper'))).toBe(stored)
    expect(page.url()).toBe(url)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: info.outputPath(`paper-validation-${language}.png`) })
  }
  expect(errors).toEqual([])
  expect(apiRequests).toEqual([])
})
