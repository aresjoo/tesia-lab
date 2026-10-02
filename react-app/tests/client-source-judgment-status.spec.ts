import { expect, test, type Page } from '@playwright/test'
import { evaluateSourceTerminal, sourceTerminalSeeds, sourceTerminalDate, type SourceTerminalSeed } from '../src/client-terminal-source-fixture'
import { sourceJudgmentText } from '../src/client-source-judgment-copy'
import { sharedNumber, sharedPercent } from '../src/client-shared-number-format'

const sourceDay = (i: number) => {
  const date = sourceTerminalDate(i)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const base = sourceTerminalSeeds[0]
const events = evaluateSourceTerminal(base.parameters, base.capital).L.evs
const entry = events.find(event => event.k === 'entry')!
const heldSeed: SourceTerminalSeed = { ...base, parameters: { ...base.parameters, endI: entry.i + 1 } }
const flatSeed: SourceTerminalSeed = { ...base, parameters: { ...base.parameters, endI: entry.i - 1 } }

async function mount(page: Page, seed: SourceTerminalSeed = heldSeed, preview = true, watch = false) {
  await page.route('**/judgment-status-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#171717;color:#ececec;font-family:sans-serif"><div id="fixture" style="max-width:430px;margin:auto"></div></body></html>' }))
  await page.goto('/judgment-status-test.html')
  await page.evaluate(async ({ seed, preview, watch }) => {
    localStorage.setItem('tethLang', 'ko'); localStorage.setItem('tethCurrency', 'KRW')
    const runtimePath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ runtimePath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (t: unknown) => t, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientSourceJudgmentStatus.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch('/src/components/ClientSourceTerminalWorkspace.tsx')).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ rp), react = reactModule.default ?? reactModule
    const dom = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp)
    const ep = '/src/client-terminal-source-fixture.ts', pp = '/src/client-preferences.ts'
    const engine = await import(/* @vite-ignore */ ep), preferences = await import(/* @vite-ignore */ pp)
    Reflect.set(window, 'setPreference', preferences.setClientPreference)
    const result = engine.evaluateSourceTerminal(seed.parameters, seed.capital)
    function Host() {
      return react.createElement(component.ClientSourceJudgmentStatus, { seed, result, preview, watch, exchangeName: seed.exchangeId === 'binance' ? 'Binance' : seed.exchangeId })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(react.createElement(Host))
  }, { seed, preview, watch })
  await expect(page.locator('.csj-status')).toBeVisible()
}

for (const state of ['live', 'off', 'ready', 'err'] as const) test(`bc663 ${state} 원본 상태와 마지막 검증 날짜를 표시한다`, async ({ page }) => {
  const seed = { ...heldSeed, status: state }, result = evaluateSourceTerminal(seed.parameters, seed.capital)
  await mount(page, seed)
  await expect(page.locator('h3')).toHaveText(sourceJudgmentText('ko', state === 'live' ? 'exit' : state, { asset: 'BTC' }))
  await expect(page.locator('.csj-scope')).toHaveText(sourceJudgmentText('ko', 'scope', { date: sourceDay(result.r.params.endI) }))
  await expect(page.locator('.csj-status')).not.toContainText(/방금|운용 중|마지막 확인/)
  await expect(page.locator('[data-field=position] dd')).toContainText(state === 'live' ? '롱' : '없음')
  await expect(page.locator('.csj-icon')).toHaveAttribute('src', '/client-broker-assets/app-binance.png')
  expect(await page.locator('.csj-icon').evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true)
})

test('bc663 기록 상태는 실행 권한이나 실제 운용으로 바뀌지 않으며 포지션을 숨기지 않는다', async ({ page }) => {
  await mount(page, { ...heldSeed, status: 'off' }, false)
  await expect(page.locator('h3')).toHaveText('검증 마지막 시점의 상태입니다')
  await expect(page.locator('[data-field=position] dd')).toContainText('롱')
  await expect(page.locator('.csj-status')).toHaveAttribute('data-source', 'synthetic-daily')
  await expect(page.locator('.csj-status')).not.toContainText(/운용 중|연결,|확인하고 있습니다/)
})

test('bc663 watch는 제목만 바꾸고 기존 손절·익절 근거를 유지한다', async ({ page }) => {
  await mount(page, heldSeed, true, true)
  await expect(page.locator('h3')).toHaveText('AI 판단이 잠시 멈춰 있습니다')
  await expect(page.locator('[data-field=stop]')).toBeVisible()
  await expect(page.locator('[data-field=target]')).toBeVisible()
})

