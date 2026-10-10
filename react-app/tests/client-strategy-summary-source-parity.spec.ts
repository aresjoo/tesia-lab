import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { ClientTurn } from '../src/client-experience-store'
import { inlineInput } from '../src/client-inline-backtest'
import { commonBacktestText } from '../src/client-common-backtest-copy'
import { sourceIntakePreview, type SourceIntake } from '../src/client-source-intake'
import type { ClientLanguage } from '../src/client-preferences'

const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const intakeCopy = JSON.parse(readFileSync(new URL('../src/client-source-intake-copy.json', import.meta.url), 'utf8')) as Record<string, Record<ClientLanguage, string>>
const input = inlineInput({ pair: 'ETH/USDT', timeframe: '1시간봉', risk: '-4%', takeProfit: '+9%', mode: 'trend', requestedRsi: 31 })!
const observedAt = Date.now() - 1000
function proposal(excludedConditions: string[] = []): ClientTurn {
  return { id: 'source-summary-turn', question: '직접 입력한 조건', answer: '', fullAnswer: '', phase: 'plan',
    status: 'done', startedAt: observedAt, strategyObservedAt: observedAt, suggestions: [], inlineRequest: input,
    responseSequence: { version: 1, owner: 'summary-owner@example.test', sessionId: 'summary-session', turnId: 'source-summary-turn', revision: 1,
      status: 'done', blocks: [{ id: 'answer', kind: 'text', status: 'done', text: '사용자가 지정한 조건' }],
      strategyProposal: { input, name: '사용자가 지정한 RSI 31 전략', period: 365, excludedConditions } } }
}

async function mount(page: Page, turn: ClientTurn) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.route('**/strategy-summary-parity.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#232323;color:#eee;font-family:Arial,sans-serif;--gt3:#888;--gt:#eee;--gt2:#bbb"><main style="padding:18px"><div id="fixture"></div></main></body></html>' }))
  await page.goto('/strategy-summary-parity.html')
  await page.evaluate(async initial => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientCommonStrategySummary.tsx', dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts'
    const transformed = await (await fetch(cp)).text(), rp = transformed.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ rp), react = reactModule.default ?? reactModule
    const component = await import(/* @vite-ignore */ cp), dom = await import(/* @vite-ignore */ dp), preferences = await import(/* @vite-ignore */ pp)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    const current = structuredClone(initial), baseline = JSON.stringify(current), events = { open: 0, edit: 0 }
    const render = (busy = false, visited = false) => root.render(react.createElement(component.default, {
      turn: visited ? { ...current, commonBacktestOpened: true } : current, busy,
      onOpen: () => { events.open++ }, onEdit: () => { events.edit++ },
    }))
    Reflect.set(window, 'summaryParity', { render, events, language: (language: string) => preferences.setClientPreference('language', language),
      unchanged: () => JSON.stringify(current) === baseline })
    render()
  }, turn)
  const card = page.getByTestId('common-strategy-summary')
  await expect(card).toBeVisible()
  return { card, errors }
}

