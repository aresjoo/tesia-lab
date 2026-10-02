import { expect, test, type Page } from '@playwright/test'
import { evaluateSourceTerminal, sourceTerminalSeeds, sourceTerminalPrices, type SourceTerminalParameters } from '../src/client-terminal-source-fixture'
import { terminalBarsText, terminalReadText } from '../src/client-terminal-read-copy'
import { accountTerminalText } from '../src/client-account-terminal-copy'
import { sharedNumber, sharedPercent } from '../src/client-shared-number-format'
import { lifecycleText } from '../src/client-trade-lifecycle-copy'
import { strategyActionsText } from '../src/client-strategy-actions-copy'
import { strategyProposalText } from '../src/client-strategy-proposal-copy'
import { createSourceTerminalDiscussion } from '../src/client-terminal-source-proposal'
import { projectSourceDiscussion } from '../src/client-source-proposal-presentation'
import { sourceAgentPresets, sourceProposalText } from '../src/client-source-proposal-copy'
import { sourceContextText } from '../src/client-source-context-copy'
import { sourceJudgmentText } from '../src/client-source-judgment-copy'
import { sourceQuestionText } from '../src/client-source-question-view'
import { sourceTerminalLifecycle, sourceTradeExitPrice } from '../src/client-terminal-source-ledger'
import { delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'

async function mount(page: Page, withDisconnectedLedger: boolean | 'no-navigation' = false, userCallback?: 'missing' | 'pending', sourceParameters?: SourceTerminalParameters) {
  await page.route('**/source-terminal-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3;font-family:sans-serif"><div id="fixture"></div></body></html>' }))
  await page.goto('/source-terminal-test.html')
  await page.evaluate(async ({ withDisconnectedLedger, userCallback, sourceParameters }) => {
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem('tethCurrency', 'KRW')
    for (const font of ['/node_modules/@fontsource-variable/noto-sans-kr/wght.css', '/node_modules/@fontsource-variable/noto-sans-sc/wght.css', '/node_modules/@fontsource-variable/geist/wght.css', '/src/client-reference.css']) {
      await import(/* @vite-ignore */ font)
    }
    document.body.style.fontFamily = '"Noto Sans KR Variable", "Noto Sans SC Variable", "Geist Variable", sans-serif'
    const preferencesPath = '/src/client-preferences.ts'
    const preferences = await import(/* @vite-ignore */ preferencesPath)
    // Retain the synchronous setter instead of creating a transient CDP promise
    // for an already-loaded dynamic import on every currency assertion.
    Reflect.set(window, 'setSourceTerminalPreference', preferences.setClientPreference)
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientSourceTerminalWorkspace.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp), workspace = await import(/* @vite-ignore */ cp)
    const react = reactModule.default ?? reactModule
    const calls = { newCount: 0, asks: [] as string[], navigation: [] as string[], statuses: [] as string[] }
    const enginePath = '/src/client-delegation-engine.ts'
    const engine = await import(/* @vite-ignore */ enginePath)
    const parameters = sourceParameters ?? engine.delegationRecommendedParameters(), verified = engine.evaluateDelegation(parameters, 10000000)
    const user = userCallback ? {
      userStrategies: [{ id: '1000', createdAt: 1000, name: '사용자 입력', status: sourceParameters ? 'live' : 'ready', environment: 'paper', parameters,
        score: verified.score, ret: verified.result.ret, mdd: verified.result.mdd, n: verified.result.n, winRate: verified.result.winRate,
        asset: '이더리움', exchangeId: 'okx', exchangeName: 'OKX', capital: 10000000, version: 'v1.0' }],
      onUserStatus: userCallback === 'missing' ? undefined : (id: string, status: string) => {
        calls.statuses.push(`${id}:${status}`)
        return new Promise<void>((resolve, reject) => { Object.assign(window, { resolveSourceUserStatus: resolve, rejectSourceUserStatus: () => reject(new Error('상태 확인 fixture 실패')) }) })
      },
    } : {}
    const statePath = '/src/client-account-event-state.ts'
    const stateModule = await import(/* @vite-ignore */ statePath)
    const ledger = withDisconnectedLedger ? {
      accountState: stateModule.createSourceAccountEventState({ rebates: [
        { fid: 'fixture-fill-1', botId: 'fixture-bot-1', amt: 10, at: 1000, sim: true },
        { fid: 'fixture-fill-2', botId: 'fixture-bot-2', amt: 25, at: 2000, sim: true },
      ] }),
      onAccountNavigate: withDisconnectedLedger === 'no-navigation' ? undefined : (path: string) => calls.navigation.push(path),
    } : {}
    Object.assign(window, { sourceTerminalCalls: calls })
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(react.createElement(workspace.default, { ...ledger, ...user, accountDataMode: withDisconnectedLedger ? 'connection-required' : 'source-preview', onNew: () => calls.newCount++, onAsk: (text: string) => calls.asks.push(text) }))
  }, { withDisconnectedLedger, userCallback, sourceParameters })
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', userCallback ? 'user:1000' : 'demo:d1')
  await page.evaluate(async () => { await document.fonts.load('14px "Noto Sans KR Variable"', '전략 판단 기록 손절 설명'); await document.fonts.ready })
}
async function panel(page: Page, name: '전략' | '차트' | 'Agent') {
  const tabs = page.getByRole('tablist', { name: '터미널 영역', exact: true })
  await expect(tabs).toBeHidden()
  await expect(page.locator(name === '차트' ? '.ctt-market' : '.ctt-detail')).toBeVisible()
  if (name === '전략' && await page.locator('.ctt-selector-button').getAttribute('aria-expanded') !== 'true') await page.locator('.ctt-selector-button').click()
  if (name !== '전략' && await page.locator('.ctt-selector-button').getAttribute('aria-expanded') === 'true') await page.locator('.ctt-selector-button').click()
}
async function analysis(page: Page, name: 'Agent' | '대시보드' | '완료된 거래') {
  await panel(page, 'Agent')
  await page.getByRole('tablist', { name: '전략 분석' }).getByRole('tab', { name: name === 'Agent' ? '판단' : name, exact: true }).click()
}
async function choose(page: Page, id: string) {
  await panel(page, '전략')
  await page.locator(`[data-strategy-id="${id}"] .tft-select`).click()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', id)
}
async function menu(page: Page, id = 'demo:d1') {
  await panel(page, '전략')
  await page.locator(`[data-strategy-id="${id}"] .mn`).click()
  await expect(page.getByRole('menu')).toBeVisible()
}
async function currency(page: Page, value: string) {
  await page.evaluate(currency => Reflect.get(window, 'setSourceTerminalPreference')('currency', currency), value)
}
async function bottom(page: Page, name: string) {
  await panel(page, '차트')
  await page.getByRole('tablist', { name: '거래 데이터 항목' }).getByRole('tab', { name, exact: true }).click()
  return page.locator('.ctt-bottom-pane[data-selected="true"]')
}
// These historical fixtures store KRW. Display converts once at the documented
// preview rate; prices, capital, quantities and the evaluator remain unchanged.
const previewUsd = (value: number) => `$${new Intl.NumberFormat('ko', { maximumFractionDigits: 2 }).format(Math.abs(value) / 1390)}`

for (const width of [320, 1440]) test(`0eb338 ${width}px 판단 탭 아래 상태·설명 순서와 대시보드 왕복을 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  await mount(page)
  await analysis(page, 'Agent')
  const status = page.locator('.csj-status'), input = page.locator('.cst-composer input')
  await expect(status.locator('h3')).toHaveText('진입 조건을 기다리고 있습니다')
  await expect(page.locator('.cat-tabs button')).toHaveText(['판단', '대시보드', '완료된 거래'])
  await expect(page.locator('.cat-tabs [aria-selected=true]')).toHaveCSS('border-bottom-width', '2px')
  await expect(page.locator('.cat-tabs [aria-selected=true]')).toHaveCSS('border-bottom-style', 'solid')
  await expect(page.locator('.cat-tabs [aria-selected=true]')).toHaveCSS('border-bottom-color', 'rgb(255, 255, 255)')
  await expect(status).toHaveCSS('padding-left', width <= 960 ? '16px' : '20px')
  await expect(status.locator('.csj-row dd').first()).toHaveCSS('font-size', '16px')
  await input.fill('탭 왕복에도 유지할 질문')
  const original = await input.elementHandle()
  await analysis(page, '대시보드')
  await expect(status).toBeHidden()
  await analysis(page, 'Agent')
  await expect(status).toBeVisible()
  await expect(input).toHaveValue('탭 왕복에도 유지할 질문')
  expect(await input.evaluate((el, old) => el === old, original)).toBe(true)
  await status.scrollIntoViewIfNeeded()
  const tabBox = (await page.locator('.cat-tabs').boundingBox())!, statusBox = (await status.boundingBox())!, thoughtBox = (await page.locator('.csj-thought').boundingBox())!
  expect(statusBox.y).toBeGreaterThanOrEqual(tabBox.y + tabBox.height - 1)
  expect(thoughtBox.y).toBeGreaterThanOrEqual(statusBox.y + statusBox.height - 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: info.outputPath(`judgment-workspace-${width}.png`) })
})

test('대시보드는 원본 최근 거래 여섯 열과 버전 기록 진입을 제공한다', async ({ page }) => {
  await mount(page)
  await analysis(page, '대시보드')
  await expect(page.locator('.cst-dashboard th')).toHaveText(['청산일', '구분', '진입가', '청산가', '보유', '손익'])
  await expect(page.getByRole('button', { name: '버전 기록 보기 (v3.4)', exact: true })).toBeVisible()
})

for (const width of [320, 1440]) test(`${width}px 최근 거래의 규칙가·행/키보드 추적·버전 직접 진입이 같은 대시보드로 복귀한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await analysis(page, '대시보드')
  const dashboard = page.locator('.cst-dashboard'), rows = dashboard.locator('tbody tr')
  const seed = sourceTerminalSeeds[0], result = evaluateSourceTerminal(seed.parameters, seed.capital)
  const values = result.trades.slice(-25).reverse()
  expect(new Set(values.map(tr => tr.kind))).toEqual(new Set(['tp', 'sl', 'time']))
  const firstRowHeight = await rows.first().evaluate(el => el.getBoundingClientRect().height)
  expect(firstRowHeight).toBeLessThanOrEqual(48)
  if (await page.evaluate(() => matchMedia('(pointer:coarse)').matches)) expect(firstRowHeight).toBeGreaterThanOrEqual(44)
  for (let index = 0; index < values.length; index++) {
    const tr = values[index], price = sourceTerminalPrices[tr.entry]
    const exit = tr.kind === 'sl' ? price * (1 + result.r.params.sl / 100) : tr.kind === 'tp' ? price * (1 + result.r.params.tp! / 100) : sourceTerminalPrices[tr.exit]
    await expect(rows.nth(index).locator('td').nth(2)).toHaveText(previewUsd(price))
    await expect(rows.nth(index).locator('td').nth(3)).toHaveText(previewUsd(exit))
    await expect(rows.nth(index).locator('td').nth(5)).toHaveText(`${tr.krw < 0 ? '−' : '+'}${previewUsd(tr.krw)}`)
  }
  await expect(dashboard.locator('[data-metric="feeCaption"] dd')).toHaveText(`−${previewUsd(result.feeEst)} 추정`)
  await expect(dashboard.locator('[data-metric="totalPnl"] dd')).toHaveClass('up')
  await expect(dashboard.locator('[data-metric="drawdown"] dd')).toHaveClass('dn')
  const canvas = await page.locator('.cst-close-chart canvas').first().elementHandle()
  const trigger = rows.first().getByRole('button')
  for (const method of ['keyboard', 'row'] as const) {
    if (method === 'keyboard') { await trigger.focus(); await page.keyboard.press('Enter') }
    else await rows.first().locator('td').nth(1).click()
    const dialog = page.getByRole('dialog', { name: /LONG 거래 추적/ })
    await expect(dialog).toBeVisible()
    await expect(page.locator('.cat-tabs [aria-selected="true"]')).toHaveText('대시보드')
    await expect(dialog).toContainText(previewUsd(sourceTerminalPrices[values[0].entry]))
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(dashboard).toBeVisible()
    expect(await canvas!.evaluate(el => el === document.querySelector('.cst-close-chart canvas'))).toBe(true)
  }
  // An unrelated selection must not disable this row's pointer action.
  await dashboard.locator('h3').first().evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range) })
  await rows.first().locator('td').nth(1).dispatchEvent('click')
  await expect(page.getByRole('dialog', { name: /LONG 거래 추적/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await rows.first().locator('td').nth(1).evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range) })
  await rows.first().locator('td').nth(1).dispatchEvent('click')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.evaluate(() => window.getSelection()?.removeAllRanges())
  const versions = dashboard.getByRole('button', { name: '버전 기록 보기 (v3.4)', exact: true })
  await versions.click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  const history = page.getByRole('dialog', { name: '버전 기록: BTC 돌파 추종', exact: true })
  await expect(history).toBeVisible()
  await expect(history).toContainText('현재 버전v3.4')
  await expect(history).toContainText('아직 수정 이력이 없어요.')
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as const) {
    await page.evaluate(async language => { const p = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ p)).setClientPreference('language', language) }, language)
    await expect(page.locator('.csa-dialog')).toHaveAccessibleName(terminalReadText(language, 'versionsTitle', { name: seed.name }))
    await expect(page.locator('.csa-dialog')).toContainText(terminalReadText(language, 'noVersions'))
  }
  await page.keyboard.press('Escape')
  await expect(versions).toBeFocused()
  await page.getByRole('button', { name: '터미널 전체화면', exact: true }).click()
  await versions.click()
  await expect(page.locator('.ctt-modal[open] .csa-dialog[open]')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(versions).toBeFocused()
  await expect(page.locator('.ctt-modal')).toHaveAttribute('open', '')
  await page.keyboard.press('Escape')
  await expect(page.locator('.ctt-modal')).not.toHaveAttribute('open', '')
  await dashboard.locator('.cst-matrix').first().screenshot({ path: testInfo.outputPath(`dashboard-parity-${width}.png`) })
  expect(errors).toEqual([])
})

