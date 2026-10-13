import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseEvaluatedCatalogue, canonicalCatalogueJson } from '../src/client-evaluated-strategy-catalogue'
import { evaluatedExecutionDestination } from '../src/client-evaluated-execution'
import { evaluatedDetailText, evaluatedMixPolicyCopy } from '../src/client-evaluated-detail-copy'
import type { ClientLanguage } from '../src/client-preferences'

const artifact = new URL('../../../side-projects/teth-arena/evidence/strategy-discovery/catalogue/catalogue.json', import.meta.url)
const body = existsSync(artifact) ? readFileSync(artifact, 'utf8') : ''
const input = body ? JSON.parse(body) : { items: [] }
test.beforeEach(() => { test.skip(!body || process.env.VITE_LOCAL_STRATEGY_CATALOGUE !== 'true', 'Explicit opt-in and local actual catalogue artifact required.') })

test('all 32 actual details preserve original finance, source decisions and exact UTC observations', async ({ page }, info) => {
  const document = await parseEvaluatedCatalogue(input)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill({ contentType: 'application/json', body }))
  for (const width of info.project.name === 'desktop' ? [1440] : [390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const item of document.items) {
      await page.goto(`/#/share/s/${item.id}/all`)
      const detail = page.locator('[data-evaluated-strategy]')
      await expect(detail).toHaveAttribute('data-policy-version', item.policyVersionId)
      await expect(detail.locator('.catalogue-source-venue')).toHaveText('Bitget')
      await expect(detail.locator('.catalogue-source-venue img')).toHaveAttribute('src', '/assets/logos/bitget-512.png')
      await expect(detail.locator('[data-evaluated-metric="ret"] b')).toHaveText(`${Number(item.evaluation.returnPct) >= 0 ? '+' : ''}${Number(item.evaluation.returnPct).toFixed(1)}%`)
      await expect(detail.getByRole('button', { name: '전략 복사하기', exact: true })).toBeDisabled()
      await expect(detail.locator('.catalogue-since')).toContainText(item.equity.at(-1)!.at.slice(0, 10))
      await detail.locator('.catalogue-overview-svg').focus()
      await page.keyboard.press('End')
      await expect(detail.locator('.catalogue-value-tip time')).toHaveAttribute('datetime', item.equity.at(-1)!.at)
      await page.keyboard.press('Home')
      await expect(detail.locator('.catalogue-since')).toContainText(item.equity[0].at.slice(0, 10))
      await expect(detail.locator('.catalogue-since')).toContainText('0.0%')
      await page.keyboard.press('End')
      await page.keyboard.press('ArrowLeft')
      await expect(detail.locator('.catalogue-value-tip time')).toHaveAttribute('datetime', item.equity.at(-2)!.at)
      if (Number(item.evaluation.maxDrawdownPct) === 0) await expect(detail.locator('[data-evaluated-metric="mdd"] b')).toHaveText('0.00%')
      await detail.locator('.catalogue-judgments-more').click()
      const judgments = await detail.locator('[data-evaluated-judgment]').evaluateAll(nodes => nodes.map(node => ({ id: node.getAttribute('data-evaluated-judgment'), rationale: node.getAttribute('data-source-rationale') })))
      expect(judgments).toEqual([...item.judgments].reverse().map(judgment => ({ id: judgment.id, rationale: judgment.rationale })))
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  }
  expect(errors).toEqual([])
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as ClientLanguage[]) {
  test(`${language}: original layout supports all three kinds, periods, chart modes and information`, async ({ page }, info) => {
    await page.addInitScript(locale => localStorage.setItem('tethLang', locale), language)
    await page.route('**/__local/strategy-catalogue.json', route => route.fulfill({ contentType: 'application/json', body }))
    const errors: string[] = []
    page.on('pageerror', error => errors.push(String(error)))
    for (const width of info.project.name === 'desktop' ? [1440] : [390, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const kind of ['agent', 'rule', 'mix']) {
        const item = input.items.find((item: { kind: string }) => item.kind === kind)
        await page.goto(`/#/share/s/${item.id}/all`)
        const detail = page.locator('[data-evaluated-strategy]')
        await expect(detail.locator('.catalogue-source-venue')).toHaveText(evaluatedExecutionDestination(language).label)
        for (const days of ['7', '30', '0']) {
          await detail.locator('.catalogue-chart-right select').selectOption(days)
          await detail.locator('.catalogue-chart-modes button').nth(2).click()
          await detail.locator('.catalogue-overview-svg').focus()
          await page.keyboard.press('End')
          await expect(detail.locator('.catalogue-value-tip')).toContainText('USDT')
          if (days !== '7') await expect(detail.locator('.catalogue-chart-hint')).toContainText(`${new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(Number(item.equity[0].value))} USDT`)
          await detail.locator('.catalogue-chart-modes button').nth(0).click()
          await detail.locator('.catalogue-chart-interval button').nth(1).click()
          await expect(detail.locator('.catalogue-overview-chart')).toHaveAttribute('data-point-count', '2')
          await expect(detail.locator('.catalogue-overview-svg')).not.toContainText('26.08')
          await detail.locator('.catalogue-chart-interval button').nth(0).click()
          const geometry = await detail.locator('[data-evaluated-metric="ret"] small').evaluate(node => {
            const range = document.createRange(); range.selectNodeContents(node)
            const text = range.getBoundingClientRect(), container = node.parentElement!.getBoundingClientRect()
            return { textRight: text.right, containerRight: container.right }
          })
          expect(geometry.textRight).toBeLessThanOrEqual(geometry.containerRight + 1)
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        }
        await detail.getByRole('tab').nth(1).click()
        const infoLabels = await detail.locator('.shared-detail-info dt').allTextContents()
        expect(new Set(infoLabels).size).toBe(infoLabels.length)
        await expect(detail.locator('.shared-detail-info')).toContainText(evaluatedExecutionDestination(language).label)
        await expect(detail.locator('.shared-detail-info')).toContainText('Binance USD-M · BTCUSDT')
        await expect(detail.locator('.shared-detail-info')).toContainText(evaluatedDetailText(language, kind === 'agent' ? 'agentBasis' : kind === 'rule' ? 'ruleBasis' : 'mixBasis'))
        if (kind === 'agent') await expect(detail.locator('.shared-detail-info')).not.toContainText('EMA20/50')
      }
    }
    expect(errors).toEqual([])
  })
}


test('mixed policy copy follows all four actual gates and never invents a different gate description', async () => {
  const document = await parseEvaluatedCatalogue(input)
  const mixed = document.items.filter(item => item.kind === 'mix')
  expect(mixed).toHaveLength(4)
  for (const item of mixed) {
    expect(evaluatedMixPolicyCopy(item, 'ko').description).toContain('저장된 9월 AI 진입 신호')
    const alternative = { ...item, policy: { ...item.policy, gate: 'A different confirmed condition' }, description: 'Original different rule description' }
    expect(evaluatedMixPolicyCopy(alternative, 'ko').description).toBe(alternative.description)
    expect(evaluatedMixPolicyCopy(alternative, 'ko').basis).not.toContain('EMA20')
  }
  expect(evaluatedDetailText('fr', 'mixDescription')).toContain('signaux d’entrée IA')
  const infoCopy = JSON.parse(readFileSync(new URL('../src/client-catalogue-ui-copy.json', import.meta.url), 'utf8'))
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as ClientLanguage[]) expect(evaluatedDetailText(language, 'recordSource')).not.toBe(infoCopy[language].record)
})

