import { expect, test, type Page } from '@playwright/test'
import type { ClientAgentEvent, ClientAgentOperation } from '../src/client-agent-view'
import { terminalReadText } from '../src/client-terminal-read-copy'
import type { ClientLanguage } from '../src/client-preferences'
import { ruleCheckText } from '../src/client-rule-check-copy'

const detail: NonNullable<ClientAgentEvent['detail']> = {
  settings: [{ label: '자산', value: '비트코인 (BTC/USDT)' }, { label: '운용 자금', value: '₩1,000,000' }],
  rawSettings: '{"symbol":"BTCUSDT","stop":"-3%"}',
  analysis: [{ title: '시장 상태', text: '공급된 시장 관찰입니다.' }, { title: '규칙 평가', text: '공급된 규칙 평가입니다.' }],
  ticket: { signal: 'BUY', title: '매수 진입', symbol: 'BTC/USDT', fields: [{ label: '기준가', value: '₩12,345' }, { label: '수량 환산', value: '0.0001' }, { label: '손절가', value: '₩12,000' }], justification: '공급된 진입 근거', invalidation: '공급된 무효화 조건' },
}
const eventTypes: ClientAgentEvent['type'][] = ['entry', 'watch', 'risk', 'exit-tp', 'exit-sl', 'exit-time']
const events: ClientAgentEvent[] = Array.from({ length: 40 }, (_, index) => ({ id: `event-${index}`, type: eventTypes[index % 6], timeLabel: `원본 시각 ${index}`, text: `공급된 판단 ${index}`, detail }))
const operations: ClientAgentOperation[] = Array.from({ length: 8 }, (_, index) => ({ id: `operation-${index}`, timeLabel: `작업 시각 ${index}`, label: `운영 상태 ${index}`, text: `공급된 운영 ${index}`, version: `v${index}`, diff: `변경 ${index}` }))
type View = { strategyId: string; events: ClientAgentEvent[] | null; operations?: ClientAgentOperation[]; sourceLabel: string; statusSummary?: string; watchSummaryPrefix?: string; error?: string; ruleJournal?: boolean }
type FeedBridge = { feedUpdate: (view: View) => void; feedReconnects: number }
const view = (patch: Partial<View> = {}): View => ({ strategyId: 'strategy-one', events, operations, sourceLabel: '검증 구간 리플레이, 일봉 시뮬레이션', ...patch })

const journalEvents: ClientAgentEvent[] = Array.from({ length: 40 }, (_, i) => ({ id: `hold-${i}`, type: 'risk', timeLabel: `평가 시각 ${40 - i}`, text: `공급 원문 ${i}`, ruleCheck: { barIndex: 100 - i, rows: [{ label: '손절', value: `${100 + i}`, state: 'na' }], outputs: [{ label: '결과', text: `관측 ${i}` }], provenance: '일봉 시뮬레이션' } }))

test('0eb338 보유 묶음은 모든 날짜 근거·필터·언어·새 기록 갱신을 보존한다', async ({ page }) => {
  const data = view({ events: journalEvents, operations: [], ruleJournal: true })
  await mount(page, data)
  const group = page.locator('[data-agent-event]').first(), toggle = group.locator('.tb-rule-toggle')
  await expect(page.locator('[data-agent-event]')).toHaveCount(1)
  await expect(toggle).toContainText('보유 유지 40회')
  await expect(toggle).toContainText('평가 시각 1 ~ 평가 시각 40')
  await expect(page.locator('.tm-rows')).toHaveCount(0)
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('[data-rule-event]')).toHaveCount(40)
  const id = await toggle.getAttribute('aria-controls')
  await expect(page.locator('.tft-more')).toHaveCount(0)
  expect(await page.locator('[data-rule-event]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-rule-event')))).toEqual(journalEvents.map(event => event.id))
  for (const [i, event] of journalEvents.entries()) await expect(page.locator(`[data-rule-event="${event.id}"] .tm-out`)).toHaveText(`결과관측 ${i}`)
  await page.getByRole('button', { name: '거래 기록', exact: true }).click()
  await expect(page.locator('[data-agent-event]')).toHaveCount(0)
  await page.getByRole('button', { name: '전체', exact: true }).click()
  await expect(page.locator('[data-rule-event]')).toHaveCount(40)
  await locale(page, 'fr')
  await expect(toggle).toContainText(ruleCheckText('fr', 'collapse'))
  // IDs may remount when filtering, but locale and data updates preserve this control.
  const currentId = await toggle.getAttribute('aria-controls')
  expect(id).toBeTruthy()
  await page.evaluate(data => (window as unknown as FeedBridge).feedUpdate(data), { ...data, events: [{ ...journalEvents[0], id: 'new-hold' }, ...journalEvents] })
  await expect(toggle).toHaveAttribute('aria-controls', currentId!)
  await expect(page.locator('[data-rule-event]')).toHaveCount(41)
  await page.evaluate(data => (window as unknown as FeedBridge).feedUpdate(data), { ...data, strategyId: 'other-strategy' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
})