for (const target of [10, null]) test(`원본 현재 포지션은 목표가 ${target}와 실제 표시 손익률을 평가 결과에서 받는다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 1000 })
  const parameters = { ...sourceTerminalSeeds[0].parameters, tp: target }
  const firstEntry = evaluateSourceTerminal(parameters, 10000000).L.evs.find(ev => ev.k === 'entry')!.i
  const p = { ...parameters, endI: firstEntry + 1 }
  const result = evaluateSourceTerminal(p, 10000000)
  expect(result.pos).not.toBeNull()
  await mount(page, false, 'missing', p)
  await analysis(page, '대시보드')
  const position = page.locator('.cst-position')
  await expect(position).toBeVisible()
  await expect(position.locator('[data-metric="quantity"] dd')).toHaveText(result.pos!.qty.toFixed(4))
  await expect(position.locator('[data-metric="entryPrice"] dd')).toHaveText(previewUsd(result.pos!.entryP))
  await expect(position.locator('[data-metric="currentPrice"] dd')).toHaveText(previewUsd(result.pos!.curP))
  await expect(position.locator('[data-metric="stopPrice"] dd')).toHaveText(previewUsd(result.pos!.stopP))
  await expect(position.locator('.cst-position-head')).toContainText(sharedPercent(result.pos!.chg * 100, 'ko'))
  await expect(position.locator('[data-metric="holding"] dd')).toHaveText('1봉')
  if (target === null) await expect(position.locator('[data-metric="targetPrice"]')).toHaveCount(0)
  else await expect(position.locator('[data-metric="targetPrice"] dd')).toHaveText(previewUsd(result.pos!.tpP!))
  await expect(page.locator('[data-metric="maxGainLoss"] dd')).toHaveText('- / -')
  await expect(page.locator('.cst-dashboard .cst-empty')).toHaveText('이 구간 체결이 없어요')
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', language) }, language)
    await expect(position.locator('[data-metric="holding"] dd')).toHaveText(terminalBarsText(language, 1))
    await expect(position.locator('[data-metric="quantity"] dd')).toHaveText(sharedNumber(result.pos!.qty, language, 4))
    const overflow = await position.evaluate(root => [...root.querySelectorAll<HTMLElement>('dt,dd')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent))
    expect(overflow).toEqual([])
  }
  await position.screenshot({ path: testInfo.outputPath(`position-${target}.png`) })
  await page.locator('.cst-versions').click()
  await expect(page.locator('.csa-dialog')).toContainText(terminalReadText('fr', 'versionsUnavailable'))
})

test('NAV 요약은 원본 기준선·면적·손익 색과 읽을 수 있는 월 표시를 유지한다', async ({ page }, testInfo) => {
  await mount(page)
  await analysis(page, '대시보드')
  const nav = page.locator('.cst-nav')
  await expect(nav.locator('line.base')).toHaveCount(1)
  await expect(nav.locator('linearGradient stop')).toHaveCount(2)
  await expect(nav.locator('path.area')).toHaveCount(1)
  await expect(nav.locator('polyline')).toHaveAttribute('vector-effect', 'non-scaling-stroke')
  const result = evaluateSourceTerminal(sourceTerminalSeeds[0].parameters, sourceTerminalSeeds[0].capital)
  await expect(nav.locator('polyline')).toHaveClass(result.r.eq.at(-1)!.v >= 1 ? 'ln up' : 'ln dn')
  await expect(nav.locator('.cst-nav-dates')).toContainText('2023.')
  await expect(nav.locator('.ss3-chart, .ss3-drawdown, button')).toHaveCount(0)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await analysis(page, '대시보드')
    const dimensions = await nav.evaluate(root => {
      const graph = root.querySelector('svg')!, dates = [...root.querySelectorAll<HTMLElement>('.cst-nav-dates span')]
      const dateRow = root.querySelector('.cst-nav-dates')!.getBoundingClientRect()
      return { height: graph.getBoundingClientRect().height, total: root.querySelector('.cst-nav-chart')!.getBoundingClientRect().height, overflow: root.scrollWidth > root.clientWidth + 1,
        dateSizes: dates.map(el => parseFloat(getComputedStyle(el).fontSize)),
        datesBelowCurve: dateRow.top >= graph.getBoundingClientRect().bottom,
        datesHeight: dateRow.height,
        dateOverlap: dates[0].getBoundingClientRect().right > dates[1].getBoundingClientRect().left && dates[0].getBoundingClientRect().bottom > dates[1].getBoundingClientRect().top }
    })
    expect(dimensions).toMatchObject({ height: 150, overflow: false, dateSizes: [14, 14], datesBelowCurve: true, dateOverlap: false })
    expect(dimensions.total).toBe(dimensions.height + dimensions.datesHeight)
    if (width === 320 || width === 1440) {
      await page.locator('.cst-dashboard').screenshot({ path: testInfo.outputPath(`dashboard-nav-${width}.png`) })
      await page.screenshot({ path: testInfo.outputPath(`terminal-nav-viewport-${width}.png`) })
    }
  }
  await nav.screenshot({ path: testInfo.outputPath('nav-summary.png') })
})

test('거래 없는 실제 source 평가의 한 점 곡선은 대시보드에서 빈 상태를 제공한다', async ({ page }) => {
  const params = { ...sourceTerminalSeeds[0].parameters, startI: 61, endI: 62 }
  expect(evaluateSourceTerminal(params, 10000000).r.eq).toHaveLength(1)
  await mount(page, false, 'pending', params)
  await analysis(page, '대시보드')
  const nav = page.locator('.cst-nav')
  await expect(nav.locator('svg')).toHaveCount(0)
  await expect(nav.getByRole('status')).toHaveText('곡선 데이터가 없어요')
  await expect(page.locator('.cst-dashboard [data-metric="navSimulation"] dd')).toHaveText('$7,194.24')
  await expect(page.locator('.cst-dashboard [data-metric="totalPnl"] dd')).toHaveText('+$0 +0.0%')
  await page.evaluate(async () => { const p = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ p)).setClientPreference('language', 'en') })
  await expect(nav.getByRole('status')).toHaveText(terminalReadText('en', 'emptyCurve'))
})

test('메인 경로의 body 포털 거래 추적도 과거 BTC 설정 대신 USD와 원본 글꼴을 표시한다', async ({ page }) => {
  const parameters = delegationRecommendedParameters(), verified = evaluateDelegation(parameters, 10000000)
  const record = { id: '1000', createdAt: 1000, name: '거래 추적 연구', status: 'ready', environment: 'paper', parameters,
    score: verified.score, ret: verified.result.ret, mdd: verified.result.mdd, n: verified.result.n, winRate: verified.result.winRate,
    asset: '비트코인', exchangeId: 'okx', exchangeName: 'OKX', capital: 10000000, version: 'v1.0' }
  await page.addInitScript(record => {
    localStorage.setItem('tethLang', 'ko'); localStorage.setItem('tethCurrency', 'BTC')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '거래 추적 글꼴 검수', email: 'lifecycle@example.test' }))
    sessionStorage.setItem('teth-client-user-strategies:lifecycle%40example.test', JSON.stringify([{ sessionId: 'lifecycle', record }]))
  }, record)
  await page.goto('/#/trade')
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await analysis(page, '대시보드')
  await expect(page.locator('[data-strategy-id^="demo:"]')).toHaveCount(0)
  await page.locator('.cst-trade-link').first().click()
  await expect(page.locator('body > .client-trade-lifecycle')).toBeVisible()
  const value = page.locator('.client-trade-lifecycle .lc1:nth-child(3) .v2')
  await expect(value).toContainText('$')
  await expect(value).not.toContainText('₿')
  await page.evaluate(async () => { await document.fonts.ready })
  expect(await value.evaluate(el => getComputedStyle(el).fontFamily)).toContain('Noto Sans KR Variable')
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
    const { root } = await cdp.send('DOM.getDocument')
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.client-trade-lifecycle .lc1:nth-child(3) .v2' })
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
    expect(fonts.some(font => font.postScriptName === 'NotoSans-Regular' && font.isCustomFont)).toBe(false)
  } finally { await cdp.detach() }
})

for (const width of [320, 1440]) test(`거래 추적 ${width}px 열린7단계는7언어·3통화에서도 같은 거래와 초점을 보존한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 800 })
  const errors: string[] = [], requests: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('request', r => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method())) requests.push(r.url()) })
  await mount(page)
  await analysis(page, '대시보드')
  const trigger = page.locator('.cst-trade-link').first(), triggerElement = await trigger.elementHandle()
  const canvas = await page.locator('.cst-close-chart canvas').first().elementHandle()
  await trigger.click()
  const dialog = page.locator('.client-trade-lifecycle'), element = await dialog.elementHandle()
  const rows = await dialog.locator('.lc1').elementHandles(), rawDescription = await dialog.locator('.lc1').first().locator('p').elementHandle()
  const seed = sourceTerminalSeeds[0], model = { seed, result: evaluateSourceTerminal(seed.parameters, seed.capital) }, trade = model.result.trades.at(-1)!
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', language) }, language)
    await expect(dialog).toHaveAccessibleName(lifecycleText(language, 'title', { asset: seed.asset }))
    await expect(dialog.getByRole('button', { name: lifecycleText(language, 'close'), exact: true })).toHaveCount(1)
    const region = dialog.getByRole('region', { name: lifecycleText(language, 'region'), exact: true })
    await region.focus()
    for (const code of ['KRW', 'USD', 'BTC']) {
      const before = await region.evaluate(el => { el.scrollTop = 20; return el.scrollTop })
      await currency(page, code)
      const moneyValues = await page.evaluate(async ({ values, code, language }) => {
        const path = '/src/client-preview-money.ts'
        const { sourceMoney } = await import(/* @vite-ignore */ path)
        return values.map((value, index) => sourceMoney(value, code, language, index === 2))
      }, { values: [sourceTerminalPrices[trade.entry], sourceTradeExitPrice(model, trade), trade.krw], code, language })
      let moneyIndex = 0
      const steps = sourceTerminalLifecycle(model, trade.entry, () => moneyValues[moneyIndex++], language)!
      expect(moneyIndex).toBe(3)
      await expect(dialog.locator('.lc1 b')).toHaveText(steps.map(s => s.title))
      await expect(dialog.locator('.lc1 .v2')).toHaveText(steps.map(s => s.value))
      await expect(dialog.locator('.lc1 p')).toHaveText(steps.map(s => s.description))
      if (language === 'fr' && code === 'BTC') {
        await page.evaluate(async () => { await document.fonts.ready })
        const cdp = await page.context().newCDPSession(page)
        try {
          await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
          const { root } = await cdp.send('DOM.getDocument')
          const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.client-trade-lifecycle .lc1:nth-child(3) .v2' })
          const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
          expect(fonts.some(font => font.postScriptName === 'NotoSans-Regular' && font.isCustomFont)).toBe(false)
        } finally { await cdp.detach() }
      }
      await expect(region).toBeFocused()
      if (before > 0) expect(await region.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
      expect(await region.evaluate(el => el.scrollWidth > el.clientWidth + 1)).toBe(false)
      const splitValues = await dialog.locator('.lc1').filter({ has: page.locator('.v2') }).evaluateAll(rows => [2, 3, 5, 6].filter(index => {
        const range = document.createRange(); range.selectNodeContents(rows[index].querySelector('.v2')!)
        return range.getClientRects().length > 1
      }))
      expect(splitValues).toEqual([])
      expect(await element!.evaluate(el => el === document.querySelector('.client-trade-lifecycle'))).toBe(true)
      for (let i = 0; i < rows.length; i++) expect(await rows[i].evaluate((el, i) => el === document.querySelectorAll('.client-trade-lifecycle .lc1')[i], i)).toBe(true)
      expect(await rawDescription!.evaluate(el => el === document.querySelector('.client-trade-lifecycle .lc1 p'))).toBe(true)
      expect(await canvas!.evaluate(el => el === document.querySelector('.cst-close-chart canvas'))).toBe(true)
    }
    await region.evaluate(el => { el.scrollTop = 0 })
    if (language === 'ko' || language === 'fr') await dialog.screenshot({ path: testInfo.outputPath(`lifecycle-${language}-${width}.png`) })
    await region.focus(); await page.keyboard.press('Control+End')
    await expect(dialog.locator('.lc1').last()).toBeInViewport()
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(await triggerElement!.evaluate(el => el === document.activeElement)).toBe(true)
  await expect(page.locator('.cst-dashboard')).toBeVisible()
  expect(errors).toEqual([]); expect(requests).toEqual([])
})

