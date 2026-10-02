import { expect, test, type Page } from '@playwright/test'
import { evaluateSourceTerminal, sourceTerminalSeeds } from '../src/client-terminal-source-fixture'
import { terminalReadText } from '../src/client-terminal-read-copy'

type Point = { i: number; v: number }
const sample = [{ i: 0, v: 1 }, { i: 30, v: 1.1 }, { i: 90, v: .9 }, { i: 90, v: .95 }]
async function mount(page: Page, points = sample) {
  await page.route('**/nav-chart-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3"><main id="fixture"></main></body></html>' }))
  await page.goto('/nav-chart-test.html')
  await page.evaluate(async points => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientSourceNavChart.tsx', dp = '/@id/react-dom/client', css = '/src/client-source-terminal.css'
    await import(/* @vite-ignore */ css)
    const text = await (await fetch(cp)).text(), rp = text.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    function Fixture() {
      const [equity, setEquity] = react.useState(points)
      Object.assign(window, { navHarness: { update: setEquity, unmount: () => root.unmount() } })
      return react.createElement('div', {}, react.createElement(component.ClientSourceNavChart, { equity, label: 'NAV fixture' }), react.createElement(component.ClientSourceNavChart, { equity, label: 'NAV fixture sibling' }))
    }
    root.render(react.createElement(Fixture))
  }, points)
  await expect(page.locator('#fixture')).not.toBeEmpty()
}
async function update(page: Page, points: Point[]) {
  await page.evaluate(points => (window as unknown as { navHarness: { update: (p: Point[]) => void } }).navHarness.update(points), points)
}

test('모든 원본 seed와 평평한 곡선은 원본 표본·기준선·손익색을 보존한다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await mount(page)
  for (const eq of [sample, ...sourceTerminalSeeds.map(seed => evaluateSourceTerminal(seed.parameters, seed.capital).r.eq), [{ i: 0, v: 1 }, { i: 2, v: 1 }], [{ i: 0, v: .99 }, { i: 2, v: .99 }], [{ i: 0, v: 1.01 }, { i: 2, v: 1.01 }]]) {
    await update(page, eq)
    const min = Math.min(...eq.map(p => p.v)), max = Math.max(Math.max(...eq.map(p => p.v)), min + 1e-9)
    const y = (v: number) => 130 - (v - min) / Math.max(1e-9, max - min) * 124
    const first = eq[0], last = eq[eq.length - 1], pts: string[] = []
    for (let k = 0; k < eq.length; k += Math.max(1, Math.floor(eq.length / 120))) pts.push(`${((eq[k].i - first.i) / Math.max(1, last.i - first.i) * 700).toFixed(1)},${y(eq[k].v).toFixed(1)}`)
    pts.push(`${((last.i - first.i) / Math.max(1, last.i - first.i) * 700).toFixed(1)},${y(last.v).toFixed(1)}`)
    await expect(page.locator('polyline').first()).toHaveAttribute('points', pts.join(' '))
    await expect(page.locator('.area').first()).toHaveAttribute('d', `M${pts.join(' L')} L700,132 L0,132 Z`)
    await expect(page.locator('.base').first()).toHaveAttribute('y1', y(Math.min(Math.max(1, min), max)).toFixed(1))
    await expect(page.locator('polyline').first()).toHaveClass(last.v >= 1 ? 'ln up' : 'ln dn')
    await expect(page.locator('.cst-nav-chart').first()).toHaveAttribute('data-point-count', String(eq.length))
  }
  expect(errors).toEqual([])
})

