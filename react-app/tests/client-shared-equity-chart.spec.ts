import { expect, test, type Page } from '@playwright/test'
import { evaluateSourceTerminal, sourceTerminalSeeds } from '../src/client-terminal-source-fixture'
import { sharedChartCopy } from '../src/client-shared-chart-copy'
import { sharingDetailCopy } from '../src/client-sharing-detail-copy'
import type { ClientLanguage } from '../src/client-preferences'

type Point = { i: number; v: number }
type Harness = { update: (points: Point[], replayKey?: string) => void; unmount: () => void }
const example: Point[] = [{ i: 61, v: 1 }, { i: 62, v: 1.2 }, { i: 65, v: .9 }, { i: 88, v: 1.5 }, { i: 100, v: 1.1 }]
const dateAt = (i: number) => new Date(2024, 0, i + 1)
const dateText = (i: number) => { const d = dateAt(i); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` }

async function mount(page: Page, points = example, options: { width?: number; double?: boolean; badDate?: boolean; sourceDate?: boolean } = {}) {
  await page.route('**/shared-equity-chart-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3"><main id="fixture"></main></body></html>' }))
  await page.goto('/shared-equity-chart-test.html')
  await page.evaluate(async ({ points, options }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const font = '/node_modules/@fontsource-variable/noto-sans-kr/wght.css'; await import(/* @vite-ignore */ font)
    document.body.style.fontFamily = '"Noto Sans KR Variable",sans-serif'
    const style = document.createElement('style'); style.textContent = 'button{font:inherit}'; document.head.append(style)
    const cp = '/src/components/ClientSharedEquityChart.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    function Fixture() {
      const [equity, setEquity] = react.useState(points), [key, setKey] = react.useState('initial')
      Object.assign(window, { sharedChartHarness: { update: (next: Point[], replay = 'initial') => { setEquity(next); setKey(replay) }, unmount: () => root.unmount() } })
      const chartProps = { equity, replayKey: key, indexToDate: (i: number) => options.badDate ? new Date(NaN) : options.sourceDate ? new Date(2023, 0, i + 2) : new Date(2024, 0, i + 1) }
      return react.createElement('div', { style: { width: options.width ? `${options.width}px` : '100%', maxWidth: '100%', margin: '0 auto' } },
        react.createElement('button', { onClick: () => setKey((previous: string) => previous + '-replay') }, '기간 변경'),
        react.createElement(component.default, chartProps), options.double && react.createElement(component.default, chartProps),
        react.createElement('button', {}, '차트 다음'))
    }
    root.render(react.createElement(Fixture))
    Object.assign(window, { sharedChartRoot: root })
  }, { points, options })
  await expect(page.locator('.client-shared-equity-chart')).toHaveCount(options.double ? 2 : 1)
  await page.evaluate(async () => { await document.fonts.load('12px "Noto Sans KR Variable"', '누적 수익 곡선'); await document.fonts.ready })
}
async function update(page: Page, points: Point[], key = 'initial') {
  await page.evaluate(({ points, key }) => (window as unknown as { sharedChartHarness: Harness }).sharedChartHarness.update(points, key), { points, key })
}

for (const values of [[.9, 1.2, .8, 1.1], [.9, 1.2, .8, .9], [1.1, 1.3], [.7, .9], [1, 1], [1, 1.000000001]]) test(`시작금액 기준 손익색과 면은 ${values.join('/')} 원 관측에 결속한다`, async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const points = values.map((v, index) => ({ i: 61 + index * 3, v })), original = JSON.stringify(points)
  await mount(page, points)
  const svg = page.locator('.ss3-chart'), line = svg.locator('.ln')
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(svg).toHaveAttribute('viewBox', `0 0 ${width} ${width === 320 ? 200 : 360}`)
    expect(new Set(await svg.locator('.equity-tick text').allTextContents()).size).toBe(5)
    const baseline = Number(await svg.locator('.equity-baseline').getAttribute('y1'))
    const gradient = svg.locator('linearGradient[id$="-line-gradient"]')
    const stops = await gradient.locator('stop').evaluateAll(nodes => nodes.map(node => ({ color: node.getAttribute('stop-color'), offset: Number(node.getAttribute('offset')) })))
    const neutral = values.every(value => value === 1), gain = neutral ? '#8b9096' : '#2ebd85', loss = neutral ? '#8b9096' : '#f0566a'
    expect(stops.map(stop => stop.color)).toEqual([gain, gain, loss, loss])
    await expect(svg.locator('.mxlb circle')).toHaveAttribute('fill', Math.max(...values) >= 1 ? gain : loss)
    await expect(svg.locator('.endc')).toHaveAttribute('fill', values.at(-1)! >= 1 ? gain : loss)
    expect(stops[1].offset).toBe(stops[2].offset)
    const top = Number(await gradient.getAttribute('y1')), bottom = Number(await gradient.getAttribute('y2'))
    expect(top + stops[1].offset * (bottom - top)).toBeCloseTo(baseline, 5)
    expect(baseline).toBeGreaterThanOrEqual(top); expect(baseline).toBeLessThanOrEqual(bottom)
    await expect(line).toHaveCSS('stroke', /url\(/)
    await expect(svg.locator('.equity-fill')).toHaveAttribute('d', new RegExp(`L56,${baseline.toFixed(1)} Z$`))
    await expect(svg.locator('.equity-fill')).not.toHaveCSS('display', 'none')
    const vertices = (await line.getAttribute('points'))!.split(' ').map(pair => pair.split(',').map(Number))
    values.forEach((value, index) => {
      if (value > 1) expect(vertices[index][1]).toBeLessThan(baseline)
      if (value < 1) expect(vertices[index][1]).toBeGreaterThan(baseline)
      if (value === 1) expect(vertices[index][1]).toBeCloseTo(baseline, 1)
    })
    await svg.focus(); await svg.press('Home')
    for (const [index, value] of values.entries()) {
      if (index) await svg.press('ArrowRight')
      await expect(svg.locator('.xh')).toHaveAttribute('data-selected-index', String(points[index].i))
      await expect(page.getByRole('tooltip')).toContainText(`${value >= 1 ? '+' : ''}${((value - 1) * 100).toFixed(2)}%`)
      await expect(page.getByRole('tooltip')).toHaveCSS('background-color', 'rgb(75, 82, 93)')
      await expect(page.getByRole('tooltip').locator('b')).toHaveCSS('color', 'rgb(255, 255, 255)')
    }
    await svg.press('Tab')
    await svg.screenshot({ path: info.outputPath(`shared-baseline-${width}.png`) })
  }
  expect(JSON.stringify(points)).toBe(original)
  expect(errors).toEqual([])
})

test('부모 축소 중 리사이즈해도 SVG 좌표와 폰트 배율이 축소값으로 고정되지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mount(page)
  await page.locator('.ss3-bigwrap').evaluate(element => { element.style.transform = 'scale(.75)'; element.style.transformOrigin = 'top left' })
  await page.setViewportSize({ width: 1200, height: 1000 })
  const svg = page.locator('.ss3-chart')
  await expect.poll(() => svg.evaluate(element => Math.abs(element.viewBox.baseVal.width - element.clientWidth))).toBeLessThanOrEqual(1)
  await page.locator('.ss3-bigwrap').evaluate(element => { element.style.transform = '' })
  await expect.poll(() => svg.evaluate(element => Math.abs(element.viewBox.baseVal.width - element.getBoundingClientRect().width))).toBeLessThanOrEqual(1)
})

for (const fallback of ['missing', 'throws', 'singular'] as const) test(`SVG CTM ${fallback}에서도 사각 좌표 폴백으로 같은 관측점을 찾는다`, async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  const svg = page.locator('.ss3-chart')
  const point = await svg.evaluate((element, fallback) => {
    const box = element.getBoundingClientRect(), w = element.viewBox.baseVal.width
    Object.defineProperty(element, 'getScreenCTM', { configurable: true, value: () => {
      if (fallback === 'throws') throw new Error('CTM fixture unavailable')
      return fallback === 'missing' ? null : new DOMMatrix([0, 0, 0, 0, 0, 0])
    } })
    return { x: box.left + (56 + (65 - 61) / (100 - 61) * (w - 66)) / w * box.width, y: box.top + box.height / 2 }
  }, fallback)
  await page.mouse.move(point.x, point.y)
  await expect(svg.locator('.xh')).toHaveAttribute('data-selected-index', '65')
  await expect(page.getByRole('tooltip')).toContainText('-10.00%')
  expect(errors).toEqual([])
})

test('UTC-7·UTC+9·UTC+14에서도 원본 관측일이 다른 날짜로 밀리지 않는다', async ({ browser, baseURL }) => {
  for (const timezoneId of ['America/Los_Angeles', 'Asia/Seoul', 'Pacific/Kiritimati']) {
    const context = await browser.newContext({ baseURL, timezoneId, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
    try {
      const page = await context.newPage()
      await mount(page, [{ i: 61, v: 1 }, { i: 70, v: 1.2 }])
      const svg = page.locator('.ss3-chart')
      await svg.focus(); await svg.press('End')
      for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
        await page.evaluate(async language => {
          const path = '/src/client-preferences.ts'
          const { setClientPreference } = await import(path)
          setClientPreference('language', language)
        }, language)
        const expected = language === 'ko' ? '2024.03.11' : new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date('2024-03-11T00:00:00Z'))
        await expect(page.getByRole('tooltip').locator('small')).toHaveText(expected)
        await expect(svg.locator('.xh')).toHaveAttribute('data-selected-index', '70')
      }
    } finally { await context.close() }
  }
})

test('7언어 전환은 관측 선택·SVG 좌표·애니메이션 인스턴스를 보존하고 툴팁을 재배치한다', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await mount(page)
  const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
  const svg = page.locator('.ss3-chart'), tip = page.getByRole('tooltip')
  const handle = await svg.elementHandle()
  await svg.focus()
  await svg.press('Home'); await svg.press('ArrowRight')
  await svg.evaluate(node => Reflect.set(window, 'originalChartAnimations', node.getAnimations({ subtree: true })))
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => svg.getAttribute('viewBox')).toBe(`0 0 ${width} ${width <= 768 ? 200 : 360}`)
    const geometry = [await svg.locator('polyline').getAttribute('points'), await page.locator('.dd-line').getAttribute('d')]
    for (const language of languages) {
      await page.evaluate(async language => {
        const path = '/src/client-preferences.ts'
        const { setClientPreference } = await import(path)
        setClientPreference('language', language)
      }, language)
      await expect(svg).toBeFocused()
      await expect(svg).toHaveAccessibleName(sharingDetailCopy(language, '누적 수익 곡선'))
      await expect(svg.locator('.xh')).toHaveAttribute('data-selected-index', '62')
      expect(await svg.evaluate((node, original) => node === original, handle)).toBe(true)
      expect([await svg.locator('polyline').getAttribute('points'), await page.locator('.dd-line').getAttribute('d')]).toEqual(geometry)
      expect(await svg.evaluate(node => {
        const before: Animation[] = Reflect.get(window, 'originalChartAnimations'), after = node.getAnimations({ subtree: true })
        return before.length > 0 && before.length === after.length && before.every((animation, index) => animation === after[index])
      })).toBe(true)
      const date = dateAt(62)
      const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
      const expectedDate = language === 'ko' ? dateText(62) : new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(day)
      await expect(tip.locator('small')).toHaveText(expectedDate)
      await expect(tip.locator('b')).toHaveText(language === 'es' || language === 'fr' ? '+20,00%' : '+20.00%')
      await expect(page.locator('.ss3-drawdown .mt2')).toHaveText(sharedChartCopy(language, '고점 대비 하락률, 최저 {value}%', { value: language === 'es' || language === 'fr' ? '-26,7' : '-26.7' }))
      const box = (await tip.boundingBox())!, chart = (await svg.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(chart.x)
      expect(box.x + box.width).toBeLessThanOrEqual(chart.x + chart.width)
      expect(box.y).toBeGreaterThanOrEqual(chart.y)
      expect(box.y + box.height).toBeLessThanOrEqual(chart.y + chart.height)
      await page.screenshot({ path: info.outputPath(`shared-chart-${width}-${language}.png`) })
    }
  }
})

test('확대·축소된 차트에서도 관측점과 툴팁 중심이 같은 화면 좌표를 사용한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 }); await mount(page, example, { width: 1216 })
  const svg = page.locator('.ss3-chart')
  await svg.focus(); await svg.press('Home'); await svg.press('ArrowRight'); await svg.press('ArrowRight')
  await page.locator('.ss3-bigwrap').evaluate(node => { node.style.transformOrigin = 'top left'; node.style.transform = 'scale(.75)' })
  // Language remeasurement must still use local CSS pixels for the tooltip.
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('language', 'fr') })
  await expect(svg.locator('.xh')).toHaveAttribute('data-selected-index', '65')
  const point = await svg.locator('.xdot').evaluate(node => {
    const p = new DOMPoint(Number(node.getAttribute('cx')), Number(node.getAttribute('cy'))).matrixTransform(node.getScreenCTM()!)
    return { x: p.x, y: p.y }
  })
  await expect.poll(async () => { const box = (await page.getByRole('tooltip').boundingBox())!; return Math.abs(box.x + box.width / 2 - point.x) }).toBeLessThanOrEqual(1)
  await page.mouse.move(point.x, point.y)
  await expect(svg.locator('.xh')).toHaveAttribute('data-selected-index', '65')
  await expect(page.getByRole('tooltip').locator('b')).toHaveText('-10,00%')
})

test('차트 데이터 없음은 언어에 반응하되 곡선이나 수치를 만들지 않는다', async ({ page }) => {
  await mount(page, [])
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(path)
      setClientPreference('language', language)
    }, language)
    await expect(page.getByRole('status')).toHaveText(sharedChartCopy(language, '차트 데이터가 없어요'))
    await expect(page.locator('.ss3-chart')).toHaveCount(0)
  }
})

test('원본 501053b 1216×360 좌표·최고점과 전체 지점 기준 DD 산식을 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await mount(page, example, { width: 1216 })
  const svg = page.getByRole('img', { name: '누적 수익 곡선', exact: true })
  await expect(svg).toHaveAttribute('viewBox', '0 0 1216 360')
  // Golden coordinates evaluated from source tfSS3Chart/tfSS3DD at the pinned
  // source dimensions, including its repeated final equity vertex.
  await expect(svg.locator('polyline')).toHaveAttribute('points', '56.0,274.7 85.5,172.0 173.9,326.0 852.2,18.0 1206.0,223.3 1206.0,223.3')
  await expect(svg.locator('.mxlb')).toHaveAttribute('data-peak-index', '88')
  await expect(svg.locator('.mxlb text')).toHaveText('+50.0%')
  await expect(page.locator('.ss3-drawdown .mt2')).toHaveText('고점 대비 하락률, 최저 -26.7%')
  await expect(page.locator('.dd-line')).toHaveAttribute('d', 'M0.0 4 L31.2 4 L124.7 109 L841.8 4 L1216.0 116')
  await expect(page.getByRole('img', { name: '낙폭 곡선', exact: true })).toHaveAttribute('viewBox', '0 0 1216 120')
})

test('다운샘플되지 않은 실제 관측점에 크로스헤어 날짜·수익률을 결속한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const points = Array.from({ length: 481 }, (_, k) => ({ i: k * k + 61, v: k === 181 ? 1.234567 : 1 + k / 1000 }))
  await mount(page, points, { width: 1216 })
  const svg = page.locator('svg.ss3-chart'), box = (await svg.boundingBox())!
  const selected = points[181]
  await page.mouse.move(box.x + 56 + (selected.i - points[0].i) / (points.at(-1)!.i - points[0].i) * (box.width - 66), box.y + 80)
  await expect(svg.locator('.xh')).toHaveAttribute('data-selected-index', String(selected.i))
  await expect(page.getByRole('tooltip')).toContainText(dateText(selected.i))
  await expect(page.getByRole('tooltip')).toContainText('+23.46%')
  // The original line samples every second point, but hover must not snap to
  // that sampled neighbour or round its stored multiplier to four decimals.
  await page.mouse.move(box.x + 20, box.y + 80)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test('키보드는 관측점·시작·끝으로 움직이고 Escape와 Tab으로 안전하게 빠져나온다', async ({ page }) => {
  await mount(page)
  const chart = page.getByRole('img', { name: '누적 수익 곡선', exact: true })
  await chart.focus(); await expect(chart.locator('.xh')).toHaveAttribute('data-selected-index', '100')
  await page.keyboard.press('Home'); await expect(page.getByRole('tooltip')).toContainText(dateText(61))
  await page.keyboard.press('ArrowRight'); await expect(page.getByRole('tooltip')).toContainText('+20.00%')
  await page.keyboard.press('ArrowRight'); await expect(chart.locator('.xh')).toHaveAttribute('data-selected-index', '65')
  await expect(page.getByRole('tooltip')).toContainText('-10.00%')
  await page.keyboard.press('End'); await expect(chart.locator('.xh')).toHaveAttribute('data-selected-index', '100')
  await page.keyboard.press('Escape'); await expect(page.getByRole('tooltip')).toHaveCount(0); await expect(chart).toBeFocused()
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: '차트 다음' })).toBeFocused()
})

test('기간 변경만 드로우·리빌·끝점 효과를 재생하고 resize는 데이터나 모션을 초기화하지 않는다', async ({ page }) => {
  await mount(page)
  const line = page.locator('.ss3-chart .ln'), before = await line.elementHandle()
  const motion = await line.evaluate(node => { const css = getComputedStyle(node); return { duration: css.animationDuration, delay: css.animationDelay, name: css.animationName } })
  expect(motion).toEqual({ duration: '1.1s', delay: '0.05s', name: 'teth-shared-draw' })
  expect(await page.locator('.ss3-dd .rvl').evaluate(node => getComputedStyle(node).animationDelay)).toBe('0.2s')
  await expect.poll(() => line.evaluate(node => parseFloat(getComputedStyle(node).strokeDashoffset))).toBe(0)
  await page.setViewportSize({ width: 760, height: 800 })
  expect(await before!.evaluate(node => node === document.querySelector('.ss3-chart .ln'))).toBe(true)
  await page.getByRole('button', { name: '기간 변경' }).click()
  expect(await before!.evaluate(node => node.isConnected)).toBe(false)
  await expect(page.locator('.client-shared-equity-chart')).toHaveAttribute('data-replay-key', 'initial-replay')
  await expect(page.getByRole('button', { name: '기간 변경' })).toBeFocused()
  await expect.poll(() => page.locator('.ss3-chart .endc').evaluate(node => Number(getComputedStyle(node).opacity))).toBe(1)
})

for (const width of [320, 1440]) test(`${width}px 툴팁 양끝·최고점과 낙폭 설명이 범위를 넘지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 850 }); await mount(page)
  const chart = page.getByRole('img', { name: '누적 수익 곡선', exact: true }), wrap = page.locator('.ss3-bigwrap')
  await chart.focus()
  for (const key of ['Home', 'End', 'ArrowLeft']) {
    await page.keyboard.press(key)
    await expect.poll(async () => {
      const tip = await page.getByRole('tooltip').boundingBox(), host = await wrap.boundingBox()
      return Boolean(tip && host && tip.x >= host.x && tip.y >= host.y && tip.x + tip.width <= host.x + host.width + 1 && tip.y + tip.height <= host.y + host.height + 1)
    }).toBe(true)
  }
  expect((await chart.boundingBox())!.height).toBe(width === 320 ? 200 : 360)
  expect((await page.locator('.ss3-dd').boundingBox())!.height).toBe(120)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await expect.poll(() => page.locator('.ss3-chart .mxlb').evaluate(node => Number(getComputedStyle(node).opacity))).toBe(1)
  await page.screenshot({ path: info.outputPath(`shared-chart-${width}.png`) })
})