for (const width of [320, 1440]) test(`7언어 ${width}px 대시보드·완료 거래는 원본 수치·곡선·DOM·선택을 보존한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 })
  const errors: string[] = [], mutations: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(request.url()) })
  await mount(page)
  await analysis(page, '대시보드')
  const dashboard = page.locator('.cst-dashboard'), completed = page.locator('.cst-completed')
  const metric = await dashboard.locator('[data-metric="capital"]').elementHandle()
  const row = await dashboard.locator('tbody tr').first().elementHandle()
  const completedMetric = await completed.locator('[data-metric="entry"]').first().elementHandle()
  const svg = await dashboard.locator('.cst-nav svg').elementHandle()
  const points = await dashboard.locator('polyline').getAttribute('points')
  const canvas = await page.locator('.cst-close-chart canvas').first().elementHandle()
  const seed = sourceTerminalSeeds[0], result = evaluateSourceTerminal(seed.parameters, seed.capital)
  const sourceDates = await dashboard.locator('tbody tr td:first-child').allTextContents()
  const reasons = await completed.locator('.cst-completed-trade p').allTextContents()
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'ko', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const preferences = await import(/* @vite-ignore */ path)
      preferences.setClientPreference('language', language)
    }, language)
    const t = (key: Parameters<typeof terminalReadText>[1], values?: Record<string, string>) => terminalReadText(language, key, values)
    await expect(dashboard.locator('[data-metric="capital"] dt')).toHaveText(t('capital'))
    await page.evaluate(async () => { await document.fonts.ready })
    await page.locator('.cat-tabs').getByRole('tab', { name: accountTerminalText(language, 'dashboard'), exact: true }).click()
    await expect(dashboard).toBeVisible()
    await expect(dashboard.locator('[data-metric="drawdown"] dd')).toHaveText(sharedPercent(result.r.mdd, language, 1, false))
    await expect(dashboard.locator('[data-metric="sharpe"] dd')).toHaveText(sharedNumber(result.r.sharpe, language, 2))
    await expect(dashboard.locator('[data-metric="averageHolding"] dd')).toHaveText(terminalBarsText(language, result.r.avgHold, 1))
    await expect(dashboard.locator('[data-metric="tradeCount"] dd')).toHaveText(t('trades', { value: String(result.r.n) }))
    await expect(dashboard.locator('.cst-table')).toHaveAttribute('aria-label', t('recentTradesLabel', { name: seed.name }))
    await expect(dashboard.locator('th')).toHaveText((['exitDate', 'type', 'entryPrice', 'exitPrice', 'holding', 'pnl'] as const).map(key => t(key)))
    await expect(dashboard.locator('tbody tr td:nth-child(5)')).toHaveText(result.trades.slice(-25).reverse().map(tr => terminalBarsText(language, tr.exit - tr.entry)))
    expect(await dashboard.locator('tbody tr td:first-child').allTextContents()).toEqual(sourceDates)
    expect(await metric!.evaluate(el => el === document.querySelector('.cst-dashboard [data-metric="capital"]'))).toBe(true)
    expect(await row!.evaluate(el => el === document.querySelector('.cst-dashboard tbody tr'))).toBe(true)
    expect(await svg!.evaluate(el => el === document.querySelector('.cst-nav svg'))).toBe(true)
    await expect(dashboard.locator('polyline')).toHaveAttribute('points', points!)
    await expect(dashboard.locator('svg')).toHaveAttribute('aria-label', t('navDescription', { value: sharedPercent(result.r.ret, language) }))
    for (const code of ['KRW', 'USD', 'BTC']) {
      await currency(page, code)
      const latestTrade = result.trades.at(-1)!
      const entryPrice = sourceTerminalPrices[latestTrade.entry]
      const exitPrice = latestTrade.kind === 'sl' ? entryPrice * (1 + result.r.params.sl / 100) : latestTrade.kind === 'tp' ? entryPrice * (1 + result.r.params.tp! / 100) : sourceTerminalPrices[latestTrade.exit]
      const money = await page.evaluate(async ({ language, code, capital, nav, entryPrice, exitPrice }) => {
        const path = '/src/client-preview-money.ts'
        const { sourceMoney } = await import(/* @vite-ignore */ path)
        return [sourceMoney(capital, code, language), sourceMoney(nav, code, language), sourceMoney(entryPrice, code, language), sourceMoney(exitPrice, code, language)]
      }, { language, code, capital: seed.capital, nav: result.nav, entryPrice, exitPrice })
      await expect(dashboard.locator('[data-metric="capital"] dd')).toHaveText(money[0])
      await expect(dashboard.locator('[data-metric="navSimulation"] dd')).toHaveText(money[1])
      await expect(dashboard.locator('tbody tr').first().locator('td').nth(2)).toHaveText(money[2])
      await expect(dashboard.locator('tbody tr').first().locator('td').nth(3)).toHaveText(money[3])
      await expect(dashboard.locator('.cst-value-part')).toHaveCount(6)
      const splitAmounts = await dashboard.locator('.cst-value-part').evaluateAll(elements => elements.flatMap(el => {
        const text = el.firstChild
        if (!text) return []
        const range = document.createRange()
        range.selectNodeContents(el)
        return range.getClientRects().length > 1 ? [el.textContent] : []
      }))
      expect(splitAmounts).toEqual([])
    }
    await currency(page, 'KRW')
    await expect(dashboard.locator('[data-metric="capital"] dd')).toContainText('$')
    const overflow = await dashboard.evaluate(root => [...root.querySelectorAll<HTMLElement>('.cst-matrix,dt,dd,h3')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.tagName))
    expect(overflow).toEqual([])
    const feeBounds = await dashboard.locator('[data-metric="feeCaption"]').evaluate(el => ({ width: el.getBoundingClientRect().width, grid: el.parentElement!.getBoundingClientRect().width }))
    expect(Math.abs(feeBounds.grid - feeBounds.width)).toBeLessThanOrEqual(2)
    await page.locator('.cat-tabs').getByRole('tab', { name: accountTerminalText(language, 'completed'), exact: true }).click()
    await expect(completed).toBeVisible()
    await expect(completed.locator('h3')).toContainText(t('completedRange', { total: String(result.trades.length), recent: String(Math.min(12, result.trades.length)) }))
    await expect(completed.locator('[data-metric="entry"] dt').first()).toHaveText(t('entry'))
    await expect(completed.locator('[data-metric="exit"] dt').first()).toHaveText(t('exit'))
    await expect(completed.locator('[data-metric="holding"] dd')).toHaveText(result.trades.slice(-12).reverse().map(tr => terminalBarsText(language, tr.exit - tr.entry)))
    await expect(completed.locator('header .cst-value-part')).toHaveCount(Math.min(12, result.trades.length) * 2)
    const splitCompletedAmounts = await completed.locator('header .cst-value-part').evaluateAll(elements => elements.filter(el => {
      const range = document.createRange()
      range.selectNodeContents(el)
      return range.getClientRects().length > 1
    }).map(el => el.textContent))
    expect(splitCompletedAmounts).toEqual([])
    expect(await completedMetric!.evaluate(el => el === document.querySelector('.cst-completed [data-metric="entry"]'))).toBe(true)
    expect(await completed.locator('.cst-completed-trade p').allTextContents()).toEqual(reasons)
    await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'demo:d1')
    expect(await canvas!.evaluate(el => el === document.querySelector('.cst-close-chart canvas'))).toBe(true)
  }
  await completed.locator('.cst-completed-trade').first().screenshot({ path: testInfo.outputPath(`completed-fr-${width}.png`) })
  const trigger = completed.getByRole('button', { name: terminalReadText('fr', 'fullDecision'), exact: true }).first()
  await trigger.click()
  await expect(page.getByRole('dialog', { name: lifecycleText('fr', 'title', { asset: seed.asset }), exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await page.locator('.cat-tabs').getByRole('tab', { name: accountTerminalText('fr', 'dashboard'), exact: true }).click()
  await dashboard.locator('.cst-matrix').first().screenshot({ path: testInfo.outputPath(`dashboard-fr-${width}.png`) })
  await dashboard.locator('.cst-matrix.compact').screenshot({ path: testInfo.outputPath(`metrics-fr-${width}.png`) })
  const table = dashboard.locator('.cst-table')
  await table.scrollIntoViewIfNeeded()
  await table.focus()
  const before = await table.evaluate(el => el.scrollLeft)
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => table.evaluate(el => el.scrollLeft)).toBeGreaterThan(before)
  expect(mutations).toEqual([])
  expect(errors).toEqual([])
})

test('원본 2436의 거래 6탭과 벨 전용 알림을 전략 선택 후에도 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const mutations: string[] = []
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(request.url()) })
  await mount(page, true)
  for (const id of ['demo:d1', 'demo:d6']) {
    await choose(page, id)
    const tabs = page.getByRole('tablist', { name: '거래 데이터 항목' })
    await expect(tabs.getByRole('tab')).toHaveCount(6)
    await expect(tabs.getByRole('tab', { name: /정산|알림|보고서/ })).toHaveCount(0)
    await page.locator('.cat-heading-tools').getByRole('button', { name: /알림/ }).click()
    const alerts = page.locator('.ctt-bottom-pane[data-tab-id="alerts"]')
    await expect(alerts).toBeVisible()
    await expect(alerts).toBeFocused()
    await expect(alerts).toHaveAttribute('role', 'region')
    await expect(alerts).not.toHaveAttribute('aria-labelledby')
    await bottom(page, '포지션')
  }
  await expect(page.locator('.ctt-bottom-pane[data-tab-id="rebates"],.ctt-bottom-pane[data-tab-id="reports"]')).toHaveCount(0)
  await bottom(page, '포지션')
  await expect(page.locator('.ctt-bottom-pane[data-selected="true"]')).toContainText('거래소')
  expect(mutations).toEqual([])
})

test('계정 화면 이동 콜백이 없으면 열 수 없는 알림 벨을 만들지 않는다', async ({ page }) => {
  await mount(page, 'no-navigation')
  await expect(page.locator('.cat-heading-tools').getByRole('button', { name: /알림/ })).toHaveCount(0)
  await panel(page, '차트')
  await expect(page.getByRole('tab', { name: '알림', exact: true })).toHaveCount(0)
})

for (const width of [320, 844, 1280, 1920]) test(`${width}px 원본 평가 상태와 실행 조작은 같은 헤더에서 차트를 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 }); await mount(page)
  await panel(page, '차트')
  const context = page.locator('.cat-context'), row = context.locator('.cat-context-row')
  const canvas = page.locator('.cst-close-chart canvas').first(), handle = await canvas.elementHandle()
  const evaluation = row.locator('.cat-evaluation'), stop = row.getByRole('button', { name: '중지', exact: true })
  await expect(evaluation).toHaveText('일봉 시뮬레이션 · 2026-08-28 기준')
  await expect(evaluation).toHaveAttribute('title', '일봉 시뮬레이션 · 2026-08-28 기준')
  const geometry = await row.evaluate(element => {
    const bounds = element.getBoundingClientRect(), label = element.querySelector('.cat-strategy-name')!.getBoundingClientRect()
    const status = element.querySelector('.cat-status')!.getBoundingClientRect(), control = element.querySelector('button')!.getBoundingClientRect()
    return { width: bounds.width, overflow: element.scrollWidth - element.clientWidth, nameTop: label.y, nameBottom: label.bottom,
      statusTop: status.y, statusBottom: status.bottom, buttonTop: control.y, buttonBottom: control.bottom, buttonRight: control.right, right: bounds.right }
  })
  expect(geometry.overflow).toBeLessThanOrEqual(1)
  expect(geometry.buttonRight).toBeLessThanOrEqual(geometry.right + 1)
  if (geometry.width >= 620) {
    expect(geometry.statusTop).toBeLessThan(geometry.nameBottom)
    expect(geometry.statusBottom).toBeGreaterThan(geometry.nameTop)
    expect(geometry.buttonTop).toBeLessThan(geometry.nameBottom)
    expect(geometry.buttonBottom).toBeGreaterThan(geometry.nameTop)
  }
  if (width === 320) expect(geometry.buttonTop).toBeGreaterThanOrEqual(geometry.nameBottom)
  await stop.click()
  await expect(evaluation).toHaveText('평가 대기')
  await expect(row.locator('.cat-status')).toHaveText('중지')
  await expect(row.getByRole('button', { name: '재개', exact: true })).toBeVisible()
  expect(await canvas.evaluate((element, previous) => element === previous, handle)).toBe(true)
  await row.getByRole('button', { name: '재개', exact: true }).click()
  await expect(row.locator('.cat-status')).toHaveText('실행 중')
  expect(await canvas.evaluate((element, previous) => element === previous, handle)).toBe(true)
  await context.screenshot({ path: info.outputPath(`context-header-${width}.png`) })
})

