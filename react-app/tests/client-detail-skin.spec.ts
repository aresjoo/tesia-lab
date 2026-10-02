import { expect, test, type Page } from '@playwright/test'
import { sourceSharedStrategies } from '../src/client-shared-strategies'
import { readSharedLocation, sharedHash } from '../src/client-shared-navigation'
import copy from '../src/client-detail-skin-copy.json' with { type: 'json' }

const row = sourceSharedStrategies()[0]
async function open(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '상세 검수', email: 'detail-skin@example.test' }))
  })
  await page.goto(`/${sharedHash({ nick: row.nick, period: 'all' })}`)
  await expect(page.locator('.client-shared-detail')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

test('기존 상세 주소와 새 정보 탭 주소를 자산 식별자·기간 손실 없이 왕복한다', () => {
  for (const nick of ['한글 전략', 'BTC/USDT', "quote'/?#"]) for (const period of ['all', '1y', '2y'] as const) {
    expect(readSharedLocation(sharedHash({ nick, period }))).toEqual({ nick, period })
    expect(readSharedLocation(sharedHash({ nick, period, detailTab: 'info' }))).toEqual({ nick, period, detailTab: 'info' })
  }
  expect(readSharedLocation('#/share/s/%E0%A4/all/info')).toEqual({ period: 'all' })
  expect(readSharedLocation('#/share/s/name/all/unknown')).toEqual({ period: 'all' })
})

test('원본 두 탭은 키보드·새로고침·뒤로가기로 복원되고 입력과 수치는 보존된다', async ({ page }) => {
  await open(page)
  const metrics = await page.locator('[data-metric] b').allTextContents()
  const overview = page.getByRole('tab', { name: '개요', exact: true })
  await overview.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: '전략 정보', exact: true })).toBeFocused()
  await expect(page).toHaveURL(/\/all\/info$/)
  await expect(page.getByRole('tabpanel', { name: '전략 정보' })).toBeVisible()
  await expect(page.getByRole('tabpanel', { name: '개요', exact: true })).toBeHidden()
  await expect(page.locator('.shared-detail-info dd').first()).toHaveText(row.nick)
  await expect(page.locator('.shared-detail-info')).not.toContainText('다음 날 시가')
  await page.reload()
  await expect(page.getByRole('tab', { name: '전략 정보' })).toHaveAttribute('aria-selected', 'true')
  await page.goBack()
  await expect(overview).toHaveAttribute('aria-selected', 'true')
  expect(await page.locator('[data-metric] b').allTextContents()).toEqual(metrics)
  await expect(page.locator('.ss3-chart')).toBeVisible()
})

for (const width of [320, 768, 1440]) test(`${width}px 원본 제목·버튼·곡선과 손익 달력은 표시값을 가리지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await open(page)
  await expect(page.locator('.ss3-dtitle')).toHaveCSS('font-size', width <= 768 ? '28px' : '32px')
  await expect(page.locator('.ss3-dtitle')).toHaveCSS('font-weight', '400')
  await expect(page.locator('.shared-detail-actions .wbtn')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.locator('.shared-detail-actions')).toHaveCSS('justify-content', 'flex-start')
  if (width > 768) {
    const heading = (await page.locator('.shared-detail-identity').boundingBox())!
    const action = (await page.locator('.shared-detail-actions .wbtn').boundingBox())!
    expect(action.x).toBeCloseTo(heading.x, 0)
    const labels = await page.locator('[data-metric] > small').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().y))
    expect(Math.max(...labels.slice(3)) - Math.min(...labels.slice(3))).toBeLessThan(1)
  }
  await expect(page.locator('.ss3-chart .ln')).toHaveCSS('stroke', /url\(/)
  await expect(page.locator('.ss3-chart .equity-fill')).toBeVisible()
  // A horizontal SVG line has zero geometric height even though its stroke
  // paints. Check stroke and on-plot coordinates instead of HTML visibility.
  const baseline = page.locator('.ss3-chart .equity-baseline')
  await expect(baseline).toHaveCSS('stroke', 'rgba(255, 255, 255, 0.24)')
  expect(await baseline.evaluate(node => {
    const line = node as SVGLineElement, svg = line.ownerSVGElement!
    return line.x2.baseVal.value > line.x1.baseVal.value && line.y1.baseVal.value === line.y2.baseVal.value && line.y1.baseVal.value >= 0 && line.y1.baseVal.value < svg.viewBox.baseVal.height
  })).toBe(true)
  const calendar = page.locator('.cal-g')
  await calendar.scrollIntoViewIfNeeded()
  const cells = page.locator('.cal-c[role="img"]:not(.off)')
  expect(await cells.count()).toBeGreaterThan(0)
  const colors = await cells.evaluateAll(nodes=>nodes.map(node=>({
    tone:node.classList.contains('u')?'u':node.classList.contains('d')?'d':'z',
    intensity:Number((node as HTMLElement).style.getPropertyValue('--a')), color:getComputedStyle(node).backgroundColor,
    value:Number(node.getAttribute('title')!.replace('%','').replaceAll(',','')), label:node.querySelector('i')!.textContent,
  })))
  for(const cell of colors){
    expect(cell.intensity).toBeGreaterThanOrEqual(0);expect(cell.intensity).toBeLessThanOrEqual(1)
    expect(cell.intensity).toBe(Number(Math.min(1,Math.abs(cell.value)/12).toFixed(2)))
    expect(cell.label).toMatch(/%$/)
    if(cell.tone==='z')expect(cell.color).toBe('rgb(38, 38, 38)')
    else {
      const channels=cell.color.match(/[\d.]+/g)!.map(Number)
      expect(channels.slice(0,3)).toEqual(cell.tone==='u'?[46,189,133]:[240,86,106])
      expect(channels[3]).toBeCloseTo(.12+cell.intensity*.42,2)
    }
  }
  await expect(cells.first()).toHaveCSS('font-size',width<=768?'12px':'14px')
  await expect(cells.first().locator('i')).toBeVisible()
  const sizes = await cells.locator('i').evaluateAll(elements => elements.map(element => ({ width: element.clientWidth, content: element.scrollWidth })))
  expect(sizes.every(size => size.content <= size.width + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`detail-calendar-${width}.png`) })
  await page.locator('.ss3-dtitle').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`detail-header-${width}.png`) })
})

test('7개 언어의 탭과 정보가 교체되며 사용자 이름·규칙 값은 변하지 않는다', async ({ page }) => {
  await open(page)
  await page.getByRole('tab', { name: '전략 정보' }).click()
  const values = await page.locator('.shared-detail-info dd').allTextContents()
  for (const language of Object.keys(copy) as (keyof typeof copy)[]) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(page.getByRole('tab', { name: copy[language].info, exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.shared-detail-info dd').first()).toHaveText(values[0])
    await expect(page.locator('.shared-detail-info dd').nth(1)).toHaveText(values[1])
    expect((await page.locator('.shared-detail-info dd').nth(3).innerText()).replace(',', '.')).toBe(values[3].replace(',', '.'))
  }
})
