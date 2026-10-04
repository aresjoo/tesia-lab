import { expect, test } from '@playwright/test'

test('최신 원본 3개 캡처와 탭을 동일 기기 크기로 표시한다', async ({ page }, info) => {
  await page.goto('/download/')
  await expect(page.locator('.slide')).toHaveCount(3)
  // The restored source has no added prototype disclaimer (also asserted by
  // client-latest-public-source). Keep all image, sizing and interaction checks.
  await expect(page.locator('.prototype-notice')).toHaveCount(0)
  let height = 0
  for (const [screen, name] of [['chat', '대화'], ['report', '검증'], ['live', '실행']]) {
    await page.getByRole('tab', { name, exact: true }).click()
    const panel = page.getByRole('tabpanel')
    await expect(panel).toHaveAttribute('data-screen', screen)
    const image = panel.locator('img')
    await expect(image).toHaveAttribute('src', '/client-shots/dl-' + screen + '.webp')
    await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalHeight)).toBe(1688)
    const box = (await panel.locator('.dev').boundingBox())!
    expect(box.width / box.height).toBeCloseTo(.5, 2)
    if (height) expect(box.height).toBeCloseTo(height, 1)
    height = box.height
    await expect(page.locator('.slide[inert][aria-hidden=true]')).toHaveCount(2)
    await expect(page.locator('.phone-content,.phone-composer,.preview-controls')).toHaveCount(0)
  }
  await page.screenshot({ path: info.outputPath('download-source.png'), fullPage: true, animations: 'disabled' })
})

test('방향키 Home End 및 스와이프는 선택과 포커스를 일치시키고 세로 제스처는 무시한다', async ({ page }) => {
  await page.goto('/download/')
  await page.getByRole('tab', { name: '대화', exact: true }).focus()
  for (const [key, screen] of [['ArrowRight', 'report'], ['End', 'live'], ['ArrowRight', 'chat'], ['ArrowLeft', 'live'], ['Home', 'chat']]) {
    await page.keyboard.press(key)
    await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', screen)
    await expect(page.locator('[role=tab][aria-selected=true]')).toBeFocused()
  }
  const stage = page.locator('.stage')
  await stage.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 260, clientY: 250 })
  await stage.dispatchEvent('pointerup', { pointerType: 'touch', clientX: 130, clientY: 260 })
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'report')
  await expect(page.getByRole('tab', { name: '검증', exact: true })).toBeFocused()
  await stage.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 200, clientY: 220 })
  await stage.dispatchEvent('pointerup', { pointerType: 'touch', clientX: 190, clientY: 400 })
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'report')
})

test('Chromium 실제 터치 제스처도 새 탭으로 포커스를 이어준다', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/download/')
  await page.getByRole('tab', { name: '대화', exact: true }).focus()
  await page.locator('.slide.on .dev').scrollIntoViewIfNeeded()
  const rect = (await page.locator('.slide.on .dev').boundingBox())!
  const client = await context.newCDPSession(page)
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  const x = Math.round(rect.x + rect.width * .8), y = Math.round(Math.max(rect.y, 70) + 100)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (const distance of [20, 40, 70, 110]) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - distance, y: y + 2 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'report')
  await expect(page.getByRole('tab', { name: '검증', exact: true })).toBeFocused()
  await client.detach()
})

test('6초 자동 넘김은 화면 밖에서 정지하고 수동 선택 후 재시작하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/download/')
  await page.locator('.phone-preview').scrollIntoViewIfNeeded()
  await page.mouse.move(0, 0)
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'report', { timeout: 9500 })
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await expect(page.locator('.phone-preview')).not.toBeInViewport()
  await page.waitForTimeout(6500)
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'report')
  await page.getByRole('tab', { name: '실행', exact: true }).click()
  await page.getByRole('tab', { name: '실행', exact: true }).blur()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(6500)
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'live')
})

test('reduced motion은 자동 넘김 없이 수동 선택을 유지한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/download/')
  await page.locator('.phone-preview').scrollIntoViewIfNeeded()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(6500)
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'chat')
  await page.getByRole('tab', { name: '검증', exact: true }).click()
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'report')
})

test('보조 기술용 정지 조작은 초점 시 드러나며 자동 넘김을 영구 정지한다', async ({ page }) => {
  await page.goto('/download/')
  const stop = page.getByRole('button', { name: '자동 넘김 멈추기', exact: true })
  await stop.focus()
  await expect(stop).toBeInViewport()
  await expect(stop).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(stop).toHaveAttribute('aria-pressed', 'true')
  await stop.blur()
  await page.locator('.phone-preview').scrollIntoViewIfNeeded()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(6500)
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'chat')
})

test('44px 탭·확대 텍스트·모바일 도움말 및 웹 진입을 검증한다', async ({ page }, info) => {
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  await page.goto('/download/')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    for (const button of await page.getByRole('tab').all()) {
      const box = (await button.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      await button.click({ trial: true })
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  }
  await page.setViewportSize({ width: 320, height: 844 })
  await page.locator('.public-language-trigger').click()
  await page.getByRole('button', { name: 'Français', exact: true }).click()
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>('.dl *, .sub-help *')) {
      const size = getComputedStyle(element).fontSize
      element.dataset.baseFont = size
    }
    for (const element of document.querySelectorAll<HTMLElement>('[data-base-font]')) element.style.fontSize = parseFloat(element.dataset.baseFont!) * 2 + 'px'
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: info.outputPath('download-320-fr-200.png'), fullPage: true })
  await expect(page.locator('iframe,.phone-preview canvas')).toHaveCount(0)
  await page.locator('.dl-cta').click()
  await expect(page.getByRole('textbox')).toBeVisible()
  expect(failures).toEqual([])
})