test('오류 전략의 헤더 재연결은 중지로만 복구하고 차트·같은 전략을 보존한다', async ({ page }) => {
  await mount(page); await choose(page, 'demo:d6'); await panel(page, '차트')
  const row = page.locator('.cat-context-row'), canvas = page.locator('.cst-close-chart canvas').first(), handle = await canvas.elementHandle()
  await expect(row.locator('.cat-evaluation')).toHaveText('평가 중단됨')
  await row.getByRole('button', { name: '다시 연결', exact: true }).click()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'demo:d6')
  await expect(row.locator('.cat-status')).toHaveText('중지')
  await expect(row.locator('.cat-evaluation')).toHaveText('평가 대기')
  await expect(row.getByRole('button', { name: '재개', exact: true })).toBeVisible()
  expect(await canvas.evaluate((element, previous) => element === previous, handle)).toBe(true)
})

test('실제 컨테이너619·620·621px에서 원본 단일행 경계를 적용한다', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 }); await mount(page)
  const context = page.locator('.cat-context'), row = context.locator('.cat-context-row')
  for (const width of [619, 620, 621]) {
    await context.evaluate((element, width) => { element.style.width = `${width + 24}px` }, width)
    await expect.poll(() => row.evaluate(element => getComputedStyle(element).flexWrap)).toBe(width < 620 ? 'wrap' : 'nowrap')
    const g = await row.evaluate(element => ({ width: element.getBoundingClientRect().width, overflow: element.scrollWidth - element.clientWidth }))
    expect(g.width).toBe(width); expect(g.overflow).toBeLessThanOrEqual(1)
  }
})

for (const callback of ['missing', 'pending'] as const) test(`사용자 헤더 ${callback} 콜백은 평가 시각을 만들지 않고 중복 실행을 막는다`, async ({ page }) => {
  await mount(page, false, callback); await panel(page, '차트')
  const button = page.locator('.cat-context-tools').getByRole('button', { name: '지금 시작', exact: true })
  await expect(page.locator('.cat-evaluation')).toHaveCount(0)
  if (callback === 'missing') await expect(button).toBeDisabled()
  await button.evaluate(element => { element.click(); element.click() })
  await expect(button).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'sourceTerminalCalls').statuses)).toEqual(callback === 'missing' ? [] : ['1000:live'])
  if (callback === 'pending') {
    await menu(page, 'user:1000')
    await expect(page.getByRole('menuitem', { name: '지금 시작', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await choose(page, 'demo:d2'); await choose(page, 'user:1000'); await panel(page, '차트')
    await expect(button).toBeDisabled()
    await button.evaluate(element => element.click())
    expect(await page.evaluate(() => Reflect.get(window, 'sourceTerminalCalls').statuses)).toEqual(['1000:live'])
    await page.evaluate(() => Reflect.get(window, 'resolveSourceUserStatus')())
    await expect(button).toBeEnabled()
  }
  // The callback resolving is not a new observed strategy state.
  await expect(page.locator('.cat-context .cat-status')).toHaveText('실행 전')
  await expect(page.locator('.cat-evaluation')).toHaveCount(0)
})

test('상태 요청 실패 뒤 전략별 잠금이 풀리고 명시 재시도를 허용한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page, false, 'pending'); await panel(page, '차트')
  const button = page.locator('.cat-context-tools').getByRole('button', { name: '지금 시작', exact: true })
  await button.click(); await expect(button).toBeDisabled()
  await choose(page, 'demo:d2')
  await page.evaluate(() => Reflect.get(window, 'rejectSourceUserStatus')())
  await expect(page.getByRole('alert')).toContainText('전략 상태를 확인해주세요')
  await expect(page.getByText('상태 확인 fixture 실패', { exact: true })).toHaveCount(0)
  await choose(page, 'user:1000'); await panel(page, '차트')
  await expect(button).toBeEnabled(); await button.click()
  expect(await page.evaluate(() => Reflect.get(window, 'sourceTerminalCalls').statuses)).toEqual(['1000:live', '1000:live'])
  await page.evaluate(() => Reflect.get(window, 'resolveSourceUserStatus')())
  await expect(button).toBeEnabled(); await expect(page.getByRole('alert')).toHaveCount(0)
  expect(errors).toEqual([])
})