test('0eb338 긴 관망 뒤 진입이 바로 보이고 더보기는 묶음 경계로 초점을 잇는다', async ({ page }) => {
  const watch = journalEvents.map(event => ({ ...event, id: `watch-${event.id}`, type: 'watch' as const }))
  const trades = journalEvents.map((event, i) => ({ ...event, type: i % 2 ? 'exit-tp' as const : 'entry' as const }))
  await mount(page, view({ events: [...watch, ...trades], operations: [], ruleJournal: true }))
  await expect(page.locator('[data-agent-event]')).toHaveCount(14)
  await expect(page.locator('[data-agent-event="hold-0"] .tb-fs')).toContainText('진입 조건이 모두 맞아')
  await page.locator('[data-agent-event="hold-0"] .tb-rule-toggle').click()
  await expect(page.locator('[data-rule-event="hold-0"] .tb-rule-original')).toHaveText(trades[0].text)
  await page.locator('.tft-more').click()
  await expect(page.locator('[data-agent-event="hold-13"]')).toBeFocused()
  await expect(page.locator('[data-agent-event]')).toHaveCount(34)
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-agent-event="hold-13"] .tb-rule-toggle')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-rule-event="hold-13"]')).toBeVisible()
  await page.locator('.tft-more').click()
  await expect(page.locator('[data-agent-event="hold-33"]')).toBeFocused()
  await expect(page.locator('[data-agent-event]')).toHaveCount(41)
  await expect(page.locator('.tft-more')).toHaveCount(0)
  await expect(page.locator('[data-rule-event="hold-0"]')).toBeVisible()
})

test('0eb338 관망과 보유는 서로 다른 묶음이고 진입·청산 순서와 미확인 근거를 보존한다', async ({ page }) => {
  const rows = journalEvents.slice(0, 8).map((event, i) => ({ ...event, type: (['watch', 'watch', 'entry', 'risk', 'risk', 'exit-sl', 'risk', 'risk'] as const)[i] }))
  rows[7] = { ...rows[7], ruleCheck: undefined }
  await mount(page, view({ events: rows, operations: [], ruleJournal: true }))
  expect(await page.locator('[data-agent-event]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-agent-event')))).toEqual(['hold-0', 'hold-2', 'hold-3', 'hold-5', 'hold-6', 'hold-7'])
  await page.locator('.tm-fold').click()
  await page.locator('.tm-foldx .tb-rule-toggle').click()
  await expect(page.locator('.tm-foldx [data-rule-event]')).toHaveCount(2)
  await expect(page.locator('.tm-foldx [data-rule-event]').first()).toHaveAttribute('data-rule-event', 'hold-0')
  await page.getByRole('button', { name: '거래 기록', exact: true }).click()
  await page.getByRole('button', { name: '전체', exact: true }).click()
  await expect(page.locator('.tm-fold')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.tm-foldx .tb-rule-toggle')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.tm-foldx [data-rule-event]')).toHaveCount(2)
  await expect(page.locator('[data-agent-event="hold-7"]')).not.toHaveClass('tb-rl')
  const unknown = { ...rows[0], ruleCheck: { ...rows[0].ruleCheck!, rows: [{ label: '진입가', value: '—', state: 'unknown' as const }] } }
  await page.evaluate(data => (window as unknown as FeedBridge).feedUpdate(data), view({ events: [unknown], operations: [], ruleJournal: true }))
  await expect(page.locator('.tb-fs')).toContainText(unknown.text)
  await expect(page.locator('.tb-fs')).not.toContainText('주문을 내지 않았습니다')
})

