import { expect, test } from '@playwright/test'

test('세 장면이 하나의 기기를 공유하고 상태바·헤더·입력창이 겹치지 않는다', async ({ page }) => {
  await page.goto('/download/')
  const device = page.locator('.dev')
  await expect(device).toHaveCount(1)
  const bounds = await device.boundingBox()
  for (const name of ['대화', '검증 리포트', '모니터링']) {
    await page.getByRole('button', { name: name + ' 화면 보기' }).click()
    await expect.poll(async () => (await device.boundingBox())?.height).toBeCloseTo(bounds!.height, 1)
    await expect.poll(async () => (await device.boundingBox())?.width).toBeCloseTo(bounds!.width, 1)
    const sections = await page.evaluate(() => ['.phone-status', '.slide.on .phone-toolbar', '.slide.on .phone-content', '.phone-composer-area', '.phone-home'].map(selector => {
      const rect = document.querySelector(selector)!.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom }
    }))
    for (let i = 1; i < sections.length; i++) expect(sections[i].top).toBeGreaterThanOrEqual(sections[i - 1].bottom - 1)
    await expect(page.locator('.phone-context')).toContainText('MOCK')
  }
  const box = await device.boundingBox()
  expect(box!.width / box!.height).toBeCloseTo(390 / 844, 2)
})

test('방향키와 터치 스와이프가 동작하고 세로 스크롤은 장면을 바꾸지 않는다', async ({ page }) => {
  await page.goto('/download/')
  await page.getByRole('button', { name: '대화 화면 보기' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'report')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'chat')
  const stage = page.locator('.stage')
  await stage.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 260, clientY: 250 })
  await stage.dispatchEvent('pointerup', { pointerType: 'touch', clientX: 130, clientY: 260 })
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'report')
  await stage.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 200, clientY: 220 })
  await stage.dispatchEvent('pointerup', { pointerType: 'touch', clientX: 190, clientY: 400 })
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'report')
  const content = page.getByRole('region', { name: '검증 리포트 데모 내용' })
  await content.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'report')
  await expect(content).toBeFocused()
  await page.keyboard.press('End')
  await expect.poll(() => content.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThanOrEqual(1)
  await expect(content.getByText('의견 불일치', { exact: true })).toBeInViewport()
  const scroll = await content.evaluate(el => el.scrollTop)
  await page.getByRole('button', { name: '다음 앱 화면' }).click()
  expect(await page.locator('[data-screen="report"] .phone-content').evaluate(el => el.scrollTop)).toBe(scroll)
  await expect(page.getByRole('link', { name: '웹에서 TETH와 대화 시작' })).toBeVisible()
})

test('Chromium 터치 제스처로 내부 화면을 넘겨도 스크롤과 포커스를 잃지 않는다', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/download/')
  const content = page.getByRole('region', { name: '대화 데모 내용' })
  await content.focus()
  await content.scrollIntoViewIfNeeded()
  const rect = (await content.boundingBox())!
  const client = await context.newCDPSession(page)
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  const x = Math.round(rect.x + rect.width * .8), y = Math.round(rect.y + 100)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (const distance of [20, 40, 70, 110]) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - distance, y: y + 2 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(page.locator('.slide.on')).toHaveAttribute('data-screen', 'report')
  await expect(page.getByRole('region', { name: '검증 리포트 데모 내용' })).toBeFocused()
  await client.detach()
})

test('자동 미리보기는 화면 밖에서 정지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/download/')
  await page.mouse.move(0, 0)
  await expect(page.locator('.count')).toHaveText('2 / 3', { timeout: 9500 })
  await page.locator('.bar').scrollIntoViewIfNeeded()
  await expect(page.locator('.phone-preview')).not.toBeInViewport()
  const count = await page.locator('.count').textContent()
  await page.waitForTimeout(6500)
  await expect(page.locator('.count')).toHaveText(count!)
})

test('모바일 조작부는 44px이며 도움말에 가리지 않고 미리보기는 외부 앱을 로드하지 않는다', async ({ page }) => {
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  await page.goto('/download/')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    await page.locator('.preview-controls').scrollIntoViewIfNeeded()
    for (const button of await page.locator('.preview-controls button').all()) {
      const box = await button.boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
      await button.click({ trial: true })
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  }
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.locator('.phone-preview canvas')).toHaveCount(0)
  await page.getByRole('link', { name: '웹에서 TETH와 대화 시작' }).click()
  await expect(page.getByRole('textbox', { name: '시장이나 전략에 대해 물어보세요' })).toBeVisible()
  expect(failures).toEqual([])
})