for (const result of ['resolve', 'reject'] as const) test(`앞선 요청의 지연 ${result}가 뒤 전략의 오류 안내를 덮어쓰지 않는다`, async ({ page }) => {
  await mount(page, false, 'pending'); await panel(page, '차트')
  await page.locator('.cat-context-tools').getByRole('button', { name: '지금 시작', exact: true }).click()
  await choose(page, 'demo:d2'); await panel(page, '차트')
  await page.locator('.cat-context-tools').getByRole('button', { name: '재개', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('재검증 점수 68점')
  await page.evaluate(result => Reflect.get(window, result === 'resolve' ? 'resolveSourceUserStatus' : 'rejectSourceUserStatus')(), result)
  await choose(page, 'user:1000'); await panel(page, '차트')
  await expect(page.locator('.cat-context-tools').getByRole('button', { name: '지금 시작', exact: true })).toBeEnabled()
  await expect(page.getByRole('alert')).toContainText('재검증 점수 68점')
  expect(await page.evaluate(() => Reflect.get(window, 'sourceTerminalCalls').statuses)).toEqual(['1000:live'])
})

test('열린 상태 오류와 출처 안내가 언어 변경을 따른다', async ({ page }) => {
  await mount(page); await choose(page, 'demo:d2'); await panel(page, '차트')
  await page.locator('.cat-context-tools').getByRole('button', { name: '재개', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('재검증 점수 68점')
  await page.evaluate(() => Reflect.get(window, 'setSourceTerminalPreference')('language', 'en'))
  await expect(page.getByRole('alert')).not.toContainText('재검증 점수')
  await expect(page.locator('.cst-context-note')).not.toContainText('공통 합성 일봉')
})

for (const width of [320, 1440]) test(`${width}px 출처·상태 안내7언어는 같은 차트와 판단 기록을 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await mount(page)
  for (const [id, key] of [['demo:d1', 'evaluating'], ['demo:d2', 'evaluationWaiting'], ['demo:d6', 'evaluationStopped']] as const) {
    await page.evaluate(() => Reflect.get(window, 'setSourceTerminalPreference')('language', 'ko'))
    await choose(page, id); await panel(page, '차트')
    const canvas = page.locator('.cst-close-chart canvas').first(), node = await canvas.elementHandle()
    const context = page.locator('.cst-context-note'), original = await context.elementHandle()
    for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
      await page.evaluate(value => Reflect.get(window, 'setSourceTerminalPreference')('language', value), locale)
      await expect(context).toHaveText(sourceContextText(locale, 'context'))
      const expectedStatus = key === 'evaluating' ? sourceJudgmentText(locale, 'scope', { date: '2026-08-28' }) : sourceContextText(locale, key)
      await expect(page.locator('.cat-evaluation')).toHaveText(expectedStatus)
      await expect(page.locator('.cat-evaluation')).toHaveAttribute('title', expectedStatus)
      await expect(page.locator('.cat-evaluation')).not.toContainText('방금')
      await expect(page.locator('.tft-rfoot')).toHaveText(sourceContextText(locale, 'railFooter'))
      await expect(page.locator('.tft-feed-heading small')).toHaveText(sourceContextText(locale, 'sourceLabel'))
      expect(await context.evaluate((el, previous) => el === previous, original)).toBe(true)
      expect(await canvas.evaluate((el, previous) => el === previous, node)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    }
  }
  await page.evaluate(() => Reflect.get(window, 'setSourceTerminalPreference')('language', 'ko'))
  await choose(page, 'demo:d2'); await panel(page, '차트')
  await page.locator('.cat-context-tools button').click()
  const alert = page.getByRole('alert'), node = await alert.elementHandle()
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'setSourceTerminalPreference')('language', value), locale)
    await expect(alert).toContainText(sourceContextText(locale, 'belowThreshold', { score: '68' }))
    await expect(alert.getByRole('button')).toHaveAccessibleName(sourceContextText(locale, 'closeStatus'))
    await expect(alert.getByRole('button')).toHaveText(sourceContextText(locale, 'close'))
    expect(await alert.evaluate((el, previous) => el === previous, node)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  }
  await alert.screenshot({ path: info.outputPath(`status-notice-fr-${width}.png`) })
})

for (const kind of ['user', 'connection-required'] as const) test(`${kind} 출처 안내의7언어 변경은 미공급 평가 주기를 만들지 않는다`, async ({ page }) => {
  await mount(page, true, kind === 'user' ? 'missing' : undefined); await panel(page, '차트')
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'setSourceTerminalPreference')('language', value), locale)
    await expect(page.locator('.cat-evaluation')).toHaveCount(0)
    await expect(page.locator('.cst-context-note')).toHaveText(sourceContextText(locale, 'context') + (kind === 'user' ? ` · ${sourceContextText(locale, 'paper')}` : ''))
    await expect(page.locator('.tft-feed-heading small')).toHaveText(sourceContextText(locale, 'sourceLabel'))
    if (kind === 'user') await expect(page.locator('.cat-context-tools button')).toBeDisabled()
  }
  expect(await page.evaluate(() => Reflect.get(window, 'sourceTerminalCalls').statuses)).toEqual([])
})

test('미완료 요청 중 언어 변경 후의 오류도 현재 언어로 한 번만 표시한다', async ({ page }) => {
  await mount(page, false, 'pending'); await panel(page, '차트')
  await page.locator('.cat-context-tools button').click()
  await page.evaluate(() => Reflect.get(window, 'setSourceTerminalPreference')('language', 'fr'))
  await page.evaluate(() => Reflect.get(window, 'rejectSourceUserStatus')())
  const alert = page.getByRole('alert')
  await expect(alert).toHaveCount(1)
  await expect(alert).toContainText(sourceContextText('fr', 'check'))
  await expect(alert).not.toContainText('fixture')
  await page.evaluate(() => Reflect.get(window, 'setSourceTerminalPreference')('language', 'en'))
  await expect(alert).toContainText(sourceContextText('en', 'check'))
  await expect(page.locator('.cat-context-tools button')).toBeEnabled()
  expect(await page.evaluate(() => Reflect.get(window, 'sourceTerminalCalls').statuses)).toEqual(['1000:live'])
})

test('상태 알림 닫기는 모바일 터치 크기를 지키고 요청 버튼으로 초점을 돌려준다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await mount(page)
  await choose(page, 'demo:d2'); await panel(page, '차트')
  const trigger = page.locator('.cat-context-tools button')
  await trigger.click()
  const close = page.getByRole('button', { name: '전략 상태 알림 닫기' })
  const box = (await close.boundingBox())!
  expect.soft(box.width).toBeGreaterThanOrEqual(44)
  expect.soft(box.height).toBeGreaterThanOrEqual(44)
  await close.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

for (const origin of ['body', 'external', 'hidden', 'inert', 'disabled', 'detached'] as const) test(`알림 닫기는 ${origin} 요청 초점 대신 현재 터미널의 가시 조작으로 복귀한다`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await mount(page)
  await choose(page, 'demo:d2'); await panel(page, '차트')
  const trigger = page.locator('.cat-context-tools button')
  if (origin === 'body' || origin === 'external') {
    await page.evaluate(origin => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      if (origin === 'external') { const button = document.createElement('button'); button.textContent = '외부 조작'; button.id = 'external-focus-test'; document.body.append(button); button.focus() }
    }, origin)
    await trigger.evaluate(el => el.click())
  } else await trigger.click()
  await expect(page.getByRole('alert')).toContainText('68점')
  if (origin === 'hidden') await trigger.evaluate(el => { el.hidden = true })
  if (origin === 'inert') await trigger.evaluate(el => { el.parentElement!.inert = true })
  if (origin === 'disabled') await trigger.evaluate(el => { el.disabled = true })
  if (origin === 'detached') { await choose(page, 'demo:d1'); await panel(page, '차트') }
  await page.getByRole('button', { name: '전략 상태 알림 닫기' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  if (origin === 'hidden' || origin === 'inert' || origin === 'disabled') await expect(page.locator('.ctt-selector-button')).toBeFocused()
  else await expect(page.locator('.cat-context-tools button')).toBeFocused()
})

test('데스크톱에서 실행 버튼이 비활성인 다른 전략으로 옮긴 뒤 알림을 닫아도 초점이 남는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await mount(page, false, 'missing')
  await choose(page, 'demo:d2')
  await page.locator('.cat-context-tools button').click()
  await expect(page.getByRole('alert')).toContainText('68점')
  await choose(page, 'user:1000')
  await expect(page.locator('.cat-context-tools button')).toBeDisabled()
  await expect(page.locator('.ctt-main-tabs')).toBeHidden()
  await expect(page.locator('.ctt-header')).toBeHidden()
  await page.getByRole('button', { name: '전략 상태 알림 닫기' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.ctt-selector-button')).toBeFocused()
})

test('메뉴 상태 변경 실패는 일반화된 인라인 안내 한 곳에만 표시한다', async ({ page }) => {
  await mount(page, false, 'pending'); await menu(page, 'user:1000')
  await page.getByRole('menuitem', { name: '지금 시작', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'rejectSourceUserStatus')())
  await expect(page.getByRole('alert')).toHaveCount(1)
  await expect(page.getByRole('alert')).toContainText('요청을 완료하지 못했습니다')
  await expect(page.locator('.ctt-notice')).toHaveCount(0)
  await expect(page.getByText('상태 확인 fixture 실패', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: '지금 시작', exact: true })).toBeEnabled()
})

test('답변을 펼친 상태에서도 판단 더 보기 접근이 가능하고 시각 검수 캡처를 남긴다', async ({ page }, testInfo) => {
  await mount(page)
  const seed = sourceTerminalSeeds[0]
  const records = [...evaluateSourceTerminal(seed.parameters, seed.capital).L.evs].reverse()
  const groupEnds: number[] = []
  records.forEach((event, i) => {
    if (i > 0 && (event.k === 'watch' || event.k === 'risk') && event.k === records[i - 1].k) groupEnds[groupEnds.length - 1] = i + 1
    else groupEnds.push(i + 1)
  })
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await panel(page, '차트')
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.client-source-terminal')?.scrollTo(0, 0) })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `/tmp/teth-source-terminal-visual/${testInfo.project.name}-${width}-chart.png` })
    await analysis(page, 'Agent')
    await page.locator('.cst-composer input').fill('손절 기준 설명')
    await page.locator('.cst-composer form button').click()
    await expect(page.locator('.cst-answer')).toBeVisible()
    await page.screenshot({ path: `/tmp/teth-source-terminal-visual/${testInfo.project.name}-${width}-agent-answer.png` })
    const before = await page.locator('.teth-agent-feed [data-agent-event]').count()
    const expectedGroups = Math.min(before + 20, groupEnds.length)
    await page.getByRole('button', { name: /^이전 판단 더 보기/ }).click({ timeout: 8000 })
    await expect(page.locator('.teth-agent-feed [data-agent-event]')).toHaveCount(expectedGroups)
    await expect(page.locator('.teth-agent-feed')).toHaveAttribute('data-visible-count', String(groupEnds[expectedGroups - 1]))
    await expect(page.locator(`[data-agent-index="${groupEnds[before - 1]}"]`)).toBeFocused()
    await expect(page.locator('.cst-answer')).toBeVisible()
    await page.screenshot({ path: `/tmp/teth-source-terminal-visual/${testInfo.project.name}-${width}-agent-more.png` })
    await page.locator('.cst-answer').getByRole('button', { name: '닫기', exact: true }).click({ timeout: 8000 })
  }
})

test('6개 원본 전략의 메타데이터와 손익은 해당 파라미터 fixture 계산과 일치한다', async ({ page }) => {
  await mount(page)
  await panel(page, '전략')
  await expect(page.locator('.tft-card')).toHaveCount(6)
  for (const seed of sourceTerminalSeeds) {
    const card = page.locator(`[data-strategy-id="demo:${seed.id}"]`)
    const result = evaluateSourceTerminal(seed.parameters, seed.capital)
    await expect(card.locator('.nm')).toHaveText(seed.name)
    await expect(card.locator('.sy')).toContainText(seed.symbol)
    await expect(card.locator('.ver')).toHaveText(seed.version)
    await expect(card.locator('.cap')).toHaveText(previewUsd(seed.capital))
    await expect(card.locator('.pnl')).toContainText(`${result.pnl < 0 ? '−' : '+'}${previewUsd(result.pnl)}`)
    await expect(card.locator('.pnl small:not(.vl)')).toHaveText(`${result.pnlPct >= 0 ? '+' : ''}${result.pnlPct.toFixed(1)}%`)
    await expect(card.locator('.vl')).toHaveCount(1)
    await expect(card.locator('.vl')).toHaveText('검증')
    await expect(card).toHaveClass(new RegExp(`st-${seed.status}`))
  }
  await expect(page.locator('.tft-rfoot')).toContainText('시뮬레이션')
})

test('합성 종가는 실제 canvas 차트로 표시하고 OHLC와 실제 시세로 가장하지 않는다', async ({ page }) => {
  await mount(page)
  await panel(page, '차트')
  await expect(page.locator('.cst-close-chart canvas').first()).toBeVisible()
  await expect(page.locator('.cst-close-chart')).toContainText('1D · 원본 종가')
  await expect(page.locator('.cst-close-chart footer')).toContainText('실제 시세 아님')
  await expect(page.locator('.cst-close-chart footer')).toContainText('OHLC·거래량 미제공')
  await expect(page.locator('.cst-context-note')).toContainText('공통 합성 일봉')
  await page.getByRole('button', { name: '전체 구간', exact: true }).click()
  await expect(page.locator('.cst-close-chart canvas').first()).toBeVisible()
})

test('선택 전략의 Agent 판단·대시보드·완료 거래가 같은 전략으로 이어진다', async ({ page }) => {
  await mount(page)
  await choose(page, 'demo:d6')
  await analysis(page, 'Agent')
  await expect(page.locator('.teth-agent-feed')).toHaveAttribute('data-agent-strategy', 'demo:d6')
  await expect(page.locator('.teth-agent-feed [role="alert"]')).toContainText(sourceTerminalSeeds[5].error!)
  await expect(page.locator('.cat-context-row')).toContainText('LINK/USDT')
  await page.getByRole('button', { name: '거래 기록', exact: true }).click()
  await expect(page.locator('[data-agent-event]')).toHaveCount(14)
  await page.locator('[data-agent-event]').first().locator('.tb-rule-toggle').click()
  await expect(page.locator('[data-agent-event]').first().locator('.tm-rows')).toBeVisible()
  await expect(page.locator('[data-agent-event]').first().locator('.tm-out').first()).toContainText('LINK/USDT')
  await expect(page.locator('[data-agent-event]').first().locator('.tm-provenance')).toContainText('시뮬레이션')
  await page.locator('[data-agent-event]').first().screenshot({ path: test.info().outputPath('journal-workspace-evidence.png') })
  await analysis(page, '대시보드')
  await expect(page.locator('.cst-dashboard')).toContainText('거래 수13회')
  await expect(page.locator('.cst-dashboard .cst-table tbody tr')).toHaveCount(13)
  await analysis(page, '완료된 거래')
  await expect(page.locator('.cst-completed h3')).toContainText('13건 중 최근 12')
  await expect(page.locator('.cst-completed-trade')).toHaveCount(12)
  await expect(page.locator('.cst-completed-trade').first()).toContainText('LONG · 체인링크')
  await choose(page, 'demo:d2')
  await analysis(page, '완료된 거래')
  await expect(page.locator('.cst-completed-trade')).toHaveCount(9)
  await expect(page.locator('.cst-completed-trade').first()).toContainText('LONG · 이더리움')
})

test('실제 workspace의 복제 안내와 헤더 동작은 7언어 변경에도 같은 전략·차트를 유지한다', async ({ page }) => {
  await mount(page)
  await panel(page, '차트')
  const canvas = page.locator('.cst-close-chart canvas').first()
  const handle = await canvas.elementHandle()
  await menu(page)
  await page.getByRole('menuitem', { name: '다른 거래소에 복제' }).click()
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async value => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', value) }, locale)
    await expect(page.locator('.csa-dialog .ntc')).toContainText(strategyActionsText(locale, 'cloneDescription'))
    for (const note of await page.locator('.csa-dialog .rs').all()) await expect(note).toHaveText(strategyActionsText(locale, 'cloneExchangeNote'))
    await expect(page.locator('.cst-context-actions button')).toHaveText(strategyActionsText(locale, 'headerStop'))
    expect(await canvas.evaluate((el, previous) => el === previous, handle)).toBe(true)
    await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'demo:d1')
    await expect(page.locator('.tft-card')).toHaveCount(6)
  }
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-strategy-id="demo:d1"] .mn')).toBeFocused()
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', 'ko') })
  await panel(page, '차트')
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', 'fr') })
  await page.locator('.cst-context-actions button').click()
  await expect(page.locator('.cst-context-actions button')).toHaveText(strategyActionsText('fr', 'headerResume'))
  expect(await canvas.evaluate((el, previous) => el === previous, handle)).toBe(true)
})

test('사용자 전략의 상세 버튼과 pending 실행 버튼은 언어 변경으로 권한·상태를 만들지 않는다', async ({ page }) => {
  await mount(page, false, 'pending')
  await panel(page, 'Agent')
  const detail = page.locator('.cat-brain .cst-context-actions button')
  await expect(detail).toHaveText('전략 상세')
  await expect(detail).toBeDisabled()
  await panel(page, '차트')
  const button = page.locator('.cat-context-tools button')
  await button.click()
  for (const locale of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async value => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', value) }, locale)
    await expect(detail).toHaveText(strategyActionsText(locale, 'detail'))
    await expect(detail).toBeDisabled()
    await expect(button).toHaveText(strategyActionsText(locale, 'start'))
    await expect(button).toBeDisabled()
    expect(await page.evaluate(() => Reflect.get(window, 'sourceTerminalCalls').statuses)).toEqual(['1000:live'])
  }
  await page.evaluate(() => Reflect.get(window, 'resolveSourceUserStatus')())
  await expect(button).toBeEnabled()
  await expect(button).toHaveText(strategyActionsText('fr', 'start'))
  expect(await page.evaluate(() => Reflect.get(window, 'sourceTerminalCalls').navigation)).toEqual([])
})

test('전략 이름 변경이 목록·선택 헤더·운영 기록에 반영된다', async ({ page }) => {
  await mount(page)
  await menu(page)
  await page.getByRole('menuitem', { name: '이름 변경', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '이름 변경', exact: true })
  await dialog.getByRole('textbox', { name: '전략 이름', exact: true }).fill('내 비트코인 추세 전략')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.ctt-selector-button')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('[data-strategy-id="demo:d1"] .mn')).toBeFocused()
  await expect(page.locator('[data-strategy-id="demo:d1"] .nm')).toHaveText('내 비트코인 추세 전략')
  await analysis(page, 'Agent')
  await expect(page.locator('.cat-strategy-name')).toHaveAttribute('title', '내 비트코인 추세 전략 v3.4')
  await expect(page.getByRole('list', { name: '운영 기록', exact: true })).toContainText('내 비트코인 추세 전략')
})

test('전략 선택기 안 이름 변경 취소는 원래 메뉴 버튼으로 복귀하고 Escape는 한 층씩 닫는다', async ({ page }) => {
  await mount(page)
  await page.locator('.cat-expand').click()
  await menu(page)
  await page.getByRole('menuitem', { name: '이름 변경', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '이름 변경', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('textbox').fill('저장하지 않을 이름')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('[data-strategy-id="demo:d1"] .mn')).toBeFocused()
  await expect(page.locator('.ctt-selector-button')).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(page.locator('.ctt-rail')).toBeHidden()
  await expect(page.locator('.ctt-modal')).toBeVisible()
  await expect(page.locator('.ctt-selector-button')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ctt-modal')).toBeHidden()
  await expect(page.locator('.cat-expand')).toBeFocused()
  await expect(page.locator('[data-strategy-id="demo:d1"] .nm')).toHaveText('BTC 돌파 추종')
})

test('다른 전략의 상세 메뉴는 그 전략을 선택하고 모바일 Agent 대시보드까지 바로 연다', async ({ page }) => {
  await mount(page)
  await menu(page, 'demo:d2')
  await page.getByRole('menuitem', { name: '전략 상세', exact: true }).click()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'demo:d2')
  await expect(page.locator('.cst-dashboard')).toBeVisible()
  await expect(page.getByRole('tablist', { name: '전략 분석' }).getByRole('tab', { name: '대시보드', exact: true })).toHaveAttribute('aria-selected', 'true')
  const regions = page.getByRole('tablist', { name: '터미널 영역', exact: true })
  if (await regions.isVisible()) await expect(regions.getByRole('tab', { name: '판단', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.cst-dashboard .cst-table thead th')).toHaveText(['청산일', '구분', '진입가', '청산가', '보유', '손익'])
  await expect(page.locator('.cst-dashboard .cst-table tbody tr')).toHaveCount(9)
})

test('복제는 원본을 바꾸지 않고 실행 전 사본을 만들며 새 사본을 선택한다', async ({ page }) => {
  await mount(page)
  await menu(page)
  await page.getByRole('menuitem', { name: '복제', exact: true }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.locator('.tft-card')).toHaveCount(7)
  const copy = page.locator('[data-strategy-id^="clone:"]')
  await expect(copy.locator('.nm')).toHaveText('BTC 돌파 추종 사본')
  await expect(copy).toHaveClass(/st-ready/)
  await expect(copy.locator('.ver')).toHaveText('v1.0')
  const copiedId = await copy.getAttribute('data-strategy-id')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', copiedId!)
  await expect(page.locator('[data-strategy-id="demo:d1"]')).toHaveClass(/st-live/)
  await expect(page.locator('[data-strategy-id="demo:d1"] .nm')).toHaveText('BTC 돌파 추종')
  await analysis(page, 'Agent')
  await expect(page.getByRole('list', { name: '운영 기록', exact: true })).toContainText('복제됨')
})

test('중지와 재개는 목록·차트 상태·Agent 운영 기록에 동일하게 반영된다', async ({ page }) => {
  await mount(page)
  await panel(page, '차트')
  await page.locator('.cst-context-actions').getByRole('button', { name: '중지', exact: true }).click()
  await expect(page.locator('.cat-context .cat-status')).toHaveText('중지')
  await panel(page, '전략')
  await expect(page.locator('[data-strategy-id="demo:d1"]')).toHaveClass(/st-off/)
  await menu(page)
  await page.getByRole('menuitem', { name: '다시 시작', exact: true }).click()
  await expect(page.locator('[data-strategy-id="demo:d1"]')).toHaveClass(/st-live/)
  await analysis(page, 'Agent')
  await expect(page.locator('.cat-context-row .cat-status')).toHaveText('실행 중')
  await expect(page.locator('.csj-status h3')).not.toHaveText('일시정지 중입니다')
  await expect(page.getByRole('list', { name: '운영 기록', exact: true })).toContainText('실행 시작')
  await expect(page.getByRole('list', { name: '운영 기록', exact: true })).toContainText('중지')
})

test('과거 통화 선택은 전략 자금·지표·완료 거래의 USD 표시를 바꾸지 않는다', async ({ page }) => {
  await mount(page)
  await currency(page, 'USD')
  await panel(page, '전략')
  await expect(page.locator('[data-strategy-id="demo:d1"] .cap')).toHaveText('$10,071.94')
  await analysis(page, '대시보드')
  await expect(page.locator('.cst-dashboard .cst-matrix').first().locator('dd').first()).toHaveText('$10,071.94')
  await expect(page.locator('.cst-dashboard .cst-table tbody tr').first()).toContainText('$')
  await analysis(page, '완료된 거래')
  await expect(page.locator('.cst-completed-trade').first().locator('.cst-matrix')).toContainText('$')
  const matrix = page.locator('.cst-completed-trade').first().locator('.cst-matrix')
  const before = await matrix.textContent()
  for (const obsolete of ['BTC', 'KRW']) {
    await currency(page, obsolete)
    await expect(matrix).toHaveText(before!)
    await expect(matrix).not.toContainText(/[₩₿]/)
  }
})

test('390/1280px에서 전체 패널·긴 전략명·상세 기록에 문서 가로 넘침이나 런타임 오류가 없다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await menu(page)
  await page.getByRole('menuitem', { name: '이름 변경', exact: true }).click()
  await page.getByRole('textbox', { name: '전략 이름', exact: true }).fill('긴 이름의 비트코인 추세 분석과 분할 매수 전략')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const name of ['전략', '차트', 'Agent'] as const) {
      await panel(page, name)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    }
    for (const name of ['대시보드', '완료된 거래', 'Agent'] as const) {
      await analysis(page, name)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    }
  }
  expect(errors).toEqual([])
})

test('전체화면 왕복 후 동일 차트 canvas와 미전송 Agent 입력을 유지한다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => Object.assign(window, { sourceCanvas: document.querySelector('.cst-close-chart canvas') }))
  await analysis(page, 'Agent')
  await page.getByRole('textbox', { name: '전략 Agent에게 질문', exact: true }).fill('아직 전송하지 않은 전략 질문')
  await page.getByRole('button', { name: '터미널 전체화면', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'AI 트레이딩', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: '전략 Agent에게 질문', exact: true })).toHaveValue('아직 전송하지 않은 전략 질문')
  expect(await page.evaluate(() => (window as unknown as { sourceCanvas: Element }).sourceCanvas === document.querySelector('.cst-close-chart canvas'))).toBe(true)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

for (const width of [320, 1440]) test(`${width}px 빠른 수정은 초안 전체 선택만 하며 답변·차트·버전·언어별 예산을 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await mount(page)
  await analysis(page, 'Agent')
  const input = page.locator('.cst-composer input'), controls = page.locator('.cst-manage button')
  const canvas = await page.locator('.cst-close-chart canvas').first().elementHandle()
  await page.locator('.cst-composer .chips button').nth(1).click()
  const answer = await page.locator('.cst-answer').textContent()
  await page.locator('.cst-composer').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`question-answer-${width}.png`) })
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'setSourceTerminalPreference')('language', value), language)
    await expect(page.locator('.cst-manage')).toHaveAccessibleName(sourceQuestionText(language, 'manage'))
    await expect(controls.nth(0)).toHaveText(sourceQuestionText(language, 'stop', { value: '-5%' }))
    await expect(controls.nth(1)).toHaveText(sourceQuestionText(language, 'target', { value: '+10%' }))
    // Current preview convention: 14,000,000 KRW / fixed 1,390 reference rate.
    const draftCommands = ['손절 -5%로 바꿔줘', '익절 +10%로 바꿔줘', '예산 $10,071.94로 바꿔줘']
    for (let index = 0; index < draftCommands.length; index++) {
      await controls.nth(index).focus()
      await page.keyboard.press('Enter')
      await expect(input).toHaveValue(draftCommands[index])
      await expect(input).toBeFocused()
      expect(await input.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([0, draftCommands[index].length])
      await expect(page.locator('.client-strategy-proposal')).toHaveCount(0)
      await expect(page.locator('.cat-context-row')).toContainText('v3.4')
    }
    expect(await page.evaluate(() => Reflect.get(window, 'sourceTerminalCalls').asks)).toEqual([])
    expect(await page.locator('.cst-close-chart canvas').first().evaluate((el, before) => el === before, canvas)).toBe(true)
  }
  await page.evaluate(() => Reflect.get(window, 'setSourceTerminalPreference')('language', 'ko'))
  await expect(page.locator('.cst-answer')).toHaveText(answer!)
  await page.locator('.cst-composer form button').click()
  await expect(page.locator('.cst-answer')).toContainText('지원하지')
  await expect(page.locator('.cat-context-row')).toContainText('v3.4')
  // Even the source placeholder must remain an accepted request, not decoration.
  await input.fill('손절을 -3%로 바꿔 주십시오')
  await page.locator('.cst-composer form button').click()
  await expect(page.locator('.client-strategy-proposal')).toBeVisible()
  await expect(page.locator('.cat-context-row')).toContainText('v3.4')
  await page.screenshot({ path: info.outputPath(`question-manage-${width}.png`) })
})

