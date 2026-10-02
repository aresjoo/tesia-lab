import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { policyLabels } from '../src/client-policy-copy'

// Extracted from the inert source main in tesia-lab 9fbff821, not React.
const original = {
  texts: { count: 145, sha: '453714ae4b412cf1e1937c2c6cefa5ca5756f6d0f9016d159890433f69efbac5' },
  svg: { count: 12, sha: 'b38313e0d26c73826ad45dd12d7ef3a59c90336e2101f804249f9e4a0966526b' },
  links: { count: 37, sha: 'de0ba4b7d5bcecab7b199b490d04c00709a44550530cf090651cb4311b53c524' },
}
test('정책 원문145개와 SVG12개는 독립 원본 golden을 보존한다', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.goto('/policies/')
  await expect(page.locator('.pg-h1')).toHaveText('개인정보 보호와 약관')
  const result = await page.locator('#site-main').evaluate(main => {
    const content = main.cloneNode(true) as HTMLElement
    content.querySelectorAll('.prototype-notice').forEach(el => el.remove())
    const texts: string[] = []
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.replace(/\s+/g, ' ').trim()
        if (text) texts.push(text)
      } else node.childNodes.forEach(walk)
    }
    walk(content)
    const svg = [...content.querySelectorAll('svg')].map(root =>
      [root, ...root.querySelectorAll('*')].map(node => node.tagName + JSON.stringify(
        [...node.attributes].map(attr => [attr.name, attr.value]).sort(),
      )).join('|'),
    )
    const links = [...content.querySelectorAll('a')].map(el => ({ text: el.textContent?.replace(/\s+/g, ' ').trim(), href: el.getAttribute('href'), classes: [...el.classList].filter(c => c !== 'on').sort() }))
    return { texts, svg, links }
  })
  for (const key of ['texts', 'svg', 'links'] as const) {
    expect(result[key]).toHaveLength(original[key].count)
    expect(createHash('sha256').update(JSON.stringify(result[key])).digest('hex'), key).toBe(original[key].sha)
  }
  await expect(page.locator('.hero-ill,.ptitle,.hd .tabs')).toHaveCount(0)
  await expect(page.locator('.ov .cell')).toHaveCount(6)
  await expect(page.locator('#v-privacy .sum-row')).toHaveCount(4)
  await expect(page.locator('#v-terms .sum-row')).toHaveCount(3)
})

for (const width of [320, 768, 1440]) test(`정책 ${width}px: 원본 격자와5탭·도움말`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const errors: string[] = [], writes: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', req => { if (req.method() === 'POST') writes.push(req.url()) })
  await page.goto('/policies/')
  await expect(page.locator('.pg-h1')).toBeVisible()
  for (const tab of ['overview', 'privacy', 'terms', 'technologies', 'faq']) {
    await page.locator(`.tabs a[data-v="${tab}"]`).click()
    await expect(page.locator('.view.on')).toHaveAttribute('id', 'v-' + tab)
    await expect(page.locator('#site-main')).toBeFocused()
    await expect(page.locator('.view.on')).toHaveAttribute('lang', 'ko')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    if (tab === 'overview') {
      const boxes = await page.locator('.ov .cell').evaluateAll(nodes => nodes.map(n => ({ x: n.getBoundingClientRect().x, y: n.getBoundingClientRect().y })))
      if (width > 960) { expect(boxes[0].y).toBe(boxes[1].y); expect(boxes[1].x).toBeGreaterThan(boxes[0].x) }
      else expect(boxes[0].x).toBe(boxes[1].x)
    }
    if (tab === 'overview' || tab === 'privacy') {
      await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))) })
      await page.screenshot({ path: info.outputPath(`policy-${width}-${tab}.png`), fullPage: tab === 'overview' })
    }
  }
  if (width <= 760) await expect(page.locator('.site-help-trigger')).not.toBeVisible()
  const inline = page.locator('.sub-help button')
  await inline.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.client-modal-help .help-close')).toBeFocused()
  await expect(page.locator('.client-modal-help .site-help-pop')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(inline).toBeFocused()
  expect(errors).toEqual([])
  expect(writes).toEqual([])
})

test('정책 모든20조항 deep-link가 새로고침·목차와 일치한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/policies/#privacy')
  await expect(page.locator('.toc a')).toHaveCount(20)
  const links = await page.locator('.toc a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')!))
  expect(links).toHaveLength(20)
  for (const link of links) {
    await page.goto(link)
    const id = link.split('#')[1]
    await expect(page.locator('#' + id)).toBeInViewport()
    await expect(page.locator(`.view.on .toc a[data-t="${id}"]`)).toHaveAttribute('aria-current', 'location')
    expect(await page.locator('#' + id).evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(74)
  }
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) test(`정책 ${language}: 320px 두배글자 탭과 CTA는 잘리지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.addInitScript(lang => localStorage.setItem('tethLang', lang), language)
  await page.goto('/policies/#privacy')
  const labels = policyLabels(language)
  await expect(page.locator('.pg-h1')).toHaveText(labels.title)
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>('.client-info-policies .hd *, .client-info-policies main *')]
    const sizes = nodes.map(el => parseFloat(getComputedStyle(el).fontSize))
    nodes.forEach((el, i) => { el.style.fontSize = `${sizes[i] * 2}px` })
  })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  const headerBottom = await page.locator('.hd').evaluate(el => el.getBoundingClientRect().bottom)
  expect(await page.locator('.pg-top').evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(headerBottom)
  const bounds = await page.locator('.hd .cta,.tabs a').evaluateAll(nodes => nodes.map(el => ({ width: el.clientWidth, scroll: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight, x: el.getBoundingClientRect().x, right: el.getBoundingClientRect().right })))
  for (const box of bounds) { expect(box.scroll).toBeLessThanOrEqual(box.width + 1); expect(box.scrollHeight).toBeLessThanOrEqual(box.height + 1); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(320) }
  await page.locator('.tabs a').first().focus()
  await page.keyboard.press('Tab')
  await expect(page.locator('.tabs a[data-v="privacy"]')).toBeFocused()
  expect(await page.locator('.tabs a[data-v="privacy"]').evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
  await page.screenshot({ path: info.outputPath(`policy-${language}-200.png`) })
})
