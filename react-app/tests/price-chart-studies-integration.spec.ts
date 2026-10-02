import { expect, test } from '@playwright/test'
import { fixture } from '../src/dev/chart-workspace-fixture'
import { professionalChartLocale } from '../src/client-professional-chart-locale'
import type { ClientLanguage } from '../src/client-preferences'
import { chartWindowVwap, priceChartStudies } from '../src/chart/price-chart-studies'

test('고정 RSI 검산 표본의 첫 Wilder 평균과 다음 평활값을 확인한다', () => {
  const closes = [44.34,44.09,44.15,43.61,44.33,44.83,45.1,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,46]
  const bars = closes.map((close, i) => ({ time: i * 60, close, high: close, low: close, open: close, volume: 0 }))
  const result = priceChartStudies(bars, 60)
  // Independent totals for first 14 differences: gains=3.34, losses=1.40.
  expect(result.rsi[14].value).toBeCloseTo(100 - 100 / (1 + 3.34 / 1.40), 10)
  expect(result.rsi[15].value).toBeCloseTo(66.24961855355505, 10)
})

test('7언어·표시 통화 변경은 보조지표·pane·선택 봉·단일 renderer를 유지한다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async view => {
    const path = '/tests/fixtures/price-chart-host.tsx'
    const module = await import(/* @vite-ignore */ path)
    Object.assign(window, { priceChartHost: module.mount(view) })
  }, fixture)
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  await page.getByRole('button', { name: 'RSI 14', exact: true }).click()
  await page.getByRole('button', { name: 'BB 20·2', exact: true }).click()
  await page.getByRole('button', { name: 'VWAP', exact: true }).click()
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.locator('.cp-surface').press('End')
  const languages: ClientLanguage[] = ['ko','en','ja','zh-CN','zh-TW','es','fr']
  for (const language of languages) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language); setClientPreference('currency', 'EUR')
    }, language)
    const format = professionalChartLocale(language)
    await expect(page.locator('.cp-studies')).toHaveAttribute('aria-label', format.t('studies'))
    await expect(page.locator('[data-study=rsi]')).toHaveText(format.axisPrice(1)(100))
    await expect(page.locator('[data-study=bb]')).toContainText(format.axisPrice(2)(199.967437405329))
    await expect(page.locator('[data-study=vwap]')).toHaveText(format.axisPrice(2)(chartWindowVwap(fixture.bars, 60).at(-1)!.value!))
    await expect(page.locator('.cp-note')).toHaveText([format.t('vwapNote'), format.t('studiesNote')])
    await expect(page.locator('.cp-surface')).toHaveAttribute('aria-label', format.t('keyboard'))
    expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
  }
  await page.locator('.cp-surface').press('Home')
  await expect(page.locator('[data-study=rsi]')).toHaveText(professionalChartLocale('fr').t('studyEmpty'))
})

test('세 지표를 켠 전체창 재생도 차트 하단과 Skip을 화면 안에 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?chart-workspace-preview=1')
  await page.getByRole('button', { name: '차트 작업 공간 열기' }).click()
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  await page.getByRole('button', { name: 'RSI 14', exact: true }).click()
  await page.getByRole('button', { name: 'BB 20·2', exact: true }).click()
  await page.getByRole('button', { name: 'VWAP', exact: true }).click()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install()
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await expect(page.locator('.bw-workspace')).toHaveClass(/is-replaying/)
  await page.clock.runFor(1000)
  await page.screenshot({ path: info.outputPath('indicators-fullscreen.png'), animations: 'disabled' })
  const footer = await page.locator('.cp-footer').boundingBox()
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(1080)
  await expect(page.getByRole('button', { name: 'Skip · 결과 보기', exact: true })).toBeInViewport()
  await page.clock.runFor(60000)
  await expect(page.locator('.bw-workspace')).not.toHaveClass(/is-replaying/)
  await expect(page.getByRole('button', { name: 'RSI 14', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-study=rsi]')).toHaveText('100.0')
  // First Escape releases a chart inspection. The next leaves the workspace.
  await page.locator('.cp-surface').press('Home')
  await page.locator('.cp-surface').press('Escape')
  await expect(page.locator('.bw-workspace')).toBeVisible()
  await expect(page.locator('.cp-sr-only')).toBeEmpty()
  await page.locator('.cp-surface').press('Escape')
  await expect(page.locator('.bw-workspace')).toHaveCount(0)
})

test('모바일 외부 Skip 재생 중에도 거래량 버튼은 RSI와 같은 행에 남는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.install()
  await page.goto('/?chart-workspace-preview=1')
  await page.getByRole('button', { name: '차트 작업 공간 열기' }).click()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  const volume = await page.getByRole('button', { name: '거래량', exact: true }).boundingBox()
  const rsi = await page.getByRole('button', { name: 'RSI 14', exact: true }).boundingBox()
  expect(volume!.y).toBe(rsi!.y)
  expect(volume!.x).toBeGreaterThan(rsi!.x)
  expect(volume!.height).toBeGreaterThanOrEqual(44)
  await expect(page.getByRole('button', { name: 'Skip · 결과 보기', exact: true })).toBeInViewport()
  expect(await page.locator('.cp-chart').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('tools-mobile-replay.png') })
})
