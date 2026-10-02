import { expect, test, type Page } from '@playwright/test'
import { sourceSharedStrategies } from '../src/client-shared-strategies'
import { sharedHash } from '../src/client-shared-navigation'
import { sourceTerminalDate, sourceTerminalPrices } from '../src/client-terminal-source-fixture'
import { sharedPerformanceCopy, type SharedPerformanceCopyKey } from '../src/client-shared-performance-copy'
import detailCopy from '../src/client-detail-skin-copy.json' with { type: 'json' }

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const source = [...sourceSharedStrategies()].sort((a, b) => b.result.ret - a.result.ret)[0]
const recent = source.result.trades.slice(-12).reverse()
const previousLabels = ['이전 월', 'Previous month', '前月', '上月', '上月', 'Mes anterior', 'Mois précédent']
const holdingLabels = ['보유기간 분포', 'Holding period distribution', '保有期間の分布', '持仓周期分布', '持倉週期分佈', 'Distribución del período de tenencia', 'Distribution de la durée de détention']
const countTemplates = ['익 {wins}, 손 {losses}', 'W {wins}, L {losses}', '勝 {wins}、負 {losses}', '胜 {wins}，负 {losses}', '勝 {wins}，負 {losses}', 'V {wins}, D {losses}', 'V {wins}, D {losses}']
const headerKeys: SharedPerformanceCopyKey[] = ['진입일', '청산일', '보유', '자산', '구분', '진입가', '청산가', '손익률']
const dateText = (index: number, locale: string) => {
  const date = sourceTerminalDate(index)
  return locale === 'ko' ? `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}` : new Intl.DateTimeFormat(locale, { calendar: 'gregory', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

async function language(page: Page, value: string) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(path)
    setClientPreference('language', value)
  }, value)
  await expect(page.locator('html')).toHaveAttribute('lang', value)
}

async function performance(page: Page) {
  page.setDefaultTimeout(15_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '성과 언어 검수자', email: 'sharing-performance@example.test' }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: null, homeDraft: '보존할 원문 초안', sessions: [], sharedFollows: [] }))
  })
  // This suite protects saved legacy results, not the new source catalogue.
  await page.goto('/' + sharedHash({ nick: source.nick, period: 'all' }))
  const view = page.locator('.client-shared-performance')
  await expect(view).toBeVisible()
  return view
}

for (const [index, locale] of languages.entries()) test(`${locale}원문성과문구와서력월·일요일시작요일은같은공급값에결속한다`, async ({ page }) => {
  const view = await performance(page)
  await language(page, locale)
  await expect(view.locator('.cal-nav').first()).toHaveAttribute('aria-label', previousLabels[index])
  await expect(view.locator('.shared-holding h3')).toHaveText(holdingLabels[index])
  await expect(view.locator('thead th')).toHaveText(headerKeys.map(key => sharedPerformanceCopy(locale, key)))
  await expect(view.locator('.shared-calendar-note')).toHaveText(detailCopy[locale].calendarNote)
  const lastDate = sourceTerminalDate(source.result.eq.at(-1)!.i)
  const heading = locale === 'ko' ? `${lastDate.getFullYear()}년 ${lastDate.getMonth() + 1}월` : new Intl.DateTimeFormat(locale, { calendar: 'gregory', year: 'numeric', month: 'long' }).format(lastDate)
  await expect(view.locator('.shared-calendar-heading h3 span').first()).toHaveText(heading)
  const weekdays = locale === 'ko' ? ['일', '월', '화', '수', '목', '금', '토'] : Array.from({ length: 7 }, (_, day) => new Intl.DateTimeFormat(locale, { calendar: 'gregory', weekday: 'short' }).format(new Date(2024, 0, 7 + day)))
  await expect(view.locator('.cal-hd span')).toHaveText(weekdays)
  const ranges = [[0, 2], [3, 5], [6, 10], [11, 24], [25, Infinity]]
  for (let band = 0; band < ranges.length; band++) {
    const [from, until] = ranges[band], trades = source.result.trades.filter(trade => trade.exit - trade.entry >= from && trade.exit - trade.entry <= until)
    const wins = trades.filter(trade => trade.pnl > 0).length, losses = trades.length - wins
    await expect(view.locator('.hold-r .ct').nth(band)).toHaveText(trades.length ? countTemplates[index].replace('{wins}', String(wins)).replace('{losses}', String(losses)) : '-')
  }
  const reasonKeys = { sl: '손절', tp: '익절', time: '기간 청산' } as const
  for (let row = 0; row < recent.length; row++) {
    await expect(view.locator('tbody tr').nth(row).locator('td').nth(2)).toHaveText(sharedPerformanceCopy(locale, '{count}봉', { count: recent[row].exit - recent[row].entry }))
    await expect(view.locator('tbody tr').nth(row).locator('td').nth(4)).toHaveText(sharedPerformanceCopy(locale, reasonKeys[recent[row].kind]))
  }
})

