import { expect, test, type Page } from '@playwright/test'
import { commonMonths } from '../src/client-common-months'

type Point = { i: number; value: number }
const point = (date: string, value: number): Point => ({ i: (Date.parse(`${date}T00:00:00Z`) - Date.UTC(2023, 0, 2)) / 86_400_000, value })
const partial = [point('2024-01-15', 101), point('2024-01-31', 110), point('2024-02-01', 112), point('2024-02-15', 108.94)]
const one = [point('2024-01-15', 110), point('2024-01-31', 110), point('2024-02-01', 120), point('2024-02-29', 99), point('2024-03-01', 108.9)]
const two = [...one.slice(0, -1), point('2024-03-01', 100), point('2024-03-31', 108.9), point('2024-04-01', 110)]
const three = [...two.slice(0, -1), point('2024-04-01', 110), point('2024-04-30', 115), point('2024-05-01', 116)]

async function mount(page: Page, points: Point[]) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.route('**/common-months-parity.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#000;color:#eee;font-family:sans-serif;margin:0;--gt:#eee;--gl2:#222"><main class="client-common-bt" style="box-sizing:border-box"><div id="fixture"></div></main></body></html>' }))
  await page.goto('/common-months-parity.html')
  await page.evaluate(async points => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientCommonMonths.tsx', dp = '/@id/react-dom/client', css = '/src/client-common-backtest.css'
    const transformed = await (await fetch(cp)).text(), rp = transformed.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ rp), react = reactModule.default ?? reactModule
    const component = await import(/* @vite-ignore */ cp), dom = await import(/* @vite-ignore */ dp)
    await import(/* @vite-ignore */ css)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    const render = (data: typeof points) => root.render(react.createElement(react.StrictMode, null, react.createElement(component.default, { points: data, capital: 100 })))
    Reflect.set(window, 'renderCommonMonths', render)
    render(points)
  }, points)
  const region = page.getByRole('region', { name: '월별 수익률' })
  await expect(region).toBeVisible()
  return { region, errors }
}

test('source full0은 표를 숨기고 일부월 원값의 누적 수익을 한 줄로 보여준다', async ({ page }) => {
  expect(commonMonths(partial, 100).every(month => month.partial)).toBe(true)
  const { region, errors } = await mount(page, partial)
  await expect(region.locator('p')).toHaveText('아직 한 달이 안 됐습니다. 지금까지 +8.9%입니다.')
  await expect(region.locator('table,.cbt-month-cards')).toHaveCount(0)
  await expect(region.locator('header span')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('source full1·2는 일부 기간 안내와 기존 월별 원값·일부 표시를 유지한다', async ({ page }, info) => {
  for (const points of [one, two]) {
    const full = commonMonths(points, 100).filter(month => !month.partial)
    expect(full).toHaveLength(points === one ? 1 : 2)
    const { region, errors } = await mount(page, points)
    await expect(region.locator('header>span').first()).toHaveText('시작한 달과 마지막 달은 일부 기간만 계산했습니다.')
    await expect(region.locator('.cbt-month-short')).toHaveCount(0)
    const display = region.locator(info.project.name === 'mobile' ? '.cbt-month-cards' : '.cbt-month-scroll')
    await expect(display).toBeVisible()
    await expect(display.locator('[data-month="2024-01"]')).toHaveAttribute('data-partial', 'true')
    await expect(display.locator('[data-month="2024-02"]')).toHaveAttribute('data-partial', 'false')
    await expect(display.locator('[data-month="2024-02"]')).toContainText('-10.0%')
    expect(errors).toEqual([])
  }
})

test('source full3 이상은 기존 정확한 표와 요약을 유지하고 상태 왕복에서도 분기한다', async ({ page }, info) => {
  expect(commonMonths(three, 100).filter(month => !month.partial)).toHaveLength(3)
  const { region, errors } = await mount(page, three)
  await expect(region.locator('header>span').first()).toHaveText('한 달 전체를 계산한 3개월 중 2개월에 수익이 났습니다')
  await expect(region.locator('thead th')).toHaveCount(14)
  const display = region.locator(info.project.name === 'mobile' ? '.cbt-month-cards' : '.cbt-month-scroll')
  await expect(display.locator('[data-month="2024-03"]')).toContainText('+10.0%')
  await page.evaluate(points => Reflect.get(window, 'renderCommonMonths')(points), partial)
  await expect(region.locator('.cbt-month-short')).toBeVisible()
  await expect(region.locator('table')).toHaveCount(0)
  await page.evaluate(points => Reflect.get(window, 'renderCommonMonths')(points), three)
  await expect(region.locator('thead th')).toHaveCount(14)
  expect(errors).toEqual([])
})

test('빈 관측은 누적 수익을 만들지 않으며 짧은 안내는 모바일 200%에서 읽을 수 있다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 980 })
  const { region, errors } = await mount(page, [])
  await expect(region.locator('p')).toHaveText('관측 없음')
  await expect(region.locator('b')).toHaveCount(0)
  await page.evaluate(points => Reflect.get(window, 'renderCommonMonths')(points), partial)
  await expect(region.locator('p')).toHaveText('아직 한 달이 안 됐습니다. 지금까지 +8.9%입니다.')
  await region.locator('p').evaluate(node => { node.style.fontSize = `${parseFloat(getComputedStyle(node).fontSize) * 2}px` })
  expect(await region.locator('p').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  expect(await region.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath('monthly-short-320-200.png') })
  expect(errors).toEqual([])
})
