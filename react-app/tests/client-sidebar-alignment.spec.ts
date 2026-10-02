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
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
  const centers = await page.locator('.client-rail-logo-row button, .client-rail-new-row button, .client-sidebar-bottom > button').evaluateAll(els => els.map(el => {
    const box = el.getBoundingClientRect()
    return { x: box.x + box.width / 2, width: box.width, height: box.height, newRow: Boolean(el.closest('.client-rail-new-row')) }
  }))
  expect(Math.max(...centers.map(c => c.x)) - Math.min(...centers.map(c => c.x))).toBeLessThanOrEqual(.5)
  for (const box of centers) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(box.newRow && !coarse ? 40 : 44) }
})

for (const signedIn of [false, true]) test(`원본88 레일: ${signedIn ? '계정' : '게스트'} 접힘·펼침의 행 간격과 중심을 보존한다`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  if (signedIn) await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 계정', email: 'review@example.test' })))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
  const rowHeight = coarse ? 44 : 40
  const rows = () => page.locator('.client-sidebar .client-rail-new-row > button, .client-sidebar .client-new-strategy, .client-sidebar > .client-util, .client-research-navigation > nav > .client-util').filter({ visible: true })
  for (const width of [1440, 861]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(rows()).toHaveCount(signedIn ? 5 : 3)
    const collapsed = await rows().evaluateAll(els => els.map(el => {
      const box = el.getBoundingClientRect(), svg = el.querySelector('svg')!.getBoundingClientRect()
      return { y: box.y + box.height / 2, height: box.height, iconX: svg.x + svg.width / 2 }
    }))
    expect(collapsed.length).toBe(signedIn ? 5 : 3)
    expect(collapsed[0].y).toBe(10 + 46 + 6 + 2 + rowHeight / 2)
    for (let i = 0; i < collapsed.length; i++) {
      expect(collapsed[i].height).toBe(rowHeight)
      expect(collapsed[i].iconX).toBe(32)
      if (i) expect(collapsed[i].y - collapsed[i - 1].y).toBe(rowHeight + 2)
    }
    await openSidebar(page)
    const expanded = await rows().evaluateAll(els => els.map(el => {
      const box = el.getBoundingClientRect()
      return { y: box.y + box.height / 2, height: box.height }
    }))
    expect(expanded).toEqual(collapsed.map(({ y, height }) => ({ y, height })))
    await page.keyboard.press('Escape')
  }
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await openSidebar(page)
    const buttons = await rows().evaluateAll(els => els.map(el => {
      const b = el.getBoundingClientRect()
      return { y: b.y, height: b.height }
    }))
    for (let i = 1; i < buttons.length; i++) expect(buttons[i].y - buttons[i - 1].y).toBe(rowHeight + 2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`rail-${signedIn ? 'account' : 'guest'}-${width}.png`) })
    await page.keyboard.press('Escape')
  }
})

test('통합 프로필의 긴 계정 이름은 설정 아이콘을 밀거나 사이드바 밖으로 넘치지 않는다', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '장기투자연구사용자아주긴프로필이름', email: 'review@example.test' })))
  await page.goto('/')
  await openSidebar(page)
  const result = await page.locator('.client-sidebar-bottom').evaluate(el => {
    const buttons = [...el.querySelectorAll('button')]
    const parent = el.getBoundingClientRect()
    return { overflow: el.scrollWidth > el.clientWidth, boxes: buttons.map(b => ({ right: b.getBoundingClientRect().right, width: b.getBoundingClientRect().width })), right: parent.right, ellipsis: getComputedStyle(el.querySelector('.client-profile-settings span')!).textOverflow }
  })
  expect(result.overflow).toBe(false)
  expect(result.ellipsis).toBe('ellipsis')
  for (const box of result.boxes) { expect(box.right).toBeLessThanOrEqual(result.right + 1); expect(box.width).toBeGreaterThanOrEqual(44) }
})

