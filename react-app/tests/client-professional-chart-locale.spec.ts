import { expect, test, type Page } from '@playwright/test'
import { fixture } from '../src/dev/chart-workspace-fixture'
import { professionalChartKo } from '../src/client-professional-chart-ko'
import translations from '../src/client-professional-chart-translations.json' with { type: 'json' }
import { professionalChartLocale } from '../src/client-professional-chart-locale'
import type { ClientLanguage } from '../src/client-preferences'
import type { PriceChartView } from '../src/chart/price-chart-view'

const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
async function mount(page: Page, view: PriceChartView | null = fixture, failLocaleInit = false) {
  await page.route('**/src/components/ClientProfessionalPriceChart.tsx*', async route => {
    const response = await route.fetch()
    let body = await response.text()
    expect(body).toContain('api.current = chart;')
    if (failLocaleInit) {
      expect(body).toContain('updateLocale.current(formatRef.current);')
      body = body.replace('updateLocale.current(formatRef.current);', 'if (!window.__localeInitFailure) { window.__localeInitFailure = true; updateLocale.current = () => { throw new Error("synthetic locale initialization failure"); }; throw new Error("synthetic locale initialization failure"); } updateLocale.current(formatRef.current);')
    }
    await route.fulfill({ response, body: body.replace('api.current = chart;', 'api.current = chart; window.__localeChart = chart;') })
  })
  await page.goto('/')
  await page.evaluate(async view => {
    const path = '/tests/fixtures/price-chart-host.tsx'
    const module = await import(/* @vite-ignore */ path)
    Object.assign(window, { priceChartHost: module.mount(view) })
  }, view)
}
async function language(page: Page, value: ClientLanguage) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const module = await import(/* @vite-ignore */ path)
    module.setClientPreference('language', value)
  }, value)
}
const chartRange = (page: Page) => page.evaluate(() => Reflect.get(window, '__localeChart').timeScale().getVisibleLogicalRange())

