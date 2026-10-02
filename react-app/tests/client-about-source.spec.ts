import { expect, test } from '@playwright/test'
import { existsSync } from 'node:fs'
import source from '../src/client-about-source.json' with { type: 'json' }
import { aboutLocaleCoverage, aboutText } from '../src/client-about-copy'

const languages = ['ko','en','ja','zh-CN','zh-TW','es','fr'] as const
test('소개 원본의 88문구·7언어·12로컬 자산을 누락 없이 제공한다', () => {
  expect(source.source).toBe('9fbff821df62cad11d026022fc7628c7fcebc431')
  expect(source.copy).toHaveLength(88)
  expect(new Set(source.copy).size).toBe(88)
  expect(source.assets).toHaveLength(12)
  for (const path of source.assets) expect(existsSync(`public${path}`), path).toBe(true)
  for (const language of languages) {
    expect(aboutLocaleCoverage(language), language).toBe(true)
    for (const text of source.copy) {
      const translated = aboutText(language, text)
      expect(translated.trim()).not.toBe('')
      if (language !== 'ko') expect(translated).not.toMatch(/[가-힣]/)
      else expect(translated).toBe(text)
    }
  }
})

for (const language of languages) test(`${language} 소개 구조·FAQ·앵커·이미지·도움말은 원본 동선을 유지한다`, async ({ page }, info) => {
  await page.addInitScript(language => localStorage.setItem('tethLang', language), language)
  const errors: string[] = [], writes: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', req => { if (!['GET','HEAD'].includes(req.method())) writes.push(req.url()) })
  await page.goto('/about/')
  await expect(page.locator('h1')).toHaveText(aboutText(language, source.copy[0]))
  await expect(page.locator('.ab-card')).toHaveCount(4)
  await expect(page.locator('.ab-card .pl-lb')).toHaveText(['대화','검증','연결','실행'].map(text => aboutText(language, text)))
  await expect(page.locator('#plans > article')).toHaveCount(2)
  await expect(page.locator('#plans .pl-price > span')).toHaveText(['0','280'])
  await expect(page.locator('#faq details')).toHaveCount(7)
  await page.locator('.ab-acts a[href="/about/#pricing"]').click()
  await expect(page).toHaveURL(/\/about\/#pricing$/)
  await expect(page.locator('#pricing')).toBeInViewport()
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    await expect.poll(() => page.locator('.ab-card,.pl-card,.pl-cta').evaluateAll(nodes => nodes.filter(el => el.scrollWidth > el.clientWidth + 1).length)).toBe(0)
  }
  await page.locator('#faq details').last().locator('summary').click()
  await expect(page.locator('#faq details[open]')).toHaveCount(1)
  const help = page.getByRole('button', { name: aboutText(language, '상담원에게 묻기'), exact: true })
  // Exercise the source mobile inline entry at mobile size, not after the
  // last 1440px layout probe (which previously missed a hidden modal).
  await page.setViewportSize({ width: 320, height: 900 })
  await help.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(help).toBeFocused()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
  if (language === 'ko' || language === 'fr') {
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: info.outputPath(`about-${language}-${width}.png`) })
    }
  }
  expect(errors).toEqual([]); expect(writes).toEqual([])
})

test('한국어 제목은 로컬 한글 폰트로 실제 글리프를 그린다', async ({ page }) => {
  await page.goto('/about/')
  await expect(page.locator('.ab-h1')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
  const { root } = await cdp.send('DOM.getDocument')
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.ab-h1' })
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
  expect(fonts.some(font => font.isCustomFont && /Noto Sans KR/.test(font.familyName) && font.glyphCount > 0)).toBe(true)
  await cdp.detach()
})

test('긴 번역의 고정 헤더와 요금 링크는 화면 안에 남고 FAQ 초점은 보인다', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tethLang', 'fr'))
  await page.goto('/about/')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const links = page.locator('.hd a:visible')
    for (const link of await links.all()) {
      const box = (await link.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(12)
      expect(box.x + box.width).toBeLessThanOrEqual(width - 12)
      expect(await link.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    }
  }
  await page.setViewportSize({ width: 320, height: 900 })
  await page.locator('.ab-acts .ab-link').click()
  const notice = (await page.locator('.pricing-preview').boundingBox())!
  const header = (await page.locator('.hd').boundingBox())!
  expect(notice.y).toBeGreaterThanOrEqual(header.y + header.height)
  const summary = page.locator('#faq summary').first()
  await summary.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(summary).toBeFocused()
  expect(await summary.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid')
  await page.keyboard.press('Enter')
  await expect(page.locator('#faq details').first()).toHaveAttribute('open', '')
})

for (const language of ['ko', 'fr'] as const) test(`${language} 320px 확대 본문에서도 가격·CTA·FAQ 문장이 잘리지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.addInitScript(language => localStorage.setItem('tethLang', language), language)
  await page.goto('/about/')
  await page.evaluate(() => document.fonts.ready)
  await page.locator('main').evaluate(main => {
    const text = [...main.querySelectorAll<HTMLElement>('h1,h2,h3,p,a,li,summary,.pl-lb,.pl-sub,.pl-price>span,.pl-price>i,.pl-price>small,.ab-row b,.ab-row span')]
      .map(el => ({ el, size: parseFloat(getComputedStyle(el).fontSize) }))
    text.forEach(({el,size}) => { el.style.fontSize = `${size * 2}px` })
  })
  for (const el of await page.locator('main .ab-card,main .pl-card,main .pl-cta,main summary,main .ab-cta').all()) {
    const size = await el.evaluate(node => ({ className: node.className, width: node.clientWidth, contentWidth: node.scrollWidth, height: node.clientHeight, contentHeight: node.scrollHeight }))
    expect(size.contentWidth, JSON.stringify(size)).toBeLessThanOrEqual(size.width + 1)
    expect(size.contentHeight, JSON.stringify(size)).toBeLessThanOrEqual(size.height + 1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.locator('#plans .pl-card').first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`about-${language}-320-text200.png`) })
})