for (const width of [320, 1280]) test(`${width}px 긴 질문 답변과 두배 글자에도 입력과 키보드 질문에 접근한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 720 })
  await mount(page)
  await analysis(page, 'Agent')
  await page.evaluate(() => Reflect.get(window, 'setSourceTerminalPreference')('language', 'fr'))
  await page.locator('.cst-composer .chips button').nth(2).click()
  await page.locator('.cst-composer').evaluate(root => {
    const sizes = [...root.querySelectorAll<HTMLElement>('*')].map(el => [el, parseFloat(getComputedStyle(el).fontSize)] as const)
    for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`
  })
  const controls = page.locator('.cst-manage button, .cst-composer .chips button')
  for (const control of await controls.all()) {
    await control.focus()
    await expect(control).toBeFocused()
    await expect(control).toBeInViewport({ ratio: .98 })
    expect(await control.evaluate(el => {
      const box = el.getBoundingClientRect(), row = el.parentElement!.getBoundingClientRect()
      return box.left >= row.left - 1 && box.right <= row.right + 1
    })).toBe(true)
  }
  const input = page.locator('.cst-composer input')
  await input.fill('Une question conservée')
  await expect(input).toBeInViewport({ ratio: .98 })
  await expect(page.locator('.cst-composer form button')).toBeInViewport({ ratio: .98 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.locator('.cst-answer').focus()
  await page.keyboard.press('End')
  await page.locator('.cst-answer').getByRole('button', { name: terminalReadText('fr', 'close'), exact: true }).click()
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('Une question conservée')
  await page.screenshot({ path: info.outputPath(`question-fr-200-${width}.png`) })
})

test('새 전략과 심층 분석은 컨트롤러의 명시 콜백을 통해 대화로 이어진다', async ({ page }) => {
  await mount(page)
  await panel(page, '전략')
  await page.getByRole('button', { name: '새 전략', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { sourceTerminalCalls: { newCount: number } }).sourceTerminalCalls.newCount)).toBe(1)
  await analysis(page, 'Agent')
  await page.locator('.cst-composer input').fill('손절 기준 설명')
  await page.locator('.cst-composer form button').click()
  await expect(page.locator('.cst-answer')).toContainText('-5%')
  await page.getByRole('button', { name: '채팅에서 깊게 분석 →', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { sourceTerminalCalls: { asks: string[] } }).sourceTerminalCalls.asks)).toEqual(['BTC 돌파 추종 전략(BTC/USDT, 검증 수익 30.9%, MDD -8.9%)에 대해 더 깊게 분석해줘'])
})

test('변경 비교·취소·동일값·미지원 요청은 전략 버전이나 실행 상태를 변경하지 않는다', async ({ page }) => {
  await mount(page)
  await analysis(page, 'Agent')
  const input = page.getByRole('textbox', { name: '전략 Agent에게 질문' })
  await input.fill('손절 -3%로 바꿔줘. 레버리지 10배')
  await page.getByRole('button', { name: 'Agent에게 보내기' }).click()
  await expect(page.getByRole('region', { name: '전략 변경 비교표', exact: true })).toBeVisible()
  await expect(page.locator('.client-strategy-proposal')).toContainText('미지원이라 반영 안 됨: 레버리지')
  await expect(page.locator('.client-strategy-proposal')).toContainText('위 표의 항목만 반영돼요')
  await page.locator('.client-strategy-proposal').getByRole('button', { name: '취소', exact: true }).click()
  await expect(input).toBeFocused()
  await expect(page.locator('.cat-context-row')).toContainText('v3.4')
  await input.fill('손절 -5%로 바꿔줘')
  await page.getByRole('button', { name: 'Agent에게 보내기' }).click()
  await expect(page.locator('.cst-answer')).toContainText('변경 사항이 없어요')
  await expect(page.locator('.client-strategy-proposal')).toHaveCount(0)
  await input.fill('레버리지 100배로 바꿔줘')
  await page.getByRole('button', { name: 'Agent에게 보내기' }).click()
  await expect(page.locator('.cst-answer')).toContainText('지원하지 않아 적용할 수 없어요')
  await expect(page.locator('.cat-context-row')).toContainText('실행 중')
})

for (const width of [320, 1440]) test(`e08 ${width}px 판단 입력·대시보드 위계와 전체화면 초안을 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  await mount(page)
  await analysis(page, 'Agent')
  const input = page.locator('.cst-composer input'), send = page.locator('.cst-composer form button')
  await expect(input).toHaveCSS('background-color', 'rgb(47, 47, 47)')
  await expect(input).toHaveCSS('font-size', '16px')
  await expect(input).toHaveCSS('border-radius', '19px')
  await expect(send).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(send).toHaveCSS('color', 'rgb(0, 0, 0)')
  const box = (await send.boundingBox())!
  expect(box.width).toBe(box.height)
  await expect(page.locator('.cst-composer .chips button').first()).toHaveCSS('font-size', '13px')
  await input.fill('원본과 함께 유지할 질문')
  const node = await input.elementHandle()
  await page.getByRole('button', { name: '터미널 전체화면', exact: true }).click()
  await expect(input).toHaveValue('원본과 함께 유지할 질문')
  await expect(input).toHaveCSS('background-color', 'rgb(47, 47, 47)')
  await page.getByRole('button', { name: '터미널 닫기', exact: true }).click()
  expect(await input.evaluate((el, old) => el === old, node)).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'setSourceTerminalPreference')('language', 'fr'))
  await page.locator('.cst-composer').evaluate(root => {
    const sizes = [...root.querySelectorAll<HTMLElement>('*')].map(el => [el, parseFloat(getComputedStyle(el).fontSize)] as const)
    for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`
  })
  await input.focus()
  await expect(input).toBeFocused()
  await expect(input).toHaveCSS('outline-style', 'solid')
  for (const button of await page.locator('.cst-composer .chips button').all()) {
    expect(await button.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); const box = el.getBoundingClientRect(); return [...range.getClientRects()].every(r => r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom) })).toBe(true)
  }
  expect(await page.locator('.cst-composer').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.locator('.cst-composer').screenshot({ path: info.outputPath(`e08-composer-fr-200-${width}.png`) })
  await page.evaluate(() => Reflect.get(window, 'setSourceTerminalPreference')('language', 'ko'))
  await analysis(page, '대시보드')
  await expect(page.locator('.cst-matrix dt').first()).toHaveCSS('font-size', '14px')
  await expect(page.locator('.cst-matrix dd').first()).toHaveCSS('font-size', '16px')
  await expect(page.locator('.cst-matrix dd').first()).toHaveCSS('font-weight', '400')
  // An overflow-free label may still split a Korean word mid-syllable.
  // This word fits the column and must wrap as one unit, including at 320px.
  expect(await page.locator('.cst-matrix dt').filter({ hasText: '시뮬레이션' }).first().evaluate(label => {
    const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const at = node.textContent?.indexOf('시뮬레이션') ?? -1
      if (at < 0) continue
      const range = document.createRange()
      range.setStart(node, at); range.setEnd(node, at + '시뮬레이션'.length)
      const rects = [...range.getClientRects()]
      const parent = label.getBoundingClientRect()
      return rects.length === 1 && rects[0].left >= parent.left && rects[0].right <= parent.right
    }
    return false
  })).toBe(true)
  await page.locator('.cst-dashboard').screenshot({ path: info.outputPath(`e08-dashboard-ko-${width}.png`) })
})