for (const width of [264, 430]) test(`0eb338 판단 전문 ${width}px 7언어·200% 줄바꿈과 키보드`, async ({ page }, info) => {
  await page.setViewportSize({ width: 480, height: 1000 })
  await mount(page, view({ events: journalEvents.slice(0, 2), operations: [], ruleJournal: true }), false, width)
  const toggle = page.locator('.tb-rule-toggle')
  await toggle.focus()
  await page.keyboard.press('Space')
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await locale(page, language)
    await expect(toggle).toContainText(ruleCheckText(language, 'collapse'))
    await expect(page.getByRole('button', { name: ruleCheckText(language, 'trades'), exact: true })).toBeVisible()
    await page.locator('.teth-agent-feed').evaluate(root => {
      for (const el of root.querySelectorAll<HTMLElement>('*')) el.style.removeProperty('font-size')
      const sizes = [...root.querySelectorAll<HTMLElement>('*')].map(el => [el, parseFloat(getComputedStyle(el).fontSize)] as const)
      for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`
    })
    expect(await page.locator('.teth-agent-feed').evaluate(root => [...root.querySelectorAll<HTMLElement>('*')].filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1).map(el => el.className)), language).toEqual([])
    const date = page.locator('.tb-rule-toggle>.tb-ft')
    expect(await date.evaluate(el => el.getBoundingClientRect().width + 1 >= Math.min(el.parentElement!.clientWidth, 12 * parseFloat(getComputedStyle(el).fontSize))), language).toBe(true)
    await expect(page.locator('[data-rule-event]')).toHaveCount(2)
  }
  await page.locator('.teth-agent-feed').screenshot({ path: info.outputPath(`journal-${width}-fr-200.png`) })
})

for (const width of [264, 320, 380]) test(`규칙 조건표 ${width}px·7언어·200%에서 값과 상태를 가리지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width: 420, height: 1000 })
  await mount(page, view({ events: [], operations: [] }), false, width)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await locale(page, language)
    await page.evaluate(async language => {
      const fp = '/src/client-terminal-source-fixture.ts', vp = '/src/client-terminal-source-view.ts'
      const f = await import(/* @vite-ignore */ fp), v = await import(/* @vite-ignore */ vp)
      const seed = f.sourceTerminalSeeds[5], result = f.evaluateSourceTerminal(seed.parameters, seed.capital)
      const projected = v.sourceAgentEvents(seed, result, (n: number) => `$${n.toFixed(2)}`, language).filter((e: ClientAgentEvent) => e.type === 'entry' || e.type.startsWith('exit')).slice(0, 4)
      ;(window as unknown as FeedBridge).feedUpdate({ strategyId: `rules-${language}`, events: projected, sourceLabel: 'fixture', operations: [] })
    }, language)
    await expect(page.locator('.tm-card')).toHaveCount(4)
    await expect(page.locator('.tm-card').first().locator('.tm-k')).not.toBeEmpty()
    await page.locator('.teth-agent-feed').evaluate(root => {
      // Reset the prior language's inline scale before measuring this render.
      for (const el of root.querySelectorAll<HTMLElement>('*')) el.style.removeProperty('font-size')
      const sizes = [...root.querySelectorAll<HTMLElement>('*')].map(el => [el, parseFloat(getComputedStyle(el).fontSize)] as const)
      for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`
    })
    const overflow = await page.locator('.teth-agent-feed').evaluate(root => [...root.querySelectorAll<HTMLElement>('.tm-card,.tm-ch,.tm-row,.tm-out,.tm-provenance,.tm-row>*')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => `${el.className}:${el.textContent}`))
    expect(overflow, language).toEqual([])
    const squeezed = await page.locator('.tm-row>span').evaluateAll(labels => labels.filter(label => {
      const row = label.parentElement!, bounds = label.getBoundingClientRect()
      return bounds.width + 1 < Math.min(row.clientWidth, parseFloat(getComputedStyle(label).fontSize) * 10)
    }).map(label => label.textContent))
    expect(squeezed, language).toEqual([])
    await expect(page.locator('.tm-card').first().locator('.tm-provenance')).toBeVisible()
  }
  await page.locator('.tm-card').first().screenshot({ path: info.outputPath(`rule-fr-200-${width}.png`) })
})

test('원본 관망 묶음은 펼침·더보기·언어 전환·필터 왕복에서도 같은 기록을 보존한다', async ({ page }) => {
  const watches: ClientAgentEvent[] = Array.from({ length: 40 }, (_, i) => ({ id: `rule-${i}`, type: 'watch', timeLabel: `2026-01-${40 - i}`, text: `평가 ${i}`, ruleCheck: { barIndex: 100 - i, rows: [{ label: 'RSI < 40', value: '45.0', state: 'no' }], outputs: [], provenance: '평가 기록' } }))
  await mount(page, view({ events: watches, operations: [] }), false, 264)
  const group = page.locator('.tm-foldw'), button = group.locator('.tm-fold')
  await expect(button).toContainText('관망 유지, 40회, 40일')
  await button.click()
  await expect(page.locator('[data-watch-event]')).toHaveCount(14)
  const id = await button.getAttribute('aria-controls')
  await page.locator('.tft-more').click()
  await expect(group).toBeFocused()
  await expect(page.locator('[data-watch-event]')).toHaveCount(34)
  await locale(page, 'en')
  await expect(button).toHaveAttribute('aria-controls', id!)
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(button).toContainText('Watching, 40 checks, 40 days')
  await page.locator('.tft-more').click()
  await expect(page.locator('[data-watch-event]')).toHaveCount(40)
  await expect(group).toBeFocused()
  await page.getByRole('button', { name: terminalReadText('en', 'fillsOnly'), exact: true }).click()
  await expect(group).toHaveCount(0)
  await page.getByRole('button', { name: terminalReadText('en', 'all'), exact: true }).click()
  await expect(page.locator('[data-watch-event]')).toHaveCount(40)
  await button.click()
  await expect(page.locator('[data-watch-event]')).toHaveCount(0)
})

test('e08 판단 기록은 중립 위계·20px 카드와 확대된 원문·키보드 초점을 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await mount(page, view({ statusSummary: '공급된 평가 상태', error: '공급된 연결 오류' }), true, 264)
  const card = page.locator('[data-agent-event="event-0"]')
  await expect(card).toHaveCSS('border-radius', '20px')
  await expect(card).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(card.locator('.agb')).toHaveCSS('font-size', '16px')
  await expect(card.locator('.evb')).toHaveCSS('font-size', '14px')
  await expect(card.locator('.evb')).toHaveCSS('color', 'rgb(205, 205, 205)')
  await expect(card.locator('.agh b')).toHaveCSS('font-weight', '400')
  await expect(page.locator('.tft-nowbar')).toHaveCSS('font-size', '18px')
  await expect(page.locator('.tft-nowbar')).toHaveCSS('border-left-width', '0px')
  await expect(page.getByRole('alert').locator('.bg')).toHaveCSS('color', 'rgb(238, 118, 106)')
  for (const button of await card.locator('.agt').all()) await button.click()
  await card.locator('summary').click()
  const raw = await card.locator('pre').elementHandle()
  await expect(card.locator('.sg')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(card.locator('.sg')).toHaveCSS('color', 'rgb(236, 236, 236)')
  await locale(page, 'fr')
  await page.locator('.teth-agent-feed').evaluate(root => {
    const sizes = [...root.querySelectorAll<HTMLElement>('*')].map(el => [el, parseFloat(getComputedStyle(el).fontSize)] as const)
    for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`
  })
  const overflow = await page.locator('.teth-agent-feed').evaluate(root => [...root.querySelectorAll<HTMLElement>('.tft-agc,.agh,.agt,.agx,.kv,.c3,.th2,.ffc,.tft-filters,.tft-more')].filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1).map(el => el.className))
  expect(overflow).toEqual([])
  await expect(card.locator('pre')).toHaveText(detail.rawSettings!)
  expect(await raw!.evaluate(el => el === document.querySelector('[data-agent-event="event-0"] pre'))).toBe(true)
  // Switch from pointer interaction to real keyboard modality before testing
  // :focus-visible; programmatic focus alone retains the previous modality.
  await page.keyboard.press('Tab')
  await page.locator('.ffc.on').focus()
  await expect(page.locator('.ffc.on')).toHaveCSS('outline-color', 'rgb(154, 154, 154)')
  await expect(page.locator('.ffc.on')).toHaveCSS('outline-style', 'solid')
  expect(await page.locator('.teth-agent-feed').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await card.screenshot({ path: info.outputPath('e08-feed-fr-200.png') })
})

