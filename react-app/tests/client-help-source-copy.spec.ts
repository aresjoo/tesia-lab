import { expect, test, type Locator, type Page } from '@playwright/test'

// Independent source oracle: root index.html@9fbff821:26460, applied again
// at 26682, and final help-widget.js:11. teth-copy.js has no later override.
// Keep the current coming-soon support status: the original widget's initial
// availability claim is not evidence of an actual support producer.
const sourceBody = {
  ko: '무엇이든 물어보십시오. 상담원이 연중무휴 24시간 대기하고 있습니다.',
  en: 'Ask us anything. Our agents are available around the clock.',
  ja: '何でもお尋ねください。担当者が24時間365日対応します。',
  'zh-CN': '有任何问题都可以咨询，客服全年无休24小时在线。',
  'zh-TW': '有任何問題都可以諮詢，客服全年無休24小時在線。',
  es: 'Pregúntanos lo que sea. Nuestro equipo está disponible 24/7.',
  fr: 'Posez-nous vos questions. Notre équipe est disponible 24h/24, 7j/7.',
} as const
const supportStatus = {
  ko: '실시간 채팅은 곧 제공됩니다. support@teth.ai',
  en: 'Live chat coming soon. support@teth.ai',
  ja: 'ライブチャットは近日提供予定です。support@teth.ai',
  'zh-CN': '在线聊天即将上线。support@teth.ai',
  'zh-TW': '線上聊天即將上線。support@teth.ai',
  es: 'El chat en vivo llegará pronto. support@teth.ai',
  fr: 'Le chat en direct arrive bientôt. support@teth.ai',
} as const

async function expectReadable(page: Page, popup: Locator) {
  await page.evaluate(() => document.fonts.ready)
  expect(await popup.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const paragraphs = [...element.querySelectorAll('p')]
    return {
      inside: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
      noClipping: paragraphs.every(p => p.scrollWidth <= p.clientWidth + 1 && p.scrollHeight <= p.clientHeight + 1),
    }
  })).toEqual({ inside: true, noClipping: true })
}

for (const width of [320, 1440]) {
  test(`한국어 원문 도움말 ${width}px 홈과 설정 조합을 보존한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      localStorage.setItem('tethLang', 'ko')
      sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '도움말 검수', email: 'help-preview@example.test' }))
    })
    await page.goto('/')
    const input = page.locator('#strategy-idea')
    await input.fill('도움말을 읽은 뒤 이어갈 질문')
    const trigger = page.locator('.site-help-trigger')
    await trigger.focus()
    await page.keyboard.press('Enter')
    const floating = page.locator('.site-help-pop')
    await expect(floating.locator(':scope > p').first()).toHaveText(sourceBody.ko)
    await expect(floating.locator(':scope > p').last()).toHaveText(supportStatus.ko)
    await expectReadable(page, floating)
    await page.screenshot({ path: testInfo.outputPath(`help-source-${width}.png`) })
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    let settings = page.locator('[data-sidebar-action="account"]')
    if (width <= 860) {
      await page.locator('.client-hamburger').click()
      settings = page.locator('[data-sidebar-action="profile-settings"]')
    }
    await settings.click()
    await page.locator('.ca-settings').getByRole('button', { name: '고객지원', exact: true }).click()
    const modal = page.locator('.client-modal-help .site-help-pop')
    await expect(modal.locator(':scope > p').first()).toHaveText(sourceBody.ko)
    await expect(modal.locator(':scope > p').last()).toHaveText(supportStatus.ko)
    await expect(modal.locator('.help-close')).toBeFocused()
    await expectReadable(page, modal)
    await page.keyboard.press('Escape')
    await expect(modal).toHaveCount(0)
    await expect(width <= 860 ? page.locator('.client-hamburger') : settings).toBeFocused()
    await expect(input).toHaveValue('도움말을 읽은 뒤 이어갈 질문')
  })

  for (const language of Object.keys(sourceBody) as (keyof typeof sourceBody)[]) {
    test(`도움말 원문과 지원 상태 ${language} ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript(lang => localStorage.setItem('tethLang', lang), language)
      await page.goto('/')
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      await page.locator('.site-help-trigger').click()
      const popup = page.locator('.site-help-pop')
      await expect(popup.locator(':scope > p').first()).toHaveText(sourceBody[language])
      await expect(popup.locator(':scope > p').last()).toHaveText(supportStatus[language])
      await expectReadable(page, popup)
    })
  }
}