test('Agent 입력부도 언어 설정을 따르고 현재 입력과 초점은 유지한다', async ({ page }) => {
  await mount(page)
  await analysis(page, 'Agent')
  const input = page.locator('.cst-composer input')
  await input.fill('아직 작성 중인 질문')
  await input.evaluate(el => el.setSelectionRange(3, 6))
  const node = await input.elementHandle()
  await page.evaluate(() => Reflect.get(window, 'setSourceTerminalPreference')('language', 'en'))
  await expect(page.locator('.cst-composer .chips button').first()).not.toHaveText('리스크 낮춰줘')
  await expect(input).not.toHaveAccessibleName('전략 Agent에게 질문')
  await expect(page.locator('.cst-composer form button')).not.toHaveAccessibleName('Agent에게 보내기')
  await expect(input).toHaveValue('아직 작성 중인 질문')
  await expect(input).toBeFocused()
  expect(await input.evaluate((el, previous) => el === previous, node)).toBe(true)
  expect(await input.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([3, 6])
})

for (const width of [320, 1440]) test(`${width}px 추천 입력은7언어에서도 같은 원본 명령을 실행하고 입력부를 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  await mount(page)
  await analysis(page, 'Agent')
  const input = page.locator('.cst-composer input'), chips = page.locator('.cst-composer .chips button')
  const inputNode = await input.elementHandle(), firstChip = await chips.first().elementHandle()
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await input.fill('질문 작성 중 🧑🏽‍💻')
    await input.evaluate(el => el.setSelectionRange(1, 3))
    await page.evaluate(value => Reflect.get(window, 'setSourceTerminalPreference')('language', value), locale)
    await expect(input).toHaveAccessibleName(sourceProposalText(locale, 'inputLabel'))
    await expect(input).toHaveAttribute('placeholder', sourceProposalText(locale, 'inputPlaceholder'))
    await expect(input).toHaveValue('질문 작성 중 🧑🏽‍💻')
    await expect(input).toBeFocused()
    expect(await input.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([1, 3])
    await expect(chips).toHaveText(sourceAgentPresets.map(preset => sourceProposalText(locale, preset.key)))
    await expect(page.locator('.cst-composer form button')).toHaveAccessibleName(sourceProposalText(locale, 'send'))
    expect(await input.evaluate((el, previous) => el === previous, inputNode)).toBe(true)
    expect(await chips.first().evaluate((el, previous) => el === previous, firstChip)).toBe(true)
    for (const button of await chips.all()) {
      expect(await button.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); const box = el.getBoundingClientRect(); return [...range.getClientRects()].every(r => r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom) })).toBe(true)
      if (width === 320) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    for (const preset of sourceAgentPresets) {
      const expected = createSourceTerminalDiscussion(sourceTerminalSeeds[0], preset.request)
      const view = projectSourceDiscussion(expected.display, locale)
      await chips.filter({ hasText: sourceProposalText(locale, preset.key) }).click()
      await expect(input).toHaveValue('')
      if (view.kind === 'proposal') {
        await expect(page.locator('.client-strategy-proposal tbody tr')).toHaveCount(view.rows.length)
        await expect(page.locator('.client-strategy-proposal')).toContainText(strategyProposalText(locale, 'original', { request: preset.request }))
        await expect(page.locator('.client-strategy-proposal tbody th')).toHaveText(view.rows.map(row => row.label))
        await page.locator('.client-strategy-proposal .rej').click()
      } else {
        await expect(page.locator('.cst-answer > b')).toHaveText(view.title)
        await expect(page.locator('.cst-answer > p')).toHaveText(view.text)
        await page.locator('.cst-answer').getByRole('button', { name: terminalReadText(locale, 'close'), exact: true }).click()
      }
      await expect(input).toBeFocused()
      await expect(page.locator('.cat-context-row')).toContainText('v3.4')
    }
    expect(await page.evaluate(() => Reflect.get(window, 'sourceTerminalCalls').asks)).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  }
  await page.locator('.cst-composer').screenshot({ path: info.outputPath(`composer-fr-${width}.png`) })
})

for (const width of [320, 700]) test(`${width}px 터치 Agent 입력부는 가로세로44px 조작 영역을 제공한다`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: true })
  try {
    const page = await context.newPage()
    await mount(page)
    await analysis(page, 'Agent')
    expect(await page.evaluate(() => matchMedia('(pointer:coarse)').matches)).toBe(true)
    await page.evaluate(() => Reflect.get(window, 'setSourceTerminalPreference')('language', 'fr'))
    for (const button of await page.locator('.cst-composer button').all()) {
      const box = (await button.boundingBox())!
      expect.soft(box.width).toBeGreaterThanOrEqual(44)
      expect.soft(box.height).toBeGreaterThanOrEqual(44)
    }
    await expect(page.locator('.cst-composer input')).toHaveCSS('font-size', '16px')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  } finally { await context.close() }
})

test('7언어 입력은 빈값과 IME를 지키고 직접 쓴 명령을 그대로 전달한다', async ({ page }) => {
  await mount(page)
  await analysis(page, 'Agent')
  const input = page.locator('.cst-composer input'), send = page.locator('.cst-composer form button')
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'setSourceTerminalPreference')('language', value), locale)
    await input.fill('   ')
    await expect(send).toBeDisabled()
    await input.press('Enter')
    await expect(page.locator('.cst-answer,.cst-proposal-scroll')).toHaveCount(0)
    await input.fill('손절 -3%로 바꿔줘')
    for (const properties of [{ isComposing: true }, { keyCode: 229 }]) {
      expect(await input.evaluate((el, properties) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...properties })), properties)).toBe(false)
      await expect(input).toHaveValue('손절 -3%로 바꿔줘')
      await expect(page.locator('.cst-proposal-scroll')).toHaveCount(0)
    }
    await input.press('Enter')
    await expect(page.locator('.client-strategy-proposal')).toContainText(strategyProposalText(locale, 'original', { request: '손절 -3%로 바꿔줘' }))
    await page.locator('.client-strategy-proposal .rej').click()
    await input.fill('<script>my unchanged question {stop}</script>')
    await send.click()
    await page.locator('.cst-answer').getByRole('button', { name: sourceProposalText(locale, 'discuss'), exact: true }).click()
    expect(await page.evaluate(() => Reflect.get(window, 'sourceTerminalCalls').asks.at(-1))).toBe('<script>my unchanged question {stop}</script>. 이 전략 변경이 가능한지 알려줘')
    await page.locator('.cst-answer').getByRole('button', { name: terminalReadText(locale, 'close'), exact: true }).click()
    await expect(input).toBeFocused()
  }
})

test('7언어 변경안 확인은 다음 질문 초안·차트·버전을 보존하고 명시 적용만 중지와 갱신을 만든다', async ({ page }) => {
  await mount(page)
  await analysis(page, 'Agent')
  const canvas = page.locator('.cst-close-chart canvas').first(), canvasNode = await canvas.elementHandle()
  await page.getByRole('button', { name: '위험 낮추기', exact: true }).click()
  const proposal = page.locator('.client-strategy-proposal'), originalProposal = await proposal.elementHandle()
  const base = createSourceTerminalDiscussion(sourceTerminalSeeds[0], '리스크 낮춰줘')
  const input = page.locator('.cst-composer input')
  await input.fill('다음 질문 초안')
  await input.evaluate(el => { (el as HTMLInputElement).setSelectionRange(2, 4) })
  for (const locale of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'ko', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'setSourceTerminalPreference')('language', value), locale)
    await expect(proposal.locator('.comparison-scroll')).toHaveAccessibleName(strategyProposalText(locale, 'comparison'))
    await expect(proposal.locator('.ap')).toHaveText(strategyProposalText(locale, 'stopApply'))
    await expect(proposal.locator('.ap')).toBeEnabled()
    expect(await proposal.evaluate((el, before) => el === before, originalProposal)).toBe(true)
    expect(await canvas.evaluate((el, before) => el === before, canvasNode)).toBe(true)
    const display = projectSourceDiscussion(base.display, locale)
    if (display.kind !== 'proposal') throw new Error('Expected proposal presentation')
    await expect(proposal.locator('tbody tr')).toHaveCount(display.rows.length)
    await expect(proposal.locator('tbody th, tbody td')).toHaveText(display.rows.flatMap(row => [row.label, row.current, row.proposed, row.delta]))
    await expect(input).toHaveValue('다음 질문 초안')
    await expect(input).toBeFocused()
    expect(await input.evaluate(el => [(el as HTMLInputElement).selectionStart, (el as HTMLInputElement).selectionEnd])).toEqual([2, 4])
    await expect(page.locator('.cat-context-row')).toContainText('v3.4')
    await expect(page.locator('[data-strategy-id="demo:d1"]')).toHaveClass(/st-live/)
  }
  await proposal.locator('.ap').click()
  await expect(proposal).toHaveCount(0)
  await expect(page.locator('.cat-context-row')).toContainText('v3.5')
  await expect(page.locator('[data-strategy-id="demo:d1"]')).toHaveClass(/st-off/)
  await expect(input).toHaveValue('다음 질문 초안')
  await expect(input).toBeFocused()
  await expect(page.locator('.cst-apply-notice [role="status"]')).toHaveText(sourceProposalText('fr', 'appliedPaused', { version: 'v3.5' }))
  await page.evaluate(() => Reflect.get(window, 'setSourceTerminalPreference')('language', 'en'))
  await expect(page.locator('.cst-apply-notice [role="status"]')).toHaveText(sourceProposalText('en', 'appliedPaused', { version: 'v3.5' }))
  expect(await canvas.evaluate((el, before) => el === before, canvasNode)).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'sourceTerminalCalls').asks)).toEqual([])
})

test('7언어 설명 응답은 base 수치·다음 질문 초안·원본 심층 대화 내용을 보존한다', async ({ page }) => {
  await mount(page)
  await analysis(page, 'Agent')
  const input = page.locator('.cst-composer input')
  for (const request of ['손절 기준 설명', '이번 판단 다시 분석', '손절 -5% 그대로', '레버리지 3배 <script>원문</script>']) {
    await input.fill(request)
    await page.locator('.cst-composer form button').click()
    const response = page.locator('.cst-answer'), node = await response.elementHandle()
    const base = createSourceTerminalDiscussion(sourceTerminalSeeds[0], request)
    if (base.response.kind === 'proposal') throw new Error('Expected answer')
    await input.fill('작성 중 질문')
    await input.evaluate(el => { (el as HTMLInputElement).setSelectionRange(1, 3) })
    for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
      await page.evaluate(value => Reflect.get(window, 'setSourceTerminalPreference')('language', value), locale)
      const view = projectSourceDiscussion(base.display, locale)
      if (view.kind !== 'answer') throw new Error('Expected answer presentation')
      await expect(response.locator('> b')).toHaveText(view.title)
      await expect(response.locator('> p')).toHaveText(view.text)
      await expect(response.getByRole('button').first()).toHaveText(sourceProposalText(locale, base.response.kind === 'explanation' ? 'deepAnalysis' : 'discuss'))
      expect(await response.evaluate((el, before) => el === before, node)).toBe(true)
      await expect(input).toBeFocused()
      await expect(input).toHaveValue('작성 중 질문')
      expect(await input.evaluate(el => [(el as HTMLInputElement).selectionStart, (el as HTMLInputElement).selectionEnd])).toEqual([1, 3])
      await expect(page.locator('.cat-context-row')).toContainText('v3.4')
    }
    await response.getByRole('button').first().click()
    expect(await page.evaluate(() => Reflect.get(window, 'sourceTerminalCalls').asks.at(-1))).toBe(base.response.followup)
    await response.getByRole('button').last().click()
    await expect(response).toHaveCount(0)
    await expect(input).toBeFocused()
    await expect(input).toHaveValue('작성 중 질문')
  }
  await expect(page.locator('.cst-composer script')).toHaveCount(0)
})

for (const width of [320, 1440]) test(`${width}px source 4개 변경 항목과 모든 조정·미지원 사유는7언어로 표시한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  await mount(page)
  await analysis(page, 'Agent')
  const request = '손절 -3.5% 익절 13.5% RSI 43 추세 필터 끄기 EMA 부분 청산 레버리지 타임프레임'
  const base = createSourceTerminalDiscussion(sourceTerminalSeeds[0], request)
  const proposal = page.locator('.client-strategy-proposal')
  await page.locator('.cst-composer input').fill(request)
  await page.locator('.cst-composer form button').click()
  const original = await proposal.elementHandle()
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'setSourceTerminalPreference')('language', value), locale)
    const view = projectSourceDiscussion(base.display, locale)
    if (view.kind !== 'proposal') throw new Error('Expected proposal')
    await expect(proposal.locator('tbody th')).toHaveText(view.rows.map(row => row.label))
    await expect(proposal.locator('tbody td')).toHaveText(view.rows.flatMap(row => [row.current, row.proposed, row.delta]))
    await expect(proposal).toContainText(view.notes.join(', '))
    await expect(proposal).toContainText(view.unsupported.join(', '))
    await expect(proposal.locator('tbody tr')).toHaveCount(4)
    expect(await proposal.evaluate((el, before) => el === before, original)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    await expect(page.locator('.cat-context-row')).toContainText('v3.4')
  }
  await proposal.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`source-proposal-fr-${width}.png`) })
})