test('연속 관망은 원문을 보존한 묶음이며 더보기 경계를 지나도 초점을 잃지 않는다', async ({ page }) => {
  const watches = Array.from({ length: 40 }, (_, i) => ({ ...events[i], type: 'watch' as const, id: `watch-${i}`, summary: `공급 요약 ${i}` }))
  await mount(page, view({ events: watches, operations: [], statusSummary: '서버가 제공한 공개 상태', watchSummaryPrefix: '원래 연속 기록 수' }))
  await expect(page.locator('.tft-nowbar')).toHaveText('서버가 제공한 공개 상태')
  await expect(page.locator('.wfold')).toHaveCount(1)
  await expect(page.locator('.wfold .agb')).toHaveText('원래 연속 기록 수 40')
  await expect(page.locator('.wfold .agh .tm')).toHaveText('원본 시각 39 ~ 원본 시각 0')
  await expect(page.locator('.teth-agent-feed')).toHaveAttribute('data-visible-count', '14')
  await page.getByRole('button', { name: '봉별 판단 14건 보기', exact: true }).click()
  await expect(page.locator('[data-watch-event]')).toHaveCount(14)
  await expect(page.locator('[data-watch-event]').first()).toContainText(events[0].text)
  await page.locator('.tft-more').click()
  await expect(page.locator('.wfold')).toBeFocused()
  await expect(page.getByRole('button', { name: '봉별 판단 34건 보기', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('[data-watch-event]')).toHaveCount(34)
  await page.locator('.tft-more').click()
  await expect(page.locator('.wfold')).toBeFocused()
  await expect(page.locator('[data-watch-event]')).toHaveCount(40)
  const controlId = await page.locator('.wfold .agt').getAttribute('aria-controls')
  await page.evaluate(data => (window as unknown as FeedBridge).feedUpdate(data), view({ events: [{ ...watches[0], id: 'watch-new' }, ...watches], operations: [], statusSummary: '서버가 제공한 공개 상태', watchSummaryPrefix: '원래 연속 기록 수' }))
  await expect(page.locator('.wfold .agt')).toHaveAttribute('aria-controls', controlId!)
  await expect(page.locator('.wfold .agt')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('[data-watch-event]')).toHaveCount(41)
  await expect(page.locator('.wfold .agb')).toHaveText('원래 연속 기록 수 41')
  await page.getByRole('button', { name: '체결만', exact: true }).click()
  await expect(page.locator('.wfold')).toHaveCount(0)
  await expect(page.locator('.tft-nowbar')).toHaveText('서버가 제공한 공개 상태')
  await expect(page.getByRole('status')).toContainText('체결 판단 기록이 없습니다.')
  await page.getByRole('button', { name: '전체', exact: true }).click()
  await expect(page.locator('[data-watch-event]')).toHaveCount(41)
})

test('공급한 요약과 scan만 표시하고 미공급 상세나 상태를 만들지 않는다', async ({ page }) => {
  await mount(page, view({ events: [{ ...events[0], type: 'scan', summary: '공급된 시장 분석 요약', detail: { settings: [], analysis: [] } }], operations: [] }))
  await expect(page.locator('.tft-agc .evb')).toHaveText('시장 분석')
  await expect(page.locator('.tft-agc .agb')).toHaveText('공급된 시장 분석 요약')
  await expect(page.locator('.agt')).toHaveCount(0)
  await expect(page.locator('.tft-nowbar')).toHaveCount(0)
  await page.evaluate(data => (window as unknown as FeedBridge).feedUpdate(data), view({ events: null, statusSummary: '소실된 과거 상태' }))
  await expect(page.locator('.tft-nowbar')).toHaveCount(0)
})

async function mount(page: Page, data = view(), reconnect = false, width = 380) {
  await page.route('**/agent-feed-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3;font-family:sans-serif"><div id="fixture"></div></body></html>' }))
  await page.goto('/agent-feed-test.html')
  await page.evaluate(async ({ data, reconnect, width }) => {
    localStorage.setItem('tethLang', 'ko')
    for (const font of ['/node_modules/@fontsource-variable/noto-sans-kr/wght.css', '/node_modules/@fontsource-variable/geist/wght.css']) await import(/* @vite-ignore */ font)
    document.body.style.fontFamily = '"Geist Variable", "Noto Sans KR Variable", sans-serif'
    const refresh = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientAgentFeed.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Vite React module missing')
    const reactModule = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp), { ClientAgentFeed } = await import(/* @vite-ignore */ cp)
    const react = reactModule.default ?? reactModule, h = react.createElement
    Object.assign(window, { feedReconnects: 0 })
    function Host() {
      const [current, setCurrent] = react.useState(data)
      Object.assign(window, { feedUpdate: setCurrent })
      return h('div', { style: { width, maxWidth: '100vw' } }, h(ClientAgentFeed, { ...current, watchSummary: current.watchSummaryPrefix ? (count: number) => `${current.watchSummaryPrefix} ${count}` : undefined,
        ...(reconnect ? { onReconnect: () => { (window as unknown as FeedBridge).feedReconnects++ } } : {}),
      }))
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    root.render(h(react.StrictMode, null, h(Host)))
  }, { data, reconnect, width })
  await expect(page.getByRole('region', { name: 'Agent 판단 기록' })).toBeVisible()
  await page.evaluate(async () => { await document.fonts.load('12px "Noto Sans KR Variable"', '판단 기록'); await document.fonts.ready })
}