test('두 곡선 gradient는 서로 독립적이며 날짜·통화 변경에도 같은 DOM과 선을 보존한다', async ({ page }) => {
  await mount(page)
  const chart = page.locator('.cst-nav-chart').first(), svg = await chart.locator('svg').elementHandle()
  await expect(page.getByRole('img', { name: 'NAV fixture', exact: true })).toHaveCount(1)
  await expect(page.getByRole('img', { name: 'NAV fixture sibling', exact: true })).toHaveCount(1)
  const points = await chart.locator('polyline').getAttribute('points')
  const ids = await page.locator('linearGradient').evaluateAll(elements => elements.map(el => el.id))
  expect(new Set(ids).size).toBe(2)
  await expect(page.locator('.area').nth(0)).toHaveAttribute('fill', `url(#${ids[0]})`)
  await expect(page.locator('.area').nth(1)).toHaveAttribute('fill', `url(#${ids[1]})`)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => { const p = '/src/client-preferences.ts'; const mod = await import(/* @vite-ignore */ p); mod.setClientPreference('language', language); mod.setClientPreference('currency', 'BTC') }, language)
    const format = new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: 'short' })
    await expect(chart.locator('.cst-nav-dates span')).toHaveText(language === 'ko' ? ['2023.01', '2023.04'] : [format.format(new Date('2023-01-02T00:00:00Z')), format.format(new Date('2023-04-02T00:00:00Z'))])
    await expect(chart.locator('polyline')).toHaveAttribute('points', points!)
    expect(await svg!.evaluate(el => el === document.querySelector('.cst-nav-chart svg'))).toBe(true)
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const readable = await chart.locator('.cst-nav-dates').evaluate(root => {
        const [start, end] = [...root.children].map(el => el.getBoundingClientRect())
        return start.right <= end.left && root.scrollWidth <= root.clientWidth + 1
      })
      expect(readable).toBe(true)
    }
  }
})

test('시간대가 달라도 원본 달력 월은 보존하며 화면 이탈로 관측값을 생산하지 않는다', async ({ browser, baseURL }) => {
  for (const timezoneId of ['America/Los_Angeles', 'Asia/Seoul', 'Pacific/Kiritimati']) {
    const context = await browser.newContext({ baseURL, timezoneId, viewport: { width: 320, height: 900 } })
    try {
      const page = await context.newPage(), requests: string[] = []
      page.on('request', r => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method())) requests.push(r.url()) })
      await mount(page, [{ i: 29, v: 1 }, { i: 30, v: .95 }])
      await page.evaluate(async () => { const p = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ p)).setClientPreference('language', 'en') })
      await expect(page.locator('.cst-nav-dates').first().locator('span')).toHaveText(['Jan 2023', 'Feb 2023'])
      const line = await page.locator('polyline').first().getAttribute('points')
      await page.locator('#fixture').evaluate(el => { el.style.display = 'none' })
      await page.locator('#fixture').evaluate(el => { el.style.display = '' })
      await expect(page.locator('polyline').first()).toHaveAttribute('points', line!)
      expect(requests).toEqual([])
    } finally { await context.close() }
  }
})

test('빈 값·비유한 수치·역행 시간은 가짜 선 없이 원본 빈 상태로 복귀한다', async ({ page }) => {
  await mount(page)
  for (const points of [[], [sample[0]], [{ i: 1, v: 1 }, { i: 0, v: 2 }], [{ i: 0, v: NaN }, { i: 1, v: 1 }], [{ i: 0, v: Infinity }, { i: 1, v: 1 }], [{ i: -1, v: 1 }, { i: 1, v: 1 }], [{ i: 0, v: 1 }, { i: Number.MAX_SAFE_INTEGER, v: 1 }]]) {
    await update(page, points)
    await expect(page.locator('svg')).toHaveCount(0)
    await expect(page.getByRole('img')).toHaveCount(0)
    await expect(page.getByRole('status')).toHaveCount(2)
  }
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => { const p = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ p)).setClientPreference('language', language) }, language)
    await expect(page.getByRole('status').first()).toHaveText(terminalReadText(language, 'emptyCurve'))
  }
  await update(page, sample)
  await expect(page.locator('svg')).toHaveCount(2)
  await expect(page.getByRole('img', { name: 'NAV fixture', exact: true })).toHaveCount(1)
  await expect(page.getByRole('status')).toHaveCount(0)
})
