import { expect, test } from '@playwright/test'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { catalogueStrategies, catalogueSourceSha, catalogueUniverses, catalogueTitle } from '../src/client-catalogue'
import { catalogueDateReader } from '../src/client-catalogue-presentation'
import { loadCatalogueMarketData } from '../src/client-catalogue-market-data'
import { runCatalogueSpotPreview } from '../src/client-catalogue-spot-engine'
import { runCatalogueFuturesPreview } from '../src/client-catalogue-futures-engine'
import { catalogueJudgments } from '../src/client-catalogue-judgments'
import type { CataloguePreviewResult } from '../src/client-catalogue-preview'
import reference from './fixtures/catalogue-judgment-runtime.json' with { type: 'json' }
import copy from '../src/client-catalogue-judgment-copy.json' with { type: 'json' }

test('31종×전체/1년/2년 판단은 같은 원장의 원본 함수와 일치하고 과거 작성문으로 덮어쓰지 않는다', async () => {
  expect(reference.sha).toBe(catalogueSourceSha)
  expect(createHash('sha256').update(reference.code).digest('hex')).toBe(reference.codeSha256)
  const data = await loadCatalogueMarketData(), errors: string[] = []
  for (const strategy of catalogueStrategies) for (const period of ['all', '1y', '2y'] as const) {
    try {
      const start = period === 'all' ? undefined : Math.max(strategy.startI, data.length - 1 - (period === '1y' ? 365 : 730))
      const result = strategy.fut ? runCatalogueFuturesPreview(strategy, data, start) : runCatalogueSpotPreview(strategy, data, start)
      const value: CataloguePreviewResult = { source: 'client-snapshot-preview', sourceSha: catalogueSourceSha, strategy, period, calculation: period === 'all' ? 'full-run' : 'restart-run', contextPeriod: 'selected', calendar: { start: data.spot.start, asof: data.spot.asof }, dataVersion: { spot: data.spot.v, futures: data.future.v }, result }
      const context = vm.createContext({ MK_UNI: catalogueUniverses, PRICE0: { length: data.length }, mkPx: (a: string) => data.prices(a), idxToDate: catalogueDateReader(value.calendar), skSym: catalogueTitle, mkTS: () => '', MK_VOICE: undefined, source: { ...strategy, cfg: { ...strategy, startI: period === 'all' ? strategy.startI : result.params.startI }, r: result }, result })
      vm.runInContext(reference.code, context)
      const expected = vm.runInContext('mkChatMsgs(source,result,6).map(m=>({i:m.i,k:m.k,cnt:m.cnt,from:m.from,title:skdText(mkChatTitle(source,m)),t:(m.k==="now"||m.k==="intro")?skdText(m.t):skdText(m.t).split(/(?<=다\\.)\\s+/).filter(s=>!SKD_RULE.test(s)).join(" ")}))', context) as { t: string }[]
      if (!strategy.fut) for (const item of expected) item.t = item.t.replaceAll('재평가를 기다리지 않고 당일 매도합니다.', '재평가를 기다리지 않고 매도 신호를 냅니다.')
      else for (const item of expected) item.t = item.t.replaceAll('수수료와 펀딩비는 실제 값으로 반영합니다.', '수수료는 체결 금액의 0.055%, 펀딩비는 실제 기록대로 내거나 받습니다.')
      const before = JSON.stringify(result), messages = catalogueJudgments(value, data)
      expect(messages.map(({ i, k, cnt, from, title, t }) => ({ i, k, cnt, from, title, t })), strategy.id).toEqual(expected)
      expect(JSON.stringify(result)).toBe(before)
      expect(messages.length).toBeLessThanOrEqual(8)
      expect(messages[0].k).toBe('now'); expect(messages.at(-1)?.k).toBe('intro')
      for (const message of messages) if (message.k === 'buy' || message.k === 'sell') {
        const event = result.events.find(e => e.i === message.i && e.a === message.a && e.t === (message.k === 'buy' ? 'enter' : 'exit'))!
        expect(message.fillIndex).toBe(event.xi)
        expect(message.pnl).toBe(message.k === 'sell' ? event.pnl : undefined)
      }
      if (strategy.id === 'd1' && period === 'all') {
        expect(messages[0].t).toContain('SOL'); expect(messages[0].t).toContain('AVAX')
        expect(messages[0].t).not.toContain('현금은 3%')
      }
    } catch (error) { errors.push(`${strategy.id}/${period}: ${String(error)}`) }
  }
  expect(errors).toEqual([])
})

