import { expect, test, type Page } from '@playwright/test'
import { commonBacktestText as copy } from '../src/client-common-backtest-copy'
import { researchCopy } from '../src/client-research-copy'
import type { ClientLanguage } from '../src/client-preferences'
import { installCommonResponseFixture, publishCommonResponseFixture } from './fixtures/client-common-response-fixture'

async function backtest(page: Page, language: ClientLanguage = 'ko') {
  // Historical common-display contract needs explicit supplied conditions; fresh public source uses inline intake.
  await installCommonResponseFixture(page, 'd94@example.test')
  await page.clock.install()
  await page.addInitScript(language => {
    localStorage.setItem('tethLang', language)
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수', email: 'd94@example.test' }))
  }, language)
  await page.goto('/')
  await page.locator('#strategy-idea').fill('BTC RSI 30 미만 반등 일봉 손절 3%, 익절 8%')
  await page.locator('#strategy-idea').press('Enter')
  await page.clock.fastForward(20_000)
  await publishCommonResponseFixture(page)
  await page.getByRole('button', { name: copy(language, 'open'), exact: true }).click()
  await expect.poll(async () => { await page.clock.runFor(200); return page.getByTestId('common-backtest').count() }).toBe(1)
}

test('d94 준비 화면은 원본 글자·윤곽 카드·흰 pill과 선택 테두리를 계승한다', async ({ page }, info) => {
  await backtest(page)
  for (const width of [1440, 900, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.mouse.move(0, 0)
    await expect(page.locator('.cbt-id h2')).toHaveCSS('font-size', width <= 768 ? '28px' : '32px')
    await expect(page.locator('.cbt-id h2')).toHaveCSS('font-weight', '400')
    const card = page.locator('.cbt-box').first()
    await expect(card).toHaveCSS('border-radius', width <= 768 ? '20px' : '26px')
    await expect(card).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    const action = page.getByRole('button', { name: copy('ko', 'run'), exact: true })
    await expect(action).toHaveCSS('border-radius', '999px')
    await expect(action).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(page.locator('.cbt-seg button[aria-pressed=true]').first()).toHaveCSS('box-shadow', 'rgb(154, 154, 154) 0px 0px 0px 2px inset')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if ([1440, 320].includes(width)) await page.screenshot({ path: info.outputPath(`ready-${width}.png`) })
  }
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) test(`${language} 최신 월별 표는 모든 관측 달과 결과·근거 연결을 유지한다`, async ({ page }, info) => {
  await backtest(page, language)
  await page.getByRole('button', { name: copy(language, 'run'), exact: true }).click()
  await page.getByRole('button', { name: copy(language, 'skip'), exact: true }).click()
  await expect(page.getByTestId('common-backtest')).toHaveAttribute('data-phase', 'result')
  const value = await page.getByTestId('common-result').textContent()
  await expect(page.getByRole('heading', { name: copy(language, 'decisions'), exact: true })).toBeVisible()
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    const months = page.locator('.cbt-month-scroll')
    await expect(months.locator('td[data-month]:not(.empty)')).toHaveCount(25)
    await expect(months.locator('thead th')).toHaveCount(14)
    await expect(months.locator('tbody tr')).toHaveCount(3)
    expect(await months.evaluate(node => getComputedStyle(node).overflowX)).toBe('auto')
    await expect(months.locator('td.empty').first()).toHaveText('—')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (language === 'ko' && [1440, 320].includes(width)) {
      await page.screenshot({ path: info.outputPath(`result-${width}.png`) })
      await page.locator('.cbt-monthly h3').scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`months-${width}.png`) })
    }
  }
  const first = page.locator('.cbt-decision-row:visible > button').first()
  await first.click()
  await expect(first).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.cbt-chart')).toHaveAttribute('data-selected-date', await first.locator('time').getAttribute('datetime') as string)
  const more = page.locator('.cbt-decisions-more')
  await expect(more).toHaveCSS('text-decoration-line', 'none')
  await expect(more.locator('span')).toHaveCSS('text-decoration-line', 'underline')
  await more.click()
  await expect(page.locator('.cbt-decision-row')).toHaveCount(36)
  await page.reload()
  await expect.poll(async () => { await page.clock.runFor(200); return page.getByTestId('common-result').count() }).toBe(1)
  await expect(page.getByTestId('common-result')).toHaveText(value!)
})

test('d94 연구 기록의 검색·빈 안내·목록과 좁은 폭 날짜는 원문을 보존한다', async ({ page }, info) => {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수', email: 'd94@example.test' })))
  const openHistory = async () => {
    await page.goto('/')
    if ((page.viewportSize()?.width ?? 0) <= 860) await page.locator('.client-hamburger').click()
    await page.getByRole('button', { name: '연구 기록', exact: true }).click()
  }
  await openHistory()
  const search = page.getByRole('searchbox', { name: '연구 기록 검색', exact: true })
  await expect(search).toBeVisible()
  await expect(page.getByText('아직 연구 기록이 없습니다. 새 전략을 만들면 여기에 쌓입니다.', { exact: true })).toBeVisible()
  await page.goto('/favicon.svg')
  await page.evaluate(() => sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: null, homeDraft: '', sessions: Array.from({ length: 45 }, (_, i) => ({
    id: `d94-${i}`, title: i === 0 ? '비트코인 장기 연구 · 매우 긴 원문 제목을 보존합니다' : `연구 ${i}`, renamed: true, idea: '투자 전략', draft: '', pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', phase: 'plan', workspace: 'conversation', updatedAt: Date.now() - i * 86400000,
    turns: [{ id: `d94-turn-${i}`, question: '원문 질문', answer: '비용을 비교합니다', fullAnswer: '비용을 비교합니다', startedAt: 1, status: 'done', phase: 'plan', suggestions: [] }],
  })) })))
  await openHistory()
  await expect(page.locator('.g-hist-row').first()).toContainText('비트코인 장기 연구')
  for (const width of [1440, 860, 390, 320]) {
    await page.setViewportSize({ width, height: 980 })
    await expect(page.locator('.g-hist-search')).toHaveCSS('height', width <= 860 ? '48px' : '52px')
    await expect(page.locator('.g-hist-search')).toHaveCSS('background-color', 'rgb(33, 33, 33)')
    await expect(page.locator('.g-hist-row .t').first()).toHaveCSS('font-size', '16px')
    await expect(page.locator('.g-hist-row .d').first()).toHaveCSS('font-size', '14px')
    expect(await page.locator('.g-hist-row').first().evaluate(node => {
      const title = node.querySelector('.t')!.getBoundingClientRect(), date = node.querySelector('.d')!.getBoundingClientRect()
      return title.right <= date.left || title.bottom <= date.top
    })).toBe(true)
    if ([1440, 320].includes(width)) await page.screenshot({ path: info.outputPath(`history-${width}.png`) })
  }
  await search.fill('비트코인 비용')
  await expect(page.locator('.g-hist-row')).toHaveCount(1)
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(page.getByRole('searchbox', { name: researchCopy(language, 'search'), exact: true })).toHaveValue('비트코인 비용')
    await expect(page.locator('.g-hist-row')).toContainText('비트코인 장기 연구')
  }
})