test('원본 적용 완료→바로 재개는 명시 클릭에서만 동작하고7언어·초안·같은 차트를 보존한다', async ({ page }) => {
  await mount(page)
  await analysis(page, 'Agent')
  const canvas = await page.locator('.cst-close-chart canvas').first().elementHandle()
  await expect(page.locator('[data-strategy-id="demo:d1"] .vl')).toHaveText('검증')
  await page.getByRole('button', { name: '위험 낮추기', exact: true }).click()
  await page.locator('.cst-composer input').fill('재개 뒤에도 이 질문은 유지')
  await page.locator('.client-strategy-proposal .ap').click()
  const notice = page.locator('.cst-applied')
  await page.setViewportSize({ width: 320, height: 900 })
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'setSourceTerminalPreference')('language', value), locale)
    await expect(notice.getByRole('status')).toHaveText(sourceProposalText(locale, 'appliedPaused', { version: 'v3.5' }))
    await expect(notice.getByRole('button')).toHaveText(sourceProposalText(locale, 'resumeApplied'))
    const box = await notice.getByRole('button').boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(36)
    await expect(page.locator('[data-strategy-id="demo:d1"]')).toHaveClass(/st-off/)
    await expect(page.locator('[data-strategy-id="demo:d1"] .vl')).toHaveText(accountTerminalText(locale, 'validation'))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await notice.getByRole('button').focus(); await page.keyboard.press('Enter')
  await expect(notice).toHaveCount(0)
  await expect(page.locator('[data-strategy-id="demo:d1"]')).toHaveClass(/st-live/)
  await expect(page.locator('[data-strategy-id="demo:d1"] .vl')).toHaveText(accountTerminalText('fr', 'validation'))
  await expect(page.locator('.cst-composer input')).toHaveValue('재개 뒤에도 이 질문은 유지')
  await expect(page.locator('.cst-composer input')).toBeFocused()
  expect(await page.locator('.cst-close-chart canvas').first().evaluate((el, before) => el === before, canvas)).toBe(true)
})

test('적용 후 이름을 바꾸면 중지 안내는 유지하고 오래된 바로 재개는 제거한다', async ({ page }) => {
  await mount(page); await analysis(page, 'Agent')
  await page.getByRole('button', { name: '위험 낮추기', exact: true }).click()
  await page.locator('.client-strategy-proposal .ap').click()
  await expect(page.locator('.cst-applied button')).toBeVisible()
  await menu(page)
  await page.getByRole('menuitem', { name: '이름 변경', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '이름 변경', exact: true })
  await dialog.getByRole('textbox', { name: '전략 이름', exact: true }).fill('수정한 전략')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.locator('.cst-applied [role="status"]')).toHaveText(sourceProposalText('ko', 'appliedPaused', { version: 'v3.5' }))
  await expect(page.locator('.cst-applied button')).toHaveCount(0)
  await expect(page.locator('[data-strategy-id="demo:d1"]')).toHaveClass(/st-off/)
})

test('적용 직후 다른 전략으로 이동하면 중지를 유지하고 이전 바로 재개를 가져오지 않는다', async ({ page }) => {
  await mount(page); await analysis(page, 'Agent')
  await page.getByRole('button', { name: '위험 낮추기', exact: true }).click()
  await page.locator('.client-strategy-proposal .ap').click()
  await expect(page.locator('.cst-applied')).toBeVisible()
  await choose(page, 'demo:d2'); await analysis(page, 'Agent')
  await expect(page.locator('.cst-applied')).toHaveCount(0)
  await choose(page, 'demo:d1'); await analysis(page, 'Agent')
  await expect(page.locator('.cst-applied')).toHaveCount(0)
  await expect(page.locator('[data-strategy-id="demo:d1"]')).toHaveClass(/st-off/)
})

test('허용값 조정 후 같은 설정이면 근거와 바꿀 것 없음 안내만 표시한다', async ({ page }) => {
  await mount(page); await analysis(page, 'Agent')
  const input = page.locator('.cst-composer input')
  await input.fill('손절 -4.8%로 바꿔줘'); await input.press('Enter')
  await expect(page.locator('.cst-answer')).toContainText('조정하면 지금 설정과 같아져요')
  await expect(page.locator('.cst-answer')).toContainText('손절 -4.8% → 허용값 -5%로 조정')
  await expect(page.locator('.client-strategy-proposal')).toHaveCount(0)
  await expect(page.locator('.cat-context-row')).toContainText('v3.4')
  for (const locale of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'setSourceTerminalPreference')('language', value), locale)
    await expect(page.locator('.cst-answer b')).toHaveText(sourceProposalText(locale, 'snappedUnchangedTitle'))
    await expect(page.locator('.cst-answer p')).toContainText(sourceProposalText(locale, 'snappedUnchangedText'))
  }
  await page.evaluate(() => Reflect.get(window, 'setSourceTerminalPreference')('language', 'ko'))
  await input.fill('손절 -4.8%로 바꿔줘 레버리지 3배'); await input.press('Enter')
  await expect(page.locator('.cst-answer')).toContainText('레버리지은 아직 규칙 엔진이 지원하지 않아')
  await expect(page.locator('.cst-answer')).toContainText('손절 -4.8% → 허용값 -5%로 조정')
  await expect(page.locator('.client-strategy-proposal')).toHaveCount(0)
})

test('명시 변경 적용은 재계산·버전 이력·중지를 연결하고 기존 차트 DOM을 보존한다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => Object.assign(window, { originalSourceCanvas: document.querySelector('.cst-close-chart canvas') }))
  await analysis(page, 'Agent')
  await page.getByRole('button', { name: '위험 낮추기', exact: true }).click()
  const proposal = page.locator('.client-strategy-proposal')
  await expect(proposal.getByRole('button', { name: '중지하고 적용', exact: true })).toBeEnabled()
  await expect(proposal).toContainText('자동 재개는 없으며')
  await proposal.getByRole('button', { name: '중지하고 적용', exact: true }).click()
  await expect(proposal).toHaveCount(0)
  await expect(page.locator('.cat-context-row')).toContainText('v3.5')
  await expect(page.locator('.cat-context-row')).toContainText('중지')
  await expect(page.locator('.teth-agent-feed')).toContainText('v3.4 → v3.5')
  await expect(page.locator('.teth-agent-feed')).toContainText('설정 적용을 위한 중지예요')
  expect(await page.evaluate(() => (window as unknown as { originalSourceCanvas: Element }).originalSourceCanvas === document.querySelector('.cst-close-chart canvas'))).toBe(true)
  await menu(page)
  await page.getByRole('menuitem', { name: '버전 기록', exact: true }).click()
  const history = page.getByRole('dialog')
  await expect(history).toContainText('v3.4')
  await expect(history).toContainText('v3.5')
  await expect(history).toContainText('손절 -3%')
  const historyText = await history.innerText()
  await page.keyboard.press('Escape')
  await analysis(page, '대시보드')
  await page.getByRole('button', { name: '버전 기록 보기 (v3.5)', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveText(historyText, { useInnerText: true })
})

test('원본 실행 기준 미달 전략은 재개해도 상태와 성공 기록이 바뀌지 않는다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await choose(page, 'demo:d2')
  await panel(page, '차트')
  await page.locator('.cst-context-actions').getByRole('button', { name: '재개', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('재검증 점수 68점')
  await expect(page.getByRole('alert')).toContainText('실행 기준(80점) 미달')
  await expect(page.locator('[data-strategy-id="demo:d2"]')).toHaveClass(/st-off/)
  await analysis(page, 'Agent')
  await expect(page.locator('.teth-agent-feed')).not.toContainText('전략 실행을 재개했어요')
  expect(errors).toEqual([])
})

test('좁고 낮은 화면에서도 변경안 취소·적용 버튼에 직접 접근할 수 있다', async ({ page }, info) => {
  await mount(page)
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 640 }, { width: 320, height: 480 }]) {
    await page.setViewportSize(viewport)
    await analysis(page, 'Agent')
    await page.getByRole('button', { name: '위험 낮추기', exact: true }).click()
    const proposal = page.locator('.client-strategy-proposal')
    await expect(proposal).toBeVisible()
    await expect(page.getByRole('textbox', { name: '전략 Agent에게 질문' }), `${viewport.width}×${viewport.height} 입력창`).toBeInViewport()
    await page.screenshot({ path: `/tmp/teth-source-proposal-layout/${info.project.name}-${viewport.width}-initial.png` })
    const cancel = proposal.getByRole('button', { name: '취소', exact: true })
    await cancel.scrollIntoViewIfNeeded()
    expect(await cancel.evaluate(element => {
      const box = element.getBoundingClientRect()
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
    })).toBe(true)
    await page.screenshot({ path: `/tmp/teth-source-proposal-layout/${info.project.name}-${viewport.width}-actions.png` })
    await cancel.click()
    await expect(page.getByRole('textbox', { name: '전략 Agent에게 질문' })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  }
})

test('원본 하단 여섯 탭과 현재/전체 범위, 계정 전체 자산을 연결한다', async ({ page }) => {
  await mount(page)
  await panel(page, '차트')
  await expect(page.getByRole('tablist', { name: '거래 데이터 항목' }).getByRole('tab')).toHaveText(['포지션', '미체결 주문', '주문 내역', '체결 내역', '종료 포지션', '자산'])
  let pane = await bottom(page, '체결 내역')
  await expect(pane.locator('tbody tr')).toHaveCount(16)
  await expect(pane.locator('tbody tr').first()).toContainText('SELL')
  await expect(pane.locator('tbody tr').nth(1)).toContainText('BUY')
  await page.getByRole('combobox', { name: '데이터 범위' }).selectOption('all')
  const count = sourceTerminalSeeds.reduce((total, seed) => total + Math.min(8, evaluateSourceTerminal(seed.parameters, seed.capital).trades.length) * 2, 0)
  await expect(pane.locator('tbody tr')).toHaveCount(count)
  pane = await bottom(page, '자산')
  await expect(pane).toContainText('계정 전체 범위')
  const allAssets = await pane.innerText()
  await page.getByRole('combobox', { name: '데이터 범위' }).selectOption('current')
  await expect(pane).toHaveText(allAssets, { useInnerText: true })
  await currency(page, 'USD')
  await expect(pane).toContainText('$')
  await expect(pane).not.toContainText('방금 전')
})

for (const width of [320, 1440]) test(`${width}px 종료 포지션과 완료 거래의 판단 기록은 동일 거래 추적을 열며 차트와 복귀 초점을 보존한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await page.evaluate(() => Object.assign(window, { ledgerCanvas: document.querySelector('.cst-close-chart canvas') }))
  const pane = await bottom(page, '종료 포지션')
  await expect(pane.locator('tbody tr')).toHaveCount(10)
  const trigger = pane.locator('tbody tr').first().getByRole('button').first()
  await trigger.click()
  const detail = page.getByRole('dialog', { name: /LONG 거래 추적/ })
  await expect(detail).toBeVisible()
  for (const label of ['진입 결정', '주문 생성', '포지션 관리', '청산 결정', '청산 체결', '최종 결과']) await expect(detail).toContainText(label)
  await expect(detail).toContainText('수수료 왕복 0.2% 반영')
  const firstText = await detail.innerText()
  await page.keyboard.press('Escape')
  await expect(detail).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(pane).toBeVisible()
  await analysis(page, '완료된 거래')
  await page.getByRole('button', { name: '전체 판단 기록 →', exact: true }).first().click()
  await expect(detail).toHaveText(firstText, { useInnerText: true })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '전체 판단 기록 →', exact: true }).first()).toBeFocused()
  expect(await page.evaluate(() => (window as unknown as { ledgerCanvas: Element }).ledgerCanvas === document.querySelector('.cst-close-chart canvas'))).toBe(true)
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[hidden],[inert]')))).toBe(false)
  expect(errors).toEqual([])
})