test('축소 모션은 시간 대기 없이 모든 곡선을 표시하고 끝점 펄스를 재생하지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await mount(page)
  const styles = await page.locator('.ln,.rvl,.endc,.endp,.mxlb').evaluateAll(nodes => nodes.map(node => ({ name: getComputedStyle(node).animationName, className: node.getAttribute('class'), opacity: getComputedStyle(node).opacity })))
  expect(styles.every(style => style.name === 'none')).toBe(true)
  expect(styles.find(style => style.className === 'endp')?.opacity).toBe('0')
  expect(styles.find(style => style.className === 'endc')?.opacity).toBe('1')
  await page.getByRole('button', { name: '기간 변경' }).click()
  expect(await page.locator('.ln').evaluate(node => getComputedStyle(node).strokeDashoffset)).toBe('0px')
})

test('0·1·손상·불연속 순서와 날짜 오류에는 NaN 그래프를 만들지 않는다', async ({ page }) => {
  await mount(page, [])
  const invalid = [[], [example[0]], [{ i: 61, v: NaN }, example[1]], [{ i: 61, v: Infinity }, example[1]], [example[1], example[0]], [{ i: 61, v: Number.MAX_VALUE }, example[1]]]
  for (const points of invalid) {
    await update(page, points)
    await expect(page.getByRole('status')).toHaveText('차트 데이터가 없어요')
    await expect(page.locator('svg')).toHaveCount(0)
  }
  await mount(page, example, { badDate: true })
  await expect(page.getByRole('status')).toHaveText('차트 데이터가 없어요')
})

