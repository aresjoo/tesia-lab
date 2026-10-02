import { expect, test, type Page } from '@playwright/test'
import reference from '../src/client-reference-copy.json' with { type: 'json' }
import { composeTemplatePrompt, getTemplateText } from '../src/client-home-gallery'
import { shellText } from '../src/client-shell-copy'

async function openLocale(page: Page) {
  if (await page.locator('.client-globe').isVisible()) await page.locator('.client-globe').click()
  else {
    // Source Settings uses a native language select. Exercise the retained
    // locale sheet through its actual desktop globe, then resize the same sheet
    // to verify the mobile keyboard/IME boundary.
    const viewport = page.viewportSize()!
    await page.setViewportSize({ width: 1440, height: viewport.height })
    await page.locator('.client-globe').click()
    await page.setViewportSize(viewport)
  }
  await expect(page.locator('.client-locale-panel')).toBeVisible()
}

test('홈 템플릿·선택 칩·안내 질문은 7언어를 따르고 작성 중인 원문은 유지한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.g-tpl[data-id="auto"]').click()
  await page.locator('.g-tpl[data-id="btc"]').click()
  const input = page.locator('#strategy-idea')
  await input.fill('내 원문 ✨ keep this draft')
  for (const item of reference.GLC_LANGS) {
    const lang = item.c as keyof typeof reference.PH_ROT.list
    await openLocale(page)
    await page.locator('#locale-language').getByRole('button', { name: item.n, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', lang)
    await expect(input).toHaveValue('내 원문 ✨ keep this draft')
    await expect(page.locator('.g-tpl[data-id="auto"]')).toHaveAccessibleName(shellText(lang, 'auto'))
    await expect(page.locator('.client-template-selection .chip-label').first()).toHaveText(shellText(lang, 'auto'))
    await expect(page.locator('.client-template-selection button').first()).toHaveAccessibleName(shellText(lang, 'remove', { name: shellText(lang, 'auto') }))
    await expect(input).toHaveAttribute('placeholder', getTemplateText({ acts: ['auto'], assets: ['btc'] }, lang)!.q)
    await expect(page.locator('.g-tpl[data-id="btc"]')).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  }
})

test('언어 패널은 수정키·조합 키를 가로채지 않고 일반 탭 탐색은 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await openLocale(page)
  const search = page.locator('#locale-language input')
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'isComposing']) {
    await search.focus()
    const prevented = await search.evaluate((node, field) => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true, [field]: true })
      node.dispatchEvent(event)
      return event.defaultPrevented
    }, modifier)
    expect(prevented, modifier).toBe(false)
    await expect(search).toBeFocused()
  }
  await page.keyboard.press('ArrowRight')
  await expect(search).toBeFocused()
  await expect(page.locator('#locale-tab-currency, #locale-currency')).toHaveCount(0)
  await page.locator('.client-locale-panel').focus()
  const prevented = await page.locator('.client-locale-panel').evaluate(node => {
    const event = new KeyboardEvent('keydown', { key: 'Tab', ctrlKey: true, bubbles: true, cancelable: true })
    node.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(prevented).toBe(false)
  await page.keyboard.press('Tab')
  // The source mobile grab handle is also an accessible close button.
  await expect(page.locator('.locale-grab')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('.locale-close')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-locale-panel')).toHaveCount(0)
})

test('새 템플릿 문장만 선택 언어로 만들고 한국어 원본과 사용자 덧붙임을 보존한다', () => {
  const selection = { acts: ['auto', 'rank'], assets: ['btc', 'eth'] }
  expect(composeTemplatePrompt(selection)).toBe('BTC와 ETH 거래를 AI에게 맡기는 전략을 만들고, 인기 전략 랭킹도 보여줘')
  for (const { c } of reference.GLC_LANGS) {
    const language = c as keyof typeof reference.PH_ROT.list
    const prompt = composeTemplatePrompt(selection, '원문 <b> BTC', language)
    expect(prompt).toContain('BTC')
    expect(prompt).toContain('ETH')
    expect(prompt.endsWith('원문 <b> BTC')).toBe(true)
    expect(getTemplateText({ acts: [], assets: [] }, language)).toBeNull()
    for (const id of ['auto', 'ind', 'rank', 'anal', 'port']) {
      const text = getTemplateText({ acts: [id], assets: ['btc'] }, language)!
      expect(text.q).toContain('BTC'); expect(text.cmd).toContain('BTC')
      if (language !== 'ko') expect(text.q + text.cmd).not.toMatch(/[가-힣]|\{assets\}|undefined/)
    }
  }
})

test('인증 CTA와 게스트 하단은 원본 외형과 44px 조작 영역을 함께 유지한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (const width of [320, 390, 861, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    const login = page.locator('.client-login')
    await expect(login).toBeVisible()
    await expect(login.locator('.client-auth-pill')).toHaveCSS('height', width <= 860 ? '36px' : '30px')
    await expect(login.locator('.client-auth-pill')).toHaveCSS('background-color', 'rgb(25, 26, 29)')
    expect((await login.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    if (width > 860) {
      const signup = page.locator('.client-signup')
      await expect(signup.locator('.client-auth-pill')).toHaveCSS('height', '30px')
      await expect(signup.locator('.client-auth-pill')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
      expect((await signup.locator('.client-auth-pill').boundingBox())!.y).toBe(14)
      expect((await signup.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    await page.locator(width <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
    const account = page.locator('[data-sidebar-action="account"]')
    const settings = page.locator('[data-sidebar-action="settings"]')
    await expect(account.locator('svg')).toBeHidden()
    await expect(account.locator('span')).toHaveCSS('height', '36px')
    await expect(settings.locator('span')).toBeHidden()
    const a = (await account.boundingBox())!, b = (await settings.boundingBox())!
    const footer = (await page.locator('.client-sidebar-bottom').boundingBox())!
    expect(b.x + b.width).toBeCloseTo(footer.x + footer.width, 0)
    expect(a.x + a.width).toBeLessThanOrEqual(b.x)
    expect(a.height).toBeGreaterThanOrEqual(44); expect(b.width).toBe(44)
    await account.focus(); await page.keyboard.press('Tab'); await expect(settings).toBeFocused()
    await page.keyboard.press('Escape')
  }
})