async function emptyPerformance(page: Page, calendar: boolean) {
  await page.route('**/shared-performance-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3"><main id="fixture"></main></body></html>' }))
  await page.goto('/shared-performance-fixture.html')
  await page.evaluate(async ({ result, calendar }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    for (const path of ['/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css', '/src/client-reference.css', '/src/client-strategy-sharing.css']) await import(/* @vite-ignore */ path)
    document.body.style.fontFamily = '"Noto Sans KR Variable", "Noto Sans SC Variable", Geist Variable, sans-serif'
    const cp = '/src/components/ClientSharedPerformance.tsx', dp = '/@id/react-dom/client'
    const moduleSource = await (await fetch(cp)).text(), rp = moduleSource.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    root.render(react.createElement('div', { className: 'client-strategy-sharing' }, react.createElement(component.default, { asset: '사용자 원문 자산', result: { ...result, trades: [], n: 0, byYear: {}, eq: calendar ? result.eq : [] } })))
  }, { result: source.result, calendar })
  await expect(page.locator('.client-shared-performance')).toBeVisible()
}

for (const calendar of [false, true]) test(`공급체결이없고달력${calendar ? '있음' : '없음'}상태는7언어전환으로가짜성과를만들지않는다`, async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await emptyPerformance(page, calendar)
  for (const locale of languages) {
    await language(page, locale)
    await expect(page.locator('.shared-no-trades')).toHaveText(sharedPerformanceCopy(locale, '이 기간에는 체결이 없어요'))
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await expect(page.locator('.shared-holding,.shared-year-bars')).toHaveCount(0)
    if (calendar) await expect(page.locator('.cal-g')).toBeVisible()
    else {
      await expect(page.locator('.cal-g,.cal-nav')).toHaveCount(0)
      await expect(page.getByText(sharedPerformanceCopy(locale, '표시할 기간 데이터가 없어요.'), { exact: true })).toBeVisible()
    }
  }
  expect(errors).toEqual([])
})

test('영어성과달력의월·요일·설명은한국어고정표시가아니다', async ({ page }, info) => {
  const view = await performance(page)
  await language(page, 'en')
  await view.locator('.cal-hd').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('performance-en-calendar.png') })
  expect.soft(await view.locator('.shared-calendar-heading h3 span').first().innerText()).not.toMatch(/[가-힣]/)
  expect.soft(await view.locator('.cal-hd').innerText()).not.toMatch(/[가-힣]/)
  expect.soft(await view.locator('.shared-calendar-note').innerText()).not.toMatch(/[가-힣]/)
  expect.soft(await view.locator('.shared-holding-legend').innerText()).not.toMatch(/[가-힣]/)
})

test('영어성과표의열명·보유봉·청산사유는한국어고정표시가아니다', async ({ page }, info) => {
  const view = await performance(page)
  await language(page, 'en')
  await view.locator('.shared-trades-scroll').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('performance-en-trades.png') })
  expect.soft(await view.locator('thead').innerText()).not.toMatch(/[가-힣]/)
  const row = view.locator('tbody tr').first()
  expect.soft(await row.locator('td').nth(2).innerText()).not.toContain('봉')
  expect.soft(await row.locator('td').nth(4).innerText()).not.toMatch(/[가-힣]/)
})