test('원본 엔진 곡선의 모바일·데스크톱 정적/호버 캡처를 남긴다', async ({ page }, info) => {
  const result = evaluateSourceTerminal(sourceTerminalSeeds[0].parameters, sourceTerminalSeeds[0].capital).r
  await mount(page, result.eq, { sourceDate: true })
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.locator('.ss3-chart .endc').evaluate(node => Number(getComputedStyle(node).opacity))).toBe(1)
    await page.locator('.client-shared-equity-chart').screenshot({ path: info.outputPath(`source-equity-${width}.png`) })
    await page.locator('.ss3-chart').focus(); await page.keyboard.press('End')
    await expect(page.getByRole('tooltip')).toContainText('+30.92%')
    await page.locator('.client-shared-equity-chart').screenshot({ path: info.outputPath(`source-equity-${width}-hover.png`) })
    await page.keyboard.press('Tab')
  }
})

test('평탄·0까지 손실인 곡선도 유한하며 입력을 변형하거나 전역 hover 상태를 만들지 않는다', async ({ page }) => {
  await mount(page, [{ i: 61, v: 1 }, { i: 80, v: 1 }], { double: true })
  await expect(page.locator('.ln.up')).toHaveCount(2)
  const ids = await page.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id))
  expect(new Set(ids).size).toBe(ids.length)
  expect(await page.evaluate(() => 'TF_SS3_HOV' in window)).toBe(false)
  await update(page, [{ i: 61, v: 1 }, { i: 80, v: 0 }], 'loss')
  await expect(page.locator('.ln.dn')).toHaveCount(2)
  await expect(page.locator('.ss3-drawdown .mt2').first()).toContainText('-100.0%')
  for (const shape of await page.locator('path,polyline,circle').all()) expect(await shape.evaluate(node => node.outerHTML)).not.toMatch(/NaN|Infinity/)
  await page.evaluate(() => (window as unknown as { sharedChartHarness: Harness }).sharedChartHarness.unmount())
  await expect(page.locator('.client-shared-equity-chart')).toHaveCount(0)
  await page.setViewportSize({ width: 500, height: 700 })
})

