import { expect, test } from '@playwright/test'
import type { ClientLanguage } from '../src/client-preferences'
import { sharedNumber, sharedSigned, sharedPercent } from '../src/client-shared-number-format'
import { sharedChartCopy, type SharedChartCopyKey } from '../src/client-shared-chart-copy'
import { sharedHash, sourceSharedStrategies } from '../src/client-shared-strategies'
import { sourceTerminalDate } from '../src/client-terminal-source-fixture'

const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const localized = (text: string, language: ClientLanguage) => language === 'es' || language === 'fr' ? text.replace('.', ',') : text
const percent = (value: number, language: ClientLanguage, digits = 1) => localized(`${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`, language)
const keys: SharedChartCopyKey[] = ['좌우 방향키로 각 관측일, Home과 End로 처음과 끝을 확인하세요. Escape로 상세 표시를 닫습니다.', '낙폭 곡선 (Drawdown)', '고점 대비 하락률, 최저 {value}%', '낙폭 곡선', '차트 데이터가 없어요']

for (const language of languages) test(`${language}: 표시 포맷은 원본 반올림·부호·정밀도·지수와 입력을 보존한다`, () => {
  for (const value of [0, -0, .04, -.04, 7.125, -4.25, 1.005, 2.675, 1000.25, 1e-8, 1e21, -1.25e21, Number.MAX_VALUE]) {
    for (const digits of [0, 1, 2] as const) {
      expect(sharedNumber(value, language, digits)).toBe(localized(value.toFixed(digits), language))
      expect(sharedSigned(value, language, digits)).toBe(localized(`${value >= 0 ? '+' : ''}${value.toFixed(digits)}`, language))
      expect(sharedPercent(value, language, digits)).toBe(percent(value, language, digits))
      expect(sharedPercent(value, language, digits, false)).toBe(localized(`${value.toFixed(digits)}%`, language))
    }
    expect(sharedNumber(value, language, 'auto')).toBe(localized(String(value), language))
  }
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(sharedNumber(value, language)).toBe('—')
    expect(sharedSigned(value, language)).toBe('—')
    expect(sharedPercent(value, language)).toBe('—')
  }
})

test('차트5개 원문 키·7언어·자리표시자와 키보드 안내를 보존한다', () => {
  for (const language of languages) for (const key of keys) {
    const copy = sharedChartCopy(language, key)
    expect(copy.trim()).not.toBe('')
    expect(copy.match(/\{\w+\}/g) ?? []).toEqual(key.match(/\{\w+\}/g) ?? [])
    if (language === 'ko') expect(copy).toBe(key)
    else expect(copy).not.toMatch(/[가-힣]/)
    if (key.includes('Home')) for (const name of ['Home', 'End', 'Escape']) expect(copy).toContain(name)
  }
  expect(sharedChartCopy('en', '고점 대비 하락률, 최저 {value}%', { value: '$& {value}' })).toContain('$& {value}%')
})

test('명시 retained Mock follow 소비자·실제 Main legacy 상세의 숫자는 언어에 따르되 원본 값과 저장은 바뀌지 않는다', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.route('**/consumer-legacy-sharing-numbers.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="fixture" data-scope="retained-supplied-mock-follow"></div></body></html>' }))
  await page.goto('/consumer-legacy-sharing-numbers.html')
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const fixturePath = '/tests/fixtures/consumer-legacy-sharing-numbers.tsx'
    const { mountLegacySharingNumbers } = await import(/* @vite-ignore */ fixturePath)
    mountLegacySharingNumbers()
  })
  await page.getByRole('button', { name: /^따라가는 중(?: \d+)?$/ }).click()
  const card = page.locator('article.tfbk-card').first()
  const nick = await card.locator('.nm').innerText()
  const source = sourceSharedStrategies().find(row => row.nick === nick)!
  expect(source).toBeDefined()
  const sparkline = card.locator('.ss3-eq'), sparklineHandle = await sparkline.elementHandle()
  const geometry = [await sparkline.locator('polyline').getAttribute('points'), await sparkline.locator('path').getAttribute('d')]
  const saved = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  for (const language of languages) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(path)
      setClientPreference('language', language)
    }, language)
    await expect(card.locator('.pr b')).toContainText(percent(source.result.ret, language))
    await expect(card.locator('.rtrow b').nth(1)).toHaveText(localized(`${source.result.mdd.toFixed(1)}%`, language))
    for (const [index, point] of [source.result.eq[0], source.result.eq.at(-1)!].entries()) {
      const date = sourceTerminalDate(point.i), civilDate = new Date(0)
      civilDate.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate())
      const month = language === 'ko' ? `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}` : new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: 'short' }).format(civilDate)
      await expect(sparkline.locator('text').nth(index + 1)).toHaveText(month)
    }
    expect(await sparkline.evaluate((node, original) => node === original, sparklineHandle)).toBe(true)
    expect([await sparkline.locator('polyline').getAttribute('points'), await sparkline.locator('path').getAttribute('d')]).toEqual(geometry)
    expect(await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))).toEqual(saved)
  }
  // Current Main retains legacy detail URLs, while fresh discovery uses the
  // catalogue. Re-enter the actual public host without replacing its handlers.
  await page.goto(`/${sharedHash({ nick, period: 'all' })}`)
  await expect(page.locator('.ss3-matrix button.mx')).toHaveCount(6)
  for (const language of languages) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(path)
      setClientPreference('language', language)
    }, language)
    const values = page.locator('.ss3-matrix b')
    await expect(values.nth(0)).toHaveText(percent(source.result.ret, language))
    await expect(values.nth(2)).toHaveText(localized(`${source.result.mdd.toFixed(1)}%`, language))
    await expect(values.nth(3)).toHaveText(localized(`${source.result.pf.toFixed(2)}:1`, language))
    await expect(values.nth(4)).toContainText(localized(source.result.avgHold.toFixed(1), language))
    await page.locator('[data-metric="score"]').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('.ss3-score-axis').first()).toContainText(localized(source.result.winRate.toFixed(1), language))
    await page.screenshot({ path: info.outputPath(`sharing-score-${language}.png`) })
    await page.keyboard.press('Escape')
  }
})
