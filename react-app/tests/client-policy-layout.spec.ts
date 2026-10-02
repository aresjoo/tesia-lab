import { expect, test } from '@playwright/test'

for (const width of [1024, 1440]) for (const language of ['ko', 'fr']) test(`정책 ${width}px ${language}: 확대 탭과 낮은 화면 목차`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 650 })
  await page.addInitScript(lang => localStorage.setItem('tethLang', lang), language)
  await page.goto('/policies/#privacy')
  await expect(page.locator('#site-main')).toBeFocused()
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>('.pg-top *, .toc a')]
    const sizes = nodes.map(el => parseFloat(getComputedStyle(el).fontSize))
    nodes.forEach((el, i) => { el.style.fontSize = `${sizes[i] * 2}px` })
  })
  const boxes = await page.locator('.tabs a').evaluateAll(nodes => nodes.map(el => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height, width: el.clientWidth, scroll: el.scrollWidth }
  }))
  for (const box of boxes) { expect(box.x).toBeGreaterThan(0); expect(box.right).toBeLessThan(width); expect(box.scroll).toBeLessThanOrEqual(box.width + 1); expect(box.height).toBeGreaterThanOrEqual(44) }
  for (let i = 1; i < boxes.length; i++) {
    if (boxes[i].y === boxes[i - 1].y) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].right)
    else expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].bottom)
  }
  await page.locator('.tabs a').first().focus()
  await page.keyboard.press('Tab')
  await expect(page.locator('.tabs a[data-v="privacy"]')).toBeFocused()
  await page.screenshot({ path: info.outputPath(`policy-${width}-${language}-tabs.png`) })
  await page.locator('#p-collect').scrollIntoViewIfNeeded()
  const last = page.locator('#v-privacy .toc a').last()
  await last.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(last).toBeFocused()
  const position = await last.evaluate(el => {
    const r = el.getBoundingClientRect(), toc = el.closest('.toc')!.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, tocTop: toc.top, tocBottom: toc.bottom }
  })
  expect(position.top).toBeGreaterThanOrEqual(position.tocTop - 1)
  expect(position.bottom).toBeLessThanOrEqual(position.tocBottom + 1)
  expect(position.bottom).toBeLessThanOrEqual(650)
})