test('6개 원본 엔진과 열린 포지션으로 끝난 구간의 eq를 중복 관측까지 그대로 소비한다', async ({ page }) => {
  const results = sourceTerminalSeeds.map(seed => evaluateSourceTerminal(seed.parameters, seed.capital).r)
  // A valid window ending immediately before d1's final exit stays in-position:
  // the source appends the terminal mark-to-market point a second time.
  results.push(evaluateSourceTerminal({ ...sourceTerminalSeeds[0].parameters, endI: 1175 }, sourceTerminalSeeds[0].capital).r)
  expect(results.some(result => result.eq.some((point, i) => i > 0 && point.i === result.eq[i - 1].i))).toBe(true)
  await mount(page, results[0].eq)
  for (const [index, result] of results.entries()) {
    const original = JSON.stringify(result.eq)
    await update(page, result.eq, String(index))
    await expect(page.locator('.client-shared-equity-chart')).toHaveAttribute('data-point-count', String(result.eq.length))
    await expect(page.locator('.ss3-chart')).toBeVisible()
    await page.locator('.ss3-chart').focus(); await page.keyboard.press('End')
    await expect(page.getByRole('tooltip')).toContainText(`${result.ret >= 0 ? '+' : ''}${result.ret.toFixed(2)}%`)
    expect(JSON.stringify(result.eq)).toBe(original)
  }
})
