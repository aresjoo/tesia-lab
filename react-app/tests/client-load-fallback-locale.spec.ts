import { expect, test, type Page } from '@playwright/test'
import reference from '../src/client-reference-copy.json' with { type: 'json' }
import { revealSourceNavigation } from './fixtures/source-offline-research-entry'

const labels = {
  ko: ['페이지를 불러오는 중입니다', '페이지를 불러오지 못했습니다', '대화로 돌아가기', '페이지 새로고침', '연결 상태를 확인하거나 대화로 돌아가세요.'],
  en: ['Loading the page', 'Could not load the page', 'Back to conversation', 'Reload page', 'Check your connection or return to the conversation.'],
  ja: ['ページを読み込んでいます', 'ページを読み込めませんでした', '会話に戻る', 'ページを再読み込み', '接続状況を確認するか、会話に戻ってください。'],
  'zh-CN': ['正在加载页面', '无法加载页面', '返回对话', '重新加载页面', '请检查网络连接或返回对话。'],
  'zh-TW': ['正在載入頁面', '無法載入頁面', '返回對話', '重新載入頁面', '請檢查網路連線或返回對話。'],
  es: ['Cargando la página', 'No se pudo cargar la página', 'Volver a la conversación', 'Recargar página', 'Comprueba tu conexión o vuelve a la conversación.'],
  fr: ['Chargement de la page', 'Impossible de charger la page', 'Retour à la conversation', 'Actualiser la page', 'Vérifiez votre connexion ou revenez à la conversation.'],
} as const
type Language = keyof typeof labels

async function changeLanguage(page: Page, language: Language) {
  await page.evaluate(async language => {
    const { setClientPreference } = await import('/src/client-preferences.ts')
    setClientPreference('language', language)
  }, language)
}

for (const language of Object.keys(labels) as Language[]) for (const failed of [false, true]) {
  test(`public optional chunk ${language} ${failed ? 'failure' : 'loading'} preserves language and return`, async ({ page }) => {
    await page.addInitScript(language => localStorage.setItem('tethLang', language), language)
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route('**/src/components/ClientPublicPages.tsx*', async route => {
      if (failed) await route.abort('failed')
      else { await gate; await route.continue() }
    })
    try {
      await page.goto('/download/')
      const panel = page.locator(failed ? '.site-page-recovery' : '.site-page-loading')
      await expect(panel).toBeVisible()
      // Read the actual DOM first: a baseline mismatch must not consume the
      // default ten-second auto-retry for every unsupported translation.
      expect(await panel.locator('h2').textContent()).toBe(labels[language][failed ? 1 : 0])
      await expect(panel).toHaveAccessibleName(labels[language][failed ? 1 : 0])
      await expect(panel).toBeFocused()
      await expect(panel.getByRole('link')).toHaveText(labels[language][2])
      await expect(panel.getByRole('button')).toHaveCount(failed ? 1 : 0)
      if (failed) {
        await expect(panel.getByRole('button')).toHaveText(labels[language][3])
        await expect(panel.locator('p')).toHaveText(labels[language][4])
      }
      const original = await panel.elementHandle()
      await panel.getByRole('link').focus()
      const next = language === 'fr' ? 'en' : 'fr'
      await changeLanguage(page, next)
      await expect(panel.locator('h2')).toHaveText(labels[next][failed ? 1 : 0])
      expect(await panel.evaluate((node, original) => node === original, original)).toBe(true)
      await expect(panel.getByRole('link')).toBeFocused()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      await panel.getByRole('link').press('Enter')
      await expect(page.locator('.client-home-content textarea')).toBeEditable()
      release()
      await expect(page.locator('.client-load-panel')).toHaveCount(0)
    } finally { release() }
  })
}

for (const language of ['ko', 'en', 'fr'] as const) for (const failed of [false, true]) {
  test(`help optional chunk ${language} ${failed ? 'failure' : 'loading'} retains input, focus and live locale`, async ({ page }) => {
    await page.addInitScript(language => {
      localStorage.setItem('tethLang', language)
      sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'Locale fixture', email: 'locale@example.test' }))
    }, language)
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route('**/src/components/ClientHelp.tsx*', async route => {
      if (failed) await route.abort('failed')
      else { await gate; await route.continue() }
    })
    try {
      await page.goto('/')
      const input = page.locator('.client-home-content textarea')
      await input.fill('Keep this draft while optional help loads.')
      const inputNode = await input.elementHandle()
      const mobile = (page.viewportSize()?.width ?? 0) <= 860
      if (mobile) await revealSourceNavigation(page)
      await page.locator(mobile ? '.client-hamburger' : '.client-rail-logo-row button').click()
      const settings = page.locator('[data-sidebar-action="profile-settings"]')
      await settings.click()
      await page.locator('.ca-settings').getByRole('button', { name: reference.I18N['help.title'][language].replace('24/7 ', ''), exact: true }).click()
      const panel = page.locator(failed ? '.site-page-recovery' : '.site-page-loading')
      await expect(panel).toBeVisible()
      expect(await panel.locator('h2').textContent()).toBe(labels[language][failed ? 1 : 0])
      await expect(panel).toHaveAccessibleName(labels[language][failed ? 1 : 0])
      await expect(panel).toBeFocused()
      await page.keyboard.press('Tab')
      const back = panel.getByRole('button', { name: labels[language][2], exact: true })
      await expect(back).toBeFocused()
      const next = language === 'fr' ? 'en' : 'fr'
      await changeLanguage(page, next)
      await expect(panel.locator('h2')).toHaveText(labels[next][failed ? 1 : 0])
      await expect(panel.getByRole('button', { name: labels[next][2], exact: true })).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(panel).toHaveCount(0)
      await expect(input).toHaveValue('Keep this draft while optional help loads.')
      expect(await input.evaluate((node, original) => node === original, inputNode)).toBe(true)
      await expect(input).toBeEditable()
      await expect(mobile ? page.locator('.client-hamburger') : settings).toBeFocused()
      expect(await page.evaluate(() => document.getElementById('root')?.inert)).toBe(false)
      release()
      await expect(page.locator('.client-load-panel')).toHaveCount(0)
    } finally { release() }
  })
}
