import { expect, test } from '@playwright/test'
import { CLIENT_HOME_ACTIONS, CLIENT_HOME_HEADLINES, getTemplateText } from '../src/client-home-gallery'
import { aboutText } from '../src/client-about-copy'
import { policyLabels } from '../src/client-policy-copy'
test.setTimeout(40_000)

// Authored source: tesia-lab 9fbff821 about/index.html:313-317,346-352;
// policies/index.html:131-139,259+. The source has no added preview banners.
// c99c938 restored that structure; these public-page tests verify its copy and
// layout, not actual billing/provider availability or translated legal approval.
const removedNotices = '.prototype-notice,.pricing-preview,.faq-preview'
const heroTitle = '거래하는 사람을 위한 AI 트레이딩'
const heroDescription = '말로 전략을 만들고, 실제 시장 데이터로 검증하고, 지금 쓰는 거래소 계정에서 실행합니다.'
const heroFree = '영원히 무료, 카드 등록 없음'
const faqQuestions = [
  'TETH는 어떤 서비스입니까?', '전략은 어떻게 실행합니까?', '어떤 거래소를 연결합니까?',
  '백테스트 결과는 어디서 확인합니까?', '연결 권한은 무엇입니까?', '무료로 쓸 수 있습니까?', '모바일 앱이 있습니까?',
]
const faqFirstAnswer = '말로 투자 전략을 만들고, 실제 시장 데이터로 검증하고, 연결한 거래소에서 실행하는 AI 트레이딩 서비스입니다.'

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

test('about pricing follows the latest common source value without added notices', async ({ page }) => {
  await page.goto('/about/')
  await expect(page.locator('#plans .pl-price > span')).toHaveText(['0', '280'])
  await expect(page.locator('#plans .pl-hi .pl-lb')).toHaveText('TETH 초대 계정')
  await expect(page.locator(removedNotices)).toHaveCount(0)
  await expect(page.locator('#pricing > .ab-sh')).toHaveText('이용 방법을 선택합니다')
})

test('authored public hero, plans and FAQ follow the selected language', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tethLang', 'en'))
  await page.goto('/about/')
  await expect(page.locator(removedNotices)).toHaveCount(0)
  for (const [selector, source] of [
    ['.ab-hero .ab-h1', heroTitle], ['.ab-hero .ab-d', heroDescription],
    ['.ab-hero .ab-free', heroFree], ['#pricing > .ab-sh', '이용 방법을 선택합니다'],
    ['#plans .pl-hi .pl-lb', 'TETH 초대 계정'], ['#faq details:first-child summary', faqQuestions[0]],
  ]) {
    await expect(page.locator(selector)).toHaveText(aboutText('en', source))
    await expect(page.locator(selector)).not.toContainText(/[가-힣]/)
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

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) for (const width of [320, 768, 1440]) test(`${language} public source ${width}px preserves authored copy, source plans and readable layout`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 900 })
  await page.addInitScript(language => localStorage.setItem('tethLang', language), language)
  const errors: string[] = [], writes: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.method()) })
  await page.goto('/about/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator(removedNotices)).toHaveCount(0)
  const hero = page.locator('.ab-hero')
  await expect(hero.locator('.ab-h1')).toHaveText(aboutText(language, heroTitle))
  await expect(hero.locator('.ab-d')).toHaveText(aboutText(language, heroDescription))
  await expect(hero.locator('.ab-free')).toHaveText(aboutText(language, heroFree))
  await expect(hero.locator('.ab-cta')).toHaveText(aboutText(language, '무료로 시작하기'))
  await expect(hero.locator('.ab-cta')).toHaveAttribute('href', '/')
  await expect(hero.locator('.ab-link')).toHaveAttribute('href', '/about/#pricing')
  await expect(hero.locator('.ab-heroshot img')).toHaveAttribute('alt', aboutText(language, 'TETH 터미널, 차트와 판단 패널'))
  await expect(hero.locator('.ab-heroshot img')).toHaveAttribute('src', '/client-shots/about/about-live.webp')
  const acts = (await hero.locator('.ab-acts').boundingBox())!, free = (await hero.locator('.ab-free').boundingBox())!, shot = (await hero.locator('.ab-heroshot').boundingBox())!
  // Exact authored margins: source about/index.html:226-227. The former
  // added-notice gap is replaced with the actual CTA/free-copy/image sequence.
  expect(free.y - (acts.y + acts.height)).toBeCloseTo(14, 1)
  expect(shot.y - (free.y + free.height)).toBeCloseTo(48, 1)
  await expect(page.locator('#pricing > .ab-sh')).toHaveText(aboutText(language, '이용 방법을 선택합니다'))
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
  const faq = page.locator('#faq')
  await expect(faq.locator('details')).toHaveCount(7)
  await expect(faq.locator('summary')).toHaveText(faqQuestions.map(text => aboutText(language, text)))
  await faq.locator('summary').first().click()
  await expect(faq.locator('details').first()).toHaveAttribute('open', '')
  await expect(faq.locator('details').first().locator('p')).toBeVisible()
  await expect(faq.locator('details').first().locator('p')).toHaveText(aboutText(language, faqFirstAnswer))
  await page.goto('/policies/#terms')
  await expect(page.locator(removedNotices)).toHaveCount(0)
  await expect(page.locator('.pg-h1')).toHaveText(policyLabels(language).title)
  await expect(page.locator('#tabs [data-v=terms]')).toHaveText(policyLabels(language).terms)
  await expect(page.locator('#tabs [data-v=terms]')).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('#v-terms')).toBeVisible()
  await expect(page.locator('#v-terms')).toHaveAttribute('lang', 'ko')
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