test('37개 원문·6개 번역의 키와 placeholders를 보존하고 숫자는 환산 없이 UTC로 표시한다', () => {
  const placeholders = (text: string) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map(match => match[1]).sort()
  for (const copy of Object.values(translations)) {
    expect(Object.keys(copy).sort()).toEqual(Object.keys(professionalChartKo).sort())
    for (const key of Object.keys(professionalChartKo) as (keyof typeof professionalChartKo)[]) {
      expect(copy[key].trim()).not.toBe('')
      expect(placeholders(copy[key])).toEqual(placeholders(professionalChartKo[key]))
    }
  }
  for (const value of languages) {
    const format = professionalChartLocale(value)
    expect(professionalChartLocale(value)).toBe(format)
    for (const value of [12345.125, .123456789012]) expect(format.price(value)).toBe(new Intl.NumberFormat(format.locale, { maximumFractionDigits: 12 }).format(value))
    expect(format.utc(0)).toBe(new Intl.DateTimeFormat(format.locale, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(0))
    expect(format.issue('unknown-validator-reason')).toBe('unknown-validator-reason')
    for (const precision of [0, 2, 8, 12]) expect(format.axisPrice(precision)(1234.5)).toBe(new Intl.NumberFormat(format.locale, { minimumFractionDigits: precision, maximumFractionDigits: precision }).format(1234.5))
  }
  expect([1, 60, 90, 7200, 86400].map(professionalChartLocale('ko').resolution)).toEqual(['1초', '1분', '90초', '2시간', '1일'])
})

for (const lang of languages) test(`${lang}: 언어 변경은 선택 체결·줌·지표·초점·단일 canvas를 보존한다`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await expect(page.locator('.cp-surface')).toBeVisible()
  await page.locator('.cp-surface').press('Home')
  await page.locator('.cp-surface').press('ArrowRight')
  await page.locator('.cp-surface').press('ArrowRight')
  await expect(page.locator('.cp-fills button')).toHaveCount(2)
  await page.getByRole('button', { name: '로그', exact: true }).click()
  await page.getByRole('button', { name: 'EMA 20', exact: true }).click()
  await page.getByRole('button', { name: '거래량', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, '__localeChart').timeScale().setVisibleLogicalRange({ from: 0, to: 40 }))
  await expect.poll(async () => (await chartRange(page)).to).toBe(40)
  const source = await page.locator('.cp-source').textContent()
  const button = page.getByRole('button', { name: '로그', exact: true })
  await button.focus()
  const before = await chartRange(page)
  const requests: string[] = []; page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url()) })
  await language(page, lang)
  const format = professionalChartLocale(lang)
  await expect(page.getByRole('button', { name: format.t('log'), exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: format.t('log'), exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: format.t('volume'), exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.cp-note')).toHaveText(format.t('emaNote'))
  await expect(page.locator('.cp-sr-only')).toContainText(format.utc(fixture.bars[2].time))
  await expect(page.locator('.cp-fills button')).toHaveCount(2)
  await expect(page.locator('.cp-fills button').first()).toContainText(format.utc(fixture.fills[0].time))
  await expect(page.locator('.cp-source')).toHaveText(source!)
  await expect.poll(() => chartRange(page)).toEqual(before)
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, '__localeChart').options().localization.locale)).toBe(format.locale)
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.locator('.cp-chart').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    const buttons = await page.locator('.cp-controls button').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, right: r.right, y: r.y, bottom: r.bottom, height: r.height } }))
    expect(buttons.every(button => button.x >= 0 && button.right <= width && button.height >= 44)).toBe(true)
    const actions = await page.locator('.cp-toolbar > button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().y))
    expect(actions[0]).toBe(actions[1])
    for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) expect(buttons[i].x < buttons[j].right && buttons[i].right > buttons[j].x && buttons[i].y < buttons[j].bottom && buttons[i].bottom > buttons[j].y).toBe(false)
    if (lang === 'fr') await page.locator('.cp-chart').screenshot({ path: info.outputPath(`professional-chart-fr-${width}.png`) })
  }
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

test('재생 중 7언어 왕복은 60초 진행을 초기화하지 않고 Skip·숫자·모션 감소 안내를 갱신한다', async ({ page }) => {
  await page.clock.install()
  await mount(page)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await page.clock.fastForward(10_000)
  let previous = 0
  for (const lang of languages) {
    await language(page, lang)
    const format = professionalChartLocale(lang)
    await expect(page.getByRole('button', { name: format.t('skip'), exact: true })).toBeVisible()
    await expect(page.locator('.cp-replay > span')).toHaveText(format.t('replayNote'))
    const progress = await page.locator('.cp-replay progress').evaluate(node => (node as HTMLProgressElement).value)
    expect(progress).toBeGreaterThanOrEqual(Math.max(previous, 1 / 6))
    previous = progress
    await page.clock.fastForward(1000)
  }
  await page.getByRole('button', { name: professionalChartLocale('fr').t('skip'), exact: true }).click()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: professionalChartLocale('fr').t('replay'), exact: true }).click()
  await expect(page.locator('.cp-sr-only')).toHaveText(professionalChartLocale('fr').t('reduced'))
  await language(page, 'en')
  await expect(page.locator('.cp-sr-only')).toHaveText(professionalChartLocale('en').t('reduced'))
})

