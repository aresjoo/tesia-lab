import { installCommonResponseFixture } from './fixtures/client-common-response-fixture'
import { expect, test } from '@playwright/test'
import { commonBacktestText as copy } from '../src/client-common-backtest-copy'

for (const language of ['ko', 'fr'] as const) test(`${language} a942 판단 결과는 실제 목록 폭에 맞고 근거 펼침 후에도 겹치지 않는다`, async ({ page }, info) => {
  await page.clock.install()
  await page.addInitScript(language => {
    localStorage.setItem('tethLang', language)
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수', email: 'row@example.test' }))
  }, language)
  await installCommonResponseFixture(page, 'row@example.test')
  await page.goto('/')
  await page.locator('#strategy-idea').fill('BTC RSI 30 미만 반등 일봉 손절 3%, 익절 8%')
  await page.locator('#strategy-idea').press('Enter')
  await page.clock.fastForward(20_000)
  await page.getByRole('button', { name: copy(language, 'open'), exact: true }).click()
  await expect.poll(async () => { await page.clock.runFor(200); return page.getByTestId('common-backtest').count() }).toBe(1)
  await page.getByRole('button', { name: copy(language, 'run'), exact: true }).click()
  await page.getByRole('button', { name: copy(language, 'skip'), exact: true }).click()
  const ledger = page.getByTestId('common-decisions')
  await ledger.getByRole('group', { name: copy(language, 'kinds') }).getByRole('button', { name: new RegExp('^' + copy(language, 'sell')) }).click()
  const row = ledger.locator('.cbt-decision-row:visible>button').first()
  const result = await row.locator('span').last().textContent()
  expect(result).toMatch(/%/)
  for (const width of [1440, 1100, 1024, 900, 769, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await row.scrollIntoViewIfNeeded()
    const geometry = await row.evaluate(element => {
      const parent = element.getBoundingClientRect()
      const children = [...element.children].filter(node => getComputedStyle(node).display !== 'none').map(node => node.getBoundingClientRect())
      const overlap = children.some((a, i) => children.slice(i + 1).some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1))
      return { overlap, contained: children.every(r => r.left >= parent.left && r.right <= parent.right + 1), height: parent.height, wide: element.closest('.cbt-decisions')!.clientWidth > 640 }
    })
    expect(geometry.overlap, `overlap at ${width}`).toBe(false)
    expect(geometry.contained, `containment at ${width}`).toBe(true)
    if (geometry.wide && width > 768) expect(geometry.height).toBe(48)
    await row.focus(); await page.keyboard.press('Enter')
    await expect(row).toHaveAttribute('aria-expanded', 'true')
    await expect(ledger.locator('.cbt-decision-detail:not([hidden]) p').first()).toHaveText(await row.locator('.cbt-decision-why').textContent() ?? '')
    await expect(row).toBeFocused()
    await expect(row.locator('span').last()).toHaveText(result!)
    if ([1440, 1024, 320].includes(width)) await page.screenshot({ path: info.outputPath(`decision-${language}-${width}.png`) })
    await page.keyboard.press('Enter')
  }
  await row.evaluate(element => {
    const nodes = [element, ...element.querySelectorAll<HTMLElement>('time,b,span')]
    const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize))
    nodes.forEach((node, i) => { node.style.fontSize = `${sizes[i] * 2}px` })
  })
  expect(await row.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath(`decision-${language}-320-expanded.png`) })
})