async function locale(page: Page, language: ClientLanguage) {
  await page.evaluate(async language => {
    const path = '/src/client-preferences.ts'
    const preferences = await import(/* @vite-ignore */ path)
    preferences.setClientPreference('language', language)
  }, language)
  await expect(page.locator('.teth-agent-feed')).toHaveAttribute('aria-label', terminalReadText(language, 'feed'))
  await page.evaluate(async () => { await document.fonts.ready })
}

for (const width of [264, 320, 380]) test(`7언어 ${width}px에서 펼침·Raw·필터·기록 원문과 DOM을 보존한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 400, height: 1000 })
  await mount(page, view({ error: '공급된 연결 오류 $&' }), true, width)
  await page.locator('.tft-more').click()
  await expect(page.locator('[data-agent-event]')).toHaveCount(34)
  await page.getByRole('button', { name: '체결만', exact: true }).click()
  const count = await page.locator('[data-agent-event]').count()
  const first = page.locator('[data-agent-event="event-0"]')
  await first.locator('[data-agent-section="prompt"] > button').click()
    await first.locator('.tft-raw summary').click()
  await first.getByRole('button', { name: '생각의 사슬', exact: true }).click()
  await first.getByRole('button', { name: '거래 결정', exact: true }).click()
  const node = await first.locator('[data-agent-section="prompt"] .agx').elementHandle()
  const control = await first.locator('[data-agent-section="prompt"] > button').getAttribute('aria-controls')
  const raw = await first.locator('pre').elementHandle()
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'ko', 'fr'] as const) {
    const t = (key: Parameters<typeof terminalReadText>[1]) => terminalReadText(language, key)
    await locale(page, language)
    await expect(page.getByRole('group', { name: t('historyFilter'), exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: t('fillsOnly'), exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-agent-event]')).toHaveCount(count)
    await expect(first.locator('[data-agent-section="prompt"] > button')).toContainText(t('promptSection'))
    await expect(first.locator('[data-agent-section="prompt"] > button')).toHaveAttribute('aria-controls', control!)
    expect(await node!.evaluate(el => el === document.querySelector('[data-agent-event="event-0"] [data-agent-section="prompt"] .agx'))).toBe(true)
    expect(await raw!.evaluate(el => el === document.querySelector('[data-agent-event="event-0"] pre'))).toBe(true)
    await expect(first.locator('pre')).toBeVisible()
    await expect(first.locator('pre')).toHaveText(detail.rawSettings!)
    await expect(first.locator('.tft-raw summary')).toHaveText(t('rawSettings'))
    await expect(first.locator('[data-agent-section="rationale"] > button')).toContainText(t('rationaleSection'))
    await expect(first.locator('.evb')).toHaveText(t('eventEntry'))
    await expect(first.locator('.agb')).toHaveText(events[0].text)
    await expect(first.locator('.tm')).toHaveText(events[0].timeLabel)
    await expect(first.locator('.kv b').first()).toHaveText(detail.settings[0].value)
    await expect(first.locator('.js').first()).toContainText(detail.ticket!.justification!)
    await expect(page.locator('[data-agent-operation="operation-0"] .tx')).toHaveText(operations[0].text)
    await expect(page.getByRole('alert').locator('.tx')).toHaveText('공급된 연결 오류 $&')
    await page.getByRole('button', { name: t('reconnect'), exact: true }).click()
    const overflowing = await page.locator('.teth-agent-feed').evaluate(root => [...root.querySelectorAll<HTMLElement>('.tft-filters,.ffc,.agt,.agx,.agh,.kv,.th2,.c3,.evb,.tft-more')].filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1).map(el => el.className))
    expect(overflowing).toEqual([])
    expect(await page.locator('.teth-agent-feed').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
  expect(await page.evaluate(() => (window as unknown as FeedBridge).feedReconnects)).toBe(7)
  await first.screenshot({ path: testInfo.outputPath(`feed-fr-${width}.png`) })
  await page.getByRole('button', { name: terminalReadText('fr', 'all'), exact: true }).click()
  await expect(page.locator('[data-agent-event]')).toHaveCount(34)
  await page.getByRole('button', { name: terminalReadText('fr', 'moreHistory', { count: '6' }), exact: true }).click()
  await expect(page.locator('[data-agent-event]')).toHaveCount(40)
  await expect(page.locator('[data-agent-event="event-34"]')).toBeFocused()
})

test('7언어의 미공급·빈목록·체결 없는 상태를 구분한다', async ({ page }) => {
  await mount(page, view({ events: null, operations: [] }))
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(data => (window as unknown as FeedBridge).feedUpdate(data), view({ events: null, operations: [] }))
    await locale(page, language)
    await expect(page.getByRole('status')).toHaveText(terminalReadText(language, 'unavailable'))
    await page.evaluate(data => (window as unknown as FeedBridge).feedUpdate(data), view({ events: events.slice(0, 6), operations: [] }))
    await page.getByRole('button', { name: terminalReadText(language, 'all'), exact: true }).click()
    const badges = [['eventEntry', 'en'], ['eventWatch', 'wa'], ['eventRisk', 'ho'], ['eventTp', 'tp'], ['eventSl', 'sl'], ['eventTime', 'tm']] as const
    for (const [index, [key, tone]] of badges.entries()) {
      const row = page.locator(`[data-agent-event="event-${index}"]`)
      await expect(row.locator('.evb')).toHaveText(terminalReadText(language, key))
      await expect(row).toHaveClass(`tft-agc ${tone}`)
      if (tone === 'tm') {
        // Period-exit and date share tm, but only the date should be muted.
        const colors = await row.evaluate(el => ({
          badge: getComputedStyle(el.querySelector('.evb')!).color,
          accent: getComputedStyle(el.querySelector('.sp2')!).color,
          date: getComputedStyle(el.querySelector('.tm:not(.evb)')!).color,
        }))
        expect(colors.badge).toBe(colors.accent)
        expect(colors.badge).not.toBe(colors.date)
      }
      await expect(row.locator('.agb')).toHaveText(events[index].text)
    }
    await page.evaluate(data => (window as unknown as FeedBridge).feedUpdate(data), view({ events: [], operations: [] }))
    await expect(page.getByRole('status')).toContainText(terminalReadText(language, 'empty'))
    await expect(page.getByRole('status')).toContainText(terminalReadText(language, 'firstEvaluation'))
    await page.evaluate(data => (window as unknown as FeedBridge).feedUpdate(data), view({ events: [events[1]], operations: [] }))
    await page.getByRole('button', { name: terminalReadText(language, 'fillsOnly'), exact: true }).click()
    await expect(page.getByRole('status')).toHaveText(terminalReadText(language, 'emptyFills'))
  }
})

test('언어 변경은 Agent 화면 안내에 즉시 반영된다', async ({ page }) => {
  await mount(page)
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const preferences = await import(/* @vite-ignore */ path)
    preferences.setClientPreference('language', 'en')
  })
  await expect(page.getByRole('region', { name: 'Agent decision log', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fills only', exact: true })).toBeVisible()
})

test('공급 순서대로 14개와 운영 6개만 표시하고 더보기는 20개씩 공개한다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('[data-agent-event]')).toHaveCount(14)
  await expect(page.locator('[data-agent-operation]')).toHaveCount(6)
  await expect(page.locator('[data-agent-event]').first()).toHaveAttribute('data-agent-event', 'event-0')
  await expect(page.locator('[data-agent-event]').last()).toHaveAttribute('data-agent-event', 'event-13')
  await expect(page.getByText('검증 구간 리플레이, 일봉 시뮬레이션')).toBeVisible()
  const more = page.getByRole('button', { name: '이전 판단 더 보기 (26)' })
  await more.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-agent-event]')).toHaveCount(34)
  await expect(page.locator('[data-agent-event="event-14"]')).toBeFocused()
  await page.getByRole('button', { name: '이전 판단 더 보기 (6)' }).click()
  await expect(page.locator('[data-agent-event]')).toHaveCount(40)
  await expect(page.locator('[data-agent-event="event-34"]')).toBeFocused()
  await expect(page.getByRole('button', { name: /이전 판단 더 보기/ })).toHaveCount(0)
})

test('필터와 상세·USER PROMPT·Raw·판단 근거·티켓을 키보드로 연다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '체결만', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: '체결만', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-agent-event="event-1"]')).toHaveCount(0)
  await expect(page.locator('[data-agent-event="event-2"]')).toHaveCount(0)
  const first = page.locator('[data-agent-event="event-0"]')
  const toggle = first.getByRole('button', { name: '사용자 프롬프트' })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(first.getByRole('button', { name: '사용자 프롬프트' })).toHaveAttribute('aria-expanded', 'true')
  await first.getByRole('button', { name: '생각의 사슬', exact: true }).click()
  await first.getByRole('button', { name: '거래 결정', exact: true }).click()
  await expect(first.getByText('공급된 시장 관찰입니다.')).toBeVisible()
  await expect(first.getByText('매수 진입', { exact: true })).toBeVisible()
  await expect(first.getByText('공급된 진입 근거')).toBeVisible()
  await expect(first.getByText('공급된 무효화 조건')).toBeVisible()
  await expect(first.getByText('비트코인 (BTC/USDT)')).toBeVisible()
  await first.getByText('Raw 설정 보기', { exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(first.locator('pre')).toHaveText(detail.rawSettings!)
  await expect(first.locator('pre')).toBeVisible()
  await first.getByRole('button', { name: '사용자 프롬프트' }).click()
  await expect(first.locator('[data-agent-section="prompt"] .agx')).toBeHidden()
})

test('같은 전략 데이터 갱신은 ID별 펼침을 보존하고 다른 전략에는 이월하지 않는다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '체결만', exact: true }).click()
  await page.locator('[data-agent-event="event-0"] [data-agent-section="prompt"] > button').click()
  await page.evaluate(data => (window as unknown as FeedBridge).feedUpdate(data), view({ events: [events[3], events[0]] }))
  await expect(page.getByRole('button', { name: '체결만', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-agent-event="event-0"] [data-agent-section="prompt"] > button')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('[data-agent-event="event-3"] [data-agent-section="prompt"] > button')).toHaveAttribute('aria-expanded', 'false')
  await page.evaluate(data => (window as unknown as FeedBridge).feedUpdate(data), view({ strategyId: 'strategy-two' }))
  await expect(page.getByRole('button', { name: '전체', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-agent-event]')).toHaveCount(14)
  await expect(page.locator('[data-agent-event="event-0"] [data-agent-section="prompt"] > button')).toHaveAttribute('aria-expanded', 'false')
})

test('미공급·빈목록·체결필터 빈결과를 분리하고 없는 상세나 재연결을 만들지 않는다', async ({ page }) => {
  await mount(page, view({ events: null, operations: [], error: '공급된 연결 오류' }))
  await expect(page.getByText('Agent 판단 기록을 확인하지 못했습니다.')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveText('오류공급된 연결 오류')
  await expect(page.locator('[data-agent-event]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '다시 연결' })).toHaveCount(0)
  await page.evaluate(data => (window as unknown as FeedBridge).feedUpdate(data), view({ events: [], operations: [] }))
  await expect(page.getByText('아직 Agent 판단 기록이 없습니다.')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.evaluate(data => (window as unknown as FeedBridge).feedUpdate(data), view({ events: [{ id: 'watch-only', type: 'watch', timeLabel: '공급 시각', text: '공급된 관망' }], operations: [] }))
  await expect(page.getByRole('button', { name: /사용자 프롬프트|생각의 사슬|거래 결정/ })).toHaveCount(0)
  await page.getByRole('button', { name: '체결만', exact: true }).click()
  await expect(page.getByText('체결 판단 기록이 없습니다.')).toBeVisible()
  await page.getByRole('button', { name: '전체', exact: true }).click()
  await expect(page.getByText('공급된 관망')).toBeVisible()
})

test('제공 오류의 재연결만 호출하고 HTML처럼 보이는 상세는 문자로 표시한다', async ({ page }) => {
  const unsafe = '<img src=x onerror="window.compromised=true">'
  await mount(page, view({ error: '재연결 가능', events: [{ ...events[0], text: unsafe, detail: { settings: [{ label: unsafe, value: unsafe }], rawSettings: unsafe, analysis: [{ title: unsafe, text: unsafe }], ticket: { signal: 'HOLD', title: unsafe, symbol: unsafe, fields: [{ label: unsafe, value: unsafe }], justification: unsafe, invalidation: unsafe } } }] }), true)
  await page.getByRole('button', { name: '다시 연결' }).click()
  expect(await page.evaluate(() => (window as unknown as FeedBridge).feedReconnects)).toBe(1)
  await page.getByRole('button', { name: '사용자 프롬프트' }).click()
    await page.getByRole('button', { name: '생각의 사슬', exact: true }).click()
  await page.getByRole('button', { name: '거래 결정', exact: true }).click()
  await page.locator('.tft-raw > summary').click()
  await expect(page.locator('.tft-raw pre')).toHaveText(unsafe)
  await expect(page.locator('.teth-agent-feed img')).toHaveCount(0)
  expect(await page.evaluate(() => 'compromised' in window)).toBe(false)
})

for (const width of [264, 320]) test(`${width}px 긴 필드·티켓·Raw 내용은 전체 화면을 가로로 밀지 않는다`, async ({ page }) => {
  const long = '공백없는아주긴전략메타데이터AND1234567890'.repeat(6)
  await page.setViewportSize({ width: 320, height: 740 })
  await mount(page, view({ events: [{ ...events[0], text: long, detail: { settings: [{ label: '상세 설정', value: long }], rawSettings: long, analysis: [{ title: long, text: long }], ticket: { signal: 'CLOSE', title: long, symbol: long, fields: Array.from({ length: 3 }, () => ({ label: long, value: long })), justification: long, invalidation: long } } }], operations: [] }), false, width)
  await page.getByRole('button', { name: '사용자 프롬프트' }).click()
    await page.getByRole('button', { name: '생각의 사슬', exact: true }).click()
  await page.getByRole('button', { name: '거래 결정', exact: true }).click()
  await page.locator('.tft-raw > summary').click()
  expect(await page.locator('.teth-agent-feed').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const raw = page.locator('pre')
  expect(await raw.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
  await raw.focus()
  await expect(raw).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => raw.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
})