test('opening older synthetic trades places keyboard focus on the first newly revealed row', async ({ page }) => {
  const fixture = structuredClone(input)
  const item = fixture.items.find((item: { kind: string }) => item.kind === 'agent')
  const original = item.trades
  item.trades = Array.from({ length: Math.ceil(80 / original.length) }, (_, repeat) => original.map((trade: { id: string }) => ({ ...trade, id: `${trade.id}-focus-fixture-${repeat}` }))).flat()
  item.evaluation.tradeCount = item.trades.length
  item.evaluation.fillCount = 2 * item.trades.length
  const body = { ...fixture }
  delete body.revision
  fixture.revision = createHash('sha256').update(canonicalCatalogueJson(body) + '\n').digest('hex')
  const parsed = await parseEvaluatedCatalogue(fixture)
  expect(parsed.rejected).toBe(0)
  expect(item.trades.length).toBeGreaterThan(30)
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) }))
  await page.goto(`/#/share/s/${item.id}/all/trades`)
  await expect(page.locator('.catalogue-orders-full [data-evaluated-trade]')).toHaveCount(30)
  await page.locator('.catalogue-orders-full > button.shared-detail-analysis').click()
  const newlyVisible = page.locator('.catalogue-orders-full [data-evaluated-trade]').nth(30)
  await expect(newlyVisible).toBeFocused()
  await expect(page.locator('.catalogue-orders-full [data-evaluated-trade]')).toHaveCount(Math.min(80, item.trades.length))
})


test('calendar uses one tab stop and arrow keys while disabled actions expose their existing reasons', async ({ page }) => {
  const item = input.items.find((item: { kind: string }) => item.kind === 'agent')
  await page.goto('/#/share/s/' + item.id)
  const detail = page.locator(`[data-evaluated-strategy="${item.id}"]`)
  const calendar = detail.locator('.cal-g')
  await expect(calendar).toHaveAccessibleName('2026년 9월')
  await expect(calendar.locator('[data-daily-return][tabindex="0"]')).toHaveCount(1)
  const first = calendar.locator('[data-daily-return]').first()
  await first.focus()
  await page.keyboard.press('ArrowRight')
  await expect(calendar.locator('[data-daily-return]').nth(1)).toBeFocused()
  await page.keyboard.press('End')
  await expect(calendar.locator('[data-daily-return]').last()).toBeFocused()
  await page.keyboard.press('Home')
  await expect(first).toBeFocused()
  await expect(calendar.locator('[data-daily-return][tabindex="0"]')).toHaveCount(1)
  await expect(detail.getByRole('button', { name: '전략 복사하기', exact: true })).toHaveAccessibleDescription(/승인/)
  await expect(detail.getByRole('button', { name: '직접 검증하기', exact: true })).toHaveAccessibleDescription('현재 기록은 직접 검증할 수 없어요.')
})


test('a small source drawdown that rounds to zero never displays negative zero', async ({ page }) => {
  const fixture = structuredClone(input)
  const item = fixture.items.find((item: { evaluation: { maxDrawdownPct: string } }) => Number(item.evaluation.maxDrawdownPct) === 0)
  item.evaluation.maxDrawdownPct = '0.004'
  const body = { ...fixture }; delete body.revision
  fixture.revision = createHash('sha256').update(canonicalCatalogueJson(body) + '\n').digest('hex')
  expect((await parseEvaluatedCatalogue(fixture)).rejected).toBe(0)
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) }))
  await page.goto('/#/share/s/' + item.id)
  await expect(page.locator('[data-evaluated-metric="mdd"] b')).toHaveText('0.00%')
})
