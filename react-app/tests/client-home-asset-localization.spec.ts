import { expect, test } from '@playwright/test'

// Independent company-name oracle; never derive expectations from the UI dictionary.
const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const names = {
  sec: ['삼성전자', 'Samsung Electronics', 'サムスン電子', '三星电子', '三星電子', 'Samsung Electronics', 'Samsung Electronics'],
  hyx: ['SK하이닉스', 'SK hynix', 'SKハイニックス', 'SK海力士', 'SK海力士', 'SK hynix', 'SK hynix'],
  ma: ['마스터카드', 'Mastercard', 'マスターカード', '万事达卡', '萬事達卡', 'Mastercard', 'Mastercard'],
  aramco: ['아람코', 'Aramco', 'アラムコ', '阿美石油公司', '沙烏地阿美', 'Aramco', 'Aramco'],
  hd: ['홈디포', 'The Home Depot', 'ホーム・デポ', '家得宝', '家得寶', 'The Home Depot', 'The Home Depot'],
  cola: ['코카콜라', 'The Coca-Cola Company', 'コカ・コーラ', '可口可乐', '可口可樂', 'Coca-Cola', 'Coca-Cola'],
  tm: ['토요타', 'Toyota Motor', 'トヨタ自動車', '丰田汽车', '豐田汽車', 'Toyota Motor', 'Toyota Motor'],
  tcehy: ['텐센트', 'Tencent', 'テンセント', '腾讯', '騰訊', 'Tencent', 'Tencent'],
  baba: ['알리바바', 'Alibaba Group', 'アリババ・グループ', '阿里巴巴', '阿里巴巴', 'Alibaba Group', 'Alibaba Group'],
  hmc: ['현대차', 'Hyundai Motor Company', '現代自動車', '现代汽车', '現代汽車', 'Hyundai Motor Company', 'Hyundai Motor Company'],
  kko: ['카카오', 'Kakao', 'カカオ', 'Kakao', 'Kakao', 'Kakao', 'Kakao'],
} as const

test('home asset localization: English fixed company card has its own translated label', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tethLang', 'en'))
  await page.goto('/')
  const card = page.locator('.client-home-gallery button[data-k="assets"][data-id="sec"]')
  await expect(card).toHaveAccessibleName('Samsung Electronics')
  await expect(card.locator('.lb')).toHaveText('Samsung Electronics')
})

test('home asset localization: retained Main selection, names and aria switch in all seven locales', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const gallery = page.locator('.client-home-gallery')
  await expect(gallery.locator('.g-tpl')).toHaveCount(55)
  const selected = gallery.locator('button[data-k="assets"][data-id="sec"]')
  const originalImages = await gallery.locator('button[data-k="assets"] img').evaluateAll(images => images.map(image => image.getAttribute('src')))
  const originalArt = await gallery.locator('button[data-k="acts"] svg').evaluateAll(svg => svg.map(image => image.outerHTML))
  await selected.click()
  const input = page.locator('#strategy-idea')
  const userDraft = '삼성전자 사용자 원문 / Customer text stays intact'
  await input.fill(userDraft)
  const originalNode = await input.elementHandle()
  for (const [index, language] of locales.entries()) {
    await page.evaluate(async lang => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', lang) }, language)
    for (const [id, labels] of Object.entries(names)) {
      const card = gallery.locator(`button[data-k="assets"][data-id="${id}"]`)
      await expect(card).toHaveAccessibleName(labels[index])
      await expect(card.locator('.lb')).toHaveText(labels[index])
    }
    await expect(selected).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.client-template-selection .chip-label')).toHaveText(names.sec[index])
    await expect(page.locator('.client-template-selection button')).toHaveAccessibleName(new RegExp(names.sec[index]))
    await expect(input).toHaveAttribute('placeholder', new RegExp(names.sec[index]))
    await expect(input).toHaveValue(userDraft)
    expect(await input.evaluate((node, original) => node === original, originalNode)).toBe(true)
    expect(await gallery.locator('button[data-k="assets"] img').evaluateAll(images => images.map(image => image.getAttribute('src')))).toEqual(originalImages)
    expect(await gallery.locator('button[data-k="acts"] svg').evaluateAll(svg => svg.map(image => image.outerHTML))).toEqual(originalArt)
    await expect(gallery.locator('button[data-id="btc"]')).toHaveAccessibleName('BTC')
    await expect(gallery.locator('button[data-id="nvda"]')).toHaveAccessibleName('NVDA')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  }
  await page.screenshot({ path: info.outputPath('home-assets-seven-locales.png') })
  expect(errors).toEqual([])
})

test('home asset localization: unknown or customer labels stay exact and only new template text is localized', async ({ page }) => {
  await page.goto('/')
  const values = await page.evaluate(async () => {
    const shellPath = '/src/client-shell-copy.ts', galleryPath = '/src/client-home-gallery.ts'
    const { homeTemplateLabel } = await import(shellPath)
    const { getTemplateText, composeTemplatePrompt, CLIENT_HOME_ASSETS } = await import(galleryPath)
    return {
      unknown: homeTemplateLabel('ja', 'customer-asset', '사용자 자유 종목'),
      sameIdCustomer: homeTemplateLabel('en', 'sec', '고객이 작성한 삼성전자'),
      sourceName: CLIENT_HOME_ASSETS.find((item: { id: string }) => item.id === 'sec').lb,
      korean: getTemplateText({ acts: ['anal'], assets: ['sec'] }, 'ko'),
      english: getTemplateText({ acts: ['anal'], assets: ['sec'] }, 'en'),
      request: composeTemplatePrompt({ acts: ['anal'], assets: ['sec'] }, '고객 원문 삼성전자', 'en'),
    }
  })
  expect(values.unknown).toBe('사용자 자유 종목')
  expect(values.sameIdCustomer).toBe('고객이 작성한 삼성전자')
  expect(values.sourceName).toBe('삼성전자')
  expect(values.korean).toEqual({ q: '삼성전자를 어떻게 분석해 드리면 되겠습니까?', cmd: '삼성전자 시장 상태를 분석해줘' })
  expect(values.english.q).toContain('Samsung Electronics')
  expect(values.english.cmd).toContain('Samsung Electronics')
  expect(values.request).toMatch(/Samsung Electronics.*\. 고객 원문 삼성전자$/)
})