test('bc663 미보유 진입조건은 정확한 전략 설정이며 알 수 없는 거래소 아이콘은 합성하지 않는다', async ({ page }) => {
  const seed = { ...flatSeed, exchangeId: 'unregistered', parameters: { ...flatSeed.parameters, rsiTh: 39.75, trendFilter: true } }
  // This earlier cutoff precedes the first entry for both thresholds.
  expect(evaluateSourceTerminal(seed.parameters, seed.capital).pos).toBeNull()
  await mount(page, seed)
  await expect(page.locator('h3')).toHaveText('진입 조건을 기다리고 있습니다')
  await expect(page.locator('[data-field=condition] dd')).toHaveText('RSI 39.75 아래에서 0.5% 넘게 반등, 20일과 60일 평균 차이 3% 초과')
  await expect(page.locator('.csj-icon')).toHaveCount(0)
  await expect(page.locator('[data-field=stop]')).toHaveCount(0)
})

test('bc663 익절 미설정은 생략하고 0% 설정은 누락하지 않는다', async ({ page }) => {
  for (const tp of [null, 0]) {
    const seed = { ...heldSeed, parameters: { ...heldSeed.parameters, endI: entry.i, tp } }
    await mount(page, seed)
    await expect(page.locator('[data-field=target]')).toHaveCount(tp === null ? 0 : 1)
    if (tp === 0) await expect(page.locator('[data-field=target] dd')).toHaveText('진입가 대비 +0%')
    await expect(page.locator('.csj-change')).toHaveClass(/zz/)
  }
})

test('0eb338 언어7개와 과거 통화 요청에도 진입가 대비 비율·수량·DOM을 보존한다', async ({ page }) => {
  const result = evaluateSourceTerminal(heldSeed.parameters, heldSeed.capital), position = result.pos!
  expect(position).not.toBeNull()
  await mount(page)
  const root = await page.locator('.csj-status').elementHandle()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(language => Reflect.get(window, 'setPreference')('language', language), language)
    await expect(page.locator('h3')).toHaveText(sourceJudgmentText(language, 'exit', { asset: 'BTC' }))
    for (const currency of ['KRW', 'USD', 'BTC']) {
      await page.evaluate(currency => Reflect.get(window, 'setPreference')('currency', currency), currency)
      await expect(page.locator('[data-field=stop] dd')).toHaveText(sourceJudgmentText(language, 'fromEntry', { percent: sharedPercent(heldSeed.parameters.sl, language, 'auto', false) }))
      await expect(page.locator('.csj-status')).not.toContainText('$')
      await expect(page.locator('[data-field=position] dd')).toContainText(sharedNumber(position.qty, language, 4))
      await expect(page.locator('[data-field=holding] dd')).toHaveText(sourceJudgmentText(language, 'oneDay'))
      await expect(page.locator('.csj-thought h4')).toHaveText(sourceJudgmentText(language, 'thought'))
      await expect(page.locator('.csj-thought p')).toContainText(sourceJudgmentText(language, 'maintain', { asset: 'BTC' }))
      expect(await page.locator('.csj-status').evaluate((el, old) => el === old, root)).toBe(true)
    }
  }
})

for (const width of [264, 320, 430]) test(`bc663 ${width}px 200% 글자·숫자는 행 경계 안에 남는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1100 })
  await mount(page)
  await page.evaluate(() => Reflect.get(window, 'setPreference')('language', 'fr'))
  await page.locator('.csj-status').evaluate(root => {
    const sizes = [root, ...root.querySelectorAll<HTMLElement>('*')].map(el => [el, parseFloat(getComputedStyle(el).fontSize)] as const)
    for (const [el, size] of sizes) (el as HTMLElement).style.fontSize = `${size * 2}px`
  })
  expect(await page.locator('.csj-status').evaluate(root => {
    const box = root.getBoundingClientRect()
    return [...root.querySelectorAll('h3, dt, dd, .csj-venue')].every(el => {
      const r = el.getBoundingClientRect()
      return r.left >= box.left && r.right <= box.right && el.scrollWidth <= el.clientWidth + 1
    }) && document.documentElement.scrollWidth <= innerWidth
  })).toBe(true)
  for (const value of await page.locator('.csj-row dd').all()) await expect(value).toHaveCSS('text-align', 'start')
  // Text glyph bounds, not merely the CSS boxes, must fit each row.
  expect(await page.locator('.csj-list').evaluate(root => {
    const box = root.getBoundingClientRect(), walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walk.nextNode())) {
      const range = document.createRange(); range.selectNodeContents(node)
      if ([...range.getClientRects()].some(r => r.left < box.left || r.right > box.right)) return false
    }
    return true
  })).toBe(true)
  await page.screenshot({ path: info.outputPath(`judgment-${width}-fr-200.png`), fullPage: true })
})