test('낮은 접힌 계정 레일에서 모든 메뉴와 하단 버튼은 서로 가리지 않고 키보드로 접근한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 계정', email: 'review@example.test' })))
  await page.goto('/')
  for (const height of [280, 350, 480]) {
    await page.setViewportSize({ width: 1440, height })
    // Returning with a pointer changes :focus-visible modality. This case
    // explicitly tests keyboard tooltips, not programmatic pointer focus.
    await page.keyboard.press('Tab')
    const buttons = page.locator('.client-research-navigation > nav > button, .client-sidebar-bottom > button')
    await expect(buttons).toHaveCount(5)
    for (const button of await buttons.all()) {
      await button.focus()
      const hit = await button.evaluate(el => {
        const r = el.getBoundingClientRect()
        return { covered: !el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)), top: r.top, bottom: r.bottom }
      })
      expect(hit.covered, await button.getAttribute('aria-label') ?? '').toBe(false)
      expect(hit.top).toBeGreaterThanOrEqual(0)
      expect(hit.bottom).toBeLessThanOrEqual(height)
    }
    const exchange = page.locator('.client-research-navigation > nav').getByRole('button', { name: '거래소 연결', exact: true })
    await exchange.focus()
    const tooltip = exchange.locator('span')
    await expect(tooltip).toHaveCSS('opacity', '1')
    const exposed = await tooltip.evaluate(el => {
      const r = el.getBoundingClientRect()
      const previous = el.style.pointerEvents
      el.style.pointerEvents = 'auto'
      const hit = el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
      el.style.pointerEvents = previous
      return hit
    })
    // Temporary hit-testing verifies paint clipping; restore the noninteractive tooltip.
    expect(exposed).toBe(true)
    const rect = (await tooltip.boundingBox())!
    expect(rect.x).toBeGreaterThanOrEqual(48)
    expect(rect.y).toBeGreaterThanOrEqual(0)
    expect(rect.y + rect.height).toBeLessThanOrEqual(height)
    await page.locator('.client-sidebar-bottom > button').first().focus()
    await page.keyboard.press('Enter')
    await page.locator('.ca-settings [data-menu-action="settings"]').click()
    await expect(page.locator('.client-settings-page h1')).toHaveText('일반')
    await page.locator('.stg-back').click()
    await expect(page.locator('.client-settings-page')).toHaveCount(0)
  }
})

test('7언어 펼친 메뉴는 줄바꿈이 이웃 행을 침범하지 않고 배너가 로고·닫기를 가리지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 계정', email: 'review@example.test' })))
  await page.goto('/')
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(lang => localStorage.setItem('tethLang', lang), language)
    await page.reload()
    for (const width of [320, 861, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await openSidebar(page)
      const metrics = await page.locator('.client-sidebar.mobile-open').evaluate(root => {
        const labels = [...root.querySelectorAll('.client-research-navigation > nav > button > span')].map(el => {
          const r = el.getBoundingClientRect(), b = el.parentElement!.getBoundingClientRect()
          return { text: el.textContent, fits: r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.right <= b.right + 1 }
        })
        const brand = [...root.querySelectorAll('.client-drawer-brand button')].map(el => {
          const r = el.getBoundingClientRect()
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
        })
        return { labels, brand }
      })
      expect(metrics.labels.filter(label => !label.fits), `${language}/${width}`).toEqual([])
      expect(metrics.brand, `${language}/${width}`).toEqual([true, true])
      await page.keyboard.press('Escape')
    }
  }
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
  test(`펼친 사이드바의 ${signedIn ? '통합 프로필' : '계정 왼쪽·설정 오른쪽'} 동선과 키보드 순서가 일치한다`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    if (signedIn) await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 계정', email: 'review@example.test' })))
    await page.goto('/')
    const footer = page.locator('.client-sidebar-bottom')
    const accountName = signedIn ? '내 계정' : '사이드바 로그인'
    for (const width of [320, 390, 768, 861, 1440]) {
      // A desktop settings popover leaves the drawer open intentionally.
      // Establish the collapsed state before asserting collapsed DOM order.
      if (await page.locator('.client-sidebar.mobile-open').count()) {
        await page.locator('.client-drawer-brand button').last().click()
        await expect(page.locator('.client-sidebar')).not.toHaveClass(/mobile-open/)
      }
      await page.setViewportSize({ width, height: 900 })
      if (width > 860) {
        await expect(footer.locator('button').first()).toHaveAttribute('aria-label', signedIn ? accountName : '설정')
        await expect(footer.locator('button')).toHaveCount(signedIn ? 1 : 2)
        await expect(footer.locator('button').last()).toHaveAttribute('aria-label', accountName)
      }
      await openSidebar(page)
      if (signedIn) {
        const profile = footer.getByRole('button', { name: '검수 계정 설정', exact: true })
        await expect(footer.locator('button')).toHaveCount(1)
        await profile.focus(); await profile.press('Enter')
        await page.locator('.ca-settings [data-menu-action="settings"]').click()
        const settings = page.locator('.client-settings-page')
        await expect(settings.locator('h1')).toHaveText('일반')
        if (width <= 900) await settings.locator('.stg-mback').click()
        await settings.locator('a[href="#/settings/account"]').click()
        await expect(settings).toContainText('검수 계정')
        if (width <= 900) await settings.locator('.stg-mback').click()
        await settings.locator('.stg-back').click()
        await expect(settings).toHaveCount(0)
        continue
      }
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