for (const width of [320, 1440]) test(`${width}px 판단 기록·더보기·용어 설명·원화면 복귀`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#/share/s/d1')
  const section = page.getByRole('region', { name: '판단 기록', exact: true }), rows = section.locator('li')
  await expect(rows).toHaveCount(3)
  await expect(rows.first()).toContainText('SOL')
  const firstText = await rows.first().innerText()
  const term = rows.first().getByRole('button').first()
  await term.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible(); await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeFocused()
  const box = (await dialog.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(11); expect(box.x + box.width).toBeLessThanOrEqual(width - 11)
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(term).toBeFocused()
  await expect(term).toHaveAttribute('aria-expanded', 'false')
  await term.click(); await expect(dialog).toHaveAccessibleDescription(/.+/)
  await page.keyboard.press('Tab'); await expect(dialog).toHaveCount(0); await expect(term).toBeFocused()
  await section.getByRole('button', { name: /이전 기록/ }).click()
  await expect(rows).toHaveCount(8); await expect(rows.nth(3)).toBeFocused()
  await expect(rows.last()).toHaveAttribute('data-judgment-kind', 'intro')
  for (const row of await rows.all()) {
    const terms = await row.getByRole('button').allTextContents()
    expect(new Set(terms).size).toBe(terms.length)
  }
  await term.click(); await page.getByRole('tab', { name: '전략 정보', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.getByRole('tab', { name: '개요', exact: true }).click()
  await expect(dialog).toHaveCount(0); await expect(rows).toHaveCount(8)
  await page.getByRole('button', { name: '거래 내역', exact: true }).click()
  await page.getByRole('button', { name: '개요로 돌아가기', exact: true }).first().click()
  await expect(rows).toHaveCount(8); expect(await rows.first().innerText()).toBe(firstText)
  await section.evaluate(el => el.scrollIntoView({ block: 'start' })); await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: info.outputPath(`judgments-${width}.png`) })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(errors).toEqual([])
})

test('7언어 조작부·날짜를 바꿔도 원문·숫자·신호/체결 기록은 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 }); await page.goto('/#/share/s/f1')
  const section = page.locator('.catalogue-judgments'); await expect(section).toBeVisible()
  const original = await section.locator('.catalogue-judgment-body > p[lang="ko"]').allTextContents()
  for (const language of Object.keys(copy) as (keyof typeof copy)[]) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', language) }, language)
    await expect(section.getByRole('heading', { level: 3 })).toHaveText(copy[language].heading)
    const paragraphs = section.locator(`.catalogue-judgment-body > p[lang="${language}"]`)
    if (language === 'ko') expect(await paragraphs.allTextContents()).toEqual(original)
    else { await expect(paragraphs).toHaveCount(original.length); expect((await paragraphs.allTextContents()).join(' ')).not.toMatch(/[가-힣]/) }
    await section.getByRole('button').first().click(); const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: copy[language].close, exact: true })).toBeVisible()
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', 'ko') })
  expect(await section.locator('.catalogue-judgment-body > p[lang="ko"]').allTextContents()).toEqual(original)
})

test('320px 두 배 글자에서 용어+조사는 넘치지 않고 외부 정보탭 탐색은 초점을 인계한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 }); await page.goto('/#/share/s/d1')
  const section = page.locator('.catalogue-judgments'); await expect(section).toBeVisible()
  await page.addStyleTag({ content: '.catalogue-judgment-body p{font-size:32px}.catalogue-judgment-heading h4{font-size:36px}.catalogue-judgment-date{font-size:28px}' })
  expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await section.getByRole('button').first().click(); await expect(page.getByRole('dialog')).toBeVisible()
  await page.evaluate(() => { location.hash = '#/share/s/d1/all/info' })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: '전략 정보', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: '전략 정보', exact: true })).toBeFocused()
})
