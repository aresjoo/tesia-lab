import { expect, test, type Page } from '@playwright/test'

async function openSidebar(page: Page) {
  await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  await page.evaluate(() => document.fonts.ready)
}

test('안내 SVG와 첫 줄은 정렬되고 문장 안 로그인은 줄 높이를 늘리지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (const width of [320, 390, 768, 860, 861, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await openSidebar(page)
    const metrics = await page.locator('.client-guest-note').evaluate(el => {
      const span = el.querySelector('span')!
      const icon = el.querySelector('svg')!.getBoundingClientRect()
      const button = el.querySelector('button')!.getBoundingClientRect()
      const line = parseFloat(getComputedStyle(span).lineHeight)
      return { offset: Math.abs(icon.y + icon.height / 2 - span.getBoundingClientRect().y - line / 2), buttonHeight: button.height, line, height: span.getBoundingClientRect().height }
    })
    expect(metrics.offset).toBeLessThanOrEqual(1)
    // The source dotted underline uses a 1.5px border and 1px bottom inset.
    expect(metrics.buttonHeight).toBeLessThanOrEqual(metrics.line + 2.5)
    expect(metrics.height).toBeLessThanOrEqual(metrics.line * 3 + 1)
    await page.keyboard.press('Escape')
  }
})

test('일곱 언어에서도 로그인 링크는 문장과 같은 기준선·본문 흐름을 유지한다', async ({ page }) => {
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.goto('/')
    await page.evaluate(lang => localStorage.setItem('tethLang', lang), language)
    await page.reload()
    await openSidebar(page)
    const note = page.locator('.client-guest-note')
    const metrics = await note.evaluate(el => {
      const button = el.querySelector('button')!
      const span = el.querySelector('span')!
      return { display: getComputedStyle(button).display, line: parseFloat(getComputedStyle(span).lineHeight), buttonHeight: button.getBoundingClientRect().height, overflow: el.scrollWidth > el.clientWidth }
    })
    // Native buttons compute inline as inline-block in Chromium.
    expect(['inline', 'inline-block']).toContain(metrics.display)
    expect(metrics.buttonHeight).toBeLessThanOrEqual(metrics.line + 2.5)
    expect(metrics.overflow).toBe(false)
    await note.getByRole('button').click()
    await expect(page.locator('.ca-auth-veil')).toBeVisible()
  }
})

test('접힌 레일의 위·아래 아이콘과 클릭 영역 중심축은 같다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const centers = await page.locator('.client-rail-logo-row button, .client-rail-new-row button, .client-sidebar-bottom > button').evaluateAll(els => els.map(el => {
    const box = el.getBoundingClientRect()
    return { x: box.x + box.width / 2, width: box.width, height: box.height }
  }))
  expect(Math.max(...centers.map(c => c.x)) - Math.min(...centers.map(c => c.x))).toBeLessThanOrEqual(.5)
  for (const box of centers) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44) }
})

test('긴 계정 이름은 인접 설정 버튼을 밀거나 사이드바 밖으로 넘치지 않는다', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '장기투자연구사용자아주긴프로필이름', email: 'review@example.test' })))
  await page.goto('/')
  await openSidebar(page)
  const result = await page.locator('.client-sidebar-bottom').evaluate(el => {
    const buttons = [...el.querySelectorAll('button')]
    const parent = el.getBoundingClientRect()
    return { overflow: el.scrollWidth > el.clientWidth, boxes: buttons.map(b => ({ right: b.getBoundingClientRect().right, width: b.getBoundingClientRect().width })), right: parent.right, ellipsis: getComputedStyle(el.querySelector('[aria-label="내 계정"] span')!).textOverflow }
  })
  expect(result.overflow).toBe(false)
  expect(result.ellipsis).toBe('ellipsis')
  for (const box of result.boxes) { expect(box.right).toBeLessThanOrEqual(result.right + 1); expect(box.width).toBeGreaterThanOrEqual(44) }
})

test('모바일 서비스 메뉴는 하단에 놓이고 짧은 화면에서는 스크롤로 접근한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await openSidebar(page)
  const footer = page.locator('.client-sidebar-bottom')
  const box = await footer.boundingBox()
  expect(844 - box!.y - box!.height).toBeLessThanOrEqual(10)
  await page.setViewportSize({ width: 390, height: 280 })
  const login = footer.getByRole('button', { name: '사이드바 로그인' })
  await login.focus()
  const target = await login.boundingBox()
  expect(target!.y).toBeGreaterThanOrEqual(0)
  expect(target!.y + target!.height).toBeLessThanOrEqual(280)
  await login.press('Enter')
  await expect(page.locator('.ca-auth-veil')).toBeVisible()
})

for (const signedIn of [false, true]) {
  test(`펼친 사이드바는 계정 왼쪽·설정 오른쪽이며 DOM과 Tab 순서도 같다 (${signedIn ? '회원' : '비회원'})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    if (signedIn) await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 계정', email: 'review@example.test' })))
    await page.goto('/')
    const footer = page.locator('.client-sidebar-bottom')
    const accountName = signedIn ? '내 계정' : '사이드바 로그인'
    for (const width of [320, 390, 768, 861, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      if (width > 860) {
        await expect(footer.locator('button').first()).toHaveAttribute('aria-label', '설정')
        await expect(footer.locator('button').last()).toHaveAttribute('aria-label', accountName)
      }
      await openSidebar(page)
      const account = footer.getByRole('button', { name: accountName, exact: true })
      const settings = footer.getByRole('button', { name: '설정', exact: true })
      await expect(footer.locator('button').first()).toHaveAttribute('aria-label', accountName)
      const a = (await account.boundingBox())!, b = (await settings.boundingBox())!
      expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1)
      expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1)
      await account.focus()
      await account.press('Tab')
      await expect(settings).toBeFocused()
      await settings.press('Shift+Tab')
      await expect(account).toBeFocused()
      await account.press('Enter')
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await openSidebar(page)
      await settings.click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
    }
  })
}