for (const excluded of [false, true]) test(`Q0${excluded ? 5 : 4}: 7언어 web/mobile 원본 행 계층과 요청·제외조건·preview를 보존한다`, async ({ page }, info) => {
  const conditions = excluded ? ['요청한 초단기 조건', '<img src=x onerror=alert(1)>'] : []
  const turn = proposal(conditions), { card, errors } = await mount(page, turn)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const language of languages) {
      await page.evaluate(language => Reflect.get(window, 'summaryParity').language(language), language)
      await expect(card.locator('dl>div')).toHaveCount(excluded ? 5 : 4)
      await expect(card.getByRole('heading')).toHaveText(turn.responseSequence!.strategyProposal!.name!)
      await expect(card.locator('dt').first()).toHaveText(commonBacktestText(language, 'asset'))
      await expect(card.locator('dd').first()).toHaveText(input.pair)
      await expect(card).toContainText(commonBacktestText(language, 'rsiRebound').replace('{rsi}', '31'))
      await expect(card).toContainText(commonBacktestText(language, 'takeRule').replace('{take}', '9'))
      await expect(card).toContainText(commonBacktestText(language, 'exitRule').replace('{stop}', '-4'))
      await expect(card.locator('.summary-note')).toContainText(commonBacktestText(language, 'summaryPreview'))
      await expect(card.locator('.summary-timeframe')).toContainText(commonBacktestText(language, 'frameHour'))
      await expect(card.locator('.summary-timeframe')).toContainText(commonBacktestText(language, 'daily'))
      await expect(card.locator('.summary-edit,img')).toHaveCount(0)
      if (excluded) {
        await expect(card.locator('dt').last()).toHaveText(commonBacktestText(language, 'excludedConditions'))
        await expect(card.locator('dd').last()).toHaveText(conditions.join(', '))
      }
      const geometry = await card.evaluate(node => {
        const row = node.querySelector('dl>div')!, label = row.querySelector('dt')!, value = row.querySelector('dd')!, button = node.querySelector('.summary-open')!
        return { width: node.getBoundingClientRect().width, padding: getComputedStyle(node).paddingLeft,
          borderRadius: getComputedStyle(node).borderRadius, rowDisplay: getComputedStyle(row).display,
          rowPadding: getComputedStyle(row).paddingTop, labelWidth: label.getBoundingClientRect().width,
          offset: value.getBoundingClientRect().left - label.getBoundingClientRect().left,
          height: button.getBoundingClientRect().height, overflow: node.scrollWidth > node.clientWidth + 1 }
      })
      expect(geometry).toMatchObject({ padding: '22px', borderRadius: '20px', rowDisplay: 'flex', rowPadding: '0px', labelWidth: 104, offset: 104, height: 48, overflow: false })
      expect(geometry.width).toBeLessThanOrEqual(560)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.screenshot({ path: info.outputPath(`Q0${excluded ? 5 : 4}-${width}-fr.png`), fullPage: true })
  }
  await card.locator('.summary-open').click()
  expect(await page.evaluate(() => Reflect.get(window, 'summaryParity').events)).toEqual({ open: 1, edit: 0 })
  expect(await page.evaluate(() => Reflect.get(window, 'summaryParity').unchanged())).toBe(true)
  expect(errors).toEqual([])
})

test('intake 수정은 허용하락 행 안에 연결하고 busy·재개·좁은 화면에서도 요청을 바꾸지 않는다', async ({ page }) => {
  const intake: SourceIntake = { answers: [
    { key: 'asset', index: 0, recommended: false }, { key: 'style', index: 1, recommended: true },
    { key: 'budget', index: 1, recommended: true }, { key: 'period', index: 1, recommended: true },
    { key: 'stop', index: 1, recommended: true },
  ] }
  const turn = { ...proposal(), responseSequence: undefined, sourceIntake: intake, inlineRequest: sourceIntakePreview(intake)!.input }
  await page.setViewportSize({ width: 320, height: 980 })
  const { card, errors } = await mount(page, turn)
  for (const language of languages) {
    await page.evaluate(language => Reflect.get(window, 'summaryParity').language(language), language)
    await expect(card.locator('dl>div')).toHaveCount(5)
    await expect(card.locator('dl>div').last().locator('.summary-edit')).toHaveText(commonBacktestText(language, 'revise'))
    for (const [index, key] of (['asset', 'budget', 'style', 'period', 'stop'] as const).entries()) {
      const answer = intake.answers.find(answer => answer.key === key)!
      await expect(card.locator('dt').nth(index)).toHaveText(intakeCopy[key][language])
      await expect(card.locator('dd').nth(index)).toHaveText(`${intakeCopy[`${key}${answer.index}`][language]}${answer.recommended ? ` (${intakeCopy.recommended[language]})` : ''}`)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await card.locator('.summary-edit').click()
  await page.evaluate(() => Reflect.get(window, 'summaryParity').render(true))
  await expect(card.locator('.summary-edit')).toBeDisabled()
  await expect(card.locator('.summary-open')).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'summaryParity').events)).toEqual({ open: 0, edit: 1 })
  await page.evaluate(() => Reflect.get(window, 'summaryParity').render(false, true))
  await expect(card).toHaveClass(/is-visited/)
  await expect(card.locator('button')).toHaveText(commonBacktestText('fr', 'resume'))
  await card.locator('button').click()
  expect(await page.evaluate(() => Reflect.get(window, 'summaryParity').events)).toEqual({ open: 1, edit: 1 })
  expect(await page.evaluate(() => Reflect.get(window, 'summaryParity').unchanged())).toBe(true)
  expect(errors).toEqual([])
})