test('조회 대기·검증 실패도 현재 언어로 안내하며 원인과 가격 결측을 보존한다', async ({ page }) => {
  await mount(page, null)
  for (const lang of languages) {
    await language(page, lang)
    await expect(page.locator('.cp-empty')).toContainText(professionalChartLocale(lang).t('waiting'))
  }
  const patches = [
    ['source', { sourceLabel: '' }], ['resolution', { resolutionSeconds: 0 }], ['precision', { pricePrecision: 13 }],
    ['empty', { bars: [] }], ['narrow', { bars: Array(5001).fill(fixture.bars[0]) }],
    ['invalidBars', { bars: [...fixture.bars].reverse() }], ['invalidFills', { fills: [fixture.fills[0], fixture.fills[0]] }],
  ] as const
  for (const [key, patch] of patches) {
    await page.evaluate(view => Reflect.get(window, 'priceChartHost').render(view), { ...fixture, ...patch })
    await expect(page.locator('.cp-empty')).toContainText(professionalChartLocale('fr').t(key))
    await expect(page.locator('.cp-chart canvas')).toHaveCount(0)
  }
})

test('PNG·가격 눈금은 현재 언어와 원정밀도를 쓰고 통화 변경으로 가격을 환산하지 않는다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText
    Reflect.set(window, '__localeExport', [])
    CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof original>) {
      Reflect.get(window, '__localeExport').push(args[0])
      original.apply(this, args)
    }
  })
  await language(page, 'fr')
  await page.locator('.cp-surface').press('Home')
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__localeExport'))).toContain('102,00')
  await page.evaluate(() => Reflect.set(window, '__localeExport', []))
  const quote = await page.locator('.cp-quote').textContent()
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const module = await import(/* @vite-ignore */ path)
    module.setClientPreference('currency', 'KRW')
  })
  await expect(page.locator('.cp-quote')).toHaveText(quote!)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: professionalChartLocale('fr').t('save'), exact: true }).click()
  expect((await download).suggestedFilename()).toBe('TETH-chart.png')
  const texts = await page.evaluate(() => Reflect.get(window, '__localeExport').join(''))
  expect(texts).toContain(professionalChartLocale('fr').t('currentWindow'))
  expect(texts).toContain(professionalChartLocale('fr').resolution(fixture.resolutionSeconds))
  expect(texts).toContain(fixture.sourceLabel)
})

test('언어 변경은 펼친 체결을 유지하되 실제 가격 교체는 이전 index 낭독을 지운다', async ({ page }) => {
  const fills = Array.from({ length: 75 }, (_, index) => ({ ...fixture.fills[0], id: `locale-fill-${index}`, time: fixture.bars[0].time + 10 }))
  await mount(page, { ...fixture, fills })
  await page.locator('.cp-surface').press('Home')
  await page.getByRole('button', { name: '체결 더 보기 (50/75)', exact: true }).click()
  await expect(page.locator('.cp-fills button')).toHaveCount(75)
  await language(page, 'fr')
  await expect(page.locator('.cp-fills button')).toHaveCount(75)
  await expect(page.locator('.cp-sr-only')).toContainText(professionalChartLocale('fr').utc(fixture.bars[0].time))
  await page.evaluate(view => Reflect.get(window, 'priceChartHost').render(view), { ...fixture, bars: fixture.bars.map(bar => ({ ...bar, time: bar.time + 86400 })), fills: [] })
  await expect(page.locator('.cp-sr-only')).toHaveText('')
  await expect(page.locator('.cp-fills')).toHaveCount(0)
  await expect(page.locator('.cp-quote')).toContainText(professionalChartLocale('fr').utc(fixture.bars.at(-1)!.time + 86400))
})

test('차트 부분 초기화 실패 후에도 언어 변경과 명시 재시도가 안전하다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page, fixture, true)
  await expect(page.locator('.cp-failure')).toBeVisible()
  await language(page, 'fr')
  await expect(page.locator('.cp-failure')).toContainText(professionalChartLocale('fr').t('failure'))
  await page.getByRole('button', { name: professionalChartLocale('fr').t('retry'), exact: true }).click()
  await expect(page.locator('.cp-failure')).toHaveCount(0)
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  await expect(page.getByRole('button', { name: professionalChartLocale('fr').t('fit'), exact: true })).toBeEnabled()
  expect(errors).toEqual([])
})