test('월이동후활성day·툴팁·표행·연도봉DOM·수치·route·세션저장은언어만으로바뀌지않는다', async ({ page }, info) => {
  const view = await performance(page)
  await view.locator('.cal-nav').first().click()
  await view.locator('.cal-nav').first().click()
  const day = view.locator('.cal-c[tabindex="0"]').nth(2)
  await day.focus()
  await expect(day.locator('.cal-tooltip')).toBeVisible()
  const original = await day.elementHandle(), originalRows = await view.locator('tbody').elementHandle(), bars = await view.locator('.shared-year-bars').elementHandle()
  const value = await day.locator('.cal-tooltip').innerText(), month = await view.locator('.cal-g').innerText()
  const geometry = await view.locator('.shared-year-bars rect').evaluateAll(nodes => nodes.map(el => ['x', 'y', 'width', 'height'].map(key => el.getAttribute(key))))
  const href = page.url(), saved = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  // Shared footer pages scroll in an ancestor, not the unbounded research-main.
  const scrollFrame = () => day.evaluate(el => {
    let parent = el.parentElement
    while (parent) {
      if (/auto|scroll/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) {
        const box = parent.getBoundingClientRect()
        return { scroll: parent.scrollTop, top: Math.max(0, box.top), bottom: Math.min(innerHeight, box.bottom) }
      }
      parent = parent.parentElement
    }
    return { scroll: document.scrollingElement?.scrollTop ?? 0, top: 0, bottom: innerHeight }
  })
  const scroll = (await scrollFrame()).scroll
  // Compare positions in one layout observation: the scroll ancestor can move
  // between separate protocol calls while the calendar rows stay unchanged.
  const calendarGeometry = () => day.evaluate(el => {
    const cell = el.getBoundingClientRect(), grid = el.closest('.cal-g')!.getBoundingClientRect()
    const box = (rect: DOMRect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
    return { day: box(cell), grid: box(grid) }
  })
  const scrollSamples = [{ locale: 'before', scroll, ...await calendarGeometry() }]
  const dayOffset = scrollSamples[0].day!.y - scrollSamples[0].grid!.y
  for (const locale of languages) {
    await language(page, locale)
    await expect(day).toBeFocused()
    expect(await day.evaluate((el, before) => el === before, original)).toBe(true)
    expect((await day.locator('.cal-tooltip').innerText()).replace(',', '.')).toBe(value.replace(',', '.'))
    expect((await view.locator('.cal-g').innerText()).replace(/,/g, '.')).toBe(month.replace(/,/g, '.'))
    expect(await view.locator('tbody').evaluate((el, before) => el === before, originalRows)).toBe(true)
    expect(await view.locator('.shared-year-bars').evaluate((el, before) => el === before, bars)).toBe(true)
    expect(await view.locator('.shared-year-bars rect').evaluateAll(nodes => nodes.map(el => ['x', 'y', 'width', 'height'].map(key => el.getAttribute(key))))).toEqual(geometry)
    expect(page.url()).toBe(href)
    expect(await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))).toEqual(saved)
    const frame = await scrollFrame(), currentScroll = frame.scroll
    const currentGeometry = await calendarGeometry()
    scrollSamples.push({ locale, scroll: currentScroll, ...currentGeometry })
    await info.attach(`scroll-${locale}`, { body: JSON.stringify(scrollSamples, null, 2), contentType: 'application/json' })
    // Translated content above the calendar can change its height. Native scroll
    // anchoring is allowed; the selected observation must stay visible, not reset.
    const { day: currentDay, grid } = currentGeometry
    expect(currentScroll).toBeGreaterThan(0)
    expect(currentDay.y).toBeGreaterThanOrEqual(frame.top)
    expect(currentDay.y + currentDay.height).toBeLessThanOrEqual(frame.bottom)
    expect(currentDay.y - grid.y).toBeCloseTo(dayOffset, 3)
    const tooltip = (await day.locator('.cal-tooltip').boundingBox())!
    expect(tooltip.y).toBeGreaterThanOrEqual(frame.top)
    expect(tooltip.y + tooltip.height).toBeLessThanOrEqual(frame.bottom)
  }
})

