import { expect, test } from '@playwright/test'
import { CLIENT_HOME_ACTIONS, CLIENT_HOME_HEADLINES, getTemplateText } from '../src/client-home-gallery'
import { publicPreviewText } from '../src/client-public-preview-copy'
import { aboutText } from '../src/client-about-copy'
test.setTimeout(40_000)

test('all five latest source action prompts and composed questions retain the original wording', () => {
  expect(CLIENT_HOME_HEADLINES.ko).toContain('차트 대신\n말로 하십시오')
  expect(CLIENT_HOME_ACTIONS.map(action => action.q0)).toEqual([
    'AI가 어떤 종목을 대신 거래해 드리면 되겠습니까?', '어떤 종목에 쓸 지표를 만들어 보겠습니까?',
    '어떤 종목의 전략 랭킹이 궁금하십니까?', '어떤 시장이나 종목을 분석해 드리면 되겠습니까?', '포트폴리오를 어떻게 나눠 보겠습니까?',
  ])
  expect(getTemplateText({ acts: [], assets: ['btc'] })?.q).toBe('BTC에 대해 무엇이 궁금하십니까?')
  expect(getTemplateText({ acts: [], assets: ['btc', 'eth'] })?.q).toBe('BTC와 ETH, 무엇이 궁금하십니까?')
  expect(getTemplateText({ acts: ['auto', 'anal'], assets: ['btc'] })?.q).toBe('BTC로 AI가 대신 거래, 시장/종목 분석까지 한 번에 해드리면 되겠습니까?')
  expect(getTemplateText({ acts: ['auto', 'anal'], assets: [] })?.q).toBe('AI가 대신 거래, 시장/종목 분석, 어떤 종목으로 해보겠습니까?')
})

test('latest home removes retired promotional badges and retains formal source prompts', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.client-home-gallery .tbdg')).toHaveCount(0)
  await expect(page.locator('.client-hero-subtitle')).toContainText('템플릿을 사용해 보거나 채팅으로 투자를 설명하십시오.')
  await page.locator('.client-home-gallery [data-id=auto]').click()
  await expect(page.locator('.client-home-band textarea')).toHaveAttribute('placeholder', 'AI가 어떤 종목을 대신 거래해 드리면 되겠습니까?')
})

test('about pricing follows the latest common source preview value', async ({ page }) => {
  await page.goto('/about/')
  await expect(page.locator('#plans .pl-price > span')).toHaveText(['0', '280'])
  await expect(page.locator('#plans .pl-hi .pl-lb')).toHaveText('TETH 초대 계정')
  await expect(page.locator('.pricing-preview')).toContainText('디자인 예시')
})

test('public preview notices follow the selected language', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tethLang', 'en'))
  await page.goto('/about/')
  for (const selector of ['.prototype-notice', '.pricing-preview', '.faq-preview']) {
    await expect(page.locator(selector)).not.toContainText(/[가-힣]/)
    await expect(page.locator(selector)).toContainText(/preview|Mock|copy/i)
  }
})

test('source plan label cannot overlap its heading on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'fr'))
  await page.goto('/about/')
  const plan = page.locator('#plans .pl-hi')
  await plan.scrollIntoViewIfNeeded()
  const overlap = await plan.evaluate(el => {
    const title = el.querySelector('h3')!.getBoundingClientRect(), badge = el.querySelector('.pl-lb')!.getBoundingClientRect()
    return Math.min(title.right, badge.right) > Math.max(title.left, badge.left) && Math.min(title.bottom, badge.bottom) > Math.max(title.top, badge.top)
  })
  expect(overlap).toBe(false)
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) for (const width of [320, 768, 1440]) test(`${language} public source ${width}px preserves preview facts, source plans and readable notices`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 900 })
  await page.addInitScript(language => localStorage.setItem('tethLang', language), language)
  const errors: string[] = [], writes: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.method()) })
  await page.goto('/about/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.prototype-notice')).toHaveText(publicPreviewText(language, 'preview'))
  await expect(page.locator('.pricing-preview')).toHaveText(publicPreviewText(language, 'pricing'))
  await expect(page.locator('.faq-preview')).toHaveText(publicPreviewText(language, 'faq'))
  const hero = page.locator('.ab-hero'), cta = (await hero.locator('.ab-cta').boundingBox())!, notes = (await hero.locator('.prototype-notice').boundingBox())!
  expect(notes.y).toBeGreaterThanOrEqual(cta.y + cta.height + 16)
  const plans = page.locator('.plans')
  await expect(plans.locator('.pl-price > span')).toHaveText(['0', '280'])
  await expect(plans.locator('.pl-price').first()).toContainText(aboutText(language, '/ 월'))
  await expect(plans).not.toContainText(/599[,. ]?000|KRW/)
  await expect(plans.locator('.pl-lb')).toHaveText(['TETH 초대 계정', 'TETH 구독'].map(text => aboutText(language, text)))
  for (const node of await plans.locator('.pl-top,.pl-price,.pl-d,.pl-cta').all()) expect(await node.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  for (const link of await plans.locator('.pl-cta').all()) await expect(link).toHaveAttribute('href', '/')
  if (width === 1440) {
    const buttons = await plans.locator('.pl-cta').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().bottom))
    expect(buttons[0]).toBeCloseTo(buttons[1], 1)
    const commonRows = await plans.locator('.pl-items').evaluateAll(lists => lists.map(list => [...list.children].slice(0, 2).map(li => li.querySelector('span')!.getBoundingClientRect().top)))
    expect(commonRows[0]).toHaveLength(2)
    for (let row = 0; row < 2; row++) expect(commonRows[0][row]).toBeCloseTo(commonRows[1][row], 1)
  }
  await plans.scrollIntoViewIfNeeded()
  if (['ko', 'fr'].includes(language) && width !== 768) {
    // A tall element crop includes fixed overlays outside the viewport. Inspect
    // the real viewport too, without hiding navigation or changing its styles.
    await plans.screenshot({ path: info.outputPath(`pricing-${language}-${width}.png`) })
    await plans.locator('.pl-card').last().scrollIntoViewIfNeeded()
    // Wait for the new scroll position to paint, not just for layout to settle.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await page.screenshot({ path: info.outputPath(`pricing-viewport-${language}-${width}.png`) })
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.goto('/policies/#terms')
  await expect(page.locator('.prototype-notice')).toHaveText(publicPreviewText(language, 'policy'))
  await expect(page.locator('#v-terms')).toContainText('TETH')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(writes).toEqual([]); expect(errors).toEqual([])
})

for (const route of ['about', 'download', 'policies']) for (const reducedMotion of ['reduce', 'no-preference'] as const) test(`${route} ${reducedMotion}: unfocused skip link stays outside the viewport and returns to content`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.emulateMedia({ reducedMotion })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'fr'))
  await page.goto(`/${route}/`)
  const skip = page.locator('.site-skip')
  await expect(page.locator('#site-main')).toBeFocused()
  const hiddenAboveViewport = () => skip.evaluate(el => el.getBoundingClientRect().bottom <= 0)
  expect(await hiddenAboveViewport()).toBe(true)
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight / 2, behavior: 'instant' }))
  expect(await hiddenAboveViewport()).toBe(true)
  await page.screenshot({ path: info.outputPath(`${route}-scrolled-viewport.png`) })
  await skip.focus()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.locator('#site-main')).toBeFocused()
  expect(await hiddenAboveViewport()).toBe(true)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('#site-main'))).toBe(true)
})