test('표의가격은언어별숫자그룹만바뀌고표시통화선택은원가격·수익률을환산하지않는다', async ({ page }) => {
  const view = await performance(page)
  for (const locale of languages) {
    await language(page, locale)
    const tableRows = view.locator('tbody tr')
    await expect(tableRows).toHaveCount(recent.length)
    for (let index = 0; index < recent.length; index++) {
      const trade = recent[index], cells = tableRows.nth(index).locator('td')
      await expect(cells.nth(0)).toHaveText(dateText(trade.entry, locale))
      await expect(cells.nth(1)).toHaveText(dateText(trade.exit, locale))
      await expect(cells.nth(3)).toHaveText(source.asset)
      await expect(cells.nth(5)).toHaveText(new Intl.NumberFormat(locale).format(Math.round(sourceTerminalPrices[trade.entry])))
      const entry = sourceTerminalPrices[trade.entry]
      const exit = trade.kind === 'sl' ? entry * (1 + source.result.params.sl / 100)
        : trade.kind === 'tp' ? entry * (1 + source.result.params.tp! / 100) : sourceTerminalPrices[trade.exit]
      await expect(cells.nth(6)).toHaveText(new Intl.NumberFormat(locale).format(Math.round(exit)))
      await expect(cells.nth(7)).toHaveText(`${trade.pnl >= 0 ? '+' : ''}${(trade.pnl * 100).toFixed(2)}%`.replace('.', locale === 'es' || locale === 'fr' ? ',' : '.'))
    }
    const before = await tableRows.allTextContents()
    for (const currency of ['BTC', 'EUR', 'USD']) {
      await page.evaluate(async currency => {
        const path = '/src/client-preferences.ts'
        const { setClientPreference } = await import(path)
        setClientPreference('currency', currency)
      }, currency)
      expect(await tableRows.allTextContents()).toEqual(before)
    }
  }
})

for (const width of [320, 1440]) test(`${width}px7언어성과레이아웃은보유기간봉시인성과지역표스크롤을유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 320 ? 640 : 900 })
  const view = await performance(page)
  for (const locale of languages) {
    await language(page, locale)
    await page.evaluate(() => document.fonts.ready)
    await view.locator('.shared-holding').scrollIntoViewIfNeeded()
    for (const row of await view.locator('.hold-r').all()) {
      const bar = (await row.locator('.bar').boundingBox())!, label = (await row.locator('.lb').boundingBox())!, count = (await row.locator('.ct').boundingBox())!
      expect(bar.width).toBeGreaterThanOrEqual(24)
      expect(bar.height).toBeGreaterThanOrEqual(12)
      expect(label.x + label.width).toBeLessThanOrEqual(bar.x + 1)
      expect(bar.x + bar.width).toBeLessThanOrEqual(count.x + 1)
      expect(await row.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      if (width === 1440) expect(await row.locator('.lb').evaluate(el => {
        const range = document.createRange()
        range.selectNodeContents(el)
        return range.getClientRects().length
      })).toBe(1)
    }
    await expect(view.locator('.shared-holding-key')).toHaveCount(2)
    for (const group of await view.locator('.shared-holding-key').all()) {
      const rects = await group.evaluate(el => {
        const marker = el.querySelector('i')!, markerRange = document.createRange()
        markerRange.selectNodeContents(marker)
        const text = [...el.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent!.trim())!
        const labelRange = document.createRange(); labelRange.selectNodeContents(text)
        return { marker: [...markerRange.getClientRects()].map(r => ({ y: r.y, height: r.height })), label: [...labelRange.getClientRects()].map(r => ({ y: r.y, height: r.height })) }
      })
      expect(rects.marker).toHaveLength(1)
      expect(rects.label).toHaveLength(1)
      expect(Math.abs(rects.marker[0].y - rects.label[0].y)).toBeLessThan(2)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    if (locale === 'en' || locale === 'fr') await page.screenshot({ path: info.outputPath(`performance-${locale}-${width}-holding.png`) })
    const region = view.locator('.shared-trades-scroll')
    await region.focus()
    const maximum = await region.evaluate(el => { el.scrollLeft = el.scrollWidth; return el.scrollLeft })
    if (width === 320) expect(maximum).toBeGreaterThan(0)
    await expect(region).toBeFocused()
    if (locale === 'en' || locale === 'fr') await page.screenshot({ path: info.outputPath(`performance-${locale}-${width}-trades.png`) })
  }
})

test('서울과로스앤젤레스기기에서도원본로컬달력날짜가하루이동하지않는다', async ({ browser, baseURL }) => {
  for (const timezoneId of ['Asia/Seoul', 'America/Los_Angeles']) {
    const context = await browser.newContext({ baseURL, timezoneId })
    try {
      const page = await context.newPage(), view = await performance(page)
      expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezoneId)
      for (const locale of ['ko', 'en']) {
        await language(page, locale)
        await expect(view.locator('tbody tr').first().locator('td').first()).toHaveText(dateText(recent[0].entry, locale))
      }
    } finally { await context.close() }
  }
})
